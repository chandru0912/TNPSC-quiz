const fs = require('fs');
const c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
const i = c.indexOf('/api/questions/publish');
if (i >= 0) {
  const s = Math.max(0, i-150);
  const e = Math.min(c.length, i+250);
  console.log(c.substring(s,e));
} else {
  console.log('not found');
}
