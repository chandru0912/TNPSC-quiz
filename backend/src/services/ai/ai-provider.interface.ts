/**
 * Standard AI Provider Interface & Types
 * TNPSC Study Hub - Independent Claude AI & Google Gemini AI Integration
 */

export type AIProviderName = 'claude' | 'gemini' | 'openai';

export type AIPromptType =
  | 'notes_system'
  | 'notes_template'
  | 'mcq_system'
  | 'mcq_template';

export interface AIProviderConfigInfo {
  provider: AIProviderName;
  name: string;
  configured: boolean;
  model: string;
  configuredVia: 'env' | 'database' | 'none';
  maskedKey: string;
  isActive: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface AIConnectionTestResult {
  success: boolean;
  status: 'CONNECTED' | 'FAILED';
  provider: 'Anthropic' | 'Google Gemini' | 'OpenAI';
  model: string;
  message: string;
  reply?: string;
  latencyMs?: number;
  errorType?:
    | 'missing_api_key'
    | 'invalid_api_key'
    | 'insufficient_credits'
    | 'quota_exceeded'
    | 'unsupported_model'
    | 'model_not_found'
    | 'rate_limit'
    | 'network_error'
    | 'invalid_response'
    | 'unknown_error';
}

export interface AIPromptRecord {
  id?: number;
  provider: AIProviderName;
  promptType: AIPromptType;
  title: string;
  content: string;
  version: number;
  isCurrent: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AICompletionOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
  timeoutMs?: number;
  retryCount?: number;
}

export interface IAIProvider {
  readonly name: AIProviderName;
  readonly displayName: string;

  isConfigured(): boolean;
  getStatus(): Promise<AIProviderConfigInfo>;
  testConnection(apiKeyOverride?: string, modelOverride?: string): Promise<AIConnectionTestResult>;
  updateCredentials(apiKey?: string, model?: string, persist?: boolean): Promise<AIProviderConfigInfo>;

  generateText(prompt: string, options?: AICompletionOptions): Promise<string>;
  generateJson<T>(prompt: string, options?: AICompletionOptions): Promise<T>;
}

