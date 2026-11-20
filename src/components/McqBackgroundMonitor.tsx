import React, { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../utils/api'

export type McqJobStatus = 'QUEUED' | 'PROCESSING' | 'RETRYING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface McqGenerationJob {
  job_id: string
  admin_id: string
  provider: 'claude' | 'gemini' | 'openai'
  model: string
  group_id: string
  subject_id: string
  subject: string
  standard_id: number
  term_id: string | null
  volume: string | null
  unit_id: number
  unit_title: string | null
  lesson_id: string | null
  lesson_title: string
  lesson_number: string | null
  selected_topics: string[]
  requested_question_count: number
  difficulty: string
  language: 'tamil' | 'english'
  textbook_id: number | null
  textbook_name: string | null
  source_pdf: string | null
  status: McqJobStatus
  progress: number
  generated_count: number
  failed_count: number
  duplicate_count: number
  invalid_count: number
  current_step: string | null
  current_batch?: number
  total_batches?: number
  error_message: string | null
  lease_active: boolean
  created_at: string
  started_at: string | null
  updated_at: string
  completed_at: string | null
}

export interface McqBackgroundMonitorProps {
  token: string
  showToast?: (type: 'success' | 'error', message: string) => void
  onJobCompleted?: (job: McqGenerationJob) => void
  onNavigateToStaging?: () => void
}

const ACTIVE_STATUSES = new Set<McqJobStatus>(['QUEUED', 'PROCESSING', 'RETRYING'])

/**
 * Headless background job runner for AI MCQ Generation.
 * Continues driving queued/active backend generation steps and notifies onJobCompleted
 * without rendering any floating bottom-right notification or automatic toast.
 */
export const McqBackgroundMonitor: React.FC<McqBackgroundMonitorProps> = ({
  token,
  onJobCompleted,
}) => {
  const [jobs, setJobs] = useState<McqGenerationJob[]>([])

  const inFlightStepsRef = useRef<Set<string>>(new Set())
  const prevStatusMapRef = useRef<Record<string, McqJobStatus>>({})

  const getActiveToken = useCallback(
    () => token || localStorage.getItem('tnpsc_admin_token') || '',
    [token]
  )

  const triggerStep = useCallback(
    async (jobId: string) => {
      const activeToken = getActiveToken()
      if (!activeToken || inFlightStepsRef.current.has(jobId)) return
      inFlightStepsRef.current.add(jobId)
      try {
        const res = await apiFetch(`/api/admin/mcq-generation/jobs/${encodeURIComponent(jobId)}/step`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${activeToken}` },
          timeoutMs: 65000,
        })
        if (res.ok) {
          const data = await res.json().catch(() => null)
          if (data?.job) {
            setJobs((prev) => {
              const exists = prev.some((j) => j.job_id === data.job.job_id)
              return exists
                ? prev.map((j) => (j.job_id === data.job.job_id ? data.job : j))
                : [data.job, ...prev]
            })
          }
        }
      } catch {
        // Step errors are recorded on the job row by the backend and retried safely
      } finally {
        inFlightStepsRef.current.delete(jobId)
      }
    },
    [getActiveToken]
  )

  const fetchJobs = useCallback(async () => {
    const activeToken = getActiveToken()
    if (!activeToken) return
    try {
      const res = await apiFetch('/api/admin/mcq-generation/jobs?limit=15', {
        headers: { Authorization: `Bearer ${activeToken}` },
      })
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      if (!data?.success || !Array.isArray(data.jobs)) return

      const fetched: McqGenerationJob[] = data.jobs
      setJobs(fetched)

      for (const job of fetched) {
        const prevStatus = prevStatusMapRef.current[job.job_id]
        if (prevStatus && ACTIVE_STATUSES.has(prevStatus) && job.status === 'COMPLETED') {
          onJobCompleted?.(job)
        }
        prevStatusMapRef.current[job.job_id] = job.status

        // Drive next batch step if job is active and no worker lease is currently active
        if (ACTIVE_STATUSES.has(job.status) && !job.lease_active && !inFlightStepsRef.current.has(job.job_id)) {
          void triggerStep(job.job_id)
        }
      }
    } catch {
      // Non-fatal background polling error
    }
  }, [getActiveToken, onJobCompleted, triggerStep])

  useEffect(() => {
    void fetchJobs()

    const handleJobCreated = () => {
      void fetchJobs()
    }
    window.addEventListener('tnpsc:mcq-job-created', handleJobCreated)
    return () => {
      window.removeEventListener('tnpsc:mcq-job-created', handleJobCreated)
    }
  }, [fetchJobs])

  const hasActiveJobs = jobs.some((j) => ACTIVE_STATUSES.has(j.status))

  useEffect(() => {
    const intervalMs = hasActiveJobs ? 2500 : 20000
    const timer = window.setInterval(() => {
      void fetchJobs()
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [fetchJobs, hasActiveJobs])

  return null
}
