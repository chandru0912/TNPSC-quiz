/**
 * Google Gemini Response Validator and JSON Sanitizer
 */

/**
 * Google Gemini Response Validator, JSON Sanitizer, and Schema Verification Engine
 */

export class GeminiJsonParseError extends Error {
  readonly line: number;
  readonly column: number;
  readonly position: number;
  readonly rawSnippet: string;

  constructor(message: string, line: number, column: number, position: number, rawSnippet: string) {
    super(`Gemini returned invalid JSON at line ${line}, column ${column} (position ${position}): ${message}`);
    this.name = 'GeminiJsonParseError';
    this.line = line;
    this.column = column;
    this.position = position;
    this.rawSnippet = rawSnippet;
  }
}

export function getLineAndColumn(text: string, position: number): { line: number; column: number } {
  const clampedPos = Math.max(0, Math.min(position, text.length));
  const slice = text.slice(0, clampedPos);
  const lines = slice.split('\n');
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
}

/**
 * Safely removes trailing commas before '}' or ']' ONLY outside JSON string literals.
 * Never alters commas inside question, option, or explanation text.
 */
function stripTrailingCommasOutsideStrings(input: string): string {
  let out = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      out += ch;
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === ',') {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) j++;
      if (j < input.length && (input[j] === '}' || input[j] === ']')) {
        continue; // Skip trailing comma outside string
      }
    }

    out += ch;
  }

  return out;
}

export function parseGeminiJsonResponse<T>(raw: string): T {
  if (!raw || !raw.trim()) {
    throw new Error('Received empty content from Google Gemini API.');
  }

  let cleaned = raw.trim();

  // Strip ```json and ``` fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }

  // Extract outer JSON object or array if extraneous text/prose surrounds it
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
    // Safe fallback: strip only trailing commas outside string literals
    try {
      const safeCleaned = stripTrailingCommasOutsideStrings(cleaned);
      if (safeCleaned !== cleaned) {
        return JSON.parse(safeCleaned) as T;
      }
    } catch {
      // Fall through to structured error reporting with original parseError
    }

    const posMatch = parseError.message.match(/at position (\d+)/i);
    const position = posMatch ? parseInt(posMatch[1], 10) : 0;
    const { line, column } = getLineAndColumn(cleaned, position);
    const snippetStart = Math.max(0, position - 40);
    const snippetEnd = Math.min(cleaned.length, position + 60);
    const rawSnippet = cleaned.substring(snippetStart, snippetEnd);

    console.error(
      `[GeminiValidator] JSON Parse Error at line ${line}, col ${column} (pos ${position}): ${parseError.message}\nSnippet context: ...${rawSnippet}...`
    );

    throw new GeminiJsonParseError(parseError.message, line, column, position, rawSnippet);
  }
}

export interface ValidatedSyllabusUnit {
  unit_number: number;
  unit_code: string;
  title: string;
  description?: string;
  syllabus_topics: string[];
}

export interface ValidatedSyllabusResponse {
  units: ValidatedSyllabusUnit[];
}

/**
 * Strict schema validator for TNPSC Syllabus structured output.
 * Validates required properties, data types, and unit numbers, and removes duplicates.
 */
export function validateSyllabusUnitsJson(data: any): ValidatedSyllabusResponse {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid JSON structure: Output must be a non-null JSON object.');
  }

  // Support root object `{ units: [...] }` or bare array `[...]`
  let rawUnits: any[] | null = null;
  if (Array.isArray(data.units)) {
    rawUnits = data.units;
  } else if (Array.isArray(data)) {
    rawUnits = data;
  }

  if (!rawUnits || rawUnits.length === 0) {
    throw new Error('Invalid syllabus schema: "units" array is missing or empty.');
  }

  const validatedUnits: ValidatedSyllabusUnit[] = [];

  for (let idx = 0; idx < rawUnits.length; idx++) {
    const u = rawUnits[idx];
    if (!u || typeof u !== 'object') {
      throw new Error(`Invalid unit at index ${idx}: Must be a JSON object.`);
    }

    // 1. Validate unit_number
    const num = Number(u.unit_number);
    if (!Number.isInteger(num) || num <= 0) {
      throw new Error(`Invalid unit at index ${idx}: "unit_number" must be a positive integer.`);
    }

    // 2. Validate unit_code
    const code = String(u.unit_code || `Unit ${num}`).trim();
    if (!code) {
      throw new Error(`Invalid unit ${num}: "unit_code" cannot be empty.`);
    }

    // 3. Validate title
    const title = String(u.title || '').trim();
    if (!title) {
      throw new Error(`Invalid unit ${num}: "title" is required and cannot be empty.`);
    }

    // 4. Validate syllabus_topics array
    if (!Array.isArray(u.syllabus_topics)) {
      throw new Error(`Invalid unit ${num} ("${title}"): "syllabus_topics" must be an array of strings.`);
    }

    const cleanTopics: string[] = [];
    const seenTopics = new Set<string>();

    for (let tIdx = 0; tIdx < u.syllabus_topics.length; tIdx++) {
      const topic = String(u.syllabus_topics[tIdx] || '').trim();
      if (!topic) continue; // Skip empty topic strings

      const normalized = topic.toLowerCase();
      if (!seenTopics.has(normalized)) {
        seenTopics.add(normalized);
        cleanTopics.push(topic); // Preserve exact original wording, casing, and characters
      }
    }

    if (cleanTopics.length === 0) {
      throw new Error(`Invalid unit ${num} ("${title}"): "syllabus_topics" contains no valid topics.`);
    }

    validatedUnits.push({
      unit_number: num,
      unit_code: code,
      title,
      description: u.description ? String(u.description).trim() : '',
      syllabus_topics: cleanTopics,
    });
  }

  // Sort units strictly by unit_number ascending
  validatedUnits.sort((a, b) => a.unit_number - b.unit_number);

  return { units: validatedUnits };
}

export interface ClassifiedGeminiError {
  message: string;
  statusCode: number;
  errorType:
    | 'service_unavailable'
    | 'rate_limit'
    | 'quota_exceeded'
    | 'timeout'
    | 'missing_api_key'
    | 'invalid_api_key'
    | 'model_not_found'
    | 'invalid_response'
    | 'network_error'
    | 'unknown_error';
  retryable: boolean;
  retryAfterSeconds?: number;
}

export function classifyGeminiError(error: any): ClassifiedGeminiError {
  const rawMessage = String(error?.message || '').trim();
  const errMsg = rawMessage.toLowerCase();
  const status = error?.status || error?.statusCode || (errMsg.includes('503') ? 503 : errMsg.includes('429') ? 429 : errMsg.includes('504') ? 504 : 500);

  // 0. Internal Circuit Breaker Open (never mislabel as Gemini 503 overload)
  if (error?.code === 'SERVICE_CIRCUIT_OPEN' || error?.name === 'CircuitOpenError') {
    return {
      message: rawMessage || 'Gemini circuit breaker is temporarily open after repeated failures. Retrying shortly.',
      statusCode: 503,
      errorType: 'service_unavailable',
      retryable: true,
      retryAfterSeconds: 10,
    };
  }

  // Extract Retry-After if available
  let retryAfterSeconds: number | undefined;
  const retryHeader = error?.headers?.get?.('retry-after') || error?.response?.headers?.['retry-after'];
  if (retryHeader) {
    const parsed = parseInt(String(retryHeader), 10);
    if (!isNaN(parsed) && parsed > 0) {
      retryAfterSeconds = parsed;
    }
  } else {
    // Try regex match in error message e.g. "retry after 5s"
    const match = errMsg.match(/retry.*?(?:after|in)\s+(\d+)\s*s/i);
    if (match && match[1]) {
      retryAfterSeconds = parseInt(match[1], 10);
    }
  }

  // 1. Temporary Service Unavailable / High Demand (503, 502, 500)
  if (
    status === 503 ||
    status === 502 ||
    errMsg.includes('503') ||
    errMsg.includes('high demand') ||
    errMsg.includes('service unavailable') ||
    errMsg.includes('overloaded') ||
    errMsg.includes('temporarily unavailable') ||
    errMsg.includes('backend error')
  ) {
    return {
      message: 'Gemini service temporarily overloaded (503). This model is currently experiencing high demand.',
      statusCode: 503,
      errorType: 'service_unavailable',
      retryable: true,
      retryAfterSeconds,
    };
  }

  // 2. Gateway Timeout / Processing Timeout (504)
  if (
    status === 504 ||
    errMsg.includes('504') ||
    errMsg.includes('gateway timeout') ||
    errMsg.includes('deadline exceeded')
  ) {
    return {
      message: 'Processing timeout (504). Google Gemini took too long to respond.',
      statusCode: 504,
      errorType: 'timeout',
      retryable: true,
      retryAfterSeconds,
    };
  }

  // 3. Missing API Key
  if (errMsg.includes('missing') && errMsg.includes('api key')) {
    return {
      message: 'Google Gemini API key is missing. Set GEMINI_API_KEY in the environment or Admin Panel.',
      statusCode: 401,
      errorType: 'missing_api_key',
      retryable: false,
    };
  }

  // 4. Invalid API Key / Auth (401, 403)
  if (
    errMsg.includes('api_key_invalid') ||
    errMsg.includes('invalid api key') ||
    errMsg.includes('api key not valid') ||
    errMsg.includes('unregistered project') ||
    status === 401 ||
    (status === 400 && errMsg.includes('key'))
  ) {
    return {
      message: 'Invalid Google Gemini API key. Please check your key in Google AI Studio (aistudio.google.com).',
      statusCode: 401,
      errorType: 'invalid_api_key',
      retryable: false,
    };
  }

  // 5. Quota Exceeded / Billing
  if (
    errMsg.includes('free tier is not available') ||
    errMsg.includes('set up billing') ||
    (status === 403 && errMsg.includes('billing'))
  ) {
    return {
      message: 'The Gemini API free tier is not available for this project. Please enable billing in Google AI Studio or configure active quota.',
      statusCode: 403,
      errorType: 'quota_exceeded',
      retryable: false,
    };
  }

  if (
    errMsg.includes('resource_exhausted') ||
    errMsg.includes('quota exceeded') ||
    (status === 429 && errMsg.includes('quota'))
  ) {
    return {
      message: 'Google Gemini quota exceeded or billing limit reached for this API key tier.',
      statusCode: 429,
      errorType: 'quota_exceeded',
      retryable: false,
    };
  }

  // 6. Rate Limit (429)
  if (status === 429 || errMsg.includes('rate limit') || errMsg.includes('too many requests')) {
    return {
      message: 'Google Gemini API rate limit reached (429). Please wait a moment before trying again.',
      statusCode: 429,
      errorType: 'rate_limit',
      retryable: true,
      retryAfterSeconds,
    };
  }

  // 7. Model Not Found / Deprecated
  if (
    status === 404 ||
    errMsg.includes('is not found') ||
    errMsg.includes('model not found') ||
    errMsg.includes('unsupported model') ||
    errMsg.includes('no longer available') ||
    errMsg.includes('is no longer available')
  ) {
    return {
      message: 'The selected Gemini model was not found or has been deprecated. Please use a supported fallback model.',
      statusCode: 404,
      errorType: 'model_not_found',
      retryable: false,
    };
  }

  // 8. Safety Filter Blocked
  if (errMsg.includes('safety') || errMsg.includes('blocked') || errMsg.includes('candidate was blocked')) {
    return {
      message: 'Gemini content was blocked by safety filters. Refine the source syllabus excerpt.',
      statusCode: 400,
      errorType: 'invalid_response',
      retryable: false,
    };
  }

  // 9. Network / Connection Errors
  if (
    errMsg.includes('timeout') ||
    errMsg.includes('network') ||
    errMsg.includes('econnreset') ||
    errMsg.includes('fetch failed')
  ) {
    return {
      message: 'Connection to Google Gemini API timed out or network error occurred.',
      statusCode: 504,
      errorType: 'network_error',
      retryable: true,
    };
  }

  // 10. Default / Unknown
  return {
    message: error?.message || 'Unknown Google Gemini API error occurred.',
    statusCode: status >= 400 && status < 600 ? status : 500,
    errorType: 'unknown_error',
    retryable: status >= 500,
  };
}

