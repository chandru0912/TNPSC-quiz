/**
 * Claude AI Service Manager
 * Central dispatcher for Anthropic Claude completion, JSON parsing and health checks.
 */

import {
  CloudAICompletionOptions,
  CloudAIProviderInfo,
} from './cloudAiTypes';
import { ClaudeCloudProvider } from './claudeProvider';
import { testClaudeDirectConnection, ClaudeConnectionTestResult } from './claudeTester';

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
   * Tests connectivity directly to the Anthropic Claude API.
   */
  async testConnection(apiKeyOverride?: string, modelOverride?: string): Promise<ClaudeConnectionTestResult> {
    return testClaudeDirectConnection(apiKeyOverride, modelOverride);
  }
}

export const CloudAIService = new CloudAIServiceManager();
