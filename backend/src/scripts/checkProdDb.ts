import {
  createProductionPool,
  loadAndValidateProductionPgEnv,
} from '../utils/productionDbEnv';

async function main(): Promise<void> {
  const cfg = loadAndValidateProductionPgEnv();
  const pool = createProductionPool(cfg);

  try {
    const result = await pool.query<{
      current_database: string;
      current_user: string;
      version: string;
    }>('SELECT current_database(), current_user, version()');

    const row = result.rows[0];
    if (!row || row.current_database !== 'neondb') {
      throw new Error(
        `Connected database mismatch: expected "neondb", got "${row?.current_database ?? 'unknown'}".`
      );
    }

    console.log(
      JSON.stringify(
        {
          connected: true,
          host: cfg.host,
          port: cfg.port,
          current_database: row.current_database,
          current_user: row.current_user,
          version: row.version,
        },
        null,
        2
      )
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Production DB connectivity check failed: ${message}`);
  process.exit(1);
});
