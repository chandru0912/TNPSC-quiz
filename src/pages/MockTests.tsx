import { motion } from 'framer-motion'
import { GraduationCap, Clock, FileText, Users, Play, Star } from 'lucide-react'
import './MockTests.css'

const MockTests = () => {
  const mockTests = [
    {
      id: 1,
      title: 'TNPSC Group 1 Mock Test 1',
      questions: 100,
      duration: '180 min',
      attempts: 2450,
      difficulty: 'Medium',
      rating: 4.8
    },
    {
      id: 2,
      title: 'TNPSC Group 2/2A Full Mock Test',
      questions: 200,
      duration: '120 min',
      attempts: 3200,
      difficulty: 'Hard',
      rating: 4.9
    },
    {
      id: 3,
      title: 'TNPSC Group 4 Mock Test Series',
      questions: 100,
      duration: '90 min',
      attempts: 1890,
      difficulty: 'Easy',
      rating: 4.7
    },
    {
      id: 4,
      title: 'General Studies Rapid Mock Test',
      questions: 50,
      duration: '60 min',
      attempts: 1560,
      difficulty: 'Medium',
      rating: 4.8
    }
  ]

  const getDifficultyColor = (difficulty: string) => {
    switch(difficulty) {
      case 'Easy': return '#10b981'
      case 'Medium': return '#f59e0b'
      case 'Hard': return '#ef4444'
      default: return '#94a3b8'
    }
  }

  return (
    <div className="mocktests">
      <div className="mocktests-container">
        <motion.div 
          className="mocktests-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="mocktests-title">
            <GraduationCap size={32} />
            <span>Mock <span className="gradient-text">Tests</span></span>
          </h1>
          <p className="mocktests-subtitle">
            Full-length mock tests simulating real TNPSC exam environment
          </p>
        </motion.div>

        <div className="mocktests-grid">
          {mockTests.map((test, index) => (
            <motion.div
              key={test.id}
              className="mocktest-card glass"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
            >
              <div className="mocktest-header">
                <h3 className="mocktest-title">{test.title}</h3>
                <div className="mocktest-rating">
                  <Star size={16} className="star-icon" />
                  <span>{test.rating}</span>
                </div>
              </div>
              
              <div className="mocktest-stats">
                <div className="mocktest-stat">
                  <FileText size={16} />
                  <span>{test.questions} Questions</span>
                </div>
                <div className="mocktest-stat">
                  <Clock size={16} />
                  <span>{test.duration}</span>
                </div>
                <div className="mocktest-stat">
                  <Users size={16} />
                  <span>{test.attempts} Attempts</span>
                </div>
              </div>
              
              <div className="mocktest-meta">
                <span 
                  className="difficulty-badge"
                  style={{ 
                    background: `${getDifficultyColor(test.difficulty)}20`,
                    color: getDifficultyColor(test.difficulty),
                    borderColor: `${getDifficultyColor(test.difficulty)}40`
                  }}
                >
                  {test.difficulty}
                </span>
              </div>
              
              <button className="mocktest-btn">
                <Play size={18} />
                <span>Start Test</span>
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MockTests
