import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Sparkles } from 'lucide-react';
import { StudentSidebar } from '../components/StudentSidebar';
import TargetGroupOnboardingModal from '../components/TargetGroupOnboardingModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useStudentAuth } from '../context/StudentAuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useScrollLock } from '../hooks/useScrollLock';
import './StudentDashboardLayout.css';

export const StudentDashboardLayout: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const location = useLocation();
  const mainViewportRef = useRef<HTMLDivElement>(null);
  const { student } = useStudentAuth();
  const { isTamil } = useLanguage();

  // Lock background scroll when mobile sidebar drawer is active
  useScrollLock(mobileSidebarOpen);

  // Automatically scroll right main viewport to top on route navigation,
  // without altering or reloading the left sidebar's scroll position
  useEffect(() => {
    if (mainViewportRef.current) {
      mainViewportRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
    // Close mobile drawer on route transition
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // Derive human-readable active section title for mobile header
  const getPageTitle = (): { title: string; category: string } => {
    const p = location.pathname.toLowerCase();
    if (p === '/dashboard') {
      return isTamil
        ? { title: 'என் முகப்பு', category: 'கண்ணோட்டம் & செயல்பாடு' }
        : { title: 'My Dashboard', category: 'Overview & Telemetry' };
    }
    if (p.startsWith('/materials')) {
      return isTamil
        ? { title: 'பாடக்குறிப்புகள்', category: 'பாடத்திட்டம் & பாடநூல்கள்' }
        : { title: 'Study Materials', category: 'Syllabus & Textbooks' };
    }
    if (p.startsWith('/school-materials')) {
      return isTamil
        ? { title: 'பாடநூல் நூலகம்', category: 'சமச்சீர் கல்வி பாடநூல்கள்' }
        : { title: 'Textbook Library', category: 'Samacheer Kalvi PDFs' };
    }
    if (p.startsWith('/study-materials/practice')) {
      return isTamil
        ? { title: 'பாடம் வாரியான பயிற்சி', category: 'வகுப்பு வாரியான வினாக்கள்' }
        : { title: 'Lesson-wise Practice', category: 'Standard-wise Practice' };
    }
    if (p.startsWith('/practice')) {
      return isTamil
        ? { title: 'பயிற்சி வினாக்கள்', category: 'கொள்குறி வினா வங்கி' }
        : { title: 'MCQ Practice', category: 'Objective Question Bank' };
    }
    if (p.startsWith('/mock-tests')) {
      return isTamil
        ? { title: 'மாதிரித் தேர்வுகள்', category: 'முழுத் தேர்வுப் பயிற்சி' }
        : { title: 'Mock Tests', category: 'Full Exam Simulations' };
    }
    if (p.startsWith('/previous-papers')) {
      return isTamil
        ? { title: 'முந்தைய ஆண்டு வினாக்கள்', category: 'தீர்க்கப்பட்ட வினாத்தாள்கள்' }
        : { title: 'Previous Year Papers', category: 'Past Solved Papers' };
    }
    if (p.startsWith('/mark-list')) {
      return isTamil
        ? { title: 'மதிப்பெண் பட்டியல்', category: 'மதிப்பெண்கள் & மதிப்பீடு' }
        : { title: 'Mark List', category: 'Scorecards & Evaluation' };
    }
    if (p.startsWith('/progress-tracker')) {
      return isTamil
        ? { title: 'முன்னேற்றப் பதிவேடு', category: 'பாடத்திட்ட தேர்ச்சி' }
        : { title: 'Progress Tracker', category: 'Syllabus Mastery' };
    }
    if (p.startsWith('/study-notes')) {
      return isTamil
        ? { title: 'பாடக் குறிப்புகள்', category: 'இருமொழிப் பாடக்குறிப்புகள்' }
        : { title: 'Study Notes', category: 'Bilingual Lesson Notes' };
    }
    return isTamil
      ? { title: 'கற்றல் மையம்', category: 'மாணவர் தளம்' }
      : { title: 'Study Hub', category: 'Student Portal' };
  };

  const { title: currentTitle, category: currentCategory } = getPageTitle();

  return (
    <div className="student-dashboard-layout">
      {/* Exactly ONE Unified Global Student Sidebar (Desktop persistent + Mobile responsive drawer) */}
      <StudentSidebar
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Right-Side Main Content Viewport (Strictly Independent Scroll Container) */}
      <div
        className="student-dashboard-viewport"
        ref={mainViewportRef}
        id="student-main-scroll-viewport"
      >
        {/* Mobile Top Header (Displayed on <= 1024px screens) */}
        <header className="student-mobile-header glass">
          <div className="student-mobile-header-left">
            <button
              type="button"
              className="student-mobile-menu-btn"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar menu"
              title="Open Navigation Menu"
            >
              <Menu size={20} />
            </button>
            <div className="student-mobile-header-text">
              <span className="student-mobile-page-title">{currentTitle}</span>
              <span className="student-mobile-page-cat">{currentCategory}</span>
            </div>
          </div>

          <div className="student-mobile-header-right">
            <div className="student-mobile-badge-chip">
              <Sparkles size={14} className="text-gold" />
              <span>TNPSC</span>
            </div>
            {student && (
              <div
                className="student-mobile-avatar-pill"
                title={student.fullName || 'Student'}
              >
                {student.avatarUrl ? (
                  <img
                    src={student.avatarUrl}
                    alt={student.fullName || 'Student'}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  student.fullName ? student.fullName.charAt(0).toUpperCase() : 'S'
                )}
              </div>
            )}
          </div>
        </header>

        <TargetGroupOnboardingModal />

        {/* Dynamic Nested Child Route View */}
        <div className="student-dashboard-content-stream">
          <ErrorBoundary
            key={location.pathname}
            compact
            fallbackTitle="Unable to display this page"
            fallbackMessage="An unexpected error occurred while rendering this section. Click Retry to reload the view."
          >
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboardLayout;
