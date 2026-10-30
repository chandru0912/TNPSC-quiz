import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import ScrollToTop from './components/ScrollToTop'
import Navbar from './components/Navbar'
import { initSpatialTilt } from './utils/spatialTilt'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import StudyMaterials from './pages/StudyMaterials'
import SchoolMaterials from './pages/SchoolMaterials'
import Group1GeneralStudies from './pages/Group1GeneralStudies'
import Group1UnitDetail from './pages/Group1UnitDetail'
import Group1Lessons from './pages/Group1Lessons'
import Group1Aptitude from './pages/Group1Aptitude'
import Group1UnitClass from './pages/Group1UnitClass'
import Group2SubjectDetail from './pages/Group2SubjectDetail'
import Group2UnitDetail from './pages/Group2UnitDetail'
import Group2Lessons from './pages/Group2Lessons'
import Group2UnitClass from './pages/Group2UnitClass'
import Group4SubjectDetail from './pages/Group4SubjectDetail'
import Group4UnitDetail from './pages/Group4UnitDetail'
import Group4Lessons from './pages/Group4Lessons'
import Group4UnitClass from './pages/Group4UnitClass'
import MCQPractice from './pages/MCQPractice'
import StudyMaterialsPractice from './pages/StudyMaterialsPractice'
import StudyNotesPage from './pages/StudyNotesPage'
import MockTests from './pages/MockTests'
import PreviousPapers from './pages/PreviousPapers'
import Login from './pages/Login'
import Register from './pages/Register'
import Admin from './pages/Admin'
import { LanguageProvider } from './context/LanguageContext'
import './App.css'

function App() {
  // Initialize interactive 3D spatial tilt & dynamic glare tracking across all website logos
  useEffect(() => {
    const destroyTilt = initSpatialTilt()
    return () => {
      destroyTilt()
    }
  }, [])

  return (
    <Router>
      <LanguageProvider>
        <ScrollToTop />
        <div className="app">
        {/* Global SVG Definitions for 3D Volumetric Extrusion, Bevel & Gold Gradient */}
        <svg
          className="spatial-svg-defs"
          aria-hidden="true"
          style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
        >
          <defs>
            {/* Luminous Gold Linear Gradient for SVG strokes */}
            <linearGradient id="spatial-gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="25%" stopColor="#fff59d" />
              <stop offset="55%" stopColor="#ffd700" />
              <stop offset="85%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>

            {/* 3D Extruded Bevel & Volumetric Directional Lighting */}
            <filter id="spatial-extruded-3d" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1" stdDeviation="0.6" floodColor="#000000" floodOpacity="0.85" result="drop1" />
              <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#000000" floodOpacity="0.6" result="drop2" />
              <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#000000" floodOpacity="0.45" result="drop3" />
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ffd700" floodOpacity="0.35" result="glow" />
              <feGaussianBlur in="SourceAlpha" stdDeviation="0.9" result="blur" />
              <feSpecularLighting
                in="blur"
                surfaceScale="2.8"
                specularConstant="1.2"
                specularExponent="20"
                lightingColor="#ffffff"
                result="specular"
              >
                <fePointLight x="-25" y="-45" z="70" />
              </feSpecularLighting>
              <feComposite in="specular" in2="SourceAlpha" operator="in" result="specularCut" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="drop3" />
                <feMergeNode in="drop2" />
                <feMergeNode in="drop1" />
                <feMergeNode in="SourceGraphic" />
                <feMergeNode in="specularCut" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* Ambient Glassmorphic Background Orbs & Mesh */}
        <div className="ambient-glass-backdrop" aria-hidden="true">
          <div className="ambient-orb orb-warm-lamp" />
          <div className="ambient-orb orb-gold" />
          <div className="ambient-orb orb-indigo" />
          <div className="ambient-orb orb-cyan" />
          <div className="ambient-grid-mesh" />
        </div>

        <Navbar />

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/materials" element={<StudyMaterials />} />
            <Route path="/materials/group1/general-studies" element={<Group1GeneralStudies />} />
            <Route path="/materials/group1/unit/:unitId" element={<Group1UnitDetail />} />
            <Route path="/materials/group1/unit/:unitId/lessons" element={<Group1Lessons />} />
            <Route path="/materials/group1/unit/:unitId/class/:classId" element={<Group1UnitClass />} />
            <Route path="/materials/group1/class/:classId" element={<Group1UnitClass />} />
            <Route path="/materials/group1/aptitude" element={<Group1Aptitude />} />
            <Route path="/materials/group2/:subjectId" element={<Group2SubjectDetail />} />
            <Route path="/materials/group2/:subjectId/unit/:unitId" element={<Group2UnitDetail />} />
            <Route path="/materials/group2/:subjectId/unit/:unitId/lessons" element={<Group2Lessons />} />
            <Route path="/materials/group2/:subjectId/unit/:unitId/class/:classId" element={<Group2UnitClass />} />
            <Route path="/materials/group2/:subjectId/class/:classId" element={<Group2UnitClass />} />
            <Route path="/materials/group4/:subjectId" element={<Group4SubjectDetail />} />
            <Route path="/materials/group4/:subjectId/unit/:unitId" element={<Group4UnitDetail />} />
            <Route path="/materials/group4/:subjectId/unit/:unitId/lessons" element={<Group4Lessons />} />
            <Route path="/materials/group4/:subjectId/unit/:unitId/class/:classId" element={<Group4UnitClass />} />
            <Route path="/materials/group4/:subjectId/class/:classId" element={<Group4UnitClass />} />
            <Route path="/study-notes/:group/:unitId/lesson/:lessonTitle" element={<StudyNotesPage />} />
            <Route path="/study-notes/:group/subject/:subjectId/unit/:unitId/lesson/:lessonTitle" element={<StudyNotesPage />} />
            <Route path="/study-notes/:group/subject/:subjectId/class/:classId/lesson/:lessonTitle" element={<StudyNotesPage />} />
            <Route path="/school-materials" element={<SchoolMaterials />} />
            <Route path="/study-materials/practice/:group/:subjectId/:classId/:unitId/:lessonId" element={<StudyMaterialsPractice />} />
            <Route path="/study-materials/practice" element={<StudyMaterialsPractice />} />
            <Route path="/practice" element={<MCQPractice />} />
            <Route path="/mock-tests" element={<MockTests />} />
            <Route path="/previous-papers" element={<PreviousPapers />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>

        <footer className="footer glass">
          <div className="footer-content">
            <div className="footer-brand">
              <span className="footer-logo-icon-3d">
                <GraduationCap className="footer-logo-icon" size={22} />
              </span>
              <div className="footer-brand-text">
                <span className="footer-logo">TNPSC Study Hub</span>
                <span className="footer-tag">Glassmorphic Portal</span>
              </div>
            </div>
            <p className="footer-copy">© 2026 TNPSC Study Hub. Crafted with an ultra-premium Glassmorphism Dashboard UI/UX.</p>
            <p className="footer-note">⚡ Real-time analytics, mock tests, school syllabus notes & lesson-wise practice modules</p>
          </div>
        </footer>
      </div>
      </LanguageProvider>
    </Router>
  )
}

export default App
