const fs = require('fs');
const c = fs.readFileSync('backend/src/routes/auth.ts','utf8');
if(c.includes('Database service is currently unavailable')) console.log('yes');
else console.log('no');
