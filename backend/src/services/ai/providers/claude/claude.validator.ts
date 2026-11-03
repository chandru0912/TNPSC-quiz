/**
 * Claude AI Response Validator and JSON Sanitizer
 */

export function parseClaudeJsonResponse<T>(raw: string): T {
  let cleaned = (raw || '').trim();

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

export function classifyClaudeError(error: any): {
  message: string;
  errorType:
    | 'missing_api_key'
    | 'invalid_api_key'
    | 'insufficient_credits'
    | 'unsupported_model'
    | 'rate_limit'
    | 'network_error'
    | 'unknown_error';
} {
  const errMsg = String(error?.message || '').toLowerCase();
  const status = error?.status || error?.statusCode;

  if (errMsg.includes('missing') && errMsg.includes('api key')) {
    return {
      message: 'Anthropic API key is missing. Set ANTHROPIC_API_KEY in the environment or Admin Panel.',
      errorType: 'missing_api_key',
    };
  }

  if (status === 401 || errMsg.includes('invalid api key') || errMsg.includes('authentication')) {
    return {
      message: 'Invalid Claude API Key (401 Unauthorized). Please check your key on platform.claude.com.',
      errorType: 'invalid_api_key',
    };
  }

  if (
    status === 402 ||
    errMsg.includes('credit') ||
    errMsg.includes('balance') ||
    errMsg.includes('billing')
  ) {
    return {
      message: 'Anthropic Claude account has insufficient credits or unpaid invoice.',
      errorType: 'insufficient_credits',
    };
  }

  if (status === 404 || errMsg.includes('model') && errMsg.includes('not found')) {
    return {
      message: 'Requested Claude model was not found or is unavailable for this API key tier.',
      errorType: 'unsupported_model',
    };
  }

  if (status === 429 || errMsg.includes('rate limit') || errMsg.includes('too many requests')) {
    return {
      message: 'Claude API rate limit reached (429). Please wait a moment before trying again.',
      errorType: 'rate_limit',
    };
  }

  if (status === 529 || errMsg.includes('overloaded')) {
    return {
      message: 'Anthropic Claude servers are temporarily overloaded (529). Please retry shortly.',
      errorType: 'rate_limit',
    };
  }

  if (
    error?.name === 'APIConnectionTimeoutError' ||
    error?.name === 'AbortError' ||
    errMsg.includes('timeout') ||
    errMsg.includes('network') ||
    errMsg.includes('econnrefused')
  ) {
    return {
      message: 'Connection to Anthropic Claude timed out or network error occurred.',
      errorType: 'network_error',
    };
  }

  return {
    message: error?.message || 'Unknown Claude API error occurred.',
    errorType: 'unknown_error',
  };
}

