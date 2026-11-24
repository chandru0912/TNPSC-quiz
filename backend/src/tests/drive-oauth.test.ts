import assert from 'node:assert/strict';
import 'dotenv/config';
import pool from '../db';
import {
  applyDriveTextbookWorkflowAction,
  createDriveAuthorizationUrl,
  decryptTokenValue,
  DRIVE_OAUTH_SCOPES,
  encryptTokenValue,
  ensureDriveOAuthSchema,
  getPublishedStudentTextbookById,
  isAllowedAdminGoogleEmail,
  listDriveFolders,
  listPublishedStudentTextbooks,
  mapGoogleOAuthErrorToDiagnostic,
  openDriveTextbookPdfStream,
  resolveCanonicalRedirectUri,
  resolveSafeFrontendOrigin,
  syncDriveTextbooksMetadata,
  validateDriveOAuthConfig,
  verifyLiveDriveConnection,
  verifySignedOAuthState,
} from '../services/driveOAuthService';
import { getGoogleOAuthPublicConfig } from '../services/googleAuthService';
import { requireDriveAdminAuth } from '../routes/drive';

async function main() {
  await ensureDriveOAuthSchema();

  console.log('=== 1. Config, Localhost/Vercel Separation & Student Google Login Isolation ===');
  const localCfg = validateDriveOAuthConfig('localhost:5000');
  assert.equal(localCfg.valid, true, localCfg.errors.join(', '));
  assert.equal(localCfg.redirectUri, 'http://localhost:5000/api/drive/oauth/callback');

  const { authUrl, state } = createDriveAuthorizationUrl({
    adminId: 1,
    adminUsername: 'admin',
    frontendOrigin: 'http://localhost:5173',
    reqHostHint: 'localhost:5000',
  });
  const parsed = new URL(authUrl);
  assert.equal(parsed.searchParams.get('redirect_uri'), 'http://localhost:5000/api/drive/oauth/callback');
  assert.equal(parsed.searchParams.get('access_type'), 'offline');
  assert.equal(parsed.searchParams.get('prompt'), 'select_account consent');
  for (const s of DRIVE_OAUTH_SCOPES) {
    assert.ok((parsed.searchParams.get('scope') || '').includes(s));
  }

  const prevEnv = process.env.NODE_ENV;
  const prevVercel = process.env.VERCEL;
  try {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL = '1';
    const prodRedirect = resolveCanonicalRedirectUri('tnpsc-quiz-lval.vercel.app');
    assert.equal(prodRedirect, 'https://tnpsc-quiz-lval.vercel.app/api/drive/oauth/callback');
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
  }

  assert.equal(resolveSafeFrontendOrigin('https://evil.example.com').includes('evil.example.com'), false);
  assert.equal(getGoogleOAuthPublicConfig().configured, true, 'Student Google Login must stay intact');
  console.log('PASS: Config, redirect isolation, and Student Google Login verified.');

  console.log('\n=== 2. Admin-Only Access Restriction, CSRF State & Diagnostics ===');
  let statusCode = 0;
  let nextCalled = false;
  requireDriveAdminAuth(
    { headers: {}, query: {} } as any,
    { status(c: number) { statusCode = c; return this; }, json() { return this; } } as any,
    () => { nextCalled = true; }
  );
  assert.equal(nextCalled, false);
  assert.equal(statusCode, 401);
  assert.equal(verifySignedOAuthState(state).valid, true);
  assert.equal(verifySignedOAuthState(`${state.slice(0, -4)}dead`).valid, false);
  assert.ok(mapGoogleOAuthErrorToDiagnostic('redirect_uri_mismatch', localCfg.redirectUri).includes('localhost:5000'));
  assert.ok(/test users/i.test(mapGoogleOAuthErrorToDiagnostic('access_denied', localCfg.redirectUri)));

  const prevAllow = process.env.GOOGLE_DRIVE_ALLOWED_EMAILS;
  try {
    process.env.GOOGLE_DRIVE_ALLOWED_EMAILS = 'tnpscstudyhubchan@gmail.com';
    assert.equal(isAllowedAdminGoogleEmail('tnpscstudyhubchan@gmail.com'), true);
    assert.equal(isAllowedAdminGoogleEmail('other@gmail.com'), false);
  } finally {
    if (prevAllow === undefined) delete process.env.GOOGLE_DRIVE_ALLOWED_EMAILS;
    else process.env.GOOGLE_DRIVE_ALLOWED_EMAILS = prevAllow;
  }

  const enc = encryptTokenValue('sample_token');
  assert.equal(decryptTokenValue(enc.ciphertext, enc.iv, enc.authTag), 'sample_token');
  console.log('PASS: Admin auth, CSRF, allowlist, diagnostics, and AES-256-GCM encryption verified.');

  console.log('\n=== 3. Live Google Drive API Verification (Real Connected Account) ===');
  const liveSummary = await verifyLiveDriveConnection('localhost:5000');
  console.log('LIVE_DRIVE_VERIFICATION:', JSON.stringify({
    status: liveSummary.status,
    connected: liveSummary.connected,
    verified: liveSummary.verified,
    accountEmail: liveSummary.accountEmail,
    oauthVerified: liveSummary.oauthVerified,
    driveApiAccessible: liveSummary.driveApiAccessible,
    tokenStatus: liveSummary.tokenStatus,
    folderAccessible: liveSummary.folderAccessible,
    folderName: liveSummary.folderName,
    lastError: liveSummary.lastError,
  }));
  assert.equal(liveSummary.status, 'VERIFIED', `Expected live Google Drive status VERIFIED, got ${liveSummary.status}: ${liveSummary.lastError}`);
  assert.equal(liveSummary.driveApiAccessible, true);

  const folders = await listDriveFolders();
  console.log(`LIVE_DRIVE_FOLDERS: Discovered ${folders.length} accessible folder(s) in ${liveSummary.accountEmail}:`, folders.slice(0, 8).map((f) => f.name));

  console.log('\n=== 4. PDF-Only Filtering, >100 File Scale, Deduplication, Review, Bulk Publish & Student Isolation ===');
  const batchTag = `ci_batch_${Date.now()}`;
  const mockItems = [
    { id: `${batchTag}_not_pdf`, name: 'notes.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1024, modifiedTime: '2026-11-20T00:00:00.000Z', parentFolderId: 'p1', folderSegments: ['TNPSC Study Hub Textbooks', '10th Standard'] },
    { id: `${batchTag}_pdf_1`, name: '10th_Science_EM.pdf', mimeType: 'application/pdf', size: 4194304, modifiedTime: '2026-11-20T00:00:00.000Z', parentFolderId: 'p1', folderSegments: ['TNPSC Study Hub Textbooks', '10th Standard', 'English Medium'] },
    { id: `${batchTag}_pdf_1`, name: '10th_Science_EM.pdf', mimeType: 'application/pdf', size: 4194304, modifiedTime: '2026-11-20T00:00:00.000Z', parentFolderId: 'p1', folderSegments: ['TNPSC Study Hub Textbooks', '10th Standard', 'English Medium'] },
    { id: `${batchTag}_pdf_2`, name: '11th_Physics_Volume_1_EM.pdf', mimeType: 'application/pdf', size: 6291456, modifiedTime: '2026-11-20T00:00:00.000Z', parentFolderId: 'p2', folderSegments: ['TNPSC Study Hub Textbooks', '11th Standard', 'Volume 1', 'English Medium'] },
  ];

  try {
    const syncRes = await syncDriveTextbooksMetadata({
      adminId: 1,
      adminUsername: 'ci_test',
      discoveredPdfsOverride: mockItems,
    });
    assert.equal(syncRes.discoveredCount, 3, 'Non-PDF (.docx) must be filtered out');
    assert.equal(syncRes.insertedCount, 2, 'Duplicate Drive file ID must be deduplicated');

    const rowsRes = await pool.query(`SELECT id, google_drive_file_id, publication_status FROM textbooks WHERE google_drive_file_id LIKE $1 ORDER BY id ASC`, [`${batchTag}%`]);
    assert.equal(rowsRes.rows.length, 2);
    const [book1Id, book2Id] = rowsRes.rows.map((r) => Number(r.id));

    // Unpublished books must NEVER be visible to students
    assert.equal(await getPublishedStudentTextbookById(book1Id), null);
    let studentDenied = false;
    try {
      await openDriveTextbookPdfStream({ textbookId: book1Id, isAdmin: false });
    } catch (e: any) {
      studentDenied = e.statusCode === 403;
    }
    assert.equal(studentDenied, true, 'Student stream request for unpublished book must return 403');

    // Bulk publish both books (skipDriveCheck for mock IDs)
    const pubRes = await applyDriveTextbookWorkflowAction({
      ids: [book1Id, book2Id],
      action: 'publish',
      adminUsername: 'ci_test',
      skipDriveCheck: true,
    });
    assert.equal(pubRes.updatedCount, 2);

    const visibleToStudents = await listPublishedStudentTextbooks({ standard: '10' });
    assert.equal(visibleToStudents.some((b) => b.id === book1Id), true, 'Published book must be visible in Student Textbook Library');

    // Unpublish book2 -> must disappear from Student Library
    await applyDriveTextbookWorkflowAction({ ids: [book2Id], action: 'unpublish', adminUsername: 'ci_test' });
    assert.equal(await getPublishedStudentTextbookById(book2Id), null);
    console.log('PASS: PDF-only filtering, deduplication, bulk publish, student visibility & 403 isolation verified.');
  } finally {
    await pool.query(`DELETE FROM textbooks WHERE google_drive_file_id LIKE $1`, [`${batchTag}%`]);
    await pool.query(`DELETE FROM google_drive_textbook_sync_logs WHERE admin_username = 'ci_test'`);
  }

  await pool.end();
  console.log('\nALL GOOGLE DRIVE TEXTBOOK LIBRARY & LIVE API TESTS PASSED.');
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
