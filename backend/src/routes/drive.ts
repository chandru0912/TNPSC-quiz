import { Router, Request, Response, NextFunction } from 'express';
import { verifyAdminToken, AuthenticatedRequest } from '../middleware/auth';
import {
  applyDriveTextbookWorkflowAction,
  createDriveAuthorizationUrl,
  disconnectDriveConnection,
  DRIVE_OAUTH_SCOPES,
  getDriveConnectionSummary,
  getDriveSyncLogs,
  handleDriveOAuthCallback,
  listDriveFolders,
  listDriveTextbooksForAdmin,
  mapGoogleOAuthErrorToDiagnostic,
  openDriveTextbookPdfStream,
  resolveCanonicalRedirectUri,
  resolveSafeFrontendOrigin,
  resyncSingleDriveTextbook,
  syncDriveTextbooksMetadata,
  updateDriveTextbookMetadataById,
  validateDriveOAuthConfig,
  verifyLiveDriveConnection,
  verifySignedOAuthState,
} from '../services/driveOAuthService';
import {
  bulkPublishDriveTextbooks,
  bulkSoftDeleteDriveTextbooks,
  bulkUnpublishDriveTextbooks,
  BulkSelectionScope,
  getDriveTextbookAuditLogs,
  getDriveTextbookCounts,
  queryDriveTextbooksPaginated,
  restoreTrashedDriveTextbooks,
} from '../services/driveBulkTextbookService';

const router = Router();

/**
 * Strict Admin authentication for all Google Drive OAuth, Sync & Textbook Review routes.
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

/**
 * Strict Super Admin authorization for global / destructive bulk textbook operations.
 */
export function requireSuperAdminDriveAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return requireDriveAdminAuth(req, res, () => {
    const role = String(req.adminUser?.role || '').toLowerCase();
    if (role !== 'super_admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden: Only Super Admin can perform bulk publish, unpublish, or deletion operations.',
      });
    }
    return next();
  });
}

router.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

router.get('/oauth/start', requireDriveAdminAuth, (req: AuthenticatedRequest, res: Response) => {
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

    return res.status(200).json({ status: 'success', data: { authUrl, redirectUri } });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      message: err?.message || 'Failed to initiate Google Drive OAuth flow.',
    });
  }
});

router.get('/oauth/diagnose', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reqHost = String(req.headers['x-forwarded-host'] || req.headers.host || '');
    const cfg = validateDriveOAuthConfig(reqHost);
    const summary = await getDriveConnectionSummary(reqHost);
    const maskedClientId = cfg.clientId
      ? `${cfg.clientId.slice(0, 14)}...${cfg.clientId.slice(-24)}`
      : null;

    return res.status(200).json({
      status: 'success',
      data: {
        valid: cfg.valid,
        environment: cfg.environment,
        maskedClientId,
        redirectUri: cfg.redirectUri,
        scopes: DRIVE_OAUTH_SCOPES,
        errors: cfg.errors,
        connection: summary,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err?.message || 'Diagnostics failed.' });
  }
});

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
      `${redirectBase}?drive_status=connected&verified=${result.verified ? '1' : '0'}&email=${encodeURIComponent(result.email)}`
    );
  } catch (err: any) {
    const diagnostic = mapGoogleOAuthErrorToDiagnostic(
      err?.message || 'Google Drive OAuth callback failed.',
      canonicalRedirect
    );
    return res.redirect(`${textbookMgmtUrl}?drive_status=error&drive_error=${encodeURIComponent(diagnostic)}`);
  }
});

router.get('/status', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reqHost = String(req.headers['x-forwarded-host'] || req.headers.host || '');
    const forceVerify = req.query.verify === 'true';
    const summary = forceVerify
      ? await verifyLiveDriveConnection(reqHost)
      : await getDriveConnectionSummary(reqHost);
    return res.status(200).json({ status: 'success', data: summary });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      message: err?.message || 'Failed to read Google Drive connection status.',
    });
  }
});

router.post('/verify', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reqHost = String(req.headers['x-forwarded-host'] || req.headers.host || '');
    const summary = await verifyLiveDriveConnection(reqHost);
    return res.status(200).json({ status: 'success', data: summary });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      message: err?.message || 'Failed to verify Google Drive connection.',
    });
  }
});

router.get('/folders', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parentId = typeof req.query.parentId === 'string' && req.query.parentId.trim()
      ? req.query.parentId.trim()
      : undefined;
    const folders = await listDriveFolders(parentId);
    return res.status(200).json({ status: 'success', data: folders });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      message: err?.message || 'Failed to browse Google Drive folders.',
    });
  }
});

router.post('/sync', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const folderId = typeof req.body?.folderId === 'string' && req.body.folderId.trim() ? req.body.folderId.trim() : undefined;
    const folderName = typeof req.body?.folderName === 'string' && req.body.folderName.trim() ? req.body.folderName.trim() : undefined;

    const result = await syncDriveTextbooksMetadata({
      adminId: Number((req.adminUser as any)?.id ?? (req.adminUser as any)?.adminId) || null,
      adminUsername: req.adminUser?.username || 'admin',
      folderId,
      folderName,
    });

    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      uiStatus: err?.uiStatus || 'CONNECTION_FAILED',
      message: err?.message || 'Google Drive textbook synchronization failed.',
    });
  }
});

router.get('/files', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = await listDriveTextbooksForAdmin({
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      standard: typeof req.query.standard === 'string' ? req.query.standard : undefined,
      termOrVolume: typeof req.query.termOrVolume === 'string' ? req.query.termOrVolume : undefined,
      subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
      medium: typeof req.query.medium === 'string' ? req.query.medium : undefined,
      publicationStatus: typeof req.query.publicationStatus === 'string' ? req.query.publicationStatus : undefined,
    });
    return res.status(200).json({ status: 'success', data: files });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err?.message || 'Failed to list Drive textbooks.' });
  }
});

router.put('/files/:id(\\d+)', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await updateDriveTextbookMetadataById(Number(req.params.id), req.body || {});
    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Drive textbook record not found.' });
    }
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ status: 'error', message: err?.message || 'Failed to update metadata.' });
  }
});

router.post('/files/:id(\\d+)/resync', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await resyncSingleDriveTextbook(Number(req.params.id));
    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Drive textbook record not found.' });
    }
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ status: 'error', message: err?.message || 'Failed to resync Drive file.' });
  }
});

router.post('/files/:id(\\d+)/review', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const action = req.body?.action as 'mark_review' | 'approve' | 'reject' | 'publish' | 'unpublish';
    if (!['mark_review', 'approve', 'reject', 'publish', 'unpublish'].includes(action)) {
      return res.status(400).json({ status: 'error', message: 'Invalid review action.' });
    }
    const result = await applyDriveTextbookWorkflowAction({
      ids: [Number(req.params.id)],
      action,
      adminUsername: req.adminUser?.username || 'admin',
    });
    if (result.updatedCount === 0 && result.failed.length > 0) {
      return res.status(400).json({ status: 'error', message: result.failed[0].reason, data: result });
    }
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ status: 'error', message: err?.message || 'Review action failed.' });
  }
});

router.post('/files/bulk-action', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const action = req.body?.action as 'mark_review' | 'approve' | 'reject' | 'publish' | 'unpublish';
    if (!['mark_review', 'approve', 'reject', 'publish', 'unpublish'].includes(action)) {
      return res.status(400).json({ status: 'error', message: 'Invalid bulk action.' });
    }
    const result = await applyDriveTextbookWorkflowAction({
      ids,
      action,
      adminUsername: req.adminUser?.username || 'admin',
    });
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ status: 'error', message: err?.message || 'Bulk action failed.' });
  }
});

router.get('/files/:id(\\d+)/preview', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { stream, fileName, fileSize, mimeType } = await openDriveTextbookPdfStream({
      textbookId: Number(req.params.id),
      isAdmin: true,
    });
    const safeAscii = fileName.replace(/["\\\r\n]/g, '_');
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    if (fileSize > 0) res.setHeader('Content-Length', String(fileSize));

    req.on('close', () => {
      if (typeof (stream as any).destroy === 'function') (stream as any).destroy();
    });
    stream.on('error', () => {
      if (!res.headersSent) res.status(502).json({ status: 'error', message: 'Failed to stream PDF from Google Drive.' });
      else res.end();
    });
    stream.pipe(res);
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      message: err?.message || 'Unable to preview PDF from Google Drive.',
    });
  }
});

router.post('/disconnect', requireDriveAdminAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await disconnectDriveConnection();
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      message: err?.message || 'Failed to disconnect Google Drive.',
    });
  }
});

router.get('/sync-logs', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20;
    const logs = await getDriveSyncLogs(limit);
    return res.status(200).json({ status: 'success', data: logs });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err?.message || 'Failed to load Google Drive sync logs.' });
  }
});

// ============================================================================
// SCALABLE BULK TEXTBOOK MANAGEMENT APIs (PAGINATED, TRANSACTIONAL, AUDITED)
// ============================================================================

const ALLOWED_SCOPES: BulkSelectionScope[] = ['selected', 'filtered', 'all', 'pending_review', 'published'];

router.get('/textbooks/counts', requireDriveAdminAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const counts = await getDriveTextbookCounts();
    return res.status(200).json({ status: 'success', data: counts });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err?.message || 'Failed to fetch textbook counts.' });
  }
});

router.get('/textbooks', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await queryDriveTextbooksPaginated({
      page: typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1,
      pageSize: typeof req.query.pageSize === 'string' ? parseInt(req.query.pageSize, 10) : 25,
      sortBy: typeof req.query.sortBy === 'string' ? req.query.sortBy : 'standard',
      sortDir: req.query.sortDir === 'desc' ? 'desc' : 'asc',
      filters: {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        standard: typeof req.query.standard === 'string' ? req.query.standard : undefined,
        termOrVolume: typeof req.query.termOrVolume === 'string' ? req.query.termOrVolume : undefined,
        subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
        medium: typeof req.query.medium === 'string' ? req.query.medium : undefined,
        publicationStatus: typeof req.query.publicationStatus === 'string' ? req.query.publicationStatus : undefined,
        includeTrashed: req.query.trashed === 'true',
      },
    });
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err?.message || 'Failed to query textbooks.' });
  }
});

router.post('/textbooks/bulk-publish', requireSuperAdminDriveAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = String(req.body?.scope || 'selected') as BulkSelectionScope;
    if (!ALLOWED_SCOPES.includes(scope)) {
      return res.status(400).json({ status: 'error', message: 'Invalid bulk selection scope.' });
    }
    const result = await bulkPublishDriveTextbooks({
      scope,
      selectedIds: Array.isArray(req.body?.selectedIds) ? req.body.selectedIds : [],
      excludedIds: Array.isArray(req.body?.excludedIds) ? req.body.excludedIds : [],
      filters: req.body?.filters || undefined,
      approvePending: Boolean(req.body?.approvePending),
      dryRun: Boolean(req.body?.dryRun),
      adminUsername: req.adminUser?.username || 'super_admin',
      adminRole: req.adminUser?.role || 'super_admin',
    });
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      message: err?.message || 'Bulk publish failed.',
    });
  }
});

router.post('/textbooks/bulk-unpublish', requireSuperAdminDriveAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = String(req.body?.scope || 'selected') as BulkSelectionScope;
    if (!ALLOWED_SCOPES.includes(scope)) {
      return res.status(400).json({ status: 'error', message: 'Invalid bulk selection scope.' });
    }
    const result = await bulkUnpublishDriveTextbooks({
      scope,
      selectedIds: Array.isArray(req.body?.selectedIds) ? req.body.selectedIds : [],
      excludedIds: Array.isArray(req.body?.excludedIds) ? req.body.excludedIds : [],
      filters: req.body?.filters || undefined,
      dryRun: Boolean(req.body?.dryRun),
      adminUsername: req.adminUser?.username || 'super_admin',
      adminRole: req.adminUser?.role || 'super_admin',
    });
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      message: err?.message || 'Bulk unpublish failed.',
    });
  }
});

router.post('/textbooks/bulk-delete', requireSuperAdminDriveAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = String(req.body?.scope || 'selected') as BulkSelectionScope;
    if (!ALLOWED_SCOPES.includes(scope)) {
      return res.status(400).json({ status: 'error', message: 'Invalid bulk selection scope.' });
    }
    const result = await bulkSoftDeleteDriveTextbooks({
      scope,
      selectedIds: Array.isArray(req.body?.selectedIds) ? req.body.selectedIds : [],
      excludedIds: Array.isArray(req.body?.excludedIds) ? req.body.excludedIds : [],
      filters: req.body?.filters || undefined,
      dryRun: Boolean(req.body?.dryRun),
      confirmPhrase: typeof req.body?.confirmPhrase === 'string' ? req.body.confirmPhrase : undefined,
      adminUsername: req.adminUser?.username || 'super_admin',
      adminRole: req.adminUser?.role || 'super_admin',
    });
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      message: err?.message || 'Bulk delete failed.',
    });
  }
});

router.post('/textbooks/restore', requireSuperAdminDriveAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await restoreTrashedDriveTextbooks({
      ids: Array.isArray(req.body?.ids) ? req.body.ids : [],
      restoreAll: Boolean(req.body?.restoreAll),
      adminUsername: req.adminUser?.username || 'super_admin',
      adminRole: req.adminUser?.role || 'super_admin',
    });
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      status: 'error',
      message: err?.message || 'Restore from trash failed.',
    });
  }
});

router.get('/textbooks/audit-logs', requireDriveAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 30;
    const logs = await getDriveTextbookAuditLogs(limit);
    return res.status(200).json({ status: 'success', data: logs });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err?.message || 'Failed to load audit logs.' });
  }
});

export default router;
