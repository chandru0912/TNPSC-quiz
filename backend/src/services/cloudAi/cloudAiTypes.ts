/**
 * Claude AI Architecture Types & Provider Interfaces
 * TNPSC Study Hub - Anthropic Claude
 */

export type CloudAIProviderName = 'claude';

export interface CloudAICompletionOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
  timeoutMs?: number;
  retryCount?: number;
}

export interface CloudAIProviderInfo {
  provider: 'claude' | 'none';
  name: string;
  configured: boolean;
  model: string;
  configuredVia: 'env' | 'none';
  maskedKey?: string;
}

export interface CloudAIProvider {
  readonly name: string;
  isConfigured(): boolean;
  getProviderInfo(): CloudAIProviderInfo;
  generateCompletion(
    prompt: string,
    options?: CloudAICompletionOptions
  ): Promise<string>;
}
