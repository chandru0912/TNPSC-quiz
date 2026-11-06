import React, { useState, useMemo } from 'react';
import { GroupDistributionDonut } from './GroupDistributionDonut';
import {
  Search,
  MapPin,
  Award,
  X,
  BookOpen,
} from 'lucide-react';

interface StudentItem {
  id: number;
  fullName: string;
  email: string;
  targetGroup: string;
  district: string;
  city: string;
  tier: string;
  mcqCount: number;
  accuracy: number;
  studyHours: number;
  createdAt: string;
  lastLoginAt: string;
}

interface StudentAnalyticsTabProps {
  studentsData: {
    groupBreakdown: { group: string; count: number }[];
    students: StudentItem[];
  };
  allowAnimations?: boolean;
}

export const StudentAnalyticsTab: React.FC<StudentAnalyticsTabProps> = ({
  studentsData,
  allowAnimations = true,
}) => {
  const { groupBreakdown, students } = studentsData;
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.district.toLowerCase().includes(q) ||
        s.targetGroup.toLowerCase().includes(q)
    );
  }, [students, search]);

  const totalStudents = students.length;
  const paidCount = students.filter((s) => s.tier === 'pro' || s.tier === 'paid').length;
  const avgAccuracy =
    students.length > 0
      ? (students.reduce((acc, curr) => acc + curr.accuracy, 0) / students.length).toFixed(1)
      : '0';

  return (
    <div className="students-tab-container">
      {/* 3 Overview Strip Cards */}
      <div className="sub-kpi-row">
        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Total Enrolled Students</span>
            <div className="sub-badge purple">Learners</div>
          </div>
          <div className="sub-val">{totalStudents}</div>
          <p className="sub-caption">Registered candidate profiles</p>
        </div>

        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Paid Pro Members</span>
            <div className="sub-badge gold">Pro Tier</div>
          </div>
          <div className="sub-val text-gold">{paidCount}</div>
          <p className="sub-caption">Active subscription holders</p>
        </div>

        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Average Student Accuracy</span>
            <div className="sub-badge green">Performance</div>
          </div>
          <div className="sub-val text-green">{avgAccuracy}%</div>
          <p className="sub-caption">Across all MCQ practice sessions</p>
        </div>
      </div>

      <div className="traffic-grid-cols" style={{ marginBottom: '1.5rem' }}>
        {/* Target Group Donut */}
        <div className="chart-panel-card glass">
          <div className="panel-card-header">
            <div>
              <h3 className="panel-card-title">TNPSC Target Group Breakdown</h3>
              <p className="panel-card-subtitle">Candidate allocation across competitive exam streams</p>
            </div>
          </div>
          <GroupDistributionDonut data={groupBreakdown} allowAnimations={allowAnimations} />
        </div>

        {/* Group Counts Table */}
        <div className="chart-panel-card glass">
          <div className="panel-card-header">
            <div>
              <h3 className="panel-card-title">Enrollment per Target Examination</h3>
              <p className="panel-card-subtitle">Group exam candidate density</p>
            </div>
          </div>
          <div className="group-exam-list">
            {groupBreakdown.map((g) => (
              <div key={g.group} className="group-exam-row glass">
                <div className="group-name-wrap">
                  <div className="group-badge-icon">
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <strong className="group-title">{g.group}</strong>
                    <span className="group-desc">TNPSC Syllabus & Mock Series</span>
                  </div>
                </div>
                <div className="group-count-box">
                  <span className="group-count-num">{g.count}</span>
                  <span className="group-count-lbl">Enrolled</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Student Roster Table */}
      <div className="chart-panel-card glass">
        <div className="panel-card-header">
          <div>
            <h3 className="panel-card-title">Student Performance Roster</h3>
            <p className="panel-card-subtitle">
              Inspect candidate progress, accuracy metrics, and study hours
            </p>
          </div>

          <div className="student-search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search by name, email, district..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="student-search-input"
            />
          </div>
        </div>

        <div className="student-table-wrap">
          <table className="analytics-data-table">
            <thead>
              <tr>
                <th>Candidate Profile</th>
                <th>Target Exam</th>
                <th>District / Location</th>
                <th>Tier</th>
                <th className="num-col">MCQs Solved</th>
                <th className="num-col">Accuracy</th>
                <th className="num-col">Study Hours</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-stream-cell">
                    No students match the search filter.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="student-avatar-name">
                        <div className="student-avatar-circle">
                          {s.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong className="student-name-text">{s.fullName}</strong>
                          <div className="student-email-text">{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="exam-target-tag">{s.targetGroup.toUpperCase()}</span>
                    </td>
                    <td>
                      <div className="student-loc">
                        <MapPin size={12} />
                        <span>{s.district}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`tier-badge-pill ${s.tier}`}>
                        {s.tier === 'pro' ? <Award size={11} /> : null}
                        <span>{s.tier.toUpperCase()}</span>
                      </span>
                    </td>
                    <td className="num-col">
                      <strong>{s.mcqCount}</strong>
                    </td>
                    <td className="num-col">
                      <span className={`accuracy-pill ${s.accuracy >= 60 ? 'high' : s.accuracy >= 40 ? 'med' : 'low'}`}>
                        {s.accuracy}%
                      </span>
                    </td>
                    <td className="num-col">{s.studyHours}h</td>
                    <td>
                      <button
                        type="button"
                        className="student-inspect-btn"
                        onClick={() => setSelectedStudent(s)}
                        title="View Complete Student Profile"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Deep Inspection Modal */}
      {selectedStudent && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedStudent(null)}>
          <div className="student-profile-modal glass" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="student-modal-user-info">
                <div className="modal-avatar-circle">
                  {selectedStudent.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="modal-student-name">{selectedStudent.fullName}</h3>
                  <p className="modal-student-sub">{selectedStudent.email}</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedStudent(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-grid-stats">
              <div className="modal-stat-box">
                <span className="lbl">Target Exam</span>
                <span className="val">{selectedStudent.targetGroup.toUpperCase()}</span>
              </div>
              <div className="modal-stat-box">
                <span className="lbl">District</span>
                <span className="val">{selectedStudent.district}</span>
              </div>
              <div className="modal-stat-box">
                <span className="lbl">Subscription</span>
                <span className="val tier">{selectedStudent.tier.toUpperCase()}</span>
              </div>
              <div className="modal-stat-box">
                <span className="lbl">MCQ Attempts</span>
                <span className="val">{selectedStudent.mcqCount}</span>
              </div>
              <div className="modal-stat-box">
                <span className="lbl">Average Accuracy</span>
                <span className="val green">{selectedStudent.accuracy}%</span>
              </div>
              <div className="modal-stat-box">
                <span className="lbl">Study Time</span>
                <span className="val">{selectedStudent.studyHours} Hours</span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-done-btn"
                onClick={() => setSelectedStudent(null)}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
