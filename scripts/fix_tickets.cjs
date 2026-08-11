const fs = require('fs');
let code = fs.readFileSync('capa_intermedia/index.ts', 'utf8');

const regex = /    const instalaciones = rows as any\[\];[\s\S]*?    \/\/ Mapeamos el estado real de tu BBDD a los estados que entiende el frontend del tercero/m;
const newBlock = `    const instalaciones = rows as any[];
    
    if (instalaciones.length === 0) {
      return res.status(404).json({ success: false, message: 'Operación no encontrada' });
    }

    const op = instalaciones[0];
    const isTicket = false; // Mantenemos la variable por compatibilidad con el frontend

    // Mapeamos el estado real de tu BBDD a los estados que entiende el frontend del tercero`;

code = code.replace(regex, newBlock);
fs.writeFileSync('capa_intermedia/index.ts', code, 'utf8');
console.log('Lógica de tabla TICKETS eliminada exitosamente');
