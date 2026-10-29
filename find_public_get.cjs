const fs = require('fs');
const c = fs.readFileSync('backend/src/routes/questions.ts', 'utf8');
const idx = c.indexOf("router.get('/', async");
if (idx >= 0) {
  const e = c.indexOf('\nrouter.', idx + 5);
  if (e === -1) console.log(c.substring(idx, idx+700));
  else console.log(c.substring(idx, e));
}
