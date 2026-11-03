const pool = require('../backend/dist/db').default || require('../backend/dist/db');
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('study_notes','study_materials','google_drive_materials') ORDER BY table_name, ordinal_position")
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); pool.end(); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
