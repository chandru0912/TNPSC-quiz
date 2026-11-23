import { Router, Request, Response } from 'express';
import {
  requireAdminAuth,
  requireStudentAuth,
  AuthenticatedRequest,
  StudentAuthenticatedRequest,
} from '../middleware/auth';
import {
  listPreviousPapers,
  startOrResumePaperSession,
  saveSessionAnswer,
  submitPaperSession,
  getSessionResult,
} from '../services/previousPapersService';
import {
  getAdminPreviousPapersStats,
  listAdminPreviousPapers,
  getAdminPreviousPaperDetail,
  createPaperFromPastedQuestions,
  approvePaperQuestions,
  updateAdminPreviousPaperMeta,
  saveAdminPreviousPaperQuestions,
  updateAdminPreviousPaperStatus,
  bulkPublishApprovedPapers,
  deleteAdminPreviousPaper,
} from '../services/previousPapersAdminService';

const router = Router();
export const adminPreviousPapersRouter = Router();
adminPreviousPapersRouter.use(requireAdminAuth);

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
    const papers = await listAdminPreviousPapers({
      group: typeof req.query.group === 'string' ? req.query.group : undefined,
      year: typeof req.query.year === 'string' ? req.query.year : undefined,
      subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
      medium: typeof req.query.medium === 'string' ? req.query.medium : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    });
    return res.status(200).json({ status: 'success', data: papers });
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

// POST /api/admin/previous-papers/bulk-publish
adminPreviousPapersRouter.post('/bulk-publish', async (req: Request, res: Response) => {
  try {
    const paperIds = Array.isArray(req.body?.paperIds) ? req.body.paperIds : [];
    const result = await bulkPublishApprovedPapers(paperIds);
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    const code = Number(err?.statusCode) || 500;
    console.error('[Admin Bulk Publish Papers Error]:', err);
    return res.status(code).json({ status: 'error', message: err.message || 'Failed to bulk publish examinations.' });
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
adminPreviousPapersRouter.patch('/:id(\\d+)/status', async (req: Request, res: Response) => {
  try {
    const nextStatus = String(req.body?.status || '').toLowerCase() as any;
    const updated = await updateAdminPreviousPaperStatus(Number(req.params.id), nextStatus);
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
adminPreviousPapersRouter.delete('/:id(\\d+)', async (req: Request, res: Response) => {
  try {
    const deleted = await deleteAdminPreviousPaper(Number(req.params.id));
    if (!deleted) {
      return res.status(404).json({ status: 'error', message: 'Examination not found.' });
    }
    return res.status(200).json({ status: 'success', message: 'Examination deleted successfully.' });
  } catch (err: any) {
    console.error('[Admin Previous Paper Delete Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to delete examination.' });
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
