/**
 * Cloud AI Generation Routes
 * Handles unified Study Notes, MCQ, and Both generation requests
 * Supports Server-Sent Events (SSE) streaming for real-time progress feedback.
 */

import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../middleware/auth';
import { CloudContentOrchestrator, UnifiedGenerationRequest } from '../services/cloudContentOrchestrator';
import { CloudAIService } from '../services/cloudAi/cloudAiService';

const router = Router();

/**
 * GET /api/ai
 * Informational endpoint returning available AI Generation endpoints.
 */
router.get('/', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'online',
    service: 'Cloud AI Generation API',
    endpoints: {
      status: 'GET /api/ai/status',
      testConnection: 'POST /api/ai/test-connection',
      generate: 'POST /api/ai/generate',
    },
  });
});

/**
 * GET /api/ai/status (Protected)
 * Returns status of Cloud AI configuration.
 */
router.get('/status', requireAdminAuth, (req: Request, res: Response) => {
  const customKey = typeof req.query.apiKey === 'string' ? req.query.apiKey.trim() : undefined;
  const status = CloudAIService.getProviderStatus(customKey);
  return res.status(200).json({
    status: 'ok',
    ...status,
  });
});

/**
 * POST /api/ai/test-connection (Protected)
 * Tests connection to active Cloud AI API.
 */
router.post('/test-connection', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body || {};
    const result = await CloudAIService.testConnection(apiKey);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Connection test failed',
    });
  }
});

/**
 * POST /api/ai/generate (Protected)
 * Unified Cloud AI Generator for Study Notes, MCQs, or Both.
 * Supports streaming Server-Sent Events when ?stream=true.
 */
router.post('/generate', requireAdminAuth, async (req: Request, res: Response) => {
  const isStream = req.query.stream === 'true' || req.headers.accept?.includes('text/event-stream');

  if (isStream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
  }

  const sendStreamEvent = (data: any) => {
    if (isStream && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  try {
    const {
      category = 'group4',
      standard = 6,
      subject = 'General Studies',
      term = 'Term 1',
      unitId = 1,
      unitTitle,
      lessonTitle,
      lessonId,
      lessonNumber,
      topic,
      language = 'tamil',
      mode = 'notes',
      notesFormat = 'short',
      questionCount = 20,
      difficulty = 'Medium',
      textbookMode = 'auto',
      textbookId,
      customText,
      apiKey,
      autoSaveToStaging = true,
    } = req.body || {};

    if (!lessonTitle || typeof lessonTitle !== 'string' || !lessonTitle.trim()) {
      if (isStream) {
        sendStreamEvent({ status: 'error', error: 'lessonTitle is required for generation.' });
        return res.end();
      }
      return res.status(400).json({ status: 'error', message: 'lessonTitle is required for generation.' });
    }

    const payload: UnifiedGenerationRequest = {
      category: String(category).toLowerCase(),
      standard: Number(standard) || 6,
      subject: String(subject),
      term: String(term || 'Term 1'),
      unitId: Number(unitId) || 1,
      unitTitle: unitTitle ? String(unitTitle) : undefined,
      lessonTitle: String(lessonTitle).trim(),
      lessonId: lessonId ? String(lessonId).trim() : undefined,
      lessonNumber: lessonNumber ? String(lessonNumber).trim() : undefined,
      topic: topic ? String(topic).trim() : undefined,
      language: String(language).toLowerCase() === 'english' ? 'english' : 'tamil',
      mode: (mode === 'mcq' || mode === 'both') ? mode : 'notes',
      notesFormat: ['short', 'full', 'both'].includes(notesFormat) ? notesFormat : 'short',
      questionCount: Number(questionCount) || 20,
      difficulty: ['Easy', 'Medium', 'Hard', 'Mixed'].includes(difficulty) ? difficulty : 'Medium',
      textbookMode: textbookMode === 'specific' ? 'specific' : (textbookMode === 'custom_text' ? 'custom_text' : 'auto'),
      textbookId: textbookId ? Number(textbookId) : undefined,
      customText: customText ? String(customText) : undefined,
      apiKeyOverride: apiKey && typeof apiKey === 'string' && apiKey.trim().length > 5 ? apiKey.trim() : undefined,
      autoSaveToStaging: Boolean(autoSaveToStaging),
    };

    const result = await CloudContentOrchestrator.execute(payload, (progress) => {
      sendStreamEvent({
        type: 'progress',
        ...progress,
      });
    });

    if (isStream) {
      sendStreamEvent({
        type: 'complete',
        ...result,
      });
      return res.end();
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[AI Generation Route] Error:', error);
    if (isStream) {
      sendStreamEvent({
        type: 'error',
        status: 'error',
        error: error.message || 'Generation failed',
      });
      return res.end();
    }
    return res.status(400).json({
      status: 'error',
      message: error.message || 'Generation failed',
    });
  }
});

export default router;

