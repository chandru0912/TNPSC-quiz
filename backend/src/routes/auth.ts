import { Router, Request, Response } from 'express';
import { generateAdminToken, requireAdminAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /api/admin/login
 * Validates admin credentials and issues a secure session token
 */
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  const validUsername = process.env.ADMIN_USERNAME || 'admin';
  const validPassword = process.env.ADMIN_PASSWORD || 'tnpscadmin2026';

  if (!username || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Username and password are required',
    });
  }

  if (username.trim() !== validUsername || password !== validPassword) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid admin username or password',
    });
  }

  const token = generateAdminToken(validUsername);

  return res.status(200).json({
    status: 'success',
    message: 'Admin authenticated successfully',
    token,
    user: {
      username: validUsername,
      role: 'admin',
    },
  });
});

/**
 * GET /api/admin/verify
 * Validates active admin session token
 */
router.get('/verify', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.status(200).json({
    status: 'success',
    valid: true,
    user: req.adminUser,
  });
});

export default router;
