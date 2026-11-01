/**
 * Cloud AI Service Manager & Central Dispatcher
 * Provides unified, provider-agnostic completion, JSON parsing, and health verification.
 */

import {
  CloudAIProvider,
  CloudAICompletionOptions,
  CloudAIProviderInfo,
} from './cloudAiTypes';
import { OpenAICloudProvider } from './openAiProvider';
import { GeminiCloudProvider } from './geminiProvider';

export class CloudAIServiceManager {
  private openaiProvider = new OpenAICloudProvider();
  private geminiProvider = new GeminiCloudProvider();

  /**
   * Resolves the active provider according to AI_PROVIDER env setting or configured keys.
   */
  resolveProvider(apiKeyOverride?: string): CloudAIProvider {
    const configuredProvider = (process.env.AI_PROVIDER || 'auto').trim().toLowerCase();

    if (configuredProvider === 'openai') {
      return this.openaiProvider;
    }
    if (configuredProvider === 'gemini') {
      return this.geminiProvider;
    }

    // Auto-detect based on API key presence
    if (apiKeyOverride) {
      if (apiKeyOverride.startsWith('sk-') || apiKeyOverride.startsWith('proj-')) {
        return this.openaiProvider;
      }
      if (apiKeyOverride.startsWith('AIza')) {
        return this.geminiProvider;
      }
    }

    if (this.openaiProvider.isConfigured()) {
      return this.openaiProvider;
    }

    if (this.geminiProvider.isConfigured()) {
      return this.geminiProvider;
    }

    // Default to OpenAI provider (will cleanly inform user if key is unconfigured)
    return this.openaiProvider;
  }

  /**
   * Returns current provider info and readiness.
   */
  getProviderStatus(apiKeyOverride?: string): CloudAIProviderInfo {
    const provider = this.resolveProvider(apiKeyOverride);
    return provider.getProviderInfo(apiKeyOverride);
  }

  /**
   * Executes completion request with active provider.
   */
  async generateText(
    prompt: string,
    options?: CloudAICompletionOptions,
    apiKeyOverride?: string
  ): Promise<string> {
    const provider = this.resolveProvider(apiKeyOverride);
    return provider.generateCompletion(prompt, options, apiKeyOverride);
  }

  /**
   * Generates and parses structured JSON response with sanitization.
   */
  async generateJson<T>(
    prompt: string,
    options?: CloudAICompletionOptions,
    apiKeyOverride?: string
  ): Promise<T> {
    const raw = await this.generateText(
      prompt,
      {
        ...options,
        responseFormat: 'json',
      },
      apiKeyOverride
    );

    return this.parseJsonResponse<T>(raw);
  }

  /**
   * Sanitizes markdown fences, trailing commas, and extracts valid JSON.
   */
  parseJsonResponse<T>(raw: string): T {
    let cleaned = raw.trim();

    // Strip ```json and ``` fences if present
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    }

    // Extract outer JSON object or array if extra prose is present
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
    } else if (firstBracket !== -1) {
      const lastBracket = cleaned.lastIndexOf(']');
      if (lastBracket !== -1 && lastBracket > firstBracket) {
        cleaned = cleaned.substring(firstBracket, lastBracket + 1);
      }
    }

    try {
      return JSON.parse(cleaned) as T;
    } catch (parseError: any) {
      // Clean trailing commas before closing braces/brackets
      try {
        const withoutTrailingCommas = cleaned.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(withoutTrailingCommas) as T;
      } catch {
        throw new Error(`Failed to parse AI JSON response: ${parseError.message}. Content was: ${cleaned.slice(0, 300)}...`);
      }
    }
  }

  /**
   * Tests connection to the active Cloud AI service.
   */
  async testConnection(apiKeyOverride?: string): Promise<{ success: boolean; message: string; provider: string; model: string }> {
    const provider = this.resolveProvider(apiKeyOverride);
    const info = provider.getProviderInfo(apiKeyOverride);

    if (!info.configured) {
      return {
        success: false,
        message: `${info.name} is not configured. Please supply an API key in server environment variables or generator settings.`,
        provider: info.provider,
        model: info.model,
      };
    }

    try {
      const result = await provider.generateCompletion(
        'Respond with "OK" if connection is operational.',
        { maxTokens: 10, timeoutMs: 15000 },
        apiKeyOverride
      );

      return {
        success: true,
        message: `Successfully connected to ${info.name} (${info.model}). Response: ${result.trim()}`,
        provider: info.provider,
        model: info.model,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Connection test failed: ${err.message}`,
        provider: info.provider,
        model: info.model,
      };
    }
  }
}

export const CloudAIService = new CloudAIServiceManager();

