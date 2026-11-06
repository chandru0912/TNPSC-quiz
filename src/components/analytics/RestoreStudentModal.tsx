import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  RotateCcw,
  Search,
  UserCheck,
  AlertCircle,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { apiFetch } from '../../utils/api';
import './RestoreStudentModal.css';

interface RestoreStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const RestoreStudentModal: React.FC<RestoreStudentModalProps> = ({
  isOpen,
  onClose,
  token,
  onRestored,
}) => {
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
    if (isOpen) {
      fetchRestoreList();
    }
  }, [isOpen, fetchRestoreList]);

  if (!isOpen) return null;

  const handleRestore = async (studentId: number, studentName: string) => {
    setRestoringId(studentId);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await apiFetch(`/api/student/admin/restore/${studentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        throw new Error(json.message || 'Failed to restore student account.');
      }

      setSuccessMsg(`Student account for ${studentName} successfully restored!`);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      if (onRestored) onRestored();
    } catch (err: any) {
      setError(err.message || 'Could not restore student account.');
    } finally {
      setRestoringId(null);
    }
  };

  const filtered = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.district.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="restore-modal-backdrop" onClick={onClose}>
      <div className="restore-modal-panel glass" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="restore-modal-header">
          <div className="modal-title-cluster">
            <div className="modal-icon-badge restore">
              <RotateCcw size={18} />
            </div>
            <div>
              <h3 className="modal-title">Restore Student Accounts</h3>
              <p className="modal-subtitle">Reactivate archived or deactivated learners</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="restore-modal-body">
          {/* Messages */}
          {error && (
            <div className="restore-banner error">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="restore-banner success">
              <CheckCircle size={15} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Search bar */}
          <div className="restore-search-wrap">
            <Search size={15} className="restore-search-icon" />
            <input
              type="text"
              placeholder="Search by student name, email, or district..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="restore-search-input"
            />
          </div>

          {/* List Table */}
          {isLoading ? (
            <div className="restore-loading">
              <div className="loading-spinner-ring" />
              <span>Querying restorable accounts...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="restore-empty-state">
              <UserCheck size={36} className="empty-icon" />
              <h5 className="empty-title">No Deactivated Accounts</h5>
              <p className="empty-desc">
                All registered TNPSC learners are currently active and in good standing.
              </p>
            </div>
          ) : (
            <div className="restore-table-scroll">
              <table className="restore-table">
                <thead>
                  <tr>
                    <th>Learner</th>
                    <th>Group & Tier</th>
                    <th>District</th>
                    <th>Deactivated</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((st) => (
                    <tr key={st.id}>
                      <td>
                        <div className="st-info-cluster">
                          <span className="st-name">{st.fullName}</span>
                          <span className="st-email">{st.email}</span>
                        </div>
                      </td>
                      <td>
                        <div className="st-badges-cluster">
                          <span className="st-group-badge">{st.targetGroup.toUpperCase()}</span>
                          <span className="st-tier-badge">{st.tier}</span>
                        </div>
                      </td>
                      <td>
                        <span className="st-district">{st.district}</span>
                      </td>
                      <td>
                        <div className="st-time">
                          <Clock size={12} />
                          <span>
                            {st.deletedAt
                              ? new Date(st.deletedAt).toLocaleDateString('en-IN')
                              : 'Archived'}
                          </span>
                        </div>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="restore-row-btn"
                          disabled={restoringId === st.id}
                          onClick={() => handleRestore(st.id, st.fullName)}
                        >
                          <RotateCcw size={13} className={restoringId === st.id ? 'spin' : ''} />
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

        {/* Footer */}
        <div className="restore-modal-footer">
          <span className="restore-count-label">
            Found {filtered.length} deactivated candidate{filtered.length === 1 ? '' : 's'}
          </span>
          <button type="button" className="restore-close-action-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
