import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Cookie, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import { useCookieConsent } from '../context/CookieConsentContext'
import './CookieConsentManager.css'

export const CookieConsentManager: React.FC = () => {
  const location = useLocation()
  const {
    consent,
    isPreferencesOpen,
    openPreferences,
    closePreferences,
    acceptAll,
    rejectNonEssential,
    savePreferences,
  } = useCookieConsent()

  const [draftFunctional, setDraftFunctional] = useState(consent.functional)
  const [draftAnalytics, setDraftAnalytics] = useState(consent.analytics)
  const [draftThirdParty, setDraftThirdParty] = useState(consent.thirdParty)

  useEffect(() => {
    if (isPreferencesOpen) {
      setDraftFunctional(consent.functional)
      setDraftAnalytics(consent.analytics)
      setDraftThirdParty(consent.thirdParty)
    }
  }, [isPreferencesOpen, consent.functional, consent.analytics, consent.thirdParty])

  // Strictly display ONLY on the Privacy Policy route
  const normalizedPath = location.pathname.toLowerCase().replace(/\/+$/, '')
  const isPrivacyPolicyRoute =
    normalizedPath === '/dashboard/privacy-policy' || normalizedPath === '/privacy-policy'

  if (!isPrivacyPolicyRoute) {
    return null
  }

  const consentStatusLabel =
    consent.decision === 'accepted_all'
      ? 'All cookie categories accepted'
      : consent.decision === 'rejected_non_essential'
        ? 'Strictly Necessary cookies only'
        : consent.decision === 'custom'
          ? 'Custom cookie preferences saved'
          : null

  return (
    <>
      <section
        id="cookie-preferences"
        className="cookie-inline-section"
        role="region"
        aria-label="Cookie preferences"
      >
        {consent.decision === null ? (
          <div className="cookie-banner-card cookie-banner-card--inline">
            <div className="cookie-banner-copy">
              <div className="cookie-banner-title">
                <Cookie size={18} style={{ color: '#ffd700' }} />
                <span>Your Cookie Preferences on TNPSC Aspirant Orbit</span>
              </div>
              <p className="cookie-banner-desc">
                We use strictly necessary cookies to keep your student login session secure, and optional cookies for study preferences and first-party platform analytics. Optional analytics never run unless you consent.
              </p>
            </div>

            <div className="cookie-banner-actions">
              <button type="button" className="cookie-btn cookie-btn-customize" onClick={openPreferences}>
                <SlidersHorizontal size={14} />
                <span>Customize Preferences</span>
              </button>
              <button type="button" className="cookie-btn cookie-btn-reject" onClick={rejectNonEssential}>
                Reject Non-Essential Cookies
              </button>
              <button type="button" className="cookie-btn cookie-btn-accept" onClick={acceptAll}>
                Accept All Cookies
              </button>
            </div>
          </div>
        ) : (
          <div className="cookie-banner-card cookie-banner-card--inline cookie-banner-card--saved">
            <div className="cookie-banner-copy">
              <div className="cookie-banner-title">
                <CheckCircle2 size={17} style={{ color: '#34d399' }} />
                <span>Cookie Preferences</span>
              </div>
              <p className="cookie-banner-desc">
                Current choice: <strong style={{ color: '#f8fafc' }}>{consentStatusLabel}</strong>
                {consent.updatedAt ? ` • Saved ${new Date(consent.updatedAt).toLocaleString()}` : ''}
              </p>
            </div>

            <div className="cookie-banner-actions">
              <button type="button" className="cookie-btn cookie-btn-customize" onClick={openPreferences}>
                <SlidersHorizontal size={14} />
                <span>Manage Cookie Preferences</span>
              </button>
            </div>
          </div>
        )}
      </section>

      <AnimatePresence>
        {isPreferencesOpen && (
          <motion.div
            className="cookie-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePreferences}
          >
            <motion.div
              className="cookie-modal-box"
              role="dialog"
              aria-modal="true"
              aria-label="Cookie Preferences"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.16 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="cookie-modal-head">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={19} style={{ color: '#ffd700' }} />
                  <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>Cookie Preferences</strong>
                </div>
                <button
                  type="button"
                  className="cookie-btn cookie-btn-reject"
                  style={{ height: '32px', padding: '0 0.5rem' }}
                  onClick={closePreferences}
                  aria-label="Close Cookie Preferences"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="cookie-modal-body">
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  Choose which optional cookies and browser storage categories you allow. Strictly necessary cookies are required for secure sign-in and cannot be disabled here. You can update or withdraw your consent anytime from the Privacy Center.
                </p>

                {/* 1. Strictly Necessary */}
                <div className="cookie-category-card">
                  <div className="cookie-category-head">
                    <span className="cookie-category-title">Strictly Necessary Cookies</span>
                    <span className="cookie-always-badge">Always Active</span>
                  </div>
                  <p className="cookie-category-desc">
                    Required for verified student authentication, single-device session security, post-login redirects, and saving your cookie consent choice.
                  </p>
                  <span className="cookie-category-meta">
                    Includes HttpOnly cookies (<code>tnpsc_student_sid</code>, <code>tnpsc_student_token</code> — SameSite=Lax, Secure in production, up to 30 days) and core authentication storage.
                  </span>
                </div>

                {/* 2. Functional */}
                <div className="cookie-category-card">
                  <div className="cookie-category-head">
                    <span className="cookie-category-title">Functional Cookies</span>
                    <label className="cookie-switch" aria-label="Toggle Functional Cookies">
                      <input
                        type="checkbox"
                        checked={draftFunctional}
                        onChange={(e) => setDraftFunctional(e.target.checked)}
                      />
                      <span className="cookie-switch-slider" />
                    </label>
                  </div>
                  <p className="cookie-category-desc">
                    Remembers helpful study session conveniences such as multi-tab study-timer coordination, syllabus cache, and in-session bilingual MCQ translations.
                  </p>
                  <span className="cookie-category-meta">
                    Storage: browser localStorage &amp; sessionStorage (first-party only; no cross-site tracking).
                  </span>
                </div>

                {/* 3. Analytics */}
                <div className="cookie-category-card">
                  <div className="cookie-category-head">
                    <span className="cookie-category-title">Analytics Cookies</span>
                    <label className="cookie-switch" aria-label="Toggle Analytics Cookies">
                      <input
                        type="checkbox"
                        checked={draftAnalytics}
                        onChange={(e) => setDraftAnalytics(e.target.checked)}
                      />
                      <span className="cookie-switch-slider" />
                    </label>
                  </div>
                  <p className="cookie-category-desc">
                    Allows TNPSC Aspirant Orbit first-party page-view and session-activity analytics so we can improve study modules and platform performance. Disabled until you opt in; no third-party ad trackers are used.
                  </p>
                  <span className="cookie-category-meta">
                    Storage: <code>tnpsc_visitor_id</code> (localStorage) and <code>tnpsc_session_id</code> (sessionStorage), cleared automatically if rejected or withdrawn.
                  </span>
                </div>

                {/* 4. Third-Party */}
                <div className="cookie-category-card">
                  <div className="cookie-category-head">
                    <span className="cookie-category-title">Third-Party Cookies</span>
                    <label className="cookie-switch" aria-label="Toggle Third-Party Cookies">
                      <input
                        type="checkbox"
                        checked={draftThirdParty}
                        onChange={(e) => setDraftThirdParty(e.target.checked)}
                      />
                      <span className="cookie-switch-slider" />
                    </label>
                  </div>
                  <p className="cookie-category-desc">
                    TNPSC Aspirant Orbit loads external scripts only on demand when you actively use Google Sign-In (<code>accounts.google.com</code>) or Razorpay Checkout (<code>checkout.razorpay.com</code>) for subscriptions. We do not use advertising or marketing cookies.
                  </p>
                </div>

                {consent.updatedAt && (
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    Last saved: {new Date(consent.updatedAt).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="cookie-modal-foot">
                <button type="button" className="cookie-btn cookie-btn-reject" onClick={rejectNonEssential}>
                  Reject Non-Essential
                </button>
                <button
                  type="button"
                  className="cookie-btn cookie-btn-customize"
                  onClick={() =>
                    savePreferences({
                      functional: draftFunctional,
                      analytics: draftAnalytics,
                      thirdParty: draftThirdParty,
                    })
                  }
                >
                  Save Preferences
                </button>
                <button type="button" className="cookie-btn cookie-btn-accept" onClick={acceptAll}>
                  Accept All
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default CookieConsentManager
