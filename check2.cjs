const fs = require('fs');
['src/pages/Group1UnitClass.tsx','src/pages/Group2UnitClass.tsx','src/pages/Group4UnitClass.tsx'].forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  console.log(f, c.includes('openLessonNotes'), c.includes('handleOpenLesson'));
});
