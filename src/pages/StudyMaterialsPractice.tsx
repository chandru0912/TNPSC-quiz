import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Layers,
  GraduationCap,
  Languages,
} from 'lucide-react'
import { apiFetch } from '../utils/api'
import {
  getSubjectsForGroup,
  getUnitsForSubjectStandard,
  getLessonsForSelection,
  type LessonItem,
} from '../data/unifiedSyllabusRegistry'
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker'
import { useMcqTranslations } from '../hooks/useMcqTranslations'
import './StudyMaterialsPractice.css'

interface StudyMaterialQuestionItem {
  id: number
  targetSystem: string
  examGroupId: string
  subjectId: string
  subject: string
  standardId: number
  classId: number
  unitId: number
  lessonId: string
  lessonTitle: string
  language: string
  questionText: string
  question: string
  options: string[]
  optionA?: string
  optionB?: string
  optionC?: string
  optionD?: string
  correctAnswer: number
  explanation: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  status: string
}

export const StudyMaterialsPractice: React.FC = () => {
  useStudyTimeTracker()
  const navigate = useNavigate()
  const routeParams = useParams<{
    group?: string
    subjectId?: string
    classId?: string
    unitId?: string
    lessonId?: string
  }>()
  const [searchParams] = useSearchParams()

  // Resolve Route & Query Parameters
  const rawGroup = routeParams.group || searchParams.get('group') || 'group2'
  const normalizedGroup: 'group1' | 'group2' | 'group4' =
    rawGroup.toLowerCase().includes('group4') || rawGroup.toLowerCase().includes('vao')
      ? 'group4'
      : rawGroup.toLowerCase().includes('group1')
        ? 'group1'
        : 'group2'

  const subjectId = routeParams.subjectId || searchParams.get('subjectId') || 'general-studies'
  const classId = parseInt(routeParams.classId || searchParams.get('classId') || '6', 10) || 6
  const unitId = parseInt(routeParams.unitId || searchParams.get('unitId') || '1', 10) || 1
  const lessonIdParam = routeParams.lessonId || searchParams.get('lessonId') || ''
  const lessonTitleParam = searchParams.get('lesson') || searchParams.get('lessonTitle') || ''

  // Live Questions State
  const [questions, setQuestions] = useState<StudyMaterialQuestionItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Interactive Practice State
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false)
  const [userAnswers, setUserAnswers] = useState<
    Record<number, { selected: number; isCorrect: boolean }>
  >({})
  const [isQuizCompleted, setIsQuizCompleted] = useState<boolean>(false)
  const [isReviewMode, setIsReviewMode] = useState<boolean>(false)
  const [showExplanation, setShowExplanation] = useState<boolean>(true)
  const [questionLang, setQuestionLang] = useState<'en' | 'ta'>('en')

  // 1. Resolve Hierarchy Metadata from authoritative registry
  const availableSubjects = getSubjectsForGroup(normalizedGroup)
  const resolvedSubject =
    availableSubjects.find(
      (s) => s.id === subjectId || s.name.toLowerCase() === subjectId.toLowerCase()
    ) || availableSubjects[0]

  const availableUnits = getUnitsForSubjectStandard(normalizedGroup, resolvedSubject.id, classId)
  const resolvedUnit =
    availableUnits.find((u) => u.id === unitId) || availableUnits[0] || { id: unitId, title: `Unit ${unitId}`, unitNumber: `Unit ${unitId}` }

  const availableLessons = getLessonsForSelection(normalizedGroup, resolvedSubject.id, classId, unitId)
  const matchedLesson: LessonItem | undefined =
    availableLessons.find(
      (l) => (lessonIdParam && l.id === lessonIdParam) ||
        (lessonTitleParam && l.title.trim().toLowerCase() === lessonTitleParam.trim().toLowerCase())
    )
  const resolvedLesson: LessonItem | undefined = matchedLesson || (lessonTitleParam || lessonIdParam ? undefined : availableLessons[0])

  const displayLessonTitle = lessonTitleParam || resolvedLesson?.title || availableLessons[0]?.title || 'Lesson Practice'
  const displayLessonId = lessonIdParam || resolvedLesson?.id || availableLessons[0]?.id
  const displayLessonNumber = resolvedLesson?.lessonNumber || availableLessons[0]?.lessonNumber || '1.1'

  // Exam Group Display Title
  const groupDisplayTitle = useMemo(() => {
    switch (normalizedGroup) {
      case 'group1':
        return 'TNPSC Group 1'
      case 'group2':
        return 'TNPSC Group 2 & 2A'
      case 'group4':
        return 'TNPSC Group 4 & VAO'
      default:
        return 'TNPSC Exam'
    }
  }, [normalizedGroup])

  // Back Navigation Handlers preserving context
  const handleBackToStandard = () => {
    if (normalizedGroup === 'group2') {
      navigate(`/materials/group2/${resolvedSubject.id}/unit/${unitId}/class/${classId}`)
    } else if (normalizedGroup === 'group4') {
      navigate(`/materials/group4/${resolvedSubject.id}/unit/${unitId}/class/${classId}`)
    } else {
      const g1Base = resolvedSubject.id === 'aptitude' ? '/materials/group1/aptitude' : '/materials/group1'
      navigate(`${g1Base}/unit/${unitId}/class/${classId}`)
    }
  }

  const handleBackToStudyMaterials = () => {
    if (normalizedGroup === 'group2') {
      navigate(`/materials/group2/${resolvedSubject.id}`)
    } else if (normalizedGroup === 'group4') {
      navigate(`/materials/group4/${resolvedSubject.id}`)
    } else {
      navigate(resolvedSubject.id === 'aptitude' ? '/materials/group1/aptitude' : '/materials/group1/general-studies')
    }
  }

  // 2. Fetch exclusively from Study Materials Practice Questions API
  useEffect(() => {
    let isMounted = true
    const fetchStudyMaterialsMCQs = async () => {
      setIsLoading(true)
      setFetchError(null)
      setCurrentIndex(0)
      setSelectedOption(null)
      setIsAnswerSubmitted(false)
      setUserAnswers({})
      setIsQuizCompleted(false)
      setIsReviewMode(false)

      try {
        const queryParams = new URLSearchParams()
        queryParams.set('group', normalizedGroup)
        queryParams.set('subjectId', resolvedSubject.id)
        queryParams.set('standard', classId.toString())
        queryParams.set('unitId', unitId.toString())
        if (displayLessonId) queryParams.set('lessonId', displayLessonId)
        if (displayLessonTitle) queryParams.set('lessonTitle', displayLessonTitle)
        queryParams.set('limit', '300')

        const res = await apiFetch(`/api/study-materials/questions?${queryParams.toString()}`)
        const data = await res.json().catch(() => null)

        if (isMounted) {
          if (res.ok && data?.status === 'success' && Array.isArray(data.data)) {
            setQuestions(data.data)
          } else {
            setQuestions([])
            if (!res.ok) {
              setFetchError(data?.message || 'Failed to load practice questions.')
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load Study Materials Practice questions:', err)
          setQuestions([])
          setFetchError('Unable to connect to practice question server.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchStudyMaterialsMCQs()

    return () => {
      isMounted = false
    }
  }, [
    normalizedGroup,
    resolvedSubject.id,
    classId,
    unitId,
    displayLessonId,
    displayLessonTitle,
  ])

  const {
    translations,
    failedIds,
    isTranslating,
    translatedCount,
    retry: retryTranslation,
  } = useMcqTranslations(questions, questionLang, currentIndex)

  const rawActiveQuestion = questions[currentIndex]
  const activeTranslation =
    questionLang === 'ta' && rawActiveQuestion ? translations[rawActiveQuestion.id] : undefined
  const activeQuestion = useMemo(() => {
    if (!rawActiveQuestion) return undefined
    if (questionLang !== 'ta' || !activeTranslation) return rawActiveQuestion
    return {
      ...rawActiveQuestion,
      question: activeTranslation.question,
      options: activeTranslation.options,
      explanation: activeTranslation.explanation,
    }
  }, [rawActiveQuestion, questionLang, activeTranslation])
  const isWaitingForTamilTranslation =
    questionLang === 'ta' && Boolean(rawActiveQuestion) && !activeTranslation

  // Handle Option Select
  const handleSelectOption = (index: number) => {
    if (isAnswerSubmitted) return
    setSelectedOption(index)
  }

  // Submit Answer for instant feedback
  const handleSubmitAnswer = () => {
    if (selectedOption === null || !activeQuestion || isAnswerSubmitted) return

    const isCorrect = selectedOption === activeQuestion.correctAnswer
    setIsAnswerSubmitted(true)
    setUserAnswers((prev) => ({
      ...prev,
      [currentIndex]: {
        selected: selectedOption,
        isCorrect,
      },
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
          questionId: activeQuestion.id,
          category: normalizedGroup,
          subject: resolvedSubject?.name || activeQuestion.subject || subjectId,
          classId,
          unitId,
          lessonId: activeQuestion.lessonId || lessonIdParam,
          lessonTitle: activeQuestion.lessonTitle || lessonTitleParam || 'Lesson Practice',
          selectedOption,
          correctAnswer: activeQuestion.correctAnswer,
          isCorrect,
          sourceSystem: 'study_materials',
          timeSpentSeconds: 15,
        }),
      }).catch((err) => console.warn('[StudentTrack] Failed to log lesson question attempt:', err))
    }
  }

  // Next Question
  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1
      setCurrentIndex(nextIdx)
      const existingAnswer = userAnswers[nextIdx]
      if (existingAnswer) {
        setSelectedOption(existingAnswer.selected)
        setIsAnswerSubmitted(true)
      } else {
        setSelectedOption(null)
        setIsAnswerSubmitted(false)
      }
    } else {
      setIsQuizCompleted(true)
    }
  }

  // Previous Question
  const handlePrevQuestion = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1
      setCurrentIndex(prevIdx)
      const existingAnswer = userAnswers[prevIdx]
      if (existingAnswer) {
        setSelectedOption(existingAnswer.selected)
        setIsAnswerSubmitted(true)
      } else {
        setSelectedOption(null)
        setIsAnswerSubmitted(false)
      }
    }
  }

  // Reset & Retry Practice
  const handleRetryPractice = () => {
    setCurrentIndex(0)
    setSelectedOption(null)
    setIsAnswerSubmitted(false)
    setUserAnswers({})
    setIsQuizCompleted(false)
    setIsReviewMode(false)
  }

  // Calculate Performance Stats
  const answeredCount = Object.keys(userAnswers).length
  const correctCount = Object.values(userAnswers).filter((a) => a.isCorrect).length
  const accuracyPercentage =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0

  return (
    <div className="sm-practice-page">
      <div className="sm-practice-container">
        {/* 1. Header Navigation Bar */}
        <div className="sm-practice-nav-bar">
          <div className="sm-nav-buttons-group">
            <button
              className="sm-nav-btn sm-nav-btn-gold"
              onClick={handleBackToStandard}
              title="Return to originating standard and lessons list"
            >
              <ArrowLeft size={16} />
              <span>Back to Standard</span>
            </button>
            <button
              className="sm-nav-btn"
              onClick={handleBackToStudyMaterials}
              title="Return to Subject Study Materials"
            >
              <BookOpen size={16} />
              <span>Back to Study Materials</span>
            </button>
          </div>
        </div>

        {/* 2. Page Information HUD Card */}
        <div className="sm-info-hud-card">
          {/* Breadcrumb Hierarchy Pills */}
          <div className="sm-breadcrumbs-pills">
            <span className="sm-pill sm-pill-gold">
              <GraduationCap size={13} />
              {groupDisplayTitle}
            </span>
            <span>/</span>
            <span className="sm-pill">
              <BookOpen size={13} />
              {resolvedSubject.name}
            </span>
            <span>/</span>
            <span className="sm-pill">
              <Layers size={13} />
              Class {classId}th Standard
            </span>
            <span>/</span>
            <span className="sm-pill">
              {resolvedUnit.unitNumber || `Unit ${unitId}`}
            </span>
          </div>

          <div className="sm-hud-main">
            <div className="sm-lesson-title-area">
              <div className="sm-lesson-eyebrow">
                <Sparkles size={14} />
                <span>Lesson {displayLessonNumber} • Study Materials Practice</span>
              </div>
              <h1 className="sm-lesson-title">{displayLessonTitle}</h1>
              {resolvedLesson?.description && (
                <p className="sm-lesson-description">{resolvedLesson.description}</p>
              )}
            </div>

            <div className="sm-hud-stats-area">
              <div className="sm-stat-box">
                <span className="sm-stat-number">{questions.length}</span>
                <span className="sm-stat-label">Questions</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Loading State */}
        {isLoading && (
          <div className="sm-empty-card">
            <div className="sm-empty-icon-box spin-icon">
              <Sparkles size={28} />
            </div>
            <h2 className="sm-empty-title">Loading Practice MCQs...</h2>
            <p className="sm-empty-desc">
              Retrieving verified textbook practice questions for {displayLessonTitle}.
            </p>
          </div>
        )}

        {/* 4. Empty State: No questions available */}
        {!isLoading && questions.length === 0 && (
          <div className="sm-empty-card">
            <div className="sm-empty-icon-box">
              <HelpCircle size={32} />
            </div>
            <h2 className="sm-empty-title">
              No Practice MCQs Available for this Lesson
            </h2>
            <p className="sm-empty-desc">
              {`Practice questions for "${displayLessonTitle}" are currently being curated.`}
            </p>
            {fetchError && (
              <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.25rem' }}>{fetchError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button className="sm-nav-btn" onClick={handleBackToStandard}>
                <ArrowLeft size={15} />
                <span>Back to Lessons List</span>
              </button>
            </div>
          </div>
        )}

        {/* 5. Active Practice Question Section */}
        {!isLoading && questions.length > 0 && !isQuizCompleted && activeQuestion && (
          <div className="sm-question-container">
            {/* Independent Question Language Selector (English default | தமிழ்) */}
            <div className="sm-question-lang-bar" role="region" aria-label="Question Language">
              <span className="sm-question-lang-label">
                <Languages size={15} />
                <span>Question Language</span>
              </span>
              <div className="sm-lang-toggle-bar" role="group" aria-label="Select Question Language">
                <button
                  type="button"
                  className={`sm-lang-btn ${questionLang === 'en' ? 'active' : ''}`}
                  onClick={() => setQuestionLang('en')}
                  aria-pressed={questionLang === 'en'}
                >
                  English
                </button>
                <button
                  type="button"
                  className={`sm-lang-btn ${questionLang === 'ta' ? 'active' : ''}`}
                  onClick={() => setQuestionLang('ta')}
                  aria-pressed={questionLang === 'ta'}
                >
                  தமிழ்
                </button>
              </div>
              {questionLang === 'ta' && (
                <span className="sm-lang-progress">
                  {isTranslating
                    ? `தமிழில் மொழிபெயர்க்கப்படுகிறது... (${translatedCount}/${questions.length})`
                    : `${translatedCount}/${questions.length} தமிழ்`}
                </span>
              )}
            </div>

            {questionLang === 'ta' && !activeTranslation && (
              <div
                className={`sm-translation-banner ${failedIds.includes(activeQuestion.id) || (!isTranslating && failedIds.length > 0) ? 'error' : ''}`}
                role="status"
                aria-live="polite"
              >
                <span>
                  {isTranslating
                    ? 'இந்தக் கேள்வி தமிழில் மொழிபெயர்க்கப்படுகிறது... (தற்காலிகமாக ஆங்கில மூலக் கேள்வி காட்டப்படுகிறது)'
                    : 'தமிழ் மொழிபெயர்ப்பு தற்போது கிடைக்கவில்லை. மூல ஆங்கிலக் கேள்வி பாதுகாப்பாகக் காட்டப்படுகிறது.'}
                </span>
                {!isTranslating && (
                  <button
                    type="button"
                    className="sm-translation-retry"
                    onClick={retryTranslation}
                  >
                    <RotateCcw size={13} />
                    <span>மீண்டும் முயற்சிக்கவும் / Retry</span>
                  </button>
                )}
              </div>
            )}

            {/* Progress Header Card */}
            <div className="sm-progress-card">
              <div className="sm-progress-header">
                <span>
                  Question <strong>{currentIndex + 1}</strong> of <strong>{questions.length}</strong>
                </span>
                <span className="sm-progress-score">
                  Score: {correctCount} / {answeredCount}
                </span>
              </div>
              <div className="sm-progress-bar-track">
                <div
                  className="sm-progress-bar-fill"
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Question Card */}
            <motion.div
              key={activeQuestion.id}
              className="sm-question-card"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="sm-question-header">
                <span className="sm-q-num-pill">Question {currentIndex + 1}</span>
                <span className="sm-diff-pill">{activeQuestion.difficulty || 'Medium'}</span>
              </div>

              <h2 className="sm-question-text">{activeQuestion.question}</h2>

              {/* Options List */}
              <div className="sm-options-list">
                {activeQuestion.options.map((optionText, optIndex) => {
                  const optionLabel = ['A', 'B', 'C', 'D'][optIndex] || String(optIndex + 1)
                  const isSelected = selectedOption === optIndex
                  const isCorrect = isAnswerSubmitted && optIndex === activeQuestion.correctAnswer
                  const isWrong = isAnswerSubmitted && isSelected && !isCorrect

                  let btnClassName = 'sm-option-btn'
                  if (isSelected && !isAnswerSubmitted) btnClassName += ' selected'
                  if (isCorrect) btnClassName += ' correct'
                  if (isWrong) btnClassName += ' incorrect'

                  return (
                    <button
                      key={optIndex}
                      type="button"
                      className={btnClassName}
                      onClick={() => handleSelectOption(optIndex)}
                      disabled={isAnswerSubmitted}
                    >
                      <span className="sm-opt-badge">{optionLabel}</span>
                      <span className="sm-opt-text">{optionText}</span>
                      {isCorrect && (
                        <CheckCircle2 size={18} style={{ color: '#10b981', marginLeft: 'auto' }} />
                      )}
                      {isWrong && (
                        <XCircle size={18} style={{ color: '#ef4444', marginLeft: 'auto' }} />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Instant Answer Feedback & Explanation */}
              <AnimatePresence>
                {isAnswerSubmitted && (
                  <motion.div
                    className={`sm-feedback-card ${selectedOption === activeQuestion.correctAnswer
                      ? 'correct-card'
                      : 'incorrect-card'
                      }`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="sm-feedback-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {selectedOption === activeQuestion.correctAnswer ? (
                          <>
                            <CheckCircle2 size={18} />
                            <span>
                              {questionLang === 'ta' && !isWaitingForTamilTranslation
                                ? 'சரியான விடை!'
                                : 'Correct Answer!'}
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle size={18} />
                            <span>
                              {questionLang === 'ta' && !isWaitingForTamilTranslation
                                ? `தவறான விடை. சரியான விடை: விருப்பம் ${['A', 'B', 'C', 'D'][activeQuestion.correctAnswer]} (${activeQuestion.options[activeQuestion.correctAnswer] || ''})`
                                : `Incorrect Answer. Correct Answer: Option ${['A', 'B', 'C', 'D'][activeQuestion.correctAnswer]} (${activeQuestion.options[activeQuestion.correctAnswer] || ''})`}
                            </span>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowExplanation((prev) => !prev)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.3rem 0.7rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.18)',
                          background: 'rgba(15, 23, 42, 0.6)',
                          color: '#e2e8f0',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <BookOpen size={13} />
                        <span>
                          {questionLang === 'ta'
                            ? showExplanation
                              ? 'விளக்கத்தை மறை'
                              : 'விளக்கத்தைக் காண்க'
                            : showExplanation
                              ? 'Hide Explanation'
                              : 'View Explanation'}
                        </span>
                      </button>
                    </div>
                    {showExplanation && (
                      <div className="sm-feedback-explanation" style={{ marginTop: '0.65rem' }}>
                        {isWaitingForTamilTranslation ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <p style={{ color: '#94a3b8', margin: 0 }}>
                              {isTranslating
                                ? 'விளக்கம் தமிழில் மொழிபெயர்க்கப்படுகிறது...'
                                : 'தமிழ் விளக்கம் தற்போது கிடைக்கவில்லை. மீண்டும் முயற்சிக்கவும்.'}
                            </p>
                            {!isTranslating && (
                              <button
                                type="button"
                                className="sm-translation-retry"
                                onClick={retryTranslation}
                              >
                                <RotateCcw size={13} />
                                <span>Retry</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            <div style={{ marginBottom: '0.35rem', fontSize: '0.86rem', color: '#34d399', fontWeight: 600 }}>
                              {questionLang === 'ta' ? 'சரியான விடை:' : 'Correct Answer:'}{' '}
                              {['A', 'B', 'C', 'D'][activeQuestion.correctAnswer]}.{' '}
                              {activeQuestion.options[activeQuestion.correctAnswer] || ''}
                            </div>
                            {activeQuestion.explanation && activeQuestion.explanation.trim().length > 0 ? (
                              <p style={{ whiteSpace: 'pre-line', lineHeight: 1.65 }}>
                                <strong>{questionLang === 'ta' ? 'விளக்கம்:' : 'Explanation:'}</strong>{' '}
                                {activeQuestion.explanation}
                              </p>
                            ) : (
                              <p style={{ color: '#94a3b8' }}>
                                {questionLang === 'ta'
                                  ? 'இந்தக் கேள்விக்கான விரிவான விளக்கம் இன்னும் பதிவு செய்யப்படவில்லை.'
                                  : 'Detailed explanation is not yet recorded for this question.'}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions & Navigation Controls */}
              <div className="sm-actions-bar">
                <button
                  type="button"
                  className="sm-nav-control-btn"
                  onClick={handlePrevQuestion}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>

                {!isAnswerSubmitted ? (
                  <button
                    type="button"
                    className="sm-submit-btn"
                    onClick={handleSubmitAnswer}
                    disabled={selectedOption === null}
                  >
                    <span>Submit Answer</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="sm-submit-btn"
                    onClick={handleNextQuestion}
                  >
                    <span>
                      {currentIndex === questions.length - 1 ? 'Finish Practice' : 'Next Question'}
                    </span>
                    <ChevronRight size={16} />
                  </button>
                )}

                <button
                  type="button"
                  className="sm-nav-control-btn"
                  onClick={handleNextQuestion}
                  disabled={currentIndex === questions.length - 1 && !isAnswerSubmitted}
                >
                  <span>Skip / Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 6. Quiz Completed Summary Card */}
        {!isLoading && isQuizCompleted && (
          <motion.div
            className="sm-summary-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="sm-summary-trophy">
              <Award size={38} />
            </div>

            <h2 className="sm-summary-title">Practice Session Completed!</h2>
            <p style={{ color: '#cbd5e1', fontSize: '1rem', margin: 0, maxWidth: 500 }}>
              Great job completing the dedicated practice questions for <strong>{displayLessonTitle}</strong>!
            </p>

            <div className="sm-summary-stats-grid">
              <div className="sm-summary-stat-box">
                <span className="sm-summary-stat-val sm-stat-green">{correctCount}</span>
                <span className="sm-summary-stat-lbl">Correct Answers</span>
              </div>
              <div className="sm-summary-stat-box">
                <span className="sm-summary-stat-val sm-stat-red">
                  {answeredCount - correctCount}
                </span>
                <span className="sm-summary-stat-lbl">Incorrect</span>
              </div>
              <div className="sm-summary-stat-box">
                <span className="sm-summary-stat-val" style={{ color: 'var(--gold-primary)' }}>
                  {accuracyPercentage}%
                </span>
                <span className="sm-summary-stat-lbl">Accuracy</span>
              </div>
              <div className="sm-summary-stat-box">
                <span className="sm-summary-stat-val" style={{ color: '#38bdf8' }}>
                  {questions.length}
                </span>
                <span className="sm-summary-stat-lbl">Total MCQs</span>
              </div>
            </div>

            <div className="sm-summary-actions">
              <button className="sm-submit-btn" onClick={handleRetryPractice}>
                <RotateCcw size={16} />
                <span>Retry Practice</span>
              </button>
              <button
                className="sm-nav-btn sm-nav-btn-gold"
                onClick={handleBackToStandard}
              >
                <ArrowLeft size={16} />
                <span>Back to Lessons</span>
              </button>
              <button
                className="sm-nav-btn"
                onClick={() => setIsReviewMode(!isReviewMode)}
              >
                <HelpCircle size={16} />
                <span>{isReviewMode ? 'Hide Review' : 'Review All Questions'}</span>
              </button>
            </div>

            {/* Review Mode List */}
            {isReviewMode && (
              <div style={{ width: '100%', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                <div className="sm-question-lang-bar" role="region" aria-label="Question Language">
                  <span className="sm-question-lang-label">
                    <Languages size={15} />
                    <span>Question Language</span>
                  </span>
                  <div className="sm-lang-toggle-bar" role="group" aria-label="Select Question Language">
                    <button
                      type="button"
                      className={`sm-lang-btn ${questionLang === 'en' ? 'active' : ''}`}
                      onClick={() => setQuestionLang('en')}
                      aria-pressed={questionLang === 'en'}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      className={`sm-lang-btn ${questionLang === 'ta' ? 'active' : ''}`}
                      onClick={() => setQuestionLang('ta')}
                      aria-pressed={questionLang === 'ta'}
                    >
                      தமிழ்
                    </button>
                  </div>
                </div>
                <h3 style={{ color: '#ffffff', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                  Complete Question Review ({questions.length} Questions):
                </h3>
                {questions.map((rawQ, idx) => {
                  const ans = userAnswers[idx]
                  const t = questionLang === 'ta' ? translations[rawQ.id] : undefined
                  const q = t
                    ? { ...rawQ, question: t.question, options: t.options, explanation: t.explanation }
                    : rawQ
                  const waitingTamil = questionLang === 'ta' && !t
                  return (
                    <div
                      key={q.id}
                      style={{
                        padding: '1.25rem',
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: `1px solid ${ans?.isCorrect ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                        borderRadius: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--gold-primary)' }}>Question {idx + 1}</span>
                        <span style={{ fontSize: '0.85rem', color: ans?.isCorrect ? '#34d399' : '#f87171' }}>
                          {ans ? (ans.isCorrect ? '✓ Correct' : '✗ Incorrect') : 'Skipped'}
                        </span>
                      </div>
                      <p style={{ color: '#ffffff', fontWeight: 600, marginBottom: '0.75rem' }}>{q.question}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.9rem' }}>
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderRadius: '6px',
                              background:
                                oIdx === q.correctAnswer
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : ans?.selected === oIdx
                                    ? 'rgba(239, 68, 68, 0.2)'
                                    : 'rgba(255, 255, 255, 0.05)',
                              border:
                                oIdx === q.correctAnswer
                                  ? '1px solid #10b981'
                                  : ans?.selected === oIdx
                                    ? '1px solid #ef4444'
                                    : '1px solid rgba(255, 255, 255, 0.08)',
                              color: oIdx === q.correctAnswer ? '#34d399' : '#e2e8f0',
                            }}
                          >
                            <strong>{['A', 'B', 'C', 'D'][oIdx]}:</strong> {opt}
                          </div>
                        ))}
                      </div>
                      {waitingTamil ? (
                        <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                          {isTranslating
                            ? 'விளக்கம் தமிழில் மொழிபெயர்க்கப்படுகிறது...'
                            : 'தமிழ் விளக்கம் தற்போது கிடைக்கவில்லை.'}
                        </p>
                      ) : (
                        q.explanation && (
                          <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#cbd5e1', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                            <strong>{questionLang === 'ta' ? 'விளக்கம்:' : 'Explanation:'}</strong> {q.explanation}
                          </p>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default StudyMaterialsPractice
