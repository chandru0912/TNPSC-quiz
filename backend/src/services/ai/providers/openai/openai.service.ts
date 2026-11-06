/**
 * OpenAI provider service using the standard Chat Completions API.
 */

import {
  IAIProvider,
  AIProviderName,
  AIProviderConfigInfo,
  AIConnectionTestResult,
  AICompletionOptions,
} from '../../ai-provider.interface';
import {
  getOpenAiApiKey,
  getOpenAiModel,
  maskOpenAiApiKey,
  persistOpenAiEnv,
  resolveOpenAIModel,
} from './openai.config';
import pool from '../../../../db';

export class OpenAIProviderService implements IAIProvider {
  readonly name: AIProviderName = 'openai';
  readonly displayName = 'OpenAI';

  isConfigured(): boolean {
    return getOpenAiApiKey().length > 5;
  }

  async getStatus(): Promise<AIProviderConfigInfo & { connected?: boolean; status?: string }> {
    const key = getOpenAiApiKey();
    let model = getOpenAiModel();
    let isActive = false;
    let connected = false;
    let status = key.length > 5 ? 'READY' : 'OFFLINE';

    try {
      const res = await pool.query(
        'SELECT is_active, model, status, temperature, max_tokens FROM ai_provider_configs WHERE provider = $1',
        ['openai']
      );
      if (res.rows.length > 0) {
        isActive = Boolean(res.rows[0].is_active);
        if (res.rows[0].model) model = res.rows[0].model;
        if (res.rows[0].status) {
          status = res.rows[0].status;
          connected = res.rows[0].status === 'CONNECTED';
        }
      }
    } catch {
      // Table may not yet be initialized.
    }

    return {
      provider: 'openai',
      name: this.displayName,
      configured: key.length > 5,
      connected,
      model,
      configuredVia: key ? 'env' : 'none',
      maskedKey: maskOpenAiApiKey(key),
      isActive,
      status,
    };
  }

  async testConnection(
    apiKeyOverride?: string,
    modelOverride?: string
  ): Promise<AIConnectionTestResult> {
    const apiKey = (apiKeyOverride || getOpenAiApiKey()).trim();
    const rawModel = (modelOverride || getOpenAiModel()).trim();
    const model = resolveOpenAIModel(rawModel);
    const start = Date.now();

    if (!apiKey) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'OpenAI',
        model,
        message: 'OpenAI API key is not configured. Set OPENAI_API_KEY in backend environment.',
        errorType: 'missing_api_key',
        latencyMs: 0,
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with exactly: OpenAI API connection successful' }],
          max_tokens: 20,
          temperature: 0.1,
        }),
      });

      const payload = await response.json().catch(() => null);
      const latencyMs = Date.now() - start;

      if (!response.ok) {
        const message = payload?.error?.message || 'OpenAI connection test failed.';
        const errorType = payload?.error?.code === 'invalid_api_key' ? 'invalid_api_key' : 'unknown_error';

        return {
          success: false,
          status: 'FAILED',
          provider: 'OpenAI',
          model,
          message,
          errorType,
          latencyMs,
        };
      }

      const reply = payload?.choices?.[0]?.message?.content || 'OpenAI API connection successful';
      return {
        success: true,
        status: 'CONNECTED',
        provider: 'OpenAI',
        model,
        message: `OpenAI API connection successful. Verified with model ${model}.`,
        reply,
        latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'OpenAI',
        model,
        message: err?.message || 'OpenAI request failed.',
        errorType: 'network_error',
        latencyMs: Date.now() - start,
      };
    }
  }

  async updateCredentials(
    apiKey?: string,
    model?: string,
    persist: boolean = true
  ): Promise<AIProviderConfigInfo> {
    if (apiKey !== undefined && apiKey.trim()) {
      process.env.OPENAI_API_KEY = apiKey.trim();
    }
    if (model !== undefined && model.trim()) {
      process.env.OPENAI_MODEL = resolveOpenAIModel(model.trim());
    }

    if (persist) {
      persistOpenAiEnv(apiKey, model);
      try {
        await pool.query(
          `INSERT INTO ai_provider_configs (provider, model, is_active, updated_at)
           VALUES ('openai', $1, false, CURRENT_TIMESTAMP)
           ON CONFLICT (provider) DO UPDATE SET
             model = EXCLUDED.model,
             updated_at = CURRENT_TIMESTAMP`,
          [getOpenAiModel()]
        );
      } catch (dbErr) {
        console.warn('[OpenAIService] Database config sync note:', dbErr);
      }
    }

    return this.getStatus();
  }

  async generateText(prompt: string, options?: AICompletionOptions): Promise<string> {
    const apiKey = getOpenAiApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key is missing. Set OPENAI_API_KEY in the environment or Admin Settings.');
    }

    const payload = {
      model: getOpenAiModel(),
      messages: [
        ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      temperature: options?.temperature ?? 0.4,
      max_tokens: options?.maxTokens || 4096,
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(json?.error?.message || 'OpenAI API request failed.');
    }

    const text = json?.choices?.[0]?.message?.content;
    if (!text || typeof text !== 'string') {
      throw new Error('Received empty content from OpenAI API.');
    }

    return text.trim();
  }

  async generateJson<T>(prompt: string, options?: AICompletionOptions): Promise<T> {
    const raw = await this.generateText(prompt, {
      ...options,
      responseFormat: 'json',
    });

    try {
      return JSON.parse(raw);
    } catch {
      const trimmed = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      return JSON.parse(trimmed);
    }
  }
}

export const OpenAIService = new OpenAIProviderService();
