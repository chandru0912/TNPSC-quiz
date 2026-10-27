const fs = require('fs');

const content = fs.readFileSync('./src/data/group2TamilData.ts', 'utf8');

const standards = [6, 7, 8, 9, 10, 11, 12];
for (const s of standards) {
  const stdRegex = new RegExp(`"general-tamil-\\d+-${s}":\\s*\\{[\\s\\S]*?"lessons":\\s*\\[([\\s\\S]*?)\\]\\s*\\}`, 'g');
  const matches = [...content.matchAll(stdRegex)];
  const terms = new Set();
  for (const m of matches) {
    const tMatches = [...m[1].matchAll(/"term":\s*"([^"]+)"/g)];
    tMatches.forEach(t => terms.add(t[1]));
  }
  console.log(`${s}th Standard terms in group2TamilData.ts:`, [...terms]);
}
