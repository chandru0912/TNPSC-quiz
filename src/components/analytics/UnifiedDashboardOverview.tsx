import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar,
  Activity,
  Clock,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Shield,
  ArrowUpRight,
  AlertCircle,
  HelpCircle,
  UserPlus,
} from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { AnimatedCountUp } from './AnimatedCountUp';
import {
  TotalStudentsRing,
  ActiveStudentsGauge,
  WebsiteVisitorsWave,
  NewStudentsCounter,
  RestoredStudentsPulse,
  SubscriptionsDonut,
  TotalQuestionsSegmented,
  McqAttemptsBarChart,
  OverallAccuracyGauge,
} from './indicators';
import './indicators/Indicators.css';
import './UnifiedDashboardOverview.css';

interface OverviewCardData {
  id: string;
  title: string;
  value: number;
  formatted: string;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  comparisonText: string;
  icon: string;
  category: string;
  sparkline?: number[];
  badgeText?: string;
}

interface UnifiedOverviewData {
  overviewCards: OverviewCardData[];
  studentAnalytics: {
    totalStudents: number;
    activeStudents: number;
    activePercentage?: number;
    newStudents: number;
    newToday?: number;
    newWeekly?: number;
    newMonthly?: number;
    restoredStudents: number;
    restored7d?: number;
    prevRestored7d?: number;
    deactivatedStudents: number;
    registrationTrends: { date: string; label: string; count: number }[];
    groupBreakdown: { group: string; count: number }[];
  };
  websiteTrafficAnalytics: {
    totalVisitors: number;
    currentVisitors: number;
    dailyVisitors: number;
    weeklyVisitors: number;
    monthlyVisitors: number;
    trafficSources: { source: string; count: number; percentage: number }[];
  };
  studentPerformance: {
    overallAccuracy: number;
    totalMcqAttempts: number;
    attemptsToday?: number;
    attemptsWeekly?: number;
    attemptsMonthly?: number;
    correctAnswers?: number;
    incorrectAnswers?: number;
    participatingStudents?: number;
    averageTestScore: number;
    totalMockTests: number;
    mockTestPassRate: number;
    highPerformersCount: number;
    averagePerformersCount: number;
    needSupportCount: number;
  };
  subscriptionAnalytics: {
    activeSubscriptions: number;
    newSubscriptions: number;
    expiredSubscriptions: number;
    monthlyPass: number;
    quarterlyPass: number;
    halfYearlyPass: number;
    yearlyPass: number;
    distribution: { name: string; count: number; percentage: number; color: string }[];
  };
  questionBankAnalytics: {
    totalQuestions: number;
    publishedQuestions: number;
    stagingQuestions: number;
    bySubject: { subject: string; count: number }[];
    byGroup: { group: string; count: number }[];
  };
  studyMaterialsAnalytics: {
    totalTextbooks: number;
    completedTextbooks: number;
    totalDrivePdfs: number;
    totalStudyNotes: number;
    publishedStudyNotes: number;
    byStandard: { standard: string; count: number }[];
    bySubject: { subject: string; count: number }[];
  };
  recentActivity: {
    id: number;
    studentId: number | null;
    studentName: string;
    targetGroup: string;
    activityType: string;
    title: string;
    metadata?: any;
    createdAt: string;
  }[];
}

interface UnifiedDashboardOverviewProps {
  token: string | null;
  adminUser: { id?: number; username: string; name?: string; role?: string } | null;
  onOpenNewStudent?: () => void;
  onOpenRestoreStudent?: () => void;
  onOpenStudentPreview?: () => void;
}

export type RangeFilterType = 'today' | '7d' | '30d' | '90d';

export const UnifiedDashboardOverview: React.FC<UnifiedDashboardOverviewProps> = ({
  token,
  adminUser,
  onOpenNewStudent,
  onOpenRestoreStudent,
  onOpenStudentPreview,
}) => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [data, setData] = useState<UnifiedOverviewData | null>(null);
  const [selectedRange, setSelectedRange] = useState<RangeFilterType>('30d');

  // Active hover states for charts
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);
  const [hoveredDonutIdx, setHoveredDonutIdx] = useState<number | null>(null);

  const fetchDashboardData = useCallback(
    async (manual: boolean = false, range: RangeFilterType = selectedRange) => {
      if (manual) setIsRefreshing(true);
      setError(null);

      try {
        const activeToken =
          token ||
          localStorage.getItem('tnpsc_admin_token') ||
          localStorage.getItem('adminToken') ||
          localStorage.getItem('token') ||
          '';
        const authHeader: Record<string, string> = activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
        const res = await apiFetch(`/api/analytics/overview?range=${range}`, {
          headers: authHeader,
        });

        if (!res.ok) {
          throw new Error(`Failed to load analytics: HTTP ${res.status}`);
        }

        const json = await res.json();
        const payload: UnifiedOverviewData = json.data || json;
        setData(payload);
        setLastSyncTime(
          new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      } catch (err: any) {
        console.error('[Unified Dashboard] Error:', err);
        setError(err.message || 'Unable to connect to analytics database.');
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, selectedRange]
  );

  useEffect(() => {
    fetchDashboardData(false, selectedRange);
    // Live polling interval every 45s for fresh real-time analytics
    const interval = setInterval(() => {
      fetchDashboardData(false, selectedRange);
    }, 45000);
    return () => clearInterval(interval);
  }, [fetchDashboardData, selectedRange]);

  const handleRangeChange = (newRange: RangeFilterType) => {
    if (newRange === selectedRange) return;
    setSelectedRange(newRange);
    fetchDashboardData(true, newRange);
  };

  // Card Info Helper
  const getCardInfo = (id: string) => {
    return (
      data?.overviewCards?.find((c) => c.id === id) || {
        change: 0,
        trend: 'neutral' as const,
        comparisonText: 'vs previous period',
        sparkline: [],
        badgeText: '',
      }
    );
  };

  const cardTotalStudents = getCardInfo('total_students');
  const cardActiveStudents = getCardInfo('active_students');
  const cardVisitors = getCardInfo('website_visitors');
  const cardNewStudents = getCardInfo('new_students');
  const cardRestored = getCardInfo('restored_students');
  const cardSubs = getCardInfo('active_subscriptions');
  const cardQuestions = getCardInfo('total_questions');
  const cardMcq = getCardInfo('total_mcq_attempts');
  const cardAccuracy = getCardInfo('student_performance');

  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  // SVG Area Chart calculations for Student Registration Trends
  const trendPoints = useMemo(() => {
    const list = data?.studentAnalytics?.registrationTrends || [];
    if (list.length === 0) return { path: '', area: '', points: [] };

    const maxCount = Math.max(...list.map((l) => l.count), 5);
    const chartW = 560;
    const chartH = 160;
    const padX = 24;
    const padY = 20;
    const innerW = chartW - padX * 2;
    const innerH = chartH - padY * 2;

    const coords = list.map((item, idx) => {
      const x = padX + (idx / Math.max(1, list.length - 1)) * innerW;
      const y = padY + innerH - (item.count / maxCount) * innerH;
      return { x, y, ...item };
    });

    const linePath = coords.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    const areaPath =
      coords.length > 0
        ? `${linePath} L ${coords[coords.length - 1].x} ${chartH - padY} L ${coords[0].x} ${chartH - padY} Z`
        : '';

    return { path: linePath, area: areaPath, points: coords };
  }, [data?.studentAnalytics?.registrationTrends]);

  // Donut chart path calculations for Subscriptions
  const donutSegments = useMemo(() => {
    const dist = data?.subscriptionAnalytics?.distribution || [];
    const total = dist.reduce((acc, d) => acc + d.count, 0) || 1;

    let cumulative = 0;
    return dist.map((item) => {
      const sliceAngle = (item.count / total) * 360;
      const startAngle = cumulative;
      const endAngle = cumulative + sliceAngle;
      cumulative = endAngle;

      const r = 58;
      const cx = 80;
      const cy = 80;

      const startRad = ((startAngle - 90) * Math.PI) / 180.0;
      const endRad = ((endAngle - 90) * Math.PI) / 180.0;

      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);

      const largeArc = sliceAngle > 180 ? 1 : 0;
      const d =
        sliceAngle >= 359.9
          ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
          : `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;

      return {
        ...item,
        d,
        startAngle,
        endAngle,
      };
    });
  }, [data?.subscriptionAnalytics?.distribution]);

  const formatActivityTime = (isoString: string): string => {
    try {
      const past = new Date(isoString).getTime();
      const now = Date.now();
      const diffSec = Math.floor((now - past) / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDays = Math.floor(diffHr / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  return (
    <motion.div
      className="unified-dashboard-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      {/* 1. Futuristic Header Bar */}
      <header className="ud-header-bar" aria-label="Futuristic Dashboard Overview Header">
        <div className="ud-header-left">
          <div className="ud-badge-pill">
            <Shield size={13} className="ud-shield-icon" />
            <span>TNPSC STUDY HUB TELEMETRY</span>
          </div>
          <h1 className="ud-main-heading">Enterprise Analytics Dashboard</h1>
          <p className="ud-subheading">
            Welcome back, <strong>{adminUser?.name || 'Administrator'}</strong> &bull; Futuristic telemetry across 9 specialized indicator styles. Live PostgreSQL intelligence.
          </p>
        </div>

        <div className="ud-header-right">
          {/* Metadata chips */}
          <div className="ud-meta-cluster">
            <span className="ud-date-chip">
              <Clock size={13} />
              {currentDateFormatted}
            </span>

            <div className="ud-status-indicator" title="Connected to PostgreSQL Database">
              <span className="ud-pulse-dot" />
              <span className="ud-status-label">PostgreSQL Live</span>
            </div>

            {data?.websiteTrafficAnalytics?.currentVisitors !== undefined && (
              <span className="ud-live-pulse-badge" title="Visitors Active Right Now">
                <Activity size={13} />
                {data.websiteTrafficAnalytics.currentVisitors} Online Now
              </span>
            )}
          </div>

          {/* Action Row: Date Filters + Buttons */}
          <div className="ud-action-cluster">
            {/* Interactive Date Range Filter Buttons */}
            <div className="ud-range-filter-group" role="group" aria-label="Timeframe selection">
              {(['today', '7d', '30d', '90d'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`ud-range-btn ${selectedRange === r ? 'active' : ''}`}
                  onClick={() => handleRangeChange(r)}
                  title={`Filter data for ${r}`}
                >
                  <Calendar size={12} />
                  <span>
                    {r === 'today' ? 'Today' : r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
                  </span>
                </button>
              ))}
            </div>

            {onOpenNewStudent && (
              <button
                type="button"
                className="ud-refresh-btn"
                onClick={onOpenNewStudent}
                title="Enroll New Student"
                style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34d399' }}
              >
                <UserPlus size={14} />
                <span>+ Student</span>
              </button>
            )}

            <button
              type="button"
              className={`ud-refresh-btn ${isRefreshing ? 'spin' : ''}`}
              onClick={() => fetchDashboardData(true, selectedRange)}
              disabled={isRefreshing}
              title="Sync latest database statistics"
            >
              <RefreshCw size={14} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
            </button>

            {onOpenStudentPreview && (
              <button
                type="button"
                className="ud-preview-btn"
                onClick={onOpenStudentPreview}
                title="Launch Student Experience Simulation"
              >
                <ArrowUpRight size={14} />
                <span>Student View</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Sync Status Bar */}
      {lastSyncTime && (
        <div className="ud-sync-bar">
          <span className="ud-sync-text">
            Range: <strong>{selectedRange.toUpperCase()}</strong> &bull; Last synced: <strong>{lastSyncTime}</strong> &bull; Auto-refresh active (45s)
          </span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="ud-error-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => fetchDashboardData(true, selectedRange)}>
            Retry
          </button>
        </div>
      )}

      {/* ====================================================================
          SECTION 1: NINE ANALYTICS INDICATORS – 9 DISTINCT VISUAL STYLES
          ==================================================================== */}
      <section className="ud-section" aria-label="Nine Specialized Analytics Indicators">
        <div className="ud-section-header">
          <div className="ud-section-title-wrap">
            <Sparkles size={16} className="ud-section-sparkle" />
            <h2 className="ud-section-title">Core Performance Indicators</h2>
          </div>
          <span className="ud-section-caption">9 Distinct Animated Visualizations &bull; 100% PostgreSQL Telemetry</span>
        </div>

        {loading && !data ? (
          <div className="futuristic-indicators-grid">
            {Array.from({ length: 9 }).map((_, idx) => (
              <div key={idx} className="futuristic-indicator-card ud-card-skeleton">
                <div className="ud-skeleton-icon" />
                <div className="ud-skeleton-line short" />
                <div className="ud-skeleton-line tall" />
                <div className="ud-skeleton-line medium" />
              </div>
            ))}
          </div>
        ) : (
          <div className="futuristic-indicators-grid">
            {/* 1. Total Students: Animated Circular Progress Ring */}
            <TotalStudentsRing
              totalStudents={data?.studentAnalytics?.totalStudents || 0}
              activeStudents={data?.studentAnalytics?.activeStudents || 0}
              growthPercentage={cardTotalStudents.change}
              trend={cardTotalStudents.trend}
              comparisonText={cardTotalStudents.comparisonText}
              onClick={() => navigate('/admin/analytics/student-performance')}
            />

            {/* 2. Active Students: Animated Radial Gauge */}
            <ActiveStudentsGauge
              activeStudents={data?.studentAnalytics?.activeStudents || 0}
              totalStudents={data?.studentAnalytics?.totalStudents || 0}
              trend={cardActiveStudents.trend}
              change={cardActiveStudents.change}
              comparisonText={cardActiveStudents.comparisonText}
              onClick={() => navigate('/admin/analytics/student-performance')}
            />

            {/* 3. Website Visitors: Animated Area / Wave Graph */}
            <WebsiteVisitorsWave
              totalVisitors={data?.websiteTrafficAnalytics?.totalVisitors || 0}
              dailyVisitors={data?.websiteTrafficAnalytics?.dailyVisitors || 0}
              weeklyVisitors={data?.websiteTrafficAnalytics?.weeklyVisitors || 0}
              monthlyVisitors={data?.websiteTrafficAnalytics?.monthlyVisitors || 0}
              trend={cardVisitors.trend}
              change={cardVisitors.change}
              comparisonText={cardVisitors.comparisonText}
              sparkline={cardVisitors.sparkline}
              onClick={() => navigate('/admin/analytics/live-monitor')}
            />

            {/* 4. New Students: Animated Gradient Counter */}
            <NewStudentsCounter
              newStudents={data?.studentAnalytics?.newStudents || 0}
              newToday={data?.studentAnalytics?.newToday || 0}
              newWeekly={data?.studentAnalytics?.newWeekly || (data?.studentAnalytics?.newStudents || 0)}
              newMonthly={data?.studentAnalytics?.newMonthly || (data?.studentAnalytics?.newStudents || 0)}
              trend={cardNewStudents.trend}
              change={cardNewStudents.change}
              comparisonText={cardNewStudents.comparisonText}
              onClick={() => navigate('/admin/analytics/student-performance')}
            />

            {/* 5. Restored Students: Animated Pulse Indicator */}
            <RestoredStudentsPulse
              restoredCount={data?.studentAnalytics?.restoredStudents || 0}
              restored7d={data?.studentAnalytics?.restored7d || 0}
              prevRestored7d={data?.studentAnalytics?.prevRestored7d || 0}
              deactivatedCount={data?.studentAnalytics?.deactivatedStudents || 0}
              trend={cardRestored.trend}
              change={cardRestored.change}
              badgeText={cardRestored.badgeText}
              onClick={() => {
                if (onOpenRestoreStudent) onOpenRestoreStudent();
                else navigate('/admin/analytics/restore-student');
              }}
            />

            {/* 6. Active Subscriptions: Animated Donut Chart */}
            <SubscriptionsDonut
              activeSubscriptions={data?.subscriptionAnalytics?.activeSubscriptions || 0}
              expiredSubscriptions={data?.subscriptionAnalytics?.expiredSubscriptions || 0}
              monthlyPass={data?.subscriptionAnalytics?.monthlyPass || 0}
              quarterlyPass={data?.subscriptionAnalytics?.quarterlyPass || 0}
              halfYearlyPass={data?.subscriptionAnalytics?.halfYearlyPass || 0}
              yearlyPass={data?.subscriptionAnalytics?.yearlyPass || 0}
              distribution={data?.subscriptionAnalytics?.distribution || []}
              trend={cardSubs.trend}
              change={cardSubs.change}
              comparisonText={cardSubs.comparisonText}
              onClick={() => navigate('/admin/analytics/subscriptions')}
            />

            {/* 7. Total Questions: Animated Segmented Progress Indicator */}
            <TotalQuestionsSegmented
              totalQuestions={data?.questionBankAnalytics?.totalQuestions || 0}
              publishedQuestions={data?.questionBankAnalytics?.publishedQuestions || 0}
              stagingQuestions={data?.questionBankAnalytics?.stagingQuestions || 0}
              bySubject={data?.questionBankAnalytics?.bySubject || []}
              byGroup={data?.questionBankAnalytics?.byGroup || []}
              trend={cardQuestions.trend}
              change={cardQuestions.change}
              comparisonText={cardQuestions.comparisonText}
              onClick={() => navigate('/admin/question-bank')}
            />

            {/* 8. Total MCQ Attempts: Animated Vertical Bar Chart */}
            <McqAttemptsBarChart
              totalAttempts={data?.studentPerformance?.totalMcqAttempts || 0}
              attemptsToday={data?.studentPerformance?.attemptsToday || 0}
              attemptsWeekly={data?.studentPerformance?.attemptsWeekly || (data?.studentPerformance?.totalMcqAttempts || 0)}
              attemptsMonthly={data?.studentPerformance?.attemptsMonthly || (data?.studentPerformance?.totalMcqAttempts || 0)}
              participatingStudents={data?.studentPerformance?.participatingStudents || 0}
              trend={cardMcq.trend}
              change={cardMcq.change}
              comparisonText={cardMcq.comparisonText}
              onClick={() => navigate('/admin/analytics/student-performance')}
            />

            {/* 9. Overall Accuracy: Animated Radial Percentage Gauge */}
            <OverallAccuracyGauge
              accuracy={data?.studentPerformance?.overallAccuracy || 0}
              correctAnswers={data?.studentPerformance?.correctAnswers || 0}
              incorrectAnswers={data?.studentPerformance?.incorrectAnswers || 0}
              averageScore={data?.studentPerformance?.averageTestScore}
              trend={cardAccuracy.trend}
              change={cardAccuracy.change}
              comparisonText={cardAccuracy.comparisonText}
              onClick={() => navigate('/admin/analytics/student-performance')}
            />
          </div>
        )}
      </section>

      {/* ====================================================================
          SECTION 2: Student Growth Chart & Website Traffic Chart
          ==================================================================== */}
      <section className="ud-section ud-two-col-grid" aria-label="Student Growth & Website Traffic Visualizations">
        {/* Card A: Student Analytics & Registration Trends (Interactive Line Chart) */}
        <div className="ud-glass-card ud-chart-card">
          <div className="ud-card-header">
            <div className="ud-header-info">
              <div className="ud-card-tag indigo">STUDENT GROWTH ANALYTICS</div>
              <h3 className="ud-card-heading">Registration Trends & Trajectory</h3>
              <p className="ud-card-desc">Interactive daily student enrolments across the selected period.</p>
            </div>
            <div className="ud-stat-pill-group">
              <div className="ud-mini-stat">
                <span className="ud-mini-label">Total</span>
                <span className="ud-mini-val">
                  <AnimatedCountUp end={data?.studentAnalytics?.totalStudents || 0} />
                </span>
              </div>
              <div className="ud-mini-stat">
                <span className="ud-mini-label">Active</span>
                <span className="ud-mini-val emerald">
                  <AnimatedCountUp end={data?.studentAnalytics?.activeStudents || 0} />
                </span>
              </div>
              <div className="ud-mini-stat">
                <span className="ud-mini-label">New</span>
                <span className="ud-mini-val violet">
                  <AnimatedCountUp end={data?.studentAnalytics?.newStudents || 0} />
                </span>
              </div>
            </div>
          </div>

          <div className="ud-chart-viewport">
            <svg
              className="ud-svg-trend-chart"
              viewBox="0 0 560 160"
              preserveAspectRatio="none"
              aria-label="Student registration curve"
            >
              <defs>
                <linearGradient id="udStudentAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="24" y1="30" x2="536" y2="30" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
              <line x1="24" y1="80" x2="536" y2="80" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
              <line x1="24" y1="130" x2="536" y2="130" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />

              {/* Area & Stroke */}
              {trendPoints.area && (
                <path d={trendPoints.area} fill="url(#udStudentAreaGrad)" />
              )}
              {trendPoints.path && (
                <path
                  d={trendPoints.path}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Interactive Points */}
              {trendPoints.points.map((pt, i) => (
                <g key={i}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredTrendIdx === i ? 6 : 4}
                    fill={hoveredTrendIdx === i ? '#818cf8' : '#4f46e5'}
                    stroke="#ffffff"
                    strokeWidth={hoveredTrendIdx === i ? 2.5 : 1.5}
                    style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredTrendIdx(i)}
                    onMouseLeave={() => setHoveredTrendIdx(null)}
                  />
                </g>
              ))}
            </svg>

            {/* Hover Tooltip */}
            {hoveredTrendIdx !== null && trendPoints.points[hoveredTrendIdx] && (
              <div
                className="ud-chart-tooltip"
                style={{
                  left: `${(trendPoints.points[hoveredTrendIdx].x / 560) * 100}%`,
                  top: `${(trendPoints.points[hoveredTrendIdx].y / 160) * 100}%`,
                }}
              >
                <span className="ud-tip-date">{trendPoints.points[hoveredTrendIdx].label}</span>
                <span className="ud-tip-val">
                  {trendPoints.points[hoveredTrendIdx].count} registered
                </span>
              </div>
            )}
          </div>

          <div className="ud-chart-x-labels">
            {(data?.studentAnalytics?.registrationTrends || [])
              .filter((_, i) => i % 4 === 0 || i === (data?.studentAnalytics?.registrationTrends?.length || 0) - 1)
              .map((item, idx) => (
                <span key={idx} className="ud-x-label">
                  {item.label}
                </span>
              ))}
          </div>
        </div>

        {/* Card B: Website Traffic Analytics (Area Chart & Sources) */}
        <div className="ud-glass-card ud-traffic-card">
          <div className="ud-card-header">
            <div className="ud-header-info">
              <div className="ud-card-tag cyan">WEBSITE TRAFFIC ANALYTICS</div>
              <h3 className="ud-card-heading">Portal Hits & Traffic Sources</h3>
              <p className="ud-card-desc">Active sessions, daily visits, and acquisition breakdown.</p>
            </div>
            <div className="ud-pulse-container">
              <span className="ud-live-dot-glow" />
              <span className="ud-pulse-text">Live Heartbeat</span>
            </div>
          </div>

          {/* Traffic Metric Tiles */}
          <div className="ud-traffic-metrics-row">
            <div className="ud-traffic-tile">
              <span className="ud-tile-label">Current</span>
              <span className="ud-tile-val cyan">
                <AnimatedCountUp end={data?.websiteTrafficAnalytics?.currentVisitors || 0} />
              </span>
              <span className="ud-tile-sub">Live visitors</span>
            </div>
            <div className="ud-traffic-tile">
              <span className="ud-tile-label">Today</span>
              <span className="ud-tile-val">
                <AnimatedCountUp end={data?.websiteTrafficAnalytics?.dailyVisitors || 0} />
              </span>
              <span className="ud-tile-sub">Daily unique</span>
            </div>
            <div className="ud-traffic-tile">
              <span className="ud-tile-label">Weekly</span>
              <span className="ud-tile-val">
                <AnimatedCountUp end={data?.websiteTrafficAnalytics?.weeklyVisitors || 0} />
              </span>
              <span className="ud-tile-sub">Past 7 days</span>
            </div>
            <div className="ud-traffic-tile">
              <span className="ud-tile-label">Monthly</span>
              <span className="ud-tile-val">
                <AnimatedCountUp end={data?.websiteTrafficAnalytics?.monthlyVisitors || 0} />
              </span>
              <span className="ud-tile-sub">Past 30 days</span>
            </div>
          </div>

          {/* Traffic Sources Breakdown */}
          <div className="ud-sources-section">
            <span className="ud-section-subheading">TRAFFIC SOURCES BREAKDOWN</span>
            <div className="ud-sources-list">
              {(data?.websiteTrafficAnalytics?.trafficSources || []).map((src, i) => (
                <div key={i} className="ud-source-row">
                  <div className="ud-source-meta">
                    <span className="ud-source-name">{src.source}</span>
                    <span className="ud-source-pct">
                      {src.percentage}% ({src.count.toLocaleString('en-IN')})
                    </span>
                  </div>
                  <div className="ud-progress-track">
                    <div
                      className={`ud-progress-fill source-${i % 4}`}
                      style={{ width: `${Math.min(100, src.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 3: Student Performance & Subscription Donut Chart
          ==================================================================== */}
      <section className="ud-section ud-two-col-grid" aria-label="Performance & Subscriptions">
        {/* Card C: Student Performance Analytics */}
        <div className="ud-glass-card ud-perf-card">
          <div className="ud-card-header">
            <div className="ud-header-info">
              <div className="ud-card-tag teal">STUDENT PERFORMANCE ANALYTICS</div>
              <h3 className="ud-card-heading">Exam Readiness & Performance Bands</h3>
              <p className="ud-card-desc">Accuracy cohorts, mock pass ratios, and question practice volume.</p>
            </div>
            <button
              type="button"
              className="ud-link-btn"
              onClick={() => navigate('/admin/analytics/student-performance')}
            >
              <span>Full Analytics</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="ud-perf-metrics-grid">
            <div className="ud-perf-kpi">
              <span className="ud-kpi-sub">Overall Accuracy</span>
              <span className="ud-kpi-num teal">
                <AnimatedCountUp
                  end={data?.studentPerformance?.overallAccuracy || 0}
                  decimals={1}
                  suffix="%"
                />
              </span>
              <span className="ud-kpi-note">Across all attempts</span>
            </div>
            <div className="ud-perf-kpi">
              <span className="ud-kpi-sub">MCQ Attempts</span>
              <span className="ud-kpi-num">
                <AnimatedCountUp end={data?.studentPerformance?.totalMcqAttempts || 0} />
              </span>
              <span className="ud-kpi-note">Practice questions</span>
            </div>
            <div className="ud-perf-kpi">
              <span className="ud-kpi-sub">Avg Mock Score</span>
              <span className="ud-kpi-num gold">
                <AnimatedCountUp
                  end={data?.studentPerformance?.averageTestScore || 0}
                  decimals={1}
                  suffix="%"
                />
              </span>
              <span className="ud-kpi-note">Full syllabus mocks</span>
            </div>
            <div className="ud-perf-kpi">
              <span className="ud-kpi-sub">Mock Pass Rate</span>
              <span className="ud-kpi-num emerald">
                <AnimatedCountUp
                  end={data?.studentPerformance?.mockTestPassRate || 0}
                  suffix="%"
                />
              </span>
              <span className="ud-kpi-note">Qualified (≥50%)</span>
            </div>
          </div>

          {/* Student Performance Bands */}
          <div className="ud-bands-box">
            <div className="ud-bands-header">
              <span className="ud-bands-title">STUDENT PERFORMANCE DISTRIBUTION</span>
              <span className="ud-bands-total">
                {(data?.studentPerformance?.highPerformersCount || 0) +
                  (data?.studentPerformance?.averagePerformersCount || 0) +
                  (data?.studentPerformance?.needSupportCount || 0)}{' '}
                Aspirants Assessed
              </span>
            </div>

            {/* Stacked Band Progress Bar */}
            <div className="ud-stacked-track">
              <div
                className="ud-stacked-slice slice-high"
                style={{
                  flex: data?.studentPerformance?.highPerformersCount || 1,
                }}
                title={`High Performers: ${data?.studentPerformance?.highPerformersCount || 0}`}
              />
              <div
                className="ud-stacked-slice slice-avg"
                style={{
                  flex: data?.studentPerformance?.averagePerformersCount || 1,
                }}
                title={`Average Performers: ${data?.studentPerformance?.averagePerformersCount || 0}`}
              />
              <div
                className="ud-stacked-slice slice-low"
                style={{
                  flex: data?.studentPerformance?.needSupportCount || 1,
                }}
                title={`Need Support: ${data?.studentPerformance?.needSupportCount || 0}`}
              />
            </div>

            <div className="ud-bands-legend">
              <div className="ud-legend-item">
                <span className="ud-legend-dot high" />
                <span>High (≥75%): {data?.studentPerformance?.highPerformersCount || 0}</span>
              </div>
              <div className="ud-legend-item">
                <span className="ud-legend-dot avg" />
                <span>Average (50-74%): {data?.studentPerformance?.averagePerformersCount || 0}</span>
              </div>
              <div className="ud-legend-item">
                <span className="ud-legend-dot low" />
                <span>Need Support (&lt;50%): {data?.studentPerformance?.needSupportCount || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card D: Subscription Analytics & Donut */}
        <div className="ud-glass-card ud-subs-card">
          <div className="ud-card-header">
            <div className="ud-header-info">
              <div className="ud-card-tag purple">SUBSCRIPTION ANALYTICS</div>
              <h3 className="ud-card-heading">Active Passes & Revenue Tiers</h3>
              <p className="ud-card-desc">Breakdown of Monthly, Quarterly, Half-Yearly, and Yearly passes.</p>
            </div>
            <button
              type="button"
              className="ud-link-btn"
              onClick={() => navigate('/admin/analytics/subscriptions')}
            >
              <span>Manage Plans</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="ud-subs-content-row">
            {/* Animated SVG Donut Chart */}
            <div className="ud-donut-chart-box">
              <svg
                width="160"
                height="160"
                viewBox="0 0 160 160"
                className="ud-svg-donut"
                aria-label="Subscription Distribution Chart"
              >
                {donutSegments.map((seg, idx) => (
                  <path
                    key={idx}
                    d={seg.d}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={hoveredDonutIdx === idx ? 18 : 14}
                    strokeLinecap="round"
                    style={{ transition: 'all 0.25s ease', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredDonutIdx(idx)}
                    onMouseLeave={() => setHoveredDonutIdx(null)}
                  />
                ))}

                {/* Center Summary Counter */}
                <circle cx="80" cy="80" r="46" fill="#0f172a" />
                <text
                  x="80"
                  y="74"
                  textAnchor="middle"
                  className="ud-donut-center-num"
                  fill="#ffffff"
                >
                  {data?.subscriptionAnalytics?.activeSubscriptions || 0}
                </text>
                <text
                  x="80"
                  y="92"
                  textAnchor="middle"
                  className="ud-donut-center-sub"
                  fill="#94a3b8"
                >
                  ACTIVE
                </text>
              </svg>

              {hoveredDonutIdx !== null && donutSegments[hoveredDonutIdx] && (
                <div className="ud-donut-tip">
                  <span>{donutSegments[hoveredDonutIdx].name}</span>
                  <strong>{donutSegments[hoveredDonutIdx].count} subscribers</strong>
                </div>
              )}
            </div>

            {/* Subscription Pass Breakdown Cards */}
            <div className="ud-subs-legend-col">
              <div className="ud-sub-tier-row">
                <div className="ud-tier-left">
                  <span className="ud-tier-swatch blue" />
                  <span className="ud-tier-name">Monthly Pass</span>
                </div>
                <span className="ud-tier-val">
                  <AnimatedCountUp end={data?.subscriptionAnalytics?.monthlyPass || 0} />
                </span>
              </div>

              <div className="ud-sub-tier-row">
                <div className="ud-tier-left">
                  <span className="ud-tier-swatch purple" />
                  <span className="ud-tier-name">Quarterly Pass</span>
                </div>
                <span className="ud-tier-val">
                  <AnimatedCountUp end={data?.subscriptionAnalytics?.quarterlyPass || 0} />
                </span>
              </div>

              <div className="ud-sub-tier-row">
                <div className="ud-tier-left">
                  <span className="ud-tier-swatch pink" />
                  <span className="ud-tier-name">Half-Yearly Pass</span>
                </div>
                <span className="ud-tier-val">
                  <AnimatedCountUp end={data?.subscriptionAnalytics?.halfYearlyPass || 0} />
                </span>
              </div>

              <div className="ud-sub-tier-row">
                <div className="ud-tier-left">
                  <span className="ud-tier-swatch green" />
                  <span className="ud-tier-name">Yearly Pass</span>
                </div>
                <span className="ud-tier-val">
                  <AnimatedCountUp end={data?.subscriptionAnalytics?.yearlyPass || 0} />
                </span>
              </div>

              <div className="ud-sub-tier-row expired-row">
                <div className="ud-tier-left">
                  <span className="ud-tier-swatch gray" />
                  <span className="ud-tier-name">Expired / Lapsed</span>
                </div>
                <span className="ud-tier-val gray">
                  <AnimatedCountUp end={data?.subscriptionAnalytics?.expiredSubscriptions || 0} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 4: Question Bank & Study Materials Analytics
          ==================================================================== */}
      <section className="ud-section ud-two-col-grid" aria-label="Content Management Statistics">
        {/* Card E: Question Bank Analytics */}
        <div className="ud-glass-card ud-qb-card">
          <div className="ud-card-header">
            <div className="ud-header-info">
              <div className="ud-card-tag rose">QUESTION BANK ANALYTICS</div>
              <h3 className="ud-card-heading">Curated & Staged MCQs</h3>
              <p className="ud-card-desc">Subject distribution and syllabus group classifications in PostgreSQL.</p>
            </div>
            <button
              type="button"
              className="ud-link-btn"
              onClick={() => navigate('/admin/question-bank')}
            >
              <span>Manage Bank</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="ud-qb-metric-tiles">
            <div className="ud-qb-tile">
              <span className="ud-tile-label">Total Questions</span>
              <span className="ud-tile-val rose">
                <AnimatedCountUp end={data?.questionBankAnalytics?.totalQuestions || 0} />
              </span>
              <span className="ud-tile-sub">Database count</span>
            </div>
            <div className="ud-qb-tile">
              <span className="ud-tile-label">Published</span>
              <span className="ud-tile-val emerald">
                <AnimatedCountUp end={data?.questionBankAnalytics?.publishedQuestions || 0} />
              </span>
              <span className="ud-tile-sub">Live for students</span>
            </div>
            <div className="ud-qb-tile">
              <span className="ud-tile-label">Staging</span>
              <span className="ud-tile-val amber">
                <AnimatedCountUp end={data?.questionBankAnalytics?.stagingQuestions || 0} />
              </span>
              <span className="ud-tile-sub">Under review</span>
            </div>
          </div>

          {/* Questions By Subject */}
          <div className="ud-subjects-list-wrap">
            <span className="ud-section-subheading">QUESTIONS BY SUBJECT</span>
            {data?.questionBankAnalytics?.bySubject && data.questionBankAnalytics.bySubject.length > 0 ? (
              <div className="ud-subj-bars">
                {data.questionBankAnalytics.bySubject.map((subj, idx) => {
                  const maxCount = Math.max(
                    ...data.questionBankAnalytics.bySubject.map((s) => s.count),
                    1
                  );
                  const pct = Math.round((subj.count / maxCount) * 100);
                  return (
                    <div key={idx} className="ud-subj-row">
                      <div className="ud-subj-meta">
                        <span className="ud-subj-name">{subj.subject}</span>
                        <span className="ud-subj-count">{subj.count} MCQs</span>
                      </div>
                      <div className="ud-progress-track">
                        <div className="ud-progress-fill rose" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ud-empty-slate">
                <HelpCircle size={16} />
                <span>No subject distribution yet in database. Use AI generator to seed.</span>
              </div>
            )}
          </div>
        </div>

        {/* Card F: Study Materials Analytics */}
        <div className="ud-glass-card ud-sm-card">
          <div className="ud-card-header">
            <div className="ud-header-info">
              <div className="ud-card-tag gold">STUDY MATERIALS ANALYTICS</div>
              <h3 className="ud-card-heading">Textbooks, Drive PDFs & Notes</h3>
              <p className="ud-card-desc">Indexing status across Samacheer Kalvi standards 6th to 12th.</p>
            </div>
            <button
              type="button"
              className="ud-link-btn"
              onClick={() => navigate('/admin/textbook-management')}
            >
              <span>Textbooks</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="ud-qb-metric-tiles">
            <div className="ud-qb-tile">
              <span className="ud-tile-label">Textbooks in DB</span>
              <span className="ud-tile-val gold">
                <AnimatedCountUp end={data?.studyMaterialsAnalytics?.totalTextbooks || 0} />
              </span>
              <span className="ud-tile-sub">Samacheer books</span>
            </div>
            <div className="ud-qb-tile">
              <span className="ud-tile-label">Google Drive PDFs</span>
              <span className="ud-tile-val cyan">
                <AnimatedCountUp end={data?.studyMaterialsAnalytics?.totalDrivePdfs || 0} />
              </span>
              <span className="ud-tile-sub">Cloud streamed</span>
            </div>
            <div className="ud-qb-tile">
              <span className="ud-tile-label">Study Notes</span>
              <span className="ud-tile-val purple">
                <AnimatedCountUp end={data?.studyMaterialsAnalytics?.totalStudyNotes || 0} />
              </span>
              <span className="ud-tile-sub">Comprehensive guides</span>
            </div>
          </div>

          {/* Standard Distribution */}
          <div className="ud-standards-wrap">
            <span className="ud-section-subheading">INDEXED BY STANDARD (CLASSES 6 - 12)</span>
            <div className="ud-standards-grid">
              {['6', '7', '8', '9', '10', '11', '12'].map((std) => {
                const found = data?.studyMaterialsAnalytics?.byStandard?.find(
                  (s) => String(s.standard) === std
                );
                const count = found ? found.count : 0;
                return (
                  <div key={std} className={`ud-std-badge ${count > 0 ? 'active' : ''}`}>
                    <span className="ud-std-title">Class {std}</span>
                    <span className="ud-std-num">{count} Books</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 5: Recent Platform Activity Stream (Only if records exist)
          ==================================================================== */}
      {data?.recentActivity && data.recentActivity.length > 0 && (
        <section className="ud-section ud-activity-section" aria-label="Recent Platform Activity Stream">
          <div className="ud-section-header">
            <div className="ud-section-title-wrap">
              <Activity size={16} className="ud-section-sparkle emerald" />
              <h2 className="ud-section-title">Recent Platform Events & Audit Stream</h2>
            </div>
            <span className="ud-section-caption">Real-Time Student Activity</span>
          </div>

          <div className="ud-glass-card ud-activity-card">
            <div className="ud-activity-list">
              {data.recentActivity.map((act) => (
                <div key={act.id} className="ud-activity-item">
                  <div className="ud-activity-icon-box">
                    <Activity size={14} className="act-icon-indigo" />
                  </div>
                  <div className="ud-activity-details">
                    <div className="ud-act-line-1">
                      <span className="ud-act-student-name">{act.studentName}</span>
                      <span className="ud-act-group-badge">{act.targetGroup}</span>
                      <span className="ud-act-title">{act.title}</span>
                    </div>
                    {act.metadata && (
                      <div className="ud-act-metadata">
                        {act.metadata.score !== undefined && (
                          <span className="ud-meta-tag">
                            Score: {act.metadata.score}/{act.metadata.maxScore} ({act.metadata.percentage}%)
                          </span>
                        )}
                        {act.metadata.targetGroup && (
                          <span className="ud-meta-tag">Target: {act.metadata.targetGroup}</span>
                        )}
                        {act.metadata.restoredAt && (
                          <span className="ud-meta-tag amber">Account Reactivated</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="ud-activity-timestamp">
                    <Clock size={12} />
                    <span>{formatActivityTime(act.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </motion.div>
  );
};
