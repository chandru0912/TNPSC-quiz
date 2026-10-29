const fs = require('fs');
const files = ['src/pages/Group1UnitClass.tsx','src/pages/Group2UnitClass.tsx','src/pages/Group4UnitClass.tsx'];
files.forEach(f => {
  const p = f;
  try {
    const c = fs.readFileSync(p, 'utf8');
    const idx = c.indexOf('Read Study Notes');
    if (idx >= 0) {
      console.log('===', f, '===');
      console.log(c.substring(Math.max(0, idx-150), idx+150));
      console.log('\n');
    } else {
      console.log(f, ': NOT FOUND');
    }
  } catch(e) {
    console.log(f, e.message);
  }
});
