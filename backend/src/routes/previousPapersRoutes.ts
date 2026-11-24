import { Router, Request, Response, NextFunction } from 'express';
import {
  requireAdminAuth,
  requireStudentAuth,
  verifyAdminToken,
  AuthenticatedRequest,
  StudentAuthenticatedRequest,
} from '../middleware/auth';
import { AIProviderConfigService } from '../services/ai/ai-provider-config.service';
import {
  cancelGeminiTextJob,
  getGeminiPreviousPaperProviderStatus,
  getGeminiTextJob,
  processSourceTextWithGemini,
  retryFailedBatchesForTextJob,
  validateAndNormalizeJsonSource,
  validateSourceTextInput,
} from '../services/previousPaperAIService';
import {
  listPreviousPapers,
  startOrResumePaperSession,
  saveSessionAnswer,
  submitPaperSession,
  getSessionResult,
} from '../services/previousPapersService';
import {
  getAdminPreviousPapersStats,
  listAdminPreviousPapersPaginated,
  getAdminPreviousPaperDetail,
  createPaperFromPastedQuestions,
  approvePaperQuestions,
  updateAdminPreviousPaperMeta,
  saveAdminPreviousPaperQuestions,
  updateAdminPreviousPaperStatus,
  deleteAdminPreviousPaper,
} from '../services/previousPapersAdminService';
import {
  bulkApprovePreviousPapers,
  bulkPublishPreviousPapers,
  bulkRejectPreviousPapers,
  bulkRestorePreviousPapers,
  bulkSoftDeletePreviousPapers,
  bulkUnpublishPreviousPapers,
  listPreviousPaperAuditLogs,
  PaperBulkScope,
  previewBulkPreviousPapers,
} from '../services/previousPapersBulkService';

const router = Router();
export const adminPreviousPapersRouter = Router();
adminPreviousPapersRouter.use(requireAdminAuth);

/**
 * Strict Super Admin authorization for bulk publish, unpublish, delete & restore endpoints.
 */
export function requireSuperAdminPapersAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
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
      message: 'Unauthorized: Super Admin authentication is required for bulk examination operations.',
    });
  }

  const verified = verifyAdminToken(token);
  if (!verified) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Invalid or expired administrator session token.',
    });
  }

  if (String(verified.role || '').toLowerCase() !== 'super_admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Forbidden: Only Super Admin can perform bulk publish, unpublish, or deletion operations.',
    });
  }

  req.adminUser = verified;
  return next();
}

function parseBulkSelectionBody(body: any) {
  const rawScope = String(body?.scope || '').toLowerCase();
  const scope: PaperBulkScope =
    rawScope === 'all' || rawScope === 'filtered' ? rawScope : 'selected';
  const selectedIds = Array.isArray(body?.selectedIds)
    ? body.selectedIds
    : Array.isArray(body?.paperIds)
      ? body.paperIds
      : [];
  const excludedIds = Array.isArray(body?.excludedIds) ? body.excludedIds : [];
  const filters = body?.filters && typeof body.filters === 'object' ? body.filters : undefined;
  return { scope, selectedIds, excludedIds, filters };
}

// GET /api/admin/previous-papers/stats
adminPreviousPapersRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getAdminPreviousPapersStats();
    return res.status(200).json({ status: 'success', data: stats });
  } catch (err: any) {
    console.error('[Admin Previous Papers Stats Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load stats.' });
  }
});

// GET /api/admin/previous-papers
adminPreviousPapersRouter.get('/', async (req: Request, res: Response) => {
  try {
    const sortByRaw = typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined;
    const sortBy =
      sortByRaw === 'year' || sortByRaw === 'exam' || sortByRaw === 'status' || sortByRaw === 'questions'
        ? sortByRaw
        : 'year';
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
    const result = await listAdminPreviousPapersPaginated({
      group: typeof req.query.group === 'string' ? req.query.group : undefined,
      year: typeof req.query.year === 'string' ? req.query.year : undefined,
      subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
      medium: typeof req.query.medium === 'string' ? req.query.medium : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      includeDeleted: req.query.includeDeleted === 'true' || req.query.trash === 'true',
      sortBy,
      sortDir,
      page: typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1,
      limit: typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50,
    });
    return res.status(200).json({ status: 'success', data: result.items, pagination: result.pagination });
  } catch (err: any) {
    console.error('[Admin Previous Papers List Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to list papers.' });
  }
});

// GET /api/admin/previous-papers/:id
adminPreviousPapersRouter.get('/:id(\\d+)', async (req: Request, res: Response) => {
  try {
    const detail = await getAdminPreviousPaperDetail(Number(req.params.id));
    if (!detail) {
      return res.status(404).json({ status: 'error', message: 'Examination not found.' });
    }
    return res.status(200).json({ status: 'success', data: detail });
  } catch (err: any) {
    console.error('[Admin Previous Paper Detail Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load examination.' });
  }
});

// POST /api/admin/previous-papers/manual-paste (Save parsed pasted questions into STAGING)
adminPreviousPapersRouter.post('/manual-paste', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const b = req.body || {};
    const questions = Array.isArray(b.questions) ? b.questions : [];
    const created = await createPaperFromPastedQuestions({
      group: String(b.group || 'group4'),
      year: Number(b.year || new Date().getFullYear()),
      examStream: b.examStream ? String(b.examStream) : undefined,
      subject: b.subject ? String(b.subject) : undefined,
      paperTitle: String(b.paperTitle || ''),
      paperType: b.paperType ? String(b.paperType) : 'Prelims',
      medium: b.medium ? String(b.medium) : 'English',
      totalQuestions: b.totalQuestions ? Number(b.totalQuestions) : questions.length,
      marksPerQuestion: b.marksPerQuestion ? Number(b.marksPerQuestion) : 1.5,
      negativeMarking: b.negativeMarking !== undefined ? Number(b.negativeMarking) : 0,
      durationMinutes: b.durationMinutes ? Number(b.durationMinutes) : 180,
      questions,
      adminId: null,
    });
    return res.status(201).json({ status: 'success', data: created });
  } catch (err: any) {
    const code = Number(err?.statusCode) || 500;
    console.error('[Admin Manual Paste Save Error]:', err);
    return res.status(code).json({ status: 'error', message: err.message || 'Failed to save pasted questions to Staging.' });
  }
});

// PATCH /api/admin/previous-papers/:id/questions/approve (Individual or Bulk Question Approval)
adminPreviousPapersRouter.patch('/:id(\\d+)/questions/approve', async (req: Request, res: Response) => {
  try {
    const paperId = Number(req.params.id);
    const b = req.body || {};
    const updated = await approvePaperQuestions(paperId, {
      questionIds: Array.isArray(b.questionIds) ? b.questionIds : undefined,
      approveAllValid: Boolean(b.approveAllValid),
      isApproved: b.isApproved !== false,
    });
    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Examination not found.' });
    }
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    const code = Number(err?.statusCode) || 500;
    console.error('[Admin Approve Paper Questions Error]:', err);
    return res.status(code).json({ status: 'error', message: err.message || 'Failed to approve questions.' });
  }
});

// POST /api/admin/previous-papers/bulk-preview
adminPreviousPapersRouter.post('/bulk-preview', requireSuperAdminPapersAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const selection = parseBulkSelectionBody(req.body);
    const preview = await previewBulkPreviousPapers(selection);
    return res.status(200).json({ status: 'success', data: preview });
  } catch (err: any) {
    const code = Number(err?.statusCode) || 500;
    return res.status(code).json({ status: 'error', message: err.message || 'Failed to compute bulk preview.' });
  }
});

// POST /api/admin/previous-papers/bulk-approve
adminPreviousPapersRouter.post('/bulk-approve', requireSuperAdminPapersAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const selection = parseBulkSelectionBody(req.body);
    const result = await bulkApprovePreviousPapers(selection, {
      adminUsername: req.adminUser?.username || 'super_admin',
      adminRole: req.adminUser?.role || 'super_admin',
    });
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    const code = Number(err?.statusCode) || 500;
    return res.status(code).json({ status: 'error', message: err.message || 'Failed to bulk approve examinations.' });
  }
});

// POST /api/admin/previous-papers/bulk-reject
adminPreviousPapersRouter.post('/bulk-reject', requireSuperAdminPapersAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const selection = parseBulkSelectionBody(req.body);
    const result = await bulkRejectPreviousPapers(
      {
        ...selection,
        rejectionReason: typeof req.body?.rejectionReason === 'string' ? req.body.rejectionReason : undefined,
      },
      {
        adminUsername: req.adminUser?.username || 'super_admin',
        adminRole: req.adminUser?.role || 'super_admin',
      }
    );
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    const code = Number(err?.statusCode) || 500;
    return res.status(code).json({ status: 'error', message: err.message || 'Failed to bulk reject examinations.' });
  }
});

// POST /api/admin/previous-papers/bulk-publish
adminPreviousPapersRouter.post('/bulk-publish', requireSuperAdminPapersAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const selection = parseBulkSelectionBody(req.body);
    const result = await bulkPublishPreviousPapers(selection, {
      adminUsername: req.adminUser?.username || 'super_admin',
      adminRole: req.adminUser?.role || 'super_admin',
    });
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    const code = Number(err?.statusCode) || 500;
    console.error('[Admin Bulk Publish Papers Error]:', err);
    return res.status(code).json({ status: 'error', message: err.message || 'Failed to bulk publish examinations.' });
  }
});

// POST /api/admin/previous-papers/bulk-unpublish
adminPreviousPapersRouter.post('/bulk-unpublish', requireSuperAdminPapersAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const selection = parseBulkSelectionBody(req.body);
    const result = await bulkUnpublishPreviousPapers(selection, {
      adminUsername: req.adminUser?.username || 'super_admin',
      adminRole: req.adminUser?.role || 'super_admin',
    });
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    const code = Number(err?.statusCode) || 500;
    console.error('[Admin Bulk Unpublish Papers Error]:', err);
    return res.status(code).json({ status: 'error', message: err.message || 'Failed to bulk unpublish examinations.' });
  }
});

// POST /api/admin/previous-papers/bulk-delete
adminPreviousPapersRouter.post('/bulk-delete', requireSuperAdminPapersAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const selection = parseBulkSelectionBody(req.body);
    const result = await bulkSoftDeletePreviousPapers(
      { ...selection, confirmText: typeof req.body?.confirmText === 'string' ? req.body.confirmText : undefined },
      {
        adminUsername: req.adminUser?.username || 'super_admin',
        adminRole: req.adminUser?.role || 'super_admin',
      }
    );
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    const code = Number(err?.statusCode) || 500;
    console.error('[Admin Bulk Delete Papers Error]:', err);
    return res.status(code).json({ status: 'error', message: err.message || 'Failed to bulk delete examinations.' });
  }
});

// POST /api/admin/previous-papers/bulk-restore
adminPreviousPapersRouter.post('/bulk-restore', requireSuperAdminPapersAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const paperIds = Array.isArray(req.body?.paperIds)
      ? req.body.paperIds
      : Array.isArray(req.body?.selectedIds)
        ? req.body.selectedIds
        : [];
    const result = await bulkRestorePreviousPapers(paperIds, {
      adminUsername: req.adminUser?.username || 'super_admin',
      adminRole: req.adminUser?.role || 'super_admin',
    });
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    const code = Number(err?.statusCode) || 500;
    return res.status(code).json({ status: 'error', message: err.message || 'Failed to restore examinations.' });
  }
});

// GET /api/admin/previous-papers/audit-logs
adminPreviousPapersRouter.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
    const logs = await listPreviousPaperAuditLogs(limit);
    return res.status(200).json({ status: 'success', data: logs });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load audit logs.' });
  }
});

// ============================================================================
// GOOGLE GEMINI AI TEXT-BASED MCQ EXTRACTION, VERIFICATION & STAGING
// ============================================================================

// GET /api/admin/previous-papers/ai/provider
adminPreviousPapersRouter.get('/ai/provider', async (_req: Request, res: Response) => {
  try {
    const data = await getGeminiPreviousPaperProviderStatus();
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load Gemini AI status.' });
  }
});

// POST /api/admin/previous-papers/ai/test-connection (Super Admin)
adminPreviousPapersRouter.post('/ai/test-connection', requireSuperAdminPapersAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const model = typeof req.body?.model === 'string' && req.body.model.trim() ? req.body.model.trim() : undefined;
    const result = await AIProviderConfigService.testProviderConnection('gemini', { model });
    return res.status(200).json({ status: result.success ? 'success' : 'error', data: result, message: result.message });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Gemini connection test failed.' });
  }
});

// POST /api/admin/previous-papers/ai/validate-text
adminPreviousPapersRouter.post('/ai/validate-text', async (req: Request, res: Response) => {
  try {
    const sourceText = String(req.body?.sourceText || '');
    const expectedQuestions = Number(req.body?.expectedQuestions || 200);
    const report = validateSourceTextInput(sourceText, expectedQuestions);
    return res.status(200).json({ status: 'success', data: report });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Validation failed.' });
  }
});

// POST /api/admin/previous-papers/ai/validate-json
adminPreviousPapersRouter.post('/ai/validate-json', async (req: Request, res: Response) => {
  try {
    const jsonContent = String(req.body?.jsonContent || '');
    const filename = typeof req.body?.filename === 'string' ? req.body.filename : null;
    if (filename && !filename.toLowerCase().endsWith('.json')) {
      return res.status(400).json({ status: 'error', message: 'Only .json files are accepted.' });
    }
    const expectedQuestions = Number(req.body?.expectedQuestions || 200);
    const report = validateAndNormalizeJsonSource(jsonContent, { filename, expectedQuestions });
    return res.status(200).json({
      status: report.valid ? 'success' : 'error',
      message: report.valid ? undefined : report.errors.join(' '),
      data: {
        valid: report.valid,
        filename: report.filename,
        byteSize: report.byteSize,
        detectedCount: report.detectedCount,
        validRecords: report.validRecords,
        invalidRecords: report.invalidRecords,
        missingAnswers: report.missingAnswers,
        missingOptions: report.missingOptions,
        duplicateRecords: report.duplicateRecords,
        detectedExamMeta: report.detectedExamMeta,
        errors: report.errors,
        warnings: report.warnings,
        previewQuestions: report.previewQuestions,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'JSON validation failed.' });
  }
});

// POST /api/admin/previous-papers/ai/process-text (Supports BOTH 'text' and 'json' inputMethod)
adminPreviousPapersRouter.post('/ai/process-text', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const b = req.body || {};
    const inputMethod: 'text' | 'json' = b.inputMethod === 'json' ? 'json' : 'text';
    const jsonFilename = typeof b.jsonFilename === 'string' ? b.jsonFilename : null;
    if (inputMethod === 'json' && jsonFilename && !jsonFilename.toLowerCase().endsWith('.json')) {
      return res.status(400).json({ status: 'error', message: 'Only .json files are accepted for JSON import.' });
    }
    const job = await processSourceTextWithGemini({
      inputMethod,
      sourceText: typeof b.sourceText === 'string' ? b.sourceText : undefined,
      jsonContent: typeof b.jsonContent === 'string' ? b.jsonContent : undefined,
      jsonFilename,
      adminUsername: req.adminUser?.username || 'admin',
      asyncMode: b.asyncMode !== false,
      meta: {
        group: String(b.group || 'group4'),
        examName: String(b.examName || b.paperTitle || `TNPSC ${b.year || new Date().getFullYear()} Paper`),
        year: Number(b.year || new Date().getFullYear()),
        subject: String(b.subject || 'General Studies'),
        medium: /bilingual/i.test(String(b.medium || ''))
          ? 'Bilingual'
          : /tamil/i.test(String(b.medium || ''))
            ? 'Tamil'
            : 'English',
        paperType: String(b.paperType || 'Prelims'),
        expectedQuestions: Number(b.expectedQuestions || 200),
      },
      settings: {
        model: typeof b.model === 'string' && b.model.trim() ? b.model.trim() : undefined,
        batchSize: Math.max(5, Math.min(25, Number(b.batchSize) || 15)),
        expectedQuestions: Math.max(1, Number(b.expectedQuestions) || 200),
        answerVerificationEnabled: b.answerVerificationEnabled !== false,
        explanationGenerationEnabled: b.explanationGenerationEnabled !== false,
        subjectClassificationEnabled: b.subjectClassificationEnabled !== false,
        duplicateDetectionEnabled: b.duplicateDetectionEnabled !== false,
      },
    });
    return res.status(202).json({ status: 'success', data: job });
  } catch (err: any) {
    const code = Number(err?.statusCode) || 500;
    console.error('[PYP Gemini Text Process Error]:', err);
    return res.status(code).json({ status: 'error', message: err.message || 'Gemini text processing failed.' });
  }
});

// GET /api/admin/previous-papers/ai/jobs/:jobId
adminPreviousPapersRouter.get('/ai/jobs/:jobId(\\d+)', async (req: Request, res: Response) => {
  try {
    const job = await getGeminiTextJob(Number(req.params.jobId));
    if (!job) return res.status(404).json({ status: 'error', message: 'Gemini processing job not found.' });
    return res.status(200).json({ status: 'success', data: job });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load job.' });
  }
});

// POST /api/admin/previous-papers/ai/jobs/:jobId/retry-failed
adminPreviousPapersRouter.post('/ai/jobs/:jobId(\\d+)/retry-failed', async (req: Request, res: Response) => {
  try {
    const updated = await retryFailedBatchesForTextJob(Number(req.params.jobId), { asyncMode: true });
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    return res.status(Number(err?.statusCode) || 500).json({ status: 'error', message: err.message || 'Retry failed.' });
  }
});

// POST /api/admin/previous-papers/ai/jobs/:jobId/cancel
adminPreviousPapersRouter.post('/ai/jobs/:jobId(\\d+)/cancel', async (req: Request, res: Response) => {
  try {
    const updated = await cancelGeminiTextJob(Number(req.params.jobId));
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Cancel failed.' });
  }
});

// PUT /api/admin/previous-papers/:id
adminPreviousPapersRouter.put('/:id(\\d+)', async (req: Request, res: Response) => {
  try {
    const updated = await updateAdminPreviousPaperMeta(Number(req.params.id), req.body || {});
    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Examination not found.' });
    }
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    console.error('[Admin Previous Paper Update Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to update examination.' });
  }
});

// PUT /api/admin/previous-papers/:id/questions
adminPreviousPapersRouter.put('/:id(\\d+)/questions', async (req: Request, res: Response) => {
  try {
    const questions = Array.isArray(req.body?.questions) ? req.body.questions : null;
    if (!questions) {
      return res.status(400).json({ status: 'error', message: 'questions array is required.' });
    }
    const updated = await saveAdminPreviousPaperQuestions(Number(req.params.id), questions);
    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Examination not found.' });
    }
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    console.error('[Admin Previous Paper Save Questions Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to save questions.' });
  }
});

// PATCH /api/admin/previous-papers/:id/status
adminPreviousPapersRouter.patch('/:id(\\d+)/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const nextStatus = String(req.body?.status || '').toLowerCase() as any;
    const updated = await updateAdminPreviousPaperStatus(
      Number(req.params.id),
      nextStatus,
      req.adminUser?.username || 'admin'
    );
    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Examination not found.' });
    }
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    const code = Number(err?.statusCode) || 500;
    console.error('[Admin Previous Paper Status Error]:', err);
    return res.status(code).json({ status: 'error', message: err.message || 'Failed to update status.' });
  }
});

// DELETE /api/admin/previous-papers/:id
adminPreviousPapersRouter.delete('/:id(\\d+)', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await deleteAdminPreviousPaper(
      Number(req.params.id),
      req.adminUser?.username || 'admin'
    );
    if (!deleted) {
      return res.status(404).json({ status: 'error', message: 'Examination not found.' });
    }
    return res.status(200).json({ status: 'success', message: 'Examination moved to Trash successfully.' });
  } catch (err: any) {
    console.error('[Admin Previous Paper Delete Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to delete examination.' });
  }
});

// Alias protected Admin/Super-Admin bulk & stats endpoints on /api/previous-papers as well
router.get('/stats', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await getAdminPreviousPapersStats();
    return res.status(200).json({ status: 'success', data: stats });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load stats.' });
  }
});

router.post('/bulk-preview', requireSuperAdminPapersAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const preview = await previewBulkPreviousPapers(parseBulkSelectionBody(req.body));
    return res.status(200).json({ status: 'success', data: preview });
  } catch (err: any) {
    return res.status(Number(err?.statusCode) || 500).json({ status: 'error', message: err.message || 'Preview failed.' });
  }
});

router.post('/bulk-approve', requireSuperAdminPapersAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await bulkApprovePreviousPapers(parseBulkSelectionBody(req.body), {
      adminUsername: req.adminUser?.username || 'super_admin',
      adminRole: req.adminUser?.role || 'super_admin',
    });
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    return res.status(Number(err?.statusCode) || 500).json({ status: 'error', message: err.message || 'Bulk approve failed.' });
  }
});

router.post('/bulk-reject', requireSuperAdminPapersAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await bulkRejectPreviousPapers(
      {
        ...parseBulkSelectionBody(req.body),
        rejectionReason: typeof req.body?.rejectionReason === 'string' ? req.body.rejectionReason : undefined,
      },
      {
        adminUsername: req.adminUser?.username || 'super_admin',
        adminRole: req.adminUser?.role || 'super_admin',
      }
    );
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    return res.status(Number(err?.statusCode) || 500).json({ status: 'error', message: err.message || 'Bulk reject failed.' });
  }
});

router.post('/bulk-publish', requireSuperAdminPapersAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await bulkPublishPreviousPapers(parseBulkSelectionBody(req.body), {
      adminUsername: req.adminUser?.username || 'super_admin',
      adminRole: req.adminUser?.role || 'super_admin',
    });
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    return res.status(Number(err?.statusCode) || 500).json({ status: 'error', message: err.message || 'Bulk publish failed.' });
  }
});

router.post('/bulk-unpublish', requireSuperAdminPapersAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await bulkUnpublishPreviousPapers(parseBulkSelectionBody(req.body), {
      adminUsername: req.adminUser?.username || 'super_admin',
      adminRole: req.adminUser?.role || 'super_admin',
    });
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    return res.status(Number(err?.statusCode) || 500).json({ status: 'error', message: err.message || 'Bulk unpublish failed.' });
  }
});

router.post('/bulk-delete', requireSuperAdminPapersAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await bulkSoftDeletePreviousPapers(
      { ...parseBulkSelectionBody(req.body), confirmText: typeof req.body?.confirmText === 'string' ? req.body.confirmText : undefined },
      {
        adminUsername: req.adminUser?.username || 'super_admin',
        adminRole: req.adminUser?.role || 'super_admin',
      }
    );
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    return res.status(Number(err?.statusCode) || 500).json({ status: 'error', message: err.message || 'Bulk delete failed.' });
  }
});

// GET /api/previous-papers (Public list of published Previous Year Papers ONLY)
router.get('/', async (req: Request, res: Response) => {
  try {
    const papers = await listPreviousPapers({
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      year: typeof req.query.year === 'string' ? req.query.year : undefined,
      subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
      medium: typeof req.query.medium === 'string' ? req.query.medium : undefined,
    });
    return res.status(200).json({ status: 'success', data: papers });
  } catch (err: any) {
    console.error('[Previous Papers List Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load previous year papers.' });
  }
});

// POST /api/previous-papers/:paperId/start (Authenticated Student: Start or resume active session)
router.post('/:paperId(\\d+)/start', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const paperId = Number(req.params.paperId);
    const data = await startOrResumePaperSession(studentId, paperId);
    if (!data) {
      return res.status(404).json({ status: 'error', message: 'Previous year paper not found.' });
    }
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Previous Paper Start Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to start paper test.' });
  }
});

// PUT /api/previous-papers/sessions/:sessionId/answer (Authenticated Student: Auto-save answer/review)
router.put('/sessions/:sessionId(\\d+)/answer', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const sessionId = Number(req.params.sessionId);
    const { questionId, questionNumber, selectedOption, isMarkedForReview, isVisited, currentQuestion } = req.body || {};
    if (!Number.isInteger(Number(questionId)) || !Number.isInteger(Number(questionNumber))) {
      return res.status(400).json({ status: 'error', message: 'Valid questionId and questionNumber are required.' });
    }

    const result = await saveSessionAnswer(studentId, sessionId, {
      questionId: Number(questionId),
      questionNumber: Number(questionNumber),
      selectedOption: selectedOption === null || selectedOption === undefined ? null : Number(selectedOption),
      isMarkedForReview: Boolean(isMarkedForReview),
      isVisited: Boolean(isVisited),
      currentQuestion: currentQuestion ? Number(currentQuestion) : undefined,
    });

    if ((result as any).notFound) {
      return res.status(404).json({ status: 'error', message: 'Test session not found.' });
    }
    if ((result as any).alreadySubmitted) {
      return res.status(409).json({ status: 'error', message: 'Test session has already been submitted.' });
    }
    return res.status(200).json({ status: 'success', ...result });
  } catch (err: any) {
    console.error('[Previous Paper Save Answer Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to save answer.' });
  }
});

// POST /api/previous-papers/sessions/:sessionId/submit (Authenticated Student: Finalize & grade)
router.post('/sessions/:sessionId(\\d+)/submit', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const sessionId = Number(req.params.sessionId);
    const autoSubmitted = Boolean(req.body?.autoSubmitted);
    const result = await submitPaperSession(studentId, sessionId, autoSubmitted);
    if (!result) {
      return res.status(404).json({ status: 'error', message: 'Test session not found.' });
    }
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    console.error('[Previous Paper Submit Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to submit previous paper test.' });
  }
});

// GET /api/previous-papers/sessions/:sessionId/result (Authenticated Student: View persisted result)
router.get('/sessions/:sessionId(\\d+)/result', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const sessionId = Number(req.params.sessionId);
    const result = await getSessionResult(studentId, sessionId);
    if (!result) {
      return res.status(404).json({ status: 'error', message: 'Test result not found.' });
    }
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    console.error('[Previous Paper Result Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load test result.' });
  }
});

export default router;
