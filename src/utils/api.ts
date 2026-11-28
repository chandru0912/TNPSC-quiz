const LOCAL_BACKEND_URL = 'http://localhost:5000';
const PRODUCTION_BACKEND_URL = 'https://tnpsc-quiz-lval.vercel.app';

function isLocalhostUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url.trim());
}

function isFrontendDevPortUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1):(5173|5174|4173)(\/|$)/i.test(url.trim());
}

function resolveApiBaseUrl(): string {
  const isBrowserOnLocalhost =
    typeof window !== 'undefined' &&
    /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname);

  // In browser on localhost / 127.0.0.1 in development/preview, ALWAYS use relative URL ''
  // to route through Vite's same-origin proxy (/api -> http://localhost:5000).
  // This completely eliminates CORS preflight rejections, private network blocks, and IPv6 vs IPv4 socket mismatches.
  if (isBrowserOnLocalhost) {
    return '';
  }

  const rawEnvUrl = (
    (import.meta.env?.VITE_API_URL as string) ||
    (import.meta.env?.VITE_API_BASE_URL as string) ||
    (import.meta.env?.VITE_BACKEND_URL as string) ||
    ''
  ).trim();

  // If in browser on a remote domain (e.g. deployed on Vercel), check if relative rewrite or explicit URL
  if (typeof window !== 'undefined') {
    if (rawEnvUrl && (rawEnvUrl.startsWith('http://') || rawEnvUrl.startsWith('https://')) && !isLocalhostUrl(rawEnvUrl)) {
      return rawEnvUrl.replace(/\/+$/, '');
    }
    // On Vercel, vercel.json rewrites /api/(.*) automatically, so relative '' is ideal
    return '';
  }

  // Non-browser / SSR environment
  if (rawEnvUrl && !isFrontendDevPortUrl(rawEnvUrl)) {
    return rawEnvUrl.replace(/\/+$/, '');
  }

  return LOCAL_BACKEND_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

export function getApiUrl(path: string): string {
  if (!path || typeof path !== 'string' || path.trim() === '') {
    return API_BASE_URL ? `${API_BASE_URL.replace(/\/+$/, '')}/` : '/';
  }
  const cleanPath = path.trim();
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    return cleanPath;
  }
  let base = API_BASE_URL.replace(/\/+$/, '');
  let normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;

  // Prevent accidental /api/api duplication if base already ends with /api
  if (base.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    normalizedPath = normalizedPath.substring(4);
  }

  if (base) {
    return `${base}${normalizedPath}`;
  }
  return normalizedPath;
}

export function getActiveAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const isAdminPath =
    window.location.pathname.startsWith('/admin') ||
    window.location.pathname === '/owner-login';
  if (isAdminPath) {
    return localStorage.getItem('tnpsc_admin_token') || localStorage.getItem('tnpsc_student_token');
  }
  return localStorage.getItem('tnpsc_student_token');
}

export function getAuthenticatedApiUrl(path: string): string {
  const baseUrl = getApiUrl(path);
  const token = getActiveAuthToken();
  if (!token) return baseUrl;
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}token=${encodeURIComponent(token)}`;
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

// Coalesces concurrent identical GET requests (e.g. StrictMode double-effects or sibling widgets)
// so each caller receives its own cloned Response without firing duplicate network requests.
const inFlightGetRequests = new Map<string, Promise<Response>>();

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const method = String(options.method || 'GET').toUpperCase();
  const canCoalesce = method === 'GET' && !options.signal;

  if (canCoalesce) {
    const dedupUrl = getApiUrl(path);
    const dedupAuth = new Headers(options.headers || {}).get('Authorization') || getActiveAuthToken() || '';
    const dedupKey = `${dedupUrl}|${dedupAuth}`;
    const existing = inFlightGetRequests.get(dedupKey);
    if (existing) {
      const sharedRes = await existing;
      return sharedRes.clone();
    }
    const reqPromise = apiFetchInternal(path, options).finally(() => {
      inFlightGetRequests.delete(dedupKey);
    });
    inFlightGetRequests.set(dedupKey, reqPromise);
    const res = await reqPromise;
    return res.clone();
  }

  return apiFetchInternal(path, options);
}

async function apiFetchInternal(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 30000, cache = 'no-store', ...fetchOptions } = options;
  const primaryUrl = getApiUrl(path);

  const mergedHeaders = new Headers(fetchOptions.headers || {});
  if (!mergedHeaders.has('Authorization')) {
    const activeToken = getActiveAuthToken();
    if (activeToken) {
      mergedHeaders.set('Authorization', `Bearer ${activeToken}`);
    }
  }

  const executeFetch = async (targetUrl: string, signal?: AbortSignal): Promise<Response> => {
    return await fetch(targetUrl, {
      ...fetchOptions,
      credentials: fetchOptions.credentials ?? 'include',
      headers: mergedHeaders,
      cache,
      signal,
    });
  };

  const controller = !fetchOptions.signal && timeoutMs > 0 ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  const activeSignal = controller?.signal || fetchOptions.signal || undefined;

  try {
    try {
      let response = await executeFetch(primaryUrl, activeSignal);

      // Automated Multi-Tier Failover:
      // Trigger if primaryUrl returned 404/405 OR returned HTML (Vercel SPA index.html catch-all on GET /api/*)
      const respContentType = (response.headers.get('content-type') || '').toLowerCase();
      const isApiPath = typeof path === 'string' && path.startsWith('/api/');
      const isSpaHtmlCatchAll = isApiPath && respContentType.includes('text/html');
      const needsFailover =
        (response.status === 404 || response.status === 405 || isSpaHtmlCatchAll) &&
        typeof path === 'string' &&
        path.startsWith('/');

      if (needsFailover) {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        const isBrowserOnLocalhost =
          typeof window !== 'undefined' &&
          /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname);

        // Tier 1 (Production / Remote domains ONLY — never cross-route localhost to production backend):
        // If on remote or preview domain, and primary was relative or not production backend,
        // retry against the canonical PRODUCTION_BACKEND_URL
        if (!isBrowserOnLocalhost && PRODUCTION_BACKEND_URL && !primaryUrl.startsWith(PRODUCTION_BACKEND_URL)) {
          try {
            const fallbackUrl = `${PRODUCTION_BACKEND_URL}${normalizedPath}`;
            const fbRes = await executeFetch(fallbackUrl, activeSignal);
            const fbContentType = (fbRes.headers.get('content-type') || '').toLowerCase();
            if ((fbRes.ok && !fbContentType.includes('text/html')) || (fbRes.status !== 404 && fbRes.status !== 405 && !fbContentType.includes('text/html'))) {
              return fbRes;
            }
          } catch {
            // continue fallback chain
          }
        }

        // Tier 2 (Localhost ONLY): If in local development and primary was relative via dev proxy,
        // retry directly against LOCAL_BACKEND_URL (http://localhost:5000)
        if (isBrowserOnLocalhost && !primaryUrl.startsWith(LOCAL_BACKEND_URL)) {
          try {
            const fbRes = await executeFetch(`${LOCAL_BACKEND_URL}${normalizedPath}`, activeSignal);
            const fbContentType = (fbRes.headers.get('content-type') || '').toLowerCase();
            if ((fbRes.ok && !fbContentType.includes('text/html')) || (fbRes.status !== 404 && fbRes.status !== 405 && !fbContentType.includes('text/html'))) {
              return fbRes;
            }
          } catch {
            // continue
          }
        }
      }

      // Intercept backend Single-Device Session Revocation / Expiration (HTTP 401)
      if (
        response.status === 401 &&
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/admin') &&
        window.location.pathname !== '/owner-login' &&
        localStorage.getItem('tnpsc_student_token')
      ) {
        try {
          const cloned = response.clone();
          const body = await cloned.json().catch(() => null);
          const code = body?.code;
          if (
            code === 'SESSION_REVOKED_OTHER_DEVICE' ||
            code === 'SESSION_EXPIRED' ||
            code === 'SESSION_LOGGED_OUT'
          ) {
            window.dispatchEvent(
              new CustomEvent('tnpsc:student-session-revoked', {
                detail: {
                  code,
                  message:
                    body?.message ||
                    'Your account has been logged in on another device. Please log in again to continue.',
                },
              })
            );
          }
        } catch {
          // non-JSON 401 body
        }
      }

      return response;
    } catch (err: any) {
      if (err?.name !== 'AbortError' && !controller?.signal?.aborted) {
        // Fallback 1: If relative path failed in browser on localhost, try direct LOCAL_BACKEND_URL
        if (primaryUrl.startsWith('/') && typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname)) {
          console.warn(`[apiFetch] Relative fetch to ${primaryUrl} failed. Retrying directly against ${LOCAL_BACKEND_URL}: ${path}`);
          try {
            return await executeFetch(`${LOCAL_BACKEND_URL}${primaryUrl}`, activeSignal);
          } catch {
            // continue
          }
        }
        // Fallback 2: If direct localhost call failed, retry via Vite dev proxy using relative path
        if (primaryUrl.startsWith('http://localhost:5000') || primaryUrl.startsWith('http://127.0.0.1:5000')) {
          console.warn(`[apiFetch] Direct fetch to ${primaryUrl} failed. Retrying via Vite dev proxy: ${path}`);
          try {
            return await executeFetch(path, activeSignal);
          } catch {
            // continue
          }
        }
      }
      throw err;
    }
  } catch (err: any) {
    if (err && (err.name === 'AbortError' || controller?.signal?.aborted)) {
      const timeoutError = new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    if (
      err &&
      (err.message === 'Failed to fetch' ||
        err.message?.includes('Failed to fetch') ||
        err.name === 'TypeError' ||
        err.message?.includes('NetworkError') ||
        err.message?.includes('Load failed'))
    ) {
      const enhancedError = new Error(
        'Could not connect to backend API server. Please ensure the backend server is running on http://localhost:5000.'
      );
      enhancedError.name = 'NetworkError';
      throw enhancedError;
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
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
