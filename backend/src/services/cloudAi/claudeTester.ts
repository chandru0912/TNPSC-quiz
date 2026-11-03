/**
 * Genuine Anthropic Claude API Connection Tester
 * Calls Anthropic Messages API directly using @anthropic-ai/sdk.
 * Verifies live credentials, handles specific error codes, and enforces zero mock/fallback.
 */

import Anthropic from '@anthropic-ai/sdk';

export interface ClaudeConnectionTestResult {
  success: boolean;
  status: 'CONNECTED' | 'FAILED';
  provider: 'Anthropic';
  model: string;
  message: string;
  reply?: string;
  errorType?:
    | 'missing_api_key'
    | 'invalid_api_key'
    | 'insufficient_credits'
    | 'unsupported_model'
    | 'rate_limit'
    | 'network_error'
    | 'unknown_error';
}

/**
 * Normalizes custom/legacy model aliases into valid Anthropic API model identifiers.
 */
export function resolveAnthropicModel(rawModel?: string): string {
  const model = String(rawModel || '').trim().toLowerCase();
  if (!model) return 'claude-3-5-sonnet-20241022';

  if (
    model === 'claude-sonnet-5-5' ||
    model === 'claude-3-5-sonnet' ||
    model === 'claude-3.5-sonnet'
  ) {
    return 'claude-3-5-sonnet-20241022';
  }
  if (
    model === 'claude-3-7-sonnet' ||
    model === 'claude-3.7-sonnet' ||
    model === 'claude-sonnet-7'
  ) {
    return 'claude-3-7-sonnet-20250219';
  }
  if (
    model === 'claude-3-5-haiku' ||
    model === 'claude-3.5-haiku' ||
    model === 'claude-haiku-5-5'
  ) {
    return 'claude-3-5-haiku-20241022';
  }
  if (model === 'claude-3-opus' || model === 'claude-opus') {
    return 'claude-3-opus-20240229';
  }
  if (model === 'claude-3-haiku' || model === 'claude-haiku') {
    return 'claude-3-haiku-20240307';
  }

  // If already a specific model version string (e.g. claude-3-5-sonnet-20241022), preserve it
  return rawModel!.trim();
}

/**
 * Tests direct connectivity to the Anthropic Messages API.
 * Only returns status: "CONNECTED" after a successful response from Anthropic.
 */
export async function testClaudeDirectConnection(
  apiKeyOverride?: string,
  modelOverride?: string
): Promise<ClaudeConnectionTestResult> {
  const apiKey = (apiKeyOverride || process.env.ANTHROPIC_API_KEY || '').trim();
  const rawModel = (modelOverride || process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022').trim();
  const model = resolveAnthropicModel(rawModel);

  // 1. Validate API Key presence
  if (!apiKey) {
    return {
      success: false,
      status: 'FAILED',
      provider: 'Anthropic',
      model,
      message:
        'Anthropic API key is not configured. Set ANTHROPIC_API_KEY in the backend environment variables or save your API key in Admin Settings.',
      errorType: 'missing_api_key',
    };
  }

  // 2. Format validation check
  if (!apiKey.startsWith('sk-ant-') && apiKey.length < 20) {
    return {
      success: false,
      status: 'FAILED',
      provider: 'Anthropic',
      model,
      message:
        'Invalid Anthropic API key format. Official Anthropic keys start with "sk-ant-".',
      errorType: 'invalid_api_key',
    };
  }

  try {
    const client = new Anthropic({
      apiKey,
      timeout: 15000, // 15s timeout for fast connection testing
      maxRetries: 1,  // Avoid long hanging retry loops during interactive test
    });

    const response = await client.messages.create({
      model,
      max_tokens: 30,
      messages: [
        {
          role: 'user',
          content: 'Reply with exactly: Claude API connection successful',
        },
      ],
    });

    const reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join(' ')
      .trim();

    return {
      success: true,
      status: 'CONNECTED',
      provider: 'Anthropic',
      model,
      message: 'Claude API connection successful',
      reply,
    };
  } catch (error: any) {
    console.error('[Claude API Connection Test Error]:', {
      name: error?.name,
      status: error?.status,
      message: error?.message,
    });

    // Handle 1: Invalid API Key (HTTP 401)
    if (error instanceof Anthropic.AuthenticationError || error?.status === 401) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'Anthropic',
        model,
        message:
          'Invalid Anthropic API key (HTTP 401 Unauthorized). Verify your key at https://platform.claude.com/settings/keys.',
        errorType: 'invalid_api_key',
      };
    }

    // Handle 2: Insufficient API Credits / Quota (HTTP 400 or 402 with credit/balance details)
    const lowerMsg = String(error?.message || '').toLowerCase();
    if (
      error?.status === 402 ||
      lowerMsg.includes('credit') ||
      lowerMsg.includes('balance') ||
      lowerMsg.includes('billing') ||
      lowerMsg.includes('quota')
    ) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'Anthropic',
        model,
        message:
          'Insufficient Anthropic API credits. Check your credit balance and billing at https://console.anthropic.com/settings/billing.',
        errorType: 'insufficient_credits',
      };
    }

    // Handle 3: Unsupported / Not Found Model (HTTP 404 or HTTP 400 with model message)
    if (
      error instanceof Anthropic.NotFoundError ||
      error?.status === 404 ||
      (error?.status === 400 && lowerMsg.includes('model'))
    ) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'Anthropic',
        model,
        message: `The selected Claude model "${model}" is not available or unsupported for your account. Please select a supported model (e.g., claude-3-5-sonnet-20241022).`,
        errorType: 'unsupported_model',
      };
    }

    // Handle 4: Rate Limit (HTTP 429)
    if (error instanceof Anthropic.RateLimitError || error?.status === 429) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'Anthropic',
        model,
        message:
          'Anthropic API rate limit exceeded (HTTP 429). Please wait a moment before testing again.',
        errorType: 'rate_limit',
      };
    }

    // Handle 5: Network Error / Timeout
    if (
      error instanceof Anthropic.APIConnectionError ||
      error instanceof Anthropic.APIConnectionTimeoutError ||
      error?.code === 'ENOTFOUND' ||
      error?.code === 'ECONNREFUSED' ||
      error?.code === 'ETIMEDOUT' ||
      lowerMsg.includes('fetch failed') ||
      lowerMsg.includes('network') ||
      lowerMsg.includes('timeout')
    ) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'Anthropic',
        model,
        message:
          'Network connection error: Unable to reach Anthropic API servers. Check your internet connection or network proxy.',
        errorType: 'network_error',
      };
    }

    // General fallback
    return {
      success: false,
      status: 'FAILED',
      provider: 'Anthropic',
      model,
      message: error?.message || 'Claude connection test failed unexpectedly.',
      errorType: 'unknown_error',
    };
  }
}

