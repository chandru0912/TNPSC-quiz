import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
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
  GraduationCap,
} from 'lucide-react'
import {
  getUnitById,
  getUnitChapterCount,
  getUnitLessonCount,
  group1AptitudeUnits,
  type SyllabusUnit,
} from '../data/group1SyllabusData'
import { standardClasses } from '../data/group1ClassSyllabusData'
import { dynamicSyllabusService } from '../services/dynamicSyllabusService'
import { compareLessons } from '../utils/naturalSort'
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
  const location = useLocation()
  const { language, isTamil } = useLanguage()
  const parsedId = parseInt(unitId || '1', 10)
  const isAptitude = location.pathname.includes('/materials/group1/aptitude')
  const activeSubjectId = isAptitude ? 'aptitude' : 'general-studies'
  const subjectHomePath = isAptitude ? '/materials/group1/aptitude' : '/materials/group1/general-studies'
  const subjectBasePath = isAptitude ? '/materials/group1/aptitude' : '/materials/group1'
  const subjectLabel = isAptitude
    ? isTamil
      ? 'திறனறிவும் மனக்கணக்கும்'
      : 'Aptitude & Mental Ability'
    : isTamil
    ? 'பொது அறிவு'
    : 'General Studies'

  const staticAptUnit = isAptitude ? group1AptitudeUnits.find((u) => u.id === parsedId) : undefined
  const staticUnit: SyllabusUnit | undefined = isAptitude
    ? staticAptUnit
      ? {
          id: staticAptUnit.id,
          unitNumber: staticAptUnit.unitNumber,
          title: staticAptUnit.title,
          tamilTitle: staticAptUnit.title,
          questionCount: staticAptUnit.questionCount,
          standard: staticAptUnit.standard,
          color: '#fbbf24',
          officialSyllabusTopics: staticAptUnit.topics,
          chapters: [],
        }
      : undefined
    : getUnitById(parsedId)
  const [unit, setUnit] = useState<SyllabusUnit | null>(staticUnit || null)

  useEffect(() => {
    let isCancelled = false

    const loadUnitAndLessons = async () => {
      try {
        const [uRes, lRes] = await Promise.all([
          fetch(`/api/study-management/units?examId=group1&subjectId=${activeSubjectId}`),
          fetch(`/api/study-management/lessons?examId=group1&subjectId=${activeSubjectId}&unitNumber=${parsedId}`),
        ])
        const uData = await uRes.json()
        const lData = await lRes.json()
        if (isCancelled) return

        const match =
          uData.success && Array.isArray(uData.units)
            ? uData.units.find((u: any) => Number(u.unit_number) === parsedId)
            : null

        const dbLessons: any[] =
          lData.success && Array.isArray(lData.lessons)
            ? lData.lessons.slice().sort(compareLessons)
            : []

        let dbChapters: SyllabusUnit['chapters'] | null = null
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
              id: `db-ch-u${parsedId}-s${std}`,
              chapterNumber: idx + 1,
              title: `Class ${std}th Standard Textbook Lessons`,
              description: `Official Samacheer Kalvi Class ${std}th Standard lessons mapped to ${match?.title || staticUnit?.title || `Unit ${parsedId}`}.`,
              lessons: stdLessons.map((l: any) => ({
                id: l.id,
                lessonNumber: l.lesson_number,
                title: l.title,
                duration: l.term || 'Term 1',
                status: 'Available' as const,
                summary: l.description || `Samacheer Kalvi Class ${std}th Standard (${l.term || 'Term 1'})`,
              })),
            }
          })
        }

        if (match || dbChapters) {
          const base = staticUnit || {
            id: parsedId,
            unitNumber: `Unit ${parsedId}`,
            title: `Unit ${parsedId}`,
            tamilTitle: `Unit ${parsedId}`,
            questionCount: 20,
            standard: 'Degree Standard',
            color: '#3b82f6',
            officialSyllabusTopics: [],
            chapters: [],
          }
          const exactTitle = (match?.title || base.title).trim()
          const exactCode = (match?.unit_code || base.unitNumber).trim()
          setUnit({
            ...base,
            id: parsedId,
            unitNumber: exactCode,
            title: exactTitle,
            tamilTitle: exactTitle,
            questionCount: match?.question_count || base.questionCount,
            officialSyllabusTopics: match?.description
              ? [match.description]
              : base.officialSyllabusTopics.length > 0
              ? base.officialSyllabusTopics
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
  }, [parsedId, activeSubjectId])

  if (!unit) {
    return (
      <div className="unit-detail-page">
        <div className="unit-detail-container">
          <div className="empty-state glass">
            <h2>{isTamil ? 'அலகு கிடைக்கவில்லை' : 'Unit Not Found'}</h2>
            <p>{isTamil ? 'கோரப்பட்ட டிஎன்பிஎஸ்சி குரூப் 1 பாடத்திட்ட அலகு இல்லை.' : 'The requested TNPSC Group 1 syllabus unit does not exist.'}</p>
            <Link to={subjectHomePath} className="btn btn-primary" style={{ marginTop: '1rem' }}>
              <ArrowLeft size={16} />
              <span>{isTamil ? `${subjectLabel} பகுதிக்குத் திரும்பு` : `Back to ${subjectLabel}`}</span>
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
          <Link to={subjectHomePath}>{subjectLabel}</Link>
          <ChevronRight size={14} />
          <span className="active">{translateUnitNumber(unit.unitNumber, language)}: {isTamil ? (unit.tamilTitle || unit.title) : unit.title}</span>
        </div>

        {/* Back Link & Language Switch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to={subjectHomePath} className="back-btn glass">
            <ArrowLeft size={16} />
            <span>{isTamil ? 'அனைத்து அலகுகளுக்கும் திரும்பு' : `Back to ${subjectLabel} Units`}</span>
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
                onClick={() => navigate(`${subjectBasePath}/unit/${unit.id}/lessons`)}
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
                onClick={() => navigate(`${subjectBasePath}/unit/${unit.id}/class/${cls.id}`)}
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
              onClick={() => navigate(`${subjectBasePath}/unit/${unit.id}/lessons`)}
            >
              <FileText size={18} />
              <span>{isTamil ? 'பாடங்கள் & குறிப்புகளைக் காண்க' : 'View Lessons & Notes'}</span>
            </button>
            <Link
              to={`/practice?group=group1&subjectId=${activeSubjectId}&unitId=${unit.id}&unitTitle=${encodeURIComponent(unit.title)}`}
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
