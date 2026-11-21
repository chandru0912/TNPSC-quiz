/**
 * TNPSC Study Hub – Production Load Testing Harness
 *
 * Usage:
 *   npx tsx src/scripts/loadTest.ts --url http://localhost:5000/api/health --concurrency 100 --requests 500
 *   npx tsx src/scripts/loadTest.ts --url http://localhost:5000/api/questions?limit=20 --concurrency 500 --requests 2000
 *   npx tsx src/scripts/loadTest.ts --url http://localhost:5000/api/questions?limit=20 --concurrency 1000 --requests 3000
 */

import os from 'os';
import pool from '../db';

interface LoadTestArgs {
  url: string;
  concurrency: number;
  requests: number;
  token?: string;
}

function parseArgs(): LoadTestArgs {
  const argv = process.argv.slice(2);
  const getVal = (flag: string, fallback: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  return {
    url: getVal('--url', 'http://localhost:5000/api/health'),
    concurrency: Math.max(1, parseInt(getVal('--concurrency', '100'), 10) || 100),
    requests: Math.max(1, parseInt(getVal('--requests', '500'), 10) || 500),
    token: argv.includes('--token') ? getVal('--token', '') : undefined,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[idx] * 100) / 100;
}

async function queryDbConnections(): Promise<{ active: number; total: number } | null> {
  try {
    const res = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE state = 'active')::int AS active,
        COUNT(*)::int AS total
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    return {
      active: Number(res.rows[0]?.active ?? 0),
      total: Number(res.rows[0]?.total ?? 0),
    };
  } catch {
    return null;
  }
}

async function runLoadTest() {
  const { url, concurrency, requests, token } = parseArgs();
  const latencies: number[] = [];
  const statusCounts = new Map<number, number>();
  let networkErrors = 0;
  let issued = 0;

  const cpuStart = process.cpuUsage();
  const startTime = performance.now();
  const dbBefore = await queryDbConnections();

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  async function worker() {
    while (true) {
      const current = issued++;
      if (current >= requests) return;
      const t0 = performance.now();
      try {
        const res = await fetch(url, { headers });
        await res.arrayBuffer(); // consume body fully
        const dt = performance.now() - t0;
        latencies.push(dt);
        statusCounts.set(res.status, (statusCounts.get(res.status) || 0) + 1);
      } catch {
        networkErrors += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, () => worker()));

  const totalDurationMs = performance.now() - startTime;
  const cpuDiff = process.cpuUsage(cpuStart);
  const mem = process.memoryUsage();
  const dbAfter = await queryDbConnections();

  latencies.sort((a, b) => a - b);
  const avgMs =
    latencies.length > 0
      ? Math.round((latencies.reduce((acc, v) => acc + v, 0) / latencies.length) * 100) / 100
      : 0;
  const p95Ms = percentile(latencies, 95);
  const p99Ms = percentile(latencies, 99);
  const rps = Math.round((requests / (totalDurationMs / 1000)) * 100) / 100;

  let serverErrors = networkErrors;
  for (const [code, cnt] of statusCounts.entries()) {
    if (code >= 500) serverErrors += cnt;
  }
  const errorPct = Math.round((serverErrors / requests) * 10000) / 100;

  console.log('\n=== TNPSC Study Hub Load Test Report ===');
  console.log(`Target URL       : ${url}`);
  console.log(`Concurrency      : ${concurrency}`);
  console.log(`Total Requests   : ${requests}`);
  console.log(`Total Duration   : ${Math.round(totalDurationMs)} ms`);
  console.log(`Throughput (RPS) : ${rps} req/sec`);
  console.log(`Avg Latency      : ${avgMs} ms`);
  console.log(`P95 Latency      : ${p95Ms} ms`);
  console.log(`P99 Latency      : ${p99Ms} ms`);
  console.log(`Server Error %   : ${errorPct}% (network=${networkErrors})`);
  console.log(`Status Breakdown :`, Object.fromEntries(statusCounts.entries()));
  console.log(
    `Client Process   : RSS=${Math.round(mem.rss / 1024 / 1024)}MB, Heap=${Math.round(mem.heapUsed / 1024 / 1024)}MB, CPU=${Math.round((cpuDiff.user + cpuDiff.system) / 1000)}ms, Cores=${os.cpus().length}`
  );
  if (dbBefore && dbAfter) {
    console.log(
      `PostgreSQL Conns : before(active=${dbBefore.active}, total=${dbBefore.total}) -> after(active=${dbAfter.active}, total=${dbAfter.total})`
    );
  }
  console.log('========================================\n');

  await pool.end().catch(() => {});
}

runLoadTest().catch((err) => {
  console.error('[LoadTest Error]:', err);
  process.exit(1);
});
