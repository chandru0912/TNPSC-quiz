import React from 'react';
import { Award, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnimatedCountUp } from '../AnimatedCountUp';

interface McqAttemptsBarChartProps {
  totalAttempts: number;
  attemptsToday: number;
  attempts3d?: number;
  attemptsWeekly: number;
  attempts14d?: number;
  attemptsMonthly: number;
  participatingStudents: number;
  trend: 'up' | 'down' | 'neutral';
  change: number | null;
  comparisonText?: string;
  onClick?: () => void;
}

export const McqAttemptsBarChart: React.FC<McqAttemptsBarChartProps> = ({
  totalAttempts,
  attemptsToday,
  attempts3d = 0,
  attemptsWeekly,
  attempts14d = 0,
  attemptsMonthly,
  participatingStudents,
  trend,
  change,
  comparisonText = 'Insufficient historical data',
  onClick,
}) => {
  // Real PostgreSQL bucket counts only (zero fabricated multipliers or fake minimum bar heights)
  const maxVal = Math.max(attemptsToday, attempts3d, attemptsWeekly, attempts14d, attemptsMonthly, 1);
  const toHeight = (val: number) => (val <= 0 ? 0 : Math.max(6, Math.round((val / maxVal) * 100)));
  const bars = [
    { label: 'T', val: attemptsToday, height: toHeight(attemptsToday) },
    { label: '3d', val: attempts3d, height: toHeight(attempts3d) },
    { label: '7d', val: attemptsWeekly, height: toHeight(attemptsWeekly) },
    { label: '14d', val: attempts14d, height: toHeight(attempts14d) },
    { label: '30d', val: attemptsMonthly, height: toHeight(attemptsMonthly) },
  ];

  return (
    <div
      className="futuristic-indicator-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      title="Click to view MCQ Attempt analytics"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onClick) onClick();
      }}
    >
      <div className="card-ambient-glow" style={{ background: 'radial-gradient(circle, #eab308 0%, transparent 70%)' }} />

      {/* Header */}
      <div className="fic-header">
        <div className="fic-title-group">
          <span className="fic-title">Total MCQ Attempts</span>
          <span className="fic-subtitle">Student Practice Volume</span>
        </div>
        <div className="fic-icon-badge" style={{ background: 'rgba(234, 179, 8, 0.15)', borderColor: 'rgba(234, 179, 8, 0.35)', color: '#facc15' }}>
          <Award size={19} />
        </div>
      </div>

      {/* Body: Vertical Bar Chart + Main Num */}
      <div className="bar-indicator-body">
        <div className="bar-stats-col">
          <div className="bar-main-val">
            <AnimatedCountUp end={totalAttempts} />
          </div>
          <div className="gradient-subtext" style={{ color: '#fde047' }}>
            <Users size={12} />
            <span>{participatingStudents} Aspirants Active</span>
          </div>
        </div>

        {/* 5 Vertical Animated Bars */}
        <div className="bar-chart-visual" aria-label="MCQ practice distribution bars">
          {bars.map((bar, idx) => (
            <div key={idx} className="bar-col-item" title={`${bar.label}: ${bar.val} attempts`}>
              <div className="bar-fill-track">
                <div
                  className="bar-fill-column"
                  style={{ height: `${bar.height}%` }}
                />
              </div>
              <span className="bar-day-lbl">{bar.label}</span>
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
          <span>{change === null ? '—' : change > 0 ? `+${change}%` : `${change}%`}</span>
        </span>
        <span className="fic-footer-label">{comparisonText}</span>
      </div>
    </div>
  );
};

