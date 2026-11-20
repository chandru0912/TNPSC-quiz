import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { apiFetch } from '../../../utils/api';
import './StudentLoginHistoryPage.css';

interface StudentLoginHistoryPageProps {
  token: string | null;
}

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

interface StudentLoginDetail {
  studentId: number;
  studentEmail: string;
  studentName: string | null;
  targetGroup: string | null;
  district: string;
  firstRecordedLogin: string | null;
  mostRecentLogin: string | null;
  totalLoginEvents: number;
  uniqueLoginDates: number;
  currentSessionStatus: 'Online' | 'Offline' | 'Expired';
  lastActivityAt: string | null;
  history: {
    serialNo: number;
    eventId: string;
    dateFormatted: string;
    displayDate: string;
    loginTime: string;
    loginTimestamp: string;
    authenticationMethod: string;
    loginStatus: string;
    sessionStatus: string;
  }[];
}

type DateRangeKey = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'custom' | 'all';

function formatIstDateTime(iso: string | null): string {
  if (!iso) return '—';
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
    return '—';
  }
}

export const StudentLoginHistoryPage: React.FC<StudentLoginHistoryPageProps> = ({ token }) => {
  const [range, setRange] = useState<DateRangeKey>('30d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [method, setMethod] = useState<'all' | 'google' | 'email'>('all');
  const [sessionStatus, setSessionStatus] = useState<'all' | 'online' | 'offline' | 'expired'>('all');
  const [page, setPage] = useState<number>(1);
  const limit = 50;

  const [data, setData] = useState<LoginHistoryPayload | null>(null);
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
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<'connected' | 'reconnecting' | 'polling'>('polling');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Student-wise detail modal state
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [selectedDetail, setSelectedDetail] = useState<StudentLoginDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const getActiveToken = useCallback(() => {
    return (
      token ||
      localStorage.getItem('tnpsc_admin_token') ||
      localStorage.getItem('adminToken') ||
      localStorage.getItem('token') ||
      ''
    );
  }, [token]);

  const buildQueryString = useCallback(
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

  const loadLoginHistory = useCallback(
    async (silent = false) => {
      const activeToken = getActiveToken();
      if (!activeToken) return;
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const [res, sessRes] = await Promise.all([
          apiFetch(`/api/analytics/login-history?${buildQueryString(true)}`, {
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
    [getActiveToken, buildQueryString]
  );

  useEffect(() => {
    void loadLoginHistory(false);
  }, [loadLoginHistory]);

  // Real-time SSE stream subscription for live student login/logout updates
  useEffect(() => {
    const activeToken = getActiveToken();
    if (!activeToken || typeof EventSource === 'undefined') {
      setSseStatus('polling');
      return;
    }

    let es: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let closed = false;

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
              void loadLoginHistory(true);
            }
          } catch {
            void loadLoginHistory(true);
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
    };
  }, [getActiveToken, loadLoginHistory]);

  const handleOpenStudentDetail = async (studentId: number) => {
    const activeToken = getActiveToken();
    if (!activeToken) return;
    setDetailLoading(true);
    setDetailError(null);
    setSelectedDetail(null);

    try {
      const res = await apiFetch(`/api/analytics/login-history/student/${studentId}`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status !== 'success') {
        throw new Error(json.message || 'Failed to load student login history.');
      }
      setSelectedDetail(json.data);
    } catch (err: any) {
      setDetailError(err.message || 'Failed to load student login details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExportCsv = async () => {
    const activeToken = getActiveToken();
    if (!activeToken) return;
    setExporting(true);
    try {
      const res = await apiFetch(`/api/analytics/login-history/export?${buildQueryString(false)}`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (!res.ok) {
        throw new Error(`Export failed (HTTP ${res.status})`);
      }
      const csvText = await res.text();
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `student-login-history-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to export CSV.');
    } finally {
      setExporting(false);
    }
  };

  const summary = data?.summary || {
    totalLoginEvents: 0,
    uniqueStudentsLoggedIn: 0,
    todayLoginEvents: 0,
    todayUniqueStudents: 0,
    currentlyOnlineStudents: 0,
    returningStudentLogins: 0,
  };

  return (
    <div className="slh-page-root">
      {/* Header Row */}
      <div className="slh-header-bar glass">
        <div className="slh-header-left">
          <div className="slh-title-row">
            <h1 className="slh-title">Student Login History</h1>
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
            Genuine day-by-day student authentication register (Asia/Kolkata IST) &bull; PostgreSQL live events
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
            onClick={() => void loadLoginHistory(true)}
            disabled={refreshing || loading}
          >
            <RefreshCw size={14} className={refreshing ? 'slh-spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
          <button
            type="button"
            className="slh-btn slh-btn-primary"
            onClick={() => void handleExportCsv()}
            disabled={exporting || loading}
          >
            <Download size={14} />
            <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="slh-error-banner">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => void loadLoginHistory(false)}>
            Retry
          </button>
        </div>
      )}

      {/* 6 Summary Cards */}
      <div className="slh-summary-grid">
        <div className="slh-stat-card glass">
          <div className="slh-stat-top">
            <span className="slh-stat-label">Total Login Events</span>
            <LogIn size={16} className="slh-icon-indigo" />
          </div>
          <div className="slh-stat-value">{summary.totalLoginEvents.toLocaleString('en-IN')}</div>
          <span className="slh-stat-hint">All successful logins in filter</span>
        </div>

        <div className="slh-stat-card glass">
          <div className="slh-stat-top">
            <span className="slh-stat-label">Unique Students Logged In</span>
            <Users size={16} className="slh-icon-cyan" />
          </div>
          <div className="slh-stat-value slh-cyan">{summary.uniqueStudentsLoggedIn.toLocaleString('en-IN')}</div>
          <span className="slh-stat-hint">Distinct students in filter</span>
        </div>

        <div className="slh-stat-card glass">
          <div className="slh-stat-top">
            <span className="slh-stat-label">Today&apos;s Login Events</span>
            <Calendar size={16} className="slh-icon-amber" />
          </div>
          <div className="slh-stat-value slh-amber">{summary.todayLoginEvents.toLocaleString('en-IN')}</div>
          <span className="slh-stat-hint">Recorded today (IST)</span>
        </div>

        <div className="slh-stat-card glass">
          <div className="slh-stat-top">
            <span className="slh-stat-label">Today&apos;s Unique Students</span>
            <ShieldCheck size={16} className="slh-icon-emerald" />
          </div>
          <div className="slh-stat-value slh-emerald">{summary.todayUniqueStudents.toLocaleString('en-IN')}</div>
          <span className="slh-stat-hint">Distinct students today</span>
        </div>

        <div className="slh-stat-card glass">
          <div className="slh-stat-top">
            <span className="slh-stat-label">Currently Online Students</span>
            <Activity size={16} className="slh-icon-emerald" />
          </div>
          <div className="slh-stat-value slh-emerald">{summary.currentlyOnlineStudents.toLocaleString('en-IN')}</div>
          <span className="slh-stat-hint">Active session (&le; 5m heartbeat)</span>
        </div>

        <div className="slh-stat-card glass">
          <div className="slh-stat-top">
            <span className="slh-stat-label">Returning Student Logins</span>
            <Repeat size={16} className="slh-icon-purple" />
          </div>
          <div className="slh-stat-value slh-purple">{summary.returningStudentLogins.toLocaleString('en-IN')}</div>
          <span className="slh-stat-hint">Repeat sign-in events</span>
        </div>
      </div>

      {/* Single Active Device Sessions Monitor (1 Active Session Per Student) */}
      {activeDeviceSessions.length > 0 && (
        <section className="slh-day-section glass" style={{ marginBottom: '1.25rem' }}>
          <div className="slh-day-header">
            <div className="slh-day-title-wrap">
              <ShieldCheck size={16} className="slh-day-icon" />
              <h2 className="slh-day-heading">Active Device Sessions (Single-Device Enforcement)</h2>
            </div>
            <div className="slh-day-badges">
              <span className="slh-day-badge cyan">
                Active Devices:{' '}
                <strong>
                  {activeDeviceSessions.filter((s) => s.sessionStatus === 'Active').length}
                </strong>
              </span>
            </div>
          </div>

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
        </section>
      )}

      {/* Filters & Search Toolbar */}
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

      {/* Day-by-Day Login Register */}
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

          {/* Pagination */}
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

      {/* Student-Wise Login History Modal */}
      {(detailLoading || selectedDetail || detailError) && (
        <div
          className="slh-modal-backdrop"
          onClick={() => {
            setSelectedDetail(null);
            setDetailError(null);
          }}
        >
          <div className="slh-modal glass" onClick={(e) => e.stopPropagation()}>
            <div className="slh-modal-header">
              <div>
                <span className="slh-modal-eyebrow">STUDENT-WISE LOGIN HISTORY</span>
                <h3 className="slh-modal-title">
                  {selectedDetail?.studentEmail || 'Loading student details...'}
                </h3>
                {selectedDetail && (
                  <p className="slh-modal-sub">
                    Student ID: <strong>#{selectedDetail.studentId}</strong>
                    {selectedDetail.studentName ? ` • ${selectedDetail.studentName}` : ''}
                    {selectedDetail.district ? ` • ${selectedDetail.district}` : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="slh-modal-close"
                onClick={() => {
                  setSelectedDetail(null);
                  setDetailError(null);
                }}
                aria-label="Close student login history"
              >
                <X size={18} />
              </button>
            </div>

            {detailLoading ? (
              <div className="slh-modal-loading">
                <div className="slh-spinner" />
                <span>Loading chronological login history...</span>
              </div>
            ) : detailError ? (
              <div className="slh-error-banner" style={{ margin: '1rem' }}>
                <AlertCircle size={16} />
                <span>{detailError}</span>
              </div>
            ) : selectedDetail ? (
              <div className="slh-modal-body">
                <div className="slh-detail-grid">
                  <div className="slh-detail-box">
                    <span className="slh-detail-lbl">First Recorded Login</span>
                    <span className="slh-detail-val">
                      {formatIstDateTime(selectedDetail.firstRecordedLogin)}
                    </span>
                  </div>
                  <div className="slh-detail-box">
                    <span className="slh-detail-lbl">Most Recent Login</span>
                    <span className="slh-detail-val">
                      {formatIstDateTime(selectedDetail.mostRecentLogin)}
                    </span>
                  </div>
                  <div className="slh-detail-box">
                    <span className="slh-detail-lbl">Total Successful Logins</span>
                    <span className="slh-detail-val slh-cyan">
                      {selectedDetail.totalLoginEvents}
                    </span>
                  </div>
                  <div className="slh-detail-box">
                    <span className="slh-detail-lbl">Unique Login Dates</span>
                    <span className="slh-detail-val slh-emerald">
                      {selectedDetail.uniqueLoginDates}
                    </span>
                  </div>
                  <div className="slh-detail-box">
                    <span className="slh-detail-lbl">Current Session Status</span>
                    <span
                      className={`slh-session-pill ${selectedDetail.currentSessionStatus.toLowerCase()}`}
                    >
                      <span className="slh-session-dot" />
                      <span>{selectedDetail.currentSessionStatus}</span>
                    </span>
                  </div>
                  <div className="slh-detail-box">
                    <span className="slh-detail-lbl">Last Activity Time</span>
                    <span className="slh-detail-val">
                      {formatIstDateTime(selectedDetail.lastActivityAt)}
                    </span>
                  </div>
                </div>

                <div className="slh-modal-table-wrap">
                  <table className="slh-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Login Time (IST)</th>
                        <th>Authentication Method</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDetail.history.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                            No recorded login events found for this student.
                          </td>
                        </tr>
                      ) : (
                        selectedDetail.history.map((h) => (
                          <tr key={h.eventId}>
                            <td className="slh-sno">{h.serialNo}</td>
                            <td className="slh-nowrap">{h.dateFormatted}</td>
                            <td className="slh-nowrap">{h.loginTime}</td>
                            <td>
                              <span
                                className={`slh-method-pill ${
                                  h.authenticationMethod === 'Google OAuth' ? 'google' : 'email'
                                }`}
                              >
                                {h.authenticationMethod}
                              </span>
                            </td>
                            <td>
                              <span className="slh-status-pill success">
                                <CheckCircle2 size={12} />
                                <span>{h.loginStatus}</span>
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
