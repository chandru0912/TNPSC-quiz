import { useState, useEffect, lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import Navbar from './components/Navbar'
import SiteFooter from './components/SiteFooter'
import OrbitBrandLogo from './components/OrbitBrandLogo'
import { initSpatialTilt } from './utils/spatialTilt'
import StudentDashboardLayout from './layouts/StudentDashboardLayout'
import StudentPreviewBanner from './components/StudentPreviewBanner'
import { StudentAuthProvider } from './context/StudentAuthContext'
import { StudyMaterialsLanguageShell } from './components/study/StudyMaterialsLanguageShell'
import { CookieConsentProvider } from './context/CookieConsentContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppUpdateBanner } from './components/AppUpdateBanner'
import {
  canAutoReloadForUpdate,
  markAssetChunkError,
  performCleanUpdateReload,
} from './utils/appVersion'
import RequireStudentAuthRoute from './components/RequireStudentAuthRoute'
import RequireAdminAuthRoute from './components/RequireAdminAuthRoute'
import { startVisitorTracking, trackPageView } from './utils/visitorTracker'
import './App.css'

// Resilient lazy loader that recovers automatically from stale deployment chunk mismatches
// (e.g. after a new Vercel deploy) with loop-safe cache-busting recovery.
function lazyWithRetry<T extends ComponentType<any>>(importer: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await importer()
    } catch (firstErr) {
      await new Promise((r) => setTimeout(r, 350))
      try {
        return await importer()
      } catch (secondErr: any) {
        const msg = String(secondErr?.message || firstErr || '').toLowerCase()
        const isChunkFailure =
          msg.includes('failed to fetch dynamically imported module') ||
          msg.includes('importing a module script failed') ||
          msg.includes('loading chunk') ||
          msg.includes('mime type')
        if (typeof window !== 'undefined' && isChunkFailure) {
          markAssetChunkError()
          if (canAutoReloadForUpdate()) {
            void performCleanUpdateReload(false)
            return await new Promise<{ default: T }>(() => {})
          }
        }
        throw secondErr
      }
    }
  })
}

const Home = lazyWithRetry(() => import('./pages/Home'))
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'))
const StudentSubscription = lazyWithRetry(() => import('./pages/StudentSubscription'))
const StudentAccountPage = lazyWithRetry(() => import('./pages/StudentAccountPage'))
const HelpSupportPage = lazyWithRetry(() => import('./pages/HelpSupportPage'))
const PrivacyPolicyPage = lazyWithRetry(() => import('./pages/PrivacyPolicyPage'))
const AboutUsPage = lazyWithRetry(() => import('./pages/AboutUsPage'))
const UserPolicyPage = lazyWithRetry(() => import('./pages/UserPolicyPage'))
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
const OwnerLogin = lazyWithRetry(() => import('./pages/OwnerLogin'))
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.55rem' }}>
        <OrbitBrandLogo size={34} />
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '3px solid rgba(255, 215, 0, 0.18)',
            borderTopColor: '#ffd700',
            animation: 'spin 0.75s linear infinite',
          }}
        />
      </div>
      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#cbd5e1' }}>Loading TNPSC Aspirant Orbit...</span>
    </div>
  )
}

function AppShell() {
  const location = useLocation()
  const isHomePage = location.pathname === '/' || location.pathname === ''
  const isAdmin = location.pathname === '/admin' || location.pathname.startsWith('/admin/')
  const isOwnerLogin = location.pathname === '/owner-login'
  const isPrivateOwnerRoute = isAdmin || isOwnerLogin

  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches)
    setIsMobileViewport(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Desktop & Tablet (>= 768px): show global Navbar on all student-facing routes.
  // Mobile (<= 767px): show global Navbar ONLY on the Home Page ('/').
  const shouldShowGlobalNavbar = !isPrivateOwnerRoute && (!isMobileViewport || isHomePage)

  // Real-time website visitor & route page-view tracking (non-admin routes only)
  useEffect(() => {
    startVisitorTracking()
  }, [])

  useEffect(() => {
    if (!isPrivateOwnerRoute) {
      trackPageView(location.pathname)
    }
  }, [location.pathname, isPrivateOwnerRoute])
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
      '/privacy-policy',
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

      {!isPrivateOwnerRoute && <StudentPreviewBanner />}
      {shouldShowGlobalNavbar && <Navbar />}

      <main className={`main-content ${!shouldShowGlobalNavbar ? 'no-global-header' : ''} ${isAdmin ? 'admin-main-mode' : ''} ${isDashboardRoute ? 'student-dashboard-main-mode' : ''}`}>
        <ErrorBoundary
          resetKey={location.pathname}
          fallbackTitle="Page failed to render"
          fallbackMessage="An unexpected error occurred while displaying this page. Click Retry to recover."
        >
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about-us" element={<AboutUsPage />} />
          <Route path="/user-policy" element={<UserPolicyPage />} />
          <Route path="/terms-of-service" element={<HelpSupportPage section="terms-of-service" />} />

          {/* Persistent Global Student Dashboard Layout with Independent Dual Scroll */}
          <Route element={<StudentDashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/subscription" element={<StudentSubscription />} />
            <Route path="/dashboard/profile" element={<StudentAccountPage section="profile" />} />
            <Route path="/dashboard/settings" element={<StudentAccountPage section="settings" />} />
            <Route path="/dashboard/help" element={<HelpSupportPage section="help-center" />} />
            <Route path="/dashboard/privacy-center" element={<HelpSupportPage section="privacy-center" />} />
            <Route path="/dashboard/terms-of-service" element={<HelpSupportPage section="terms-of-service" />} />
            <Route path="/dashboard/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />

            {/* Study Materials Section — Scoped Global English <-> Tamil Translator */}
            <Route element={<StudyMaterialsLanguageShell />}>
              <Route path="/materials" element={<StudyMaterials />} />
              <Route path="/school-materials" element={<SchoolMaterials />} />

              <Route element={<RequireStudentAuthRoute />}>
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
                <Route path="/study-materials/practice/:group/:subjectId/:classId/:unitId/:lessonId" element={<StudyMaterialsPractice />} />
                <Route path="/study-materials/practice" element={<StudyMaterialsPractice />} />
              </Route>
            </Route>

            {/* Protected Previous Papers & Mark List Routes (outside Study Materials translator scope) */}
            <Route element={<RequireStudentAuthRoute />}>
              <Route path="/previous-papers/test/:paperId" element={<PreviousPaperTest />} />
              <Route path="/mark-list" element={<MarkList />} />
            </Route>
            <Route path="/practice" element={<MCQPractice />} />
            <Route path="/practice/*" element={<MCQPractice />} />
            <Route path="/mock-tests" element={<MockTests />} />
            <Route path="/previous-papers" element={<PreviousPapers />} />
            <Route path="/progress-tracker" element={<ProgressTracker />} />
            <Route path="/performance-analytics" element={<PerformanceAnalytics />} />
          </Route>

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/owner-login" element={<OwnerLogin />} />
          <Route element={<RequireAdminAuthRoute />}>
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/*" element={<Admin />} />
          </Route>
        </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      {!isPrivateOwnerRoute && !isDashboardRoute && <SiteFooter />}
      <AppUpdateBanner />
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
        <CookieConsentProvider>
          <StudentAuthProvider>
            <ScrollToTop />
            <AppShell />
          </StudentAuthProvider>
        </CookieConsentProvider>
      </Router>
    </ErrorBoundary>
  )
}

export default App
