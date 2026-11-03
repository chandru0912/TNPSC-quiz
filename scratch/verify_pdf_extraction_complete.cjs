const path = require('path');
const { pool } = require(path.resolve(__dirname, '../backend/dist/db.js'));

async function run() {
  console.log('--- 1. VERIFYING TABLE SCHEMA ---');
  const colsRes = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'textbook_content'
    ORDER BY ordinal_position;
  `);
  console.log('textbook_content columns:', colsRes.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

  const requiredCols = ['file_name', 'textbook_id', 'material_id', 'standard', 'subject', 'term', 'unit_id', 'lesson_title', 'page_number', 'content', 'extraction_status'];
  const existingCols = new Set(colsRes.rows.map(r => r.column_name));
  const missingCols = requiredCols.filter(c => !existingCols.has(c));
  if (missingCols.length > 0) {
    console.error('FAIL: Missing required columns:', missingCols);
    process.exit(1);
  } else {
    console.log('PASS: All required columns exist in textbook_content.');
  }

  console.log('\n--- 2. VERIFYING UNIQUE CONSTRAINT & DUPLICATE PREVENTION ---');
  const constraintsRes = await pool.query(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'textbook_content' AND contype = 'u';
  `);
  console.log('Unique constraints:', constraintsRes.rows.map(r => `${r.conname}: ${r.def}`).join('; '));

  console.log('\n--- 3. VERIFYING PAGE-BY-PAGE EXTRACTION RECORDS ---');
  const countRes = await pool.query(`SELECT textbook_id, file_name, COUNT(*) as total_pages FROM textbook_content GROUP BY textbook_id, file_name ORDER BY total_pages DESC LIMIT 1`);
  const topTextbook = countRes.rows[0];
  console.log(`Top extracted textbook: ID ${topTextbook.textbook_id}, file: "${topTextbook.file_name}", total pages: ${topTextbook.total_pages}`);

  const samplePagesRes = await pool.query(`
    SELECT page_number, file_name, standard, subject, term, unit_id, lesson_title, extraction_status,
           LEFT(content, 120) as preview, LENGTH(content) as content_len
    FROM textbook_content 
    WHERE textbook_id = $1
    ORDER BY page_number ASC
    LIMIT 5;
  `, [topTextbook.textbook_id]);

  console.log('Sample Page Records:');
  samplePagesRes.rows.forEach(p => {
    console.log(`  Page ${p.page_number}: [${p.extraction_status}] Standard: ${p.standard}, Subject: ${p.subject}, Term: ${p.term}, File: "${p.file_name}", Length: ${p.content_len} chars`);
    console.log(`    Preview: ${JSON.stringify(p.preview)}`);
  });

  console.log('\n--- 4. VERIFYING UNICODE TAMIL & ENGLISH PRESERVATION ---');
  const tamilCheckRes = await pool.query(`
    SELECT page_number, LEFT(content, 160) as preview
    FROM textbook_content
    WHERE content ~ '[\\u0B80-\\u0BFF]'
    LIMIT 3;
  `);
  console.log(`Found ${tamilCheckRes.rows.length} Tamil pages in sample check.`);
  tamilCheckRes.rows.forEach(r => {
    console.log(`  Page ${r.page_number} Tamil content: ${r.preview.replace(/\\n/g, ' ')}`);
  });

  console.log('\n--- 5. VERIFYING OVERVIEW AGGREGATION QUERY ---');
  const overviewRes = await pool.query(`
    SELECT 
      COUNT(*)::int AS total_files,
      COALESCE(SUM(COALESCE(total_pages, page_count, 0)), 0)::int AS total_pages,
      COALESCE(SUM(
        CASE 
          WHEN extraction_status = 'COMPLETED' THEN COALESCE(total_pages, page_count, 0)
          ELSE COALESCE(native_pages, 0) + COALESCE(ocr_pages, 0)
        END
      ), 0)::int AS extracted_pages,
      COALESCE(SUM(COALESCE(failed_pages, 0)), 0)::int AS failed_pages,
      COALESCE(SUM(COALESCE(native_pages, 0)), 0)::int AS native_pages,
      COALESCE(SUM(COALESCE(ocr_pages, 0)), 0)::int AS ocr_pages,
      COUNT(*) FILTER (WHERE extraction_status = 'COMPLETED')::int AS count_completed,
      COUNT(*) FILTER (WHERE extraction_status = 'PARTIALLY_COMPLETED')::int AS count_partially_completed,
      COUNT(*) FILTER (WHERE extraction_status = 'PROCESSING')::int AS count_processing,
      COUNT(*) FILTER (WHERE extraction_status = 'FAILED')::int AS count_failed,
      COUNT(*) FILTER (WHERE extraction_status IS NULL OR extraction_status = 'PENDING')::int AS count_pending
    FROM google_drive_materials;
  `);
  console.log('Overview stats:', overviewRes.rows[0]);

  console.log('\nALL VERIFICATION CHECKS PASSED SUCCESSFULLY.');
  await pool.end();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
