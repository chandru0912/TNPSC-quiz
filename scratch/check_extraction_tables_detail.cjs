const pool = require('../backend/dist/db').default || require('../backend/dist/db');
async function run() {
  const r = await pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('pdf_extractions', 'textbook_content', 'textbook_processing_jobs') 
    ORDER BY table_name, ordinal_position;
  `);
  console.log(JSON.stringify(r.rows, null, 2));
  await pool.end();
}
run().catch(console.error);

