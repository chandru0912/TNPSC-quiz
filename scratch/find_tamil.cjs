const fs = require('fs');

['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'].forEach(u => {
  const filePath = `scratch/english_${u}.cjs`;
  const c = fs.readFileSync(filePath, 'utf8');
  const count = (c.match(/[\u0B80-\u0BFF]/g) || []).length;
  console.log(`${filePath} Tamil chars:`, count);
});
