import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Users,
  LogOut,
  RefreshCw,
  UserCheck,
  UserPlus,
  Globe,
  CreditCard,
  Database,
  BookOpen,
  FileText,
  MapPin,
  Activity,
  Cloud,
  Cpu,
  Eye,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { apiFetch } from '../../utils/api';
import './AdminControlCenter.css';

interface MetricItem {
  value: number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
}

interface AdminControlCenterProps {
  token: string | null;
  adminUser: { id?: number; username: string; name?: string; role?: string } | null;
  counts: {
    questions: number;
    textbooks: number;
    notes: number;
  };
  onOpenAdminAccounts: () => void;
  onLogout: () => void;
  onOpenStudentPreview?: () => void;
}

export const AdminControlCenter: React.FC<AdminControlCenterProps> = ({
  token,
  adminUser,
  counts,
  onOpenAdminAccounts,
  onLogout,
  onOpenStudentPreview,
}) => {
  const navigate = useNavigate();

  // Connection status state (100% verified against real backend health checks)
  const [pgStatus, setPgStatus] = useState<'connected' | 'offline' | 'checking'>('checking');
  const [driveStatus, setDriveStatus] = useState<'connected' | 'offline' | 'checking'>('checking');
  const [aiStatus, setAiStatus] = useState<{ provider: string; ready: boolean }>({
    provider: 'Claude',
    ready: true,
  });

  // KPI Overview Data (Live PostgreSQL database metrics)
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  const [metricsData, setMetricsData] = useState<{
    totalStudents: MetricItem;
    activeToday: MetricItem;
    totalVisitors: MetricItem;
    newStudents: MetricItem;
    paidSubscribers: MetricItem;
  }>({
    totalStudents: { value: 0, change: 0, trend: 'neutral' },
    activeToday: { value: 0, change: 0, trend: 'neutral' },
    totalVisitors: { value: 0, change: 0, trend: 'neutral' },
    newStudents: { value: 0, change: 0, trend: 'neutral' },
    paidSubscribers: { value: 0, change: 0, trend: 'neutral' },
  });

  const fetchSystemStatus = useCallback(async () => {
    try {
      // 1. Check PostgreSQL health (live DB check)
      try {
        const healthRes = await apiFetch('/api/health');
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          const dbIsUp =
            healthData.database === 'connected' ||
            healthData.services?.database?.status === 'connected' ||
            healthData.status === 'ok';
          setPgStatus(dbIsUp ? 'connected' : 'offline');
        } else {
          setPgStatus('offline');
        }
      } catch {
        setPgStatus('offline');
      }

      // 2. Check Google Drive connection status
      try {
        const driveRes = await apiFetch('/api/drive/status');
        if (driveRes.ok) {
          const dData = await driveRes.json();
          setDriveStatus(dData.connected ? 'connected' : 'offline');
        } else {
          setDriveStatus('offline');
        }
      } catch {
        setDriveStatus('offline');
      }

      // 3. Check AI Provider status (Claude & Gemini isolation)
      try {
        const aiRes = await apiFetch('/api/ai/providers');
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const active = aiData.activeProvider || 'claude';
          const pStatus = aiData.providers?.[active];
          const isReady = Boolean(pStatus?.configured || pStatus?.connected);
          setAiStatus({
            provider: active === 'gemini' ? 'Gemini' : 'Claude',
            ready: isReady,
          });
        }
      } catch {
        // preserve last known status
      }

      // 4. Query Real Database Analytics Overview
      try {
        const authHeader: Record<string, string> = {};
        if (token) authHeader.Authorization = `Bearer ${token}`;
        const ovRes = await apiFetch('/api/analytics/overview', {
          headers: authHeader,
        });

        if (ovRes.ok) {
          const ovJson = await ovRes.json();
          const dataObj = ovJson.data || ovJson;
          const cards: any[] = dataObj.overviewCards || [];

          const findCard = (id: string) => cards.find((c) => c.id === id);

          const cStudents = findCard('total_students');
          const cActive = findCard('active_today');
          const cVisitors = findCard('total_visitors');
          const cNew = findCard('new_registrations');
          const cSubs = findCard('paid_subscribers');

          setMetricsData({
            totalStudents: {
              value: Number(cStudents?.value ?? dataObj.totalStudents ?? 0),
              change: Number(cStudents?.change ?? 0),
              trend: (cStudents?.trend as any) || 'neutral',
            },
            activeToday: {
              value: Number(cActive?.value ?? dataObj.activeStudents ?? 0),
              change: Number(cActive?.change ?? 0),
              trend: (cActive?.trend as any) || 'neutral',
            },
            totalVisitors: {
              value: Number(cVisitors?.value ?? dataObj.totalVisitors ?? 0),
              change: Number(cVisitors?.change ?? 0),
              trend: (cVisitors?.trend as any) || 'neutral',
            },
            newStudents: {
              value: Number(cNew?.value ?? 0),
              change: Number(cNew?.change ?? 0),
              trend: (cNew?.trend as any) || 'neutral',
            },
            paidSubscribers: {
              value: Number(cSubs?.value ?? dataObj.paidSubscribers ?? 0),
              change: Number(cSubs?.change ?? 0),
              trend: (cSubs?.trend as any) || 'neutral',
            },
          });

          setLastSyncTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      } catch (err) {
        console.warn('[Control Center] Analytics fetch error:', err);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchSystemStatus]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchSystemStatus();
  };

  const roleDisplay =
    adminUser?.role === 'super_admin'
      ? 'Super Admin'
      : adminUser?.role === 'reviewer'
      ? 'Reviewer'
      : adminUser?.role === 'editor'
      ? 'Editor'
      : 'Admin';

  const renderTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return <TrendingUp size={12} />;
    if (trend === 'down') return <TrendingDown size={12} />;
    return <Minus size={12} />;
  };

  return (
    <div className="admin-control-center-root">
      {/* 1. Enterprise Page Header & Admin Controls */}
      <section className="cc-header-container" aria-label="TNPSC Control Center Header">
        <div className="cc-header-top-row">
          <div className="cc-title-block">
            <div className="cc-badge-row">
              <span className="cc-badge-control-center">
                <Shield size={13} className="cc-badge-icon" />
                TNPSC CONTROL CENTER
              </span>
            </div>
            <h1 className="cc-main-title">Enterprise Analytics Dashboard</h1>
            <p className="cc-subtitle">
              Real-time platform monitoring and student performance analytics.
            </p>
          </div>

          <div className="cc-admin-controls-group">
            {/* Super Admin Badge */}
            <div className="cc-role-badge">
              <Shield size={14} className="cc-role-icon" />
              <span>{roleDisplay}</span>
            </div>

            {/* Admin Accounts Management Button */}
            <button
              type="button"
              className="cc-action-btn accounts"
              onClick={onOpenAdminAccounts}
              title="Manage Multiple Admin Accounts"
            >
              <Users size={14} />
              <span>Admin Accounts</span>
            </button>

            {/* Sign Out Button */}
            <button
              type="button"
              className="cc-action-btn logout"
              onClick={onLogout}
              title="Sign Out of Admin Control Panel"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* 2. Connection Status Row (Real Backend Health Checks) */}
        <div className="cc-connection-status-row">
          <div className="cc-status-pills-list">
            {/* Indicator 1: PostgreSQL Connected */}
            <div className={`cc-status-pill ${pgStatus === 'connected' ? 'connected' : 'offline'}`} title="Real-time PostgreSQL Pool Health">
              <span className={`cc-status-dot ${pgStatus === 'connected' ? 'green' : 'red'}`} />
              <span className="cc-status-label">
                {pgStatus === 'checking'
                  ? 'PostgreSQL: Checking...'
                  : pgStatus === 'connected'
                  ? 'PostgreSQL Connected'
                  : 'PostgreSQL Offline'}
              </span>
            </div>

            {/* Indicator 2: Google Drive Connected */}
            <div className={`cc-status-pill ${driveStatus === 'connected' ? 'connected' : 'offline'}`} title="Google Drive Cloud PDF Storage">
              <span className={`cc-status-dot ${driveStatus === 'connected' ? 'green' : 'red'}`} />
              <span className="cc-status-label">
                {driveStatus === 'checking'
                  ? 'Google Drive: Checking...'
                  : driveStatus === 'connected'
                  ? 'Google Drive Connected'
                  : 'Google Drive Disconnected'}
              </span>
            </div>

            {/* Indicator 3: AI Provider Status */}
            <div className={`cc-status-pill ${aiStatus.ready ? 'ai-ready' : 'offline'}`} title="Anthropic Claude & Google Gemini AI Engine">
              <span className={`cc-status-dot ${aiStatus.ready ? 'purple' : 'red'}`} />
              <span className="cc-status-label">
                AI: {aiStatus.provider} ({aiStatus.ready ? 'Ready' : 'Offline'})
              </span>
            </div>
          </div>

          <div className="cc-status-refresh-wrap">
            <span className="cc-last-sync-time">
              {lastSyncTime ? `Synced ${lastSyncTime}` : 'Live Monitoring'}
            </span>
            <button
              type="button"
              className={`cc-refresh-btn ${isRefreshing ? 'spinning' : ''}`}
              onClick={handleRefresh}
              title="Refresh Connection Statuses & Analytics"
            >
              <RefreshCw size={13} />
              <span>{isRefreshing ? 'Checking...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. Analytics Overview 6 Cards Grid (Live PostgreSQL Data) */}
      <section className="cc-kpi-cards-grid" aria-label="Analytics Overview Metrics">
        {/* Card 1: Total Students */}
        <div className="cc-kpi-card purple">
          <div className="cc-card-header">
            <span className="cc-card-label">TOTAL STUDENTS</span>
            <div className="cc-card-icon purple">
              <Users size={18} />
            </div>
          </div>
          <div className="cc-card-value">
            {loading ? <span className="cc-shimmer" /> : metricsData.totalStudents.value.toLocaleString()}
          </div>
          <div className="cc-card-footer">
            <span className={`cc-trend-tag ${metricsData.totalStudents.trend}`}>
              {renderTrendIcon(metricsData.totalStudents.trend)}
              {metricsData.totalStudents.change > 0 ? `+${metricsData.totalStudents.change}%` : `${metricsData.totalStudents.change}%`}
            </span>
            <span className="cc-card-subtext">Enrolled aspirants</span>
          </div>
        </div>

        {/* Card 2: Active Students */}
        <div className="cc-kpi-card emerald">
          <div className="cc-card-header">
            <span className="cc-card-label">ACTIVE STUDENTS</span>
            <div className="cc-card-icon emerald">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="cc-card-value">
            {loading ? <span className="cc-shimmer" /> : metricsData.activeToday.value.toLocaleString()}
          </div>
          <div className="cc-card-footer">
            <span className={`cc-trend-tag ${metricsData.activeToday.trend}`}>
              <Activity size={12} /> Live today
            </span>
            <span className="cc-card-subtext">Active past 24 hrs</span>
          </div>
        </div>

        {/* Card 3: Website Visitors */}
        <div className="cc-kpi-card blue">
          <div className="cc-card-header">
            <span className="cc-card-label">WEBSITE VISITORS</span>
            <div className="cc-card-icon blue">
              <Globe size={18} />
            </div>
          </div>
          <div className="cc-card-value">
            {loading ? <span className="cc-shimmer" /> : metricsData.totalVisitors.value.toLocaleString()}
          </div>
          <div className="cc-card-footer">
            <span className={`cc-trend-tag ${metricsData.totalVisitors.trend}`}>
              {renderTrendIcon(metricsData.totalVisitors.trend)}
              {metricsData.totalVisitors.change > 0 ? `+${metricsData.totalVisitors.change}%` : `${metricsData.totalVisitors.change}%`}
            </span>
            <span className="cc-card-subtext">Unique portal hits</span>
          </div>
        </div>

        {/* Card 4: New Students */}
        <div className="cc-kpi-card cyan">
          <div className="cc-card-header">
            <span className="cc-card-label">NEW STUDENTS</span>
            <div className="cc-card-icon cyan">
              <UserPlus size={18} />
            </div>
          </div>
          <div className="cc-card-value">
            {loading ? <span className="cc-shimmer" /> : metricsData.newStudents.value.toLocaleString()}
          </div>
          <div className="cc-card-footer">
            <span className={`cc-trend-tag ${metricsData.newStudents.trend}`}>
              {renderTrendIcon(metricsData.newStudents.trend)}
              {metricsData.newStudents.change > 0 ? `+${metricsData.newStudents.change}%` : `${metricsData.newStudents.change}%`}
            </span>
            <span className="cc-card-subtext">Recent registrations</span>
          </div>
        </div>

        {/* Card 5: Active Subscriptions */}
        <div className="cc-kpi-card amber">
          <div className="cc-card-header">
            <span className="cc-card-label">ACTIVE SUBSCRIPTIONS</span>
            <div className="cc-card-icon amber">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="cc-card-value">
            {loading ? <span className="cc-shimmer" /> : metricsData.paidSubscribers.value.toLocaleString()}
          </div>
          <div className="cc-card-footer">
            <span className={`cc-trend-tag ${metricsData.paidSubscribers.trend}`}>
              {renderTrendIcon(metricsData.paidSubscribers.trend)}
              {metricsData.paidSubscribers.change > 0 ? `+${metricsData.paidSubscribers.change}%` : `${metricsData.paidSubscribers.change}%`}
            </span>
            <span className="cc-card-subtext">Pro & Passes active</span>
          </div>
        </div>

        {/* Card 6: Total Questions */}
        <div className="cc-kpi-card gold">
          <div className="cc-card-header">
            <span className="cc-card-label">TOTAL QUESTIONS</span>
            <div className="cc-card-icon gold">
              <Database size={18} />
            </div>
          </div>
          <div className="cc-card-value">
            {counts.questions.toLocaleString()}
          </div>
          <div className="cc-card-footer">
            <span className="cc-trend-tag neutral">
              Verified DB
            </span>
            <span className="cc-card-subtext">Staged & Published MCQs</span>
          </div>
        </div>
      </section>

      {/* 4. Control Hub & Fast Dispatch Section */}
      <section className="cc-tiles-section" aria-label="Quick Hub Navigation">
        <div className="cc-tiles-section-header">
          <h2 className="cc-tiles-title">Control Hub & Fast Dispatch</h2>
          <p className="cc-tiles-subtitle">
            Direct access to content authoring, textbook indexing, Tamil Nadu geographic analytics, and cloud sync.
          </p>
        </div>

        <div className="cc-tiles-grid">
          {/* Tile 1: Question Bank */}
          <button
            type="button"
            className="cc-tile-btn"
            onClick={() => navigate('/admin/question-bank')}
          >
            <div className="cc-tile-icon-box">
              <Database size={20} />
            </div>
            <div className="cc-tile-info">
              <span className="cc-tile-heading">Question Bank</span>
              <span className="cc-tile-desc">{counts.questions.toLocaleString()} Verified Samacheer MCQs</span>
            </div>
            <ArrowRight size={16} className="cc-tile-arrow" />
          </button>

          {/* Tile 2: Textbook Management */}
          <button
            type="button"
            className="cc-tile-btn"
            onClick={() => navigate('/admin/textbook-management')}
          >
            <div className="cc-tile-icon-box">
              <BookOpen size={20} />
            </div>
            <div className="cc-tile-info">
              <span className="cc-tile-heading">Textbook Management</span>
              <span className="cc-tile-desc">{counts.textbooks} Samacheer Kalvi textbooks</span>
            </div>
            <ArrowRight size={16} className="cc-tile-arrow" />
          </button>

          {/* Tile 3: Study Notes */}
          <button
            type="button"
            className="cc-tile-btn"
            onClick={() => navigate('/admin/study-notes')}
          >
            <div className="cc-tile-icon-box">
              <FileText size={20} />
            </div>
            <div className="cc-tile-info">
              <span className="cc-tile-heading">Study Notes</span>
              <span className="cc-tile-desc">{counts.notes} Syllabus study summaries</span>
            </div>
            <ArrowRight size={16} className="cc-tile-arrow" />
          </button>

          {/* Tile 4: Tamil Nadu Heatmap */}
          <button
            type="button"
            className="cc-tile-btn"
            onClick={() => navigate('/admin/analytics/tamil-nadu-map')}
          >
            <div className="cc-tile-icon-box">
              <MapPin size={20} />
            </div>
            <div className="cc-tile-info">
              <span className="cc-tile-heading">Tamil Nadu Map</span>
              <span className="cc-tile-desc">38-District student distribution & rankings</span>
            </div>
            <ArrowRight size={16} className="cc-tile-arrow" />
          </button>

          {/* Tile 5: Live Traffic & Web Monitor */}
          <button
            type="button"
            className="cc-tile-btn"
            onClick={() => navigate('/admin/analytics/live-monitor')}
          >
            <div className="cc-tile-icon-box">
              <Activity size={20} />
            </div>
            <div className="cc-tile-info">
              <span className="cc-tile-heading">Live Monitor</span>
              <span className="cc-tile-desc">Real-time visitor pulse and active learners</span>
            </div>
            <ArrowRight size={16} className="cc-tile-arrow" />
          </button>

          {/* Tile 6: Traffic & Web */}
          <button
            type="button"
            className="cc-tile-btn"
            onClick={() => navigate('/admin/analytics/traffic')}
          >
            <div className="cc-tile-icon-box">
              <Globe size={20} />
            </div>
            <div className="cc-tile-info">
              <span className="cc-tile-heading">Traffic & Web</span>
              <span className="cc-tile-desc">Device analytics, browsers, and top visited pages</span>
            </div>
            <ArrowRight size={16} className="cc-tile-arrow" />
          </button>

          {/* Tile 7: Google Drive */}
          <button
            type="button"
            className="cc-tile-btn"
            onClick={() => navigate('/admin/google-drive')}
          >
            <div className="cc-tile-icon-box">
              <Cloud size={20} />
            </div>
            <div className="cc-tile-info">
              <span className="cc-tile-heading">Google Drive</span>
              <span className="cc-tile-desc">Cloud storage integration & PDF sync</span>
            </div>
            <ArrowRight size={16} className="cc-tile-arrow" />
          </button>

          {/* Tile 8: AI Private Hub */}
          <button
            type="button"
            className="cc-tile-btn"
            onClick={() => navigate('/admin/ai-private-hub')}
          >
            <div className="cc-tile-icon-box">
              <Cpu size={20} />
            </div>
            <div className="cc-tile-info">
              <span className="cc-tile-heading">AI Private Hub</span>
              <span className="cc-tile-desc">Independent Claude AI & Gemini AI orchestrator</span>
            </div>
            <ArrowRight size={16} className="cc-tile-arrow" />
          </button>

          {/* Tile 9: Student Dashboard View */}
          <button
            type="button"
            className="cc-tile-btn"
            onClick={() => {
              if (onOpenStudentPreview) {
                onOpenStudentPreview();
              } else {
                navigate('/admin/dashboard-view');
              }
            }}
          >
            <div className="cc-tile-icon-box">
              <Eye size={20} />
            </div>
            <div className="cc-tile-info">
              <span className="cc-tile-heading">Student Preview</span>
              <span className="cc-tile-desc">Interactive student simulation mode</span>
            </div>
            <ArrowRight size={16} className="cc-tile-arrow" />
          </button>
        </div>
      </section>
    </div>
  );
};
