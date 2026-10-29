const fs = require('fs');
const c = fs.readFileSync('backend/src/server.ts','utf8');
console.log(c.includes('CORS_ORIGIN'));
console.log(c.includes('tnpsc-quiz-1rra490pf'));
console.log(c.includes('tnpsc-quiz-jwk1'));
