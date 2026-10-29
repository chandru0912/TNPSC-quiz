const fs = require('fs');
const c = fs.readFileSync('src/main.tsx','utf8');
console.log(c.includes('serviceWorker'));
console.log(c.includes('sw.js'));
