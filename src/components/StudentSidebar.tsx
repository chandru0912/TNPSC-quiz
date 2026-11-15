import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BookOpen,
  ListChecks,
  FileText,
  GraduationCap,
  Archive,
  Award,
  TrendingUp,
  Sparkles,
  Flame,
  LogOut,
  User,
  ArrowLeft,
  X,
} from 'lucide-react';
import { useStudentAuth } from '../context/StudentAuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitch from './LanguageSwitch';
import './StudentSidebar.css';

interface StudentSidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  streakCount?: number;
}

export const StudentSidebar: React.FC<StudentSidebarProps> = ({
  isOpenMobile = false,
  onCloseMobile,
  streakCount = 5,
}) => {
  const location = useLocation();
  const { student, isAuthenticated, logout } = useStudentAuth();
  const { isTamil } = useLanguage();

  const userName = student?.fullName || (isTamil ? 'மாணவர்' : 'Student Aspirant');
  const userGroup =
    student?.targetGroup === 'group1'
      ? (isTamil ? 'குரூப் 1 தேர்வர்' : 'Group 1 Aspirant')
      : student?.targetGroup === 'group2a'
        ? (isTamil ? 'குரூப் 2A தேர்வர்' : 'Group 2A Aspirant')
        : student?.targetGroup === 'group2'
          ? (isTamil ? 'குரூப் 2 & 2A தேர்வர்' : 'Group 2 & 2A Aspirant')
          : (isTamil ? 'குரூப் 4 & VAO தேர்வர்' : 'Group 4 & VAO Aspirant');

  const userInitial = userName.trim().charAt(0).toUpperCase() || 'S';

  // 8 Required Learning Navigation Items
  const navItems = [
    { label: isTamil ? 'முகப்பு' : 'Overview', to: '/dashboard', icon: LayoutDashboard },
    { label: isTamil ? 'பாடக்குறிப்புகள்' : 'Study Materials', to: '/materials', icon: BookOpen },
    { label: isTamil ? 'பாடம் வாரியான வினாக்கள்' : 'Lesson-wise Questions', to: '/school-materials', icon: ListChecks },
    { label: isTamil ? 'பயிற்சி வினாக்கள்' : 'MCQ Practice', to: '/practice', icon: FileText },
    { label: isTamil ? 'மாதிரித் தேர்வுகள்' : 'Mock Tests', to: '/mock-tests', icon: GraduationCap },
    { label: isTamil ? 'முந்தைய ஆண்டு வினாக்கள்' : 'Previous Year Questions', to: '/previous-papers', icon: Archive },
    { label: isTamil ? 'மதிப்பெண் பட்டியல்' : 'Mark List', to: '/mark-list', icon: Award },
    { label: isTamil ? 'முன்னேற்றப் பதிவேடு' : 'Progress Tracker', to: '/progress-tracker', icon: TrendingUp },
  ];

  const isLinkActive = (to: string): boolean => {
    const current = location.pathname.toLowerCase();
    if (to === '/dashboard') {
      return current === '/dashboard';
    }
    if (to === '/materials') {
      return current.startsWith('/materials') && !current.startsWith('/materials/practice');
    }
    if (to === '/school-materials') {
      return current.startsWith('/school-materials') || current.startsWith('/study-materials/practice');
    }
    return current.startsWith(to.toLowerCase());
  };

  const handleLinkClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarBody = (
    <div className="student-sidebar-inner">
      {/* 1. Header Branding: Study Hub (TNPSC Premium) */}
      <div className="student-sidebar-brand">
        <Link to="/" className="student-brand-link" onClick={handleLinkClick}>
          <div className="student-brand-mark">
            <Sparkles size={20} />
          </div>
          <div className="student-brand-text">
            <span className="student-brand-title">Study Hub</span>
            <span className="student-brand-sub">TNPSC Premium</span>
          </div>
        </Link>
        {onCloseMobile && (
          <button
            type="button"
            className="student-sidebar-close-btn"
            onClick={onCloseMobile}
            aria-label="Close navigation sidebar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* 2. Student Profile Card */}
      <div className="student-sidebar-profile">
        <div className="student-profile-avatar">
          {student?.avatarUrl ? (
            <img
              src={student.avatarUrl}
              alt={userName}
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              referrerPolicy="no-referrer"
            />
          ) : (
            userInitial
          )}
        </div>
        <div className="student-profile-info">
          <span className="student-profile-name" title={userName}>
            {userName}
          </span>
          <span className="student-profile-role">{userGroup}</span>
        </div>
      </div>

      {/* Global Language Selector (Single centralized switch for entire Student Dashboard) */}
      <div style={{ padding: '0 0.25rem 0.75rem', display: 'flex', justifyContent: 'center' }}>
        <LanguageSwitch variant="inline" />
      </div>

      {/* 3. Navigation List (Section: LEARNING) */}
      <nav className="student-sidebar-nav" aria-label="Student Learning Navigation">
        <span className="student-sidebar-nav-label">{isTamil ? 'கற்றல்' : 'LEARNING'}</span>
        <div className="student-sidebar-links-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isLinkActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`student-sidebar-link ${active ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                <span className="student-link-icon-wrap">
                  <Icon size={18} />
                </span>
                <span className="student-link-label">{item.label}</span>
                {active && <span className="student-link-active-dot" />}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* 4. Active Streak Counter Widget */}
      <div className="student-sidebar-streak-card">
        <div className="student-streak-icon-wrap">
          <Flame size={18} />
        </div>
        <div className="student-streak-content">
          <div className="student-streak-value">
            {isTamil ? `${streakCount} நாள் தொடர்ச்சி` : `${streakCount} day streak`}
          </div>
          <div className="student-streak-desc">
            {isTamil
              ? (streakCount > 0 ? 'தினசரி பயிற்சியைத் தொடருங்கள்!' : 'இன்று ஒரு பயிற்சியைத் தொடங்குங்கள்!')
              : (streakCount > 0 ? 'Keep the daily momentum going!' : 'Complete an activity today to start!')}
          </div>
        </div>
      </div>

      {/* 5. Sidebar Bottom Actions: Sign-in / Logout & Back to Home */}
      <div className="student-sidebar-footer">
        {isAuthenticated ? (
          <button
            type="button"
            onClick={() => {
              logout();
              handleLinkClick();
            }}
            className="student-footer-action logout"
          >
            <LogOut size={16} />
            <span>{isTamil ? 'வெளியேறு' : 'Logout'}</span>
          </button>
        ) : (
          <Link to="/login" className="student-footer-action login" onClick={handleLinkClick}>
            <User size={16} />
            <span>{isTamil ? 'உள்நுழை / பதிவு செய்' : 'Sign In / Register'}</span>
          </Link>
        )}

        <Link to="/" className="student-footer-action home" onClick={handleLinkClick}>
          <ArrowLeft size={16} />
          <span>{isTamil ? 'முகப்புப் பக்கம்' : 'Back to Home'}</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (Rendered directly in layout container) */}
      <aside className="student-desktop-sidebar-pane" aria-label="Student Navigation Sidebar">
        <div className="student-sidebar-glass-card glass">{sidebarBody}</div>
      </aside>

      {/* Mobile Drawer with Overlay */}
      <AnimatePresence>
        {isOpenMobile && (
          <div className="student-sidebar-mobile-root">
            <motion.div
              className="student-sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onCloseMobile}
            />
            <motion.aside
              className="student-sidebar-drawer glass"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
            >
              {sidebarBody}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default StudentSidebar;

