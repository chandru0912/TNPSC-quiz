import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../utils/api'

export interface McqTranslation {
  question: string
  options: string[]
  explanation: string
}

interface TranslatableQuestion {
  id: number
}

const CHUNK_SIZE = 10
const REQUEST_TIMEOUT_MS = 55_000

/**
 * Progressively loads/caches Tamil display translations for the current lesson.
 * English mode never calls the translation endpoint and never reads this cache.
 * Failed questions are reported separately so the student gets an explicit retry,
 * and a single failed batch never restarts the whole lesson.
 */
export function useMcqTranslations(
  questions: TranslatableQuestion[],
  language: 'en' | 'ta',
  currentIndex: number = 0
): {
  translations: Record<number, McqTranslation>
  failedIds: number[]
  isTranslating: boolean
  translatedCount: number
  retry: () => void
} {
  const [translations, setTranslations] = useState<Record<number, McqTranslation>>({})
  const [failedIds, setFailedIds] = useState<number[]>([])
  const [isTranslating, setIsTranslating] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  const completedRef = useRef<Set<number>>(new Set())
  const questionsRef = useRef(questions)
  const currentIndexRef = useRef(currentIndex)
  const lessonRef = useRef<TranslatableQuestion[] | null>(null)

  useEffect(() => {
    questionsRef.current = questions
    currentIndexRef.current = currentIndex
  })

  const retry = useCallback(() => {
    setFailedIds([])
    setRetryNonce((value) => value + 1)
  }, [])

  useEffect(() => {
    // A new lesson reuses this component instance, so per-lesson state must reset.
    if (lessonRef.current !== questions) {
      lessonRef.current = questions
      completedRef.current = new Set()
      setTranslations({})
      setFailedIds([])
    }

    if (language !== 'ta' || questionsRef.current.length === 0) {
      setIsTranslating(false)
      return
    }

    let cancelled = false
    const failedThisRun = new Set<number>()

    const run = async () => {
      setIsTranslating(true)

      while (!cancelled) {
        const allQuestions = questionsRef.current
        if (allQuestions.length === 0) break

        const startIndex = Math.min(Math.max(currentIndexRef.current, 0), allQuestions.length - 1)
        const ordered = [...allQuestions.slice(startIndex), ...allQuestions.slice(0, startIndex)]
        const pending = ordered
          .filter((question) => !completedRef.current.has(question.id) && !failedThisRun.has(question.id))
          .slice(0, CHUNK_SIZE)
        if (pending.length === 0) break

        const ids = pending.map((question) => question.id)

        try {
          const res = await apiFetch('/api/study-materials/questions/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionIds: ids, targetLanguage: 'ta' }),
            timeoutMs: REQUEST_TIMEOUT_MS,
          })
          const data = await res.json().catch(() => null)
          if (cancelled) return

          if (!res.ok || data?.status !== 'success' || !Array.isArray(data.data)) {
            ids.forEach((id) => failedThisRun.add(id))
            setFailedIds(Array.from(failedThisRun))
            break
          }

          const incoming: Record<number, McqTranslation> = {}
          for (const item of data.data) {
            const id = Number(item?.questionId)
            if (!Number.isInteger(id) || !Array.isArray(item.options) || item.options.length !== 4) continue
            incoming[id] = {
              question: String(item.question || ''),
              options: item.options.map((option: unknown) => String(option ?? '')),
              explanation: String(item.explanation || ''),
            }
            completedRef.current.add(id)
          }

          const failed = Array.isArray(data.failedIds)
            ? data.failedIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id))
            : []
          failed.forEach((id: number) => failedThisRun.add(id))
          setFailedIds(Array.from(failedThisRun))

          if (Object.keys(incoming).length > 0) {
            setTranslations((prev) => ({ ...prev, ...incoming }))
          } else {
            // Nothing new in this chunk: stop instead of re-requesting the same
            // failed IDs in a loop. The student can retry explicitly.
            if (failed.length === 0) {
              ids.forEach((id) => failedThisRun.add(id))
              setFailedIds(Array.from(failedThisRun))
            }
            break
          }
        } catch {
          if (cancelled) return
          ids.forEach((id) => failedThisRun.add(id))
          setFailedIds(Array.from(failedThisRun))
          break
        }
      }

      if (!cancelled) setIsTranslating(false)
    }

    run()

    return () => {
      cancelled = true
    }
  }, [language, questions, retryNonce])

  const translatedCount = questions.reduce(
    (count, question) => (translations[question.id] ? count + 1 : count),
    0
  )

  return { translations, failedIds, isTranslating, translatedCount, retry }
}
