import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  BarChart3,
  Sparkles,
  Flame,
  User,
  Settings,
  HelpCircle,
  LifeBuoy,
  ShieldCheck,
  Lock,
  LogOut,
  ChevronUp,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { useStudentAuth } from '../context/StudentAuthContext';
import { StudentAvatar } from './StudentAvatar';
import { resolveStudentDisplayName } from '../utils/studentProfile';
import { SubscriptionButton } from './SubscriptionButton';
import OrbitBrandLogo from './OrbitBrandLogo';
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
  const navigate = useNavigate();
  const { student, isAuthenticated, logout } = useStudentAuth();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [helpSubmenuOpen, setHelpSubmenuOpen] = useState(false);
  const [helpFlyoutPos, setHelpFlyoutPos] = useState<{ bottom: number; left: number; width: number } | null>(null);
  const activeHelpBtnRef = useRef<HTMLButtonElement | null>(null);
  const helpCloseTimerRef = useRef<number | null>(null);

  const clearHelpCloseTimer = useCallback(() => {
    if (helpCloseTimerRef.current !== null) {
      window.clearTimeout(helpCloseTimerRef.current);
      helpCloseTimerRef.current = null;
    }
  }, []);

  const openHelpFlyout = useCallback(
    (triggerEl?: HTMLButtonElement | null) => {
      clearHelpCloseTimer();
      if (triggerEl) {
        activeHelpBtnRef.current = triggerEl;
      }
      setHelpSubmenuOpen(true);
    },
    [clearHelpCloseTimer]
  );

  const scheduleCloseHelpFlyout = useCallback(() => {
    clearHelpCloseTimer();
    helpCloseTimerRef.current = window.setTimeout(() => {
      setHelpSubmenuOpen(false);
      helpCloseTimerRef.current = null;
    }, 180);
  }, [clearHelpCloseTimer]);

  useEffect(() => {
    return () => {
      clearHelpCloseTimer();
    };
  }, [clearHelpCloseTimer]);

  const updateHelpFlyoutPosition = useCallback(() => {
    const helpBtn = activeHelpBtnRef.current;
    if (!helpBtn || typeof window === 'undefined') return;
    const btnRect = helpBtn.getBoundingClientRect();
    const popupEl = helpBtn.closest('.student-profile-popup');
    const popupRect = popupEl ? popupEl.getBoundingClientRect() : btnRect;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const gap = 10;
    const margin = 12;
    const preferredWidth = 212;
    const width = Math.min(preferredWidth, viewportW - margin * 2);

    // Prefer opening horizontally to the RIGHT of the Profile popup
    let left = popupRect.right + gap;
    let bottom = Math.max(margin, viewportH - btnRect.bottom - 6);

    // If not enough horizontal room on the right (e.g. narrow mobile drawer), keep inside viewport cleanly
    if (left + width > viewportW - margin) {
      left = Math.max(margin, viewportW - width - margin);
      // Avoid covering the Help trigger itself when constrained on very narrow viewports
      const abovePopupBottom = viewportH - popupRect.top + 8;
      if (popupRect.right + 40 > viewportW && abovePopupBottom + 185 < viewportH) {
        bottom = abovePopupBottom;
      }
    }

    // Clamp vertically so the flyout never clips past top or bottom of viewport
    const maxBottom = Math.max(margin, viewportH - 210);
    bottom = Math.min(bottom, maxBottom);

    setHelpFlyoutPos({ bottom, left, width });
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Element | null;
      if (
        target &&
        !target.closest('.student-profile-trigger-wrap') &&
        !target.closest('.student-help-flyout')
      ) {
        setProfileMenuOpen(false);
        setHelpSubmenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileMenuOpen(false);
        setHelpSubmenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!helpSubmenuOpen || !profileMenuOpen) {
      setHelpFlyoutPos(null);
      return;
    }
    updateHelpFlyoutPosition();
    const handleReposition = () => updateHelpFlyoutPosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [helpSubmenuOpen, profileMenuOpen, updateHelpFlyoutPosition]);

  // Close popup on route change or mobile drawer close
  useEffect(() => {
    setProfileMenuOpen(false);
    setHelpSubmenuOpen(false);
  }, [location.pathname, isOpenMobile]);

  const profileMenuItems = [
    { label: 'Upgrade Plan', to: '/dashboard/subscription', icon: Sparkles },
    { label: 'Profile', to: '/dashboard/profile', icon: User },
    { label: 'Settings', to: '/dashboard/settings', icon: Settings },
  ];

  const helpSubmenuItems = [
    { label: 'Help Center', to: '/dashboard/help', icon: LifeBuoy },
    { label: 'Privacy Center', to: '/dashboard/privacy-center', icon: ShieldCheck },
    { label: 'Terms of Service', to: '/dashboard/terms-of-service', icon: FileText },
    { label: 'Privacy Policy', to: '/privacy-policy', icon: Lock },
  ];

  const isHelpRouteActive = helpSubmenuItems.some(
    (item) => location.pathname.toLowerCase() === item.to
  );

  const activeStudent = isAuthenticated ? student : null;
  const userName = resolveStudentDisplayName(activeStudent);
  const formatExamCategoryLabel = (targetGroup?: string | null): string => {
    const raw = String(targetGroup || '').trim();
    if (!raw) return 'TNPSC Aspirant';
    const tokens = raw
      .split(/[,/|]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (tokens.length === 0) return 'TNPSC Aspirant';
    const mapped: string[] = [];
    for (const token of tokens) {
      let label: string;
      if (token === 'group1' || token === 'group 1') {
        label = 'Group 1';
      } else if (token === 'group2_2a' || token === 'group2' || token === 'group 2' || token === 'group 2 & 2a') {
        label = 'Group 2 & 2A';
      } else if (token === 'group2a' || token === 'group 2a') {
        label = 'Group 2A';
      } else if (token === 'group4' || token === 'group4_vao' || token === 'group 4' || token === 'group 4 & vao') {
        label = 'Group 4';
      } else {
        label = token.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      }
      if (!mapped.includes(label)) mapped.push(label);
    }
    return `${mapped.join(', ')} Aspirant`;
  };
  const userGroup = formatExamCategoryLabel(activeStudent?.targetGroup);

  // 8 Required Learning Navigation Items
  const navItems = [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Study Materials', to: '/materials', icon: BookOpen },
    { label: 'Textbook Library', to: '/school-materials', icon: ListChecks },
    { label: 'MCQ Practice', to: '/practice', icon: FileText },
    { label: 'Mock Tests', to: '/mock-tests', icon: GraduationCap },
    { label: 'Previous Year Questions', to: '/previous-papers', icon: Archive },
    { label: 'Performance Analytics', to: '/performance-analytics', icon: BarChart3 },
    { label: 'Mark List', to: '/mark-list', icon: Award },
    { label: 'Progress Tracker', to: '/progress-tracker', icon: TrendingUp },
  ];

  const isLinkActive = (to: string): boolean => {
    const current = location.pathname.toLowerCase();
    const originState = (location.state as { from?: string } | null)?.from;
    const originQuery = new URLSearchParams(location.search).get('from');
    const origin = originState || originQuery;

    if (to === '/dashboard') {
      return current === '/dashboard';
    }
    if (to === '/materials') {
      if (origin === 'school-materials') return false;
      return (
        (current.startsWith('/materials') && !current.startsWith('/materials/practice')) ||
        current.startsWith('/study-materials/practice')
      );
    }
    if (to === '/school-materials') {
      if (origin === 'school-materials') return true;
      return current.startsWith('/school-materials');
    }
    if (to === '/practice') {
      return current.startsWith('/practice') || current.startsWith('/materials/practice');
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
            <OrbitBrandLogo size={24} />
          </div>
          <div className="student-brand-text">
            <span className="student-brand-title">Aspirant Orbit</span>
            <span className="student-brand-sub">TNPSC Premium</span>
          </div>
        </Link>
      </div>

      {/* 2. Student Profile Card */}
      <div
        className="student-sidebar-profile"
        title={`${userName} — ${userGroup}`}
      >
        <StudentAvatar
          studentId={activeStudent?.id}
          fullName={userName}
          avatarUrl={activeStudent?.avatarUrl}
          size={40}
        />
        <div className="student-profile-info">
          <span className="student-profile-name" title={userName}>
            {userName}
          </span>
          {activeStudent?.username && (
            <span className="student-profile-email" title={`@${activeStudent.username}`}>
              @{activeStudent.username}
            </span>
          )}
          <span className="student-profile-role" title={userGroup}>
            {userGroup}
          </span>
        </div>
      </div>

      {/* 3. Navigation List (Section: LEARNING) */}
      <nav className="student-sidebar-nav" aria-label="Student Learning Navigation">
        <span className="student-sidebar-nav-label">LEARNING</span>
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
            {`${streakCount} day streak`}
          </div>
          <div className="student-streak-desc">
            {streakCount > 0 ? 'Keep the daily momentum going!' : 'Complete an activity today to start!'}
          </div>
        </div>
      </div>

      {/* 4B. Dedicated Subscription Navigation Button (Directly below 5 Day Streak) */}
      <SubscriptionButton variant="sidebar" onClick={handleLinkClick} />

      {/* 5. Sidebar Bottom Actions: Profile (with upward popup inside sidebar) & Back to Home */}
      <div className="student-sidebar-footer">
        <div className="student-profile-trigger-wrap">
          <AnimatePresence>
            {profileMenuOpen && (
              <motion.div
                role="menu"
                aria-label="Profile Menu"
                className="student-profile-popup"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                {profileMenuItems.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname.toLowerCase() === item.to;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      role="menuitem"
                      className={`student-profile-popup-item ${active ? 'active' : ''}`}
                      onMouseEnter={() => {
                        clearHelpCloseTimer();
                        setHelpSubmenuOpen(false);
                      }}
                      onClick={() => {
                        clearHelpCloseTimer();
                        setProfileMenuOpen(false);
                        setHelpSubmenuOpen(false);
                        handleLinkClick();
                        navigate(item.to);
                      }}
                    >
                      <span className="student-profile-popup-icon">
                        <Icon size={16} />
                      </span>
                      <span className="student-profile-popup-label">{item.label}</span>
                    </button>
                  );
                })}

                <div className="student-profile-popup-divider" role="separator" />

                {/* Section 2: Help (right-side flyout) & Logout */}
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={helpSubmenuOpen}
                  className={`student-profile-popup-item ${isHelpRouteActive || helpSubmenuOpen ? 'active' : ''}`}
                  onMouseEnter={(e) => openHelpFlyout(e.currentTarget)}
                  onMouseLeave={scheduleCloseHelpFlyout}
                  onFocus={(e) => openHelpFlyout(e.currentTarget)}
                  onClick={(e) => {
                    clearHelpCloseTimer();
                    activeHelpBtnRef.current = e.currentTarget;
                    setHelpSubmenuOpen((prev) => !prev);
                  }}
                >
                  <span className="student-profile-popup-icon">
                    <HelpCircle size={16} />
                  </span>
                  <span className="student-profile-popup-label">Help</span>
                  <ChevronRight
                    size={15}
                    className={`student-help-submenu-chevron ${helpSubmenuOpen ? 'open' : ''}`}
                  />
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className="student-profile-popup-item logout"
                  onMouseEnter={() => {
                    clearHelpCloseTimer();
                    setHelpSubmenuOpen(false);
                  }}
                  onClick={() => {
                    clearHelpCloseTimer();
                    setProfileMenuOpen(false);
                    setHelpSubmenuOpen(false);
                    logout();
                    handleLinkClick();
                    navigate('/');
                  }}
                >
                  <span className="student-profile-popup-icon">
                    <LogOut size={16} />
                  </span>
                  <span className="student-profile-popup-label">Logout</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            className={`student-footer-action profile ${profileMenuOpen ? 'active' : ''}`}
            aria-haspopup="menu"
            aria-expanded={profileMenuOpen}
            onClick={() =>
              setProfileMenuOpen((prev) => {
                if (prev) setHelpSubmenuOpen(false);
                return !prev;
              })
            }
          >
            <User size={16} />
            <span className="student-profile-trigger-label">Profile</span>
            <ChevronUp
              size={15}
              className={`student-profile-trigger-chevron ${profileMenuOpen ? 'open' : ''}`}
            />
          </button>
        </div>

        <Link to="/" className="student-footer-action home" onClick={handleLinkClick}>
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );

  const helpFlyoutPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {profileMenuOpen && helpSubmenuOpen && helpFlyoutPos && (
              <motion.div
                role="menu"
                aria-label="Help and Support Submenu"
                className="student-help-flyout"
                style={{
                  position: 'fixed',
                  bottom: `${helpFlyoutPos.bottom}px`,
                  left: `${helpFlyoutPos.left}px`,
                  width: `${helpFlyoutPos.width}px`,
                }}
                onMouseEnter={clearHelpCloseTimer}
                onMouseLeave={scheduleCloseHelpFlyout}
                initial={{ opacity: 0, x: -10, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -10, scale: 0.97 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                {helpSubmenuItems.map((sub) => {
                  const SubIcon = sub.icon;
                  const subActive = location.pathname.toLowerCase() === sub.to;
                  return (
                    <button
                      key={sub.to}
                      type="button"
                      role="menuitem"
                      className={`student-profile-popup-item ${subActive ? 'active' : ''}`}
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setHelpSubmenuOpen(false);
                        handleLinkClick();
                        navigate(sub.to);
                      }}
                    >
                      <span className="student-profile-popup-icon">
                        <SubIcon size={15} />
                      </span>
                      <span className="student-profile-popup-label">{sub.label}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <>
      {helpFlyoutPortal}
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

