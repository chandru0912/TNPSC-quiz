const fs = require('fs');
const c = fs.readFileSync('src/pages/Admin.tsx','utf8');
const i = c.indexOf('handleUploadAIQuestions');
console.log(i>=0);
if(i>=0){
  const s = c.lastIndexOf('\n', i-100);
  const e = c.indexOf('catch', i)+80;
  console.log(c.substring(s,e));
}
