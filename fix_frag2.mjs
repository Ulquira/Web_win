import fs from 'fs';
let c = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8');
c = c.replace(/{\/\* Confirm & Success Modals inside Reprogram flow \*\/\}\n  <>\n  <AnimatePresence>/g, {\/* Confirm & Success Modals inside Reprogram flow */}\n  <AnimatePresence>);
c = c.replace(/<\/AnimatePresence>\n  <\/>/g, </AnimatePresence>);
fs.writeFileSync('src/pages/Seguimiento.tsx', c, 'utf8');
console.log('Fixed syntax');
