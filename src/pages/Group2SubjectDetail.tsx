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
  Calculator,
  Languages,
} from 'lucide-react'
import {
  getGroup2SubjectById,
  getGroup2UnitChapterCount,
  getGroup2UnitLessonCount,
  getTotalGroup2SubjectChapters,
  getTotalGroup2SubjectLessons,
  type Group2Unit,
} from '../data/group2SyllabusData'
import { standardClasses } from '../data/group2ClassSyllabusData'
import './Group1GeneralStudies.css'

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

  const activeSubjectId = subjectId || 'general-studies'
  const subject = getGroup2SubjectById(activeSubjectId)

  if (!subject) {
    return (
      <div className="gs-page">
        <div className="gs-container">
          <div className="empty-state glass" style={{ padding: '3rem', textAlign: 'center' }}>
            <h2>Subject Not Found</h2>
            <p>The requested TNPSC Group 2 & 2A syllabus subject does not exist.</p>
            <Link to="/materials" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              <ArrowLeft size={16} />
              <span>Back to Study Materials</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const totalQuestions = subject.questionCount
  const totalChapters = getTotalGroup2SubjectChapters(subject)
  const totalLessons = getTotalGroup2SubjectLessons(subject)

  return (
    <div className="gs-page">
      <div className="gs-container">
        {/* Breadcrumb Navigation */}
        <div className="gs-breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={14} />
          <Link to="/materials">Study Materials</Link>
          <ChevronRight size={14} />
          <span className="active">TNPSC Group 2 & 2A: {subject.title}</span>
        </div>

        {/* Back Link */}
        <div>
          <Link to="/materials" className="back-btn glass">
            <ArrowLeft size={16} />
            <span>Back to All Categories</span>
          </Link>
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
            <span className="gs-code-badge">{subject.partTag}</span>
          </div>

          <h1 className="gs-title">
            {subject.title} <span className="gradient-text">({totalQuestions} Questions)</span>
          </h1>
          <p className="gs-subtitle">
            {subject.description} Explore all {subject.units.length} distinct curated Units, master core chapters,
            and track lesson-wise progress mapped specifically to the official syllabus PDF.
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
                <span>TNPSC Group 2 & 2A Standard-Wise Syllabus</span>
              </div>
              <h2 className="classes-main-heading">Classes: 6th to 12th Standard</h2>
              <p className="classes-sub-heading">
                Click any standard below to view Samacheer Kalvi school textbook topics mapped to this subject:
              </p>
            </div>
          </div>

          <div className="class-cards-grid">
            {standardClasses.map((cls) => (
              <button
                key={cls.id}
                type="button"
                className="class-card glass"
                onClick={() => navigate(`/materials/group2/${subject.id}/class/${cls.id}`)}
              >
                <div className="class-card-top">
                  <span className="class-badge-pill">{cls.shortLabel}</span>
                  <ChevronRight size={16} className="class-card-arrow" />
                </div>
                <div className="class-card-icon-box">
                  <GraduationCap size={24} />
                </div>
                <span className="class-card-title">{cls.label}</span>
                <span className="class-card-sub">School Textbook Notes & MCQs</span>
              </button>
            ))}
          </div>
        </section>

        {/* Units Section Header */}
        <div className="units-section-header">
          <div>
            <h2 className="units-section-title">Official Syllabus Units ({subject.units.length} Units)</h2>
            <p className="units-section-desc">
              Select any Unit below to access its chapters, lessons, study notes, and MCQ practice questions:
            </p>
          </div>
        </div>

        {/* Units Grid */}
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
                  <span className="unit-number-pill">{unit.unitNumber}</span>
                  <span className="unit-q-count">{unit.questionCount} Questions</span>
                </div>

                <div className="unit-main-header">
                  <div className="unit-icon-box">
                    <Icon size={24} />
                  </div>
                  <div className="unit-title-group">
                    <h2 className="unit-title">{unit.title}</h2>
                    {unit.tamilTitle && <span className="unit-tamil-title">{unit.tamilTitle}</span>}
                  </div>
                </div>

                <div className="unit-topics-preview">
                  <span className="unit-topics-heading">Official Syllabus Scope:</span>
                  <p className="unit-topics-snippet">
                    {unit.officialTopics.slice(0, 3).join(' • ')}...
                  </p>
                </div>

                <div className="unit-metrics">
                  <div className="unit-metric">
                    <BookOpen size={16} />
                    <span>
                      <strong className="unit-metric-bold">{chapterCount}</strong> Chapters
                    </span>
                  </div>
                  <div className="unit-metric">
                    <Layers size={16} />
                    <span>
                      <strong className="unit-metric-bold">{lessonCount}</strong> Lessons
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
                      <span>Select Class (6th to 12th Standard):</span>
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
                        {cls.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className="unit-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/materials/group2/${subject.id}/unit/${unit.id}/lessons`)
                  }}
                >
                  <span>View Lessons & Notes</span>
                  <ChevronRight size={16} />
                </button>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Group2SubjectDetail
