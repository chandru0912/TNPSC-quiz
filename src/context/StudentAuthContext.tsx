import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/api'

export interface StudentUser {
  id: number
  fullName: string
  email: string
  mobile?: string | null
  targetGroup: string
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
  startStudentPreview: (previewToken: string, previewStudent: StudentUser) => void
  exitStudentPreview: () => void
}

const StudentAuthContext = createContext<StudentAuthContextType | undefined>(undefined)

const TOKEN_KEY = 'tnpsc_student_token'
const USER_KEY = 'tnpsc_student_user'
const PREVIEW_KEY = 'tnpsc_admin_preview_active'

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

  // Standard student login handler
  const login = useCallback((newToken: string, newStudent: StudentUser) => {
    localStorage.removeItem(PREVIEW_KEY)
    setIsPreviewMode(false)
    setToken(newToken)
    setStudent(newStudent)
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newStudent))
  }, [])

  // Standard student logout handler
  const logout = useCallback(() => {
    localStorage.removeItem(PREVIEW_KEY)
    setIsPreviewMode(false)
    setToken(null)
    setStudent(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
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

  // Refresh profile from server
  const refreshProfile = useCallback(async () => {
    const curToken = localStorage.getItem(TOKEN_KEY)
    if (!curToken) {
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
        const updated = { ...json.student, ...(isPreviewActive ? { isPreview: true } : {}) }
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
    refreshProfile()

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [refreshProfile])

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
