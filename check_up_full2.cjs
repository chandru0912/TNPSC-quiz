const fs = require('fs');
const c = fs.readFileSync('src/pages/Admin.tsx','utf8');
const i = c.indexOf('handleUploadAIQuestions');
const e = c.indexOf('  }', i);
const f = c.indexOf('\n  // Proceed', e);
if(f>=0) console.log(c.substring(i, f));
else console.log(c.substring(i, i+900));
