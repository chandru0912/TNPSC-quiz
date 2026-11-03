import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  BookOpen,
  X,
  Key,
  Check,
  CheckCircle,
  AlertTriangle,
  UploadCloud,
  RefreshCw,
  FileText,
  Upload,
  Cloud,
  Search,
} from 'lucide-react'
import { apiFetch } from '../utils/api'
import { SyllabusCascadeSelector, useSyllabusCascade } from './SyllabusCascadeSelector'
import { McqCascadeGenerator } from './McqCascadeGenerator'
import { cleanTamilUnicodeText } from '../utils/tamilUnicodeCleaner'
import { TamilStudyNotesRenderer } from './TamilStudyNotesRenderer'
import { TNPSC_GROUPS } from '../data/unifiedSyllabusRegistry'
import { useScrollLock } from '../hooks/useScrollLock'

export type CloudAiMode = 'mcq' | 'notes'

export interface CloudAiGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
  token: string | null
  initialMode?: CloudAiMode
  textbooksList?: any[]
  fetchTextbooks?: () => void
  showToast?: (type: 'success' | 'error', text: string) => void
  onRefreshData?: () => void
}

export const CloudAiGeneratorModal: React.FC<CloudAiGeneratorModalProps> = ({
  isOpen,
  onClose,
  token,
  initialMode = 'notes',
  textbooksList = [],
  fetchTextbooks: _fetchTextbooks,
  showToast,
  onRefreshData,
}) => {
  const [aiMode, setAiMode] = useState<CloudAiMode>(initialMode)

  // API Key Configuration
  const [isKeyConfiguredOnServer, setIsKeyConfiguredOnServer] = useState<boolean>(false)
  const [serverModel, setServerModel] = useState<string>('claude-sonnet-5-5')

  // Shared 5-Dropdown Syllabus Cascade Selector
  const aiSyllabusCascade = useSyllabusCascade({
    allowAll: false,
    initialGroupId: 'group4',
    initialSubjectId: 'general-studies',
    initialClassId: 6,
    initialUnitId: 1,
  })

  const {
    effectiveGroupId: aiGroupId,
    currentClassId,
    currentUnitId,
    currentLessonTitle,
    selectedSubjectObj,
    selectedStandardObj,
    currentUnit,
    selectedLessonObj,
  } = aiSyllabusCascade

  // Textbook Source Selection States (Unified across modes: 4 options)
  const [textbookMode, setTextbookMode] = useState<'auto' | 'specific' | 'gdrive' | 'gdrive_upload'>('auto')
  const [selectedTextbookId, setSelectedTextbookId] = useState<number | null>(null)

  // Google Drive Source Selection States
  const [drivePdfs, setDrivePdfs] = useState<any[]>([])
  const [isDriveLoading, setIsDriveLoading] = useState<boolean>(false)
  const [driveSearch, setDriveSearch] = useState<string>('')
  const [selectedDriveFileId, setSelectedDriveFileId] = useState<string | null>(null)
  const [selectedDriveMaterialId, setSelectedDriveMaterialId] = useState<number | null>(null)
  const [driveConnectionStatus, setDriveConnectionStatus] = useState<{
    connected: boolean
    email?: string
    folderName: string
    configured: boolean
  }>({ connected: false, folderName: 'TNPSC Study Hub Materials', configured: true })

  // Inline Google Drive Resumable Upload States (Option 4)
  const [driveUploadFile, setDriveUploadFile] = useState<File | null>(null)
  const [driveUploadTitle, setDriveUploadTitle] = useState<string>('')
  const [driveUploadMedium, setDriveUploadMedium] = useState<'Tamil' | 'English'>('English')
  const [driveUploadTerm, setDriveUploadTerm] = useState<string>('Term 1')
  const [isDriveUploading, setIsDriveUploading] = useState<boolean>(false)
  const [driveUploadProgress, setDriveUploadProgress] = useState<number>(0)
  const [driveUploadStep, setDriveUploadStep] = useState<string>('')
  const [driveUploadError, setDriveUploadError] = useState<string | null>(null)

  // Shared AI notice for notes errors
  const [aiNotice, setAiNotice] = useState<string | null>(null)

  // Study Notes Options
  const [notesLanguage, setNotesLanguage] = useState<'tamil' | 'english'>('tamil')
  const [notesFormat, setNotesFormat] = useState<'short' | 'full' | 'both'>('both')
  const [isNotesGenerating, setIsNotesGenerating] = useState<boolean>(false)
  const [notesProgressStep, setNotesProgressStep] = useState<string>('')
  const [notesProgressPct, setNotesProgressPct] = useState<number>(0)
  const [notesPreview, setNotesPreview] = useState<{
    title: string
    content: string
    topics?: string[]
    validation?: any
  } | null>(null)
  const [fullNotesPreview, setFullNotesPreview] = useState<{
    title: string
    content: string
    topics?: string[]
    validation?: any
  } | null>(null)
  const [activePreviewFormat, setActivePreviewFormat] = useState<'short' | 'full'>('short')
  const [isNotesSaving, setIsNotesSaving] = useState<boolean>(false)
  const [notesEditMode, setNotesEditMode] = useState<boolean>(false)

  // Lock background scroll when Claude AI Generator is active
  useScrollLock(isOpen)

  // Remove any obsolete browser-stored AI key from the previous provider setup.
  useEffect(() => {
    localStorage.removeItem('tnpsc_cloud_ai_key')
    localStorage.removeItem('tnpsc_claude_ai_key')
  }, [])

  // Dynamically manage document attribute & notify BottomNav to hide/restore cleanly
  useEffect(() => {
    if (isOpen) {
      document.documentElement.setAttribute('data-ai-modal-open', 'true')
      document.body.classList.add('ai-generator-active')
      window.dispatchEvent(new CustomEvent('tnpsc:ai-modal-state', { detail: { isOpen: true } }))
    } else {
      document.documentElement.removeAttribute('data-ai-modal-open')
      document.body.classList.remove('ai-generator-active')
      window.dispatchEvent(new CustomEvent('tnpsc:ai-modal-state', { detail: { isOpen: false } }))
    }

    return () => {
      document.documentElement.removeAttribute('data-ai-modal-open')
      document.body.classList.remove('ai-generator-active')
      window.dispatchEvent(new CustomEvent('tnpsc:ai-modal-state', { detail: { isOpen: false } }))
    }
  }, [isOpen])

  // Keyboard shortcut: Escape to close modal cleanly
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isNotesGenerating) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isNotesGenerating, onClose])

  useEffect(() => {
    if (initialMode) {
      setAiMode(initialMode)
    }
  }, [initialMode])

  // Check server AI status
  useEffect(() => {
    if (!token || !isOpen) return
    apiFetch('/api/ai/status', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok') {
          setIsKeyConfiguredOnServer(Boolean(data.configured))
          if (data.model) setServerModel(data.model)
        }
      })
      .catch((e) => console.warn('Could not fetch AI status:', e))
  }, [token, isOpen])

  // Fetch Google Drive PDFs
  const fetchDrivePdfs = useCallback(async (sync = false) => {
    setIsDriveLoading(true)
    try {
      const activeToken = token || localStorage.getItem('tnpsc_admin_token') || ''
      const res = await apiFetch(`/api/drive/files${sync ? '?sync=true' : ''}`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      })
      const data = await res.json()
      if (res.ok && data.status === 'success') {
        setDrivePdfs(data.data || [])
      } else {
        const matRes = await apiFetch('/api/drive/materials')
        const matData = await matRes.json()
        if (matData.status === 'success') {
          setDrivePdfs(matData.data || [])
        }
      }
    } catch (err: any) {
      console.warn('Could not fetch Google Drive files:', err.message)
    } finally {
      setIsDriveLoading(false)
    }
  }, [token])

  // Check Google Drive Connection Status
  const checkDriveConnection = useCallback(async () => {
    try {
      const res = await apiFetch('/api/drive/status')
      const data = await res.json()
      if (res.ok && data.status === 'success') {
        setDriveConnectionStatus({
          connected: Boolean(data.data?.connected),
          email: data.data?.email,
          folderName: data.data?.folderName || 'TNPSC Study Hub Materials',
          configured: Boolean(data.data?.configured),
        })
      }
    } catch (err: any) {
      console.warn('Could not check Google Drive status:', err.message)
    }
  }, [])

  // Auto-fetch Drive status and list when modal opens
  useEffect(() => {
    if (isOpen) {
      checkDriveConnection()
      fetchDrivePdfs()
    }
  }, [isOpen, checkDriveConnection, fetchDrivePdfs])

  // Search filtered Drive PDFs
  const filteredDrivePdfs = useMemo(() => {
    if (!driveSearch.trim()) return drivePdfs
    const q = driveSearch.toLowerCase().trim()
    return drivePdfs.filter(
      (p) =>
        (p.fileName && p.fileName.toLowerCase().includes(q)) ||
        (p.subject && p.subject.toLowerCase().includes(q)) ||
        (p.lesson && p.lesson.toLowerCase().includes(q)) ||
        (p.standard && String(p.standard).includes(q))
    )
  }, [drivePdfs, driveSearch])

  // Currently selected Drive PDF object
  const selectedDrivePdf = useMemo(() => {
    if (!selectedDriveFileId) return null
    return drivePdfs.find((p) => p.googleDriveFileId === selectedDriveFileId) || null
  }, [drivePdfs, selectedDriveFileId])

  // Handle direct resumable upload to Google Drive inside generator modal (Option 4)
  const handleStartDriveUploadModal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!driveUploadFile) {
      setDriveUploadError('Please choose a PDF textbook file first.')
      return
    }
    if (driveUploadFile.type !== 'application/pdf' && !driveUploadFile.name.toLowerCase().endsWith('.pdf')) {
      setDriveUploadError('Invalid file type: Only PDF documents (.pdf) are permitted.')
      return
    }

    setIsDriveUploading(true)
    setDriveUploadError(null)
    setDriveUploadProgress(5)
    setDriveUploadStep('Authorizing and creating Google Drive resumable session...')

    try {
      const activeToken = token || localStorage.getItem('tnpsc_admin_token') || ''
      const finalTitle = driveUploadTitle.trim() || driveUploadFile.name.replace(/\.pdf$/i, '')
      const initRes = await apiFetch('/api/drive/upload/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({
          fileName: `${finalTitle}.pdf`,
          originalFileName: driveUploadFile.name,
          fileSize: driveUploadFile.size,
          mimeType: 'application/pdf',
          origin: window.location.origin,
          group: aiGroupId,
          subject: selectedSubjectObj?.name || 'General Studies',
          standard: currentClassId,
          medium: driveUploadMedium,
          term: driveUploadTerm || 'Term 1',
          unit: currentUnitId,
          lesson: currentLessonTitle,
          lessonId: selectedLessonObj?.id,
        }),
      })

      const initData = await initRes.json()
      if (!initRes.ok || !initData.data?.uploadUrl) {
        throw new Error(initData.message || 'Failed to initiate Google Drive upload session.')
      }

      const { uploadUrl, trackingId } = initData.data
      setDriveUploadProgress(15)
      setDriveUploadStep(`Streaming to Google Drive: 0 MB / ${(driveUploadFile.size / (1024 * 1024)).toFixed(1)} MB...`)

      // Stream file directly to Google Drive via 5 MB chunks
      const CHUNK_SIZE = 5 * 1024 * 1024
      const totalSize = driveUploadFile.size
      const totalChunks = Math.ceil(totalSize / CHUNK_SIZE)
      let currentOffset = 0
      let googleDriveFileId = ''

      while (currentOffset < totalSize) {
        const chunkIndex = Math.floor(currentOffset / CHUNK_SIZE)
        const chunkEnd = Math.min(currentOffset + CHUNK_SIZE - 1, totalSize - 1)
        const chunkBlob = driveUploadFile.slice(currentOffset, chunkEnd + 1)
        const contentRange = `bytes ${currentOffset}-${chunkEnd}/${totalSize}`

        let chunkAttempt = 0
        const maxAttempts = 3
        let chunkDone = false

        while (chunkAttempt < maxAttempts && !chunkDone) {
          chunkAttempt++
          try {
            const chunkResult = await new Promise<{ status: number; range?: string; fileId?: string }>(
              (resolve, reject) => {
                const xhr = new XMLHttpRequest()
                xhr.open('PUT', uploadUrl, true)
                xhr.setRequestHeader('Content-Range', contentRange)
                xhr.setRequestHeader('Content-Type', 'application/pdf')

                xhr.upload.onprogress = (evt) => {
                  if (evt.lengthComputable) {
                    const loadedBytes = currentOffset + evt.loaded
                    const pct = Math.min(95, Math.round(15 + (loadedBytes / totalSize) * 80))
                    setDriveUploadProgress(pct)
                    const loadedMb = (loadedBytes / (1024 * 1024)).toFixed(1)
                    const totalMb = (totalSize / (1024 * 1024)).toFixed(1)
                    setDriveUploadStep(
                      `Uploading: ${loadedMb} MB of ${totalMb} MB (${pct}%) [Chunk ${chunkIndex + 1}/${totalChunks}]`
                    )
                  }
                }

                xhr.onload = () => {
                  if (xhr.status === 308) {
                    const rangeHeader = xhr.getResponseHeader('Range')
                    resolve({ status: 308, range: rangeHeader || undefined })
                  } else if (xhr.status === 200 || xhr.status === 201) {
                    try {
                      const data = JSON.parse(xhr.responseText || '{}')
                      resolve({ status: xhr.status, fileId: data.id })
                    } catch {
                      resolve({ status: xhr.status })
                    }
                  } else {
                    reject(new Error(`Google Drive returned HTTP ${xhr.status}: ${xhr.responseText || xhr.statusText}`))
                  }
                }

                xhr.onerror = () => {
                  reject(
                    new Error(
                      `Network / CORS error during Google Drive upload (Chunk ${chunkIndex + 1}/${totalChunks}). ` +
                      `Please check your connection or Google Cloud Console Authorized JavaScript origins.`
                    )
                  )
                }

                xhr.ontimeout = () => {
                  reject(new Error(`Upload chunk ${chunkIndex + 1} timed out.`))
                }

                xhr.timeout = 120000
                xhr.send(chunkBlob)
              }
            )

            if (chunkResult.status === 308) {
              chunkDone = true
              if (chunkResult.range) {
                const match = chunkResult.range.match(/bytes=0-(\d+)/)
                currentOffset = match && match[1] ? parseInt(match[1], 10) + 1 : chunkEnd + 1
              } else {
                currentOffset = chunkEnd + 1
              }
            } else if (chunkResult.status === 200 || chunkResult.status === 201) {
              chunkDone = true
              googleDriveFileId = chunkResult.fileId || ''
              currentOffset = totalSize
            }
          } catch (chunkErr: any) {
            console.warn(`Upload chunk ${chunkIndex + 1} attempt ${chunkAttempt} error:`, chunkErr.message)
            if (chunkAttempt >= maxAttempts) throw chunkErr
            await new Promise((r) => setTimeout(r, 1000 * chunkAttempt))
          }
        }
      }

      if (!googleDriveFileId) {
        throw new Error('Google Drive upload succeeded but did not return file ID.')
      }

      setDriveUploadProgress(96)
      setDriveUploadStep('Verifying file in Google Drive & registering in database...')

      const completeRes = await apiFetch('/api/drive/upload/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({
          trackingId,
          googleDriveFileId,
        }),
      })

      const completeData = await completeRes.json()
      if (!completeRes.ok) {
        throw new Error(completeData.message || 'Failed to register completed upload.')
      }

      setDriveUploadProgress(100)
      setDriveUploadStep('Upload and verification complete!')
      showToast?.('success', `PDF "${finalTitle}" uploaded directly to Google Drive and selected as source!`)

      // Auto-select this file and switch to gdrive mode
      setSelectedDriveFileId(googleDriveFileId)
      setSelectedDriveMaterialId(trackingId)
      setTextbookMode('gdrive')
      setDriveUploadFile(null)
      setDriveUploadTitle('')
      fetchDrivePdfs(true)
    } catch (err: any) {
      console.error('Google Drive inline upload error:', err)
      setDriveUploadError(err.message || 'Failed to upload PDF to Google Drive.')
    } finally {
      setIsDriveUploading(false)
    }
  }

  // 1. Generate Notes Handler (Connected to new Claude AI service)
  const handleGenerateNotes = async () => {
    const activeToken = token || localStorage.getItem('tnpsc_admin_token') || ''
    if (!activeToken) {
      showToast?.('error', 'Admin authorization token missing. Please sign in again.')
      return
    }

    if (!currentLessonTitle) {
      showToast?.('error', 'Please select a lesson title to generate study notes.')
      return
    }

    if (textbookMode === 'specific' && !selectedTextbookId) {
      showToast?.('error', 'Please select a specific textbook from the dropdown or switch to Automatic mode.')
      return
    }

    if (textbookMode === 'gdrive' && !selectedDriveFileId) {
      showToast?.('error', 'Please select a PDF textbook from your connected Google Drive library.')
      return
    }

    if (isNotesGenerating) return

    setIsNotesGenerating(true)
    setNotesPreview(null)
    setFullNotesPreview(null)
    setAiNotice(null)
    setNotesProgressStep('Connecting to Claude AI & Reading Textbook...')
    setNotesProgressPct(15)

    try {
      const response = await apiFetch('/api/ai/generate?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
          Accept: 'text/event-stream',
        },
        timeoutMs: 300000,
        body: JSON.stringify({
          category: aiGroupId,
          standard: currentClassId,
          subject: selectedSubjectObj?.name || 'General Studies',
          term: driveUploadTerm || 'Term 1',
          unitId: currentUnitId,
          unitTitle: currentUnit?.title,
          lessonTitle: currentLessonTitle,
          lessonId: selectedLessonObj?.id,
          lessonNumber: selectedLessonObj?.lessonNumber || '1.1',
          topic: currentLessonTitle,
          language: notesLanguage,
          mode: 'notes',
          notesFormat,
          textbookMode,
          textbookId: textbookMode === 'specific' ? selectedTextbookId : undefined,
          gdriveFileId: textbookMode === 'gdrive' ? selectedDriveFileId : undefined,
          gdriveMaterialId: textbookMode === 'gdrive' ? (selectedDriveMaterialId || undefined) : undefined,
          autoSaveToStaging: true,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status} failed`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let streamError: string | null = null

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith('data:')) {
              let event: any
              try {
                event = JSON.parse(trimmed.replace(/^data:\s*/, ''))
              } catch (e: any) {
                console.warn('SSE Parse error:', e)
                continue
              }

              if (event.type === 'progress') {
                setNotesProgressPct(event.progressPercent || 0)
                setNotesProgressStep(event.stepName || 'Processing...')
              } else if (event.type === 'complete') {
                setNotesProgressPct(100)
                setNotesProgressStep('Generation completed!')
                if (event.studyNotes) {
                  setNotesPreview({
                    title: event.studyNotes.title,
                    content: cleanTamilUnicodeText(event.studyNotes.content),
                    topics: event.studyNotes.topics,
                    validation: event.studyNotes.validation,
                  })
                }
                if (event.fullStudyNotes) {
                  setFullNotesPreview({
                    title: event.fullStudyNotes.title,
                    content: cleanTamilUnicodeText(event.fullStudyNotes.content),
                    topics: event.fullStudyNotes.topics,
                    validation: event.fullStudyNotes.validation,
                  })
                }
                if (notesFormat === 'full' && event.fullStudyNotes) {
                  setActivePreviewFormat('full')
                } else {
                  setActivePreviewFormat('short')
                }
                const fmtLabel = notesFormat === 'both' ? 'Short & Full Notes' : notesFormat === 'full' ? 'Full Notes' : 'Short Notes'
                showToast?.('success', `${fmtLabel} generated and saved to Staging for "${currentLessonTitle}"!`)
                onRefreshData?.()
              } else if (event.status === 'error' || event.type === 'error') {
                const errText = String(event.error || event.message || 'Generation failed.')
                streamError = errText
                setAiNotice(errText)
                showToast?.('error', errText)
                break
              }
            }
          }

          if (streamError) break
        }
      }
    } catch (err: any) {
      console.error('Notes generation error:', err)
      const msg = err.message || 'Failed to generate study notes'
      showToast?.('error', msg)
      setAiNotice(msg)
    } finally {
      setIsNotesGenerating(false)
    }
  }

  // Save Notes to Staging or Published
  const handleSaveNotes = async (publish: boolean) => {
    if (!token) return
    const currentNoteToSave = activePreviewFormat === 'full' ? (fullNotesPreview || notesPreview) : (notesPreview || fullNotesPreview)
    if (!currentNoteToSave) return

    setIsNotesSaving(true)
    try {
      const res = await apiFetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: aiGroupId,
          standard: currentClassId,
          subject: selectedSubjectObj?.name || 'General Studies',
          term: driveUploadTerm || 'Term 1',
          unitId: currentUnitId,
          lessonTitle: currentLessonTitle,
          lessonId: selectedLessonObj?.id,
          lessonNumber: selectedLessonObj?.lessonNumber || '1.1',
          topic: currentLessonTitle,
          language: notesLanguage,
          noteFormat: activePreviewFormat,
          title: currentNoteToSave.title,
          content: cleanTamilUnicodeText(currentNoteToSave.content),
          status: publish ? 'published' : 'staging',
          sourceReference: `Standard ${currentClassId} Samacheer Kalvi`,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to save notes')

      const formatName = activePreviewFormat === 'full' ? 'Full Notes' : 'Short Notes'
      showToast?.('success', `${formatName} successfully saved to ${publish ? 'Published' : 'Staging'}!`)
      onRefreshData?.()
      onClose()
    } catch (err: any) {
      showToast?.('error', err.message || 'Failed to save notes')
    } finally {
      setIsNotesSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div
        className="admin-modal-backdrop ai-modal-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isNotesGenerating) {
            onClose()
          }
        }}
      >
        <motion.div
          className="admin-modal ai-modal-container"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
        >
          {/* Header */}
          <div className="ai-modal-header">
            {/* Top Bar: Brand Badges & Close Button */}
            <div className="ai-modal-top-bar">
              <div className="ai-badge-row">
                <span className="ai-header-badge">
                  <Sparkles size={13} />
                  Claude AI Generator
                </span>
                <span className="ai-group-badge">
                  {TNPSC_GROUPS.find((g) => g.id === aiGroupId)?.name} • {selectedSubjectObj?.name} • {selectedStandardObj?.label}
                </span>
              </div>
              <button
                type="button"
                className="ai-modal-close-btn"
                onClick={onClose}
                aria-label="Close generator modal"
                title="Close Generator (Esc)"
                disabled={isNotesGenerating}
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            {/* Title & Description Section */}
            <div className="ai-modal-title-section">
              <div className="ai-title-icon-box">
                {aiMode === 'mcq' ? <Sparkles size={22} /> : <BookOpen size={22} />}
              </div>
              <div className="ai-title-text-group">
                <h2 className="ai-modal-title">
                  {aiMode === 'mcq' ? 'Syllabus-Wise MCQ Generator' : 'Study Notes Generator'}
                </h2>
                <p className="ai-modal-subtitle">
                  {aiMode === 'mcq'
                    ? 'Select Group, Subject, Standard, Unit, and Lesson to generate authentic syllabus MCQs with Claude AI.'
                    : 'Select Group, Class/Standard, Subject, Unit, and Lesson to generate study notes in Tamil or English for student Study Materials.'}
                </p>
              </div>
            </div>

            {/* Top Navigation Tabs (Segmented Switcher) */}
            <div className="ai-modal-nav-tabs">
              <button
                type="button"
                className={`ai-nav-tab ${aiMode === 'mcq' ? 'active' : ''}`}
                onClick={() => setAiMode('mcq')}
                disabled={isNotesGenerating}
              >
                <Sparkles size={15} />
                <span>MCQ Questions Generator</span>
                <span className="ai-nav-tab-pill">Classes 6–12</span>
              </button>
              <button
                type="button"
                className={`ai-nav-tab ${aiMode === 'notes' ? 'active' : ''}`}
                onClick={() => setAiMode('notes')}
                disabled={isNotesGenerating}
              >
                <BookOpen size={15} />
                <span>Study Notes Generator</span>
                <span className="ai-nav-tab-pill">Tamil & English</span>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="ai-modal-body">
            {/* 1. Claude API Configuration Status */}
            <div className="ai-api-card">
              <div className="ai-api-header">
                <div className="ai-api-title">
                  <Key size={15} style={{ color: '#c084fc' }} />
                  <span>Anthropic Claude Configuration</span>
                </div>
                {isKeyConfiguredOnServer ? (
                  <span className="ai-api-status-badge ai-status-connected">
                    <Check size={12} />
                    Claude AI Ready ({serverModel})
                  </span>
                ) : (
                  <span className="ai-api-status-badge ai-status-fallback">
                    <AlertTriangle size={12} />
                    Claude API Not Configured
                  </span>
                )}
              </div>
              {!isKeyConfiguredOnServer && (
                <p className="ai-api-help-text">
                  Set <code>ANTHROPIC_API_KEY</code> (and optionally <code>CLAUDE_MODEL</code>) in the backend
                  environment variables. API keys are never entered or stored in the browser.
                </p>
              )}
            </div>

            {/* 2. Lesson-grounded MCQ cascade (Group -> Subject -> Standard -> Unit -> Textbook -> Term/Volume -> Lesson) */}
            {aiMode === 'mcq' && (
              <McqCascadeGenerator
                token={token}
                showToast={showToast}
                onRefreshData={onRefreshData}
              />
            )}

            {/* 3. Syllabus 5-Tier Cascading Selector & Lesson Card (Study Notes) */}
            {aiMode === 'notes' && (
              <div className="ai-section-box">
                <h3 className="ai-section-title">
                  <Sparkles size={16} style={{ color: '#c084fc' }} />
                  <span>Syllabus Study Notes Configuration (1 to 5)</span>
                </h3>

                {/* Shared 5-Dropdown Syllabus Cascade Selector */}
                <SyllabusCascadeSelector
                  cascade={aiSyllabusCascade}
                  allowAll={false}
                  variant="generator"
                />

                {/* Lesson Details Card */}
                {selectedLessonObj && (
                  <div className="ai-lesson-card">
                    <div className="ai-lesson-meta-row">
                      <span className="ai-lesson-pill" style={{ color: 'var(--gold-primary)', borderColor: 'rgba(255, 215, 0, 0.3)' }}>
                        {selectedLessonObj.lessonNumber ? `Lesson ${selectedLessonObj.lessonNumber}` : 'Selected Lesson'}
                      </span>
                      <span className="ai-lesson-pill">{selectedSubjectObj?.name}</span>
                      <span className="ai-lesson-pill">{selectedStandardObj?.label}</span>
                      <span className="ai-lesson-pill">{currentUnit?.unitNumber ? `Unit ${currentUnit.unitNumber}` : currentUnit?.title}</span>
                    </div>
                    <div className="ai-lesson-title-display">{selectedLessonObj.title}</div>
                    {selectedLessonObj.description && <p className="ai-lesson-desc">{selectedLessonObj.description}</p>}
                  </div>
                )}

                {/* 4. Unified Textbook Source Selection Box */}
                <div className="ai-textbook-source-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', margin: 0 }}>
                      <BookOpen size={16} style={{ color: 'var(--gold-primary)' }} />
                      <span>6. Textbook Source Selection *</span>
                    </label>
                    {driveConnectionStatus.connected ? (
                      <span style={{ fontSize: '0.74rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.55rem', borderRadius: '9999px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        <Cloud size={12} /> Google Drive: {driveConnectionStatus.email || 'Connected'}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.74rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(245, 158, 11, 0.1)', padding: '0.2rem 0.55rem', borderRadius: '9999px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                        <AlertTriangle size={12} /> Google Drive Not Connected
                      </span>
                    )}
                  </div>

                  {/* 4-Option Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.5rem', marginBottom: '0.85rem' }}>
                    {/* Option 1: Auto */}
                    <label className={`ai-source-radio-card ${textbookMode === 'auto' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="unifiedTbSourceMode"
                        checked={textbookMode === 'auto'}
                        onChange={() => setTextbookMode('auto')}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>1. Use Uploaded Automatically</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Matches {currentClassId}th Standard {selectedSubjectObj?.name}
                        </div>
                      </div>
                    </label>

                    {/* Option 2: Specific */}
                    <label className={`ai-source-radio-card ${textbookMode === 'specific' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="unifiedTbSourceMode"
                        checked={textbookMode === 'specific'}
                        onChange={() => setTextbookMode('specific')}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>2. Select Specific Textbook</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Choose from indexed textbooks in DB</div>
                      </div>
                    </label>

                    {/* Option 3: Select PDF from Google Drive */}
                    <label className={`ai-source-radio-card ${textbookMode === 'gdrive' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="unifiedTbSourceMode"
                        checked={textbookMode === 'gdrive'}
                        onChange={() => {
                          setTextbookMode('gdrive')
                          fetchDrivePdfs()
                          checkDriveConnection()
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#ffd700', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Cloud size={14} />
                          <span>3. Select PDF from Google Drive</span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Use connected Drive textbooks directly</div>
                      </div>
                    </label>

                    {/* Option 4: Upload New PDF to Google Drive */}
                    <label className={`ai-source-radio-card ${textbookMode === 'gdrive_upload' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="unifiedTbSourceMode"
                        checked={textbookMode === 'gdrive_upload'}
                        onChange={() => {
                          setTextbookMode('gdrive_upload')
                          checkDriveConnection()
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <UploadCloud size={14} />
                          <span>4. Upload New PDF to Google Drive</span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Direct resumable upload to Drive</div>
                      </div>
                    </label>
                  </div>

                  {/* Mode 2: specific */}
                  {textbookMode === 'specific' && (
                    <div className="ai-field" style={{ marginTop: '0.5rem' }}>
                      <label>Choose Uploaded Textbook ({textbooksList.filter((t) => t.status === 'completed').length} Available)</label>
                      <select
                        className="ai-select"
                        value={selectedTextbookId || ''}
                        onChange={(e) => setSelectedTextbookId(Number(e.target.value))}
                      >
                        <option value="">-- Auto-select or Pick Textbook --</option>
                        {textbooksList.map((t) => (
                          <option key={t.id} value={t.id} disabled={t.status !== 'completed'}>
                            #{t.id} [{t.standard} - {t.subject} - {t.medium}] {t.bookName} ({t.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Mode 3: Google Drive PDF Library */}
                  {textbookMode === 'gdrive' && (
                    <div className="ai-gdrive-library-container">
                      {!driveConnectionStatus.connected ? (
                        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertTriangle size={18} />
                            <span>Google Drive is not connected yet. Please connect your Google Drive account first.</span>
                          </div>
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary"
                            onClick={() => checkDriveConnection()}
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                          >
                            <RefreshCw size={12} />
                            <span>Check Status</span>
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="ai-gdrive-library-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                              <Search size={14} style={{ color: 'var(--text-muted)' }} />
                              <input
                                type="text"
                                className="ai-gdrive-search-input"
                                placeholder="Search textbook filename, subject, or lesson..."
                                value={driveSearch}
                                onChange={(e) => setDriveSearch(e.target.value)}
                              />
                              {driveSearch && (
                                <button
                                  type="button"
                                  onClick={() => setDriveSearch('')}
                                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>

                            <button
                              type="button"
                              className="ai-gdrive-refresh-btn"
                              onClick={() => fetchDrivePdfs(true)}
                              disabled={isDriveLoading}
                              title="Sync and reload PDFs directly from Google Drive"
                            >
                              <RefreshCw size={13} className={isDriveLoading ? 'spinning' : ''} />
                              <span>{isDriveLoading ? 'Syncing...' : 'Refresh Library'}</span>
                            </button>
                          </div>

                          {/* List of Google Drive PDFs */}
                          {filteredDrivePdfs.length === 0 ? (
                            <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                              {isDriveLoading ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                  <RefreshCw size={14} className="spinning" />
                                  <span>Loading Google Drive textbooks...</span>
                                </div>
                              ) : (
                                <div>
                                  <FileText size={24} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                                  <div>No PDF textbooks found in Google Drive folder "{driveConnectionStatus.folderName}".</div>
                                  <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#ffd700' }}>
                                    Select "4. Upload New PDF to Google Drive" above to upload your first textbook!
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="ai-gdrive-items-list">
                              {filteredDrivePdfs.map((pdf) => {
                                const isSelected = selectedDriveFileId === pdf.googleDriveFileId
                                const isClassMatch = pdf.standard === currentClassId

                                return (
                                  <div
                                    key={pdf.googleDriveFileId || pdf.id}
                                    className={`ai-gdrive-item-card ${isSelected ? 'selected' : ''}`}
                                    onClick={() => {
                                      setSelectedDriveFileId(pdf.googleDriveFileId)
                                      setSelectedDriveMaterialId(pdf.id)
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: isSelected ? '5px solid #ffd700' : '2px solid rgba(255,255,255,0.3)', flexShrink: 0, transition: 'all 0.15s ease' }} />
                                      <FileText size={20} style={{ color: isSelected ? '#ffd700' : '#94a3b8', flexShrink: 0 }} />
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.84rem', color: isSelected ? '#ffd700' : '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pdf.fileName}>
                                          {pdf.fileName}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                                          <span className="ai-gdrive-badge-size">{pdf.fileSizeFormatted || `${(pdf.fileSize / 1048576).toFixed(1)} MB`}</span>
                                          {pdf.standard && (
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Class {pdf.standard}</span>
                                          )}
                                          {pdf.subject && (
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>• {pdf.subject}</span>
                                          )}
                                          {isClassMatch && (
                                            <span className="ai-gdrive-badge-match">Matches Class {currentClassId}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {isSelected && (
                                      <div style={{ color: '#ffd700', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>
                                        <CheckCircle size={15} />
                                        <span>Selected</span>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Confirmed Selection Banner */}
                          {selectedDrivePdf && (
                            <div className="ai-gdrive-confirmed-banner">
                              <CheckCircle size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  Selected Google Drive Textbook: {selectedDrivePdf.fileName}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.1rem' }}>
                                  Size: {selectedDrivePdf.fileSizeFormatted || `${((selectedDrivePdf.fileSize || 0) / 1048576).toFixed(1)} MB`} • Claude AI will extract and generate content strictly from this textbook.
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Mode 4: Inline Google Drive Resumable Upload */}
                  {textbookMode === 'gdrive_upload' && (
                    <div className="ai-gdrive-library-container">
                      <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '0.8rem', color: '#a7f3d0', marginBottom: '0.85rem' }}>
                        ⚡ <strong>Direct Resumable Stream:</strong> Large textbook PDFs stream directly from your browser to your Google Drive storage. After upload, it will be automatically selected as the AI generation source!
                      </div>

                      <form onSubmit={handleStartDriveUploadModal}>
                        <div className="form-grid-3" style={{ marginBottom: '0.65rem' }}>
                          <div className="ai-field">
                            <label>Material Title</label>
                            <input
                              type="text"
                              className="admin-auth-input"
                              placeholder={`Class ${currentClassId} ${selectedSubjectObj?.name || 'Subject'}`}
                              value={driveUploadTitle}
                              onChange={(e) => setDriveUploadTitle(e.target.value)}
                              disabled={isDriveUploading}
                            />
                          </div>
                          <div className="ai-field">
                            <label>Medium</label>
                            <select
                              className="ai-select"
                              value={driveUploadMedium}
                              onChange={(e) => setDriveUploadMedium(e.target.value as 'Tamil' | 'English')}
                              disabled={isDriveUploading}
                            >
                              <option value="English">English Medium</option>
                              <option value="Tamil">Tamil Medium</option>
                            </select>
                          </div>
                          <div className="ai-field">
                            <label>Term / Volume</label>
                            <select
                              className="ai-select"
                              value={driveUploadTerm}
                              onChange={(e) => setDriveUploadTerm(e.target.value)}
                              disabled={isDriveUploading}
                            >
                              <option value="Term 1">Term 1</option>
                              <option value="Term 2">Term 2</option>
                              <option value="Term 3">Term 3</option>
                              <option value="Full Year">Full Year (Combined)</option>
                            </select>
                          </div>
                        </div>

                        <div className="ai-field" style={{ marginBottom: '0.75rem' }}>
                          <label>Select PDF Textbook (.pdf only)</label>
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            disabled={isDriveUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null
                              setDriveUploadFile(file)
                              if (file && !driveUploadTitle.trim()) {
                                setDriveUploadTitle(file.name.replace(/\.pdf$/i, ''))
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '0.65rem',
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px dashed rgba(255,255,255,0.2)',
                              borderRadius: '8px',
                              color: '#ffffff',
                              cursor: 'pointer',
                            }}
                          />
                          {driveUploadFile && (
                            <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <CheckCircle size={13} /> Selected: {driveUploadFile.name} ({(driveUploadFile.size / (1024 * 1024)).toFixed(2)} MB)
                            </div>
                          )}
                        </div>

                        {/* Progress Bar during resumable streaming */}
                        {isDriveUploading && (
                          <div className="gdrive-resumable-progress-box" style={{ margin: '0.75rem 0' }}>
                            <div className="gdrive-progress-step-text">
                              <span>{driveUploadStep}</span>
                              <strong style={{ color: '#ffd700' }}>{driveUploadProgress}%</strong>
                            </div>
                            <div className="gdrive-progress-bar-track">
                              <div
                                className="gdrive-progress-bar-fill"
                                style={{ width: `${driveUploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {driveUploadError && (
                          <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.85rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '6px', color: '#fca5a5', fontSize: '0.8rem' }}>
                            ⚠️ {driveUploadError}
                          </div>
                        )}

                        <button
                          type="submit"
                          className="admin-btn admin-btn-primary"
                          disabled={isDriveUploading || !driveUploadFile}
                          style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', fontWeight: 700 }}
                        >
                          <UploadCloud size={16} />
                          <span>{isDriveUploading ? 'Streaming to Google Drive...' : 'Start Resumable Upload to Google Drive'}</span>
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                {/* 5. Generation Settings & Action Buttons */}
                <div className="ai-generation-options">
                    <div className="ai-options-inline">
                      <div className="ai-field ai-field-compact">
                        <label>7. Language</label>
                        <select
                          className="ai-select"
                          value={notesLanguage}
                          onChange={(e) => setNotesLanguage(e.target.value as 'tamil' | 'english')}
                        >
                          <option value="tamil">Tamil (தமிழ்)</option>
                          <option value="english">English</option>
                        </select>
                      </div>

                      <div className="ai-field ai-field-compact">
                        <label>8. Notes Format</label>
                        <select
                          className="ai-select"
                          value={notesFormat}
                          onChange={(e) => setNotesFormat(e.target.value as 'short' | 'full' | 'both')}
                        >
                          <option value="both">Both (Short + Full Notes)</option>
                          <option value="short">Short Notes (Concise Bullets)</option>
                          <option value="full">Full Notes (Detailed Theory)</option>
                        </select>
                      </div>
                    </div>

                    <button
                      className="ai-generate-action-btn"
                      onClick={handleGenerateNotes}
                      disabled={isNotesGenerating}
                    >
                      <Sparkles size={18} className={isNotesGenerating ? 'spin-icon' : ''} />
                      <span>
                        {isNotesGenerating
                          ? 'Generating Notes...'
                          : notesFormat === 'both'
                          ? 'Generate Both (Short + Full)'
                          : notesFormat === 'full'
                          ? 'Generate Full Notes'
                          : 'Generate Short Notes'}
                      </span>
                    </button>
                  </div>

                {/* Real-time Notes Generation Progress Bar */}
                {isNotesGenerating && (
                  <div style={{ marginTop: '1rem', padding: '0.85rem', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.35)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#fbbf24', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <RefreshCw size={14} className="spin-icon" />
                        <span>{notesProgressStep}</span>
                      </span>
                      <span>{notesProgressPct}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginTop: '0.4rem' }}>
                      <div style={{ width: `${notesProgressPct}%`, height: '100%', background: 'linear-gradient(90deg, #eab308, #f59e0b)', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                )}

                {/* Error Notice */}
                {aiNotice && (
                  <div style={{ marginTop: '0.85rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <AlertTriangle size={16} />
                    <span>{aiNotice}</span>
                  </div>
                )}
              </div>
            )}

            {/* 6. Study Notes Preview */}
            {aiMode === 'notes' && (notesPreview || fullNotesPreview) && (
              <div className="ai-section-box" style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h3 className="ai-section-title" style={{ margin: 0 }}>
                      <FileText size={16} style={{ color: 'var(--gold-primary)' }} />
                      <span>Study Notes Preview</span>
                    </h3>
                    {/* Tab Switcher if both or multiple formats are available */}
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '2px', gap: '2px' }}>
                      {notesPreview && (
                        <button
                          type="button"
                          className="admin-btn"
                          style={{
                            padding: '0.25rem 0.65rem',
                            fontSize: '0.78rem',
                            borderRadius: '4px',
                            background: activePreviewFormat === 'short' ? '#eab308' : 'transparent',
                            color: activePreviewFormat === 'short' ? '#000' : '#e2e8f0',
                            fontWeight: activePreviewFormat === 'short' ? 700 : 500,
                          }}
                          onClick={() => setActivePreviewFormat('short')}
                        >
                          ⚡ Short Notes
                        </button>
                      )}
                      {fullNotesPreview && (
                        <button
                          type="button"
                          className="admin-btn"
                          style={{
                            padding: '0.25rem 0.65rem',
                            fontSize: '0.78rem',
                            borderRadius: '4px',
                            background: activePreviewFormat === 'full' ? '#eab308' : 'transparent',
                            color: activePreviewFormat === 'full' ? '#000' : '#e2e8f0',
                            fontWeight: activePreviewFormat === 'full' ? 700 : 500,
                          }}
                          onClick={() => setActivePreviewFormat('full')}
                        >
                          📖 Full Notes
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => setNotesEditMode(!notesEditMode)}
                    >
                      {notesEditMode ? 'Render Markdown' : 'Edit Text'}
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => handleSaveNotes(false)}
                      disabled={isNotesSaving}
                    >
                      <Upload size={14} />
                      <span>{isNotesSaving ? 'Saving...' : `Save ${activePreviewFormat === 'full' ? 'Full Notes' : 'Short Notes'} to Staging`}</span>
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: '#16a34a' }}
                      onClick={() => handleSaveNotes(true)}
                      disabled={isNotesSaving}
                    >
                      <Check size={14} />
                      <span>Publish {activePreviewFormat === 'full' ? 'Full Notes' : 'Short Notes'}</span>
                    </button>
                  </div>
                </div>

                {(() => {
                  const currentPreview = activePreviewFormat === 'full' ? (fullNotesPreview || notesPreview) : (notesPreview || fullNotesPreview)
                  if (!currentPreview) return null

                  return (
                    <div>
                      {/* Topic Alignment Indicator */}
                      {currentPreview.topics && currentPreview.topics.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255, 215, 0, 0.08)', borderRadius: '6px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gold-primary)' }}>
                            🎯 {currentPreview.topics.length} Topics Separated:
                          </span>
                          {currentPreview.topics.slice(0, 6).map((tp, idx) => (
                            <span key={idx} style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.08)', padding: '0.15rem 0.45rem', borderRadius: '4px', color: '#e2e8f0' }}>
                              {idx + 1}. {tp}
                            </span>
                          ))}
                          {currentPreview.topics.length > 6 && (
                            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>
                              +{currentPreview.topics.length - 6} more
                            </span>
                          )}
                        </div>
                      )}

                      {notesEditMode ? (
                        <textarea
                          className="ai-textarea"
                          style={{ width: '100%', minHeight: '380px', fontFamily: 'monospace', fontSize: '0.88rem' }}
                          value={currentPreview.content}
                          onChange={(e) => {
                            const val = e.target.value
                            if (activePreviewFormat === 'full' && fullNotesPreview) {
                              setFullNotesPreview({ ...fullNotesPreview, content: val })
                            } else if (notesPreview) {
                              setNotesPreview({ ...notesPreview, content: val })
                            }
                          }}
                        />
                      ) : (
                        <div style={{ background: '#131c2e', padding: '1.25rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '480px', overflowY: 'auto' }}>
                          <TamilStudyNotesRenderer content={currentPreview.content} showLessonHeader={true} />
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="admin-modal-footer">
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={onClose}
              disabled={isNotesGenerating}
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export const ClaudeAiGeneratorModal = CloudAiGeneratorModal
export type ClaudeAiMode = CloudAiMode

export default CloudAiGeneratorModal
