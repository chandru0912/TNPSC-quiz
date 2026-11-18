import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap,
  Clock,
  FileText,
  Users,
  Play,
  Award,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Send,
  BookOpen,
  Layers,
  Target,
  Sparkles,
} from 'lucide-react'
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker'
import { apiFetch } from '../utils/api'
import { notifyStudentSync, subscribeStudentSync } from '../utils/studentSync'
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
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const matchesGroup = (test: PublishedMockTest, selectedGroup: TnpscGroupTab): boolean => {
  const grp = `${test.category || ''} ${test.tnpscGroup || ''}`.toLowerCase()
  if (selectedGroup === 'group1') return grp.includes('group1') || grp.includes('group 1')
  if (selectedGroup === 'group2_2a') return grp.includes('group2') || grp.includes('group 2')
  if (selectedGroup === 'group4') return grp.includes('group4') || grp.includes('group 4') || grp.includes('vao')
  return false
}

const MockTests = () => {
  useStudyTimeTracker()
  const navigate = useNavigate()

  const [selectedGroup, setSelectedGroup] = useState<TnpscGroupTab>('group1')
  const [selectedTestCategory, setSelectedTestCategory] = useState<TestCategoryTab>('full_length')

  // Sub-filters for Lesson-wise & Unit-wise tests
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedStandard, setSelectedStandard] = useState<string>('all')
  const [selectedUnit, setSelectedUnit] = useState<string>('all')
  const [selectedLesson, setSelectedLesson] = useState<string>('all')

  const [tests, setTests] = useState<PublishedMockTest[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Active Exam Runner State
  const [activeTest, setActiveTest] = useState<PublishedMockTest | null>(null)
  const [sessionId, setSessionId] = useState<number>(0)
  const [questions, setQuestions] = useState<LiveExamQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [examResult, setExamResult] = useState<ExamResultData | null>(null)
  const [showReview, setShowReview] = useState(false)
  const startTimestampRef = useRef<number>(Date.now())
  const submissionTokenRef = useRef<string>('')

  const groups: { id: TnpscGroupTab; name: string }[] = [
    { id: 'group1', name: 'TNPSC Group 1' },
    { id: 'group2_2a', name: 'TNPSC Group 2 & 2A' },
    { id: 'group4', name: 'TNPSC Group 4 & VAO' },
  ]

  const testCategories: { id: TestCategoryTab; name: string; desc: string }[] = [
    { id: 'lesson_wise', name: 'Lesson-wise Tests', desc: 'Targeted tests per lesson & standard' },
    { id: 'unit_wise', name: 'Unit-wise Tests', desc: 'Unit-level syllabus assessments' },
    { id: 'full_length', name: 'Full-length Mock Tests', desc: 'Complete exam-pattern timed mocks' },
  ]

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
    setSelectedSubject('all')
    setSelectedStandard('all')
    setSelectedUnit('all')
    setSelectedLesson('all')
  }, [selectedGroup, selectedTestCategory])

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

  // Group + Category strict filter
  const groupCategoryTests = useMemo(() => {
    return tests.filter(
      (test) => matchesGroup(test, selectedGroup) && (test.testCategory || 'full_length') === selectedTestCategory
    )
  }, [tests, selectedGroup, selectedTestCategory])

  // Dynamic filter options derived from published tests in the selected Group + Category
  const subjectOptions = useMemo(() => {
    return Array.from(new Set(groupCategoryTests.map((t) => t.subject).filter(Boolean)))
  }, [groupCategoryTests])

  const standardOptions = useMemo(() => {
    return Array.from(new Set(groupCategoryTests.map((t) => t.standard).filter((v): v is string => Boolean(v))))
  }, [groupCategoryTests])

  const unitOptions = useMemo(() => {
    return Array.from(
      new Set(
        groupCategoryTests
          .filter((t) => selectedSubject === 'all' || t.subject === selectedSubject)
          .map((t) => t.unit)
          .filter((v): v is string => Boolean(v))
      )
    )
  }, [groupCategoryTests, selectedSubject])

  const lessonOptions = useMemo(() => {
    return Array.from(
      new Set(
        groupCategoryTests
          .filter(
            (t) =>
              (selectedSubject === 'all' || t.subject === selectedSubject) &&
              (selectedStandard === 'all' || t.standard === selectedStandard) &&
              (selectedUnit === 'all' || t.unit === selectedUnit)
          )
          .map((t) => t.lesson)
          .filter((v): v is string => Boolean(v))
      )
    )
  }, [groupCategoryTests, selectedSubject, selectedStandard, selectedUnit])

  const filteredTests = useMemo(() => {
    return groupCategoryTests.filter((test) => {
      if (selectedTestCategory === 'full_length') return true
      if (selectedSubject !== 'all' && test.subject !== selectedSubject) return false
      if (selectedTestCategory === 'lesson_wise') {
        if (selectedStandard !== 'all' && test.standard !== selectedStandard) return false
        if (selectedUnit !== 'all' && test.unit !== selectedUnit) return false
        if (selectedLesson !== 'all' && test.lesson !== selectedLesson) return false
      }
      if (selectedTestCategory === 'unit_wise') {
        if (selectedUnit !== 'all' && test.unit !== selectedUnit) return false
      }
      return true
    })
  }, [groupCategoryTests, selectedTestCategory, selectedSubject, selectedStandard, selectedUnit, selectedLesson])

  const handleStartTest = async (test: PublishedMockTest) => {
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
      setActiveTest({
        ...test,
        ...liveTest,
      })
      setSessionId(Number(session?.id || 0))
      setQuestions(liveQuestions || [])
      setAnswers(session?.answers || {})
      setCurrentIndex(Number(session?.currentQuestionIndex || 0))
      const remaining = session?.expiresAt
        ? Math.max(60, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000))
        : (liveTest?.durationMinutes || test.durationMinutes || 90) * 60
      setSecondsLeft(remaining)
      setExamResult(null)
      setShowReview(false)
      startTimestampRef.current = Date.now()
      submissionTokenRef.current = `mt-${test.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to start mock test.')
    }
  }

  const persistProgress = (nextAnswers: Record<string, number>, nextIndex: number) => {
    const studentToken = localStorage.getItem('tnpsc_student_token')
    if (!studentToken || !sessionId) return
    apiFetch(`/api/mock-tests/sessions/${sessionId}/progress`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ answers: nextAnswers, currentQuestionIndex: nextIndex }),
    }).catch(() => {})
  }

  const handleSelectOption = (questionId: number, optionIndex: number) => {
    const nextAnswers = { ...answers, [String(questionId)]: optionIndex }
    setAnswers(nextAnswers)
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
    if (!autoSubmit) {
      const answeredCount = Object.keys(answers).length
      const confirmText = `Submit "${activeTest.title}"?\nAnswered: ${answeredCount} / ${questions.length} questions.`
      if (!window.confirm(confirmText)) return
    }

    const studentToken = localStorage.getItem('tnpsc_student_token')
    if (!studentToken) return

    try {
      setSubmitting(true)
      const timeSpentSeconds = Math.max(1, Math.round((Date.now() - startTimestampRef.current) / 1000))
      const res = await apiFetch(`/api/mock-tests/${activeTest.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          sessionId,
          answers,
          timeSpentSeconds,
          submissionToken: submissionTokenRef.current,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.status !== 'success') {
        setErrorMsg(data.message || 'Failed to submit mock test.')
        return
      }
      setExamResult(data.data)
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
  }

  // ====================================================
  // 1. LIVE RESULT & SCORECARD VIEW
  // ====================================================
  if (activeTest && examResult) {
    return (
      <div className="mocktests">
        <div className="mocktests-container">
          <div className="mocktest-exam-shell">
            <div className="mocktest-exam-topbar glass">
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{examResult.testTitle} — Scorecard</h2>
                <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.88rem' }}>
                  {activeTest.tnpscGroup} • {activeTest.subject} • Time Spent: {formatCountdown(examResult.timeSpentSeconds)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="mocktest-btn"
                  style={{ padding: '0.6rem 1.2rem' }}
                  onClick={() => setShowReview((p) => !p)}
                >
                  <BookOpen size={16} />
                  <span>{showReview ? 'Hide Answer Key' : 'Review Answers'}</span>
                </button>
                <button type="button" className="mocktests-tab" onClick={handleExitExam}>
                  <ArrowLeft size={16} style={{ marginRight: '0.35rem' }} />
                  Back to Mock Tests
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
            </div>

            {showReview && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {examResult.responses.map((r, idx) => (
                  <div key={r.questionId} className="mocktest-question-panel glass">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <strong style={{ fontSize: '0.98rem' }}>
                        Q{idx + 1}. {r.questionText}
                      </strong>
                      {r.selectedOption === null ? (
                        <span style={{ color: '#94a3b8', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>Unanswered</span>
                      ) : r.isCorrect ? (
                        <span style={{ color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                          <CheckCircle2 size={15} /> Correct
                        </span>
                      ) : (
                        <span style={{ color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                          <XCircle size={15} /> Incorrect
                        </span>
                      )}
                    </div>
                    <div className="mocktest-options-list">
                      {(r.options || []).map((opt, oIdx) => {
                        const isCorrectOpt = oIdx === r.correctAnswer
                        const isChosen = oIdx === r.selectedOption
                        return (
                          <div
                            key={oIdx}
                            className={`mocktest-option-btn ${isCorrectOpt ? 'selected' : ''}`}
                            style={{
                              cursor: 'default',
                              borderColor: isCorrectOpt
                                ? '#10b981'
                                : isChosen && !isCorrectOpt
                                  ? '#ef4444'
                                  : undefined,
                            }}
                          >
                            <span>
                              {String.fromCharCode(65 + oIdx)}. {opt}
                              {isCorrectOpt ? ' ✓ (Correct Answer)' : isChosen ? ' (Your Answer)' : ''}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    {r.explanation && (
                      <div style={{ fontSize: '0.86rem', color: '#cbd5e1', background: 'rgba(15,23,42,0.45)', padding: '0.75rem', borderRadius: '10px' }}>
                        <strong>Explanation:</strong> {r.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ====================================================
  // 2. LIVE TIMED EXAMINATION VIEW
  // ====================================================
  if (activeTest && questions.length > 0) {
    const q = questions[currentIndex] || questions[0]
    const selectedOpt = answers[String(q.id)]
    const answeredCount = Object.keys(answers).length

    return (
      <div className="mocktests">
        <div className="mocktests-container">
          <div className="mocktest-exam-shell">
            <div className="mocktest-exam-topbar glass">
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{activeTest.title}</h2>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                  {activeTest.tnpscGroup} • {activeTest.subject} • +{activeTest.marksPerQuestion} / -{activeTest.negativeMarking} Marks
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span className={`mocktest-timer-pill ${secondsLeft < 300 ? 'warning' : ''}`}>
                  <Clock size={16} />
                  <span>{formatCountdown(secondsLeft)}</span>
                </span>
                <button
                  type="button"
                  className="mocktest-btn"
                  style={{ padding: '0.6rem 1.25rem' }}
                  disabled={submitting}
                  onClick={() => handleSubmitExam(false)}
                >
                  <Send size={15} />
                  <span>{submitting ? 'Submitting...' : 'Submit Test'}</span>
                </button>
              </div>
            </div>

            <div className="mocktest-exam-layout">
              <div className="mocktest-question-panel glass">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#94a3b8' }}>
                  <span>Question {currentIndex + 1} of {questions.length}</span>
                  <span>{q.subject}{q.topic ? ` • ${q.topic}` : ''}</span>
                </div>

                <div style={{ fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.55, color: '#f8fafc' }}>
                  {q.question}
                </div>

                <div className="mocktest-options-list">
                  {(q.options || []).map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`mocktest-option-btn ${selectedOpt === idx ? 'selected' : ''}`}
                      onClick={() => handleSelectOption(q.id, idx)}
                    >
                      <span style={{ fontWeight: 700 }}>{String.fromCharCode(65 + idx)}.</span>
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="mocktests-tab"
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    >
                      <ChevronLeft size={16} /> Previous
                    </button>
                    {selectedOpt !== undefined && (
                      <button
                        type="button"
                        className="mocktests-tab"
                        onClick={() => handleClearOption(q.id)}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="mocktest-btn"
                    style={{ padding: '0.6rem 1.25rem' }}
                    onClick={() => {
                      if (currentIndex < questions.length - 1) {
                        setCurrentIndex((i) => i + 1)
                      } else {
                        handleSubmitExam(false)
                      }
                    }}
                  >
                    <span>{currentIndex < questions.length - 1 ? 'Save & Next' : 'Finish & Submit'}</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="mocktest-palette-panel glass">
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Question Palette</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Answered: <strong style={{ color: '#34d399' }}>{answeredCount}</strong> / {questions.length}
                </div>
                <div className="mocktest-palette-grid">
                  {questions.map((item, idx) => {
                    const isAns = answers[String(item.id)] !== undefined
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`mocktest-palette-dot ${isAns ? 'answered' : ''} ${idx === currentIndex ? 'current' : ''}`}
                        onClick={() => setCurrentIndex(idx)}
                      >
                        {idx + 1}
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  className="mocktests-tab"
                  style={{ marginTop: '0.5rem' }}
                  onClick={() => {
                    if (window.confirm('Exit this mock test? Your in-progress answers are saved.')) {
                      handleExitExam()
                    }
                  }}
                >
                  Exit to Test List
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ====================================================
  // 3. PUBLISHED MOCK TESTS CATALOG (GROUP -> CATEGORY -> FILTERS)
  // ====================================================
  return (
    <div className="mocktests">
      <div className="mocktests-container">
        <motion.div
          className="mocktests-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mocktests-header-top">
            <h1 className="mocktests-title">
              <GraduationCap size={32} />
              <span>
                Mock <span className="gradient-text">Tests</span>
              </span>
            </h1>
          </div>
          <p className="mocktests-subtitle">
            Select your TNPSC Group and test format — Lesson-wise, Unit-wise, or Full-length timed mock exams
          </p>
        </motion.div>

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
              marginBottom: '1rem',
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: TNPSC Group Selection */}
        <div className="mocktests-categories glass" style={{ marginBottom: '0.85rem' }}>
          {groups.map((grp) => (
            <button
              key={grp.id}
              type="button"
              className={`mocktests-tab ${selectedGroup === grp.id ? 'active' : ''}`}
              onClick={() => setSelectedGroup(grp.id)}
            >
              {grp.name}
            </button>
          ))}
        </div>

        {/* Step 2: Test Category Selection (Lesson-wise / Unit-wise / Full-length) */}
        <div className="mocktests-categories glass" style={{ marginBottom: '1.15rem' }}>
          {testCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`mocktests-tab ${selectedTestCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedTestCategory(cat.id)}
              title={cat.desc}
            >
              {cat.id === 'lesson_wise' && <BookOpen size={15} style={{ marginRight: '0.4rem' }} />}
              {cat.id === 'unit_wise' && <Layers size={15} style={{ marginRight: '0.4rem' }} />}
              {cat.id === 'full_length' && <Target size={15} style={{ marginRight: '0.4rem' }} />}
              {cat.name}
            </button>
          ))}
        </div>

        {/* Step 3: Dynamic Sub-Filters for Lesson-wise & Unit-wise Tests */}
        {selectedTestCategory !== 'full_length' && groupCategoryTests.length > 0 && (
          <div
            className="glass"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              padding: '0.9rem 1.1rem',
              borderRadius: '14px',
              marginBottom: '1.25rem',
              alignItems: 'center',
            }}
          >
            {subjectOptions.length > 0 && (
              <select
                className="mocktests-tab"
                style={{ cursor: 'pointer', background: 'rgba(15, 23, 42, 0.7)' }}
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                <option value="all">All Subjects</option>
                {subjectOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}

            {selectedTestCategory === 'lesson_wise' && standardOptions.length > 0 && (
              <select
                className="mocktests-tab"
                style={{ cursor: 'pointer', background: 'rgba(15, 23, 42, 0.7)' }}
                value={selectedStandard}
                onChange={(e) => setSelectedStandard(e.target.value)}
              >
                <option value="all">All Standards</option>
                {standardOptions.map((std) => (
                  <option key={std} value={std}>{std}</option>
                ))}
              </select>
            )}

            {unitOptions.length > 0 && (
              <select
                className="mocktests-tab"
                style={{ cursor: 'pointer', background: 'rgba(15, 23, 42, 0.7)' }}
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
              >
                <option value="all">All Units</option>
                {unitOptions.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            )}

            {selectedTestCategory === 'lesson_wise' && lessonOptions.length > 0 && (
              <select
                className="mocktests-tab"
                style={{ cursor: 'pointer', background: 'rgba(15, 23, 42, 0.7)' }}
                value={selectedLesson}
                onChange={(e) => setSelectedLesson(e.target.value)}
              >
                <option value="all">All Lessons</option>
                {lessonOptions.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="mocktests-grid">
          {loading ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
              Loading published mock tests...
            </div>
          ) : filteredTests.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
              No published {testCategories.find((c) => c.id === selectedTestCategory)?.name} are available for{' '}
              {groups.find((g) => g.id === selectedGroup)?.name} yet.
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {filteredTests.map((test, index) => (
                <motion.div
                  key={test.id}
                  className="mocktest-card glass"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="mocktest-top-tags" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="mocktest-category-tag">{test.tnpscGroup || test.categoryName}</span>
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

                  <button
                    type="button"
                    className="mocktest-btn"
                    onClick={() => handleStartTest(test)}
                  >
                    <Play size={18} />
                    <span>Start Test</span>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  )
}

export default MockTests
