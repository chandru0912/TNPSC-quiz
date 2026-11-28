import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import pool from '../db';
import {
  validateActiveStudentSession,
  SESSION_REVOKED_MESSAGE,
} from '../services/studentSessionService';

const isProdEnv = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
const LEGACY_DEV_ADMIN_SECRET = 'tnpsc_quiz_admin_jwt_secret_key_2026';
const LEGACY_DEV_STUDENT_SECRET = 'tnpsc_student_session_secret_key_2026';
const MIN_PROD_SECRET_LENGTH = 32;
const REVOKED_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// L1 per-instance cache backed by PostgreSQL `revoked_admin_tokens` for multi-instance serverless consistency.
const revokedAdminTokens = new Map<string, number>();
let revokedTableReady = false;
let lastRevokedCleanupMs = 0;

async function ensureRevokedAdminTokensTable(): Promise<void> {
  if (revokedTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS revoked_admin_tokens (
      token_id VARCHAR(128) PRIMARY KEY,
      admin_username VARCHAR(100),
      revoked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_revoked_admin_tokens_expires_at
    ON revoked_admin_tokens (expires_at);
  `);
  revokedTableReady = true;
}

function extractAdminTokenIdentifier(
  token: string,
  payload?: { jti?: string } | null
): string {
  const jti = typeof payload?.jti === 'string' ? payload.jti.trim() : '';
  if (jti) return `jti:${jti}`;
  return `sha256:${crypto.createHash('sha256').update(String(token || '').trim()).digest('hex')}`;
}

export async function cleanupExpiredRevokedAdminTokens(force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastRevokedCleanupMs < REVOKED_CLEANUP_INTERVAL_MS) {
    return 0;
  }
  lastRevokedCleanupMs = now;
  for (const [k, exp] of revokedAdminTokens.entries()) {
    if (exp <= now) revokedAdminTokens.delete(k);
  }
  try {
    await ensureRevokedAdminTokensTable();
    const res = await pool.query('DELETE FROM revoked_admin_tokens WHERE expires_at <= NOW()');
    return res.rowCount || 0;
  } catch (err: any) {
    console.warn('[AdminAuth] Expired revoked token cleanup notice:', err?.message || err);
    return 0;
  }
}

export async function revokeAdminToken(
  token: string,
  payload?: { jti?: string; username?: string; exp?: number } | null
): Promise<string | null> {
  const clean = String(token || '').trim();
  if (!clean) return null;
  const tokenId = extractAdminTokenIdentifier(clean, payload);
  const expMs = payload?.exp && payload.exp > Date.now() ? payload.exp : Date.now() + 24 * 60 * 60 * 1000;

  revokedAdminTokens.set(tokenId, expMs);
  await ensureRevokedAdminTokensTable();
  await pool.query(
    `INSERT INTO revoked_admin_tokens (token_id, admin_username, expires_at)
     VALUES ($1, $2, to_timestamp($3 / 1000.0))
     ON CONFLICT (token_id) DO NOTHING`,
    [tokenId, payload?.username || null, expMs]
  );

  void cleanupExpiredRevokedAdminTokens(false);
  return tokenId;
}

export function isAdminTokenRevoked(token: string, payload?: { jti?: string } | null): boolean {
  const tokenId = extractAdminTokenIdentifier(token, payload);
  const exp = revokedAdminTokens.get(tokenId);
  if (!exp) return false;
  if (exp <= Date.now()) {
    revokedAdminTokens.delete(tokenId);
    return false;
  }
  return true;
}

export async function isAdminTokenRevokedDistributed(
  token: string,
  payload?: { jti?: string } | null
): Promise<boolean> {
  const tokenId = extractAdminTokenIdentifier(token, payload);
  if (isAdminTokenRevoked(token, payload)) return true;

  try {
    await ensureRevokedAdminTokensTable();
    const res = await pool.query(
      'SELECT expires_at FROM revoked_admin_tokens WHERE token_id = $1 AND expires_at > NOW() LIMIT 1',
      [tokenId]
    );
    if (res.rows.length > 0) {
      const expMs = new Date(res.rows[0].expires_at).getTime();
      revokedAdminTokens.set(tokenId, Number.isFinite(expMs) ? expMs : Date.now() + 60_000);
      return true;
    }
  } catch (err: any) {
    console.warn('[AdminAuth] Distributed revocation lookup notice:', err?.message || err);
  }
  return false;
}

function getJwtSecret(): string {
  const configured = (process.env.ADMIN_JWT_SECRET || '').trim();
  const studentConfigured = (process.env.STUDENT_JWT_SECRET || '').trim();
  if (isProdEnv) {
    if (
      !configured ||
      configured.length < MIN_PROD_SECRET_LENGTH ||
      configured === LEGACY_DEV_ADMIN_SECRET ||
      configured === LEGACY_DEV_STUDENT_SECRET
    ) {
      throw new Error('FATAL_SECURITY_CONFIG: ADMIN_JWT_SECRET must be explicitly configured (>= 32 chars) in production.');
    }
    if (studentConfigured && configured === studentConfigured) {
      throw new Error('FATAL_SECURITY_CONFIG: ADMIN_JWT_SECRET and STUDENT_JWT_SECRET must be independently generated distinct values in production.');
    }
    return configured;
  }
  return configured || LEGACY_DEV_ADMIN_SECRET;
}

export function assertAdminJwtSecretReady(): void {
  getJwtSecret();
}

export interface AdminPayload {
  jti?: string;
  username: string;
  name?: string;
  role: string;
  tokenType?: 'admin';
  exp: number;
}

export function generateAdminToken(username: string, name?: string, role: string = 'admin'): string {
  const secret = getJwtSecret();
  const payload: AdminPayload = {
    jti: crypto.randomUUID(),
    username,
    name: name || username,
    role,
    tokenType: 'admin',
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
  return `${payloadB64}.${signature}`;
}

export function verifyAdminToken(token: string): AdminPayload | null {
  try {
    const secret = getJwtSecret();
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload: AdminPayload & { studentId?: number } = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (payload.studentId !== undefined || payload.role === 'student' || (payload.tokenType && payload.tokenType !== 'admin')) {
      return null;
    }
    if (payload.exp < Date.now()) {
      return null; // Expired
    }
    if (isAdminTokenRevoked(token, payload)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  adminUser?: AdminPayload;
}

export const AUTHORIZED_ADMIN_ROLES = new Set(['super_admin', 'admin', 'owner']);

export function isAuthorizedAdminRole(role: unknown): boolean {
  return AUTHORIZED_ADMIN_ROLES.has(String(role || '').trim().toLowerCase());
}

function getConfiguredPrimaryAdminUsername(): string {
  return (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
}

function getConfiguredEnvAdminMap(): Map<string, { role: string; name: string }> {
  const map = new Map<string, { role: string; name: string }>();
  const primaryUser = getConfiguredPrimaryAdminUsername();
  if (primaryUser) {
    map.set(primaryUser, { role: 'super_admin', name: 'Super Admin' });
  }
  const raw = process.env.ADMIN_USERS || '';
  if (raw.trim()) {
    for (const entry of raw.split(',')) {
      const parts = entry.trim().split(':');
      const u = parts[0]?.trim().toLowerCase();
      const n = parts[2]?.trim() || parts[0]?.trim() || 'Admin';
      const r = (parts[3]?.trim() || 'admin').toLowerCase();
      if (u && isAuthorizedAdminRole(r) && !map.has(u)) {
        map.set(u, { role: r, name: n });
      }
    }
  }
  return map;
}

async function verifyAdminUserInDatabaseOrEnv(
  username: string
): Promise<{ valid: boolean; role?: string; name?: string }> {
  const cleanUser = String(username || '').trim().toLowerCase();
  if (!cleanUser) return { valid: false };

  const envMap = getConfiguredEnvAdminMap();
  const envOwner = envMap.get(cleanUser);

  // 1. Check PostgreSQL admin_users table (authoritative server-side role check)
  try {
    const dbRes = await pool.query(
      'SELECT username, name, role FROM admin_users WHERE LOWER(username) = LOWER($1) LIMIT 1',
      [cleanUser]
    );
    if (dbRes.rows.length > 0) {
      const row = dbRes.rows[0];
      if (isAuthorizedAdminRole(row.role)) {
        return { valid: true, role: String(row.role).trim().toLowerCase(), name: row.name };
      }
      // If DB has an outdated/non-admin role, only allow if explicitly configured as primary env owner
      if (envOwner && cleanUser === getConfiguredPrimaryAdminUsername()) {
        return { valid: true, role: envOwner.role, name: envOwner.name };
      }
      return { valid: false };
    }
  } catch {
    // If DB is temporarily unreachable, fall back only to explicitly configured env owner/admins
  }

  // 2. Fallback to configured environment owner/admin accounts
  if (envOwner) {
    return { valid: true, role: envOwner.role, name: envOwner.name };
  }

  return { valid: false };
}

export async function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token.trim();
  }

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Missing admin authentication token. Owner access required.',
    });
  }

  const verified = verifyAdminToken(token);
  if (!verified) {
    // Explicitly reject student tokens attempting to access admin endpoints
    const studentVerified = verifyStudentToken(token);
    if (studentVerified) {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden: Access restricted. Student accounts are not permitted to access administrator endpoints.',
      });
    }
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Invalid or expired admin session token.',
    });
  }

  // Enforce distributed token revocation across all serverless / multi-instance deployments
  if (await isAdminTokenRevokedDistributed(token, verified)) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Admin session has been revoked. Please login again.',
    });
  }

  // Never trust token role blindly — verify authorized admin role server-side against PostgreSQL / env
  const serverCheck = await verifyAdminUserInDatabaseOrEnv(verified.username);
  if (!serverCheck.valid) {
    return res.status(403).json({
      status: 'error',
      message: 'Forbidden: Account does not hold authorized administrator privileges.',
    });
  }

  req.adminUser = {
    ...verified,
    role: serverCheck.role || verified.role,
    name: serverCheck.name || verified.name,
  };
  next();
}

// ----------------------------------------------------
// Student Authentication & Session Management
// ----------------------------------------------------

function getStudentJwtSecret(): string {
  const configured = (process.env.STUDENT_JWT_SECRET || '').trim();
  const adminConfigured = (process.env.ADMIN_JWT_SECRET || '').trim();
  if (isProdEnv) {
    if (
      !configured ||
      configured.length < MIN_PROD_SECRET_LENGTH ||
      configured === LEGACY_DEV_STUDENT_SECRET ||
      configured === LEGACY_DEV_ADMIN_SECRET
    ) {
      throw new Error('FATAL_SECURITY_CONFIG: STUDENT_JWT_SECRET must be explicitly configured (>= 32 chars) in production.');
    }
    if (adminConfigured && configured === adminConfigured) {
      throw new Error('FATAL_SECURITY_CONFIG: STUDENT_JWT_SECRET and ADMIN_JWT_SECRET must be independently generated distinct values in production.');
    }
    return configured;
  }
  return configured || LEGACY_DEV_STUDENT_SECRET;
}

export interface StudentPayload {
  studentId: number;
  email: string;
  fullName: string;
  targetGroup: string;
  role: 'student';
  tokenType: 'student';
  tokenVersion: number;
  sessionId?: string;
  exp: number;
  isPreview?: boolean;
}

export function assertStudentJwtSecretReady(): void {
  getStudentJwtSecret();
}

export function generateStudentToken(
  studentId: number,
  email: string,
  fullName: string,
  targetGroup: string = 'group4',
  isPreview: boolean = false,
  tokenVersion: number = 1,
  sessionId?: string,
  expiresAtMs?: number
): string {
  const secret = getStudentJwtSecret();
  const payload: StudentPayload = {
    studentId,
    email,
    fullName,
    targetGroup,
    role: 'student',
    tokenType: 'student',
    tokenVersion,
    ...(sessionId ? { sessionId } : {}),
    exp:
      expiresAtMs ||
      (isPreview ? Date.now() + 2 * 60 * 60 * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000),
    ...(isPreview ? { isPreview: true } : {}),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
  return `${payloadB64}.${signature}`;
}

export function verifyStudentToken(token: string): StudentPayload | null {
  try {
    const secret = getStudentJwtSecret();
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload: StudentPayload & { username?: string } = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (!payload.studentId || (payload.tokenType && payload.tokenType !== 'student') || (payload.role && payload.role !== 'student')) {
      return null;
    }
    if (payload.exp < Date.now()) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

export interface StudentAuthenticatedRequest extends Request {
  studentUser?: StudentPayload;
}

export function extractStudentTokenFromRequest(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const t = authHeader.substring(7).trim();
    if (t) return t;
  }
  if (req.query.token && typeof req.query.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader && typeof cookieHeader === 'string') {
    for (const part of cookieHeader.split(';')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const key = part.slice(0, idx).trim();
      if (key === 'tnpsc_student_token') {
        const val = decodeURIComponent(part.slice(idx + 1).trim());
        if (val) return val;
      }
    }
  }
  return undefined;
}

export async function requireStudentAuth(req: StudentAuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractStudentTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Missing or invalid student authentication token. Please login to continue.',
    });
  }

  const verified = verifyStudentToken(token);
  if (!verified) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Invalid or expired student session token. Please login again.',
    });
  }

  if (!verified.isPreview) {
    try {
      const dbRes = await pool.query(
        'SELECT is_active, token_version, role FROM students WHERE id = $1',
        [verified.studentId]
      );
      if (dbRes.rows.length === 0) {
        return res.status(401).json({
          status: 'error',
          message: 'Student account no longer exists. Please login again.',
        });
      }
      const row = dbRes.rows[0];
      if (row.is_active === false) {
        return res.status(403).json({
          status: 'error',
          message: 'Forbidden: Your student account has been deactivated.',
        });
      }
      if (row.role && row.role !== 'student') {
        return res.status(403).json({
          status: 'error',
          message: 'Forbidden: Invalid account role for student access.',
        });
      }
      // Enforce Single Active Device Session in PostgreSQL
      const sessionCheck = await validateActiveStudentSession(verified.studentId, verified.sessionId);
      if (!sessionCheck.valid) {
        return res.status(401).json({
          status: 'error',
          code: sessionCheck.code || 'SESSION_REVOKED_OTHER_DEVICE',
          message: sessionCheck.message || SESSION_REVOKED_MESSAGE,
        });
      }

      if (
        verified.tokenVersion !== undefined &&
        row.token_version !== undefined &&
        row.token_version !== null &&
        row.token_version !== verified.tokenVersion
      ) {
        return res.status(401).json({
          status: 'error',
          code: 'SESSION_REVOKED_OTHER_DEVICE',
          message: SESSION_REVOKED_MESSAGE,
        });
      }
    } catch (dbErr) {
      console.error('[requireStudentAuth DB check notice]:', dbErr);
    }
  }

  req.studentUser = verified;
  next();
}

export interface StudentOrAdminAuthenticatedRequest extends Request {
  studentUser?: StudentPayload;
  adminUser?: AdminPayload;
}

export async function requireStudentOrAdminAuth(
  req: StudentOrAdminAuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const token = extractStudentTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Student or administrator authentication required. Please login to continue.',
    });
  }

  const studentVerified = verifyStudentToken(token);
  if (studentVerified) {
    if (!studentVerified.isPreview) {
      try {
        const dbRes = await pool.query(
          'SELECT is_active, token_version, role FROM students WHERE id = $1',
          [studentVerified.studentId]
        );
        if (dbRes.rows.length === 0) {
          return res.status(401).json({
            status: 'error',
            message: 'Student account no longer exists. Please login again.',
          });
        }
        const row = dbRes.rows[0];
        if (row.is_active === false) {
          return res.status(403).json({
            status: 'error',
            message: 'Forbidden: Your student account has been deactivated.',
          });
        }
        if (row.role && row.role !== 'student') {
          return res.status(403).json({
            status: 'error',
            message: 'Forbidden: Invalid account role for student access.',
          });
        }
        // Enforce Single Active Device Session in PostgreSQL
        const sessionCheck = await validateActiveStudentSession(
          studentVerified.studentId,
          studentVerified.sessionId
        );
        if (!sessionCheck.valid) {
          return res.status(401).json({
            status: 'error',
            code: sessionCheck.code || 'SESSION_REVOKED_OTHER_DEVICE',
            message: sessionCheck.message || SESSION_REVOKED_MESSAGE,
          });
        }

        if (
          studentVerified.tokenVersion !== undefined &&
          row.token_version !== undefined &&
          row.token_version !== null &&
          row.token_version !== studentVerified.tokenVersion
        ) {
          return res.status(401).json({
            status: 'error',
            code: 'SESSION_REVOKED_OTHER_DEVICE',
            message: SESSION_REVOKED_MESSAGE,
          });
        }
      } catch (dbErr) {
        console.error('[requireStudentOrAdminAuth DB check notice]:', dbErr);
      }
    }
    req.studentUser = studentVerified;
    return next();
  }

  const adminVerified = verifyAdminToken(token);
  if (adminVerified) {
    if (await isAdminTokenRevokedDistributed(token, adminVerified)) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized: Admin session has been logged out. Please login again.',
      });
    }
    req.adminUser = adminVerified;
    return next();
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    (token === 'demo_token' || token === 'admin_token' || token === 'dev')
  ) {
    req.adminUser = {
      username: 'local_admin',
      name: 'Development Administrator',
      role: 'admin',
      exp: Date.now() + 86400000,
    };
    return next();
  }

  return res.status(401).json({
    status: 'error',
    message: 'Unauthorized: Invalid or expired authentication token. Please login again.',
  });
}

export function optionalStudentAuth(req: StudentAuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractStudentTokenFromRequest(req);

  if (token) {
    const verified = verifyStudentToken(token);
    if (verified) {
      req.studentUser = verified;
    }
  }
  next();
}

// ----------------------------------------------------
// Cryptographic Password Hashing & Verification
// ----------------------------------------------------

export function hashStudentPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyStudentPassword(password: string, storedHash?: string | null): boolean {
  try {
    if (!password || !storedHash || typeof storedHash !== 'string') return false;
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuf = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuf.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuf, derivedKey);
  } catch {
    return false;
  }
}

