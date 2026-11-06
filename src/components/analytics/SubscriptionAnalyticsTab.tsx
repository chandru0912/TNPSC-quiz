import React from 'react';
import { RevenueBarChart } from './RevenueBarChart';
import { Award, CheckCircle2, MapPin } from 'lucide-react';

interface SubscriptionAnalyticsTabProps {
  subscriptionData: {
    plans: { planName: string; count: number; revenue: number }[];
    revenueTrend: { month: string; revenue: number; subscribers: number }[];
    recentTransactions: {
      id: number;
      studentName: string;
      studentEmail: string;
      planName: string;
      amount: number;
      status: string;
      paymentMethod: string;
      district: string;
      city: string;
      date: string;
    }[];
  };
  allowAnimations?: boolean;
}

export const SubscriptionAnalyticsTab: React.FC<SubscriptionAnalyticsTabProps> = ({
  subscriptionData,
  allowAnimations = true,
}) => {
  const { plans, revenueTrend, recentTransactions } = subscriptionData;

  const totalRevenue = plans.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalPaidSubs = plans.reduce((acc, curr) => acc + curr.count, 0);
  const avgOrderVal = totalPaidSubs > 0 ? Math.round(totalRevenue / totalPaidSubs) : 0;

  return (
    <div className="subscriptions-tab-container">
      {/* 3 Revenue KPI Cards */}
      <div className="sub-kpi-row">
        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Total Verified Revenue</span>
            <div className="sub-badge green">INR</div>
          </div>
          <div className="sub-val">₹{totalRevenue.toLocaleString('en-IN')}</div>
          <p className="sub-caption">100% verified student transactions</p>
        </div>

        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Active Paid Subscribers</span>
            <div className="sub-badge purple">Active Tier</div>
          </div>
          <div className="sub-val text-purple">{totalPaidSubs}</div>
          <p className="sub-caption">Pro and Annual access passes</p>
        </div>

        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Average Revenue per User (ARPU)</span>
            <div className="sub-badge gold">Pass Metric</div>
          </div>
          <div className="sub-val text-gold">₹{avgOrderVal.toLocaleString('en-IN')}</div>
          <p className="sub-caption">Per paid subscription license</p>
        </div>
      </div>

      {/* Main Bar Chart: Monthly Revenue & Trend */}
      <div className="chart-panel-card glass" style={{ marginBottom: '1.5rem' }}>
        <div className="panel-card-header">
          <div>
            <h3 className="panel-card-title">Monthly Subscription Revenue Trend</h3>
            <p className="panel-card-subtitle">Verified INR payments over the last 12 months</p>
          </div>
        </div>
        <RevenueBarChart data={revenueTrend} allowAnimations={allowAnimations} />
      </div>

      {/* Plans Distribution & Recent Transactions */}
      <div className="traffic-grid-cols">
        {/* Plans Breakdown */}
        <div className="chart-panel-card glass">
          <div className="panel-card-header">
            <div>
              <h3 className="panel-card-title">Subscription Plans Breakdown</h3>
              <p className="panel-card-subtitle">Revenue and volume by subscription tier</p>
            </div>
          </div>

          <div className="plans-list">
            {plans.map((p) => (
              <div key={p.planName} className="plan-item-card glass">
                <div className="plan-info">
                  <div className="plan-name-row">
                    <Award size={16} className="plan-icon" />
                    <strong className="plan-name">{p.planName}</strong>
                  </div>
                  <span className="plan-sub-count">{p.count} active subscribers</span>
                </div>
                <div className="plan-rev-box">
                  <span className="plan-rev-val">₹{p.revenue.toLocaleString('en-IN')}</span>
                  <span className="plan-rev-lbl">Total Rev</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions Table */}
        <div className="chart-panel-card glass">
          <div className="panel-card-header">
            <div>
              <h3 className="panel-card-title">Recent Transactions</h3>
              <p className="panel-card-subtitle">Latest verified student subscription payments</p>
            </div>
          </div>

          <div className="recent-tx-table-wrap">
            <table className="analytics-data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Plan & Method</th>
                  <th>Location</th>
                  <th className="num-col">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-stream-cell">
                      No transactions recorded for selected filters.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <strong className="tx-student-name">{tx.studentName}</strong>
                        <div className="tx-student-email">{tx.studentEmail}</div>
                      </td>
                      <td>
                        <div className="tx-plan">{tx.planName}</div>
                        <span className="tx-method">{tx.paymentMethod}</span>
                      </td>
                      <td>
                        <div className="tx-location">
                          <MapPin size={11} />
                          <span>{tx.district}</span>
                        </div>
                      </td>
                      <td className="num-col">
                        <strong className="tx-amt">₹{tx.amount.toLocaleString('en-IN')}</strong>
                      </td>
                      <td>
                        <span className="tx-status-badge active">
                          <CheckCircle2 size={11} />
                          <span>{tx.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
