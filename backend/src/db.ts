import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'tnpsc_study_hub',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
});

export default pool;
