const fs = require('fs');

// Read generalTamilComprehensiveData.ts
const compFile = fs.readFileSync('./src/data/generalTamilComprehensiveData.ts', 'utf8');

// Count lessons in compFile
const unitMatches = [...compFile.matchAll(/id:\s*(\d+),\s*unitNumber:\s*"(அலகு [I|V|X]+)",\s*title:\s*"([^"]+)"/g)];
console.log(`Found ${unitMatches.length} units in generalTamilComprehensiveData:`);
for (const u of unitMatches) {
  console.log(`  Unit ${u[1]}: ${u[2]} - ${u[3]}`);
}

// Read group2TamilData.ts
const tamilDataFile = fs.readFileSync('./src/data/group2TamilData.ts', 'utf8');
const registryKeys = [...tamilDataFile.matchAll(/"(general-tamil-(\d+)-(\d+))":/g)];
console.log(`\nFound ${registryKeys.length} registry entries in group2TamilData.ts:`);
const standardMap = {};
for (const k of registryKeys) {
  const std = k[3];
  standardMap[std] = (standardMap[std] || 0) + 1;
}
console.log('Standards represented:', standardMap);

// Check terms in group2TamilData.ts
const termMatches = [...tamilDataFile.matchAll(/"term":\s*"([^"]+)"/g)];
const termCount = {};
for (const t of termMatches) {
  termCount[t[1]] = (termCount[t[1]] || 0) + 1;
}
console.log('\nTerms represented in lessons:', termCount);
