import React, { useState, useEffect, useCallback } from 'react';
import {
  Award,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../../../utils/api';
import { StudyPerformanceTab } from '../../analytics/StudyPerformanceTab';
import { StudentAnalyticsTab } from '../../analytics/StudentAnalyticsTab';

interface StudentPerformancePageProps {
  token: string | null;
}

export const StudentPerformancePage: React.FC<StudentPerformancePageProps> = ({ token }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [performanceData, setPerformanceData] = useState<{
    subjects: { subject: string; attempts: number; correct: number; accuracy: number }[];
    mockTests: { totalAttempts: number; averageScore: number; passedCount: number };
    performanceSummary: any;
  }>({
    subjects: [],
    mockTests: { totalAttempts: 0, averageScore: 0, passedCount: 0 },
    performanceSummary: null,
  });

  const [studentsData, setStudentsData] = useState<{
    groupBreakdown: { group: string; count: number }[];
    students: any[];
  }>({
    groupBreakdown: [],
    students: [],
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [perfRes, studRes] = await Promise.all([
        apiFetch('/api/analytics/performance', { headers: { Authorization: `Bearer ${token}` } }),
        apiFetch('/api/analytics/students', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (perfRes.ok) {
        const pJson = await perfRes.json();
        setPerformanceData({
          subjects: pJson.subjects || [],
          mockTests: pJson.mockTests || { totalAttempts: 0, averageScore: 0, passedCount: 0 },
          performanceSummary: pJson.performanceSummary || null,
        });
      }

      if (studRes.ok) {
        const sJson = await studRes.json();
        setStudentsData({
          groupBreakdown: sJson.groupBreakdown || [],
          students: sJson.students || [],
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load student performance data.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="admin-subpage-root">
      <div className="subpage-header-row">
        <div className="subpage-titles">
          <h1 className="subpage-title">Student Performance Intelligence</h1>
          <p className="subpage-subtitle">
            Comprehensive accuracy scores, mock test completion metrics, and individual student progress rosters.
          </p>
        </div>
        <button
          type="button"
          className="admin-action-outline-btn"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {error && (
        <div className="subpage-error-alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {/* Accuracy & Mock Tests */}
      <StudyPerformanceTab performanceData={performanceData} allowAnimations={true} />

      {/* Student Roster & Group Breakdown */}
      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Award size={18} style={{ color: '#fbbf24' }} />
          <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#f8fafc', fontWeight: 700 }}>
            Student Accuracy Roster & Inspection
          </h2>
        </div>
        <StudentAnalyticsTab studentsData={studentsData} allowAnimations={true} />
      </div>
    </div>
  );
};

