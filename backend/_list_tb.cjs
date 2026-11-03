const pool = require('./dist/db').default;
(async () => {
  const tb = await pool.query(`SELECT id, book_name, subject, medium, standard, term, group_id, page_count, status, pdf_type, native_pages, ocr_pages, failed_pages, extraction_status, file_path FROM textbooks ORDER BY id`);
  console.log(tb.rows);
  const units = await pool.query(`SELECT textbook_id, unit_id, unit_title, lesson_title, COUNT(*) pages, MIN(page_number) start, MAX(page_number) end FROM textbook_content WHERE textbook_id=613 GROUP BY textbook_id, unit_id, unit_title, lesson_title ORDER BY unit_id, start LIMIT 20`);
  console.log(units.rows);
  await pool.end();
})();
