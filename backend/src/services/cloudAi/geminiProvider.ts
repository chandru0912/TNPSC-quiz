/**
 * Google Gemini Cloud Provider Implementation
 * Uses official Gemini REST API v1beta with timeout and exponential backoff.
 */

import {
  CloudAIProvider,
  CloudAICompletionOptions,
  CloudAIProviderInfo,
} from './cloudAiTypes';

export class GeminiCloudProvider implements CloudAIProvider {
  readonly name = 'gemini';

  private getEffectiveApiKey(apiKeyOverride?: string): string {
    const key = (
      apiKeyOverride ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      ''
    ).trim();
    return key;
  }

  isConfigured(apiKeyOverride?: string): boolean {
    const key = this.getEffectiveApiKey(apiKeyOverride);
    return key.length > 5;
  }

  getProviderInfo(apiKeyOverride?: string): CloudAIProviderInfo {
    const key = this.getEffectiveApiKey(apiKeyOverride);
    const configured = key.length > 5;
    const model = (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim();
    return {
      provider: 'gemini',
      name: 'Google Gemini API',
      configured,
      model,
      configuredVia: apiKeyOverride
        ? 'custom'
        : (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? 'env' : 'none'),
    };
  }

  async generateCompletion(
    prompt: string,
    options?: CloudAICompletionOptions,
    apiKeyOverride?: string
  ): Promise<string> {
    const apiKey = this.getEffectiveApiKey(apiKeyOverride);
    if (!apiKey) {
      throw new Error(
        'Gemini API key is missing. Set GEMINI_API_KEY or GOOGLE_API_KEY in your server environment variables or provide it in Admin settings.'
      );
    }

    const model = (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const contents: any[] = [];
    if (options?.systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: `SYSTEM INSTRUCTION:\n${options.systemPrompt}` }],
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Understood. I will strictly adhere to these instructions.' }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const generationConfig: any = {
      temperature: options?.temperature !== undefined ? options.temperature : 0.2,
      maxOutputTokens: options?.maxTokens || 4096,
    };

    if (options?.responseFormat === 'json') {
      generationConfig.responseMimeType = 'application/json';
    }

    const maxRetries = options?.retryCount !== undefined ? options.retryCount : 3;
    const timeoutMs = options?.timeoutMs || 75000;

    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents,
            generationConfig,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
          if (response.status === 400 || response.status === 403) {
            throw new Error(`Gemini API Error: ${errMsg}`);
          }
          if (response.status === 429) {
            throw new Error(`Gemini quota limit exceeded (429): ${errMsg}`);
          }
          throw new Error(`Gemini API returned error: ${errMsg}`);
        }

        const data: any = await response.json();
        const candidate = data?.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;

        if (!text) {
          throw new Error('Received empty content from Gemini API response.');
        }

        return text;
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
        if (err.name === 'AbortError') {
          lastError = new Error(`Gemini API request timed out after ${timeoutMs / 1000} seconds.`);
        }
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Failed to generate completion from Gemini API.');
  }
}

