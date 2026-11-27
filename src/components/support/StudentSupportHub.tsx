import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Headphones,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  RefreshCw,
  Send,
  Ticket,
} from 'lucide-react'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { apiFetch, getAuthenticatedApiUrl } from '../../utils/api'
import { resolveStudentDisplayName } from '../../utils/studentProfile'
import { SupportFileUpload } from './SupportFileUpload'
import './StudentSupportHub.css'

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
] as const

interface SupportTicketSummary {
  id: number
  ticketNumber: string
  category: string
  subject: string
  description: string
  priority: string
  status: string
  unreadByStudent: boolean
  lastAdminReply?: string | null
  messageCount?: number
  createdAt: string
  updatedAt: string
}

interface SupportMessageItem {
  id: number
  ticketId: number
  senderName: string
  senderRole: 'student' | 'admin'
  message: string
  createdAt: string
}

interface SupportAttachmentItem {
  id: number
  messageId: number | null
  originalFilename: string
  mimeType: string
  fileSize: number
  downloadUrl: string
}

function formatChatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function statusBadgeClass(status: string): string {
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

export const StudentSupportHub: React.FC = () => {
  const navigate = useNavigate()
  const { student, token, isAuthenticated, isPreviewMode } = useStudentAuth()

  const [activeTab, setActiveTab] = useState<'raise' | 'tickets'>('raise')
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Raise Complaint form state
  const [category, setCategory] = useState<string>(COMPLAINT_CATEGORIES[0])
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submittedTicket, setSubmittedTicket] = useState<{ ticketNumber: string; id: number } | null>(null)

  // Ticket detail & conversation state
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [ticketDetail, setTicketDetail] = useState<{
    ticket: SupportTicketSummary
    messages: SupportMessageItem[]
    attachments: SupportAttachmentItem[]
  } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyFile, setReplyFile] = useState<File | null>(null)
  const [sendingReply, setSendingReply] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)

  const threadRef = useRef<HTMLDivElement | null>(null)
  const isNearBottomRef = useRef(true)
  const shouldForceScrollRef = useRef(false)
  const prevMessageCountRef = useRef(0)

  const displayName = resolveStudentDisplayName(isAuthenticated ? student : null)

  const fetchTickets = useCallback(async () => {
    if (!isAuthenticated || !token) return
    setLoadingTickets(true)
    try {
      const res = await apiFetch('/api/support/tickets', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.status === 'success' && Array.isArray(json.data)) {
        setTickets(json.data)
        setUnreadCount(json.data.filter((t: SupportTicketSummary) => t.unreadByStudent).length)
      }
    } finally {
      setLoadingTickets(false)
    }
  }, [isAuthenticated, token])

  const fetchTicketDetail = useCallback(
    async (ticketId: number, silent = false) => {
      if (!isAuthenticated || !token) return
      if (!silent) setLoadingDetail(true)
      try {
        const res = await apiFetch(`/api/support/tickets/${ticketId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json().catch(() => null)
        if (res.ok && json?.status === 'success' && json.data) {
          setTicketDetail(json.data)
          setTickets((prev) =>
            prev.map((t) => (t.id === ticketId ? { ...t, unreadByStudent: false, status: json.data.ticket.status } : t))
          )
          setUnreadCount((prev) => Math.max(0, prev - 1))
        }
      } finally {
        if (!silent) setLoadingDetail(false)
      }
    },
    [isAuthenticated, token]
  )

  useEffect(() => {
    void fetchTickets()
  }, [fetchTickets])

  // Poll for admin replies every 20s while viewing a ticket
  useEffect(() => {
    if (!selectedTicketId || !isAuthenticated || !token) return
    shouldForceScrollRef.current = true
    isNearBottomRef.current = true
    prevMessageCountRef.current = 0
    const id = window.setInterval(() => {
      void fetchTicketDetail(selectedTicketId, true)
    }, 20000)
    return () => window.clearInterval(id)
  }, [selectedTicketId, isAuthenticated, token, fetchTicketDetail])

  // Smart auto-scroll: scroll to latest message on ticket open, student send, or when already near bottom
  const messageCount = ticketDetail?.messages?.length ?? 0
  useEffect(() => {
    if (!selectedTicketId || !ticketDetail || loadingDetail) return
    const el = threadRef.current
    if (!el) return

    const hasNewMessages = messageCount > prevMessageCountRef.current
    if (shouldForceScrollRef.current || (hasNewMessages && isNearBottomRef.current)) {
      const behavior: ScrollBehavior = prevMessageCountRef.current === 0 ? 'auto' : 'smooth'
      window.requestAnimationFrame(() => {
        if (threadRef.current) {
          threadRef.current.scrollTo({ top: threadRef.current.scrollHeight, behavior })
        }
      })
      shouldForceScrollRef.current = false
    }
    prevMessageCountRef.current = messageCount
  }, [selectedTicketId, ticketDetail, loadingDetail, messageCount])

  const handleThreadScroll = () => {
    const el = threadRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isNearBottomRef.current = distanceFromBottom <= 80
  }

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setFormError(null)
    setSubmittedTicket(null)

    const cleanSubject = subject.trim()
    const cleanDesc = description.trim()
    if (cleanSubject.length < 4) {
      setFormError('Please enter a subject (at least 4 characters).')
      return
    }
    if (cleanDesc.length < 10) {
      setFormError('Please provide a detailed description (at least 10 characters).')
      return
    }
    if (attachmentFile && attachmentFile.size > 5 * 1024 * 1024) {
      setFormError('Attachment must be 5 MB or smaller.')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('category', category)
      formData.append('subject', cleanSubject)
      formData.append('description', cleanDesc)
      if (attachmentFile) formData.append('attachment', attachmentFile)

      const res = await apiFetch('/api/support/tickets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setFormError(json.message || 'Could not submit your complaint. Please try again.')
        return
      }

      const created = json.data?.ticket
      setSubmittedTicket({ ticketNumber: created.ticketNumber, id: created.id })
      setSubject('')
      setDescription('')
      setAttachmentFile(null)
      void fetchTickets()
    } catch (err: any) {
      setFormError(err?.message || 'Network error while submitting complaint.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !selectedTicketId) return
    const cleanMsg = replyText.trim()
    if (!cleanMsg) {
      setReplyError('Please enter a reply message.')
      return
    }
    if (replyFile && replyFile.size > 5 * 1024 * 1024) {
      setReplyError('Attachment must be 5 MB or smaller.')
      return
    }

    setSendingReply(true)
    setReplyError(null)
    try {
      const formData = new FormData()
      formData.append('message', cleanMsg)
      if (replyFile) formData.append('attachment', replyFile)

      const res = await apiFetch(`/api/support/tickets/${selectedTicketId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setReplyError(json.message || 'Failed to send reply.')
        return
      }
      setReplyText('')
      setReplyFile(null)
      shouldForceScrollRef.current = true
      await fetchTicketDetail(selectedTicketId, true)
      void fetchTickets()
    } catch (err: any) {
      setReplyError(err?.message || 'Error sending reply.')
    } finally {
      setSendingReply(false)
    }
  }

  return (
    <section className="support-hub-card" aria-label="Contact Support and Raise a Complaint">
      <div className="support-hub-header">
        <h2 className="support-hub-title">
          <Headphones size={20} style={{ color: '#ffd700' }} />
          <span>Contact Support / Raise a Complaint</span>
        </h2>

        <div className="support-hub-tabs">
          <button
            type="button"
            className={`support-tab-btn ${activeTab === 'raise' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('raise')
              setSelectedTicketId(null)
            }}
          >
            <MessageSquarePlus size={15} />
            <span>Raise a Complaint</span>
          </button>
          <button
            type="button"
            className={`support-tab-btn ${activeTab === 'tickets' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('tickets')
              void fetchTickets()
            }}
          >
            <Ticket size={15} />
            <span>My Support Tickets ({tickets.length})</span>
            {unreadCount > 0 && <span className="support-unread-pill">{unreadCount}</span>}
          </button>
        </div>
      </div>

      {!isAuthenticated || !student ? (
        <div
          style={{
            padding: '1rem 1.15rem',
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.68)',
            border: '1px solid rgba(148, 163, 184, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.85rem',
          }}
        >
          <span style={{ color: '#cbd5e1', fontSize: '0.86rem' }}>
            Please sign in with your verified Google Account to submit a complaint and track support replies.
          </span>
          <button type="button" className="support-btn-primary" onClick={() => navigate('/login')}>
            Sign In to Contact Support
          </button>
        </div>
      ) : activeTab === 'raise' ? (
        <>
          <div className="support-student-meta-strip">
            <span>Student: <strong>{displayName}</strong></span>
            <span>Email: <strong>{student.email}</strong></span>
            <span>TNPSC Group: <strong>{(student.targetGroup || 'group4').toUpperCase()}</strong></span>
            <span>Date: <strong>{new Date().toLocaleDateString()}</strong></span>
          </div>

          {submittedTicket && (
            <div className="support-alert support-alert--success">
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div>
                  Your complaint has been submitted successfully. Our support team will review your request.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span>Ticket ID: <strong className="support-ticket-id">{submittedTicket.ticketNumber}</strong></span>
                  <button
                    type="button"
                    className="support-btn-secondary"
                    style={{ height: '30px', fontSize: '0.76rem' }}
                    onClick={() => {
                      setActiveTab('tickets')
                      setSelectedTicketId(submittedTicket.id)
                      void fetchTicketDetail(submittedTicket.id)
                    }}
                  >
                    View Ticket
                  </button>
                </div>
              </div>
            </div>
          )}

          {formError && (
            <div className="support-alert support-alert--error">
              <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{formError}</span>
            </div>
          )}

          <form className="support-form" onSubmit={handleSubmitComplaint}>
            <div className="support-field">
              <label className="support-label" htmlFor="support-category">Complaint Category *</label>
              <select
                id="support-category"
                className="support-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                {COMPLAINT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="support-field">
              <label className="support-label" htmlFor="support-subject">Subject *</label>
              <input
                id="support-subject"
                type="text"
                className="support-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the issue"
                maxLength={200}
                required
              />
            </div>

            <div className="support-field">
              <label className="support-label" htmlFor="support-desc">Detailed Description *</label>
              <textarea
                id="support-desc"
                className="support-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue clearly, including the page or exam section affected..."
                maxLength={5000}
                required
              />
            </div>

            <div className="support-field">
              <label className="support-label" htmlFor="support-attachment">
                Supporting Attachment (Optional)
              </label>
              <SupportFileUpload
                id="support-attachment"
                file={attachmentFile}
                onChange={setAttachmentFile}
                disabled={submitting || isPreviewMode}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="support-btn-primary" disabled={submitting || isPreviewMode}>
                {submitting ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                <span>{submitting ? 'Submitting...' : 'Submit Complaint'}</span>
              </button>
            </div>
          </form>
        </>
      ) : selectedTicketId && ticketDetail ? (
        /* Ticket Conversation View */
        <div className="support-chat-shell">
          <div className="support-chat-topbar">
            <button
              type="button"
              className="support-btn-secondary"
              onClick={() => {
                setSelectedTicketId(null)
                setTicketDetail(null)
              }}
            >
              <ArrowLeft size={14} /> Back to My Tickets
            </button>
            <button
              type="button"
              className="support-btn-secondary"
              onClick={() => void fetchTicketDetail(selectedTicketId)}
              title="Refresh conversation"
              aria-label="Refresh conversation"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          <div className="support-chat-header-card">
            <div className="support-chat-header-subject">{ticketDetail.ticket.subject}</div>
            <div className="support-chat-header-meta">
              {ticketDetail.ticket.category} • Submitted {new Date(ticketDetail.ticket.createdAt).toLocaleString()} • Updated {new Date(ticketDetail.ticket.updatedAt).toLocaleString()}
            </div>
          </div>

          {loadingDetail ? (
            <div className="support-chat-loading">Loading conversation...</div>
          ) : (
            <div
              ref={threadRef}
              onScroll={handleThreadScroll}
              className="support-thread support-thread--chat"
            >
              {ticketDetail.messages.map((m) => {
                const msgAttachments = ticketDetail.attachments.filter((a) => a.messageId === m.id)
                return (
                  <div
                    key={m.id}
                    className={`support-msg ${m.senderRole === 'admin' ? 'support-msg--admin' : 'support-msg--student'}`}
                  >
                    <div className="support-msg-body">{m.message}</div>
                    {msgAttachments.map((att) => (
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
                    <div className="support-msg-time">{formatChatTime(m.createdAt)}</div>
                  </div>
                )
              })}
            </div>
          )}

          {ticketDetail.ticket.status !== 'Closed' ? (
            <form onSubmit={handleSendReply} className="support-reply-composer">
              <textarea
                className="support-textarea"
                style={{ minHeight: '80px' }}
                value={replyText}
                onChange={(e) => {
                  setReplyText(e.target.value)
                  setReplyError(null)
                }}
                placeholder="Write a reply or provide additional information..."
                maxLength={4000}
              />
              <div className="support-reply-footer">
                <div className="support-reply-upload-slot">
                  <SupportFileUpload
                    id="support-reply-attachment"
                    file={replyFile}
                    onChange={setReplyFile}
                    disabled={sendingReply || isPreviewMode}
                    compact
                  />
                </div>
                <button type="submit" className="support-btn-primary" disabled={sendingReply || isPreviewMode}>
                  {sendingReply ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                  <span>{sendingReply ? 'Sending...' : 'Send Reply'}</span>
                </button>
              </div>
              {replyError && (
                <div className="support-alert support-alert--error">
                  <AlertCircle size={15} /> <span>{replyError}</span>
                </div>
              )}
            </form>
          ) : (
            <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic', flexShrink: 0 }}>
              This ticket is closed. Raise a new complaint if you need further assistance.
            </div>
          )}
        </div>
      ) : (
        /* My Support Tickets List */
        <div className="support-ticket-list">
          {loadingTickets ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>Loading your support tickets...</div>
          ) : tickets.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>
              You have not submitted any complaints yet. Click <strong>Raise a Complaint</strong> to contact support.
            </div>
          ) : (
            tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`support-ticket-card ${t.unreadByStudent ? 'support-ticket-card--unread' : ''}`}
                onClick={() => {
                  setSelectedTicketId(t.id)
                  void fetchTicketDetail(t.id)
                }}
              >
                <div className="support-ticket-top">
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="support-ticket-id">{t.ticketNumber}</span>
                    {t.unreadByStudent && (
                      <span className="support-unread-pill" style={{ width: 'auto', padding: '0 7px' }}>
                        New Admin Reply
                      </span>
                    )}
                  </div>
                  <span className={`support-status-badge ${statusBadgeClass(t.status)}`}>{t.status}</span>
                </div>
                <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.94rem' }}>{t.subject}</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  {t.category} • Submitted {new Date(t.createdAt).toLocaleDateString()} • Last Updated {new Date(t.updatedAt).toLocaleString()}
                </div>
                {t.lastAdminReply && (
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: '#6ee7b7',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(52, 211, 153, 0.22)',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Admin Response: {t.lastAdminReply}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </section>
  )
}

export default StudentSupportHub
