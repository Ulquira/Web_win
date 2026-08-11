import fs from 'fs';
let c = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8');
c = c.replace(/\{\/\* Token de Inicio[\s\S]*?\}\n\s*\}\)/, '');
fs.writeFileSync('src/pages/Seguimiento.tsx', c, 'utf8');
console.log('Caja eliminada');
