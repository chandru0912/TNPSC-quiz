const fs = require('fs');
const c = fs.readFileSync('src/utils/api.ts','utf8');
console.log(c.includes('VITE_API_BASE_URL'));
console.log(c.includes('/api'));
