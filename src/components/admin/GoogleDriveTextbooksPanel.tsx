import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  FolderSearch,
  History,
  Loader2,
  RefreshCw,
  Unplug,
} from 'lucide-react'
import { apiFetch } from '../../utils/api'

type DriveUiStatus =
  | 'NOT_CONNECTED'
  | 'AUTHORIZATION_REQUIRED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'SYNCING'
  | 'SYNC_COMPLETED'
  | 'SYNC_FAILED'
  | 'TOKEN_EXPIRED'
  | 'REAUTHORIZATION_REQUIRED'

interface DriveStatusData {
  status: DriveUiStatus
  connected: boolean
  configured: boolean
  accountEmail: string | null
  accountName: string | null
  folderId: string | null
  folderName: string
  redirectUri: string
  scopes: string[]
  lastSyncAt: string | null
  lastError: string | null
  counts: {
    synchronizedTextbooks: number
    pendingReview: number
    published: number
    missingInDrive: number
    failedSyncRuns: number
  }
}

interface SyncLogRow {
  id: number
  admin_username: string | null
  folder_name: string | null
  status: string
  discovered_count: number
  inserted_count: number
  updated_count: number
  unchanged_count: number
  missing_count: number
  failed_count: number
  error_details: string | null
  started_at: string
  completed_at: string | null
}

interface Props {
  token: string
  onSyncCompleted?: () => void
}

const STATUS_BADGE_STYLE: Record<DriveUiStatus, { bg: string; color: string; border: string }> = {
  NOT_CONNECTED: { bg: 'rgba(148,163,184,0.16)', color: '#cbd5e1', border: 'rgba(148,163,184,0.35)' },
  AUTHORIZATION_REQUIRED: { bg: 'rgba(245,158,11,0.16)', color: '#fbbf24', border: 'rgba(245,158,11,0.4)' },
  CONNECTING: { bg: 'rgba(56,189,248,0.16)', color: '#38bdf8', border: 'rgba(56,189,248,0.4)' },
  CONNECTED: { bg: 'rgba(16,185,129,0.16)', color: '#34d399', border: 'rgba(16,185,129,0.4)' },
  SYNCING: { bg: 'rgba(56,189,248,0.16)', color: '#38bdf8', border: 'rgba(56,189,248,0.4)' },
  SYNC_COMPLETED: { bg: 'rgba(16,185,129,0.16)', color: '#34d399', border: 'rgba(16,185,129,0.4)' },
  SYNC_FAILED: { bg: 'rgba(239,68,68,0.16)', color: '#fca5a5', border: 'rgba(239,68,68,0.4)' },
  TOKEN_EXPIRED: { bg: 'rgba(245,158,11,0.18)', color: '#fbbf24', border: 'rgba(245,158,11,0.45)' },
  REAUTHORIZATION_REQUIRED: { bg: 'rgba(239,68,68,0.18)', color: '#fca5a5', border: 'rgba(239,68,68,0.45)' },
}

export const GoogleDriveTextbooksPanel: React.FC<Props> = ({ token, onSyncCompleted }) => {
  const [statusData, setStatusData] = useState<DriveStatusData | null>(null)
  const [localStatus, setLocalStatus] = useState<DriveUiStatus | null>(null)
  const [folderName, setFolderName] = useState('TNPSC Study Hub Textbooks')
  const [loading, setLoading] = useState(true)
  const [syncLogs, setSyncLogs] = useState<SyncLogRow[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/drive/status', { headers: authHeaders })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.status === 'success' && json.data) {
        setStatusData(json.data)
        if (json.data.folderName) setFolderName(json.data.folderName)
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Unable to load Google Drive status.' })
    } finally {
      setLoading(false)
    }
  }, [token])

  const fetchSyncLogs = useCallback(async () => {
    try {
      const res = await apiFetch('/api/drive/sync-logs?limit=15', { headers: authHeaders })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.status === 'success' && Array.isArray(json.data)) {
        setSyncLogs(json.data)
      }
    } catch {
      // ignore transient log fetch errors
    }
  }, [token])

  useEffect(() => {
    // Handle OAuth callback return query parameters on /admin/textbook-management
    const params = new URLSearchParams(window.location.search)
    const driveStatusParam = params.get('drive_status')
    const driveErrorParam = params.get('drive_error')
    const emailParam = params.get('email')

    if (driveStatusParam === 'connected') {
      setBanner({
        type: 'success',
        text: `Google Drive Connected${emailParam ? ` (${emailParam})` : ''}. You can now sync textbook metadata.`,
      })
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (driveStatusParam === 'error' || driveErrorParam) {
      setBanner({
        type: 'error',
        text: driveErrorParam || 'Google Drive authorization failed.',
      })
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    void fetchStatus()
    void fetchSyncLogs()
  }, [fetchStatus, fetchSyncLogs])

  const handleConnect = async () => {
    setBanner(null)
    setLocalStatus('CONNECTING')
    try {
      const originParam = encodeURIComponent(window.location.origin)
      const res = await apiFetch(`/api/drive/oauth/start?origin=${originParam}`, {
        headers: authHeaders,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success' || !json.data?.authUrl) {
        setLocalStatus(null)
        setBanner({
          type: 'error',
          text: json.message || 'Could not start Google Drive OAuth authorization.',
        })
        return
      }
      window.location.href = json.data.authUrl
    } catch (err: any) {
      setLocalStatus(null)
      setBanner({ type: 'error', text: err?.message || 'Failed to start Google Drive connection.' })
    }
  }

  const handleSync = async () => {
    setBanner(null)
    setLocalStatus('SYNCING')
    try {
      const res = await apiFetch('/api/drive/sync', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName: folderName.trim() || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setLocalStatus(json.uiStatus || 'SYNC_FAILED')
        setBanner({ type: 'error', text: json.message || 'Google Drive sync failed.' })
        void fetchStatus()
        void fetchSyncLogs()
        return
      }

      const d = json.data
      setLocalStatus('SYNC_COMPLETED')
      setBanner({
        type: 'success',
        text: `Sync complete: ${d.discoveredCount} PDFs discovered (${d.insertedCount} new, ${d.updatedCount} updated, ${d.unchangedCount} unchanged, ${d.missingCount} missing).`,
      })
      await Promise.all([fetchStatus(), fetchSyncLogs()])
      onSyncCompleted?.()
    } catch (err: any) {
      setLocalStatus('SYNC_FAILED')
      setBanner({ type: 'error', text: err?.message || 'Sync request failed.' })
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Drive? Original files in Google Drive and existing textbook records will NOT be deleted.')) {
      return
    }
    setBanner(null)
    try {
      const res = await apiFetch('/api/drive/disconnect', {
        method: 'POST',
        headers: authHeaders,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Failed to disconnect Google Drive.' })
        return
      }
      setLocalStatus('NOT_CONNECTED')
      setBanner({ type: 'success', text: 'Google Drive disconnected.' })
      void fetchStatus()
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Disconnect failed.' })
    }
  }

  const effectiveStatus: DriveUiStatus = localStatus || statusData?.status || 'NOT_CONNECTED'
  const badgeStyle = STATUS_BADGE_STYLE[effectiveStatus]
  const isBusy = effectiveStatus === 'CONNECTING' || effectiveStatus === 'SYNCING'

  return (
    <div
      className="glass"
      style={{
        padding: '1.15rem 1.3rem',
        borderRadius: '14px',
        border: '1px solid rgba(255, 215, 0, 0.24)',
        marginBottom: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
      }}
    >
      {/* Top Row: Identity, Status & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
            <Cloud size={18} style={{ color: '#ffd700' }} />
            <strong style={{ color: '#f8fafc', fontSize: '0.98rem' }}>Google Drive Textbooks</strong>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.16rem 0.6rem',
                borderRadius: '9999px',
                background: badgeStyle.bg,
                color: badgeStyle.color,
                border: `1px solid ${badgeStyle.border}`,
              }}
            >
              {loading ? 'CHECKING...' : effectiveStatus}
            </span>
          </div>
          <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: '#94a3b8', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span>
              Account:{' '}
              <strong style={{ color: statusData?.accountEmail ? '#e2e8f0' : '#94a3b8' }}>
                {statusData?.accountEmail || 'Not connected'}
              </strong>
            </span>
            <span>
              Last Sync:{' '}
              <strong style={{ color: '#cbd5e1' }}>
                {statusData?.lastSyncAt ? new Date(statusData.lastSyncAt).toLocaleString() : 'Never'}
              </strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Drive textbook folder"
            aria-label="Google Drive textbook folder name"
            style={{
              padding: '0.45rem 0.7rem',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#f8fafc',
              fontSize: '0.8rem',
              width: '215px',
            }}
          />

          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={isBusy}
            onClick={() => void handleConnect()}
          >
            {effectiveStatus === 'CONNECTING' ? <Loader2 size={14} className="spin-icon" /> : <Cloud size={14} />}
            <span>
              {statusData?.connected ? 'Reconnect / Change Account' : 'Connect Google Drive'}
            </span>
          </button>

          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={isBusy || !statusData?.connected}
            onClick={() => void handleSync()}
          >
            {effectiveStatus === 'SYNCING' ? <Loader2 size={14} className="spin-icon" /> : <FolderSearch size={14} />}
            <span>{effectiveStatus === 'SYNCING' ? 'Syncing...' : 'Sync Drive Textbooks'}</span>
          </button>

          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => {
              setShowLogs((v) => !v)
              void fetchSyncLogs()
            }}
          >
            <History size={14} />
            <span>{showLogs ? 'Hide Sync Logs' : `Sync Logs (${syncLogs.length})`}</span>
          </button>

          {statusData?.connected && (
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              style={{ borderColor: 'rgba(248, 113, 113, 0.45)', color: '#fca5a5' }}
              disabled={isBusy}
              onClick={() => void handleDisconnect()}
            >
              <Unplug size={14} />
              <span>Disconnect Google Drive</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem' }}>
        <div style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Synchronized Textbooks</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
            {statusData?.counts?.synchronizedTextbooks ?? 0}
          </div>
        </div>
        <div style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Pending Review</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fbbf24' }}>
            {statusData?.counts?.pendingReview ?? 0}
          </div>
        </div>
        <div style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Published</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34d399' }}>
            {statusData?.counts?.published ?? 0}
          </div>
        </div>
        <div style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Failed Sync Runs</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: (statusData?.counts?.failedSyncRuns ?? 0) > 0 ? '#f87171' : '#cbd5e1' }}>
            {statusData?.counts?.failedSyncRuns ?? 0}
          </div>
        </div>
      </div>

      {/* Banners & Diagnostics */}
      {(banner || statusData?.lastError) && (
        <div
          style={{
            padding: '0.7rem 0.95rem',
            borderRadius: '10px',
            background: banner?.type === 'success' ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
            border: `1px solid ${banner?.type === 'success' ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)'}`,
            color: banner?.type === 'success' ? '#6ee7b7' : '#fca5a5',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {banner?.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{banner?.text || statusData?.lastError}</span>
        </div>
      )}

      {/* Sync Logs Drawer */}
      {showLogs && (
        <div
          style={{
            padding: '0.85rem',
            borderRadius: '10px',
            background: 'rgba(15,23,42,0.75)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <strong style={{ fontSize: '0.84rem', color: '#e2e8f0' }}>Recent Sync Logs</strong>
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => void fetchSyncLogs()}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {syncLogs.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>No sync runs recorded yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse', color: '#cbd5e1' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                    <th style={{ padding: '0.4rem' }}>Time</th>
                    <th style={{ padding: '0.4rem' }}>Folder</th>
                    <th style={{ padding: '0.4rem' }}>Status</th>
                    <th style={{ padding: '0.4rem' }}>Discovered</th>
                    <th style={{ padding: '0.4rem' }}>New / Updated / Unchanged</th>
                    <th style={{ padding: '0.4rem' }}>Missing / Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '0.4rem' }}>{new Date(log.started_at).toLocaleString()}</td>
                      <td style={{ padding: '0.4rem' }}>{log.folder_name || '-'}</td>
                      <td style={{ padding: '0.4rem', fontWeight: 600, color: log.status === 'SYNC_COMPLETED' ? '#34d399' : '#fca5a5' }}>
                        {log.status}
                      </td>
                      <td style={{ padding: '0.4rem' }}>{log.discovered_count}</td>
                      <td style={{ padding: '0.4rem' }}>
                        {log.inserted_count} / {log.updated_count} / {log.unchanged_count}
                      </td>
                      <td style={{ padding: '0.4rem' }}>
                        {log.missing_count} / {log.failed_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
