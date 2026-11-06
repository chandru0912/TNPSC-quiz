import React from 'react';
import { SubjectAccuracyChart } from './SubjectAccuracyChart';

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
    totalAttempts > 0 ? ((totalCorrect / totalAttempts) * 100).toFixed(1) : '0';

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
          <div className="sub-val">{totalAttempts.toLocaleString('en-IN')}</div>
          <p className="sub-caption">Verified question attempts</p>
        </div>

        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Correct Answers</span>
            <div className="sub-badge green">Correct</div>
          </div>
          <div className="sub-val text-green">{totalCorrect.toLocaleString('en-IN')}</div>
          <p className="sub-caption">Successful first/retry attempts</p>
        </div>

        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Overall Accuracy</span>
            <div className="sub-badge cyan">Rate</div>
          </div>
          <div className="sub-val text-cyan">{overallAccuracy}%</div>
          <p className="sub-caption">Weighted cross-subject accuracy</p>
        </div>

        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Mock Test Pass Rate</span>
            <div className="sub-badge gold">Exams</div>
          </div>
          <div className="sub-val text-gold">{passRate}%</div>
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

      {/* Subject Breakdown Table */}
      <div className="chart-panel-card glass">
        <div className="panel-card-header">
          <div>
            <h3 className="panel-card-title">Detailed Subject Performance Matrix</h3>
            <p className="panel-card-subtitle">Volume of practice vs correctness per TNPSC paper subject</p>
          </div>
        </div>

        <div className="top-pages-table-wrapper">
          <table className="analytics-data-table">
            <thead>
              <tr>
                <th>Syllabus Subject</th>
                <th className="num-col">Total Practiced</th>
                <th className="num-col">Correct Count</th>
                <th className="num-col">Accuracy Rate</th>
                <th>Performance Grade</th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-stream-cell">
                    No question attempts recorded for current filters.
                  </td>
                </tr>
              ) : (
                subjects.map((s) => (
                  <tr key={s.subject}>
                    <td>
                      <strong className="subj-title">{s.subject}</strong>
                    </td>
                    <td className="num-col">{s.attempts.toLocaleString('en-IN')}</td>
                    <td className="num-col text-green">{s.correct.toLocaleString('en-IN')}</td>
                    <td className="num-col">
                      <strong className={s.accuracy >= 60 ? 'text-green' : s.accuracy >= 45 ? 'text-cyan' : 'text-gold'}>
                        {s.accuracy}%
                      </strong>
                    </td>
                    <td>
                      <span className={`grade-tag ${s.accuracy >= 75 ? 'excellent' : s.accuracy >= 55 ? 'good' : 'needs-work'}`}>
                        {s.accuracy >= 75 ? 'Excellent' : s.accuracy >= 55 ? 'Proficient' : 'Focus Area'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
