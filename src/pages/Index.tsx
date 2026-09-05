import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Search, ArrowRight, MessageCircle, X, ShieldCheck } from "lucide-react";
import portadaIlustracion from "../assets/portada-ilustracion.svg";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [lastToken, setLastToken] = useState<string | null>(null);

  useEffect(() => {
    // Si la URL contiene un token directo como query param (?token=... o ?t=...)
    const queryToken = searchParams.get("token") || searchParams.get("t");
    if (queryToken) {
      navigate(`/seguimiento/${queryToken.trim()}`);
      return;
    }

    // Verificar si hay un token previo guardado en el navegador
    const saved = localStorage.getItem("win_last_token");
    if (saved) {
      setLastToken(saved);
    }
  }, [searchParams, navigate]);

  const handleCtaClick = () => {
    if (lastToken) {
      navigate(`/seguimiento/${lastToken}`);
    } else {
      setIsModalOpen(true);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = tokenInput.trim();
    if (!cleanToken) {
      setInputError("Por favor ingresa un código de seguimiento o token válido.");
      return;
    }
    
    // Si pegaron un URL completo, extraer solo el token final
    let parsedToken = cleanToken;
    if (cleanToken.includes("/")) {
      const parts = cleanToken.split("/");
      parsedToken = parts[parts.length - 1].split("?")[0];
    }

    if (parsedToken.length < 4) {
      setInputError("El código ingresado parece demasiado corto. Revisa tu mensaje de WhatsApp.");
      return;
    }

    setInputError("");
    navigate(`/seguimiento/${parsedToken}`);
  };

  const openWhatsAppSupport = () => {
    const text = encodeURIComponent(
      "Hola WIN, deseo consultar el estado y seguimiento en vivo de mi instalación."
    );
    window.open(`https://wa.me/51923229369?text=${text}`, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-white text-gray-900 flex flex-col justify-between items-center px-4 py-6 sm:py-8 select-none font-sans overflow-x-hidden"
    >
      {/* Contenedor Principal Ajustado al formato Mobile First */}
      <div className="w-full max-w-sm sm:max-w-md flex flex-col items-center flex-1 justify-between my-auto">
        
        {/* Header con Logo Oficial WIN */}
        <header className="w-full flex justify-center items-center pt-2 pb-4">
          <div className="w-28 sm:w-32 h-auto flex items-center justify-center">
            <svg
              viewBox="140 78 95 40"
              className="w-full h-auto drop-shadow-sm"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Flame dot over I */}
              <path
                d="M194.32 83.2003C194.32 83.8358 194.469 84.4009 194.799 84.8523L194.8 84.8561C195.21 85.4475 197.276 87.3706 197.498 87.5804C197.721 87.7909 197.721 87.7909 197.949 87.5804C198.186 87.3252 200.393 85.246 200.684 84.7829L200.685 84.7586C200.97 84.3242 201.097 83.7923 201.097 83.2003C201.097 81.4324 199.581 80.0008 197.71 80.0008C195.837 80.0008 194.32 81.4324 194.32 83.2003Z"
                fill="#FF5A0A"
              />
              {/* Letter I */}
              <path
                d="M197.556 89.6006C195.707 89.6006 194.195 91.028 194.195 92.7728V111.812C194.195 113.556 195.707 114.984 197.556 114.984H197.614C199.462 114.984 200.973 113.556 200.973 111.812V92.7728C200.973 91.028 199.462 89.6006 197.614 89.6006H197.556Z"
                fill="#FF5A0A"
              />
              {/* Letter N */}
              <path
                d="M206.018 102.223C206.017 102.25 206.016 102.276 206.016 102.303V111.981C206.016 113.726 207.528 115.154 209.376 115.154H209.434C211.282 115.154 212.794 113.726 212.794 111.981C212.794 111.981 212.791 102.038 212.791 101.896C212.914 98.9125 214.802 96.0512 219.507 96.0512C224.241 96.0512 226.121 98.9482 226.222 101.952C226.222 102.084 226.223 111.981 226.223 111.981C226.223 113.726 227.736 115.154 229.584 115.154H229.642C231.49 115.154 233.002 113.726 233.002 111.981V102.349L233.001 102.267C232.979 97.9868 230.324 89.663 219.478 89.6291C208.669 89.6624 206.058 97.9292 206.018 102.223Z"
                fill="#FF5A0A"
              />
              {/* Letter W */}
              <path
                d="M185.725 89.7095C183.878 89.7095 182.366 91.1367 182.366 92.8818V108.851H175.736V108.848H175.735C170.912 108.848 168.973 105.805 168.961 102.724V92.8818C168.961 91.1367 167.415 89.7095 165.567 89.7095C163.719 89.7095 162.184 91.1367 162.184 92.8818V103.069C162.036 106.028 160.128 108.848 155.484 108.848C150.661 108.848 148.789 105.805 148.776 102.724H148.776C148.777 102.689 148.778 92.8818 148.778 92.8818C148.778 91.1367 147.239 89.7095 145.391 89.7095C143.543 89.7095 142 91.1367 142 92.8818V102.622C142 102.894 141.996 103.147 142.036 103.413C142.353 107.848 145.295 115.239 155.456 115.27C160.295 115.256 163.493 113.57 165.551 111.33C165.551 111.33 165.562 111.315 165.596 111.315C165.625 111.315 165.632 111.324 165.635 111.329C167.679 113.57 170.865 115.256 175.705 115.27L175.736 115.269V115.25H185.789C187.637 115.25 189.149 113.822 189.149 112.078V112.023C189.149 111.97 189.147 111.916 189.144 111.864V92.8818C189.144 91.1367 187.632 89.7095 185.783 89.7095H185.725Z"
                fill="#FF5A0A"
              />
            </svg>
          </div>
        </header>

        {/* Ilustración de Portada */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="w-full flex items-center justify-center my-3 sm:my-5"
        >
          <img
            src={portadaIlustracion}
            alt="WIN Seguimiento de Instalación"
            className="w-full max-w-[290px] sm:max-w-[340px] h-auto object-contain drop-shadow-sm"
          />
        </motion.div>

        {/* Bloque de Textos */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-center px-2 space-y-2 mb-6"
        >
          <h1 className="text-2xl sm:text-[28px] font-black text-[#1E293B] tracking-tight leading-tight">
            Sigue tu instalación
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 max-w-[280px] sm:max-w-sm mx-auto leading-relaxed">
            Estamos preparando todo para brindarte la mejor experiencia. Muy pronto podrás disfrutar tu servicio{" "}
            <span className="font-extrabold text-[#FF5A0A]">WIN</span>.
          </p>
        </motion.div>

        {/* Stepper de 3 Estados (Agendada -> En Camino -> Iniciada) */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="w-full max-w-[310px] sm:max-w-[330px] mx-auto mb-8 px-2"
        >
          <div className="flex items-center justify-between relative">
            
            {/* Paso 1: Agendada */}
            <div className="flex flex-col items-center z-10">
              <div className="w-6 h-6 rounded-full bg-[#FF5A0A] flex items-center justify-center shadow-sm">
                <Check className="w-3.5 h-3.5 text-white stroke-[3.5]" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-[#1E293B] mt-2 whitespace-nowrap">
                Agendada
              </span>
            </div>

            {/* Línea 1-2 */}
            <div className="flex-1 h-[2px] bg-[#D9D9D9] mx-2 -mt-5 rounded-full" />

            {/* Paso 2: En Camino */}
            <div className="flex flex-col items-center z-10">
              <div className="w-6 h-6 rounded-full bg-[#FF5A0A] flex items-center justify-center shadow-sm">
                <Check className="w-3.5 h-3.5 text-white stroke-[3.5]" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-[#1E293B] mt-2 whitespace-nowrap">
                En Camino
              </span>
            </div>

            {/* Línea 2-3 */}
            <div className="flex-1 h-[2px] bg-[#D9D9D9] mx-2 -mt-5 rounded-full" />

            {/* Paso 3: Iniciada */}
            <div className="flex flex-col items-center z-10">
              <div className="w-6 h-6 rounded-full bg-[#FF5A0A] flex items-center justify-center shadow-sm">
                <Check className="w-3.5 h-3.5 text-white stroke-[3.5]" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-[#1E293B] mt-2 whitespace-nowrap">
                Iniciada
              </span>
            </div>

          </div>
        </motion.div>

        {/* Botón Principal de Acción */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="w-full max-w-sm px-2 pb-2"
        >
          <button
            onClick={handleCtaClick}
            className="w-full py-3.5 sm:py-4 bg-[#FF5A0A] hover:bg-[#E04E07] active:scale-[0.98] text-white font-bold text-sm sm:text-base rounded-2xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Seguir mi instalación</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>

          {lastToken && (
            <p className="text-[11px] text-gray-400 text-center mt-2.5">
              Tienes una sesión de seguimiento activa.{" "}
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-[#FF5A0A] underline font-medium hover:text-orange-600"
              >
                Ingresar otro código
              </button>
            </p>
          )}
        </motion.div>

      </div>

      {/* Indicador inferior tipo iOS Home Bar */}
      <div className="w-32 h-1 bg-gray-900/80 rounded-full mx-auto mt-4 shrink-0" />

      {/* Modal / Bottom Sheet para Ingresar Token Manualmente */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#FF5A0A] flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Acceso a tu Seguimiento</h3>
                  <p className="text-xs text-gray-500">Ingresa tu código o enlace recibido</p>
                </div>
              </div>

              <form onSubmit={handleSearchSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Código de seguimiento o token:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={tokenInput}
                      onChange={(e) => {
                        setTokenInput(e.target.value);
                        setInputError("");
                      }}
                      placeholder="Ej: 8129381-abcd o pega tu enlace de WhatsApp"
                      className="w-full pl-3.5 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5A0A] focus:border-transparent transition-all"
                      autoFocus
                    />
                    <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  {inputError && (
                    <p className="text-xs text-red-500 font-medium mt-1.5">{inputError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#FF5A0A] hover:bg-[#E04E07] active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>Consultar instalación</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col items-center gap-3">
                <p className="text-xs text-gray-500 text-center">
                  ¿No recibiste tu enlace por WhatsApp o SMS?
                </p>
                <button
                  type="button"
                  onClick={openWhatsAppSupport}
                  className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Contactar a Soporte por WhatsApp</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Index;
