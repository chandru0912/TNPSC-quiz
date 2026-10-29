const fs = require('fs');
const c = fs.readFileSync('backend/src/server.ts','utf8');
console.log(c.includes("app.use('/api/admin'"));
console.log(c.includes("app.use('/api/questions'"));
console.log(c.includes("app.use('/api/notes'"));
