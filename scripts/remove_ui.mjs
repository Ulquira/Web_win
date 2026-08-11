import fs from 'fs';
let lines = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8').split('\n');
let start = -1; let end = -1;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('{/* Token de Inicio')) start = i;
  if (start !== -1 ; lines[i].includes('Llegada del t')) { end = i - 1; break; }
}
if (start !== -1 ; end !== -1) {
  lines.splice(start, end - start + 1);
  fs.writeFileSync('src/pages/Seguimiento.tsx', lines.join('\n'), 'utf8');
  console.log('Removed from ' + start + ' to ' + end);
}
