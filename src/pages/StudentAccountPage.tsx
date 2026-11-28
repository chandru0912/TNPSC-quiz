import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Crown,
  ExternalLink,
  HelpCircle,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useStudentAuth } from '../context/StudentAuthContext'
import { StudentAvatar } from '../components/StudentAvatar'
import { resolveStudentDisplayName } from '../utils/studentProfile'
import { apiFetch } from '../utils/api'
import './StudentAccountPage.css'

interface StudentAccountPageProps {
  section: 'profile' | 'settings' | 'help'
}

const TARGET_GROUP_LABELS: Record<string, string> = {
  group1: 'TNPSC Group 1',
  group2: 'TNPSC Group 2 & 2A',
  group2a: 'TNPSC Group 2A',
  group4: 'TNPSC Group 4 & VAO',
}

const HELP_FAQS = [
  {
    q: 'How do I access Samacheer Kalvi Textbooks and Study Materials?',
    a: 'Use the Study Materials or Textbook Library links in the left sidebar to browse 6th–12th Standard materials by Medium, Standard, Subject, and Term/Volume.',
  },
  {
    q: 'How do I upgrade or manage my TNPSC Aspirant Orbit subscription?',
    a: 'Open Upgrade Plan from the Profile menu or click Subscription in the sidebar to view available plans and your active subscription status.',
  },
  {
    q: 'How are my Mock Tests, Mark List, and Study Streak tracked?',
    a: 'Every completed practice session, unit test, and mock test is automatically recorded in your Mark List, Performance Analytics, and Progress Tracker.',
  },
  {
    q: 'Need further assistance with your account or payments?',
    a: 'Sign in with your registered email and keep your target group updated in your profile. For payment or account issues, contact our support team via the registered support email.',
  },
]

function formatPlanLabel(rawPlan?: string | null): string {
  const clean = String(rawPlan || '').trim()
  if (!clean) return 'Free'
  if (clean.toLowerCase() === 'free') return 'Free'
  return clean
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const StudentAccountPage: React.FC<StudentAccountPageProps> = ({ section }) => {
  const navigate = useNavigate()
  const { student, token, isAuthenticated, isPreviewMode, logout, refreshProfile, updateStudentState } = useStudentAuth()

  const activeStudent = isAuthenticated ? student : null
  const displayName = resolveStudentDisplayName(activeStudent)
  const targetGroupLabel =
    TARGET_GROUP_LABELS[activeStudent?.targetGroup || 'group4'] || 'TNPSC Group 4 & VAO'

  // Dynamic Plan State (fetched from /api/subscriptions/me)
  const [planName, setPlanName] = useState<string>(() => formatPlanLabel(activeStudent?.subscriptionTier))
  const [planStatus, setPlanStatus] = useState<string>('')
  const [loadingPlan, setLoadingPlan] = useState(false)

  // Name Inline Edit State
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [nameSuccess, setNameSuccess] = useState<string | null>(null)

  // Username Inline Edit State
  const [editingUsername, setEditingUsername] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [usernameHint, setUsernameHint] = useState<string | null>(null)
  const [savingUsername, setSavingUsername] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null)

  // Delete Account Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteEmailInput, setDeleteEmailInput] = useState('')
  const [deletePhraseInput, setDeletePhraseInput] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Fetch authoritative profile & live subscription plan on mount when on Settings/Profile
  useEffect(() => {
    if (!isAuthenticated || !token || section === 'help') return
    void refreshProfile()

    let cancelled = false
    setLoadingPlan(true)
    apiFetch('/api/subscriptions/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json().catch(() => null))
      .then((json) => {
        if (cancelled) return
        const currentSub = json?.data?.currentSubscription
        if (currentSub?.planName) {
          setPlanName(formatPlanLabel(currentSub.planName))
          setPlanStatus(String(currentSub.subscriptionStatus || ''))
        } else {
          setPlanName(formatPlanLabel(activeStudent?.subscriptionTier || 'Free'))
          setPlanStatus('')
        }
      })
      .catch(() => {
        if (!cancelled) setPlanName(formatPlanLabel(activeStudent?.subscriptionTier || 'Free'))
      })
      .finally(() => {
        if (!cancelled) setLoadingPlan(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, token, section, refreshProfile, activeStudent?.subscriptionTier])

  // Debounced live username uniqueness validation while editing
  useEffect(() => {
    if (!editingUsername || !token) return
    const cleaned = usernameInput.trim().replace(/^@+/, '').toLowerCase()
    const current = (activeStudent?.username || '').trim().toLowerCase()

    setUsernameError(null)
    if (!cleaned) {
      setUsernameAvailable(null)
      setUsernameHint(null)
      return
    }
    if (cleaned === current) {
      setUsernameAvailable(true)
      setUsernameHint('This is your current username.')
      return
    }

    const timer = window.setTimeout(async () => {
      setCheckingUsername(true)
      try {
        const res = await apiFetch(`/api/student/username/check?username=${encodeURIComponent(cleaned)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json().catch(() => null)
        if (res.ok && json?.status === 'success') {
          setUsernameAvailable(Boolean(json.available))
          setUsernameHint(json.message || null)
        }
      } catch {
        setUsernameAvailable(null)
      } finally {
        setCheckingUsername(false)
      }
    }, 320)

    return () => window.clearTimeout(timer)
  }, [editingUsername, usernameInput, token, activeStudent?.username])

  const startEditName = () => {
    setNameInput(displayName)
    setNameError(null)
    setNameSuccess(null)
    setEditingName(true)
  }

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    const trimmed = nameInput.trim().replace(/\s+/g, ' ')
    if (trimmed.length < 2 || trimmed.length > 120) {
      setNameError('Name must be between 2 and 120 characters.')
      return
    }

    setSavingName(true)
    setNameError(null)
    setNameSuccess(null)
    try {
      const res = await apiFetch('/api/student/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fullName: trimmed }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success' || !json.student) {
        setNameError(json.message || 'Failed to update name.')
        return
      }
      updateStudentState(json.student)
      setEditingName(false)
      setNameSuccess('Name updated across your account.')
      window.setTimeout(() => setNameSuccess(null), 3000)
    } catch (err: any) {
      setNameError(err?.message || 'Unable to save name. Please try again.')
    } finally {
      setSavingName(false)
    }
  }

  const startEditUsername = () => {
    setUsernameInput(activeStudent?.username || '')
    setUsernameError(null)
    setUsernameSuccess(null)
    setUsernameAvailable(null)
    setUsernameHint(null)
    setEditingUsername(true)
  }

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    const cleaned = usernameInput.trim().replace(/^@+/, '').toLowerCase()
    if (!cleaned || cleaned.length < 3 || cleaned.length > 30) {
      setUsernameError('Username must be between 3 and 30 characters.')
      return
    }
    if (usernameAvailable === false) {
      setUsernameError(usernameHint || 'This username is already taken.')
      return
    }

    setSavingUsername(true)
    setUsernameError(null)
    setUsernameSuccess(null)
    try {
      const res = await apiFetch('/api/student/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: cleaned }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success' || !json.student) {
        setUsernameError(json.message || 'Failed to update username.')
        return
      }
      updateStudentState(json.student)
      setEditingUsername(false)
      setUsernameSuccess('Username updated across your account.')
      window.setTimeout(() => setUsernameSuccess(null), 3000)
    } catch (err: any) {
      setUsernameError(err?.message || 'Unable to save username. Please try again.')
    } finally {
      setSavingUsername(false)
    }
  }

  const handleConfirmDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !activeStudent) return
    setDeleteError(null)
    setDeletingAccount(true)
    try {
      const res = await apiFetch('/api/student/account', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmEmail: deleteEmailInput.trim(),
          confirmPhrase: deletePhraseInput.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setDeleteError(json.message || 'Could not delete account. Please verify your details.')
        return
      }
      setDeleteModalOpen(false)
      logout()
      navigate('/', { replace: true })
    } catch (err: any) {
      setDeleteError(err?.message || 'Account deletion failed. Please try again.')
    } finally {
      setDeletingAccount(false)
    }
  }

  const canConfirmDelete =
    !deletingAccount &&
    deletePhraseInput.trim().toUpperCase() === 'DELETE' &&
    deleteEmailInput.trim().toLowerCase() === (activeStudent?.email || '').trim().toLowerCase()

  return (
    <div className="account-settings-page">
      <motion.div
        className="account-settings-stack"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <button type="button" className="account-back-btn" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>

        {/* ===================== ACCOUNT SETTINGS SECTION ===================== */}
        {section === 'settings' && (
          <>
            <div className="account-page-header">
              <h1 className="account-page-title">Account Settings</h1>
              <p className="account-page-subtitle">
                Manage your TNPSC Aspirant Orbit profile details, unique username, plan, and account preferences.
              </p>
            </div>

            {!isAuthenticated || !activeStudent ? (
              <div className="account-card">
                <div className="account-row">
                  <div className="account-row-main" style={{ flexWrap: 'wrap' }}>
                    <div className="account-row-info">
                      <span className="account-row-value">Sign in required</span>
                      <span className="account-row-desc">
                        Sign in to view and manage your TNPSC Aspirant Orbit account details.
                      </span>
                    </div>
                    <button type="button" className="account-btn account-btn-primary" onClick={() => navigate('/login')}>
                      Sign In / Register
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* A. Account Details Card */}
                <section className="account-card" aria-label="Account Details">
                  <div className="account-card-header">
                    <h2 className="account-card-title">
                      <User size={16} style={{ color: '#ffd700' }} />
                      Account
                    </h2>
                    {isPreviewMode && (
                      <span className="account-badge account-badge--plan">Preview Mode (Read-Only)</span>
                    )}
                  </div>

                  {/* 1. Name */}
                  <div className="account-row">
                    <div className="account-row-main">
                      <div className="account-row-info">
                        <span className="account-row-label">Name</span>
                        {!editingName && <span className="account-row-value">{displayName}</span>}
                      </div>
                      {!editingName && (
                        <button
                          type="button"
                          className="account-edit-icon-btn"
                          onClick={startEditName}
                          disabled={isPreviewMode}
                          aria-label="Edit name"
                          title="Edit Name"
                        >
                          <Pencil size={14} />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>

                    {editingName && (
                      <form className="account-inline-editor" onSubmit={handleSaveName}>
                        <div className="account-input-wrap">
                          <input
                            type="text"
                            className="account-input"
                            value={nameInput}
                            onChange={(e) => {
                              setNameInput(e.target.value)
                              setNameError(null)
                            }}
                            placeholder="Enter your full name"
                            maxLength={120}
                            autoFocus
                          />
                          <div className="account-inline-actions">
                            <button
                              type="button"
                              className="account-btn account-btn-secondary"
                              disabled={savingName}
                              onClick={() => {
                                setEditingName(false)
                                setNameError(null)
                              }}
                            >
                              Cancel
                            </button>
                            <button type="submit" className="account-btn account-btn-primary" disabled={savingName}>
                              {savingName ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                              <span>{savingName ? 'Saving...' : 'Save'}</span>
                            </button>
                          </div>
                        </div>
                        {nameError && (
                          <span className="account-feedback account-feedback--error">
                            <AlertCircle size={14} /> {nameError}
                          </span>
                        )}
                      </form>
                    )}

                    {nameSuccess && (
                      <span className="account-feedback account-feedback--success">
                        <CheckCircle2 size={14} /> {nameSuccess}
                      </span>
                    )}
                  </div>

                  {/* 2. Username */}
                  <div className="account-row">
                    <div className="account-row-main">
                      <div className="account-row-info">
                        <span className="account-row-label">Username</span>
                        {!editingUsername && (
                          <span
                            className={`account-row-value ${!activeStudent.username ? 'account-row-value--muted' : ''}`}
                          >
                            {activeStudent.username ? `@${activeStudent.username}` : 'Not set yet'}
                          </span>
                        )}
                        <span className="account-row-desc">Your unique username on TNPSC Aspirant Orbit</span>
                      </div>
                      {!editingUsername && (
                        <button
                          type="button"
                          className="account-edit-icon-btn"
                          onClick={startEditUsername}
                          disabled={isPreviewMode}
                          aria-label="Edit username"
                          title="Edit Username"
                        >
                          <Pencil size={14} />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>

                    {editingUsername && (
                      <form className="account-inline-editor" onSubmit={handleSaveUsername}>
                        <div className="account-input-wrap">
                          <input
                            type="text"
                            className="account-input"
                            value={usernameInput}
                            onChange={(e) => {
                              setUsernameInput(e.target.value)
                              setUsernameError(null)
                            }}
                            placeholder="e.g. tnpsc_aspirant"
                            maxLength={30}
                            autoFocus
                          />
                          <div className="account-inline-actions">
                            <button
                              type="button"
                              className="account-btn account-btn-secondary"
                              disabled={savingUsername}
                              onClick={() => {
                                setEditingUsername(false)
                                setUsernameError(null)
                                setUsernameHint(null)
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="account-btn account-btn-primary"
                              disabled={savingUsername || checkingUsername || usernameAvailable === false}
                            >
                              {savingUsername ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                              <span>{savingUsername ? 'Saving...' : 'Save'}</span>
                            </button>
                          </div>
                        </div>

                        {checkingUsername && (
                          <span className="account-feedback account-feedback--muted">
                            <Loader2 size={13} className="spin" /> Checking availability...
                          </span>
                        )}
                        {!checkingUsername && usernameError && (
                          <span className="account-feedback account-feedback--error">
                            <AlertCircle size={14} /> {usernameError}
                          </span>
                        )}
                        {!checkingUsername && !usernameError && usernameHint && (
                          <span
                            className={`account-feedback ${
                              usernameAvailable === false ? 'account-feedback--error' : 'account-feedback--success'
                            }`}
                          >
                            {usernameAvailable === false ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                            {usernameHint}
                          </span>
                        )}
                      </form>
                    )}

                    {usernameSuccess && (
                      <span className="account-feedback account-feedback--success">
                        <CheckCircle2 size={14} /> {usernameSuccess}
                      </span>
                    )}
                  </div>

                  {/* 3. Email (Read-Only) */}
                  <div className="account-row">
                    <div className="account-row-main">
                      <div className="account-row-info">
                        <span className="account-row-label">Email</span>
                        <span className="account-row-value">
                          <span>{activeStudent.email}</span>
                          {activeStudent.emailVerified && (
                            <span className="account-badge account-badge--verified">
                              <ShieldCheck size={12} /> Verified
                            </span>
                          )}
                        </span>
                        <span className="account-row-desc">
                          Your registered sign-in email address is kept private and read-only.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Plan (Dynamic Subscription) */}
                  <div className="account-row">
                    <div className="account-row-main" style={{ flexWrap: 'wrap' }}>
                      <div className="account-row-info">
                        <span className="account-row-label">Plan</span>
                        <span className="account-row-value">
                          {loadingPlan ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8' }}>
                              <Loader2 size={14} className="spin" /> Checking plan...
                            </span>
                          ) : (
                            <>
                              <span className="account-badge account-badge--plan">
                                <Crown size={12} /> {planName}
                              </span>
                              {planStatus && (
                                <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>
                                  ({planStatus})
                                </span>
                              )}
                            </>
                          )}
                        </span>
                      </div>
                      <Link to="/dashboard/subscription" className="account-btn account-btn-secondary">
                        <span>Manage Plan</span>
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                  </div>
                </section>

                {/* B. Delete Account Section */}
                <section className="account-card account-card--danger" aria-label="Delete Account">
                  <div className="account-row">
                    <div className="account-row-main" style={{ flexWrap: 'wrap' }}>
                      <div className="account-row-info">
                        <span className="account-row-value" style={{ color: '#fca5a5' }}>
                          Delete account
                        </span>
                        <span className="account-row-desc">
                          Permanently delete your account and its associated data.
                        </span>
                      </div>
                      <button
                        type="button"
                        className="account-btn account-btn-danger"
                        disabled={isPreviewMode}
                        onClick={() => {
                          setDeleteEmailInput('')
                          setDeletePhraseInput('')
                          setDeleteError(null)
                          setDeleteModalOpen(true)
                        }}
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* ===================== PROFILE OVERVIEW SECTION ===================== */}
        {section === 'profile' && (
          <div className="account-card">
            <div className="account-row" style={{ gap: '1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <StudentAvatar
                  studentId={activeStudent?.id}
                  fullName={displayName}
                  email={activeStudent?.email || ''}
                  avatarUrl={activeStudent?.avatarUrl}
                  size={60}
                />
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <h1 className="account-page-title" style={{ fontSize: '1.35rem' }}>
                    {displayName}
                  </h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                    {activeStudent?.username && (
                      <span style={{ fontSize: '0.84rem', color: '#94a3b8', fontWeight: 600 }}>
                        @{activeStudent.username}
                      </span>
                    )}
                    <span style={{ fontSize: '0.84rem', color: '#ffd700', fontWeight: 600 }}>
                      {targetGroupLabel}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="account-btn account-btn-secondary" onClick={() => navigate('/dashboard/settings')}>
                    <Pencil size={14} /> Edit Account
                  </button>
                  <button type="button" className="account-btn account-btn-primary" onClick={() => navigate('/dashboard/subscription')}>
                    <Crown size={14} /> Upgrade Plan
                  </button>
                </div>
              </div>

              {isAuthenticated && activeStudent ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(148, 163, 184, 0.14)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                      <Mail size={13} /> Email
                    </div>
                    <div style={{ marginTop: '0.25rem', fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc', wordBreak: 'break-word' }}>
                      {activeStudent.email}
                    </div>
                  </div>
                  <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(148, 163, 184, 0.14)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                      <Sparkles size={13} /> Exam Group
                    </div>
                    <div style={{ marginTop: '0.25rem', fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                      {targetGroupLabel}
                    </div>
                  </div>
                  <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(148, 163, 184, 0.14)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                      <MapPin size={13} /> District
                    </div>
                    <div style={{ marginTop: '0.25rem', fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                      {activeStudent.district || 'Not specified'}
                    </div>
                  </div>
                  <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(148, 163, 184, 0.14)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                      <Phone size={13} /> Mobile
                    </div>
                    <div style={{ marginTop: '0.25rem', fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                      {activeStudent.mobile || 'Not provided'}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <span style={{ color: '#cbd5e1', fontSize: '0.88rem' }}>
                    Sign in to view and sync your TNPSC student profile and progress.
                  </span>
                  <button type="button" className="account-btn account-btn-primary" onClick={() => navigate('/login')}>
                    Sign In / Register
                  </button>
                </div>
              )}

              {isAuthenticated && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <button
                    type="button"
                    className="account-btn account-btn-danger-outline"
                    onClick={() => {
                      logout()
                      navigate('/')
                    }}
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== HELP & SUPPORT SECTION ===================== */}
        {section === 'help' && (
          <div className="account-card">
            <div className="account-card-header">
              <h1 className="account-card-title" style={{ fontSize: '1.15rem' }}>
                <HelpCircle size={18} style={{ color: '#ffd700' }} />
                Help &amp; Support
              </h1>
            </div>
            {HELP_FAQS.map((item) => (
              <div key={item.q} className="account-row">
                <span className="account-row-value" style={{ fontSize: '0.94rem' }}>{item.q}</span>
                <span className="account-row-desc" style={{ fontSize: '0.84rem', color: '#cbd5e1' }}>{item.a}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ===================== DELETE ACCOUNT CONFIRMATION MODAL ===================== */}
      <AnimatePresence>
        {deleteModalOpen && activeStudent && (
          <motion.div
            className="account-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !deletingAccount && setDeleteModalOpen(false)}
          >
            <motion.div
              className="account-modal-box"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.16 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="account-modal-head">
                <strong style={{ color: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.98rem' }}>
                  <AlertTriangle size={18} /> Permanently Delete Account
                </strong>
                <button
                  type="button"
                  className="account-edit-icon-btn"
                  style={{ height: '30px', padding: '0 0.45rem' }}
                  disabled={deletingAccount}
                  onClick={() => setDeleteModalOpen(false)}
                  aria-label="Close modal"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleConfirmDeleteAccount}>
                <div className="account-modal-body">
                  <p style={{ margin: 0 }}>
                    This action is <strong>permanent and cannot be undone</strong>. The following personal data and associated records will be permanently deleted:
                  </p>
                  <ul className="account-modal-list">
                    <li>Your student profile, name, username, and sign-in credentials</li>
                    <li>All mock test attempts, mark lists, and performance analytics</li>
                    <li>All study streaks, syllabus progress, and practice history</li>
                    <li>All active device sessions and subscription entitlements</li>
                  </ul>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label className="account-row-label" htmlFor="delete-confirm-email">
                      Confirm your registered email ({activeStudent.email})
                    </label>
                    <input
                      id="delete-confirm-email"
                      type="email"
                      className="account-input"
                      value={deleteEmailInput}
                      onChange={(e) => {
                        setDeleteEmailInput(e.target.value)
                        setDeleteError(null)
                      }}
                      placeholder={activeStudent.email}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label className="account-row-label" htmlFor="delete-confirm-phrase">
                      Type <code style={{ color: '#fca5a5' }}>DELETE</code> to confirm
                    </label>
                    <input
                      id="delete-confirm-phrase"
                      type="text"
                      className="account-input"
                      value={deletePhraseInput}
                      onChange={(e) => {
                        setDeletePhraseInput(e.target.value)
                        setDeleteError(null)
                      }}
                      placeholder="DELETE"
                      required
                    />
                  </div>

                  {deleteError && (
                    <span className="account-feedback account-feedback--error">
                      <AlertCircle size={14} /> {deleteError}
                    </span>
                  )}
                </div>

                <div className="account-modal-foot">
                  <button
                    type="button"
                    className="account-btn account-btn-secondary"
                    disabled={deletingAccount}
                    onClick={() => setDeleteModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="account-btn account-btn-danger" disabled={!canConfirmDelete}>
                    {deletingAccount ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                    <span>{deletingAccount ? 'Deleting...' : 'Delete Account'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default StudentAccountPage
