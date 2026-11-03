/**
 * Dedicated Claude API Routes
 * Endpoints:
 * - GET  /api/claude/test   (Protected): Tests Anthropic Claude API connection directly
 * - POST /api/claude/test   (Protected): Tests connection with optional override credentials
 * - GET  /api/claude/status (Protected): Returns current Claude configuration & key masking
 * - POST /api/claude/config (Protected): Updates Claude credentials securely on backend
 */

import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../middleware/auth';
import { testClaudeDirectConnection } from '../services/cloudAi/claudeTester';
import { CloudAIService } from '../services/cloudAi/cloudAiService';

const router = Router();

/**
 * GET /api/claude/test (Protected)
 * Real Anthropic Messages API connectivity test.
 * Enforces zero Gemini/OpenAI legacy dependency.
 */
router.get('/test', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const result = await testClaudeDirectConnection();
    const httpStatus = result.success ? 200 : 400;
    return res.status(httpStatus).json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      status: 'FAILED',
      provider: 'Anthropic',
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      message: error?.message || 'Server error while testing Claude API connection.',
    });
  }
});

/**
 * POST /api/claude/test (Protected)
 * Supports testing with optional runtime overrides before persisting.
 */
router.post('/test', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { apiKey, model } = req.body || {};
    const result = await testClaudeDirectConnection(apiKey, model);
    const httpStatus = result.success ? 200 : 400;
    return res.status(httpStatus).json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      status: 'FAILED',
      provider: 'Anthropic',
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      message: error?.message || 'Server error while testing Claude API connection.',
    });
  }
});

/**
 * GET /api/claude/status (Protected)
 * Returns active provider, model and safely masked key.
 */
router.get('/status', requireAdminAuth, (_req: Request, res: Response) => {
  const statusInfo = CloudAIService.getProviderStatus();
  return res.status(200).json({
    success: true,
    provider: 'Anthropic',
    status: statusInfo.configured ? 'CONFIGURED' : 'NOT_CONFIGURED',
    configured: statusInfo.configured,
    name: 'Anthropic Claude API',
    model: statusInfo.model,
    maskedKey: statusInfo.maskedKey,
    configuredVia: statusInfo.configuredVia,
  });
});

/**
 * POST /api/claude/config (Protected)
 * Updates and persists Anthropic API credentials on the server.
 */
router.post('/config', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { apiKey, model } = req.body || {};

    if (apiKey !== undefined && typeof apiKey !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid API key format.' });
    }

    if (model !== undefined && typeof model !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid model format.' });
    }

    const updated = CloudAIService.updateConfiguration(apiKey, model);
    return res.status(200).json({
      success: true,
      provider: 'Anthropic',
      message: 'Claude AI configuration saved securely.',
      configured: updated.configured,
      name: 'Anthropic Claude API',
      model: updated.model,
      maskedKey: updated.maskedKey,
      configuredVia: updated.configuredVia,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to update Claude configuration.',
    });
  }
});

export default router;
