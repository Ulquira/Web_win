import fs from 'fs';
let lines = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8').split('\n');
let target = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<img src="/warning.png" alt="Advertencia" className="w-[60px]')) { target = i + 1; break; }
}
if (target !== -1) {
  lines[target] = Buffer.from('ICA8aDMgY2xhc3NOYW1lPSJ0ZXh0LVsyMHB4XSBmb250LWJvbGQgdGV4dC1bIzBGMDkwQl0gbWItOCBsZWFkaW5nLXRpZ2h0Ij7CJUVzdMOhcyBzZWd1cm8gZGUgcmVwcm9ncmFtYXIgdHUgdmlzaXRhPzwvaDM+', 'base64').toString('utf8');
  fs.writeFileSync('src/pages/Seguimiento.tsx', lines.join('\n'), 'utf8');
}
