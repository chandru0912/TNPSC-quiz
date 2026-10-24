import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  BarChart3, 
  BookOpen, 
  Trophy, 
  Clock, 
  Target, 
  TrendingUp,
  Calendar,
  Award,
  CheckCircle2,
  Circle,
  FileText
} from 'lucide-react'
import './Dashboard.css'

const Dashboard = () => {
  const [userName] = useState('Student')

  const progressStats = [
    { icon: BookOpen, label: 'Materials Studied', value: '45/120', percentage: 37.5, color: '#3b82f6' },
    { icon: FileText, label: 'Questions Attempted', value: '892/2500', percentage: 35.7, color: '#10b981' },
    { icon: Trophy, label: 'Mock Tests', value: '8/20', percentage: 40, color: '#ffd700' },
    { icon: Target, label: 'Accuracy', value: '78%', percentage: 78, color: '#f59e0b' },
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

  return (
    <div className="dashboard">
      <div className="dashboard-container">
        {/* Header */}
        <motion.div 
          className="dashboard-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="dashboard-header-content">
            <h1 className="dashboard-title">
              Welcome back, <span className="gradient-text">{userName}</span>!
            </h1>
            <p className="dashboard-subtitle">
              Track your TNPSC preparation progress and stay on top of your goals
            </p>
          </div>
          <div className="dashboard-date">
            <Calendar size={18} />
            <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </motion.div>

        {/* Progress Stats */}
        <div className="progress-grid">
          {progressStats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={index}
                className="progress-card glass"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="progress-card-header">
                  <div className="progress-icon-wrapper" style={{ background: `${stat.color}20`, borderColor: `${stat.color}40` }}>
                    <Icon size={24} style={{ color: stat.color }} />
                  </div>
                  <div className="progress-info">
                    <div className="progress-label">{stat.label}</div>
                    <div className="progress-value">{stat.value}</div>
                  </div>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-bg">
                    <motion.div 
                      className="progress-bar-fill"
                      style={{ background: stat.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.percentage}%` }}
                      transition={{ duration: 1, delay: index * 0.1 + 0.3 }}
                    />
                  </div>
                  <span className="progress-percentage">{stat.percentage}%</span>
                </div>
              </motion.div>
            )
          })}
        </div>

        <div className="dashboard-main-grid">
          {/* Recent Activity */}
          <motion.div 
            className="dashboard-section glass"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="section-header-row">
              <div className="section-title-group">
                <Clock size={24} className="section-icon" />
                <h2 className="section-title">Recent Activity</h2>
              </div>
              <TrendingUp size={20} className="trending-icon" />
            </div>
            <div className="activity-list">
              {recentActivity.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-dot"></div>
                  <div className="activity-content">
                    <div className="activity-main">
                      <span className="activity-subject">{activity.subject}</span>
                      <span className="activity-separator">•</span>
                      <span className="activity-topic">{activity.topic}</span>
                    </div>
                    <div className="activity-details">
                      <span>{activity.questions} questions</span>
                      <span className="activity-separator">•</span>
                      <span className="activity-score">{activity.score}</span>
                      <span className="activity-separator">•</span>
                      <span className="activity-time">{activity.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Weekly Progress Chart */}
          <motion.div 
            className="dashboard-section glass"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <div className="section-header-row">
              <div className="section-title-group">
                <BarChart3 size={24} className="section-icon" />
                <h2 className="section-title">Weekly Study Hours</h2>
              </div>
            </div>
            <div className="weekly-chart">
              {weeklyProgress.map((day, index) => (
                <div key={index} className="chart-bar-container">
                  <motion.div 
                    className="chart-bar"
                    initial={{ height: 0 }}
                    animate={{ height: `${day.value}%` }}
                    transition={{ duration: 0.8, delay: 0.6 + index * 0.05 }}
                  />
                  <span className="chart-label">{day.day}</span>
                  <span className="chart-value">{day.value}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Goals Section */}
        <motion.div 
          className="dashboard-section goals-section glass"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <div className="section-header-row">
            <div className="section-title-group">
              <Award size={24} className="section-icon" />
              <h2 className="section-title">Today's Goals</h2>
            </div>
          </div>
          <div className="goals-list">
            {upcomingGoals.map((goal, index) => (
              <div key={index} className={`goal-item ${goal.completed ? 'completed' : ''}`}>
                {goal.completed ? (
                  <CheckCircle2 size={22} className="goal-icon completed" />
                ) : (
                  <Circle size={22} className="goal-icon" />
                )}
                <span className="goal-text">{goal.task}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default Dashboard
