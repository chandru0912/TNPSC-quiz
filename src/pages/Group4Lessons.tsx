import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useScrollLock } from '../hooks/useScrollLock'
import {
  ChevronRight,
  ArrowLeft,
  Clock,
  X,
  FileQuestion,
  BookOpen,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
} from 'lucide-react'
import {
  getGroup4SubjectById,
  getGroup4UnitById,
  getGroup4UnitChapterCount,
  getGroup4UnitLessonCount,
  type Group4Lesson,
} from '../data/group4SyllabusData'
import { useLanguage } from '../context/LanguageContext'
import LanguageSwitch from '../components/LanguageSwitch'
import {
  translateLessonTitle,
  translateTopic,
  translateUnitNumber,
  translateUnitTitle,
  translateSubjectName,
} from '../utils/bilingualSyllabus'
import { translateQuestionItem } from '../utils/languageData'
import { apiFetch } from '../utils/api'
import './Group1Lessons.css'

const Group4Lessons = () => {
  const { subjectId, unitId } = useParams<{ subjectId: string; unitId: string }>()
  const navigate = useNavigate()
  const { language, isTamil } = useLanguage()

  const activeSubjectId = subjectId || 'general-studies'
  const parsedUnitId = parseInt(unitId || '1', 10)

  const subject = getGroup4SubjectById(activeSubjectId)
  const baseUnit = getGroup4UnitById(activeSubjectId, parsedUnitId)
  const [mergedUnit, setMergedUnit] = useState(baseUnit)
  const unit = mergedUnit || baseUnit

  const [activeLesson, setActiveLesson] = useState<{
    lesson: Group4Lesson
    chapterTitle: string
    chapterNumber: number
  } | null>(null)
  const [modalTab, setModalTab] = useState<'notes' | 'quiz'>('notes')
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})

  // Lock background scroll when lesson modal is open
  useScrollLock(Boolean(activeLesson))

  useEffect(() => {
    const fetchDynamicContent = async () => {
      if (!baseUnit) return
      try {
        const [questionsRes, notesRes] = await Promise.allSettled([
          apiFetch(`/api/questions?category=group4_vao&unitId=${parsedUnitId}&limit=500`),
          apiFetch(`/api/notes?category=group4_vao&unitId=${parsedUnitId}&limit=500`),
        ])

        const dbQuestions: any[] = []
        if (questionsRes.status === 'fulfilled' && questionsRes.value.ok) {
          const qdata = await questionsRes.value.json()
          if (qdata.status === 'success' && Array.isArray(qdata.data)) {
            qdata.data.forEach((q: any) => {
              dbQuestions.push({
                id: `db-${q.id}`,
                question: q.question,
                options: q.options,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation,
                lessonTitle: q.lessonTitle,
                lessonId: q.lessonId,
              })
            })
          }
        }

        const dbNotes: any[] = []
        if (notesRes.status === 'fulfilled' && notesRes.value.ok) {
          const ndata = await notesRes.value.json()
          if (ndata.status === 'success' && Array.isArray(ndata.data)) {
            ndata.data.forEach((n: any) => {
              dbNotes.push({
                title: n.title || n.lessonTitle,
                content: n.content,
                lessonTitle: n.lessonTitle,
              })
            })
          }
        }

        const clonedUnit: any = JSON.parse(JSON.stringify(baseUnit))
        clonedUnit.chapters?.forEach((chapter: any) => {
          chapter.lessons?.forEach((lesson: any) => {
            const matchingDbQs = dbQuestions.filter((dq) => 
              (dq.lessonId && lesson.id && dq.lessonId === lesson.id) ||
              (dq.lessonTitle && lesson.title && dq.lessonTitle.trim().toLowerCase() === lesson.title.trim().toLowerCase())
            )
            if (matchingDbQs.length > 0) {
              if (!lesson.practiceQuestions) lesson.practiceQuestions = []
              matchingDbQs.forEach((mq) => {
                if (!lesson.practiceQuestions.some((pq: any) => pq.question === mq.question)) {
                  lesson.practiceQuestions.push(mq)
                }
              })
            }
            const matchingDbNotes = dbNotes.filter((dn) => dn.lessonTitle && lesson.title && dn.lessonTitle.toLowerCase() === lesson.title.toLowerCase())
            if (matchingDbNotes.length > 0) {
              if (!lesson.studyNotes) lesson.studyNotes = []
              matchingDbNotes.forEach((mn) => {
                if (!lesson.studyNotes.some((sn: any) => sn.content === mn.content)) {
                  lesson.studyNotes.push({ type: 'text', content: mn.content })
                }
              })
            }
          })
        })
        setMergedUnit(clonedUnit)
      } catch (err) {
        console.error('Failed to merge dynamic content:', err)
      }
    }
    fetchDynamicContent()
  }, [baseUnit, parsedUnitId])

  if (!subject || !unit) {
    return (
      <div className="lessons-page">
        <div className="lessons-container">
          <div className="empty-state glass">
            <h2>{isTamil ? 'அலகு கிடைக்கவில்லை' : 'Unit Not Found'}</h2>
            <p>
              {isTamil
                ? 'கோரப்பட்ட TNPSC குரூப் 4 & VAO பாடத்திட்ட அலகு இல்லை.'
                : 'The requested TNPSC Group 4 & VAO syllabus unit does not exist.'}
            </p>
            <Link to="/materials?group=group4_vao" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              <ArrowLeft size={16} />
              <span>{isTamil ? 'குரூப் 4 & VAO பகுதிக்குத் திரும்பு' : 'Back to Group 4 & VAO'}</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const chapterCount = getGroup4UnitChapterCount(unit)
  const lessonCount = getGroup4UnitLessonCount(unit)

  // removed modal handler - using dedicated pages

  const handleOptionSelect = (qId: string, optIdx: number) => {
    setQuizAnswers((prev) => ({
      ...prev,
      [qId]: optIdx,
    }))
  }

  const handleResetQuiz = (lesson: Group4Lesson) => {
    setQuizAnswers((prev) => {
      const next = { ...prev }
      lesson.practiceQuestions.forEach((q) => {
        delete next[q.id]
      })
      return next
    })
  }

  // Calculate score tracking for active lesson
  const totalQuestionsInLesson = activeLesson ? activeLesson.lesson.practiceQuestions.length : 0
  const answeredQuestionsInLesson = activeLesson
    ? activeLesson.lesson.practiceQuestions.filter((q) => quizAnswers[q.id] !== undefined).length
    : 0
  const correctAnswersInLesson = activeLesson
    ? activeLesson.lesson.practiceQuestions.filter((q) => quizAnswers[q.id] === q.correctAnswer).length
    : 0
  const scorePercentage =
    totalQuestionsInLesson > 0 ? Math.round((correctAnswersInLesson / totalQuestionsInLesson) * 100) : 0

  return (
    <div className="lessons-page">
      <div className="lessons-container">
        {/* Breadcrumb Navigation */}
        <div className="lessons-breadcrumb">
          <Link to="/">{isTamil ? 'முகப்பு' : 'Home'}</Link>
          <ChevronRight size={14} />
          <Link to="/materials?group=group4_vao">{isTamil ? 'பாடக்குறிப்புகள்' : 'Study Materials'}</Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group4/${subject.id}`}>
            {isTamil ? (subject.tamilTitle || translateSubjectName(subject.title, language)) : subject.title}
          </Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group4/${subject.id}/unit/${unit.id}`}>
            {translateUnitNumber(unit.unitNumber, language)}
          </Link>
          <ChevronRight size={14} />
          <span className="active">{isTamil ? 'பாடங்கள் & குறிப்புகள்' : 'Lessons & Notes'}</span>
        </div>

        {/* Back Link and Language Switch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to={`/materials/group4/${subject.id}/unit/${unit.id}`} className="back-btn glass">
            <ArrowLeft size={16} />
            <span>
              {isTamil
                ? `${translateUnitNumber(unit.unitNumber, language)} பாடத்திட்டத்திற்குத் திரும்பு`
                : `Back to ${unit.unitNumber} Syllabus`}
            </span>
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
            <span className="unit-q-count">
              {unit.questionCount} {isTamil ? 'வினாக்கள்' : 'Questions'}
            </span>
          </div>

          <h1 className="lessons-title">
            {isTamil ? (unit.tamilTitle || translateUnitTitle(unit.id, unit.title, language)) : unit.title} —{' '}
            <span className="gradient-text">{isTamil ? 'பாடங்கள் & குறிப்புகள்' : 'Lessons & Notes'}</span>
          </h1>

          <p className="lessons-subtitle">
            {isTamil
              ? `${chapterCount} அத்தியாயங்கள் (${lessonCount} மொத்தப் பாடங்கள்) வழியாக அமைக்கப்பட்ட பாடத்திட்ட வரிசை. அதிகாரப்பூர்வ TNPSC குரூப் 4 & VAO அறிவிக்கையின்படி (குறியீடு: 496) கட்டமைக்கப்பட்டுள்ளது.`
              : `Organized syllabus sequence across ${chapterCount} chapters (${lessonCount} total lessons). Structured according to the official TNPSC Group 4 & VAO notification (Code: 496).`}
          </p>
        </motion.div>

        {/* Chapters & Lessons Stack */}
        <div className="chapters-lesson-stack">
          {unit.chapters.map((chapter) => (
            <motion.div
              key={chapter.id}
              className="chapter-block glass"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="chapter-block-head">
                <div className="chapter-block-badge">
                  {isTamil ? `அத்தியாயம் ${chapter.chapterNumber}` : `Chapter ${chapter.chapterNumber}`}
                </div>
                <h2 className="chapter-block-title">
                  {isTamil ? (chapter.tamilTitle || translateLessonTitle(chapter.title, language)) : chapter.title}
                </h2>
                {chapter.tamilTitle && !isTamil && (
                  <span className="chapter-block-tamil">{chapter.tamilTitle}</span>
                )}
              </div>

              <div className="lessons-table">
                {chapter.lessons.map((lesson) => (
                  <div key={lesson.id} className="lesson-entry glass">
                    <div className="lesson-entry-main">
                      <div className="lesson-entry-top">
                        <span className="lesson-entry-pill">
                          {isTamil ? `பாடம் ${lesson.lessonNumber}` : `Lesson ${lesson.lessonNumber}`}
                        </span>
                        <span className="lesson-entry-duration">
                          <Clock size={13} />
                          {isTamil ? lesson.duration.replace(/min/i, 'நிமிடம்') : lesson.duration}
                        </span>
                      </div>

                      <h3 className="lesson-entry-name">
                        {isTamil ? (lesson.tamilTitle || translateLessonTitle(lesson.title, language)) : lesson.title}
                      </h3>

                      <div className="lesson-concepts-pills">
                        {lesson.keyConcepts.map((k, idx) => (
                          <span key={idx} className="lesson-concept-tag">
                            {translateTopic(k, language)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="lesson-entry-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() =>
                          navigate(`/study-notes/group4_vao/subject/${subject.id}/unit/${unit.id}/lesson/${encodeURIComponent(lesson.title)}?chapter=${encodeURIComponent(chapter.title)}&chapterNum=${chapter.chapterNumber}&lang=${isTamil ? 'tamil' : 'english'}`)
                        }
                      >
                        <FileQuestion size={16} />
                        <span>{isTamil ? 'பாடக் குறிப்புகள் படிக்க' : 'Read Study Notes'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Modal Drawer for Lesson Notes & Interactive MCQs */}
        <AnimatePresence>
          {activeLesson && (
            <div className="lesson-modal-overlay" onClick={() => setActiveLesson(null)}>
              <motion.div
                className="lesson-modal glass"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.25 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-head">
                  <div className="modal-title-group">
                    <span className="modal-code-pill">
                      {isTamil
                        ? `பாடம் ${activeLesson.lesson.lessonNumber} • அத்தியாயம் ${activeLesson.chapterNumber}`
                        : `Lesson ${activeLesson.lesson.lessonNumber} • Chapter ${activeLesson.chapterNumber}`}
                    </span>
                    <h3 className="modal-title">
                      {isTamil
                        ? (activeLesson.lesson.tamilTitle || translateLessonTitle(activeLesson.lesson.title, language))
                        : activeLesson.lesson.title}
                    </h3>
                  </div>
                  <button
                    className="modal-close-btn"
                    onClick={() => setActiveLesson(null)}
                    aria-label="Close modal"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Tabs */}
                <div className="g2-modal-tabs" style={{ padding: '0.75rem 1.6rem' }}>
                  <button
                    className={`g2-modal-tab-btn ${modalTab === 'notes' ? 'active' : ''}`}
                    onClick={() => setModalTab('notes')}
                  >
                    <BookOpen size={15} />
                    <span>{isTamil ? '📖 பாடக் குறிப்புகள்' : '📖 Study Notes'}</span>
                  </button>
                  <button
                    className={`g2-modal-tab-btn ${modalTab === 'quiz' ? 'active' : ''}`}
                    onClick={() => setModalTab('quiz')}
                  >
                    <Sparkles size={15} />
                    <span>
                      {isTamil
                        ? `📝 பயிற்சி வினாக்கள் (${activeLesson.lesson.practiceQuestions.length})`
                        : `📝 Practice MCQs (${activeLesson.lesson.practiceQuestions.length})`}
                    </span>
                  </button>
                </div>

                <div className="g2-modal-scroll" style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
                  {modalTab === 'notes' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="modal-scope-section">
                        <span className="modal-section-title">
                          {isTamil ? 'அதிகாரப்பூர்வ பாடத்திட்ட எல்லை' : 'Official Syllabus Scope'}
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                          {activeLesson.lesson.keyConcepts.map((k, idx) => (
                            <span key={idx} className="g2-concept-pill-large">
                              {translateTopic(k, language)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <span className="modal-section-title">
                          {isTamil ? 'விரிவான பாட உள்ளடக்கம்' : 'Detailed Study Coverage'}
                        </span>
                        {activeLesson.lesson.studyNotes.map((note, idx) => (
                          <div key={idx} className="g2-note-card">
                            <p style={{ margin: 0 }}>{translateTopic(note, language)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="g2-quiz-container">
                      {/* Score Tracking Card */}
                      <div
                        className="glass"
                        style={{
                          padding: '1rem 1.25rem',
                          borderRadius: 'var(--border-radius-sm)',
                          border: '1px solid var(--border-color)',
                          marginBottom: '1.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                          background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.08) 0%, rgba(56, 189, 248, 0.08) 100%)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <Trophy size={22} style={{ color: 'var(--gold-primary)' }} />
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                              {isTamil ? 'மதிப்பெண் கண்காணிப்பு' : 'Score Tracking'}
                            </span>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {correctAnswersInLesson} {isTamil ? 'இல்' : 'of'} {totalQuestionsInLesson} {isTamil ? 'சரி' : 'Correct'} ({scorePercentage}%)
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {isTamil ? 'முன்னேற்றம்:' : 'Progress:'} {answeredQuestionsInLesson}/{totalQuestionsInLesson} {isTamil ? 'பதிலளித்தவை' : 'Answered'}
                          </span>
                          <button
                            type="button"
                            className="btn glass btn-sm"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer' }}
                            onClick={() => handleResetQuiz(activeLesson.lesson)}
                          >
                            <RotateCcw size={12} />
                            <span>{isTamil ? 'மீட்டமை' : 'Reset'}</span>
                          </button>
                        </div>
                      </div>

                      {activeLesson.lesson.practiceQuestions.map((q, qIndex) => {
                        const userAnswer = quizAnswers[q.id]
                        const isAnswered = userAnswer !== undefined
                        const isCorrect = isAnswered && userAnswer === q.correctAnswer
                        const translatedQ = translateQuestionItem(
                          {
                            id: q.id,
                            category: 'group4_vao',
                            tag: `${unit.unitNumber} • ${activeLesson.lesson.title}`,
                            question: q.question,
                            options: q.options,
                            correctAnswer: q.correctAnswer,
                            explanation: q.explanation,
                          },
                          language
                        )

                        return (
                          <div key={q.id} className="g2-q-item">
                            <div className="g2-q-header">
                              <span className="g2-q-num">
                                {isTamil ? `வினா ${qIndex + 1}` : `Q${qIndex + 1}`}
                              </span>
                              <div className="g2-q-text">{translatedQ.question}</div>
                            </div>

                            <div className="g2-options-stack">
                              {translatedQ.options.map((opt, optIdx) => {
                                const letter = String.fromCharCode(65 + optIdx)
                                let btnClass = 'g2-opt-btn'

                                if (isAnswered) {
                                  if (optIdx === q.correctAnswer) {
                                    btnClass += ' correct'
                                  } else if (optIdx === userAnswer) {
                                    btnClass += ' wrong'
                                  }
                                }

                                return (
                                  <button
                                    key={optIdx}
                                    type="button"
                                    className={btnClass}
                                    onClick={() => handleOptionSelect(q.id, optIdx)}
                                  >
                                    <span className="g2-opt-letter">{letter}</span>
                                    <span style={{ flex: 1 }}>{opt}</span>
                                    {isAnswered && optIdx === q.correctAnswer && (
                                      <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
                                    )}
                                    {isAnswered &&
                                      optIdx === userAnswer &&
                                      optIdx !== q.correctAnswer && (
                                        <XCircle size={18} style={{ color: '#f87171' }} />
                                      )}
                                  </button>
                                )
                              })}
                            </div>

                            {isAnswered && (
                              <div className="g2-explanation-box">
                                <span className="g2-explanation-label">
                                  {isCorrect
                                    ? (isTamil ? '✓ சரியான விடை!' : '✓ Correct Answer!')
                                    : (isTamil ? '✗ விளக்கம்:' : '✗ Explanation:')}
                                </span>
                                <p className="g2-explanation-text">{translatedQ.explanation}</p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div
                  className="modal-actions"
                  style={{ padding: '1rem 1.6rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}
                >
                  {modalTab === 'notes' ? (
                    <>
                      <button className="btn btn-secondary" onClick={() => setActiveLesson(null)}>
                        <span>{isTamil ? 'மூடு' : 'Close'}</span>
                      </button>
                      <button className="btn btn-primary" onClick={() => setModalTab('quiz')}>
                        <FileQuestion size={16} />
                        <span>
                          {isTamil
                            ? `பயிற்சி வினாக்களைத் தொடங்க (${activeLesson.lesson.practiceQuestions.length})`
                            : `Practice Related MCQs (${activeLesson.lesson.practiceQuestions.length})`}
                        </span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleResetQuiz(activeLesson.lesson)}
                      >
                        <RotateCcw size={15} />
                        <span>{isTamil ? 'வினாடி-வினாவை மீட்டமை' : 'Reset Quiz'}</span>
                      </button>
                      <button className="btn btn-primary" onClick={() => setModalTab('notes')}>
                        <BookOpen size={16} />
                        <span>{isTamil ? 'குறிப்புகளுக்குத் திரும்பு' : 'Back to Notes'}</span>
                      </button>
                    </>
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

export default Group4Lessons
