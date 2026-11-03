const pool = require('../backend/dist/db').default || require('../backend/dist/db');
async function run() {
  // Check classification_meta on a few rows
  const r1 = await pool.query(`
    SELECT id, file_name, standard, 
           classification_meta IS NOT NULL AS has_meta,
           extracted_toc IS NOT NULL AS has_toc,
           extraction_status,
           completion_percentage
    FROM google_drive_materials
    ORDER BY id
    LIMIT 15
  `);
  console.log('Drive materials meta status:', JSON.stringify(r1.rows, null, 2));
  
  // Check standards coverage
  const r2 = await pool.query(`
    SELECT standard, subject, COUNT(*) as cnt
    FROM google_drive_materials
    GROUP BY standard, subject
    ORDER BY standard, subject
  `);
  console.log('Drive coverage by std/subject:', JSON.stringify(r2.rows, null, 2));
  
  await pool.end(); process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
