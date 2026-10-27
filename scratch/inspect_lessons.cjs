const fs = require('fs');

const content = fs.readFileSync('./src/data/group2TamilData.ts', 'utf8');

// Parse registry
const regex = /"(general-tamil-(\d+)-(\d+))":\s*\{/g;
let match;
const keys = [];
while ((match = regex.exec(content)) !== null) {
  keys.push({ key: match[1], unit: parseInt(match[2]), standard: parseInt(match[3]) });
}

console.log(`Total keys found: ${keys.length}`);

// For each key, let's see how many lessons it has
for (const k of keys.slice(0, 7)) {
  const startIdx = content.indexOf(`"${k.key}":`);
  const nextKeyIdx = content.indexOf(`"general-tamil-`, startIdx + 1);
  const block = nextKeyIdx !== -1 ? content.substring(startIdx, nextKeyIdx) : content.substring(startIdx);
  const lessonMatches = [...block.matchAll(/"id":\s*"(gt-[^"]+)"/g)];
  const termMatches = [...block.matchAll(/"term":\s*"([^"]+)"/g)];
  console.log(`Key ${k.key}: ${lessonMatches.length} lessons, terms: ${termMatches.map(m => m[1]).join(', ')}`);
}
