import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  ArrowLeft,
  Clock,
  Layers,
  X,
  FileQuestion,
  Info,
} from 'lucide-react'
import {
  getUnitById,
  getUnitChapterCount,
  getUnitLessonCount,
  type Lesson,
} from '../data/group1SyllabusData'
import './Group1Lessons.css'

const Group1Lessons = () => {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const parsedId = parseInt(unitId || '1', 10)
  const unit = getUnitById(parsedId)

  const [activeLesson, setActiveLesson] = useState<{
    lesson: Lesson
    chapterTitle: string
    chapterNumber: number
  } | null>(null)

  if (!unit) {
    return (
      <div className="lessons-page">
        <div className="lessons-container">
          <div className="empty-state glass">
            <h2>Unit Not Found</h2>
            <p>The requested TNPSC Group 1 syllabus unit does not exist.</p>
            <Link to="/materials/group1/general-studies" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              <ArrowLeft size={16} />
              <span>Back to General Studies</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const chapterCount = getUnitChapterCount(unit)
  const lessonCount = getUnitLessonCount(unit)

  return (
    <div className="lessons-page">
      <div className="lessons-container">
        {/* Breadcrumb Navigation */}
        <div className="lessons-breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={14} />
          <Link to="/materials">Study Materials</Link>
          <ChevronRight size={14} />
          <Link to="/materials/group1/general-studies">General Studies</Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group1/unit/${unit.id}`}>{unit.unitNumber}</Link>
          <ChevronRight size={14} />
          <span className="active">Lessons & Notes</span>
        </div>

        {/* Back Link */}
        <div>
          <Link to={`/materials/group1/unit/${unit.id}`} className="back-btn glass">
            <ArrowLeft size={16} />
            <span>Back to {unit.unitNumber} Syllabus</span>
          </Link>
        </div>

        {/* Header */}
        <motion.div
          className="lessons-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="lessons-title-row">
            <span className="unit-number-pill">{unit.unitNumber}</span>
            <span className="unit-q-count">{unit.questionCount} Questions</span>
          </div>

          <h1 className="lessons-title">
            {unit.title} — <span className="gradient-text">Lessons & Notes</span>
          </h1>

          <p className="lessons-subtitle">
            Organized syllabus sequence across {chapterCount} chapters ({lessonCount} total lessons).
            Official lesson notes are currently being prepared; lessons are marked below with their current status.
          </p>
        </motion.div>

        {/* Chapters & Lessons Stack */}
        <div className="chapters-lesson-stack">
          {unit.chapters.map((chapter, cIndex) => (
            <motion.div
              key={chapter.id}
              className="chapter-block glass"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: cIndex * 0.06 }}
            >
              <div className="chapter-block-head">
                <div className="chapter-block-title-group">
                  <span className="chapter-block-num">Chapter {chapter.chapterNumber}</span>
                  <h2 className="chapter-block-title">{chapter.title}</h2>
                </div>
                <span className="chapter-block-count">
                  <Layers size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  {chapter.lessons.length} Lessons
                </span>
              </div>

              <div className="lessons-list-grid">
                {chapter.lessons.map((lesson) => (
                  <div key={lesson.id} className="lesson-full-card">
                    <div className="lesson-left">
                      <div className="lesson-number-circle">{lesson.lessonNumber}</div>
                      <div className="lesson-info">
                        <span className="lesson-title-text">{lesson.title}</span>
                        {lesson.description && (
                          <span className="lesson-desc-text">{lesson.description}</span>
                        )}
                      </div>
                    </div>

                    <div className="lesson-right">
                      <span className="awaiting-notes-tag">
                        <Clock size={12} />
                        {lesson.status}
                      </span>
                      <button
                        className="view-lesson-btn"
                        onClick={() =>
                          setActiveLesson({
                            lesson,
                            chapterTitle: chapter.title,
                            chapterNumber: chapter.chapterNumber,
                          })
                        }
                      >
                        <span>Lesson Details</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Modal Drawer for Lesson Notes Details */}
        <AnimatePresence>
          {activeLesson && (
            <div className="lesson-modal-overlay" onClick={() => setActiveLesson(null)}>
              <motion.div
                className="lesson-modal glass"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.25 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-head">
                  <div className="modal-title-group">
                    <span className="modal-code-pill">
                      Lesson {activeLesson.lesson.lessonNumber} • Chapter {activeLesson.chapterNumber}
                    </span>
                    <h3 className="modal-title">{activeLesson.lesson.title}</h3>
                  </div>
                  <button
                    className="modal-close-btn"
                    onClick={() => setActiveLesson(null)}
                    aria-label="Close modal"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Honest Notes Status Notice Box */}
                <div className="modal-notice-box">
                  <Info size={22} className="modal-notice-icon" />
                  <div className="modal-notice-content">
                    <span className="modal-notice-title">Status: Awaiting Official Notes</span>
                    <p className="modal-notice-text">
                      Full textbook notes for this syllabus topic are currently awaiting verified publication
                      from Tamil Nadu SCERT textbooks and standard academic references. Rather than displaying
                      fabricated content, official material will appear here once authenticated.
                    </p>
                  </div>
                </div>

                {/* Official Syllabus Scope */}
                <div className="modal-scope-section">
                  <span className="modal-section-title">Official Syllabus Coverage</span>
                  <p className="modal-scope-text">
                    {activeLesson.lesson.description ||
                      `Study coverage for ${activeLesson.lesson.title} under Chapter ${activeLesson.chapterNumber}: ${activeLesson.chapterTitle}.`}
                  </p>
                </div>

                <div className="modal-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setActiveLesson(null)}
                  >
                    <span>Close</span>
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setActiveLesson(null)
                      navigate('/practice')
                    }}
                  >
                    <FileQuestion size={16} />
                    <span>Practice Related MCQs</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default Group1Lessons
