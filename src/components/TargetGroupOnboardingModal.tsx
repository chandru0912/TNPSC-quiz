import { useState } from 'react'
import { GraduationCap, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import { useStudentAuth } from '../context/StudentAuthContext'
import { apiFetch } from '../utils/api'
import '../pages/Auth.css'

const EXAM_GROUP_CARDS = [
  {
    id: 'group1',
    title: 'TNPSC Group 1',
    subtitle: 'Deputy Collector, DSP & Combined Civil Services I',
  },
  {
    id: 'group2',
    title: 'TNPSC Group 2',
    subtitle: 'Municipal Commissioner, Sub-Registrar & Interview Posts',
  },
  {
    id: 'group2a',
    title: 'TNPSC Group 2A',
    subtitle: 'Assistant, Accountant & Non-Interview Services',
  },
  {
    id: 'group4',
    title: 'TNPSC Group 4 & VAO',
    subtitle: 'Village Administrative Officer, Junior Assistant & Typist',
  },
]

export function TargetGroupOnboardingModal() {
  const { student, token, refreshProfile, login } = useStudentAuth()
  const [selectedGroup, setSelectedGroup] = useState<string>(student?.targetGroup || 'group4')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!student || !token || student.onboardingCompleted !== false || student.isPreview) {
    return null
  }

  const handleSave = async (chosenGroup: string) => {
    setError(null)
    setIsSaving(true)
    try {
      const res = await apiFetch('/api/student/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetGroup: chosenGroup,
          onboardingCompleted: true,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.status === 'success' && json.student) {
        login(token, json.student)
        await refreshProfile()
      } else {
        setError(json.message || 'Unable to save exam preference. Please try again.')
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to save preference. Please check your connection.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-card glass">
        <div className="onboarding-header">
          {student.avatarUrl ? (
            <img
              src={student.avatarUrl}
              alt={student.fullName}
              className="onboarding-avatar-img"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="auth-icon" style={{ marginBottom: 0 }}>
              <GraduationCap size={28} />
            </div>
          )}
          <div className="auth-brand-pill">Welcome, {student.fullName}</div>
          <h2 id="onboarding-title" className="onboarding-title">
            Select Your Target Exam Group
          </h2>
          <p className="auth-subtitle">
            Personalize your TNPSC Study Hub syllabus, study notes, and practice tests. You can change this anytime.
          </p>
        </div>

        {error && (
          <div className="auth-alert auth-alert-error" role="alert">
            <span>{error}</span>
          </div>
        )}

        <div className="onboarding-group-grid">
          {EXAM_GROUP_CARDS.map((item) => {
            const active = selectedGroup === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`onboarding-group-option ${active ? 'selected' : ''}`}
                onClick={() => setSelectedGroup(item.id)}
                disabled={isSaving}
              >
                <div className="onboarding-group-top">
                  <span className="onboarding-group-name">{item.title}</span>
                  {active && <CheckCircle2 size={18} className="onboarding-check-icon" />}
                </div>
                <span className="onboarding-group-desc">{item.subtitle}</span>
              </button>
            )
          })}
        </div>

        <div className="onboarding-actions">
          <button
            type="button"
            className="onboarding-skip-btn"
            onClick={() => handleSave(student.targetGroup || 'group4')}
            disabled={isSaving}
          >
            Skip for now
          </button>
          <button
            type="button"
            className="btn btn-primary auth-btn"
            style={{ marginTop: 0, width: 'auto', flex: 1 }}
            onClick={() => handleSave(selectedGroup)}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 size={17} className="spinning" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>Save &amp; Continue</span>
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TargetGroupOnboardingModal
