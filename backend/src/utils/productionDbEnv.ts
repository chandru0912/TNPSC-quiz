import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

export interface ProductionPgConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

const REQUIRED_PG_KEYS = [
  'PGHOST',
  'PGPORT',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
] as const;

export function getProductionEnvPath(): string {
  return path.resolve(__dirname, '../../.env.production.local');
}

/**
 * Loads and strictly validates production PostgreSQL credentials from
 * `backend/.env.production.local`. Never logs passwords or connection strings.
 */
export function loadAndValidateProductionPgEnv(
  envPath: string = getProductionEnvPath()
): ProductionPgConfig {
  if (!fs.existsSync(envPath)) {
    throw new Error(
      `Missing production env file at ${envPath}. Configure PGHOST, PGPORT, PGDATABASE, PGUSER, and PGPASSWORD there before running production DB commands.`
    );
  }

  const parsed = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
  const missingOrPlaceholder: string[] = [];

  for (const key of REQUIRED_PG_KEYS) {
    const raw = (parsed[key] ?? '').trim();
    if (!raw || raw === '[SENSITIVE]') {
      missingOrPlaceholder.push(key);
    }
  }

  if (missingOrPlaceholder.length > 0) {
    throw new Error(
      `Invalid or placeholder production PG variables in backend/.env.production.local: ${missingOrPlaceholder.join(', ')}`
    );
  }

  const host = parsed.PGHOST.trim();
  const port = Number.parseInt(parsed.PGPORT.trim(), 10);
  const database = parsed.PGDATABASE.trim();
  const user = parsed.PGUSER.trim();
  const password = parsed.PGPASSWORD;

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PGPORT value in backend/.env.production.local.`);
  }

  if (host === 'localhost' || host === '127.0.0.1') {
    throw new Error(
      `Refusing to run production DB command against local host (${host}).`
    );
  }

  if (database !== 'neondb') {
    throw new Error(
      `Expected PGDATABASE to be "neondb", got "${database}". Aborting.`
    );
  }

  return { host, port, database, user, password };
}

/**
 * Applies validated production PG variables to `process.env` so explicit
 * production CLI workflows using shared services target Neon `neondb`.
 */
export function applyProductionPgEnvToProcess(
  envPath: string = getProductionEnvPath()
): ProductionPgConfig {
  const cfg = loadAndValidateProductionPgEnv(envPath);
  process.env.PGHOST = cfg.host;
  process.env.PGPORT = String(cfg.port);
  process.env.PGDATABASE = cfg.database;
  process.env.PGUSER = cfg.user;
  process.env.PGPASSWORD = cfg.password;
  process.env.NODE_ENV = 'production';
  return cfg;
}

export function createProductionPool(cfg: ProductionPgConfig): Pool {
  return new Pool({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    ssl: { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 15000,
  });
}
