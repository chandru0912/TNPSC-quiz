const p = require('./dist/db').default;
(async () => {
  const id = Number(process.argv[2]);
  const r = await p.query(
    `SELECT page_number, length(content) len, left(content, 100) s FROM textbook_content WHERE textbook_id=$1 ORDER BY page_number`,
    [id]
  );
  console.log(r.rows);
  await p.end();
})();
