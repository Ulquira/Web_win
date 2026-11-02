import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import replicationRouter from './replicationReceiver.ts';
import clientRoutes from './routes/clientRoutes.ts';
import adminRoutes from './routes/adminRoutes.ts';

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
app.use(express.json({ limit: '10mb' }));

// Registrar rutas de replicación en tiempo real (receptor)
app.use(replicationRouter);

// Rutas públicas de seguimiento y cliente
app.use('/api', clientRoutes);

// Rutas protegidas de administración y dashboards
app.use('/api/4dm1n_', adminRoutes);

// Manejo centralizado de errores
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({ success: false, message: 'Error interno del servidor', error: err?.message });
});

app.listen(port, host, () => {
  console.log(`🚀 Servidor API modularizado corriendo en http://${host}:${port}`);
});
