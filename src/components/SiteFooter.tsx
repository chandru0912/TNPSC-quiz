import React from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  ClipboardCheck,
  FileText,
  Languages,
  Layers,
  ShieldCheck,
  Target,
} from 'lucide-react'
import OrbitBrandLogo from './OrbitBrandLogo'
import './SiteFooter.css'

const STANDARDS = [6, 7, 8, 9, 10, 11, 12] as const

const EXAM_FOCUS_LINKS = [
  { label: 'TNPSC Group 1', to: '/materials?group=group1' },
  { label: 'TNPSC Group 2 & 2A', to: '/materials?group=group2_2a' },
  { label: 'TNPSC Group 4', to: '/materials?group=group4_vao' },
]

const MCQ_PROVIDER_LINKS = [
  { label: 'Lesson-wise MCQs', to: '/practice' },
  { label: 'Unit-wise MCQs', to: '/mock-tests?category=unit_wise' },
  { label: 'Full-Length MCQ Tests', to: '/mock-tests?category=full_length' },
]

const TESTS_LINKS = [
  { label: 'Mock Tests', to: '/mock-tests' },
  { label: 'Previous Year Paper Tests', to: '/previous-papers' },
  { label: 'MCQ Practice Tests', to: '/practice' },
]

const TEST_SERIES_LINKS = [
  { label: 'Full-Length Mock Test Series', to: '/mock-tests?category=full_length' },
  { label: 'Online Test Series', to: '/mock-tests' },
  { label: 'Group 1 Test Series', to: '/mock-tests?group=group1&category=full_length' },
  { label: 'Group 2 & 2A Test Series', to: '/mock-tests?group=group2_2a&category=full_length' },
  { label: 'Group 4 Test Series', to: '/mock-tests?group=group4&category=full_length' },
  { label: 'Subject-wise Test Series', to: '/mock-tests?category=unit_wise' },
]

export const SiteFooter: React.FC = () => {
  return (
    <footer className="site-footer glass" role="contentinfo">
      <div className="site-footer-inner">
        {/* Brand Identity Row */}
        <div className="site-footer-brand-bar">
          <Link to="/" className="footer-brand" aria-label="TNPSC Aspirant Orbit Home">
            <span className="footer-logo-icon-3d">
              <OrbitBrandLogo className="footer-logo-icon" size={24} />
            </span>
            <span className="footer-logo">TNPSC Aspirant Orbit</span>
          </Link>
        </div>

        {/* Multi-Column Navigation Grid (Desktop) / Continuous Vertical List (Mobile) */}
        <div className="site-footer-grid">
          {/* 1. EXAM FOCUS */}
          <div className="site-footer-col">
            <h3 className="site-footer-col-title">
              <Target size={14} className="site-footer-col-icon" />
              <span>Exam Focus</span>
            </h3>
            <ul className="site-footer-list">
              {EXAM_FOCUS_LINKS.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="site-footer-link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 2. MCQ PROVIDER */}
          <div className="site-footer-col">
            <h3 className="site-footer-col-title">
              <FileText size={14} className="site-footer-col-icon" />
              <span>MCQ Provider</span>
            </h3>
            <ul className="site-footer-list">
              {MCQ_PROVIDER_LINKS.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="site-footer-link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. TESTS */}
          <div className="site-footer-col">
            <h3 className="site-footer-col-title">
              <ClipboardCheck size={14} className="site-footer-col-icon" />
              <span>Tests</span>
            </h3>
            <ul className="site-footer-list">
              {TESTS_LINKS.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="site-footer-link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 4. MEDIUM */}
          <div className="site-footer-col">
            <h3 className="site-footer-col-title">
              <Languages size={14} className="site-footer-col-icon" />
              <span>Medium</span>
            </h3>
            <ul className="site-footer-list">
              <li>
                <Link to="/school-materials?medium=Tamil" className="site-footer-link">
                  Tamil Medium
                </Link>
              </li>
              <li>
                <Link to="/school-materials?medium=English" className="site-footer-link">
                  English Medium
                </Link>
              </li>
            </ul>
          </div>

          {/* 5. BOOKS (6th–12th Standard) */}
          <div className="site-footer-col">
            <h3 className="site-footer-col-title">
              <BookOpen size={14} className="site-footer-col-icon" />
              <span>Books</span>
            </h3>
            <ul className="site-footer-list">
              {STANDARDS.map((std) => (
                <li key={std}>
                  <Link to={`/school-materials?standard=${std}`} className="site-footer-link">
                    {std}th Standard
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 6. TEST SERIES */}
          <div className="site-footer-col">
            <h3 className="site-footer-col-title">
              <Layers size={14} className="site-footer-col-icon" />
              <span>Test Series</span>
            </h3>
            <ul className="site-footer-list">
              {TEST_SERIES_LINKS.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="site-footer-link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 7. ABOUT US & LEGAL */}
          <div className="site-footer-col">
            <h3 className="site-footer-col-title">
              <ShieldCheck size={14} className="site-footer-col-icon" />
              <span>About Us &amp; Legal</span>
            </h3>
            <div className="site-footer-list site-footer-legal-groups">
              <div className="site-footer-subgroup">
                <span className="site-footer-subheading">About Us</span>
                <Link to="/about-us" className="site-footer-link">
                  About Us
                </Link>
              </div>
              <div className="site-footer-subgroup">
                <span className="site-footer-subheading">Legal</span>
                <Link to="/user-policy" className="site-footer-link">
                  User Policy
                </Link>
                <Link to="/terms-of-service" className="site-footer-link">
                  Terms of Service
                </Link>
                <Link to="/privacy-policy" className="site-footer-link">
                  Privacy Policy
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright Row */}
        <div className="site-footer-bottom">
          <p className="site-footer-copy">© 2026 TNPSC Aspirant Orbit. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
