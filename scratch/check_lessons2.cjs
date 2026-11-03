const pool = require('../backend/dist/db').default || require('../backend/dist/db');
async function run() {
  // Check what class_ids exist in questions
  const r0 = await pool.query("SELECT DISTINCT class_id, COUNT(*) as cnt FROM questions GROUP BY class_id ORDER BY class_id LIMIT 10");
  console.log('Questions class_ids:', JSON.stringify(r0.rows, null, 2));
  
  // Check what class_ids exist in study_notes
  const r0b = await pool.query("SELECT DISTINCT class_id, COUNT(*) as cnt FROM study_notes GROUP BY class_id ORDER BY class_id LIMIT 10");
  console.log('Study_notes class_ids:', JSON.stringify(r0b.rows, null, 2));
  
  // Sample from any class
  const r1 = await pool.query("SELECT DISTINCT lesson_title, lesson_number, unit_id, subject, class_id FROM questions ORDER BY class_id, unit_id, lesson_number LIMIT 20");
  console.log('Questions lessons sample:', JSON.stringify(r1.rows, null, 2));
  
  const r2 = await pool.query("SELECT lesson_title, lesson_number, lesson_id, unit_id, subject, class_id FROM study_notes ORDER BY class_id, unit_id, lesson_number LIMIT 20");
  console.log('Study notes lessons sample:', JSON.stringify(r2.rows, null, 2));
  
  await pool.end(); process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
