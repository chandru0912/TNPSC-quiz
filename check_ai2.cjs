const fs = require('fs');
const c = fs.readFileSync('backend/src/routes/questions.ts', 'utf8');
const idx = c.indexOf('/ai-upload');
if (idx >= 0) {
  const s = Math.max(0, idx-100);
  const e = Math.min(c.length, idx+500);
  console.log(c.substring(s,e));
}
