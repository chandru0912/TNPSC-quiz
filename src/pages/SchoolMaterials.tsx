

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, ChevronRight, GraduationCap, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../utils/api'
import './SchoolMaterials.css'

const SchoolMaterials = () => {
  const navigate = useNavigate()
  const [selectedStandard, setSelectedStandard] = useState<number | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<number | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [answers, setAnswers] = useState<number[]>([])

  const standards = [
    { id: 6, name: '6th Standard' },
    { id: 7, name: '7th Standard' },
    { id: 8, name: '8th Standard' },
    { id: 9, name: '9th Standard' },
    { id: 10, name: '10th Standard' },
    { id: 11, name: '11th Standard' },
    { id: 12, name: '12th Standard' },
  ]

  const subjectsByStandard: Record<number, string[]> = {
    6: ['Tamil', 'English', 'Maths', 'Science', 'Social Science'],
    7: ['Tamil', 'English', 'Maths', 'Science', 'Social Science'],
    8: ['Tamil', 'English', 'Maths', 'Science', 'Social Science'],
    9: ['Tamil', 'English', 'Maths', 'Science', 'Social Science'],
    10: ['Tamil', 'English', 'Maths', 'Science', 'Social Science'],
    11: ['Tamil', 'English', 'Maths', 'Physics', 'Chemistry', 'Biology', 'History', 'Economics'],
    12: ['Tamil', 'English', 'Maths', 'Physics', 'Chemistry', 'Biology', 'History', 'Economics', 'Commerce'],
  }

  const lessons: Record<string, Record<string, Array<{ id: number; title: string; questions: any[] }>>> = {
    '6': {
      'Science': [
        { id: 1, title: 'Lesson 1: Food and Nutrition', questions: [
          { id: 1, question: 'Which nutrient is mainly responsible for growth and repair of body tissues?', options: ['Carbohydrates', 'Proteins', 'Fats', 'Vitamins'], correctAnswer: 1 },
          { id: 2, question: 'Deficiency of Vitamin C causes which disease?', options: ['Rickets', 'Scurvy', 'Beriberi', 'Night blindness'], correctAnswer: 1 },
        ]},
        { id: 2, title: 'Lesson 2: Living and Non-Living Things', questions: [
          { id: 1, question: 'Which of the following is a living thing?', options: ['Rock', 'Plant', 'Water', 'Chair'], correctAnswer: 1 },
        ]},
      ],
      'Social Science': [
        { id: 1, title: 'Lesson 1: Our Earth', questions: [
          { id: 1, question: 'The Earth is known as the ______ planet.', options: ['Red', 'Blue', 'Green', 'Yellow'], correctAnswer: 1 },
        ]},
      ],
    },
    '10': {
      'Science': [
        { id: 1, title: 'Lesson 1: Laws of Motion', questions: [
          { id: 1, question: 'Newton\'s First Law is also known as?', options: ['Law of Inertia', 'Law of Action-Reaction', 'Law of Force', 'None of these'], correctAnswer: 0 },
          { id: 2, question: 'SI unit of Force is?', options: ['Joule', 'Newton', 'Watt', 'Pascal'], correctAnswer: 1 },
        ]},
      ],
      'Maths': [
        { id: 1, title: 'Lesson 1: Relations and Functions', questions: [
          { id: 1, question: 'A set of ordered pairs is called?', options: ['Function', 'Relation', 'Domain', 'Range'], correctAnswer: 1 },
        ]},
      ],
    },
  }

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (document.documentElement) document.documentElement.scrollTop = 0
    if (document.body) document.body.scrollTop = 0
  }, [selectedStandard, selectedSubject, selectedLesson])

  const handleBack = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (document.documentElement) document.documentElement.scrollTop = 0
    if (document.body) document.body.scrollTop = 0

    if (selectedLesson !== null) {
      setSelectedLesson(null)
      setCurrentQuestion(0)
      setSelectedAnswer(null)
      setShowResult(false)
      setAnswers([])
    } else if (selectedSubject) {
      setSelectedSubject(null)
    } else if (selectedStandard) {
      setSelectedStandard(null)
    } else {
      navigate('/materials')
    }
  }

  const [dbQuestions, setDbQuestions] = useState<any[]>([])

  useEffect(() => {
    if (!selectedStandard) return
    apiFetch(`/api/questions?classId=${selectedStandard}&limit=300`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.status === 'success' && Array.isArray(data?.data)) {
          setDbQuestions(data.data)
        }
      })
      .catch((err) => console.error('Failed to fetch school questions:', err))
  }, [selectedStandard])

  const getSubjectLessons = () => {
    if (!selectedStandard || !selectedSubject) return []

    // 1. Check if we have live questions from the database for this standard & subject
    if (dbQuestions.length > 0) {
      const filtered = dbQuestions.filter((q) => {
        const qSub = (q.subject || '').toLowerCase()
        const targetSub = selectedSubject.toLowerCase()
        if (targetSub === 'science') {
          return qSub.includes('science') || qSub.includes('physics') || qSub.includes('chemistry') || qSub.includes('biology')
        }
        if (targetSub === 'social science') {
          return qSub.includes('social') || qSub.includes('history') || qSub.includes('geography') || qSub.includes('polity') || qSub.includes('economics')
        }
        return qSub.includes(targetSub) || targetSub.includes(qSub)
      })

      if (filtered.length > 0) {
        // Group by lessonTitle
        const lessonMap = new Map<string, any[]>()
        filtered.forEach((q) => {
          const title = q.lessonTitle || 'Core Lesson'
          if (!lessonMap.has(title)) lessonMap.set(title, [])
          lessonMap.get(title)!.push(q)
        })

        return Array.from(lessonMap.entries()).map(([title, qs], idx) => ({
          id: idx + 1,
          title,
          questions: qs,
        }))
      }
    }

    // Fallback to static sample lessons if no questions uploaded for this standard/subject yet
    const stdKey = selectedStandard.toString()
    return lessons[stdKey]?.[selectedSubject] || []
  }

  const getCurrentQuestions = () => {
    if (!selectedStandard || !selectedSubject || selectedLesson === null) return []
    const lessonsList = getSubjectLessons()
    const lesson = lessonsList.find((l) => l.id === selectedLesson)
    return lesson?.questions || []
  }

  const questions = getCurrentQuestions()
  const currentQ = questions[currentQuestion]

  const handleAnswerSelect = (index: number) => {
    if (showResult) return
    setSelectedAnswer(index)
  }

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return
    const newAnswers = [...answers]
    newAnswers[currentQuestion] = selectedAnswer
    setAnswers(newAnswers)
    setShowResult(true)
  }

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
      setShowResult(false)
    }
  }

  if (selectedLesson !== null && currentQ) {
    return (
      <div className="school-materials">
        <div className="school-container">
          <motion.div className="school-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <button className="back-btn" onClick={handleBack}>
              <ArrowLeft size={20} />
              <span>Back to Lessons</span>
            </button>
            <h1 className="school-title">
              <BookOpen size={28} />
              <span>Lesson {selectedLesson} - Questions</span>
            </h1>
            <p className="school-subtitle">Question {currentQuestion + 1} of {questions.length}</p>
          </motion.div>

          <motion.div className="question-card school-question-card glass" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <h2 className="question-text">{currentQ.question}</h2>
            <div className="options-list">
              {currentQ.options.map((option: string, index: number) => {
                let optionClass = 'option'
                if (showResult) {
                  if (index === currentQ.correctAnswer) optionClass += ' option-correct'
                  else if (index === selectedAnswer && index !== currentQ.correctAnswer) optionClass += ' option-wrong'
                  else optionClass += ' option-disabled'
                } else if (selectedAnswer === index) optionClass += ' option-selected'
                return (
                  <button key={index} className={optionClass} onClick={() => handleAnswerSelect(index)} disabled={showResult}>
                    <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                    <span className="option-text">{option}</span>
                    {showResult && index === currentQ.correctAnswer && <CheckCircle2 size={20} className="option-icon" />}
                    {showResult && index === selectedAnswer && index !== currentQ.correctAnswer && <XCircle size={20} className="option-icon" />}
                  </button>
                )
              })}
            </div>

            {showResult && (
              <motion.div className="answer-reveal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="answer-reveal-header">
                  <CheckCircle2 size={20} />
                  <span>Correct Answer: {String.fromCharCode(65 + currentQ.correctAnswer)}</span>
                </div>
              </motion.div>
            )}

            <div className="question-actions">
              {!showResult ? (
                <button className="btn btn-primary" onClick={handleSubmitAnswer} disabled={selectedAnswer === null}>
                  <span>Submit</span>
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handleNextQuestion} disabled={currentQuestion >= questions.length - 1}>
                  <span>{currentQuestion >= questions.length - 1 ? 'Completed' : 'Next Question'}</span>
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  if (selectedSubject && selectedStandard) {
    const lessonsList = getSubjectLessons()
    return (
      <div className="school-materials">
        <div className="school-container">
          <motion.div className="school-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <button className="back-btn" onClick={handleBack}>
              <ArrowLeft size={20} />
              <span>Back to Subjects</span>
            </button>
            <h1 className="school-title">
              <BookOpen size={28} />
              <span>{selectedStandard}th Standard - {selectedSubject}</span>
            </h1>
            <p className="school-subtitle">Lesson-wise Questions</p>
          </motion.div>

          <div className="lessons-list">
            {lessonsList.map((lesson, index) => (
              <motion.div key={lesson.id} className="lesson-card glass" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} whileHover={{ scale: 1.01 }}>
                <div className="lesson-info">
                  <div className="lesson-number">{lesson.id}</div>
                  <div className="lesson-details">
                    <h3 className="lesson-title">{lesson.title}</h3>
                    <p className="lesson-count">{lesson.questions.length} Questions</p>
                  </div>
                </div>
                <button className="lesson-btn" onClick={() => setSelectedLesson(lesson.id)}>
                  <span>Start Practice</span>
                  <ChevronRight size={18} />
                </button>
              </motion.div>
            ))}
            {lessonsList.length === 0 && (
              <div className="empty-state glass">
                <p>No lessons available for this subject yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (selectedStandard) {
    const subjects = subjectsByStandard[selectedStandard] || []
    return (
      <div className="school-materials">
        <div className="school-container">
          <motion.div className="school-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <button className="back-btn" onClick={handleBack}>
              <ArrowLeft size={20} />
              <span>Back to Standards</span>
            </button>
            <h1 className="school-title">
              <GraduationCap size={28} />
              <span>{selectedStandard}th Standard</span>
            </h1>
            <p className="school-subtitle">Select a subject to view lesson-wise questions</p>
          </motion.div>

          <div className="subjects-grid school-subjects">
            {subjects.map((subject, index) => (
              <motion.div key={subject} className="subject-card glass" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ scale: 1.02, y: -5 }} onClick={() => setSelectedSubject(subject)}>
                <div className="subject-header">
                  <div className="subject-icon"><BookOpen size={28} /></div>
                  <h3 className="subject-name">{subject}</h3>
                </div>
                <button className="subject-btn">
                  <span>View Lessons</span>
                  <ChevronRight size={18} />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="school-materials">
      <div className="school-container">
        <motion.div className="school-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button className="back-btn" onClick={() => navigate('/materials')}>
            <ArrowLeft size={20} />
            <span>Back to TNPSC Materials</span>
          </button>
          <h1 className="school-title">
            <GraduationCap size={32} />
            <span>School <span className="gradient-text">Study Materials</span></span>
          </h1>
          <p className="school-subtitle">6th to 12th Standard - Lesson-wise Questions</p>
        </motion.div>

        <div className="standards-grid">
          {standards.map((standard, index) => (
            <motion.div key={standard.id} className="standard-card glass" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ scale: 1.05 }} onClick={() => setSelectedStandard(standard.id)}>
              <div className="standard-number">{standard.id}</div>
              <div className="standard-name">{standard.name}</div>
              <ChevronRight size={24} className="standard-arrow" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SchoolMaterials
