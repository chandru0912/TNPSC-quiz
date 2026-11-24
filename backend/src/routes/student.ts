import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../db';
import { broadcastAnalyticsEvent } from '../services/analyticsEventBus';
import { AnalyticsService } from '../services/analyticsService';
import {
  detectTamilNaduDistrict,
  normalizeTamilNaduDistrict,
} from '../services/tamilNaduDistrictService';
import { StudyManagementService } from '../services/studyManagementService';
import {
  generateStudentToken,
  verifyStudentToken,
  requireStudentAuth,
  optionalStudentAuth,
  requireAdminAuth,
  hashStudentPassword,
  verifyStudentPassword,
  StudentAuthenticatedRequest,
} from '../middleware/auth';
import {
  createSingleActiveStudentSession,
  revokeStudentSessionOnLogout,
  validateActiveStudentSession,
  studentSessionEventBus,
} from '../services/studentSessionService';
import {
  studentLoginLimiter,
  otpVerificationLimiter,
} from '../middleware/rateLimiter';
import {
  getGoogleOAuthPublicConfig,
  verifyGoogleCredentialOrCode,
  normalizeGoogleAvatarUrl,
  GoogleAuthError,
} from '../services/googleAuthService';
import {
  getStudentDashboardData,
  getPlatformStats,
  notifyStudentDashboardUpdate,
  notifyPlatformContentUpdate,
  subscribeStudentDashboardUpdates,
  formatRelativeTime,
} from '../services/studentDashboardService';
import {
  submitAssessmentAttempt,
  getStudentMarkList,
  getStudentScorecardDetail,
  getAdminAssessmentAnalytics,
} from '../services/markListService';
import { getStudentPerformanceAnalytics } from '../services/performanceAnalyticsService';
import { getStudentProgressTrackerData } from '../services/progressTrackerService';
import {
  getGradeBoundaries,
  updateGradeBoundaries,
} from '../services/gradeService';
import {
  getPublishedStudentTextbookById,
  getPublishedStudentTextbookFilters,
  openDriveTextbookPdfStream,
  queryPublishedStudentTextbooksPaginated,
} from '../services/driveOAuthService';
import {
  getAwardSettings,
  updateAwardSettings,
  resetAwardSettingsToDefault,
  getStudentAwardsDashboardSummary,
  getAdminAwardHistory,
} from '../services/awardService';
import {
  getStudentSyllabusProgress,
  getLessonAttemptHistory,
  getMockTestProgressSummary,
  getAdminSyllabusProgressOverview,
} from '../services/syllabusProgressService';

const router = Router();

function setStudentSessionCookie(res: Response, sessionId: string, expiresAt: Date) {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAgeSec = Math.max(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const parts = [
    `tnpsc_student_sid=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearStudentSessionCookie(res: Response) {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = ['tnpsc_student_sid=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

const ALLOWED_TARGET_GROUPS = new Set(['group1', 'group2', 'group2a', 'group4']);

function normalizeTargetGroup(group?: unknown): string {
  if (typeof group !== 'string') return 'group4';
  const clean = group.trim().toLowerCase();
  return ALLOWED_TARGET_GROUPS.has(clean) ? clean : 'group4';
}

function formatStudentResponse(row: any) {
  return {
    id: row.id,
    fullName: String(row.full_name || '').trim() || String(row.email || '').split('@')[0] || 'Student',
    email: row.email,
    mobile: row.mobile ?? null,
    targetGroup: row.target_group || 'group4',
    avatarUrl: normalizeGoogleAvatarUrl(row.avatar_url),
    authProvider: row.auth_provider || 'email',
    emailVerified: Boolean(row.email_verified),
    onboardingCompleted: row.onboarding_completed !== false,
    role: 'student' as const,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

// ====================================================
// 0. GOOGLE OAUTH PUBLIC CONFIG & EMAIL DISCOVERY
// ====================================================
router.get('/auth/google/config', (_req: Request, res: Response) => {
  const config = getGoogleOAuthPublicConfig();
  return res.status(200).json({
    status: 'success',
    clientId: config.clientId,
    configured: config.configured,
  });
});

router.post('/auth/check-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ status: 'error', message: 'Please enter a valid email address.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const existing = await pool.query(
      `SELECT id, auth_provider, (password_hash IS NOT NULL AND password_hash <> '') AS has_password, is_active
       FROM students
       WHERE LOWER(email) = $1`,
      [cleanEmail]
    );

    if (existing.rows.length === 0) {
      return res.status(200).json({
        status: 'success',
        exists: false,
      });
    }

    const row = existing.rows[0];
    return res.status(200).json({
      status: 'success',
      exists: true,
      authProvider: row.auth_provider || 'email',
      hasPassword: Boolean(row.has_password),
      isActive: row.is_active !== false,
    });
  } catch (err: any) {
    console.error('[Check Email Error]:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to check email status.' });
  }
});

// ====================================================
// 0B. GOOGLE OAUTH LOGIN / AUTO-REGISTER / ACCOUNT LINKING
// ====================================================
router.post('/auth/google', studentLoginLimiter, async (req: Request, res: Response) => {
  try {
    const { code, idToken, redirectUri } = req.body || {};

    if (!code && !idToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Google authorization code or token is required.',
      });
    }

    const googleProfile = await verifyGoogleCredentialOrCode({ code, idToken, redirectUri });

    if (!googleProfile.emailVerified || !googleProfile.email) {
      return res.status(403).json({
        status: 'error',
        message: 'Your Google email address is not verified and cannot be used for sign-in or account linking.',
      });
    }

    const client = await pool.connect();
    let studentRow: any;
    let isNewUser = false;
    let linkedAccount = false;

    try {
      await client.query('BEGIN');

      // 1. Check existing user by verified Google Account ID (sub)
      const byGoogleId = await client.query(
        `SELECT id, full_name, email, mobile, password_hash, target_group, google_id, auth_provider,
                avatar_url, email_verified, onboarding_completed, role, is_active, token_version, created_at, updated_at
         FROM students
         WHERE google_id = $1`,
        [googleProfile.googleId]
      );

      if (byGoogleId.rows.length > 0) {
        const existing = byGoogleId.rows[0];
        if (existing.is_active === false) {
          await client.query('ROLLBACK');
          return res.status(403).json({
            status: 'error',
            message: 'This student account has been deactivated. Please contact an administrator.',
          });
        }

        const updated = await client.query(
          `UPDATE students
           SET avatar_url = COALESCE(NULLIF(TRIM($1), ''), avatar_url),
               full_name = COALESCE(NULLIF(TRIM($2), ''), full_name),
               email_verified = true,
               role = 'student',
               last_login_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3
           RETURNING id, full_name, email, mobile, target_group, google_id, auth_provider,
                     avatar_url, email_verified, onboarding_completed, role, token_version, created_at, updated_at`,
          [googleProfile.avatarUrl, googleProfile.fullName, existing.id]
        );
        studentRow = updated.rows[0];

        await client.query(
          `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
           VALUES ($1, 'google_login', $2, 'Logged In with Google', $3::jsonb)`,
          [studentRow.id, String(studentRow.id), JSON.stringify({ provider: 'google', time: new Date().toISOString() })]
        );
      } else {
        // 2. Check existing user by verified email to prevent duplicates and link securely
        const byEmail = await client.query(
          `SELECT id, full_name, email, mobile, password_hash, target_group, google_id, auth_provider,
                  avatar_url, email_verified, onboarding_completed, role, is_active, token_version, created_at, updated_at
           FROM students
           WHERE LOWER(email) = $1`,
          [googleProfile.email]
        );

        if (byEmail.rows.length > 0) {
          const existing = byEmail.rows[0];
          if (existing.is_active === false) {
            await client.query('ROLLBACK');
            return res.status(403).json({
              status: 'error',
              message: 'This student account has been deactivated. Please contact an administrator.',
            });
          }

          if (existing.google_id && existing.google_id !== googleProfile.googleId) {
            await client.query('ROLLBACK');
            return res.status(409).json({
              status: 'error',
              message: 'This email address is already linked to a different Google account.',
            });
          }

          const hasPassword = Boolean(existing.password_hash && String(existing.password_hash).trim().length > 0);
          const nextProvider = hasPassword ? 'both' : 'google';

          const linked = await client.query(
            `UPDATE students
             SET google_id = $1,
                 auth_provider = $2,
                 avatar_url = COALESCE(NULLIF(TRIM($3), ''), avatar_url),
                 full_name = COALESCE(NULLIF(TRIM($4), ''), full_name),
                 email_verified = true,
                 role = 'student',
                 last_login_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5
             RETURNING id, full_name, email, mobile, target_group, google_id, auth_provider,
                       avatar_url, email_verified, onboarding_completed, role, token_version, created_at, updated_at`,
            [googleProfile.googleId, nextProvider, googleProfile.avatarUrl, googleProfile.fullName, existing.id]
          );
          studentRow = linked.rows[0];
          linkedAccount = true;

          await client.query(
            `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
             VALUES ($1, 'google_account_linked', $2, 'Google Account Linked', $3::jsonb)`,
            [studentRow.id, String(studentRow.id), JSON.stringify({ provider: nextProvider, time: new Date().toISOString() })]
          );
        } else {
          // 3. Auto-register brand-new student account from verified Google profile (strictly role = 'student')
          const inserted = await client.query(
            `INSERT INTO students (
               full_name, email, mobile, password_hash, target_group,
               google_id, auth_provider, avatar_url, email_verified, onboarding_completed, role, token_version, last_login_at
             )
             VALUES ($1, $2, NULL, NULL, 'group4', $3, 'google', $4, true, false, 'student', 1, CURRENT_TIMESTAMP)
             RETURNING id, full_name, email, mobile, target_group, google_id, auth_provider,
                       avatar_url, email_verified, onboarding_completed, role, token_version, created_at, updated_at`,
            [googleProfile.fullName, googleProfile.email, googleProfile.googleId, googleProfile.avatarUrl]
          );
          studentRow = inserted.rows[0];
          isNewUser = true;

          await client.query(
            `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
             VALUES ($1, 'account_created', $2, 'Account Created via Google', $3::jsonb)`,
            [studentRow.id, String(studentRow.id), JSON.stringify({ authProvider: 'google', targetGroup: 'group4' })]
          );
        }
      }

      // Record genuine successful Google OAuth student login event (never Admin, never failed attempts)
      const normalizedGoogleEmail = String(studentRow.email || '').trim().toLowerCase();
      const googleLoginEventId = `login_google_${studentRow.id}_${crypto.randomUUID()}`;
      await client.query(
        `INSERT INTO student_login_events (
          event_id, student_id, student_email_snapshot, authentication_method, login_status, login_timestamp
        ) VALUES ($1, $2, $3, 'Google OAuth', 'Successful', CURRENT_TIMESTAMP)
        ON CONFLICT (event_id) DO NOTHING`,
        [googleLoginEventId, studentRow.id, normalizedGoogleEmail]
      );

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // Enforce Single Active Device Session (atomically revokes any previous device)
    const activeSession = await createSingleActiveStudentSession({
      studentId: Number(studentRow.id),
      authMethod: 'google',
      userAgent: req.headers['user-agent'] || null,
    });

    const token = generateStudentToken(
      studentRow.id,
      studentRow.email,
      studentRow.full_name,
      studentRow.target_group || 'group4',
      false,
      activeSession.tokenVersion,
      activeSession.sessionId,
      activeSession.expiresAt.getTime()
    );
    setStudentSessionCookie(res, activeSession.sessionId, activeSession.expiresAt);

    await AnalyticsService.touchStudentLiveSession(Number(studentRow.id)).catch(() => {});
    if (isNewUser) {
      broadcastAnalyticsEvent('student_registered', {
        studentId: studentRow.id,
        provider: 'google',
      });
    }

    return res.status(isNewUser ? 201 : 200).json({
      status: 'success',
      message: isNewUser
        ? 'Account created successfully with Google.'
        : linkedAccount
          ? 'Google account securely linked to your existing TNPSC Study Hub account.'
          : 'Logged in successfully with Google.',
      token,
      isNewUser,
      linkedAccount,
      student: formatStudentResponse(studentRow),
    });
  } catch (err: any) {
    if (err instanceof GoogleAuthError) {
      return res.status(err.statusCode).json({
        status: 'error',
        code: err.code,
        message: err.message,
      });
    }
    console.error('[Student Google Auth Error]:', err);
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Google authentication failed.',
    });
  }
});

// ====================================================
// 1. STUDENT AUTHENTICATION: REGISTER
// ====================================================
router.post('/register', studentLoginLimiter, async (req: Request, res: Response) => {
  try {
    const { fullName, email, mobile, password, confirmPassword, targetGroup } = req.body;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ status: 'error', message: 'Full name is required.' });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ status: 'error', message: 'A valid email address is required.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters long.' });
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ status: 'error', message: 'Passwords do not match.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanMobile = mobile ? String(mobile).trim() : null;
    const cleanGroup = normalizeTargetGroup(targetGroup);

    // Check if email already exists
    const existing = await pool.query('SELECT id, auth_provider FROM students WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      const provider = existing.rows[0].auth_provider;
      const msg =
        provider === 'google'
          ? 'An account with this email already exists via Google Sign-In. Please click "Continue with Google" or use Forgot Password to set a password.'
          : 'An account with this email address already exists. Please log in.';
      return res.status(409).json({
        status: 'error',
        code: 'EMAIL_EXISTS',
        message: msg,
      });
    }

    // Cryptographic password hash
    const passwordHash = hashStudentPassword(password);

    const insertResult = await pool.query(
      `INSERT INTO students (
         full_name, email, mobile, password_hash, target_group,
         auth_provider, email_verified, onboarding_completed, role, token_version, last_login_at
       )
       VALUES ($1, $2, $3, $4, $5, 'email', false, true, 'student', 1, CURRENT_TIMESTAMP)
       RETURNING id, full_name, email, mobile, target_group, avatar_url, auth_provider,
                 email_verified, onboarding_completed, role, token_version, created_at, updated_at`,
      [cleanName, cleanEmail, cleanMobile, passwordHash, cleanGroup]
    );

    const newStudent = insertResult.rows[0];

    // Log account creation activity
    await pool.query(
      `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
       VALUES ($1, 'account_created', $2, 'Account Created', $3::jsonb)`,
      [newStudent.id, String(newStudent.id), JSON.stringify({ targetGroup: cleanGroup, authProvider: 'email' })]
    );

    // Enforce Single Active Device Session
    const activeSession = await createSingleActiveStudentSession({
      studentId: Number(newStudent.id),
      authMethod: 'register',
      userAgent: req.headers['user-agent'] || null,
    });

    // Generate JWT token bound to active session
    const token = generateStudentToken(
      newStudent.id,
      newStudent.email,
      newStudent.full_name,
      newStudent.target_group,
      false,
      activeSession.tokenVersion,
      activeSession.sessionId,
      activeSession.expiresAt.getTime()
    );
    setStudentSessionCookie(res, activeSession.sessionId, activeSession.expiresAt);

    broadcastAnalyticsEvent('student_registered', { studentId: newStudent.id });

    return res.status(201).json({
      status: 'success',
      message: 'Student account registered successfully.',
      token,
      student: formatStudentResponse(newStudent),
    });
  } catch (err: any) {
    console.error('[Student Register Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Registration failed.' });
  }
});

// ====================================================
// 2. STUDENT AUTHENTICATION: LOGIN
// ====================================================
router.post('/login', studentLoginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Email and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const studentRes = await pool.query(
      `SELECT id, full_name, email, mobile, password_hash, target_group, google_id, auth_provider,
              avatar_url, email_verified, onboarding_completed, role, is_active, token_version, created_at, updated_at
       FROM students
       WHERE LOWER(email) = $1`,
      [cleanEmail]
    );

    if (studentRes.rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Invalid email address or password.' });
    }

    const student = studentRes.rows[0];

    if (student.is_active === false) {
      return res.status(403).json({
        status: 'error',
        message: 'This student account has been deactivated. Please contact an administrator.',
      });
    }

    if (!student.password_hash) {
      return res.status(401).json({
        status: 'error',
        code: 'GOOGLE_ONLY_ACCOUNT',
        message: 'This account uses Google Sign-In. Please click "Continue with Google" or use "Forgot Password?" to create a password.',
      });
    }

    const isMatch = verifyStudentPassword(password, student.password_hash);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email address or password.' });
    }

    // Log login activity
    await pool.query(
      `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
       VALUES ($1, 'login', $2, 'Logged In', $3::jsonb)`,
      [student.id, String(student.id), JSON.stringify({ provider: 'email', time: new Date().toISOString() })]
    );

    // Record genuine successful Email & Password student login event (idempotent, never Admin, never failed attempts)
    const normalizedEmail = String(student.email || cleanEmail).trim().toLowerCase();
    const emailLoginEventId = `login_email_${student.id}_${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO student_login_events (
        event_id, student_id, student_email_snapshot, authentication_method, login_status, login_timestamp
      ) VALUES ($1, $2, $3, 'Email & Password', 'Successful', CURRENT_TIMESTAMP)
      ON CONFLICT (event_id) DO NOTHING`,
      [emailLoginEventId, student.id, normalizedEmail]
    );

    // Enforce Single Active Device Session (atomically revokes previous device & increments token_version)
    const activeSession = await createSingleActiveStudentSession({
      studentId: Number(student.id),
      authMethod: 'email',
      userAgent: req.headers['user-agent'] || null,
    });

    // Generate JWT token bound to the single active session
    const token = generateStudentToken(
      student.id,
      student.email,
      student.full_name,
      student.target_group || 'group4',
      false,
      activeSession.tokenVersion,
      activeSession.sessionId,
      activeSession.expiresAt.getTime()
    );
    setStudentSessionCookie(res, activeSession.sessionId, activeSession.expiresAt);

    await AnalyticsService.touchStudentLiveSession(Number(student.id)).catch(() => {});
    await AnalyticsService.recordGenuineLoginEvent(Number(student.id), 'email').catch(() => {});

    return res.status(200).json({
      status: 'success',
      message: 'Login successful.',
      token,
      student: formatStudentResponse(student),
    });
  } catch (err: any) {
    console.error('[Student Login Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Login failed.' });
  }
});

// ====================================================
// 2A. ONE-TIME CONSENT-BASED LOGIN DISTRICT RECORDING
// ====================================================
router.post('/login-location', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    if (req.studentUser?.isPreview) {
      return res.status(200).json({ status: 'success', data: { skippedPreview: true } });
    }

    const {
      loginEventId,
      source = 'unavailable',
      latitude,
      longitude,
      accuracyMeters,
      manualDistrict,
      permissionStatus,
    } = req.body || {};

    const cleanEventId = String(loginEventId || '').trim().slice(0, 120);
    if (!cleanEventId) {
      return res.status(400).json({
        status: 'error',
        message: 'A valid loginEventId is required for idempotent location recording.',
      });
    }

    let districtId: string | null = null;
    let districtName: string | null = null;
    let locationStatus: string = 'unavailable';
    let locationSource: 'gps' | 'manual' | 'unavailable' = 'unavailable';
    let accuracyCategory: string | null = null;

    if (source === 'gps' && latitude !== undefined && longitude !== undefined) {
      const detected = detectTamilNaduDistrict(
        Number(latitude),
        Number(longitude),
        accuracyMeters !== undefined && accuracyMeters !== null ? Number(accuracyMeters) : null
      );
      districtId = detected.districtId;
      districtName = detected.districtName;
      locationStatus = detected.locationStatus;
      locationSource = 'gps';
      accuracyCategory = detected.accuracyCategory;
    } else if (source === 'manual' && manualDistrict) {
      const normalized = normalizeTamilNaduDistrict(String(manualDistrict));
      if (!normalized) {
        return res.status(400).json({
          status: 'error',
          message: 'Please select a valid Tamil Nadu district.',
        });
      }
      districtId = normalized.id;
      districtName = normalized.name;
      locationStatus = 'manual';
      locationSource = 'manual';
      accuracyCategory = null;
    } else {
      locationStatus = permissionStatus === 'denied' ? 'denied' : 'unavailable';
      locationSource = 'unavailable';
    }

    // Idempotent insert: never creates duplicates on browser refresh or retries; never stores raw lat/lng
    const insertRes = await pool.query(
      `INSERT INTO student_login_locations (
         login_event_id, student_id, district_id, district_name,
         location_status, location_source, accuracy_category, login_timestamp
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (login_event_id) DO NOTHING
       RETURNING id`,
      [
        cleanEventId,
        studentId,
        districtId,
        districtName,
        locationStatus,
        locationSource,
        accuracyCategory,
      ]
    );

    const inserted = insertRes.rows.length > 0;

    // Safely update student's confirmed district ONLY when detected with sufficient confidence or manually selected
    if (districtName && (locationStatus === 'detected' || locationStatus === 'manual')) {
      await pool.query(
        `UPDATE students SET district = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [districtName, studentId]
      );
    }

    if (inserted) {
      broadcastAnalyticsEvent('student_login', {
        studentId,
        districtId,
        districtName,
        locationStatus,
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        recorded: inserted,
        duplicate: !inserted,
        districtId,
        districtName,
        locationStatus,
        locationSource,
        accuracyCategory,
      },
    });
  } catch (err: any) {
    console.error('[Student Login Location Error]:', err);
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to record login district.',
    });
  }
});

// ====================================================
// 2B-SSE. REAL-TIME STUDENT SESSION STREAM (Instant Revocation Push)
// ====================================================
router.get('/session-stream', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  const token = headerToken || queryToken;

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Missing student token.' });
  }

  const verified = verifyStudentToken(token);
  if (!verified || verified.isPreview || !verified.sessionId) {
    return res.status(401).json({ status: 'error', message: 'Invalid student session stream token.' });
  }

  const check = await validateActiveStudentSession(verified.studentId, verified.sessionId);
  if (!check.valid) {
    return res.status(401).json({
      status: 'error',
      code: check.code || 'SESSION_REVOKED_OTHER_DEVICE',
      message: check.message,
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const clientId = studentSessionEventBus.addClient(verified.studentId, verified.sessionId, res);
  req.on('close', () => {
    studentSessionEventBus.removeClient(clientId);
  });
});

// ====================================================
// 2B. LOGOUT (SERVER-SIDE SESSION REVOCATION)
// ====================================================
router.post('/logout', optionalStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    clearStudentSessionCookie(res);
    const user = req.studentUser;
    if (user && !user.isPreview && user.studentId) {
      await revokeStudentSessionOnLogout(Number(user.studentId), user.sessionId).catch(() => {});
      await AnalyticsService.endStudentLiveSessions(Number(user.studentId)).catch(() => {});
      broadcastAnalyticsEvent('student_logout', { studentId: user.studentId });
      await pool.query(
        'UPDATE students SET token_version = COALESCE(token_version, 1) + 1 WHERE id = $1',
        [user.studentId]
      );
      await pool.query(
        `UPDATE study_sessions
         SET is_active = false, ended_at = CURRENT_TIMESTAMP
         WHERE student_id = $1 AND is_active = true`,
        [user.studentId]
      );
      await pool.query(
        `UPDATE visitor_sessions
         SET is_active = false, ended_at = CURRENT_TIMESTAMP
         WHERE student_id = $1 AND is_active = true`,
        [user.studentId]
      );
      await pool.query(
        `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
         VALUES ($1, 'logout', $2, 'Logged Out', $3::jsonb)`,
        [user.studentId, String(user.studentId), JSON.stringify({ time: new Date().toISOString() })]
      );
    }
    return res.status(200).json({
      status: 'success',
      message: 'Logged out successfully.',
    });
  } catch (err: any) {
    console.error('[Student Logout Error]:', err);
    return res.status(200).json({
      status: 'success',
      message: 'Session ended.',
    });
  }
});

// ====================================================
// 2C. FORGOT PASSWORD & RESET PASSWORD
// ====================================================
router.post('/forgot-password', otpVerificationLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ status: 'error', message: 'Please enter a valid email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const studentRes = await pool.query(
      'SELECT id, full_name, email, is_active FROM students WHERE LOWER(email) = $1',
      [cleanEmail]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No student account found with this email address.',
      });
    }

    const student = studentRes.rows[0];
    if (student.is_active === false) {
      return res.status(403).json({
        status: 'error',
        message: 'This student account has been deactivated. Please contact an administrator.',
      });
    }

    const resetCode = String(crypto.randomInt(100000, 1000000));
    const tokenHash = hashResetToken(resetCode);

    // Invalidate any prior unused reset codes
    await pool.query(
      'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE student_id = $1 AND used_at IS NULL',
      [student.id]
    );

    await pool.query(
      `INSERT INTO password_reset_tokens (student_id, token_hash, expires_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '15 minutes')`,
      [student.id, tokenHash]
    );

    const allowPreview =
      process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_RESET_PREVIEW === 'true';

    console.info(`[Password Reset] Generated 15-min reset code for ${cleanEmail}${allowPreview ? `: ${resetCode}` : ''}`);

    return res.status(200).json({
      status: 'success',
      message: allowPreview
        ? 'A 6-digit password reset code has been generated (valid for 15 minutes).'
        : 'Password reset instructions have been processed for your account.',
      expiresInMinutes: 15,
      ...(allowPreview ? { devResetCode: resetCode } : {}),
    });
  } catch (err: any) {
    console.error('[Forgot Password Error]:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to process password reset request.' });
  }
});

router.post('/reset-password', otpVerificationLimiter, async (req: Request, res: Response) => {
  try {
    const { email, resetCode, token, newPassword, confirmPassword } = req.body || {};
    const rawCode = String(resetCode || token || '').trim();

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ status: 'error', message: 'A valid email address is required.' });
    }
    if (!rawCode) {
      return res.status(400).json({ status: 'error', message: 'Reset code is required.' });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ status: 'error', message: 'New password must be at least 6 characters long.' });
    }
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ status: 'error', message: 'Passwords do not match.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const studentRes = await pool.query(
      'SELECT id, google_id, is_active FROM students WHERE LOWER(email) = $1',
      [cleanEmail]
    );
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Account not found.' });
    }

    const student = studentRes.rows[0];
    if (student.is_active === false) {
      return res.status(403).json({ status: 'error', message: 'This account has been deactivated.' });
    }

    const candidateHash = hashResetToken(rawCode);
    const tokenRes = await pool.query(
      `SELECT id, token_hash, expires_at
       FROM password_reset_tokens
       WHERE student_id = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC
       LIMIT 1`,
      [student.id]
    );

    if (tokenRes.rows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Reset code is invalid or has expired. Please request a new reset code.',
      });
    }

    const storedRow = tokenRes.rows[0];
    const candBuf = Buffer.from(candidateHash, 'hex');
    const storedBuf = Buffer.from(storedRow.token_hash, 'hex');
    if (candBuf.length !== storedBuf.length || !crypto.timingSafeEqual(candBuf, storedBuf)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid reset code. Please check and try again.',
      });
    }

    const passwordHash = hashStudentPassword(newPassword);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE students
         SET password_hash = $1,
             auth_provider = CASE WHEN google_id IS NOT NULL THEN 'both' ELSE 'email' END,
             token_version = COALESCE(token_version, 1) + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [passwordHash, student.id]
      );
      await client.query(
        'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1',
        [storedRow.id]
      );
      await client.query(
        `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
         VALUES ($1, 'password_reset', $2, 'Password Reset', $3::jsonb)`,
        [student.id, String(student.id), JSON.stringify({ time: new Date().toISOString() })]
      );
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    return res.status(200).json({
      status: 'success',
      message: 'Your password has been reset successfully. You can now log in with your new password.',
    });
  } catch (err: any) {
    console.error('[Reset Password Error]:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to reset password.' });
  }
});

// ====================================================
// 3. STUDENT PROFILE (GET & UPDATE)
// ====================================================
router.get('/profile', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const studentRes = await pool.query(
      `SELECT id, full_name, email, mobile, target_group, avatar_url, auth_provider,
              email_verified, onboarding_completed, role, created_at, updated_at
       FROM students
       WHERE id = $1`,
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Student profile not found.' });
    }

    return res.status(200).json({
      status: 'success',
      student: formatStudentResponse(studentRes.rows[0]),
    });
  } catch (err: any) {
    console.error('[Student Profile Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch profile.' });
  }
});

router.put('/profile', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const { fullName, mobile, targetGroup, onboardingCompleted } = req.body;

    // Read-only server guard: never alter student database records during admin preview mode
    if (req.studentUser?.isPreview) {
      return res.status(200).json({
        status: 'success',
        message: 'Profile update simulated in Student Preview Mode (Read-only simulation).',
        student: {
          id: studentId,
          fullName: fullName?.trim() || req.studentUser.fullName,
          email: req.studentUser.email,
          mobile: mobile !== undefined ? (mobile ? String(mobile).trim() : null) : null,
          targetGroup: targetGroup ? normalizeTargetGroup(targetGroup) : req.studentUser.targetGroup,
          onboardingCompleted: true,
          role: 'student',
          updatedAt: new Date().toISOString(),
        },
      });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let pIdx = 1;

    if (fullName && typeof fullName === 'string' && fullName.trim()) {
      updates.push(`full_name = $${pIdx++}`);
      values.push(fullName.trim());
    }
    if (mobile !== undefined) {
      updates.push(`mobile = $${pIdx++}`);
      values.push(mobile ? String(mobile).trim() : null);
    }
    if (targetGroup && typeof targetGroup === 'string' && targetGroup.trim()) {
      updates.push(`target_group = $${pIdx++}`);
      values.push(normalizeTargetGroup(targetGroup));
    }
    if (typeof onboardingCompleted === 'boolean') {
      updates.push(`onboarding_completed = $${pIdx++}`);
      values.push(onboardingCompleted);
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No valid update fields provided.' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(studentId);

    const updateQuery = `
      UPDATE students
      SET ${updates.join(', ')}
      WHERE id = $${pIdx}
      RETURNING id, full_name, email, mobile, target_group, avatar_url, auth_provider,
                email_verified, onboarding_completed, role, created_at, updated_at
    `;

    const result = await pool.query(updateQuery, values);
    const updated = result.rows[0];

    return res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully.',
      student: formatStudentResponse(updated),
    });
  } catch (err: any) {
    console.error('[Student Profile Update Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to update profile.' });
  }
});

// ====================================================
// 4. REAL-TIME STUDENT DASHBOARD STATISTICS & SSE STREAM
// ====================================================
router.get('/platform-stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getPlatformStats();
    return res.status(200).json({ status: 'success', data: stats });
  } catch (err: any) {
    console.error('[Platform Stats Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load platform stats.' });
  }
});

router.get('/mock-tests', async (_req: Request, res: Response) => {
  try {
    const { getPublishedMockTestsForStudent } = await import('../services/mockTestService.js');
    const data = await getPublishedMockTestsForStudent();
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Mock Tests List Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load mock tests.' });
  }
});

router.patch('/admin/mock-tests/:id/publish', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const testId = Number(req.params.id);
    const { status } = req.body || {};
    if (!Number.isInteger(testId) || testId <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid mock test ID is required.' });
    }
    const cleanStatus = ['published', 'staging', 'archived'].includes(status) ? status : 'published';
    const result = await pool.query(
      `UPDATE mock_tests SET status = $1 WHERE id = $2 RETURNING id, slug, title, status`,
      [cleanStatus, testId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Mock test not found.' });
    }
    notifyPlatformContentUpdate();
    return res.status(200).json({ status: 'success', data: result.rows[0] });
  } catch (err: any) {
    console.error('[Mock Test Publish Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to update mock test status.' });
  }
});

router.get('/dashboard', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const data = await getStudentDashboardData(studentId);
    if (!data) {
      return res.status(404).json({ status: 'error', message: 'Student account not found.' });
    }
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Student Dashboard Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load dashboard statistics.' });
  }
});

router.get('/dashboard/stream', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  const studentId = req.studentUser!.studentId;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  let closed = false;
  let debounceTimer: NodeJS.Timeout | null = null;

  const pushSnapshot = async () => {
    if (closed) return;
    try {
      const data = await getStudentDashboardData(studentId);
      if (data && !closed) {
        res.write(`event: dashboard\ndata: ${JSON.stringify({ status: 'success', data })}\n\n`);
      }
    } catch (err) {
      console.warn('[Dashboard SSE Push Error]:', (err as any)?.message || err);
    }
  };

  await pushSnapshot();

  const unsubscribe = subscribeStudentDashboardUpdates(studentId, () => {
    if (closed) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      pushSnapshot();
    }, 350);
  });

  const keepAliveInterval = setInterval(() => {
    if (!closed) {
      res.write(': keepalive\n\n');
    }
  }, 20_000);

  req.on('close', () => {
    closed = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    clearInterval(keepAliveInterval);
    unsubscribe();
  });
});

// ====================================================
// 5. ACTIVE STUDY SESSION & HEARTBEAT TRACKING
// ====================================================
router.post('/study-session/heartbeat', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const { sessionToken, pagePath, deltaSeconds } = req.body;

    // Read-only server guard: never alter student database records during admin preview mode
    if (req.studentUser?.isPreview) {
      return res.status(200).json({
        status: 'success',
        message: 'Preview mode: session heartbeat acknowledged (read-only, no database write).',
        durationSeconds: 0,
      });
    }

    if (!sessionToken || typeof sessionToken !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Session token is required.' });
    }

    // Safety clamp: each heartbeat ping is max 35 seconds to prevent artificial inflation
    const rawDelta = typeof deltaSeconds === 'number' ? Math.floor(deltaSeconds) : 30;
    const cleanDelta = Math.max(1, Math.min(35, rawDelta));
    const cleanPath = pagePath && typeof pagePath === 'string' ? pagePath.slice(0, 255) : '/dashboard';

    // 1. Upsert active study session
    const sessionRes = await pool.query(
      `INSERT INTO study_sessions (student_id, session_token, page_path, duration_seconds, started_at, last_heartbeat, is_active)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, TRUE)
       ON CONFLICT (student_id, session_token) DO UPDATE
       SET duration_seconds = study_sessions.duration_seconds + $4,
           page_path = $3,
           last_heartbeat = CURRENT_TIMESTAMP,
           is_active = TRUE
       RETURNING id, duration_seconds`,
      [studentId, sessionToken, cleanPath, cleanDelta]
    );

    // 2. Update daily streak study time for today in Asia/Kolkata
    await pool.query(
      `INSERT INTO daily_streaks (student_id, activity_date, study_seconds)
       VALUES ($1, timezone('Asia/Kolkata', CURRENT_TIMESTAMP)::date, $2)
       ON CONFLICT (student_id, activity_date)
       DO UPDATE SET study_seconds = daily_streaks.study_seconds + $2`,
      [studentId, cleanDelta]
    );

    notifyStudentDashboardUpdate(studentId);

    return res.status(200).json({
      status: 'success',
      durationSeconds: sessionRes.rows[0]?.duration_seconds || 0,
    });
  } catch (err: any) {
    console.error('[Study Session Heartbeat Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Heartbeat recording failed.' });
  }
});

// ====================================================
// 6. RECORD QUESTION ATTEMPT
// ====================================================
router.post('/question-attempt', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;

    // Read-only server guard: never alter student database records during admin preview mode
    if (req.studentUser?.isPreview) {
      return res.status(200).json({
        status: 'success',
        message: 'Preview mode: question attempt simulated (read-only, no database write).',
      });
    }

    const {
      questionId,
      category,
      subject,
      classId,
      unitId,
      lessonId,
      lessonTitle,
      topic,
      selectedOption,
      correctAnswer,
      isCorrect,
      sourceSystem,
      timeSpentSeconds,
    } = req.body;

    if (selectedOption === undefined || correctAnswer === undefined || isCorrect === undefined) {
      return res.status(400).json({ status: 'error', message: 'Missing required question attempt fields.' });
    }

    const cleanQuestionId = typeof questionId === 'number' ? questionId : null;
    const cleanIsCorrect = Boolean(isCorrect);
    const cleanSource = sourceSystem || 'mcq_practice';
    const cleanTime = typeof timeSpentSeconds === 'number' ? Math.max(0, timeSpentSeconds) : 0;

    // Duplicate-submission guard: prevent accidental double-clicks/replays within 10s
    if (cleanQuestionId) {
      const dupCheck = await pool.query(
        `SELECT id FROM question_attempts
         WHERE student_id = $1
           AND question_id = $2
           AND source_system = $3
           AND selected_option = $4
           AND attempted_at >= (CURRENT_TIMESTAMP - INTERVAL '10 seconds')
         LIMIT 1`,
        [studentId, cleanQuestionId, cleanSource, Number(selectedOption)]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(200).json({ status: 'success', duplicate: true });
      }
    }

    // 1. Insert question attempt record
    await pool.query(
      `INSERT INTO question_attempts (
         student_id, question_id, category, subject, class_id, unit_id, lesson_id, lesson_title, topic,
         selected_option, correct_answer, is_correct, source_system, time_spent_seconds, attempted_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)`,
      [
        studentId,
        cleanQuestionId,
        category || 'group4',
        subject || 'General Studies',
        classId ? Number(classId) : null,
        unitId ? Number(unitId) : null,
        lessonId ? String(lessonId) : null,
        lessonTitle || 'General Practice',
        topic || null,
        Number(selectedOption),
        Number(correctAnswer),
        cleanIsCorrect,
        cleanSource,
        cleanTime,
      ]
    );

    // 2. Update daily streak (increment question count)
    await pool.query(
      `INSERT INTO daily_streaks (student_id, activity_date, questions_count)
       VALUES ($1, timezone('Asia/Kolkata', CURRENT_TIMESTAMP)::date, 1)
       ON CONFLICT (student_id, activity_date)
       DO UPDATE SET questions_count = daily_streaks.questions_count + 1`,
      [studentId]
    );

    // 3. Log activity item (limit creation rate or store latest)
    await pool.query(
      `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
       VALUES ($1, 'question_practice', $2, $3, $4::jsonb)`,
      [
        studentId,
        cleanQuestionId ? String(cleanQuestionId) : 'mcq',
        lessonTitle || subject || 'MCQ Practice',
        JSON.stringify({
          subject: subject || 'General Studies',
          isCorrect: cleanIsCorrect,
          sourceSystem: cleanSource,
        }),
      ]
    );

    notifyStudentDashboardUpdate(studentId);

    return res.status(200).json({
      status: 'success',
      message: 'Question attempt recorded successfully.',
    });
  } catch (err: any) {
    console.error('[Question Attempt Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to record attempt.' });
  }
});

// ====================================================
// 7. RECORD MOCK TEST / ASSESSMENT SUBMISSION (TRANSACTIONAL)
// ====================================================
async function handleAssessmentSubmit(req: StudentAuthenticatedRequest, res: Response) {
  try {
    const studentId = req.studentUser!.studentId;
    const {
      testId,
      testTitle,
      category,
      assessmentType,
      submissionToken,
      totalQuestions,
      attemptedQuestions,
      correctAnswers,
      incorrectAnswers,
      unansweredQuestions,
      score,
      maxScore,
      timeSpentSeconds,
      responses,
      groupId,
      subjectId,
      standardId,
      unitId,
      lessonId,
      lessonTitle,
      mockTestFormat,
    } = req.body;

    // Read-only server guard: never alter student database records during admin preview mode
    if (req.studentUser?.isPreview) {
      const cleanTotal = Number(totalQuestions) || 10;
      const cleanCorrect = Number(correctAnswers) || 0;
      const cleanScore = typeof score === 'number' ? score : cleanCorrect * 1.5;
      const cleanMax = typeof maxScore === 'number' ? maxScore : cleanTotal * 1.5;
      const percentage = cleanTotal > 0 ? Math.round((cleanCorrect / cleanTotal) * 100) : 0;
      return res.status(200).json({
        status: 'success',
        message: 'Preview mode: mock test submitted for display only (read-only, not saved to student records).',
        data: {
          id: 0,
          studentId,
          testId: testId || 'mock-preview',
          testTitle: testTitle || 'Mock Test Preview',
          category: category || 'group4',
          totalQuestions: cleanTotal,
          attemptedQuestions: Number(attemptedQuestions) || cleanTotal,
          correctAnswers: cleanCorrect,
          incorrectAnswers: Number(incorrectAnswers) || 0,
          score: cleanScore,
          maxScore: cleanMax,
          percentage,
          timeSpentSeconds: Number(timeSpentSeconds) || 0,
          submittedAt: new Date().toISOString(),
        },
      });
    }

    if (!testTitle) {
      return res.status(400).json({ status: 'error', message: 'Test title is required.' });
    }

    const result = await submitAssessmentAttempt(studentId, {
      testId,
      testTitle,
      category,
      assessmentType,
      submissionToken,
      totalQuestions,
      attemptedQuestions,
      correctAnswers,
      incorrectAnswers,
      unansweredQuestions,
      score,
      maxScore,
      timeSpentSeconds,
      responses,
      groupId,
      subjectId,
      standardId,
      unitId,
      lessonId,
      lessonTitle,
      mockTestFormat,
    });

    return res.status(200).json({
      status: 'success',
      message: result.message,
      attemptId: result.attemptId,
      attemptNumber: (result as any).attemptNumber,
      percentage: result.percentage,
      grade: (result as any).grade,
      gradeColor: (result as any).gradeColor,
      awardType: (result as any).awardType,
      duplicate: Boolean((result as any).duplicate),
      ignored: Boolean((result as any).ignored),
    });
  } catch (err: any) {
    console.error('[Assessment Submit Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to submit assessment.' });
  }
}

router.post('/mock-test/submit', requireStudentAuth, handleAssessmentSubmit);
router.post('/assessments/submit', requireStudentAuth, handleAssessmentSubmit);

// ====================================================
// 7B. MARK LIST & DETAILED SCORECARDS (STUDENT-ISOLATED)
// ====================================================
function parseOptionalStrictPositiveInt(raw: unknown, paramName: string): { value?: number; error?: string } {
  if (raw === undefined || raw === null) return {};
  const str = String(raw).trim();
  if (!str || str.toLowerCase() === 'all') return {};
  if (!/^\d+$/.test(str)) {
    return { error: `Invalid ${paramName} filter: expected a positive integer.` };
  }
  const num = Number(str);
  if (!Number.isSafeInteger(num) || num <= 0) {
    return { error: `Invalid ${paramName} filter: expected a positive integer.` };
  }
  return { value: num };
}

router.get('/mark-list', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  const correlationId = crypto.randomUUID();
  try {
    const studentId = req.studentUser!.studentId;

    const stdCheck = parseOptionalStrictPositiveInt(req.query.standard, 'standard');
    if (stdCheck.error) {
      return res.status(400).json({ status: 'error', message: stdCheck.error, correlationId });
    }
    const unitCheck = parseOptionalStrictPositiveInt(req.query.unit, 'unit');
    if (unitCheck.error) {
      return res.status(400).json({ status: 'error', message: unitCheck.error, correlationId });
    }
    const yearCheck = parseOptionalStrictPositiveInt(req.query.year, 'year');
    if (yearCheck.error) {
      return res.status(400).json({ status: 'error', message: yearCheck.error, correlationId });
    }
    const pageCheck = parseOptionalStrictPositiveInt(req.query.page, 'page');
    if (pageCheck.error) {
      return res.status(400).json({ status: 'error', message: pageCheck.error, correlationId });
    }
    const limitCheck = parseOptionalStrictPositiveInt(req.query.limit, 'limit');
    if (limitCheck.error) {
      return res.status(400).json({ status: 'error', message: limitCheck.error, correlationId });
    }

    const fromRaw = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    const toRaw = typeof req.query.to === 'string' ? req.query.to.trim() : '';
    if (fromRaw && !/^\d{4}-\d{2}-\d{2}$/.test(fromRaw)) {
      return res.status(400).json({ status: 'error', message: 'Invalid start date format. Use YYYY-MM-DD.', correlationId });
    }
    if (toRaw && !/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
      return res.status(400).json({ status: 'error', message: 'Invalid end date format. Use YYYY-MM-DD.', correlationId });
    }

    const data = await getStudentMarkList(studentId, {
      type: typeof req.query.type === 'string' ? req.query.type : 'all',
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      testCategory: typeof req.query.testCategory === 'string' ? req.query.testCategory : undefined,
      group: typeof req.query.group === 'string' ? req.query.group : undefined,
      subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
      standard: stdCheck.value,
      unit: unitCheck.value,
      lesson: typeof req.query.lesson === 'string' ? req.query.lesson : undefined,
      year: yearCheck.value,
      from: fromRaw || undefined,
      to: toRaw || undefined,
      page: pageCheck.value ?? 1,
      limit: limitCheck.value ?? 25,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Mark List Error]:', {
      correlationId,
      endpoint: '/api/student/mark-list',
      code: err?.code || null,
      message: err?.message || 'Unknown error',
    });
    return res.status(500).json({
      status: 'error',
      message: 'Unable to load your mark list right now. Please try again shortly.',
      correlationId,
    });
  }
});

router.get('/mark-list/:attemptId', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  const correlationId = crypto.randomUUID();
  try {
    const studentId = req.studentUser!.studentId;
    const rawAttemptId = String(req.params.attemptId || '').trim();
    if (!/^\d+$/.test(rawAttemptId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid numeric assessment attempt ID is required.',
        correlationId,
      });
    }
    const attemptId = Number(rawAttemptId);
    if (!Number.isSafeInteger(attemptId) || attemptId <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid numeric assessment attempt ID is required.',
        correlationId,
      });
    }
    const detail = await getStudentScorecardDetail(studentId, attemptId);
    if (!detail) {
      return res.status(404).json({ status: 'error', message: 'Scorecard not found.', correlationId });
    }
    return res.status(200).json({ status: 'success', data: detail });
  } catch (err: any) {
    console.error('[Scorecard Detail Error]:', {
      correlationId,
      endpoint: '/api/student/mark-list/:attemptId',
      code: err?.code || null,
      message: err?.message || 'Unknown error',
    });
    return res.status(500).json({
      status: 'error',
      message: 'Unable to load detailed scorecard right now. Please try again shortly.',
      correlationId,
    });
  }
});

router.get('/performance-analytics', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const data = await getStudentPerformanceAnalytics(studentId, {
      group: typeof req.query.group === 'string' ? req.query.group : 'all',
      subject: typeof req.query.subject === 'string' ? req.query.subject : 'all',
      range: typeof req.query.range === 'string' ? req.query.range : '30d',
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      testKey: typeof req.query.testKey === 'string' ? req.query.testKey : undefined,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Performance Analytics Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load performance analytics.' });
  }
});

router.get('/progress-tracker', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const data = await getStudentProgressTrackerData(studentId);
    if (!data) {
      return res.status(404).json({ status: 'error', message: 'Student account not found.' });
    }
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Progress Tracker Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load progress tracker.' });
  }
});

router.get('/admin/assessments/analytics', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const analytics = await getAdminAssessmentAnalytics();
    return res.status(200).json({ status: 'success', data: analytics });
  } catch (err: any) {
    console.error('[Admin Assessments Analytics Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load assessment analytics.' });
  }
});

// ====================================================
// 7C. GRADE SETTINGS & SYLLABUS PROGRESS APIS
// ====================================================
router.get('/grade-boundaries', async (_req: Request, res: Response) => {
  try {
    const boundaries = await getGradeBoundaries();
    return res.status(200).json({ status: 'success', boundaries });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load grade boundaries.' });
  }
});

router.get('/admin/grade-boundaries', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const boundaries = await getGradeBoundaries();
    return res.status(200).json({ status: 'success', boundaries });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load grade boundaries.' });
  }
});

router.put('/admin/grade-boundaries', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const boundaries = await updateGradeBoundaries(req.body?.boundaries || []);
    return res.status(200).json({ status: 'success', boundaries });
  } catch (err: any) {
    return res.status(400).json({ status: 'error', message: err.message || 'Invalid grade boundaries.' });
  }
});

router.get('/award-settings', async (_req: Request, res: Response) => {
  try {
    const settings = await getAwardSettings();
    return res.status(200).json({ status: 'success', settings });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load award settings.' });
  }
});

router.get('/awards-summary', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const summary = await getStudentAwardsDashboardSummary(studentId);
    return res.status(200).json({ status: 'success', data: summary });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load awards summary.' });
  }
});

router.get('/admin/award-settings', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const settings = await getAwardSettings();
    return res.status(200).json({ status: 'success', settings });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load award settings.' });
  }
});

router.put('/admin/award-settings', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const settings = await updateAwardSettings(req.body || {});
    return res.status(200).json({ status: 'success', settings });
  } catch (err: any) {
    return res.status(400).json({ status: 'error', message: err.message || 'Invalid award threshold configuration.' });
  }
});

router.post('/admin/award-settings/reset', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const settings = await resetAwardSettingsToDefault();
    return res.status(200).json({ status: 'success', settings });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to reset award settings.' });
  }
});

router.get('/admin/award-history', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const data = await getAdminAwardHistory({
      group: req.query.group as string | undefined,
      subject: req.query.subject as string | undefined,
      standard: req.query.standard as string | undefined,
      unit: req.query.unit as string | undefined,
      lesson: req.query.lesson as string | undefined,
      awardType: req.query.awardType as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : 100,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Admin Award History Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load award history.' });
  }
});

router.get('/admin/syllabus-progress', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const data = await getAdminSyllabusProgressOverview();
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Admin Syllabus Progress Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load syllabus progress overview.' });
  }
});

router.get('/syllabus-progress', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const groupId = String(req.query.groupId || 'group1');
    const subjectId = String(req.query.subjectId || 'general-studies');
    const standardId = parseInt(String(req.query.standardId || '6'), 10) || 6;
    const rawMode = String(req.query.mode || 'mcq_practice');
    const mode =
      rawMode === 'lesson_wise'
        ? 'lesson_wise'
        : rawMode === 'all'
          ? 'all'
          : 'mcq_practice';
    const data = await getStudentSyllabusProgress(studentId, { groupId, subjectId, standardId, mode });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Student Syllabus Progress Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load syllabus progress.' });
  }
});

router.get('/syllabus-progress/lesson-history', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const groupId = String(req.query.groupId || 'group1');
    const subjectId = String(req.query.subjectId || 'general-studies');
    const standardId = parseInt(String(req.query.standardId || '6'), 10) || 6;
    const unitId = parseInt(String(req.query.unitId || '1'), 10) || 1;
    const lessonId = req.query.lessonId ? String(req.query.lessonId) : undefined;
    const lessonTitle = req.query.lessonTitle ? String(req.query.lessonTitle) : undefined;
    const rawMode = String(req.query.mode || 'all');
    const mode = rawMode === 'mcq_practice' || rawMode === 'lesson_wise' ? rawMode : 'all';
    const data = await getLessonAttemptHistory(studentId, {
      groupId,
      subjectId,
      standardId,
      unitId,
      lessonId,
      lessonTitle,
      mode,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Lesson Attempt History Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load lesson attempt history.' });
  }
});

router.get('/syllabus-progress/mock-tests', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const groupId = req.query.groupId ? String(req.query.groupId) : undefined;
    const data = await getMockTestProgressSummary(studentId, { groupId });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Mock Test Progress Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load mock test progress.' });
  }
});

// ====================================================
// 8. RECORD STUDY MATERIAL READING PROGRESS
// ====================================================
router.post('/material-progress', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;

    // Read-only server guard: never alter student database records during admin preview mode
    if (req.studentUser?.isPreview) {
      return res.status(200).json({
        status: 'success',
        message: 'Preview mode: study material progress simulated (read-only, no database write).',
      });
    }

    const {
      materialType,
      standard,
      subject,
      term,
      unitId,
      lessonId,
      lessonTitle,
      readingTimeSeconds,
      isCompleted,
    } = req.body;

    if (!lessonTitle) {
      return res.status(400).json({ status: 'error', message: 'Lesson title is required.' });
    }

    const cleanType = materialType || 'note';
    const cleanStd = standard ? Number(standard) : null;
    const cleanSub = subject || 'General Studies';
    const cleanTerm = term || 'Term 1';
    const cleanUnit = unitId ? Number(unitId) : 1;
    const cleanLessonId = lessonId ? String(lessonId) : null;
    const cleanTime = Math.max(1, Number(readingTimeSeconds) || 30);
    const completedFlag = Boolean(isCompleted);

    // Upsert study material progress
    await pool.query(
      `INSERT INTO study_material_progress (
         student_id, material_type, standard, subject, term, unit_id, lesson_id, lesson_title,
         reading_time_seconds, is_completed, last_accessed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
       ON CONFLICT (student_id, material_type, subject, standard, unit_id, lesson_title)
       DO UPDATE SET
         reading_time_seconds = study_material_progress.reading_time_seconds + EXCLUDED.reading_time_seconds,
         is_completed = study_material_progress.is_completed OR EXCLUDED.is_completed,
         last_accessed_at = CURRENT_TIMESTAMP`,
      [
        studentId,
        cleanType,
        cleanStd,
        cleanSub,
        cleanTerm,
        cleanUnit,
        cleanLessonId,
        lessonTitle,
        cleanTime,
        completedFlag,
      ]
    );

    // Update daily streak
    await pool.query(
      `INSERT INTO daily_streaks (student_id, activity_date, notes_count)
       VALUES ($1, timezone('Asia/Kolkata', CURRENT_TIMESTAMP)::date, 1)
       ON CONFLICT (student_id, activity_date)
       DO UPDATE SET notes_count = daily_streaks.notes_count + 1`,
      [studentId]
    );

    // If completed or significant study, record activity
    if (completedFlag) {
      await pool.query(
        `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
         VALUES ($1, 'study_material', $2, $3, $4::jsonb)`,
        [
          studentId,
          cleanLessonId || lessonTitle,
          lessonTitle,
          JSON.stringify({ subject: cleanSub, standard: cleanStd, isCompleted: true }),
        ]
      );
    }

    notifyStudentDashboardUpdate(studentId);

    return res.status(200).json({
      status: 'success',
      message: 'Study material progress updated successfully.',
    });
  } catch (err: any) {
    console.error('[Study Material Progress Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to update progress.' });
  }
});

// ====================================================
// 9. ADMIN PANEL: STUDENTS OVERVIEW & METRICS
// ====================================================
router.get('/admin/list', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    // 1. Overall Aggregates
    const aggRes = await pool.query(`
      SELECT
        COUNT(DISTINCT s.id)::int AS total_students,
        COUNT(DISTINCT CASE WHEN ds.activity_date >= (timezone('Asia/Kolkata', CURRENT_TIMESTAMP)::date - INTERVAL '7 days') THEN s.id END)::int AS active_last_7_days,
        COALESCE(SUM(ss.duration_seconds), 0)::bigint AS total_study_seconds,
        COUNT(qa.id)::int AS total_questions_attempted,
        COUNT(CASE WHEN qa.is_correct THEN 1 END)::int AS total_questions_correct
      FROM students s
      LEFT JOIN daily_streaks ds ON ds.student_id = s.id
      LEFT JOIN study_sessions ss ON ss.student_id = s.id
      LEFT JOIN question_attempts qa ON qa.student_id = s.id
    `);

    const totalStudents = aggRes.rows[0]?.total_students || 0;
    const activeStudents = aggRes.rows[0]?.active_last_7_days || 0;
    const totalStudyHours = Math.round((Number(aggRes.rows[0]?.total_study_seconds || 0) / 3600) * 10) / 10;
    const totalQAttempts = aggRes.rows[0]?.total_questions_attempted || 0;
    const totalQCorrect = aggRes.rows[0]?.total_questions_correct || 0;
    const overallAvgAccuracy = totalQAttempts > 0 ? Math.round((totalQCorrect / totalQAttempts) * 100) : 0;

    // 2. Individual Students List
    const studentsRes = await pool.query(`
      SELECT
        s.id,
        s.full_name,
        s.email,
        s.mobile,
        s.target_group,
        s.created_at,
        COALESCE(SUM(ss.duration_seconds), 0)::int AS study_seconds,
        COUNT(DISTINCT qa.id)::int AS questions_attempted,
        COUNT(DISTINCT CASE WHEN qa.is_correct THEN qa.id END)::int AS questions_correct,
        COUNT(DISTINCT mta.id)::int AS mock_tests_count,
        COUNT(DISTINCT CASE WHEN smp.is_completed THEN smp.id END)::int AS materials_completed,
        MAX(sa.created_at) AS last_activity_at
      FROM students s
      LEFT JOIN study_sessions ss ON ss.student_id = s.id
      LEFT JOIN question_attempts qa ON qa.student_id = s.id
      LEFT JOIN mock_test_attempts mta ON mta.student_id = s.id
      LEFT JOIN study_material_progress smp ON smp.student_id = s.id
      LEFT JOIN student_activity sa ON sa.student_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);

    const studentList = studentsRes.rows.map((row) => {
      const qAttempted = row.questions_attempted || 0;
      const qCorrect = row.questions_correct || 0;
      const acc = qAttempted > 0 ? Math.round((qCorrect / qAttempted) * 100) : 0;
      const hours = Math.round((row.study_seconds / 3600) * 10) / 10;

      // Preparation progress
      const qP = Math.min(100, (qAttempted / 2500) * 100);
      const mP = Math.min(100, (row.materials_completed / 120) * 100);
      const tP = Math.min(100, (row.mock_tests_count / 20) * 100);
      const prepProgress =
        qAttempted > 0 || row.materials_completed > 0 || row.mock_tests_count > 0
          ? Math.min(100, Math.round(qP * 0.4 + mP * 0.3 + tP * 0.2 + acc * 0.1))
          : 0;

      return {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        mobile: row.mobile,
        targetGroup: row.target_group,
        createdAt: row.created_at,
        studyHours: hours,
        studyHoursFormatted: `${hours} hrs`,
        questionsAttempted: qAttempted,
        questionsCorrect: qCorrect,
        accuracy: acc,
        preparationProgress: prepProgress,
        mockTestsCount: row.mock_tests_count,
        materialsCompleted: row.materials_completed,
        lastActive: row.last_activity_at ? formatRelativeTime(row.last_activity_at) : 'Never',
      };
    });

    return res.status(200).json({
      status: 'success',
      data: {
        summary: {
          totalStudents,
          activeStudents,
          totalStudyHours,
          overallAvgAccuracy,
        },
        students: studentList,
      },
    });
  } catch (err: any) {
    console.error('[Admin Students List Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch student data.' });
  }
});

// ====================================================
// 10. ADMIN: GENERATE READ-ONLY PREVIEW TOKEN FOR STUDENT
// ====================================================
router.post('/admin/preview-token/:studentId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ status: 'error', message: 'Valid student ID is required.' });
    }

    const studentRes = await pool.query(
      `SELECT id, full_name, email, mobile, target_group, created_at FROM students WHERE id = $1`,
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Student account not found.' });
    }

    const s = studentRes.rows[0];

    // Generate token flagged with isPreview: true
    const previewToken = generateStudentToken(
      s.id,
      s.email,
      s.full_name,
      s.target_group,
      true // isPreview = true
    );

    return res.status(200).json({
      status: 'success',
      message: `Preview token generated for ${s.full_name}`,
      previewToken,
      student: {
        id: s.id,
        fullName: s.full_name,
        email: s.email,
        mobile: s.mobile,
        targetGroup: s.target_group,
        createdAt: s.created_at,
        isPreview: true,
      },
    });
  } catch (err: any) {
    console.error('[Admin Preview Token Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to generate preview token.' });
  }
});

// ====================================================
// 11. ADMIN: QUICK CREATE STUDENT ACCOUNT
// ====================================================
router.post('/admin/create', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { fullName, email, mobile, password, targetGroup, district, city, subscriptionTier } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ status: 'error', message: 'Full name is required.' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ status: 'error', message: 'A valid email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanMobile = mobile ? String(mobile).trim() : null;
    const cleanGroup = targetGroup && typeof targetGroup === 'string' ? targetGroup.trim().toLowerCase() : 'group4';
    const cleanDistrict = district && typeof district === 'string' ? district.trim() : 'Chennai';
    const cleanCity = city && typeof city === 'string' ? city.trim() : 'Central';
    const cleanTier = subscriptionTier && typeof subscriptionTier === 'string' ? subscriptionTier.trim() : 'free';
    const cleanPass = password && password.length >= 6 ? password : 'tnpsc' + Math.floor(1000 + Math.random() * 9000);

    const existing = await pool.query('SELECT id FROM students WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ status: 'error', message: 'A student account with this email already exists.' });
    }

    const passwordHash = hashStudentPassword(cleanPass);

    const insertRes = await pool.query(
      `INSERT INTO students (full_name, email, mobile, password_hash, target_group, district, city, subscription_tier, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING id, full_name, email, mobile, target_group, district, city, subscription_tier, created_at`,
      [cleanName, cleanEmail, cleanMobile, passwordHash, cleanGroup, cleanDistrict, cleanCity, cleanTier]
    );

    const createdStudent = insertRes.rows[0];

    // If paid subscription tier selected, insert into student_subscriptions
    if (cleanTier !== 'free') {
      const planIdMap: Record<string, { planId: string; planName: string; amount: number; days: number }> = {
        monthly: { planId: 'tnpsc_pro_monthly', planName: 'TNPSC Pro Monthly Pass', amount: 199.00, days: 30 },
        quarterly: { planId: 'tnpsc_pro_quarterly', planName: 'TNPSC Pro Quarterly Pass', amount: 499.00, days: 90 },
        half_yearly: { planId: 'tnpsc_pro_half_yearly', planName: 'TNPSC Pro Half-Yearly Pass', amount: 899.00, days: 180 },
        yearly: { planId: 'tnpsc_pro_yearly', planName: 'TNPSC Pro Annual Pass', amount: 1499.00, days: 365 },
        pro: { planId: 'tnpsc_pro_yearly', planName: 'TNPSC Pro Annual Pass', amount: 1499.00, days: 365 },
      };
      const planInfo = planIdMap[cleanTier] || planIdMap.yearly;

      await pool.query(
        `INSERT INTO student_subscriptions (student_id, plan_id, plan_name, amount, currency, status, payment_method, district, city, starts_at, expires_at)
         VALUES ($1, $2, $3, $4, 'INR', 'active', 'Admin Enrollment', $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + ($7 || ' days')::INTERVAL)
         ON CONFLICT DO NOTHING`,
        [createdStudent.id, planInfo.planId, planInfo.planName, planInfo.amount, cleanDistrict, cleanCity, planInfo.days]
      );
    }

    // Log admin creation activity
    await pool.query(
      `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
       VALUES ($1, 'account_created', $2, 'Enrolled by Admin', $3::jsonb)`,
      [createdStudent.id, String(createdStudent.id), JSON.stringify({ enrolledBy: 'admin', tier: cleanTier })]
    );

    return res.status(201).json({
      status: 'success',
      message: `Student account created successfully. Default password: ${cleanPass}`,
      student: {
        id: createdStudent.id,
        fullName: createdStudent.full_name,
        email: createdStudent.email,
        mobile: createdStudent.mobile,
        targetGroup: createdStudent.target_group,
        district: createdStudent.district,
        city: createdStudent.city,
        tier: createdStudent.subscription_tier,
        createdAt: createdStudent.created_at,
        temporaryPassword: cleanPass,
      },
    });
  } catch (err: any) {
    console.error('[Admin Create Student Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to create student account.' });
  }
});

// ====================================================
// 12. ADMIN: RESTORE & DEACTIVATED STUDENTS LIST
// ====================================================
router.get('/admin/restore-list', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const listRes = await pool.query(
      `SELECT id, full_name, email, mobile, target_group, district, city, subscription_tier, is_active, deleted_at, created_at
       FROM students
       WHERE is_active = false OR deleted_at IS NOT NULL
       ORDER BY deleted_at DESC NULLS LAST, id DESC`
    );

    return res.status(200).json({
      status: 'success',
      data: {
        count: listRes.rows.length,
        students: listRes.rows.map((r) => ({
          id: r.id,
          fullName: r.full_name,
          email: r.email,
          mobile: r.mobile,
          targetGroup: r.target_group,
          district: r.district || 'Chennai',
          city: r.city || 'Central',
          tier: r.subscription_tier || 'free',
          isActive: r.is_active,
          deletedAt: r.deleted_at,
          createdAt: r.created_at,
        })),
      },
    });
  } catch (err: any) {
    console.error('[Admin Restore List Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch restorable students.' });
  }
});

// ====================================================
// 13. ADMIN: RESTORE DEACTIVATED STUDENT
// ====================================================
router.post('/admin/restore/:studentId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ status: 'error', message: 'Valid student ID is required.' });
    }

    const updateRes = await pool.query(
      `UPDATE students
       SET is_active = true, deleted_at = NULL
       WHERE id = $1
       RETURNING id, full_name, email, is_active`,
      [studentId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Student account not found.' });
    }

    try {
      await pool.query(
        `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
         VALUES ($1, 'account_restored', $1::text, 'Account Restored', $2::jsonb)`,
        [studentId, JSON.stringify({ restoredAt: new Date().toISOString() })]
      );
      broadcastAnalyticsEvent('student_restored', { studentId });
    } catch (actErr) {
      console.warn('[Admin Restore Student] Activity log notice:', actErr);
    }

    return res.status(200).json({
      status: 'success',
      message: `Account for ${updateRes.rows[0].full_name} has been successfully restored.`,
      student: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Admin Restore Student Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to restore student.' });
  }
});

// ====================================================
// 14. ADMIN: DEACTIVATE STUDENT ACCOUNT
// ====================================================
router.post('/admin/deactivate/:studentId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ status: 'error', message: 'Valid student ID is required.' });
    }

    const updateRes = await pool.query(
      `UPDATE students
       SET is_active = false, deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, full_name, email, is_active`,
      [studentId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Student account not found.' });
    }

    try {
      await pool.query(
        `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
         VALUES ($1, 'account_restored', $1::text, 'Account Restored', $2::jsonb)`,
        [studentId, JSON.stringify({ restoredAt: new Date().toISOString() })]
      );
      broadcastAnalyticsEvent('student_restored', { studentId });
    } catch (actErr) {
      console.warn('[Admin Restore Student] Activity log notice:', actErr);
    }

    return res.status(200).json({
      status: 'success',
      message: `Account for ${updateRes.rows[0].full_name} has been deactivated.`,
      student: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Admin Deactivate Student Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to deactivate student.' });
  }
});

// ===========================================================================
// STUDENT STUDY MATERIALS (Master Syllabus Single Source of Truth)
// ===========================================================================
router.get('/study-materials', async (req: Request, res: Response) => {
  try {
    const rawExamId = String(req.query.groupId || req.query.examId || 'group1').toLowerCase().trim();
    const examId = rawExamId === 'group2_2a' || rawExamId === 'group2' ? 'group2' : (rawExamId === 'group4_vao' || rawExamId === 'group4' ? 'group4' : rawExamId);
    const subjectId = String(req.query.subjectId || 'general-studies').toLowerCase().trim();
    const standardNumber = (req.query.standardId || req.query.standardNumber || req.query.classId)
      ? parseInt(String(req.query.standardId || req.query.standardNumber || req.query.classId), 10)
      : undefined;
    const unitNumber = req.query.unitNumber ? parseInt(String(req.query.unitNumber), 10) : undefined;

    const tree = await StudyManagementService.getFullHierarchyTree({
      examId,
      subjectId,
      standardNumber,
      unitNumber,
    });

    // Filter to published lessons and notes only (Requirements 6 & 11)
    const publishedTree = tree.map((unit: any) => ({
      ...unit,
      lessons: (unit.lessons || [])
        .filter((l: any) => l.status !== 'Draft' && l.status !== 'Archived')
        .map((l: any) => ({
          ...l,
          topics: (l.topics || []).map((t: any) => ({
            ...t,
            notes: (t.notes || []).filter((n: any) => n.status === 'published'),
          })),
        })),
    }));

    return res.status(200).json({
      status: 'success',
      success: true,
      examId,
      subjectId,
      standardNumber,
      unitNumber,
      tree: publishedTree,
    });
  } catch (err: any) {
    console.error('[Student Study Materials API Error]:', err);
    return res.status(500).json({ status: 'error', success: false, message: err.message });
  }
});

// ============================================================================
// STUDENT TEXTBOOK LIBRARY (PUBLISHED GOOGLE DRIVE TEXTBOOKS ONLY)
// ============================================================================

router.get('/textbooks/filters', async (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    const data = await getPublishedStudentTextbookFilters({
      medium: typeof req.query.medium === 'string' ? req.query.medium : undefined,
      standard: typeof req.query.standard === 'string' ? req.query.standard : undefined,
      subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
      term: typeof req.query.term === 'string' ? req.query.term : undefined,
      volume: typeof req.query.volume === 'string' ? req.query.volume : undefined,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err?.message || 'Failed to load textbook filters.' });
  }
});

router.get('/textbooks', async (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    const result = await queryPublishedStudentTextbooksPaginated({
      group: typeof req.query.group === 'string' ? req.query.group : undefined,
      standard: typeof req.query.standard === 'string' ? req.query.standard : undefined,
      subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
      medium: typeof req.query.medium === 'string' ? req.query.medium : undefined,
      term: typeof req.query.term === 'string' ? req.query.term : undefined,
      volume: typeof req.query.volume === 'string' ? req.query.volume : undefined,
      termOrVolume: typeof req.query.termOrVolume === 'string' ? req.query.termOrVolume : undefined,
      unit: typeof req.query.unit === 'string' ? req.query.unit : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page: typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1,
      limit: typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 100,
    });

    const sanitized = result.items.map((b) => ({
      id: b.id,
      groupId: b.groupId,
      bookName: b.bookName,
      standard: b.standard,
      subject: b.subject,
      medium: b.medium,
      term: /^term\s*\d+/i.test(String(b.term || '')) ? b.term : null,
      volume: b.volume || (/^vol(?:ume)?\s*\d+/i.test(String(b.term || '')) ? b.term : null),
      unit: b.unit,
      fileName: b.fileName,
      fileSize: b.fileSize,
      publishedAt: b.publishedAt,
      downloadCount: b.downloadCount,
      previewUrl: `/api/student/textbooks/${b.id}/preview`,
      downloadUrl: `/api/student/textbooks/${b.id}/download`,
    }));

    return res.status(200).json({
      status: 'success',
      data: sanitized,
      pagination: result.pagination,
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err?.message || 'Failed to load published textbooks.' });
  }
});

router.get('/textbooks/:id(\\d+)', async (req: Request, res: Response) => {
  try {
    const book = await getPublishedStudentTextbookById(Number(req.params.id));
    if (!book) {
      return res.status(404).json({ status: 'error', message: 'Published textbook not found.' });
    }
    return res.status(200).json({
      status: 'success',
      data: {
        id: book.id,
        groupId: book.groupId,
        bookName: book.bookName,
        standard: book.standard,
        subject: book.subject,
        medium: book.medium,
        term: book.standard <= 10 ? book.term : null,
        volume: book.standard >= 11 ? book.volume : null,
        unit: book.unit,
        fileName: book.fileName,
        fileSize: book.fileSize,
        publishedAt: book.publishedAt,
        downloadCount: book.downloadCount,
        previewUrl: `/api/student/textbooks/${book.id}/preview`,
        downloadUrl: `/api/student/textbooks/${book.id}/download`,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err?.message || 'Failed to fetch textbook details.' });
  }
});

router.get(
  '/textbooks/:id(\\d+)/:mode(preview|download)',
  requireStudentAuth,
  async (req: StudentAuthenticatedRequest, res: Response) => {
    try {
      const textbookId = Number(req.params.id);
      const isDownload = req.params.mode === 'download';

      const { stream, fileName, fileSize, mimeType } = await openDriveTextbookPdfStream({
        textbookId,
        isAdmin: false,
        incrementDownloadCount: isDownload,
      });

      const safeAscii = fileName.replace(/["\\\r\n]/g, '_');
      res.setHeader('Content-Type', mimeType);
      res.setHeader(
        'Content-Disposition',
        `${isDownload ? 'attachment' : 'inline'}; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );
      if (fileSize > 0) res.setHeader('Content-Length', String(fileSize));

      req.on('close', () => {
        if (typeof (stream as any).destroy === 'function') (stream as any).destroy();
      });
      stream.on('error', () => {
        if (!res.headersSent) {
          res.status(502).json({ status: 'error', message: 'Failed to stream PDF from Google Drive.' });
        } else {
          res.end();
        }
      });
      stream.pipe(res);
    } catch (err: any) {
      return res.status(err?.statusCode || 500).json({
        status: 'error',
        message: err?.message || 'Unable to stream textbook PDF.',
      });
    }
  }
);

export default router;

