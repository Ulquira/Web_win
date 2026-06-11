import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';

// Reemplaza estos valores con tu configuración de Firebase
// Obtén estos valores desde: Firebase Console > Proyecto > Configuración > Tu aplicación web
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Analytics
const analytics = getAnalytics(app);

// Función para rastrear eventos custom (la usaremos en opción B)
export const trackEvent = (eventName: string, eventParams?: Record<string, any>) => {
  logEvent(analytics, eventName, eventParams);
};

export { analytics };
export default app;
