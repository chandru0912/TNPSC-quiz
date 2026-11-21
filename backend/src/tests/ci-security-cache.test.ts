import assert from 'assert';
import express from 'express';
import http from 'http';
import {
  studentLoginLimiter,
  adminLoginLimiter,
  otpVerificationLimiter,
  mcqPracticeLimiter,
  searchApiLimiter,
  aiGenerationLimiter,
  ResilientRedisStore,
  getSafeClientIp,
} from '../middleware/rateLimiter';
import {
  securityHeadersMiddleware,
  requestInputValidationMiddleware,
} from '../middleware/security';
import { CacheService, InMemoryCacheProvider, cacheService } from '../services/cacheService';
import {
  responseCacheMiddleware,
  cacheInvalidationMiddleware,
} from '../middleware/cacheMiddleware';
import { generateAdminToken, generateStudentToken } from '../middleware/auth';
import {
  executeWithCircuitBreaker,
  getOrCreateBreaker,
  getBreakerState,
  getAllCircuitBreakerSnapshots,
  resetBreakerForTests,
  CircuitOpenError,
} from '../services/circuitBreakerService';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runSecurityAndRateLimitTests() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(securityHeadersMiddleware);
  app.use(express.json());
  app.use(requestInputValidationMiddleware);
  app.use(searchApiLimiter);

  app.post('/api/student/login', studentLoginLimiter, (_req, res) => {
    res.status(401).json({ status: 'error', message: 'Invalid email address or password.' });
  });
  app.post('/api/student/reset-password', otpVerificationLimiter, (_req, res) => {
    res.status(400).json({ status: 'error', message: 'Invalid reset code.' });
  });
  app.post('/api/admin/login', adminLoginLimiter, (_req, res) => {
    res.status(401).json({ status: 'error', message: 'Invalid admin credentials.' });
  });
  app.get('/api/questions', mcqPracticeLimiter, (req, res) => {
    res.status(200).json({ status: 'success', ip: getSafeClientIp(req), search: req.query.search || null });
  });
  app.post('/api/ai/generate', aiGenerationLimiter, (_req, res) => {
    res.status(200).json({ status: 'success' });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}`;

  try {
    // 1. Student login brute-force rate limit (5/min -> 6th returns 429 + Retry-After)
    for (let i = 1; i <= 5; i++) {
      const r = await fetch(`${base}/api/student/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.10' },
        body: JSON.stringify({ email: 'studentA@tnpsc.in', password: 'wrong' }),
      });
      assert.strictEqual(r.status, 401);
    }
    const r6 = await fetch(`${base}/api/student/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.10' },
      body: JSON.stringify({ email: 'studentA@tnpsc.in', password: 'wrong' }),
    });
    assert.strictEqual(r6.status, 429);
    assert(Number(r6.headers.get('retry-after')) >= 1);

    // 2. Shared IP fairness
    const rStudentB = await fetch(`${base}/api/student/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.10' },
      body: JSON.stringify({ email: 'studentB@tnpsc.in', password: 'wrong' }),
    });
    assert.strictEqual(rStudentB.status, 401);

    // 3. Admin login strict rate limit (5/min)
    for (let i = 1; i <= 5; i++) {
      const r = await fetch(`${base}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.7' },
        body: JSON.stringify({ username: 'admin', password: 'wrong' }),
      });
      assert.strictEqual(r.status, 401);
    }
    const rAdmin6 = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.7' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });
    assert.strictEqual(rAdmin6.status, 429);

    // 4. OTP rate limit (5/min)
    for (let i = 1; i <= 5; i++) {
      await fetch(`${base}/api/student/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.8' },
        body: JSON.stringify({ email: 'otp@tnpsc.in', resetCode: '000000' }),
      });
    }
    const rOtp6 = await fetch(`${base}/api/student/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.8' },
      body: JSON.stringify({ email: 'otp@tnpsc.in', resetCode: '000000' }),
    });
    assert.strictEqual(rOtp6.status, 429);

    // 5. MCQ Practice (120/min) + Search (30/min) + AI Generation (5/10min)
    const token1 = generateStudentToken(101, 'u101@tnpsc.in', 'Student 101');
    const token2 = generateStudentToken(102, 'u102@tnpsc.in', 'Student 102');
    for (let i = 1; i <= 120; i++) {
      const r = await fetch(`${base}/api/questions`, {
        headers: { Authorization: `Bearer ${token1}`, 'X-Forwarded-For': '203.0.113.50' },
      });
      assert.strictEqual(r.status, 200);
    }
    assert.strictEqual(
      (await fetch(`${base}/api/questions`, {
        headers: { Authorization: `Bearer ${token1}`, 'X-Forwarded-For': '203.0.113.50' },
      })).status,
      429
    );
    assert.strictEqual(
      (await fetch(`${base}/api/questions`, {
        headers: { Authorization: `Bearer ${token2}`, 'X-Forwarded-For': '203.0.113.50' },
      })).status,
      200
    );

    const token3 = generateStudentToken(103, 'u103@tnpsc.in', 'Student 103');
    for (let i = 1; i <= 30; i++) {
      assert.strictEqual(
        (await fetch(`${base}/api/questions?search=polity`, { headers: { Authorization: `Bearer ${token3}` } })).status,
        200
      );
    }
    assert.strictEqual(
      (await fetch(`${base}/api/questions?search=polity`, { headers: { Authorization: `Bearer ${token3}` } })).status,
      429
    );

    for (let i = 1; i <= 5; i++) {
      assert.strictEqual(
        (await fetch(`${base}/api/ai/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.99' },
          body: JSON.stringify({ prompt: 'test' }),
        })).status,
        200
      );
    }
    assert.strictEqual(
      (await fetch(`${base}/api/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.99' },
        body: JSON.stringify({ prompt: 'test' }),
      })).status,
      429
    );

    // 6. Trust proxy + Helmet headers + Null-byte rejection
    const rSpoof = await fetch(`${base}/api/questions`, {
      headers: { Authorization: `Bearer ${token2}`, 'X-Forwarded-For': '1.2.3.4, 9.8.7.6' },
    });
    const spoofJson: any = await rSpoof.json();
    assert.strictEqual(spoofJson.ip, '9.8.7.6');
    assert.strictEqual(rSpoof.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(rSpoof.headers.get('x-powered-by'), null);
    assert.strictEqual(
      (await fetch(`${base}/api/questions?search=abc%00def`, { headers: { Authorization: `Bearer ${token2}` } })).status,
      400
    );

    // 7. Redis failover & recovery
    let online = true;
    let hits = 0;
    const mockRedis: any = {
      get status() {
        return online ? 'ready' : 'reconnecting';
      },
      async eval() {
        if (!online) throw new Error('ECONNREFUSED');
        hits += 1;
        return [hits, 60000];
      },
      async decr() {
        hits = Math.max(0, hits - 1);
      },
      async del() {
        hits = 0;
      },
    };
    const store = new ResilientRedisStore('ci_test', mockRedis);
    store.init({ windowMs: 60_000 } as any);
    assert.strictEqual((await store.increment('k1')).totalHits, 1);
    online = false;
    assert.strictEqual((await store.increment('k1')).totalHits, 1);
    online = true;
    assert.strictEqual((await store.increment('k1')).totalHits, 2);

    console.log('PASS: Rate Limiting, Trusted Proxy, Security Headers & Redis Failover Suite');
  } finally {
    server.close();
  }
}

async function runCachingTests() {
  const svc = new CacheService(new InMemoryCacheProvider(10), true);
  assert.strictEqual(await svc.get('missing'), null);
  await svc.set('syllabus:exams', ['group1'], 100);
  assert.deepStrictEqual(await svc.get('syllabus:exams'), ['group1']);
  await sleep(140);
  assert.strictEqual(await svc.get('syllabus:exams'), null);

  let loaderCalls = 0;
  await Promise.all(
    Array.from({ length: 15 }, () =>
      svc.getOrSet('syllabus:coalesce', 10_000, async () => {
        loaderCalls += 1;
        await sleep(30);
        return 'ok';
      })
    )
  );
  assert.strictEqual(loaderCalls, 1);

  await cacheService.clear();
  const app = express();
  app.use(express.json());
  let version = 1;
  let queries = 0;
  const router = express.Router();
  router.get('/', (_req, res) => {
    queries += 1;
    res.status(200).json({ version });
  });
  router.post('/publish', (_req, res) => {
    version += 1;
    res.status(200).json({ version });
  });
  app.use(
    '/api/questions',
    cacheInvalidationMiddleware(['mcq:']),
    responseCacheMiddleware({ namespace: 'mcq', ttlMs: 10_000 }),
    router
  );

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}`;

  try {
    const stuTok = generateStudentToken(301, 's301@tnpsc.in', 'S301');
    const admTok = generateAdminToken('admin', 'Super Admin', 'super_admin');

    const r1 = await fetch(`${base}/api/questions?unitId=1`, { headers: { Authorization: `Bearer ${stuTok}` } });
    assert.strictEqual(r1.headers.get('x-cache'), 'MISS');
    const r2 = await fetch(`${base}/api/questions?unitId=1`, { headers: { Authorization: `Bearer ${stuTok}` } });
    assert.strictEqual(r2.headers.get('x-cache'), 'HIT');
    assert.strictEqual(queries, 1);

    const rAdm = await fetch(`${base}/api/questions?unitId=1`, { headers: { Authorization: `Bearer ${admTok}` } });
    assert.strictEqual(rAdm.headers.get('x-cache'), 'BYPASS');

    await fetch(`${base}/api/questions/publish`, { method: 'POST', headers: { Authorization: `Bearer ${admTok}` } });
    const r3 = await fetch(`${base}/api/questions?unitId=1`, { headers: { Authorization: `Bearer ${stuTok}` } });
    assert.strictEqual(r3.headers.get('x-cache'), 'MISS');
    assert.strictEqual(((await r3.json()) as any).version, 2);

    console.log('PASS: Caching, TTL Expiration, Stampede Protection & Auto-Invalidation Suite');
  } finally {
    server.close();
  }
}

async function runCircuitBreakerTests() {
  const testSvc = 'ci_cb_test_service';
  const timeoutSvc = 'ci_cb_timeout_service';
  resetBreakerForTests(testSvc);
  resetBreakerForTests(timeoutSvc);

  try {
    const cfg = {
      timeoutMs: 250,
      errorThresholdPercentage: 50,
      volumeThreshold: 3,
      resetTimeoutMs: 220,
      maxRetries: 0,
      baseBackoffMs: 20,
    };

    // 1. Successful request keeps breaker CLOSED
    const okRes = await executeWithCircuitBreaker({ service: testSvc, configOverride: cfg }, async () => 'healthy');
    assert.strictEqual(okRes, 'healthy');
    assert.strictEqual(getBreakerState(getOrCreateBreaker(testSvc).breaker), 'CLOSED');

    // 2. Repeated service failures trip breaker to OPEN
    for (let i = 0; i < 3; i++) {
      await assert.rejects(
        () =>
          executeWithCircuitBreaker({ service: testSvc, configOverride: cfg }, async () => {
            throw Object.assign(new Error('upstream 503'), { statusCode: 503 });
          }),
        /upstream 503|temporarily unavailable/i
      );
    }
    assert.strictEqual(getBreakerState(getOrCreateBreaker(testSvc).breaker), 'OPEN', 'Breaker must transition to OPEN');

    // 3. OPEN state fast-fails immediately (0 upstream calls) & invokes fallback when provided
    let upstreamInvokedWhileOpen = 0;
    await assert.rejects(
      () =>
        executeWithCircuitBreaker({ service: testSvc, configOverride: cfg }, async () => {
          upstreamInvokedWhileOpen += 1;
          return 'should-not-run';
        }),
      (err: any) => err instanceof CircuitOpenError && err.statusCode === 503
    );
    assert.strictEqual(upstreamInvokedWhileOpen, 0, 'OPEN breaker must short-circuit without calling upstream');

    const fb = await executeWithCircuitBreaker(
      {
        service: testSvc,
        configOverride: cfg,
        fallback: () => 'safe-degraded-fallback',
      },
      async () => 'should-not-run'
    );
    assert.strictEqual(fb, 'safe-degraded-fallback', 'Fallback response returned cleanly while OPEN');

    // 4. HALF-OPEN recovery -> CLOSED after resetTimeoutMs
    await sleep(260);
    const recovered = await executeWithCircuitBreaker(
      { service: testSvc, configOverride: cfg },
      async () => 'recovered-ok'
    );
    assert.strictEqual(recovered, 'recovered-ok');
    assert.strictEqual(
      getBreakerState(getOrCreateBreaker(testSvc).breaker),
      'CLOSED',
      'Successful HALF-OPEN probe closes circuit'
    );

    // 5. Timeout handling + concurrent requests
    const timeoutCfg = {
      timeoutMs: 80,
      errorThresholdPercentage: 50,
      volumeThreshold: 3,
      resetTimeoutMs: 250,
      maxRetries: 0,
      baseBackoffMs: 10,
    };
    const concurrentResults = await Promise.all(
      Array.from({ length: 5 }, () =>
        executeWithCircuitBreaker(
          {
            service: timeoutSvc,
            configOverride: timeoutCfg,
            fallback: () => 'timeout-fallback',
          },
          async () => {
            await sleep(200);
            return 'too-late';
          }
        )
      )
    );
    assert(concurrentResults.every((r) => r === 'timeout-fallback'), 'Timed-out concurrent calls return safe fallback');
    assert.strictEqual(getBreakerState(getOrCreateBreaker(timeoutSvc).breaker), 'OPEN', 'Repeated timeouts open circuit');

    // 6. Monitoring snapshot exposes all external services + Vercel/Node runtime scope cleanly
    const snapshot = getAllCircuitBreakerSnapshots();
    assert.strictEqual(snapshot.enabled, true);
    assert(snapshot.breakers.some((b) => b.name === 'openai_api'));
    assert(snapshot.breakers.some((b) => b.name === 'razorpay_orders'));
    assert(snapshot.breakers.some((b) => b.name === 'google_oauth'));
    assert(snapshot.breakers.some((b) => b.name === 'google_drive'));

    console.log('PASS: Circuit Breaker (CLOSED / OPEN / HALF-OPEN, Timeout, Fallback & Concurrency) Suite');
  } finally {
    resetBreakerForTests(testSvc);
    resetBreakerForTests(timeoutSvc);
  }
}

async function main() {
  await runSecurityAndRateLimitTests();
  await runCachingTests();
  await runCircuitBreakerTests();

  // Transparently report tests that require external secrets / live services (never pretend they passed)
  console.log('SKIPPED: Live Google OAuth / Razorpay Webhook / AI Provider E2E tests (require external credentials not available in untrusted CI).');
  console.log('\nALL CI SECURITY, RATE LIMITING, CACHING & CIRCUIT BREAKER TESTS PASSED.');
}

main().catch((err) => {
  console.error('CI TEST SUITE FAILED:', err);
  process.exit(1);
});
