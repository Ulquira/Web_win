import fs from 'fs';
let c = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8');
c = c.replace(/\/\* VALIDACI[\s\S]*?return;\s*\} \*\//, '');
c = c.replace(/\{\/\* INPUT DE PIN[\s\S]*?\/> \*\/\}/, '');
fs.writeFileSync('src/pages/Seguimiento.tsx', c, 'utf8');
console.log('Fixed PIN logic completely');
