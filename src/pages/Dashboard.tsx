import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import DateCalendarPopover from '../components/DateCalendarPopover'
import {
  LayoutDashboard,
  BookOpen,
  ListChecks,
  FileText,
  GraduationCap,
  Archive,
  TrendingUp,
  Flame,
  Target,
  Trophy,
  Clock,
  Award,
  CheckCircle2,
  Circle,
  ChevronRight,
  Menu,
  X,
  ArrowLeft,
  Sparkles,
  Timer,
  BarChart3,
} from 'lucide-react'
import './Dashboard.css'

const Dashboard = () => {
  const [userName] = useState('Student')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const sidebarLinks = [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Study Materials', to: '/materials', icon: BookOpen },
    { label: 'Lesson-wise Questions', to: '/school-materials', icon: ListChecks },
    { label: 'MCQ Practice', to: '/practice', icon: FileText },
    { label: 'Mock Tests', to: '/mock-tests', icon: GraduationCap },
    { label: 'Previous Year Questions', to: '/previous-papers', icon: Archive },
  ]

  const featureCards = [
    {
      title: 'Study Materials',
      description: 'Standard-wise notes and syllabus coverage.',
      to: '/materials',
      icon: BookOpen,
      meta: '120 chapters',
    },
    {
      title: 'Lesson-wise Questions',
      description: 'Practice after every lesson you finish.',
      to: '/school-materials',
      icon: ListChecks,
      meta: '6th – 12th std',
    },
    {
      title: 'MCQ Practice',
      description: 'Topic-wise objective questions with answers.',
      to: '/practice',
      icon: FileText,
      meta: '2,500 questions',
    },
    {
      title: 'Mock Tests',
      description: 'Full-length tests with real exam timing.',
      to: '/mock-tests',
      icon: GraduationCap,
      meta: '20 tests',
    },
    {
      title: 'Previous Year Questions',
      description: 'Solved papers from past TNPSC exams.',
      to: '/previous-papers',
      icon: Archive,
      meta: '2015 – 2025',
    },
    {
      title: 'Progress Tracker',
      description: 'See accuracy, streaks and weak areas.',
      to: '/dashboard',
      icon: TrendingUp,
      meta: 'Updated live',
    },
  ]

  const progressStats = [
    { icon: BookOpen, label: 'Materials Studied', value: '45/120', percentage: 37.5 },
    { icon: FileText, label: 'Questions Attempted', value: '892/2500', percentage: 35.7 },
    { icon: Trophy, label: 'Mock Tests', value: '8/20', percentage: 40 },
    { icon: Target, label: 'Accuracy', value: '78%', percentage: 78 },
  ]

  const recentActivity = [
    { subject: 'General Studies', topic: 'Indian Polity', questions: 25, score: '22/25', time: '2 hours ago' },
    { subject: 'History', topic: 'Freedom Movement', questions: 30, score: '26/30', time: '5 hours ago' },
    { subject: 'Geography', topic: 'Indian Geography', questions: 20, score: '18/20', time: '1 day ago' },
  ]

  const upcomingGoals = [
    { task: 'Complete Polity Chapter 5', completed: true },
    { task: 'Take Mock Test 9', completed: false },
    { task: 'Revise History Notes', completed: false },
    { task: 'Practice 50 Questions Daily', completed: true },
  ]

  const weeklyProgress = [
    { day: 'Mon', value: 65 },
    { day: 'Tue', value: 80 },
    { day: 'Wed', value: 45 },
    { day: 'Thu', value: 90 },
    { day: 'Fri', value: 75 },
    { day: 'Sat', value: 60 },
    { day: 'Sun', value: 40 },
  ]

  const overallProgress = 42
  const ringRadius = 52
  const ringCircumference = 2 * Math.PI * ringRadius

  const sidebarContent = (
    <>
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">
          <Sparkles size={20} />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-title">Study Hub</span>
          <span className="sidebar-brand-sub">TNPSC Premium</span>
        </div>
        <button
          type="button"
          className="sidebar-close"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>
      </div>

      <div className="sidebar-profile">
        <div className="sidebar-avatar">{userName.charAt(0)}</div>
        <div className="sidebar-profile-info">
          <span className="sidebar-profile-name">{userName}</span>
          <span className="sidebar-profile-role">Group 2 & 2A Aspirant</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Dashboard navigation">
        <span className="sidebar-nav-label">Learn</span>
        {sidebarLinks.map((link) => {
          const Icon = link.icon
          const active = link.to === '/dashboard'
          return (
            <Link
              key={link.label}
              to={link.to}
              className={`sidebar-link ${active ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={18} />
              <span>{link.label}</span>
              {active && <span className="sidebar-link-dot" />}
            </Link>
          )
        })}
      </nav>

      <div className="sidebar-streak">
        <div className="sidebar-streak-icon">
          <Flame size={18} />
        </div>
        <div>
          <div className="sidebar-streak-value">7 day streak</div>
          <div className="sidebar-streak-text">Keep the momentum going</div>
        </div>
      </div>

      <Link to="/" className="sidebar-home" onClick={() => setSidebarOpen(false)}>
        <ArrowLeft size={16} />
        <span>Back to Home</span>
      </Link>
    </>
  )

  return (
    <div className="dashboard-shell">
      {/* Desktop sidebar */}
      <aside className="dashboard-sidebar glass">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="sidebar-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              className="dashboard-sidebar sidebar-mobile glass"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="dashboard-content">
        {/* Header */}
        <motion.header
          className="dash-header"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="dash-header-left">
            <button
              type="button"
              className="dash-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="dash-eyebrow">Dashboard overview</p>
              <h1 className="dash-title">
                Welcome back, <span className="gradient-text">{userName}</span>
              </h1>
              <p className="dash-subtitle">
                Your TNPSC preparation, tracked in one place.
              </p>
            </div>
          </div>
          <div className="dash-header-meta">
            <DateCalendarPopover />
            <div className="dash-chip dash-chip-gold">
              <Flame size={16} />
              <span>7 day streak</span>
            </div>
          </div>
        </motion.header>

        {/* Overview: progress ring + stats */}
        <div className="dash-overview">
          <motion.div
            className="overview-ring-card glass"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            <div className="overview-ring">
              <svg viewBox="0 0 130 130" className="ring-svg">
                <circle
                  className="ring-track"
                  cx="65"
                  cy="65"
                  r={ringRadius}
                  fill="none"
                  strokeWidth="9"
                />
                <motion.circle
                  className="ring-progress"
                  cx="65"
                  cy="65"
                  r={ringRadius}
                  fill="none"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  initial={{ strokeDashoffset: ringCircumference }}
                  animate={{
                    strokeDashoffset:
                      ringCircumference - (overallProgress / 100) * ringCircumference,
                  }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </svg>
              <div className="ring-center">
                <span className="ring-value">{overallProgress}%</span>
                <span className="ring-label">Overall</span>
              </div>
            </div>
            <div className="overview-ring-copy">
              <h2 className="overview-heading">Preparation progress</h2>
              <p className="overview-text">
                You are ahead of 68% of aspirants this week. Finish 2 more lessons
                to unlock your next milestone.
              </p>
              <div className="overview-legend">
                <span className="legend-item">
                  <span className="legend-dot legend-dot-gold" /> On track
                </span>
                <span className="legend-item">
                  <span className="legend-dot legend-dot-muted" /> Remaining
                </span>
              </div>
            </div>
          </motion.div>

          <div className="overview-stats">
            {progressStats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <motion.div
                  key={stat.label}
                  className="stat-tile glass"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 + index * 0.05 }}
                  whileHover={{ y: -4 }}
                >
                  <div className="stat-tile-top">
                    <span className="stat-tile-icon">
                      <Icon size={18} />
                    </span>
                    <span className="stat-tile-percent">{stat.percentage}%</span>
                  </div>
                  <div className="stat-tile-value">{stat.value}</div>
                  <div className="stat-tile-label">{stat.label}</div>
                  <div className="stat-tile-bar">
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.percentage}%` }}
                      transition={{ duration: 1, delay: 0.3 + index * 0.05 }}
                    />
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Feature cards */}
        <section className="dash-section">
          <div className="dash-section-head">
            <div>
              <h2 className="dash-section-title">Start learning</h2>
              <p className="dash-section-sub">
                Everything you need for TNPSC, one tap away.
              </p>
            </div>
            <span className="dash-section-tag">
              <Timer size={14} /> Placeholder demo content
            </span>
          </div>

          <div className="feature-grid">
            {featureCards.map((card, index) => {
              const Icon = card.icon
              return (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 + index * 0.05 }}
                >
                  <Link to={card.to} className="feature-tile glass">
                    <span className="feature-tile-icon">
                      <Icon size={22} />
                    </span>
                    <div className="feature-tile-body">
                      <h3 className="feature-tile-title">{card.title}</h3>
                      <p className="feature-tile-text">{card.description}</p>
                      <span className="feature-tile-meta">{card.meta}</span>
                    </div>
                    <ChevronRight size={18} className="feature-tile-arrow" />
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* Activity + chart + goals */}
        <div className="dash-lower-grid">
          <motion.section
            className="panel glass"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="panel-head">
              <div className="panel-title-group">
                <Clock size={20} className="panel-icon" />
                <h2 className="panel-title">Recent activity</h2>
              </div>
              <span className="panel-hint">Last 3 sessions</span>
            </div>
            <div className="activity-list">
              {recentActivity.map((activity, index) => (
                <div key={index} className="activity-item">
                  <span className="activity-dot" />
                  <div className="activity-content">
                    <div className="activity-main">
                      <span className="activity-subject">{activity.subject}</span>
                      <span className="activity-sep">•</span>
                      <span className="activity-topic">{activity.topic}</span>
                    </div>
                    <div className="activity-details">
                      <span>{activity.questions} questions</span>
                      <span className="activity-sep">•</span>
                      <span className="activity-score">{activity.score}</span>
                      <span className="activity-sep">•</span>
                      <span>{activity.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section
            className="panel glass"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
          >
            <div className="panel-head">
              <div className="panel-title-group">
                <BarChart3 size={20} className="panel-icon" />
                <h2 className="panel-title">Weekly study</h2>
              </div>
              <span className="panel-hint">Goal completion</span>
            </div>
            <div className="weekly-chart">
              {weeklyProgress.map((day, index) => (
                <div key={day.day} className="chart-bar-container">
                  <span className="chart-value">{day.value}%</span>
                  <motion.div
                    className="chart-bar"
                    initial={{ height: 0 }}
                    animate={{ height: `${day.value}%` }}
                    transition={{ duration: 0.8, delay: 0.3 + index * 0.05 }}
                  />
                  <span className="chart-label">{day.day}</span>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section
            className="panel glass"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="panel-head">
              <div className="panel-title-group">
                <Award size={20} className="panel-icon" />
                <h2 className="panel-title">Today's goals</h2>
              </div>
              <span className="panel-hint">2 of 4 done</span>
            </div>
            <div className="goals-list">
              {upcomingGoals.map((goal, index) => (
                <div key={index} className={`goal-item ${goal.completed ? 'completed' : ''}`}>
                  {goal.completed ? (
                    <CheckCircle2 size={20} className="goal-icon completed" />
                  ) : (
                    <Circle size={20} className="goal-icon" />
                  )}
                  <span className="goal-text">{goal.task}</span>
                </div>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
