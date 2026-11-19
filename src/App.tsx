import { useEffect, lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import ScrollToTop from './components/ScrollToTop'
import Navbar from './components/Navbar'
import { initSpatialTilt } from './utils/spatialTilt'
import StudentDashboardLayout from './layouts/StudentDashboardLayout'
import StudentPreviewBanner from './components/StudentPreviewBanner'
import { StudentAuthProvider } from './context/StudentAuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import './App.css'

// Resilient lazy loader that retries once on transient chunk fetch errors (e.g. after Vercel deploy)
function lazyWithRetry<T extends ComponentType<any>>(importer: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await importer()
    } catch {
      await new Promise((r) => setTimeout(r, 400))
      return await importer()
    }
  })
}

const Home = lazyWithRetry(() => import('./pages/Home'))
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'))
const StudyMaterials = lazyWithRetry(() => import('./pages/StudyMaterials'))
const SchoolMaterials = lazyWithRetry(() => import('./pages/SchoolMaterials'))
const Group1GeneralStudies = lazyWithRetry(() => import('./pages/Group1GeneralStudies'))
const Group1UnitDetail = lazyWithRetry(() => import('./pages/Group1UnitDetail'))
const Group1Lessons = lazyWithRetry(() => import('./pages/Group1Lessons'))
const Group1Aptitude = lazyWithRetry(() => import('./pages/Group1Aptitude'))
const Group1UnitClass = lazyWithRetry(() => import('./pages/Group1UnitClass'))
const Group2SubjectDetail = lazyWithRetry(() => import('./pages/Group2SubjectDetail'))
const Group2UnitDetail = lazyWithRetry(() => import('./pages/Group2UnitDetail'))
const Group2Lessons = lazyWithRetry(() => import('./pages/Group2Lessons'))
const Group2UnitClass = lazyWithRetry(() => import('./pages/Group2UnitClass'))
const Group4SubjectDetail = lazyWithRetry(() => import('./pages/Group4SubjectDetail'))
const Group4UnitDetail = lazyWithRetry(() => import('./pages/Group4UnitDetail'))
const Group4Lessons = lazyWithRetry(() => import('./pages/Group4Lessons'))
const Group4UnitClass = lazyWithRetry(() => import('./pages/Group4UnitClass'))
const MCQPractice = lazyWithRetry(() => import('./pages/MCQPractice'))
const StudyMaterialsPractice = lazyWithRetry(() => import('./pages/StudyMaterialsPractice'))
const StudyNotesPage = lazyWithRetry(() => import('./pages/StudyNotesPage'))
const MockTests = lazyWithRetry(() => import('./pages/MockTests'))
const PreviousPapers = lazyWithRetry(() => import('./pages/PreviousPapers'))
const PreviousPaperTest = lazyWithRetry(() => import('./pages/PreviousPaperTest'))
const MarkList = lazyWithRetry(() => import('./pages/MarkList'))
const ProgressTracker = lazyWithRetry(() => import('./pages/ProgressTracker'))
const PerformanceAnalytics = lazyWithRetry(() => import('./pages/PerformanceAnalytics'))
const Login = lazyWithRetry(() => import('./pages/Login'))
const Register = lazyWithRetry(() => import('./pages/Register'))
const Admin = lazyWithRetry(() => import('./pages/Admin'))

function RouteLoadingFallback() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.85rem',
        color: '#94a3b8',
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: '3px solid rgba(255, 215, 0, 0.18)',
          borderTopColor: '#ffd700',
          animation: 'spin 0.75s linear infinite',
        }}
      />
      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Loading module...</span>
    </div>
  )
}

function AppShell() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')
  const isDashboardRoute =
    !isAdmin &&
    [
      '/dashboard',
      '/materials',
      '/school-materials',
      '/study-materials',
      '/practice',
      '/mock-tests',
      '/previous-papers',
      '/mark-list',
      '/progress-tracker',
      '/performance-analytics',
      '/study-notes',
    ].some((prefix) => location.pathname.startsWith(prefix))

  return (
    <div className={`app ${isAdmin ? 'admin-app-mode' : ''} ${isDashboardRoute ? 'student-dashboard-app-mode' : ''}`}>
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

      {!isAdmin && <StudentPreviewBanner />}
      <Navbar />

      <main className={`main-content ${isAdmin ? 'admin-main-mode' : ''} ${isDashboardRoute ? 'student-dashboard-main-mode' : ''}`}>
        <ErrorBoundary
          resetKey={location.pathname}
          fallbackTitle="Page failed to render"
          fallbackMessage="An unexpected error occurred while displaying this page. Click Retry to recover."
        >
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
          <Route path="/" element={<Home />} />

          {/* Persistent Global Student Dashboard Layout with Independent Dual Scroll */}
          <Route element={<StudentDashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/materials" element={<StudyMaterials />} />
            <Route path="/materials/group1/general-studies" element={<Group1GeneralStudies />} />
            <Route path="/materials/group1/unit/:unitId" element={<Group1UnitDetail />} />
            <Route path="/materials/group1/unit/:unitId/lessons" element={<Group1Lessons />} />
            <Route path="/materials/group1/unit/:unitId/class/:classId" element={<Group1UnitClass />} />
            <Route path="/materials/group1/class/:classId" element={<Group1UnitClass />} />
            <Route path="/materials/group1/aptitude" element={<Group1Aptitude />} />
            <Route path="/materials/group1/aptitude/unit/:unitId" element={<Group1UnitDetail />} />
            <Route path="/materials/group1/aptitude/unit/:unitId/lessons" element={<Group1Lessons />} />
            <Route path="/materials/group1/aptitude/unit/:unitId/class/:classId" element={<Group1UnitClass />} />
            <Route path="/materials/group1/aptitude/class/:classId" element={<Group1UnitClass />} />
            <Route path="/materials/group2/:subjectId" element={<Group2SubjectDetail />} />
            <Route path="/materials/group2/:subjectId/unit/:unitId" element={<Group2UnitDetail />} />
            <Route path="/materials/group2/:subjectId/unit/:unitId/lessons" element={<Group2Lessons />} />
            <Route path="/materials/group2/:subjectId/unit/:unitId/class/:classId" element={<Group2UnitClass />} />
            <Route path="/materials/group2/:subjectId/class/:classId" element={<Group2UnitClass />} />
            <Route path="/materials/group2a/:subjectId" element={<Group2SubjectDetail />} />
            <Route path="/materials/group2a/:subjectId/unit/:unitId" element={<Group2UnitDetail />} />
            <Route path="/materials/group2a/:subjectId/unit/:unitId/lessons" element={<Group2Lessons />} />
            <Route path="/materials/group2a/:subjectId/unit/:unitId/class/:classId" element={<Group2UnitClass />} />
            <Route path="/materials/group2a/:subjectId/class/:classId" element={<Group2UnitClass />} />
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
            <Route path="/practice/*" element={<MCQPractice />} />
            <Route path="/mock-tests" element={<MockTests />} />
            <Route path="/previous-papers" element={<PreviousPapers />} />
            <Route path="/previous-papers/test/:paperId" element={<PreviousPaperTest />} />
            <Route path="/mark-list" element={<MarkList />} />
            <Route path="/progress-tracker" element={<ProgressTracker />} />
            <Route path="/performance-analytics" element={<PerformanceAnalytics />} />
          </Route>

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/*" element={<Admin />} />
        </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      {!isAdmin && !isDashboardRoute && (
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
      )}
    </div>
  )
}

function App() {
  // Initialize interactive 3D spatial tilt & dynamic glare tracking across all website logos
  useEffect(() => {
    const destroyTilt = initSpatialTilt()
    return () => {
      destroyTilt()
    }
  }, [])

  return (
    <ErrorBoundary fallbackTitle="Application Error" fallbackMessage="The application encountered an unexpected error. Click Retry to restore.">
      <Router>
        <StudentAuthProvider>
          <ScrollToTop />
          <AppShell />
        </StudentAuthProvider>
      </Router>
    </ErrorBoundary>
  )
}

export default App
