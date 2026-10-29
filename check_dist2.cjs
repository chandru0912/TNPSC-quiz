const fs = require('fs');
const c = fs.readFileSync('backend/dist/routes/auth.js','utf8');
console.log(c.includes('Database credentials currently unavailable'));
console.log(c.includes('Database service is currently unavailable'));
