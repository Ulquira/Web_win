import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from '../server/db.ts'; // Solo esta capa accede a la DB real
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = 4001; // Corre en un puerto distinto, oculto del mundo exterior

app.use(cors());
app.use(express.json());

// Un token súper secreto que viene de las variables de entorno
const SECRET_API_KEY = process.env.SECRET_API_KEY || "LLAVE_SECRETA_DEL_TERCERO_123";

// Middleware para verificar que quien llama es el "Tercero" autorizado
const verificarTercero = (req: any, res: any, next: any) => {
  const token = req.headers['authorization'];
  if (token !== `Bearer ${SECRET_API_KEY}`) {
    return res.status(401).json({ error: "Acceso denegado. Tercero no autorizado." });
  }
  next();
};

// Endpoint interno: Solo sirve los datos estrictamente necesarios al tercero
app.get('/api/v1/terceros/instalaciones/:token', verificarTercero, async (req, res) => {
  const { token } = req.params;

  try {
    // ESTA CAPA ES LA ÚNICA QUE TOCA MYSQL
    const [rows] = await pool.query(
      `SELECT idoperacion, Estado, SubEstado, Cuadrilla, coordenadas_direccion, Ubi_TEC, telefono, fecha_programacion, Tramo_Atencio, nom_cliente, direccion_cliente, Campaña, Token_inicio 
       FROM OPERACION 
       WHERE token_seguimiento = ? 
       ORDER BY fecha_programacion DESC LIMIT 1`, 
      [token]
    );

    const instalaciones = rows as any[];

    if (instalaciones.length === 0) {
      return res.status(404).json({ success: false, message: 'Instalación no encontrada' });
    }

    const op = instalaciones[0];

    // Mapeamos el estado real de tu BBDD a los estados que entiende el frontend del tercero
    let statusFront = 'programada';
    const estadoDB = (op.Estado || '').toUpperCase();
    
    if (estadoDB === 'PENDIENTE') {
      statusFront = 'programada';
    } else if (estadoDB === 'PROGRAMADO') {
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

    // Generar Token de Inicio si está en camino y no lo tiene
    let tokenInicio = op.Token_inicio;
    if (statusFront === 'en_camino' && !tokenInicio) {
      tokenInicio = Math.floor(1000 + Math.random() * 9000).toString();
      try {
        await pool.query('UPDATE OPERACION SET Token_inicio = ? WHERE idoperacion = ?', [tokenInicio, op.idoperacion]);
      } catch (err) {
        console.error('Error al guardar el token de inicio:', err);
      }
    }

    const responseData: any = {
      idoperacion: op.idoperacion,
      status: statusFront,
      eta: op.SubEstado ? op.SubEstado : null, 
      trafico: null,
      coordenadas_cliente: coordsCliente,
      coordenadas_tecnico: coordsTecnico,
      fecha_programacion: op.fecha_programacion,
      tramo: op.Tramo_Atencio,
      cliente_nombre: op.nom_cliente,
      direccion: op.direccion_cliente,
      campana: op.Campaña,
      token_inicio: tokenInicio || null
    };

    if (op.Cuadrilla) {
      responseData.tecnico = {
        nombre: op.Cuadrilla,
        cuadrilla: op.Cuadrilla,
        telefono: op.telefono || 'Central'
      };
    }

    // Le devolvemos al tercero solo la info limpia que necesita
    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error DB en Capa Intermedia:', error);
    res.status(500).json({ success: false, message: 'Error en la red corporativa' });
  }
});

// Endpoint para guardar Encuestas (Oculto al mundo exterior directo sin llave)
app.post('/api/encuesta', verificarTercero, async (req, res) => {
  const { 
    token, llego_horario, calificacion_tecnico, explicacion_clara, 
    tiempo_adecuado, informacion_clara, probabilidad_recomendar, comentarios 
  } = req.body;

  if (!token || !probabilidad_recomendar) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios' });
  }

  try {
    const csvPath = path.join(__dirname, '../server/encuestas.csv');
    const timestamp = new Date().toISOString();
    const cleanComments = (comentarios || '').replace(/,/g, ' ');

    if (!fs.existsSync(csvPath)) {
      await fs.promises.writeFile(csvPath, 'FECHA_REGISTRO,TOKEN,LLEGO_A_TIEMPO,CALIFICACION_TECNICO,EXPLICACION_CLARA,TIEMPO_INSTALACION,INFO_CLARA,NPS,COMENTARIOS\n', 'utf8');
    }

    const csvLine = `${timestamp},${token},${llego_horario},${calificacion_tecnico},${explicacion_clara},${tiempo_adecuado},${informacion_clara},${probabilidad_recomendar},${cleanComments}\n`;
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

// Endpoint para guardar reprogramaciones (Oculto al mundo exterior)
app.post('/api/reprogramar', verificarTercero, async (req, res) => {
  const { token, fecha, turno, motivo } = req.body;

  if (!token || !fecha || !turno) {
    return res.status(400).json({ success: false, message: 'Faltan datos obligatorios' });
  }

  try {
    const csvPath = path.join(__dirname, '../server/reprogramaciones.csv');
    const timestamp = new Date().toISOString();
    const cleanMotivo = (motivo || '').replace(/,/g, ' ');

    if (!fs.existsSync(csvPath)) {
      await fs.promises.writeFile(csvPath, 'FECHA_REGISTRO,TOKEN,NUEVA_FECHA_SOLICITADA,TURNO,MOTIVO\n', 'utf8');
    }

    const csvLine = `${timestamp},${token},${fecha},${turno},${cleanMotivo}\n`;
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
      body: JSON.stringify(requestBody)
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

app.listen(port, '0.0.0.0', () => {
  console.log(`🛡️ Capa Intermedia de tu Empresa (Segura) corriendo en puerto ${port}`);
});
