import React from 'react';
import {
  Users,
  UserCheck,
  Globe,
  UserPlus,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Minus,
  FileSpreadsheet,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import './OverviewKpiCards.css';

export interface KpiCardData {
  id: string;
  title: string;
  value: number;
  formatted: string;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  comparisonText?: string;
  icon?: string;
}

interface OverviewKpiCardsProps {
  kpiSummary?: KpiCardData[];
  overviewCards?: any[];
  onOpenReport: () => void;
  onOpenRestoreStudent: () => void;
  onOpenNewStudent: () => void;
}

export const OverviewKpiCards: React.FC<OverviewKpiCardsProps> = ({
  kpiSummary,
  overviewCards,
  onOpenReport,
  onOpenRestoreStudent,
  onOpenNewStudent,
}) => {
  // Fallback resolver if kpiSummary is not yet populated from backend
  const resolveCards = (): KpiCardData[] => {
    if (kpiSummary && kpiSummary.length >= 5) {
      return kpiSummary;
    }

    if (overviewCards && overviewCards.length > 0) {
      const findCard = (id: string) => overviewCards.find((c) => c.id === id);

      const cTotal = findCard('total_students');
      const cActive = findCard('active_today');
      const cTraffic = findCard('total_visitors');
      const cNew = findCard('new_registrations');
      const cSubs = findCard('paid_subscribers');

      return [
        {
          id: 'total_students',
          title: 'Total Students',
          value: cTotal?.value || 0,
          formatted: cTotal?.formatted || '0',
          change: cTotal?.change || 0,
          trend: cTotal?.trend || 'neutral',
          comparisonText: 'vs previous 7 days',
          icon: 'Users',
        },
        {
          id: 'active_students',
          title: 'Active Students',
          value: cActive?.value || 0,
          formatted: cActive?.formatted || '0',
          change: cActive?.change || 0,
          trend: cActive?.trend || 'neutral',
          comparisonText: 'vs previous 7 days',
          icon: 'UserCheck',
        },
        {
          id: 'website_visitors',
          title: 'Website Visitors',
          value: cTraffic?.value || 0,
          formatted: cTraffic?.formatted || '0',
          change: cTraffic?.change || 0,
          trend: cTraffic?.trend || 'neutral',
          comparisonText: 'vs previous 7 days',
          icon: 'Globe',
        },
        {
          id: 'new_students',
          title: 'New Students',
          value: cNew?.value || 0,
          formatted: cNew?.formatted || '0',
          change: cNew?.change || 0,
          trend: cNew?.trend || 'neutral',
          comparisonText: 'vs previous 7 days',
          icon: 'UserPlus',
        },
        {
          id: 'active_subscriptions',
          title: 'Active Subscriptions',
          value: cSubs?.value || 0,
          formatted: cSubs?.formatted || '0',
          change: cSubs?.change || 0,
          trend: cSubs?.trend || 'neutral',
          comparisonText: 'vs previous 7 days',
          icon: 'CreditCard',
        },
      ];
    }

    return [
      { id: 'total_students', title: 'Total Students', value: 0, formatted: '0', change: 0, trend: 'neutral', comparisonText: 'vs previous 7 days', icon: 'Users' },
      { id: 'active_students', title: 'Active Students', value: 0, formatted: '0', change: 0, trend: 'neutral', comparisonText: 'vs previous 7 days', icon: 'UserCheck' },
      { id: 'website_visitors', title: 'Website Visitors', value: 0, formatted: '0', change: 0, trend: 'neutral', comparisonText: 'vs previous 7 days', icon: 'Globe' },
      { id: 'new_students', title: 'New Students', value: 0, formatted: '0', change: 0, trend: 'neutral', comparisonText: 'vs previous 7 days', icon: 'UserPlus' },
      { id: 'active_subscriptions', title: 'Active Subscriptions', value: 0, formatted: '0', change: 0, trend: 'neutral', comparisonText: 'vs previous 7 days', icon: 'CreditCard' },
    ];
  };

  const cards = resolveCards();

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Users':
        return <Users size={22} className="kpi-icon-svg icon-blue" />;
      case 'UserCheck':
        return <UserCheck size={22} className="kpi-icon-svg icon-green" />;
      case 'Globe':
        return <Globe size={22} className="kpi-icon-svg icon-indigo" />;
      case 'UserPlus':
        return <UserPlus size={22} className="kpi-icon-svg icon-amber" />;
      case 'CreditCard':
        return <CreditCard size={22} className="kpi-icon-svg icon-purple" />;
      default:
        return <Users size={22} className="kpi-icon-svg icon-blue" />;
    }
  };

  return (
    <div className="enterprise-kpi-container">
      {/* 5 Core Overview KPI Cards */}
      <div className="enterprise-kpi-grid">
        {cards.map((card) => {
          const isUp = card.trend === 'up';
          const isDown = card.trend === 'down';

          return (
            <div key={card.id} className="enterprise-kpi-card glass">
              <div className="kpi-header-row">
                <span className="kpi-card-title">{card.title}</span>
                <div className={`kpi-icon-wrapper ${card.icon?.toLowerCase() || 'users'}`}>
                  {getIcon(card.icon)}
                </div>
              </div>

              <div className="kpi-metric-row">
                <span className="kpi-value-text">{card.formatted}</span>
              </div>

              <div className="kpi-comparison-row">
                <div className={`kpi-trend-pill ${isUp ? 'trend-up' : isDown ? 'trend-down' : 'trend-neutral'}`}>
                  {isUp && <TrendingUp size={13} className="trend-icon" />}
                  {isDown && <TrendingDown size={13} className="trend-icon" />}
                  {!isUp && !isDown && <Minus size={13} className="trend-icon" />}
                  <span>{card.change > 0 ? `${card.change}%` : '0%'}</span>
                </div>
                <span className="kpi-comparison-label">{card.comparisonText || 'vs previous 7 days'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3 Quick Access Report Cards */}
      <div className="quick-reports-row">
        {/* Card 1: Active Report */}
        <div className="quick-report-card glass" onClick={onOpenReport}>
          <div className="quick-card-left">
            <div className="quick-card-icon-pill report-pill">
              <FileSpreadsheet size={20} />
            </div>
            <div className="quick-card-meta">
              <span className="quick-card-title">Active Report</span>
              <span className="quick-card-desc">Generate & export complete audit reports with metrics</span>
            </div>
          </div>
          <button type="button" className="quick-card-action-btn" aria-label="Open Active Report">
            <span>Generate</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Card 2: Restore Student */}
        <div className="quick-report-card glass" onClick={onOpenRestoreStudent}>
          <div className="quick-card-left">
            <div className="quick-card-icon-pill restore-pill">
              <RotateCcw size={20} />
            </div>
            <div className="quick-card-meta">
              <span className="quick-card-title">Restore Student</span>
              <span className="quick-card-desc">Review & reactivate archived or deactivated student accounts</span>
            </div>
          </div>
          <button type="button" className="quick-card-action-btn" aria-label="Open Restore Student">
            <span>Inspect</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Card 3: New Student */}
        <div className="quick-report-card glass" onClick={onOpenNewStudent}>
          <div className="quick-card-left">
            <div className="quick-card-icon-pill student-pill">
              <UserPlus size={20} />
            </div>
            <div className="quick-card-meta">
              <span className="quick-card-title">New Student</span>
              <span className="quick-card-desc">Quickly enroll verified students with plan & target group</span>
            </div>
          </div>
          <button type="button" className="quick-card-action-btn primary" aria-label="Quick Enroll Student">
            <span>+ Enroll</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
