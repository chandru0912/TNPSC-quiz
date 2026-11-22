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
const connectionString = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
const hasExplicitPgVars = Boolean(process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD);
const isLocalHost =
  !connectionString &&
  (process.env.PGHOST === 'localhost' || process.env.PGHOST === '127.0.0.1');

const sslConfig =
  isProductionOrCloud && !isLocalHost
    ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED === 'true' }
    : undefined;

export function getDirectDatabaseUrl(): string {
  return process.env.DIRECT_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

const poolSettings = {
  max: isServerless ? 2 : 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: isServerless ? 5000 : 15000,
  allowExitOnIdle: isServerless,
};

function buildPoolConfig(): PoolConfig {
  if (connectionString) {
    return {
      connectionString,
      ssl: sslConfig,
      ...poolSettings,
    };
  }

  if (hasExplicitPgVars) {
    return {
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'neondb',
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: sslConfig,
      ...poolSettings,
    };
  }

  throw new Error(
    '[DB Config Error] Missing DATABASE_URL (or POSTGRES_URL / PGHOST+PGUSER+PGPASSWORD). ' +
      'Localhost fallback is disabled to prevent database drift. Configure your Neon PostgreSQL DATABASE_URL in backend/.env or Vercel Environment Variables.'
  );
}

const config: PoolConfig = buildPoolConfig();

export const pool = new Pool(config);

// Prevent unhandled idle client errors from crashing the Node/Express process
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool idle client error:', err.message);
});

export default pool;
