const fs = require('fs');
const c = fs.readFileSync('src/utils/api.ts','utf8');
console.log(c.includes('apiFetch'));
console.log(c.slice(0,120));
