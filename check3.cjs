const fs = require('fs');
const c = fs.readFileSync('src/pages/Group1UnitClass.tsx', 'utf8');
const i = c.indexOf('openLessonNotes');
if (i >= 0) {
  const s = c.lastIndexOf('\n', Math.max(0, i-400));
  const e = c.indexOf('\n\n', i);
  console.log(c.substring(s, e));
}
