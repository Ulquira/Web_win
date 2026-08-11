import fs from 'fs';
let css = fs.readFileSync('src/index.css', 'utf8');
if(!css.includes('@font-face')) {
  let fontFace = "@font-face { font-family: 'Made Tommy'; src: local('Made Tommy'), local('MADETommy-Regular'); font-weight: 400; }\n@font-face { font-family: 'Made Tommy'; src: local('Made Tommy Medium'), local('MADETommy-Medium'); font-weight: 500; }\n@font-face { font-family: 'Made Tommy'; src: local('Made Tommy Bold'), local('MADETommy-Bold'); font-weight: 700; }\n";
  css = fontFace + css;
  fs.writeFileSync('src/index.css', css, 'utf8');
}
