import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface DeviceBrowserPieChartProps {
  devices: { name: string; count: number }[];
  allowAnimations?: boolean;
}

const COLORS = ['#38bdf8', '#8b5cf6', '#f59e0b', '#10b981'];

export const DeviceBrowserPieChart: React.FC<DeviceBrowserPieChartProps> = ({
  devices,
  allowAnimations = true,
}) => {
  const chartData = devices.map((d) => ({
    name: d.name.charAt(0).toUpperCase() + d.name.slice(1),
    value: d.count,
  }));

  const total = chartData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="analytics-chart-container" style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{
              backgroundColor: '#12112a',
              borderColor: 'rgba(56, 189, 248, 0.4)',
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              color: '#f8fafc',
            }}
            formatter={(value: any) => [
              `${value} (${total > 0 ? Math.round((Number(value) / total) * 100) : 0}%)`,
              'Visitors',
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={30}
            formatter={(val) => <span style={{ color: '#cbd5e1', fontSize: 12 }}>{val}</span>}
          />
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            outerRadius={75}
            dataKey="value"
            isAnimationActive={allowAnimations}
            animationDuration={800}
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

