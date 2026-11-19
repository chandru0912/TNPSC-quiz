import { useEffect, useState } from 'react'
import { X, History, Calendar } from 'lucide-react'
import { apiFetch } from '../../utils/api'
import { AwardShieldLogo, type AchievementAwardTier } from './AchievementAwards'

export interface AttemptHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  groupId: string
  subjectId: string
  standardId: number
  unitId: number
  lessonId?: string
  lessonTitle: string
  mode: 'mcq_practice' | 'lesson_wise' | 'all'
}

interface LessonHistoryAttempt {
  attemptNumber: number
  percentage: number
  score: number
  maxScore: number
  awardType: 'GOLD' | 'PLATINUM' | 'SILVER' | 'NONE'
  completedAt: string
}

const getBestAward = (attempts: LessonHistoryAttempt[]): AchievementAwardTier | null => {
  if (attempts.some((a) => a.awardType === 'GOLD')) return 'GOLD'
  if (attempts.some((a) => a.awardType === 'PLATINUM')) return 'PLATINUM'
  if (attempts.some((a) => a.awardType === 'SILVER')) return 'SILVER'
  return null
}

export function AttemptHistoryModal({
  isOpen,
  onClose,
  groupId,
  subjectId,
  standardId,
  unitId,
  lessonId,
  lessonTitle,
  mode,
}: AttemptHistoryModalProps) {
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState<LessonHistoryAttempt[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const token = localStorage.getItem('tnpsc_student_token')
    if (!token) {
      setAttempts([])
      return
    }
    let mounted = true
    setLoading(true)
    setError(null)

    const q = new URLSearchParams({
      groupId,
      subjectId,
      standardId: String(standardId),
      unitId: String(unitId),
      mode,
    })
    if (lessonId) q.set('lessonId', lessonId)
    if (lessonTitle) q.set('lessonTitle', lessonTitle)

    apiFetch(`/api/student/syllabus-progress/lesson-history?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null)
        if (!mounted) return
        if (!res.ok || json?.status !== 'success') {
          setError(json?.message || 'Unable to load attempt history.')
          setAttempts([])
          return
        }
        const rows = Array.isArray(json.data?.attempts)
          ? json.data.attempts
          : Array.isArray(json.data)
            ? json.data
            : []
        setAttempts(
          rows.map((r: any, idx: number) => ({
            attemptNumber: Number(r.attemptNumber || idx + 1),
            percentage: Math.round(Number(r.percentage || 0) * 100) / 100,
            score: Number(r.score || 0),
            maxScore: Number(r.maxScore || 0),
            awardType:
              r.awardType === 'GOLD' || r.awardType === 'PLATINUM' || r.awardType === 'SILVER'
                ? r.awardType
                : 'NONE',
            completedAt: r.completedAt || '',
          }))
        )
      })
      .catch(() => {
        if (mounted) setError('Unable to load attempt history.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [isOpen, groupId, subjectId, standardId, unitId, lessonId, lessonTitle, mode])

  if (!isOpen) return null

  const bestAward = getBestAward(attempts)
  const silverCount = attempts.filter((a) => a.awardType === 'SILVER').length
  const platinumCount = attempts.filter((a) => a.awardType === 'PLATINUM').length
  const goldCount = attempts.filter((a) => a.awardType === 'GOLD').length

  return (
    <div
      className="award-celebration-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Attempt History"
      onClick={onClose}
    >
      <div
        className="glass"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          overflowY: 'auto',
          borderRadius: '20px',
          padding: '1.5rem',
          background: 'rgba(14, 22, 42, 0.96)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.65)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          className="award-celebration-close"
          onClick={onClose}
          aria-label="Close attempt history"
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.35rem' }}>
          <History size={18} style={{ color: '#ffd700' }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>Attempt History &amp; Award Progression</h3>
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.84rem', color: '#94a3b8' }}>{lessonTitle}</p>

        {bestAward && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 215, 0, 0.25)',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <AwardShieldLogo tier={bestAward} size={32} showLabel={false} />
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Best Achievement
                </div>
                <strong style={{ fontSize: '0.95rem', color: '#fde047' }}>{bestAward} AWARD</strong>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.78rem', color: '#cbd5e1' }}>
              {silverCount > 0 && <span>Silver × <strong>{silverCount}</strong></span>}
              {platinumCount > 0 && <span>Platinum × <strong>{platinumCount}</strong></span>}
              {goldCount > 0 && <span style={{ color: '#fde047' }}>Gold × <strong>{goldCount}</strong></span>}
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem 0' }}>Loading attempt history...</p>
        ) : error ? (
          <p style={{ textAlign: 'center', color: '#fca5a5', padding: '1rem 0' }}>{error}</p>
        ) : attempts.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem 0' }}>
            No completed attempts recorded for this lesson yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {attempts.map((att) => (
              <div
                key={`${att.attemptNumber}-${att.completedAt}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.6rem',
                  padding: '0.7rem 0.9rem',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.72)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.18rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <strong style={{ color: '#f8fafc', fontSize: '0.88rem' }}>
                      Attempt {att.attemptNumber}
                    </strong>
                    <span style={{ color: '#34d399', fontWeight: 700, fontSize: '0.86rem' }}>
                      {att.percentage}%
                    </span>
                    {att.maxScore > 0 && (
                      <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                        ({att.score} / {att.maxScore} marks)
                      </span>
                    )}
                  </div>
                  {att.completedAt && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.74rem', color: '#64748b' }}>
                      <Calendar size={12} />
                      {new Date(att.completedAt).toLocaleString()}
                    </span>
                  )}
                </div>

                <div>
                  {att.awardType !== 'NONE' ? (
                    <span className={`award-pill-item tier-${att.awardType.toLowerCase()}`}>
                      <AwardShieldLogo tier={att.awardType} size={20} showLabel={false} />
                      <span className="award-pill-name">{att.awardType}</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>No Award</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
