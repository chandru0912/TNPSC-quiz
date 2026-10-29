const fs = require('fs');
const files = ['src/pages/Group1UnitClass.tsx','src/pages/Group2UnitClass.tsx','src/pages/Group4UnitClass.tsx'];
files.forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  const idx = c.indexOf('Read Study Notes');
  if (idx >= 0) {
    const start = c.lastIndexOf('<button', idx-300);
    const end = c.indexOf('</button>', idx) + 9;
    console.log('===', f, '===');
    console.log(c.substring(start, end));
    console.log('\n---END---\n');
  }
});
