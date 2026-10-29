const fs = require('fs');
const c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
const i = c.indexOf('handleUploadAIQuestions');
const j = c.indexOf('data.inserted', i);
if (j >= 0) {
  const s = c.lastIndexOf('const res', j-150);
  const e = c.indexOf('} else', j) + 10;
  console.log(c.substring(s, e));
}
