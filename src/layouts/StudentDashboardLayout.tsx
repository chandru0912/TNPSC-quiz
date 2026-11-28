import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Sparkles } from 'lucide-react';
import { StudentSidebar } from '../components/StudentSidebar';
import { StudentAvatar } from '../components/StudentAvatar';
import TargetGroupOnboardingModal from '../components/TargetGroupOnboardingModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useStudentAuth } from '../context/StudentAuthContext';
import { useScrollLock } from '../hooks/useScrollLock';
import './StudentDashboardLayout.css';

export const StudentDashboardLayout: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const location = useLocation();
  const mainViewportRef = useRef<HTMLDivElement>(null);
  const { student } = useStudentAuth();

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
      return { title: 'My Dashboard', category: 'Overview & Telemetry' };
    }
    if (p.startsWith('/dashboard/subscription')) {
      return { title: 'Subscription Plans', category: 'Unlock Premium Access' };
    }
    if (p.startsWith('/dashboard/profile')) {
      return { title: 'My Profile', category: 'Student Account' };
    }
    if (p.startsWith('/dashboard/settings')) {
      return { title: 'Settings', category: 'Account Preferences' };
    }
    if (p.startsWith('/dashboard/help')) {
      return { title: 'Help & Support', category: 'Guides & FAQs' };
    }
    if (p.startsWith('/materials')) {
      return { title: 'Study Materials', category: 'Syllabus & Textbooks' };
    }
    if (p.startsWith('/school-materials')) {
      return { title: 'Textbook Library', category: 'Samacheer Kalvi PDFs' };
    }
    if (p.startsWith('/study-materials/practice')) {
      return { title: 'Lesson-wise Practice', category: 'Standard-wise Practice' };
    }
    if (p.startsWith('/practice')) {
      return { title: 'MCQ Practice', category: 'Objective Question Bank' };
    }
    if (p.startsWith('/mock-tests')) {
      return { title: 'Mock Tests', category: 'Full Exam Simulations' };
    }
    if (p.startsWith('/previous-papers')) {
      return { title: 'Previous Year Papers', category: 'Past Solved Papers' };
    }
    if (p.startsWith('/mark-list')) {
      return { title: 'Mark List', category: 'Scorecards & Evaluation' };
    }
    if (p.startsWith('/progress-tracker')) {
      return { title: 'Progress Tracker', category: 'Syllabus Mastery' };
    }
    if (p.startsWith('/performance-analytics')) {
      return { title: 'Performance Analytics', category: 'Attempts & Trend Insights' };
    }
    if (p.startsWith('/study-notes')) {
      return { title: 'Study Notes', category: 'Lesson Notes' };
    }
    return { title: 'Aspirant Orbit', category: 'Student Portal' };
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
              <StudentAvatar
                studentId={student.id}
                fullName={student.fullName}
                email={student.email}
                avatarUrl={student.avatarUrl}
                size={32}
              />
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
