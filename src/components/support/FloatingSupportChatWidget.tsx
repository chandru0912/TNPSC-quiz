import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileImage,
  FileText,
  Headphones,
  Loader2,
  MessageSquarePlus,
  Minus,
  Paperclip,
  RefreshCw,
  Send,
  Ticket,
  X,
} from 'lucide-react'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { apiFetch, getAuthenticatedApiUrl } from '../../utils/api'
import './FloatingSupportChatWidget.css'

const QUICK_ACTIONS = [
  { label: 'Account & Login Issues', category: 'Account & Login Issues' },
  { label: 'Study Materials Issues', category: 'Study Materials Issues' },
  { label: 'MCQ Practice Issues', category: 'MCQ Practice Issues' },
  { label: 'Mock Test Issues', category: 'Mock Test Issues' },
  { label: 'Subscription & Payment Issues', category: 'Subscription & Payment Issues' },
  { label: 'Technical Support', category: 'Technical Problems' },
  { label: 'Other Questions', category: 'Other Issues' },
] as const

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf']
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'application/pdf'])
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024 // 5 MB

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

interface PersistedWidgetState {
  selectedTicketId: number | null
  selectedCategory: string | null
  subjectDraft: string
  messageDraft: string
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

function formatLastUpdated(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return formatChatTime(iso)
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + formatChatTime(iso)
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function validateAttachment(file: File): string | null {
  const lower = file.name.toLowerCase()
  const validExt = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))
  const validMime = !file.type || ALLOWED_MIMES.has(file.type)
  if (!validExt || !validMime) {
    return 'Unsupported file type. Upload PNG, JPG, JPEG, or PDF.'
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return 'File is too large. Maximum allowed size is 5 MB.'
  }
  return null
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'In Progress':
      return 'fchat-status--in-progress'
    case 'Waiting for Student':
      return 'fchat-status--waiting'
    case 'Resolved':
      return 'fchat-status--resolved'
    case 'Closed':
      return 'fchat-status--closed'
    default:
      return 'fchat-status--open'
  }
}

export const FloatingSupportChatWidget: React.FC = () => {
  const navigate = useNavigate()
  const { student, token, isAuthenticated, isPreviewMode } = useStudentAuth()

  const storageKey = student?.id ? `tnpsc_support_chat_state_${student.id}` : 'tnpsc_support_chat_state_guest'

  const [isOpen, setIsOpen] = useState(false)
  const [activeView, setActiveView] = useState<'chat' | 'tickets'>('chat')
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)

  // Tickets & active conversation
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [ticketDetail, setTicketDetail] = useState<{
    ticket: SupportTicketSummary
    messages: SupportMessageItem[]
    attachments: SupportAttachmentItem[]
  } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // New complaint & message draft state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [subjectDraft, setSubjectDraft] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [confirmationBanner, setConfirmationBanner] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)
  const isNearBottomRef = useRef(true)
  const shouldForceScrollRef = useRef(false)
  const prevMsgCountRef = useRef(0)
  const hydratedKeyRef = useRef<string | null>(null)

  // Hydrate persisted conversation state & drafts per student
  useEffect(() => {
    if (hydratedKeyRef.current === storageKey) return
    hydratedKeyRef.current = storageKey
    try {
      const raw = window.sessionStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<PersistedWidgetState>
      if (typeof parsed.selectedTicketId === 'number') setSelectedTicketId(parsed.selectedTicketId)
      if (typeof parsed.selectedCategory === 'string') setSelectedCategory(parsed.selectedCategory)
      if (typeof parsed.subjectDraft === 'string') setSubjectDraft(parsed.subjectDraft)
      if (typeof parsed.messageDraft === 'string') setMessageDraft(parsed.messageDraft)
    } catch {
      // ignore storage errors
    }
  }, [storageKey])

  // Persist active conversation & unsent drafts
  useEffect(() => {
    try {
      const payload: PersistedWidgetState = {
        selectedTicketId,
        selectedCategory,
        subjectDraft,
        messageDraft,
      }
      window.sessionStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      // ignore storage errors
    }
  }, [storageKey, selectedTicketId, selectedCategory, subjectDraft, messageDraft])

  // Track real online/offline status + support API availability
  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    let cancelled = false
    apiFetch('/api/support/categories')
      .then((res) => {
        if (!cancelled) setIsOnline(res.ok && navigator.onLine)
      })
      .catch(() => {
        if (!cancelled) setIsOnline(false)
      })

    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

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
        setIsOnline(true)
      }
    } catch {
      setIsOnline(navigator.onLine)
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
          setTickets((prev) => {
            const updated = prev.map((t) =>
              t.id === ticketId ? { ...t, unreadByStudent: false, status: json.data.ticket.status } : t
            )
            setUnreadCount(updated.filter((t) => t.unreadByStudent).length)
            return updated
          })
          setIsOnline(true)
        } else if (res.status === 404) {
          setSelectedTicketId(null)
          setTicketDetail(null)
        }
      } catch {
        setIsOnline(navigator.onLine)
      } finally {
        if (!silent) setLoadingDetail(false)
      }
    },
    [isAuthenticated, token]
  )

  // Initial ticket list fetch for unread badge
  useEffect(() => {
    void fetchTickets()
  }, [fetchTickets])

  // Load selected ticket when widget opens or selectedTicketId changes
  useEffect(() => {
    if (!isOpen || !selectedTicketId || !isAuthenticated || !token) return
    shouldForceScrollRef.current = true
    isNearBottomRef.current = true
    prevMsgCountRef.current = 0
    void fetchTicketDetail(selectedTicketId, Boolean(ticketDetail && ticketDetail.ticket.id === selectedTicketId))

    const intervalId = window.setInterval(() => {
      void fetchTicketDetail(selectedTicketId, true)
    }, 15000)
    return () => window.clearInterval(intervalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedTicketId, isAuthenticated, token, fetchTicketDetail])

  // Smart auto-scroll inside chat thread
  const messageCount = ticketDetail?.messages?.length ?? 0
  useEffect(() => {
    if (!isOpen || activeView !== 'chat' || !selectedTicketId || !ticketDetail || loadingDetail) return
    const el = threadRef.current
    if (!el) return

    const hasNew = messageCount > prevMsgCountRef.current
    if (shouldForceScrollRef.current || (hasNew && isNearBottomRef.current)) {
      const behavior: ScrollBehavior = prevMsgCountRef.current === 0 ? 'auto' : 'smooth'
      window.requestAnimationFrame(() => {
        if (threadRef.current) {
          threadRef.current.scrollTo({ top: threadRef.current.scrollHeight, behavior })
        }
      })
      shouldForceScrollRef.current = false
    }
    prevMsgCountRef.current = messageCount
  }, [isOpen, activeView, selectedTicketId, ticketDetail, loadingDetail, messageCount])

  const handleThreadScroll = () => {
    const el = threadRef.current
    if (!el) return
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 80
  }

  const handleFilePick = (file: File | null | undefined) => {
    if (!file) return
    const err = validateAttachment(file)
    if (err) {
      setErrorMsg(err)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setErrorMsg(null)
    setAttachedFile(file)
  }

  const handleRemoveFile = () => {
    setAttachedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleStartNewChat = () => {
    setSelectedTicketId(null)
    setTicketDetail(null)
    setSelectedCategory(null)
    setSubjectDraft('')
    setErrorMsg(null)
    setConfirmationBanner(null)
    setActiveView('chat')
  }

  const handleOpenExistingTicket = (ticketId: number) => {
    setSelectedTicketId(ticketId)
    setConfirmationBanner(null)
    setErrorMsg(null)
    setActiveView('chat')
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated || !token || sending || isPreviewMode) return

    const cleanMessage = messageDraft.trim()
    setErrorMsg(null)

    if (!cleanMessage) {
      setErrorMsg('Please type your message before sending.')
      return
    }

    // 1. Continuing an existing support ticket conversation (no duplicate ticket)
    if (selectedTicketId && ticketDetail) {
      setSending(true)
      try {
        const formData = new FormData()
        formData.append('message', cleanMessage)
        if (attachedFile) formData.append('attachment', attachedFile)

        const res = await apiFetch(`/api/support/tickets/${selectedTicketId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.status !== 'success') {
          setErrorMsg(json.message || 'Unable to send reply. Please try again.')
          return
        }

        setMessageDraft('')
        handleRemoveFile()
        shouldForceScrollRef.current = true
        await fetchTicketDetail(selectedTicketId, true)
        void fetchTickets()
      } catch {
        setErrorMsg('Network error while sending reply. Please check your connection.')
      } finally {
        setSending(false)
      }
      return
    }

    // 2. Creating a new support ticket in PostgreSQL
    const chosenCategory = selectedCategory || 'Other Issues'
    const rawSubject = subjectDraft.trim() || cleanMessage.split(/\r?\n/)[0].slice(0, 120)
    const finalSubject = rawSubject.length >= 4 ? rawSubject : `${chosenCategory} Request`

    if (cleanMessage.length < 10) {
      setErrorMsg('Please provide a few more details (at least 10 characters) so our team can assist you.')
      return
    }

    setSending(true)
    try {
      const formData = new FormData()
      formData.append('category', chosenCategory)
      formData.append('subject', finalSubject)
      formData.append('description', cleanMessage)
      if (attachedFile) formData.append('attachment', attachedFile)

      const res = await apiFetch('/api/support/tickets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success' || !json.data?.ticket) {
        setErrorMsg(json.message || 'Unable to submit your complaint. Please try again.')
        return
      }

      const createdTicket = json.data.ticket as SupportTicketSummary
      setMessageDraft('')
      setSubjectDraft('')
      setSelectedCategory(null)
      handleRemoveFile()
      setConfirmationBanner(
        `Ticket ${createdTicket.ticketNumber} created. Our support team will reply here soon.`
      )
      setSelectedTicketId(createdTicket.id)
      shouldForceScrollRef.current = true
      await fetchTicketDetail(createdTicket.id)
      void fetchTickets()
    } catch {
      setErrorMsg('Network error while submitting complaint. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!sending && messageDraft.trim()) {
        void handleSend(e as unknown as React.FormEvent)
      }
    }
  }

  const isClosedTicket = Boolean(selectedTicketId && ticketDetail && ticketDetail.ticket.status === 'Closed')
  const isPdfAttachment = attachedFile
    ? attachedFile.type === 'application/pdf' || attachedFile.name.toLowerCase().endsWith('.pdf')
    : false

  const widgetContent = (
    <div className="fchat-portal-root" aria-live="polite">
      {/* Floating Chat Window */}
      {isOpen && (
        <section
          className="fchat-window"
          role="dialog"
          aria-label="TNPSC Aspirant Orbit Support Chat"
        >
          {/* Header */}
          <header className="fchat-header">
            <div className="fchat-header-left">
              <span className="fchat-header-icon" aria-hidden="true">
                <Headphones size={18} />
              </span>
              <div className="fchat-header-titles">
                <div className="fchat-header-title-row">
                  <h2 className="fchat-header-title">TNPSC Aspirant Orbit Support</h2>
                  <span
                    className={`fchat-presence-pill ${isOnline ? 'is-online' : 'is-offline'}`}
                    title={isOnline ? 'Support is online' : 'Currently offline'}
                  >
                    <span className="fchat-presence-dot" />
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="fchat-header-subtitle">We are here to help you.</p>
              </div>
            </div>

            <div className="fchat-header-actions">
              <button
                type="button"
                className="fchat-icon-btn"
                onClick={() => setIsOpen(false)}
                title="Minimize chat"
                aria-label="Minimize chat"
              >
                <Minus size={15} />
              </button>
              <button
                type="button"
                className="fchat-icon-btn"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                aria-label="Close chat"
              >
                <X size={15} />
              </button>
            </div>
          </header>

          {/* Compact Navigation Tabs */}
          {isAuthenticated && student && (
            <div className="fchat-nav-bar">
              <button
                type="button"
                className={`fchat-nav-tab ${activeView === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveView('chat')}
              >
                <MessageSquarePlus size={14} />
                <span>Support Chat</span>
              </button>
              <button
                type="button"
                className={`fchat-nav-tab ${activeView === 'tickets' ? 'active' : ''}`}
                onClick={() => {
                  setActiveView('tickets')
                  void fetchTickets()
                }}
              >
                <Ticket size={14} />
                <span>My Support Tickets ({tickets.length})</span>
                {unreadCount > 0 && <span className="fchat-unread-badge">{unreadCount}</span>}
              </button>
            </div>
          )}

          {/* Body */}
          {!isAuthenticated || !student ? (
            <div className="fchat-auth-gate">
              <div className="fchat-bubble fchat-bubble--support">
                <div className="fchat-bubble-body">
                  Hello! Welcome to TNPSC Aspirant Orbit Support. How can we help you today?
                </div>
                <div className="fchat-bubble-time">{formatChatTime(new Date().toISOString())}</div>
              </div>
              <div className="fchat-auth-card">
                <p>Sign in with your verified Google Account to chat with support, submit complaints, and track replies.</p>
                <button
                  type="button"
                  className="fchat-primary-btn"
                  onClick={() => {
                    setIsOpen(false)
                    navigate('/login')
                  }}
                >
                  Sign In to Chat Support
                </button>
              </div>
            </div>
          ) : activeView === 'tickets' ? (
            /* My Support Tickets View */
            <div className="fchat-tickets-view">
              <div className="fchat-tickets-toolbar">
                <button
                  type="button"
                  className="fchat-secondary-btn"
                  onClick={handleStartNewChat}
                >
                  <MessageSquarePlus size={14} />
                  <span>New Complaint</span>
                </button>
                <button
                  type="button"
                  className="fchat-icon-btn"
                  onClick={() => void fetchTickets()}
                  title="Refresh tickets"
                  aria-label="Refresh tickets"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              <div className="fchat-tickets-list">
                {loadingTickets ? (
                  <div className="fchat-empty-state">Loading your support tickets...</div>
                ) : tickets.length === 0 ? (
                  <div className="fchat-empty-state">
                    You have not submitted any support tickets yet. Start a conversation to reach our team.
                  </div>
                ) : (
                  tickets.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`fchat-ticket-item ${t.unreadByStudent ? 'is-unread' : ''} ${
                        selectedTicketId === t.id ? 'is-active' : ''
                      }`}
                      onClick={() => handleOpenExistingTicket(t.id)}
                    >
                      <div className="fchat-ticket-item-top">
                        <span className="fchat-ticket-code">{t.ticketNumber}</span>
                        <span className={`fchat-status-pill ${statusBadgeClass(t.status)}`}>{t.status}</span>
                      </div>
                      <div className="fchat-ticket-subject">{t.subject}</div>
                      <div className="fchat-ticket-meta">
                        <span>{t.category}</span>
                        <span>Updated {formatLastUpdated(t.updatedAt)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Active Chat OR Welcome / New Complaint View */
            <div className="fchat-chat-shell">
              {/* Sub-header when viewing an active ticket */}
              {selectedTicketId && ticketDetail && (
                <div className="fchat-active-ticket-bar">
                  <button
                    type="button"
                    className="fchat-icon-btn"
                    onClick={handleStartNewChat}
                    title="Start new conversation"
                    aria-label="Start new conversation"
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <div className="fchat-active-ticket-info">
                    <div className="fchat-active-ticket-subject" title={ticketDetail.ticket.subject}>
                      {ticketDetail.ticket.subject}
                    </div>
                    <div className="fchat-active-ticket-sub">
                      {ticketDetail.ticket.category}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="fchat-icon-btn"
                    onClick={() => void fetchTicketDetail(selectedTicketId)}
                    title="Refresh messages"
                    aria-label="Refresh messages"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              )}

              {/* Scrollable Messages Area */}
              <div
                ref={threadRef}
                onScroll={handleThreadScroll}
                className="fchat-messages-scroll"
              >
                {selectedTicketId ? (
                  loadingDetail ? (
                    <div className="fchat-empty-state">Loading conversation...</div>
                  ) : ticketDetail ? (
                    <>
                      {confirmationBanner && (
                        <div className="fchat-confirm-banner">
                          <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                          <span>{confirmationBanner}</span>
                        </div>
                      )}
                      {ticketDetail.messages.map((m) => {
                        const msgAttachments = ticketDetail.attachments.filter((a) => a.messageId === m.id)
                        return (
                          <div
                            key={m.id}
                            className={`fchat-bubble ${
                              m.senderRole === 'admin' ? 'fchat-bubble--support' : 'fchat-bubble--student'
                            }`}
                          >
                            <div className="fchat-bubble-body">{m.message}</div>
                            {msgAttachments.map((att) => (
                              <a
                                key={att.id}
                                href={getAuthenticatedApiUrl(att.downloadUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="fchat-attachment-link"
                              >
                                <Paperclip size={12} />
                                <span>{att.originalFilename}</span>
                              </a>
                            ))}
                            <div className="fchat-bubble-time">{formatChatTime(m.createdAt)}</div>
                          </div>
                        )
                      })}
                    </>
                  ) : null
                ) : (
                  /* Welcome Message + Quick Actions */
                  <>
                    <div className="fchat-bubble fchat-bubble--support">
                      <div className="fchat-bubble-body">
                        Hello! Welcome to TNPSC Aspirant Orbit Support. How can we help you today?
                      </div>
                      <div className="fchat-bubble-time">{formatChatTime(new Date().toISOString())}</div>
                    </div>

                    <div className="fchat-quick-actions" role="group" aria-label="Support topics">
                      {QUICK_ACTIONS.map((item) => {
                        const isSelected = selectedCategory === item.category
                        return (
                          <button
                            key={item.label}
                            type="button"
                            className={`fchat-quick-chip ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => {
                              setSelectedCategory(item.category)
                              setErrorMsg(null)
                            }}
                          >
                            {item.label}
                          </button>
                        )
                      })}
                    </div>

                    {selectedCategory && (
                      <div className="fchat-compose-meta-card">
                        <div className="fchat-compose-meta-top">
                          <span className="fchat-selected-cat-pill">{selectedCategory}</span>
                          <button
                            type="button"
                            className="fchat-link-btn"
                            onClick={() => setSelectedCategory(null)}
                          >
                            Clear
                          </button>
                        </div>
                        <input
                          type="text"
                          className="fchat-subject-input"
                          value={subjectDraft}
                          onChange={(e) => setSubjectDraft(e.target.value)}
                          placeholder="Subject (optional — brief title of your issue)"
                          maxLength={200}
                          disabled={sending || isPreviewMode}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Error Banner */}
              {errorMsg && (
                <div className="fchat-error-bar" role="alert">
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Bottom Composer */}
              {isClosedTicket ? (
                <div className="fchat-closed-footer">
                  <span>This support ticket is closed.</span>
                  <button type="button" className="fchat-secondary-btn" onClick={handleStartNewChat}>
                    Start New Chat
                  </button>
                </div>
              ) : (
                <form className="fchat-composer" onSubmit={handleSend}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                    style={{ display: 'none' }}
                    disabled={sending || isPreviewMode}
                    onChange={(e) => handleFilePick(e.target.files?.[0])}
                  />

                  {attachedFile && (
                    <div className="fchat-attached-preview">
                      <span className="fchat-attached-icon">
                        {isPdfAttachment ? <FileText size={14} /> : <FileImage size={14} />}
                      </span>
                      <span className="fchat-attached-name" title={attachedFile.name}>
                        {attachedFile.name} ({formatFileSize(attachedFile.size)})
                      </span>
                      <button
                        type="button"
                        className="fchat-attached-remove"
                        onClick={handleRemoveFile}
                        aria-label="Remove attachment"
                        title="Remove attachment"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  <div className="fchat-input-row">
                    <button
                      type="button"
                      className="fchat-attach-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending || isPreviewMode}
                      title="Attach image or PDF (max 5 MB)"
                      aria-label="Attach image or PDF"
                    >
                      <Paperclip size={16} />
                    </button>

                    <textarea
                      className="fchat-textarea"
                      rows={1}
                      value={messageDraft}
                      onChange={(e) => {
                        setMessageDraft(e.target.value)
                        if (errorMsg) setErrorMsg(null)
                      }}
                      onKeyDown={handleTextareaKeyDown}
                      placeholder={
                        selectedTicketId
                          ? 'Type your reply...'
                          : 'Describe your issue or type a message...'
                      }
                      maxLength={4000}
                      disabled={sending || isPreviewMode}
                    />

                    <button
                      type="submit"
                      className="fchat-send-btn"
                      disabled={sending || isPreviewMode || !messageDraft.trim()}
                      title="Send message"
                      aria-label="Send message"
                    >
                      {sending ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>
      )}

      {/* Floating Chat Support Button */}
      <button
        type="button"
        className={`fchat-launcher-btn ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Minimize Chat Support' : 'Open Chat Support'}
      >
        <span className="fchat-launcher-icon" aria-hidden="true">
          {isOpen ? <X size={18} /> : <Headphones size={18} />}
        </span>
        <span className="fchat-launcher-text">Chat Support</span>
        {unreadCount > 0 && !isOpen && (
          <span className="fchat-launcher-badge" aria-label={`${unreadCount} unread replies`}>
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(widgetContent, document.body)
}

export default FloatingSupportChatWidget
