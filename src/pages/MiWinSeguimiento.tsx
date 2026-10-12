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
  direccion: string;
  estado: string;
  estado_raw?: string;
  fecha?: string;
  tramo?: string;
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

  return (
    <div className="relative min-h-screen w-full bg-[#F4F5F7] overflow-x-hidden">
      {/* 
        Si el cliente tiene más de 1 visita, renderizamos en la parte superior 
        el Selector Pill de Figma Frame 1 (375x44)
      */}
      {visitas.length > 1 && (
        <div className="sticky top-0 z-40 w-full max-w-md mx-auto bg-white border-b border-gray-100 shadow-sm px-4 py-2 flex items-center justify-center">
          <button
            onClick={() => setIsSelectorOpen(true)}
            className="w-full flex items-center justify-between bg-white hover:bg-gray-50 active:scale-[0.99] border border-gray-200/80 rounded-[18px] px-3.5 py-2.5 transition-all shadow-sm"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Icono de servicio según Figma (Pin / Ubicación / Casa) */}
              <div className="w-6 h-6 rounded-full bg-[#FFEFE7] flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.667 6.667L8 2.667L13.333 6.667V13.333H10.667V9.333H5.333V13.333H2.667V6.667Z" stroke="#FF5A0A" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="flex flex-col text-left truncate">
                <span className="text-[13px] font-bold text-[#26292E] leading-tight truncate">
                  {selectedVisita?.titulo} • {selectedVisita?.ticketLabel}
                </span>
                <span className="text-[11px] text-gray-500 truncate">
                  {selectedVisita?.direccion}
                </span>
              </div>
            </div>

            {/* Chevron hacia abajo según Figma */}
            <div className="shrink-0 pl-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="#26292E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* Vista de seguimiento embebida reutilizando el token activo */}
      {selectedToken && (
        <div key={selectedToken} className="w-full">
          <Seguimiento customToken={selectedToken} />
        </div>
      )}

      {/* 
        BOTTOM SHEET MODAL DE SELECCIÓN (FIGMA FRAME 2: 375x352)
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
                  Selecciona la visita
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
                        <div className="flex items-center gap-3 min-w-0 pr-3">
                          {/* Icono de Casa / Edificio según Figma */}
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-[#FFEFE7]' : 'bg-gray-100'
                          }`}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M2.667 6.667L8 2.667L13.333 6.667V13.333H10.667V9.333H5.333V13.333H2.667V6.667Z" stroke={isSelected ? "#FF5A0A" : "#616E79"} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>

                          <div className="flex flex-col text-left min-w-0">
                            <span className="text-[14px] font-bold text-[#26292E] leading-snug truncate">
                              {v.titulo} ({v.ticketLabel})
                            </span>
                            <span className="text-[12px] text-gray-500 truncate leading-snug mt-0.5">
                              {v.direccion}
                            </span>
                            {v.fecha && (
                              <span className="text-[11px] text-[#FF5A0A] font-medium mt-0.5">
                                {v.fecha} {v.tramo ? `• ${v.tramo}` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Radio Button Custom Figma */}
                        <div className="shrink-0 flex items-center justify-center">
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
