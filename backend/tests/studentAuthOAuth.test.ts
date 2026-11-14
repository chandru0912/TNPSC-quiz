/**
 * studentAuthOAuth.test.ts
 *
 * Integration test suite covering all 10 authentication & security scenarios
 * against Express routes, auth middleware, and PostgreSQL.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import assert from 'assert';
import express from 'express';
import http from 'http';
import { google } from 'googleapis';
import pool from '../src/db';
import { ensureDatabaseSchema } from '../src/migrate';
import studentRouter from '../src/routes/student';
import authRouter from '../src/routes/auth';
import { requireAdminAuth, verifyAdminToken } from '../src/middleware/auth';

async function runTests() {
  await ensureDatabaseSchema();

  const app = express();
  app.use(express.json());
  app.use('/api/student', studentRouter);
  app.use('/api/admin', authRouter);
  app.get('/api/admin/protected-probe', requireAdminAuth, (_req, res) => {
    res.json({ status: 'success', ok: true });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const googleNewEmail = `test_oauth_new_${suffix}@example.com`;
  const emailUserEmail = `test_email_user_${suffix}@example.com`;
  const unverifiedEmail = `test_unverified_${suffix}@example.com`;

  // Mock Google OAuth2 verifyIdToken specifically for controlled deterministic unit/integration tests
  const originalVerifyIdToken = google.auth.OAuth2.prototype.verifyIdToken;
  (google.auth.OAuth2.prototype as any).verifyIdToken = async ({ idToken }: { idToken: string }) => {
    if (idToken === 'mock_google_new_token') {
      return {
        getPayload: () => ({
          sub: `google_sub_new_${suffix}`,
          email: googleNewEmail,
          email_verified: true,
          name: 'Arun Kumar',
          picture: 'https://lh3.googleusercontent.com/a/test-avatar',
        }),
      };
    }
    if (idToken === 'mock_google_existing_link_token') {
      return {
        getPayload: () => ({
          sub: `google_sub_linked_${suffix}`,
          email: emailUserEmail,
          email_verified: true,
          name: 'Priya Email User',
          picture: 'https://lh3.googleusercontent.com/a/linked-avatar',
        }),
      };
    }
    if (idToken === 'mock_google_unverified_token') {
      return {
        getPayload: () => ({
          sub: `google_sub_unverified_${suffix}`,
          email: emailUserEmail,
          email_verified: false,
          name: 'Unverified Attacker',
        }),
      };
    }
    if (idToken === 'mock_google_hijack_token') {
      return {
        getPayload: () => ({
          sub: `google_sub_different_${suffix}`,
          email: emailUserEmail,
          email_verified: true,
          name: 'Different Google Sub',
        }),
      };
    }
    throw new Error('Invalid test token');
  };

  try {
    // 1. Google OAuth Public Config endpoint
    const cfgRes = await fetch(`${baseUrl}/api/student/auth/google/config`);
    const cfgJson: any = await cfgRes.json();
    assert.strictEqual(cfgRes.status, 200);
    assert.strictEqual(cfgJson.status, 'success');
    assert.ok(cfgJson.clientId, 'GOOGLE_CLIENT_ID must be returned as public config');
    assert.strictEqual((cfgJson as any).clientSecret, undefined, 'Client secret must never be exposed');
    console.log('PASS 0: Google public config check');

    // 2. Test New User Registration via Google OAuth
    const gRegRes = await fetch(`${baseUrl}/api/student/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock_google_new_token' }),
    });
    const gRegJson: any = await gRegRes.json();
    assert.strictEqual(gRegRes.status, 201, `Expected 201 for new Google user, got ${gRegRes.status}: ${gRegJson.message}`);
    assert.strictEqual(gRegJson.isNewUser, true);
    assert.strictEqual(gRegJson.student.email, googleNewEmail);
    assert.strictEqual(gRegJson.student.fullName, 'Arun Kumar');
    assert.strictEqual(gRegJson.student.authProvider, 'google');
    assert.strictEqual(gRegJson.student.emailVerified, true);
    assert.strictEqual(gRegJson.student.onboardingCompleted, false);
    assert.strictEqual(gRegJson.student.role, 'student');
    assert.ok(gRegJson.token);
    console.log('PASS 1: New user auto-registration via Google OAuth');

    // Update target group via onboarding PUT /api/student/profile
    const onbRes = await fetch(`${baseUrl}/api/student/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gRegJson.token}`,
      },
      body: JSON.stringify({ targetGroup: 'group2a', onboardingCompleted: true }),
    });
    const onbJson: any = await onbRes.json();
    assert.strictEqual(onbRes.status, 200);
    assert.strictEqual(onbJson.student.targetGroup, 'group2a');
    assert.strictEqual(onbJson.student.onboardingCompleted, true);
    console.log('PASS 1B: Post-Google Target Exam Group onboarding update');

    // 3. Test Existing User Login via Google OAuth (no duplicate created)
    const gLoginRes = await fetch(`${baseUrl}/api/student/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock_google_new_token' }),
    });
    const gLoginJson: any = await gLoginRes.json();
    assert.strictEqual(gLoginRes.status, 200);
    assert.strictEqual(gLoginJson.isNewUser, false);
    assert.strictEqual(gLoginJson.student.id, gRegJson.student.id);
    assert.strictEqual(gLoginJson.student.targetGroup, 'group2a');
    console.log('PASS 2: Existing Google user login preserves account and preferences');

    // 4. Test Email & Password Registration
    const eRegRes = await fetch(`${baseUrl}/api/student/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Priya Student',
        email: emailUserEmail,
        password: 'password123',
        confirmPassword: 'password123',
        targetGroup: 'group1',
        role: 'super_admin', // Attempt privilege escalation — must be ignored!
      }),
    });
    const eRegJson: any = await eRegRes.json();
    assert.strictEqual(eRegRes.status, 201);
    assert.strictEqual(eRegJson.student.role, 'student', 'Registration must ignore client role and enforce student');
    assert.strictEqual(eRegJson.student.targetGroup, 'group1');
    console.log('PASS 3: Email & password registration + privilege escalation block');

    // 5. Test Duplicate Email Prevention
    const dupRes = await fetch(`${baseUrl}/api/student/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Duplicate User',
        email: emailUserEmail.toUpperCase(),
        password: 'password456',
        confirmPassword: 'password456',
        targetGroup: 'group4',
      }),
    });
    const dupJson: any = await dupRes.json();
    assert.strictEqual(dupRes.status, 409);
    assert.strictEqual(dupJson.code, 'EMAIL_EXISTS');
    console.log('PASS 4: Duplicate email registration rejected cleanly (409)');

    // 6. Test Email & Password Login + Unverified Google Link Rejection + Secure Verified Link
    const eLoginRes = await fetch(`${baseUrl}/api/student/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailUserEmail, password: 'password123' }),
    });
    const eLoginJson: any = await eLoginRes.json();
    assert.strictEqual(eLoginRes.status, 200);
    assert.strictEqual(eLoginJson.student.id, eRegJson.student.id);
    console.log('PASS 5: Email & password login');

    // Unverified Google email must NEVER link to existing email/password account
    const unvRes = await fetch(`${baseUrl}/api/student/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock_google_unverified_token' }),
    });
    assert.strictEqual(unvRes.status, 403, 'Unverified Google email must be rejected with 403');
    console.log('PASS 6A: Unverified Google email refused account linking');

    // Verified Google email securely links to existing email/password account
    const linkRes = await fetch(`${baseUrl}/api/student/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock_google_existing_link_token' }),
    });
    const linkJson: any = await linkRes.json();
    assert.strictEqual(linkRes.status, 200);
    assert.strictEqual(linkJson.linkedAccount, true);
    assert.strictEqual(linkJson.student.id, eRegJson.student.id);
    assert.strictEqual(linkJson.student.authProvider, 'both');
    console.log('PASS 6B: Verified Google email securely linked to existing account (provider=both)');

    // Mismatched google_id for already-linked email must be rejected
    const hijackRes = await fetch(`${baseUrl}/api/student/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock_google_hijack_token' }),
    });
    assert.strictEqual(hijackRes.status, 409);
    console.log('PASS 6C: Different Google sub for already-linked email blocked with 409');

    // 7. Test Password Reset Flow
    const forgotRes = await fetch(`${baseUrl}/api/student/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailUserEmail }),
    });
    const forgotJson: any = await forgotRes.json();
    assert.strictEqual(forgotRes.status, 200);
    assert.ok(forgotJson.devResetCode, 'Expected devResetCode in test environment');

    const resetRes = await fetch(`${baseUrl}/api/student/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailUserEmail,
        resetCode: forgotJson.devResetCode,
        newPassword: 'newpassword789',
        confirmPassword: 'newpassword789',
      }),
    });
    assert.strictEqual(resetRes.status, 200);

    const newLoginRes = await fetch(`${baseUrl}/api/student/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailUserEmail, password: 'newpassword789' }),
    });
    const newLoginJson: any = await newLoginRes.json();
    assert.strictEqual(newLoginRes.status, 200);
    console.log('PASS 7: Password reset flow verified end-to-end');

    // 8. Session persistence + Logout revocation
    const profBefore = await fetch(`${baseUrl}/api/student/profile`, {
      headers: { Authorization: `Bearer ${newLoginJson.token}` },
    });
    assert.strictEqual(profBefore.status, 200);

    const logoutRes = await fetch(`${baseUrl}/api/student/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newLoginJson.token}` },
    });
    assert.strictEqual(logoutRes.status, 200);

    const profAfter = await fetch(`${baseUrl}/api/student/profile`, {
      headers: { Authorization: `Bearer ${newLoginJson.token}` },
    });
    assert.strictEqual(profAfter.status, 401, 'Logged-out token must be invalidated by server');
    console.log('PASS 8: Session validation & server-side logout revocation');

    // 9. Student vs Administrator Role Protection
    assert.strictEqual(verifyAdminToken(gLoginJson.token), null, 'Student JWT must never validate as Admin JWT');
    const adminProbeRes = await fetch(`${baseUrl}/api/admin/protected-probe`, {
      headers: { Authorization: `Bearer ${gLoginJson.token}` },
    });
    assert.strictEqual(adminProbeRes.status, 403, 'Student JWT must be blocked from Admin endpoints with 403');
    console.log('PASS 9: Student & Administrator role isolation verified');

    console.log('ALL STUDENT AUTH & GOOGLE OAUTH INTEGRATION TESTS PASSED!');
  } finally {
    (google.auth.OAuth2.prototype as any).verifyIdToken = originalVerifyIdToken;
    await pool.query('DELETE FROM students WHERE email IN ($1, $2, $3)', [
      googleNewEmail,
      emailUserEmail,
      unverifiedEmail,
    ]);
    await pool.end();
    server.close();
  }
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
