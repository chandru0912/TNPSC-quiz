/**
 * Claude AI Service Manager
 * Central dispatcher for Anthropic Claude completion, JSON parsing and health checks.
 */

import {
  CloudAICompletionOptions,
  CloudAIProviderInfo,
} from './cloudAiTypes';
import { ClaudeCloudProvider } from './claudeProvider';

export class CloudAIServiceManager {
  private claudeProvider = new ClaudeCloudProvider();

  getProviderStatus(): CloudAIProviderInfo {
    return this.claudeProvider.getProviderInfo();
  }

  /**
   * Executes a Claude completion request.
   */
  async generateText(
    prompt: string,
    options?: CloudAICompletionOptions
  ): Promise<string> {
    return this.claudeProvider.generateCompletion(prompt, options);
  }

  /**
   * Generates and parses a structured JSON response with sanitization.
   */
  async generateJson<T>(
    prompt: string,
    options?: CloudAICompletionOptions
  ): Promise<T> {
    const raw = await this.generateText(prompt, {
      ...options,
      responseFormat: 'json',
    });

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
        throw new Error(
          `Claude returned invalid JSON: ${parseError.message}. Content was: ${cleaned.slice(0, 300)}...`
        );
      }
    }
  }

  updateConfiguration(apiKey?: string, model?: string): CloudAIProviderInfo {
    this.claudeProvider.setCredentials(apiKey, model, true);
    return this.getProviderStatus();
  }

  /**
   * Tests connectivity to the Claude API.
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    provider: string;
    model: string;
  }> {
    const info = this.getProviderStatus();

    if (!info.configured) {
      return {
        success: false,
        message:
          'Claude API is not configured. Set ANTHROPIC_API_KEY in the backend environment variables or save your API key in Admin Settings.',
        provider: info.provider,
        model: info.model,
      };
    }

    try {
      await this.claudeProvider.generateCompletion(
        'Respond with "OK" if the connection is operational.',
        { maxTokens: 10, timeoutMs: 15000 }
      );

      return {
        success: true,
        message: 'CLAUDE AI CONNECTED',
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
