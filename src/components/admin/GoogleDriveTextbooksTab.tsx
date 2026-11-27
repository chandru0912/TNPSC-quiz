import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Cloud,
  Edit3,
  Eye,
  EyeOff,
  Filter,
  FolderSearch,
  Globe,
  GraduationCap,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { apiFetch, getAuthenticatedApiUrl } from '../../utils/api'
import { notifyStudentSync } from '../../utils/studentSync'
import { GlassSelect } from './GlassSelect'
import './GoogleDriveTextbooksPanel.css'

interface LibraryFacetOption {
  value: string
  label: string
  count: number
}

interface LibraryFacets {
  standards: LibraryFacetOption[]
  termsOrVolumes: LibraryFacetOption[]
  mediums: LibraryFacetOption[]
  subjects: LibraryFacetOption[]
  statuses: LibraryFacetOption[]
}

const EMPTY_LIB_FACETS: LibraryFacets = {
  standards: [],
  termsOrVolumes: [],
  mediums: [],
  subjects: [],
  statuses: [],
}

interface Props {
  token: string
  onConnectGoogleDrive: () => void
}

interface DriveTextbookItem {
  id: number
  googleDriveFileId: string
  googleDriveParentFolderId: string | null
  bookName: string
  standard: number
  medium: 'Tamil' | 'English'
  subject: string
  term: string | null
  volume: string | null
  fileName: string
  mimeType: string
  fileSize: number
  driveModifiedTime: string | null
  driveFolderPath: string | null
  driveAvailable: boolean
  publicationStatus: 'pending_review' | 'published' | 'unpublished' | 'unavailable'
  lastSyncedAt: string | null
}

interface OverviewData {
  driveStatus: {
    connected: boolean
    configured: boolean
    connectionState?: string
    email?: string
    error?: string
  }
  rootFolderName: string
  totalDiscovered: number
  totalSynchronized: number
  pendingReview: number
  publishedTextbooks: number
  failedSync: number
  unavailableDriveFiles: number
  recentLogs: Array<{
    id: number
    rootFolderName: string
    status: string
    foldersScanned: number
    discoveredCount: number
    insertedCount: number
    updatedCount: number
    failedCount: number
    unavailableCount: number
    errorLogs: string[]
    startedAt: string
  }>
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export const GoogleDriveTextbooksTab: React.FC<Props> = ({ token, onConnectGoogleDrive }) => {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [books, setBooks] = useState<DriveTextbookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [folderName, setFolderName] = useState('TNPSC Study Hub Textbooks')
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [verifyingId, setVerifyingId] = useState<number | null>(null)
  const [showLogs, setShowLogs] = useState(false)

  // Filters & Dynamic DB Facets
  const [filterStd, setFilterStd] = useState('all')
  const [filterTermVol, setFilterTermVol] = useState('all')
  const [filterMedium, setFilterMedium] = useState('all')
  const [filterSubject, setFilterSubject] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSearch, setFilterSearch] = useState('')
  const [facets, setFacets] = useState<LibraryFacets>(EMPTY_LIB_FACETS)

  // Inline Metadata Edit Modal
  const [editingBook, setEditingBook] = useState<DriveTextbookItem | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const authHeaders = { Authorization: `Bearer ${token}` }

  const hasActiveFilters =
    filterStd !== 'all' ||
    filterTermVol !== 'all' ||
    filterMedium !== 'all' ||
    filterSubject !== 'all' ||
    filterStatus !== 'all' ||
    Boolean(filterSearch.trim())

  const clearAllFilters = () => {
    setFilterStd('all')
    setFilterTermVol('all')
    setFilterMedium('all')
    setFilterSubject('all')
    setFilterStatus('all')
    setFilterSearch('')
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (filterStd !== 'all') q.set('standard', filterStd)
      if (filterTermVol !== 'all') q.set('termOrVolume', filterTermVol)
      if (filterMedium !== 'all') q.set('medium', filterMedium)
      if (filterSubject !== 'all' && filterSubject.trim()) q.set('subject', filterSubject.trim())
      if (filterStatus !== 'all') q.set('publicationStatus', filterStatus)
      if (filterSearch.trim()) q.set('search', filterSearch.trim())

      const [ovRes, listRes] = await Promise.all([
        apiFetch('/api/textbooks/drive-library/admin/overview', { headers: authHeaders }),
        apiFetch(`/api/textbooks/drive-library/admin/list?${q.toString()}`, { headers: authHeaders }),
      ])
      const ovJson = await ovRes.json().catch(() => ({}))
      const listJson = await listRes.json().catch(() => ({}))
      if (ovRes.ok && ovJson.status === 'success') setOverview(ovJson.data)
      if (listRes.ok && listJson.status === 'success') {
        setBooks(listJson.data || [])
        if (listJson.facets) {
          const nextFacets: LibraryFacets = {
            standards: Array.isArray(listJson.facets.standards) ? listJson.facets.standards : [],
            termsOrVolumes: Array.isArray(listJson.facets.termsOrVolumes) ? listJson.facets.termsOrVolumes : [],
            mediums: Array.isArray(listJson.facets.mediums) ? listJson.facets.mediums : [],
            subjects: Array.isArray(listJson.facets.subjects) ? listJson.facets.subjects : [],
            statuses: Array.isArray(listJson.facets.statuses) ? listJson.facets.statuses : [],
          }
          setFacets(nextFacets)

          // Auto-reset invalid dependent selections when parent filters narrow options
          if (filterTermVol !== 'all' && !nextFacets.termsOrVolumes.some((o) => o.value.toLowerCase() === filterTermVol.toLowerCase())) {
            setFilterTermVol('all')
          }
          if (filterSubject !== 'all' && !nextFacets.subjects.some((o) => o.value.toLowerCase() === filterSubject.toLowerCase())) {
            setFilterSubject('all')
          }
          if (filterMedium !== 'all' && !nextFacets.mediums.some((o) => o.value.toLowerCase() === filterMedium.toLowerCase())) {
            setFilterMedium('all')
          }
          if (filterStatus !== 'all' && !nextFacets.statuses.some((o) => o.value.toLowerCase() === filterStatus.toLowerCase())) {
            setFilterStatus('all')
          }
        }
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to load Google Drive Textbooks.' })
    } finally {
      setLoading(false)
    }
  }, [token, filterStd, filterTermVol, filterMedium, filterSubject, filterStatus, filterSearch])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleSyncDrive = async () => {
    setSyncing(true)
    setBanner(null)
    try {
      const res = await apiFetch('/api/textbooks/drive-library/admin/sync', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName: folderName.trim() || 'TNPSC Study Hub Textbooks' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Google Drive textbook sync failed.' })
        return
      }
      const d = json.data
      setBanner({
        type: 'success',
        text: `Synced "${d.rootFolderName}": ${d.discoveredCount} PDF(s) discovered across ${d.foldersScanned} folders (${d.insertedCount} new, ${d.updatedCount} updated, ${d.unavailableCount} unavailable, ${d.failedCount} failed).`,
      })
      void loadData()
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Sync error.' })
    } finally {
      setSyncing(false)
    }
  }

  const handleVerifyFile = async (id: number) => {
    setVerifyingId(id)
    setBanner(null)
    try {
      const res = await apiFetch(`/api/textbooks/drive-library/admin/${id}/verify`, {
        method: 'POST',
        headers: authHeaders,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Verification failed.' })
        return
      }
      setBanner({
        type: 'success',
        text: json.data?.driveAvailable
          ? `Verified: "${json.data.bookName}" is active in Google Drive.`
          : `Warning: "${json.data?.bookName}" is no longer available in Google Drive.`,
      })
      void loadData()
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Verification error.' })
    } finally {
      setVerifyingId(null)
    }
  }

  const handleBulkStatus = async (ids: number[], action: 'publish' | 'unpublish' | 'remove') => {
    if (ids.length === 0) return
    if (
      action === 'remove' &&
      !window.confirm(
        `Remove ${ids.length} textbook(s) from the Student Library? Original Google Drive PDF files will NOT be deleted.`
      )
    ) {
      return
    }
    setBanner(null)
    try {
      const res = await apiFetch('/api/textbooks/drive-library/admin/bulk-status', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Action failed.' })
        return
      }
      notifyStudentSync()
      setSelectedIds([])
      setBanner({
        type: 'success',
        text:
          action === 'publish'
            ? `Published ${json.data.updatedCount} textbook(s) to Student Textbook Library.`
            : action === 'unpublish'
              ? `Unpublished ${json.data.updatedCount} textbook(s).`
              : `Removed ${json.data.updatedCount} textbook(s) from Student Library (original Google Drive files preserved).`,
      })
      void loadData()
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Status update error.' })
    }
  }

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBook) return
    setSavingEdit(true)
    setBanner(null)
    try {
      const res = await apiFetch(`/api/textbooks/drive-library/admin/${editingBook.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookName: editingBook.bookName,
          standard: editingBook.standard,
          medium: editingBook.medium,
          subject: editingBook.subject,
          term: editingBook.standard <= 10 ? editingBook.term : null,
          volume: editingBook.standard >= 11 ? editingBook.volume : null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Failed to update metadata.' })
        return
      }
      setEditingBook(null)
      setBanner({ type: 'success', text: 'Textbook metadata updated successfully.' })
      notifyStudentSync()
      void loadData()
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Error saving metadata.' })
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Connection & Root Folder Sync Bar */}
      <div
        className="glass"
        style={{
          padding: '1.1rem 1.25rem',
          borderRadius: '14px',
          border: '1px solid rgba(255,215,0,0.22)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Cloud size={18} style={{ color: '#ffd700' }} />
            <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>Google Drive Textbooks (Metadata-Only Sync)</strong>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.15rem 0.55rem',
                borderRadius: '9999px',
                background: overview?.driveStatus?.connected ? 'rgba(16,185,129,0.18)' : 'rgba(245,158,11,0.18)',
                color: overview?.driveStatus?.connected ? '#34d399' : '#fbbf24',
              }}
            >
              {overview?.driveStatus?.connected
                ? `CONNECTED (${overview.driveStatus.email || 'Authorized'})`
                : overview?.driveStatus?.connectionState || 'NOT CONNECTED'}
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
            Original PDFs remain exclusively in Google Drive. Neon PostgreSQL stores only metadata &amp; Drive file IDs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Root folder name"
            style={{
              padding: '0.45rem 0.7rem',
              borderRadius: '8px',
              background: 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(255,255,255,0.16)',
              color: '#f8fafc',
              fontSize: '0.8rem',
              width: '220px',
            }}
          />
          {!overview?.driveStatus?.connected && (
            <button type="button" className="admin-btn admin-btn-primary" onClick={onConnectGoogleDrive}>
              <Cloud size={14} /> Connect Google Drive
            </button>
          )}
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={syncing || !overview?.driveStatus?.connected}
            onClick={() => void handleSyncDrive()}
          >
            {syncing ? <Loader2 size={14} className="spinning" /> : <FolderSearch size={14} />}
            <span>{syncing ? 'Scanning Drive Metadata...' : 'Sync Drive Textbooks'}</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => setShowLogs((v) => !v)}
          >
            {showLogs ? 'Hide Sync Logs' : `Sync Logs (${overview?.recentLogs?.length ?? 0})`}
          </button>
        </div>
      </div>

      {banner && (
        <div
          style={{
            padding: '0.8rem 1rem',
            borderRadius: '10px',
            background: banner.type === 'success' ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
            border: `1px solid ${banner.type === 'success' ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)'}`,
            color: banner.type === 'success' ? '#6ee7b7' : '#fca5a5',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {banner.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* 6 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Drive PDFs Discovered', val: overview?.totalDiscovered ?? 0, color: '#38bdf8' },
          { label: 'Synchronized Books', val: overview?.totalSynchronized ?? 0, color: '#c084fc' },
          { label: 'Pending Review', val: overview?.pendingReview ?? 0, color: '#fbbf24' },
          { label: 'Published Textbooks', val: overview?.publishedTextbooks ?? 0, color: '#34d399' },
          { label: 'Failed Sync', val: overview?.failedSync ?? 0, color: '#f87171' },
          { label: 'Unavailable Drive Files', val: overview?.unavailableDriveFiles ?? 0, color: '#fb923c' },
        ].map((k) => (
          <div
            key={k.label}
            className="glass"
            style={{ padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <div style={{ fontSize: '0.73rem', color: '#94a3b8' }}>{k.label}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: k.color, marginTop: '0.15rem' }}>
              {k.val}
            </div>
          </div>
        ))}
      </div>

      {/* Sync Logs Drawer */}
      {showLogs && (
        <div className="glass" style={{ padding: '0.9rem 1.1rem', borderRadius: '12px', maxHeight: '210px', overflowY: 'auto' }}>
          <strong style={{ color: '#fde047', fontSize: '0.82rem' }}>Recent Drive Synchronization Logs</strong>
          {(overview?.recentLogs || []).length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0.4rem 0 0' }}>No sync runs recorded yet.</p>
          ) : (
            overview!.recentLogs.map((l) => (
              <div
                key={l.id}
                style={{ fontSize: '0.76rem', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#cbd5e1' }}
              >
                <strong>[{l.status.toUpperCase()}]</strong> {l.rootFolderName} — {l.discoveredCount} discovered, {l.insertedCount} inserted, {l.updatedCount} updated, {l.failedCount} failed ({new Date(l.startedAt).toLocaleString()})
                {l.errorLogs?.length > 0 && (
                  <div style={{ color: '#fca5a5', marginTop: '0.15rem' }}>{l.errorLogs.slice(0, 3).join(' | ')}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Dynamic Cascading Database-Driven Filter Toolbar */}
      <div className="drive-lib-card" style={{ padding: '1rem 1.15rem' }}>
        <div className="drive-filter-panel">
          <div className="drive-filter-row">
            <div className="drive-filter-field" style={{ gridColumn: 'span 2' }}>
              <label className="drive-filter-label"><Search size={12} /> Search Textbook</label>
              <input
                type="text"
                className="drive-input"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Search by textbook name, subject, standard, term, volume, medium, or Drive ID..."
              />
            </div>

            <GlassSelect
              label="Standard"
              icon={<GraduationCap size={12} />}
              value={filterStd}
              loading={loading && facets.standards.length === 0}
              onChange={(v) => setFilterStd(v)}
              options={[
                { value: 'all', label: 'All Standards (6th–12th)', count: facets.standards.reduce((s, o) => s + o.count, 0) },
                ...facets.standards,
              ]}
            />

            <GlassSelect
              label="Term / Volume"
              icon={<Layers size={12} />}
              value={filterTermVol}
              loading={loading && facets.termsOrVolumes.length === 0}
              onChange={(v) => setFilterTermVol(v)}
              options={[
                { value: 'all', label: 'All Terms / Volumes', count: facets.termsOrVolumes.reduce((s, o) => s + o.count, 0) },
                ...facets.termsOrVolumes,
              ]}
            />

            <GlassSelect
              label="Medium"
              icon={<Globe size={12} />}
              value={filterMedium}
              loading={loading && facets.mediums.length === 0}
              onChange={(v) => setFilterMedium(v)}
              options={[
                { value: 'all', label: 'All Mediums', count: facets.mediums.reduce((s, o) => s + o.count, 0) },
                ...facets.mediums,
              ]}
            />

            <GlassSelect
              label="Subject"
              icon={<BookOpen size={12} />}
              value={filterSubject}
              loading={loading && facets.subjects.length === 0}
              onChange={(v) => setFilterSubject(v)}
              options={[
                { value: 'all', label: 'All Available Subjects', count: facets.subjects.reduce((s, o) => s + o.count, 0) },
                ...facets.subjects,
              ]}
            />

            <GlassSelect
              label="Status"
              icon={<Filter size={12} />}
              value={filterStatus}
              loading={loading && facets.statuses.length === 0}
              onChange={(v) => setFilterStatus(v)}
              options={[
                { value: 'all', label: 'All Statuses', count: facets.statuses.reduce((s, o) => s + o.count, 0) },
                ...facets.statuses,
              ]}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.79rem', color: '#94a3b8' }}>
              Showing <strong style={{ color: '#f8fafc' }}>{books.length}</strong> matching textbook{books.length === 1 ? '' : 's'}
              {hasActiveFilters && overview?.totalSynchronized !== undefined
                ? ` (filtered from ${overview.totalSynchronized} total)`
                : ''}
            </div>
            {hasActiveFilters && (
              <div className="drive-active-chips">
                {filterStd !== 'all' && <span className="drive-chip">{filterStd}th Std <button type="button" onClick={() => setFilterStd('all')}><X size={11} /></button></span>}
                {filterTermVol !== 'all' && <span className="drive-chip">{filterTermVol} <button type="button" onClick={() => setFilterTermVol('all')}><X size={11} /></button></span>}
                {filterMedium !== 'all' && <span className="drive-chip">{filterMedium} Medium <button type="button" onClick={() => setFilterMedium('all')}><X size={11} /></button></span>}
                {filterSubject !== 'all' && <span className="drive-chip">{filterSubject} <button type="button" onClick={() => setFilterSubject('all')}><X size={11} /></button></span>}
                {filterStatus !== 'all' && <span className="drive-chip">{filterStatus.replace(/_/g, ' ')} <button type="button" onClick={() => setFilterStatus('all')}><X size={11} /></button></span>}
                {filterSearch.trim() && <span className="drive-chip">"{filterSearch.trim()}" <button type="button" onClick={() => setFilterSearch('')}><X size={11} /></button></span>}
                <button type="button" className="drive-btn drive-btn-neutral" style={{ height: '26px', fontSize: '0.72rem', padding: '0 0.6rem' }} onClick={clearAllFilters}>
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div
          className="glass"
          style={{
            padding: '0.7rem 1rem',
            borderRadius: '10px',
            border: '1px solid rgba(56,189,248,0.4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span style={{ color: '#7dd3fc', fontSize: '0.84rem', fontWeight: 600 }}>
            {selectedIds.length} textbook(s) selected
          </span>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <button type="button" className="admin-btn admin-btn-primary" onClick={() => void handleBulkStatus(selectedIds, 'publish')}>
              <Send size={13} /> Bulk Publish
            </button>
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => void handleBulkStatus(selectedIds, 'unpublish')}>
              <EyeOff size={13} /> Bulk Unpublish
            </button>
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setSelectedIds([])}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Textbook Management Table */}
      <div className="drive-table-wrap glass" style={{ borderRadius: '14px' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading synchronized Google Drive textbooks...</div>
        ) : books.length === 0 ? (
          <div style={{ padding: '2.25rem', textAlign: 'center', color: '#94a3b8' }}>
            <div>
              {hasActiveFilters
                ? 'No textbooks match the selected filter criteria.'
                : 'No Google Drive textbooks found. Connect Google Drive and click "Sync Drive Textbooks".'}
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                className="drive-btn drive-btn-neutral"
                style={{ height: '32px', fontSize: '0.76rem', marginTop: '0.75rem' }}
                onClick={clearAllFilters}
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <table className="drive-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={books.length > 0 && selectedIds.length === books.length}
                    onChange={(e) => setSelectedIds(e.target.checked ? books.map((b) => b.id) : [])}
                    aria-label="Select all textbooks"
                  />
                </th>
                <th>Std</th>
                <th>Term / Vol</th>
                <th>Medium</th>
                <th>Subject</th>
                <th>Textbook Name</th>
                <th>Drive File ID</th>
                <th>Size</th>
                <th className="drive-col-status">Status</th>
                <th className="drive-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => {
                const stClass =
                  !b.driveAvailable || b.publicationStatus === 'unavailable'
                    ? 'unavailable'
                    : b.publicationStatus === 'published'
                      ? 'published'
                      : b.publicationStatus === 'unpublished'
                        ? 'unpublished'
                        : 'pending'
                return (
                  <tr key={b.id} className={selectedIds.includes(b.id) ? 'row-selected' : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(b.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked ? [...prev, b.id] : prev.filter((id) => id !== b.id)
                          )
                        }
                        aria-label={`Select ${b.bookName}`}
                      />
                    </td>
                    <td><span className="drive-std-badge">{b.standard}th</span></td>
                    <td style={{ whiteSpace: 'nowrap', color: '#cbd5e1' }}>
                      {b.standard >= 11 ? b.volume || b.term || 'Full Book' : b.term || b.volume || 'Full Year'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: '#cbd5e1' }}>{b.medium}</td>
                    <td><span className="drive-subject-badge">{b.subject}</span></td>
                    <td className="drive-col-bookname">
                      <div style={{ fontWeight: 600, color: '#f8fafc', lineHeight: 1.35 }}>{b.bookName}</div>
                    </td>
                    <td>
                      <span className="drive-file-id" title={b.googleDriveFileId}>
                        {b.googleDriveFileId}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: '#cbd5e1' }}>{formatBytes(b.fileSize)}</td>
                    <td className="drive-col-status">
                      <span className={`drive-status-pill ${stClass}`}>
                        {(!b.driveAvailable ? 'unavailable' : b.publicationStatus).replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="drive-col-actions">
                      <div className="drive-row-actions">
                        <a
                          href={getAuthenticatedApiUrl(`/api/textbooks/library/${b.id}/preview`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="drive-act-btn drive-act-btn--view"
                          title="View PDF from Google Drive"
                        >
                          <Eye size={13} /> View
                        </a>
                        <button
                          type="button"
                          className="drive-act-btn drive-act-btn--edit"
                          onClick={() => setEditingBook({ ...b })}
                          title="Edit Metadata"
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className="drive-act-btn drive-act-btn--edit drive-act-btn--icon"
                          disabled={verifyingId === b.id}
                          onClick={() => void handleVerifyFile(b.id)}
                          title="Verify Drive File Availability"
                        >
                          {verifyingId === b.id ? <RefreshCw size={13} className="spin-icon" /> : <ShieldCheck size={13} />}
                        </button>
                        {b.publicationStatus !== 'published' ? (
                          <button
                            type="button"
                            className="drive-act-btn drive-act-btn--publish"
                            disabled={!b.driveAvailable}
                            onClick={() => void handleBulkStatus([b.id], 'publish')}
                          >
                            Publish
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="drive-act-btn drive-act-btn--unpublish"
                            onClick={() => void handleBulkStatus([b.id], 'unpublish')}
                          >
                            Unpublish
                          </button>
                        )}
                        <button
                          type="button"
                          className="drive-act-btn drive-act-btn--delete drive-act-btn--icon"
                          onClick={() => void handleBulkStatus([b.id], 'remove')}
                          title="Delete from Student Library (does NOT delete Drive PDF)"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Metadata Modal */}
      {editingBook && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.68)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '1rem',
          }}
        >
          <form
            onSubmit={handleSaveMetadata}
            className="glass"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '1.35rem',
              borderRadius: '16px',
              border: '1px solid rgba(255,215,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: '#fde047', fontSize: '1rem' }}>Edit Textbook Metadata</strong>
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setEditingBook(null)}>
                <X size={14} />
              </button>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
              Book Name
              <input
                type="text"
                className="admin-input"
                value={editingBook.bookName}
                onChange={(e) => setEditingBook({ ...editingBook, bookName: e.target.value })}
                required
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                Standard
                <select
                  className="admin-select"
                  value={editingBook.standard}
                  onChange={(e) => setEditingBook({ ...editingBook, standard: Number(e.target.value) })}
                >
                  {[6, 7, 8, 9, 10, 11, 12].map((s) => (
                    <option key={s} value={s}>{s}th Standard</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                Medium
                <select
                  className="admin-select"
                  value={editingBook.medium}
                  onChange={(e) => setEditingBook({ ...editingBook, medium: e.target.value as 'Tamil' | 'English' })}
                >
                  <option value="English">English</option>
                  <option value="Tamil">Tamil</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                Subject
                <input
                  type="text"
                  className="admin-input"
                  value={editingBook.subject}
                  onChange={(e) => setEditingBook({ ...editingBook, subject: e.target.value })}
                  required
                />
              </label>
              {editingBook.standard <= 10 ? (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                  Term (6th–10th)
                  <input
                    type="text"
                    className="admin-input"
                    value={editingBook.term || ''}
                    onChange={(e) => setEditingBook({ ...editingBook, term: e.target.value })}
                    placeholder="Term 1 / Term 2 / Term 3"
                  />
                </label>
              ) : (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                  Volume (11th–12th)
                  <input
                    type="text"
                    className="admin-input"
                    value={editingBook.volume || ''}
                    onChange={(e) => setEditingBook({ ...editingBook, volume: e.target.value })}
                    placeholder="Volume 1 / Volume 2"
                  />
                </label>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setEditingBook(null)}>
                Cancel
              </button>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={savingEdit}>
                <Save size={14} /> {savingEdit ? 'Saving...' : 'Save Metadata'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default GoogleDriveTextbooksTab
