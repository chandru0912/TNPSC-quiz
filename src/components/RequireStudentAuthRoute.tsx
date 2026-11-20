import React, { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useStudentAuth } from '../context/StudentAuthContext'
import { buildAuthRedirectUrl, savePostLoginRedirect } from '../utils/authRedirect'

interface RequireStudentAuthRouteProps {
  children?: React.ReactNode
}

export const RequireStudentAuthRoute: React.FC<RequireStudentAuthRouteProps> = ({
  children,
}) => {
  const { isAuthenticated, isLoading } = useStudentAuth()
  const location = useLocation()
  const redirectTo = `${location.pathname}${location.search}${location.hash}`

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      savePostLoginRedirect(redirectTo)
    }
  }, [isLoading, isAuthenticated, redirectTo])

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '55vh',
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
        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
          Verifying student session...
        </span>
      </div>
    )
  }

  if (!isAuthenticated) {
    savePostLoginRedirect(redirectTo)
    return (
      <Navigate
        to={buildAuthRedirectUrl('login', redirectTo)}
        state={{ from: redirectTo }}
        replace
      />
    )
  }

  return children ? <>{children}</> : <Outlet />
}

export default RequireStudentAuthRoute
