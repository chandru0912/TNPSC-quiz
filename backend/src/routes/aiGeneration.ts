/**
 * AI Generation & Multi-Provider Architecture Routes
 * Supports independent Claude AI & Google Gemini AI:
 * - Provider management & active provider toggle
 * - Independent prompt management & version history
 * - Independent generation logs / history
 * - Unified generation pipeline with SSE streaming
 */

import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../middleware/auth';
import { CloudContentOrchestrator, UnifiedGenerationRequest } from '../services/cloudContentOrchestrator';
import { CloudAIService } from '../services/cloudAi/cloudAiService';
import { AIProviderFactory } from '../services/ai/ai-provider.factory';
import { AIPromptsService } from '../services/ai/ai-prompts.service';
import { AILogsService } from '../services/ai/ai-logs.service';
import { AIProviderName, AIPromptType } from '../services/ai/ai-provider.interface';

const router = Router();

/**
 * GET /api/ai
 * Informational endpoint returning available AI Generation endpoints.
 */
router.get('/', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'online',
    service: 'TNPSC Study Hub AI Generation Engine',
    providers: ['claude', 'gemini'],
    endpoints: {
      providers: 'GET /api/ai/providers',
      setActiveProvider: 'POST /api/ai/providers/active',
      prompts: 'GET /api/ai/prompts',
      savePrompt: 'POST /api/ai/prompts',
      restorePrompt: 'POST /api/ai/prompts/restore',
      history: 'GET /api/ai/history',
      status: 'GET /api/ai/status',
      config: 'POST /api/ai/config',
      testConnection: 'POST /api/ai/test-connection',
      generate: 'POST /api/ai/generate',
    },
  });
});

/**
 * GET /api/ai/providers (Protected)
 * Returns status, model, and active flag for both Claude AI and Gemini AI.
 */
router.get('/providers', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const statuses = await AIProviderFactory.getAllStatuses();
    const activeProvider = await AIProviderFactory.getActiveProvider();
    return res.status(200).json({
      status: 'ok',
      activeProvider: activeProvider.name,
      providers: statuses,
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * POST /api/ai/providers/active (Protected)
 * Sets the default active AI provider ('claude' or 'gemini').
 */
router.post('/providers/active', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { provider } = req.body || {};
    if (!provider || (provider !== 'claude' && provider !== 'gemini')) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid provider. Must be either "claude" or "gemini".',
      });
    }

    await AIProviderFactory.setActiveProvider(provider as AIProviderName);
    const active = await AIProviderFactory.getActiveProvider();
    return res.status(200).json({
      status: 'ok',
      message: `Active AI provider switched to ${active.displayName}.`,
      activeProvider: active.name,
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/ai/prompts (Protected)
 * Retrieves prompts for a specific provider.
 * Query params: ?provider=claude|gemini&promptType=...&history=true
 */
router.get('/prompts', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const provider = (String(req.query.provider || 'claude').toLowerCase() === 'gemini' ? 'gemini' : 'claude') as AIProviderName;
    const promptType = req.query.promptType as AIPromptType | undefined;
    const history = req.query.history === 'true';

    if (history && promptType) {
      const versions = await AIPromptsService.getVersionHistory(provider, promptType);
      return res.status(200).json({ status: 'ok', provider, promptType, versions });
    }

    const prompts = await AIPromptsService.getCurrentPrompts(provider);
    return res.status(200).json({ status: 'ok', provider, prompts });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * POST /api/ai/prompts (Protected)
 * Saves a new version of a prompt for an independent provider.
 */
router.post('/prompts', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { provider, promptType, title, content } = req.body || {};

    if (!provider || (provider !== 'claude' && provider !== 'gemini')) {
      return res.status(400).json({ status: 'error', message: 'provider must be "claude" or "gemini".' });
    }
    if (!promptType || typeof promptType !== 'string') {
      return res.status(400).json({ status: 'error', message: 'promptType is required.' });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ status: 'error', message: 'content cannot be empty.' });
    }

    const saved = await AIPromptsService.savePrompt(
      provider as AIProviderName,
      promptType as AIPromptType,
      title || promptType,
      content
    );

    return res.status(200).json({
      status: 'ok',
      message: `Prompt saved as version ${saved.version} for ${provider}.`,
      prompt: saved,
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * POST /api/ai/prompts/restore (Protected)
 * Restores an earlier prompt version.
 */
router.post('/prompts/restore', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { provider, promptType, version } = req.body || {};

    if (!provider || (provider !== 'claude' && provider !== 'gemini')) {
      return res.status(400).json({ status: 'error', message: 'provider must be "claude" or "gemini".' });
    }
    if (!promptType || !version) {
      return res.status(400).json({ status: 'error', message: 'promptType and version are required.' });
    }

    const restored = await AIPromptsService.restoreVersion(
      provider as AIProviderName,
      promptType as AIPromptType,
      Number(version)
    );

    return res.status(200).json({
      status: 'ok',
      message: `Restored version ${restored.version} for ${provider}/${promptType}.`,
      prompt: restored,
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/ai/history (Protected)
 * Retrieves generation logs and token tracking.
 * Query params: ?provider=claude|gemini|all&limit=50
 */
router.get('/history', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const provider = req.query.provider as string | undefined;
    const limit = Number(req.query.limit) || 50;

    const logs = await AILogsService.getLogs(provider, limit);
    return res.status(200).json({ status: 'ok', logs });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/ai/status (Protected)
 * Returns status of requested or active AI provider.
 */
router.get('/status', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const reqProvider = req.query.provider as string | undefined;
    const providerInstance = reqProvider
      ? AIProviderFactory.getProvider(reqProvider)
      : await AIProviderFactory.getActiveProvider();

    const status = await providerInstance.getStatus();
    return res.status(200).json({
      status: 'ok',
      ...status,
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * POST /api/ai/config (Protected)
 * Saves or updates AI API Key and model for specified provider.
 */
router.post('/config', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { provider = 'claude', apiKey, model } = req.body || {};
    const providerInstance = AIProviderFactory.getProvider(provider);

    if (apiKey !== undefined && typeof apiKey !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid API key format.' });
    }
    if (model !== undefined && typeof model !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid model format.' });
    }

    const updated = await providerInstance.updateCredentials(apiKey, model, true);
    return res.status(200).json({
      success: true,
      message: `${providerInstance.displayName} configuration saved securely.`,
      ...updated,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update AI configuration',
    });
  }
});

/**
 * GET & POST /api/ai/test-connection (Protected)
 * Tests connection to active or specified AI provider.
 */
router.get('/test-connection', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const reqProvider = req.query.provider as string | undefined;
    const providerInstance = reqProvider
      ? AIProviderFactory.getProvider(reqProvider)
      : await AIProviderFactory.getActiveProvider();

    const result = await providerInstance.testConnection();
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      status: 'FAILED',
      message: error?.message || 'Connection test failed',
    });
  }
});

router.post('/test-connection', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { provider = 'claude', apiKey, model } = req.body || {};
    const providerInstance = AIProviderFactory.getProvider(provider);

    const result = await providerInstance.testConnection(apiKey, model);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      status: 'FAILED',
      message: error?.message || 'Connection test failed',
    });
  }
});

/**
 * POST /api/ai/generate (Protected)
 * Unified AI Generator for Study Notes, MCQs, or Both using selected provider.
 * Supports Server-Sent Events (SSE) streaming when ?stream=true.
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

  const {
    provider,
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

  try {
    if (!lessonTitle || typeof lessonTitle !== 'string' || !lessonTitle.trim()) {
      if (isStream) {
        sendStreamEvent({ status: 'error', error: 'lessonTitle is required for generation.' });
        return res.end();
      }
      return res.status(400).json({ status: 'error', message: 'lessonTitle is required for generation.' });
    }

    if (mode === 'mcq') {
      const allowedCounts = [5, 10, 15, 20, 25, 30, 50, 80, 100, 200];
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
      provider: provider === 'gemini' ? 'gemini' : (provider === 'claude' ? 'claude' : undefined),
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
    console.error('[AI Generation Route] Execution Error:', {
      message: error?.message,
      code: error?.code,
    });

    let clientMessage = error.message || 'Generation failed';

    // Log the failed attempt independently
    await AILogsService.logGeneration({
      provider: provider === 'gemini' ? 'gemini' : 'claude',
      model: 'unknown',
      generationType: mode,
      groupId: category,
      standard: Number(standard) || 6,
      subject: String(subject),
      unitId: Number(unitId) || 1,
      lessonTitle: String(lessonTitle),
      language: String(language),
      status: 'failed',
      errorMessage: clientMessage,
    });

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
