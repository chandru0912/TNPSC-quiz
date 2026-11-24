import { Router, Request, Response, NextFunction } from 'express';
import { verifyAdminToken, AuthenticatedRequest } from '../middleware/auth';
import {
  createDriveAuthorizationUrl,
  disconnectDriveConnection,
  getDriveConnectionSummary,
  getDriveSyncLogs,
  handleDriveOAuthCallback,
  mapGoogleOAuthErrorToDiagnostic,
  runDriveOAuthDiagnostics,
  resolveCanonicalRedirectUri,
  resolveSafeFrontendOrigin,
  syncDriveTextbooksMetadata,
  verifySignedOAuthState,
} from '../services/driveOAuthService';

const router = Router();

/**
 * Strict Admin authentication for all Google Drive OAuth & Sync routes.
 * Never bypasses authentication in development mode.
 */
export function requireDriveAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (typeof req.query?.token === 'string' && req.query.token.trim()) {
    token = req.query.token.trim();
  }

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Administrator authentication is required for Google Drive management.',
    });
  }

  const verified = verifyAdminToken(token);
  if (!verified) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Invalid or expired administrator session token.',
    });
  }

  const role = String(verified.role || '').toLowerCase();
  if (!['admin', 'super_admin', 'editor'].includes(role)) {
    return res.status(403).json({
      status: 'error',
      message: 'Forbidden: Only authorized administrators may manage Google Drive integration.',
    });
  }

  req.adminUser = verified;
  return next();
}

// Prevent caching of any OAuth or Drive status response
router.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

/**
 * GET /api/drive/oauth/start (and alias /api/drive/auth/url)
 * Admin-only: Generates a CSRF-protected Google OAuth 2.0 authorization URL.
 */
router.get(['/oauth/start', '/auth/url'], requireDriveAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const reqHost = String(req.headers['x-forwarded-host'] || req.headers.host || '');
    const originHint =
      typeof req.query.origin === 'string' && req.query.origin.trim()
        ? req.query.origin.trim()
        : typeof req.headers.referer === 'string'
        ? req.headers.referer
        : undefined;

    const { authUrl, redirectUri } = createDriveAuthorizationUrl({
      adminId: Number((req.adminUser as any)?.id ?? (req.adminUser as any)?.adminId) || null,
      adminUsername: req.adminUser?.username || 'admin',
      frontendOrigin: originHint,
      reqHostHint: reqHost,
    });

    return res.status(200).json({
      status: 'success',
      data: {
        authUrl,
        redirectUri,
      },
    });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      message: err?.message || 'Failed to initiate Google Drive OAuth flow.',
    });
  }
});

/**
 * GET /api/drive/oauth/callback
 * Google OAuth 2.0 callback: validates CSRF state, exchanges code using canonical redirect URI,
 * checks admin email allowlist, encrypts tokens with AES-256-GCM, and redirects to Textbook Management.
 */
router.get('/oauth/callback', async (req: Request, res: Response) => {
  const { code, state, error: googleError } = req.query;
  const reqHost = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const canonicalRedirect = resolveCanonicalRedirectUri(reqHost);

  let safeFrontend = resolveSafeFrontendOrigin(null);
  if (typeof state === 'string' && state.trim()) {
    const preCheck = verifySignedOAuthState(state.trim());
    if (preCheck.valid && preCheck.payload?.frontendOrigin) {
      safeFrontend = resolveSafeFrontendOrigin(preCheck.payload.frontendOrigin);
    }
  }

  const textbookMgmtUrl = `${safeFrontend}/admin/textbook-management`;

  if (googleError) {
    const diagnostic = mapGoogleOAuthErrorToDiagnostic(String(googleError), canonicalRedirect);
    return res.redirect(`${textbookMgmtUrl}?drive_status=error&drive_error=${encodeURIComponent(diagnostic)}`);
  }

  if (typeof code !== 'string' || !code.trim() || typeof state !== 'string' || !state.trim()) {
    return res.redirect(
      `${textbookMgmtUrl}?drive_status=error&drive_error=${encodeURIComponent('Missing authorization code or OAuth state parameter.')}`
    );
  }

  try {
    const result = await handleDriveOAuthCallback({
      code: code.trim(),
      state: state.trim(),
      reqHostHint: reqHost,
    });

    const redirectBase = `${resolveSafeFrontendOrigin(result.frontendOrigin)}/admin/textbook-management`;
    return res.redirect(
      `${redirectBase}?drive_status=connected&email=${encodeURIComponent(result.email)}`
    );
  } catch (err: any) {
    const diagnostic = mapGoogleOAuthErrorToDiagnostic(
      err?.message || 'Google Drive OAuth callback failed.',
      canonicalRedirect
    );
    return res.redirect(`${textbookMgmtUrl}?drive_status=error&drive_error=${encodeURIComponent(diagnostic)}`);
  }
});

/**
 * GET /api/drive/oauth/diagnose (and alias /api/drive/config-check)
 * Admin-only: Safe, read-only diagnostics distinguishing unapproved test user (403 access_denied),
 * incorrect OAuth client, invalid scope, and redirect URI mismatch (never exposes secrets).
 */
router.get(['/oauth/diagnose', '/config-check'], requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reqHost = String(req.headers['x-forwarded-host'] || req.headers.host || '');
    const diagnostics = await runDriveOAuthDiagnostics(reqHost);
    return res.status(200).json({
      status: 'success',
      data: diagnostics,
    });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      message: err?.message || 'Failed to run Google Drive OAuth diagnostics.',
    });
  }
});

/**
 * GET /api/drive/status
 * Admin-only: Returns connection status, connected email, sync counts, and safe diagnostics (never tokens/secrets).
 */
router.get('/status', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reqHost = String(req.headers['x-forwarded-host'] || req.headers.host || '');
    const summary = await getDriveConnectionSummary(reqHost);
    return res.status(200).json({
      status: 'success',
      data: summary,
    });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      message: err?.message || 'Failed to read Google Drive connection status.',
    });
  }
});

/**
 * POST /api/drive/sync
 * Admin-only: Runs metadata-only recursive PDF discovery and syncs into PostgreSQL textbooks table.
 */
router.post('/sync', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const folderName =
      typeof req.body?.folderName === 'string' && req.body.folderName.trim()
        ? req.body.folderName.trim()
        : undefined;

    const result = await syncDriveTextbooksMetadata({
      adminId: Number((req.adminUser as any)?.id ?? (req.adminUser as any)?.adminId) || null,
      adminUsername: req.adminUser?.username || 'admin',
      folderName,
    });

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      uiStatus: err?.uiStatus || 'SYNC_FAILED',
      message: err?.message || 'Google Drive textbook synchronization failed.',
    });
  }
});

/**
 * POST /api/drive/disconnect
 * Admin-only: Disconnects the authorized Google Drive account (removes encrypted tokens; preserves Drive files & textbooks).
 */
router.post('/disconnect', requireDriveAdminAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await disconnectDriveConnection();
    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      message: err?.message || 'Failed to disconnect Google Drive.',
    });
  }
});

/**
 * GET /api/drive/sync-logs
 * Admin-only: Returns recent Drive textbook metadata synchronization runs.
 */
router.get('/sync-logs', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20;
    const logs = await getDriveSyncLogs(limit);
    return res.status(200).json({
      status: 'success',
      data: logs,
    });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      message: err?.message || 'Failed to load Google Drive sync logs.',
    });
  }
});

export default router;
