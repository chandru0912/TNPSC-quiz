import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../utils/api'
import { translateCommonStudyPattern } from '../data/studyMaterialsTamilDict'

export type StudyMaterialLanguage = 'en' | 'ta'

interface TranslationProgress {
  completed: number
  total: number
}

interface StudyMaterialsLanguageContextValue {
  language: StudyMaterialLanguage
  setLanguage: (lang: StudyMaterialLanguage) => void
  isTranslating: boolean
  progress: TranslationProgress
  error: string | null
  retryTranslation: () => void
  retryNonce: number
  translateTextsBatch: (
    texts: string[],
    type?: 'ui' | 'heading' | 'syllabus' | 'lesson' | 'note_markdown'
  ) => Promise<Record<string, string>>
  getCachedTranslation: (text: string) => string | null
}

const SESSION_LANG_KEY = 'tnpsc_study_materials_lang'
const LOCAL_CACHE_KEY = 'tnpsc_sm_tr_cache_v1'
const MAX_LOCAL_CACHE_ENTRIES = 3000
const CLIENT_BATCH_SIZE = 35
const CLIENT_CONCURRENCY = 2

const StudyMaterialsLanguageContext = createContext<StudyMaterialsLanguageContextValue | null>(null)

function loadLocalCache(): Map<string, string> {
  const map = new Map<string, string>()
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY)
    if (!raw) return map
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && v.trim()) {
          map.set(k, v)
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return map
}

function saveLocalCache(cache: Map<string, string>): void {
  try {
    // Trim oldest entries if above max limit
    while (cache.size > MAX_LOCAL_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value
      if (oldestKey === undefined) break
      cache.delete(oldestKey)
    }
    const obj: Record<string, string> = {}
    for (const [k, v] of cache.entries()) {
      obj[k] = v
    }
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(obj))
  } catch {
    // Ignore quota exceeded errors
  }
}

function getInitialLanguage(): StudyMaterialLanguage {
  try {
    const saved = sessionStorage.getItem(SESSION_LANG_KEY)
    if (saved === 'ta' || saved === 'en') return saved
  } catch {
    // Ignore
  }
  return 'en'
}

export const StudyMaterialsLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<StudyMaterialLanguage>(getInitialLanguage)
  const [isTranslating, setIsTranslating] = useState(false)
  const [progress, setProgress] = useState<TranslationProgress>({ completed: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [retryNonce, setRetryNonce] = useState(0)

  const cacheRef = useRef<Map<string, string>>(loadLocalCache())
  const activeJobsRef = useRef(0)
  const saveTimerRef = useRef<number | null>(null)

  const scheduleCachePersist = useCallback(() => {
    if (saveTimerRef.current !== null) return
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      saveLocalCache(cacheRef.current)
    }, 600)
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  const setLanguage = useCallback((nextLang: StudyMaterialLanguage) => {
    // Preserve exact scroll position across language switch
    const scrollY = window.scrollY
    const scrollX = window.scrollX
    setError(null)
    setLanguageState(nextLang)
    try {
      sessionStorage.setItem(SESSION_LANG_KEY, nextLang)
    } catch {
      // Ignore
    }
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, left: scrollX, behavior: 'instant' as ScrollBehavior })
    })
  }, [])

  const retryTranslation = useCallback(() => {
    setError(null)
    setRetryNonce((n) => n + 1)
  }, [])

  const getCachedTranslation = useCallback((text: string): string | null => {
    const trimmed = text.trim()
    if (!trimmed) return null
    const instant = translateCommonStudyPattern(trimmed)
    if (instant) return instant
    return cacheRef.current.get(trimmed) ?? null
  }, [])

  const translateTextsBatch = useCallback(
    async (
      rawTexts: string[],
      type: 'ui' | 'heading' | 'syllabus' | 'lesson' | 'note_markdown' = 'syllabus'
    ): Promise<Record<string, string>> => {
      const results: Record<string, string> = {}
      const missingSet = new Set<string>()

      for (const raw of rawTexts) {
        const trimmed = raw.trim()
        if (!trimmed) continue
        const cached = getCachedTranslation(trimmed)
        if (cached) {
          results[trimmed] = cached
        } else {
          missingSet.add(trimmed)
        }
      }

      const missing = Array.from(missingSet)
      if (missing.length === 0) {
        return results
      }

      activeJobsRef.current += 1
      setIsTranslating(true)
      setError(null)
      setProgress((prev) => ({
        completed: prev.completed,
        total: prev.total + missing.length,
      }))

      // Chunk into controlled client batches
      const batches: string[][] = []
      for (let i = 0; i < missing.length; i += CLIENT_BATCH_SIZE) {
        batches.push(missing.slice(i, i + CLIENT_BATCH_SIZE))
      }

      let failedCount = 0

      try {
        for (let i = 0; i < batches.length; i += CLIENT_CONCURRENCY) {
          const wave = batches.slice(i, i + CLIENT_CONCURRENCY)
          const waveResponses = await Promise.all(
            wave.map(async (batch) => {
              const items = batch.map((text, idx) => ({
                key: String(idx),
                text,
                type: text.length > 400 ? 'note_markdown' : type,
              }))

              try {
                const res = await apiFetch('/api/study-materials/translate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    items,
                    targetLang: 'ta',
                    sourceLang: 'en',
                  }),
                })
                if (!res.ok) {
                  throw new Error(`HTTP ${res.status}`)
                }
                const data = await res.json()
                return { batch, translations: (data?.translations || {}) as Record<string, string>, ok: true }
              } catch (err) {
                console.warn('[StudyMaterialsTranslator] Batch request failed:', err)
                return { batch, translations: {} as Record<string, string>, ok: false }
              }
            })
          )

          for (const { batch, translations, ok } of waveResponses) {
            let batchTranslated = 0
            for (let idx = 0; idx < batch.length; idx++) {
              const src = batch[idx]
              const tr = translations[String(idx)]
              if (tr && tr.trim()) {
                results[src] = tr.trim()
                cacheRef.current.set(src, tr.trim())
                batchTranslated++
              } else if (!ok) {
                failedCount++
              }
            }
            if (batchTranslated > 0) {
              scheduleCachePersist()
            }
            setProgress((prev) => ({
              completed: Math.min(prev.total, prev.completed + batch.length),
              total: prev.total,
            }))
          }
        }

        if (failedCount > 0) {
          setError('Some content could not be translated. Click Retry to finish.')
        }
      } finally {
        activeJobsRef.current = Math.max(0, activeJobsRef.current - 1)
        if (activeJobsRef.current === 0) {
          setIsTranslating(false)
          setProgress({ completed: 0, total: 0 })
        }
      }

      return results
    },
    [getCachedTranslation, scheduleCachePersist]
  )

  const value = useMemo<StudyMaterialsLanguageContextValue>(
    () => ({
      language,
      setLanguage,
      isTranslating,
      progress,
      error,
      retryTranslation,
      retryNonce,
      translateTextsBatch,
      getCachedTranslation,
    }),
    [
      language,
      setLanguage,
      isTranslating,
      progress,
      error,
      retryTranslation,
      retryNonce,
      translateTextsBatch,
      getCachedTranslation,
    ]
  )

  return (
    <StudyMaterialsLanguageContext.Provider value={value}>
      {children}
    </StudyMaterialsLanguageContext.Provider>
  )
}

export function useStudyMaterialsLanguage(): StudyMaterialsLanguageContextValue {
  const ctx = useContext(StudyMaterialsLanguageContext)
  if (!ctx) {
    // Safe fallback if a Study Materials component is ever rendered outside the provider
    return {
      language: 'en',
      setLanguage: () => {},
      isTranslating: false,
      progress: { completed: 0, total: 0 },
      error: null,
      retryTranslation: () => {},
      retryNonce: 0,
      translateTextsBatch: async () => ({}),
      getCachedTranslation: () => null,
    }
  }
  return ctx
}
