import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface SubjectAccuracyChartProps {
  data: {
    subject: string;
    attempts: number;
    accuracy: number;
  }[];
  allowAnimations?: boolean;
}

export const SubjectAccuracyChart: React.FC<SubjectAccuracyChartProps> = ({
  data,
  allowAnimations = true,
}) => {
  // Take top 8 subjects
  const topSubjects = data.slice(0, 8);

  const getBarColor = (accuracy: number) => {
    if (accuracy >= 75) return '#10b981'; // Green
    if (accuracy >= 50) return '#38bdf8'; // Blue
    if (accuracy >= 35) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  return (
    <div className="analytics-chart-container" style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={topSubjects}
          margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            tickFormatter={(val) => `${val}%`}
            axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
          />
          <YAxis
            type="category"
            dataKey="subject"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            width={120}
            axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#12112a',
              borderColor: 'rgba(139, 92, 246, 0.4)',
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              color: '#f8fafc',
            }}
            formatter={(value: any, _name: any, item: any) => [
              `${value}% (${item.payload.attempts} attempts)`,
              'Accuracy Rate',
            ]}
          />
          <Bar
            dataKey="accuracy"
            radius={[0, 4, 4, 0]}
            isAnimationActive={allowAnimations}
            animationDuration={800}
          >
            {topSubjects.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.accuracy)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
