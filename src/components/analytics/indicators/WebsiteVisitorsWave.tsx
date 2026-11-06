import React from 'react';
import { Globe, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnimatedCountUp } from '../AnimatedCountUp';

interface WebsiteVisitorsWaveProps {
  totalVisitors: number;
  dailyVisitors: number;
  weeklyVisitors: number;
  monthlyVisitors: number;
  trend: 'up' | 'down' | 'neutral';
  change: number;
  comparisonText?: string;
  sparkline?: number[];
  onClick?: () => void;
}

export const WebsiteVisitorsWave: React.FC<WebsiteVisitorsWaveProps> = ({
  totalVisitors,
  dailyVisitors,
  weeklyVisitors,
  monthlyVisitors,
  trend,
  change,
  comparisonText = 'vs previous 7 days',
  sparkline = [12, 18, 14, 22, 28, 25, 32],
  onClick,
}) => {
  // Generate smooth cubic wave path for SVG
  const width = 280;
  const height = 54;
  const points = sparkline.length > 0 ? sparkline : [10, 15, 12, 20, 24, 22, 30];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * (width - 12) + 6;
    const y = height - ((val - min) / range) * (height - 14) - 6;
    return { x, y };
  });

  // Build cubic Bezier wave line
  let linePath = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const current = coords[i];
    const next = coords[i + 1];
    const controlX = (current.x + next.x) / 2;
    linePath += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

  return (
    <div
      className="futuristic-indicator-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      title="Click to inspect Traffic Analytics"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onClick) onClick();
      }}
    >
      <div className="card-ambient-glow" style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }} />

      {/* Header */}
      <div className="fic-header">
        <div className="fic-title-group">
          <span className="fic-title">Website Visitors</span>
          <div className="wave-beacon">
            <span className="wave-pulse-dot" />
            <span>Web Traffic</span>
          </div>
        </div>
        <div className="fic-icon-badge" style={{ background: 'rgba(6, 182, 212, 0.15)', borderColor: 'rgba(6, 182, 212, 0.35)', color: '#22d3ee' }}>
          <Globe size={19} />
        </div>
      </div>

      {/* Body: Area Wave Graph */}
      <div className="wave-indicator-body">
        <div className="wave-header-metrics">
          <div className="wave-main-val">
            <AnimatedCountUp end={totalVisitors} />
          </div>
          <span className={`fic-trend-pill ${trend}`} title={comparisonText}>
            {trend === 'up' && <TrendingUp size={12} />}
            {trend === 'down' && <TrendingDown size={12} />}
            {trend === 'neutral' && <Minus size={12} />}
            <span>{change > 0 ? `+${change}%` : `${change}%`}</span>
          </span>
        </div>

        {/* SVG Wave */}
        <div className="wave-svg-container">
          <svg className="wave-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="waveAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={areaPath} className="wave-path-area" />
            <path d={linePath} className="wave-path-line" />
          </svg>
        </div>
      </div>

      {/* Footer: Daily, Weekly, Monthly Stats */}
      <div className="fic-footer">
        <div className="fic-footer-stat">
          <span className="fic-footer-label">Today</span>
          <span className="fic-footer-val">{dailyVisitors}</span>
        </div>
        <div className="fic-footer-stat">
          <span className="fic-footer-label">7 Days</span>
          <span className="fic-footer-val">{weeklyVisitors}</span>
        </div>
        <div className="fic-footer-stat">
          <span className="fic-footer-label">30 Days</span>
          <span className="fic-footer-val">{monthlyVisitors}</span>
        </div>
      </div>
    </div>
  );
};
