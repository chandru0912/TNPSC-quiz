import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
import './Group1Lessons.css'

const Group4Lessons = () => {
  const { subjectId, unitId } = useParams<{ subjectId: string; unitId: string }>()

  const activeSubjectId = subjectId || 'general-studies'
  const parsedUnitId = parseInt(unitId || '1', 10)

  const subject = getGroup4SubjectById(activeSubjectId)
  const unit = getGroup4UnitById(activeSubjectId, parsedUnitId)

  const [activeLesson, setActiveLesson] = useState<{
    lesson: Group4Lesson
    chapterTitle: string
    chapterNumber: number
  } | null>(null)
  const [modalTab, setModalTab] = useState<'notes' | 'quiz'>('notes')
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})

  if (!subject || !unit) {
    return (
      <div className="lessons-page">
        <div className="lessons-container">
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

  const handleOpenLesson = (lesson: Group4Lesson, chapterTitle: string, chapterNumber: number) => {
    setActiveLesson({ lesson, chapterTitle, chapterNumber })
    setModalTab('notes')
  }

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
          <Link to="/">Home</Link>
          <ChevronRight size={14} />
          <Link to="/materials?group=group4_vao">Study Materials</Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group4/${subject.id}`}>{subject.title}</Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group4/${subject.id}/unit/${unit.id}`}>{unit.unitNumber}</Link>
          <ChevronRight size={14} />
          <span className="active">Lessons & Notes</span>
        </div>

        {/* Back Link */}
        <div>
          <Link to={`/materials/group4/${subject.id}/unit/${unit.id}`} className="back-btn glass">
            <ArrowLeft size={16} />
            <span>Back to {unit.unitNumber} Syllabus</span>
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
            <span className="unit-q-count">{unit.questionCount} Questions</span>
          </div>

          <h1 className="lessons-title">
            {unit.title} — <span className="gradient-text">Lessons & Notes</span>
          </h1>

          <p className="lessons-subtitle">
            Organized syllabus sequence across {chapterCount} chapters ({lessonCount} total lessons).
            Structured according to the official TNPSC Group 4 & VAO notification (Code: 496).
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
                <div className="chapter-block-badge">Chapter {chapter.chapterNumber}</div>
                <h2 className="chapter-block-title">{chapter.title}</h2>
                {chapter.tamilTitle && (
                  <span className="chapter-block-tamil">{chapter.tamilTitle}</span>
                )}
              </div>

              <div className="lessons-table">
                {chapter.lessons.map((lesson) => (
                  <div key={lesson.id} className="lesson-entry glass">
                    <div className="lesson-entry-main">
                      <div className="lesson-entry-top">
                        <span className="lesson-entry-pill">Lesson {lesson.lessonNumber}</span>
                        <span className="lesson-entry-duration">
                          <Clock size={13} />
                          {lesson.duration}
                        </span>
                      </div>

                      <h3 className="lesson-entry-name">{lesson.title}</h3>

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
                        onClick={() => handleOpenLesson(lesson, chapter.title, chapter.chapterNumber)}
                      >
                        <FileQuestion size={16} />
                        <span>Study Notes & Quiz</span>
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
                      Lesson {activeLesson.lesson.lessonNumber} • Chapter {activeLesson.chapterNumber}
                    </span>
                    <h3 className="modal-title">{activeLesson.lesson.title}</h3>
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
                    <span>📖 Study Notes</span>
                  </button>
                  <button
                    className={`g2-modal-tab-btn ${modalTab === 'quiz' ? 'active' : ''}`}
                    onClick={() => setModalTab('quiz')}
                  >
                    <Sparkles size={15} />
                    <span>
                      📝 Practice MCQs ({activeLesson.lesson.practiceQuestions.length})
                    </span>
                  </button>
                </div>

                <div className="g2-modal-scroll" style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
                  {modalTab === 'notes' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="modal-scope-section">
                        <span className="modal-section-title">Official Syllabus Scope</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                          {activeLesson.lesson.keyConcepts.map((k, idx) => (
                            <span key={idx} className="g2-concept-pill-large">
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <span className="modal-section-title">Detailed Study Coverage</span>
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
                              Score Tracking
                            </span>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {correctAnswersInLesson} of {totalQuestionsInLesson} Correct ({scorePercentage}%)
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Progress: {answeredQuestionsInLesson}/{totalQuestionsInLesson} Answered
                          </span>
                          <button
                            type="button"
                            className="btn glass btn-sm"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer' }}
                            onClick={() => handleResetQuiz(activeLesson.lesson)}
                          >
                            <RotateCcw size={12} />
                            <span>Reset</span>
                          </button>
                        </div>
                      </div>

                      {activeLesson.lesson.practiceQuestions.map((q, qIndex) => {
                        const userAnswer = quizAnswers[q.id]
                        const isAnswered = userAnswer !== undefined
                        const isCorrect = isAnswered && userAnswer === q.correctAnswer

                        return (
                          <div key={q.id} className="g2-q-item">
                            <div className="g2-q-header">
                              <span className="g2-q-num">Q{qIndex + 1}</span>
                              <div className="g2-q-text">{q.question}</div>
                            </div>

                            <div className="g2-options-stack">
                              {q.options.map((opt, optIdx) => {
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
                                  {isCorrect ? '✓ Correct Answer!' : '✗ Explanation:'}
                                </span>
                                <p className="g2-explanation-text">{q.explanation}</p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="modal-foot">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      TNPSC Group 4 & VAO Examination • Syllabus Code: 496
                    </span>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActiveLesson(null)}
                    >
                      <span>Close</span>
                    </button>
                  </div>
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
