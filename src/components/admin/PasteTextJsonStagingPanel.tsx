import React, { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Upload,
  XCircle,
} from 'lucide-react'
import { apiFetch } from '../../utils/api'

export interface PasteConvertedQuestion {
  sourceOrder: number
  originalNumber: string
  sourceQuestionId: string
  question: string
  questionText: string
  options: string[]
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  optionE?: string | null
  originalAnswerText?: string | null
  correctAnswer: number | null
  correctAnswerLetter: 'A' | 'B' | 'C' | 'D' | 'E' | null
  explanation: string
  rawSourceBlock: string
  valid: boolean
  issues: string[]
  category: string
  subject: string
  classId: number | null
  unitId: number
  lessonTitle: string
  lessonId: string | null
  topic: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  language: 'english' | 'tamil' | 'bilingual'
  targetSystem: 'study_materials' | 'main_practice'
  sourceReference: string | null
  sourceType: 'paste_text_json'
}

export interface PastePreambleItem {
  lineNumber: number
  category: 'document_title' | 'instructions' | 'source_metadata' | 'unrecognized'
  text: string
}

export interface PasteConversionSession {
  sessionId: string | null
  sourceSha256: string
  charCount: number
  expectedQuestions: number
  estimatedQuestions?: number
  detectedQuestions: number
  validQuestions: number
  invalidQuestions: number
  missingAnswers: number
  missingOptions: number
  duplicateOriginalNumbers: string[]
  preambleItems?: PastePreambleItem[]
  unrecognizedBoundaries?: string[]
  countMismatch: boolean
  canStage: boolean
  errors: string[]
  warnings: string[]
  questions: PasteConvertedQuestion[]
}

type ItemUploadStatus = 'pending' | 'processing' | 'staged' | 'failed'

interface ItemProgressState {
  status: ItemUploadStatus
  questionId: number | null
  error: string | null
}

interface Props {
  token: string
  session: PasteConversionSession
  batchSize: number
  apiBasePath?: string
  destinationLabel?: string
  onRevalidate: () => void
  revalidating: boolean
  onSessionUpdated?: (updated: PasteConversionSession) => void
  onSavedToQuestionBank?: (insertedIds: number[], insertedCount: number) => void
  onSavedToPreviousPaper?: (paperId: number, stagedCount: number) => void
  onViewInQuestionBank?: () => void
}

const PREVIEW_PAGE_SIZE = 20

export const PasteTextJsonStagingPanel: React.FC<Props> = ({
  token,
  session,
  batchSize,
  apiBasePath = '/api/questions/paste-import',
  destinationLabel = 'Question Bank STAGING',
  onRevalidate,
  revalidating,
  onSessionUpdated,
  onSavedToQuestionBank,
  onSavedToPreviousPaper,
  onViewInQuestionBank,
}) => {
  const authHeaders = { Authorization: `Bearer ${token}` }
  const [updatingExpected, setUpdatingExpected] = useState(false)
  const [updatingOrder, setUpdatingOrder] = useState<number | null>(null)
  const [stagedPaperId, setStagedPaperId] = useState<number | null>(null)

  const [showRawJson, setShowRawJson] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)
  const [previewPage, setPreviewPage] = useState(1)
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'invalid'>('all')

  // Sequential upload progress state
  const [uploading, setUploading] = useState(false)
  const [paused, setPaused] = useState(false)
  const pauseRequestedRef = useRef(false)
  const [currentOrder, setCurrentOrder] = useState<number | null>(null)
  const [uploadStarted, setUploadStarted] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [itemProgress, setItemProgress] = useState<Record<number, ItemProgressState>>(() => {
    const init: Record<number, ItemProgressState> = {}
    for (const q of session.questions) {
      init[q.sourceOrder] = {
        status: q.valid ? 'pending' : 'failed',
        questionId: null,
        error: q.valid ? null : q.issues.join('; '),
      }
    }
    return init
  })

  // Canonical JSON payload representing the exact frozen snapshot
  const canonicalJsonText = useMemo(() => {
    const exportPayload = {
      sessionId: session.sessionId,
      sourceSha256: session.sourceSha256,
      expectedQuestions: session.expectedQuestions,
      detectedQuestions: session.detectedQuestions,
      questions: session.questions.map((q) => ({
        originalNumber: q.originalNumber,
        sourceOrder: q.sourceOrder,
        sourceQuestionId: q.sourceQuestionId,
        question: q.question,
        questionText: q.questionText,
        options: q.options,
        originalAnswerText: q.originalAnswerText ?? null,
        correctAnswer: q.correctAnswerLetter,
        correctAnswerIndex: q.correctAnswer,
        explanation: q.explanation,
        category: q.category,
        subject: q.subject,
        classId: q.classId,
        unitId: q.unitId,
        lessonTitle: q.lessonTitle,
        lessonId: q.lessonId,
        topic: q.topic,
        difficulty: q.difficulty,
        language: q.language,
        targetSystem: q.targetSystem,
      })),
    }
    return JSON.stringify(exportPayload, null, 2)
  }, [session])

  const filteredPreview = useMemo(() => {
    return session.questions.filter((q) => {
      if (previewFilter === 'valid') return q.valid
      if (previewFilter === 'invalid') return !q.valid
      return true
    })
  }, [session.questions, previewFilter])

  const totalPages = Math.max(1, Math.ceil(filteredPreview.length / PREVIEW_PAGE_SIZE))
  const safePage = Math.min(previewPage, totalPages)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PREVIEW_PAGE_SIZE
    return filteredPreview.slice(start, start + PREVIEW_PAGE_SIZE)
  }, [filteredPreview, safePage])

  // Real-time counters
  const stats = useMemo(() => {
    let staged = 0
    let failed = 0
    let pending = 0
    let processing = 0
    const failedNumbers: string[] = []
    const stagedIds: number[] = []

    for (const q of session.questions) {
      const st = itemProgress[q.sourceOrder]
      const status = st?.status || 'pending'
      if (status === 'staged') {
        staged++
        if (st?.questionId) stagedIds.push(st.questionId)
      } else if (status === 'failed') {
        failed++
        failedNumbers.push(`#${q.originalNumber} (pos ${q.sourceOrder})`)
      } else if (status === 'processing') {
        processing++
      } else {
        pending++
      }
    }

    const total = session.questions.length
    const remaining = pending + processing
    const progressPct = total > 0 ? Math.round((staged / total) * 100) : 0

    return { total, staged, failed, pending, processing, remaining, progressPct, failedNumbers, stagedIds }
  }, [session.questions, itemProgress])

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(canonicalJsonText)
      setCopiedJson(true)
      window.setTimeout(() => setCopiedJson(false), 2000)
    } catch {
      setUploadError('Unable to copy JSON to clipboard.')
    }
  }

  const handleDownloadJson = () => {
    const blob = new Blob([canonicalJsonText], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tnpsc-paste-mcqs-${session.sessionId || 'preview'}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const runSequentialUpload = async (ordersToProcess: number[], allowValidOnly = false) => {
    if (!session.sessionId || (!session.canStage && !allowValidOnly) || ordersToProcess.length === 0) return

    setUploading(true)
    setPaused(false)
    setUploadStarted(true)
    setUploadError(null)
    pauseRequestedRef.current = false

    // Strictly ordered ascending sourceOrder
    const ordered = [...ordersToProcess].sort((a, b) => a - b)
    const effectiveChunk = Math.max(1, Math.min(25, Number(batchSize) || 1))
    const newlyStagedIds: number[] = []
    let latestPaperId: number | null = stagedPaperId

    try {
      for (let i = 0; i < ordered.length; i += effectiveChunk) {
        if (pauseRequestedRef.current) {
          setPaused(true)
          break
        }

        const chunk = ordered.slice(i, i + effectiveChunk)
        setCurrentOrder(chunk[0])

        setItemProgress((prev) => {
          const next = { ...prev }
          for (const ord of chunk) {
            next[ord] = { ...(next[ord] || { questionId: null, error: null }), status: 'processing' }
          }
          return next
        })

        try {
          const res = await apiFetch(
            `${apiBasePath}/sessions/${encodeURIComponent(session.sessionId)}/stage-next`,
            {
              method: 'POST',
              headers: { ...authHeaders, 'Content-Type': 'application/json' },
              timeoutMs: 60000,
              body: JSON.stringify({ sourceOrders: chunk, allowValidOnly }),
            }
          )
          const json = await res.json().catch(() => ({}))

          if (!res.ok || json.status !== 'success' || !Array.isArray(json.data?.results)) {
            const errMsg = json.message || `Batch starting at Q${chunk[0]} failed (HTTP ${res.status})`
            setItemProgress((prev) => {
              const next = { ...prev }
              for (const ord of chunk) {
                next[ord] = { status: 'failed', questionId: null, error: errMsg }
              }
              return next
            })
            setUploadError(errMsg)
            continue
          }

          if (json.data?.paperId) {
            latestPaperId = Number(json.data.paperId)
            setStagedPaperId(latestPaperId)
          }

          setItemProgress((prev) => {
            const next = { ...prev }
            for (const r of json.data.results) {
              next[r.sourceOrder] = {
                status: r.status === 'staged' ? 'staged' : 'failed',
                questionId: r.questionId ?? null,
                error: r.error ?? null,
              }
              if (r.status === 'staged' && r.questionId && !r.alreadyStaged) {
                newlyStagedIds.push(r.questionId)
              }
            }
            return next
          })
        } catch (err: any) {
          const errMsg = err?.message || 'Network error during sequential staging'
          setItemProgress((prev) => {
            const next = { ...prev }
            for (const ord of chunk) {
              next[ord] = { status: 'failed', questionId: null, error: errMsg }
            }
            return next
          })
          setUploadError(errMsg)
        }
      }
    } finally {
      setUploading(false)
      setCurrentOrder(null)
      if (newlyStagedIds.length > 0) {
        onSavedToQuestionBank?.(newlyStagedIds, newlyStagedIds.length)
        if (latestPaperId) {
          onSavedToPreviousPaper?.(latestPaperId, newlyStagedIds.length)
        }
      }
    }
  }

  const handleContinueToStaging = (allowValidOnly = false) => {
    const pendingOrders = session.questions
      .filter((q) => q.valid && (itemProgress[q.sourceOrder]?.status || 'pending') === 'pending')
      .map((q) => q.sourceOrder)
    void runSequentialUpload(pendingOrders, allowValidOnly)
  }

  const handleRetryFailed = () => {
    const failedOrders = session.questions
      .filter((q) => q.valid && itemProgress[q.sourceOrder]?.status === 'failed')
      .map((q) => q.sourceOrder)
    void runSequentialUpload(failedOrders, session.invalidQuestions > 0)
  }

  const handleConfirmExpectedCount = async () => {
    if (!session.sessionId || updatingExpected) return
    setUpdatingExpected(true)
    setUploadError(null)
    try {
      const res = await apiFetch(
        `${apiBasePath}/sessions/${encodeURIComponent(session.sessionId)}/expected-count`,
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedQuestions: session.detectedQuestions }),
        }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setUploadError(json.message || 'Failed to update Expected Questions Count.')
        return
      }
      const nextErrors = session.errors.filter((e) => !/^Expected \d+ question\(s\), but detected \d+/i.test(e))
      onSessionUpdated?.({
        ...session,
        expectedQuestions: session.detectedQuestions,
        countMismatch: false,
        canStage: Boolean(json.data?.canStage),
        errors: nextErrors,
      })
    } finally {
      setUpdatingExpected(false)
    }
  }

  const handleAssignAnswerInline = async (sourceOrder: number, answerIdx: number) => {
    if (!session.sessionId || updatingOrder !== null) return
    setUpdatingOrder(sourceOrder)
    setUploadError(null)
    try {
      const res = await apiFetch(
        `${apiBasePath}/sessions/${encodeURIComponent(session.sessionId)}/items/${sourceOrder}`,
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ correctAnswer: answerIdx }),
        }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success' || !json.data?.updatedItem) {
        setUploadError(json.message || `Failed to update Q${sourceOrder}.`)
        return
      }
      const updatedItem: PasteConvertedQuestion = json.data.updatedItem
      const nextQuestions = session.questions.map((q) => (q.sourceOrder === sourceOrder ? updatedItem : q))
      const nextInvalid = Number(json.data.invalidQuestions ?? 0)
      const nextErrors = session.errors.filter((e) => !/question\(s\) failed validation/i.test(e))
      if (nextInvalid > 0) {
        nextErrors.push(`${nextInvalid} question(s) still require review before staging.`)
      }
      setItemProgress((prev) => ({
        ...prev,
        [sourceOrder]: { status: updatedItem.valid ? 'pending' : 'failed', questionId: null, error: null },
      }))
      onSessionUpdated?.({
        ...session,
        questions: nextQuestions,
        validQuestions: Number(json.data.validQuestions ?? session.validQuestions),
        invalidQuestions: nextInvalid,
        missingAnswers: Number(json.data.missingAnswers ?? session.missingAnswers),
        canStage: Boolean(json.data.canStage),
        errors: nextErrors,
      })
    } finally {
      setUpdatingOrder(null)
    }
  }

  const handlePauseUpload = () => {
    pauseRequestedRef.current = true
  }

  const isComplete = uploadStarted && !uploading && stats.remaining === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* SECTION A: EXACT COUNT & VALIDATION REPORT */}
      <div className="pypm-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
          <h3 className="pypm-section-heading" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>
            <Code2 size={18} style={{ color: '#38bdf8' }} />
            <span>Paste Text → Exact Structural JSON Conversion &amp; Validation</span>
          </h3>
          {session.sessionId && (
            <span style={{ fontSize: '0.73rem', color: '#94a3b8', fontFamily: 'monospace' }}>
              Session: <strong style={{ color: '#e2e8f0' }}>{session.sessionId}</strong>
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: '0.55rem' }}>
          {[
            { label: 'Expected Questions', value: session.expectedQuestions, color: '#94a3b8' },
            { label: 'Estimated Questions', value: session.estimatedQuestions ?? session.detectedQuestions, color: '#7dd3fc' },
            {
              label: 'Detected Questions',
              value: session.detectedQuestions,
              color: session.countMismatch ? '#f87171' : '#38bdf8',
            },
            { label: 'Valid Questions', value: session.validQuestions, color: '#34d399' },
            {
              label: 'Invalid Questions',
              value: session.invalidQuestions,
              color: session.invalidQuestions > 0 ? '#f87171' : '#64748b',
            },
            {
              label: 'Missing Answers',
              value: session.missingAnswers,
              color: session.missingAnswers > 0 ? '#fbbf24' : '#64748b',
            },
            {
              label: 'Missing Options',
              value: session.missingOptions,
              color: session.missingOptions > 0 ? '#fbbf24' : '#64748b',
            },
            {
              label: 'Duplicate Numbers',
              value: session.duplicateOriginalNumbers.length,
              color: session.duplicateOriginalNumbers.length > 0 ? '#c084fc' : '#64748b',
            },
            {
              label: 'Unrecognized Lines',
              value: session.unrecognizedBoundaries?.length ?? 0,
              color: (session.unrecognizedBoundaries?.length ?? 0) > 0 ? '#fbbf24' : '#64748b',
            },
          ].map((stat) => (
            <div key={stat.label} className="pypm-preview-stat">
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{stat.label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {session.countMismatch && session.detectedQuestions > 0 && (
          <div
            style={{
              padding: '0.75rem 0.95rem',
              borderRadius: '10px',
              background: 'rgba(245,158,11,0.14)',
              border: '1px solid rgba(251,191,36,0.45)',
              color: '#fde68a',
              fontSize: '0.82rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.6rem',
            }}
          >
            <div>
              <strong>Expected Count Mismatch:</strong> Expected <strong>{session.expectedQuestions}</strong>, but detected{' '}
              <strong>{session.detectedQuestions}</strong> complete question(s). All {session.detectedQuestions} questions are preserved without truncation.
            </div>
            <button
              type="button"
              className="pypm-btn pypm-btn-purple pypm-btn-sm"
              disabled={updatingExpected || uploading}
              onClick={() => void handleConfirmExpectedCount()}
            >
              {updatingExpected ? <Loader2 size={13} className="pypm-spin" /> : <CheckCircle2 size={13} />}
              <span>Confirm &amp; Update Expected Count to {session.detectedQuestions}</span>
            </button>
          </div>
        )}

        {session.preambleItems && session.preambleItems.length > 0 && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '10px',
              background: 'rgba(15,23,42,0.75)',
              border: '1px solid rgba(148,163,184,0.22)',
              fontSize: '0.76rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
            }}
          >
            <div style={{ fontWeight: 700, color: '#cbd5e1' }}>
              Document Preamble Detected Before Question 1 ({session.preambleItems.length} line(s) — kept separate from Q1):
            </div>
            {session.preambleItems.map((p) => (
              <div key={p.lineNumber} style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', color: '#94a3b8' }}>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    padding: '0.08rem 0.4rem',
                    borderRadius: '999px',
                    background:
                      p.category === 'document_title'
                        ? 'rgba(56,189,248,0.16)'
                        : p.category === 'source_metadata'
                          ? 'rgba(16,185,129,0.16)'
                          : p.category === 'instructions'
                            ? 'rgba(168,85,247,0.18)'
                            : 'rgba(245,158,11,0.18)',
                    color:
                      p.category === 'document_title'
                        ? '#7dd3fc'
                        : p.category === 'source_metadata'
                          ? '#6ee7b7'
                          : p.category === 'instructions'
                            ? '#d8b4fe'
                            : '#fcd34d',
                    flexShrink: 0,
                  }}
                >
                  {p.category.replace('_', ' ')}
                </span>
                <span style={{ color: '#e2e8f0' }}>{p.text}</span>
              </div>
            ))}
          </div>
        )}

        {session.errors.length > 0 && (
          <div
            style={{
              padding: '0.75rem 0.95rem',
              borderRadius: '10px',
              background: 'rgba(239,68,68,0.14)',
              border: '1px solid rgba(248,113,113,0.45)',
              color: '#fca5a5',
              fontSize: '0.82rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
            }}
          >
            {session.errors.map((err, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                <XCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}

        {session.warnings.length > 0 && (
          <div
            style={{
              padding: '0.65rem 0.9rem',
              borderRadius: '10px',
              background: 'rgba(245,158,11,0.13)',
              border: '1px solid rgba(251,191,36,0.38)',
              color: '#fcd34d',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            {session.warnings.map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* ACTION BAR: Preview JSON | Download | Copy | Re-validate | Continue to Staging Upload */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.55rem' }}>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="pypm-btn pypm-btn-secondary pypm-btn-sm"
              onClick={() => setShowRawJson((p) => !p)}
            >
              <Code2 size={14} /> {showRawJson ? 'Hide Raw JSON' : 'Preview JSON'}
            </button>
            <button
              type="button"
              className="pypm-btn pypm-btn-secondary pypm-btn-sm"
              onClick={handleDownloadJson}
            >
              <Download size={14} /> Download Generated JSON
            </button>
            <button
              type="button"
              className="pypm-btn pypm-btn-secondary pypm-btn-sm"
              onClick={() => void handleCopyJson()}
            >
              <Copy size={14} /> {copiedJson ? 'Copied!' : 'Copy JSON'}
            </button>
            <button
              type="button"
              className="pypm-btn pypm-btn-secondary pypm-btn-sm"
              onClick={onRevalidate}
              disabled={revalidating || uploading}
            >
              {revalidating ? <Loader2 size={14} className="pypm-spin" /> : <RefreshCw size={14} />}
              <span>Re-validate</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {!session.countMismatch && session.invalidQuestions > 0 && session.validQuestions > 0 && stats.pending > 0 && (
              <button
                type="button"
                className="pypm-btn pypm-btn-purple"
                disabled={uploading}
                onClick={() => handleContinueToStaging(true)}
              >
                {uploading ? <Loader2 size={15} className="pypm-spin" /> : <Upload size={15} />}
                <span>Stage {stats.pending} Valid Only (Skip {session.invalidQuestions} Unresolved)</span>
              </button>
            )}
            <button
              type="button"
              className="pypm-btn pypm-btn-primary"
              disabled={!session.canStage || uploading || stats.pending === 0}
              onClick={() => handleContinueToStaging(false)}
            >
              {uploading ? <Loader2 size={15} className="pypm-spin" /> : <Upload size={15} />}
              <span>
                {uploading
                  ? `Staging Q${currentOrder ?? ''}...`
                  : stats.staged > 0 && stats.pending > 0
                    ? `Resume Staging Upload (${stats.pending} Remaining)`
                    : `Continue to Staging Upload (${session.validQuestions} Qs)`}
              </span>
            </button>
          </div>
        </div>

        {/* RAW JSON VIEWER */}
        {showRawJson && (
          <pre
            style={{
              maxHeight: '320px',
              overflow: 'auto',
              padding: '0.85rem',
              borderRadius: '10px',
              background: 'rgba(2,6,23,0.9)',
              border: '1px solid rgba(56,189,248,0.28)',
              color: '#bae6fd',
              fontSize: '0.75rem',
              lineHeight: 1.5,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {canonicalJsonText}
          </pre>
        )}
      </div>

      {/* SECTION B: REAL-TIME SEQUENTIAL STAGING UPLOAD PROGRESS & COMPLETION REPORT */}
      {uploadStarted && (
        <div className="pypm-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.55rem' }}>
            <h3 className="pypm-section-heading" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>
              {uploading ? <Loader2 size={18} className="pypm-spin" style={{ color: '#38bdf8' }} /> : <CheckCircle2 size={18} style={{ color: stats.failed > 0 ? '#fbbf24' : '#34d399' }} />}
              <span>
                {uploading
                  ? `Sequential Staging Upload in Progress — Current Question: #${currentOrder ?? '-'}`
                  : isComplete
                    ? 'Sequential Staging Upload Completion Report'
                    : paused
                      ? 'Sequential Staging Upload Paused'
                      : 'Sequential Staging Upload Status'}
              </span>
            </h3>

            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              {uploading && (
                <button type="button" className="pypm-btn pypm-btn-danger pypm-btn-sm" onClick={handlePauseUpload}>
                  <Pause size={13} /> Pause
                </button>
              )}
              {!uploading && stats.pending > 0 && (
                <button
                  type="button"
                  className="pypm-btn pypm-btn-primary pypm-btn-sm"
                  onClick={() => handleContinueToStaging(session.invalidQuestions > 0)}
                >
                  <Play size={13} /> Resume Upload ({stats.pending})
                </button>
              )}
              {!uploading && stats.failed > 0 && (
                <button type="button" className="pypm-btn pypm-btn-purple pypm-btn-sm" onClick={handleRetryFailed}>
                  <RotateCcw size={13} /> Retry Failed ({stats.failed})
                </button>
              )}
              {!uploading && stats.staged > 0 && onViewInQuestionBank && (
                <button type="button" className="pypm-btn pypm-btn-secondary pypm-btn-sm" onClick={onViewInQuestionBank}>
                  <ExternalLink size={13} /> Open Staging Review
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#cbd5e1' }}>
              <span>
                Progress: <strong style={{ color: '#34d399' }}>{stats.progressPct}%</strong> ({stats.staged}/{stats.total} Staged)
              </span>
              {currentOrder !== null && (
                <span>Current Question: <strong style={{ color: '#38bdf8' }}>{currentOrder}</strong></span>
              )}
            </div>
            <div style={{ width: '100%', height: '8px', borderRadius: '999px', background: 'rgba(148,163,184,0.18)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${stats.progressPct}%`,
                  height: '100%',
                  background: stats.failed > 0 ? 'linear-gradient(90deg, #34d399, #fbbf24)' : 'linear-gradient(90deg, #38bdf8, #34d399)',
                  transition: 'width 200ms ease',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.55rem' }}>
            {[
              { label: 'Total Questions', value: stats.total, color: '#e2e8f0' },
              { label: 'Successfully Staged', value: stats.staged, color: '#34d399' },
              { label: 'Failed', value: stats.failed, color: stats.failed > 0 ? '#f87171' : '#64748b' },
              { label: 'Remaining', value: stats.remaining, color: stats.remaining > 0 ? '#38bdf8' : '#64748b' },
            ].map((m) => (
              <div key={m.label} className="pypm-preview-stat">
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{m.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {uploadError && (
            <div style={{ fontSize: '0.78rem', color: '#fca5a5' }}>
              Latest error: {uploadError}
            </div>
          )}

          {stats.failedNumbers.length > 0 && (
            <div style={{ fontSize: '0.78rem', color: '#fca5a5' }}>
              Failed Questions ({stats.failedNumbers.length}): <strong>{stats.failedNumbers.slice(0, 25).join(', ')}</strong>
            </div>
          )}

          {isComplete && stats.staged > 0 && (
            <div
              style={{
                padding: '0.75rem 0.95rem',
                borderRadius: '10px',
                background: 'rgba(16,185,129,0.13)',
                border: '1px solid rgba(52,211,153,0.38)',
                color: '#6ee7b7',
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
              }}
            >
              <div>
                <strong>PostgreSQL Staging Confirmed ({destinationLabel}):</strong> <strong>{stats.staged}</strong> record(s) committed with <code>status = &apos;staging&apos;</code>
                {stagedPaperId ? <> in Examination <strong>#{stagedPaperId}</strong></> : null} (Session <code>{session.sessionId}</code>). Questions are <strong>NOT published automatically</strong>.
              </div>
              {stats.stagedIds.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#a7f3d0', fontFamily: 'monospace' }}>
                  Inserted DB IDs ({stats.stagedIds.length}): #{stats.stagedIds[0]}
                  {stats.stagedIds.length > 1 ? ` – #${stats.stagedIds[stats.stagedIds.length - 1]}` : ''}
                </div>
              )}
            </div>
          )}
          {isComplete && stats.staged === 0 && stats.failed > 0 && (
            <div
              style={{
                padding: '0.75rem 0.95rem',
                borderRadius: '10px',
                background: 'rgba(239,68,68,0.14)',
                border: '1px solid rgba(248,113,113,0.45)',
                color: '#fca5a5',
                fontSize: '0.82rem',
              }}
            >
              <strong>0 questions were inserted into PostgreSQL staging.</strong> {stats.failed} question(s) failed — inspect the errors below before retrying.
            </div>
          )}
        </div>
      )}

      {/* SECTION C: SEQUENTIAL QUESTION PREVIEW TABLE */}
      <div className="pypm-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.55rem' }}>
          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc' }}>
            Sequential Question Preview ({filteredPreview.length} of {session.detectedQuestions})
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {(['all', 'valid', 'invalid'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`pypm-btn pypm-btn-sm ${previewFilter === f ? 'pypm-btn-purple' : 'pypm-btn-secondary'}`}
                onClick={() => {
                  setPreviewFilter(f)
                  setPreviewPage(1)
                }}
              >
                {f === 'all' ? `All (${session.detectedQuestions})` : f === 'valid' ? `Valid (${session.validQuestions})` : `Invalid (${session.invalidQuestions})`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '420px', overflowY: 'auto' }}>
          {pageItems.map((q) => {
            const prog = itemProgress[q.sourceOrder]
            const st: ItemUploadStatus = prog?.status || (q.valid ? 'pending' : 'failed')
            const badgeColor =
              st === 'staged'
                ? '#34d399'
                : st === 'processing'
                  ? '#38bdf8'
                  : st === 'failed'
                    ? '#f87171'
                    : '#94a3b8'

            return (
              <div
                key={q.sourceOrder}
                style={{
                  padding: '0.7rem 0.85rem',
                  borderRadius: '10px',
                  background: 'rgba(15,23,42,0.82)',
                  border: `1px solid ${!q.valid || st === 'failed' ? 'rgba(248,113,113,0.42)' : st === 'staged' ? 'rgba(52,211,153,0.38)' : 'rgba(148,163,184,0.2)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.32rem',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                    <span style={{ color: '#38bdf8', marginRight: '0.45rem' }}>Seq #{q.sourceOrder}</span>
                    <span style={{ color: '#fde047', marginRight: '0.45rem' }}>(Orig Q{q.originalNumber})</span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '0.14rem 0.5rem',
                      borderRadius: '999px',
                      color: badgeColor,
                      background: 'rgba(2,6,23,0.65)',
                      border: `1px solid ${badgeColor}55`,
                      textTransform: 'uppercase',
                    }}
                  >
                    {st === 'staged' && prog?.questionId ? `STAGED (#${prog.questionId})` : st}
                  </span>
                </div>

                <div style={{ color: '#f1f5f9', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {q.questionText || '(Empty question text)'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.25rem 0.75rem', color: '#cbd5e1', fontSize: '0.76rem' }}>
                  {(q.options.length >= 5 ? (['A', 'B', 'C', 'D', 'E'] as const) : (['A', 'B', 'C', 'D'] as const)).map((ltr, idx) => (
                    <div
                      key={ltr}
                      style={{
                        color: q.correctAnswer === idx ? '#34d399' : '#cbd5e1',
                        fontWeight: q.correctAnswer === idx ? 700 : 400,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {ltr}) {q.options[idx] || '— (Missing)'}
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  Correct Answer:{' '}
                  <strong style={{ color: q.correctAnswerLetter ? '#34d399' : '#f87171' }}>
                    {q.correctAnswerLetter || 'MISSING'}
                  </strong>
                  {q.originalAnswerText && (
                    <span style={{ marginLeft: '0.5rem', color: '#64748b' }}>
                      (Source: <code>{q.originalAnswerText}</code>)
                    </span>
                  )}
                  {q.explanation && (
                    <div style={{ marginTop: '0.2rem', color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                      <strong style={{ color: '#94a3b8' }}>Explanation:</strong> {q.explanation}
                    </div>
                  )}
                </div>

                {(q.issues.length > 0 || prog?.error) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.74rem', color: '#fca5a5' }}>
                      {prog?.error || q.issues.join(' · ')}
                    </div>
                    {!q.valid && q.correctAnswer === null && q.options.slice(0, 4).every((o) => Boolean(o)) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.72rem', color: '#fde047', fontWeight: 600 }}>
                          Admin Review — Assign Verified Answer (preserves all valid questions):
                        </span>
                        {(['A', 'B', 'C', 'D'] as const).map((ltr, ansIdx) => (
                          <button
                            key={ltr}
                            type="button"
                            className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                            disabled={updatingOrder === q.sourceOrder || uploading}
                            onClick={() => void handleAssignAnswerInline(q.sourceOrder, ansIdx)}
                          >
                            {updatingOrder === q.sourceOrder ? <Loader2 size={12} className="pypm-spin" /> : null}
                            Set {ltr}
                          </button>
                        ))}
                      </div>
                    )}
                    {!q.valid && q.rawSourceBlock && (
                      <pre
                        style={{
                          margin: 0,
                          padding: '0.45rem 0.6rem',
                          borderRadius: '6px',
                          background: 'rgba(2,6,23,0.75)',
                          border: '1px solid rgba(248,113,113,0.28)',
                          color: '#cbd5e1',
                          fontSize: '0.7rem',
                          maxHeight: '110px',
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {q.rawSourceBlock}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
            <span>
              Page {safePage} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                disabled={safePage <= 1}
                onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                type="button"
                className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                disabled={safePage >= totalPages}
                onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PasteTextJsonStagingPanel
