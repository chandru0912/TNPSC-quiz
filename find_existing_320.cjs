const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });
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
  }catch(e){
    console.log('err');
  }finally{
    await pool.end();
  }
}
run();
