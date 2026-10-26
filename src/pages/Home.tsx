import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  BookOpen, 
  FileText, 
  BarChart3, 
  Trophy, 
  Clock, 
  Users, 
  ArrowRight,
  GraduationCap,
  Target,
  Zap
} from 'lucide-react'
import './Home.css'

const Home = () => {
  const features = [
    {
      icon: BookOpen,
      title: 'Study Materials',
      description: 'Comprehensive lesson-wise materials for all TNPSC Group Exams'
    },
    {
      icon: FileText,
      title: 'MCQ Practice',
      description: 'Practice with topic-wise MCQs with detailed explanations'
    },
    {
      icon: BarChart3,
      title: 'Progress Tracker',
      description: 'Track your performance and identify areas for improvement'
    },
    {
      icon: Trophy,
      title: 'Mock Tests',
      description: 'Full-length mock tests simulating real exam environment'
    }
  ]

  const stats = [
    { icon: Users, value: '10K+', label: 'Students' },
    { icon: FileText, value: '50K+', label: 'Questions' },
    { icon: Trophy, value: '95%', label: 'Success Rate' },
    { icon: Clock, value: '24/7', label: 'Access' }
  ]

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-background">
          <div className="hero-gradient"></div>
          <div className="hero-pattern"></div>
        </div>
        
        <div className="hero-container">
          <motion.div 
            className="hero-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="hero-badge">
              <Zap size={16} />
              <span>Premium TNPSC Preparation Platform</span>
            </div>
            
            <h1 className="hero-title">
              <span className="hero-title-line">TNPSC Group Exams</span>
              <span className="hero-title-line gradient-text">Study Hub</span>
            </h1>
            
            <p className="hero-subtitle">
              Master Tamil Nadu Public Service Commission exams with our comprehensive platform. 
              Practice, learn, and excel with premium study materials, mock tests, and smart analytics.
            </p>
            
            <div className="hero-actions">
              <Link to="/practice" className="btn btn-primary">
                <Target size={20} />
                <span>Start Practice</span>
                <ArrowRight size={20} />
              </Link>
              <Link to="/materials" className="btn btn-secondary">
                <BookOpen size={20} />
                <span>Study Materials</span>
              </Link>
            </div>
          </motion.div>
          
          <motion.div 
            className="hero-visual"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="hero-card glass animate-float">
              <GraduationCap size={60} className="hero-card-icon" />
              <h3>All TNPSC Categories</h3>
              <p>Group 1 • Group 2 & 2A • Group 4 & VAO</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats">
        <div className="stats-container">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={index}
                className="stat-card glass"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Icon className="stat-icon" size={32} />
                <div className="stat-info">
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="features-container">
          <motion.div 
            className="section-header"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="section-title">
              Why Choose <span className="gradient-text">TNPSC Study Hub</span>
            </h2>
            <p className="section-subtitle">
              Everything you need to crack TNPSC exams in one place
            </p>
          </motion.div>
          
          <div className="features-grid">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={index}
                  className="feature-card glass"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.02, y: -5 }}
                >
                  <div className="feature-icon-wrapper">
                    <Icon className="feature-icon" size={28} />
                  </div>
                  <h3 className="feature-title">{feature.title}</h3>
                  <p className="feature-description">{feature.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="cta-container">
          <motion.div 
            className="cta-card glass animate-glow"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="cta-title">Ready to Start Your TNPSC Journey?</h2>
            <p className="cta-subtitle">
              Join thousands of successful candidates and take your first step towards a government career
            </p>
            <Link to="/dashboard" className="btn btn-primary btn-large">
              <BarChart3 size={24} />
              <span>Go to Dashboard</span>
              <ArrowRight size={24} />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default Home
