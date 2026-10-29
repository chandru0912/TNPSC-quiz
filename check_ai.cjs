const fs = require('fs');
const c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
const idx = c.indexOf('handleUploadAIQuestions');
if (idx >= 0) {
  const s = Math.max(0, idx-80);
  const e = Math.min(c.length, idx+450);
  console.log(c.substring(s,e));
}
