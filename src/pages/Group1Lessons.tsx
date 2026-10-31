import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  ArrowLeft,
  Clock,
  Layers,
} from 'lucide-react'
import {
  getUnitById,
  getUnitChapterCount,
  getUnitLessonCount,
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
                          navigate(`/study-notes/group1/subject/general-studies/unit/${unit.id}/lesson/${encodeURIComponent(lesson.title)}?chapter=${encodeURIComponent(chapter.title)}&chapterNum=${chapter.chapterNumber}&lang=${isTamil ? 'tamil' : 'english'}${lesson.id ? `&lessonId=${encodeURIComponent(lesson.id)}` : ''}${lesson.lessonNumber ? `&lessonNumber=${encodeURIComponent(lesson.lessonNumber)}` : ''}`)
                        }
                      >
                        <span>{isTamil ? 'பாடக் குறிப்புகள் படிக்க' : 'Read Study Notes'}</span>
                        <ChevronRight size={14} />
                      </button>
                      <button
                        className="view-lesson-btn"
                        style={{ marginLeft: '0.4rem', background: 'linear-gradient(135deg, rgba(255,215,0,0.18), rgba(245,158,11,0.28))', borderColor: 'rgba(255,215,0,0.5)', color: '#ffd700' }}
                        onClick={() =>
                          navigate(`/study-materials/practice/group1/general-studies/all/${unit.id}/${encodeURIComponent(lesson.id || '')}?lessonTitle=${encodeURIComponent(lesson.title)}`)
                        }
                      >
                        <span>{isTamil ? 'பயிற்சி வினாக்கள்' : 'Practice MCQs'}</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Modal removed - Read Study Notes now opens full page */}
      </div>
    </div>
  )
}

export default Group1Lessons
