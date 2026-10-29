const fs = require('fs');
const q = fs.readFileSync('backend/src/routes/questions.ts','utf8');
const a = fs.readFileSync('src/pages/Admin.tsx','utf8');
console.log('q insertedIds:', q.includes('insertedIds'));
console.log('q resInsert.rows:', q.includes('resInsert.rows'));
console.log('q ids count:', (q.match(/insertedIds/g)||[]).length);
console.log('a publish ids:', a.includes('JSON.stringify({ ids })'));
console.log('a fallback:', a.includes("JSON.stringify({})"));
