import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
  Clock,
  CheckCircle2,
  FileQuestion,
  X,
  BookMarked,
  Lightbulb,
  Award,
} from 'lucide-react'
import {
  getUnitClassData,
  standardClasses,
  type SchoolLesson,
} from '../data/group1ClassSyllabusData'
import { group1GeneralStudiesUnits } from '../data/group1SyllabusData'
import { getLessonNotes, type LessonNotesDeck } from '../data/studyNotesData'
import './Group1UnitClass.css'

const unitIcons: Record<number, any> = {
  1: Atom,
  2: Globe2,
  3: Landmark,
  4: Scale,
  5: TrendingUp,
  6: ScrollText,
}

const Group1UnitClass = () => {
  const { unitId, classId } = useParams<{ unitId: string; classId: string }>()
  const navigate = useNavigate()

  const parsedUnitId = parseInt(unitId || '1', 10)
  const parsedClassId = parseInt(classId || '6', 10)

  const data = getUnitClassData(parsedUnitId, parsedClassId)
  const Icon = unitIcons[parsedUnitId] || BookOpen
  const lessons = data.lessons || []
  const hasLessons = lessons.length > 0

  // Interactive Study Notes Modal State
  const [activeReadingLesson, setActiveReadingLesson] = useState<SchoolLesson | null>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (document.documentElement) document.documentElement.scrollTop = 0
    if (document.body) document.body.scrollTop = 0
  }, [parsedUnitId, parsedClassId])

  // Handle keyboard navigation in reader modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeReadingLesson) return
      if (e.key === 'ArrowRight') {
        setCurrentSlideIndex((prev) => Math.min(prev + 1, 3))
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Escape') {
        setActiveReadingLesson(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeReadingLesson])

  const openLessonNotes = (lesson: SchoolLesson) => {
    setActiveReadingLesson(lesson)
    setCurrentSlideIndex(0)
  }

  const closeLessonNotes = () => {
    setActiveReadingLesson(null)
    setCurrentSlideIndex(0)
  }

  const activeDeck: LessonNotesDeck | null = activeReadingLesson
    ? getLessonNotes(
        data.unitId,
        data.classId,
        data.unitNumber,
        data.unitTitle,
        data.classTitle,
        data.subjectName,
        activeReadingLesson
      )
    : null

  const currentSlide = activeDeck ? activeDeck.slides[currentSlideIndex] : null

  return (
    <div className="unit-class-page">
      <div className="unit-class-container">
        {/* Breadcrumb Navigation */}
        <div className="unit-class-breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={14} />
          <Link to="/materials">Study Materials</Link>
          <ChevronRight size={14} />
          <Link to="/materials/group1/general-studies">General Studies</Link>
          <ChevronRight size={14} />
          <span className="active">
            {data.unitNumber} – {data.classTitle}
          </span>
        </div>

        {/* Top Back Navigation Bar */}
        <div className="unit-class-top-bar">
          <Link to="/materials/group1/general-studies" className="back-btn glass">
            <ArrowLeft size={16} />
            <span>Back to General Studies</span>
          </Link>

          <Link to={`/materials/group1/unit/${parsedUnitId}`} className="back-btn glass">
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
              TNPSC Group 1 General Studies
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
                Preliminary Syllabus (Code: 497).
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
                      onClick={() => navigate(`/materials/group1/unit/${parsedUnitId}/class/${cls.id}`)}
                    >
                      {cls.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Unit Switcher (Unit 1 to 6) */}
            <div className="switcher-row">
              <span className="switcher-label">Select Unit:</span>
              <div className="switcher-pills">
                {group1GeneralStudiesUnits.map((u) => {
                  const isActive = u.id === parsedUnitId
                  return (
                    <button
                      key={u.id}
                      className={`switcher-pill unit-pill ${isActive ? 'active' : ''}`}
                      onClick={() => navigate(`/materials/group1/unit/${u.id}/class/${parsedClassId}`)}
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
              {lessons.map((lesson: SchoolLesson, index: number) => {
                const practiceUrl = `/practice?group=group1&unitId=${data.unitId}&unitTitle=${encodeURIComponent(
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
                        onClick={() => openLessonNotes(lesson)}
                        title={`Open interactive study notes for ${lesson.title}`}
                      >
                        <BookMarked size={15} />
                        <span>Read Study Notes</span>
                      </button>
                      <Link to={practiceUrl} className="lesson-practice-btn" title="Practice MCQs for this lesson">
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
                <Clock size={32} />
              </div>
              <h3 className="empty-heading">Lessons coming soon.</h3>
              <p className="empty-subtext">
                Comprehensive Samacheer Kalvi lesson notes and chapter-wise question banks for{' '}
                <strong>
                  {data.unitTitle} ({data.classTitle})
                </strong>{' '}
                are currently being curated by subject experts according to the official TNPSC Group 1 syllabus.
              </p>
              <div className="empty-actions">
                <Link
                  to={`/practice?group=group1&unitId=${data.unitId}&unitTitle=${encodeURIComponent(data.unitTitle)}&classId=${data.classId}`}
                  className="btn btn-primary"
                >
                  <FileQuestion size={16} />
                  <span>Practice General Studies MCQs</span>
                </Link>
                <Link to="/materials/group1/general-studies" className="btn btn-secondary">
                  <ArrowLeft size={16} />
                  <span>Choose Another Standard</span>
                </Link>
              </div>
            </motion.div>
          )}
        </div>

        {/* Back navigation footer */}
        <div className="unit-class-footer-nav">
          <Link to="/materials/group1/general-studies" className="back-btn glass">
            <ArrowLeft size={16} />
            <span>Back to General Studies Main Page</span>
          </Link>
        </div>
      </div>

      {/* ============================================================== */}
      {/* INTERACTIVE STUDY NOTES MODAL WITH SLIDE-BY-SLIDE READER FORMAT */}
      {/* ============================================================== */}
      <AnimatePresence>
        {activeReadingLesson && activeDeck && currentSlide && (
          <div className="slide-modal-overlay" onClick={closeLessonNotes}>
            <motion.div
              className="slide-modal-card glass"
              initial={{ opacity: 0, scale: 0.92, y: 25 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 25 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Progress Header */}
              <div className="slide-modal-header">
                <div className="slide-modal-meta">
                  <div className="slide-meta-badge-row">
                    <span className="slide-pill-gold">
                      <GraduationCap size={13} />
                      {activeDeck.classTitle} {activeDeck.term ? `• ${activeDeck.term}` : ''}
                    </span>
                    <span className="slide-pill-cyan">{activeDeck.unitNumber}</span>
                    <span className="slide-pill-muted">{activeDeck.subjectName}</span>
                  </div>
                  <h2 className="slide-modal-lesson-title">
                    Lesson {activeReadingLesson.lessonNumber}: {activeReadingLesson.title}
                  </h2>
                </div>

                <button
                  className="slide-modal-close"
                  onClick={closeLessonNotes}
                  aria-label="Close Study Reader"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Slide Progress Indicator Bar */}
              <div className="slide-progress-track">
                <div
                  className="slide-progress-fill"
                  style={{ width: `${((currentSlideIndex + 1) / activeDeck.slides.length) * 100}%` }}
                />
              </div>

              {/* Slide Sub-Header Controls */}
              <div className="slide-nav-hud">
                <div className="slide-counter-info">
                  <span className="slide-badge-active">{currentSlide.badge}</span>
                  <span className="slide-counter-text">
                    Slide {currentSlideIndex + 1} of {activeDeck.slides.length}
                  </span>
                </div>

                {/* Direct Dot Indicators */}
                <div className="slide-dots-group">
                  {activeDeck.slides.map((s, idx) => (
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
                  {currentSlideIndex < activeDeck.slides.length - 1 ? (
                    <button
                      className="slide-nav-btn btn-next"
                      onClick={() => setCurrentSlideIndex((prev) => Math.min(prev + 1, activeDeck.slides.length - 1))}
                    >
                      <span>Next Slide</span>
                      <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button
                      className="slide-action-finish-btn"
                      onClick={() => {
                        closeLessonNotes()
                        navigate(
                          `/practice?group=group1&unitId=${data.unitId}&unitTitle=${encodeURIComponent(
                            data.unitTitle
                          )}&lesson=${encodeURIComponent(activeReadingLesson.title)}&classId=${data.classId}`
                        )
                      }}
                    >
                      <Award size={16} />
                      <span>Finish & Practice MCQs</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Group1UnitClass
