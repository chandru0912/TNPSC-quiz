// scratch/update_subject.cjs
const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../src/data/group2SyllabusData.ts');
let content = fs.readFileSync(targetPath, 'utf8');

const startMarker = 'const generalEnglishSubject: Group2Subject = {';
const endMarker = '// SUBJECT 4: General Tamil';
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `const generalEnglishSubject: Group2Subject = {
  id: 'general-english',
  order: 3,
  title: 'General English',
  tamilTitle: 'பொது ஆங்கிலம்',
  partTag: 'Part C • SSLC Standard',
  standard: 'SSLC Standard (10th Standard)',
  questionCount: 100,
  description:
    'Complete SSLC language syllabus consisting of Grammar (25 Qs), Vocabulary (15 Qs), Writing Skills (10 Qs), Technical Terms (10 Qs), Reading Comprehension (20 Qs), Translation (5 Qs), and Literary Works (15 Qs).',
  accentColor: '#ec4899',
  units: group2GeneralEnglishUnits,
}

// -------------------------------------------------------------
`;
  content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log('Successfully updated generalEnglishSubject in group2SyllabusData.ts');
} else {
  console.error('Markers not found', startIdx, endIdx);
}
