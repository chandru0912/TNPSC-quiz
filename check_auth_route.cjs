const fs = require('fs');
const c = fs.readFileSync('backend/src/routes/auth.ts','utf8');
const lines = c.split('\n');
for(let i=0;i<lines.length;i++){
  if(lines[i].includes('router.post')){ console.log((i+1)+': '+lines[i]); break; }
}
