const fs = require('fs');
const c = fs.readFileSync('src/pages/Group1Lessons.css', 'utf8');
const i = c.indexOf('.lessons-header');
if (i >= 0) console.log(c.substring(i, i+300));
