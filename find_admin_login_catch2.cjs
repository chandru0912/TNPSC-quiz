const fs = require('fs');
const c = fs.readFileSync('src/pages/Admin.tsx','utf8');
const i = c.indexOf('handleLogin');
const e = c.indexOf('} catch (err)', i);
if(e>=0) console.log(c.substring(e, e+250));
else console.log('no');
