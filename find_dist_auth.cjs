const fs = require('fs');
const c = fs.readFileSync('backend/dist/routes/auth.js','utf8');
const i = c.indexOf('Database service');
if(i>=0){
  const s = Math.max(0,i-80);
  const e = Math.min(c.length,i+100);
  console.log(c.substring(s,e));
}else console.log('no');
