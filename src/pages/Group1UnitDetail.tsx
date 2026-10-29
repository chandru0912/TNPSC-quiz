import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen,
  ChevronRight,
  ArrowLeft,
  FileText,
  Clock,
  Layers,
  Scroll,
  HelpCircle,
  Atom,
  Globe2,
  Landmark,
  Scale,
  TrendingUp,
  ScrollText,
} from 'lucide-react'
import {
  getUnitById,
  getUnitChapterCount,
  getUnitLessonCount,
} from '../data/group1SyllabusData'
import { useLanguage } from '../context/LanguageContext'
import LanguageSwitch from '../components/LanguageSwitch'
import {
  translateTopic,
  translateLessonTitle,
  translateUnitNumber,
  translateStatus,
} from '../utils/bilingualSyllabus'
import './Group1UnitDetail.css'

const unitIcons: Record<number, any> = {
  1: Atom,
  2: Globe2,
  3: Landmark,
  4: Scale,
  5: TrendingUp,
  6: ScrollText,
}

const Group1UnitDetail = () => {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const { language, isTamil } = useLanguage()
  const parsedId = parseInt(unitId || '1', 10)
  const unit = getUnitById(parsedId)

  if (!unit) {
    return (
      <div className="unit-detail-page">
        <div className="unit-detail-container">
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
  const Icon = unitIcons[unit.id] || BookOpen

  return (
    <div className="unit-detail-page">
      <div className="unit-detail-container">
        {/* Breadcrumb Navigation */}
        <div className="unit-detail-breadcrumb">
          <Link to="/">{isTamil ? 'முகப்பு' : 'Home'}</Link>
          <ChevronRight size={14} />
          <Link to="/materials">{isTamil ? 'பாடக்குறிப்புகள்' : 'Study Materials'}</Link>
          <ChevronRight size={14} />
          <Link to="/materials/group1/general-studies">{isTamil ? 'பொது அறிவு' : 'General Studies'}</Link>
          <ChevronRight size={14} />
          <span className="active">{translateUnitNumber(unit.unitNumber, language)}: {isTamil ? (unit.tamilTitle || unit.title) : unit.title}</span>
        </div>

        {/* Back Link & Language Switch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/materials/group1/general-studies" className="back-btn glass">
            <ArrowLeft size={16} />
            <span>{isTamil ? 'அனைத்து அலகுகளுக்கும் திரும்பு' : 'Back to General Studies Units'}</span>
          </Link>

          <LanguageSwitch />
        </div>

        {/* Unit Hero Banner */}
        <motion.div
          className="unit-hero glass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="unit-hero-top">
            <span className="unit-pill-tag">{unit.unitNumber} • Official Syllabus</span>
            <span className="unit-hero-weightage">
              <HelpCircle size={14} />
              {unit.questionCount} Questions in Prelims
            </span>
          </div>

          <div className="unit-hero-main">
            <div className="unit-hero-icon">
              <Icon size={30} />
            </div>
            <div className="unit-hero-title-group">
              <h1 className="unit-hero-title">{unit.title}</h1>
              {unit.tamilTitle && <span className="unit-hero-tamil-title">{unit.tamilTitle}</span>}
            </div>
          </div>

          {/* Dynamic Metrics */}
          <div className="unit-stats-strip">
            <div className="unit-stat-item">
              <BookOpen size={18} />
              <span>
                Chapters: <strong>{chapterCount}</strong>
              </span>
            </div>
            <div className="unit-stat-item">
              <Layers size={18} />
              <span>
                Total Lessons: <strong>{lessonCount}</strong>
              </span>
            </div>
            <div className="unit-stat-item">
              <Clock size={18} />
              <span>
                Standard: <strong>{unit.standard}</strong>
              </span>
            </div>

            <div className="unit-hero-cta">
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/materials/group1/unit/${unit.id}/lessons`)}
              >
                <BookOpen size={18} />
                <span>{isTamil ? 'பாடங்கள் & குறிப்புகளைக் காண்க' : 'View Lessons & Notes'}</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Official Syllabus Topics Box (Extracted from authoritative PDF) */}
        <motion.div
          className="official-syllabus-box glass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="syllabus-box-header">
            <div className="syllabus-box-title">
              <Scroll size={20} />
              <span>{isTamil ? 'அதிகாரப்பூர்வ பாடத்திட்டத் தலைப்புகள் (குறியீடு: 497)' : 'Authoritative Syllabus Topics (TNPSC Code: 497)'}</span>
            </div>
            <span className="syllabus-source-badge">{isTamil ? 'அதிகாரப்பூர்வ அறிவிக்கை' : 'Official PDF Notification'}</span>
          </div>

          <div className="syllabus-topics-list">
            {unit.officialSyllabusTopics.map((topic, index) => (
              <div key={index} className="syllabus-topic-item">
                <span className="topic-bullet">§{index + 1}</span>
                <p>{translateTopic(topic, language)}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Chapter Cards Section */}
        <div className="chapters-section">
          <div className="section-title-row">
            <h2 className="section-heading">
              {isTamil ? `அத்தியாயங்களின் கட்டமைப்பு (${chapterCount} அத்தியாயங்கள்)` : `Structured Chapter Breakdown (${chapterCount} Chapters)`}
            </h2>
          </div>

          <div className="chapters-grid">
            {unit.chapters.map((chapter, index) => (
              <motion.div
                key={chapter.id}
                className="chapter-card glass"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + index * 0.05 }}
              >
                <div className="chapter-header">
                  <span className="chapter-badge">
                    {isTamil ? `அத்தியாயம் ${chapter.chapterNumber}` : `Chapter ${chapter.chapterNumber}`}
                  </span>
                  <span className="chapter-lesson-count">
                    {chapter.lessons.length} {isTamil ? 'பாடங்கள்' : 'Lessons'}
                  </span>
                </div>

                <h3 className="chapter-title">{translateLessonTitle(chapter.title, language)}</h3>

                <div className="chapter-lessons-list">
                  {chapter.lessons.map((lesson) => (
                    <div key={lesson.id} className="chapter-lesson-row">
                      <span className="lesson-code-tag">{lesson.lessonNumber}</span>
                      <span className="lesson-row-title" title={lesson.title}>
                        {translateLessonTitle(lesson.title, language)}
                      </span>
                      <span className="status-badge-awaiting">{translateStatus(lesson.status, language)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Action Strip */}
        <div className="unit-action-strip glass">
          <div className="action-strip-info">
            <span className="action-strip-title">
              {isTamil ? `${unit.tamilTitle || unit.title} பயில தயாரா?` : `Ready to study ${unit.title}?`}
            </span>
            <span className="action-strip-sub">
              {isTamil ? 'முழுமையான பாட வரிசையை அணுகவும் அல்லது இப்பாடத்திற்கான வினாக்களைப் பயிற்சி செய்யவும்.' : 'Access the complete lesson sequence or practice targeted MCQs for this unit.'}
            </span>
          </div>

          <div className="action-strip-buttons">
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/materials/group1/unit/${unit.id}/lessons`)}
            >
              <FileText size={18} />
              <span>{isTamil ? 'பாடங்கள் & குறிப்புகளைக் காண்க' : 'View Lessons & Notes'}</span>
            </button>
            <Link
              to={`/practice?group=group1&unitId=${unit.id}&unitTitle=${encodeURIComponent(unit.title)}`}
              className="btn btn-secondary"
            >
              <span>{isTamil ? 'அலகு வினாக்களைப் பயிற்சி செய்' : 'Practice Unit MCQs'}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Group1UnitDetail
