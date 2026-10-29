const fs = require('fs');
const c = fs.readFileSync('backend/src/routes/questions.ts','utf8');
const i = c.indexOf("router.get('/admin'");
const e = c.indexOf('} catch', i);
if(e>=0) console.log(c.substring(e, e+250));
else console.log('no');
