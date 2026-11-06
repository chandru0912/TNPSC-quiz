import React, { useEffect, useState } from 'react';
import { Target, Check, X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnimatedCountUp } from '../AnimatedCountUp';

interface OverallAccuracyGaugeProps {
  accuracy: number;
  correctAnswers: number;
  incorrectAnswers: number;
  averageScore?: number;
  trend: 'up' | 'down' | 'neutral';
  change: number;
  comparisonText?: string;
  onClick?: () => void;
}

export const OverallAccuracyGauge: React.FC<OverallAccuracyGaugeProps> = ({
  accuracy,
  correctAnswers,
  incorrectAnswers,
  averageScore,
  trend,
  change,
  comparisonText = 'accuracy across all tests',
  onClick,
}) => {
  // 270-degree radial gauge (radius 36)
  const radius = 36;
  const circumference = 2 * Math.PI * radius; // ~226.19
  const arcLength = circumference * 0.75; // 270 degrees = 75% of circle ~= 169.64
  const [arcOffset, setArcOffset] = useState<number>(arcLength);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const targetOffset = arcLength - (Math.min(100, accuracy) / 100) * arcLength;
    if (prefersReducedMotion) {
      setArcOffset(targetOffset);
      return;
    }

    const timer = setTimeout(() => {
      setArcOffset(targetOffset);
    }, 200);

    return () => clearTimeout(timer);
  }, [accuracy, arcLength]);

  return (
    <div
      className="futuristic-indicator-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      title="Click to view detailed Performance Analytics"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onClick) onClick();
      }}
    >
      <div className="card-ambient-glow" style={{ background: 'radial-gradient(circle, #14b8a6 0%, transparent 70%)' }} />

      {/* Header */}
      <div className="fic-header">
        <div className="fic-title-group">
          <span className="fic-title">Overall Accuracy</span>
          <span className="fic-subtitle">Platform Test Precision</span>
        </div>
        <div className="fic-icon-badge" style={{ background: 'rgba(20, 184, 166, 0.15)', borderColor: 'rgba(20, 184, 166, 0.35)', color: '#2dd4bf' }}>
          <Target size={19} />
        </div>
      </div>

      {/* Body: 270-Degree Radial Dial + Correct/Incorrect */}
      <div className="accuracy-indicator-body">
        <div className="accuracy-dial-wrap">
          <svg className="accuracy-svg" viewBox="0 0 96 96">
            <defs>
              <linearGradient id="accGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="45%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            <circle
              className="accuracy-track"
              cx="48"
              cy="48"
              r={radius}
              strokeDasharray={`${arcLength} ${circumference}`}
            />
            <circle
              className="accuracy-progress"
              cx="48"
              cy="48"
              r={radius}
              stroke="url(#accGrad)"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={arcOffset}
            />
          </svg>

          <div className="accuracy-center-label">
            <span className="accuracy-main-num">
              <AnimatedCountUp end={accuracy} decimals={1} suffix="%" />
            </span>
            <span className="accuracy-sub-tag">Score</span>
          </div>
        </div>

        {/* Breakdown Column */}
        <div className="accuracy-breakdown-col">
          <div className="accuracy-row-item">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Check size={13} style={{ color: '#10b981' }} />
              <span>Correct</span>
            </span>
            <span className="acc-val-pill correct">{correctAnswers}</span>
          </div>

          <div className="accuracy-row-item">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <X size={13} style={{ color: '#f43f5e' }} />
              <span>Incorrect</span>
            </span>
            <span className="acc-val-pill incorrect">{incorrectAnswers}</span>
          </div>

          {averageScore !== undefined && averageScore > 0 && (
            <div className="accuracy-row-item">
              <span>Avg Mock</span>
              <span className="acc-val-pill" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                {averageScore}%
              </span>
            </div>
          )}
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

