import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

function getJwtSecret(): string {
  return process.env.ADMIN_JWT_SECRET || 'tnpsc_quiz_admin_jwt_secret_key_2026';
}

export interface AdminPayload {
  username: string;
  name?: string;
  role: string;
  exp: number;
}

export function generateAdminToken(username: string, name?: string, role: string = 'admin'): string {
  const secret = getJwtSecret();
  const payload: AdminPayload = {
    username,
    name: name || username,
    role,
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

    const payload: AdminPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
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
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Missing or invalid Authorization header or token parameter. Admin access required.',
    });
  }

  const verified = verifyAdminToken(token);
  if (!verified) {
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
  exp: number;
  isPreview?: boolean;
}

export function generateStudentToken(
  studentId: number,
  email: string,
  fullName: string,
  targetGroup: string = 'group4',
  isPreview: boolean = false
): string {
  const secret = getStudentJwtSecret();
  const payload: StudentPayload = {
    studentId,
    email,
    fullName,
    targetGroup,
    exp: isPreview ? Date.now() + 2 * 60 * 60 * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000, // 2h for preview, 30d for normal
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

    const payload: StudentPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
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

export function requireStudentAuth(req: StudentAuthenticatedRequest, res: Response, next: NextFunction) {
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
    return res.status(403).json({
      status: 'error',
      message: 'Forbidden: Invalid or expired student session token. Please login again.',
    });
  }

  req.studentUser = verified;
  next();
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

export function verifyStudentPassword(password: string, storedHash: string): boolean {
  try {
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

