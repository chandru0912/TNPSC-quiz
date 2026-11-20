import crypto from 'crypto';
import { Response } from 'express';
import pool from '../db';
import { broadcastAnalyticsEvent } from './analyticsEventBus';

export const SESSION_REVOKED_MESSAGE =
  'Your account has been logged in on another device. Please log in again to continue.';

export interface ParsedDeviceInfo {
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  browserName: string;
  osName: string;
}

/**
 * Non-invasive User-Agent parsing for Admin session monitoring (no fingerprinting).
 */
export function parseUserAgentDeviceInfo(userAgent?: string | null): ParsedDeviceInfo {
  const ua = String(userAgent || '');
  const lower = ua.toLowerCase();

  let deviceType: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';
  if (/ipad|tablet|playbook|silk|(android(?!.*mobi))/i.test(ua)) {
    deviceType = 'Tablet';
  } else if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = 'Mobile';
  }

  let browserName = 'Unknown Browser';
  if (lower.includes('edg/')) browserName = 'Microsoft Edge';
  else if (lower.includes('opr/') || lower.includes('opera')) browserName = 'Opera';
  else if (lower.includes('firefox/') || lower.includes('fxios')) browserName = 'Mozilla Firefox';
  else if (lower.includes('chrome/') || lower.includes('crios')) browserName = 'Google Chrome';
  else if (lower.includes('safari/')) browserName = 'Safari';

  let osName = 'Unknown OS';
  if (lower.includes('windows')) osName = 'Windows';
  else if (lower.includes('android')) osName = 'Android';
  else if (lower.includes('iphone') || lower.includes('ipad') || lower.includes('ipod')) osName = 'iOS';
  else if (lower.includes('mac os') || lower.includes('macintosh')) osName = 'macOS';
  else if (lower.includes('linux')) osName = 'Linux';
  else if (lower.includes('cros')) osName = 'ChromeOS';

  return { deviceType, browserName, osName };
}

// ====================================================
// Real-Time Student Session SSE Bus (Revocation Push)
// ====================================================
interface StudentSessionSseClient {
  id: string;
  studentId: number;
  sessionId: string;
  res: Response;
  heartbeat: NodeJS.Timeout;
}

class StudentSessionEventBus {
  private clients = new Map<string, StudentSessionSseClient>();

  addClient(studentId: number, sessionId: string, res: Response): string {
    const id = `${studentId}_${sessionId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const heartbeat = setInterval(() => {
      try {
        res.write(`: keep-alive ${Date.now()}\n\n`);
      } catch {
        this.removeClient(id);
      }
    }, 25000);

    this.clients.set(id, { id, studentId, sessionId, res, heartbeat });
    try {
      res.write(`event: connected\ndata: ${JSON.stringify({ sessionId, status: 'active' })}\n\n`);
    } catch {
      this.removeClient(id);
    }
    return id;
  }

  removeClient(id: string) {
    const c = this.clients.get(id);
    if (c) {
      clearInterval(c.heartbeat);
      this.clients.delete(id);
    }
  }

  notifySessionsRevoked(studentId: number, revokedSessionIds: string[], reason: string = 'logged_in_on_another_device') {
    if (!revokedSessionIds.length) return;
    const revokedSet = new Set(revokedSessionIds);
    const payload = JSON.stringify({
      code: 'SESSION_REVOKED_OTHER_DEVICE',
      reason,
      message: SESSION_REVOKED_MESSAGE,
      revokedAt: new Date().toISOString(),
    });

    for (const [id, client] of this.clients.entries()) {
      if (client.studentId === studentId && revokedSet.has(client.sessionId)) {
        try {
          client.res.write(`event: session_revoked\ndata: ${payload}\n\n`);
          client.res.end();
        } catch {
          // ignore broken pipe
        } finally {
          this.removeClient(id);
        }
      }
    }
  }
}

export const studentSessionEventBus = new StudentSessionEventBus();

// ====================================================
// Database Schema & Constraints
// ====================================================
let sessionSchemaPromise: Promise<void> | null = null;

export async function ensureStudentSessionSchema(): Promise<void> {
  if (!sessionSchemaPromise) {
    sessionSchemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS student_auth_sessions (
          session_id VARCHAR(96) PRIMARY KEY,
          student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          device_identifier VARCHAR(128),
          device_type VARCHAR(32) NOT NULL DEFAULT 'Desktop',
          browser_name VARCHAR(64) NOT NULL DEFAULT 'Unknown Browser',
          os_name VARCHAR(64) NOT NULL DEFAULT 'Unknown OS',
          auth_method VARCHAR(32) NOT NULL DEFAULT 'email',
          session_status VARCHAR(24) NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMPTZ NOT NULL,
          revoked_at TIMESTAMPTZ,
          revoked_reason VARCHAR(64)
        );

        CREATE INDEX IF NOT EXISTS idx_stu_auth_sess_student ON student_auth_sessions(student_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_stu_auth_sess_status ON student_auth_sessions(session_status);
      `);

      // Cleanup any duplicate active rows before creating partial unique index (idempotent safety)
      await pool.query(`
        WITH ranked AS (
          SELECT session_id,
                 ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY created_at DESC) AS rn
          FROM student_auth_sessions
          WHERE session_status = 'active'
        )
        UPDATE student_auth_sessions
        SET session_status = 'revoked',
            revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
            revoked_reason = COALESCE(revoked_reason, 'superseded_by_single_session')
        WHERE session_id IN (SELECT session_id FROM ranked WHERE rn > 1);
      `);

      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_student_one_active_session
          ON student_auth_sessions (student_id)
          WHERE session_status = 'active';
      `);
    })().catch((err) => {
      sessionSchemaPromise = null;
      throw err;
    });
  }
  await sessionSchemaPromise;
}

// ====================================================
// Atomic Single Active Session Creation (Race-Safe)
// ====================================================
export interface CreateSessionInput {
  studentId: number;
  authMethod: 'email' | 'google' | 'register';
  userAgent?: string | null;
  deviceIdentifier?: string | null;
  ttlMs?: number;
}

export interface CreatedSessionResult {
  sessionId: string;
  tokenVersion: number;
  expiresAt: Date;
  deviceInfo: ParsedDeviceInfo;
  revokedSessionIds: string[];
}

export async function createSingleActiveStudentSession(
  input: CreateSessionInput
): Promise<CreatedSessionResult> {
  await ensureStudentSessionSchema();

  const deviceInfo = parseUserAgentDeviceInfo(input.userAgent);
  const ttlMs = input.ttlMs && input.ttlMs > 0 ? input.ttlMs : 30 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);
  const newSessionId = `sess_${crypto.randomUUID()}`;
  const cleanDeviceId = input.deviceIdentifier ? String(input.deviceIdentifier).trim().slice(0, 128) : null;

  const client = await pool.connect();
  let newTokenVersion = 1;
  let revokedSessionIds: string[] = [];

  try {
    await client.query('BEGIN');

    // Lock the student row so simultaneous logins from two devices serialize strictly
    const lockRes = await client.query(
      `SELECT id, COALESCE(token_version, 1) AS token_version
       FROM students
       WHERE id = $1
       FOR UPDATE`,
      [input.studentId]
    );
    if (lockRes.rows.length === 0) {
      throw new Error('Student account not found.');
    }

    // Revoke any currently active session(s) for this student
    const revokedRes = await client.query(
      `UPDATE student_auth_sessions
       SET session_status = 'revoked',
           revoked_at = CURRENT_TIMESTAMP,
           revoked_reason = 'logged_in_on_another_device'
       WHERE student_id = $1 AND session_status = 'active'
       RETURNING session_id`,
      [input.studentId]
    );
    revokedSessionIds = revokedRes.rows.map((r: any) => String(r.session_id));

    // Increment token_version so any legacy token without sessionId is also immediately invalidated
    const verRes = await client.query(
      `UPDATE students
       SET token_version = COALESCE(token_version, 1) + 1,
           last_login_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING token_version`,
      [input.studentId]
    );
    newTokenVersion = Number(verRes.rows[0]?.token_version || 1);

    // Insert the single new active session (guaranteed unique by partial unique index)
    await client.query(
      `INSERT INTO student_auth_sessions (
         session_id, student_id, device_identifier, device_type, browser_name, os_name,
         auth_method, session_status, created_at, last_active_at, expires_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $8)`,
      [
        newSessionId,
        input.studentId,
        cleanDeviceId,
        deviceInfo.deviceType,
        deviceInfo.browserName,
        deviceInfo.osName,
        input.authMethod,
        expiresAt,
      ]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Push immediate real-time revocation to previous device SSE stream(s)
  if (revokedSessionIds.length > 0) {
    studentSessionEventBus.notifySessionsRevoked(input.studentId, revokedSessionIds, 'logged_in_on_another_device');
  }

  // Notify Admin Analytics in real time
  broadcastAnalyticsEvent('student_login', {
    studentId: input.studentId,
    deviceType: deviceInfo.deviceType,
    browserName: deviceInfo.browserName,
    revokedPrevious: revokedSessionIds.length > 0,
  });

  return {
    sessionId: newSessionId,
    tokenVersion: newTokenVersion,
    expiresAt,
    deviceInfo,
    revokedSessionIds,
  };
}

// ====================================================
// Server-Side Session Validation (Every Protected API)
// ====================================================
const lastActiveTouchCache = new Map<string, number>();

export interface SessionValidationResult {
  valid: boolean;
  code?: 'SESSION_REVOKED_OTHER_DEVICE' | 'SESSION_EXPIRED' | 'SESSION_LOGGED_OUT' | 'SESSION_INVALID';
  message?: string;
}

export async function validateActiveStudentSession(
  studentId: number,
  sessionId?: string | null
): Promise<SessionValidationResult> {
  await ensureStudentSessionSchema();

  if (!sessionId) {
    // Legacy token without sessionId: reject if any active/revoked session exists in student_auth_sessions
    const anyRes = await pool.query(
      `SELECT session_status FROM student_auth_sessions WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [studentId]
    );
    if (anyRes.rows.length > 0) {
      return {
        valid: false,
        code: 'SESSION_REVOKED_OTHER_DEVICE',
        message: SESSION_REVOKED_MESSAGE,
      };
    }
    return { valid: true };
  }

  const res = await pool.query(
    `SELECT session_id, session_status, expires_at, revoked_reason
     FROM student_auth_sessions
     WHERE session_id = $1 AND student_id = $2
     LIMIT 1`,
    [sessionId, studentId]
  );

  if (res.rows.length === 0) {
    return {
      valid: false,
      code: 'SESSION_INVALID',
      message: 'Session is invalid or no longer exists. Please log in again.',
    };
  }

  const row = res.rows[0];
  const status = String(row.session_status || '').toLowerCase();

  if (status === 'revoked') {
    return {
      valid: false,
      code: 'SESSION_REVOKED_OTHER_DEVICE',
      message: SESSION_REVOKED_MESSAGE,
    };
  }

  if (status === 'logged_out') {
    return {
      valid: false,
      code: 'SESSION_LOGGED_OUT',
      message: 'Your session has been logged out. Please log in again.',
    };
  }

  if (status === 'expired' || (row.expires_at && new Date(row.expires_at).getTime() <= Date.now())) {
    if (status !== 'expired') {
      await pool.query(
        `UPDATE student_auth_sessions SET session_status = 'expired' WHERE session_id = $1`,
        [sessionId]
      ).catch(() => {});
    }
    return {
      valid: false,
      code: 'SESSION_EXPIRED',
      message: 'Your session has expired. Please log in again to continue.',
    };
  }

  if (status !== 'active') {
    return {
      valid: false,
      code: 'SESSION_INVALID',
      message: 'Session is no longer active. Please log in again.',
    };
  }

  // Throttled last_active_at heartbeat update (at most once per 60s per session)
  const now = Date.now();
  const lastTouch = lastActiveTouchCache.get(sessionId) || 0;
  if (now - lastTouch > 60_000) {
    lastActiveTouchCache.set(sessionId, now);
    pool
      .query(
        `UPDATE student_auth_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE session_id = $1 AND session_status = 'active'`,
        [sessionId]
      )
      .catch(() => {});
  }

  return { valid: true };
}

// ====================================================
// Explicit Logout Revocation
// ====================================================
export async function revokeStudentSessionOnLogout(studentId: number, sessionId?: string | null) {
  await ensureStudentSessionSchema();
  if (sessionId) {
    await pool.query(
      `UPDATE student_auth_sessions
       SET session_status = 'logged_out',
           revoked_at = CURRENT_TIMESTAMP,
           revoked_reason = 'user_logout'
       WHERE session_id = $1 AND student_id = $2 AND session_status = 'active'`,
      [sessionId, studentId]
    );
  } else {
    await pool.query(
      `UPDATE student_auth_sessions
       SET session_status = 'logged_out',
           revoked_at = CURRENT_TIMESTAMP,
           revoked_reason = 'user_logout'
       WHERE student_id = $1 AND session_status = 'active'`,
      [studentId]
    );
  }
}

// ====================================================
// Admin Analytics: Single Active Session per Student
// ====================================================
function formatIstDateTime(val: Date | string | null) {
  if (!val) return { date: '—', time: '—', full: '—' };
  const d = new Date(val);
  const date = d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  return { date, time, full: `${date}, ${time}` };
}

export async function getAdminActiveStudentSessions() {
  await ensureStudentSessionSchema();

  // One latest session per genuine student + previous revoked session timestamp
  const res = await pool.query(`
    WITH latest_sessions AS (
      SELECT DISTINCT ON (s.student_id)
        s.session_id,
        s.student_id,
        st.email AS student_email,
        st.full_name AS student_name,
        s.device_type,
        s.browser_name,
        s.os_name,
        s.auth_method,
        s.session_status,
        s.created_at,
        s.last_active_at,
        s.expires_at,
        s.revoked_at
      FROM student_auth_sessions s
      JOIN students st ON st.id = s.student_id
      WHERE LOWER(TRIM(COALESCE(st.email, ''))) NOT LIKE '%@example.com'
        AND LOWER(TRIM(COALESCE(st.email, ''))) NOT LIKE 'test_%'
        AND LOWER(TRIM(COALESCE(st.email, ''))) NOT LIKE 'preview_%'
        AND LOWER(TRIM(COALESCE(st.email, ''))) NOT LIKE 'demo_%'
      ORDER BY s.student_id, s.created_at DESC
    ),
    prev_revoked AS (
      SELECT DISTINCT ON (student_id)
        student_id,
        revoked_at AS prev_revoked_at
      FROM student_auth_sessions
      WHERE session_status = 'revoked' AND revoked_at IS NOT NULL
      ORDER BY student_id, revoked_at DESC
    )
    SELECT ls.*, pr.prev_revoked_at
    FROM latest_sessions ls
    LEFT JOIN prev_revoked pr ON pr.student_id = ls.student_id
    ORDER BY
      CASE WHEN ls.session_status = 'active' THEN 0 ELSE 1 END,
      ls.last_active_at DESC
    LIMIT 100
  `);

  const now = Date.now();
  const rows = res.rows.map((r: any) => {
    const isExpired =
      r.session_status === 'active' && r.expires_at && new Date(r.expires_at).getTime() <= now;
    const effectiveStatus = isExpired
      ? 'Expired'
      : r.session_status === 'active'
        ? 'Active'
        : r.session_status === 'revoked'
          ? 'Revoked'
          : r.session_status === 'logged_out'
            ? 'Logged Out'
            : 'Expired';

    const loginIst = formatIstDateTime(r.created_at);
    const lastActiveIst = formatIstDateTime(r.last_active_at);
    const prevRevokedIst = formatIstDateTime(r.prev_revoked_at);

    return {
      studentId: Number(r.student_id),
      studentEmail: String(r.student_email),
      studentName: r.student_name || null,
      deviceType: String(r.device_type || 'Desktop'),
      browserName: String(r.browser_name || 'Unknown Browser'),
      osName: String(r.os_name || 'Unknown OS'),
      authMethod: r.auth_method === 'google' ? 'Google OAuth' : 'Email & Password',
      loginDate: loginIst.date,
      loginTime: loginIst.time,
      lastActiveTime: lastActiveIst.full,
      sessionStatus: effectiveStatus,
      previousRevocationTime: r.prev_revoked_at ? prevRevokedIst.full : '—',
    };
  });

  const activeCount = rows.filter((r) => r.sessionStatus === 'Active').length;
  return {
    activeStudentSessionsCount: activeCount,
    sessions: rows,
    serverTimestamp: new Date().toISOString(),
  };
}
