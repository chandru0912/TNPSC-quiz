const fs = require('fs');
const c = JSON.parse(fs.readFileSync('backend/tsconfig.json','utf8'));
console.log(JSON.stringify(c));
