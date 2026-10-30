const LOCAL_BACKEND_URL = 'http://localhost:5000';
const PRODUCTION_BACKEND_URL = 'https://tnpsc-quiz-lval.vercel.app';

function isLocalhostUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url.trim());
}

function isFrontendDevPortUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1):(5173|5174|4173)(\/|$)/i.test(url.trim());
}

function resolveApiBaseUrl(): string {
  const rawEnvUrl = (
    (import.meta.env.VITE_API_BASE_URL as string) ||
    (import.meta.env.VITE_API_URL as string) ||
    (import.meta.env.VITE_BACKEND_URL as string) ||
    ''
  ).trim();

  const isBrowserOnLocalhost =
    typeof window === 'undefined'
      ? Boolean(import.meta.env.DEV)
      : /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

  // In production builds or when running on any non-localhost domain (e.g. Vercel),
  // NEVER allow requests to go to localhost or relative frontend paths.
  if (!import.meta.env.DEV || !isBrowserOnLocalhost) {
    if (rawEnvUrl && !isLocalhostUrl(rawEnvUrl)) {
      return rawEnvUrl.replace(/\/+$/, '');
    }
    return PRODUCTION_BACKEND_URL;
  }

  // In local development, use the configured backend URL (if not accidentally set to Vite's port)
  // or default directly to the local Express backend (http://localhost:5000).
  if (rawEnvUrl && !isFrontendDevPortUrl(rawEnvUrl)) {
    return rawEnvUrl.replace(/\/+$/, '');
  }

  return LOCAL_BACKEND_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = API_BASE_URL.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (base) {
    return `${base}${normalizedPath}`;
  }
  return normalizedPath;
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 30000, cache = 'no-store', ...fetchOptions } = options;
  const url = getApiUrl(path);

  if (fetchOptions.signal || timeoutMs <= 0) {
    return fetch(url, {
      ...fetchOptions,
      cache,
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...fetchOptions,
      cache,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err && (err.name === 'AbortError' || controller.signal.aborted)) {
      const timeoutError = new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function parseApiResponse<T = any>(
  res: Response
): Promise<{ data: T; rawText: string }> {
  const rawText = await res.text().catch(() => '');
  if (!rawText) {
    return { data: {} as T, rawText: '' };
  }
  try {
    return { data: JSON.parse(rawText) as T, rawText };
  } catch {
    return { data: {} as T, rawText };
  }
}

export function classifyApiError(
  res: Response,
  data: any,
  rawText: string,
  endpointLabel?: string
): string {
  const backendMessage =
    (typeof data?.message === 'string' && data.message.trim()) ||
    (typeof data?.error === 'string' && data.error.trim()) ||
    '';

  const target = endpointLabel ? ` (${endpointLabel})` : '';

  switch (res.status) {
    case 304:
      return (
        backendMessage ||
        `Not Modified (304): The server or cache returned an unmodified response instead of completing the request${target}. Please retry.`
      );
    case 400:
      return backendMessage || `Bad Request (400): Invalid request parameters or file format${target}.`;
    case 422:
      return backendMessage || `Unprocessable PDF (422): The PDF was uploaded, but text extraction failed${target}.`;
    case 401:
      return (
        backendMessage ||
        `Unauthorized (401): Missing or invalid authentication token${target}. Please sign in again.`
      );
    case 403:
      return (
        backendMessage ||
        `Forbidden (403): Your admin session has expired or lacks permission${target}. Please sign in again.`
      );
    case 404:
      return (
        backendMessage ||
        `Not Found (404): API endpoint${target} was not found on the backend server (${API_BASE_URL || 'local'}).`
      );
    case 409:
      return backendMessage || `Conflict (409): A resource with these specifications already exists${target}.`;
    case 413:
      return (
        backendMessage ||
        `Payload Too Large (413): The uploaded PDF exceeds the maximum request size allowed by the server${target}.`
      );
    case 408:
    case 504:
      return (
        backendMessage ||
        `Request Timeout (${res.status}): The backend server took too long to process the request${target}.`
      );
    case 500:
      if (backendMessage) return backendMessage;
      if (rawText.includes('FUNCTION_INVOCATION_FAILED')) {
        return `Internal Server Error (500): Backend serverless function failed during invocation${target}.`;
      }
      return `Internal Server Error (500): An unexpected error occurred on the backend server${target}.`;
    case 502:
      return (
        backendMessage ||
        `Bad Gateway (502): Received an invalid response from the upstream backend server${target}.`
      );
    case 503:
      return (
        backendMessage ||
        `Service Unavailable (503): The backend server or database is temporarily unavailable${target}.`
      );
    default:
      if (rawText.includes('FUNCTION_PAYLOAD_TOO_LARGE') || rawText.includes('Request Entity Too Large')) {
        return `Payload Too Large (413): The uploaded file exceeds the hosting provider's request body limit${target}.`;
      }
      return backendMessage || `Request failed with HTTP ${res.status}${target}.`;
  }
}

export async function classifyFetchFailure(
  err: any,
  options: { endpointLabel?: string; uploadFileSizeBytes?: number } = {}
): Promise<string> {
  const { endpointLabel, uploadFileSizeBytes } = options;
  const target = endpointLabel ? ` (${endpointLabel})` : '';

  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
    return `Request Timeout: The request${target} timed out before the backend server responded.`;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Network Connection Failure: Your device appears to be offline. Please check your internet connection.';
  }

  // When uploading a >4.5 MB file to a Vercel Serverless backend, Vercel's edge gateway rejects the
  // request with 413 FUNCTION_PAYLOAD_TOO_LARGE before Express CORS middleware runs, causing the
  // browser to block the response and throw TypeError: Failed to fetch.
  const VERCEL_SERVERLESS_LIMIT_BYTES = 4.5 * 1024 * 1024;
  if (
    uploadFileSizeBytes &&
    uploadFileSizeBytes > VERCEL_SERVERLESS_LIMIT_BYTES &&
    /\.vercel\.app$/i.test(API_BASE_URL)
  ) {
    try {
      const healthRes = await apiFetch('/api/health', { timeoutMs: 5000 });
      if (healthRes.ok) {
        const sizeMb = (uploadFileSizeBytes / (1024 * 1024)).toFixed(1);
        return `Payload Too Large (413): The selected PDF (${sizeMb} MB) exceeds the 4.5 MB request body limit enforced by Vercel Serverless Functions (FUNCTION_PAYLOAD_TOO_LARGE). Upload via the local backend (up to 100 MB) or configure direct-to-storage uploads.`;
      }
    } catch {
      // Backend health probe also failed; fall through to network unreachable message
    }
  }

  return `Network Connection Failure: Unable to reach the backend server at ${API_BASE_URL}${target}. Please verify that the backend service is running and accessible.`;
}
