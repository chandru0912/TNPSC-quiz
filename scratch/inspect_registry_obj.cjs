const fs = require('fs');

const content = fs.readFileSync('./src/data/group2TamilData.ts', 'utf8');
const exportIdx = content.indexOf('export const group2TamilRegistry');
const jsonStart = content.indexOf('{', exportIdx);
const jsonEnd = content.lastIndexOf('};');
const jsonStr = content.substring(jsonStart, jsonEnd + 1);

const registry = eval(`(${jsonStr})`);

for (const s of [6, 7, 8, 9, 10, 11, 12]) {
  const terms = new Set();
  let lessonCount = 0;
  for (let u = 1; u <= 7; u++) {
    const key = `general-tamil-${u}-${s}`;
    if (registry[key]) {
      lessonCount += registry[key].lessons.length;
      registry[key].lessons.forEach(l => terms.add(l.term));
    }
  }
  console.log(`${s}th Standard: ${lessonCount} lessons, terms:`, [...terms]);
}
