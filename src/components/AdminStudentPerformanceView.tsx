import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudentAuth } from '../context/StudentAuthContext'
import {
  Users,
  Clock,
  Target,
  Flame,
  Search,
  RotateCcw,
  X,
  Eye,
} from 'lucide-react'
import { apiFetch } from '../utils/api'

interface StudentRecord {
  id: number
  fullName: string
  email: string
  mobile?: string | null
  targetGroup: string
  createdAt: string
  studyHours: number
  studyHoursFormatted: string
  questionsAttempted: number
  questionsCorrect: number
  accuracy: number
  preparationProgress: number
  mockTestsCount: number
  materialsCompleted: number
  lastActive: string
}

interface AdminStudentsData {
  summary: {
    totalStudents: number
    activeStudents: number
    totalStudyHours: number
    overallAvgAccuracy: number
  }
  students: StudentRecord[]
}

interface AdminStudentPerformanceViewProps {
  token: string | null
}

export const AdminStudentPerformanceView: React.FC<AdminStudentPerformanceViewProps> = ({ token }) => {
  const navigate = useNavigate()
  const { startStudentPreview } = useStudentAuth()
  const [launchingPreviewId, setLaunchingPreviewId] = useState<number | null>(null)

  const handlePreviewStudent = async (studentId: number) => {
    if (!token) return
    setLaunchingPreviewId(studentId)
    try {
      const res = await apiFetch(`/api/student/admin/preview-token/${studentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (res.ok && json.status === 'success' && json.previewToken && json.student) {
        startStudentPreview(json.previewToken, json.student)
        navigate('/dashboard')
      } else {
        alert(json.message || 'Failed to start student preview mode.')
      }
    } catch (err: any) {
      alert(err.message || 'Error connecting to student preview endpoint.')
    } finally {
      setLaunchingPreviewId(null)
    }
  }
  const [data, setData] = useState<AdminStudentsData>({
    summary: {
      totalStudents: 0,
      activeStudents: 0,
      totalStudyHours: 0,
      overallAvgAccuracy: 0,
    },
    students: [],
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null)

  const fetchStudents = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    try {
      const res = await apiFetch('/api/student/admin/list', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (res.ok && json.status === 'success' && json.data) {
        setData(json.data)
      }
    } catch (err: any) {
      console.warn('[Admin] Failed to fetch students list:', err.message)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  const filteredStudents = useMemo(() => {
    return data.students.filter((s) => {
      const matchSearch =
        searchTerm === '' ||
        s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.mobile && s.mobile.includes(searchTerm))

      const matchGroup =
        groupFilter === 'all' || s.targetGroup.toLowerCase() === groupFilter.toLowerCase()

      return matchSearch && matchGroup
    })
  }, [data.students, searchTerm, groupFilter])

  const getAccuracyColor = (acc: number) => {
    if (acc >= 75) return '#4ade80' // Green
    if (acc >= 50) return '#facc15' // Yellow
    if (acc > 0) return '#f87171' // Red
    return 'rgba(255, 255, 255, 0.4)'
  }

  const getGroupBadge = (group: string) => {
    const g = group.toLowerCase()
    if (g.includes('1')) {
      return { label: 'Group 1', bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' }
    }
    if (g.includes('2')) {
      return { label: 'Group 2 & 2A', bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' }
    }
    return { label: 'Group 4 & VAO', bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* 1. Aggregate Metrics Grid */}
      <div className="admin-metrics-grid" style={{ marginBottom: 0 }}>
        <div className="admin-metric-card glass">
          <div className="admin-metric-icon" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>
            <Users size={22} />
          </div>
          <div className="admin-metric-content">
            <span className="admin-metric-label">Registered Students</span>
            <span className="admin-metric-value">{data.summary.totalStudents}</span>
            <span className="admin-metric-sub">Total student accounts</span>
          </div>
        </div>

        <div className="admin-metric-card glass">
          <div className="admin-metric-icon" style={{ background: 'rgba(234, 88, 12, 0.2)', color: '#fb923c' }}>
            <Flame size={22} />
          </div>
          <div className="admin-metric-content">
            <span className="admin-metric-label">Active This Week</span>
            <span className="admin-metric-value">{data.summary.activeStudents}</span>
            <span className="admin-metric-sub">Active in past 7 days</span>
          </div>
        </div>

        <div className="admin-metric-card glass">
          <div className="admin-metric-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
            <Clock size={22} />
          </div>
          <div className="admin-metric-content">
            <span className="admin-metric-label">Total Study Hours</span>
            <span className="admin-metric-value">{data.summary.totalStudyHours} <span style={{ fontSize: '1rem' }}>hrs</span></span>
            <span className="admin-metric-sub">Active student learning time</span>
          </div>
        </div>

        <div className="admin-metric-card glass">
          <div className="admin-metric-icon" style={{ background: 'rgba(255, 215, 0, 0.2)', color: '#ffd700' }}>
            <Target size={22} />
          </div>
          <div className="admin-metric-content">
            <span className="admin-metric-label">Average Accuracy</span>
            <span className="admin-metric-value">{data.summary.overallAvgAccuracy}%</span>
            <span className="admin-metric-sub">Across all question attempts</span>
          </div>
        </div>
      </div>

      {/* 2. Controls & Search Filter Bar */}
      <div
        className="glass"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255, 255, 255, 0.4)',
              }}
            />
            <input
              type="text"
              placeholder="Search by student name, email, or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.85rem 0.5rem 2.4rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(15, 23, 42, 0.6)',
                color: '#ffffff',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(15, 23, 42, 0.6)',
              color: '#ffffff',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <option value="all">All TNPSC Groups</option>
            <option value="group4">Group 4 & VAO</option>
            <option value="group2">Group 2 & 2A</option>
            <option value="group1">Group 1</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.6)' }}>
            Showing <strong>{filteredStudents.length}</strong> of {data.students.length} students
          </span>
          <button
            type="button"
            onClick={fetchStudents}
            title="Refresh student records"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#ffffff',
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} className={isLoading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 3. Students Performance Table */}
      <div className="admin-table-wrapper glass">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>Student Name & Contact</th>
              <th>Target Group</th>
              <th>Study Hours</th>
              <th>Questions Solved</th>
              <th>Accuracy</th>
              <th>Preparation Progress</th>
              <th>Mock Tests</th>
              <th>Last Active</th>
              <th style={{ textAlign: 'center' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && data.students.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '3rem' }}>
                  <RotateCcw size={22} className="spinning" style={{ color: '#ffd700', marginBottom: '0.5rem' }} />
                  <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>
                    Loading student performance metrics...
                  </div>
                </td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '3rem' }}>
                  <Users size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <h4 style={{ margin: 0, color: '#ffffff', fontSize: '0.95rem' }}>No Student Records Found</h4>
                  <p style={{ margin: '0.25rem 0 0', color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.82rem' }}>
                    {searchTerm ? 'No registered students match your current search criteria.' : 'No students have registered yet.'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, idx) => {
                const badge = getGroupBadge(student.targetGroup)
                const accColor = getAccuracyColor(student.accuracy)

                return (
                  <tr key={student.id}>
                    <td style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.82rem' }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #ffd700, #f59e0b)',
                            color: '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            flexShrink: 0,
                          }}
                        >
                          {student.fullName ? student.fullName.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.9rem' }}>
                            {student.fullName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                            {student.email} {student.mobile && `• ${student.mobile}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          background: badge.bg,
                          color: badge.text,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ffffff', fontWeight: 600, fontSize: '0.88rem' }}>
                        <Clock size={14} style={{ color: '#34d399' }} />
                        <span>{student.studyHoursFormatted}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: 600 }}>
                        {student.questionsCorrect}{' '}
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 400 }}>
                          / {student.questionsAttempted} attempted
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: accColor,
                          background: `${accColor}18`,
                          border: `1px solid ${accColor}35`,
                        }}
                      >
                        {student.accuracy}%
                      </span>
                    </td>
                    <td>
                      <div style={{ width: '130px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                          <span style={{ color: '#ffd700', fontWeight: 600 }}>{student.preparationProgress}%</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${student.preparationProgress}%`,
                              height: '100%',
                              borderRadius: '3px',
                              background: 'linear-gradient(90deg, #ffd700, #f59e0b)',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: 600 }}>
                        {student.mockTestsCount} tests
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.78rem', color: student.lastActive === 'Never' ? 'rgba(255,255,255,0.4)' : '#38bdf8' }}>
                        {student.lastActive}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedStudent(student)}
                          style={{
                            padding: '0.3rem 0.65rem',
                            borderRadius: '6px',
                            background: 'rgba(255, 215, 0, 0.12)',
                            border: '1px solid rgba(255, 215, 0, 0.3)',
                            color: '#ffd700',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePreviewStudent(student.id)}
                          disabled={launchingPreviewId === student.id}
                          title={`Preview Student Portal as ${student.fullName} (Read-Only)`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.22) 0%, rgba(99, 102, 241, 0.22) 100%)',
                            border: '1px solid rgba(99, 102, 241, 0.45)',
                            color: '#93c5fd',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: launchingPreviewId === student.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <Eye size={12} className={launchingPreviewId === student.id ? 'spinning' : ''} />
                          <span>Preview</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Student Details Modal */}
      {selectedStudent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="glass"
            style={{
              width: '100%',
              maxWidth: '560px',
              borderRadius: '16px',
              padding: '1.75rem',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ffd700, #f59e0b)',
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                  }}
                >
                  {selectedStudent.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.1rem', fontWeight: 700 }}>
                    {selectedStudent.fullName}
                  </h3>
                  <p style={{ margin: '0.15rem 0 0', color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.8rem' }}>
                    {selectedStudent.email} {selectedStudent.mobile && `• ${selectedStudent.mobile}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.6)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1rem',
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '12px',
                padding: '1.25rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <span style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' }}>
                  Target Group
                </span>
                <div style={{ fontWeight: 600, color: '#ffd700', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {getGroupBadge(selectedStudent.targetGroup).label}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' }}>
                  Registered Date
                </span>
                <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {new Date(selectedStudent.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' }}>
                  Total Study Hours
                </span>
                <div style={{ fontWeight: 600, color: '#34d399', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {selectedStudent.studyHoursFormatted}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' }}>
                  Overall Accuracy
                </span>
                <div style={{ fontWeight: 700, color: getAccuracyColor(selectedStudent.accuracy), fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {selectedStudent.accuracy}% ({selectedStudent.questionsCorrect}/{selectedStudent.questionsAttempted})
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' }}>
                  Materials Completed
                </span>
                <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {selectedStudent.materialsCompleted} chapters
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' }}>
                  Mock Tests Completed
                </span>
                <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {selectedStudent.mockTestsCount} tests
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => handlePreviewStudent(selectedStudent.id)}
                disabled={launchingPreviewId === selectedStudent.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 1.1rem',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: launchingPreviewId === selectedStudent.id ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 10px rgba(59, 130, 246, 0.3)',
                }}
              >
                <Eye size={15} className={launchingPreviewId === selectedStudent.id ? 'spinning' : ''} />
                <span>{launchingPreviewId === selectedStudent.id ? 'Launching Preview...' : 'Preview Student Portal (Read-Only)'}</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedStudent(null)}
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
