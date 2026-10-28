import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GraduationCap, Clock, FileText, Users, Play, Star } from 'lucide-react'
import './MockTests.css'

interface MockTestItem {
  id: number
  title: string
  category: 'group1' | 'group2_2a' | 'group4_vao'
  subCategory?: 'group2' | 'group2a' | 'group4' | 'vao' | 'both'
  categoryName: string
  questions: number
  duration: string
  attempts: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  rating: number
}

const MockTests = () => {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState<'group1' | 'group2_2a' | 'group4'>('group1')

  const categories = [
    { id: 'group1' as const, name: 'TNPSC Group 1' },
    { id: 'group2_2a' as const, name: 'TNPSC Group 2 & 2A' },
    { id: 'group4' as const, name: 'TNPSC Group 4' },
  ]

  const mockTests: MockTestItem[] = [
    {
      id: 1,
      title: 'TNPSC Group 1 Prelims Full Mock Test 1',
      category: 'group1',
      categoryName: 'TNPSC Group 1',
      questions: 200,
      duration: '180 min',
      attempts: 3450,
      difficulty: 'Hard',
      rating: 4.9,
    },
    {
      id: 2,
      title: 'TNPSC Group 1 General Studies & Unit 8/9 Rapid Mock',
      category: 'group1',
      categoryName: 'TNPSC Group 1',
      questions: 100,
      duration: '90 min',
      attempts: 2180,
      difficulty: 'Medium',
      rating: 4.8,
    },
    {
      id: 3,
      title: 'TNPSC Group 2 & 2A Combined Prelims Comprehensive Mock',
      category: 'group2_2a',
      subCategory: 'both',
      categoryName: 'TNPSC Group 2 & 2A',
      questions: 200,
      duration: '180 min',
      attempts: 4120,
      difficulty: 'Medium',
      rating: 4.9,
    },
    {
      id: 4,
      title: 'TNPSC Group 2 (Interview Posts) Mains Aptitude & Scenario Test',
      category: 'group2_2a',
      subCategory: 'group2',
      categoryName: 'TNPSC Group 2 (Interview)',
      questions: 100,
      duration: '120 min',
      attempts: 1850,
      difficulty: 'Hard',
      rating: 4.8,
    },
    {
      id: 5,
      title: 'TNPSC Group 2A (Non-Interview) Speed Practice Mock Test',
      category: 'group2_2a',
      subCategory: 'group2a',
      categoryName: 'TNPSC Group 2A (Non-Interview)',
      questions: 150,
      duration: '120 min',
      attempts: 2980,
      difficulty: 'Medium',
      rating: 4.7,
    },
    {
      id: 6,
      title: 'TNPSC Group 4 & VAO Complete Full Mock Test (Tamil + GS)',
      category: 'group4_vao',
      subCategory: 'both',
      categoryName: 'TNPSC Group 4 & VAO',
      questions: 200,
      duration: '180 min',
      attempts: 6540,
      difficulty: 'Medium',
      rating: 4.9,
    },
    {
      id: 7,
      title: 'TNPSC VAO Village Administration & Revenue Special Mock',
      category: 'group4_vao',
      subCategory: 'vao',
      categoryName: 'VAO (Village Admin)',
      questions: 100,
      duration: '90 min',
      attempts: 3820,
      difficulty: 'Easy',
      rating: 4.8,
    },
    {
      id: 8,
      title: 'TNPSC Group 4 Junior Assistant & Typist Speed Drill',
      category: 'group4_vao',
      subCategory: 'group4',
      categoryName: 'Group 4 (JA / Typist)',
      questions: 100,
      duration: '90 min',
      attempts: 4210,
      difficulty: 'Easy',
      rating: 4.7,
    },
  ]

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return '#10b981'
      case 'Medium':
        return '#f59e0b'
      case 'Hard':
        return '#ef4444'
      default:
        return '#94a3b8'
    }
  }

  const handleCategorySelect = (cat: 'group1' | 'group2_2a' | 'group4') => {
    setSelectedCategory(cat)
  }

  const filteredTests = mockTests.filter((test) => {
    if (selectedCategory === 'group1') return test.category === 'group1'
    if (selectedCategory === 'group2_2a') return test.category === 'group2_2a'
    if (selectedCategory === 'group4') return test.category === 'group4_vao'
    return true
  })

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
            <span>
              Mock <span className="gradient-text">Tests</span>
            </span>
          </h1>
          <p className="mocktests-subtitle">
            Full-length timed mock tests organized across TNPSC Group 1, TNPSC Group 2 & 2A, and TNPSC Group 4
          </p>
        </motion.div>

        {/* Category Tabs */}
        <div className="mocktests-categories glass">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`mocktests-tab ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => handleCategorySelect(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>


        <div className="mocktests-grid">
          <AnimatePresence mode="wait">
            {filteredTests.map((test, index) => (
              <motion.div
                key={test.id}
                className="mocktest-card glass"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                whileHover={{ scale: 1.01 }}
              >
                <div className="mocktest-top-tags">
                  <span className="mocktest-category-tag">{test.categoryName}</span>
                </div>

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
                    <span>{test.attempts.toLocaleString()} Attempts</span>
                  </div>
                </div>

                <div className="mocktest-meta">
                  <span
                    className="difficulty-badge"
                    style={{
                      background: `${getDifficultyColor(test.difficulty)}20`,
                      color: getDifficultyColor(test.difficulty),
                      borderColor: `${getDifficultyColor(test.difficulty)}40`,
                    }}
                  >
                    {test.difficulty}
                  </span>
                </div>

                <button
                  type="button"
                  className="mocktest-btn"
                  onClick={() =>
                    navigate(
                      `/practice?group=${
                        test.category === 'group4_vao' ? 'group4' : test.category
                      }&title=${encodeURIComponent(test.title)}`
                    )
                  }
                >
                  <Play size={18} />
                  <span>Start Test</span>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default MockTests
