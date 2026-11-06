import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface GroupDistributionDonutProps {
  data: {
    group: string;
    count: number;
  }[];
  allowAnimations?: boolean;
}

const COLORS = ['#8b5cf6', '#38bdf8', '#f59e0b', '#10b981', '#ec4899'];

export const GroupDistributionDonut: React.FC<GroupDistributionDonutProps> = ({
  data,
  allowAnimations = true,
}) => {
  const chartData = data.map((d) => ({
    name: d.group.replace('GROUP', 'Group '),
    value: d.count,
  }));

  const total = chartData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="analytics-chart-container" style={{ width: '100%', height: 300, position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{
              backgroundColor: '#12112a',
              borderColor: 'rgba(139, 92, 246, 0.4)',
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              color: '#f8fafc',
            }}
            formatter={(value: any) => [
              `${value} (${total > 0 ? Math.round((Number(value) / total) * 100) : 0}%)`,
              'Students',
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(val) => <span style={{ color: '#cbd5e1', fontSize: 13, marginRight: 12 }}>{val}</span>}
          />
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            innerRadius={65}
            outerRadius={95}
            paddingAngle={4}
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

      {/* Center Label for Donut */}
      <div
        style={{
          position: 'absolute',
          top: '45%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Total
        </span>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>
          {total}
        </div>
      </div>
    </div>
  );
};

