import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, GraduationCap, Home, BookOpen, FileText, BarChart3, User } from 'lucide-react'
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

  return (
    <nav className="navbar glass">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <GraduationCap className="nav-logo-icon" size={32} />
          <span className="nav-logo-text">TNPSC Study Hub</span>
        </Link>

        <button className="nav-toggle" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <ul className={`nav-menu ${isOpen ? 'active' : ''}`}>
          {navLinks.map((link) => {
            const Icon = link.icon
            return (
              <li key={link.path} className="nav-item">
                <Link
                  to={link.path}
                  className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon size={18} />
                  <span>{link.label}</span>
                </Link>
              </li>
            )
          })}
          <li className="nav-item nav-auth">
            <Link to="/login" className="nav-auth-btn nav-login" onClick={() => setIsOpen(false)}>
              <User size={18} />
              <span>Login</span>
            </Link>
            <Link to="/register" className="nav-auth-btn nav-register" onClick={() => setIsOpen(false)}>
              <span>Register</span>
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  )
}

export default Navbar
