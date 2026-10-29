const fs = require('fs');
const c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
const idx = c.indexOf('handleUploadAIQuestions');
const j = c.indexOf('patch', idx);
if (j >= 0) {
  const s = Math.max(0, j-150);
  const e = Math.min(c.length, j+100);
  console.log(c.substring(s,e));
}
