import { useState, useEffect } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
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
} from 'lucide-react'
import './MCQPractice.css'

interface QuestionItem {
  id: number | string
  category: 'group1' | 'group2_2a' | 'group4_vao'
  subCategory?: 'group2' | 'group2a' | 'group4' | 'vao' | 'both'
  unitId?: number
  classId?: number
  subject?: string
  lessonTitle?: string
  topic?: string
  difficulty?: 'Easy' | 'Medium' | 'Hard'
  tag: string
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  sourceReference?: string
}

const MCQPractice = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const urlGroup = searchParams.get('group')
  const urlSubjectId = searchParams.get('subjectId') || 'general-studies'
  const urlUnitId = searchParams.get('unitId') ? parseInt(searchParams.get('unitId')!, 10) : null
  const urlUnitTitle = searchParams.get('unitTitle')
  const urlLesson = searchParams.get('lesson')
  const urlTopic = searchParams.get('topic')
  const urlClassId = searchParams.get('classId') ? parseInt(searchParams.get('classId')!, 10) : null

  const [selectedGroup, setSelectedGroup] = useState<string>(
    urlGroup || 'group1'
  )
  const [activeUnitFilter, setActiveUnitFilter] = useState<number | null>(urlUnitId)

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
      if (urlUnitId && urlClassId) {
        navigate(`/materials/group1/unit/${urlUnitId}/class/${urlClassId}`)
      } else if (urlClassId) {
        navigate(`/materials/group1/class/${urlClassId}`)
      } else if (urlUnitId) {
        navigate(`/materials/group1/unit/${urlUnitId}`)
      } else {
        navigate('/materials/group1/general-studies')
      }
    }
  }

  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [answeredQuestions, setAnsweredQuestions] = useState(0)

  // Live Database Questions & Connection State
  const [dbQuestions, setDbQuestions] = useState<QuestionItem[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true)
  const [isUsingLiveBank, setIsUsingLiveBank] = useState<boolean>(false)
  const [activeFilterNotice, setActiveFilterNotice] = useState<string | null>(null)

  useEffect(() => {
    setSelectedGroup(urlGroup || 'group1')
    setActiveUnitFilter(urlUnitId)
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
    setAnsweredQuestions(0)
  }, [urlGroup, urlUnitId, urlClassId, urlLesson, urlTopic])

  // Fetch directly from PostgreSQL Questions API with multi-tier progressive matching
  useEffect(() => {
    let isMounted = true
    const fetchQuestions = async () => {
      try {
        const queryParams = new URLSearchParams()
        if (selectedGroup) queryParams.set('category', selectedGroup)
        if (activeUnitFilter) queryParams.set('unitId', activeUnitFilter.toString())
        if (urlClassId) queryParams.set('classId', urlClassId.toString())
        if (urlLesson) queryParams.set('lesson', urlLesson)
        if (urlTopic) queryParams.set('topic', urlTopic)
        if (urlSubjectId && urlSubjectId !== 'general-studies' && urlSubjectId !== 'all') {
          queryParams.set('subject', urlSubjectId)
        }
        queryParams.set('limit', '300')

        // 1. Primary Query: Exact Lesson + Class + Unit matching
        let res = await fetch(`/api/questions?${queryParams.toString()}`)
        let data = res.ok ? await res.json() : null
        let questions: QuestionItem[] = (data?.status === 'success' && Array.isArray(data?.data)) ? data.data : []
        let notice: string | null = null

        // 2. Secondary Relaxation: If 0 questions found with both classId and lesson,
        // retry matching the lesson across standards within the unit (accommodating flexible syllabus assignments)
        if (questions.length === 0 && urlClassId && urlLesson) {
          const relaxClassParams = new URLSearchParams(queryParams)
          relaxClassParams.delete('classId')
          const relaxRes = await fetch(`/api/questions?${relaxClassParams.toString()}`)
          if (relaxRes.ok) {
            const relaxData = await relaxRes.json()
            if (relaxData.status === 'success' && Array.isArray(relaxData.data) && relaxData.data.length > 0) {
              questions = relaxData.data
              notice = `Found ${questions.length} questions for "${urlLesson}" across standards`
            }
          }
        }

        // 3. Tertiary Relaxation: If this exact lesson has no dedicated questions in DB yet,
        // but an active unit is selected, pull available questions for the Unit so students can practice!
        if (questions.length === 0 && activeUnitFilter) {
          const fallbackParams = new URLSearchParams()
          if (selectedGroup) fallbackParams.set('category', selectedGroup)
          fallbackParams.set('unitId', activeUnitFilter.toString())
          if (urlClassId) fallbackParams.set('classId', urlClassId.toString())
          fallbackParams.set('limit', '300')

          const fallbackRes = await fetch(`/api/questions?${fallbackParams.toString()}`)
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json()
            if (fallbackData.status === 'success' && Array.isArray(fallbackData.data) && fallbackData.data.length > 0) {
              questions = fallbackData.data
              notice = `Specific questions for "${urlLesson || 'this lesson'}" coming soon. Displaying ${questions.length} questions for Unit ${activeUnitFilter}.`
            }
          }
        }

        if (isMounted) {
          if (questions.length > 0) {
            // Deduplicate by question ID to ensure uniqueness
            const unique = Array.from(
              new Map(questions.map((q: QuestionItem) => [q.id, q])).values()
            ) as QuestionItem[]
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
  }, [selectedGroup, activeUnitFilter, urlClassId, urlLesson, urlTopic, urlSubjectId])

  const groups = [
    { id: 'group1', name: 'TNPSC Group 1' },
    { id: 'group2_2a', name: 'TNPSC Group 2 & 2A' },
    { id: 'group4', name: 'TNPSC Group 4' },
  ]

  // Pure database questions (all mock fallback questions completely removed)
  const filteredQuestions: QuestionItem[] = dbQuestions

  // Safe fallback if index exceeds filtered questions
  const activeQuestionIndex = Math.min(currentQuestion, Math.max(0, filteredQuestions.length - 1))
  const questionItem = filteredQuestions[activeQuestionIndex]

  const handleGroupSelect = (group: string) => {
    if (group === selectedGroup) return
    setSelectedGroup(group)
    const newParams = new URLSearchParams(searchParams)
    newParams.set('group', group)
    setSearchParams(newParams, { replace: true })
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
    setAnsweredQuestions(0)
  }

  const clearUnitFilter = () => {
    setActiveUnitFilter(null)
    const newParams = new URLSearchParams()
    newParams.set('group', selectedGroup)
    setSearchParams(newParams, { replace: true })
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
    setAnsweredQuestions(0)
  }

  const handleAnswerSelect = (index: number) => {
    if (showResult) return
    setSelectedAnswer(index)
  }

  const handleSubmit = () => {
    if (selectedAnswer === null || !questionItem) return
    setShowResult(true)
    setAnsweredQuestions(answeredQuestions + 1)
    if (selectedAnswer === questionItem.correctAnswer) {
      setScore(score + 1)
    }
  }

  const handleNext = () => {
    if (activeQuestionIndex < filteredQuestions.length - 1) {
      setCurrentQuestion(activeQuestionIndex + 1)
      setSelectedAnswer(null)
      setShowResult(false)
    }
  }

  const handleReset = () => {
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
    setAnsweredQuestions(0)
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
        {/* Top-Left Back Navigation Bar */}
        <div className="practice-top-bar">
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
                <span>Live Database Connected ({filteredQuestions.length} Questions)</span>
              </span>
            ) : (
              <span className="practice-code-badge">TNPSC Quizzes</span>
            )}
          </div>

          <h1 className="practice-title">
            <FileText size={32} />
            <span>
              MCQ <span className="gradient-text">Practice & Quizzes</span>
            </span>
          </h1>
          <p className="practice-subtitle">
            Curated Samacheer Kalvi topic-wise questions organized by TNPSC Group 1, TNPSC Group 2 & 2A, and TNPSC Group 4
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
            const isActive =
              group.id === 'group2_2a'
                ? selectedGroup === 'group2_2a' || selectedGroup === 'group2' || selectedGroup === 'group2a'
                : group.id === 'group4'
                ? selectedGroup === 'group4' || selectedGroup === 'vao' || selectedGroup === 'group4_vao'
                : selectedGroup === 'group1'

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

        {/* Stats HUD */}
        <div className="practice-stats">
          <div className="practice-stat-card glass">
            <Timer size={18} />
            <span>
              Question {filteredQuestions.length > 0 ? activeQuestionIndex + 1 : 0} of {filteredQuestions.length}
            </span>
          </div>
          <div className="practice-stat-card glass">
            <CheckCircle2 size={18} />
            <span>
              Score: {score} / {answeredQuestions}
            </span>
          </div>
          <div className="practice-stat-card glass">
            <Layers size={18} />
            <span>
              {selectedGroup === 'group2' || selectedGroup === 'group2a' || selectedGroup === 'group2_2a'
                ? 'TNPSC Group 2 & 2A'
                : selectedGroup === 'group4' || selectedGroup === 'vao' || selectedGroup === 'group4_vao'
                ? 'TNPSC Group 4'
                : 'TNPSC Group 1'}
            </span>
          </div>
        </div>

        {/* Question Card / Empty State */}
        {isInitialLoading ? (
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
              <div className="question-header">
                <span className="question-category-tag">{formatTag(questionItem)}</span>
                <span className="question-number">
                  Q {activeQuestionIndex + 1} of {filteredQuestions.length}
                </span>
              </div>

              <h2 className="question-text">{questionItem.question}</h2>

              <div className="options-list">
                {questionItem.options.map((option, index) => {
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
                {!showResult ? (
                  <button
                    className="btn btn-primary submit-btn"
                    onClick={handleSubmit}
                    disabled={selectedAnswer === null}
                  >
                    <span>Submit Answer</span>
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <div className="next-action-group">
                    {!isLastQuestion ? (
                      <button className="btn btn-primary next-btn" onClick={handleNext}>
                        <span>Next Question</span>
                        <ArrowRight size={18} />
                      </button>
                    ) : (
                      <button className="btn btn-primary restart-btn" onClick={handleReset}>
                        <RotateCcw size={18} />
                        <span>Restart Quiz</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Explanation Card */}
              {showResult && (
                <motion.div
                  className={`explanation-box ${
                    selectedAnswer === questionItem.correctAnswer ? 'explanation-correct' : 'explanation-wrong'
                  }`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="explanation-header">
                    <span className="explanation-status">
                      {selectedAnswer === questionItem.correctAnswer ? 'Correct!' : 'Incorrect'}
                    </span>
                    <span className="correct-answer-label">
                      Correct Answer: Option {String.fromCharCode(65 + questionItem.correctAnswer)}
                    </span>
                  </div>
                  <p className="explanation-text">{questionItem.explanation}</p>
                  {questionItem.sourceReference && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        fontSize: '0.85rem',
                        color: '#94a3b8',
                        borderTop: '1px dashed rgba(255,255,255,0.1)',
                        paddingTop: '0.5rem',
                      }}
                    >
                      <strong style={{ color: '#38bdf8' }}>Source Reference:</strong>{' '}
                      {questionItem.sourceReference}
                    </div>
                  )}
                </motion.div>
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
                <>
                  No questions found for <strong>{decodeURIComponent(urlLesson)}</strong> in{' '}
                  {urlClassId ? `${urlClassId}th Standard ` : ''}Unit {activeUnitFilter}.
                </>
              ) : urlClassId ? (
                <>
                  No questions mapped yet for <strong>{urlClassId}th Standard</strong>
                  {activeUnitFilter ? ` Unit ${activeUnitFilter}` : ''}.
                </>
              ) : activeUnitFilter ? (
                <>
                  No questions mapped yet for <strong>Unit {activeUnitFilter}</strong>.
                </>
              ) : (
                <>No practice questions found for the selected examination filter.</>
              )}
            </p>
            <div className="empty-actions">
              {(activeUnitFilter || urlClassId || urlLesson) && (
                <button className="btn btn-primary" onClick={clearUnitFilter}>
                  <RotateCcw size={16} />
                  <span>View All General Studies Questions</span>
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => navigate('/materials')}>
                <BookOpen size={16} />
                <span>Back to Study Materials</span>
              </button>
            </div>
          </div>
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
