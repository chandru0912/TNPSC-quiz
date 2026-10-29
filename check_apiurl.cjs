const fs = require('fs');
const c = fs.readFileSync('src/utils/api.ts','utf8');
console.log(c.includes('tnpsc-quiz-jwkl'));
console.log(c.includes('tnpsc-quiz-jwk1'));
