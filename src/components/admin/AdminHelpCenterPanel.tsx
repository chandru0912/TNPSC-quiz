import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Loader2,
  Lock,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { apiFetch, getAuthenticatedApiUrl } from '../../utils/api'
import '../support/StudentSupportHub.css'
import './AdminHelpCenterPanel.css'

const COMPLAINT_CATEGORIES = [
  'Account & Login Issues',
  'Google Login Problems',
  'Study Materials Issues',
  'Textbook PDF Download Issues',
  'MCQ Practice Issues',
  'Mock Test Issues',
  'Previous Year Papers Issues',
  'Subscription & Payment Issues',
  'Student Dashboard Issues',
  'Performance Analytics Issues',
  'Technical Problems',
  'Privacy & Data Requests',
  'Other Issues',
]

const STATUSES = ['Open', 'In Progress', 'Waiting for Student', 'Resolved', 'Closed'] as const
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const

interface AdminSupportStats {
  total: number
  open: number
  inProgress: number
  waitingForStudent: number
  resolved: number
  closed: number
  unreadCount: number
  unreadTickets: Array<{
    id: number
    ticketNumber: string
    studentName: string
    category: string
    subject: string
    status: string
    priority: string
    updatedAt: string
  }>
}

interface AdminTicketRow {
  id: number
  ticketNumber: string
  studentId: number
  studentName: string
  studentEmail: string
  tnpscGroup: string
  category: string
  subject: string
  description: string
  priority: string
  status: string
  assignedAdminId: number | null
  assignedAdminName: string | null
  unreadByAdmin: boolean
  createdAt: string
  updatedAt: string
}

interface AdminTicketMessage {
  id: number
  senderName: string
  senderRole: 'student' | 'admin'
  message: string
  isInternalNote: boolean
  createdAt: string
}

interface AdminAttachment {
  id: number
  messageId: number | null
  originalFilename: string
  mimeType: string
  fileSize: number
  downloadUrl: string
}

interface AdminAccountOption {
  id: number
  username: string
  name: string
  role: string
}

interface Props {
  token: string
  initialTicketId?: number | null
  onStatsUpdated?: (unreadCount: number) => void
}

function statusClass(status: string): string {
  switch (status) {
    case 'In Progress':
      return 'support-status--in-progress'
    case 'Waiting for Student':
      return 'support-status--waiting'
    case 'Resolved':
      return 'support-status--resolved'
    case 'Closed':
      return 'support-status--closed'
    default:
      return 'support-status--open'
  }
}

function priorityClass(priority: string): string {
  switch (priority) {
    case 'Urgent':
      return 'admin-priority--urgent'
    case 'High':
      return 'admin-priority--high'
    case 'Low':
      return 'admin-priority--low'
    default:
      return 'admin-priority--medium'
  }
}

export const AdminHelpCenterPanel: React.FC<Props> = ({ token, initialTicketId = null, onStatsUpdated }) => {
  const [stats, setStats] = useState<AdminSupportStats>({
    total: 0,
    open: 0,
    inProgress: 0,
    waitingForStudent: 0,
    resolved: 0,
    closed: 0,
    unreadCount: 0,
    unreadTickets: [],
  })
  const [tickets, setTickets] = useState<AdminTicketRow[]>([])
  const [admins, setAdmins] = useState<AdminAccountOption[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalFiltered, setTotalFiltered] = useState(0)
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [search, setSearch] = useState('')

  // Detail View State
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<{
    ticket: AdminTicketRow
    messages: AdminTicketMessage[]
    attachments: AdminAttachment[]
    auditLogs: Array<{ id: number; adminUsername: string; action: string; createdAt: string }>
  } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [composerMode, setComposerMode] = useState<'reply' | 'note'>('reply')
  const [composerText, setComposerText] = useState('')
  const [replyNextStatus, setReplyNextStatus] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const authHeaders = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = {}
    if (token) h.Authorization = `Bearer ${token}`
    return h
  }, [token])

  const loadListAndStats = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      q.set('page', String(page))
      q.set('pageSize', '15')
      if (statusFilter !== 'all') q.set('status', statusFilter)
      if (categoryFilter !== 'all') q.set('category', categoryFilter)
      if (priorityFilter !== 'all') q.set('priority', priorityFilter)
      if (groupFilter !== 'all') q.set('tnpscGroup', groupFilter)
      if (dateFilter) q.set('date', dateFilter)
      if (search.trim()) q.set('search', search.trim())

      const [stRes, listRes, admRes] = await Promise.all([
        apiFetch('/api/admin/support/stats', { headers: authHeaders }),
        apiFetch(`/api/admin/support/tickets?${q.toString()}`, { headers: authHeaders }),
        apiFetch('/api/admin/support/admins', { headers: authHeaders }),
      ])
      const [stJson, listJson, admJson] = await Promise.all([
        stRes.json().catch(() => ({})),
        listRes.json().catch(() => ({})),
        admRes.json().catch(() => ({})),
      ])

      if (stRes.ok && stJson.status === 'success' && stJson.data) {
        setStats(stJson.data)
        onStatsUpdated?.(Number(stJson.data.unreadCount || 0))
      }
      if (listRes.ok && listJson.status === 'success' && listJson.data) {
        setTickets(listJson.data.items || [])
        setTotalFiltered(Number(listJson.data.pagination?.total || 0))
        setTotalPages(Number(listJson.data.pagination?.totalPages || 1))
      }
      if (admRes.ok && admJson.status === 'success' && Array.isArray(admJson.data)) {
        setAdmins(admJson.data)
      }
    } finally {
      setLoading(false)
    }
  }, [authHeaders, page, statusFilter, categoryFilter, priorityFilter, groupFilter, dateFilter, search, onStatsUpdated])

  const toFriendlyError = (rawMsg?: string, fallback = 'Unable to complete the request. Please try again.'): string => {
    const msg = String(rawMsg || '').trim()
    if (!msg) return fallback
    // Never expose raw SQL / PostgreSQL parameter errors to the Admin UI
    if (/inconsistent types|parameter \$\d+|syntax error|relation "|column "|violates |pg_/i.test(msg)) {
      return fallback
    }
    return msg
  }

  const loadTicketDetail = useCallback(
    async (ticketId: number, silent = false) => {
      if (!silent) setLoadingDetail(true)
      try {
        const res = await apiFetch(`/api/admin/support/tickets/${ticketId}`, { headers: authHeaders })
        const json = await res.json().catch(() => ({}))
        if (res.ok && json.status === 'success' && json.data) {
          setDetail(json.data)
        } else if (!silent) {
          setBanner({
            type: 'error',
            text: toFriendlyError(json.message, 'Unable to load complaint details. Please try again.'),
          })
        }
      } catch {
        if (!silent) {
          setBanner({ type: 'error', text: 'Unable to load complaint details. Please try again.' })
        }
      } finally {
        if (!silent) setLoadingDetail(false)
      }
    },
    [authHeaders]
  )

  useEffect(() => {
    void loadListAndStats()
  }, [loadListAndStats])

  // Auto-refresh every 25s
  useEffect(() => {
    const id = window.setInterval(() => {
      if (selectedId) void loadTicketDetail(selectedId, true)
      else void loadListAndStats()
    }, 25000)
    return () => window.clearInterval(id)
  }, [selectedId, loadTicketDetail, loadListAndStats])

  const openTicket = useCallback((ticketId: number) => {
    setSelectedId(ticketId)
    setBanner(null)
    setComposerText('')
    setReplyNextStatus('')
    void loadTicketDetail(ticketId).then(() => loadListAndStats())
  }, [loadTicketDetail, loadListAndStats])

  // Deep-link from global Admin AI Robot notification widget (?ticket=<id>)
  useEffect(() => {
    if (initialTicketId && initialTicketId > 0 && initialTicketId !== selectedId) {
      openTicket(initialTicketId)
    }
  }, [initialTicketId, selectedId, openTicket])

  const handleUpdateStatus = async (nextStatus: string) => {
    if (!selectedId) return
    const res = await apiFetch(`/api/admin/support/tickets/${selectedId}/status`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.status === 'success') {
      setBanner({ type: 'success', text: `Ticket status updated to "${nextStatus}".` })
      await loadTicketDetail(selectedId, true)
      void loadListAndStats()
    } else {
      setBanner({ type: 'error', text: toFriendlyError(json.message, 'Unable to update complaint status. Please try again.') })
    }
  }

  const handleUpdatePriority = async (nextPriority: string) => {
    if (!selectedId) return
    const res = await apiFetch(`/api/admin/support/tickets/${selectedId}/priority`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: nextPriority }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.status === 'success') {
      setBanner({ type: 'success', text: `Priority set to "${nextPriority}".` })
      await loadTicketDetail(selectedId, true)
      void loadListAndStats()
    } else {
      setBanner({ type: 'error', text: toFriendlyError(json.message, 'Unable to update complaint priority. Please try again.') })
    }
  }

  const handleAssignAdmin = async (adminIdStr: string) => {
    if (!selectedId) return
    const assignedAdminId = adminIdStr ? Number(adminIdStr) : null
    const res = await apiFetch(`/api/admin/support/tickets/${selectedId}/assign`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedAdminId }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.status === 'success') {
      setBanner({ type: 'success', text: 'Ticket assignment updated.' })
      await loadTicketDetail(selectedId, true)
      void loadListAndStats()
    } else {
      setBanner({ type: 'error', text: toFriendlyError(json.message, 'Unable to update ticket assignment. Please try again.') })
    }
  }

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId || !composerText.trim()) return
    setSubmitting(true)
    setBanner(null)
    try {
      const url =
        composerMode === 'note'
          ? `/api/admin/support/tickets/${selectedId}/notes`
          : `/api/admin/support/tickets/${selectedId}/reply`
      const payload =
        composerMode === 'note'
          ? { note: composerText.trim() }
          : { message: composerText.trim(), ...(replyNextStatus ? { status: replyNextStatus } : {}) }

      const res = await apiFetch(url, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: toFriendlyError(json.message, 'Unable to send message. Please try again.') })
        return
      }
      setComposerText('')
      setReplyNextStatus('')
      setBanner({
        type: 'success',
        text: composerMode === 'note' ? 'Internal admin note saved (hidden from student).' : 'Reply sent to student.',
      })
      await loadTicketDetail(selectedId, true)
      void loadListAndStats()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-help-root">
      {/* Header */}
      <div className="admin-help-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Headphones size={20} style={{ color: '#ffd700' }} />
            <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800 }}>
              Help Center &amp; Student Complaint Management
            </h2>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
            Review student support tickets, respond in real time, track resolution status, and maintain internal audit records.
          </p>
        </div>
        <button type="button" className="support-btn-secondary" onClick={() => void loadListAndStats()}>
          <RefreshCw size={14} className={loading ? 'spin' : undefined} /> Refresh
        </button>
      </div>

      {/* 6 Real-Time PostgreSQL Summary Cards */}
      <div className="admin-help-kpi-grid">
        {[
          { label: 'Total Complaints', val: stats.total, color: '#f8fafc', filter: 'all' },
          { label: 'New Complaints', val: stats.open, color: '#38bdf8', filter: 'Open' },
          { label: 'In Progress', val: stats.inProgress, color: '#c084fc', filter: 'In Progress' },
          { label: 'Waiting for Student', val: stats.waitingForStudent, color: '#fbbf24', filter: 'Waiting for Student' },
          { label: 'Resolved', val: stats.resolved, color: '#34d399', filter: 'Resolved' },
          { label: 'Closed', val: stats.closed, color: '#94a3b8', filter: 'Closed' },
        ].map((k) => (
          <button
            key={k.label}
            type="button"
            className="admin-help-kpi"
            onClick={() => {
              setSelectedId(null)
              setStatusFilter(k.filter)
              setPage(1)
            }}
          >
            <span className="admin-help-kpi-label">{k.label}</span>
            <span className="admin-help-kpi-val" style={{ color: k.color }}>{k.val}</span>
          </button>
        ))}
      </div>

      {/* New / Unread Complaints Notification Strip */}
      {stats.unreadCount > 0 && !selectedId && (
        <div className="admin-help-unread-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#fde68a', fontSize: '0.84rem', fontWeight: 600 }}>
            <Bell size={16} style={{ color: '#fbbf24' }} />
            <span>
              {stats.unreadCount} ticket{stats.unreadCount === 1 ? '' : 's'} with new student activity:
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {stats.unreadTickets.slice(0, 4).map((ut) => (
              <button
                key={ut.id}
                type="button"
                className="support-btn-secondary"
                style={{ height: '30px', fontSize: '0.74rem', borderColor: 'rgba(255, 215, 0, 0.45)', color: '#fef08a' }}
                onClick={() => openTicket(ut.id)}
              >
                {ut.ticketNumber} • {ut.category}
              </button>
            ))}
          </div>
        </div>
      )}

      {banner && (
        <div className={`support-alert ${banner.type === 'success' ? 'support-alert--success' : 'support-alert--error'}`}>
          {banner.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* DETAIL VIEW OR LIST VIEW */}
      {selectedId && detail ? (
        <div className="admin-help-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
            <button
              type="button"
              className="support-btn-secondary"
              onClick={() => {
                setSelectedId(null)
                setDetail(null)
              }}
            >
              <ArrowLeft size={14} /> Back to All Complaints
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="support-ticket-id">{detail.ticket.ticketNumber}</span>
              <span className={`admin-priority-pill ${priorityClass(detail.ticket.priority)}`}>{detail.ticket.priority}</span>
              <span className={`support-status-badge ${statusClass(detail.ticket.status)}`}>{detail.ticket.status}</span>
            </div>
          </div>

          <div className="admin-detail-grid">
            {/* Left: Ticket Description + Conversation Thread + Reply/Note Composer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(11, 17, 32, 0.85)', border: '1px solid rgba(148, 163, 184, 0.16)' }}>
                <div style={{ fontSize: '1.02rem', fontWeight: 800, color: '#f8fafc' }}>{detail.ticket.subject}</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  {detail.ticket.category} • Submitted {new Date(detail.ticket.createdAt).toLocaleString()}
                </div>
                <p style={{ margin: '0.7rem 0 0', fontSize: '0.86rem', color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                  {detail.ticket.description}
                </p>
              </div>

              {loadingDetail ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>Loading conversation...</div>
              ) : (
                <div className="support-thread">
                  {detail.messages.map((m) => {
                    const msgAtts = detail.attachments.filter((a) => a.messageId === m.id)
                    const timeLabel = (() => {
                      const d = new Date(m.createdAt)
                      if (Number.isNaN(d.getTime())) return ''
                      return d.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })
                    })()
                    return (
                      <div
                        key={m.id}
                        className={`support-msg ${
                          m.isInternalNote
                            ? 'admin-msg-internal'
                            : m.senderRole === 'admin'
                              ? 'support-msg--admin'
                              : 'support-msg--student'
                        }`}
                      >
                        <div className="support-msg-body">{m.message}</div>
                        {msgAtts.map((att) => (
                          <a
                            key={att.id}
                            href={getAuthenticatedApiUrl(att.downloadUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="support-attachment-pill"
                          >
                            <Paperclip size={13} /> {att.originalFilename}
                          </a>
                        ))}
                        <div className="support-msg-time">
                          {m.isInternalNote && (
                            <span className="support-msg-internal-icon" title="Internal Note (Hidden from Student)">
                              <Lock size={11} />
                            </span>
                          )}
                          <span>{timeLabel}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Composer */}
              <form onSubmit={handleSubmitMessage} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`support-tab-btn ${composerMode === 'reply' ? 'active' : ''}`}
                    style={{ height: '34px', fontSize: '0.78rem' }}
                    onClick={() => setComposerMode('reply')}
                  >
                    <Send size={13} /> Reply to Student
                  </button>
                  <button
                    type="button"
                    className={`support-tab-btn ${composerMode === 'note' ? 'active' : ''}`}
                    style={{ height: '34px', fontSize: '0.78rem' }}
                    onClick={() => setComposerMode('note')}
                  >
                    <Lock size={13} /> Add Internal Note
                  </button>
                </div>

                <textarea
                  className="admin-help-textarea"
                  rows={4}
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  placeholder={
                    composerMode === 'note'
                      ? 'Add an internal admin note (never visible to the student)...'
                      : 'Write your response to the student...'
                  }
                  required
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
                  {composerMode === 'reply' ? (
                    <select
                      className="admin-help-select"
                      style={{ width: '210px' }}
                      value={replyNextStatus}
                      onChange={(e) => setReplyNextStatus(e.target.value)}
                    >
                      <option value="">Keep / Auto-update Status</option>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>Set Status: {s}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>
                      Internal notes are strictly hidden from students.
                    </span>
                  )}

                  <button type="submit" className="support-btn-primary" disabled={submitting}>
                    {submitting ? <Loader2 size={14} className="spin" /> : composerMode === 'note' ? <Lock size={14} /> : <Send size={14} />}
                    <span>{composerMode === 'note' ? 'Save Internal Note' : 'Send Reply'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right: Student Info + Controls + Audit Trail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ padding: '0.95rem', borderRadius: '12px', background: 'rgba(11, 17, 32, 0.85)', border: '1px solid rgba(148, 163, 184, 0.16)', display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.82rem' }}>
                <strong style={{ color: '#ffd700', fontSize: '0.78rem', textTransform: 'uppercase' }}>Student Information</strong>
                <div><span style={{ color: '#94a3b8' }}>Name:</span> <strong style={{ color: '#f8fafc' }}>{detail.ticket.studentName}</strong></div>
                <div><span style={{ color: '#94a3b8' }}>Email:</span> <strong style={{ color: '#f8fafc', wordBreak: 'break-word' }}>{detail.ticket.studentEmail}</strong></div>
                <div><span style={{ color: '#94a3b8' }}>TNPSC Group:</span> <strong style={{ color: '#f8fafc' }}>{detail.ticket.tnpscGroup.toUpperCase()}</strong></div>
              </div>

              <div style={{ padding: '0.95rem', borderRadius: '12px', background: 'rgba(11, 17, 32, 0.85)', border: '1px solid rgba(148, 163, 184, 0.16)', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                <strong style={{ color: '#ffd700', fontSize: '0.78rem', textTransform: 'uppercase' }}>Ticket Controls</strong>

                <div>
                  <label className="support-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Status</label>
                  <select className="admin-help-select" value={detail.ticket.status} onChange={(e) => void handleUpdateStatus(e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="support-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Priority</label>
                  <select className="admin-help-select" value={detail.ticket.priority} onChange={(e) => void handleUpdatePriority(e.target.value)}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="support-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Assigned Admin</label>
                  <select
                    className="admin-help-select"
                    value={detail.ticket.assignedAdminId ?? ''}
                    onChange={(e) => void handleAssignAdmin(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {admins.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
                  <button
                    type="button"
                    className="support-btn-secondary"
                    style={{ flex: 1, borderColor: 'rgba(52, 211, 153, 0.4)', color: '#6ee7b7' }}
                    onClick={() => void handleUpdateStatus('Resolved')}
                  >
                    <ShieldCheck size={14} /> Mark Resolved
                  </button>
                  <button
                    type="button"
                    className="support-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => void handleUpdateStatus('Closed')}
                  >
                    Close Ticket
                  </button>
                </div>
              </div>

              {detail.auditLogs.length > 0 && (
                <div style={{ padding: '0.9rem', borderRadius: '12px', background: 'rgba(11, 17, 32, 0.72)', border: '1px solid rgba(148, 163, 184, 0.14)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Audit History</strong>
                  {detail.auditLogs.slice(0, 6).map((l) => (
                    <div key={l.id} style={{ fontSize: '0.73rem', color: '#cbd5e1' }}>
                      <strong>{l.adminUsername}</strong> — {l.action.replace(/_/g, ' ')} ({new Date(l.createdAt).toLocaleString()})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Complaint List Table + Filters */
        <div className="admin-help-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          <div className="admin-help-filters">
            <div style={{ gridColumn: 'span 2' }}>
              <label className="support-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                <Search size={12} /> Search Complaints
              </label>
              <input
                type="text"
                className="admin-help-input"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search Ticket ID, Student Name, Email, or Subject..."
              />
            </div>

            <div>
              <label className="support-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Status</label>
              <select className="admin-help-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
                <option value="all">All Complaints</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="support-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Category</label>
              <select className="admin-help-select" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}>
                <option value="all">All Categories</option>
                {COMPLAINT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="support-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Priority</label>
              <select className="admin-help-select" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}>
                <option value="all">All Priorities</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="support-label" style={{ display: 'block', marginBottom: '0.25rem' }}>TNPSC Group</label>
              <select className="admin-help-select" value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setPage(1) }}>
                <option value="all">All Groups</option>
                <option value="group1">Group 1</option>
                <option value="group2">Group 2 / 2A</option>
                <option value="group4">Group 4 / VAO</option>
              </select>
            </div>

            <div>
              <label className="support-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Submitted Date</label>
              <input
                type="date"
                className="admin-help-input"
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setPage(1) }}
              />
            </div>
          </div>

          <div className="admin-help-table-wrap">
            <table className="admin-help-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Student Name</th>
                  <th>Student Email</th>
                  <th>Group</th>
                  <th>Category</th>
                  <th>Subject</th>
                  <th>Submitted</th>
                  <th>Last Updated</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      Loading complaints...
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      No complaints found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.id} className={t.unreadByAdmin ? 'is-unread' : undefined}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="support-ticket-id">{t.ticketNumber}</span>
                        {t.unreadByAdmin && (
                          <span style={{ marginLeft: '0.35rem', color: '#fbbf24', fontSize: '0.68rem', fontWeight: 800 }}>● NEW</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: '#f8fafc' }}>{t.studentName}</td>
                      <td style={{ color: '#94a3b8', fontSize: '0.76rem' }}>{t.studentEmail}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{t.tnpscGroup.toUpperCase()}</td>
                      <td>{t.category}</td>
                      <td style={{ maxWidth: '220px', fontWeight: 600, color: '#f8fafc' }}>{t.subject}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', color: '#94a3b8' }}>
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', color: '#94a3b8' }}>
                        {new Date(t.updatedAt).toLocaleString()}
                      </td>
                      <td><span className={`admin-priority-pill ${priorityClass(t.priority)}`}>{t.priority}</span></td>
                      <td><span className={`support-status-badge ${statusClass(t.status)}`}>{t.status}</span></td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="support-btn-secondary"
                          style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.7rem' }}
                          onClick={() => openTicket(t.id)}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', fontSize: '0.8rem', color: '#94a3b8' }}>
            <span>Showing <strong>{tickets.length}</strong> of <strong>{totalFiltered}</strong> complaints</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <button type="button" className="support-btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={14} /> Prev
              </button>
              <span>Page <strong>{page}</strong> / {totalPages}</span>
              <button type="button" className="support-btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminHelpCenterPanel
