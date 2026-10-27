const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'tnpsc_study_hub',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Beginning database seeding for TNPSC Group 2 General English...');
    await client.query('BEGIN');

    const insertQuery = `
      INSERT INTO questions (
        category, unit_id, class_id, subject, lesson_title, topic,
        difficulty, tag, question_text, options, correct_answer,
        explanation, source_reference, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (lesson_title, question_text)
      DO UPDATE SET
        category = EXCLUDED.category,
        unit_id = EXCLUDED.unit_id,
        class_id = EXCLUDED.class_id,
        subject = EXCLUDED.subject,
        options = EXCLUDED.options,
        correct_answer = EXCLUDED.correct_answer,
        explanation = EXCLUDED.explanation,
        status = 'published',
        updated_at = CURRENT_TIMESTAMP;
    `;

    let insertedCount = 0;

    // Purge previous General English records to guarantee 0 Tamil words
    await client.query("DELETE FROM questions WHERE category = 'group2' AND subject = 'General English'");
    console.log("Cleared old General English questions.");

    // 1. Seed from group2EnglishData.ts
    const englishDataPath = path.join(__dirname, '../../../src/data/group2EnglishData.ts');
    if (fs.existsSync(englishDataPath)) {
      const content = fs.readFileSync(englishDataPath, 'utf8');
      const startIdx = content.indexOf('export const group2EnglishRegistry');
      if (startIdx !== -1) {
        const jsonStart = content.indexOf('{', startIdx);
        const jsonEnd = content.lastIndexOf('}');
        const jsonStr = content.substring(jsonStart, jsonEnd + 1);
        const registry = JSON.parse(jsonStr);

        for (const [key, unitClass] of Object.entries(registry)) {
          const { unitId, classId, classTitle, unitNumber, lessons } = unitClass;

          for (const lesson of lessons || []) {
            if (!lesson.practiceMCQs || lesson.practiceMCQs.length === 0) continue;

            for (const mcq of lesson.practiceMCQs) {
              await client.query(insertQuery, [
                'group2',
                unitId,
                classId,
                'General English',
                lesson.title,
                lesson.title,
                'Medium',
                `Group 2 • ${unitNumber} • ${classTitle}`,
                mcq.question,
                JSON.stringify(mcq.options),
                mcq.correctAnswer,
                mcq.explanation,
                `Samacheer Kalvi English Textbook - ${classTitle}`,
                'published'
              ]);
              insertedCount++;
            }
          }
        }
      }
    }

    // 2. Seed from generalEnglishComprehensiveData.ts
    const compDataPath = path.join(__dirname, '../../../src/data/generalEnglishComprehensiveData.ts');
    if (fs.existsSync(compDataPath)) {
      const compContent = fs.readFileSync(compDataPath, 'utf8');
      const startIdx = compContent.indexOf('export const group2GeneralEnglishUnits');
      if (startIdx !== -1) {
        const eqIdx = compContent.indexOf('=', startIdx);
        const jsonStart = compContent.indexOf('[', eqIdx);
        const jsonEnd = compContent.lastIndexOf(']');
        const jsonStr = compContent.substring(jsonStart, jsonEnd + 1);
        const units = JSON.parse(jsonStr);

        for (const unit of units) {
          const { id: unitId, unitNumber, chapters } = unit;

          for (const chapter of chapters || []) {
            for (const lesson of chapter.lessons || []) {
              if (!lesson.practiceQuestions || lesson.practiceQuestions.length === 0) continue;

              for (const mcq of lesson.practiceQuestions) {
                await client.query(insertQuery, [
                  'group2',
                  unitId,
                  10, // SSLC Standard
                  'General English',
                  lesson.title,
                  chapter.title,
                  'Medium',
                  `Group 2 • ${unitNumber} • ${chapter.title}`,
                  mcq.question,
                  JSON.stringify(mcq.options),
                  mcq.correctAnswer,
                  mcq.explanation,
                  `TNPSC Group 2/2A General English Syllabus - ${unitNumber}`,
                  'published'
                ]);
                insertedCount++;
              }
            }
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log(`Successfully seeded ${insertedCount} General English questions into the database!`);

    // Verify questions in DB
    const res = await client.query(`
      SELECT category, subject, unit_id, count(*) as count
      FROM questions 
      WHERE category = 'group2' AND subject = 'General English'
      GROUP BY category, subject, unit_id
      ORDER BY unit_id;
    `);

    console.log('\nDatabase Verification for Group 2 General English:');
    console.table(res.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
