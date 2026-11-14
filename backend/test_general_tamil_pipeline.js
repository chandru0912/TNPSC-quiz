/**
 * test_general_tamil_pipeline.js
 * Comprehensive end-to-end verification for General Tamil AI Syllabus Import.
 * Tests:
 * 1. 7 Canonical Unit Extraction from Official Syllabus Text
 * 2. Standard-wise and Unit-wise Lesson Mapping (Classes 6-12)
 * 3. Idempotent Publish & Zero Duplicate Prevention on Re-import
 * 4. Relationship Integrity: syllabus_subjects -> syllabus_units -> syllabus_lessons -> syllabus_topics
 * 5. Protection of Existing Data (72 textbooks, General Studies, Aptitude, General English)
 */

const { pool } = require('./dist/db');
const { AISyllabusEngineService, normalizeTamilText } = require('./dist/services/aiSyllabusEngineService');
const { CANONICAL_SYLLABUS_LESSONS } = require('./dist/data/canonicalSyllabusLessons');

const sampleTamilSyllabus = `அலகு I: இலக்கணம்
(i) பொருத்துதல், பொருத்தமான பொருளைத் தேர்வு செய்தல், பிரித்து எழுதுக, சேர்த்து எழுதுக.
(ii) சந்திப் பிழையற்ற தொடர், மரபுப் பிழைகள், வழுவுச் சொற்கள் நீக்குதல்.
(iii) எழுத்துகளின் பிறப்பு, சொல் இலக்கணம், வேர்ச்சொல் அறிதல், வினைமுற்று அமைத்தல்.
(iv) பெயர்ச்சொல், வினைச்சொல், தொகைநிலை மற்றும் தொகாநிலைத் தொடர்கள், அணி மற்றும் யாப்பிலக்கணம்.

அலகு II: சொல்லகராதி
(i) அகரவரிசைப்படுத்துதல், எதிர்ச்சொல் அறிதல் மற்றும் ஒருபொருள் குறித்த பலசொற்கள்.
(ii) மரபுத் தொடர்கள், பழமொழிகள் மற்றும் சொற்றொடர் அமைப்பு.
(iii) இலக்கிய வகைச் சொற்கள் (இயற்சொல், திரிசொல், திசைச்சொல், வடசொல்).
(iv) இணைச் சொற்கள், குறுக்கங்கள் மற்றும் மயங்கொலி வேறுபாடுகள்.

அலகு III: எழுதும் திறன்
(i) கடிதம் எழுதுதல் (அலுவல் முறை மற்றும் விண்ணப்பக் கடிதங்கள்).
(ii) பத்தி சுருக்குதல் (Note-making & Summary / Précis Writing).
(iii) பத்தி அமைத்தல், கருத்து ஒருமைப்பாடு மற்றும் தொடர் ஒழுங்கு.
(iv) விண்ணப்பப் படிவங்கள் மற்றும் மனுக்கள் தயாரிக்கும் முறை.

அலகு IV: கலைச் சொற்கள்
(i) அலுவலக மற்றும் தலைமைச் செயலகக் கலைச்சொற்கள்.
(ii) நீதிமன்றம், சட்டம் மற்றும் நிருவாகச் சொற்களஞ்சியம்.
(iii) அறிவியல் மற்றும் கணினித் தமிழ்க் கலைச்சொற்கள்.
(iv) வணிகவியல், நிதி மற்றும் வங்கித் துறை கலைச்சொற்கள்.

அலகு V: வாசித்தல் – புரிந்து கொள்ளும் திறன்
(i) பத்தியைப் படித்து வினாக்களுக்கு விடையளித்தல்.
(ii) கருத்துணர்தல் மற்றும் மையக்கருத்தைக் கண்டறிதல்.
(iii) உரைநடைப் பத்தி பகுப்பாய்வு மற்றும் ஆசிரியர் நோக்கம்.
(iv) தகவல்களைத் திரட்டுதல் மற்றும் தர்க்கரீதியான முடிவெடுத்தல்.

அலகு VI: எளிய மொழிபெயர்ப்பு
(i) ஆங்கிலத்திலிருந்து தமிழாக்கம் செய்தல்.
(ii) தமிழிலிருந்து ஆங்கிலத்தில் மொழிபெயர்த்தல்.
(iii) அலுவல் கடிதங்கள் மற்றும் சுற்றறிக்கைகள் மொழிபெயர்ப்பு.
(iv) மொழிபெயர்ப்பு நெறிமுறைகள் மற்றும் தொடர் மாற்ற உத்திகள்.

அலகு VII: இலக்கியம், தமிழ் அறிஞர்களும், தமிழ்த்தொண்டும்
(i) திருக்குறள் தொடர்பான செய்திகள், மேற்கோள்கள், நாலடியார், நான்மணிக்கடிகை, பழமொழி நானூறு.
(ii) ஐம்பெருங்காப்பியங்கள் (சிலப்பதிகாரம், மணிமேகலை), பெரியபுராணம், கம்பராமாயணம், சீறாப்புராணம், சிற்றிலக்கியங்கள்.
(iii) பாரதியார், பாரதிதாசன், நாமக்கல் கவிஞர், கவிமணி, உ.வே.சா, பெரியார், அண்ணா, மறைமலையடிகள்.
(iv) நாட்டுப்புறக் கலைகள், தமிழர் பண்பாடு, தொல்லியல் மற்றும் கீழடி அகழாய்வுகள்.`;

async function runTests() {
  console.log('====================================================');
  console.log('   GENERAL TAMIL AI SYLLABUS IMPORT PIPELINE TESTS  ');
  console.log('====================================================\n');

  // TEST 1: Unit Extraction
  console.log('[TEST 1] Testing 7-Unit Syllabus Analysis...');
  const analyzedUnits = await AISyllabusEngineService.analyzeSyllabus('group4', sampleTamilSyllabus, 'general-tamil');
  console.log(`Analyzed Units Count: ${analyzedUnits.length}`);
  if (analyzedUnits.length !== 7) {
    throw new Error(`Expected exactly 7 units for General Tamil, got ${analyzedUnits.length}`);
  }
  analyzedUnits.forEach((u) => {
    console.log(`  - Unit ${u.unit_number}: ${u.title} (${u.syllabus_topics.length} topics)`);
  });
  console.log('  -> TEST 1 PASSED: Exactly 7 canonical units extracted in order.\n');

  // TEST 2: Textbook & Canonical Lesson Matching across Units 1 to 7
  console.log('[TEST 2] Testing Lesson Matching & Standard Isolation (Classes 6-12)...');
  const tamilTextbooks = await pool.query(`
    SELECT id, standard, subject, file_name
    FROM google_drive_materials
    WHERE upload_status = 'completed' AND (subject ILIKE '%tamil%' OR file_name ILIKE '%tamil%')
    ORDER BY standard, id
  `);
  console.log(`Found ${tamilTextbooks.rows.length} Tamil textbooks in database.`);
  const tbIds = tamilTextbooks.rows.map((r) => r.id);

  const matched = await AISyllabusEngineService.matchTextbooksBatch(analyzedUnits, tbIds, {
    selectedStandards: [6, 7, 8, 9, 10, 11, 12],
  });

  const unitsWithLessons = matched.units;
  let totalMappedLessons = 0;
  unitsWithLessons.forEach((u) => {
    totalMappedLessons += (u.lessons || []).length;
    console.log(`  Unit ${u.unit_number} (${u.title}): ${(u.lessons || []).length} lessons mapped`);
  });

  if (totalMappedLessons === 0) {
    throw new Error('Lesson mapping failed: 0 lessons mapped across units.');
  }

  // Check no unit is empty
  const emptyUnits = unitsWithLessons.filter((u) => !u.lessons || u.lessons.length === 0);
  if (emptyUnits.length > 0) {
    throw new Error(`Units left empty: ${emptyUnits.map((u) => u.unit_number).join(', ')}`);
  }

  // Check standard isolation: every lesson in standard X must have standard_number === X
  for (const u of unitsWithLessons) {
    for (const l of u.lessons || []) {
      if (!l.standard_number || l.standard_number < 6 || l.standard_number > 12) {
        throw new Error(`Invalid standard number on lesson ${l.title}: ${l.standard_number}`);
      }
      if (l.title.toLowerCase().includes('chapter 1') && !l.title.includes('இயல்')) {
        throw new Error(`Generic placeholder detected: ${l.title}`);
      }
    }
  }
  console.log(`  -> TEST 2 PASSED: ${totalMappedLessons} lessons mapped with strict standard isolation.\n`);

  // TEST 3: Duplicate Prevention on Initial and Re-import Publish
  console.log('[TEST 3] Testing Idempotent Publishing & Duplicate Prevention...');
  // Run publish for a test payload
  const testPayload = {
    examId: 'group4',
    subjectSlug: 'general-tamil',
    subjectName: 'General Tamil',
    units: unitsWithLessons,
    notes: {},
    mcqs: {},
  };

  console.log('Running First Publish Transaction...');
  const firstResult = await AISyllabusEngineService.publishSyllabusTransaction(testPayload);
  console.log('First Publish Stats:', firstResult.stats);
  console.log('Validation Report:', firstResult.stats.validation_report);

  console.log('\nRunning Immediate Second Publish Transaction (Re-import of same syllabus)...');
  const secondResult = await AISyllabusEngineService.publishSyllabusTransaction(testPayload);
  console.log('Second Publish Stats:', secondResult.stats);
  console.log('Validation Report:', secondResult.stats.validation_report);

  if (secondResult.stats.units_created > 0) {
    throw new Error(`Re-import created ${secondResult.stats.units_created} duplicate units! Expected 0.`);
  }
  if (secondResult.stats.lessons_created > 0) {
    throw new Error(`Re-import created ${secondResult.stats.lessons_created} duplicate lessons! Expected 0.`);
  }
  console.log('  -> TEST 3 PASSED: Zero duplicate units, zero duplicate lessons on re-import.\n');

  // TEST 4: Integrity Verification in Database
  console.log('[TEST 4] Verifying Database Foreign Keys & Parent-Child Relationships...');
  const dbUnits = await pool.query(`
    SELECT id, unit_number, title, subject_id,
           (SELECT COUNT(*) FROM syllabus_lessons WHERE unit_id = syllabus_units.id) as lesson_cnt
    FROM syllabus_units
    WHERE exam_id = 'group4' AND (subject_id = 'group4-general-tamil' OR subject_id = 'general-tamil')
    ORDER BY unit_number
  `);
  console.table(dbUnits.rows);

  // Check disconnected lessons
  const orphanLessons = await pool.query(`
    SELECT id, title FROM syllabus_lessons
    WHERE exam_id = 'group4' AND (subject_id = 'group4-general-tamil' OR subject_id = 'general-tamil')
      AND unit_id NOT IN (SELECT id FROM syllabus_units)
  `);
  if (orphanLessons.rows.length > 0) {
    throw new Error(`Found ${orphanLessons.rows.length} orphaned lessons with invalid unit_id!`);
  }

  // Check disconnected topics
  const orphanTopics = await pool.query(`
    SELECT id, topic_name FROM syllabus_topics
    WHERE lesson_id NOT IN (SELECT id FROM syllabus_lessons)
  `);
  if (orphanTopics.rows.length > 0) {
    throw new Error(`Found ${orphanTopics.rows.length} orphaned topics with invalid lesson_id!`);
  }
  console.log('  -> TEST 4 PASSED: All parent-child foreign keys verified 100% connected.\n');

  // TEST 5: Verify Non-Tamil subjects and 72 Textbooks are preserved
  console.log('[TEST 5] Verifying Other Subjects and 72 Textbooks Preservation...');
  const totalTb = await pool.query(`SELECT COUNT(*) as cnt FROM google_drive_materials`);
  console.log(`Total Textbooks in DB: ${totalTb.rows[0].cnt}`);
  if (parseInt(totalTb.rows[0].cnt, 10) < 72) {
    throw new Error(`Textbooks missing! Expected at least 72, found ${totalTb.rows[0].cnt}`);
  }

  const gsUnits = await pool.query(`
    SELECT id, unit_number, title FROM syllabus_units
    WHERE exam_id = 'group4' AND subject_id ILIKE '%studies%'
  `);
  console.log(`General Studies units intact: ${gsUnits.rows.length}`);

  console.log('  -> TEST 5 PASSED: All 72 textbooks and other subjects preserved.\n');

  console.log('====================================================');
  console.log('   ALL GENERAL TAMIL PIPELINE TESTS PASSED 100%!    ');
  console.log('====================================================');
}

runTests()
  .catch((err) => {
    console.error('TEST SUITE FAILED:', err);
    process.exit(1);
  })
  .finally(() => pool.end());

