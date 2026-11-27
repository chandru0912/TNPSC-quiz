import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

export const COOKIE_CONSENT_STORAGE_KEY = 'tnpsc_cookie_consent'
export const COOKIE_CONSENT_VERSION = 1

export type CookieConsentDecision = 'accepted_all' | 'rejected_non_essential' | 'custom' | null

export interface CookieConsentState {
  version: number
  essential: true
  functional: boolean
  analytics: boolean
  thirdParty: boolean
  decision: CookieConsentDecision
  updatedAt: string | null
}

export const DEFAULT_COOKIE_CONSENT: CookieConsentState = {
  version: COOKIE_CONSENT_VERSION,
  essential: true,
  functional: false,
  analytics: false,
  thirdParty: false,
  decision: null,
  updatedAt: null,
}

export function readStoredCookieConsent(): CookieConsentState {
  if (typeof window === 'undefined') return DEFAULT_COOKIE_CONSENT
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (!raw) return DEFAULT_COOKIE_CONSENT
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_COOKIE_CONSENT
    const decision: CookieConsentDecision =
      parsed.decision === 'accepted_all' ||
      parsed.decision === 'rejected_non_essential' ||
      parsed.decision === 'custom'
        ? parsed.decision
        : null
    return {
      version: COOKIE_CONSENT_VERSION,
      essential: true,
      functional: Boolean(parsed.functional),
      analytics: Boolean(parsed.analytics),
      thirdParty: Boolean(parsed.thirdParty),
      decision,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    }
  } catch {
    return DEFAULT_COOKIE_CONSENT
  }
}

export function hasAnalyticsConsent(): boolean {
  const consent = readStoredCookieConsent()
  return consent.decision !== null && consent.analytics === true
}

export function hasFunctionalConsent(): boolean {
  const consent = readStoredCookieConsent()
  return consent.decision !== null && consent.functional === true
}

export function clearOptionalAnalyticsStorage(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem('tnpsc_visitor_id')
    window.sessionStorage.removeItem('tnpsc_session_id')
  } catch {
    // ignore storage errors
  }
}

interface CookieConsentContextValue {
  consent: CookieConsentState
  isPreferencesOpen: boolean
  openPreferences: () => void
  closePreferences: () => void
  acceptAll: () => void
  rejectNonEssential: () => void
  savePreferences: (prefs: { functional: boolean; analytics: boolean; thirdParty: boolean }) => void
}

const CookieConsentContext = createContext<CookieConsentContextValue | undefined>(undefined)

export const CookieConsentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [consent, setConsent] = useState<CookieConsentState>(() => readStoredCookieConsent())
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)

  const persistConsent = useCallback((next: CookieConsentState) => {
    setConsent(next)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore storage quota errors
      }
      if (!next.analytics) {
        clearOptionalAnalyticsStorage()
      }
      window.dispatchEvent(new CustomEvent('tnpsc:cookie-consent-updated', { detail: next }))
    }
  }, [])

  const acceptAll = useCallback(() => {
    persistConsent({
      version: COOKIE_CONSENT_VERSION,
      essential: true,
      functional: true,
      analytics: true,
      thirdParty: true,
      decision: 'accepted_all',
      updatedAt: new Date().toISOString(),
    })
    setIsPreferencesOpen(false)
  }, [persistConsent])

  const rejectNonEssential = useCallback(() => {
    persistConsent({
      version: COOKIE_CONSENT_VERSION,
      essential: true,
      functional: false,
      analytics: false,
      thirdParty: false,
      decision: 'rejected_non_essential',
      updatedAt: new Date().toISOString(),
    })
    setIsPreferencesOpen(false)
  }, [persistConsent])

  const savePreferences = useCallback(
    (prefs: { functional: boolean; analytics: boolean; thirdParty: boolean }) => {
      const allTrue = prefs.functional && prefs.analytics && prefs.thirdParty
      const allFalse = !prefs.functional && !prefs.analytics && !prefs.thirdParty
      persistConsent({
        version: COOKIE_CONSENT_VERSION,
        essential: true,
        functional: prefs.functional,
        analytics: prefs.analytics,
        thirdParty: prefs.thirdParty,
        decision: allTrue ? 'accepted_all' : allFalse ? 'rejected_non_essential' : 'custom',
        updatedAt: new Date().toISOString(),
      })
      setIsPreferencesOpen(false)
    },
    [persistConsent]
  )

  // Keep multiple browser tabs synchronized when consent changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key === COOKIE_CONSENT_STORAGE_KEY) {
        setConsent(readStoredCookieConsent())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        isPreferencesOpen,
        openPreferences: () => setIsPreferencesOpen(true),
        closePreferences: () => setIsPreferencesOpen(false),
        acceptAll,
        rejectNonEssential,
        savePreferences,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  )
}

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext)
  if (!ctx) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider')
  }
  return ctx
}
