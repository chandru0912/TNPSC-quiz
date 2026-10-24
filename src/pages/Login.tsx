import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, ArrowRight, Eye, EyeOff } from 'lucide-react'
import './Auth.css'

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: { email?: string; password?: string } = {}

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)

    if (Object.keys(newErrors).length === 0) {
      alert('Login form validated successfully (frontend only)')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
    if (errors[name as keyof typeof errors]) {
      setErrors({
        ...errors,
        [name]: undefined
      })
    }
  }

  return (
    <div className="auth">
      <div className="auth-container">
        <motion.div 
          className="auth-card glass"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="auth-header">
            <div className="auth-icon">
              <User size={32} />
            </div>
            <h1 className="auth-title">Welcome Back</h1>
            <p className="auth-subtitle">Login to access your TNPSC Study Hub dashboard</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <input
                  type="email"
                  name="email"
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>

            <div className="form-row">
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="rememberMe"
                  className="checkbox-input"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label htmlFor="rememberMe" className="checkbox-label">Remember me</label>
              </div>
              <Link to="#" className="forgot-link" onClick={(e) => e.preventDefault()}>
                Forgot Password?
              </Link>
            </div>

            <button type="submit" className="btn btn-primary auth-btn">
              <span>Login</span>
              <ArrowRight size={18} />
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Don't have an account?{' '}
              <Link to="/register" className="auth-link">
                Register here
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default Login
