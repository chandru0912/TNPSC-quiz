import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

export type Language = 'en' | 'ta'

export interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  toggleLanguage: () => void
  isTamil: boolean
  isScopedSection: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const STORAGE_KEY = 'tnpsc_language_pref'

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation()

  // Initialize from persistent storage, defaulting to English
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'ta' || saved === 'en') {
        return saved
      }
    } catch {}
    return 'en'
  })

  // Global language selector is active across the entire Student Dashboard
  const isScopedSection = useMemo(() => {
    const path = location.pathname.toLowerCase()
    return !path.startsWith('/admin')
  }, [location.pathname])

  // Sync preferred language from student profile on mount if logged in and no explicit local override
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (location.pathname.toLowerCase().startsWith('/admin')) return
    const token = localStorage.getItem('student_token')
    if (!token) return
    const hasLocal = localStorage.getItem(STORAGE_KEY)
    if (hasLocal === 'en' || hasLocal === 'ta') return

    fetch('/api/student/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const pref = data?.student?.preferredLanguage
        if (pref === 'en' || pref === 'ta') {
          setLanguageState(pref)
          try {
            localStorage.setItem(STORAGE_KEY, pref)
          } catch {}
        }
      })
      .catch(() => {})
  }, [])

  // Sync to localStorage, HTML lang tag, and authenticated student profile whenever language updates
  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
    }
    if (typeof window !== 'undefined' && !location.pathname.toLowerCase().startsWith('/admin')) {
      const token = localStorage.getItem('student_token')
      if (token) {
        fetch('/api/student/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ preferredLanguage: lang }),
        }).catch(() => {})
      }
    }
  }

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ta' : 'en')
  }

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language])

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        isTamil: language === 'ta',
        isScopedSection,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
