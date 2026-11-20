const POST_LOGIN_REDIRECT_KEY = 'tnpsc_post_login_redirect'

export function isSafeInternalRedirect(target?: string | null): target is string {
  if (!target || typeof target !== 'string') return false
  const trimmed = target.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return false
  if (
    trimmed.startsWith('/login') ||
    trimmed.startsWith('/register') ||
    trimmed.startsWith('/admin')
  ) {
    return false
  }
  return true
}

export function savePostLoginRedirect(target?: string | null): void {
  if (typeof window === 'undefined') return
  if (isSafeInternalRedirect(target)) {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, target)
  }
}

export function clearPostLoginRedirect(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
}

export function resolvePostLoginRedirect(search?: string, state?: unknown): string {
  try {
    if (search) {
      const params = new URLSearchParams(search)
      const queryRedirect = params.get('redirect')
      if (isSafeInternalRedirect(queryRedirect)) {
        return queryRedirect
      }
    }
  } catch {
    // Ignore malformed query strings
  }

  if (state && typeof state === 'object' && 'from' in state) {
    const fromVal = (state as { from?: unknown }).from
    if (typeof fromVal === 'string' && isSafeInternalRedirect(fromVal)) {
      return fromVal
    }
  }

  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)
    if (isSafeInternalRedirect(stored)) {
      return stored
    }
  }

  return '/dashboard'
}

export function buildAuthRedirectUrl(mode: 'login' | 'register', redirectTo?: string): string {
  const basePath = mode === 'login' ? '/login' : '/register'
  if (isSafeInternalRedirect(redirectTo)) {
    return `${basePath}?redirect=${encodeURIComponent(redirectTo)}`
  }
  return basePath
}
