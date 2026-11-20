import React from 'react';
import {
  Printer,
  Download,
  CheckCircle2,
} from 'lucide-react';

interface ReportsTabProps {
  overviewCards: any[];
  geographicData: any[];
  activeRange: string;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  overviewCards,
  geographicData,
  activeRange,
}) => {
  const topDistricts = [...geographicData]
    .sort((a, b) => b.revenue - a.revenue || b.students - a.students)
    .slice(0, 5);

  const handlePrint = () => {
    window.print();
  };

  const handleExportJson = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      reportScope: `TNPSC Study Hub Analytics (${activeRange.toUpperCase()})`,
      summaryMetrics: overviewCards,
      topDistricts,
      allDistricts: geographicData,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TNPSC_Analytics_Report_${activeRange}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="reports-tab-container">
      {/* Report Actions Header */}
      <div className="report-action-header glass">
        <div>
          <h3 className="report-main-title">Executive Performance & Growth Report</h3>
          <p className="report-subtitle">
            Consolidated intelligence summary across student engagement, geographic adoption, and verified revenue
          </p>
        </div>

        <div className="report-btns-group">
          <button type="button" onClick={handlePrint} className="report-btn print-btn">
            <Printer size={15} />
            <span>Print Report</span>
          </button>
          <button type="button" onClick={handleExportJson} className="report-btn export-btn">
            <Download size={15} />
            <span>Export Data (JSON)</span>
          </button>
        </div>
      </div>

      {/* Printable Report Document Card */}
      <div className="report-document-card glass printable-area">
        <div className="report-doc-header">
          <div>
            <span className="doc-org-tag">TNPSC STUDY HUB ENTERPRISE PLATFORM</span>
            <h2 className="doc-title">Comprehensive Platform Analytics Audit</h2>
            <p className="doc-date">
              Reporting Window: <strong>{activeRange.toUpperCase()}</strong> • Generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="doc-badge-verified">
            <CheckCircle2 size={16} />
            <span>Verified System Audit</span>
          </div>
        </div>

        {/* Section 1: KPI Summary Matrix */}
        <div className="report-section">
          <h4 className="report-sec-heading">1. Core Platform Health & Growth KPIs</h4>
          <div className="report-kpi-summary-grid">
            {overviewCards.map((c) => (
              <div key={c.id} className="report-kpi-cell">
                <span className="kpi-cell-lbl">{c.title}</span>
                <span className="kpi-cell-val">{c.formatted}</span>
                <span className={`kpi-cell-trend ${c.trend}`}>
                  {c.change === null || c.change === undefined
                    ? 'Insufficient historical data'
                    : `${c.trend === 'up' ? '▲' : c.trend === 'down' ? '▼' : '—'} ${c.change}% vs prev`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Top Performing Districts */}
        <div className="report-section">
          <h4 className="report-sec-heading">2. Top 5 Tamil Nadu Districts by Revenue & Adoption</h4>
          <table className="analytics-data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>District</th>
                <th className="num-col">Enrolled Students</th>
                <th className="num-col">Paid Subscribers</th>
                <th className="num-col">Conversion Rate</th>
                <th className="num-col">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topDistricts.map((d, idx) => (
                <tr key={d.district}>
                  <td>#{idx + 1}</td>
                  <td>
                    <strong style={{ color: '#f8fafc' }}>{d.district}</strong>
                  </td>
                  <td className="num-col">{d.students}</td>
                  <td className="num-col text-gold">{d.subscribers}</td>
                  <td className="num-col text-green">{d.conversionRate}%</td>
                  <td className="num-col">
                    <strong className="text-green">₹{d.revenue.toLocaleString('en-IN')}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 3: Live Data-Derived Observations */}
        <div className="report-section">
          <h4 className="report-sec-heading">3. Database-Derived Observations</h4>
          <div className="insights-list">
            {topDistricts.filter((d) => (d.students || 0) > 0 || (d.revenue || 0) > 0).length === 0 ? (
              <div className="insight-bullet">
                <span className="bullet-dot" />
                <div>No real district adoption data available yet for this reporting window.</div>
              </div>
            ) : (
              <>
                <div className="insight-bullet">
                  <span className="bullet-dot" />
                  <div>
                    <strong>Top District by Enrolled Students / Revenue:</strong>{' '}
                    {topDistricts[0].district} ({topDistricts[0].students} enrolled students,{' '}
                    {topDistricts[0].subscribers} paid subscribers, ₹{Number(topDistricts[0].revenue || 0).toLocaleString('en-IN')} revenue).
                  </div>
                </div>
                <div className="insight-bullet">
                  <span className="bullet-dot" />
                  <div>
                    <strong>Active District Coverage:</strong>{' '}
                    {geographicData.filter((d) => (d.students || 0) > 0).length} of 38 Tamil Nadu districts currently have registered students in PostgreSQL.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
