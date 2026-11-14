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
import { GeminiRetryService } from './geminiRetryService';
import pool from '../../../../db';

export class GeminiProviderService implements IAIProvider {
  readonly name: AIProviderName = 'gemini';
  readonly displayName = 'Google Gemini AI';

  isConfigured(): boolean {
    return getGeminiApiKey().length > 5;
  }

  async getStatus(): Promise<AIProviderConfigInfo & { connected?: boolean; status?: string }> {
    const key = getGeminiApiKey();
    let model = getGeminiModel();
    let isActive = false;
    let connected = false;
    let status = key.length > 5 ? 'READY' : 'OFFLINE';

    try {
      const res = await pool.query(
        'SELECT is_active, model, status, temperature, max_tokens FROM ai_provider_configs WHERE provider = $1',
        ['gemini']
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
      // Table may not yet be initialized
    }

    return {
      provider: 'gemini',
      name: this.displayName,
      configured: key.length > 5,
      connected,
      model,
      configuredVia: key ? 'env' : 'none',
      maskedKey: maskGeminiApiKey(key),
      isActive,
      status,
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
      const mappedErrorType =
        classified.errorType === 'service_unavailable' || classified.errorType === 'timeout'
          ? 'network_error'
          : classified.errorType;

      return {
        success: false,
        status: 'FAILED',
        provider: 'Google Gemini',
        model,
        message: classified.message,
        errorType: mappedErrorType as any,
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

    let primaryModel = getGeminiModel();
    try {
      const dbRes = await pool.query('SELECT model FROM ai_provider_configs WHERE provider = $1', ['gemini']);
      if (dbRes.rows[0]?.model) primaryModel = dbRes.rows[0].model;
    } catch {}

    const genAI = new GoogleGenerativeAI(apiKey);

    const execResult = await GeminiRetryService.executeWithRetryAndFallback<string>(
      async (currentModel: string) => {
        const modelConfig: any = {
          model: currentModel,
          generationConfig: {
            temperature: options?.temperature !== undefined ? options.temperature : 0.4,
            maxOutputTokens: options?.maxTokens || 8192,
          },
        };

        if (options?.systemPrompt) {
          modelConfig.systemInstruction = options.systemPrompt;
        }

        if (options?.responseFormat === 'json') {
          modelConfig.generationConfig.responseMimeType = 'application/json';
          if (options.responseSchema) {
            modelConfig.generationConfig.responseSchema = options.responseSchema;
          }
        }

        const geminiModel = genAI.getGenerativeModel(modelConfig);
        const timeoutMs = 60000;

        const timeoutPromise = new Promise<never>((_, reject) => {
          const timer = setTimeout(() => {
            const tErr = new Error(`Google Gemini API request timed out after ${timeoutMs}ms on model "${currentModel}"`);
            (tErr as any).statusCode = 504;
            (tErr as any).errorType = 'timeout';
            reject(tErr);
          }, timeoutMs);
          if (typeof (timer as any).unref === 'function') {
            (timer as any).unref();
          }
        });

        const result = (await Promise.race([
          geminiModel.generateContent(prompt),
          timeoutPromise,
        ])) as any;

        const text = result.response.text().trim();

        if (!text) {
          throw new Error('Received empty content from Google Gemini API.');
        }

        return text;
      },
      {
        primaryModel,
      }
    );

    return execResult.data;
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
