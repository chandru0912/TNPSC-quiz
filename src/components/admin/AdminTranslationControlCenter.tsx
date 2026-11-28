import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Languages,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { apiFetch } from '../../utils/api'

interface TranslationSummary {
  totalEnglish: number
  fullyTranslated: number
  pending: number
  processing: number
  failed: number
  needsReview: number
  completionPercentage: number
  cacheHitRate: number
  queueDepth: number
  workerActive: boolean
  memoryCacheEntries: number
}

interface TranslationAuditItem {
  questionId: number
  category: string
  subject: string
  standard: number | null
  unit: number | null
  lessonTitle: string
  questionPreview: string
  translationStatus: string
  verificationStatus: string
  retryCount: number
  lastError: string | null
  provider: string | null
  updatedAt: string | null
}

interface AdminTranslationControlCenterProps {
  token: string
}

export const AdminTranslationControlCenter: React.FC<AdminTranslationControlCenterProps> = ({ token }) => {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState<'missing' | 'retry' | 'revalidate' | null>(null)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [groupFilter, setGroupFilter] = useState('all')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [standardFilter, setStandardFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('INCOMPLETE')

  const [summary, setSummary] = useState<TranslationSummary>({
    totalEnglish: 0,
    fullyTranslated: 0,
    pending: 0,
    processing: 0,
    failed: 0,
    needsReview: 0,
    completionPercentage: 0,
    cacheHitRate: 0,
    queueDepth: 0,
    workerActive: false,
    memoryCacheEntries: 0,
  })
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([])
  const [items, setItems] = useState<TranslationAuditItem[]>([])

  const loadStats = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (groupFilter !== 'all') params.set('group', groupFilter)
      if (subjectFilter !== 'all') params.set('subject', subjectFilter)
      if (standardFilter !== 'all') params.set('standard', standardFilter)
      if (statusFilter !== 'INCOMPLETE') params.set('status', statusFilter)

      const res = await apiFetch(`/api/questions/admin/translations/stats?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.status === 'success' && json.data) {
        setSummary(json.data.summary)
        setAvailableSubjects(json.data.availableSubjects || [])
        setItems(json.data.items || [])
      }
    } finally {
      setLoading(false)
    }
  }, [token, groupFilter, subjectFilter, standardFilter, statusFilter])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  // Auto-poll every 6s while background translation worker is active
  useEffect(() => {
    if (!summary.workerActive && summary.queueDepth === 0) return
    const timer = window.setInterval(() => {
      void loadStats()
    }, 6000)
    return () => window.clearInterval(timer)
  }, [summary.workerActive, summary.queueDepth, loadStats])

  const handleTranslateMissing = async () => {
    setActionBusy('missing')
    setBanner(null)
    try {
      const res = await apiFetch('/api/questions/admin/translations/translate-missing', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group: groupFilter,
          subject: subjectFilter,
          standard: standardFilter,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.status === 'success') {
        const d = json.data
        setBanner({
          type: 'success',
          text:
            d.foundMissing === 0
              ? 'All published questions in this filter already have verified Tamil translations.'
              : `Queued ${d.queued} of ${d.foundMissing} missing question(s) for background Tamil translation.`,
        })
        await loadStats()
      } else {
        setBanner({ type: 'error', text: json.message || 'Failed to queue missing translations.' })
      }
    } finally {
      setActionBusy(null)
    }
  }

  const handleRetryFailed = async (singleIds?: number[]) => {
    setActionBusy('retry')
    setBanner(null)
    try {
      const res = await apiFetch('/api/questions/admin/translations/retry-failed', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(singleIds ? { questionIds: singleIds } : {}),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.status === 'success') {
        setBanner({
          type: 'success',
          text: `Queued ${json.data.queued} question(s) for translation recovery.`,
        })
        await loadStats()
      } else {
        setBanner({ type: 'error', text: json.message || 'Failed to retry translations.' })
      }
    } finally {
      setActionBusy(null)
    }
  }

  const handleRevalidate = async () => {
    setActionBusy('revalidate')
    setBanner(null)
    try {
      const res = await apiFetch('/api/questions/admin/translations/revalidate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 500 }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.status === 'success') {
        setBanner({
          type: 'success',
          text: `Validated ${json.data.checked} translations: ${json.data.validCount} valid, ${json.data.flaggedForRecovery} queued for recovery.`,
        })
        await loadStats()
      } else {
        setBanner({ type: 'error', text: json.message || 'Revalidation failed.' })
      }
    } finally {
      setActionBusy(null)
    }
  }

  const hasIssues = summary.pending > 0 || summary.failed > 0 || summary.needsReview > 0

  return (
    <section
      className="glass"
      style={{
        marginBottom: '1.25rem',
        padding: '1rem 1.2rem',
        borderRadius: '16px',
        border: `1px solid ${hasIssues ? 'rgba(251, 191, 36, 0.35)' : 'rgba(52, 211, 153, 0.3)'}`,
        background: 'rgba(13, 20, 38, 0.82)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
      }}
    >
      {/* Compact Header Strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Languages size={20} style={{ color: '#ffd700' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#f8fafc' }}>
                Bilingual Translation Control Center (EN → TA)
              </h3>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.16rem 0.55rem',
                  borderRadius: '9999px',
                  background: summary.completionPercentage >= 100 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(245, 158, 11, 0.18)',
                  color: summary.completionPercentage >= 100 ? '#6ee7b7' : '#fcd34d',
                }}
              >
                {summary.completionPercentage}% Ready ({summary.fullyTranslated}/{summary.totalEnglish})
              </span>
              {(summary.workerActive || summary.queueDepth > 0) && (
                <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700 }}>
                  ● Worker Active ({summary.queueDepth} queued)
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '0.15rem' }}>
              Cache Hit Rate: <strong style={{ color: '#38bdf8' }}>{summary.cacheHitRate}%</strong> • Pending:{' '}
              <strong>{summary.pending}</strong> • Failed: <strong style={{ color: '#fca5a5' }}>{summary.failed}</strong> • Needs Review:{' '}
              <strong style={{ color: '#fbbf24' }}>{summary.needsReview}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="admin-action-outline-btn"
            onClick={() => void handleTranslateMissing()}
            disabled={actionBusy !== null}
          >
            {actionBusy === 'missing' ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
            <span>Translate Missing</span>
          </button>
          <button
            type="button"
            className="admin-action-outline-btn"
            onClick={() => void handleRetryFailed()}
            disabled={actionBusy !== null}
          >
            {actionBusy === 'retry' ? <Loader2 size={13} className="spin" /> : <RotateCcw size={13} />}
            <span>Retry Failed</span>
          </button>
          <button
            type="button"
            className="admin-action-outline-btn"
            onClick={() => void handleRevalidate()}
            disabled={actionBusy !== null}
          >
            {actionBusy === 'revalidate' ? <Loader2 size={13} className="spin" /> : <ShieldCheck size={13} />}
            <span>Revalidate</span>
          </button>
          <button
            type="button"
            className="admin-action-outline-btn"
            onClick={() => setExpanded((e) => !e)}
          >
            <span>{expanded ? 'Hide Details' : 'Inspect Queue & Errors'}</span>
          </button>
        </div>
      </div>

      {banner && (
        <div
          style={{
            padding: '0.58rem 0.85rem',
            borderRadius: '10px',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: banner.type === 'success' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)',
            border: `1px solid ${banner.type === 'success' ? 'rgba(52, 211, 153, 0.35)' : 'rgba(248, 113, 113, 0.4)'}`,
            color: banner.type === 'success' ? '#6ee7b7' : '#fca5a5',
          }}
        >
          {banner.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{banner.text}</span>
        </div>
      )}

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingTop: '0.25rem' }}>
          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', alignItems: 'center' }}>
            <select
              className="admin-help-select"
              style={{ width: '150px' }}
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="all">All Groups</option>
              <option value="group1">Group 1</option>
              <option value="group2_2a">Group 2 &amp; 2A</option>
              <option value="group4">Group 4</option>
            </select>

            <select
              className="admin-help-select"
              style={{ width: '185px' }}
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <option value="all">All Subjects</option>
              {availableSubjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              className="admin-help-select"
              style={{ width: '140px' }}
              value={standardFilter}
              onChange={(e) => setStandardFilter(e.target.value)}
            >
              <option value="all">All Standards</option>
              {[6, 7, 8, 9, 10, 11, 12].map((std) => (
                <option key={std} value={String(std)}>{std}th Std</option>
              ))}
            </select>

            <select
              className="admin-help-select"
              style={{ width: '175px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="INCOMPLETE">Missing &amp; Failed</option>
              <option value="PENDING">Pending Only</option>
              <option value="RETRY_PENDING">Retry Pending</option>
              <option value="NEEDS_REVIEW">Needs Manual Review</option>
              <option value="COMPLETED">Completed</option>
            </select>

            <button
              type="button"
              className="admin-action-outline-btn"
              onClick={() => void loadStats()}
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'spinning' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Failed / Missing Questions Table */}
          <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.14)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', color: '#e2e8f0' }}>
              <thead>
                <tr style={{ background: 'rgba(11, 17, 32, 0.92)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem 0.7rem' }}>Q-ID</th>
                  <th style={{ padding: '0.6rem 0.7rem' }}>Subject / Std</th>
                  <th style={{ padding: '0.6rem 0.7rem' }}>Question Preview</th>
                  <th style={{ padding: '0.6rem 0.7rem' }}>Status</th>
                  <th style={{ padding: '0.6rem 0.7rem' }}>Error Log</th>
                  <th style={{ padding: '0.6rem 0.7rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '1.25rem', textAlign: 'center', color: '#94a3b8' }}>
                      No questions match the selected translation filter.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.questionId} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                      <td style={{ padding: '0.55rem 0.7rem', fontWeight: 700, color: '#fde047' }}>
                        #{item.questionId}
                      </td>
                      <td style={{ padding: '0.55rem 0.7rem', whiteSpace: 'nowrap' }}>
                        {item.subject} {item.standard ? `• ${item.standard}th` : ''}
                      </td>
                      <td style={{ padding: '0.55rem 0.7rem', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.questionPreview}
                      </td>
                      <td style={{ padding: '0.55rem 0.7rem', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '0.14rem 0.48rem',
                            borderRadius: '9999px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background:
                              item.translationStatus === 'approved' || item.translationStatus === 'COMPLETED'
                                ? 'rgba(16, 185, 129, 0.16)'
                                : item.translationStatus === 'NEEDS_REVIEW'
                                  ? 'rgba(239, 68, 68, 0.16)'
                                  : 'rgba(245, 158, 11, 0.16)',
                            color:
                              item.translationStatus === 'approved' || item.translationStatus === 'COMPLETED'
                                ? '#6ee7b7'
                                : item.translationStatus === 'NEEDS_REVIEW'
                                  ? '#fca5a5'
                                  : '#fcd34d',
                          }}
                        >
                          {item.translationStatus}
                        </span>
                      </td>
                      <td style={{ padding: '0.55rem 0.7rem', color: '#fca5a5', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.lastError || ''}>
                        {item.lastError || '—'}
                      </td>
                      <td style={{ padding: '0.55rem 0.7rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="admin-action-outline-btn"
                          style={{ height: '26px', fontSize: '0.72rem', padding: '0 0.55rem' }}
                          onClick={() => void handleRetryFailed([item.questionId])}
                          disabled={actionBusy !== null}
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

export default AdminTranslationControlCenter
