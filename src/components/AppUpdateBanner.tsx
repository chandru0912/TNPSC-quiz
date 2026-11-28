import React, { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { checkForNewDeployment, performCleanUpdateReload } from '../utils/appVersion'

const CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export const AppUpdateBanner: React.FC = () => {
  const [updateBuildId, setUpdateBuildId] = useState<string | null>(null)
  const [dismissedBuildId, setDismissedBuildId] = useState<string | null>(null)
  const [isReloading, setIsReloading] = useState(false)

  useEffect(() => {
    if (import.meta.env?.DEV) return
    let mounted = true

    const runCheck = async () => {
      const state = await checkForNewDeployment()
      if (!mounted) return
      if (state.mismatchDetected && state.latestBuildId) {
        setUpdateBuildId(state.latestBuildId)
      }
    }

    // Initial delayed check so startup network stays fast
    const initialTimer = window.setTimeout(runCheck, 8000)
    const interval = window.setInterval(runCheck, CHECK_INTERVAL_MS)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void runCheck()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      mounted = false
      window.clearTimeout(initialTimer)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  if (!updateBuildId || updateBuildId === dismissedBuildId) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: '1rem',
        bottom: '1rem',
        zIndex: 1100,
        maxWidth: '360px',
        padding: '0.85rem 1rem',
        borderRadius: '14px',
        background: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(255, 215, 0, 0.4)',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: '#f8fafc',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fde047' }}>
          New update available
        </div>
        <div style={{ fontSize: '0.76rem', color: '#cbd5e1', lineHeight: 1.35, marginTop: '0.15rem' }}>
          A newer version of TNPSC Aspirant Orbit is ready. Update whenever convenient.
        </div>
      </div>

      <button
        type="button"
        disabled={isReloading}
        onClick={() => {
          setIsReloading(true)
          void performCleanUpdateReload(true)
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.45rem 0.8rem',
          borderRadius: '9999px',
          border: '1px solid rgba(250, 204, 21, 0.55)',
          background: 'linear-gradient(135deg, #ffd700 0%, #f59e0b 100%)',
          color: '#060913',
          fontSize: '0.76rem',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <RefreshCw size={13} />
        <span>{isReloading ? 'Updating...' : 'Update Now'}</span>
      </button>

      <button
        type="button"
        aria-label="Dismiss update notification"
        onClick={() => setDismissedBuildId(updateBuildId)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          padding: '0.2rem',
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <X size={15} />
      </button>
    </div>
  )
}
