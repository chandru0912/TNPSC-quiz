const pool = require('../backend/dist/db').default || require('../backend/dist/db');

async function run() {
  await pool.query(`
    ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS file_name TEXT DEFAULT NULL;
    ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS standard INT DEFAULT NULL;
    ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT NULL;
    ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS term TEXT DEFAULT NULL;
    ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS material_id INT DEFAULT NULL;

    CREATE INDEX IF NOT EXISTS idx_textbook_content_std_sub ON textbook_content (standard, subject);
    CREATE INDEX IF NOT EXISTS idx_textbook_content_mat_page ON textbook_content (material_id, page_number);
  `);

  // Backfill existing rows
  await pool.query(`
    UPDATE textbook_content tc
    SET 
      file_name = t.book_name,
      standard = t.standard,
      subject = t.subject,
      term = t.term
    FROM textbooks t
    WHERE tc.textbook_id = t.id AND tc.file_name IS NULL;
  `);

  // Backfill material_id if available
  await pool.query(`
    UPDATE textbook_content tc
    SET material_id = gdm.id
    FROM textbooks t
    JOIN google_drive_materials gdm ON (t.file_path LIKE '%' || gdm.google_drive_file_id || '%' OR t.book_name = gdm.file_name)
    WHERE tc.textbook_id = t.id AND tc.material_id IS NULL;
  `);

  const sample = await pool.query(`
    SELECT id, textbook_id, material_id, file_name, standard, subject, term, unit_id, lesson_title, page_number, extraction_status, text_length
    FROM textbook_content
    LIMIT 3;
  `);
  console.log('Sample updated rows:', JSON.stringify(sample.rows, null, 2));

  await pool.end();
}
run().catch(console.error);

