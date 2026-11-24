import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import https from 'https';
import assert from 'assert';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const BACKEND_BASE_URL = (process.env.LOCAL_BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, '');
const FRONTEND_ORIGIN = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
const CONNECT_TIMEOUT_MS = 5_000;
const RESPONSE_TIMEOUT_MS = 10_000;
const MAX_TOTAL_DURATION_MS = 30_000;

interface TimedHttpResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  elapsedMs: number;
}

function timedHttpRequest(
  urlStr: string,
  options: { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: string } = {}
): Promise<TimedHttpResponse> {
  const parsed = new URL(urlStr);
  const transport = parsed.protocol === 'https:' ? https : http;
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    let settled = false;
    let connected = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      clearTimeout(responseTimer);
      fn();
    };

    const req = transport.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        connected = true;
        clearTimeout(connectTimer);
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () =>
          finish(() =>
            resolve({
              statusCode: res.statusCode || 0,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf8'),
              elapsedMs: Date.now() - startedAt,
            })
          )
        );
        res.on('error', (err) => finish(() => reject(err)));
      }
    );

    req.on('socket', (socket) => {
      socket.on('connect', () => {
        connected = true;
        clearTimeout(connectTimer);
      });
    });

    const connectTimer = setTimeout(() => {
      if (!connected) {
        req.destroy();
        finish(() => reject(new Error(`Connection timeout (${CONNECT_TIMEOUT_MS}ms) for ${urlStr}`)));
      }
    }, CONNECT_TIMEOUT_MS);

    const responseTimer = setTimeout(() => {
      req.destroy();
      finish(() => reject(new Error(`Response timeout (${RESPONSE_TIMEOUT_MS}ms) for ${urlStr}`)));
    }, RESPONSE_TIMEOUT_MS);

    req.on('error', (err) => finish(() => reject(err)));
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  const startedAt = Date.now();
  let lastStep = 'init';
  const watchdog = setTimeout(() => {
    console.error(`[TIMEOUT] Exceeded ${MAX_TOTAL_DURATION_MS}ms at step: ${lastStep}`);
    process.exit(1);
  }, MAX_TOTAL_DURATION_MS);

  try {
    lastStep = 'GET /api/drive/status';
    const statusRes = await timedHttpRequest(`${BACKEND_BASE_URL}/api/drive/status`);
    assert.strictEqual(statusRes.statusCode, 200);
    const statusJson = JSON.parse(statusRes.body);
    assert.strictEqual(statusJson.data?.redirectUri, 'http://localhost:5000/api/drive/oauth/callback');
    console.log(`[PASS] 1/5 GET /api/drive/status (${statusRes.elapsedMs}ms) -> state=${statusJson.data?.connectionState}`);

    lastStep = 'POST /api/admin/login';
    const loginPayload = JSON.stringify({
      username: (process.env.ADMIN_USERNAME || 'admin').trim(),
      password: (process.env.ADMIN_PASSWORD || '').trim(),
    });
    const loginRes = await timedHttpRequest(`${BACKEND_BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(loginPayload)) },
      body: loginPayload,
    });
    assert.strictEqual(loginRes.statusCode, 200);
    const token: string = JSON.parse(loginRes.body).token || JSON.parse(loginRes.body).data?.token || '';
    assert.ok(token.length > 20);
    console.log(`[PASS] 2/5 POST /api/admin/login (${loginRes.elapsedMs}ms)`);

    lastStep = 'GET /api/drive/config-check';
    const cfgRes = await timedHttpRequest(`${BACKEND_BASE_URL}/api/drive/config-check`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(cfgRes.statusCode, 200);
    const cfgJson = JSON.parse(cfgRes.body);
    assert.strictEqual(cfgJson.data?.googleVerification?.isAuthentic, true);
    assert.strictEqual(cfgJson.data?.redirectUri, 'http://localhost:5000/api/drive/oauth/callback');
    assert.strictEqual(cfgJson.data?.redirectUriRegistration?.status, 'registered', `Redirect URI not registered: ${cfgJson.data?.redirectUriRegistration?.detail}`);
    assert.ok(!cfgRes.body.includes('GOCSPX-'));
    console.log(
      `[PASS] 3/5 GET /api/drive/config-check (${cfgRes.elapsedMs}ms) -> credentials=${cfgJson.data?.googleVerification?.status}, redirectUri=${cfgJson.data?.redirectUriRegistration?.status}`
    );

    lastStep = 'GET /api/drive/auth/url';
    const authRes = await timedHttpRequest(
      `${BACKEND_BASE_URL}/api/drive/auth/url?origin=${encodeURIComponent(FRONTEND_ORIGIN)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    assert.strictEqual(authRes.statusCode, 200, `Expected 200 from /api/drive/auth/url, got ${authRes.statusCode}: ${authRes.body}`);
    const authUrl = new URL(JSON.parse(authRes.body).data?.authUrl);
    assert.strictEqual(authUrl.searchParams.get('redirect_uri'), 'http://localhost:5000/api/drive/oauth/callback');
    assert.strictEqual(authUrl.searchParams.get('access_type'), 'offline');
    assert.strictEqual(authUrl.searchParams.get('prompt'), 'select_account consent');
    assert.strictEqual(authUrl.searchParams.get('login_hint'), null);
    console.log(
      `[PASS] 4/5 GET /api/drive/auth/url (${authRes.elapsedMs}ms) -> redirect_uri=${authUrl.searchParams.get('redirect_uri')}, prompt="${authUrl.searchParams.get('prompt')}"`
    );

    lastStep = 'GET /api/drive/oauth/callback';
    const cbRes = await timedHttpRequest(`${BACKEND_BASE_URL}/api/drive/oauth/callback`);
    assert.strictEqual(cbRes.statusCode, 302);
    assert.ok(String(cbRes.headers.location || '').startsWith(`${FRONTEND_ORIGIN}/admin?gdrive_error=`));
    console.log(`[PASS] 5/5 GET /api/drive/oauth/callback (${cbRes.elapsedMs}ms) -> safe 302 redirect`);

    clearTimeout(watchdog);
    console.log(`[VerifyLocalOAuth] ALL 5 CHECKS PASSED in ${Date.now() - startedAt}ms.`);
    process.exit(0);
  } catch (err: any) {
    clearTimeout(watchdog);
    console.error(`[FAIL] Step "${lastStep}" failed: ${err?.message || err}`);
    process.exit(1);
  }
}

main();
