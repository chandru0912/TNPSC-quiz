import { Router, Request, Response } from 'express';
import pool from '../db';
import { generateAdminToken, requireAdminAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

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
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      const defaultUsers = [
        {
          username: process.env.ADMIN_USERNAME || 'admin',
          password: process.env.ADMIN_PASSWORD || 'tnpscadmin2026',
          name: 'Super Admin',
          role: 'super_admin',
        },
        {
          username: 'content_admin',
          password: 'tnpsccontent2026',
          name: 'Content Administrator',
          role: 'admin',
        },
        {
          username: 'reviewer',
          password: 'tnpscreview2026',
          name: 'Syllabus Reviewer',
          role: 'reviewer',
        },
      ];

      for (const u of defaultUsers) {
        await pool.query(
          `INSERT INTO admin_users (username, password, name, role)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (username) DO NOTHING`,
          [u.username, u.password, u.name, u.role]
        );
      }
      console.log('Seeded default admin accounts into admin_users table.');
    }
    isTableInitialized = true;
  } catch (err: any) {
    console.error('Failed to initialize admin_users table:', err.message);
  }
}

// Auto-initialize on module load
ensureAdminUsersTable().catch(console.error);

interface EnvAdmin {
  username: string;
  password: string;
  name: string;
  role: string;
}

function getEnvAdmins(): EnvAdmin[] {
  const admins: EnvAdmin[] = [];
  const primaryUser = process.env.ADMIN_USERNAME || 'admin';
  const primaryPass = process.env.ADMIN_PASSWORD || 'tnpscadmin2026';
  admins.push({
    username: primaryUser.trim(),
    password: primaryPass,
    name: 'Super Admin',
    role: 'super_admin',
  });

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
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Username and password are required',
    });
  }

  const cleanUser = String(username).trim();
  const cleanPass = String(password).trim();

  try {
    await ensureAdminUsersTable();
  } catch (err: any) {
    console.error('Admin table initialization error:', err.message);
  }

  // 1. Check in Environment variables (.env) first for production reliability
  const envAdmins = getEnvAdmins();
  const envMatch = envAdmins.find(
    (a) => a.username.toLowerCase() === cleanUser.toLowerCase() && a.password === cleanPass
  );

  if (envMatch) {
    const token = generateAdminToken(envMatch.username, envMatch.name, envMatch.role);
    return res.status(200).json({
      status: 'success',
      message: 'Admin authenticated successfully',
      token,
      user: {
        username: envMatch.username,
        name: envMatch.name,
        role: envMatch.role,
      },
    });
  }

  // 2. Check in Database admin_users table
  try {
    const dbRes = await pool.query(
      'SELECT id, username, password, name, role FROM admin_users WHERE LOWER(username) = LOWER($1)',
      [cleanUser]
    );

    if (dbRes.rows.length > 0) {
      const user = dbRes.rows[0];
      if (user.password === cleanPass) {
        const token = generateAdminToken(user.username, user.name, user.role);
        return res.status(200).json({
          status: 'success',
          message: 'Admin authenticated successfully',
          token,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
          },
        });
      }
    }
  } catch (err: any) {
    console.error('Error querying admin_users table:', err.message);
  }

  return res.status(401).json({
    status: 'error',
    message: 'Invalid admin username or password',
  });
});

/**
 * GET /api/admin/verify
 * Validates active admin session token and returns active profile
 */
router.get('/verify', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
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
 * POST /api/admin/users
 * Creates a new admin account in admin_users table
 */
router.post('/users', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
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

  if (cleanPass.length < 6) {
    return res.status(400).json({
      status: 'error',
      message: 'Password must be at least 6 characters long',
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
    const insertRes = await pool.query(
      `INSERT INTO admin_users (username, password, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, name, role, created_at`,
      [cleanUser, cleanPass, cleanName, cleanRole]
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
