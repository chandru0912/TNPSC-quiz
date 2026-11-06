import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../../../utils/api';
import { SubscriptionAnalyticsTab } from '../../analytics/SubscriptionAnalyticsTab';
import { SubscriptionDonutChart } from '../../analytics/SubscriptionDonutChart';

interface SubscriptionOverviewPageProps {
  token: string | null;
}

export const SubscriptionOverviewPage: React.FC<SubscriptionOverviewPageProps> = ({ token }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/analytics/subscriptions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setSubscriptionData({
          plans: json.plans || [],
          revenueTrend: json.revenueTrend || [],
          recentTransactions: json.recentTransactions || [],
          distribution: json.distribution,
          summary: json.summary,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription metrics.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="admin-subpage-root">
      <div className="subpage-header-row">
        <div className="subpage-titles">
          <h1 className="subpage-title">Subscription & Revenue Overview</h1>
          <p className="subpage-subtitle">
            Track MRR, pass breakdown (Monthly, Quarterly, Annual), conversion rates, and recent transaction history.
          </p>
        </div>
        <button
          type="button"
          className="admin-action-outline-btn"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {error && (
        <div className="subpage-error-alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

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
