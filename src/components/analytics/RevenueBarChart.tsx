import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface RevenueBarChartProps {
  data: {
    month: string;
    revenue: number;
    subscribers: number;
  }[];
  allowAnimations?: boolean;
}

export const RevenueBarChart: React.FC<RevenueBarChartProps> = ({
  data,
  allowAnimations = true,
}) => {
  return (
    <div className="analytics-chart-container" style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="revenueBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
          <XAxis
            dataKey="month"
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
            tickFormatter={(val) => `₹${val}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#12112a',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              color: '#f8fafc',
            }}
            formatter={(val: any, name: any) => [
              name === 'revenue' ? `₹${Number(val).toLocaleString('en-IN')}` : val,
              name === 'revenue' ? 'Verified Revenue' : 'New Subscribers',
            ]}
          />
          <Bar
            dataKey="revenue"
            fill="url(#revenueBarGrad)"
            radius={[6, 6, 0, 0]}
            isAnimationActive={allowAnimations}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

