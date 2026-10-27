const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git') searchFiles(full);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.json') || f.endsWith('.md')) {
      const text = fs.readFileSync(full, 'utf8');
      if (text.includes('term:') || text.includes('term":') || text.includes('Term 1') || text.includes('பருவம்')) {
        console.log(`File: ${full}`);
      }
    }
  }
}

searchFiles('./src');
searchFiles('./');
