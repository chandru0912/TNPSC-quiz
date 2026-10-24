import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, CheckCircle2, XCircle, ArrowRight, RotateCcw, Timer } from 'lucide-react'
import './MCQPractice.css'

const MCQPractice = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [answeredQuestions, setAnsweredQuestions] = useState(0)

  const questions = [
    {
      id: 1,
      question: "Which article of the Indian Constitution deals with the formation of new states?",
      options: ["Article 2", "Article 3", "Article 4", "Article 5"],
      correctAnswer: 1,
      explanation: "Article 3 empowers Parliament to form a new state by separation of territory, or by uniting two or more states."
    },
    {
      id: 2,
      question: "The Battle of Plassey was fought in which year?",
      options: ["1757", "1764", "1857", "1761"],
      correctAnswer: 0,
      explanation: "The Battle of Plassey was fought on 23 June 1757 between the East India Company and Nawab of Bengal."
    },
    {
      id: 3,
      question: "Which river is known as the 'Sorrow of Bengal'?",
      options: ["Ganga", "Damodar", "Brahmaputra", "Hooghly"],
      correctAnswer: 1,
      explanation: "Damodar river is known as the 'Sorrow of Bengal' due to its frequent floods."
    },
    {
      id: 4,
      question: "Who is known as the 'Father of Indian National Congress'?",
      options: ["Mahatma Gandhi", "A.O. Hume", "Bal Gangadhar Tilak", "Gopal Krishna Gokhale"],
      correctAnswer: 1,
      explanation: "Allan Octavian Hume founded the Indian National Congress in 1885."
    },
    {
      id: 5,
      question: "Which metal is liquid at room temperature?",
      options: ["Iron", "Mercury", "Copper", "Aluminum"],
      correctAnswer: 1,
      explanation: "Mercury is the only metal that is liquid at standard room temperature."
    }
  ]

  const handleAnswerSelect = (index: number) => {
    if (showResult) return
    setSelectedAnswer(index)
  }

  const handleSubmit = () => {
    if (selectedAnswer === null) return
    setShowResult(true)
    setAnsweredQuestions(answeredQuestions + 1)
    if (selectedAnswer === questions[currentQuestion].correctAnswer) {
      setScore(score + 1)
    }
  }

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
      setShowResult(false)
    }
  }

  const handleReset = () => {
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
    setAnsweredQuestions(0)
  }

  const isLastQuestion = currentQuestion === questions.length - 1

  return (
    <div className="practice">
      <div className="practice-container">
        <motion.div 
          className="practice-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="practice-title">
            <FileText size={32} />
            <span>MCQ <span className="gradient-text">Practice</span></span>
          </h1>
          <p className="practice-subtitle">
            Practice with topic-wise MCQs - Demo with placeholder questions
          </p>
        </motion.div>

        <div className="practice-stats">
          <div className="practice-stat-card glass">
            <Timer size={20} />
            <span>Question {currentQuestion + 1} of {questions.length}</span>
          </div>
          <div className="practice-stat-card glass">
            <CheckCircle2 size={20} />
            <span>Score: {score}/{answeredQuestions}</span>
          </div>
        </div>

        <motion.div 
          className="question-card glass"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="question-header">
            <span className="question-number">Question {currentQuestion + 1}</span>
          </div>
          <h2 className="question-text">{questions[currentQuestion].question}</h2>
          
          <div className="options-list">
            {questions[currentQuestion].options.map((option, index) => {
              let optionClass = 'option'
              if (showResult) {
                if (index === questions[currentQuestion].correctAnswer) {
                  optionClass += ' option-correct'
                } else if (index === selectedAnswer && index !== questions[currentQuestion].correctAnswer) {
                  optionClass += ' option-wrong'
                } else {
                  optionClass += ' option-disabled'
                }
              } else if (selectedAnswer === index) {
                optionClass += ' option-selected'
              }
              
              return (
                <button
                  key={index}
                  className={optionClass}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={showResult}
                >
                  <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                  <span className="option-text">{option}</span>
                  {showResult && index === questions[currentQuestion].correctAnswer && (
                    <CheckCircle2 size={20} className="option-icon" />
                  )}
                  {showResult && index === selectedAnswer && index !== questions[currentQuestion].correctAnswer && (
                    <XCircle size={20} className="option-icon" />
                  )}
                </button>
              )
            })}
          </div>

          {showResult && (
            <motion.div 
              className="explanation"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="explanation-header">
                <span className="explanation-title">Explanation</span>
              </div>
              <p className="explanation-text">{questions[currentQuestion].explanation}</p>
            </motion.div>
          )}

          <div className="question-actions">
            {!showResult ? (
              <button 
                className="btn btn-primary" 
                onClick={handleSubmit}
                disabled={selectedAnswer === null}
              >
                <span>Submit Answer</span>
              </button>
            ) : (
              <div className="action-group">
                {!isLastQuestion ? (
                  <button className="btn btn-primary" onClick={handleNext}>
                    <span>Next Question</span>
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={handleReset}>
                    <RotateCcw size={18} />
                    <span>Restart Practice</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default MCQPractice
