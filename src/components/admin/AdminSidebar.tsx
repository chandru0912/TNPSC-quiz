import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  LineChart,
  ChevronDown,
  ChevronRight,
  BarChart3,
  MapPin,
  Activity,
  Globe,
  CreditCard,
  UserPlus,
  RotateCcw,
  Award,
  FileText,
  Database,
  BookOpen,
  Cloud,
  Cpu,
  Eye,
  Shield,
  Users,
  LogOut,
  X,
  Layers,
} from 'lucide-react';
import './AdminSidebar.css';

export type AdminSectionType =
  | 'control-center'
  | 'dashboard'
  | 'analytics'
  | 'questions'
  | 'textbooks'
  | 'notes'
  | 'study-materials-management'
  | 'gdrive'
  | 'claude'
  | 'dashboard-view';

export type AnalyticsTabType =
  | 'overview'
  | 'geographic'
  | 'live'
  | 'traffic'
  | 'subscriptions'
  | 'new-student'
  | 'restore-student'
  | 'performance'
  | 'reports'
  | 'students';



interface AdminSidebarProps {
  adminUser: { id?: number; username: string; name?: string; role?: string } | null;
  counts: {
    questions: number;
    textbooks: number;
    notes: number;
  };
  onOpenAdminAccounts: () => void;
  onLogout: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  adminUser,
  counts,
  onOpenAdminAccounts,
  onLogout,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Expandable state for Analytics submenu (saved in localStorage, default open)
  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tnpsc_sidebar_analytics_expanded');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleAnalytics = () => {
    setIsAnalyticsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tnpsc_sidebar_analytics_expanded', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const currentPath = location.pathname;

  const isItemActive = (targetPath: string): boolean => {
    if (targetPath === '/admin/dashboard') {
      return (
        currentPath === '/admin' ||
        currentPath === '/admin/' ||
        currentPath === '/admin/dashboard' ||
        currentPath === '/admin/control-center'
      );
    }
    return currentPath === targetPath;
  };

  const handleNavClick = (targetPath: string) => {
    navigate(targetPath);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const roleDisplay =
    adminUser?.role === 'super_admin'
      ? 'Super Admin'
      : adminUser?.role === 'reviewer'
      ? 'Reviewer'
      : adminUser?.role === 'editor'
      ? 'Editor'
      : 'Admin';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div className="admin-sidebar-mobile-backdrop" onClick={onCloseMobile} />
      )}

      <aside className={`admin-fixed-sidebar ${isOpenMobile ? 'mobile-open' : ''}`}>
        {/* Sidebar Brand Header */}
        <div className="admin-sidebar-header">
          <div className="sidebar-brand-box">
            <div className="sidebar-shield-badge">
              <Shield size={20} className="shield-icon-svg" />
            </div>
            <div className="sidebar-brand-titles">
              <span className="brand-primary-name">TNPSC STUDY HUB</span>
              <span className="brand-edition-tag">Control & SaaS Engine</span>
            </div>
          </div>
          {onCloseMobile && (
            <button
              type="button"
              className="sidebar-close-mobile-btn"
              onClick={onCloseMobile}
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Independently Scrollable Navigation Tree */}
        <nav className="admin-sidebar-nav-scroll" aria-label="Admin Navigation Menu">
          {/* 1. MAIN */}
          <div className="nav-tree-section">
            <div className="nav-section-title">MAIN</div>
            <ul className="nav-tree-list">
              <li>
                <button
                  type="button"
                  className={`nav-tree-btn ${isItemActive('/admin/dashboard') ? 'active' : ''}`}
                  onClick={() => handleNavClick('/admin/dashboard')}
                  title="Enterprise Analytics Dashboard"
                >
                  <LayoutDashboard size={17} className="btn-lead-icon" />
                  <span className="btn-label-text">Dashboard</span>
                </button>
              </li>
            </ul>
          </div>

          {/* 2. ANALYTICS (Expandable Menu) */}
          <div className="nav-tree-section">
            <button
              type="button"
              className="nav-section-header-btn"
              onClick={toggleAnalytics}
              aria-expanded={isAnalyticsExpanded}
              title="Expand / Collapse Analytics"
            >
              <div className="section-header-left">
                <LineChart size={15} className="header-chart-icon" />
                <span className="nav-section-title-interactive">ANALYTICS</span>
              </div>
              <div className="section-header-right">
                <span className="modules-pill">9 Pages</span>
                {isAnalyticsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
            </button>

            {isAnalyticsExpanded && (
              <ul className="nav-tree-list submenu-tree">
                <li>
                  <button
                    type="button"
                    className={`nav-tree-btn sub-btn ${isItemActive('/admin/analytics/overview') ? 'active' : ''}`}
                    onClick={() => handleNavClick('/admin/analytics/overview')}
                    title="Analytics Overview (12 KPI Cards)"
                  >
                    <BarChart3 size={15} className="btn-lead-icon" />
                    <span className="btn-label-text">Overview</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`nav-tree-btn sub-btn ${isItemActive('/admin/analytics/tamil-nadu-map') ? 'active' : ''}`}
                    onClick={() => handleNavClick('/admin/analytics/tamil-nadu-map')}
                    title="Interactive 38-District Vector Heatmap"
                  >
                    <MapPin size={15} className="btn-lead-icon" />
                    <span className="btn-label-text">Tamil Nadu Map</span>
                    <span className="btn-tag cyan">38 Dists</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`nav-tree-btn sub-btn ${isItemActive('/admin/analytics/live-monitor') ? 'active' : ''}`}
                    onClick={() => handleNavClick('/admin/analytics/live-monitor')}
                    title="Live Visitor Tracking & Stream"
                  >
                    <Activity size={15} className="btn-lead-icon live-pulse-icon" />
                    <span className="btn-label-text">Live Monitor (Traffic & Web)</span>
                    <span className="live-radar-dot" />
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`nav-tree-btn sub-btn ${isItemActive('/admin/analytics/traffic') ? 'active' : ''}`}
                    onClick={() => handleNavClick('/admin/analytics/traffic')}
                    title="Traffic Dynamics, Pages & Browsers"
                  >
                    <Globe size={15} className="btn-lead-icon" />
                    <span className="btn-label-text">Traffic & Web</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`nav-tree-btn sub-btn ${isItemActive('/admin/analytics/subscriptions') ? 'active' : ''}`}
                    onClick={() => handleNavClick('/admin/analytics/subscriptions')}
                    title="Subscription Plans, Revenue & Pass Breakdown"
                  >
                    <CreditCard size={15} className="btn-lead-icon" />
                    <span className="btn-label-text">Subscription Overview</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`nav-tree-btn sub-btn ${isItemActive('/admin/analytics/new-student') ? 'active' : ''}`}
                    onClick={() => handleNavClick('/admin/analytics/new-student')}
                    title="Quick Student Registration"
                  >
                    <UserPlus size={15} className="btn-lead-icon" />
                    <span className="btn-label-text">New Student</span>
                    <span className="btn-tag green">+ Enroll</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`nav-tree-btn sub-btn ${isItemActive('/admin/analytics/restore-student') ? 'active' : ''}`}
                    onClick={() => handleNavClick('/admin/analytics/restore-student')}
                    title="Restore Archived Student Accounts"
                  >
                    <RotateCcw size={15} className="btn-lead-icon" />
                    <span className="btn-label-text">Restore Student</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`nav-tree-btn sub-btn ${isItemActive('/admin/analytics/student-performance') ? 'active' : ''}`}
                    onClick={() => handleNavClick('/admin/analytics/student-performance')}
                    title="Student Performance, Scores & Accuracy Roster"
                  >
                    <Award size={15} className="btn-lead-icon" />
                    <span className="btn-label-text">Student Performance</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`nav-tree-btn sub-btn ${isItemActive('/admin/analytics/active-report') ? 'active' : ''}`}
                    onClick={() => handleNavClick('/admin/analytics/active-report')}
                    title="Executive Performance & Growth Audit Report"
                  >
                    <FileText size={15} className="btn-lead-icon" />
                    <span className="btn-label-text">Active Report</span>
                  </button>
                </li>
              </ul>
            )}
          </div>

          {/* 3. CONTENT MANAGEMENT */}
          <div className="nav-tree-section">
            <div className="nav-section-title">CONTENT MANAGEMENT</div>
            <ul className="nav-tree-list">
              <li>
                <button
                  type="button"
                  className={`nav-tree-btn ${isItemActive('/admin/question-bank') ? 'active' : ''}`}
                  onClick={() => handleNavClick('/admin/question-bank')}
                  title="Question Bank Management"
                >
                  <Database size={17} className="btn-lead-icon" />
                  <span className="btn-label-text">Question Bank</span>
                  <span className="item-count-badge">{counts.questions}</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav-tree-btn ${isItemActive('/admin/textbook-management') ? 'active' : ''}`}
                  onClick={() => handleNavClick('/admin/textbook-management')}
                  title="Samacheer Kalvi Textbook Management"
                >
                  <BookOpen size={17} className="btn-lead-icon" />
                  <span className="btn-label-text">Textbook Management</span>
                  <span className="item-count-badge">{counts.textbooks}</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav-tree-btn ${isItemActive('/admin/study-notes') ? 'active' : ''}`}
                  onClick={() => handleNavClick('/admin/study-notes')}
                  title="Study Notes Management"
                >
                  <FileText size={17} className="btn-lead-icon" />
                  <span className="btn-label-text">Study Notes</span>
                  <span className="item-count-badge">{counts.notes}</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav-tree-btn ${isItemActive('/admin/study-materials-management') ? 'active' : ''}`}
                  onClick={() => handleNavClick('/admin/study-materials-management')}
                  title="Dynamic Study Materials Management (Exam, Subject, Standard, Units, Lessons, Topics, Notes)"
                >
                  <Layers size={17} className="btn-lead-icon" />
                  <span className="btn-label-text">Study Materials Management</span>
                  <span className="btn-tag cyan">Dynamic</span>
                </button>
              </li>
            </ul>
          </div>

          {/* 4. INTEGRATIONS */}
          <div className="nav-tree-section">
            <div className="nav-section-title">INTEGRATIONS</div>
            <ul className="nav-tree-list">
              <li>
                <button
                  type="button"
                  className={`nav-tree-btn ${isItemActive('/admin/google-drive') ? 'active' : ''}`}
                  onClick={() => handleNavClick('/admin/google-drive')}
                  title="Google Drive Cloud PDF Storage"
                >
                  <Cloud size={17} className="btn-lead-icon" />
                  <span className="btn-label-text">Google Drive</span>
                  <span className="integration-dot online" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav-tree-btn ${isItemActive('/admin/ai-private-hub') ? 'active' : ''}`}
                  onClick={() => handleNavClick('/admin/ai-private-hub')}
                  title="AI Private Hub (Claude & Gemini)"
                >
                  <Cpu size={17} className="btn-lead-icon" />
                  <span className="btn-label-text">AI Private Hub</span>
                  <span className="btn-tag purple">AI Dual</span>
                </button>
              </li>
            </ul>
          </div>

          {/* 5. ADDITIONAL */}
          <div className="nav-tree-section">
            <div className="nav-section-title">ADDITIONAL</div>
            <ul className="nav-tree-list">
              <li>
                <button
                  type="button"
                  className={`nav-tree-btn ${isItemActive('/admin/dashboard-view') ? 'active' : ''}`}
                  onClick={() => handleNavClick('/admin/dashboard-view')}
                  title="Inspect Live Student Portal View"
                >
                  <Eye size={17} className="btn-lead-icon" />
                  <span className="btn-label-text">Dashboard View</span>
                  <span className="btn-tag student-tag">Student View</span>
                </button>
              </li>
            </ul>
          </div>
        </nav>

        {/* Sidebar Footer: Authenticated User Status & Controls */}
        <div className="admin-sidebar-footer">
          <div className="sidebar-profile-card">
            <div className="profile-avatar-circle">
              {adminUser?.name ? adminUser.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="profile-identity">
              <span className="profile-name">
                {adminUser?.name || adminUser?.username || 'Administrator'}
              </span>
              <span className="profile-role-pill">{roleDisplay}</span>
            </div>
          </div>

          <div className="sidebar-footer-actions-grid">
            <button
              type="button"
              className="footer-action-pill accounts"
              onClick={onOpenAdminAccounts}
              title="Manage Multiple Admin Accounts"
            >
              <Users size={13} />
              <span>Accounts</span>
            </button>
            <button
              type="button"
              className="footer-action-pill logout"
              onClick={onLogout}
              title="Sign Out of Admin Portal"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
