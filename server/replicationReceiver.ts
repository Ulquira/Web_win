import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import pool from './db.ts';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const REPLICATION_SECRET = process.env.REPLICATION_SECRET || 'mi_llave_secreta_de_replicacion_super_segura';

const ALLOWED_TABLES: Record<string, Set<string>> = {
  REPROGRAMACIONES: new Set(['id', 'token', 'fecha_solicitada', 'turno', 'motivo', 'fecha_registro']),
  LOGS_TRAKING: new Set(['id', 'token', 'codisegui', 'zona', 'producto', 'evento', 'ip_address', 'detalles', 'sistema_operativo', 'timestamp', 'created_at']),
  ENCUESTAS: new Set(['id', 'token', 'instalacion_concretada', 'tecnico_trato', 'tecnico_puntualidad', 'tecnico_claridad', 'tecnico_orden', 'tecnico_efectividad', 'satisfaccion_general', 'satisfaccion_comentario', 'facilidad_gestion', 'facilidad_motivo', 'fecha_registro']),
  Encuesta_app: new Set(['id', 'token', 'orden_id', 'codisegui', 'satisfaccion_atencion', 'facilidad_uso', 'satisfaccion_experiencia', 'seguridad_datos_tecnico', 'comentarios', 'ip_address', 'user_agent', 'fecha_registro'])
};

const safeTimingEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

// Middleware de seguridad para validar la firma de la réplica
const verifyReplicationSignature = (req: Request, res: Response, next: () => void) => {
  const signature = req.headers['x-replication-signature'] as string;
  const authHeader = req.headers['authorization'];

  if (!signature || !authHeader) {
    return res.status(401).json({ success: false, message: 'No autorizado: Faltan credenciales de replicación' });
  }

  // Verificar Bearer Token como primera capa
  const token = authHeader.replace('Bearer ', '').trim();
  if (!safeTimingEqual(token, REPLICATION_SECRET)) {
    return res.status(401).json({ success: false, message: 'No autorizado: Token de replicación incorrecto' });
  }

  // Verificar HMAC SHA256 de integridad de datos
  const computedSignature = crypto
    .createHmac('sha256', REPLICATION_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (!safeTimingEqual(signature, computedSignature)) {
    return res.status(401).json({ success: false, message: 'No autorizado: Firma de payload inválida' });
  }

  next();
};

// Endpoint que recibe el payload de replicación y lo escribe en la BD destino
router.post('/api/replication/receive', verifyReplicationSignature, async (req: Request, res: Response) => {
  const { table, action, data } = req.body;

  if (!table || !action || !data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ success: false, message: 'Formato de payload de replicación inválido' });
  }

  const allowedCols = ALLOWED_TABLES[String(table)];
  if (!allowedCols) {
    return res.status(403).json({ success: false, message: 'Tabla no permitida para replicación' });
  }
  const safeTable = String(table);

  const rawKeys = Object.keys(data);
  if (rawKeys.length === 0 || rawKeys.some(k => !allowedCols.has(k))) {
    return res.status(400).json({ success: false, message: 'Columnas no permitidas en el payload de replicación' });
  }

  try {
    if (action === 'INSERT') {
      const keys = rawKeys;
      const values = keys.map(k => data[k]);
      const placeholders = keys.map(() => '?').join(', ');
      const quotedCols = keys.map(k => `\`${k}\``).join(', ');

      const query = `INSERT INTO \`${safeTable}\` (${quotedCols}) VALUES (${placeholders})`;
      await pool.query(query, values);
      
      console.log(`✅ [Receptor] INSERT completado en tabla ${safeTable}`);
      return res.json({ success: true, message: `INSERT exitoso en ${safeTable}` });
    } 
    
    if (action === 'UPDATE') {
      const primaryKeys = ['id', 'token', 'idoperacion', 'IDticket', 'OrdenId'];
      const pkName = primaryKeys.find(key => key in data && allowedCols.has(key));

      if (!pkName) {
        return res.status(400).json({ 
          success: false, 
          message: 'No se encontró un campo de identificación válido para realizar el UPDATE' 
        });
      }

      const pkValue = data[pkName];
      const updateKeys = rawKeys.filter(key => key !== pkName);
      const updateValues = updateKeys.map(key => data[key]);

      if (updateKeys.length === 0) {
        return res.json({ success: true, message: 'Nada que actualizar' });
      }

      const setClause = updateKeys.map(key => `\`${key}\` = ?`).join(', ');
      const query = `UPDATE \`${safeTable}\` SET ${setClause} WHERE \`${pkName}\` = ?`;
      
      await pool.query(query, [...updateValues, pkValue]);

      console.log(`✅ [Receptor] UPDATE completado en tabla ${safeTable} para ${pkName} = ${pkValue}`);
      return res.json({ success: true, message: `UPDATE exitoso en ${safeTable}` });
    }

    if (action === 'DELETE') {
      const primaryKeys = ['id', 'token', 'idoperacion', 'IDticket', 'OrdenId'];
      const pkName = primaryKeys.find(key => key in data && allowedCols.has(key));

      if (!pkName) {
        return res.status(400).json({ 
          success: false, 
          message: 'No se encontró un campo de identificación válido para realizar el DELETE' 
        });
      }

      const pkValue = data[pkName];
      const query = `DELETE FROM \`${safeTable}\` WHERE \`${pkName}\` = ?`;
      await pool.query(query, [pkValue]);

      console.log(`✅ [Receptor] DELETE completado en tabla ${safeTable} para ${pkName} = ${pkValue}`);
      return res.json({ success: true, message: `DELETE exitoso en ${safeTable}` });
    }

    return res.status(400).json({ success: false, message: `Acción '${action}' no soportada` });

  } catch (error: any) {
    console.error(`❌ [Receptor] Error aplicando replicación en ${safeTable}:`, error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error aplicando la transacción en la BD destino'
    });
  }
});

export default router;
