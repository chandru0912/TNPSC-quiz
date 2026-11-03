const p = require('./dist/db').default;
(async () => {
  const r = await p.query(
    "SELECT unit_id, unit_title, lesson_title, COUNT(*) pages, MIN(page_number) s, MAX(page_number) e FROM textbook_content WHERE textbook_id=$1 GROUP BY 1,2,3 ORDER BY s",
    [Number(process.argv[2])]
  );
  console.log(r.rows);
  await p.end();
})();
