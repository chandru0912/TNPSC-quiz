const path = require('path');
const fs = require('fs');
process.chdir(__dirname);
const { ensureDatabaseSchema } = require('./dist/migrate');
const pool = require('./dist/db').default;
const svc = require('./dist/services/pdfExtractionService');

async function seed(filePath, name, medium = 'English', standard = 6, subject = 'General Studies') {
  await pool.query(`DELETE FROM textbooks WHERE book_name = $1`, [name]);
  const res = await pool.query(
    `INSERT INTO textbooks (group_id, standard, subject, medium, term, book_name, file_path, file_size, status)
     VALUES ('group1', $1, $2, $3, 'Full Year', $4, $5, $6, 'uploaded') RETURNING id`,
    [standard, subject, medium, name, filePath, fs.statSync(filePath).size]
  );
  return res.rows[0].id;
}

async function report(label, id) {
  const tb = await pool.query(`SELECT page_count, total_pages, native_pages, ocr_pages, failed_pages, extraction_status, status, pdf_type FROM textbooks WHERE id=$1`, [id]);
  const content = await pool.query(
    `SELECT COUNT(*)::int AS rows,
            COUNT(*) FILTER (WHERE extraction_status='completed')::int AS completed,
            COUNT(*) FILTER (WHERE extraction_status='failed')::int AS failed,
            MIN(page_number)::int AS min_page, MAX(page_number)::int AS max_page
     FROM textbook_content WHERE textbook_id=$1`,
    [id]
  );
  const job = await pool.query(`SELECT extraction_status, total_pages, next_page, extracted_pages, failed_pages, pdf_type FROM pdf_extractions WHERE textbook_id=$1 ORDER BY id DESC LIMIT 1`, [id]);
  console.log(label, JSON.stringify({ tb: tb.rows[0], content: content.rows[0], job: job.rows[0] }, null, 2));
}

(async () => {
  await ensureDatabaseSchema();
  console.log('schema ready');

  const enPath = path.resolve(__dirname, '..', '497_group 1 preliminary syllabus.pdf');
  const enId = await seed(enPath, '__extract_test_en__');
  console.log('English textbook id', enId);

  // Bounded first pass: only 2 pages must be persisted.
  let res = await svc.processAutomaticPdfExtraction({ textbookId: enId, pageLimit: 2, maxDurationMs: 60000 });
  console.log('pass1', JSON.stringify(res));
  await report('after pass1', enId);
  if (!res.inProgress || res.extractedPagesCount !== 2) throw new Error('bounded pass1 failed');

  // Resume repeatedly.
  let rounds = 1;
  while (res.inProgress && rounds < 20) {
    res = await svc.processAutomaticPdfExtraction({ textbookId: enId, pageLimit: 2, maxDurationMs: 60000 });
    rounds++;
    console.log('pass' + rounds, JSON.stringify(res));
  }
  await report('after resume', enId);
  if (res.inProgress) throw new Error('did not finish resuming');
  if (res.status !== 'COMPLETED') throw new Error('expected COMPLETED, got ' + res.status);
  if (res.totalPages !== 4) throw new Error('expected 4 pages, got ' + res.totalPages);

  const pages = await pool.query(`SELECT page_number, content, extraction_method, extraction_status FROM textbook_content WHERE textbook_id=$1 ORDER BY page_number`, [enId]);
  if (pages.rows.length !== 4) throw new Error('expected 4 page rows');
  for (let i = 0; i < pages.rows.length; i++) {
    if (Number(pages.rows[i].page_number) !== i + 1) throw new Error('page order broken');
  }
  if ((pages.rows[0].content.match(/[A-Za-z]/g) || []).length < 100) throw new Error('English text missing');
  console.log('English sample:', pages.rows[0].content.slice(0, 120).replace(/\s+/g, ' '));

  // Idempotency: re-running must not duplicate rows.
  const before = (await pool.query(`SELECT COUNT(*)::int AS c FROM textbook_content WHERE textbook_id=$1`, [enId])).rows[0].c;
  res = await svc.processAutomaticPdfExtraction({ textbookId: enId, pageLimit: 10, maxDurationMs: 60000 });
  const after = (await pool.query(`SELECT COUNT(*)::int AS c FROM textbook_content WHERE textbook_id=$1`, [enId])).rows[0].c;
  if (before !== after) throw new Error(`duplicate rows created: ${before} -> ${after}`);
  console.log('idempotent reprocess ok, rows', after);

  // Invalid PDF must fail honestly.
  const badPath = path.resolve(__dirname, 'uploads/textbooks/tb_1793421200562_11th_Physics_Vol1_test.pdf');
  const badId = await seed(badPath, '__extract_test_bad__');
  const badRes = await svc.processAutomaticPdfExtraction({ textbookId: badId, pageLimit: 10, maxDurationMs: 30000 });
  console.log('invalid pdf result', JSON.stringify(badRes));
  if (badRes.status !== 'FAILED') throw new Error('invalid PDF should be FAILED');

  console.log('ENGLISH/IDEMPOTENCY/INVALID TESTS PASSED');
  await pool.end();
})().catch(async (err) => {
  console.error('TEST FAILED:', err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
