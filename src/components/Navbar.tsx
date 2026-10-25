import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, GraduationCap, Home, BookOpen, FileText, BarChart3, User, UserPlus } from 'lucide-react'
import './Navbar.css'

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()

  const navLinks = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { path: '/materials', label: 'Study Materials', icon: BookOpen },
    { path: '/practice', label: 'MCQ Practice', icon: FileText },
    { path: '/mock-tests', label: 'Mock Tests', icon: GraduationCap },
    { path: '/previous-papers', label: 'Previous Papers', icon: FileText },
  ]

  const closeMenu = () => setIsOpen(false)

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
          <Link to="/login" className="nav-auth-btn nav-login" onClick={closeMenu}>
            <User size={18} />
            <span className="nav-auth-label">Login</span>
          </Link>
          <Link to="/register" className="nav-auth-btn nav-register" onClick={closeMenu}>
            <UserPlus size={18} />
            <span>Register</span>
          </Link>
          <button
            type="button"
            className={`nav-toggle ${isOpen ? 'active' : ''}`}
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isOpen}
            aria-controls="primary-navigation"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
