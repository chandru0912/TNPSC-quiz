import { useEffect, useRef, useState } from 'react'
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

interface CachedTranslation {
  question: string
  options: string[]
  explanation: string
  tag?: string | null
}

const TAMIL_CHAR_REGEX = /[\u0B80-\u0BFF]/

/**
 * Fetches and caches Tamil translations from /api/questions/translate for numeric-ID DB questions
 * when the global language is 'ta'. Never alters question IDs or correctAnswer indices.
 */
export function useTranslatedQuestions<T extends TranslatableMcqItem>(
  questions: T[],
  language: Language
): { translatedMap: Record<number, CachedTranslation>; isTranslating: boolean } {
  const [translatedMap, setTranslatedMap] = useState<Record<number, CachedTranslation>>({})
  const [isTranslating, setIsTranslating] = useState(false)
  const inFlightRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (language !== 'ta' || questions.length === 0) {
      return
    }

    const pendingIds: number[] = []
    for (const q of questions) {
      const numericId = typeof q.id === 'number' ? q.id : Number(q.id)
      if (!Number.isInteger(numericId) || numericId <= 0) continue
      if (translatedMap[numericId] || inFlightRef.current.has(numericId)) continue
      // Skip if already in Tamil script or explicitly General Tamil
      const subj = (q.subject || '').toLowerCase()
      if (subj.includes('general tamil') || subj.includes('pothu tamil')) continue
      if (TAMIL_CHAR_REGEX.test(q.question || '')) continue
      pendingIds.push(numericId)
    }

    if (pendingIds.length === 0) {
      return
    }

    let cancelled = false
    const batch = pendingIds.slice(0, 30)
    batch.forEach((id) => inFlightRef.current.add(id))
    setIsTranslating(true)

    apiFetch('/api/questions/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIds: batch, targetLanguage: 'ta' }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data || !Array.isArray(data.data)) return
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
      })
      .catch(() => {})
      .finally(() => {
        batch.forEach((id) => inFlightRef.current.delete(id))
        if (!cancelled) setIsTranslating(false)
      })

    return () => {
      cancelled = true
    }
  }, [questions, language, translatedMap])

  return { translatedMap, isTranslating }
}
