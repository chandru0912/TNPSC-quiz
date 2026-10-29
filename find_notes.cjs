const fs = require('fs');
const path = require('path');
const srcDir = path.join(__dirname, 'src');
function walk(dir) {
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full);
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts') || entry.endsWith('.jsx') || entry.endsWith('.js')) {
      try {
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes('Read Study Notes')) {
          console.log(full.replace(srcDir + path.sep, 'src/').replace(/\\/g, '/'));
        }
      } catch (e) {}
    }
  }
}
walk(srcDir);
