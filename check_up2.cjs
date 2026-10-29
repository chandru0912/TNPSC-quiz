const fs = require('fs');
const c = fs.readFileSync('src/pages/Admin.tsx','utf8');
const i = c.indexOf('handleUploadAIQuestions');
const e = c.indexOf('if (!uploadedSuccess)', i);
if(e>=0) console.log(c.substring(e, e+500));
else console.log('no');
