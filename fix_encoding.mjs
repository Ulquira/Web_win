import fs from 'fs';
let c = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8');
c = c.replace(/<h3 className="text-\\[20px\\] font-bold text-\\[#0F090B\\] mb-8 leading-tight">.*?seguro de reprogramar tu visita\?<\/h3>/, '<h3 className="text-[20px] font-bold text-[#0F090B] mb-8 leading-tight">¿Estás seguro de reprogramar tu visita?</h3>');
fs.writeFileSync('src/pages/Seguimiento.tsx', c, 'utf8');
console.log('Encoding fixed');
