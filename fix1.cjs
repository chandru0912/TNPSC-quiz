const fs = require('fs');
let c = fs.readFileSync('src/pages/Group1UnitClass.tsx', 'utf8');
const old = `                      <button
                        className="lesson-read-btn"
                        onClick={() => openLessonNotes(lesson)}
                        title={`Open interactive study notes for ${translated.title}`}
                      >
                        <BookMarked size={15} />
                        <span>{isTamil ? 'பாடக்குறிப்புகளைப் படிக்க' : 'Read Study Notes'}</span>
                      </button>`;
const neu = `                      <button
                        className="lesson-read-btn"
                        onClick={() => {
                          const lessonTitle = translated?.title || lesson.title;
                          navigate(\`/study-notes/group1/unit/\${parsedUnitId}/lesson/\${encodeURIComponent(lessonTitle)}?lang=\${isTamil ? 'tamil' : 'english'}\${parsedClassId ? '&classId='+parsedClassId : ''}\`);
                        }}
                        title={isTamil ? 'பாடக் குறிப்புகளைப் படிக்க' : 'Read Study Notes'}
                      >
                        <BookMarked size={15} />
                        <span>{isTamil ? 'பாடக்குறிப்புகளைப் படிக்க' : 'Read Study Notes'}</span>
                      </button>`;
if (c.includes(old)) {
  c = c.replace(old, neu);
  fs.writeFileSync('src/pages/Group1UnitClass.tsx', c);
  console.log('ok1');
} else {
  console.log('no1');
}
