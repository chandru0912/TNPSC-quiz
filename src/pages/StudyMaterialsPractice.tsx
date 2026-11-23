import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
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
  topic?: string
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

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const

const hasValidExplanation = (text?: string | null): boolean => {
  if (!text) return false
  const trimmed = text.trim()
  if (!trimmed) return false
  return trimmed.toLowerCase() !== 'no explanation provided.'
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

  // Learning Mode Navigation & Display State
  const [currentIndex, setCurrentIndex] = useState<number>(0)
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
    availableUnits.find((u) => u.id === unitId) ||
    availableUnits[0] || { id: unitId, title: `Unit ${unitId}`, unitNumber: `Unit ${unitId}` }

  const availableLessons = getLessonsForSelection(
    normalizedGroup,
    resolvedSubject.id,
    classId,
    unitId
  )
  const matchedLesson: LessonItem | undefined = availableLessons.find(
    (l) =>
      (lessonIdParam && l.id === lessonIdParam) ||
      (lessonTitleParam && l.title.trim().toLowerCase() === lessonTitleParam.trim().toLowerCase())
  )
  const resolvedLesson: LessonItem | undefined =
    matchedLesson || (lessonTitleParam || lessonIdParam ? undefined : availableLessons[0])

  const displayLessonTitle =
    lessonTitleParam || resolvedLesson?.title || availableLessons[0]?.title || 'Study Material'
  const displayLessonId = lessonIdParam || resolvedLesson?.id || availableLessons[0]?.id
  const displayLessonNumber =
    resolvedLesson?.lessonNumber || availableLessons[0]?.lessonNumber || '1.1'

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
      const g1Base =
        resolvedSubject.id === 'aptitude' ? '/materials/group1/aptitude' : '/materials/group1'
      navigate(`${g1Base}/unit/${unitId}/class/${classId}`)
    }
  }

  const handleBackToStudyMaterials = () => {
    if (normalizedGroup === 'group2') {
      navigate(`/materials/group2/${resolvedSubject.id}`)
    } else if (normalizedGroup === 'group4') {
      navigate(`/materials/group4/${resolvedSubject.id}`)
    } else {
      navigate(
        resolvedSubject.id === 'aptitude'
          ? '/materials/group1/aptitude'
          : '/materials/group1/general-studies'
      )
    }
  }

  // 2. Fetch exclusively from Study Materials Questions API
  useEffect(() => {
    let isMounted = true
    const fetchStudyMaterialsMCQs = async () => {
      setIsLoading(true)
      setFetchError(null)
      setCurrentIndex(0)
      setShowExplanation(true)

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
              setFetchError(data?.message || 'Failed to load study material questions.')
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load Study Materials questions:', err)
          setQuestions([])
          setFetchError('Unable to connect to study material question server.')
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

  const isTamilDisplay = questionLang === 'ta' && !isWaitingForTamilTranslation

  // Navigation Handlers
  const handlePrevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const correctIndex = activeQuestion?.correctAnswer ?? -1
  const correctLetter =
    correctIndex >= 0 && correctIndex < OPTION_LETTERS.length
      ? OPTION_LETTERS[correctIndex]
      : ''
  const correctOptionText =
    activeQuestion && correctIndex >= 0 && correctIndex < activeQuestion.options.length
      ? activeQuestion.options[correctIndex]
      : ''

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
                <span>Lesson {displayLessonNumber} • Study Materials — Learning Mode</span>
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
            <h2 className="sm-empty-title">Loading Study Questions...</h2>
            <p className="sm-empty-desc">
              Retrieving verified textbook questions, answers, and explanations for{' '}
              {displayLessonTitle}.
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
              No Study Questions Available for this Lesson
            </h2>
            <p className="sm-empty-desc">
              {`Study material questions for "${displayLessonTitle}" are currently being curated.`}
            </p>
            {fetchError && (
              <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                {fetchError}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button className="sm-nav-btn" onClick={handleBackToStandard}>
                <ArrowLeft size={15} />
                <span>Back to Lessons List</span>
              </button>
            </div>
          </div>
        )}

        {/* 5. Study Materials Learning Mode View */}
        {!isLoading && questions.length > 0 && activeQuestion && (
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

            {/* Learning Progress Header Card (No Score, No Timer) */}
            <div className="sm-progress-card">
              <div className="sm-progress-header">
                <span>
                  {isTamilDisplay ? (
                    <>
                      கேள்வி <strong>{currentIndex + 1}</strong> /{' '}
                      <strong>{questions.length}</strong>
                    </>
                  ) : (
                    <>
                      Question <strong>{currentIndex + 1}</strong> of{' '}
                      <strong>{questions.length}</strong>
                    </>
                  )}
                </span>
                <span className="sm-learning-mode-badge">
                  <BookOpen size={14} />
                  <span>{isTamilDisplay ? 'கற்றல் முறை' : 'Learning Mode'}</span>
                </span>
              </div>
              <div className="sm-progress-bar-track">
                <div
                  className="sm-progress-bar-fill"
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Learning Mode Question Card */}
            <motion.div
              key={activeQuestion.id}
              className="sm-question-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              {/* 1. Question Number & Metadata */}
              <div className="sm-question-header">
                <div className="sm-question-header-left">
                  <span className="sm-q-num-pill">
                    {isTamilDisplay ? `கேள்வி ${currentIndex + 1}` : `Question ${currentIndex + 1}`}
                  </span>
                  {activeQuestion.topic && (
                    <span className="sm-topic-pill">{activeQuestion.topic}</span>
                  )}
                </div>
                <span className="sm-diff-pill">{activeQuestion.difficulty || 'Medium'}</span>
              </div>

              {/* 2. Complete Question */}
              <h2 className="sm-question-text">{activeQuestion.question}</h2>

              {/* 3. Four Answer Options (A, B, C, D) — Correct Option Automatically Highlighted */}
              <div className="sm-options-list" role="list" aria-label="Answer Options">
                {activeQuestion.options.map((optionText, optIndex) => {
                  const optionLabel = OPTION_LETTERS[optIndex] || String(optIndex + 1)
                  const isCorrect = optIndex === correctIndex

                  return (
                    <div
                      key={optIndex}
                      role="listitem"
                      className={`sm-learning-option${isCorrect ? ' correct' : ''}`}
                      aria-label={`Option ${optionLabel}: ${optionText}${isCorrect ? ' (Correct Answer)' : ''}`}
                    >
                      <span className="sm-opt-badge">{optionLabel}</span>
                      <span className="sm-opt-text">{optionText}</span>
                      {isCorrect && (
                        <span className="sm-correct-indicator">
                          <CheckCircle2 size={18} />
                          <span className="sm-correct-indicator-label">
                            {isTamilDisplay ? 'சரியானது' : 'Correct'}
                          </span>
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 4 & 5. Correct Answer + Answer Section */}
              {correctLetter && (
                <div className="sm-learning-answer-card" role="region" aria-label="Correct Answer">
                  <div className="sm-learning-answer-row">
                    <span className="sm-learning-answer-label">
                      <CheckCircle2 size={17} />
                      <span>{isTamilDisplay ? 'சரியான விடை:' : 'Correct Answer:'}</span>
                    </span>
                    <span className="sm-learning-answer-badge">{correctLetter}</span>
                  </div>
                  <div className="sm-learning-answer-text-row">
                    <span className="sm-learning-answer-sublabel">
                      {isTamilDisplay ? 'விடை:' : 'Answer:'}
                    </span>
                    <span className="sm-learning-answer-value">{correctOptionText}</span>
                  </div>
                </div>
              )}

              {/* 6. Explanation Section (Visible by Default, Expand/Collapse Supported) */}
              <div className="sm-learning-explanation-card" role="region" aria-label="Explanation">
                <div className="sm-learning-explanation-header">
                  <div className="sm-learning-explanation-title">
                    <BookOpen size={16} />
                    <span>{isTamilDisplay ? 'விளக்கம்' : 'Explanation'}</span>
                  </div>
                  <button
                    type="button"
                    className="sm-explanation-toggle-btn"
                    onClick={() => setShowExplanation((prev) => !prev)}
                    aria-expanded={showExplanation}
                  >
                    <span>
                      {isTamilDisplay
                        ? showExplanation
                          ? 'மறை'
                          : 'காண்க'
                        : showExplanation
                          ? 'Hide'
                          : 'Show'}
                    </span>
                    {showExplanation ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>

                {showExplanation && (
                  <div className="sm-learning-explanation-body">
                    {isWaitingForTamilTranslation ? (
                      <div className="sm-learning-translation-wait">
                        <p>
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
                    ) : hasValidExplanation(activeQuestion.explanation) ? (
                      <p className="sm-learning-explanation-text">{activeQuestion.explanation}</p>
                    ) : (
                      <p className="sm-learning-explanation-empty">
                        {isTamilDisplay
                          ? 'இந்தக் கேள்விக்கான விரிவான விளக்கம் இன்னும் பதிவு செய்யப்படவில்லை.'
                          : 'Detailed explanation is not yet available for this question.'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Clean Learning Navigation Controls (Previous / Next only) */}
              <div className="sm-actions-bar">
                <button
                  type="button"
                  className="sm-nav-control-btn"
                  onClick={handlePrevQuestion}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft size={16} />
                  <span>{isTamilDisplay ? 'முந்தையது' : 'Previous'}</span>
                </button>

                <span className="sm-nav-position-pill">
                  {currentIndex + 1} / {questions.length}
                </span>

                {currentIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    className="sm-submit-btn sm-next-learning-btn"
                    onClick={handleNextQuestion}
                  >
                    <span>{isTamilDisplay ? 'அடுத்தது' : 'Next'}</span>
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="sm-nav-btn sm-nav-btn-gold"
                    onClick={handleBackToStandard}
                  >
                    <ArrowLeft size={16} />
                    <span>{isTamilDisplay ? 'பாடங்களுக்குத் திரும்பு' : 'Back to Lessons'}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StudyMaterialsPractice
