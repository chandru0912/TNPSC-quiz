import assert from 'node:assert/strict';
import 'dotenv/config';
import pool from '../db';
import {
  createDriveAuthorizationUrl,
  decryptTokenValue,
  disconnectDriveConnection,
  DRIVE_OAUTH_SCOPES,
  encryptTokenValue,
  ensureDriveOAuthSchema,
  getAuthenticatedDriveClient,
  getDriveConnectionSummary,
  getDriveSyncLogs,
  isAllowedAdminGoogleEmail,
  mapGoogleOAuthErrorToDiagnostic,
  resolveCanonicalRedirectUri,
  resolveSafeFrontendOrigin,
  syncDriveTextbooksMetadata,
  validateDriveOAuthConfig,
  verifySignedOAuthState,
} from '../services/driveOAuthService';
import { getGoogleOAuthPublicConfig } from '../services/googleAuthService';
import { requireDriveAdminAuth } from '../routes/drive';

async function main() {
  await ensureDriveOAuthSchema();

  console.log('=== Scenario 1 & 12: Localhost & Vercel Config Validation + Auth URL ===');
  const localCfg = validateDriveOAuthConfig('localhost:5000');
  assert.equal(localCfg.valid, true, `Local Drive OAuth config invalid: ${localCfg.errors.join(', ')}`);
  assert.equal(localCfg.redirectUri, 'http://localhost:5000/api/drive/oauth/callback');

  const { authUrl, redirectUri, state } = createDriveAuthorizationUrl({
    adminId: 1,
    adminUsername: 'admin',
    frontendOrigin: 'http://localhost:5173',
    reqHostHint: 'localhost:5000',
  });
  const parsed = new URL(authUrl);
  assert.equal(parsed.origin, 'https://accounts.google.com');
  assert.equal(redirectUri, 'http://localhost:5000/api/drive/oauth/callback');
  assert.equal(parsed.searchParams.get('redirect_uri'), 'http://localhost:5000/api/drive/oauth/callback');
  assert.equal(parsed.searchParams.get('access_type'), 'offline');
  assert.equal(parsed.searchParams.get('prompt'), 'select_account consent');
  assert.equal(parsed.searchParams.get('login_hint'), null);
  for (const scope of DRIVE_OAUTH_SCOPES) {
    assert.ok((parsed.searchParams.get('scope') || '').includes(scope), `Missing scope: ${scope}`);
  }

  // Verify Vercel / Production isolation (no localhost in production)
  const prevEnv = process.env.NODE_ENV;
  const prevVercel = process.env.VERCEL;
  try {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL = '1';
    const prodRedirect = resolveCanonicalRedirectUri('tnpsc-quiz-lval.vercel.app');
    assert.equal(prodRedirect, 'https://tnpsc-quiz-lval.vercel.app/api/drive/oauth/callback');
    assert.equal(prodRedirect.includes('localhost'), false);
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
  }

  // Verify open-redirect protection
  const maliciousOrigin = resolveSafeFrontendOrigin('https://evil.example.com');
  assert.equal(maliciousOrigin.includes('evil.example.com'), false);

  // Verify Student Google Login remains intact and separate
  const studentOAuth = getGoogleOAuthPublicConfig();
  assert.equal(studentOAuth.configured, true, 'Student Google Login must remain configured');
  console.log('PASS: Scenarios 1 & 12 verified.');

  console.log('\n=== Scenario 2: Unauthorized User Cannot Connect ===');
  let blockedStatus = 0;
  const mockReq: any = { headers: {}, query: {} };
  const mockRes: any = {
    status(code: number) {
      blockedStatus = code;
      return this;
    },
    json() {
      return this;
    },
  };
  let nextCalled = false;
  requireDriveAdminAuth(mockReq, mockRes, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false, 'Unauthenticated request must NOT pass requireDriveAdminAuth');
  assert.equal(blockedStatus, 401, 'Unauthorized user must receive 401');
  console.log('PASS: Scenario 2 verified.');

  console.log('\n=== Scenario 3: Incorrect / Tampered OAuth State Rejected ===');
  const validCheck = verifySignedOAuthState(state);
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.payload?.adminUsername, 'admin');
  const tampered = `${state.slice(0, -4)}beef`;
  assert.equal(verifySignedOAuthState(tampered).valid, false);
  assert.equal(verifySignedOAuthState('').valid, false);
  console.log('PASS: Scenario 3 verified.');

  console.log('\n=== Scenario 4: Invalid Redirect URI Diagnostic ===');
  const diag = mapGoogleOAuthErrorToDiagnostic('redirect_uri_mismatch', localCfg.redirectUri);
  assert.ok(diag.includes('http://localhost:5000/api/drive/oauth/callback'));
  const deniedDiag = mapGoogleOAuthErrorToDiagnostic('access_denied', localCfg.redirectUri);
  assert.ok(deniedDiag.includes('Test Users'));
  console.log('PASS: Scenario 4 verified.');

  console.log('\n=== Scenarios 5 & 6: Non-Approved Test User Denied vs Authorized Account Allowed ===');
  const prevAllowlist = process.env.GOOGLE_DRIVE_ALLOWED_EMAILS;
  try {
    process.env.GOOGLE_DRIVE_ALLOWED_EMAILS = 'approved-admin@gmail.com';
    assert.equal(isAllowedAdminGoogleEmail('unauthorized@gmail.com'), false);
    assert.equal(isAllowedAdminGoogleEmail('approved-admin@gmail.com'), true);
  } finally {
    if (prevAllowlist === undefined) delete process.env.GOOGLE_DRIVE_ALLOWED_EMAILS;
    else process.env.GOOGLE_DRIVE_ALLOWED_EMAILS = prevAllowlist;
  }
  console.log('PASS: Scenarios 5 & 6 verified.');

  console.log('\n=== Scenarios 7 & 8: AES-256-GCM Token Encryption, Expired Access Token Refresh & Revoked Refresh Token ===');
  const enc = encryptTokenValue('test_secret_refresh_token_value');
  assert.notEqual(enc.ciphertext, 'test_secret_refresh_token_value');
  assert.equal(decryptTokenValue(enc.ciphertext, enc.iv, enc.authTag), 'test_secret_refresh_token_value');

  // Insert a temporary expired connection into Neon DB, test refresh & revocation, then clean up
  const encRef = encryptTokenValue('mock_refresh_token');
  const encAcc = encryptTokenValue('mock_expired_access_token');
  const connIns = await pool.query(
    `INSERT INTO google_drive_connections (
       admin_id, admin_username, account_email, account_name,
       encrypted_refresh_token, refresh_token_iv, refresh_token_auth_tag,
       encrypted_access_token, access_token_iv, access_token_auth_tag,
       token_expiry, connection_status
     ) VALUES (1, 'test_admin', 'test-admin@example.com', 'Test Admin', $1,$2,$3,$4,$5,$6, 1000, 'CONNECTED')
     RETURNING id`,
    [encRef.ciphertext, encRef.iv, encRef.authTag, encAcc.ciphertext, encAcc.iv, encAcc.authTag]
  );
  const tempConnId = Number(connIns.rows[0].id);

  try {
    // Scenario 7: Expired access token automatically refreshes and persists new encrypted token
    const refreshed = await getAuthenticatedDriveClient({
      oauthClientFactory: () =>
        ({
          setCredentials() {},
          async refreshAccessToken() {
            return {
              credentials: {
                access_token: 'rotated_fresh_access_token',
                expiry_date: Date.now() + 3600 * 1000,
              },
            };
          },
        }) as any,
    });
    assert.ok(refreshed.client);
    const updatedRow = await pool.query(`SELECT encrypted_access_token, access_token_iv, access_token_auth_tag FROM google_drive_connections WHERE id = $1`, [tempConnId]);
    const decryptedNew = decryptTokenValue(
      updatedRow.rows[0].encrypted_access_token,
      updatedRow.rows[0].access_token_iv,
      updatedRow.rows[0].access_token_auth_tag
    );
    assert.equal(decryptedNew, 'rotated_fresh_access_token');

    // Scenario 8: Revoked refresh token transitions connection to REAUTHORIZATION_REQUIRED
    await pool.query(`UPDATE google_drive_connections SET token_expiry = 1000 WHERE id = $1`, [tempConnId]);
    let threwRevoked = false;
    try {
      await getAuthenticatedDriveClient({
        oauthClientFactory: () =>
          ({
            setCredentials() {},
            async refreshAccessToken() {
              throw new Error('invalid_grant: Token has been expired or revoked.');
            },
          }) as any,
      });
    } catch (e: any) {
      threwRevoked = true;
      assert.equal(e.uiStatus, 'REAUTHORIZATION_REQUIRED');
    }
    assert.equal(threwRevoked, true);
    const summaryAfterRevoke = await getDriveConnectionSummary('localhost:5000');
    assert.equal(summaryAfterRevoke.status, 'REAUTHORIZATION_REQUIRED');
    assert.equal(summaryAfterRevoke.connected, false);
    console.log('PASS: Scenarios 7 & 8 verified.');

    console.log('\n=== Scenarios 9 & 10: PDF Metadata Sync + Duplicate Prevention ===');
    const mockDriveId = `ci_test_pdf_${Date.now()}`;
    const mockPdf = {
      id: mockDriveId,
      name: '10th_Science_EM.pdf',
      mimeType: 'application/pdf',
      size: 5242880,
      modifiedTime: '2026-11-20T10:00:00.000Z',
      parentFolderId: 'folder_10th',
      folderSegments: ['TNPSC Study Hub Textbooks', '10th Standard', 'English Medium'],
    };

    try {
      const firstSync = await syncDriveTextbooksMetadata({
        adminId: 1,
        adminUsername: 'test_admin',
        discoveredPdfsOverride: [mockPdf, mockPdf], // duplicate in same scan
      });
      assert.equal(firstSync.status, 'SYNC_COMPLETED');
      assert.equal(firstSync.insertedCount, 1, 'Duplicate Drive file ID must only insert once');

      // Second sync with unchanged file must skip re-importing
      const secondSync = await syncDriveTextbooksMetadata({
        adminId: 1,
        adminUsername: 'test_admin',
        discoveredPdfsOverride: [mockPdf],
      });
      assert.equal(secondSync.insertedCount, 0);
      assert.equal(secondSync.unchangedCount, 1);

      const logs = await getDriveSyncLogs(5);
      assert.ok(logs.length >= 2);
      console.log('PASS: Scenarios 9 & 10 verified.');
    } finally {
      await pool.query(`DELETE FROM textbooks WHERE google_drive_file_id = $1`, [mockDriveId]);
      await pool.query(`DELETE FROM google_drive_textbook_sync_logs WHERE admin_username = 'test_admin'`);
    }

    console.log('\n=== Scenario 11: Disconnect Google Drive ===');
    const disc = await disconnectDriveConnection();
    assert.equal(disc.disconnected, true);
    const afterDisc = await getDriveConnectionSummary('localhost:5000');
    assert.equal(afterDisc.status, 'NOT_CONNECTED');
    assert.equal(afterDisc.connected, false);
    console.log('PASS: Scenario 11 verified.');
  } finally {
    await pool.query(`DELETE FROM google_drive_connections WHERE id = $1`, [tempConnId]);
  }

  await pool.end();
  console.log('\nALL 12 GOOGLE DRIVE OAUTH & SYNC SCENARIOS PASSED.');
}

main().catch((err) => {
  console.error('DRIVE OAUTH TEST FAILED:', err);
  process.exit(1);
});
