import { Router } from 'express';
import rateLimit from 'express-rate-limit';

const router = Router();

const routeCache = new Map<string, { data: any; expiresAt: number }>();
const ROUTE_CACHE_TTL_MS = 60000;

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of routeCache.entries()) {
    if (value.expiresAt < now) {
      routeCache.delete(key);
    }
  }
}, 60000);

const routeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_ROUTE || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Límite de cálculo de rutas alcanzado. Intente en un minuto.' }
});

// Endpoint para calcular la ruta con tráfico real usando Google Maps API
router.post('/route', routeLimiter, async (req, res) => {
  const { start, end } = req.body;

  if (!start || !end) {
    return res.status(400).json({ success: false, message: 'Faltan coordenadas de inicio y fin' });
  }

  const routeCacheKey = `route_${start[0]}_${start[1]}_${end[0]}_${end[1]}`;
  const cachedRoute = routeCache.get(routeCacheKey);
  if (cachedRoute && cachedRoute.expiresAt > Date.now()) {
    return res.json(cachedRoute.data);
  }

  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ success: false, message: 'API Key de Google Maps no configurada' });
    }

    const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;
    const requestBody = {
      origin: {
        location: { latLng: { latitude: start[0], longitude: start[1] } }
      },
      destination: {
        location: { latLng: { latitude: end[0], longitude: end[1] } }
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: false,
      routeModifiers: {
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: false
      },
      languageCode: 'es-419',
      units: 'METRIC'
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

    const data: any = await response.json();

    if (response.ok && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const durationStr = route.duration || '0s';
      const durationSeconds = parseInt(durationStr.replace('s', ''), 10);
      const polyline = route.polyline.encodedPolyline;

      const resultPayload = { success: true, durationSeconds, polyline };
      routeCache.set(routeCacheKey, {
        data: resultPayload,
        expiresAt: Date.now() + ROUTE_CACHE_TTL_MS
      });

      res.json(resultPayload);
    } else {
      res.status(400).json({ success: false, message: data.error?.message || 'Error en Google Routes API' });
    }
  } catch (error: any) {
    console.error('Error calculando ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno calculando ruta' });
  }
});

export default router;
