/**
 * Anthropic Claude Cloud Provider Implementation
 * Uses the official @anthropic-ai/sdk Messages API.
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import {
  CloudAIProvider,
  CloudAICompletionOptions,
  CloudAIProviderInfo,
} from './cloudAiTypes';

const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

export function persistClaudeEnv(apiKey?: string, model?: string): void {
  const envPaths = [
    path.resolve(process.cwd(), 'backend', '.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../backend/.env'),
  ];

  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      try {
        let content = fs.readFileSync(p, 'utf8');
        if (apiKey !== undefined && apiKey.trim()) {
          const cleanKey = apiKey.trim();
          if (/^ANTHROPIC_API_KEY=.*/m.test(content)) {
            content = content.replace(/^ANTHROPIC_API_KEY=.*$/m, `ANTHROPIC_API_KEY=${cleanKey}`);
          } else {
            content += `\nANTHROPIC_API_KEY=${cleanKey}\n`;
          }
        }
        if (model !== undefined && model.trim()) {
          const cleanModel = model.trim();
          if (/^CLAUDE_MODEL=.*/m.test(content)) {
            content = content.replace(/^CLAUDE_MODEL=.*$/m, `CLAUDE_MODEL=${cleanModel}`);
          } else {
            content += `\nCLAUDE_MODEL=${cleanModel}\n`;
          }
        }
        fs.writeFileSync(p, content, 'utf8');
      } catch (e) {
        console.warn(`[ClaudeConfig] Could not update ${p}:`, e);
      }
    }
  }
}

export class ClaudeCloudProvider implements CloudAIProvider {
  readonly name = 'claude';

  private getApiKey(): string {
    return (process.env.ANTHROPIC_API_KEY || '').trim();
  }

  private getModel(): string {
    return (process.env.CLAUDE_MODEL || DEFAULT_MODEL).trim();
  }

  isConfigured(): boolean {
    return this.getApiKey().length > 5;
  }

  getMaskedKey(): string {
    const key = this.getApiKey();
    if (!key) return '';
    if (key.length <= 10) return '••••••••';
    const prefix = key.slice(0, 7);
    const suffix = key.slice(-4);
    return `${prefix}••••••••••••${suffix}`;
  }

  setCredentials(apiKey?: string, model?: string, persist: boolean = true): void {
    if (apiKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = apiKey.trim();
    }
    if (model !== undefined && model.trim()) {
      process.env.CLAUDE_MODEL = model.trim();
    }
    if (persist) {
      persistClaudeEnv(apiKey, model);
    }
  }

  getProviderInfo(): CloudAIProviderInfo {
    return {
      provider: 'claude',
      name: 'Anthropic Claude API',
      configured: this.isConfigured(),
      model: this.getModel(),
      configuredVia: this.getApiKey() ? 'env' : 'none',
      maskedKey: this.getMaskedKey(),
    };
  }

  async generateCompletion(
    prompt: string,
    options?: CloudAICompletionOptions
  ): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(
        'Claude API key is missing. Set ANTHROPIC_API_KEY in the backend environment variables.'
      );
    }

    const client = new Anthropic({
      apiKey,
      timeout: options?.timeoutMs || 75000,
      maxRetries: options?.retryCount !== undefined ? options.retryCount : 3,
    });

    const jsonInstruction =
      options?.responseFormat === 'json'
        ? '\n\nRespond with ONLY valid JSON. Do not wrap it in markdown fences or add any prose.'
        : '';

    try {
      const response = await client.messages.create({
        model: this.getModel(),
        max_tokens: options?.maxTokens || 4096,
        system: options?.systemPrompt
          ? `${options.systemPrompt}${jsonInstruction}`
          : undefined,
        messages: [{ role: 'user', content: `${prompt}${jsonInstruction}` }],
      });

      if (response.stop_reason === 'max_tokens') {
        throw new Error(
          'Claude response was truncated because it reached the max token limit. Reduce the requested batch size and try again.'
        );
      }

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();

      if (!text) {
        throw new Error('Received empty content from the Claude API response.');
      }

      return text;
    } catch (error: any) {
      if (error?.name === 'APIConnectionTimeoutError' || error?.name === 'AbortError') {
        throw new Error('Claude API request timed out. Please try again.');
      }
      if (error?.status === 401) {
        throw new Error('Invalid Claude API key (401 Unauthorized). Check ANTHROPIC_API_KEY.');
      }
      if (error?.status === 403) {
        throw new Error('Claude API access denied (403 Forbidden). Check your API key permissions.');
      }
      if (error?.status === 429) {
        throw new Error('Claude API rate limit exceeded (429). Please wait and try again.');
      }
      if (error?.status === 529) {
        throw new Error('Claude API is temporarily overloaded (529). Please try again shortly.');
      }
      if (typeof error?.status === 'number' && error.status >= 500) {
        throw new Error(`Claude API server error (${error.status}). Please try again.`);
      }
      throw error;
    }
  }
}
