import { Router } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import pool from '../db.ts';
import { decodeOpaqueToken, isOpaqueTokenExpired } from '../opaqueToken.js';
import { replicateChange } from '../replicationService.ts';
import followMiwinRoutes from './followMiwinRoutes.ts';
import routeProxyRoutes from './routeProxyRoutes.ts';
import {
  isOrderExpired,
  mapEstadoToStatusFront,
  parseCoordinates,
  isFotoAprobadaFlag,
  parseValidImage,
  maskDni,
  classifyOrderType,
  buildMiWinVisitasPayload
} from '../shared/orderHelpers.ts';

const router = Router();

// Micro-caché en memoria de alto rendimiento para mitigar carga masiva en DB y Google APIs
const apiCache = new Map<string, { data: any, expiresAt: number }>();
const INST_CACHE_TTL_MS = 8000;

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of apiCache.entries()) {
    if (value.expiresAt < now) {
      apiCache.delete(key);
    }
  }
}, 60000);

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

// Endpoint para consultar disponibilidad de cupos en tiempo real
router.get('/cupos/:token', readLimiter, async (req, res) => {
  const { token } = req.params;
  try {
    const response = await fetch(`${CAPA_INTERMEDIA_URL}/api/v1/terceros/cupos/${token}`, {
      headers: { 'Authorization': `Bearer ${SECRET_API_KEY}` }
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
      })
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
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || null;
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
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios o son inválidos', errors: parseAppResult.error.format() });
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

// Caché en memoria para metadatos de token (CodiSegui, Zona, Producto)
const tokenMetaCache = new Map<string, { codisegui: string | null, zona: string | null, producto: string | null, expiresAt: number }>();

async function getTokenMetadata(token: string) {
  const cached = tokenMetaCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }
  try {
    // 1. Buscar en VW_WinORdeTraba (Producción)
    let [rows]: any = await pool.query(
      'SELECT CodiSegui, Zona, Producto FROM VW_WinORdeTraba WHERE token = ? LIMIT 1',
      [token]
    );

    // 2. Fallback en Testmantra (QA / Pruebas)
    if (!rows || rows.length === 0) {
      [rows] = await pool.query(
        'SELECT CodiSegui, Zona, Producto FROM Testmantra WHERE token = ? LIMIT 1',
        [token]
      );
    }

    if (rows && rows.length > 0) {
      const meta = {
        codisegui: rows[0].CodiSegui || null,
        zona: rows[0].Zona || null,
        producto: rows[0].Producto || null,
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutos
      };
      tokenMetaCache.set(token, meta);
      return meta;
    }
  } catch (err) {
    console.error('Error obteniendo metadata de token para logs:', err);
  }
  return { codisegui: null, zona: null, producto: null, expiresAt: Date.now() + 60000 };
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
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const ip_address = Array.isArray(ip) 
    ? ip[0] 
    : (typeof ip === 'string' ? ip.split(',')[0].trim() : '');

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
  const { token } = req.params;

  // 1. Revisar si la respuesta ya está en micro-caché (absorbe polling masivo concurrente)
  const cached = apiCache.get(`inst_${token}`);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.data);
  }

  try {
    // 1. Ejecutamos las verificaciones locales (Reprogramación y Encuesta) en paralelo con Promise.all
    const [reprogResult, encuestaResult, capaResponse] = await Promise.allSettled([
      pool.query('SELECT id FROM REPROGRAMACIONES WHERE token = ? LIMIT 1', [token]),
      pool.query('SELECT id FROM Encuesta_app WHERE token = ? UNION SELECT id FROM ENCUESTAS WHERE token = ? LIMIT 1', [token, token]),
      fetch(`${CAPA_INTERMEDIA_URL}/api/v1/terceros/instalaciones/${token}`, {
        headers: { 'Authorization': `Bearer ${SECRET_API_KEY}` }
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
          pin_token: op.pin_token || null,
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
      // Si la consulta inicial por token arrojó false, pero la orden tiene token_inicio distinto o caso vinculado,
      // verificar si alguna orden de la misma cadena ya fue reprogramada en BD
      if (!reprogramadaBD) {
        try {
          const alternateTokens = [data.data.token_inicio, token].filter(Boolean);
          const [altReprog]: any = await pool.query(
            `SELECT id FROM REPROGRAMACIONES WHERE token IN (?) LIMIT 1`,
            [alternateTokens]
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

      // Enriquecer metadatos si vinieron de la capa intermedia
      if (!data.data.tipo_trabajo || !data.data.motivo_postventa) {
        try {
          const [omRows]: any = await pool.query(
            `SELECT w.TipoTraba, w.Producto, ts.Tipo as tipo_servicio
             FROM VW_WinORdeTraba w
             LEFT JOIN tiposervicio ts ON UPPER(TRIM(w.Producto)) = UPPER(TRIM(ts.Servicio))
             WHERE w.token = ? LIMIT 1`,
            [token]
          );
          if (omRows && omRows.length > 0) {
            const om = omRows[0];
            const tsCalc = (om.tipo_servicio || '').toUpperCase().trim();
            const prodUpper = (om.Producto || '').toUpperCase().trim();
            const isPostventa = tsCalc === 'POSTVENTA' || prodUpper.includes('POSTVENTA');

            data.data.tipo_trabajo = om.TipoTraba || null;
            data.data.tipo_servicio = isPostventa ? 'POSTVENTA' : (tsCalc || data.data.tipo_servicio);
            data.data.motivo_postventa = om.TipoTraba || null;
            data.data.producto = om.Producto || null;
            if (isPostventa) {
              data.data.tipo = 'postventa';
            }
          }
        } catch (e) {
          console.error('Error enriqueciendo orden con metadatos:', e);
        }
      }
    }

    // Guardar en micro-caché (TTL: 3.5s)
    apiCache.set(`inst_${token}`, {
      data,
      expiresAt: Date.now() + INST_CACHE_TTL_MS
    });

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
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.data);
  }

  try {
    let data: any = null;

    try {
      const capaResponse = await fetch(`${CAPA_INTERMEDIA_URL}/api/v1/terceros/cliente/visitas/v/${encodeURIComponent(rawToken)}`, {
        headers: { 'Authorization': `Bearer ${SECRET_API_KEY}` }
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

    apiCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + INST_CACHE_TTL_MS
    });

    res.json(data);
  } catch (error) {
    console.error('Error en /api/cliente/visitas:', error);
    res.status(500).json({ success: false, message: 'Error interno consultando visitas' });
  }
});

// Sub-routers modularizados por dominio (FollowMiWIN y Google Routes)
router.use(followMiwinRoutes);
router.use(routeProxyRoutes);

export default router;
