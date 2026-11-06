import React from 'react';
import { RotateCcw, ShieldAlert, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnimatedCountUp } from '../AnimatedCountUp';

interface RestoredStudentsPulseProps {
  restoredCount: number;
  restored7d: number;
  prevRestored7d: number;
  deactivatedCount: number;
  trend: 'up' | 'down' | 'neutral';
  change: number;
  badgeText?: string;
  onClick?: () => void;
}

export const RestoredStudentsPulse: React.FC<RestoredStudentsPulseProps> = ({
  restoredCount,
  restored7d,
  prevRestored7d: _prevRestored7d,
  deactivatedCount,
  trend,
  change,
  badgeText,
  onClick,
}) => {
  return (
    <div
      className="futuristic-indicator-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      title="Click to view Restored Students management"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onClick) onClick();
      }}
    >
      <div className="card-ambient-glow" style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }} />

      {/* Header */}
      <div className="fic-header">
        <div className="fic-title-group">
          <span className="fic-title">Restored Students</span>
          <span className="fic-subtitle">Account Reactivations</span>
        </div>
        <div className="fic-icon-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.35)', color: '#fbbf24' }}>
          <RotateCcw size={19} />
        </div>
      </div>

      {/* Body: Animated Sonar / Radar Pulse Indicator */}
      <div className="pulse-indicator-body">
        <div className="pulse-radar-visual">
          <span className="radar-ring r1" />
          <span className="radar-ring r2" />
          <span className="radar-ring r3" />
          <div className="radar-center-core">
            <RotateCcw size={20} />
          </div>
        </div>

        <div className="pulse-content-col">
          <div className="pulse-main-val">
            <AnimatedCountUp end={restoredCount} />
          </div>

          <div className="pulse-status-badge">
            {deactivatedCount > 0 ? (
              <>
                <ShieldAlert size={13} style={{ color: '#f59e0b' }} />
                <span>{deactivatedCount} Deactivated</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={13} style={{ color: '#10b981' }} />
                <span>{badgeText || 'All Active'}</span>
              </>
            )}
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
        <span className="fic-footer-label">
          {restored7d > 0 ? `${restored7d} in past 7d` : 'No recent drops'}
        </span>
      </div>
    </div>
  );
};

