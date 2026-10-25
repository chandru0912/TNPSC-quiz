import { motion } from 'framer-motion'
import { FileText, Calendar, Eye } from 'lucide-react'
import './PreviousPapers.css'

const PreviousPapers = () => {
  const papers = [
    { id: 1, year: 2024, exam: 'TNPSC Group 1', subjects: 'General Studies', questions: 100 },
    { id: 2, year: 2024, exam: 'TNPSC Group 2', subjects: 'General Studies + Aptitude', questions: 200 },
    { id: 3, year: 2023, exam: 'TNPSC Group 4', subjects: 'General Studies', questions: 100 },
    { id: 4, year: 2023, exam: 'TNPSC Group 2A', subjects: 'General Studies', questions: 100 },
    { id: 5, year: 2022, exam: 'TNPSC Group 1', subjects: 'General Studies', questions: 100 },
  ]

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
            <span>Previous Year <span className="gradient-text">Papers</span></span>
          </h1>
          <p className="papers-subtitle">
            Download and practice with actual TNPSC previous year question papers
          </p>
        </motion.div>

        <div className="papers-table glass">
          <div className="papers-table-header">
            <div className="table-col">Year</div>
            <div className="table-col">Exam</div>
            <div className="table-col">Subjects</div>
            <div className="table-col">Questions</div>
            <div className="table-col">Actions</div>
          </div>
          {papers.map((paper, index) => (
            <motion.div
              key={paper.id}
              className="papers-table-row"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <div className="table-col">
                <div className="year-badge">
                  <Calendar size={16} />
                  <span>{paper.year}</span>
                </div>
              </div>
              <div className="table-col exam-name">{paper.exam}</div>
              <div className="table-col">{paper.subjects}</div>
              <div className="table-col">{paper.questions}</div>
              <div className="table-col actions-col">
                <button className="table-action-btn">
                  <Eye size={16} />
                  <span>View</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PreviousPapers
