const fs = require('fs');
let code = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8');

const regexFecha = /<span className="font-bold text-gray-900 text-\[14px\] capitalize">\s*\{data\.fecha_programacion && parseSafeDate\(data\.fecha_programacion\) \? format\(parseSafeDate\(data\.fecha_programacion\)!, "d 'de' MMMM", \{ locale: es \}\) : 'Por definir'\}\s*<\/span>/m;
const nuevaFecha = `<span className="font-bold text-gray-900 text-[14px]">
     {data.fecha_programacion && parseSafeDate(data.fecha_programacion) ? (
       \`\${format(parseSafeDate(data.fecha_programacion)!, "d 'de' ", { locale: es })}\${format(parseSafeDate(data.fecha_programacion)!, "MMMM", { locale: es }).toUpperCase()}\`
     ) : 'Por definir'}
     </span>`;

code = code.replace(regexFecha, nuevaFecha);
fs.writeFileSync('src/pages/Seguimiento.tsx', code, 'utf8');
console.log('Fecha arreglada');
