const PROD_API_URL = 'https://webwin-api-service-eus.azurewebsites.net';

export const isLocalHostEnv = (): boolean =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL: string = isLocalHostEnv()
  ? 'http://localhost:3001'
  : (import.meta.env.VITE_API_URL || PROD_API_URL);
