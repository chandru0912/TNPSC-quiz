import React, { useState, useMemo } from 'react';
import { GroupDistributionDonut } from './GroupDistributionDonut';
import {
  Search,
  MapPin,
  Award,
  X,
  Landmark,
  Trophy,
  GraduationCap,
} from 'lucide-react';
import './StudentPerformanceAnalytics.css';

export interface StudentAwardRecord {
  id: number;
  type: 'GOLD' | 'PLATINUM' | 'SILVER';
  title: string;
  description: string;
  percentage: number;
  earnedAt: string;
}

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
  awards?: StudentAwardRecord[];
  awardSummary?: {
    goldCount: number;
    platinumCount: number;
    silverCount: number;
    totalAwards: number;
  };
}

interface StudentAnalyticsTabProps {
  studentsData: {
    groupBreakdown: { group: string; count: number }[];
    students: StudentItem[];
  };
  allowAnimations?: boolean;
}

function formatExamLabel(raw: string): string {
  const k = String(raw || '').toLowerCase().trim();
  if (k === 'group1' || k === 'group 1') return 'TNPSC Group 1';
  if (k === 'group2a' || k === 'group 2a') return 'TNPSC Group 2A';
  if (k === 'group2_2a' || k === 'group2' || k === 'group 2') return 'TNPSC Group 2 & 2A';
  if (k === 'group4' || k === 'group4_vao' || k === 'group 4' || k === 'vao') return 'TNPSC Group 4';
  return raw.toUpperCase();
}

function awardEmoji(type: StudentAwardRecord['type']): string {
  if (type === 'GOLD') return '🥇';
  if (type === 'PLATINUM') return '🏆';
  return '🥈';
}

function awardShortLabel(type: StudentAwardRecord['type']): string {
  if (type === 'GOLD') return 'Gold';
  if (type === 'PLATINUM') return 'Platinum';
  return 'Silver';
}

export const StudentAnalyticsTab: React.FC<StudentAnalyticsTabProps> = ({
  studentsData,
  allowAnimations = true,
}) => {
  const { groupBreakdown, students } = studentsData;
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [awardsModalStudent, setAwardsModalStudent] = useState<StudentItem | null>(null);

  const safeStudents = Array.isArray(students) ? students : [];
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return safeStudents;
    const q = search.toLowerCase();
    return safeStudents.filter(
      (s) =>
        (s.fullName || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.district || '').toLowerCase().includes(q) ||
        (s.targetGroup || '').toLowerCase().includes(q)
    );
  }, [safeStudents, search]);

  const totalStudents = safeStudents.length;
  const paidCount = safeStudents.filter((s) => s.tier === 'pro' || s.tier === 'paid').length;
  const avgAccuracy =
    safeStudents.length > 0
      ? (safeStudents.reduce((acc, curr) => acc + (Number(curr.accuracy) || 0), 0) / safeStudents.length).toFixed(1)
      : '0';

  // Build consistent Enrollment per Target Examination cards strictly from real DB groupBreakdown
  const examCards = useMemo(() => {
    const counts = new Map<string, number>();
    let hasSeparateGroup2A = false;
    for (const row of groupBreakdown || []) {
      const key = String(row.group || '').toLowerCase().trim();
      const val = Number(row.count || 0);
      if (key === 'group1' || key === 'group 1') {
        counts.set('group1', (counts.get('group1') || 0) + val);
      } else if (key === 'group2a' || key === 'group 2a') {
        hasSeparateGroup2A = true;
        counts.set('group2a', (counts.get('group2a') || 0) + val);
      } else if (key === 'group2' || key === 'group 2' || key === 'group2_2a') {
        counts.set('group2', (counts.get('group2') || 0) + val);
      } else if (key === 'group4' || key === 'group4_vao' || key === 'group 4' || key === 'vao') {
        counts.set('group4', (counts.get('group4') || 0) + val);
      }
    }

    const totalEnrolled = Array.from(counts.values()).reduce((sum, c) => sum + c, 0);
    const items: Array<{
      id: string;
      name: string;
      count: number;
      pct: number;
      tone: 'gold' | 'purple' | 'cyan' | 'green';
      Icon: React.ComponentType<{ size?: number }>;
    }> = [
      {
        id: 'group1',
        name: 'TNPSC Group 1',
        count: counts.get('group1') || 0,
        pct: totalEnrolled > 0 ? Math.round(((counts.get('group1') || 0) / totalEnrolled) * 1000) / 10 : 0,
        tone: 'gold',
        Icon: Landmark,
      },
      {
        id: 'group2',
        name: hasSeparateGroup2A ? 'TNPSC Group 2' : 'TNPSC Group 2 & 2A',
        count: counts.get('group2') || 0,
        pct: totalEnrolled > 0 ? Math.round(((counts.get('group2') || 0) / totalEnrolled) * 1000) / 10 : 0,
        tone: 'purple',
        Icon: Trophy,
      },
    ];

    if (hasSeparateGroup2A) {
      items.push({
        id: 'group2a',
        name: 'TNPSC Group 2A',
        count: counts.get('group2a') || 0,
        pct: totalEnrolled > 0 ? Math.round(((counts.get('group2a') || 0) / totalEnrolled) * 1000) / 10 : 0,
        tone: 'cyan',
        Icon: GraduationCap,
      });
    }

    items.push({
      id: 'group4',
      name: 'TNPSC Group 4',
      count: counts.get('group4') || 0,
      pct: totalEnrolled > 0 ? Math.round(((counts.get('group4') || 0) / totalEnrolled) * 1000) / 10 : 0,
      tone: 'green',
      Icon: Award,
    });

    return items;
  }, [groupBreakdown]);

  return (
    <div className="students-tab-container">
      {/* 3 Overview Strip Cards */}
      <div className="sub-kpi-row">
        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Total Enrolled Students</span>
            <div className="sub-badge purple">Learners</div>
          </div>
          <div className="sub-val sp-tabular">{totalStudents.toLocaleString('en-IN')}</div>
          <p className="sub-caption">Registered candidate profiles</p>
        </div>

        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Paid Pro Members</span>
            <div className="sub-badge gold">Pro Tier</div>
          </div>
          <div className="sub-val text-gold sp-tabular">{paidCount.toLocaleString('en-IN')}</div>
          <p className="sub-caption">Active subscription holders</p>
        </div>

        <div className="sub-kpi-card glass">
          <div className="sub-card-top">
            <span className="sub-lbl">Average Student Accuracy</span>
            <div className="sub-badge green">Performance</div>
          </div>
          <div className="sub-val text-green sp-tabular">{avgAccuracy}%</div>
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

        {/* Redesigned Enrollment per Target Examination Cards */}
        <div className="chart-panel-card glass">
          <div className="panel-card-header">
            <div>
              <h3 className="panel-card-title">Enrollment per Target Examination</h3>
              <p className="panel-card-subtitle">Live student distribution across TNPSC exam categories</p>
            </div>
          </div>
          <div className="sp-exam-cards-grid">
            {examCards.map((card) => {
              const Icon = card.Icon;
              return (
                <div key={card.id} className="sp-exam-card">
                  <div className="sp-exam-card-top">
                    <span className={`sp-exam-card-icon is-${card.tone}`}>
                      <Icon size={17} />
                    </span>
                    <h4 className="sp-exam-card-title" title={card.name}>
                      {card.name}
                    </h4>
                  </div>
                  <div className="sp-exam-card-metrics">
                    <span className="sp-exam-card-count">{card.count.toLocaleString('en-IN')}</span>
                    <span className="sp-exam-card-share">{card.pct.toFixed(1)}% of total</span>
                  </div>
                  <div className="sp-exam-card-bar" aria-hidden="true">
                    <div
                      className="sp-exam-card-bar-fill"
                      style={{ width: `${Math.min(100, Math.max(card.count > 0 ? 4 : 0, card.pct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Student Performance Roster Table (9 Strictly Aligned Columns + Real Awards) */}
      <div className="chart-panel-card glass">
        <div className="panel-card-header">
          <div>
            <h3 className="panel-card-title">Student Performance Roster</h3>
            <p className="panel-card-subtitle">
              Inspect candidate progress, accuracy metrics, study hours, and earned achievement awards
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

        <div className="sp-table-scroll">
          <table className="sp-aligned-table">
            <colgroup>
              <col style={{ width: '24%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '7%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="sp-col-left">Candidate Profile</th>
                <th className="sp-col-center">Target Exam</th>
                <th className="sp-col-center">District / Location</th>
                <th className="sp-col-center">Subscription Tier</th>
                <th className="sp-col-center">MCQs Solved</th>
                <th className="sp-col-center">Accuracy</th>
                <th className="sp-col-center">Study Hours</th>
                <th className="sp-col-center">Awards</th>
                <th className="sp-col-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-stream-cell">
                    No students match the search filter.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const studentAwards = Array.isArray(s.awards) ? s.awards : [];
                  const visibleAwards = studentAwards.slice(0, 2);
                  const extraAwardCount = Math.max(0, studentAwards.length - visibleAwards.length);

                  return (
                    <tr key={s.id}>
                      <td className="sp-col-left">
                        <div className="sp-candidate-cell">
                          <div className="student-avatar-circle">
                            {(s.fullName || 'S').charAt(0).toUpperCase()}
                          </div>
                          <div className="sp-candidate-info">
                            <strong className="sp-candidate-name" title={s.fullName}>
                              {s.fullName}
                            </strong>
                            <span className="sp-candidate-email" title={s.email}>
                              {s.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="sp-col-center">
                        <span className="exam-target-tag">{s.targetGroup.toUpperCase()}</span>
                      </td>

                      <td className="sp-col-center">
                        <div className="sp-loc-center" title={s.district}>
                          <MapPin size={12} style={{ flexShrink: 0 }} />
                          <span>{s.district}</span>
                        </div>
                      </td>

                      <td className="sp-col-center">
                        <span className={`tier-badge-pill ${s.tier}`}>
                          {s.tier === 'pro' ? <Award size={11} /> : null}
                          <span>{s.tier.toUpperCase()}</span>
                        </span>
                      </td>

                      <td className="sp-col-center sp-tabular">
                        <strong>{Number(s.mcqCount || 0).toLocaleString('en-IN')}</strong>
                      </td>

                      <td className="sp-col-center sp-tabular">
                        <span
                          className={`accuracy-pill ${
                            s.accuracy >= 60 ? 'high' : s.accuracy >= 40 ? 'med' : 'low'
                          }`}
                        >
                          {Number(s.accuracy || 0).toFixed(1)}%
                        </span>
                      </td>

                      <td className="sp-col-center sp-tabular">
                        {Number(s.studyHours || 0).toFixed(1)}h
                      </td>

                      <td className="sp-col-center">
                        {studentAwards.length === 0 ? (
                          <span className="sp-no-awards">No Awards</span>
                        ) : (
                          <div className="sp-awards-cell">
                            {visibleAwards.map((aw) => (
                              <button
                                key={aw.id}
                                type="button"
                                className={`sp-award-chip sp-award-chip--${aw.type.toLowerCase()}`}
                                onClick={() => setAwardsModalStudent(s)}
                                title={`${aw.title}: ${aw.description}`}
                              >
                                <span aria-hidden="true">{awardEmoji(aw.type)}</span>
                                <span>{awardShortLabel(aw.type)}</span>
                              </button>
                            ))}
                            {extraAwardCount > 0 && (
                              <button
                                type="button"
                                className="sp-award-more-btn"
                                onClick={() => setAwardsModalStudent(s)}
                                title={`View all ${studentAwards.length} earned awards`}
                              >
                                +{extraAwardCount}
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="sp-col-center">
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Earned Awards Detail Popup */}
      {awardsModalStudent && (
        <div className="admin-modal-backdrop" onClick={() => setAwardsModalStudent(null)}>
          <div className="student-profile-modal glass" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="student-modal-user-info">
                <div className="modal-avatar-circle">
                  {(awardsModalStudent.fullName || 'S').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="modal-student-name">{awardsModalStudent.fullName} — Earned Awards</h3>
                  <p className="modal-student-sub">
                    {awardsModalStudent.awards?.length || 0} verified achievement
                    {(awardsModalStudent.awards?.length || 0) === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setAwardsModalStudent(null)}
                aria-label="Close awards modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="sp-awards-modal-list">
              {(awardsModalStudent.awards || []).map((aw) => (
                <div key={aw.id} className="sp-awards-modal-row">
                  <div className="sp-awards-modal-left">
                    <span className="sp-awards-modal-emoji" aria-hidden="true">
                      {awardEmoji(aw.type)}
                    </span>
                    <div>
                      <div className="sp-awards-modal-title">{aw.title}</div>
                      <div className="sp-awards-modal-desc">{aw.description}</div>
                    </div>
                  </div>
                  <span className="sp-awards-modal-date">
                    {new Date(aw.earnedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-done-btn"
                onClick={() => setAwardsModalStudent(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                <span className="val">{formatExamLabel(selectedStudent.targetGroup)}</span>
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
                <span className="val sp-tabular">{selectedStudent.mcqCount.toLocaleString('en-IN')}</span>
              </div>
              <div className="modal-stat-box">
                <span className="lbl">Average Accuracy</span>
                <span className="val green sp-tabular">{Number(selectedStudent.accuracy || 0).toFixed(1)}%</span>
              </div>
              <div className="modal-stat-box">
                <span className="lbl">Study Time</span>
                <span className="val sp-tabular">{Number(selectedStudent.studyHours || 0).toFixed(1)} Hours</span>
              </div>
              <div className="modal-stat-box">
                <span className="lbl">Earned Awards</span>
                <span className="val sp-tabular">
                  {selectedStudent.awardSummary?.totalAwards
                    ? `${selectedStudent.awardSummary.totalAwards} Total (🥇${selectedStudent.awardSummary.goldCount} 🏆${selectedStudent.awardSummary.platinumCount} 🥈${selectedStudent.awardSummary.silverCount})`
                    : 'No Awards'}
                </span>
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
