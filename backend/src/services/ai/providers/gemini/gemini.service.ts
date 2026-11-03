/**
 * Google Gemini Provider Service
 * Implements IAIProvider using official @google/generative-ai SDK.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  IAIProvider,
  AIProviderName,
  AIProviderConfigInfo,
  AIConnectionTestResult,
  AICompletionOptions,
} from '../../ai-provider.interface';
import {
  getGeminiApiKey,
  getGeminiModel,
  maskGeminiApiKey,
  resolveGeminiModel,
  persistGeminiEnv,
} from './gemini.config';
import { parseGeminiJsonResponse, classifyGeminiError } from './gemini.validator';
import pool from '../../../../db';

export class GeminiProviderService implements IAIProvider {
  readonly name: AIProviderName = 'gemini';
  readonly displayName = 'Google Gemini AI';

  isConfigured(): boolean {
    return getGeminiApiKey().length > 5;
  }

  async getStatus(): Promise<AIProviderConfigInfo> {
    const key = getGeminiApiKey();
    const model = getGeminiModel();

    let isActive = false;
    try {
      const res = await pool.query(
        'SELECT is_active, temperature, max_tokens FROM ai_provider_configs WHERE provider = $1',
        ['gemini']
      );
      if (res.rows.length > 0) {
        isActive = Boolean(res.rows[0].is_active);
      }
    } catch {
      // Table may not yet be initialized
    }

    return {
      provider: 'gemini',
      name: this.displayName,
      configured: Boolean(key),
      model,
      configuredVia: key ? 'env' : 'none',
      maskedKey: maskGeminiApiKey(key),
      isActive,
    };
  }

  async testConnection(
    apiKeyOverride?: string,
    modelOverride?: string
  ): Promise<AIConnectionTestResult> {
    const apiKey = (apiKeyOverride || getGeminiApiKey()).trim();
    const rawModel = (modelOverride || getGeminiModel()).trim();
    const model = resolveGeminiModel(rawModel);
    const start = Date.now();

    if (!apiKey) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'Google Gemini',
        model,
        message: 'Google Gemini API key is not configured. Set GEMINI_API_KEY in backend environment.',
        errorType: 'missing_api_key',
        latencyMs: 0,
      };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModel = genAI.getGenerativeModel({
        model,
        generationConfig: {
          maxOutputTokens: 40,
          temperature: 0.1,
        },
      });

      const response = await geminiModel.generateContent(
        'Reply with exactly: Gemini API connection successful'
      );

      const latencyMs = Date.now() - start;
      const reply = response.response.text().trim();

      return {
        success: true,
        status: 'CONNECTED',
        provider: 'Google Gemini',
        model,
        message: `Google Gemini API connection successful. Verified with model ${model}.`,
        reply,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const classified = classifyGeminiError(err);
      return {
        success: false,
        status: 'FAILED',
        provider: 'Google Gemini',
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
      process.env.GEMINI_API_KEY = apiKey.trim();
    }
    if (model !== undefined && model.trim()) {
      const resolved = resolveGeminiModel(model.trim());
      process.env.GEMINI_MODEL = resolved;
    }

    if (persist) {
      persistGeminiEnv(apiKey, model);
      try {
        await pool.query(
          `INSERT INTO ai_provider_configs (provider, model, is_active, updated_at)
           VALUES ('gemini', $1, false, CURRENT_TIMESTAMP)
           ON CONFLICT (provider) DO UPDATE SET
             model = EXCLUDED.model,
             updated_at = CURRENT_TIMESTAMP`,
          [getGeminiModel()]
        );
      } catch (dbErr) {
        console.warn('[GeminiService] Database config sync note:', dbErr);
      }
    }

    return this.getStatus();
  }

  async generateText(prompt: string, options?: AICompletionOptions): Promise<string> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error('Google Gemini API key is missing. Set GEMINI_API_KEY in the environment or Admin Settings.');
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = getGeminiModel();

      const modelConfig: any = {
        model,
        generationConfig: {
          temperature: options?.temperature !== undefined ? options.temperature : 0.4,
          maxOutputTokens: options?.maxTokens || 4096,
        },
      };

      if (options?.systemPrompt) {
        modelConfig.systemInstruction = options.systemPrompt;
      }

      if (options?.responseFormat === 'json') {
        modelConfig.generationConfig.responseMimeType = 'application/json';
      }

      const geminiModel = genAI.getGenerativeModel(modelConfig);
      const result = await geminiModel.generateContent(prompt);
      const text = result.response.text().trim();

      if (!text) {
        throw new Error('Received empty content from Google Gemini API.');
      }

      return text;
    } catch (err: any) {
      const classified = classifyGeminiError(err);
      throw new Error(classified.message);
    }
  }

  async generateJson<T>(prompt: string, options?: AICompletionOptions): Promise<T> {
    const raw = await this.generateText(prompt, {
      ...options,
      responseFormat: 'json',
    });
    return parseGeminiJsonResponse<T>(raw);
  }
}

export const GeminiService = new GeminiProviderService();
