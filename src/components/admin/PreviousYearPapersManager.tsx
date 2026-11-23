import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  ClipboardPaste,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react'
import { apiFetch } from '../../utils/api'
import { notifyStudentSync } from '../../utils/studentSync'
import {
  parsePastedPreviousYearQuestions,
  type ParsedPreviousPaperQuestion,
} from '../../utils/previousPaperPasteParser'
import './PreviousYearPapersManager.css'

interface Props {
  token: string
}

interface PaperSummary {
  id: number
  year: number
  exam: string
  category: 'group1' | 'group2' | 'group2a' | 'group2_2a' | 'group4'
  subjects: string
  paperTitle: string
  paperType: string
  medium: string
  totalQuestions: number
  expectedQuestions: number
  questionCount: number
  flaggedCount: number
  matchedAnswerCount: number
  unverifiedAnswerCount: number
  duplicateCount: number
  approvedQuestionCount: number
  durationMinutes: number
  marksPerQuestion: number
  negativeMarking: number
  status: 'draft' | 'staging' | 'approved' | 'published' | 'unpublished'
  sourceType: string
  publishedAt: string | null
}

interface StagingQuestion {
  id?: number
  questionNumber: number
  originalQuestionNumber: string
  subject: string
  topic: string
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctAnswer: number
  answerStatus: string
  explanation: string
  isDuplicate: boolean
  needsReview: boolean
  reviewNote: string | null
  medium: string
  isApproved: boolean
}

interface StatsData {
  totalPapers: number
  totalQuestionsExtracted: number
  draftPapers: number
  stagingPapers: number
  approvedPapers: number
  publishedPapers: number
  unpublishedPapers: number
  byYear: { year: number; count: number }[]
}

const GROUP_OPTIONS = [
  { value: 'group1', label: 'TNPSC Group 1' },
  { value: 'group2_2a', label: 'TNPSC Group 2 and 2A' },
  { value: 'group4', label: 'TNPSC Group 4' },
]

const STATUS_BADGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  draft: { bg: 'rgba(148,163,184,0.16)', color: '#cbd5e1', border: 'rgba(148,163,184,0.35)' },
  staging: { bg: 'rgba(245,158,11,0.16)', color: '#fbbf24', border: 'rgba(245,158,11,0.38)' },
  approved: { bg: 'rgba(56,189,248,0.16)', color: '#7dd3fc', border: 'rgba(56,189,248,0.38)' },
  published: { bg: 'rgba(16,185,129,0.18)', color: '#34d399', border: 'rgba(16,185,129,0.4)' },
  unpublished: { bg: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: 'rgba(239,68,68,0.35)' },
}

const SAMPLE_PASTE_TEXT = `QUESTION 1:
Which planet is known as the Red Planet?

A) Earth
B) Mars
C) Jupiter
D) Venus

ANSWER: B

EXPLANATION:
Mars is known as the Red Planet because of iron oxide on its surface.

QUESTION 2:
Which is the largest planet in the Solar System?

A) Earth
B) Saturn
C) Jupiter
D) Mars

ANSWER: C

EXPLANATION:
Jupiter is the largest planet in the Solar System.`

export const PreviousYearPapersManager: React.FC<Props> = ({ token }) => {
  const [viewMode, setViewMode] = useState<'dashboard' | 'paste' | 'staging'>('dashboard')
  const [stats, setStats] = useState<StatsData | null>(null)
  const [papers, setPapers] = useState<PaperSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [busyMsg, setBusyMsg] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Dashboard filters
  const [filterGroup, setFilterGroup] = useState<string>('all')
  const [filterYear, setFilterYear] = useState<string>('all')
  const [filterMedium, setFilterMedium] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSearch, setFilterSearch] = useState<string>('')

  // Step 1: Examination Details
  const [uGroup, setUGroup] = useState<string>('group4')
  const [uYear, setUYear] = useState<number>(new Date().getFullYear())
  const [uExamStream, setUExamStream] = useState<string>('TNPSC Group 4')
  const [uPaperTitle, setUPaperTitle] = useState<string>('')
  const [uPaperType, setUPaperType] = useState<string>('Prelims')
  const [uMedium, setUMedium] = useState<string>('English')
  const [uTotalQuestions, setUTotalQuestions] = useState<number>(200)
  const [uMarksPerQ, setUMarksPerQ] = useState<number>(1.5)
  const [uNegMark, setUNegMark] = useState<number>(0)
  const [uDuration, setUDuration] = useState<number>(180)

  // Step 2–5: Paste & Parse Editor
  const [rawPasteText, setRawPasteText] = useState<string>('')
  const [parsedQuestions, setParsedQuestions] = useState<ParsedPreviousPaperQuestion[]>([])
  const [hasParsed, setHasParsed] = useState<boolean>(false)
  const [pasteFilter, setPasteFilter] = useState<'all' | 'review' | 'duplicates' | 'valid'>('all')
  const [savingToStaging, setSavingToStaging] = useState<boolean>(false)

  // Step 6–7: Staging Review & Approval
  const [activePaper, setActivePaper] = useState<PaperSummary | null>(null)
  const [stagingQuestions, setStagingQuestions] = useState<StagingQuestion[]>([])
  const [stagingFilter, setStagingFilter] = useState<'all' | 'review' | 'unapproved' | 'approved'>('all')
  const [savingStaging, setSavingStaging] = useState<boolean>(false)
  const [approving, setApproving] = useState<boolean>(false)

  const authHeaders = { Authorization: `Bearer ${token}` }

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (filterGroup !== 'all') q.set('group', filterGroup)
      if (filterYear !== 'all') q.set('year', filterYear)
      if (filterMedium !== 'all') q.set('medium', filterMedium)
      if (filterStatus !== 'all') q.set('status', filterStatus)
      if (filterSearch.trim()) q.set('search', filterSearch.trim())

      const [statsRes, listRes] = await Promise.all([
        apiFetch('/api/admin/previous-papers/stats', { headers: authHeaders }),
        apiFetch(`/api/admin/previous-papers?${q.toString()}`, { headers: authHeaders }),
      ])
      const statsJson = await statsRes.json().catch(() => ({}))
      const listJson = await listRes.json().catch(() => ({}))
      if (statsRes.ok && statsJson.status === 'success') setStats(statsJson.data)
      if (listRes.ok && listJson.status === 'success') setPapers(listJson.data || [])
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to load Previous Year Papers.' })
    } finally {
      setLoading(false)
    }
  }, [token, filterGroup, filterYear, filterMedium, filterStatus, filterSearch])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const openStagingReview = useCallback(
    async (paperId: number) => {
      setBusyMsg('Loading examination from Staging...')
      setBanner(null)
      try {
        const res = await apiFetch(`/api/admin/previous-papers/${paperId}`, { headers: authHeaders })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.status !== 'success') {
          setBanner({ type: 'error', text: json.message || 'Could not load examination.' })
          return
        }
        setActivePaper(json.data.paper)
        setStagingQuestions(json.data.questions || [])
        setStagingFilter('all')
        setViewMode('staging')
      } catch (err: any) {
        setBanner({ type: 'error', text: err?.message || 'Error loading examination.' })
      } finally {
        setBusyMsg(null)
      }
    },
    [token]
  )

  // Live validation summary for parsed pasted questions
  const pasteSummary = useMemo(() => {
    const totalPasted = parsedQuestions.length
    const missingOptionsCount = parsedQuestions.filter(
      (q) => !q.optionA.trim() || !q.optionB.trim() || !q.optionC.trim() || !q.optionD.trim()
    ).length
    const missingAnswersCount = parsedQuestions.filter((q) => q.correctAnswer === null).length
    const duplicateCount = parsedQuestions.filter((q) => q.isDuplicate).length
    const needsReviewCount = parsedQuestions.filter(
      (q) =>
        !q.questionText.trim() ||
        !q.optionA.trim() ||
        !q.optionB.trim() ||
        !q.optionC.trim() ||
        !q.optionD.trim() ||
        q.correctAnswer === null ||
        q.isDuplicate
    ).length
    const successfullyParsed = totalPasted - needsReviewCount
    return {
      totalPasted,
      successfullyParsed,
      missingOptionsCount,
      missingAnswersCount,
      duplicateCount,
      needsReviewCount,
    }
  }, [parsedQuestions])

  const handleParsePastedText = () => {
    if (!rawPasteText.trim()) {
      setBanner({ type: 'error', text: 'Please paste your Previous Year Questions into the editor first.' })
      return
    }
    setBanner(null)
    const result = parsePastedPreviousYearQuestions(rawPasteText, uPaperTitle.trim() || 'General Studies')
    setParsedQuestions(result.questions)
    setHasParsed(true)
    setPasteFilter('all')
    if (result.questions.length === 0) {
      setBanner({
        type: 'error',
        text: 'No questions could be detected. Ensure each question starts with QUESTION 1: or 1. followed by options A–D.',
      })
    } else {
      setBanner({
        type: 'success',
        text: `Parsed ${result.summary.totalPasted} question(s): ${result.summary.successfullyParsed} valid, ${result.summary.needsReviewCount} requiring review.`,
      })
    }
  }

  const updateParsedRow = (idx: number, patch: Partial<ParsedPreviousPaperQuestion>) => {
    setParsedQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q
        const next = { ...q, ...patch }
        const missingOptions =
          !next.optionA.trim() || !next.optionB.trim() || !next.optionC.trim() || !next.optionD.trim()
        const missingAnswer = next.correctAnswer === null
        const issues: string[] = []
        if (!next.questionText.trim()) issues.push('Question text is empty')
        if (missingOptions) issues.push('Missing one or more options A–D')
        if (missingAnswer) issues.push('Missing or invalid correct answer')
        if (next.isDuplicate) issues.push(`Duplicate of Question #${next.duplicateOfNumber || '?'}`)
        return {
          ...next,
          missingOptions,
          missingAnswer,
          issues,
          needsReview: issues.length > 0,
        }
      })
    )
  }

  const deleteParsedRow = (idx: number) => {
    setParsedQuestions((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((q, newIdx) => ({ ...q, questionNumber: newIdx + 1 }))
    )
  }

  const addManualParsedRow = () => {
    setParsedQuestions((prev) => [
      ...prev,
      {
        clientId: `pyp_manual_${Date.now()}`,
        questionNumber: prev.length + 1,
        originalQuestionNumber: String(prev.length + 1),
        questionText: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctAnswer: null,
        explanation: '',
        subject: uPaperTitle.trim() || 'General Studies',
        topic: '',
        isDuplicate: false,
        duplicateOfNumber: null,
        missingOptions: true,
        missingAnswer: true,
        needsReview: true,
        issues: ['Question text is empty', 'Missing options', 'Missing correct answer'],
      },
    ])
    setHasParsed(true)
  }

  const handleSaveAllToStaging = async () => {
    if (!uPaperTitle.trim()) {
      setBanner({ type: 'error', text: 'Please enter a Paper Title in Step 1 before saving to Staging.' })
      return
    }
    if (parsedQuestions.length === 0) {
      setBanner({ type: 'error', text: 'Please parse at least one question before saving to Staging.' })
      return
    }
    setSavingToStaging(true)
    setBanner(null)
    try {
      const res = await apiFetch('/api/admin/previous-papers/manual-paste', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group: uGroup,
          year: uYear,
          examStream: uExamStream.trim(),
          paperTitle: uPaperTitle.trim(),
          paperType: uPaperType,
          medium: uMedium,
          totalQuestions: uTotalQuestions,
          marksPerQuestion: uMarksPerQ,
          negativeMarking: uNegMark,
          durationMinutes: uDuration,
          questions: parsedQuestions.map((q) => ({
            originalQuestionNumber: q.originalQuestionNumber,
            questionText: q.questionText,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            subject: q.subject,
            topic: q.topic,
            isDuplicate: q.isDuplicate,
            needsReview: q.needsReview,
            reviewNote: q.issues.length > 0 ? q.issues.join(' | ') : null,
          })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Failed to save questions to Staging.' })
        return
      }

      setRawPasteText('')
      setParsedQuestions([])
      setHasParsed(false)
      setUPaperTitle('')
      setActivePaper(json.data.paper)
      setStagingQuestions(json.data.questions || [])
      setStagingFilter('all')
      setViewMode('staging')
      setBanner({
        type: 'success',
        text: `Saved ${json.data.questions?.length ?? 0} question(s) to STAGING! Review, approve questions, and publish when ready.`,
      })
      void loadDashboard()
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Error saving to Staging.' })
    } finally {
      setSavingToStaging(false)
    }
  }

  const updateStagingQuestion = (idx: number, patch: Partial<StagingQuestion>) => {
    setStagingQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)))
  }

  const deleteStagingQuestion = (idx: number) => {
    setStagingQuestions((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((q, newIdx) => ({ ...q, questionNumber: newIdx + 1 }))
    )
  }

  const handleSaveStagingEdits = async () => {
    if (!activePaper) return
    setSavingStaging(true)
    setBanner(null)
    try {
      const res = await apiFetch(`/api/admin/previous-papers/${activePaper.id}/questions`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: stagingQuestions }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Failed to save edits.' })
        return
      }
      setActivePaper(json.data.paper)
      setStagingQuestions(json.data.questions || [])
      setBanner({ type: 'success', text: `Saved ${json.data.questions?.length ?? 0} questions in Staging.` })
      void loadDashboard()
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to save staging changes.' })
    } finally {
      setSavingStaging(false)
    }
  }

  const handleApproveQuestions = async (opts: { questionIds?: number[]; approveAllValid?: boolean; isApproved?: boolean }) => {
    if (!activePaper) return
    setApproving(true)
    setBanner(null)
    try {
      // Save any pending inline edits first
      await apiFetch(`/api/admin/previous-papers/${activePaper.id}/questions`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: stagingQuestions }),
      })

      const res = await apiFetch(`/api/admin/previous-papers/${activePaper.id}/questions/approve`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Approval failed.' })
        return
      }
      setActivePaper(json.data.paper)
      setStagingQuestions(json.data.questions || [])
      const skipped = Number(json.data.skippedInvalidCount || 0)
      setBanner({
        type: 'success',
        text: opts.approveAllValid
          ? `Approved ${json.data.updatedCount} valid question(s)${skipped > 0 ? ` (${skipped} incomplete/unverified skipped)` : ''}.`
          : opts.isApproved === false
            ? 'Question moved back to unapproved.'
            : 'Question approved!',
      })
      void loadDashboard()
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Approval error.' })
    } finally {
      setApproving(false)
    }
  }

  const handleChangePaperStatus = async (
    paperId: number,
    nextStatus: 'staging' | 'approved' | 'published' | 'unpublished'
  ) => {
    setBusyMsg(`Updating examination #${paperId} to ${nextStatus.toUpperCase()}...`)
    setBanner(null)
    try {
      const res = await apiFetch(`/api/admin/previous-papers/${paperId}/status`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Status update failed.' })
        return
      }
      if (activePaper?.id === paperId) {
        setActivePaper(json.data.paper)
        setStagingQuestions(json.data.questions || [])
      }
      if (nextStatus === 'published' || nextStatus === 'unpublished') notifyStudentSync()
      setBanner({
        type: 'success',
        text:
          nextStatus === 'published'
            ? 'Examination published! It is now live on Student Website → Previous Papers.'
            : `Examination status updated to ${nextStatus.toUpperCase()}.`,
      })
      void loadDashboard()
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Status update error.' })
    } finally {
      setBusyMsg(null)
    }
  }

  const handleDeletePaper = async (paperId: number, title: string) => {
    if (!window.confirm(`Delete Previous Year Examination "${title}" and all its questions?`)) return
    setBusyMsg('Deleting examination...')
    setBanner(null)
    try {
      const res = await apiFetch(`/api/admin/previous-papers/${paperId}`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Failed to delete examination.' })
        return
      }
      notifyStudentSync()
      setBanner({ type: 'success', text: `Deleted "${title}".` })
      if (activePaper?.id === paperId) {
        setActivePaper(null)
        setViewMode('dashboard')
      }
      void loadDashboard()
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Delete failed.' })
    } finally {
      setBusyMsg(null)
    }
  }

  const visibleParsedQuestions = parsedQuestions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => {
      if (pasteFilter === 'review') return q.needsReview
      if (pasteFilter === 'duplicates') return q.isDuplicate
      if (pasteFilter === 'valid') return !q.needsReview
      return true
    })

  const stagingApprovedCount = stagingQuestions.filter((q) => q.isApproved).length
  const stagingReviewCount = stagingQuestions.filter((q) => q.needsReview).length
  const allStagingApproved = stagingQuestions.length > 0 && stagingApprovedCount === stagingQuestions.length

  const visibleStagingQuestions = stagingQuestions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => {
      if (stagingFilter === 'review') return q.needsReview
      if (stagingFilter === 'unapproved') return !q.isApproved
      if (stagingFilter === 'approved') return q.isApproved
      return true
    })

  return (
    <div className="pypm-root">
      {/* Header Bar */}
      <div className="pypm-header-card">
        <div className="pypm-header-title-wrap">
          <div className="pypm-header-icon">
            <Archive size={20} />
          </div>
          <div>
            <h2 className="pypm-header-title">Previous Year Papers — Paste &amp; Staging Management</h2>
            <p className="pypm-header-sub">
              Copy &amp; paste official TNPSC Previous Year Questions, auto-parse, review &amp; approve in Staging, then publish to Student Website
            </p>
          </div>
        </div>

        <div className="pypm-header-actions">
          {viewMode !== 'dashboard' && (
            <button
              type="button"
              className="pypm-btn pypm-btn-secondary"
              onClick={() => setViewMode('dashboard')}
            >
              <ArrowLeft size={15} />
              <span>Back to Staging Dashboard</span>
            </button>
          )}
          <button
            type="button"
            className="pypm-btn pypm-btn-primary"
            onClick={() => {
              setBanner(null)
              setViewMode('paste')
            }}
          >
            <ClipboardPaste size={15} />
            <span>Paste Previous Year Questions</span>
          </button>
          <button
            type="button"
            className="pypm-btn-icon"
            onClick={() => void loadDashboard()}
            disabled={loading}
            title="Refresh"
            aria-label="Refresh Previous Year Papers"
          >
            <RefreshCw size={16} className={loading ? 'pypm-spin' : ''} />
          </button>
        </div>
      </div>

      {banner && (
        <div
          style={{
            padding: '0.85rem 1.15rem',
            borderRadius: '13px',
            background: banner.type === 'success' ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
            border: `1px solid ${banner.type === 'success' ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)'}`,
            color: banner.type === 'success' ? '#6ee7b7' : '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            fontSize: '0.88rem',
          }}
        >
          {banner.type === 'success' ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
          <span>{banner.text}</span>
        </div>
      )}

      {busyMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fde047', fontSize: '0.88rem' }}>
          <Loader2 size={16} className="pypm-spin" /> <span>{busyMsg}</span>
        </div>
      )}

      {/* VIEW 1: STAGING & PUBLISHED MANAGEMENT DASHBOARD */}
      {viewMode === 'dashboard' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
            {[
              { label: 'Total Examinations', value: stats?.totalPapers ?? 0, color: '#38bdf8' },
              { label: 'Total Questions', value: stats?.totalQuestionsExtracted ?? 0, color: '#c084fc' },
              { label: 'In Staging', value: stats?.stagingPapers ?? 0, color: '#fbbf24' },
              { label: 'Approved Ready', value: stats?.approvedPapers ?? 0, color: '#7dd3fc' },
              { label: 'Published Exams', value: stats?.publishedPapers ?? 0, color: '#34d399' },
            ].map((k) => (
              <div
                key={k.label}
                className="glass"
                style={{ padding: '0.95rem 1.05rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.09)' }}
              >
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{k.label}</div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: k.color, marginTop: '0.2rem' }}>
                  {k.value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div
            className="glass"
            style={{
              padding: '0.9rem 1rem',
              borderRadius: '14px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '0.65rem',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 600 }}>
              <Filter size={14} /> Filters
            </div>
            <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} className="pypm-input">
              <option value="all">All TNPSC Groups</option>
              {GROUP_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="pypm-input">
              <option value="all">All Years</option>
              {(stats?.byYear || []).map((y) => (
                <option key={y.year} value={String(y.year)}>{y.year}</option>
              ))}
            </select>
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search paper title..."
              className="pypm-input"
            />
            <select value={filterMedium} onChange={(e) => setFilterMedium(e.target.value)} className="pypm-input">
              <option value="all">All Mediums</option>
              <option value="English">English</option>
              <option value="Tamil">Tamil</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="pypm-input">
              <option value="all">All Statuses</option>
              <option value="staging">Staging</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
          </div>

          {/* Examinations Table */}
          <div className="glass" style={{ borderRadius: '16px', overflowX: 'auto', padding: '0.85rem' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading examinations...</div>
            ) : papers.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                No previous year examinations match your filters. Click &ldquo;Paste Previous Year Questions&rdquo; to create one.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '0.65rem' }}>Year</th>
                    <th style={{ padding: '0.65rem' }}>Examination</th>
                    <th style={{ padding: '0.65rem' }}>Medium</th>
                    <th style={{ padding: '0.65rem' }}>Parsed / Approved / Review</th>
                    <th style={{ padding: '0.65rem' }}>Status</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {papers.map((p) => {
                    const stStyle = STATUS_BADGE_COLORS[p.status] || STATUS_BADGE_COLORS.staging
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '0.65rem', fontWeight: 700, color: '#fde047' }}>{p.year}</td>
                        <td style={{ padding: '0.65rem' }}>
                          <div style={{ color: '#f8fafc', fontWeight: 700 }}>{p.exam} — {p.paperTitle}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {p.paperType} · {p.durationMinutes} mins · {p.marksPerQuestion} marks/Q
                            {p.negativeMarking > 0 ? ` · -${p.negativeMarking} negative` : ''}
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem', color: '#cbd5e1' }}>{p.medium}</td>
                        <td style={{ padding: '0.65rem' }}>
                          <div style={{ color: '#e2e8f0', fontWeight: 600 }}>
                            Parsed: {p.questionCount}
                            {p.expectedQuestions > 0 ? ` / ${p.expectedQuestions}` : ''}
                          </div>
                          <div style={{ fontSize: '0.73rem', color: '#94a3b8' }}>
                            <span style={{ color: '#34d399' }}>Approved: {p.approvedQuestionCount ?? 0}</span>
                            {p.flaggedCount > 0 && (
                              <span style={{ color: '#fbbf24', marginLeft: '0.5rem' }}>
                                Needs Review: {p.flaggedCount}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: '9999px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: stStyle.bg,
                              color: stStyle.color,
                              border: `1px solid ${stStyle.border}`,
                            }}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                              onClick={() => void openStagingReview(p.id)}
                            >
                              <Eye size={13} /> Review Questions
                            </button>
                            {p.status === 'approved' || p.status === 'unpublished' ? (
                              <button
                                type="button"
                                className="pypm-btn pypm-btn-primary pypm-btn-sm"
                                onClick={() => void handleChangePaperStatus(p.id, 'published')}
                              >
                                <Send size={13} /> Publish
                              </button>
                            ) : p.status === 'published' ? (
                              <button
                                type="button"
                                className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                                onClick={() => void handleChangePaperStatus(p.id, 'unpublished')}
                              >
                                <EyeOff size={13} /> Unpublish
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="pypm-btn pypm-btn-danger pypm-btn-sm"
                              onClick={() => void handleDeletePaper(p.id, p.paperTitle)}
                              title="Delete Examination"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* VIEW 2: STEPS 1 TO 5 — EXAMINATION DETAILS, PASTE EDITOR, PARSE, REVIEW, SAVE TO STAGING */}
      {viewMode === 'paste' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* STEP 1 – Examination Details */}
          <div className="pypm-card">
            <h3 className="pypm-section-heading">
              <FileText size={19} />
              <span>STEP 1 — Examination Details</span>
            </h3>

            <div className="pypm-form-grid">
              <div className="pypm-field">
                <label className="pypm-label" htmlFor="pypm-group">
                  TNPSC Group<span className="pypm-label-req">*</span>
                </label>
                <select
                  id="pypm-group"
                  className="pypm-input"
                  value={uGroup}
                  onChange={(e) => {
                    const val = e.target.value
                    setUGroup(val)
                    const found = GROUP_OPTIONS.find((g) => g.value === val)
                    if (found) setUExamStream(found.label)
                  }}
                >
                  {GROUP_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>

              <div className="pypm-field">
                <label className="pypm-label" htmlFor="pypm-year">
                  Examination Year<span className="pypm-label-req">*</span>
                </label>
                <input
                  id="pypm-year"
                  type="number"
                  min={1995}
                  max={2035}
                  required
                  className="pypm-input"
                  value={uYear}
                  onChange={(e) => setUYear(Number(e.target.value))}
                />
              </div>

              <div className="pypm-field">
                <label className="pypm-label" htmlFor="pypm-stream">
                  Exam Stream<span className="pypm-label-req">*</span>
                </label>
                <input
                  id="pypm-stream"
                  type="text"
                  required
                  className="pypm-input"
                  value={uExamStream}
                  onChange={(e) => setUExamStream(e.target.value)}
                  placeholder="e.g., TNPSC Group 4"
                />
              </div>

              <div className="pypm-field pypm-field-span-3">
                <label className="pypm-label" htmlFor="pypm-title">
                  Paper Title<span className="pypm-label-req">*</span>
                </label>
                <input
                  id="pypm-title"
                  type="text"
                  required
                  className="pypm-input"
                  value={uPaperTitle}
                  onChange={(e) => setUPaperTitle(e.target.value)}
                  placeholder="e.g., General Studies & General Tamil Official Paper"
                />
              </div>

              <div className="pypm-field">
                <label className="pypm-label" htmlFor="pypm-type">Paper Type</label>
                <select
                  id="pypm-type"
                  className="pypm-input"
                  value={uPaperType}
                  onChange={(e) => setUPaperType(e.target.value)}
                >
                  <option value="Prelims">Prelims</option>
                  <option value="Mains">Mains</option>
                </select>
              </div>

              <div className="pypm-field">
                <label className="pypm-label" htmlFor="pypm-medium">
                  Medium<span className="pypm-label-req">*</span>
                </label>
                <select
                  id="pypm-medium"
                  className="pypm-input"
                  value={uMedium}
                  onChange={(e) => setUMedium(e.target.value)}
                >
                  <option value="English">English</option>
                  <option value="Tamil">Tamil</option>
                </select>
              </div>

              <div className="pypm-field">
                <label className="pypm-label" htmlFor="pypm-total-q">Expected Total Questions</label>
                <input
                  id="pypm-total-q"
                  type="number"
                  min={1}
                  max={300}
                  className="pypm-input"
                  value={uTotalQuestions}
                  onChange={(e) => setUTotalQuestions(Number(e.target.value))}
                />
              </div>

              <div className="pypm-field">
                <label className="pypm-label" htmlFor="pypm-mpq">Marks Per Question</label>
                <input
                  id="pypm-mpq"
                  type="number"
                  step="0.25"
                  min={0.25}
                  className="pypm-input"
                  value={uMarksPerQ}
                  onChange={(e) => setUMarksPerQ(Number(e.target.value))}
                />
              </div>

              <div className="pypm-field">
                <label className="pypm-label" htmlFor="pypm-neg">Negative Marking</label>
                <input
                  id="pypm-neg"
                  type="number"
                  step="0.05"
                  min={0}
                  className="pypm-input"
                  value={uNegMark}
                  onChange={(e) => setUNegMark(Number(e.target.value))}
                />
              </div>

              <div className="pypm-field">
                <label className="pypm-label" htmlFor="pypm-dur">Exam Duration (Minutes)</label>
                <input
                  id="pypm-dur"
                  type="number"
                  min={10}
                  max={360}
                  className="pypm-input"
                  value={uDuration}
                  onChange={(e) => setUDuration(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* STEP 2 & 3 – Large Question Copy-Paste Editor & Parse Button */}
          <div className="pypm-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 className="pypm-section-heading" style={{ margin: 0 }}>
                <ClipboardPaste size={19} />
                <span>STEP 2 — PASTE PREVIOUS YEAR QUESTIONS</span>
              </h3>
              <div style={{ display: 'flex', gap: '0.45rem' }}>
                <button
                  type="button"
                  className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                  onClick={() => setRawPasteText(SAMPLE_PASTE_TEXT)}
                >
                  Load Example Format
                </button>
                <button
                  type="button"
                  className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                  onClick={() => {
                    setRawPasteText('')
                    setParsedQuestions([])
                    setHasParsed(false)
                  }}
                >
                  Clear Editor
                </button>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
              Paste 10, 50, 100, or 200+ Tamil or English questions directly from Word, text files, or websites. Supports{' '}
              <code>QUESTION 1:</code>, <code>Q1.</code>, <code>1.</code>, <code>கேள்வி 1:</code>, options{' '}
              <code>A) / (A) / (அ)</code>, <code>ANSWER: / விடை:</code>, and <code>EXPLANATION: / விளக்கம்:</code>.
            </p>

            <textarea
              rows={15}
              className="pypm-input"
              value={rawPasteText}
              onChange={(e) => setRawPasteText(e.target.value)}
              placeholder={SAMPLE_PASTE_TEXT}
              style={{
                width: '100%',
                minHeight: '300px',
                fontFamily: "'Noto Sans Tamil', 'Inter', monospace",
                fontSize: '0.88rem',
                lineHeight: 1.6,
                resize: 'vertical',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Characters pasted: {rawPasteText.length.toLocaleString()}
              </span>
              <button
                type="button"
                className="pypm-btn pypm-btn-primary pypm-btn-cta-lg"
                onClick={handleParsePastedText}
                disabled={!rawPasteText.trim()}
              >
                <Sparkles size={17} />
                <span>STEP 3 — PARSE QUESTIONS</span>
              </button>
            </div>
          </div>

          {/* STEP 4 & 5 – Validation Summary, Editable Preview, and Save All to Staging */}
          {hasParsed && (
            <div className="pypm-card" style={{ gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h3 className="pypm-section-heading" style={{ margin: 0 }}>
                  <CheckSquare size={19} />
                  <span>STEP 4 — Review Extracted Questions &amp; Validation Summary</span>
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                    onClick={addManualParsedRow}
                  >
                    <Plus size={14} /> Add Question
                  </button>
                  <button
                    type="button"
                    className="pypm-btn pypm-btn-primary"
                    disabled={savingToStaging || parsedQuestions.length === 0 || !uPaperTitle.trim()}
                    onClick={() => void handleSaveAllToStaging()}
                  >
                    {savingToStaging ? <Loader2 size={15} className="pypm-spin" /> : <Save size={15} />}
                    <span>{savingToStaging ? 'Saving to Staging...' : 'STEP 5 — SAVE ALL QUESTIONS TO STAGING'}</span>
                  </button>
                </div>
              </div>

              {/* Validation Summary Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.6rem' }}>
                {[
                  { label: 'Total Questions Pasted', val: pasteSummary.totalPasted, color: '#e2e8f0' },
                  { label: 'Successfully Parsed', val: pasteSummary.successfullyParsed, color: '#34d399' },
                  { label: 'Missing Options', val: pasteSummary.missingOptionsCount, color: pasteSummary.missingOptionsCount > 0 ? '#f87171' : '#94a3b8' },
                  { label: 'Missing Answers', val: pasteSummary.missingAnswersCount, color: pasteSummary.missingAnswersCount > 0 ? '#fbbf24' : '#94a3b8' },
                  { label: 'Duplicate Questions', val: pasteSummary.duplicateCount, color: pasteSummary.duplicateCount > 0 ? '#fb923c' : '#94a3b8' },
                  { label: 'Requiring Review', val: pasteSummary.needsReviewCount, color: pasteSummary.needsReviewCount > 0 ? '#fbbf24' : '#34d399' },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      padding: '0.65rem 0.8rem',
                      borderRadius: '10px',
                      background: 'rgba(15,23,42,0.65)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{m.label}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: m.color, marginTop: '0.15rem' }}>
                      {m.val}
                    </div>
                  </div>
                ))}
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'all' as const, label: `All (${parsedQuestions.length})` },
                  { id: 'review' as const, label: `Needs Review (${pasteSummary.needsReviewCount})` },
                  { id: 'duplicates' as const, label: `Duplicates (${pasteSummary.duplicateCount})` },
                  { id: 'valid' as const, label: `Valid (${pasteSummary.successfullyParsed})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`pypm-btn pypm-btn-sm ${pasteFilter === f.id ? 'pypm-btn-primary' : 'pypm-btn-secondary'}`}
                    onClick={() => setPasteFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Parsed Questions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {visibleParsedQuestions.map(({ q, idx }) => (
                  <div
                    key={q.clientId}
                    className="glass"
                    style={{
                      padding: '1rem',
                      borderRadius: '13px',
                      border: q.needsReview
                        ? '1px solid rgba(251,191,36,0.48)'
                        : '1px solid rgba(16,185,129,0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong style={{ color: '#facc15' }}>Question {q.questionNumber}</strong>
                        <span style={{ fontSize: '0.73rem', color: '#94a3b8' }}>Orig #{q.originalQuestionNumber}</span>
                        {q.issues.map((iss, iIdx) => (
                          <span
                            key={iIdx}
                            style={{
                              fontSize: '0.71rem',
                              padding: '0.12rem 0.5rem',
                              borderRadius: '9999px',
                              background: 'rgba(245,158,11,0.18)',
                              color: '#fbbf24',
                            }}
                          >
                            {iss}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="pypm-btn pypm-btn-danger pypm-btn-sm"
                        onClick={() => deleteParsedRow(idx)}
                        title="Remove question"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      className="pypm-input"
                      value={q.questionText}
                      onChange={(e) => updateParsedRow(idx, { questionText: e.target.value })}
                      placeholder="Question text..."
                      style={{ fontFamily: "'Noto Sans Tamil', 'Inter', sans-serif" }}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '0.5rem' }}>
                      {(['optionA', 'optionB', 'optionC', 'optionD'] as const).map((optKey, oIdx) => (
                        <div key={optKey} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <input
                            type="radio"
                            name={`paste-ans-${q.clientId}`}
                            checked={q.correctAnswer === oIdx}
                            onChange={() => updateParsedRow(idx, { correctAnswer: oIdx })}
                          />
                          <strong style={{ color: q.correctAnswer === oIdx ? '#34d399' : '#94a3b8', fontSize: '0.8rem' }}>
                            {String.fromCharCode(65 + oIdx)})
                          </strong>
                          <input
                            type="text"
                            className="pypm-input"
                            value={q[optKey]}
                            onChange={(e) => updateParsedRow(idx, { [optKey]: e.target.value })}
                            placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                            style={{ flex: 1, fontFamily: "'Noto Sans Tamil', 'Inter', sans-serif" }}
                          />
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="pypm-input"
                        value={q.subject}
                        onChange={(e) => updateParsedRow(idx, { subject: e.target.value })}
                        placeholder="Subject (optional)"
                      />
                      <input
                        type="text"
                        className="pypm-input"
                        value={q.topic}
                        onChange={(e) => updateParsedRow(idx, { topic: e.target.value })}
                        placeholder="Topic (optional)"
                      />
                    </div>

                    <textarea
                      rows={2}
                      className="pypm-input"
                      value={q.explanation}
                      onChange={(e) => updateParsedRow(idx, { explanation: e.target.value })}
                      placeholder="Explanation..."
                      style={{ fontSize: '0.82rem', fontFamily: "'Noto Sans Tamil', 'Inter', sans-serif" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: STEPS 6 & 7 — STAGING REVIEW, VERIFY, APPROVE & PUBLISH */}
      {viewMode === 'staging' && activePaper && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="pypm-card" style={{ padding: '1.15rem 1.35rem', gap: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.08rem' }}>
                  {activePaper.exam} — {activePaper.year}
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>
                  {activePaper.paperTitle} ({activePaper.medium} Medium)
                </p>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                  {activePaper.paperType} · {activePaper.durationMinutes} mins · {activePaper.marksPerQuestion} marks/Q
                  {activePaper.negativeMarking > 0 ? ` · -${activePaper.negativeMarking} negative` : ''}
                  {' · '}Status:{' '}
                  <strong style={{ color: '#fde047', textTransform: 'uppercase' }}>{activePaper.status}</strong>
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                  disabled={savingStaging}
                  onClick={() => void handleSaveStagingEdits()}
                >
                  <Save size={14} /> {savingStaging ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                  disabled={approving}
                  style={{ color: '#7dd3fc', borderColor: 'rgba(56,189,248,0.4)' }}
                  onClick={() => void handleApproveQuestions({ approveAllValid: true, isApproved: true })}
                >
                  <CheckSquare size={14} /> {approving ? 'Approving...' : 'Bulk Approve All Valid'}
                </button>
                <button
                  type="button"
                  className="pypm-btn pypm-btn-primary pypm-btn-sm"
                  disabled={!allStagingApproved && activePaper.sourceType === 'manual_paste'}
                  title={
                    !allStagingApproved && activePaper.sourceType === 'manual_paste'
                      ? 'Approve all questions first before publishing'
                      : 'Publish Examination to Student Website'
                  }
                  onClick={() => void handleChangePaperStatus(activePaper.id, 'published')}
                >
                  <Send size={14} /> PUBLISH EXAMINATION
                </button>
                <button
                  type="button"
                  className="pypm-btn pypm-btn-danger pypm-btn-sm"
                  onClick={() => void handleDeletePaper(activePaper.id, activePaper.paperTitle)}
                >
                  <Trash2 size={14} /> Delete Staging
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
              {[
                { label: 'Total Questions', val: stagingQuestions.length, color: '#e2e8f0' },
                { label: 'Approved', val: `${stagingApprovedCount} / ${stagingQuestions.length}`, color: allStagingApproved ? '#34d399' : '#7dd3fc' },
                { label: 'Needs Review', val: stagingReviewCount, color: stagingReviewCount > 0 ? '#fbbf24' : '#34d399' },
                { label: 'Status', val: activePaper.status.toUpperCase(), color: '#fde047' },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    padding: '0.65rem 0.8rem',
                    borderRadius: '10px',
                    background: 'rgba(15,23,42,0.65)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{m.label}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: m.color, marginTop: '0.15rem' }}>
                    {m.val}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'all' as const, label: `All Questions (${stagingQuestions.length})` },
              { id: 'unapproved' as const, label: `Pending Approval (${stagingQuestions.length - stagingApprovedCount})` },
              { id: 'approved' as const, label: `Approved (${stagingApprovedCount})` },
              { id: 'review' as const, label: `Needs Review (${stagingReviewCount})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`pypm-btn pypm-btn-sm ${stagingFilter === f.id ? 'pypm-btn-primary' : 'pypm-btn-secondary'}`}
                onClick={() => setStagingFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {visibleStagingQuestions.map(({ q, idx }) => (
              <div
                key={`${q.id ?? 'q'}-${idx}`}
                className="glass"
                style={{
                  padding: '1rem',
                  borderRadius: '14px',
                  border: q.isApproved
                    ? '1px solid rgba(16,185,129,0.4)'
                    : q.needsReview
                      ? '1px solid rgba(251,191,36,0.45)'
                      : '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#facc15' }}>Q{q.questionNumber}</strong>
                    <span
                      style={{
                        fontSize: '0.71rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.55rem',
                        borderRadius: '9999px',
                        background: q.isApproved ? 'rgba(16,185,129,0.18)' : 'rgba(245,158,11,0.16)',
                        color: q.isApproved ? '#34d399' : '#fbbf24',
                      }}
                    >
                      {q.isApproved ? 'APPROVED' : 'STAGING'}
                    </span>
                    {q.reviewNote && (
                      <span style={{ fontSize: '0.73rem', color: '#fbbf24' }}>{q.reviewNote}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.45rem' }}>
                    {q.id && (
                      <button
                        type="button"
                        className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                        style={{ color: q.isApproved ? '#fbbf24' : '#34d399' }}
                        disabled={approving}
                        onClick={() =>
                          void handleApproveQuestions({
                            questionIds: [q.id!],
                            isApproved: !q.isApproved,
                          })
                        }
                      >
                        <CheckCircle2 size={13} />
                        <span>{q.isApproved ? 'Unapprove' : 'Approve'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="pypm-btn pypm-btn-danger pypm-btn-sm"
                      onClick={() => deleteStagingQuestion(idx)}
                      title="Delete question"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <textarea
                  rows={2}
                  className="pypm-input"
                  value={q.questionText}
                  onChange={(e) => updateStagingQuestion(idx, { questionText: e.target.value })}
                  style={{ fontFamily: "'Noto Sans Tamil', 'Inter', sans-serif" }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                  {(['optionA', 'optionB', 'optionC', 'optionD'] as const).map((optKey, oIdx) => (
                    <div key={optKey} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="radio"
                        name={`stg-ans-${idx}`}
                        checked={q.correctAnswer === oIdx}
                        onChange={() =>
                          updateStagingQuestion(idx, {
                            correctAnswer: oIdx,
                            answerStatus: 'admin_verified',
                          })
                        }
                      />
                      <strong style={{ color: q.correctAnswer === oIdx ? '#34d399' : '#94a3b8', fontSize: '0.8rem' }}>
                        {String.fromCharCode(65 + oIdx)})
                      </strong>
                      <input
                        type="text"
                        className="pypm-input"
                        value={q[optKey]}
                        onChange={(e) => updateStagingQuestion(idx, { [optKey]: e.target.value })}
                        style={{ flex: 1, fontFamily: "'Noto Sans Tamil', 'Inter', sans-serif" }}
                      />
                    </div>
                  ))}
                </div>

                <textarea
                  rows={2}
                  className="pypm-input"
                  value={q.explanation}
                  onChange={(e) => updateStagingQuestion(idx, { explanation: e.target.value })}
                  placeholder="Explanation..."
                  style={{ fontSize: '0.82rem', fontFamily: "'Noto Sans Tamil', 'Inter', sans-serif" }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default PreviousYearPapersManager
