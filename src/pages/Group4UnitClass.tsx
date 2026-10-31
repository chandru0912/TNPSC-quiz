import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useScrollLock } from '../hooks/useScrollLock'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  GraduationCap,
  Layers,
  Sparkles,
  Atom,
  Globe2,
  Landmark,
  Scale,
  TrendingUp,
  ScrollText,
  Clock,
  CheckCircle2,
  FileQuestion,
  X,
  XCircle,
  RotateCcw,
  Award,
} from 'lucide-react'
import {
  getGroup4UnitClassData,
  standardClasses,
  type Group4SchoolLesson,
} from '../data/group4ClassSyllabusData'
import { getGroup4SubjectById } from '../data/group4SyllabusData'
import { useLanguage } from '../context/LanguageContext'
import LanguageSwitch from '../components/LanguageSwitch'
import {
  translateTopic,
  translateLesson,
  translateClassTitle,
  translateUnitNumber,
  translateSubjectName,
  translateLessonTitle,
} from '../utils/bilingualSyllabus'
import { translateQuestionItem } from '../utils/languageData'
import './Group1UnitClass.css'
import './Group1Lessons.css'

const unitIcons: Record<number, any> = {
  1: Atom,
  2: Globe2,
  3: Landmark,
  4: Scale,
  5: TrendingUp,
  6: ScrollText,
  7: Sparkles,
}

const Group4UnitClass = () => {
  const { subjectId, unitId, classId } = useParams<{
    subjectId: string
    unitId?: string
    classId: string
  }>()
  const navigate = useNavigate()
  const { language, isTamil } = useLanguage()

  const activeSubjectId = subjectId || 'general-studies'
  const parsedUnitId = parseInt(unitId || '1', 10)
  const parsedClassId = parseInt(classId || '6', 10)

  const subject = getGroup4SubjectById(activeSubjectId)
  const data = getGroup4UnitClassData(activeSubjectId, parsedUnitId, parsedClassId)
  const Icon = unitIcons[parsedUnitId] || BookOpen
  const lessons = data.lessons || []
  const hasLessons = lessons.length > 0

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (document.documentElement) document.documentElement.scrollTop = 0
    if (document.body) document.body.scrollTop = 0
  }, [activeSubjectId, parsedUnitId, parsedClassId])

  // Interactive Modal State
  const [activeModalLesson, setActiveModalLesson] = useState<Group4SchoolLesson | null>(null)
  const [activeModalTab, setActiveModalTab] = useState<'notes' | 'quiz'>('notes')
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({})

  // Lock background scroll when interactive lesson modal is open
  useScrollLock(Boolean(activeModalLesson))

  // modal handlers removed - using full page navigation

  const handleOptionSelect = (qId: string, optIdx: number) => {
    if (selectedAnswers[qId] !== undefined) return
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optIdx }))
  }

  const handleResetQuiz = () => {
    setSelectedAnswers({})
  }

  // Quiz Score calculation
  const totalQuestions = activeModalLesson?.practiceMCQs?.length || 0
  const answeredCount = activeModalLesson?.practiceMCQs?.filter(
    (q) => selectedAnswers[q.id] !== undefined
  ).length || 0
  const correctCount = activeModalLesson?.practiceMCQs?.filter(
    (q) => selectedAnswers[q.id] === q.correctAnswer
  ).length || 0
  const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

  return (
    <div className="unit-class-page">
      <div className="unit-class-container">
        {/* Breadcrumb Navigation */}
        <div className="unit-class-breadcrumb">
          <Link to="/">{isTamil ? 'முகப்பு' : 'Home'}</Link>
          <ChevronRight size={14} />
          <Link to="/materials?group=group4_vao">{isTamil ? 'பாடக்குறிப்புகள்' : 'Study Materials'}</Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group4/${activeSubjectId}`}>
            {isTamil ? (subject?.tamilTitle || translateSubjectName(subject?.title || data.subjectTitle, language)) : (subject?.title || data.subjectTitle)}
          </Link>
          <ChevronRight size={14} />
          <span className="active">
            {translateUnitNumber(data.unitNumber, language)} – {translateClassTitle(data.classTitle, language)}
          </span>
        </div>

        {/* Top Back Navigation Bar & Language Switch */}
        <div className="unit-class-top-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to={`/materials/group4/${activeSubjectId}`} className="back-btn glass">
              <ArrowLeft size={16} />
              <span>{isTamil ? 'பாடம் தெரிவுக்குத் திரும்பு' : `Back to ${subject?.title || 'General Studies'}`}</span>
            </Link>

            <Link
              to={`/materials/group4/${activeSubjectId}/unit/${parsedUnitId}`}
              className="back-btn glass"
            >
              <BookOpen size={16} />
              <span>{isTamil ? `முழு பாடத்திட்டம் (${translateUnitNumber(data.unitNumber, language)})` : `View Full ${data.unitNumber} Syllabus`}</span>
            </Link>
          </div>

          <LanguageSwitch />
        </div>

        {/* Hero Card */}
        <motion.div
          className="unit-class-hero glass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="unit-class-hero-badges">
            <span className="hero-badge hero-badge-gold">
              <Sparkles size={13} />
              {isTamil ? 'டிஎன்பிஎஸ்சி குரூப் 4 & விஏஓ' : `TNPSC Group 4 & VAO ${subject?.title || ''}`}
            </span>
            <span className="hero-badge hero-badge-cyan">{translateUnitNumber(data.unitNumber, language)}</span>
            <span className="hero-badge hero-badge-purple">
              <GraduationCap size={14} />
              {translateClassTitle(data.classTitle, language)}
            </span>
            <span className="hero-badge hero-badge-sub">{isTamil ? 'சமச்சீர் கல்வி' : 'Samacheer Kalvi'}</span>
          </div>

          <div className="unit-class-hero-main">
            <div className="unit-class-icon-box">
              <Icon size={34} />
            </div>
            <div className="unit-class-title-group">
              <h1 className="unit-class-hero-title">
                {translateUnitNumber(data.unitNumber, language)}: {isTamil ? translateTopic(data.unitTitle, language) : data.unitTitle} –{' '}
                <span className="gold-text">{translateClassTitle(data.classTitle, language)}</span>
              </h1>
              <p className="unit-class-hero-sub">
                {isTamil
                  ? 'டிஎன்பிஎஸ்சி குரூப் 4 மற்றும் விஏஓ தேர்வுக்கான அதிகாரப்பூர்வ தமிழ்நாடு சமச்சீர் கல்வி பாடத்திட்டம் (குறியீடு: 496).'
                  : 'Official Samacheer Kalvi Tamil Nadu State Board textbook curriculum aligned with TNPSC Group 4 & VAO Examination Syllabus (Code: 496).'}
              </p>
            </div>
          </div>

          {/* Quick Switchers: Classes and Units */}
          <div className="switchers-wrapper glass">
            {/* Standard Switcher (6th to 10th) */}
            <div className="switcher-row">
              <span className="switcher-label">{isTamil ? 'வகுப்பைத் தேர்ந்தெடுக்கவும்:' : 'Select Standard:'}</span>
              <div className="switcher-pills">
                {standardClasses.map((cls) => {
                  const isActive = cls.id === parsedClassId
                  return (
                    <button
                      key={cls.id}
                      className={`switcher-pill ${isActive ? 'active' : ''}`}
                      onClick={() =>
                        navigate(
                          `/materials/group4/${activeSubjectId}/unit/${parsedUnitId}/class/${cls.id}`
                        )
                      }
                    >
                      {translateClassTitle(cls.label, language)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Unit Switcher */}
            <div className="switcher-row">
              <span className="switcher-label">{isTamil ? 'அலகைத் தேர்ந்தெடுக்கவும்:' : 'Select Unit:'}</span>
              <div className="switcher-pills">
                {(subject?.units || []).map((u) => {
                  const isActive = u.id === parsedUnitId
                  return (
                    <button
                      key={u.id}
                      className={`switcher-pill unit-pill ${isActive ? 'active' : ''}`}
                      onClick={() =>
                        navigate(
                          `/materials/group4/${activeSubjectId}/unit/${u.id}/class/${parsedClassId}`
                        )
                      }
                      title={isTamil ? translateTopic(u.title, language) : u.title}
                    >
                      {translateUnitNumber(u.unitNumber, language)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Mapped Syllabus Scope for this Standard */}
        {data.topics && data.topics.length > 0 && (
          <motion.div
            className="unit-class-topics-box glass"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="topics-box-header">
              <div className="topics-box-title">
                <BookOpen size={18} />
                <span>
                  {isTamil
                    ? `பாடநூல் பாடத்திட்டம் & முக்கிய தலைப்புகள் (${translateClassTitle(data.classTitle, language)})`
                    : `Textbook Syllabus & Focus Areas (${data.classTitle})`}
                </span>
              </div>
              <span className="topics-count-badge">
                {data.topics.length} {isTamil ? 'முக்கியத் தலைப்புகள்' : 'Key Topics'}
              </span>
            </div>

            <div className="topics-chips-list">
              {data.topics.map((topic, idx) => (
                <div key={idx} className="topic-chip">
                  <span className="topic-chip-num">{idx + 1}</span>
                  <span className="topic-chip-text">{translateTopic(topic, language)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Lessons Section */}
        <div className="unit-class-lessons-section">
          <div className="section-head-bar">
            <div>
              <h2 className="section-title">
                {isTamil ? `${translateClassTitle(data.classTitle, language)}-க்கான பாடங்கள்` : `Curated Lessons for ${data.classTitle}`}
              </h2>
              <p className="section-sub">
                {isTamil
                  ? `${translateTopic(data.unitTitle, language)} பாடத்திற்குரிய சமச்சீர் கல்வி பள்ளிப் பாடநூல் அத்தியாயங்கள்`
                  : `Samacheer Kalvi school textbook chapters mapped to ${data.unitTitle}`}
              </p>
            </div>
            {hasLessons && (
              <span className="lessons-count-pill">
                <Layers size={14} />
                {lessons.length} {isTamil ? 'பாடங்கள் கிடைக்கக்கூடியவை' : 'Lessons Available'}
              </span>
            )}
          </div>

          {hasLessons ? (
            <div className="lessons-grid">
              {lessons.map((lesson: Group4SchoolLesson, index: number) => {
                const tLesson = translateLesson(lesson, language)
                const practiceUrl = `/study-materials/practice/group4/${activeSubjectId}/${data.classId}/${data.unitId}/${encodeURIComponent(lesson.id || '')}?lessonTitle=${encodeURIComponent(lesson.title)}`

                return (
                  <motion.div
                    key={lesson.id}
                    className="lesson-card glass"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: index * 0.05 }}
                  >
                    <div className="lesson-top-meta">
                      <span className="lesson-num-badge">
                        {isTamil ? `பாடம் ${tLesson.lessonNumber}` : `Lesson ${lesson.lessonNumber}`}
                      </span>
                      {tLesson.term && <span className="lesson-term-badge">{tLesson.term}</span>}
                      <span className="lesson-status-badge">
                        <CheckCircle2 size={12} />
                        {tLesson.status}
                      </span>
                    </div>

                    <h3 className="lesson-title">{tLesson.title}</h3>

                    {tLesson.description && (
                      <p className="lesson-desc">{tLesson.description}</p>
                    )}

                    <div className="lesson-action-row">
                      <button
                        className="lesson-read-btn"
                        onClick={() => {
                          const lessonTitle = lesson.title
                          navigate(`/study-notes/group4_vao/subject/${activeSubjectId}/unit/${parsedUnitId}/lesson/${encodeURIComponent(lessonTitle)}?lang=${isTamil ? 'tamil' : 'english'}${parsedClassId ? `&classId=${parsedClassId}` : ''}${lesson.id ? `&lessonId=${encodeURIComponent(lesson.id)}` : ''}${lesson.lessonNumber ? `&lessonNumber=${encodeURIComponent(lesson.lessonNumber)}` : ''}`)
                        }}
                        title={isTamil ? `${lesson.title} பாடக் குறிப்புகளைப் படிக்க` : `Read study notes for ${lesson.title}`}
                      >
                        <FileQuestion size={15} />
                        <span>{isTamil ? 'பாடக் குறிப்புகளைப் படிக்க' : 'Read Study Notes'}</span>
                      </button>
                      <Link
                        to={practiceUrl}
                        className="lesson-practice-btn"
                        title={isTamil ? 'இப்பாடத்திற்கான வினாக்களைப் பயிற்சி செய்' : 'Practice MCQs for this lesson'}
                      >
                        <span>{isTamil ? 'பயிற்சி வினாக்கள்' : 'Practice MCQs'}</span>
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <motion.div
              className="empty-lessons-box glass"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="empty-icon-circle">
                <Clock size={32} />
              </div>
              <h3 className="empty-heading">Lessons coming soon.</h3>
              <p className="empty-subtext">
                Comprehensive Samacheer Kalvi lesson notes and chapter-wise question banks for{' '}
                <strong>
                  {data.unitTitle} ({data.classTitle})
                </strong>{' '}
                are currently being curated by subject experts according to the official TNPSC Group 4 & VAO syllabus.
              </p>
              <div className="empty-actions">
                <Link to="/practice" className="btn btn-primary">
                  <FileQuestion size={16} />
                  <span>Practice General Studies MCQs</span>
                </Link>
                <Link to={`/materials/group4/${activeSubjectId}`} className="btn btn-secondary">
                  <ArrowLeft size={16} />
                  <span>Choose Another Standard</span>
                </Link>
              </div>
            </motion.div>
          )}
        </div>

        {/* Back navigation footer */}
        <div className="unit-class-footer-nav">
          <Link to={`/materials/group4/${activeSubjectId}`} className="back-btn glass">
            <ArrowLeft size={16} />
            <span>Back to {subject?.title || 'General Studies'} Main Page</span>
          </Link>
        </div>

        {/* Interactive Modal Drawer for Study Notes & Practice MCQs */}
        <AnimatePresence>
          {activeModalLesson && (
            <div
              className="lesson-modal-overlay"
              onClick={() => setActiveModalLesson(null)}
            >
              <motion.div
                className="lesson-modal glass"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-head">
                  <div className="modal-title-group">
                    <span className="modal-code-pill">
                      {translateClassTitle(data.classTitle, language)} • {isTamil ? 'பாடம்' : 'Lesson'} {activeModalLesson.lessonNumber}
                    </span>
                    <h3 className="modal-title">{translateLessonTitle(activeModalLesson.title, language)}</h3>
                  </div>

                  <button
                    className="modal-close-btn"
                    onClick={() => setActiveModalLesson(null)}
                    aria-label="Close modal"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="g2-modal-tabs" style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
                  <button
                    className={`switcher-pill ${activeModalTab === 'notes' ? 'active' : ''}`}
                    onClick={() => setActiveModalTab('notes')}
                  >
                    <BookOpen size={15} style={{ display: 'inline', marginRight: '6px' }} />
                    {isTamil ? 'பாடக் குறிப்புகள் & சுருக்கம்' : 'Study Notes & Summary'}
                  </button>
                  <button
                    className={`switcher-pill ${activeModalTab === 'quiz' ? 'active' : ''}`}
                    onClick={() => setActiveModalTab('quiz')}
                  >
                    <Sparkles size={15} style={{ display: 'inline', marginRight: '6px' }} />
                    {isTamil ? `பயிற்சி வினாடி வினா (${activeModalLesson.practiceMCQs?.length || 0} வினாக்கள்)` : `Practice Quiz (${activeModalLesson.practiceMCQs?.length || 0} Questions)`}
                  </button>
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  {activeModalTab === 'notes' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {activeModalLesson.keyConcepts && activeModalLesson.keyConcepts.length > 0 && (
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {isTamil ? 'முக்கியக் கருத்துகள்:' : 'Core Concepts:'}
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
                            {activeModalLesson.keyConcepts.map((concept, idx) => (
                              <span
                                key={idx}
                                style={{
                                  padding: '0.3rem 0.75rem',
                                  borderRadius: '9999px',
                                  background: 'rgba(255,215,0,0.1)',
                                  border: '1px solid rgba(255,215,0,0.3)',
                                  color: 'var(--gold-primary)',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                }}
                              >
                                {translateTopic(concept, language)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {isTamil ? 'பாடக் குறிப்புகள்:' : 'Lesson Study Notes:'}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                          {(activeModalLesson.studyNotes || [
                            activeModalLesson.description || 'Comprehensive syllabus notes for this Samacheer Kalvi lesson.',
                            'Follows the official Tamil Nadu SCERT curriculum aligned with TNPSC Group 4 & VAO exam requirements.',
                          ]).map((note, nIdx) => (
                            <div
                              key={nIdx}
                              style={{
                                padding: '1rem',
                                borderRadius: '8px',
                                background: 'rgba(10, 16, 32, 0.6)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.875rem',
                                lineHeight: '1.6',
                              }}
                            >
                              {translateTopic(note, language)}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <Link
                          to={`/study-materials/practice/group4/${activeSubjectId}/${data.classId}/${data.unitId}/${encodeURIComponent(activeModalLesson.id || '')}?lessonTitle=${encodeURIComponent(activeModalLesson.title)}`}
                          className="lesson-practice-btn"
                          style={{ padding: '0.65rem 1.25rem', textDecoration: 'none' }}
                          onClick={() => setActiveModalLesson(null)}
                        >
                          <Award size={16} />
                          <span>{isTamil ? 'பயிற்சி வினாக்களைத் தொடங்க' : 'Finish & Practice MCQs'}</span>
                          <ChevronRight size={14} />
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Score Tracking Banner */}
                      <div
                        style={{
                          padding: '0.85rem 1.15rem',
                          borderRadius: '8px',
                          background: 'rgba(255,215,0,0.08)',
                          border: '1px solid rgba(255,215,0,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {isTamil ? 'பதிலளித்தவை:' : 'Answered:'} <strong>{answeredCount}</strong> {isTamil ? 'இல்' : 'of'} <strong>{totalQuestions}</strong>
                        </span>
                        <span style={{ fontSize: '0.875rem', color: 'var(--gold-primary)', fontWeight: 700 }}>
                          {isTamil ? 'தற்போதைய மதிப்பெண்:' : 'Current Score:'} {correctCount}/{answeredCount} ({answeredCount > 0 ? scorePercent : 0}%)
                        </span>
                      </div>

                      {(activeModalLesson.practiceMCQs || []).length > 0 ? (
                        activeModalLesson.practiceMCQs!.map((q, qIndex) => {
                          const userAnswer = selectedAnswers[q.id]
                          const isAnswered = userAnswer !== undefined
                          const isCorrect = isAnswered && userAnswer === q.correctAnswer
                          const translatedQ = translateQuestionItem(
                            {
                              id: q.id,
                              category: 'group4_vao',
                              tag: `${data.unitNumber} • ${activeModalLesson.title}`,
                              question: q.question,
                              options: q.options,
                              correctAnswer: q.correctAnswer,
                              explanation: q.explanation,
                            },
                            language
                          )

                          return (
                            <div
                              key={q.id}
                              style={{
                                padding: '1.25rem',
                                borderRadius: '10px',
                                background: 'rgba(10, 16, 32, 0.65)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.85rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                <span
                                  style={{
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '6px',
                                    background: 'rgba(255,215,0,0.15)',
                                    color: 'var(--gold-primary)',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                  }}
                                >
                                  {isTamil ? `வினா ${qIndex + 1}` : `Q${qIndex + 1}`}
                                </span>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>
                                  {translatedQ.question}
                                </span>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {translatedQ.options.map((opt, optIdx) => {
                                  const letter = String.fromCharCode(65 + optIdx)
                                  let bg = 'rgba(255,255,255,0.04)'
                                  let borderColor = 'rgba(255,255,255,0.08)'
                                  let textColor = 'var(--text-secondary)'

                                  if (isAnswered) {
                                    if (optIdx === q.correctAnswer) {
                                      bg = 'rgba(34, 197, 94, 0.18)'
                                      borderColor = '#4ade80'
                                      textColor = '#4ade80'
                                    } else if (optIdx === userAnswer) {
                                      bg = 'rgba(239, 68, 68, 0.18)'
                                      borderColor = '#f87171'
                                      textColor = '#f87171'
                                    }
                                  }

                                  return (
                                    <button
                                      key={optIdx}
                                      type="button"
                                      disabled={isAnswered}
                                      onClick={() => handleOptionSelect(q.id, optIdx)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '8px',
                                        background: bg,
                                        border: `1px solid ${borderColor}`,
                                        color: textColor,
                                        fontSize: '0.85rem',
                                        cursor: isAnswered ? 'default' : 'pointer',
                                        textAlign: 'left',
                                        transition: 'all 0.2s ease',
                                      }}
                                    >
                                      <span
                                        style={{
                                          width: '24px',
                                          height: '24px',
                                          borderRadius: '50%',
                                          background: 'rgba(255,255,255,0.08)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 700,
                                          fontSize: '0.75rem',
                                        }}
                                      >
                                        {letter}
                                      </span>
                                      <span style={{ flex: 1 }}>{opt}</span>
                                      {isAnswered && optIdx === q.correctAnswer && (
                                        <CheckCircle2 size={16} color="#4ade80" />
                                      )}
                                      {isAnswered && optIdx === userAnswer && optIdx !== q.correctAnswer && (
                                        <XCircle size={16} color="#f87171" />
                                      )}
                                    </button>
                                  )
                                })}
                              </div>

                              {isAnswered && (
                                <div
                                  style={{
                                    marginTop: '0.4rem',
                                    padding: '0.85rem 1rem',
                                    borderRadius: '8px',
                                    background: isCorrect ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    border: `1px solid ${isCorrect ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: '0.8rem',
                                      fontWeight: 700,
                                      color: isCorrect ? '#4ade80' : '#f87171',
                                      marginBottom: '0.25rem',
                                    }}
                                  >
                                    {isCorrect
                                      ? (isTamil ? '✓ சரியான விடை!' : '✓ Correct Answer!')
                                      : (isTamil ? '✗ விளக்கம்:' : '✗ Incorrect Explanation:')}
                                  </div>
                                  <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                                    {translatedQ.explanation}
                                  </p>
                                </div>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', margin: '2rem 0' }}>
                          {isTamil ? 'இப்பாடத்திற்கான பயிற்சி வினாக்கள் விரைவில் சேர்க்கப்படும்.' : 'Practice questions for this lesson will be available soon.'}
                        </p>
                      )}

                      {totalQuestions > 0 && answeredCount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                          <button
                            type="button"
                            className="switcher-pill"
                            onClick={handleResetQuiz}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                          >
                            <RotateCcw size={14} />
                            Reset Quiz
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default Group4UnitClass
