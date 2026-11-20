import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Calendar, Play } from 'lucide-react'
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker'
import { apiFetch } from '../utils/api'
import { useStudentAuth } from '../context/StudentAuthContext'
import { buildAuthRedirectUrl, savePostLoginRedirect } from '../utils/authRedirect'
import { subscribeStudentSync } from '../utils/studentSync'
import './PreviousPapers.css'

interface PaperItem {
  id: number
  year: number
  exam: string
  category: 'group1' | 'group2_2a' | 'group4'
  subjects: string
  paperTitle?: string | null
  paperType?: string
  medium?: string
  questions: number
  durationMinutes?: number
  totalMarks?: number
}

const PreviousPapers = () => {
  useStudyTimeTracker()
  const navigate = useNavigate()
  const { isAuthenticated } = useStudentAuth()
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'group1' | 'group2_2a' | 'group4'>('all')
  const [papers, setPapers] = useState<PaperItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchPublishedPapers = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await apiFetch('/api/previous-papers')
      const json = await res.json().catch(() => ({}))
      if (res.ok && json?.status === 'success' && Array.isArray(json.data)) {
        setPapers(json.data)
      } else {
        setErrorMsg(json?.message || 'Unable to load published previous year papers.')
      }
    } catch {
      setErrorMsg('Network error while loading previous year papers.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPublishedPapers()
    return subscribeStudentSync(() => {
      void fetchPublishedPapers()
    })
  }, [fetchPublishedPapers])

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
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                Loading published previous year papers...
              </div>
            ) : errorMsg ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#fca5a5' }}>
                {errorMsg}
              </div>
            ) : filteredPapers.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                No published previous year papers available for this category yet.
              </div>
            ) : (
              filteredPapers.map((paper, index) => (
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
                      disabled={paper.questions === 0}
                      onClick={() => {
                        const target = `/previous-papers/test/${paper.id}`
                        const studentToken = localStorage.getItem('tnpsc_student_token')
                        if (!isAuthenticated || !studentToken) {
                          savePostLoginRedirect(target)
                          navigate(buildAuthRedirectUrl('login', target), { state: { from: target } })
                          return
                        }
                        navigate(target)
                      }}
                      title={`Start online mock test for ${paper.exam} (${paper.year})`}
                    >
                      <Play size={14} fill="currentColor" />
                      <span>Start Test</span>
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default PreviousPapers
