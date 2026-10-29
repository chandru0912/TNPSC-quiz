const fs = require('fs');
const c = fs.readFileSync('src/pages/Admin.tsx','utf8');
const i = c.indexOf('handleLogin');
const s = c.indexOf('try', i);
const e = c.indexOf('} catch (err)', i);
if(s>=0 && e>=0) console.log(c.substring(s, e));
else console.log('no');
