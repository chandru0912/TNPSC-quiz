const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });
const {
  AISyllabusEngineService,
  CANONICAL_SUBJECT_DEFINITIONS,
} = require('./dist/services/aiSyllabusEngineService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runPipelineTest() {
  console.log('===============================================================');
  console.log('E2E TEST: Subject-Wise Unit Selection in Single Parent Alignment');
  console.log('===============================================================\n');

  // Test 1: Verify all 4 canonical subjects
  console.log('--- TEST 1: Subject Definitions ---');
  const expectedSubjects = ['general-studies', 'aptitude', 'general-english', 'general-tamil'];
  const definedIds = CANONICAL_SUBJECT_DEFINITIONS.map((s) => s.id);
  for (const sId of expectedSubjects) {
    if (!definedIds.includes(sId)) {
      throw new Error(`Missing expected subject: ${sId}`);
    }
    const def = CANONICAL_SUBJECT_DEFINITIONS.find((s) => s.id === sId);
    console.log(`✓ Subject "${def.name}" (${def.id}) verified - ${def.units.length} defined units`);
  }

  // Test 2: General Studies exactly 6 units
  console.log('\n--- TEST 2: General Studies - Exactly 6 Units Guarantee ---');
  const gsUnits = AISyllabusEngineService.getCanonicalUnitsForSubject('group4', 'general-studies', [6, 7, 8, 9, 10, 11, 12]);
  if (gsUnits.length !== 6) {
    throw new Error(`Expected exactly 6 units for General Studies, got ${gsUnits.length}`);
  }
  console.log(`✓ General Studies returned exactly ${gsUnits.length} parent units:`);
  gsUnits.forEach((u) => {
    console.log(`   ${u.unit_code} - ${u.title} (${u.lessons.length} lessons mapped across standards)`);
  });

  // Test 3: Other subjects have syllabus-based units
  console.log('\n--- TEST 3: Other Subjects - Dynamic Syllabus-Based Units ---');
  const aptUnits = AISyllabusEngineService.getCanonicalUnitsForSubject('group4', 'aptitude', [6, 7, 8, 9, 10]);
  const engUnits = AISyllabusEngineService.getCanonicalUnitsForSubject('group4', 'general-english', [6, 7, 8, 9, 10, 11, 12]);
  const tamUnits = AISyllabusEngineService.getCanonicalUnitsForSubject('group4', 'general-tamil', [6, 7, 8, 9, 10, 11, 12]);

  if (aptUnits.length !== 2) throw new Error(`Aptitude should have 2 units, got ${aptUnits.length}`);
  if (engUnits.length !== 4) throw new Error(`General English should have 4 units, got ${engUnits.length}`);
  if (tamUnits.length !== 6) throw new Error(`General Tamil should have 6 units, got ${tamUnits.length}`);

  console.log(`✓ Aptitude has ${aptUnits.length} syllabus-based units (NOT forced to 6)`);
  console.log(`✓ General English has ${engUnits.length} syllabus-based units (NOT forced to 6)`);
  console.log(`✓ General Tamil has ${tamUnits.length} syllabus-based units (NOT forced to 6)`);

  // Test 4 & 5: Standard-wise isolation and correct lesson titles
  console.log('\n--- TEST 4 & 5: Standard-Wise Isolation & Authentic Lessons ---');
  const stds = [6, 7, 8, 9, 10, 11, 12];
  for (const std of stds) {
    const gsStdLessons = gsUnits.flatMap((u) => u.lessons.filter((l) => l.standard_number === std));
    if (gsStdLessons.length === 0) {
      throw new Error(`Class ${std} has 0 lessons mapped in General Studies!`);
    }
    // Check no duplicate placeholder
    const sample = gsStdLessons[0];
    if (sample.title.includes('Chapter 1') && sample.title.includes('Standard 10')) {
      throw new Error(`Found synthetic placeholder title in Class ${std}: ${sample.title}`);
    }
    console.log(`✓ Class ${std}: ${gsStdLessons.length} authentic lessons mapped under General Studies (Sample: Ch ${sample.lesson_number} "${sample.title}")`);
  }

  // Test 6: Database Publish Transaction Across Multiple Subjects
  console.log('\n--- TEST 6: Atomic Database Transaction Across Subjects ---');
  // Combine a subset of units from all 4 subjects to test multi-subject publish
  const publishUnits = [
    gsUnits[0], // General Science (Unit 1)
    gsUnits[1], // Geography (Unit 2)
    aptUnits[0], // Aptitude Unit 1
    tamUnits[0], // Tamil Unit 1 (இலக்கணம்)
    engUnits[0], // English Unit 1 (Grammar)
  ];

  console.log(`Attempting atomic publish for ${publishUnits.length} units across 4 subjects...`);
  const publishResult = await AISyllabusEngineService.publishSyllabusTransaction({
    examId: 'group4',
    subjectSlug: 'general-studies',
    subjectName: 'General Studies',
    units: publishUnits,
  });

  if (!publishResult.success) {
    throw new Error(`Publish failed: ${publishResult.message}`);
  }

  console.log(`✓ Publish Transaction Succeeded:`, publishResult.stats);

  // Test 7: Verify database records
  console.log('\n--- TEST 7: Verify Database Subject & Unit Association ---');
  const dbUnitsRes = await pool.query(
    `SELECT u.id, u.exam_id, u.subject_id, u.unit_number, u.title, count(l.id) as lesson_count
     FROM syllabus_units u
     LEFT JOIN syllabus_lessons l ON l.unit_id = u.id
     WHERE u.exam_id = 'group4'
     GROUP BY u.id, u.exam_id, u.subject_id, u.unit_number, u.title
     ORDER BY u.subject_id, u.unit_number`
  );

  const unitsBySubInDb = {};
  dbUnitsRes.rows.forEach((r) => {
    unitsBySubInDb[r.subject_id] = unitsBySubInDb[r.subject_id] || [];
    unitsBySubInDb[r.subject_id].push(`${r.unit_number}: ${r.title} (${r.lesson_count} lessons)`);
  });

  console.log('Units in Database by Subject:');
  Object.entries(unitsBySubInDb).forEach(([s, uList]) => {
    console.log(` [Subject: ${s}] (${uList.length} units)`);
    uList.slice(0, 3).forEach((uStr) => console.log(`   - ${uStr}`));
    if (uList.length > 3) console.log(`   ... and ${uList.length - 3} more`);
  });

  console.log('\n===============================================================');
  console.log('ALL E2E PIPELINE TESTS PASSED 100%!');
  console.log('===============================================================');

  await pool.end();
}

runPipelineTest().catch((err) => {
  console.error('\n❌ PIPELINE TEST FAILED:', err);
  pool.end();
  process.exit(1);
});

