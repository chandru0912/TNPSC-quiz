import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Users,
  CreditCard,
  Eye,
  Award,
  ChevronRight,
  Search,
  X,
  Compass,
} from 'lucide-react';

export interface DistrictMetric {
  district: string;
  visitors: number;
  uniqueVisitors: number;
  students: number;
  subscribers: number;
  freeStudents: number;
  conversionRate: number;
  revenue: number;
  activeToday: number;
  cities: {
    city: string;
    visitors: number;
    students: number;
    subscribers: number;
    revenue: number;
  }[];
}

interface TamilNaduMapProps {
  districtsData: DistrictMetric[];
  activeMetric: 'visitors' | 'students' | 'subscribers' | 'revenue' | 'activeToday';
  onMetricChange: (metric: 'visitors' | 'students' | 'subscribers' | 'revenue' | 'activeToday') => void;
  selectedDistrict: string | null;
  onSelectDistrict: (districtName: string | null) => void;
  allowReducedMotion?: boolean;
}

interface DistrictGeo {
  name: string;
  cx: number;
  cy: number;
  path: string;
}

// 38 Districts of Tamil Nadu with accurate geographic centroids & polygonal bounds
const DISTRICT_GEOMETRIES: DistrictGeo[] = [
  // Northern Region
  { name: 'Tiruvallur', cx: 485, cy: 95, path: 'M450,75 L510,70 L525,100 L490,120 L455,105 Z' },
  { name: 'Chennai', cx: 535, cy: 95, path: 'M520,80 L550,85 L545,115 L515,110 Z' },
  { name: 'Chengalpattu', cx: 495, cy: 135, path: 'M485,115 L530,115 L525,160 L480,155 Z' },
  { name: 'Kanchipuram', cx: 450, cy: 125, path: 'M425,105 L475,105 L480,145 L430,145 Z' },
  { name: 'Ranipet', cx: 415, cy: 110, path: 'M395,95 L435,95 L435,125 L395,125 Z' },
  { name: 'Vellore', cx: 380, cy: 115, path: 'M360,100 L400,100 L400,135 L360,135 Z' },
  { name: 'Tirupathur', cx: 325, cy: 155, path: 'M305,140 L345,140 L345,175 L305,175 Z' },
  { name: 'Tiruvannamalai', cx: 390, cy: 185, path: 'M365,160 L425,155 L430,210 L370,210 Z' },
  { name: 'Viluppuram', cx: 440, cy: 215, path: 'M420,195 L475,190 L470,240 L420,240 Z' },
  { name: 'Kallakurichi', cx: 375, cy: 240, path: 'M350,220 L410,220 L410,265 L350,265 Z' },
  { name: 'Cuddalore', cx: 465, cy: 245, path: 'M445,230 L500,230 L495,275 L445,275 Z' },

  // North-Western & Western Region
  { name: 'Krishnagiri', cx: 285, cy: 150, path: 'M260,130 L315,130 L310,175 L260,170 Z' },
  { name: 'Dharmapuri', cx: 280, cy: 195, path: 'M255,175 L310,175 L310,220 L255,220 Z' },
  { name: 'Salem', cx: 285, cy: 245, path: 'M255,225 L320,225 L325,270 L255,270 Z' },
  { name: 'Namakkal', cx: 285, cy: 295, path: 'M260,275 L315,275 L315,315 L260,315 Z' },
  { name: 'Erode', cx: 235, cy: 280, path: 'M205,255 L260,255 L260,310 L205,310 Z' },
  { name: 'Nilgiris', cx: 125, cy: 275, path: 'M95,255 L155,255 L150,300 L95,295 Z' },
  { name: 'Coimbatore', cx: 155, cy: 320, path: 'M130,295 L185,295 L180,350 L130,345 Z' },
  { name: 'Tiruppur', cx: 195, cy: 310, path: 'M175,290 L225,290 L220,345 L175,340 Z' },

  // Central Region
  { name: 'Karur', cx: 280, cy: 330, path: 'M255,315 L305,315 L305,355 L255,355 Z' },
  { name: 'Perambalur', cx: 365, cy: 295, path: 'M345,280 L390,280 L390,315 L345,315 Z' },
  { name: 'Ariyalur', cx: 390, cy: 305, path: 'M375,290 L425,290 L420,325 L375,325 Z' },
  { name: 'Tiruchirappalli', cx: 345, cy: 340, path: 'M315,320 L375,320 L370,370 L315,365 Z' },
  { name: 'Dindigul', cx: 265, cy: 385, path: 'M235,360 L295,360 L295,415 L235,410 Z' },

  // Delta & Coastal Region
  { name: 'Mayiladuthurai', cx: 450, cy: 310, path: 'M435,295 L480,295 L475,330 L435,330 Z' },
  { name: 'Nagapattinam', cx: 470, cy: 345, path: 'M455,330 L495,330 L490,380 L460,380 Z' },
  { name: 'Tiruvarur', cx: 445, cy: 345, path: 'M425,330 L465,330 L465,370 L425,370 Z' },
  { name: 'Thanjavur', cx: 395, cy: 345, path: 'M370,325 L430,325 L425,375 L370,370 Z' },
  { name: 'Pudukkottai', cx: 360, cy: 390, path: 'M335,370 L395,370 L390,420 L335,415 Z' },

  // Southern Region
  { name: 'Theni', cx: 215, cy: 425, path: 'M190,400 L240,400 L235,455 L190,450 Z' },
  { name: 'Madurai', cx: 285, cy: 430, path: 'M255,405 L315,405 L315,455 L255,455 Z' },
  { name: 'Sivaganga', cx: 325, cy: 440, path: 'M300,420 L360,420 L355,470 L300,465 Z' },
  { name: 'Virudhunagar', cx: 270, cy: 470, path: 'M240,450 L295,450 L295,500 L240,495 Z' },
  { name: 'Ramanathapuram', cx: 365, cy: 490, path: 'M330,465 L420,465 L415,515 L330,510 Z' },
  { name: 'Tenkasi', cx: 195, cy: 535, path: 'M175,510 L225,510 L220,565 L175,560 Z' },
  { name: 'Tirunelveli', cx: 240, cy: 560, path: 'M215,535 L270,535 L265,595 L215,590 Z' },
  { name: 'Thoothukudi', cx: 290, cy: 555, path: 'M265,530 L320,530 L315,590 L265,585 Z' },
  { name: 'Kanyakumari', cx: 220, cy: 630, path: 'M195,605 L245,605 L240,650 L195,645 Z' },
];

export const TamilNaduMap: React.FC<TamilNaduMapProps> = ({
  districtsData,
  activeMetric,
  onMetricChange,
  selectedDistrict,
  onSelectDistrict,
  allowReducedMotion = false,
}) => {
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Map district metrics
  const dataMap = useMemo(() => {
    const map = new Map<string, DistrictMetric>();
    districtsData.forEach((d) => map.set(d.district.toLowerCase(), d));
    return map;
  }, [districtsData]);

  // Compute max value for the active metric for color scaling
  const metricExtents = useMemo(() => {
    let max = 1;
    districtsData.forEach((d) => {
      let val = 0;
      if (activeMetric === 'visitors') val = d.visitors;
      else if (activeMetric === 'students') val = d.students;
      else if (activeMetric === 'subscribers') val = d.subscribers;
      else if (activeMetric === 'revenue') val = d.revenue;
      else if (activeMetric === 'activeToday') val = d.activeToday;
      if (val > max) max = val;
    });
    return { max };
  }, [districtsData, activeMetric]);

  // Calculate heatmap color intensity
  const getFillColor = (districtName: string): string => {
    const data = dataMap.get(districtName.toLowerCase());
    if (!data) return 'rgba(30, 27, 75, 0.4)';

    let val = 0;
    if (activeMetric === 'visitors') val = data.visitors;
    else if (activeMetric === 'students') val = data.students;
    else if (activeMetric === 'subscribers') val = data.subscribers;
    else if (activeMetric === 'revenue') val = data.revenue;
    else if (activeMetric === 'activeToday') val = data.activeToday;

    const ratio = Math.min(1, Math.max(0.12, val / (metricExtents.max || 1)));

    if (activeMetric === 'revenue') {
      return `rgba(16, 185, 129, ${0.2 + ratio * 0.75})`;
    } else if (activeMetric === 'subscribers') {
      return `rgba(245, 158, 11, ${0.2 + ratio * 0.75})`;
    } else if (activeMetric === 'activeToday') {
      return `rgba(6, 182, 212, ${0.2 + ratio * 0.75})`;
    } else {
      return `rgba(139, 92, 246, ${0.2 + ratio * 0.75})`;
    }
  };

  const activeDistrictRecord = useMemo(() => {
    if (!selectedDistrict) return null;
    return dataMap.get(selectedDistrict.toLowerCase()) || null;
  }, [selectedDistrict, dataMap]);

  const hoveredData = useMemo(() => {
    if (!hoveredDistrict) return null;
    return dataMap.get(hoveredDistrict.toLowerCase()) || null;
  }, [hoveredDistrict, dataMap]);

  return (
    <div className={`tn-geo-analytics-container ${allowReducedMotion ? 'reduced-motion' : ''}`}>
      {/* Map Control Header */}
      <div className="geo-header-toolbar">
        <div className="geo-header-title-box">
          <div className="geo-icon-badge">
            <Compass size={20} className="geo-compass-icon" />
          </div>
          <div>
            <h3 className="geo-title">Tamil Nadu Geographic Analytics</h3>
            <p className="geo-subtitle">Interactive 38-District Vector Heatmap & City Breakdown</p>
          </div>
        </div>

        {/* Metric Selector Pills */}
        <div className="geo-metric-selector">
          <button
            type="button"
            className={`geo-metric-btn ${activeMetric === 'visitors' ? 'active' : ''}`}
            onClick={() => onMetricChange('visitors')}
          >
            <Eye size={14} />
            <span>Visitors</span>
          </button>
          <button
            type="button"
            className={`geo-metric-btn ${activeMetric === 'students' ? 'active' : ''}`}
            onClick={() => onMetricChange('students')}
          >
            <Users size={14} />
            <span>Students</span>
          </button>
          <button
            type="button"
            className={`geo-metric-btn ${activeMetric === 'subscribers' ? 'active' : ''}`}
            onClick={() => onMetricChange('subscribers')}
          >
            <Award size={14} />
            <span>Subscribers</span>
          </button>
          <button
            type="button"
            className={`geo-metric-btn ${activeMetric === 'revenue' ? 'active' : ''}`}
            onClick={() => onMetricChange('revenue')}
          >
            <CreditCard size={14} />
            <span>Revenue</span>
          </button>
          <button
            type="button"
            className={`geo-metric-btn ${activeMetric === 'activeToday' ? 'active' : ''}`}
            onClick={() => onMetricChange('activeToday')}
          >
            <span className="live-pulse-dot" />
            <span>Active Today</span>
          </button>
        </div>
      </div>

      <div className="geo-main-grid">
        {/* Left: Interactive Vector SVG Map */}
        <div className="geo-map-viewport glass">
          {/* Quick Search */}
          <div className="geo-search-bar">
            <Search size={15} className="geo-search-icon" />
            <input
              type="text"
              placeholder="Search all 38 districts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="geo-search-input"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="geo-clear-search">
                <X size={14} />
              </button>
            )}
          </div>

          <div
            className="svg-map-wrapper"
            onMouseLeave={() => {
              setHoveredDistrict(null);
            }}
          >
            <svg
              viewBox="0 0 600 700"
              className="tn-vector-svg"
              aria-label="Interactive Map of Tamil Nadu"
            >
              <defs>
                <filter id="map-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="bay-of-bengal" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(56, 189, 248, 0.05)" />
                  <stop offset="100%" stopColor="rgba(30, 27, 75, 0.02)" />
                </linearGradient>
              </defs>

              <rect x="0" y="0" width="600" height="700" fill="url(#bay-of-bengal)" rx="12" />

              <path
                d="M540,70 Q510,250 495,350 Q435,500 230,650"
                fill="none"
                stroke="rgba(129, 140, 248, 0.15)"
                strokeDasharray="4 6"
                strokeWidth="1.5"
              />

              {DISTRICT_GEOMETRIES.map((dg) => {
                const isSelected = selectedDistrict?.toLowerCase() === dg.name.toLowerCase();
                const isHovered = hoveredDistrict?.toLowerCase() === dg.name.toLowerCase();
                const fillColor = getFillColor(dg.name);

                return (
                  <g
                    key={dg.name}
                    className={`district-geo-group ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                    onClick={() => {
                      if (selectedDistrict?.toLowerCase() === dg.name.toLowerCase()) {
                        onSelectDistrict(null);
                      } else {
                        onSelectDistrict(dg.name);
                      }
                    }}
                    onMouseEnter={() => {
                      setHoveredDistrict(dg.name);
                    }}
                  >
                    <path
                      d={dg.path}
                      fill={fillColor}
                      stroke={isSelected ? '#38bdf8' : isHovered ? '#c084fc' : 'rgba(147, 197, 253, 0.35)'}
                      strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1}
                      filter={isSelected || isHovered ? 'url(#map-glow)' : undefined}
                      className="district-polygon"
                    />

                    <circle
                      cx={dg.cx}
                      cy={dg.cy}
                      r={isSelected ? 5 : isHovered ? 4.5 : 3}
                      fill={isSelected ? '#38bdf8' : isHovered ? '#c084fc' : '#ffffff'}
                      opacity={isSelected || isHovered ? 1 : 0.75}
                      className="district-node-circle"
                    />

                    <text
                      x={dg.cx}
                      y={dg.cy + 13}
                      textAnchor="middle"
                      className="district-map-label"
                      fill={isSelected ? '#38bdf8' : isHovered ? '#ffffff' : 'rgba(226, 232, 240, 0.85)'}
                      fontSize={isSelected ? 10 : 8.5}
                      fontWeight={isSelected ? 700 : 500}
                    >
                      {dg.name}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Card */}
            {hoveredDistrict && hoveredData && (
              <div
                className="geo-floating-tooltip glass"
                style={{
                  position: 'absolute',
                  pointerEvents: 'none',
                  top: '1rem',
                  right: '1rem',
                  zIndex: 20,
                }}
              >
                <div className="tooltip-header">
                  <span className="tooltip-badge">TN District</span>
                  <h4 className="tooltip-title">{hoveredData.district}</h4>
                </div>
                <div className="tooltip-grid">
                  <div className="tooltip-stat">
                    <span className="stat-label">Total Visitors</span>
                    <span className="stat-val">{hoveredData.visitors.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="tooltip-stat">
                    <span className="stat-label">Enrolled Students</span>
                    <span className="stat-val">{hoveredData.students.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="tooltip-stat">
                    <span className="stat-label">Paid Subscribers</span>
                    <span className="stat-val gold-val">{hoveredData.subscribers}</span>
                  </div>
                  <div className="tooltip-stat">
                    <span className="stat-label">Conversion Rate</span>
                    <span className="stat-val green-val">{hoveredData.conversionRate}%</span>
                  </div>
                  <div className="tooltip-stat">
                    <span className="stat-label">District Revenue</span>
                    <span className="stat-val green-val">₹{hoveredData.revenue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="tooltip-stat">
                    <span className="stat-label">Active Today</span>
                    <span className="stat-val cyan-val">{hoveredData.activeToday}</span>
                  </div>
                </div>
                <div className="tooltip-footer">Click to view full district analytics drawer</div>
              </div>
            )}
          </div>

          <div className="geo-map-legend">
            <span className="legend-label">Low Activity</span>
            <div className={`legend-bar ${activeMetric}`} />
            <span className="legend-label">Peak Concentration</span>
          </div>
        </div>

        {/* Right: District Details Drawer / Table */}
        <div className="geo-side-panel glass">
          {activeDistrictRecord ? (
            <div className="district-drawer-content">
              <div className="drawer-header">
                <div>
                  <span className="drawer-badge">District Deep Dive</span>
                  <h3 className="drawer-title">{activeDistrictRecord.district}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectDistrict(null)}
                  className="drawer-close-btn"
                  title="Close District Panel"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="drawer-kpi-grid">
                <div className="drawer-kpi-card">
                  <div className="kpi-icon-wrap" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc' }}>
                    <Eye size={16} />
                  </div>
                  <div className="kpi-info">
                    <span className="kpi-lbl">Total Visitors</span>
                    <strong className="kpi-num">{activeDistrictRecord.visitors.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
                <div className="drawer-kpi-card">
                  <div className="kpi-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    <Users size={16} />
                  </div>
                  <div className="kpi-info">
                    <span className="kpi-lbl">Total Students</span>
                    <strong className="kpi-num">{activeDistrictRecord.students.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
                <div className="drawer-kpi-card">
                  <div className="kpi-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                    <Award size={16} />
                  </div>
                  <div className="kpi-info">
                    <span className="kpi-lbl">Subscribers</span>
                    <strong className="kpi-num">{activeDistrictRecord.subscribers}</strong>
                  </div>
                </div>
                <div className="drawer-kpi-card">
                  <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                    <CreditCard size={16} />
                  </div>
                  <div className="kpi-info">
                    <span className="kpi-lbl">Total Revenue</span>
                    <strong className="kpi-num">₹{activeDistrictRecord.revenue.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              </div>

              <div className="drawer-conversion-card">
                <div className="conversion-header">
                  <span className="conversion-title">Subscription Conversion Rate</span>
                  <span className="conversion-pct">{activeDistrictRecord.conversionRate}%</span>
                </div>
                <div className="conversion-progress-track">
                  <div
                    className="conversion-progress-fill"
                    style={{ width: `${Math.min(100, activeDistrictRecord.conversionRate)}%` }}
                  />
                </div>
                <div className="conversion-breakdown">
                  <span>Paid: {activeDistrictRecord.subscribers}</span>
                  <span>Free: {activeDistrictRecord.freeStudents}</span>
                </div>
              </div>

              <div className="drawer-city-section">
                <h4 className="city-section-title">City & Taluk Breakdown</h4>
                <div className="city-table-container">
                  <table className="city-table">
                    <thead>
                      <tr>
                        <th>City / Taluk</th>
                        <th className="num-col">Visitors</th>
                        <th className="num-col">Students</th>
                        <th className="num-col">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeDistrictRecord.cities.map((c: any) => (
                        <tr key={c.city}>
                          <td className="city-name-cell">
                            <MapPin size={12} className="city-pin-icon" />
                            <span>{c.city}</span>
                          </td>
                          <td className="num-col">{c.visitors}</td>
                          <td className="num-col">{c.students}</td>
                          <td className="num-col revenue-cell">₹{c.revenue.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="all-districts-list-panel">
              <div className="list-panel-header">
                <div>
                  <h4 className="list-panel-title">All 38 Districts Overview</h4>
                  <p className="list-panel-subtitle">Select any district on map or list to inspect details</p>
                </div>
              </div>

              <div className="district-ranking-scroll">
                {districtsData
                  .filter((d) => !searchQuery || d.district.toLowerCase().includes(searchQuery.toLowerCase()))
                  .sort((a, b) => {
                    if (activeMetric === 'revenue') return b.revenue - a.revenue;
                    if (activeMetric === 'subscribers') return b.subscribers - a.subscribers;
                    if (activeMetric === 'students') return b.students - a.students;
                    if (activeMetric === 'activeToday') return b.activeToday - a.activeToday;
                    return b.visitors - a.visitors;
                  })
                  .map((d, idx) => (
                    <div
                      key={d.district}
                      className="district-rank-item"
                      onClick={() => onSelectDistrict(d.district)}
                    >
                      <span className="rank-num">#{idx + 1}</span>
                      <div className="rank-district-info">
                        <span className="rank-district-name">{d.district}</span>
                        <span className="rank-district-sub">
                          {d.students} Students • {d.conversionRate}% Conv
                        </span>
                      </div>
                      <div className="rank-metric-val">
                        <strong>
                          {activeMetric === 'revenue'
                            ? `₹${d.revenue.toLocaleString('en-IN')}`
                            : activeMetric === 'subscribers'
                            ? d.subscribers
                            : activeMetric === 'students'
                            ? d.students
                            : activeMetric === 'activeToday'
                            ? d.activeToday
                            : d.visitors}
                        </strong>
                        <ChevronRight size={14} className="rank-arrow" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
