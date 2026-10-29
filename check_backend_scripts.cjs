const fs = require('fs');
const p = JSON.parse(fs.readFileSync('backend/package.json','utf8'));
console.log(JSON.stringify(p.scripts));
