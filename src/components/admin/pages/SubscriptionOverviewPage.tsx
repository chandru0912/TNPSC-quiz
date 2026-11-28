import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Edit3,
  Save,
  X,
  Receipt,
  AlertTriangle,
  Crown,
} from 'lucide-react';
import { apiFetch } from '../../../utils/api';
import { SubscriptionAnalyticsTab } from '../../analytics/SubscriptionAnalyticsTab';
import { SubscriptionDonutChart } from '../../analytics/SubscriptionDonutChart';
import './SubscriptionOverviewPage.css';

interface SubscriptionOverviewPageProps {
  token: string | null;
}

interface AdminPlanConfig {
  id: string;
  planName: string;
  price: number;
  currency: string;
  durationDays: number | null;
  requiresDurationConfig: boolean;
  isActive: boolean;
  isFeatured: boolean;
  entitlements: string[];
  totalPurchases: number;
  totalRevenue: number;
  activeSubscribers: number;
}

export const SubscriptionOverviewPage: React.FC<SubscriptionOverviewPageProps> = ({ token }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<AdminPlanConfig[]>([]);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editDuration, setEditDuration] = useState<string>('');
  const [editActive, setEditActive] = useState<boolean>(true);
  const [savingPlan, setSavingPlan] = useState<boolean>(false);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  const [subscriptionData, setSubscriptionData] = useState<{
    plans: { planName: string; count: number; revenue: number }[];
    revenueTrend: { month: string; revenue: number; subscribers: number }[];
    recentTransactions: any[];
    distribution?: any[];
    summary?: any;
  }>({
    plans: [],
    revenueTrend: [],
    recentTransactions: [],
  });

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    if (isManualRefresh) setPlanMessage(null);
    try {
      const [subRes, plansRes] = await Promise.all([
        apiFetch('/api/analytics/subscriptions', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiFetch('/api/admin/subscriptions/plans', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!subRes.ok && !plansRes.ok) {
        throw new Error('Failed to refresh live subscription analytics from server.');
      }

      if (subRes.ok) {
        const json = await subRes.json();
        const subData = json.data || json;
        setSubscriptionData({
          plans: subData.plans || [],
          revenueTrend: subData.revenueTrend || [],
          recentTransactions: subData.recentTransactions || [],
          distribution: subData.distribution,
          summary: subData.summary,
        });
      }

      if (plansRes.ok) {
        const pJson = await plansRes.json();
        if (pJson.status === 'success' && Array.isArray(pJson.data?.plans)) {
          setPlans(pJson.data.plans);
        }
      }

      if (isManualRefresh) {
        setPlanMessage('Subscription overview refreshed with latest live database records.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription metrics.');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const startEdit = (plan: AdminPlanConfig) => {
    setEditingPlanId(plan.id);
    setEditPrice(String(plan.price));
    setEditDuration(plan.durationDays !== null ? String(plan.durationDays) : '');
    setEditActive(plan.isActive);
    setPlanMessage(null);
    setError(null);
  };

  const handleSavePlan = async (planId: string) => {
    setSavingPlan(true);
    setError(null);
    setPlanMessage(null);
    try {
      const parsedPrice = Number(editPrice);
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        throw new Error('Price must be a positive number.');
      }
      const trimmedDur = editDuration.trim();
      const durationDays = trimmedDur === '' ? null : Number(trimmedDur);
      if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays <= 0)) {
        throw new Error('Duration must be a whole number of days (e.g. 30, 90, 180) or left blank.');
      }

      const res = await apiFetch(`/api/admin/subscriptions/plans/${encodeURIComponent(planId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          price: parsedPrice,
          durationDays,
          isActive: editActive,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status !== 'success') {
        throw new Error(json.message || 'Failed to save plan configuration.');
      }

      setEditingPlanId(null);
      setPlanMessage(
        `Updated "${json.data.plan.planName}" successfully. Historical transaction price snapshots remain unchanged.`
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update subscription plan.');
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <div className="admin-subpage-root">
      <div className="subpage-header-row">
        <div className="subpage-titles">
          <h1 className="subpage-title">Subscription &amp; Revenue Overview</h1>
          <p className="subpage-subtitle">
            Configure TNPSC Aspirant Orbit subscription plans, pricing, validity durations, and monitor verified Razorpay revenue.
          </p>
        </div>
        <div className="sub-overview-header-actions">
          <button
            type="button"
            className="sub-overview-btn sub-overview-btn--history"
            onClick={() => navigate('/admin/analytics/subscription-history')}
          >
            <Receipt size={15} />
            <span>Student Subscription History</span>
          </button>
          <button
            type="button"
            className="sub-overview-btn sub-overview-btn--refresh"
            onClick={() => void loadData(true)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'sub-overview-spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="subpage-error-alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {planMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.8rem 1rem',
            borderRadius: '12px',
            marginBottom: '1rem',
            background: 'rgba(16, 185, 129, 0.14)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#6ee7b7',
            fontSize: '0.86rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{planMessage}</span>
        </div>
      )}

      {/* Official Subscription Plans Management Table */}
      <section
        className="glass"
        style={{
          padding: '1.35rem 1.5rem',
          borderRadius: '18px',
          border: '1px solid rgba(129, 140, 248, 0.24)',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.08rem', color: '#f8fafc', fontWeight: 700 }}>
              Subscription Plans &amp; Duration Configuration
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Changes apply to future checkouts only. Historical payment transactions preserve their original price snapshot.
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '0.65rem 0.75rem' }}>Plan</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Entitlements</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Price (INR)</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Duration (Days)</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Status</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Verified Purchases</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Verified Revenue</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const isEditing = editingPlanId === p.id;
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#e2e8f0' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        {p.isFeatured && <Crown size={15} style={{ color: '#facc15' }} />}
                        <span>{p.planName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', color: '#cbd5e1', fontSize: '0.78rem' }}>
                      {p.entitlements.join(', ')}
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 700, color: '#fbbf24' }}>
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          style={{
                            width: '90px',
                            padding: '0.35rem 0.5rem',
                            borderRadius: '8px',
                            background: 'rgba(15,23,42,0.85)',
                            border: '1px solid rgba(129,140,248,0.45)',
                            color: '#f8fafc',
                          }}
                        />
                      ) : (
                        `₹${p.price.toLocaleString('en-IN')}`
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          max="3650"
                          placeholder="Unset"
                          value={editDuration}
                          onChange={(e) => setEditDuration(e.target.value)}
                          style={{
                            width: '95px',
                            padding: '0.35rem 0.5rem',
                            borderRadius: '8px',
                            background: 'rgba(15,23,42,0.85)',
                            border: '1px solid rgba(129,140,248,0.45)',
                            color: '#f8fafc',
                          }}
                        />
                      ) : p.durationDays !== null ? (
                        <span>{p.durationDays} days</span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '999px',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            background: 'rgba(245, 158, 11, 0.14)',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                            color: '#fbbf24',
                          }}
                        >
                          <AlertTriangle size={12} />
                          Requires Configuration
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {isEditing ? (
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={(e) => setEditActive(e.target.checked)}
                          />
                          <span>{editActive ? 'Enabled' : 'Disabled'}</span>
                        </label>
                      ) : (
                        <span
                          style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: p.isActive ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
                            border: p.isActive
                              ? '1px solid rgba(16,185,129,0.35)'
                              : '1px solid rgba(239,68,68,0.35)',
                            color: p.isActive ? '#34d399' : '#f87171',
                          }}
                        >
                          {p.isActive ? 'Enabled' : 'Disabled'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {p.totalPurchases.toLocaleString('en-IN')}{' '}
                      <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>
                        ({p.activeSubscribers} active)
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 600, color: '#34d399' }}>
                      ₹{p.totalRevenue.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {isEditing ? (
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="admin-action-outline-btn"
                            onClick={() => void handleSavePlan(p.id)}
                            disabled={savingPlan}
                            style={{ padding: '0.32rem 0.65rem', fontSize: '0.78rem' }}
                          >
                            <Save size={13} />
                            <span>{savingPlan ? 'Saving...' : 'Save'}</span>
                          </button>
                          <button
                            type="button"
                            className="admin-action-outline-btn"
                            onClick={() => setEditingPlanId(null)}
                            disabled={savingPlan}
                            style={{ padding: '0.32rem 0.55rem', fontSize: '0.78rem' }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="admin-action-outline-btn"
                          onClick={() => startEdit(p)}
                          style={{ padding: '0.32rem 0.65rem', fontSize: '0.78rem' }}
                        >
                          <Edit3 size={13} />
                          <span>Configure</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Subscription Analytics Tab */}
      <SubscriptionAnalyticsTab subscriptionData={subscriptionData} allowAnimations={true} />

      {/* Donut Chart Distribution */}
      {subscriptionData.distribution && subscriptionData.distribution.length > 0 && (
        <div style={{ marginTop: '1.5rem', maxWidth: '500px' }}>
          <SubscriptionDonutChart distribution={subscriptionData.distribution} />
        </div>
      )}
    </div>
  );
};
