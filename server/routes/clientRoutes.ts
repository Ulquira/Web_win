import { Router } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import pool from '../db.ts';
import { decodeOpaqueToken, createOpaqueToken, isOpaqueTokenExpired } from '../opaqueToken.ts';
import { replicateChange } from '../replicationService.ts';
import { BoundedTtlCache } from '../shared/ttlCache.ts';
import {
  isOrderExpired,
  mapEstadoToStatusFront,
  parseCoordinates,
  isFotoAprobadaFlag,
  parseValidImage,
  maskDni,
  classifyOrderType,
  buildMiWinVisitasPayload,
  safeTimingEqual,
  shouldExposePinToClient,
  isPrefixedTicketCode
} from '../shared/orderHelpers.ts';

const router = Router();

const getClientIp = (req: express.Request): string =>
  (req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '');

// Micro-caché acotado en memoria (LRU + TTL) para mitigar carga masiva en DB y Google APIs sin riesgo de OOM
const apiCache = new BoundedTtlCache<any>(5000);
const INST_CACHE_TTL_MS = 8000;
const ROUTE_CACHE_TTL_MS = 60000;

const CAPA_INTERMEDIA_URL = process.env.CAPA_INTERMEDIA_URL || 'http://localhost:4001';
const SECRET_API_KEY = process.env.SECRET_API_KEY || "LLAVE_SECRETA_DEL_TERCERO_123";

// Rate limiters para endpoints públicos y proxy de Google Routes
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_READ || '120', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas consultas. Intente nuevamente en un minuto.' }
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_WRITE || '60', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes enviadas. Intente más tarde.' }
});

const routeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_ROUTE || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Límite de cálculo de rutas alcanzado. Intente en un minuto.' }
});

const guestValidateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GUEST || '20', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos. Por favor espera un minuto.' }
});

const guestPinAttemptsCache = new BoundedTtlCache<number>(5000);
const MAX_GUEST_PIN_ATTEMPTS = 5;
const GUEST_LOCKOUT_TTL_MS = 15 * 60 * 1000;

// Endpoint para consultar disponibilidad de cupos en tiempo real
router.get('/cupos/:token', readLimiter, async (req, res) => {
  const token = String(req.params.token || '').trim();
  try {
    const response = await fetch(`${CAPA_INTERMEDIA_URL}/api/v1/terceros/cupos/${encodeURIComponent(token)}`, {
      headers: { 'Authorization': `Bearer ${SECRET_API_KEY}` },
      signal: AbortSignal.timeout(12000)
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('Error consultando cupos en capa intermedia:', error);
    return res.status(500).json({ success: false, message: 'Error interno consultando cupos' });
  }
});

// Endpoint para guardar reprogramaciones delegando a la capa intermedia y CRM
router.post('/reprogramar', writeLimiter, async (req, res) => {
  const { token, fecha, turno, motivo, motivoSeleccionado, pin } = req.body;
  if (!token || !fecha || !turno) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios' });
  }

  const motivoDetalle = [motivoSeleccionado, motivo].filter(Boolean).join(' - ') || 'Reprogramación - Solicitud del Cliente';

  try {
    const response = await fetch(`${CAPA_INTERMEDIA_URL}/api/v1/terceros/reprogramar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SECRET_API_KEY}`
      },
      body: JSON.stringify({
        token,
        fecha,
        turno,
        motivo: motivoDetalle,
        pin
      }),
      signal: AbortSignal.timeout(15000)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      apiCache.delete(`inst_${token}`);

      // La inserción en REPROGRAMACIONES ya la realiza capa_intermedia; aquí solo replicamos
      const formatYmd = (dStr: string) => {
        if (!dStr) return dStr;
        const c = dStr.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(c)) return c;
        if (/^\d{2}-\d{2}-\d{4}$/.test(c)) {
          const [d, m, y] = c.split('-');
          return `${y}-${m}-${d}`;
        }
        return c;
      };
      const mysqlDate = formatYmd(fecha);

      try {
        replicateChange('REPROGRAMACIONES', 'INSERT', {
          token,
          fecha_solicitada: mysqlDate,
          turno: turno.trim(),
          motivo: motivoDetalle
        });
      } catch (repErr) {
        console.warn('Advertencia en replicateChange:', repErr);
      }
    }

    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('Error comunicando con capa intermedia para reprogramar:', error);
    return res.status(500).json({ success: false, message: 'Error interno guardando la solicitud' });
  }
});

// Endpoint para guardar Encuestas en BD (soporta nuevo modelo Encuesta_app y modelo previo ENCUESTAS)
const encuestaAppSchema = z.object({
  token: z.string().min(1),
  orden_id: z.union([z.string(), z.number()]).optional().nullable(),
  codisegui: z.union([z.string(), z.number()]).optional().nullable(),
  satisfaccion_atencion: z.coerce.number().min(1).max(5).optional().nullable(),
  facilidad_uso: z.coerce.number().min(1).max(5),
  satisfaccion_experiencia: z.coerce.number().min(1).max(5),
  seguridad_datos_tecnico: z.string().min(1),
  comentarios: z.string().max(1000).optional().default('')
});

const encuestaSchema = z.object({
  token: z.string().min(1).max(150),
  instalacion_concretada: z.string().min(1).max(50),
  tecnico_trato: z.union([z.number(), z.string()]).optional(),
  tecnico_puntualidad: z.union([z.number(), z.string()]).optional(),
  tecnico_claridad: z.union([z.number(), z.string()]).optional(),
  tecnico_orden: z.union([z.number(), z.string()]).optional(),
  tecnico_efectividad: z.union([z.number(), z.string()]).optional(),
  satisfaccion_general: z.union([z.number(), z.string()]),
  satisfaccion_comentario: z.string().max(1000).optional().default(''),
  facilidad_gestion: z.union([z.number(), z.string()]).optional(),
  facilidad_motivo: z.string().max(500).optional().default('')
});

router.post('/encuesta', writeLimiter, async (req, res) => {
  // 1. Evaluar si es el nuevo formato para Encuesta_app
  const parseAppResult = encuestaAppSchema.safeParse(req.body);
  if (parseAppResult.success) {
    const {
      token,
      orden_id,
      codisegui,
      satisfaccion_atencion,
      facilidad_uso,
      satisfaccion_experiencia,
      seguridad_datos_tecnico,
      comentarios
    } = parseAppResult.data;

    try {
      const clientIp = getClientIp(req) || null;
      const userAgent = (req.headers['user-agent'] as string) || null;

      const query = `
        INSERT INTO Encuesta_app (token, orden_id, codisegui, satisfaccion_atencion, facilidad_uso, satisfaccion_experiencia, seguridad_datos_tecnico, comentarios, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await pool.query(query, [
        token,
        orden_id || null,
        codisegui || null,
        satisfaccion_atencion || null,
        facilidad_uso,
        satisfaccion_experiencia,
        seguridad_datos_tecnico,
        comentarios || null,
        clientIp,
        userAgent
      ]);

      apiCache.delete(`inst_${token}`);
      return res.json({ success: true, message: 'Encuesta guardada con éxito' });
    } catch (error) {
      console.error('Error guardando en Encuesta_app:', error);
      return res.status(500).json({ success: false, message: 'Error interno guardando la encuesta' });
    }
  }

  // 2. Fallback a formato legado ENCUESTAS
  const parseResult = encuestaSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios o son inválidos', errors: parseResult.error.format() });
  }

  const { 
    token, instalacion_concretada, tecnico_trato, tecnico_puntualidad, tecnico_claridad, 
    tecnico_orden, tecnico_efectividad, satisfaccion_general, satisfaccion_comentario, 
    facilidad_gestion, facilidad_motivo 
  } = parseResult.data;

  try {
    const query = `
      INSERT INTO ENCUESTAS (token, instalacion_concretada, tecnico_trato, tecnico_puntualidad, tecnico_claridad, tecnico_orden, tecnico_efectividad, satisfaccion_general, satisfaccion_comentario, facilidad_gestion, facilidad_motivo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await pool.query(query, [
      token, instalacion_concretada, tecnico_trato, tecnico_puntualidad, tecnico_claridad, 
      tecnico_orden, tecnico_efectividad, satisfaccion_general, satisfaccion_comentario, 
      facilidad_gestion, facilidad_motivo
    ]);

    // Invalidar caché inmediato
    apiCache.delete(`inst_${token}`);

    res.json({ success: true, message: 'Encuesta guardada con éxito' });
  } catch (error) {
    console.error('Error guardando encuesta en BD:', error);
    res.status(500).json({ success: false, message: 'Error interno guardando la encuesta' });
  }
});

// Endpoint para verificar si un token ya llenó la encuesta en BD (revisa Encuesta_app y ENCUESTAS)
router.get('/encuesta/verificar/:token', readLimiter, async (req, res) => {
  const { token } = req.params;
  try {
    const [rowsApp]: any = await pool.query('SELECT id FROM Encuesta_app WHERE token = ? LIMIT 1', [token]);
    if (rowsApp && rowsApp.length > 0) {
      return res.json({ success: true, completada: true });
    }

    const [rows]: any = await pool.query('SELECT id FROM ENCUESTAS WHERE token = ? LIMIT 1', [token]);
    const completada = rows && rows.length > 0;

    res.json({ success: true, completada });
  } catch (error) {
    console.error('Error verificando encuesta en BD:', error);
    res.status(500).json({ success: false, completada: false });
  }
});

// Función para obtener la fecha y hora actual en la zona horaria de Lima (UTC-5)
const getLimaDateTime = () => {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  return formatter.format(new Date()); // Retorna "YYYY-MM-DD HH:mm:ss"
};

// Función para parsear el User-Agent y obtener Navegador y Sistema Operativo de forma ligera
const parseUserAgent = (ua: string) => {
  let sistema_operativo = 'Otro';
  let navegador = 'Otro';

  if (!ua) return { sistema_operativo, navegador };

  // Detectar Sistema Operativo
  if (/Windows/i.test(ua)) sistema_operativo = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(ua)) sistema_operativo = 'iOS';
  else if (/Android/i.test(ua)) sistema_operativo = 'Android';
  else if (/Macintosh|Mac OS X/i.test(ua)) sistema_operativo = 'macOS';
  else if (/Linux/i.test(ua)) sistema_operativo = 'Linux';

  // Detectar Navegador
  if (/WhatsApp/i.test(ua)) navegador = 'WhatsApp WebView';
  else if (/Edg/i.test(ua)) navegador = 'Edge';
  else if (/Chrome/i.test(ua) && /Safari/i.test(ua)) navegador = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) navegador = 'Safari';
  else if (/Firefox/i.test(ua)) navegador = 'Firefox';
  
  return { sistema_operativo, navegador };
};

// Caché acotado en memoria para metadatos de token (CodiSegui, Zona, Producto, existencia)
const tokenMetaCache = new BoundedTtlCache<{ exists: boolean; codisegui: string | null; zona: string | null; producto: string | null }>(5000);

async function getTokenMetadata(token: string) {
  const cached = tokenMetaCache.get(token);
  if (cached) {
    return cached;
  }
  try {
    // 1. Buscar en VW_WinORdeTraba (Producción)
    let [rows]: any = await pool.query(
      'SELECT CodiSegui, Zona, Producto FROM VW_WinORdeTraba WHERE token = ? LIMIT 1',
      [token]
    );

    if ((!rows || rows.length === 0) && isPrefixedTicketCode(token)) {
      [rows] = await pool.query(
        'SELECT CodiSegui, Zona, Producto FROM VW_WinORdeTraba WHERE CodiSegui = ? LIMIT 1',
        [token]
      );
    }

    // 2. Fallback en Testmantra (QA / Pruebas)
    if (!rows || rows.length === 0) {
      [rows] = await pool.query(
        'SELECT CodiSegui, Zona, Producto FROM Testmantra WHERE token = ? LIMIT 1',
        [token]
      );
    }

    if (rows && rows.length > 0) {
      const meta = {
        exists: true,
        codisegui: rows[0].CodiSegui || null,
        zona: rows[0].Zona || null,
        producto: rows[0].Producto || null
      };
      tokenMetaCache.set(token, meta, 5 * 60 * 1000);
      return meta;
    }
  } catch (err) {
    console.error('Error obteniendo metadata de token para logs:', err);
  }
  const notFoundMeta = { exists: false, codisegui: null, zona: null, producto: null };
  tokenMetaCache.set(token, notFoundMeta, 60_000);
  return notFoundMeta;
}

// Endpoint para guardar Logs de Interacción en BD
const logSchema = z.object({
  token: z.string().min(5).max(150),
  evento: z.string().max(100),
  detalles: z.any().optional(),
  dispositivo: z.any().optional()
});

router.post('/log', writeLimiter, async (req, res) => {
  const parseResult = logSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ success: false, message: 'Datos inválidos', errors: parseResult.error.format() });
  }

  const { token, evento, detalles, dispositivo } = parseResult.data;

  // Obtener IP real del cliente
  const ip_address = getClientIp(req);

  // Obtener el User-Agent para detectar Navegador y Sistema Operativo
  const userAgentHeader = req.headers['user-agent'] || '';
  const { navegador, sistema_operativo } = parseUserAgent(userAgentHeader);

  const limaTime = getLimaDateTime();

  try {
    // Obtener CodiSegui, Zona y Producto asociados al token
    const meta = await getTokenMetadata(token);

    // Verificar si es la primera visita absoluta de este token a la web
    let esPrimeraVisita = false;
    if (evento === 'ver_seguimiento_instalacion') {
      const [rows]: any = await pool.query(
        "SELECT id FROM LOGS_TRAKING WHERE token = ? AND evento = 'primera_visita' LIMIT 1",
        [token]
      );
      if (rows.length === 0) {
        esPrimeraVisita = true;
      }
    }

    // Si es la primera vez que abre el enlace, insertamos el evento de 'primera_visita'
    if (esPrimeraVisita) {
      const insertPrimeraQuery = `
        INSERT INTO LOGS_TRAKING (token, codisegui, zona, producto, evento, ip_address, detalles, sistema_operativo, timestamp, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await pool.query(insertPrimeraQuery, [
        token, 
        meta.codisegui,
        meta.zona,
        meta.producto,
        'primera_visita', 
        ip_address, 
        detalles ? JSON.stringify(detalles) : null,
        sistema_operativo,
        limaTime,
        limaTime
      ]);

      // Replicar en tiempo real a la BD secundaria
      replicateChange('LOGS_TRAKING', 'INSERT', {
        token,
        codisegui: meta.codisegui,
        zona: meta.zona,
        producto: meta.producto,
        evento: 'primera_visita',
        ip_address,
        detalles: detalles ? JSON.stringify(detalles) : null,
        sistema_operativo,
        timestamp: limaTime,
        created_at: limaTime
      });
    }

    // Insertar el evento actual normalmente
    const query = `
      INSERT INTO LOGS_TRAKING (token, codisegui, zona, producto, evento, ip_address, detalles, sistema_operativo, timestamp, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await pool.query(query, [
      token, 
      meta.codisegui,
      meta.zona,
      meta.producto,
      evento, 
      ip_address, 
      detalles ? JSON.stringify(detalles) : null,
      sistema_operativo,
      limaTime,
      limaTime
    ]);

    // Replicar en tiempo real a la BD secundaria
    replicateChange('LOGS_TRAKING', 'INSERT', {
      token,
      codisegui: meta.codisegui,
      zona: meta.zona,
      producto: meta.producto,
      evento,
      ip_address,
      detalles: detalles ? JSON.stringify(detalles) : null,
      sistema_operativo,
      timestamp: limaTime,
      created_at: limaTime
    });

    res.json({ success: true });  
  } catch (error) {
    console.error('Error guardando log en BD:', error);
    res.status(500).json({ success: false, message: 'Error interno guardando el log' });
  }
});

// Obtener detalles de una instalación por token
router.get('/instalaciones/:token', readLimiter, async (req, res) => {
  const token = String(req.params.token || '').trim();

  // 1. Revisar si la respuesta ya está en micro-caché (absorbe polling masivo concurrente)
  const cached = apiCache.get(`inst_${token}`);
  if (cached) {
    return res.json(cached);
  }

  try {
    // 1. Ejecutamos las verificaciones locales (Reprogramación y Encuesta) en paralelo con Promise.all
    const [reprogResult, encuestaResult, capaResponse] = await Promise.allSettled([
      pool.query('SELECT id FROM REPROGRAMACIONES WHERE token = ? LIMIT 1', [token]),
      pool.query('SELECT id FROM Encuesta_app WHERE token = ? UNION SELECT id FROM ENCUESTAS WHERE token = ? LIMIT 1', [token, token]),
      fetch(`${CAPA_INTERMEDIA_URL}/api/v1/terceros/instalaciones/${encodeURIComponent(token)}`, {
        headers: { 'Authorization': `Bearer ${SECRET_API_KEY}` },
        signal: AbortSignal.timeout(8000)
      })
    ]);

    // Evaluación de reprogramación
    let reprogramadaBD = false;
    if (reprogResult.status === 'fulfilled') {
      const [reprogRows]: any = reprogResult.value;
      if (reprogRows && reprogRows.length > 0) reprogramadaBD = true;
    }

    // Evaluación de encuesta completada
    let encuestaCompletadaBD = false;
    if (encuestaResult.status === 'fulfilled') {
      const [encuestaRows]: any = encuestaResult.value;
      if (encuestaRows && encuestaRows.length > 0) encuestaCompletadaBD = true;
    }

    // Evaluación de respuesta de Capa Intermedia o Fallback a BD directa
    let data: any = null;

    if (capaResponse.status === 'fulfilled' && capaResponse.value.status === 410) {
      const expiredData = await capaResponse.value.json();
      return res.status(410).json(expiredData);
    }

    if (capaResponse.status === 'fulfilled' && capaResponse.value.ok) {
      data = await capaResponse.value.json();
    } else {
      // Fallback local robusto: Consultar directamente en BD_Phoenix si la capa intermedia no está activa localmente
      let [rows]: any = await pool.query(
        `SELECT 
           w.OrdenId AS idoperacion, 
           w.Estado, 
           w.\`Estado OT\` AS SubEstado, 
           w.Cuadrilla,
           w.Cuadrilla_nombre,
           vc.Nombre_Tecnico_Limpio AS nombre_tecnico_completo,
           vc.Documento AS dni_tecnico,
           vc.Img_mejorada AS foto_mejorada,
           vc.Foto_Img AS foto_original,
           vc.foto_aprobada AS foto_aprobada,
           w.Proveedeor, 
           w.Georeferencia AS coordenadas_direccion, 
           w.Georeferencia_tecnico AS Ubi_TEC, 
           w.TeleMovilNume AS telefono, 
           DATE(w.\`F.Soli\`) AS fecha_programacion, 
           TIME(w.\`F.Soli\`) AS Tramo_Atencio, 
           TIMESTAMPDIFF(SECOND, w.\`F.Soli\`, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00')) AS segundos_desde_soli,
           w.ClienteFinal AS nom_cliente, 
           w.Direccion AS direccion_cliente, 
           w.IdenServi AS Campaña, 
           w.token AS Token_inicio,
           w.Pin_token AS pin_token,
           w.link,
           w.CodiSegui AS codisegui,
           w.CodiSeguiClien AS codiseguiclien,
           w.Producto AS producto,
           w.TipoTraba AS tipo_trabajo,
           ts.Tipo AS tipo_servicio
         FROM VW_WinORdeTraba w
         LEFT JOIN vw_info_cuadrillas vc ON w.Cuadrilla = vc.Cuadrilla
         LEFT JOIN tiposervicio ts ON UPPER(TRIM(w.Producto)) = UPPER(TRIM(ts.Servicio))
         WHERE w.token = ? 
         ORDER BY w.\`F.Soli\` DESC LIMIT 1`,
        [token]
      );

      if (!rows || rows.length === 0) {
        [rows] = await pool.query(
          `SELECT 
             w.OrdenId AS idoperacion, 
             w.Estado, 
             w.\`Estado OT\` AS SubEstado, 
             w.Cuadrilla,
             w.Cuadrilla_nombre,
             vc.Nombre_Tecnico_Limpio AS nombre_tecnico_completo,
             vc.Documento AS dni_tecnico,
             vc.Img_mejorada AS foto_mejorada,
             vc.Foto_Img AS foto_original,
             vc.foto_aprobada AS foto_aprobada,
             w.Proveedeor, 
             w.Georeferencia AS coordenadas_direccion, 
             w.Georeferencia_tecnico AS Ubi_TEC, 
             w.TeleMovilNume AS telefono, 
             DATE(w.\`F.Soli\`) AS fecha_programacion, 
             TIME(w.\`F.Soli\`) AS Tramo_Atencio, 
             TIMESTAMPDIFF(SECOND, w.\`F.Soli\`, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00')) AS segundos_desde_soli,
             w.ClienteFinal AS nom_cliente, 
             w.Direccion AS direccion_cliente, 
             w.IdenServi AS Campaña, 
             w.token AS Token_inicio,
             w.Pin_token AS pin_token,
             w.link,
             w.CodiSegui AS codisegui,
             w.CodiSeguiClien AS codiseguiclien,
             w.Producto AS producto,
             w.TipoTraba AS tipo_trabajo,
             ts.Tipo AS tipo_servicio
           FROM Testmantra w
           LEFT JOIN vw_info_cuadrillas vc ON w.Cuadrilla = vc.Cuadrilla
           LEFT JOIN tiposervicio ts ON UPPER(TRIM(w.Producto)) = UPPER(TRIM(ts.Servicio))
           WHERE w.token = ? 
           ORDER BY w.\`F.Soli\` DESC LIMIT 1`,
          [token]
        );
      }

      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Operación no encontrada' });
      }

      const op = rows[0];
      if (isOrderExpired(op.segundos_desde_soli)) {
        return res.status(410).json({ success: false, expired: true, message: 'Este enlace de seguimiento ha expirado.' });
      }

      const { isPostventa, isTicket } = classifyOrderType(op);
      const statusFront = mapEstadoToStatusFront(op.Estado);
      const coordsCliente = parseCoordinates(op.coordenadas_direccion);
      const coordsTecnico = parseCoordinates(op.Ubi_TEC);
      const fotoTecnico = isFotoAprobadaFlag(op.foto_aprobada)
        ? (parseValidImage(op.foto_mejorada) || parseValidImage(op.foto_original) || null)
        : null;

      data = {
        success: true,
        data: {
          idoperacion: op.idoperacion,
          codisegui: op.codisegui || null,
          status: statusFront,
          eta: op.SubEstado ? op.SubEstado : null,
          trafico: null,
          coordenadas_cliente: coordsCliente,
          coordenadas_tecnico: coordsTecnico,
          fecha_programacion: op.fecha_programacion,
          tramo: op.Tramo_Atencio,
          cliente_nombre: op.nom_cliente,
          cliente_telefono: op.telefono || null,
          direccion: op.direccion_cliente,
          campana: op.Campaña,
          token_inicio: op.Token_inicio || null,
          pin_token: shouldExposePinToClient(statusFront) ? (op.pin_token || null) : null,
          tipo: isPostventa ? 'postventa' : (isTicket ? 'ticket' : 'instalacion'),
          tipo_servicio: isPostventa ? 'POSTVENTA' : (op.tipo_servicio || (isTicket ? 'AVERIAS' : 'INSTALACION')),
          tipo_trabajo: op.tipo_trabajo || null,
          motivo_postventa: op.tipo_trabajo || null,
          producto: op.producto || null,
          tecnico: (op.Cuadrilla || op.Cuadrilla_nombre || op.nombre_tecnico_completo) ? {
            nombre: op.nombre_tecnico_completo || op.Cuadrilla_nombre || 'Técnico Asignado',
            dni: maskDni(op.dni_tecnico),
            foto: fotoTecnico,
            cuadrilla: op.Cuadrilla,
            telefono: op.telefono || 'Central'
          } : undefined
        }
      };
    }

    if (data && data.data) {
      // Solo consultar REPROGRAMACIONES por token alterno si existe un token_inicio distinto al consultado
      if (!reprogramadaBD && data.data.token_inicio && data.data.token_inicio !== token) {
        try {
          const [altReprog]: any = await pool.query(
            `SELECT id FROM REPROGRAMACIONES WHERE token = ? LIMIT 1`,
            [data.data.token_inicio]
          );
          if (altReprog && altReprog.length > 0) {
            reprogramadaBD = true;
          }
        } catch (e) {
          console.warn('Error verificando reprogramacion alterna:', e);
        }
      }

      data.data.reprogramada = reprogramadaBD;
      data.data.encuesta_completada = encuestaCompletadaBD;
    }

    // Guardar en micro-caché
    apiCache.set(`inst_${token}`, data, INST_CACHE_TTL_MS);

    res.json(data);

  } catch (error) {
    console.error('Error al conectar con la capa intermedia:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Endpoint MiWIN: Consulta de atenciones estrictamente por token opaco (vigencia 72h)
router.get('/cliente/visitas/v/:token', readLimiter, async (req, res) => {
  const rawToken = String(req.params.token || '').trim();
  const decoded = decodeOpaqueToken(rawToken);
  const cleanDni = decoded?.documento ? String(decoded.documento).trim() : '';

  if (!cleanDni || cleanDni.length < 5) {
    return res.status(400).json({ success: false, message: 'Token inválido o no autorizado' });
  }

  if (decoded && isOpaqueTokenExpired(decoded.timestamp)) {
    return res.status(410).json({ success: false, expired: true, message: 'Este enlace ha expirado.' });
  }

  const cacheKey = `cliente_visitas_${cleanDni}`;
  const cached = apiCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    let data: any = null;

    try {
      const capaResponse = await fetch(`${CAPA_INTERMEDIA_URL}/api/v1/terceros/cliente/visitas/v/${encodeURIComponent(rawToken)}`, {
        headers: { 'Authorization': `Bearer ${SECRET_API_KEY}` },
        signal: AbortSignal.timeout(8000)
      });
      if (capaResponse.status === 410) {
        const expiredJson = await capaResponse.json();
        return res.status(410).json(expiredJson);
      }
      if (capaResponse.ok) {
        const json = await capaResponse.json();
        if (json && json.visitas && json.visitas.length > 0) {
          data = json;
        }
      }
    } catch {
      // Fallback a consulta directa
    }

    if (!data) {
      const querySQL = `
        SELECT 
          w.OrdenId AS idoperacion,
          w.Estado,
          w.\`Estado OT\` AS SubEstado,
          w.token,
          w.Pin_token,
          w.CodiSegui AS codisegui,
          w.CodiSeguiClien AS codiseguiclien,
          w.Producto AS producto,
          w.IdenServi AS campana,
          w.Direccion AS direccion,
          DATE(w.\`F.Soli\`) AS fecha_programacion,
          TIME(w.\`F.Soli\`) AS tramo,
          TIMESTAMPDIFF(SECOND, w.\`F.Soli\`, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00')) AS segundos_desde_soli,
          w.ClienteFinal AS nom_cliente,
          ts.Tipo AS tipo_servicio
        FROM VW_WinORdeTraba w
        LEFT JOIN tiposervicio ts ON UPPER(TRIM(w.Producto)) = UPPER(TRIM(ts.Servicio))
        WHERE (REPLACE(w.\`Número Documento\`, '*', '') = ? OR w.\`Número Documento\` = ?)
        ORDER BY w.\`F.Soli\` DESC, w.OrdenId DESC
      `;

      let [rows]: any = await pool.query(querySQL, [cleanDni, cleanDni]);
      let list = rows as any[];

      if (list.length === 0) {
        const [testRows]: any = await pool.query(
          `SELECT 
            w.OrdenId AS idoperacion,
            w.Estado,
            w.\`Estado OT\` AS SubEstado,
            w.token,
            w.Pin_token,
            w.CodiSegui AS codisegui,
            w.CodiSeguiClien AS codiseguiclien,
            w.Producto AS producto,
            w.IdenServi AS campana,
            w.Direccion AS direccion,
            DATE(w.\`F.Soli\`) AS fecha_programacion,
            TIME(w.\`F.Soli\`) AS tramo,
            TIMESTAMPDIFF(SECOND, w.\`F.Soli\`, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00')) AS segundos_desde_soli,
            w.ClienteFinal AS nom_cliente,
            ts.Tipo AS tipo_servicio
          FROM Testmantra w
          LEFT JOIN tiposervicio ts ON UPPER(TRIM(w.Producto)) = UPPER(TRIM(ts.Servicio))
          WHERE (REPLACE(w.\`Número Documento\`, '*', '') = ? OR w.\`Número Documento\` = ?)
          ORDER BY w.\`F.Soli\` DESC, w.OrdenId DESC`,
          [cleanDni, cleanDni]
        );
        list = testRows as any[];
      }

      const activeList = list.filter((item: any) => !isOrderExpired(item.segundos_desde_soli));

      if (list.length > 0 && activeList.length === 0) {
        return res.status(410).json({ success: false, expired: true, message: 'Este enlace ha expirado.' });
      }

      if (activeList.length === 0) {
        data = { success: true, count: 0, cliente_nombre: null, visitas: [] };
      } else {
        data = buildMiWinVisitasPayload(activeList);
      }
    }

    apiCache.set(cacheKey, data, INST_CACHE_TTL_MS);

    res.json(data);
  } catch (error) {
    console.error('Error en /api/cliente/visitas:', error);
    res.status(500).json({ success: false, message: 'Error interno consultando visitas' });
  }
});

// Rate limiting para FollowMiWIN (100 reqs/min por IP)
const followmiwinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_FOLLOWMIWIN || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas solicitudes a la API de FollowMiWIN. Intente más tarde.'
  }
});

// Middleware de Whitelist de IP para ambientes productivos Win
const WIN_ALLOWED_IPS = (process.env.WIN_ALLOWED_IPS || '')
  .split(',')
  .map(ip => ip.trim())
  .filter(Boolean);

const ipWhitelistMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (WIN_ALLOWED_IPS.length === 0) {
    return next();
  }

  // Usar req.ip resuelto de forma segura con app.set('trust proxy', 1) en lugar de X-Forwarded-For crudo
  const rawIp = req.ip || req.socket.remoteAddress || '';
  const clientIp = rawIp.replace(/^::ffff:/, '');

  const isAllowed = WIN_ALLOWED_IPS.includes(clientIp) || clientIp === '127.0.0.1' || clientIp === '::1';

  if (!isAllowed) {
    console.warn(`[Security] Acceso denegado a /api/followmiwin desde IP no autorizada: ${clientIp}`);
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado: IP de origen no autorizada en ambientes productivos Win.'
    });
  }

  next();
};

// Middleware de Autorización por API Key / OAuth Bearer Token
const envFollowMiwinKeys = (process.env.FOLLOWMIWIN_API_KEY || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

const FOLLOWMIWIN_VALID_KEYS = [
  ...envFollowMiwinKeys,
  'M1w1n4pp_9d12517a24d7f28c2c6fa6ae296a190c', // Producción principal
  'M1w1n4pp_7273dba14ceba0d31b716cc5b7a04ec4'  // Pruebas / Testing temporal
];

const authFollowMiwin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKeyHeader = req.headers['x-api-key'] as string;
  const authHeader = req.headers['authorization'];

  let token = apiKeyHeader;
  if (!token && authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      token = authHeader.trim();
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado: Se requiere cabecera x-api-key o Authorization: Bearer <token>'
    });
  }

  if (FOLLOWMIWIN_VALID_KEYS.some(validKey => safeTimingEqual(token, validKey))) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Token o API Key inválido para consultar FollowMiWIN.'
  });
};

const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || 'https://enruta.win.pe').replace(/\/+$/, '');

// Endpoint FollowMiWIN: Consulta por documento para integraciones de otras áreas
router.get(
  ['/followmiwin/:documento', '/followmiwin'],
  followmiwinLimiter,
  ipWhitelistMiddleware,
  authFollowMiwin,
  async (req, res) => {
  const paramDoc = req.params.documento || (req.query.documento as string);
  const rawDoc = String(paramDoc || '').trim();
  const cleanDoc = rawDoc.replace(/[^0-9a-zA-Z]/g, '');

  if (!cleanDoc || cleanDoc.length < 5) {
    return res.status(400).json({
      success: false,
      message: 'Documento inválido. Debe proporcionar un número de documento válido.'
    });
  }

  try {
    const unpaddedDoc = cleanDoc.replace(/^0+/, '');
    const padded8Doc = cleanDoc.padStart(8, '0');

    // 1. Consultar órdenes históricas del documento para diagnosticar estado real
    const allQuerySQL = `
      SELECT 
        w.OrdenId AS idoperacion,
        TRIM(w.Estado) AS estado,
        w.\`Estado OT\` AS sub_estado,
        w.CodiSegui AS codisegui,
        w.CodiSeguiClien AS codiseguiclien,
        DATE(w.\`F.Soli\`) AS fecha_programacion
      FROM VW_WinORdeTraba w
      WHERE (
        TRIM(REPLACE(w.\`Número Documento\`, '*', '')) IN (?, ?, ?) 
        OR TRIM(w.\`Número Documento\`) IN (?, ?, ?)
        OR TRIM(w.CodiClien) = ?
      )
      ORDER BY w.\`F.Soli\` DESC, w.OrdenId DESC
    `;

    const searchParams = [cleanDoc, unpaddedDoc, padded8Doc, cleanDoc, unpaddedDoc, padded8Doc, cleanDoc];
    let [allRows]: any = await pool.query(allQuerySQL, searchParams);
    let listAll = allRows as any[];

    if (listAll.length === 0) {
      const [testRows]: any = await pool.query(
        allQuerySQL.replace('VW_WinORdeTraba', 'Testmantra'),
        searchParams
      );
      listAll = testRows as any[];
    }

    // Filtrar estrictamente órdenes abiertas: Iniciada, En camino, Pendiente, Agendada
    const ESTADOS_ABIERTOS = ['INICIADA', 'EN CAMINO', 'PENDIENTE', 'AGENDADA'];
    const abiertas = listAll.filter((item: any) => 
      ESTADOS_ABIERTOS.includes((item.estado || '').toUpperCase().trim())
    );

    // Desduplicar por ticket/caso para reflejar servicios reales en curso
    const casesSet = new Set<string>();
    for (const item of abiertas) {
      const caseKey = item.codisegui || item.codiseguiclien || `ord_${item.idoperacion}`;
      casesSet.add(caseKey);
    }

    const ultimoRegistro = listAll[0] || null;

    return res.json({
      success: true,
      documento: cleanDoc,
      link: `${PUBLIC_APP_URL}/miwin/v/${createOpaqueToken(cleanDoc)}`,
      ordenes_abiertas: casesSet.size,
      ultimo_estado: ultimoRegistro ? ultimoRegistro.estado : null,
      total_registros_encontrados: listAll.length
    });
  } catch (error) {
    console.error('Error en /api/followmiwin:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al consultar followmiwin'
    });
  }
});

const routeCoordSchema = z.tuple([
  z.number().min(-90).max(90),
  z.number().min(-180).max(180)
]);

const routeRequestSchema = z.object({
  start: routeCoordSchema,
  end: routeCoordSchema,
  token: z.string().min(4).max(150)
});

// Endpoint para calcular la ruta con tráfico real usando Google Maps API (requiere token de seguimiento activo)
router.post('/route', routeLimiter, async (req, res) => {
  const parsed = routeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Coordenadas o token de seguimiento inválidos' });
  }

  const { start, end, token } = parsed.data;

  // Verificar que el token corresponda a una orden real antes de consumir cuota de Google Routes
  const hasCachedInst = Boolean(apiCache.get(`inst_${token}`));
  if (!hasCachedInst) {
    const meta = await getTokenMetadata(token);
    if (!meta.exists) {
      return res.status(401).json({ success: false, message: 'Token de seguimiento no autorizado para cálculo de ruta' });
    }
  }

  // Clave de caché para evitar consultas redundantes a Google Maps API
  const routeCacheKey = `route_${start[0].toFixed(5)}_${start[1].toFixed(5)}_${end[0].toFixed(5)}_${end[1].toFixed(5)}`;
  const cachedRoute = apiCache.get(routeCacheKey);
  if (cachedRoute) {
    return res.json(cachedRoute);
  }

  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ success: false, message: 'API Key de Google Maps no configurada' });
    }

    // Calculamos el tiempo de salida como "now" para que Google devuelva duration_in_traffic
    const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;
    
    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: start[0],
            longitude: start[1]
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: end[0],
            longitude: end[1]
          }
        }
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
      routeModifiers: {
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: false
      },
      languageCode: "es-419",
      units: "METRIC"
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        // Field mask required by Routes API to specify exactly what we want back
        'X-Goog-FieldMask': 'routes.duration,routes.polyline.encodedPolyline'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(8000)
    });

    const data: any = await response.json();

    if (response.ok && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      
      // La API devuelve string "123s", lo parseamos a int
      const durationStr = route.duration || "0s";
      const durationSeconds = parseInt(durationStr.replace('s', ''), 10);
      const polyline = route.polyline.encodedPolyline;

      const resultPayload = { success: true, durationSeconds, polyline };

      // Guardar en caché por 60s
      apiCache.set(routeCacheKey, resultPayload, ROUTE_CACHE_TTL_MS);

      res.json(resultPayload);
    } else {
      res.status(400).json({ success: false, message: data.error?.message || 'Error en Google Routes API' });
    }
  } catch (error: any) {
    console.error('Error calculando ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno calculando ruta' });
  }
});


const guestDocCheckSchema = z.object({
  tipoDocumento: z.enum(['DNI', 'CE', 'RUC']).default('DNI'),
  documento: z.string().min(5).max(20)
});

const guestValidateSchema = guestDocCheckSchema.extend({
  pin: z.string().regex(/^\d{4}$/, 'El código debe tener 4 dígitos')
});

function isValidGuestDocFormat(tipoDocumento: 'DNI' | 'CE' | 'RUC', cleanDoc: string): boolean {
  if (tipoDocumento === 'DNI') return /^\d{8}$/.test(cleanDoc);
  if (tipoDocumento === 'RUC') return /^\d{11}$/.test(cleanDoc);
  return cleanDoc.length >= 9 && cleanDoc.length <= 12;
}

function getLimaTodayBounds(): { todayStart: string; tomorrowStart: string } {
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const [y, m, d] = todayStr.split('-').map(Number);
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
  const tomorrowStr = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDay.getUTCDate()).padStart(2, '0')}`;

  return {
    todayStart: `${todayStr} 00:00:00`,
    tomorrowStart: `${tomorrowStr} 00:00:00`
  };
}

async function findTodayInstallationsByDocument(tipoDocumento: 'DNI' | 'CE' | 'RUC', cleanDoc: string) {
  const { todayStart, tomorrowStart } = getLimaTodayBounds();
  const unpaddedDoc = cleanDoc.replace(/^0+/, '') || cleanDoc;
  const padded8Doc = tipoDocumento === 'DNI' ? cleanDoc.padStart(8, '0') : cleanDoc;

  const querySQL = `
    SELECT
      w.OrdenId AS idoperacion,
      w.Estado,
      w.token,
      w.Pin_token AS pin_token,
      w.TeleMovilNume AS telefono,
      w.CodiSegui AS codisegui,
      w.CodiSeguiClien AS codiseguiclien,
      w.Producto AS producto,
      w.TipoTraba AS tipo_trabajo,
      ts.Tipo AS tipo_servicio
    FROM VW_WinORdeTraba w
    LEFT JOIN tiposervicio ts ON UPPER(TRIM(w.Producto)) = UPPER(TRIM(ts.Servicio))
    WHERE w.\`F.Visita\` >= ? AND w.\`F.Visita\` < ?
      AND (
        TRIM(REPLACE(w.\`Número Documento\`, '*', '')) IN (?, ?, ?)
        OR TRIM(w.\`Número Documento\`) IN (?, ?, ?)
      )
    ORDER BY w.\`F.Soli\` DESC, w.OrdenId DESC
  `;

  const queryParams = [
    todayStart,
    tomorrowStart,
    cleanDoc,
    unpaddedDoc,
    padded8Doc,
    cleanDoc,
    unpaddedDoc,
    padded8Doc
  ];

  let [rows]: any = await pool.query(querySQL, queryParams);
  let list = rows as any[];

  if (list.length === 0) {
    const [testRows]: any = await pool.query(
      querySQL.replace('VW_WinORdeTraba', 'Testmantra'),
      queryParams
    );
    list = testRows as any[];
  }

  return list.filter((op: any) => {
    const { isTicket, isPostventa } = classifyOrderType(op);
    return !isTicket && !isPostventa && Boolean(op.token);
  });
}

// Endpoint Invitado: Verificación inmediata en tiempo real si el documento tiene instalación hoy
router.post('/invitado/verificar-documento', guestValidateLimiter, async (req, res) => {
  const parsed = guestDocCheckSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      exists: false,
      code: 'DOCUMENT_NOT_FOUND',
      message: 'El número de documento ingresado no es válido.'
    });
  }

  const { tipoDocumento } = parsed.data;
  const cleanDoc = parsed.data.documento.trim().replace(/[^0-9a-zA-Z]/g, '').toUpperCase();

  if (!isValidGuestDocFormat(tipoDocumento, cleanDoc)) {
    return res.status(400).json({
      success: false,
      exists: false,
      code: 'DOCUMENT_NOT_FOUND',
      message: 'El número de documento ingresado no es válido.'
    });
  }

  const cacheKey = `guest_doc_exists_${tipoDocumento}_${cleanDoc}`;
  const cachedDoc = apiCache.get(cacheKey) as
    | boolean
    | { exists?: boolean; telefonoMasked?: string | null }
    | undefined;

  if (cachedDoc !== undefined) {
    const cachedExists =
      typeof cachedDoc === 'boolean' ? cachedDoc : Boolean(cachedDoc?.exists);
    const cachedPhoneMasked =
      typeof cachedDoc === 'object' && cachedDoc !== null
        ? (cachedDoc.telefonoMasked ?? null)
        : null;

    if (!cachedExists) {
      return res.status(404).json({
        success: false,
        exists: false,
        telefonoMasked: null,
        code: 'DOCUMENT_NOT_FOUND',
        message: 'El número de documento ingresado no es válido.'
      });
    }
    return res.json({ success: true, exists: true, telefonoMasked: cachedPhoneMasked });
  }

  try {
    const instalacionesHoy = await findTodayInstallationsByDocument(tipoDocumento, cleanDoc);
    const exists = instalacionesHoy.length > 0;

    const rawPhone = String(instalacionesHoy[0]?.telefono || '').replace(/\D/g, '');
    const last9 = rawPhone.length >= 9 ? rawPhone.slice(-9) : rawPhone;
    const telefonoMasked =
      last9.length === 9
        ? `+51 ${last9[0]}•• ••• ${last9.slice(-3)}`
        : null;

    apiCache.set(cacheKey, { exists, telefonoMasked }, 15_000);

    if (!exists) {
      return res.status(404).json({
        success: false,
        exists: false,
        telefonoMasked: null,
        code: 'DOCUMENT_NOT_FOUND',
        message: 'El número de documento ingresado no es válido.'
      });
    }

    return res.json({ success: true, exists: true, telefonoMasked });
  } catch (error) {
    console.error('Error en /api/invitado/verificar-documento:', error);
    return res.status(500).json({
      success: false,
      exists: false,
      message: 'Error interno al verificar el documento'
    });
  }
});

// Endpoint Invitado: Valida documento + PIN estrictamente para INSTALACIONES programadas hoy (F.Visita)
router.post('/invitado/validar', guestValidateLimiter, async (req, res) => {
  const parsed = guestValidateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: 'BOTH_INVALID',
      message: 'Verifica tu número de documento y código de seguimiento.'
    });
  }

  const { tipoDocumento, pin } = parsed.data;
  const cleanDoc = parsed.data.documento.trim().replace(/[^0-9a-zA-Z]/g, '').toUpperCase();

  if (!isValidGuestDocFormat(tipoDocumento, cleanDoc)) {
    return res.status(400).json({
      success: false,
      code: 'DOCUMENT_NOT_FOUND',
      message: 'El número de documento ingresado no es válido.'
    });
  }

  const clientIp = getClientIp(req);
  const attemptKey = `guest_fail_${clientIp}_${cleanDoc}`;
  const currentFailures = guestPinAttemptsCache.get(attemptKey) || 0;
  if (currentFailures >= MAX_GUEST_PIN_ATTEMPTS) {
    return res.status(429).json({
      success: false,
      code: 'PIN_LOCKED',
      message: 'Demasiados intentos fallidos. Por seguridad, intenta nuevamente en 15 minutos.'
    });
  }

  try {
    const instalacionesHoy = await findTodayInstallationsByDocument(tipoDocumento, cleanDoc);

    // 1. Verificar si el documento tiene una instalación programada hoy
    if (instalacionesHoy.length === 0) {
      return res.status(404).json({
        success: false,
        code: 'DOCUMENT_NOT_FOUND',
        message: 'El número de documento ingresado no es válido.'
      });
    }

    // 2. Validar coincidencia exacta del PIN contra Pin_token
    const matched = instalacionesHoy.find((op: any) => {
      const expectedPin = op.pin_token ? String(op.pin_token).trim() : '';
      return expectedPin.length === 4 && safeTimingEqual(pin, expectedPin);
    });

    if (!matched) {
      guestPinAttemptsCache.set(attemptKey, currentFailures + 1, GUEST_LOCKOUT_TTL_MS);
      return res.status(401).json({
        success: false,
        code: 'INVALID_PIN',
        message: 'El código de seguimiento ingresado no es válido.'
      });
    }

    guestPinAttemptsCache.delete(attemptKey);

    return res.json({
      success: true,
      token: matched.token,
      idoperacion: matched.idoperacion
    });
  } catch (error) {
    console.error('Error en /api/invitado/validar:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al validar los datos'
    });
  }
});

export default router;
