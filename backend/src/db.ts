import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

import path from 'path';

if (!process.env.VERCEL) {
  dotenv.config();
  dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });
}

export const isProductionOrCloud =
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.PGHOST && process.env.PGHOST !== 'localhost' && process.env.PGHOST !== '127.0.0.1') ||
  Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);

const isServerless = Boolean(process.env.VERCEL);
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const hasExplicitPgVars = Boolean(process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD);
const sslConfig = isProductionOrCloud
  ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false' }
  : undefined;

export function getDirectDatabaseUrl(): string {
  return process.env.DIRECT_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

const poolSettings = {
  max: isServerless ? 2 : 10,
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: isServerless ? 5000 : 15000,
  allowExitOnIdle: isServerless,
};

const config: PoolConfig = hasExplicitPgVars
  ? {
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'neondb',
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: sslConfig,
    ...poolSettings,
  }
  : connectionString
    ? {
      connectionString,
      ssl: sslConfig,
      ...poolSettings,
    }
    : {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'tnpsc_study_hub',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      ssl: sslConfig,
      ...poolSettings,
    };

export const pool = new Pool(config);

// Prevent unhandled idle client errors from crashing the Node/Express process
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool idle client error:', err.message);
});

export default pool;
