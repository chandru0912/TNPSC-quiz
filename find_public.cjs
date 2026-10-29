const fs = require('fs');
const c = fs.readFileSync('backend/src/routes/questions.ts', 'utf8');
const lines = c.split('\n');
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('router.get')) {
    console.log((i+1)+': '+lines[i]);
    if (i<lines.length-5) console.log(lines.slice(i+1,i+6).join('\n'));
    console.log('---');
  }
}
