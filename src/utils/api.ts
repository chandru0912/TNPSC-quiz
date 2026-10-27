export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '' : window.location.origin);

export function getApiUrl(path: string): string {
  if (path.startsWith('http')) {
    return path;
  }
  const base = API_BASE_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = getApiUrl(path);
  return fetch(url, options);
}
