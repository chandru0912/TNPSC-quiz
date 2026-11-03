/**
 * AI Provider Central Configuration Service
 * TNPSC Study Hub - Single Source of Truth for Claude AI & Google Gemini AI
 *
 * Implements centralized provider management:
 * - getProviderConfig(provider)
 * - getProviderStatus(provider)
 * - testProviderConnection(provider)
 * - getActiveProvider()
 * - updateProviderConfig(provider, config)
 */

import pool from '../../db';
import {
  AIProviderName,
  AIProviderConfigInfo,
  AIConnectionTestResult,
} from './ai-provider.interface';
import { AIProviderFactory } from './ai-provider.factory';
import {
  getGeminiApiKey,
  getGeminiModel,
  maskGeminiApiKey,
  persistGeminiEnv,
  resolveGeminiModel,
} from './providers/gemini/gemini.config';
import {
  getClaudeApiKey,
  getClaudeModel,
  maskClaudeApiKey,
  persistClaudeEnv,
} from './providers/claude/claude.config';

export interface ProviderConfigRecord {
  provider: AIProviderName;
  name: string;
  model: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  isConfigured: boolean;
  maskedKey: string;
  status: 'CONNECTED' | 'READY' | 'MODEL_NOT_AVAILABLE' | 'BILLING_REQUIRED' | 'OFFLINE';
  statusMessage?: string;
  lastTestedAt?: string;
}

export class AIProviderConfigService {
  /**
   * 1. getProviderConfig(provider)
   * Retrieves full configuration record from the database merged with environment credentials.
   */
  static async getProviderConfig(provider: AIProviderName): Promise<ProviderConfigRecord> {
    const cleanProvider = (provider === 'gemini' ? 'gemini' : 'claude') as AIProviderName;
    const isGemini = cleanProvider === 'gemini';

    // 1. Check environment variables
    const envKey = isGemini ? getGeminiApiKey() : getClaudeApiKey();
    const envModel = isGemini ? getGeminiModel() : getClaudeModel();

    // 2. Fetch database record
    let dbRow: any = null;
    try {
      const res = await pool.query(
        'SELECT * FROM ai_provider_configs WHERE provider = $1 LIMIT 1',
        [cleanProvider]
      );
      if (res.rows.length > 0) {
        dbRow = res.rows[0];
      }
    } catch (err) {
      console.warn(`[AIConfig] Could not query ai_provider_configs for ${cleanProvider}:`, err);
    }

    const effectiveKey = (dbRow?.api_key || envKey || '').trim();
    const isConfigured = effectiveKey.length > 5;
    const maskedKey = isGemini ? maskGeminiApiKey(effectiveKey) : maskClaudeApiKey(effectiveKey);
    const model = dbRow?.model || envModel || (isGemini ? 'gemini-1.5-flash' : 'claude-3-5-sonnet-20241022');
    const temperature = Number(dbRow?.temperature ?? 0.7);
    const maxTokens = Number(dbRow?.max_tokens ?? 4096);
    const isActive = Boolean(dbRow?.is_active);
    const status = (dbRow?.status || (isConfigured ? 'READY' : 'OFFLINE')) as any;
    const statusMessage = dbRow?.status_message || undefined;
    const lastTestedAt = dbRow?.last_tested_at ? new Date(dbRow.last_tested_at).toISOString() : undefined;

    return {
      provider: cleanProvider,
      name: isGemini ? 'Google Gemini AI' : 'Anthropic Claude AI',
      model,
      temperature,
      maxTokens,
      isActive,
      isConfigured,
      maskedKey,
      status,
      statusMessage,
      lastTestedAt,
    };
  }

  /**
   * 2. getProviderStatus(provider)
   * Returns standard AIProviderConfigInfo for the provider with real-time status.
   */
  static async getProviderStatus(provider: AIProviderName): Promise<AIProviderConfigInfo & {
    connected: boolean;
    status: 'CONNECTED' | 'READY' | 'MODEL_NOT_AVAILABLE' | 'BILLING_REQUIRED' | 'OFFLINE';
    statusMessage?: string;
  }> {
    const cfg = await this.getProviderConfig(provider);
    const connected = cfg.status === 'CONNECTED';

    return {
      provider: cfg.provider,
      name: cfg.name,
      configured: cfg.isConfigured,
      connected,
      model: cfg.model,
      configuredVia: cfg.isConfigured ? 'env' : 'none',
      maskedKey: cfg.maskedKey,
      isActive: cfg.isActive,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
      status: cfg.status,
      statusMessage: cfg.statusMessage,
    };
  }

  /**
   * 3. testProviderConnection(provider, options)
   * Executes genuine connection test against the respective AI API and persists results.
   */
  static async testProviderConnection(
    provider: AIProviderName,
    options?: { apiKey?: string; model?: string }
  ): Promise<AIConnectionTestResult> {
    const cleanProvider = (provider === 'gemini' ? 'gemini' : 'claude') as AIProviderName;
    const providerInstance = AIProviderFactory.getProvider(cleanProvider);

    // If options override is not provided, fetch stored key from config
    let apiKey = options?.apiKey;
    let model = options?.model;

    if (!apiKey) {
      const cfg = await this.getProviderConfig(cleanProvider);
      if (cleanProvider === 'gemini') {
        apiKey = getGeminiApiKey();
      } else {
        apiKey = getClaudeApiKey();
      }
      if (!model) model = cfg.model;
    }

    const testResult = await providerInstance.testConnection(apiKey, model);

    // Determine fine-grained status
    let dbStatus: 'CONNECTED' | 'READY' | 'MODEL_NOT_AVAILABLE' | 'BILLING_REQUIRED' | 'OFFLINE' = 'READY';
    if (testResult.success) {
      dbStatus = 'CONNECTED';
    } else if (testResult.errorType === 'model_not_found' || testResult.errorType === 'unsupported_model') {
      dbStatus = 'MODEL_NOT_AVAILABLE';
    } else if (testResult.errorType === 'quota_exceeded') {
      dbStatus = 'BILLING_REQUIRED';
    } else if (testResult.errorType === 'missing_api_key' || testResult.errorType === 'invalid_api_key') {
      dbStatus = 'OFFLINE';
    } else {
      dbStatus = 'READY';
    }

    // Persist test result into PostgreSQL
    try {
      await pool.query(
        `UPDATE ai_provider_configs 
         SET status = $1, status_message = $2, last_tested_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE provider = $3`,
        [dbStatus, testResult.message, cleanProvider]
      );
    } catch (dbErr) {
      console.warn(`[AIConfig] Could not update test status in db for ${cleanProvider}:`, dbErr);
    }

    return testResult;
  }

  /**
   * 4. getActiveProvider()
   * Retrieves the current system default active AI provider.
   */
  static async getActiveProvider(): Promise<{
    provider: AIProviderName;
    name: string;
    model: string;
    configured: boolean;
    connected: boolean;
    maskedKey: string;
  }> {
    const activeInstance = await AIProviderFactory.getActiveProvider();
    const cfg = await this.getProviderConfig(activeInstance.name);

    return {
      provider: cfg.provider,
      name: cfg.name,
      model: cfg.model,
      configured: cfg.isConfigured,
      connected: cfg.status === 'CONNECTED',
      maskedKey: cfg.maskedKey,
    };
  }

  /**
   * 5. updateProviderConfig(provider, config)
   * Updates database configuration, syncs with .env securely, and updates runtime variables.
   */
  static async updateProviderConfig(
    provider: AIProviderName,
    config: {
      apiKey?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      isActive?: boolean;
    }
  ): Promise<ProviderConfigRecord> {
    const cleanProvider = (provider === 'gemini' ? 'gemini' : 'claude') as AIProviderName;
    const isGemini = cleanProvider === 'gemini';

    // 1. Persist credentials to .env if provided
    if (config.apiKey !== undefined && config.apiKey.trim()) {
      if (isGemini) {
        process.env.GEMINI_API_KEY = config.apiKey.trim();
        persistGeminiEnv(config.apiKey.trim(), config.model);
      } else {
        process.env.ANTHROPIC_API_KEY = config.apiKey.trim();
        persistClaudeEnv(config.apiKey.trim(), config.model);
      }
    }

    if (config.model !== undefined && config.model.trim()) {
      const cleanModel = isGemini ? resolveGeminiModel(config.model.trim()) : config.model.trim();
      if (isGemini) {
        process.env.GEMINI_MODEL = cleanModel;
        persistGeminiEnv(undefined, cleanModel);
      } else {
        process.env.CLAUDE_MODEL = cleanModel;
        persistClaudeEnv(undefined, cleanModel);
      }
    }

    // 2. Persist to PostgreSQL ai_provider_configs
    await pool.query('BEGIN');
    try {
      if (config.isActive) {
        await pool.query('UPDATE ai_provider_configs SET is_active = false');
      }

      const existingRes = await pool.query(
        'SELECT * FROM ai_provider_configs WHERE provider = $1',
        [cleanProvider]
      );

      const targetModel = config.model?.trim()
        ? (isGemini ? resolveGeminiModel(config.model.trim()) : config.model.trim())
        : (existingRes.rows[0]?.model || (isGemini ? getGeminiModel() : getClaudeModel()));

      const targetTemp = config.temperature ?? Number(existingRes.rows[0]?.temperature ?? 0.7);
      const targetTokens = config.maxTokens ?? Number(existingRes.rows[0]?.max_tokens ?? 4096);
      const targetActive = config.isActive !== undefined ? config.isActive : Boolean(existingRes.rows[0]?.is_active);

      await pool.query(
        `INSERT INTO ai_provider_configs (provider, model, temperature, max_tokens, is_active, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (provider) DO UPDATE SET
           model = EXCLUDED.model,
           temperature = EXCLUDED.temperature,
           max_tokens = EXCLUDED.max_tokens,
           is_active = EXCLUDED.is_active,
           updated_at = CURRENT_TIMESTAMP`,
        [cleanProvider, targetModel, targetTemp, targetTokens, targetActive]
      );

      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }

    return this.getProviderConfig(cleanProvider);
  }

  /**
   * Returns aggregated status for all providers.
   */
  static async getAllStatuses(): Promise<any[]> {
    const [claudeStatus, geminiStatus] = await Promise.all([
      this.getProviderStatus('claude'),
      this.getProviderStatus('gemini'),
    ]);
    return [claudeStatus, geminiStatus];
  }
}

