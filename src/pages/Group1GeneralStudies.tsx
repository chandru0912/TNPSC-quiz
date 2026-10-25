import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen,
  ChevronRight,
  Atom,
  Globe2,
  Landmark,
  Scale,
  TrendingUp,
  ScrollText,
  FileQuestion,
  Layers,
  ArrowLeft,
  Sparkles,
} from 'lucide-react'
import {
  group1GeneralStudiesUnits,
  getUnitChapterCount,
  getUnitLessonCount,
  getTotalGSQuestions,
  getTotalGSChapters,
  getTotalGSLessons,
} from '../data/group1SyllabusData'
import './Group1GeneralStudies.css'

const unitIcons: Record<number, any> = {
  1: Atom,
  2: Globe2,
  3: Landmark,
  4: Scale,
  5: TrendingUp,
  6: ScrollText,
}

const Group1GeneralStudies = () => {
  const navigate = useNavigate()
  const totalQuestions = getTotalGSQuestions() // 175
  const totalChapters = getTotalGSChapters()
  const totalLessons = getTotalGSLessons()

  return (
    <div className="gs-page">
      <div className="gs-container">
        {/* Breadcrumb Navigation */}
        <div className="gs-breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={14} />
          <Link to="/materials">Study Materials</Link>
          <ChevronRight size={14} />
          <span className="active">TNPSC Group 1 General Studies</span>
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
            <span className="gs-badge">Degree Standard</span>
          </div>

          <h1 className="gs-title">
            Part A: General Studies <span className="gradient-text">({totalQuestions} Questions)</span>
          </h1>
          <p className="gs-subtitle">
            Authoritative syllabus structure from the official TNPSC notification. Explore all 6 distinct
            curated Units, master core chapters, and track lesson-wise progress.
          </p>
        </motion.div>

        {/* Dynamic Summary HUD */}
        <div className="gs-summary-hud">
          <div className="gs-hud-card glass">
            <div className="gs-hud-icon">
              <FileQuestion size={22} />
            </div>
            <div className="gs-hud-info">
              <span className="gs-hud-value">{totalQuestions}</span>
              <span className="gs-hud-label">Total Questions</span>
            </div>
          </div>

          <div className="gs-hud-card glass">
            <div className="gs-hud-icon">
              <Layers size={22} />
            </div>
            <div className="gs-hud-info">
              <span className="gs-hud-value">{group1GeneralStudiesUnits.length} Units</span>
              <span className="gs-hud-label">Syllabus Units</span>
            </div>
          </div>

          <div className="gs-hud-card glass">
            <div className="gs-hud-icon">
              <BookOpen size={22} />
            </div>
            <div className="gs-hud-info">
              <span className="gs-hud-value">{totalChapters}</span>
              <span className="gs-hud-label">Structured Chapters</span>
            </div>
          </div>

          <div className="gs-hud-card glass">
            <div className="gs-hud-icon">
              <Sparkles size={22} />
            </div>
            <div className="gs-hud-info">
              <span className="gs-hud-value">{totalLessons}</span>
              <span className="gs-hud-label">Curated Lessons</span>
            </div>
          </div>
        </div>

        {/* Six Unit Cards Responsive Grid */}
        <div className="units-grid">
          {group1GeneralStudiesUnits.map((unit, index) => {
            const Icon = unitIcons[unit.id] || BookOpen
            const chapterCount = getUnitChapterCount(unit)
            const lessonCount = getUnitLessonCount(unit)

            return (
              <motion.div
                key={unit.id}
                className="unit-card glass"
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                whileHover={{ scale: 1.02, y: -5 }}
                onClick={() => navigate(`/materials/group1/unit/${unit.id}`)}
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
                    {unit.tamilTitle && <span className="unit-tamil-title">{unit.tamilTitle}</span>}
                  </div>
                </div>

                <div className="unit-topics-preview">
                  <span className="unit-topics-heading">Official Syllabus Scope:</span>
                  <p className="unit-topics-snippet">
                    {unit.officialSyllabusTopics.slice(0, 3).join(' • ')}...
                  </p>
                </div>

                <div className="unit-metrics">
                  <div className="unit-metric">
                    <BookOpen size={16} />
                    <span>
                      <strong className="unit-metric-bold">{chapterCount}</strong> Chapters
                    </span>
                  </div>
                  <div className="unit-metric">
                    <Layers size={16} />
                    <span>
                      <strong className="unit-metric-bold">{lessonCount}</strong> Lessons
                    </span>
                  </div>
                </div>

                <div className="unit-btn">
                  <span>Explore Unit Syllabus</span>
                  <ChevronRight size={16} />
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Back Button */}
        <div>
          <Link to="/materials" className="back-btn glass">
            <ArrowLeft size={16} />
            <span>Back to All Categories</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Group1GeneralStudies
