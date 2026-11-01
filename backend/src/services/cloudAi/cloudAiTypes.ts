/**
 * Cloud AI Architecture Types & Provider Interfaces
 * TNPSC Study Hub - Flexible Multi-Provider Cloud AI
 */

export type CloudAIProviderName = 'openai' | 'gemini' | 'auto';

export interface CloudAICompletionOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
  timeoutMs?: number;
  retryCount?: number;
}

export interface CloudAIProviderInfo {
  provider: 'openai' | 'gemini' | 'custom' | 'none';
  name: string;
  configured: boolean;
  model: string;
  configuredVia: 'env' | 'custom' | 'none';
}

export interface CloudAIProvider {
  readonly name: string;
  isConfigured(apiKeyOverride?: string): boolean;
  getProviderInfo(apiKeyOverride?: string): CloudAIProviderInfo;
  generateCompletion(
    prompt: string,
    options?: CloudAICompletionOptions,
    apiKeyOverride?: string
  ): Promise<string>;
}

