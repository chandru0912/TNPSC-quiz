const fs = require('fs');
const c = fs.readFileSync('src/pages/SchoolMaterials.tsx', 'utf8');
console.log(c.includes('notes'));
console.log(c.includes('Read'));
