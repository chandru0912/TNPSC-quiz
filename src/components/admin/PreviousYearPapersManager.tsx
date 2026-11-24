import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowUpDown,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Filter,
  History,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { apiFetch } from '../../utils/api'
import { notifyStudentSync } from '../../utils/studentSync'
import {
  parsePastedPreviousYearQuestionsAsync,
  type ParsedPreviousPaperQuestion,
  type PasteParseProgress,
  type PasteParseSummary,
} from '../../utils/previousPaperPasteParser'
import { PreviousPaperAiPdfGenerator } from './PreviousPaperAiPdfGenerator'
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
  deletedPapers?: number
  byYear: { year: number; count: number }[]
}

interface BulkPreviewData {
  scope: 'selected' | 'filtered' | 'all'
  totalSelected: number
  totalQuestions: number
  approvedQuestions: number
  needsReviewQuestions: number
  eligibleForPublish: number
  eligibleForApprove?: number
  eligibleForReject?: number
  alreadyPublishedCount: number
  ineligibleCount: number
  sampleIneligible: Array<{ paperId: number; paperTitle: string; reason: string }>
}

interface AuditLogItem {
  id: number
  adminId: string
  paperId: number | null
  paperTitle: string | null
  year: number | null
  exam: string | null
  action: string
  previousStatus: string | null
  newStatus: string | null
  bulkOperationId: string | null
  createdAt: string
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
  rejected: { bg: 'rgba(249,115,22,0.18)', color: '#fdba74', border: 'rgba(249,115,22,0.42)' },
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
  const [viewMode, setViewMode] = useState<'dashboard' | 'paste' | 'ai_pdf' | 'staging'>('dashboard')
  const [stats, setStats] = useState<StatsData | null>(null)
  const [papers, setPapers] = useState<PaperSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [busyMsg, setBusyMsg] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Dashboard filters, sorting, pagination & Trash view
  const [filterGroup, setFilterGroup] = useState<string>('all')
  const [filterYear, setFilterYear] = useState<string>('all')
  const [filterMedium, setFilterMedium] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSearch, setFilterSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<'year' | 'exam'>('year')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [tablePage, setTablePage] = useState<number>(1)
  const [tablePageSize, setTablePageSize] = useState<number>(15)
  const [tablePagination, setTablePagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 })
  const [showTrash] = useState<boolean>(false)

  // Bulk selection state (preserved across pagination!)
  const [selectionScope, setSelectionScope] = useState<'selected' | 'filtered' | 'all'>('selected')
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<number>>(new Set())
  const [excludedPaperIds, setExcludedPaperIds] = useState<Set<number>>(new Set())
  const [selectMenuOpen, setSelectMenuOpen] = useState<boolean>(false)

  // Bulk confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    action: 'approve' | 'reject' | 'publish' | 'unpublish' | 'delete'
    scope: 'selected' | 'filtered' | 'all'
    singlePaper?: PaperSummary
    title: string
  } | null>(null)
  const [previewData, setPreviewData] = useState<BulkPreviewData | null>(null)
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState<string>('')
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('')
  const [executingBulk, setExecutingBulk] = useState<boolean>(false)

  // Edit examination metadata modal
  const [editPaper, setEditPaper] = useState<PaperSummary | null>(null)
  const [editTitle, setEditTitle] = useState<string>('')
  const [editYear, setEditYear] = useState<number>(2025)
  const [editMedium, setEditMedium] = useState<string>('English')
  const [editPaperType, setEditPaperType] = useState<string>('Prelims')
  const [editDuration, setEditDuration] = useState<number>(180)
  const [editMarks, setEditMarks] = useState<number>(1.5)
  const [editNeg, setEditNeg] = useState<number>(0)
  const [savingEdit, setSavingEdit] = useState<boolean>(false)

  // Audit logs modal
  const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false)
  const [auditLogs] = useState<AuditLogItem[]>([])
  const [loadingAudit] = useState<boolean>(false)

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
  const [lastParseSummary, setLastParseSummary] = useState<PasteParseSummary | null>(null)
  const [parseProgress, setParseProgress] = useState<PasteParseProgress | null>(null)
  const [isParsing, setIsParsing] = useState<boolean>(false)
  const [hasParsed, setHasParsed] = useState<boolean>(false)
  const [pasteFilter, setPasteFilter] = useState<
    'all' | 'valid' | 'review' | 'missing_options' | 'missing_answers' | 'duplicates'
  >('all')
  const [pasteSearch, setPasteSearch] = useState<string>('')
  const [pastePage, setPastePage] = useState<number>(1)
  const [pastePageSize, setPastePageSize] = useState<number>(25)
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set())
  const [showParseDiagnostics, setShowParseDiagnostics] = useState<boolean>(false)
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
      q.set('sortBy', sortBy)
      q.set('sortDir', sortDir)
      q.set('page', String(tablePage))
      q.set('limit', String(tablePageSize))
      if (showTrash) q.set('includeDeleted', 'true')

      const [statsRes, listRes] = await Promise.all([
        apiFetch('/api/admin/previous-papers/stats', { headers: authHeaders }),
        apiFetch(`/api/admin/previous-papers?${q.toString()}`, { headers: authHeaders }),
      ])
      const statsJson = await statsRes.json().catch(() => ({}))
      const listJson = await listRes.json().catch(() => ({}))
      if (statsRes.ok && statsJson.status === 'success') setStats(statsJson.data)
      if (listRes.ok && listJson.status === 'success') {
        setPapers(listJson.data || [])
        if (listJson.pagination) setTablePagination(listJson.pagination)
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to load Previous Year Papers.' })
    } finally {
      setLoading(false)
    }
  }, [token, filterGroup, filterYear, filterMedium, filterStatus, filterSearch, sortBy, sortDir, tablePage, tablePageSize, showTrash])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  // Clear stale selections whenever active filters or search change
  useEffect(() => {
    setSelectionScope('selected')
    setSelectedPaperIds(new Set())
    setExcludedPaperIds(new Set())
  }, [filterGroup, filterYear, filterMedium, filterStatus, filterSearch, showTrash])

  const activeFiltersPayload = useMemo(
    () => ({
      group: filterGroup,
      year: filterYear,
      medium: filterMedium,
      status: filterStatus,
      search: filterSearch.trim(),
      includeDeleted: showTrash,
    }),
    [filterGroup, filterYear, filterMedium, filterStatus, filterSearch, showTrash]
  )

  const clearPaperSelection = useCallback(() => {
    setSelectionScope('selected')
    setSelectedPaperIds(new Set())
    setExcludedPaperIds(new Set())
    setSelectMenuOpen(false)
  }, [])

  const isPaperSelected = useCallback(
    (id: number) => {
      if (selectionScope === 'selected') return selectedPaperIds.has(id)
      return !excludedPaperIds.has(id)
    },
    [selectionScope, selectedPaperIds, excludedPaperIds]
  )

  const toggleSinglePaper = (id: number) => {
    if (selectionScope === 'selected') {
      setSelectedPaperIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    } else {
      setExcludedPaperIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }
  }

  const selectCurrentPagePapers = () => {
    setSelectionScope('selected')
    setExcludedPaperIds(new Set())
    setSelectedPaperIds((prev) => {
      const next = new Set(prev)
      for (const p of papers) next.add(p.id)
      return next
    })
    setSelectMenuOpen(false)
  }

  const selectAllFilteredPapers = () => {
    setSelectionScope('filtered')
    setSelectedPaperIds(new Set())
    setExcludedPaperIds(new Set())
    setSelectMenuOpen(false)
  }

  const selectAllDatabasePapers = () => {
    setSelectionScope('all')
    setSelectedPaperIds(new Set())
    setExcludedPaperIds(new Set())
    setSelectMenuOpen(false)
  }

  const allOnPageSelected = papers.length > 0 && papers.every((p) => isPaperSelected(p.id))

  const toggleHeaderCheckbox = () => {
    if (allOnPageSelected) {
      if (selectionScope === 'selected') {
        setSelectedPaperIds((prev) => {
          const next = new Set(prev)
          for (const p of papers) next.delete(p.id)
          return next
        })
      } else {
        clearPaperSelection()
      }
    } else {
      selectCurrentPagePapers()
    }
  }

  const totalDbActiveCount = showTrash ? (stats?.deletedPapers ?? tablePagination.total) : (stats?.totalPapers ?? tablePagination.total)
  const effectiveSelectedCount = useMemo(() => {
    if (selectionScope === 'selected') return selectedPaperIds.size
    if (selectionScope === 'filtered') return Math.max(0, tablePagination.total - excludedPaperIds.size)
    return Math.max(0, totalDbActiveCount - excludedPaperIds.size)
  }, [selectionScope, selectedPaperIds.size, excludedPaperIds.size, tablePagination.total, totalDbActiveCount])

  const openBulkConfirmModal = async (
    action: 'approve' | 'reject' | 'publish' | 'unpublish' | 'delete',
    scopeOverride?: 'selected' | 'filtered' | 'all',
    singlePaper?: PaperSummary
  ) => {
    setSelectMenuOpen(false)
    const scope = singlePaper ? 'selected' : scopeOverride || selectionScope
    const title =
      action === 'approve'
        ? 'Approve Selected Examinations'
        : action === 'reject'
          ? 'Reject Selected Examinations'
          : action === 'publish'
            ? singlePaper
              ? `Publish "${singlePaper.paperTitle}"`
              : scope === 'all'
                ? 'Publish All Eligible Examinations'
                : scope === 'filtered'
                  ? 'Publish All Filtered Examinations'
                  : 'Bulk Publish Selected Examinations'
            : action === 'unpublish'
              ? singlePaper
                ? `Unpublish "${singlePaper.paperTitle}"`
                : scope === 'all'
                  ? 'Unpublish All Examinations'
                  : scope === 'filtered'
                    ? 'Unpublish All Filtered Examinations'
                    : 'Unpublish Selected Examinations'
              : singlePaper
                ? `Move "${singlePaper.paperTitle}" to Trash`
                : scope === 'all'
                  ? 'Delete ALL Examinations in Database'
                  : scope === 'filtered'
                    ? 'Delete All Filtered Examinations'
                    : 'Delete Selected Examinations'

    setConfirmModal({ action, scope, singlePaper, title })
    setDeleteConfirmInput('')
    setRejectionReasonInput('')
    setPreviewData(null)
    setLoadingPreview(true)

    try {
      const payload = singlePaper
        ? { scope: 'selected', selectedIds: [singlePaper.id] }
        : {
          scope,
          selectedIds: scope === 'selected' ? Array.from(selectedPaperIds) : [],
          excludedIds: scope !== 'selected' ? Array.from(excludedPaperIds) : [],
          filters: scope === 'filtered' ? activeFiltersPayload : undefined,
        }
      const res = await apiFetch('/api/admin/previous-papers/bulk-preview', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.status === 'success') {
        setPreviewData(json.data)
      }
    } finally {
      setLoadingPreview(false)
    }
  }

  const executeConfirmedAction = async () => {
    if (!confirmModal || executingBulk) return
    const { action, scope, singlePaper } = confirmModal

    if (action === 'delete' && scope === 'all' && deleteConfirmInput.trim() !== 'DELETE ALL EXAMINATIONS') {
      setBanner({ type: 'error', text: 'Type DELETE ALL EXAMINATIONS exactly to confirm global deletion.' })
      return
    }

    setExecutingBulk(true)
    setBanner(null)
    try {
      const endpoint =
        action === 'approve'
          ? '/api/admin/previous-papers/bulk-approve'
          : action === 'reject'
            ? '/api/admin/previous-papers/bulk-reject'
            : action === 'publish'
              ? '/api/admin/previous-papers/bulk-publish'
              : action === 'unpublish'
                ? '/api/admin/previous-papers/bulk-unpublish'
                : '/api/admin/previous-papers/bulk-delete'

      const payload: Record<string, any> = singlePaper
        ? { scope: 'selected', selectedIds: [singlePaper.id] }
        : {
          scope,
          selectedIds: scope === 'selected' ? Array.from(selectedPaperIds) : [],
          excludedIds: scope !== 'selected' ? Array.from(excludedPaperIds) : [],
          filters: scope === 'filtered' ? activeFiltersPayload : undefined,
        }
      if (action === 'delete' && scope === 'all') {
        payload.confirmText = deleteConfirmInput.trim()
      }
      if (action === 'reject' && rejectionReasonInput.trim()) {
        payload.rejectionReason = rejectionReasonInput.trim()
      }

      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || `Bulk ${action} failed.` })
        return
      }

      const d = json.data || {}
      notifyStudentSync()
      if (action === 'approve') {
        setBanner({
          type: d.approvedCount > 0 ? 'success' : 'error',
          text: `Approved ${d.approvedCount ?? 0} of ${d.totalMatched ?? 0} examination(s)${d.skippedCount ? ` (${d.skippedCount} skipped — already published/approved or incomplete)` : ''}. Operation ID: ${d.bulkOperationId}`,
        })
      } else if (action === 'reject') {
        setBanner({
          type: d.rejectedCount > 0 ? 'success' : 'error',
          text: `Rejected ${d.rejectedCount ?? 0} of ${d.totalMatched ?? 0} examination(s) (kept out of Student Website). Operation ID: ${d.bulkOperationId}`,
        })
      } else if (action === 'publish') {
        setBanner({
          type: d.publishedCount > 0 ? 'success' : 'error',
          text: `Published ${d.publishedCount ?? 0} of ${d.totalMatched ?? 0} examination(s)${d.skippedCount ? ` (${d.skippedCount} skipped — not approved or needing review)` : ''}. Operation ID: ${d.bulkOperationId}`,
        })
      } else if (action === 'unpublish') {
        setBanner({
          type: 'success',
          text: `Unpublished ${d.unpublishedCount ?? 0} of ${d.totalMatched ?? 0} examination(s). Operation ID: ${d.bulkOperationId}`,
        })
      } else {
        setBanner({
          type: 'success',
          text: `Moved ${d.deletedCount ?? 0} examination(s) to recoverable Trash (Question Bank & Student History untouched). Operation ID: ${d.bulkOperationId}`,
        })
      }

      setConfirmModal(null)
      clearPaperSelection()
      void loadDashboard()
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || `Failed to execute ${action}.` })
    } finally {
      setExecutingBulk(false)
    }
  }

  const handleRestorePapers = async (ids: number[]) => {
    if (ids.length === 0) return
    setBusyMsg(`Restoring ${ids.length} examination(s) from Trash...`)
    setBanner(null)
    try {
      const res = await apiFetch('/api/admin/previous-papers/bulk-restore', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperIds: ids }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Restore failed.' })
        return
      }
      setBanner({ type: 'success', text: `Restored ${json.data?.restoredCount ?? ids.length} examination(s) from Trash.` })
      clearPaperSelection()
      void loadDashboard()
    } finally {
      setBusyMsg(null)
    }
  }

  const openEditModal = (p: PaperSummary) => {
    setEditPaper(p)
    setEditTitle(p.paperTitle)
    setEditYear(p.year)
    setEditMedium(p.medium || 'English')
    setEditPaperType(p.paperType || 'Prelims')
    setEditDuration(p.durationMinutes || 180)
    setEditMarks(p.marksPerQuestion || 1.5)
    setEditNeg(p.negativeMarking || 0)
  }

  const handleSaveEditPaper = async () => {
    if (!editPaper || savingEdit) return
    setSavingEdit(true)
    setBanner(null)
    try {
      const res = await apiFetch(`/api/admin/previous-papers/${editPaper.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperTitle: editTitle.trim(),
          year: editYear,
          medium: editMedium,
          paperType: editPaperType,
          durationMinutes: editDuration,
          marksPerQuestion: editMarks,
          negativeMarking: editNeg,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Failed to update examination.' })
        return
      }
      setBanner({ type: 'success', text: `Updated "${editTitle.trim()}".` })
      setEditPaper(null)
      void loadDashboard()
    } finally {
      setSavingEdit(false)
    }
  }

  const toggleSort = (col: 'year' | 'exam') => {
    if (sortBy === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else {
      setSortBy(col)
      setSortDir(col === 'year' ? 'desc' : 'asc')
    }
    setTablePage(1)
  }

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

  // Live validation & count reconciliation summary for parsed pasted questions
  const pasteSummary = useMemo(() => {
    const totalDetected = parsedQuestions.length
    const missingOptionsCount = parsedQuestions.filter(
      (q) => !q.optionA.trim() || !q.optionB.trim() || !q.optionC.trim() || !q.optionD.trim()
    ).length
    const missingAnswersCount = parsedQuestions.filter((q) => q.correctAnswer === null).length
    const duplicateCount = parsedQuestions.filter((q) => q.isDuplicate).length
    const invalidCount = parsedQuestions.filter(
      (q) =>
        !q.questionText.trim() ||
        !q.optionA.trim() ||
        !q.optionB.trim() ||
        !q.optionC.trim() ||
        !q.optionD.trim() ||
        q.correctAnswer === null
    ).length
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
    const successfullyParsed = totalDetected - needsReviewCount
    const rawEstimatedCount = Math.max(lastParseSummary?.rawEstimatedCount ?? totalDetected, totalDetected)
    const lostQuestionsEstimate = Math.max(0, rawEstimatedCount - totalDetected)
    const missingSequenceNumbers = lastParseSummary?.missingSequenceNumbers ?? []
    const failedQuestions = parsedQuestions
      .filter((q) => q.needsReview)
      .map((q) => ({
        questionNumber: q.questionNumber,
        originalQuestionNumber: q.originalQuestionNumber,
        issues: q.issues,
      }))

    return {
      rawEstimatedCount,
      totalPasted: totalDetected,
      totalDetected,
      successfullyParsed,
      invalidCount,
      missingOptionsCount,
      missingAnswersCount,
      duplicateCount,
      needsReviewCount,
      lostQuestionsEstimate,
      missingSequenceNumbers,
      failedQuestions,
    }
  }, [parsedQuestions, lastParseSummary])

  const handleParsePastedText = async () => {
    if (isParsing) return
    if (!rawPasteText.trim()) {
      setBanner({ type: 'error', text: 'Please paste your Previous Year Questions into the editor first.' })
      return
    }
    setBanner(null)
    setIsParsing(true)
    setParseProgress({
      currentQuestionNumber: 0,
      processed: 0,
      total: 0,
      valid: 0,
      needsReview: 0,
      missingOptions: 0,
      missingAnswers: 0,
      answerConflicts: 0,
      done: false,
    })
    try {
      const result = await parsePastedPreviousYearQuestionsAsync(
        rawPasteText,
        uPaperTitle.trim() || 'General Studies',
        (prog) => setParseProgress(prog),
        50
      )
      setParsedQuestions(result.questions)
      setLastParseSummary(result.summary)
      setSelectedClientIds(new Set(result.questions.map((q) => q.clientId)))
      setHasParsed(true)
      setPasteFilter('all')
      setPasteSearch('')
      setPastePage(1)
      setShowParseDiagnostics(result.summary.lostQuestionsEstimate > 0 || result.summary.missingSequenceNumbers.length > 0)

      if (result.questions.length === 0) {
        setBanner({
          type: 'error',
          text: 'No questions could be detected. Ensure each question starts with a number (1., Q1., QUESTION 1:) followed by options A–D.',
        })
      } else if (result.summary.lostQuestionsEstimate > 0) {
        setBanner({
          type: 'error',
          text: `Detected ${result.summary.totalDetected} questions (${result.summary.successfullyParsed} valid, ${result.summary.needsReviewCount} needing review), but raw text markers suggest ~${result.summary.rawEstimatedCount} questions (${result.summary.lostQuestionsEstimate} potentially unparsed). Review diagnostics below.`,
        })
      } else {
        setBanner({
          type: 'success',
          text: `Parsing Completed: ${result.summary.totalDetected} / ${result.summary.totalDetected} detected (${result.summary.successfullyParsed} valid, ${result.summary.needsReviewCount} requiring review).`,
        })
      }
    } finally {
      setIsParsing(false)
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
        const statusFlags: ParsedPreviousPaperQuestion['statusFlags'] = []
        const issues: string[] = []
        if (!next.questionText.trim()) {
          statusFlags.push('EMPTY_QUESTION')
          issues.push('Question text is empty')
        }
        if (missingOptions) {
          statusFlags.push('MISSING_OPTIONS')
          issues.push('MISSING_OPTIONS (incomplete options A–D)')
        }
        if (missingAnswer) {
          statusFlags.push('MISSING_ANSWER')
          issues.push('MISSING_ANSWER')
        }
        if (next.isDuplicate) {
          statusFlags.push('DUPLICATE')
          issues.push(`Duplicate of Question #${next.duplicateOfNumber || '?'}`)
        }
        return {
          ...next,
          missingOptions,
          missingAnswer,
          statusFlags,
          issues,
          needsReview: issues.length > 0,
        }
      })
    )
  }

  const deleteParsedRow = (idx: number) => {
    setParsedQuestions((prev) => {
      const removed = prev[idx]
      if (removed) {
        setSelectedClientIds((sel) => {
          const nextSel = new Set(sel)
          nextSel.delete(removed.clientId)
          return nextSel
        })
      }
      return prev
        .filter((_, i) => i !== idx)
        .map((q, newIdx) => ({ ...q, questionNumber: newIdx + 1 }))
    })
  }

  const addManualParsedRow = () => {
    const newId = `pyp_manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    setParsedQuestions((prev) => [
      ...prev,
      {
        clientId: newId,
        questionNumber: prev.length + 1,
        originalQuestionNumber: String(prev.length + 1),
        originalQuestionText: '',
        questionText: '',
        rawSourceBlock: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        originalAnswer: null,
        validatedAnswer: null,
        correctAnswer: null,
        answerVerificationStatus: 'ANSWER_MISSING',
        verificationSource: 'None',
        explanation: '',
        subject: uPaperTitle.trim() || 'General Studies',
        topic: '',
        medium: uMedium === 'Tamil' ? 'Tamil' : 'English',
        source: 'Previous Year Paper',
        contentIntegrity: { isComplete: true, totalSourceLines: 0, preservedLines: 0, preservedLineRatio: 1, missingLines: [] },
        isDuplicate: false,
        duplicateOfNumber: null,
        missingOptions: true,
        missingAnswer: true,
        hasAnswerConflict: false,
        needsReview: true,
        statusFlags: ['EMPTY_QUESTION', 'MISSING_OPTIONS', 'MISSING_ANSWER'],
        issues: ['Question text is empty', 'MISSING_OPTIONS', 'MISSING_ANSWER'],
      },
    ])
    setSelectedClientIds((sel) => new Set(sel).add(newId))
    setHasParsed(true)
  }

  const toggleSelectQuestion = (clientId: string) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }

  const handleSaveQuestionsToStaging = async (mode: 'selected' | 'valid' | 'all') => {
    if (savingToStaging) return
    if (!uPaperTitle.trim()) {
      setBanner({ type: 'error', text: 'Please enter a Paper Title in Step 1 before saving to Staging.' })
      return
    }
    const questionsToSave =
      mode === 'valid'
        ? parsedQuestions.filter((q) => !q.needsReview)
        : mode === 'selected'
          ? parsedQuestions.filter((q) => selectedClientIds.has(q.clientId))
          : parsedQuestions

    if (questionsToSave.length === 0) {
      setBanner({
        type: 'error',
        text:
          mode === 'valid'
            ? 'No valid questions are ready to save. Fix questions needing review first.'
            : 'No questions selected to save to Staging.',
      })
      return
    }
    setSavingToStaging(true)
    setBanner(null)
    try {
      const res = await apiFetch('/api/admin/previous-papers/manual-paste', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        timeoutMs: 60000,
        body: JSON.stringify({
          group: uGroup,
          year: uYear,
          examStream: uExamStream.trim(),
          paperTitle: uPaperTitle.trim(),
          paperType: uPaperType,
          medium: uMedium,
          totalQuestions: Math.max(uTotalQuestions, questionsToSave.length),
          marksPerQuestion: uMarksPerQ,
          negativeMarking: uNegMark,
          durationMinutes: uDuration,
          questions: questionsToSave.map((q) => ({
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

      const insertedCount = json.data?.questions?.length ?? 0
      const failedCount = Math.max(0, questionsToSave.length - insertedCount)
      setRawPasteText('')
      setParsedQuestions([])
      setLastParseSummary(null)
      setParseProgress(null)
      setSelectedClientIds(new Set())
      setHasParsed(false)
      setUPaperTitle('')
      setActivePaper(json.data.paper)
      setStagingQuestions(json.data.questions || [])
      setStagingFilter('all')
      setViewMode('staging')
      setBanner({
        type: failedCount > 0 ? 'error' : 'success',
        text:
          failedCount > 0
            ? `Saved ${insertedCount} of ${questionsToSave.length} question(s) to STAGING (${failedCount} failed).`
            : `Successfully saved all ${insertedCount} question(s) to STAGING! Review, approve questions, and publish when ready.`,
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

  const visibleParsedQuestions = useMemo(() => {
    const query = pasteSearch.trim().toLowerCase()
    return parsedQuestions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => {
        if (pasteFilter === 'review' && !q.needsReview) return false
        if (pasteFilter === 'duplicates' && !q.isDuplicate) return false
        if (pasteFilter === 'valid' && q.needsReview) return false
        if (pasteFilter === 'missing_options' && !q.missingOptions) return false
        if (pasteFilter === 'missing_answers' && !q.missingAnswer) return false
        if (query) {
          const hay = `${q.originalQuestionNumber} ${q.questionText} ${q.optionA} ${q.optionB} ${q.optionC} ${q.optionD} ${q.explanation} ${q.subject} ${q.topic}`.toLowerCase()
          if (!hay.includes(query)) return false
        }
        return true
      })
  }, [parsedQuestions, pasteFilter, pasteSearch])

  const totalPastePages = Math.max(1, Math.ceil(visibleParsedQuestions.length / pastePageSize))
  const safePastePage = Math.min(pastePage, totalPastePages)
  const paginatedParsedQuestions = useMemo(() => {
    const start = (safePastePage - 1) * pastePageSize
    return visibleParsedQuestions.slice(start, start + pastePageSize)
  }, [visibleParsedQuestions, safePastePage, pastePageSize])

  const selectedCount = useMemo(
    () => parsedQuestions.filter((q) => selectedClientIds.has(q.clientId)).length,
    [parsedQuestions, selectedClientIds]
  )

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
            className="pypm-btn pypm-btn-purple"
            onClick={() => {
              setBanner(null)
              setViewMode('ai_pdf')
            }}
          >
            <Sparkles size={15} />
            <span>Gemini AI Text / JSON to MCQ</span>
          </button>
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
              <Filter size={14} /> {showTrash ? 'Trash Filters' : 'Filters'}
            </div>
            <select
              value={filterGroup}
              onChange={(e) => {
                setFilterGroup(e.target.value)
                setTablePage(1)
              }}
              className="pypm-input"
            >
              <option value="all">All TNPSC Groups</option>
              {GROUP_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value)
                setTablePage(1)
              }}
              className="pypm-input"
            >
              <option value="all">All Years</option>
              {(stats?.byYear || []).map((y) => (
                <option key={y.year} value={String(y.year)}>{y.year}</option>
              ))}
            </select>
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => {
                setFilterSearch(e.target.value)
                setTablePage(1)
              }}
              placeholder="Search paper title..."
              className="pypm-input"
            />
            <select
              value={filterMedium}
              onChange={(e) => {
                setFilterMedium(e.target.value)
                setTablePage(1)
              }}
              className="pypm-input"
            >
              <option value="all">All Mediums</option>
              <option value="English">English</option>
              <option value="Tamil">Tamil</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value)
                setTablePage(1)
              }}
              className="pypm-input"
            >
              <option value="all">All Statuses</option>
              <option value="staging">Staging</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* PERMANENT BULK ACTION TOOLBAR — Always visible directly below Filters */}
          <div className="pypm-permanent-bulk-bar" role="toolbar" aria-label="Previous Year Papers Bulk Actions">
            <div className="pypm-permanent-bulk-actions">
              <button
                type="button"
                className="pypm-bulk-action-btn pypm-btn-purple-blue"
                disabled={papers.length === 0}
                onClick={toggleHeaderCheckbox}
                title={
                  papers.length === 0
                    ? 'No visible examinations to select'
                    : allOnPageSelected
                      ? 'Deselect all examinations on current page'
                      : `Select all ${papers.length} visible examination(s) on this page`
                }
              >
                <CheckSquare size={15} />
                <span>{allOnPageSelected ? 'Deselect All Visible' : 'Select All Visible'}</span>
              </button>

              <button
                type="button"
                className="pypm-bulk-action-btn pypm-btn-green"
                disabled={effectiveSelectedCount === 0 || showTrash}
                onClick={() => void openBulkConfirmModal('approve')}
                title={
                  showTrash
                    ? 'Switch to Active Examinations to approve'
                    : effectiveSelectedCount === 0
                      ? 'Select one or more examinations to approve'
                      : `Approve ${effectiveSelectedCount} selected examination(s)`
                }
              >
                <CheckCircle2 size={15} />
                <span>Approve Selected ({effectiveSelectedCount})</span>
              </button>

              <button
                type="button"
                className="pypm-bulk-action-btn pypm-btn-orange"
                disabled={effectiveSelectedCount === 0 || showTrash}
                onClick={() => void openBulkConfirmModal('reject')}
                title={
                  showTrash
                    ? 'Switch to Active Examinations to reject'
                    : effectiveSelectedCount === 0
                      ? 'Select one or more examinations to reject'
                      : `Reject ${effectiveSelectedCount} selected examination(s)`
                }
              >
                <XCircle size={15} />
                <span>Reject Selected ({effectiveSelectedCount})</span>
              </button>

              <button
                type="button"
                className="pypm-bulk-action-btn pypm-btn-emerald"
                disabled={effectiveSelectedCount === 0 || showTrash}
                onClick={() => void openBulkConfirmModal('publish')}
                title={
                  showTrash
                    ? 'Switch to Active Examinations to publish'
                    : effectiveSelectedCount === 0
                      ? 'Select one or more approved examinations to publish'
                      : `Bulk publish ${effectiveSelectedCount} selected examination(s)`
                }
              >
                <Send size={15} />
                <span>Bulk Publish Selected ({effectiveSelectedCount})</span>
              </button>

              <button
                type="button"
                className="pypm-bulk-action-btn pypm-btn-danger"
                disabled={effectiveSelectedCount === 0 || showTrash}
                onClick={() => void openBulkConfirmModal('delete')}
                title={
                  showTrash
                    ? 'Already in Trash'
                    : effectiveSelectedCount === 0
                      ? 'Select one or more examinations to move to Trash'
                      : `Move ${effectiveSelectedCount} selected examination(s) to Trash`
                }
              >
                <Trash2 size={15} />
                <span>Delete Selected ({effectiveSelectedCount})</span>
              </button>

              <button
                type="button"
                className="pypm-bulk-action-btn pypm-btn-dark-red"
                disabled={tablePagination.total === 0 || showTrash}
                onClick={() => void openBulkConfirmModal('delete', 'filtered')}
                title={
                  showTrash
                    ? 'Already in Trash'
                    : tablePagination.total === 0
                      ? 'No filtered examinations available to delete'
                      : `Delete all ${tablePagination.total} examination(s) matching current filters across all pages`
                }
              >
                <AlertTriangle size={15} />
                <span>Delete All Filtered ({showTrash ? 0 : tablePagination.total})</span>
              </button>

              {showTrash && effectiveSelectedCount > 0 && (
                <button
                  type="button"
                  className="pypm-bulk-action-btn pypm-btn-emerald"
                  onClick={() => void handleRestorePapers(Array.from(selectedPaperIds))}
                >
                  <RotateCcw size={15} />
                  <span>Restore Selected ({effectiveSelectedCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Examinations Table */}
          <div className="glass" style={{ borderRadius: '16px', overflowX: 'auto', padding: '0.85rem' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading examinations...</div>
            ) : papers.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                {showTrash
                  ? 'Trash is empty. Soft-deleted examinations will appear here for recovery.'
                  : 'No previous year examinations match your filters. Click "Paste Previous Year Questions" to create one.'}
              </div>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 0.5rem', width: '64px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <input
                            type="checkbox"
                            className="pypm-checkbox"
                            checked={allOnPageSelected}
                            onChange={toggleHeaderCheckbox}
                            aria-label="Select all examinations on current page"
                          />
                          <div className="pypm-dropdown-wrap">
                            <button
                              type="button"
                              onClick={() => setSelectMenuOpen((o) => !o)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#cbd5e1',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'inline-flex',
                              }}
                              title="Selection Scope Options"
                              aria-label="Selection Scope Options"
                            >
                              <ChevronDown size={14} />
                            </button>
                            {selectMenuOpen && effectiveSelectedCount === 0 && (
                              <div className="pypm-dropdown-menu align-left">
                                <button type="button" className="pypm-dropdown-item" onClick={selectCurrentPagePapers}>
                                  <span>Select Current Page ({papers.length})</span>
                                </button>
                                <button type="button" className="pypm-dropdown-item" onClick={selectAllFilteredPapers}>
                                  <span>Select All Filtered ({tablePagination.total})</span>
                                </button>
                                <button type="button" className="pypm-dropdown-item" onClick={selectAllDatabasePapers}>
                                  <span>Select All in Database ({totalDbActiveCount})</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>
                        <button type="button" className="pypm-sort-btn" onClick={() => toggleSort('year')}>
                          <span>Year</span>
                          <ArrowUpDown size={12} />
                        </button>
                      </th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>
                        <button type="button" className="pypm-sort-btn" onClick={() => toggleSort('exam')}>
                          <span>Examination</span>
                          <ArrowUpDown size={12} />
                        </button>
                      </th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Medium</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>Total Qs</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>Parsed</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>Approved</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>Needs Review</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Publication Status</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {papers.map((p) => {
                      const stStyle = STATUS_BADGE_COLORS[p.status] || STATUS_BADGE_COLORS.staging
                      const checked = isPaperSelected(p.id)
                      return (
                        <tr
                          key={p.id}
                          className={`pypm-table-row ${checked ? 'is-selected' : ''}`}
                        >
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <input
                              type="checkbox"
                              className="pypm-checkbox"
                              checked={checked}
                              onChange={() => toggleSinglePaper(p.id)}
                              aria-label={`Select ${p.paperTitle}`}
                            />
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: '#fde047' }}>{p.year}</td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <div style={{ color: '#f8fafc', fontWeight: 700 }}>{p.exam} — {p.paperTitle}</div>
                            <div style={{ fontSize: '0.73rem', color: '#94a3b8' }}>
                              {p.paperType} · {p.durationMinutes} mins · {p.marksPerQuestion} marks/Q
                              {p.negativeMarking > 0 ? ` · -${p.negativeMarking} negative` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', color: '#cbd5e1' }}>{p.medium}</td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontWeight: 700, color: '#e2e8f0' }}>
                            {p.expectedQuestions || p.totalQuestions || p.questionCount}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontWeight: 600, color: '#cbd5e1' }}>
                            {p.questionCount}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontWeight: 700, color: '#34d399' }}>
                            {p.approvedQuestionCount ?? 0}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontWeight: 700, color: p.flaggedCount > 0 ? '#fbbf24' : '#64748b' }}>
                            {p.flaggedCount}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: '9999px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background: stStyle.bg,
                                color: stStyle.color,
                                border: `1px solid ${stStyle.border}`,
                              }}
                            >
                              {showTrash ? 'TRASHED' : p.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {showTrash ? (
                                <button
                                  type="button"
                                  className="pypm-btn pypm-btn-green pypm-btn-sm"
                                  onClick={() => void handleRestorePapers([p.id])}
                                >
                                  <RotateCcw size={13} /> Restore
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                                    onClick={() => void openStagingReview(p.id)}
                                    title={p.status === 'published' ? 'View Details & Questions' : 'Review & Approve Questions'}
                                  >
                                    <Eye size={13} /> {p.status === 'published' ? 'View' : 'Review'}
                                  </button>
                                  <button
                                    type="button"
                                    className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                                    onClick={() => openEditModal(p)}
                                    title="Edit Examination Metadata"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  {p.status === 'approved' || p.status === 'unpublished' ? (
                                    <button
                                      type="button"
                                      className="pypm-btn pypm-btn-green pypm-btn-sm"
                                      onClick={() => void openBulkConfirmModal('publish', 'selected', p)}
                                    >
                                      <Send size={13} /> Publish
                                    </button>
                                  ) : p.status === 'published' ? (
                                    <button
                                      type="button"
                                      className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                                      onClick={() => void openBulkConfirmModal('unpublish', 'selected', p)}
                                    >
                                      <EyeOff size={13} /> Unpublish
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="pypm-btn pypm-btn-danger pypm-btn-sm"
                                    onClick={() => void openBulkConfirmModal('delete', 'selected', p)}
                                    title="Move to Trash"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Pagination Bar */}
                <div className="pypm-pagination-bar">
                  <span>
                    Showing page <strong>{tablePagination.page}</strong> of <strong>{tablePagination.totalPages}</strong> (
                    <strong>{tablePagination.total}</strong> examination{tablePagination.total === 1 ? '' : 's'})
                  </span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <select
                      value={tablePageSize}
                      onChange={(e) => {
                        setTablePageSize(Number(e.target.value))
                        setTablePage(1)
                      }}
                      className="pypm-input"
                      style={{ width: 'auto', padding: '0.35rem 0.6rem', fontSize: '0.76rem' }}
                    >
                      <option value={10}>10 / page</option>
                      <option value={15}>15 / page</option>
                      <option value={25}>25 / page</option>
                      <option value={50}>50 / page</option>
                    </select>
                    <button
                      type="button"
                      className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                      disabled={tablePage <= 1}
                      onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={14} /> Prev
                    </button>
                    <button
                      type="button"
                      className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                      disabled={tablePage >= tablePagination.totalPages}
                      onClick={() => setTablePage((p) => Math.min(tablePagination.totalPages, p + 1))}
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* VIEW 1B: AI QUESTION GENERATION — CLAUDE AI & GOOGLE GEMINI AI PDF TO MCQ */}
      {viewMode === 'ai_pdf' && (
        <PreviousPaperAiPdfGenerator
          token={token}
          onSavedToStaging={(paperId, savedCount) => {
            setBanner({
              type: 'success',
              text: `Saved ${savedCount} AI-extracted question(s) to Staging (Examination #${paperId}). Review, approve & publish when ready!`,
            })
            void loadDashboard()
            void openStagingReview(paperId)
          }}
        />
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
                  max={1000}
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
                onClick={() => void handleParsePastedText()}
                disabled={!rawPasteText.trim() || isParsing}
              >
                {isParsing ? <Loader2 size={17} className="pypm-spin" /> : <Sparkles size={17} />}
                <span>{isParsing ? 'Parsing Questions...' : 'STEP 3 — PARSE QUESTIONS'}</span>
              </button>
            </div>

            {parseProgress && parseProgress.total > 0 && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '10px',
                  background: 'rgba(15,23,42,0.65)',
                  border: '1px solid rgba(56,189,248,0.28)',
                  fontSize: '0.82rem',
                  color: '#cbd5e1',
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <span>
                  {parseProgress.done ? 'Parsing Completed' : 'Parsing Questions'}:{' '}
                  <strong style={{ color: '#38bdf8' }}>
                    {parseProgress.processed} / {parseProgress.total}
                  </strong>
                </span>
                <span>
                  Valid Questions: <strong style={{ color: '#34d399' }}>{parseProgress.valid}</strong> · Needs Review:{' '}
                  <strong style={{ color: '#fbbf24' }}>{parseProgress.needsReview}</strong>
                </span>
              </div>
            )}
          </div>

          {/* STEP 4 & 5 – Validation Summary, Editable Preview, and Save All to Staging */}
          {hasParsed && (
            <div className="pypm-card" style={{ gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h3 className="pypm-section-heading" style={{ margin: 0 }}>
                  <CheckSquare size={19} />
                  <span>STEP 4 — Review Extracted Questions &amp; Validation Summary ({parsedQuestions.length} Total)</span>
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
                    className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                    disabled={savingToStaging || pasteSummary.successfullyParsed === 0 || !uPaperTitle.trim()}
                    onClick={() => void handleSaveQuestionsToStaging('valid')}
                  >
                    <Save size={14} /> Save All Valid ({pasteSummary.successfullyParsed})
                  </button>
                  <button
                    type="button"
                    className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                    disabled={savingToStaging || selectedCount === 0 || !uPaperTitle.trim()}
                    onClick={() => void handleSaveQuestionsToStaging('selected')}
                  >
                    <Save size={14} /> Save Selected ({selectedCount})
                  </button>
                  <button
                    type="button"
                    className="pypm-btn pypm-btn-primary"
                    disabled={savingToStaging || parsedQuestions.length === 0 || !uPaperTitle.trim()}
                    onClick={() => void handleSaveQuestionsToStaging('all')}
                  >
                    {savingToStaging ? <Loader2 size={15} className="pypm-spin" /> : <Save size={15} />}
                    <span>
                      {savingToStaging
                        ? 'Saving to Staging...'
                        : `STEP 5 — SAVE ALL QUESTIONS TO STAGING (${parsedQuestions.length})`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Validation & Count Reconciliation Summary Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '0.6rem' }}>
                {[
                  { label: 'Total Detected', val: pasteSummary.totalDetected, color: '#e2e8f0' },
                  { label: 'Successfully Parsed', val: pasteSummary.successfullyParsed, color: '#34d399' },
                  { label: 'Needs Review', val: pasteSummary.needsReviewCount, color: pasteSummary.needsReviewCount > 0 ? '#fbbf24' : '#34d399' },
                  { label: 'Missing Options', val: pasteSummary.missingOptionsCount, color: pasteSummary.missingOptionsCount > 0 ? '#f87171' : '#94a3b8' },
                  { label: 'Missing Answers', val: pasteSummary.missingAnswersCount, color: pasteSummary.missingAnswersCount > 0 ? '#fbbf24' : '#94a3b8' },
                  { label: 'Duplicates', val: pasteSummary.duplicateCount, color: pasteSummary.duplicateCount > 0 ? '#fb923c' : '#94a3b8' },
                  { label: 'Lost Questions', val: pasteSummary.lostQuestionsEstimate, color: pasteSummary.lostQuestionsEstimate > 0 ? '#f87171' : '#34d399' },
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

              {/* Count Mismatch / Sequence Gap Diagnostic Warning */}
              {(pasteSummary.lostQuestionsEstimate > 0 ||
                pasteSummary.missingSequenceNumbers.length > 0 ||
                pasteSummary.failedQuestions.length > 0) && (
                  <div
                    style={{
                      padding: '0.7rem 0.95rem',
                      borderRadius: '10px',
                      background: 'rgba(245,158,11,0.1)',
                      border: '1px solid rgba(251,191,36,0.35)',
                      color: '#fde68a',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span>
                        {pasteSummary.lostQuestionsEstimate > 0
                          ? `Warning: Raw text markers suggest ~${pasteSummary.rawEstimatedCount} questions, while ${pasteSummary.totalDetected} were parsed (${pasteSummary.lostQuestionsEstimate} potentially skipped).`
                          : pasteSummary.missingSequenceNumbers.length > 0
                            ? `Sequence gap detected: missing original question number(s): ${pasteSummary.missingSequenceNumbers.slice(0, 20).join(', ')}${pasteSummary.missingSequenceNumbers.length > 20 ? '...' : ''}.`
                            : `${pasteSummary.failedQuestions.length} question(s) need administrator review before publishing.`}
                      </span>
                      <button
                        type="button"
                        className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                        onClick={() => setShowParseDiagnostics((v) => !v)}
                      >
                        {showParseDiagnostics ? 'Hide Diagnostics' : `View Diagnostics (${pasteSummary.failedQuestions.length})`}
                      </button>
                    </div>
                    {showParseDiagnostics && pasteSummary.failedQuestions.length > 0 && (
                      <div style={{ marginTop: '0.55rem', maxHeight: '140px', overflowY: 'auto', fontSize: '0.75rem', color: '#fef08a' }}>
                        {pasteSummary.failedQuestions.map((f) => (
                          <div key={`${f.questionNumber}-${f.originalQuestionNumber}`}>
                            • Q{f.questionNumber} (Orig #{f.originalQuestionNumber}): {f.issues.join('; ')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              {/* Filter Tabs, Search & Bulk Selection Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'all' as const, label: `All Questions (${parsedQuestions.length})` },
                    { id: 'valid' as const, label: `Valid (${pasteSummary.successfullyParsed})` },
                    { id: 'review' as const, label: `Needs Review (${pasteSummary.needsReviewCount})` },
                    { id: 'missing_options' as const, label: `Missing Options (${pasteSummary.missingOptionsCount})` },
                    { id: 'missing_answers' as const, label: `Missing Answers (${pasteSummary.missingAnswersCount})` },
                    { id: 'duplicates' as const, label: `Duplicates (${pasteSummary.duplicateCount})` },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`pypm-btn pypm-btn-sm ${pasteFilter === f.id ? 'pypm-btn-primary' : 'pypm-btn-secondary'}`}
                      onClick={() => {
                        setPasteFilter(f.id)
                        setPastePage(1)
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="pypm-input"
                    value={pasteSearch}
                    onChange={(e) => {
                      setPasteSearch(e.target.value)
                      setPastePage(1)
                    }}
                    placeholder="Search parsed questions..."
                    style={{ minWidth: '200px' }}
                  />
                  <button
                    type="button"
                    className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                    onClick={() => setSelectedClientIds(new Set(parsedQuestions.map((q) => q.clientId)))}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                    onClick={() =>
                      setSelectedClientIds(new Set(parsedQuestions.filter((q) => !q.needsReview).map((q) => q.clientId)))
                    }
                  >
                    Select Valid
                  </button>
                  <button
                    type="button"
                    className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                    onClick={() => setSelectedClientIds(new Set())}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Pagination Controls (display only — full dataset remains intact in memory) */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                }}
              >
                <span>
                  Showing{' '}
                  {visibleParsedQuestions.length === 0
                    ? 0
                    : (safePastePage - 1) * pastePageSize + 1}{' '}
                  – {Math.min(safePastePage * pastePageSize, visibleParsedQuestions.length)} of{' '}
                  <strong style={{ color: '#e2e8f0' }}>{visibleParsedQuestions.length}</strong> matching questions (Total in dataset:{' '}
                  <strong style={{ color: '#38bdf8' }}>{parsedQuestions.length}</strong>)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <select
                    className="pypm-input"
                    value={pastePageSize}
                    onChange={(e) => {
                      setPastePageSize(Number(e.target.value))
                      setPastePage(1)
                    }}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
                  >
                    {[10, 25, 50, 100].map((sz) => (
                      <option key={sz} value={sz}>
                        {sz} / page
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                    disabled={safePastePage <= 1}
                    onClick={() => setPastePage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <span>
                    Page {safePastePage} / {totalPastePages}
                  </span>
                  <button
                    type="button"
                    className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                    disabled={safePastePage >= totalPastePages}
                    onClick={() => setPastePage((p) => Math.min(totalPastePages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* Parsed Questions List (Paginated Display) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {paginatedParsedQuestions.map(({ q, idx }) => (
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
                        <input
                          type="checkbox"
                          checked={selectedClientIds.has(q.clientId)}
                          onChange={() => toggleSelectQuestion(q.clientId)}
                          title="Select question for staging import"
                        />
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

      {/* MODAL 1: BULK / INDIVIDUAL PUBLISH, UNPUBLISH, DELETE CONFIRMATION */}
      {confirmModal && (
        <div className="pypm-modal-backdrop" role="dialog" aria-modal="true" aria-label={confirmModal.title}>
          <div className="pypm-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.08rem', color: confirmModal.action === 'delete' ? '#fca5a5' : '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {confirmModal.action === 'delete' ? <AlertTriangle size={19} /> : <Send size={18} />}
                <span>{confirmModal.title}</span>
              </h3>
              <button
                type="button"
                className="pypm-btn-icon"
                onClick={() => !executingBulk && setConfirmModal(null)}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {loadingPreview ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                <Loader2 size={22} className="pypm-spin" />
                <div style={{ marginTop: '0.45rem' }}>Validating PostgreSQL examination records...</div>
              </div>
            ) : previewData ? (
              <>
                <div className="pypm-preview-grid">
                  <div className="pypm-preview-stat">
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Selected Examinations</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#e9d5ff' }}>{previewData.totalSelected}</div>
                  </div>
                  <div className="pypm-preview-stat">
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Total Questions</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>{previewData.totalQuestions.toLocaleString()}</div>
                  </div>
                  <div className="pypm-preview-stat">
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Approved Questions</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34d399' }}>{previewData.approvedQuestions.toLocaleString()}</div>
                  </div>
                  <div className="pypm-preview-stat">
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Questions Requiring Review</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: previewData.needsReviewQuestions > 0 ? '#fbbf24' : '#94a3b8' }}>
                      {previewData.needsReviewQuestions.toLocaleString()}
                    </div>
                  </div>
                </div>

                {confirmModal.action === 'approve' && (
                  <div
                    style={{
                      padding: '0.75rem 0.95rem',
                      borderRadius: '11px',
                      background: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(52,211,153,0.32)',
                      fontSize: '0.82rem',
                      color: '#a7f3d0',
                    }}
                  >
                    <strong>Eligible Examinations to Approve: {previewData.eligibleForApprove ?? 0}</strong>
                    <div style={{ color: '#cbd5e1', marginTop: '0.3rem', fontSize: '0.76rem' }}>
                      Valid staging examinations will have their questions approved and status moved to <strong>APPROVED</strong>. Already published or incomplete papers will be skipped safely.
                    </div>
                  </div>
                )}

                {confirmModal.action === 'reject' && (
                  <div
                    style={{
                      padding: '0.8rem 0.95rem',
                      borderRadius: '11px',
                      background: 'rgba(249,115,22,0.12)',
                      border: '1px solid rgba(251,146,60,0.38)',
                      fontSize: '0.8rem',
                      color: '#fed7aa',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <strong>{previewData.eligibleForReject ?? previewData.totalSelected}</strong> examination(s) will be marked <strong>REJECTED</strong> and kept out of the published Student Website.
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#fdba74', marginBottom: '0.3rem', fontWeight: 700 }}>
                        Rejection Reason (preserved in PostgreSQL &amp; Audit Log):
                      </label>
                      <input
                        type="text"
                        className="pypm-input"
                        value={rejectionReasonInput}
                        onChange={(e) => setRejectionReasonInput(e.target.value)}
                        placeholder="e.g., Answer key mismatch or incomplete questions"
                      />
                    </div>
                  </div>
                )}

                {confirmModal.action === 'publish' && (
                  <div
                    style={{
                      padding: '0.75rem 0.95rem',
                      borderRadius: '11px',
                      background: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(52,211,153,0.32)',
                      fontSize: '0.82rem',
                      color: '#a7f3d0',
                    }}
                  >
                    <strong>Eligible Examinations to Publish: {previewData.eligibleForPublish}</strong>
                    {previewData.ineligibleCount > 0 && (
                      <div style={{ color: '#fcd34d', marginTop: '0.35rem', fontSize: '0.78rem' }}>
                        {previewData.ineligibleCount} examination(s) will be skipped (not approved, already published, or have questions requiring review).
                      </div>
                    )}
                    {previewData.sampleIneligible.length > 0 && (
                      <ul style={{ margin: '0.4rem 0 0 1.1rem', padding: 0, fontSize: '0.74rem', color: '#cbd5e1' }}>
                        {previewData.sampleIneligible.map((item) => (
                          <li key={item.paperId}>
                            {item.paperTitle}: {item.reason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {confirmModal.action === 'delete' && (
                  <div
                    style={{
                      padding: '0.8rem 0.95rem',
                      borderRadius: '11px',
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(248,113,113,0.35)',
                      fontSize: '0.8rem',
                      color: '#fecaca',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.55rem',
                    }}
                  >
                    <div>
                      Selected examinations will be moved to recoverable <strong>Trash</strong> (soft delete). Question Bank records, Study Materials, Textbooks, and Student Performance History will <strong>NOT</strong> be deleted.
                    </div>
                    {confirmModal.scope === 'all' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', color: '#fca5a5', marginBottom: '0.35rem', fontWeight: 700 }}>
                          Super Admin Guard — Type <code>DELETE ALL EXAMINATIONS</code> to confirm:
                        </label>
                        <input
                          type="text"
                          className="pypm-input"
                          value={deleteConfirmInput}
                          onChange={(e) => setDeleteConfirmInput(e.target.value)}
                          placeholder="DELETE ALL EXAMINATIONS"
                        />
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                className="pypm-btn pypm-btn-secondary"
                disabled={executingBulk}
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`pypm-btn ${confirmModal.action === 'delete'
                    ? 'pypm-btn-danger'
                    : confirmModal.action === 'reject'
                      ? 'pypm-btn-orange'
                      : confirmModal.action === 'publish' || confirmModal.action === 'approve'
                        ? 'pypm-btn-green'
                        : 'pypm-btn-primary'
                  }`}
                disabled={
                  executingBulk ||
                  loadingPreview ||
                  (confirmModal.action === 'approve' && (previewData?.eligibleForApprove ?? 0) === 0) ||
                  (confirmModal.action === 'publish' && (previewData?.eligibleForPublish ?? 0) === 0) ||
                  (confirmModal.action === 'delete' &&
                    confirmModal.scope === 'all' &&
                    deleteConfirmInput.trim() !== 'DELETE ALL EXAMINATIONS')
                }
                onClick={() => void executeConfirmedAction()}
              >
                {executingBulk && <Loader2 size={14} className="pypm-spin" />}
                <span>
                  {executingBulk
                    ? 'Processing...'
                    : confirmModal.action === 'approve'
                      ? 'Confirm Approve'
                      : confirmModal.action === 'reject'
                        ? 'Confirm Reject'
                        : confirmModal.action === 'publish'
                          ? 'Confirm Publish'
                          : confirmModal.action === 'unpublish'
                            ? 'Confirm Unpublish'
                            : 'Confirm Delete'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT EXAMINATION METADATA */}
      {editPaper && (
        <div className="pypm-modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit Examination">
          <div className="pypm-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#facc15', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Edit3 size={17} /> Edit Examination #{editPaper.id}
              </h3>
              <button type="button" className="pypm-btn-icon" onClick={() => setEditPaper(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="pypm-form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <div className="pypm-field pypm-field-span-2">
                <label className="pypm-label">Paper Title</label>
                <input type="text" className="pypm-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="pypm-field">
                <label className="pypm-label">Year</label>
                <input type="number" className="pypm-input" value={editYear} onChange={(e) => setEditYear(Number(e.target.value))} />
              </div>
              <div className="pypm-field">
                <label className="pypm-label">Medium</label>
                <select className="pypm-input" value={editMedium} onChange={(e) => setEditMedium(e.target.value)}>
                  <option value="English">English</option>
                  <option value="Tamil">Tamil</option>
                </select>
              </div>
              <div className="pypm-field">
                <label className="pypm-label">Paper Type</label>
                <select className="pypm-input" value={editPaperType} onChange={(e) => setEditPaperType(e.target.value)}>
                  <option value="Prelims">Prelims</option>
                  <option value="Mains">Mains</option>
                </select>
              </div>
              <div className="pypm-field">
                <label className="pypm-label">Duration (Mins)</label>
                <input type="number" className="pypm-input" value={editDuration} onChange={(e) => setEditDuration(Number(e.target.value))} />
              </div>
              <div className="pypm-field">
                <label className="pypm-label">Marks / Question</label>
                <input type="number" step="0.25" className="pypm-input" value={editMarks} onChange={(e) => setEditMarks(Number(e.target.value))} />
              </div>
              <div className="pypm-field">
                <label className="pypm-label">Negative Marking</label>
                <input type="number" step="0.05" className="pypm-input" value={editNeg} onChange={(e) => setEditNeg(Number(e.target.value))} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button type="button" className="pypm-btn pypm-btn-secondary" onClick={() => setEditPaper(null)}>
                Cancel
              </button>
              <button type="button" className="pypm-btn pypm-btn-primary" disabled={savingEdit} onClick={() => void handleSaveEditPaper()}>
                {savingEdit ? <Loader2 size={14} className="pypm-spin" /> : <Save size={14} />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: AUDIT LOGS */}
      {auditModalOpen && (
        <div className="pypm-modal-backdrop" role="dialog" aria-modal="true" aria-label="Audit Logs">
          <div className="pypm-modal-card" style={{ maxWidth: '720px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <History size={17} /> Previous Year Papers Audit Log
              </h3>
              <button type="button" className="pypm-btn-icon" onClick={() => setAuditModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            {loadingAudit ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>Loading audit history...</div>
            ) : auditLogs.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>No audit entries recorded yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                      background: 'rgba(15,23,42,0.75)',
                      border: '1px solid rgba(148,163,184,0.16)',
                      fontSize: '0.78rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong style={{ color: '#fde047' }}>{log.action}</strong>
                      <span style={{ color: '#94a3b8' }}>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <div style={{ color: '#e2e8f0', marginTop: '0.2rem' }}>
                      Admin: <strong>{log.adminId}</strong> · Paper #{log.paperId ?? '—'}{' '}
                      {log.paperTitle ? `(${log.paperTitle})` : ''}
                    </div>
                    <div style={{ color: '#94a3b8', marginTop: '0.15rem' }}>
                      Status: {log.previousStatus || '—'} → <strong style={{ color: '#34d399' }}>{log.newStatus || '—'}</strong>
                      {log.bulkOperationId ? ` · Bulk Op: ${log.bulkOperationId}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PreviousYearPapersManager
