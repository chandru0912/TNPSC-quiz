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
  getGroup4SubjectById,
  getGroup4UnitById,
  getGroup4UnitChapterCount,
  getGroup4UnitLessonCount,
} from '../data/group4SyllabusData'
import { standardClasses } from '../data/group4ClassSyllabusData'
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

const Group4UnitDetail = () => {
  const { subjectId, unitId } = useParams<{ subjectId: string; unitId: string }>()
  const navigate = useNavigate()

  const activeSubjectId = subjectId || 'general-studies'
  const parsedUnitId = parseInt(unitId || '1', 10)

  const subject = getGroup4SubjectById(activeSubjectId)
  const unit = getGroup4UnitById(activeSubjectId, parsedUnitId)

  if (!subject || !unit) {
    return (
      <div className="unit-detail-page">
        <div className="unit-detail-container">
          <div className="empty-state glass">
            <h2>Unit Not Found</h2>
            <p>The requested TNPSC Group 4 & VAO syllabus unit does not exist.</p>
            <Link to="/materials?group=group4_vao" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              <ArrowLeft size={16} />
              <span>Back to Group 4 & VAO</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const chapterCount = getGroup4UnitChapterCount(unit)
  const lessonCount = getGroup4UnitLessonCount(unit)
  const Icon = unitIcons[unit.id] || BookOpen

  return (
    <div className="unit-detail-page">
      <div className="unit-detail-container">
        {/* Breadcrumb Navigation */}
        <div className="unit-detail-breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={14} />
          <Link to="/materials?group=group4_vao">Study Materials</Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group4/${subject.id}`}>{subject.title}</Link>
          <ChevronRight size={14} />
          <span className="active">{unit.unitNumber}: {unit.title}</span>
        </div>

        {/* Back Link */}
        <div>
          <Link to={`/materials/group4/${subject.id}`} className="back-btn glass">
            <ArrowLeft size={16} />
            <span>Back to {subject.title} Units</span>
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
              {unit.questionCount} Questions in Exam
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
                onClick={() => navigate(`/materials/group4/${subject.id}/unit/${unit.id}/lessons`)}
              >
                <BookOpen size={18} />
                <span>View Lessons & Notes</span>
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
              <span>Authoritative Syllabus Topics (TNPSC Code: 496)</span>
            </div>
            <span className="syllabus-source-badge">Official PDF Notification</span>
          </div>

          <div className="syllabus-topics-list">
            {unit.officialTopics.map((topic, index) => (
              <div key={index} className="syllabus-topic-item">
                <span className="topic-bullet">§{index + 1}</span>
                <p>{topic}</p>
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
                School Textbook Standards (6th to 12th)
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Explore school textbook notes and MCQs for {unit.unitNumber} by class standard:
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
                onClick={() => navigate(`/materials/group4/${subject.id}/unit/${unit.id}/class/${cls.id}`)}
              >
                <span>{cls.label}</span>
                <ChevronRight size={14} style={{ color: 'var(--gold-primary)' }} />
              </button>
            ))}
          </div>
        </div>

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
                      onClick={() => navigate(`/materials/group4/${subject.id}/unit/${unit.id}/lessons`)}
                    >
                      <span className="lesson-code-tag">{lesson.lessonNumber}</span>
                      <span className="lesson-row-title" title={lesson.title}>
                        {lesson.title}
                      </span>
                      <span className="status-badge-awaiting">{lesson.practiceQuestions.length} MCQs</span>
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
              onClick={() => navigate(`/materials/group4/${subject.id}/unit/${unit.id}/lessons`)}
            >
              <FileText size={18} />
              <span>View Lessons & Notes</span>
            </button>
            <Link
              to={`/practice?group=group4&subjectId=${subject.id}&unitId=${unit.id}&unitTitle=${encodeURIComponent(unit.title)}`}
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

export default Group4UnitDetail
