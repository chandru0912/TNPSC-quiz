import React, { useState } from 'react'
import { MapPin, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { useStudentAuth } from '../context/StudentAuthContext'
import { apiFetch } from '../utils/api'
import './LoginLocationModal.css'

const TAMIL_NADU_DISTRICTS_38 = [
  'Ariyalur',
  'Chengalpattu',
  'Chennai',
  'Coimbatore',
  'Cuddalore',
  'Dharmapuri',
  'Dindigul',
  'Erode',
  'Kallakurichi',
  'Kancheepuram',
  'Kanniyakumari',
  'Karur',
  'Krishnagiri',
  'Madurai',
  'Mayiladuthurai',
  'Nagapattinam',
  'Namakkal',
  'Nilgiris',
  'Perambalur',
  'Pudukkottai',
  'Ramanathapuram',
  'Ranipet',
  'Salem',
  'Sivaganga',
  'Tenkasi',
  'Thanjavur',
  'Theni',
  'Thoothukudi',
  'Tiruchirappalli',
  'Tirunelveli',
  'Tirupathur',
  'Tiruppur',
  'Tiruvallur',
  'Tiruvannamalai',
  'Tiruvarur',
  'Vellore',
  'Viluppuram',
  'Virudhunagar',
]

export const LoginLocationModal: React.FC = () => {
  const {
    isAuthenticated,
    isPreviewMode,
    pendingLoginLocationEventId,
    clearPendingLoginLocation,
  } = useStudentAuth()

  const [busy, setBusy] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualDistrict, setManualDistrict] = useState('')
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'warn'
    text: string
  } | null>(null)

  if (!isAuthenticated || isPreviewMode || !pendingLoginLocationEventId) {
    return null
  }

  const recordUnavailableAndClose = async (permissionStatus: 'denied' | 'unavailable' | 'unsupported') => {
    try {
      await apiFetch('/api/student/login-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginEventId: pendingLoginLocationEventId,
          source: 'unavailable',
          permissionStatus,
        }),
      })
    } catch {
      // Never block student access if recording fails
    } finally {
      clearPendingLoginLocation()
    }
  }

  const handleRequestGpsOnce = () => {
    setStatusFeedback(null)
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatusFeedback({
        type: 'warn',
        text: 'GPS is not supported in this browser. You can select your district manually or skip.',
      })
      setShowManual(true)
      return
    }

    setBusy(true)
    // Strictly one-time getCurrentPosition (never watchPosition)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude, accuracy } = position.coords
          const res = await apiFetch('/api/student/login-location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              loginEventId: pendingLoginLocationEventId,
              source: 'gps',
              latitude,
              longitude,
              accuracyMeters: accuracy,
            }),
          })
          const json = await res.json().catch(() => ({}))
          const info = json?.data

          if (res.ok && info?.locationStatus === 'detected' && info?.districtName) {
            setStatusFeedback({
              type: 'success',
              text: `District detected: ${info.districtName}. Thank you!`,
            })
            setTimeout(() => {
              clearPendingLoginLocation()
            }, 1100)
          } else if (info?.locationStatus === 'outside_tamil_nadu') {
            setStatusFeedback({
              type: 'warn',
              text: 'Location detected outside Tamil Nadu. You can optionally select a Tamil Nadu district or continue.',
            })
            setShowManual(true)
          } else {
            setStatusFeedback({
              type: 'warn',
              text: 'GPS accuracy was too low to confirm a district. You can select your district manually or skip.',
            })
            setShowManual(true)
          }
        } catch {
          setStatusFeedback({
            type: 'warn',
            text: 'Unable to verify district right now. You can select manually or skip.',
          })
          setShowManual(true)
        } finally {
          setBusy(false)
        }
      },
      async (err) => {
        setBusy(false)
        const denied = err.code === err.PERMISSION_DENIED
        setStatusFeedback({
          type: 'warn',
          text: denied
            ? 'Location permission was denied. You can select your district manually or skip without affecting login.'
            : 'GPS location is currently unavailable. You can select your district manually or skip.',
        })
        setShowManual(true)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    )
  }

  const handleManualSubmit = async () => {
    if (!manualDistrict) return
    setBusy(true)
    setStatusFeedback(null)
    try {
      const res = await apiFetch('/api/student/login-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginEventId: pendingLoginLocationEventId,
          source: 'manual',
          manualDistrict,
        }),
      })
      if (res.ok) {
        setStatusFeedback({
          type: 'success',
          text: `Saved district: ${manualDistrict}.`,
        })
        setTimeout(() => {
          clearPendingLoginLocation()
        }, 800)
      } else {
        clearPendingLoginLocation()
      }
    } catch {
      clearPendingLoginLocation()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gps-consent-backdrop" role="presentation">
      <div
        className="gps-consent-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gps-consent-title"
      >
        <button
          type="button"
          className="gps-consent-close"
          onClick={() => void recordUnavailableAndClose('denied')}
          aria-label="Skip district detection"
          disabled={busy}
        >
          <X size={16} />
        </button>

        <div className="gps-consent-header">
          <div className="gps-consent-icon">
            <MapPin size={22} />
          </div>
          <div>
            <h2 id="gps-consent-title" className="gps-consent-title">
              One-Time District Detection
            </h2>
            <p className="gps-consent-sub">Optional · Privacy-First Login Check</p>
          </div>
        </div>

        <p className="gps-consent-desc">
          Allow a one-time browser location check to identify your Tamil Nadu district for regional TNPSC Study Hub analytics.
        </p>

        <div className="gps-privacy-note">
          <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            No continuous tracking. Your exact GPS coordinates are never permanently stored — only your Tamil Nadu district name is saved.
          </span>
        </div>

        {statusFeedback && (
          <div className={`gps-status-msg ${statusFeedback.type}`}>
            {statusFeedback.type === 'success' ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            <span>{statusFeedback.text}</span>
          </div>
        )}

        {showManual && (
          <div className="gps-manual-wrap">
            <select
              className="gps-manual-select"
              value={manualDistrict}
              onChange={(e) => setManualDistrict(e.target.value)}
              aria-label="Select Tamil Nadu district manually"
            >
              <option value="">Select your Tamil Nadu district...</option>
              {TAMIL_NADU_DISTRICTS_38.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="gps-btn gps-btn-primary"
              onClick={() => void handleManualSubmit()}
              disabled={busy || !manualDistrict}
            >
              {busy ? <Loader2 size={16} className="gps-spin" /> : <CheckCircle2 size={16} />}
              <span>Save Selected District</span>
            </button>
          </div>
        )}

        <div className="gps-actions-stack">
          {!showManual && (
            <>
              <button
                type="button"
                className="gps-btn gps-btn-primary"
                onClick={handleRequestGpsOnce}
                disabled={busy}
              >
                {busy ? <Loader2 size={16} className="gps-spin" /> : <MapPin size={16} />}
                <span>{busy ? 'Detecting District...' : 'Allow One-Time GPS Detection'}</span>
              </button>

              <button
                type="button"
                className="gps-btn gps-btn-secondary"
                onClick={() => setShowManual(true)}
                disabled={busy}
              >
                <span>Select District Manually</span>
              </button>
            </>
          )}

          <button
            type="button"
            className="gps-btn gps-btn-ghost"
            onClick={() => void recordUnavailableAndClose('denied')}
            disabled={busy}
          >
            Skip for Now
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoginLocationModal
