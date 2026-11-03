const pool = require('../backend/dist/db').default || require('../backend/dist/db');
async function run() {
  const r1 = await pool.query("SELECT DISTINCT lesson_title, lesson_number, unit_id, subject FROM questions WHERE class_id = 6 ORDER BY unit_id, lesson_number LIMIT 30");
  console.log('Questions lessons:', JSON.stringify(r1.rows, null, 2));
  const r2 = await pool.query("SELECT lesson_title, lesson_number, lesson_id, unit_id, subject FROM study_notes WHERE class_id = 6 ORDER BY unit_id, lesson_number LIMIT 30");
  console.log('Study notes lessons:', JSON.stringify(r2.rows, null, 2));
  await pool.end(); process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
