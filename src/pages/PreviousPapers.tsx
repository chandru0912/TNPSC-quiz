import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Calendar, Play } from 'lucide-react'
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker'
import { apiFetch } from '../utils/api'
import './PreviousPapers.css'

interface PaperItem {
  id: number
  year: number
  exam: string
  category: 'group1' | 'group2_2a' | 'group4'
  subjects: string
  questions: number
}

const DEFAULT_PAPERS: PaperItem[] = [
  { id: 1, year: 2024, exam: 'TNPSC Group 1', category: 'group1', subjects: 'General Studies (Prelims)', questions: 200 },
  { id: 2, year: 2024, exam: 'TNPSC Group 2 & 2A', category: 'group2_2a', subjects: 'General Studies + Aptitude + General Tamil', questions: 200 },
  { id: 3, year: 2024, exam: 'TNPSC Group 4', category: 'group4', subjects: 'Pothu Tamil + General Studies (SSLC Standard)', questions: 200 },
  { id: 4, year: 2023, exam: 'TNPSC Group 2 & 2A', category: 'group2_2a', subjects: 'General Studies & Language Eligibility', questions: 200 },
  { id: 5, year: 2023, exam: 'TNPSC Group 4', category: 'group4', subjects: 'General Studies & Tamil Administration Basics', questions: 200 },
  { id: 6, year: 2022, exam: 'TNPSC Group 1', category: 'group1', subjects: 'General Studies Paper I, II & III', questions: 200 },
  { id: 7, year: 2022, exam: 'TNPSC Group 2 & 2A', category: 'group2_2a', subjects: 'Group 2 & 2A Combined Official Solved Paper', questions: 200 },
  { id: 8, year: 2022, exam: 'TNPSC Group 4', category: 'group4', subjects: 'Combined Group 4 Official Solved Paper', questions: 200 },
]

const PreviousPapers = () => {
  useStudyTimeTracker()
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'group1' | 'group2_2a' | 'group4'>('all')
  const [papers, setPapers] = useState<PaperItem[]>(DEFAULT_PAPERS)

  useEffect(() => {
    let isMounted = true
    apiFetch('/api/previous-papers')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (isMounted && json?.status === 'success' && Array.isArray(json.data) && json.data.length > 0) {
          setPapers(json.data)
        }
      })
      .catch(() => {
        // Keep initial paper catalog on transient network errors
      })
    return () => {
      isMounted = false
    }
  }, [])

  const categories = [
    { id: 'all' as const, name: 'All Papers' },
    { id: 'group1' as const, name: 'TNPSC Group 1' },
    { id: 'group2_2a' as const, name: 'TNPSC Group 2 & 2A' },
    { id: 'group4' as const, name: 'TNPSC Group 4' },
  ]

  const filteredPapers = papers.filter((paper) => {
    if (selectedCategory === 'all') return true
    return paper.category === selectedCategory
  })

  return (
    <div className="papers">
      <div className="papers-container">
        <motion.div
          className="papers-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="papers-title">
            <FileText size={32} />
            <span>
              Previous Year <span className="gradient-text">Papers</span>
            </span>
          </h1>
          <p className="papers-subtitle">
            Practice full-length online mock examinations from previous TNPSC Group 1, Group 2 &amp; 2A, and Group 4 papers
          </p>
        </motion.div>

        {/* Category Filter Tabs */}
        <div className="papers-categories glass">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`papers-tab ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="papers-table glass">
          <div className="papers-table-header">
            <div className="table-col">Year</div>
            <div className="table-col">Exam Stream</div>
            <div className="table-col">Subjects & Paper Details</div>
            <div className="table-col">Questions</div>
            <div className="table-col">Actions</div>
          </div>
          <AnimatePresence mode="wait">
            {filteredPapers.map((paper, index) => (
              <motion.div
                key={paper.id}
                className="papers-table-row"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.35, delay: index * 0.04 }}
              >
                <div className="table-col">
                  <div className="year-badge">
                    <Calendar size={15} />
                    <span>{paper.year}</span>
                  </div>
                </div>
                <div className="table-col exam-name">{paper.exam}</div>
                <div className="table-col">{paper.subjects}</div>
                <div className="table-col">{paper.questions} Qs</div>
                <div className="table-col actions-col">
                  <button
                    type="button"
                    className="table-action-btn table-action-primary"
                    onClick={() => navigate(`/previous-papers/test/${paper.id}`)}
                    title={`Start online mock test for ${paper.exam} (${paper.year})`}
                  >
                    <Play size={14} fill="currentColor" />
                    <span>Start Test</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default PreviousPapers
