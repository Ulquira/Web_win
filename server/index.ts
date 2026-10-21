import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import pool from './db.ts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { replicateChange } from './replicationService.ts';
import replicationRouter from './replicationReceiver.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3001', 10);

// Micro-caché en memoria de alto rendimiento para mitigar carga masiva en DB y Google APIs
const apiCache = new Map<string, { data: any, expiresAt: number }>();
const INST_CACHE_TTL_MS = 8000; // 8 segundos para absorber peticiones recurrentes sin sobrecargar BD
const ROUTE_CACHE_TTL_MS = 60000; // 60 segundos para rutas idénticas

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of apiCache.entries()) {
    if (value.expiresAt < now) {
      apiCache.delete(key);
    }
  }
}, 60000);

// URLs para los servicios internos (Ajustado para entorno de producción si es necesario)
const CAPA_INTERMEDIA_URL = process.env.CAPA_INTERMEDIA_URL || 'http://localhost:4001';
const SECRET_API_KEY = process.env.SECRET_API_KEY || "LLAVE_SECRETA_DEL_TERCERO_123";

// Seguridad y Confianza (Cloud Run)
app.set('trust proxy', 1);
app.use(helmet());

app.use(cors({ 
  origin: process.env.FRONTEND_URL || '*', 
  methods: ['GET', 'POST']
}));
app.use(express.json());

// Registrar rutas de replicación en tiempo real (puede actuar como receptor)
app.use(replicationRouter);

// Endpoint para guardar reprogramaciones en BD
const reprogramarSchema = z.object({
  token: z.string().min(5).max(150),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  turno: z.string().min(1).max(100),
  motivo: z.string().max(500).optional().default(''),
  motivoSeleccionado: z.string().max(200).optional().default('')
});

app.post('/api/reprogramar', async (req, res) => {
  const parseResult = reprogramarSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ success: false, message: 'Datos inválidos', errors: parseResult.error.format() });
  }

  const { token, fecha, turno, motivo, motivoSeleccionado } = parseResult.data;
  const motivoDetalle = [motivoSeleccionado, motivo].filter(Boolean).join(' - ') || 'Sin motivo';

  try {
    const query = `
      INSERT INTO REPROGRAMACIONES (token, fecha_solicitada, turno, motivo)
      VALUES (?, ?, ?, ?)
    `;
    await pool.query(query, [token, fecha, turno, motivoDetalle]);

    // Invalidar caché inmediato para que el cliente vea el cambio sin espera
    apiCache.delete(`inst_${token}`);

    // Replicar cambio a la base de datos secundaria en tiempo real
    replicateChange('REPROGRAMACIONES', 'INSERT', {
      token,
      fecha_solicitada: fecha,
      turno,
      motivo: motivoDetalle
    });

    res.json({ success: true, message: 'Reprogramación guardada con éxito' });
  } catch (error) {
    console.error('Error guardando en BD:', error);
    res.status(500).json({ success: false, message: 'Error interno guardando la solicitud' });
  }
});

// Endpoint para guardar Encuestas en BD
const encuestaSchema = z.object({
  token: z.string().min(5).max(150),
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

app.post('/api/encuesta', async (req, res) => {
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

    // Replicar cambio a la base de datos secundaria en tiempo real
    replicateChange('ENCUESTAS', 'INSERT', {
      token,
      instalacion_concretada,
      tecnico_trato,
      tecnico_puntualidad,
      tecnico_claridad,
      tecnico_orden,
      tecnico_efectividad,
      satisfaccion_general,
      satisfaccion_comentario,
      facilidad_gestion,
      facilidad_motivo
    });

    res.json({ success: true, message: 'Encuesta guardada con éxito' });
  } catch (error) {
    console.error('Error guardando encuesta en BD:', error);
    res.status(500).json({ success: false, message: 'Error interno guardando la encuesta' });
  }
});

// Endpoint para verificar si un token ya llenó la encuesta en BD
app.get('/api/encuesta/verificar/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const [rows]: any = await pool.query('SELECT id FROM ENCUESTAS WHERE token = ? LIMIT 1', [token]);
    const completada = rows.length > 0;

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

app.post('/api/log', async (req, res) => {
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
app.get('/api/instalaciones/:token', async (req, res) => {
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
      pool.query('SELECT id FROM ENCUESTAS WHERE token = ? LIMIT 1', [token]),
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
      const tipoServicioUpper = (op.tipo_servicio || '').toUpperCase().trim();
      const productoUpper = (op.producto || '').toUpperCase().trim();
      const isPostventa = tipoServicioUpper === 'POSTVENTA' || productoUpper.includes('POSTVENTA');
      const isTicket = tipoServicioUpper === 'AVERIAS' || productoUpper.includes('AVERIA') || productoUpper === 'MOTOWIN';

      let statusFront = 'programada';
      const estadoDB = (op.Estado || '').toUpperCase().trim();
      if (estadoDB === 'PENDIENTE') statusFront = 'programada';
      else if (estadoDB === 'AGENDADA' || estadoDB === 'PROGRAMADO') statusFront = 'asignado';
      else if (estadoDB === 'EN CAMINO') statusFront = 'en_camino';
      else if (estadoDB === 'INICIADA' || estadoDB === 'EN PROCESO') statusFront = 'en_proceso';
      else if (estadoDB === 'FINALIZADA' || estadoDB === 'FINALIZADO') statusFront = 'finalizada';
      else if (['ANULADA', 'REGESTION', 'CANCELADA', 'REVISIÓN', 'REVISION', 'AUSENTE', 'CANCELADO', 'DULPLICADO', 'INASISTENCIA', 'PEXT', 'REPROGRAMA'].includes(estadoDB)) statusFront = 'cerrada';

      let coordsCliente = null;
      let coordsTecnico = null;
      try {
        if (op.coordenadas_direccion) {
          const str = op.coordenadas_direccion.replace(/\s/g, '');
          const match = str.match(/(-?\d+\.\d+)(-?\d+\.\d+)/);
          if (match) coordsCliente = [parseFloat(match[1]), parseFloat(match[2])];
          else {
            const parts = str.split(',');
            if (parts.length === 2) coordsCliente = [parseFloat(parts[0]), parseFloat(parts[1])];
          }
        }
        if (op.Ubi_TEC) {
          const str = op.Ubi_TEC.replace(/\s/g, '');
          const match = str.match(/(-?\d+\.\d+)(-?\d+\.\d+)/);
          if (match) coordsTecnico = [parseFloat(match[1]), parseFloat(match[2])];
          else {
            const parts = str.split(',');
            if (parts.length === 2) coordsTecnico = [parseFloat(parts[0]), parseFloat(parts[1])];
          }
        }
      } catch(e) {}

      let fotoTecnico: string | null = null;
      const isFotoAprobada = Boolean(
        op.foto_aprobada === 1 || 
        op.foto_aprobada === '1' || 
        op.foto_aprobada === true || 
        String(op.foto_aprobada || '').trim().toLowerCase() === 'yes' ||
        String(op.foto_aprobada || '').trim().toLowerCase() === 'true'
      );

      const parseValidImage = (imgCandidate?: string | null): string | null => {
        if (!imgCandidate) return null;
        const clean = String(imgCandidate).trim();
        if (clean.startsWith('data:image/')) return clean;
        if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
        if (clean.startsWith('/9j/') || clean.startsWith('iVBORw0KGgo')) return `data:image/jpeg;base64,${clean}`;
        return null;
      };

      if (isFotoAprobada) {
        fotoTecnico = parseValidImage(op.foto_mejorada) || parseValidImage(op.foto_original) || null;
      }

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
            dni: op.dni_tecnico ? '****' + String(op.dni_tecnico).slice(4) : null,
            foto: fotoTecnico,
            cuadrilla: op.Cuadrilla,
            telefono: op.telefono || 'Central'
          } : undefined
        }
      };
    }

    if (data && data.data) {
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
    res.status(500).json({ success: false, message: 'Error interno del servidor', error });
  }
});

// Endpoint MiWIN: Consulta de atenciones por DNI con fallback directo a base de datos
app.get('/api/cliente/visitas/:dni', async (req, res) => {
  const { dni } = req.params;
  const cleanDni = String(dni || '').trim();

  if (!cleanDni || cleanDni.length < 5) {
    return res.status(400).json({ success: false, message: 'DNI inválido' });
  }

  const cacheKey = `cliente_visitas_${cleanDni}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.data);
  }

  try {
    let data: any = null;

    try {
      const capaResponse = await fetch(`${CAPA_INTERMEDIA_URL}/api/v1/terceros/cliente/visitas/${cleanDni}`, {
        headers: { 'Authorization': `Bearer ${SECRET_API_KEY}` }
      });
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

      if (list.length === 0) {
        data = { success: true, count: 0, cliente_nombre: null, visitas: [] };
      } else {
        const casesMap = new Map<string, any>();
        for (const item of list) {
          const caseKey = item.codisegui || item.codiseguiclien || `ord_${item.idoperacion}`;
          if (!casesMap.has(caseKey)) {
            casesMap.set(caseKey, item);
          }
        }

        const uniqueCases = Array.from(casesMap.values());
        const clienteNombre = list[0].nom_cliente || 'Cliente';

        const visitas = uniqueCases.map((op: any) => {
          const tipoServicioUpper = (op.tipo_servicio || '').toUpperCase().trim();
          const productoUpper = (op.producto || '').toUpperCase().trim();
          const isTicket = tipoServicioUpper === 'AVERIAS' || productoUpper.includes('AVERIA') || productoUpper === 'MOTOWIN';

          let statusFront = 'programada';
          const estadoDB = (op.Estado || '').toUpperCase().trim();
          if (estadoDB === 'PENDIENTE') statusFront = 'programada';
          else if (estadoDB === 'AGENDADA' || estadoDB === 'PROGRAMADO') statusFront = 'asignado';
          else if (estadoDB === 'EN CAMINO') statusFront = 'en_camino';
          else if (estadoDB === 'INICIADA' || estadoDB === 'EN PROCESO') statusFront = 'en_proceso';
          else if (estadoDB === 'FINALIZADA' || estadoDB === 'FINALIZADO') statusFront = 'finalizada';
          else if (['ANULADA', 'REGESTION', 'CANCELADA', 'REVISIÓN', 'REVISION', 'AUSENTE', 'CANCELADO', 'DULPLICADO', 'INASISTENCIA', 'PEXT', 'REPROGRAMA'].includes(estadoDB)) {
            statusFront = 'cerrada';
          }

          let titulo = isTicket ? 'Avería' : 'Instalación';
          if (productoUpper.includes('MOTO')) titulo = 'Avería Motowin';
          else if (productoUpper.includes('PLANTA EXTERNA')) titulo = 'Avería Planta Externa';

          const ticketLabel = op.codisegui ? `Ticket: ${op.codisegui}` : (isTicket ? `Ticket: ${op.idoperacion}` : 'Instalación');

          return {
            idoperacion: op.idoperacion,
            token: op.token,
            pin_token: op.Pin_token || null,
            tipo: isTicket ? 'ticket' : 'instalacion',
            titulo,
            ticketLabel,
            codisegui: op.codisegui || null,
            producto: op.producto || (isTicket ? 'Visita Técnica' : 'Instalación Fibra'),
            campana: op.campana || null,
            direccion: op.direccion || 'Dirección registrada',
            estado: statusFront,
            estado_raw: op.Estado,
            fecha: op.fecha_programacion,
            tramo: op.tramo
          };
        });

        data = {
          success: true,
          count: visitas.length,
          cliente_nombre: clienteNombre,
          visitas
        };
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

  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = typeof forwarded === 'string' 
    ? forwarded.split(',')[0].trim() 
    : (req.socket.remoteAddress || req.ip || '');
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
const FOLLOWMIWIN_API_KEY = process.env.FOLLOWMIWIN_API_KEY || 'M1w1n4pp_7273dba14ceba0d31b716cc5b7a04ec4';

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

  if (token === FOLLOWMIWIN_API_KEY) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Token o API Key inválido para consultar FollowMiWIN.'
  });
};

const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || 'https://enruta.win.pe').replace(/\/+$/, '');

// Endpoint FollowMiWIN: Consulta por documento para integraciones de otras áreas
app.get(
  ['/api/followmiwin/:documento', '/api/followmiwin'],
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
      link: `${PUBLIC_APP_URL}/miwin/${cleanDoc}`,
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

// Endpoint para calcular la ruta con tráfico real usando Google Maps API
app.post('/api/route', async (req, res) => {
  const { start, end } = req.body;

  if (!start || !end) {
    return res.status(400).json({ success: false, message: 'Faltan coordenadas de inicio y fin' });
  }

  // Clave de caché para evitar consultas redundantes a Google Maps API
  const routeCacheKey = `route_${start[0]}_${start[1]}_${end[0]}_${end[1]}`;
  const cachedRoute = apiCache.get(routeCacheKey);
  if (cachedRoute && cachedRoute.expiresAt > Date.now()) {
    return res.json(cachedRoute.data);
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
      body: JSON.stringify(requestBody)
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
      apiCache.set(routeCacheKey, {
        data: resultPayload,
        expiresAt: Date.now() + ROUTE_CACHE_TTL_MS
      });

      res.json(resultPayload);
    } else {
      res.status(400).json({ success: false, message: data.error?.message || 'Error en Google Routes API' });
    }
  } catch (error: any) {
    console.error('Error calculando ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno calculando ruta' });
  }
});

// ==========================================
// ENDPOINTS ADMINISTRACIÓN LOCAL / DASHBOARD
// ==========================================

// Middleware de seguridad: estrictamente local (bloquea peticiones externas si se ejecutara en producción)
const requireLocalAdminOnly = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || '';
  const host = req.get('host') || '';
  const isLocal = 
    ip === '127.0.0.1' || 
    ip === '::1' || 
    ip === '::ffff:127.0.0.1' || 
    host.includes('localhost') || 
    host.includes('127.0.0.1');

  if (!isLocal && process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Acceso restringido: El panel de administración solo está habilitado en entorno local.'
    });
  }
  next();
};

app.use('/api/admin', requireLocalAdminOnly);

// 1. Obtener opciones para filtros (Tipos de Servicio / Trabajos)
app.get('/api/admin/filtros', async (_req, res) => {
  try {
    const [tiposTraba]: any = await pool.query(
      'SELECT DISTINCT TipoTraba FROM vw_winordetraba WHERE TipoTraba IS NOT NULL AND TipoTraba != "" ORDER BY TipoTraba ASC'
    );
    const [productos]: any = await pool.query(
      'SELECT DISTINCT Producto FROM vw_winordetraba WHERE Producto IS NOT NULL AND Producto != "" ORDER BY Producto ASC'
    );
    const [tiposServicio]: any = await pool.query(
      'SELECT DISTINCT Servicio, Tipo FROM tiposervicio ORDER BY Servicio ASC'
    );
    const [tiposClasificados]: any = await pool.query(
      'SELECT DISTINCT Tipo FROM tiposervicio WHERE Tipo IS NOT NULL AND Tipo != "" AND Tipo != "NO" ORDER BY Tipo ASC'
    );

    res.json({
      success: true,
      tiposTraba: tiposTraba.map((r: any) => r.TipoTraba),
      productos: productos.map((r: any) => r.Producto),
      tiposServicio,
      tiposClasificados: tiposClasificados.map((r: any) => r.Tipo)
    });
  } catch (error: any) {
    console.error('Error obteniendo filtros admin:', error);
    res.status(500).json({ success: false, message: 'Error al obtener filtros' });
  }
});

// 2. Consulta de tablas con filtros dinámicos, paginación y ordenamiento
app.get('/api/admin/data', async (req, res) => {
  try {
    const tabla = String(req.query.tabla || 'principal').toLowerCase();
    const search = String(req.query.search || '').trim();
    const fechaInicio = String(req.query.fechaInicio || '').trim();
    const fechaFin = String(req.query.fechaFin || '').trim();
    const tipoServicio = String(req.query.tipoServicio || '').trim();
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(200, Math.max(10, parseInt(String(req.query.limit || '50'), 10)));
    const offset = (page - 1) * limit;

    let countQuery = '';
    let selectQuery = '';
    const params: any[] = [];
    const countParams: any[] = [];

    if (tabla === 'encuestas') {
      let whereClauses: string[] = ['1=1'];

      if (fechaInicio) {
        whereClauses.push('e.fecha_registro >= ?');
        params.push(`${fechaInicio} 00:00:00`);
        countParams.push(`${fechaInicio} 00:00:00`);
      }
      if (fechaFin) {
        whereClauses.push('e.fecha_registro <= ?');
        params.push(`${fechaFin} 23:59:59`);
        countParams.push(`${fechaFin} 23:59:59`);
      }
      if (search) {
        whereClauses.push('(e.token LIKE ? OR e.satisfaccion_comentario LIKE ? OR e.facilidad_motivo LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s);
        countParams.push(s, s, s);
      }

      const whereSql = whereClauses.join(' AND ');
      countQuery = `SELECT COUNT(*) as total FROM encuestas e WHERE ${whereSql}`;
      selectQuery = `
        SELECT 
          e.id,
          e.token,
          e.instalacion_concretada,
          e.tecnico_trato,
          e.tecnico_puntualidad,
          e.tecnico_claridad,
          e.tecnico_orden,
          e.tecnico_efectividad,
          e.satisfaccion_general,
          e.satisfaccion_comentario,
          e.facilidad_gestion,
          e.facilidad_motivo,
          e.fecha_registro
        FROM encuestas e
        WHERE ${whereSql}
        ORDER BY e.fecha_registro DESC
        LIMIT ? OFFSET ?
      `;
      params.push(limit, offset);
    } else if (tabla === 'reprogramaciones') {
      let whereClauses: string[] = ['1=1'];

      if (fechaInicio) {
        whereClauses.push('(r.fecha_registro >= ? OR r.fecha_solicitada >= ?)');
        params.push(`${fechaInicio} 00:00:00`, `${fechaInicio} 00:00:00`);
        countParams.push(`${fechaInicio} 00:00:00`, `${fechaInicio} 00:00:00`);
      }
      if (fechaFin) {
        whereClauses.push('(r.fecha_registro <= ? OR r.fecha_solicitada <= ?)');
        params.push(`${fechaFin} 23:59:59`, `${fechaFin} 23:59:59`);
        countParams.push(`${fechaFin} 23:59:59`, `${fechaFin} 23:59:59`);
      }
      if (search) {
        whereClauses.push('(r.token LIKE ? OR r.motivo LIKE ? OR r.turno LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s);
        countParams.push(s, s, s);
      }

      const whereSql = whereClauses.join(' AND ');
      countQuery = `SELECT COUNT(*) as total FROM reprogramaciones r WHERE ${whereSql}`;
      selectQuery = `
        SELECT 
          r.id,
          r.token,
          r.fecha_solicitada,
          r.turno,
          r.motivo,
          r.fecha_registro
        FROM reprogramaciones r
        WHERE ${whereSql}
        ORDER BY r.fecha_registro DESC
        LIMIT ? OFFSET ?
      `;
      params.push(limit, offset);
    } else {
      // Tabla principal: vw_winordetraba cruzada con tiposervicio
      let whereClauses: string[] = ['1=1'];

      if (fechaInicio) {
        whereClauses.push('w.`F.Visita` >= ?');
        params.push(`${fechaInicio} 00:00:00`);
        countParams.push(`${fechaInicio} 00:00:00`);
      }
      if (fechaFin) {
        whereClauses.push('w.`F.Visita` <= ?');
        params.push(`${fechaFin} 23:59:59`);
        countParams.push(`${fechaFin} 23:59:59`);
      }
      if (tipoServicio) {
        whereClauses.push('COALESCE(ts_prod.Tipo, ts_traba.Tipo, w.TipoTraba) = ?');
        params.push(tipoServicio);
        countParams.push(tipoServicio);
      }
      if (search) {
        whereClauses.push('(w.OrdenId LIKE ? OR w.Cliente LIKE ? OR w.`Número Documento` LIKE ? OR w.token LIKE ? OR w.CodiSegui LIKE ? OR w.Direccion LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s, s, s, s);
        countParams.push(s, s, s, s, s, s);
      }

      const whereSql = whereClauses.join(' AND ');
      countQuery = `
        SELECT COUNT(*) as total 
        FROM vw_winordetraba w
        LEFT JOIN tiposervicio ts_prod ON w.Producto = ts_prod.Servicio
        LEFT JOIN tiposervicio ts_traba ON w.TipoTraba = ts_traba.Servicio
        WHERE ${whereSql}
      `;
      selectQuery = `
        SELECT 
          w.*,
          COALESCE(ts_prod.Tipo, ts_traba.Tipo, w.TipoTraba) as TipoServicioCalculado
        FROM vw_winordetraba w
        LEFT JOIN tiposervicio ts_prod ON w.Producto = ts_prod.Servicio
        LEFT JOIN tiposervicio ts_traba ON w.TipoTraba = ts_traba.Servicio
        WHERE ${whereSql}
        ORDER BY w.\`F.Visita\` DESC
        LIMIT ? OFFSET ?
      `;
      params.push(limit, offset);
    }

    const [countRows]: any = await pool.query(countQuery, countParams);
    const total = countRows[0]?.total || 0;

    const [rows]: any = await pool.query(selectQuery, params);

    res.json({
      success: true,
      tabla,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      data: rows
    });
  } catch (error: any) {
    console.error('Error en consulta admin/data:', error);
    res.status(500).json({ success: false, message: 'Error interno consultando datos' });
  }
});

// 3. Exportar datos filtrados en CSV / JSON completo
app.get('/api/admin/export', async (req, res) => {
  try {
    const tabla = String(req.query.tabla || 'principal').toLowerCase();
    const format = String(req.query.format || 'csv').toLowerCase();
    const search = String(req.query.search || '').trim();
    const fechaInicio = String(req.query.fechaInicio || '').trim();
    const fechaFin = String(req.query.fechaFin || '').trim();
    const tipoServicio = String(req.query.tipoServicio || '').trim();

    const maxExportRows = 5000;
    const params: any[] = [];
    let selectQuery = '';

    if (tabla === 'encuestas') {
      let whereClauses: string[] = ['1=1'];
      if (fechaInicio) {
        whereClauses.push('e.fecha_registro >= ?');
        params.push(`${fechaInicio} 00:00:00`);
      }
      if (fechaFin) {
        whereClauses.push('e.fecha_registro <= ?');
        params.push(`${fechaFin} 23:59:59`);
      }
      if (search) {
        whereClauses.push('(e.token LIKE ? OR e.satisfaccion_comentario LIKE ? OR e.facilidad_motivo LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s);
      }
      selectQuery = `
        SELECT 
          e.id,
          e.token,
          e.instalacion_concretada,
          e.tecnico_trato,
          e.tecnico_puntualidad,
          e.tecnico_claridad,
          e.tecnico_orden,
          e.tecnico_efectividad,
          e.satisfaccion_general,
          e.satisfaccion_comentario,
          e.facilidad_gestion,
          e.facilidad_motivo,
          e.fecha_registro
        FROM encuestas e
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY e.fecha_registro DESC
        LIMIT ${maxExportRows}
      `;
    } else if (tabla === 'reprogramaciones') {
      let whereClauses: string[] = ['1=1'];
      if (fechaInicio) {
        whereClauses.push('(r.fecha_registro >= ? OR r.fecha_solicitada >= ?)');
        params.push(`${fechaInicio} 00:00:00`, `${fechaInicio} 00:00:00`);
      }
      if (fechaFin) {
        whereClauses.push('(r.fecha_registro <= ? OR r.fecha_solicitada <= ?)');
        params.push(`${fechaFin} 23:59:59`, `${fechaFin} 23:59:59`);
      }
      if (search) {
        whereClauses.push('(r.token LIKE ? OR r.motivo LIKE ? OR r.turno LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s);
      }
      selectQuery = `
        SELECT 
          r.id,
          r.token,
          r.fecha_solicitada,
          r.turno,
          r.motivo,
          r.fecha_registro
        FROM reprogramaciones r
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY r.fecha_registro DESC
        LIMIT ${maxExportRows}
      `;
    } else {
      let whereClauses: string[] = ['1=1'];
      if (fechaInicio) {
        whereClauses.push('w.`F.Visita` >= ?');
        params.push(`${fechaInicio} 00:00:00`);
      }
      if (fechaFin) {
        whereClauses.push('w.`F.Visita` <= ?');
        params.push(`${fechaFin} 23:59:59`);
      }
      if (tipoServicio) {
        whereClauses.push('COALESCE(ts_prod.Tipo, ts_traba.Tipo, w.TipoTraba) = ?');
        params.push(tipoServicio);
      }
      if (search) {
        whereClauses.push('(w.OrdenId LIKE ? OR w.Cliente LIKE ? OR w.`Número Documento` LIKE ? OR w.token LIKE ? OR w.CodiSegui LIKE ? OR w.Direccion LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s, s, s, s);
      }
      selectQuery = `
        SELECT 
          w.*,
          COALESCE(ts_prod.Tipo, ts_traba.Tipo, w.TipoTraba) as TipoServicioCalculado
        FROM vw_winordetraba w
        LEFT JOIN tiposervicio ts_prod ON w.Producto = ts_prod.Servicio
        LEFT JOIN tiposervicio ts_traba ON w.TipoTraba = ts_traba.Servicio
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY w.\`F.Visita\` DESC
        LIMIT ${maxExportRows}
      `;
    }

    const [rows]: any = await pool.query(selectQuery, params);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${tabla}_${Date.now()}.json"`);
      return res.send(JSON.stringify(rows, null, 2));
    }

    // Formato CSV con BOM UTF-8 para apertura directa en Excel
    if (rows.length === 0) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${tabla}_vacio.csv"`);
      return res.send('\uFEFFSin registros');
    }

    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(';'),
      ...rows.map((row: any) =>
        headers.map(h => {
          let val = row[h];
          if (val instanceof Date) val = val.toISOString();
          if (val === null || val === undefined) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        }).join(';')
      )
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${tabla}_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\uFEFF' + csvLines.join('\r\n'));
  } catch (error: any) {
    console.error('Error exportando datos admin:', error);
    res.status(500).json({ success: false, message: 'Error interno generando exportación' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor API corriendo en http://0.0.0.0:${port}`);
});