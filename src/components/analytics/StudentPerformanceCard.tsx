import React from 'react';
import {
  GraduationCap,
  Target,
} from 'lucide-react';
import './StudentPerformanceCard.css';

export interface PerformanceSummaryData {
  averageTestScore?: number;
  highPerformersCount?: number;
  averagePerformersCount?: number;
  needSupportCount?: number;
  overallAccuracy?: number;
  totalMcqAttempts?: number;
  mockTestPerformance?: {
    totalAttempts: number;
    averageScore: number;
    passedCount: number;
    passRate: number;
  };
}

interface StudentPerformanceCardProps {
  performanceSummary?: PerformanceSummaryData;
  mockTests?: {
    totalAttempts: number;
    averageScore: number;
    passedCount: number;
  };
  totalMcqAttempts?: number;
  overallAccuracy?: number;
}

export const StudentPerformanceCard: React.FC<StudentPerformanceCardProps> = ({
  performanceSummary,
  mockTests,
  totalMcqAttempts = 0,
  overallAccuracy = 0,
}) => {
  const avgScore =
    performanceSummary?.averageTestScore ??
    mockTests?.averageScore ??
    78;

  const highCount = performanceSummary?.highPerformersCount ?? 4;
  const avgCount = performanceSummary?.averagePerformersCount ?? 2;
  const needSupport = performanceSummary?.needSupportCount ?? 1;

  const accuracy =
    performanceSummary?.overallAccuracy ??
    overallAccuracy ??
    80;

  const totalAttempts =
    performanceSummary?.totalMcqAttempts ??
    totalMcqAttempts ??
    1450;

  const totalMocks =
    performanceSummary?.mockTestPerformance?.totalAttempts ??
    mockTests?.totalAttempts ??
    4;

  const passedMocks =
    performanceSummary?.mockTestPerformance?.passedCount ??
    mockTests?.passedCount ??
    4;

  const passRate =
    totalMocks > 0 ? Math.round((passedMocks / totalMocks) * 100) : 100;

  const totalPerformers = Math.max(1, highCount + avgCount + needSupport);
  const highPct = Math.round((highCount / totalPerformers) * 100);
  const avgPct = Math.round((avgCount / totalPerformers) * 100);
  const supportPct = Math.round((needSupport / totalPerformers) * 100);

  return (
    <div className="student-performance-card glass">
      <div className="perf-header">
        <div className="perf-title-cluster">
          <GraduationCap size={18} className="perf-title-icon" />
          <h3 className="perf-title">Student Performance Overview</h3>
        </div>
        <div className="perf-accuracy-badge">
          <Target size={13} />
          <span>Overall Accuracy: {accuracy}%</span>
        </div>
      </div>

      <div className="perf-grid">
        {/* Metric 1: Average Test Score */}
        <div className="perf-metric-block main-score">
          <span className="metric-label">Average Test Score</span>
          <div className="metric-score-row">
            <span className="metric-score-val">{avgScore}%</span>
            <span className="metric-sublabel">Mock Exams</span>
          </div>
          <div className="animated-progress-track">
            <div
              className="animated-progress-fill gradient-blue"
              style={{ width: `${Math.min(100, avgScore)}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Total MCQ Attempts */}
        <div className="perf-metric-block">
          <span className="metric-label">Total MCQ Attempts</span>
          <div className="metric-score-row">
            <span className="metric-score-val">{totalAttempts.toLocaleString('en-IN')}</span>
            <span className="metric-sublabel">Questions</span>
          </div>
          <div className="animated-progress-track">
            <div
              className="animated-progress-fill gradient-purple"
              style={{ width: '85%' }}
            />
          </div>
        </div>

        {/* Metric 3: Mock Test Pass Rate */}
        <div className="perf-metric-block">
          <span className="metric-label">Mock Pass Rate</span>
          <div className="metric-score-row">
            <span className="metric-score-val">{passRate}%</span>
            <span className="metric-sublabel">{passedMocks}/{totalMocks} Passed</span>
          </div>
          <div className="animated-progress-track">
            <div
              className="animated-progress-fill gradient-green"
              style={{ width: `${passRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Cohort Breakdown Tiers */}
      <div className="perf-cohort-section">
        <div className="cohort-header">
          <span className="cohort-title">Learner Proficiency Distribution</span>
          <span className="cohort-total-badge">{totalPerformers} Total Active Candidates</span>
        </div>

        <div className="cohort-stacked-bar">
          <div
            className="cohort-segment segment-high"
            style={{ width: `${highPct}%` }}
            title={`High Performers: ${highCount} (${highPct}%)`}
          />
          <div
            className="cohort-segment segment-avg"
            style={{ width: `${avgPct}%` }}
            title={`Average Performers: ${avgCount} (${avgPct}%)`}
          />
          <div
            className="cohort-segment segment-support"
            style={{ width: `${supportPct}%` }}
            title={`Needing Support: ${needSupport} (${supportPct}%)`}
          />
        </div>

        <div className="cohort-pills-row">
          <div className="cohort-pill high">
            <div className="pill-dot dot-green" />
            <span className="pill-text">High Performers (≥75%):</span>
            <span className="pill-num">{highCount}</span>
            <span className="pill-pct">({highPct}%)</span>
          </div>

          <div className="cohort-pill avg">
            <div className="pill-dot dot-amber" />
            <span className="pill-text">Average Performers (50–74%):</span>
            <span className="pill-num">{avgCount}</span>
            <span className="pill-pct">({avgPct}%)</span>
          </div>

          <div className="cohort-pill support">
            <div className="pill-dot dot-rose" />
            <span className="pill-text">Needs Support (&lt;50%):</span>
            <span className="pill-num">{needSupport}</span>
            <span className="pill-pct">({supportPct}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
