// scratch/audit_english_complete.cjs
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'tnpsc_study_hub',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
});

async function runAudit() {
  console.log('=====================================================');
  console.log('AUDIT: TNPSC GROUP 2 / 2A GENERAL ENGLISH UNITS 1 TO 7');
  console.log('=====================================================\n');

  // 1. Audit generalEnglishComprehensiveData.ts
  const dataPath = path.join(__dirname, '../src/data/generalEnglishComprehensiveData.ts');
  const content = fs.readFileSync(dataPath, 'utf8');
  const eqIdx = content.indexOf('=', content.indexOf('export const group2GeneralEnglishUnits'));
  const jsonStart = content.indexOf('[', eqIdx);
  const jsonEnd = content.lastIndexOf(']');
  const units = JSON.parse(content.substring(jsonStart, jsonEnd + 1));

  console.log(`1. Comprehensive Units Count: ${units.length}`);
  let totalLessons = 0;
  let totalMCQs = 0;

  units.forEach(u => {
    let uLessons = 0;
    let uMCQs = 0;
    u.chapters.forEach(c => {
      uLessons += c.lessons.length;
      c.lessons.forEach(l => {
        uMCQs += (l.practiceQuestions || []).length;
      });
    });
    totalLessons += uLessons;
    totalMCQs += uMCQs;
    console.log(`   - ${u.unitNumber}: ${u.title} (${u.questionCount} Qs) -> ${u.chapters.length} Chapters, ${uLessons} Lessons, ${uMCQs} MCQs`);
  });
  console.log(`   Total Syllabus Lessons: ${totalLessons}, Total Syllabus MCQs: ${totalMCQs}\n`);

  // 2. Audit Unit VII Literary Works
  const u7 = units.find(u => u.id === 7);
  console.log('2. Unit VII Literary Prescribed Works Audit:');
  const u7Topics = u7.officialTopics.join(' ');
  
  const poemList = [
    "I Dream of Spices", "The Crocodile", "Teamwork", "From a Railway Carriage",
    "A Tragic Story", "Sea Fever", "Courage", "The Age of Chivalry",
    "Wandering Singers", "The Listeners", "Your Space", "Special Hero",
    "Stopping by Woods on a Snowy Evening", "Leisure", "A Poison Tree",
    "The Power of a Smile", "On Killing a Tree", "Advice from a Tree",
    "The Spider and The Fly", "Never Trust a Mirror", "The River",
    "Nature the Gentlest Mother", "The Comet", "The Star",
    "The Stick-Together Families", "Memories of My Dad", "Life",
    "The Grumble Family", "The Secret of the Machines", "The House on Elm Street"
  ];

  const proseList = [
    "His First Flight", "The Night the Ghost Got In", "Empowered Women Navigating the World",
    "The Attic", "Tech Bloomers", "The Last Lesson", "The Dying Detective",
    "Learning The Game", "I Can’t Climb Trees Anymore", "Old Man River",
    "Seventeen Oranges", "Water – The Elixir of Life", "From Zero to Infinity",
    "A Birthday Letter", "The Nose Jewel", "Hobby – Turns A Successful Career",
    "Sir Isaac Newton", "My Reminiscence", "Sea Turtles", "When the Trees Walked",
    "A Visitor from Distant Lands", "Sports Stars", "The Last Stone Carver",
    "Eidgah", "The Wind on Haunted Hill", "A Prayer to the Teacher",
    "The Tempest", "A Hunter Turned Naturalist", "The Cat and the Painkiller"
  ];

  let missingPoems = poemList.filter(p => !u7Topics.includes(p.replace(/’/g, "'")));
  let missingProse = proseList.filter(p => !u7Topics.includes(p.replace(/’/g, "'")));
  console.log(`   - Prescribed Poems Check: ${poemList.length - missingPoems.length} / ${poemList.length} present`);
  if (missingPoems.length) console.log('     Missing poems:', missingPoems);
  console.log(`   - Prescribed Prose Check: ${proseList.length - missingProse.length} / ${proseList.length} present`);
  if (missingProse.length) console.log('     Missing prose:', missingProse);

  // 3. Audit group2EnglishData.ts (School Standards 6 to 12)
  const regPath = path.join(__dirname, '../src/data/group2EnglishData.ts');
  const regContent = fs.readFileSync(regPath, 'utf8');
  const regEqIdx = regContent.indexOf('=', regContent.indexOf('export const group2EnglishRegistry'));
  const regJsonStart = regContent.indexOf('{', regEqIdx);
  const regJsonEnd = regContent.lastIndexOf('}');
  const registry = JSON.parse(regContent.substring(regJsonStart, regJsonEnd + 1));
  console.log(`\n3. School Textbook Mapping Keys: ${Object.keys(registry).length} (Expected: 7 Units x 7 Standards = 49 keys)`);

  // 4. Audit PostgreSQL database
  console.log('\n4. Database Records Verification (PostgreSQL):');
  const dbRes = await pool.query(`
    SELECT category, subject, unit_id, count(*) as count
    FROM questions 
    WHERE category = 'group2' AND subject = 'General English'
    GROUP BY category, subject, unit_id
    ORDER BY unit_id;
  `);
  console.table(dbRes.rows);
  const totalDbQuestions = dbRes.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
  console.log(`   Total Published Database Questions for General English: ${totalDbQuestions}`);

  // 5. Verify Unaffected Subjects
  const unRes = await pool.query(`
    SELECT subject, count(*) as count
    FROM questions 
    WHERE category = 'group2' AND subject != 'General English'
    GROUP BY subject;
  `);
  console.log('\n5. Unaffected Subjects Verification in Database:');
  console.table(unRes.rows);

  await pool.end();
  console.log('\nAudit completed successfully!');
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  pool.end();
});
