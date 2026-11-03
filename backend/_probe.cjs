require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const c = new Client({ host: process.env.PGHOST, port: +process.env.PGPORT, database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD });
  await c.connect();
  const q = async (s, p) => {
    try { const r = await c.query(s, p); console.log('\n### ' + s.slice(0, 90).replace(/\s+/g, ' ')); console.table(r.rows); }
    catch (e) { console.log('ERR', e.message); }
  };
  await q(`select id, file_name, subject, standard, term, medium, page_count, total_pages, extraction_status, upload_status, pdf_type, native_pages, ocr_pages, failed_pages, completion_percentage, length(coalesce(extracted_text,'')) as textlen, jsonb_array_length(case when jsonb_typeof(extracted_pages)='array' then extracted_pages else '[]'::jsonb end) as pagesjson from google_drive_materials order by id`);
  await q(`select id, book_name, group_id, standard, subject, medium, term, file_path, page_count, total_pages, status, extraction_status, native_pages, ocr_pages, failed_pages, completion_percentage from textbooks order by id`);
  await q(`select textbook_id, count(*) pages, sum(case when extraction_status='completed' then 1 else 0 end) completed, sum(case when is_ocr then 1 else 0 end) ocr from textbook_content group by textbook_id order by textbook_id`);
  await q(`select * from pdf_extractions order by id`);
  await c.end();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
