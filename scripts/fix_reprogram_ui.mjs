import fs from 'fs';
let c = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8');
c = c.replace(/className=\"w-full bg-\\[#1a202c\\] text-white h-12 rounded-full text-\\[14px\\] font-bold flex items-center justify-center gap-2 active:scale-95 \\ntransition-transform shadow-md flex-row-reverse\"/g, 'className=\"w-full bg-[#f2f2f2] text-[#0F090B] h-[60px] rounded-full text-[20px] font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform flex-row-reverse shadow-[0_4px_8px_rgba(0,0,0,0.1)]\"');
c = c.replace(/AlertTriangle, ArrowLeft \} from "lucide-react";/g, 'AlertTriangle, ArrowLeft, CalendarDays } from "lucide-react";');
fs.writeFileSync('src/pages/Seguimiento.tsx', c, 'utf8');
console.log('Fixed');
