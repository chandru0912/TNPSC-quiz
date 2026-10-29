import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useScrollLock } from '../hooks/useScrollLock'
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
import { useLanguage } from '../context/LanguageContext'
import LanguageSwitch from '../components/LanguageSwitch'
import {
  translateLessonTitle,
  translateLessonDescription,
  translateUnitNumber,
  translateStatus,
} from '../utils/bilingualSyllabus'
import './Group1Lessons.css'

const Group1Lessons = () => {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const { language, isTamil } = useLanguage()
  const parsedId = parseInt(unitId || '1', 10)
  const unit = getUnitById(parsedId)

  const [activeLesson, setActiveLesson] = useState<{
    lesson: Lesson
    chapterTitle: string
    chapterNumber: number
  } | null>(null)

  // Lock background scroll when lesson modal is open
  useScrollLock(Boolean(activeLesson))

  if (!unit) {
    return (
      <div className="lessons-page">
        <div className="lessons-container">
          <div className="empty-state glass">
            <h2>{isTamil ? 'அலகு கிடைக்கவில்லை' : 'Unit Not Found'}</h2>
            <p>{isTamil ? 'கோரப்பட்ட டிஎன்பிஎஸ்சி குரூப் 1 பாடத்திட்ட அலகு இல்லை.' : 'The requested TNPSC Group 1 syllabus unit does not exist.'}</p>
            <Link to="/materials/group1/general-studies" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              <ArrowLeft size={16} />
              <span>{isTamil ? 'பொது அறிவுக்குத் திரும்பு' : 'Back to General Studies'}</span>
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
          <Link to="/">{isTamil ? 'முகப்பு' : 'Home'}</Link>
          <ChevronRight size={14} />
          <Link to="/materials">{isTamil ? 'பாடக்குறிப்புகள்' : 'Study Materials'}</Link>
          <ChevronRight size={14} />
          <Link to="/materials/group1/general-studies">{isTamil ? 'பொது அறிவு' : 'General Studies'}</Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group1/unit/${unit.id}`}>{translateUnitNumber(unit.unitNumber, language)}</Link>
          <ChevronRight size={14} />
          <span className="active">{isTamil ? 'பாடங்கள் & குறிப்புகள்' : 'Lessons & Notes'}</span>
        </div>

        {/* Back Link & Language Switch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to={`/materials/group1/unit/${unit.id}`} className="back-btn glass">
            <ArrowLeft size={16} />
            <span>{isTamil ? `பாடத்திட்டத்திற்குத் திரும்பு (${translateUnitNumber(unit.unitNumber, language)})` : `Back to ${unit.unitNumber} Syllabus`}</span>
          </Link>

          <LanguageSwitch />
        </div>

        {/* Header */}
        <motion.div
          className="lessons-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="lessons-title-row">
            <span className="unit-number-pill">{translateUnitNumber(unit.unitNumber, language)}</span>
            <span className="unit-q-count">{unit.questionCount} {isTamil ? 'வினாக்கள்' : 'Questions'}</span>
          </div>

          <h1 className="lessons-title">
            {isTamil ? (unit.tamilTitle || unit.title) : unit.title} — <span className="gradient-text">{isTamil ? 'பாடங்கள் & குறிப்புகள்' : 'Lessons & Notes'}</span>
          </h1>

          <p className="lessons-subtitle">
            {isTamil
              ? `${chapterCount} அத்தியாயங்கள் (${lessonCount} மொத்தப் பாடங்கள்) வழியாக அமைக்கப்பட்ட பாடத்திட்ட வரிசை. பள்ளிப் பாடநூல் குறிப்புகள் மற்றும் பயிற்சித் தொகுப்புகள் கீழே உள்ளவாறு வழங்கப்பட்டுள்ளன.`
              : `Organized syllabus sequence across ${chapterCount} chapters (${lessonCount} total lessons). Official lesson notes are currently being prepared; lessons are marked below with their current status.`}
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
                  <span className="chapter-block-num">{isTamil ? `அத்தியாயம் ${chapter.chapterNumber}` : `Chapter ${chapter.chapterNumber}`}</span>
                  <h2 className="chapter-block-title">{translateLessonTitle(chapter.title, language)}</h2>
                </div>
                <span className="chapter-block-count">
                  <Layers size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  {chapter.lessons.length} {isTamil ? 'பாடங்கள்' : 'Lessons'}
                </span>
              </div>

              <div className="lessons-list-grid">
                {chapter.lessons.map((lesson) => (
                  <div key={lesson.id} className="lesson-full-card">
                    <div className="lesson-left">
                      <div className="lesson-number-circle">{lesson.lessonNumber}</div>
                      <div className="lesson-info">
                        <span className="lesson-title-text">{translateLessonTitle(lesson.title, language)}</span>
                        {lesson.description && (
                          <span className="lesson-desc-text">{translateLessonDescription(lesson.description, language)}</span>
                        )}
                      </div>
                    </div>

                    <div className="lesson-right">
                      <span className="awaiting-notes-tag">
                        <Clock size={12} />
                        {translateStatus(lesson.status, language)}
                      </span>
                      <button
                        className="view-lesson-btn"
                        onClick={() =>
                          setActiveLesson({
                            lesson,
                            chapterTitle: translateLessonTitle(chapter.title, language),
                            chapterNumber: chapter.chapterNumber,
                          })
                        }
                      >
                        <span>{isTamil ? 'பாட விவரங்கள்' : 'Lesson Details'}</span>
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
                      {isTamil ? `பாடம் ${activeLesson.lesson.lessonNumber} • அத்தியாயம் ${activeLesson.chapterNumber}` : `Lesson ${activeLesson.lesson.lessonNumber} • Chapter ${activeLesson.chapterNumber}`}
                    </span>
                    <h3 className="modal-title">{translateLessonTitle(activeLesson.lesson.title, language)}</h3>
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
                    <span className="modal-notice-title">
                      {isTamil ? 'நிலை: அதிகாரப்பூர்வ குறிப்புகள் தயாரிப்பில் உள்ளன' : 'Status: Awaiting Official Notes'}
                    </span>
                    <p className="modal-notice-text">
                      {isTamil
                        ? 'இப்பாடத்திட்ட தலைப்பிற்கான முழுமையான பள்ளிப் பாடநூல் குறிப்புகள் தமிழ்நாடு எஸ்சிஇஆர்டி (SCERT) பாடநூல்கள் மற்றும் அங்கீகரிக்கப்பட்ட உசாத்துணை நூல்களிலிருந்து தொகுக்கப்பட்டு வருகின்றன. முறையான குறிப்புகள் சரிபார்க்கப்பட்டதும் இங்கு காட்சிப்படுத்தப்படும்.'
                        : 'Full textbook notes for this syllabus topic are currently awaiting verified publication from Tamil Nadu SCERT textbooks and standard academic references. Rather than displaying fabricated content, official material will appear here once authenticated.'}
                    </p>
                  </div>
                </div>

                {/* Official Syllabus Scope */}
                <div className="modal-scope-section">
                  <span className="modal-section-title">{isTamil ? 'அதிகாரப்பூர்வ பாடத்திட்ட எல்லை' : 'Official Syllabus Coverage'}</span>
                  <p className="modal-scope-text">
                    {translateLessonDescription(activeLesson.lesson.description, language) ||
                      (isTamil
                        ? `அத்தியாயம் ${activeLesson.chapterNumber}: ${activeLesson.chapterTitle}-ன் கீழ் ${translateLessonTitle(activeLesson.lesson.title, language)} பாட உள்ளடக்கம்.`
                        : `Study coverage for ${activeLesson.lesson.title} under Chapter ${activeLesson.chapterNumber}: ${activeLesson.chapterTitle}.`)}
                  </p>
                </div>

                <div className="modal-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setActiveLesson(null)}
                  >
                    <span>{isTamil ? 'மூடு' : 'Close'}</span>
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const lessonTitle = activeLesson.lesson.title
                      setActiveLesson(null)
                      navigate(
                        `/practice?group=group1&unitId=${unit.id}&unitTitle=${encodeURIComponent(
                          unit.title
                        )}&lesson=${encodeURIComponent(lessonTitle)}`
                      )
                    }}
                  >
                    <FileQuestion size={16} />
                    <span>{isTamil ? 'தொடர்புடைய வினாக்களைப் பயிற்சி செய்' : 'Practice Related MCQs'}</span>
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
