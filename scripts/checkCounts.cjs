const fs = require('fs');
const content = fs.readFileSync('src/utils/bilingualSyllabus.ts', 'utf8');

const start = content.indexOf('export const EXACT_TOPIC_TRANSLATIONS: Record<string, string> = {');
const end = content.indexOf('export const EXACT_LESSON_TITLES');
const slice = content.substring(start, end);
const lines = slice.split('\n').filter(l => l.includes(':'));
let englishCount = 0;
let tamilCount = 0;
for (const line of lines) {
  const parts = line.split(':');
  if (parts.length >= 2) {
    const val = parts.slice(1).join(':').trim();
    if (/[\u0B80-\u0BFF]/.test(val)) {
      tamilCount++;
    } else {
      englishCount++;
    }
  }
}
console.log('Topics: Tamil values =', tamilCount, 'English values =', englishCount);

const endLessons = content.indexOf('export const TOPIC_PHRASE_MAPPINGS');
const sliceL = content.substring(end, endLessons);
const linesL = sliceL.split('\n').filter(l => l.includes(':'));
let englishCountL = 0;
let tamilCountL = 0;
for (const line of linesL) {
  const parts = line.split(':');
  if (parts.length >= 2) {
    const val = parts.slice(1).join(':').trim();
    if (/[\u0B80-\u0BFF]/.test(val)) {
      tamilCountL++;
    } else {
      englishCountL++;
    }
  }
}
console.log('Lessons: Tamil values =', tamilCountL, 'English values =', englishCountL);
