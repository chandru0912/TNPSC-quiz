const fs = require('fs');
const c = fs.readFileSync('src/pages/Group4UnitClass.tsx', 'utf8');
const i = c.indexOf('handleOpenLesson');
if (i >= 0) {
  const s = c.lastIndexOf('\n', Math.max(0, i-600));
  const e = c.indexOf('\n\n', i);
  console.log(c.substring(s, e));
}
