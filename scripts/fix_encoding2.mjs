import fs from 'fs';
let c = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8');
c = c.replace(/<h3 className="text-\\[20px\\] font-bold text-\\[#0F090B\\] mb-8 leading-tight">[^<]+<\/h3>/, '<h3 className="text-[20px] font-bold text-[#0F090B] mb-8 leading-tight">' + decodeURIComponent('wr9Fc3TDoXMgc2VndXJvIGRlIHJlcHJvZ3JhbWFyIHR1IHZpc2l0YT8=') + '</h3>');
fs.writeFileSync('src/pages/Seguimiento.tsx', c, 'utf8');
console.log('Done');
