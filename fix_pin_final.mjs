import fs from 'fs';
let c = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8');
c = c.replace(/, pin_confirmacion: ''/g, '');
c = c.replace(/\/\* VALIDACI[^]*?return;\s*\n\s*\} \*\//, '');
c = c.replace(/\{\/\* INPUT DE PIN[^]*?\/> \*\/\}/, '');
c = c.replace(/Comparte este PIN/g, 'Muestra este código');
c = c.replace(/Código de seguridad/g, 'Código de instalación');
fs.writeFileSync('src/pages/Seguimiento.tsx', c, 'utf8');
console.log('Fixed');
