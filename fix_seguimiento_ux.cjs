const fs = require('fs');
let lines = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8').split('\n');

const newContent = ` {/* Info Card Minimalista */}
 <div className={\`border border-gray-200 rounded-[20px] p-5 mb-6 bg-white shadow-sm \${status === 'en_camino' && (data.token_inicio || eta || calculatedEta) ? '' : 'mt-4'}\`}>
 <div className="flex flex-col gap-4">
   <div className="flex justify-between items-center">
     <span className="text-gray-500 text-[14px] font-normal">Día</span>
     <span className="font-bold text-gray-900 text-[14px]">
     {data.fecha_programacion && parseSafeDate(data.fecha_programacion) ? format(parseSafeDate(data.fecha_programacion), "dd/MM/yyyy") : 'Por definir'}
     </span>
   </div>
   {status !== 'en_camino' && (
     <div className="flex justify-between items-center">
       <span className="text-gray-500 text-[14px] font-normal">Horario programado</span>
       <span className="font-bold text-gray-900 text-[14px]">
       {formatTramoToRange(data.tramo)}
       </span>
     </div>
   )}
   
   {/* Dirección */}
   <div className="flex justify-between items-start">
     <span className="text-gray-500 text-[14px] font-normal mt-0.5 mr-4">Dirección</span>
     <span className="font-bold text-gray-900 text-[14px] text-right leading-snug line-clamp-3">
     {formatAddress(data.direccion)}
     </span>
   </div>

   {/* Plan y Servicios */}
   {data.tipo !== 'ticket' && (() => {
     const parsedPlan = parsePlanData(data.campana);
     return (
       <div className="flex flex-col w-full mt-2 pt-4 border-t border-gray-100">
         <span className="text-gray-500 text-[14px] font-normal mb-3">Plan y Servicios Contratados</span>
         
         {/* Burbuja Principal: Paquete */}
         {parsedPlan.paquete && (
           <div className="bg-[#FF5A0A]/10 border border-[#FF5A0A]/20 text-gray-900 px-4 py-3 rounded-2xl flex items-center justify-between shadow-sm">
             <div className="pr-2">
               <p className="text-[11px] font-bold text-[#FF5A0A] uppercase tracking-wider mb-0.5">Paquete de Internet</p>
               <p className="text-[14px] font-bold">{toTitleCase(parsedPlan.paquete)}</p>
             </div>
             <div className="bg-[#FF5A0A] text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">
               Activo
             </div>
           </div>
         )}
         
         {/* Burbujas Secundarias: SVAs (Con Scroll Horizontal) */}
         {parsedPlan.svas.length > 0 && (
           <div className="mt-4 overflow-hidden -mx-5 px-5">
             <p className="text-[12px] text-gray-500 font-semibold mb-2 ml-1">Servicios Adicionales (SVA)</p>
             <div className="flex overflow-x-auto gap-2 pb-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
               <style>{\`
                 .flex.overflow-x-auto::-webkit-scrollbar { display: none; }
               \`}</style>
               {parsedPlan.svas.map((sva, idx) => (
                 <span key={idx} className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-[13px] font-semibold flex items-center shadow-sm whitespace-nowrap shrink-0">
                   <span className="w-2 h-2 rounded-full bg-yellow-400 mr-2"></span>
                   {toTitleCase(sva)}
                 </span>
               ))}
             </div>
           </div>
         )}
         
         {/* Fallback si no hay paquete separado por pipetas */}
         {!parsedPlan.paquete && (
           <div className="bg-gray-50 border border-gray-200 text-gray-900 px-4 py-3 rounded-2xl shadow-sm mt-2">
             <p className="text-[14px] font-bold leading-snug">{toTitleCase(data.campana || 'No especificado')}</p>
           </div>
         )}
       </div>
     );
   })()}
 </div>
 </div>`;

lines.splice(839, 911 - 840 + 1, newContent);
fs.writeFileSync('src/pages/Seguimiento.tsx', lines.join('\n'), 'utf8');
console.log('Done!');
