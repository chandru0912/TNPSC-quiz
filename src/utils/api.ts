export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) ||
  (import.meta.env.VITE_API_URL as string) ||
  (import.meta.env.VITE_BACKEND_URL as string) ||
  (import.meta.env.DEV ? '' : 'https://tnpsc-quiz-lval.vercel.app');

export function getApiUrl(path: string): string {
  if (path.startsWith('http')) {
    return path;
  }
  const base = API_BASE_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (base) {
    return `${base}${normalizedPath}`;
  }
  // In development with Vite proxy, use relative paths
  if (import.meta.env.DEV) {
    return normalizedPath;
  }
  // In production, default to relative path. This works if frontend and backend
  // are served from the same origin (reverse proxy). Otherwise set VITE_API_BASE_URL.
  return normalizedPath;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = getApiUrl(path);
  return fetch(url, options);
}
