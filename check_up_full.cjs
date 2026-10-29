const fs = require('fs');
const c = fs.readFileSync('src/pages/Admin.tsx','utf8');
const i = c.indexOf('handleUploadAIQuestions');
console.log(c.substring(i, i+700));
