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
                  {c.trend === 'up' ? '▲' : c.trend === 'down' ? '▼' : '—'} {c.change}% vs prev
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

        {/* Section 3: Strategic Recommendations */}
        <div className="report-section">
          <h4 className="report-sec-heading">3. Growth Insights & Recommendations</h4>
          <div className="insights-list">
            <div className="insight-bullet">
              <span className="bullet-dot" />
              <div>
                <strong>High-Converting Tier Optimization:</strong> Districts with high mobile traffic (Coimbatore, Chennai, Madurai) demonstrate above-average conversion when introduced to 1-month and annual exam passes.
              </div>
            </div>
            <div className="insight-bullet">
              <span className="bullet-dot" />
              <div>
                <strong>Syllabus Focus Expansion:</strong> General Tamil and Aptitude & Mental Ability account for the highest practice frequency. Adding unit-wise mock checkpoints drives direct student retention.
              </div>
            </div>
            <div className="insight-bullet">
              <span className="bullet-dot" />
              <div>
                <strong>Geographic Outlier Acceleration:</strong> Delta and Southern districts (Tirunelveli, Thanjavur, Salem) show strong organic visitor engagement that can be converted through district-specific study material packs.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
