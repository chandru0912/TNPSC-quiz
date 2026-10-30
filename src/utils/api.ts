const PRODUCTION_BACKEND_URL = 'https://tnpsc-quiz-lval.vercel.app';

function resolveApiBaseUrl(): string {
  const rawEnvUrl = (
    (import.meta.env.VITE_API_BASE_URL as string) ||
    (import.meta.env.VITE_API_URL as string) ||
    (import.meta.env.VITE_BACKEND_URL as string) ||
    ''
  ).trim();

  if (import.meta.env.DEV) {
    // In local development, use relative '/api' paths so Vite's proxy forwards to http://localhost:5000
    // unless a custom non-localhost remote URL is explicitly configured.
    if (rawEnvUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(rawEnvUrl)) {
      return rawEnvUrl.replace(/\/+$/, '');
    }
    return '';
  }

  // In production builds, never allow an accidental localhost URL to override the production backend
  if (rawEnvUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(rawEnvUrl)) {
    return rawEnvUrl.replace(/\/+$/, '');
  }

  return PRODUCTION_BACKEND_URL;
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
  const { timeoutMs = 30000, ...fetchOptions } = options;
  const url = getApiUrl(path);

  if (fetchOptions.signal || timeoutMs <= 0) {
    return fetch(url, fetchOptions);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...fetchOptions,
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
