import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnimatedCountUp } from '../AnimatedCountUp';

interface TotalStudentsRingProps {
  totalStudents: number;
  activeStudents: number;
  growthPercentage: number;
  trend: 'up' | 'down' | 'neutral';
  comparisonText?: string;
  onClick?: () => void;
}

export const TotalStudentsRing: React.FC<TotalStudentsRingProps> = ({
  totalStudents,
  activeStudents,
  growthPercentage,
  trend,
  comparisonText = 'vs previous period',
  onClick,
}) => {
  const [offset, setOffset] = useState<number>(251.2); // Circumference for r=40 is 2*PI*40 ~= 251.32
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76

  // Calculate active ratio percentage for the ring
  const activePercent = totalStudents > 0 ? Math.min(100, Math.round((activeStudents / totalStudents) * 100)) : 0;

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const targetOffset = circumference - (activePercent / 100) * circumference;
    if (prefersReducedMotion) {
      setOffset(targetOffset);
      return;
    }

    const timer = setTimeout(() => {
      setOffset(targetOffset);
    }, 150);

    return () => clearTimeout(timer);
  }, [activePercent, circumference]);

  return (
    <div
      className="futuristic-indicator-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      title="Click to view detailed Student Analytics"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onClick) onClick();
      }}
    >
      <div className="card-ambient-glow" style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />

      {/* Header */}
      <div className="fic-header">
        <div className="fic-title-group">
          <span className="fic-title">Total Students</span>
          <span className="fic-subtitle">Platform Learners</span>
        </div>
        <div className="fic-icon-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.35)', color: '#818cf8' }}>
          <Users size={19} />
        </div>
      </div>

      {/* Body: Ring + Primary Metrics */}
      <div className="ring-indicator-body">
        {/* SVG Circular Progress Ring */}
        <div className="ring-visual-wrap" aria-label={`Circular progress: ${activePercent}% active`}>
          <svg className="ring-svg" viewBox="0 0 96 96">
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
            {/* Track */}
            <circle
              className="ring-track"
              cx="48"
              cy="48"
              r={radius}
              strokeWidth="8"
              fill="transparent"
            />
            {/* Animated Progress Bar */}
            <circle
              className="ring-progress"
              cx="48"
              cy="48"
              r={radius}
              strokeWidth="8"
              stroke="url(#ringGrad)"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <div className="ring-center-content">
            <span className="ring-percent-num">{activePercent}%</span>
            <span className="ring-percent-label">Active</span>
          </div>
        </div>

        {/* Primary Count & Sub-metrics */}
        <div className="ring-metrics-col">
          <div className="ring-primary-count">
            <AnimatedCountUp end={totalStudents} />
            <span className="ring-unit-label">Registered</span>
          </div>

          <div className="ring-sub-pills">
            <span className="ring-mini-pill active-pill">
              {activeStudents} Active
            </span>
            <span className="ring-mini-pill">
              100% Verified
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fic-footer">
        <span className={`fic-trend-pill ${trend}`}>
          {trend === 'up' && <TrendingUp size={12} />}
          {trend === 'down' && <TrendingDown size={12} />}
          {trend === 'neutral' && <Minus size={12} />}
          <span>{growthPercentage > 0 ? `+${growthPercentage}%` : `${growthPercentage}%`}</span>
        </span>
        <span className="fic-footer-label">{comparisonText}</span>
      </div>
    </div>
  );
};

