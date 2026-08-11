import { Request, Response } from 'express';
import pool from '../db.ts';
import { replicateChange } from '../replicationService.ts';
import { getLimaDateTime, parseUserAgent } from '../utils/helpers.ts';

const CAPA_INTERMEDIA_URL = process.env.CAPA_INTERMEDIA_URL || 'http://localhost:4001';
// Ya no usamos fallback estricto aquí por seguridad, depende estrictamente del .env
const SECRET_API_KEY = process.env.SECRET_API_KEY || '';

export const reprogramar = async (req: Request, res: Response): Promise<any> => {
  const { token, fecha, turno, motivo } = req.body;
  if (!token || !fecha || !turno) return res.status(400).json({ success: false, message: 'Faltan datos obligatorios' });

  try {
    const query = `INSERT INTO REPROGRAMACIONES (token, fecha_solicitada, turno, motivo) VALUES (?, ?, ?, ?)`;
    await pool.query(query, [token, fecha, turno, motivo || '']);
    replicateChange('REPROGRAMACIONES', 'INSERT', { token, fecha_solicitada: fecha, turno, motivo: motivo || '' });
    res.json({ success: true, message: 'Reprogramación guardada con éxito' });
  } catch (error) {
    console.error('Error guardando en BD:', error);
    res.status(500).json({ success: false, message: 'Error interno guardando la solicitud' });
  }
};

export const guardarEncuesta = async (req: Request, res: Response): Promise<any> => {
  const { 
    token, instalacion_concretada, tecnico_trato, tecnico_puntualidad, tecnico_claridad, 
    tecnico_orden, tecnico_efectividad, satisfaccion_general, satisfaccion_comentario, 
    facilidad_gestion, facilidad_motivo 
  } = req.body;

  if (!token || !satisfaccion_general) return res.status(400).json({ success: false, message: 'Faltan datos obligatorios' });

  try {
    const query = `INSERT INTO ENCUESTAS (token, instalacion_concretada, tecnico_trato, tecnico_puntualidad, tecnico_claridad, tecnico_orden, tecnico_efectividad, satisfaccion_general, satisfaccion_comentario, facilidad_gestion, facilidad_motivo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await pool.query(query, [
      token, instalacion_concretada, tecnico_trato, tecnico_puntualidad, tecnico_claridad, 
      tecnico_orden, tecnico_efectividad, satisfaccion_general, satisfaccion_comentario, 
      facilidad_gestion, facilidad_motivo
    ]);
    replicateChange('ENCUESTAS', 'INSERT', {
      token, instalacion_concretada, tecnico_trato, tecnico_puntualidad, tecnico_claridad, 
      tecnico_orden, tecnico_efectividad, satisfaccion_general, satisfaccion_comentario, 
      facilidad_gestion, facilidad_motivo
    });
    res.json({ success: true, message: 'Encuesta guardada con éxito' });
  } catch (error) {
    console.error('Error guardando encuesta:', error);
    res.status(500).json({ success: false, message: 'Error interno guardando la encuesta' });
  }
};

export const verificarEncuesta = async (req: Request, res: Response) => {
  const { token } = req.params;
  try {
    const [rows]: any = await pool.query('SELECT id FROM ENCUESTAS WHERE token = ? LIMIT 1', [token]);
    res.json({ success: true, completada: rows.length > 0 });
  } catch (error) {
    console.error('Error verificando encuesta:', error);
    res.status(500).json({ success: false, completada: false });
  }
};

export const guardarLog = async (req: Request, res: Response): Promise<any> => {
  const { token, evento, detalles } = req.body;
  if (!token || !evento) return res.status(400).json({ success: false, message: 'Faltan datos' });

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const ip_address = Array.isArray(ip) ? ip[0] : (typeof ip === 'string' ? ip.split(',')[0].trim() : '');
  const { navegador, sistema_operativo } = parseUserAgent(req.headers['user-agent'] || '');
  const limaTime = getLimaDateTime();

  try {
    let esPrimeraVisita = false;
    if (evento === 'ver_seguimiento_instalacion') {
      const [rows]: any = await pool.query("SELECT id FROM LOGS_TRAKING WHERE token = ? AND evento = 'primera_visita' LIMIT 1", [token]);
      esPrimeraVisita = rows.length === 0;
    }

    if (esPrimeraVisita) {
      await pool.query(
        `INSERT INTO LOGS_TRAKING (token, evento, ip_address, detalles, sistema_operativo, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [token, 'primera_visita', ip_address, detalles ? JSON.stringify(detalles) : null, sistema_operativo, limaTime, limaTime]
      );
      replicateChange('LOGS_TRAKING', 'INSERT', { token, evento: 'primera_visita', ip_address, detalles: detalles ? JSON.stringify(detalles) : null, sistema_operativo, timestamp: limaTime, created_at: limaTime });
    }

    await pool.query(
      `INSERT INTO LOGS_TRAKING (token, evento, ip_address, detalles, sistema_operativo, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [token, evento, ip_address, detalles ? JSON.stringify(detalles) : null, sistema_operativo, limaTime, limaTime]
    );
    replicateChange('LOGS_TRAKING', 'INSERT', { token, evento, ip_address, detalles: detalles ? JSON.stringify(detalles) : null, sistema_operativo, timestamp: limaTime, created_at: limaTime });

    res.json({ success: true });  
  } catch (error) {
    console.error('Error guardando log:', error);
    res.status(500).json({ success: false, message: 'Error interno guardando el log' });
  }
};

export const getInstalacion = async (req: Request, res: Response): Promise<any> => {
  const { token } = req.params;
  try {
    if(!SECRET_API_KEY) console.warn("ALERTA: SECRET_API_KEY no definida en el entorno (.env)");
    
    const response = await fetch(`${CAPA_INTERMEDIA_URL}/api/v1/terceros/instalaciones/${token}`, {
      headers: { 'Authorization': `Bearer ${SECRET_API_KEY}` }
    });
    if (!response.ok) return res.status(response.status).json(await response.json());
    res.json(await response.json());
  } catch (error) {
    console.error('Error capa intermedia:', error);
    res.status(500).json({ success: false, message: 'Error interno', error });
  }
};

export const getRoute = async (req: Request, res: Response): Promise<any> => {
  const { start, end } = req.body;
  if (!start || !end) return res.status(400).json({ success: false, message: 'Faltan coordenadas' });

  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_API_KEY) return res.status(500).json({ success: false, message: 'API Key de Google no configurada' });

    const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.polyline.encodedPolyline'
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: start[0], longitude: start[1] } } },
        destination: { location: { latLng: { latitude: end[0], longitude: end[1] } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        routeModifiers: { avoidTolls: false, avoidHighways: false, avoidFerries: false },
        languageCode: "es-419",
        units: "METRIC"
      })
    });

    const data: any = await response.json();
    if (response.ok && data.routes?.length > 0) {
      const route = data.routes[0];
      const durationSeconds = parseInt((route.duration || "0s").replace('s', ''), 10);
      res.json({ success: true, durationSeconds, polyline: route.polyline.encodedPolyline });
    } else {
      res.status(400).json({ success: false, message: data.error?.message || 'Error en Google Routes API' });
    }
  } catch (error) {
    console.error('Error calculando ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
};
