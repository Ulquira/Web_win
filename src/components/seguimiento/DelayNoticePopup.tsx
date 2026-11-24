import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DelayNoticePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DelayNoticePopup: React.FC<DelayNoticePopupProps> = ({ isOpen, onClose }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-[#26292E]/40 flex items-center justify-center p-4 backdrop-blur-xs"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 16 }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="bg-white rounded-[28px] px-6 pt-8 pb-6 w-[342px] max-w-full relative flex flex-col items-center text-center shadow-[0_12px_40px_rgba(0,0,0,0.14)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-[84px] h-[84px] flex items-center justify-center mb-4">
            <svg width="84" height="84" viewBox="0 0 84 84" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <path
                d="M69.5 44C69.8 42.2 70 40.1 70 38C70 21.4315 56.5685 8 40 8C23.4315 8 10 21.4315 10 38C10 54.5685 23.4315 68 40 68C43.2 68 46.3 67.5 49.2 66.5"
                stroke="#FF5A0A"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="M40 21V39L50.5 49.5"
                stroke="#301D19"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M60 49V62" stroke="#FF5A0A" strokeWidth="6" strokeLinecap="round" />
              <circle cx="60" cy="71.5" r="3.2" fill="#FF5A0A" />
            </svg>
          </div>

          <h3 className="text-[19px] font-bold text-[#26292E] leading-[1.3] mb-3.5 px-2">
            Tu visita técnica podría<br />presentar demoras
          </h3>

          <p className="text-[13.5px] text-[#535C67] leading-[1.55] mb-4 px-1 font-normal">
            Debido a los desvíos por la visita del Papa León XIV, el horario de llegada de tu técnico podría verse afectado. Estamos haciendo todo lo posible para llegar a tu domicilio lo antes posible.
          </p>

          <p className="text-[13.5px] text-[#535C67] leading-[1.5] mb-6 font-normal">
            ¡Gracias por tu comprensión!
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-[#FF5A0A] hover:bg-[#E04E07] text-white font-bold h-12 rounded-full text-[15px] shadow-md shadow-[#FF5A0A]/20 active:scale-95 transition-all cursor-pointer"
          >
            Entendido
          </button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
