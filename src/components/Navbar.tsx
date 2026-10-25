import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, GraduationCap, Home, BookOpen, FileText, BarChart3, User, UserPlus } from 'lucide-react'
import MobileAuthSlide, { type AuthSlideType } from './MobileAuthSlide'
import './Navbar.css'

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [activeAuthSlide, setActiveAuthSlide] = useState<AuthSlideType>('none')
  const location = useLocation()

  const navLinks = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { path: '/materials', label: 'Study Materials', icon: BookOpen },
    { path: '/practice', label: 'MCQ Practice', icon: FileText },
    { path: '/mock-tests', label: 'Mock Tests', icon: GraduationCap },
    { path: '/previous-papers', label: 'Previous Papers', icon: FileText },
  ]

  const closeMenu = () => {
    setIsOpen(false)
    setActiveAuthSlide('none')
  }

  const [prevPath, setPrevPath] = useState(location.pathname)
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname)
    setIsOpen(false)
    setActiveAuthSlide('none')
  }

  // Close auth slide when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setActiveAuthSlide('none')
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleLoginClick = (e: React.MouseEvent) => {
    if (window.innerWidth <= 768) {
      e.preventDefault()
      setIsOpen(false)
      setActiveAuthSlide((prev) => (prev === 'login' ? 'none' : 'login'))
    } else {
      closeMenu()
    }
  }

  const handleRegisterClick = (e: React.MouseEvent) => {
    if (window.innerWidth <= 768) {
      e.preventDefault()
      setIsOpen(false)
      setActiveAuthSlide((prev) => (prev === 'register' ? 'none' : 'register'))
    } else {
      closeMenu()
    }
  }

  const handleToggleMenu = () => {
    setIsOpen((prev) => !prev)
    setActiveAuthSlide('none')
  }

  return (
    <nav className="navbar glass">
      <div className="nav-container">
        <Link to="/" className="nav-logo" aria-label="TNPSC Study Hub home" onClick={closeMenu}>
          <GraduationCap className="nav-logo-icon" size={32} />
          <span className="nav-logo-text">TNPSC Study Hub</span>
          <span className="nav-logo-short">TNPSC</span>
        </Link>

        <ul id="primary-navigation" className={`nav-menu ${isOpen ? 'active' : ''}`}>
          {navLinks.map((link) => {
            const Icon = link.icon
            const isActive = location.pathname === link.path
            return (
              <li key={link.path} className="nav-item">
                <Link
                  to={link.path}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                  onClick={closeMenu}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={18} />
                  <span>{link.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="nav-actions">
          <Link
            to="/login"
            className={`nav-auth-btn nav-login ${activeAuthSlide === 'login' ? 'active-toggle' : ''}`}
            onClick={handleLoginClick}
            aria-expanded={activeAuthSlide === 'login'}
            aria-label="Toggle login slide"
          >
            <User size={18} />
            <span className="nav-auth-label">Login</span>
          </Link>
          <Link
            to="/register"
            className={`nav-auth-btn nav-register ${activeAuthSlide === 'register' ? 'active-toggle' : ''}`}
            onClick={handleRegisterClick}
            aria-expanded={activeAuthSlide === 'register'}
            aria-label="Toggle register slide"
          >
            <UserPlus size={18} />
            <span>Register</span>
          </Link>
          <button
            type="button"
            className={`nav-toggle ${isOpen ? 'active' : ''}`}
            onClick={handleToggleMenu}
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isOpen}
            aria-controls="primary-navigation"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Login and Register Slide Drawer */}
      <MobileAuthSlide
        activeSlide={activeAuthSlide}
        onClose={() => setActiveAuthSlide('none')}
        onSwitchToLogin={() => setActiveAuthSlide('login')}
        onSwitchToRegister={() => setActiveAuthSlide('register')}
      />
    </nav>
  )
}

export default Navbar
