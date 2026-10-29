const fs = require('fs');
const c = fs.readFileSync('backend/src/db.ts','utf8');
console.log(c.includes('DATABASE_URL'));
console.log(c.includes('POSTGRES_URL'));
console.log(c.includes('ssl'));
