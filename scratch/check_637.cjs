const pool = require('../backend/dist/db').default || require('../backend/dist/db');
async function run() {
  const r = await pool.query('SELECT page_number, unit_id, unit_title, lesson_title, topic, text_length, is_ocr, extraction_method, extraction_status FROM textbook_content WHERE textbook_id = 637 ORDER BY page_number LIMIT 10');
  console.log('Textbook 637 pages:', JSON.stringify(r.rows, null, 2));
  await pool.end();
}
run().catch(console.error);

