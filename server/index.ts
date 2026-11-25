import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import pool from './db.ts';
import replicationRouter from './replicationReceiver.ts';
import clientRoutes from './routes/clientRoutes.ts';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3001', 10);
const host = process.env.HOST || '0.0.0.0';

// Seguridad y Confianza (Cloud Run / Azure App Service)
app.set('trust proxy', 1);
app.use(helmet());

app.use(cors({ 
  origin: process.env.FRONTEND_URL || '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-principal' });
});

// Registrar rutas de replicación en tiempo real (receptor)
app.use(replicationRouter);

// Rutas públicas de seguimiento y cliente
app.use('/api', clientRoutes);

// Manejo centralizado de errores
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

const server = app.listen(port, host, () => {
  console.log(`🚀 Servidor API modularizado corriendo en http://${host}:${port}`);
});

const gracefulShutdown = (signal: string) => {
  console.log(`[API Principal] Recibida señal ${signal}, cerrando conexiones...`);
  server.close(async () => {
    try {
      await pool.end();
    } catch {}
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
