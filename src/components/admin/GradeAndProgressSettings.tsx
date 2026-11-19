import { useEffect, useState } from 'react'
import { Award, Save, RotateCcw, Sparkles, CheckCircle2, BarChart3, History, Search } from 'lucide-react'
import { apiFetch } from '../../utils/api'
import {
  AwardShieldLogo,
  AwardCelebrationModal,
  type AchievementAwardResult,
} from '../exam/AchievementAwards'

interface AwardSettingsConfig {
  isEnabled: boolean
  goldMin: number
  goldMax: number
  platinumMin: number
  platinumMax: number
  silverMin: number
  silverMax: number
  version?: number
}

const DEFAULT_AWARD_CONFIG: AwardSettingsConfig = {
  isEnabled: true,
  goldMin: 90,
  goldMax: 100,
  platinumMin: 75,
  platinumMax: 89.99,
  silverMin: 60,
  silverMax: 74.99,
}

export function GradeAndProgressSettings({ token }: { token: string }) {
  const [awardConfig, setAwardConfig] = useState<AwardSettingsConfig>(DEFAULT_AWARD_CONFIG)
  const [overview, setOverview] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewAward, setPreviewAward] = useState<{
    awardType: AchievementAwardResult
    percentage: number
  } | null>(null)
  const [historyGroup, setHistoryGroup] = useState('all')
  const [historySubject, setHistorySubject] = useState('all')
  const [historyStandard, setHistoryStandard] = useState('all')
  const [historyUnit, setHistoryUnit] = useState('all')
  const [historyAward, setHistoryAward] = useState('all')
  const [historySearch, setHistorySearch] = useState('')
  const [awardHistoryLoading, setAwardHistoryLoading] = useState(false)
  const [awardHistoryData, setAwardHistoryData] = useState<{
    summary: { totalAttempts: number; goldCount: number; platinumCount: number; silverCount: number; totalAwards: number }
    items: Array<{
      id: number
      studentId: number
      studentName: string
      studentEmail: string
      groupId: string
      subject: string
      standardId: number | null
      unitId: number | null
      lessonTitle: string
      attemptNumber: number
      score: number
      maxScore: number
      percentage: number
      awardType: AchievementAwardResult
      mode: string
      completedAt: string
    }>
  } | null>(null)

  useEffect(() => {
    if (!token) return
    let mounted = true
    setAwardHistoryLoading(true)
    const params = new URLSearchParams()
    if (historyGroup !== 'all') params.set('group', historyGroup)
    if (historySubject !== 'all') params.set('subject', historySubject)
    if (historyStandard !== 'all') params.set('standard', historyStandard)
    if (historyUnit !== 'all') params.set('unit', historyUnit)
    if (historyAward !== 'all') params.set('awardType', historyAward)
    if (historySearch.trim()) params.set('search', historySearch.trim())

    apiFetch(`/api/student/admin/award-history?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (mounted && d?.status === 'success' && d.data) {
          setAwardHistoryData(d.data)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setAwardHistoryLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [token, historyGroup, historySubject, historyStandard, historyUnit, historyAward, historySearch])

  useEffect(() => {
    if (!token) return
    apiFetch('/api/student/admin/award-settings', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.status === 'success' && d.settings) {
          setAwardConfig(d.settings)
        }
      })
      .catch(() => {})

    apiFetch('/api/student/admin/syllabus-progress', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.status === 'success' && d.data) {
          setOverview(d.data)
        }
      })
      .catch(() => {})
  }, [token])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const res = await apiFetch('/api/student/admin/award-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(awardConfig),
      })
      const json = await res.json()
      if (!res.ok || json.status !== 'success') {
        setError(json.message || 'Failed to save award settings.')
      } else {
        setAwardConfig(json.settings || awardConfig)
        setMessage('Achievement Award thresholds saved. Future attempts will use the new settings.')
      }
    } catch (err: any) {
      setError(err?.message || 'Network error while saving award settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const res = await apiFetch('/api/student/admin/award-settings/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok || json.status !== 'success') {
        setError(json.message || 'Failed to reset award settings.')
      } else {
        setAwardConfig(json.settings || DEFAULT_AWARD_CONFIG)
        setMessage('Award settings restored to defaults (Gold 90–100%, Platinum 75–89.99%, Silver 60–74.99%).')
      }
    } catch (err: any) {
      setError(err?.message || 'Network error while resetting award settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Achievement Award Management */}
      <div className="glass" style={{ padding: '1.4rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Award size={20} style={{ color: '#ffd700' }} />
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>Achievement Award Management</h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Ranking Order: 1. GOLD (Highest) → 2. PLATINUM → 3. SILVER
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem', color: '#e2e8f0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={awardConfig.isEnabled}
                onChange={(e) => setAwardConfig({ ...awardConfig, isEnabled: e.target.checked })}
              />
              <span>Enable Award System</span>
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={saving}
              onClick={handleReset}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RotateCcw size={14} />
              <span>Reset Defaults</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={handleSave}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Save size={14} />
              <span>{saving ? 'Saving...' : 'Save Award Settings'}</span>
            </button>
          </div>
        </div>

        {message && (
          <div style={{ marginBottom: '0.85rem', color: '#34d399', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle2 size={15} />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div style={{ marginBottom: '0.85rem', color: '#fca5a5', fontSize: '0.84rem' }}>{error}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
          {/* Rank 1: GOLD */}
          <div style={{ padding: '1rem', borderRadius: '14px', background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(255,215,0,0.35)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <AwardShieldLogo tier="GOLD" size={38} />
              <span style={{ fontSize: '0.74rem', color: '#fde047', fontWeight: 700 }}>Rank #1 • Highest</span>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
              <label>
                Min %
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={awardConfig.goldMin}
                  onChange={(e) => setAwardConfig({ ...awardConfig, goldMin: Number(e.target.value) })}
                  style={{ width: '74px', marginLeft: '0.35rem', padding: '0.28rem', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.16)' }}
                />
              </label>
              <label>
                Max %
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={awardConfig.goldMax}
                  onChange={(e) => setAwardConfig({ ...awardConfig, goldMax: Number(e.target.value) })}
                  style={{ width: '74px', marginLeft: '0.35rem', padding: '0.28rem', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.16)' }}
                />
              </label>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
              onClick={() => setPreviewAward({ awardType: 'GOLD', percentage: 95 })}
            >
              <Sparkles size={13} style={{ marginRight: '0.3rem' }} />
              Preview Gold Animation
            </button>
          </div>

          {/* Rank 2: PLATINUM */}
          <div style={{ padding: '1rem', borderRadius: '14px', background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(226,232,240,0.35)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <AwardShieldLogo tier="PLATINUM" size={38} />
              <span style={{ fontSize: '0.74rem', color: '#f1f5f9', fontWeight: 700 }}>Rank #2 • Second</span>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
              <label>
                Min %
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={awardConfig.platinumMin}
                  onChange={(e) => setAwardConfig({ ...awardConfig, platinumMin: Number(e.target.value) })}
                  style={{ width: '74px', marginLeft: '0.35rem', padding: '0.28rem', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.16)' }}
                />
              </label>
              <label>
                Max %
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={awardConfig.platinumMax}
                  onChange={(e) => setAwardConfig({ ...awardConfig, platinumMax: Number(e.target.value) })}
                  style={{ width: '74px', marginLeft: '0.35rem', padding: '0.28rem', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.16)' }}
                />
              </label>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
              onClick={() => setPreviewAward({ awardType: 'PLATINUM', percentage: 82 })}
            >
              <Sparkles size={13} style={{ marginRight: '0.3rem' }} />
              Preview Platinum Animation
            </button>
          </div>

          {/* Rank 3: SILVER */}
          <div style={{ padding: '1rem', borderRadius: '14px', background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(148,163,184,0.35)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <AwardShieldLogo tier="SILVER" size={38} />
              <span style={{ fontSize: '0.74rem', color: '#cbd5e1', fontWeight: 700 }}>Rank #3 • Third</span>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
              <label>
                Min %
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={awardConfig.silverMin}
                  onChange={(e) => setAwardConfig({ ...awardConfig, silverMin: Number(e.target.value) })}
                  style={{ width: '74px', marginLeft: '0.35rem', padding: '0.28rem', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.16)' }}
                />
              </label>
              <label>
                Max %
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={awardConfig.silverMax}
                  onChange={(e) => setAwardConfig({ ...awardConfig, silverMax: Number(e.target.value) })}
                  style={{ width: '74px', marginLeft: '0.35rem', padding: '0.28rem', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.16)' }}
                />
              </label>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
              onClick={() => setPreviewAward({ awardType: 'SILVER', percentage: 68 })}
            >
              <Sparkles size={13} style={{ marginRight: '0.3rem' }} />
              Preview Silver Animation
            </button>
          </div>
        </div>
      </div>

      {/* Platform Award & Syllabus Analytics */}
      {overview && (
        <div className="glass" style={{ padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.85rem' }}>
            <BarChart3 size={18} style={{ color: '#ffd700' }} />
            <h4 style={{ margin: 0, color: '#f8fafc' }}>Platform Achievement & Syllabus Statistics</h4>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem' }}>
            <div style={{ padding: '0.7rem', borderRadius: '10px', background: 'rgba(15,23,42,0.65)' }}>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Mapped Lessons</div>
              <strong style={{ fontSize: '1.15rem', color: '#f8fafc' }}>{overview.totalMappedLessons}</strong>
            </div>
            <div style={{ padding: '0.7rem', borderRadius: '10px', background: 'rgba(15,23,42,0.65)' }}>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Gold Awards Earned</div>
              <strong style={{ fontSize: '1.15rem', color: '#fde047' }}>{overview.goldCount ?? 0}</strong>
            </div>
            <div style={{ padding: '0.7rem', borderRadius: '10px', background: 'rgba(15,23,42,0.65)' }}>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Platinum Awards Earned</div>
              <strong style={{ fontSize: '1.15rem', color: '#f1f5f9' }}>{overview.platinumCount ?? 0}</strong>
            </div>
            <div style={{ padding: '0.7rem', borderRadius: '10px', background: 'rgba(15,23,42,0.65)' }}>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Silver Awards Earned</div>
              <strong style={{ fontSize: '1.15rem', color: '#cbd5e1' }}>{overview.silverCount ?? 0}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Student-Wise Award History & Filterable Analytics */}
      <div className="glass" style={{ padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <History size={18} style={{ color: '#ffd700' }} />
            <h4 style={{ margin: 0, color: '#f8fafc' }}>Student-Wise Award History &amp; Distribution</h4>
          </div>
          {awardHistoryData?.summary && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', color: '#cbd5e1', flexWrap: 'wrap' }}>
              <span>Attempts: <strong>{awardHistoryData.summary.totalAttempts}</strong></span>
              <span>Silver: <strong>{awardHistoryData.summary.silverCount}</strong></span>
              <span>Platinum: <strong>{awardHistoryData.summary.platinumCount}</strong></span>
              <span style={{ color: '#fde047' }}>Gold: <strong>{awardHistoryData.summary.goldCount}</strong></span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '0.55rem', marginBottom: '0.9rem' }}>
          <select
            value={historyGroup}
            onChange={(e) => setHistoryGroup(e.target.value)}
            style={{ padding: '0.45rem 0.6rem', borderRadius: '8px', background: 'rgba(15,23,42,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.14)', fontSize: '0.8rem' }}
          >
            <option value="all">All Groups</option>
            <option value="group1">TNPSC Group 1</option>
            <option value="group2">TNPSC Group 2 &amp; 2A</option>
            <option value="group4">TNPSC Group 4 &amp; VAO</option>
          </select>

          <select
            value={historySubject}
            onChange={(e) => setHistorySubject(e.target.value)}
            style={{ padding: '0.45rem 0.6rem', borderRadius: '8px', background: 'rgba(15,23,42,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.14)', fontSize: '0.8rem' }}
          >
            <option value="all">All Subjects</option>
            <option value="general-studies">General Studies</option>
            <option value="aptitude">Aptitude &amp; Mental Ability</option>
            <option value="general-tamil">General Tamil</option>
            <option value="general-english">General English</option>
          </select>

          <select
            value={historyStandard}
            onChange={(e) => setHistoryStandard(e.target.value)}
            style={{ padding: '0.45rem 0.6rem', borderRadius: '8px', background: 'rgba(15,23,42,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.14)', fontSize: '0.8rem' }}
          >
            <option value="all">All Standards</option>
            {[6, 7, 8, 9, 10, 11, 12].map((s) => (
              <option key={s} value={String(s)}>{s}th Standard</option>
            ))}
          </select>

          <select
            value={historyUnit}
            onChange={(e) => setHistoryUnit(e.target.value)}
            style={{ padding: '0.45rem 0.6rem', borderRadius: '8px', background: 'rgba(15,23,42,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.14)', fontSize: '0.8rem' }}
          >
            <option value="all">All Units</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((u) => (
              <option key={u} value={String(u)}>Unit {u}</option>
            ))}
          </select>

          <select
            value={historyAward}
            onChange={(e) => setHistoryAward(e.target.value)}
            style={{ padding: '0.45rem 0.6rem', borderRadius: '8px', background: 'rgba(15,23,42,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.14)', fontSize: '0.8rem' }}
          >
            <option value="all">All Awards</option>
            <option value="GOLD">Gold Only</option>
            <option value="PLATINUM">Platinum Only</option>
            <option value="SILVER">Silver Only</option>
            <option value="NONE">No Award (&lt;60%)</option>
          </select>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.55rem', color: '#94a3b8' }} />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Student or lesson..."
              style={{ width: '100%', padding: '0.45rem 0.6rem 0.45rem 1.85rem', borderRadius: '8px', background: 'rgba(15,23,42,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.14)', fontSize: '0.8rem' }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {awardHistoryLoading ? (
            <p style={{ color: '#94a3b8', fontSize: '0.84rem', textAlign: 'center', padding: '1rem 0' }}>Loading award history...</p>
          ) : !awardHistoryData || awardHistoryData.items.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.84rem', textAlign: 'center', padding: '1rem 0' }}>No matching award attempts found.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', color: '#e2e8f0' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', textAlign: 'left', color: '#94a3b8' }}>
                  <th style={{ padding: '0.55rem 0.5rem' }}>Student</th>
                  <th style={{ padding: '0.55rem 0.5rem' }}>Lesson / Test</th>
                  <th style={{ padding: '0.55rem 0.5rem' }}>Syllabus</th>
                  <th style={{ padding: '0.55rem 0.5rem' }}>Attempt</th>
                  <th style={{ padding: '0.55rem 0.5rem' }}>Marks</th>
                  <th style={{ padding: '0.55rem 0.5rem' }}>Score %</th>
                  <th style={{ padding: '0.55rem 0.5rem' }}>Award</th>
                  <th style={{ padding: '0.55rem 0.5rem' }}>Completed</th>
                </tr>
              </thead>
              <tbody>
                {awardHistoryData.items.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '0.55rem 0.5rem' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{row.studentName}</div>
                      {row.studentEmail && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{row.studentEmail}</div>}
                    </td>
                    <td style={{ padding: '0.55rem 0.5rem', maxWidth: '220px' }}>{row.lessonTitle}</td>
                    <td style={{ padding: '0.55rem 0.5rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                      {[row.groupId, row.subject, row.standardId ? `${row.standardId}th` : null, row.unitId ? `U${row.unitId}` : null]
                        .filter(Boolean)
                        .join(' • ')}
                    </td>
                    <td style={{ padding: '0.55rem 0.5rem' }}>#{row.attemptNumber}</td>
                    <td style={{ padding: '0.55rem 0.5rem' }}>
                      {row.score} / {row.maxScore}
                    </td>
                    <td style={{ padding: '0.55rem 0.5rem', fontWeight: 700, color: '#34d399' }}>
                      {row.percentage}%
                    </td>
                    <td style={{ padding: '0.55rem 0.5rem' }}>
                      {row.awardType !== 'NONE' ? (
                        <span className={`award-pill-item tier-${row.awardType.toLowerCase()}`}>
                          <AwardShieldLogo tier={row.awardType} size={18} showLabel={false} />
                          <span className="award-pill-name">{row.awardType}</span>
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: '0.55rem 0.5rem', color: '#94a3b8', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                      {row.completedAt ? new Date(row.completedAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {previewAward && (
        <AwardCelebrationModal
          isOpen={Boolean(previewAward)}
          onClose={() => setPreviewAward(null)}
          awardType={previewAward.awardType}
          percentage={previewAward.percentage}
          title="Admin Award Celebration Preview"
        />
      )}
    </div>
  )
}
