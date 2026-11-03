const path = require('path');
const fs = require('fs');
process.chdir(__dirname);
const { ensureDatabaseSchema } = require('./dist/migrate');
const pool = require('./dist/db').default;
const svc = require('./dist/services/pdfExtractionService');

(async () => {
  await ensureDatabaseSchema();
  const file = path.resolve(__dirname, process.argv[2] || 'uploads/textbooks/_scanned_en.pdf');
  const medium = process.argv[3] || 'English';
  await pool.query(`DELETE FROM textbooks WHERE book_name='__extract_test_scan__'`);
  const ins = await pool.query(
    `INSERT INTO textbooks (group_id, standard, subject, medium, term, book_name, file_path, file_size, status)
     VALUES ('group1', 6, 'General Studies', $1, 'Full Year', '__extract_test_scan__', $2, $3, 'uploaded') RETURNING id`,
    [medium, file, fs.statSync(file).size]
  );
  const id = ins.rows[0].id;
  let res = await svc.processAutomaticPdfExtraction({ textbookId: id, pageLimit: 3, maxDurationMs: 240000 });
  console.log('result', JSON.stringify(res));
  const pages = await pool.query(
    `SELECT page_number, length(content) len, is_ocr, extraction_method, extraction_status, left(content, 160) s, extraction_error
     FROM textbook_content WHERE textbook_id=$1 ORDER BY page_number`,
    [id]
  );
  console.log(pages.rows);
  const job = await pool.query(`SELECT extraction_status, total_pages, extracted_pages, failed_pages, pdf_type FROM pdf_extractions WHERE textbook_id=$1 ORDER BY id DESC LIMIT 1`, [id]);
  console.log('job', job.rows[0]);
  await pool.end();
})().catch(async (e) => { console.error('TEST FAILED', e); try { await pool.end(); } catch {} process.exit(1); });
