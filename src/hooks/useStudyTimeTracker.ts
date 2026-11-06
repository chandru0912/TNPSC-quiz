import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useStudentAuth } from '../context/StudentAuthContext'
import { apiFetch } from '../utils/api'

const HEARTBEAT_INTERVAL_MS = 30_000 // 30 seconds
const IDLE_TIMEOUT_MS = 120_000 // 2 minutes idle cutoff
const LEADER_KEY = 'tnpsc_study_tab_leader'

export function useStudyTimeTracker() {
  const { token, isAuthenticated } = useStudentAuth()
  const location = useLocation()

  const tabIdRef = useRef<string>(
    typeof window !== 'undefined'
      ? `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      : 'tab_ssr'
  )
  const lastActiveTimeRef = useRef<number>(Date.now())
  const isHiddenRef = useRef<boolean>(false)
  const isIdleRef = useRef<boolean>(false)

  // Track user activity to prevent idle time counting
  useEffect(() => {
    if (!isAuthenticated) return

    const handleUserActivity = () => {
      lastActiveTimeRef.current = Date.now()
      if (isIdleRef.current) {
        isIdleRef.current = false
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isHiddenRef.current = true
      } else {
        isHiddenRef.current = false
        lastActiveTimeRef.current = Date.now()
        isIdleRef.current = false
      }
    }

    window.addEventListener('mousemove', handleUserActivity, { passive: true })
    window.addEventListener('keydown', handleUserActivity, { passive: true })
    window.addEventListener('scroll', handleUserActivity, { passive: true })
    window.addEventListener('touchstart', handleUserActivity, { passive: true })
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('mousemove', handleUserActivity)
      window.removeEventListener('keydown', handleUserActivity)
      window.removeEventListener('scroll', handleUserActivity)
      window.removeEventListener('touchstart', handleUserActivity)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated])

  // Periodic active heartbeat & multi-tab coordination
  useEffect(() => {
    if (!isAuthenticated || !token) return

    const tabId = tabIdRef.current

    // Check if this tab is eligible to be the heartbeat leader
    const checkLeaderEligibility = (): boolean => {
      if (document.hidden) return false
      const now = Date.now()

      try {
        const rawLeader = localStorage.getItem(LEADER_KEY)
        if (!rawLeader) {
          // No current leader; claim leadership
          localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId, timestamp: now }))
          return true
        }

        const leader = JSON.parse(rawLeader)
        // If this tab is the leader, or previous leader's heartbeat expired (> 45s ago)
        if (leader.tabId === tabId || now - leader.timestamp > 45_000) {
          localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId, timestamp: now }))
          return true
        }

        // Another tab is active and holds leadership
        return false
      } catch {
        return true
      }
    }

    const sendHeartbeat = async (deltaSeconds: number) => {
      if (deltaSeconds <= 0) return
      try {
        await apiFetch('/api/student/study-session/heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sessionToken: tabId,
            pagePath: window.location.pathname,
            deltaSeconds,
          }),
        })
      } catch (err) {
        // Silently handle heartbeat network glitches
        console.warn('[StudyTimeTracker] Heartbeat sync failed:', err)
      }
    }

    const intervalId = setInterval(() => {
      const now = Date.now()

      // Check if user is idle (> 2 minutes without interaction)
      if (now - lastActiveTimeRef.current > IDLE_TIMEOUT_MS) {
        isIdleRef.current = true
      }

      // If tab is hidden or user is idle, do not accumulate study time
      if (isHiddenRef.current || isIdleRef.current) {
        return
      }

      // Check multi-tab leader
      const isLeader = checkLeaderEligibility()
      if (!isLeader) {
        return
      }

      // Send 30 seconds active study heartbeat
      sendHeartbeat(30)
    }, HEARTBEAT_INTERVAL_MS)

    // Send final beacon on page close / unload
    const handleUnload = () => {
      const now = Date.now()
      if (!isHiddenRef.current && !isIdleRef.current && now - lastActiveTimeRef.current < IDLE_TIMEOUT_MS) {
        try {
          const leaderRaw = localStorage.getItem(LEADER_KEY)
          if (leaderRaw) {
            const leader = JSON.parse(leaderRaw)
            if (leader.tabId === tabId) {
              localStorage.removeItem(LEADER_KEY)
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    window.addEventListener('beforeunload', handleUnload)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [isAuthenticated, token, location.pathname])
}
