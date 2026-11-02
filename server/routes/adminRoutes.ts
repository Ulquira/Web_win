import { Router } from 'express';
import express from 'express';
import crypto from 'crypto';
import pool from '../db.ts';

const router = Router();

// ==========================================
// ENDPOINTS ADMINISTRACIÓN LOCAL / DASHBOARD
// ==========================================

type AdminServiceFilter = { kind: 'tipo' | 'trabajo' | 'producto'; value: string };

const parseAdminServiceFilters = (rawInput: any): AdminServiceFilter[] => {
  if (!rawInput) return [];
  const list = Array.isArray(rawInput) 
    ? rawInput.flatMap(x => String(x).split(',')) 
    : String(rawInput).split(',');
  const result: AdminServiceFilter[] = [];
  for (const item of list) {
    const trimmed = String(item).trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf(':');
    const kind = separator >= 0 ? trimmed.slice(0, separator) : '';
    const value = separator >= 0 ? trimmed.slice(separator + 1) : trimmed;

    if (kind === 'tipo' || kind === 'trabajo' || kind === 'producto') {
      result.push({ kind, value });
    } else {
      result.push({ kind: 'tipo', value: trimmed });
    }
  }
  return result;
};

const parseGrupoServicio = (rawInput: any): string[] => {
  if (!rawInput) return [];
  const list = Array.isArray(rawInput) 
    ? rawInput.flatMap(x => String(x).split(',')) 
    : String(rawInput).split(',');
  return list.map(item => String(item).trim()).filter(Boolean);
};

const OPERACIONES_ESTANDAR = ['INSTALACION', 'AVERIAS', 'PROVINCIA', 'POSTVENTA', 'AVERIAS PRV', 'NO'];

// Helper para construir la condición SQL de grupoServicio en tablas tipo 'reporte' (vw_reporte_funnel_casos_360)
const buildGrupoServicioReporteFilter = (grupos: string[]): { sql: string; values: string[] } | null => {
  if (!grupos || grupos.length === 0) return null;
  const orParts: string[] = [];
  const values: string[] = [];
  for (const g of grupos) {
    const gUpper = g.toUpperCase().trim();
    if (OPERACIONES_ESTANDAR.includes(gUpper)) {
      orParts.push('UPPER(TRIM(r.tipo_operacion)) = ?');
      values.push(gUpper);
    } else {
      orParts.push('(r.tipo_operacion = ? OR r.tipo_trabajo = ? OR r.producto LIKE ?)');
      values.push(g, g, `%${g}%`);
    }
  }
  if (orParts.length === 0) return null;
  return { sql: '(' + orParts.join(' OR ') + ')', values };
};

// Helper para construir la condición SQL de grupoServicio en tablas tipo 'principal' (vw_winordetraba)
const buildGrupoServicioPrincipalFilter = (grupos: string[]): { sql: string; values: string[] } | null => {
  if (!grupos || grupos.length === 0) return null;
  const orParts: string[] = [];
  const values: string[] = [];
  for (const g of grupos) {
    const gUpper = g.toUpperCase().trim();
    if (OPERACIONES_ESTANDAR.includes(gUpper)) {
      orParts.push('UPPER(TRIM(COALESCE(ts_prod.Tipo, ts_traba.Tipo, w.TipoTraba))) = ?');
      values.push(gUpper);
    } else {
      orParts.push('(COALESCE(ts_prod.Tipo, ts_traba.Tipo, w.TipoTraba) = ? OR w.TipoTraba = ? OR w.Producto LIKE ?)');
      values.push(g, g, `%${g}%`);
    }
  }
  if (orParts.length === 0) return null;
  return { sql: '(' + orParts.join(' OR ') + ')', values };
};

const buildServiceFilterSql = (
  serviceFilters: AdminServiceFilter[], 
  tableContext: 'reporte' | 'principal'
): { sql: string; values: string[] } | null => {
  if (!serviceFilters || serviceFilters.length === 0) return null;

  const clauses: string[] = [];
  const values: string[] = [];

  for (const sf of serviceFilters) {
    if (tableContext === 'reporte') {
      if (sf.kind === 'tipo') {
        clauses.push('EXISTS (SELECT 1 FROM tiposervicio ts_filter WHERE UPPER(TRIM(ts_filter.Servicio)) = UPPER(TRIM(r.producto)) AND ts_filter.Tipo = ?)');
      } else {
        clauses.push(`${sf.kind === 'trabajo' ? 'r.tipo_trabajo' : 'r.producto'} = ?`);
      }
      values.push(sf.value);
    } else {
      const col = sf.kind === 'tipo'
        ? 'COALESCE(ts_prod.Tipo, ts_traba.Tipo, w.TipoTraba)'
        : sf.kind === 'trabajo' ? 'w.TipoTraba' : 'w.Producto';
      clauses.push(`${col} = ?`);
      values.push(sf.value);
    }
  }

  if (clauses.length === 0) return null;
  return {
    sql: `(${clauses.join(' OR ')})`,
    values
  };
};

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

router.use(requireLocalAdminOnly);

// 1. Obtener opciones para filtros (Tipos de Servicio / Trabajos)
router.get('/filtros', async (_req, res) => {
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
    const [tiposTrabajoMantra]: any = await pool.query(
      'SELECT DISTINCT tipo_trabajo FROM historial_chats_mantra WHERE tipo_trabajo IS NOT NULL AND tipo_trabajo != "" ORDER BY tipo_trabajo ASC'
    );
    const [canalesMantra]: any = await pool.query(
      'SELECT DISTINCT grupo_servicio FROM historial_chats_mantra WHERE grupo_servicio IS NOT NULL AND grupo_servicio != "" ORDER BY grupo_servicio ASC'
    );

    res.json({
      success: true,
      tiposTraba: tiposTraba.map((r: any) => r.TipoTraba),
      productos: productos.map((r: any) => r.Producto),
      tiposServicio,
      tiposClasificados: tiposClasificados.map((r: any) => r.Tipo),
      gruposServicioMantra: [
        ...tiposTrabajoMantra.map((r: any) => r.tipo_trabajo),
        ...canalesMantra.map((r: any) => r.grupo_servicio)
      ]
    });
  } catch (error: any) {
    console.error('Error obteniendo filtros admin:', error);
    res.status(500).json({ success: false, message: 'Error al obtener filtros' });
  }
});

// 2. Consulta de tablas con filtros dinámicos, paginación y ordenamiento
// 1.1 Actualizar estado del chat Mantra (Cerrar / Reabrir)
router.post('/chat-estado', async (req, res) => {
  try {
    const { id, estado } = req.body;
    if (!id || !estado) {
      return res.status(400).json({ success: false, error: 'id y estado son obligatorios' });
    }

    const nuevoEstado = estado === 'Cerrado' ? 'Cerrado' : null;
    await pool.query('UPDATE historial_chats_mantra SET estado_chat = ? WHERE id = ?', [nuevoEstado, id]);

    res.json({ success: true, id, estado: estado === 'Cerrado' ? 'Cerrado' : 'Abierto' });
  } catch (error: any) {
    console.error('Error al actualizar estado del chat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/data', async (req, res) => {
  try {
    const tabla = String(req.query.tabla || 'principal').toLowerCase();
    const search = String(req.query.search || '').trim();
    const fechaInicio = String(req.query.fechaInicio || '').trim();
    const fechaFin = String(req.query.fechaFin || '').trim();
    const serviceFilters = parseAdminServiceFilters(req.query.tipoServicio);
    const grupoServicio = String(req.query.grupoServicio || '').trim();
    let colFilters: Record<string, string> = {};
    try {
      if (req.query.colFilters) {
        colFilters = JSON.parse(String(req.query.colFilters));
      }
    } catch {
      colFilters = {};
    }
    const estadoChat = String(req.query.estadoChat || '').trim();
    const estadoOt = String(req.query.estadoOt || '').trim();
    const seEnvioWsp = String(req.query.seEnvioWsp || '').trim();
    const ingresoTracking = String(req.query.ingresoTracking || '').trim();
    const reprogramo = String(req.query.reprogramo || '').trim();
    const respondioEncuesta = String(req.query.respondioEncuesta || '').trim();
    const sortBy = String(req.query.sortBy || '').trim();
    const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
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
    } else if (tabla === 'chats_mantra' || tabla === 'historial_chats_mantra') {
      let whereClauses: string[] = ['1=1'];

      if (fechaInicio) {
        whereClauses.push('(h.fecha_gestion_dia >= ? OR DATE(CONVERT_TZ(h.ultimo_mensaje_fecha, "+00:00", "-05:00")) >= ?)');
        params.push(fechaInicio, fechaInicio);
        countParams.push(fechaInicio, fechaInicio);
      }
      if (fechaFin) {
        whereClauses.push('(h.fecha_gestion_dia <= ? OR DATE(CONVERT_TZ(h.ultimo_mensaje_fecha, "+00:00", "-05:00")) <= ?)');
        params.push(fechaFin, fechaFin);
        countParams.push(fechaFin, fechaFin);
      }
      const gruposChats = parseGrupoServicio(grupoServicio);
      if (gruposChats.length > 0) {
        const orParts: string[] = [];
        for (const g of gruposChats) {
          if (g === 'Instalacion' || g === 'Averias') {
            orParts.push('h.grupo_servicio = ?');
            params.push(g);
            countParams.push(g);
          } else {
            orParts.push('(h.tipo_trabajo = ? OR h.grupo_servicio LIKE ?)');
            params.push(g, '%' + g + '%');
            countParams.push(g, '%' + g + '%');
          }
        }
        whereClauses.push('(' + orParts.join(' OR ') + ')');
      }

      const confirmacionCond = `(
        LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'si, confirmo%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'sí, confirmo%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'confirmado%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'confirmar%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'si, conforme%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'si conforme%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'si todo conforme%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'si'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'sí'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = '1'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'conforme'
      )`;

      const plantillaCond = `(
        h.quien_tiene_la_palabra = 'BOT' 
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'entiendo, gracias%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'entiendo gracias%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'otras opciones%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'ok'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'ok.'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'ok!'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'okey'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'oki'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'todo ok'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'de acuerdo'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'ok gracias%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'ok, gracias%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'gracias por su respuesta%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'se informa, muchas gracias%'
        OR h.ultimo_mensaje_texto LIKE '%Trak_%' 
        OR h.ultimo_mensaje_texto LIKE '%Adelanto%' 
        OR h.ultimo_mensaje_texto LIKE '%Blindaje%' 
        OR h.ultimo_mensaje_texto LIKE '%Confirmación%'
        OR h.ultimo_mensaje_texto LIKE '%Confirmacion%'
        OR h.ultimo_mensaje_texto LIKE '%enruta.win.pe%'
        OR h.ultimo_mensaje_texto LIKE '%| [%'
        OR h.ultimo_mensaje_texto LIKE '%Ad. Inc.%'
        OR h.ultimo_mensaje_texto LIKE '%Velocidad%'
        OR h.ultimo_mensaje_texto LIKE '%TRAKING%'
        OR h.ultimo_mensaje_texto LIKE '%Seguimiento de VT%'
        OR h.ultimo_mensaje_texto LIKE '%programaci%'
        OR h.ultimo_mensaje_texto LIKE '%gracias por confirmar%'
      )`;

      const allowedColsChats: Record<string, string> = {
        id: 'h.id',
        orden_id: 'h.orden_id',
        ticket: 'h.ticket',
        phone: 'h.phone',
        cliente: 'h.cliente_nombre',
        cliente_nombre: 'h.cliente_nombre',
        asesor: 'h.asesor_asignado',
        asesor_asignado: 'h.asesor_asignado',
        usuario: 'h.asesor_asignado',
        tipo_trabajo: 'h.tipo_trabajo',
        grupo_servicio: 'h.grupo_servicio',
        distrito: 'h.distrito',
        palabra: 'h.quien_tiene_la_palabra',
        quien_tiene_la_palabra: 'h.quien_tiene_la_palabra',
        estado_chat: 'h.estado_chat',
        semaforo_sla: 'h.semaforo_sla',
        mensaje: 'h.ultimo_mensaje_texto',
        ultimo_mensaje_texto: 'h.ultimo_mensaje_texto',
        ultimo_mensaje_fecha: 'h.ultimo_mensaje_fecha'
      };

      for (const [colKey, rawVal] of Object.entries(colFilters)) {
        let searchStr = '';
        let selectedArr: string[] = [];
        if (typeof rawVal === 'string') {
          searchStr = rawVal.trim();
        } else if (rawVal && typeof rawVal === 'object') {
          searchStr = String((rawVal as any).search || '').trim();
          if (Array.isArray((rawVal as any).selected)) {
            selectedArr = (rawVal as any).selected.map(String).filter(Boolean);
          }
        }

        if (colKey === 'quien_tiene_la_palabra' || colKey === 'palabra') {
          if (selectedArr.length > 0) {
            const orParts: string[] = [];
            if (selectedArr.includes('CONFIRMADO')) orParts.push(`(${confirmacionCond})`);
            if (selectedArr.includes('PLANTILLA')) orParts.push(`(${plantillaCond} AND NOT ${confirmacionCond})`);
            if (selectedArr.includes('CLIENTE')) orParts.push(`(h.quien_tiene_la_palabra = 'CLIENTE' AND NOT ${confirmacionCond} AND NOT ${plantillaCond})`);
            if (selectedArr.includes('ASESOR')) orParts.push(`(h.quien_tiene_la_palabra != 'CLIENTE' AND NOT ${plantillaCond} AND NOT ${confirmacionCond})`);
            if (orParts.length > 0) {
              whereClauses.push(`(${orParts.join(' OR ')})`);
            }
          } else if (searchStr) {
            if (searchStr.toUpperCase().includes('CONFIRM')) {
              whereClauses.push(`(${confirmacionCond})`);
            } else {
              whereClauses.push(`h.quien_tiene_la_palabra LIKE ?`);
              params.push(`%${searchStr}%`);
              countParams.push(`%${searchStr}%`);
            }
          }
          continue;
        }

        if (colKey === 'estado_chat') {
          if (selectedArr.length > 0) {
            const orParts: string[] = [];
            if (selectedArr.includes('Cerrado')) orParts.push(`(h.estado_chat = 'Cerrado' OR ${confirmacionCond})`);
            if (selectedArr.includes('Abierto')) orParts.push(`((h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) AND h.quien_tiene_la_palabra = 'CLIENTE' AND NOT ${confirmacionCond} AND NOT ${plantillaCond})`);
            if (selectedArr.includes('Pendiente')) orParts.push(`((h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) AND ${plantillaCond} AND NOT ${confirmacionCond})`);
            if (selectedArr.includes('Sin Respuesta')) orParts.push(`((h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) AND h.quien_tiene_la_palabra != 'CLIENTE' AND NOT ${plantillaCond} AND NOT ${confirmacionCond})`);
            if (orParts.length > 0) {
              whereClauses.push(`(${orParts.join(' OR ')})`);
            }
          } else if (searchStr) {
            whereClauses.push(`h.estado_chat LIKE ?`);
            params.push(`%${searchStr}%`);
            countParams.push(`%${searchStr}%`);
          }
          continue;
        }

        const sqlField = allowedColsChats[colKey];
        if (sqlField) {
          if (selectedArr.length > 0) {
            const placeholders = selectedArr.map(() => '?').join(',');
            whereClauses.push(`${sqlField} IN (${placeholders})`);
            params.push(...selectedArr);
            countParams.push(...selectedArr);
          } else if (searchStr) {
            whereClauses.push(`${sqlField} LIKE ?`);
            params.push(`%${searchStr}%`);
            countParams.push(`%${searchStr}%`);
          }
        }
      }

      if (search) {
        whereClauses.push('(h.orden_id LIKE ? OR h.ticket LIKE ? OR h.phone LIKE ? OR h.cliente_nombre LIKE ? OR h.ultimo_mensaje_texto LIKE ? OR h.asesor_asignado LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s, s, s, s);
        countParams.push(s, s, s, s, s, s);
      }

      if (estadoChat) {
        if (estadoChat === 'Cerrado') {
          whereClauses.push(`(h.estado_chat = 'Cerrado' OR ${confirmacionCond})`);
        } else if (estadoChat === 'Abierto') {
          whereClauses.push(`(h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) AND h.quien_tiene_la_palabra = 'CLIENTE' AND NOT ${confirmacionCond} AND NOT ${plantillaCond}`);
        } else if (estadoChat === 'Pendiente') {
          whereClauses.push(`(h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) AND ${plantillaCond} AND NOT ${confirmacionCond}`);
        } else if (estadoChat === 'Sin Respuesta') {
          whereClauses.push(`(h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) AND h.quien_tiene_la_palabra != 'CLIENTE' AND NOT ${plantillaCond} AND NOT ${confirmacionCond}`);
        }
      }

      const allowedSortCols: Record<string, string> = {
        id: 'h.id',
        orden_id: 'h.orden_id',
        ticket: 'h.ticket',
        phone: 'h.phone',
        cliente_nombre: 'h.cliente_nombre',
        asesor_asignado: 'h.asesor_asignado',
        usuario: 'h.asesor_asignado',
        grupo_servicio: 'h.grupo_servicio',
        tipo_trabajo: 'h.tipo_trabajo',
        distrito: 'h.distrito',
        provincia: 'h.provincia',
        quien_tiene_la_palabra: 'h.quien_tiene_la_palabra',
        estado_chat: 'h.estado_chat',
        semaforo_sla: 'h.semaforo_sla',
        ultimo_mensaje_texto: 'h.ultimo_mensaje_texto',
        ultimo_mensaje_fecha: 'h.ultimo_mensaje_fecha',
        fecha_gestion_dia: 'h.fecha_gestion_dia',
        total_mensajes: 'h.total_mensajes'
      };
      const orderCol = allowedSortCols[sortBy] || 'h.ultimo_mensaje_fecha';

      const whereSql = whereClauses.join(' AND ');
      countQuery = `SELECT COUNT(*) as total FROM historial_chats_mantra h WHERE ${whereSql}`;
      selectQuery = `
        SELECT 
          h.*,
          CASE 
            WHEN ${confirmacionCond} THEN 'CONFIRMADO'
            WHEN ${plantillaCond} THEN 'PLANTILLA'
            WHEN h.quien_tiene_la_palabra = 'CLIENTE' THEN 'CLIENTE'
            ELSE 'ASESOR'
          END AS quien_tiene_la_palabra,
          CASE
            WHEN h.estado_chat = 'Cerrado' OR ${confirmacionCond} THEN 'Cerrado'
            WHEN ${plantillaCond} THEN 'Pendiente'
            WHEN h.quien_tiene_la_palabra = 'CLIENTE' THEN 'Abierto'
            ELSE 'Sin Respuesta'
          END AS estado_chat,
          CASE
            WHEN ${confirmacionCond} OR h.estado_chat = 'Cerrado' OR ${plantillaCond} THEN 'VERDE'
            ELSE COALESCE(h.semaforo_sla, 'VERDE')
          END AS semaforo_sla
        FROM historial_chats_mantra h
        WHERE ${whereSql}
        ORDER BY ${orderCol} ${sortOrder}, h.id DESC
        LIMIT ? OFFSET ?
      `;
      params.push(limit, offset);
    } else if (tabla === 'reporte' || tabla === 'vw_reporte_funnel_casos_360') {
      let whereClauses: string[] = ['1=1'];

      if (fechaInicio) {
        whereClauses.push('r.fecha_visita >= ?');
        params.push(`${fechaInicio} 00:00:00`);
        countParams.push(`${fechaInicio} 00:00:00`);
      }
      if (fechaFin) {
        whereClauses.push('r.fecha_visita <= ?');
        params.push(`${fechaFin} 23:59:59`);
        countParams.push(`${fechaFin} 23:59:59`);
      }
      const serviceCond = buildServiceFilterSql(serviceFilters, 'reporte');
      const gruposReporte = parseGrupoServicio(grupoServicio);
      const grupoRepCond = buildGrupoServicioReporteFilter(gruposReporte);
      if (grupoRepCond) {
        whereClauses.push(grupoRepCond.sql);
        params.push(...grupoRepCond.values);
        countParams.push(...grupoRepCond.values);
      }
      if (serviceCond) {
        whereClauses.push(serviceCond.sql);
        params.push(...serviceCond.values);
        countParams.push(...serviceCond.values);
      }
      if (estadoOt) {
        whereClauses.push('r.estado_ot = ?');
        params.push(estadoOt);
        countParams.push(estadoOt);
      }
      if (seEnvioWsp) {
        whereClauses.push('r.se_envio_wsp = ?');
        params.push(seEnvioWsp);
        countParams.push(seEnvioWsp);
      }
      if (ingresoTracking) {
        whereClauses.push('r.ingreso_tracking = ?');
        params.push(ingresoTracking);
        countParams.push(ingresoTracking);
      }
      if (reprogramo) {
        whereClauses.push('r.reprogramo = ?');
        params.push(reprogramo);
        countParams.push(reprogramo);
      }
      if (respondioEncuesta) {
        whereClauses.push('r.respondio_encuesta = ?');
        params.push(respondioEncuesta);
        countParams.push(respondioEncuesta);
      }
      if (search) {
        whereClauses.push('(r.orden_id LIKE ? OR r.ticket LIKE ? OR r.cliente LIKE ? OR r.telefono LIKE ? OR r.distrito LIKE ? OR r.token_tracking LIKE ? OR r.cuadrilla LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s, s, s, s, s);
        countParams.push(s, s, s, s, s, s, s);
      }
      const allowedColsReporte: Record<string, string> = {
        orden_id: 'r.orden_id',
        ticket: 'r.ticket',
        cliente: 'r.cliente',
        telefono: 'r.telefono',
        producto: 'r.producto',
        tipo_operacion: 'r.tipo_operacion',
        estado_ot: 'r.estado_ot',
        distrito: 'r.distrito',
        cuadrilla: 'r.cuadrilla',
        se_envio_wsp: 'r.se_envio_wsp',
        ingreso_tracking: 'r.ingreso_tracking',
        reprogramo: 'r.reprogramo',
        respondio_encuesta: 'r.respondio_encuesta',
        pulso_soporte: 'r.pulso_soporte',
        fecha_visita: 'r.fecha_visita'
      };

      for (const [colKey, colVal] of Object.entries(colFilters)) {
        if (!colVal) continue;
        const searchStr = typeof colVal === 'string' ? colVal.trim() : String((colVal as any).search || '').trim();
        const selectedArr: string[] = typeof colVal === 'object' && Array.isArray((colVal as any).selected)
          ? (colVal as any).selected.filter(Boolean)
          : [];
        if (!searchStr && selectedArr.length === 0) continue;

        const sqlField = allowedColsReporte[colKey];
        if (sqlField) {
          if (selectedArr.length > 0) {
            const placeholders = selectedArr.map(() => '?').join(',');
            whereClauses.push(`${sqlField} IN (${placeholders})`);
            params.push(...selectedArr);
            countParams.push(...selectedArr);
          } else if (searchStr) {
            whereClauses.push(`${sqlField} LIKE ?`);
            params.push(`%${searchStr}%`);
            countParams.push(`%${searchStr}%`);
          }
        }
      }

      const allowedSortCols: Record<string, string> = {
        orden_id: 'r.orden_id',
        ticket: 'r.ticket',
        cliente: 'r.cliente',
        telefono: 'r.telefono',
        producto: 'r.producto',
        tipo_operacion: 'r.tipo_operacion',
        tipo_trabajo: 'r.tipo_trabajo',
        estado_ot: 'r.estado_ot',
        fecha_visita: 'r.fecha_visita',
        fecha_solicitud: 'r.fecha_solicitud',
        distrito: 'r.distrito',
        provincia: 'r.provincia',
        cuadrilla: 'r.cuadrilla',
        se_envio_wsp: 'r.se_envio_wsp',
        fecha_envio_wsp: 'r.fecha_envio_wsp',
        ingreso_tracking: 'r.ingreso_tracking',
        total_interacciones_tracking: 'r.total_interacciones_tracking',
        vistas_mapa_seguimiento: 'r.vistas_mapa_seguimiento',
        refrescos_pantalla: 'r.refrescos_pantalla',
        pulso_soporte: 'r.pulso_soporte',
        reprogramo: 'r.reprogramo',
        respondio_encuesta: 'r.respondio_encuesta',
        satisfaccion_general: 'r.satisfaccion_general'
      };
      const orderCol = allowedSortCols[sortBy] || 'r.fecha_visita';

      const whereSql = whereClauses.join(' AND ');
      countQuery = `SELECT COUNT(*) as total FROM vw_reporte_funnel_casos_360 r WHERE ${whereSql}`;
      selectQuery = `
        SELECT r.*
        FROM vw_reporte_funnel_casos_360 r
        WHERE ${whereSql}
        ORDER BY ${orderCol} ${sortOrder}, r.orden_id DESC
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
      const serviceCond = buildServiceFilterSql(serviceFilters, 'principal');
      if (serviceCond) {
        whereClauses.push(serviceCond.sql);
        params.push(...serviceCond.values);
        countParams.push(...serviceCond.values);
      }
      if (search) {
        whereClauses.push('(w.OrdenId LIKE ? OR w.Cliente LIKE ? OR w.N\xfamero Documento LIKE ? OR w.token LIKE ? OR w.CodiSegui LIKE ? OR w.Direccion LIKE ? OR w.Zona LIKE ? OR w.Cuadrilla LIKE ? OR w.Cuadrilla_nombre LIKE ? OR w.Pin_token LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s, s, s, s, s, s, s, s);
        countParams.push(s, s, s, s, s, s, s, s, s, s);
      }
      const gruposPrincipal = parseGrupoServicio(grupoServicio);
      const grupoPrinCond = buildGrupoServicioPrincipalFilter(gruposPrincipal);
      if (grupoPrinCond) {
        whereClauses.push(grupoPrinCond.sql);
        params.push(...grupoPrinCond.values);
        countParams.push(...grupoPrinCond.values);
      }
      const allowedColsPrincipal: Record<string, string> = {
        orden_id: 'w.OrdenId',
        OrdenId: 'w.OrdenId',
        cliente: 'w.Cliente',
        Cliente: 'w.Cliente',
        documento: 'w.`Número Documento`',
        NumeroDocumento: 'w.`Número Documento`',
        'Número Documento': 'w.`Número Documento`',
        tipo_servicio: 'COALESCE(ts_prod.Tipo, ts_traba.Tipo, w.TipoTraba)',
        TipoServicioCalculado: 'COALESCE(ts_prod.Tipo, ts_traba.Tipo, w.TipoTraba)',
        tipo_trabajo: 'w.TipoTraba',
        TipoTraba: 'w.TipoTraba',
        producto: 'w.Producto',
        Producto: 'w.Producto',
        estado: 'w.Estado',
        Estado: 'w.Estado',
        fecha_visita: 'w.`F.Visita`',
        FechaVisita: 'w.`F.Visita`',
        direccion: 'w.Direccion',
        Direccion: 'w.Direccion',
        distrito: 'COALESCE(NULLIF(TRIM(w.Zona), \'\'), w.Localidad)',
        Localidad: 'COALESCE(NULLIF(TRIM(w.Zona), \'\'), w.Localidad)',
        Zona: 'COALESCE(NULLIF(TRIM(w.Zona), \'\'), w.Localidad)',
        cuadrilla: 'w.Cuadrilla',
        Cuadrilla: 'w.Cuadrilla',
        tecnico: 'w.Cuadrilla_nombre',
        Cuadrilla_nombre: 'w.Cuadrilla_nombre',
        pin: 'w.Pin_token',
        Pin_token: 'w.Pin_token',
        token: 'w.token'
      };

      for (const [colKey, colVal] of Object.entries(colFilters)) {
        if (!colVal) continue;
        const searchStr = typeof colVal === 'string' ? colVal.trim() : String((colVal as any).search || '').trim();
        const selectedArr: string[] = typeof colVal === 'object' && Array.isArray((colVal as any).selected)
          ? (colVal as any).selected.filter(Boolean)
          : [];
        if (!searchStr && selectedArr.length === 0) continue;

        const sqlField = allowedColsPrincipal[colKey];
        if (sqlField) {
          if (selectedArr.length > 0) {
            const placeholders = selectedArr.map(() => '?').join(',');
            whereClauses.push(`${sqlField} IN (${placeholders})`);
            params.push(...selectedArr);
            countParams.push(...selectedArr);
          } else if (searchStr) {
            whereClauses.push(`${sqlField} LIKE ?`);
            params.push(`%${searchStr}%`);
            countParams.push(`%${searchStr}%`);
          }
        }
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

// 2.3 Métricas Agrupadas para el Dashboard Ejecutivo (Funnel de Envíos Mantra, Sectores y Estados)
router.get('/dashboard-stats', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const fechaInicio = String(req.query.fechaInicio || '').trim();
    const fechaFin = String(req.query.fechaFin || '').trim();
    const grupoServicio = String(req.query.grupoServicio || '').trim();
    const serviceFilters = parseAdminServiceFilters(req.query.tipoServicio);

    const whereClauses: string[] = ['1=1'];
    const params: any[] = [];

    if (fechaInicio) {
      whereClauses.push('r.fecha_visita >= ?');
      params.push(`${fechaInicio} 00:00:00`);
    }
    if (fechaFin) {
      whereClauses.push('r.fecha_visita <= ?');
      params.push(`${fechaFin} 23:59:59`);
    }
    const gruposDashboard = parseGrupoServicio(grupoServicio);
    const grupoDashCond = buildGrupoServicioReporteFilter(gruposDashboard);
    if (grupoDashCond) {
      whereClauses.push(grupoDashCond.sql);
      params.push(...grupoDashCond.values);
    }
    const serviceCond = buildServiceFilterSql(serviceFilters, 'reporte');
    if (serviceCond) {
      whereClauses.push(serviceCond.sql);
      params.push(...serviceCond.values);
    }
    if (search) {
      whereClauses.push('(r.orden_id LIKE ? OR r.ticket LIKE ? OR r.cliente LIKE ? OR r.telefono LIKE ? OR r.distrito LIKE ? OR r.cuadrilla LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }

    const whereSql = whereClauses.join(' AND ');

    // 1. Totales generales del embudo
    const kpiQuery = `
      SELECT 
        COUNT(*) as total_ots,
        COALESCE(SUM(CASE WHEN r.se_envio_wsp = 'SI' THEN 1 ELSE 0 END), 0) as wsp_enviados,
        COALESCE(SUM(CASE WHEN r.se_envio_wsp = 'NO' THEN 1 ELSE 0 END), 0) as wsp_no_enviados,
        COALESCE(SUM(CASE WHEN r.ingreso_tracking = 'SI' THEN 1 ELSE 0 END), 0) as tracking_ingresados,
        COALESCE(SUM(CASE WHEN r.reprogramo = 'SI' THEN 1 ELSE 0 END), 0) as reprogramados,
        COALESCE(SUM(CASE WHEN r.respondio_encuesta = 'SI' THEN 1 ELSE 0 END), 0) as encuestas_respondidas,
        COALESCE(SUM(CASE WHEN r.pulso_soporte = 'SI' THEN 1 ELSE 0 END), 0) as pulso_soporte,
        COALESCE(SUM(r.total_interacciones_tracking), 0) as total_interacciones,
        COALESCE(SUM(r.vistas_mapa_seguimiento), 0) as total_vistas_mapa
      FROM vw_reporte_funnel_casos_360 r
      WHERE ${whereSql}
    `;

    // 2. Desglose de estados de mensaje WSP
    const estadosWspQuery = `
      SELECT 
        COALESCE(NULLIF(TRIM(r.estado_wsp), ''), 'NO ENVIADO') as estado,
        COUNT(*) as total
      FROM vw_reporte_funnel_casos_360 r
      WHERE ${whereSql}
      GROUP BY estado
      ORDER BY total DESC
    `;

    // 3. Desglose por Sector Operativo
    const sectoresQuery = `
      SELECT 
        COALESCE(NULLIF(TRIM(r.sector_operativo), ''), 'SIN SECTOR') as sector,
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN r.se_envio_wsp = 'SI' THEN 1 ELSE 0 END), 0) as enviados,
        COALESCE(SUM(CASE WHEN r.se_envio_wsp = 'NO' THEN 1 ELSE 0 END), 0) as no_enviados,
        COALESCE(SUM(CASE WHEN r.ingreso_tracking = 'SI' THEN 1 ELSE 0 END), 0) as tracking_ingresados,
        COALESCE(SUM(CASE WHEN LOWER(r.estado_wsp) = 'read' THEN 1 ELSE 0 END), 0) as leidos,
        COALESCE(SUM(CASE WHEN LOWER(r.estado_wsp) = 'failed' THEN 1 ELSE 0 END), 0) as fallidos
      FROM vw_reporte_funnel_casos_360 r
      WHERE ${whereSql}
      GROUP BY sector
      ORDER BY total DESC
      LIMIT 30
    `;

    // 4. Desglose por Tipo de Operación
    const operacionesQuery = `
      SELECT 
        COALESCE(NULLIF(TRIM(r.tipo_operacion), ''), 'OTROS') as operacion,
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN r.se_envio_wsp = 'SI' THEN 1 ELSE 0 END), 0) as enviados,
        COALESCE(SUM(CASE WHEN r.ingreso_tracking = 'SI' THEN 1 ELSE 0 END), 0) as tracking_ingresados
      FROM vw_reporte_funnel_casos_360 r
      WHERE ${whereSql}
      GROUP BY operacion
      ORDER BY total DESC
      LIMIT 12
    `;

    // 5. Desglose diario de avance e indicadores
    const diarioQuery = `
      SELECT 
        COALESCE(DATE_FORMAT(r.fecha_visita, '%Y-%m-%d'), 'Sin fecha') as fecha,
        COUNT(*) as total_ots,
        COALESCE(SUM(CASE WHEN r.se_envio_wsp = 'SI' THEN 1 ELSE 0 END), 0) as wsp_enviados,
        COALESCE(SUM(CASE WHEN r.se_envio_wsp = 'NO' THEN 1 ELSE 0 END), 0) as wsp_no_enviados,
        COALESCE(SUM(CASE WHEN LOWER(r.estado_wsp) = 'read' THEN 1 ELSE 0 END), 0) as read_total,
        COALESCE(SUM(CASE WHEN LOWER(r.estado_wsp) = 'delivered' THEN 1 ELSE 0 END), 0) as delivered_total,
        COALESCE(SUM(CASE WHEN LOWER(r.estado_wsp) = 'sent' THEN 1 ELSE 0 END), 0) as sent_total,
        COALESCE(SUM(CASE WHEN LOWER(r.estado_wsp) = 'failed' THEN 1 ELSE 0 END), 0) as failed_total,
        COALESCE(SUM(CASE WHEN r.ingreso_tracking = 'SI' THEN 1 ELSE 0 END), 0) as tracking_ingresados,
        COALESCE(SUM(r.vistas_mapa_seguimiento), 0) as total_vistas_mapa,
        COALESCE(SUM(CASE WHEN r.reprogramo = 'SI' THEN 1 ELSE 0 END), 0) as reprogramados,
        COALESCE(SUM(CASE WHEN r.respondio_encuesta = 'SI' THEN 1 ELSE 0 END), 0) as encuestas_respondidas,
        COALESCE(SUM(CASE WHEN r.pulso_soporte = 'SI' THEN 1 ELSE 0 END), 0) as pulso_soporte
      FROM vw_reporte_funnel_casos_360 r
      WHERE ${whereSql}
      GROUP BY fecha
      ORDER BY fecha DESC
      LIMIT 90
    `;

    const [kpiRes, estadosRes, sectoresRes, operacionesRes, diarioRes] = await Promise.allSettled([
      pool.query(kpiQuery, params),
      pool.query(estadosWspQuery, params),
      pool.query(sectoresQuery, params),
      pool.query(operacionesQuery, params),
      pool.query(diarioQuery, params)
    ]);

    const kpiRows = kpiRes.status === 'fulfilled' ? (kpiRes.value as any)[0] : [];
    const estadosRows = estadosRes.status === 'fulfilled' ? (estadosRes.value as any)[0] : [];
    const sectoresRows = sectoresRes.status === 'fulfilled' ? (sectoresRes.value as any)[0] : [];
    const operacionesRows = operacionesRes.status === 'fulfilled' ? (operacionesRes.value as any)[0] : [];
    const diarioRows = diarioRes.status === 'fulfilled' ? (diarioRes.value as any)[0] : [];

    if (diarioRes.status === 'rejected') {
      console.error('Error en diarioQuery:', diarioRes.reason);
    }

    res.json({
      success: true,
      kpis: kpiRows[0] || {},
      estadosWsp: estadosRows || [],
      sectores: sectoresRows || [],
      operaciones: operacionesRows || [],
      avanceDiario: diarioRows || []
    });
  } catch (error: any) {
    console.error('Error en /api/4dm1n_/dashboard-stats:', error);
    res.status(500).json({ success: false, message: 'Error consultando métricas del dashboard' });
  }
});

// 2.4 Métricas Analíticas Especializadas para Dashboard de Chats
router.get('/chats-dashboard-stats', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const fechaInicio = String(req.query.fechaInicio || '').trim();
    const fechaFin = String(req.query.fechaFin || '').trim();
    const grupoServicio = String(req.query.grupoServicio || '').trim();

    const whereClauses: string[] = ['1=1'];
    const params: any[] = [];

    if (fechaInicio) {
      whereClauses.push('(h.fecha_gestion_dia >= ? OR DATE(CONVERT_TZ(h.ultimo_mensaje_fecha, "+00:00", "-05:00")) >= ?)');
      params.push(fechaInicio, fechaInicio);
    }
    if (fechaFin) {
      whereClauses.push('(h.fecha_gestion_dia <= ? OR DATE(CONVERT_TZ(h.ultimo_mensaje_fecha, "+00:00", "-05:00")) <= ?)');
      params.push(fechaFin, fechaFin);
    }
    const gruposChatsStats = parseGrupoServicio(grupoServicio);
    if (gruposChatsStats.length > 0) {
      const orParts: string[] = [];
      for (const g of gruposChatsStats) {
        if (g === 'Instalacion' || g === 'Averias') {
          orParts.push('h.grupo_servicio = ?');
          params.push(g);
        } else {
          orParts.push('(h.tipo_trabajo = ? OR h.grupo_servicio LIKE ?)');
          params.push(g, '%' + g + '%');
        }
      }
      whereClauses.push('(' + orParts.join(' OR ') + ')');
    }
    if (search) {
      whereClauses.push('(h.orden_id LIKE ? OR h.ticket LIKE ? OR h.phone LIKE ? OR h.cliente_nombre LIKE ? OR h.ultimo_mensaje_texto LIKE ? OR h.asesor_asignado LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }

    const whereSql = whereClauses.join(' AND ');

    const confirmCond = `(
        LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'si, confirmo%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'sí, confirmo%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'confirmado%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'confirmar%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'si, conforme%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'si conforme%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'si todo conforme%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'si'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'sí'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = '1'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'conforme'
      )`;

    const plantCond = `(
        h.quien_tiene_la_palabra = 'BOT' 
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'entiendo, gracias%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'entiendo gracias%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'otras opciones%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'ok'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'ok.'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'ok!'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'okey'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'oki'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'todo ok'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'de acuerdo'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'ok gracias%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'ok, gracias%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'gracias por su respuesta%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'se informa, muchas gracias%'
        OR h.ultimo_mensaje_texto LIKE '%Trak_%' 
        OR h.ultimo_mensaje_texto LIKE '%Adelanto%' 
        OR h.ultimo_mensaje_texto LIKE '%Blindaje%' 
        OR h.ultimo_mensaje_texto LIKE '%Confirmación%'
        OR h.ultimo_mensaje_texto LIKE '%Confirmacion%'
        OR h.ultimo_mensaje_texto LIKE '%enruta.win.pe%'
        OR h.ultimo_mensaje_texto LIKE '%| [%'
        OR h.ultimo_mensaje_texto LIKE '%Ad. Inc.%'
        OR h.ultimo_mensaje_texto LIKE '%Velocidad%'
        OR h.ultimo_mensaje_texto LIKE '%TRAKING%'
        OR h.ultimo_mensaje_texto LIKE '%Seguimiento de VT%'
        OR h.ultimo_mensaje_texto LIKE '%programaci%'
        OR h.ultimo_mensaje_texto LIKE '%gracias por confirmar%'
      )`;

    const kpiQuery = `
      SELECT 
        COUNT(*) as totalChats,
        SUM(CASE WHEN ${confirmCond} THEN 1 ELSE 0 END) as totalConfirmados,
        SUM(CASE WHEN h.quien_tiene_la_palabra = 'CLIENTE' AND NOT ${confirmCond} AND NOT ${plantCond} AND (h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) THEN 1 ELSE 0 END) as chatsAbiertos,
        SUM(CASE WHEN h.estado_chat = 'Cerrado' OR ${confirmCond} THEN 1 ELSE 0 END) as chatsCerrados,
        SUM(CASE WHEN ${plantCond} AND NOT ${confirmCond} AND (h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) THEN 1 ELSE 0 END) as chatsPendientes,
        SUM(CASE WHEN h.quien_tiene_la_palabra NOT IN ('CLIENTE', 'BOT') AND NOT ${confirmCond} AND NOT ${plantCond} THEN 1 ELSE 0 END) as chatsAsesorUltimo,
        SUM(CASE WHEN ${confirmCond} OR ${plantCond} OR h.estado_chat = 'Cerrado' OR COALESCE(h.semaforo_sla, 'VERDE') = 'VERDE' THEN 1 ELSE 0 END) as slaVerde,
        SUM(CASE WHEN COALESCE(h.semaforo_sla, 'VERDE') = 'AMARILLO' AND NOT ${confirmCond} AND NOT ${plantCond} AND (h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) THEN 1 ELSE 0 END) as slaAmarillo,
        SUM(CASE WHEN COALESCE(h.semaforo_sla, 'VERDE') = 'ROJO' AND NOT ${confirmCond} AND NOT ${plantCond} AND (h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) THEN 1 ELSE 0 END) as slaRojo
      FROM historial_chats_mantra h
      WHERE ${whereSql}
    `;

    const palabraQuery = `
      SELECT 
        CASE
          WHEN ${confirmCond} THEN 'CONFIRMADO'
          WHEN ${plantCond} THEN 'PLANTILLA'
          WHEN h.quien_tiene_la_palabra = 'CLIENTE' THEN 'CLIENTE'
          ELSE 'ASESOR'
        END as palabra,
        COUNT(*) as total
      FROM historial_chats_mantra h
      WHERE ${whereSql}
      GROUP BY palabra
      ORDER BY total DESC
    `;

    const estadosQuery = `
      SELECT 
        CASE
          WHEN h.estado_chat = 'Cerrado' OR ${confirmCond} THEN 'Cerrado'
          WHEN ${plantCond} THEN 'Pendiente'
          WHEN h.quien_tiene_la_palabra = 'CLIENTE' THEN 'Abierto'
          ELSE 'Sin Respuesta'
        END as estado,
        COUNT(*) as total
      FROM historial_chats_mantra h
      WHERE ${whereSql}
      GROUP BY estado
      ORDER BY total DESC
    `;

    const asesoresQuery = `
      SELECT 
        COALESCE(NULLIF(TRIM(h.asesor_asignado), ''), 'Sin Asignar') as asesor,
        COUNT(*) as total,
        SUM(CASE WHEN ${confirmCond} OR ${plantCond} OR h.estado_chat = 'Cerrado' OR h.quien_tiene_la_palabra NOT IN ('CLIENTE', 'BOT') THEN 1 ELSE 0 END) as atendidos,
        SUM(CASE WHEN h.quien_tiene_la_palabra = 'CLIENTE' AND NOT ${confirmCond} AND NOT ${plantCond} AND (h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) THEN 1 ELSE 0 END) as abiertos,
        SUM(CASE WHEN ${confirmCond} OR ${plantCond} OR h.estado_chat = 'Cerrado' OR COALESCE(h.semaforo_sla, 'VERDE') = 'VERDE' THEN 1 ELSE 0 END) as verdes,
        SUM(CASE WHEN COALESCE(h.semaforo_sla, 'VERDE') = 'ROJO' AND NOT ${confirmCond} AND NOT ${plantCond} AND (h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) THEN 1 ELSE 0 END) as rojos
      FROM historial_chats_mantra h
      WHERE ${whereSql}
      GROUP BY asesor
      ORDER BY total DESC
      LIMIT 15
    `;

    const gruposQuery = `
      SELECT 
        COALESCE(NULLIF(TRIM(h.tipo_trabajo), ''), NULLIF(TRIM(h.grupo_servicio), ''), 'OTROS') as grupo,
        COUNT(*) as total
      FROM historial_chats_mantra h
      WHERE ${whereSql}
      GROUP BY grupo
      ORDER BY total DESC
    `;

    const [
      [kpiRows],
      [palabraRows],
      [estadosRows],
      [asesoresRows],
      [gruposRows]
    ]: any = await Promise.all([
      pool.query(kpiQuery, params),
      pool.query(palabraQuery, params),
      pool.query(estadosQuery, params),
      pool.query(asesoresQuery, params),
      pool.query(gruposQuery, params)
    ]);

    res.json({
      success: true,
      kpis: kpiRows[0] || {},
      palabra: palabraRows || [],
      estados: estadosRows || [],
      asesores: asesoresRows || [],
      grupos: gruposRows || []
    });
  } catch (error: any) {
    console.error('Error en /api/4dm1n_/chats-dashboard-stats:', error);
    res.status(500).json({ success: false, message: 'Error consultando métricas del dashboard de chats' });
  }
});


// 2.5 Consultar historial en vivo de Mantra con división estricta en 3 segmentos: CLIENTE / ASESOR / PLANTILLA
router.get('/mantra-chat', async (req, res) => {
  try {
    const rawPhone = String(req.query.phone || '').trim().replace(/\D/g, '');
    const phone = rawPhone.length > 9 ? rawPhone.slice(-9) : rawPhone;
    const grupoServicio = String(req.query.grupoServicio || '').trim();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '15'), 10), 1), 50);

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Parámetro phone requerido' });
    }

    // Configuración dinámica según catálogo de plantillas config_plantillas_mantra
    let config = {
      GROUP_ID: process.env.MANTRA_DEFAULT_GROUP_ID || '',
      API_KEY: process.env.MANTRA_DEFAULT_API_KEY || ''
    };
    try {
      const [cfgRows]: any = await pool.query(
        `SELECT group_id, api_key FROM config_plantillas_mantra 
         WHERE (UPPER(TRIM(tipo_servicio)) = UPPER(TRIM(?)) OR nombre_alias LIKE ?) AND activo = 1 LIMIT 1`,
        [grupoServicio, `%${grupoServicio}%`]
      );
      if (cfgRows && cfgRows.length > 0 && cfgRows[0].group_id && cfgRows[0].api_key) {
        config = { GROUP_ID: cfgRows[0].group_id, API_KEY: cfgRows[0].api_key };
      } else if (grupoServicio.toLowerCase().includes('averia')) {
        config = {
          GROUP_ID: process.env.MANTRA_AVERIAS_GROUP_ID || config.GROUP_ID,
          API_KEY: process.env.MANTRA_AVERIAS_API_KEY || config.API_KEY
        };
      }
    } catch (e) {
      console.warn('Error resolviendo config dinámica de Mantra:', e);
    }

    if (!config.GROUP_ID || !config.API_KEY) {
      const isAveria = grupoServicio.toLowerCase().includes('averia');
      config = {
        GROUP_ID: isAveria ? '68508b455ba42fd0a6660300' : '685dc70e53dd0ac2492c69ca',
        API_KEY: isAveria ? '618684ea-0e61-478f-9b22-bc0fd8b8a934' : '3d0d59f1-f3ea-47be-b5b0-d7ffca33817d'
      };
      if (process.env.NODE_ENV === 'production') {
        console.warn('[SECURITY WARNING] Credenciales de Mantra obtenidas de fallback estático. Configure MANTRA_DEFAULT_* o la tabla config_plantillas_mantra.');
      }
    }

    const mantraRes = await fetch('https://wbpback2pro2.mantra.chat/contacts/chats/historial', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.API_KEY}`,
        'GroupId': config.GROUP_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        countryCode: '51',
        phone: phone,
        page: 1,
        limit: limit
      }),
      signal: AbortSignal.timeout(6500)
    });

    if (!mantraRes.ok) {
      const errText = await mantraRes.text();
      return res.status(mantraRes.status).json({ success: false, message: `Mantra API HTTP ${mantraRes.status}`, error: errText });
    }

    const mantraData = await mantraRes.json();
    const rawMessages: any[] = mantraData.data || [];

    const messages = rawMessages.map((m: any, idx: number) => {
      const text = m.content?.text || (m.content?.type ? `[${m.content.type}]` : '');
      const type = m.content?.type || 'text';
      const isClient = m.sender === 'contact';
      const humanAgent = m.agent?.name || m.sentByUser?.name || null;

      // Detección exhaustiva de PLANTILLA (Meta WhatsApp HSM / automatización)
      const isTemplate = !isClient && Boolean(
        type === 'template' || 
        text.includes('Adelanto') || 
        text.includes('Blindaje') || 
        text.includes('Trak_') ||
        text.includes('Confirmación de Visita') ||
        text.includes('enruta.win.pe') ||
        text.includes('go.win.pe') ||
        text.includes('Código de seguimiento') ||
        text.includes('La instalación de tu servicio WIN es hoy') ||
        text.includes('Estás a un paso de vivir la mejor experiencia') ||
        text.includes('Tu atención técnica de tu servicio WIN es hoy') ||
        text.includes('*¡Perfecto!*') ||
        text.includes('¡Perfecto!') ||
        text.startsWith('mcwa') ||
        (text.includes('| [') && text.includes(']')) ||
        Boolean(m.templateId)
      );

      // Estricta segmentación en 3 categorías solicitadas: CLIENTE / PLANTILLA / ASESOR
      const rol: 'CLIENTE' | 'PLANTILLA' | 'ASESOR' = isClient 
        ? 'CLIENTE' 
        : (isTemplate ? 'PLANTILLA' : 'ASESOR');

      return {
        orden: idx + 1,
        emisor: isClient ? 'CLIENTE' : (isTemplate ? 'PLANTILLA' : 'ASESOR'),
        emisor_rol: rol,
        texto: text,
        fecha_utc: m.createdAt,
        agente: humanAgent,
        tipo: type,
        es_plantilla: isTemplate,
        plantilla_nombre: isTemplate 
          ? (type === 'template' ? text : text.includes('Trak_') ? text : text.includes('Adelanto') ? 'Adelanto de Programación' : 'Plantilla Notificación WhatsApp') 
          : null
      };
    });

    res.json({
      success: true,
      phone,
      total: mantraData.total || messages.length,
      limit,
      source: 'mantra_live',
      messages
    });
  } catch (err: any) {
    console.error('Error en /api/4dm1n_/mantra-chat:', err);
    res.status(500).json({ success: false, message: err.message || 'Error consultando Mantra API' });
  }
});

router.get('/export', async (req, res) => {
  try {
    const tabla = String(req.query.tabla || 'principal').toLowerCase();
    const format = String(req.query.format || 'csv').toLowerCase();
    const search = String(req.query.search || '').trim();
    const fechaInicio = String(req.query.fechaInicio || '').trim();
    const fechaFin = String(req.query.fechaFin || '').trim();
    const serviceFilters = parseAdminServiceFilters(req.query.tipoServicio);
    const grupoServicio = String(req.query.grupoServicio || '').trim();
    let colFilters: Record<string, string> = {};
    try {
      if (req.query.colFilters) {
        colFilters = JSON.parse(String(req.query.colFilters));
      }
    } catch {
      colFilters = {};
    }
    const estadoChat = String(req.query.estadoChat || '').trim();
    const estadoOt = String(req.query.estadoOt || '').trim();
    const seEnvioWsp = String(req.query.seEnvioWsp || '').trim();
    const ingresoTracking = String(req.query.ingresoTracking || '').trim();
    const reprogramo = String(req.query.reprogramo || '').trim();
    const respondioEncuesta = String(req.query.respondioEncuesta || '').trim();
    const sortBy = String(req.query.sortBy || '').trim();
    const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const maxExportRows = 5000;
    const params: any[] = [];
    const countParams: any[] = [];
    let countQuery = '';
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
    } else if (tabla === 'chats_mantra' || tabla === 'historial_chats_mantra') {
      let whereClauses: string[] = ['1=1'];

      if (fechaInicio) {
        whereClauses.push('(h.fecha_gestion_dia >= ? OR DATE(CONVERT_TZ(h.ultimo_mensaje_fecha, "+00:00", "-05:00")) >= ?)');
        params.push(fechaInicio, fechaInicio);
        countParams.push(fechaInicio, fechaInicio);
      }
      if (fechaFin) {
        whereClauses.push('(h.fecha_gestion_dia <= ? OR DATE(CONVERT_TZ(h.ultimo_mensaje_fecha, "+00:00", "-05:00")) <= ?)');
        params.push(fechaFin, fechaFin);
        countParams.push(fechaFin, fechaFin);
      }
      const gruposChatsExport = parseGrupoServicio(grupoServicio);
      if (gruposChatsExport.length > 0) {
        const orParts: string[] = [];
        for (const g of gruposChatsExport) {
          if (g === 'Instalacion' || g === 'Averias') {
            orParts.push('h.grupo_servicio = ?');
            params.push(g);
            countParams.push(g);
          } else {
            orParts.push('(h.tipo_trabajo = ? OR h.grupo_servicio LIKE ?)');
            params.push(g, '%' + g + '%');
            countParams.push(g, '%' + g + '%');
          }
        }
        whereClauses.push('(' + orParts.join(' OR ') + ')');
      }

      const confirmacionCond = `(
        LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'si, confirmo%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'sí, confirmo%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'confirmado%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'confirmar%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'si, conforme%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'si conforme%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'si todo conforme%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'si'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'sí'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = '1'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'conforme'
      )`;

      const plantillaCond = `(
        h.quien_tiene_la_palabra = 'BOT' 
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'entiendo, gracias%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'entiendo gracias%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'otras opciones%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'ok'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'ok.'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'ok!'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'okey'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'oki'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'todo ok'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) = 'de acuerdo'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'ok gracias%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'ok, gracias%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'gracias por su respuesta%'
        OR LOWER(TRIM(h.ultimo_mensaje_texto)) LIKE 'se informa, muchas gracias%'
        OR h.ultimo_mensaje_texto LIKE '%Trak_%' 
        OR h.ultimo_mensaje_texto LIKE '%Adelanto%' 
        OR h.ultimo_mensaje_texto LIKE '%Blindaje%' 
        OR h.ultimo_mensaje_texto LIKE '%Confirmación%'
        OR h.ultimo_mensaje_texto LIKE '%Confirmacion%'
        OR h.ultimo_mensaje_texto LIKE '%enruta.win.pe%'
        OR h.ultimo_mensaje_texto LIKE '%| [%'
        OR h.ultimo_mensaje_texto LIKE '%Ad. Inc.%'
        OR h.ultimo_mensaje_texto LIKE '%Velocidad%'
        OR h.ultimo_mensaje_texto LIKE '%TRAKING%'
        OR h.ultimo_mensaje_texto LIKE '%Seguimiento de VT%'
        OR h.ultimo_mensaje_texto LIKE '%programaci%'
        OR h.ultimo_mensaje_texto LIKE '%gracias por confirmar%'
      )`;

      const allowedColsChats: Record<string, string> = {
        id: 'h.id',
        orden_id: 'h.orden_id',
        ticket: 'h.ticket',
        phone: 'h.phone',
        cliente: 'h.cliente_nombre',
        cliente_nombre: 'h.cliente_nombre',
        asesor: 'h.asesor_asignado',
        asesor_asignado: 'h.asesor_asignado',
        usuario: 'h.asesor_asignado',
        tipo_trabajo: 'h.tipo_trabajo',
        grupo_servicio: 'h.grupo_servicio',
        distrito: 'h.distrito',
        palabra: 'h.quien_tiene_la_palabra',
        quien_tiene_la_palabra: 'h.quien_tiene_la_palabra',
        estado_chat: 'h.estado_chat',
        semaforo_sla: 'h.semaforo_sla',
        mensaje: 'h.ultimo_mensaje_texto',
        ultimo_mensaje_texto: 'h.ultimo_mensaje_texto',
        ultimo_mensaje_fecha: 'h.ultimo_mensaje_fecha'
      };

      for (const [colKey, rawVal] of Object.entries(colFilters)) {
        let searchStr = '';
        let selectedArr: string[] = [];
        if (typeof rawVal === 'string') {
          searchStr = rawVal.trim();
        } else if (rawVal && typeof rawVal === 'object') {
          searchStr = String((rawVal as any).search || '').trim();
          if (Array.isArray((rawVal as any).selected)) {
            selectedArr = (rawVal as any).selected.map(String).filter(Boolean);
          }
        }

        if (colKey === 'quien_tiene_la_palabra' || colKey === 'palabra') {
          if (selectedArr.length > 0) {
            const orParts: string[] = [];
            if (selectedArr.includes('CONFIRMADO')) orParts.push(`(${confirmacionCond})`);
            if (selectedArr.includes('PLANTILLA')) orParts.push(`(${plantillaCond} AND NOT ${confirmacionCond})`);
            if (selectedArr.includes('CLIENTE')) orParts.push(`(h.quien_tiene_la_palabra = 'CLIENTE' AND NOT ${confirmacionCond} AND NOT ${plantillaCond})`);
            if (selectedArr.includes('ASESOR')) orParts.push(`(h.quien_tiene_la_palabra != 'CLIENTE' AND NOT ${plantillaCond} AND NOT ${confirmacionCond})`);
            if (orParts.length > 0) {
              whereClauses.push(`(${orParts.join(' OR ')})`);
            }
          } else if (searchStr) {
            if (searchStr.toUpperCase().includes('CONFIRM')) {
              whereClauses.push(`(${confirmacionCond})`);
            } else {
              whereClauses.push(`h.quien_tiene_la_palabra LIKE ?`);
              params.push(`%${searchStr}%`);
              countParams.push(`%${searchStr}%`);
            }
          }
          continue;
        }

        if (colKey === 'estado_chat') {
          if (selectedArr.length > 0) {
            const orParts: string[] = [];
            if (selectedArr.includes('Cerrado')) orParts.push(`(h.estado_chat = 'Cerrado' OR ${confirmacionCond})`);
            if (selectedArr.includes('Abierto')) orParts.push(`((h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) AND h.quien_tiene_la_palabra = 'CLIENTE' AND NOT ${confirmacionCond} AND NOT ${plantillaCond})`);
            if (selectedArr.includes('Pendiente')) orParts.push(`((h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) AND ${plantillaCond} AND NOT ${confirmacionCond})`);
            if (selectedArr.includes('Sin Respuesta')) orParts.push(`((h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) AND h.quien_tiene_la_palabra != 'CLIENTE' AND NOT ${plantillaCond} AND NOT ${confirmacionCond})`);
            if (orParts.length > 0) {
              whereClauses.push(`(${orParts.join(' OR ')})`);
            }
          } else if (searchStr) {
            whereClauses.push(`h.estado_chat LIKE ?`);
            params.push(`%${searchStr}%`);
            countParams.push(`%${searchStr}%`);
          }
          continue;
        }

        const sqlField = allowedColsChats[colKey];
        if (sqlField) {
          if (selectedArr.length > 0) {
            const placeholders = selectedArr.map(() => '?').join(',');
            whereClauses.push(`${sqlField} IN (${placeholders})`);
            params.push(...selectedArr);
            countParams.push(...selectedArr);
          } else if (searchStr) {
            whereClauses.push(`${sqlField} LIKE ?`);
            params.push(`%${searchStr}%`);
            countParams.push(`%${searchStr}%`);
          }
        }
      }

      if (search) {
        whereClauses.push('(h.orden_id LIKE ? OR h.ticket LIKE ? OR h.phone LIKE ? OR h.cliente_nombre LIKE ? OR h.ultimo_mensaje_texto LIKE ? OR h.asesor_asignado LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s, s, s, s);
        countParams.push(s, s, s, s, s, s);
      }

      if (estadoChat) {
        if (estadoChat === 'Cerrado') {
          whereClauses.push(`(h.estado_chat = 'Cerrado' OR ${confirmacionCond})`);
        } else if (estadoChat === 'Abierto') {
          whereClauses.push(`(h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) AND h.quien_tiene_la_palabra = 'CLIENTE' AND NOT ${confirmacionCond} AND NOT ${plantillaCond}`);
        } else if (estadoChat === 'Pendiente') {
          whereClauses.push(`(h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) AND ${plantillaCond} AND NOT ${confirmacionCond}`);
        } else if (estadoChat === 'Sin Respuesta') {
          whereClauses.push(`(h.estado_chat != 'Cerrado' OR h.estado_chat IS NULL) AND h.quien_tiene_la_palabra != 'CLIENTE' AND NOT ${plantillaCond} AND NOT ${confirmacionCond}`);
        }
      }

      const allowedSortCols: Record<string, string> = {
        id: 'h.id',
        orden_id: 'h.orden_id',
        ticket: 'h.ticket',
        phone: 'h.phone',
        cliente_nombre: 'h.cliente_nombre',
        asesor_asignado: 'h.asesor_asignado',
        usuario: 'h.asesor_asignado',
        grupo_servicio: 'h.grupo_servicio',
        tipo_trabajo: 'h.tipo_trabajo',
        distrito: 'h.distrito',
        provincia: 'h.provincia',
        quien_tiene_la_palabra: 'h.quien_tiene_la_palabra',
        estado_chat: 'h.estado_chat',
        semaforo_sla: 'h.semaforo_sla',
        ultimo_mensaje_texto: 'h.ultimo_mensaje_texto',
        ultimo_mensaje_fecha: 'h.ultimo_mensaje_fecha',
        fecha_gestion_dia: 'h.fecha_gestion_dia',
        total_mensajes: 'h.total_mensajes'
      };
      const orderCol = allowedSortCols[sortBy] || 'h.ultimo_mensaje_fecha';

      const whereSql = whereClauses.join(' AND ');
      countQuery = `SELECT COUNT(*) as total FROM historial_chats_mantra h WHERE ${whereSql}`;
      selectQuery = `
        SELECT 
          h.*,
          CASE 
            WHEN ${confirmacionCond} THEN 'CONFIRMADO'
            WHEN ${plantillaCond} THEN 'PLANTILLA'
            WHEN h.quien_tiene_la_palabra = 'CLIENTE' THEN 'CLIENTE'
            ELSE 'ASESOR'
          END AS quien_tiene_la_palabra,
          CASE
            WHEN h.estado_chat = 'Cerrado' OR ${confirmacionCond} THEN 'Cerrado'
            WHEN ${plantillaCond} THEN 'Pendiente'
            WHEN h.quien_tiene_la_palabra = 'CLIENTE' THEN 'Abierto'
            ELSE 'Sin Respuesta'
          END AS estado_chat,
          CASE
            WHEN ${confirmacionCond} OR h.estado_chat = 'Cerrado' OR ${plantillaCond} THEN 'VERDE'
            ELSE COALESCE(h.semaforo_sla, 'VERDE')
          END AS semaforo_sla
        FROM historial_chats_mantra h
        WHERE ${whereSql}
        ORDER BY ${orderCol} ${sortOrder}, h.id DESC
        LIMIT ${maxExportRows}
      `;
    } else if (tabla === 'reporte' || tabla === 'vw_reporte_funnel_casos_360') {
      let whereClauses: string[] = ['1=1'];
      if (fechaInicio) {
        whereClauses.push('r.fecha_visita >= ?');
        params.push(`${fechaInicio} 00:00:00`);
      }
      if (fechaFin) {
        whereClauses.push('r.fecha_visita <= ?');
        params.push(`${fechaFin} 23:59:59`);
      }
      const serviceCond = buildServiceFilterSql(serviceFilters, 'reporte');
      const gruposReporteExport = parseGrupoServicio(grupoServicio);
      const grupoRepExpCond = buildGrupoServicioReporteFilter(gruposReporteExport);
      if (grupoRepExpCond) {
        whereClauses.push(grupoRepExpCond.sql);
        params.push(...grupoRepExpCond.values);
      }
      if (serviceCond) {
        whereClauses.push(serviceCond.sql);
        params.push(...serviceCond.values);
      }
      if (estadoOt) {
        whereClauses.push('r.estado_ot = ?');
        params.push(estadoOt);
      }
      if (seEnvioWsp) {
        whereClauses.push('r.se_envio_wsp = ?');
        params.push(seEnvioWsp);
      }
      if (ingresoTracking) {
        whereClauses.push('r.ingreso_tracking = ?');
        params.push(ingresoTracking);
      }
      if (reprogramo) {
        whereClauses.push('r.reprogramo = ?');
        params.push(reprogramo);
      }
      if (respondioEncuesta) {
        whereClauses.push('r.respondio_encuesta = ?');
        params.push(respondioEncuesta);
      }
      if (search) {
        whereClauses.push('(r.orden_id LIKE ? OR r.ticket LIKE ? OR r.cliente LIKE ? OR r.telefono LIKE ? OR r.distrito LIKE ? OR r.token_tracking LIKE ? OR r.cuadrilla LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s, s, s, s, s);
      }
      for (const [colKey, colVal] of Object.entries(colFilters)) {
        const allowedColsReporte: Record<string, string> = {
          orden_id: 'r.orden_id',
          ticket: 'r.ticket',
          cliente: 'r.cliente',
          telefono: 'r.telefono',
          producto: 'r.producto',
          tipo_operacion: 'r.tipo_operacion',
          estado_ot: 'r.estado_ot',
          distrito: 'r.distrito',
          cuadrilla: 'r.cuadrilla'
        };
        const sqlField = allowedColsReporte[colKey];
        const valStr = String(colVal || '').trim();
        if (sqlField && valStr) {
          whereClauses.push(`${sqlField} LIKE ?`);
          params.push(`%${valStr}%`);
        }
      }

      const allowedSortCols: Record<string, string> = {
        orden_id: 'r.orden_id',
        ticket: 'r.ticket',
        cliente: 'r.cliente',
        telefono: 'r.telefono',
        producto: 'r.producto',
        tipo_operacion: 'r.tipo_operacion',
        tipo_trabajo: 'r.tipo_trabajo',
        estado_ot: 'r.estado_ot',
        fecha_visita: 'r.fecha_visita',
        distrito: 'r.distrito',
        cuadrilla: 'r.cuadrilla'
      };
      const orderCol = allowedSortCols[sortBy] || 'r.fecha_visita';

      selectQuery = `
        SELECT r.*
        FROM vw_reporte_funnel_casos_360 r
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY ${orderCol} ${sortOrder}, r.orden_id DESC
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
      const serviceCond = buildServiceFilterSql(serviceFilters, 'principal');
      if (serviceCond) {
        whereClauses.push(serviceCond.sql);
        params.push(...serviceCond.values);
      }
      if (search) {
        whereClauses.push('(w.OrdenId LIKE ? OR w.Cliente LIKE ? OR w.`Número Documento` LIKE ? OR w.token LIKE ? OR w.CodiSegui LIKE ? OR w.Direccion LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s, s, s, s);
      }
      const gruposPrincipalExport = parseGrupoServicio(grupoServicio);
      const grupoPrinExpCond = buildGrupoServicioPrincipalFilter(gruposPrincipalExport);
      if (grupoPrinExpCond) {
        whereClauses.push(grupoPrinExpCond.sql);
        params.push(...grupoPrinExpCond.values);
      }
      const allowedColsPrincipal: Record<string, string> = {
        orden_id: 'w.OrdenId',
        OrdenId: 'w.OrdenId',
        cliente: 'w.Cliente',
        Cliente: 'w.Cliente',
        documento: 'w.`Número Documento`',
        NumeroDocumento: 'w.`Número Documento`',
        'Número Documento': 'w.`Número Documento`',
        tipo_servicio: 'COALESCE(ts_prod.Tipo, ts_traba.Tipo, w.TipoTraba)',
        TipoServicioCalculado: 'COALESCE(ts_prod.Tipo, ts_traba.Tipo, w.TipoTraba)',
        tipo_trabajo: 'w.TipoTraba',
        TipoTraba: 'w.TipoTraba',
        producto: 'w.Producto',
        Producto: 'w.Producto',
        estado: 'w.Estado',
        Estado: 'w.Estado',
        fecha_visita: 'w.`F.Visita`',
        FechaVisita: 'w.`F.Visita`',
        direccion: 'w.Direccion',
        Direccion: 'w.Direccion',
        distrito: 'COALESCE(NULLIF(TRIM(w.Zona), \'\'), w.Localidad)',
        Localidad: 'COALESCE(NULLIF(TRIM(w.Zona), \'\'), w.Localidad)',
        Zona: 'COALESCE(NULLIF(TRIM(w.Zona), \'\'), w.Localidad)',
        cuadrilla: 'w.Cuadrilla',
        Cuadrilla: 'w.Cuadrilla',
        tecnico: 'w.Cuadrilla_nombre',
        Cuadrilla_nombre: 'w.Cuadrilla_nombre',
        pin: 'w.Pin_token',
        Pin_token: 'w.Pin_token',
        token: 'w.token'
      };
      for (const [colKey, colVal] of Object.entries(colFilters)) {
        if (!colVal) continue;
        const searchStr = typeof colVal === 'string' ? colVal.trim() : String((colVal as any).search || '').trim();
        const selectedArr: string[] = typeof colVal === 'object' && Array.isArray((colVal as any).selected)
          ? (colVal as any).selected.filter(Boolean)
          : [];
        if (!searchStr && selectedArr.length === 0) continue;

        const sqlField = allowedColsPrincipal[colKey];
        if (sqlField) {
          if (selectedArr.length > 0) {
            const placeholders = selectedArr.map(() => '?').join(',');
            whereClauses.push(`${sqlField} IN (${placeholders})`);
            params.push(...selectedArr);
          } else if (searchStr) {
            whereClauses.push(`${sqlField} LIKE ?`);
            params.push(`%${searchStr}%`);
          }
        }
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


// ==========================================
// 8. GESTIÓN DE USUARIOS Y ROLES (/api/4dm1n_/users)
// ==========================================
router.get('/users', async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT IDuser, Nombre, Documento, Telefono, Email, Usuario, Area, Rol, Activo, created_at, updated_at FROM user ORDER BY IDuser DESC'
    );
    return res.json({ success: true, users: rows });
  } catch (error: any) {
    console.error('Error obteniendo usuarios:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar usuarios', error: error?.message });
  }
});

router.post('/users', async (req, res) => {
  const { Nombre, Documento, Telefono, Email, Usuario, Password, Area, Rol } = req.body;
  if (!Nombre || !Documento || !Email || !Usuario || !Password || !Area || !Rol) {
    return res.status(400).json({ success: false, message: 'Faltan campos obligatorios para registrar el usuario' });
  }

  const validAreas = ['INSTALACION', 'PROVINCIA', 'AVERIAS', 'ADMIN'];
  const validRoles = ['ADMIN', 'SUPERVISOR', 'COORDINADOR', 'ASESOR'];

  if (!validAreas.includes(Area)) {
    return res.status(400).json({ success: false, message: `Área inválida. Debe ser una de: ${validAreas.join(', ')}` });
  }

  if (!validRoles.includes(Rol)) {
    return res.status(400).json({ success: false, message: `Rol inválido. Debe ser uno de: ${validRoles.join(', ')}` });
  }

  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(String(Password).trim(), salt, 10000, 64, 'sha512').toString('hex');
    const passwordHash = `${salt}:${hash}`;

    const [result]: any = await pool.query(
      `INSERT INTO user (Nombre, Documento, Telefono, Email, Usuario, Password, Area, Rol, Activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [Nombre.trim(), Documento.trim(), Telefono ? Telefono.trim() : null, Email.trim(), Usuario.trim(), passwordHash, Area, Rol]
    );

    return res.json({
      success: true,
      message: 'Usuario registrado exitosamente',
      userId: result.insertId
    });
  } catch (error: any) {
    console.error('Error creando usuario:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'El Documento, Email o Usuario ya se encuentra registrado' });
    }
    return res.status(500).json({ success: false, message: 'Error interno al registrar usuario', error: error?.message });
  }
});

router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { Nombre, Documento, Telefono, Email, Usuario, Password, Area, Rol, Activo } = req.body;

  const validAreas = ['INSTALACION', 'PROVINCIA', 'AVERIAS', 'ADMIN'];
  const validRoles = ['ADMIN', 'SUPERVISOR', 'COORDINADOR', 'ASESOR'];

  if (Area && !validAreas.includes(Area)) {
    return res.status(400).json({ success: false, message: 'Área inválida' });
  }

  if (Rol && !validRoles.includes(Rol)) {
    return res.status(400).json({ success: false, message: 'Rol inválido' });
  }

  try {
    const updates: string[] = [];
    const params: any[] = [];

    if (Nombre) { updates.push('Nombre = ?'); params.push(Nombre.trim()); }
    if (Documento) { updates.push('Documento = ?'); params.push(Documento.trim()); }
    if (Telefono !== undefined) { updates.push('Telefono = ?'); params.push(Telefono ? Telefono.trim() : null); }
    if (Email) { updates.push('Email = ?'); params.push(Email.trim()); }
    if (Usuario) { updates.push('Usuario = ?'); params.push(Usuario.trim()); }
    if (Area) { updates.push('Area = ?'); params.push(Area); }
    if (Rol) { updates.push('Rol = ?'); params.push(Rol); }
    if (Activo !== undefined) { updates.push('Activo = ?'); params.push(Activo ? 1 : 0); }

    if (Password && String(Password).trim()) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(String(Password).trim(), salt, 10000, 64, 'sha512').toString('hex');
      updates.push('Password = ?');
      params.push(`${salt}:${hash}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
    }

    params.push(id);
    await pool.query(`UPDATE user SET ${updates.join(', ')} WHERE IDuser = ?`, params);

    return res.json({ success: true, message: 'Usuario actualizado correctamente' });
  } catch (error: any) {
    console.error('Error actualizando usuario:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'El Documento, Email o Usuario ya se encuentra registrado' });
    }
    return res.status(500).json({ success: false, message: 'Error interno al actualizar usuario', error: error?.message });
  }
});

router.put('/users/:id/estado', async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;
  try {
    await pool.query('UPDATE user SET Activo = ? WHERE IDuser = ?', [activo ? 1 : 0, id]);
    return res.json({ success: true, message: 'Estado de usuario actualizado con éxito' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Error al actualizar estado', error: error?.message });
  }
});

export default router;
