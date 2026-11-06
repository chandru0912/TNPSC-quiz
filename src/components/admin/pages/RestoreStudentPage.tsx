import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  Search,
  UserCheck,
  AlertCircle,
  Clock,
  CheckCircle,
  RefreshCw,
  MapPin,
} from 'lucide-react';
import { apiFetch } from '../../../utils/api';
import './RestoreStudentPage.css';

interface RestoreStudentPageProps {
  token: string | null;
  onRestored?: () => void;
}

interface InactiveStudent {
  id: number;
  fullName: string;
  email: string;
  mobile: string | null;
  targetGroup: string;
  district: string;
  city: string;
  tier: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
}

export const RestoreStudentPage: React.FC<RestoreStudentPageProps> = ({ token, onRestored }) => {
  const [students, setStudents] = useState<InactiveStudent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchRestoreList = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/student/admin/restore-list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setStudents(json.data.students || []);
      } else {
        throw new Error(json.message || 'Failed to fetch inactive students.');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading restorable students.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRestoreList();
  }, [fetchRestoreList]);

  const handleRestoreStudent = async (studentId: number, name: string) => {
    if (!token) return;
    setRestoringId(studentId);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await apiFetch(`/api/student/admin/restore/${studentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setSuccessMsg(`Successfully restored account for ${name}.`);
        setStudents((prev) => prev.filter((s) => s.id !== studentId));
        if (onRestored) onRestored();
      } else {
        throw new Error(json.message || 'Failed to restore student.');
      }
    } catch (err: any) {
      setError(err.message || 'Restore action failed.');
    } finally {
      setRestoringId(null);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.mobile && s.mobile.includes(searchTerm)) ||
      (s.district && s.district.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="admin-subpage-root">
      {/* Header */}
      <div className="subpage-header-row">
        <div className="subpage-titles">
          <h1 className="subpage-title">Restore Student Accounts</h1>
          <p className="subpage-subtitle">
            Search, review, and reinstate previously deactivated or archived TNPSC student accounts.
          </p>
        </div>
        <button
          type="button"
          className="admin-action-outline-btn"
          onClick={fetchRestoreList}
          disabled={isLoading}
        >
          <RefreshCw size={14} className={isLoading ? 'spinning' : ''} />
          <span>{isLoading ? 'Checking...' : 'Refresh List'}</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="enroll-success-box">
          <div className="success-header-line">
            <div className="success-title-wrap">
              <CheckCircle size={18} />
              <span>{successMsg}</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="subpage-error-alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Card */}
      <div className="restore-subpage-card">
        {/* Toolbar */}
        <div className="restore-toolbar">
          <div className="restore-search-wrap">
            <Search size={15} />
            <input
              type="text"
              className="restore-search-input"
              placeholder="Search by name, email, district, or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span className="restore-stats-badge">
            {filteredStudents.length} Inactive Student{filteredStudents.length === 1 ? '' : 's'} Found
          </span>
        </div>

        {/* Table or Empty State */}
        {isLoading && students.length === 0 ? (
          <div className="empty-restore-state">
            <Clock size={32} />
            <p>Scanning archived student records...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="empty-restore-state">
            <UserCheck size={36} style={{ color: '#34d399' }} />
            <p style={{ fontWeight: 600, color: '#e2e8f0' }}>No Inactive Students Pending Restoration</p>
            <p style={{ fontSize: '0.82rem' }}>All student accounts in the database are currently active.</p>
          </div>
        ) : (
          <div className="restore-table-responsive">
            <table className="restore-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Email</th>
                  <th>Target Group</th>
                  <th>District / City</th>
                  <th>Tier</th>
                  <th>Archived On</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st) => (
                  <tr key={st.id}>
                    <td style={{ fontWeight: 600 }}>{st.fullName}</td>
                    <td>{st.email}</td>
                    <td>
                      <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: '#fbbf24' }}>
                        {st.targetGroup}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <MapPin size={12} color="#94a3b8" />
                        {st.district} {st.city ? `(${st.city})` : ''}
                      </span>
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize', fontSize: '0.78rem' }}>
                        {st.tier.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                      {st.deletedAt ? new Date(st.deletedAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="restore-action-btn"
                        onClick={() => handleRestoreStudent(st.id, st.fullName)}
                        disabled={restoringId === st.id}
                      >
                        <RotateCcw size={12} />
                        <span>{restoringId === st.id ? 'Restoring...' : 'Restore'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

