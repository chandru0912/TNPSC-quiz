/**
 * Anthropic Claude Provider Service
 * Implements IAIProvider using official @anthropic-ai/sdk Messages API.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  IAIProvider,
  AIProviderName,
  AIProviderConfigInfo,
  AIConnectionTestResult,
  AICompletionOptions,
} from '../../ai-provider.interface';
import {
  getClaudeApiKey,
  getClaudeModel,
  maskClaudeApiKey,
  resolveClaudeModel,
  persistClaudeEnv,
} from './claude.config';
import { parseClaudeJsonResponse, classifyClaudeError } from './claude.validator';
import pool from '../../../../db';

export class ClaudeProviderService implements IAIProvider {
  readonly name: AIProviderName = 'claude';
  readonly displayName = 'Anthropic Claude AI';

  isConfigured(): boolean {
    return getClaudeApiKey().length > 5;
  }

  async getStatus(): Promise<AIProviderConfigInfo> {
    const key = getClaudeApiKey();
    const model = getClaudeModel();

    // Check database if configured as active
    let isActive = true;
    try {
      const res = await pool.query(
        'SELECT is_active, temperature, max_tokens FROM ai_provider_configs WHERE provider = $1',
        ['claude']
      );
      if (res.rows.length > 0) {
        isActive = Boolean(res.rows[0].is_active);
      }
    } catch {
      // Table may not yet be initialized during initial startup
    }

    return {
      provider: 'claude',
      name: this.displayName,
      configured: Boolean(key),
      model,
      configuredVia: key ? 'env' : 'none',
      maskedKey: maskClaudeApiKey(key),
      isActive,
    };
  }

  async testConnection(
    apiKeyOverride?: string,
    modelOverride?: string
  ): Promise<AIConnectionTestResult> {
    const apiKey = (apiKeyOverride || getClaudeApiKey()).trim();
    const rawModel = (modelOverride || getClaudeModel()).trim();
    const model = resolveClaudeModel(rawModel);
    const start = Date.now();

    if (!apiKey) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'Anthropic',
        model,
        message: 'Anthropic Claude API key is not configured. Set ANTHROPIC_API_KEY in backend environment.',
        errorType: 'missing_api_key',
        latencyMs: 0,
      };
    }

    if (!apiKey.startsWith('sk-ant-') && apiKey.length < 20) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'Anthropic',
        model,
        message: 'Invalid Anthropic API key format. Official Claude keys start with "sk-ant-".',
        errorType: 'invalid_api_key',
        latencyMs: 0,
      };
    }

    try {
      const client = new Anthropic({
        apiKey,
        timeout: 25000,
        maxRetries: 0, // Direct real test with no retries
      });

      const response = await client.messages.create({
        model,
        max_tokens: 40,
        messages: [{ role: 'user', content: 'Reply with exactly: Claude API connection successful' }],
      });

      const latencyMs = Date.now() - start;
      const reply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join(' ')
        .trim();

      return {
        success: true,
        status: 'CONNECTED',
        provider: 'Anthropic',
        model,
        message: `Claude API connection successful. Verified with model ${model}.`,
        reply,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const classified = classifyClaudeError(err);
      return {
        success: false,
        status: 'FAILED',
        provider: 'Anthropic',
        model,
        message: classified.message,
        errorType: classified.errorType,
        latencyMs,
      };
    }
  }

  async updateCredentials(
    apiKey?: string,
    model?: string,
    persist: boolean = true
  ): Promise<AIProviderConfigInfo> {
    if (apiKey !== undefined && apiKey.trim()) {
      process.env.ANTHROPIC_API_KEY = apiKey.trim();
    }
    if (model !== undefined && model.trim()) {
      const resolved = resolveClaudeModel(model.trim());
      process.env.CLAUDE_MODEL = resolved;
    }

    if (persist) {
      persistClaudeEnv(apiKey, model);
      try {
        await pool.query(
          `INSERT INTO ai_provider_configs (provider, model, is_active, updated_at)
           VALUES ('claude', $1, true, CURRENT_TIMESTAMP)
           ON CONFLICT (provider) DO UPDATE SET
             model = EXCLUDED.model,
             updated_at = CURRENT_TIMESTAMP`,
          [getClaudeModel()]
        );
      } catch (dbErr) {
        console.warn('[ClaudeService] Database config sync note:', dbErr);
      }
    }

    return this.getStatus();
  }

  async generateText(prompt: string, options?: AICompletionOptions): Promise<string> {
    const apiKey = getClaudeApiKey();
    if (!apiKey) {
      throw new Error('Claude API key is missing. Set ANTHROPIC_API_KEY in the environment or Admin Settings.');
    }

    const client = new Anthropic({
      apiKey,
      timeout: options?.timeoutMs || 85000,
      maxRetries: options?.retryCount !== undefined ? options.retryCount : 2,
    });

    const jsonInstruction =
      options?.responseFormat === 'json'
        ? '\n\nRespond with ONLY valid JSON. Do not wrap it in markdown fences or add any commentary.'
        : '';

    try {
      const response = await client.messages.create({
        model: getClaudeModel(),
        max_tokens: options?.maxTokens || 4096,
        system: options?.systemPrompt ? `${options.systemPrompt}${jsonInstruction}` : undefined,
        messages: [{ role: 'user', content: `${prompt}${jsonInstruction}` }],
      });

      if (response.stop_reason === 'max_tokens') {
        throw new Error('Claude response reached max token limit. Please request a smaller batch or short notes.');
      }

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();

      if (!text) {
        throw new Error('Received empty content from Anthropic Claude API.');
      }

      return text;
    } catch (err: any) {
      const classified = classifyClaudeError(err);
      throw new Error(classified.message);
    }
  }

  async generateJson<T>(prompt: string, options?: AICompletionOptions): Promise<T> {
    const raw = await this.generateText(prompt, {
      ...options,
      responseFormat: 'json',
    });
    return parseClaudeJsonResponse<T>(raw);
  }
}

export const ClaudeService = new ClaudeProviderService();
