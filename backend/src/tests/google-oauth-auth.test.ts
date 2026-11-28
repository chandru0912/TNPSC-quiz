import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import 'dotenv/config';
import pool from '../db';
import studentRouter from '../routes/student';
import { isTrustedOrigin } from '../config/trustedOrigins';

async function runTests() {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  assert.ok(clientId, 'GOOGLE_CLIENT_ID must be configured in backend/.env');

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/student', studentRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  let ipCounter = 10;
  const nextIp = () => `10.99.0.${ipCounter++}`;

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const newGmail = `oauth_test_${suffix}@gmail.com`;
  const newNonGmail = `oauth_non_gmail_${suffix}@university.edu.in`;
  const newSub = `sub_gmail_${suffix}`;
  const nonGmailSub = `sub_edu_${suffix}`;
  const futureExp = Math.floor(Date.now() / 1000) + 3600;
  const pastExp = Math.floor(Date.now() / 1000) - 600;

  const origVerify = OAuth2Client.prototype.verifyIdToken;
  (OAuth2Client.prototype as any).verifyIdToken = async ({ idToken }: { idToken: string }) => {
    if (idToken === 'valid_new_gmail') {
      return {
        getPayload: () => ({
          iss: 'https://accounts.google.com',
          aud: clientId,
          exp: futureExp,
          sub: newSub,
          email: newGmail,
          email_verified: true,
          name: 'Karthik TNPSC',
          picture: 'https://lh3.googleusercontent.com/a/test=s96-c',
        }),
      };
    }
    if (idToken === 'valid_verified_non_gmail') {
      return {
        getPayload: () => ({
          iss: 'https://accounts.google.com',
          aud: clientId,
          exp: futureExp,
          sub: nonGmailSub,
          email: newNonGmail,
          email_verified: true,
          name: 'Anitha Scholar',
        }),
      };
    }
    if (idToken === 'unverified_email_token') {
      return {
        getPayload: () => ({
          iss: 'https://accounts.google.com',
          aud: clientId,
          exp: futureExp,
          sub: `sub_unv_${suffix}`,
          email: `unv_${suffix}@gmail.com`,
          email_verified: false,
          name: 'Unverified User',
        }),
      };
    }
    if (idToken === 'expired_token') {
      return {
        getPayload: () => ({
          iss: 'https://accounts.google.com',
          aud: clientId,
          exp: pastExp,
          sub: `sub_exp_${suffix}`,
          email: `exp_${suffix}@gmail.com`,
          email_verified: true,
          name: 'Expired User',
        }),
      };
    }
    if (idToken === 'wrong_audience_token') {
      return {
        getPayload: () => ({
          iss: 'https://accounts.google.com',
          aud: '000000000000-wrongclient.apps.googleusercontent.com',
          exp: futureExp,
          sub: `sub_aud_${suffix}`,
          email: `aud_${suffix}@gmail.com`,
          email_verified: true,
          name: 'Wrong Audience',
        }),
      };
    }
    throw new Error('Invalid token signature');
  };

  const createdIds: number[] = [];

  try {
    // 1. New verified Gmail account registration (from localhost origin)
    const r1 = await fetch(`${baseUrl}/api/student/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ idToken: 'valid_new_gmail' }),
    });
    const j1: any = await r1.json();
    assert.equal(r1.status, 201);
    assert.equal(j1.status, 'success');
    assert.equal(j1.isNewUser, true);
    assert.equal(j1.student.email, newGmail);
    assert.equal(j1.student.emailVerified, true);
    assert.ok(j1.token);
    createdIds.push(Number(j1.student.id));
    console.log('PASS 1: New verified Gmail account registration (localhost origin)');

    // 1b. New verified non-Gmail Google account registration (previously rejected by UNTRUSTED_EMAIL_DOMAIN!)
    const r1b = await fetch(`${baseUrl}/api/student/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://tnpsc-quiz-lval.vercel.app' },
      body: JSON.stringify({ idToken: 'valid_verified_non_gmail' }),
    });
    const j1b: any = await r1b.json();
    assert.equal(r1b.status, 201);
    assert.equal(j1b.student.email, newNonGmail);
    createdIds.push(Number(j1b.student.id));
    console.log('PASS 2: Verified non-Gmail Google account accepted (Vercel production origin)');

    // Update profile preference to verify preservation on re-login
    await pool.query(`UPDATE students SET target_group = 'group1', district = 'Chennai' WHERE id = $1`, [j1.student.id]);

    // 3. Existing verified Google account login + duplicate prevention + profile preservation
    const r2 = await fetch(`${baseUrl}/api/student/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ idToken: 'valid_new_gmail' }),
    });
    const j2: any = await r2.json();
    assert.equal(r2.status, 200);
    assert.equal(j2.isNewUser, false);
    assert.equal(j2.student.id, j1.student.id);
    assert.equal(j2.student.targetGroup, 'group1');
    assert.equal(j2.student.district, 'Chennai');
    const dupCheck = await pool.query(`SELECT COUNT(*)::int AS cnt FROM students WHERE google_id = $1`, [newSub]);
    assert.equal(Number(dupCheck.rows[0].cnt), 1);
    console.log('PASS 3: Existing account login, duplicate prevention, and profile preservation');

    // 4. Unverified Google account rejection
    const r3 = await fetch(`${baseUrl}/api/student/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'unverified_email_token' }),
    });
    const j3: any = await r3.json();
    assert.equal(r3.status, 403);
    assert.equal(j3.code, 'EMAIL_NOT_VERIFIED');
    console.log('PASS 4: Unverified email_verified=false rejected (403 EMAIL_NOT_VERIFIED)');

    // 5. Invalid credential rejection
    const r4 = await fetch(`${baseUrl}/api/student/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'corrupted_invalid_token' }),
    });
    const j4: any = await r4.json();
    assert.equal(r4.status, 401);
    assert.equal(j4.code, 'INVALID_ID_TOKEN');
    console.log('PASS 5: Invalid credential rejected (401 INVALID_ID_TOKEN)');

    // 6. Expired credential rejection
    const r5 = await fetch(`${baseUrl}/api/student/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': nextIp() },
      body: JSON.stringify({ idToken: 'expired_token' }),
    });
    const j5: any = await r5.json();
    assert.equal(r5.status, 401);
    assert.equal(j5.code, 'TOKEN_EXPIRED');
    console.log('PASS 6: Expired credential rejected (401 TOKEN_EXPIRED)');

    // 7. Audience / Client ID mismatch rejection
    const r6 = await fetch(`${baseUrl}/api/student/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': nextIp() },
      body: JSON.stringify({ idToken: 'wrong_audience_token' }),
    });
    const j6: any = await r6.json();
    assert.equal(r6.status, 401);
    assert.equal(j6.code, 'INVALID_AUDIENCE');
    console.log('PASS 7: OAuth Client ID audience mismatch rejected (401 INVALID_AUDIENCE)');

    // 8. Untrusted CORS / CSRF origin rejection
    const r7 = await fetch(`${baseUrl}/api/student/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil-phishing.example.com', 'X-Forwarded-For': nextIp() },
      body: JSON.stringify({ idToken: 'valid_new_gmail' }),
    });
    const j7: any = await r7.json();
    assert.equal(r7.status, 403);
    assert.equal(j7.code, 'CSRF_ORIGIN_MISMATCH');
    assert.equal(isTrustedOrigin('http://localhost:5173'), true);
    assert.equal(isTrustedOrigin('https://tnpsc-quiz-lval.vercel.app'), true);
    assert.equal(isTrustedOrigin('https://evil-phishing.example.com'), false);
    assert.equal(isTrustedOrigin('*'), false);
    console.log('PASS 8: Trusted localhost/Vercel origins accepted, untrusted & wildcard rejected');

    // 9. Logout and subsequent re-login
    const logoutRes = await fetch(`${baseUrl}/api/student/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${j2.token}`, 'X-Forwarded-For': nextIp() },
    });
    assert.equal(logoutRes.status, 200);
    const rReLogin = await fetch(`${baseUrl}/api/student/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', 'X-Forwarded-For': nextIp() },
      body: JSON.stringify({ idToken: 'valid_new_gmail' }),
    });
    const jReLogin: any = await rReLogin.json();
    assert.equal(rReLogin.status, 200);
    assert.ok(jReLogin.token && jReLogin.token !== j2.token);
    console.log('PASS 9: Logout revokes session and subsequent Google login succeeds');

    console.log('\nALL GOOGLE OAUTH & CORS REGRESSION TESTS PASSED.');
  } finally {
    OAuth2Client.prototype.verifyIdToken = origVerify;
    server.close();
    if (createdIds.length > 0) {
      await pool.query(`DELETE FROM student_auth_sessions WHERE student_id = ANY($1::int[])`, [createdIds]);
      await pool.query(`DELETE FROM student_login_events WHERE student_id = ANY($1::int[])`, [createdIds]);
      await pool.query(`DELETE FROM student_login_users WHERE student_user_id = ANY($1::int[])`, [createdIds]).catch(() => {});
      await pool.query(`DELETE FROM student_activity WHERE student_id = ANY($1::int[])`, [createdIds]);
      await pool.query(`DELETE FROM students WHERE id = ANY($1::int[])`, [createdIds]);
    }
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('OAUTH TEST FAILED:', err);
    process.exit(1);
  });
