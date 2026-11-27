import { Router, Request, Response } from 'express';
import {
  requireAdminAuth,
  AuthenticatedRequest,
  requireStudentAuth,
  StudentAuthenticatedRequest,
} from '../middleware/auth';
import {
  getAdminMockTestsOverview,
  getAdminMockTestDetail,
  searchQuestionBankForMockTest,
  autoSelectQuestionsForMockTest,
  getGeneratorPoolAvailability,
  generateMockTestQuestionPool,
  getGeneratorQuestionBankList,
  validateSelectedMockTestQuestions,
  getSyllabusOptionsForMockTests,
  createAdminMockTest,
  updateAdminMockTest,
  duplicateAdminMockTest,
  updateAdminMockTestStatus,
  approveAdminMockTest,
  rejectAdminMockTest,
  deleteAdminMockTest,
  getPublishedMockTestsForStudent,
  startStudentMockTestSession,
  saveStudentMockTestProgress,
  submitStudentMockTest,
  startSyllabusMockTestSession,
  submitSyllabusMockTest,
  MockTestStatus,
} from '../services/mockTestService';

export const adminMockTestsRouter = Router();
export const studentMockTestsRouter = Router();

// ====================================================
// ADMIN MOCK TEST MANAGEMENT ROUTES (requireAdminAuth)
// ====================================================
adminMockTestsRouter.use(requireAdminAuth);

adminMockTestsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const data = await getAdminMockTestsOverview({
      search: req.query.search as string | undefined,
      group: req.query.group as string | undefined,
      status: req.query.status as string | undefined,
      subject: req.query.subject as string | undefined,
      testCategory: req.query.testCategory as string | undefined,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Admin MockTests List Error]:', err);
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to load mock tests.' });
  }
});

adminMockTestsRouter.get('/syllabus-options', async (req: Request, res: Response) => {
  try {
    const data = await getSyllabusOptionsForMockTests({
      group: req.query.group as string | undefined,
      subject: req.query.subject as string | undefined,
      standard: req.query.standard as string | undefined,
      unit: req.query.unit as string | undefined,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to load syllabus options.' });
  }
});

adminMockTestsRouter.get('/question-bank', async (req: Request, res: Response) => {
  try {
    const data = await searchQuestionBankForMockTest({
      group: req.query.group as string | undefined,
      subject: req.query.subject as string | undefined,
      standard: req.query.standard as string | undefined,
      unit: req.query.unit as string | undefined,
      difficulty: req.query.difficulty as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Admin MockTests QuestionBank Error]:', err);
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to load questions.' });
  }
});

adminMockTestsRouter.post('/auto-select', async (req: Request, res: Response) => {
  try {
    const { group, subject, standard, unit, difficulty, count, excludeIds } = req.body || {};
    const data = await autoSelectQuestionsForMockTest({
      group,
      subject,
      standard,
      unit,
      difficulty,
      count: Number(count) || 25,
      excludeIds: Array.isArray(excludeIds) ? excludeIds : [],
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      status: 'error',
      message: err.message || 'Failed to auto-select questions.',
      eligibleCount: err.eligibleCount,
    });
  }
});

adminMockTestsRouter.get('/generator/availability', async (req: Request, res: Response) => {
  try {
    const mode: 'unit_wise' | 'full_length' =
      String(req.query.mode || 'unit_wise') === 'full_length' ? 'full_length' : 'unit_wise';
    const standardsRaw = String(req.query.standards || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 6 && n <= 12);
    const unitsRaw = String(req.query.units || '')
      .split(',')
      .map((u) => Number(u.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);

    const data = await getGeneratorPoolAvailability({
      mode,
      group: req.query.group as string | undefined,
      subject: req.query.subject as string | undefined,
      standards: standardsRaw,
      units: unitsRaw,
      difficulty: req.query.difficulty as string | undefined,
      questionType: req.query.questionType as string | undefined,
      language: req.query.language as string | undefined,
      includeStaging: req.query.includeStaging === 'true',
      search: req.query.search as string | undefined,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Admin MockTest Generator Availability Error]:', err);
    return res.status(err.statusCode || 500).json({
      status: 'error',
      message: err.message || 'Failed to check question availability.',
    });
  }
});

adminMockTestsRouter.get('/generator/questions', async (req: Request, res: Response) => {
  try {
    const mode: 'unit_wise' | 'full_length' =
      String(req.query.mode || 'unit_wise') === 'full_length' ? 'full_length' : 'unit_wise';
    const standardsRaw = String(req.query.standards || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 6 && n <= 12);
    const unitsRaw = String(req.query.units || '')
      .split(',')
      .map((u) => Number(u.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);

    const data = await getGeneratorQuestionBankList({
      mode,
      group: req.query.group as string | undefined,
      subject: req.query.subject as string | undefined,
      standards: standardsRaw,
      units: unitsRaw,
      difficulty: req.query.difficulty as string | undefined,
      questionType: req.query.questionType as string | undefined,
      language: req.query.language as string | undefined,
      includeStaging: req.query.includeStaging === 'true',
      search: req.query.search as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : 15,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Admin MockTest Generator Questions Error]:', err);
    return res.status(err.statusCode || 500).json({
      status: 'error',
      message: err.message || 'Failed to load Question Bank items.',
    });
  }
});

adminMockTestsRouter.post('/generator/validate-selection', async (req: Request, res: Response) => {
  try {
    const { questionIds, includeStaging } = req.body || {};
    const data = await validateSelectedMockTestQuestions(
      Array.isArray(questionIds) ? questionIds : [],
      Boolean(includeStaging)
    );
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      status: 'error',
      message: err.message || 'Failed to validate selected questions.',
    });
  }
});

adminMockTestsRouter.post('/generator/generate', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const mode: 'unit_wise' | 'full_length' =
      String(body.mode || 'unit_wise') === 'full_length' ? 'full_length' : 'unit_wise';
    const data = await generateMockTestQuestionPool({
      mode,
      group: body.group,
      subject: body.subject,
      standards: Array.isArray(body.standards) ? body.standards.map(Number) : [],
      units: Array.isArray(body.units) ? body.units.map(Number) : [],
      difficulty: body.difficulty,
      questionType: body.questionType,
      language: body.language,
      includeStaging: Boolean(body.includeStaging),
      totalQuestions: Number(body.totalQuestions) || 50,
      difficultyDistribution: body.difficultyDistribution,
      standardDistribution: body.standardDistribution,
      distributeAcrossLessons: Boolean(body.distributeAcrossLessons),
      distributeAcrossStandards: Boolean(body.distributeAcrossStandards),
      randomizeSelection: body.randomizeSelection !== false,
      randomizeOrder: body.randomizeOrder !== false,
      excludeIds: Array.isArray(body.excludeIds) ? body.excludeIds.map(Number) : [],
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      status: 'error',
      message: err.message || 'Failed to generate mock test questions.',
      eligibleCount: err.eligibleCount,
    });
  }
});

adminMockTestsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid mock test ID is required.' });
    }
    const detail = await getAdminMockTestDetail(id);
    if (!detail) {
      return res.status(404).json({ status: 'error', message: 'Mock test not found.' });
    }
    return res.status(200).json({ status: 'success', data: detail });
  } catch (err: any) {
    console.error('[Admin MockTest Detail Error]:', err);
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to load mock test.' });
  }
});

adminMockTestsRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminUsername = req.adminUser?.username || 'admin';
    const created = await createAdminMockTest(req.body || {}, adminUsername);
    return res.status(201).json({ status: 'success', data: created });
  } catch (err: any) {
    console.error('[Admin MockTest Create Error]:', err);
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to create mock test.' });
  }
});

adminMockTestsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid mock test ID is required.' });
    }
    const updated = await updateAdminMockTest(id, req.body || {});
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    console.error('[Admin MockTest Update Error]:', err);
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to update mock test.' });
  }
});

adminMockTestsRouter.post('/:id/duplicate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid mock test ID is required.' });
    }
    const adminUsername = req.adminUser?.username || 'admin';
    const copy = await duplicateAdminMockTest(id, adminUsername);
    return res.status(201).json({ status: 'success', data: copy });
  } catch (err: any) {
    console.error('[Admin MockTest Duplicate Error]:', err);
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to duplicate mock test.' });
  }
});

adminMockTestsRouter.patch('/:id/approve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid mock test ID is required.' });
    }
    const adminUsername = req.adminUser?.username || 'admin';
    const updated = await approveAdminMockTest(id, adminUsername);
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to approve mock test.' });
  }
});

adminMockTestsRouter.patch('/:id/reject', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid mock test ID is required.' });
    }
    const adminUsername = req.adminUser?.username || 'admin';
    const updated = await rejectAdminMockTest(id, adminUsername);
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to reject mock test.' });
  }
});

adminMockTestsRouter.patch('/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid mock test ID is required.' });
    }
    const { status, startAt, endAt } = req.body || {};
    const validStatuses: MockTestStatus[] = ['draft', 'staging', 'published', 'scheduled', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status. Use draft, staging, published, scheduled, or archived.' });
    }
    const adminUsername = req.adminUser?.username || 'admin';
    const updated = await updateAdminMockTestStatus(id, status, startAt, endAt, adminUsername);
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to update mock test status.' });
  }
});

adminMockTestsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid mock test ID is required.' });
    }
    const deleted = await deleteAdminMockTest(id);
    if (!deleted) {
      return res.status(404).json({ status: 'error', message: 'Mock test not found.' });
    }
    return res.status(200).json({ status: 'success', message: 'Mock test deleted successfully.' });
  } catch (err: any) {
    console.error('[Admin MockTest Delete Error]:', err);
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to delete mock test.' });
  }
});

// ====================================================
// STUDENT MOCK TEST ROUTES (Published & Active Scheduled Only)
// ====================================================
studentMockTestsRouter.get('/syllabus-options', async (req: Request, res: Response) => {
  try {
    const data = await getSyllabusOptionsForMockTests({
      group: req.query.group as string | undefined,
      subject: req.query.subject as string | undefined,
      standard: req.query.standard as string | undefined,
      unit: req.query.unit as string | undefined,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load syllabus options.' });
  }
});

studentMockTestsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const data = await getPublishedMockTestsForStudent({
      group: req.query.group as string | undefined,
      testCategory: req.query.testCategory as string | undefined,
      subject: req.query.subject as string | undefined,
      standard: req.query.standard as string | undefined,
      unit: req.query.unit as string | undefined,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Student MockTests List Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load published mock tests.' });
  }
});

studentMockTestsRouter.get('/unit-tests', async (req: Request, res: Response) => {
  try {
    const unit = req.query.unit as string | undefined;
    if (!unit || !String(unit).trim()) {
      return res.status(400).json({ status: 'error', message: 'unit query parameter is required.' });
    }
    const data = await getPublishedMockTestsForStudent({
      group: req.query.group as string | undefined,
      testCategory: 'unit_wise',
      subject: req.query.subject as string | undefined,
      standard: req.query.standard as string | undefined,
      unit,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Student Unit Tests List Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load tests for this unit.' });
  }
});

studentMockTestsRouter.post('/syllabus/start', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const data = await startSyllabusMockTestSession(req.body || {});
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to start syllabus mock test.' });
  }
});

studentMockTestsRouter.post('/syllabus/submit', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const isPreview = Boolean(req.studentUser?.isPreview);
    const result = await submitSyllabusMockTest(studentId, req.body || {}, isPreview);
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    console.error('[Student Syllabus MockTest Submit Error]:', err);
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to submit syllabus mock test.' });
  }
});

studentMockTestsRouter.post('/:id/start', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const mockTestId = Number(req.params.id);
    if (!Number.isInteger(mockTestId) || mockTestId <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid mock test ID is required.' });
    }
    const studentId = req.studentUser!.studentId;
    const isPreview = Boolean(req.studentUser?.isPreview);
    const data = await startStudentMockTestSession(mockTestId, studentId, isPreview);
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to start mock test.' });
  }
});

studentMockTestsRouter.patch('/sessions/:sessionId/progress', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const sessionId = Number(req.params.sessionId);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid session ID is required.' });
    }
    if (req.studentUser?.isPreview) {
      return res.status(200).json({ status: 'success', preview: true });
    }
    const studentId = req.studentUser!.studentId;
    const { answers, currentQuestionIndex } = req.body || {};
    const updated = await saveStudentMockTestProgress(sessionId, studentId, answers || {}, currentQuestionIndex || 0);
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to save progress.' });
  }
});

studentMockTestsRouter.post('/:id/submit', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const mockTestId = Number(req.params.id);
    if (!Number.isInteger(mockTestId) || mockTestId <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid mock test ID is required.' });
    }
    const studentId = req.studentUser!.studentId;
    const isPreview = Boolean(req.studentUser?.isPreview);
    const result = await submitStudentMockTest(mockTestId, studentId, req.body || {}, isPreview);
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    console.error('[Student MockTest Submit Error]:', err);
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Failed to submit mock test.' });
  }
});
