require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool();
(async () => {
  for (const t of ['syllabus_units', 'syllabus_lessons', 'syllabus_topics', 'study_notes', 'questions']) {
    const c = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [t]);
    console.log(t, c.rows.map(r => `${r.column_name}:${r.data_type}`).join(', '));
  }
  const fk = await pool.query(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_col, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type='FOREIGN KEY' AND (ccu.table_name LIKE 'syllabus_%' OR tc.table_name LIKE 'syllabus_%')`);
  console.log('FKs:', fk.rows);
  const u = await pool.query(`SELECT id, exam_id, subject_id, unit_number, title FROM syllabus_units ORDER BY id LIMIT 5`);
  console.log(u.rows);
  const sn = await pool.query(`SELECT DISTINCT unit_id FROM study_notes`);
  const q = await pool.query(`SELECT unit_id, count(*) FROM questions GROUP BY unit_id ORDER BY unit_id`);
  console.log('notes unit_ids', sn.rows, 'question unit_ids', q.rows);
  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });

