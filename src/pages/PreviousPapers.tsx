import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Calendar, Eye, Download, X, Award, CheckCircle, BookOpen } from 'lucide-react'
import { useScrollLock } from '../hooks/useScrollLock'
import './PreviousPapers.css'

interface PaperItem {
  id: number
  year: number
  exam: string
  category: 'group1' | 'group2_2a' | 'group4'
  subjects: string
  questions: number
}

const PreviousPapers = () => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'group1' | 'group2_2a' | 'group4'>('all')
  const [previewPaper, setPreviewPaper] = useState<PaperItem | null>(null)

  // Lock background scrolling while paper preview modal is open
  useScrollLock(Boolean(previewPaper))

  const categories = [
    { id: 'all' as const, name: 'All Papers' },
    { id: 'group1' as const, name: 'TNPSC Group 1' },
    { id: 'group2_2a' as const, name: 'TNPSC Group 2 & 2A' },
    { id: 'group4' as const, name: 'TNPSC Group 4' },
  ]

  const papers: PaperItem[] = [
    { id: 1, year: 2024, exam: 'TNPSC Group 1', category: 'group1', subjects: 'General Studies (Prelims)', questions: 200 },
    { id: 2, year: 2024, exam: 'TNPSC Group 2 & 2A', category: 'group2_2a', subjects: 'General Studies + Aptitude + General Tamil', questions: 200 },
    { id: 3, year: 2024, exam: 'TNPSC Group 4', category: 'group4', subjects: 'Pothu Tamil + General Studies (SSLC Standard)', questions: 200 },
    { id: 4, year: 2023, exam: 'TNPSC Group 2 & 2A', category: 'group2_2a', subjects: 'General Studies & Language Eligibility', questions: 200 },
    { id: 5, year: 2023, exam: 'TNPSC Group 4', category: 'group4', subjects: 'General Studies & Tamil Administration Basics', questions: 200 },
    { id: 6, year: 2022, exam: 'TNPSC Group 1', category: 'group1', subjects: 'General Studies Paper I, II & III', questions: 200 },
    { id: 7, year: 2022, exam: 'TNPSC Group 2 & 2A', category: 'group2_2a', subjects: 'Group 2 & 2A Combined Official Solved Paper', questions: 200 },
    { id: 8, year: 2022, exam: 'TNPSC Group 4', category: 'group4', subjects: 'Combined Group 4 Official Solved Paper', questions: 200 },
  ]

  const filteredPapers = papers.filter((paper) => {
    if (selectedCategory === 'all') return true
    return paper.category === selectedCategory
  })

  const handleDownloadPdf = (paper: PaperItem) => {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${paper.exam} - ${paper.year} Solved Official Paper</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0f172a; max-width: 800px; margin: auto; background: #fff; }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; text-align: center; }
    .title { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
    .sub { font-size: 14px; color: #64748b; font-weight: 500; }
    .meta-box { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px; margin: 20px 0; text-align: center; }
    .meta-item .val { font-size: 16px; font-weight: 700; color: #b45309; }
    .meta-item .lbl { font-size: 11px; text-transform: uppercase; color: #64748b; margin-top: 2px; }
    .section { margin-top: 24px; }
    .sec-head { font-size: 16px; font-weight: 700; color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 14px; }
    .q-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
    .q-title { font-weight: 600; font-size: 14px; margin-bottom: 8px; }
    .q-opt { font-size: 13px; color: #334155; margin: 3px 0 3px 14px; }
    .q-ans { font-size: 13px; font-weight: 600; color: #15803d; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${paper.exam} (${paper.year})</div>
    <div class="sub">Tamil Nadu Public Service Commission • Official Solved Question Paper Edition</div>
  </div>
  <div class="meta-box">
    <div class="meta-item"><div class="val">${paper.year}</div><div class="lbl">Exam Year</div></div>
    <div class="meta-item"><div class="val">${paper.questions}</div><div class="lbl">Questions</div></div>
    <div class="meta-item"><div class="val">3 Hours</div><div class="lbl">Duration</div></div>
    <div class="meta-item"><div class="val">300 Marks</div><div class="lbl">Max Score</div></div>
  </div>
  <div class="section">
    <div class="sec-head">Paper Structure & Syllabus Allocation</div>
    <p style="font-size: 14px; color: #475569; line-height: 1.6;">${paper.subjects}</p>
    <div class="q-item">
      <div class="q-title">Q1. Which constitutional article guarantees Equality Before Law and Equal Protection of the Laws within the territory of India?</div>
      <div class="q-opt">(A) Article 14</div>
      <div class="q-opt">(B) Article 19</div>
      <div class="q-opt">(C) Article 21</div>
      <div class="q-opt">(D) Article 32</div>
      <div class="q-ans">✓ Correct Answer: (A) Article 14 — Guarantees equality before the law and equal protection under Part III of the Constitution.</div>
    </div>
    <div class="q-item">
      <div class="q-title">Q2. In which year was the Tamil Nadu Public Service Commission initially constituted as the Madras Service Commission?</div>
      <div class="q-opt">(A) 1929</div>
      <div class="q-opt">(B) 1935</div>
      <div class="q-opt">(C) 1947</div>
      <div class="q-opt">(D) 1950</div>
      <div class="q-ans">✓ Correct Answer: (A) 1929 — The Madras Service Commission was established under the Madras Service Commission Act, 1929.</div>
    </div>
  </div>
</body>
</html>`
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${paper.exam.replace(/[^a-zA-Z0-9]/g, '_')}_${paper.year}_Solved.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

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
            Download and practice with actual solved TNPSC papers organized across Group 1, Group 2 & 2A, and Group 4
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
                    onClick={() => setPreviewPaper(paper)}
                    title={`View details for ${paper.exam} (${paper.year})`}
                  >
                    <Eye size={15} />
                    <span>View</span>
                  </button>
                  <button
                    className="table-action-btn table-action-primary"
                    onClick={() => handleDownloadPdf(paper)}
                    title={`Download ${paper.exam} (${paper.year}) Solved Paper`}
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

      {/* Interactive Paper Preview Modal */}
      <AnimatePresence>
        {previewPaper && (
          <motion.div
            className="paper-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewPaper(null)}
          >
            <motion.div
              className="paper-modal"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="paper-modal-head">
                <div className="paper-modal-title-group">
                  <span className="paper-modal-badge">
                    <Award size={13} />
                    {previewPaper.exam} • Year {previewPaper.year}
                  </span>
                  <h3 className="paper-modal-title">Official Solved Examination Paper</h3>
                </div>
                <button
                  className="paper-modal-close"
                  onClick={() => setPreviewPaper(null)}
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="paper-modal-body">
                <div className="paper-modal-meta-grid">
                  <div className="paper-meta-card">
                    <div className="paper-meta-label">Questions</div>
                    <div className="paper-meta-value">{previewPaper.questions} MCQs</div>
                  </div>
                  <div className="paper-meta-card">
                    <div className="paper-meta-label">Duration</div>
                    <div className="paper-meta-value">3 Hours</div>
                  </div>
                  <div className="paper-meta-card">
                    <div className="paper-meta-label">Total Marks</div>
                    <div className="paper-meta-value">300 Marks</div>
                  </div>
                </div>

                <div>
                  <h4 className="paper-modal-section-title">
                    <BookOpen size={16} style={{ color: 'var(--gold-primary)' }} />
                    Syllabus Coverage & Structure
                  </h4>
                  <div className="paper-breakdown-list">
                    <div className="paper-breakdown-item">
                      <span className="paper-breakdown-name">Subjects Included</span>
                      <span className="paper-breakdown-tag">{previewPaper.subjects}</span>
                    </div>
                    <div className="paper-breakdown-item">
                      <span className="paper-breakdown-name">Part A: General Tamil / Language</span>
                      <span className="paper-breakdown-tag">100 Questions (150 Marks)</span>
                    </div>
                    <div className="paper-breakdown-item">
                      <span className="paper-breakdown-name">Part B: General Studies & Current Affairs</span>
                      <span className="paper-breakdown-tag">75 Questions (112.5 Marks)</span>
                    </div>
                    <div className="paper-breakdown-item">
                      <span className="paper-breakdown-name">Part C: Aptitude & Mental Ability</span>
                      <span className="paper-breakdown-tag">25 Questions (37.5 Marks)</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.85rem' }}>
                  <CheckCircle size={16} />
                  <span>Includes verified answer key explanations aligned with TNPSC standards.</span>
                </div>
              </div>

              <div className="paper-modal-foot">
                <button
                  className="table-action-btn"
                  onClick={() => setPreviewPaper(null)}
                >
                  Close
                </button>
                <button
                  className="table-action-btn table-action-primary"
                  onClick={() => {
                    handleDownloadPdf(previewPaper)
                  }}
                >
                  <Download size={15} />
                  <span>Download Solved Paper</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default PreviousPapers
