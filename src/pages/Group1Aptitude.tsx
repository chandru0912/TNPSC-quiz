import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  ArrowLeft,
  Calculator,
  Brain,
  FileQuestion,
  HelpCircle,
  Clock,
  Sparkles,
} from 'lucide-react'
import { group1AptitudeUnits } from '../data/group1SyllabusData'
import './Group1GeneralStudies.css'

const Group1Aptitude = () => {
  const navigate = useNavigate()
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  return (
    <div className="gs-page">
      <div className="gs-container">
        {/* Breadcrumb Navigation */}
        <div className="gs-breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={14} />
          <Link to="/materials">Study Materials</Link>
          <ChevronRight size={14} />
          <span className="active">TNPSC Group 1 Aptitude & Mental Ability</span>
        </div>

        {/* Back Link */}
        <div>
          <Link to="/materials" className="back-btn glass">
            <ArrowLeft size={16} />
            <span>Back to Categories</span>
          </Link>
        </div>

        {/* Header */}
        <motion.div
          className="gs-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="gs-badge-row">
            <span className="gs-badge">
              <Sparkles size={14} />
              TNPSC Group 1 Preliminary Examination
            </span>
            <span className="gs-code-badge">Syllabus Code: 497</span>
            <span className="gs-badge">SSLC Standard (10th Standard)</span>
          </div>

          <h1 className="gs-title">
            Part B: Aptitude and Mental Ability <span className="gradient-text">(25 Questions)</span>
          </h1>
          <p className="gs-subtitle">
            Official Part B syllabus from the TNPSC notification. Covering numerical aptitude and logical reasoning
            designed to evaluate problem-solving speed and analytical accuracy.
          </p>
        </motion.div>

        {/* Units Grid */}
        <div className="units-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {group1AptitudeUnits.map((unit, index) => {
            const Icon = unit.id === 1 ? Calculator : Brain

            return (
              <motion.div
                key={unit.id}
                className="unit-card glass"
                initial={{ opacity: 0, y: isMobile ? 12 : 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: isMobile ? 0.3 : 0.45,
                  delay: isMobile ? Math.min(index * 0.03, 0.1) : index * 0.1,
                  ease: [0.25, 1, 0.5, 1],
                }}
                whileHover={isMobile ? undefined : { scale: 1.02, y: -4 }}
              >
                <div className="unit-top-row">
                  <span className="unit-number-pill">{unit.unitNumber}</span>
                  <span className="unit-q-count">{unit.questionCount} Questions</span>
                </div>

                <div className="unit-main-header">
                  <div className="unit-icon-box">
                    <Icon size={24} />
                  </div>
                  <div className="unit-title-group">
                    <h2 className="unit-title">{unit.title}</h2>
                    <span className="unit-tamil-title">
                      {unit.id === 1 ? 'திறனறிவு (15 கேள்விகள்)' : 'காரணவியல் (10 கேள்விகள்)'}
                    </span>
                  </div>
                </div>

                <div className="unit-topics-preview">
                  <span className="unit-topics-heading">Official Topics:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                    {unit.topics.map((t, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.78rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '9999px',
                          background: 'rgba(255, 215, 0, 0.08)',
                          border: '1px solid rgba(255, 215, 0, 0.2)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="unit-metrics">
                  <div className="unit-metric">
                    <HelpCircle size={16} />
                    <span>
                      <strong className="unit-metric-bold">{unit.questionCount}</strong> Objective Marks
                    </span>
                  </div>
                  <div className="unit-metric">
                    <Clock size={16} />
                    <span>
                      Standard: <strong className="unit-metric-bold">SSLC</strong>
                    </span>
                  </div>
                </div>

                <button
                  className="unit-btn"
                  onClick={() => navigate('/practice')}
                >
                  <FileQuestion size={16} />
                  <span>Practice Aptitude MCQs</span>
                </button>
              </motion.div>
            )
          })}
        </div>

        {/* Link to General Studies */}
        <div className="unit-action-strip glass" style={{ marginTop: '1rem' }}>
          <div className="action-strip-info">
            <span className="action-strip-title">Looking for General Studies?</span>
            <span className="action-strip-sub">
              Access the complete 6 Units of General Studies (175 Questions) for TNPSC Group 1.
            </span>
          </div>
          <Link to="/materials/group1/general-studies" className="btn btn-primary">
            <span>Explore General Studies (175 Qs)</span>
            <ChevronRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Group1Aptitude
