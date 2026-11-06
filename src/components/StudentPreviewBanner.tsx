import React from 'react'
import { Eye, ShieldAlert, LogOut, ArrowLeft } from 'lucide-react'
import { useStudentAuth } from '../context/StudentAuthContext'

export const StudentPreviewBanner: React.FC = () => {
  const { isPreviewMode, student, exitStudentPreview } = useStudentAuth()

  if (!isPreviewMode || !student) {
    return null
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10000,
        width: '100%',
        background: 'linear-gradient(90deg, #451a03 0%, #31135e 50%, #0f172a 100%)',
        borderBottom: '1px solid rgba(245, 158, 11, 0.45)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), 0 0 15px rgba(245, 158, 11, 0.2)',
        color: '#f8fafc',
        padding: '0.55rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}
    >
      {/* Left: Preview Identity & Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: 'rgba(245, 158, 11, 0.25)',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            color: '#fef08a',
            padding: '0.25rem 0.65rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          <Eye size={13} style={{ color: '#ffd700' }} />
          <span>Student Preview Mode</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.86rem' }}>
          <span>
            Viewing as:{' '}
            <strong style={{ color: '#ffffff', fontWeight: 700 }}>{student.fullName}</strong>
          </span>
          <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>•</span>
          <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>{student.email}</span>
          <span
            style={{
              fontSize: '0.72rem',
              background: 'rgba(99, 102, 241, 0.25)',
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            {student.targetGroup || 'Group 4'}
          </span>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.76rem',
            color: '#fdba74',
            background: 'rgba(251, 146, 60, 0.12)',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            border: '1px solid rgba(251, 146, 60, 0.25)',
          }}
        >
          <ShieldAlert size={12} />
          <span>Read-Only Simulation • Real student records protected</span>
        </div>
      </div>

      {/* Right: Exit Preview Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={exitStudentPreview}
          title="Exit Student Preview and return to Admin Dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: 'linear-gradient(135deg, #f59e0b 0%, #ffd700 100%)',
            color: '#0f172a',
            border: 'none',
            borderRadius: '8px',
            padding: '0.4rem 0.95rem',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowLeft size={14} />
          <span>Exit Student Preview</span>
          <LogOut size={13} style={{ marginLeft: '2px' }} />
        </button>
      </div>
    </div>
  )
}
export default StudentPreviewBanner

