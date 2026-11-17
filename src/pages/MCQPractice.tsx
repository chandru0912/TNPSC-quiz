import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Timer,
  Layers,
  Sparkles,
  Filter,
  X,
  BookOpen,
  Award,
  Trophy,
  BarChart2,
  ChevronRight,
  GraduationCap,
  Play,
  Languages,
} from 'lucide-react'
import { apiFetch } from '../utils/api'
import { notifyStudentSync } from '../utils/studentSync'
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker'
import { useMcqTranslations } from '../hooks/useMcqTranslations'
import {
  getSubjectsForGroup,
  getStandardsForSubject,
  getUnitsForSubjectStandard,
  getLessonsForSelection,
} from '../data/unifiedSyllabusRegistry'
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
  const navigate = useNavigate()
  const routeParams = useParams<{
    groupId?: string
    subjectId?: string
    standardId?: string
    unitId?: string
    lessonId?: string
  }>()
  const [searchParams] = useSearchParams()
  const quizStartTimeRef = useRef<number>(Date.now())
  const submissionTokenRef = useRef<string>(`mcq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`)

  const urlGroup = routeParams.groupId || searchParams.get('group')
  const urlSubjectId = routeParams.subjectId || searchParams.get('subjectId')
  const rawStandardParam = routeParams.standardId || searchParams.get('classId')
  const urlClassId = rawStandardParam && /^\d+$/.test(rawStandardParam) ? parseInt(rawStandardParam, 10) : null
  const rawUnitParam = routeParams.unitId || searchParams.get('unitId')
  const urlUnitId = rawUnitParam && /^\d+$/.test(rawUnitParam) ? parseInt(rawUnitParam, 10) : null
  const urlUnitTitle = searchParams.get('unitTitle')
  const urlLesson = searchParams.get('lesson')
  const urlLessonId = routeParams.lessonId ? decodeURIComponent(routeParams.lessonId) : searchParams.get('lessonId')
  const urlTopic = searchParams.get('topic')
  const isTestActive = Boolean(urlLessonId || urlLesson || searchParams.get('title'))

  const [selectedGroup, setSelectedGroup] = useState<string>(
    urlGroup || 'group1'
  )
  const [activeUnitFilter, setActiveUnitFilter] = useState<number | null>(urlUnitId)

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
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [answeredQuestions, setAnsweredQuestions] = useState(0)
  const [isQuizCompleted, setIsQuizCompleted] = useState(false)
  const [isReviewMode, setIsReviewMode] = useState(false)
  const [userAnswers, setUserAnswers] = useState<Record<number, { selected: number; isCorrect: boolean }>>({})
  const [questionLang, setQuestionLang] = useState<'en' | 'ta'>('en')

  // Live Database Questions & Connection State
  const [dbQuestions, setDbQuestions] = useState<QuestionItem[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true)
  const [isUsingLiveBank, setIsUsingLiveBank] = useState<boolean>(false)
  const [activeFilterNotice, setActiveFilterNotice] = useState<string | null>(null)
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
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
    setAnsweredQuestions(0)
    setIsQuizCompleted(false)
    setIsReviewMode(false)
    setUserAnswers({})
  }, [urlGroup, urlUnitId, urlClassId, urlLesson, urlLessonId, urlTopic])

  // Fetch live syllabus facets (Group -> Subject -> Standard -> Unit -> Lesson) across Study Materials + Main Practice
  useEffect(() => {
    let isMounted = true
    const fetchFacets = async () => {
      try {
        const params = new URLSearchParams()
        if (selectedGroup) params.set('category', selectedGroup)
        if (urlSubjectId && urlSubjectId !== 'all') {
          params.set('subject', urlSubjectId)
        }
        if (urlClassId) params.set('classId', urlClassId.toString())
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
  }, [selectedGroup, urlSubjectId, urlClassId, activeUnitFilter])

  // Fetch directly from PostgreSQL Questions API ONLY when a specific Lesson (or Mock Test) is selected
  useEffect(() => {
    let isMounted = true
    if (!isTestActive) {
      setDbQuestions([])
      setIsUsingLiveBank(false)
      setActiveFilterNotice(null)
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
        let notice: string | null = null

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
              notice = `Found ${questions.length} questions for "${urlLesson || 'this lesson'}" across standards`
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
              notice = `Displaying ${questions.length} questions for Unit ${activeUnitFilter}.`
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
            setIsUsingLiveBank(true)
            setActiveFilterNotice(notice)
          } else {
            setDbQuestions([])
            setIsUsingLiveBank(false)
            setActiveFilterNotice(null)
          }
        }
      } catch (err) {
        console.error('Failed to fetch questions:', err)
        if (isMounted) {
          setDbQuestions([])
          setIsUsingLiveBank(false)
          setActiveFilterNotice(null)
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
  }, [isTestActive, selectedGroup, activeUnitFilter, urlClassId, urlLesson, urlLessonId, urlTopic, urlSubjectId])

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

  const hierarchyStandards = urlSubjectId
    ? getStandardsForSubject(normalizedGroup, urlSubjectId).map((st) => {
        const matched = syllabusFacets.standards.find((f) => Number(f.classId) === st.id)
        return {
          ...st,
          questionCount: matched ? matched.questionCount : 0,
        }
      })
    : []

  const hierarchyUnits =
    urlSubjectId && urlClassId
      ? getUnitsForSubjectStandard(normalizedGroup, urlSubjectId, urlClassId).map((u) => {
          const matched = syllabusFacets.units.find((f) => Number(f.unitId) === u.id)
          return {
            ...u,
            questionCount: matched ? matched.questionCount : 0,
          }
        })
      : []

  const hierarchyLessons =
    urlSubjectId && urlClassId && activeUnitFilter
      ? getLessonsForSelection(normalizedGroup, urlSubjectId, urlClassId, activeUnitFilter).map((l) => {
          const normTitle = l.title.trim().toLowerCase()
          const matched = syllabusFacets.lessons.find(
            (f) =>
              (f.lessonId && f.lessonId === l.id) ||
              f.lessonTitle.trim().toLowerCase() === normTitle
          )
          return {
            ...l,
            matchedLessonId: matched?.lessonId || l.id,
            questionCount: matched ? matched.questionCount : 0,
          }
        })
      : []

  const activeSubjectObj = hierarchySubjects.find((s) => s.id === urlSubjectId) || null
  const activeStandardObj = urlClassId ? hierarchyStandards.find((st) => st.id === urlClassId) || null : null
  const activeUnitObj = hierarchyUnits.find((u) => u.id === activeUnitFilter) || null

  const validGroupIds = new Set(['group1', 'group2', 'group2a', 'group2_2a', 'group4', 'vao', 'group4_vao'])
  const hasInvalidRoute =
    (routeParams.groupId && !validGroupIds.has(routeParams.groupId.toLowerCase())) ||
    (urlSubjectId && !activeSubjectObj) ||
    (rawStandardParam && !activeStandardObj) ||
    (rawUnitParam && !activeUnitObj)

  const currentView: 'invalid' | 'test' | 'lessons' | 'units' | 'standards' | 'subjects' = hasInvalidRoute
    ? 'invalid'
    : isTestActive
      ? 'test'
      : activeUnitFilter && urlClassId && urlSubjectId
        ? 'lessons'
        : urlClassId && urlSubjectId
          ? 'units'
          : urlSubjectId
            ? 'standards'
            : 'subjects'

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
    translatedCount,
    translationStatus,
    retry: retryTranslations,
  } = useMcqTranslations(filteredQuestions, questionLang, activeQuestionIndex)

  const activeTranslation =
    questionLang === 'ta' && questionItem ? translations[Number(questionItem.id)] : undefined
  const displayedQuestion = activeTranslation?.question || questionItem?.question || ''
  const displayedOptions = activeTranslation?.options || questionItem?.options || []

  const resetQuizState = () => {
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
    setAnsweredQuestions(0)
    setIsQuizCompleted(false)
    setIsReviewMode(false)
    setUserAnswers({})
  }

  const handleGroupSelect = (group: string) => {
    const norm =
      group === 'group2' || group === 'group2a' || group === 'group2_2a'
        ? 'group2'
        : group === 'group4' || group === 'vao' || group === 'group4_vao'
          ? 'group4'
          : 'group1'
    setSelectedGroup(norm)
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
    navigate(`/practice/${normalizedGroup}/${encodeURIComponent(nextSubject)}/${nextClass}/${nextUnit}/${lessonSegment}/test${query}`)
  }

  const clearUnitFilter = () => {
    setActiveUnitFilter(null)
    resetQuizState()
    navigate(`/practice/${normalizedGroup}`)
  }

  const handleAnswerSelect = (index: number) => {
    if (showResult || isReviewMode) return
    setSelectedAnswer(index)
  }

  const handleSubmit = () => {
    if (selectedAnswer === null || !questionItem) return
    const isCorrect = selectedAnswer === questionItem.correctAnswer
    setShowResult(true)
    setAnsweredQuestions((prev) => prev + 1)
    if (isCorrect) {
      setScore((prev) => prev + 1)
    }
    setUserAnswers((prev) => ({
      ...prev,
      [activeQuestionIndex]: { selected: selectedAnswer, isCorrect },
    }))

    // Real-Time Student Activity Tracking in PostgreSQL
    const studentToken = localStorage.getItem('tnpsc_student_token')
    if (studentToken) {
      apiFetch('/api/student/question-attempt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          questionId: typeof rawQuestion?.id === 'number' ? rawQuestion.id : null,
          category: selectedGroup,
          subject: rawQuestion?.subject || urlSubjectId || 'General Studies',
          classId: rawQuestion?.classId || urlClassId,
          unitId: rawQuestion?.unitId || urlUnitId,
          lessonId: rawQuestion?.lessonId || urlLessonId,
          lessonTitle: rawQuestion?.lessonTitle || urlLesson || 'General Practice',
          topic: rawQuestion?.topic || urlTopic,
          selectedOption: selectedAnswer,
          correctAnswer: questionItem.correctAnswer,
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
  }

  const handleNext = () => {
    if (activeQuestionIndex < filteredQuestions.length - 1) {
      const nextIndex = activeQuestionIndex + 1
      setCurrentQuestion(nextIndex)
      const prevAnswer = userAnswers[nextIndex]
      if (prevAnswer !== undefined) {
        setSelectedAnswer(prevAnswer.selected)
        setShowResult(true)
      } else {
        setSelectedAnswer(null)
        setShowResult(false)
      }
    }
  }

  const handlePrev = () => {
    if (activeQuestionIndex > 0) {
      const prevIndex = activeQuestionIndex - 1
      setCurrentQuestion(prevIndex)
      const prevAnswer = userAnswers[prevIndex]
      if (prevAnswer !== undefined) {
        setSelectedAnswer(prevAnswer.selected)
        setShowResult(true)
      } else {
        setSelectedAnswer(null)
        setShowResult(false)
      }
    }
  }

  const handleFinishQuiz = () => {
    setIsQuizCompleted(true)
    setIsReviewMode(false)

    // Record completed Mock Test, Lesson Quiz, or Subject Drill to PostgreSQL
    const studentToken = localStorage.getItem('tnpsc_student_token')
    if (studentToken && answeredQuestions > 0) {
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
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - quizStartTimeRef.current) / 1000))
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

      apiFetch('/api/student/assessments/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          testTitle,
          category: selectedGroup,
          assessmentType,
          submissionToken: submissionTokenRef.current,
          totalQuestions: totalQ,
          attemptedQuestions: answeredQuestions,
          correctAnswers: score,
          incorrectAnswers: Math.max(0, answeredQuestions - score),
          unansweredQuestions: Math.max(0, totalQ - answeredQuestions),
          score: score * 1.5,
          maxScore: totalQ * 1.5,
          timeSpentSeconds: elapsedSeconds,
          responses,
        }),
      })
        .then((res) => {
          if (res.ok) notifyStudentSync()
        })
        .catch((err) => console.warn('[StudentTrack] Failed to log assessment completion:', err))
    }
  }

  const handleStartReview = () => {
    setIsReviewMode(true)
    setCurrentQuestion(0)
    setShowResult(true)
    setSelectedAnswer(userAnswers[0]?.selected ?? null)
  }

  const handleBackToScorecard = () => {
    setIsReviewMode(false)
  }

  const handleReset = () => {
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
    setAnsweredQuestions(0)
    setIsQuizCompleted(false)
    setIsReviewMode(false)
    setUserAnswers({})
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
    <div className="practice">
      <div className="practice-container">
        {/* Top Navigation Bar with Back buttons */}
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

        <motion.div
          className="practice-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="practice-badge-row">
            <span className="practice-badge">
              <Sparkles size={14} />
              <span>Interactive Examination Engine</span>
            </span>
            {isUsingLiveBank ? (
              <span className="practice-code-badge live-connected">
                <span className="live-dot">●</span>
                <span>
                  {`Live Database Connected (${filteredQuestions.length} Questions)`}
                </span>
              </span>
            ) : (
              <span className="practice-code-badge">TNPSC Quizzes</span>
            )}
          </div>

          <h1 className="practice-title">
            <FileText size={32} />
            <span>
              MCQ <span className="gradient-text">Practice &amp; Quizzes</span>
            </span>
          </h1>
          <p className="practice-subtitle">
            Curated Samacheer Kalvi topic-wise questions organized by TNPSC Group 1, TNPSC Group 2 &amp; 2A, and TNPSC Group 4
          </p>
        </motion.div>

        {/* Active Filter HUD Banner when redirected from a Lesson, Unit, or Class */}
        {(activeUnitFilter || urlClassId || urlLesson) && (
          <motion.div
            className="filter-notice-hud glass"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="filter-notice-left">
              <Filter size={18} className="filter-icon" />
              <div>
                <span className="filter-title">
                  Filtered Practice: {urlClassId ? `${urlClassId}th Standard • ` : ''}Unit {activeUnitFilter}
                  {urlUnitTitle ? ` — ${decodeURIComponent(urlUnitTitle)}` : ''}
                </span>
                {urlLesson && (
                  <span className="filter-lesson-text">
                    Lesson Focus: <strong>{decodeURIComponent(urlLesson)}</strong>
                  </span>
                )}
                {activeFilterNotice && (
                  <span style={{ display: 'block', fontSize: '0.78rem', color: '#38bdf8', marginTop: '0.2rem' }}>
                    ℹ️ {activeFilterNotice}
                  </span>
                )}
              </div>
            </div>

            <button className="filter-clear-btn" onClick={clearUnitFilter} title="View all questions">
              <X size={14} />
              <span>Show All Questions</span>
            </button>
          </motion.div>
        )}

        {/* Exam Category Tabs */}
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

        {/* Interactive Syllabus Breadcrumb */}
        <nav className="practice-breadcrumb glass" aria-label="Syllabus navigation breadcrumb">
          <button
            type="button"
            className={`breadcrumb-crumb ${!urlSubjectId ? 'current' : ''}`}
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
                className={`breadcrumb-crumb ${!urlClassId ? 'current' : ''}`}
                onClick={() =>
                  updateSyllabusFilter({
                    subjectId: activeSubjectObj.id,
                    classId: null,
                    unitId: null,
                    lessonId: null,
                    lesson: null,
                  })
                }
              >
                {activeSubjectObj.name}
              </button>
            </>
          )}

          {urlClassId && (
            <>
              <ChevronRight size={14} className="breadcrumb-sep" />
              <button
                type="button"
                className={`breadcrumb-crumb ${!activeUnitFilter ? 'current' : ''}`}
                onClick={() =>
                  updateSyllabusFilter({
                    classId: urlClassId,
                    unitId: null,
                    lessonId: null,
                    lesson: null,
                  })
                }
              >
                {`${urlClassId}th Standard`}
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

        {/* PAGE 1: TNPSC Group & Subject Selection */}
        {currentView === 'subjects' && (
          <div className="hierarchy-navigator">
            <section className="hierarchy-section glass">
              <div className="hierarchy-section-header">
                <span className="hierarchy-step-badge">Step 2</span>
                <h3>Select Subject</h3>
              </div>
              <div className="hierarchy-card-grid subject-card-grid">
                {hierarchySubjects.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    className="hierarchy-card"
                    onClick={() =>
                      updateSyllabusFilter({
                        subjectId: sub.id,
                        classId: null,
                        unitId: null,
                        lessonId: null,
                        lesson: null,
                      })
                    }
                  >
                    <div className="hierarchy-card-top">
                      <BookOpen size={18} className="hierarchy-card-icon" />
                      <span className={`hierarchy-count-pill ${sub.questionCount > 0 ? 'has-qs' : ''}`}>
                        {sub.questionCount} Questions
                      </span>
                    </div>
                    <span className="hierarchy-card-title">{sub.name}</span>
                    <div className="hierarchy-card-cta">
                      <span>Select Subject</span>
                      <ChevronRight size={14} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* PAGE 2: Standard Selection Page (Exact Samacheer Kalvi 6th-12th Card Design) */}
        {currentView === 'standards' && (
          <div className="hierarchy-navigator">
            <div className="page-step-back-row">
              <button
                type="button"
                className="back-btn glass"
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
                <ArrowLeft size={16} />
                <span>Back to Subjects</span>
              </button>
            </div>

            <section className="classes-top-section glass">
              <div className="classes-section-header">
                <div className="classes-heading-group">
                  <div className="classes-title-badge">
                    <GraduationCap size={18} />
                    <span>Samacheer Kalvi School Textbook Mapping</span>
                  </div>
                  <h2 className="classes-main-heading">
                    {activeSubjectObj?.name} — Classes: {hierarchyStandards[0]?.id}th to {hierarchyStandards[hierarchyStandards.length - 1]?.id}th Standard
                  </h2>
                  <p className="classes-subheading">
                    Select any standard below to explore its mapped syllabus units and practice MCQs.
                  </p>
                </div>
                <span className="classes-count-badge">{hierarchyStandards.length} Standards</span>
              </div>

              <div className="class-cards-grid">
                {hierarchyStandards.map((cls, idx) => {
                  const unitsForStd = urlSubjectId
                    ? getUnitsForSubjectStandard(normalizedGroup, urlSubjectId, cls.id)
                    : []
                  return (
                    <motion.div
                      key={cls.id}
                      className="class-card glass"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.04 }}
                      whileHover={{ scale: 1.03, y: -4 }}
                      onClick={() =>
                        updateSyllabusFilter({
                          classId: cls.id,
                          unitId: null,
                          lessonId: null,
                          lesson: null,
                        })
                      }
                    >
                      <div className="class-card-top">
                        <span className="class-num-badge">{cls.id}th</span>
                        <span className="class-badge-samacheer">Samacheer Kalvi</span>
                      </div>

                      <div className="class-card-main">
                        <div className="class-icon-circle">
                          <GraduationCap size={22} />
                        </div>
                        <h3 className="class-card-title">{cls.label}</h3>
                        <p className="class-card-desc">
                          {unitsForStd.length} {unitsForStd.length === 1 ? 'Unit' : 'Units'} • {cls.questionCount} Questions
                        </p>
                      </div>

                      <div className="class-card-cta">
                        <span>Explore Class</span>
                        <ChevronRight size={14} />
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        {/* PAGE 3: Unit Selection Page */}
        {currentView === 'units' && (
          <div className="hierarchy-navigator">
            <div className="page-step-back-row">
              <button
                type="button"
                className="back-btn glass"
                onClick={() =>
                  updateSyllabusFilter({
                    classId: null,
                    unitId: null,
                    lessonId: null,
                    lesson: null,
                  })
                }
              >
                <ArrowLeft size={16} />
                <span>Back to Standards</span>
              </button>
            </div>

            <section className="hierarchy-section glass">
              <div className="hierarchy-section-header">
                <span className="hierarchy-step-badge">{urlClassId}th Standard</span>
                <h3>{activeSubjectObj?.name} — Select Unit</h3>
              </div>
              <div className="hierarchy-card-grid">
                {hierarchyUnits.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="hierarchy-card"
                    onClick={() =>
                      updateSyllabusFilter({
                        unitId: u.id,
                        lessonId: null,
                        lesson: null,
                      })
                    }
                  >
                    <div className="hierarchy-card-top">
                      <span className="hierarchy-unit-num">{u.unitNumber}</span>
                      <span className={`hierarchy-count-pill ${u.questionCount > 0 ? 'has-qs' : ''}`}>
                        {u.questionCount} Questions
                      </span>
                    </div>
                    <span className="hierarchy-card-title">{u.title}</span>
                    <div className="hierarchy-card-cta">
                      <span>Explore Unit</span>
                      <ChevronRight size={14} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
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
              {hierarchyLessons.length > 0 ? (
                <div className="hierarchy-lesson-list">
                  {hierarchyLessons.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className="hierarchy-lesson-row"
                      onClick={() =>
                        updateSyllabusFilter({
                          lessonId: l.matchedLessonId,
                          lesson: l.title,
                        })
                      }
                    >
                      <div className="hierarchy-lesson-info">
                        <span className="hierarchy-lesson-num">
                          Lesson {l.lessonNumber}
                        </span>
                        <span className="hierarchy-lesson-title">{l.title}</span>
                      </div>
                      <div className="hierarchy-lesson-meta">
                        <span className={`hierarchy-count-pill ${l.questionCount > 0 ? 'has-qs' : ''}`}>
                          {l.questionCount} Questions
                        </span>
                        <span className="hierarchy-start-pill">
                          <Play size={13} />
                          <span>Start Practice</span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="hierarchy-empty-note">
                  No lessons configured for this Standard and Unit in Study Materials.
                </p>
              )}
            </section>
          </div>
        )}

        {/* PAGE 5: MCQ Examination Page (Shown ONLY after selecting a Lesson) */}
        {currentView === 'test' && (
        <>
        <div className="page-step-back-row page-step-test-bar">
          <button
            type="button"
            className="back-btn glass"
            onClick={() =>
              updateSyllabusFilter({
                lessonId: null,
                lesson: null,
              })
            }
          >
            <ArrowLeft size={16} />
            <span>Back to Lessons</span>
          </button>

          {filteredQuestions.length > 0 && (
            <div className="mcq-lang-toolbar">
              {questionLang === 'ta' && (
                <div className={`mcq-translation-status status-${translationStatus}`}>
                  {translationStatus === 'completed' ? (
                    <span>{`✓ ${translatedCount}/${filteredQuestions.length} Ready`}</span>
                  ) : translationStatus === 'processing' ? (
                    <span>{`${translatedCount}/${filteredQuestions.length} Translated • ${filteredQuestions.length - translatedCount} Remaining`}</span>
                  ) : failedTranslationIds.length > 0 ? (
                    <>
                      <span>{`${translatedCount}/${filteredQuestions.length} Translated • ${failedTranslationIds.length} Failed`}</span>
                      <button
                        type="button"
                        className="mcq-retry-btn"
                        onClick={retryTranslations}
                      >
                        Retry
                      </button>
                    </>
                  ) : (
                    <span>{`${translatedCount}/${filteredQuestions.length} Pending`}</span>
                  )}
                </div>
              )}

              <div className="mcq-lang-switch glass" role="group" aria-label="Question language">
                <Languages size={15} className="mcq-lang-icon" />
                <button
                  type="button"
                  className={`mcq-lang-btn ${questionLang === 'en' ? 'active' : ''}`}
                  onClick={() => setQuestionLang('en')}
                >
                  English
                </button>
                <button
                  type="button"
                  className={`mcq-lang-btn ${questionLang === 'ta' ? 'active' : ''}`}
                  onClick={() => setQuestionLang('ta')}
                >
                  {isTranslating && questionLang === 'ta' ? 'தமிழ்…' : 'தமிழ்'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="practice-stats">
          <div className="practice-stat-card glass">
            <Timer size={18} />
            <span>
              {`Question ${filteredQuestions.length > 0 ? activeQuestionIndex + 1 : 0} of ${filteredQuestions.length}`}
            </span>
          </div>
          <div className="practice-stat-card glass">
            <CheckCircle2 size={18} />
            <span>
              {`Answered: ${answeredQuestions} • Unanswered: ${Math.max(0, filteredQuestions.length - answeredQuestions)}`}
            </span>
          </div>
          <div className="practice-stat-card glass">
            <Award size={18} />
            <span>
              {`Score: ${score} / ${answeredQuestions}`}
            </span>
          </div>
          <div className="practice-stat-card glass">
            <Layers size={18} />
            <span>
              {normalizedGroup === 'group2'
                ? 'TNPSC Group 2 & 2A'
                : normalizedGroup === 'group4'
                ? 'TNPSC Group 4'
                : 'TNPSC Group 1'}
            </span>
          </div>
        </div>

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
                <span>Assessment Completed</span>
              </span>
              <h2 className="completion-title">Quiz Completed!</h2>
              <p className="completion-subtitle">
                {selectedGroup === 'group2_2a'
                  ? 'TNPSC Group 2 & 2A'
                  : selectedGroup === 'group4' || selectedGroup === 'vao' || selectedGroup === 'group4_vao'
                  ? 'TNPSC Group 4 & VAO'
                  : 'TNPSC Group 1'}
                {activeUnitFilter ? ` • Unit ${activeUnitFilter}` : ''}
                {urlLesson ? ` • ${decodeURIComponent(urlLesson)}` : ''}
              </p>
            </div>

            {/* Score Ring Display */}
            <div className="completion-score-box">
              <div className="score-ring">
                <span className="score-numbers">
                  {score} <span className="score-total">/ {filteredQuestions.length}</span>
                </span>
                <span className="score-percentage-pill">
                  {Math.round((score / Math.max(1, filteredQuestions.length)) * 100)}% Accuracy
                </span>
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
                    📖 Keep Practicing! Read the syllabus study notes and re-attempt.
                  </span>
                )}
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
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

            {/* Primary Action Buttons */}
            <div className="completion-actions">
              <button className="btn btn-secondary review-answers-btn" onClick={handleStartReview}>
                <FileText size={18} />
                <span>Review All Answers</span>
              </button>
              <button className="btn btn-primary retake-btn" onClick={handleReset}>
                <RotateCcw size={18} />
                <span>Retake Test</span>
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
          <AnimatePresence mode="wait">
            <motion.div
              key={`question-${questionItem.id}`}
              className="question-card glass"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
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

              <div className="question-header">
                <span className="question-category-tag">{formatTag(questionItem)}</span>
                <span className="question-number">
                  {`Question ${activeQuestionIndex + 1} of ${filteredQuestions.length}`}
                </span>
              </div>

              {/* Examination Progress Bar */}
              <div className="exam-progress-wrap">
                <div className="exam-progress-meta">
                  <span>Progress: {answeredQuestions} of {filteredQuestions.length} Answered</span>
                  <span>{Math.round((answeredQuestions / Math.max(1, filteredQuestions.length)) * 100)}%</span>
                </div>
                <div className="exam-progress-track">
                  <div
                    className="exam-progress-fill"
                    style={{ width: `${Math.round(((activeQuestionIndex + 1) / Math.max(1, filteredQuestions.length)) * 100)}%` }}
                  />
                </div>
              </div>

              <h2 className="question-text">{displayedQuestion}</h2>

              <div className="options-list">
                {displayedOptions.map((option, index) => {
                  let optionClass = 'option'
                  if (showResult) {
                    if (index === questionItem.correctAnswer) {
                      optionClass += ' option-correct'
                    } else if (index === selectedAnswer && index !== questionItem.correctAnswer) {
                      optionClass += ' option-wrong'
                    } else {
                      optionClass += ' option-disabled'
                    }
                  } else if (selectedAnswer === index) {
                    optionClass += ' option-selected'
                  }

                  return (
                    <button
                      key={index}
                      className={optionClass}
                      onClick={() => handleAnswerSelect(index)}
                      disabled={showResult}
                    >
                      <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                      <span className="option-text">{option}</span>
                      {showResult && index === questionItem.correctAnswer && (
                        <CheckCircle2 size={20} className="option-icon option-icon-correct" />
                      )}
                      {showResult && index === selectedAnswer && index !== questionItem.correctAnswer && (
                        <XCircle size={20} className="option-icon option-icon-wrong" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Action Buttons */}
              <div className="question-actions">
                <div className="action-group-left">
                  {activeQuestionIndex > 0 && (
                    <button type="button" className="btn btn-secondary prev-btn" onClick={handlePrev}>
                      <ArrowLeft size={18} />
                      <span>Previous</span>
                    </button>
                  )}
                </div>

                <div className="action-group-right">
                  {!showResult && (
                    <button
                      className="btn btn-primary submit-btn"
                      onClick={handleSubmit}
                      disabled={selectedAnswer === null}
                    >
                      <span>Check Answer</span>
                      <ArrowRight size={18} />
                    </button>
                  )}
                  {!isLastQuestion && (
                    <button type="button" className="btn btn-secondary next-btn" onClick={handleNext}>
                      <span>Next</span>
                      <ArrowRight size={18} />
                    </button>
                  )}
                  {(isLastQuestion || answeredQuestions > 0) && (
                    <button type="button" className="btn btn-primary complete-btn" onClick={handleFinishQuiz}>
                      <Award size={18} />
                      <span>Submit Test</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Concise Examination Answer Feedback (No Study Notes or Textbook Explanations) */}
              {showResult && (
                <motion.div
                  className={`explanation-box ${
                    selectedAnswer === questionItem.correctAnswer ? 'explanation-correct' : 'explanation-wrong'
                  }`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="explanation-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span className="explanation-status">
                        {selectedAnswer === questionItem.correctAnswer ? 'Correct!' : 'Incorrect'}
                      </span>
                      <span className="correct-answer-label">
                        {`Correct Answer: Option ${String.fromCharCode(65 + questionItem.correctAnswer)}`}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
              {/* Question Navigation Palette */}
              {filteredQuestions.length > 1 && (
                <div className="question-nav-palette">
                  <div className="question-nav-palette-header">
                    <span>Question Navigation</span>
                    <span>
                      {answeredQuestions} / {filteredQuestions.length} Answered
                    </span>
                  </div>
                  <div className="question-nav-grid">
                    {filteredQuestions.map((fq, idx) => {
                      const ans = userAnswers[idx]
                      let navClass = 'question-nav-dot'
                      if (idx === activeQuestionIndex) navClass += ' current'
                      if (ans) navClass += ans.isCorrect ? ' answered-correct' : ' answered-wrong'
                      return (
                        <button
                          key={fq.id}
                          type="button"
                          className={navClass}
                          onClick={() => {
                            setCurrentQuestion(idx)
                            if (ans !== undefined) {
                              setSelectedAnswer(ans.selected)
                              setShowResult(true)
                            } else {
                              setSelectedAnswer(null)
                              setShowResult(false)
                            }
                          }}
                          aria-label={`Go to question ${idx + 1}`}
                        >
                          {idx + 1}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
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
        </>
        )}

        {/* Back Link to General Studies */}
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
      </div>
    </div>
  )
}

export default MCQPractice
