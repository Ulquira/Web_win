import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.ts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// URLs para los servicios internos
const CAPA_INTERMEDIA_URL = 'http://localhost:4001';
const SECRET_API_KEY = process.env.SECRET_API_KEY || "LLAVE_SECRETA_DEL_TERCERO_123";

app.use(cors({ origin: '*' }));
app.use(express.json());

// Endpoint para guardar reprogramaciones en BD
app.post('/api/reprogramar', async (req, res) => {
  const { token, fecha, turno, motivo } = req.body;

  if (!token || !fecha || !turno) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios' });
  }

  try {
    const query = `
      INSERT INTO REPROGRAMACIONES (token, fecha_solicitada, turno, motivo)
      VALUES (?, ?, ?, ?)
    `;
    await pool.query(query, [token, fecha, turno, motivo || '']);

    res.json({ success: true, message: 'Reprogramación guardada con éxito' });
  } catch (error) {
    console.error('Error guardando en BD:', error);
    res.status(500).json({ success: false, message: 'Error interno guardando la solicitud' });
  }
});

// Endpoint para guardar Encuestas en BD
app.post('/api/encuesta', async (req, res) => {
  const { 
    token, llego_horario, calificacion_tecnico, explicacion_clara, 
    tiempo_adecuado, informacion_clara, probabilidad_recomendar, comentarios 
  } = req.body;

  if (!token || !probabilidad_recomendar) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios' });
  }

  try {
    const query = `
      INSERT INTO ENCUESTAS (token, llego_horario, calificacion_tecnico, explicacion_clara, tiempo_adecuado, informacion_clara, probabilidad_recomendar, comentarios)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await pool.query(query, [
      token, 
      llego_horario || null, 
      calificacion_tecnico || null, 
      explicacion_clara || null, 
      tiempo_adecuado || null, 
      informacion_clara || null, 
      probabilidad_recomendar, 
      comentarios || ''
    ]);

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

// Obtener detalles de una instalación por token
app.get('/api/instalaciones/:token', async (req, res) => {
  const { token } = req.params;

  try {
    // Este servidor ahora llama a la capa intermedia segura
    const response = await fetch(`${CAPA_INTERMEDIA_URL}/api/v1/terceros/instalaciones/${token}`, {
      headers: {
        'Authorization': `Bearer ${SECRET_API_KEY}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Error al conectar con la capa intermedia:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor', error });
  }
});

// Endpoint para calcular la ruta con tráfico real usando Google Maps API
app.post('/api/route', async (req, res) => {
  const { start, end } = req.body;

  if (!start || !end) {
    return res.status(400).json({ success: false, message: 'Faltan coordenadas de inicio y fin' });
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

      res.json({ success: true, durationSeconds, polyline });
    } else {
      res.status(400).json({ success: false, message: data.error?.message || 'Error en Google Routes API' });
    }
  } catch (error: any) {
    console.error('Error calculando ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno calculando ruta' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor API corriendo en http://0.0.0.0:${port}`);
});