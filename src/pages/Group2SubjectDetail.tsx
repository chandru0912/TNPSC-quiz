import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen,
  ChevronRight,
  Atom,
  Globe2,
  Landmark,
  Scale,
  TrendingUp,
  ScrollText,
  FileQuestion,
  Layers,
  ArrowLeft,
  Sparkles,
  GraduationCap,
} from 'lucide-react'
import {
  group2Subjects,
  getGroup2SubjectById,
  getGroup2UnitChapterCount,
  getGroup2UnitLessonCount,
  getTotalGroup2SubjectChapters,
  type Group2Unit,
} from '../data/group2SyllabusData'
import { standardClasses } from '../data/group2ClassSyllabusData'
import { useLanguage } from '../context/LanguageContext'
import LanguageSwitch from '../components/LanguageSwitch'
import {
  translateTopic,
  translateUnitNumber,
  translateClassTitle,
  translateSubjectName,
} from '../utils/bilingualSyllabus'
import './Group1GeneralStudies.css'
import './StudyMaterials.css'

const unitIcons: Record<number, any> = {
  1: Atom,
  2: Globe2,
  3: Landmark,
  4: Scale,
  5: TrendingUp,
  6: ScrollText,
  7: Sparkles,
}

const Group2SubjectDetail = () => {
  const { subjectId } = useParams<{ subjectId: string }>()
  const navigate = useNavigate()
  const { language, isTamil } = useLanguage()

  const activeSubjectId = subjectId || 'general-studies'
  const subject = getGroup2SubjectById(activeSubjectId)

  if (!subject) {
    return (
      <div className="gs-page">
        <div className="gs-container">
          <div className="empty-state glass" style={{ padding: '3rem', textAlign: 'center' }}>
            <h2>{isTamil ? 'பாடம் கிடைக்கவில்லை' : 'Subject Not Found'}</h2>
            <p>{isTamil ? 'கோரப்பட்ட டிஎன்பிஎஸ்சி குரூப் 2 & 2A பாடத்திட்ட பாடம் இல்லை.' : 'The requested TNPSC Group 2 & 2A syllabus subject does not exist.'}</p>
            <Link to="/materials?group=group2_2a" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              <ArrowLeft size={16} />
              <span>{isTamil ? 'குரூப் 2 & 2A பகுதிக்குத் திரும்பு' : 'Back to Group 2 & 2A'}</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const totalQuestions = subject.questionCount
  const totalChapters = getTotalGroup2SubjectChapters(subject)

  return (
    <div className="gs-page">
      <div className="gs-container">
        {/* Breadcrumb Navigation */}
        <div className="gs-breadcrumb">
          <Link to="/">{isTamil ? 'முகப்பு' : 'Home'}</Link>
          <ChevronRight size={14} />
          <Link to="/materials?group=group2_2a">{isTamil ? 'பாடக்குறிப்புகள்' : 'Study Materials'}</Link>
          <ChevronRight size={14} />
          <span className="active">
            {isTamil ? `டிஎன்பிஎஸ்சி குரூப் 2 & 2A ${subject.tamilTitle || translateSubjectName(subject.title, language)}` : `TNPSC Group 2 & 2A ${subject.title}`}
          </span>
        </div>

        {/* Back Link & Language Switch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/materials?group=group2_2a" className="back-btn glass" state={{ selectedGroup: 'group2_2a' }}>
            <ArrowLeft size={16} />
            <span>{isTamil ? 'பாடக்குறிப்புகளுக்குத் திரும்பு' : 'Back to Study Materials'}</span>
          </Link>

          <LanguageSwitch />
        </div>

        {/* Subject Navigation Tabs (Order: General Studies, Aptitude and Mental Ability, General English, General Tamil) */}
        <div className="group-tabs glass" style={{ marginBottom: '1.75rem' }}>
          {group2Subjects.map((sub) => (
            <button
              key={sub.id}
              className={`group-tab ${sub.id === subject.id ? 'active' : ''}`}
              onClick={() => navigate(`/materials/group2/${sub.id}`)}
            >
              {isTamil ? (sub.tamilTitle || translateSubjectName(sub.title, language)) : sub.title} ({sub.questionCount} {isTamil ? 'வினா' : 'Qs'})
            </button>
          ))}
        </div>

        {/* Main Header */}
        <motion.div
          className="gs-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="gs-badge-row">
            <span className="gs-badge">
              <Sparkles size={14} />
              TNPSC Group 2 & 2A Preliminary Examination
            </span>
            <span className="gs-code-badge">Syllabus Code: 495</span>
            <span className="gs-badge">{subject.standard}</span>
          </div>

          <h1 className="gs-title">
            {subject.partTag}: {subject.title} <span className="gradient-text">({totalQuestions} Questions)</span>
          </h1>
          <p className="gs-subtitle">
            Authoritative syllabus structure from the official TNPSC notification. Explore all {subject.units.length} distinct
            curated Units, master core chapters, and track lesson-wise progress.
          </p>
        </motion.div>

        {/* Dynamic Summary HUD */}
        <div className="gs-summary-hud">
          <div className="gs-hud-card glass">
            <div className="gs-hud-icon">
              <FileQuestion size={22} />
            </div>
            <div className="gs-hud-info">
              <span className="gs-hud-value">{totalQuestions}</span>
              <span className="gs-hud-label">Total Questions</span>
            </div>
          </div>

          <div className="gs-hud-card glass">
            <div className="gs-hud-icon">
              <Layers size={22} />
            </div>
            <div className="gs-hud-info">
              <span className="gs-hud-value">{subject.units.length} Units</span>
              <span className="gs-hud-label">Syllabus Units</span>
            </div>
          </div>

          <div className="gs-hud-card glass">
            <div className="gs-hud-icon">
              <BookOpen size={22} />
            </div>
            <div className="gs-hud-info">
              <span className="gs-hud-value">{totalChapters}</span>
              <span className="gs-hud-label">Structured Chapters</span>
            </div>
          </div>

          <div className="gs-hud-card glass">
            <div className="gs-hud-icon">
              <GraduationCap size={22} />
            </div>
            <div className="gs-hud-info">
              <span className="gs-hud-value">7 Classes</span>
              <span className="gs-hud-label">6th to 12th Standard</span>
            </div>
          </div>
        </div>

        {/* Classes: 6th to 12th Standard Top Section */}
        <section className="classes-top-section glass">
          <div className="classes-section-header">
            <div className="classes-heading-group">
              <div className="classes-title-badge">
                <GraduationCap size={18} />
                <span>Samacheer Kalvi School Textbook Mapping</span>
              </div>
              <h2 className="classes-main-heading">Classes: 6th to 12th Standard</h2>
              <p className="classes-subheading">
                Click any standard below to view Samacheer Kalvi textbook syllabus, or select a standard
                directly under any Unit card below.
              </p>
            </div>
            <span className="classes-count-badge">7 Standards</span>
          </div>

          <div className="class-cards-grid">
            {standardClasses.map((cls, idx) => (
              <motion.div
                key={cls.id}
                className="class-card glass"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.05 }}
                whileHover={{ scale: 1.03, y: -4 }}
                onClick={() => navigate(`/materials/group2/${subject.id}/unit/1/class/${cls.id}`)}
              >
                <div className="class-card-top">
                  <span className="class-num-badge">{cls.id}th</span>
                  <span className="class-badge-samacheer">Samacheer</span>
                </div>

                <div className="class-card-main">
                  <div className="class-icon-circle">
                    <GraduationCap size={22} />
                  </div>
                  <h3 className="class-card-title">{cls.label}</h3>
                  <p className="class-card-desc">Units 1 to {subject.units.length} mapped textbook lessons</p>
                </div>

                <div className="class-card-cta">
                  <span>Explore Class</span>
                  <ChevronRight size={14} />
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Section Heading for Units */}
        <div className="units-section-header">
          <div className="units-header-left">
            <h2 className="units-section-title">{subject.title} Units ({subject.standard})</h2>
            <p className="units-section-sub">
              Each unit maps all 7 standards (6th to 12th) plus the comprehensive syllabus outline.
            </p>
          </div>
          <span className="units-total-badge">{subject.units.length} Official Units</span>
        </div>

        {/* Unit Cards Responsive Grid with Standard Selectors */}
        <div className="units-grid">
          {subject.units.map((unit: Group2Unit, index: number) => {
            const Icon = unitIcons[unit.id] || BookOpen
            const chapterCount = getGroup2UnitChapterCount(unit)
            const lessonCount = getGroup2UnitLessonCount(unit)

            return (
              <motion.div
                key={unit.id}
                className="unit-card glass"
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                whileHover={{ scale: 1.015, y: -4 }}
                onClick={() => navigate(`/materials/group2/${subject.id}/unit/${unit.id}`)}
              >
                <div className="unit-top-row">
                  <span className="unit-number-pill">{translateUnitNumber(unit.unitNumber, language)}</span>
                  <span className="unit-q-count">{unit.questionCount} {isTamil ? 'வினாக்கள்' : 'Questions'}</span>
                </div>

                <div className="unit-main-header">
                  <div className="unit-icon-box">
                    <Icon size={24} />
                  </div>
                  <div className="unit-title-group">
                    <h2 className="unit-title">{isTamil ? (unit.tamilTitle || unit.title) : unit.title}</h2>
                    {unit.tamilTitle && !isTamil && <span className="unit-tamil-title">{unit.tamilTitle}</span>}
                  </div>
                </div>

                <div className="unit-topics-preview">
                  <span className="unit-topics-heading">{isTamil ? 'அதிகாரப்பூர்வ பாடத்திட்ட எல்லை:' : 'Official Syllabus Scope:'}</span>
                  <p className="unit-topics-snippet">
                    {unit.officialTopics.slice(0, 3).map((t) => translateTopic(t, language)).join(' • ')}...
                  </p>
                </div>

                <div className="unit-metrics">
                  <div className="unit-metric">
                    <BookOpen size={16} />
                    <span>
                      <strong className="unit-metric-bold">{chapterCount}</strong> {isTamil ? 'அத்தியாயங்கள்' : 'Chapters'}
                    </span>
                  </div>
                  <div className="unit-metric">
                    <Layers size={16} />
                    <span>
                      <strong className="unit-metric-bold">{lessonCount}</strong> {isTamil ? 'பாடங்கள்' : 'Lessons'}
                    </span>
                  </div>
                </div>

                {/* Class Selector under each Unit */}
                <div
                  className="unit-class-selector"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="unit-class-selector-header">
                    <div className="unit-class-selector-title">
                      <GraduationCap size={14} />
                      <span>{isTamil ? 'வகுப்பைத் தேர்ந்தெடுக்கவும் (6 முதல் 12 வரை):' : 'Select Class (6th to 12th Standard):'}</span>
                    </div>
                  </div>

                  <div className="unit-class-pills-row">
                    {standardClasses.map((cls) => (
                      <button
                        key={cls.id}
                        type="button"
                        className="unit-class-pill-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/materials/group2/${subject.id}/unit/${unit.id}/class/${cls.id}`)
                        }}
                        title={`Open ${unit.unitNumber} – ${cls.label}`}
                      >
                        {translateClassTitle(cls.label, language)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="unit-btn">
                  <span>Explore Full {unit.unitNumber} Syllabus</span>
                  <ChevronRight size={16} />
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Back Button */}
        <div>
          <Link to="/materials?group=group2_2a" className="back-btn glass" state={{ selectedGroup: 'group2_2a' }}>
            <ArrowLeft size={16} />
            <span>Back to Study Materials</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Group2SubjectDetail
