import { apiFetch } from './api'

interface GoogleCodeResponse {
  code?: string
  scope?: string
  error?: string
  error_description?: string
}

interface GoogleErrorCallbackError {
  type: 'popup_closed' | 'popup_failed_to_open' | 'unknown'
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initCodeClient: (config: {
            client_id: string
            scope: string
            ux_mode?: 'popup' | 'redirect'
            select_account?: boolean
            callback: (response: GoogleCodeResponse) => void
            error_callback?: (error: GoogleErrorCallbackError) => void
          }) => { requestCode: () => void }
        }
      }
    }
  }
}

let gsiLoadPromise: Promise<void> | null = null
let cachedClientId: string | null = null

/**
 * Dynamically loads Google Identity Services (GIS) library once.
 */
export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Sign-In is only available in browser environments.'))
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve()
  }
  if (gsiLoadPromise) {
    return gsiLoadPromise
  }

  gsiLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-gsi="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => {
        gsiLoadPromise = null
        reject(new Error('Unable to load Google Sign-In script. Please check your network connection.'))
      }, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleGsi = 'true'
    script.onload = () => {
      if (window.google?.accounts?.oauth2) {
        resolve()
      } else {
        gsiLoadPromise = null
        reject(new Error('Google Identity Services loaded but OAuth2 client is unavailable.'))
      }
    }
    script.onerror = () => {
      gsiLoadPromise = null
      reject(new Error('Failed to load Google Sign-In. Please disable ad blockers or check your internet connection.'))
    }
    document.head.appendChild(script)
  })

  return gsiLoadPromise
}

/**
 * Resolves the public Google OAuth Client ID from Vite env or the backend config endpoint.
 * Note: Never accesses or handles Google Client Secrets in frontend code.
 */
export async function resolveGoogleClientId(): Promise<string> {
  const envClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim()
  if (envClientId) {
    cachedClientId = envClientId
    return envClientId
  }
  if (cachedClientId) {
    return cachedClientId
  }

  const res = await apiFetch('/api/student/auth/google/config')
  const json = await res.json().catch(() => ({}))
  if (res.ok && json?.clientId) {
    cachedClientId = String(json.clientId).trim()
    return cachedClientId
  }

  throw new Error('Google Sign-In is not configured yet. Missing Google Client ID.')
}

export class GoogleSignInCancelledError extends Error {
  constructor(message = 'Google sign-in popup was closed before completing authentication.') {
    super(message)
    this.name = 'GoogleSignInCancelledError'
  }
}

/**
 * Opens the real Google Account Selection OAuth popup (profile + email scopes)
 * and resolves with the one-time authorization code for backend token exchange & verification.
 */
export async function requestGoogleOAuthCode(): Promise<string> {
  const [clientId] = await Promise.all([resolveGoogleClientId(), loadGoogleIdentityScript()])

  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) {
    throw new Error('Google OAuth client failed to initialize. Please refresh and try again.')
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false
    try {
      const client = oauth2.initCodeClient({
        client_id: clientId,
        scope: 'openid email profile',
        ux_mode: 'popup',
        select_account: true,
        callback: (response: GoogleCodeResponse) => {
          if (settled) return
          settled = true
          if (response.error) {
            if (response.error === 'access_denied') {
              reject(new GoogleSignInCancelledError('Google sign-in permission was cancelled.'))
              return
            }
            reject(new Error(response.error_description || `Google authentication failed (${response.error}).`))
            return
          }
          if (!response.code) {
            reject(new Error('Google did not return an authorization code. Please try again.'))
            return
          }
          resolve(response.code)
        },
        error_callback: (err: GoogleErrorCallbackError) => {
          if (settled) return
          settled = true
          if (err?.type === 'popup_closed') {
            reject(new GoogleSignInCancelledError())
          } else if (err?.type === 'popup_failed_to_open') {
            reject(new Error('Google sign-in popup was blocked by your browser. Please allow popups for this site and retry.'))
          } else {
            reject(new Error('Unable to complete Google Sign-In popup. Please try again.'))
          }
        },
      })

      client.requestCode()
    } catch (err: any) {
      if (!settled) {
        settled = true
        reject(new Error(err?.message || 'Failed to launch Google Sign-In popup.'))
      }
    }
  })
}
