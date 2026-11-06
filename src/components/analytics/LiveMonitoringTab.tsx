import React from 'react';
import {
  Users,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  Clock,
  Sparkles,
  RefreshCw,
  Eye,
  Globe,
  Radio,
  Share2,
} from 'lucide-react';
import './LiveMonitoringTab.css';

interface LiveMonitoringTabProps {
  liveData: {
    activeVisitors: number;
    activeStudents: number;
    pageViewsToday?: number;
    sessionsToday?: number;
    deviceBreakdown: {
      desktop: number;
      mobile: number;
      tablet: number;
    };
    mostVisitedPages?: { path: string; views: number; visitors: number }[];
    trafficSources?: { source: string; count: number }[];
    visitorTrends?: { time: string; pageViews: number; visitors: number }[];
    activityStream: {
      id: number;
      sessionId: string;
      pagePath: string;
      pageTitle: string;
      district: string;
      city: string;
      deviceCategory: string;
      browser: string;
      isReturning: boolean;
      studentName: string | null;
      timestamp: string;
    }[];
  };
  onRefresh: () => void;
  isRefreshing?: boolean;
}

function formatTimeAgo(dateStr: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    const min = Math.floor(diff / 60);
    if (min < 60) return `${min}m ago`;
    const hrs = Math.floor(min / 60);
    return `${hrs}h ago`;
  } catch {
    return 'Recently';
  }
}

export const LiveMonitoringTab: React.FC<LiveMonitoringTabProps> = ({
  liveData,
  onRefresh,
  isRefreshing = false,
}) => {
  const {
    activeVisitors,
    activeStudents,
    pageViewsToday = 0,
    sessionsToday = 0,
    deviceBreakdown,
    mostVisitedPages = [],
    trafficSources = [],
    visitorTrends = [],
    activityStream,
  } = liveData;

  const totalDevices =
    (deviceBreakdown.desktop || 0) +
    (deviceBreakdown.mobile || 0) +
    (deviceBreakdown.tablet || 0) || 1;
  const desktopPct = Math.round(((deviceBreakdown.desktop || 0) / totalDevices) * 100);
  const mobilePct = Math.round(((deviceBreakdown.mobile || 0) / totalDevices) * 100);
  const tabletPct = Math.round(((deviceBreakdown.tablet || 0) / totalDevices) * 100);

  const totalSourcesCount = trafficSources.reduce((acc, s) => acc + s.count, 0) || 1;

  return (
    <div className="live-monitoring-container">
      {/* Real-time Status Banner */}
      <div className="live-status-banner glass">
        <div className="live-status-info">
          <div className="live-pulse-indicator">
            <span className="live-radar-ring" />
            <span className="live-radar-dot" />
          </div>
          <div>
            <h3 className="live-banner-title">Live Website Visitor Monitor</h3>
            <p className="live-banner-subtitle">
              Real-time traffic heartbeat, page views today, and active candidate sessions
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className={`live-refresh-button ${isRefreshing ? 'refreshing' : ''}`}
          title="Refresh Live Data"
        >
          <RefreshCw size={15} />
          <span>Sync Now</span>
        </button>
      </div>

      {/* 4 Core Real-Time Metric Cards */}
      <div className="live-cards-grid">
        {/* Card 1: Active Concurrent Visitors */}
        <div className="live-kpi-card glass active-visitors-glow">
          <div className="live-kpi-header">
            <span className="live-kpi-label">Current Visitors</span>
            <span className="live-tag">5m Heartbeat</span>
          </div>
          <div className="live-kpi-val-row">
            <span className="live-huge-num">{activeVisitors}</span>
            <div className="live-sparkle-box">
              <Sparkles size={20} className="sparkle-pulse" />
            </div>
          </div>
          <p className="live-kpi-caption">Active users navigating study hub now</p>
        </div>

        {/* Card 2: Active Authenticated Students */}
        <div className="live-kpi-card glass active-students-glow">
          <div className="live-kpi-header">
            <span className="live-kpi-label">Active Students</span>
            <span className="live-tag student-tag">Authenticated</span>
          </div>
          <div className="live-kpi-val-row">
            <span className="live-huge-num cyan-text">{activeStudents}</span>
            <Users size={24} className="cyan-icon" />
          </div>
          <p className="live-kpi-caption">Practicing MCQs, reading notes, or taking tests</p>
        </div>

        {/* Card 3: Page Views Today */}
        <div className="live-kpi-card glass views-today-glow">
          <div className="live-kpi-header">
            <span className="live-kpi-label">Page Views Today</span>
            <span className="live-tag">Today</span>
          </div>
          <div className="live-kpi-val-row">
            <span className="live-huge-num indigo-text">{pageViewsToday.toLocaleString('en-IN')}</span>
            <Eye size={24} className="indigo-icon" />
          </div>
          <p className="live-kpi-caption">Total page hits logged since 12:00 AM</p>
        </div>

        {/* Card 4: Sessions Today */}
        <div className="live-kpi-card glass sessions-today-glow">
          <div className="live-kpi-header">
            <span className="live-kpi-label">Sessions Today</span>
            <span className="live-tag">Today</span>
          </div>
          <div className="live-kpi-val-row">
            <span className="live-huge-num amber-text">{sessionsToday.toLocaleString('en-IN')}</span>
            <Radio size={24} className="amber-icon" />
          </div>
          <p className="live-kpi-caption">Unique visitor sessions initiated today</p>
        </div>
      </div>

      {/* Middle Grid: Device Split, Most Visited Pages & Traffic Sources */}
      <div className="live-analytics-mid-grid">
        {/* Device Distribution */}
        <div className="live-sub-card glass">
          <div className="sub-card-header">
            <Monitor size={16} className="sub-header-icon" />
            <h4 className="sub-card-title">Device Distribution</h4>
          </div>

          <div className="device-progress-bars">
            <div className="device-bar-row">
              <div className="dev-name">
                <Monitor size={14} /> <span>Desktop</span>
              </div>
              <span className="dev-pct">{desktopPct}% ({deviceBreakdown.desktop})</span>
            </div>
            <div className="device-progress-track">
              <div className="device-progress-fill desktop" style={{ width: `${desktopPct}%` }} />
            </div>

            <div className="device-bar-row" style={{ marginTop: '0.75rem' }}>
              <div className="dev-name">
                <Smartphone size={14} /> <span>Mobile</span>
              </div>
              <span className="dev-pct">{mobilePct}% ({deviceBreakdown.mobile})</span>
            </div>
            <div className="device-progress-track">
              <div className="device-progress-fill mobile" style={{ width: `${mobilePct}%` }} />
            </div>

            <div className="device-bar-row" style={{ marginTop: '0.75rem' }}>
              <div className="dev-name">
                <Tablet size={14} /> <span>Tablet</span>
              </div>
              <span className="dev-pct">{tabletPct}% ({deviceBreakdown.tablet})</span>
            </div>
            <div className="device-progress-track">
              <div className="device-progress-fill tablet" style={{ width: `${tabletPct}%` }} />
            </div>
          </div>
        </div>

        {/* Most Visited Pages */}
        <div className="live-sub-card glass">
          <div className="sub-card-header">
            <Globe size={16} className="sub-header-icon" />
            <h4 className="sub-card-title">Most Visited Pages Today</h4>
          </div>

          <div className="top-pages-list">
            {mostVisitedPages.length === 0 ? (
              <div className="sub-empty-hint">Tracking page hits in real time...</div>
            ) : (
              mostVisitedPages.map((pg, idx) => (
                <div key={pg.path} className="top-page-row">
                  <span className="top-page-idx">{idx + 1}</span>
                  <span className="top-page-path" title={pg.path}>
                    {pg.path}
                  </span>
                  <div className="top-page-stats">
                    <span className="page-views-val">{pg.views} views</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Traffic Sources */}
        <div className="live-sub-card glass">
          <div className="sub-card-header">
            <Share2 size={16} className="sub-header-icon" />
            <h4 className="sub-card-title">Traffic Sources</h4>
          </div>

          <div className="sources-list">
            {trafficSources.length === 0 ? (
              <div className="sub-empty-hint">Direct & Organic traffic active...</div>
            ) : (
              trafficSources.map((src) => {
                const pct = Math.round((src.count / totalSourcesCount) * 100);
                return (
                  <div key={src.source} className="source-row">
                    <div className="source-row-top">
                      <span className="source-name">{src.source}</span>
                      <span className="source-count">{src.count} ({pct}%)</span>
                    </div>
                    <div className="source-track">
                      <div className="source-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
            {visitorTrends.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#64748b' }}>
                Active intervals today: {visitorTrends.map((t) => t.time).join(', ')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Activity Stream Table */}
      <div className="live-stream-panel glass">
        <div className="stream-header">
          <div>
            <h4 className="stream-title">Real-Time Activity Stream</h4>
            <p className="stream-subtitle">Live page views, navigation paths, and geographic district origin</p>
          </div>
          <span className="stream-count-badge">{activityStream.length} Events Logged</span>
        </div>

        <div className="stream-table-wrapper">
          <table className="live-stream-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Page Path & Title</th>
                <th>Visitor Origin</th>
                <th>Device & Browser</th>
                <th>User Type</th>
              </tr>
            </thead>
            <tbody>
              {activityStream.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-stream-cell">
                    Listening for incoming visitor traffic...
                  </td>
                </tr>
              ) : (
                activityStream.map((event) => (
                  <tr key={event.id} className="stream-row">
                    <td className="time-cell">
                      <Clock size={12} className="time-clock-icon" />
                      <span>{formatTimeAgo(event.timestamp)}</span>
                    </td>
                    <td className="path-cell">
                      <div className="page-path-text">{event.pagePath}</div>
                      <div className="page-title-text">{event.pageTitle}</div>
                    </td>
                    <td className="location-cell">
                      <div className="loc-district">
                        <MapPin size={13} className="loc-pin" />
                        <span>{event.district || 'Chennai'}</span>
                      </div>
                      <div className="loc-city">{event.city || 'Central'}</div>
                    </td>
                    <td className="device-cell">
                      <span className="device-pill">
                        {event.deviceCategory === 'mobile' ? (
                          <Smartphone size={12} />
                        ) : event.deviceCategory === 'tablet' ? (
                          <Tablet size={12} />
                        ) : (
                          <Monitor size={12} />
                        )}
                        <span>{event.deviceCategory}</span>
                      </span>
                      <span className="browser-sub">{event.browser}</span>
                    </td>
                    <td className="usertype-cell">
                      {event.studentName ? (
                        <span className="student-badge-pill">
                          <Users size={12} />
                          <span>{event.studentName}</span>
                        </span>
                      ) : event.isReturning ? (
                        <span className="returning-badge-pill">Returning</span>
                      ) : (
                        <span className="new-badge-pill">New Visitor</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
