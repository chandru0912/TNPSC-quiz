import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FileText,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Timer,
  Sparkles,
  X,
  BookOpen,
  Award,
  Trophy,
  BarChart2,
  ChevronRight,
  GraduationCap,
  Play,
  Languages,
  Clock,
  Eraser,
  Grid,
  Send,
  History,
} from 'lucide-react'
import { apiFetch } from '../utils/api'
import { useStudentAuth } from '../context/StudentAuthContext'
import { buildAuthRedirectUrl, savePostLoginRedirect } from '../utils/authRedirect'
import { notifyStudentSync, subscribeStudentSync } from '../utils/studentSync'
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker'
import { useMcqTranslations } from '../hooks/useMcqTranslations'
import { useIsMobileViewport } from '../hooks/useIsMobileViewport'
import {
  AwardShieldLogo,
  LessonAwardSummaryBar,
  AwardCelebrationModal,
  type AchievementAwardResult,
} from '../components/exam/AchievementAwards'
import { AttemptHistoryModal } from '../components/exam/AttemptHistoryModal'
import { TestSubmissionConfirmModal } from '../components/exam/TestSubmissionConfirmModal'
import {
  getSubjectsForGroup,
  getStandardsForSubject,
} from '../data/unifiedSyllabusRegistry'
import {
  dynamicSyllabusService,
  type DynamicUnit,
  type DynamicLesson,
} from '../services/dynamicSyllabusService'
import './PreviousPapers.css'
import './PreviousPaperTest.css'
import './MCQPractice.css'

interface QuestionItem {
  id: number | string
  category: 'group1' | 'group2_2a' | 'group4_vao'
  subCategory?: 'group2' | 'group2a' | 'group4' | 'vao' | 'both'
  unitId?: number
  classId?: number
  subject?: string
  lessonTitle?: string
  lessonId?: string
  topic?: string
  difficulty?: 'Easy' | 'Medium' | 'Hard'
  tag: string
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  sourceReference?: string
  sourcePage?: number | null
}

const MCQPractice = () => {
  useStudyTimeTracker()
  const isMobile = useIsMobileViewport(767)
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useStudentAuth()
  const routeParams = useParams<{
    '*'?: string
    groupId?: string
    subjectId?: string
    standardId?: string
    unitId?: string
    lessonId?: string
  }>()
  const [searchParams] = useSearchParams()
  const quizStartTimeRef = useRef<number>(Date.now())
  const submissionTokenRef = useRef<string>(`mcq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`)

  const wildcardSegments = (routeParams['*'] || '').split('/').filter(Boolean).map((s) => decodeURIComponent(s))
  const paramGroupId = routeParams.groupId || wildcardSegments[0]
  const paramSubjectId = routeParams.subjectId || wildcardSegments[1]
  const paramStandardId = routeParams.standardId || wildcardSegments[2]
  const paramUnitId = routeParams.unitId || wildcardSegments[3]
  const paramLessonId = routeParams.lessonId || (wildcardSegments[4] && wildcardSegments[4] !== 'test' ? wildcardSegments[4] : undefined)

  const urlGroup = paramGroupId || searchParams.get('group')
  const urlSubjectId = paramSubjectId || searchParams.get('subjectId')
  const rawStandardParam = paramStandardId || searchParams.get('classId')
  const urlClassId = rawStandardParam && /^\d+$/.test(rawStandardParam) ? parseInt(rawStandardParam, 10) : null
  const rawUnitParam = paramUnitId || searchParams.get('unitId')
  const urlUnitId = rawUnitParam && /^\d+$/.test(rawUnitParam) ? parseInt(rawUnitParam, 10) : null
  const urlUnitTitle = searchParams.get('unitTitle')
  const urlLesson = searchParams.get('lesson')
  const urlLessonId = paramLessonId ? decodeURIComponent(paramLessonId) : searchParams.get('lessonId')
  const urlTopic = searchParams.get('topic')
  const isTestActive = Boolean(urlLessonId || urlLesson || searchParams.get('title'))

  const [selectedGroup, setSelectedGroup] = useState<string>(
    urlGroup || 'group1'
  )
  const [activeUnitFilter, setActiveUnitFilter] = useState<number | null>(urlUnitId)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(urlSubjectId || 'general-studies')
  const [selectedStandardId, setSelectedStandardId] = useState<number>(urlClassId || 6)
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(urlUnitId || null)

  const normalizedGroup: 'group1' | 'group2' | 'group4' =
    selectedGroup === 'group2' || selectedGroup === 'group2a' || selectedGroup === 'group2_2a'
      ? 'group2'
      : selectedGroup === 'group4' || selectedGroup === 'vao' || selectedGroup === 'group4_vao'
        ? 'group4'
        : 'group1'

  const handleBackToStandard = () => {
    // Navigate directly to the originating standard / class page without browser history stepping
    if (selectedGroup === 'group2' || selectedGroup === 'group2a' || selectedGroup === 'group2_2a') {
      if (urlUnitId && urlClassId) {
        navigate(`/materials/group2/${urlSubjectId}/unit/${urlUnitId}/class/${urlClassId}`)
      } else if (urlClassId) {
        navigate(`/materials/group2/${urlSubjectId}/class/${urlClassId}`)
      } else if (urlUnitId) {
        navigate(`/materials/group2/${urlSubjectId}/unit/${urlUnitId}`)
      } else {
        navigate(`/materials/group2/${urlSubjectId}`)
      }
    } else if (selectedGroup === 'group4' || selectedGroup === 'vao' || selectedGroup === 'group4_vao') {
      if (urlUnitId && urlClassId) {
        navigate(`/materials/group4/${urlSubjectId}/unit/${urlUnitId}/class/${urlClassId}`)
      } else if (urlClassId) {
        navigate(`/materials/group4/${urlSubjectId}/class/${urlClassId}`)
      } else if (urlUnitId) {
        navigate(`/materials/group4/${urlSubjectId}/unit/${urlUnitId}`)
      } else {
        navigate(`/materials/group4/${urlSubjectId}`)
      }
    } else {
      // Group 1
      const isApt = urlSubjectId === 'aptitude'
      const g1Base = isApt ? '/materials/group1/aptitude' : '/materials/group1'
      if (urlUnitId && urlClassId) {
        navigate(`${g1Base}/unit/${urlUnitId}/class/${urlClassId}`)
      } else if (urlClassId) {
        navigate(`${g1Base}/class/${urlClassId}`)
      } else if (urlUnitId) {
        navigate(`${g1Base}/unit/${urlUnitId}`)
      } else {
        navigate(isApt ? '/materials/group1/aptitude' : '/materials/group1/general-studies')
      }
    }
  }

  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [answeredQuestions, setAnsweredQuestions] = useState(0)
  const [isQuizCompleted, setIsQuizCompleted] = useState(false)
  const [isReviewMode, setIsReviewMode] = useState(false)
  const [userAnswers, setUserAnswers] = useState<Record<number, { selected: number; isCorrect: boolean }>>({})
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({})
  const [visitedQuestions, setVisitedQuestions] = useState<Record<number, boolean>>({ 0: true })
  const [isPaletteOpenMobile, setIsPaletteOpenMobile] = useState(false)
  const [showSubmitPracticeModal, setShowSubmitPracticeModal] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [questionLang, setQuestionLang] = useState<'en' | 'ta'>('en')
  const loggedAttemptRef = useRef<Record<number, number>>({})

  // Live Database Questions & Connection State
  const [dbQuestions, setDbQuestions] = useState<QuestionItem[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true)
  const [dynamicUnits, setDynamicUnits] = useState<DynamicUnit[]>([])
  const [isUnitsLoading, setIsUnitsLoading] = useState<boolean>(true)
  const [unitsCountByStandard, setUnitsCountByStandard] = useState<Record<number, number>>({})
  const [dynamicLessons, setDynamicLessons] = useState<DynamicLesson[]>([])
  const [isLessonsLoading, setIsLessonsLoading] = useState<boolean>(false)
  const [syllabusRefreshTick, setSyllabusRefreshTick] = useState<number>(0)
  const [progressRefreshTick, setProgressRefreshTick] = useState<number>(0)
  const [unitProgressByNum, setUnitProgressByNum] = useState<Record<number, {
    totalLessons: number
    completedLessons: number
    remainingLessons: number
    completionPercentage: number
    totalAttempts: number
    goldCount: number
    platinumCount: number
    silverCount: number
    totalAwards: number
  }>>({})
  const [lessonProgressById, setLessonProgressById] = useState<Record<string, {
    status: 'not_started' | 'in_progress' | 'completed'
    totalAttempts: number
    goldCount: number
    platinumCount: number
    silverCount: number
    totalAwards: number
    bestGrade: string | null
    bestGradeColor: string | null
    lastPracticedAt: string | null
  }>>({})
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
  const [lastSubmittedGrade, setLastSubmittedGrade] = useState<{ grade: string; colorHex: string } | null>(null)
  const [syllabusFacets, setSyllabusFacets] = useState<{
    totalQuestions: number
    subjects: { id?: string; name: string; questionCount: number }[]
    standards: { classId: number; questionCount: number }[]
    units: { unitId: number; questionCount: number }[]
    lessons: {
      lessonId: string | null
      lessonTitle: string
      subject: string
      classId: number | null
      unitId: number | null
      questionCount: number
    }[]
  }>({
    totalQuestions: 0,
    subjects: [],
    standards: [],
    units: [],
    lessons: [],
  })

  useEffect(() => {
    setSelectedGroup(urlGroup || 'group1')
    setActiveUnitFilter(urlUnitId)
    if (urlSubjectId) {
      setSelectedSubjectId(urlSubjectId)
    }
    if (urlClassId) {
      setSelectedStandardId(urlClassId)
    }
    if (urlUnitId) {
      setSelectedUnitId(urlUnitId)
    }
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setScore(0)
    setAnsweredQuestions(0)
    setIsQuizCompleted(false)
    setIsReviewMode(false)
    setUserAnswers({})
    setMarkedForReview({})
    setVisitedQuestions({ 0: true })
    setShowSubmitPracticeModal(false)
    setElapsedSeconds(0)
    loggedAttemptRef.current = {}
  }, [urlGroup, urlUnitId, urlClassId, urlLesson, urlLessonId, urlTopic])

  // Fetch live syllabus facets (Group -> Subject -> Standard -> Unit -> Lesson) across Study Materials + Main Practice
  useEffect(() => {
    let isMounted = true
    const fetchFacets = async () => {
      try {
        const params = new URLSearchParams()
        if (selectedGroup) params.set('category', selectedGroup)
        const facetSubjectId = urlSubjectId || selectedSubjectId
        if (facetSubjectId && facetSubjectId !== 'all') {
          params.set('subject', facetSubjectId)
        }
        const facetClassId = urlClassId ?? selectedStandardId
        if (facetClassId) params.set('classId', facetClassId.toString())
        if (activeUnitFilter) params.set('unitId', activeUnitFilter.toString())

        const res = await apiFetch(`/api/questions/syllabus-facets?${params.toString()}`)
        if (!res.ok) return
        const data = await res.json()
        if (isMounted && data?.status === 'success') {
          setSyllabusFacets({
            totalQuestions: data.totalQuestions || 0,
            subjects: Array.isArray(data.subjects) ? data.subjects : [],
            standards: Array.isArray(data.standards) ? data.standards : [],
            units: Array.isArray(data.units) ? data.units : [],
            lessons: Array.isArray(data.lessons) ? data.lessons : [],
          })
        }
      } catch (err) {
        console.warn('[MCQPractice] Failed to fetch syllabus facets:', err)
      }
    }
    fetchFacets()
    return () => {
      isMounted = false
    }
  }, [selectedGroup, urlSubjectId, selectedSubjectId, urlClassId, selectedStandardId, activeUnitFilter])

  // Fetch directly from PostgreSQL Questions API ONLY when a specific Lesson (or Mock Test) is selected
  useEffect(() => {
    let isMounted = true
    if (!isTestActive || !isAuthenticated) {
      setDbQuestions([])
      setIsInitialLoading(false)
      return () => {
        isMounted = false
      }
    }

    const fetchQuestions = async () => {
      try {
        setIsInitialLoading(true)
        const queryParams = new URLSearchParams()
        queryParams.set('target_system', 'all')
        if (selectedGroup) queryParams.set('category', selectedGroup)
        if (activeUnitFilter) queryParams.set('unitId', activeUnitFilter.toString())
        if (urlClassId) queryParams.set('classId', urlClassId.toString())
        if (urlLessonId) queryParams.set('lessonId', urlLessonId)
        if (urlLesson) queryParams.set('lesson', urlLesson)
        if (urlTopic) queryParams.set('topic', urlTopic)
        if (urlSubjectId && urlSubjectId !== 'all') {
          queryParams.set('subject', urlSubjectId)
        }
        queryParams.set('limit', '500')

        // 1. Primary Query: Exact Lesson + Class + Unit matching
        let res = await apiFetch(`/api/questions?${queryParams.toString()}`)
        let data = res.ok ? await res.json() : null
        let questions: QuestionItem[] = (data?.status === 'success' && Array.isArray(data?.data)) ? data.data : []

        // 2. Secondary Relaxation: If 0 questions found with classId and lesson,
        // retry matching the exact lesson across standards (in case question was tagged without classId)
        if (questions.length === 0 && urlClassId && (urlLesson || urlLessonId)) {
          const relaxClassParams = new URLSearchParams(queryParams)
          relaxClassParams.delete('classId')
          const relaxRes = await apiFetch(`/api/questions?${relaxClassParams.toString()}`)
          if (relaxRes.ok) {
            const relaxData = await relaxRes.json()
            if (relaxData.status === 'success' && Array.isArray(relaxData.data) && relaxData.data.length > 0) {
              questions = relaxData.data
            }
          }
        }

        // 3. Unit-level fallback ONLY if the student clicked on the Unit as a whole without selecting any lesson.
        // If a specific lesson was requested, STRICT lesson-wise mapping applies (never leak unit questions into an empty lesson)!
        const isLessonSpecific = Boolean(urlLesson || urlLessonId)
        if (!isLessonSpecific && questions.length === 0 && activeUnitFilter) {
          const fallbackParams = new URLSearchParams()
          fallbackParams.set('target_system', 'all')
          if (selectedGroup) fallbackParams.set('category', selectedGroup)
          fallbackParams.set('unitId', activeUnitFilter.toString())
          if (urlClassId) fallbackParams.set('classId', urlClassId.toString())
          fallbackParams.set('limit', '500')

          const fallbackRes = await apiFetch(`/api/questions?${fallbackParams.toString()}`)
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json()
            if (fallbackData.status === 'success' && Array.isArray(fallbackData.data) && fallbackData.data.length > 0) {
              questions = fallbackData.data
            }
          }
        }

        if (isMounted) {
          if (questions.length > 0) {
            // Deduplicate by question ID and normalized question text within the same lesson
            const seenText = new Set<string>()
            const unique: QuestionItem[] = []
            const byId = new Map(questions.map((q: QuestionItem) => [q.id, q]))
            for (const q of byId.values()) {
              const textKey = `${(q.question || '').trim().toLowerCase()}::${(q.lessonTitle || '').trim().toLowerCase()}`
              if (!seenText.has(textKey)) {
                seenText.add(textKey)
                unique.push(q)
              }
            }
            setDbQuestions(unique)
          } else {
            setDbQuestions([])
          }
        }
      } catch (err) {
        console.error('Failed to fetch questions:', err)
        if (isMounted) {
          setDbQuestions([])
        }
      } finally {
        if (isMounted && isInitialLoading) {
          setIsInitialLoading(false)
        }
      }
    }

    fetchQuestions()
    return () => {
      isMounted = false
    }
  }, [isTestActive, isAuthenticated, selectedGroup, activeUnitFilter, urlClassId, urlLesson, urlLessonId, urlTopic, urlSubjectId])

  const groups = [
    { id: 'group1', name: 'TNPSC Group 1' },
    { id: 'group2', name: 'TNPSC Group 2 & 2A' },
    { id: 'group4', name: 'TNPSC Group 4' },
  ]

  // Authoritative Study Materials Hierarchy (Group -> Subject -> Standard -> Unit -> Lesson)
  const hierarchySubjects = getSubjectsForGroup(normalizedGroup).map((sub) => {
    const matched = syllabusFacets.subjects.find(
      (f) => f.id === sub.id || f.name.toLowerCase() === sub.name.toLowerCase()
    )
    return {
      ...sub,
      questionCount: matched ? matched.questionCount : 0,
    }
  })

  const effectiveSubjectId = urlSubjectId
    ? urlSubjectId
    : hierarchySubjects.some((s) => s.id === selectedSubjectId)
      ? selectedSubjectId
      : hierarchySubjects[0]?.id || 'general-studies'

  const hierarchyStandards = effectiveSubjectId
    ? getStandardsForSubject(normalizedGroup, effectiveSubjectId).map((st) => {
      const matched = syllabusFacets.standards.find((f) => Number(f.classId) === st.id)
      return {
        ...st,
        questionCount: matched ? matched.questionCount : 0,
      }
    })
    : []

  const effectiveClassId: number | null = urlClassId
    ? urlClassId
    : hierarchyStandards.length > 0
      ? hierarchyStandards.some((s) => s.id === selectedStandardId)
        ? selectedStandardId
        : hierarchyStandards[0].id
      : null

  // Subscribe to Study Materials syllabus changes for automatic synchronization
  useEffect(() => {
    const unsubscribe = dynamicSyllabusService.subscribe(() => {
      setSyllabusRefreshTick((t) => t + 1)
    })
    return unsubscribe
  }, [])

  // Subscribe to student sync events to refresh progress live
  useEffect(() => {
    return subscribeStudentSync(() => {
      setProgressRefreshTick((t) => t + 1)
    })
  }, [])

  // Fetch authenticated student's Unit & Lesson progress from PostgreSQL
  useEffect(() => {
    let isMounted = true
    const studentToken = localStorage.getItem('tnpsc_student_token')
    if (!studentToken || !effectiveSubjectId || !effectiveClassId) {
      setUnitProgressByNum({})
      setLessonProgressById({})
      return () => {
        isMounted = false
      }
    }

    const q = new URLSearchParams({
      groupId: normalizedGroup,
      subjectId: effectiveSubjectId,
      standardId: String(effectiveClassId),
      mode: 'mcq_practice',
    })
    apiFetch(`/api/student/syllabus-progress?${q.toString()}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    })
      .then(async (res) => {
        if (!res.ok) return
        const json = await res.json()
        if (!isMounted || json?.status !== 'success' || !json?.data) return
        const uMap: Record<number, any> = {}
        for (const u of json.data.units || []) {
          uMap[Number(u.unitNumber)] = u
        }
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

    return () => {
      isMounted = false
    }
  }, [normalizedGroup, effectiveSubjectId, effectiveClassId, progressRefreshTick, syllabusRefreshTick])

  // Fetch live Study Materials Units for the selected Group, Subject, and Standard
  useEffect(() => {
    let isMounted = true
    if (!effectiveSubjectId || !effectiveClassId) {
      setDynamicUnits([])
      setIsUnitsLoading(false)
      return () => {
        isMounted = false
      }
    }
    setIsUnitsLoading(true)
    dynamicSyllabusService
      .getUnits(normalizedGroup, effectiveSubjectId, effectiveClassId, { allowEmpty: true })
      .then((units) => {
        if (isMounted) {
          setDynamicUnits(units)
          setIsUnitsLoading(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setDynamicUnits([])
          setIsUnitsLoading(false)
        }
      })
    return () => {
      isMounted = false
    }
  }, [normalizedGroup, effectiveSubjectId, effectiveClassId, syllabusRefreshTick])

  // Fetch live Study Materials Unit counts for each Standard card
  useEffect(() => {
    let isMounted = true
    if (!effectiveSubjectId) {
      setUnitsCountByStandard({})
      return () => {
        isMounted = false
      }
    }
    const stdIds = getStandardsForSubject(normalizedGroup, effectiveSubjectId).map((s) => s.id)
    Promise.all(
      stdIds.map(async (stdId) => {
        const units = await dynamicSyllabusService.getUnits(normalizedGroup, effectiveSubjectId, stdId, {
          allowEmpty: true,
        })
        return [stdId, units.length] as const
      })
    )
      .then((entries) => {
        if (isMounted) {
          setUnitsCountByStandard(Object.fromEntries(entries))
        }
      })
      .catch(() => {
        if (isMounted) {
          setUnitsCountByStandard({})
        }
      })
    return () => {
      isMounted = false
    }
  }, [normalizedGroup, effectiveSubjectId, syllabusRefreshTick])

  // Fetch live Study Materials Lessons for the selected Group, Subject, Standard, and Unit
  useEffect(() => {
    let isMounted = true
    if (!effectiveSubjectId || !effectiveClassId || !activeUnitFilter) {
      setDynamicLessons([])
      setIsLessonsLoading(false)
      return () => {
        isMounted = false
      }
    }
    setIsLessonsLoading(true)
    dynamicSyllabusService
      .getLessons({
        examId: normalizedGroup,
        subjectId: effectiveSubjectId,
        standardNumber: effectiveClassId,
        unitNumber: activeUnitFilter,
      })
      .then((lessons) => {
        if (isMounted) {
          setDynamicLessons(lessons)
          setIsLessonsLoading(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setDynamicLessons([])
          setIsLessonsLoading(false)
        }
      })
    return () => {
      isMounted = false
    }
  }, [normalizedGroup, effectiveSubjectId, effectiveClassId, activeUnitFilter, syllabusRefreshTick])

  const hierarchyUnits =
    effectiveSubjectId && effectiveClassId
      ? dynamicUnits.map((u) => {
        const unitNum = Number(u.unit_number)
        const matched = syllabusFacets.units.find((f) => Number(f.unitId) === unitNum)
        return {
          id: unitNum,
          dbUnitId: u.id,
          unitNumber: u.unitNumber || u.unit_code || `Unit ${unitNum}`,
          title: u.title,
          subjectName: u.subjectName || u.subject_name || activeSubjectObjFallback(effectiveSubjectId),
          questionCount: matched ? matched.questionCount : 0,
        }
      })
      : []

  function activeSubjectObjFallback(subId: string) {
    return hierarchySubjects.find((s) => s.id === subId)?.name || subId
  }

  const hierarchyLessons =
    effectiveSubjectId && effectiveClassId && activeUnitFilter
      ? dynamicLessons.map((l) => {
        const normTitle = (l.title || '').trim().toLowerCase()
        const matched = syllabusFacets.lessons.find(
          (f) =>
            (f.lessonId && f.lessonId === l.id) ||
            f.lessonTitle.trim().toLowerCase() === normTitle
        )
        return {
          id: l.id,
          lessonNumber: l.lesson_number || '',
          title: l.title,
          term: l.term,
          description: l.description,
          matchedLessonId: matched?.lessonId || l.id,
          questionCount: matched ? matched.questionCount : 0,
        }
      })
      : []

  const activeSubjectObj = hierarchySubjects.find((s) => s.id === effectiveSubjectId) || null
  const activeUnitObj = hierarchyUnits.find((u) => u.id === activeUnitFilter) || null

  const validGroupIds = new Set(['group1', 'group2', 'group2a', 'group2_2a', 'group4', 'vao', 'group4_vao'])
  const hasInvalidRoute =
    (paramGroupId && !validGroupIds.has(paramGroupId.toLowerCase())) ||
    (urlSubjectId && !hierarchySubjects.some((s) => s.id === urlSubjectId)) ||
    (rawStandardParam && (!urlClassId || !hierarchyStandards.some((st) => st.id === urlClassId))) ||
    (rawUnitParam && !isUnitsLoading && !activeUnitObj)

  const currentView: 'invalid' | 'test' | 'lessons' | 'browse' = hasInvalidRoute
    ? 'invalid'
    : isTestActive
      ? 'test'
      : activeUnitFilter && urlClassId && urlSubjectId
        ? 'lessons'
        : 'browse'

  // Pure database questions (all mock fallback questions completely removed)
  const filteredQuestions: QuestionItem[] = dbQuestions

  // Safe fallback if index exceeds filtered questions
  const activeQuestionIndex = Math.min(currentQuestion, Math.max(0, filteredQuestions.length - 1))

  const rawQuestion = filteredQuestions[activeQuestionIndex]
  const questionItem: QuestionItem | null = rawQuestion || null

  const {
    translations,
    failedIds: failedTranslationIds,
    isTranslating,
    isActiveQuestionTranslating,
    translatedCount,
    translationStatus,
    retry: retryTranslations,
  } = useMcqTranslations(filteredQuestions, questionLang, activeQuestionIndex)

  const [showTamilReadyBadge, setShowTamilReadyBadge] = useState(false)
  useEffect(() => {
    if (questionLang === 'ta' && translationStatus === 'completed' && filteredQuestions.length > 0) {
      setShowTamilReadyBadge(true)
      const timer = window.setTimeout(() => setShowTamilReadyBadge(false), 2500)
      return () => window.clearTimeout(timer)
    }
    setShowTamilReadyBadge(false)
  }, [questionLang, translationStatus, filteredQuestions.length])

  const activeTranslation =
    questionLang === 'ta' && questionItem ? translations[Number(questionItem.id)] : undefined
  const displayedQuestion = activeTranslation?.question || questionItem?.question || ''
  const displayedOptions = activeTranslation?.options || questionItem?.options || []

  const resetQuizState = () => {
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setScore(0)
    setAnsweredQuestions(0)
    setIsQuizCompleted(false)
    setIsReviewMode(false)
    setUserAnswers({})
  }

  const handleGroupSelect = (group: string) => {
    const norm: 'group1' | 'group2' | 'group4' =
      group === 'group2' || group === 'group2a' || group === 'group2_2a'
        ? 'group2'
        : group === 'group4' || group === 'vao' || group === 'group4_vao'
          ? 'group4'
          : 'group1'
    const defaultSubject = getSubjectsForGroup(norm)[0]?.id || 'general-studies'
    const defaultStandard = getStandardsForSubject(norm, defaultSubject)[0]?.id || 6
    setSelectedGroup(norm)
    setSelectedSubjectId(defaultSubject)
    setSelectedStandardId(defaultStandard)
    setSelectedUnitId(null)
    setActiveUnitFilter(null)
    resetQuizState()
    navigate(`/practice/${norm}`)
  }

  const updateSyllabusFilter = (updates: {
    subjectId?: string | null
    classId?: number | null
    unitId?: number | null
    lessonId?: string | null
    lesson?: string | null
  }) => {
    const nextSubject = updates.subjectId !== undefined ? updates.subjectId : urlSubjectId
    const nextClass = updates.classId !== undefined ? updates.classId : urlClassId
    const nextUnit = updates.unitId !== undefined ? updates.unitId : activeUnitFilter
    const nextLessonId = updates.lessonId !== undefined ? updates.lessonId : urlLessonId
    const nextLesson = updates.lesson !== undefined ? updates.lesson : urlLesson

    setActiveUnitFilter(nextUnit || null)
    resetQuizState()

    if (!nextSubject || nextSubject === 'all') {
      navigate(`/practice/${normalizedGroup}`)
      return
    }
    if (!nextClass) {
      navigate(`/practice/${normalizedGroup}/${encodeURIComponent(nextSubject)}`)
      return
    }
    if (!nextUnit) {
      navigate(`/practice/${normalizedGroup}/${encodeURIComponent(nextSubject)}/${nextClass}`)
      return
    }
    if (!nextLessonId && !nextLesson) {
      navigate(`/practice/${normalizedGroup}/${encodeURIComponent(nextSubject)}/${nextClass}/${nextUnit}`)
      return
    }
    const lessonSegment = encodeURIComponent(nextLessonId || nextLesson || 'lesson')
    const query = nextLesson ? `?lesson=${encodeURIComponent(nextLesson)}` : ''
    const targetTestUrl = `/practice/${normalizedGroup}/${encodeURIComponent(nextSubject)}/${nextClass}/${nextUnit}/${lessonSegment}/test${query}`
    const studentToken = localStorage.getItem('tnpsc_student_token')
    if (!isAuthenticated || !studentToken) {
      savePostLoginRedirect(targetTestUrl)
      navigate(buildAuthRedirectUrl('login', targetTestUrl), { state: { from: targetTestUrl } })
      return
    }
    navigate(targetTestUrl)
  }

  const clearUnitFilter = () => {
    setActiveUnitFilter(null)
    resetQuizState()
    navigate(`/practice/${normalizedGroup}`)
  }

  // Direct redirect to Login Page if an unauthenticated user lands directly on an MCQ test URL
  useEffect(() => {
    if (authLoading || !isTestActive) return
    const studentToken = localStorage.getItem('tnpsc_student_token')
    if (isAuthenticated && studentToken) return
    const currentUrl = `${window.location.pathname}${window.location.search}`
    savePostLoginRedirect(currentUrl)
    navigate(buildAuthRedirectUrl('login', currentUrl), { replace: true, state: { from: currentUrl } })
  }, [authLoading, isTestActive, isAuthenticated, navigate])

  // Elapsed practice timer (counts up during active practice)
  useEffect(() => {
    if (currentView !== 'test' || isQuizCompleted || filteredQuestions.length === 0) return
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [currentView, isQuizCompleted, filteredQuestions.length])

  const formatElapsedClock = (secs: number) => {
    const safe = Math.max(0, Math.floor(secs))
    const hrs = Math.floor(safe / 3600)
    const mins = Math.floor((safe % 3600) / 60)
    const rem = safe % 60
    return [hrs, mins, rem].map((v) => String(v).padStart(2, '0')).join(':')
  }

  const logSingleQuestionAttempt = (qItem: QuestionItem, chosenOpt: number, qIndex: number) => {
    if (loggedAttemptRef.current[qIndex] === chosenOpt) return
    loggedAttemptRef.current[qIndex] = chosenOpt
    const studentToken = localStorage.getItem('tnpsc_student_token')
    if (!studentToken) return

    const isCorrect = chosenOpt === qItem.correctAnswer
    apiFetch('/api/student/question-attempt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        questionId: typeof qItem.id === 'number' ? qItem.id : null,
        category: selectedGroup,
        subject: qItem.subject || urlSubjectId || 'General Studies',
        classId: qItem.classId || urlClassId,
        unitId: qItem.unitId || urlUnitId,
        lessonId: qItem.lessonId || urlLessonId,
        lessonTitle: qItem.lessonTitle || urlLesson || 'General Practice',
        topic: qItem.topic || urlTopic,
        selectedOption: chosenOpt,
        correctAnswer: qItem.correctAnswer,
        isCorrect,
        sourceSystem: searchParams.get('title') ? 'mock_test' : 'mcq_practice',
        timeSpentSeconds: 15,
      }),
    })
      .then((res) => {
        if (res.ok) notifyStudentSync()
      })
      .catch((err) => console.warn('[StudentTrack] Failed to log question attempt:', err))
  }

  const goToPracticeQuestion = (idx: number) => {
    if (idx < 0 || idx >= filteredQuestions.length) return
    setCurrentQuestion(idx)
    setVisitedQuestions((prev) => ({ ...prev, [idx]: true }))
    const existing = userAnswers[idx]
    if (existing !== undefined) {
      setSelectedAnswer(existing.selected)
    } else {
      setSelectedAnswer(null)
    }
    setIsPaletteOpenMobile(false)
  }

  const handleAnswerSelect = (index: number) => {
    if (isReviewMode) return
    if (!questionItem) return
    const isCorrect = index === questionItem.correctAnswer
    setSelectedAnswer(index)
    setVisitedQuestions((prev) => ({ ...prev, [activeQuestionIndex]: true }))
    setUserAnswers((prev) => {
      const next = {
        ...prev,
        [activeQuestionIndex]: { selected: index, isCorrect },
      }
      const nextAnswered = Object.keys(next).length
      const nextScore = Object.values(next).filter((a) => a.isCorrect).length
      setAnsweredQuestions(nextAnswered)
      setScore(nextScore)
      return next
    })
  }

  const handleClearResponse = () => {
    if (isReviewMode) return
    setSelectedAnswer(null)
    setUserAnswers((prev) => {
      const next = { ...prev }
      delete next[activeQuestionIndex]
      const nextAnswered = Object.keys(next).length
      const nextScore = Object.values(next).filter((a) => a.isCorrect).length
      setAnsweredQuestions(nextAnswered)
      setScore(nextScore)
      return next
    })
  }

  const handleSaveAndNext = () => {
    const chosen = userAnswers[activeQuestionIndex]?.selected ?? selectedAnswer
    if (chosen !== null && chosen !== undefined && questionItem) {
      logSingleQuestionAttempt(questionItem, chosen, activeQuestionIndex)
    }
    if (activeQuestionIndex < filteredQuestions.length - 1) {
      goToPracticeQuestion(activeQuestionIndex + 1)
    }
  }

  const handleNext = () => {
    if (activeQuestionIndex < filteredQuestions.length - 1) {
      goToPracticeQuestion(activeQuestionIndex + 1)
    }
  }

  const handlePrev = () => {
    if (activeQuestionIndex > 0) {
      goToPracticeQuestion(activeQuestionIndex - 1)
    }
  }

  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false)
  const [submitQuizError, setSubmitQuizError] = useState<string | null>(null)

  const handleFinishQuiz = async () => {
    if (isSubmittingQuiz) return
    setSubmitQuizError(null)

    const finalAnsweredCount = Object.keys(userAnswers).length
    const finalScoreCount = Object.values(userAnswers).filter((a) => a.isCorrect).length
    const studentToken = localStorage.getItem('tnpsc_student_token')

    // Log any answered questions not yet recorded individually
    filteredQuestions.forEach((q, idx) => {
      const ans = userAnswers[idx]
      if (ans !== undefined) {
        logSingleQuestionAttempt(q, ans.selected, idx)
      }
    })

    // Record completed Practice Session to PostgreSQL and wait for backend confirmation before marking submitted
    if (studentToken) {
      setIsSubmittingQuiz(true)
      try {
        const explicitTitle = searchParams.get('title')
        const assessmentType = explicitTitle
          ? 'mock_test'
          : urlLesson || urlLessonId
            ? 'lesson_quiz'
            : 'subject_drill'
        const testTitle =
          explicitTitle ||
          urlLesson ||
          urlUnitTitle ||
          `${selectedGroup.toUpperCase()} ${urlSubjectId} Practice Drill`
        const totalQ = filteredQuestions.length
        const totalDuration = Math.max(1, elapsedSeconds || Math.round((Date.now() - quizStartTimeRef.current) / 1000))
        const responses = filteredQuestions.map((q, idx) => {
          const ans = userAnswers[idx]
          return {
            questionId: typeof q.id === 'number' ? q.id : null,
            questionText: q.question,
            options: q.options,
            subject: q.subject || urlSubjectId || 'General Studies',
            topic: q.topic || q.lessonTitle || testTitle,
            selectedOption: ans ? ans.selected : null,
            correctAnswer: q.correctAnswer,
            isCorrect: ans ? ans.isCorrect : false,
          }
        })

        const resolvedLessonTitle = urlLesson ? decodeURIComponent(urlLesson) : testTitle
        const res = await apiFetch('/api/student/assessments/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${studentToken}`,
          },
          body: JSON.stringify({
            testId: urlLessonId || `mcq-${normalizedGroup}-${effectiveSubjectId}-${effectiveClassId}-${activeUnitFilter || 0}`,
            testTitle,
            category: selectedGroup,
            assessmentType,
            submissionToken: submissionTokenRef.current,
            totalQuestions: totalQ,
            attemptedQuestions: finalAnsweredCount,
            correctAnswers: finalScoreCount,
            incorrectAnswers: Math.max(0, finalAnsweredCount - finalScoreCount),
            unansweredQuestions: Math.max(0, totalQ - finalAnsweredCount),
            score: finalScoreCount * 1.5,
            maxScore: totalQ * 1.5,
            timeSpentSeconds: totalDuration,
            responses,
            groupId: normalizedGroup,
            subjectId: effectiveSubjectId,
            standardId: effectiveClassId,
            unitId: activeUnitFilter,
            lessonId: urlLessonId,
            lessonTitle: resolvedLessonTitle,
            mockTestFormat: 'mcq_practice',
          }),
        })

        const json = await res.json().catch(() => null)
        if (!res.ok) {
          setSubmitQuizError(json?.message || 'Unable to submit your test right now. Your answers are saved—please try again.')
          return
        }

        if (json?.grade) {
          setLastSubmittedGrade({
            grade: json.grade,
            colorHex: json.gradeColor || '#a855f7',
          })
        }
        const earnedPct =
          typeof json?.percentage === 'number'
            ? json.percentage
            : Math.round((finalScoreCount / Math.max(1, totalQ)) * 1000) / 10
        const earnedAward: AchievementAwardResult =
          json?.awardType === 'GOLD' ||
          json?.awardType === 'PLATINUM' ||
          json?.awardType === 'SILVER' ||
          json?.awardType === 'NONE'
            ? json.awardType
            : earnedPct >= 90
              ? 'GOLD'
              : earnedPct >= 75
                ? 'PLATINUM'
                : earnedPct >= 60
                  ? 'SILVER'
                  : 'NONE'
        setLastSubmittedAward(earnedAward)
        if (!json?.duplicate) {
          setCelebrationState({
            awardType: earnedAward,
            percentage: earnedPct,
            title: resolvedLessonTitle,
          })
        }
        setProgressRefreshTick((t) => t + 1)
        notifyStudentSync()
      } catch {
        setSubmitQuizError('Network error while submitting your test. Your answers are intact—please retry.')
        return
      } finally {
        setIsSubmittingQuiz(false)
      }
    }

    setShowSubmitPracticeModal(false)
    setAnsweredQuestions(finalAnsweredCount)
    setScore(finalScoreCount)
    setIsQuizCompleted(true)
    setIsReviewMode(false)
  }

  const handleStartReview = () => {
    setIsReviewMode(true)
    setCurrentQuestion(0)
    setSelectedAnswer(userAnswers[0]?.selected ?? null)
  }

  const handleBackToScorecard = () => {
    setIsReviewMode(false)
  }

  const handleReset = () => {
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setScore(0)
    setAnsweredQuestions(0)
    setIsQuizCompleted(false)
    setIsReviewMode(false)
    setUserAnswers({})
    setMarkedForReview({})
    setVisitedQuestions({ 0: true })
    setShowSubmitPracticeModal(false)
    setElapsedSeconds(0)
    loggedAttemptRef.current = {}
    quizStartTimeRef.current = Date.now()
    submissionTokenRef.current = `mcq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  const isLastQuestion = activeQuestionIndex === filteredQuestions.length - 1

  // Format question tag nicely according to the selected examination group
  const formatTag = (q: QuestionItem) => {
    const groupName =
      selectedGroup === 'group2_2a'
        ? 'Group 2 & 2A'
        : selectedGroup === 'group4_vao'
          ? 'Group 4 & VAO'
          : 'Group 1'

    if (q.tag) {
      return q.tag.replace(/^Group 1/i, groupName)
    }
    return `${groupName} • Unit ${q.unitId || 1}: ${q.subject || 'General Studies'}`
  }

  return (
    <div className={`practice ${currentView === 'test' && isAuthenticated ? 'is-mcq-test-active' : ''}`}>
      <div className="practice-container">
        {/* Top Navigation Bar with Back buttons (shown only on initial landing page, hidden on subject-specific pages) */}
        {!urlSubjectId && (
          <div className="practice-top-bar">
            <div className="practice-top-nav-left">
              <button
                type="button"
                className="back-btn glass back-materials-btn"
                onClick={() => navigate('/materials')}
                aria-label="Back to Study Materials"
                title="Navigate directly to main Study Materials page"
              >
                <BookOpen size={16} />
                <span>Back to Study Materials</span>
              </button>

              {urlClassId ? (
                <button
                  type="button"
                  className="back-btn glass"
                  onClick={handleBackToStandard}
                  aria-label="Back to Standard"
                  title={urlClassId ? `Back to ${urlClassId}th Standard` : 'Back to Standard'}
                >
                  <ArrowLeft size={16} />
                  <span>Back to Standard</span>
                </button>
              ) : urlUnitId ? (
                <button
                  type="button"
                  className="back-btn glass"
                  onClick={handleBackToStandard}
                  aria-label="Back to Unit"
                  title="Back to Unit"
                >
                  <ArrowLeft size={16} />
                  <span>Back to Unit</span>
                </button>
              ) : null}
            </div>
          </div>
        )}

        {currentView !== 'test' && (
        <div className={`practice-header ${urlSubjectId ? 'is-subject-header' : ''}`}>
          <h1 className="practice-title">
            <FileText size={32} />
            <span>
              MCQ <span className="gradient-text">Practice &amp; Quizzes</span>
            </span>
          </h1>
        </div>
        )}

        {/* Exam Category Tabs (Visible ONLY on the main MCQ Practice browse selection page) */}
        {currentView === 'browse' && !(isMobile && Boolean(urlClassId)) && (
          <div className="practice-categories glass">
            {groups.map((group) => {
              const isActive = normalizedGroup === group.id

              return (
                <button
                  key={group.id}
                  type="button"
                  className={`practice-category-tab ${isActive ? 'active' : ''}`}
                  onClick={() => handleGroupSelect(group.id)}
                >
                  {group.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Compact Syllabus Breadcrumb (Lessons view & Mobile Unit Selection page) */}
        {(currentView === 'lessons' || (isMobile && currentView === 'browse' && Boolean(urlClassId))) && (
          <div className="practice-breadcrumb-row">
            {/* Interactive Syllabus Breadcrumb */}
            <nav className="practice-breadcrumb glass" aria-label="Syllabus navigation breadcrumb">
              <button
                type="button"
                className="breadcrumb-crumb"
                onClick={() =>
                  updateSyllabusFilter({
                    subjectId: null,
                    classId: null,
                    unitId: null,
                    lessonId: null,
                    lesson: null,
                  })
                }
              >
                {normalizedGroup === 'group2'
                  ? 'TNPSC Group 2 & 2A'
                  : normalizedGroup === 'group4'
                    ? 'TNPSC Group 4'
                    : 'TNPSC Group 1'}
              </button>

              {activeSubjectObj && (
                <>
                  <ChevronRight size={14} className="breadcrumb-sep" />
                  <button
                    type="button"
                    className="breadcrumb-crumb"
                    onClick={() => {
                      setSelectedSubjectId(activeSubjectObj.id)
                      setActiveUnitFilter(null)
                      navigate(`/practice/${normalizedGroup}`)
                    }}
                  >
                    {activeSubjectObj.name}
                  </button>
                </>
              )}

              {effectiveClassId && (
                <>
                  <ChevronRight size={14} className="breadcrumb-sep" />
                  <button
                    type="button"
                    className={`breadcrumb-crumb ${isMobile && currentView === 'browse' && Boolean(urlClassId) ? 'current' : ''}`}
                    onClick={() => {
                      setSelectedStandardId(effectiveClassId)
                      setActiveUnitFilter(null)
                      if (isMobile) {
                        updateSyllabusFilter({
                          subjectId: effectiveSubjectId,
                          classId: effectiveClassId,
                          unitId: null,
                          lessonId: null,
                          lesson: null,
                        })
                      } else {
                        navigate(`/practice/${normalizedGroup}`)
                      }
                    }}
                  >
                    {`${effectiveClassId}th Standard`}
                  </button>
                </>
              )}

              {activeUnitFilter && (
                <>
                  <ChevronRight size={14} className="breadcrumb-sep" />
                  <button
                    type="button"
                    className={`breadcrumb-crumb ${!isTestActive ? 'current' : ''}`}
                    onClick={() =>
                      updateSyllabusFilter({
                        unitId: activeUnitFilter,
                        lessonId: null,
                        lesson: null,
                      })
                    }
                  >
                    {activeUnitObj ? `${activeUnitObj.unitNumber}: ${activeUnitObj.title}` : `Unit ${activeUnitFilter}`}
                  </button>
                </>
              )}

              {isTestActive && (urlLesson || searchParams.get('title')) && (
                <>
                  <ChevronRight size={14} className="breadcrumb-sep" />
                  <span className="breadcrumb-crumb current">
                    {decodeURIComponent(urlLesson || searchParams.get('title') || 'Examination')}
                  </span>
                </>
              )}
            </nav>
          </div>
        )}

        {/* Multi-Page Hierarchical Views (One Dedicated Page Per Selection Level) */}
        {currentView === 'invalid' && (
          <div className="empty-practice-state glass">
            <div className="empty-icon-wrap">
              <FileText size={36} className="empty-icon" />
            </div>
            <h3>Invalid Syllabus Route</h3>
            <p>The requested TNPSC Group, Subject, Standard, or Unit path could not be found in the Study Materials syllabus.</p>
            <div className="empty-actions">
              <button type="button" className="btn btn-primary" onClick={clearUnitFilter}>
                <ArrowLeft size={16} />
                <span>Back to MCQ Practice</span>
              </button>
            </div>
          </div>
        )}

        {/* UNIFIED SINGLE-PAGE SELECTION (Desktop/Tablet) & MULTI-PAGE STEP SELECTION (Mobile <= 767px) */}
        {currentView === 'browse' && (
          <div className="hierarchy-navigator">
            {/* Mobile-only Back to Standards button on dedicated Unit Selection page */}
            {isMobile && Boolean(urlClassId) && (
              <div className="page-step-back-row">
                <button
                  type="button"
                  className="back-btn glass"
                  onClick={() => {
                    setSelectedSubjectId(effectiveSubjectId)
                    if (effectiveClassId) setSelectedStandardId(effectiveClassId)
                    updateSyllabusFilter({
                      subjectId: effectiveSubjectId,
                      classId: null,
                      unitId: null,
                      lessonId: null,
                      lesson: null,
                    })
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>Back to Standards</span>
                </button>
              </div>
            )}

            {/* Section 1: Compact Subject Cards (Hidden on Mobile Unit Selection page) */}
            {!(isMobile && Boolean(urlClassId)) && (
            <section className="hierarchy-section glass compact-subjects-section">
              <div className="hierarchy-section-header compact-header">
                <span className="hierarchy-step-badge">Subject</span>
                <h3>Select Subject</h3>
              </div>
              <div className="compact-subject-grid">
                {hierarchySubjects.map((sub) => {
                  const isActiveSub = effectiveSubjectId === sub.id
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      className={`compact-subject-card ${isActiveSub ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedSubjectId(sub.id)
                        setSelectedUnitId(null)
                        setActiveUnitFilter(null)
                        if (urlSubjectId || urlClassId) {
                          navigate(`/practice/${normalizedGroup}`)
                        }
                      }}
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
            )}

            {/* Section 2: Standard Selection (Hidden on Mobile Unit Selection page) */}
            {!(isMobile && Boolean(urlClassId)) && (
            <section className="classes-top-section glass">
              <div className="classes-section-header">
                <div className="classes-heading-group">
                  <div className="classes-title-badge">
                    <GraduationCap size={16} />
                    <span>Samacheer Kalvi Standard Mapping</span>
                  </div>
                  <h2 className="classes-main-heading">
                    {activeSubjectObj?.name} — Select Standard
                  </h2>
                </div>
                <span className="classes-count-badge">{hierarchyStandards.length} Standards</span>
              </div>

              <div className="class-cards-grid">
                {hierarchyStandards.map((cls) => {
                  const unitCount = unitsCountByStandard[cls.id] ?? 0
                  const isActiveStd = effectiveClassId === cls.id
                  const handlePickStandard = () => {
                    setSelectedStandardId(cls.id)
                    setSelectedUnitId(null)
                    if (isMobile) {
                      updateSyllabusFilter({
                        subjectId: effectiveSubjectId,
                        classId: cls.id,
                        unitId: null,
                        lessonId: null,
                        lesson: null,
                      })
                      window.scrollTo({ top: 0, behavior: 'auto' })
                    } else if (urlClassId) {
                      navigate(`/practice/${normalizedGroup}`)
                    }
                  }
                  return (
                    <div
                      key={cls.id}
                      role="button"
                      tabIndex={0}
                      className={`class-card glass ${isActiveStd ? 'active-standard' : ''}`}
                      onClick={handlePickStandard}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handlePickStandard()
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
            )}

            {/* Section 3: Unit Selection (Same Page on Desktop/Tablet; Dedicated Page 2 on Mobile <= 767px) */}
            {effectiveClassId && (!isMobile || Boolean(urlClassId)) && (
              <section className="hierarchy-section glass unified-units-section">
                <div className="hierarchy-section-header">
                  <span className="hierarchy-step-badge">{effectiveClassId}th Standard</span>
                  <h3>Select Unit — {effectiveClassId}th Standard ({activeSubjectObj?.name})</h3>
                </div>
                {isUnitsLoading && hierarchyUnits.length === 0 ? (
                  <p className="hierarchy-empty-note">Loading units from Study Materials...</p>
                ) : hierarchyUnits.length > 0 ? (
                  <div className="hierarchy-card-grid">
                    {hierarchyUnits.map((u) => {
                      const uProg = unitProgressByNum[u.id]
                      const totalL = uProg?.totalLessons ?? 0
                      const completedL = uProg?.completedLessons ?? 0
                      const remainingL = uProg?.remainingLessons ?? totalL
                      const pctL = uProg?.completionPercentage ?? 0
                      return (
                        <button
                          key={u.id}
                          type="button"
                          className={`hierarchy-card ${selectedUnitId === u.id ? 'selected-unit' : ''}`}
                          onClick={() => {
                            setSelectedUnitId(u.id)
                            updateSyllabusFilter({
                              subjectId: effectiveSubjectId,
                              classId: effectiveClassId,
                              unitId: u.id,
                              lessonId: null,
                              lesson: null,
                            })
                          }}
                        >
                          <div className="hierarchy-card-top">
                            <span className="hierarchy-unit-num">{u.unitNumber}</span>
                            <span className={`hierarchy-count-pill ${u.questionCount > 0 ? 'has-qs' : ''}`}>
                              {u.questionCount} Questions
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
                              <div className="unit-progress-fill" style={{ width: `${Math.min(100, Math.max(0, pctL))}%` }} />
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="hierarchy-empty-note">
                    No units mapped in Study Materials for {effectiveClassId}th Standard ({activeSubjectObj?.name}).
                  </p>
                )}
              </section>
            )}
          </div>
        )}

        {/* PAGE 4: Lesson Selection Page */}
        {currentView === 'lessons' && (
          <div className="hierarchy-navigator">
            <div className="page-step-back-row">
              <button
                type="button"
                className="back-btn glass"
                onClick={() =>
                  updateSyllabusFilter({
                    unitId: null,
                    lessonId: null,
                    lesson: null,
                  })
                }
              >
                <ArrowLeft size={16} />
                <span>Back to Units</span>
              </button>
            </div>

            <section className="hierarchy-section glass">
              <div className="hierarchy-section-header">
                <span className="hierarchy-step-badge">{activeUnitObj?.unitNumber || `Unit ${activeUnitFilter}`}</span>
                <h3>
                  {activeUnitObj?.title || 'Lessons'} — {urlClassId}th Standard
                </h3>
              </div>
              {isLessonsLoading ? (
                <p className="hierarchy-empty-note">
                  Loading lessons from Study Materials...
                </p>
              ) : hierarchyLessons.length > 0 ? (
                <div className="hierarchy-lesson-list">
                  {hierarchyLessons.map((l) => {
                    const normTitle = l.title.trim().toLowerCase()
                    const lProg =
                      lessonProgressById[String(l.id)] ||
                      (l.matchedLessonId ? lessonProgressById[String(l.matchedLessonId)] : undefined) ||
                      (activeUnitFilter != null ? lessonProgressById[`unit:${Number(activeUnitFilter)}:title:${normTitle}`] : undefined) ||
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
                          ? 'Continue Practice →'
                          : 'Start Practice →'
                    return (
                      <div key={l.id} className={`hierarchy-lesson-row lesson-status-${status}`}>
                        <div className="hierarchy-lesson-main-col">
                          <div className="hierarchy-lesson-info">
                            <span className="hierarchy-lesson-num">
                              Lesson {l.lessonNumber}
                            </span>
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
                            <span className={`lesson-status-badge status-${status}`}>
                              {statusLabel}
                            </span>
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
                            onClick={() =>
                              updateSyllabusFilter({
                                lessonId: l.matchedLessonId,
                                lesson: l.title,
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

        {/* PAGE 5: MCQ Examination Page (Two-Column Previous Year Papers Layout) */}
        {currentView === 'test' && isAuthenticated && (
          <div className="pyp-exam-page mcq-pyp-exam-page">
            {/* A. Examination Header */}
            <header className="pyp-exam-topbar glass">
              <div className="pyp-topbar-left">
                <button
                  type="button"
                  className="pyp-leave-btn"
                  onClick={() =>
                    updateSyllabusFilter({
                      lessonId: null,
                      lesson: null,
                    })
                  }
                  title="Return to Lessons"
                >
                  <ArrowLeft size={15} />
                  <span>Back to Lessons</span>
                </button>
                <div className="mcq-exam-title-block">
                  <div className="pyp-brand-line">
                    <span className="pyp-hub-tag">TNPSC Aspirant Orbit</span>
                    <span className="pyp-status-dot">
                      ● {isQuizCompleted && !isReviewMode ? 'Completed' : isReviewMode ? 'Review Mode' : 'Practice In Progress'}
                    </span>
                  </div>
                  <h1 className="pyp-exam-heading">
                    {normalizedGroup === 'group2'
                      ? 'TNPSC Group 2 & 2A'
                      : normalizedGroup === 'group4'
                        ? 'TNPSC Group 4'
                        : 'TNPSC Group 1'}
                    {' – '}
                    {activeSubjectObj?.name || 'General Studies'}
                  </h1>
                  <div className="mcq-exam-submeta">
                    {(urlClassId || activeUnitFilter) && (
                      <span className="mcq-exam-std-unit">
                        {[
                          urlClassId ? `${urlClassId}th Standard` : null,
                          activeUnitFilter ? `Unit ${activeUnitFilter}` : null,
                        ]
                          .filter(Boolean)
                          .join(' | ')}
                      </span>
                    )}
                    {(urlLesson || searchParams.get('title')) && (
                      <>
                        {(urlClassId || activeUnitFilter) && (
                          <span className="mcq-exam-submeta-sep" aria-hidden="true"> | </span>
                        )}
                        <span className="mcq-exam-lesson-name">
                          {urlLesson
                            ? decodeURIComponent(urlLesson)
                            : decodeURIComponent(searchParams.get('title')!)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="pyp-topbar-meta">
                <div className="mcq-stats-timer-row">
                  <div className="mcq-stats-group">
                    <div className="pyp-meta-pill">
                      <span>Total</span>
                      <strong>{filteredQuestions.length}</strong>
                    </div>
                    <div className="pyp-meta-pill">
                      <span>Answered</span>
                      <strong style={{ color: '#34d399' }}>{Object.keys(userAnswers).length}</strong>
                    </div>
                    <div className="pyp-meta-pill">
                      <span>Remaining</span>
                      <strong>{Math.max(0, filteredQuestions.length - Object.keys(userAnswers).length)}</strong>
                    </div>
                  </div>
                  <div className="pyp-timer-pill" title="Elapsed Practice Time">
                    <Clock size={15} />
                    <span>{formatElapsedClock(elapsedSeconds)}</span>
                  </div>
                </div>

                <div className="mcq-header-controls-row">
                  {filteredQuestions.length > 0 && (
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
                        {isTranslating && questionLang === 'ta' ? 'தமிழ்…' : 'தமிழ்'}
                      </button>
                    </div>
                  )}

                  {!isQuizCompleted && filteredQuestions.length > 0 && (
                    <button
                      type="button"
                      className="pyp-mobile-palette-toggle"
                      onClick={() => setIsPaletteOpenMobile((v) => !v)}
                    >
                      <Grid size={15} />
                      <span>Palette</span>
                    </button>
                  )}
                </div>
              </div>
            </header>

            {questionLang === 'ta' &&
              filteredQuestions.length > 0 &&
              (translationStatus !== 'completed' || showTamilReadyBadge) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                  <div className={`mcq-translation-status status-${translationStatus}`}>
                    {translationStatus === 'completed' ? (
                      <span>{`✓ Tamil Ready (${translatedCount}/${filteredQuestions.length})`}</span>
                    ) : isTranslating ? (
                      <span>{`Preparing Tamil... (${translatedCount}/${filteredQuestions.length})`}</span>
                    ) : failedTranslationIds.length > 0 ? (
                      <>
                        <span>{`Preparing remaining Tamil questions (${translatedCount}/${filteredQuestions.length})`}</span>
                        <button type="button" className="mcq-retry-btn" onClick={retryTranslations}>
                          Refresh
                        </button>
                      </>
                    ) : (
                      <span>{`Preparing Tamil... (${translatedCount}/${filteredQuestions.length})`}</span>
                    )}
                  </div>
                </div>
              )}

            {/* Question Card / Scorecard / Empty State */}
            {isQuizCompleted && !isReviewMode ? (
              <motion.div
                className="quiz-completion-card glass"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35 }}
              >
                <div className="completion-trophy-wrap">
                  <Trophy size={48} className="completion-trophy-icon" />
                </div>

                <div className="completion-header">
                  <span className="completion-badge">
                    <Sparkles size={14} />
                    <span>Practice Completed</span>
                  </span>
                  <h2 className="completion-title">Practice Completed!</h2>
                  <p className="completion-subtitle">
                    {normalizedGroup === 'group2'
                      ? 'TNPSC Group 2 & 2A'
                      : normalizedGroup === 'group4'
                        ? 'TNPSC Group 4 & VAO'
                        : 'TNPSC Group 1'}
                    {activeUnitFilter ? ` • Unit ${activeUnitFilter}` : ''}
                    {urlLesson ? ` • ${decodeURIComponent(urlLesson)}` : ''}
                  </p>
                </div>

                <div className="completion-score-box">
                  <div className="score-ring">
                    <span className="score-numbers">
                      {score} <span className="score-total">/ {filteredQuestions.length}</span>
                    </span>
                    <span className="score-percentage-pill">
                      {Math.round((score / Math.max(1, filteredQuestions.length)) * 100)}% Accuracy
                    </span>
                    {lastSubmittedAward !== 'NONE' && (
                      <div
                        className={`award-pill-item tier-${lastSubmittedAward.toLowerCase()}`}
                        style={{ marginTop: '0.5rem', padding: '0.32rem 0.78rem 0.32rem 0.45rem' }}
                      >
                        <AwardShieldLogo tier={lastSubmittedAward} size={28} showLabel={false} />
                        <span className="award-pill-name">{lastSubmittedAward} AWARD EARNED</span>
                      </div>
                    )}
                    {lastSubmittedGrade && (
                      <span
                        className="lesson-grade-badge"
                        style={{
                          marginTop: '0.35rem',
                          borderColor: `${lastSubmittedGrade.colorHex}66`,
                          backgroundColor: `${lastSubmittedGrade.colorHex}1f`,
                          color: lastSubmittedGrade.colorHex,
                        }}
                      >
                        Grade: {lastSubmittedGrade.grade}
                      </span>
                    )}
                  </div>
                  <div className="score-evaluation-text">
                    {Math.round((score / Math.max(1, filteredQuestions.length)) * 100) >= 80 ? (
                      <span className="eval-outstanding">
                        🌟 Outstanding Performance! Excellent preparation for TNPSC prelims.
                      </span>
                    ) : Math.round((score / Math.max(1, filteredQuestions.length)) * 100) >= 60 ? (
                      <span className="eval-good">
                        🎯 Good Job! Review the missed questions to reinforce key concepts.
                      </span>
                    ) : (
                      <span className="eval-practice">
                        📖 Keep Practicing! Review the answers and re-attempt.
                      </span>
                    )}
                  </div>
                </div>

                <div className="completion-stats-grid">
                  <div className="completion-stat-tile glass stat-correct">
                    <CheckCircle2 size={22} className="stat-icon-correct" />
                    <div>
                      <span className="stat-num">{score}</span>
                      <span className="stat-label">Correct</span>
                    </div>
                  </div>
                  <div className="completion-stat-tile glass stat-incorrect">
                    <XCircle size={22} className="stat-icon-wrong" />
                    <div>
                      <span className="stat-num">{Math.max(0, answeredQuestions - score)}</span>
                      <span className="stat-label">Incorrect</span>
                    </div>
                  </div>
                  <div className="completion-stat-tile glass stat-total">
                    <BarChart2 size={22} className="stat-icon-total" />
                    <div>
                      <span className="stat-num">{filteredQuestions.length}</span>
                      <span className="stat-label">Total Questions</span>
                    </div>
                  </div>
                </div>

                <div className="completion-actions">
                  <button className="btn btn-secondary review-answers-btn" onClick={handleStartReview}>
                    <FileText size={18} />
                    <span>Review All Answers</span>
                  </button>
                  <button className="btn btn-primary retake-btn" onClick={handleReset}>
                    <RotateCcw size={18} />
                    <span>Retake Practice</span>
                  </button>
                </div>
              </motion.div>
            ) : isInitialLoading ? (
              <div className="empty-practice-state glass">
                <div className="empty-icon-wrap">
                  <Timer size={36} className="empty-icon" />
                </div>
                <h3>Loading Practice Questions...</h3>
                <p>Fetching syllabus-verified MCQs from the question bank.</p>
              </div>
            ) : questionItem ? (
              <div className="pyp-exam-workspace">
                {/* LEFT SIDE: Question Panel */}
                <main className="pyp-question-panel glass">
                  {isReviewMode && (
                    <div className="review-mode-hud glass">
                      <div className="review-mode-info">
                        <span className="review-badge">
                          {`Review Mode • Question ${activeQuestionIndex + 1} of ${filteredQuestions.length}`}
                        </span>
                        <span className="review-score-preview">
                          {`Score: ${score}/${filteredQuestions.length}`}
                        </span>
                      </div>
                      <button type="button" className="btn btn-secondary btn-sm back-scorecard-btn" onClick={handleBackToScorecard}>
                        <Award size={15} />
                        <span>Back to Scorecard</span>
                      </button>
                    </div>
                  )}

                  <div className="pyp-q-header">
                    <span className="pyp-q-num-badge">
                      Question {activeQuestionIndex + 1} of {filteredQuestions.length}
                    </span>
                    <span className="pyp-q-subject-tag">{formatTag(questionItem)}</span>
                    {isActiveQuestionTranslating && (
                      <span className="mcq-translation-status status-processing" style={{ fontSize: '0.72rem', padding: '0.18rem 0.55rem' }}>
                        Translating to Tamil…
                      </span>
                    )}
                    {markedForReview[activeQuestionIndex] && (
                      <span className="pyp-q-review-tag">Marked for Review</span>
                    )}
                  </div>

                  <h2 className="pyp-q-text">{displayedQuestion}</h2>

                  <div
                    className="pyp-options-list"
                    role="radiogroup"
                    aria-label={`Question ${activeQuestionIndex + 1} options`}
                  >
                    {displayedOptions.map((option, index) => {
                      const currentSelected = userAnswers[activeQuestionIndex]?.selected ?? selectedAnswer
                      const isSelected = currentSelected === index
                      let extraCls = isSelected ? 'selected' : ''
                      if (isReviewMode) {
                        if (index === questionItem.correctAnswer) extraCls = 'selected'
                      }
                      return (
                        <label
                          key={index}
                          className={`pyp-option-card ${extraCls}`}
                          style={
                            isReviewMode && index === questionItem.correctAnswer
                              ? { borderColor: '#10b981', background: 'rgba(16, 185, 129, 0.16)' }
                              : isReviewMode && isSelected && index !== questionItem.correctAnswer
                                ? { borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.16)' }
                                : undefined
                          }
                        >
                          <input
                            type="radio"
                            name={`mcq-q-${questionItem.id}`}
                            checked={isSelected}
                            disabled={isReviewMode}
                            onChange={() => handleAnswerSelect(index)}
                          />
                          <span className="pyp-opt-letter">{String.fromCharCode(65 + index)}</span>
                          <span className="pyp-opt-text">{option}</span>
                          {isReviewMode && index === questionItem.correctAnswer && (
                            <CheckCircle2 size={18} style={{ color: '#34d399', marginLeft: 'auto', flexShrink: 0 }} />
                          )}
                          {isReviewMode && isSelected && index !== questionItem.correctAnswer && (
                            <XCircle size={18} style={{ color: '#f87171', marginLeft: 'auto', flexShrink: 0 }} />
                          )}
                        </label>
                      )
                    })}
                  </div>

                  {/* Examination Controls */}
                  <div className="pyp-q-controls">
                    <div className="pyp-q-controls-left">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={activeQuestionIndex <= 0}
                        onClick={handlePrev}
                      >
                        <ArrowLeft size={16} />
                        <span>Previous</span>
                      </button>
                      {!isReviewMode && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleClearResponse}
                          disabled={(userAnswers[activeQuestionIndex]?.selected ?? selectedAnswer) === null}
                        >
                          <Eraser size={16} />
                          <span>Clear Response</span>
                        </button>
                      )}
                    </div>

                    <div className="pyp-q-controls-right">
                      {!isReviewMode ? (
                        isLastQuestion ? (
                          <button
                            type="button"
                            className="btn btn-primary exam-final-submit-btn"
                            onClick={() => {
                              setSubmitQuizError(null)
                              setShowSubmitPracticeModal(true)
                            }}
                          >
                            <Send size={15} />
                            <span>Submit Test</span>
                          </button>
                        ) : (
                          <button type="button" className="btn btn-primary" onClick={handleSaveAndNext}>
                            <span>Save &amp; Next</span>
                            <ArrowRight size={16} />
                          </button>
                        )
                      ) : (
                        !isLastQuestion && (
                          <button type="button" className="btn btn-primary" onClick={handleNext}>
                            <span>Next</span>
                            <ArrowRight size={16} />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </main>

                {/* RIGHT SIDE: Question Palette */}
                <aside className={`pyp-palette-sidebar glass ${isPaletteOpenMobile ? 'mobile-open' : ''}`}>
                  <div className="pyp-palette-head">
                    <div>
                      <h3>Question Palette</h3>
                      <span>Practice Session</span>
                    </div>
                    <button
                      type="button"
                      className="pyp-palette-close"
                      onClick={() => setIsPaletteOpenMobile(false)}
                      aria-label="Close palette"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {(() => {
                    const answeredCnt = Object.keys(userAnswers).length
                    const markedCnt = Object.values(markedForReview).filter(Boolean).length
                    const visitedCnt = Object.keys(visitedQuestions).length
                    const notAnsweredCnt = Math.max(0, visitedCnt - answeredCnt)
                    const notVisitedCnt = Math.max(0, filteredQuestions.length - visitedCnt)
                    return (
                      <div className="pyp-palette-legend">
                        <div><span className="dot answered" /> Answered ({answeredCnt})</div>
                        <div><span className="dot not-answered" /> Not Answered ({notAnsweredCnt})</div>
                        <div><span className="dot review" /> Marked ({markedCnt})</div>
                        <div><span className="dot neutral" /> Not Visited ({notVisitedCnt})</div>
                      </div>
                    )
                  })()}

                  <div className="pyp-palette-grid">
                    {filteredQuestions.map((fq, idx) => {
                      const hasAns = userAnswers[idx] !== undefined
                      const isMarked = Boolean(markedForReview[idx])
                      const isVisited = Boolean(visitedQuestions[idx])
                      let statusCls = 'neutral'
                      if (isMarked) statusCls = 'review'
                      else if (hasAns) statusCls = 'answered'
                      else if (isVisited) statusCls = 'not-answered'

                      return (
                        <button
                          key={fq.id}
                          type="button"
                          className={`pyp-palette-btn ${statusCls} ${idx === activeQuestionIndex ? 'current' : ''}`}
                          onClick={() => goToPracticeQuestion(idx)}
                          aria-label={`Go to question ${idx + 1}`}
                        >
                          {idx + 1}
                        </button>
                      )
                    })}
                  </div>

                  {!isReviewMode && (
                    <button
                      type="button"
                      className="btn pyp-submit-trigger-btn pyp-palette-submit"
                      onClick={() => setShowSubmitPracticeModal(true)}
                    >
                      <Send size={16} />
                      <span>Submit Practice</span>
                    </button>
                  )}
                </aside>
              </div>
            ) : (
              <div className="empty-practice-state glass">
                <div className="empty-icon-wrap">
                  <FileText size={36} className="empty-icon" />
                </div>
                <h3>No Practice MCQs Available</h3>
                <p>
                  {urlLesson ? (
                    <>No questions found for <strong>{decodeURIComponent(urlLesson)}</strong> in {urlClassId ? `${urlClassId}th Standard ` : ''}Unit {activeUnitFilter}.</>
                  ) : urlClassId ? (
                    <>No questions mapped yet for <strong>{urlClassId}th Standard</strong>{activeUnitFilter ? ` Unit ${activeUnitFilter}` : ''}.</>
                  ) : activeUnitFilter ? (
                    <>No questions mapped yet for <strong>Unit {activeUnitFilter}</strong>.</>
                  ) : (
                    <>No practice questions found for the selected examination filter.</>
                  )}
                </p>
                <div className="empty-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => updateSyllabusFilter({ lessonId: null, lesson: null })}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Lessons</span>
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={clearUnitFilter}>
                    <RotateCcw size={16} />
                    <span>Reset Syllabus Filter</span>
                  </button>
                </div>
              </div>
            )}

            {/* Submit Practice Confirmation Modal */}
            <TestSubmissionConfirmModal
              isOpen={showSubmitPracticeModal}
              totalQuestions={filteredQuestions.length}
              answeredQuestions={Object.keys(userAnswers).length}
              markedForReview={Object.values(markedForReview).filter(Boolean).length}
              isSubmitting={isSubmittingQuiz}
              errorMessage={submitQuizError}
              onClose={() => {
                setSubmitQuizError(null)
                setShowSubmitPracticeModal(false)
              }}
              onConfirmSubmit={() => void handleFinishQuiz()}
            />
          </div>
        )}

        {/* Back Link to General Studies */}
        {currentView !== 'test' && (
          <div className="practice-footer-nav">
            <Link
              to={
                selectedGroup === 'group2_2a'
                  ? `/materials/group2/${urlSubjectId}`
                  : selectedGroup === 'group4_vao'
                    ? `/materials/group4/${urlSubjectId}`
                    : '/materials/group1/general-studies'
              }
              className="back-btn glass"
            >
              <BookOpen size={16} />
              <span>
                Back to{' '}
                {selectedGroup === 'group2' || selectedGroup === 'group2a' || selectedGroup === 'group2_2a'
                  ? 'TNPSC Group 2 & 2A Study Materials'
                  : selectedGroup === 'group4' || selectedGroup === 'vao' || selectedGroup === 'group4_vao'
                    ? 'TNPSC Group 4 Study Materials'
                    : 'Group 1 General Studies'}
              </span>
            </Link>
          </div>
        )}
      </div>

      {celebrationState && (
        <AwardCelebrationModal
          isOpen={Boolean(celebrationState)}
          onClose={() => setCelebrationState(null)}
          awardType={celebrationState.awardType}
          percentage={celebrationState.percentage}
          title={celebrationState.title}
        />
      )}
      {historyModalLesson && effectiveSubjectId && effectiveClassId && activeUnitFilter && (
        <AttemptHistoryModal
          isOpen={Boolean(historyModalLesson)}
          onClose={() => setHistoryModalLesson(null)}
          groupId={normalizedGroup}
          subjectId={effectiveSubjectId}
          standardId={effectiveClassId}
          unitId={activeUnitFilter}
          lessonId={historyModalLesson.lessonId}
          lessonTitle={historyModalLesson.lessonTitle}
          mode="mcq_practice"
        />
      )}
    </div>
  )
}

export default MCQPractice
