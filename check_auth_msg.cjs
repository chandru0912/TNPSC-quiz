const fs = require('fs');
const c = fs.readFileSync('backend/src/routes/auth.ts','utf8');
console.log(c.includes('Database credentials'));
const i = c.indexOf('Database');
if(i>=0){console.log(c.substring(i,i+60));}
