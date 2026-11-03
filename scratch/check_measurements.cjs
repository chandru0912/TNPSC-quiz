const { Pool } = require('../backend/node_modules/pg');
require('../backend/node_modules/dotenv').config({ path: './backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const r1 = await pool.query(
    "SELECT textbook_id, page_number, lesson_title, SUBSTRING(content, 1, 60) as preview FROM textbook_content WHERE content ILIKE $1 OR lesson_title ILIKE $1",
    ["%measurement%"]
  );
  console.log("textbook_content matches:", r1.rows.length);
  console.table(r1.rows);

  const r2 = await pool.query(
    "SELECT id, file_name, standard, subject FROM google_drive_materials WHERE extracted_text ILIKE $1",
    ["%measurement%"]
  );
  console.log("google_drive_materials matches:", r2.rows.length);
  console.table(r2.rows);

  const r3 = await pool.query(
    "SELECT id, file_name, standard, subject, term, is_published, status, extraction_status FROM google_drive_materials"
  );
  console.log("All google_drive_materials:");
  console.table(r3.rows);

  const r4 = await pool.query(
    "SELECT id, book_name, standard, subject, term, status, is_published FROM textbooks"
  );
  console.log("All textbooks:");
  console.table(r4.rows);

  pool.end();
}
check().catch(console.error);
