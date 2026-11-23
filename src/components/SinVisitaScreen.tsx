import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CierreMascotsIllustration } from './CierreMascotsIllustration';

interface SinVisitaScreenProps {
  onClose?: () => void;
}

export const SinVisitaScreen: React.FC<SinVisitaScreenProps> = ({ onClose }) => {
  const navigate = useNavigate();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-white flex flex-col justify-between font-sans overflow-y-auto">
      <div className="flex-1 flex flex-col items-center justify-center pt-10 pb-6 px-6 max-w-[360px] mx-auto w-full text-center">
        <div className="mb-6 flex items-center justify-center">
          <CierreMascotsIllustration className="w-[240px] h-[200px]" />
        </div>

        <h1 className="text-[22px] font-bold text-[#26292E] mb-2.5 leading-snug tracking-tight">
          No tienes una visita técnica
        </h1>
        <p className="text-[14px] text-[#535C67] leading-relaxed max-w-[300px] mx-auto font-normal">
          Por ahora, no hay ninguna atención programada.
        </p>
      </div>

      <div className="p-4 w-full max-w-[360px] mx-auto shrink-0 mb-4 flex flex-col gap-3">
        <div className="w-full rounded-2xl bg-[#FFF4EC] px-4 py-3 flex items-center gap-3 text-left">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0"
          >
            <circle cx="12" cy="12" r="9.5" stroke="#FF5A0A" strokeWidth="1.6" />
            <path d="M12 11V16" stroke="#FF5A0A" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="8" r="1" fill="#FF5A0A" />
          </svg>
          <p className="text-[12.5px] leading-snug text-[#FF5A0A] font-normal">
            Si crees que es un error, comunícate con nosotros, con gusto te atenderemos.
          </p>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="w-full bg-white hover:bg-[#FFF4EC] text-[#FF5A0A] border border-[#FF5A0A] font-bold h-12 rounded-full text-[15px] active:scale-95 transition-all cursor-pointer"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
