import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { User, UserPlus, Eye, EyeOff, ArrowRight, X } from 'lucide-react'
import './MobileAuthSlide.css'

export type AuthSlideType = 'none' | 'login' | 'register'

interface MobileAuthSlideProps {
  activeSlide: AuthSlideType
  onClose: () => void
  onSwitchToLogin: () => void
  onSwitchToRegister: () => void
}

const MobileAuthSlide = ({
  activeSlide,
  onClose,
  onSwitchToLogin,
  onSwitchToRegister,
}: MobileAuthSlideProps) => {
  // Login form state
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [loginShowPassword, setLoginShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({})

  // Register form state
  const [registerData, setRegisterData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: '',
  })
  const [regShowPassword, setRegShowPassword] = useState(false)
  const [regShowConfirmPassword, setRegShowConfirmPassword] = useState(false)
  const [registerErrors, setRegisterErrors] = useState<{
    fullName?: string
    email?: string
    mobile?: string
    password?: string
    confirmPassword?: string
  }>({})

  // Lock body scroll and listen for Escape key when popup is open
  useEffect(() => {
    if (activeSlide === 'none') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeSlide, onClose])

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const validateMobile = (mobile: string) => /^[6-9]\d{9}$/.test(mobile)

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: { email?: string; password?: string } = {}

    if (!loginData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!validateEmail(loginData.email)) {
      errors.email = 'Please enter a valid email address'
    }

    if (!loginData.password) {
      errors.password = 'Password is required'
    }

    setLoginErrors(errors)
    if (Object.keys(errors).length === 0) {
      alert('Login validated successfully (frontend demo)')
      onClose()
    }
  }

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: typeof registerErrors = {}

    if (!registerData.fullName.trim()) {
      errors.fullName = 'Full name is required'
    }

    if (!registerData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!validateEmail(registerData.email)) {
      errors.email = 'Please enter a valid email address'
    }

    if (!registerData.mobile.trim()) {
      errors.mobile = 'Mobile number is required'
    } else if (!validateMobile(registerData.mobile)) {
      errors.mobile = 'Please enter a valid 10-digit mobile number'
    }

    if (!registerData.password) {
      errors.password = 'Password is required'
    } else if (registerData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters'
    }

    if (!registerData.confirmPassword) {
      errors.confirmPassword = 'Confirm password is required'
    } else if (registerData.password !== registerData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    setRegisterErrors(errors)
    if (Object.keys(errors).length === 0) {
      alert('Registration validated successfully (frontend demo)')
      onClose()
    }
  }

  // Render via React Portal to document.body so the popup is completely freed from parent
  // stacking contexts, overflow:hidden, and backdrop-filter clipping
  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <AnimatePresence mode="wait">
      {activeSlide !== 'none' && (
        <div
          className="mobile-auth-overlay"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={activeSlide === 'login' ? 'Login Popup' : 'Register Popup'}
        >
          {activeSlide === 'login' ? (
            <motion.div
              key="auth-login-popup"
              className="mobile-auth-card glass"
              initial={{ opacity: 0, y: -20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="mobile-auth-header">
                <div className="mobile-auth-header-left">
                  <div className="mobile-auth-icon-box">
                    <User size={24} />
                  </div>
                  <div className="mobile-auth-title-group">
                    <h2 className="mobile-auth-title">Welcome Back</h2>
                    <p className="mobile-auth-subtitle">Login to access your study portal</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="mobile-auth-close-btn"
                  onClick={onClose}
                  aria-label="Close login popup"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Segmented Switcher inside Popup */}
              <div className="mobile-auth-tabs">
                <button
                  type="button"
                  className="mobile-auth-tab active"
                  onClick={onSwitchToLogin}
                >
                  <User size={15} />
                  <span>Login</span>
                </button>
                <button
                  type="button"
                  className="mobile-auth-tab"
                  onClick={onSwitchToRegister}
                >
                  <UserPlus size={15} />
                  <span>Register</span>
                </button>
              </div>

              {/* Login Form */}
              <form className="mobile-auth-form" onSubmit={handleLoginSubmit} noValidate>
                <div className="mobile-form-group">
                  <label className="mobile-form-label">Email Address</label>
                  <div className="mobile-input-wrapper">
                    <input
                      type="email"
                      className={`mobile-form-input ${loginErrors.email ? 'error' : ''}`}
                      placeholder="Enter your email"
                      value={loginData.email}
                      onChange={(e) => {
                        setLoginData({ ...loginData, email: e.target.value })
                        if (loginErrors.email) setLoginErrors({ ...loginErrors, email: undefined })
                      }}
                    />
                  </div>
                  {loginErrors.email && <span className="mobile-error-text">{loginErrors.email}</span>}
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-form-label">Password</label>
                  <div className="mobile-input-wrapper">
                    <input
                      type={loginShowPassword ? 'text' : 'password'}
                      className={`mobile-form-input ${loginErrors.password ? 'error' : ''}`}
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={(e) => {
                        setLoginData({ ...loginData, password: e.target.value })
                        if (loginErrors.password) setLoginErrors({ ...loginErrors, password: undefined })
                      }}
                    />
                    <button
                      type="button"
                      className="mobile-password-toggle"
                      onClick={() => setLoginShowPassword(!loginShowPassword)}
                      aria-label="Toggle password visibility"
                    >
                      {loginShowPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {loginErrors.password && <span className="mobile-error-text">{loginErrors.password}</span>}
                </div>

                <div className="mobile-form-row">
                  <label className="mobile-checkbox-group">
                    <input
                      type="checkbox"
                      className="mobile-checkbox-input"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span className="mobile-checkbox-label">Remember me</span>
                  </label>
                  <a href="#forgot" className="mobile-forgot-link" onClick={(e) => e.preventDefault()}>
                    Forgot password?
                  </a>
                </div>

                <button type="submit" className="mobile-auth-submit-btn">
                  <span>Login</span>
                  <ArrowRight size={16} />
                </button>
              </form>

              {/* Switch to Register */}
              <div className="mobile-auth-footer">
                <span>Don't have an account?</span>
                <button
                  type="button"
                  className="mobile-auth-switch-btn"
                  onClick={onSwitchToRegister}
                >
                  Register here
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="auth-register-popup"
              className="mobile-auth-card glass"
              initial={{ opacity: 0, y: -20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="mobile-auth-header">
                <div className="mobile-auth-header-left">
                  <div className="mobile-auth-icon-box">
                    <UserPlus size={24} />
                  </div>
                  <div className="mobile-auth-title-group">
                    <h2 className="mobile-auth-title">Create Account</h2>
                    <p className="mobile-auth-subtitle">Join TNPSC aspirants preparing today</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="mobile-auth-close-btn"
                  onClick={onClose}
                  aria-label="Close register popup"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Segmented Switcher inside Popup */}
              <div className="mobile-auth-tabs">
                <button
                  type="button"
                  className="mobile-auth-tab"
                  onClick={onSwitchToLogin}
                >
                  <User size={15} />
                  <span>Login</span>
                </button>
                <button
                  type="button"
                  className="mobile-auth-tab active"
                  onClick={onSwitchToRegister}
                >
                  <UserPlus size={15} />
                  <span>Register</span>
                </button>
              </div>

              {/* Register Form */}
              <form className="mobile-auth-form" onSubmit={handleRegisterSubmit} noValidate>
                <div className="mobile-form-group">
                  <label className="mobile-form-label">Full Name</label>
                  <div className="mobile-input-wrapper">
                    <input
                      type="text"
                      className={`mobile-form-input ${registerErrors.fullName ? 'error' : ''}`}
                      placeholder="Enter your full name"
                      value={registerData.fullName}
                      onChange={(e) => {
                        setRegisterData({ ...registerData, fullName: e.target.value })
                        if (registerErrors.fullName) setRegisterErrors({ ...registerErrors, fullName: undefined })
                      }}
                    />
                  </div>
                  {registerErrors.fullName && <span className="mobile-error-text">{registerErrors.fullName}</span>}
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-form-label">Email Address</label>
                  <div className="mobile-input-wrapper">
                    <input
                      type="email"
                      className={`mobile-form-input ${registerErrors.email ? 'error' : ''}`}
                      placeholder="Enter your email"
                      value={registerData.email}
                      onChange={(e) => {
                        setRegisterData({ ...registerData, email: e.target.value })
                        if (registerErrors.email) setRegisterErrors({ ...registerErrors, email: undefined })
                      }}
                    />
                  </div>
                  {registerErrors.email && <span className="mobile-error-text">{registerErrors.email}</span>}
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-form-label">Mobile Number</label>
                  <div className="mobile-input-wrapper">
                    <input
                      type="tel"
                      className={`mobile-form-input ${registerErrors.mobile ? 'error' : ''}`}
                      placeholder="Enter 10-digit mobile number"
                      maxLength={10}
                      value={registerData.mobile}
                      onChange={(e) => {
                        setRegisterData({ ...registerData, mobile: e.target.value })
                        if (registerErrors.mobile) setRegisterErrors({ ...registerErrors, mobile: undefined })
                      }}
                    />
                  </div>
                  {registerErrors.mobile && <span className="mobile-error-text">{registerErrors.mobile}</span>}
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-form-label">Password</label>
                  <div className="mobile-input-wrapper">
                    <input
                      type={regShowPassword ? 'text' : 'password'}
                      className={`mobile-form-input ${registerErrors.password ? 'error' : ''}`}
                      placeholder="Create password (min 6 characters)"
                      value={registerData.password}
                      onChange={(e) => {
                        setRegisterData({ ...registerData, password: e.target.value })
                        if (registerErrors.password) setRegisterErrors({ ...registerErrors, password: undefined })
                      }}
                    />
                    <button
                      type="button"
                      className="mobile-password-toggle"
                      onClick={() => setRegShowPassword(!regShowPassword)}
                      aria-label="Toggle password visibility"
                    >
                      {regShowPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {registerErrors.password && <span className="mobile-error-text">{registerErrors.password}</span>}
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-form-label">Confirm Password</label>
                  <div className="mobile-input-wrapper">
                    <input
                      type={regShowConfirmPassword ? 'text' : 'password'}
                      className={`mobile-form-input ${registerErrors.confirmPassword ? 'error' : ''}`}
                      placeholder="Confirm your password"
                      value={registerData.confirmPassword}
                      onChange={(e) => {
                        setRegisterData({ ...registerData, confirmPassword: e.target.value })
                        if (registerErrors.confirmPassword) setRegisterErrors({ ...registerErrors, confirmPassword: undefined })
                      }}
                    />
                    <button
                      type="button"
                      className="mobile-password-toggle"
                      onClick={() => setRegShowConfirmPassword(!regShowConfirmPassword)}
                      aria-label="Toggle confirm password visibility"
                    >
                      {regShowConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {registerErrors.confirmPassword && (
                    <span className="mobile-error-text">{registerErrors.confirmPassword}</span>
                  )}
                </div>

                <button type="submit" className="mobile-auth-submit-btn">
                  <span>Register Now</span>
                  <ArrowRight size={16} />
                </button>
              </form>

              {/* Switch to Login */}
              <div className="mobile-auth-footer">
                <span>Already have an account?</span>
                <button
                  type="button"
                  className="mobile-auth-switch-btn"
                  onClick={onSwitchToLogin}
                >
                  Login here
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default MobileAuthSlide
