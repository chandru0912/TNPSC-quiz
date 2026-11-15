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
} from 'lucide-react';
import { useStudentAuth } from '../context/StudentAuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../utils/api';
import './ProgressTracker.css';

interface StandardMastery {
  standard: number;
  label: string;
  totalChapters: number;
  completedChapters: number;
  percentage: number;
  subjectCount: number;
}

interface UnitMastery {
  unitCode: string;
  unitName: string;
  weightageQuestions: number;
  accuracy: number;
  coverage: number;
}

export const ProgressTracker: React.FC = () => {
  const { token } = useStudentAuth();
  const { isTamil } = useLanguage();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [metrics, setMetrics] = useState({
    totalStudyHours: 0,
    totalQuestionsSolved: 0,
    targetQuestions: 2500,
    overallAccuracy: 0,
    currentStreak: 0,
    overallProgress: 0,
  });

  const [standards] = useState<StandardMastery[]>([
    { standard: 6, label: '6th Standard', totalChapters: 24, completedChapters: 21, percentage: 88, subjectCount: 4 },
    { standard: 7, label: '7th Standard', totalChapters: 26, completedChapters: 20, percentage: 77, subjectCount: 4 },
    { standard: 8, label: '8th Standard', totalChapters: 28, completedChapters: 19, percentage: 68, subjectCount: 4 },
    { standard: 9, label: '9th Standard', totalChapters: 30, completedChapters: 18, percentage: 60, subjectCount: 4 },
    { standard: 10, label: '10th Standard (SSLC)', totalChapters: 34, completedChapters: 24, percentage: 71, subjectCount: 4 },
    { standard: 11, label: '11th Standard (HSC)', totalChapters: 32, completedChapters: 16, percentage: 50, subjectCount: 5 },
    { standard: 12, label: '12th Standard (HSC)', totalChapters: 32, completedChapters: 14, percentage: 44, subjectCount: 5 },
  ]);

  const [units] = useState<UnitMastery[]>([
    { unitCode: 'Unit I', unitName: 'General Science', weightageQuestions: 15, accuracy: 78, coverage: 65 },
    { unitCode: 'Unit II', unitName: 'Current Events', weightageQuestions: 15, accuracy: 70, coverage: 55 },
    { unitCode: 'Unit III', unitName: 'Geography of India & Tamil Nadu', weightageQuestions: 12, accuracy: 82, coverage: 75 },
    { unitCode: 'Unit IV', unitName: 'History and Culture of India', weightageQuestions: 15, accuracy: 85, coverage: 80 },
    { unitCode: 'Unit V', unitName: 'Indian Polity & Constitution', weightageQuestions: 18, accuracy: 88, coverage: 82 },
    { unitCode: 'Unit VI', unitName: 'Indian Economy & Planning', weightageQuestions: 12, accuracy: 72, coverage: 60 },
    { unitCode: 'Unit VII', unitName: 'Indian National Movement', weightageQuestions: 15, accuracy: 84, coverage: 78 },
    { unitCode: 'Unit VIII', unitName: 'History, Culture & Heritage of TN', weightageQuestions: 40, accuracy: 80, coverage: 70 },
    { unitCode: 'Unit IX', unitName: 'Development Administration in TN', weightageQuestions: 30, accuracy: 75, coverage: 65 },
    { unitCode: 'Unit X', unitName: 'Aptitude & Mental Ability', weightageQuestions: 25, accuracy: 86, coverage: 90 },
  ]);

  const [weeklyProgress, setWeeklyProgress] = useState([
    { day: 'Mon', value: 85 },
    { day: 'Tue', value: 92 },
    { day: 'Wed', value: 78 },
    { day: 'Thu', value: 100 },
    { day: 'Fri', value: 65 },
    { day: 'Sat', value: 95 },
    { day: 'Sun', value: 88 },
  ]);

  const fetchTrackerStats = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await apiFetch('/api/student/dashboard-stats', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        const m = json.data?.metrics;
        if (m) {
          setMetrics({
            totalStudyHours: m.totalStudyHours || 38,
            totalQuestionsSolved: m.totalQuestionsSolved || 1420,
            targetQuestions: m.targetQuestions || 2500,
            overallAccuracy: m.overallAccuracy || 76,
            currentStreak: m.currentStreak || 5,
            overallProgress: m.overallProgress || 68,
          });
        }
        if (json.data?.weeklyProgress && json.data.weeklyProgress.length > 0) {
          setWeeklyProgress(json.data.weeklyProgress);
        }
      }
    } catch (err) {
      console.warn('[ProgressTracker] Error fetching tracker metrics:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTrackerStats();
  }, [fetchTrackerStats]);

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
              <span>{isTamil ? 'பாடத்திட்டப் பகுப்பாய்வு' : 'Syllabus Telemetry & Analytics'}</span>
              <span className="tracker-dot">•</span>
              <span className="text-gold">{isTamil ? 'நேரலை முன்னேற்றம்' : 'Live Progress'}</span>
            </div>
            <h1 className="tracker-title">{isTamil ? 'தயாரிப்பு முன்னேற்றப் பதிவேடு' : 'Preparation Progress Tracker'}</h1>
            <p className="tracker-subtitle">
              {isTamil
                ? 'சமச்சீர் கல்வி பாடநூல்கள் (6–12ஆம் வகுப்பு) மற்றும் TNPSC அலகுகளின் முழுமையான தேர்ச்சி நிலவரம்.'
                : 'Comprehensive syllabus coverage across Samacheer Kalvi textbooks (6th–12th) and TNPSC Units.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="tracker-refresh-btn"
          onClick={() => fetchTrackerStats()}
          title={isTamil ? 'முன்னேற்றத்தைப் புதுப்பி' : 'Refresh Progress'}
        >
          <RotateCcw size={16} className={isRefreshing ? 'spinning' : ''} />
          <span>{isTamil ? 'புதுப்பி' : 'Refresh'}</span>
        </button>
      </motion.div>

      {/* 2. Top Summary Metrics Strip */}
      <div className="tracker-summary-strip glass">
        <div className="tracker-summary-item">
          <div className="tracker-summary-icon gold">
            <Clock size={18} />
          </div>
          <div>
            <span className="tracker-summary-label">{isTamil ? 'மொத்த படிப்பு நேரம்' : 'Total Study Time'}</span>
            <div className="tracker-summary-val">
              {metrics.totalStudyHours} <span className="tracker-summary-unit">{isTamil ? 'மணி' : 'hrs'}</span>
            </div>
          </div>
        </div>

        <div className="tracker-summary-divider" />

        <div className="tracker-summary-item">
          <div className="tracker-summary-icon cyan">
            <Zap size={18} />
          </div>
          <div>
            <span className="tracker-summary-label">{isTamil ? 'தீர்க்கப்பட்ட வினாக்கள்' : 'Questions Solved'}</span>
            <div className="tracker-summary-val">
              {metrics.totalQuestionsSolved.toLocaleString()}{' '}
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
            <span className="tracker-summary-label">{isTamil ? 'மொத்த துல்லியம்' : 'Overall Accuracy'}</span>
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
            <span className="tracker-summary-label">{isTamil ? 'தொடர்ச்சி நாட்கள்' : 'Active Streak'}</span>
            <div className="tracker-summary-val">
              {metrics.currentStreak} <span className="tracker-summary-unit">{isTamil ? 'நாட்கள்' : 'days'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Overall Ring & Weekly Study Split */}
      <div className="tracker-overview-split">
        {/* Left: Overall Ring Card */}
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
              <circle
                className="tracker-ring-track"
                cx="65"
                cy="65"
                r={ringRadius}
                fill="none"
                strokeWidth="10"
              />
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
                strokeDashoffset={
                  ringCircumference - (metrics.overallProgress / 100) * ringCircumference
                }
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
              You have completed {metrics.overallProgress}% of the high-yield TNPSC General Studies syllabus.
              Regular practice on weak areas will bring your readiness above 90%.
            </p>
            <div className="tracker-ring-tags">
              <span className="tracker-tag completed">
                <CheckCircle2 size={13} /> High Yield: 85%
              </span>
              <span className="tracker-tag revision">
                <BookOpen size={13} /> Active Revision: 15%
              </span>
            </div>
          </div>
        </motion.div>

        {/* Right: Weekly Study Consistency Chart */}
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
            <span className="tracker-chart-hint">45 min daily target</span>
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

      {/* 4. Samacheer Kalvi Standards Progress (Classes 6 to 12) */}
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
          {standards.map((std) => (
            <div key={std.standard} className="tracker-std-item">
              <div className="tracker-std-top">
                <span className="tracker-std-name">{std.label}</span>
                <span className="tracker-std-pct">{std.percentage}%</span>
              </div>
              <div className="tracker-std-bar-bg">
                <div
                  className="tracker-std-bar-fill"
                  style={{ width: `${std.percentage}%` }}
                />
              </div>
              <div className="tracker-std-meta">
                <span>
                  {std.completedChapters} / {std.totalChapters} Chapters
                </span>
                <span>{std.subjectCount} Subjects</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. TNPSC General Studies Unit Mastery Grid */}
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
                        <div
                          className="tracker-table-bar-fill coverage"
                          style={{ width: `${u.coverage}%` }}
                        />
                      </div>
                      <span>{u.coverage}%</span>
                    </div>
                  </td>
                  <td>
                    <div className="tracker-table-bar-cell">
                      <div className="tracker-table-bar-bg">
                        <div
                          className="tracker-table-bar-fill accuracy"
                          style={{ width: `${u.accuracy}%` }}
                        />
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
