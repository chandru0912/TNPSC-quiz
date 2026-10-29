const fs = require('fs');
const c = fs.readFileSync('backend/.env','utf8');
console.log(c.match(/DATABASE_URL|POSTGRES_URL|PGHOST/) ? 'has' : 'no');
