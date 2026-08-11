const fs = require('fs');
let code = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8');

// 1. Agregar el import de locale 'es'
code = code.replace('import { format } from "date-fns";', 'import { format } from "date-fns";\nimport { es } from "date-fns/locale";');

// 2. Cambiar formato de fecha y hacer capitalize
code = code.replace(
  '{data.fecha_programacion && parseSafeDate(data.fecha_programacion) ? format(parseSafeDate(data.fecha_programacion)!, "dd/MM/yyyy") : \'Por definir\'}',
  '{data.fecha_programacion && parseSafeDate(data.fecha_programacion) ? format(parseSafeDate(data.fecha_programacion)!, "d \'de\' MMMM", { locale: es }) : \'Por definir\'}'
);
code = code.replace('<span className="font-bold text-gray-900 text-[14px]">\n     {data.fecha_programacion && parseSafeDate', '<span className="font-bold text-gray-900 text-[14px] capitalize">\n     {data.fecha_programacion && parseSafeDate');

// 3. Quitar botón 'Activo'
const oldActivo = `<div className="bg-[#FF5A0A]/10 border border-[#FF5A0A]/20 text-gray-900 px-4 py-3 rounded-2xl flex items-center justify-between shadow-sm">
             <div className="pr-2">
               <p className="text-[11px] font-bold text-[#FF5A0A] uppercase tracking-wider mb-0.5">Paquete de Internet</p>
               <p className="text-[14px] font-bold">{toTitleCase(parsedPlan.paquete)}</p>
             </div>
             <div className="bg-[#FF5A0A] text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">
               Activo
             </div>
           </div>`;

const newActivo = `<div className="bg-[#FF5A0A]/10 border border-[#FF5A0A]/20 text-gray-900 px-4 py-3 rounded-2xl flex items-center shadow-sm">
             <div className="pr-2">
               <p className="text-[11px] font-bold text-[#FF5A0A] uppercase tracking-wider mb-0.5">Paquete de Internet</p>
               <p className="text-[14px] font-bold">{toTitleCase(parsedPlan.paquete)}</p>
             </div>
           </div>`;
code = code.replace(oldActivo, newActivo);

// 4. Quitar '(SVA)'
code = code.replace('Servicios Adicionales (SVA)', 'Servicios Adicionales');

fs.writeFileSync('src/pages/Seguimiento.tsx', code, 'utf8');
console.log('Modificado correctamente!');
