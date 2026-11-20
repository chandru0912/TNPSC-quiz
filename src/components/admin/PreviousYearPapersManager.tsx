import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  FileScan,
  FileText,
  Filter,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react'
import { apiFetch } from '../../utils/api'
import { notifyStudentSync } from '../../utils/studentSync'
import './PreviousYearPapersManager.css'

interface Props {
  token: string
}

interface PaperSummary {
  id: number
  year: number
  exam: string
  category: 'group1' | 'group2_2a' | 'group4'
  subjects: string
  paperTitle: string
  paperType: string
  medium: string
  difficulty: string
  totalQuestions: number
  questionCount: number
  flaggedCount: number
  durationMinutes: number
  marksPerQuestion: number
  negativeMarking: number
  status: 'draft' | 'staging' | 'approved' | 'published' | 'unpublished'
  pdfFilename: string | null
  answerKeyFilename: string | null
  extractionMethod: string | null
  sourceType: string
  publishedAt: string | null
}

interface ReviewQuestion {
  id?: number
  questionNumber: number
  originalQuestionNumber: string
  sourcePage: number | null
  subject: string
  topic: string
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctAnswer: number
  explanation: string
  needsReview: boolean
  reviewNote: string | null
  hasDiagramHint: boolean
  medium: string
}

interface StatsData {
  totalPapers: number
  totalPdfsUploaded: number
  totalQuestionsExtracted: number
  draftPapers: number
  stagingPapers: number
  pendingApprovalPapers: number
  approvedPapers: number
  publishedPapers: number
  unpublishedPapers: number
  byGroup: { category: string; exam: string; count: number }[]
  byYear: { year: number; count: number }[]
}

const GROUP_OPTIONS = [
  { value: 'group1', label: 'TNPSC Group 1' },
  { value: 'group2_2a', label: 'TNPSC Group 2 & 2A' },
  { value: 'group4', label: 'TNPSC Group 4' },
]

const STATUS_BADGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  draft: { bg: 'rgba(148,163,184,0.16)', color: '#cbd5e1', border: 'rgba(148,163,184,0.35)' },
  staging: { bg: 'rgba(245,158,11,0.16)', color: '#fbbf24', border: 'rgba(245,158,11,0.38)' },
  approved: { bg: 'rgba(56,189,248,0.16)', color: '#7dd3fc', border: 'rgba(56,189,248,0.38)' },
  published: { bg: 'rgba(16,185,129,0.18)', color: '#34d399', border: 'rgba(16,185,129,0.4)' },
  unpublished: { bg: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: 'rgba(239,68,68,0.35)' },
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function isValidPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export const PreviousYearPapersManager: React.FC<Props> = ({ token }) => {
  const [viewMode, setViewMode] = useState<'dashboard' | 'upload' | 'review'>('dashboard')
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

  // Upload form state (Subject & Difficulty Level intentionally removed)
  const [uGroup, setUGroup] = useState<string>('group1')
  const [uYear, setUYear] = useState<number>(new Date().getFullYear())
  const [uExamStream, setUExamStream] = useState<string>('TNPSC Group 1')
  const [uPaperTitle, setUPaperTitle] = useState<string>('')
  const [uPaperType, setUPaperType] = useState<string>('Prelims')
  const [uMedium, setUMedium] = useState<string>('English')
  const [uTotalQuestions, setUTotalQuestions] = useState<number>(200)
  const [uMarksPerQ, setUMarksPerQ] = useState<number>(1.5)
  const [uNegMark, setUNegMark] = useState<number>(0)
  const [uDuration, setUDuration] = useState<number>(180)
  const [questionPdfFile, setQuestionPdfFile] = useState<File | null>(null)
  const [answerKeyPdfFile, setAnswerKeyPdfFile] = useState<File | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<'question' | 'key' | null>(null)
  const [uploading, setUploading] = useState<boolean>(false)

  const questionFileInputRef = useRef<HTMLInputElement | null>(null)
  const answerKeyFileInputRef = useRef<HTMLInputElement | null>(null)

  // Review & Verification state
  const [activePaper, setActivePaper] = useState<PaperSummary | null>(null)
  const [reviewQuestions, setReviewQuestions] = useState<ReviewQuestion[]>([])
  const [showOnlyFlagged, setShowOnlyFlagged] = useState<boolean>(false)
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([])
  const [savingQuestions, setSavingQuestions] = useState<boolean>(false)
  const [applyingKey, setApplyingKey] = useState<boolean>(false)

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

  const openReviewForPaper = async (paperId: number, warnings: string[] = []) => {
    setBusyMsg('Loading extracted questions...')
    setBanner(null)
    try {
      const res = await apiFetch(`/api/admin/previous-papers/${paperId}`, { headers: authHeaders })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Could not load paper details.' })
        return
      }
      setActivePaper(json.data.paper)
      setReviewQuestions(json.data.questions || [])
      setExtractionWarnings(warnings)
      setShowOnlyFlagged(false)
      setViewMode('review')
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Error loading paper details.' })
    } finally {
      setBusyMsg(null)
    }
  }

  const handleSelectPdfFile = (target: 'question' | 'key', file: File | null) => {
    if (!file) return
    if (!isValidPdfFile(file)) {
      setBanner({ type: 'error', text: 'Invalid file format. Please select a valid PDF (.pdf) document.' })
      return
    }
    if (file.size > 35 * 1024 * 1024) {
      setBanner({ type: 'error', text: 'PDF file exceeds the 35 MB upload limit.' })
      return
    }
    setBanner(null)
    if (target === 'question') setQuestionPdfFile(file)
    else setAnswerKeyPdfFile(file)
  }

  const isUploadReady =
    Boolean(questionPdfFile) &&
    Boolean(uPaperTitle.trim()) &&
    Boolean(uExamStream.trim()) &&
    Number.isInteger(uYear) &&
    uYear >= 1995 &&
    uYear <= 2035 &&
    !uploading

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!questionPdfFile) {
      setBanner({ type: 'error', text: 'Please select an official Question Paper PDF file.' })
      return
    }
    if (!uPaperTitle.trim()) {
      setBanner({ type: 'error', text: 'Please enter a Paper Title.' })
      return
    }
    setUploading(true)
    setBanner(null)
    try {
      const fd = new FormData()
      fd.append('group', uGroup)
      fd.append('year', String(uYear))
      fd.append('examStream', uExamStream.trim())
      fd.append('paperTitle', uPaperTitle.trim())
      fd.append('paperType', uPaperType)
      fd.append('medium', uMedium)
      fd.append('totalQuestions', String(uTotalQuestions))
      fd.append('marksPerQuestion', String(uMarksPerQ))
      fd.append('negativeMarking', String(uNegMark))
      fd.append('durationMinutes', String(uDuration))
      fd.append('questionPdf', questionPdfFile)
      if (answerKeyPdfFile) {
        fd.append('answerKeyPdf', answerKeyPdfFile)
      }

      const res = await apiFetch('/api/admin/previous-papers/upload', {
        method: 'POST',
        headers: authHeaders,
        body: fd,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Upload and extraction failed.' })
        return
      }

      const report = json.data?.extractionReport
      setBanner({
        type: 'success',
        text: `PDF uploaded! Extracted ${report?.extractedCount ?? 0} questions (${report?.matchedAnswerKeysCount ?? 0} answer keys matched, ${report?.flaggedCount ?? 0} flagged for review).`,
      })
      setQuestionPdfFile(null)
      setAnswerKeyPdfFile(null)
      setUPaperTitle('')
      setActivePaper(json.data.paper)
      setReviewQuestions(json.data.questions || [])
      setExtractionWarnings(report?.warnings || [])
      setViewMode('review')
      void loadDashboard()
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Upload error.' })
    } finally {
      setUploading(false)
    }
  }

  const handleSaveQuestions = async (nextStatus?: 'draft' | 'staging' | 'approved' | 'published') => {
    if (!activePaper) return
    setSavingQuestions(true)
    setBanner(null)
    try {
      const saveRes = await apiFetch(`/api/admin/previous-papers/${activePaper.id}/questions`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: reviewQuestions }),
      })
      const saveJson = await saveRes.json().catch(() => ({}))
      if (!saveRes.ok || saveJson.status !== 'success') {
        setBanner({ type: 'error', text: saveJson.message || 'Failed to save questions.' })
        return
      }
      setActivePaper(saveJson.data.paper)
      setReviewQuestions(saveJson.data.questions || [])

      if (nextStatus) {
        const stRes = await apiFetch(`/api/admin/previous-papers/${activePaper.id}/status`, {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        })
        const stJson = await stRes.json().catch(() => ({}))
        if (!stRes.ok || stJson.status !== 'success') {
          setBanner({ type: 'error', text: stJson.message || `Saved questions, but failed to set status to ${nextStatus}.` })
          return
        }
        setActivePaper(stJson.data.paper)
        if (nextStatus === 'published') notifyStudentSync()
        setBanner({
          type: 'success',
          text:
            nextStatus === 'published'
              ? 'Paper published! It is now live on the Student Previous Year Papers page.'
              : `Saved ${reviewQuestions.length} questions and updated status to ${nextStatus.toUpperCase()}.`,
        })
      } else {
        setBanner({ type: 'success', text: `Saved ${reviewQuestions.length} questions successfully.` })
      }
      void loadDashboard()
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to save changes.' })
    } finally {
      setSavingQuestions(false)
    }
  }

  const handleApplyAnswerKey = async (file: File) => {
    if (!activePaper) return
    setApplyingKey(true)
    setBanner(null)
    try {
      const fd = new FormData()
      fd.append('answerKeyPdf', file)
      const res = await apiFetch(`/api/admin/previous-papers/${activePaper.id}/answer-key`, {
        method: 'POST',
        headers: authHeaders,
        body: fd,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Failed to apply answer key.' })
        return
      }
      setActivePaper(json.data.paper)
      setReviewQuestions(json.data.questions || [])
      setBanner({
        type: 'success',
        text: `Answer Key applied! Matched ${json.data.matchedCount} of ${json.data.questions?.length ?? 0} questions.`,
      })
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to process answer key PDF.' })
    } finally {
      setApplyingKey(false)
    }
  }

  const handleQuickStatus = async (paperId: number, status: 'staging' | 'approved' | 'published' | 'unpublished') => {
    setBusyMsg(`Updating paper #${paperId} to ${status}...`)
    setBanner(null)
    try {
      const res = await apiFetch(`/api/admin/previous-papers/${paperId}/status`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Status update failed.' })
        return
      }
      if (status === 'published' || status === 'unpublished') notifyStudentSync()
      setBanner({ type: 'success', text: `Paper #${paperId} status changed to ${status.toUpperCase()}.` })
      void loadDashboard()
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Status update error.' })
    } finally {
      setBusyMsg(null)
    }
  }

  const handleDeletePaper = async (paperId: number, title: string) => {
    if (!window.confirm(`Delete Previous Year Paper "${title}" and all its extracted questions?`)) return
    setBusyMsg('Deleting paper...')
    setBanner(null)
    try {
      const res = await apiFetch(`/api/admin/previous-papers/${paperId}`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Failed to delete paper.' })
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

  const updateQuestionField = (idx: number, patch: Partial<ReviewQuestion>) => {
    setReviewQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)))
  }

  const deleteQuestionRow = (idx: number) => {
    setReviewQuestions((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((q, newIdx) => ({ ...q, questionNumber: newIdx + 1 }))
    )
  }

  const addBlankQuestion = () => {
    setReviewQuestions((prev) => [
      ...prev,
      {
        questionNumber: prev.length + 1,
        originalQuestionNumber: String(prev.length + 1),
        sourcePage: null,
        subject: activePaper?.subjects || 'General Studies',
        topic: '',
        questionText: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctAnswer: 0,
        explanation: '',
        needsReview: false,
        reviewNote: null,
        hasDiagramHint: false,
        medium: activePaper?.medium || 'English',
      },
    ])
  }

  const flaggedTotal = reviewQuestions.filter((q) => q.needsReview).length
  const visibleQuestions = showOnlyFlagged
    ? reviewQuestions.map((q, idx) => ({ q, idx })).filter((x) => x.q.needsReview)
    : reviewQuestions.map((q, idx) => ({ q, idx }))

  return (
    <div className="pypm-root">
      {/* Top Action Header Bar */}
      <div className="pypm-header-card">
        <div className="pypm-header-title-wrap">
          <div className="pypm-header-icon">
            <Archive size={20} />
          </div>
          <div>
            <h2 className="pypm-header-title">Previous Year Papers Management</h2>
            <p className="pypm-header-sub">
              Upload official TNPSC PDFs, extract &amp; verify original questions, and publish online MCQ exams
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
              <span>Back to Papers Dashboard</span>
            </button>
          )}
          <button
            type="button"
            className="pypm-btn pypm-btn-primary"
            onClick={() => {
              setBanner(null)
              setViewMode('upload')
            }}
          >
            <Upload size={15} />
            <span>Upload Official Paper PDF</span>
          </button>
          <button
            type="button"
            className="pypm-btn-icon"
            onClick={() => void loadDashboard()}
            disabled={loading}
            title="Refresh Previous Year Papers"
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

      {/* VIEW 1: DASHBOARD */}
      {viewMode === 'dashboard' && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
              gap: '0.85rem',
            }}
          >
            {[
              { label: 'Total PDFs Uploaded', value: stats?.totalPdfsUploaded ?? 0, color: '#38bdf8' },
              { label: 'Questions Extracted', value: stats?.totalQuestionsExtracted ?? 0, color: '#c084fc' },
              { label: 'Draft Papers', value: stats?.draftPapers ?? 0, color: '#cbd5e1' },
              { label: 'In Staging', value: stats?.stagingPapers ?? 0, color: '#fbbf24' },
              { label: 'Pending Approval', value: stats?.pendingApprovalPapers ?? 0, color: '#7dd3fc' },
              { label: 'Published Papers', value: stats?.publishedPapers ?? 0, color: '#34d399' },
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

          {stats && (stats.byGroup.length > 0 || stats.byYear.length > 0) && (
            <div
              className="glass"
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                alignItems: 'center',
                fontSize: '0.78rem',
              }}
            >
              <strong style={{ color: '#facc15' }}>By Group:</strong>
              {stats.byGroup.map((g) => (
                <span
                  key={g.category}
                  style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    background: 'rgba(139,92,246,0.16)',
                    border: '1px solid rgba(167,139,250,0.35)',
                    color: '#ddd6fe',
                  }}
                >
                  {g.exam}: {g.count}
                </span>
              ))}
              <strong style={{ color: '#facc15', marginLeft: '0.6rem' }}>By Year:</strong>
              {stats.byYear.slice(0, 8).map((y) => (
                <span
                  key={y.year}
                  style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    background: 'rgba(245,158,11,0.14)',
                    border: '1px solid rgba(251,191,36,0.3)',
                    color: '#fde68a',
                  }}
                >
                  {y.year}: {y.count}
                </span>
              ))}
            </div>
          )}

          {/* Filters */}
          <div
            className="glass"
            style={{
              padding: '0.9rem 1rem',
              borderRadius: '14px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
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
              <option value="Bilingual">Bilingual</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="pypm-input">
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="staging">Staging</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
          </div>

          {/* Papers Table */}
          <div className="glass" style={{ borderRadius: '16px', overflowX: 'auto', padding: '0.85rem' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading papers...</div>
            ) : papers.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                No previous year papers match your filters. Click &ldquo;Upload Official Paper PDF&rdquo; to add one.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '0.65rem' }}>Year</th>
                    <th style={{ padding: '0.65rem' }}>Group / Stream</th>
                    <th style={{ padding: '0.65rem' }}>Paper Details</th>
                    <th style={{ padding: '0.65rem' }}>Medium</th>
                    <th style={{ padding: '0.65rem' }}>Questions</th>
                    <th style={{ padding: '0.65rem' }}>Status</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {papers.map((p) => {
                    const stStyle = STATUS_BADGE_COLORS[p.status] || STATUS_BADGE_COLORS.draft
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '0.65rem', fontWeight: 700, color: '#fde047' }}>{p.year}</td>
                        <td style={{ padding: '0.65rem', color: '#f8fafc', fontWeight: 600 }}>{p.exam}</td>
                        <td style={{ padding: '0.65rem' }}>
                          <div style={{ color: '#f8fafc', fontWeight: 600 }}>{p.paperTitle}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {p.paperType} · {p.durationMinutes}m · {p.marksPerQuestion} marks/Q
                            {p.negativeMarking > 0 ? ` · -${p.negativeMarking} neg` : ''}
                            {p.pdfFilename ? ` · PDF: ${p.pdfFilename}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem', color: '#cbd5e1' }}>{p.medium}</td>
                        <td style={{ padding: '0.65rem' }}>
                          <strong style={{ color: '#e2e8f0' }}>{p.questionCount}</strong>
                          {p.flaggedCount > 0 && (
                            <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: '#fbbf24' }}>
                              ({p.flaggedCount} flagged)
                            </span>
                          )}
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
                              onClick={() => void openReviewForPaper(p.id)}
                              title="Review & Edit Extracted Questions"
                            >
                              <Eye size={13} /> Review
                            </button>
                            {p.status !== 'published' ? (
                              <button
                                type="button"
                                className="pypm-btn pypm-btn-primary pypm-btn-sm"
                                onClick={() => void handleQuickStatus(p.id, 'published')}
                                title="Publish to Student Panel"
                              >
                                <Send size={13} /> Publish
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                                onClick={() => void handleQuickStatus(p.id, 'unpublished')}
                                title="Unpublish from Student Panel"
                              >
                                <EyeOff size={13} /> Unpublish
                              </button>
                            )}
                            <button
                              type="button"
                              className="pypm-btn pypm-btn-danger pypm-btn-sm"
                              onClick={() => void handleDeletePaper(p.id, p.paperTitle)}
                              title="Delete Paper"
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

      {/* VIEW 2: UPLOAD OFFICIAL PAPER PDF (Redesigned — Subject field removed) */}
      {viewMode === 'upload' && (
        <form onSubmit={handleUploadSubmit} className="pypm-card">
          <h3 className="pypm-section-heading">
            <FileText size={19} />
            <span>Upload Official TNPSC Previous Year Question Paper PDF</span>
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
                placeholder="e.g., 2024"
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
                placeholder="e.g., TNPSC Group 1"
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
                placeholder="e.g., General Studies (Prelims) Official Question Paper"
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
                <option value="Combined">Combined</option>
                <option value="Official Question Paper">Official Question Paper</option>
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
                <option value="Bilingual">Bilingual (Tamil &amp; English)</option>
              </select>
            </div>

            <div className="pypm-field">
              <label className="pypm-label" htmlFor="pypm-total-q">Total Questions (Expected)</label>
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
              <label className="pypm-label" htmlFor="pypm-neg">Negative Marking (per wrong answer)</label>
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

          {/* Custom Drag-and-Drop PDF Upload Zones */}
          <div className="pypm-dropzones-grid">
            {/* Question Paper PDF Dropzone */}
            <div
              className={`pypm-dropzone ${dragOverTarget === 'question' ? 'is-dragover' : ''} ${questionPdfFile ? 'has-file' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverTarget('question')
              }}
              onDragLeave={() => setDragOverTarget(null)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOverTarget(null)
                const dropped = e.dataTransfer.files?.[0] || null
                handleSelectPdfFile('question', dropped)
              }}
            >
              <input
                ref={questionFileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  handleSelectPdfFile('question', e.target.files?.[0] || null)
                  e.target.value = ''
                }}
              />
              <div className="pypm-dropzone-icon">
                <FileText size={22} />
              </div>
              <div className="pypm-dropzone-title">
                Question Paper PDF <span className="pypm-label-req">*</span>
              </div>
              {questionPdfFile ? (
                <div className="pypm-file-chip">
                  <div className="pypm-file-meta">
                    <span className="pypm-file-name" title={questionPdfFile.name}>
                      {questionPdfFile.name}
                    </span>
                    <span className="pypm-file-size">{formatFileSize(questionPdfFile.size)} · Ready to extract</span>
                  </div>
                  <div className="pypm-file-actions">
                    <button
                      type="button"
                      className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                      onClick={() => questionFileInputRef.current?.click()}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      className="pypm-btn pypm-btn-danger pypm-btn-sm"
                      onClick={() => setQuestionPdfFile(null)}
                      title="Remove file"
                      aria-label="Remove Question Paper PDF"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="pypm-dropzone-hint">
                    Drag &amp; drop official TNPSC question paper PDF here, or browse (max 35 MB)
                  </div>
                  <button
                    type="button"
                    className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                    onClick={() => questionFileInputRef.current?.click()}
                  >
                    <Upload size={14} /> Browse PDF
                  </button>
                </>
              )}
            </div>

            {/* Official Answer Key PDF Dropzone (Optional) */}
            <div
              className={`pypm-dropzone is-optional ${dragOverTarget === 'key' ? 'is-dragover' : ''} ${answerKeyPdfFile ? 'has-file' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverTarget('key')
              }}
              onDragLeave={() => setDragOverTarget(null)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOverTarget(null)
                const dropped = e.dataTransfer.files?.[0] || null
                handleSelectPdfFile('key', dropped)
              }}
            >
              <input
                ref={answerKeyFileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  handleSelectPdfFile('key', e.target.files?.[0] || null)
                  e.target.value = ''
                }}
              />
              <div className="pypm-dropzone-icon">
                <KeyRound size={22} />
              </div>
              <div className="pypm-dropzone-title">Official Answer Key PDF (Optional)</div>
              {answerKeyPdfFile ? (
                <div className="pypm-file-chip">
                  <div className="pypm-file-meta">
                    <span className="pypm-file-name" title={answerKeyPdfFile.name}>
                      {answerKeyPdfFile.name}
                    </span>
                    <span className="pypm-file-size">{formatFileSize(answerKeyPdfFile.size)} · Will auto-match answers</span>
                  </div>
                  <div className="pypm-file-actions">
                    <button
                      type="button"
                      className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                      onClick={() => answerKeyFileInputRef.current?.click()}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      className="pypm-btn pypm-btn-danger pypm-btn-sm"
                      onClick={() => setAnswerKeyPdfFile(null)}
                      title="Remove file"
                      aria-label="Remove Answer Key PDF"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="pypm-dropzone-hint">
                    Drag &amp; drop official TNPSC answer key PDF to auto-verify correct options
                  </div>
                  <button
                    type="button"
                    className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                    onClick={() => answerKeyFileInputRef.current?.click()}
                  >
                    <Upload size={14} /> Browse PDF
                  </button>
                </>
              )}
            </div>
          </div>

          {uploading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#fde047', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Loader2 size={14} className="pypm-spin" />
                <span>Reading PDF pages, extracting questions &amp; matching answer keys...</span>
              </div>
              <div className="pypm-upload-progress">
                <div className="pypm-upload-progress-bar" />
              </div>
            </div>
          )}

          <div className="pypm-form-footer">
            <span className="pypm-form-footer-note">
              {!uPaperTitle.trim()
                ? 'Enter a Paper Title and select the Question Paper PDF to proceed.'
                : !questionPdfFile
                  ? 'Select a Question Paper PDF to enable extraction.'
                  : 'All required fields ready — extracted questions will open in Review mode before publishing.'}
            </span>

            <div className="pypm-form-footer-actions">
              <button
                type="button"
                className="pypm-btn pypm-btn-secondary"
                onClick={() => setViewMode('dashboard')}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="pypm-btn pypm-btn-primary pypm-btn-cta-lg"
                disabled={!isUploadReady}
              >
                {uploading ? <Loader2 size={17} className="pypm-spin" /> : <FileScan size={17} />}
                <span>{uploading ? 'Extracting PDF Questions...' : 'Upload & Extract Questions'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* VIEW 3: QUESTION REVIEW & VERIFICATION */}
      {viewMode === 'review' && activePaper && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="pypm-card" style={{ padding: '1.15rem 1.35rem', gap: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.05rem' }}>
                  {activePaper.exam} ({activePaper.year}) — {activePaper.paperTitle}
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  {reviewQuestions.length} Questions · {flaggedTotal} Flagged for Review · Status:{' '}
                  <strong style={{ color: '#fde047', textTransform: 'uppercase' }}>{activePaper.status}</strong> · Medium: {activePaper.medium}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <label className="pypm-btn pypm-btn-secondary pypm-btn-sm" style={{ cursor: 'pointer' }}>
                  <KeyRound size={14} />
                  <span>{applyingKey ? 'Applying Key...' : 'Upload Answer Key PDF'}</span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    style={{ display: 'none' }}
                    disabled={applyingKey}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleApplyAnswerKey(f)
                      e.target.value = ''
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                  onClick={addBlankQuestion}
                >
                  <Plus size={14} /> Add Question
                </button>
                <button
                  type="button"
                  className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                  disabled={savingQuestions}
                  onClick={() => void handleSaveQuestions('draft')}
                >
                  <Save size={14} /> Save Draft
                </button>
                <button
                  type="button"
                  className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                  disabled={savingQuestions}
                  onClick={() => void handleSaveQuestions('staging')}
                >
                  Save to Staging
                </button>
                <button
                  type="button"
                  className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                  disabled={savingQuestions}
                  onClick={() => void handleSaveQuestions('approved')}
                  style={{ color: '#7dd3fc' }}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="pypm-btn pypm-btn-primary pypm-btn-sm"
                  disabled={savingQuestions}
                  onClick={() => void handleSaveQuestions('published')}
                >
                  <Send size={14} /> Publish Test
                </button>
              </div>
            </div>
          </div>

          {extractionWarnings.length > 0 && (
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(251,191,36,0.35)',
                color: '#fde68a',
                fontSize: '0.82rem',
              }}
            >
              {extractionWarnings.map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <AlertTriangle size={15} /> <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className={`pypm-btn pypm-btn-sm ${!showOnlyFlagged ? 'pypm-btn-primary' : 'pypm-btn-secondary'}`}
              onClick={() => setShowOnlyFlagged(false)}
            >
              All Questions ({reviewQuestions.length})
            </button>
            <button
              type="button"
              className={`pypm-btn pypm-btn-sm ${showOnlyFlagged ? 'pypm-btn-primary' : 'pypm-btn-secondary'}`}
              onClick={() => setShowOnlyFlagged(true)}
            >
              Flagged for Review ({flaggedTotal})
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {visibleQuestions.length === 0 ? (
              <div className="glass" style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', borderRadius: '14px' }}>
                {showOnlyFlagged
                  ? 'All questions are verified! No flagged items remain.'
                  : 'No questions yet. Click "Add Question" to add questions manually.'}
              </div>
            ) : (
              visibleQuestions.map(({ q, idx }) => (
                <div
                  key={`${q.id ?? 'new'}-${idx}`}
                  className="glass"
                  style={{
                    padding: '1rem',
                    borderRadius: '14px',
                    border: q.needsReview
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
                      <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                        Orig #{q.originalQuestionNumber}{q.sourcePage ? ` · Page ${q.sourcePage}` : ''}
                      </span>
                      {q.needsReview && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.15rem 0.55rem',
                            borderRadius: '9999px',
                            background: 'rgba(245,158,11,0.18)',
                            color: '#fbbf24',
                          }}
                        >
                          Needs Review: {q.reviewNote || 'Verify text & answer'}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                      {q.needsReview && (
                        <button
                          type="button"
                          className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                          onClick={() => updateQuestionField(idx, { needsReview: false, reviewNote: null })}
                          style={{ color: '#34d399' }}
                        >
                          Mark Verified
                        </button>
                      )}
                      <button
                        type="button"
                        className="pypm-btn pypm-btn-danger pypm-btn-sm"
                        onClick={() => deleteQuestionRow(idx)}
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
                    onChange={(e) => updateQuestionField(idx, { questionText: e.target.value })}
                    placeholder="Question text (Tamil or English)"
                    style={{ fontFamily: "'Noto Sans Tamil', 'Inter', sans-serif", lineHeight: 1.5 }}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.55rem' }}>
                    {(['optionA', 'optionB', 'optionC', 'optionD'] as const).map((optKey, oIdx) => (
                      <div key={optKey} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="radio"
                          name={`pyp-ans-${idx}`}
                          checked={q.correctAnswer === oIdx}
                          onChange={() => updateQuestionField(idx, { correctAnswer: oIdx })}
                          title={`Mark Option ${String.fromCharCode(65 + oIdx)} as correct`}
                        />
                        <strong style={{ color: q.correctAnswer === oIdx ? '#34d399' : '#94a3b8', fontSize: '0.8rem' }}>
                          {String.fromCharCode(65 + oIdx)})
                        </strong>
                        <input
                          type="text"
                          className="pypm-input"
                          value={q[optKey]}
                          onChange={(e) => updateQuestionField(idx, { [optKey]: e.target.value })}
                          placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                          style={{ flex: 1, fontFamily: "'Noto Sans Tamil', 'Inter', sans-serif" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PreviousYearPapersManager
