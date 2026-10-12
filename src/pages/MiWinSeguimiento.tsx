import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import Seguimiento from "./Seguimiento";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle } from "lucide-react";

export interface VisitaItem {
  idoperacion: string | number;
  token: string;
  pin_token?: string | null;
  tipo: 'ticket' | 'instalacion';
  titulo: string;
  ticketLabel: string;
  codisegui?: string | null;
  producto: string;
  campana?: string | null;
  direccion: string;
  estado: string;
  estado_raw?: string;
  fecha?: string;
  tramo?: string;
}

// Helper para formatear fecha en formato corto (ej. "NOV23", "OCT24")
function formatMonthYearShort(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const month = months[d.getUTCMonth()];
    const yearShort = String(d.getUTCFullYear()).slice(-2);
    return `${month}${yearShort}`;
  } catch {
    return '';
  }
}

// Extraer nombre del plan asignado formateado con fecha (como en Figma: "Mono 200 Mbps - NOV23")
function getPlanDisplayName(visita?: VisitaItem): string {
  if (!visita) return 'Mi Servicio';

  let basePlan = '';

  // 1. Extraer del campo campana si tiene "Paquete:"
  if (visita.campana && visita.campana.includes('|')) {
    const parts = visita.campana.split('|');
    for (const part of parts) {
      const [k, ...v] = part.split(':');
      if (k && k.trim().toLowerCase() === 'paquete') {
        const val = v.join(':').trim();
        if (val && !/aprobado/i.test(val)) {
          basePlan = val;
          break;
        }
      }
    }
  }

  // 2. Si no, tomar de producto
  if (!basePlan) {
    basePlan = visita.producto || visita.titulo || 'Plan Internet';
  }

  // Limpiar sufijos técnicos
  basePlan = basePlan.replace(/\b(SGI|SGA|SGM|FTTH)\b/gi, '').trim();

  // 3. Añadir fecha en formato corto (ej. "- NOV23") si existe fecha
  const dateTag = formatMonthYearShort(visita.fecha);
  if (dateTag && !basePlan.toUpperCase().includes(dateTag)) {
    return `${basePlan} - ${dateTag}`;
  }

  return basePlan;
}

export default function MiWinSeguimiento() {
  const { dni: paramDni } = useParams<{ dni: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // El DNI puede venir por path param (:dni) o por query param (?dni=12345678)
  const dni = paramDni || searchParams.get('dni') || '';

  const [visitas, setVisitas] = useState<VisitaItem[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  useEffect(() => {
    if (!dni || dni.length < 5) {
      setErrorMsg("No se proporcionó un número de documento válido.");
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function fetchVisitas() {
      try {
        setLoading(true);
        setErrorMsg(null);
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        let res = await fetch(`${baseUrl}/api/cliente/visitas/${dni}`);
        
        // Fallback al backend local si el entorno remoto no tiene aún el endpoint
        if (!res.ok && baseUrl !== 'http://localhost:3001') {
          try {
            const localRes = await fetch(`http://localhost:3001/api/cliente/visitas/${dni}`);
            if (localRes.ok) res = localRes;
          } catch {}
        }

        if (!res.ok) {
          throw new Error("No se pudieron cargar las visitas.");
        }
        const data = await res.json();
        if (!isMounted) return;

        if (data.success && data.visitas && data.visitas.length > 0) {
          setVisitas(data.visitas);
          
          // Si la URL ya trae un token específico o predeterminamos el primero/en_camino
          const priority = data.visitas.find((v: VisitaItem) => v.estado === 'en_camino') || data.visitas[0];
          setSelectedToken(priority.token);
        } else {
          setVisitas([]);
          setErrorMsg("No cuentas con visitas técnicas ni instalaciones programadas.");
        }
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMsg(err.message || "Error al conectar con el servidor.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchVisitas();
    return () => { isMounted = false; };
  }, [dni]);

  const selectedVisita = visitas.find(v => v.token === selectedToken) || visitas[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-[#FF5A0A] animate-spin mb-4" />
        <p className="text-[15px] font-bold text-[#26292E]">Consultando tus visitas programadas...</p>
        <p className="text-[13px] text-gray-400 mt-1">Por favor espera un momento</p>
      </div>
    );
  }

  if (errorMsg || visitas.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#FFF6ED] flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-[#FF5A0A]" />
        </div>
        <h2 className="text-[18px] font-bold text-[#26292E] mb-2">Visitas no encontradas</h2>
        <p className="text-[14px] text-gray-500 max-w-xs mb-6 leading-relaxed">
          {errorMsg || "No se encontraron atenciones activas asociadas a este documento."}
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 rounded-full bg-[#FF5A0A] text-white text-[14px] font-bold shadow-md hover:bg-[#E04E07] transition-all"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  // Componente del Selector de Servicio que se inserta de forma nativa en la vista
  const renderServiceSelector = () => {
    if (visitas.length <= 1) return null;

    // Obtener el nombre del servicio o plan con fecha asignada (como en Figma: "Mono 200 Mbps - NOV23")
    const displayLabel = getPlanDisplayName(selectedVisita);

    return (
      <div className="w-full flex justify-center mb-1 mt-1">
        <button
          type="button"
          onClick={() => setIsSelectorOpen(true)}
          className="inline-flex items-center justify-between gap-2.5 bg-white hover:bg-gray-50 active:scale-98 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-full px-3.5 py-1.5 transition-all cursor-pointer max-w-full"
        >
          {/* Icono oficial de Figma (Antena / Emisor naranja #FF5A0A del SVG 251x24) */}
          <div className="w-4 h-4 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M10.6666 12.9163C13.0211 13.3792 14.6666 14.4365 14.6666 15.6667C14.6666 17.3235 11.6818 18.6667 7.99992 18.6667C4.31802 18.6667 1.33325 17.3235 1.33325 15.6667C1.33325 14.4365 2.97871 13.3792 5.33325 12.9163M7.99992 15.3333V10M7.99992 10C9.10449 10 9.99992 9.10457 9.99992 8C9.99992 6.89543 9.10449 6 7.99992 6C6.89535 6 5.99992 6.89543 5.99992 8C5.99992 9.10457 6.89535 10 7.99992 10Z" 
                stroke="#FF5A0A" 
                strokeWidth="1.33333" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Nombre del servicio con plan y fecha asignada */}
          <span className="text-[13px] font-bold text-[#26292E] tracking-tight truncate max-w-[230px]">
            {displayLabel}
          </span>

          {/* Flecha Chevron hacia abajo oficial de Figma: M239 10L243 14L247 10 */}
          <div className="shrink-0 pl-1 flex items-center justify-center">
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L5 5L9 1" stroke="#26292E" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen w-full bg-[#F4F5F7] overflow-x-hidden">
      {/* Vista de seguimiento embebida inyectándole el selector interno */}
      {selectedToken && (
        <div key={selectedToken} className="w-full">
          <Seguimiento 
            customToken={selectedToken} 
            renderServiceSelector={renderServiceSelector}
          />
        </div>
      )}

      {/* 
        BOTTOM SHEET MODAL DE SELECCIÓN (FIGMA FRAME 2: "Selecciona un servicio")
      */}
      <AnimatePresence>
        {isSelectorOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop oscuro semitransparente como en Figma */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSelectorOpen(false)}
              className="absolute inset-0 bg-[#26292E]/40 backdrop-blur-[2px]"
            />

            {/* Sheet Container */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md mx-auto bg-white rounded-t-[28px] shadow-2xl overflow-hidden pb-8 z-10"
            >
              {/* Drag Handle superior */}
              <div className="w-full flex items-center justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-[#E2E2E2] rounded-full" />
              </div>

              {/* Cabecera del Bottom Sheet */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <h3 className="text-[16px] font-bold text-[#26292E] tracking-tight">
                  Selecciona un servicio
                </h3>
                {/* Botón X de cierre según Figma */}
                <button
                  onClick={() => setIsSelectorOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 3L3 11M3 3L11 11" stroke="#26292E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Lista de visitas con Radio Buttons personalizados de Figma */}
              <div className="flex flex-col px-3 py-2 max-h-[60vh] overflow-y-auto">
                {visitas.map((v, idx) => {
                  const isSelected = v.token === selectedToken;
                  const itemTitle = getPlanDisplayName(v);

                  return (
                    <div key={v.token}>
                      <div
                        onClick={() => {
                          setSelectedToken(v.token);
                          setIsSelectorOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-3.5 rounded-[18px] cursor-pointer transition-all ${
                          isSelected ? 'bg-[#FFF9F5]' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0 pr-3">
                          {/* Icono de Casa / Antena según Figma */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected ? 'bg-[#FFEFE7]' : 'bg-gray-100'
                          }`}>
                            <svg width="15" height="15" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path 
                                d="M10.6666 12.9163C13.0211 13.3792 14.6666 14.4365 14.6666 15.6667C14.6666 17.3235 11.6818 18.6667 7.99992 18.6667C4.31802 18.6667 1.33325 17.3235 1.33325 15.6667C1.33325 14.4365 2.97871 13.3792 5.33325 12.9163M7.99992 15.3333V10M7.99992 10C9.10449 10 9.99992 9.10457 9.99992 8C9.99992 6.89543 9.10449 6 7.99992 6C6.89535 6 5.99992 6.89543 5.99992 8C5.99992 9.10457 6.89535 10 7.99992 10Z" 
                                stroke={isSelected ? "#FF5A0A" : "#616E79"} 
                                strokeWidth="1.33333" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>

                          <div className="flex flex-col text-left min-w-0">
                            <span className="text-[14px] font-bold text-[#26292E] leading-snug truncate">
                              {itemTitle}
                            </span>
                            <span className="text-[12px] text-gray-500 leading-snug mt-0.5 line-clamp-2">
                              {v.direccion}
                            </span>
                          </div>
                        </div>

                        {/* Radio Button Custom Figma */}
                        <div className="shrink-0 flex items-center justify-center pl-2">
                          {isSelected ? (
                            <div className="w-[23px] h-[23px] rounded-full border border-[#FF5A0A] bg-[#FFF6ED] flex items-center justify-center">
                              <div className="w-[10px] h-[10px] rounded-full bg-[#FF5A0A]" />
                            </div>
                          ) : (
                            <div className="w-[23px] h-[23px] rounded-full border border-[#616E79] bg-white" />
                          )}
                        </div>
                      </div>

                      {/* Separador sutil entre opciones según Figma */}
                      {idx < visitas.length - 1 && (
                        <div className="h-[1px] bg-[#141414]/5 mx-3 my-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
