import React from 'react';
import { Database, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnimatedCountUp } from '../AnimatedCountUp';

interface TotalQuestionsSegmentedProps {
  totalQuestions: number;
  publishedQuestions: number;
  stagingQuestions: number;
  bySubject?: { subject: string; count: number }[];
  byGroup?: { group: string; count: number }[];
  trend: 'up' | 'down' | 'neutral';
  change: number;
  comparisonText?: string;
  onClick?: () => void;
}

export const TotalQuestionsSegmented: React.FC<TotalQuestionsSegmentedProps> = ({
  totalQuestions,
  publishedQuestions,
  stagingQuestions,
  bySubject = [],
  byGroup = [],
  trend,
  change,
  comparisonText = 'new questions in 7d',
  onClick,
}) => {
  // Generate 12 segmented LED blocks
  const totalBlocks = 12;
  const publishedRatio = totalQuestions > 0 ? publishedQuestions / totalQuestions : 0;
  const stagingRatio = totalQuestions > 0 ? stagingQuestions / totalQuestions : 0;

  const pubBlocksCount = Math.round(publishedRatio * totalBlocks);
  const stgBlocksCount = Math.round(stagingRatio * totalBlocks);

  return (
    <div
      className="futuristic-indicator-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      title="Click to manage Question Bank"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onClick) onClick();
      }}
    >
      <div className="card-ambient-glow" style={{ background: 'radial-gradient(circle, #f43f5e 0%, transparent 70%)' }} />

      {/* Header */}
      <div className="fic-header">
        <div className="fic-title-group">
          <span className="fic-title">Total Questions</span>
          <span className="fic-subtitle">Question Bank</span>
        </div>
        <div className="fic-icon-badge" style={{ background: 'rgba(244, 63, 94, 0.15)', borderColor: 'rgba(244, 63, 94, 0.35)', color: '#fb7185' }}>
          <Database size={19} />
        </div>
      </div>

      {/* Body: Segmented LED blocks & Hero count */}
      <div className="segmented-indicator-body">
        <div className="segmented-hero-row">
          <div className="segmented-main-num">
            <AnimatedCountUp end={totalQuestions} />
          </div>
          <span className="ring-mini-pill" style={{ borderColor: 'rgba(244, 63, 94, 0.3)', color: '#fecdd3' }}>
            {bySubject.length > 0 ? `${bySubject.length} Subjects` : 'Samacheer'}
          </span>
        </div>

        {/* 12-Segment LED bar */}
        <div className="segmented-bar-rack" aria-label="Questions status distribution">
          {Array.from({ length: totalBlocks }).map((_, idx) => {
            let blockClass = '';
            if (idx < pubBlocksCount) blockClass = 'active-published';
            else if (idx < pubBlocksCount + stgBlocksCount) blockClass = 'active-staging';

            return <span key={idx} className={`segmented-block ${blockClass}`} />;
          })}
        </div>

        {/* Ratio chips */}
        <div className="segmented-ratio-chips">
          <div className="ratio-chip">
            <span className="ratio-dot pub" />
            <span>{publishedQuestions} Published</span>
          </div>
          <div className="ratio-chip">
            <span className="ratio-dot stg" />
            <span>{stagingQuestions} Staging</span>
          </div>
          {byGroup.length > 0 && (
            <div className="ratio-chip">
              <span style={{ color: '#94a3b8' }}>{byGroup.length} Groups</span>
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

