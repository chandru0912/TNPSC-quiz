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
import { apiFetch } from '../utils/api'
import { dynamicSyllabusService } from '../services/dynamicSyllabusService'
import { compareLessons } from '../utils/naturalSort'
import './Group1Lessons.css'

const Group4Lessons = () => {
  const { subjectId, unitId } = useParams<{ subjectId: string; unitId: string }>()
  const navigate = useNavigate()
  
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
    let isCancelled = false

    const fetchDynamicContent = async () => {
      try {
        const [questionsRes, notesRes, unitsRes, lessonsRes] = await Promise.allSettled([
          apiFetch(`/api/study-materials/questions?group=group4&subjectId=${activeSubjectId}&unitId=${parsedUnitId}&limit=500`),
          apiFetch(`/api/notes?category=group4_vao&unitId=${parsedUnitId}&limit=500`),
          apiFetch(`/api/study-management/units?examId=group4&subjectId=${activeSubjectId}`),
          apiFetch(`/api/study-management/lessons?examId=group4&subjectId=${activeSubjectId}&unitNumber=${parsedUnitId}`),
        ])
        if (isCancelled) return

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
                lessonId: n.lessonId,
              })
            })
          }
        }

        const fallbackBase = baseUnit || {
          id: parsedUnitId,
          unitNumber: `Unit ${parsedUnitId}`,
          title: `Unit ${parsedUnitId}`,
          tamilTitle: `Unit ${parsedUnitId}`,
          questionCount: 10,
          standard: 'SSLC Standard',
          officialTopics: [],
          chapters: [],
        }
        const clonedUnit: any = JSON.parse(JSON.stringify(fallbackBase))

        if (unitsRes.status === 'fulfilled' && unitsRes.value.ok) {
          const udata = await unitsRes.value.json()
          if (udata.success && Array.isArray(udata.units)) {
            const match = udata.units.find((u: any) => Number(u.unit_number) === parsedUnitId)
            if (match) {
              const exactTitle = (match.title || clonedUnit.title).trim()
              clonedUnit.title = exactTitle
              clonedUnit.tamilTitle = exactTitle
              clonedUnit.unitNumber = match.unit_code || clonedUnit.unitNumber
              clonedUnit.questionCount = match.question_count || clonedUnit.questionCount
            }
          }
        }

        if (lessonsRes.status === 'fulfilled' && lessonsRes.value.ok) {
          const ldata = await lessonsRes.value.json()
          if (ldata.success && Array.isArray(ldata.lessons) && ldata.lessons.length > 0) {
            const sortedLessons = ldata.lessons.slice().sort(compareLessons)
            const byStd = new Map<number, any[]>()
            for (const l of sortedLessons) {
              const std = Number(l.standard_number) || 6
              if (!byStd.has(std)) byStd.set(std, [])
              byStd.get(std)!.push(l)
            }
            const sortedStds = Array.from(byStd.keys()).sort((a, b) => a - b)
            clonedUnit.chapters = sortedStds.map((std, idx) => ({
              id: `db-ch-u${parsedUnitId}-s${std}`,
              chapterNumber: idx + 1,
              title: `Class ${std}th Standard Textbook Lessons`,
              description: `Official Samacheer Kalvi Class ${std}th Standard lessons mapped to ${clonedUnit.title}.`,
              lessons: byStd.get(std)!.map((l: any) => ({
                id: l.id,
                lessonNumber: l.lesson_number,
                title: l.title,
                duration: l.term || 'Term 1',
                summary: l.description || `Samacheer Kalvi Class ${std}th Standard (${l.term || 'Term 1'})`,
                studyNotes: [],
                practiceQuestions: [],
              })),
            }))
          }
        }

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
            const matchingDbNotes = dbNotes.filter((dn) =>
              (dn.lessonId && lesson.id && dn.lessonId === lesson.id) ||
              (!dn.lessonId && dn.lessonTitle && lesson.title && dn.lessonTitle.toLowerCase() === lesson.title.toLowerCase())
            )
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
    const unsubscribe = dynamicSyllabusService.subscribe(() => {
      fetchDynamicContent()
    })

    return () => {
      isCancelled = true
      unsubscribe()
    }
  }, [baseUnit, activeSubjectId, parsedUnitId])

  if (!subject || !unit) {
    return (
      <div className="lessons-page">
        <div className="lessons-container">
          <div className="empty-state glass">
            <h2>{'Unit Not Found'}</h2>
            <p>
              {'The requested TNPSC Group 4 & VAO syllabus unit does not exist.'}
            </p>
            <Link to="/materials?group=group4_vao" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              <ArrowLeft size={16} />
              <span>{'Back to Group 4 & VAO'}</span>
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
          <Link to="/">{'Home'}</Link>
          <ChevronRight size={14} />
          <Link to="/materials?group=group4_vao">{'Study Materials'}</Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group4/${subject.id}`}>
            {subject.title}
          </Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group4/${subject.id}/unit/${unit.id}`}>
            {unit.unitNumber}
          </Link>
          <ChevronRight size={14} />
          <span className="active">{'Lessons & Notes'}</span>
        </div>

        {/* Back Link and Language Switch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to={`/materials/group4/${subject.id}/unit/${unit.id}`} className="back-btn glass">
            <ArrowLeft size={16} />
            <span>
              {`Back to ${unit.unitNumber} Syllabus`}
            </span>
          </Link>
        </div>

        {/* Header */}
        <motion.div
          className="lessons-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="lessons-title-row">
            <span className="unit-number-pill">{unit.unitNumber}</span>
            <span className="unit-q-count">
              {unit.questionCount} {'Questions'}
            </span>
          </div>

          <h1 className="lessons-title">
            {unit.title} —{' '}
            <span className="gradient-text">{'Lessons & Notes'}</span>
          </h1>

          <p className="lessons-subtitle">
            {`Organized syllabus sequence across ${chapterCount} chapters (${lessonCount} total lessons). Structured according to the official TNPSC Group 4 & VAO notification (Code: 496).`}
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
                  {`Chapter ${chapter.chapterNumber}`}
                </div>
                <h2 className="chapter-block-title">
                  {chapter.title}
                </h2>
                {chapter.tamilTitle && (
                  <span className="chapter-block-tamil">{chapter.tamilTitle}</span>
                )}
              </div>

              <div className="lessons-table">
                {chapter.lessons.map((lesson) => (
                  <div key={lesson.id} className="lesson-entry glass">
                    <div className="lesson-entry-main">
                      <div className="lesson-entry-top">
                        <span className="lesson-entry-pill">
                          {`Lesson ${lesson.lessonNumber}`}
                        </span>
                        <span className="lesson-entry-duration">
                          <Clock size={13} />
                          {lesson.duration}
                        </span>
                      </div>

                      <h3 className="lesson-entry-name">
                        {lesson.title}
                      </h3>

                      <div className="lesson-concepts-pills">
                        {lesson.keyConcepts.map((k, idx) => (
                          <span key={idx} className="lesson-concept-tag">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="lesson-entry-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() =>
                          navigate(`/study-notes/group4_vao/subject/${subject.id}/unit/${unit.id}/lesson/${encodeURIComponent(lesson.title)}?chapter=${encodeURIComponent(chapter.title)}&chapterNum=${chapter.chapterNumber}&lang=${'english'}${lesson.id ? `&lessonId=${encodeURIComponent(lesson.id)}` : ''}${lesson.lessonNumber ? `&lessonNumber=${encodeURIComponent(lesson.lessonNumber)}` : ''}${(lesson as any).term ? `&term=${encodeURIComponent((lesson as any).term)}` : ''}`)
                        }
                      >
                        <FileQuestion size={16} />
                        <span>{'Read Study Notes'}</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ marginLeft: '0.5rem', background: 'linear-gradient(135deg, rgba(255,215,0,0.18), rgba(245,158,11,0.28))', borderColor: 'rgba(255,215,0,0.5)', color: '#ffd700' }}
                        onClick={() =>
                          navigate(`/study-materials/practice/group4/${subject.id}/all/${unit.id}/${encodeURIComponent(lesson.id || '')}?lessonTitle=${encodeURIComponent(lesson.title)}`)
                        }
                      >
                        <FileQuestion size={16} />
                        <span>{'Practice MCQs'}</span>
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
                      {`Lesson ${activeLesson.lesson.lessonNumber} • Chapter ${activeLesson.chapterNumber}`}
                    </span>
                    <h3 className="modal-title">
                      {activeLesson.lesson.title}
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
                    <span>{'📖 Study Notes'}</span>
                  </button>
                  <button
                    className={`g2-modal-tab-btn ${modalTab === 'quiz' ? 'active' : ''}`}
                    onClick={() => setModalTab('quiz')}
                  >
                    <Sparkles size={15} />
                    <span>
                      {`📝 Practice MCQs (${activeLesson.lesson.practiceQuestions.length})`}
                    </span>
                  </button>
                </div>

                <div className="g2-modal-scroll" style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
                  {modalTab === 'notes' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="modal-scope-section">
                        <span className="modal-section-title">
                          {'Official Syllabus Scope'}
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                          {activeLesson.lesson.keyConcepts.map((k, idx) => (
                            <span key={idx} className="g2-concept-pill-large">
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <span className="modal-section-title">
                          {'Detailed Study Coverage'}
                        </span>
                        {activeLesson.lesson.studyNotes.map((note, idx) => (
                          <div key={idx} className="g2-note-card">
                            <p style={{ margin: 0 }}>{note}</p>
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
                              {'Score Tracking'}
                            </span>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {correctAnswersInLesson} {'of'} {totalQuestionsInLesson} {'Correct'} ({scorePercentage}%)
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {'Progress:'} {answeredQuestionsInLesson}/{totalQuestionsInLesson} {'Answered'}
                          </span>
                          <button
                            type="button"
                            className="btn glass btn-sm"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer' }}
                            onClick={() => handleResetQuiz(activeLesson.lesson)}
                          >
                            <RotateCcw size={12} />
                            <span>{'Reset'}</span>
                          </button>
                        </div>
                      </div>

                      {activeLesson.lesson.practiceQuestions.map((q, qIndex) => {
                        const userAnswer = quizAnswers[q.id]
                        const isAnswered = userAnswer !== undefined
                        const isCorrect = isAnswered && userAnswer === q.correctAnswer
                        const translatedQ = {
                            id: q.id,
                            category: 'group4_vao',
                            tag: `${unit.unitNumber} • ${activeLesson.lesson.title}`,
                            question: q.question,
                            options: q.options,
                            correctAnswer: q.correctAnswer,
                            explanation: q.explanation,
                          }

                        return (
                          <div key={q.id} className="g2-q-item">
                            <div className="g2-q-header">
                              <span className="g2-q-num">
                                {`Q${qIndex + 1}`}
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
                                    ? ('✓ Correct Answer!')
                                    : ('✗ Explanation:')}
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
                        <span>{'Close'}</span>
                      </button>
                      <button className="btn btn-primary" onClick={() => setModalTab('quiz')}>
                        <FileQuestion size={16} />
                        <span>
                          {`Practice Related MCQs (${activeLesson.lesson.practiceQuestions.length})`}
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
                        <span>{'Reset Quiz'}</span>
                      </button>
                      <button className="btn btn-primary" onClick={() => setModalTab('notes')}>
                        <BookOpen size={16} />
                        <span>{'Back to Notes'}</span>
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
