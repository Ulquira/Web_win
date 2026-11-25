import { createOpaqueToken, decodeOpaqueToken, isOpaqueTokenExpired } from './opaqueToken.ts';
import express from 'express';
import {
  isOrderExpired,
  mapEstadoToStatusFront,
  parseCoordinates,
  isFotoAprobadaFlag,
  parseValidImage,
  maskDni,
  classifyOrderType,
  buildMiWinVisitasPayload,
  generateSecureFourDigitPin,
  safeTimingEqual,
  shouldExposePinToClient,
  isPrefixedTicketCode
} from '../server/shared/orderHelpers.ts';
import { BoundedTtlCache } from '../server/shared/ttlCache.ts';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import pool from '../server/db.ts'; // Solo esta capa accede a la DB real
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

function sanitizeCsvField(value: unknown): string {
  const str = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  const safe = /^[=+\-@\t]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

const app = express();
const port = parseInt(process.env.PORT || '4001', 10); // Corre en un puerto distinto, oculto del mundo exterior

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || false }));
app.use(express.json({ limit: '256kb' }));

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'capa-intermedia' });
});

// Un token súper secreto que viene de las variables de entorno
const SECRET_API_KEY = process.env.SECRET_API_KEY || "LLAVE_SECRETA_DEL_TERCERO_123";
if (!process.env.SECRET_API_KEY && process.env.NODE_ENV === 'production') {
  console.warn('[SECURITY WARNING] SECRET_API_KEY no definida en variables de entorno de producción; usando fallback inseguro.');
}

// Cache acotado en memoria (LRU + TTL: 4 segundos) para mitigar carga masiva sin riesgo de OOM
const memoryCache = new BoundedTtlCache<any>(5000);
const CACHE_TTL_MS = 4000;

// Control anti fuerza bruta para validación de PIN de reprogramación (máx 5 fallos por 15 min)
const pinAttemptsCache = new BoundedTtlCache<number>(5000);
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_TTL_MS = 15 * 60 * 1000;

// Middleware para verificar que quien llama es el "Tercero" autorizado
const verificarTercero = (req: any, res: any, next: any) => {
  const authHeader = String(req.headers['authorization'] || '');
  const expectedHeader = `Bearer ${SECRET_API_KEY}`;
  if (!authHeader || !safeTimingEqual(authHeader, expectedHeader)) {
    return res.status(401).json({ error: "Acceso denegado. Tercero no autorizado." });
  }
  next();
};

// Endpoint interno: Solo sirve los datos estrictamente necesarios al tercero
app.get('/api/v1/terceros/instalaciones/:token', verificarTercero, async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!token || token.length > 150) {
    return res.status(400).json({ success: false, message: 'Token inválido' });
  }

  // 1. Revisar si la respuesta ya está en caché en memoria
  const cached = memoryCache.get(`inst_${token}`);
  if (cached) {
    return res.json(cached);
  }

  try {
    let sourceTable = 'VW_WinORdeTraba';
    // 1. Consulta principal en Producción (VW_WinORdeTraba)
    let [prodRows] = await pool.query(
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
         w.Producto AS producto,         w.TipoTraba AS tipo_trabajo,         ts.Tipo AS tipo_servicio
       FROM VW_WinORdeTraba w
       LEFT JOIN vw_info_cuadrillas vc ON w.Cuadrilla = vc.Cuadrilla
       LEFT JOIN tiposervicio ts ON UPPER(TRIM(w.Producto)) = UPPER(TRIM(ts.Servicio))
       WHERE w.token = ? 
       ORDER BY w.\`F.Soli\` DESC LIMIT 1`, 
      [token]
    );

    let instalaciones = prodRows as any[];

    if (instalaciones.length === 0 && isPrefixedTicketCode(token)) {
      const [ticketRows] = await pool.query(
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
         WHERE w.CodiSegui = ?
         ORDER BY w.\`F.Soli\` DESC LIMIT 1`,
        [token]
      );
      instalaciones = ticketRows as any[];
    }
    
    // 2. Fallback automático para QA / Pruebas (Testmantra)
    if (instalaciones.length === 0) {
      sourceTable = 'Testmantra';
      const [testRows] = await pool.query(
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
           w.Producto AS producto,           w.TipoTraba AS tipo_trabajo,           ts.Tipo AS tipo_servicio
         FROM Testmantra w
         LEFT JOIN vw_info_cuadrillas vc ON w.Cuadrilla = vc.Cuadrilla
         LEFT JOIN tiposervicio ts ON UPPER(TRIM(w.Producto)) = UPPER(TRIM(ts.Servicio))
         WHERE w.token = ? 
         ORDER BY w.\`F.Soli\` DESC LIMIT 1`, 
        [token]
      );
      instalaciones = testRows as any[];
    }
    
    if (instalaciones.length === 0) {
      return res.status(404).json({ success: false, message: 'Operación no encontrada' });
    }

    let op = instalaciones[0];

    // Soporte para Regestión / Reasignación de técnico:
    // Si la orden original está vinculada a un código de caso (CodiSegui o CodiSeguiClien),
    // consultar automáticamente la fila más reciente y activa de ese mismo caso en la tabla correspondiente
    if (op.codisegui || op.codiseguiclien) {
      const filterClause = op.codisegui 
        ? 'w.CodiSegui = ?' 
        : 'w.CodiSeguiClien = ?';
      const filterVal = op.codisegui || op.codiseguiclien;

      const [latestRows] = await pool.query(
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
         FROM ${sourceTable} w 
         LEFT JOIN vw_info_cuadrillas vc ON w.Cuadrilla = vc.Cuadrilla
         LEFT JOIN tiposervicio ts ON UPPER(TRIM(w.Producto)) = UPPER(TRIM(ts.Servicio)) 
         WHERE ${filterClause}
         ORDER BY w.\`F.Soli\` DESC, w.OrdenId DESC LIMIT 1`,
        [filterVal]
      );
      const latestList = latestRows as any[];
      if (latestList.length > 0) {
        op = latestList[0];
      }
    }

    // Expiración estricta de 72 horas desde F.Soli sin importar el estado
    if (isOrderExpired(op.segundos_desde_soli)) {
      return res.status(410).json({ success: false, expired: true, message: 'Este enlace de seguimiento ha expirado.' });
    }
    const { isPostventa, isTicket } = classifyOrderType(op);
    const statusFront = mapEstadoToStatusFront(op.Estado);
    const coordsCliente = parseCoordinates(op.coordenadas_direccion);
    const coordsTecnico = parseCoordinates(op.Ubi_TEC);

    // Generar Token de Inicio si no lo tiene (para cualquier estado, ya que se exige al reprogramar)
    let tokenInicio = op.Token_inicio;
    if (!tokenInicio) {
      tokenInicio = generateSecureFourDigitPin();
      try {
        if (sourceTable === 'Testmantra') {
          await pool.query('UPDATE Testmantra SET token = ? WHERE OrdenId = ?', [tokenInicio, op.idoperacion]);
        }
      } catch (err) {
        console.error('Error al guardar el token de inicio:', err);
      }
    }

    // Generar y persistir Pin_token (PIN de 4 dígitos CSPRNG de 1000 a 9999) si aún no existe
    let pinToken = op.pin_token ? String(op.pin_token).trim() : null;
    if (!pinToken || pinToken.length !== 4) {
      pinToken = generateSecureFourDigitPin();
      try {
        // Si la orden tiene caso vinculado (CodiSegui o CodiSeguiClien), propagamos el mismo PIN a todas las órdenes del caso (reasignación)
        if (op.codisegui || op.codiseguiclien) {
          const filterCol = op.codisegui ? 'CodiSegui' : 'CodiSeguiClien';
          const filterVal = op.codisegui || op.codiseguiclien;
          await pool.query(
            `UPDATE ${sourceTable} SET Pin_token = ? WHERE ${filterCol} = ? AND (Pin_token IS NULL OR Pin_token = '')`,
            [pinToken, filterVal]
          );
        } else {
          await pool.query(
            `UPDATE ${sourceTable} SET Pin_token = ? WHERE OrdenId = ?`,
            [pinToken, op.idoperacion]
          );
        }
      } catch (err) {
        console.error('Error al guardar Pin_token:', err);
      }
    }

    const responseData: any = {
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
      token_inicio: tokenInicio || null,
      pin_token: shouldExposePinToClient(statusFront) ? (pinToken || null) : null,
      tipo: isPostventa ? 'postventa' : (isTicket ? 'ticket' : 'instalacion'),
      tipo_servicio: isPostventa ? 'POSTVENTA' : (op.tipo_servicio || (isTicket ? 'AVERIAS' : 'INSTALACION')),
      tipo_trabajo: op.tipo_trabajo || null,
      motivo_postventa: op.tipo_trabajo || null,
      producto: op.producto || null
    };

    const fotoTecnico = isFotoAprobadaFlag(op.foto_aprobada)
      ? (parseValidImage(op.foto_mejorada) || parseValidImage(op.foto_original) || null)
      : null;

    if (op.Cuadrilla || op.Cuadrilla_nombre || op.nombre_tecnico_completo) {
      responseData.tecnico = {
        nombre: op.nombre_tecnico_completo || op.Cuadrilla_nombre || 'Técnico Asignado',
        dni: maskDni(op.dni_tecnico),
        foto: fotoTecnico,
        cuadrilla: op.Cuadrilla,
        telefono: op.telefono || 'Central'
      };
    }

    const resultPayload = {
      success: true,
      data: responseData
    };

    // Guardar en micro-caché en memoria para mitigar picos de carga concurrentes
    memoryCache.set(`inst_${token}`, resultPayload, CACHE_TTL_MS);

    // Le devolvemos al tercero solo la info limpia que necesita
    res.json(resultPayload);

  } catch (error) {
    console.error('Error DB en Capa Intermedia:', error);
    res.status(500).json({ success: false, message: 'Error en la red corporativa' });
  }
});

// Endpoint exclusivo MiWIN: Consulta multi-visitas estrictamente por token opaco (vigencia 72h)
app.get('/api/v1/terceros/cliente/visitas/v/:token', verificarTercero, async (req, res) => {
  const rawToken = String(req.params.token || '').trim();
  const decoded = decodeOpaqueToken(rawToken);
  const cleanDni = decoded?.documento ? String(decoded.documento).trim() : '';

  if (!cleanDni || cleanDni.length < 5) {
    return res.status(400).json({ success: false, message: 'Token inválido o no autorizado' });
  }

  if (decoded && isOpaqueTokenExpired(decoded.timestamp)) {
    return res.status(410).json({ success: false, expired: true, message: 'Este enlace ha expirado.' });
  }

  const cacheKey = `dni_visitas_${cleanDni}`;
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    // 1. Consultar órdenes en VW_WinORdeTraba (o Testmantra como fallback)
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

    let [rows] = await pool.query(querySQL, [cleanDni, cleanDni]);
    let list = rows as any[];

    if (list.length === 0) {
      const [testRows] = await pool.query(
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
      return res.json({ success: true, count: 0, visitas: [], cliente_nombre: null });
    }

    const payload = buildMiWinVisitasPayload(activeList);

    memoryCache.set(cacheKey, payload, CACHE_TTL_MS);

    res.json(payload);

  } catch (error) {
    console.error('Error DB en /api/v1/terceros/cliente/visitas:', error);
    res.status(500).json({ success: false, message: 'Error interno consultando visitas' });
  }
});

// Control de Seguridad para FollowMiWIN
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

const envFollowMiwinKeys = (process.env.FOLLOWMIWIN_API_KEY || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

const FOLLOWMIWIN_VALID_KEYS = [
  ...envFollowMiwinKeys,
  'M1w1n4pp_9d12517a24d7f28c2c6fa6ae296a190c',
  'M1w1n4pp_7273dba14ceba0d31b716cc5b7a04ec4'
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
app.get(
  ['/api/followmiwin/:documento', '/api/v1/followmiwin/:documento', '/api/followmiwin'],
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
    let [allRows] = await pool.query(allQuerySQL, searchParams);
    let listAll = allRows as any[];

    if (listAll.length === 0) {
      const [testRows] = await pool.query(
        allQuerySQL.replace('VW_WinORdeTraba', 'Testmantra'),
        searchParams
      );
      listAll = testRows as any[];
    }

    const ESTADOS_ABIERTOS = ['INICIADA', 'EN CAMINO', 'PENDIENTE', 'AGENDADA'];
    const abiertas = listAll.filter((item: any) => 
      ESTADOS_ABIERTOS.includes((item.estado || '').toUpperCase().trim())
    );

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
    console.error('Error DB en /api/followmiwin:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno consultando followmiwin'
    });
  }
});

// Endpoint para guardar Encuestas (Oculto al mundo exterior directo sin llave)
app.post('/api/encuesta', verificarTercero, async (req, res) => {
  const { 
      token, instalacion_concretada, tecnico_trato, tecnico_puntualidad, tecnico_claridad, 
      tecnico_orden, tecnico_efectividad, satisfaccion_general, satisfaccion_comentario, 
      facilidad_gestion, facilidad_motivo 
    } = req.body;

  if (!token || !satisfaccion_general) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios' });
  }

  try {
    const csvPath = path.join(__dirname, '../server/encuestas.csv');
    const timestamp = new Date().toISOString();

    if (!fs.existsSync(csvPath)) {
      await fs.promises.writeFile(csvPath, 'FECHA_REGISTRO,TOKEN,CONCRETO_INSTALACION,TRATO,PUNTUALIDAD,CLARIDAD,ORDEN,EFECTIVIDAD,SATISFACCION_GENERAL,SATISFACCION_COMENTARIO,FACILIDAD,FACILIDAD_MOTIVO\n', 'utf8');
    }

    const csvLine = [
      timestamp,
      token,
      instalacion_concretada,
      tecnico_trato,
      tecnico_puntualidad,
      tecnico_claridad,
      tecnico_orden,
      tecnico_efectividad,
      satisfaccion_general,
      satisfaccion_comentario || '',
      facilidad_gestion,
      facilidad_motivo || ''
    ].map(sanitizeCsvField).join(',') + '\n';
    await fs.promises.appendFile(csvPath, csvLine, 'utf8');

    res.json({ success: true, message: 'Encuesta guardada con éxito' });
  } catch (error) {
    console.error('Error guardando encuesta en CSV:', error);
    res.status(500).json({ success: false, message: 'Error interno guardando la encuesta' });
  }
});

// Endpoint para verificar si un DNI ya llenó la encuesta
app.get('/api/encuesta/verificar/:token', verificarTercero, async (req, res) => {
  const { token } = req.params;
  try {
    const csvPath = path.join(__dirname, '../server/encuestas.csv');
    if (!fs.existsSync(csvPath)) {
      return res.json({ success: true, completada: false });
    }

    const content = await fs.promises.readFile(csvPath, 'utf8');
    const lineas = content.split('\n');
    const completada = lineas.some(linea => linea.includes(`,${token},`));

    res.json({ success: true, completada });
  } catch (error) {
    console.error('Error verificando encuesta:', error);
    res.status(500).json({ success: false, completada: false });
  }
});

// Helper para consultar datos base de una orden por token
async function resolveOrdenInfo(rawToken: string) {
  const token = String(rawToken || '').trim();
  if (!token || token.length > 150) return null;

  const baseSelect = `
       w.OrdenId AS idoperacion, 
       w.Estado, 
       w.\`Estado OT\` AS SubEstado,
       w.Pin_token AS pin_token,
       w.CodiSegui AS codisegui,
       w.CodiSeguiClien AS codiseguiclien,
       w.Producto AS producto,
       w.TipoTraba AS tipo_trabajo,
       TIMESTAMPDIFF(SECOND, w.\`F.Soli\`, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00')) AS segundos_desde_soli,
       ts.Tipo AS tipo_servicio`;

  let [prodRows] = await pool.query(
    `SELECT ${baseSelect}
     FROM VW_WinORdeTraba w
     LEFT JOIN tiposervicio ts ON UPPER(TRIM(w.Producto)) = UPPER(TRIM(ts.Servicio))
     WHERE w.token = ? 
     ORDER BY w.\`F.Soli\` DESC LIMIT 1`, 
    [token]
  );

  let rows = prodRows as any[];
  if (rows.length === 0 && isPrefixedTicketCode(token)) {
    const [ticketRows] = await pool.query(
      `SELECT ${baseSelect}
       FROM VW_WinORdeTraba w
       LEFT JOIN tiposervicio ts ON UPPER(TRIM(w.Producto)) = UPPER(TRIM(ts.Servicio))
       WHERE w.CodiSegui = ?
       ORDER BY w.\`F.Soli\` DESC LIMIT 1`,
      [token]
    );
    rows = ticketRows as any[];
  }

  if (rows.length === 0) {
    const [testRows] = await pool.query(
      `SELECT ${baseSelect}
       FROM Testmantra w
       LEFT JOIN tiposervicio ts ON UPPER(TRIM(w.Producto)) = UPPER(TRIM(ts.Servicio))
       WHERE w.token = ?
       ORDER BY w.\`F.Soli\` DESC LIMIT 1`, 
      [token]
    );
    rows = testRows as any[];
  }

  if (rows.length === 0) return null;
  const op = rows[0];

  const { isTicket } = classifyOrderType(op);

  const crmCode = isTicket 
    ? (op.codisegui || op.codiseguiclien || '')
    : (op.codiseguiclien || op.codisegui || '');

  return {
    idoperacion: op.idoperacion,
    codisegui: op.codisegui,
    codiseguiclien: op.codiseguiclien,
    crmCode: String(crmCode).trim(),
    producto: op.producto,
    tipo_servicio: op.tipo_servicio,
    isTicket,
    pin_token: op.pin_token,
    expired: isOrderExpired(op.segundos_desde_soli)
  };
}

// Configuración de integración con API Gateway Kong (Uberización)
const UBERIZACION_API_URL = (process.env.UBERIZACION_API_URL || 'https://uberizacion.win.pe/cloud').replace(/\/$/, '');

function getKongHeaders() {
  const kongApiKey = process.env.KONG_APIKEY || '';
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const operationId = `OP-${dateStr}-${rand}`;

  return {
    'apikey': kongApiKey,
    'Content-Type': 'application/json',
    'X-Application-Id': 'UBERIZACION-WEB',
    'X-Operation-Id': operationId,
    'X-Service-Id': 'SCHEDULING',
    'X-Channel-Id': 'WEB',
    'X-User-Name': 'svc_uberizacion',
    'X-Marca-Win': 'WIN'
  };
}

function formatTimeSlotForCrm(turno: string, isTicket: boolean): string {
  const clean = String(turno || '').replace(/\s+/g, '');
  if (isTicket) {
    if (clean === '08:00-12:00' || clean === '08:00-11:59') return '08:00-11:59';
    if (clean === '12:00-16:00' || clean === '12:00-15:59') return '12:00-15:59';
    if (clean === '16:00-20:00' || clean === '16:00-19:59') return '16:00-20:00';
    return clean;
  } else {
    if (clean === '08:00-12:00' || clean === '08:00-11:59') return '08:00-12:00';
    if (clean === '12:00-16:00' || clean === '12:00-15:59') return '12:00-16:00';
    if (clean === '16:00-20:00' || clean === '16:00-19:59') return '16:00-20:00';
    return clean;
  }
}

function formatToYyyyMmDd(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('-');
    return `${y}-${m}-${d}`;
  }
  return clean;
}

function formatToDdMmYyyy(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) return clean;
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-');
    return `${d}-${m}-${y}`;
  }
  return clean;
}

// Endpoint interno: Consulta de disponibilidad de cupos en tiempo real
app.get('/api/v1/terceros/cupos/:token', verificarTercero, async (req, res) => {
  const { token } = req.params;

  try {
    const orden = await resolveOrdenInfo(token);
    if (!orden) {
      return res.status(404).json({ success: false, message: 'Orden o servicio no encontrado para este token' });
    }
    if (orden.expired) {
      return res.status(410).json({ success: false, expired: true, message: 'Este enlace ha expirado.' });
    }

    const kongHeaders = getKongHeaders();
    let targetUrl = '';
    let requestPayload: any = {};

    const crmCode = orden.crmCode;
    if (!crmCode) {
      return res.status(400).json({ success: false, message: 'La orden no cuenta con código CRM registrado para consultar cupos' });
    }

    if (orden.isTicket) {
      targetUrl = `${UBERIZACION_API_URL}/api/v1/scheduling/visits/availability`;
      requestPayload = {
        ticketNumber: crmCode
      };
    } else {
      targetUrl = `${UBERIZACION_API_URL}/api/v1/scheduling/installations/availability`;
      requestPayload = {
        orderCode: crmCode
      };
    }

    const kongResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: kongHeaders,
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(10000)
    });

    const kongData = await kongResponse.json();

    if (!kongResponse.ok) {
      console.error(`[CUPOS API] Error de Kong (${kongResponse.status}):`, kongData);
      return res.status(kongResponse.status).json({
        success: false,
        message: kongData?.detail || kongData?.error?.message || 'Error al consultar disponibilidad en CRM',
        error: kongData
      });
    }

    // Deduplicar tramos y filtrar: reprogramaciones estrictamente desde mañana (+1 día) y ocultar sin cupo
    if (kongData && Array.isArray(kongData.cupos)) {
      const nowPeru = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
      const yyyy = nowPeru.getFullYear();
      const mm = String(nowPeru.getMonth() + 1).padStart(2, '0');
      const dd = String(nowPeru.getDate()).padStart(2, '0');
      const todayIso = `${yyyy}-${mm}-${dd}`;

      kongData.cupos = kongData.cupos
        .map((dia: any) => {
          if (!dia || !Array.isArray(dia.tramos)) return null;
          const normDia = formatToYyyyMmDd(dia.fecha);
          // Regla: no permitir reprogramar para el mismo día ni días pasados (+1 día estricto)
          if (normDia <= todayIso) return null;

          const tramosMap = new Map<string, any>();
          for (const t of dia.tramos) {
            const rawTramo = String(t.tramo || '').trim();
            if (!rawTramo) continue;
            if (!tramosMap.has(rawTramo)) {
              tramosMap.set(rawTramo, { ...t });
            } else {
              // Si al menos una cuadrilla tiene disponibilidad, el tramo queda disponible
              if (t.disponible) tramosMap.get(rawTramo).disponible = true;
            }
          }

          // Regla: si no hay cupo en el tramo, no mostrarlo
          const tramosDisponibles = Array.from(tramosMap.values()).filter((t: any) => t.disponible === true);
          if (tramosDisponibles.length === 0) return null;

          return {
            ...dia,
            disponible: true,
            tramos: tramosDisponibles
          };
        })
        .filter(Boolean);
    }

    res.json({
      success: true,
      tipo: orden.isTicket ? 'ticket' : 'instalacion',
      orderIdentifier: orden.idoperacion,
      ...kongData
    });
  } catch (error: any) {
    console.error('[CUPOS API] Error interno:', error);
    res.status(500).json({ success: false, message: 'Error interno al consultar cupos' });
  }
});

// Endpoint interno: Escritura de reprogramación en CRM Experiencia y persistencia local
app.post('/api/v1/terceros/reprogramar', verificarTercero, async (req, res) => {
  const { token, fecha, turno, motivo, pin } = req.body;

  if (!token || !fecha || !turno) {
    return res.status(400).json({ success: false, message: 'Faltan parámetros obligatorios (token, fecha, turno)' });
  }

  try {
    const orden = await resolveOrdenInfo(token);
    if (!orden) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada para este token' });
    }
    if (orden.expired) {
      return res.status(410).json({ success: false, expired: true, message: 'Este enlace ha expirado.' });
    }

    // Validación obligatoria de PIN de identidad en servidor con protección anti fuerza bruta
    const attemptKey = `pin_fail_${token}`;
    const currentFailures = pinAttemptsCache.get(attemptKey) || 0;
    if (currentFailures >= MAX_PIN_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        code: 'PIN_LOCKED',
        message: 'Demasiados intentos fallidos de PIN. Por seguridad, intenta nuevamente en 15 minutos.'
      });
    }

    const expectedPin = orden.pin_token ? String(orden.pin_token).trim() : '';
    if (!expectedPin || expectedPin.length !== 4) {
      return res.status(409).json({
        success: false,
        code: 'PIN_NOT_AVAILABLE',
        message: 'La orden aún no tiene un PIN de validación activo. Recarga tu enlace de seguimiento e intenta nuevamente.'
      });
    }

    const pinStr = pin !== undefined && pin !== null ? String(pin).trim() : '';
    if (!pinStr || !safeTimingEqual(pinStr, expectedPin)) {
      pinAttemptsCache.set(attemptKey, currentFailures + 1, PIN_LOCKOUT_TTL_MS);
      return res.status(401).json({ success: false, code: 'INVALID_PIN', message: 'El PIN de confirmación es incorrecto o faltante' });
    }
    pinAttemptsCache.delete(attemptKey);

    const formattedDate = formatToDdMmYyyy(fecha);
    const kongHeaders = getKongHeaders();
    let targetUrl = '';
    let reschedulePayload: any = {};

    const reasonText = (motivo && String(motivo).trim()) || 'Reprogramación - Solicitud del Cliente';

    const crmCode = orden.crmCode;
    if (!crmCode) {
      return res.status(400).json({ success: false, message: 'La orden no cuenta con código CRM registrado para reprogramar' });
    }

    const crmTimeSlot = formatTimeSlotForCrm(turno, orden.isTicket);

    if (orden.isTicket) {
      targetUrl = `${UBERIZACION_API_URL}/api/v1/scheduling/visits/reschedule`;
      reschedulePayload = {
        ticketNumber: crmCode,
        newDate: formattedDate,
        newTimeSlot: crmTimeSlot,
        reason: reasonText
      };
    } else {
      targetUrl = `${UBERIZACION_API_URL}/api/v1/scheduling/installations/reschedule`;
      reschedulePayload = {
        orderCode: crmCode,
        newDate: formattedDate,
        newTimeSlot: crmTimeSlot,
        reason: reasonText
      };
    }

    console.log(`[REPROGRAMACION API] Enviando solicitud a ${targetUrl}:`, reschedulePayload);

    const kongResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: kongHeaders,
      body: JSON.stringify(reschedulePayload),
      signal: AbortSignal.timeout(12000)
    });

    const kongData = await kongResponse.json();

    if (!kongResponse.ok) {
      console.warn(`[REPROGRAMACION API] Kong rechazó la solicitud (${kongResponse.status}):`, kongData);
      return res.status(kongResponse.status).json({
        success: false,
        statusCode: kongResponse.status,
        message: kongData?.detail || kongData?.message || 'No fue posible completar la reprogramación en CRM',
        error: kongData
      });
    }

    // Persistencia local en BD (formato MySQL YYYY-MM-DD) y archivo de contingencia para trazabilidad
    const mysqlDate = formatToYyyyMmDd(fecha);
    try {
      const insertQuery = `INSERT INTO REPROGRAMACIONES (token, fecha_solicitada, turno, motivo) VALUES (?, ?, ?, ?)`;
      await pool.query(insertQuery, [token, mysqlDate, turno.trim(), reasonText]);
      memoryCache.delete(`inst_${token}`);
    } catch (dbErr) {
      console.error('[REPROGRAMACION API] Error insertando en REPROGRAMACIONES local:', dbErr);
    }

    try {
      const csvPath = path.join(__dirname, '../server/reprogramaciones.csv');
      const timestamp = new Date().toISOString();
      if (!fs.existsSync(csvPath)) {
        await fs.promises.writeFile(csvPath, 'FECHA_REGISTRO,TOKEN,NUEVA_FECHA_SOLICITADA,TURNO,MOTIVO\n', 'utf8');
      }
      const csvLine = [timestamp, token, formattedDate, String(turno).trim(), reasonText]
        .map(sanitizeCsvField)
        .join(',') + '\n';
      await fs.promises.appendFile(csvPath, csvLine, 'utf8');
    } catch (csvErr) {
      console.error('[REPROGRAMACION API] Error escribiendo en CSV contingencia:', csvErr);
    }

    res.json({
      success: true,
      message: 'Reprogramación confirmada y registrada exitosamente en CRM',
      data: kongData
    });
  } catch (error: any) {
    console.error('[REPROGRAMACION API] Error no controlado:', error);
    res.status(500).json({ success: false, message: 'Error interno al procesar la reprogramación' });
  }
});


// Endpoint para guardar reprogramaciones (Oculto al mundo exterior)
app.post('/api/reprogramar', verificarTercero, async (req, res) => {
  const { token, fecha, turno, motivo } = req.body;

  if (!token || !fecha || !turno) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios' });
  }

  try {
    const csvPath = path.join(__dirname, '../server/reprogramaciones.csv');
    const timestamp = new Date().toISOString();

    if (!fs.existsSync(csvPath)) {
      await fs.promises.writeFile(csvPath, 'FECHA_REGISTRO,TOKEN,NUEVA_FECHA_SOLICITADA,TURNO,MOTIVO\n', 'utf8');
    }

    const csvLine = [timestamp, token, fecha, String(turno).trim(), motivo || '']
      .map(sanitizeCsvField)
      .join(',') + '\n';
    await fs.promises.appendFile(csvPath, csvLine, 'utf8');

    res.json({ success: true, message: 'Reprogramación guardada con éxito' });
  } catch (error) {
    console.error('Error guardando en CSV:', error);
    res.status(500).json({ success: false, message: 'Error interno guardando la solicitud' });
  }
});

// Endpoint para calcular la ruta con tráfico real usando Google Maps API
app.post('/api/route', verificarTercero, async (req, res) => {
  const { start, end } = req.body;

  if (!start || !end) {
    return res.status(400).json({ success: false, message: 'Faltan coordenadas de inicio y fin' });
  }

  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ success: false, message: 'API Key de Google Maps no configurada' });
    }

    const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;
    
    const requestBody = {
      origin: { location: { latLng: { latitude: start[0], longitude: start[1] } } },
      destination: { location: { latLng: { latitude: end[0], longitude: end[1] } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
      routeModifiers: { avoidTolls: false, avoidHighways: false, avoidFerries: false },
      languageCode: "es-419",
      units: "METRIC"
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.polyline.encodedPolyline'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(8000)
    });

    const data = await response.json();

    if (response.ok && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const durationStr = route.duration || "0s";
      const durationSeconds = parseInt(durationStr.replace('s', ''), 10);
      const polyline = route.polyline.encodedPolyline;

      res.json({ success: true, durationSeconds, polyline });
    } else {
      res.status(400).json({ success: false, message: data.error?.message || 'Error en Google Routes API' });
    }
  } catch (error: any) {
    console.error('Error calculando ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno calculando ruta' });
  }
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🛡️ Capa Intermedia de tu Empresa (Segura) corriendo en puerto ${port}`);
});

const gracefulShutdown = (signal: string) => {
  console.log(`[Capa Intermedia] Recibida señal ${signal}, cerrando conexiones...`);
  server.close(async () => {
    try {
      await pool.end();
    } catch {}
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
