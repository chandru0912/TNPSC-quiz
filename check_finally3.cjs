const fs = require('fs');
const c = fs.readFileSync('src/pages/Admin.tsx','utf8');
const i = c.indexOf('handleUploadAIQuestions');
const e = c.indexOf('} finally',i);
const f = c.indexOf('}',e);
if(e>=0) console.log(c.substring(e,f+1));
else console.log('no');
