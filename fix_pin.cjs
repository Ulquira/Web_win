const fs = require('fs');
let code = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8');

// 1. Ocultar la validación PIN en reprogramación
const valRegex = /if\s*\(reprogramData\.pin_confirmacion\s*!==\s*data\?\.token_inicio\)\s*\{\s*alert\("El PIN de seguridad ingresado es incorrecto\."\);\s*return;\s*\}/;
const valNew = `/* VALIDACIÓN DE PIN OCULTA PARA SPRINT 1
 if (reprogramData.pin_confirmacion !== data?.token_inicio) {
   alert("El PIN de seguridad ingresado es incorrecto.");
   return;
 } */`;
code = code.replace(valRegex, valNew);

// 2. Ocultar la visualización del PIN en la tarjeta principal
const pinCardRegex = /\{\/\*\s*Token de Inicio[\s\S]*?\}\)\}\s*(?=\{\/\*\s*Llegada del técnico)/i;
const pinCardNew = `{/* Token de Inicio (Si está en camino) - OCULTO PARA SPRINT 1
 {status === 'en_camino' && data.token_inicio && (
 <div className="bg-gray-900 rounded-3xl p-4 mb-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] mt-1 flex items-center justify-between mx-0 overflow-hidden relative">
   <div className="absolute top-0 right-0 w-32 h-32 bg-primary rounded-full blur-[50px] opacity-20 -mr-10 -mt-10"></div>
   <div className="flex flex-col relative z-10 w-2/3 pr-2">
     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Código de seguridad</p>
     <p className="text-[12px] text-gray-300 font-normal leading-tight">
       Comparte este PIN cuando el instalador llegue a tu domicilio.
     </p>
   </div>
   <div className="relative z-10 flex gap-1.5 shrink-0 bg-black/40 p-2 rounded-2xl border border-gray-700/50 backdrop-blur-md">
     {data.token_inicio.split('').map((digit, i) => (
       <div key={i} className="w-8 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-xl font-bold text-white shadow-inner border border-gray-700/50">
         {digit}
       </div>
     ))}
   </div>
 </div>
 )}
 */}
 
 `;
code = code.replace(pinCardRegex, pinCardNew);

// 3. Ocultar el Input de PIN en el modal
const inputRegex = /<h3 className="font-bold text-\[14px\] text-gray-900 mb-3 mt-5">PIN de Seguridad<\/h3>[\s\S]*?placeholder="----"\s*\/>/;
const inputNew = `{/* INPUT DE PIN OCULTO PARA SPRINT 1
 <h3 className="font-bold text-[14px] text-gray-900 mb-3 mt-5">PIN de Seguridad</h3>
 <p className="text-[11px] text-gray-500 mb-2 leading-tight">
   Ingresa el PIN de 4 dígitos que te fue asignado para confirmar tu identidad.
 </p>
 <input 
 type="text"
 maxLength={4}
 value={reprogramData.pin_confirmacion}
 onChange={(e) => setReprogramData({...reprogramData, pin_confirmacion: e.target.value.replace(/\\D/g, '')})}
 className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-center text-lg font-bold tracking-[0.5em] text-gray-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
 placeholder="----"
 /> */}`;
code = code.replace(inputRegex, inputNew);

// 4. Quitar condición del botón de submit
const btnRegex = /disabled=\{!reprogramData\.fecha \|\| !reprogramData\.turno \|\| reprogramData\.pin_confirmacion\.length !== 4\}/;
const btnNew = `disabled={!reprogramData.fecha || !reprogramData.turno}`;
code = code.replace(btnRegex, btnNew);

fs.writeFileSync('src/pages/Seguimiento.tsx', code, 'utf8');
console.log('PIN comentado exitosamente');
