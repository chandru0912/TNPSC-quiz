const fs = require('fs');
const c = fs.readFileSync('backend/src/migrate.ts','utf8');
console.log(c.includes('admin_users'));
console.log(c.includes('users'));
