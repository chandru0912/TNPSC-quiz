import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Loader2,
  AlertCircle,
  ShieldCheck,
  X,
} from 'lucide-react'
import OrbitBrandLogo from './OrbitBrandLogo'
import { useStudentAuth } from '../context/StudentAuthContext'
import { apiFetch } from '../utils/api'
import { requestGoogleOAuthCode, GoogleSignInCancelledError } from '../utils/googleOAuth'
import { resolvePostLoginRedirect, clearPostLoginRedirect } from '../utils/authRedirect'

export type AuthMode = 'login' | 'register'

const GOOGLE_REQUIRED_ERROR = 'Please sign in using a verified Google Account.'

interface StudentAuthFormProps {
  initialMode?: AuthMode
  variant?: 'page' | 'modal'
  onClose?: () => void
  onSuccess?: () => void
  onSwitchMode?: (mode: AuthMode) => void
}

export function OfficialGoogleLogo() {
  return (
    <svg className="google-official-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  )
}

export const StudentAuthForm = ({
  initialMode = 'login',
  variant = 'page',
  onClose,
  onSuccess,
  onSwitchMode,
}: StudentAuthFormProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useStudentAuth()

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [serverError, setServerError] = useState<string | null>(null)
  const [infoBanner, setInfoBanner] = useState<string | null>(null)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  useEffect(() => {
    setMode(initialMode)
    setInfoBanner(null)

    if (typeof window !== 'undefined') {
      const revokedMsg = sessionStorage.getItem('tnpsc_session_revoked_msg')
      const params = new URLSearchParams(location.search)
      if (revokedMsg) {
        setServerError(revokedMsg)
        sessionStorage.removeItem('tnpsc_session_revoked_msg')
      } else if (params.get('reason') === 'session_revoked') {
        setServerError(
          'Your account has been logged in on another device. Please sign in again to continue.'
        )
      } else {
        setServerError(null)
      }
    } else {
      setServerError(null)
    }
  }, [initialMode, location.search])

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode)
    setServerError(null)
    setInfoBanner(null)
    onSwitchMode?.(nextMode)
  }

  const completeStudentSession = (token: string, student: any) => {
    login(token, student)
    onSuccess?.()
    const destination = resolvePostLoginRedirect(location.search, location.state)
    clearPostLoginRedirect()
    navigate(destination, { replace: true })
  }

  // Verified Google Account Sign-In / Auto-Registration
  const handleGoogleContinue = async () => {
    setServerError(null)
    setInfoBanner(null)
    setIsGoogleLoading(true)
    try {
      const code = await requestGoogleOAuthCode()
      const res = await apiFetch('/api/student/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri: 'postmessage' }),
      })
      const json = await res.json().catch(() => ({}))

      if (res.ok && json.status === 'success' && json.token && json.student) {
        completeStudentSession(json.token, json.student)
      } else {
        setServerError(json.message || GOOGLE_REQUIRED_ERROR)
      }
    } catch (err: any) {
      if (err instanceof GoogleSignInCancelledError) {
        setInfoBanner(err.message)
      } else {
        setServerError(err?.message || GOOGLE_REQUIRED_ERROR)
      }
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const headerTitle = mode === 'register' ? 'Join TNPSC Aspirant Orbit' : 'Welcome to TNPSC Aspirant Orbit'
  const headerSubtitle =
    mode === 'register'
      ? 'Create your student account securely using your verified Google Account'
      : 'Sign in with your verified Google Account to access your study dashboard'

  return (
    <div className={`auth-card-inner ${variant === 'modal' ? 'auth-card-modal' : ''}`}>
      {variant === 'modal' && onClose && (
        <button
          type="button"
          className="auth-modal-close-btn"
          onClick={onClose}
          aria-label="Close authentication modal"
        >
          <X size={18} />
        </button>
      )}

      {/* Brand Medallion & Heading */}
      <div className="auth-header">
        <div className="auth-icon" aria-hidden="true">
          <OrbitBrandLogo size={36} />
        </div>
        <div className="auth-brand-pill">TNPSC Aspirant Orbit</div>
        <h1 className="auth-title">{headerTitle}</h1>
        <p className="auth-subtitle">{headerSubtitle}</p>
      </div>

      {/* Login / Register Segmented Tabs */}
      <div className="auth-mode-tabs" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={`auth-mode-tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => handleModeChange('login')}
          disabled={isGoogleLoading}
        >
          Login
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          className={`auth-mode-tab ${mode === 'register' ? 'active' : ''}`}
          onClick={() => handleModeChange('register')}
          disabled={isGoogleLoading}
        >
          Register
        </button>
      </div>

      {/* Status & Error Banners */}
      {serverError && (
        <div className="auth-alert auth-alert-error" role="alert">
          <AlertCircle size={17} className="auth-alert-icon" />
          <span>{serverError}</span>
        </div>
      )}

      {infoBanner && !serverError && (
        <div className="auth-alert auth-alert-info" role="status">
          <AlertCircle size={17} className="auth-alert-icon" />
          <span>{infoBanner}</span>
        </div>
      )}

      {/* Google-Only Verified Authentication */}
      <div className="auth-landing-stack">
        <button
          type="button"
          className="auth-google-btn"
          onClick={handleGoogleContinue}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? (
            <>
              <Loader2 size={18} className="spinning" />
              <span>Verifying Google Account...</span>
            </>
          ) : (
            <>
              <OfficialGoogleLogo />
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <div
          className="auth-alert auth-alert-info"
          style={{ marginTop: '0.25rem', alignItems: 'flex-start' }}
        >
          <ShieldCheck size={17} className="auth-alert-icon" style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>
            Only verified Google Accounts are accepted for student registration and sign-in. Select your Google account to continue securely.
          </span>
        </div>
      </div>

      {/* Footer Note */}
      <div className="auth-footer">
        {variant === 'page' ? (
          mode === 'register' ? (
            <p>
              Already have a student account?{' '}
              <Link to="/login" className="auth-link" onClick={() => handleModeChange('login')}>
                Sign in with Google
              </Link>
            </p>
          ) : (
            <p>
              New to TNPSC Aspirant Orbit?{' '}
              <Link to="/register" className="auth-link" onClick={() => handleModeChange('register')}>
                Register with Google
              </Link>
            </p>
          )
        ) : (
          <p>
            {mode === 'register' ? 'Already have an account? ' : 'New to TNPSC Aspirant Orbit? '}
            <button
              type="button"
              className="auth-link auth-inline-btn"
              onClick={() => handleModeChange(mode === 'register' ? 'login' : 'register')}
            >
              {mode === 'register' ? 'Sign in with Google' : 'Register with Google'}
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

export default StudentAuthForm
