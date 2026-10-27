import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const SECRET = process.env.ADMIN_JWT_SECRET || 'tnpsc_quiz_admin_jwt_secret_key_2026';

export interface AdminPayload {
  username: string;
  role: 'admin';
  exp: number;
}

export function generateAdminToken(username: string): string {
  const payload: AdminPayload = {
    username,
    role: 'admin',
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(payloadB64).digest('hex');
  return `${payloadB64}.${signature}`;
}

export function verifyAdminToken(token: string): AdminPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', SECRET).update(payloadB64).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
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
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Missing or invalid Authorization header. Admin access required.',
    });
  }

  const token = authHeader.substring(7).trim();
  const verified = verifyAdminToken(token);
  if (!verified) {
    return res.status(403).json({
      status: 'error',
      message: 'Forbidden: Invalid or expired admin session token.',
    });
  }

  req.adminUser = verified;
  next();
}
