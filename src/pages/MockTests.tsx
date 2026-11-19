import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  Clock,
  FileText,
  Users,
  Play,
  Award,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Layers,
  Target,
  Sparkles,
  Eraser,
  Grid,
  ChevronRight,
  Languages,
  History,
} from 'lucide-react'
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker'
import { useMcqTranslations } from '../hooks/useMcqTranslations'
import { apiFetch } from '../utils/api'
import { notifyStudentSync, subscribeStudentSync } from '../utils/studentSync'
import {
  getSubjectsForGroup,
  getStandardsForSubject,
} from '../data/unifiedSyllabusRegistry'
import {
  dynamicSyllabusService,
  type DynamicUnit,
  type DynamicLesson,
} from '../services/dynamicSyllabusService'
import {
  AwardShieldLogo,
  LessonAwardSummaryBar,
  AwardCelebrationModal,
  type AchievementAwardResult,
} from '../components/exam/AchievementAwards'
import { AttemptHistoryModal } from '../components/exam/AttemptHistoryModal'
import { QuestionPalette, type QuestionPaletteStatus } from '../components/exam/QuestionPalette'
import './PreviousPaperTest.css'
import './MCQPractice.css'
import './MockTests.css'

type TnpscGroupTab = 'group1' | 'group2_2a' | 'group4'
type TestCategoryTab = 'lesson_wise' | 'unit_wise' | 'full_length'

interface PublishedMockTest {
  id: number
  slug: string
  title: string
  description?: string
  category: string
  categoryName: string
  tnpscGroup: string
  testCategory: TestCategoryTab
  subject: string
  standard: string | null
  unit: string | null
  lesson: string | null
  questionsCount: number
  durationMinutes: number
  totalMarks: number
  marksPerQuestion: number
  negativeMarking: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  status: string
  randomizePerAttempt?: boolean
  questionLanguage?: 'en' | 'ta' | 'both'
  publishedAt?: string
  attemptsCount: number
}

interface LiveExamQuestion {
  id: number
  order: number
  subject: string
  topic: string
  difficulty: string
  question: string
  options: string[]
}

interface ExamResultResponse {
  questionId: number
  questionText: string
  options: string[]
  subject: string
  topic: string
  selectedOption: number | null
  correctAnswer: number
  explanation: string
  isCorrect: boolean
}

interface ExamResultData {
  attemptId: number
  testTitle: string
  totalQuestions: number
  attemptedQuestions: number
  correctAnswers: number
  incorrectAnswers: number
  unansweredQuestions: number
  score: number
  maxScore: number
  percentage: number
  timeSpentSeconds: number
  responses: ExamResultResponse[]
}

const formatCountdown = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds))
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':')
}

const matchesGroup = (test: PublishedMockTest, selectedGroup: TnpscGroupTab): boolean => {
  const grp = `${test.category || ''} ${test.tnpscGroup || ''}`.toLowerCase()
  if (selectedGroup === 'group1') return grp.includes('group1') || grp.includes('group 1')
  if (selectedGroup === 'group2_2a') return grp.includes('group2') || grp.includes('group 2')
  if (selectedGroup === 'group4') return grp.includes('group4') || grp.includes('group 4') || grp.includes('vao')
  return false
}

const mapGroupToRegistryKey = (grp: TnpscGroupTab): 'group1' | 'group2' | 'group4' => {
  if (grp === 'group2_2a') return 'group2'
  if (grp === 'group4') return 'group4'
  return 'group1'
}

const parseStdNum = (std?: string | null): number | null => {
  if (!std) return null
  const m = String(std).match(/\d+/)
  return m ? Number(m[0]) : null
}

const MockTests = () => {
  useStudyTimeTracker()
  const navigate = useNavigate()

  const [selectedGroup, setSelectedGroup] = useState<TnpscGroupTab>('group1')
  const [selectedTestCategory, setSelectedTestCategory] = useState<TestCategoryTab>('lesson_wise')

  // Syllabus hierarchy selections
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('general-studies')
  const [selectedStandardId, setSelectedStandardId] = useState<number>(6)
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null)

  const [syllabusFacets, setSyllabusFacets] = useState<{
    subjects: { id?: string; name: string; questionCount: number }[]
    standards: { classId: number; questionCount: number }[]
    units: { unitId: number; questionCount: number }[]
    lessons: { lessonId: string | null; lessonTitle: string; questionCount: number }[]
  }>({ subjects: [], standards: [], units: [], lessons: [] })

  const [tests, setTests] = useState<PublishedMockTest[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Instructions modal before starting Full-length test
  const [pendingStartTest, setPendingStartTest] = useState<PublishedMockTest | null>(null)

  // Active Exam Runner State
  const [activeTest, setActiveTest] = useState<PublishedMockTest | null>(null)
  const [isSyllabusMode, setIsSyllabusMode] = useState(false)
  const [sessionId, setSessionId] = useState<number>(0)
  const [questions, setQuestions] = useState<LiveExamQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({})
  const [visitedQuestions, setVisitedQuestions] = useState<Record<number, boolean>>({ 0: true })
  const [isPaletteOpenMobile, setIsPaletteOpenMobile] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [questionLang, setQuestionLang] = useState<'en' | 'ta'>('en')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [examResult, setExamResult] = useState<ExamResultData | null>(null)
  const [showReview, setShowReview] = useState(false)
  const startTimestampRef = useRef<number>(Date.now())
  const submissionTokenRef = useRef<string>('')

  const registryGroup = mapGroupToRegistryKey(selectedGroup)

  const groups: { id: TnpscGroupTab; name: string }[] = [
    { id: 'group1', name: 'TNPSC Group 1' },
    { id: 'group2_2a', name: 'TNPSC Group 2 & 2A' },
    { id: 'group4', name: 'TNPSC Group 4 & VAO' },
  ]

  const testCategories: { id: TestCategoryTab; name: string; desc: string }[] = [
    { id: 'lesson_wise', name: 'Lesson-wise Tests', desc: 'Group → Subject → Standard → Unit → Lesson' },
    { id: 'unit_wise', name: 'Unit-wise Tests', desc: 'Group → Subject → Standard → Unit' },
    { id: 'full_length', name: 'Full-length Mock Tests', desc: 'Group → Standard → Full-length Exam' },
  ]

  const registrySubjects = useMemo(() => {
    return getSubjectsForGroup(registryGroup).map((sub) => {
      const matched = syllabusFacets.subjects.find(
        (f) => f.id === sub.id || f.name.toLowerCase() === sub.name.toLowerCase()
      )
      return { ...sub, questionCount: matched ? matched.questionCount : 0 }
    })
  }, [registryGroup, syllabusFacets.subjects])

  const registryStandards = useMemo(() => {
    const stds =
      selectedTestCategory === 'full_length'
        ? getStandardsForSubject(registryGroup, 'general-studies')
        : getStandardsForSubject(registryGroup, selectedSubjectId)
    return stds.map((st) => {
      const matched = syllabusFacets.standards.find((f) => Number(f.classId) === st.id)
      return { ...st, questionCount: matched ? matched.questionCount : 0 }
    })
  }, [registryGroup, selectedSubjectId, selectedTestCategory, syllabusFacets.standards])

  const [dynamicUnits, setDynamicUnits] = useState<DynamicUnit[]>([])
  const [isUnitsLoading, setIsUnitsLoading] = useState<boolean>(true)
  const [unitsCountByStandard, setUnitsCountByStandard] = useState<Record<number, number>>({})
  const [dynamicLessons, setDynamicLessons] = useState<DynamicLesson[]>([])
  const [isLessonsLoading, setIsLessonsLoading] = useState<boolean>(false)
  const [unitProgressByNum, setUnitProgressByNum] = useState<Record<number, any>>({})
  const [lessonProgressById, setLessonProgressById] = useState<Record<string, any>>({})
  const [mockSummary, setMockSummary] = useState<{
    totalMockTestsCompleted: number
    totalAttempts: number
    latestScore: number | null
    bestScore: number | null
    averageScore: number | null
    bestGrade: string | null
    bestGradeColor: string | null
    goldCount?: number
    platinumCount?: number
    silverCount?: number
    totalAwards?: number
    totalTimeSpentSeconds: number
    byTestId: Record<string, any>
    unitWiseByTestId?: Record<string, any>
    inProgressTestIds?: number[]
  } | null>(null)
  const [celebrationState, setCelebrationState] = useState<{
    awardType: AchievementAwardResult
    percentage: number
    title?: string
  } | null>(null)
  const [lastSubmittedAward, setLastSubmittedAward] = useState<AchievementAwardResult>('NONE')
  const [historyModalLesson, setHistoryModalLesson] = useState<{
    lessonId?: string
    lessonTitle: string
  } | null>(null)
  const [syllabusSyncTick, setSyllabusSyncTick] = useState(0)

  useEffect(() => {
    const unsubSyl = dynamicSyllabusService.subscribe(() => setSyllabusSyncTick((t) => t + 1))
    const unsubStu = subscribeStudentSync(() => setSyllabusSyncTick((t) => t + 1))
    return () => {
      unsubSyl()
      unsubStu()
    }
  }, [])

  useEffect(() => {
    if (selectedTestCategory === 'full_length') {
      setDynamicUnits([])
      setIsUnitsLoading(false)
      return
    }
    let mounted = true
    setIsUnitsLoading(true)
    dynamicSyllabusService
      .getUnits(registryGroup, selectedSubjectId, selectedStandardId, { allowEmpty: true })
      .then((units) => {
        if (mounted) {
          setDynamicUnits(units)
          setIsUnitsLoading(false)
        }
      })
      .catch(() => {
        if (mounted) {
          setDynamicUnits([])
          setIsUnitsLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [registryGroup, selectedSubjectId, selectedStandardId, selectedTestCategory, syllabusSyncTick])

  useEffect(() => {
    let mounted = true
    const stdIds = getStandardsForSubject(registryGroup, selectedSubjectId).map((s) => s.id)
    Promise.all(
      stdIds.map(async (stdId) => {
        const units = await dynamicSyllabusService.getUnits(registryGroup, selectedSubjectId, stdId, {
          allowEmpty: true,
        })
        return [stdId, units.length] as const
      })
    )
      .then((entries) => {
        if (mounted) {
          setUnitsCountByStandard(Object.fromEntries(entries))
        }
      })
      .catch(() => {
        if (mounted) {
          setUnitsCountByStandard({})
        }
      })
    return () => {
      mounted = false
    }
  }, [registryGroup, selectedSubjectId, syllabusSyncTick])

  useEffect(() => {
    if (selectedTestCategory !== 'lesson_wise' || !selectedUnitId) {
      setDynamicLessons([])
      setIsLessonsLoading(false)
      return
    }
    let mounted = true
    setIsLessonsLoading(true)
    dynamicSyllabusService
      .getLessons({
        examId: registryGroup,
        subjectId: selectedSubjectId,
        standardNumber: selectedStandardId,
        unitNumber: selectedUnitId,
      })
      .then((lessons) => {
        if (mounted) {
          setDynamicLessons(lessons)
          setIsLessonsLoading(false)
        }
      })
      .catch(() => {
        if (mounted) {
          setDynamicLessons([])
          setIsLessonsLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [registryGroup, selectedSubjectId, selectedStandardId, selectedUnitId, selectedTestCategory, syllabusSyncTick])

  useEffect(() => {
    let mounted = true
    const token = localStorage.getItem('tnpsc_student_token')
    if (!token) {
      setUnitProgressByNum({})
      setLessonProgressById({})
      setMockSummary(null)
      return
    }

    const q = new URLSearchParams({
      groupId: registryGroup,
      subjectId: selectedSubjectId,
      standardId: String(selectedStandardId),
      mode: 'lesson_wise',
    })
    apiFetch(`/api/student/syllabus-progress?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!mounted || json?.status !== 'success' || !json?.data) return
        const uMap: Record<number, any> = {}
        for (const u of json.data.units || []) uMap[Number(u.unitNumber)] = u
        const lMap: Record<string, any> = {}
        for (const l of json.data.lessons || []) {
          if (l.lessonId) lMap[String(l.lessonId)] = l
          if (l.lessonTitle) {
            const normT = String(l.lessonTitle).trim().toLowerCase()
            lMap[`title:${normT}`] = l
            if (l.unitNumber != null) {
              lMap[`unit:${Number(l.unitNumber)}:title:${normT}`] = l
            }
          }
        }
        setUnitProgressByNum(uMap)
        setLessonProgressById(lMap)
      })
      .catch(() => {})

    apiFetch(`/api/student/syllabus-progress/mock-tests?groupId=${encodeURIComponent(registryGroup)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (mounted && json?.status === 'success') {
          setMockSummary(json.data || null)
        }
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [registryGroup, selectedSubjectId, selectedStandardId, syllabusSyncTick])

  const registryUnits = useMemo(() => {
    if (selectedTestCategory === 'full_length') return []
    return dynamicUnits.map((u) => {
      const unitNum = Number(u.unit_number)
      const matched = syllabusFacets.units.find((f) => Number(f.unitId) === unitNum)
      return {
        id: unitNum,
        unitNumber: u.unitNumber || u.unit_code || `Unit ${unitNum}`,
        title: u.title,
        subjectName: u.subjectName || u.subject_name || selectedSubjectId,
        questionCount: matched ? matched.questionCount : 0,
      }
    })
  }, [dynamicUnits, selectedSubjectId, selectedTestCategory, syllabusFacets.units])

  const registryLessons = useMemo(() => {
    if (selectedTestCategory !== 'lesson_wise' || !selectedUnitId) return []
    return dynamicLessons.map((l) => {
      const normTitle = (l.title || '').trim().toLowerCase()
      const matched = syllabusFacets.lessons.find(
        (f) => (f.lessonId && f.lessonId === l.id) || f.lessonTitle.trim().toLowerCase() === normTitle
      )
      return {
        id: l.id,
        lessonNumber: l.lesson_number || '',
        title: l.title,
        matchedLessonId: matched?.lessonId || l.id,
        questionCount: matched ? matched.questionCount : 0,
      }
    })
  }, [dynamicLessons, selectedUnitId, selectedTestCategory, syllabusFacets.lessons])

  // Reset child selections cleanly when switching Group
  useEffect(() => {
    const firstSub = getSubjectsForGroup(registryGroup)[0]?.id || 'general-studies'
    const firstStd = getStandardsForSubject(registryGroup, firstSub)[0]?.id || 6
    setSelectedSubjectId(firstSub)
    setSelectedStandardId(firstStd)
    setSelectedUnitId(null)
  }, [registryGroup])

  useEffect(() => {
    setSelectedUnitId(null)
  }, [selectedTestCategory, selectedSubjectId, selectedStandardId])

  // Fetch live syllabus facets for question counts (same source of truth as Study Materials & MCQ Practice)
  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams()
    params.set('category', selectedGroup === 'group4' ? 'group4_vao' : selectedGroup)
    if (selectedTestCategory !== 'full_length' && selectedSubjectId) {
      params.set('subject', selectedSubjectId)
    }
    if (selectedStandardId) {
      params.set('classId', String(selectedStandardId))
    }
    if (selectedUnitId) {
      params.set('unitId', String(selectedUnitId))
    }
    apiFetch(`/api/questions/syllabus-facets?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (mounted && d?.status === 'success') {
          setSyllabusFacets({
            subjects: Array.isArray(d.subjects) ? d.subjects : [],
            standards: Array.isArray(d.standards) ? d.standards : [],
            units: Array.isArray(d.units) ? d.units : [],
            lessons: Array.isArray(d.lessons) ? d.lessons : [],
          })
        }
      })
      .catch(() => { })
    return () => {
      mounted = false
    }
  }, [selectedGroup, selectedTestCategory, selectedSubjectId, selectedStandardId, selectedUnitId])

  const fetchPublishedTests = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('group', selectedGroup)
      params.set('testCategory', selectedTestCategory)
      const res = await apiFetch(`/api/mock-tests?${params.toString()}`)
      const data = await res.json()
      if (res.ok && data.status === 'success') {
        setTests(Array.isArray(data.data) ? data.data : [])
      }
    } catch {
      setErrorMsg('Unable to load published mock tests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPublishedTests()
    const unsubscribe = subscribeStudentSync(() => {
      fetchPublishedTests()
    })
    return unsubscribe
  }, [selectedGroup, selectedTestCategory])

  // Countdown timer while exam is active
  useEffect(() => {
    if (!activeTest || examResult) return
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer)
          handleSubmitExam(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [activeTest, examResult])

  const translatableQuestions = useMemo(
    () =>
      questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
      })),
    [questions]
  )
  const { translations } = useMcqTranslations(translatableQuestions, questionLang)
  const activeSubjectObj = registrySubjects.find((s) => s.id === selectedSubjectId) || null
  const activeUnitObj = registryUnits.find((u) => u.id === selectedUnitId) || null
  const handleSelectUnit = (uId: number | null) => setSelectedUnitId(uId)

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'Easy':
        return '#10b981'
      case 'Medium':
        return '#f59e0b'
      case 'Hard':
        return '#ef4444'
      default:
        return '#94a3b8'
    }
  }

  const matchesSubjectSlug = (testSubj: string | undefined | null, slug: string): boolean => {
    const t = String(testSubj || '').toLowerCase().trim()
    if (!t || t === 'all') return true
    if (slug === 'aptitude') return t.includes('aptitude') || t.includes('mental')
    if (slug === 'general-tamil') return t.includes('tamil')
    if (slug === 'general-english') return t.includes('english')
    return t.includes('general studies') || t === 'general-studies' || t === 'gs'
  }

  // Admin-published tests matching current Group + Category + Subject + Standard (+ Unit)
  const matchingAdminTests = useMemo(() => {
    return tests.filter((test) => {
      if (!matchesGroup(test, selectedGroup)) return false
      if ((test.testCategory || 'full_length') !== selectedTestCategory) return false
      if (selectedTestCategory === 'unit_wise' && !matchesSubjectSlug(test.subject, selectedSubjectId)) {
        return false
      }
      const testStd = parseStdNum(test.standard)
      if (testStd !== null && testStd !== selectedStandardId) return false
      if (selectedTestCategory === 'unit_wise' && selectedUnitId) {
        const testUnit = parseStdNum(test.unit)
        if (testUnit !== selectedUnitId) return false
      }
      return true
    })
  }, [tests, selectedGroup, selectedTestCategory, selectedSubjectId, selectedStandardId, selectedUnitId])

  const resetExamState = () => {
    setCurrentIndex(0)
    setAnswers({})
    setMarkedForReview({})
    setVisitedQuestions({ 0: true })
    setIsPaletteOpenMobile(false)
    setShowSubmitModal(false)
    setExamResult(null)
    setShowReview(false)
    startTimestampRef.current = Date.now()
  }

  const handleStartAdminTest = async (test: PublishedMockTest) => {
    const studentToken = localStorage.getItem('tnpsc_student_token')
    if (!studentToken) {
      navigate('/login?redirect=/mock-tests')
      return
    }

    try {
      setErrorMsg(null)
      const res = await apiFetch(`/api/mock-tests/${test.id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
      })
      const data = await res.json()
      if (!res.ok || data.status !== 'success') {
        setErrorMsg(data.message || 'Unable to start this mock test.')
        return
      }

      const { session, test: liveTest, questions: liveQuestions } = data.data
      resetExamState()
      setIsSyllabusMode(false)
      setPendingStartTest(null)
      setActiveTest({ ...test, ...liveTest })
      setSessionId(Number(session?.id || 0))
      setQuestions(liveQuestions || [])
      setAnswers(session?.answers || {})
      setCurrentIndex(Number(session?.currentQuestionIndex || 0))
      const remaining = session?.expiresAt
        ? Math.max(60, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000))
        : (liveTest?.durationMinutes || test.durationMinutes || 90) * 60
      setSecondsLeft(remaining)
      submissionTokenRef.current = `mt-${test.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to start mock test.')
    }
  }

  const handleStartSyllabusTest = async (opts: {
    testCategory: TestCategoryTab
    unitId?: number | null
    lessonId?: string | null
    lessonTitle?: string | null
    title: string
    questionCount: number
  }) => {
    const studentToken = localStorage.getItem('tnpsc_student_token')
    if (!studentToken) {
      navigate('/login?redirect=/mock-tests')
      return
    }

    try {
      setErrorMsg(null)
      const res = await apiFetch('/api/mock-tests/syllabus/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          group: selectedGroup,
          testCategory: opts.testCategory,
          subject: selectedSubjectId,
          standard: `${selectedStandardId}th Standard`,
          unitId: opts.unitId ?? selectedUnitId,
          lessonId: opts.lessonId || null,
          lessonTitle: opts.lessonTitle || null,
          limit: Math.max(1, opts.questionCount),
          title: opts.title,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.status !== 'success') {
        setErrorMsg(data.message || 'No eligible published questions found for this test.')
        return
      }

      const { test: liveTest, questions: liveQuestions } = data.data
      resetExamState()
      setIsSyllabusMode(true)
      setSessionId(0)
      setActiveTest({
        ...liveTest,
        subjectId: selectedSubjectId,
        standard: String(selectedStandardId),
        unit: opts.unitId != null ? String(opts.unitId) : String(selectedUnitId || ''),
        lesson: opts.lessonTitle || null,
        lessonId: opts.lessonId || null,
      })
      setQuestions(liveQuestions || [])
      setSecondsLeft((liveTest?.durationMinutes || 30) * 60)
      submissionTokenRef.current = `syl-${opts.testCategory}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to start syllabus test.')
    }
  }

  const persistProgress = (nextAnswers: Record<string, number>, nextIndex: number) => {
    const studentToken = localStorage.getItem('tnpsc_student_token')
    if (!studentToken || !sessionId || isSyllabusMode) return
    apiFetch(`/api/mock-tests/sessions/${sessionId}/progress`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ answers: nextAnswers, currentQuestionIndex: nextIndex }),
    }).catch(() => { })
  }

  const goToQuestion = (idx: number) => {
    if (idx < 0 || idx >= questions.length) return
    setCurrentIndex(idx)
    setVisitedQuestions((v) => ({ ...v, [idx]: true }))
    setIsPaletteOpenMobile(false)
    persistProgress(answers, idx)
  }

  const handleSelectOption = (questionId: number, optionIndex: number) => {
    const nextAnswers = { ...answers, [String(questionId)]: optionIndex }
    setAnswers(nextAnswers)
    setVisitedQuestions((v) => ({ ...v, [currentIndex]: true }))
    persistProgress(nextAnswers, currentIndex)
  }

  const handleClearOption = (questionId: number) => {
    const nextAnswers = { ...answers }
    delete nextAnswers[String(questionId)]
    setAnswers(nextAnswers)
    persistProgress(nextAnswers, currentIndex)
  }

  const handleSubmitExam = async (autoSubmit = false) => {
    if (!activeTest || submitting) return
    setShowSubmitModal(false)
    if (!autoSubmit && !showSubmitModal) {
      setShowSubmitModal(true)
      return
    }

    const studentToken = localStorage.getItem('tnpsc_student_token')
    if (!studentToken) return

    try {
      setSubmitting(true)
      const timeSpentSeconds = Math.max(1, Math.round((Date.now() - startTimestampRef.current) / 1000))
      const url = isSyllabusMode ? '/api/mock-tests/syllabus/submit' : `/api/mock-tests/${activeTest.id}/submit`
      const bodyPayload = isSyllabusMode
        ? {
            testTitle: activeTest.title,
            group: selectedGroup,
            testCategory: activeTest.testCategory,
            subject: activeTest.subject,
            subjectId: (activeTest as any).subjectId || selectedSubjectId,
            standard: activeTest.standard || String(selectedStandardId),
            unit: activeTest.unit || String(selectedUnitId || ''),
            lesson: activeTest.lesson || '',
            lessonId: (activeTest as any).lessonId || '',
            questionIds: questions.map((q) => q.id),
            answers,
            timeSpentSeconds,
            marksPerQuestion: activeTest.marksPerQuestion || 1.5,
            negativeMarking: activeTest.negativeMarking || 0,
            submissionToken: submissionTokenRef.current,
          }
        : {
          sessionId,
          answers,
          timeSpentSeconds,
          submissionToken: submissionTokenRef.current,
        }

      const res = await apiFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify(bodyPayload),
      })
      const data = await res.json()
      if (!res.ok || data.status !== 'success') {
        setErrorMsg(data.message || 'Failed to submit mock test.')
        return
      }
      setExamResult(data.data)
      const resPct = Number(data.data?.percentage || 0)
      const resAward: AchievementAwardResult =
        data.data?.awardType === 'GOLD' ||
        data.data?.awardType === 'PLATINUM' ||
        data.data?.awardType === 'SILVER' ||
        data.data?.awardType === 'NONE'
          ? data.data.awardType
          : resPct >= 90
            ? 'GOLD'
            : resPct >= 75
              ? 'PLATINUM'
              : resPct >= 60
                ? 'SILVER'
                : 'NONE'
      setLastSubmittedAward(resAward)
      if (!data.data?.duplicate) {
        setCelebrationState({
          awardType: resAward,
          percentage: resPct,
          title: data.data?.testTitle || activeTest.title,
        })
      }
      setSyllabusSyncTick((t) => t + 1)
      notifyStudentSync()
      fetchPublishedTests()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleExitExam = () => {
    setActiveTest(null)
    setQuestions([])
    setAnswers({})
    setExamResult(null)
    setShowReview(false)
    setShowSubmitModal(false)
  }

  // ====================================================
  // 1. LIVE RESULT & SCORECARD VIEW
  // ====================================================
  if (activeTest && examResult) {
    return (
      <div className="pyp-exam-page">
        <div className="pyp-exam-topbar glass">
          <div className="pyp-topbar-left">
            <button type="button" className="pyp-leave-btn" onClick={handleExitExam}>
              <ArrowLeft size={16} />
              <span>Back to Mock Tests</span>
            </button>
            <div>
              <div className="pyp-brand-line">
                <span className="pyp-hub-tag">TNPSC Study Hub</span>
                <span className="pyp-status-dot">● Completed</span>
              </div>
              <h1 className="pyp-exam-heading">{examResult.testTitle}</h1>
            </div>
          </div>
          <div className="pyp-topbar-meta">
            <button type="button" className="btn btn-primary" onClick={() => setShowReview((p) => !p)}>
              <BookOpen size={16} />
              <span>{showReview ? 'Hide Answer Key' : 'Review Answers'}</span>
            </button>
          </div>
        </div>

        <div className="mocktest-result-grid">
          <div className="mocktest-result-box">
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Final Score</span>
            <strong style={{ fontSize: '1.5rem', color: '#a78bfa' }}>
              {examResult.score} / {examResult.maxScore}
            </strong>
          </div>
          <div className="mocktest-result-box">
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Accuracy</span>
            <strong style={{ fontSize: '1.5rem', color: '#38bdf8' }}>{examResult.percentage}%</strong>
          </div>
          <div className="mocktest-result-box">
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Correct</span>
            <strong style={{ fontSize: '1.5rem', color: '#34d399' }}>{examResult.correctAnswers}</strong>
          </div>
          <div className="mocktest-result-box">
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Incorrect</span>
            <strong style={{ fontSize: '1.5rem', color: '#f87171' }}>{examResult.incorrectAnswers}</strong>
          </div>
          <div className="mocktest-result-box">
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Unanswered</span>
            <strong style={{ fontSize: '1.5rem', color: '#cbd5e1' }}>{examResult.unansweredQuestions}</strong>
          </div>
          <div className="mocktest-result-box">
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Time Taken</span>
            <strong style={{ fontSize: '1.5rem', color: '#e2e8f0' }}>{formatCountdown(examResult.timeSpentSeconds)}</strong>
          </div>
          {lastSubmittedAward !== 'NONE' && (
            <div className="mocktest-result-box" style={{ borderColor: 'rgba(255, 215, 0, 0.35)' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Award Earned</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.15rem' }}>
                <AwardShieldLogo tier={lastSubmittedAward} size={30} showLabel={false} />
                <strong style={{ fontSize: '1.05rem', color: '#fde047' }}>{lastSubmittedAward}</strong>
              </div>
            </div>
          )}
        </div>

        {showReview && (
          <div className="pyp-review-list">
            {examResult.responses.map((r, idx) => (
              <div key={r.questionId} className="pyp-review-item glass">
                <div className="pyp-review-item-head">
                  <span className="pyp-q-badge">Question {idx + 1}</span>
                  <span className={`pyp-review-status ${r.selectedOption === null ? 'unanswered' : r.isCorrect ? 'correct' : 'wrong'}`}>
                    {r.selectedOption === null ? 'Unanswered' : r.isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </div>
                <p className="pyp-review-qtext">{r.questionText}</p>
                <div className="pyp-review-opts">
                  {(r.options || []).map((opt, oIdx) => {
                    const isCorrectOpt = oIdx === r.correctAnswer
                    const isChosen = oIdx === r.selectedOption
                    let cls = 'pyp-review-opt'
                    if (isCorrectOpt) cls += ' opt-correct'
                    else if (isChosen) cls += ' opt-wrong'
                    return (
                      <div key={oIdx} className={cls}>
                        <span className="pyp-opt-letter">{String.fromCharCode(65 + oIdx)}</span>
                        <span>{opt}</span>
                        {isCorrectOpt && <span className="pyp-opt-tag">Correct Answer</span>}
                        {isChosen && !isCorrectOpt && <span className="pyp-opt-tag">Your Answer</span>}
                      </div>
                    )
                  })}
                </div>
                {r.explanation && (
                  <div className="pyp-review-explanation">
                    <strong>Explanation:</strong> {r.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ====================================================
  // 2. LIVE TIMED EXAMINATION VIEW (Reusing Previous Year Papers UI)
  // ====================================================
  if (activeTest && questions.length > 0) {
    const q = questions[currentIndex] || questions[0]
    const tr = questionLang === 'ta' ? translations[q.id] : undefined
    const displayedQ = tr?.question || q.question
    const displayedOpts = tr?.options && tr.options.length === q.options.length ? tr.options : q.options
    const selectedOpt = answers[String(q.id)]
    const answeredCount = Object.keys(answers).length
    const isWarning = secondsLeft > 0 && secondsLeft <= 300

    return (
      <div className="pyp-exam-page">
        <header className="pyp-exam-topbar glass">
          <div className="pyp-topbar-left">
            <button
              type="button"
              className="pyp-leave-btn"
              onClick={() => {
                if (window.confirm('Exit this mock test?')) handleExitExam()
              }}
            >
              <ArrowLeft size={16} />
              <span>Exit</span>
            </button>
            <div>
              <div className="pyp-brand-line">
                <span className="pyp-hub-tag">TNPSC Study Hub</span>
                <span className="pyp-status-dot">● In Progress</span>
              </div>
              <h1 className="pyp-exam-heading">{activeTest.title}</h1>
            </div>
          </div>

          <div className="pyp-topbar-meta">
            <div className="pyp-meta-pill">
              <span>Questions</span>
              <strong>{questions.length}</strong>
            </div>
            <div className="pyp-meta-pill">
              <span>Marks</span>
              <strong>{activeTest.totalMarks}</strong>
            </div>
            <div className={`pyp-timer-pill ${isWarning ? 'critical' : ''}`}>
              <Clock size={16} />
              <span>{formatCountdown(secondsLeft)}</span>
            </div>
            <div className="mcq-lang-switch glass" role="group" aria-label="Question language">
              <Languages size={14} className="mcq-lang-icon" />
              <button
                type="button"
                className={`mcq-lang-btn ${questionLang === 'en' ? 'active' : ''}`}
                onClick={() => setQuestionLang('en')}
              >
                EN
              </button>
              <button
                type="button"
                className={`mcq-lang-btn ${questionLang === 'ta' ? 'active' : ''}`}
                onClick={() => setQuestionLang('ta')}
              >
                தமிழ்
              </button>
            </div>
            <button
              type="button"
              className="pyp-mobile-palette-toggle"
              onClick={() => setIsPaletteOpenMobile((v) => !v)}
            >
              <Grid size={16} />
              <span>Palette</span>
            </button>
          </div>
        </header>

        <div className="pyp-exam-workspace">
          <main className="pyp-question-panel glass">
            <div className="pyp-q-header">
              <span className="pyp-q-num-badge">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="pyp-q-subject-tag">
                {q.subject}{q.topic ? ` • ${q.topic}` : ''}
              </span>
              {markedForReview[currentIndex] && (
                <span className="pyp-q-review-tag">Marked for Review</span>
              )}
            </div>

            <h2 className="pyp-q-text">{displayedQ}</h2>

            <div className="pyp-options-list" role="radiogroup" aria-label={`Question ${currentIndex + 1} options`}>
              {(displayedOpts || []).map((opt: string, idx: number) => {
                const isSelected = selectedOpt === idx
                return (
                  <label key={idx} className={`pyp-option-card ${isSelected ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name={`mt-q-${q.id}`}
                      checked={isSelected}
                      onChange={() => handleSelectOption(q.id, idx)}
                    />
                    <span className="pyp-opt-letter">{String.fromCharCode(65 + idx)}</span>
                    <span className="pyp-opt-text">{opt}</span>
                  </label>
                )
              })}
            </div>

            <div className="pyp-q-controls">
              <div className="pyp-q-controls-left">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={currentIndex === 0}
                  onClick={() => goToQuestion(currentIndex - 1)}
                >
                  <ArrowLeft size={16} />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={selectedOpt === undefined}
                  onClick={() => handleClearOption(q.id)}
                >
                  <Eraser size={16} />
                  <span>Clear Response</span>
                </button>
              </div>

              <div className="pyp-q-controls-right">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (currentIndex < questions.length - 1) {
                      goToQuestion(currentIndex + 1)
                    } else {
                      persistProgress(answers, currentIndex)
                    }
                  }}
                >
                  <span>Save &amp; Next</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </main>

          <QuestionPalette
            title="Question Palette"
            subtitle={`${answeredCount} / ${questions.length} Answered`}
            items={questions.map((item, idx) => {
              const isAns = answers[String(item.id)] !== undefined
              const isMarked = Boolean(markedForReview[idx])
              const isVisited = Boolean(visitedQuestions[idx])
              let status: QuestionPaletteStatus = 'not-visited'
              if (isAns && isMarked) status = 'answered-review'
              else if (isMarked) status = 'review'
              else if (isAns) status = 'answered'
              else if (isVisited) status = 'not-answered'
              return { id: item.id, number: idx + 1, status }
            })}
            currentNumber={currentIndex + 1}
            onSelectQuestion={(qNum) => goToQuestion(qNum - 1)}
            isOpenMobile={isPaletteOpenMobile}
            onCloseMobile={() => setIsPaletteOpenMobile(false)}
            submitLabel={submitting ? 'Submitting...' : 'Submit Test'}
            onSubmitClick={() => setShowSubmitModal(true)}
          />
        </div>

        {showSubmitModal && (
          <div className="pyp-modal-backdrop">
            <div className="pyp-modal-card glass">
              <h3>Submit Mock Test?</h3>
              <p>Review your attempt summary before final submission.</p>
              <div className="pyp-modal-summary">
                <div><span>Total Questions</span><strong>{questions.length}</strong></div>
                <div><span>Answered</span><strong className="green">{answeredCount}</strong></div>
                <div><span>Unanswered</span><strong className="amber">{Math.max(0, questions.length - answeredCount)}</strong></div>
                <div><span>Marked for Review</span><strong className="purple">{Object.values(markedForReview).filter(Boolean).length}</strong></div>
              </div>
              <div className="pyp-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSubmitModal(false)} disabled={submitting}>
                  Continue Test
                </button>
                <button type="button" className="btn btn-primary" onClick={() => handleSubmitExam(true)} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Confirm & Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ====================================================
  // 3. MOCK TESTS HOME & SYLLABUS HIERARCHY
  // ====================================================
  const isLessonsView = selectedTestCategory === 'lesson_wise' && Boolean(selectedUnitId)
  const isUnitTestsView = selectedTestCategory === 'unit_wise' && Boolean(selectedUnitId)
  const isSubListingView = isLessonsView || isUnitTestsView

  const handleGroupChange = (grp: TnpscGroupTab) => {
    const nextReg = mapGroupToRegistryKey(grp)
    const nextSubs = getSubjectsForGroup(nextReg)
    const nextSub = nextSubs.some((s) => s.id === selectedSubjectId)
      ? selectedSubjectId
      : nextSubs[0]?.id || 'general-studies'
    const nextStds = getStandardsForSubject(nextReg, nextSub)
    const nextStd = nextStds.some((st) => st.id === selectedStandardId)
      ? selectedStandardId
      : nextStds[0]?.id || 6
    setSelectedGroup(grp)
    setSelectedSubjectId(nextSub)
    setSelectedStandardId(nextStd)
    setSelectedUnitId(null)
  }

  const handleSubjectChange = (subId: string) => {
    const nextStds = getStandardsForSubject(registryGroup, subId)
    const nextStd = nextStds.some((st) => st.id === selectedStandardId)
      ? selectedStandardId
      : nextStds[0]?.id || 6
    setSelectedSubjectId(subId)
    setSelectedStandardId(nextStd)
    setSelectedUnitId(null)
  }

  return (
    <div className="practice">
      <div className="practice-container">
        <div className="practice-header">
          <h1 className="practice-title">
            <GraduationCap size={32} />
            <span>
              Mock <span className="gradient-text">Tests</span>
            </span>
          </h1>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '0.85rem 1.1rem',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.14)',
              border: '1px solid rgba(248, 113, 113, 0.35)',
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. TNPSC Group Selection Tabs (Visible on main selection view, matching MCQ Practice) */}
        {!isSubListingView && (
          <div className="practice-categories glass">
            {groups.map((grp) => (
              <button
                key={grp.id}
                type="button"
                className={`practice-category-tab ${selectedGroup === grp.id ? 'active' : ''}`}
                onClick={() => handleGroupChange(grp.id)}
              >
                {grp.name}
              </button>
            ))}
          </div>
        )}

        {/* 2. Test Format Tabs (Lesson-wise / Unit-wise / Full-length) */}
        {!isSubListingView && (
          <div className="practice-categories glass">
            {testCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`practice-category-tab ${selectedTestCategory === cat.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedTestCategory(cat.id)
                  setSelectedUnitId(null)
                }}
                title={cat.desc}
              >
                {cat.id === 'lesson_wise' && <BookOpen size={15} style={{ marginRight: '0.4rem' }} />}
                {cat.id === 'unit_wise' && <Layers size={15} style={{ marginRight: '0.4rem' }} />}
                {cat.id === 'full_length' && <Target size={15} style={{ marginRight: '0.4rem' }} />}
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Breadcrumb on Lesson / Unit-wise Test Listing View */}
        {isSubListingView && (
          <div className="practice-breadcrumb-row">
            <nav className="practice-breadcrumb glass" aria-label="Mock tests syllabus breadcrumb">
              <button type="button" className="breadcrumb-crumb" onClick={() => setSelectedUnitId(null)}>
                {groups.find((g) => g.id === selectedGroup)?.name}
              </button>
              {activeSubjectObj && (
                <>
                  <ChevronRight size={14} className="breadcrumb-sep" />
                  <button type="button" className="breadcrumb-crumb" onClick={() => setSelectedUnitId(null)}>
                    {activeSubjectObj.name}
                  </button>
                </>
              )}
              <>
                <ChevronRight size={14} className="breadcrumb-sep" />
                <button type="button" className="breadcrumb-crumb" onClick={() => setSelectedUnitId(null)}>
                  {`${selectedStandardId}th Standard`}
                </button>
              </>
              <>
                <ChevronRight size={14} className="breadcrumb-sep" />
                <span className="breadcrumb-crumb current">
                  {activeUnitObj ? `${activeUnitObj.unitNumber}: ${activeUnitObj.title}` : `Unit ${selectedUnitId}`}
                </span>
              </>
            </nav>
          </div>
        )}

        {/* BROWSE VIEW: Compact Subjects + 6th-12th Standard Cards + Unit Cards */}
        {!isSubListingView ? (
          <div className="hierarchy-navigator">
            {/* Section 1: Compact Subject Cards (Exact MCQ Practice Design) */}
            <section className="hierarchy-section glass compact-subjects-section">
              <div className="hierarchy-section-header compact-header">
                <span className="hierarchy-step-badge">Subject</span>
                <h3>Select Subject</h3>
              </div>
              <div className="compact-subject-grid">
                {registrySubjects.map((sub) => {
                  const isActiveSub = selectedSubjectId === sub.id
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      className={`compact-subject-card ${isActiveSub ? 'selected' : ''}`}
                      onClick={() => handleSubjectChange(sub.id)}
                    >
                      <div className="compact-subject-left">
                        <BookOpen size={15} className="compact-subject-icon" />
                        <span className="compact-subject-title">{sub.name}</span>
                      </div>
                      <span className={`compact-count-badge ${sub.questionCount > 0 ? 'has-qs' : ''}`}>
                        {sub.questionCount} Qs
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Section 2: Standard Selection (Exact MCQ Practice Design) */}
            <section className="classes-top-section glass">
              <div className="classes-section-header">
                <div className="classes-heading-group">
                  <div className="classes-title-badge">
                    <GraduationCap size={16} />
                    <span>Samacheer Kalvi Standard Mapping</span>
                  </div>
                  <h2 className="classes-main-heading">
                    {activeSubjectObj?.name || 'General Studies'} — Select Standard
                  </h2>
                </div>
                <span className="classes-count-badge">{registryStandards.length} Standards</span>
              </div>

              <div className="class-cards-grid">
                {registryStandards.map((cls) => {
                  const unitCount = unitsCountByStandard[cls.id] ?? 0
                  const isActiveStd = selectedStandardId === cls.id
                  return (
                    <div
                      key={cls.id}
                      role="button"
                      tabIndex={0}
                      className={`class-card glass ${isActiveStd ? 'active-standard' : ''}`}
                      onClick={() => {
                        setSelectedStandardId(cls.id)
                        setSelectedUnitId(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedStandardId(cls.id)
                          setSelectedUnitId(null)
                        }
                      }}
                    >
                      <div className="class-card-top">
                        <span className="class-num-badge">{cls.id}th</span>
                        <span className="class-badge-samacheer">Samacheer Kalvi</span>
                      </div>

                      <div className="class-card-main">
                        <div className="class-icon-circle">
                          <GraduationCap size={20} />
                        </div>
                        <h3 className="class-card-title">{cls.label}</h3>
                        <p className="class-card-desc">
                          {unitCount} {unitCount === 1 ? 'Unit' : 'Units'} • {cls.questionCount} Questions
                        </p>
                      </div>

                      <div className="class-card-cta">
                        <span>{isActiveStd ? 'Selected' : 'Select'}</span>
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Section 3: Unit Selection (Exact MCQ Practice Design for Lesson-wise & Unit-wise) */}
            {selectedTestCategory !== 'full_length' && (
              <section className="hierarchy-section glass unified-units-section">
                <div className="hierarchy-section-header">
                  <span className="hierarchy-step-badge">{selectedStandardId}th Standard</span>
                  <h3>
                    Select Unit — {selectedStandardId}th Standard ({activeSubjectObj?.name || 'General Studies'})
                  </h3>
                </div>
                {isUnitsLoading && registryUnits.length === 0 ? (
                  <p className="hierarchy-empty-note">Loading units from Study Materials...</p>
                ) : registryUnits.length > 0 ? (
                  <div className="hierarchy-card-grid">
                    {registryUnits.map((u) => {
                      const uProg = unitProgressByNum[u.id]
                      const totalL = uProg?.totalLessons ?? 0
                      const completedL = uProg?.completedLessons ?? 0
                      const remainingL = uProg?.remainingLessons ?? totalL
                      const pctL = uProg?.completionPercentage ?? 0
                      const unitPublishedCount = tests.filter((t) => {
                        if (!matchesGroup(t, selectedGroup)) return false
                        if ((t.testCategory || 'full_length') !== 'unit_wise') return false
                        if (!matchesSubjectSlug(t.subject, selectedSubjectId)) return false
                        const tStd = parseStdNum(t.standard)
                        if (tStd !== null && tStd !== selectedStandardId) return false
                        return parseStdNum(t.unit) === u.id
                      }).length
                      return (
                        <button
                          key={u.id}
                          type="button"
                          className="hierarchy-card"
                          onClick={() => handleSelectUnit(u.id)}
                        >
                          <div className="hierarchy-card-top">
                            <span className="hierarchy-unit-num">{u.unitNumber}</span>
                            <span className={`hierarchy-count-pill ${(selectedTestCategory === 'unit_wise' ? unitPublishedCount : u.questionCount) > 0 ? 'has-qs' : ''}`}>
                              {selectedTestCategory === 'unit_wise'
                                ? `${unitPublishedCount} ${unitPublishedCount === 1 ? 'Test' : 'Tests'}`
                                : `${u.questionCount} Questions`}
                            </span>
                          </div>
                          <span className="hierarchy-card-title">{u.title}</span>
                          <div className="unit-card-progress-summary">
                            <div className="unit-progress-metrics">
                              <span>Lessons: <strong>{totalL}</strong></span>
                              <span>Completed: <strong>{completedL}</strong></span>
                              <span>Remaining: <strong>{remainingL}</strong></span>
                              <span className="unit-progress-pct">Progress: <strong>{pctL}%</strong></span>
                            </div>
                            <div className="unit-progress-track" aria-label={`Unit progress ${pctL}%`}>
                              <div
                                className="unit-progress-fill"
                                style={{ width: `${Math.min(100, Math.max(0, pctL))}%` }}
                              />
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="hierarchy-empty-note">
                    No units mapped in Study Materials for {selectedStandardId}th Standard ({activeSubjectObj?.name}).
                  </p>
                )}
              </section>
            )}
          </div>
        ) : isUnitTestsView ? (
          /* DEDICATED UNIT-WISE TEST LISTING VIEW */
          <div className="hierarchy-navigator">
            <div className="page-step-back-row">
              <button
                type="button"
                className="back-btn glass"
                onClick={() => handleSelectUnit(null)}
              >
                <ArrowLeft size={16} />
                <span>Back to Units</span>
              </button>
            </div>

            <section className="hierarchy-section glass">
              <div className="hierarchy-section-header">
                <span className="hierarchy-step-badge">{activeUnitObj?.unitNumber || `Unit ${selectedUnitId}`}</span>
                <h3>
                  {activeUnitObj?.unitNumber || `Unit ${selectedUnitId}`} – {activeUnitObj?.title || 'Unit Tests'} | {selectedStandardId}th Standard
                </h3>
              </div>

              {loading ? (
                <p className="hierarchy-empty-note">Loading published Unit-wise Tests...</p>
              ) : matchingAdminTests.length > 0 ? (
                <div className="hierarchy-lesson-list">
                  {matchingAdminTests.map((test) => {
                    const tProg = mockSummary?.unitWiseByTestId?.[String(test.id)]
                    const isInProg = Boolean(mockSummary?.inProgressTestIds?.includes(test.id))
                    const attempts = tProg?.totalAttempts ?? 0
                    const status: 'completed' | 'in_progress' | 'not_started' =
                      attempts > 0 ? 'completed' : isInProg ? 'in_progress' : 'not_started'
                    const statusLabel =
                      status === 'completed'
                        ? 'Completed'
                        : status === 'in_progress'
                          ? 'In Progress'
                          : 'Not Started'
                    const ctaLabel =
                      status === 'completed'
                        ? 'Practice Again →'
                        : status === 'in_progress'
                          ? 'Continue Test →'
                          : 'Start Test →'

                    return (
                      <div key={test.id} className={`hierarchy-lesson-row lesson-status-${status}`}>
                        <div className="hierarchy-lesson-main-col">
                          <div className="hierarchy-lesson-info">
                            <div className="lesson-num-status-row">
                              <span className="hierarchy-lesson-num">{test.questionsCount} Questions</span>
                              <span className="hierarchy-count-pill">{test.durationMinutes} Minutes</span>
                              <span className="hierarchy-count-pill">{test.totalMarks} Marks</span>
                              {test.negativeMarking > 0 && (
                                <span className="hierarchy-count-pill">-{test.negativeMarking} Negative</span>
                              )}
                              <span className={`lesson-status-badge status-${status}`}>{statusLabel}</span>
                            </div>
                            <span className="hierarchy-lesson-title">{test.title}</span>
                            {test.description && (
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{test.description}</span>
                            )}
                            <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                              <span>Attempts: <strong style={{ color: '#e2e8f0' }}>{attempts}</strong></span>
                              <span>Latest: <strong style={{ color: '#e2e8f0' }}>{tProg?.latestAttemptScore != null ? `${tProg.latestAttemptScore}%` : '—'}</strong></span>
                              <span>Best: <strong style={{ color: '#fde047' }}>{tProg?.bestAttemptScore != null ? `${tProg.bestAttemptScore}%` : '—'}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="hierarchy-lesson-meta">
                          <LessonAwardSummaryBar
                            goldCount={tProg?.goldCount ?? 0}
                            platinumCount={tProg?.platinumCount ?? 0}
                            silverCount={tProg?.silverCount ?? 0}
                            compact
                            showTotal={false}
                            hideZero
                          />
                          <button
                            type="button"
                            className="table-action-btn table-action-primary hierarchy-start-btn"
                            onClick={() => handleStartAdminTest(test)}
                          >
                            <Play size={14} fill="currentColor" />
                            <span>{ctaLabel}</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="hierarchy-empty-note">
                  No published Unit-wise Tests are available for {activeUnitObj?.unitNumber || `Unit ${selectedUnitId}`} ({selectedStandardId}th Standard) yet.
                </p>
              )}
            </section>
          </div>
        ) : (
          /* LESSON SELECTION VIEW (Exact MCQ Practice Design) */
          <div className="hierarchy-navigator">
            <div className="page-step-back-row">
              <button
                type="button"
                className="back-btn glass"
                onClick={() => handleSelectUnit(null)}
              >
                <ArrowLeft size={16} />
                <span>Back to Units</span>
              </button>
            </div>

            <section className="hierarchy-section glass">
              <div className="hierarchy-section-header">
                <span className="hierarchy-step-badge">{activeUnitObj?.unitNumber || `Unit ${selectedUnitId}`}</span>
                <h3>
                  {activeUnitObj?.title || 'Lessons'} — {selectedStandardId}th Standard
                </h3>
              </div>
              {isLessonsLoading ? (
                <p className="hierarchy-empty-note">Loading lessons from Study Materials...</p>
              ) : registryLessons.length > 0 ? (
                <div className="hierarchy-lesson-list">
                  {registryLessons.map((l) => {
                    const normTitle = l.title.trim().toLowerCase()
                    const lProg =
                      lessonProgressById[String(l.id)] ||
                      (l.matchedLessonId ? lessonProgressById[String(l.matchedLessonId)] : undefined) ||
                      (selectedUnitId != null ? lessonProgressById[`unit:${Number(selectedUnitId)}:title:${normTitle}`] : undefined) ||
                      lessonProgressById[`title:${normTitle}`]
                    const status = lProg?.status || 'not_started'
                    const statusLabel =
                      status === 'completed'
                        ? 'Completed'
                        : status === 'in_progress'
                          ? 'In Progress'
                          : 'Not Started'
                    const ctaLabel =
                      status === 'completed'
                        ? 'Practice Again →'
                        : status === 'in_progress'
                          ? 'Continue Test →'
                          : 'Start Test →'
                    return (
                      <div key={l.id} className={`hierarchy-lesson-row lesson-status-${status}`}>
                        <div className="hierarchy-lesson-main-col">
                          <div className="hierarchy-lesson-info">
                            <span className="hierarchy-lesson-num">Lesson {l.lessonNumber}</span>
                            <span className="hierarchy-lesson-title">{l.title}</span>
                          </div>
                        </div>
                        <div className="hierarchy-lesson-meta">
                          {lProg?.totalAttempts > 0 ? (
                            <button
                              type="button"
                              className={`lesson-status-badge status-${status}`}
                              style={{ cursor: 'pointer', gap: '0.3rem' }}
                              title="View Attempt History & Award Progression"
                              onClick={() =>
                                setHistoryModalLesson({
                                  lessonId: l.matchedLessonId || String(l.id),
                                  lessonTitle: l.title,
                                })
                              }
                            >
                              <span>{statusLabel}</span>
                              <History size={11} />
                            </button>
                          ) : (
                            <span className={`lesson-status-badge status-${status}`}>{statusLabel}</span>
                          )}
                          <span className={`hierarchy-count-pill ${l.questionCount > 0 ? 'has-qs' : ''}`}>
                            {l.questionCount} Questions
                          </span>
                          <LessonAwardSummaryBar
                            goldCount={lProg?.goldCount ?? 0}
                            platinumCount={lProg?.platinumCount ?? 0}
                            silverCount={lProg?.silverCount ?? 0}
                            compact
                            showTotal={false}
                            hideZero
                          />
                          <button
                            type="button"
                            className="table-action-btn table-action-primary hierarchy-start-btn"
                            disabled={l.questionCount === 0}
                            onClick={() =>
                              handleStartSyllabusTest({
                                testCategory: 'lesson_wise',
                                unitId: selectedUnitId,
                                lessonId: l.matchedLessonId,
                                lessonTitle: l.title,
                                title: `${l.title} — Lesson Test`,
                                questionCount: Math.max(1, l.questionCount),
                              })
                            }
                          >
                            <Play size={14} fill="currentColor" />
                            <span>{ctaLabel}</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="hierarchy-empty-note">
                  No lessons configured for this Standard and Unit in Study Materials.
                </p>
              )}
            </section>
          </div>
        )}

        {selectedTestCategory === 'full_length' && mockSummary && (
          <div style={{ marginTop: '1rem', marginBottom: '0.75rem' }}>
            <LessonAwardSummaryBar
              goldCount={mockSummary.goldCount ?? 0}
              platinumCount={mockSummary.platinumCount ?? 0}
              silverCount={mockSummary.silverCount ?? 0}
              compact
              showTotal={false}
              hideZero
            />
          </div>
        )}

        {/* Admin-Published Tests for Selected Group, Format & Standard (Full-length & Lesson-wise) */}
        {selectedTestCategory !== 'unit_wise' && (
          <>
            <div style={{ marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                {selectedTestCategory === 'full_length'
                  ? `Published Full-length Mock Tests (${selectedStandardId}th Standard)`
                  : `Published ${testCategories.find((c) => c.id === selectedTestCategory)?.name} (Admin Curated)`}
              </h2>
            </div>

            <div className="mocktests-grid">
          {loading ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              Loading published mock tests...
            </div>
          ) : matchingAdminTests.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              {selectedTestCategory === 'full_length'
                ? `No published Full-length Mock Tests are available for ${groups.find((g) => g.id === selectedGroup)?.name} (${selectedStandardId}th Standard) yet.`
                : 'No separate Admin-curated tests published for this filter yet. You can start any syllabus test above.'}
            </div>
          ) : (
            matchingAdminTests.map((test) => (
              <div key={test.id} className="mocktest-card glass">
                <div className="mocktest-top-tags" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className="mocktest-category-tag">{test.tnpscGroup || test.categoryName}</span>
                  {test.standard && <span className="mocktest-category-tag">{test.standard}</span>}
                  {test.subject && <span className="mocktest-category-tag">{test.subject}</span>}
                  {test.unit && <span className="mocktest-category-tag">{test.unit}</span>}
                  {test.lesson && <span className="mocktest-category-tag">{test.lesson}</span>}
                </div>

                <div className="mocktest-header">
                  <h3 className="mocktest-title">{test.title}</h3>
                </div>

                {test.description && (
                  <p style={{ margin: '0 0 0.65rem', fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.45 }}>
                    {test.description}
                  </p>
                )}

                <div className="mocktest-stats">
                  <div className="mocktest-stat">
                    <FileText size={16} />
                    <span>{test.questionsCount} Questions</span>
                  </div>
                  <div className="mocktest-stat">
                    <Clock size={16} />
                    <span>{test.durationMinutes} min</span>
                  </div>
                  <div className="mocktest-stat">
                    <Award size={16} />
                    <span>{test.totalMarks} Marks</span>
                  </div>
                  <div className="mocktest-stat">
                    <Users size={16} />
                    <span>{test.attemptsCount.toLocaleString()} Attempts</span>
                  </div>
                </div>

                <div className="mocktest-meta" style={{ flexWrap: 'wrap' }}>
                  <span
                    className="difficulty-badge"
                    style={{
                      background: `${getDifficultyColor(test.difficulty)}20`,
                      color: getDifficultyColor(test.difficulty),
                      borderColor: `${getDifficultyColor(test.difficulty)}40`,
                    }}
                  >
                    {test.difficulty}
                  </span>
                  <span
                    className="difficulty-badge"
                    style={{
                      background: test.negativeMarking > 0 ? 'rgba(245, 158, 11, 0.14)' : 'rgba(16, 185, 129, 0.14)',
                      color: test.negativeMarking > 0 ? '#fbbf24' : '#34d399',
                      borderColor: test.negativeMarking > 0 ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    {test.negativeMarking > 0 ? `-${test.negativeMarking} Negative` : 'No Negative Marks'}
                  </span>
                  {test.randomizePerAttempt && (
                    <span
                      className="difficulty-badge"
                      style={{
                        background: 'rgba(139, 92, 246, 0.15)',
                        color: '#c4b5fd',
                        borderColor: 'rgba(139, 92, 246, 0.35)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <Sparkles size={12} /> Dynamic Syllabus Set
                    </span>
                  )}
                </div>

                <div style={{ margin: '0.55rem 0' }}>
                  <LessonAwardSummaryBar
                    goldCount={mockSummary?.byTestId?.[String(test.id)]?.goldCount ?? 0}
                    platinumCount={mockSummary?.byTestId?.[String(test.id)]?.platinumCount ?? 0}
                    silverCount={mockSummary?.byTestId?.[String(test.id)]?.silverCount ?? 0}
                    compact
                    showTotal={false}
                    hideZero
                  />
                </div>

                <button
                  type="button"
                  className="mocktest-btn"
                  onClick={() =>
                    test.testCategory === 'full_length'
                      ? setPendingStartTest(test)
                      : handleStartAdminTest(test)
                  }
                >
                  <Play size={18} />
                  <span>Start Test</span>
                </button>
              </div>
            ))
          )}
            </div>
          </>
        )}
      </div>

      {/* Test Instructions Modal (Full-length Mock Tests) */}
      {pendingStartTest && (
        <div className="pyp-modal-backdrop" onClick={() => setPendingStartTest(null)}>
          <div className="pyp-modal-card glass" onClick={(e) => e.stopPropagation()}>
            <h3>{pendingStartTest.title}</h3>
            <p>Please review the examination instructions before starting the timer.</p>
            <div className="pyp-modal-summary">
              <div><span>TNPSC Group</span><strong>{pendingStartTest.tnpscGroup}</strong></div>
              <div><span>Standard</span><strong>{pendingStartTest.standard || 'All Standards'}</strong></div>
              <div><span>Total Questions</span><strong>{pendingStartTest.questionsCount}</strong></div>
              <div><span>Duration</span><strong>{pendingStartTest.durationMinutes} Minutes</strong></div>
              <div><span>Total Marks</span><strong>{pendingStartTest.totalMarks}</strong></div>
              <div><span>Negative Marking</span><strong>{pendingStartTest.negativeMarking > 0 ? `-${pendingStartTest.negativeMarking}` : 'None'}</strong></div>
            </div>
            <div className="pyp-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setPendingStartTest(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => handleStartAdminTest(pendingStartTest)}>
                <Play size={15} fill="currentColor" style={{ marginRight: '0.35rem' }} />
                Start Examination
              </button>
            </div>
          </div>
        </div>
      )}
      {celebrationState && (
        <AwardCelebrationModal
          isOpen={Boolean(celebrationState)}
          onClose={() => setCelebrationState(null)}
          awardType={celebrationState.awardType}
          percentage={celebrationState.percentage}
          title={celebrationState.title}
        />
      )}
      {historyModalLesson && selectedUnitId && (
        <AttemptHistoryModal
          isOpen={Boolean(historyModalLesson)}
          onClose={() => setHistoryModalLesson(null)}
          groupId={registryGroup}
          subjectId={selectedSubjectId}
          standardId={selectedStandardId}
          unitId={selectedUnitId}
          lessonId={historyModalLesson.lessonId}
          lessonTitle={historyModalLesson.lessonTitle}
          mode="lesson_wise"
        />
      )}
    </div>
  )
}

export default MockTests
