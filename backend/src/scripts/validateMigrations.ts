/**
 * Safe Database Migration Validator
 *
 * 1. Always runs static safety checks on backend/src/migrate.ts to ensure no
 *    destructive statements (DROP DATABASE, DROP TABLE, TRUNCATE) were introduced.
 * 2. When --apply-ephemeral is passed (used ONLY against throwaway CI PostgreSQL
 *    containers, NEVER production), executes runMigration() twice to verify both
 *    clean-slate execution and idempotency.
 */

import fs from 'fs';
import path from 'path';

// Explicitly allowlisted legacy deprecated table cleanup already present in migrate.ts
const LEGACY_ALLOWED_DROPS = new Set(['question_translations']);

const FORBIDDEN_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'DROP DATABASE', regex: /\bDROP\s+DATABASE\b/i },
  { name: 'DROP SCHEMA', regex: /\bDROP\s+SCHEMA\b/i },
  { name: 'TRUNCATE TABLE', regex: /\bTRUNCATE\s+(?:TABLE\s+)?[a-zA-Z_]/i },
];

function staticSafetyAudit(): void {
  const migratePath = path.resolve(__dirname, '../migrate.ts');
  const content = fs.readFileSync(migratePath, 'utf8');
  const violations: string[] = [];

  for (const rule of FORBIDDEN_PATTERNS) {
    if (rule.regex.test(content)) {
      violations.push(rule.name);
    }
  }

  // Flag any DROP TABLE statement except explicitly allowlisted legacy deprecated tables
  const dropTableRegex = /\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_."]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = dropTableRegex.exec(content)) !== null) {
    const tableName = match[1].replace(/["']/g, '').toLowerCase();
    if (!tableName.startsWith('pg_temp.') && !LEGACY_ALLOWED_DROPS.has(tableName)) {
      violations.push(`DROP TABLE ${tableName}`);
    }
  }

  if (violations.length > 0) {
    console.error(`[Migration Safety Check FAILED] Destructive SQL detected in migrate.ts: ${violations.join(', ')}`);
    process.exit(1);
  }

  console.log('[Migration Safety Check PASSED] No unauthorized destructive DROP/TRUNCATE statements found in migrate.ts.');
}

async function runEphemeralDbVerification(): Promise<void> {
  const dbName = String(process.env.PGDATABASE || '');
  if (!dbName.toLowerCase().includes('ci') && !dbName.toLowerCase().includes('test')) {
    console.error(
      '[Migration Guard] Refusing to run --apply-ephemeral against a non-test database name. Set PGDATABASE to a CI/test database (e.g. tnpsc_ci_test).'
    );
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runMigration } = require('../migrate') as typeof import('../migrate');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { default: pool } = require('../db') as typeof import('../db');

  try {
    console.log('[Migration CI] Pass 1: Applying schema migrations to ephemeral CI PostgreSQL...');
    await runMigration();
    console.log('[Migration CI] Pass 2: Re-running migrations to verify idempotency...');
    await runMigration();
    console.log('[Migration CI PASSED] Ephemeral migration and idempotency checks succeeded.');
  } finally {
    await pool.end().catch(() => {});
  }
}

async function main() {
  staticSafetyAudit();
  if (process.argv.includes('--apply-ephemeral')) {
    await runEphemeralDbVerification();
  }
}

main().catch((err) => {
  console.error('[Migration Validation Error]:', err?.message || err);
  process.exit(1);
});
