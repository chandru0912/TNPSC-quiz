import React, { useState } from 'react';
import { CreditCard, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnimatedCountUp } from '../AnimatedCountUp';

interface SubscriptionsDonutProps {
  activeSubscriptions: number;
  expiredSubscriptions: number;
  monthlyPass: number;
  quarterlyPass: number;
  halfYearlyPass: number;
  yearlyPass: number;
  distribution: { name: string; count: number; percentage: number; color: string }[];
  trend: 'up' | 'down' | 'neutral';
  change: number;
  comparisonText?: string;
  onClick?: () => void;
}

export const SubscriptionsDonut: React.FC<SubscriptionsDonutProps> = ({
  activeSubscriptions,
  expiredSubscriptions,
  monthlyPass,
  quarterlyPass: _quarterlyPass,
  halfYearlyPass: _halfYearlyPass,
  yearlyPass,
  distribution,
  trend,
  change,
  comparisonText = 'vs previous period',
  onClick,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Fallback distribution if none provided
  const items = distribution.length > 0 ? distribution : [
    { name: 'Monthly', count: monthlyPass, percentage: 20, color: '#3b82f6' },
    { name: 'Yearly', count: yearlyPass, percentage: 65, color: '#10b981' },
    { name: 'Expired', count: expiredSubscriptions, percentage: 15, color: '#64748b' },
  ];

  const totalCount = items.reduce((acc, item) => acc + item.count, 0) || 1;
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76

  // Calculate cumulative stroke dash arrays
  let accumulatedPercent = 0;
  const slices = items.map((item, idx) => {
    const fraction = item.count / totalCount;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += fraction;

    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
      idx,
    };
  });

  return (
    <div
      className="futuristic-indicator-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      title="Click to view Subscription Analytics"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onClick) onClick();
      }}
    >
      <div className="card-ambient-glow" style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />

      {/* Header */}
      <div className="fic-header">
        <div className="fic-title-group">
          <span className="fic-title">Active Subscriptions</span>
          <span className="fic-subtitle">Access Passes</span>
        </div>
        <div className="fic-icon-badge" style={{ background: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.35)', color: '#a78bfa' }}>
          <CreditCard size={19} />
        </div>
      </div>

      {/* Body: Donut + Legend */}
      <div className="donut-indicator-body">
        {/* SVG Donut */}
        <div className="donut-visual-wrap">
          <svg className="donut-svg" viewBox="0 0 96 96">
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth="11"
              fill="transparent"
            />
            {slices.map((slice) => (
              <circle
                key={slice.name}
                className="donut-segment"
                cx="48"
                cy="48"
                r={radius}
                stroke={slice.color}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(slice.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            ))}
          </svg>

          {/* Center Hole Readout */}
          <div className="donut-center-stat">
            <span className="donut-center-num">
              {hoveredIdx !== null ? (
                items[hoveredIdx]?.count
              ) : (
                <AnimatedCountUp end={activeSubscriptions} />
              )}
            </span>
            <span className="donut-center-label">
              {hoveredIdx !== null ? items[hoveredIdx]?.name.split(' ')[0] : 'Active'}
            </span>
          </div>
        </div>

        {/* Legend List */}
        <div className="donut-legend-list">
          {items.slice(0, 4).map((it, idx) => (
            <div
              key={it.name}
              className="donut-legend-item"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ opacity: hoveredIdx === null || hoveredIdx === idx ? 1 : 0.55 }}
            >
              <span className="donut-legend-bullet" style={{ background: it.color }} />
              <span className="donut-legend-name">{it.name}</span>
              <span className="donut-legend-val">{it.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="fic-footer">
        <span className={`fic-trend-pill ${trend}`}>
          {trend === 'up' && <TrendingUp size={12} />}
          {trend === 'down' && <TrendingDown size={12} />}
          {trend === 'neutral' && <Minus size={12} />}
          <span>{change > 0 ? `+${change}%` : `${change}%`}</span>
        </span>
        <span className="fic-footer-label">{comparisonText}</span>
      </div>
    </div>
  );
};

