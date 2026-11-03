const pool = require('../backend/dist/db').default || require('../backend/dist/db');
async function run() {
  // Sample from google_drive_materials (which has 100 rows)
  const r1 = await pool.query(`
    SELECT id, file_name, subject, standard, term, unit, lesson, lesson_id, medium, tnpsc_group, applicable_groups
    FROM google_drive_materials 
    ORDER BY standard, unit
    LIMIT 30
  `);
  console.log('google_drive_materials sample:', JSON.stringify(r1.rows, null, 2));
  
  // Check extracted_toc structure for one record
  const r2 = await pool.query(`
    SELECT id, file_name, standard, subject,
           classification_meta->'units' AS units_meta,
           jsonb_array_length(COALESCE(extracted_toc, '[]'::jsonb)) AS toc_length
    FROM google_drive_materials 
    WHERE extracted_toc IS NOT NULL AND jsonb_array_length(extracted_toc) > 0
    LIMIT 5
  `);
  console.log('Drive materials with TOC:', JSON.stringify(r2.rows, null, 2));
  
  await pool.end(); process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
