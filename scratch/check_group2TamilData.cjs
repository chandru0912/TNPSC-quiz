const fs = require('fs');
const content = fs.readFileSync('./src/data/group2TamilData.ts', 'utf8');

const keys = [...content.matchAll(/"(general-tamil-(\d+)-(\d+))":/g)];
console.log('Total keys in group2TamilData.ts:', keys.length);

const terms = [...content.matchAll(/"term":\s*"([^"]+)"/g)];
const termMap = {};
for (const t of terms) {
  termMap[t[1]] = (termMap[t[1]] || 0) + 1;
}
console.log('Terms breakdown:', termMap);

const stdMap = {};
for (const k of keys) {
  const std = k[3];
  stdMap[std] = (stdMap[std] || 0) + 1;
}
console.log('Standards breakdown (units per standard):', stdMap);
