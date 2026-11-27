import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, GraduationCap, Home, BookOpen, FileText, BarChart3, User, UserPlus, LogOut } from 'lucide-react'
import MobileAuthSlide, { type AuthSlideType } from './MobileAuthSlide'
import { useScrollLock } from '../hooks/useScrollLock'
import { useStudentAuth } from '../context/StudentAuthContext'
import { StudentAvatar } from './StudentAvatar'
import { resolveStudentDisplayName } from '../utils/studentProfile'
import './Navbar.css'

const Navbar = () => {
  const { student, isAuthenticated, isPreviewMode, exitStudentPreview } = useStudentAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [activeAuthSlide, setActiveAuthSlide] = useState<AuthSlideType>('none')
  const location = useLocation()
  const isAdminRoute = location.pathname === '/admin' || location.pathname.startsWith('/admin/')

  // Lock background scroll when mobile hamburger navigation menu is open
  useScrollLock(isOpen)

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

  // Ensure auth slide closes if resized to PC / desktop view
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
    // Only use slide toggle on mobile view (<= 768px)
    // On PC / laptop browser, navigate normally to /login
    if (window.innerWidth <= 768) {
      e.preventDefault()
      setIsOpen(false)
      setActiveAuthSlide((prev) => (prev === 'login' ? 'none' : 'login'))
    } else {
      closeMenu()
    }
  }

  const handleRegisterClick = (e: React.MouseEvent) => {
    // Only use slide toggle on mobile view (<= 768px)
    // On PC / laptop browser, navigate normally to /register
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

  const isNavLinkActive = (targetPath: string): boolean => {
    const p = location.pathname.toLowerCase()
    if (targetPath === '/') {
      return p === '/' || p === ''
    }
    if (targetPath === '/dashboard') {
      return (
        p === '/dashboard' ||
        p.startsWith('/dashboard/') ||
        p.startsWith('/performance-analytics') ||
        p.startsWith('/mark-list') ||
        p.startsWith('/progress-tracker')
      )
    }
    if (targetPath === '/materials') {
      return (
        (p.startsWith('/materials') && !p.startsWith('/materials/practice')) ||
        p.startsWith('/school-materials') ||
        p.startsWith('/study-notes') ||
        p.startsWith('/study-materials')
      )
    }
    if (targetPath === '/practice') {
      return p.startsWith('/practice') || p.startsWith('/materials/practice')
    }
    return p === targetPath || p.startsWith(`${targetPath}/`)
  }

  return (
    <nav className="navbar glass">
      <div className="nav-container">
        <Link to="/" className="nav-logo" aria-label="TNPSC Study Hub home" onClick={closeMenu}>
          <span className="nav-logo-icon-3d">
            <GraduationCap className="nav-logo-icon" size={24} />
          </span>
          <span className="nav-logo-text-group">
            <span className="nav-logo-text">TNPSC Study Hub</span>
            <span className="nav-logo-short">TNPSC</span>
          </span>
        </Link>

        <ul id="primary-navigation" className={`nav-menu ${isOpen ? 'active' : ''}`}>
          {navLinks.map((link) => {
            const Icon = link.icon
            const isActive = isNavLinkActive(link.path)
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
          {/* Preview Exit Button (Only visible when owner is actively previewing a student view) */}
          {isPreviewMode ? (
            <button
              type="button"
              className="nav-auth-btn"
              onClick={() => {
                exitStudentPreview()
                closeMenu()
              }}
              title="Exit Student Preview and return to Admin Dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'linear-gradient(135deg, #f59e0b 0%, #ffd700 100%)',
                color: '#0f172a',
                border: 'none',
                fontWeight: 700,
                padding: '0.35rem 0.85rem',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <LogOut size={15} />
              <span className="nav-auth-label">Exit Preview</span>
            </button>
          ) : null}

          {!isAdminRoute && (
            isAuthenticated && student ? (
              <div className="nav-student-account-group">
                <Link
                  to="/dashboard"
                  className="nav-student-profile-pill"
                  title={`Student Profile: ${resolveStudentDisplayName(student)} (${student.email})`}
                  onClick={closeMenu}
                >
                  <StudentAvatar
                    studentId={student.id}
                    fullName={student.fullName}
                    email={student.email}
                    avatarUrl={student.avatarUrl}
                    size={26}
                  />
                  <span className="nav-auth-label nav-student-profile-name">
                    {resolveStudentDisplayName(student)}
                  </span>
                </Link>
              </div>
            ) : (
              <>
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
              </>
            )
          )}

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

      {/* Mobile Login and Register Slide Drawer (Student Website Only) */}
      {!isAdminRoute && (
        <MobileAuthSlide
          activeSlide={activeAuthSlide}
          onClose={() => setActiveAuthSlide('none')}
          onSwitchToLogin={() => setActiveAuthSlide('login')}
          onSwitchToRegister={() => setActiveAuthSlide('register')}
        />
      )}
    </nav>
  )
}

export default Navbar
