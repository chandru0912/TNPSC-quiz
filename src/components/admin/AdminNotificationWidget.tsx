import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell,
  BellOff,
  Bot,
  CheckCheck,
  Clock,
  ExternalLink,
  History,
  Settings,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { apiFetch, getApiUrl } from '../../utils/api'
import './AdminNotificationWidget.css'

export interface AdminNotificationItem {
  id: number
  ticketId: number
  ticketNumber: string
  studentName: string
  category: string
  subject: string
  notificationType: 'NEW_COMPLAINT' | 'STUDENT_REPLY'
  ticketStatus: string
  isRead: boolean
  readAt: string | null
  resolvedAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface AdminNotificationsResponse {
  unreadCount: number
  activeNotifications: AdminNotificationItem[]
  recentlyResolved: AdminNotificationItem[]
  history: AdminNotificationItem[]
  counts: {
    newComplaints: number
    inProgress: number
    waitingForStudent: number
    resolved: number
  }
}

interface NotificationPrefs {
  soundEnabled: boolean
  desktopEnabled: boolean
  showUnreadBadge: boolean
}

type PanelTab = 'new' | 'in_progress' | 'waiting' | 'resolved' | 'history'

interface AdminNotificationWidgetProps {
  token: string
  onOpenTicket: (ticketId: number) => void
  onUnreadCountChange?: (count: number) => void
}

const PREFS_KEY = 'tnpsc_admin_robot_notif_prefs_v1'

function loadPrefs(): NotificationPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        soundEnabled: parsed.soundEnabled !== false,
        desktopEnabled: Boolean(parsed.desktopEnabled),
        showUnreadBadge: parsed.showUnreadBadge !== false,
      }
    }
  } catch {
    // ignore
  }
  return { soundEnabled: true, desktopEnabled: false, showUnreadBadge: true }
}

function playSubtleNotificationChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()

    osc1.type = 'sine'
    osc2.type = 'triangle'
    osc1.frequency.setValueAtTime(784, now) // G5
    osc1.frequency.setValueAtTime(1046.5, now + 0.11) // C6
    osc2.frequency.setValueAtTime(523.25, now) // C5

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34)

    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)

    osc1.start(now)
    osc2.start(now)
    osc1.stop(now + 0.36)
    osc2.stop(now + 0.36)
    window.setTimeout(() => {
      ctx.close().catch(() => {})
    }, 500)
  } catch {
    // autoplay may be blocked until first user interaction
  }
}

function formatShortTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (sameDay) return timeStr
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${timeStr}`
}

function statusPillClass(status: string): string {
  switch (status) {
    case 'In Progress':
      return 'anotif-status--progress'
    case 'Waiting for Student':
      return 'anotif-status--waiting'
    case 'Resolved':
    case 'Closed':
      return 'anotif-status--resolved'
    default:
      return 'anotif-status--new'
  }
}

export const AdminNotificationWidget: React.FC<AdminNotificationWidgetProps> = ({
  token,
  onOpenTicket,
  onUnreadCountChange,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<PanelTab>('new')
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => loadPrefs())
  const [sseConnected, setSseConnected] = useState(false)
  const [pulseActive, setPulseActive] = useState(false)

  const [data, setData] = useState<AdminNotificationsResponse>({
    unreadCount: 0,
    activeNotifications: [],
    recentlyResolved: [],
    history: [],
    counts: { newComplaints: 0, inProgress: 0, waitingForStudent: 0, resolved: 0 },
  })
  const [liveToast, setLiveToast] = useState<AdminNotificationItem | null>(null)

  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  const seenIdsRef = useRef<Set<number>>(new Set())
  const initialLoadedRef = useRef(false)
  const toastTimerRef = useRef<number | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // Save prefs
  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      // ignore
    }
  }, [prefs])

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const fetchNotifications = useCallback(async () => {
    if (!token) return
    try {
      const res = await apiFetch('/api/admin/support/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.status === 'success' && json.data) {
        const next = json.data as AdminNotificationsResponse
        if (!initialLoadedRef.current) {
          // Seed existing notification IDs so page refresh never replays sounds or toasts
          next.history.forEach((n) => seenIdsRef.current.add(n.id))
          initialLoadedRef.current = true
        }
        setData(next)
        onUnreadCountChange?.(next.unreadCount)
      }
    } catch {
      // silent retry on next SSE event or poll
    }
  }, [token, onUnreadCountChange])

  // Initial fetch + gentle 30s fallback poll
  useEffect(() => {
    void fetchNotifications()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchNotifications()
      }
    }, 30000)
    return () => window.clearInterval(timer)
  }, [fetchNotifications])

  // Authenticated SSE stream with auto-reconnect
  useEffect(() => {
    if (!token) return
    let es: EventSource | null = null
    let reconnectTimer: number | null = null
    let retryDelay = 3000
    let disposed = false

    const connect = () => {
      if (disposed) return
      const baseUrl = getApiUrl('/api/admin/support/notifications/stream')
      const sep = baseUrl.includes('?') ? '&' : '?'
      const streamUrl = `${baseUrl}${sep}token=${encodeURIComponent(token)}`

      try {
        es = new EventSource(streamUrl)
      } catch {
        return
      }

      es.addEventListener('connected', () => {
        setSseConnected(true)
        retryDelay = 3000
      })

      es.addEventListener('admin_notification', (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(ev.data)
          const notif = parsed?.notification as AdminNotificationItem | undefined
          if (!notif || typeof notif.id !== 'number') return

          const isBrandNew = !seenIdsRef.current.has(notif.id)
          seenIdsRef.current.add(notif.id)

          void fetchNotifications()

          if (isBrandNew) {
            setPulseActive(true)
            window.setTimeout(() => setPulseActive(false), 3200)

            setLiveToast(notif)
            if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
            toastTimerRef.current = window.setTimeout(() => setLiveToast(null), 9000)

            if (prefsRef.current.soundEnabled) {
              playSubtleNotificationChime()
            }

            if (
              prefsRef.current.desktopEnabled &&
              typeof Notification !== 'undefined' &&
              Notification.permission === 'granted'
            ) {
              const title =
                notif.notificationType === 'STUDENT_REPLY'
                  ? 'New Student Reply Received'
                  : 'New Student Complaint Received'
              try {
                new Notification(title, {
                  body: `${notif.studentName} • ${notif.category}\n${notif.subject} (${notif.ticketNumber})`,
                })
              } catch {
                // ignore desktop notification errors
              }
            }
          }
        } catch {
          // ignore parse errors
        }
      })

      es.addEventListener('admin_notifications_sync', () => {
        void fetchNotifications()
      })

      es.onerror = () => {
        setSseConnected(false)
        if (es) {
          es.close()
          es = null
        }
        if (!disposed) {
          reconnectTimer = window.setTimeout(() => {
            retryDelay = Math.min(retryDelay * 2, 15000)
            connect()
          }, retryDelay)
        }
      }
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
      if (es) es.close()
    }
  }, [token, fetchNotifications])

  const handleOpenNotification = async (item: AdminNotificationItem) => {
    setIsOpen(false)
    setShowSettings(false)
    setLiveToast(null)
    if (!item.isRead) {
      try {
        await apiFetch(`/api/admin/support/notifications/${item.id}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        })
        void fetchNotifications()
      } catch {
        // continue navigation even if mark-read fails transiently
      }
    }
    onOpenTicket(item.ticketId)
  }

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/admin/support/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      void fetchNotifications()
    } catch {
      // ignore
    }
  }

  const handleClearResolved = async () => {
    try {
      await apiFetch('/api/admin/support/notifications/clear-resolved', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      void fetchNotifications()
    } catch {
      // ignore
    }
  }

  const handleToggleDesktopNotifications = async () => {
    if (prefs.desktopEnabled) {
      setPrefs((p) => ({ ...p, desktopEnabled: false }))
      return
    }
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'granted') {
      setPrefs((p) => ({ ...p, desktopEnabled: true }))
      return
    }
    if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        setPrefs((p) => ({ ...p, desktopEnabled: true }))
      }
    }
  }

  const tabItems = useMemo(() => {
    switch (activeTab) {
      case 'new':
        return data.activeNotifications.filter((n) => n.ticketStatus === 'Open')
      case 'in_progress':
        return data.activeNotifications.filter((n) => n.ticketStatus === 'In Progress')
      case 'waiting':
        return data.activeNotifications.filter((n) => n.ticketStatus === 'Waiting for Student')
      case 'resolved':
        return data.recentlyResolved
      case 'history':
        return data.history
    }
  }, [activeTab, data])

  const hasUnread = data.unreadCount > 0

  const content = (
    <div className="anotif-portal-root" ref={panelRef}>
      {/* Floating AI Robot Button at Top-Right (safely below top header) */}
      <button
        type="button"
        className={`anotif-robot-btn ${hasUnread ? 'has-unread' : ''} ${pulseActive ? 'is-pulsing' : ''} ${
          isOpen ? 'is-open' : ''
        }`}
        onClick={() => {
          setIsOpen((prev) => !prev)
          setShowSettings(false)
          if (!isOpen) void fetchNotifications()
        }}
        title={
          hasUnread
            ? `${data.unreadCount} unread student complaint notification${data.unreadCount > 1 ? 's' : ''}`
            : 'AI Support Notification Assistant'
        }
        aria-label="Admin AI Support Notifications"
        aria-expanded={isOpen}
      >
        <span className="anotif-robot-ring" aria-hidden="true" />
        <Bot size={21} className="anotif-robot-icon" />
        {prefs.showUnreadBadge && hasUnread && (
          <span className="anotif-badge">{data.unreadCount > 99 ? '99+' : data.unreadCount}</span>
        )}
      </button>

      {/* Live Toast Alert for Incoming Student Complaint / Reply */}
      {liveToast && !isOpen && (
        <div className="anotif-toast" role="alert">
          <div className="anotif-toast-header">
            <span className="anotif-toast-title">
              <Sparkles size={14} className="anotif-cyan-icon" />
              {liveToast.notificationType === 'STUDENT_REPLY'
                ? 'New Student Reply Received'
                : 'New Student Complaint Received'}
            </span>
            <button
              type="button"
              className="anotif-icon-mini"
              onClick={() => setLiveToast(null)}
              aria-label="Dismiss toast"
            >
              <X size={13} />
            </button>
          </div>
          <div className="anotif-toast-body">
            <div><strong>Student:</strong> {liveToast.studentName}</div>
            <div><strong>Category:</strong> {liveToast.category}</div>
            <div className="anotif-toast-subject"><strong>Subject:</strong> {liveToast.subject}</div>
            <div className="anotif-toast-meta">
              <span className="anotif-ticket-code">{liveToast.ticketNumber}</span>
              <span>{formatShortTime(liveToast.createdAt)}</span>
            </div>
          </div>
          <button
            type="button"
            className="anotif-toast-action"
            onClick={() => void handleOpenNotification(liveToast)}
          >
            <span>View Complaint</span>
            <ExternalLink size={13} />
          </button>
        </div>
      )}

      {/* Dropdown Notification Center */}
      {isOpen && (
        <section className="anotif-dropdown" role="dialog" aria-label="Admin Complaint Notifications">
          <header className="anotif-dropdown-header">
            <div className="anotif-dropdown-title-wrap">
              <span className="anotif-dropdown-bot">
                <Bot size={17} />
              </span>
              <div>
                <div className="anotif-dropdown-title">
                  AI Support Alerts
                  <span className={`anotif-live-dot ${sseConnected ? 'is-live' : ''}`} title={sseConnected ? 'Live SSE Connected' : 'Reconnecting...'} />
                </div>
                <div className="anotif-dropdown-sub">
                  {hasUnread ? `${data.unreadCount} unread active alert${data.unreadCount > 1 ? 's' : ''}` : 'All caught up'}
                </div>
              </div>
            </div>

            <div className="anotif-dropdown-controls">
              {hasUnread && (
                <button
                  type="button"
                  className="anotif-icon-mini"
                  onClick={() => void handleMarkAllRead()}
                  title="Mark all as read"
                  aria-label="Mark all as read"
                >
                  <CheckCheck size={14} />
                </button>
              )}
              <button
                type="button"
                className={`anotif-icon-mini ${showSettings ? 'is-active' : ''}`}
                onClick={() => setShowSettings((s) => !s)}
                title="Notification settings"
                aria-label="Notification settings"
              >
                <Settings size={14} />
              </button>
              <button
                type="button"
                className="anotif-icon-mini"
                onClick={() => setIsOpen(false)}
                title="Close"
                aria-label="Close notifications"
              >
                <X size={14} />
              </button>
            </div>
          </header>

          {/* Preferences Drawer */}
          {showSettings && (
            <div className="anotif-settings-box">
              <button
                type="button"
                className="anotif-setting-row"
                onClick={() => setPrefs((p) => ({ ...p, soundEnabled: !p.soundEnabled }))}
              >
                <span>
                  {prefs.soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  Notification Sound
                </span>
                <strong className={prefs.soundEnabled ? 'is-on' : ''}>{prefs.soundEnabled ? 'ON' : 'OFF'}</strong>
              </button>

              <button
                type="button"
                className="anotif-setting-row"
                onClick={() => void handleToggleDesktopNotifications()}
              >
                <span>
                  {prefs.desktopEnabled ? <Bell size={14} /> : <BellOff size={14} />}
                  Desktop Notifications
                </span>
                <strong className={prefs.desktopEnabled ? 'is-on' : ''}>{prefs.desktopEnabled ? 'ON' : 'OFF'}</strong>
              </button>

              <button
                type="button"
                className="anotif-setting-row"
                onClick={() => setPrefs((p) => ({ ...p, showUnreadBadge: !p.showUnreadBadge }))}
              >
                <span>Show Unread Count Badge</span>
                <strong className={prefs.showUnreadBadge ? 'is-on' : ''}>{prefs.showUnreadBadge ? 'ON' : 'OFF'}</strong>
              </button>

              <div className="anotif-settings-actions">
                <button type="button" className="anotif-mini-btn" onClick={() => void handleMarkAllRead()}>
                  <CheckCheck size={13} /> Mark All Read
                </button>
                <button type="button" className="anotif-mini-btn" onClick={() => void handleClearResolved()}>
                  <Trash2 size={13} /> Clear Resolved
                </button>
              </div>
            </div>
          )}

          {/* Lifecycle Filter Tabs */}
          <div className="anotif-tabs">
            <button
              type="button"
              className={`anotif-tab ${activeTab === 'new' ? 'active is-cyan' : ''}`}
              onClick={() => setActiveTab('new')}
            >
              New ({data.counts.newComplaints})
            </button>
            <button
              type="button"
              className={`anotif-tab ${activeTab === 'in_progress' ? 'active is-purple' : ''}`}
              onClick={() => setActiveTab('in_progress')}
            >
              In Progress ({data.counts.inProgress})
            </button>
            <button
              type="button"
              className={`anotif-tab ${activeTab === 'waiting' ? 'active is-gold' : ''}`}
              onClick={() => setActiveTab('waiting')}
            >
              Waiting ({data.counts.waitingForStudent})
            </button>
            <button
              type="button"
              className={`anotif-tab ${activeTab === 'resolved' ? 'active is-green' : ''}`}
              onClick={() => setActiveTab('resolved')}
            >
              Resolved ({data.counts.resolved})
            </button>
            <button
              type="button"
              className={`anotif-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
              title="Full Notification History"
            >
              <History size={12} /> History
            </button>
          </div>

          {/* Notification List */}
          <div className="anotif-list">
            {tabItems.length === 0 ? (
              <div className="anotif-empty">
                No notifications in this category.
              </div>
            ) : (
              tabItems.map((item) => (
                <div
                  key={item.id}
                  className={`anotif-item ${!item.isRead && item.isActive ? 'is-unread' : ''}`}
                  onClick={() => void handleOpenNotification(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      void handleOpenNotification(item)
                    }
                  }}
                >
                  <div className="anotif-item-top">
                    <span className="anotif-ticket-code">{item.ticketNumber}</span>
                    <span className={`anotif-status-pill ${statusPillClass(item.ticketStatus)}`}>
                      {item.ticketStatus}
                    </span>
                  </div>

                  <div className="anotif-item-student">
                    <span>{item.studentName}</span>
                    {item.notificationType === 'STUDENT_REPLY' && (
                      <span className="anotif-reply-tag">New Reply</span>
                    )}
                  </div>

                  <div className="anotif-item-subject">{item.subject}</div>

                  <div className="anotif-item-footer">
                    <span className="anotif-item-time">
                      <Clock size={11} /> {formatShortTime(item.createdAt)}
                    </span>
                    <span className="anotif-view-link">
                      View Details <ExternalLink size={11} />
                    </span>
                  </div>

                  {activeTab === 'history' && (
                    <div className="anotif-history-meta">
                      <span>Type: {item.notificationType === 'STUDENT_REPLY' ? 'Student Reply' : 'New Complaint'}</span>
                      {item.readAt && <span>Read: {formatShortTime(item.readAt)}</span>}
                      {item.resolvedAt && <span>Resolved: {formatShortTime(item.resolvedAt)}</span>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}

export default AdminNotificationWidget
