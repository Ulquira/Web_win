import fs from 'fs';
let c = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8');
c = c.replace(/<VoidFragment>/g, '<>');
c = c.replace(/<\/VoidFragment>/g, '</>');
fs.writeFileSync('src/pages/Seguimiento.tsx', c, 'utf8');
console.log('Fragments fixed');
