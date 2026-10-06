import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

import { Phone, CheckCircle2, User, Star, Bell, Check, MapPin, AlertTriangle, CalendarDays, ChevronDown, ChevronLeft, X, IdCard, Calendar, Clock } from "lucide-react";
import { PiTelevisionSimple, PiPackage, PiWifiHigh, PiShieldCheck, PiLightning } from "react-icons/pi";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import GoogleTrackingMap from "@/components/GoogleTrackingMap";
import { motion, AnimatePresence } from "framer-motion";
import { MainLogo } from "@/components/MainLogo";
import { trackEvent } from "@/lib/firebaseConfig";

const parseSafeDate = (dateStr?: string) => {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    const [year, month, day] = match[1].split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

// Componente para animar elementos al entrar
export interface InstalacionData {
 cliente_nombre?: string;
 direccion?: string;
 idoperacion?: string | number;
 status: 'programada' | 'asignado' | 'en_camino' | 'en_proceso' | 'finalizada' | 'cerrada' | string;
 tecnico?: {
 nombre: string;
 dni?: string;
 foto?: string | null;
 cuadrilla: string;
 telefono: string;
 };
 eta?: string;
 trafico?: string;
 coordenadas_cliente?: [number, number];
 coordenadas_tecnico?: [number, number];
 fecha_programacion?: string;
 tramo?: string;
 token_inicio?: string;
 campana?: string;
 codisegui?: string;
 tipo?: 'instalacion' | 'ticket';
}

const Seguimiento = () => {
 const { token } = useParams<{ token: string }>();
 const navigate = useNavigate();
 
 const [data, setData] = useState<InstalacionData | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(false);

 const [calculatedEta, setCalculatedEta] = useState<string | null>(null);
 // Estado para manejar el tiempo restante actual en segundos
 const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
 
 const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
 const [isReprogramModalOpen, setIsReprogramModalOpen] = useState(false);
 const [isReprogramCompletada, setIsReprogramCompletada] = useState(false);
 const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
 const [hasImageError, setHasImageError] = useState(false);
 const [reprogramStep, setReprogramStep] = useState<'form' | 'confirm_popup' | 'success'>('form');
 const [reprogramData, setReprogramData] = useState({ fecha: '', turno: '', motivo: '', motivoSeleccionado: '' });
 const [isSubmittingReprogram, setIsSubmittingReprogram] = useState(false);
 
 const [encuesta, setEncuesta] = useState({
 instalacion_concretada: '',
 tecnico_trato: '',
 tecnico_puntualidad: '',
 tecnico_claridad: '',
 tecnico_orden: '',
 tecnico_efectividad: '',
 satisfaccion_general: '',
 satisfaccion_comentario: '',
 facilidad_gestion: '',
 facilidad_motivo: ''
 });
 const [isSubmittingEncuesta, setIsSubmittingEncuesta] = useState(false);
 const [encuestaEnviada, setEncuestaEnviada] = useState(false);

 const previousStatus = useRef<string | null>(null);
 const previousTechnician = useRef<string | null>(null);
 const etaReferenceTime = useRef<number | null>(null);
 const [notifications, setNotifications] = useState<{title: string, body: string, time: Date, read: boolean}[]>([]);
 const [showNotifications, setShowNotifications] = useState(false);
 const [sheetHeight, setSheetHeight] = useState(13);

 useEffect(() => {
 if ("Notification" in window && Notification.permission === "default") {
 Notification.requestPermission();
 }
 }, []);

 // Registrar tiempo de estadía y si refrescó la página en nuestra base de datos
 useEffect(() => {
   if (!token) return;

   let startTime = Date.now();
   // Hacemos un cast a "any" para evitar el error de TypeScript con PerformanceEntry
   const isReload = window.performance && (window.performance.getEntriesByType("navigation")[0] as any)?.type === "reload";

   if (isReload) {
     trackEvent('pagina_refrescada', { token });
   }

   const sendDurationLog = () => {
     const endTime = Date.now();
     const durationSeconds = Math.round((endTime - startTime) / 1000);
     
     // Evitar registrar visitas ultra cortas de 0 segundos
     if (durationSeconds <= 0) return;

     const logData = JSON.stringify({
       token,
       evento: 'visita_finalizada',
       detalles: { duracion_segundos: durationSeconds }
     });

     // El uso de fetch con keepalive es el estándar moderno y 100% confiable
     fetch(`${import.meta.env.VITE_API_URL}/api/log`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: logData,
       keepalive: true
     }).catch(err => console.error("Error al registrar duracion:", err));
   };

   const handleVisibilityChange = () => {
     if (document.visibilityState === 'hidden') {
       sendDurationLog();
     } else if (document.visibilityState === 'visible') {
       // Resetear el tiempo de inicio cuando el usuario vuelve a abrir/mirar la pestaña
       startTime = Date.now();
     }
   };

   document.addEventListener('visibilitychange', handleVisibilityChange);

   return () => {
     document.removeEventListener('visibilitychange', handleVisibilityChange);
     sendDurationLog(); // Registrar última duración si el componente se desmonta
   };
 }, [token]);

 const triggerNotification = (newStatus: string, tecnicoData: any) => {
 let title = "¡Actualización de tu servicio!";
 let body = "";
 
 switch(newStatus) {
 case 'asignado': body = `El técnico ${tecnicoData?.nombre || ''} ha sido asignado a tu instalación.`; break;
 case 'en_camino': body = "Tu técnico ya está en camino a tu domicilio. Revisa el mapa."; break;
 case 'en_proceso': body = "La instalación está en proceso en este momento."; break;
 case 'finalizada': body = "Instalación completada. Por favor evalúa nuestro servicio."; break;
 default: return;
 }

 setNotifications(prev => [{ title, body, time: new Date(), read: false }, ...prev]);

 if ("Notification" in window && Notification.permission === "granted") {
   const notificationOptions: any = { 
     body,
     icon: '/win-icon.png',
     badge: '/win-icon.png',
     tag: 'win-seguimiento-status',
     renotify: true,
     vibrate: [200, 100, 200],
     data: { url: window.location.href }
   };

   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.ready.then(registration => {
       registration.showNotification(title, notificationOptions);
     }).catch(() => {
       // Fallback for non-sw environments
       new Notification(title, notificationOptions);
     });
   } else {
     new Notification(title, notificationOptions);
   }
 }
 };

 const triggerTechnicianChangeNotification = (newTechName: string) => {
   const title = "¡Actualización de técnico!";
   const body = `Tu atención ha sido asignada al técnico ${toTitleCase(newTechName)}.`;

   setNotifications(prev => [{ title, body, time: new Date(), read: false }, ...prev]);

   if ("Notification" in window && Notification.permission === "granted") {
     const notificationOptions: any = { 
       body,
       icon: '/win-icon.png',
       badge: '/win-icon.png',
       tag: 'win-seguimiento-tech-change',
       renotify: true,
       vibrate: [200, 100, 200],
       data: { url: window.location.href }
     };

     if ('serviceWorker' in navigator) {
       navigator.serviceWorker.ready.then(registration => {
         registration.showNotification(title, notificationOptions);
       }).catch(() => {
         new Notification(title, notificationOptions);
       });
     } else {
       new Notification(title, notificationOptions);
     }
   }
 };

 const getTomorrowLocal = () => {
   const tomorrow = new Date();
   tomorrow.setDate(tomorrow.getDate() + 1);
   const localDate = new Date(tomorrow.getTime() - (tomorrow.getTimezoneOffset() * 60000));
   return localDate.toISOString().split('T')[0];
 };

 const getMaxDateLocal = () => {
   const maxDate = new Date();
   maxDate.setDate(maxDate.getDate() + 7);
   const localDate = new Date(maxDate.getTime() - (maxDate.getTimezoneOffset() * 60000));
   return localDate.toISOString().split('T')[0];
 };

 const getAvailableDays = () => {
   const days = [];
   const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
   const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

   for (let i = 1; i <= 7; i++) {
     const d = new Date();
     d.setDate(d.getDate() + i);
     const localDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
     const isoString = localDate.toISOString().split('T')[0];
     const dayOfWeek = diasSemana[d.getDay()];
     const dayNum = d.getDate();
     const monthName = meses[d.getMonth()];

     days.push({
       iso: isoString,
       dayOfWeek,
       dayNum,
       monthName,
       isTomorrow: i === 1
     });
   }
   return days;
 };

 const formatSelectedDate = (isoStr: string) => {
   if (!isoStr) return '';
   const parts = isoStr.split('-');
   if (parts.length < 3) return isoStr;
   const mesesFull = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
   const mesIdx = parseInt(parts[1], 10) - 1;
   const dia = parseInt(parts[2], 10);
   return `${dia} de ${mesesFull[mesIdx] || parts[1]}`;
 };

 const handleReprogramSubmit = async () => {
   const minDate = getTomorrowLocal();
   const maxDate = getMaxDateLocal();
   if (!reprogramData.fecha || reprogramData.fecha < minDate || reprogramData.fecha > maxDate) {
     alert("Por favor selecciona una fecha válida dentro de los próximos 7 días.");
     return;
   }

   setIsSubmittingReprogram(true);
   try {
     const response = await fetch(`${import.meta.env.VITE_API_URL}/api/reprogramar`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         token,
         ...reprogramData
       })
     });

     const result = await response.json();
     if (result.success) {
       trackEvent('reprogramar_solicitud_completada', { token, motivo: reprogramData.motivoSeleccionado });
       localStorage.setItem(`reprogramacion_completada_${token}`, 'true');
       setReprogramStep('success');
     } else {
       alert("Ocurrió un error. Por favor intenta de nuevo más tarde.");
     }
   } catch {
     alert("Error de conexión al guardar la solicitud.");
   } finally {
     setIsSubmittingReprogram(false);
   }
 };

 const handleEncuestaSubmit = async () => {
 if (
   !encuesta.instalacion_concretada || 
   !encuesta.tecnico_trato || 
   !encuesta.tecnico_puntualidad || 
   !encuesta.tecnico_claridad || 
   !encuesta.tecnico_orden || 
   !encuesta.tecnico_efectividad || 
   !encuesta.satisfaccion_general || 
   !encuesta.facilidad_gestion
 ) {
 alert("Por favor responde todas las preguntas antes de enviar.");
 return;
 }

 setIsSubmittingEncuesta(true);
 try {
 const response = await fetch(`${import.meta.env.VITE_API_URL}/api/encuesta`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 token,
 ...encuesta
 })
 });

 const result = await response.json();
 if (result.success) {
 trackEvent('encuesta_completada', { 
   token, 
   instalacion_concretada: encuesta.instalacion_concretada,
   satisfaccion_general: encuesta.satisfaccion_general,
   facilidad_gestion: encuesta.facilidad_gestion
 });
 setEncuestaEnviada(true);
 localStorage.setItem(`encuesta_completada_${token}`, 'true');
 setData(prev => prev ? { ...prev, status: 'cerrada' } : null);
 } else {
 alert("Ocurrió un error. Por favor intenta de nuevo más tarde.");
 }
 } catch (e) {
 alert("Error de conexión al guardar la encuesta.");
 } finally {
 setIsSubmittingEncuesta(false);
 }
 };

 // Efecto para el contador regresivo local del ETA
 useEffect(() => {
   if (remainingSeconds === null || remainingSeconds <= 0) return;

   const interval = setInterval(() => {
     setRemainingSeconds(prev => {
       if (prev === null || prev <= 0) {
         clearInterval(interval);
         return 0;
       }
       return prev - 1;
     });
   }, 1000);

   return () => clearInterval(interval);
 }, [remainingSeconds]);

 // Formatear el ETA calculado cada vez que cambian los segundos restantes
 useEffect(() => {
   if (remainingSeconds === null) return;
   
   const totalSecsWithBuffer = remainingSeconds + (15 * 60); // Agregamos los 15 minutos extra
   
   if (etaReferenceTime.current) {
     const arrivalTimeMin = new Date(etaReferenceTime.current + (totalSecsWithBuffer * 1000));
     // Damos un margen de 20 minutos para el límite superior del rango
     const arrivalTimeMax = new Date(arrivalTimeMin.getTime() + (20 * 60 * 1000)); 
     
     const timeFormatMin = arrivalTimeMin.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
     const timeFormatMax = arrivalTimeMax.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
     
     setCalculatedEta(`${timeFormatMin} - ${timeFormatMax}`);
   }
 }, [remainingSeconds]);

 useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const fetchInstalacion = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/instalaciones/${token}`);
        const result = await response.json();
        
        if (result.success) {
          const fetchedData = result.data;
          if (token) {
            localStorage.setItem('win_last_token', token);
          }
          
          // MAPEO DE NUEVOS ESTADOS DE BD A ESTADOS INTERNOS DE UI
          const dbStatus = fetchedData.status ? fetchedData.status.toLowerCase().trim() : '';
          let mappedStatus = fetchedData.status;

          switch (dbStatus) {
            case 'pendiente':
              mappedStatus = 'programada';
              break;
            case 'agendada':
              mappedStatus = 'asignado';
              break;
            case 'en camino':
              mappedStatus = 'en_camino';
              break;
            case 'iniciada':
              mappedStatus = 'en_proceso';
              break;
            case 'finalizada':
              mappedStatus = 'finalizada';
              break;
            case 'anulada':
            case 'regestion':
            case 'cancelada':
            case 'revisión':
            case 'revision':
              mappedStatus = 'cerrada';
              break;
          }
          fetchedData.status = mappedStatus;

          const hasCompletedSurveyLocal = localStorage.getItem(`encuesta_completada_${token}`);
          const hasCompletedReprogramLocal = localStorage.getItem(`reprogramacion_completada_${token}`);
          
          if (hasCompletedReprogramLocal === 'true' || fetchedData.reprogramada) {
            setIsReprogramCompletada(true);
            if (fetchedData.reprogramada) {
              localStorage.setItem(`reprogramacion_completada_${token}`, 'true');
            }
          }

          if (hasCompletedSurveyLocal === 'true' || fetchedData.encuesta_completada) {
            fetchedData.status = 'cerrada';
            if (fetchedData.encuesta_completada) {
              localStorage.setItem(`encuesta_completada_${token}`, 'true');
            }
          }
          
          if (previousStatus.current && previousStatus.current !== fetchedData.status) {
            trackEvent('actualizacion_estado_visto', { 
              token, 
              estado_anterior: previousStatus.current, 
              estado_nuevo: fetchedData.status 
            });
            triggerNotification(fetchedData.status, fetchedData.tecnico);
          } else if (previousStatus.current === null) {
            // Primer carga/visita de la web por parte del usuario
            trackEvent('ver_seguimiento_instalacion', { 
              token, 
              estado_actual: fetchedData.status 
            });
          }
          previousStatus.current = fetchedData.status;

          const currentTechName = fetchedData.tecnico?.nombre?.trim() || '';

          // Detectar si hubo cambio de técnico asignado
          if (
            previousTechnician.current && 
            currentTechName && 
            previousTechnician.current !== currentTechName && 
            currentTechName !== 'Técnico Asignado'
          ) {
            trackEvent('cambio_tecnico_detectado', {
              token,
              tecnico_anterior: previousTechnician.current,
              tecnico_nuevo: currentTechName
            });
            triggerTechnicianChangeNotification(currentTechName);
          }

          if (currentTechName && currentTechName !== 'Técnico Asignado') {
            previousTechnician.current = currentTechName;
          }

          setData(fetchedData);
          setError(false);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Error fetching data", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchInstalacion();
      intervalId = setInterval(fetchInstalacion, 10000);
    }

    return () => clearInterval(intervalId);
 }, [token]);

 if (loading) {
return (
 <div className="h-[100dvh] w-full bg-[#f3f4f6] relative overflow-hidden flex flex-col font-sans">
 <div className="flex-1 bg-gray-200 animate-pulse"></div>
 <div className="absolute bottom-0 w-full h-[40vh] bg-white rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-8">
 <div className="w-16 h-1.5 bg-gray-300 rounded-full mx-auto mb-8 animate-pulse"></div>
 <div className="w-3/4 h-8 bg-gray-200 rounded-lg mb-4 animate-pulse"></div>
 <div className="w-1/2 h-4 bg-gray-200 rounded-lg mb-8 animate-pulse"></div>
 <div className="w-full h-20 bg-gray-200 rounded-2xl animate-pulse"></div>
 </div>
 </div>
 );
 }

 if (error || !data) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] flex-col gap-4 font-sans px-6 text-center">
 <h1 className="text-3xl font-bold text-foreground">Instalación no encontrada</h1>
 <p className="text-muted-foreground text-lg">El link de seguimiento proporcionado es inválido o la operación no existe.</p>
 <Button onClick={() => navigate('/')} className="mt-4 rounded-2xl h-14 px-8 bg-primary hover:bg-primary-light text-white font-bold text-lg">Volver al inicio</Button>
 </div>
 );
 }

 if (isReprogramCompletada) {
   return (
     <div className="min-h-[100dvh] w-full bg-[#f3f4f6] flex flex-col font-sans">
       {/* Header WIN */}
       <div className="bg-primary w-full py-6 px-6 text-white shrink-0 relative z-30 shadow-sm flex flex-col justify-center">
         <div className="flex justify-between items-center w-full">
           <div className="flex flex-col items-start gap-0.5">
             <MainLogo white className="h-8 sm:h-10" />
             <h1 className="text-[20px] font-bold tracking-tight leading-tight mt-1">
               {data?.cliente_nombre ? `Hola, ${data.cliente_nombre.split(' ')[0].toUpperCase()}` : 'Detalle de visita'}
             </h1>
           </div>
         </div>
       </div>

       {/* Full Screen Completion Body */}
       <div className="flex-1 flex items-center justify-center p-6">
         <motion.div 
           initial={{ opacity: 0, scale: 0.95, y: 10 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           className="bg-white rounded-[24px] p-8 w-full max-w-[340px] flex flex-col items-center text-center shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-100"
         >
           <div className="w-16 h-16 bg-[#FFF7ED] border-2 border-[#FF5A0A] rounded-full flex items-center justify-center mb-5 shadow-sm">
             <Check className="w-8 h-8 text-[#FF5A0A]" strokeWidth={3} />
           </div>
           <h2 className="text-[18px] font-bold text-[#0F090B] mb-2 leading-snug">
             Solicitud de reprogramación enviada
           </h2>
           <p className="text-[13px] text-gray-600 font-normal leading-relaxed mb-6">
             Tu solicitud de reprogramación se ha enviado con éxito.
           </p>
           <div className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-left space-y-1.5">
             <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Estado de la atención</p>
             <div className="flex items-center gap-2">
               <span className="w-2.5 h-2.5 rounded-full bg-[#FF5A0A] animate-pulse"></span>
               <p className="text-[13px] font-bold text-[#0F090B]">Reprogramación en gestión</p>
             </div>
           </div>
         </motion.div>
       </div>
     </div>
   );
 }

 const { status, tecnico, eta, fecha_programacion } = data;

 const position: [number, number] = data.coordenadas_cliente || [-12.0971, -77.0369];
 const vehiclePosition: [number, number] = data.coordenadas_tecnico || [-12.0950, -77.0320];

 const isVt = data.tipo === 'ticket';

 const steps = [
 { id: 'programada', label: 'Agendada', sub: 'Tu visita ha sido programada.', date: fecha_programacion },
 { id: 'asignado', label: 'Técnico Asignado', sub: 'Tenemos un técnico para ti.' },
 { id: 'en_camino', label: 'En Camino', sub: 'El técnico ya está en ruta.' },
 { id: 'en_proceso', label: 'Iniciada', sub: 'Técnico revisando o instalando.' },
 { id: 'finalizada', label: 'Finalizada', sub: isVt ? 'Visita completada.' : 'Instalación completada.' },
 ];

 const statusIndex = ['programada', 'asignado', 'en_camino', 'en_proceso', 'finalizada', 'cerrada'].indexOf(status);

 const formatTramoToRange = (tramoStr?: string) => {
   if (!tramoStr) return 'De 8:00 am. a 12:00 pm';
   
   const t = tramoStr.toLowerCase().trim();
   if (t.startsWith('08') || t.startsWith('8')) return 'De 8:00 am. a 12:00 pm';
   if (t.startsWith('12')) return 'De 12:00 pm. a 4:00 pm';
   if (t.startsWith('16') || t.startsWith('4')) return 'De 4:00 pm. a 8:00 pm';
   
   if (tramoStr.includes('-') || tramoStr.toLowerCase().includes(' a ')) return tramoStr;
   
   return tramoStr;
 };

 const parsePlanData = (campana?: string) => {
   if (!campana) return { paquete: '', svas: [] };
   if (!campana.includes('|')) return { paquete: '', svas: [] };
   
   const parts = campana.split('|');
   let paquete = '';
   let rawSvas: string[] = [];
   let cantidadMesh = 0;
   let instalacionMesh = false;
   
   parts.forEach(part => {
     const [key, ...valueParts] = part.split(':');
     if (!key || valueParts.length === 0) return;
     const value = valueParts.join(':').trim();
     const cleanKey = key.trim().toLowerCase();
     
     if (cleanKey === 'paquete') {
       paquete = value;
     } else if (cleanKey === "sva's" || cleanKey === "svas") {
        rawSvas = value.split('+')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !/^(ninguno|no|n\/a|na|no aplica|-|0|null|sin\s*sva|sin\s*sva's)$/i.test(s));
     } else if (cleanKey === 'cantidad de mesh') {
       const match = value.match(/\d+/);
       if (match) cantidadMesh = parseInt(match[0], 10);
     } else if (cleanKey === 'instalacion de mesh' || cleanKey === 'instalación de mesh') {
       const match = value.match(/\d+/);
       if (match && parseInt(match[0], 10) > 0) instalacionMesh = true;
       else if (/^(si|sí|true)/i.test(value)) instalacionMesh = true;
     }
   });

   const finalSvas: string[] = [];
   let meshAgregado = false;

   rawSvas.forEach(s => {
     let text = s;
     // Limpiar etiquetas comerciales: (en comodato), (en alquiler), (en venta), (venta), etc.
     text = text.replace(/\(?\s*en\s+(comodato|alquiler|venta)\s*\)?/gi, '');
     text = text.replace(/\(?\s*\b(comodato|alquiler|venta)\b\s*\)?/gi, '');
     text = text.trim();

     const esItemMesh = /mesh/i.test(text);
     const esServicioCableado = /servicio\s+cableado/i.test(text);

     if (esItemMesh) {
       if (esServicioCableado) instalacionMesh = true;
       if (!meshAgregado) {
         meshAgregado = true;
         let meshText = cantidadMesh > 0 ? `${cantidadMesh} Mesh` : 'Mesh';
         if (instalacionMesh) {
           meshText += ' + Instalación cableada';
         }
         finalSvas.push(meshText);
       }
     } else if (text.length > 0) {
       finalSvas.push(text);
     }
   });

   if (cantidadMesh > 0 && !meshAgregado) {
     let meshText = `${cantidadMesh} Mesh`;
     if (instalacionMesh) meshText += ' + Instalación cableada';
     finalSvas.push(meshText);
   }

   const uniqueSvas = Array.from(new Set(finalSvas));

   return { paquete, svas: uniqueSvas };
 };

 const toTitleCase = (text?: string) => {
   if (!text) return '';
   return text.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
 };
 
 const formatMaskedDni = (dni?: string) => {
   if (!dni) return '';
   const clean = dni.trim();
   if (clean.length <= 4) return clean;
   if (clean.startsWith('****')) return clean;
   return '****' + clean.slice(4);
 };

 const extractTechnicianName = (nombre?: string, _cuadrilla?: string) => {
    if (nombre && nombre.trim() && nombre !== "Técnico Asignado") {
      return toTitleCase(nombre.trim());
    }
    return "Técnico Asignado";
  };
 
 const formatAddress = (address?: string) => {
   if (!address) return 'Cargando...';
   let clean = address;
   
   // Cortar siempre a partir de ||referencia, |referencia o referencia:
   clean = clean.split(/\|\|\s*referencia/i)[0];
   clean = clean.split(/\|\s*referencia/i)[0];
   clean = clean.split(/\breferencia\s*:/i)[0];

   // Limpiar campos vacíos al final como "DPTO/INTERIOR -", "PISO -", o símbolos residuales como '||', '|', ','
   clean = clean.replace(/PISO\s*-?\s*$/i, '').replace(/DPTO\/INTERIOR\s*-?\s*$/i, '').trim();
   clean = clean.replace(/[\|,\s-]+$/, '').trim();
   return toTitleCase(clean);
 };

 const handleDragEnd = (_e: any, info: any) => {
   if (info.offset.y < -30) {
     setSheetHeight(85);
   } else if (info.offset.y > 30) {
     setSheetHeight(13);
   }
 };

 const toggleSheet = () => {
   if (status === 'en_camino') {
     setSheetHeight(prev => (prev > 30 ? 13 : 85));
   }
 };

 return (
 <div className="h-[100dvh] w-full bg-[#f3f4f6] relative overflow-hidden font-sans">
 
 {/* Floating Header (Only for map view to go back) */}
 {status === 'en_camino' && (
 <div className="absolute top-0 left-0 w-full p-4 z-20 flex justify-between items-start pointer-events-none mt-2">
 <button 
 onClick={() => navigate(`/`)} 
 className="w-12 h-12 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg pointer-events-auto transition-transform active:scale-95"
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800"><path d="m15 18-6-6 6-6"/></svg>
 </button>
 </div>
 )}

 {/* Map Layer (Background - Google Maps Minimalista estilo Uber) */}
 {status === 'en_camino' && (
 <div className="absolute top-0 left-0 w-full h-full z-0 bg-[#f5f5f5]">
   <GoogleTrackingMap
     customerCoords={position}
     technicianCoords={vehiclePosition}
     onRouteCalculated={(_coords, timeInSeconds) => {
       if (remainingSeconds === null || Math.abs(remainingSeconds - timeInSeconds) > 300) {
         setRemainingSeconds(timeInSeconds);
         etaReferenceTime.current = Date.now();
       }
     }}
     className="h-full w-full"
   />

 {/* Mensaje Referencial superpuesto en el mapa */}
 <div className="absolute bottom-[15vh] left-4 z-[400] bg-white/95 backdrop-blur-sm px-3.5 py-2.5 rounded-xl shadow-md border border-gray-100 max-w-[200px]">
   <div className="flex items-center gap-1.5">
     <AlertTriangle className="w-5 h-5 text-primary shrink-0" />
     <p className="text-[11px] text-gray-600 font-normal leading-tight">
       El tiempo de llegada puede variar según el tráfico.
     </p>
   </div>
 </div>
 </div>
 )}

 {/* Dynamic Content Container */}
 <motion.div 
  animate={{ 
    height: status === 'en_camino' ? `${sheetHeight}vh` : '100vh' 
  }}
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
  drag={status === 'en_camino' ? "y" : false}
  dragConstraints={{ top: 0, bottom: 0 }}
  dragElastic={0.2}
  onDragEnd={handleDragEnd}
  className={`absolute left-0 bottom-0 w-full bg-white shadow-[0_-15px_40px_rgba(0,0,0,0.15)] z-20 flex flex-col ${
    status === 'en_camino' ? 'rounded-t-[2.5rem]' : 'rounded-none top-0 pt-0'
 }`}>
 
 {/* Top Banner Orange (Always visible if no map) */}
 {status !== 'en_camino' && (
 <div className="bg-[#FF5A0A] w-full pt-6 pb-5 px-5 text-white shrink-0 relative z-30 shadow-sm flex flex-col justify-center">
 <div className="flex justify-between items-center w-full">
 <div className="flex items-center gap-2">
   <button 
     onClick={() => navigate('/')} 
     className="p-1 -ml-1 text-white/90 hover:text-white transition-colors active:scale-90 cursor-pointer"
     aria-label="Volver"
   >
     <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
   </button>
   <div className="flex flex-col items-start gap-0.5">
     <MainLogo white className="h-7 sm:h-9" />
     <h1 className="text-[17px] font-bold tracking-tight leading-tight mt-0.5">
       {data?.cliente_nombre ? `Hola, ${data.cliente_nombre.split(' ')[0].toUpperCase()}` : 'Detalle de visita'}
     </h1>
   </div>
 </div>
 <div className="relative">
 <button 
 onClick={() => {
 setShowNotifications(!showNotifications);
 setNotifications(prev => prev.map(n => ({...n, read: true})));
 }} 
 className="relative p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer active:scale-95"
 >
 <Bell className="w-6 h-6 text-white fill-white" />
 {notifications.some(n => !n.read) && (
 <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-yellow-400 rounded-full border-2 border-primary"></div>
 )}
 </button>
 
 {/* Notifications Dropdown */}
 <AnimatePresence>
 {showNotifications && (
 <motion.div 
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 10 }}
 className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 text-left"
 >
 <div className="p-3 bg-gray-50 border-b border-gray-100 font-bold text-gray-800 text-sm">
 Notificaciones
 </div>
 <div className="max-h-60 overflow-y-auto">
 {notifications.length === 0 ? (
 <div className="p-4 text-center text-sm text-gray-500">No hay notificaciones recientes</div>
 ) : (
 notifications.map((notif, idx) => (
 <div key={idx} className="p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
 <p className="text-xs font-bold text-gray-900 mb-0.5">{notif.title}</p>
 <p className="text-xs text-gray-500 leading-tight">{notif.body}</p>
 <p className="text-[10px] text-gray-400 mt-1">{format(notif.time, "hh:mm a")}</p>
 </div>
 ))
 )}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>
 </div>
 )}

 {/* Drag Handle (Only when map is visible) */}
 {status === 'en_camino' && (
 <div 
   onClick={toggleSheet}
   className="w-full flex flex-col items-center justify-center pt-3 pb-1 shrink-0 cursor-pointer hover:bg-gray-50 rounded-t-[2.5rem] transition-colors"
 >
   <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-1 mt-1"></div>
 </div>
 )}

 {/* Scrollable Content inside Sheet */}
 <div className="flex-1 overflow-y-auto px-5 pb-32 scrollbar-hide pt-0">
 
 {status === 'cerrada' && !encuestaEnviada && localStorage.getItem(`encuesta_completada_${token}`) !== 'true' ? (
 <div className="py-6">
 <div className="bg-white border border-gray-200 rounded-[24px] p-6 sm:p-8 shadow-sm text-center">
 <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-gray-100">
 <AlertTriangle className="w-8 h-8 text-gray-400" />
 </div>
 <h2 className="text-2xl font-bold text-gray-900 mb-3">Atención Cerrada</h2>
 <p className="text-[15px] text-gray-500 mb-8 font-normal leading-relaxed px-2">
 Tu visita ha sido cerrada. Si no reconoces esta cancelación, comunícate con nosotros, con gusto te atenderemos.
 </p>
 <button 
 onClick={() => {
  trackEvent('click_contactar_soporte_cerrada', { token });
  const isVt = data?.tipo === 'ticket';
  const wspNumber = isVt ? '51922863186' : '51923229369';
  const msg = encodeURIComponent(isVt ? "Hola, necesito soporte sobre mi Visita Técnica cerrada." : "Hola, necesito soporte sobre mi atención cerrada.");
  window.open(`https://wa.me/${wspNumber}?text=${msg}`);
}} 
 className="w-full bg-primary text-white font-bold rounded-2xl h-14 shadow-lg text-[15px] flex items-center justify-center gap-2 transition-transform active:scale-95"
 >
 <Phone className="w-5 h-5" /> Contactar con Soporte
 </button>
 </div>
 </div>
 ) : status === 'finalizada' && !encuestaEnviada && localStorage.getItem(`encuesta_completada_${token}`) !== 'true' ? (
 (() => {
 const isVt = data.tipo === 'ticket';
 const terminoServicio = isVt ? 'la visita técnica' : 'la instalación';
 const terminoServicioCap = isVt ? 'La visita técnica' : 'La instalación';

 return (
 <div className="py-4">
 <div className="mb-6">
 <h2 className="text-[22px] font-black text-gray-900 leading-tight">
   Cuéntanos sobre<br/>tu experiencia
 </h2>
 </div>
 
 <div className="space-y-4">
 {/* Pregunta 1 */}
 <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
 <p className="font-bold text-[14px] mb-3 text-gray-900">1. ¿{terminoServicioCap} se concretó correctamente?</p>
 <div className="flex gap-3">
 <label className="flex items-center justify-center gap-2 cursor-pointer bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100 flex-1 hover:bg-gray-100 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
 <input type="radio" name="q1" value="Sí" onChange={(e) => setEncuesta({...encuesta, instalacion_concretada: e.target.value})} className="accent-primary w-4 h-4" /> 
 <span className="font-bold text-[13px] text-gray-800">Sí</span>
 </label>
 <label className="flex items-center justify-center gap-2 cursor-pointer bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100 flex-1 hover:bg-gray-100 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
 <input type="radio" name="q1" value="No" onChange={(e) => setEncuesta({...encuesta, instalacion_concretada: e.target.value})} className="accent-primary w-4 h-4" /> 
 <span className="font-bold text-[13px] text-gray-800">No</span>
 </label>
 </div>
 </div>

 {/* Pregunta 2 */}
 <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
 <p className="font-bold text-[14px] mb-1 text-gray-900">2. Evalúa al técnico en los siguientes aspectos:</p>
 <p className="text-[11px] text-gray-400 mb-4 font-normal">1 = Totalmente Insatisfecho, 5 = Totalmente Satisfecho</p>
 
 {[
   { key: 'tecnico_trato', label: 'Trato y respeto' },
   { key: 'tecnico_puntualidad', label: `Puntualidad y cumplimiento de ${terminoServicio}` },
   { key: 'tecnico_claridad', label: 'Claridad de la explicación (Uso, recomendaciones, cuidados)' },
   { key: 'tecnico_orden', label: 'Orden y cuidado del espacio (limpieza, cableado prolijo)' },
   { key: 'tecnico_efectividad', label: 'Efectividad del trabajo realizado' }
 ].map(aspect => (
   <div key={aspect.key} className="mb-4 last:mb-0">
     <p className="text-[12px] font-bold text-gray-800 mb-2">{aspect.label}</p>
     <div className="flex justify-between gap-1">
     {[1,2,3,4,5].map(num => (
     <label key={`${aspect.key}_${num}`} className="flex-1">
     <input type="radio" name={aspect.key} value={num} onChange={(e) => setEncuesta({...encuesta, [aspect.key]: e.target.value})} className="peer hidden" />
     <div className="border border-gray-100 bg-gray-50 rounded-xl flex flex-col items-center justify-center py-2 cursor-pointer hover:bg-gray-100 peer-checked:border-primary peer-checked:bg-primary/10 transition-all">
     <span className={`text-[14px] font-bold ${(encuesta as any)[aspect.key] === num.toString() ? 'text-primary' : 'text-gray-500'}`}>{num}</span>
     </div>
     </label>
     ))}
     </div>
   </div>
 ))}
 </div>

 {/* Pregunta 3 */}
 <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
 <p className="font-bold text-[14px] mb-1 text-gray-900">3. En general, ¿Qué tan satisfecho(a) estás con la atención recibida durante {terminoServicio}?</p>
 <p className="text-[11px] text-gray-400 mb-4 font-normal">1 = Totalmente Insatisfecho, 5 = Totalmente Satisfecho</p>
 <div className="flex justify-between gap-1 mb-4">
 {[1,2,3,4,5].map(num => (
 <label key={`sat_${num}`} className="flex-1">
 <input type="radio" name="satisfaccion" value={num} onChange={(e) => {
   setEncuesta({...encuesta, satisfaccion_general: e.target.value, satisfaccion_comentario: ''});
 }} className="peer hidden" />
 <div className="border border-gray-100 bg-gray-50 rounded-xl flex flex-col items-center justify-center py-2 cursor-pointer hover:bg-gray-100 peer-checked:border-primary peer-checked:bg-primary/10 transition-all">
 <span className={`text-[14px] font-bold ${encuesta.satisfaccion_general === num.toString() ? 'text-primary' : 'text-gray-500'}`}>{num}</span>
 </div>
 </label>
 ))}
 </div>

 {encuesta.satisfaccion_general === '1' || encuesta.satisfaccion_general === '2' ? (
   <div className="animate-in fade-in slide-in-from-top-2 duration-300">
     <p className="font-bold text-[13px] text-gray-900 mb-2">Lamentamos que tu experiencia no haya sido la ideal ¿Cuál fue el motivo principal de tu calificación?</p>
     <textarea value={encuesta.satisfaccion_comentario} onChange={(e) => setEncuesta({...encuesta, satisfaccion_comentario: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-[13px] font-normal text-gray-800 focus:outline-none focus:border-primary resize-none" rows={3}></textarea>
   </div>
 ) : encuesta.satisfaccion_general === '3' ? (
   <div className="animate-in fade-in slide-in-from-top-2 duration-300">
     <p className="font-bold text-[13px] text-gray-900 mb-2">Gracias por tu respuesta. ¿Qué hubiéramos podido hacer diferente para mejorar tu experiencia?</p>
     <textarea value={encuesta.satisfaccion_comentario} onChange={(e) => setEncuesta({...encuesta, satisfaccion_comentario: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-[13px] font-normal text-gray-800 focus:outline-none focus:border-primary resize-none" rows={3}></textarea>
   </div>
 ) : encuesta.satisfaccion_general === '4' || encuesta.satisfaccion_general === '5' ? (
   <div className="animate-in fade-in slide-in-from-top-2 duration-300">
     <p className="font-bold text-[13px] text-gray-900 mb-2">¡Nos alegramos! Para seguir brindándote el mejor servicio: ¿Qué fue lo que más te gustó de la atención recibida?</p>
     <textarea value={encuesta.satisfaccion_comentario} onChange={(e) => setEncuesta({...encuesta, satisfaccion_comentario: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-[13px] font-normal text-gray-800 focus:outline-none focus:border-primary resize-none" rows={3}></textarea>
   </div>
 ) : null}
 </div>

 {/* Pregunta 4 */}
 <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 mb-4">
 <p className="font-bold text-[14px] mb-1 text-gray-900">4. ¿Qué tan fácil fue gestionar tu solicitud de {isVt ? 'visita técnica' : 'instalación'}?</p>
 <p className="text-[11px] text-gray-400 mb-4 font-normal">1 = Muy difícil, 5 = Muy fácil</p>
 <div className="flex justify-between gap-1 mb-4">
 {[1,2,3,4,5].map(num => (
 <label key={`fac_${num}`} className="flex-1">
 <input type="radio" name="facilidad" value={num} onChange={(e) => {
   setEncuesta({...encuesta, facilidad_gestion: e.target.value, facilidad_motivo: ''});
 }} className="peer hidden" />
 <div className="border border-gray-100 bg-gray-50 rounded-xl flex flex-col items-center justify-center py-2 cursor-pointer hover:bg-gray-100 peer-checked:border-primary peer-checked:bg-primary/10 transition-all">
 <span className={`text-[14px] font-bold ${encuesta.facilidad_gestion === num.toString() ? 'text-primary' : 'text-gray-500'}`}>{num}</span>
 </div>
 </label>
 ))}
 </div>

 {(encuesta.facilidad_gestion === '1' || encuesta.facilidad_gestion === '2') && (
   <div className="animate-in fade-in slide-in-from-top-2 duration-300 mt-4">
     <p className="font-bold text-[13px] text-gray-900 mb-3">¿Qué fue lo más difícil o incómodo del proceso de {terminoServicio}?</p>
     <div className="flex flex-col gap-2">
       {['Coordinar la visita', 'Tiempo de espera', 'Información o tracking poco claro', 'Atención del técnico', isVt ? 'Duración de la visita técnica' : 'Duración de la instalación', 'Otro'].map(opcion => (
         <label key={opcion} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-transparent has-[:checked]:border-primary has-[:checked]:bg-primary/5">
           <input type="radio" name="facilidad_motivo" value={opcion} onChange={(e) => setEncuesta({...encuesta, facilidad_motivo: e.target.value})} className="accent-primary w-4 h-4" />
           <span className="text-[13px] font-normal text-gray-700">{opcion}</span>
         </label>
       ))}
     </div>
   </div>
 )}
 </div>

 <Button 
 onClick={handleEncuestaSubmit}
 disabled={isSubmittingEncuesta}
 className="w-full bg-primary hover:bg-primary-light text-white h-14 text-[15px] rounded-full shadow-[0_8px_20px_rgba(227,0,27,0.2)] transition-transform active:scale-95 font-bold mt-2">
 {isSubmittingEncuesta ? "Enviando..." : "Enviar encuesta"}
 </Button>
 </div>
 </div>
 );
 })()
 ) : (encuestaEnviada || localStorage.getItem(`encuesta_completada_${token}`) === 'true') && (status === 'finalizada' || status === 'cerrada') ? (
 <div className="py-6">
 <div className="bg-white border border-gray-200 rounded-[24px] p-8 shadow-sm text-center">
 <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-100">
 <CheckCircle2 className="w-10 h-10 text-green-500" strokeWidth={2.5} />
 </div>
 <h2 className="text-2xl font-bold text-gray-900 mb-3">¡Encuesta enviada!</h2>
 <p className="text-[15px] text-gray-500 mb-6 font-normal leading-relaxed px-2">
 Muchas gracias por tomarte el tiempo de responder. Tu opinión es súper valiosa y nos ayuda a seguir mejorando el servicio de WIN para ti.
 </p>
 <div className="inline-flex items-center justify-center px-6 py-3 bg-gray-50 rounded-xl border border-gray-100">
 <span className="text-[13px] font-bold text-gray-700">¡Que disfrutes tu conexión! 🚀</span>
 </div>
 </div>
 </div>
 ) : (
 <>
 {/* Llegada del técnico separada del Info Card */}
 {status === 'en_camino' && (eta || calculatedEta) && (
 <div 
   onClick={toggleSheet}
   className="flex justify-between items-center mb-3 bg-primary/10 px-4 py-3.5 rounded-2xl gap-2 cursor-pointer active:scale-[0.99] transition-transform"
 >
   <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
      </span>
      <span className="text-primary text-[13px] font-bold uppercase tracking-wide">Llegada estimada</span>
   </div>
   <div className="flex justify-between items-center text-right">
      <span className="font-bold text-primary text-[15px]">
        {calculatedEta || eta}
      </span>
   </div>
 </div>
 )}

 {/* Info Card de Visita (Frame 14804 de Figma) */}
 <div className={`border border-gray-100 rounded-[24px] p-5 mb-6 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] ${status === 'en_camino' && (data.token_inicio || eta || calculatedEta) ? '' : 'mt-4'}`}>
 <div className="flex flex-col gap-3.5">
   {/* Día */}
   <div className="flex justify-between items-center">
     <span className="text-gray-400 text-[13px] font-normal">Día</span>
     <span className="font-bold text-gray-900 text-[13px]">
     {data.fecha_programacion && parseSafeDate(data.fecha_programacion) ? (
       toTitleCase(format(parseSafeDate(data.fecha_programacion)!, "d 'de' MMMM", { locale: es }))
     ) : 'Por definir'}
     </span>
   </div>
   
   {/* Rango */}
   {status !== 'en_camino' && (
     <div className="flex justify-between items-center">
       <span className="text-gray-400 text-[13px] font-normal">Rango</span>
       <span className="font-bold text-gray-900 text-[13px]">
       {formatTramoToRange(data.tramo)}
       </span>
     </div>
   )}

   {/* Divider sutil (Rectangle 6872) */}
   <div className="h-[1px] bg-gray-100/90 my-0.5" />
   
   {/* Dirección */}
   <div className="flex justify-between items-start gap-4">
     <span className="text-gray-400 text-[13px] font-normal shrink-0">Dirección</span>
     <span className="font-bold text-gray-900 text-[13px] text-right leading-snug line-clamp-3">
     {formatAddress(data.direccion)}
     </span>
   </div>

   {/* Ticket Asignado (solo para Visita Técnica) o Plan y Servicios (para Instalación) */}
   {data.tipo === 'ticket' ? (
     <div className="bg-[#F8F9FA] border border-gray-100/90 rounded-[18px] p-4 mt-1 flex flex-col">
       <p className="text-[11px] font-medium text-gray-500 tracking-normal mb-1">Ticket</p>
       <p className="text-[16px] font-black text-gray-900 tracking-tight leading-none">
         {data.codisegui || data.idoperacion || 'No especificado'}
       </p>
     </div>
   ) : (() => {
     const parsedPlan = parsePlanData(data.campana);
     return (
       <div className="flex flex-col w-full mt-1 pt-3.5 border-t border-gray-100">
         {/* Paquete de Internet */}
         {parsedPlan.paquete && (
           <div className="mb-3 text-left">
             <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
               Paquete de Internet
             </p>
             <p className="text-[17px] font-black text-gray-900 tracking-tight">
               {toTitleCase(parsedPlan.paquete)}
             </p>
           </div>
         )}
         
         {/* Servicios Adicionales (Lista fija no desplegable) */}
         {parsedPlan.svas.length > 0 && (
           <div className="bg-[#F8F9FA] rounded-[18px] p-4 border border-gray-100/90">
             <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
               Servicios Adicionales
             </p>
             <div className="flex flex-col gap-3">
               {parsedPlan.svas.map((sva, idx) => {
                 let SvaIcon = PiPackage;
                 const svaLower = sva.toLowerCase();
                 if (svaLower.includes('tv') || svaLower.includes('l1max')) SvaIcon = PiTelevisionSimple;
                 else if (svaLower.includes('box')) SvaIcon = PiPackage;
                 else if (svaLower.includes('mesh')) SvaIcon = PiWifiHigh;
                 else if (svaLower.includes('antivirus') || svaLower.includes('seguridad')) SvaIcon = PiShieldCheck;
                 else if (svaLower.includes('aumento')) SvaIcon = PiLightning;

                 return (
                   <div key={idx} className="flex items-center gap-2.5">
                     <div className="w-7 h-7 rounded-full bg-[#FF5A0A]/10 flex items-center justify-center shrink-0">
                       <SvaIcon className="w-3.5 h-3.5 text-[#FF5A0A]" />
                     </div>
                     <span className="text-[13px] font-semibold text-gray-800 leading-tight">
                       {toTitleCase(sva)}
                     </span>
                   </div>
                 );
               })}
             </div>
           </div>
         )}

         {/* Fallback si no hay paquete separado por pipetas */}
         {!parsedPlan.paquete && data.campana && (
           <div className="bg-[#F8F9FA] border border-gray-100/90 rounded-[18px] p-4 text-gray-900 mt-1">
             <p className="text-[13px] font-bold leading-snug">{toTitleCase(data.campana)}</p>
           </div>
         )}
       </div>
     );
   })()}
 </div>
 </div>

{/* Vertical Timeline - Homologado Figma Nuevo */}
        <div className="relative pl-[28px] border-l-[2px] border-dashed border-[#E4E7E9] ml-4 mb-8 mt-4">
        {steps.map((step, i) => {
        const isCompleted = i <= statusIndex;
        return (
        <div key={step.id} className="relative pb-8 last:pb-0">
        {/* Timeline Dot / Icon */}
        <div className="absolute -left-[39px] top-0 flex items-center justify-center">
        {isCompleted ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <path d="M15 1.34C16.5083 2.211 17.7629 3.46 18.6398 4.965C19.5167 6.47 19.9854 8.178 19.9994 9.919C20.0135 11.661 19.5725 13.376 18.72 14.895C17.8676 16.413 16.6332 17.683 15.1392 18.578C13.6452 19.473 11.9434 19.963 10.2021 19.998C8.4608 20.033 6.7406 19.613 5.2116 18.779C3.6826 17.945 2.3979 16.726 1.4847 15.243C0.5715 13.76 0.0614 12.065 0.005 10.324L0 10L0.005 9.676C0.061 7.949 0.5635 6.266 1.4636 4.791C2.3637 3.316 3.6307 2.099 5.1409 1.26C6.6511 0.42 8.3531 -0.014 10.081 0C11.8089 0.014 13.5036 0.476 15 1.34ZM13.707 7.293C13.5348 7.121 13.3057 7.017 13.0627 7.002C12.8197 6.987 12.5794 7.061 12.387 7.21L12.293 7.293L9 10.585L7.707 9.293L7.613 9.21C7.4206 9.061 7.1804 8.987 6.9374 9.002C6.6944 9.018 6.4654 9.121 6.2933 9.293C6.1211 9.465 6.0177 9.694 6.0024 9.937C5.987 10.18 6.0609 10.42 6.21 10.613L6.293 10.707L8.293 12.707L8.387 12.79C8.5624 12.926 8.778 13 9 13C9.222 13 9.4376 12.926 9.613 12.79L9.707 12.707L13.707 8.707L13.79 8.613C13.9393 8.42 14.0132 8.18 13.9979 7.937C13.9826 7.694 13.8792 7.465 13.707 7.293Z" fill="#FF5A0A"/>
          </svg>
        ) : (
          <div className="w-[20px] h-[20px] rounded-full bg-[#D9D9D9] flex items-center justify-center shrink-0" />
        )}
        </div>
        
        {/* Content */}
        <div className="flex flex-col justify-start">
        <h4 className={`text-[14px] leading-tight font-bold ${isCompleted ? 'text-[#26292E]' : 'text-[#A0A2AC]'}`}>
        {step.label}
        </h4>
        
        {/* Subtítulo: Solo se muestra en el estado actual o completado, los estados inactivos/pendientes NO llevan subtítulo */}
        {isCompleted && step.sub && (
        <p className="text-[12px] leading-tight mt-1 text-[#535C67]">
        {step.sub}
        </p>
        )}

        {/* Technician Box homologado con Figma (FirmaNuevoSVG) */}
        {step.id === 'asignado' && isCompleted && tecnico && status !== 'finalizada' && status !== 'cerrada' && (
        <div className="flex items-center gap-3 bg-[#F3F3F3] p-3 rounded-[10px] mt-3 -ml-1 shadow-none border-none">
        <div 
          onClick={() => {
            if (tecnico.foto && !hasImageError) setIsPhotoModalOpen(true);
          }}
          className={`w-[44px] h-[44px] rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden ${
            tecnico.foto && !hasImageError ? 'cursor-pointer hover:ring-2 hover:ring-[#FF5A0A]/50 transition-all shadow-sm' : ''
          }`}
          title={tecnico.foto && !hasImageError ? "Ver foto del técnico" : undefined}
        >
          {tecnico.foto && !hasImageError ? (
            <img 
              src={tecnico.foto} 
              alt="" 
              onError={() => setHasImageError(true)}
              className="w-full h-full object-cover" 
            />
          ) : (
            <User className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
        <p className="font-bold text-[#26292E] text-[13px] leading-tight mb-1 truncate">
        {extractTechnicianName(tecnico.nombre, tecnico.cuadrilla)}
        </p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
        {tecnico.dni && (
          <div className="flex items-center gap-1.5 text-[#535C67]">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <path d="M1.625 3.292C1.625 2.861 1.796 2.448 2.101 2.143C2.406 1.838 2.819 1.667 3.25 1.667H9.75C10.181 1.667 10.594 1.838 10.899 2.143C11.204 2.448 11.375 2.861 11.375 3.292V8.709C11.375 9.14 11.204 9.553 10.899 9.858C10.594 10.162 10.181 10.334 9.75 10.334H3.25C2.819 10.334 2.406 10.162 2.101 9.858C1.796 9.553 1.625 9.14 1.625 8.709V3.292Z" stroke="#535C67" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.11 5.682C3.907 5.682 3.75 5.525 3.75 5.322C3.75 5.119 3.907 4.962 4.11 4.962H5.19C5.393 4.962 5.55 5.119 5.55 5.322C5.55 5.525 5.393 5.682 5.19 5.682H4.11ZM7.36 5.682C7.157 5.682 7 5.525 7 5.322C7 5.119 7.157 4.962 7.36 4.962H8.89C9.093 4.962 9.25 5.119 9.25 5.322C9.25 5.525 9.093 5.682 8.89 5.682H7.36Z" fill="#535C67"/>
            </svg>
            <span className="text-[11px] font-medium text-[#535C67]">{formatMaskedDni(tecnico.dni)}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <path d="M4.278 2.864L1.353 3.288L1.302 3.298C1.223 3.319 1.152 3.36 1.095 3.418C1.037 3.475 0.996 3.547 0.976 3.626C0.955 3.704 0.956 3.787 0.978 3.865C1 3.943 1.042 4.014 1.1 4.07L3.218 6.132L2.719 9.045L2.713 9.095C2.708 9.176 2.725 9.257 2.762 9.33C2.798 9.402 2.854 9.464 2.922 9.508C2.99 9.552 3.069 9.577 3.15 9.58C3.231 9.584 3.312 9.566 3.384 9.528L5.999 8.153L8.608 9.528L8.654 9.549C8.73 9.579 8.812 9.588 8.892 9.576C8.973 9.563 9.048 9.53 9.111 9.478C9.175 9.427 9.223 9.36 9.251 9.284C9.28 9.207 9.288 9.125 9.274 9.045L8.774 6.132L10.893 4.07L10.929 4.031C10.98 3.968 11.014 3.893 11.026 3.813C11.038 3.732 11.03 3.651 11 3.575C10.971 3.5 10.922 3.433 10.858 3.383C10.795 3.333 10.719 3.3 10.639 3.288L7.715 2.864L6.408 0.215C6.37 0.138 6.311 0.073 6.238 0.028C6.166 -0.017 6.082 -0.041 5.996 -0.041C5.911 -0.041 5.827 -0.017 5.754 0.028C5.682 0.073 5.623 0.138 5.585 0.215L4.278 2.864Z" fill="#FFC200"/>
          </svg>
          <span className="text-[11px] font-bold text-[#535C67]">4.9</span>
 </div>
 </div>
 </div>
 </div>
 )}
 
 </div>
 </div>
 );
 })}
 </div>

 {/* Action Buttons and Help Center CTA (Bottom) */}
 <div className="flex flex-col items-center gap-3 pt-3 pb-4 border-t border-gray-100 mt-2">
 {(status === 'programada' || status === 'asignado') && (
 <button 
 onClick={() => {
   trackEvent('click_iniciar_reprogramacion', { token, estado_actual: status });
   setIsReprogramModalOpen(true);
   setReprogramStep('form');
 }}
 className="w-full bg-[#2B2B2B] hover:bg-[#1E1E1E] text-white h-12 rounded-full text-[14px] font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md cursor-pointer"
 >
 <CalendarDays className="w-4 h-4 text-white" />
 <span>Reprogramar Visita</span>
 </button>
 )}
 <button 
 onClick={() => {
   trackEvent('click_contactar_soporte', { token });
   const isVt = data?.tipo === 'ticket';
   const wspNumber = isVt ? '51922863186' : '51923229369';
   const msg = encodeURIComponent(isVt ? "Hola, necesito soporte con mi Visita Técnica." : "Hola, necesito soporte con mi instalación.");
   window.open(`https://wa.me/${wspNumber}?text=${msg}`);
 }}
 className="text-[13px] text-gray-600 hover:text-primary font-normal text-center py-1 transition-colors cursor-pointer hover:underline"
 >
 ¿Necesitas ayuda?
 </button>
 </div>
 </>
 )}
 </div>
 </motion.div>

 {/* MODALS REPROGRAMAR Y CANCELAR */}
 <AnimatePresence>
 {isCancelModalOpen && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
 >
 <motion.div
 initial={{ scale: 0.9, opacity: 0, y: 20 }}
 animate={{ scale: 1, opacity: 1, y: 0 }}
 exit={{ scale: 0.9, opacity: 0, y: 20 }}
 className="bg-white rounded-[20px] p-6 w-[290px] relative flex flex-col items-center text-center shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
 >
 <button 
 onClick={() => setIsCancelModalOpen(false)}
 className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
 aria-label="Cerrar"
 >
 <X className="w-5 h-5 stroke-[2]" />
 </button>

 <AlertTriangle className="w-12 h-12 text-[#FF5A0A] mb-4 stroke-[1.8]" />
 <h3 className="text-[16px] font-bold text-[#0F090B] mb-2 leading-tight">¿Deseas cancelar?</h3>
 <p className="text-[13px] text-gray-500 mb-6 font-normal leading-relaxed">
 Si deseas cancelar tu atención por favor comunícate a nuestros canales de atención.
 </p>
 <div className="flex flex-col w-full gap-2.5">
 <button 
 className="w-full bg-[#FF5A0A] text-white rounded-full h-[44px] text-[14px] font-bold shadow-[0_4px_12px_rgba(255,90,10,0.25)] active:scale-95 transition-transform" 
 onClick={() => window.open('tel:017546000')}
 >
 Llamar a Central
 </button>
 <button 
 className="w-full rounded-full h-[44px] text-[14px] font-bold text-[#0F090B] bg-[#f2f2f2] hover:bg-[#e8e7e8] active:scale-95 transition-transform" 
 onClick={() => setIsCancelModalOpen(false)}
 >
 Volver al seguimiento
 </button>
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>

 <AnimatePresence>
 {isReprogramModalOpen && (
 <motion.div
 initial={{ x: "100%" }}
 animate={{ x: 0 }}
 exit={{ x: "100%" }}
 transition={{ type: "spring", damping: 25, stiffness: 200 }}
 className="fixed inset-0 z-[100] bg-[#F5F6F8] flex flex-col font-sans"
 >
 {/* Header */}
 <div className="bg-white px-4 py-3.5 flex items-center shadow-sm z-10 shrink-0 border-b border-gray-100">
 <button 
 onClick={() => {
   setIsReprogramModalOpen(false);
   setReprogramStep('form');
 }} 
 className="p-1 -ml-1 text-[#FF5A0A] hover:bg-orange-50 rounded-full transition-colors cursor-pointer"
 >
 <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
 </button>
 <h2 className="flex-1 text-center font-bold text-[#FF5A0A] pr-7 text-[16px]">Reprogramación de visita</h2>
 </div>
 
 {/* Body */}
 <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
 {/* Direction Box */}
 <div className="bg-white p-4 rounded-[16px] flex items-center gap-3.5 border border-[#E4E7E9] shadow-sm">
 <div className="w-10 h-10 rounded-full bg-[#F3F3F3] flex items-center justify-center shrink-0">
   <MapPin className="w-5 h-5 text-[#141414] stroke-[2]" />
 </div>
 <div className="min-w-0 flex-1">
   <p className="text-[11px] text-[#535C67] font-medium mb-0.5">Dirección</p>
   <p className="text-[13px] font-bold text-[#26292E] leading-snug line-clamp-2">
     {data.direccion ? data.direccion.split(/\|\|referencia:|\|referencia:|referencia:/i)[0].trim() : 'Cargando...'}
   </p>
 </div>
 </div>

 {/* Date Box */}
 <div className="bg-white p-4 rounded-[22px] shadow-sm border border-[#E4E7E9]">
 <div className="mb-2">
   <h3 className="font-bold text-[15px] text-[#26292E]">Selecciona la fecha</h3>
 </div>
 <div className="flex items-center gap-2 mb-3.5">
   <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
     <circle cx="7.5" cy="7.5" r="6.5" stroke="#FF5A0A" strokeWidth="1.2" />
     <path d="M7.5 4.5V7.5M7.5 10.5H7.51" stroke="#FF5A0A" strokeWidth="1.2" strokeLinecap="round" />
   </svg>
   <p className="text-[12px] text-[#FF5A0A] leading-tight font-normal">
     Ten en cuenta que depende de la disponibilidad de cupos.
   </p>
 </div>

 {/* Selector interactivo de los 7 días (4 en primera fila, 3 en segunda fila) */}
 <div className="grid grid-cols-4 gap-2.5">
   {getAvailableDays().map((day) => {
     const isSelected = reprogramData.fecha === day.iso;
     return (
       <button
         key={day.iso}
         type="button"
         onClick={() => setReprogramData({ ...reprogramData, fecha: day.iso })}
         className={`flex flex-col items-center justify-center h-[69px] rounded-[12px] border transition-all cursor-pointer ${
           isSelected
             ? 'border-[#FF5A0A] bg-[#FFEDE0] text-[#FF5A0A]'
             : 'border-[#D9D9D9] bg-white text-[#9CA5AB] hover:border-[#FF5A0A]/40'
         }`}
       >
         <span className={`text-[11px] font-medium ${isSelected ? 'text-[#FF5A0A] font-bold' : 'text-[#9CA5AB]'}`}>
           {day.isTomorrow ? 'Mañana' : day.dayOfWeek}
         </span>
         <span className={`text-[18px] font-bold my-0.5 ${isSelected ? 'text-[#FF5A0A]' : 'text-black'}`}>
           {day.dayNum}
         </span>
         <span className={`text-[11px] font-medium ${isSelected ? 'text-[#FF5A0A] font-bold' : 'text-[#9CA5AB]'}`}>
           {day.monthName}
         </span>
       </button>
     );
   })}
 </div>
 </div>

 {/* Time Slot Box */}
 <div className="bg-white p-4 rounded-[22px] shadow-sm border border-[#E4E7E9]">
 <h3 className="font-bold text-[15px] text-[#26292E] mb-3">Selecciona el tramo horario</h3>
 <div className="flex flex-col gap-2.5">
 {['08:00 a.m. - 12:00 p.m.', '12:00 p.m. - 4:00 p.m.', '04:00 p.m. - 8:00 p.m.'].map((turno) => {
   const isSelected = reprogramData.turno === turno;
   return (
     <button
       key={turno}
       type="button"
       onClick={() => setReprogramData({ ...reprogramData, turno })}
       className={`w-full h-[46px] rounded-[14px] flex items-center justify-center font-bold text-[13px] transition-all cursor-pointer ${
         isSelected
           ? 'border border-[#FF5A0A] bg-[#FFEDE0] text-[#FF5903]'
           : 'border border-[#D1D5DC] bg-white text-[#26292E] hover:border-[#FF5A0A]/50'
       }`}
     >
       {turno}
     </button>
   );
 })}
 </div>
 </div>

 {/* Motivo Box */}
 <div className="bg-white p-4 rounded-[22px] shadow-sm border border-[#E4E7E9]">
 <h3 className="font-bold text-[15px] text-[#26292E] mb-3">Motivo de reprogramación</h3>
 
 <div className="mb-4 relative">
 <select
   value={reprogramData.motivoSeleccionado}
   onChange={(e) => setReprogramData({ ...reprogramData, motivoSeleccionado: e.target.value })}
   className={`w-full h-[46px] rounded-[14px] px-4 pr-10 text-[13px] font-medium border appearance-none transition-all cursor-pointer focus:outline-none ${
     reprogramData.motivoSeleccionado
       ? 'border-[#FF5A0A] bg-[#FFEDE0] text-[#FF5903]'
       : 'border-[#D1D5DC] bg-white text-gray-500 hover:border-gray-400'
   }`}
 >
   <option value="" disabled>Elige una opción</option>
   <option value="emergencia_personal">Emergencia personal / familiar</option>
   <option value="problemas_salud">Problemas de salud</option>
   <option value="viaje_inesperado">Viaje de último minuto</option>
   <option value="choque_horarios">Cruce de horarios con el trabajo / estudios</option>
   <option value="olvido">Olvidé la cita original</option>
   <option value="otro">Otro motivo</option>
 </select>
 <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
   <ChevronDown className={`w-4 h-4 ${reprogramData.motivoSeleccionado ? 'text-[#FF5903]' : 'text-gray-400'}`} />
 </div>
 </div>

 <h3 className="font-bold text-[14px] text-[#26292E] mb-2.5">Detalle adicional (Opcional)</h3>
 <textarea 
   value={reprogramData.motivo}
   onChange={(e) => setReprogramData({ ...reprogramData, motivo: e.target.value })}
   className="w-full bg-[#F9F9F9] border border-[#E4E7E9] rounded-[14px] p-3 text-[13px] text-gray-800 focus:outline-none focus:border-[#FF5A0A] resize-none placeholder:text-gray-400" 
   rows={2} 
   placeholder="Ej: No estaré en casa, por favor venir por la tarde..."
 ></textarea>
 </div>
 </div>

 {/* Footer CTA */}
 <div className="bg-white p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] shrink-0 border-t border-gray-100">
 <button 
 disabled={!reprogramData.fecha || !reprogramData.turno || !reprogramData.motivoSeleccionado}
 onClick={() => setReprogramStep('confirm_popup')}
 className="w-full bg-[#FF5A0A] disabled:bg-[#E4E7E9] disabled:text-[#A0A2AC] text-white font-bold h-12 rounded-full text-[14px] transition-all shadow-md disabled:shadow-none cursor-pointer disabled:cursor-not-allowed active:scale-95 disabled:active:scale-100"
 >
 Confirmar reprogramación
 </button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Confirm & Success Modals inside Reprogram flow (Figma Pop1 & Pop2) */}
  <AnimatePresence>
  {isReprogramModalOpen && reprogramStep === 'confirm_popup' && (
  <motion.div 
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="fixed inset-0 z-[110] bg-[#26292E]/40 flex items-center justify-center p-4 backdrop-blur-sm"
  >
  <motion.div 
  initial={{ scale: 0.9, y: 20 }}
  animate={{ scale: 1, y: 0 }}
  exit={{ scale: 0.9, y: 20 }}
  className="bg-white rounded-[32px] p-6 w-[342px] max-w-full relative flex flex-col items-center text-center shadow-xl"
  >
  {/* Circular Icon with Calendar (Exact Figma Pop1) */}
  <div className="w-[72px] h-[72px] relative flex items-center justify-center mb-4">
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="shrink-0">
      <path d="M62 26C58.5 15.5 48 8 36 8C20.5 8 8 20.5 8 36C8 51.5 20.5 64 36 64C47.5 64 57.5 57 61.5 47" stroke="#FF5A0A" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="23" y="25" width="26" height="24" rx="4" stroke="#0F0908" strokeWidth="3" />
      <path d="M30 20V26M42 20V26M23 33H49" stroke="#0F0908" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  </div>

  <h3 className="text-[17px] font-bold text-[#26292E] leading-snug px-1 mb-2">
    ¿Confirmas la reprogramación de tu visita técnica?
  </h3>
  <p className="text-[13px] text-[#535C67] leading-relaxed mb-5 px-1">
    Tu visita técnica actual será reemplazada por la nueva fecha y horario que elegiste.
  </p>

  {/* Resumen Box */}
  <div className="w-full bg-[#F8F9FA] rounded-[20px] p-4 flex flex-col gap-3.5 mb-6 text-left border border-gray-100">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-[#F3F3F3] flex items-center justify-center shrink-0">
        <Calendar className="w-5 h-5 text-[#141414] stroke-[1.8]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-[#9CA5AB] uppercase tracking-wider">Nueva fecha</p>
        <p className="text-[14px] font-bold text-[#26292E] truncate">{formatSelectedDate(reprogramData.fecha)}</p>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-[#F3F3F3] flex items-center justify-center shrink-0">
        <Clock className="w-5 h-5 text-[#141414] stroke-[1.8]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-[#9CA5AB] uppercase tracking-wider">Tramo horario</p>
        <p className="text-[14px] font-bold text-[#26292E] truncate">{reprogramData.turno}</p>
      </div>
    </div>
  </div>

  <button 
  disabled={isSubmittingReprogram}
  onClick={handleReprogramSubmit}
  className="w-full bg-[#FF5A0A] text-white font-bold h-12 rounded-full text-[14px] mb-2.5 shadow-md shadow-[#FF5A0A]/20 active:scale-95 transition-transform cursor-pointer"
  >
  {isSubmittingReprogram ? "Confirmando..." : "Confirmar"}
  </button>
  <button 
  disabled={isSubmittingReprogram}
  onClick={() => setReprogramStep('form')}
  className="w-full bg-transparent border border-[#FF5A0A] text-[#FF5A0A] font-bold h-12 rounded-full text-[14px] active:scale-95 transition-transform cursor-pointer hover:bg-orange-50"
  >
  Cancelar
  </button>
  </motion.div>
  </motion.div>
  )}

  {isReprogramModalOpen && reprogramStep === 'success' && (
  <motion.div 
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="fixed inset-0 z-[120] bg-[#26292E]/40 flex items-center justify-center p-4 backdrop-blur-sm"
  >
  <motion.div 
  initial={{ scale: 0.9, y: 20 }}
  animate={{ scale: 1, y: 0 }}
  exit={{ scale: 0.9, y: 20 }}
  className="bg-white rounded-[32px] p-6 w-[342px] max-w-full relative flex flex-col items-center text-center shadow-xl"
  >
  {/* Circular Icon with Checkmark (Exact Figma Pop2) */}
  <div className="w-[72px] h-[72px] relative flex items-center justify-center mb-4">
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="shrink-0">
      <path d="M62 26C58.5 15.5 48 8 36 8C20.5 8 8 20.5 8 36C8 51.5 20.5 64 36 64C47.5 64 57.5 57 61.5 47" stroke="#FF5A0A" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M50 25L32 45L23 36" stroke="#301D19" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>

  <h3 className="text-[18px] font-bold text-[#26292E] mb-2 leading-tight">Visita reprogramada</h3>
  <p className="text-[13px] text-[#535C67] mb-6 font-normal leading-relaxed px-1">
  Tu nueva visita ha sido confirmada, revisa todos los detalles desde el historial de visitas.
  </p>
  <button 
  onClick={() => {
    setIsReprogramModalOpen(false);
    setReprogramStep('form');
    setIsReprogramCompletada(true);
  }}
  className="w-full bg-[#FF5A0A] text-white font-bold h-12 rounded-full text-[14px] shadow-md shadow-[#FF5A0A]/20 active:scale-95 transition-transform cursor-pointer"
  >
  Aceptar
  </button>
  </motion.div>
  </motion.div>
  )}
  </AnimatePresence>

  {/* Modal de Foto Ampliada del Técnico */}
  <AnimatePresence>
    {isPhotoModalOpen && tecnico?.foto && !hasImageError && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[130] bg-black/75 flex items-center justify-center p-4 backdrop-blur-md"
        onClick={() => setIsPhotoModalOpen(false)}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 320 }}
          className="relative bg-white rounded-[28px] p-6 max-w-[320px] w-full shadow-2xl flex flex-col items-center text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setIsPhotoModalOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Círculo Grande con la Foto del Técnico */}
          <div className="w-44 h-44 rounded-full p-1.5 border-[3.5px] border-[#FF5A0A] shadow-xl overflow-hidden mb-4 bg-gray-100 flex items-center justify-center">
            <img
              src={tecnico.foto}
              alt=""
              onError={() => {
                setHasImageError(true);
                setIsPhotoModalOpen(false);
              }}
              className="w-full h-full object-cover rounded-full"
            />
          </div>

          <h3 className="text-[16px] font-bold text-gray-900 leading-tight mb-1 px-2">
            {extractTechnicianName(tecnico.nombre, tecnico.cuadrilla)}
          </h3>

          <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
            {tecnico.dni && (
              <>
                <div className="flex items-center gap-1 text-gray-600 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                  <IdCard className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[12px] font-medium text-gray-700">{formatMaskedDni(tecnico.dni)}</span>
                </div>
                <span className="text-[11px] text-gray-300">•</span>
              </>
            )}
            <div className="flex items-center gap-1 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100 text-primary">
              <Star className="w-3.5 h-3.5 fill-primary text-primary" />
              <span className="text-[12px] font-bold text-gray-700">4.9</span>
            </div>
          </div>

          <button
            onClick={() => setIsPhotoModalOpen(false)}
            className="w-full mt-6 py-3 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 font-bold rounded-full text-[13px] transition-all"
          >
            Cerrar
          </button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>

 </div>
  );
};
export default Seguimiento;