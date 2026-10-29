const fs = require('fs');
const c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
const i = c.indexOf('handleUploadAIQuestions');
if (i >= 0) {
  const j = c.indexOf('try', i);
  const k = c.indexOf('catch', j);
  console.log(c.substring(j, k));
}
