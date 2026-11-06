import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Filter,
  RefreshCw,
  Zap,
  ZapOff,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { AnalyticsOverviewTab } from './AnalyticsOverviewTab';
import { TamilNaduMap } from './TamilNaduMap';
import { LiveMonitoringTab } from './LiveMonitoringTab';
import { TrafficAnalyticsTab } from './TrafficAnalyticsTab';
import { SubscriptionAnalyticsTab } from './SubscriptionAnalyticsTab';
import { StudentAnalyticsTab } from './StudentAnalyticsTab';
import { StudyPerformanceTab } from './StudyPerformanceTab';
import { ReportsTab } from './ReportsTab';
import './AdvancedAnalyticsDashboard.css';

interface AdvancedAnalyticsDashboardProps {
  token: string | null;
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
  onOpenNewStudent?: () => void;
  onOpenRestoreStudent?: () => void;
  hideInternalTabs?: boolean;
}

export type TabKey =
  | 'overview'
  | 'geographic'
  | 'live'
  | 'traffic'
  | 'subscriptions'
  | 'students'
  | 'performance'
  | 'reports';

export const AdvancedAnalyticsDashboard: React.FC<AdvancedAnalyticsDashboardProps> = ({
  token,
  activeTab: controlledTab,
  onTabChange,
  onOpenNewStudent,
  onOpenRestoreStudent,
  hideInternalTabs: _hideInternalTabs = false,
}) => {
  const [localTab, setLocalTab] = useState<TabKey>('overview');
  const activeTab = controlledTab || localTab;

  const handleTabSelect = (tab: TabKey) => {
    setLocalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const [dateRange, setDateRange] = useState<string>('30d');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [allowAnimations, setAllowAnimations] = useState<boolean>(true);
  const [geoMetric, setGeoMetric] = useState<
    'visitors' | 'students' | 'subscribers' | 'revenue' | 'activeToday'
  >('visitors');
  const [selectedGeoDistrict, setSelectedGeoDistrict] = useState<string | null>(null);

  // Data states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const [overviewData, setOverviewData] = useState<any>(null);
  const [kpiSummary, setKpiSummary] = useState<any[]>([]);
  const [geographicData, setGeographicData] = useState<any[]>([]);
  const [liveData, setLiveData] = useState<any>({
    activeVisitors: 0,
    activeStudents: 0,
    deviceBreakdown: { desktop: 0, mobile: 0, tablet: 0 },
    activityStream: [],
  });
  const [trafficData, setTrafficData] = useState<any>({
    timeseries: [],
    topPages: [],
    devices: [],
    browsers: [],
  });
  const [subscriptionData, setSubscriptionData] = useState<any>({
    plans: [],
    revenueTrend: [],
    recentTransactions: [],
  });
  const [studentsData, setStudentsData] = useState<any>({
    groupBreakdown: [],
    students: [],
  });
  const [performanceData, setPerformanceData] = useState<any>({
    subjects: [],
    mockTests: { totalAttempts: 0, averageScore: 0, passedCount: 0 },
  });
  const [districtsList, setDistrictsList] = useState<string[]>([]);

  // Fetch all analytics datasets
  const fetchAllAnalytics = useCallback(async (isSilent = false) => {
    const activeToken = token || localStorage.getItem('tnpsc_admin_token') || localStorage.getItem('adminToken') || localStorage.getItem('token') || '';
    if (!activeToken) return;
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    const headers = { Authorization: `Bearer ${activeToken}` };
    const query = `range=${dateRange}${districtFilter !== 'all' ? `&district=${encodeURIComponent(districtFilter)}` : ''}`;

    try {
      const [
        resOverview,
        resGeo,
        resLive,
        resTraffic,
        resSub,
        resStudents,
        resPerf,
      ] = await Promise.all([
        apiFetch(`/api/analytics/overview?${query}`, { headers }),
        apiFetch(`/api/analytics/geographic?range=${dateRange}`, { headers }),
        apiFetch(`/api/analytics/live`, { headers }),
        apiFetch(`/api/analytics/traffic?${query}`, { headers }),
        apiFetch(`/api/analytics/subscriptions?${query}`, { headers }),
        apiFetch(`/api/analytics/students?${query}`, { headers }),
        apiFetch(`/api/analytics/performance?${query}`, { headers }),
      ]);

      const [dOver, dGeo, dLive, dTraff, dSub, dStud, dPerf] = await Promise.all([
        resOverview.json().catch(() => ({})),
        resGeo.json().catch(() => ({})),
        resLive.json().catch(() => ({})),
        resTraffic.json().catch(() => ({})),
        resSub.json().catch(() => ({})),
        resStudents.json().catch(() => ({})),
        resPerf.json().catch(() => ({})),
      ]);

      if (dOver.data?.cards) setOverviewData(dOver.data.cards);
      if (dOver.data?.kpiSummary) setKpiSummary(dOver.data.kpiSummary);
      if (dGeo.data?.districts) {
        setGeographicData(dGeo.data.districts);
        setDistrictsList(dGeo.data.districts.map((d: any) => d.district));
      }
      if (dLive.data) setLiveData(dLive.data);
      if (dTraff.data) setTrafficData(dTraff.data);
      if (dSub.data) setSubscriptionData(dSub.data);
      if (dStud.data) setStudentsData(dStud.data);
      if (dPerf.data) setPerformanceData(dPerf.data);

      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('[Analytics Load Error]:', err);
      setError(err.message || 'Failed to load platform analytics.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token, dateRange, districtFilter]);

  // Initial load
  useEffect(() => {
    fetchAllAnalytics();
  }, [fetchAllAnalytics]);

  // Periodic polling for live monitor (every 10s if active on live tab, or every 45s generally)
  useEffect(() => {
    const activeToken = token || localStorage.getItem('tnpsc_admin_token') || localStorage.getItem('adminToken') || localStorage.getItem('token') || '';
    const intervalMs = activeTab === 'live' ? 10000 : 45000;
    const timer = setInterval(() => {
      if (activeToken && document.visibilityState === 'visible') {
        // Fetch live monitor lightweight
        apiFetch('/api/analytics/live', { headers: { Authorization: `Bearer ${activeToken}` } })
          .then((r) => r.json())
          .then((json) => {
            if (json.data) setLiveData(json.data);
          })
          .catch(() => {});
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [token, activeTab]);

  return (
    <div className="advanced-saas-dashboard-root">
      {/* Top Global Control Toolbar */}
      <div className="dashboard-global-toolbar glass">
        <div className="toolbar-left">
          <div className="brand-logo-pill">
            <span className="live-dot-pulse" />
            <span className="brand-pill-text">Analytics Engine</span>
          </div>

          <div className="last-sync-badge">
            <Clock size={13} />
            <span>Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        </div>

        <div className="toolbar-controls-cluster">
          {/* Global Date Range Filter */}
          <div className="control-group">
            <Calendar size={14} className="control-icon" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="toolbar-select"
              aria-label="Filter Date Range"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="yearly">Past 12 Months</option>
            </select>
          </div>

          {/* District Filter Dropdown */}
          <div className="control-group">
            <Filter size={14} className="control-icon" />
            <select
              value={districtFilter}
              onChange={(e) => {
                setDistrictFilter(e.target.value);
                if (e.target.value !== 'all') setSelectedGeoDistrict(e.target.value);
              }}
              className="toolbar-select"
              aria-label="Filter Tamil Nadu District"
            >
              <option value="all">All Tamil Nadu (38 Districts)</option>
              {districtsList.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
            </select>
          </div>

          {/* Animation Toggle */}
          <button
            type="button"
            className={`toolbar-btn-toggle ${allowAnimations ? 'active' : ''}`}
            onClick={() => setAllowAnimations(!allowAnimations)}
            title={allowAnimations ? 'Disable Chart Animations' : 'Enable Chart Animations'}
          >
            {allowAnimations ? <Zap size={14} /> : <ZapOff size={14} />}
            <span>{allowAnimations ? 'Animations On' : 'Animations Off'}</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            className={`toolbar-refresh-btn ${isRefreshing ? 'spin' : ''}`}
            onClick={() => fetchAllAnalytics(true)}
            title="Refresh All Analytics Datasets"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="analytics-error-banner glass">
          <AlertCircle size={18} className="error-icon" />
          <div className="error-text-wrap">
            <strong>Unable to load complete analytics:</strong> {error}
          </div>
          <button type="button" onClick={() => fetchAllAnalytics()} className="error-retry-btn">
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="analytics-loading-screen glass">
          <div className="loading-spinner-ring" />
          <h4 className="loading-title">Aggregating Enterprise Analytics...</h4>
          <p className="loading-subtitle">Querying database aggregations across Tamil Nadu districts</p>
        </div>
      ) : (
        /* Tab Views */
        <div className="dashboard-tab-viewport">
          {activeTab === 'overview' && overviewData && (
            <AnalyticsOverviewTab
              cards={overviewData}
              kpiSummary={kpiSummary}
              trafficTimeseries={trafficData.timeseries}
              revenueTrend={subscriptionData.revenueTrend}
              groupBreakdown={studentsData.groupBreakdown}
              subscriptionDistribution={subscriptionData.distribution}
              subscriptionSummary={subscriptionData.summary}
              performanceSummary={performanceData.performanceSummary}
              mockTests={performanceData.mockTests}
              onNavigateTab={(tab) => handleTabSelect(tab as TabKey)}
              onOpenNewStudent={onOpenNewStudent}
              onOpenRestoreStudent={onOpenRestoreStudent}
              allowAnimations={allowAnimations}
            />
          )}

          {activeTab === 'geographic' && (
            <TamilNaduMap
              districtsData={geographicData}
              activeMetric={geoMetric}
              onMetricChange={setGeoMetric}
              selectedDistrict={selectedGeoDistrict}
              onSelectDistrict={setSelectedGeoDistrict}
              allowReducedMotion={!allowAnimations}
            />
          )}

          {activeTab === 'live' && (
            <LiveMonitoringTab
              liveData={liveData}
              onRefresh={() => fetchAllAnalytics(true)}
              isRefreshing={isRefreshing}
            />
          )}

          {activeTab === 'traffic' && (
            <TrafficAnalyticsTab trafficData={trafficData} allowAnimations={allowAnimations} />
          )}

          {activeTab === 'subscriptions' && (
            <SubscriptionAnalyticsTab
              subscriptionData={subscriptionData}
              allowAnimations={allowAnimations}
            />
          )}

          {activeTab === 'students' && (
            <StudentAnalyticsTab studentsData={studentsData} allowAnimations={allowAnimations} />
          )}

          {activeTab === 'performance' && (
            <StudyPerformanceTab
              performanceData={performanceData}
              allowAnimations={allowAnimations}
            />
          )}

          {activeTab === 'reports' && overviewData && (
            <ReportsTab
              overviewCards={overviewData}
              geographicData={geographicData}
              activeRange={dateRange}
            />
          )}
        </div>
      )}
    </div>
  );
};
