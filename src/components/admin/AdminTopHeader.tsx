import React from 'react';
import {
  Menu,
  ChevronRight,
  Eye,
  LogOut,
  RefreshCw,
  Shield,
} from 'lucide-react';
import type { AdminSectionType, AnalyticsTabType } from './AdminSidebar';
import './AdminTopHeader.css';

interface AdminTopHeaderProps {
  currentSection: AdminSectionType;
  currentAnalyticsTab: AnalyticsTabType;
  onToggleMobileSidebar: () => void;
  onOpenStudentPreview: () => void;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
  onLogout: () => void;
}

export const AdminTopHeader: React.FC<AdminTopHeaderProps> = ({
  currentSection,
  currentAnalyticsTab,
  onToggleMobileSidebar,
  onOpenStudentPreview,
  onRefreshData,
  isRefreshing = false,
  onLogout,
}) => {
  // Breadcrumb text mapper
  const getBreadcrumbTitle = () => {
    switch (currentSection) {
      case 'analytics':
        switch (currentAnalyticsTab) {
          case 'overview':
            return { group: 'Analytics', page: 'Overview Dashboard' };
          case 'geographic':
            return { group: 'Analytics', page: 'Tamil Nadu Map (38 Districts)' };
          case 'live':
            return { group: 'Analytics', page: 'Live Traffic & Web Monitor' };
          case 'subscriptions':
            return { group: 'Analytics', page: 'Subscription Overview' };
          case 'performance':
            return { group: 'Analytics', page: 'Student Performance' };
          case 'reports':
            return { group: 'Analytics', page: 'Active Report & Export' };
          case 'students':
            return { group: 'Analytics', page: 'Student Roster' };
          case 'traffic':
            return { group: 'Analytics', page: 'Traffic Analytics' };
          default:
            return { group: 'Analytics', page: 'Dashboard Overview' };
        }
      case 'questions':
        return { group: 'Content Management', page: 'Question Bank' };
      case 'textbooks':
        return { group: 'Content Management', page: 'Textbook Management' };
      case 'notes':
        return { group: 'Content Management', page: 'Study Notes' };
      case 'gdrive':
        return { group: 'Integrations', page: 'Google Drive Materials' };
      case 'claude':
        return { group: 'Integrations', page: 'AI Private Hub' };
      default:
        return { group: 'Admin', page: 'Control Panel' };
    }
  };

  const breadcrumb = getBreadcrumbTitle();

  return (
    <header className="admin-enterprise-top-header" role="banner">
      {/* Left: Mobile hamburger & Breadcrumbs */}
      <div className="top-header-left">
        <button
          type="button"
          className="mobile-hamburger-btn"
          onClick={onToggleMobileSidebar}
          aria-label="Open Navigation Sidebar"
        >
          <Menu size={20} />
        </button>

        <nav className="header-breadcrumbs" aria-label="Breadcrumb">
          <span className="crumb-root">
            <Shield size={14} className="crumb-shield-icon" />
            Admin
          </span>
          <ChevronRight size={13} className="crumb-separator" />
          <span className="crumb-group">{breadcrumb.group}</span>
          <ChevronRight size={13} className="crumb-separator" />
          <span className="crumb-current">{breadcrumb.page}</span>
        </nav>
      </div>

      {/* Right: Status Pill, View As Student, Refresh, Profile, Logout */}
      <div className="top-header-right">
        {/* Live Status Pill */}
        <div className="header-live-status-pill" title="PostgreSQL Analytics Engine Active">
          <span className="status-pulse-dot" />
          <span className="status-pill-text">Live System Active</span>
        </div>

        {/* View As Student Preview Button */}
        <button
          type="button"
          className="header-action-btn student-preview-btn"
          onClick={onOpenStudentPreview}
          title="Open Student Dashboard to preview and test learner features"
        >
          <Eye size={15} />
          <span>View as Student</span>
          <span className="preview-indicator-badge">Preview</span>
        </button>

        {/* Refresh Analytics Data */}
        {onRefreshData && (
          <button
            type="button"
            className={`header-action-btn refresh-btn ${isRefreshing ? 'spinning' : ''}`}
            onClick={onRefreshData}
            title="Refresh analytics data"
            disabled={isRefreshing}
          >
            <RefreshCw size={15} />
          </button>
        )}

        {/* Admin Profile & Logout */}
        <div className="header-profile-cluster">
          <div className="admin-avatar-pill">
            <span className="avatar-initials">AD</span>
          </div>
          <div className="admin-profile-meta">
            <span className="admin-profile-name">Administrator</span>
            <span className="admin-profile-badge">Master Control</span>
          </div>
          <button
            type="button"
            className="admin-logout-btn"
            onClick={onLogout}
            title="Sign out of Admin Panel"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
