const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('../../dist/db.js').default;

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Beginning database seeding for TNPSC Group 2 General Tamil...');
    await client.query('BEGIN');

    // Read group2TamilData.ts
    const dataPath = path.join(__dirname, '../../../src/data/group2TamilData.ts');
    const content = fs.readFileSync(dataPath, 'utf8');

    // Extract the JSON object from group2TamilRegistry = { ... }
    const startIdx = content.indexOf('export const group2TamilRegistry: Record<string, Group2UnitClassData> = {');
    if (startIdx === -1) {
      throw new Error('Could not find group2TamilRegistry in file');
    }
    const jsonStart = content.indexOf('{', startIdx);
    const jsonEnd = content.lastIndexOf('};');
    const jsonStr = content.substring(jsonStart, jsonEnd + 1);

    // Evaluate JSON
    let registry;
    try {
      registry = eval(`(${jsonStr})`);
    } catch (e) {
      console.error('Failed to eval registry:', e.message);
      throw e;
    }

    console.log(`Loaded ${Object.keys(registry).length} registry keys from group2TamilData.ts`);

    let insertedCount = 0;
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

    // 1. Seed school textbook lessons for all 49 keys
    for (const [key, unitClass] of Object.entries(registry)) {
      const { unitId, classId, classTitle, unitNumber, lessons } = unitClass;

      for (const lesson of lessons || []) {
        if (!lesson.practiceMCQs || lesson.practiceMCQs.length === 0) continue;

        for (const mcq of lesson.practiceMCQs) {
          await client.query(insertQuery, [
            'group2',
            unitId,
            classId,
            'General Tamil',
            lesson.title,
            lesson.title,
            'Medium',
            `Group 2 • ${unitNumber} • ${classTitle}`,
            mcq.question,
            JSON.stringify(mcq.options),
            mcq.correctAnswer,
            mcq.explanation,
            `Samacheer Kalvi Tamil Textbook - ${classTitle}`,
            'published'
          ]);
          insertedCount++;
        }
      }
    }

    await client.query('COMMIT');
    console.log(`Successfully seeded ${insertedCount} General Tamil questions into the database!`);

    // Verify questions by category and subject
    const res = await client.query(`
      SELECT category, subject, unit_id, count(*) as count
      FROM questions 
      WHERE category = 'group2' AND subject = 'General Tamil'
      GROUP BY category, subject, unit_id
      ORDER BY unit_id;
    `);

    console.log('\nDatabase Verification for Group 2 General Tamil:');
    console.table(res.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
