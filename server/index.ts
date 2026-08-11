import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import replicationRouter from './replicationReceiver.ts';
import apiRoutes from './routes/apiRoutes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3001', 10);

// SEGURIDAD: CORS estricto basado en variable de entorno
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({ origin: ALLOWED_ORIGIN }));

app.use(express.json());

// Registrar rutas de replicación en tiempo real
app.use(replicationRouter);

// Registrar Rutas de la API (Arquitectura por Capas)
app.use('/api', apiRoutes);

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor API corriendo en http://0.0.0.0:${port}`);
  console.log(`🔒 CORS configurado para: ${ALLOWED_ORIGIN}`);
});