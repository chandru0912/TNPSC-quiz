const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('../../dist/db.js').default;

async function seedComprehensive() {
  const client = await pool.connect();
  try {
    console.log('Seeding comprehensive syllabus unit questions...');
    await client.query('BEGIN');

    const compPath = path.join(__dirname, '../../../src/data/generalTamilComprehensiveData.ts');
    const content = fs.readFileSync(compPath, 'utf8');
    const lines = content.split('\n');
    const g2Lines = lines.slice(8, 1951);
    const jsonStr = '[' + g2Lines.join('\n');
    const units = eval(`(${jsonStr})`);

    console.log(`Parsed ${units.length} units from generalTamilComprehensiveData.ts`);

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
        subject = EXCLUDED.subject,
        options = EXCLUDED.options,
        correct_answer = EXCLUDED.correct_answer,
        explanation = EXCLUDED.explanation,
        status = 'published',
        updated_at = CURRENT_TIMESTAMP;
    `;

    let count = 0;
    for (const unit of units) {
      for (const chapter of unit.chapters || []) {
        for (const lesson of chapter.lessons || []) {
          for (const q of lesson.practiceQuestions || []) {
            await client.query(insertQuery, [
              'group2',
              unit.id,
              10, // SSLC Standard
              'General Tamil',
              lesson.title,
              chapter.title,
              'Medium',
              `Group 2 • ${unit.unitNumber}: ${unit.title}`,
              q.question,
              JSON.stringify(q.options),
              q.correctAnswer,
              q.explanation,
              `TNPSC Group 2 General Tamil Syllabus (Code: 495) - ${unit.unitNumber}`,
              'published'
            ]);
            count++;
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log(`Successfully added ${count} syllabus lesson questions into database!`);

    const summary = await client.query(`
      SELECT unit_id, count(*) as count 
      FROM questions 
      WHERE category = 'group2' AND subject = 'General Tamil'
      GROUP BY unit_id 
      ORDER BY unit_id;
    `);
    console.table(summary.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedComprehensive();
