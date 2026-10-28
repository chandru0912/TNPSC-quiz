import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useScrollLock } from '../hooks/useScrollLock'

import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
  Layers,
  Sparkles,
  Atom,
  Globe2,
  Landmark,
  Scale,
  TrendingUp,
  ScrollText,
  CheckCircle2,
  FileQuestion,
  X,
  XCircle,
  RotateCcw,
  Award,
  Lightbulb,
} from 'lucide-react'
import {
  getGroup2UnitClassData,
  standardClasses,
  type Group2SchoolLesson,
} from '../data/group2ClassSyllabusData'
import { getGroup2SubjectById } from '../data/group2SyllabusData'
import { getLessonNotes, type LessonNotesDeck } from '../data/studyNotesData'
import './Group1UnitClass.css'
import './Group1Lessons.css'

const unitIcons: Record<number, any> = {
  1: Atom,
  2: Globe2,
  3: Landmark,
  4: Scale,
  5: TrendingUp,
  6: ScrollText,
  7: Sparkles,
}

const Group2UnitClass = () => {
  const { subjectId, unitId, classId } = useParams<{
    subjectId: string
    unitId?: string
    classId: string
  }>()
  const navigate = useNavigate()

  const activeSubjectId = subjectId || 'general-studies'
  const parsedUnitId = parseInt(unitId || '1', 10)
  const parsedClassId = parseInt(classId || '6', 10)

  const subject = getGroup2SubjectById(activeSubjectId)
  const data = getGroup2UnitClassData(activeSubjectId, parsedUnitId, parsedClassId)
  const Icon = unitIcons[parsedUnitId] || BookOpen
  const lessons = data.lessons || []
  const hasLessons = lessons.length > 0

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (document.documentElement) document.documentElement.scrollTop = 0
    if (document.body) document.body.scrollTop = 0
  }, [activeSubjectId, parsedUnitId, parsedClassId])

  // Interactive Modal State
  const [activeModalLesson, setActiveModalLesson] = useState<Group2SchoolLesson | null>(null)
  const [activeModalTab, setActiveModalTab] = useState<'notes' | 'quiz'>('notes')
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({})

  // Lock background scroll when interactive lesson modal is open
  useScrollLock(Boolean(activeModalLesson))



  // Handle keyboard navigation in reader modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeModalLesson || activeModalTab !== 'notes') return
      if (e.key === 'ArrowRight') {
        setCurrentSlideIndex((prev) => Math.min(prev + 1, 3))
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Escape') {
        setActiveModalLesson(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeModalLesson, activeModalTab])

  const handleOpenLesson = (lesson: Group2SchoolLesson, tab: 'notes' | 'quiz') => {
    setActiveModalLesson(lesson)
    setActiveModalTab(tab)
    setCurrentSlideIndex(0)
    setSelectedAnswers({})
  }

  const handleOptionSelect = (qId: string, optIdx: number) => {
    if (selectedAnswers[qId] !== undefined) return
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optIdx }))
  }

  const handleResetQuiz = () => {
    setSelectedAnswers({})
  }

  // Active study notes deck
  const activeDeck: LessonNotesDeck | null = activeModalLesson
    ? getLessonNotes(
        data.unitId,
        data.classId,
        data.unitNumber,
        data.unitTitle,
        data.classTitle,
        data.subjectName,
        activeModalLesson
      )
    : null

  const currentSlide = activeDeck ? activeDeck.slides[currentSlideIndex] : null

  // Quiz Score calculation
  const totalQuestions = activeModalLesson?.practiceMCQs?.length || 0
  const answeredCount = activeModalLesson?.practiceMCQs?.filter(
    (q) => selectedAnswers[q.id] !== undefined
  ).length || 0
  const correctCount = activeModalLesson?.practiceMCQs?.filter(
    (q) => selectedAnswers[q.id] === q.correctAnswer
  ).length || 0
  const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

  return (
    <div className="unit-class-page">
      <div className="unit-class-container">
        {/* Breadcrumb Navigation */}
        <div className="unit-class-breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={14} />
          <Link to="/materials?group=group2_2a">Study Materials</Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group2/${activeSubjectId}`}>
            {subject?.title || data.subjectTitle}
          </Link>
          <ChevronRight size={14} />
          <span className="active">
            {data.unitNumber} – {data.classTitle}
          </span>
        </div>

        {/* Top Back Navigation Bar */}
        <div className="unit-class-top-bar">
          <Link to={`/materials/group2/${activeSubjectId}`} className="back-btn glass">
            <ArrowLeft size={16} />
            <span>Back to {subject?.title || 'General Studies'}</span>
          </Link>

          <Link
            to={`/materials/group2/${activeSubjectId}/unit/${parsedUnitId}`}
            className="back-btn glass"
          >
            <BookOpen size={16} />
            <span>View Full {data.unitNumber} Syllabus</span>
          </Link>
        </div>

        {/* Hero Card */}
        <motion.div
          className="unit-class-hero glass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="unit-class-hero-badges">
            <span className="hero-badge hero-badge-gold">
              <Sparkles size={13} />
              TNPSC Group 2 & 2A {subject?.title}
            </span>
            <span className="hero-badge hero-badge-cyan">{data.unitNumber}</span>
            <span className="hero-badge hero-badge-purple">
              <GraduationCap size={14} />
              {data.classTitle}
            </span>
            <span className="hero-badge hero-badge-sub">Samacheer Kalvi</span>
          </div>

          <div className="unit-class-hero-main">
            <div className="unit-class-icon-box">
              <Icon size={34} />
            </div>
            <div className="unit-class-title-group">
              <h1 className="unit-class-hero-title">
                {data.unitNumber}: {data.unitTitle} –{' '}
                <span className="gold-text">{data.classTitle}</span>
              </h1>
              <p className="unit-class-hero-sub">
                Official Samacheer Kalvi Tamil Nadu State Board textbook curriculum aligned with TNPSC
                Preliminary Syllabus (Code: 495).
              </p>
            </div>
          </div>

          {/* Quick Switchers: Classes and Units */}
          <div className="switchers-wrapper glass">
            {/* Standard Switcher (6th to 12th) */}
            <div className="switcher-row">
              <span className="switcher-label">Select Standard:</span>
              <div className="switcher-pills">
                {standardClasses.map((cls) => {
                  const isActive = cls.id === parsedClassId
                  return (
                    <button
                      key={cls.id}
                      className={`switcher-pill ${isActive ? 'active' : ''}`}
                      onClick={() =>
                        navigate(
                          `/materials/group2/${activeSubjectId}/unit/${parsedUnitId}/class/${cls.id}`
                        )
                      }
                    >
                      {cls.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Unit Switcher */}
            <div className="switcher-row">
              <span className="switcher-label">Select Unit:</span>
              <div className="switcher-pills">
                {(subject?.units || []).map((u) => {
                  const isActive = u.id === parsedUnitId
                  return (
                    <button
                      key={u.id}
                      className={`switcher-pill unit-pill ${isActive ? 'active' : ''}`}
                      onClick={() =>
                        navigate(
                          `/materials/group2/${activeSubjectId}/unit/${u.id}/class/${parsedClassId}`
                        )
                      }
                      title={u.title}
                    >
                      {u.unitNumber}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Mapped Syllabus Scope for this Standard */}
        {data.topics && data.topics.length > 0 && (
          <motion.div
            className="unit-class-topics-box glass"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="topics-box-header">
              <div className="topics-box-title">
                <BookOpen size={18} />
                <span>Textbook Syllabus & Focus Areas ({data.classTitle})</span>
              </div>
              <span className="topics-count-badge">{data.topics.length} Key Topics</span>
            </div>

            <div className="topics-chips-list">
              {data.topics.map((topic, idx) => (
                <div key={idx} className="topic-chip">
                  <span className="topic-chip-num">{idx + 1}</span>
                  <span className="topic-chip-text">{topic}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Lessons Section */}
        <div className="unit-class-lessons-section">
          <div className="section-head-bar">
            <div>
              <h2 className="section-title">
                Curated Lessons for {data.classTitle}
              </h2>
              <p className="section-sub">
                Samacheer Kalvi school textbook chapters mapped to {data.unitTitle}
              </p>
            </div>
            {hasLessons && (
              <span className="lessons-count-pill">
                <Layers size={14} />
                {lessons.length} Lessons Available
              </span>
            )}
          </div>

          {hasLessons ? (
            <div className="lessons-grid">
              {lessons.map((lesson: Group2SchoolLesson, index: number) => {
                const practiceUrl = `/practice?group=group2_2a&subjectId=${activeSubjectId}&unitId=${data.unitId}&unitTitle=${encodeURIComponent(
                  data.unitTitle
                )}&lesson=${encodeURIComponent(lesson.title)}&classId=${data.classId}`

                return (
                  <motion.div
                    key={lesson.id}
                    className="lesson-card glass"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: index * 0.05 }}
                  >
                    <div className="lesson-top-meta">
                      <span className="lesson-num-badge">Lesson {lesson.lessonNumber}</span>
                      {lesson.term && <span className="lesson-term-badge">{lesson.term}</span>}
                      <span className="lesson-status-badge">
                        <CheckCircle2 size={12} />
                        {lesson.status}
                      </span>
                    </div>

                    <h3 className="lesson-title">{lesson.title}</h3>

                    {lesson.description && (
                      <p className="lesson-desc">{lesson.description}</p>
                    )}

                    <div className="lesson-action-row">
                      <button
                        className="lesson-read-btn"
                        onClick={() => handleOpenLesson(lesson, 'notes')}
                        title={`Open interactive study notes for ${lesson.title}`}
                      >
                        <FileQuestion size={15} />
                        <span>Read Study Notes</span>
                      </button>
                      <Link
                        to={practiceUrl}
                        className="lesson-practice-btn"
                        title="Practice MCQs for this lesson"
                      >
                        <span>Practice MCQs</span>
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <motion.div
              className="empty-lessons-box glass"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="empty-icon-circle">
                <BookOpen size={30} />
              </div>
              <h3 className="empty-heading">Lessons coming soon.</h3>
              <p className="empty-subtext">
                Comprehensive Samacheer Kalvi lesson notes and chapter-wise question banks for{' '}
                <strong>
                  {data.unitTitle} ({data.classTitle})
                </strong>{' '}
                are currently being curated by subject experts according to the official TNPSC Group 2 & 2A syllabus.
              </p>
              <div className="empty-actions">
                <Link to="/practice" className="btn btn-primary">
                  <FileQuestion size={16} />
                  <span>Practice General Studies MCQs</span>
                </Link>
                <Link to={`/materials/group2/${activeSubjectId}`} className="btn btn-secondary">
                  <ArrowLeft size={16} />
                  <span>Choose Another Standard</span>
                </Link>
              </div>
            </motion.div>
          )}
        </div>

        {/* Back navigation footer */}
        <div className="unit-class-footer-nav">
          <Link to={`/materials/group2/${activeSubjectId}`} className="back-btn glass">
            <ArrowLeft size={16} />
            <span>Back to {subject?.title || 'General Studies'} Main Page</span>
          </Link>
        </div>

        {/* Interactive Modal Drawer for Study Notes & Practice MCQs */}
        <AnimatePresence>
          {activeModalLesson && (
            <div
              className="lesson-modal-overlay"
              onClick={() => setActiveModalLesson(null)}
            >
              <motion.div
                className="lesson-modal glass"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-head">
                  <div className="modal-title-group">
                    <span className="modal-code-pill">
                      {data.classTitle} • Lesson {activeModalLesson.lessonNumber}
                    </span>
                    <h3 className="modal-title">{activeModalLesson.title}</h3>
                  </div>

                  <button
                    className="modal-close-btn"
                    onClick={() => setActiveModalLesson(null)}
                    aria-label="Close modal"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="g2-modal-tabs" style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
                  <button
                    className={`switcher-pill ${activeModalTab === 'notes' ? 'active' : ''}`}
                    onClick={() => setActiveModalTab('notes')}
                  >
                    <BookOpen size={15} style={{ display: 'inline', marginRight: '6px' }} />
                    Study Notes & Summary
                  </button>
                  <button
                    className={`switcher-pill ${activeModalTab === 'quiz' ? 'active' : ''}`}
                    onClick={() => setActiveModalTab('quiz')}
                  >
                    <Sparkles size={15} style={{ display: 'inline', marginRight: '6px' }} />
                    Practice Quiz ({activeModalLesson.practiceMCQs?.length || 0} Questions)
                  </button>
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  {activeModalTab === 'notes' ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {/* Slide Progress Indicator Bar */}
                      <div className="slide-progress-track">
                        <div
                          className="slide-progress-fill"
                          style={{ width: `${((currentSlideIndex + 1) / (activeDeck?.slides.length || 1)) * 100}%` }}
                        />
                      </div>

                      {/* Slide Sub-Header Controls */}
                      <div className="slide-nav-hud">
                        <div className="slide-counter-info">
                          <span className="slide-badge-active">{currentSlide?.badge || 'Study Notes'}</span>
                          <span className="slide-counter-text">
                            Slide {currentSlideIndex + 1} of {activeDeck?.slides.length || 1}
                          </span>
                        </div>

                        {/* Direct Dot Indicators */}
                        <div className="slide-dots-group">
                          {activeDeck?.slides.map((s, idx) => (
                            <button
                              key={idx}
                              className={`slide-dot ${idx === currentSlideIndex ? 'active' : ''}`}
                              onClick={() => setCurrentSlideIndex(idx)}
                              title={`Jump to ${s.title}`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Main Slide Card Body */}
                      <div className="slide-viewport">
                        <AnimatePresence mode="wait">
                          {currentSlide && (
                            <motion.div
                              key={currentSlideIndex}
                              className="slide-content-stage"
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ duration: 0.25 }}
                            >
                              <div className="slide-title-block">
                                <h3 className="slide-main-heading">{currentSlide.title}</h3>
                                {currentSlide.subtitle && (
                                  <p className="slide-subtitle">{currentSlide.subtitle}</p>
                                )}
                              </div>

                              <div className="slide-body-block">
                                <h4 className="slide-topic-heading">{currentSlide.content.heading}</h4>

                                {currentSlide.content.paragraphs.map((para, pIdx) => (
                                  <p key={pIdx} className="slide-para-text">
                                    {para}
                                  </p>
                                ))}

                                {currentSlide.content.keyHighlights && currentSlide.content.keyHighlights.length > 0 && (
                                  <div className="slide-highlights-grid">
                                    {currentSlide.content.keyHighlights.map((kh, kIdx) => (
                                      <div key={kIdx} className="highlight-card">
                                        <span className="highlight-label">{kh.label}</span>
                                        <span className="highlight-text">{kh.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {currentSlide.content.bulletPoints && currentSlide.content.bulletPoints.length > 0 && (
                                  <div className="slide-bullets-card">
                                    {currentSlide.content.bulletPoints.map((bp, bIdx) => (
                                      <div key={bIdx} className="slide-bullet-item">
                                        <CheckCircle2 size={16} className="bullet-check-icon" />
                                        <span>{bp}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {currentSlide.content.factBox && (
                                  <div className="slide-fact-box">
                                    <Lightbulb size={20} className="fact-box-icon" />
                                    <div className="fact-box-text">
                                      <strong>High-Yield Takeaway:</strong> {currentSlide.content.factBox}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Slide Reader Footer Navigation */}
                      <div className="slide-modal-footer">
                        <div className="footer-left">
                          <button
                            className="slide-nav-btn btn-prev"
                            disabled={currentSlideIndex === 0}
                            onClick={() => setCurrentSlideIndex((prev) => Math.max(prev - 1, 0))}
                          >
                            <ChevronLeft size={16} />
                            <span>Previous Slide</span>
                          </button>
                        </div>

                        <div className="footer-center">
                          <span className="keyboard-tip">Tip: Use ◄ ► arrow keys to switch slides</span>
                        </div>

                        <div className="footer-right">
                          {currentSlideIndex < (activeDeck?.slides.length || 1) - 1 ? (
                            <button
                              className="slide-nav-btn btn-next"
                              onClick={() => setCurrentSlideIndex((prev) => Math.min(prev + 1, (activeDeck?.slides.length || 1) - 1))}
                            >
                              <span>Next Slide</span>
                              <ChevronRight size={16} />
                            </button>
                          ) : (
                            <button
                              className="slide-action-finish-btn"
                              onClick={() => {
                                setActiveModalLesson(null)
                                navigate(
                                  `/practice?group=group2_2a&subjectId=${activeSubjectId}&unitId=${data.unitId}&unitTitle=${encodeURIComponent(
                                    data.unitTitle
                                  )}&lesson=${encodeURIComponent(activeModalLesson.title)}&classId=${data.classId}`
                                )
                              }}
                            >
                              <Award size={16} />
                              <span>Finish & Practice MCQs</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Score Tracking Banner */}
                      <div
                        style={{
                          padding: '0.85rem 1.15rem',
                          borderRadius: '8px',
                          background: 'rgba(255,215,0,0.08)',
                          border: '1px solid rgba(255,215,0,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Answered: <strong>{answeredCount}</strong> of <strong>{totalQuestions}</strong>
                        </span>
                        <span style={{ fontSize: '0.875rem', color: 'var(--gold-primary)', fontWeight: 700 }}>
                          Current Score: {correctCount}/{answeredCount} ({answeredCount > 0 ? scorePercent : 0}%)
                        </span>
                      </div>

                      {(activeModalLesson.practiceMCQs || []).length > 0 ? (
                        activeModalLesson.practiceMCQs!.map((q, qIndex) => {
                          const userAnswer = selectedAnswers[q.id]
                          const isAnswered = userAnswer !== undefined
                          const isCorrect = isAnswered && userAnswer === q.correctAnswer

                          return (
                            <div
                              key={q.id}
                              style={{
                                padding: '1.25rem',
                                borderRadius: '10px',
                                background: 'rgba(10, 16, 32, 0.65)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.85rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                <span
                                  style={{
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '6px',
                                    background: 'rgba(255,215,0,0.15)',
                                    color: 'var(--gold-primary)',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                  }}
                                >
                                  Q{qIndex + 1}
                                </span>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>
                                  {q.question}
                                </span>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {q.options.map((opt, optIdx) => {
                                  const letter = String.fromCharCode(65 + optIdx)
                                  let bg = 'rgba(255,255,255,0.04)'
                                  let borderColor = 'rgba(255,255,255,0.08)'
                                  let textColor = 'var(--text-secondary)'

                                  if (isAnswered) {
                                    if (optIdx === q.correctAnswer) {
                                      bg = 'rgba(34, 197, 94, 0.18)'
                                      borderColor = '#4ade80'
                                      textColor = '#4ade80'
                                    } else if (optIdx === userAnswer) {
                                      bg = 'rgba(239, 68, 68, 0.18)'
                                      borderColor = '#f87171'
                                      textColor = '#f87171'
                                    }
                                  }

                                  return (
                                    <button
                                      key={optIdx}
                                      type="button"
                                      disabled={isAnswered}
                                      onClick={() => handleOptionSelect(q.id, optIdx)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '8px',
                                        background: bg,
                                        border: `1px solid ${borderColor}`,
                                        color: textColor,
                                        fontSize: '0.85rem',
                                        cursor: isAnswered ? 'default' : 'pointer',
                                        textAlign: 'left',
                                        transition: 'all 0.2s ease',
                                      }}
                                    >
                                      <span
                                        style={{
                                          width: '24px',
                                          height: '24px',
                                          borderRadius: '50%',
                                          background: 'rgba(255,255,255,0.08)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 700,
                                          fontSize: '0.75rem',
                                        }}
                                      >
                                        {letter}
                                      </span>
                                      <span style={{ flex: 1 }}>{opt}</span>
                                      {isAnswered && optIdx === q.correctAnswer && (
                                        <CheckCircle2 size={16} color="#4ade80" />
                                      )}
                                      {isAnswered && optIdx === userAnswer && optIdx !== q.correctAnswer && (
                                        <XCircle size={16} color="#f87171" />
                                      )}
                                    </button>
                                  )
                                })}
                              </div>

                              {isAnswered && (
                                <div
                                  style={{
                                    marginTop: '0.4rem',
                                    padding: '0.85rem 1rem',
                                    borderRadius: '8px',
                                    background: isCorrect ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    border: `1px solid ${isCorrect ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: '0.8rem',
                                      fontWeight: 700,
                                      color: isCorrect ? '#4ade80' : '#f87171',
                                      marginBottom: '0.25rem',
                                    }}
                                  >
                                    {isCorrect ? '✓ Correct Answer!' : '✗ Incorrect Explanation:'}
                                  </div>
                                  <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                                    {q.explanation}
                                  </p>
                                </div>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', margin: '2rem 0' }}>
                          Practice questions for this lesson will be available soon.
                        </p>
                      )}

                      {totalQuestions > 0 && answeredCount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                          <button
                            type="button"
                            className="switcher-pill"
                            onClick={handleResetQuiz}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                          >
                            <RotateCcw size={14} />
                            Reset Quiz
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default Group2UnitClass
