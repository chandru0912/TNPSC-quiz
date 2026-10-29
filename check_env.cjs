const fs = require('fs');
const c = fs.readFileSync('backend/.env','utf8');
c.split('\n').forEach(l=>{
  if(/^(DB_|DATABASE_|POSTGRES_|PG|PORT|JWT|ADMIN|CORS)/.test(l)){
    console.log(l.split('=')[0]+'=');
  }
});
