import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  CheckCircle2,
  IndianRupee,
  ShieldCheck,
  Clock,
  XCircle,
  CalendarOff,
  RotateCcw,
  Calendar,
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  X,
  Mail,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Hash,
} from 'lucide-react';
import { apiFetch } from '../../../utils/api';
import './StudentLoginHistoryPage.css';

interface StudentSubscriptionHistoryPageProps {
  token: string | null;
}

interface SubscriptionTxRow {
  serialNo: number;
  id: number;
  studentId: number | null;
  studentEmail: string;
  studentName: string | null;
  dateKey: string;
  displayDate: string;
  purchaseDate: string;
  purchaseTime: string;
  purchasedAt: string;
  subscriptionPlan: string;
  planId: string | null;
  planPrice: number;
  amountPaid: number;
  refundAmount: number;
  currency: string;
  paymentProvider: string;
  paymentMethod: string;
  paymentReference: string;
  paymentStatus: 'Success' | 'Pending' | 'Failed' | 'Refunded';
  subscriptionStatus: 'Active' | 'Expired' | 'Cancelled' | 'Pending' | 'Inactive';
  activationDate: string;
  expiryDate: string;
}

interface DailySubscriptionGroup {
  dateKey: string;
  displayDate: string;
  totalPurchases: number;
  successfulPayments: number;
  totalAmountCollected: number;
  uniqueStudents: number;
  transactions: SubscriptionTxRow[];
}

interface SubscriptionHistoryPayload {
  summary: {
    totalPurchases: number;
    successfulPayments: number;
    totalAmountCollected: number;
    activeSubscriptions: number;
    pendingPayments: number;
    failedPayments: number;
    expiredSubscriptions: number;
    totalRefunds: number;
    totalRefundedAmount: number;
  };
  dailyGroups: DailySubscriptionGroup[];
  rows: SubscriptionTxRow[];
  availableFilters: {
    plans: string[];
    paymentMethods: string[];
  };
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  timezone: string;
  serverTimestamp: string;
}

interface StudentSubscriptionDetail {
  studentId: number;
  studentEmail: string;
  studentName: string | null;
  targetGroup: string | null;
  totalPurchases: number;
  totalVerifiedAmountPaid: number;
  currentPlan: string;
  currentStatus: string;
  paymentMethodsUsed: string[];
  purchaseHistory: {
    serialNo: number;
    id: number;
    purchaseDate: string;
    purchaseTime: string;
    subscriptionPlan: string;
    planPrice: number;
    amountPaid: number;
    refundAmount: number;
    paymentMethod: string;
    paymentReference: string;
    paymentStatus: 'Success' | 'Pending' | 'Failed' | 'Refunded';
    subscriptionStatus: 'Active' | 'Expired' | 'Cancelled' | 'Pending' | 'Inactive';
    expiryDate: string;
    refundedAt: string | null;
  }[];
  refundHistory: {
    serialNo: number;
    id: number;
    purchaseDate: string;
    subscriptionPlan: string;
    amountPaid: number;
    refundAmount: number;
    paymentReference: string;
    refundedAt: string | null;
  }[];
}

type DateRangeKey = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'custom' | 'all';

function formatInr(amount: number): string {
  const num = Number(amount || 0);
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function getPaymentBadgeStyle(status: string): React.CSSProperties {
  const s = status.toLowerCase();
  if (s === 'success') {
    return {
      background: 'rgba(16, 185, 129, 0.14)',
      color: '#34d399',
      border: '1px solid rgba(16, 185, 129, 0.35)',
    };
  }
  if (s === 'pending') {
    return {
      background: 'rgba(245, 158, 11, 0.14)',
      color: '#fbbf24',
      border: '1px solid rgba(245, 158, 11, 0.35)',
    };
  }
  if (s === 'failed') {
    return {
      background: 'rgba(239, 68, 68, 0.14)',
      color: '#f87171',
      border: '1px solid rgba(239, 68, 68, 0.35)',
    };
  }
  return {
    background: 'rgba(168, 85, 247, 0.14)',
    color: '#c084fc',
    border: '1px solid rgba(168, 85, 247, 0.35)',
  };
}

function getSubStatusBadgeStyle(status: string): React.CSSProperties {
  const s = status.toLowerCase();
  if (s === 'active') {
    return {
      background: 'rgba(6, 182, 212, 0.14)',
      color: '#22d3ee',
      border: '1px solid rgba(6, 182, 212, 0.35)',
    };
  }
  if (s === 'pending') {
    return {
      background: 'rgba(245, 158, 11, 0.14)',
      color: '#fbbf24',
      border: '1px solid rgba(245, 158, 11, 0.35)',
    };
  }
  if (s === 'cancelled') {
    return {
      background: 'rgba(239, 68, 68, 0.14)',
      color: '#f87171',
      border: '1px solid rgba(239, 68, 68, 0.35)',
    };
  }
  return {
    background: 'rgba(148, 163, 184, 0.12)',
    color: '#94a3b8',
    border: '1px solid rgba(148, 163, 184, 0.28)',
  };
}

export const StudentSubscriptionHistoryPage: React.FC<StudentSubscriptionHistoryPageProps> = ({ token }) => {
  const [range, setRange] = useState<DateRangeKey>('30d');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');
  const [debouncedEmail, setDebouncedEmail] = useState<string>('');
  const [refInput, setRefInput] = useState<string>('');
  const [debouncedRef, setDebouncedRef] = useState<string>('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [subStatusFilter, setSubStatusFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const limit = 50;

  const [data, setData] = useState<SubscriptionHistoryPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<'connected' | 'reconnecting' | 'polling'>('polling');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Student-wise subscription detail modal
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [selectedDetail, setSelectedDetail] = useState<StudentSubscriptionDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedEmail(emailInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [emailInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedRef(refInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [refInput]);

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
        if (fromDate) qs.set('from', fromDate);
        if (toDate) qs.set('to', toDate);
      }
      if (debouncedEmail) qs.set('email', debouncedEmail);
      if (debouncedRef) qs.set('reference', debouncedRef);
      if (planFilter !== 'all') qs.set('plan', planFilter);
      if (methodFilter !== 'all') qs.set('paymentMethod', methodFilter);
      if (paymentStatusFilter !== 'all') qs.set('paymentStatus', paymentStatusFilter);
      if (subStatusFilter !== 'all') qs.set('subscriptionStatus', subStatusFilter);
      if (includePagination) {
        qs.set('page', String(page));
        qs.set('limit', String(limit));
      }
      return qs.toString();
    },
    [
      range,
      fromDate,
      toDate,
      debouncedEmail,
      debouncedRef,
      planFilter,
      methodFilter,
      paymentStatusFilter,
      subStatusFilter,
      page,
    ]
  );

  const loadSubscriptionHistory = useCallback(
    async (silent = false) => {
      const activeToken = getActiveToken();
      if (!activeToken) return;
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const res = await apiFetch(`/api/analytics/subscription-history?${buildQueryString(true)}`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.status !== 'success') {
          throw new Error(json.message || `Failed to load subscription history (HTTP ${res.status})`);
        }
        setData(json.data);
        setLastSyncedAt(new Date());
      } catch (err: any) {
        setError(err.message || 'Unable to load student subscription history from PostgreSQL.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getActiveToken, buildQueryString]
  );

  useEffect(() => {
    void loadSubscriptionHistory(false);
  }, [loadSubscriptionHistory]);

  // Real-time SSE stream subscription for live verified payment & subscription events
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
        const streamUrl = `/api/analytics/stream?token=${encodeURIComponent(activeToken)}&range=30d`;
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
              topics.includes('subscription_updated') ||
              topics.includes('payment_event')
            ) {
              void loadSubscriptionHistory(true);
            }
          } catch {
            void loadSubscriptionHistory(true);
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
  }, [getActiveToken, loadSubscriptionHistory]);

  const handleOpenStudentDetail = async (studentId: number | null) => {
    if (!studentId) return;
    const activeToken = getActiveToken();
    if (!activeToken) return;
    setDetailLoading(true);
    setDetailError(null);
    setSelectedDetail(null);

    try {
      const res = await apiFetch(`/api/analytics/subscription-history/student/${studentId}`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status !== 'success') {
        throw new Error(json.message || 'Failed to load student subscription details.');
      }
      setSelectedDetail(json.data);
    } catch (err: any) {
      setDetailError(err.message || 'Failed to load student subscription details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExportCsv = async () => {
    const activeToken = getActiveToken();
    if (!activeToken) return;
    setExporting(true);
    try {
      const res = await apiFetch(`/api/analytics/subscription-history/export?${buildQueryString(false)}`, {
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
      a.download = `student-subscription-history-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
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
    totalPurchases: 0,
    successfulPayments: 0,
    totalAmountCollected: 0,
    activeSubscriptions: 0,
    pendingPayments: 0,
    failedPayments: 0,
    expiredSubscriptions: 0,
    totalRefunds: 0,
    totalRefundedAmount: 0,
  };

  const availablePlans = data?.availableFilters?.plans || [];
  const availableMethods = data?.availableFilters?.paymentMethods || [];

  return (
    <div className="slh-page-root">
      {/* Header Row */}
      <div className="slh-header-bar glass">
        <div className="slh-header-left">
          <div className="slh-title-row">
            <h1 className="slh-title">Student Subscription History</h1>
            <span className={`slh-sse-pill ${sseStatus}`}>
              <span className="slh-sse-dot" />
              {sseStatus === 'connected'
                ? 'Live SSE Connected'
                : sseStatus === 'reconnecting'
                  ? 'Reconnecting SSE...'
                  : 'Disconnected'}
            </span>
          </div>
          <p className="slh-subtitle">
            Verified student subscription purchases &amp; payment ledger (Asia/Kolkata IST) &bull; Live PostgreSQL records only
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
            onClick={() => void loadSubscriptionHistory(true)}
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
          <button type="button" onClick={() => void loadSubscriptionHistory(false)}>
            Retry
          </button>
        </div>
      )}

      {/* 8 Real-Data Summary Cards */}
      <div
        className="slh-summary-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}
      >
        <div className="slh-stat-card glass">
          <div className="slh-stat-top">
            <span className="slh-stat-label">Total Subscription Purchases</span>
            <Receipt size={16} className="slh-icon-indigo" />
          </div>
          <div className="slh-stat-value">{summary.totalPurchases.toLocaleString('en-IN')}</div>
          <span className="slh-stat-hint">All verified purchase records</span>
        </div>

        <div className="slh-stat-card glass">
          <div className="slh-stat-top">
            <span className="slh-stat-label">Total Successful Payments</span>
            <CheckCircle2 size={16} className="slh-icon-emerald" />
          </div>
          <div className="slh-stat-value slh-emerald">{summary.successfulPayments.toLocaleString('en-IN')}</div>
          <span className="slh-stat-hint">Captured gateway payments</span>
        </div>

        <div className="slh-stat-card glass">
          <div className="slh-stat-top">
            <span className="slh-stat-label">Total Amount Collected</span>
            <IndianRupee size={16} className="slh-icon-amber" />
          </div>
          <div className="slh-stat-value slh-amber">{formatInr(summary.totalAmountCollected)}</div>
          <span className="slh-stat-hint">Net verified revenue (excl. failed/pending)</span>
        </div>

        <div className="slh-stat-card glass">
          <div className="slh-stat-top">
            <span className="slh-stat-label">Active Subscriptions</span>
            <ShieldCheck size={16} className="slh-icon-cyan" />
          </div>
          <div className="slh-stat-value slh-cyan">{summary.activeSubscriptions.toLocaleString('en-IN')}</div>
          <span className="slh-stat-hint">Currently active paid passes</span>
        </div>

        <div className="slh-stat-card glass">
          <div className="slh-stat-top">
            <span className="slh-stat-label">Pending Payments</span>
            <Clock size={16} className="slh-icon-amber" />
          </div>
          <div className="slh-stat-value slh-amber">{summary.pendingPayments.toLocaleString('en-IN')}</div>
          <span className="slh-stat-hint">Awaiting gateway confirmation</span>
        </div>

        <div className="slh-stat-card glass">
          <div className="slh-stat-top">
            <span className="slh-stat-label">Failed Payments</span>
            <XCircle size={16} style={{ color: '#f87171' }} />
          </div>
          <div className="slh-stat-value" style={{ color: '#f87171' }}>
            {summary.failedPayments.toLocaleString('en-IN')}
          </div>
          <span className="slh-stat-hint">Declined / unsuccessful attempts</span>
        </div>

        <div className="slh-stat-card glass">
          <div className="slh-stat-top">
            <span className="slh-stat-label">Expired Subscriptions</span>
            <CalendarOff size={16} style={{ color: '#94a3b8' }} />
          </div>
          <div className="slh-stat-value" style={{ color: '#cbd5e1' }}>
            {summary.expiredSubscriptions.toLocaleString('en-IN')}
          </div>
          <span className="slh-stat-hint">Past expiry date</span>
        </div>

        <div className="slh-stat-card glass">
          <div className="slh-stat-top">
            <span className="slh-stat-label">Total Refunds</span>
            <RotateCcw size={16} className="slh-icon-purple" />
          </div>
          <div className="slh-stat-value slh-purple">{summary.totalRefunds.toLocaleString('en-IN')}</div>
          <span className="slh-stat-hint">
            Refunded: {formatInr(summary.totalRefundedAmount)}
          </span>
        </div>
      </div>

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

        <div className="slh-filter-inputs" style={{ flexWrap: 'wrap' }}>
          {range === 'custom' && (
            <div className="slh-custom-dates">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="slh-input"
                aria-label="Start Date"
              />
              <span className="slh-date-sep">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="slh-input"
                aria-label="End Date"
              />
            </div>
          )}

          <div className="slh-search-wrap" style={{ minWidth: 210 }}>
            <Search size={14} className="slh-search-icon" />
            <input
              type="text"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Search student email..."
              className="slh-search-input"
            />
          </div>

          <div className="slh-search-wrap" style={{ minWidth: 200 }}>
            <Hash size={14} className="slh-search-icon" />
            <input
              type="text"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="Search payment reference..."
              className="slh-search-input"
            />
          </div>

          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setPage(1);
            }}
            className="slh-select"
            aria-label="Filter Subscription Plan"
          >
            <option value="all">All Plans</option>
            {availablePlans.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            className="slh-select"
            aria-label="Filter Payment Method"
          >
            <option value="all">All Payment Methods</option>
            {availableMethods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value="not_available">Not Available</option>
          </select>

          <select
            value={paymentStatusFilter}
            onChange={(e) => {
              setPaymentStatusFilter(e.target.value);
              setPage(1);
            }}
            className="slh-select"
            aria-label="Filter Payment Status"
          >
            <option value="all">All Payment Statuses</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>

          <select
            value={subStatusFilter}
            onChange={(e) => {
              setSubStatusFilter(e.target.value);
              setPage(1);
            }}
            className="slh-select"
            aria-label="Filter Subscription Status"
          >
            <option value="all">All Subscription Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Date-Wise Subscription Report */}
      {loading && !data ? (
        <div className="slh-empty-card glass">
          <div className="slh-spinner" />
          <p>Loading verified student subscription transactions from PostgreSQL...</p>
        </div>
      ) : !data || data.dailyGroups.length === 0 ? (
        <div className="slh-empty-card glass">
          <CreditCard size={28} className="slh-empty-icon" />
          <h3>No verified student subscription purchases recorded yet</h3>
          <p>
            Genuine Razorpay subscription payments, renewals, pending/failed attempts, and refunds will appear here automatically in real time.
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
                <div className="slh-day-badges" style={{ flexWrap: 'wrap' }}>
                  <span className="slh-day-badge">
                    Total Purchases: <strong>{group.totalPurchases}</strong>
                  </span>
                  <span className="slh-day-badge" style={{ borderColor: 'rgba(16,185,129,0.35)', color: '#34d399' }}>
                    Successful: <strong>{group.successfulPayments}</strong>
                  </span>
                  <span className="slh-day-badge" style={{ borderColor: 'rgba(245,158,11,0.35)', color: '#fbbf24' }}>
                    Amount Collected: <strong>{formatInr(group.totalAmountCollected)}</strong>
                  </span>
                  <span className="slh-day-badge cyan">
                    Unique Students: <strong>{group.uniqueStudents}</strong>
                  </span>
                </div>
              </div>

              <div className="slh-table-wrap">
                <table className="slh-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Purchase Date</th>
                      <th>Purchase Time</th>
                      <th>Student Email</th>
                      <th>Student ID</th>
                      <th>Subscription Plan</th>
                      <th>Plan Price</th>
                      <th>Amount Paid</th>
                      <th>Payment Method</th>
                      <th>Payment Reference</th>
                      <th>Payment Status</th>
                      <th>Subscription Status</th>
                      <th>Expiry Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.transactions.map((row) => (
                      <tr key={row.id}>
                        <td className="slh-sno">{row.serialNo}</td>
                        <td className="slh-nowrap">{row.purchaseDate}</td>
                        <td className="slh-nowrap slh-time">
                          <Clock size={12} />
                          <span>{row.purchaseTime}</span>
                        </td>
                        <td>
                          {row.studentId ? (
                            <button
                              type="button"
                              className="slh-email-btn"
                              onClick={() => void handleOpenStudentDetail(row.studentId)}
                              title="Click to view complete subscription history for this student"
                            >
                              <Mail size={13} />
                              <span>{row.studentEmail}</span>
                            </button>
                          ) : (
                            <span className="slh-muted">{row.studentEmail}</span>
                          )}
                        </td>
                        <td className="slh-nowrap slh-muted">
                          {row.studentId ? `#${row.studentId}` : '—'}
                        </td>
                        <td className="slh-nowrap" style={{ fontWeight: 600, color: '#e2e8f0' }}>
                          {row.subscriptionPlan}
                        </td>
                        <td className="slh-nowrap slh-muted">{formatInr(row.planPrice)}</td>
                        <td className="slh-nowrap" style={{ fontWeight: 700, color: '#fbbf24' }}>
                          {formatInr(row.amountPaid)}
                        </td>
                        <td className="slh-nowrap">
                          <span
                            className="slh-method-pill"
                            style={{
                              background:
                                row.paymentMethod === 'Not Available'
                                  ? 'rgba(148,163,184,0.12)'
                                  : 'rgba(99,102,241,0.14)',
                              color: row.paymentMethod === 'Not Available' ? '#94a3b8' : '#a5b4fc',
                              border:
                                row.paymentMethod === 'Not Available'
                                  ? '1px solid rgba(148,163,184,0.25)'
                                  : '1px solid rgba(99,102,241,0.32)',
                            }}
                          >
                            {row.paymentMethod}
                          </span>
                        </td>
                        <td
                          className="slh-nowrap slh-muted"
                          style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}
                          title={row.paymentReference}
                        >
                          {row.paymentReference}
                        </td>
                        <td className="slh-nowrap">
                          <span
                            className="slh-status-pill"
                            style={getPaymentBadgeStyle(row.paymentStatus)}
                          >
                            {row.paymentStatus}
                          </span>
                        </td>
                        <td className="slh-nowrap">
                          <span
                            className="slh-status-pill"
                            style={getSubStatusBadgeStyle(row.subscriptionStatus)}
                          >
                            {row.subscriptionStatus}
                          </span>
                        </td>
                        <td className="slh-nowrap slh-muted">{row.expiryDate}</td>
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
                {data.pagination.totalCount.toLocaleString('en-IN')} total transactions
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

      {/* Student-Wise Subscription History Modal */}
      {(detailLoading || selectedDetail || detailError) && (
        <div
          className="slh-modal-backdrop"
          onClick={() => {
            if (!detailLoading) {
              setSelectedDetail(null);
              setDetailError(null);
            }
          }}
        >
          <div
            className="slh-modal-card glass"
            style={{ maxWidth: 940 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="slh-modal-header">
              <div>
                <h2 className="slh-modal-title">Student Subscription History</h2>
                {selectedDetail && (
                  <p className="slh-modal-email">
                    <Mail size={13} />
                    <span>{selectedDetail.studentEmail}</span>
                    <span>&bull; ID #{selectedDetail.studentId}</span>
                    {selectedDetail.studentName && <span>&bull; {selectedDetail.studentName}</span>}
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
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {detailLoading ? (
              <div className="slh-modal-loading">
                <div className="slh-spinner" />
                <p>Loading student subscription &amp; payment ledger...</p>
              </div>
            ) : detailError ? (
              <div className="slh-error-banner" style={{ margin: '1rem' }}>
                <AlertCircle size={16} />
                <span>{detailError}</span>
              </div>
            ) : (
              selectedDetail && (
                <div className="slh-modal-body">
                  <div className="slh-detail-stats">
                    <div className="slh-detail-stat">
                      <span>Total Purchases</span>
                      <strong>{selectedDetail.totalPurchases}</strong>
                    </div>
                    <div className="slh-detail-stat">
                      <span>Total Verified Paid</span>
                      <strong style={{ color: '#fbbf24' }}>
                        {formatInr(selectedDetail.totalVerifiedAmountPaid)}
                      </strong>
                    </div>
                    <div className="slh-detail-stat">
                      <span>Current Plan</span>
                      <strong>{selectedDetail.currentPlan}</strong>
                    </div>
                    <div className="slh-detail-stat">
                      <span>Current Status</span>
                      <strong style={{ color: '#22d3ee' }}>{selectedDetail.currentStatus}</strong>
                    </div>
                    <div className="slh-detail-stat">
                      <span>Payment Methods Used</span>
                      <strong>
                        {selectedDetail.paymentMethodsUsed.length > 0
                          ? selectedDetail.paymentMethodsUsed.join(', ')
                          : 'Not Available'}
                      </strong>
                    </div>
                  </div>

                  <h3 className="slh-modal-section-title">
                    Purchase &amp; Renewal History ({selectedDetail.purchaseHistory.length})
                  </h3>

                  <div className="slh-table-wrap slh-modal-table-wrap">
                    <table className="slh-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Date</th>
                          <th>Time</th>
                          <th>Plan</th>
                          <th>Plan Price</th>
                          <th>Paid</th>
                          <th>Method</th>
                          <th>Reference</th>
                          <th>Payment</th>
                          <th>Subscription</th>
                          <th>Expiry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDetail.purchaseHistory.map((h) => (
                          <tr key={h.id}>
                            <td className="slh-sno">{h.serialNo}</td>
                            <td className="slh-nowrap">{h.purchaseDate}</td>
                            <td className="slh-nowrap slh-time">{h.purchaseTime}</td>
                            <td className="slh-nowrap" style={{ fontWeight: 600 }}>
                              {h.subscriptionPlan}
                            </td>
                            <td className="slh-nowrap slh-muted">{formatInr(h.planPrice)}</td>
                            <td className="slh-nowrap" style={{ fontWeight: 700, color: '#fbbf24' }}>
                              {formatInr(h.amountPaid)}
                            </td>
                            <td className="slh-nowrap">{h.paymentMethod}</td>
                            <td
                              className="slh-nowrap slh-muted"
                              style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}
                            >
                              {h.paymentReference}
                            </td>
                            <td className="slh-nowrap">
                              <span
                                className="slh-status-pill"
                                style={getPaymentBadgeStyle(h.paymentStatus)}
                              >
                                {h.paymentStatus}
                              </span>
                            </td>
                            <td className="slh-nowrap">
                              <span
                                className="slh-status-pill"
                                style={getSubStatusBadgeStyle(h.subscriptionStatus)}
                              >
                                {h.subscriptionStatus}
                              </span>
                            </td>
                            <td className="slh-nowrap slh-muted">{h.expiryDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedDetail.refundHistory.length > 0 && (
                    <>
                      <h3 className="slh-modal-section-title" style={{ marginTop: '1.25rem' }}>
                        Refund History ({selectedDetail.refundHistory.length})
                      </h3>
                      <div className="slh-table-wrap">
                        <table className="slh-table">
                          <thead>
                            <tr>
                              <th>Purchase Date</th>
                              <th>Plan</th>
                              <th>Amount Paid</th>
                              <th>Refund Amount</th>
                              <th>Reference</th>
                              <th>Refunded On</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedDetail.refundHistory.map((rf) => (
                              <tr key={rf.id}>
                                <td className="slh-nowrap">{rf.purchaseDate}</td>
                                <td className="slh-nowrap">{rf.subscriptionPlan}</td>
                                <td className="slh-nowrap">{formatInr(rf.amountPaid)}</td>
                                <td className="slh-nowrap" style={{ color: '#c084fc', fontWeight: 700 }}>
                                  {formatInr(rf.refundAmount)}
                                </td>
                                <td className="slh-nowrap slh-muted" style={{ fontFamily: 'monospace' }}>
                                  {rf.paymentReference}
                                </td>
                                <td className="slh-nowrap slh-muted">{rf.refundedAt || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
