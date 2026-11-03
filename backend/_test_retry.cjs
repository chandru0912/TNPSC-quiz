const path = require('path');
process.chdir(__dirname);
const { ensureDatabaseSchema } = require('./dist/migrate');
const pool = require('./dist/db').default;
const svc = require('./dist/services/pdfExtractionService');

(async () => {
  await ensureDatabaseSchema();
  const id = Number(process.argv[2]);
  if (!id) throw new Error('pass textbook id');

  // Force page 1 into failed state to simulate a transient OCR/native failure.
  await pool.query(
    `UPDATE textbook_content SET extraction_status='failed', extraction_error='simulated failure', content=''
     WHERE textbook_id=$1 AND page_number=1`,
    [id]
  );
  await pool.query(
    `UPDATE pdf_extractions SET extraction_status='PARTIALLY_COMPLETED', next_page=3, failed_pages=1, extracted_pages=1,
       native_pages=0, ocr_pages=1, extracted_at=CURRENT_TIMESTAMP
     WHERE textbook_id=$1`,
    [id]
  );
  const before = await pool.query(
    `SELECT page_number, extraction_status FROM textbook_content WHERE textbook_id=$1 ORDER BY page_number`, [id]
  );
  console.log('before', before.rows);

  const res = await svc.processAutomaticPdfExtraction({ textbookId: id, retryOnlyFailed: true, maxDurationMs: 240000 });
  console.log('retry result', JSON.stringify(res));

  const after = await pool.query(
    `SELECT page_number, extraction_status, is_ocr, left(content,60) s FROM textbook_content WHERE textbook_id=$1 ORDER BY page_number`, [id]
  );
  console.log('after', after.rows);
  const job = await pool.query(
    `SELECT extraction_status, total_pages, extracted_pages, failed_pages, native_pages, ocr_pages, next_page FROM pdf_extractions WHERE textbook_id=$1 ORDER BY id DESC LIMIT 1`, [id]
  );
  console.log('job', job.rows[0]);

  const ok = after.rows.length === 2 && after.rows.every(r => r.extraction_status === 'completed') && job.rows[0].extraction_status === 'COMPLETED';
  console.log(ok ? 'RETRY TEST PASSED' : 'RETRY TEST FAILED');
  await pool.end();
  process.exit(ok ? 0 : 1);
})().catch(async (e) => { console.error('TEST FAILED', e); try { await pool.end(); } catch {} process.exit(1); });
