import { useState, useEffect, useCallback } from 'react'
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
  BarChart3,
  Zap,
  AlertTriangle,
  RotateCcw,
  LogOut,
  User,
} from 'lucide-react'
import './Dashboard.css'
import { useScrollLock } from '../hooks/useScrollLock'
import { useStudentAuth } from '../context/StudentAuthContext'
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker'
import { apiFetch } from '../utils/api'
import { CloudAiGeneratorModal } from '../components/CloudAiGeneratorModal'

interface DashboardData {
  student: {
    id: number
    fullName: string
    email: string
    targetGroup: string
    createdAt: string
  }
  metrics: {
    totalStudySeconds: number
    totalStudyHours: number
    studyHoursFormatted: string
    totalQuestionsSolved: number
    totalQuestionsAttempted: number
    totalAttempts: number
    totalCorrect: number
    targetQuestions: number
    overallAccuracy: number
    currentStreak: number
    materialsStudied: number
    targetMaterials: number
    mockTestsCompleted: number
    targetMockTests: number
    mockAvgScore: number
    mockHighestScore: number
    overallProgress: number
  }
  progressStats: {
    label: string
    value: string
    percentage: number
  }[]
  weeklyProgress: {
    day: string
    value: number
    seconds: number
    questions: number
  }[]
  recentActivity: {
    id: number
    type: string
    subject: string
    topic: string
    questions: number
    score: string
    time: string
    createdAt: string
  }[]
  weakAreas: {
    subject: string
    attempts: number
    correct: number
    accuracy: number
  }[]
  upcomingGoals: {
    task: string
    completed: boolean
  }[]
}

const defaultDashboardData: DashboardData = {
  student: {
    id: 0,
    fullName: 'Student Aspirant',
    email: '',
    targetGroup: 'group4',
    createdAt: new Date().toISOString(),
  },
  metrics: {
    totalStudySeconds: 0,
    totalStudyHours: 0,
    studyHoursFormatted: '0 hrs',
    totalQuestionsSolved: 0,
    totalQuestionsAttempted: 0,
    totalAttempts: 0,
    totalCorrect: 0,
    targetQuestions: 2500,
    overallAccuracy: 0,
    currentStreak: 0,
    materialsStudied: 0,
    targetMaterials: 120,
    mockTestsCompleted: 0,
    targetMockTests: 20,
    mockAvgScore: 0,
    mockHighestScore: 0,
    overallProgress: 0,
  },
  progressStats: [
    { label: 'Materials Studied', value: '0/120', percentage: 0 },
    { label: 'Questions Attempted', value: '0/2500', percentage: 0 },
    { label: 'Mock Tests', value: '0/20', percentage: 0 },
    { label: 'Accuracy', value: '0%', percentage: 0 },
  ],
  weeklyProgress: [
    { day: 'Mon', value: 0, seconds: 0, questions: 0 },
    { day: 'Tue', value: 0, seconds: 0, questions: 0 },
    { day: 'Wed', value: 0, seconds: 0, questions: 0 },
    { day: 'Thu', value: 0, seconds: 0, questions: 0 },
    { day: 'Fri', value: 0, seconds: 0, questions: 0 },
    { day: 'Sat', value: 0, seconds: 0, questions: 0 },
    { day: 'Sun', value: 0, seconds: 0, questions: 0 },
  ],
  recentActivity: [],
  weakAreas: [],
  upcomingGoals: [
    { task: 'Attempt 25 questions in Indian Polity', completed: false },
    { task: 'Complete at least 1 Full-Length Mock Test', completed: false },
    { task: 'Study 1 Lesson Note today', completed: false },
    { task: 'Reach a 7-day Study Streak', completed: false },
  ],
}

const Dashboard = () => {
  const { student, token, isAuthenticated, logout } = useStudentAuth()

  // Track active study time automatically in real-time
  useStudyTimeTracker()

  const [data, setData] = useState<DashboardData>(defaultDashboardData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isCloudAiOpen, setIsCloudAiOpen] = useState(false)
  const [adminToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tnpsc_admin_token')
    }
    return null
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Lock background scroll when mobile sidebar drawer is open
  useScrollLock(sidebarOpen)

  // Fetch live dashboard statistics from PostgreSQL backend
  const fetchDashboardStats = useCallback(async (silent = false) => {
    if (!token) {
      return
    }

    if (!silent) setIsRefreshing(true)

    try {
      const res = await apiFetch('/api/student/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const json = await res.json()

      if (res.ok && json.status === 'success' && json.data) {
        setData(json.data)
      }
    } catch (err: any) {
      console.warn('[Dashboard] Could not fetch real-time student stats:', err.message)
    } finally {
      setIsRefreshing(false)
    }
  }, [token])

  useEffect(() => {
    fetchDashboardStats()

    // Poll live updates periodically (every 45s) while page is open
    const pollInterval = setInterval(() => {
      if (!document.hidden) {
        fetchDashboardStats(true)
      }
    }, 45_000)

    return () => clearInterval(pollInterval)
  }, [fetchDashboardStats])

  const userName = student?.fullName || data.student.fullName || 'Student'
  const userGroup =
    student?.targetGroup === 'group1'
      ? 'Group 1 Aspirant'
      : student?.targetGroup === 'group2'
        ? 'Group 2 & 2A Aspirant'
        : 'Group 4 & VAO Aspirant'

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
      meta: `${data.metrics.materialsStudied}/${data.metrics.targetMaterials} chapters`,
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
      meta: `${data.metrics.totalQuestionsSolved} solved`,
    },
    {
      title: 'Mock Tests',
      description: 'Full-length tests with real exam timing.',
      to: '/mock-tests',
      icon: GraduationCap,
      meta: `${data.metrics.mockTestsCompleted} completed`,
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

  const statIcons = [BookOpen, FileText, Trophy, Target]

  const overallProgress = data.metrics.overallProgress
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
        <div className="sidebar-avatar">{userName.charAt(0).toUpperCase()}</div>
        <div className="sidebar-profile-info">
          <span className="sidebar-profile-name">{userName}</span>
          <span className="sidebar-profile-role">{userGroup}</span>
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
          <div className="sidebar-streak-value">
            {data.metrics.currentStreak} day streak
          </div>
          <div className="sidebar-streak-text">
            {data.metrics.currentStreak > 0
              ? 'Keep the momentum going'
              : 'Complete an activity today to start your streak'}
          </div>
        </div>
      </div>

      {isAuthenticated ? (
        <button
          type="button"
          onClick={() => {
            logout()
            setSidebarOpen(false)
          }}
          className="sidebar-home"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171' }}
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      ) : (
        <Link to="/login" className="sidebar-home" onClick={() => setSidebarOpen(false)}>
          <User size={16} />
          <span>Sign In / Register</span>
        </Link>
      )}

      <Link to="/" className="sidebar-home" onClick={() => setSidebarOpen(false)}>
        <ArrowLeft size={16} />
        <span>Back to Home</span>
      </Link>
    </>
  )

  return (
    <div className="dashboard-shell">
      {/* Desktop sidebar */}
      <aside className="dashboard-sidebar glass">{sidebarContent}</aside>

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
              <p className="dash-eyebrow">Study Dashboard</p>
              <h1 className="dash-title">My Dashboard</h1>
              <p className="dash-subtitle">
                Welcome back, <span className="dash-user-highlight">{userName}</span> • Your TNPSC preparation, tracked live.
              </p>
            </div>
          </div>
          <div className="dash-header-meta">
            <DateCalendarPopover />
            <div className="dash-chip dash-chip-gold">
              <Flame size={16} />
              <span>{data.metrics.currentStreak} day streak</span>
            </div>
            <button
              type="button"
              onClick={() => fetchDashboardStats()}
              title="Refresh live metrics"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.7)',
                padding: '0.45rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RotateCcw size={15} className={isRefreshing ? 'spinning' : ''} />
            </button>
          </div>
        </motion.header>

        {/* Quick Glass Metrics Strip (Live Database Aggregates) */}
        <motion.div
          className="dash-summary-strip glass"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
        >
          <div className="dash-summary-item">
            <div className="dash-summary-icon">
              <Clock size={16} />
            </div>
            <div className="dash-summary-info">
              <span className="dash-summary-label">Total Study Time</span>
              <span className="dash-summary-val">
                {data.metrics.totalStudyHours}{' '}
                <span className="dash-summary-unit">hrs</span>
              </span>
            </div>
          </div>
          <div className="dash-summary-divider" />
          <div className="dash-summary-item">
            <div className="dash-summary-icon">
              <Zap size={16} />
            </div>
            <div className="dash-summary-info">
              <span className="dash-summary-label">Questions Solved</span>
              <span className="dash-summary-val">
                {data.metrics.totalQuestionsSolved}{' '}
                <span className="dash-summary-unit">/ {data.metrics.targetQuestions.toLocaleString()}</span>
              </span>
            </div>
          </div>
          <div className="dash-summary-divider" />
          <div className="dash-summary-item">
            <div className="dash-summary-icon">
              <Target size={16} />
            </div>
            <div className="dash-summary-info">
              <span className="dash-summary-label">Overall Accuracy</span>
              <span className="dash-summary-val">{data.metrics.overallAccuracy}%</span>
            </div>
          </div>
        </motion.div>

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
                <defs>
                  <linearGradient id="ringSunsetGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fff59d" />
                    <stop offset="50%" stopColor="#ffd700" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
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
                  stroke="url(#ringSunsetGradient)"
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
                {overallProgress > 0
                  ? `You have covered ${overallProgress}% of the target syllabus requirements. Keep up daily practice!`
                  : 'Start by studying your first textbook lesson or attempting 10 practice questions to unlock your progress ring.'}
              </p>
              <div className="overview-legend">
                <span className="legend-item">
                  <span className="legend-dot legend-dot-gold" /> Completed
                </span>
                <span className="legend-item">
                  <span className="legend-dot legend-dot-muted" /> Remaining
                </span>
              </div>
            </div>
          </motion.div>

          <div className="overview-stats">
            {data.progressStats.map((stat, index) => {
              const Icon = statIcons[index] || BookOpen
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
              <p className="dash-section-sub">Everything you need for TNPSC, one tap away.</p>
            </div>
            <span className="dash-section-tag">
              <Zap size={14} /> Live Practice Modules
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
          {/* 1. Recent Activity Panel (Database-Driven) */}
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
              <span className="panel-hint">
                {data.recentActivity.length > 0
                  ? `Last ${data.recentActivity.length} events`
                  : 'No activity yet'}
              </span>
            </div>
            <div className="activity-list">
              {data.recentActivity.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'rgba(255,255,255,0.45)' }}>
                  <Clock size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>No recent learning sessions recorded.</p>
                  <Link
                    to="/practice"
                    style={{
                      display: 'inline-block',
                      marginTop: '0.75rem',
                      color: '#ffd700',
                      fontSize: '0.82rem',
                      textDecoration: 'none',
                    }}
                  >
                    Start MCQ Practice →
                  </Link>
                </div>
              ) : (
                data.recentActivity.map((activity) => (
                  <div key={activity.id} className="activity-item">
                    <span className="activity-dot" />
                    <div className="activity-content">
                      <div className="activity-main">
                        <span className="activity-subject">{activity.subject}</span>
                        <span className="activity-sep">•</span>
                        <span className="activity-topic">{activity.topic}</span>
                      </div>
                      <div className="activity-details">
                        <span>{activity.questions} question{activity.questions !== 1 ? 's' : ''}</span>
                        <span className="activity-sep">•</span>
                        <span
                          className="activity-score"
                          style={{
                            color:
                              activity.score.toLowerCase().includes('correct') ||
                              activity.score.toLowerCase().includes('completed')
                                ? '#4ade80'
                                : activity.score.toLowerCase().includes('incorrect')
                                  ? '#f87171'
                                  : '#ffd700',
                          }}
                        >
                          {activity.score}
                        </span>
                        <span className="activity-sep">•</span>
                        <span>{activity.time}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.section>

          {/* 2. Weekly Study Chart Panel (Database-Driven Mon-Sun) */}
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
              <span className="panel-hint">45 min daily goal</span>
            </div>
            <div className="weekly-chart">
              {data.weeklyProgress.map((day, index) => (
                <div key={`${day.day}_${index}`} className="chart-bar-container">
                  <span className="chart-value">{day.value}%</span>
                  <motion.div
                    className="chart-bar"
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(4, day.value)}%` }}
                    transition={{ duration: 0.8, delay: 0.3 + index * 0.05 }}
                    style={{
                      background:
                        day.value >= 100
                          ? 'linear-gradient(to top, #10b981, #34d399)'
                          : day.value > 0
                            ? 'linear-gradient(to top, #d97706, #ffd700)'
                            : 'rgba(255, 255, 255, 0.08)',
                    }}
                  />
                  <span className="chart-label">{day.day}</span>
                </div>
              ))}
            </div>
          </motion.section>

          {/* 3. Today's Goals Panel (Dynamic based on live milestones) */}
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
              <span className="panel-hint">
                {data.upcomingGoals.filter((g) => g.completed).length} of{' '}
                {data.upcomingGoals.length} done
              </span>
            </div>
            <div className="goals-list">
              {data.upcomingGoals.map((goal, index) => (
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

        {/* 4. Weak Areas Panel (When Student has topics with < 75% accuracy) */}
        {data.weakAreas && data.weakAreas.length > 0 && (
          <motion.section
            className="glass"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            style={{
              marginTop: '1.5rem',
              padding: '1.25rem 1.5rem',
              borderRadius: '16px',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.06), rgba(15, 23, 42, 0.8))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <AlertTriangle size={20} style={{ color: '#f87171' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#ffffff', fontWeight: 600 }}>
                  Recommended Focus Areas (Weak Accuracy)
                </h3>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                Based on your question attempts
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              {data.weakAreas.map((area) => (
                <div
                  key={area.subject}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '0.9rem 1rem',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#fca5a5', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    {area.subject}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.6)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Accuracy: <strong style={{ color: '#ffffff' }}>{area.accuracy}%</strong></span>
                    <span>{area.correct}/{area.attempts} correct</span>
                  </div>
                  <Link
                    to={`/practice?subject=${encodeURIComponent(area.subject)}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      marginTop: '0.65rem',
                      fontSize: '0.76rem',
                      color: '#ffd700',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    <span>Practice Questions</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </div>

      {/* Claude AI Study Notes & MCQ Generator Modal */}
      <CloudAiGeneratorModal
        isOpen={isCloudAiOpen}
        onClose={() => setIsCloudAiOpen(false)}
        token={adminToken}
        initialMode="notes"
      />
    </div>
  )
}

function ArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

export default Dashboard
