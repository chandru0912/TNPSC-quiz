import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, Eye, EyeOff } from 'lucide-react'
import OrbitBrandLogo from '../components/OrbitBrandLogo'
import { apiFetch, parseApiResponse, classifyApiError, classifyFetchFailure } from '../utils/api'
import './Admin.css'

const OwnerLogin: React.FC = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(true)

  // If already holding a valid server-verified admin session, go straight to Admin Dashboard
  useEffect(() => {
    const existingToken = localStorage.getItem('tnpsc_admin_token')
    if (!existingToken) {
      setCheckingExisting(false)
      return
    }

    let cancelled = false
    apiFetch('/api/admin/verify', {
      headers: { Authorization: `Bearer ${existingToken}` },
      timeoutMs: 10000,
    })
      .then(async (res) => {
        if (!res.ok) {
          localStorage.removeItem('tnpsc_admin_token')
          localStorage.removeItem('tnpsc_admin_user')
          return null
        }
        return res.json().catch(() => null)
      })
      .then((data) => {
        if (cancelled) return
        if (data?.status === 'success' && data?.valid && data?.user) {
          localStorage.setItem('tnpsc_admin_user', JSON.stringify(data.user))
          navigate('/admin', { replace: true })
          return
        }
        setCheckingExisting(false)
      })
      .catch(() => {
        if (!cancelled) setCheckingExisting(false)
      })

    return () => {
      cancelled = true
    }
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanUsername = username.trim()
    const cleanPassword = password.trim()
    if (!cleanUsername || !cleanPassword) {
      setError('Please enter your owner username and password.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiFetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
        timeoutMs: 15000,
      })

      const parsed = await parseApiResponse(res)

      if (res.ok && parsed.data?.status === 'success' && parsed.data?.token) {
        const issuedToken = String(parsed.data.token)
        // Server-side verification check before trusting session
        const verifyRes = await apiFetch('/api/admin/verify', {
          headers: { Authorization: `Bearer ${issuedToken}` },
          timeoutMs: 10000,
        })
        const verifyParsed = await parseApiResponse(verifyRes)
        const verifyJson = verifyParsed.data
        if (!verifyRes.ok || !verifyJson?.valid || !verifyJson?.user) {
          setError(
            (typeof verifyJson?.message === 'string' && verifyJson.message.trim()) ||
              'Admin role verification failed on server. Access denied.'
          )
          return
        }

        localStorage.setItem('tnpsc_admin_token', issuedToken)
        localStorage.setItem('tnpsc_admin_user', JSON.stringify(verifyJson.user))
        navigate('/admin', { replace: true })
        return
      }

      if (res.status === 401 || res.status === 403) {
        setError(parsed.data?.message || 'Invalid owner credentials or unauthorized account.')
      } else if (res.status === 429) {
        setError('Too many login attempts. Please wait a few minutes and try again.')
      } else {
        const classified = classifyApiError(res, parsed.data, parsed.rawText, '/api/admin/login')
        setError(classified)
      }
    } catch (err) {
      const failure = await classifyFetchFailure(err)
      setError(failure || 'Unable to reach authentication server.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (checkingExisting) {
    return (
      <div className="admin-page">
        <div className="admin-auth-wrapper">
          <div className="admin-auth-card glass" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                margin: '0 auto 1rem',
                borderRadius: '50%',
                border: '3px solid rgba(255, 215, 0, 0.2)',
                borderTopColor: '#ffd700',
                animation: 'spin 0.75s linear infinite',
              }}
            />
            <p style={{ color: '#cbd5e1', fontSize: '0.92rem' }}>Verifying owner session...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-auth-wrapper">
        <motion.div
          className="admin-auth-card glass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="admin-auth-header">
            <div className="admin-auth-icon">
              <OrbitBrandLogo size={36} />
            </div>
            <h1 className="admin-auth-title">TNPSC Aspirant Orbit Admin</h1>
            <p className="admin-auth-subtitle">
              Authorized owner access only &bull; TNPSC Aspirant Orbit Control Center
            </p>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                padding: '0.75rem 0.9rem',
                marginBottom: '1.25rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="admin-auth-form" autoComplete="on">
            <div className="admin-auth-input-group">
              <label htmlFor="owner-username" className="admin-auth-label">
                Admin Username
              </label>
              <input
                id="owner-username"
                type="text"
                className="admin-auth-input"
                placeholder="Enter authorized admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="admin-auth-input-group">
              <label htmlFor="owner-password" className="admin-auth-label">
                Admin Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="owner-password"
                  type={showPassword ? 'text' : 'password'}
                  className="admin-auth-input"
                  style={{ width: '100%', paddingRight: '2.6rem' }}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.2rem',
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button type="submit" className="admin-auth-submit" disabled={isSubmitting}>
              <Lock size={17} />
              <span>{isSubmitting ? 'Verifying Credentials...' : 'Sign In to Admin Dashboard'}</span>
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  )
}

export default OwnerLogin
