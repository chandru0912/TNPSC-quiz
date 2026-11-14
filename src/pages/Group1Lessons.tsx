import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
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
  group1AptitudeUnits,
  type SyllabusUnit,
} from '../data/group1SyllabusData'
import { dynamicSyllabusService } from '../services/dynamicSyllabusService'
import { compareLessons } from '../utils/naturalSort'
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
      <div className="lessons-page">
        <div className="lessons-container">
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

  return (
    <div className="lessons-page">
      <div className="lessons-container">
        {/* Breadcrumb Navigation */}
        <div className="lessons-breadcrumb">
          <Link to="/">{isTamil ? 'முகப்பு' : 'Home'}</Link>
          <ChevronRight size={14} />
          <Link to="/materials">{isTamil ? 'பாடக்குறிப்புகள்' : 'Study Materials'}</Link>
          <ChevronRight size={14} />
          <Link to={subjectHomePath}>{subjectLabel}</Link>
          <ChevronRight size={14} />
          <Link to={`${subjectBasePath}/unit/${unit.id}`}>{translateUnitNumber(unit.unitNumber, language)}</Link>
          <ChevronRight size={14} />
          <span className="active">{isTamil ? 'பாடங்கள் & குறிப்புகள்' : 'Lessons & Notes'}</span>
        </div>

        {/* Back Link & Language Switch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to={`${subjectBasePath}/unit/${unit.id}`} className="back-btn glass">
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
                          navigate(`/study-notes/group1/subject/${activeSubjectId}/unit/${unit.id}/lesson/${encodeURIComponent(lesson.title)}?chapter=${encodeURIComponent(chapter.title)}&chapterNum=${chapter.chapterNumber}&lang=${isTamil ? 'tamil' : 'english'}${lesson.id ? `&lessonId=${encodeURIComponent(lesson.id)}` : ''}${lesson.lessonNumber ? `&lessonNumber=${encodeURIComponent(lesson.lessonNumber)}` : ''}${(lesson as any).term ? `&term=${encodeURIComponent((lesson as any).term)}` : ''}`)
                        }
                      >
                        <span>{isTamil ? 'பாடக் குறிப்புகள் படிக்க' : 'Read Study Notes'}</span>
                        <ChevronRight size={14} />
                      </button>
                      <button
                        className="view-lesson-btn"
                        style={{ marginLeft: '0.4rem', background: 'linear-gradient(135deg, rgba(255,215,0,0.18), rgba(245,158,11,0.28))', borderColor: 'rgba(255,215,0,0.5)', color: '#ffd700' }}
                        onClick={() =>
                          navigate(`/study-materials/practice/group1/${activeSubjectId}/all/${unit.id}/${encodeURIComponent(lesson.id || '')}?lessonTitle=${encodeURIComponent(lesson.title)}`)
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
