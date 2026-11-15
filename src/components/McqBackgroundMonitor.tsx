import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  RefreshCw,
  Square,
  X,
  XCircle,
} from 'lucide-react'
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

export const McqBackgroundMonitor: React.FC<McqBackgroundMonitorProps> = ({
  token,
  showToast,
  onJobCompleted,
  onNavigateToStaging,
}) => {
  const [jobs, setJobs] = useState<McqGenerationJob[]>([])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [busyJobIds, setBusyJobIds] = useState<Record<string, boolean>>({})

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
          showToast?.(
            'success',
            `AI MCQ Generation completed: ${job.generated_count} questions saved to Staging for "${job.lesson_title}".`
          )
          onJobCompleted?.(job)
        } else if (prevStatus && ACTIVE_STATUSES.has(prevStatus) && job.status === 'FAILED') {
          showToast?.(
            'error',
            `MCQ job ${job.job_id} failed: ${job.error_message || 'See job details.'}`
          )
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
  }, [getActiveToken, onJobCompleted, showToast, triggerStep])

  // Initial fetch + event listener for newly queued jobs
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

  // Adaptive polling: fast (2.5s) while jobs are active, quiet (20s) when idle
  useEffect(() => {
    const intervalMs = hasActiveJobs ? 2500 : 20000
    const timer = window.setInterval(() => {
      void fetchJobs()
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [fetchJobs, hasActiveJobs])

  const handleCancelJob = async (jobId: string) => {
    const activeToken = getActiveToken()
    if (!activeToken) return
    setBusyJobIds((prev) => ({ ...prev, [jobId]: true }))
    try {
      const res = await apiFetch(`/api/admin/mcq-generation/jobs/${encodeURIComponent(jobId)}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${activeToken}` },
      })
      const data = await res.json().catch(() => null)
      if (data?.success && data.job) {
        setJobs((prev) => prev.map((j) => (j.job_id === jobId ? data.job : j)))
        showToast?.('success', `Cancelled MCQ generation job ${jobId}.`)
      }
    } finally {
      setBusyJobIds((prev) => ({ ...prev, [jobId]: false }))
    }
  }

  const handleRetryJob = async (jobId: string) => {
    const activeToken = getActiveToken()
    if (!activeToken) return
    setBusyJobIds((prev) => ({ ...prev, [jobId]: true }))
    try {
      const res = await apiFetch(`/api/admin/mcq-generation/jobs/${encodeURIComponent(jobId)}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${activeToken}` },
      })
      const data = await res.json().catch(() => null)
      if (data?.success && data.job) {
        setJobs((prev) => prev.map((j) => (j.job_id === jobId ? data.job : j)))
        showToast?.('success', `Resuming MCQ generation job ${jobId}...`)
        void triggerStep(jobId)
      }
    } finally {
      setBusyJobIds((prev) => ({ ...prev, [jobId]: false }))
    }
  }

  const activeJobs = jobs.filter((j) => ACTIVE_STATUSES.has(j.status))
  const primaryJob = activeJobs[0] || jobs[0] || null

  if (!primaryJob && !isDrawerOpen) return null

  const statusColor = (status: McqJobStatus) => {
    switch (status) {
      case 'COMPLETED':
        return '#34d399'
      case 'FAILED':
        return '#f87171'
      case 'RETRYING':
        return '#f59e0b'
      case 'CANCELLED':
        return '#94a3b8'
      default:
        return '#38bdf8'
    }
  }

  return createPortal(
    <>
      {/* Persistent Global Status Pill (Visible across all Admin sections) */}
      {primaryJob && (
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          title="Click to inspect background AI MCQ generation jobs"
          style={{
            position: 'fixed',
            right: '1.25rem',
            bottom: '1.25rem',
            zIndex: 9950,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.7rem 1rem',
            borderRadius: '14px',
            background: 'rgba(13, 21, 39, 0.96)',
            border: `1px solid ${ACTIVE_STATUSES.has(primaryJob.status) ? 'rgba(56, 189, 248, 0.55)' : primaryJob.status === 'COMPLETED' ? 'rgba(52, 211, 153, 0.45)' : 'rgba(248, 113, 113, 0.45)'}`,
            boxShadow: '0 12px 35px rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(16px)',
            color: '#f8fafc',
            cursor: 'pointer',
            textAlign: 'left',
            maxWidth: '340px',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(56, 189, 248, 0.14)',
              color: statusColor(primaryJob.status),
              flexShrink: 0,
            }}
          >
            {ACTIVE_STATUSES.has(primaryJob.status) ? (
              <RefreshCw size={18} className="spin" />
            ) : primaryJob.status === 'COMPLETED' ? (
              <CheckCircle2 size={18} />
            ) : primaryJob.status === 'FAILED' ? (
              <AlertTriangle size={18} />
            ) : (
              <XCircle size={18} />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>AI MCQ Generation</span>
              {activeJobs.length > 1 && (
                <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '999px', background: 'rgba(56,189,248,0.2)', color: '#7dd3fc' }}>
                  {activeJobs.length} active
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.73rem', color: statusColor(primaryJob.status), fontWeight: 600 }}>
              Status: {primaryJob.status === 'PROCESSING' ? 'Processing' : primaryJob.status === 'RETRYING' ? 'Retrying' : primaryJob.status === 'QUEUED' ? 'Queued' : primaryJob.status === 'COMPLETED' ? 'Completed' : primaryJob.status}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {primaryJob.lesson_title}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {primaryJob.status === 'COMPLETED'
                ? `Generated: ${primaryJob.generated_count} Questions • Saved to: Staging`
                : `Progress: ${primaryJob.generated_count} / ${primaryJob.requested_question_count} Questions (${primaryJob.progress}%)`}
            </div>
          </div>
        </button>
      )}

      {/* Job Details Modal / Drawer */}
      {isDrawerOpen && (
        <div
          className="admin-modal-backdrop"
          style={{ zIndex: 100010 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDrawerOpen(false)
          }}
        >
          <div
            className="admin-modal"
            style={{ maxWidth: '820px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div className="admin-modal-header" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Activity size={20} style={{ color: '#38bdf8' }} />
                <div>
                  <h3 className="admin-modal-title" style={{ margin: 0 }}>
                    Background AI MCQ Generation Jobs
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Persistent PostgreSQL jobs continue running across modal closes, Admin navigation, and page refreshes.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close job monitor"
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body" style={{ overflowY: 'auto', flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {jobs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  No background MCQ generation jobs found.
                </div>
              ) : (
                jobs.map((job) => {
                  const isActive = ACTIVE_STATUSES.has(job.status)
                  const isBusy = Boolean(busyJobIds[job.job_id])
                  return (
                    <div
                      key={job.job_id}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: `1px solid ${isActive ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.1)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.55rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                            {job.lesson_title}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                            <span><Layers size={12} style={{ verticalAlign: 'middle' }} /> {job.group_id.toUpperCase()} • {job.subject} • Std {job.standard_id}</span>
                            <span><Cpu size={12} style={{ verticalAlign: 'middle' }} /> {job.provider.toUpperCase()} ({job.model || 'default'})</span>
                            <span><Clock size={12} style={{ verticalAlign: 'middle' }} /> {job.language.toUpperCase()} • {job.difficulty}</span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>
                            Job ID: <code>{job.job_id}</code>
                          </div>
                        </div>

                        <span
                          style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '999px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: 'rgba(255,255,255,0.06)',
                            color: statusColor(job.status),
                            border: `1px solid ${statusColor(job.status)}55`,
                          }}
                        >
                          {job.status}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                          <span>{job.current_step || job.status}</span>
                          <span>
                            {job.generated_count} / {job.requested_question_count} Questions ({job.progress}%)
                          </span>
                        </div>
                        <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, job.progress))}%`,
                              height: '100%',
                              background: statusColor(job.status),
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>

                      {job.error_message && (
                        <div style={{ fontSize: '0.75rem', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.12)', padding: '0.45rem 0.65rem', borderRadius: '8px' }}>
                          Error: {job.error_message}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {isActive && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary"
                            disabled={isBusy}
                            onClick={() => handleCancelJob(job.job_id)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.76rem', color: '#fca5a5', borderColor: 'rgba(248, 113, 113, 0.4)' }}
                          >
                            <Square size={12} /> Cancel Generation
                          </button>
                        )}
                        {(job.status === 'FAILED' || job.status === 'CANCELLED') && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary"
                            disabled={isBusy}
                            onClick={() => handleRetryJob(job.job_id)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.76rem' }}
                          >
                            <RefreshCw size={12} /> Retry / Resume
                          </button>
                        )}
                        {job.generated_count > 0 && onNavigateToStaging && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-primary"
                            onClick={() => {
                              setIsDrawerOpen(false)
                              onNavigateToStaging()
                            }}
                            style={{ padding: '0.35rem 0.85rem', fontSize: '0.76rem' }}
                          >
                            Review in Staging ({job.generated_count})
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="admin-modal-footer" style={{ flexShrink: 0 }}>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => void fetchJobs()}
              >
                <RefreshCw size={14} /> Refresh
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setIsDrawerOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
