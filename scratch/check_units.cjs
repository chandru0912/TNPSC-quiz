const fs = require('fs');

const files = [
  'src/data/group2ClassSyllabusData.ts',
  'src/data/group2Unit3Data.ts',
  'src/data/group2Unit4Data.ts',
  'src/data/group2Unit5Data.ts',
  'src/data/group2Unit6Data.ts',
  'src/data/group2LanguageData.ts',
  'src/data/group4ClassSyllabusData.ts',
  'src/data/group1ClassSyllabusData.ts'
];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  const content = fs.readFileSync(f, 'utf8');
  const unitNumbers = new Set();
  const unitTitles = new Set();
  const reNum = /unitNumber:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = reNum.exec(content)) !== null) {
    unitNumbers.add(m[1]);
  }
  const reTitle = /unitTitle:\s*['"]([^'"]+)['"]/g;
  while ((m = reTitle.exec(content)) !== null) {
    unitTitles.add(m[1]);
  }
  console.log(f + ':');
  console.log('  unitNumbers:', Array.from(unitNumbers));
  console.log('  unitTitles:', Array.from(unitTitles));
});
