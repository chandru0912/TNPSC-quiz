import { useState, useEffect } from 'react'
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
  type Group2Unit,
  type Group2Chapter,
  type Group2Lesson,
} from '../data/group2SyllabusData'
import { standardClasses } from '../data/group2ClassSyllabusData'
import { dynamicSyllabusService } from '../services/dynamicSyllabusService'
import { compareLessons } from '../utils/naturalSort'
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
  const staticUnit = getGroup2UnitById(activeSubjectId, parsedUnitId)
  const [unit, setUnit] = useState<Group2Unit | null>(staticUnit || null)

  useEffect(() => {
    let isCancelled = false

    const loadUnitAndLessons = async () => {
      try {
        const [uRes, lRes] = await Promise.all([
          fetch(`/api/study-management/units?examId=group2&subjectId=${activeSubjectId}`),
          fetch(`/api/study-management/lessons?examId=group2&subjectId=${activeSubjectId}&unitNumber=${parsedUnitId}`),
        ])
        const uData = await uRes.json()
        const lData = await lRes.json()
        if (isCancelled) return

        const match =
          uData.success && Array.isArray(uData.units)
            ? uData.units.find((u: any) => Number(u.unit_number) === parsedUnitId)
            : null

        const dbLessons: any[] =
          lData.success && Array.isArray(lData.lessons)
            ? lData.lessons.slice().sort(compareLessons)
            : []

        let dbChapters: Group2Chapter[] | null = null
        if (dbLessons.length > 0) {
          const byStd = new Map<number, any[]>()
          for (const l of dbLessons) {
            const std = Number(l.standard_number) || 6
            if (!byStd.has(std)) byStd.set(std, [])
            byStd.get(std)!.push(l)
          }
          const sortedStds = Array.from(byStd.keys()).sort((a, b) => a - b)
          dbChapters = sortedStds.map((std, idx) => {
            const stdLessons = byStd.get(std)!
            return {
              id: `db-ch-u${parsedUnitId}-s${std}`,
              chapterNumber: idx + 1,
              title: `Class ${std}th Standard Textbook Lessons`,
              description: `Official Samacheer Kalvi Class ${std}th Standard lessons mapped to ${match?.title || staticUnit?.title || `Unit ${parsedUnitId}`}.`,
              lessons: stdLessons.map((l: any) => ({
                id: l.id,
                lessonNumber: l.lesson_number,
                title: l.title,
                duration: l.term || 'Term 1',
                summary: l.description || `Samacheer Kalvi Class ${std}th Standard (${l.term || 'Term 1'})`,
                keyConcepts: [],
                studyNotes: [],
                practiceQuestions: [],
              })),
            }
          })
        }

        if (match || dbChapters) {
          const base = staticUnit || {
            id: parsedUnitId,
            unitNumber: `Unit ${parsedUnitId}`,
            title: `Unit ${parsedUnitId}`,
            tamilTitle: `Unit ${parsedUnitId}`,
            questionCount: 10,
            standard: 'Degree Standard',
            officialTopics: [],
            chapters: [],
          }
          const exactTitle = (match?.title || base.title).trim()
          const exactCode = (match?.unit_code || base.unitNumber).trim()
          setUnit({
            ...base,
            id: parsedUnitId,
            unitNumber: exactCode,
            title: exactTitle,
            tamilTitle: exactTitle,
            questionCount: match?.question_count || base.questionCount,
            officialTopics: match?.description
              ? [match.description]
              : base.officialTopics.length > 0
              ? base.officialTopics
              : [`Syllabus outline for ${exactTitle}`],
            chapters: dbChapters || base.chapters,
          })
        } else {
          setUnit(staticUnit || null)
        }
      } catch {
        // Fallback to staticUnit if network fails
      }
    }

    loadUnitAndLessons()
    const unsubscribe = dynamicSyllabusService.subscribe(() => {
      loadUnitAndLessons()
    })

    return () => {
      isCancelled = true
      unsubscribe()
    }
  }, [activeSubjectId, parsedUnitId, staticUnit])

  if (!subject || !unit) {
    return (
      <div className="unit-detail-page">
        <div className="unit-detail-container">
          <div className="empty-state glass">
            <h2>{'Unit Not Found'}</h2>
            <p>{'The requested TNPSC Group 2 & 2A syllabus unit does not exist.'}</p>
            <Link to="/materials?group=group2_2a" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              <ArrowLeft size={16} />
              <span>{'Back to Group 2 & 2A'}</span>
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
          <Link to="/">{'Home'}</Link>
          <ChevronRight size={14} />
          <Link to="/materials?group=group2_2a">{'Study Materials'}</Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group2/${subject.id}`}>
            {subject.title}
          </Link>
          <ChevronRight size={14} />
          <span className="active">{unit.unitNumber}: {unit.title}</span>
        </div>

        {/* Back Link & Language Switch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to={`/materials/group2/${subject.id}`} className="back-btn glass">
            <ArrowLeft size={16} />
            <span>{`Back to ${subject.title} Units`}</span>
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
                onClick={() => navigate(`/materials/group2/${subject.id}/unit/${unit.id}/lessons`)}
              >
                <BookOpen size={18} />
                <span>{'View Lessons & Notes'}</span>
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
              <span>{'Authoritative Syllabus Topics (TNPSC Code: 495)'}</span>
            </div>
            <span className="syllabus-source-badge">{'Official PDF Notification'}</span>
          </div>

          <div className="syllabus-topics-list">
            {unit.officialTopics.map((topic: string, index: number) => (
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
                {'School Textbook Standards (6th to 12th)'}
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {`Explore school textbook notes and MCQs for ${unit.unitNumber} by class standard:`}
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
                <span>{cls.label}</span>
                <ChevronRight size={14} style={{ color: 'var(--gold-primary)' }} />
              </button>
            ))}
          </div>
        </div>

        {/* Chapter Cards Section */}
        <div className="chapters-section">
          <div className="section-title-row">
            <h2 className="section-heading">
              {`Structured Chapter Breakdown (${chapterCount} Chapters)`}
            </h2>
          </div>

          <div className="chapters-grid">
            {unit.chapters.map((chapter: Group2Chapter, index: number) => (
              <motion.div
                key={chapter.id}
                className="chapter-card glass"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + index * 0.05 }}
              >
                <div className="chapter-header">
                  <span className="chapter-badge">
                    {`Chapter ${chapter.chapterNumber}`}
                  </span>
                  <span className="chapter-lesson-count">
                    {chapter.lessons.length} {'Lessons'}
                  </span>
                </div>

                <h3 className="chapter-title">{chapter.title}</h3>
                {chapter.tamilTitle && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginTop: '-0.3rem', marginBottom: '0.6rem' }}>
                    {chapter.tamilTitle}
                  </span>
                )}

                <div className="chapter-lessons-list">
                  {chapter.lessons.map((lesson: Group2Lesson) => (
                    <div
                      key={lesson.id}
                      className="chapter-lesson-row"
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/materials/group2/${subject.id}/unit/${unit.id}/lessons`)}
                    >
                      <span className="lesson-code-tag">{lesson.lessonNumber}</span>
                      <span className="lesson-row-title" title={lesson.title}>
                        {lesson.title}
                      </span>
                      <span className="status-badge-awaiting">
                        {lesson.practiceQuestions.length} {'MCQs'}
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
              {`Ready to study ${unit.title}?`}
            </span>
            <span className="action-strip-sub">
              {'Access the complete lesson sequence or practice targeted MCQs for this unit.'}
            </span>
          </div>

          <div className="action-strip-buttons">
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/materials/group2/${subject.id}/unit/${unit.id}/lessons`)}
            >
              <FileText size={18} />
              <span>{'View Lessons & Notes'}</span>
            </button>
            <Link
              to={`/practice?group=group2_2a&subjectId=${subject.id}&unitId=${unit.id}&unitTitle=${encodeURIComponent(unit.title)}`}
              className="btn btn-secondary"
            >
              <span>{'Practice Unit MCQs'}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Group2UnitDetail
