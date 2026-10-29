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
  Award,
  Trophy,
  BarChart2,
} from 'lucide-react'
import { apiFetch } from '../utils/api'
import { useLanguage } from '../context/LanguageContext'
import LanguageSwitch from '../components/LanguageSwitch'
import { translateQuestionItem } from '../utils/languageData'
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
  const { language, isTamil } = useLanguage()

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
  const [isQuizCompleted, setIsQuizCompleted] = useState(false)
  const [isReviewMode, setIsReviewMode] = useState(false)
  const [userAnswers, setUserAnswers] = useState<Record<number, { selected: number; isCorrect: boolean }>>({})

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
    setIsQuizCompleted(false)
    setIsReviewMode(false)
    setUserAnswers({})
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
        let res = await apiFetch(`/api/questions?${queryParams.toString()}`)
        let data = res.ok ? await res.json() : null
        let questions: QuestionItem[] = (data?.status === 'success' && Array.isArray(data?.data)) ? data.data : []
        let notice: string | null = null

        // 2. Secondary Relaxation: If 0 questions found with both classId and lesson,
        // retry matching the lesson across standards within the unit (accommodating flexible syllabus assignments)
        if (questions.length === 0 && urlClassId && urlLesson) {
          const relaxClassParams = new URLSearchParams(queryParams)
          relaxClassParams.delete('classId')
          const relaxRes = await apiFetch(`/api/questions?${relaxClassParams.toString()}`)
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

          const fallbackRes = await apiFetch(`/api/questions?${fallbackParams.toString()}`)
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
  const rawQuestion = filteredQuestions[activeQuestionIndex]
  const questionItem: QuestionItem | null = rawQuestion
    ? translateQuestionItem(rawQuestion, language)
    : null

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
    setIsQuizCompleted(false)
    setIsReviewMode(false)
    setUserAnswers({})
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
    setIsQuizCompleted(false)
    setIsReviewMode(false)
    setUserAnswers({})
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
  }

  const isLastQuestion = activeQuestionIndex === filteredQuestions.length - 1

  // Format question tag nicely according to the selected examination group and language
  const formatTag = (q: QuestionItem) => {
    const groupName = isTamil
      ? selectedGroup === 'group2_2a'
        ? 'குரூப் 2 & 2A'
        : selectedGroup === 'group4_vao'
        ? 'குரூப் 4 & VAO'
        : 'குரூப் 1'
      : selectedGroup === 'group2_2a'
      ? 'Group 2 & 2A'
      : selectedGroup === 'group4_vao'
      ? 'Group 4 & VAO'
      : 'Group 1'

    if (q.tag) {
      return isTamil
        ? q.tag.replace(/^Group 1/i, groupName).replace(/Unit/i, 'அலகு')
        : q.tag.replace(/^Group 1/i, groupName)
    }
    return isTamil
      ? `${groupName} • அலகு ${q.unitId || 1}: ${q.subject || 'பொது அறிவு'}`
      : `${groupName} • Unit ${q.unitId || 1}: ${q.subject || 'General Studies'}`
  }

  return (
    <div className="practice">
      <div className="practice-container">
        {/* Top Navigation Bar with Back buttons and Language Switch */}
        <div className="practice-top-bar">
          <div className="practice-top-nav-left">
            <button
              type="button"
              className="back-btn glass back-materials-btn"
              onClick={() => navigate('/materials')}
              aria-label={isTamil ? 'பாடக்குறிப்புகளுக்குத் திரும்புக' : 'Back to Study Materials'}
              title={isTamil ? 'முதன்மைப் பாடக்குறிப்புகள் பக்கத்திற்குச் செல்ல' : 'Navigate directly to main Study Materials page'}
            >
              <BookOpen size={16} />
              <span>{isTamil ? 'பாடக்குறிப்புகளுக்குத் திரும்புக' : 'Back to Study Materials'}</span>
            </button>

            {urlClassId ? (
              <button
                type="button"
                className="back-btn glass"
                onClick={handleBackToStandard}
                aria-label={isTamil ? 'வகுப்புப் பாடங்களுக்குத் திரும்புக' : 'Back to Standard'}
                title={urlClassId ? (isTamil ? `${urlClassId}-ஆம் வகுப்புக்குத் திரும்புக` : `Back to ${urlClassId}th Standard`) : 'Back to Standard'}
              >
                <ArrowLeft size={16} />
                <span>{isTamil ? 'வகுப்புப் பாடங்களுக்குத் திரும்புக' : 'Back to Standard'}</span>
              </button>
            ) : urlUnitId ? (
              <button
                type="button"
                className="back-btn glass"
                onClick={handleBackToStandard}
                aria-label={isTamil ? 'அலகுக்குத் திரும்புக' : 'Back to Unit'}
                title={isTamil ? 'அலகுப் பக்கத்திற்குத் திரும்புக' : 'Back to Unit'}
              >
                <ArrowLeft size={16} />
                <span>{isTamil ? 'அலகுக்குத் திரும்புக' : 'Back to Unit'}</span>
              </button>
            ) : null}
          </div>

          <LanguageSwitch variant="section" forceVisible={true} />
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
              <span>{isTamil ? 'ஊடாடும் தேர்வுப் பயிற்சி தளம்' : 'Interactive Examination Engine'}</span>
            </span>
            {isUsingLiveBank ? (
              <span className="practice-code-badge live-connected">
                <span className="live-dot">●</span>
                <span>
                  {isTamil
                    ? `நேரடி வினா வங்கி இணைக்கப்பட்டுள்ளது (${filteredQuestions.length} வினாக்கள்)`
                    : `Live Database Connected (${filteredQuestions.length} Questions)`}
                </span>
              </span>
            ) : (
              <span className="practice-code-badge">{isTamil ? 'TNPSC வினாடி-வினா' : 'TNPSC Quizzes'}</span>
            )}
          </div>

          <h1 className="practice-title">
            <FileText size={32} />
            <span>
              {isTamil ? (
                <>பயிற்சி <span className="gradient-text">வினாக்களும் வினாடி-வினாவும்</span></>
              ) : (
                <>MCQ <span className="gradient-text">Practice & Quizzes</span></>
              )}
            </span>
          </h1>
          <p className="practice-subtitle">
            {isTamil
              ? 'சமச்சீர் கல்விப் பாடத்திட்டத்தின்படி TNPSC குரூப் 1, குரூப் 2 & 2A மற்றும் குரூப் 4 வினாக்கள்'
              : 'Curated Samacheer Kalvi topic-wise questions organized by TNPSC Group 1, TNPSC Group 2 & 2A, and TNPSC Group 4'}
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
              {isTamil
                ? `வினா ${filteredQuestions.length > 0 ? activeQuestionIndex + 1 : 0} / ${filteredQuestions.length}`
                : `Question ${filteredQuestions.length > 0 ? activeQuestionIndex + 1 : 0} of ${filteredQuestions.length}`}
            </span>
          </div>
          <div className="practice-stat-card glass">
            <CheckCircle2 size={18} />
            <span>
              {isTamil ? `மதிப்பெண்: ${score} / ${answeredQuestions}` : `Score: ${score} / ${answeredQuestions}`}
            </span>
          </div>
          <div className="practice-stat-card glass">
            <Layers size={18} />
            <span>
              {isTamil
                ? selectedGroup === 'group2' || selectedGroup === 'group2a' || selectedGroup === 'group2_2a'
                  ? 'TNPSC குரூப் 2 & 2A'
                  : selectedGroup === 'group4' || selectedGroup === 'vao' || selectedGroup === 'group4_vao'
                  ? 'TNPSC குரூப் 4 & VAO'
                  : 'TNPSC குரூப் 1'
                : selectedGroup === 'group2' || selectedGroup === 'group2a' || selectedGroup === 'group2_2a'
                ? 'TNPSC Group 2 & 2A'
                : selectedGroup === 'group4' || selectedGroup === 'vao' || selectedGroup === 'group4_vao'
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
                <span>{isTamil ? 'மதிப்பீடு நிறைவுற்றது' : 'Assessment Completed'}</span>
              </span>
              <h2 className="completion-title">{isTamil ? 'பயிற்சி நிறைவடைந்தது!' : 'Quiz Completed!'}</h2>
              <p className="completion-subtitle">
                {isTamil
                  ? selectedGroup === 'group2_2a'
                    ? 'TNPSC குரூப் 2 & 2A'
                    : selectedGroup === 'group4' || selectedGroup === 'vao' || selectedGroup === 'group4_vao'
                    ? 'TNPSC குரூப் 4 & VAO'
                    : 'TNPSC குரூப் 1'
                  : selectedGroup === 'group2_2a'
                  ? 'TNPSC Group 2 & 2A'
                  : selectedGroup === 'group4' || selectedGroup === 'vao' || selectedGroup === 'group4_vao'
                  ? 'TNPSC Group 4 & VAO'
                  : 'TNPSC Group 1'}
                {activeUnitFilter ? (isTamil ? ` • அலகு ${activeUnitFilter}` : ` • Unit ${activeUnitFilter}`) : ''}
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
                  {Math.round((score / Math.max(1, filteredQuestions.length)) * 100)}% {isTamil ? 'துல்லியம்' : 'Accuracy'}
                </span>
              </div>
              <div className="score-evaluation-text">
                {Math.round((score / Math.max(1, filteredQuestions.length)) * 100) >= 80 ? (
                  <span className="eval-outstanding">
                    {isTamil
                      ? '🌟 மிகச் சிறந்த செயல்திறன்! TNPSC முதல்நிலைத் தேர்வுக்கு உன்னதமான தயாரிப்பு.'
                      : '🌟 Outstanding Performance! Excellent preparation for TNPSC prelims.'}
                  </span>
                ) : Math.round((score / Math.max(1, filteredQuestions.length)) * 100) >= 60 ? (
                  <span className="eval-good">
                    {isTamil
                      ? '🎯 நன்று! தவறவிட்ட வினாக்களை மீண்டும் படித்துக் கருத்துகளை வலுப்படுத்துங்கள்.'
                      : '🎯 Good Job! Review the missed questions to reinforce key concepts.'}
                  </span>
                ) : (
                  <span className="eval-practice">
                    {isTamil
                      ? '📖 தொடர்ந்து பயிற்சி செய்க! பாடத்திட்டக் குறிப்புகளைப் படித்து மீண்டும் முயற்சி செய்க.'
                      : '📖 Keep Practicing! Read the syllabus study notes and re-attempt.'}
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
                  <span className="stat-label">{isTamil ? 'சரியானவை' : 'Correct'}</span>
                </div>
              </div>
              <div className="completion-stat-tile glass stat-incorrect">
                <XCircle size={22} className="stat-icon-wrong" />
                <div>
                  <span className="stat-num">{Math.max(0, answeredQuestions - score)}</span>
                  <span className="stat-label">{isTamil ? 'தவறானவை' : 'Incorrect'}</span>
                </div>
              </div>
              <div className="completion-stat-tile glass stat-total">
                <BarChart2 size={22} className="stat-icon-total" />
                <div>
                  <span className="stat-num">{filteredQuestions.length}</span>
                  <span className="stat-label">{isTamil ? 'மொத்த வினாக்கள்' : 'Total Questions'}</span>
                </div>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="completion-actions">
              <button className="btn btn-secondary review-answers-btn" onClick={handleStartReview}>
                <FileText size={18} />
                <span>{isTamil ? 'அனைத்து விடைகளையும் மதிப்பாய்வு செய்' : 'Review All Answers'}</span>
              </button>
              <button className="btn btn-primary retake-btn" onClick={handleReset}>
                <RotateCcw size={18} />
                <span>{isTamil ? 'மீண்டும் தேர்வு எழுதுக' : 'Retake Quiz'}</span>
              </button>
              <button className="btn btn-secondary back-mats-btn" onClick={() => navigate('/materials')}>
                <BookOpen size={18} />
                <span>{isTamil ? 'பாடக்குறிப்புகளுக்குத் திரும்புக' : 'Back to Study Materials'}</span>
              </button>
            </div>
          </motion.div>
        ) : isInitialLoading ? (
          <div className="empty-practice-state glass">
            <div className="empty-icon-wrap">
              <Timer size={36} className="empty-icon" />
            </div>
            <h3>{isTamil ? 'பயிற்சி வினாக்கள் ஏற்றப்படுகின்றன...' : 'Loading Practice Questions...'}</h3>
            <p>{isTamil ? 'பாடத்திட்ட அடிப்படையிலான வினாக்கள் வினா வங்கியிலிருந்து பெறப்படுகின்றன.' : 'Fetching syllabus-verified MCQs from the question bank.'}</p>
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
                      {isTamil
                        ? `மதிப்பாய்வு முறை • வினா ${activeQuestionIndex + 1} / ${filteredQuestions.length}`
                        : `Review Mode • Question ${activeQuestionIndex + 1} of ${filteredQuestions.length}`}
                    </span>
                    <span className="review-score-preview">
                      {isTamil ? `மதிப்பெண்: ${score}/${filteredQuestions.length}` : `Score: ${score}/${filteredQuestions.length}`}
                    </span>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm back-scorecard-btn" onClick={handleBackToScorecard}>
                    <Award size={15} />
                    <span>{isTamil ? 'மதிப்பெண் அட்டைக்குத் திரும்பு' : 'Back to Scorecard'}</span>
                  </button>
                </div>
              )}

              <div className="question-header">
                <span className="question-category-tag">{formatTag(questionItem)}</span>
                <span className="question-number">
                  {isTamil
                    ? `வினா ${activeQuestionIndex + 1} / ${filteredQuestions.length}`
                    : `Q ${activeQuestionIndex + 1} of ${filteredQuestions.length}`}
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
                <div className="action-group-left">
                  {activeQuestionIndex > 0 && (
                    <button type="button" className="btn btn-secondary prev-btn" onClick={handlePrev}>
                      <ArrowLeft size={18} />
                      <span>{isTamil ? 'முந்தைய வினா' : 'Previous'}</span>
                    </button>
                  )}
                </div>

                <div className="action-group-right">
                  {!showResult ? (
                    <button
                      className="btn btn-primary submit-btn"
                      onClick={handleSubmit}
                      disabled={selectedAnswer === null}
                    >
                      <span>{isTamil ? 'விடையைச் சமர்ப்பி' : 'Submit Answer'}</span>
                      <ArrowRight size={18} />
                    </button>
                  ) : (
                    <div className="next-action-group">
                      {!isLastQuestion ? (
                        <button className="btn btn-primary next-btn" onClick={handleNext}>
                          <span>{isTamil ? 'அடுத்த வினா' : 'Next Question'}</span>
                          <ArrowRight size={18} />
                        </button>
                      ) : (
                        <button className="btn btn-primary complete-btn" onClick={handleFinishQuiz}>
                          <Award size={18} />
                          <span>{isTamil ? 'முடித்து மதிப்பெண்ணைக் காண்க' : 'Finish & View Scorecard'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
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
                      {selectedAnswer === questionItem.correctAnswer
                        ? (isTamil ? 'சரியான விடை!' : 'Correct!')
                        : (isTamil ? 'தவறான விடை' : 'Incorrect')}
                    </span>
                    <span className="correct-answer-label">
                      {isTamil
                        ? `சரியான விடை: விருப்பம் ${String.fromCharCode(65 + questionItem.correctAnswer)}`
                        : `Correct Answer: Option ${String.fromCharCode(65 + questionItem.correctAnswer)}`}
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
                      <strong style={{ color: '#38bdf8' }}>{isTamil ? 'பாடநூல் ஆதாரம்:' : 'Source Reference:'}</strong>{' '}
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
            <h3>{isTamil ? 'பயிற்சி வினாக்கள் ஏதுமில்லை' : 'No Practice MCQs Available'}</h3>
            <p>
              {urlLesson ? (
                <>
                  {isTamil
                    ? `பாடப்பிரிவு "${decodeURIComponent(urlLesson)}" க்கான வினாக்கள் எதுவும் கண்டறியப்படவில்லை.`
                    : <>No questions found for <strong>{decodeURIComponent(urlLesson)}</strong> in {urlClassId ? `${urlClassId}th Standard ` : ''}Unit {activeUnitFilter}.</>}
                </>
              ) : urlClassId ? (
                <>
                  {isTamil
                    ? `${urlClassId}ஆம் வகுப்பிற்கான வினாக்கள் இன்னும் சேர்க்கப்படவில்லை.`
                    : <>No questions mapped yet for <strong>{urlClassId}th Standard</strong>{activeUnitFilter ? ` Unit ${activeUnitFilter}` : ''}.</>}
                </>
              ) : activeUnitFilter ? (
                <>
                  {isTamil
                    ? `அலகு ${activeUnitFilter}-க்கான வினாக்கள் இன்னும் சேர்க்கப்படவில்லை.`
                    : <>No questions mapped yet for <strong>Unit {activeUnitFilter}</strong>.</>}
                </>
              ) : (
                <>{isTamil ? 'தேர்வு வடிகட்டலின்படி வினாக்கள் ஏதுமில்லை.' : 'No practice questions found for the selected examination filter.'}</>
              )}
            </p>
            <div className="empty-actions">
              {(activeUnitFilter || urlClassId || urlLesson) && (
                <button className="btn btn-primary" onClick={clearUnitFilter}>
                  <RotateCcw size={16} />
                  <span>{isTamil ? 'அனைத்து பொது அறிவு வினாக்களையும் காண்க' : 'View All General Studies Questions'}</span>
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => navigate('/materials')}>
                <BookOpen size={16} />
                <span>{isTamil ? 'பாடக்குறிப்புகளுக்குத் திரும்புக' : 'Back to Study Materials'}</span>
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
              {isTamil ? 'திரும்புக: ' : 'Back to '}
              {selectedGroup === 'group2' || selectedGroup === 'group2a' || selectedGroup === 'group2_2a'
                ? (isTamil ? 'குரூப் 2 & 2A பாடக்குறிப்புகள்' : 'TNPSC Group 2 & 2A Study Materials')
                : selectedGroup === 'group4' || selectedGroup === 'vao' || selectedGroup === 'group4_vao'
                ? (isTamil ? 'குரூப் 4 பாடக்குறிப்புகள்' : 'TNPSC Group 4 Study Materials')
                : (isTamil ? 'குரூப் 1 பொது அறிவு' : 'Group 1 General Studies')}
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default MCQPractice
