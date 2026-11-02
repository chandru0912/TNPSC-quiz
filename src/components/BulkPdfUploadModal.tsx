import React, { useState, useRef, useMemo, useCallback } from 'react'
import {
  X,
  Upload,
  FolderUp,
  FileText,
  Layers,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Edit,
  Eye,
  Sparkles,
  HardDrive,
  Check,
} from 'lucide-react'
import './BulkPdfUploadModal.css'
import { ClassificationEditModal } from './ClassificationEditModal'
import { ExtractedContentsViewerModal } from './ExtractedContentsViewerModal'
import type { ClassifiedPdfMetadata } from '../../backend/src/services/bulkClassificationService'
import { apiFetch } from '../utils/api'

export interface BulkUploadItem {
  id: string;
  file: File;
  checksum?: string;
  status: 'pending' | 'analyzing' | 'classified' | 'approved' | 'uploading' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  metadata?: ClassifiedPdfMetadata;
  googleDriveFileId?: string;
  errorMessage?: string;
}

interface BulkPdfUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (summary: { totalUploaded: number; totalUnits: number; totalLessons: number }) => void;
  // Single upload props passed down to preserve existing single upload 100%
  singleUploadProps?: {
    driveFile: File | null;
    setDriveFile: (f: File | null) => void;
    driveUploadTitle: string;
    setDriveUploadTitle: (t: string) => void;
    driveUploadTerm: string;
    setDriveUploadTerm: (t: string) => void;
    isDriveUploading: boolean;
    driveUploadProgress: number;
    driveUploadStep: string;
    driveUploadError: string | null;
    driveSyllabusCascade: any;
    handleSingleDriveUpload: () => void;
  };
}

async function computeFileSha256(file: File): Promise<string> {
  try {
    // Read up to first 4 MB for lightning-fast deterministic checksum in browser
    const slice = file.slice(0, 4 * 1024 * 1024)
    const arrayBuffer = await slice.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch (err) {
    return `hash_${file.name}_${file.size}_${file.lastModified}`
  }
}

export const BulkPdfUploadModal: React.FC<BulkPdfUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  singleUploadProps,
}) => {
  if (!isOpen) return null

  // Tab mode: 'bulk' or 'single'
  const [activeTab, setActiveTab] = useState<'bulk' | 'single'>('bulk')

  // Bulk File Queue
  const [items, setItems] = useState<BulkUploadItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'approved' | 'completed' | 'failed'>('all')

  // Modals for editing & viewing
  const [editingItem, setEditingItem] = useState<ClassifiedPdfMetadata | null>(null)
  const [viewingItem, setViewingItem] = useState<ClassifiedPdfMetadata | null>(null)

  // Upload runner state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const isCancelledRef = useRef(false)
  const [overallProgress, setOverallProgress] = useState(0)

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // ----------------------------------------------------------------------------
  // File Intake Handlers
  // ----------------------------------------------------------------------------
  const handleAddFiles = useCallback(async (newFiles: FileList | File[]) => {
    const pdfFiles = Array.from(newFiles).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    )

    if (pdfFiles.length === 0) return

    const newItems: BulkUploadItem[] = []
    for (const file of pdfFiles) {
      const id = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      newItems.push({
        id,
        file,
        status: 'pending',
        progress: 0,
        currentStep: 'Awaiting analysis',
      })
    }

    setItems((prev) => [...prev, ...newItems])

    // Asynchronously compute checksums in background
    for (const it of newItems) {
      computeFileSha256(it.file).then((checksum) => {
        setItems((prev) =>
          prev.map((item) => (item.id === it.id ? { ...item, checksum } : item))
        )
      })
    }
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      handleAddFiles(e.dataTransfer.files)
    }
  }

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleClearAll = () => {
    if (isUploading) return
    setItems([])
    setSelectedIds(new Set())
  }

  const handleSelectAll = () => {
    const allIds = new Set(filteredItems.map((i) => i.id))
    setSelectedIds(allIds)
  }

  const handleDeselectAll = () => {
    setSelectedIds(new Set())
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ----------------------------------------------------------------------------
  // Automatic Classification
  // ----------------------------------------------------------------------------
  const handleAnalyzeAll = async () => {
    if (items.length === 0 || isAnalyzing) return

    setIsAnalyzing(true)
    try {
      const token = localStorage.getItem('tnpsc_admin_token') || ''
      const payload = items.map((i) => ({
        fileName: i.file.name,
        fileSize: i.file.size,
        checksum: i.checksum,
      }))

      const res = await apiFetch('/api/drive/bulk/classify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ files: payload }),
      })

      const data = await res.json()
      if (res.ok && Array.isArray(data.data)) {
        const classifiedMap = new Map<string, ClassifiedPdfMetadata>()
        data.data.forEach((meta: ClassifiedPdfMetadata) => {
          classifiedMap.set(meta.fileName, meta)
        })

        setItems((prev) =>
          prev.map((item) => {
            const meta = classifiedMap.get(item.file.name)
            if (meta) {
              const isHigh = meta.confidenceLevel === 'high'
              return {
                ...item,
                status: isHigh ? 'approved' : 'classified',
                metadata: meta,
                currentStep: isHigh ? 'Auto-approved (High Confidence)' : 'Requires Review',
              }
            }
            return item
          })
        )
      }
    } catch (err: any) {
      console.error('[BulkAnalysis] Error:', err.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleApproveAll = () => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.metadata && (item.status === 'classified' || item.status === 'pending')) {
          return {
            ...item,
            status: 'approved',
            currentStep: 'Approved & ready for upload',
          }
        }
        return item
      })
    )
  }

  const handleApproveSelected = () => {
    setItems((prev) =>
      prev.map((item) => {
        if (selectedIds.has(item.id) && item.metadata) {
          return {
            ...item,
            status: 'approved',
            currentStep: 'Approved & ready for upload',
          }
        }
        return item
      })
    )
  }

  const handleSaveClassification = (updatedMeta: ClassifiedPdfMetadata) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.metadata?.fileName === updatedMeta.fileName) {
          return {
            ...item,
            metadata: updatedMeta,
            status: 'approved',
            currentStep: 'Manually verified & approved',
          }
        }
        return item
      })
    )
  }

  // ----------------------------------------------------------------------------
  // Direct-to-Drive Resumable Upload Engine (Bounded Concurrency = 3)
  // ----------------------------------------------------------------------------
  const uploadSinglePdfDirect = async (item: BulkUploadItem, batchId: string): Promise<void> => {
    const token = localStorage.getItem('tnpsc_admin_token') || ''
    const file = item.file
    const meta = item.metadata!

    // 1. Initiate Resumable Upload
    const initRes = await apiFetch('/api/drive/upload/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileName: `${meta.bookName}.pdf`,
        originalFileName: file.name,
        fileSize: file.size,
        mimeType: 'application/pdf',
        origin: window.location.origin,
        group: meta.primaryGroup || 'group1',
        subject: meta.subject,
        standard: meta.standardNumber,
        term: meta.term,
        unit: meta.units[0]?.unitNumber || 1,
        lesson: meta.units[0]?.lessons[0]?.title || null,
        lessonId: meta.units[0]?.lessons[0]?.lessonId || null,
      }),
    })

    const initData = await initRes.json()
    if (!initRes.ok || !initData.data?.uploadUrl) {
      throw new Error(initData.message || 'Failed to initiate Google Drive upload session.')
    }

    const { uploadUrl, trackingId } = initData.data

    // 2. Stream in 5 MB chunks directly from browser to Google Drive
    const CHUNK_SIZE = 5 * 1024 * 1024
    const totalSize = file.size
    let currentOffset = 0
    let driveFileId = ''

    while (currentOffset < totalSize && !isCancelledRef.current) {
      const chunkEnd = Math.min(currentOffset + CHUNK_SIZE - 1, totalSize - 1)
      const chunkBlob = file.slice(currentOffset, chunkEnd + 1)
      const contentRange = `bytes ${currentOffset}-${chunkEnd}/${totalSize}`

      const chunkResult = await new Promise<{ status: number; range?: string; fileId?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl, true)
        xhr.setRequestHeader('Content-Range', contentRange)
        xhr.setRequestHeader('Content-Type', 'application/pdf')

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const loadedBytes = currentOffset + evt.loaded
            const pct = Math.min(95, Math.round((loadedBytes / totalSize) * 90))
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      progress: pct,
                      currentStep: `Uploading ${(loadedBytes / (1024 * 1024)).toFixed(1)} / ${(totalSize / (1024 * 1024)).toFixed(1)} MB (${pct}%)`,
                    }
                  : i
              )
            )
          }
        }

        xhr.onload = () => {
          if (xhr.status === 308) {
            resolve({ status: 308, range: xhr.getResponseHeader('Range') || undefined })
          } else if (xhr.status === 200 || xhr.status === 201) {
            try {
              const d = JSON.parse(xhr.responseText || '{}')
              resolve({ status: xhr.status, fileId: d.id })
            } catch {
              resolve({ status: xhr.status })
            }
          } else {
            reject(new Error(`Drive HTTP ${xhr.status}: ${xhr.statusText}`))
          }
        }

        xhr.onerror = () => reject(new Error('Network error during Google Drive resumable streaming.'))
        xhr.timeout = 180000
        xhr.ontimeout = () => reject(new Error('Chunk upload timed out.'))
        xhr.send(chunkBlob)
      })

      if (chunkResult.status === 308) {
        if (chunkResult.range) {
          const m = chunkResult.range.match(/bytes=0-(\d+)/)
          currentOffset = m && m[1] ? parseInt(m[1], 10) + 1 : chunkEnd + 1
        } else {
          currentOffset = chunkEnd + 1
        }
      } else if (chunkResult.status === 200 || chunkResult.status === 201) {
        driveFileId = chunkResult.fileId || ''
        currentOffset = totalSize
      }
    }

    if (isCancelledRef.current) {
      throw new Error('Upload cancelled by user.')
    }

    // 3. Atomically register across all applicable groups
    const regRes = await apiFetch('/api/drive/bulk/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        trackingId,
        googleDriveFileId: driveFileId,
        metadata: meta,
        batchId,
      }),
    })

    if (!regRes.ok) {
      const regData = await regRes.json()
      throw new Error(regData.message || 'Failed to complete registration.')
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              status: 'completed',
              progress: 100,
              googleDriveFileId: driveFileId,
              currentStep: 'Verified & Registered in Syllabus',
            }
          : i
      )
    )
  }

  const handleStartBulkUpload = async () => {
    const approvedItems = items.filter((i) => i.status === 'approved' && i.metadata)
    if (approvedItems.length === 0 || isUploading) return

    setIsUploading(true)
    isCancelledRef.current = false
    const batchId = `batch_${Date.now()}`

    // Bounded concurrency pool (3 parallel workers)
    const CONCURRENCY = 3
    let index = 0
    let activeWorkers = 0
    let totalCompleted = 0

    return new Promise<void>((resolve) => {
      const next = () => {
        if (isCancelledRef.current || index >= approvedItems.length) {
          if (activeWorkers === 0) {
            setIsUploading(false)
            // Report summary
            const completedList = items.filter((i) => i.status === 'completed' && i.metadata)
            const units = completedList.reduce((acc, i) => acc + (i.metadata?.totalUnits || 0), 0)
            const lessons = completedList.reduce((acc, i) => acc + (i.metadata?.totalLessons || 0), 0)
            onUploadSuccess({
              totalUploaded: completedList.length,
              totalUnits: units,
              totalLessons: lessons,
            })
            resolve()
          }
          return
        }

        const currentItem = approvedItems[index++]
        activeWorkers++

        setItems((prev) =>
          prev.map((i) =>
            i.id === currentItem.id ? { ...i, status: 'uploading', currentStep: 'Initiating streaming...' } : i
          )
        )

        uploadSinglePdfDirect(currentItem, batchId)
          .then(() => {
            totalCompleted++
            setOverallProgress(Math.round((totalCompleted / approvedItems.length) * 100))
          })
          .catch((err) => {
            setItems((prev) =>
              prev.map((i) =>
                i.id === currentItem.id
                  ? {
                      ...i,
                      status: 'failed',
                      errorMessage: err.message || 'Upload failed',
                      currentStep: 'Failed',
                    }
                  : i
              )
            )
          })
          .finally(() => {
            activeWorkers--
            next()
          })
      }

      for (let w = 0; w < CONCURRENCY; w++) {
        next()
      }
    })
  }

  const handleRetryFailed = () => {
    setItems((prev) =>
      prev.map((i) => (i.status === 'failed' ? { ...i, status: 'approved', progress: 0, errorMessage: undefined } : i))
    )
  }

  // ----------------------------------------------------------------------------
  // Filtered Items & Summary
  // ----------------------------------------------------------------------------
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === 'all') return true
      if (statusFilter === 'high') return item.metadata?.confidenceLevel === 'high'
      if (statusFilter === 'medium') return item.metadata?.confidenceLevel === 'medium'
      if (statusFilter === 'low') return item.metadata?.confidenceLevel === 'low'
      if (statusFilter === 'approved') return item.status === 'approved'
      if (statusFilter === 'completed') return item.status === 'completed'
      if (statusFilter === 'failed') return item.status === 'failed'
      return true
    })
  }, [items, statusFilter])

  const totalFiles = items.length
  const totalSizeBytes = items.reduce((acc, i) => acc + i.file.size, 0)
  const totalSizeMb = (totalSizeBytes / (1024 * 1024)).toFixed(1)
  const approvedCount = items.filter((i) => i.status === 'approved').length
  const completedCount = items.filter((i) => i.status === 'completed').length
  const failedCount = items.filter((i) => i.status === 'failed').length

  return (
    <>
      <div className="bulk-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="bulk-modal-container">
          {/* Header */}
          <div className="bulk-modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.18)',
                  color: '#60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <HardDrive size={22} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Google Drive Textbook Uploader</h2>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Stream Samacheer Kalvi textbooks directly into "TNPSC Study Hub Materials" folder
                </p>
              </div>
            </div>

            {/* Segmented Mode Switcher */}
            <div className="bulk-modal-tabs">
              <button
                className={`bulk-tab-btn ${activeTab === 'bulk' ? 'active' : ''}`}
                onClick={() => setActiveTab('bulk')}
              >
                <FolderUp size={15} />
                Bulk PDF Upload (Multi-File)
              </button>
              <button
                className={`bulk-tab-btn ${activeTab === 'single' ? 'active' : ''}`}
                onClick={() => setActiveTab('single')}
              >
                <FileText size={15} />
                Single PDF Upload
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '0.4rem',
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          {activeTab === 'single' ? (
            /* Single Upload Mode (Existing Functionality Preserved 100%) */
            <div style={{ padding: '1.75rem', overflowY: 'auto', flex: 1 }}>
              {singleUploadProps ? (
                <div style={{ maxWidth: '650px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#93c5fd', marginBottom: '0.25rem' }}>
                      Standard Single Upload Mode
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                      Upload one textbook and manually specify its exact syllabus cascade.
                    </div>
                  </div>

                  {/* Syllabus Cascade Selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                      TNPSC Syllabus Cascade Mapping
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                      {/* Standard */}
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Standard:</span>
                        <select
                          value={singleUploadProps.driveSyllabusCascade.currentClassId || 6}
                          onChange={(e) => singleUploadProps.driveSyllabusCascade.setCurrentClassId(Number(e.target.value))}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                        >
                          {[6, 7, 8, 9, 10, 11, 12].map((s) => (
                            <option key={s} value={s}>{s}th Standard</option>
                          ))}
                        </select>
                      </div>

                      {/* Subject */}
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Subject:</span>
                        <select
                          value={singleUploadProps.driveSyllabusCascade.currentSubjectId || 'general-studies'}
                          onChange={(e) => singleUploadProps.driveSyllabusCascade.setCurrentSubjectId(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                        >
                          {singleUploadProps.driveSyllabusCascade.availableSubjects.map((s: any) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Term */}
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Term / Volume:</span>
                        <select
                          value={singleUploadProps.driveUploadTerm}
                          onChange={(e) => singleUploadProps.setDriveUploadTerm(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                        >
                          {['Term 1', 'Term 2', 'Term 3', 'Volume 1', 'Volume 2', 'Full Year'].map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Title & File Input */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                      PDF Document Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Samacheer Kalvi 6th Standard Tamil Term 1"
                      value={singleUploadProps.driveUploadTitle}
                      onChange={(e) => singleUploadProps.setDriveUploadTitle(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                      Select PDF File
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => singleUploadProps.setDriveFile(e.target.files?.[0] || null)}
                      style={{ color: '#cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Single Progress */}
                  {singleUploadProps.isDriveUploading && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                        <span>{singleUploadProps.driveUploadStep}</span>
                        <span>{singleUploadProps.driveUploadProgress}%</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${singleUploadProps.driveUploadProgress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.2s' }} />
                      </div>
                    </div>
                  )}

                  {singleUploadProps.driveUploadError && (
                    <div style={{ color: '#f87171', fontSize: '0.82rem', padding: '0.5rem', background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>
                      {singleUploadProps.driveUploadError}
                    </div>
                  )}

                  <button
                    disabled={singleUploadProps.isDriveUploading || !singleUploadProps.driveFile}
                    onClick={singleUploadProps.handleSingleDriveUpload}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: singleUploadProps.driveFile ? '#3b82f6' : '#334155',
                      color: '#fff',
                      fontWeight: 600,
                      border: 'none',
                      cursor: singleUploadProps.driveFile ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {singleUploadProps.isDriveUploading ? 'Streaming to Google Drive...' : 'Upload Single PDF'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            /* Bulk Upload Mode (Advanced Multi-File Intake & Automatic Classification) */
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: '1.25rem 1.75rem' }}>
              {items.length === 0 ? (
                /* Empty State: Dropzone */
                <div
                  className={`bulk-dropzone ${isDragging ? 'dragging' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  style={{ margin: 'auto 0' }}
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '16px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1rem',
                    }}
                  >
                    <FolderUp size={32} />
                  </div>
                  <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.2rem', fontWeight: 600 }}>
                    Drag & Drop Samacheer Kalvi PDFs Here
                  </h3>
                  <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#94a3b8', maxWidth: '460px' }}>
                    Select individual files or an entire folder of 6th to 12th standard textbooks.
                    Our AI classifier will automatically match each book with the TNPSC syllabus.
                  </p>

                  <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: '0.65rem 1.25rem',
                        borderRadius: '8px',
                        background: '#3b82f6',
                        color: '#fff',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <Upload size={16} />
                      Select Multiple PDFs
                    </button>
                    <button
                      onClick={() => folderInputRef.current?.click()}
                      style={{
                        padding: '0.65rem 1.25rem',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#fff',
                        fontWeight: 600,
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <FolderUp size={16} />
                      Select Entire Folder
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files && handleAddFiles(e.target.files)}
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    multiple
                    accept=".pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files && handleAddFiles(e.target.files)}
                  />
                </div>
              ) : (
                /* Active Queue & Review Table */
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: '1rem' }}>
                  {/* Top Toolbar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f1f5f9' }}>
                        {totalFiles} PDF(s) Selected • {totalSizeMb} MB
                      </span>
                      {approvedCount > 0 && (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.3)' }}>
                          {approvedCount} Approved
                        </span>
                      )}
                      {completedCount > 0 && (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)' }}>
                          {completedCount} Uploaded
                        </span>
                      )}
                      {failedCount > 0 && (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.3)' }}>
                          {failedCount} Failed
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Upload size={14} /> Add More
                      </button>
                      <button
                        onClick={handleSelectAll}
                        style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1', fontSize: '0.78rem', cursor: 'pointer' }}
                      >
                        Select All
                      </button>
                      <button
                        onClick={handleDeselectAll}
                        style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1', fontSize: '0.78rem', cursor: 'pointer' }}
                      >
                        Deselect All
                      </button>
                      <button
                        onClick={handleClearAll}
                        style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Trash2 size={14} /> Clear All
                      </button>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {(
                      [
                        { id: 'all', label: 'All Files' },
                        { id: 'high', label: 'High Confidence' },
                        { id: 'medium', label: 'Needs Review' },
                        { id: 'low', label: 'Low Confidence' },
                        { id: 'approved', label: 'Approved' },
                        { id: 'completed', label: 'Uploaded' },
                        { id: 'failed', label: 'Failed' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setStatusFilter(f.id)}
                        style={{
                          padding: '0.3rem 0.75rem',
                          borderRadius: '999px',
                          border: statusFilter === f.id ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)',
                          background: statusFilter === f.id ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.03)',
                          color: statusFilter === f.id ? '#93c5fd' : '#94a3b8',
                          fontSize: '0.76rem',
                          cursor: 'pointer',
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Review Table */}
                  <div className="bulk-table-container">
                    <table className="bulk-table">
                      <thead>
                        <tr>
                          <th style={{ width: '36px' }}>
                            <input
                              type="checkbox"
                              checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                              onChange={(e) => (e.target.checked ? handleSelectAll() : handleDeselectAll())}
                            />
                          </th>
                          <th>File Name</th>
                          <th>Standard</th>
                          <th>Subject</th>
                          <th>Medium</th>
                          <th>Term</th>
                          <th>Units & Lessons</th>
                          <th>Groups</th>
                          <th>Confidence</th>
                          <th>Status / Progress</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.map((item) => {
                          const meta = item.metadata
                          const isSelected = selectedIds.has(item.id)
                          return (
                            <tr key={item.id} style={{ background: isSelected ? 'rgba(59, 130, 246, 0.08)' : undefined }}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelect(item.id)}
                                />
                              </td>
                              <td>
                                <div style={{ fontWeight: 500, color: '#f1f5f9' }}>{item.file.name}</div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                  {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                                </div>
                              </td>
                              <td>
                                {meta ? (
                                  <span style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                    {meta.standard}
                                  </span>
                                ) : (
                                  <span style={{ color: '#64748b' }}>-</span>
                                )}
                              </td>
                              <td>
                                {meta ? (
                                  <div>
                                    <span style={{ color: '#93c5fd', fontWeight: 500 }}>{meta.subject}</span>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{meta.tamilSubjectName}</div>
                                  </div>
                                ) : (
                                  <span style={{ color: '#64748b' }}>-</span>
                                )}
                              </td>
                              <td>
                                {meta ? (
                                  <span style={{ color: meta.medium === 'Tamil' ? '#fde68a' : '#6ee7b7' }}>
                                    {meta.medium}
                                  </span>
                                ) : (
                                  <span style={{ color: '#64748b' }}>-</span>
                                )}
                              </td>
                              <td>{meta ? meta.term : '-'}</td>
                              <td>
                                {meta ? (
                                  <button
                                    onClick={() => setViewingItem(meta)}
                                    style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#93c5fd', borderRadius: '4px', padding: '0.15rem 0.45rem', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                  >
                                    <Layers size={11} />
                                    {meta.totalUnits} Units • {meta.totalLessons} Lessons
                                  </button>
                                ) : (
                                  <span style={{ color: '#64748b' }}>-</span>
                                )}
                              </td>
                              <td>
                                {meta ? (
                                  <div style={{ display: 'flex', gap: '0.2rem' }}>
                                    {meta.applicableGroups.map((g) => (
                                      <span key={g} style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', color: '#cbd5e1' }}>
                                        {g === 'group1' ? 'G1' : g === 'group2' ? 'G2' : 'G4'}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td>
                                {meta ? (
                                  <span className={`confidence-badge confidence-${meta.confidenceLevel}`}>
                                    {meta.confidenceScore}% {meta.confidenceLevel.toUpperCase()}
                                  </span>
                                ) : (
                                  <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Unanalyzed</span>
                                )}
                              </td>
                              <td>
                                {item.status === 'uploading' ? (
                                  <div style={{ minWidth: '120px' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#93c5fd', marginBottom: '0.2rem' }}>
                                      {item.currentStep}
                                    </div>
                                    <div style={{ height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden' }}>
                                      <div style={{ width: `${item.progress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.2s' }} />
                                    </div>
                                  </div>
                                ) : item.status === 'completed' ? (
                                  <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem', fontWeight: 500 }}>
                                    <CheckCircle2 size={13} /> Uploaded
                                  </span>
                                ) : item.status === 'failed' ? (
                                  <span style={{ color: '#f87171', fontSize: '0.74rem' }} title={item.errorMessage}>
                                    Failed: {item.errorMessage}
                                  </span>
                                ) : item.status === 'approved' ? (
                                  <span style={{ color: '#6ee7b7', fontSize: '0.74rem', fontWeight: 500 }}>
                                    Ready to Upload
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '0.74rem' }}>
                                    {item.currentStep}
                                  </span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                  {meta && (
                                    <>
                                      <button
                                        onClick={() => setEditingItem(meta)}
                                        title="Edit Classification"
                                        style={{ background: 'transparent', border: 'none', color: '#93c5fd', cursor: 'pointer', padding: '0.25rem' }}
                                      >
                                        <Edit size={14} />
                                      </button>
                                      <button
                                        onClick={() => setViewingItem(meta)}
                                        title="View Extracted Contents"
                                        style={{ background: 'transparent', border: 'none', color: '#6ee7b7', cursor: 'pointer', padding: '0.25rem' }}
                                      >
                                        <Eye size={14} />
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => handleRemoveItem(item.id)}
                                    title="Remove File"
                                    style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.25rem' }}
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Overall Upload Progress Bar (when uploading) */}
                  {isUploading && (
                    <div style={{ padding: '0.75rem', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#93c5fd', marginBottom: '0.35rem' }}>
                        <span>Streaming batch to Google Drive (3 concurrent streams)...</span>
                        <span>{overallProgress}%</span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${overallProgress}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #10b981)', transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        disabled={isAnalyzing || isUploading}
                        onClick={handleAnalyzeAll}
                        style={{
                          padding: '0.6rem 1.1rem',
                          borderRadius: '8px',
                          background: 'rgba(99, 102, 241, 0.2)',
                          color: '#a5b4fc',
                          border: '1px solid rgba(99, 102, 241, 0.35)',
                          fontSize: '0.84rem',
                          fontWeight: 600,
                          cursor: isAnalyzing || isUploading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                        }}
                      >
                        <Sparkles size={15} />
                        {isAnalyzing ? 'Analyzing PDFs & Syllabus...' : 'Analyze All PDFs'}
                      </button>

                      <button
                        disabled={isUploading}
                        onClick={handleApproveAll}
                        style={{
                          padding: '0.6rem 1rem',
                          borderRadius: '8px',
                          background: 'rgba(255,255,255,0.06)',
                          color: '#cbd5e1',
                          border: '1px solid rgba(255,255,255,0.12)',
                          fontSize: '0.84rem',
                          cursor: isUploading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <Check size={14} /> Approve All
                      </button>

                      {selectedIds.size > 0 && (
                        <button
                          disabled={isUploading}
                          onClick={handleApproveSelected}
                          style={{
                            padding: '0.6rem 1rem',
                            borderRadius: '8px',
                            background: 'rgba(255,255,255,0.06)',
                            color: '#cbd5e1',
                            border: '1px solid rgba(255,255,255,0.12)',
                            fontSize: '0.84rem',
                            cursor: isUploading ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Approve Selected ({selectedIds.size})
                        </button>
                      )}

                      {failedCount > 0 && (
                        <button
                          disabled={isUploading}
                          onClick={handleRetryFailed}
                          style={{
                            padding: '0.6rem 1rem',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            fontSize: '0.84rem',
                            cursor: isUploading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                          }}
                        >
                          <RotateCcw size={14} /> Retry Failed ({failedCount})
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      {isUploading && (
                        <button
                          onClick={() => {
                            isCancelledRef.current = true
                          }}
                          style={{
                            padding: '0.6rem 1.1rem',
                            borderRadius: '8px',
                            background: 'rgba(239,68,68,0.2)',
                            color: '#f87171',
                            border: '1px solid rgba(239,68,68,0.3)',
                            fontSize: '0.84rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Cancel Upload
                        </button>
                      )}

                      <button
                        disabled={isUploading || approvedCount === 0}
                        onClick={handleStartBulkUpload}
                        style={{
                          padding: '0.65rem 1.4rem',
                          borderRadius: '8px',
                          border: 'none',
                          background: approvedCount > 0 && !isUploading ? 'linear-gradient(135deg, #10b981, #059669)' : '#334155',
                          color: '#ffffff',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          cursor: approvedCount > 0 && !isUploading ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          boxShadow: approvedCount > 0 && !isUploading ? '0 4px 14px rgba(16, 185, 129, 0.35)' : undefined,
                        }}
                      >
                        <Upload size={16} />
                        {isUploading
                          ? 'Uploading to Google Drive...'
                          : `Start Bulk Upload (${approvedCount} Approved)`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Editing Modal */}
      <ClassificationEditModal
        isOpen={Boolean(editingItem)}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={handleSaveClassification}
      />

      {/* Extracted TOC Inspector Modal */}
      <ExtractedContentsViewerModal
        isOpen={Boolean(viewingItem)}
        item={viewingItem}
        onClose={() => setViewingItem(null)}
      />
    </>
  )
}
