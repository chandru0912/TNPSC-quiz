import React, { useState } from 'react';
import { CreditCard, Award, CheckCircle2 } from 'lucide-react';
import './SubscriptionDonutChart.css';

export interface SubscriptionDistributionItem {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

interface SubscriptionDonutChartProps {
  distribution?: SubscriptionDistributionItem[];
  totalActive?: number;
  monthlyCount?: number;
  quarterlyCount?: number;
  halfYearlyCount?: number;
  yearlyCount?: number;
  expiredCount?: number;
  newSubscriptionsCount?: number;
}

export const SubscriptionDonutChart: React.FC<SubscriptionDonutChartProps> = ({
  distribution,
  totalActive = 0,
  monthlyCount = 0,
  quarterlyCount = 0,
  halfYearlyCount = 0,
  yearlyCount = 0,
  expiredCount = 0,
  newSubscriptionsCount = 0,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Fallback distribution if none provided
  const items: SubscriptionDistributionItem[] =
    distribution && distribution.length > 0
      ? distribution
      : [
          { name: 'Monthly Pass', count: monthlyCount, percentage: 25, color: '#3b82f6' },
          { name: 'Quarterly Pass', count: quarterlyCount, percentage: 20, color: '#8b5cf6' },
          { name: 'Half-Yearly Pass', count: halfYearlyCount, percentage: 15, color: '#ec4899' },
          { name: 'Yearly Pass', count: yearlyCount, percentage: 35, color: '#10b981' },
          { name: 'Expired', count: expiredCount, percentage: 5, color: '#64748b' },
        ];

  const totalSum = items.reduce((acc, it) => acc + it.count, 0) || 1;

  // SVG Geometry constants
  const size = 260;
  const strokeWidth = 34;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Compute SVG stroke dash offsets
  let accumulatedAngle = 0;
  const segments = items.map((item, idx) => {
    const fraction = item.count / totalSum;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedAngle * circumference;
    accumulatedAngle += fraction;

    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
      index: idx,
    };
  });

  const activeItem = hoveredIndex !== null ? items[hoveredIndex] : null;

  return (
    <div className="subscription-donut-widget glass">
      <div className="donut-widget-header">
        <div className="donut-title-cluster">
          <CreditCard size={18} className="donut-title-icon" />
          <h3 className="donut-widget-title">Subscription Overview</h3>
        </div>
        <div className="donut-header-badges">
          <span className="donut-badge active-badge">
            <CheckCircle2 size={12} />
            {totalActive} Active Passes
          </span>
          {newSubscriptionsCount > 0 && (
            <span className="donut-badge new-badge">+{newSubscriptionsCount} New</span>
          )}
        </div>
      </div>

      <div className="donut-body-layout">
        {/* SVG Donut Chart */}
        <div className="donut-chart-container">
          <svg
            className="donut-svg"
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
          >
            {/* Background Track */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth={strokeWidth}
            />

            {/* Segments */}
            {segments.map((seg) => {
              const isHovered = hoveredIndex === seg.index;
              return (
                <circle
                  key={seg.name}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  strokeLinecap="round"
                  className="donut-segment"
                  style={{
                    transform: 'rotate(-90deg)',
                    transformOrigin: `${center}px ${center}px`,
                    transition: 'all 0.25s ease',
                    opacity: hoveredIndex === null || isHovered ? 1 : 0.45,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setHoveredIndex(seg.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
          </svg>

          {/* Center Callout */}
          <div className="donut-center-content">
            {activeItem ? (
              <div className="donut-center-hovered">
                <span className="center-hover-label" style={{ color: activeItem.color }}>
                  {activeItem.name}
                </span>
                <span className="center-hover-val">{activeItem.count} Users</span>
                <span className="center-hover-pct">{activeItem.percentage}%</span>
              </div>
            ) : (
              <div className="donut-center-default">
                <Award size={24} className="center-default-icon" />
                <span className="center-default-val">{totalActive}</span>
                <span className="center-default-label">Total Active</span>
              </div>
            )}
          </div>
        </div>

        {/* Legend Breakdown */}
        <div className="donut-legend-column">
          {items.map((item, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <div
                key={item.name}
                className={`donut-legend-item ${isHovered ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="legend-item-left">
                  <span
                    className="legend-color-dot"
                    style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}80` }}
                  />
                  <span className="legend-item-name">{item.name}</span>
                </div>
                <div className="legend-item-right">
                  <span className="legend-item-count">{item.count}</span>
                  <span className="legend-item-pct">{item.percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
