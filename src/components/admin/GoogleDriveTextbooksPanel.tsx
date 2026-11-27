import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Edit3,
  Eye,
  EyeOff,
  Filter,
  FolderOpen,
  FolderSearch,
  Globe,
  GraduationCap,
  History,
  Layers,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Unplug,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { apiFetch, getAuthenticatedApiUrl } from '../../utils/api'
import { notifyStudentSync } from '../../utils/studentSync'
import { GlassSelect } from './GlassSelect'
import './GoogleDriveTextbooksPanel.css'

type DriveUiStatus =
  | 'NOT_CONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'VERIFIED'
  | 'TOKEN_EXPIRED'
  | 'REAUTHORIZATION_REQUIRED'
  | 'CONNECTION_FAILED'

type SelectionMode = 'manual' | 'filtered' | 'all'
type BulkScope = 'selected' | 'filtered' | 'all' | 'pending_review' | 'published'

interface DriveStatusData {
  status: DriveUiStatus
  connected: boolean
  verified: boolean
  configured: boolean
  accountEmail: string | null
  oauthVerified: boolean
  driveApiAccessible: boolean
  tokenStatus: 'VALID' | 'EXPIRED' | 'REVOKED' | 'MISSING'
  folderAccessible: boolean
  folderId: string | null
  folderName: string
  connectedAt: string | null
  lastSyncAt: string | null
  lastError: string | null
}

interface TextbookCounts {
  totalTextbooks: number
  pendingReview: number
  approved: number
  publishedTextbooks: number
  unpublishedTextbooks: number
  rejectedTextbooks: number
  failedSync: number
  unavailableFiles: number
  trashedTextbooks: number
}

interface DriveTextbookItem {
  id: number
  groupId: string
  bookName: string
  standard: number
  term: string | null
  volume: string | null
  subject: string
  medium: 'Tamil' | 'English'
  unit: number | null
  fileName: string
  fileSize: number
  googleDriveFileId: string
  driveFolderPath: string | null
  driveModifiedTime: string | null
  driveAvailable: boolean
  reviewStatus: string
  publicationStatus: string
  publishedAt: string | null
  publishedBy: string | null
  deletedAt: string | null
}

interface SyncLogRow {
  id: number
  folder_name: string | null
  status: string
  discovered_count: number
  inserted_count: number
  updated_count: number
  unchanged_count: number
  missing_count: number
  failed_count: number
  started_at: string
}

interface DriveFolderItem {
  id: string
  name: string
  parentId: string | null
}

interface Props {
  token: string
  onSyncCompleted?: () => void
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const SYNC_STAGES = ['Scanning folders', 'Discovering PDFs', 'Processing metadata', 'Updating database']

interface FacetOption {
  value: string
  label: string
  count: number
}

interface TextbookFacets {
  standards: FacetOption[]
  termsOrVolumes: FacetOption[]
  mediums: FacetOption[]
  subjects: FacetOption[]
  statuses: FacetOption[]
}

const EMPTY_FACETS: TextbookFacets = {
  standards: [],
  termsOrVolumes: [],
  mediums: [],
  subjects: [],
  statuses: [],
}

function normalizeFacetOptions(raw: unknown, formatLabel?: (v: string) => string): FacetOption[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item: any) => {
      if (typeof item === 'string') {
        return { value: item, label: formatLabel ? formatLabel(item) : item, count: 0 }
      }
      if (item && typeof item === 'object' && item.value !== undefined) {
        return {
          value: String(item.value),
          label: String(item.label ?? (formatLabel ? formatLabel(String(item.value)) : item.value)),
          count: Number(item.count ?? 0),
        }
      }
      return null
    })
    .filter((o): o is FacetOption => Boolean(o && o.value))
}

export const GoogleDriveTextbooksPanel: React.FC<Props> = ({ token, onSyncCompleted }) => {
  const [statusData, setStatusData] = useState<DriveStatusData | null>(null)
  const [counts, setCounts] = useState<TextbookCounts>({
    totalTextbooks: 0,
    pendingReview: 0,
    approved: 0,
    publishedTextbooks: 0,
    unpublishedTextbooks: 0,
    rejectedTextbooks: 0,
    failedSync: 0,
    unavailableFiles: 0,
    trashedTextbooks: 0,
  })
  const [books, setBooks] = useState<DriveTextbookItem[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLogRow[]>([])
  const [folders, setFolders] = useState<DriveFolderItem[]>([])
  const [facets, setFacets] = useState<TextbookFacets>(EMPTY_FACETS)

  // Pagination & Sorting
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalFiltered, setTotalFiltered] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [sortBy, setSortBy] = useState<'standard' | 'subject' | 'bookName' | 'fileSize' | 'modifiedDate' | 'publicationStatus'>('standard')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Filters
  const [search, setSearch] = useState('')
  const [standardFilter, setStandardFilter] = useState('all')
  const [termFilter, setTermFilter] = useState('all')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [mediumFilter, setMediumFilter] = useState('all')
  const [pubFilter, setPubFilter] = useState('all')
  const [viewTrash, setViewTrash] = useState(false)

  // Advanced Selection State (preserves across pagination!)
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('manual')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [excludedIds, setExcludedIds] = useState<number[]>([])

  // UI & Operation States
  const [folderName, setFolderName] = useState('TNPSC Study Hub Textbooks')
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncStageIdx, setSyncStageIdx] = useState(0)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Bulk Confirmation Modals
  const [publishModal, setPublishModal] = useState<{
    scope: BulkScope
    label: string
    approvePending: boolean
    loadingPreview: boolean
    executing: boolean
    preview: {
      totalMatched: number
      eligibleToPublish: number
      alreadyPublished: number
      pendingReview: number
      failedValidationCount: number
      failedValidation: Array<{ id: number; bookName: string; reason: string }>
    } | null
    result: { publishedCount: number; skippedCount: number; failedCount: number } | null
  } | null>(null)

  const [unpublishModal, setUnpublishModal] = useState<{
    scope: BulkScope
    label: string
    totalMatched: number
    executing: boolean
  } | null>(null)

  const [deleteModal, setDeleteModal] = useState<{
    scope: BulkScope
    label: string
    totalMatched: number
    confirmInput: string
    executing: boolean
  } | null>(null)

  // Edit & Preview Modals
  const [editingBook, setEditingBook] = useState<DriveTextbookItem | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [previewBook, setPreviewBook] = useState<DriveTextbookItem | null>(null)
  const [previewZoom, setPreviewZoom] = useState(100)

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
  }, [token])

  const currentFilters = useMemo(
    () => ({
      search: search.trim() || undefined,
      standard: standardFilter !== 'all' ? standardFilter : undefined,
      termOrVolume: termFilter !== 'all' ? termFilter : undefined,
      subject: subjectFilter !== 'all' ? subjectFilter : undefined,
      medium: mediumFilter !== 'all' ? mediumFilter : undefined,
      publicationStatus: pubFilter !== 'all' ? pubFilter : undefined,
      includeTrashed: viewTrash,
    }),
    [search, standardFilter, termFilter, subjectFilter, mediumFilter, pubFilter, viewTrash]
  )

  const clearSelection = useCallback(() => {
    setSelectionMode('manual')
    setSelectedIds([])
    setExcludedIds([])
  }, [])

  const loadAll = useCallback(
    async (forceVerify = false) => {
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('pageSize', String(pageSize))
        params.set('sortBy', sortBy)
        params.set('sortDir', sortDir)
        if (search.trim()) params.set('search', search.trim())
        if (standardFilter !== 'all') params.set('standard', standardFilter)
        if (termFilter !== 'all') params.set('termOrVolume', termFilter)
        if (subjectFilter !== 'all') params.set('subject', subjectFilter)
        if (mediumFilter !== 'all') params.set('medium', mediumFilter)
        if (pubFilter !== 'all') params.set('publicationStatus', pubFilter)
        if (viewTrash) params.set('trashed', 'true')

        const [stRes, tbRes, logsRes] = await Promise.all([
          apiFetch(`/api/drive/status${forceVerify ? '?verify=true' : ''}`, { headers: authHeaders }),
          apiFetch(`/api/drive/textbooks?${params.toString()}`, { headers: authHeaders }),
          apiFetch('/api/drive/sync-logs?limit=15', { headers: authHeaders }),
        ])

        const [stJson, tbJson, logsJson] = await Promise.all([
          stRes.json().catch(() => ({})),
          tbRes.json().catch(() => ({})),
          logsRes.json().catch(() => ({})),
        ])

        if (stRes.ok && stJson.status === 'success' && stJson.data) {
          setStatusData(stJson.data)
          if (stJson.data.folderName) setFolderName(stJson.data.folderName)
          if (stJson.data.folderId) setSelectedFolderId(stJson.data.folderId)
        }
        if (tbRes.ok && tbJson.status === 'success' && tbJson.data) {
          setBooks(tbJson.data.items || [])
          setTotalFiltered(Number(tbJson.data.pagination?.total || 0))
          setTotalPages(Number(tbJson.data.pagination?.totalPages || 1))
          const nextFacets: TextbookFacets = {
            standards: normalizeFacetOptions(tbJson.data.facets?.standards, (v) => `${v}th Standard`),
            termsOrVolumes: normalizeFacetOptions(tbJson.data.facets?.termsOrVolumes),
            mediums: normalizeFacetOptions(tbJson.data.facets?.mediums, (v) => `${v} Medium`),
            subjects: normalizeFacetOptions(tbJson.data.facets?.subjects),
            statuses: normalizeFacetOptions(tbJson.data.facets?.statuses),
          }
          setFacets(nextFacets)

          // Auto-reset invalid dependent selections when parent filters narrow options
          if (termFilter !== 'all' && !nextFacets.termsOrVolumes.some((o) => o.value.toLowerCase() === termFilter.toLowerCase())) {
            setTermFilter('all')
          }
          if (subjectFilter !== 'all' && !nextFacets.subjects.some((o) => o.value.toLowerCase() === subjectFilter.toLowerCase())) {
            setSubjectFilter('all')
          }
          if (mediumFilter !== 'all' && !nextFacets.mediums.some((o) => o.value.toLowerCase() === mediumFilter.toLowerCase())) {
            setMediumFilter('all')
          }
          if (pubFilter !== 'all' && !nextFacets.statuses.some((o) => o.value.toUpperCase() === pubFilter.toUpperCase())) {
            setPubFilter('all')
          }
          if (tbJson.data.counts) setCounts(tbJson.data.counts)
        }
        if (logsRes.ok && logsJson.status === 'success' && Array.isArray(logsJson.data)) {
          setSyncLogs(logsJson.data)
        }
      } catch (err: any) {
        setBanner({ type: 'error', text: err?.message || 'Failed to load Google Drive Textbook Library.' })
      } finally {
        setLoading(false)
      }
    },
    [authHeaders, page, pageSize, sortBy, sortDir, search, standardFilter, termFilter, subjectFilter, mediumFilter, pubFilter, viewTrash]
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const driveStatusParam = params.get('drive_status')
    const driveErrorParam = params.get('drive_error')
    const emailParam = params.get('email')

    if (driveStatusParam === 'connected') {
      setBanner({
        type: 'success',
        text: `Google Drive Connected${emailParam ? ` (${emailParam})` : ''}. Verifying Drive API access...`,
      })
      window.history.replaceState({}, document.title, window.location.pathname)
      void loadAll(true)
      return
    }
    if (driveStatusParam === 'error' || driveErrorParam) {
      setBanner({ type: 'error', text: driveErrorParam || 'Google Drive OAuth failed.' })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    void loadAll(false)
  }, [loadAll])

  // Selection helpers
  const isRowSelected = (id: number) =>
    selectionMode === 'manual' ? selectedIds.includes(id) : !excludedIds.includes(id)

  const selectedCount = useMemo(() => {
    if (selectionMode === 'manual') return selectedIds.length
    if (selectionMode === 'filtered') return Math.max(0, totalFiltered - excludedIds.length)
    return Math.max(0, counts.totalTextbooks - excludedIds.length)
  }, [selectionMode, selectedIds.length, excludedIds.length, totalFiltered, counts.totalTextbooks])

  const allOnPageSelected = books.length > 0 && books.every((b) => isRowSelected(b.id))

  const toggleRow = (id: number) => {
    if (selectionMode === 'manual') {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    } else {
      setExcludedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    }
  }

  const toggleCurrentPage = () => {
    const pageIds = books.map((b) => b.id)
    if (allOnPageSelected) {
      if (selectionMode === 'manual') {
        setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)))
      } else {
        setExcludedIds((prev) => Array.from(new Set([...prev, ...pageIds])))
      }
    } else {
      if (selectionMode === 'manual') {
        setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])))
      } else {
        setExcludedIds((prev) => prev.filter((id) => !pageIds.includes(id)))
      }
    }
  }

  const selectAllFiltered = () => {
    setSelectionMode('filtered')
    setSelectedIds([])
    setExcludedIds([])
  }

  const selectAllDatabase = () => {
    setSelectionMode('all')
    setSelectedIds([])
    setExcludedIds([])
  }

  const resolveActiveScopePayload = (overrideScope?: BulkScope) => {
    const scope: BulkScope =
      overrideScope || (selectionMode === 'manual' ? 'selected' : selectionMode === 'filtered' ? 'filtered' : 'all')
    return {
      scope,
      selectedIds: scope === 'selected' ? selectedIds : [],
      excludedIds: scope === 'filtered' || scope === 'all' ? excludedIds : [],
      filters: currentFilters,
    }
  }

  // Open Publish Confirmation Modal with live backend dry-run breakdown
  const openPublishModal = async (scope: BulkScope, label: string, approvePending = true) => {
    setPublishModal({ scope, label, approvePending, loadingPreview: true, executing: false, preview: null, result: null })
    try {
      const payload = { ...resolveActiveScopePayload(scope), approvePending, dryRun: true }
      const res = await apiFetch('/api/drive/textbooks/bulk-publish', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setPublishModal(null)
        setBanner({ type: 'error', text: json.message || 'Could not calculate eligible textbooks.' })
        return
      }
      setPublishModal((prev) => (prev ? { ...prev, loadingPreview: false, preview: json.data } : null))
    } catch (err: any) {
      setPublishModal(null)
      setBanner({ type: 'error', text: err?.message || 'Dry-run check failed.' })
    }
  }

  const togglePublishApprovePending = async (nextVal: boolean) => {
    if (!publishModal) return
    await openPublishModal(publishModal.scope, publishModal.label, nextVal)
  }

  const confirmBulkPublish = async () => {
    if (!publishModal) return
    setPublishModal((prev) => (prev ? { ...prev, executing: true } : null))
    try {
      const payload = {
        ...resolveActiveScopePayload(publishModal.scope),
        approvePending: publishModal.approvePending,
        dryRun: false,
      }
      const res = await apiFetch('/api/drive/textbooks/bulk-publish', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Bulk publish failed.' })
        setPublishModal(null)
        return
      }
      const d = json.data
      setPublishModal((prev) =>
        prev
          ? {
              ...prev,
              executing: false,
              result: {
                publishedCount: d.publishedCount,
                skippedCount: d.skippedCount,
                failedCount: d.failedCount,
              },
            }
          : null
      )
      setBanner({
        type: d.failedCount > 0 && d.publishedCount === 0 ? 'error' : 'success',
        text: `Publish complete: ${d.publishedCount} published, ${d.skippedCount} skipped (already published), ${d.failedCount} failed validation.`,
      })
      clearSelection()
      notifyStudentSync()
      await loadAll(false)
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Bulk publish error.' })
      setPublishModal(null)
    }
  }

  const openUnpublishModal = async (scope: BulkScope, label: string) => {
    try {
      const res = await apiFetch('/api/drive/textbooks/bulk-unpublish', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...resolveActiveScopePayload(scope), dryRun: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Could not preview unpublish scope.' })
        return
      }
      setUnpublishModal({ scope, label, totalMatched: Number(json.data?.totalMatched || 0), executing: false })
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Unpublish preview error.' })
    }
  }

  const confirmBulkUnpublish = async () => {
    if (!unpublishModal) return
    setUnpublishModal((prev) => (prev ? { ...prev, executing: true } : null))
    try {
      const res = await apiFetch('/api/drive/textbooks/bulk-unpublish', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...resolveActiveScopePayload(unpublishModal.scope), dryRun: false }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Bulk unpublish failed.' })
      } else {
        setBanner({
          type: 'success',
          text: `Unpublished ${json.data.unpublishedCount} textbook(s) from Student Library (${json.data.skippedCount} already unpublished). Original Google Drive files preserved.`,
        })
        clearSelection()
        notifyStudentSync()
        await loadAll(false)
      }
    } finally {
      setUnpublishModal(null)
    }
  }

  const openDeleteModal = async (scope: BulkScope, label: string) => {
    try {
      const res = await apiFetch('/api/drive/textbooks/bulk-delete', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...resolveActiveScopePayload(scope), dryRun: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Could not preview delete scope.' })
        return
      }
      setDeleteModal({
        scope,
        label,
        totalMatched: Number(json.data?.totalMatched || 0),
        confirmInput: '',
        executing: false,
      })
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Delete preview error.' })
    }
  }

  const confirmBulkDelete = async () => {
    if (!deleteModal) return
    setDeleteModal((prev) => (prev ? { ...prev, executing: true } : null))
    try {
      const res = await apiFetch('/api/drive/textbooks/bulk-delete', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...resolveActiveScopePayload(deleteModal.scope),
          dryRun: false,
          confirmPhrase: deleteModal.confirmInput.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Bulk deletion failed.' })
        setDeleteModal((prev) => (prev ? { ...prev, executing: false } : null))
        return
      }
      setBanner({
        type: 'success',
        text: `Moved ${json.data.deletedCount} textbook record(s) to recoverable Trash and removed from Student Library. Original Google Drive PDFs were NOT deleted.`,
      })
      setDeleteModal(null)
      clearSelection()
      notifyStudentSync()
      await loadAll(false)
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Deletion error.' })
      setDeleteModal(null)
    }
  }

  const handleRestoreFromTrash = async (ids?: number[], restoreAll = false) => {
    const res = await apiFetch('/api/drive/textbooks/restore', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, restoreAll }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.status === 'success') {
      setBanner({ type: 'success', text: `Restored ${json.data.restoredCount} textbook(s) from Trash.` })
      await loadAll(false)
    }
  }

  // OAuth & Sync Handlers
  const handleConnect = async () => {
    setBanner(null)
    setConnecting(true)
    try {
      const res = await apiFetch(`/api/drive/oauth/start?origin=${encodeURIComponent(window.location.origin)}`, { headers: authHeaders })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.data?.authUrl) {
        setConnecting(false)
        setBanner({ type: 'error', text: json.message || 'Could not start Google Drive OAuth.' })
        return
      }
      window.location.href = json.data.authUrl
    } catch (err: any) {
      setConnecting(false)
      setBanner({ type: 'error', text: err?.message || 'OAuth start failed.' })
    }
  }

  const handleVerifyConnection = async () => {
    setVerifying(true)
    try {
      const res = await apiFetch('/api/drive/verify', { method: 'POST', headers: authHeaders })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.data) {
        setStatusData(json.data)
        setBanner({
          type: json.data.verified ? 'success' : 'error',
          text: json.data.verified ? `Google Drive VERIFIED for ${json.data.accountEmail}.` : json.data.lastError || 'Verification failed.',
        })
      }
    } finally {
      setVerifying(false)
    }
  }

  const handleSync = async () => {
    setBanner(null)
    setSyncing(true)
    setSyncStageIdx(0)
    const timer = window.setInterval(() => setSyncStageIdx((i) => (i < SYNC_STAGES.length - 1 ? i + 1 : i)), 1100)
    try {
      const res = await apiFetch('/api/drive/sync', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: selectedFolderId || undefined, folderName: folderName.trim() || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Sync failed.' })
      } else {
        const d = json.data
        setBanner({
          type: 'success',
          text: `Sync completed: ${d.discoveredCount} PDFs discovered (${d.insertedCount} new, ${d.updatedCount} updated, ${d.unchangedCount} unchanged).`,
        })
        onSyncCompleted?.()
      }
      await loadAll(false)
    } finally {
      window.clearInterval(timer)
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Drive? Original Drive PDFs and textbook records will NOT be deleted.')) return
    const res = await apiFetch('/api/drive/disconnect', { method: 'POST', headers: authHeaders })
    if (res.ok) {
      setBanner({ type: 'success', text: 'Google Drive disconnected.' })
      await loadAll(false)
    }
  }

  const handleRowAction = async (id: number, action: 'approve' | 'reject' | 'publish' | 'unpublish') => {
    setBusyId(id)
    try {
      const res = await apiFetch(`/api/drive/files/${id}/review`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Action failed.' })
        return
      }
      if (previewBook?.id === id) setPreviewBook(null)
      notifyStudentSync()
      await loadAll(false)
    } finally {
      setBusyId(null)
    }
  }

  const handleResyncSingle = async (id: number) => {
    setBusyId(id)
    try {
      await apiFetch(`/api/drive/files/${id}/resync`, { method: 'POST', headers: authHeaders })
      await loadAll(false)
    } finally {
      setBusyId(null)
    }
  }

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBook) return
    setSavingEdit(true)
    try {
      const res = await apiFetch(`/api/drive/files/${editingBook.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: editingBook.groupId,
          bookName: editingBook.bookName,
          standard: editingBook.standard,
          term: editingBook.standard <= 10 ? editingBook.term : null,
          volume: editingBook.standard >= 11 ? editingBook.volume : null,
          subject: editingBook.subject,
          medium: editingBook.medium,
          unit: editingBook.unit,
        }),
      })
      if (res.ok) {
        setEditingBook(null)
        notifyStudentSync()
        await loadAll(false)
      }
    } finally {
      setSavingEdit(false)
    }
  }

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(col)
      setSortDir('asc')
    }
    setPage(1)
  }

  const hasActiveFilters =
    Boolean(search.trim()) ||
    standardFilter !== 'all' ||
    termFilter !== 'all' ||
    subjectFilter !== 'all' ||
    mediumFilter !== 'all' ||
    pubFilter !== 'all'

  const clearAllFilters = () => {
    setSearch('')
    setStandardFilter('all')
    setTermFilter('all')
    setSubjectFilter('all')
    setMediumFilter('all')
    setPubFilter('all')
    setPage(1)
  }

  const uiStatus: DriveUiStatus = connecting ? 'CONNECTING' : statusData?.status || 'NOT_CONNECTED'
  const isGreen = uiStatus === 'VERIFIED' || uiStatus === 'CONNECTED'
  const startRow = totalFiltered === 0 ? 0 : (page - 1) * pageSize + 1
  const endRow = Math.min(totalFiltered, page * pageSize)

  return (
    <div className="drive-lib-root">
      {/* 1. Connection & Sync Header Card */}
      <div className={`drive-lib-card ${isGreen ? 'drive-lib-card--verified' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
              <Cloud size={19} style={{ color: isGreen ? '#34d399' : '#ffd700' }} />
              <strong style={{ color: '#f8fafc', fontSize: '1.04rem' }}>Google Drive Textbooks</strong>
              <span className={`drive-status-pill ${isGreen ? 'published' : 'pending'}`}>
                {loading ? 'CHECKING...' : uiStatus === 'VERIFIED' ? '🟢 CONNECTED & VERIFIED' : uiStatus}
              </span>
            </div>
            <div style={{ marginTop: '0.4rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.79rem', color: '#94a3b8' }}>
              <span>Account: <strong style={{ color: '#f8fafc' }}>{statusData?.accountEmail || 'Not connected'}</strong></span>
              <span>Drive API: <strong style={{ color: statusData?.driveApiAccessible ? '#34d399' : '#fbbf24' }}>{statusData?.driveApiAccessible ? 'Accessible' : 'Pending'}</strong></span>
              <span>Token: <strong style={{ color: statusData?.tokenStatus === 'VALID' ? '#34d399' : '#fca5a5' }}>{statusData?.tokenStatus || 'MISSING'}</strong></span>
              <span>Last Sync: <strong style={{ color: '#cbd5e1' }}>{statusData?.lastSyncAt ? new Date(statusData.lastSyncAt).toLocaleString() : 'Never'}</strong></span>
            </div>
          </div>

          <div className="drive-global-actions">
            {statusData?.connected ? (
              <>
                <button type="button" className="drive-btn drive-btn-neutral" disabled={verifying} onClick={() => void handleVerifyConnection()}>
                  {verifying ? <Loader2 size={14} className="spin-icon" /> : <ShieldCheck size={14} />} Verify Connection
                </button>
                <button type="button" className="drive-btn drive-btn-neutral" onClick={() => void handleConnect()}>
                  <RefreshCw size={14} /> Reconnect
                </button>
                <button type="button" className="drive-btn drive-btn-danger-outline" onClick={() => void handleDisconnect()}>
                  <Unplug size={14} /> Disconnect
                </button>
              </>
            ) : (
              <button type="button" className="drive-btn drive-btn-publish-all" disabled={connecting} onClick={() => void handleConnect()}>
                {connecting ? <Loader2 size={14} className="spin-icon" /> : <Cloud size={14} />} Connect Google Drive
              </button>
            )}
          </div>
        </div>

        {/* Folder Sync Row */}
        <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.9rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(148,163,184,0.14)' }}>
          <input
            type="text"
            className="drive-input"
            style={{ maxWidth: '320px', flex: '1 1 220px' }}
            value={folderName}
            onChange={(e) => { setFolderName(e.target.value); setSelectedFolderId('') }}
            placeholder="Drive folder name (e.g. TNPSC Study Hub Textbooks)"
          />
          <button
            type="button"
            className="drive-btn drive-btn-neutral"
            disabled={!statusData?.connected}
            onClick={async () => {
              setShowFolderPicker((v) => !v)
              if (!showFolderPicker) {
                const res = await apiFetch('/api/drive/folders', { headers: authHeaders })
                const json = await res.json().catch(() => ({}))
                if (res.ok && Array.isArray(json.data)) setFolders(json.data)
              }
            }}
          >
            <FolderOpen size={14} /> Select Folder
          </button>
          <button type="button" className="drive-btn drive-btn-select" disabled={!statusData?.connected || syncing} onClick={() => void handleSync()}>
            {syncing ? <Loader2 size={14} className="spin-icon" /> : <FolderSearch size={14} />}
            <span>{syncing ? `${SYNC_STAGES[syncStageIdx]}...` : 'Sync Drive Textbooks'}</span>
          </button>
          <button type="button" className="drive-btn drive-btn-neutral" onClick={() => setShowLogs((v) => !v)}>
            <History size={14} /> Sync Logs ({syncLogs.length})
          </button>
        </div>

        {showFolderPicker && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '10px', background: 'rgba(2,6,23,0.65)', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '130px', overflowY: 'auto' }}>
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`drive-btn ${selectedFolderId === f.id ? 'drive-btn-select' : 'drive-btn-neutral'}`}
                style={{ height: '30px', fontSize: '0.74rem' }}
                onClick={() => { setSelectedFolderId(f.id); setFolderName(f.name); setShowFolderPicker(false) }}
              >
                <FolderOpen size={12} /> {f.name}
              </button>
            ))}
          </div>
        )}

        {/* Real-Time PostgreSQL KPI Grid */}
        <div className="drive-kpi-grid" style={{ marginTop: '0.95rem' }}>
          <div className="drive-kpi-card">
            <span className="drive-kpi-label">Total Textbooks</span>
            <span className="drive-kpi-val" style={{ color: '#f8fafc' }}>{counts.totalTextbooks}</span>
          </div>
          <div className="drive-kpi-card">
            <span className="drive-kpi-label">Pending Review</span>
            <span className="drive-kpi-val" style={{ color: '#fbbf24' }}>{counts.pendingReview}</span>
          </div>
          <div className="drive-kpi-card">
            <span className="drive-kpi-label">Published Textbooks</span>
            <span className="drive-kpi-val" style={{ color: '#34d399' }}>{counts.publishedTextbooks}</span>
          </div>
          <div className="drive-kpi-card">
            <span className="drive-kpi-label">Unpublished</span>
            <span className="drive-kpi-val" style={{ color: '#cbd5e1' }}>{counts.unpublishedTextbooks}</span>
          </div>
          <div className="drive-kpi-card">
            <span className="drive-kpi-label">Failed Sync</span>
            <span className="drive-kpi-val" style={{ color: '#f87171' }}>{counts.failedSync}</span>
          </div>
          <div className="drive-kpi-card">
            <span className="drive-kpi-label">Unavailable Files</span>
            <span className="drive-kpi-val" style={{ color: '#fb923c' }}>{counts.unavailableFiles}</span>
          </div>
        </div>

        {(banner || statusData?.lastError) && (
          <div
            style={{
              marginTop: '0.85rem',
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

        {showLogs && (
          <div className="drive-table-wrap" style={{ marginTop: '0.8rem' }}>
            <table className="drive-table">
              <thead>
                <tr>
                  <th>Time</th><th>Folder</th><th>Status</th><th>Discovered</th><th>New / Updated / Unchanged</th><th>Missing / Failed</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.started_at).toLocaleString()}</td>
                    <td>{l.folder_name || '-'}</td>
                    <td><span className={`drive-status-pill ${l.status === 'SYNC_COMPLETED' ? 'published' : 'rejected'}`}>{l.status}</span></td>
                    <td>{l.discovered_count}</td>
                    <td>{l.inserted_count} / {l.updated_count} / {l.unchanged_count}</td>
                    <td>{l.missing_count} / {l.failed_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Prominent Global Bulk Management Bar (Accessible Without Checkboxes) */}
      <div className="drive-global-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span className="drive-selection-badge">
            <CheckSquare size={14} />
            SELECTED: {selectedCount} / {counts.totalTextbooks} TEXTBOOKS
          </span>
          {!viewTrash && (
            <>
              <button type="button" className="drive-btn drive-btn-select" style={{ height: '32px', fontSize: '0.75rem' }} onClick={toggleCurrentPage}>
                {allOnPageSelected ? 'Deselect Page' : `Select Page (${books.length})`}
              </button>
              {hasActiveFilters && (
                <button type="button" className="drive-btn drive-btn-select" style={{ height: '32px', fontSize: '0.75rem' }} onClick={selectAllFiltered}>
                  Select All Filtered ({totalFiltered})
                </button>
              )}
              <button type="button" className="drive-btn drive-btn-select" style={{ height: '32px', fontSize: '0.75rem' }} onClick={selectAllDatabase}>
                Select All Database ({counts.totalTextbooks})
              </button>
              {selectedCount > 0 && (
                <button type="button" className="drive-btn drive-btn-neutral" style={{ height: '32px', fontSize: '0.75rem' }} onClick={clearSelection}>
                  Deselect All
                </button>
              )}
            </>
          )}
        </div>

        <div className="drive-global-actions">
          {!viewTrash ? (
            <>
              <button
                type="button"
                className="drive-btn drive-btn-publish-all"
                disabled={counts.totalTextbooks === 0}
                onClick={() => void openPublishModal(hasActiveFilters ? 'filtered' : 'all', hasActiveFilters ? 'All Filtered Textbooks' : 'All Textbooks')}
              >
                <Send size={14} /> PUBLISH ALL
              </button>
              <button
                type="button"
                className="drive-btn drive-btn-neutral"
                disabled={counts.publishedTextbooks === 0}
                onClick={() => void openUnpublishModal(hasActiveFilters ? 'filtered' : 'all', hasActiveFilters ? 'All Filtered Textbooks' : 'All Textbooks')}
              >
                <EyeOff size={14} /> Unpublish All
              </button>
              <button
                type="button"
                className="drive-btn drive-btn-danger"
                disabled={counts.totalTextbooks === 0}
                onClick={() => void openDeleteModal('all', 'All Database Textbooks')}
              >
                <Trash2 size={14} /> DELETE ALL TEXTBOOKS
              </button>
            </>
          ) : (
            <button
              type="button"
              className="drive-btn drive-btn-publish"
              disabled={counts.trashedTextbooks === 0}
              onClick={() => void handleRestoreFromTrash(undefined, true)}
            >
              <RotateCcw size={14} /> Restore All from Trash ({counts.trashedTextbooks})
            </button>
          )}

          <button
            type="button"
            className={`drive-btn ${viewTrash ? 'drive-btn-select' : 'drive-btn-neutral'}`}
            onClick={() => { setViewTrash((v) => !v); setPage(1); clearSelection() }}
          >
            <Trash2 size={14} /> {viewTrash ? 'Back to Active Books' : `Trash (${counts.trashedTextbooks})`}
          </button>
        </div>
      </div>

      {/* 3. Sticky Bulk Action Toolbar (Shown When >= 1 Textbook Selected) */}
      {!viewTrash && selectedCount > 0 && (
        <div className="drive-bulk-sticky">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <span className="drive-selection-badge">{selectedCount} SELECTED</span>
            <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
              Scope: <strong>{selectionMode === 'all' ? 'All Database Textbooks' : selectionMode === 'filtered' ? 'All Filtered Results' : 'Manual Selection'}</strong>
            </span>
          </div>
          <div className="drive-global-actions">
            <button type="button" className="drive-btn drive-btn-select" onClick={selectAllDatabase}>
              Select All ({counts.totalTextbooks})
            </button>
            <button type="button" className="drive-btn drive-btn-publish" onClick={() => void openPublishModal(resolveActiveScopePayload().scope, `${selectedCount} Selected Textbook(s)`)}>
              <Send size={14} /> Publish Selected
            </button>
            <button type="button" className="drive-btn drive-btn-neutral" onClick={() => void openUnpublishModal(resolveActiveScopePayload().scope, `${selectedCount} Selected Textbook(s)`)}>
              <EyeOff size={14} /> Unpublish Selected
            </button>
            <button type="button" className="drive-btn drive-btn-danger" onClick={() => void openDeleteModal(resolveActiveScopePayload().scope, `${selectedCount} Selected Textbook(s)`)}>
              <Trash2 size={14} /> Delete Selected ({selectedCount})
            </button>
            <button type="button" className="drive-btn drive-btn-neutral" onClick={clearSelection}>
              <X size={14} /> Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* 4. Completely Redesigned Responsive Filter Toolbar + Table Card */}
      <div className="drive-lib-card">
        <div className="drive-filter-panel">
          <div className="drive-filter-row">
            <div className="drive-filter-field" style={{ gridColumn: 'span 2' }}>
              <label className="drive-filter-label"><Search size={12} /> Search Textbooks</label>
              <input
                type="text"
                className="drive-input"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search by textbook name, PDF filename, subject, or Drive file ID..."
              />
            </div>

            <GlassSelect
              label="Standard"
              icon={<GraduationCap size={12} />}
              value={standardFilter}
              loading={loading}
              onChange={(v) => { setStandardFilter(v); setPage(1) }}
              options={[
                { value: 'all', label: 'All Standards (6th–12th)', count: facets.standards.reduce((s, o) => s + o.count, 0) },
                ...facets.standards,
              ]}
            />

            <GlassSelect
              label="Term / Volume"
              icon={<Layers size={12} />}
              value={termFilter}
              loading={loading}
              onChange={(v) => { setTermFilter(v); setPage(1) }}
              options={[
                { value: 'all', label: 'All Terms / Volumes', count: facets.termsOrVolumes.reduce((s, o) => s + o.count, 0) },
                ...facets.termsOrVolumes,
              ]}
            />

            <GlassSelect
              label="Medium"
              icon={<Globe size={12} />}
              value={mediumFilter}
              loading={loading}
              onChange={(v) => { setMediumFilter(v); setPage(1) }}
              options={[
                { value: 'all', label: 'All Mediums', count: facets.mediums.reduce((s, o) => s + o.count, 0) },
                ...facets.mediums,
              ]}
            />

            <GlassSelect
              label="Subject"
              icon={<BookOpen size={12} />}
              value={subjectFilter}
              loading={loading}
              onChange={(v) => { setSubjectFilter(v); setPage(1) }}
              options={[
                { value: 'all', label: 'All Available Subjects', count: facets.subjects.reduce((s, o) => s + o.count, 0) },
                ...facets.subjects,
              ]}
            />

            <GlassSelect
              label="Publication Status"
              icon={<Filter size={12} />}
              value={pubFilter}
              loading={loading}
              onChange={(v) => { setPubFilter(v); setPage(1) }}
              options={[
                { value: 'all', label: 'All Statuses', count: facets.statuses.reduce((s, o) => s + o.count, 0) },
                ...facets.statuses,
              ]}
            />
          </div>

          {/* Active Filter Indicators + Quick Scope Delete */}
          {hasActiveFilters && (
            <div className="drive-active-chips">
              <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Active filters:</span>
              {standardFilter !== 'all' && <span className="drive-chip">{standardFilter}th Std <button type="button" onClick={() => setStandardFilter('all')}><X size={11} /></button></span>}
              {termFilter !== 'all' && <span className="drive-chip">{termFilter} <button type="button" onClick={() => setTermFilter('all')}><X size={11} /></button></span>}
              {mediumFilter !== 'all' && <span className="drive-chip">{mediumFilter} <button type="button" onClick={() => setMediumFilter('all')}><X size={11} /></button></span>}
              {subjectFilter !== 'all' && <span className="drive-chip">{subjectFilter} <button type="button" onClick={() => setSubjectFilter('all')}><X size={11} /></button></span>}
              {pubFilter !== 'all' && <span className="drive-chip">{pubFilter} <button type="button" onClick={() => setPubFilter('all')}><X size={11} /></button></span>}
              {search.trim() && <span className="drive-chip">"{search.trim()}" <button type="button" onClick={() => setSearch('')}><X size={11} /></button></span>}
              <button type="button" className="drive-btn drive-btn-neutral" style={{ height: '26px', fontSize: '0.72rem', padding: '0 0.6rem' }} onClick={clearAllFilters}>
                Clear All Filters
              </button>
              {!viewTrash && totalFiltered > 0 && (
                <button type="button" className="drive-btn drive-btn-danger-outline" style={{ height: '26px', fontSize: '0.72rem', padding: '0 0.65rem', marginLeft: 'auto' }} onClick={() => void openDeleteModal('filtered', `All ${totalFiltered} Filtered Textbooks`)}>
                  <Trash2 size={11} /> Delete All Filtered ({totalFiltered})
                </button>
              )}
            </div>
          )}
        </div>

        {/* 5. Redesigned Textbook Table */}
        <div className="drive-table-wrap" style={{ marginTop: '1rem' }}>
          <table className="drive-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  {!viewTrash && <input type="checkbox" checked={allOnPageSelected} onChange={toggleCurrentPage} aria-label="Select current page" />}
                </th>
                <th className="sortable" onClick={() => handleSort('standard')}>Standard <ArrowUpDown size={11} /></th>
                <th>Term / Volume</th>
                <th>Medium</th>
                <th className="sortable" onClick={() => handleSort('subject')}>Subject <ArrowUpDown size={11} /></th>
                <th className="sortable" onClick={() => handleSort('bookName')}>Textbook Name <ArrowUpDown size={11} /></th>
                <th>Google Drive File ID</th>
                <th className="sortable" onClick={() => handleSort('fileSize')}>File Size <ArrowUpDown size={11} /></th>
                <th className="sortable drive-col-status" onClick={() => handleSort('publicationStatus')}>Status <ArrowUpDown size={11} /></th>
                <th className="drive-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {books.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '2.25rem', textAlign: 'center', color: '#94a3b8' }}>
                    <div>{viewTrash ? 'Trash is empty.' : 'No textbooks match the current filters.'}</div>
                    {!viewTrash && hasActiveFilters && (
                      <button
                        type="button"
                        className="drive-btn drive-btn-neutral"
                        style={{ height: '32px', fontSize: '0.76rem', marginTop: '0.75rem' }}
                        onClick={clearAllFilters}
                      >
                        Clear All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                books.map((b) => {
                  const checked = isRowSelected(b.id)
                  const stClass =
                    !b.driveAvailable
                      ? 'unavailable'
                      : b.publicationStatus === 'PUBLISHED'
                        ? 'published'
                        : b.publicationStatus === 'REJECTED'
                          ? 'rejected'
                          : b.publicationStatus === 'UNPUBLISHED'
                            ? 'unpublished'
                            : 'pending'
                  return (
                    <tr key={b.id} className={checked ? 'row-selected' : undefined}>
                      <td>
                        {!viewTrash && (
                          <input type="checkbox" checked={checked} onChange={() => toggleRow(b.id)} aria-label={`Select ${b.bookName}`} />
                        )}
                      </td>
                      <td><span className="drive-std-badge">{b.standard}th</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{b.standard >= 11 ? b.volume || b.term || 'Full Book' : b.term || b.volume || 'Full Year'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{b.medium}</td>
                      <td><span className="drive-subject-badge">{b.subject}</span></td>
                      <td className="drive-col-bookname">
                        <div style={{ fontWeight: 600, color: '#f8fafc', lineHeight: 1.35 }}>{b.bookName}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.driveFolderPath || b.fileName}>
                          {b.driveFolderPath || b.fileName}
                        </div>
                      </td>
                      <td><span className="drive-file-id" title={b.googleDriveFileId}>{b.googleDriveFileId}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatBytes(b.fileSize)}</td>
                      <td className="drive-col-status">
                        <span className={`drive-status-pill ${stClass}`}>
                          {!b.driveAvailable ? 'UNAVAILABLE' : b.publicationStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="drive-col-actions">
                        {viewTrash ? (
                          <button type="button" className="drive-act-btn drive-act-btn--publish" onClick={() => void handleRestoreFromTrash([b.id], false)}>
                            <RotateCcw size={13} /> Restore
                          </button>
                        ) : (
                          <div className="drive-row-actions">
                            <button type="button" className="drive-act-btn drive-act-btn--view" title="Preview PDF" onClick={() => { setPreviewZoom(100); setPreviewBook(b) }}>
                              <Eye size={13} /> View
                            </button>
                            <button type="button" className="drive-act-btn drive-act-btn--edit" title="Edit Metadata" onClick={() => setEditingBook({ ...b })}>
                              <Edit3 size={13} /> Edit
                            </button>
                            <button type="button" className="drive-act-btn drive-act-btn--edit drive-act-btn--icon" title="Sync from Drive" disabled={busyId === b.id} onClick={() => void handleResyncSingle(b.id)}>
                              <RefreshCw size={13} className={busyId === b.id ? 'spin-icon' : undefined} />
                            </button>
                            {b.publicationStatus === 'PUBLISHED' ? (
                              <button type="button" className="drive-act-btn drive-act-btn--unpublish" disabled={busyId === b.id} onClick={() => void handleRowAction(b.id, 'unpublish')}>
                                Unpublish
                              </button>
                            ) : (
                              <button type="button" className="drive-act-btn drive-act-btn--publish" disabled={busyId === b.id} onClick={() => void handleRowAction(b.id, 'publish')}>
                                Publish
                              </button>
                            )}
                            <button
                              type="button"
                              className="drive-act-btn drive-act-btn--delete drive-act-btn--icon"
                              title="Delete (Move to Trash)"
                              onClick={() => {
                                setSelectionMode('manual')
                                setSelectedIds([b.id])
                                setDeleteModal({ scope: 'selected', label: `"${b.bookName}"`, totalMatched: 1, confirmInput: '', executing: false })
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="drive-pagination-bar">
          <div>
            Showing <strong>{startRow}–{endRow}</strong> of <strong>{totalFiltered}</strong> textbooks
            {hasActiveFilters ? ` (filtered from ${counts.totalTextbooks} total)` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <select
              className="drive-select"
              style={{ width: '125px', height: '34px', fontSize: '0.78rem' }}
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
            <button type="button" className="drive-btn drive-btn-neutral" style={{ height: '34px', padding: '0 0.65rem' }} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft size={14} /> Prev
            </button>
            <span>Page <strong>{page}</strong> / {totalPages}</span>
            <button type="button" className="drive-btn drive-btn-neutral" style={{ height: '34px', padding: '0 0.65rem' }} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* PUBLISH ALL / BULK PUBLISH CONFIRMATION MODAL */}
      {publishModal && (
        <div className="drive-fullscreen-modal" onClick={() => !publishModal.executing && setPublishModal(null)}>
          <div className="drive-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="drive-modal-head">
              <strong style={{ color: '#f8fafc', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Send size={17} style={{ color: '#34d399' }} /> Confirm Bulk Publish ({publishModal.label})
              </strong>
              <button type="button" className="admin-modal-close" onClick={() => !publishModal.executing && setPublishModal(null)}><X size={18} /></button>
            </div>
            <div className="drive-modal-body">
              <p style={{ margin: 0 }}>Are you sure you want to publish all eligible textbooks to the Student Textbook Library?</p>
              {publishModal.loadingPreview ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Loader2 size={16} className="spin-icon" /> Validating metadata & eligibility...</div>
              ) : publishModal.preview ? (
                <>
                  <div className="drive-summary-grid">
                    <div className="drive-summary-cell"><div className="drive-kpi-label">Total Matched</div><div className="drive-kpi-val" style={{ color: '#f8fafc' }}>{publishModal.preview.totalMatched}</div></div>
                    <div className="drive-summary-cell"><div className="drive-kpi-label">Eligible to Publish</div><div className="drive-kpi-val" style={{ color: '#34d399' }}>{publishModal.preview.eligibleToPublish}</div></div>
                    <div className="drive-summary-cell"><div className="drive-kpi-label">Already Published</div><div className="drive-kpi-val" style={{ color: '#38bdf8' }}>{publishModal.preview.alreadyPublished}</div></div>
                    <div className="drive-summary-cell"><div className="drive-kpi-label">Failed Validation</div><div className="drive-kpi-val" style={{ color: '#fca5a5' }}>{publishModal.preview.failedValidationCount}</div></div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer', padding: '0.6rem 0.75rem', borderRadius: '10px', background: 'rgba(124,58,237,0.14)', border: '1px solid rgba(167,139,250,0.35)' }}>
                    <input
                      type="checkbox"
                      checked={publishModal.approvePending}
                      onChange={(e) => void togglePublishApprovePending(e.target.checked)}
                    />
                    <span>Explicitly bulk-approve &amp; publish <strong>{publishModal.preview.pendingReview}</strong> Pending Review textbook(s) (Super Admin)</span>
                  </label>
                  {publishModal.result && (
                    <div style={{ padding: '0.7rem', borderRadius: '10px', background: 'rgba(16,185,129,0.16)', border: '1px solid rgba(52,211,153,0.4)', color: '#6ee7b7' }}>
                      Successfully Published: <strong>{publishModal.result.publishedCount}</strong> • Skipped: <strong>{publishModal.result.skippedCount}</strong> • Failed: <strong>{publishModal.result.failedCount}</strong>
                    </div>
                  )}
                </>
              ) : null}
            </div>
            <div className="drive-modal-foot">
              <button type="button" className="drive-btn drive-btn-neutral" disabled={publishModal.executing} onClick={() => setPublishModal(null)}>
                {publishModal.result ? 'Close' : 'Cancel'}
              </button>
              {!publishModal.result && (
                <button
                  type="button"
                  className="drive-btn drive-btn-publish-all"
                  disabled={publishModal.loadingPreview || publishModal.executing || (publishModal.preview?.eligibleToPublish ?? 0) === 0}
                  onClick={() => void confirmBulkPublish()}
                >
                  {publishModal.executing ? <Loader2 size={14} className="spin-icon" /> : <Send size={14} />}
                  <span>{publishModal.executing ? 'Publishing...' : `Confirm Publish (${publishModal.preview?.eligibleToPublish ?? 0})`}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UNPUBLISH CONFIRMATION MODAL */}
      {unpublishModal && (
        <div className="drive-fullscreen-modal" onClick={() => !unpublishModal.executing && setUnpublishModal(null)}>
          <div className="drive-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="drive-modal-head">
              <strong style={{ color: '#f8fafc' }}>Confirm Unpublish ({unpublishModal.label})</strong>
              <button type="button" className="admin-modal-close" onClick={() => setUnpublishModal(null)}><X size={18} /></button>
            </div>
            <div className="drive-modal-body">
              <p style={{ margin: 0 }}>
                Unpublish <strong>{unpublishModal.totalMatched}</strong> textbook record(s)? They will be immediately hidden from the Student Textbook Library. Original Google Drive PDFs and metadata will be preserved.
              </p>
            </div>
            <div className="drive-modal-foot">
              <button type="button" className="drive-btn drive-btn-neutral" disabled={unpublishModal.executing} onClick={() => setUnpublishModal(null)}>Cancel</button>
              <button type="button" className="drive-btn drive-btn-select" disabled={unpublishModal.executing} onClick={() => void confirmBulkUnpublish()}>
                {unpublishModal.executing ? 'Unpublishing...' : 'Confirm Unpublish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN GLOBAL DELETE / DELETE SELECTED MODAL */}
      {deleteModal && (
        <div className="drive-fullscreen-modal" onClick={() => !deleteModal.executing && setDeleteModal(null)}>
          <div className="drive-modal-box drive-modal-box--danger" onClick={(e) => e.stopPropagation()}>
            <div className="drive-modal-head" style={{ background: 'rgba(239,68,68,0.14)' }}>
              <strong style={{ color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} />
                {deleteModal.scope === 'selected' ? 'CONFIRM TEXTBOOK DELETION' : 'WARNING: GLOBAL TEXTBOOK DELETION'}
              </strong>
              <button type="button" className="admin-modal-close" onClick={() => setDeleteModal(null)}><X size={18} /></button>
            </div>
            <div className="drive-modal-body">
              {deleteModal.scope !== 'selected' && (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {[
                    { s: 'all' as BulkScope, lbl: `All Textbooks (${counts.totalTextbooks})` },
                    { s: 'filtered' as BulkScope, lbl: `Filtered (${totalFiltered})` },
                    { s: 'pending_review' as BulkScope, lbl: `Pending Review (${counts.pendingReview})` },
                    { s: 'published' as BulkScope, lbl: `Published (${counts.publishedTextbooks})` },
                  ].map((opt) => (
                    <button
                      key={opt.s}
                      type="button"
                      className={`drive-btn ${deleteModal.scope === opt.s ? 'drive-btn-danger' : 'drive-btn-neutral'}`}
                      style={{ height: '30px', fontSize: '0.73rem' }}
                      onClick={() => void openDeleteModal(opt.s, opt.lbl)}
                    >
                      {opt.lbl}
                    </button>
                  ))}
                </div>
              )}
              <p style={{ margin: 0 }}>
                You are about to remove <strong>{deleteModal.totalMatched}</strong> textbook record(s) from the Admin Textbook Management list and Student Textbook Library.
              </p>
              <div style={{ padding: '0.7rem 0.9rem', borderRadius: '10px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(52,211,153,0.35)', color: '#6ee7b7', fontSize: '0.8rem' }}>
                <strong>Safe Soft-Delete:</strong> Original Google Drive PDFs will <strong>NOT</strong> be deleted, and records can be restored from Trash. Unrelated Study Notes, MCQs, and Student records are untouched.
              </div>
              {deleteModal.scope !== 'selected' && (
                <div>
                  <label className="drive-filter-label" style={{ color: '#fca5a5', marginBottom: '0.35rem' }}>
                    Type exact phrase <code>DELETE ALL TEXTBOOKS</code> to confirm:
                  </label>
                  <input
                    type="text"
                    className="drive-input"
                    value={deleteModal.confirmInput}
                    onChange={(e) => setDeleteModal({ ...deleteModal, confirmInput: e.target.value })}
                    placeholder="DELETE ALL TEXTBOOKS"
                  />
                </div>
              )}
            </div>
            <div className="drive-modal-foot">
              <button type="button" className="drive-btn drive-btn-neutral" disabled={deleteModal.executing} onClick={() => setDeleteModal(null)}>Cancel</button>
              <button
                type="button"
                className="drive-btn drive-btn-danger"
                disabled={
                  deleteModal.executing ||
                  deleteModal.totalMatched === 0 ||
                  (deleteModal.scope !== 'selected' && deleteModal.confirmInput.trim() !== 'DELETE ALL TEXTBOOKS')
                }
                onClick={() => void confirmBulkDelete()}
              >
                <Trash2 size={14} /> {deleteModal.executing ? 'Deleting...' : `Delete ${deleteModal.totalMatched} Textbook(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT METADATA MODAL */}
      {editingBook && (
        <div className="drive-fullscreen-modal" onClick={() => setEditingBook(null)}>
          <div className="drive-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="drive-modal-head">
              <strong style={{ color: '#f8fafc' }}>Edit Textbook Metadata</strong>
              <button type="button" className="admin-modal-close" onClick={() => setEditingBook(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveMetadata} className="drive-modal-body">
              <div className="drive-filter-field">
                <label className="drive-filter-label">Textbook Title</label>
                <input type="text" required className="drive-input" value={editingBook.bookName} onChange={(e) => setEditingBook({ ...editingBook, bookName: e.target.value })} />
              </div>
              <div className="drive-summary-grid">
                <div className="drive-filter-field">
                  <label className="drive-filter-label">Standard</label>
                  <select className="drive-select" value={editingBook.standard} onChange={(e) => setEditingBook({ ...editingBook, standard: Number(e.target.value) })}>
                    {[6, 7, 8, 9, 10, 11, 12].map((s) => <option key={s} value={s}>{s}th Standard</option>)}
                  </select>
                </div>
                <div className="drive-filter-field">
                  <label className="drive-filter-label">Subject</label>
                  <input type="text" required className="drive-input" value={editingBook.subject} onChange={(e) => setEditingBook({ ...editingBook, subject: e.target.value })} />
                </div>
                <div className="drive-filter-field">
                  <label className="drive-filter-label">Medium</label>
                  <select className="drive-select" value={editingBook.medium} onChange={(e) => setEditingBook({ ...editingBook, medium: e.target.value as 'Tamil' | 'English' })}>
                    <option value="English">English</option>
                    <option value="Tamil">Tamil</option>
                  </select>
                </div>
                <div className="drive-filter-field">
                  <label className="drive-filter-label">{editingBook.standard >= 11 ? 'Volume' : 'Term'}</label>
                  <input
                    type="text"
                    className="drive-input"
                    value={editingBook.standard >= 11 ? editingBook.volume || '' : editingBook.term || ''}
                    onChange={(e) =>
                      editingBook.standard >= 11
                        ? setEditingBook({ ...editingBook, volume: e.target.value || null })
                        : setEditingBook({ ...editingBook, term: e.target.value || null })
                    }
                  />
                </div>
              </div>
              <div className="drive-modal-foot" style={{ padding: '0.75rem 0 0', borderTop: 'none' }}>
                <button type="button" className="drive-btn drive-btn-neutral" onClick={() => setEditingBook(null)}>Cancel</button>
                <button type="submit" className="drive-btn drive-btn-publish" disabled={savingEdit}>
                  <Save size={14} /> {savingEdit ? 'Saving...' : 'Save Metadata'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECURE PDF PREVIEW MODAL */}
      {previewBook && (
        <div className="drive-fullscreen-modal" onClick={() => setPreviewBook(null)}>
          <div className="drive-modal-box" style={{ maxWidth: '1040px', height: '88vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="drive-modal-head">
              <div>
                <strong style={{ color: '#f8fafc' }}>{previewBook.bookName}</strong>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {previewBook.standard}th • {previewBook.subject} • {previewBook.medium} • {formatBytes(previewBook.fileSize)}
                </div>
              </div>
              <div className="drive-global-actions">
                <button type="button" className="drive-btn drive-btn-neutral" style={{ height: '32px' }} onClick={() => setPreviewZoom((z) => Math.max(60, z - 15))}><ZoomOut size={14} /></button>
                <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{previewZoom}%</span>
                <button type="button" className="drive-btn drive-btn-neutral" style={{ height: '32px' }} onClick={() => setPreviewZoom((z) => Math.min(180, z + 15))}><ZoomIn size={14} /></button>
                <button type="button" className="drive-btn drive-btn-danger-outline" style={{ height: '32px' }} onClick={() => void handleRowAction(previewBook.id, 'reject')}><XCircle size={14} /> Reject</button>
                <button type="button" className="drive-btn drive-btn-publish" style={{ height: '32px' }} onClick={() => void handleRowAction(previewBook.id, 'publish')}><Send size={14} /> Publish</button>
                <button type="button" className="admin-modal-close" onClick={() => setPreviewBook(null)}><X size={18} /></button>
              </div>
            </div>
            <div style={{ flex: 1, padding: '0.5rem', background: '#020617' }}>
              <iframe
                src={`${getAuthenticatedApiUrl(`/api/drive/files/${previewBook.id}/preview`)}#toolbar=1&navpanes=1&zoom=${previewZoom}`}
                title={previewBook.bookName}
                style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
