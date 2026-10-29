const fs = require('fs');
const c = fs.readFileSync('src/pages/Admin.tsx','utf8');
const i = c.indexOf('handleUploadAIQuestions');
const e = c.indexOf('} finally',i);
if(e>=0) console.log(c.substring(e-60,e+40));
else console.log('no');
