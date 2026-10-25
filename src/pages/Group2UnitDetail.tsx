import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen,
  ChevronRight,
  ArrowLeft,
  FileText,
  Clock,
  Layers,
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

  const activeSubjectId = subjectId || 'general-studies'
  const parsedUnitId = parseInt(unitId || '1', 10)

  const subject = getGroup2SubjectById(activeSubjectId)
  const unit = getGroup2UnitById(activeSubjectId, parsedUnitId)

  if (!subject || !unit) {
    return (
      <div className="unit-detail-page">
        <div className="unit-detail-container">
          <div className="empty-state glass">
            <h2>Unit Not Found</h2>
            <p>The requested TNPSC Group 2 & 2A syllabus unit does not exist.</p>
            <Link to="/materials" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              <ArrowLeft size={16} />
              <span>Back to Study Materials</span>
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
          <Link to="/">Home</Link>
          <ChevronRight size={14} />
          <Link to="/materials">Study Materials</Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group2/${subject.id}`}>{subject.title}</Link>
          <ChevronRight size={14} />
          <span className="active">{unit.unitNumber}: {unit.title}</span>
        </div>

        {/* Back Link */}
        <div>
          <Link to={`/materials/group2/${subject.id}`} className="back-btn glass">
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
              <Icon size={38} />
            </div>
            <div className="unit-hero-title-group">
              <h1 className="unit-hero-title">{unit.title}</h1>
              {unit.tamilTitle && <span className="unit-hero-tamil">{unit.tamilTitle}</span>}
              <div className="unit-hero-meta">
                <span>{chapterCount} Chapters</span>
                <span>•</span>
                <span>{lessonCount} Lessons & Practice MCQs</span>
                <span>•</span>
                <span>{unit.standard}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Official Syllabus Scope Section */}
        <div className="syllabus-scope-section glass">
          <div className="syllabus-scope-header">
            <FileText size={20} className="syllabus-scope-icon" />
            <h2 className="syllabus-scope-title">Official Syllabus Scope (PDF Source)</h2>
          </div>
          <p className="syllabus-scope-sub">
            The following topics are mandated by the official TNPSC Group 2 & 2A Preliminary notification:
          </p>
          <ul className="syllabus-topics-list">
            {unit.officialTopics.map((topic, idx) => (
              <li key={idx} className="syllabus-topic-item">
                <span className="topic-bullet" />
                <span>{topic}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Standard-Wise Breakdown Section */}
        <div className="unit-class-breakdown-section glass">
          <div className="unit-class-breakdown-header">
            <GraduationCap size={20} />
            <div>
              <h3 className="breakdown-title">School Textbook Standards (6th to 12th)</h3>
              <p className="breakdown-sub">
                Explore school textbook notes and MCQs for {unit.unitNumber} by class:
              </p>
            </div>
          </div>

          <div className="breakdown-pills-grid">
            {standardClasses.map((cls) => (
              <button
                key={cls.id}
                type="button"
                className="breakdown-pill-btn"
                onClick={() => navigate(`/materials/group2/${subject.id}/unit/${unit.id}/class/${cls.id}`)}
              >
                <GraduationCap size={16} />
                <span>{cls.label}</span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </div>

        {/* Chapters Stack */}
        <div className="unit-chapters-section">
          <div className="chapters-header">
            <h2 className="chapters-section-title">Chapters in {unit.unitNumber}</h2>
            <Link
              to={`/materials/group2/${subject.id}/unit/${unit.id}/lessons`}
              className="btn btn-primary"
            >
              <span>View All Lessons & Notes</span>
              <ChevronRight size={16} />
            </Link>
          </div>

          <div className="chapters-grid">
            {unit.chapters.map((chapter) => (
              <div key={chapter.id} className="chapter-card glass">
                <div className="chapter-card-header">
                  <span className="chapter-badge">Chapter {chapter.chapterNumber}</span>
                  <span className="chapter-lesson-count">{chapter.lessons.length} Lessons</span>
                </div>
                <h3 className="chapter-title">{chapter.title}</h3>
                {chapter.tamilTitle && <span className="chapter-sub-title">{chapter.tamilTitle}</span>}

                <div className="chapter-lessons-preview">
                  {chapter.lessons.map((lesson) => (
                    <div key={lesson.id} className="chapter-lesson-item">
                      <span className="lesson-dot" />
                      <span className="lesson-name">{lesson.title}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to={`/materials/group2/${subject.id}/unit/${unit.id}/lessons`}
                  className="chapter-action-btn"
                >
                  <span>Open Chapter Notes</span>
                  <ChevronRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Group2UnitDetail
