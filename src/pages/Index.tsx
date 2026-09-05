import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ShieldCheck } from "lucide-react";
import { PortadaIlustracion } from "@/components/PortadaIlustracion";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Si la URL contiene un token directo como query param (?token=... o ?t=...)
    const queryToken = searchParams.get("token") || searchParams.get("t");
    if (queryToken) {
      navigate(`/seguimiento/${queryToken.trim()}`);
    }
  }, [searchParams, navigate]);

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
        <header className="w-full flex justify-center items-center pt-2 pb-3">
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
          className="w-full flex items-center justify-center my-2 sm:my-4"
        >
          <PortadaIlustracion className="w-full max-w-[270px] sm:max-w-[310px] flex items-center justify-center" />
        </motion.div>

        {/* Bloque de Textos */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-center px-2 space-y-2 mb-5"
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
          className="w-full max-w-[310px] sm:max-w-[330px] mx-auto mb-6 px-2"
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

        {/* Tarjeta Informativa de Acceso Seguro */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="w-full max-w-sm px-2 pb-2"
        >
          <div className="bg-orange-50/70 border border-orange-100 rounded-2xl p-4 sm:p-5 text-center shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-[#FF5A0A] text-white flex items-center justify-center mx-auto mb-2.5 shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">
              Acceso Seguro y Privado
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed max-w-xs mx-auto">
              Para seguir tu instalación en tiempo real, ingresa directamente a través del <span className="font-bold text-[#FF5A0A]">enlace único</span> que te enviamos por WhatsApp.
            </p>
          </div>
        </motion.div>

      </div>

      {/* Indicador inferior tipo iOS Home Bar */}
      <div className="w-32 h-1 bg-gray-900/80 rounded-full mx-auto mt-4 shrink-0" />
    </motion.div>
  );
};

export default Index;
