import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  ChevronRight,
  FileText,
  Clock,
  Calculator,
  Layers,
  Sparkles,
  HelpCircle,
  Languages,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowLeft,
  X,
  Globe2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  group1GeneralStudiesUnits,
  getTotalGSQuestions,
  getTotalGSChapters,
  getTotalGSLessons,
  group1AptitudeUnits,
} from '../data/group1SyllabusData'
import {
  group2Subjects,
  getGroup2SubjectById,
  type Group2Subject,
  type Group2Lesson,
} from '../data/group2SyllabusData'
import {
  group4Subjects,
  getGroup4SubjectById,
  type Group4Subject,
  type Group4Lesson,
} from '../data/group4SyllabusData'
import './StudyMaterials.css'

const StudyMaterials = () => {
  const navigate = useNavigate()
  const [selectedGroup, setSelectedGroup] = useState<'group1' | 'group2_2a' | 'group4_vao'>('group1')

  // Group 2 & 2A Dedicated State
  const [selectedGroup2SubjectId, setSelectedGroup2SubjectId] = useState<string | null>(null)
  const [activeGroup2Lesson, setActiveGroup2Lesson] = useState<{
    lesson: Group2Lesson
    chapterTitle: string
    unitTitle: string
    subjectTitle: string
  } | null>(null)
  const [lessonModalTab, setLessonModalTab] = useState<'notes' | 'quiz'>('notes')
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})

  // Group 4 & VAO Dedicated State
  const [selectedGroup4SubjectId, setSelectedGroup4SubjectId] = useState<string | null>(null)
  const [activeGroup4Lesson, setActiveGroup4Lesson] = useState<{
    lesson: Group4Lesson
    chapterTitle: string
    unitTitle: string
    subjectTitle: string
  } | null>(null)
  const [group4ModalTab, setGroup4ModalTab] = useState<'notes' | 'quiz'>('notes')
  const [group4QuizAnswers, setGroup4QuizAnswers] = useState<Record<string, number>>({})

  const groups = [
    { id: 'group1' as const, name: 'TNPSC Group 1' },
    { id: 'group2_2a' as const, name: 'TNPSC Group 2 & 2A' },
    { id: 'group4_vao' as const, name: 'TNPSC Group 4 & VAO' },
  ]

  const handleGroupChange = (group: 'group1' | 'group2_2a' | 'group4_vao') => {
    setSelectedGroup(group)
    setSelectedGroup2SubjectId(null)
    setActiveGroup2Lesson(null)
    setSelectedGroup4SubjectId(null)
    setActiveGroup4Lesson(null)
  }

  // --- Group 2 Handlers ---
  const handleSelectGroup2Subject = (subjectId: string | null) => {
    setSelectedGroup2SubjectId(subjectId)
    setActiveGroup2Lesson(null)
  }

  const handleOpenGroup2Lesson = (
    lesson: Group2Lesson,
    chapterTitle: string,
    unitTitle: string,
    subjectTitle: string
  ) => {
    setActiveGroup2Lesson({
      lesson,
      chapterTitle,
      unitTitle,
      subjectTitle,
    })
    setLessonModalTab('notes')
  }

  const handleGroup2OptionSelect = (qId: string, optionIdx: number) => {
    setQuizAnswers((prev) => ({
      ...prev,
      [qId]: optionIdx,
    }))
  }

  const handleResetGroup2Quiz = (lesson: Group2Lesson) => {
    setQuizAnswers((prev) => {
      const next = { ...prev }
      lesson.practiceQuestions.forEach((q) => {
        delete next[q.id]
      })
      return next
    })
  }

  const getGroup2SubjectIcon = (id: string) => {
    switch (id) {
      case 'general-studies':
        return <Globe2 size={26} />
      case 'aptitude':
        return <Calculator size={26} />
      case 'general-english':
        return <Languages size={26} />
      case 'general-tamil':
        return <Sparkles size={26} />
      default:
        return <BookOpen size={26} />
    }
  }

  // --- Group 4 Handlers ---
  const handleSelectGroup4Subject = (subjectId: string | null) => {
    setSelectedGroup4SubjectId(subjectId)
    setActiveGroup4Lesson(null)
  }

  const handleOpenGroup4Lesson = (
    lesson: Group4Lesson,
    chapterTitle: string,
    unitTitle: string,
    subjectTitle: string
  ) => {
    setActiveGroup4Lesson({
      lesson,
      chapterTitle,
      unitTitle,
      subjectTitle,
    })
    setGroup4ModalTab('notes')
  }

  const handleGroup4OptionSelect = (qId: string, optionIdx: number) => {
    setGroup4QuizAnswers((prev) => ({
      ...prev,
      [qId]: optionIdx,
    }))
  }

  const handleResetGroup4Quiz = (lesson: Group4Lesson) => {
    setGroup4QuizAnswers((prev) => {
      const next = { ...prev }
      lesson.practiceQuestions.forEach((q) => {
        delete next[q.id]
      })
      return next
    })
  }

  const getGroup4SubjectIcon = (id: string) => {
    switch (id) {
      case 'general-tamil':
        return <Sparkles size={26} />
      case 'general-studies':
        return <BookOpen size={26} />
      case 'aptitude':
        return <Calculator size={26} />
      case 'vao-special':
        return <FileText size={26} />
      default:
        return <BookOpen size={26} />
    }
  }

  const activeGroup2Subject: Group2Subject | undefined = selectedGroup2SubjectId
    ? getGroup2SubjectById(selectedGroup2SubjectId)
    : undefined

  const activeGroup4Subject: Group4Subject | undefined = selectedGroup4SubjectId
    ? getGroup4SubjectById(selectedGroup4SubjectId)
    : undefined

  // Group 1 Metrics
  const gsTotalQuestions = getTotalGSQuestions() // 175
  const gsTotalChapters = getTotalGSChapters() // 28
  const gsTotalLessons = getTotalGSLessons() // 109
  const aptTotalQuestions = group1AptitudeUnits.reduce((acc, u) => acc + u.questionCount, 0) // 25

  return (
    <div className="materials">
      <div className="materials-container">
        <motion.div
          className="materials-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="materials-title">
            <BookOpen size={32} />
            <span>Study Materials & Syllabus</span>
          </h1>
          <p className="materials-subtitle">
            Comprehensive syllabus-mapped learning modules, study notes, and lesson-wise practice quizzes
          </p>
        </motion.div>

        {/* Main Category Tabs */}
        <motion.div
          className="group-tabs glass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {groups.map((group) => (
            <button
              key={group.id}
              className={`group-tab ${selectedGroup === group.id ? 'active' : ''}`}
              onClick={() => handleGroupChange(group.id)}
            >
              {group.name}
            </button>
          ))}
        </motion.div>

        {/* ============================================================== */}
        {/* GROUP 1 VIEW                                                  */}
        {/* ============================================================== */}
        {selectedGroup === 'group1' ? (
          <motion.div
            className="group1-cards-grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Card 1: General Studies */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group1/general-studies')}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">Part A • Degree Standard</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  {gsTotalQuestions} Questions
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <BookOpen size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">General Studies</h2>
                  <span className="group1-card-sub">
                    {group1GeneralStudiesUnits.length} Distinct Syllabus Units
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                Comprehensive degree standard syllabus covering General Science, Indian Geography,
                History & Culture of India, Indian Polity, Indian Economy & TN Administration, and Tamil Society Heritage.
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    Units: <strong>{group1GeneralStudiesUnits.length}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <BookOpen size={16} />
                  <span>
                    Chapters: <strong>{gsTotalChapters}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Sparkles size={16} />
                  <span>
                    Lessons: <strong>{gsTotalLessons}</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>Explore General Studies (6 Units)</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Card 2: Aptitude */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group1/aptitude')}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">Part B • SSLC Standard</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  {aptTotalQuestions} Questions
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Calculator size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">Aptitude and Mental Ability</h2>
                  <span className="group1-card-sub">
                    {group1AptitudeUnits.length} Units (Aptitude & Reasoning)
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                SSLC standard quantitative aptitude and logical reasoning modules including Simplification,
                HCF & LCM, Ratio, Percentage, Simple & Compound Interest, Puzzles, Dice, and Visual Reasoning.
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    Units: <strong>{group1AptitudeUnits.length}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Clock size={16} />
                  <span>
                    Standard: <strong>SSLC (10th)</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <HelpCircle size={16} />
                  <span>
                    Weightage: <strong>{aptTotalQuestions} Marks</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>Explore Aptitude & Reasoning</span>
                <ChevronRight size={18} />
              </div>
            </div>
          </motion.div>
        ) : selectedGroup === 'group2_2a' ? (
          /* ============================================================== */
          /* GROUP 2 & 2A VIEW: 4 SUBJECTS IN EXACT REQUIRED ORDER          */
          /* 1. General Studies                                            */
          /* 2. Aptitude                                                   */
          /* 3. General English                                            */
          /* 4. General Tamil                                              */
          /* ============================================================== */
          <div className="group2-section-wrapper">
            {!selectedGroup2SubjectId ? (
              /* All 4 Subjects Grid */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                <motion.div
                  className="group2-subjects-grid"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                >
                  {group2Subjects.map((sub, index) => {
                    const totalChapters = sub.units.reduce((acc, u) => acc + u.chapters.length, 0)
                    const totalLessons = sub.units.reduce(
                      (acc, u) => acc + u.chapters.reduce((cAcc, c) => cAcc + c.lessons.length, 0),
                      0
                    )

                    return (
                      <motion.div
                        key={sub.id}
                        className="group2-subject-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.08 }}
                        onClick={() => handleSelectGroup2Subject(sub.id)}
                      >
                        <div className="group2-card-top">
                          <span className="group2-order-pill">Subject 0{sub.order}</span>
                          <span className="group2-weightage-pill">
                            <HelpCircle size={14} />
                            {sub.questionCount} Questions
                          </span>
                        </div>

                        <div className="group2-card-header">
                          <div className="group2-card-icon" style={{ color: sub.accentColor }}>
                            {getGroup2SubjectIcon(sub.id)}
                          </div>
                          <div className="group2-card-title-group">
                            <h3 className="group2-card-title">{sub.title}</h3>
                            {sub.tamilTitle && (
                              <span className="group2-card-sub">{sub.tamilTitle}</span>
                            )}
                          </div>
                        </div>

                        <p className="group2-card-desc">{sub.description}</p>

                        <div className="group2-card-stats">
                          <div className="group2-card-stat">
                            <span className="group2-stat-label">Syllabus Units</span>
                            <span className="group2-stat-val">{sub.units.length} Units</span>
                          </div>
                          <div className="group2-card-stat">
                            <span className="group2-stat-label">Chapters</span>
                            <span className="group2-stat-val">{totalChapters} Chapters</span>
                          </div>
                          <div className="group2-card-stat">
                            <span className="group2-stat-label">Lessons & MCQs</span>
                            <span className="group2-stat-val">{totalLessons} Modules</span>
                          </div>
                        </div>

                        <div className="group2-card-action">
                          <span>Explore {sub.title} (Chapters & Lessons)</span>
                          <ChevronRight size={18} />
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              </div>
            ) : activeGroup2Subject ? (
              /* Selected Subject Chapters & Lessons View */
              <div className="group2-detail-view">
                <div className="group2-detail-top-nav">
                  <button
                    className="group2-back-btn"
                    onClick={() => handleSelectGroup2Subject(null)}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to All 4 Subjects</span>
                  </button>

                  <div className="group2-nav-pills">
                    {group2Subjects.map((sub) => (
                      <button
                        key={sub.id}
                        className={`group2-nav-pill ${selectedGroup2SubjectId === sub.id ? 'active' : ''}`}
                        onClick={() => handleSelectGroup2Subject(sub.id)}
                      >
                        {sub.order}. {sub.title}
                      </button>
                    ))}
                  </div>
                </div>

                <motion.div
                  className="group2-detail-header"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="group2-detail-header-top">
                    <span className="group2-order-pill">Subject 0{activeGroup2Subject.order}</span>
                    <span className="group2-code-badge">{activeGroup2Subject.partTag}</span>
                    <span className="group2-paper-badge">{activeGroup2Subject.standard}</span>
                    <span className="group2-weightage-pill">
                      {activeGroup2Subject.questionCount} Questions in Exam
                    </span>
                  </div>

                  <h2 className="group2-detail-title">
                    {activeGroup2Subject.title}
                    {activeGroup2Subject.tamilTitle && ` — ${activeGroup2Subject.tamilTitle}`}
                  </h2>

                  <p className="group2-detail-desc">{activeGroup2Subject.description}</p>
                </motion.div>

                {/* Units List */}
                <div className="group2-units-stack">
                  {activeGroup2Subject.units.map((unit) => (
                    <div key={unit.id} className="group2-unit-container">
                      <div className="group2-unit-head">
                        <div className="group2-unit-title-group">
                          <span className="group2-unit-num-pill">{unit.unitNumber}</span>
                          <h3 className="group2-unit-title">
                            {unit.title}
                            {unit.tamilTitle && ` (${unit.tamilTitle})`}
                          </h3>
                        </div>

                        <div className="group2-unit-meta">
                          <span className="group2-unit-q-badge">{unit.questionCount} Questions</span>
                        </div>
                      </div>

                      <div className="group2-unit-body">
                        <div className="group2-topics-preview">
                          <div className="group2-topics-title">
                            Official Syllabus Topics (PDF Reference):
                          </div>
                          <ul className="group2-topics-list">
                            {unit.officialTopics.map((topic, tIdx) => (
                              <li key={tIdx}>{topic}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="group2-chapters-list">
                          {unit.chapters.map((chapter) => (
                            <div key={chapter.id} className="group2-chapter-card">
                              <div className="group2-chapter-header">
                                <span className="group2-chapter-badge">
                                  Chapter {chapter.chapterNumber}
                                </span>
                                <h4 className="group2-chapter-name">
                                  {chapter.title}
                                  {chapter.tamilTitle && ` (${chapter.tamilTitle})`}
                                </h4>
                              </div>

                              <div className="group2-lessons-list">
                                {chapter.lessons.map((lesson) => (
                                  <div key={lesson.id} className="group2-lesson-row">
                                    <div className="group2-lesson-info">
                                      <div className="group2-lesson-top">
                                        <span className="group2-lesson-num">
                                          Lesson {lesson.lessonNumber}
                                        </span>
                                        <h5 className="group2-lesson-title">{lesson.title}</h5>
                                      </div>

                                      <div className="group2-lesson-concepts">
                                        {lesson.keyConcepts.map((concept, cIdx) => (
                                          <span key={cIdx} className="group2-concept-tag">
                                            {concept}
                                          </span>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="group2-lesson-actions">
                                      <span className="group2-lesson-time">
                                        <Clock size={14} />
                                        {lesson.duration}
                                      </span>

                                      <button
                                        className="group2-notes-quiz-btn"
                                        onClick={() =>
                                          handleOpenGroup2Lesson(
                                            lesson,
                                            chapter.title,
                                            unit.title,
                                            activeGroup2Subject.title
                                          )
                                        }
                                      >
                                        <FileText size={15} />
                                        <span>Study Notes & Quiz</span>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Modal Drawer for Lesson Notes & Interactive MCQ Quiz */}
            <AnimatePresence>
              {activeGroup2Lesson && (
                <div
                  className="g2-modal-overlay"
                  onClick={() => setActiveGroup2Lesson(null)}
                >
                  <motion.div
                    className="g2-modal"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="g2-modal-head">
                      <div className="g2-modal-title-group">
                        <span className="g2-modal-pill">
                          {activeGroup2Lesson.subjectTitle} • Lesson{' '}
                          {activeGroup2Lesson.lesson.lessonNumber} •{' '}
                          {activeGroup2Lesson.chapterTitle}
                        </span>
                        <h3 className="g2-modal-title">
                          {activeGroup2Lesson.lesson.title}
                        </h3>
                      </div>

                      <button
                        className="g2-modal-close"
                        onClick={() => setActiveGroup2Lesson(null)}
                        aria-label="Close modal"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="g2-modal-tabs">
                      <button
                        className={`g2-modal-tab-btn ${lessonModalTab === 'notes' ? 'active' : ''}`}
                        onClick={() => setLessonModalTab('notes')}
                      >
                        <BookOpen size={16} />
                        <span>📖 Study Notes & Summary</span>
                      </button>
                      <button
                        className={`g2-modal-tab-btn ${lessonModalTab === 'quiz' ? 'active' : ''}`}
                        onClick={() => setLessonModalTab('quiz')}
                      >
                        <Sparkles size={16} />
                        <span>
                          📝 MCQ Practice Quiz (
                          {activeGroup2Lesson.lesson.practiceQuestions.length} Questions)
                        </span>
                      </button>
                    </div>

                    <div className="g2-modal-scroll">
                      {lessonModalTab === 'notes' ? (
                        <div className="g2-notes-box">
                          <div>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                fontWeight: 700,
                              }}
                            >
                              Core Syllabus Concepts:
                            </span>
                            <div className="g2-concepts-cloud" style={{ marginTop: '0.4rem' }}>
                              {activeGroup2Lesson.lesson.keyConcepts.map((concept, idx) => (
                                <span key={idx} className="g2-concept-pill-large">
                                  {concept}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                fontWeight: 700,
                              }}
                            >
                              Detailed Lesson Study Notes:
                            </span>
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.85rem',
                                marginTop: '0.5rem',
                              }}
                            >
                              {activeGroup2Lesson.lesson.studyNotes.map((note, nIdx) => (
                                <div key={nIdx} className="g2-note-card">
                                  <p style={{ margin: 0 }}>{note}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="g2-quiz-container">
                          {activeGroup2Lesson.lesson.practiceQuestions.map((q, qIndex) => {
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
                                        onClick={() => handleGroup2OptionSelect(q.id, optIdx)}
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
                                      {isCorrect ? '✓ Correct Answer!' : '✗ Incorrect! Explanation:'}
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

                    <div className="g2-modal-foot">
                      {lessonModalTab === 'notes' ? (
                        <>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Based on official TNPSC Group 2 & 2A Syllabus
                          </span>
                          <button
                            className="group2-notes-quiz-btn"
                            onClick={() => setLessonModalTab('quiz')}
                          >
                            <span>
                              Practice Quiz ({activeGroup2Lesson.lesson.practiceQuestions.length} Questions)
                            </span>
                            <ChevronRight size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="group2-back-btn"
                            onClick={() => handleResetGroup2Quiz(activeGroup2Lesson.lesson)}
                          >
                            <RotateCcw size={15} />
                            <span>Reset Answers</span>
                          </button>
                          <button
                            className="group2-notes-quiz-btn"
                            onClick={() => setLessonModalTab('notes')}
                          >
                            <BookOpen size={15} />
                            <span>Review Study Notes</span>
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* ============================================================== */
          /* GROUP 4 & VAO VIEW: 4 SPECIALIZED SUBJECTS                     */
          /* 1. General Tamil (100 Qs)                                      */
          /* 2. General Studies Foundation (75 Qs)                          */
          /* 3. Aptitude & Mental Ability (25 Qs)                           */
          /* 4. Village Administration & Office Procedures (VAO Special)    */
          /* ============================================================== */
          <div className="group2-section-wrapper">
            {!selectedGroup4SubjectId ? (
              /* All 4 Group 4 & VAO Subjects Grid */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                <motion.div
                  className="group2-subjects-grid"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                >
                  {group4Subjects.map((sub, index) => {
                    const totalChapters = sub.units.reduce((acc, u) => acc + u.chapters.length, 0)
                    const totalLessons = sub.units.reduce(
                      (acc, u) => acc + u.chapters.reduce((cAcc, c) => cAcc + c.lessons.length, 0),
                      0
                    )

                    return (
                      <motion.div
                        key={sub.id}
                        className="group2-subject-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.08 }}
                        onClick={() => handleSelectGroup4Subject(sub.id)}
                      >
                        <div className="group2-card-top">
                          <span className="group2-order-pill">Subject 0{sub.order}</span>
                          <span className="group2-weightage-pill">
                            <HelpCircle size={14} />
                            {sub.questionCount} Questions
                          </span>
                        </div>

                        <div className="group2-card-header">
                          <div className="group2-card-icon" style={{ color: sub.accentColor }}>
                            {getGroup4SubjectIcon(sub.id)}
                          </div>
                          <div className="group2-card-title-group">
                            <h3 className="group2-card-title">{sub.title}</h3>
                            {sub.tamilTitle && (
                              <span className="group2-card-sub">{sub.tamilTitle}</span>
                            )}
                          </div>
                        </div>

                        <p className="group2-card-desc">{sub.description}</p>

                        <div className="group2-card-stats">
                          <div className="group2-card-stat">
                            <span className="group2-stat-label">Syllabus Units</span>
                            <span className="group2-stat-val">{sub.units.length} Units</span>
                          </div>
                          <div className="group2-card-stat">
                            <span className="group2-stat-label">Chapters</span>
                            <span className="group2-stat-val">{totalChapters} Chapters</span>
                          </div>
                          <div className="group2-card-stat">
                            <span className="group2-stat-label">Lessons & MCQs</span>
                            <span className="group2-stat-val">{totalLessons} Modules</span>
                          </div>
                        </div>

                        <div className="group2-card-action">
                          <span>Explore {sub.title} (Chapters & Lessons)</span>
                          <ChevronRight size={18} />
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              </div>
            ) : activeGroup4Subject ? (
              /* Selected Group 4 Subject Detailed View */
              <div className="group2-detail-view">
                <div className="group2-detail-top-nav">
                  <button
                    className="group2-back-btn"
                    onClick={() => handleSelectGroup4Subject(null)}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to All Group 4 Subjects</span>
                  </button>

                  <div className="group2-nav-pills">
                    {group4Subjects.map((sub) => (
                      <button
                        key={sub.id}
                        className={`group2-nav-pill ${selectedGroup4SubjectId === sub.id ? 'active' : ''}`}
                        onClick={() => handleSelectGroup4Subject(sub.id)}
                      >
                        {sub.order}. {sub.title}
                      </button>
                    ))}
                  </div>
                </div>

                <motion.div
                  className="group2-detail-header"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="group2-detail-header-top">
                    <span className="group2-order-pill">Subject 0{activeGroup4Subject.order}</span>
                    <span className="group2-code-badge">{activeGroup4Subject.partTag}</span>
                    <span className="group2-paper-badge">{activeGroup4Subject.standard}</span>
                    <span className="group2-weightage-pill">
                      {activeGroup4Subject.questionCount} Questions in Exam
                    </span>
                  </div>

                  <h2 className="group2-detail-title">
                    {activeGroup4Subject.title}
                    {activeGroup4Subject.tamilTitle && ` — ${activeGroup4Subject.tamilTitle}`}
                  </h2>

                  <p className="group2-detail-desc">{activeGroup4Subject.description}</p>
                </motion.div>

                {/* Units List */}
                <div className="group2-units-stack">
                  {activeGroup4Subject.units.map((unit) => (
                    <div key={unit.id} className="group2-unit-container">
                      <div className="group2-unit-head">
                        <div className="group2-unit-title-group">
                          <span className="group2-unit-num-pill">{unit.unitNumber}</span>
                          <h3 className="group2-unit-title">
                            {unit.title}
                            {unit.tamilTitle && ` (${unit.tamilTitle})`}
                          </h3>
                        </div>

                        <div className="group2-unit-meta">
                          <span className="group2-unit-q-badge">{unit.questionCount} Questions</span>
                        </div>
                      </div>

                      <div className="group2-unit-body">
                        <div className="group2-topics-preview">
                          <div className="group2-topics-title">
                            Official Syllabus Topics (Group 4 Reference):
                          </div>
                          <ul className="group2-topics-list">
                            {unit.officialTopics.map((topic, tIdx) => (
                              <li key={tIdx}>{topic}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="group2-chapters-list">
                          {unit.chapters.map((chapter) => (
                            <div key={chapter.id} className="group2-chapter-card">
                              <div className="group2-chapter-header">
                                <span className="group2-chapter-badge">
                                  Chapter {chapter.chapterNumber}
                                </span>
                                <h4 className="group2-chapter-name">
                                  {chapter.title}
                                  {chapter.tamilTitle && ` (${chapter.tamilTitle})`}
                                </h4>
                              </div>

                              <div className="group2-lessons-list">
                                {chapter.lessons.map((lesson) => (
                                  <div key={lesson.id} className="group2-lesson-row">
                                    <div className="group2-lesson-info">
                                      <div className="group2-lesson-top">
                                        <span className="group2-lesson-num">
                                          Lesson {lesson.lessonNumber}
                                        </span>
                                        <h5 className="group2-lesson-title">{lesson.title}</h5>
                                      </div>

                                      <div className="group2-lesson-concepts">
                                        {lesson.keyConcepts.map((concept, cIdx) => (
                                          <span key={cIdx} className="group2-concept-tag">
                                            {concept}
                                          </span>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="group2-lesson-actions">
                                      <span className="group2-lesson-time">
                                        <Clock size={14} />
                                        {lesson.duration}
                                      </span>

                                      <button
                                        className="group2-notes-quiz-btn"
                                        onClick={() =>
                                          handleOpenGroup4Lesson(
                                            lesson,
                                            chapter.title,
                                            unit.title,
                                            activeGroup4Subject.title
                                          )
                                        }
                                      >
                                        <FileText size={15} />
                                        <span>Study Notes & Quiz</span>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Modal Drawer for Group 4 Lesson Notes & Interactive MCQ Quiz */}
            <AnimatePresence>
              {activeGroup4Lesson && (
                <div
                  className="g2-modal-overlay"
                  onClick={() => setActiveGroup4Lesson(null)}
                >
                  <motion.div
                    className="g2-modal"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="g2-modal-head">
                      <div className="g2-modal-title-group">
                        <span className="g2-modal-pill">
                          {activeGroup4Lesson.subjectTitle} • Lesson{' '}
                          {activeGroup4Lesson.lesson.lessonNumber} •{' '}
                          {activeGroup4Lesson.chapterTitle}
                        </span>
                        <h3 className="g2-modal-title">
                          {activeGroup4Lesson.lesson.title}
                        </h3>
                      </div>

                      <button
                        className="g2-modal-close"
                        onClick={() => setActiveGroup4Lesson(null)}
                        aria-label="Close modal"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="g2-modal-tabs">
                      <button
                        className={`g2-modal-tab-btn ${group4ModalTab === 'notes' ? 'active' : ''}`}
                        onClick={() => setGroup4ModalTab('notes')}
                      >
                        <BookOpen size={16} />
                        <span>📖 Study Notes & Summary</span>
                      </button>
                      <button
                        className={`g2-modal-tab-btn ${group4ModalTab === 'quiz' ? 'active' : ''}`}
                        onClick={() => setGroup4ModalTab('quiz')}
                      >
                        <Sparkles size={16} />
                        <span>
                          📝 MCQ Practice Quiz (
                          {activeGroup4Lesson.lesson.practiceQuestions.length} Questions)
                        </span>
                      </button>
                    </div>

                    <div className="g2-modal-scroll">
                      {group4ModalTab === 'notes' ? (
                        <div className="g2-notes-box">
                          <div>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                fontWeight: 700,
                              }}
                            >
                              Core Syllabus Concepts:
                            </span>
                            <div className="g2-concepts-cloud" style={{ marginTop: '0.4rem' }}>
                              {activeGroup4Lesson.lesson.keyConcepts.map((concept, idx) => (
                                <span key={idx} className="g2-concept-pill-large">
                                  {concept}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                fontWeight: 700,
                              }}
                            >
                              Detailed Lesson Study Notes:
                            </span>
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.85rem',
                                marginTop: '0.5rem',
                              }}
                            >
                              {activeGroup4Lesson.lesson.studyNotes.map((note, nIdx) => (
                                <div key={nIdx} className="g2-note-card">
                                  <p style={{ margin: 0 }}>{note}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="g2-quiz-container">
                          {activeGroup4Lesson.lesson.practiceQuestions.map((q, qIndex) => {
                            const userAnswer = group4QuizAnswers[q.id]
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
                                        onClick={() => handleGroup4OptionSelect(q.id, optIdx)}
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
                                      {isCorrect ? '✓ Correct Answer!' : '✗ Incorrect! Explanation:'}
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

                    <div className="g2-modal-foot">
                      {group4ModalTab === 'notes' ? (
                        <>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Based on official TNPSC Group 4 & VAO Syllabus
                          </span>
                          <button
                            className="group2-notes-quiz-btn"
                            onClick={() => setGroup4ModalTab('quiz')}
                          >
                            <span>
                              Practice Quiz ({activeGroup4Lesson.lesson.practiceQuestions.length} Questions)
                            </span>
                            <ChevronRight size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="group2-back-btn"
                            onClick={() => handleResetGroup4Quiz(activeGroup4Lesson.lesson)}
                          >
                            <RotateCcw size={15} />
                            <span>Reset Answers</span>
                          </button>
                          <button
                            className="group2-notes-quiz-btn"
                            onClick={() => setGroup4ModalTab('notes')}
                          >
                            <BookOpen size={15} />
                            <span>Review Study Notes</span>
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

export default StudyMaterials
