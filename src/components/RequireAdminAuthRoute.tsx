import React, { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { apiFetch } from '../utils/api'

/**
 * Server-verified Admin Route Guard.
 * Never trusts frontend role values or localStorage flags alone —
 * verifies the bearer token against GET /api/admin/verify on the backend.
 */
const RequireAdminAuthRoute: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'authorized' | 'unauthorized'>('checking')

  useEffect(() => {
    const token = localStorage.getItem('tnpsc_admin_token')
    if (!token) {
      setStatus('unauthorized')
      return
    }

    let cancelled = false
    apiFetch('/api/admin/verify', {
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: 10000,
    })
      .then(async (res) => {
        if (!res.ok) return null
        return res.json().catch(() => null)
      })
      .then((data) => {
        if (cancelled) return
        if (data?.status === 'success' && data?.valid && data?.user) {
          localStorage.setItem('tnpsc_admin_user', JSON.stringify(data.user))
          setStatus('authorized')
        } else {
          localStorage.removeItem('tnpsc_admin_token')
          localStorage.removeItem('tnpsc_admin_user')
          setStatus('unauthorized')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('unauthorized')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'checking') {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.85rem',
          color: '#94a3b8',
        }}
        role="status"
        aria-live="polite"
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '3px solid rgba(255, 215, 0, 0.18)',
            borderTopColor: '#ffd700',
            animation: 'spin 0.75s linear infinite',
          }}
        />
        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Verifying administrator access...</span>
      </div>
    )
  }

  if (status === 'unauthorized') {
    return <Navigate to="/owner-login" replace />
  }

  return <Outlet />
}

export default RequireAdminAuthRoute
