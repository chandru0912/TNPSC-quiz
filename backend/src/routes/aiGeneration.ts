/**
 * Claude AI Generation Routes
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
    service: 'Claude AI Generation API',
    endpoints: {
      status: 'GET /api/ai/status',
      config: 'POST /api/ai/config',
      testConnection: 'POST /api/ai/test-connection',
      generate: 'POST /api/ai/generate',
    },
  });
});

/**
 * GET /api/ai/status (Protected)
 * Returns status of Claude AI configuration.
 */
router.get('/status', requireAdminAuth, (_req: Request, res: Response) => {
  const status = CloudAIService.getProviderStatus();
  return res.status(200).json({
    status: 'ok',
    ...status,
  });
});

/**
 * POST /api/ai/config (Protected)
 * Saves or updates Claude AI API Key and model.
 * Enforces secure storage on backend only.
 */
router.post('/config', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { apiKey, model } = req.body || {};

    if (apiKey !== undefined) {
      if (typeof apiKey !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid API key format.' });
      }
      const trimmedKey = apiKey.trim();
      if (trimmedKey.length > 0 && trimmedKey.length < 15) {
        return res.status(400).json({ success: false, message: 'API key appears too short. Valid Anthropic keys start with sk-ant-.' });
      }
    }

    if (model !== undefined && typeof model !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid model format.' });
    }

    const updated = CloudAIService.updateConfiguration(apiKey, model);
    return res.status(200).json({
      success: true,
      message: 'Claude AI configuration saved securely.',
      ...updated,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update Claude configuration',
    });
  }
});

/**
 * POST /api/ai/test-connection (Protected)
 * Tests connection to active Claude AI API.
 */
router.post('/test-connection', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const result = await CloudAIService.testConnection();
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
 * Unified Claude AI Generator for Study Notes, MCQs, or Both.
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
      term,
      volume,
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
      gdriveFileId,
      gdriveMaterialId,
      customText,
      autoSaveToStaging = true,
    } = req.body || {};

    if (!lessonTitle || typeof lessonTitle !== 'string' || !lessonTitle.trim()) {
      if (isStream) {
        sendStreamEvent({ status: 'error', error: 'lessonTitle is required for generation.' });
        return res.end();
      }
      return res.status(400).json({ status: 'error', message: 'lessonTitle is required for generation.' });
    }

    if (mode === 'mcq') {
      const allowedCounts = [25, 50, 100, 200];
      if (!allowedCounts.includes(Number(questionCount))) {
        const message = `questionCount must be one of ${allowedCounts.join(', ')} for MCQ generation.`;
        if (isStream) {
          sendStreamEvent({ status: 'error', error: message });
          return res.end();
        }
        return res.status(400).json({ status: 'error', message });
      }
      if (!textbookId && !gdriveMaterialId && !gdriveFileId) {
        const message = 'Select a processed textbook or Google Drive PDF before generating MCQs.';
        if (isStream) {
          sendStreamEvent({ status: 'error', error: message });
          return res.end();
        }
        return res.status(400).json({ status: 'error', message });
      }
    }

    const payload: UnifiedGenerationRequest = {
      category: String(category).toLowerCase(),
      standard: Number(standard) || 6,
      subject: String(subject),
      term: term ? String(term) : undefined,
      volume: volume ? String(volume) : undefined,
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
      textbookMode: textbookMode === 'gdrive' ? 'gdrive' : (textbookMode === 'specific' ? 'specific' : (textbookMode === 'custom_text' ? 'custom_text' : 'auto')),
      textbookId: textbookId ? Number(textbookId) : undefined,
      gdriveFileId: gdriveFileId ? String(gdriveFileId).trim() : undefined,
      gdriveMaterialId: gdriveMaterialId ? Number(gdriveMaterialId) : undefined,
      customText: customText ? String(customText) : undefined,
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
    console.error('[AI Generation Route] Database / Execution Error:', {
      message: error?.message,
      code: error?.code,
      table: error?.table,
      column: error?.column,
      detail: error?.detail,
    });

    let clientMessage = error.message || 'Generation failed';
    if (error?.code === '22001') {
      clientMessage = 'A database field limit was exceeded while saving notes. The database schema has been updated to support extensive content.';
    } else if (error?.code && String(error.code).startsWith('23')) {
      clientMessage = 'A database constraint error occurred while saving notes. Please try again.';
    } else if (error?.code && String(error.code).startsWith('08')) {
      clientMessage = 'Database connection error. Please verify the PostgreSQL server connection.';
    }

    if (isStream) {
      sendStreamEvent({
        type: 'error',
        status: 'error',
        error: clientMessage,
      });
      return res.end();
    }
    return res.status(400).json({
      status: 'error',
      message: clientMessage,
    });
  }
});

export default router;

