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
} from 'lucide-react'
import {
  getGroup2SubjectById,
  getGroup2UnitById,
  getGroup2UnitChapterCount,
  getGroup2UnitLessonCount,
  type Group2Lesson,
} from '../data/group2SyllabusData'
import './Group1Lessons.css'

const Group2Lessons = () => {
  const { subjectId, unitId } = useParams<{ subjectId: string; unitId: string }>()

  const activeSubjectId = subjectId || 'general-studies'
  const parsedUnitId = parseInt(unitId || '1', 10)

  const subject = getGroup2SubjectById(activeSubjectId)
  const unit = getGroup2UnitById(activeSubjectId, parsedUnitId)

  const [activeLesson, setActiveLesson] = useState<{
    lesson: Group2Lesson
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
            <p>The requested TNPSC Group 2 & 2A syllabus unit does not exist.</p>
            <Link to="/materials?group=group2_2a" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              <ArrowLeft size={16} />
              <span>Back to Group 2 & 2A</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const chapterCount = getGroup2UnitChapterCount(unit)
  const lessonCount = getGroup2UnitLessonCount(unit)

  const handleOpenLesson = (lesson: Group2Lesson, chapterTitle: string, chapterNumber: number) => {
    setActiveLesson({ lesson, chapterTitle, chapterNumber })
    setModalTab('notes')
  }

  const handleOptionSelect = (qId: string, optIdx: number) => {
    setQuizAnswers((prev) => ({
      ...prev,
      [qId]: optIdx,
    }))
  }

  const handleResetQuiz = (lesson: Group2Lesson) => {
    setQuizAnswers((prev) => {
      const next = { ...prev }
      lesson.practiceQuestions.forEach((q) => {
        delete next[q.id]
      })
      return next
    })
  }

  return (
    <div className="lessons-page">
      <div className="lessons-container">
        {/* Breadcrumb Navigation */}
        <div className="lessons-breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={14} />
          <Link to="/materials?group=group2_2a">Study Materials</Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group2/${subject.id}`}>{subject.title}</Link>
          <ChevronRight size={14} />
          <Link to={`/materials/group2/${subject.id}/unit/${unit.id}`}>{unit.unitNumber}</Link>
          <ChevronRight size={14} />
          <span className="active">Lessons & Notes</span>
        </div>

        {/* Back Link */}
        <div>
          <Link to={`/materials/group2/${subject.id}/unit/${unit.id}`} className="back-btn glass">
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
            Structured according to the official TNPSC Group 2 & 2A Preliminary notification (Code: 495).
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
                <div className="chapter-block-title-row">
                  <span className="chapter-pill">Chapter {chapter.chapterNumber}</span>
                  <span className="chapter-lesson-badge">{chapter.lessons.length} Lessons</span>
                </div>
                <h3 className="chapter-block-title">{chapter.title}</h3>
                {chapter.tamilTitle && <span className="chapter-block-tamil">{chapter.tamilTitle}</span>}
              </div>

              <div className="lessons-table">
                {chapter.lessons.map((lesson) => (
                  <div key={lesson.id} className="lesson-row">
                    <div className="lesson-left">
                      <span className="lesson-idx">{lesson.lessonNumber}</span>
                      <div className="lesson-info">
                        <span className="lesson-title-text">{lesson.title}</span>
                        {lesson.tamilTitle && <span className="lesson-tamil-text">{lesson.tamilTitle}</span>}
                        <div className="lesson-concepts-row">
                          {lesson.keyConcepts.map((c, cIdx) => (
                            <span key={cIdx} className="lesson-tag">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="lesson-right">
                      <span className="lesson-time-chip">
                        <Clock size={13} />
                        {lesson.duration}
                      </span>
                      <button
                        type="button"
                        className="lesson-btn"
                        onClick={() => handleOpenLesson(lesson, chapter.title, chapter.chapterNumber)}
                      >
                        <BookOpen size={14} />
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

                <div className="modal-actions" style={{ padding: '1rem 1.6rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  {modalTab === 'notes' ? (
                    <>
                      <button className="btn btn-secondary" onClick={() => setActiveLesson(null)}>
                        <span>Close</span>
                      </button>
                      <button className="btn btn-primary" onClick={() => setModalTab('quiz')}>
                        <FileQuestion size={16} />
                        <span>Practice Related MCQs ({activeLesson.lesson.practiceQuestions.length})</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleResetQuiz(activeLesson.lesson)}
                      >
                        <RotateCcw size={15} />
                        <span>Reset Quiz</span>
                      </button>
                      <button className="btn btn-primary" onClick={() => setModalTab('notes')}>
                        <BookOpen size={16} />
                        <span>Back to Notes</span>
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

export default Group2Lessons
