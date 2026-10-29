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
  GraduationCap,
} from 'lucide-react'
import {
  group1GeneralStudiesUnits,
  getUnitChapterCount,
  getUnitLessonCount,
  getTotalGSQuestions,
  getTotalGSChapters,
} from '../data/group1SyllabusData'
import { standardClasses } from '../data/group1ClassSyllabusData'
import { useLanguage } from '../context/LanguageContext'
import LanguageSwitch from '../components/LanguageSwitch'
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
  const { isTamil } = useLanguage()
  const totalQuestions = getTotalGSQuestions() // 175
  const totalChapters = getTotalGSChapters()

  return (
    <div className="gs-page">
      <div className="gs-container">
        {/* Breadcrumb Navigation */}
        <div className="gs-breadcrumb">
          <Link to="/">{isTamil ? 'முகப்பு' : 'Home'}</Link>
          <ChevronRight size={14} />
          <Link to="/materials">{isTamil ? 'பாடக்குறிப்புகள்' : 'Study Materials'}</Link>
          <ChevronRight size={14} />
          <span className="active">{isTamil ? 'குரூப் 1 பொது அறிவு' : 'TNPSC Group 1 General Studies'}</span>
        </div>

        {/* Back Link & Language Switch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/materials" className="back-btn glass">
            <ArrowLeft size={16} />
            <span>{isTamil ? 'அனைத்து பிரிவுகளுக்கும் திரும்பு' : 'Back to All Categories'}</span>
          </Link>
          <LanguageSwitch variant="inline" forceVisible={true} />
        </div>

        {/* Main Header */}
        <motion.div
          className="gs-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="gs-badge-row">
            <span className="gs-badge">
              <Sparkles size={14} />
              {isTamil ? 'TNPSC குரூப் 1 முதல்நிலைத் தேர்வு' : 'TNPSC Group 1 Preliminary Examination'}
            </span>
            <span className="gs-code-badge">{isTamil ? 'பாடத்திட்டக் குறியீடு: 497' : 'Syllabus Code: 497'}</span>
            <span className="gs-badge">{isTamil ? 'பட்டப்படிப்புத் தரம்' : 'Degree Standard'}</span>
          </div>

          <h1 className="gs-title">
            {isTamil ? 'பகுதி A: பொது அறிவு' : 'Part A: General Studies'}{' '}
            <span className="gradient-text">({totalQuestions} {isTamil ? 'வினாக்கள்' : 'Questions'})</span>
          </h1>
          <p className="gs-subtitle">
            {isTamil
              ? 'அதிகாரப்பூர்வ TNPSC பாடத்திட்ட கட்டமைப்பு. 6 அலகுகள், முக்கிய அத்தியாயங்கள் மற்றும் வகுப்பு வாரியான சமச்சீர் கல்வி பாடக்குறிப்புகள்.'
              : 'Authoritative syllabus structure from the official TNPSC notification. Explore all 6 distinct curated Units, master core chapters, and track lesson-wise progress.'}
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
              <GraduationCap size={22} />
            </div>
            <div className="gs-hud-info">
              <span className="gs-hud-value">7 Classes</span>
              <span className="gs-hud-label">6th to 12th Standard</span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* REQUIREMENT: At the top of the General Studies page, add a     */}
        {/* heading: "Classes: 6th to 12th Standard". Below that heading,  */}
        {/* show seven separate clickable class cards: 6th Standard, 7th,  */}
        {/* 8th, 9th, 10th, 11th, 12th.                                   */}
        {/* ============================================================== */}
        <section className="classes-top-section glass">
          <div className="classes-section-header">
            <div className="classes-heading-group">
              <div className="classes-title-badge">
                <GraduationCap size={18} />
                <span>Samacheer Kalvi School Textbook Mapping</span>
              </div>
              <h2 className="classes-main-heading">Classes: 6th to 12th Standard</h2>
              <p className="classes-subheading">
                Click any standard below to view Samacheer Kalvi textbook syllabus, or select a standard
                directly under any Unit card below.
              </p>
            </div>
            <span className="classes-count-badge">7 Standards</span>
          </div>

          <div className="class-cards-grid">
            {standardClasses.map((cls, idx) => (
              <motion.div
                key={cls.id}
                className="class-card glass"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.05 }}
                whileHover={{ scale: 1.03, y: -4 }}
                onClick={() => navigate(`/materials/group1/unit/1/class/${cls.id}`)}
              >
                <div className="class-card-top">
                  <span className="class-num-badge">{cls.id}th</span>
                  <span className="class-badge-samacheer">Samacheer</span>
                </div>

                <div className="class-card-main">
                  <div className="class-icon-circle">
                    <GraduationCap size={22} />
                  </div>
                  <h3 className="class-card-title">{cls.label}</h3>
                  <p className="class-card-desc">Units 1 to 6 mapped textbook lessons</p>
                </div>

                <div className="class-card-cta">
                  <span>Explore Class</span>
                  <ChevronRight size={14} />
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Section Heading for the 6 General Studies Units */}
        <div className="units-section-header">
          <div className="units-header-left">
            <h2 className="units-section-title">General Studies Units (Degree Standard)</h2>
            <p className="units-section-sub">
              Each unit maps all 7 standards (6th to 12th) plus the comprehensive syllabus outline.
            </p>
          </div>
          <span className="units-total-badge">6 Official Units</span>
        </div>

        {/* Six Unit Cards Responsive Grid with Standard Selectors */}
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
                whileHover={{ scale: 1.015, y: -4 }}
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
                    <h2 className="unit-title">{isTamil && unit.tamilTitle ? unit.tamilTitle : unit.title}</h2>
                    {unit.tamilTitle && <span className="unit-tamil-title">{isTamil ? unit.title : unit.tamilTitle}</span>}
                  </div>
                </div>

                <div className="unit-topics-preview">
                  <span className="unit-topics-heading">{isTamil ? 'பாடத்திட்ட வரையறை:' : 'Official Syllabus Scope:'}</span>
                  <p className="unit-topics-snippet">
                    {unit.officialSyllabusTopics.slice(0, 3).join(' • ')}...
                  </p>
                </div>

                <div className="unit-metrics">
                  <div className="unit-metric">
                    <BookOpen size={16} />
                    <span>
                      <strong className="unit-metric-bold">{chapterCount}</strong> {isTamil ? 'அத்தியாயங்கள்' : 'Chapters'}
                    </span>
                  </div>
                  <div className="unit-metric">
                    <Layers size={16} />
                    <span>
                      <strong className="unit-metric-bold">{lessonCount}</strong> {isTamil ? 'பாடங்கள்' : 'Lessons'}
                    </span>
                  </div>
                </div>

                {/* ============================================================== */}
                {/* REQUIREMENT: Each Unit must allow selecting one of the seven   */}
                {/* classes. When a user clicks 6th Standard under Unit 1, open a  */}
                {/* separate page for Unit 1 – 6th Standard. Same for 7th to 12th  */}
                {/* across all units.                                              */}
                {/* ============================================================== */}
                <div
                  className="unit-class-selector"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="unit-class-selector-header">
                    <div className="unit-class-selector-title">
                      <GraduationCap size={14} />
                      <span>{isTamil ? 'வகுப்பைத் தேர்ந்தெடுக்க (6 முதல் 12 வரை):' : 'Select Class (6th to 12th Standard):'}</span>
                    </div>
                  </div>

                  <div className="unit-class-pills-row">
                    {standardClasses.map((cls) => (
                      <button
                        key={cls.id}
                        type="button"
                        className="unit-class-pill-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/materials/group1/unit/${unit.id}/class/${cls.id}`)
                        }}
                        title={`Open ${unit.unitNumber} – ${cls.label}`}
                      >
                        {cls.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="unit-btn">
                  <span>{isTamil ? `${unit.unitNumber} முழு பாடத்திட்டத்தைக் காண்க` : `Explore Full ${unit.unitNumber} Syllabus`}</span>
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
