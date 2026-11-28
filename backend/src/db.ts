import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import dns from 'dns';
import path from 'path';

if (!process.env.VERCEL) {
  dotenv.config();
  dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

  // Resilient DNS fallback for local Windows/ISP resolvers that intermittently return ENOTFOUND
  // for cloud PostgreSQL hostnames (e.g. *.aws.neon.tech) while public DNS resolves them cleanly.
  const globalKey = '__tnpscDnsFallbackInstalled';
  if (!(globalThis as any)[globalKey]) {
    (globalThis as any)[globalKey] = true;
    const fallbackResolver = new dns.Resolver();
    fallbackResolver.setServers(['8.8.8.8', '1.1.1.1']);
    const dnsCache = new Map<string, { addresses: string[]; expiresAt: number }>();
    const origLookup = dns.lookup.bind(dns);

    (dns as any).lookup = function patchedLookup(
      hostname: string,
      options: any,
      callback?: any
    ) {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      const opts = typeof options === 'number' ? { family: options } : options || {};

      origLookup(hostname, opts, (err: NodeJS.ErrnoException | null, address: any, family?: number) => {
        if (!err || err.code !== 'ENOTFOUND' || !hostname || hostname === 'localhost') {
          return callback(err, address, family);
        }

        const cached = dnsCache.get(hostname);
        if (cached && cached.expiresAt > Date.now() && cached.addresses.length > 0) {
          if (opts.all) {
            return callback(
              null,
              cached.addresses.map((a) => ({ address: a, family: 4 }))
            );
          }
          return callback(null, cached.addresses[0], 4);
        }

        fallbackResolver.resolve4(hostname, (rErr, addrs) => {
          if (rErr || !addrs || addrs.length === 0) {
            return callback(err);
          }
          dnsCache.set(hostname, { addresses: addrs, expiresAt: Date.now() + 60_000 });
          if (opts.all) {
            return callback(
              null,
              addrs.map((a) => ({ address: a, family: 4 }))
            );
          }
          return callback(null, addrs[0], 4);
        });
      });
    };
  }
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

const parsedPoolMax = Number(process.env.PG_POOL_MAX);
const poolSettings = {
  max: Number.isFinite(parsedPoolMax) && parsedPoolMax > 0 ? parsedPoolMax : isServerless ? 5 : 15,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: isServerless ? 10000 : 30000,
  maxUses: isServerless ? 500 : 7500,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  statement_timeout: isServerless ? 25000 : 30000,
  query_timeout: isServerless ? 25000 : 30000,
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
