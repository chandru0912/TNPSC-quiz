const pool = require('../backend/dist/db').default || require('../backend/dist/db');

async function run() {
  try {
    const res = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'questions' ORDER BY ordinal_position"
    );
    console.log(JSON.stringify(res.rows, null, 2));
    await pool.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();

