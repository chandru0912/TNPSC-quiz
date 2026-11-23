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
 * Returns active provider, model, safely masked key, and live-verified Gemini API health
 * independent of PostgreSQL availability.
 */
let geminiLiveProbeCache: {
  expiresAt: number;
  status: 'CONNECTED' | 'OFFLINE' | 'INVALID_API_KEY' | 'QUOTA_EXCEEDED' | 'MODEL_UNAVAILABLE';
  connected: boolean;
  message: string;
  model: string;
} | null = null;

router.get('/status', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const forceLive = req.query.live === 'true' || req.query.refresh === 'true';
    const statusInfo = await AIProviderConfigService.getProviderStatus('gemini');

    let liveStatus: 'CONNECTED' | 'OFFLINE' | 'INVALID_API_KEY' | 'QUOTA_EXCEEDED' | 'MODEL_UNAVAILABLE' =
      statusInfo.configured ? (statusInfo.connected ? 'CONNECTED' : 'OFFLINE') : 'OFFLINE';
    let liveConnected = statusInfo.connected;
    let liveMessage = statusInfo.statusMessage || (statusInfo.configured ? 'Gemini API key configured.' : 'GEMINI_API_KEY is not configured.');

    if (statusInfo.configured) {
      if (!forceLive && geminiLiveProbeCache && Date.now() < geminiLiveProbeCache.expiresAt) {
        liveStatus = geminiLiveProbeCache.status;
        liveConnected = geminiLiveProbeCache.connected;
        liveMessage = geminiLiveProbeCache.message;
      } else {
        const probe = await AIProviderConfigService.testProviderConnection('gemini');
        if (probe.success) {
          liveStatus = 'CONNECTED';
          liveConnected = true;
          liveMessage = probe.message;
        } else if (probe.errorType === 'invalid_api_key' || probe.errorType === 'missing_api_key') {
          liveStatus = 'INVALID_API_KEY';
          liveConnected = false;
          liveMessage = probe.message;
        } else if (probe.errorType === 'quota_exceeded') {
          liveStatus = 'QUOTA_EXCEEDED';
          liveConnected = false;
          liveMessage = probe.message;
        } else if (probe.errorType === 'model_not_found' || probe.errorType === 'unsupported_model') {
          liveStatus = 'MODEL_UNAVAILABLE';
          liveConnected = false;
          liveMessage = probe.message;
        } else {
          liveStatus = 'OFFLINE';
          liveConnected = false;
          liveMessage = probe.message;
        }
        geminiLiveProbeCache = {
          expiresAt: Date.now() + 60_000,
          status: liveStatus,
          connected: liveConnected,
          message: liveMessage,
          model: probe.model || statusInfo.model,
        };
      }
    }

    return res.status(200).json({
      success: true,
      provider: 'Google Gemini',
      status: liveStatus,
      configured: statusInfo.configured,
      connected: liveConnected,
      statusMessage: liveMessage,
      name: 'Google Gemini AI',
      model: statusInfo.model,
      maskedKey: statusInfo.maskedKey,
      configuredVia: statusInfo.configuredVia,
      isActive: statusInfo.isActive,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, status: 'OFFLINE', message: err.message });
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

