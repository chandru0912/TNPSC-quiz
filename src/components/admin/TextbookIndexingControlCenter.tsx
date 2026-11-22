import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Database,
  FileSearch,
  Layers,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-react'
import { apiFetch } from '../../utils/api'

interface StandardBreakdown {
  standard: number
  textbooks: number
  totalPages: number
  extractedPages: number
  indexedPages: number
  failedPages: number
  completedTextbooks: number
  partialTextbooks: number
  distinctLessons: number
  mappedSyllabusLessons: number
}

interface IndexingOverview {
  totalTextbooks: number
  totalPdfs: number
  totalSyllabusLessons: number
  mappedSyllabusLessons: number
  totalPages: number
  extractedPages: number
  indexedPages: number
  matterPages: number
  blankPages: number
  pendingPages: number
  failedPages: number
  processingPages: number
  nativePages: number
  ocrPages: number
  completedTextbooks: number
  partialTextbooks: number
  failedTextbooks: number
  pendingTextbooks: number
  incompletePublishedTextbooks: number
  lastProcessingTime: string | null
  lastIndexedTime: string | null
  byStandard: StandardBreakdown[]
}

interface VerificationReport {
  passed: boolean
  checkedAt: string
  totals: {
    totalTextbooks: number
    totalPages: number
    completedPages: number
    indexedBodyPages: number
    matterPages: number
    blankPages: number
    failedPages: number
    pendingPages: number
    duplicatePageRows: number
    nullLessonIdOnIndexedPages: number
    hardcodedClass6UnitBleed: number
    textbooksWithZeroIndexedPages: number
    textbooksWithPageCountMismatch: number
    mappedSyllabusLessons: number
    totalSyllabusLessons: number
  }
  issues: string[]
}

interface FailedPageLog {
  id: number
  textbookId: number
  bookName: string
  pageNumber: number
  retryCount: number
  extractionMethod: string | null
  extractionError: string | null
  updatedAt: string | null
}

interface Props {
  token: string | null
  standardFilter?: string
  mediumFilter?: string
  onRefreshTextbooks?: () => void
  showToast: (type: 'success' | 'error', message: string) => void
}

export const TextbookIndexingControlCenter: React.FC<Props> = ({
  token,
  standardFilter = 'all',
  mediumFilter = 'all',
  onRefreshTextbooks,
  showToast,
}) => {
  const [overview, setOverview] = useState<IndexingOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [progressText, setProgressText] = useState<string>('')
  const [progressPct, setProgressPct] = useState<number>(0)
  const [verification, setVerification] = useState<VerificationReport | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [errorLogs, setErrorLogs] = useState<{ failedPages: FailedPageLog[]; incompleteTextbooks: any[] } | null>(null)
  const stopRef = useRef(false)

  const authHeaders = useCallback(() => {
    const activeToken = token || localStorage.getItem('tnpsc_admin_token') || ''
    return {
      'Content-Type': 'application/json',
      ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
    }
  }, [token])

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/textbooks/indexing/overview', { headers: authHeaders() })
      const json = await res.json()
      if (res.ok && json.status === 'success' && json.data) {
        setOverview(json.data)
      }
    } catch (err: any) {
      console.warn('[IndexingControlCenter] Overview fetch failed:', err?.message)
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  const parsedStd = standardFilter && standardFilter !== 'all' ? parseInt(standardFilter.replace(/\D/g, ''), 10) : undefined

  const handleScanAll = async () => {
    setActiveAction('scan')
    setProgressText('Scanning all textbooks (Std 6–12)...')
    try {
      const res = await apiFetch('/api/textbooks/indexing/scan-all', { method: 'POST', headers: authHeaders() })
      const json = await res.json()
      if (res.ok && json.status === 'success') {
        if (json.data?.overview) setOverview(json.data.overview)
        if (json.data?.verification) setVerification(json.data.verification)
        showToast('success', json.message || 'Scan completed.')
      } else {
        showToast('error', json.message || 'Scan failed.')
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Scan failed.')
    } finally {
      setActiveAction(null)
      setProgressText('')
    }
  }

  const runChunkedLoop = async (endpoint: string, actionKey: string, label: string) => {
    stopRef.current = false
    setActiveAction(actionKey)
    setProgressPct(2)
    setProgressText(`Starting ${label}...`)
    let cursor = 0
    let jobId: string | undefined
    let totalProcessed = 0
    let totalSucceeded = 0

    try {
      while (!stopRef.current) {
        const res = await apiFetch(endpoint, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            cursorTextbookId: cursor,
            batchSize: 10,
            standard: parsedStd && !isNaN(parsedStd) ? parsedStd : undefined,
            medium: mediumFilter !== 'all' ? mediumFilter : undefined,
            jobId,
          }),
        })
        const json = await res.json()
        if (!res.ok || json.status !== 'success') {
          showToast('error', json.message || `${label} failed.`)
          break
        }
        const d = json.data
        jobId = d.jobId || jobId
        cursor = d.nextCursor || cursor
        totalProcessed += Number(d.processed || 0)
        totalSucceeded += Number(d.succeeded || 0)
        const remaining = Number(d.remaining || 0)
        const total = totalProcessed + remaining
        const pct = total > 0 ? Math.min(100, Math.round((totalProcessed / total) * 100)) : 100
        setProgressPct(pct)
        setProgressText(`${label}: ${totalProcessed}/${total} textbooks (${pct}%)`)

        if (!d.hasMore || d.processed === 0) {
          showToast('success', `${label} completed (${totalSucceeded} textbooks updated).`)
          break
        }
      }
      if (stopRef.current) {
        showToast('success', `${label} paused safely after ${totalProcessed} textbooks. Click "Resume Interrupted Jobs" to continue.`)
      }
    } catch (err: any) {
      showToast('error', err?.message || `${label} error.`)
    } finally {
      setActiveAction(null)
      setProgressText('')
      setProgressPct(0)
      await fetchOverview()
      onRefreshTextbooks?.()
    }
  }

  const handleExtractMissing = async () => {
    stopRef.current = false
    setActiveAction('extract')
    setProgressText('Checking & extracting missing PDF pages...')
    try {
      const res = await apiFetch('/api/textbooks/indexing/extract-missing', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ limit: 1 }),
      })
      const json = await res.json()
      if (res.ok && json.status === 'success') {
        showToast('success', json.message || 'Missing extraction check complete.')
      } else {
        showToast('error', json.message || 'Extract missing failed.')
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Extract missing failed.')
    } finally {
      setActiveAction(null)
      setProgressText('')
      await fetchOverview()
      onRefreshTextbooks?.()
    }
  }

  const handleRetryFailed = async () => {
    setActiveAction('retry')
    setProgressText('Retrying failed OCR/extraction pages...')
    try {
      const res = await apiFetch('/api/textbooks/indexing/retry-failed', { method: 'POST', headers: authHeaders() })
      const json = await res.json()
      if (res.ok && json.status === 'success') {
        showToast('success', json.message || 'Retry complete.')
      } else {
        showToast('error', json.message || 'Retry failed.')
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Retry failed.')
    } finally {
      setActiveAction(null)
      setProgressText('')
      await fetchOverview()
      onRefreshTextbooks?.()
    }
  }

  const handleResumeJobs = async () => {
    setActiveAction('resume')
    setProgressText('Resuming interrupted indexing jobs...')
    try {
      const res = await apiFetch('/api/textbooks/indexing/resume-jobs', { method: 'POST', headers: authHeaders() })
      const json = await res.json()
      if (res.ok && json.status === 'success') {
        showToast('success', json.message || 'Resumed indexing jobs.')
      } else {
        showToast('error', json.message || 'Resume failed.')
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Resume failed.')
    } finally {
      setActiveAction(null)
      setProgressText('')
      await fetchOverview()
      onRefreshTextbooks?.()
    }
  }

  const handleVerifyAll = async () => {
    setActiveAction('verify')
    setProgressText('Running integrity verification across Standards 6–12...')
    try {
      const res = await apiFetch('/api/textbooks/indexing/verify-all', { method: 'POST', headers: authHeaders() })
      const json = await res.json()
      if (res.ok && json.status === 'success') {
        setVerification(json.data)
        showToast(json.data?.passed ? 'success' : 'error', json.message || 'Verification finished.')
      } else {
        showToast('error', json.message || 'Verification failed.')
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Verification failed.')
    } finally {
      setActiveAction(null)
      setProgressText('')
    }
  }

  const handleToggleErrorLogs = async () => {
    if (showErrors) {
      setShowErrors(false)
      return
    }
    setShowErrors(true)
    try {
      const res = await apiFetch('/api/textbooks/indexing/errors', { headers: authHeaders() })
      const json = await res.json()
      if (res.ok && json.status === 'success') {
        setErrorLogs(json.data)
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to load error logs.')
    }
  }

  const isBusy = activeAction !== null

  return (
    <div
      className="glass"
      style={{
        padding: '1.15rem 1.25rem',
        borderRadius: '14px',
        marginBottom: '1.15rem',
        border: '1px solid rgba(251, 191, 36, 0.22)',
        background: 'rgba(15, 23, 42, 0.65)',
      }}
    >
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '0.9rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(251, 191, 36, 0.16)',
              color: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Database size={19} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc' }}>
              Textbook Page Extraction & Indexing Control Center (Standards 6–12)
            </h3>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Live Neon PostgreSQL status • Last Indexed:{' '}
              {overview?.lastIndexedTime ? new Date(overview.lastIndexedTime).toLocaleString() : 'Never'}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={fetchOverview}
          disabled={loading}
          style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
        >
          <RefreshCw size={13} className={loading ? 'spin-icon' : ''} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Incomplete Published Textbook Warning Banner (Phase 7) */}
      {overview && overview.incompletePublishedTextbooks > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.6rem 0.85rem',
            borderRadius: '10px',
            marginBottom: '0.85rem',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#fde68a',
            fontSize: '0.8rem',
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, color: '#f59e0b' }} />
          <span>
            <strong>{overview.incompletePublishedTextbooks}</strong> published textbook(s) have partial indexing or failed OCR pages (
            {overview.failedPages} failed, {overview.pendingPages} pending). Inspect Error Logs or run Retry / Index below.
          </span>
        </div>
      )}

      {/* Live Metrics Grid */}
      {overview && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(138px, 1fr))',
            gap: '0.6rem',
            marginBottom: '0.9rem',
          }}
        >
          {[
            { label: 'Textbooks / PDFs', value: `${overview.totalTextbooks} / ${overview.totalPdfs}`, color: '#38bdf8' },
            { label: 'Total PDF Pages', value: overview.totalPages.toLocaleString(), color: '#e2e8f0' },
            {
              label: 'Extracted Pages',
              value: overview.extractedPages.toLocaleString(),
              sub: `${overview.nativePages.toLocaleString()} native • ${overview.ocrPages.toLocaleString()} OCR`,
              color: '#34d399',
            },
            {
              label: 'Indexed Body Pages',
              value: overview.indexedPages.toLocaleString(),
              sub: `${overview.matterPages.toLocaleString()} matter • ${overview.blankPages} blank`,
              color: '#fbbf24',
            },
            {
              label: 'Mapped Lessons',
              value: `${overview.mappedSyllabusLessons.toLocaleString()} / ${overview.totalSyllabusLessons.toLocaleString()}`,
              color: '#a78bfa',
            },
            {
              label: 'Pending / Failed',
              value: `${overview.pendingPages} / ${overview.failedPages}`,
              color: overview.failedPages > 0 || overview.pendingPages > 0 ? '#f87171' : '#34d399',
            },
            {
              label: 'Books Ready / Partial',
              value: `${overview.completedTextbooks} / ${overview.partialTextbooks}`,
              sub: `${overview.failedTextbooks} failed`,
              color: '#2dd4bf',
            },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                padding: '0.6rem 0.75rem',
                borderRadius: '10px',
                background: 'rgba(30, 41, 59, 0.65)',
                border: '1px solid rgba(148, 163, 184, 0.14)',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.2rem' }}>{m.label}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: m.color }}>{m.value}</div>
              {m.sub && <div style={{ fontSize: '0.67rem', color: '#64748b', marginTop: '0.15rem' }}>{m.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Per-Standard (6–12) Coverage Strip */}
      {overview && overview.byStandard.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '0.45rem',
            flexWrap: 'wrap',
            marginBottom: '0.9rem',
          }}
        >
          {overview.byStandard.map((s) => (
            <div
              key={s.standard}
              style={{
                padding: '0.32rem 0.6rem',
                borderRadius: '8px',
                fontSize: '0.72rem',
                background: s.failedPages > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                border: `1px solid ${s.failedPages > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                color: '#e2e8f0',
              }}
            >
              <strong>Std {s.standard}:</strong> {s.textbooks} books • {s.indexedPages.toLocaleString()} indexed •{' '}
              {s.mappedSyllabusLessons} lessons
              {s.failedPages > 0 ? ` • ${s.failedPages} failed` : ''}
            </div>
          ))}
        </div>
      )}

      {/* Action Controls Bar (All 8 Controls) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          disabled={isBusy}
          onClick={handleScanAll}
          style={{ fontSize: '0.78rem', padding: '0.42rem 0.78rem' }}
        >
          <FileSearch size={14} />
          <span>Scan All</span>
        </button>

        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          disabled={isBusy}
          onClick={handleExtractMissing}
          style={{ fontSize: '0.78rem', padding: '0.42rem 0.78rem' }}
        >
          <BookOpen size={14} />
          <span>Generate Missing Extraction</span>
        </button>

        <button
          type="button"
          className="admin-btn admin-btn-primary"
          disabled={isBusy}
          onClick={() => runChunkedLoop('/api/textbooks/indexing/index-all', 'index_all', 'Index All Extracted Pages')}
          style={{ fontSize: '0.78rem', padding: '0.42rem 0.85rem' }}
        >
          <Layers size={14} />
          <span>Index All Extracted Pages</span>
        </button>

        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          disabled={isBusy}
          onClick={() =>
            runChunkedLoop('/api/textbooks/indexing/repair-mappings', 'repair_mappings', 'Repair Missing Lesson Mappings')
          }
          style={{ fontSize: '0.78rem', padding: '0.42rem 0.78rem' }}
        >
          <Wrench size={14} />
          <span>Repair Missing Lesson Mappings</span>
        </button>

        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          disabled={isBusy}
          onClick={handleRetryFailed}
          style={{ fontSize: '0.78rem', padding: '0.42rem 0.78rem' }}
        >
          <RefreshCw size={14} />
          <span>Retry Failed Pages ({overview?.failedPages ?? 0})</span>
        </button>

        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          disabled={isBusy}
          onClick={handleResumeJobs}
          style={{ fontSize: '0.78rem', padding: '0.42rem 0.78rem' }}
        >
          <PlayCircle size={14} />
          <span>Resume Interrupted Jobs</span>
        </button>

        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          disabled={isBusy}
          onClick={handleVerifyAll}
          style={{ fontSize: '0.78rem', padding: '0.42rem 0.78rem' }}
        >
          <ShieldCheck size={14} />
          <span>Verify All Textbooks</span>
        </button>

        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={handleToggleErrorLogs}
          style={{ fontSize: '0.78rem', padding: '0.42rem 0.78rem' }}
        >
          <AlertTriangle size={14} />
          <span>{showErrors ? 'Hide Error Logs' : 'View Detailed Error Logs'}</span>
        </button>

        {isBusy && (activeAction === 'index_all' || activeAction === 'repair_mappings') && (
          <button
            type="button"
            onClick={() => {
              stopRef.current = true
            }}
            style={{
              background: 'rgba(239, 68, 68, 0.16)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              borderRadius: '8px',
              padding: '0.42rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <PauseCircle size={14} />
            <span>Pause Safely</span>
          </button>
        )}
      </div>

      {/* Live Progress Bar */}
      {isBusy && progressText && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ fontSize: '0.78rem', color: '#fde68a', marginBottom: '0.3rem' }}>{progressText}</div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progressPct || 30}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                transition: 'width 0.25s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Verification Result Banner */}
      {verification && (
        <div
          style={{
            marginTop: '0.8rem',
            padding: '0.65rem 0.85rem',
            borderRadius: '10px',
            background: verification.passed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${verification.passed ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
            fontSize: '0.78rem',
            color: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
            {verification.passed ? (
              <CheckCircle2 size={16} color="#34d399" />
            ) : (
              <XCircle size={16} color="#f87171" />
            )}
            <span>
              Integrity Verification {verification.passed ? 'PASSED' : 'REPORTED ISSUES'} —{' '}
              {verification.totals.indexedBodyPages.toLocaleString()} indexed body pages,{' '}
              {verification.totals.duplicatePageRows} duplicates, {verification.totals.nullLessonIdOnIndexedPages} NULL lesson_ids,{' '}
              {verification.totals.hardcodedClass6UnitBleed} cross-class bleed rows, {verification.totals.failedPages} documented
              failed OCR pages
            </span>
          </div>
          {verification.issues.length > 0 && (
            <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0, color: '#fca5a5' }}>
              {verification.issues.map((iss, idx) => (
                <li key={idx}>{iss}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Detailed Error Logs Drawer */}
      {showErrors && errorLogs && (
        <div
          style={{
            marginTop: '0.85rem',
            padding: '0.8rem',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(239, 68, 68, 0.28)',
            maxHeight: '280px',
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fca5a5', marginBottom: '0.5rem' }}>
            Failed Extraction / OCR Pages ({errorLogs.failedPages.length}) & Incomplete Textbooks ({errorLogs.incompleteTextbooks.length})
          </div>
          {errorLogs.failedPages.length === 0 ? (
            <div style={{ fontSize: '0.76rem', color: '#34d399' }}>Zero failed pages!</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', color: '#e2e8f0' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: '#94a3b8' }}>
                  <th style={{ padding: '0.3rem' }}>Textbook</th>
                  <th style={{ padding: '0.3rem' }}>Page</th>
                  <th style={{ padding: '0.3rem' }}>Method</th>
                  <th style={{ padding: '0.3rem' }}>Retries</th>
                  <th style={{ padding: '0.3rem' }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {errorLogs.failedPages.map((fp) => (
                  <tr key={fp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '0.3rem' }}>
                      #{fp.textbookId} {fp.bookName}
                    </td>
                    <td style={{ padding: '0.3rem' }}>p.{fp.pageNumber}</td>
                    <td style={{ padding: '0.3rem' }}>{fp.extractionMethod || 'ocr'}</td>
                    <td style={{ padding: '0.3rem' }}>{fp.retryCount}</td>
                    <td style={{ padding: '0.3rem', color: '#fca5a5' }}>{fp.extractionError || 'Unreadable page'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
