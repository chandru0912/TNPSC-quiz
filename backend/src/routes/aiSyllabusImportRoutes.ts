/**
 * aiSyllabusImportRoutes.ts
 *
 * REST Endpoints for the 12-step AI Syllabus Import Engine.
 */

import { Router, Request, Response } from 'express';
import { AISyllabusEngineService } from '../services/aiSyllabusEngineService';
import { AISyllabusJobService } from '../services/aiSyllabusJobService';
import { requireAdminAuth } from '../middleware/auth';

const router = Router();

function sendErrorResponse(res: Response, err: any, defaultMsg: string) {
  const isJsonErr =
    err.name === 'GeminiJsonParseError' ||
    String(err.message || '').includes('invalid JSON') ||
    String(err.message || '').includes('Invalid syllabus schema') ||
    String(err.message || '').includes('Invalid JSON structure');
  const statusCode =
    err.statusCode ||
    (isJsonErr ? 422 : String(err.message || '').includes('503') ? 503 : String(err.message || '').includes('429') ? 429 : 500);
  return res.status(statusCode).json({
    success: false,
    statusCode,
    errorType:
      err.errorType ||
      (isJsonErr ? 'invalid_json_syntax' : statusCode === 503 ? 'service_unavailable' : statusCode === 429 ? 'rate_limit' : 'unknown_error'),
    message: err.message || defaultMsg,
    retryable: err.retryable !== undefined ? err.retryable : (statusCode === 503 || statusCode === 429 || statusCode === 504),
    requestId: err.requestId,
  });
}

/**
 * POST /api/study-management/ai-import/analyze
 * Step 04: Analyze raw syllabus text and extract canonical parent units
 */
router.post('/analyze', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { examId, rawText, targetSubject } = req.body;

    if (!examId || !rawText) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'examId and rawText are required.',
      });
    }

    const units = await AISyllabusEngineService.analyzeSyllabus(
      String(examId),
      String(rawText),
      targetSubject ? String(targetSubject) : undefined
    );

    return res.status(200).json({
      success: true,
      units,
    });
  } catch (err: any) {
    console.error('[aiSyllabusImportRoutes] /analyze error:', err);
    return sendErrorResponse(res, err, 'Failed to analyze syllabus text.');
  }
});

/**
 * POST /api/study-management/ai-import/match
 * Steps 05–08: Match selected textbook TOC chapters into Single Parent Units
 */
router.post('/match', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { units, textbookIds } = req.body;

    if (!Array.isArray(units) || !Array.isArray(textbookIds)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'units and textbookIds must be arrays.',
      });
    }

    const matchedUnits = await AISyllabusEngineService.matchTextbooks(units, textbookIds);

    return res.status(200).json({
      success: true,
      units: matchedUnits,
    });
  } catch (err: any) {
    console.error('[aiSyllabusImportRoutes] /match error:', err);
    return sendErrorResponse(res, err, 'Failed to match textbooks.');
  }
});

/**
 * GET /api/study-management/ai-import/canonical-units
 * Get authoritative canonical units and standard-wise textbook lessons for a specific subject
 */
router.get('/canonical-units', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const examId = String(req.query.examId || 'group4');
    const subjectId = String(req.query.subjectId || 'general-studies');
    const standardsParam = req.query.standards ? String(req.query.standards) : '6,7,8,9,10,11,12';
    const standards = standardsParam
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n >= 6 && n <= 12);

    const units = AISyllabusEngineService.getCanonicalUnitsForSubject(
      examId,
      subjectId,
      standards.length > 0 ? standards : [6, 7, 8, 9, 10, 11, 12]
    );

    return res.status(200).json({
      success: true,
      subjectId,
      units,
    });
  } catch (err: any) {
    console.error('[aiSyllabusImportRoutes] /canonical-units error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch canonical units.',
    });
  }
});

/**
 * POST /api/study-management/ai-import/generate-notes
 * Step 10: Generate bilingual study notes for a specific lesson
 */
router.post('/generate-notes', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { lessonTitle, standard, topics } = req.body;

    if (!lessonTitle || !standard || !Array.isArray(topics)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'lessonTitle, standard, and topics are required.',
      });
    }

    const notes = await AISyllabusEngineService.generateLessonNotes(
      String(lessonTitle),
      Number(standard),
      topics.map((t) => String(t))
    );

    return res.status(200).json({
      success: true,
      notes,
    });
  } catch (err: any) {
    console.error('[aiSyllabusImportRoutes] /generate-notes error:', err);
    return sendErrorResponse(res, err, 'Failed to generate study notes.');
  }
});

/**
 * POST /api/study-management/ai-import/generate-mcqs
 * Step 11: Generate exam-standard 4-option MCQs for a lesson
 */
router.post('/generate-mcqs', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { lessonTitle, standard, topics } = req.body;

    if (!lessonTitle || !standard || !Array.isArray(topics)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'lessonTitle, standard, and topics are required.',
      });
    }

    const mcqs = await AISyllabusEngineService.generateLessonMCQs(
      String(lessonTitle),
      Number(standard),
      topics.map((t) => String(t))
    );

    return res.status(200).json({
      success: true,
      mcqs,
    });
  } catch (err: any) {
    console.error('[aiSyllabusImportRoutes] /generate-mcqs error:', err);
    return sendErrorResponse(res, err, 'Failed to generate MCQs.');
  }
});

/**
 * POST /api/study-management/ai-import/validate-audit
 * Comprehensive 9-Step Zero-Missing-Content Validation & AI Import Review Dashboard (Sections 5, 7, 8)
 */
router.post('/validate-audit', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { examId, units, selectedStandards } = req.body;
    if (!examId || !Array.isArray(units)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'examId and units are required.',
      });
    }

    const auditResult = AISyllabusEngineService.validateSyllabusImportAudit({
      examId,
      units,
      selectedStandards,
    });

    return res.status(200).json({
      success: true,
      ...auditResult,
    });
  } catch (err: any) {
    console.error('[aiSyllabusImportRoutes] /validate-audit error:', err);
    return sendErrorResponse(res, err, 'Failed to validate syllabus import audit.');
  }
});

/**
 * POST /api/study-management/ai-import/validate-tamil
 * Pre-publish validation and 14-point summary audit report for General Tamil
 */
router.post('/validate-tamil', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { examId, units, selectedStandards } = req.body;
    if (!examId || !Array.isArray(units)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'examId and units are required.',
      });
    }

    const validationResult = AISyllabusEngineService.validateGeneralTamilImport({
      examId,
      units,
      selectedStandards,
    });

    return res.status(200).json({
      success: true,
      ...validationResult,
    });
  } catch (err: any) {
    console.error('[aiSyllabusImportRoutes] /validate-tamil error:', err);
    return sendErrorResponse(res, err, 'Failed to validate General Tamil import.');
  }
});

/**
 * POST /api/study-management/ai-import/publish
 * Step 12: Atomic database publish with Safe Non-Destructive Merge (Option A)
 */
router.post('/publish', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    if (!payload.examId || !Array.isArray(payload.units)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Valid publish payload with examId and units is required.',
      });
    }

    const result = await AISyllabusEngineService.publishSyllabusTransaction(payload);

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[aiSyllabusImportRoutes] /publish error:', err);
    return sendErrorResponse(res, err, 'Failed to publish syllabus.');
  }
});

/**
 * POST /api/study-management/ai-import/jobs/start
 * Enqueue an asynchronous Analyze & Match background job (no 30s timeout).
 */
router.post('/jobs/start', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const {
      examId,
      rawText,
      textbookIds = [],
      selectedStandards = [],
      batchSize = 5,
      targetSubject,
    } = req.body;

    if (!examId || !rawText || !String(rawText).trim()) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'examId and rawText are required.',
      });
    }

    const job = await AISyllabusJobService.startJob({
      examId: String(examId),
      rawText: String(rawText),
      textbookIds: Array.isArray(textbookIds) ? textbookIds.map(Number) : [],
      selectedStandards: Array.isArray(selectedStandards) ? selectedStandards.map(Number) : [],
      batchSize: Number(batchSize) || 5,
      targetSubject: targetSubject ? String(targetSubject) : undefined,
    });

    return res.status(202).json({
      success: true,
      job,
    });
  } catch (err: any) {
    console.error('[aiSyllabusImportRoutes] /jobs/start error:', err);
    return sendErrorResponse(res, err, 'Failed to start background syllabus import job.');
  }
});

/**
 * GET /api/study-management/ai-import/jobs/:jobId
 * Poll background syllabus import job status, batch progress, and units.
 */
router.get('/jobs/:jobId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId || '').trim();
    const job = await AISyllabusJobService.getJob(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: `Syllabus import job '${jobId}' not found.`,
      });
    }
    return res.status(200).json({
      success: true,
      job,
    });
  } catch (err: any) {
    console.error('[aiSyllabusImportRoutes] GET /jobs/:jobId error:', err);
    return sendErrorResponse(res, err, 'Failed to fetch syllabus job status.');
  }
});

/**
 * POST /api/study-management/ai-import/jobs/:jobId/pause
 * Pause a running background syllabus import job cleanly after current step.
 */
router.post('/jobs/:jobId/pause', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId || '').trim();
    const job = await AISyllabusJobService.pauseJob(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: `Syllabus import job '${jobId}' not found.`,
      });
    }
    return res.status(200).json({
      success: true,
      job,
    });
  } catch (err: any) {
    console.error('[aiSyllabusImportRoutes] /jobs/:jobId/pause error:', err);
    return sendErrorResponse(res, err, 'Failed to pause syllabus job.');
  }
});

/**
 * POST /api/study-management/ai-import/jobs/:jobId/resume
 * Resume a paused background syllabus import job from saved checkpoint.
 */
router.post('/jobs/:jobId/resume', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId || '').trim();
    const job = await AISyllabusJobService.resumeJob(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: `Syllabus import job '${jobId}' not found.`,
      });
    }
    return res.status(200).json({
      success: true,
      job,
    });
  } catch (err: any) {
    console.error('[aiSyllabusImportRoutes] /jobs/:jobId/resume error:', err);
    return sendErrorResponse(res, err, 'Failed to resume syllabus job.');
  }
});

/**
 * POST /api/study-management/ai-import/jobs/:jobId/retry-failed
 * Retry only failed stage/batches without repeating completed work.
 */
router.post('/jobs/:jobId/retry-failed', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId || '').trim();
    const job = await AISyllabusJobService.retryFailed(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: `Syllabus import job '${jobId}' not found.`,
      });
    }
    return res.status(200).json({
      success: true,
      job,
    });
  } catch (err: any) {
    console.error('[aiSyllabusImportRoutes] /jobs/:jobId/retry-failed error:', err);
    return sendErrorResponse(res, err, 'Failed to retry failed batches.');
  }
});

export default router;
