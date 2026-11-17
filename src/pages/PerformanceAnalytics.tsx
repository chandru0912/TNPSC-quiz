import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Target,
  Trophy,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar,
  ChevronRight,
  Crown,
  FlaskConical,
  BookOpen,
  Compass,
  Landmark,
  Calculator,
  Clock,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useStudentAuth } from '../context/StudentAuthContext';
import { apiFetch, getApiUrl } from '../utils/api';
import { subscribeStudentSync } from '../utils/studentSync';
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker';
import './PerformanceAnalytics.css';

interface TrendPoint {
  id: number;
  attemptNumber: number;
  label: string;
  percentage: number;
  bestSoFar: number;
  correctAnswers: number;
  totalQuestions: number;
  completedAt: string;
}

interface SubjectRow {
  subject: string;
  firstAttempt: number;
  bestAttempt: number;
  latestAttempt: number;
  totalAttempts: number;
  improvement: number;
  testKeys: string[];
}

interface AttemptHistoryRow {
  id: number;
  testKey: string;
  testTitle: string;
  subject: string;
  attemptNumber: number;
  totalQuestions: number;
  attemptedQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unansweredQuestions: number;
  score: number;
  maxScore: number;
  percentage: number;
  timeTakenSeconds: number;
  completedAt: string;
  isBest: boolean;
}

interface PerformanceAnalyticsData {
  summary: {
    firstAttemptAverage: number;
    bestAttemptAverage: number;
    latestAttemptAverage: number;
    totalAttempts: number;
    overallImprovement: number;
    distinctTestsCount: number;
  };
  overallAccuracy: {
    percentage: number;
    correctAnswers: number;
    wrongAnswers: number;
    questionsAttempted: number;
    unansweredQuestions: number;
  };
  selectedTest: {
    testKey: string;
    testTitle: string;
    subject: string;
    firstAttempt: number;
    bestAttempt: number;
    latestAttempt: number;
    totalAttempts: number;
    improvement: number;
  } | null;
  trendSeries: TrendPoint[];
  subjectPerformance: SubjectRow[];
  attemptHistory: AttemptHistoryRow[];
  weakTopics: { topic: string; total: number; correct: number; accuracy: number }[];
  testsList: { testKey: string; testTitle: string; subject: string; totalAttempts: number; latestAttempt: number; bestAttempt: number }[];
  availableSubjects: string[];
}

interface AttemptReviewDetail {
  id: number;
  testName: string;
  groupTag: string;
  completedAt: string;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  marksObtained: number;
  maxMarks: number;
  accuracyPercentage: number;
  timeSpentSeconds: number;
  questionResponses: {
    questionText?: string;
    options?: string[];
    selectedOption: number | null;
    correctAnswer: number;
    isCorrect: boolean;
  }[];
}

const EMPTY_DATA: PerformanceAnalyticsData = {
  summary: {
    firstAttemptAverage: 0,
    bestAttemptAverage: 0,
    latestAttemptAverage: 0,
    totalAttempts: 0,
    overallImprovement: 0,
    distinctTestsCount: 0,
  },
  overallAccuracy: {
    percentage: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    questionsAttempted: 0,
    unansweredQuestions: 0,
  },
  selectedTest: null,
  trendSeries: [],
  subjectPerformance: [],
  attemptHistory: [],
  weakTopics: [],
  testsList: [],
  availableSubjects: [],
};

function getSubjectIcon(subject: string) {
  const s = subject.toLowerCase();
  if (s.includes('science')) return FlaskConical;
  if (s.includes('history')) return BookOpen;
  if (s.includes('geography')) return Compass;
  if (s.includes('polity')) return Landmark;
  if (s.includes('aptitude') || s.includes('mental')) return Calculator;
  return FileText;
}

function formatImprovement(val: number): string {
  const rounded = Math.round(val);
  return rounded >= 0 ? `+${rounded} pts` : `${rounded} pts`;
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export const PerformanceAnalytics: React.FC = () => {
  useStudyTimeTracker();
  const { student, token } = useStudentAuth();

  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [rangeFilter, setRangeFilter] = useState<string>('30d');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [selectedTestKey, setSelectedTestKey] = useState<string>('');
  const [activeRightTab, setActiveRightTab] = useState<'history' | 'analysis' | 'weak'>('history');

  const [data, setData] = useState<PerformanceAnalyticsData>(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewDetail, setReviewDetail] = useState<AttemptReviewDetail | null>(null);

  const fetchAnalytics = useCallback(
    async (silent = false) => {
      if (!token || token === 'preview_admin_token') {
        setIsLoading(false);
        return;
      }
      if (!silent) setIsLoading(true);
      try {
        const params = new URLSearchParams({
          group: groupFilter,
          subject: subjectFilter,
          range: rangeFilter,
        });
        if (rangeFilter === 'custom' && customFrom) params.set('from', customFrom);
        if (rangeFilter === 'custom' && customTo) params.set('to', customTo);
        if (selectedTestKey) params.set('testKey', selectedTestKey);

        const res = await apiFetch(`/api/student/performance-analytics?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!silent) setError(json?.message || 'Failed to load performance analytics.');
          return;
        }
        if (json?.data) {
          setData(json.data);
          setError(null);
        }
      } catch (err: any) {
        if (!silent) setError(err?.message || 'Unable to connect to server.');
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [token, groupFilter, subjectFilter, rangeFilter, customFrom, customTo, selectedTestKey]
  );

  // Reset on student switch + SSE real-time updates + 10s polling fallback
  useEffect(() => {
    setData(EMPTY_DATA);
    setReviewDetail(null);

    if (!token || token === 'preview_admin_token') {
      setIsLoading(false);
      return;
    }

    fetchAnalytics();

    let isDisposed = false;
    let sseConnected = false;
    const streamController = new AbortController();

    const connectSse = async () => {
      try {
        const res = await fetch(getApiUrl('/api/student/dashboard/stream'), {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          cache: 'no-store',
          signal: streamController.signal,
        });
        if (!res.ok || !res.body) {
          sseConnected = false;
          return;
        }
        sseConnected = true;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (!isDisposed) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          if (buf.includes('event: dashboard')) {
            buf = '';
            fetchAnalytics(true);
          }
        }
      } catch {
        // Fallback to 10s polling
      } finally {
        sseConnected = false;
      }
    };

    connectSse();

    const unsubSync = subscribeStudentSync(() => {
      if (!isDisposed) fetchAnalytics(true);
    });

    const pollId = setInterval(() => {
      if (!document.hidden && !sseConnected) {
        fetchAnalytics(true);
      }
    }, 10_000);

    return () => {
      isDisposed = true;
      streamController.abort();
      unsubSync();
      clearInterval(pollId);
    };
  }, [token, student?.id, fetchAnalytics]);

  const handleOpenAttemptReview = async (attemptId: number) => {
    if (!token) return;
    try {
      const res = await apiFetch(`/api/student/mark-list/${attemptId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data) setReviewDetail(json.data);
      }
    } catch (err) {
      console.warn('[PerformanceAnalytics] Failed to open attempt review:', err);
    }
  };

  // SVG Line Chart geometry
  const chartW = 540;
  const chartH = 175;
  const padL = 38;
  const padR = 26;
  const padT = 22;
  const padB = 26;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const pts = data.trendSeries;
  const getX = (idx: number) =>
    pts.length <= 1 ? padL + plotW / 2 : padL + (idx / (pts.length - 1)) * plotW;
  const getY = (pct: number) => padT + plotH - (Math.min(100, Math.max(0, pct)) / 100) * plotH;

  const scorePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.percentage).toFixed(1)}`)
    .join(' ');
  const bestPath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.bestSoFar).toFixed(1)}`)
    .join(' ');
  const areaPath =
    pts.length > 0
      ? `${scorePath} L ${getX(pts.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${getX(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : '';

  const ringRadius = 54;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const accPct = data.overallAccuracy.percentage;

  return (
    <div className="perf-analytics-page">
      {/* Header + Filter Controls */}
      <div className="perf-header">
        <div className="perf-header-left">
          <div className="perf-title-icon">
            <TrendingUp size={22} />
          </div>
          <div>
            <h1 className="perf-title">Student Performance Analytics</h1>
            <p className="perf-subtitle">
              Track your test attempts, improvement, and overall performance in one place.
            </p>
          </div>
        </div>

        <div className="perf-filters">
          <select
            className="perf-select"
            aria-label="Filter by exam group"
            value={groupFilter}
            onChange={(e) => {
              setGroupFilter(e.target.value);
              setSelectedTestKey('');
            }}
          >
            <option value="all">All Exam Groups</option>
            <option value="group1">TNPSC Group 1</option>
            <option value="group2">TNPSC Group 2</option>
            <option value="group2_2a">TNPSC Group 2 &amp; 2A</option>
            <option value="group4">TNPSC Group 4</option>
          </select>

          <select
            className="perf-select"
            aria-label="Filter by subject"
            value={subjectFilter}
            onChange={(e) => {
              setSubjectFilter(e.target.value);
              setSelectedTestKey('');
            }}
          >
            <option value="all">All Subjects</option>
            {data.availableSubjects.map((subj) => (
              <option key={subj} value={subj}>
                {subj}
              </option>
            ))}
          </select>

          <select
            className="perf-select"
            aria-label="Filter by date range"
            value={rangeFilter}
            onChange={(e) => setRangeFilter(e.target.value)}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
            <option value="custom">Custom Dates</option>
          </select>

          {rangeFilter === 'custom' && (
            <>
              <input
                type="date"
                className="perf-date-input"
                aria-label="From date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <input
                type="date"
                className="perf-date-input"
                aria-label="To date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.8rem 1rem',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.14)',
            border: '1px solid rgba(248, 113, 113, 0.35)',
            color: '#fecaca',
            fontSize: '0.85rem',
          }}
        >
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Row 1: 5 Summary Cards */}
      <div className="perf-kpi-grid">
        <motion.div className="perf-kpi-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="perf-kpi-icon rose">
            <Target size={20} />
          </div>
          <div>
            <div className="perf-kpi-label">First Attempt (Avg.)</div>
            <div className="perf-kpi-val perf-val-rose">{data.summary.firstAttemptAverage}%</div>
          </div>
        </motion.div>

        <motion.div className="perf-kpi-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <div className="perf-kpi-icon gold">
            <Trophy size={20} />
          </div>
          <div>
            <div className="perf-kpi-label">Best Attempt (Avg.)</div>
            <div className="perf-kpi-val perf-val-gold">{data.summary.bestAttemptAverage}%</div>
          </div>
        </motion.div>

        <motion.div className="perf-kpi-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <div className="perf-kpi-icon cyan">
            <BarChart3 size={20} />
          </div>
          <div>
            <div className="perf-kpi-label">Latest Attempt (Avg.)</div>
            <div className="perf-kpi-val perf-val-cyan">{data.summary.latestAttemptAverage}%</div>
          </div>
        </motion.div>

        <motion.div className="perf-kpi-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <div className="perf-kpi-icon purple">
            <RefreshCw size={20} />
          </div>
          <div>
            <div className="perf-kpi-label">Total Attempts</div>
            <div className="perf-kpi-val perf-val-purple">{data.summary.totalAttempts}</div>
          </div>
        </motion.div>

        <motion.div className="perf-kpi-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <div className="perf-kpi-icon emerald">
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="perf-kpi-label">Overall Improvement</div>
            <div className="perf-kpi-val perf-val-emerald">
              {formatImprovement(data.summary.overallImprovement)}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Row 2: Performance Trend Graph + Overall Accuracy */}
      <div className="perf-mid-grid">
        {/* Left: Performance Trend */}
        <section className="perf-panel">
          <div className="perf-panel-head">
            <h2 className="perf-panel-title">
              <TrendingUp size={18} style={{ color: '#a78bfa' }} />
              <span>Performance Trend</span>
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
              {data.testsList.length > 0 && (
                <select
                  className="perf-select"
                  aria-label="Select test for trend"
                  value={data.selectedTest?.testKey || ''}
                  onChange={(e) => setSelectedTestKey(e.target.value)}
                  style={{ padding: '0.32rem 0.65rem', fontSize: '0.76rem', maxWidth: '220px' }}
                >
                  {data.testsList.map((t) => (
                    <option key={t.testKey} value={t.testKey}>
                      {t.testTitle} ({t.totalAttempts})
                    </option>
                  ))}
                </select>
              )}
              <div className="perf-legend">
                <span className="perf-legend-item">
                  <span className="perf-legend-dot" style={{ background: '#a855f7' }} />
                  Test Score
                </span>
                <span className="perf-legend-item">
                  <span className="perf-legend-dot" style={{ background: '#34d399' }} />
                  Best Score
                </span>
              </div>
            </div>
          </div>

          <div className="perf-chart-wrap">
            {pts.length === 0 ? (
              <div className="perf-empty">
                {isLoading ? 'Loading performance trend...' : 'No completed test attempts yet in this period.'}
              </div>
            ) : (
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="perf-chart-svg">
                <defs>
                  <linearGradient id="perfAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {[0, 20, 40, 60, 80, 100].map((tick) => {
                  const y = getY(tick);
                  return (
                    <g key={tick}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={chartW - padR}
                        y2={y}
                        stroke="rgba(255,255,255,0.07)"
                        strokeWidth="1"
                      />
                      <text
                        x={padL - 8}
                        y={y + 4}
                        textAnchor="end"
                        fill="rgba(226,232,240,0.55)"
                        fontSize="10"
                      >
                        {tick}%
                      </text>
                    </g>
                  );
                })}

                {areaPath && <path d={areaPath} fill="url(#perfAreaGrad)" />}
                {bestPath && (
                  <path
                    d={bestPath}
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />
                )}
                {scorePath && (
                  <path d={scorePath} fill="none" stroke="#a855f7" strokeWidth="2.8" strokeLinecap="round" />
                )}

                {pts.map((p, idx) => {
                  const cx = getX(idx);
                  const cy = getY(p.percentage);
                  const isBest = data.selectedTest && p.percentage === data.selectedTest.bestAttempt;
                  return (
                    <g key={p.id}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isBest ? 6 : 4.5}
                        fill={isBest ? '#34d399' : '#c084fc'}
                        stroke="#0f172a"
                        strokeWidth="2"
                      />
                      <text
                        x={cx}
                        y={cy - 11}
                        textAnchor="middle"
                        fill={isBest ? '#34d399' : '#f8fafc'}
                        fontSize="11"
                        fontWeight="700"
                      >
                        {p.percentage}%
                      </text>
                      <text
                        x={cx}
                        y={chartH - 5}
                        textAnchor="middle"
                        fill="rgba(226,232,240,0.65)"
                        fontSize="10"
                      >
                        {p.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </section>

        {/* Right: Overall Accuracy */}
        <section className="perf-panel">
          <div className="perf-panel-head">
            <h2 className="perf-panel-title">
              <Target size={18} style={{ color: '#34d399' }} />
              <span>Overall Accuracy</span>
            </h2>
          </div>

          <div className="perf-accuracy-body">
            <div className="perf-ring-col">
              <div className="perf-ring-box">
                <svg viewBox="0 0 130 130" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <defs>
                    <linearGradient id="accRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="65"
                    cy="65"
                    r={ringRadius}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="65"
                    cy="65"
                    r={ringRadius}
                    fill="none"
                    stroke="url(#accRingGrad)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringCircumference - (accPct / 100) * ringCircumference}
                  />
                </svg>
                <div className="perf-ring-center">{accPct}%</div>
              </div>
              <span className="perf-ring-caption">Overall Accuracy</span>
            </div>

            <div className="perf-acc-rows">
              <div className="perf-acc-row">
                <span className="perf-acc-row-left">
                  <CheckCircle2 size={15} style={{ color: '#34d399' }} />
                  <span>Correct Answers</span>
                </span>
                <span className="perf-acc-row-val">{data.overallAccuracy.correctAnswers.toLocaleString()}</span>
              </div>
              <div className="perf-acc-row">
                <span className="perf-acc-row-left">
                  <XCircle size={15} style={{ color: '#fb7185' }} />
                  <span>Wrong Answers</span>
                </span>
                <span className="perf-acc-row-val">{data.overallAccuracy.wrongAnswers.toLocaleString()}</span>
              </div>
              <div className="perf-acc-row">
                <span className="perf-acc-row-left">
                  <FileText size={15} style={{ color: '#94a3b8' }} />
                  <span>Questions Attempted</span>
                </span>
                <span className="perf-acc-row-val">{data.overallAccuracy.questionsAttempted.toLocaleString()}</span>
              </div>
              <div className="perf-acc-row">
                <span className="perf-acc-row-left">
                  <Target size={15} style={{ color: '#fbbf24' }} />
                  <span>Unanswered</span>
                </span>
                <span className="perf-acc-row-val">{data.overallAccuracy.unansweredQuestions.toLocaleString()}</span>
              </div>
              <div className="perf-acc-row">
                <span className="perf-acc-row-left">
                  <TrendingUp size={15} style={{ color: '#34d399' }} />
                  <span>Accuracy</span>
                </span>
                <span className="perf-acc-row-val perf-val-emerald">{accPct}%</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Row 3: Subject-Wise Table + Individual Test Attempt History */}
      <div className="perf-bottom-grid">
        {/* Left: Subject-Wise Performance Table */}
        <section className="perf-panel">
          <div className="perf-panel-head">
            <h2 className="perf-panel-title">Test Performance – Subject Wise</h2>
          </div>

          <div className="perf-table-wrap">
            {data.subjectPerformance.length === 0 ? (
              <div className="perf-empty">
                Complete a Mock Test, Lesson Quiz, or Subject Drill to unlock subject-wise analytics.{' '}
                <Link to="/mock-tests" style={{ color: '#fbbf24', fontWeight: 600 }}>
                  Take a Test →
                </Link>
              </div>
            ) : (
              <table className="perf-table">
                <thead>
                  <tr>
                    <th>Test / Subject</th>
                    <th>First Attempt</th>
                    <th>Best Attempt</th>
                    <th>Latest Attempt</th>
                    <th>Attempts</th>
                    <th>Improvement</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.subjectPerformance.map((row) => {
                    const SubIcon = getSubjectIcon(row.subject);
                    const isActive = data.selectedTest?.subject === row.subject;
                    return (
                      <tr
                        key={row.subject}
                        className={isActive ? 'active' : ''}
                        onClick={() => {
                          if (row.testKeys[0]) setSelectedTestKey(row.testKeys[0]);
                        }}
                      >
                        <td>
                          <div className="perf-subject-cell">
                            <SubIcon size={16} style={{ color: '#38bdf8' }} />
                            <span>{row.subject}</span>
                          </div>
                        </td>
                        <td className="perf-val-rose" style={{ fontWeight: 700 }}>{row.firstAttempt}%</td>
                        <td className="perf-val-emerald" style={{ fontWeight: 700 }}>{row.bestAttempt}%</td>
                        <td className="perf-val-cyan" style={{ fontWeight: 700 }}>{row.latestAttempt}%</td>
                        <td>{row.totalAttempts}</td>
                        <td className="perf-val-emerald" style={{ fontWeight: 700 }}>
                          {formatImprovement(row.improvement)}
                        </td>
                        <td>
                          <ChevronRight size={15} style={{ opacity: 0.55 }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Right: Individual Test Attempt History */}
        <section className="perf-panel">
          <div className="perf-panel-head">
            <h2 className="perf-panel-title">
              <FlaskConical size={18} style={{ color: '#38bdf8' }} />
              <span>{data.selectedTest ? data.selectedTest.testTitle : 'Test Attempt History'}</span>
            </h2>
          </div>

          <div className="perf-tabs">
            <button
              type="button"
              className={`perf-tab-btn ${activeRightTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveRightTab('history')}
            >
              Attempt History
            </button>
            <button
              type="button"
              className={`perf-tab-btn ${activeRightTab === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveRightTab('analysis')}
            >
              Analysis
            </button>
            <button
              type="button"
              className={`perf-tab-btn ${activeRightTab === 'weak' ? 'active' : ''}`}
              onClick={() => setActiveRightTab('weak')}
            >
              Weak Topics
            </button>
          </div>

          {activeRightTab === 'history' && (
            <div className="perf-history-list">
              {data.attemptHistory.length === 0 ? (
                <div className="perf-empty">No attempt history for the selected test.</div>
              ) : (
                data.attemptHistory.map((att) => {
                  const pillClass = att.isBest ? 'best' : att.percentage >= 50 ? 'mid' : 'low';
                  return (
                    <div
                      key={att.id}
                      className="perf-attempt-row"
                      onClick={() => handleOpenAttemptReview(att.id)}
                    >
                      <div className="perf-attempt-left">
                        <Calendar size={16} style={{ color: 'rgba(226,232,240,0.55)' }} />
                        <div>
                          <div className="perf-attempt-title">Attempt {att.attemptNumber}</div>
                          <div className="perf-attempt-date">
                            {new Date(att.completedAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            • {formatDuration(att.timeTakenSeconds)}
                          </div>
                        </div>
                      </div>
                      <div className="perf-attempt-right">
                        <span className={`perf-score-pill ${pillClass}`}>{att.percentage}%</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                          {att.correctAnswers} / {att.totalQuestions}
                        </span>
                        {att.isBest && (
                          <span className="perf-best-badge">
                            <Crown size={11} /> Best
                          </span>
                        )}
                        <ChevronRight size={15} style={{ opacity: 0.55 }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeRightTab === 'analysis' && (
            <div className="perf-acc-rows">
              {data.selectedTest ? (
                <>
                  <div className="perf-acc-row">
                    <span>First Attempt</span>
                    <span className="perf-val-rose" style={{ fontWeight: 700 }}>{data.selectedTest.firstAttempt}%</span>
                  </div>
                  <div className="perf-acc-row">
                    <span>Best Attempt</span>
                    <span className="perf-val-emerald" style={{ fontWeight: 700 }}>{data.selectedTest.bestAttempt}%</span>
                  </div>
                  <div className="perf-acc-row">
                    <span>Latest Attempt</span>
                    <span className="perf-val-cyan" style={{ fontWeight: 700 }}>{data.selectedTest.latestAttempt}%</span>
                  </div>
                  <div className="perf-acc-row">
                    <span>Total Attempts</span>
                    <span style={{ fontWeight: 700 }}>{data.selectedTest.totalAttempts}</span>
                  </div>
                  <div className="perf-acc-row">
                    <span>Net Improvement</span>
                    <span className="perf-val-emerald" style={{ fontWeight: 700 }}>
                      {formatImprovement(data.selectedTest.improvement)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="perf-empty">Select a test to view analysis.</div>
              )}
            </div>
          )}

          {activeRightTab === 'weak' && (
            <div className="perf-history-list">
              {data.weakTopics.length === 0 ? (
                <div className="perf-empty">No weak topics (&lt;75% accuracy) detected for this test.</div>
              ) : (
                data.weakTopics.map((wt) => (
                  <div key={wt.topic} className="perf-acc-row">
                    <span>{wt.topic}</span>
                    <span className="perf-val-rose" style={{ fontWeight: 700 }}>
                      {wt.accuracy}% ({wt.correct}/{wt.total})
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>

      {/* Attempt Answer Review Modal */}
      {reviewDetail && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(2, 6, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setReviewDetail(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '85vh',
              overflowY: 'auto',
              borderRadius: '18px',
              padding: '1.5rem',
              background: 'rgba(15, 23, 42, 0.97)',
              border: '1px solid rgba(167, 139, 250, 0.3)',
              color: '#f8fafc',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{reviewDetail.testName}</h2>
                <div style={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.6)', display: 'flex', gap: '0.85rem', marginTop: '0.25rem' }}>
                  <span>{new Date(reviewDetail.completedAt).toLocaleString('en-IN')}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={12} /> {formatDuration(reviewDetail.timeSpentSeconds)}
                  </span>
                  <span>Accuracy: {reviewDetail.accuracyPercentage}%</span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close attempt review"
                onClick={() => setReviewDetail(null)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '0.35rem',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {reviewDetail.questionResponses.length === 0 ? (
              <div className="perf-empty">
                Score: {reviewDetail.marksObtained} / {reviewDetail.maxMarks} ({reviewDetail.correctAnswers} correct, {reviewDetail.incorrectAnswers} wrong, {reviewDetail.unansweredQuestions} unanswered).
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {reviewDetail.questionResponses.map((qr, idx) => {
                  const opts = Array.isArray(qr.options) ? qr.options : [];
                  const stuAns =
                    qr.selectedOption !== null && qr.selectedOption !== undefined && qr.selectedOption >= 0
                      ? opts[qr.selectedOption] || `Option ${qr.selectedOption + 1}`
                      : 'Unanswered';
                  const corrAns = opts[qr.correctAnswer] || `Option ${qr.correctAnswer + 1}`;
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '0.7rem 0.85rem',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.03)',
                        border: `1px solid ${qr.isCorrect ? 'rgba(52, 211, 153, 0.25)' : 'rgba(251, 113, 133, 0.25)'}`,
                      }}
                    >
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                        Q{idx + 1}. {qr.questionText || 'Question'}
                      </div>
                      <div style={{ fontSize: '0.76rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <span style={{ color: qr.isCorrect ? '#34d399' : '#fb7185' }}>Your Answer: {stuAns}</span>
                        <span style={{ color: '#34d399' }}>Correct Answer: {corrAns}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceAnalytics;
