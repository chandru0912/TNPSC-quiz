const pool = require('../backend/dist/db').default || require('../backend/dist/db');
async function run() {
  const c1 = await pool.query('SELECT COUNT(*) FROM textbook_content');
  const c2 = await pool.query('SELECT COUNT(*) FROM pdf_extractions');
  const c3 = await pool.query("SELECT COUNT(*) FROM google_drive_materials WHERE extraction_status = 'COMPLETED'");
  console.log('textbook_content rows:', c1.rows[0].count);
  console.log('pdf_extractions rows:', c2.rows[0].count);
  console.log('google_drive_materials COMPLETED:', c3.rows[0].count);

  if (parseInt(c1.rows[0].count) > 0) {
    const s1 = await pool.query('SELECT * FROM textbook_content LIMIT 2');
    console.log('textbook_content sample:', s1.rows);
  }
  if (parseInt(c2.rows[0].count) > 0) {
    const s2 = await pool.query('SELECT id, material_id, textbook_id, file_name, extraction_status, total_pages, extracted_pages FROM pdf_extractions LIMIT 5');
    console.log('pdf_extractions sample:', s2.rows);
  }
  await pool.end();
}
run().catch(console.error);

