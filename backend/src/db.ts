import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isProductionOrCloud =
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.VERCEL) ||
  (process.env.PGHOST && process.env.PGHOST !== 'localhost' && process.env.PGHOST !== '127.0.0.1') ||
  Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const config: PoolConfig = connectionString
  ? {
      connectionString,
      ssl: isProductionOrCloud ? { rejectUnauthorized: false } : undefined,
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'tnpsc_study_hub',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      ssl: isProductionOrCloud ? { rejectUnauthorized: false } : undefined,
    };

export const pool = new Pool(config);

export default pool;
