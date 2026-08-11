import fs from 'fs';
let content = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8');
content = content.replace(/\/\* VALIDACI[^]*?return;?
  \} \*\//m, '');
content = content.replace(/\{\/\* INPUT DE PIN OCULTO[^]*?\/> \*\//m, '');
fs.writeFileSync('src/pages/Seguimiento.tsx', content, 'utf8');
console.log('PIN logic removed');
