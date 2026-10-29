const fs = require('fs');
const c = fs.readFileSync('backend/src/routes/notes.ts','utf8');
console.log(c.includes('question'));
console.log(c.includes('attempt'));
console.log(c.includes('progress'));
