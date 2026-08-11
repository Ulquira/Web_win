import fs from 'fs';
let c = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8');
let regex = /<AlertTriangle className="w-\\[60px\\] h-\\[60px\\] text-\\[#FF5A0A\\] mb-5" strokeWidth=\{1\.5\} \/>[^]*?<\/p>/m;
let b64 = 'PGltZyBzcmM9Ii93YXJuaW5nLnBuZyIgYWx0PSJBZHZlcnRlbmNpYSIgY2xhc3NOYW1lPSJ3LVs2MHB4XSBoLVs2MHB4XSBvYmplY3QtY29udGFpbiBtYi01IiAvPgogICAgPGgzIGNsYXNzTmFtZT0idGV4dC1bMjBweF0gZm9udC1ib2xkIHRleHQtWyMwRjA5MEJdIG1iLTggbGVhZGluZy10aWdodCI+wq9Fc3TDoXMgc2VndXJvIGRlIHJlcHJvZ3JhbWFyIHR1IHZpc2l0YT88L2gzPg==';
let newContent = Buffer.from(b64, 'base64').toString('utf8');
c = c.replace(regex, newContent);
fs.writeFileSync('src/pages/Seguimiento.tsx', c, 'utf8');
console.log('Modal warning fixed');
