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
  Sparkles,
  GraduationCap,
} from 'lucide-react'
import {
  getGroup2SubjectById,
  getGroup2UnitById,
  getGroup2UnitChapterCount,
  getGroup2UnitLessonCount,
} from '../data/group2SyllabusData'
import { standardClasses } from '../data/group2ClassSyllabusData'
import { useLanguage } from '../context/LanguageContext'
import LanguageSwitch from '../components/LanguageSwitch'
import {
  translateTopic,
  translateLessonTitle,
  translateUnitNumber,
  translateClassTitle,
  translateSubjectName,
} from '../utils/bilingualSyllabus'
import './Group1UnitDetail.css'

const unitIcons: Record<number, any> = {
  1: Atom,
  2: Globe2,
  3: Landmark,
  4: Scale,
  5: TrendingUp,
  6: ScrollText,
  7: Sparkles,
}

const Group2UnitDetail = () => {
  const { subjectId, unitId } = useParams<{ subjectId: string; unitId: string }>()
  const navigate = useNavigate()
  const { language, isTamil } = useLanguage()

  const activeSubjectId = subjectId || 'general-studies'
  const parsedUnitId = parseInt(unitId || '1', 10)

  const subject = getGroup2SubjectById(activeSubjectId)
  const unit = getGroup2UnitById(activeSubjectId, parsedUnitId)

  if (!subject || !unit) {
    return (
      <div className="unit-detail-page">
        <div className="unit-detail-container">
          <div className="empty-state glass">
            <h2>{isTamil ? 'அலகு கிடைக்கவில்லை' : 'Unit Not Found'}</h2>
            <p>{isTamil ? 'கோரப்பட்ட டிஎன்பிஎஸ்சி குரூப் 2 & 2A பாடத்திட்ட அலகு இல்லை.' : 'The requested TNPSC Group 2 & 2A syllabus unit does not exist.'}</p>
            <Link to="/materials?group=group2_2a" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              <ArrowLeft size={16} />
              <span>{isTamil ? 'குரூப் 2 & 2A பகுதிக்குத் திரும்பு' : 'Back to Group 2 & 2A'}</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const chapterCount = getGroup2UnitChapterCount(unit)
  const lessonCount = getGroup2UnitLessonCount(unit)
  const Icon = unitIcons[unit.id] || BookOpen

  return (
    <div className="unit-detail-page">
      <div className="unit-detail-container">
        {/* Breadcrumb Navigation */}
        <div className="unit-detail-breadcrumb">
          <Link to="/">{isTamil ? 'முகப்பு' : 'Home'}</Link>
          <ChevronRight size={14} />
          <Link to="/materials?group=group2_2a">{isTamil ? 'பாடக்குறிப்புகள்' : 'Study Materials'}</Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group2/${subject.id}`}>
            {isTamil ? (subject.tamilTitle || translateSubjectName(subject.title, language)) : subject.title}
          </Link>
          <ChevronRight size={14} />
          <span className="active">{translateUnitNumber(unit.unitNumber, language)}: {isTamil ? (unit.tamilTitle || unit.title) : unit.title}</span>
        </div>

        {/* Back Link & Language Switch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to={`/materials/group2/${subject.id}`} className="back-btn glass">
            <ArrowLeft size={16} />
            <span>{isTamil ? 'அனைத்து அலகுகளுக்கும் திரும்பு' : `Back to ${subject.title} Units`}</span>
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
                onClick={() => navigate(`/materials/group2/${subject.id}/unit/${unit.id}/lessons`)}
              >
                <BookOpen size={18} />
                <span>{isTamil ? 'பாடங்கள் & குறிப்புகளைக் காண்க' : 'View Lessons & Notes'}</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Official Syllabus Topics Box */}
        <motion.div
          className="official-syllabus-box glass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="syllabus-box-header">
            <div className="syllabus-box-title">
              <Scroll size={20} />
              <span>{isTamil ? 'அதிகாரப்பூர்வ பாடத்திட்டத் தலைப்புகள் (குறியீடு: 495)' : 'Authoritative Syllabus Topics (TNPSC Code: 495)'}</span>
            </div>
            <span className="syllabus-source-badge">{isTamil ? 'அதிகாரப்பூர்வ அறிவிக்கை' : 'Official PDF Notification'}</span>
          </div>

          <div className="syllabus-topics-list">
            {unit.officialTopics.map((topic, index) => (
              <div key={index} className="syllabus-topic-item">
                <span className="topic-bullet">§{index + 1}</span>
                <p>{translateTopic(topic, language)}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Standard-Wise Breakdown Section */}
        <div className="unit-class-breakdown-section glass" style={{ marginTop: '1.5rem', padding: '1.5rem 1.75rem', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--surface-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <GraduationCap size={22} style={{ color: 'var(--gold-primary)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isTamil ? 'பள்ளிப் பாடநூல் வகுப்புகள் (6 முதல் 12 வரை)' : 'School Textbook Standards (6th to 12th)'}
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {isTamil
                  ? `வகுப்பு வாரியாக ${translateUnitNumber(unit.unitNumber, language)} பாடக் குறிப்புகள் மற்றும் வினாக்களைப் பயில்க:`
                  : `Explore school textbook notes and MCQs for ${unit.unitNumber} by class standard:`}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
            {standardClasses.map((cls) => (
              <button
                key={cls.id}
                type="button"
                className="btn glass"
                style={{ padding: '0.65rem 0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer' }}
                onClick={() => navigate(`/materials/group2/${subject.id}/unit/${unit.id}/class/${cls.id}`)}
              >
                <span>{translateClassTitle(cls.label, language)}</span>
                <ChevronRight size={14} style={{ color: 'var(--gold-primary)' }} />
              </button>
            ))}
          </div>
        </div>

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
                {chapter.tamilTitle && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginTop: '-0.3rem', marginBottom: '0.6rem' }}>
                    {chapter.tamilTitle}
                  </span>
                )}

                <div className="chapter-lessons-list">
                  {chapter.lessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="chapter-lesson-row"
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/materials/group2/${subject.id}/unit/${unit.id}/lessons`)}
                    >
                      <span className="lesson-code-tag">{lesson.lessonNumber}</span>
                      <span className="lesson-row-title" title={lesson.title}>
                        {translateLessonTitle(lesson.title, language)}
                      </span>
                      <span className="status-badge-awaiting">
                        {lesson.practiceQuestions.length} {isTamil ? 'வினாக்கள்' : 'MCQs'}
                      </span>
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
              onClick={() => navigate(`/materials/group2/${subject.id}/unit/${unit.id}/lessons`)}
            >
              <FileText size={18} />
              <span>{isTamil ? 'பாடங்கள் & குறிப்புகளைக் காண்க' : 'View Lessons & Notes'}</span>
            </button>
            <Link
              to={`/practice?group=group2_2a&subjectId=${subject.id}&unitId=${unit.id}&unitTitle=${encodeURIComponent(unit.title)}`}
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

export default Group2UnitDetail
