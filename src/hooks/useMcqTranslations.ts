import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../utils/api'

export interface McqTranslation {
  question: string
  options: string[]
  explanation: string
}

interface TranslatableQuestion {
  id: number | string
}

export type TranslationProgressStatus =
  | 'idle'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'partial'
  | 'failed'

// First batch around the currently visible question is kept small (6) for fast ~1-2s rendering;
// subsequent background batches use 12 for higher throughput.
const PRIORITY_CHUNK_SIZE = 6
const CHUNK_SIZE = 12
const REQUEST_TIMEOUT_MS = 45_000
const PRETRANSLATE_POLL_INTERVAL_MS = 4_500
const MAX_PRETRANSLATE_POLLS = 6
const LOCAL_CACHE_KEY = 'tnpsc_mcq_ta_cache_v2'
const MAX_LOCAL_CACHE_ENTRIES = 2000

// Process-wide in-memory cache partitioned by endpoint so MCQ and Previous Paper IDs never collide
const memoryTranslationCacheByEndpoint: Record<string, Record<number, McqTranslation>> = {}

function getEndpointCacheKey(endpoint: string): string {
  return endpoint.includes('previous-papers') ? `${LOCAL_CACHE_KEY}_pyp` : LOCAL_CACHE_KEY
}

function getEndpointMemoryCache(endpoint: string): Record<number, McqTranslation> {
  if (!memoryTranslationCacheByEndpoint[endpoint]) {
    memoryTranslationCacheByEndpoint[endpoint] = {}
  }
  return memoryTranslationCacheByEndpoint[endpoint]
}

function readBrowserTranslationCache(endpoint: string): Record<number, McqTranslation> {
  const mem = getEndpointMemoryCache(endpoint)
  if (typeof window === 'undefined') return { ...mem }
  const storageKey = getEndpointCacheKey(endpoint)
  try {
    const raw = localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        Object.assign(mem, parsed)
      }
    }
  } catch {
    // Ignore storage parse/access errors
  }
  return { ...mem }
}

function writeBrowserTranslationCache(endpoint: string, entries: Record<number, McqTranslation>): void {
  const mem = getEndpointMemoryCache(endpoint)
  Object.assign(mem, entries)
  if (typeof window === 'undefined') return
  const storageKey = getEndpointCacheKey(endpoint)
  try {
    const keys = Object.keys(mem)
    let toStore: Record<number, McqTranslation> = mem
    if (keys.length > MAX_LOCAL_CACHE_ENTRIES) {
      toStore = {}
      for (const k of keys.slice(keys.length - MAX_LOCAL_CACHE_ENTRIES)) {
        const numKey = Number(k)
        toStore[numKey] = mem[numKey]
      }
    }
    const serialized = JSON.stringify(toStore)
    try {
      localStorage.setItem(storageKey, serialized)
    } catch {
      sessionStorage.setItem(storageKey, serialized)
    }
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * High-performance Tamil translation engine hook:
 * 1. Instant in-memory & localStorage hydration (< 5ms language switching).
 * 2. Smart Pre-Translation on session start — even while viewing in English,
 *    runs 1 fast bulk cache lookup (cacheOnly + pretranslate) and pulls newly
 *    ready translations in the background so switching to Tamil is instant.
 * 3. Active-question priority batching when in Tamil mode so the currently visible
 *    question translates first while remaining questions stream in parallel.
 * 4. Granular Retry Failed that retries ONLY failed question IDs without clearing
 *    already translated items or resetting exam state.
 */
export function useMcqTranslations(
  questions: TranslatableQuestion[],
  language: 'en' | 'ta',
  currentIndex: number = 0,
  endpoint: string = '/api/questions/translate'
): {
  translations: Record<number, McqTranslation>
  failedIds: number[]
  isTranslating: boolean
  isActiveQuestionTranslating: boolean
  translatedCount: number
  pendingCount: number
  translationStatus: TranslationProgressStatus
  retry: () => void
} {
  const [translations, setTranslations] = useState<Record<number, McqTranslation>>({})
  const [failedIds, setFailedIds] = useState<number[]>([])
  const [isTranslating, setIsTranslating] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  const completedRef = useRef<Set<number>>(new Set())
  const failedRef = useRef<Set<number>>(new Set())
  const cacheCheckedRef = useRef<boolean>(false)
  const retryOnlyIdsRef = useRef<number[] | null>(null)
  const isRetryingRef = useRef<boolean>(false)
  const questionsRef = useRef(questions)
  const currentIndexRef = useRef(currentIndex)
  const lessonSignatureRef = useRef<string>('')

  useEffect(() => {
    questionsRef.current = questions
    currentIndexRef.current = currentIndex
  })

  const retry = useCallback(() => {
    if (isRetryingRef.current) return
    const targetFailed = Array.from(failedRef.current).filter((id) => !completedRef.current.has(id))
    retryOnlyIdsRef.current = targetFailed.length > 0 ? targetFailed : null
    failedRef.current = new Set()
    setFailedIds([])
    setRetryNonce((value) => value + 1)
  }, [])

  useEffect(() => {
    const numericIds = questions
      .map((q) => Number(q.id))
      .filter((id) => Number.isInteger(id) && id > 0)
    const signature = numericIds.join(',')

    if (lessonSignatureRef.current !== signature) {
      lessonSignatureRef.current = signature
      completedRef.current = new Set()
      failedRef.current = new Set()
      cacheCheckedRef.current = false
      retryOnlyIdsRef.current = null
      setFailedIds([])

      // Hydrate immediately from in-memory + browser persistent cache (< 5ms)
      const browserCache = readBrowserTranslationCache(endpoint)
      const hydrated: Record<number, McqTranslation> = {}
      for (const id of numericIds) {
        if (browserCache[id]) {
          hydrated[id] = browserCache[id]
          completedRef.current.add(id)
        }
      }
      setTranslations(hydrated)
    }

    if (numericIds.length === 0) {
      setIsTranslating(false)
      return
    }

    // If every question in this session is already cached locally, zero network calls needed!
    if (numericIds.every((id) => completedRef.current.has(id))) {
      setIsTranslating(false)
      return
    }

    let cancelled = false
    let pollTimer: number | null = null

    const applyIncoming = (items: any[]): Record<number, McqTranslation> => {
      const incoming: Record<number, McqTranslation> = {}
      for (const item of items) {
        const id = Number(item?.questionId)
        if (!Number.isInteger(id) || !Array.isArray(item.options) || item.options.length !== 4) continue
        incoming[id] = {
          question: String(item.question || ''),
          options: item.options.map((option: unknown) => String(option ?? '')),
          explanation: String(item.explanation || ''),
        }
        completedRef.current.add(id)
        failedRef.current.delete(id)
      }
      if (Object.keys(incoming).length > 0) {
        writeBrowserTranslationCache(endpoint, incoming)
        setTranslations((prev) => ({ ...prev, ...incoming }))
        setFailedIds(Array.from(failedRef.current))
      }
      return incoming
    }

    // ── Smart Pre-Translation while student is reading in English ─────────────
    if (language === 'en') {
      setIsTranslating(false)

      const runBackgroundPreTranslation = async () => {
        const uncachedIds = numericIds.filter((id) => !completedRef.current.has(id))
        if (uncachedIds.length === 0) return

        try {
          cacheCheckedRef.current = true
          const res = await apiFetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionIds: uncachedIds,
              targetLanguage: 'ta',
              cacheOnly: true,
              pretranslate: true,
            }),
            timeoutMs: 15_000,
          })
          const data = await res.json().catch(() => null)
          if (cancelled) return
          if (res.ok && data?.status === 'success' && Array.isArray(data.data)) {
            applyIncoming(data.data)
          }

          // Gently pull newly pre-translated items into local cache while user stays in English
          let polls = 0
          const schedulePoll = () => {
            if (cancelled || polls >= MAX_PRETRANSLATE_POLLS) return
            const stillMissing = numericIds.filter((id) => !completedRef.current.has(id))
            if (stillMissing.length === 0) return

            polls++
            pollTimer = window.setTimeout(async () => {
              if (cancelled) return
              try {
                const pollRes = await apiFetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    questionIds: stillMissing,
                    targetLanguage: 'ta',
                    cacheOnly: true,
                  }),
                  timeoutMs: 12_000,
                })
                const pollData = await pollRes.json().catch(() => null)
                if (cancelled) return
                if (pollRes.ok && pollData?.status === 'success' && Array.isArray(pollData.data)) {
                  applyIncoming(pollData.data)
                }
              } catch {
                // Silent background poll failure
              }
              schedulePoll()
            }, PRETRANSLATE_POLL_INTERVAL_MS)
          }

          schedulePoll()
        } catch {
          // Non-blocking pre-translation; safe to ignore while in English mode
        }
      }

      void runBackgroundPreTranslation()

      return () => {
        cancelled = true
        if (pollTimer !== null) window.clearTimeout(pollTimer)
      }
    }

    // ── Active Tamil Mode: Fast Cache Lookup + Priority Batch Streaming ───────
    const runTamilTranslation = async () => {
      isRetryingRef.current = true
      setIsTranslating(true)

      try {
        // Phase 1: Single fast bulk DB cache lookup for ALL uncached IDs (< 100ms)
        if (!cacheCheckedRef.current) {
          cacheCheckedRef.current = true
          const uncachedIds = numericIds.filter((id) => !completedRef.current.has(id))
          if (uncachedIds.length > 0) {
            try {
              const cacheRes = await apiFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionIds: uncachedIds, targetLanguage: 'ta', cacheOnly: true }),
                timeoutMs: 15_000,
              })
              const cacheData = await cacheRes.json().catch(() => null)
              if (cancelled) return
              if (cacheRes.ok && cacheData?.status === 'success' && Array.isArray(cacheData.data)) {
                applyIncoming(cacheData.data)
              }
            } catch {
              // Proceed directly to Phase 2
            }
          }
        }

        // Phase 2: Translate remaining uncached (or explicitly retried failed) IDs
        let isFirstBatch = true
        let consecutiveEmptyFailures = 0

        while (!cancelled) {
          const allQuestions = questionsRef.current
          if (allQuestions.length === 0) break

          let candidateIds: number[]
          if (retryOnlyIdsRef.current && retryOnlyIdsRef.current.length > 0) {
            candidateIds = retryOnlyIdsRef.current.filter(
              (id) => !completedRef.current.has(id) && !failedRef.current.has(id)
            )
          } else {
            const startIndex = Math.min(Math.max(currentIndexRef.current, 0), allQuestions.length - 1)
            const ordered = [...allQuestions.slice(startIndex), ...allQuestions.slice(0, startIndex)]
            candidateIds = ordered
              .map((q) => Number(q.id))
              .filter((id) => Number.isInteger(id) && id > 0 && !completedRef.current.has(id) && !failedRef.current.has(id))
          }

          const batchSize = isFirstBatch ? PRIORITY_CHUNK_SIZE : CHUNK_SIZE
          const pendingIds = candidateIds.slice(0, batchSize)
          isFirstBatch = false

          if (pendingIds.length === 0) break

          try {
            const res = await apiFetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ questionIds: pendingIds, targetLanguage: 'ta' }),
              timeoutMs: REQUEST_TIMEOUT_MS,
            })
            const data = await res.json().catch(() => null)
            if (cancelled) return

            if (!res.ok || data?.status !== 'success' || !Array.isArray(data.data)) {
              pendingIds.forEach((id) => failedRef.current.add(id))
              setFailedIds(Array.from(failedRef.current))
              consecutiveEmptyFailures++
              if (consecutiveEmptyFailures >= 2) break
              continue
            }

            const incoming = applyIncoming(data.data)
            const failed = Array.isArray(data.failedIds)
              ? data.failedIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id))
              : []
            failed.forEach((id: number) => {
              if (!completedRef.current.has(id)) failedRef.current.add(id)
            })
            setFailedIds(Array.from(failedRef.current))

            if (Object.keys(incoming).length === 0) {
              if (failed.length === 0) {
                pendingIds.forEach((id) => failedRef.current.add(id))
                setFailedIds(Array.from(failedRef.current))
              }
              consecutiveEmptyFailures++
              if (consecutiveEmptyFailures >= 2) break
            } else {
              consecutiveEmptyFailures = 0
            }
          } catch {
            if (cancelled) return
            pendingIds.forEach((id) => failedRef.current.add(id))
            setFailedIds(Array.from(failedRef.current))
            consecutiveEmptyFailures++
            if (consecutiveEmptyFailures >= 2) break
          }
        }
      } finally {
        retryOnlyIdsRef.current = null
        isRetryingRef.current = false
        if (!cancelled) setIsTranslating(false)
      }
    }

    void runTamilTranslation()

    return () => {
      cancelled = true
      isRetryingRef.current = false
    }
  }, [language, questions, retryNonce, endpoint])

  const totalCount = questions.length
  const translatedCount = questions.reduce(
    (count, question) => (translations[Number(question.id)] ? count + 1 : count),
    0
  )
  const validFailedIds = failedIds.filter((id) => !translations[id])
  const pendingCount = Math.max(0, totalCount - translatedCount - validFailedIds.length)

  const activeQuestionId = Number(questions[currentIndex]?.id)
  const isActiveQuestionTranslating =
    language === 'ta' &&
    isTranslating &&
    Number.isInteger(activeQuestionId) &&
    activeQuestionId > 0 &&
    !translations[activeQuestionId]

  let translationStatus: TranslationProgressStatus = 'idle'
  if (language === 'ta' && totalCount > 0) {
    if (translatedCount === totalCount) {
      translationStatus = 'completed'
    } else if (isTranslating) {
      translationStatus = 'processing'
    } else if (validFailedIds.length > 0 && translatedCount > 0) {
      translationStatus = 'partial'
    } else if (validFailedIds.length > 0 && translatedCount === 0) {
      translationStatus = 'failed'
    } else {
      translationStatus = 'pending'
    }
  }

  return {
    translations,
    failedIds: validFailedIds,
    isTranslating,
    isActiveQuestionTranslating,
    translatedCount,
    pendingCount,
    translationStatus,
    retry,
  }
}
