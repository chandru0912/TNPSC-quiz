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

// Scoped sections where bilingual switch is active:
// 1. Study Materials (/materials, /materials/...)
// 2. MCQ Questions (/practice, /practice/...)
// 3. Mock Test (/mock-tests, /mock-tests/...)
const SCOPED_SECTION_PREFIXES = ['/materials', '/practice', '/mock-tests']

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

  // Detect if user is currently inside one of the three designated sections
  const isScopedSection = useMemo(() => {
    const path = location.pathname.toLowerCase()
    return SCOPED_SECTION_PREFIXES.some((prefix) => path.startsWith(prefix))
  }, [location.pathname])

  // Sync to localStorage and HTML lang tag whenever language updates
  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
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
