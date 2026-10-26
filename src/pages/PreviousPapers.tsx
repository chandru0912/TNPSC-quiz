import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Calendar, Eye, Download } from 'lucide-react'
import './PreviousPapers.css'

interface PaperItem {
  id: number
  year: number
  exam: string
  category: 'group1' | 'group2_2a' | 'group4_vao'
  subjects: string
  questions: number
}

const PreviousPapers = () => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'group1' | 'group2_2a' | 'group4_vao'>('all')

  const categories = [
    { id: 'all' as const, name: 'All Papers' },
    { id: 'group1' as const, name: 'TNPSC Group 1' },
    { id: 'group2_2a' as const, name: 'TNPSC Group 2 & 2A' },
    { id: 'group4_vao' as const, name: 'TNPSC Group 4 & VAO' },
  ]

  const papers: PaperItem[] = [
    { id: 1, year: 2024, exam: 'TNPSC Group 1', category: 'group1', subjects: 'General Studies (Prelims)', questions: 200 },
    { id: 2, year: 2024, exam: 'TNPSC Group 2 & 2A', category: 'group2_2a', subjects: 'General Studies + Aptitude + General Tamil', questions: 200 },
    { id: 3, year: 2024, exam: 'TNPSC Group 4 & VAO', category: 'group4_vao', subjects: 'Pothu Tamil + General Studies (SSLC Standard)', questions: 200 },
    { id: 4, year: 2023, exam: 'TNPSC Group 2 & 2A', category: 'group2_2a', subjects: 'General Studies & Language Eligibility', questions: 200 },
    { id: 5, year: 2023, exam: 'TNPSC Group 4 & VAO', category: 'group4_vao', subjects: 'General Studies & VAO Administration Basics', questions: 200 },
    { id: 6, year: 2022, exam: 'TNPSC Group 1', category: 'group1', subjects: 'General Studies Paper I, II & III', questions: 200 },
    { id: 7, year: 2022, exam: 'TNPSC Group 2 & 2A', category: 'group2_2a', subjects: 'Group 2 & 2A Combined Official Solved Paper', questions: 200 },
    { id: 8, year: 2022, exam: 'TNPSC Group 4 & VAO', category: 'group4_vao', subjects: 'Combined Group 4 & VAO Examination Paper', questions: 200 },
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
            Download and practice with actual solved TNPSC papers organized across Group 1, Group 2 & 2A, and Group 4 & VAO
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
                    className="table-action-btn"
                    onClick={() => alert(`Opening ${paper.exam} (${paper.year}) paper view`)}
                  >
                    <Eye size={15} />
                    <span>View</span>
                  </button>
                  <button
                    className="table-action-btn table-action-primary"
                    onClick={() => alert(`Downloading ${paper.exam} (${paper.year}) PDF`)}
                  >
                    <Download size={15} />
                    <span>PDF</span>
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
