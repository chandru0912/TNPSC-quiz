import React from 'react';
import { UserPlus, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnimatedCountUp } from '../AnimatedCountUp';

interface NewStudentsCounterProps {
  newStudents: number;
  newToday: number;
  newWeekly: number;
  newMonthly: number;
  trend: 'up' | 'down' | 'neutral';
  change: number;
  comparisonText?: string;
  onClick?: () => void;
}

export const NewStudentsCounter: React.FC<NewStudentsCounterProps> = ({
  newStudents,
  newToday,
  newWeekly,
  newMonthly,
  trend,
  change,
  comparisonText = 'vs previous 7 days',
  onClick,
}) => {
  return (
    <div
      className="futuristic-indicator-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      title="Click to view New Student registrations"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onClick) onClick();
      }}
    >
      <div className="card-ambient-glow" style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)' }} />

      {/* Header */}
      <div className="fic-header">
        <div className="fic-title-group">
          <span className="fic-title">New Students</span>
          <span className="fic-subtitle">Platform Growth</span>
        </div>
        <div className="fic-icon-badge" style={{ background: 'rgba(168, 85, 247, 0.15)', borderColor: 'rgba(168, 85, 247, 0.35)', color: '#c084fc' }}>
          <UserPlus size={19} />
        </div>
      </div>

      {/* Body: Animated Gradient Counter Hero */}
      <div className="gradient-counter-body">
        <div className="gradient-counter-hero">
          <div className="gradient-counter-val">
            <AnimatedCountUp end={newStudents} />
          </div>
          <div className="gradient-subtext">
            <Sparkles size={13} />
            <span>New Aspirants Enrolled</span>
          </div>
        </div>

        {/* Matrix sub-counters: Today, Weekly, Monthly */}
        <div className="gradient-matrix-grid">
          <div className="matrix-cell">
            <span className="matrix-cell-label">Today</span>
            <span className="matrix-cell-val">{newToday}</span>
          </div>
          <div className="matrix-cell">
            <span className="matrix-cell-label">This Week</span>
            <span className="matrix-cell-val">{newWeekly}</span>
          </div>
          <div className="matrix-cell">
            <span className="matrix-cell-label">This Month</span>
            <span className="matrix-cell-val">{newMonthly}</span>
          </div>
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

