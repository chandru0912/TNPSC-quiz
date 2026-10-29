const fs = require('fs');
const c = fs.readFileSync('backend/src/routes/auth.ts','utf8');
console.log(c.includes('tnpscadmin2026'));
console.log(c.includes('content_admin'));
console.log(c.includes('reviewer'));
