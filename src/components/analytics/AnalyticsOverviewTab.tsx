import React from 'react';
import {
  MapPin,
  ChevronRight,
  Radio,
  Target,
  FileText,
} from 'lucide-react';
import { OverviewKpiCards, type KpiCardData } from './OverviewKpiCards';
import { SubscriptionDonutChart, type SubscriptionDistributionItem } from './SubscriptionDonutChart';
import { StudentPerformanceCard, type PerformanceSummaryData } from './StudentPerformanceCard';
import { TrafficAreaChart } from './TrafficAreaChart';
import { RevenueBarChart } from './RevenueBarChart';
import { GroupDistributionDonut } from './GroupDistributionDonut';

interface OverviewCard {
  id: string;
  title: string;
  value: number;
  formatted: string;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  category: string;
  badge: string;
}

interface AnalyticsOverviewTabProps {
  cards: OverviewCard[];
  kpiSummary?: KpiCardData[];
  trafficTimeseries: any[];
  revenueTrend: any[];
  groupBreakdown: any[];
  subscriptionDistribution?: SubscriptionDistributionItem[];
  subscriptionSummary?: {
    totalActive: number;
    monthlyCount: number;
    quarterlyCount: number;
    halfYearlyCount: number;
    yearlyCount: number;
    expiredCount: number;
    newSubscriptionsCount: number;
  };
  performanceSummary?: PerformanceSummaryData;
  mockTests?: any;
  onNavigateTab: (tabKey: string) => void;
  onOpenRestoreStudent?: () => void;
  onOpenNewStudent?: () => void;
  allowAnimations?: boolean;
}

export const AnalyticsOverviewTab: React.FC<AnalyticsOverviewTabProps> = ({
  cards,
  kpiSummary,
  trafficTimeseries,
  revenueTrend,
  groupBreakdown,
  subscriptionDistribution,
  subscriptionSummary,
  performanceSummary,
  mockTests,
  onNavigateTab,
  onOpenRestoreStudent = () => onNavigateTab('students'),
  onOpenNewStudent = () => {},
  allowAnimations = true,
}) => {
  return (
    <div className="overview-tab-content">
      {/* 1. 5 Core KPI Overview Cards & 3 Quick Access Report Cards */}
      <OverviewKpiCards
        kpiSummary={kpiSummary}
        overviewCards={cards}
        onOpenReport={() => onNavigateTab('reports')}
        onOpenRestoreStudent={onOpenRestoreStudent}
        onOpenNewStudent={onOpenNewStudent}
      />

      {/* 2. Primary Analytics Showcase: Student Performance & Subscription Donut */}
      <div className="overview-showcase-grid">
        <div className="showcase-cell">
          <StudentPerformanceCard
            performanceSummary={performanceSummary}
            mockTests={mockTests}
          />
        </div>
        <div className="showcase-cell">
          <SubscriptionDonutChart
            distribution={subscriptionDistribution}
            totalActive={subscriptionSummary?.totalActive}
            monthlyCount={subscriptionSummary?.monthlyCount}
            quarterlyCount={subscriptionSummary?.quarterlyCount}
            halfYearlyCount={subscriptionSummary?.halfYearlyCount}
            yearlyCount={subscriptionSummary?.yearlyCount}
            expiredCount={subscriptionSummary?.expiredCount}
            newSubscriptionsCount={subscriptionSummary?.newSubscriptionsCount}
          />
        </div>
      </div>

      {/* 3. Tamil Nadu Geographic Vector Intelligence Callout */}
      <div className="tn-geographic-callout-banner glass">
        <div className="callout-left">
          <div className="callout-icon-box">
            <MapPin size={24} className="pin-icon" />
          </div>
          <div className="callout-meta">
            <h3 className="callout-title">Tamil Nadu 38-District Geographic Intelligence</h3>
            <p className="callout-desc">
              Explore district-wise candidate distribution, real-time website traffic, active learners, and regional conversion rates across Chennai, Coimbatore, Madurai, Salem, and all 38 districts.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="callout-cta-btn"
          onClick={() => onNavigateTab('geographic')}
        >
          <span>Open 38-District Interactive Map</span>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 4. Traffic & Revenue Trend Charts */}
      <div className="overview-charts-grid">
        {/* Left: Traffic & Impressions Growth */}
        <div className="chart-panel-card glass">
          <div className="panel-card-header">
            <div>
              <h3 className="panel-card-title">Traffic & Impressions Trend</h3>
              <p className="panel-card-subtitle">Daily Page Views vs. Unique Visitors Across Tamil Nadu</p>
            </div>
            <button
              type="button"
              className="panel-view-more-btn"
              onClick={() => onNavigateTab('traffic')}
            >
              Detailed Traffic &rarr;
            </button>
          </div>
          <TrafficAreaChart data={trafficTimeseries} allowAnimations={allowAnimations} />
        </div>

        {/* Right: Revenue & Subscriptions */}
        <div className="chart-panel-card glass">
          <div className="panel-card-header">
            <div>
              <h3 className="panel-card-title">Monthly Subscription Revenue</h3>
              <p className="panel-card-subtitle">Verified INR Revenue & Active Subscriptions</p>
            </div>
            <button
              type="button"
              className="panel-view-more-btn"
              onClick={() => onNavigateTab('subscriptions')}
            >
              Revenue Hub &rarr;
            </button>
          </div>
          <RevenueBarChart data={revenueTrend} allowAnimations={allowAnimations} />
        </div>
      </div>

      {/* 5. Secondary Row: TNPSC Target Group Distribution & Quick Modules */}
      <div className="overview-bottom-grid">
        <div className="chart-panel-card glass">
          <div className="panel-card-header">
            <div>
              <h3 className="panel-card-title">TNPSC Target Group Distribution</h3>
              <p className="panel-card-subtitle">Group 1, 2, 2A & 4 Candidate Enrollment Proportion</p>
            </div>
            <button
              type="button"
              className="panel-view-more-btn"
              onClick={() => onNavigateTab('students')}
            >
              Student Roster &rarr;
            </button>
          </div>
          <GroupDistributionDonut data={groupBreakdown} allowAnimations={allowAnimations} />
        </div>

        <div className="chart-panel-card glass quick-actions-panel">
          <div className="panel-card-header">
            <div>
              <h3 className="panel-card-title">Enterprise Analytics Subsystems</h3>
              <p className="panel-card-subtitle">Fast navigation to specialized analytics views</p>
            </div>
          </div>
          <div className="quick-nav-list">
            <div className="quick-nav-item" onClick={() => onNavigateTab('geographic')}>
              <div className="quick-nav-icon" style={{ color: '#38bdf8' }}><MapPin size={16} /></div>
              <div className="quick-nav-info">
                <strong>Tamil Nadu 38-District Vector Heatmap</strong>
                <span>Inspect district-wise visitors, students, subscribers and revenue</span>
              </div>
            </div>
            <div className="quick-nav-item" onClick={() => onNavigateTab('live')}>
              <div className="quick-nav-icon" style={{ color: '#22d3ee' }}><Radio size={16} /></div>
              <div className="quick-nav-info">
                <strong>Live Traffic & Web Activity Monitor</strong>
                <span>Active concurrent visitors, active students and real-time page streams</span>
              </div>
            </div>
            <div className="quick-nav-item" onClick={() => onNavigateTab('performance')}>
              <div className="quick-nav-icon" style={{ color: '#facc15' }}><Target size={16} /></div>
              <div className="quick-nav-info">
                <strong>TNPSC Subject & MCQ Accuracy Analysis</strong>
                <span>General Tamil, History, Polity, Aptitude & Mock Test metrics</span>
              </div>
            </div>
            <div className="quick-nav-item" onClick={() => onNavigateTab('reports')}>
              <div className="quick-nav-icon" style={{ color: '#34d399' }}><FileText size={16} /></div>
              <div className="quick-nav-info">
                <strong>Executive Performance & Growth Report</strong>
                <span>Consolidated multi-dimensional summary report ready for export</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
