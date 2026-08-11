import fs from 'fs';
let css = fs.readFileSync('src/index.css', 'utf8');
css = css.replace(/@font-face \{[^}]*\}\n/g, '');
let fontFaces = @font-face { font-family: 'Made Tommy'; src: url('/fonts/MADETOMMY-Light.otf') format('opentype'); font-weight: 300; font-style: normal; font-display: swap; }\n@font-face { font-family: 'Made Tommy'; src: url('/fonts/MADETOMMY-Regular.otf') format('opentype'); font-weight: 400; font-style: normal; font-display: swap; }\n@font-face { font-family: 'Made Tommy'; src: url('/fonts/MADETOMMY-Medium.otf') format('opentype'); font-weight: 500; font-style: normal; font-display: swap; }\n@font-face { font-family: 'Made Tommy'; src: url('/fonts/MADETOMMY-Bold.otf') format('opentype'); font-weight: 700; font-style: normal; font-display: swap; }\n;
css = fontFaces + css;
fs.writeFileSync('src/index.css', css, 'utf8');
console.log('Fonts updated');
