import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/api'
import { endVisitorSession, sendSessionHeartbeat } from '../utils/visitorTracker'
import { normalizeStudentAvatarUrl } from '../utils/studentProfile'

export interface StudentUser {
  id: number
  fullName: string
  username?: string | null
  email: string
  mobile?: string | null
  targetGroup: string
  district?: string | null
  avatarUrl?: string | null
  authProvider?: string
  emailVerified?: boolean
  onboardingCompleted?: boolean
  subscriptionTier?: string
  subscriptionStatus?: string
  role?: string
  createdAt?: string
  isPreview?: boolean
}

interface StudentAuthContextType {
  student: StudentUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isPreviewMode: boolean
  login: (token: string, student: StudentUser) => void
  logout: () => void
  refreshProfile: () => Promise<void>
  updateStudentState: (partial: Partial<StudentUser>) => void
  startStudentPreview: (previewToken: string, previewStudent: StudentUser) => void
  exitStudentPreview: () => void
}

const StudentAuthContext = createContext<StudentAuthContextType | undefined>(undefined)

const TOKEN_KEY = 'tnpsc_student_token'
const USER_KEY = 'tnpsc_student_user'
const PREVIEW_KEY = 'tnpsc_admin_preview_active'
const SESSION_REVOKED_MSG_KEY = 'tnpsc_session_revoked_msg'
const DEFAULT_REVOKED_MESSAGE =
  'Your account has been logged in on another device. Please log in again to continue.'

export const StudentAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TOKEN_KEY)
    }
    return null
  })

  const [student, setStudent] = useState<StudentUser | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(USER_KEY)
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch {
          return null
        }
      }
    }
    return null
  })

  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(PREVIEW_KEY) === 'true'
    }
    return false
  })

  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Standard student login handler (clears any previous account state to prevent cross-account leakage)
  const login = useCallback((newToken: string, newStudent: StudentUser) => {
    const normalizedStudent: StudentUser = {
      ...newStudent,
      fullName: String(newStudent.fullName || '').trim() || String(newStudent.email || '').split('@')[0] || 'Student',
      avatarUrl: normalizeStudentAvatarUrl(newStudent.avatarUrl),
    }
    localStorage.removeItem(PREVIEW_KEY)
    localStorage.removeItem('tnpsc_study_tab_leader')
    localStorage.removeItem(USER_KEY)
    setIsPreviewMode(false)
    setToken(newToken)
    setStudent(normalizedStudent)
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(normalizedStudent))
    if (typeof window !== 'undefined') {
      // Associate active visitor session with newly logged-in student immediately
      sendSessionHeartbeat()
    }
  }, [])

  // Standard student logout handler with server-side token & HttpOnly cookie revocation
  const logout = useCallback(() => {
    const curToken = localStorage.getItem(TOKEN_KEY)
    const isPrev = localStorage.getItem(PREVIEW_KEY) === 'true'
    if (!isPrev) {
      if (curToken) {
        endVisitorSession()
      }
      apiFetch('/api/student/logout', {
        method: 'POST',
        headers: curToken
          ? {
              Authorization: `Bearer ${curToken}`,
            }
          : undefined,
        keepalive: true,
      }).catch(() => {
        // Best-effort server revocation; client session is always cleared
      })
    }
    localStorage.removeItem(PREVIEW_KEY)
    localStorage.removeItem('tnpsc_study_tab_leader')
    setIsPreviewMode(false)
    setToken(null)
    setStudent(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }, [])

  // Force immediate local logout & redirect to Login when backend revokes this device's session
  const handleForceSessionRevoked = useCallback((message?: string) => {
    const notice = message || DEFAULT_REVOKED_MESSAGE
    localStorage.removeItem(PREVIEW_KEY)
    localStorage.removeItem('tnpsc_study_tab_leader')
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setIsPreviewMode(false)
    setToken(null)
    setStudent(null)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_REVOKED_MSG_KEY, notice)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login?reason=session_revoked')
      }
    }
  }, [])

  // Start Admin Student Preview Mode
  const startStudentPreview = useCallback((previewToken: string, previewStudent: StudentUser) => {
    localStorage.setItem(PREVIEW_KEY, 'true')
    setIsPreviewMode(true)
    const studentWithFlag = { ...previewStudent, isPreview: true }
    setToken(previewToken)
    setStudent(studentWithFlag)
    localStorage.setItem(TOKEN_KEY, previewToken)
    localStorage.setItem(USER_KEY, JSON.stringify(studentWithFlag))
  }, [])

  // Exit Admin Student Preview Mode and return to Admin Dashboard
  const exitStudentPreview = useCallback(() => {
    localStorage.removeItem(PREVIEW_KEY)
    setIsPreviewMode(false)
    setToken(null)
    setStudent(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    // Seamlessly navigate back to Admin Portal
    window.location.href = '/admin'
  }, [])

  // Immediately synchronize student profile changes (e.g. Name, Username) across React state & localStorage
  const updateStudentState = useCallback((partial: Partial<StudentUser>) => {
    setStudent((prev) => {
      if (!prev) return prev
      const merged: StudentUser = {
        ...prev,
        ...partial,
        fullName:
          partial.fullName !== undefined
            ? String(partial.fullName || '').trim() || prev.fullName
            : prev.fullName,
        avatarUrl:
          partial.avatarUrl !== undefined
            ? normalizeStudentAvatarUrl(partial.avatarUrl)
            : prev.avatarUrl,
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(USER_KEY, JSON.stringify(merged))
        window.dispatchEvent(new CustomEvent('tnpsc:student-profile-updated', { detail: merged }))
      }
      return merged
    })
  }, [])

  // Refresh profile from server
  const refreshProfile = useCallback(async () => {
    const curToken = localStorage.getItem(TOKEN_KEY)
    const isPreviewActive = localStorage.getItem(PREVIEW_KEY) === 'true'
    if (!curToken || (isPreviewActive && curToken === 'preview_admin_token')) {
      setIsLoading(false)
      return
    }

    try {
      const res = await apiFetch('/api/student/profile', {
        headers: {
          Authorization: `Bearer ${curToken}`,
        },
      })
      const json = await res.json()
      if (res.ok && json.status === 'success' && json.student) {
        const isPreviewActive = localStorage.getItem(PREVIEW_KEY) === 'true'
        const updated: StudentUser = {
          ...json.student,
          fullName: String(json.student.fullName || '').trim() || String(json.student.email || '').split('@')[0] || 'Student',
          avatarUrl: normalizeStudentAvatarUrl(json.student.avatarUrl),
          ...(isPreviewActive ? { isPreview: true } : {}),
        }
        setStudent(updated)
        localStorage.setItem(USER_KEY, JSON.stringify(updated))
      } else {
        // Token invalid or expired
        logout()
      }
    } catch {
      // In case of network error, preserve local cache
    } finally {
      setIsLoading(false)
    }
  }, [logout])

  // Sync token changes across multiple browser tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        if (!e.newValue) {
          setToken(null)
          setStudent(null)
          setIsPreviewMode(false)
        } else {
          setToken(e.newValue)
          refreshProfile()
        }
      }
      if (e.key === PREVIEW_KEY) {
        setIsPreviewMode(e.newValue === 'true')
      }
    }

    window.addEventListener('storage', handleStorageChange)
    const handleRevokedEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<{ code?: string; message?: string }>).detail
      handleForceSessionRevoked(detail?.message)
    }
    window.addEventListener('tnpsc:student-session-revoked', handleRevokedEvent)
    refreshProfile()

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('tnpsc:student-session-revoked', handleRevokedEvent)
    }
  }, [refreshProfile, handleForceSessionRevoked])

  // Real-time SSE listener for instant logout when another device signs into this account
  useEffect(() => {
    if (!token || isPreviewMode || typeof EventSource === 'undefined') return
    let es: EventSource | null = null
    let reconnectTimer: number | null = null
    let closed = false

    const connect = () => {
      if (closed) return
      try {
        es = new EventSource(`/api/student/session-stream?token=${encodeURIComponent(token)}`)
        es.addEventListener('session_revoked', (ev: MessageEvent) => {
          try {
            const payload = JSON.parse(ev.data || '{}')
            handleForceSessionRevoked(payload.message || DEFAULT_REVOKED_MESSAGE)
          } catch {
            handleForceSessionRevoked(DEFAULT_REVOKED_MESSAGE)
          }
        })
        es.onerror = () => {
          es?.close()
          if (closed) return
          reconnectTimer = window.setTimeout(connect, 10000)
        }
      } catch {
        // Fallback: backend still enforces session validity on every API request
      }
    }

    connect()
    return () => {
      closed = true
      es?.close()
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
    }
  }, [token, isPreviewMode, handleForceSessionRevoked])

  return (
    <StudentAuthContext.Provider
      value={{
        student,
        token,
        isAuthenticated: Boolean(token && student),
        isLoading,
        isPreviewMode,
        login,
        logout,
        refreshProfile,
        updateStudentState,
        startStudentPreview,
        exitStudentPreview,
      }}
    >
      {children}
    </StudentAuthContext.Provider>
  )
}

export const useStudentAuth = (): StudentAuthContextType => {
  const context = useContext(StudentAuthContext)
  if (!context) {
    throw new Error('useStudentAuth must be used within a StudentAuthProvider')
  }
  return context
}
