import React from 'react';
import { SubjectAccuracyChart } from './SubjectAccuracyChart';
import './StudentPerformanceAnalytics.css';

interface StudyPerformanceTabProps {
  performanceData: {
    subjects: {
      subject: string;
      attempts: number;
      correct: number;
      accuracy: number;
    }[];
    mockTests: {
      totalAttempts: number;
      averageScore: number;
      passedCount: number;
    };
  };
  allowAnimations?: boolean;
}

export const StudyPerformanceTab: React.FC<StudyPerformanceTabProps> = ({
  performanceData,
  allowAnimations = true,
}) => {
  const { subjects, mockTests } = performanceData;

  const totalAttempts = subjects.reduce((acc, curr) => acc + curr.attempts, 0);
  const totalCorrect = subjects.reduce((acc, curr) => acc + curr.correct, 0);
  const overallAccuracy =
    totalAttempts > 0 ? ((totalCorrect / totalAttempts) * 100).toFixed(1) : '0.0';

  const passRate =
    mockTests.totalAttempts > 0
      ? Math.round((mockTests.passedCount / mockTests.totalAttempts) * 100)
      : 0;

  return (
    <div className="performance-tab-container">
      {/* 4 Performance KPI Cards */}
      <div className="kpi-12-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Total Questions Practiced</span>
            <div className="sub-badge purple">MCQs</div>
          </div>
          <div className="sub-val sp-tabular">{totalAttempts.toLocaleString('en-IN')}</div>
          <p className="sub-caption">Verified question attempts</p>
        </div>

        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Correct Answers</span>
            <div className="sub-badge green">Correct</div>
          </div>
          <div className="sub-val text-green sp-tabular">{totalCorrect.toLocaleString('en-IN')}</div>
          <p className="sub-caption">Successful first/retry attempts</p>
        </div>

        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Overall Accuracy</span>
            <div className="sub-badge cyan">Rate</div>
          </div>
          <div className="sub-val text-cyan sp-tabular">{overallAccuracy}%</div>
          <p className="sub-caption">Weighted cross-subject accuracy</p>
        </div>

        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Mock Test Pass Rate</span>
            <div className="sub-badge gold">Exams</div>
          </div>
          <div className="sub-val text-gold sp-tabular">{passRate}%</div>
          <p className="sub-caption">
            {mockTests.passedCount} of {mockTests.totalAttempts} scored &ge; 50%
          </p>
        </div>
      </div>

      {/* Main Subject Accuracy Horizontal Chart */}
      <div className="chart-panel-card glass" style={{ marginBottom: '1.5rem' }}>
        <div className="panel-card-header">
          <div>
            <h3 className="panel-card-title">Subject-Wise Student Accuracy (%)</h3>
            <p className="panel-card-subtitle">
              Performance benchmarks across TNPSC syllabus subjects (General Tamil, History, Polity, Aptitude, etc.)
            </p>
          </div>
        </div>
        <SubjectAccuracyChart data={subjects} allowAnimations={allowAnimations} />
      </div>

      {/* Detailed Subject Performance Matrix – Strictly Aligned */}
      <div className="chart-panel-card glass">
        <div className="panel-card-header">
          <div>
            <h3 className="panel-card-title">Detailed Subject Performance Matrix</h3>
            <p className="panel-card-subtitle">Volume of practice vs correctness per TNPSC paper subject</p>
          </div>
        </div>

        <div className="sp-table-scroll">
          <table className="sp-aligned-table sp-aligned-table--matrix">
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="sp-col-left">Subject</th>
                <th className="sp-col-center">Questions Attempted</th>
                <th className="sp-col-center">Correct Answers</th>
                <th className="sp-col-center">Incorrect Answers</th>
                <th className="sp-col-center">Accuracy</th>
                <th className="sp-col-center">Performance Level</th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-stream-cell">
                    No question attempts recorded for current filters.
                  </td>
                </tr>
              ) : (
                subjects.map((s) => {
                  const incorrect = Math.max(0, Number(s.attempts || 0) - Number(s.correct || 0));
                  const acc = Number(s.accuracy || 0);
                  const barTone = acc >= 60 ? 'is-high' : acc >= 45 ? 'is-med' : 'is-low';
                  return (
                    <tr key={s.subject}>
                      <td className="sp-col-left">
                        <strong className="subj-title">{s.subject}</strong>
                      </td>
                      <td className="sp-col-center sp-tabular">
                        {Number(s.attempts || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="sp-col-center sp-tabular text-green">
                        {Number(s.correct || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="sp-col-center sp-tabular sp-incorrect-val">
                        {incorrect.toLocaleString('en-IN')}
                      </td>
                      <td className="sp-col-center sp-tabular">
                        <div className="sp-accuracy-cell">
                          <strong className={acc >= 60 ? 'text-green' : acc >= 45 ? 'text-cyan' : 'text-gold'}>
                            {acc.toFixed(1)}%
                          </strong>
                          <div className="sp-accuracy-track" aria-hidden="true">
                            <div
                              className={`sp-accuracy-fill ${barTone}`}
                              style={{ width: `${Math.min(100, Math.max(0, acc))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="sp-col-center">
                        <span className={`grade-tag ${acc >= 75 ? 'excellent' : acc >= 55 ? 'good' : 'needs-work'}`}>
                          {acc >= 75 ? 'Excellent' : acc >= 55 ? 'Proficient' : 'Focus Area'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
