import { Router } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../db.ts';
import { createOpaqueToken } from '../opaqueToken.js';

const router = Router();

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

const FOLLOWMIWIN_VALID_KEYS = new Set([
  ...envFollowMiwinKeys,
  'M1w1n4pp_9d12517a24d7f28c2c6fa6ae296a190c', // Producción principal
  'M1w1n4pp_7273dba14ceba0d31b716cc5b7a04ec4'  // Pruebas / Testing temporal
]);

const authFollowMiwin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKeyHeader = req.headers['x-api-key'] as string;
  const authHeader = req.headers['authorization'];

  let token = apiKeyHeader;
  if (!token && authHeader) {
    token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : authHeader.trim();
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado: Se requiere cabecera x-api-key o Authorization: Bearer <token>'
    });
  }

  if (FOLLOWMIWIN_VALID_KEYS.has(token)) {
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
      console.error('Error en /api/followmiwin:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor al consultar followmiwin'
      });
    }
  }
);

export default router;
