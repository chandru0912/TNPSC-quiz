const fs = require('fs');
const c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
const i = c.indexOf('publish');
if (i >= 0) {
  let start = c.lastIndexOf('\n', i-200);
  let end = c.indexOf('\n', i+200);
  console.log(c.substring(start, end));
}
