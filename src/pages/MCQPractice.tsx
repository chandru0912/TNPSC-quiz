import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, CheckCircle2, XCircle, ArrowRight, RotateCcw, Timer, Filter, Layers } from 'lucide-react'
import './MCQPractice.css'

interface QuestionItem {
  id: number | string
  category: 'group1' | 'group2_2a' | 'group4_vao'
  subCategory?: 'group2' | 'group2a' | 'group4' | 'vao' | 'both'
  tag: string
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
}

const MCQPractice = () => {
  const [selectedGroup, setSelectedGroup] = useState<'group1' | 'group2_2a' | 'group4_vao'>('group1')
  const [subFilter, setSubFilter] = useState<string>('all')

  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [answeredQuestions, setAnsweredQuestions] = useState(0)

  const groups = [
    { id: 'group1' as const, name: 'TNPSC Group 1' },
    { id: 'group2_2a' as const, name: 'TNPSC Group 2 & 2A' },
    { id: 'group4_vao' as const, name: 'TNPSC Group 4 & VAO' },
  ]

  const subFiltersMap = {
    group1: [],
    group2_2a: [
      { id: 'all', label: 'All Group 2 & 2A' },
      { id: 'group2', label: 'Group 2 (Interview)' },
      { id: 'group2a', label: 'Group 2A (Non-Interview)' },
    ],
    group4_vao: [
      { id: 'all', label: 'All Group 4 & VAO' },
      { id: 'group4', label: 'Group 4 (JA & Typist)' },
      { id: 'vao', label: 'VAO (Village Admin)' },
    ],
  }

  const allQuestions: QuestionItem[] = [
    // --- TNPSC GROUP 1 QUESTIONS ---
    {
      id: 'g1-q1',
      category: 'group1',
      tag: 'Group 1 • Polity & Centre-State',
      question: 'Which committee was appointed by the Tamil Nadu Government in 1969 to examine Centre-State relations and suggest amendments for state autonomy?',
      options: ['Sarkaria Commission', 'Rajamannar Committee', 'Punchhi Commission', 'Balwant Rai Mehta Committee'],
      correctAnswer: 1,
      explanation: 'The Dr. P.V. Rajamannar Committee was appointed by the Government of Tamil Nadu in September 1969 to enquire into Centre-State relations and recommend constitutional safeguards for state autonomy.',
    },
    {
      id: 'g1-q2',
      category: 'group1',
      tag: 'Group 1 • Unit 8: History & Culture',
      question: 'Under the Chola administrative system, the democratic election of village sabha members through the "Kudavolai" system is recorded in which famous stone inscription?',
      options: ['Velvikudi Copper Plates', 'Uttiramerur Inscriptions', 'Sittannavasal Inscription', 'Tirumukkudal Inscription'],
      correctAnswer: 1,
      explanation: 'The Uttiramerur Inscriptions of Parantaka Chola I (dated 919 and 921 AD) in Kanchipuram district detail the qualifications, disqualifications, and election procedure for village committee members through the Kudavolai (pot-ticket) system.',
    },
    {
      id: 'g1-q3',
      category: 'group1',
      tag: 'Group 1 • Unit 9: TN Administration',
      question: 'According to NITI Aayog Sustainable Development Goals (SDG) India Index, Tamil Nadu has consistently retained top national performance primarily in which goal?',
      options: ['Goal 1 (No Poverty) & Goal 3 (Good Health and Well-being)', 'Goal 14 (Life Below Water)', 'Goal 15 (Life on Land)', 'Goal 7 (Affordable and Clean Energy)'],
      correctAnswer: 0,
      explanation: 'Tamil Nadu ranks among the top states across India in NITI Aayog SDG Index for Goal 1 (Zero Poverty) and Goal 3 (Good Health and Well-being), supported by its comprehensive public distribution and health infrastructure.',
    },
    {
      id: 'g1-q4',
      category: 'group1',
      tag: 'Group 1 • Constitution',
      question: 'Which article of the Indian Constitution empowers Parliament to form a new state or alter the boundaries and names of existing states?',
      options: ['Article 2', 'Article 3', 'Article 4', 'Article 5'],
      correctAnswer: 1,
      explanation: 'Article 3 empowers Parliament to form new states, increase or diminish the area of any state, and alter the boundaries or name of any existing state by ordinary legislative procedure.',
    },
    {
      id: 'g1-q5',
      category: 'group1',
      tag: 'Group 1 • Socio-Political History',
      question: 'Periyar E.V. Ramasamy founded the Self-Respect Movement (Suya Mariyadhai Iyakkam) in which year after parting from the Indian National Congress?',
      options: ['1920', '1925', '1937', '1944'],
      correctAnswer: 1,
      explanation: 'Periyar E.V. Ramasamy started the Self-Respect Movement in 1925 at the Kanchipuram Congress Session after raising the demand for communal representation.',
    },

    // --- TNPSC GROUP 2 & 2A QUESTIONS ---
    {
      id: 'g2-q1',
      category: 'group2_2a',
      subCategory: 'both',
      tag: 'Group 2 & 2A • State Administration',
      question: 'In which year was the Tamil Nadu State Human Rights Commission (SHRC) established under the Protection of Human Rights Act 1993?',
      options: ['1995', '1997', '2001', '2005'],
      correctAnswer: 1,
      explanation: 'The Tamil Nadu State Human Rights Commission was established on 17th April 1997 to inquire into human rights violations within the state.',
    },
    {
      id: 'g2-q2',
      category: 'group2_2a',
      subCategory: 'both',
      tag: 'Group 2 & 2A • Aptitude & Reasoning',
      question: 'If the difference between Compound Interest and Simple Interest on a certain sum for 2 years at 10% per annum is ₹65, what is the principal sum?',
      options: ['₹6,000', '₹6,500', '₹7,200', '₹5,500'],
      correctAnswer: 1,
      explanation: 'Difference for 2 years = P * (R / 100)^2. Here, 65 = P * (10 / 100)^2 = P * (1 / 100). Therefore, P = 65 * 100 = ₹6,500.',
    },
    {
      id: 'g2-q3',
      category: 'group2_2a',
      subCategory: 'group2',
      tag: 'Group 2 Interview • State Governance',
      question: 'Who heads the administrative machinery and acts as the Principal Advisor to the Chief Minister in the Tamil Nadu Secretariat?',
      options: ['Advocate General', 'Chief Secretary', 'Home Secretary', 'Director General of Police'],
      correctAnswer: 1,
      explanation: 'The Chief Secretary to the Government of Tamil Nadu is the administrative head of the state secretariat and chief advisor to the Chief Minister on all matters of state administration.',
    },
    {
      id: 'g2-q4',
      category: 'group2_2a',
      subCategory: 'group2',
      tag: 'Group 2 Interview • Welfare Schemes',
      question: 'Under the "Kalaignar Magalir Urimai Thittam" launched by the Government of Tamil Nadu, what is the monthly financial assistance provided to eligible women heads of households?',
      options: ['₹800', '₹1,000', '₹1,500', '₹2,000'],
      correctAnswer: 1,
      explanation: 'Kalaignar Magalir Urimai Thittam provides ₹1,000 per month directly into bank accounts of eligible women heads of households in Tamil Nadu.',
    },
    {
      id: 'g2-q5',
      category: 'group2_2a',
      subCategory: 'group2a',
      tag: 'Group 2A Non-Interview • Speed Reasoning',
      question: 'Under the Right to Information (RTI) Act 2005, what is the normal statutory time limit for a Public Information Officer (PIO) to provide requested information?',
      options: ['15 days', '30 days', '45 days', '60 days'],
      correctAnswer: 1,
      explanation: 'Under Section 7(1) of the RTI Act 2005, the Public Information Officer must provide information within 30 days of receiving the application (or within 48 hours if it concerns the life or liberty of a person).',
    },
    {
      id: 'g2-q6',
      category: 'group2_2a',
      subCategory: 'group2a',
      tag: 'Group 2A Non-Interview • General Tamil',
      question: '‘எட்டுத்தொகை’ நூல்களுள் முதலாவதாக வைத்து எண்ணப்படும் நூல் எது?',
      options: ['நற்றிணை', 'குறுந்தொகை', 'ஐங்குறுநூறு', 'பதிற்றுப்பத்து'],
      correctAnswer: 0,
      explanation: '"நற்றிணை நல்ல குறுந்தொகை ஐங்குறுநூறு ஒத்த பதிற்றுப்பத்து..." என்ற வெண்பா பாடல் மூலம் எட்டுத்தொகையுள் முதலாவதாக வைத்து எண்ணப்படுவது நற்றிணை ஆகும்.',
    },

    // --- TNPSC GROUP 4 & VAO QUESTIONS ---
    {
      id: 'g4-q1',
      category: 'group4_vao',
      subCategory: 'both',
      tag: 'Group 4 & VAO • Pothu Tamil (SSLC)',
      question: '"அகர முதல எழுத்தெல்லாம் ஆதி பகவன் முதற்றே உலகு" - இக்குறட்பாவில் அமைந்துள்ள அணி எது?',
      options: ['உவமை அணி', 'எடுத்துக்காட்டு உவமை அணி', 'வேற்றுமை அணி', 'சொற்பொருள் பின்வருநிலையணி'],
      correctAnswer: 1,
      explanation: 'இக்குறளில் உவம உருபு மறைந்து வந்துள்ளதால் (போல), இது எடுத்துக்காட்டு உவமை அணி ஆகும்.',
    },
    {
      id: 'g4-q2',
      category: 'group4_vao',
      subCategory: 'vao',
      tag: 'VAO Special • Land Records & Revenue',
      question: 'Which official village land record maintained by the Village Administrative Officer (VAO) records detailed month-wise crop cultivation, irrigation sources, and harvest details?',
      options: ['Village Account No. 1 (A-Register)', 'Village Account No. 2 (Adangal / அடங்கல்)', 'Village Account No. 10 (Chitta / பட்டா சிட்டா)', 'Village Account No. 20'],
      correctAnswer: 1,
      explanation: 'Village Account No. 2 (Adangal / அடங்கல் பதிவேடு) is the primary crop record maintained by the VAO detailing crop names, survey numbers, extent cultivated, dry/wet classification, and irrigation source.',
    },
    {
      id: 'g4-q3',
      category: 'group4_vao',
      subCategory: 'vao',
      tag: 'VAO Special • Administration',
      question: 'To which immediate supervisory officer does the Village Administrative Officer (VAO) submit daily reports and village administrative diaries?',
      options: ['Tahsildar (வட்டாட்சியர்)', 'Revenue Inspector (வருவாய் ஆய்வாளர் - RI)', 'District Collector (மாவட்ட ஆட்சியர்)', 'Block Development Officer (வட்டார வளர்ச்சி அலுவலர்)'],
      correctAnswer: 1,
      explanation: 'The Revenue Inspector (RI / வருவாய் ஆய்வாளர்) of the Revenue Firka is the immediate reporting and supervisory officer for Village Administrative Officers (VAOs).',
    },
    {
      id: 'g4-q4',
      category: 'group4_vao',
      subCategory: 'vao',
      tag: 'VAO Special • Jamabandi',
      question: 'What is the annual inspection and settlement of village revenue accounts conducted by the District Collector or designated officer termed in Tamil Nadu Revenue Administration?',
      options: ['Azmaish', 'Jamabandi (ஜமாபந்தி)', 'Firkabandi', 'Dharbar'],
      correctAnswer: 1,
      explanation: 'Jamabandi (ஜமாபந்தி) is the annual audit and settlement of all village revenue accounts and land records conducted between May and June in Tamil Nadu taluks.',
    },
    {
      id: 'g4-q5',
      category: 'group4_vao',
      subCategory: 'group4',
      tag: 'Group 4 • General Studies & Polity',
      question: 'Tamil Nadu Panchayati Raj Act was enacted in accordance with the 73rd Constitutional Amendment in which year?',
      options: ['1992', '1994', '1996', '1998'],
      correctAnswer: 1,
      explanation: 'The Tamil Nadu Panchayats Act was enacted on 22nd April 1994, introducing a 3-tier Panchayati Raj system with reservation for women and SC/ST communities.',
    },
    {
      id: 'g4-q6',
      category: 'group4_vao',
      subCategory: 'group4',
      tag: 'Group 4 • Aptitude (SSLC Standard)',
      question: 'Find the Greatest Common Divisor (GCD / HCF) of 18, 24, and 36:',
      options: ['3', '6', '12', '72'],
      correctAnswer: 1,
      explanation: 'Factors of 18 = 2 * 3^2; factors of 24 = 2^3 * 3; factors of 36 = 2^2 * 3^2. Common prime factors are 2^1 * 3^1 = 6.',
    },
  ]

  // Filter questions according to main exam category and sub-category
  const filteredQuestions = allQuestions.filter((q) => {
    if (q.category !== selectedGroup) return false
    if (subFilter === 'all') return true
    if (q.subCategory === 'both') return true
    return q.subCategory === subFilter
  })

  // Safe fallback if index exceeds filtered questions
  const activeQuestionIndex = Math.min(currentQuestion, Math.max(0, filteredQuestions.length - 1))
  const questionItem = filteredQuestions[activeQuestionIndex] || filteredQuestions[0]

  const handleGroupSelect = (group: 'group1' | 'group2_2a' | 'group4_vao') => {
    setSelectedGroup(group)
    setSubFilter('all')
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
    setAnsweredQuestions(0)
  }

  const handleSubFilterSelect = (sub: string) => {
    setSubFilter(sub)
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
    setAnsweredQuestions(0)
  }

  const handleAnswerSelect = (index: number) => {
    if (showResult) return
    setSelectedAnswer(index)
  }

  const handleSubmit = () => {
    if (selectedAnswer === null || !questionItem) return
    setShowResult(true)
    setAnsweredQuestions(answeredQuestions + 1)
    if (selectedAnswer === questionItem.correctAnswer) {
      setScore(score + 1)
    }
  }

  const handleNext = () => {
    if (activeQuestionIndex < filteredQuestions.length - 1) {
      setCurrentQuestion(activeQuestionIndex + 1)
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

  const isLastQuestion = activeQuestionIndex === filteredQuestions.length - 1
  const currentSubFilters = subFiltersMap[selectedGroup]

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
            <span>
              MCQ <span className="gradient-text">Practice & Quizzes</span>
            </span>
          </h1>
          <p className="practice-subtitle">
            Curated topic-wise questions organized by TNPSC Group 1, Group 2 & 2A, and Group 4 & VAO
          </p>
        </motion.div>

        {/* Exam Category Tabs */}
        <div className="practice-categories glass">
          {groups.map((group) => (
            <button
              key={group.id}
              className={`practice-category-tab ${selectedGroup === group.id ? 'active' : ''}`}
              onClick={() => handleGroupSelect(group.id)}
            >
              {group.name}
            </button>
          ))}
        </div>

        {/* Sub-Filters for Combined Categories */}
        {currentSubFilters.length > 0 && (
          <div className="practice-sub-filters">
            <span className="practice-sub-label">
              <Filter size={14} />
              Quiz Scope:
            </span>
            {currentSubFilters.map((sub) => (
              <button
                key={sub.id}
                className={`practice-sub-btn ${subFilter === sub.id ? 'active' : ''}`}
                onClick={() => handleSubFilterSelect(sub.id)}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}

        {/* Stats HUD */}
        <div className="practice-stats">
          <div className="practice-stat-card glass">
            <Timer size={18} />
            <span>
              Question {activeQuestionIndex + 1} of {filteredQuestions.length}
            </span>
          </div>
          <div className="practice-stat-card glass">
            <CheckCircle2 size={18} />
            <span>
              Score: {score} / {answeredQuestions}
            </span>
          </div>
          <div className="practice-stat-card glass">
            <Layers size={18} />
            <span>{groups.find((g) => g.id === selectedGroup)?.name}</span>
          </div>
        </div>

        {/* Question Card */}
        {questionItem && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${selectedGroup}-${subFilter}-${activeQuestionIndex}`}
              className="question-card glass"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35 }}
            >
              <div className="question-header">
                <span className="question-category-tag">{questionItem.tag}</span>
                <span className="question-number">
                  Q {activeQuestionIndex + 1} of {filteredQuestions.length}
                </span>
              </div>

              <h2 className="question-text">{questionItem.question}</h2>

              <div className="options-list">
                {questionItem.options.map((option, index) => {
                  let optionClass = 'option'
                  if (showResult) {
                    if (index === questionItem.correctAnswer) {
                      optionClass += ' option-correct'
                    } else if (index === selectedAnswer && index !== questionItem.correctAnswer) {
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
                      {showResult && index === questionItem.correctAnswer && (
                        <CheckCircle2 size={20} className="option-icon" />
                      )}
                      {showResult && index === selectedAnswer && index !== questionItem.correctAnswer && (
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
                  <p className="explanation-text">{questionItem.explanation}</p>
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
                        <span>Restart Category Quiz</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

export default MCQPractice
