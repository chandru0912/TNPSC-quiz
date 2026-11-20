import React from 'react';
import { TrafficAreaChart } from './TrafficAreaChart';
import { DeviceBrowserPieChart } from './DeviceBrowserPieChart';
import { FileText, Globe, Monitor } from 'lucide-react';

interface TrafficAnalyticsTabProps {
  trafficData: {
    summary?: {
      totalSessions: number;
      uniqueVisitors: number;
      newVisitors: number;
      returningVisitors: number;
      authenticatedSessions: number;
      anonymousSessions: number;
      avgSessionDurationSeconds: number;
    };
    timeseries: { date: string; pageViews: number; uniqueVisitors: number }[];
    topPages: { path: string; views: number; uniqueViews: number }[];
    devices: { name: string; count: number }[];
    browsers: { name: string; count: number }[];
    operatingSystems?: { name: string; count: number }[];
    trafficSources?: { source: string; count: number }[];
  };
  allowAnimations?: boolean;
}

export const TrafficAnalyticsTab: React.FC<TrafficAnalyticsTabProps> = ({
  trafficData,
  allowAnimations = true,
}) => {
  const { summary, timeseries = [], topPages = [], devices = [], browsers = [], operatingSystems = [], trafficSources = [] } = trafficData;

  const totalPageViews = timeseries.reduce((acc, curr) => acc + curr.pageViews, 0);
  const totalUnique = summary?.uniqueVisitors ?? timeseries.reduce((acc, curr) => acc + curr.uniqueVisitors, 0);
  const viewsPerVisitor = totalUnique > 0 ? (totalPageViews / totalUnique).toFixed(1) : '0.0';
  const avgSec = summary?.avgSessionDurationSeconds ?? 0;
  const avgDurationFormatted = avgSec >= 60 ? `${Math.floor(avgSec / 60)}m ${avgSec % 60}s` : `${avgSec}s`;

  return (
    <div className="traffic-tab-container">
      {/* Top 3 Quick Stats */}
      <div className="traffic-stats-strip">
        <div className="traffic-stat-card glass">
          <span className="stat-label">Total Period Impressions</span>
          <strong className="stat-val">{totalPageViews.toLocaleString('en-IN')}</strong>
          <span className="stat-caption">All page views recorded</span>
        </div>
        <div className="traffic-stat-card glass">
          <span className="stat-label">Total Unique Visitors</span>
          <strong className="stat-val cyan-text">{totalUnique.toLocaleString('en-IN')}</strong>
          <span className="stat-caption">Distinct visitor devices</span>
        </div>
        <div className="traffic-stat-card glass">
          <span className="stat-label">Avg Views per Visitor</span>
          <strong className="stat-val purple-text">{viewsPerVisitor}</strong>
          <span className="stat-caption">
            Avg session: {avgDurationFormatted}
            {summary ? ` • ${summary.authenticatedSessions} auth / ${summary.anonymousSessions} anon` : ''}
          </span>
        </div>
      </div>

      {/* Main Timeseries Chart */}
      <div className="chart-panel-card glass" style={{ marginBottom: '1.5rem' }}>
        <div className="panel-card-header">
          <div>
            <h3 className="panel-card-title">Daily Visitor & Page View Dynamics</h3>
            <p className="panel-card-subtitle">Volume progression over selected time interval</p>
          </div>
        </div>
        <TrafficAreaChart data={timeseries} allowAnimations={allowAnimations} />
      </div>

      {/* Two Column Grid: Top Pages & Platform Breakdown */}
      <div className="traffic-grid-cols">
        {/* Top Pages Table */}
        <div className="chart-panel-card glass">
          <div className="panel-card-header">
            <div className="header-icon-title">
              <FileText size={18} className="panel-icon" />
              <div>
                <h3 className="panel-card-title">Top Visited Pages</h3>
                <p className="panel-card-subtitle">Highest engagement URLs and routes</p>
              </div>
            </div>
          </div>

          <div className="top-pages-table-wrapper">
            <table className="analytics-data-table">
              <thead>
                <tr>
                  <th>URL Path</th>
                  <th className="num-col">Total Views</th>
                  <th className="num-col">Unique</th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((p, idx) => (
                  <tr key={p.path}>
                    <td className="path-cell">
                      <span className="path-rank">#{idx + 1}</span>
                      <code className="path-code">{p.path}</code>
                    </td>
                    <td className="num-col">
                      <strong>{p.views.toLocaleString('en-IN')}</strong>
                    </td>
                    <td className="num-col text-muted">{p.uniqueViews.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Devices & Browsers */}
        <div className="chart-panel-card glass">
          <div className="panel-card-header">
            <div className="header-icon-title">
              <Monitor size={18} className="panel-icon" />
              <div>
                <h3 className="panel-card-title">Device & Browser Distribution</h3>
                <p className="panel-card-subtitle">Visitor technology & hardware breakdown</p>
              </div>
            </div>
          </div>

          <DeviceBrowserPieChart devices={devices} allowAnimations={allowAnimations} />

          {/* Browser Ranking list */}
          <div className="browser-rank-list">
            <h5 className="browser-title">Top Browsers</h5>
            {browsers.length === 0 ? (
              <div className="sub-empty-hint">No real browser data available yet.</div>
            ) : (
              browsers.map((b) => (
                <div key={b.name} className="browser-row">
                  <div className="browser-name-wrap">
                    <Globe size={13} className="globe-icon" />
                    <span>{b.name}</span>
                  </div>
                  <span className="browser-count">{b.count} visits</span>
                </div>
              ))
            )}
          </div>

          {operatingSystems.length > 0 && (
            <div className="browser-rank-list" style={{ marginTop: '1rem' }}>
              <h5 className="browser-title">Operating Systems</h5>
              {operatingSystems.map((o) => (
                <div key={o.name} className="browser-row">
                  <div className="browser-name-wrap">
                    <Monitor size={13} className="globe-icon" />
                    <span>{o.name}</span>
                  </div>
                  <span className="browser-count">{o.count} visits</span>
                </div>
              ))}
            </div>
          )}

          {trafficSources.length > 0 && (
            <div className="browser-rank-list" style={{ marginTop: '1rem' }}>
              <h5 className="browser-title">Traffic Sources</h5>
              {trafficSources.map((s) => (
                <div key={s.source} className="browser-row">
                  <div className="browser-name-wrap">
                    <Globe size={13} className="globe-icon" />
                    <span>{s.source}</span>
                  </div>
                  <span className="browser-count">{s.count} sessions</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
