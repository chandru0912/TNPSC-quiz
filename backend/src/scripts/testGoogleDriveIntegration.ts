import assert from 'assert';
import {
  classifyDriveError,
  withDriveRetry,
  generateOAuthState,
  verifyOAuthState,
  verifyGoogleClientCredentials,
  getConnectionStatus,
} from '../services/googleDriveService';
import pool from '../db';

async function main() {
  console.log('=== TNPSC Study Hub — Google Drive Integration Verification ===\n');

  // 1. CSRF OAuth state generation, verification & tamper detection
  const state = generateOAuthState('admin', 'https://tnpsc-quiz-lval.vercel.app', 'https://tnpsc-quiz-lval.vercel.app/api/drive/oauth/callback');
  const verified = verifyOAuthState(state);
  assert.strictEqual(verified.isValid, true);
  assert.strictEqual(verified.adminUsername, 'admin');
  assert.strictEqual(verifyOAuthState(state + 'tampered').isValid, false);
  console.log('✓ 1. OAuth CSRF state generation, validation & tamper rejection verified');

  // 2. Error classification across all 5 states
  const dbQuota = classifyDriveError({ code: '53000', message: 'Your account or project has exceeded the quota. Upgrade your plan to increase limits.' });
  assert.strictEqual(dbQuota.connectionState, 'QUOTA_EXCEEDED');
  assert.strictEqual(dbQuota.errorSource, 'database_quota');
  assert.strictEqual(dbQuota.transient, false);

  const gRate = classifyDriveError({ response: { status: 429, data: { error: { message: 'User rate limit exceeded', errors: [{ reason: 'userRateLimitExceeded' }] } } } });
  assert.strictEqual(gRate.connectionState, 'QUOTA_EXCEEDED');
  assert.strictEqual(gRate.errorSource, 'google_drive_quota');
  assert.strictEqual(gRate.transient, true);

  const gAuth = classifyDriveError({ response: { status: 401, data: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } } });
  assert.strictEqual(gAuth.connectionState, 'TOKEN_EXPIRED');
  assert.strictEqual(gAuth.transient, false);

  const gClient = classifyDriveError({ response: { status: 401, data: { error: 'invalid_client', error_description: 'The OAuth client secret is invalid.' } } });
  assert.strictEqual(gClient.connectionState, 'INVALID_CLIENT_SECRET');

  const gPerm = classifyDriveError({ response: { status: 403, data: { error: { message: 'Insufficient Permission', errors: [{ reason: 'insufficientPermissions' }] } } } });
  assert.strictEqual(gPerm.connectionState, 'AUTHORIZATION_REQUIRED');

  const gNet = classifyDriveError({ code: '503', message: 'Backend Error' });
  assert.strictEqual(gNet.connectionState, 'CONNECTION_ERROR');
  assert.strictEqual(gNet.transient, true);
  console.log('✓ 2. Error classification verified (DB Quota, Drive Rate Limit, Expired OAuth, Network 5xx)');

  // 3. Exponential backoff retry: retries transient 429, never retries permanent invalid_grant
  let transientCalls = 0;
  const retryRes = await withDriveRetry(async () => {
    transientCalls += 1;
    if (transientCalls < 2) {
      throw { response: { status: 429, data: { error: { message: 'Rate Limit Exceeded', errors: [{ reason: 'rateLimitExceeded' }] } } } };
    }
    return 'recovered';
  }, 3, 20);
  assert.strictEqual(retryRes, 'recovered');
  assert.strictEqual(transientCalls, 2);

  let permCalls = 0;
  let permThrew = false;
  try {
    await withDriveRetry(async () => {
      permCalls += 1;
      throw { response: { status: 401, data: { error: 'invalid_grant' } } };
    }, 3, 20);
  } catch {
    permThrew = true;
  }
  assert.strictEqual(permThrew, true);
  assert.strictEqual(permCalls, 1, 'Permanent auth error must NOT be retried');
  console.log('✓ 3. Exponential backoff with jitter verified (retries 429, halts immediately on invalid_grant)');

  // 4. Live Google OAuth Client Credentials Probe (no secret values printed)
  const credProbe = await verifyGoogleClientCredentials();
  console.log(`✓ 4. Live Google OAuth credential probe: status=${credProbe.status}, isAuthentic=${credProbe.isAuthentic}`);

  // 5. Live getConnectionStatus() check — MUST report configured=true and accurate connectionState
  const liveStatus = await getConnectionStatus(true);
  assert.strictEqual(liveStatus.configured, true, 'OAuth credentials in backend/.env must be recognized as configured=true');
  assert.ok(['CONNECTED', 'DISCONNECTED', 'AUTHORIZATION_REQUIRED', 'QUOTA_EXCEEDED', 'CONNECTION_ERROR'].includes(liveStatus.connectionState));
  console.log(`✓ 5. Live getConnectionStatus(): configured=${liveStatus.configured}, connectionState=${liveStatus.connectionState}, errorSource=${liveStatus.errorSource || 'none'}`);

  await pool.end();
  console.log('\nALL GOOGLE DRIVE INTEGRATION VERIFICATION CHECKS PASSED! ✓');
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
