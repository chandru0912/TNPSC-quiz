import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Bookmark,
  CheckCircle2,
  Clock,
  Eraser,
  FileText,
  Grid,
  RotateCcw,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { apiFetch } from '../utils/api'
import { useStudentAuth } from '../context/StudentAuthContext'
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker'
import { notifyStudentSync } from '../utils/studentSync'
import { buildAuthRedirectUrl, savePostLoginRedirect } from '../utils/authRedirect'
import { QuestionPalette, type QuestionPaletteStatus } from '../components/exam/QuestionPalette'
import './PreviousPaperTest.css'

interface PaperMeta {
  id: number
  year: number
  exam: string
  category: string
  subjects: string
  totalQuestions: number
  durationMinutes: number
  marksPerQuestion: number
  totalMarks: number
}

interface ExamQuestion {
  id: number
  questionNumber: number
  subject: string
  topic?: string | null
  questionText: string
  options: string[]
}

interface AnswerState {
  selectedOption: number | null
  isMarkedForReview: boolean
  isVisited: boolean
}

interface SessionResultData {
  sessionId: number
  status: string
  submittedAt: string
  paper: {
    id: number
    year: number
    exam: string
    category: string
    subjects: string
  }
  summary: {
    totalQuestions: number
    attemptedQuestions: number
    correctAnswers: number
    incorrectAnswers: number
    unansweredQuestions: number
    score: number
    maxScore: number
    percentage: number
    accuracy: number
    timeSpentSeconds: number
  }
  reviewQuestions: {
    id: number
    questionNumber: number
    subject: string
    topic?: string | null
    questionText: string
    options: string[]
    selectedOption: number | null
    correctAnswer: number
    isCorrect: boolean
    explanation?: string | null
  }[]
}

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const hrs = Math.floor(safe / 3600)
  const mins = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':')
}

function formatDurationHuman(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const hrs = Math.floor(safe / 3600)
  const mins = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

const PreviousPaperTest = () => {
  useStudyTimeTracker()
  const { paperId } = useParams<{ paperId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { token, student } = useStudentAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paper, setPaper] = useState<PaperMeta | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({})
  const [currentQNum, setCurrentQNum] = useState<number>(1)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)
  const [isPaletteOpenMobile, setIsPaletteOpenMobile] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resultData, setResultData] = useState<SessionResultData | null>(null)
  const [showReviewAll, setShowReviewAll] = useState(false)

  const autoSubmittedRef = useRef(false)
  const resultSessionParam = searchParams.get('resultSession')

  // Load either persisted Result OR active/new Test Session
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    let cancelled = false
    const init = async () => {
      try {
        setLoading(true)
        setError(null)

        if (resultSessionParam) {
          const rRes = await apiFetch(`/api/previous-papers/sessions/${resultSessionParam}/result`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const rJson = await rRes.json().catch(() => null)
          if (!cancelled && rRes.ok && rJson?.status === 'success' && rJson.data) {
            setResultData(rJson.data)
            setLoading(false)
            return
          }
        }

        const res = await apiFetch(`/api/previous-papers/${paperId}/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })
        const json = await res.json().catch(() => null)
        if (cancelled) return

        if (!res.ok || json?.status !== 'success' || !json.data) {
          setError(json?.message || 'Unable to load previous year paper examination.')
          setLoading(false)
          return
        }

        const d = json.data
        setPaper(d.paper)
        setSessionId(d.session.id)
        setQuestions(d.questions || [])
        setRemainingSeconds(Number(d.session.remainingSeconds) || 0)

        const initialAnswers: Record<number, AnswerState> = d.answers || {}
        const startQ = Number(d.session.currentQuestion) || 1
        if (!initialAnswers[startQ]) {
          initialAnswers[startQ] = { selectedOption: null, isMarkedForReview: false, isVisited: true }
        } else {
          initialAnswers[startQ] = { ...initialAnswers[startQ], isVisited: true }
        }
        setAnswers(initialAnswers)
        setCurrentQNum(startQ)
        setLoading(false)
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Network error while loading test.')
          setLoading(false)
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [paperId, token, resultSessionParam])

  const submitExamination = useCallback(
    async (autoSubmitted = false) => {
      if (!sessionId || !token || isSubmitting || resultData) return
      setIsSubmitting(true)
      try {
        const res = await apiFetch(`/api/previous-papers/sessions/${sessionId}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ autoSubmitted }),
        })
        const json = await res.json().catch(() => null)
        if (res.ok && json?.status === 'success' && json.data) {
          setShowSubmitModal(false)
          setResultData(json.data)
          setSearchParams({ resultSession: String(sessionId) }, { replace: true })
          notifyStudentSync()
        } else {
          setError(json?.message || 'Failed to submit examination.')
        }
      } catch (err: any) {
        setError(err?.message || 'Network error while submitting examination.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [sessionId, token, isSubmitting, resultData, setSearchParams]
  )

  // Countdown Timer (synced with backend expires_at; auto-submits at 0)
  useEffect(() => {
    if (!sessionId || resultData || loading) return
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true
            submitExamination(true)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [sessionId, resultData, loading, submitExamination])

  // Browser reload/close protection during active test
  useEffect(() => {
    if (!sessionId || resultData) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [sessionId, resultData])

  const persistAnswer = useCallback(
    async (q: ExamQuestion, nextState: AnswerState, nextCurrentQNum?: number) => {
      if (!sessionId || !token || resultData) return
      try {
        const res = await apiFetch(`/api/previous-papers/sessions/${sessionId}/answer`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            questionId: q.id,
            questionNumber: q.questionNumber,
            selectedOption: nextState.selectedOption,
            isMarkedForReview: nextState.isMarkedForReview,
            isVisited: nextState.isVisited,
            currentQuestion: nextCurrentQNum ?? q.questionNumber,
          }),
        })
        const json = await res.json().catch(() => null)
        if (res.ok && typeof json?.remainingSeconds === 'number') {
          setRemainingSeconds(json.remainingSeconds)
        }
      } catch {
        // Answer remains in local state and will be saved on next action
      }
    },
    [sessionId, token, resultData]
  )

  const currentQuestion = useMemo(
    () => questions.find((q) => q.questionNumber === currentQNum) || questions[0] || null,
    [questions, currentQNum]
  )

  const currentAnswerState: AnswerState = currentQuestion
    ? answers[currentQuestion.questionNumber] || { selectedOption: null, isMarkedForReview: false, isVisited: true }
    : { selectedOption: null, isMarkedForReview: false, isVisited: false }

  const stats = useMemo(() => {
    let answered = 0
    let marked = 0
    let notAnswered = 0
    for (const q of questions) {
      const st = answers[q.questionNumber]
      if (st?.isMarkedForReview) marked++
      if (st?.selectedOption !== null && st?.selectedOption !== undefined) answered++
      else if (st?.isVisited) notAnswered++
    }
    return {
      total: questions.length,
      answered,
      unanswered: Math.max(0, questions.length - answered),
      marked,
      notAnswered,
    }
  }, [questions, answers])

  const goToQuestion = (qNum: number) => {
    const target = questions.find((q) => q.questionNumber === qNum)
    if (!target) return
    const existing = answers[qNum] || { selectedOption: null, isMarkedForReview: false, isVisited: true }
    const updated = { ...existing, isVisited: true }
    setAnswers((prev) => ({ ...prev, [qNum]: updated }))
    setCurrentQNum(qNum)
    setIsPaletteOpenMobile(false)
    persistAnswer(target, updated, qNum)
  }

  const handleSelectOption = (optionIndex: number) => {
    if (!currentQuestion) return
    const nextState: AnswerState = {
      ...currentAnswerState,
      selectedOption: optionIndex,
      isVisited: true,
    }
    setAnswers((prev) => ({ ...prev, [currentQuestion.questionNumber]: nextState }))
    persistAnswer(currentQuestion, nextState, currentQuestion.questionNumber)
  }

  const handleClearResponse = () => {
    if (!currentQuestion) return
    const nextState: AnswerState = {
      ...currentAnswerState,
      selectedOption: null,
      isVisited: true,
    }
    setAnswers((prev) => ({ ...prev, [currentQuestion.questionNumber]: nextState }))
    persistAnswer(currentQuestion, nextState, currentQuestion.questionNumber)
  }

  const handleMarkForReview = () => {
    if (!currentQuestion) return
    const nextState: AnswerState = {
      ...currentAnswerState,
      isMarkedForReview: !currentAnswerState.isMarkedForReview,
      isVisited: true,
    }
    setAnswers((prev) => ({ ...prev, [currentQuestion.questionNumber]: nextState }))
    persistAnswer(currentQuestion, nextState, currentQuestion.questionNumber)
  }

  const handleSaveAndNext = () => {
    if (!currentQuestion) return
    const nextState: AnswerState = {
      ...currentAnswerState,
      isVisited: true,
    }
    setAnswers((prev) => ({ ...prev, [currentQuestion.questionNumber]: nextState }))
    const nextNum = currentQuestion.questionNumber < questions.length ? currentQuestion.questionNumber + 1 : 1
    const nextQ = questions.find((q) => q.questionNumber === nextNum)
    if (nextQ) {
      const nextQExisting = answers[nextNum] || { selectedOption: null, isMarkedForReview: false, isVisited: true }
      setAnswers((prev) => ({ ...prev, [nextNum]: { ...nextQExisting, isVisited: true } }))
      setCurrentQNum(nextNum)
      persistAnswer(currentQuestion, nextState, nextNum)
    } else {
      persistAnswer(currentQuestion, nextState, currentQuestion.questionNumber)
    }
  }

  useEffect(() => {
    if (token) return
    const query = searchParams.toString()
    const target = `/previous-papers/test/${paperId || ''}${query ? `?${query}` : ''}`
    savePostLoginRedirect(target)
    navigate(buildAuthRedirectUrl('login', target), { replace: true, state: { from: target } })
  }, [token, paperId, searchParams, navigate])

  if (!token) {
    return null
  }

  if (loading) {
    return (
      <div className="pyp-exam-page">
        <div className="pyp-loading-card glass">
          <Clock size={36} className="pyp-spin" />
          <p>Preparing your 200-question TNPSC examination session...</p>
        </div>
      </div>
    )
  }

  if (error && !resultData) {
    return (
      <div className="pyp-exam-page">
        <div className="pyp-auth-card glass">
          <AlertTriangle size={40} style={{ color: '#f87171' }} />
          <h2>Unable to Load Examination</h2>
          <p>{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/previous-papers')}>
            Back to Previous Year Papers
          </button>
        </div>
      </div>
    )
  }

  // RESULT VIEW
  if (resultData) {
    const { summary, paper: resPaper, reviewQuestions } = resultData
    return (
      <div className="pyp-exam-page">
        <div className="pyp-result-container">
          <div className="pyp-result-card glass">
            <div className="pyp-result-header">
              <div className="pyp-result-badge">
                <Award size={18} />
                <span>Examination Result</span>
              </div>
              <h1>{`${resPaper.exam} (${resPaper.year})`}</h1>
              <p>{resPaper.subjects}</p>
            </div>

            <div className="pyp-result-score-hero">
              <div className="pyp-score-main">
                <span className="pyp-score-val">{summary.score}</span>
                <span className="pyp-score-max">/ {summary.maxScore} Marks</span>
              </div>
              <div className="pyp-score-pct-pill">{summary.percentage}% Score</div>
            </div>

            <div className="pyp-result-grid">
              <div className="pyp-stat-box correct">
                <CheckCircle2 size={20} />
                <div>
                  <strong>{summary.correctAnswers}</strong>
                  <span>Correct Answers</span>
                </div>
              </div>
              <div className="pyp-stat-box wrong">
                <XCircle size={20} />
                <div>
                  <strong>{summary.incorrectAnswers}</strong>
                  <span>Incorrect Answers</span>
                </div>
              </div>
              <div className="pyp-stat-box neutral">
                <FileText size={20} />
                <div>
                  <strong>{summary.unansweredQuestions}</strong>
                  <span>Unanswered</span>
                </div>
              </div>
              <div className="pyp-stat-box info">
                <ShieldCheck size={20} />
                <div>
                  <strong>{summary.accuracy}%</strong>
                  <span>Overall Accuracy</span>
                </div>
              </div>
              <div className="pyp-stat-box info">
                <Clock size={20} />
                <div>
                  <strong>{formatDurationHuman(summary.timeSpentSeconds)}</strong>
                  <span>Time Taken</span>
                </div>
              </div>
            </div>

            <div className="pyp-result-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowReviewAll((v) => !v)}
              >
                <RotateCcw size={16} />
                <span>{showReviewAll ? 'Hide Answer Review' : 'Review All Answers'}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/previous-papers')}
              >
                <ArrowLeft size={16} />
                <span>Back to Previous Year Papers</span>
              </button>
            </div>
          </div>

          {showReviewAll && (
            <div className="pyp-review-list">
              {reviewQuestions.map((rq) => (
                <div key={rq.id} className="pyp-review-item glass">
                  <div className="pyp-review-item-head">
                    <span className="pyp-q-badge">Q{rq.questionNumber} • {rq.subject}</span>
                    <span
                      className={`pyp-review-status ${
                        rq.selectedOption === null
                          ? 'unanswered'
                          : rq.isCorrect
                          ? 'correct'
                          : 'wrong'
                      }`}
                    >
                      {rq.selectedOption === null
                        ? 'Unanswered'
                        : rq.isCorrect
                        ? 'Correct'
                        : 'Incorrect'}
                    </span>
                  </div>
                  <p className="pyp-review-qtext">{rq.questionText}</p>
                  <div className="pyp-review-opts">
                    {rq.options.map((opt, idx) => {
                      const isCorrectOpt = idx === rq.correctAnswer
                      const isStudentOpt = idx === rq.selectedOption
                      let cls = 'pyp-review-opt'
                      if (isCorrectOpt) cls += ' opt-correct'
                      else if (isStudentOpt) cls += ' opt-wrong'
                      return (
                        <div key={idx} className={cls}>
                          <span className="pyp-opt-letter">{String.fromCharCode(65 + idx)}</span>
                          <span>{opt}</span>
                          {isCorrectOpt && <span className="pyp-opt-tag">Correct Answer</span>}
                          {isStudentOpt && !isCorrectOpt && <span className="pyp-opt-tag">Your Answer</span>}
                        </div>
                      )
                    })}
                  </div>
                  {rq.explanation && (
                    <div className="pyp-review-explanation">
                      <strong>Explanation:</strong> {rq.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const isWarning15 = remainingSeconds > 300 && remainingSeconds <= 900
  const isWarning5 = remainingSeconds > 0 && remainingSeconds <= 300

  return (
    <div className="pyp-exam-page">
      {/* Top Examination Header */}
      <header className="pyp-exam-topbar glass">
        <div className="pyp-topbar-left">
          <button
            type="button"
            className="pyp-leave-btn"
            onClick={() => setShowLeaveModal(true)}
            title="Leave active examination"
          >
            <ArrowLeft size={16} />
            <span>Exit</span>
          </button>
          <div>
            <div className="pyp-brand-line">
              <span className="pyp-hub-tag">TNPSC Study Hub</span>
              <span className="pyp-status-dot">● In Progress</span>
            </div>
            <h1 className="pyp-exam-heading">
              {paper?.exam} ({paper?.year})
            </h1>
          </div>
        </div>

        <div className="pyp-topbar-meta">
          <div className="pyp-meta-pill">
            <span>Questions</span>
            <strong>{paper?.totalQuestions || questions.length}</strong>
          </div>
          <div className="pyp-meta-pill">
            <span>Total Marks</span>
            <strong>{paper?.totalMarks || 300}</strong>
          </div>
          <div className={`pyp-timer-pill ${isWarning5 ? 'critical' : isWarning15 ? 'warning' : ''}`}>
            <Clock size={16} />
            <span>{formatTimer(remainingSeconds)}</span>
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

      {/* 15-minute and 5-minute Timer Warnings */}
      {isWarning15 && (
        <div className="pyp-timer-banner warning">
          <AlertTriangle size={16} />
          <span>15 Minutes Warning: Less than 15 minutes remaining. Review and save your answers.</span>
        </div>
      )}
      {isWarning5 && (
        <div className="pyp-timer-banner critical">
          <AlertTriangle size={16} />
          <span>Final Warning: Less than 5 minutes left! Test will auto-submit when the timer reaches 00:00:00.</span>
        </div>
      )}

      {/* Main Two-Column Exam Workspace */}
      <div className="pyp-exam-workspace">
        {/* LEFT: Question Panel */}
        <main className="pyp-question-panel glass">
          {currentQuestion && (
            <>
              <div className="pyp-q-header">
                <span className="pyp-q-num-badge">
                  Question {currentQuestion.questionNumber} of {questions.length}
                </span>
                <span className="pyp-q-subject-tag">{currentQuestion.subject}</span>
                {currentAnswerState.isMarkedForReview && (
                  <span className="pyp-q-review-tag">Marked for Review</span>
                )}
              </div>

              <h2 className="pyp-q-text">{currentQuestion.questionText}</h2>

              <div className="pyp-options-list" role="radiogroup" aria-label={`Question ${currentQuestion.questionNumber} options`}>
                {currentQuestion.options.map((opt, idx) => {
                  const isSelected = currentAnswerState.selectedOption === idx
                  return (
                    <label
                      key={idx}
                      className={`pyp-option-card ${isSelected ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`q-${currentQuestion.id}`}
                        checked={isSelected}
                        onChange={() => handleSelectOption(idx)}
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
                    disabled={currentQuestion.questionNumber <= 1}
                    onClick={() => goToQuestion(currentQuestion.questionNumber - 1)}
                  >
                    <ArrowLeft size={16} />
                    <span>Previous</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClearResponse}
                    disabled={currentAnswerState.selectedOption === null}
                  >
                    <Eraser size={16} />
                    <span>Clear Response</span>
                  </button>
                  <button
                    type="button"
                    className={`btn ${currentAnswerState.isMarkedForReview ? 'pyp-review-active-btn' : 'btn-secondary'}`}
                    onClick={handleMarkForReview}
                  >
                    <Bookmark size={16} />
                    <span>{currentAnswerState.isMarkedForReview ? 'Unmark Review' : 'Mark for Review'}</span>
                  </button>
                </div>

                <div className="pyp-q-controls-right">
                  <button type="button" className="btn btn-primary" onClick={handleSaveAndNext}>
                    <span>Save &amp; Next</span>
                    <ArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn pyp-submit-trigger-btn"
                    onClick={() => setShowSubmitModal(true)}
                  >
                    <Send size={16} />
                    <span>Submit Test</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </main>

        {/* RIGHT: 1-200 Question Palette */}
        <QuestionPalette
          title="Question Palette"
          subtitle={student?.fullName || 'Candidate'}
          items={questions.map((q) => {
            const st = answers[q.questionNumber]
            const hasAns = st?.selectedOption !== null && st?.selectedOption !== undefined
            const isMarked = Boolean(st?.isMarkedForReview)
            let status: QuestionPaletteStatus = 'not-visited'
            if (hasAns && isMarked) status = 'answered-review'
            else if (isMarked) status = 'review'
            else if (hasAns) status = 'answered'
            else if (st?.isVisited) status = 'not-answered'
            return {
              id: q.id,
              number: q.questionNumber,
              status,
            }
          })}
          currentNumber={currentQNum}
          onSelectQuestion={(qNum) => goToQuestion(qNum)}
          isOpenMobile={isPaletteOpenMobile}
          onCloseMobile={() => setIsPaletteOpenMobile(false)}
          submitLabel="Submit Test"
          onSubmitClick={() => setShowSubmitModal(true)}
        />
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="pyp-modal-backdrop">
          <div className="pyp-modal-card glass">
            <h3>Submit Examination?</h3>
            <p>Review your attempt summary before final submission. This action cannot be undone.</p>
            <div className="pyp-modal-summary">
              <div><span>Total Questions</span><strong>{stats.total}</strong></div>
              <div><span>Answered</span><strong className="green">{stats.answered}</strong></div>
              <div><span>Unanswered</span><strong className="amber">{stats.unanswered}</strong></div>
              <div><span>Marked for Review</span><strong className="purple">{stats.marked}</strong></div>
            </div>
            <div className="pyp-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowSubmitModal(false)} disabled={isSubmitting}>
                Continue Test
              </button>
              <button type="button" className="btn btn-primary" onClick={() => submitExamination(false)} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Confirmation Modal */}
      {showLeaveModal && (
        <div className="pyp-modal-backdrop">
          <div className="pyp-modal-card glass">
            <h3>Leave Active Examination?</h3>
            <p>Your saved answers and remaining timer will stay preserved so you can resume this paper anytime before time expires.</p>
            <div className="pyp-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowLeaveModal(false)}>
                Stay in Test
              </button>
              <button type="button" className="btn btn-primary" onClick={() => navigate('/previous-papers')}>
                Leave to Papers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PreviousPaperTest
