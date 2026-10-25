import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import Navbar from './components/Navbar'
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
import MockTests from './pages/MockTests'
import PreviousPapers from './pages/PreviousPapers'
import Login from './pages/Login'
import Register from './pages/Register'
import './App.css'

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="app">
        {/* Ambient Glassmorphic Background Orbs & Mesh */}
        <div className="ambient-glass-backdrop" aria-hidden="true">
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
            <Route path="/school-materials" element={<SchoolMaterials />} />
            <Route path="/practice" element={<MCQPractice />} />
            <Route path="/mock-tests" element={<MockTests />} />
            <Route path="/previous-papers" element={<PreviousPapers />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </main>

        <footer className="footer glass">
          <div className="footer-content">
            <div className="footer-brand">
              <span className="footer-logo">TNPSC Study Hub</span>
              <span className="footer-tag">Glassmorphic Portal</span>
            </div>
            <p className="footer-copy">© 2026 TNPSC Study Hub. Crafted with an ultra-premium Glassmorphism Dashboard UI/UX.</p>
            <p className="footer-note">⚡ Real-time analytics, mock tests, school syllabus notes & lesson-wise practice modules</p>
          </div>
        </footer>
      </div>
    </Router>
  )
}

export default App
