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

app.use(cors({ origin: '*' }));
app.use(express.json());

// Endpoint para guardar reprogramaciones en un CSV
app.post('/api/reprogramar', (req, res) => {
  const { dni, fecha, turno, motivo } = req.body;

  if (!dni || !fecha || !turno) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios' });
  }

  try {
    const csvPath = path.join(__dirname, 'reprogramaciones.csv');
    const timestamp = new Date().toISOString();
    const cleanMotivo = (motivo || '').replace(/,/g, ' '); // Limpiar comas para no romper el CSV

    // Si el archivo no existe, le ponemos las cabeceras
    if (!fs.existsSync(csvPath)) {
      fs.writeFileSync(csvPath, 'FECHA_REGISTRO,DNI,NUEVA_FECHA_SOLICITADA,TURNO,MOTIVO\n', 'utf8');
    }

    // Agregar la nueva línea
    const csvLine = `${timestamp},${dni},${fecha},${turno},${cleanMotivo}\n`;
    fs.appendFileSync(csvPath, csvLine, 'utf8');

    res.json({ success: true, message: 'Reprogramación guardada con éxito' });
  } catch (error) {
    console.error('Error guardando en CSV:', error);
    res.status(500).json({ success: false, message: 'Error interno guardando la solicitud' });
  }
});

// Endpoint para guardar Encuestas en un CSV
app.post('/api/encuesta', (req, res) => {
  const { 
    dni, llego_horario, calificacion_tecnico, explicacion_clara, 
    tiempo_adecuado, informacion_clara, probabilidad_recomendar, comentarios 
  } = req.body;

  if (!dni || !probabilidad_recomendar) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios' });
  }

  try {
    const csvPath = path.join(__dirname, 'encuestas.csv');
    const timestamp = new Date().toISOString();
    const cleanComments = (comentarios || '').replace(/,/g, ' ');

    if (!fs.existsSync(csvPath)) {
      fs.writeFileSync(csvPath, 'FECHA_REGISTRO,DNI,LLEGO_A_TIEMPO,CALIFICACION_TECNICO,EXPLICACION_CLARA,TIEMPO_INSTALACION,INFO_CLARA,NPS,COMENTARIOS\n', 'utf8');
    }

    const csvLine = `${timestamp},${dni},${llego_horario},${calificacion_tecnico},${explicacion_clara},${tiempo_adecuado},${informacion_clara},${probabilidad_recomendar},${cleanComments}\n`;
    fs.appendFileSync(csvPath, csvLine, 'utf8');

    res.json({ success: true, message: 'Encuesta guardada con éxito' });
  } catch (error) {
    console.error('Error guardando encuesta en CSV:', error);
    res.status(500).json({ success: false, message: 'Error interno guardando la encuesta' });
  }
});

// Endpoint para verificar si un DNI ya llenó la encuesta
app.get('/api/encuesta/verificar/:dni', (req, res) => {
  const { dni } = req.params;
  try {
    const csvPath = path.join(__dirname, 'encuestas.csv');
    if (!fs.existsSync(csvPath)) {
      return res.json({ success: true, completada: false });
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    // Buscamos si el DNI existe en alguna línea (usando comas para asegurar coincidencia exacta de columna)
    const lineas = content.split('\n');
    const completada = lineas.some(linea => linea.includes(`,${dni},`));

    res.json({ success: true, completada });
  } catch (error) {
    console.error('Error verificando encuesta:', error);
    res.status(500).json({ success: false, completada: false });
  }
});

// Obtener detalles de una instalación por DNI
app.get('/api/instalaciones/:dni', async (req, res) => {
  const { dni } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT Estado, SubEstado, Cuadrilla, coordenadas_direccion, Ubi_TEC, telefono, fecha_programacion, Tramo_Atencio 
       FROM OPERACION 
       WHERE dni_cliente = ? 
       ORDER BY fecha_programacion DESC LIMIT 1`, 
      [dni]
    );

    const instalaciones = rows as any[];

    if (instalaciones.length === 0) {
      return res.status(404).json({ success: false, message: 'Instalación no encontrada' });
    }

    const op = instalaciones[0];

    // Mapeamos el estado real de tu BBDD a los estados que entiende el frontend
    // Esto es un ejemplo, puedes ajustar las palabras según lo que guardes en 'Estado'
    let statusFront = 'programada';
    const estadoDB = (op.Estado || '').toUpperCase();
    
    // Mapeo real de los estados de tu BBDD a los del Front
    if (estadoDB === 'PENDIENTE') {
      // Pendiente en la BD ahora significa Programada visualmente (el primer paso)
      statusFront = 'programada';
    } else if (estadoDB === 'PROGRAMADO') {
      // Si está programado pero YA tiene cuadrilla asignada pasa al 2do paso visual
      if (op.Cuadrilla && op.Cuadrilla.trim() !== '') {
        statusFront = 'asignado';
      } else {
        statusFront = 'programada';
      }
    } else if (estadoDB === 'EN CAMINO') {
      statusFront = 'en_camino';
    } else if (estadoDB === 'EN PROCESO') {
      statusFront = 'en_proceso';
    } else if (estadoDB === 'FINALIZADO') {
      statusFront = 'finalizada';
    } else if (['AUSENTE', 'CANCELADO', 'DULPLICADO', 'INASISTENCIA', 'PEXT', 'REPROGRAMA'].includes(estadoDB)) {
      statusFront = 'cerrada';
    }

    // Extraemos la latitud y longitud si existen
    let coordsCliente = null;
    let coordsTecnico = null;

    try {
      if (op.coordenadas_direccion) {
        const parts = op.coordenadas_direccion.split(',');
        if (parts.length === 2) coordsCliente = [parseFloat(parts[0]), parseFloat(parts[1])];
      }
      if (op.Ubi_TEC) {
        const parts = op.Ubi_TEC.split(',');
        if (parts.length === 2) coordsTecnico = [parseFloat(parts[0]), parseFloat(parts[1])];
      }
    } catch(e) {}

    const responseData: any = {
      status: statusFront,
      eta: op.SubEstado ? op.SubEstado : null, 
      trafico: null,
      coordenadas_cliente: coordsCliente,
      coordenadas_tecnico: coordsTecnico,
      fecha_programacion: op.fecha_programacion,
      tramo: op.Tramo_Atencio
    };

    // Agregar datos del técnico (Cuadrilla en tu caso)
    if (op.Cuadrilla) {
      responseData.tecnico = {
        nombre: op.Cuadrilla, // Usamos cuadrilla como nombre ya que no hay 'nombre_tecnico'
        cuadrilla: op.Cuadrilla,
        telefono: op.telefono || 'Central'
      };
    }

    res.json({
      success: true,
      data: responseData,
      raw_db: op // Enviamos los datos crudos para depuración
    });

  } catch (error) {
    console.error('Error al consultar la base de datos:', error);
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

    const data = await response.json();

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

app.listen(port, () => {
  console.log(`🚀 Servidor API corriendo en http://localhost:${port}`);
});