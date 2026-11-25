import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LogIn,
  Users,
  Calendar,
  Clock,
  Activity,
  Repeat,
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Mail,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Eye,
  Monitor,
  Globe,
  Cpu,
  LayoutDashboard,
  ListChecks,
} from 'lucide-react';
import { apiFetch } from '../../../utils/api';
import './StudentLoginHistoryPage.css';

interface StudentLoginHistoryPageProps {
  token: string | null;
}

type ActiveSectionTab = 'overview' | 'users' | 'events' | 'sessions';
type DateRangeKey = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'custom' | 'all';
type UsersRangeKey = 'all' | 'today' | '7d' | '30d' | '90d' | 'custom';
type UsersSortKey = 'latest_login' | 'highest_count' | 'first_login';

interface LoginEventRow {
  serialNo: number;
  eventId: string;
  studentId: number;
  studentEmail: string;
  studentName: string | null;
  dateKey: string;
  dateFormatted: string;
  displayDate: string;
  loginTime: string;
  loginTimestamp: string;
  authenticationMethod: string;
  loginStatus: string;
  sessionStatus: 'Online' | 'Offline' | 'Expired';
  lastActivityAt: string | null;
  isReturningLogin: boolean;
}

interface DailyGroup {
  dateKey: string;
  displayDate: string;
  totalLoginEvents: number;
  uniqueStudentsLoggedIn: number;
  events: LoginEventRow[];
}

interface LoginHistoryPayload {
  summary: {
    totalLoginEvents: number;
    uniqueStudentsLoggedIn: number;
    todayLoginEvents: number;
    todayUniqueStudents: number;
    currentlyOnlineStudents: number;
    returningStudentLogins: number;
  };
  dailyGroups: DailyGroup[];
  rows: LoginEventRow[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  trackingActivatedAt: string | null;
  timezone: string;
  serverTimestamp: string;
}

interface StudentLoginUserRow {
  serialNo: number;
  userId: number;
  studentName: string;
  studentEmail: string;
  firstLoginAt: string | null;
  lastLoginAt: string | null;
  totalLoginCount: number;
  todayLoginCount: number;
  lastLoginMethod: string;
  lastDevice: string;
  lastBrowser: string;
  lastOs: string;
  isOnline: boolean;
  accountStatus: 'Active' | 'Inactive';
}

interface StudentLoginUsersPayload {
  summary: {
    totalUniqueLoginUsers: number;
    totalLoginEvents: number;
    todayUniqueLoginUsers: number;
    todayTotalLoginEvents: number;
    currentlyActiveStudents: number;
    returningStudents: number;
    newStudents: number;
  };
  users: StudentLoginUserRow[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  timezone: string;
  serverTimestamp: string;
}

interface StudentLoginUserDetail {
  userId: number;
  studentName: string;
  studentEmail: string;
  targetGroup: string;
  district: string;
  registeredAt: string | null;
  firstLoginAt: string | null;
  lastLoginAt: string | null;
  totalLoginCount: number;
  todayLoginCount: number;
  lastLoginMethod: string;
  accountStatus: 'Active' | 'Inactive';
  isOnline: boolean;
  deviceHistory: string[];
  browserHistory: string[];
  osHistory: string[];
  sessionHistory: {
    sessionId: string;
    device: string;
    browser: string;
    os: string;
    authMethod: string;
    sessionStatus: string;
    createdAt: string;
    lastActiveAt: string;
    revokedAt: string | null;
  }[];
  loginEvents: {
    serialNo: number;
    eventId: string;
    loginDate: string;
    displayDate: string;
    loginTime: string;
    loginTimestamp: string;
    loginMethod: string;
    device: string;
    browser: string;
    os: string;
    sessionStatus: string;
  }[];
}

function formatIstDateTime(iso: string | null): string {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'N/A';
  }
}

function triggerCsvDownload(csvText: string, filename: string) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const StudentLoginHistoryPage: React.FC<StudentLoginHistoryPageProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<ActiveSectionTab>('users');

  // Individual Login Events filters (existing)
  const [range, setRange] = useState<DateRangeKey>('30d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [method, setMethod] = useState<'all' | 'google' | 'email'>('all');
  const [sessionStatus, setSessionStatus] = useState<'all' | 'online' | 'offline' | 'expired'>('all');
  const [page, setPage] = useState<number>(1);
  const limit = 50;

  // Student Login Users filters (new separate dataset)
  const [usersRange, setUsersRange] = useState<UsersRangeKey>('all');
  const [usersStartDate, setUsersStartDate] = useState<string>('');
  const [usersEndDate, setUsersEndDate] = useState<string>('');
  const [usersSearchInput, setUsersSearchInput] = useState<string>('');
  const [debouncedUsersSearch, setDebouncedUsersSearch] = useState<string>('');
  const [usersMethod, setUsersMethod] = useState<'all' | 'google' | 'email'>('all');
  const [usersStatus, setUsersStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [usersSortBy, setUsersSortBy] = useState<UsersSortKey>('latest_login');
  const [usersPage, setUsersPage] = useState<number>(1);
  const usersLimit = 25;

  // Data states
  const [data, setData] = useState<LoginHistoryPayload | null>(null);
  const [usersData, setUsersData] = useState<StudentLoginUsersPayload | null>(null);
  const [activeDeviceSessions, setActiveDeviceSessions] = useState<
    {
      studentId: number;
      studentEmail: string;
      studentName: string | null;
      deviceType: string;
      browserName: string;
      osName: string;
      authMethod: string;
      loginDate: string;
      loginTime: string;
      lastActiveTime: string;
      sessionStatus: string;
      previousRevocationTime: string;
    }[]
  >([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [usersLoading, setUsersLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<'connected' | 'reconnecting' | 'polling'>('polling');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Individual Student Details Modal state
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [selectedDetail, setSelectedDetail] = useState<StudentLoginUserDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const openDetailStudentIdRef = useRef<number | null>(null);

  // Debounce search inputs
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedUsersSearch(usersSearchInput.trim());
      setUsersPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [usersSearchInput]);

  const getActiveToken = useCallback(() => {
    return (
      token ||
      localStorage.getItem('tnpsc_admin_token') ||
      localStorage.getItem('adminToken') ||
      localStorage.getItem('token') ||
      ''
    );
  }, [token]);

  const buildEventsQueryString = useCallback(
    (includePagination = true) => {
      const qs = new URLSearchParams();
      qs.set('range', range);
      if (range === 'custom') {
        if (startDate) qs.set('startDate', startDate);
        if (endDate) qs.set('endDate', endDate);
      }
      if (debouncedSearch) qs.set('search', debouncedSearch);
      if (method !== 'all') qs.set('method', method);
      if (sessionStatus !== 'all') qs.set('sessionStatus', sessionStatus);
      if (includePagination) {
        qs.set('page', String(page));
        qs.set('limit', String(limit));
      }
      return qs.toString();
    },
    [range, startDate, endDate, debouncedSearch, method, sessionStatus, page]
  );

  const buildUsersQueryString = useCallback(
    (includePagination = true) => {
      const qs = new URLSearchParams();
      qs.set('range', usersRange);
      if (usersRange === 'custom') {
        if (usersStartDate) qs.set('startDate', usersStartDate);
        if (usersEndDate) qs.set('endDate', usersEndDate);
      }
      if (debouncedUsersSearch) qs.set('search', debouncedUsersSearch);
      if (usersMethod !== 'all') qs.set('method', usersMethod);
      if (usersStatus !== 'all') qs.set('status', usersStatus);
      qs.set('sortBy', usersSortBy);
      if (includePagination) {
        qs.set('page', String(usersPage));
        qs.set('limit', String(usersLimit));
      }
      return qs.toString();
    },
    [usersRange, usersStartDate, usersEndDate, debouncedUsersSearch, usersMethod, usersStatus, usersSortBy, usersPage]
  );

  const loadLoginHistory = useCallback(
    async (silent = false) => {
      const activeToken = getActiveToken();
      if (!activeToken) return;
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const [res, sessRes] = await Promise.all([
          apiFetch(`/api/analytics/login-history?${buildEventsQueryString(true)}`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          apiFetch(`/api/analytics/active-sessions`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
        ]);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.status !== 'success') {
          throw new Error(json.message || `Failed to load login history (HTTP ${res.status})`);
        }
        setData(json.data);
        if (sessRes.ok) {
          const sJson = await sessRes.json().catch(() => ({}));
          if (sJson.status === 'success' && Array.isArray(sJson.data?.sessions)) {
            setActiveDeviceSessions(sJson.data.sessions);
          }
        }
        setLastSyncedAt(new Date());
      } catch (err: any) {
        setError(err.message || 'Unable to load student login history from PostgreSQL.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getActiveToken, buildEventsQueryString]
  );

  const loadLoginUsers = useCallback(
    async (silent = false) => {
      const activeToken = getActiveToken();
      if (!activeToken) return;
      if (!silent) setUsersLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const res = await apiFetch(`/api/analytics/login-users?${buildUsersQueryString(true)}`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.status !== 'success') {
          throw new Error(json.message || `Failed to load student login users (HTTP ${res.status})`);
        }
        setUsersData(json.data);
        setLastSyncedAt(new Date());
      } catch (err: any) {
        setError(err.message || 'Unable to load unique student login users from PostgreSQL.');
      } finally {
        setUsersLoading(false);
        setRefreshing(false);
      }
    },
    [getActiveToken, buildUsersQueryString]
  );

  const refreshAll = useCallback(
    async (silent = true) => {
      await Promise.all([loadLoginUsers(silent), loadLoginHistory(silent)]);
    },
    [loadLoginUsers, loadLoginHistory]
  );

  useEffect(() => {
    void loadLoginHistory(false);
  }, [loadLoginHistory]);

  useEffect(() => {
    void loadLoginUsers(false);
  }, [loadLoginUsers]);

  const handleOpenStudentDetail = useCallback(
    async (studentId: number, silent = false) => {
      const activeToken = getActiveToken();
      if (!activeToken) return;
      openDetailStudentIdRef.current = studentId;
      if (!silent) {
        setDetailLoading(true);
        setDetailError(null);
        setSelectedDetail(null);
      }

      try {
        const res = await apiFetch(`/api/analytics/login-users/${studentId}`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.status !== 'success') {
          throw new Error(json.message || 'Failed to load student login profile.');
        }
        if (openDetailStudentIdRef.current === studentId) {
          setSelectedDetail(json.data);
        }
      } catch (err: any) {
        if (!silent) {
          setDetailError(err.message || 'Failed to load student login details.');
        }
      } finally {
        if (!silent) setDetailLoading(false);
      }
    },
    [getActiveToken]
  );

  // Real-time SSE stream subscription (debounced to prevent duplicate event bursts)
  useEffect(() => {
    const activeToken = getActiveToken();
    if (!activeToken || typeof EventSource === 'undefined') {
      setSseStatus('polling');
      return;
    }

    let es: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let debounceTimer: number | null = null;
    let closed = false;

    const scheduleSync = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        void refreshAll(true);
        if (openDetailStudentIdRef.current) {
          void handleOpenStudentDetail(openDetailStudentIdRef.current, true);
        }
      }, 350);
    };

    const connect = () => {
      if (closed) return;
      try {
        const streamUrl = `/api/analytics/stream?token=${encodeURIComponent(activeToken)}&range=today`;
        es = new EventSource(streamUrl);
        es.addEventListener('connected', () => {
          setSseStatus('connected');
        });
        es.addEventListener('metrics_updated', (ev: MessageEvent) => {
          try {
            const payload = JSON.parse(ev.data || '{}');
            const topics: string[] = Array.isArray(payload.topics) ? payload.topics : [];
            if (
              topics.length === 0 ||
              topics.includes('student_login') ||
              topics.includes('student_logout') ||
              topics.includes('student_registered') ||
              topics.includes('visitor_hit')
            ) {
              scheduleSync();
            }
          } catch {
            scheduleSync();
          }
        });
        es.onerror = () => {
          es?.close();
          if (closed) return;
          setSseStatus('reconnecting');
          reconnectTimer = window.setTimeout(connect, 5000);
        };
      } catch {
        setSseStatus('polling');
      }
    };

    connect();
    return () => {
      closed = true;
      es?.close();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (debounceTimer) window.clearTimeout(debounceTimer);
    };
  }, [getActiveToken, refreshAll, handleOpenStudentDetail]);

  // CSV Exports (4 dedicated real-DB exports)
  const handleExportCsv = async (
    kind: 'all_users' | 'filtered_users' | 'events' | 'individual',
    studentId?: number
  ) => {
    const activeToken = getActiveToken();
    if (!activeToken) return;
    setExportingKey(kind);
    try {
      let endpoint = '';
      let fallbackFilename = `export-${new Date().toISOString().slice(0, 10)}.csv`;

      if (kind === 'all_users') {
        endpoint = `/api/analytics/login-users/export?scope=all&sortBy=${encodeURIComponent(usersSortBy)}`;
        fallbackFilename = `student-login-users-all-${new Date().toISOString().slice(0, 10)}.csv`;
      } else if (kind === 'filtered_users') {
        endpoint = `/api/analytics/login-users/export?scope=filtered&${buildUsersQueryString(false)}`;
        fallbackFilename = `student-login-users-filtered-${new Date().toISOString().slice(0, 10)}.csv`;
      } else if (kind === 'events') {
        endpoint = `/api/analytics/login-history/export?${buildEventsQueryString(false)}`;
        fallbackFilename = `student-login-events-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
      } else if (kind === 'individual' && studentId) {
        endpoint = `/api/analytics/login-users/${studentId}/export`;
        fallbackFilename = `student-login-history-uid-${studentId}-${new Date().toISOString().slice(0, 10)}.csv`;
      }

      const res = await apiFetch(endpoint, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (!res.ok) {
        throw new Error(`Export failed (HTTP ${res.status})`);
      }
      const csvText = await res.text();
      triggerCsvDownload(csvText, fallbackFilename);
    } catch (err: any) {
      setError(err.message || 'Failed to export CSV.');
    } finally {
      setExportingKey(null);
    }
  };

  const userSummary = usersData?.summary || {
    totalUniqueLoginUsers: data?.summary.uniqueStudentsLoggedIn || 0,
    totalLoginEvents: data?.summary.totalLoginEvents || 0,
    todayUniqueLoginUsers: data?.summary.todayUniqueStudents || 0,
    todayTotalLoginEvents: data?.summary.todayLoginEvents || 0,
    currentlyActiveStudents: data?.summary.currentlyOnlineStudents || 0,
    returningStudents: 0,
    newStudents: 0,
  };

  const activeSessionsCount = activeDeviceSessions.filter((s) => s.sessionStatus === 'Active').length;

  return (
    <div className="slh-page-root">
      {/* Header Row */}
      <div className="slh-header-bar glass">
        <div className="slh-header-left">
          <div className="slh-title-row">
            <h1 className="slh-title">Student Login History &amp; Users Registry</h1>
            <span className={`slh-sse-pill ${sseStatus}`}>
              <span className="slh-sse-dot" />
              {sseStatus === 'connected'
                ? 'Live SSE Connected'
                : sseStatus === 'reconnecting'
                  ? 'Reconnecting SSE...'
                  : 'Polling Sync'}
            </span>
          </div>
          <p className="slh-subtitle">
            Separate Unique Student Login Users Database &amp; Day-by-Day Login Events (Asia/Kolkata IST)
            {lastSyncedAt && (
              <>
                {' '}
                &bull; Updated{' '}
                {lastSyncedAt.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </>
            )}
          </p>
        </div>

        <div className="slh-header-actions">
          <button
            type="button"
            className="slh-btn slh-btn-outline"
            onClick={() => void refreshAll(true)}
            disabled={refreshing || loading || usersLoading}
          >
            <RefreshCw size={14} className={refreshing ? 'slh-spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
          <button
            type="button"
            className="slh-btn slh-btn-outline"
            onClick={() => void handleExportCsv('all_users')}
            disabled={exportingKey !== null || usersLoading}
          >
            <Download size={14} />
            <span>{exportingKey === 'all_users' ? 'Exporting...' : 'Export All Users'}</span>
          </button>
          <button
            type="button"
            className="slh-btn slh-btn-primary"
            onClick={() =>
              void handleExportCsv(activeTab === 'events' ? 'events' : 'filtered_users')
            }
            disabled={exportingKey !== null || loading || usersLoading}
          >
            <Download size={14} />
            <span>
              {exportingKey === 'events' || exportingKey === 'filtered_users'
                ? 'Exporting...'
                : activeTab === 'events'
                  ? 'Export Login Events'
                  : 'Export Filtered Users'}
            </span>
          </button>
        </div>
      </div>

      {/* Section Navigation Tabs */}
      <div className="slh-tabs-bar glass" role="tablist" aria-label="Student Login History Sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overview'}
          className={`slh-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <LayoutDashboard size={15} />
          <span>Login Overview</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'users'}
          className={`slh-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={15} />
          <span>Student Login Users</span>
          <span className="slh-tab-count">{userSummary.totalUniqueLoginUsers.toLocaleString('en-IN')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'events'}
          className={`slh-tab-btn ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <ListChecks size={15} />
          <span>Individual Login Events</span>
          <span className="slh-tab-count">{userSummary.totalLoginEvents.toLocaleString('en-IN')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sessions'}
          className={`slh-tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          <ShieldCheck size={15} />
          <span>Active Sessions</span>
          <span className="slh-tab-count emerald">{activeSessionsCount.toLocaleString('en-IN')}</span>
        </button>
      </div>

      {error && (
        <div className="slh-error-banner">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => void refreshAll(false)}>
            Retry
          </button>
        </div>
      )}

      {/* 7 Summary Cards (Always visible in Overview & Student Login Users, compact context) */}
      {(activeTab === 'overview' || activeTab === 'users' || activeTab === 'events') && (
        <div className="slh-summary-grid slh-summary-grid-7">
          <div className="slh-stat-card glass">
            <div className="slh-stat-top">
              <span className="slh-stat-label">Total Unique Login Users</span>
              <Users size={16} className="slh-icon-cyan" />
            </div>
            <div className="slh-stat-value slh-cyan">
              {userSummary.totalUniqueLoginUsers.toLocaleString('en-IN')}
            </div>
            <span className="slh-stat-hint">1 unique record per user ID</span>
          </div>

          <div className="slh-stat-card glass">
            <div className="slh-stat-top">
              <span className="slh-stat-label">Total Login Events</span>
              <LogIn size={16} className="slh-icon-indigo" />
            </div>
            <div className="slh-stat-value">
              {userSummary.totalLoginEvents.toLocaleString('en-IN')}
            </div>
            <span className="slh-stat-hint">All successful authentications</span>
          </div>

          <div className="slh-stat-card glass">
            <div className="slh-stat-top">
              <span className="slh-stat-label">Today&apos;s Unique Login Users</span>
              <ShieldCheck size={16} className="slh-icon-emerald" />
            </div>
            <div className="slh-stat-value slh-emerald">
              {userSummary.todayUniqueLoginUsers.toLocaleString('en-IN')}
            </div>
            <span className="slh-stat-hint">Distinct students today (IST)</span>
          </div>

          <div className="slh-stat-card glass">
            <div className="slh-stat-top">
              <span className="slh-stat-label">Today&apos;s Total Login Events</span>
              <Calendar size={16} className="slh-icon-amber" />
            </div>
            <div className="slh-stat-value slh-amber">
              {userSummary.todayTotalLoginEvents.toLocaleString('en-IN')}
            </div>
            <span className="slh-stat-hint">Successful logins today (IST)</span>
          </div>

          <div className="slh-stat-card glass">
            <div className="slh-stat-top">
              <span className="slh-stat-label">Currently Active Students</span>
              <Activity size={16} className="slh-icon-emerald" />
            </div>
            <div className="slh-stat-value slh-emerald">
              {userSummary.currentlyActiveStudents.toLocaleString('en-IN')}
            </div>
            <span className="slh-stat-hint">Live session (&le; 5m heartbeat)</span>
          </div>

          <div className="slh-stat-card glass">
            <div className="slh-stat-top">
              <span className="slh-stat-label">Returning Students</span>
              <Repeat size={16} className="slh-icon-purple" />
            </div>
            <div className="slh-stat-value slh-purple">
              {userSummary.returningStudents.toLocaleString('en-IN')}
            </div>
            <span className="slh-stat-hint">Total login count &gt; 1</span>
          </div>

          <div className="slh-stat-card glass">
            <div className="slh-stat-top">
              <span className="slh-stat-label">New Students</span>
              <UserPlus size={16} className="slh-icon-gold" />
            </div>
            <div className="slh-stat-value slh-gold">
              {userSummary.newStudents.toLocaleString('en-IN')}
            </div>
            <span className="slh-stat-hint">First-time login (count = 1)</span>
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 1: LOGIN OVERVIEW
         ========================================================= */}
      {activeTab === 'overview' && (
        <div className="slh-overview-grid">
          <section className="slh-day-section glass">
            <div className="slh-day-header">
              <div className="slh-day-title-wrap">
                <Users size={16} className="slh-icon-cyan" />
                <h2 className="slh-day-heading">Recent Unique Student Login Users</h2>
              </div>
              <button
                type="button"
                className="slh-btn slh-btn-outline"
                onClick={() => setActiveTab('users')}
              >
                <span>Open Full Users Registry</span>
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="slh-table-wrap">
              <table className="slh-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Student Email</th>
                    <th>User ID</th>
                    <th>Total Logins</th>
                    <th>Last Login</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(usersData?.users || []).slice(0, 8).map((u) => (
                    <tr key={u.userId}>
                      <td className="slh-nowrap">{u.studentName}</td>
                      <td>
                        <button
                          type="button"
                          className="slh-email-btn"
                          onClick={() => void handleOpenStudentDetail(u.userId)}
                        >
                          <Mail size={13} />
                          <span>{u.studentEmail}</span>
                        </button>
                      </td>
                      <td className="slh-sno">#{u.userId}</td>
                      <td>
                        <span className="slh-count-badge">{u.totalLoginCount}</span>
                      </td>
                      <td className="slh-nowrap slh-muted">{formatIstDateTime(u.lastLoginAt)}</td>
                      <td>
                        <span className={`slh-session-pill ${u.accountStatus === 'Active' ? 'online' : 'offline'}`}>
                          <span className="slh-session-dot" />
                          <span>{u.accountStatus}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!usersData || usersData.users.length === 0) && (
                    <tr>
                      <td colSpan={6} className="slh-muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
                        No unique student login users recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="slh-day-section glass">
            <div className="slh-day-header">
              <div className="slh-day-title-wrap">
                <LogIn size={16} className="slh-day-icon" />
                <h2 className="slh-day-heading">Recent Individual Login Events</h2>
              </div>
              <button
                type="button"
                className="slh-btn slh-btn-outline"
                onClick={() => setActiveTab('events')}
              >
                <span>Open Full Login Events</span>
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="slh-table-wrap">
              <table className="slh-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Student Email</th>
                    <th>Method</th>
                    <th>Session</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows || []).slice(0, 8).map((r) => (
                    <tr key={r.eventId}>
                      <td className="slh-nowrap">{r.dateFormatted}</td>
                      <td className="slh-nowrap slh-time">{r.loginTime}</td>
                      <td>
                        <button
                          type="button"
                          className="slh-email-btn"
                          onClick={() => void handleOpenStudentDetail(r.studentId)}
                        >
                          <Mail size={13} />
                          <span>{r.studentEmail}</span>
                        </button>
                      </td>
                      <td>
                        <span
                          className={`slh-method-pill ${
                            r.authenticationMethod === 'Google OAuth' ? 'google' : 'email'
                          }`}
                        >
                          {r.authenticationMethod}
                        </span>
                      </td>
                      <td>
                        <span className={`slh-session-pill ${r.sessionStatus.toLowerCase()}`}>
                          <span className="slh-session-dot" />
                          <span>{r.sessionStatus}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!data || data.rows.length === 0) && (
                    <tr>
                      <td colSpan={5} className="slh-muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
                        No individual login events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================
          TAB 2: STUDENT LOGIN USERS (UNIQUE REGISTRY)
         ========================================================= */}
      {activeTab === 'users' && (
        <>
          <div className="slh-filters-bar glass">
            <div className="slh-range-pills">
              {(
                [
                  { key: 'all', label: 'All Time' },
                  { key: 'today', label: "Today's Logins" },
                  { key: '7d', label: 'Last 7 Days' },
                  { key: '30d', label: 'Last 30 Days' },
                  { key: '90d', label: 'Last 90 Days' },
                  { key: 'custom', label: 'Custom Range' },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`slh-range-btn ${usersRange === item.key ? 'active' : ''}`}
                  onClick={() => {
                    setUsersRange(item.key);
                    setUsersPage(1);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="slh-filter-inputs">
              {usersRange === 'custom' && (
                <div className="slh-custom-dates">
                  <input
                    type="date"
                    value={usersStartDate}
                    onChange={(e) => {
                      setUsersStartDate(e.target.value);
                      setUsersPage(1);
                    }}
                    className="slh-input"
                    aria-label="Users Start Date"
                  />
                  <span className="slh-date-sep">to</span>
                  <input
                    type="date"
                    value={usersEndDate}
                    onChange={(e) => {
                      setUsersEndDate(e.target.value);
                      setUsersPage(1);
                    }}
                    className="slh-input"
                    aria-label="Users End Date"
                  />
                </div>
              )}

              <div className="slh-search-wrap">
                <Search size={14} className="slh-search-icon" />
                <input
                  type="text"
                  value={usersSearchInput}
                  onChange={(e) => setUsersSearchInput(e.target.value)}
                  placeholder="Search by student email, name, or User ID..."
                  className="slh-search-input"
                />
              </div>

              <select
                value={usersMethod}
                onChange={(e) => {
                  setUsersMethod(e.target.value as 'all' | 'google' | 'email');
                  setUsersPage(1);
                }}
                className="slh-select"
                aria-label="Filter Users by Login Method"
              >
                <option value="all">All Login Methods</option>
                <option value="google">Google OAuth</option>
                <option value="email">Email &amp; Password</option>
              </select>

              <select
                value={usersStatus}
                onChange={(e) => {
                  setUsersStatus(e.target.value as 'all' | 'active' | 'inactive');
                  setUsersPage(1);
                }}
                className="slh-select"
                aria-label="Filter Users by Account Status"
              >
                <option value="all">All Account Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <select
                value={usersSortBy}
                onChange={(e) => {
                  setUsersSortBy(e.target.value as UsersSortKey);
                  setUsersPage(1);
                }}
                className="slh-select"
                aria-label="Sort Student Login Users"
              >
                <option value="latest_login">Sort: Latest Login</option>
                <option value="highest_count">Sort: Highest Login Count</option>
                <option value="first_login">Sort: First Login Date</option>
              </select>
            </div>
          </div>

          {usersLoading && !usersData ? (
            <div className="slh-empty-card glass">
              <div className="slh-spinner" />
              <p>Loading unique student login users from PostgreSQL...</p>
            </div>
          ) : !usersData || usersData.users.length === 0 ? (
            <div className="slh-empty-card glass">
              <Users size={28} className="slh-empty-icon" />
              <h3>No unique student login users match your filters</h3>
              <p>
                Every authenticated student appears once in this registry with their exact cumulative login count.
              </p>
            </div>
          ) : (
            <section className="slh-day-section glass">
              <div className="slh-day-header">
                <div className="slh-day-title-wrap">
                  <Users size={16} className="slh-icon-cyan" />
                  <h2 className="slh-day-heading">Student Login Users Database (Unique Per User ID)</h2>
                </div>
                <div className="slh-day-badges">
                  <span className="slh-day-badge cyan">
                    Matching Unique Students: <strong>{usersData.pagination.totalCount.toLocaleString('en-IN')}</strong>
                  </span>
                </div>
              </div>

              <div className="slh-table-wrap">
                <table className="slh-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Student Name</th>
                      <th>Student Email</th>
                      <th>User ID</th>
                      <th>First Login</th>
                      <th>Last Login</th>
                      <th>Total Login Count</th>
                      <th>Today&apos;s Login Count</th>
                      <th>Last Login Method</th>
                      <th>Last Device</th>
                      <th>Last Browser</th>
                      <th>Account Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersData.users.map((u) => (
                      <tr key={u.userId}>
                        <td className="slh-sno">{u.serialNo}</td>
                        <td className="slh-nowrap slh-student-name">{u.studentName}</td>
                        <td>
                          <button
                            type="button"
                            className="slh-email-btn"
                            onClick={() => void handleOpenStudentDetail(u.userId)}
                            title="Click to inspect full student login profile & event history"
                          >
                            <Mail size={13} />
                            <span>{u.studentEmail}</span>
                          </button>
                        </td>
                        <td className="slh-sno slh-nowrap">#{u.userId}</td>
                        <td className="slh-nowrap slh-muted">{formatIstDateTime(u.firstLoginAt)}</td>
                        <td className="slh-nowrap">{formatIstDateTime(u.lastLoginAt)}</td>
                        <td className="slh-nowrap">
                          <span className="slh-count-badge">{u.totalLoginCount}</span>
                        </td>
                        <td className="slh-nowrap">
                          <span className={`slh-count-badge ${u.todayLoginCount > 0 ? 'today' : 'zero'}`}>
                            {u.todayLoginCount}
                          </span>
                        </td>
                        <td className="slh-nowrap">
                          <span
                            className={`slh-method-pill ${
                              u.lastLoginMethod === 'Google OAuth' ? 'google' : 'email'
                            }`}
                          >
                            {u.lastLoginMethod}
                          </span>
                        </td>
                        <td className="slh-nowrap slh-muted">{u.lastDevice}</td>
                        <td className="slh-nowrap slh-muted">{u.lastBrowser}</td>
                        <td className="slh-nowrap">
                          <span
                            className={`slh-session-pill ${u.accountStatus === 'Active' ? 'online' : 'offline'}`}
                          >
                            <span className="slh-session-dot" />
                            <span>{u.accountStatus}</span>
                          </span>
                        </td>
                        <td className="slh-nowrap">
                          <button
                            type="button"
                            className="slh-view-btn"
                            onClick={() => void handleOpenStudentDetail(u.userId)}
                          >
                            <Eye size={13} />
                            <span>View Details</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {usersData.pagination.totalPages > 1 && (
                <div className="slh-pagination">
                  <span className="slh-page-info">
                    Page <strong>{usersData.pagination.page}</strong> of{' '}
                    <strong>{usersData.pagination.totalPages}</strong> &bull;{' '}
                    {usersData.pagination.totalCount.toLocaleString('en-IN')} unique student users
                  </span>
                  <div className="slh-page-btns">
                    <button
                      type="button"
                      className="slh-btn slh-btn-outline"
                      disabled={usersPage <= 1}
                      onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={14} />
                      <span>Previous</span>
                    </button>
                    <button
                      type="button"
                      className="slh-btn slh-btn-outline"
                      disabled={usersPage >= usersData.pagination.totalPages}
                      onClick={() => setUsersPage((p) => Math.min(usersData.pagination.totalPages, p + 1))}
                    >
                      <span>Next</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* =========================================================
          TAB 3: INDIVIDUAL LOGIN EVENTS (EXISTING REGISTER PRESERVED)
         ========================================================= */}
      {activeTab === 'events' && (
        <>
          <div className="slh-filters-bar glass">
            <div className="slh-range-pills">
              {(
                [
                  { key: 'today', label: 'Today' },
                  { key: 'yesterday', label: 'Yesterday' },
                  { key: '7d', label: 'Last 7 Days' },
                  { key: '30d', label: 'Last 30 Days' },
                  { key: '90d', label: 'Last 90 Days' },
                  { key: 'custom', label: 'Custom Range' },
                  { key: 'all', label: 'All Time' },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`slh-range-btn ${range === item.key ? 'active' : ''}`}
                  onClick={() => {
                    setRange(item.key);
                    setPage(1);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="slh-filter-inputs">
              {range === 'custom' && (
                <div className="slh-custom-dates">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPage(1);
                    }}
                    className="slh-input"
                    aria-label="Start Date"
                  />
                  <span className="slh-date-sep">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPage(1);
                    }}
                    className="slh-input"
                    aria-label="End Date"
                  />
                </div>
              )}

              <div className="slh-search-wrap">
                <Search size={14} className="slh-search-icon" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search student email or date (DD-MM-YYYY)..."
                  className="slh-search-input"
                />
              </div>

              <select
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value as 'all' | 'google' | 'email');
                  setPage(1);
                }}
                className="slh-select"
                aria-label="Filter Authentication Method"
              >
                <option value="all">All Auth Methods</option>
                <option value="google">Google OAuth</option>
                <option value="email">Email &amp; Password</option>
              </select>

              <select
                value={sessionStatus}
                onChange={(e) => {
                  setSessionStatus(e.target.value as 'all' | 'online' | 'offline' | 'expired');
                  setPage(1);
                }}
                className="slh-select"
                aria-label="Filter Session Status"
              >
                <option value="all">All Session Statuses</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          {loading && !data ? (
            <div className="slh-empty-card glass">
              <div className="slh-spinner" />
              <p>Loading genuine student login events from PostgreSQL...</p>
            </div>
          ) : !data || data.dailyGroups.length === 0 ? (
            <div className="slh-empty-card glass">
              <LogIn size={28} className="slh-empty-icon" />
              <h3>No student login events recorded for the selected filters</h3>
              <p>
                Every genuine student login via Google OAuth or Email &amp; Password is automatically logged here in real time.
              </p>
            </div>
          ) : (
            <div className="slh-groups-stack">
              {data.dailyGroups.map((group) => (
                <section key={group.dateKey} className="slh-day-section glass">
                  <div className="slh-day-header">
                    <div className="slh-day-title-wrap">
                      <Calendar size={16} className="slh-day-icon" />
                      <h2 className="slh-day-heading">{group.displayDate}</h2>
                    </div>
                    <div className="slh-day-badges">
                      <span className="slh-day-badge">
                        Total Login Events: <strong>{group.totalLoginEvents}</strong>
                      </span>
                      <span className="slh-day-badge cyan">
                        Unique Students Logged In: <strong>{group.uniqueStudentsLoggedIn}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="slh-table-wrap">
                    <table className="slh-table">
                      <thead>
                        <tr>
                          <th>S.No</th>
                          <th>Date</th>
                          <th>Student Email</th>
                          <th>Login Time</th>
                          <th>Login Method</th>
                          <th>Login Status</th>
                          <th>Session Status</th>
                          <th>Last Activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.events.map((row) => (
                          <tr key={row.eventId}>
                            <td className="slh-sno">{row.serialNo}</td>
                            <td className="slh-nowrap">{row.dateFormatted}</td>
                            <td>
                              <button
                                type="button"
                                className="slh-email-btn"
                                onClick={() => void handleOpenStudentDetail(row.studentId)}
                                title="Click to view complete login history for this student"
                              >
                                <Mail size={13} />
                                <span>{row.studentEmail}</span>
                              </button>
                            </td>
                            <td className="slh-nowrap slh-time">
                              <Clock size={12} />
                              <span>{row.loginTime}</span>
                            </td>
                            <td>
                              <span
                                className={`slh-method-pill ${
                                  row.authenticationMethod === 'Google OAuth' ? 'google' : 'email'
                                }`}
                              >
                                {row.authenticationMethod}
                              </span>
                            </td>
                            <td>
                              <span className="slh-status-pill success">
                                <CheckCircle2 size={12} />
                                <span>{row.loginStatus}</span>
                              </span>
                            </td>
                            <td>
                              <span className={`slh-session-pill ${row.sessionStatus.toLowerCase()}`}>
                                <span className="slh-session-dot" />
                                <span>{row.sessionStatus}</span>
                              </span>
                            </td>
                            <td className="slh-nowrap slh-muted">
                              {formatIstDateTime(row.lastActivityAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}

              {data.pagination.totalPages > 1 && (
                <div className="slh-pagination glass">
                  <span className="slh-page-info">
                    Page <strong>{data.pagination.page}</strong> of{' '}
                    <strong>{data.pagination.totalPages}</strong> &bull;{' '}
                    {data.pagination.totalCount.toLocaleString('en-IN')} total login events
                  </span>
                  <div className="slh-page-btns">
                    <button
                      type="button"
                      className="slh-btn slh-btn-outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={14} />
                      <span>Previous</span>
                    </button>
                    <button
                      type="button"
                      className="slh-btn slh-btn-outline"
                      disabled={page >= data.pagination.totalPages}
                      onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                    >
                      <span>Next</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* =========================================================
          TAB 4: ACTIVE SESSIONS (EXISTING SINGLE-DEVICE MONITOR)
         ========================================================= */}
      {activeTab === 'sessions' && (
        <section className="slh-day-section glass">
          <div className="slh-day-header">
            <div className="slh-day-title-wrap">
              <ShieldCheck size={16} className="slh-day-icon" />
              <h2 className="slh-day-heading">Active Device Sessions (Single-Device Enforcement)</h2>
            </div>
            <div className="slh-day-badges">
              <span className="slh-day-badge cyan">
                Active Devices: <strong>{activeSessionsCount}</strong>
              </span>
              <span className="slh-day-badge">
                Total Tracked Sessions: <strong>{activeDeviceSessions.length}</strong>
              </span>
            </div>
          </div>

          {activeDeviceSessions.length === 0 ? (
            <div className="slh-empty-card">
              <ShieldCheck size={28} className="slh-empty-icon" />
              <h3>No active device sessions recorded yet</h3>
              <p>Single-device student sessions appear here automatically when students sign in.</p>
            </div>
          ) : (
            <div className="slh-table-wrap">
              <table className="slh-table">
                <thead>
                  <tr>
                    <th>Student Email</th>
                    <th>Current Device</th>
                    <th>Browser</th>
                    <th>Operating System</th>
                    <th>Login Date</th>
                    <th>Login Time</th>
                    <th>Last Active</th>
                    <th>Session Status</th>
                    <th>Prev. Revocation Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDeviceSessions.map((s) => (
                    <tr key={s.studentId}>
                      <td>
                        <button
                          type="button"
                          className="slh-email-btn"
                          onClick={() => void handleOpenStudentDetail(s.studentId)}
                        >
                          <Mail size={13} />
                          <span>{s.studentEmail}</span>
                        </button>
                      </td>
                      <td className="slh-nowrap">{s.deviceType}</td>
                      <td className="slh-nowrap">{s.browserName}</td>
                      <td className="slh-nowrap slh-muted">{s.osName}</td>
                      <td className="slh-nowrap">{s.loginDate}</td>
                      <td className="slh-nowrap slh-time">
                        <Clock size={12} />
                        <span>{s.loginTime}</span>
                      </td>
                      <td className="slh-nowrap slh-muted">{s.lastActiveTime}</td>
                      <td className="slh-nowrap">
                        <span
                          className={`slh-session-pill ${
                            s.sessionStatus === 'Active'
                              ? 'online'
                              : s.sessionStatus === 'Revoked'
                                ? 'expired'
                                : 'offline'
                          }`}
                        >
                          <span className="slh-session-dot" />
                          <span>{s.sessionStatus}</span>
                        </span>
                      </td>
                      <td className="slh-nowrap slh-muted">{s.previousRevocationTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =========================================================
          INDIVIDUAL STUDENT LOGIN PROFILE & HISTORY MODAL
         ========================================================= */}
      {(detailLoading || selectedDetail || detailError) && (
        <div
          className="slh-modal-backdrop"
          onClick={() => {
            openDetailStudentIdRef.current = null;
            setSelectedDetail(null);
            setDetailError(null);
          }}
        >
          <div className="slh-modal slh-modal-wide glass" onClick={(e) => e.stopPropagation()}>
            <div className="slh-modal-header">
              <div>
                <span className="slh-modal-eyebrow">INDIVIDUAL STUDENT LOGIN PROFILE</span>
                <h3 className="slh-modal-title">
                  {selectedDetail?.studentEmail || 'Loading student profile...'}
                </h3>
                {selectedDetail && (
                  <p className="slh-modal-sub">
                    {selectedDetail.studentName} &bull; User ID: <strong>#{selectedDetail.userId}</strong> &bull;{' '}
                    {selectedDetail.accountStatus}
                  </p>
                )}
              </div>
              <div className="slh-modal-header-actions">
                {selectedDetail && (
                  <button
                    type="button"
                    className="slh-btn slh-btn-primary"
                    onClick={() => void handleExportCsv('individual', selectedDetail.userId)}
                    disabled={exportingKey !== null}
                  >
                    <Download size={14} />
                    <span>{exportingKey === 'individual' ? 'Exporting...' : 'Export CSV'}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="slh-modal-close"
                  aria-label="Close student login profile"
                  onClick={() => {
                    openDetailStudentIdRef.current = null;
                    setSelectedDetail(null);
                    setDetailError(null);
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="slh-modal-loading">
                <div className="slh-spinner" />
                <span>Loading individual student login profile &amp; history...</span>
              </div>
            ) : detailError ? (
              <div className="slh-modal-body">
                <div className="slh-error-banner">
                  <AlertCircle size={16} />
                  <span>{detailError}</span>
                </div>
              </div>
            ) : selectedDetail ? (
              <div className="slh-modal-body">
                {/* Core Student Profile Metrics */}
                <div className="slh-detail-grid">
                  <div className="slh-detail-box">
                    <span className="slh-detail-lbl">First Login Date</span>
                    <span className="slh-detail-val">{formatIstDateTime(selectedDetail.firstLoginAt)}</span>
                  </div>
                  <div className="slh-detail-box">
                    <span className="slh-detail-lbl">Last Login Date</span>
                    <span className="slh-detail-val">{formatIstDateTime(selectedDetail.lastLoginAt)}</span>
                  </div>
                  <div className="slh-detail-box">
                    <span className="slh-detail-lbl">Total Login Count</span>
                    <span className="slh-detail-val slh-cyan">{selectedDetail.totalLoginCount}</span>
                  </div>
                  <div className="slh-detail-box">
                    <span className="slh-detail-lbl">Today&apos;s Login Count</span>
                    <span className="slh-detail-val slh-amber">{selectedDetail.todayLoginCount}</span>
                  </div>
                  <div className="slh-detail-box">
                    <span className="slh-detail-lbl">Last Login Method</span>
                    <span className="slh-detail-val">{selectedDetail.lastLoginMethod}</span>
                  </div>
                  <div className="slh-detail-box">
                    <span className="slh-detail-lbl">Account Status</span>
                    <span className="slh-detail-val">{selectedDetail.accountStatus}</span>
                  </div>
                </div>

                {/* Device / Browser / OS History */}
                <div className="slh-tech-grid">
                  <div className="slh-detail-box">
                    <span className="slh-detail-lbl">
                      <Monitor size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Device History
                    </span>
                    <span className="slh-detail-val">
                      {selectedDetail.deviceHistory.length > 0
                        ? selectedDetail.deviceHistory.join(', ')
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="slh-detail-box">
                    <span className="slh-detail-lbl">
                      <Globe size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Browser History
                    </span>
                    <span className="slh-detail-val">
                      {selectedDetail.browserHistory.length > 0
                        ? selectedDetail.browserHistory.join(', ')
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="slh-detail-box">
                    <span className="slh-detail-lbl">
                      <Cpu size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Operating System
                    </span>
                    <span className="slh-detail-val">
                      {selectedDetail.osHistory.length > 0 ? selectedDetail.osHistory.join(', ') : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Individual Student Successful Login Events Table */}
                <div>
                  <h4 className="slh-modal-section-title">
                    All Successful Login Events ({selectedDetail.loginEvents.length})
                  </h4>
                  <div className="slh-modal-table-wrap">
                    <table className="slh-table">
                      <thead>
                        <tr>
                          <th>S.No</th>
                          <th>Login Date</th>
                          <th>Login Time</th>
                          <th>Login Method</th>
                          <th>Device</th>
                          <th>Browser</th>
                          <th>OS</th>
                          <th>Session Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDetail.loginEvents.map((ev) => (
                          <tr key={ev.eventId}>
                            <td className="slh-sno">{ev.serialNo}</td>
                            <td className="slh-nowrap">{ev.loginDate}</td>
                            <td className="slh-nowrap slh-time">{ev.loginTime}</td>
                            <td className="slh-nowrap">
                              <span
                                className={`slh-method-pill ${
                                  ev.loginMethod === 'Google OAuth' ? 'google' : 'email'
                                }`}
                              >
                                {ev.loginMethod}
                              </span>
                            </td>
                            <td className="slh-nowrap slh-muted">{ev.device}</td>
                            <td className="slh-nowrap slh-muted">{ev.browser}</td>
                            <td className="slh-nowrap slh-muted">{ev.os}</td>
                            <td className="slh-nowrap">
                              <span
                                className={`slh-session-pill ${
                                  ev.sessionStatus === 'Active'
                                    ? 'online'
                                    : ev.sessionStatus === 'Revoked' || ev.sessionStatus === 'Expired'
                                      ? 'expired'
                                      : 'offline'
                                }`}
                              >
                                <span className="slh-session-dot" />
                                <span>{ev.sessionStatus}</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                        {selectedDetail.loginEvents.length === 0 && (
                          <tr>
                            <td colSpan={8} className="slh-muted" style={{ textAlign: 'center', padding: '1rem' }}>
                              No individual login events recorded for this student.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Session History */}
                {selectedDetail.sessionHistory.length > 0 && (
                  <div>
                    <h4 className="slh-modal-section-title">
                      Session History ({selectedDetail.sessionHistory.length})
                    </h4>
                    <div className="slh-modal-table-wrap">
                      <table className="slh-table">
                        <thead>
                          <tr>
                            <th>Device</th>
                            <th>Browser</th>
                            <th>OS</th>
                            <th>Auth Method</th>
                            <th>Started</th>
                            <th>Last Active</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDetail.sessionHistory.map((s) => (
                            <tr key={s.sessionId}>
                              <td className="slh-nowrap">{s.device}</td>
                              <td className="slh-nowrap">{s.browser}</td>
                              <td className="slh-nowrap slh-muted">{s.os}</td>
                              <td className="slh-nowrap">{s.authMethod}</td>
                              <td className="slh-nowrap slh-muted">{formatIstDateTime(s.createdAt)}</td>
                              <td className="slh-nowrap slh-muted">{formatIstDateTime(s.lastActiveAt)}</td>
                              <td className="slh-nowrap">
                                <span
                                  className={`slh-session-pill ${
                                    s.sessionStatus === 'Active'
                                      ? 'online'
                                      : s.sessionStatus === 'Revoked' || s.sessionStatus === 'Expired'
                                        ? 'expired'
                                        : 'offline'
                                  }`}
                                >
                                  <span className="slh-session-dot" />
                                  <span>{s.sessionStatus}</span>
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentLoginHistoryPage;
