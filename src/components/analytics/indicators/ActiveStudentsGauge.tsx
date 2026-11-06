import React, { useEffect, useState } from 'react';
import { UserCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnimatedCountUp } from '../AnimatedCountUp';

interface ActiveStudentsGaugeProps {
  activeStudents: number;
  totalStudents: number;
  trend: 'up' | 'down' | 'neutral';
  change: number;
  comparisonText?: string;
  onClick?: () => void;
}

export const ActiveStudentsGauge: React.FC<ActiveStudentsGaugeProps> = ({
  activeStudents,
  totalStudents,
  trend,
  change,
  comparisonText = 'vs previous period',
  onClick,
}) => {
  const inactiveStudents = Math.max(0, totalStudents - activeStudents);
  const activePercent = totalStudents > 0 ? Math.min(100, Math.round((activeStudents / totalStudents) * 100)) : 0;

  // Semi-circle arc: radius 60, circumference = PI * 60 ~= 188.49
  const arcRadius = 60;
  const arcLength = Math.PI * arcRadius;
  const [arcOffset, setArcOffset] = useState<number>(arcLength);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const targetOffset = arcLength - (activePercent / 100) * arcLength;
    if (prefersReducedMotion) {
      setArcOffset(targetOffset);
      return;
    }

    const timer = setTimeout(() => {
      setArcOffset(targetOffset);
    }, 180);

    return () => clearTimeout(timer);
  }, [activePercent, arcLength]);

  return (
    <div
      className="futuristic-indicator-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      title="Click to view Active Student details"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onClick) onClick();
      }}
    >
      <div className="card-ambient-glow" style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }} />

      {/* Header */}
      <div className="fic-header">
        <div className="fic-title-group">
          <span className="fic-title">Active Students</span>
          <span className="fic-subtitle">Live Study Engagement</span>
        </div>
        <div className="fic-icon-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)', color: '#34d399' }}>
          <UserCheck size={19} />
        </div>
      </div>

      {/* Body: Radial Gauge */}
      <div className="gauge-indicator-body">
        <div className="gauge-svg-wrap">
          <svg className="gauge-svg" viewBox="0 0 160 90">
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0d9488" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            {/* Background Arc: 180 degrees */}
            <path
              d="M 20 80 A 60 60 0 0 1 140 80"
              className="gauge-track"
            />
            {/* Animated Progress Arc */}
            <path
              d="M 20 80 A 60 60 0 0 1 140 80"
              className="gauge-progress"
              stroke="url(#gaugeGrad)"
              strokeDasharray={arcLength}
              strokeDashoffset={arcOffset}
            />
          </svg>

          {/* Central Readout */}
          <div className="gauge-center-readout">
            <span className="gauge-main-num">
              <AnimatedCountUp end={activeStudents} />
            </span>
            <span className="gauge-sub-label">{activePercent}% Ratio</span>
          </div>
        </div>

        {/* Ticks & Inactive stat */}
        <div className="gauge-ticks">
          <span className="gauge-tick-label">0%</span>
          <span className="gauge-tick-label" style={{ color: '#94a3b8' }}>
            {inactiveStudents} Inactive
          </span>
          <span className="gauge-tick-label">100%</span>
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

