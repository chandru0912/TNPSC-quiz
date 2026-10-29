const fs = require('fs');
const c = fs.readFileSync('backend/src/routes/questions.ts', 'utf8');
const idx = c.indexOf("router.post('/upload'");
if (idx >= 0) {
  const e = c.indexOf('\nrouter.post', idx + 10);
  if (e === -1) console.log(c.substring(idx, idx+900));
  else console.log(c.substring(idx, e));
}
