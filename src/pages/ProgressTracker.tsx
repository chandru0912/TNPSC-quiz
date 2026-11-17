import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Target,
  Clock,
  BookOpen,
  Award,
  Zap,
  Flame,
  CheckCircle2,
  RotateCcw,
  Layers,
  ChevronRight,
  BarChart3,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { useStudentAuth } from '../context/StudentAuthContext';
import { apiFetch, getApiUrl } from '../utils/api';
import { subscribeStudentSync } from '../utils/studentSync';
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker';
import './ProgressTracker.css';

interface SubjectProgressItem {
  subject: string;
  completedChapters: number;
  totalChapters: number;
  percentage: number;
}

interface StandardMastery {
  standard: number;
  label: string;
  totalChapters: number;
  completedChapters: number;
  inProgressChapters: number;
  notStartedChapters: number;
  percentage: number;
  subjectCount: number;
  subjects: SubjectProgressItem[];
}

interface UnitMastery {
  unitCode: string;
  unitName: string;
  weightageQuestions: number;
  completedTopics: number;
  totalTopics: number;
  coverage: number;
  attemptedQuestions: number;
  correctAnswers: number;
  accuracy: number;
}

interface CategoryAccuracyBucket {
  attempted: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  testsCompleted?: number;
  history: { title: string; isCorrect?: boolean; percentage?: number; date: string }[];
}

interface McqSubjectPerformance {
  subject: string;
  attempted: number;
  correct: number;
  incorrect: number;
  accuracy: number;
}

interface McqStandardPerformance {
  standard: number;
  label: string;
  attempted: number;
  correct: number;
  incorrect: number;
  accuracy: number;
}

interface McqLessonPerformance {
  lessonTitle: string;
  subject: string;
  standard: number | null;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  status: 'Completed' | 'In Progress' | 'Not Started';
}

interface McqPerformanceData {
  totalQuestionsAvailable: number;
  totalAttempted: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  totalMarksObtained: number;
  maxMarks: number;
  overallAccuracy: number;
  completedTests: number;
  inProgressTests: number;
  averageTestScore: number;
  bySubject: McqSubjectPerformance[];
  byStandard: McqStandardPerformance[];
  byLesson: McqLessonPerformance[];
}

interface CalendarDay {
  date: string;
  dayLabel: string;
  studySeconds: number;
  questionsCount: number;
  lessonsCount: number;
  mockTestsCount: number;
  isActive: boolean;
}

interface ProgressTrackerPayload {
  metrics: {
    totalStudySeconds: number;
    totalStudyHours: number;
    studyHoursFormatted: string;
    totalQuestionsAttempted: number;
    targetQuestions: number;
    overallAccuracy: number;
    currentStreak: number;
    overallProgress: number;
    completedTopics: number;
    remainingTopics: number;
  };
  weeklyProgress: { day: string; value: number; seconds: number; questions: number }[];
  standards: StandardMastery[];
  units: UnitMastery[];
  categoryAccuracy: {
    studyMaterials: CategoryAccuracyBucket;
    mcqPractice: CategoryAccuracyBucket;
    mockTests: CategoryAccuracyBucket;
  };
  mcqPerformance?: McqPerformanceData;
  studyCalendar: CalendarDay[];
  consistency: {
    weeklyConsistencyPct: number;
    monthlyConsistencyPct: number;
    activeDays7: number;
    activeDays30: number;
    inactiveDays30: number;
  };
}

const DEFAULT_DATA: ProgressTrackerPayload = {
  metrics: {
    totalStudySeconds: 0,
    totalStudyHours: 0,
    studyHoursFormatted: '0h 0m',
    totalQuestionsAttempted: 0,
    targetQuestions: 0,
    overallAccuracy: 0,
    currentStreak: 0,
    overallProgress: 0,
    completedTopics: 0,
    remainingTopics: 0,
  },
  weeklyProgress: [
    { day: 'Mon', value: 0, seconds: 0, questions: 0 },
    { day: 'Tue', value: 0, seconds: 0, questions: 0 },
    { day: 'Wed', value: 0, seconds: 0, questions: 0 },
    { day: 'Thu', value: 0, seconds: 0, questions: 0 },
    { day: 'Fri', value: 0, seconds: 0, questions: 0 },
    { day: 'Sat', value: 0, seconds: 0, questions: 0 },
    { day: 'Sun', value: 0, seconds: 0, questions: 0 },
  ],
  standards: [],
  units: [],
  categoryAccuracy: {
    studyMaterials: { attempted: 0, correct: 0, incorrect: 0, accuracy: 0, history: [] },
    mcqPractice: { attempted: 0, correct: 0, incorrect: 0, accuracy: 0, testsCompleted: 0, history: [] },
    mockTests: { attempted: 0, correct: 0, incorrect: 0, accuracy: 0, testsCompleted: 0, history: [] },
  },
  mcqPerformance: {
    totalQuestionsAvailable: 0,
    totalAttempted: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    unansweredQuestions: 0,
    totalMarksObtained: 0,
    maxMarks: 0,
    overallAccuracy: 0,
    completedTests: 0,
    inProgressTests: 0,
    averageTestScore: 0,
    bySubject: [],
    byStandard: [],
    byLesson: [],
  },
  studyCalendar: [],
  consistency: {
    weeklyConsistencyPct: 0,
    monthlyConsistencyPct: 0,
    activeDays7: 0,
    activeDays30: 0,
    inactiveDays30: 30,
  },
};

export const ProgressTracker: React.FC = () => {
  useStudyTimeTracker();
  const { student, token } = useStudentAuth();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProgressTrackerPayload>(DEFAULT_DATA);
  const [expandedStandard, setExpandedStandard] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const fetchTrackerStats = useCallback(
    async (silent = false) => {
      if (!token || token === 'preview_admin_token') {
        setIsRefreshing(false);
        return;
      }

      if (!silent) setIsRefreshing(true);
      try {
        const res = await apiFetch('/api/student/progress-tracker', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!silent) setError(json?.message || 'Failed to load progress tracker.');
          return;
        }
        if (json?.data) {
          setData(json.data);
          setError(null);
        }
      } catch (err: any) {
        console.warn('[ProgressTracker] Error fetching tracker metrics:', err);
        if (!silent) setError(err?.message || 'Unable to connect to backend.');
      } finally {
        if (!silent) setIsRefreshing(false);
      }
    },
    [token]
  );

  // Reset state immediately on student change + SSE + 10s fallback polling
  useEffect(() => {
    setData(DEFAULT_DATA);
    setExpandedStandard(null);
    setSelectedDay(null);

    if (!token || token === 'preview_admin_token') {
      return;
    }

    fetchTrackerStats();

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
            fetchTrackerStats(true);
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
      if (!isDisposed) fetchTrackerStats(true);
    });

    const pollId = setInterval(() => {
      if (!document.hidden && !sseConnected) {
        fetchTrackerStats(true);
      }
    }, 10_000);

    return () => {
      isDisposed = true;
      streamController.abort();
      unsubSync();
      clearInterval(pollId);
    };
  }, [token, student?.id, fetchTrackerStats]);

  const { metrics, weeklyProgress, standards, units, categoryAccuracy, mcqPerformance, studyCalendar, consistency } = data;
  const ringRadius = 54;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <div className="progress-tracker-page">
      {/* 1. Header Banner */}
      <motion.div
        className="tracker-header glass"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="tracker-header-left">
          <div className="tracker-icon-badge">
            <TrendingUp size={26} />
          </div>
          <div>
            <div className="tracker-eyebrow">
              <span>Syllabus Telemetry &amp; Analytics</span>
              <span className="tracker-dot">•</span>
              <span className="text-gold">Live Progress</span>
            </div>
            <h1 className="tracker-title">Preparation Progress Tracker</h1>
            <p className="tracker-subtitle">
              Comprehensive syllabus coverage across Samacheer Kalvi textbooks (6th–12th) and TNPSC Units.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="tracker-refresh-btn"
          onClick={() => fetchTrackerStats()}
          title="Refresh Progress"
        >
          <RotateCcw size={16} className={isRefreshing ? 'spinning' : ''} />
          <span>Refresh</span>
        </button>
      </motion.div>

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.85rem 1rem',
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

      {/* 2. Top Summary Metrics Strip */}
      <div className="tracker-summary-strip glass">
        <div className="tracker-summary-item">
          <div className="tracker-summary-icon gold">
            <Clock size={18} />
          </div>
          <div>
            <span className="tracker-summary-label">Total Study Time</span>
            <div className="tracker-summary-val">{metrics.studyHoursFormatted || '0h 0m'}</div>
          </div>
        </div>

        <div className="tracker-summary-divider" />

        <div className="tracker-summary-item">
          <div className="tracker-summary-icon cyan">
            <Zap size={18} />
          </div>
          <div>
            <span className="tracker-summary-label">Questions Solved</span>
            <div className="tracker-summary-val">
              {metrics.totalQuestionsAttempted.toLocaleString()}{' '}
              <span className="tracker-summary-unit">/ {metrics.targetQuestions.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="tracker-summary-divider" />

        <div className="tracker-summary-item">
          <div className="tracker-summary-icon indigo">
            <Target size={18} />
          </div>
          <div>
            <span className="tracker-summary-label">Overall Accuracy</span>
            <div className="tracker-summary-val">
              {metrics.overallAccuracy}
              <span className="tracker-summary-unit">%</span>
            </div>
          </div>
        </div>

        <div className="tracker-summary-divider" />

        <div className="tracker-summary-item">
          <div className="tracker-summary-icon flame">
            <Flame size={18} />
          </div>
          <div>
            <span className="tracker-summary-label">Active Streak</span>
            <div className="tracker-summary-val">
              {metrics.currentStreak} <span className="tracker-summary-unit">days</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Overall Ring & Weekly Study Split */}
      <div className="tracker-overview-split">
        <motion.div
          className="tracker-ring-card glass"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
        >
          <div className="tracker-ring-visual">
            <svg viewBox="0 0 130 130" className="tracker-ring-svg">
              <defs>
                <linearGradient id="trackerGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fff59d" />
                  <stop offset="50%" stopColor="#ffd700" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              <circle className="tracker-ring-track" cx="65" cy="65" r={ringRadius} fill="none" strokeWidth="10" />
              <circle
                className="tracker-ring-fill"
                cx="65"
                cy="65"
                r={ringRadius}
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                stroke="url(#trackerGoldGrad)"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringCircumference - (metrics.overallProgress / 100) * ringCircumference}
              />
            </svg>
            <div className="tracker-ring-center">
              <span className="tracker-ring-percent">{metrics.overallProgress}%</span>
              <span className="tracker-ring-label">Mastery</span>
            </div>
          </div>

          <div className="tracker-ring-info">
            <h2 className="tracker-ring-heading">Syllabus Completion</h2>
            <p className="tracker-ring-desc">
              {metrics.overallProgress > 0
                ? `You have completed ${metrics.overallProgress}% of your target TNPSC syllabus and practice milestones.`
                : 'Start studying a Samacheer Kalvi lesson or practicing MCQs to track live syllabus completion.'}
            </p>
            <div className="tracker-ring-tags">
              <span className="tracker-tag completed">
                <CheckCircle2 size={13} /> Completed Topics: {metrics.completedTopics}
              </span>
              <span className="tracker-tag revision">
                <BookOpen size={13} /> Remaining Topics: {metrics.remainingTopics}
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="tracker-chart-card glass"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <div className="tracker-chart-head">
            <div className="tracker-chart-head-left">
              <BarChart3 size={18} className="text-gold" />
              <span className="tracker-chart-title">Weekly Consistency</span>
            </div>
            <span className="tracker-chart-hint">
              {consistency.activeDays7}/7 active days ({consistency.weeklyConsistencyPct}%)
            </span>
          </div>

          <div className="tracker-bar-chart">
            {weeklyProgress.map((day, idx) => (
              <div key={`${day.day}_${idx}`} className="tracker-bar-col">
                <span className="tracker-bar-num">{day.value}%</span>
                <div className="tracker-bar-track">
                  <div
                    className="tracker-bar-fill"
                    style={{
                      height: `${Math.max(6, day.value)}%`,
                      background:
                        day.value >= 100
                          ? 'linear-gradient(to top, #10b981, #34d399)'
                          : 'linear-gradient(to top, #d97706, #ffd700)',
                    }}
                  />
                </div>
                <span className="tracker-bar-day">{day.day}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* 4. Separate Accuracy Analytics (Study Materials, MCQ Practice, Mock Tests) */}
      <div className="tracker-section-card glass">
        <div className="tracker-section-head">
          <div className="tracker-section-head-left">
            <Target size={20} className="text-gold" />
            <div>
              <h2 className="tracker-section-title">Category-Wise Accuracy Analytics</h2>
              <p className="tracker-section-sub">
                Independent accuracy tracking across Study Materials, MCQ Practice, and Mock Tests
              </p>
            </div>
          </div>
        </div>

        <div className="tracker-standards-grid">
          {[
            { key: 'Study Materials', data: categoryAccuracy.studyMaterials, showTests: false },
            { key: 'MCQ Practice', data: categoryAccuracy.mcqPractice, showTests: true },
            { key: 'Mock Tests', data: categoryAccuracy.mockTests, showTests: true },
          ].map((item) => (
            <div key={item.key} className="tracker-std-item">
              <div className="tracker-std-top">
                <span className="tracker-std-name">{item.key}</span>
                <span className="tracker-std-pct">{item.data.accuracy}%</span>
              </div>
              <div className="tracker-std-bar-bg">
                <div className="tracker-std-bar-fill" style={{ width: `${item.data.accuracy}%` }} />
              </div>
              <div className="tracker-std-meta">
                <span>
                  {item.data.correct} correct / {item.data.attempted} attempted
                </span>
                <span>{item.data.incorrect} incorrect</span>
              </div>
              {item.showTests && (
                <div className="tracker-std-meta" style={{ marginTop: '0.25rem', opacity: 0.8 }}>
                  <span>Tests Completed</span>
                  <span>{item.data.testsCompleted ?? 0}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 4B. Dedicated MCQ Practice Performance Details */}
      {mcqPerformance && (
        <div className="tracker-section-card glass">
          <div className="tracker-section-head">
            <div className="tracker-section-head-left">
              <Award size={20} className="text-gold" />
              <div>
                <h2 className="tracker-section-title">MCQ Practice Performance</h2>
                <p className="tracker-section-sub">
                  Independent student examination analytics ({mcqPerformance.totalQuestionsAvailable} questions in bank)
                </p>
              </div>
            </div>
            <Link to="/practice" className="tracker-section-link">
              <span>Open MCQ Practice</span>
              <ChevronRight size={15} />
            </Link>
          </div>

          <div className="tracker-mcq-kpi-grid">
            <div className="tracker-mcq-kpi">
              <span className="tracker-mcq-kpi-label">Questions Attempted</span>
              <span className="tracker-mcq-kpi-val">{mcqPerformance.totalAttempted}</span>
            </div>
            <div className="tracker-mcq-kpi">
              <span className="tracker-mcq-kpi-label">Correct Answers</span>
              <span className="tracker-mcq-kpi-val" style={{ color: '#34d399' }}>{mcqPerformance.correctAnswers}</span>
            </div>
            <div className="tracker-mcq-kpi">
              <span className="tracker-mcq-kpi-label">Incorrect Answers</span>
              <span className="tracker-mcq-kpi-val" style={{ color: '#fb7185' }}>{mcqPerformance.incorrectAnswers}</span>
            </div>
            <div className="tracker-mcq-kpi">
              <span className="tracker-mcq-kpi-label">Overall Accuracy</span>
              <span className="tracker-mcq-kpi-val text-gold">{mcqPerformance.overallAccuracy}%</span>
            </div>
            <div className="tracker-mcq-kpi">
              <span className="tracker-mcq-kpi-label">Completed MCQ Tests</span>
              <span className="tracker-mcq-kpi-val">{mcqPerformance.completedTests}</span>
            </div>
            <div className="tracker-mcq-kpi">
              <span className="tracker-mcq-kpi-label">Average Test Score</span>
              <span className="tracker-mcq-kpi-val">{mcqPerformance.averageTestScore}%</span>
            </div>
          </div>

          {/* Subject-Wise MCQ Performance */}
          {mcqPerformance.bySubject.length > 0 && (
            <div className="tracker-mcq-subblock">
              <h3 className="tracker-mcq-subtitle">Subject-Wise MCQ Performance</h3>
              <div className="tracker-standards-grid">
                {mcqPerformance.bySubject.map((sub) => (
                  <div key={sub.subject} className="tracker-std-item">
                    <div className="tracker-std-top">
                      <span className="tracker-std-name">{sub.subject}</span>
                      <span className="tracker-std-pct">{sub.accuracy}%</span>
                    </div>
                    <div className="tracker-std-bar-bg">
                      <div className="tracker-std-bar-fill" style={{ width: `${sub.accuracy}%` }} />
                    </div>
                    <div className="tracker-std-meta">
                      <span>{sub.correct} correct / {sub.attempted} attempted</span>
                      <span>{sub.incorrect} incorrect</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Standard-Wise MCQ Performance (6th - 12th) */}
          {mcqPerformance.byStandard.length > 0 && (
            <div className="tracker-mcq-subblock">
              <h3 className="tracker-mcq-subtitle">Standard-Wise MCQ Performance (6th – 12th Standard)</h3>
              <div className="tracker-standards-grid">
                {mcqPerformance.byStandard.map((st) => (
                  <div key={st.standard} className="tracker-std-item">
                    <div className="tracker-std-top">
                      <span className="tracker-std-name">{st.label}</span>
                      <span className="tracker-std-pct">{st.accuracy}%</span>
                    </div>
                    <div className="tracker-std-bar-bg">
                      <div className="tracker-std-bar-fill" style={{ width: `${st.accuracy}%` }} />
                    </div>
                    <div className="tracker-std-meta">
                      <span>{st.correct} correct / {st.attempted} attempted</span>
                      <span>{st.incorrect} incorrect</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lesson-Wise MCQ Performance */}
          <div className="tracker-mcq-subblock">
            <h3 className="tracker-mcq-subtitle">Lesson-Wise MCQ Performance</h3>
            {mcqPerformance.byLesson.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem' }}>
                No MCQ Practice lesson attempts recorded yet. Complete questions in MCQ Practice to track lesson-wise accuracy.
              </div>
            ) : (
              <div className="tracker-mcq-table-wrap">
                <table className="tracker-mcq-table">
                  <thead>
                    <tr>
                      <th>Lesson Name</th>
                      <th>Total Qs</th>
                      <th>Attempted</th>
                      <th>Correct</th>
                      <th>Incorrect</th>
                      <th>Accuracy</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mcqPerformance.byLesson.map((l) => (
                      <tr key={`${l.lessonTitle}-${l.standard ?? 'all'}`}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#ffffff' }}>{l.lessonTitle}</div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>
                            {l.subject}{l.standard ? ` • ${l.standard}th Standard` : ''}
                          </div>
                        </td>
                        <td>{l.totalQuestions}</td>
                        <td>{l.attempted}</td>
                        <td style={{ color: '#34d399', fontWeight: 600 }}>{l.correct}</td>
                        <td style={{ color: '#fb7185', fontWeight: 600 }}>{l.incorrect}</td>
                        <td style={{ color: '#ffd700', fontWeight: 700 }}>{l.accuracy}%</td>
                        <td>
                          <span className={`tracker-status-pill ${l.status === 'Completed' ? 'done' : l.status === 'In Progress' ? 'progress' : ''}`}>
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Samacheer Kalvi Standards Progress (Classes 6 to 12) */}
      <div className="tracker-section-card glass">
        <div className="tracker-section-head">
          <div className="tracker-section-head-left">
            <Layers size={20} className="text-gold" />
            <div>
              <h2 className="tracker-section-title">Samacheer Kalvi Textbook Coverage</h2>
              <p className="tracker-section-sub">Standard-wise syllabus completion (Classes 6th to 12th)</p>
            </div>
          </div>
          <Link to="/materials" className="tracker-section-link">
            <span>Explore Textbooks</span>
            <ChevronRight size={15} />
          </Link>
        </div>

        <div className="tracker-standards-grid">
          {standards.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem' }}>
              {isRefreshing ? 'Loading standard coverage...' : 'Sign in to view your 6th–12th Samacheer Kalvi coverage.'}
            </div>
          ) : (
            standards.map((std) => (
              <div
                key={std.standard}
                className="tracker-std-item"
                style={{ cursor: 'pointer' }}
                onClick={() => setExpandedStandard(expandedStandard === std.standard ? null : std.standard)}
              >
                <div className="tracker-std-top">
                  <span className="tracker-std-name">{std.label}</span>
                  <span className="tracker-std-pct">{std.percentage}%</span>
                </div>
                <div className="tracker-std-bar-bg">
                  <div className="tracker-std-bar-fill" style={{ width: `${std.percentage}%` }} />
                </div>
                <div className="tracker-std-meta">
                  <span>
                    {std.completedChapters} / {std.totalChapters} Chapters
                  </span>
                  <span>{std.subjectCount} Subjects</span>
                </div>
                <div className="tracker-std-meta" style={{ marginTop: '0.25rem', opacity: 0.78 }}>
                  <span>In Progress: {std.inProgressChapters}</span>
                  <span>Not Started: {std.notStartedChapters}</span>
                </div>

                {expandedStandard === std.standard && std.subjects.length > 0 && (
                  <div style={{ marginTop: '0.65rem', paddingTop: '0.55rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {std.subjects.map((sub) => (
                      <div key={sub.subject} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'rgba(255,255,255,0.75)' }}>
                        <span>{sub.subject}</span>
                        <span>
                          {sub.completedChapters}/{sub.totalChapters} ({sub.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 6. Samacheer Kalvi 30-Day Study Activity Calendar */}
      <div className="tracker-section-card glass">
        <div className="tracker-section-head">
          <div className="tracker-section-head-left">
            <Calendar size={20} className="text-gold" />
            <div>
              <h2 className="tracker-section-title">Study Activity Calendar (Last 30 Days)</h2>
              <p className="tracker-section-sub">
                Monthly consistency: {consistency.activeDays30}/30 active days ({consistency.monthlyConsistencyPct}%) • {consistency.inactiveDays30} inactive days
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))', gap: '0.45rem' }}>
          {studyCalendar.map((day) => (
            <button
              key={day.date}
              type="button"
              onClick={() => setSelectedDay(day)}
              title={`${day.date}: ${Math.round(day.studySeconds / 60)}m study, ${day.questionsCount} Qs, ${day.lessonsCount} lessons`}
              style={{
                padding: '0.45rem 0.25rem',
                borderRadius: '8px',
                border:
                  selectedDay?.date === day.date
                    ? '1px solid #ffd700'
                    : '1px solid rgba(255,255,255,0.08)',
                background: day.isActive
                  ? day.studySeconds >= 1800 || day.questionsCount >= 10
                    ? 'rgba(16, 185, 129, 0.28)'
                    : 'rgba(255, 215, 0, 0.2)'
                  : 'rgba(255, 255, 255, 0.03)',
                color: day.isActive ? '#ffffff' : 'rgba(255,255,255,0.45)',
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <div>{day.date.slice(8)}</div>
              <div style={{ fontSize: '0.6rem', opacity: 0.75 }}>{day.questionsCount}q</div>
            </button>
          ))}
        </div>

        {selectedDay && (
          <div style={{ marginTop: '0.85rem', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
            <strong>{selectedDay.dayLabel} ({selectedDay.date})</strong>
            <span>Study Time: {Math.round(selectedDay.studySeconds / 60)} min</span>
            <span>Lessons Completed: {selectedDay.lessonsCount}</span>
            <span>Questions Attempted: {selectedDay.questionsCount}</span>
            <span>Mock Tests: {selectedDay.mockTestsCount}</span>
          </div>
        )}
      </div>

      {/* 7. TNPSC General Studies Unit Mastery Grid */}
      <div className="tracker-section-card glass">
        <div className="tracker-section-head">
          <div className="tracker-section-head-left">
            <Award size={20} className="text-gold" />
            <div>
              <h2 className="tracker-section-title">TNPSC General Studies Unit Mastery</h2>
              <p className="tracker-section-sub">Weightage and performance breakdown by syllabus units</p>
            </div>
          </div>
          <Link to="/practice" className="tracker-section-link">
            <span>Practice Questions</span>
            <ChevronRight size={15} />
          </Link>
        </div>

        <div className="tracker-units-table-wrap">
          <table className="tracker-units-table">
            <thead>
              <tr>
                <th>Unit Code</th>
                <th>Syllabus Unit Name</th>
                <th>Exam Weightage</th>
                <th>Syllabus Coverage</th>
                <th>Test Accuracy</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.unitCode}>
                  <td>
                    <span className="tracker-unit-code-badge">{u.unitCode}</span>
                  </td>
                  <td>
                    <span className="tracker-unit-name-text">{u.unitName}</span>
                  </td>
                  <td>
                    <span className="tracker-weight-tag">~{u.weightageQuestions} Qs</span>
                  </td>
                  <td>
                    <div className="tracker-table-bar-cell">
                      <div className="tracker-table-bar-bg">
                        <div className="tracker-table-bar-fill coverage" style={{ width: `${u.coverage}%` }} />
                      </div>
                      <span>{u.coverage}%</span>
                    </div>
                  </td>
                  <td>
                    <div className="tracker-table-bar-cell">
                      <div className="tracker-table-bar-bg">
                        <div className="tracker-table-bar-fill accuracy" style={{ width: `${u.accuracy}%` }} />
                      </div>
                      <span className="text-gold font-bold">{u.accuracy}%</span>
                    </div>
                  </td>
                  <td>
                    <Link
                      to={`/practice?subject=${encodeURIComponent(u.unitName)}`}
                      className="tracker-unit-drill-btn"
                    >
                      Practice
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProgressTracker;
