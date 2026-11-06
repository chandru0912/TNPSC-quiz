import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface TrafficAreaChartProps {
  data: {
    date: string;
    pageViews: number;
    uniqueVisitors: number;
  }[];
  allowAnimations?: boolean;
}

export const TrafficAreaChart: React.FC<TrafficAreaChartProps> = ({
  data,
  allowAnimations = true,
}) => {
  // Format dates for display
  const formattedData = data.map((d) => ({
    ...d,
    displayDate: d.date.split('-').slice(1).join('/'),
  }));

  return (
    <div className="analytics-chart-container" style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={formattedData}
          margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorPageViews" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="colorUnique" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
          <XAxis
            dataKey="displayDate"
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#12112a',
              borderColor: 'rgba(139, 92, 246, 0.3)',
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              color: '#f8fafc',
            }}
            formatter={(value: any, name: any) => [
              value.toLocaleString('en-IN'),
              name === 'pageViews' ? 'Page Views' : 'Unique Visitors',
            ]}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            formatter={(value) => (
              <span style={{ color: '#cbd5e1', fontSize: 13, marginRight: 16 }}>
                {value === 'pageViews' ? 'Total Page Views' : 'Unique Visitors'}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="pageViews"
            stroke="#8b5cf6"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorPageViews)"
            isAnimationActive={allowAnimations}
            animationDuration={800}
          />
          <Area
            type="monotone"
            dataKey="uniqueVisitors"
            stroke="#06b6d4"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorUnique)"
            isAnimationActive={allowAnimations}
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

