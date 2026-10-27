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
  const parsedId = parseInt(unitId || '1', 10)
  const unit = getUnitById(parsedId)

  if (!unit) {
    return (
      <div className="unit-detail-page">
        <div className="unit-detail-container">
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
  const Icon = unitIcons[unit.id] || BookOpen

  return (
    <div className="unit-detail-page">
      <div className="unit-detail-container">
        {/* Breadcrumb Navigation */}
        <div className="unit-detail-breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={14} />
          <Link to="/materials">Study Materials</Link>
          <ChevronRight size={14} />
          <Link to="/materials/group1/general-studies">General Studies</Link>
          <ChevronRight size={14} />
          <span className="active">{unit.unitNumber}: {unit.title}</span>
        </div>

        {/* Back Link */}
        <div>
          <Link to="/materials/group1/general-studies" className="back-btn glass">
            <ArrowLeft size={16} />
            <span>Back to General Studies Units</span>
          </Link>
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
                <span>View Lessons & Notes</span>
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
              <span>Authoritative Syllabus Topics (TNPSC Code: 497)</span>
            </div>
            <span className="syllabus-source-badge">Official PDF Notification</span>
          </div>

          <div className="syllabus-topics-list">
            {unit.officialSyllabusTopics.map((topic, index) => (
              <div key={index} className="syllabus-topic-item">
                <span className="topic-bullet">§{index + 1}</span>
                <p>{topic}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Chapter Cards Section */}
        <div className="chapters-section">
          <div className="section-title-row">
            <h2 className="section-heading">Structured Chapter Breakdown ({chapterCount} Chapters)</h2>
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
                  <span className="chapter-badge">Chapter {chapter.chapterNumber}</span>
                  <span className="chapter-lesson-count">{chapter.lessons.length} Lessons</span>
                </div>

                <h3 className="chapter-title">{chapter.title}</h3>

                <div className="chapter-lessons-list">
                  {chapter.lessons.map((lesson) => (
                    <div key={lesson.id} className="chapter-lesson-row">
                      <span className="lesson-code-tag">{lesson.lessonNumber}</span>
                      <span className="lesson-row-title" title={lesson.title}>
                        {lesson.title}
                      </span>
                      <span className="status-badge-awaiting">{lesson.status}</span>
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
            <span className="action-strip-title">Ready to study {unit.title}?</span>
            <span className="action-strip-sub">
              Access the complete lesson sequence or practice targeted MCQs for this unit.
            </span>
          </div>

          <div className="action-strip-buttons">
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/materials/group1/unit/${unit.id}/lessons`)}
            >
              <FileText size={18} />
              <span>View Lessons & Notes</span>
            </button>
            <Link
              to={`/practice?group=group1&unitId=${unit.id}&unitTitle=${encodeURIComponent(unit.title)}`}
              className="btn btn-secondary"
            >
              <span>Practice Unit MCQs</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Group1UnitDetail
