import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronDown, AlertCircle, Loader2, Check } from "lucide-react";
import { API_BASE_URL } from "@/lib/apiUrl";
import { trackEvent } from "@/lib/firebaseConfig";

type TipoDocumento = "DNI" | "CE" | "RUC";

const INSTALACIONES_WSP_NUMBER = "51923229369";

const DOC_CONFIG: Record<
  TipoDocumento,
  { label: string; minLength: number; maxLength: number; numericOnly: boolean }
> = {
  DNI: { label: "DNI", minLength: 8, maxLength: 8, numericOnly: true },
  CE: { label: "CE", minLength: 9, maxLength: 12, numericOnly: false },
  RUC: { label: "RUC", minLength: 11, maxLength: 11, numericOnly: true },
};

export default function InvitadoInstalacion() {
  const navigate = useNavigate();

  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>("DNI");
  const [documento, setDocumento] = useState("");
  const [codigo, setCodigo] = useState("");

  const [docFocused, setDocFocused] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);

  const [docError, setDocError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [isCheckingDoc, setIsCheckingDoc] = useState(false);
  const [docExists, setDocExists] = useState<boolean | null>(null);
  const [telefonoMasked, setTelefonoMasked] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [codeSentSuccess, setCodeSentSuccess] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isDocDropdownOpen, setIsDocDropdownOpen] = useState(false);

  const docDropdownRef = useRef<HTMLDivElement>(null);

  const currentDocCfg = DOC_CONFIG[tipoDocumento];
  const availableDocTypes = (["DNI", "CE", "RUC"] as const).filter(
    (docType) => docType !== tipoDocumento
  );

  useEffect(() => {
    if (!isDocDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        docDropdownRef.current &&
        !docDropdownRef.current.contains(event.target as Node)
      ) {
        setIsDocDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDocDropdownOpen]);

  useEffect(() => {
    setDocExists(null);
    setTelefonoMasked(null);
    setDocError(null);

    if (
      documento.length < currentDocCfg.minLength ||
      documento.length > currentDocCfg.maxLength
    ) {
      setIsCheckingDoc(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsCheckingDoc(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/invitado/verificar-documento`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipoDocumento, documento }),
          signal: controller.signal,
        });

        const data = await res.json();
        if (controller.signal.aborted) return;

        if (res.ok && data.exists) {
          setDocExists(true);
          setTelefonoMasked(
            typeof data.telefonoMasked === "string" && data.telefonoMasked.trim()
              ? data.telefonoMasked.trim()
              : null
          );
          setDocError(null);
        } else if (res.status === 429) {
          setDocExists(null);
          setTelefonoMasked(null);
          setGeneralError(
            data.message || "Demasiados intentos. Por favor espera un minuto."
          );
        } else {
          setDocExists(false);
          setTelefonoMasked(null);
          setDocError(data.message || "El número de documento ingresado no es válido.");
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) {
          setIsCheckingDoc(false);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [documento, tipoDocumento, currentDocCfg.minLength, currentDocCfg.maxLength]);

  const handleTipoChange = (nextTipo: TipoDocumento) => {
    setTipoDocumento(nextTipo);
    setDocumento("");
    setDocExists(null);
    setTelefonoMasked(null);
    setDocError(null);
    setGeneralError(null);
  };

  const handleDocumentoChange = (raw: string) => {
    const cleaned = currentDocCfg.numericOnly
      ? raw.replace(/\D/g, "")
      : raw.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
    setDocumento(cleaned.slice(0, currentDocCfg.maxLength));
    setDocExists(null);
    setTelefonoMasked(null);
    if (docError) setDocError(null);
    if (generalError) setGeneralError(null);
  };

  const handleCodigoChange = (raw: string) => {
    const cleaned = raw.replace(/\D/g, "").slice(0, 4);
    setCodigo(cleaned);
    if (codeError) setCodeError(null);
    if (generalError) setGeneralError(null);
  };

  const isFormFilled =
    documento.trim().length >= currentDocCfg.minLength &&
    codigo.trim().length === 4 &&
    !isCheckingDoc &&
    docExists === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormFilled || isSubmitting) return;

    const isDocFormatInvalid =
      documento.length < currentDocCfg.minLength ||
      documento.length > currentDocCfg.maxLength;
    const isCodeFormatInvalid = !/^\d{4}$/.test(codigo);

    if (isDocFormatInvalid || isCodeFormatInvalid) {
      setDocError(
        isDocFormatInvalid ? "El número de documento ingresado no es válido." : null
      );
      setCodeError(
        isCodeFormatInvalid ? "El código de seguimiento ingresado no es válido." : null
      );
      return;
    }

    setIsSubmitting(true);
    setDocError(null);
    setCodeError(null);
    setGeneralError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/invitado/validar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoDocumento,
          documento,
          pin: codigo,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success && result.token) {
        trackEvent("invitado_instalacion_validado", {
          token: result.token,
          tipo_documento: tipoDocumento,
        });
        navigate(`/seguimiento/${encodeURIComponent(result.token)}`);
        return;
      }

      if (result.code === "DOCUMENT_NOT_FOUND") {
        setDocExists(false);
        setDocError("El número de documento ingresado no es válido.");
      } else if (result.code === "INVALID_PIN") {
        setCodeError("El código de seguimiento ingresado no es válido.");
      } else if (result.code === "BOTH_INVALID") {
        setDocExists(false);
        setDocError("El número de documento ingresado no es válido.");
        setCodeError("El código de seguimiento ingresado no es válido.");
      } else if (response.status === 429) {
        setGeneralError(
          result.message ||
            "Demasiados intentos fallidos. Por seguridad, intenta nuevamente en 15 minutos."
        );
      } else {
        setGeneralError(
          result.message || "No pudimos validar tus datos. Intenta nuevamente."
        );
      }
    } catch {
      setGeneralError("Error de conexión. Verifica tu internet e intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenWhatsApp = (motivo: "recuperar" | "asesor") => {
    const docInfo = documento ? ` Mi ${tipoDocumento} es ${documento}.` : "";
    const text =
      motivo === "recuperar"
        ? `Hola, necesito recuperar mi código de seguimiento para mi instalación programada hoy.${docInfo}`
        : `Hola, cambié de número y necesito ayuda con el código de seguimiento de mi instalación.${docInfo}`;

    window.open(
      `https://wa.me/${INSTALACIONES_WSP_NUMBER}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const showDocFloating = docFocused || documento.length > 0;
  const showCodeFloating = codeFocused || codigo.length > 0;

  return (
    <div className="min-h-[100dvh] w-full bg-white flex flex-col font-sans text-[#0F0908]">
      {/* Header */}
      <header className="w-full max-w-md mx-auto px-4 pt-4 pb-3 flex items-center relative shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 text-[#FF5A0A] hover:bg-orange-50 rounded-full transition-colors cursor-pointer"
          aria-label="Volver"
        >
          <ChevronLeft className="w-6 h-6 stroke-[2.2]" />
        </button>
        <h1 className="flex-1 text-center text-[15px] font-semibold text-[#FF5A0A] pr-8">
          Seguir mi instalación
        </h1>
      </header>

      {/* Main Content */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 w-full max-w-md mx-auto px-6 pt-5 pb-8 flex flex-col justify-between"
      >
        <div>
          <h2 className="text-[24px] font-bold text-[#0F0908] leading-[1.22] tracking-tight mb-3">
            Conoce el estado de tu instalación
          </h2>

          <p className="text-[14px] text-[#26292E] leading-[1.45] mb-6 font-normal">
            Ingresa tu documento y código de seguimiento para consultar el avance de tu
            instalación. No necesitas iniciar sesión.
          </p>

          {/* Selector Tipo de Documento */}
          <div ref={docDropdownRef} className="relative mb-4">
            <button
              type="button"
              onClick={() => setIsDocDropdownOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isDocDropdownOpen}
              aria-label="Tipo de documento"
              className={`w-full h-[54px] rounded-[14px] border bg-white px-4 flex items-center justify-between text-[15px] font-normal text-[#0F0908] transition-colors cursor-pointer ${
                isDocDropdownOpen
                  ? "border-[#FF5A0A]"
                  : "border-[#9CA3AF] hover:border-[#6B7280]"
              }`}
            >
              <span>{tipoDocumento}</span>
              <ChevronDown
                className={`w-5 h-5 text-[#0F0908] stroke-[2] transition-transform duration-200 ${
                  isDocDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {isDocDropdownOpen && (
                <motion.div
                  role="listbox"
                  aria-label="Opciones de tipo de documento"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14 }}
                  className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 rounded-[14px] border border-[#E5E7EB] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)] overflow-hidden"
                >
                  {availableDocTypes.map((docType, idx) => (
                    <button
                      key={docType}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => {
                        handleTipoChange(docType);
                        setIsDocDropdownOpen(false);
                      }}
                      className={`w-full h-[50px] px-4 flex items-center justify-start text-left text-[15px] font-normal text-[#6B7280] hover:bg-[#FFF6ED] hover:text-[#FF5A0A] active:bg-[#FFEDE0] transition-colors cursor-pointer ${
                        idx < availableDocTypes.length - 1
                          ? "border-b border-[#F3F4F6]"
                          : ""
                      }`}
                    >
                      {docType}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input Número de documento */}
          <div className="mb-4">
            <div
              className={`relative h-[56px] rounded-[14px] px-4 flex items-center gap-3 border transition-all ${
                docError || docExists === false
                  ? "bg-[#FFF5F5] border-[#E53935]"
                  : docExists === true
                  ? "bg-[#F2F2F2] border-[#16A34A]"
                  : docFocused
                  ? "bg-[#F2F2F2] border-[#FF5A0A]"
                  : "bg-[#F2F2F2] border-transparent"
              }`}
            >
              <svg
                width="20"
                height="16"
                viewBox="0 0 20 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0"
              >
                <rect
                  x="1"
                  y="1"
                  width="18"
                  height="14"
                  rx="2.5"
                  stroke="#141414"
                  strokeWidth="1.4"
                />
                <circle cx="6.5" cy="6.8" r="1.7" stroke="#141414" strokeWidth="1.3" />
                <path
                  d="M4 11.8C4.4 10.5 5.3 9.9 6.5 9.9C7.7 9.9 8.6 10.5 9 11.8"
                  stroke="#141414"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
                <path
                  d="M11.5 5.8H16M11.5 8.8H16M11.5 11.5H14.2"
                  stroke="#141414"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>

              <div className="relative flex-1 h-full flex flex-col justify-center">
                <label
                  htmlFor="invitado-documento"
                  className={`pointer-events-none transition-all ${
                    showDocFloating
                      ? "text-[11px] text-[#6B7280] leading-tight mt-0.5"
                      : "text-[15px] text-[#7A7A7A]"
                  }`}
                >
                  Número de documento
                </label>
                <input
                  id="invitado-documento"
                  type="text"
                  inputMode={currentDocCfg.numericOnly ? "numeric" : "text"}
                  autoComplete="off"
                  value={documento}
                  onFocus={() => setDocFocused(true)}
                  onBlur={() => setDocFocused(false)}
                  onChange={(e) => handleDocumentoChange(e.target.value)}
                  className={`w-full bg-transparent text-[15px] font-medium text-[#0F0908] focus:outline-none ${
                    showDocFloating ? "h-[22px] leading-tight" : "absolute inset-0 opacity-0"
                  }`}
                />
              </div>

              {isCheckingDoc ? (
                <Loader2 className="w-4 h-4 text-[#FF5A0A] animate-spin shrink-0" />
              ) : docError || docExists === false ? (
                <AlertCircle className="w-5 h-5 text-[#E53935] shrink-0 stroke-[1.8]" />
              ) : docExists === true ? (
                <span className="w-5 h-5 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </span>
              ) : null}
            </div>

            {docError ? (
              <p className="text-[12px] text-[#E53935] mt-1.5 px-1 font-normal">
                {docError}
              </p>
            ) : docExists === true ? (
              <p className="text-[12px] text-[#16A34A] mt-1.5 px-1 font-normal flex items-center gap-1">
                <span>Documento verificado</span>
              </p>
            ) : null}
          </div>

          {/* Input Código de seguimiento */}
          <div className="mb-3.5">
            <div
              className={`relative h-[56px] rounded-[14px] px-4 flex items-center gap-3 border transition-all ${
                codeError
                  ? "bg-[#FFF5F5] border-[#E53935]"
                  : codeFocused
                  ? "bg-[#F2F2F2] border-[#FF5A0A]"
                  : "bg-[#F2F2F2] border-transparent"
              }`}
            >
              <svg
                width="20"
                height="19"
                viewBox="0 0 20 19"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0"
              >
                <path
                  d="M3.5 1.5H16.5C17.6 1.5 18.5 2.4 18.5 3.5V12.5C18.5 13.6 17.6 14.5 16.5 14.5H7.2L3.5 17.5V14.5H3.5C2.4 14.5 1.5 13.6 1.5 12.5V3.5C1.5 2.4 2.4 1.5 3.5 1.5Z"
                  stroke="#141414"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 6.2L6.2 8L8 9.8M12 6.2L13.8 8L12 9.8"
                  stroke="#141414"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <div className="relative flex-1 h-full flex flex-col justify-center">
                <label
                  htmlFor="invitado-codigo"
                  className={`pointer-events-none transition-all ${
                    showCodeFloating
                      ? "text-[11px] text-[#6B7280] leading-tight mt-0.5"
                      : "text-[15px] text-[#7A7A7A]"
                  }`}
                >
                  Código de seguimiento
                </label>
                <input
                  id="invitado-codigo"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={4}
                  value={codigo}
                  onFocus={() => setCodeFocused(true)}
                  onBlur={() => setCodeFocused(false)}
                  onChange={(e) => handleCodigoChange(e.target.value)}
                  className={`w-full bg-transparent text-[15px] font-medium text-[#0F0908] focus:outline-none ${
                    showCodeFloating ? "h-[22px] leading-tight" : "absolute inset-0 opacity-0"
                  }`}
                />
              </div>

              {codeError && (
                <AlertCircle className="w-5 h-5 text-[#E53935] shrink-0 stroke-[1.8]" />
              )}
            </div>

            {codeError && (
              <p className="text-[12px] text-[#E53935] mt-1.5 px-1 font-normal">
                {codeError}
              </p>
            )}
          </div>

          {generalError && (
            <div className="mb-3 rounded-[12px] bg-[#FFF5F5] border border-[#FFCCC7] px-3.5 py-2.5 text-[12.5px] text-[#CF1322]">
              {generalError}
            </div>
          )}

          {/* Texto de ayuda + link modal */}
          <p className="text-[12.5px] text-[#26292E] leading-[1.45] mb-3.5 font-normal">
            Lo encontrarás en el mensaje de WhatsApp que recibiste el día programado para
            tu instalación.
          </p>

          <button
            type="button"
            onClick={() => {
              setCodeSentSuccess(false);
              setIsHelpModalOpen(true);
            }}
            className="text-[14px] font-bold text-[#FF5A0A] underline underline-offset-2 hover:opacity-85 transition-opacity cursor-pointer"
          >
            ¿No encuentras tu código?
          </button>
        </div>

        {/* Botón Ver estado */}
        <div className="pt-8">
          <button
            type="submit"
            disabled={!isFormFilled || isSubmitting}
            className="w-full h-[50px] rounded-full bg-[#FF5A0A] hover:bg-[#E04E07] disabled:bg-[#D9D9D9] disabled:text-white text-white font-bold text-[15px] transition-all shadow-sm disabled:shadow-none active:scale-[0.98] disabled:active:scale-100 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Validando..." : "Ver estado"}
          </button>
        </div>
      </form>

      {/* Bottom Sheet: Reenvío / Recupera tu código de seguimiento */}
      <AnimatePresence>
        {isHelpModalOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsHelpModalOpen(false);
                setCodeSentSuccess(false);
              }}
              className="absolute inset-0 bg-[#26292E]/45 backdrop-blur-[1px]"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md mx-auto bg-white rounded-t-[28px] px-6 pt-3 pb-8 shadow-2xl z-10 text-center"
            >
              <div className="w-10 h-1 bg-[#E2E2E2] rounded-full mx-auto mb-5" />

              {codeSentSuccess ? (
                <div className="pt-2 pb-1">
                  <div className="w-14 h-14 rounded-full border-[3px] border-[#FF5A0A] mx-auto mb-4 flex items-center justify-center">
                    <svg
                      width="26"
                      height="20"
                      viewBox="0 0 26 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2.5 10.5L9.5 17.5L23.5 2.5"
                        stroke="#26292E"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <h3 className="text-[20px] font-bold text-[#0F0908] mb-2">
                    ¡Listo! Te enviamos tu código
                  </h3>

                  <p className="text-[14px] text-[#26292E] leading-[1.45] mb-6 max-w-[300px] mx-auto font-normal">
                    Vuelve a la pantalla anterior, ingresa tu código de seguimiento y
                    descubre cómo va tu instalación.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setIsHelpModalOpen(false);
                      setCodeSentSuccess(false);
                    }}
                    className="w-full h-[50px] rounded-full border border-[#FF5A0A] bg-white hover:bg-[#FFF6ED] text-[#FF5A0A] font-bold text-[15px] transition-all cursor-pointer"
                  >
                    Volver
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-[20px] font-bold text-[#0F0908] mb-1.5">
                    ¿No encuentras tu código?
                  </h3>

                  <p className="text-[14px] text-[#26292E] mb-5 font-normal">
                    Te lo reenviamos por WhatsApp.
                  </p>

                  {docExists ? (
                    <div className="rounded-[16px] bg-[#F7F8FA] px-4 py-3.5 mb-5 flex items-center gap-3.5 text-left">
                      <div className="w-11 h-11 rounded-full bg-[#FFEFE7] flex items-center justify-center shrink-0 text-[#FF5A0A]">
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.48 0 .14 5.34.14 11.92c0 2.1.55 4.15 1.6 5.96L0 24l6.28-1.65a11.9 11.9 0 0 0 5.77 1.47h.01c6.58 0 11.92-5.34 11.92-11.92 0-3.18-1.24-6.18-3.46-8.42ZM12.06 21.8h-.01a9.87 9.87 0 0 1-5.04-1.38l-.36-.21-3.73.98.99-3.63-.24-.37a9.86 9.86 0 0 1-1.52-5.27c0-5.46 4.44-9.9 9.91-9.9 2.64 0 5.13 1.03 7 2.9a9.84 9.84 0 0 1 2.9 7c0 5.47-4.44 9.88-9.9 9.88Zm5.43-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12.5px] text-[#6B7280] leading-snug">
                          Lo enviaremos al WhatsApp
                        </p>
                        <p className="text-[16px] font-bold text-[#0F0908] tracking-tight mt-0.5">
                          {telefonoMasked || "Registrado en tu instalación"}
                        </p>
                      </div>
                    </div>
                  ) : docExists === false || docError ? (
                    <div className="rounded-[16px] bg-[#FFF5F5] border border-[#FFCCC7] px-4 py-3 mb-5 text-[12.5px] text-[#CF1322]">
                      Ingresa un número de documento válido con una instalación programada
                      hoy para reenviar tu código.
                    </div>
                  ) : (
                    <div className="rounded-[16px] bg-[#FFF6ED] border border-[#FFE7D4] px-4 py-3 mb-5 text-[12.5px] text-[#26292E]">
                      Ingresa un número de documento válido arriba para validar tu registro
                      programado hoy.
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!docExists || isSendingCode}
                    onClick={async () => {
                      setIsSendingCode(true);
                      try {
                        // TODO: conectar endpoint de envío automático por WhatsApp si aplica
                        setCodeSentSuccess(true);
                      } finally {
                        setIsSendingCode(false);
                      }
                    }}
                    className="w-full h-[50px] rounded-full border border-[#FF5A0A] bg-white hover:bg-[#FFF6ED] disabled:border-[#E5E7EB] disabled:text-[#9CA3AF] text-[#FF5A0A] font-bold text-[15px] flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:cursor-not-allowed mb-4"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="shrink-0"
                    >
                      <path
                        d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.48 0 .14 5.34.14 11.92c0 2.1.55 4.15 1.6 5.96L0 24l6.28-1.65a11.9 11.9 0 0 0 5.77 1.47h.01c6.58 0 11.92-5.34 11.92-11.92 0-3.18-1.24-6.18-3.46-8.42ZM12.06 21.8h-.01a9.87 9.87 0 0 1-5.04-1.38l-.36-.21-3.73.98.99-3.63-.24-.37a9.86 9.86 0 0 1-1.52-5.27c0-5.46 4.44-9.9 9.91-9.9 2.64 0 5.13 1.03 7 2.9a9.84 9.84 0 0 1 2.9 7c0 5.47-4.44 9.88-9.9 9.88Zm5.43-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z"
                        fill="currentColor"
                      />
                    </svg>
                    <span>{isSendingCode ? "Enviando..." : "Enviar por WhatsApp"}</span>
                  </button>

                  <p className="text-[13px] text-[#26292E]">
                    ¿Cambiaste de número?{" "}
                    <button
                      type="button"
                      onClick={() => handleOpenWhatsApp("asesor")}
                      className="font-bold text-[#FF5A0A] underline underline-offset-2 hover:opacity-85 cursor-pointer"
                    >
                      Habla con un asesor
                    </button>
                  </p>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}