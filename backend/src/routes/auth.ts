import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../db';
import {
  assertAdminJwtSecretReady,
  generateAdminToken,
  revokeAdminToken,
  requireAdminAuth,
  isAuthorizedAdminRole,
  AuthenticatedRequest,
} from '../middleware/auth';
import { adminLoginLimiter } from '../middleware/rateLimiter';

const router = Router();

const IS_PROD = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

function hashAdminPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyAdminPassword(plain: string, stored: string): { valid: boolean; needsRehash: boolean } {
  if (!stored) return { valid: false, needsRehash: false };
  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 3) return { valid: false, needsRehash: false };
    const [, salt, hashHex] = parts;
    const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
    return { valid: timingSafeStringEqual(derived, hashHex), needsRehash: false };
  }
  // Legacy plaintext compatibility with automatic upgrade to scrypt hash on next login
  return { valid: timingSafeStringEqual(plain, stored), needsRehash: true };
}

function isSuperAdminRole(role?: string | null): boolean {
  const r = String(role || '').trim().toLowerCase();
  return r === 'super_admin' || r === 'owner';
}

// Ensure admin_users table exists and has default accounts
let isTableInitialized = false;
export async function ensureAdminUsersTable() {
  if (isTableInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(150) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'admin',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const countRes = await pool.query('SELECT COUNT(*) FROM admin_users');
    if (parseInt(countRes.rows[0].count, 10) === 0 && process.env.ADMIN_PASSWORD) {
      const primaryUser = (process.env.ADMIN_USERNAME || 'admin').trim();
      const hashedPrimary = hashAdminPassword(process.env.ADMIN_PASSWORD.trim());
      await pool.query(
        `INSERT INTO admin_users (username, password, name, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO NOTHING`,
        [primaryUser, hashedPrimary, 'Super Admin', 'super_admin']
      );
      console.log('Seeded primary admin account into admin_users table (scrypt hashed).');
    }
    isTableInitialized = true;
  } catch (err: any) {
    console.error('Failed to initialize admin_users table:', err.message);
  }
}

// Auto-initialize on module load in non-serverless environments
if (!process.env.VERCEL) {
  ensureAdminUsersTable().catch((err) => {
    console.error('Admin table initialization failed on startup:', err.message);
  });
}

interface EnvAdmin {
  username: string;
  password: string;
  name: string;
  role: string;
}

export function getConfiguredAdminCount(): number {
  return getEnvAdmins().length;
}

function getEnvAdmins(): EnvAdmin[] {
  const admins: EnvAdmin[] = [];
  const primaryUser = (process.env.ADMIN_USERNAME || 'admin').trim();
  const primaryPass = (process.env.ADMIN_PASSWORD || '').trim();
  if (primaryPass) {
    admins.push({
      username: primaryUser,
      password: primaryPass,
      name: 'Super Admin',
      role: 'super_admin',
    });
  } else if (IS_PROD) {
    console.error('[SECURITY WARNING] ADMIN_PASSWORD is not configured in production environment.');
  }

  const rawUsers = process.env.ADMIN_USERS || '';
  if (rawUsers.trim()) {
    // Format: username:password:name:role,username:password:name:role
    const entries = rawUsers.split(',');
    for (const entry of entries) {
      const parts = entry.trim().split(':');
      if (parts.length >= 2) {
        const u = parts[0].trim();
        const p = parts[1].trim();
        const n = parts[2]?.trim() || u;
        const r = parts[3]?.trim() || 'admin';
        if (u && p && !admins.some((a) => a.username.toLowerCase() === u.toLowerCase())) {
          admins.push({ username: u, password: p, name: n, role: r });
        }
      }
    }
  }

  return admins;
}

/**
 * POST /api/admin/login
 * Validates admin credentials against database and .env, then issues a secure token
 * Environment variables take precedence to ensure production login works reliably
 */
router.post(['/login', '/owner-login', '/', '/api/admin/login', '/admin/login'], adminLoginLimiter, async (req: Request, res: Response) => {
  let authStage: 'input_validation' | 'jwt_config_check' | 'env_auth' | 'db_auth' | 'jwt_signing' = 'input_validation';
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Username and password are required',
      });
    }

    const cleanUser = String(username).trim();
    const cleanPass = String(password).trim();

    // Fail fast with a safe 503 configuration response if ADMIN_JWT_SECRET is missing/invalid/duplicate in production
    // (prevents uncaught FATAL_SECURITY_CONFIG rejections from crashing serverless invocations into HTTP 502)
    authStage = 'jwt_config_check';
    assertAdminJwtSecretReady();

    // 1. Check in Environment variables (.env) first for immediate production reliability
    authStage = 'env_auth';
    const envAdmins = getEnvAdmins();
    const envMatch = envAdmins.find(
      (a) => a.username.toLowerCase() === cleanUser.toLowerCase() && timingSafeStringEqual(a.password, cleanPass)
    );

    if (envMatch) {
      if (!isAuthorizedAdminRole(envMatch.role)) {
        return res.status(403).json({
          status: 'error',
          message: 'Forbidden: This account is not authorized for owner admin access.',
        });
      }
      // Non-blocking background table initialization
      ensureAdminUsersTable().catch((err) => {
        console.error('Background admin table initialization notice:', err.message);
      });

      authStage = 'jwt_signing';
      const normalizedRole = String(envMatch.role).trim().toLowerCase();
      const token = generateAdminToken(envMatch.username, envMatch.name, normalizedRole);
      return res.status(200).json({
        status: 'success',
        message: 'Admin authenticated successfully',
        token,
        user: {
          username: envMatch.username,
          name: envMatch.name,
          role: normalizedRole,
        },
      });
    }

    // If the username matches an environment admin account but the password did not match,
    // check if it was overridden in DB; if DB is unreachable, return 401 Invalid credentials immediately.
    const isKnownEnvUsername = envAdmins.some(
      (a) => a.username.toLowerCase() === cleanUser.toLowerCase()
    );

    authStage = 'db_auth';
    try {
      await ensureAdminUsersTable();
    } catch (err: any) {
      console.error('Admin table initialization error:', err.message);
    }

    // 2. Check in Database admin_users table
    let dbError: string | null = null;
    let matchedDbUser: { id: number; username: string; name: string; role: string } | null = null;
    try {
      const dbRes = await pool.query(
        'SELECT id, username, password, name, role FROM admin_users WHERE LOWER(username) = LOWER($1)',
        [cleanUser]
      );

      if (dbRes.rows.length > 0) {
        const user = dbRes.rows[0];
        if (!isAuthorizedAdminRole(user.role)) {
          return res.status(403).json({
            status: 'error',
            message: 'Forbidden: This account is not authorized for owner admin access.',
          });
        }
        const passCheck = verifyAdminPassword(cleanPass, String(user.password || ''));
        if (passCheck.valid) {
          if (passCheck.needsRehash) {
            pool
              .query('UPDATE admin_users SET password = $1 WHERE id = $2', [hashAdminPassword(cleanPass), user.id])
              .catch((e: any) => console.warn('[AdminAuth] Failed to upgrade legacy admin password hash:', e?.message));
          }
          matchedDbUser = {
            id: user.id,
            username: user.username,
            name: user.name,
            role: String(user.role).trim().toLowerCase(),
          };
        } else {
          console.warn('Admin login failed: password mismatch for existing DB user');
          return res.status(401).json({
            status: 'error',
            message: 'Invalid admin username or password',
          });
        }
      } else {
        console.warn('Admin login failed: user not found in DB and not in env');
      }
    } catch (err: any) {
      dbError = err.message || 'Database connection error';
      console.error('Error querying admin_users table during login:', err.message);
    }

    if (matchedDbUser) {
      authStage = 'jwt_signing';
      const token = generateAdminToken(matchedDbUser.username, matchedDbUser.name, matchedDbUser.role);
      return res.status(200).json({
        status: 'success',
        message: 'Admin authenticated successfully',
        token,
        user: {
          id: matchedDbUser.id,
          username: matchedDbUser.username,
          name: matchedDbUser.name,
          role: matchedDbUser.role,
        },
      });
    }

    if (dbError && !isKnownEnvUsername) {
      return res.status(503).json({
        status: 'error',
        message: 'Database service is currently unavailable. Please verify the database connection configuration.',
        dbStatus: 'disconnected',
      });
    }

    return res.status(401).json({
      status: 'error',
      message: 'Invalid admin username or password',
    });
  } catch (err: any) {
    const rawMsg = String(err?.message || '');
    if (rawMsg.includes('FATAL_SECURITY_CONFIG') || authStage === 'jwt_config_check' || authStage === 'jwt_signing') {
      console.error('[Admin Auth Config Error]:', {
        stage: authStage,
        code: 'BACKEND_AUTH_CONFIG_ERROR',
      });
      return res.status(503).json({
        status: 'error',
        code: 'BACKEND_AUTH_CONFIG_ERROR',
        message: 'Server authentication configuration error. Please contact the administrator to verify ADMIN_JWT_SECRET and STUDENT_JWT_SECRET.',
      });
    }

    console.error('[Admin Auth Unexpected Error]:', {
      stage: authStage,
      code: err?.code || null,
    });
    return res.status(500).json({
      status: 'error',
      code: 'ADMIN_LOGIN_INTERNAL_ERROR',
      message: 'An unexpected server error occurred during admin authentication. Please try again.',
    });
  }
});

/**
 * GET /api/admin/verify
 * Validates active admin session token and returns active profile
 */
router.get('/verify', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return res.status(200).json({
    status: 'success',
    valid: true,
    user: req.adminUser,
  });
});

/**
 * GET /api/admin/users
 * Returns list of all admin accounts (combining DB and .env)
 */
router.get('/users', requireAdminAuth, async (_req: AuthenticatedRequest, res: Response) => {
  await ensureAdminUsersTable();
  try {
    const dbRes = await pool.query(
      'SELECT id, username, name, role, created_at FROM admin_users ORDER BY id ASC'
    );
    const dbUsers = dbRes.rows.map((row) => ({
      id: row.id,
      username: row.username,
      name: row.name,
      role: row.role,
      source: 'database',
      createdAt: row.created_at,
    }));

    const envAdmins = getEnvAdmins();
    const envUsers = envAdmins
      .filter((ea) => !dbUsers.some((du) => du.username.toLowerCase() === ea.username.toLowerCase()))
      .map((ea, idx) => ({
        id: -1 * (idx + 1),
        username: ea.username,
        name: ea.name,
        role: ea.role,
        source: 'env',
        createdAt: null,
      }));

    return res.status(200).json({
      status: 'success',
      users: [...dbUsers, ...envUsers],
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to fetch admin users',
    });
  }
});

/**
 * POST /api/admin/logout
 * Persistently revokes the current admin session token (JTI) in PostgreSQL across all server instances
 */
router.post('/logout', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
  if (token) {
    try {
      await revokeAdminToken(token, req.adminUser);
    } catch (err: any) {
      console.error('[AdminAuth] Failed to persist admin token revocation:', err?.message || err);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to revoke admin session. Please retry.',
      });
    }
  }
  return res.status(200).json({
    status: 'success',
    message: 'Admin logged out successfully',
  });
});

/**
 * POST /api/admin/users
 * Creates a new admin account in admin_users table (super_admin / owner only)
 */
router.post('/users', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isSuperAdminRole(req.adminUser?.role)) {
    return res.status(403).json({
      status: 'error',
      message: 'Forbidden: Only super administrators can create admin accounts.',
    });
  }
  await ensureAdminUsersTable();
  const { username, password, name, role } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({
      status: 'error',
      message: 'Username, password, and display name are required',
    });
  }

  const cleanUser = String(username).trim().toLowerCase();
  const cleanPass = String(password).trim();
  const cleanName = String(name).trim();
  const cleanRole = role && ['super_admin', 'admin', 'reviewer', 'editor'].includes(role) ? role : 'admin';

  if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUser)) {
    return res.status(400).json({
      status: 'error',
      message: 'Username must be 3-30 characters long and contain only letters, numbers, or underscores',
    });
  }

  if (cleanPass.length < 8) {
    return res.status(400).json({
      status: 'error',
      message: 'Password must be at least 8 characters long',
    });
  }

  // Check if username exists in .env
  const envAdmins = getEnvAdmins();
  if (envAdmins.some((ea) => ea.username.toLowerCase() === cleanUser)) {
    return res.status(409).json({
      status: 'error',
      message: `An admin account with username "${cleanUser}" already exists in environment configuration`,
    });
  }

  try {
    const hashedPassword = hashAdminPassword(cleanPass);
    const insertRes = await pool.query(
      `INSERT INTO admin_users (username, password, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, name, role, created_at`,
      [cleanUser, hashedPassword, cleanName, cleanRole]
    );

    return res.status(201).json({
      status: 'success',
      message: `Admin account "${cleanUser}" created successfully`,
      user: {
        id: insertRes.rows[0].id,
        username: insertRes.rows[0].username,
        name: insertRes.rows[0].name,
        role: insertRes.rows[0].role,
        source: 'database',
        createdAt: insertRes.rows[0].created_at,
      },
    });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({
        status: 'error',
        message: `Username "${cleanUser}" is already taken`,
      });
    }
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Database error while creating admin user',
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Removes an admin account from database (cannot delete root super_admin)
 */
router.delete('/users/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isSuperAdminRole(req.adminUser?.role)) {
    return res.status(403).json({
      status: 'error',
      message: 'Forbidden: Only super administrators can delete admin accounts.',
    });
  }
  await ensureAdminUsersTable();
  const userId = parseInt(req.params.id, 10);

  if (isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid user ID or user is configured in .env (environment admins cannot be deleted via API)',
    });
  }

  try {
    const userRes = await pool.query('SELECT username FROM admin_users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin account not found',
      });
    }

    if (userRes.rows[0].username.toLowerCase() === 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Cannot delete the primary root admin account',
      });
    }

    await pool.query('DELETE FROM admin_users WHERE id = $1', [userId]);

    return res.status(200).json({
      status: 'success',
      message: `Admin account "${userRes.rows[0].username}" deleted successfully`,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to delete admin account',
    });
  }
});

export default router;
