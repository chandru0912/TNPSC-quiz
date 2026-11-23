import React, { useEffect, useMemo, useState } from 'react'
import {
  Sparkles,
  Layers,
  Target,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Globe,
  FileX,
  Search,
  Edit3,
  Clock,
  Award,
  FileText,
  ChevronLeft,
  ChevronRight,
  Database,
  CheckSquare,
  Square,
} from 'lucide-react'
import { apiFetch } from '../../utils/api'
import { notifyStudentSync } from '../../utils/studentSync'
import {
  getSubjectsForGroup,
  getStandardsForSubject,
} from '../../data/unifiedSyllabusRegistry'
import {
  dynamicSyllabusService,
  type DynamicUnit,
} from '../../services/dynamicSyllabusService'
import './MockTestManagement.css'

type GeneratorMode = 'unit_wise' | 'full_length'

interface MockTestMcqGeneratorProps {
  token: string
  onPublishedCountChange?: (count: number) => void
}

interface GeneratedQuestion {
  id: number
  category: string
  unitId: number | null
  classId: number | null
  subject: string
  lessonTitle: string
  topic: string | null
  difficulty: 'Easy' | 'Medium' | 'Hard'
  question: string
  options: string[]
  correctAnswer: number
  explanation?: string
  status: string
  language?: string
  targetSystem?: string
}

interface AvailabilityData {
  totalAvailable: number
  byDifficulty: { Easy: number; Medium: number; Hard: number }
  byLesson: Array<{ lessonTitle: string; standardId: number | null; unitId: number | null; count: number }>
  byStandard: Array<{ standardId: number; count: number }>
}

interface MockTestQueueRow {
  id: number
  title: string
  description: string
  tnpscGroup: string
  testCategory: 'lesson_wise' | GeneratorMode
  subject: string
  standard: string | null
  unit: string | null
  lesson: string | null
  questionsCount: number
  assignedQuestionsCount: number
  durationMinutes: number
  totalMarks: number
  marksPerQuestion: number
  negativeMarking: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  status: 'draft' | 'staging' | 'published' | 'scheduled' | 'archived'
  createdAt: string
}

const GROUPS = [
  { id: 'group1' as const, label: 'Group 1', display: 'TNPSC Group 1' },
  { id: 'group2' as const, label: 'Group 2', display: 'TNPSC Group 2 & 2A' },
  { id: 'group4' as const, label: 'Group 4', display: 'TNPSC Group 4 & VAO' },
]

const QUEUE_PAGE_SIZE = 8
const BANK_PAGE_SIZE = 10

export const MockTestMcqGenerator: React.FC<MockTestMcqGeneratorProps> = ({
  token,
  onPublishedCountChange,
}) => {
  const [mode, setMode] = useState<GeneratorMode>('unit_wise')

  // Question Bank Filters
  const [groupId, setGroupId] = useState<'group1' | 'group2' | 'group4'>('group1')
  const [subjectId, setSubjectId] = useState<string>('general-studies')
  const [singleStandard, setSingleStandard] = useState<number>(6)
  const [selectedStandards, setSelectedStandards] = useState<number[]>([6, 7, 8, 9, 10])
  const [standardQuotas, setStandardQuotas] = useState<Record<number, number>>({})
  const [singleUnit, setSingleUnit] = useState<number>(1)
  const [selectedUnits, setSelectedUnits] = useState<number[]>([])
  const [questionType, setQuestionType] = useState<'all' | 'main_practice' | 'study_materials'>('all')
  const [difficulty, setDifficulty] = useState<'all' | 'Easy' | 'Medium' | 'Hard'>('all')
  const [includeStaging, setIncludeStaging] = useState<boolean>(false)
  const [language, setLanguage] = useState<'all' | 'english' | 'tamil'>('all')
  const [bankSearch, setBankSearch] = useState<string>('')
  const [bankPage, setBankPage] = useState<number>(1)

  // Dynamic Study Materials Units
  const [units, setUnits] = useState<DynamicUnit[]>([])
  const [loadingSyllabus, setLoadingSyllabus] = useState(false)

  // Live Question Pool Availability & Embedded Question Bank Table
  const [availability, setAvailability] = useState<AvailabilityData | null>(null)
  const [loadingAvail, setLoadingAvail] = useState(false)
  const [bankQuestions, setBankQuestions] = useState<GeneratedQuestion[]>([])
  const [bankTotal, setBankTotal] = useState<number>(0)
  const [loadingBank, setLoadingBank] = useState(false)

  // Common Test Configuration
  const [editingTestId, setEditingTestId] = useState<number | null>(null)
  const [testTitle, setTestTitle] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [totalQuestions, setTotalQuestions] = useState<number>(50)
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(1.5)
  const [durationMinutes, setDurationMinutes] = useState<number>(45)
  const [negativeMarking, setNegativeMarking] = useState<number>(0)
  const [useDifficultySplit, setUseDifficultySplit] = useState<boolean>(false)
  const [easyPct, setEasyPct] = useState<number>(30)
  const [mediumPct, setMediumPct] = useState<number>(50)
  const [hardPct, setHardPct] = useState<number>(20)
  const [distributeAcrossLessons, setDistributeAcrossLessons] = useState<boolean>(true)
  const [distributeAcrossStandards, setDistributeAcrossStandards] = useState<boolean>(true)
  const [randomizeSelection, setRandomizeSelection] = useState<boolean>(true)
  const [randomizeOrder, setRandomizeOrder] = useState<boolean>(true)
  const [randomizeOptions, setRandomizeOptions] = useState<boolean>(false)

  // Selected / Generated Questions State
  const [selectedQuestions, setSelectedQuestions] = useState<GeneratedQuestion[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [replacingId, setReplacingId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)

  // Staging / Review / Publishing Queue
  const [queueTests, setQueueTests] = useState<MockTestQueueRow[]>([])
  const [loadingQueue, setLoadingQueue] = useState(false)
  const [queueSearch, setQueueSearch] = useState('')
  const [queueStatusFilter, setQueueStatusFilter] = useState<'all' | 'staging' | 'draft' | 'published'>('all')
  const [queueCategoryFilter, setQueueCategoryFilter] = useState<'all' | GeneratorMode>('all')
  const [queuePage, setQueuePage] = useState(1)

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    [token]
  )

  const groupSubjects = useMemo(() => getSubjectsForGroup(groupId), [groupId])
  const activeSubject = useMemo(
    () => groupSubjects.find((s) => s.id === subjectId) || groupSubjects[0],
    [groupSubjects, subjectId]
  )
  const groupStandards = useMemo(
    () => getStandardsForSubject(groupId, activeSubject?.id || 'general-studies'),
    [groupId, activeSubject]
  )
  const totalMarks = useMemo(
    () => Number((totalQuestions * marksPerQuestion).toFixed(2)),
    [totalQuestions, marksPerQuestion]
  )

  const selectedIdSet = useMemo(() => new Set(selectedQuestions.map((q) => q.id)), [selectedQuestions])
  const duplicateCount = selectedQuestions.length - selectedIdSet.size
  const remainingRequired = Math.max(0, totalQuestions - selectedQuestions.length)

  // Keep subject & standards valid when switching Group
  useEffect(() => {
    const validSubs = getSubjectsForGroup(groupId)
    if (!validSubs.some((s) => s.id === subjectId)) {
      setSubjectId(validSubs[0]?.id || 'general-studies')
    }
    const validStds = getStandardsForSubject(groupId, validSubs[0]?.id || 'general-studies').map((s) => s.id)
    if (!validStds.includes(singleStandard)) {
      setSingleStandard(validStds[0] || 6)
    }
    setSelectedStandards((prev) => {
      const filtered = prev.filter((id) => validStds.includes(id))
      return filtered.length > 0 ? filtered : validStds
    })
    setBankPage(1)
  }, [groupId])

  const handleModeSwitch = (nextMode: GeneratorMode) => {
    setMode(nextMode)
    setEditingTestId(null)
    setSelectedQuestions([])
    setFeedback(null)
    setBankPage(1)
    if (nextMode === 'full_length') {
      setTotalQuestions(100)
      setDurationMinutes(90)
      setUseDifficultySplit(true)
    } else {
      setTotalQuestions(50)
      setDurationMinutes(45)
      setUseDifficultySplit(false)
    }
  }

  // Load dynamic Units from Study Materials
  useEffect(() => {
    let mounted = true
    setLoadingSyllabus(true)
    const stdForUnits = mode === 'full_length' ? (selectedStandards[0] || 6) : singleStandard
    dynamicSyllabusService
      .getUnits(groupId, subjectId, stdForUnits, { allowEmpty: true })
      .then((uList) => {
        if (!mounted) return
        setUnits(uList)
        if (uList.length > 0 && !uList.some((u) => Number(u.unit_number) === singleUnit)) {
          setSingleUnit(Number(uList[0].unit_number) || 1)
        }
      })
      .catch(() => {
        if (mounted) setUnits([])
      })
      .finally(() => {
        if (mounted) setLoadingSyllabus(false)
      })
    return () => {
      mounted = false
    }
  }, [groupId, subjectId, singleStandard, selectedStandards, mode])

  // Build shared filter query string for Availability & Question Bank Table
  const buildFilterParams = (includePagination = false) => {
    const params = new URLSearchParams()
    params.set('mode', mode)
    params.set('group', GROUPS.find((g) => g.id === groupId)?.label || 'Group 1')
    params.set('subject', activeSubject?.name || 'General Studies')

    const activeStds = mode === 'full_length' ? selectedStandards : [singleStandard]
    if (activeStds.length > 0) params.set('standards', activeStds.join(','))

    const activeUnits = mode === 'full_length' ? selectedUnits : [singleUnit]
    if (activeUnits.length > 0) params.set('units', activeUnits.join(','))

    if (questionType !== 'all') params.set('questionType', questionType)
    if (difficulty !== 'all') params.set('difficulty', difficulty)
    if (language !== 'all') params.set('language', language)
    if (includeStaging) params.set('includeStaging', 'true')
    if (bankSearch.trim()) params.set('search', bankSearch.trim())
    if (includePagination) {
      params.set('limit', String(BANK_PAGE_SIZE))
      params.set('offset', String((bankPage - 1) * BANK_PAGE_SIZE))
    }
    return params
  }

  // Fetch live Question Pool Availability
  useEffect(() => {
    if (!token) return
    let mounted = true
    setLoadingAvail(true)
    const params = buildFilterParams(false)
    apiFetch(`/api/admin/mock-tests/generator/availability?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (mounted && d?.status === 'success' && d.data) {
          setAvailability(d.data)
        }
      })
      .catch(() => {
        if (mounted) setAvailability(null)
      })
      .finally(() => {
        if (mounted) setLoadingAvail(false)
      })
    return () => {
      mounted = false
    }
  }, [
    token,
    mode,
    groupId,
    activeSubject,
    singleStandard,
    selectedStandards,
    singleUnit,
    selectedUnits,
    questionType,
    difficulty,
    language,
    includeStaging,
    bankSearch,
  ])

  // Fetch Embedded Question Bank Selection Table
  useEffect(() => {
    if (!token) return
    let mounted = true
    setLoadingBank(true)
    const params = buildFilterParams(true)
    apiFetch(`/api/admin/mock-tests/generator/questions?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (mounted && d?.status === 'success' && d.data) {
          setBankQuestions(Array.isArray(d.data.questions) ? d.data.questions : [])
          setBankTotal(Number(d.data.total || 0))
        }
      })
      .catch(() => {
        if (mounted) {
          setBankQuestions([])
          setBankTotal(0)
        }
      })
      .finally(() => {
        if (mounted) setLoadingBank(false)
      })
    return () => {
      mounted = false
    }
  }, [
    token,
    mode,
    groupId,
    activeSubject,
    singleStandard,
    selectedStandards,
    singleUnit,
    selectedUnits,
    questionType,
    difficulty,
    language,
    includeStaging,
    bankSearch,
    bankPage,
  ])

  // Fetch Staging / Draft / Published Mock Tests Queue
  const fetchQueue = async () => {
    if (!token) return
    try {
      setLoadingQueue(true)
      const params = new URLSearchParams()
      if (queueSearch.trim()) params.set('search', queueSearch.trim())
      if (queueStatusFilter !== 'all') params.set('status', queueStatusFilter)
      if (queueCategoryFilter !== 'all') params.set('testCategory', queueCategoryFilter)

      const res = await apiFetch(`/api/admin/mock-tests?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (res.ok && json.status === 'success') {
        const list = Array.isArray(json.data?.tests) ? json.data.tests : []
        setQueueTests(list)
        if (onPublishedCountChange && typeof json.data?.stats?.publishedTests === 'number') {
          onPublishedCountChange(json.data.stats.publishedTests)
        }
      }
    } catch {
      // preserve current queue
    } finally {
      setLoadingQueue(false)
    }
  }

  useEffect(() => {
    fetchQueue()
  }, [token, queueStatusFilter, queueCategoryFilter])

  const buildDefaultTestTitle = () => {
    const grpLabel = GROUPS.find((g) => g.id === groupId)?.display || 'TNPSC Group 1'
    const subLabel = activeSubject?.name || 'General Studies'
    if (mode === 'unit_wise') {
      const unitObj = units.find((u) => Number(u.unit_number) === singleUnit)
      return `${grpLabel} — ${singleStandard}th Std Unit ${singleUnit}${unitObj ? ` (${unitObj.title})` : ''} Test`
    }
    const stdText =
      selectedStandards.length === 1
        ? `${selectedStandards[0]}th Standard`
        : `${Math.min(...selectedStandards)}th–${Math.max(...selectedStandards)}th Std`
    return `${grpLabel} — ${subLabel} (${stdText}) Full-length Mock Test`
  }

  // Toggle single question from Question Bank table (strict duplicate prevention)
  const toggleBankQuestion = (q: GeneratedQuestion) => {
    setSelectedQuestions((prev) => {
      if (prev.some((item) => item.id === q.id)) {
        return prev.filter((item) => item.id !== q.id)
      }
      return [...prev, q]
    })
  }

  // Select All questions currently shown on the Question Bank page
  const handleSelectAllOnPage = () => {
    setSelectedQuestions((prev) => {
      const existingIds = new Set(prev.map((q) => q.id))
      const additions = bankQuestions.filter((q) => !existingIds.has(q.id))
      return [...prev, ...additions]
    })
  }

  const handleDeselectAll = () => {
    setSelectedQuestions([])
  }

  // Auto-Random Select Questions from Existing Question Bank
  const handleAutoRandomSelect = async () => {
    setFeedback(null)
    if (mode === 'full_length' && selectedStandards.length === 0) {
      setFeedback({ type: 'warning', text: 'Please select at least one Standard (6th–12th) for the Full-length Mock Test.' })
      return
    }
    if (availability && availability.totalAvailable < totalQuestions) {
      setFeedback({
        type: 'warning',
        text: `Only ${availability.totalAvailable} eligible questions match your Question Bank filters, but ${totalQuestions} were requested.`,
      })
      return
    }

    const activeStandardDistribution: Record<number, number> = {}
    if (mode === 'full_length') {
      for (const sId of selectedStandards) {
        const quota = Number(standardQuotas[sId] || 0)
        if (quota > 0) activeStandardDistribution[sId] = quota
      }
    }

    try {
      setGenerating(true)
      const res = await apiFetch('/api/admin/mock-tests/generator/generate', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          mode,
          group: GROUPS.find((g) => g.id === groupId)?.label || 'Group 1',
          subject: activeSubject?.name || 'General Studies',
          standards: mode === 'full_length' ? selectedStandards : [singleStandard],
          units: mode === 'full_length' ? selectedUnits : [singleUnit],
          questionType,
          difficulty,
          language,
          includeStaging,
          totalQuestions,
          difficultyDistribution: useDifficultySplit ? { easyPct, mediumPct, hardPct } : undefined,
          standardDistribution: Object.keys(activeStandardDistribution).length > 0 ? activeStandardDistribution : undefined,
          distributeAcrossLessons: mode === 'unit_wise' ? distributeAcrossLessons : false,
          distributeAcrossStandards: mode === 'full_length' ? distributeAcrossStandards : false,
          randomizeSelection,
          randomizeOrder,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.status !== 'success') {
        setFeedback({ type: 'error', text: json.message || 'Failed to select questions from Question Bank.' })
        return
      }
      const list: GeneratedQuestion[] = Array.isArray(json.data?.questions) ? json.data.questions : []
      setSelectedQuestions(list)
      if (!testTitle.trim()) {
        setTestTitle(buildDefaultTestTitle())
      }
      setFeedback({
        type: 'success',
        text: `Selected ${list.length} unique questions from ${json.data?.eligibleCount ?? list.length} matching Question Bank records.`,
      })
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Network error while selecting questions.' })
    } finally {
      setGenerating(false)
    }
  }

  // Replace a single question in preview with a fresh non-duplicate from the same scope
  const handleReplaceQuestion = async (idx: number) => {
    const target = selectedQuestions[idx]
    if (!target) return
    try {
      setReplacingId(target.id)
      const excludeIds = selectedQuestions.map((q) => q.id)
      const res = await apiFetch('/api/admin/mock-tests/generator/generate', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          mode,
          group: GROUPS.find((g) => g.id === groupId)?.label || 'Group 1',
          subject: activeSubject?.name || 'General Studies',
          standards: mode === 'full_length' ? selectedStandards : [singleStandard],
          units: mode === 'full_length' ? selectedUnits : [singleUnit],
          questionType,
          difficulty,
          language,
          includeStaging,
          totalQuestions: 1,
          randomizeSelection: true,
          randomizeOrder: false,
          excludeIds,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.status !== 'success' || !json.data?.questions?.[0]) {
        setFeedback({ type: 'warning', text: json.message || 'No additional unused questions available in this filter scope.' })
        return
      }
      const replacement: GeneratedQuestion = json.data.questions[0]
      setSelectedQuestions((prev) => prev.map((q, i) => (i === idx ? replacement : q)))
      setFeedback({ type: 'success', text: `Replaced Question #${idx + 1} with #${replacement.id}.` })
    } catch {
      setFeedback({ type: 'error', text: 'Failed to replace question.' })
    } finally {
      setReplacingId(null)
    }
  }

  const handleMoveQuestion = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir
    if (nextIdx < 0 || nextIdx >= selectedQuestions.length) return
    setSelectedQuestions((prev) => {
      const copy = [...prev]
      const temp = copy[idx]
      copy[idx] = copy[nextIdx]
      copy[nextIdx] = temp
      return copy
    })
  }

  const handleRemoveQuestion = (id: number) => {
    setSelectedQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  // Validate selection via backend API, then Save Draft or Save to Staging
  const handleSaveTest = async (targetStatus: 'draft' | 'staging') => {
    const finalTitle = testTitle.trim() || buildDefaultTestTitle()
    if (selectedQuestions.length < totalQuestions) {
      setFeedback({
        type: 'warning',
        text: `Insufficient selected questions: ${selectedQuestions.length} selected, but ${totalQuestions} required (${totalQuestions - selectedQuestions.length} remaining). Select more questions or adjust Total Questions.`,
      })
      return
    }
    if (marksPerQuestion <= 0 || durationMinutes < 5) {
      setFeedback({ type: 'warning', text: 'Please enter valid Marks Per Question (> 0) and Exam Duration (>= 5 mins).' })
      return
    }

    try {
      setSaving(true)
      setFeedback(null)

      // 1. Validate selected question IDs against PostgreSQL Question Bank
      const valRes = await apiFetch('/api/admin/mock-tests/generator/validate-selection', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          questionIds: selectedQuestions.map((q) => q.id),
          includeStaging,
        }),
      })
      const valJson = await valRes.json()
      if (!valRes.ok || valJson.status !== 'success' || !valJson.data?.valid) {
        setFeedback({
          type: 'error',
          text: valJson?.data?.message || valJson?.message || 'Selected questions failed validation.',
        })
        return
      }

      const standardStr =
        mode === 'full_length'
          ? selectedStandards.length === 1
            ? `${selectedStandards[0]}th Standard`
            : `${selectedStandards.map((s) => `${s}th`).join(', ')} Standard`
          : `${singleStandard}th Standard`

      const payload = {
        title: finalTitle,
        description: description.trim() || `Created from Question Bank (${mode.replace('_', '-')})`,
        tnpscGroup: GROUPS.find((g) => g.id === groupId)?.label || 'Group 1',
        testCategory: mode,
        subject: activeSubject?.name || 'General Studies',
        standard: standardStr,
        unit: mode === 'full_length' ? null : `Unit ${singleUnit}`,
        lesson: null,
        questionsCount: selectedQuestions.length,
        durationMinutes,
        totalMarks: Number((selectedQuestions.length * marksPerQuestion).toFixed(2)),
        marksPerQuestion,
        negativeMarking,
        difficulty: difficulty === 'all' ? 'Medium' : difficulty,
        status: targetStatus,
        randomizePerAttempt: false,
        randomizeOptions,
        questionLanguage: language === 'tamil' ? 'ta' : language === 'english' ? 'en' : 'both',
        questionIds: selectedQuestions.map((q) => q.id),
      }

      const url = editingTestId ? `/api/admin/mock-tests/${editingTestId}` : '/api/admin/mock-tests'
      const method = editingTestId ? 'PUT' : 'POST'
      const res = await apiFetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || json.status !== 'success') {
        setFeedback({ type: 'error', text: json.message || 'Failed to save mock test.' })
        return
      }

      setEditingTestId(json.data?.id ?? editingTestId)
      setFeedback({
        type: 'success',
        text:
          targetStatus === 'staging'
            ? `Saved "${finalTitle}" to Staging! Review and click Approve & Publish below to publish live on Website & Android App.`
            : `Saved "${finalTitle}" as Draft.`,
      })
      fetchQueue()
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Network error saving mock test.' })
    } finally {
      setSaving(false)
    }
  }

  const handleStatusTransition = async (row: MockTestQueueRow, nextStatus: 'staging' | 'published') => {
    try {
      const res = await apiFetch(`/api/admin/mock-tests/${row.id}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: nextStatus }),
      })
      const json = await res.json()
      if (!res.ok || json.status !== 'success') {
        setFeedback({ type: 'error', text: json.message || 'Failed to update status.' })
        return
      }
      setFeedback({
        type: 'success',
        text:
          nextStatus === 'published'
            ? `"${row.title}" approved and published live to Website & Android App!`
            : `"${row.title}" unpublished and moved back to Staging.`,
      })
      notifyStudentSync()
      fetchQueue()
    } catch {
      setFeedback({ type: 'error', text: 'Failed to update test status.' })
    }
  }

  const handleLoadTestForEdit = async (testId: number) => {
    try {
      const res = await apiFetch(`/api/admin/mock-tests/${testId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok || json.status !== 'success' || !json.data) return
      const t = json.data
      setEditingTestId(t.id)
      setMode(t.testCategory === 'full_length' ? 'full_length' : 'unit_wise')
      setTestTitle(t.title || '')
      setDescription(t.description || '')
      setTotalQuestions(Number(t.questionsCount || 25))
      setMarksPerQuestion(Number(t.marksPerQuestion || 1.5))
      setDurationMinutes(Number(t.durationMinutes || 30))
      setNegativeMarking(Number(t.negativeMarking || 0))
      setRandomizeOptions(Boolean(t.randomizeOptions))
      setSelectedQuestions(Array.isArray(t.questions) ? t.questions : [])
      setFeedback({ type: 'success', text: `Loaded "${t.title}" into editor for review.` })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setFeedback({ type: 'error', text: 'Failed to load mock test details.' })
    }
  }

  const toggleStandard = (stdId: number) => {
    setSelectedStandards((prev) =>
      prev.includes(stdId) ? prev.filter((id) => id !== stdId) : [...prev, stdId].sort((a, b) => a - b)
    )
    setBankPage(1)
  }

  const toggleUnit = (unitNum: number) => {
    setSelectedUnits((prev) =>
      prev.includes(unitNum) ? prev.filter((u) => u !== unitNum) : [...prev, unitNum].sort((a, b) => a - b)
    )
    setBankPage(1)
  }

  const totalBankPages = Math.max(1, Math.ceil(bankTotal / BANK_PAGE_SIZE))
  const totalQueuePages = Math.max(1, Math.ceil(queueTests.length / QUEUE_PAGE_SIZE))
  const paginatedQueue = queueTests.slice((queuePage - 1) * QUEUE_PAGE_SIZE, queuePage * QUEUE_PAGE_SIZE)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* 1. Two Category Dashboard Cards (Unit-wise & Full-length) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1rem' }}>
        {[
          {
            id: 'unit_wise' as const,
            title: 'Unit-wise Test Generator',
            desc: 'Combine Question Bank MCQs across one Unit in one Standard (6th–12th, never mixing standards).',
            icon: Layers,
            accent: '#a78bfa',
          },
          {
            id: 'full_length' as const,
            title: 'Full-length Mock Test Generator',
            desc: 'Select Standards (6th–12th), configure per-Standard quotas & build full TNPSC exam-style mock tests.',
            icon: Target,
            accent: '#fbbf24',
          },
        ].map((card) => {
          const Icon = card.icon
          const active = mode === card.id
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleModeSwitch(card.id)}
              className="glass"
              style={{
                textAlign: 'left',
                padding: '1.1rem',
                borderRadius: '16px',
                cursor: 'pointer',
                border: active ? `1.5px solid ${card.accent}` : '1px solid rgba(255,255,255,0.1)',
                background: active
                  ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(15, 23, 42, 0.88))'
                  : 'rgba(15, 23, 42, 0.65)',
                boxShadow: active ? `0 8px 24px rgba(0,0,0,0.35), 0 0 18px ${card.accent}25` : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Icon size={20} style={{ color: card.accent }} />
                {active && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.18rem 0.55rem', borderRadius: '9999px', background: `${card.accent}25`, color: card.accent }}>
                    ACTIVE
                  </span>
                )}
              </div>
              <strong style={{ color: '#f8fafc', fontSize: '0.96rem' }}>{card.title}</strong>
              <span style={{ color: '#94a3b8', fontSize: '0.79rem', lineHeight: 1.45 }}>{card.desc}</span>
            </button>
          )
        })}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '0.85rem 1.1rem',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.86rem',
            background:
              feedback.type === 'success'
                ? 'rgba(16, 185, 129, 0.14)'
                : feedback.type === 'warning'
                  ? 'rgba(245, 158, 11, 0.14)'
                  : 'rgba(239, 68, 68, 0.14)',
            border:
              feedback.type === 'success'
                ? '1px solid rgba(52, 211, 153, 0.35)'
                : feedback.type === 'warning'
                  ? '1px solid rgba(251, 191, 36, 0.35)'
                  : '1px solid rgba(248, 113, 113, 0.35)',
            color:
              feedback.type === 'success'
                ? '#6ee7b7'
                : feedback.type === 'warning'
                  ? '#fde68a'
                  : '#fca5a5',
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 2. Question Bank Filter Panel + Live Selection Summary */}
      <div className="glass" style={{ padding: '1.35rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Database size={18} style={{ color: '#ffd700' }} />
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.06rem' }}>
                Question Bank Filters &amp; Selection Pool
              </h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                Directly connected to existing PostgreSQL Question Bank. References existing question IDs with zero duplication.
              </p>
            </div>
          </div>
          {editingTestId && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
              onClick={() => {
                setEditingTestId(null)
                setTestTitle('')
                setSelectedQuestions([])
              }}
            >
              + New Test
            </button>
          )}
        </div>

        {/* 9 Dynamic Filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '0.8rem', marginBottom: '0.95rem' }}>
          <div className="mtm-field">
            <label className="mtm-label">1. TNPSC Group *</label>
            <select className="mtm-select" value={groupId} onChange={(e) => setGroupId(e.target.value as any)}>
              {GROUPS.map((g) => (
                <option key={g.id} value={g.id}>{g.display}</option>
              ))}
            </select>
          </div>

          <div className="mtm-field">
            <label className="mtm-label">2. Subject *</label>
            <select className="mtm-select" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setBankPage(1) }}>
              {groupSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {mode !== 'full_length' && (
            <>
              <div className="mtm-field">
                <label className="mtm-label">3. Standard (6th–12th) *</label>
                <select className="mtm-select" value={singleStandard} onChange={(e) => { setSingleStandard(Number(e.target.value)); setBankPage(1) }}>
                  {groupStandards.map((st) => (
                    <option key={st.id} value={st.id}>{st.label}</option>
                  ))}
                </select>
              </div>

              <div className="mtm-field">
                <label className="mtm-label">4. Unit *</label>
                <select
                  className="mtm-select"
                  value={singleUnit}
                  onChange={(e) => { setSingleUnit(Number(e.target.value)); setBankPage(1) }}
                  disabled={loadingSyllabus}
                >
                  {units.length > 0 ? (
                    units.map((u) => (
                      <option key={u.unit_number} value={u.unit_number}>
                        Unit {u.unit_number}: {u.title}
                      </option>
                    ))
                  ) : (
                    [1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>Unit {n}</option>
                    ))
                  )}
                </select>
              </div>
            </>
          )}

          <div className="mtm-field">
            <label className="mtm-label">5. Question Type</label>
            <select className="mtm-select" value={questionType} onChange={(e) => { setQuestionType(e.target.value as any); setBankPage(1) }}>
              <option value="all">All Question Banks</option>
              <option value="main_practice">MCQ Practice Bank</option>
              <option value="study_materials">Study Materials Bank</option>
            </select>
          </div>

          <div className="mtm-field">
            <label className="mtm-label">6. Difficulty Level</label>
            <select className="mtm-select" value={difficulty} onChange={(e) => { setDifficulty(e.target.value as any); setBankPage(1) }}>
              <option value="all">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div className="mtm-field">
            <label className="mtm-label">7. Language</label>
            <select className="mtm-select" value={language} onChange={(e) => { setLanguage(e.target.value as any); setBankPage(1) }}>
              <option value="all">All Languages</option>
              <option value="english">English</option>
              <option value="tamil">Tamil (தமிழ்)</option>
            </select>
          </div>

          <div className="mtm-field">
            <label className="mtm-label">8. Question Status</label>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.52rem 0.7rem',
                borderRadius: '8px',
                background: 'rgba(15,23,42,0.75)',
                border: '1px solid rgba(255,255,255,0.14)',
                fontSize: '0.8rem',
                color: '#e2e8f0',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={includeStaging}
                onChange={(e) => { setIncludeStaging(e.target.checked); setBankPage(1) }}
              />
              <span>{includeStaging ? 'Published + Staging' : 'Published Only'}</span>
            </label>
          </div>
        </div>

        {/* Full-length Multi-Standard Scope & Per-Standard Distribution Quotas */}
        {mode === 'full_length' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', padding: '0.9rem', borderRadius: '12px', background: 'rgba(15,23,42,0.62)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fde047', marginBottom: '0.45rem' }}>
                Select Standards (6th–12th) &amp; Optional Per-Standard Question Distribution
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {groupStandards.map((st) => {
                  const checked = selectedStandards.includes(st.id)
                  const availForStd = availability?.byStandard.find((b) => b.standardId === st.id)?.count ?? 0
                  return (
                    <div
                      key={st.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.32rem 0.65rem',
                        borderRadius: '10px',
                        border: checked ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.12)',
                        background: checked ? 'rgba(139, 92, 246, 0.22)' : 'rgba(15, 23, 42, 0.7)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleStandard(st.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: checked ? '#f5f3ff' : '#94a3b8',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {st.label} ({availForStd} Qs)
                      </button>
                      {checked && (
                        <input
                          type="number"
                          min={0}
                          max={200}
                          placeholder="Auto"
                          title={`Target questions from ${st.label}`}
                          value={standardQuotas[st.id] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0)
                            setStandardQuotas((prev) => ({ ...prev, [st.id]: val }))
                          }}
                          style={{
                            width: '54px',
                            padding: '0.18rem 0.32rem',
                            borderRadius: '6px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(0,0,0,0.45)',
                            color: '#fde047',
                            fontSize: '0.74rem',
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                Applicable Units (Leave unselected to include all Units)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {(units.length > 0 ? units.map((u) => Number(u.unit_number)) : [1, 2, 3, 4, 5, 6]).map((uNum) => {
                  const checked = selectedUnits.includes(uNum)
                  return (
                    <button
                      key={uNum}
                      type="button"
                      onClick={() => toggleUnit(uNum)}
                      style={{
                        padding: '0.26rem 0.65rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: checked ? '1px solid #ffd700' : '1px solid rgba(255,255,255,0.12)',
                        background: checked ? 'rgba(255, 215, 0, 0.16)' : 'rgba(15, 23, 42, 0.7)',
                        color: checked ? '#fde047' : '#94a3b8',
                      }}
                    >
                      Unit {uNum}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Unit-wise Lesson-by-Lesson Available Counts */}
        {mode === 'unit_wise' && availability && availability.byLesson.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.9rem' }}>
            {availability.byLesson.map((item) => (
              <span
                key={`${item.standardId}-${item.unitId}-${item.lessonTitle}`}
                style={{
                  fontSize: '0.74rem',
                  padding: '0.22rem 0.6rem',
                  borderRadius: '9999px',
                  background: 'rgba(15, 23, 42, 0.78)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#e2e8f0',
                }}
              >
                {item.lessonTitle}: <strong style={{ color: '#ffd700' }}>{item.count} Qs</strong>
              </span>
            ))}
          </div>
        )}

        {/* Live Selection Summary Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
          <div style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Available in Bank</div>
            <strong style={{ fontSize: '1.1rem', color: '#38bdf8' }}>
              {loadingAvail ? '...' : availability?.totalAvailable ?? 0}
            </strong>
          </div>
          <div style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Selected Questions</div>
            <strong style={{ fontSize: '1.1rem', color: '#34d399' }}>{selectedQuestions.length}</strong>
          </div>
          <div style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Required Questions</div>
            <strong style={{ fontSize: '1.1rem', color: '#fde047' }}>{totalQuestions}</strong>
          </div>
          <div style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Remaining Needed</div>
            <strong style={{ fontSize: '1.1rem', color: remainingRequired > 0 ? '#fbbf24' : '#34d399' }}>
              {remainingRequired}
            </strong>
          </div>
          <div style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Duplicate Questions</div>
            <strong style={{ fontSize: '1.1rem', color: duplicateCount > 0 ? '#f87171' : '#34d399' }}>
              {duplicateCount}
            </strong>
          </div>
        </div>

        {/* Common Test Configuration */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.8rem', marginBottom: '0.9rem' }}>
          <div className="mtm-field" style={{ gridColumn: 'span 2' }}>
            <label className="mtm-label">Test Name *</label>
            <input
              type="text"
              className="mtm-input"
              placeholder={buildDefaultTestTitle()}
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
            />
          </div>
          <div className="mtm-field">
            <label className="mtm-label">Total Questions *</label>
            <input
              type="number"
              min={1}
              max={200}
              className="mtm-input"
              value={totalQuestions}
              onChange={(e) => setTotalQuestions(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
            />
          </div>
          <div className="mtm-field">
            <label className="mtm-label">Marks / Question</label>
            <input
              type="number"
              min={0.5}
              max={10}
              step={0.5}
              className="mtm-input"
              value={marksPerQuestion}
              onChange={(e) => setMarksPerQuestion(Math.max(0.5, Number(e.target.value) || 1.5))}
            />
          </div>
          <div className="mtm-field">
            <label className="mtm-label">Total Marks</label>
            <input type="text" className="mtm-input" value={`${totalMarks} Marks`} readOnly />
          </div>
          <div className="mtm-field">
            <label className="mtm-label">Exam Duration (mins)</label>
            <input
              type="number"
              min={5}
              max={300}
              className="mtm-input"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(5, Number(e.target.value) || 30))}
            />
          </div>
          <div className="mtm-field">
            <label className="mtm-label">Negative Marking</label>
            <input
              type="number"
              min={0}
              max={2}
              step={0.25}
              className="mtm-input"
              value={negativeMarking}
              onChange={(e) => setNegativeMarking(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
        </div>

        {/* Distribution & Randomization Toggles */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '0.9rem', fontSize: '0.8rem', color: '#e2e8f0' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.38rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={randomizeSelection} onChange={(e) => setRandomizeSelection(e.target.checked)} />
            <span>Question Randomization</span>
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.38rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={randomizeOrder} onChange={(e) => setRandomizeOrder(e.target.checked)} />
            <span>Randomize Order</span>
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.38rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={randomizeOptions} onChange={(e) => setRandomizeOptions(e.target.checked)} />
            <span>Option Randomization</span>
          </label>
          {mode === 'unit_wise' && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.38rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={distributeAcrossLessons} onChange={(e) => setDistributeAcrossLessons(e.target.checked)} />
              <span>Distribute Evenly Across Lessons</span>
            </label>
          )}
          {mode === 'full_length' && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.38rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={distributeAcrossStandards} onChange={(e) => setDistributeAcrossStandards(e.target.checked)} />
              <span>Balance Across Standards &amp; Units</span>
            </label>
          )}
          {difficulty === 'all' && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.38rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={useDifficultySplit} onChange={(e) => setUseDifficultySplit(e.target.checked)} />
              <span>Difficulty % Distribution</span>
            </label>
          )}
        </div>

        {difficulty === 'all' && useDifficultySplit && (
          <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', marginBottom: '0.95rem', padding: '0.7rem', borderRadius: '10px', background: 'rgba(15,23,42,0.65)', fontSize: '0.8rem', color: '#cbd5e1' }}>
            <label>
              Easy %:
              <input type="number" min={0} max={100} value={easyPct} onChange={(e) => setEasyPct(Number(e.target.value) || 0)} style={{ width: '60px', marginLeft: '0.35rem' }} className="mtm-input" />
            </label>
            <label>
              Medium %:
              <input type="number" min={0} max={100} value={mediumPct} onChange={(e) => setMediumPct(Number(e.target.value) || 0)} style={{ width: '60px', marginLeft: '0.35rem' }} className="mtm-input" />
            </label>
            <label>
              Hard %:
              <input type="number" min={0} max={100} value={hardPct} onChange={(e) => setHardPct(Number(e.target.value) || 0)} style={{ width: '60px', marginLeft: '0.35rem' }} className="mtm-input" />
            </label>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={generating}
            onClick={handleAutoRandomSelect}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <Sparkles size={15} />
            <span>{generating ? 'Selecting...' : `Auto-Random Select (${totalQuestions} Qs)`}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={bankQuestions.length === 0}
            onClick={handleSelectAllOnPage}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}
          >
            <CheckSquare size={14} />
            <span>Select All on Page</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={selectedQuestions.length === 0}
            onClick={handleDeselectAll}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}
          >
            <Square size={14} />
            <span>Deselect All</span>
          </button>
        </div>
      </div>

      {/* 3. Embedded Question Bank Selection Table */}
      <div className="glass" style={{ padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={17} style={{ color: '#38bdf8' }} />
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1rem' }}>
              Question Bank Selection ({bankTotal} Matching Questions)
            </h3>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.6rem', color: '#94a3b8' }} />
            <input
              type="text"
              className="mtm-input"
              placeholder="Search Question ID, text, or lesson..."
              value={bankSearch}
              onChange={(e) => { setBankSearch(e.target.value); setBankPage(1) }}
              style={{ paddingLeft: '1.9rem', width: '240px' }}
            />
          </div>
        </div>

        {loadingBank ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '1.25rem 0' }}>Loading Question Bank records...</p>
        ) : bankQuestions.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '1.25rem 0' }}>
            No questions match the current Question Bank filters. Try adjusting filters or enabling Staging questions.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {bankQuestions.map((q) => {
              const isSelected = selectedIdSet.has(q.id)
              return (
                <div
                  key={q.id}
                  onClick={() => toggleBankQuestion(q)}
                  style={{
                    padding: '0.8rem 0.95rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(139, 92, 246, 0.14)' : 'rgba(15, 23, 42, 0.72)',
                    border: isSelected ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    gap: '0.8rem',
                    alignItems: 'flex-start',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    style={{ marginTop: '0.2rem', cursor: 'pointer', flexShrink: 0 }}
                    aria-label={`Select question #${q.id}`}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.72rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 800, color: '#ffd700' }}>ID #{q.id}</span>
                      <span style={{ padding: '0.12rem 0.45rem', borderRadius: '9999px', background: 'rgba(56,189,248,0.14)', color: '#7dd3fc' }}>
                        {q.subject}
                      </span>
                      {q.classId && (
                        <span style={{ padding: '0.12rem 0.45rem', borderRadius: '9999px', background: 'rgba(168,85,247,0.16)', color: '#d8b4fe' }}>
                          {q.classId}th Std
                        </span>
                      )}
                      {q.unitId && (
                        <span style={{ padding: '0.12rem 0.45rem', borderRadius: '9999px', background: 'rgba(255,255,255,0.08)', color: '#cbd5e1' }}>
                          Unit {q.unitId}
                        </span>
                      )}
                      <span style={{ padding: '0.12rem 0.45rem', borderRadius: '9999px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                        {q.lessonTitle}
                      </span>
                      <span style={{ padding: '0.12rem 0.45rem', borderRadius: '9999px', background: 'rgba(245,158,11,0.14)', color: '#fcd34d' }}>
                        {q.difficulty}
                      </span>
                      <span style={{ padding: '0.12rem 0.45rem', borderRadius: '9999px', background: q.status === 'published' ? 'rgba(16,185,129,0.15)' : 'rgba(251,191,36,0.15)', color: q.status === 'published' ? '#34d399' : '#fbbf24' }}>
                        {q.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.86rem', color: '#f8fafc', marginBottom: '0.45rem', lineHeight: 1.45 }}>
                      {q.question}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.35rem', fontSize: '0.77rem' }}>
                      {(q.options || []).map((opt, oIdx) => {
                        const isAns = oIdx === q.correctAnswer
                        return (
                          <div
                            key={oIdx}
                            style={{
                              padding: '0.28rem 0.5rem',
                              borderRadius: '7px',
                              background: isAns ? 'rgba(16, 185, 129, 0.14)' : 'rgba(255,255,255,0.03)',
                              border: isAns ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid rgba(255,255,255,0.05)',
                              color: isAns ? '#6ee7b7' : '#cbd5e1',
                            }}
                          >
                            <strong>{String.fromCharCode(65 + oIdx)}.</strong> {opt}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {totalBankPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem', fontSize: '0.8rem', color: '#94a3b8' }}>
            <span>Showing {(bankPage - 1) * BANK_PAGE_SIZE + 1}–{Math.min(bankPage * BANK_PAGE_SIZE, bankTotal)} of {bankTotal}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <button type="button" className="btn btn-secondary" disabled={bankPage <= 1} onClick={() => setBankPage((p) => p - 1)} style={{ padding: '0.25rem 0.5rem' }}>
                <ChevronLeft size={14} />
              </button>
              <span>Page {bankPage} / {totalBankPages}</span>
              <button type="button" className="btn btn-secondary" disabled={bankPage >= totalBankPages} onClick={() => setBankPage((p) => p + 1)} style={{ padding: '0.25rem 0.5rem' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Selected Questions Preview, Replace/Remove & Save Workflow */}
      {selectedQuestions.length > 0 && (
        <div className="glass" style={{ padding: '1.35rem', borderRadius: '16px', border: '1px solid rgba(168, 85, 247, 0.32)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.95rem' }}>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.05rem' }}>
                Selected Questions Preview ({selectedQuestions.length} / {totalQuestions} Required • {Number((selectedQuestions.length * marksPerQuestion).toFixed(2))} Marks)
              </h3>
              <p style={{ margin: '0.18rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                Verify selected question IDs, replace or reorder items, then Save Draft or Save to Staging for Admin Approval.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving || selectedQuestions.length < totalQuestions}
                onClick={() => handleSaveTest('draft')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Save size={15} />
                <span>{saving ? 'Validating & Saving...' : 'Save Draft'}</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || selectedQuestions.length < totalQuestions}
                onClick={() => handleSaveTest('staging')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <CheckCircle2 size={15} />
                <span>{saving ? 'Validating & Saving...' : 'Save to Staging (For Review)'}</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '460px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {selectedQuestions.map((q, idx) => (
              <div
                key={q.id}
                style={{
                  padding: '0.8rem 0.95rem',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.78)',
                  border: '1px solid rgba(255,255,255,0.09)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '0.38rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.73rem' }}>
                    <span style={{ fontWeight: 800, color: '#ffd700' }}>Q{idx + 1} (ID #{q.id})</span>
                    {q.classId && <span style={{ color: '#7dd3fc' }}>{q.classId}th Std</span>}
                    {q.unitId && <span style={{ color: '#d8b4fe' }}>Unit {q.unitId}</span>}
                    <span style={{ color: '#cbd5e1' }}>{q.lessonTitle}</span>
                    <span style={{ color: '#fcd34d' }}>• {q.difficulty}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.28rem' }}>
                    <button type="button" className="mtm-icon-btn" title="Move Up" disabled={idx === 0} onClick={() => handleMoveQuestion(idx, -1)}>
                      <ArrowUp size={13} />
                    </button>
                    <button type="button" className="mtm-icon-btn" title="Move Down" disabled={idx === selectedQuestions.length - 1} onClick={() => handleMoveQuestion(idx, 1)}>
                      <ArrowDown size={13} />
                    </button>
                    <button type="button" className="mtm-icon-btn" title="Replace Question" disabled={replacingId === q.id} onClick={() => handleReplaceQuestion(idx)}>
                      <RefreshCw size={13} />
                    </button>
                    <button type="button" className="mtm-icon-btn" title="Remove Question" onClick={() => handleRemoveQuestion(q.id)}>
                      <Trash2 size={13} style={{ color: '#f87171' }} />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#f8fafc', lineHeight: 1.4 }}>{q.question}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Staging, Review & Publishing Queue */}
      <div className="glass" style={{ padding: '1.35rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.9rem' }}>
          <div>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.05rem' }}>Staging, Approval &amp; Publishing Queue</h3>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              Published Mock Tests automatically sync to both the TNPSC Study Hub Website and Android Application.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.55rem', color: '#94a3b8' }} />
              <input
                type="text"
                className="mtm-input"
                placeholder="Search tests..."
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchQueue()}
                style={{ paddingLeft: '1.85rem', width: '165px' }}
              />
            </div>
            <select className="mtm-select" value={queueCategoryFilter} onChange={(e) => { setQueueCategoryFilter(e.target.value as any); setQueuePage(1) }} style={{ width: '135px' }}>
              <option value="all">All Categories</option>
              <option value="unit_wise">Unit-wise</option>
              <option value="full_length">Full-length</option>
            </select>
            <select className="mtm-select" value={queueStatusFilter} onChange={(e) => { setQueueStatusFilter(e.target.value as any); setQueuePage(1) }} style={{ width: '125px' }}>
              <option value="all">All Status</option>
              <option value="staging">Staging</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <button type="button" className="btn btn-secondary" onClick={fetchQueue} style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}>
              Refresh
            </button>
          </div>
        </div>

        {loadingQueue ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '1rem 0' }}>Loading mock tests...</p>
        ) : paginatedQueue.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '1rem 0' }}>No tests found for this filter.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.81rem', color: '#e2e8f0' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', textAlign: 'left', color: '#94a3b8' }}>
                  <th style={{ padding: '0.55rem 0.5rem' }}>Test Title</th>
                  <th style={{ padding: '0.55rem 0.5rem' }}>Category</th>
                  <th style={{ padding: '0.55rem 0.5rem' }}>Syllabus Scope</th>
                  <th style={{ padding: '0.55rem 0.5rem' }}>Config</th>
                  <th style={{ padding: '0.55rem 0.5rem' }}>Status</th>
                  <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedQueue.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600, color: '#f8fafc', maxWidth: '240px' }}>{row.title}</td>
                    <td style={{ padding: '0.6rem 0.5rem', whiteSpace: 'nowrap' }}>
                      {row.testCategory === 'lesson_wise' ? 'Lesson-wise' : row.testCategory === 'unit_wise' ? 'Unit-wise' : 'Full-length'}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                      {[row.tnpscGroup, row.subject, row.standard, row.unit, row.lesson].filter(Boolean).join(' • ')}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span>{row.assignedQuestionsCount || row.questionsCount} Qs</span>
                        <span><Clock size={11} /> {row.durationMinutes}m</span>
                        <span><Award size={11} /> {row.totalMarks}m</span>
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.71rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '0.18rem 0.55rem',
                          borderRadius: '9999px',
                          background:
                            row.status === 'published'
                              ? 'rgba(16, 185, 129, 0.16)'
                              : row.status === 'staging'
                                ? 'rgba(251, 191, 36, 0.16)'
                                : 'rgba(148, 163, 184, 0.16)',
                          color:
                            row.status === 'published'
                              ? '#34d399'
                              : row.status === 'staging'
                                ? '#fbbf24'
                                : '#cbd5e1',
                        }}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button type="button" className="btn btn-secondary" style={{ padding: '0.28rem 0.55rem', fontSize: '0.74rem' }} onClick={() => handleLoadTestForEdit(row.id)}>
                          <Edit3 size={12} style={{ marginRight: '0.25rem' }} />
                          Edit
                        </button>
                        {row.status !== 'published' ? (
                          <button type="button" className="btn btn-primary" style={{ padding: '0.28rem 0.6rem', fontSize: '0.74rem' }} onClick={() => handleStatusTransition(row, 'published')}>
                            <Globe size={12} style={{ marginRight: '0.25rem' }} />
                            Approve &amp; Publish
                          </button>
                        ) : (
                          <button type="button" className="btn btn-secondary" style={{ padding: '0.28rem 0.55rem', fontSize: '0.74rem' }} onClick={() => handleStatusTransition(row, 'staging')}>
                            <FileX size={12} style={{ marginRight: '0.25rem' }} />
                            Unpublish
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalQueuePages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginTop: '0.85rem', fontSize: '0.8rem', color: '#94a3b8' }}>
            <button type="button" className="btn btn-secondary" disabled={queuePage <= 1} onClick={() => setQueuePage((p) => p - 1)} style={{ padding: '0.25rem 0.5rem' }}>
              <ChevronLeft size={14} />
            </button>
            <span>Page {queuePage} of {totalQueuePages}</span>
            <button type="button" className="btn btn-secondary" disabled={queuePage >= totalQueuePages} onClick={() => setQueuePage((p) => p + 1)} style={{ padding: '0.25rem 0.5rem' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
