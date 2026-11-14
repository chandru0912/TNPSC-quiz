import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  Mail,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Edit3,
  X,
} from 'lucide-react'
import { useStudentAuth } from '../context/StudentAuthContext'
import { apiFetch } from '../utils/api'
import { requestGoogleOAuthCode, GoogleSignInCancelledError } from '../utils/googleOAuth'

export type AuthMode = 'login' | 'register'
type AuthStep = 'landing' | 'email-login' | 'email-register' | 'forgot-password'

interface StudentAuthFormProps {
  initialMode?: AuthMode
  variant?: 'page' | 'modal'
  onClose?: () => void
  onSuccess?: () => void
  onSwitchMode?: (mode: AuthMode) => void
}

interface EmailCheckInfo {
  exists: boolean
  authProvider?: 'email' | 'google' | 'both'
  hasPassword?: boolean
  isActive?: boolean
}

const TARGET_GROUP_OPTIONS = [
  { value: 'group4', label: 'TNPSC Group 4 & VAO' },
  { value: 'group2', label: 'TNPSC Group 2' },
  { value: 'group2a', label: 'TNPSC Group 2A' },
  { value: 'group1', label: 'TNPSC Group 1' },
]

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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const StudentAuthForm = ({
  initialMode = 'login',
  variant = 'page',
  onClose,
  onSuccess,
  onSwitchMode,
}: StudentAuthFormProps) => {
  const navigate = useNavigate()
  const { login } = useStudentAuth()

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [step, setStep] = useState<AuthStep>('landing')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [targetGroup, setTargetGroup] = useState('group4')
  const [rememberMe, setRememberMe] = useState(true)

  // Forgot password state
  const [resetRequested, setResetRequested] = useState(false)
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [devResetHint, setDevResetHint] = useState<string | null>(null)

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [emailInfo, setEmailInfo] = useState<EmailCheckInfo | null>(null)

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [infoBanner, setInfoBanner] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [isEmailChecking, setIsEmailChecking] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  useEffect(() => {
    setMode(initialMode)
    setStep('landing')
    setFieldErrors({})
    setServerError(null)
    setInfoBanner(null)
  }, [initialMode])

  const clearFeedback = () => {
    setFieldErrors({})
    setServerError(null)
    setInfoBanner(null)
    setSuccessMessage(null)
  }

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode)
    setStep('landing')
    setEmailInfo(null)
    clearFeedback()
    onSwitchMode?.(nextMode)
  }

  const completeStudentSession = (token: string, student: any) => {
    login(token, student)
    onSuccess?.()
    navigate('/dashboard')
  }

  // 1. Continue with Google (Real OAuth Popup + Backend Token Exchange)
  const handleGoogleContinue = async () => {
    clearFeedback()
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
        setServerError(json.message || 'Google Sign-In failed. Please try again.')
      }
    } catch (err: any) {
      if (err instanceof GoogleSignInCancelledError) {
        setInfoBanner(err.message)
      } else {
        setServerError(err?.message || 'Unable to sign in with Google right now. Please try again.')
      }
    } finally {
      setIsGoogleLoading(false)
    }
  }

  // 2. Continue with Email from Landing
  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    clearFeedback()

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      setFieldErrors({ email: 'Email address is required' })
      return
    }
    if (!emailRegex.test(cleanEmail)) {
      setFieldErrors({ email: 'Please enter a valid email address' })
      return
    }

    setEmail(cleanEmail)
    setIsEmailChecking(true)
    try {
      const res = await apiFetch('/api/student/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok || json.status !== 'success') {
        setServerError(json.message || 'Could not verify email status. Please try again.')
        return
      }

      setEmailInfo(json)

      if (json.exists) {
        if (json.isActive === false) {
          setServerError('This account has been deactivated. Please contact an administrator.')
          return
        }
        setStep('email-login')
        setPassword('')
        if (mode === 'register') {
          setInfoBanner('An account already exists with this email. Sign in below to continue.')
        } else if (json.authProvider === 'google' && !json.hasPassword) {
          setInfoBanner('This account uses Google Sign-In. Click "Continue with Google" or use "Forgot Password?" to create an email password.')
        }
      } else {
        setStep('email-register')
        setPassword('')
        setConfirmPassword('')
        if (mode === 'login') {
          setInfoBanner('No account found for this email yet. Complete your registration below.')
        }
      }
    } catch (err: any) {
      // Fallback: proceed to the step implied by active tab if offline check fails
      setStep(mode === 'register' ? 'email-register' : 'email-login')
      if (err?.message) {
        setInfoBanner('Proceeding with email authentication.')
      }
    } finally {
      setIsEmailChecking(false)
    }
  }

  // 3. Existing User Email + Password Login
  const handleEmailLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setSuccessMessage(null)

    const errors: Record<string, string> = {}
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) errors.email = 'Email address is required'
    else if (!emailRegex.test(cleanEmail)) errors.email = 'Please enter a valid email address'

    if (!password) errors.password = 'Password is required'

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsSubmitting(true)
    try {
      const res = await apiFetch('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password, rememberMe }),
      })
      const json = await res.json().catch(() => ({}))

      if (res.ok && json.status === 'success' && json.token && json.student) {
        completeStudentSession(json.token, json.student)
      } else {
        setServerError(json.message || 'Login failed. Please check your credentials.')
      }
    } catch (err: any) {
      setServerError(err?.message || 'Unable to connect to the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 4. New User Email Registration
  const handleEmailRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setSuccessMessage(null)

    const errors: Record<string, string> = {}
    const cleanEmail = email.trim().toLowerCase()

    if (!fullName.trim()) errors.fullName = 'Full name is required'
    if (!cleanEmail) errors.email = 'Email address is required'
    else if (!emailRegex.test(cleanEmail)) errors.email = 'Please enter a valid email address'

    if (!password) errors.password = 'Password is required'
    else if (password.length < 6) errors.password = 'Password must be at least 6 characters'

    if (!confirmPassword) errors.confirmPassword = 'Confirm password is required'
    else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match'

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsSubmitting(true)
    try {
      const res = await apiFetch('/api/student/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: cleanEmail,
          password,
          confirmPassword,
          targetGroup,
        }),
      })
      const json = await res.json().catch(() => ({}))

      if (res.ok && json.status === 'success' && json.token && json.student) {
        completeStudentSession(json.token, json.student)
      } else {
        setServerError(json.message || 'Registration failed. Please try again.')
      }
    } catch (err: any) {
      setServerError(err?.message || 'Unable to connect to the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 5. Forgot Password Step A: Request Reset Code
  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    clearFeedback()

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      setFieldErrors({ email: 'Email address is required' })
      return
    }
    if (!emailRegex.test(cleanEmail)) {
      setFieldErrors({ email: 'Please enter a valid email address' })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiFetch('/api/student/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.status === 'success') {
        setResetRequested(true)
        setSuccessMessage(json.message || 'Reset code generated. Enter it below with your new password.')
        if (json.devResetCode) {
          setDevResetHint(String(json.devResetCode))
        } else {
          setDevResetHint(null)
        }
      } else {
        setServerError(json.message || 'Unable to request password reset.')
      }
    } catch (err: any) {
      setServerError(err?.message || 'Unable to connect to the server.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 6. Forgot Password Step B: Submit Reset Code + New Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setSuccessMessage(null)

    const errors: Record<string, string> = {}
    if (!resetCode.trim()) errors.resetCode = 'Reset code is required'
    if (!newPassword) errors.newPassword = 'New password is required'
    else if (newPassword.length < 6) errors.newPassword = 'Password must be at least 6 characters'
    if (!confirmNewPassword) errors.confirmNewPassword = 'Confirm password is required'
    else if (newPassword !== confirmNewPassword) errors.confirmNewPassword = 'Passwords do not match'

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsSubmitting(true)
    try {
      const res = await apiFetch('/api/student/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          resetCode: resetCode.trim(),
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.status === 'success') {
        setResetRequested(false)
        setResetCode('')
        setNewPassword('')
        setConfirmNewPassword('')
        setDevResetHint(null)
        setPassword('')
        setStep('email-login')
        setSuccessMessage(json.message || 'Password updated successfully. You can now log in.')
      } else {
        setServerError(json.message || 'Invalid or expired reset code.')
      }
    } catch (err: any) {
      setServerError(err?.message || 'Unable to connect to the server.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const anyBusy = isSubmitting || isEmailChecking || isGoogleLoading

  const headerTitle =
    step === 'forgot-password'
      ? 'Reset Password'
      : step === 'email-login'
        ? 'Welcome Back'
        : step === 'email-register'
          ? 'Create Account'
          : mode === 'register'
            ? 'Join TNPSC Study Hub'
            : 'Welcome Back'

  const headerSubtitle =
    step === 'forgot-password'
      ? 'Recover access or set an email password for your student account'
      : step === 'email-login'
        ? 'Enter your password to access your TNPSC Study Hub dashboard'
        : step === 'email-register'
          ? 'Complete your student profile to start preparing'
          : 'Continue with Google or Email to access your study dashboard'

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
          {step === 'forgot-password' ? <KeyRound size={30} /> : <GraduationCap size={32} />}
        </div>
        <div className="auth-brand-pill">TNPSC Study Hub</div>
        <h1 className="auth-title">{headerTitle}</h1>
        <p className="auth-subtitle">{headerSubtitle}</p>
      </div>

      {/* Login / Register Segmented Tabs */}
      {step !== 'forgot-password' && (
        <div className="auth-mode-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login' && step !== 'email-register'}
            className={`auth-mode-tab ${mode === 'login' && step !== 'email-register' ? 'active' : ''}`}
            onClick={() => handleModeChange('login')}
            disabled={anyBusy}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register' || step === 'email-register'}
            className={`auth-mode-tab ${mode === 'register' || step === 'email-register' ? 'active' : ''}`}
            onClick={() => handleModeChange('register')}
            disabled={anyBusy}
          >
            Register
          </button>
        </div>
      )}

      {/* Status & Error Banners */}
      {serverError && (
        <div className="auth-alert auth-alert-error" role="alert">
          <AlertCircle size={17} className="auth-alert-icon" />
          <span>{serverError}</span>
        </div>
      )}

      {successMessage && (
        <div className="auth-alert auth-alert-success" role="status">
          <CheckCircle2 size={17} className="auth-alert-icon" />
          <span>{successMessage}</span>
        </div>
      )}

      {infoBanner && !serverError && (
        <div className="auth-alert auth-alert-info" role="status">
          <AlertCircle size={17} className="auth-alert-icon" />
          <span>{infoBanner}</span>
        </div>
      )}

      {/* STEP 1: LANDING (Continue with Email + OR + Continue with Google) */}
      {step === 'landing' && (
        <div className="auth-landing-stack">
          <form className="auth-form" onSubmit={handleEmailContinue} noValidate>
            <div className="form-group">
              <label htmlFor="auth-landing-email" className="form-label">
                Email Address
              </label>
              <div className="input-wrapper">
                <input
                  id="auth-landing-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  className={`form-input ${fieldErrors.email ? 'error' : ''}`}
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' })
                    if (serverError) setServerError(null)
                  }}
                  disabled={anyBusy}
                />
              </div>
              {fieldErrors.email && <span className="error-text">{fieldErrors.email}</span>}
            </div>

            <button type="submit" className="btn btn-primary auth-btn" disabled={anyBusy}>
              {isEmailChecking ? (
                <>
                  <Loader2 size={18} className="spinning" />
                  <span>Checking email...</span>
                </>
              ) : (
                <>
                  <Mail size={18} />
                  <span>Continue with Email</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="auth-divider" aria-hidden="true">
            <span>OR</span>
          </div>

          <button
            type="button"
            className="auth-google-btn"
            onClick={handleGoogleContinue}
            disabled={anyBusy}
          >
            {isGoogleLoading ? (
              <>
                <Loader2 size={18} className="spinning" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <OfficialGoogleLogo />
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <div className="auth-landing-meta">
            <button
              type="button"
              className="forgot-link auth-inline-btn"
              onClick={() => {
                clearFeedback()
                setResetRequested(false)
                setStep('forgot-password')
              }}
              disabled={anyBusy}
            >
              Forgot Password?
            </button>
          </div>
        </div>
      )}

      {/* STEP 2A: EXISTING USER EMAIL LOGIN */}
      {step === 'email-login' && (
        <div className="auth-landing-stack">
          <div className="auth-email-chip">
            <div className="auth-email-chip-left">
              <Mail size={15} />
              <span title={email}>{email}</span>
            </div>
            <button
              type="button"
              className="auth-email-change-btn"
              onClick={() => {
                clearFeedback()
                setStep('landing')
              }}
              disabled={anyBusy}
            >
              <Edit3 size={13} />
              <span>Change</span>
            </button>
          </div>

          {emailInfo?.authProvider === 'google' && !emailInfo?.hasPassword && (
            <button
              type="button"
              className="auth-google-btn"
              onClick={handleGoogleContinue}
              disabled={anyBusy}
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 size={18} className="spinning" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <OfficialGoogleLogo />
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          )}

          <form className="auth-form" onSubmit={handleEmailLoginSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="auth-login-password" className="form-label">
                Password
              </label>
              <div className="input-wrapper">
                <input
                  id="auth-login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  className={`form-input ${fieldErrors.password ? 'error' : ''}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: '' })
                    if (serverError) setServerError(null)
                  }}
                  disabled={anyBusy}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              {fieldErrors.password && <span className="error-text">{fieldErrors.password}</span>}
            </div>

            <div className="form-row">
              <label className="checkbox-group" htmlFor="auth-remember-me">
                <input
                  id="auth-remember-me"
                  type="checkbox"
                  className="checkbox-input"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="checkbox-label">Remember me</span>
              </label>

              <button
                type="button"
                className="forgot-link auth-inline-btn"
                onClick={() => {
                  clearFeedback()
                  setResetRequested(false)
                  setStep('forgot-password')
                }}
                disabled={anyBusy}
              >
                Forgot Password?
              </button>
            </div>

            <button type="submit" className="btn btn-primary auth-btn" disabled={anyBusy}>
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="spinning" />
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <span>Login</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* STEP 2B: NEW USER EMAIL REGISTRATION */}
      {step === 'email-register' && (
        <div className="auth-landing-stack">
          <div className="auth-email-chip">
            <div className="auth-email-chip-left">
              <Mail size={15} />
              <span title={email}>{email}</span>
            </div>
            <button
              type="button"
              className="auth-email-change-btn"
              onClick={() => {
                clearFeedback()
                setStep('landing')
              }}
              disabled={anyBusy}
            >
              <Edit3 size={13} />
              <span>Change</span>
            </button>
          </div>

          <form className="auth-form" onSubmit={handleEmailRegisterSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="auth-reg-fullname" className="form-label">
                Full Name
              </label>
              <input
                id="auth-reg-fullname"
                type="text"
                name="fullName"
                autoComplete="name"
                className={`form-input ${fieldErrors.fullName ? 'error' : ''}`}
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value)
                  if (fieldErrors.fullName) setFieldErrors({ ...fieldErrors, fullName: '' })
                  if (serverError) setServerError(null)
                }}
                disabled={anyBusy}
              />
              {fieldErrors.fullName && <span className="error-text">{fieldErrors.fullName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="auth-reg-email" className="form-label">
                Email Address
              </label>
              <input
                id="auth-reg-email"
                type="email"
                name="email"
                autoComplete="email"
                className={`form-input ${fieldErrors.email ? 'error' : ''}`}
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' })
                  if (serverError) setServerError(null)
                }}
                disabled={anyBusy}
              />
              {fieldErrors.email && <span className="error-text">{fieldErrors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="auth-reg-target-group" className="form-label">
                Target Exam Group
              </label>
              <select
                id="auth-reg-target-group"
                name="targetGroup"
                className="form-input auth-select"
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                disabled={anyBusy}
              >
                {TARGET_GROUP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="auth-reg-password" className="form-label">
                Password
              </label>
              <div className="input-wrapper">
                <input
                  id="auth-reg-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  className={`form-input ${fieldErrors.password ? 'error' : ''}`}
                  placeholder="Create a password (min 6 characters)"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: '' })
                    if (serverError) setServerError(null)
                  }}
                  disabled={anyBusy}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              {fieldErrors.password && <span className="error-text">{fieldErrors.password}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="auth-reg-confirm-password" className="form-label">
                Confirm Password
              </label>
              <div className="input-wrapper">
                <input
                  id="auth-reg-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  autoComplete="new-password"
                  className={`form-input ${fieldErrors.confirmPassword ? 'error' : ''}`}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (fieldErrors.confirmPassword) setFieldErrors({ ...fieldErrors, confirmPassword: '' })
                    if (serverError) setServerError(null)
                  }}
                  disabled={anyBusy}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              {fieldErrors.confirmPassword && <span className="error-text">{fieldErrors.confirmPassword}</span>}
            </div>

            <button type="submit" className="btn btn-primary auth-btn" disabled={anyBusy}>
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="spinning" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Register</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* STEP 3: FORGOT & RESET PASSWORD */}
      {step === 'forgot-password' && (
        <div className="auth-landing-stack">
          {!resetRequested ? (
            <form className="auth-form" onSubmit={handleForgotPasswordRequest} noValidate>
              <div className="form-group">
                <label htmlFor="auth-forgot-email" className="form-label">
                  Account Email Address
                </label>
                <input
                  id="auth-forgot-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  className={`form-input ${fieldErrors.email ? 'error' : ''}`}
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' })
                    if (serverError) setServerError(null)
                  }}
                  disabled={anyBusy}
                />
                {fieldErrors.email && <span className="error-text">{fieldErrors.email}</span>}
              </div>

              <button type="submit" className="btn btn-primary auth-btn" disabled={anyBusy}>
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="spinning" />
                    <span>Generating Reset Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Code</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleResetPasswordSubmit} noValidate>
              {devResetHint && (
                <div className="auth-dev-code-box">
                  <span>
                    Verification Code: <strong>{devResetHint}</strong>
                  </span>
                  <button
                    type="button"
                    className="auth-email-change-btn"
                    onClick={() => setResetCode(devResetHint)}
                  >
                    Fill
                  </button>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="auth-reset-code" className="form-label">
                  Reset Code
                </label>
                <input
                  id="auth-reset-code"
                  type="text"
                  className={`form-input ${fieldErrors.resetCode ? 'error' : ''}`}
                  placeholder="Enter 6-digit reset code"
                  value={resetCode}
                  onChange={(e) => {
                    setResetCode(e.target.value)
                    if (fieldErrors.resetCode) setFieldErrors({ ...fieldErrors, resetCode: '' })
                  }}
                  disabled={anyBusy}
                />
                {fieldErrors.resetCode && <span className="error-text">{fieldErrors.resetCode}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="auth-new-password" className="form-label">
                  New Password
                </label>
                <div className="input-wrapper">
                  <input
                    id="auth-new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`form-input ${fieldErrors.newPassword ? 'error' : ''}`}
                    placeholder="Enter new password (min 6 characters)"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      if (fieldErrors.newPassword) setFieldErrors({ ...fieldErrors, newPassword: '' })
                    }}
                    disabled={anyBusy}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
                {fieldErrors.newPassword && <span className="error-text">{fieldErrors.newPassword}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="auth-confirm-new-password" className="form-label">
                  Confirm New Password
                </label>
                <div className="input-wrapper">
                  <input
                    id="auth-confirm-new-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`form-input ${fieldErrors.confirmNewPassword ? 'error' : ''}`}
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => {
                      setConfirmNewPassword(e.target.value)
                      if (fieldErrors.confirmNewPassword) setFieldErrors({ ...fieldErrors, confirmNewPassword: '' })
                    }}
                    disabled={anyBusy}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
                {fieldErrors.confirmNewPassword && (
                  <span className="error-text">{fieldErrors.confirmNewPassword}</span>
                )}
              </div>

              <button type="submit" className="btn btn-primary auth-btn" disabled={anyBusy}>
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="spinning" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <span>Reset Password</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          )}

          <button
            type="button"
            className="auth-back-link"
            onClick={() => {
              clearFeedback()
              setResetRequested(false)
              setStep('landing')
            }}
          >
            <ArrowLeft size={15} />
            <span>Back to Sign In options</span>
          </button>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="auth-footer">
        {variant === 'page' ? (
          mode === 'register' || step === 'email-register' ? (
            <p>
              Already have an account?{' '}
              <Link to="/login" className="auth-link" onClick={() => handleModeChange('login')}>
                Login here
              </Link>
            </p>
          ) : (
            <p>
              Don't have an account?{' '}
              <Link to="/register" className="auth-link" onClick={() => handleModeChange('register')}>
                Register here
              </Link>
            </p>
          )
        ) : (
          <p>
            {mode === 'register' || step === 'email-register' ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  className="auth-link auth-inline-btn"
                  onClick={() => handleModeChange('login')}
                >
                  Login here
                </button>
              </>
            ) : (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  className="auth-link auth-inline-btn"
                  onClick={() => handleModeChange('register')}
                >
                  Register here
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

export default StudentAuthForm
