/**
 * Dedicated Google Gemini API Routes
 * Endpoints:
 * - GET  /api/gemini/test   (Protected): Tests Google Gemini API connection directly
 * - POST /api/gemini/test   (Protected): Tests connection with optional override credentials
 * - GET  /api/gemini/status (Protected): Returns current Gemini configuration & key masking
 * - POST /api/gemini/config (Protected): Updates Gemini credentials securely on backend
 */

import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../middleware/auth';
import { AIProviderConfigService } from '../services/ai/ai-provider-config.service';

const router = Router();

/**
 * GET /api/gemini/test (Protected)
 * Real Google Gemini API connectivity test.
 * Enforces zero cross-provider fallback or mocking.
 */
router.get('/test', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const result = await AIProviderConfigService.testProviderConnection('gemini');
    const httpStatus = result.success ? 200 : 400;
    return res.status(httpStatus).json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      status: 'FAILED',
      provider: 'Google Gemini',
      message: error?.message || 'Server error while testing Gemini API connection.',
    });
  }
});

/**
 * POST /api/gemini/test (Protected)
 * Supports testing with optional runtime overrides before persisting.
 */
router.post('/test', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { apiKey, model } = req.body || {};
    const result = await AIProviderConfigService.testProviderConnection('gemini', { apiKey, model });
    const httpStatus = result.success ? 200 : 400;
    return res.status(httpStatus).json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      status: 'FAILED',
      provider: 'Google Gemini',
      message: error?.message || 'Server error while testing Gemini API connection.',
    });
  }
});

/**
 * GET /api/gemini/status (Protected)
 * Returns active provider, model and safely masked key.
 */
router.get('/status', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const statusInfo = await AIProviderConfigService.getProviderStatus('gemini');
    return res.status(200).json({
      success: true,
      provider: 'Google Gemini',
      status: statusInfo.configured ? 'CONFIGURED' : 'NOT_CONFIGURED',
      configured: statusInfo.configured,
      connected: statusInfo.connected,
      name: 'Google Gemini AI',
      model: statusInfo.model,
      maskedKey: statusInfo.maskedKey,
      configuredVia: statusInfo.configuredVia,
      isActive: statusInfo.isActive,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/gemini/config (Protected)
 * Updates and persists Google Gemini API credentials on the server.
 */
router.post('/config', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { apiKey, model } = req.body || {};

    if (apiKey !== undefined && typeof apiKey !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid API key format.' });
    }

    if (model !== undefined && typeof model !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid model format.' });
    }

    const updated = await AIProviderConfigService.updateProviderConfig('gemini', { apiKey, model });
    return res.status(200).json({
      success: true,
      provider: 'Google Gemini',
      message: 'Google Gemini AI configuration saved securely.',
      configured: updated.isConfigured,
      name: 'Google Gemini AI',
      model: updated.model,
      maskedKey: updated.maskedKey,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to update Gemini AI configuration.',
    });
  }
});

export default router;

