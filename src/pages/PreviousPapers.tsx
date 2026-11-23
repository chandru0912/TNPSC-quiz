import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Calendar, Play, Filter } from 'lucide-react'
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
  category: 'group1' | 'group2' | 'group2a' | 'group2_2a' | 'group4'
  subjects: string
  paperTitle?: string | null
  paperType?: string
  medium?: string
  questions: number
  durationMinutes?: number
  totalMarks?: number
}

type CategoryFilter = 'all' | 'group1' | 'group2_2a' | 'group4'

const PreviousPapers = () => {
  useStudyTimeTracker()
  const navigate = useNavigate()
  const { isAuthenticated } = useStudentAuth()
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [selectedMedium, setSelectedMedium] = useState<string>('all')
  const [subjectSearch, setSubjectSearch] = useState<string>('')
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

  const categories: { id: CategoryFilter; name: string }[] = [
    { id: 'all', name: 'All Papers' },
    { id: 'group1', name: 'TNPSC Group 1' },
    { id: 'group2_2a', name: 'TNPSC Group 2 and 2A' },
    { id: 'group4', name: 'TNPSC Group 4' },
  ]

  const availableYears = useMemo(
    () => Array.from(new Set(papers.map((p) => p.year))).sort((a, b) => b - a),
    [papers]
  )

  const filteredPapers = useMemo(() => {
    return papers.filter((paper) => {
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'group2_2a') {
          if (paper.category !== 'group2' && paper.category !== 'group2a' && paper.category !== 'group2_2a') {
            return false
          }
        } else if (paper.category !== selectedCategory) {
          return false
        }
      }
      if (selectedYear !== 'all' && String(paper.year) !== selectedYear) return false
      if (selectedMedium !== 'all') {
        const med = String(paper.medium || 'English').toLowerCase()
        if (med !== selectedMedium.toLowerCase() && med !== 'bilingual') return false
      }
      if (subjectSearch.trim()) {
        const q = subjectSearch.trim().toLowerCase()
        const hay = `${paper.subjects || ''} ${paper.paperTitle || ''} ${paper.exam || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [papers, selectedCategory, selectedYear, selectedMedium, subjectSearch])

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
            Practice full-length online examinations from official TNPSC Group 1, Group 2 and 2A, and Group 4 papers
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

        {/* Secondary Filters: Year, Medium, Subject */}
        <div
          className="glass"
          style={{
            padding: '0.85rem 1.1rem',
            borderRadius: '14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#cbd5e1', fontSize: '0.86rem', fontWeight: 600 }}>
            <Filter size={15} />
            <span>Filter Papers</span>
          </div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            aria-label="Filter by Examination Year"
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: '10px',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#f8fafc',
              fontSize: '0.86rem',
            }}
          >
            <option value="all">All Years</option>
            {availableYears.map((yr) => (
              <option key={yr} value={String(yr)}>
                {yr}
              </option>
            ))}
          </select>
          <select
            value={selectedMedium}
            onChange={(e) => setSelectedMedium(e.target.value)}
            aria-label="Filter by Medium"
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: '10px',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#f8fafc',
              fontSize: '0.86rem',
            }}
          >
            <option value="all">All Mediums (Tamil &amp; English)</option>
            <option value="Tamil">Tamil Medium</option>
            <option value="English">English Medium</option>
          </select>
          <input
            type="text"
            value={subjectSearch}
            onChange={(e) => setSubjectSearch(e.target.value)}
            placeholder="Filter by subject or title..."
            aria-label="Filter by Subject"
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: '10px',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#f8fafc',
              fontSize: '0.86rem',
            }}
          />
        </div>

        <div className="papers-table glass">
          <div className="papers-table-header">
            <div className="table-col">Year</div>
            <div className="table-col">Exam Stream</div>
            <div className="table-col">Subjects &amp; Paper Details</div>
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
                No published previous year papers match your filters yet.
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
                  <div className="table-col" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                    <span>{paper.subjects}</span>
                    <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                      {paper.medium || 'English'} Medium
                      {paper.durationMinutes ? ` · ${paper.durationMinutes} mins` : ''}
                      {paper.totalMarks ? ` · ${paper.totalMarks} marks` : ''}
                    </span>
                  </div>
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
                      title={`Start online examination for ${paper.exam} (${paper.year})`}
                    >
                      <Play size={14} fill="currentColor" />
                      <span>Start Exam</span>
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
