/**
 * Persistent MCQ Background Generation Job Routes
 *
 * Endpoints (all protected by requireAdminAuth):
 * - POST   /api/admin/mcq-generation/jobs
 * - GET    /api/admin/mcq-generation/jobs
 * - GET    /api/admin/mcq-generation/jobs/:jobId
 * - POST   /api/admin/mcq-generation/jobs/:jobId/step
 * - POST   /api/admin/mcq-generation/jobs/:jobId/cancel
 * - POST   /api/admin/mcq-generation/jobs/:jobId/retry
 */

import { Router, Response } from 'express';
import { requireAdminAuth, AuthenticatedRequest } from '../middleware/auth';
import { McqJobService } from '../services/mcqJobService';
import { AIProviderName } from '../services/ai/ai-provider.interface';

const router = Router();

/**
 * POST /api/admin/mcq-generation/jobs/internal/step/:jobId
 * Signed internal worker endpoint for Vercel serverless batch chaining (continues even if browser closes).
 */
router.post('/internal/step/:jobId', async (req, res: Response) => {
  try {
    const jobId = String(req.params.jobId || '');
    const workerSig = String(req.headers['x-mcq-worker-token'] || '');
    if (!McqJobService.verifyInternalWorkerToken(jobId, workerSig)) {
      return res.status(401).json({ success: false, message: 'Invalid or expired worker signature.' });
    }
    const job = await McqJobService.processNextStep(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'MCQ generation job not found.' });
    }
    return res.status(200).json({ success: true, job });
  } catch (err: any) {
    console.error('[MCQ Jobs] Internal worker step error:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Worker step failed.' });
  }
});

router.use(requireAdminAuth);

function getAdminId(req: AuthenticatedRequest): string {
  return String(req.adminUser?.username || req.adminUser?.name || 'admin');
}

/**
 * POST /api/admin/mcq-generation/jobs
 * Creates and queues a persistent MCQ generation job in PostgreSQL.
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body || {};
    const category = String(body.category || body.groupId || '').trim();
    const subject = String(body.subject || '').trim();
    const lessonTitle = String(body.lessonTitle || '').trim();
    const standard = Number(body.standard);
    const unitId = Number(body.unitId);
    const questionCount = Number(body.questionCount || body.count || 25);

    if (!category || !subject || !lessonTitle || !Number.isFinite(standard) || !Number.isFinite(unitId)) {
      return res.status(400).json({
        success: false,
        message: 'category, subject, standard, unitId, and lessonTitle are required.',
      });
    }

    if (questionCount < 5 || questionCount > 200) {
      return res.status(400).json({
        success: false,
        message: 'questionCount must be between 5 and 200.',
      });
    }

    const rawProvider = String(body.provider || '').toLowerCase().trim();
    const provider: AIProviderName | undefined =
      rawProvider === 'claude' || rawProvider === 'gemini' || rawProvider === 'openai'
        ? (rawProvider as AIProviderName)
        : undefined;

    const job = await McqJobService.createJob(getAdminId(req), {
      provider,
      category,
      standard,
      subject,
      subjectId: body.subjectId ? String(body.subjectId) : undefined,
      term: body.term ? String(body.term) : undefined,
      volume: body.volume ? String(body.volume) : undefined,
      unitId,
      unitTitle: body.unitTitle ? String(body.unitTitle) : undefined,
      lessonTitle,
      lessonId: body.lessonId ? String(body.lessonId) : undefined,
      lessonNumber: body.lessonNumber ? String(body.lessonNumber) : undefined,
      topic: body.topic ? String(body.topic) : undefined,
      selectedTopics: Array.isArray(body.selectedTopics) ? body.selectedTopics.map(String) : undefined,
      language: body.language === 'tamil' ? 'tamil' : 'english',
      questionCount,
      difficulty: ['Easy', 'Medium', 'Hard', 'Mixed'].includes(body.difficulty) ? body.difficulty : 'Mixed',
      textbookMode: body.textbookMode,
      textbookId: body.textbookId != null ? Number(body.textbookId) : undefined,
      gdriveFileId: body.gdriveFileId ? String(body.gdriveFileId) : undefined,
      gdriveMaterialId: body.gdriveMaterialId != null ? Number(body.gdriveMaterialId) : undefined,
      customText: body.customText ? String(body.customText) : undefined,
    });

    return res.status(201).json({
      success: true,
      job,
    });
  } catch (err: any) {
    console.error('[MCQ Jobs] Create error:', err);
    return res.status(400).json({
      success: false,
      message: err?.message || 'Failed to create MCQ generation job.',
    });
  }
});

/**
 * GET /api/admin/mcq-generation/jobs
 * Lists recent and active MCQ generation jobs from PostgreSQL.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeOnly = req.query.active === 'true';
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const jobs = await McqJobService.listJobs({ activeOnly, limit });
    return res.status(200).json({
      success: true,
      jobs,
    });
  } catch (err: any) {
    console.error('[MCQ Jobs] List error:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to list MCQ generation jobs.',
      jobs: [],
    });
  }
});

/**
 * GET /api/admin/mcq-generation/jobs/:jobId
 */
router.get('/:jobId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await McqJobService.getJob(String(req.params.jobId));
    if (!job) {
      return res.status(404).json({ success: false, message: 'MCQ generation job not found.' });
    }
    return res.status(200).json({ success: true, job });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch job.' });
  }
});

/**
 * POST /api/admin/mcq-generation/jobs/:jobId/step
 * Executes the next bounded batch step for a QUEUED/PROCESSING job (lease-locked & idempotent).
 */
router.post('/:jobId/step', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await McqJobService.processNextStep(String(req.params.jobId));
    if (!job) {
      return res.status(404).json({ success: false, message: 'MCQ generation job not found.' });
    }
    return res.status(200).json({ success: true, job });
  } catch (err: any) {
    console.error('[MCQ Jobs] Step error:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Failed to execute job step.' });
  }
});

/**
 * POST /api/admin/mcq-generation/jobs/:jobId/cancel
 * Explicitly cancels a queued or running job.
 */
router.post('/:jobId/cancel', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await McqJobService.cancelJob(String(req.params.jobId), getAdminId(req));
    if (!job) {
      return res.status(404).json({ success: false, message: 'MCQ generation job not found.' });
    }
    return res.status(200).json({ success: true, job });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Failed to cancel job.' });
  }
});

/**
 * POST /api/admin/mcq-generation/jobs/:jobId/retry
 * Resumes/retries a failed or cancelled job from preserved progress.
 */
router.post('/:jobId/retry', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await McqJobService.retryJob(String(req.params.jobId), getAdminId(req));
    if (!job) {
      return res.status(404).json({ success: false, message: 'MCQ generation job not found.' });
    }
    return res.status(200).json({ success: true, job });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Failed to retry job.' });
  }
});

export default router;
