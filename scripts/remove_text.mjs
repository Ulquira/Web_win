import fs from 'fs';
let lines = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8').split('\n');
let target = -1;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('AlertTriangle className="w-[60px]')) { target = i; break; }
}
if (target !== -1) {
  lines.splice(target, 5, '  <img src="/warning.png" alt="Advertencia" className="w-[60px] h-[60px] object-contain mb-5" />', '  <h3 className="text-[20px] font-bold text-[#0F090B] mb-8 leading-tight">¿Estás seguro de reprogramar tu visita?</h3>');
  fs.writeFileSync('src/pages/Seguimiento.tsx', lines.join('\n'), 'utf8');
  console.log('Modal cleaned successfully');
}
