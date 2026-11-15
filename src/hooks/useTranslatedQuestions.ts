import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../utils/api'
import type { Language } from '../context/LanguageContext'

export interface TranslatableMcqItem {
  id: number | string
  question: string
  options: string[]
  explanation?: string
  tag?: string
  subject?: string
  [key: string]: any
}

export interface CachedTranslation {
  question: string
  options: string[]
  explanation: string
  tag?: string | null
}

const TAMIL_CHAR_REGEX = /[\u0B80-\u0BFF]/
const CHUNK_SIZE = 20

function isTranslatableItem(q: TranslatableMcqItem): boolean {
  const numericId = typeof q.id === 'number' ? q.id : Number(q.id)
  if (!Number.isInteger(numericId) || numericId <= 0) return false
  const subj = (q.subject || '').toLowerCase()
  if (subj.includes('general tamil') || subj.includes('pothu tamil')) return false
  if (TAMIL_CHAR_REGEX.test(q.question || '')) return false
  return true
}

/**
 * Progressively fetches and caches Tamil translations from /api/questions/translate
 * for ALL numeric-ID DB questions in a practice session (e.g. all 100 questions)
 * when the display language is 'ta'.
 * Prioritizes the active question index first, then translates remaining batches.
 * Never alters question IDs or correctAnswer indices.
 */
export function useTranslatedQuestions<T extends TranslatableMcqItem>(
  questions: T[],
  language: Language,
  currentIndex: number = 0
): {
  translatedMap: Record<number, CachedTranslation>
  isTranslating: boolean
  translatedCount: number
  totalTranslatableCount: number
} {
  const [translatedMap, setTranslatedMap] = useState<Record<number, CachedTranslation>>({})
  const [isTranslating, setIsTranslating] = useState(false)
  const inFlightRef = useRef<boolean>(false)
  const attemptedIdsRef = useRef<Set<number>>(new Set())

  const totalTranslatableCount = useMemo(
    () => questions.filter(isTranslatableItem).length,
    [questions]
  )

  const translatedCount = useMemo(() => {
    let count = 0
    for (const q of questions) {
      if (!isTranslatableItem(q)) continue
      const numId = Number(q.id)
      if (translatedMap[numId]) count++
    }
    return count
  }, [questions, translatedMap])

  useEffect(() => {
    if (language !== 'ta' || questions.length === 0 || inFlightRef.current) {
      return
    }

    // Order questions starting from currentIndex so the active question translates first
    const ordered: T[] = [
      ...questions.slice(Math.max(0, currentIndex)),
      ...questions.slice(0, Math.max(0, currentIndex)),
    ]

    const pendingIds: number[] = []
    for (const q of ordered) {
      if (!isTranslatableItem(q)) continue
      const numericId = Number(q.id)
      if (translatedMap[numericId] || attemptedIdsRef.current.has(numericId)) continue
      pendingIds.push(numericId)
      if (pendingIds.length >= CHUNK_SIZE) break
    }

    if (pendingIds.length === 0) {
      setIsTranslating(false)
      return
    }

    let cancelled = false
    inFlightRef.current = true
    pendingIds.forEach((id) => attemptedIdsRef.current.add(id))
    setIsTranslating(true)

    apiFetch('/api/questions/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIds: pendingIds, targetLanguage: 'ta' }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data && Array.isArray(data.data)) {
          setTranslatedMap((prev) => {
            const next = { ...prev }
            for (const item of data.data) {
              if (item && Number.isInteger(item.questionId) && Array.isArray(item.options)) {
                next[item.questionId] = {
                  question: item.question,
                  options: item.options,
                  explanation: item.explanation || '',
                  tag: item.tag || null,
                }
              }
            }
            return next
          })
        }
      })
      .catch(() => {})
      .finally(() => {
        inFlightRef.current = false
        if (!cancelled) {
          // Check if more untranslated questions remain; if none, stop indicator
          const moreLeft = questions.some((q) => {
            if (!isTranslatableItem(q)) return false
            const id = Number(q.id)
            return !attemptedIdsRef.current.has(id)
          })
          if (!moreLeft) {
            setIsTranslating(false)
          }
        }
      })

    return () => {
      cancelled = true
    }
  }, [questions, language, currentIndex, translatedMap])

  return { translatedMap, isTranslating, translatedCount, totalTranslatableCount }
}
