/**
 * Google Gemini Response Validator and JSON Sanitizer
 */

export function parseGeminiJsonResponse<T>(raw: string): T {
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
        `Gemini returned invalid JSON: ${parseError.message}. Content was: ${cleaned.slice(0, 300)}...`
      );
    }
  }
}

export function classifyGeminiError(error: any): {
  message: string;
  errorType:
    | 'missing_api_key'
    | 'invalid_api_key'
    | 'quota_exceeded'
    | 'unsupported_model'
    | 'model_not_found'
    | 'rate_limit'
    | 'network_error'
    | 'invalid_response'
    | 'unknown_error';
} {
  const errMsg = String(error?.message || '').toLowerCase();
  const status = error?.status || error?.statusCode;

  if (errMsg.includes('missing') && errMsg.includes('api key')) {
    return {
      message: 'Google Gemini API key is missing. Set GEMINI_API_KEY in the environment or Admin Panel.',
      errorType: 'missing_api_key',
    };
  }

  if (
    errMsg.includes('api_key_invalid') ||
    errMsg.includes('invalid api key') ||
    errMsg.includes('api key not valid') ||
    errMsg.includes('unregistered project') ||
    status === 400 && errMsg.includes('key')
  ) {
    return {
      message: 'Invalid Google Gemini API key. Please check your key in Google AI Studio (aistudio.google.com).',
      errorType: 'invalid_api_key',
    };
  }

  if (
    errMsg.includes('resource_exhausted') ||
    errMsg.includes('quota') ||
    errMsg.includes('quota exceeded') ||
    errMsg.includes('billing')
  ) {
    return {
      message: 'Google Gemini quota exceeded or billing limit reached for this API key tier.',
      errorType: 'quota_exceeded',
    };
  }

  if (
    status === 404 ||
    errMsg.includes('is not found') ||
    errMsg.includes('model not found') ||
    errMsg.includes('unsupported model')
  ) {
    return {
      message: 'Requested Gemini model was not found for this API version. Try gemini-1.5-flash or gemini-2.0-flash.',
      errorType: 'model_not_found',
    };
  }

  if (status === 429 || errMsg.includes('rate limit') || errMsg.includes('too many requests')) {
    return {
      message: 'Google Gemini API rate limit reached (429). Please wait a moment before trying again.',
      errorType: 'rate_limit',
    };
  }

  if (errMsg.includes('safety') || errMsg.includes('blocked') || errMsg.includes('candidate was blocked')) {
    return {
      message: 'Gemini content was blocked by safety filters. Refine the source textbook excerpt.',
      errorType: 'invalid_response',
    };
  }

  if (
    errMsg.includes('timeout') ||
    errMsg.includes('network') ||
    errMsg.includes('econnreset') ||
    errMsg.includes('fetch failed')
  ) {
    return {
      message: 'Connection to Google Gemini API timed out or network error occurred.',
      errorType: 'network_error',
    };
  }

  return {
    message: error?.message || 'Unknown Google Gemini API error occurred.',
    errorType: 'unknown_error',
  };
}

