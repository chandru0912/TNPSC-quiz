const fs = require('fs');
const files = ['backend/src/db.ts','backend/src/index.ts','backend/src/routes/auth.ts'];
files.forEach(f=>{
  try{
    const c = fs.readFileSync(f,'utf8');
    if(/credential|DATABASE_URL|DB_|PGHOST|PGUSER|PGPASSWORD|PGDATABASE/i.test(c)){
      console.log('===',f,'===');
      const lines = c.split('\n');
      for(let i=0;i<lines.length;i++){
        if(/credential|DATABASE_URL|DB_|PGHOST|PGUSER|PGPASSWORD|PGDATABASE|pool|connect|missing|unavailable/i.test(lines[i])){
          console.log((i+1)+': '+lines[i]);
        }
      }
      console.log('');
    }
  }catch(e){}
});
