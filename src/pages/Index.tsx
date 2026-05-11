import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { ModeToggle } from "@/components/ModeToggle";
import { Phone } from "lucide-react";


const Index = () => {
  const [dni, setDni] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!dni.trim()) {
      toast({
        title: "Campo requerido",
        description: "Por favor ingresa tu DNI o número de servicio",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`http://10.24.65.23:3001/api/instalaciones/${dni}`);
      const result = await response.json();

      if (result.success) {
        navigate(`/seguimiento/${dni}`);
      } else {
        toast({
          title: "No encontrado",
          description: "No se encontró una instalación con ese DNI en la base de datos. Intenta con: 12345678, 44556677...",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor. Verifica que la API esté corriendo.",
        variant: "destructive"
      });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="min-h-screen bg-primary transition-colors duration-300 relative overflow-hidden flex flex-col font-['Corbel']"
    >
      {/* Header con Degradado Rojo fundiéndose a la imagen */}
      <header className="absolute top-0 w-full z-50 pt-4 pb-12 bg-gradient-to-b from-primary via-primary/80 to-transparent">
        <div className="container mx-auto px-4 lg:px-8 flex justify-between items-center">
          <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
            <img src="/src/assets/logo-1.png" alt="Peru Fibra" className="h-6 md:h-8 lg:h-10 w-auto object-contain drop-shadow-lg transition-all" />
          </div>
          
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-8 text-white font-bold text-sm tracking-wide">
              {/* Espacio para futuros botones de navegación si se necesitan */}
            </nav>
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* Hero Section con Imagen de Fondo (Replicando la web oficial) */}
      <div className="relative min-h-[700px] flex items-center pt-24 pb-48">
        {/* Imagen de fondo familiar full color */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url("/src/assets/home.png")' }}
        >
          {/* Gradiente sutil solo a la izquierda para que el texto resalte */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent"></div>
        </div>

        {/* Corte diagonal rojo inferior (Shape divider) exacto al diseño */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10" style={{ transform: 'translateY(2px)' }}>
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="relative block w-full h-[200px]">
            <path d="M0,120 L1200,120 L1200,0 L0,120 Z" className="fill-primary"></path>
          </svg>
        </div>
        
        <div className="container mx-auto px-4 lg:px-12 relative z-20 flex flex-col lg:flex-row items-center justify-between gap-16 mt-8">
          
          {/* Textos de la izquierda */}
          <motion.div 
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="flex-1 text-center lg:text-left pt-24"
          >
            <img src="/src/assets/text-banner.png" alt="Conecta con fibra" className="max-w-full h-auto mx-auto lg:mx-0 mb-8 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]" style={{ maxHeight: '270px' }} />
            
            {/* Texto de seguimiento */}
            <div className="bg-black/40 p-6 rounded-2xl backdrop-blur-sm border border-white/10 inline-block text-left">
              <h2 className="text-3xl md:text-4xl font-black mb-2 text-white leading-tight" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                Sigue tu <span className="text-secondary">instalación</span>
              </h2>
              <p className="text-lg text-gray-200 font-medium max-w-sm">
                Conoce el estado exacto de tu instalación y sigue al técnico en tiempo real.
              </p>
            </div>
          </motion.div>

          {/* Cuadro de búsqueda a la derecha */}
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-full max-w-md"
          >
            <Card className="p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-0 rounded-3xl bg-white">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-black text-gray-900" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>Rastrea tu Servicio</h3>
                  <p className="text-gray-500 mt-2 font-medium">Ingresa tu DNI para continuar</p>
                </div>
                
                <div>
                  <Input
                    id="dni"
                    type="text"
                    placeholder="Ej: 42306775"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    className="text-xl h-16 rounded-xl border-2 border-gray-200 focus-visible:ring-primary focus-visible:border-primary mb-4 text-center font-bold tracking-widest text-black bg-gray-50"
                  />
                  <Button type="submit" className="w-full h-16 rounded-xl bg-primary hover:bg-red-700 text-white text-lg font-bold shadow-lg transition-transform hover:-translate-y-1">
                    Consultar Estado
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>

        </div>
      </div>

      {/* Botones Flotantes de Contacto */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col sm:flex-row gap-3">
        {/* Botón de WhatsApp */}
        <a 
          href="https://wa.link/7a0huw" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center gap-2 bg-[#25d366] hover:bg-[#128c7e] text-white px-5 py-3 rounded-full font-bold shadow-[0_0_15px_rgba(37,211,102,0.4)] transition-all hover:scale-105"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
          </svg>
          <span className="text-[13px]">ESCRÍBENOS AQUÍ</span>
        </a>
        
        {/* Botón de Llamada */}
        <a 
          href="tel:017546000" 
          className="flex items-center gap-3 bg-secondary hover:bg-yellow-500 text-black px-6 py-2 rounded-full font-bold shadow-[0_0_15px_rgba(244,186,0,0.4)] transition-all hover:scale-105"
        >
          <Phone className="w-5 h-5 text-primary fill-current" />
          <div className="text-left leading-[1.1]">
            <span className="text-[10px] uppercase tracking-wider font-bold">Llámanos al</span><br/>
            <span className="text-[15px] font-black">01 754 6000</span>
          </div>
        </a>
      </div>

    </motion.div>
  );
};

export default Index;