import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
  Zap,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Award,
  Sparkles
} from 'lucide-react'
import './Home.css'

const Home = () => {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const heroSlides = [
    {
      id: 'overview',
      tag: 'Curated Syllabus',
      title: 'All TNPSC Categories',
      description: 'Comprehensive study materials, notes & lesson-wise practice for all group examinations.',
      icon: GraduationCap,
      type: 'badges' as const,
      badges: [
        { label: 'TNPSC Group 1', to: '/materials?group=group1' },
        { label: 'TNPSC Group 2 & 2A', to: '/materials?group=group2_2a' },
        { label: 'TNPSC Group 4', to: '/materials?group=group4_vao' },
      ],
    },
    {
      id: 'group1',
      tag: 'Degree Standard • Code 497',
      title: 'TNPSC Group 1 Prelims',
      description: 'Deputy Collector, DSP & District Officer ranks with 175 General Studies questions across 6 core units.',
      icon: Landmark,
      type: 'actions' as const,
      actions: [
        { label: 'Syllabus & Notes', to: '/materials/group1/general-studies', primary: true },
        { label: 'Practice MCQs', to: '/practice?group=group1', primary: false },
      ],
    },
    {
      id: 'group2',
      tag: 'Interview & Non-Interview',
      title: 'TNPSC Group 2 & 2A',
      description: 'Sub-Registrar & Municipal Commissioner services with General Studies, Tamil & English language coverage.',
      icon: Trophy,
      type: 'actions' as const,
      actions: [
        { label: 'Group 2 Subjects', to: '/materials?group=group2_2a', primary: true },
        { label: 'Mock Test Simulator', to: '/mock-tests', primary: false },
      ],
    },
    {
      id: 'group4',
      tag: 'SSLC Standard • 10th Std',
      title: 'TNPSC Group 4 & VAO',
      description: 'Village Administrative Officer & Junior Assistant vacancies mapped directly to Samacheer Kalvi textbooks.',
      icon: Award,
      type: 'actions' as const,
      actions: [
        { label: 'Group 4 Hub', to: '/materials?group=group4_vao', primary: true },
        { label: 'School Materials', to: '/school-materials', primary: false },
      ],
    },
  ]

  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
    }, 4500)
    return () => clearInterval(timer)
  }, [isPaused, heroSlides.length])

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)

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
              <Link to="/practice" className="btn btn-primary hero-btn-practice">
                <Target size={20} />
                <span>Start Practice</span>
                <ArrowRight size={20} className="hero-btn-arrow" />
              </Link>
              <Link to="/materials" className="btn btn-secondary hero-btn-materials">
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
            <div 
              className="hero-card hero-slides-container glass"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* Carousel Header Controls */}
              <div className="hero-carousel-header">
                <div className="hero-slide-counter">
                  <span className="hero-slide-counter-dot" />
                  <span>0{currentSlide + 1} / 0{heroSlides.length}</span>
                </div>
                <div className="hero-carousel-controls">
                  <button 
                    type="button" 
                    className="hero-carousel-nav-btn" 
                    onClick={prevSlide}
                    aria-label="Previous Slide"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    type="button" 
                    className="hero-carousel-nav-btn" 
                    onClick={nextSlide}
                    aria-label="Next Slide"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Carousel Animated Slide Content */}
              <div className="hero-slide-viewport">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide}
                    className="hero-slide-stage"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="hero-card-icon-wrap">
                      {(() => {
                        const Icon = heroSlides[currentSlide].icon
                        return <Icon size={38} className="hero-card-icon" />
                      })()}
                    </div>

                    <span className="hero-slide-tag">
                      <Sparkles size={12} />
                      {heroSlides[currentSlide].tag}
                    </span>

                    <h3 className="hero-slide-title">{heroSlides[currentSlide].title}</h3>
                    <p className="hero-slide-desc">{heroSlides[currentSlide].description}</p>

                    {heroSlides[currentSlide].type === 'badges' && (
                      <div className="hero-category-badges">
                        {heroSlides[currentSlide].badges.map((badge, idx) => (
                          <Link key={idx} to={badge.to} className="hero-category-badge">
                            {badge.label}
                          </Link>
                        ))}
                      </div>
                    )}

                    {heroSlides[currentSlide].type === 'actions' && (
                      <div className="hero-slide-action-row">
                        {heroSlides[currentSlide].actions.map((act, idx) => (
                          <Link 
                            key={idx} 
                            to={act.to} 
                            className={`hero-slide-action-btn ${act.primary ? 'primary' : 'secondary'}`}
                          >
                            <span>{act.label}</span>
                            <ArrowRight size={14} />
                          </Link>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Carousel Pagination Dots */}
              <div className="hero-carousel-dots" role="tablist" aria-label="Slide Selection">
                {heroSlides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    type="button"
                    role="tab"
                    aria-selected={idx === currentSlide}
                    className={`hero-slide-dot ${idx === currentSlide ? 'active' : ''}`}
                    onClick={() => setCurrentSlide(idx)}
                    aria-label={`Go to slide ${idx + 1}: ${slide.title}`}
                  />
                ))}
              </div>
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
            className="cta-card glass"
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
