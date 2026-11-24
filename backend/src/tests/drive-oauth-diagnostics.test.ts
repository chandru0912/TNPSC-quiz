import assert from 'assert';
import {
  DRIVE_OAUTH_SCOPES,
  validateDriveOAuthConfig,
  resolveCanonicalRedirectUri,
  createDriveAuthorizationUrl,
  extractGoogleProjectNumber,
  diagnoseDriveOAuthError,
  mapGoogleOAuthErrorToDiagnostic,
  runDriveOAuthDiagnostics,
} from '../services/driveOAuthService';

async function run() {
  console.log('=== Google Drive OAuth 403 / Diagnostics Verification ===');

  // 1. Minimal least-privilege read-only Drive scopes
  const scopeList: readonly string[] = DRIVE_OAUTH_SCOPES;
  assert.ok(scopeList.includes('https://www.googleapis.com/auth/drive.readonly'));
  assert.ok(!scopeList.includes('https://www.googleapis.com/auth/drive'), 'Full write/delete drive scope must not be requested');

  const cfg = validateDriveOAuthConfig();
  assert.strictEqual(cfg.valid, true, `OAuth config errors: ${cfg.errors.join('; ')}`);
  assert.strictEqual(cfg.redirectUri, 'http://localhost:5000/api/drive/oauth/callback');
  assert.strictEqual(resolveCanonicalRedirectUri('localhost:5000'), 'http://localhost:5000/api/drive/oauth/callback');

  const { authUrl } = createDriveAuthorizationUrl({
    adminId: 1,
    adminUsername: 'admin',
    frontendOrigin: 'http://localhost:5173',
    reqHostHint: 'localhost:5000',
  });
  const parsed = new URL(authUrl);
  assert.strictEqual(parsed.searchParams.get('client_id'), cfg.clientId);
  assert.strictEqual(parsed.searchParams.get('redirect_uri'), 'http://localhost:5000/api/drive/oauth/callback');
  assert.strictEqual(parsed.searchParams.get('access_type'), 'offline');
  assert.strictEqual(parsed.searchParams.get('prompt'), 'select_account consent');
  assert.strictEqual(parsed.searchParams.get('login_hint'), null);
  console.log('PASS 1: Minimal scopes, canonical redirect URI, offline access, select_account consent');

  // 2. Google Cloud Project number extracted from active OAuth client
  const projectNum = extractGoogleProjectNumber(cfg.clientId);
  assert.ok(projectNum && /^\d+$/.test(projectNum), 'Expected numeric Google Cloud project prefix');
  console.log(`PASS 2: Active Google Cloud Project number = ${projectNum}`);

  // 3. 4-way OAuth error diagnosis
  const dTestUser = diagnoseDriveOAuthError('access_denied', cfg.redirectUri);
  assert.strictEqual(dTestUser.category, 'unapproved_test_user');
  assert.ok(dTestUser.message.includes('Test users'));
  assert.ok(mapGoogleOAuthErrorToDiagnostic('access_denied', cfg.redirectUri).includes('Test users'));

  assert.strictEqual(diagnoseDriveOAuthError('invalid_client', cfg.redirectUri).category, 'incorrect_oauth_client');
  assert.strictEqual(diagnoseDriveOAuthError('invalid_scope', cfg.redirectUri).category, 'invalid_scope');
  assert.strictEqual(diagnoseDriveOAuthError('redirect_uri_mismatch', cfg.redirectUri).category, 'redirect_uri_mismatch');
  console.log('PASS 3: 4-way failure diagnostics (unapproved_test_user, incorrect_oauth_client, invalid_scope, redirect_uri_mismatch)');

  // 4. Live read-only diagnostics against Google endpoints (no login, no DB writes)
  const live = await runDriveOAuthDiagnostics('localhost:5000');
  assert.strictEqual(live.clientCredentialsStatus, 'valid_client_credentials', `Unexpected credential status: ${live.clientCredentialsStatus}`);
  assert.strictEqual(live.redirectUriStatus, 'registered', `Unexpected redirect URI status: ${live.redirectUriStatus}`);
  assert.strictEqual(live.scopeValid, true);
  assert.strictEqual(live.diagnosedBlocker, 'none');
  assert.strictEqual(live.adminOnlyDriveAccess, true);
  console.log(
    `PASS 4: Live diagnostics -> project=${live.googleCloudProjectNumber}, client=${live.clientCredentialsStatus}, redirectUri=${live.redirectUriStatus}, blocker=${live.diagnosedBlocker}`
  );

  console.log('=== ALL OAUTH 403 DIAGNOSTICS TESTS PASSED ===');
}

run().catch((err) => {
  console.error('TEST FAILED:', err?.message || err);
  process.exit(1);
});
