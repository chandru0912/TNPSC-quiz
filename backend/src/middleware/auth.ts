import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import pool from '../db';
import {
  validateActiveStudentSession,
  SESSION_REVOKED_MESSAGE,
} from '../services/studentSessionService';

function getJwtSecret(): string {
  return process.env.ADMIN_JWT_SECRET || 'tnpsc_quiz_admin_jwt_secret_key_2026';
}

export interface AdminPayload {
  username: string;
  name?: string;
  role: string;
  tokenType?: 'admin';
  exp: number;
}

export function generateAdminToken(username: string, name?: string, role: string = 'admin'): string {
  const secret = getJwtSecret();
  const payload: AdminPayload = {
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
    return payload;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  adminUser?: AdminPayload;
}

export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token.trim();
  }

  if (!token) {
    if (process.env.NODE_ENV !== 'production') {
      req.adminUser = { username: 'local_admin', name: 'Development Administrator', role: 'admin', exp: Date.now() + 86400000 };
      return next();
    }
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Missing or invalid Authorization header or token parameter. Admin access required.',
    });
  }

  const verified = verifyAdminToken(token);
  if (!verified) {
    // In local development, permit dev token or fallback admin session
    if (process.env.NODE_ENV !== 'production' && (token === 'demo_token' || token === 'admin_token' || token === 'dev' || token.length < 20)) {
      req.adminUser = { username: 'local_admin', name: 'Development Administrator', role: 'admin', exp: Date.now() + 86400000 };
      return next();
    }
    // Check if token belongs to a student attempting to access admin endpoints
    const studentVerified = verifyStudentToken(token);
    if (studentVerified) {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden: Access restricted. Student accounts are not permitted to access administrator endpoints.',
      });
    }
    return res.status(403).json({
      status: 'error',
      message: 'Forbidden: Invalid or expired admin session token.',
    });
  }

  req.adminUser = verified;
  next();
}

// ----------------------------------------------------
// Student Authentication & Session Management
// ----------------------------------------------------

function getStudentJwtSecret(): string {
  return process.env.STUDENT_JWT_SECRET || 'tnpsc_student_session_secret_key_2026';
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

export async function requireStudentAuth(req: StudentAuthenticatedRequest, res: Response, next: NextFunction) {
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
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token.trim();
  }

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

