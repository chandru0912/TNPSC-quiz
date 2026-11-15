import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen,
  ChevronRight,
  ArrowLeft,
  Calculator,
  Brain,
  FileQuestion,
  Layers,
  Sparkles,
  GraduationCap,
} from 'lucide-react'
import { group1AptitudeUnits, type AptitudeUnit } from '../data/group1SyllabusData'
import { standardClasses } from '../data/group1ClassSyllabusData'
import { dynamicSyllabusService } from '../services/dynamicSyllabusService'
import './Group1GeneralStudies.css'

interface MergedAptitudeUnit extends AptitudeUnit {
  dbLessonsCount?: number
  tamilTitle?: string
}

const Group1Aptitude = () => {
  const navigate = useNavigate()
    const [units, setUnits] = useState<MergedAptitudeUnit[]>(group1AptitudeUnits)

  useEffect(() => {
    let isCancelled = false

    const loadUnits = () => {
      fetch('/api/study-management/units?examId=group1&subjectId=aptitude')
        .then((res) => res.json())
        .then((data) => {
          if (isCancelled) return
          if (data.success && Array.isArray(data.units) && data.units.length > 0) {
            const staticMap = new Map(group1AptitudeUnits.map((u) => [u.id, u]))
            const mapped: MergedAptitudeUnit[] = data.units.map((u: any) => {
              const unitNum = Number(u.unit_number)
              const existing = staticMap.get(unitNum)
              const exactTitle = (u.title || existing?.title || `Unit ${unitNum}`).trim()
              const exactCode = (u.unit_code || existing?.unitNumber || `Unit ${unitNum}`).trim()
              return {
                ...(existing || {
                  id: unitNum,
                  standard: 'SSLC Standard',
                  topics: [],
                }),
                id: unitNum,
                unitNumber: exactCode,
                title: exactTitle,
                tamilTitle: exactTitle,
                questionCount: u.question_count || existing?.questionCount || (unitNum === 1 ? 15 : 10),
                topics: u.description
                  ? [u.description]
                  : existing?.topics || [`Aptitude outline for ${exactTitle}`],
                dbLessonsCount: Number(u.lessons_count || 0),
              }
            })
            setUnits(mapped)
          } else {
            setUnits(group1AptitudeUnits)
          }
        })
        .catch(() => {})
    }

    loadUnits()
    const unsubscribe = dynamicSyllabusService.subscribe(() => {
      loadUnits()
    })

    return () => {
      isCancelled = true
      unsubscribe()
    }
  }, [])

  const totalQuestions = units.reduce((acc, u) => acc + (u.questionCount || 0), 0) || 25
  const totalLessons = units.reduce((acc, u) => acc + (u.dbLessonsCount || 0), 0)

  return (
    <div className="gs-page">
      <div className="gs-container">
        {/* Breadcrumb Navigation */}
        <div className="gs-breadcrumb">
          <Link to="/">{'Home'}</Link>
          <ChevronRight size={14} />
          <Link to="/materials">{'Study Materials'}</Link>
          <ChevronRight size={14} />
          <span className="active">
            {'TNPSC Group 1 Aptitude & Mental Ability'}
          </span>
        </div>

        {/* Back Link & Language Switch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/materials" className="back-btn glass">
            <ArrowLeft size={16} />
            <span>{'Back to All Categories'}</span>
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
              {'TNPSC Group 1 Preliminary Examination'}
            </span>
            <span className="gs-code-badge">{'Syllabus Code: 497'}</span>
            <span className="gs-badge">{'SSLC Standard (10th Standard)'}</span>
          </div>

          <h1 className="gs-title">
            {'Part B: Aptitude and Mental Ability'}{' '}
            <span className="gradient-text">({totalQuestions} {'Questions'})</span>
          </h1>
          <p className="gs-subtitle">
            {'Official Part B syllabus from the TNPSC notification. Explore Unit I & Unit II, Samacheer Kalvi class-wise lessons (6th to 12th Standard), study notes, and topic MCQs.'}
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
              <span className="gs-hud-label">{'Total Questions'}</span>
            </div>
          </div>

          <div className="gs-hud-card glass">
            <div className="gs-hud-icon">
              <Layers size={22} />
            </div>
            <div className="gs-hud-info">
              <span className="gs-hud-value">{units.length} {'Units'}</span>
              <span className="gs-hud-label">{'Syllabus Units'}</span>
            </div>
          </div>

          <div className="gs-hud-card glass">
            <div className="gs-hud-icon">
              <BookOpen size={22} />
            </div>
            <div className="gs-hud-info">
              <span className="gs-hud-value">{totalLessons > 0 ? totalLessons : '100+'}</span>
              <span className="gs-hud-label">{'Mapped Lessons'}</span>
            </div>
          </div>

          <div className="gs-hud-card glass">
            <div className="gs-hud-icon">
              <GraduationCap size={22} />
            </div>
            <div className="gs-hud-info">
              <span className="gs-hud-value">7 {'Classes'}</span>
              <span className="gs-hud-label">{'6th to 12th Standard'}</span>
            </div>
          </div>
        </div>

        {/* Classes Top Section */}
        <section className="classes-top-section glass">
          <div className="classes-section-header">
            <div className="classes-heading-group">
              <div className="classes-title-badge">
                <GraduationCap size={18} />
                <span>{'Samacheer Kalvi School Textbook Mapping'}</span>
              </div>
              <h2 className="classes-main-heading">
                {'Classes: 6th to 12th Standard'}
              </h2>
              <p className="classes-subheading">
                {'Click any standard below to view Samacheer Kalvi aptitude textbook lessons, or select a standard directly under any Unit card below.'}
              </p>
            </div>
            <span className="classes-count-badge">7 {'Standards'}</span>
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
                onClick={() => navigate(`/materials/group1/aptitude/unit/1/class/${cls.id}`)}
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
                  <p className="class-card-desc">
                    {`Units 1 to ${units.length} mapped textbook lessons`}
                  </p>
                </div>

                <div className="class-card-cta">
                  <span>{'Explore Class'}</span>
                  <ChevronRight size={14} />
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Section Heading for Units */}
        <div className="units-section-header">
          <div className="units-header-left">
            <h2 className="units-section-title">
              {'Aptitude & Mental Ability Units (SSLC Standard)'}
            </h2>
            <p className="units-section-sub">
              {'Each unit maps Samacheer Kalvi standards (6th to 12th) with lessons, focus areas, study notes, and MCQ practice.'}
            </p>
          </div>
          <span className="units-total-badge">{units.length} {'Official Units'}</span>
        </div>

        {/* Units Grid with Standard Selectors */}
        <div className="units-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
          {units.map((unit, index) => {
            const Icon = unit.id === 1 ? Calculator : Brain
            const lessonCount = unit.dbLessonsCount ?? 0

            return (
              <motion.div
                key={unit.id}
                className="unit-card glass"
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.1 }}
                whileHover={{ scale: 1.015, y: -4 }}
                onClick={() => navigate(`/materials/group1/aptitude/unit/${unit.id}`)}
              >
                <div className="unit-top-row">
                  <span className="unit-number-pill">{unit.unitNumber}</span>
                  <span className="unit-q-count">
                    {unit.questionCount} {'Questions'}
                  </span>
                </div>

                <div className="unit-main-header">
                  <div className="unit-icon-box">
                    <Icon size={24} />
                  </div>
                  <div className="unit-title-group">
                    <h2 className="unit-title">{unit.title}</h2>
                    <span className="unit-tamil-title">
                      {unit.id === 1 ? 'Aptitude (15 Questions)' : 'Reasoning (10 Questions)'}
                    </span>
                  </div>
                </div>

                <div className="unit-topics-preview">
                  <span className="unit-topics-heading">
                    {'Official Syllabus Scope:'}
                  </span>
                  <p className="unit-topics-snippet">
                    {unit.topics.slice(0, 4).map((t) => t).join(' • ')}
                    {unit.topics.length > 4 ? '...' : ''}
                  </p>
                </div>

                <div className="unit-metrics">
                  <div className="unit-metric">
                    <FileQuestion size={16} />
                    <span>
                      <strong className="unit-metric-bold">{unit.questionCount}</strong>{' '}
                      {'Objective Marks'}
                    </span>
                  </div>
                  <div className="unit-metric">
                    <Layers size={16} />
                    <span>
                      <strong className="unit-metric-bold">{lessonCount}</strong>{' '}
                      {'Lessons'}
                    </span>
                  </div>
                </div>

                {/* Class Selector under each Unit */}
                <div
                  className="unit-class-selector"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="unit-class-selector-header">
                    <div className="unit-class-selector-title">
                      <GraduationCap size={14} />
                      <span>{'Select Class (6th to 12th Standard):'}</span>
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
                          navigate(`/materials/group1/aptitude/unit/${unit.id}/class/${cls.id}`)
                        }}
                        title={`Open ${unit.unitNumber} – ${cls.label}`}
                      >
                        {cls.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="unit-btn">
                  <span>
                    {`Explore Full ${unit.unitNumber} Syllabus`}
                  </span>
                  <ChevronRight size={16} />
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Link to General Studies */}
        <div className="unit-action-strip glass" style={{ marginTop: '1.5rem' }}>
          <div className="action-strip-info">
            <span className="action-strip-title">
              {'Looking for General Studies?'}
            </span>
            <span className="action-strip-sub">
              {'Access the complete 6 Units of General Studies (175 Questions) for TNPSC Group 1.'}
            </span>
          </div>
          <Link to="/materials/group1/general-studies" className="btn btn-primary">
            <span>{'Explore General Studies (175 Qs)'}</span>
            <ChevronRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Group1Aptitude
