const fs = require('fs');
const c = fs.readFileSync('backend/src/routes/auth.ts','utf8');
const i = c.indexOf('503');
if(i>=0){
  const s = Math.max(0,i-60);
  const e = Math.min(c.length,i+100);
  console.log(c.substring(s,e));
}else console.log('no');
