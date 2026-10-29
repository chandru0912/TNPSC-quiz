const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});
async function run(){
  try{
    const r = await pool.query('SELECT COUNT(*) as cnt FROM questions');
    console.log('questions count:', r.rows[0].cnt);
    const r2 = await pool.query("SELECT status, COUNT(*) as cnt FROM questions GROUP BY status");
    console.log(r2.rows);
    const r3 = await pool.query("SELECT category, COUNT(*) as cnt FROM questions GROUP BY category");
    console.log(r3.rows);
  }catch(e){
    console.log('err:', e.message);
  }finally{
    await pool.end();
  }
}
run();
