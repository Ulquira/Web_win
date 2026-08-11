const fs = require('fs');
let code = fs.readFileSync('capa_intermedia/index.ts', 'utf8');

const regex = /if \(op\.Cuadrilla\) \{[\s\S]*?responseData\.tecnico = \{[\s\S]*?nombre: op\.Cuadrilla,[\s\S]*?cuadrilla: op\.Cuadrilla,[\s\S]*?telefono: op\.telefono \|\| 'Central'[\s\S]*?\};\n    \}/;

const newCode = `if (op.Cuadrilla) {
      // Intentar extraer solo el nombre del técnico si viene con formato 'P 26 EMPRESA SGI NOMBRE APELLIDO'
      let nombreLimpio = op.Cuadrilla;
      const sgiSplit = nombreLimpio.split('SGI');
      if (sgiSplit.length > 1) {
        nombreLimpio = sgiSplit[1].trim();
      } else {
        // Fallback: si es una cadena muy larga, intentar extraer solo las últimas palabras (nombres)
        const words = nombreLimpio.split(' ');
        if (words.length > 4) {
          nombreLimpio = words.slice(words.length - 4).join(' ').trim();
        }
      }

      responseData.tecnico = {
        nombre: nombreLimpio || 'Técnico Asignado',
        cuadrilla: op.Cuadrilla,
        telefono: op.telefono || 'Central'
      };
    }`;

code = code.replace(regex, newCode);
fs.writeFileSync('capa_intermedia/index.ts', code, 'utf8');
console.log('Nombre del técnico limpiado');
