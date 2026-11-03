const path = require('path');
const fs = require('fs');
process.chdir(__dirname);
const { ensureDatabaseSchema } = require('./dist/migrate');
const pool = require('./dist/db').default;
const svc = require('./dist/services/pdfExtractionService');

(async () => {
  await ensureDatabaseSchema();
  const file = path.resolve(__dirname, 'uploads/textbooks/tb_1793355086470_Class_6_Tamil_Tamil_Tamil_-_Term_1_-_2025_Edition-www.tntextbooks.in__1_.pdf');
  await pool.query(`DELETE FROM textbooks WHERE book_name='__extract_test_ta__'`);
  const ins = await pool.query(
    `INSERT INTO textbooks (group_id, standard, subject, medium, term, book_name, file_path, file_size, status)
     VALUES ('group4', 6, 'Tamil', 'Tamil', 'Term 1', '__extract_test_ta__', $1, $2, 'uploaded') RETURNING id`,
    [file, fs.statSync(file).size]
  );
  const id = ins.rows[0].id;
  console.log('Tamil textbook id', id);

  let res = await svc.processAutomaticPdfExtraction({ textbookId: id, pageLimit: 100, maxDurationMs: 180000 });
  console.log('result', JSON.stringify(res));

  const pages = await pool.query(
    `SELECT COUNT(*)::int rows, COUNT(*) FILTER (WHERE extraction_status='completed')::int completed,
            COUNT(*) FILTER (WHERE content ~ '[\u0B80-\u0BFF]')::int tamil_pages,
            MIN(page_number)::int min_p, MAX(page_number)::int max_p
     FROM textbook_content WHERE textbook_id=$1`,
    [id]
  );
  console.log('pages', pages.rows[0]);
  const sample = await pool.query(
    `SELECT page_number, left(content, 160) s FROM textbook_content WHERE textbook_id=$1 AND content ~ '[\u0B80-\u0BFF]' ORDER BY page_number LIMIT 3`,
    [id]
  );
  console.log('sample', sample.rows);
  if (res.totalPages !== 72) throw new Error('expected 72 pages, got ' + res.totalPages);
  if (res.status !== 'COMPLETED') throw new Error('expected COMPLETED, got ' + res.status);
  if (pages.rows[0].tamil_pages < 60) throw new Error('too few Tamil pages');
  console.log('TAMIL NATIVE TEST PASSED');
  await pool.end();
})().catch(async (e) => { console.error('TEST FAILED', e); try { await pool.end(); } catch {} process.exit(1); });
