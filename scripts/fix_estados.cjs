const fs = require('fs');
let code = fs.readFileSync('src/pages/Seguimiento.tsx', 'utf8');

const regex = /const fetchedData = result\.data;/;
const newCode = `const fetchedData = result.data;
          
          // MAPEO DE NUEVOS ESTADOS DE BD A ESTADOS INTERNOS DE UI
          const dbStatus = fetchedData.status ? fetchedData.status.toLowerCase().trim() : '';
          let mappedStatus = fetchedData.status;

          switch (dbStatus) {
            case 'pendiente':
              mappedStatus = 'programada';
              break;
            case 'agendada':
              mappedStatus = 'asignado';
              break;
            case 'en camino':
              mappedStatus = 'en_camino';
              break;
            case 'iniciada':
              mappedStatus = 'en_proceso';
              break;
            case 'finalizada':
              mappedStatus = 'finalizada';
              break;
            case 'anulada':
            case 'regestion':
            case 'cancelada':
            case 'revisión':
            case 'revision':
              mappedStatus = 'cerrada';
              break;
          }
          fetchedData.status = mappedStatus;`;

code = code.replace(regex, newCode);
fs.writeFileSync('src/pages/Seguimiento.tsx', code, 'utf8');
console.log('Estados actualizados');
