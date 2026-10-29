const fs = require('fs');
const c = fs.readFileSync('backend/src/routes/questions.ts','utf8');
const i = c.indexOf("router.post('/upload'");
const e = c.indexOf('} catch (error', i);
if(e>=0) console.log(c.substring(e, e+200));
else console.log('no');
