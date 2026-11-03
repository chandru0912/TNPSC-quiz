// Large native PDF: bounded slices must persist a cursor and resume to completion without duplicates.
const path = require('path');
const fs = require('fs');
process.chdir(__dirname);
const pool = require('./dist/db').default;
const svc = require('./dist/services/pdfExtractionService');

(async () => {
  const file = path.resolve(__dirname, 'uploads/textbooks/tb_1793355086470_Class_6_Tamil_Tamil_Tamil_-_Term_1_-_2025_Edition-www.tntextbooks.in__1_.pdf');
  await pool.query(`DELETE FROM textbooks WHERE book_name='__extract_test_large__'`);
  const ins = await pool.query(
    `INSERT INTO textbooks (group_id, standard, subject, medium, term, book_name, file_path, file_size, status)
     VALUES ('group4', 6, 'Tamil', 'Tamil', 'Term 1', '__extract_test_large__', $1, $2, 'uploaded') RETURNING id`,
    [file, fs.statSync(file).size]
  );
  const id = ins.rows[0].id;

  let res = await svc.processAutomaticPdfExtraction({ textbookId: id, pageLimit: 10, maxDurationMs: 600000 });
  console.log('pass1', { status: res.status, inProgress: res.inProgress, extracted: res.extractedPagesCount, next: res.nextPage, total: res.totalPages });
  if (!res.inProgress) throw new Error('expected first bounded pass to be in progress');
  if (res.extractedPagesCount !== 10) throw new Error('expected exactly 10 pages in pass1, got ' + res.extractedPagesCount);

  let rounds = 1;
  while (res.inProgress && rounds < 20) {
    res = await svc.processAutomaticPdfExtraction({ textbookId: id, pageLimit: 10, maxDurationMs: 600000 });
    rounds++;
    console.log('pass' + (rounds), { status: res.status, inProgress: res.inProgress, extracted: res.extractedPagesCount, next: res.nextPage });
  }

  const pages = await pool.query(
    `SELECT COUNT(*)::int total, COUNT(DISTINCT page_number)::int distinct_pages,
            COUNT(*) FILTER (WHERE content ~ '[஀-௿]')::int tamil_pages,
            MIN(page_number)::int min_page, MAX(page_number)::int max_page
     FROM textbook_content WHERE textbook_id=$1`,
    [id]
  );
  const job = await pool.query(`SELECT extraction_status, total_pages, extracted_pages, failed_pages, next_page, pdf_type FROM pdf_extractions WHERE textbook_id=$1 ORDER BY id DESC LIMIT 1`, [id]);
  console.log('rows', pages.rows[0], 'job', job.rows[0], 'rounds', rounds);

  const ok = res.status === 'COMPLETED' && pages.rows[0].total === 72 && pages.rows[0].distinct_pages === 72 &&
    pages.rows[0].min_page === 1 && pages.rows[0].max_page === 72 && pages.rows[0].tamil_pages === 71 &&
    job.rows[0].extraction_status === 'COMPLETED' && job.rows[0].failed_pages === 0;
  console.log(ok ? 'LARGE PDF TEST PASSED' : 'LARGE PDF TEST FAILED');
  await pool.end();
  process.exit(ok ? 0 : 1);
})().catch(async (e) => { console.error('TEST FAILED', e); try { await pool.end(); } catch {} process.exit(1); });
