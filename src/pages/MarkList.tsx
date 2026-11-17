import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Award,
  Trophy,
  Target,
  FileText,
  GraduationCap,
  RotateCcw,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Filter,
  Eye,
  X,
  Clock,
} from 'lucide-react';
import { useStudentAuth } from '../context/StudentAuthContext';
import { apiFetch, getApiUrl } from '../utils/api';
import { subscribeStudentSync } from '../utils/studentSync';
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker';
import DateRangePicker from '../components/DateRangePicker';
import './MarkList.css';

interface ScorecardRecord {
  id: number;
  testId?: string | null;
  testName: string;
  assessmentType: string;
  category: 'mock_test' | 'lesson_quiz' | 'subject_practice';
  groupTag: string;
  totalQuestions: number;
  attemptedQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  timeSpentSeconds: number;
  date: string;
  completedAt: string;
  status: 'passed' | 'excellent' | 'needs_practice';
}

interface BreakdownItem {
  name: string;
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
}

interface QuestionResponseDetail {
  questionId?: number | string | null;
  questionText?: string;
  options?: string[];
  subject?: string;
  topic?: string;
  selectedOption: number | null;
  correctAnswer: number;
  isCorrect: boolean;
}

interface ScorecardDetail extends ScorecardRecord {
  accuracyPercentage: number;
  subjectPerformance: BreakdownItem[];
  topicPerformance: BreakdownItem[];
  questionResponses: QuestionResponseDetail[];
}

interface MarkListMetrics {
  highestScore: number;
  averageAccuracy: number;
  assessmentsTaken: number;
  totalSolved: number;
}

const DEFAULT_METRICS: MarkListMetrics = {
  highestScore: 0,
  averageAccuracy: 0,
  assessmentsTaken: 0,
  totalSolved: 0,
};

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export const MarkList: React.FC = () => {
  useStudyTimeTracker();
  const { student, token } = useStudentAuth();
  const [filter, setFilter] = useState<'all' | 'mock_test' | 'lesson_quiz' | 'subject_practice'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<MarkListMetrics>(DEFAULT_METRICS);
  const [counts, setCounts] = useState({ all: 0, mock_test: 0, lesson_quiz: 0, subject_practice: 0 });
  const [scorecards, setScorecards] = useState<ScorecardRecord[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<ScorecardDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);

  const pageSize = 20;

  const fetchScorecards = useCallback(
    async (silent = false) => {
      if (!token || token === 'preview_admin_token') {
        setIsLoading(false);
        return;
      }

      if (!silent) setIsLoading(true);
      try {
        const params = new URLSearchParams({
          type: filter,
          page: String(page),
          limit: String(pageSize),
        });
        if (dateFrom) params.set('from', dateFrom);
        if (dateTo) params.set('to', dateTo);

        const res = await apiFetch(`/api/student/mark-list?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        const data = json?.data;
        if (!data) return;

        setMetrics({
          highestScore: Number(data.metrics?.highestScore ?? 0),
          averageAccuracy: Number(data.metrics?.averageAccuracy ?? 0),
          assessmentsTaken: Number(data.metrics?.assessmentsTaken ?? 0),
          totalSolved: Number(data.metrics?.totalSolved ?? 0),
        });
        if (data.counts) {
          setCounts({
            all: Number(data.counts.all ?? 0),
            mock_test: Number(data.counts.mock_test ?? 0),
            lesson_quiz: Number(data.counts.lesson_quiz ?? 0),
            subject_practice: Number(data.counts.subject_practice ?? 0),
          });
        }
        setTotalRecords(Number(data.pagination?.total ?? 0));
        setScorecards(Array.isArray(data.scorecards) ? data.scorecards : []);
      } catch (err) {
        console.warn('[MarkList] Error loading scorecards:', err);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [token, filter, dateFrom, dateTo, page]
  );

  // Reset state immediately on student switch + connect SSE + 10s fallback polling
  useEffect(() => {
    setMetrics(DEFAULT_METRICS);
    setScorecards([]);
    setSelectedDetail(null);

    if (!token || token === 'preview_admin_token') {
      setIsLoading(false);
      return;
    }

    fetchScorecards();

    let isDisposed = false;
    let sseConnected = false;
    const streamController = new AbortController();

    const connectSse = async () => {
      try {
        const res = await fetch(getApiUrl('/api/student/dashboard/stream'), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
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
        let buffer = '';
        while (!isDisposed) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (buffer.includes('event: dashboard')) {
            buffer = '';
            fetchScorecards(true);
          }
        }
      } catch {
        // Fallback to 10s polling
      } finally {
        sseConnected = false;
      }
    };

    connectSse();

    const unsubscribeSync = subscribeStudentSync(() => {
      if (!isDisposed) fetchScorecards(true);
    });

    const pollInterval = setInterval(() => {
      if (!document.hidden && !sseConnected) {
        fetchScorecards(true);
      }
    }, 10_000);

    return () => {
      isDisposed = true;
      streamController.abort();
      unsubscribeSync();
      clearInterval(pollInterval);
    };
  }, [token, student?.id, fetchScorecards]);

  const handleViewDetails = async (attemptId: number) => {
    if (!token) return;
    setIsDetailLoading(true);
    try {
      const res = await apiFetch(`/api/student/mark-list/${attemptId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          setSelectedDetail(json.data);
        }
      }
    } catch (err) {
      console.warn('[MarkList] Failed to load scorecard details:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  return (
    <div className="mark-list-page">
      {/* 1. Header Banner */}
      <motion.div
        className="mark-list-header glass"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mark-list-header-left">
          <div className="mark-list-icon-badge">
            <Award size={26} />
          </div>
          <div>
            <div className="mark-list-eyebrow">
              <span>TNPSC Academic Performance</span>
              <span className="mark-list-dot">•</span>
              <span className="text-gold">Live Scorecard Ledger</span>
            </div>
            <h1 className="mark-list-title">Mark List &amp; Scorecards</h1>
            <p className="mark-list-subtitle">
              Detailed assessment records, mock test marks, and lesson-wise evaluation history.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="mark-list-refresh-btn"
          onClick={() => fetchScorecards()}
          title="Refresh Marks"
        >
          <RotateCcw size={16} className={isLoading ? 'spinning' : ''} />
          <span>Refresh</span>
        </button>
      </motion.div>

      {/* 2. Top KPI Summary Strip */}
      <div className="mark-list-kpi-grid">
        <motion.div
          className="mark-kpi-card glass"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <div className="mark-kpi-icon gold">
            <Trophy size={20} />
          </div>
          <div className="mark-kpi-info">
            <span className="mark-kpi-label">Highest Score</span>
            <div className="mark-kpi-val">
              {metrics.highestScore}
              <span className="mark-kpi-unit">%</span>
            </div>
            <span className="mark-kpi-meta">Best Assessment</span>
          </div>
        </motion.div>

        <motion.div
          className="mark-kpi-card glass"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="mark-kpi-icon cyan">
            <Target size={20} />
          </div>
          <div className="mark-kpi-info">
            <span className="mark-kpi-label">Average Accuracy</span>
            <div className="mark-kpi-val">
              {metrics.averageAccuracy}
              <span className="mark-kpi-unit">%</span>
            </div>
            <span className="mark-kpi-meta">Across All Attempts</span>
          </div>
        </motion.div>

        <motion.div
          className="mark-kpi-card glass"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="mark-kpi-icon indigo">
            <GraduationCap size={20} />
          </div>
          <div className="mark-kpi-info">
            <span className="mark-kpi-label">Assessments Taken</span>
            <div className="mark-kpi-val">{metrics.assessmentsTaken}</div>
            <span className="mark-kpi-meta">Completed Tests</span>
          </div>
        </motion.div>

        <motion.div
          className="mark-kpi-card glass"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="mark-kpi-icon green">
            <CheckCircle2 size={20} />
          </div>
          <div className="mark-kpi-info">
            <span className="mark-kpi-label">Total Solved</span>
            <div className="mark-kpi-val">
              {metrics.totalSolved.toLocaleString()}
            </div>
            <span className="mark-kpi-meta">Unique Questions</span>
          </div>
        </motion.div>
      </div>

      {/* 3. Filter Navigation Strip */}
      <div className="mark-list-filter-bar glass">
        <div className="mark-filter-group">
          <Filter size={16} className="text-gold" />
          <span className="mark-filter-label">Filter View:</span>
        </div>

        <div className="mark-filter-tabs">
          <button
            type="button"
            className={`mark-filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => { setFilter('all'); setPage(1); }}
          >
            All Scorecards ({counts.all})
          </button>
          <button
            type="button"
            className={`mark-filter-tab ${filter === 'mock_test' ? 'active' : ''}`}
            onClick={() => { setFilter('mock_test'); setPage(1); }}
          >
            Full Mock Tests ({counts.mock_test})
          </button>
          <button
            type="button"
            className={`mark-filter-tab ${filter === 'lesson_quiz' ? 'active' : ''}`}
            onClick={() => { setFilter('lesson_quiz'); setPage(1); }}
          >
            Lesson Quizzes ({counts.lesson_quiz})
          </button>
          <button
            type="button"
            className={`mark-filter-tab ${filter === 'subject_practice' ? 'active' : ''}`}
            onClick={() => { setFilter('subject_practice'); setPage(1); }}
          >
            Subject Drills ({counts.subject_practice})
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <DateRangePicker
            startDate={dateFrom}
            endDate={dateTo}
            onChange={(start, end) => {
              setDateFrom(start);
              setDateTo(end);
              setPage(1);
            }}
          />
          <Link to="/mock-tests" className="mark-new-test-btn">
            <span>Take a Mock Test</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* 4. Scorecard Table / Roster */}
      <div className="mark-list-roster-container glass">
        <div className="mark-table-responsive">
          <table className="mark-list-table">
            <thead>
              <tr>
                <th>Assessment Name</th>
                <th>Category</th>
                <th>Date Attempted</th>
                <th>Questions (C / W)</th>
                <th>Marks Obtained</th>
                <th>Score (%)</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {scorecards.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'rgba(255,255,255,0.55)' }}>
                    {isLoading
                      ? 'Loading assessment scorecards...'
                      : 'No completed assessments yet. Complete a Mock Test, Lesson Quiz, or Subject Drill to see your scorecard here.'}
                  </td>
                </tr>
              ) : (
                scorecards.map((sc) => (
                  <tr key={sc.id}>
                    <td>
                      <div className="mark-test-cell">
                        <FileText size={18} className="text-gold" />
                        <div>
                          <div className="mark-test-name">{sc.testName}</div>
                          <div className="mark-test-sub">{sc.groupTag}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="mark-cat-badge">
                        {sc.category === 'mock_test'
                          ? 'Full Mock'
                          : sc.category === 'lesson_quiz'
                            ? 'Lesson Quiz'
                            : 'Subject Drill'}
                      </span>
                    </td>
                    <td>
                      <div className="mark-date-cell">
                        <Calendar size={13} />
                        <span>{sc.date}</span>
                      </div>
                    </td>
                    <td>
                      <span className="mark-num-cell">
                        {sc.correctAnswers} / {sc.totalQuestions}
                        <span style={{ color: '#f87171', marginLeft: '6px', fontSize: '0.72rem' }}>
                          ({sc.incorrectAnswers} wrong)
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="mark-score-highlight">
                        {sc.marksObtained}
                        <span className="mark-score-max"> / {sc.maxMarks}</span>
                      </span>
                    </td>
                    <td>
                      <div className="mark-percent-wrap">
                        <div className="mark-percent-bar-bg">
                          <div
                            className={`mark-percent-bar-fill ${sc.status}`}
                            style={{ width: `${Math.min(100, sc.percentage)}%` }}
                          />
                        </div>
                        <span className="mark-percent-text">{sc.percentage}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`mark-status-pill ${sc.status}`}>
                        {sc.status === 'excellent'
                          ? 'Excellent (Qualified)'
                          : sc.status === 'passed'
                            ? 'Passed'
                            : 'Needs Practice'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="mark-action-btn"
                        onClick={() => handleViewDetails(sc.id)}
                        disabled={isDetailLoading}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
                      >
                        <Eye size={13} />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>
              Page {page} of {totalPages} ({totalRecords} records)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="mark-filter-tab"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="mark-filter-tab"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Detailed Scorecard Modal */}
      {selectedDetail && (
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
          onClick={() => setSelectedDetail(null)}
        >
          <div
            className="glass"
            style={{
              width: '100%',
              maxWidth: '780px',
              maxHeight: '88vh',
              overflowY: 'auto',
              borderRadius: '18px',
              padding: '1.5rem',
              background: 'rgba(15, 23, 42, 0.96)',
              border: '1px solid rgba(255, 215, 0, 0.25)',
              color: '#f8fafc',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#ffd700', fontWeight: 700, textTransform: 'uppercase' }}>
                  {selectedDetail.groupTag} • {selectedDetail.assessmentType.replace(/_/g, ' ')}
                </span>
                <h2 style={{ margin: '0.25rem 0 0.2rem', fontSize: '1.25rem' }}>{selectedDetail.testName}</h2>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <span>{new Date(selectedDetail.completedAt).toLocaleString('en-IN')}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={13} /> Time Taken: {formatDuration(selectedDetail.timeSpentSeconds)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close scorecard"
                onClick={() => setSelectedDetail(null)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '0.4rem',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)' }}>Marks Obtained</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffd700' }}>
                  {selectedDetail.marksObtained} / {selectedDetail.maxMarks}
                </div>
              </div>
              <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)' }}>Accuracy</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedDetail.accuracyPercentage}%</div>
              </div>
              <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)' }}>Correct / Wrong</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  <span style={{ color: '#4ade80' }}>{selectedDetail.correctAnswers}</span> /{' '}
                  <span style={{ color: '#f87171' }}>{selectedDetail.incorrectAnswers}</span>
                </div>
              </div>
              <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)' }}>Unanswered / Total</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {selectedDetail.unansweredQuestions} / {selectedDetail.totalQuestions}
                </div>
              </div>
            </div>

            {selectedDetail.subjectPerformance.length > 0 && (
              <div style={{ marginBottom: '1.1rem' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#ffd700' }}>Subject-wise Performance</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                  {selectedDetail.subjectPerformance.map((sub) => (
                    <div key={sub.name} style={{ padding: '0.65rem 0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.04)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{sub.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)' }}>
                        {sub.correct}/{sub.total} correct ({sub.accuracy}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedDetail.topicPerformance.length > 0 && (
              <div style={{ marginBottom: '1.1rem' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#38bdf8' }}>Topic-wise Performance</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                  {selectedDetail.topicPerformance.map((top) => (
                    <div key={top.name} style={{ padding: '0.65rem 0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.04)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{top.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)' }}>
                        {top.correct}/{top.total} correct ({top.accuracy}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedDetail.questionResponses.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Question Breakdown</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {selectedDetail.questionResponses.map((qr, idx) => {
                    const opts = Array.isArray(qr.options) ? qr.options : [];
                    const studentAnsLabel =
                      qr.selectedOption !== null && qr.selectedOption !== undefined && qr.selectedOption >= 0
                        ? opts[qr.selectedOption] || `Option ${qr.selectedOption + 1}`
                        : 'Unanswered';
                    const correctAnsLabel = opts[qr.correctAnswer] || `Option ${qr.correctAnswer + 1}`;
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '0.7rem 0.85rem',
                          borderRadius: '8px',
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${qr.isCorrect ? 'rgba(74, 222, 128, 0.25)' : 'rgba(248, 113, 113, 0.25)'}`,
                        }}
                      >
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                          Q{idx + 1}. {qr.questionText || 'Question'}
                        </div>
                        <div style={{ fontSize: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <span style={{ color: qr.isCorrect ? '#4ade80' : '#f87171' }}>
                            Your Answer: {studentAnsLabel}
                          </span>
                          <span style={{ color: '#4ade80' }}>
                            Correct Answer: {correctAnsLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkList;
