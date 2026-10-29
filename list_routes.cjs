const fs = require('fs');
const c = fs.readFileSync('backend/src/routes/questions.ts', 'utf8');
const lines = c.split('\n');
lines.forEach((l,i) => {
  if (l.includes('router.post') || l.includes('router.put') || l.includes('router.patch') || l.includes('router.delete')) {
    console.log((i+1)+': '+l);
  }
});
