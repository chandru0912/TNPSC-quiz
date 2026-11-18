import { Router, Request, Response } from 'express';
import { requireStudentAuth, StudentAuthenticatedRequest } from '../middleware/auth';
import {
  listPreviousPapers,
  startOrResumePaperSession,
  saveSessionAnswer,
  submitPaperSession,
  getSessionResult,
} from '../services/previousPapersService';

const router = Router();

// GET /api/previous-papers (Public list of published Previous Year Papers)
router.get('/', async (req: Request, res: Response) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const papers = await listPreviousPapers(category);
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
