const SYNC_CHANNEL_NAME = 'tnpsc_student_sync'
const SYNC_EVENT_NAME = 'tnpsc:student-sync'

export function notifyStudentSync(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME))
  } catch {
    // Ignore
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(SYNC_CHANNEL_NAME)
      ch.postMessage({ type: 'refresh', ts: Date.now() })
      ch.close()
    }
  } catch {
    // Ignore
  }
}

export function subscribeStudentSync(onSync: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleWindowEvent = () => onSync()
  window.addEventListener(SYNC_EVENT_NAME, handleWindowEvent)

  let channel: BroadcastChannel | null = null
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(SYNC_CHANNEL_NAME)
      channel.onmessage = () => onSync()
    }
  } catch {
    channel = null
  }

  return () => {
    window.removeEventListener(SYNC_EVENT_NAME, handleWindowEvent)
    if (channel) {
      channel.close()
    }
  }
}
