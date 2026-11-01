/**
 * OpenAI Cloud Provider Implementation
 * Uses official OpenAI SDK with timeout and exponential backoff retry.
 */

import OpenAI from 'openai';
import {
  CloudAIProvider,
  CloudAICompletionOptions,
  CloudAIProviderInfo,
} from './cloudAiTypes';

export class OpenAICloudProvider implements CloudAIProvider {
  readonly name = 'openai';

  private getEffectiveApiKey(apiKeyOverride?: string): string {
    const key = (apiKeyOverride || process.env.OPENAI_API_KEY || '').trim();
    return key;
  }

  isConfigured(apiKeyOverride?: string): boolean {
    const key = this.getEffectiveApiKey(apiKeyOverride);
    return key.length > 5;
  }

  getProviderInfo(apiKeyOverride?: string): CloudAIProviderInfo {
    const key = this.getEffectiveApiKey(apiKeyOverride);
    const configured = key.length > 5;
    const model = (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
    return {
      provider: 'openai',
      name: 'OpenAI ChatGPT API',
      configured,
      model,
      configuredVia: apiKeyOverride ? 'custom' : (process.env.OPENAI_API_KEY ? 'env' : 'none'),
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
        'OpenAI API key is missing. Set OPENAI_API_KEY in your server environment variables or provide it in Admin settings.'
      );
    }

    const model = (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
    const client = new OpenAI({
      apiKey,
      timeout: options?.timeoutMs || 75000,
      maxRetries: options?.retryCount !== undefined ? options.retryCount : 3,
    });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (options?.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: prompt,
    });

    const requestPayload: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages,
      temperature: options?.temperature !== undefined ? options.temperature : 0.2,
      max_tokens: options?.maxTokens || 4096,
    };

    if (options?.responseFormat === 'json') {
      requestPayload.response_format = { type: 'json_object' };
    }

    try {
      const response = await client.chat.completions.create(requestPayload);
      const content = response.choices?.[0]?.message?.content || '';
      if (!content) {
        throw new Error('Received empty response from OpenAI API.');
      }
      return content;
    } catch (error: any) {
      if (error?.status === 401) {
        throw new Error('Invalid OpenAI API key (401 Unauthorized). Please check your API key.');
      }
      if (error?.status === 429) {
        throw new Error('OpenAI rate limit or quota exceeded (429). Please check your account quota.');
      }
      throw error;
    }
  }
}

