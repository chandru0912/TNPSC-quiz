import { useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
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
} from 'lucide-react'
import {
  getUnitClassData,
  standardClasses,
  type SchoolLesson,
} from '../data/group1ClassSyllabusData'
import { group1GeneralStudiesUnits } from '../data/group1SyllabusData'
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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (document.documentElement) document.documentElement.scrollTop = 0
    if (document.body) document.body.scrollTop = 0
  }, [parsedUnitId, parsedClassId])

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
              {lessons.map((lesson: SchoolLesson, index: number) => (
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
                      onClick={() =>
                        alert(
                          `Notes for "${lesson.title}" (${data.classTitle}) are currently being loaded into your reader. You can also practice questions in MCQ Practice!`
                        )
                      }
                    >
                      <FileQuestion size={15} />
                      <span>Read Study Notes</span>
                    </button>
                    <Link to="/practice" className="lesson-practice-btn">
                      <span>Practice MCQs</span>
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            /* EXACT REQUIRED MESSAGE WHEN NO LESSONS: "Lessons coming soon." */
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
                <Link to="/practice" className="btn btn-primary">
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
    </div>
  )
}

export default Group1UnitClass
