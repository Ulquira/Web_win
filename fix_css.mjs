import fs from 'fs';
let css = fs.readFileSync('src/index.css', 'utf8');
css = css.replace(/--primary: 20 100% 52%; \/\* FF5A0A \*\//g, '--primary: 19 100% 52%; /* #FF5A0A exacto */');
css = css.replace(/font-family: 'Helvetica', Arial, sans-serif;/g, ont-family: 'Made Tommy', Helvetica, Arial, sans-serif;);
fs.writeFileSync('src/index.css', css, 'utf8');
console.log('CSS actualizado');
