import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GraduationCap, Clock, FileText, Users, Play, Star } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import LanguageSwitch from '../components/LanguageSwitch'
import { BILINGUAL_MOCK_TESTS, UI_TRANSLATIONS } from '../utils/languageData'
import './MockTests.css'

const MockTests = () => {
  const navigate = useNavigate()
  const { language, isTamil } = useLanguage()
  const t = UI_TRANSLATIONS.mockTests[language]
  const [selectedCategory, setSelectedCategory] = useState<'group1' | 'group2_2a' | 'group4'>('group1')

  const categories = [
    { id: 'group1' as const, name: t.tabGroup1 },
    { id: 'group2_2a' as const, name: t.tabGroup2 },
    { id: 'group4' as const, name: t.tabGroup4 },
  ]

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
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

  const filteredTests = BILINGUAL_MOCK_TESTS.filter((test) => {
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
          <div className="mocktests-header-top">
            <h1 className="mocktests-title">
              <GraduationCap size={32} />
              <span>
                {isTamil ? (
                  <>
                    மாதிரித் <span className="gradient-text">தேர்வுகள்</span>
                  </>
                ) : (
                  <>
                    Mock <span className="gradient-text">Tests</span>
                  </>
                )}
              </span>
            </h1>
            <LanguageSwitch variant="section" forceVisible={true} />
          </div>
          <p className="mocktests-subtitle">{t.pageSubtitle}</p>
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
            {filteredTests.map((test, index) => {
              const displayTitle = isTamil ? test.titleTa : test.titleEn
              const displayCategoryName = isTamil ? test.categoryNameTa : test.categoryNameEn
              const displayDuration = isTamil ? test.durationTa : test.durationEn
              const displayDifficulty = isTamil ? test.difficultyTa : test.difficulty

              return (
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
                    <span className="mocktest-category-tag">{displayCategoryName}</span>
                  </div>

                  <div className="mocktest-header">
                    <h3 className="mocktest-title">{displayTitle}</h3>
                    <div className="mocktest-rating">
                      <Star size={16} className="star-icon" />
                      <span>{test.rating}</span>
                    </div>
                  </div>

                  <div className="mocktest-stats">
                    <div className="mocktest-stat">
                      <FileText size={16} />
                      <span>
                        {test.questions} {t.questions}
                      </span>
                    </div>
                    <div className="mocktest-stat">
                      <Clock size={16} />
                      <span>{displayDuration}</span>
                    </div>
                    <div className="mocktest-stat">
                      <Users size={16} />
                      <span>
                        {test.attempts.toLocaleString()} {t.attempts}
                      </span>
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
                      {displayDifficulty}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="mocktest-btn"
                    onClick={() =>
                      navigate(
                        `/practice?group=${
                          test.category === 'group4_vao' ? 'group4' : test.category
                        }&title=${encodeURIComponent(displayTitle)}`
                      )
                    }
                  >
                    <Play size={18} />
                    <span>{t.startTest}</span>
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default MockTests
