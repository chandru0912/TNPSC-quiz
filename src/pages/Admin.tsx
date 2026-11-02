import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  apiFetch,
  getApiUrl,
  parseApiResponse,
  classifyApiError,
  classifyFetchFailure,
} from '../utils/api'
import { useScrollLock } from '../hooks/useScrollLock'
import {
  Shield,
  Search,
  Plus,
  Upload,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  LogOut,
  RefreshCw,
  X,
  FileCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Database,
  Layers,
  Sparkles,
  Check,
  RefreshCcw,
  Users,
  UserPlus,
  BookOpen,
  FileText,
  CheckCircle2,
  AlertCircle,
  Eye,
  UploadCloud,
  Target,
  Folder,
  Cloud,
  HardDrive,
  ExternalLink,
} from 'lucide-react'
import './Admin.css'
import { GoogleDrivePdfViewer, type GoogleDriveMaterialItem } from '../components/GoogleDrivePdfViewer'
import { CloudAiGeneratorModal, type CloudAiMode } from '../components/CloudAiGeneratorModal'
import { cleanTamilUnicodeText } from '../utils/tamilUnicodeCleaner'
import { TamilStudyNotesRenderer } from '../components/TamilStudyNotesRenderer'
import {
  SyllabusCascadeSelector,
  useSyllabusCascade,
} from '../components/SyllabusCascadeSelector'
import {
  TNPSC_GROUPS,
  STANDARDS,
  getSubjectsForGroup,
  getUnitsForSubjectStandard,
  getLessonsForSelection,
  getTopicsForSelection,
} from '../data/unifiedSyllabusRegistry'
import {
  STANDARDS_LIST,
  SAMACHEER_CATALOG,
  getSubjectsForStandard,
  getAllowedMediums,
  getAllowedTerms,
  generateSamacheerBookName,
  normalizeStandardId,
  type TnpscGroupId,
  type TextbookMedium,
  type StandardId,
} from '../data/samacheerTextbookCatalog'

interface QuestionItem {
  id: number
  category: string
  unitId: number
  classId: number | null
  subject: string
  lessonTitle: string
  lessonId?: string | null
  topic: string | null
  difficulty: 'Easy' | 'Medium' | 'Hard'
  tag: string
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  sourceReference: string | null
  status: 'staging' | 'published' | 'archived'
  textbookId?: number | null
  sourcePage?: number | null
  verificationStatus?: 'verified' | 'needs_review' | 'rejected'
  createdAt?: string
}

interface TextbookItem {
  id: number
  groupId: string
  standard: number | string
  subject: string
  medium: 'Tamil' | 'English'
  term?: string | null
  bookName: string
  filePath: string
  fileSize: number
  pageCount: number
  status: 'uploaded' | 'processing' | 'completed' | 'failed'
  errorMessage?: string | null
  createdAt?: string
  updatedAt?: string
  job?: {
    status: string
    progressPercent: number
    stepDescription: string
    totalPages: number
    processedPages: number
    errorMessage?: string
  }
}

interface AdminMetrics {
  totalQuestions: number
  stagingCount: number
  publishedCount: number
  pendingReviewCount?: number
  unitsCount?: number
  classesCount?: number
}

interface TextbookMetrics {
  totalTextbooks: number
  stagingCount: number
  publishedCount: number
  classesCovered: number
}

interface StudyNotesMetrics {
  totalNotes: number
  stagingCount: number
  publishedCount: number
  classesCovered: number
}

interface AdminUserItem {
  id: number
  username: string
  name: string
  role: string
  source: 'database' | 'env'
  createdAt?: string | null
}

const Admin = () => {
  // Auth state
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('tnpsc_admin_token'))
  const [adminUser, setAdminUser] = useState<{ id?: number; username: string; name?: string; role?: string } | null>(() => {
    try {
      const saved = localStorage.getItem('tnpsc_admin_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [usernameInput, setUsernameInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Multiple Admin Accounts Management Modal state
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false)
  const [adminUsersList, setAdminUsersList] = useState<AdminUserItem[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [newAdminUsername, setNewAdminUsername] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [newAdminName, setNewAdminName] = useState('')
  const [newAdminRole, setNewAdminRole] = useState<'admin' | 'editor' | 'reviewer' | 'super_admin'>('admin')
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [userActionError, setUserActionError] = useState<string | null>(null)

  // Data & Filters
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [metrics, setMetrics] = useState<AdminMetrics>({ totalQuestions: 0, stagingCount: 0, publishedCount: 0, pendingReviewCount: 0, unitsCount: 0, classesCount: 0 })
  const [textbookMetrics, setTextbookMetrics] = useState<TextbookMetrics>({ totalTextbooks: 0, stagingCount: 0, publishedCount: 0, classesCovered: 0 })
  const [notesMetrics, setNotesMetrics] = useState<StudyNotesMetrics>({ totalNotes: 0, stagingCount: 0, publishedCount: 0, classesCovered: 0 })
  const [filteredTotal, setFilteredTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<number>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isBulkPublishModalOpen, setIsBulkPublishModalOpen] = useState(false)
  const [isBulkPublishing, setIsBulkPublishing] = useState(false)

  // Only explicitly selected STAGING questions are eligible for bulk publishing.
  const selectedStagingIds = questions
    .filter((q) => selectedQuestionIds.has(q.id) && q.status === 'staging')
    .map((q) => q.id)

  // Navigation Section (persists across page reloads and Google OAuth redirects)
  const [adminSection, setAdminSectionState] = useState<'questions' | 'textbooks' | 'notes' | 'gdrive'>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search || ''
      if (search.includes('gdrive=') || search.includes('gdrive_error=')) {
        return 'gdrive'
      }
      const saved = sessionStorage.getItem('admin_active_section')
      if (saved === 'questions' || saved === 'textbooks' || saved === 'notes' || saved === 'gdrive') {
        return saved
      }
    }
    return 'questions'
  })

  const setAdminSection = useCallback((sec: 'questions' | 'textbooks' | 'notes' | 'gdrive') => {
    setAdminSectionState(sec)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('admin_active_section', sec)
    }
  }, [])

  // Google Drive state
  const [driveStatus, setDriveStatus] = useState<{
    connected: boolean
    configured: boolean
    email?: string
    folderName: string
    folderId?: string
    redirectUri?: string
    error?: string
  }>({
    connected: false,
    configured: false,
    folderName: 'TNPSC Study Hub Materials',
  })
  const [isCheckingDrive, setIsCheckingDrive] = useState(false)
  const [isConnectingDrive, setIsConnectingDrive] = useState(false)
  const [driveConnectionError, setDriveConnectionError] = useState<string | null>(null)
  const [driveMaterials, setDriveMaterials] = useState<GoogleDriveMaterialItem[]>([])
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveSearch, setDriveSearch] = useState('')
  const [driveGroupFilter, setDriveGroupFilter] = useState('all')
  const [driveStandardFilter, setDriveStandardFilter] = useState('all')
  const [driveSubjectFilter, setDriveSubjectFilter] = useState('all')
  const [driveTermFilter, setDriveTermFilter] = useState('all')

  // Drive PDF Upload Modal state
  const [isDriveUploadModalOpen, setIsDriveUploadModalOpen] = useState(false)
  const [driveFile, setDriveFile] = useState<File | null>(null)
  const [driveUploadTitle, setDriveUploadTitle] = useState('')
  const [driveUploadTerm, setDriveUploadTerm] = useState('Term 1')
  const [isDriveUploading, setIsDriveUploading] = useState(false)
  const [driveUploadProgress, setDriveUploadProgress] = useState(0)
  const [driveUploadStep, setDriveUploadStep] = useState('')
  const [driveUploadError, setDriveUploadError] = useState<string | null>(null)

  // Drive PDF Viewer & Delete states
  const [viewingDriveMaterial, setViewingDriveMaterial] = useState<GoogleDriveMaterialItem | null>(null)
  const [deletingDriveMaterial, setDeletingDriveMaterial] = useState<GoogleDriveMaterialItem | null>(null)
  const [isDeletingDriveMaterial, setIsDeletingDriveMaterial] = useState(false)

  // Shared 5-Dropdown Syllabus Cascade Selector for Google Drive upload
  const driveSyllabusCascade = useSyllabusCascade({
    allowAll: false,
    initialGroupId: 'group1',
    initialSubjectId: 'general-studies',
    initialClassId: 6,
    initialUnitId: 1,
  })

  // Textbook management state
  const [textbooksList, setTextbooksList] = useState<TextbookItem[]>([])
  const [textbooksLoading, setTextbooksLoading] = useState(false)
  const [textbookSearch, setTextbookSearch] = useState('')
  const [textbookGroupFilter, setTextbookGroupFilter] = useState('all')
  const [textbookStandardFilter, setTextbookStandardFilter] = useState('all')
  const [textbookSubjectFilter, setTextbookSubjectFilter] = useState('all')
  const [textbookMediumFilter, setTextbookMediumFilter] = useState('all')
  const [textbookStatusFilter, setTextbookStatusFilter] = useState('all')

  // Textbook Modals & Actions
  const [isUploadTextbookModalOpen, setIsUploadTextbookModalOpen] = useState(false)
  const [selectedTextbookDetail, setSelectedTextbookDetail] = useState<TextbookItem | null>(null)
  const [textbookExcerpts, setTextbookExcerpts] = useState<any[]>([])
  const [isLoadingExcerpts, setIsLoadingExcerpts] = useState(false)
  const [deletingTextbook, setDeletingTextbook] = useState<TextbookItem | null>(null)
  const [isDeletingTextbook, setIsDeletingTextbook] = useState(false)
  const [replacingTextbookId, setReplacingTextbookId] = useState<number | null>(null)

  // Upload Form Fields (Samacheer Kalvi Dynamic Catalog)
  const [tbGroup, setTbGroup] = useState<TnpscGroupId>('group1')
  const [tbStandard, setTbStandard] = useState<StandardId>('6th')
  const [tbSubject, setTbSubject] = useState<string>('Tamil')
  const [tbMedium, setTbMedium] = useState<TextbookMedium>('Tamil')
  const [tbTerm, setTbTerm] = useState<string>('Term 1')
  const [tbBookName, setTbBookName] = useState<string>(
    'Samacheer Kalvi 6th Standard - Tamil - Term 1 - Tamil Medium'
  )
  const [tbIsCustomBookName, setTbIsCustomBookName] = useState<boolean>(false)
  const [tbFile, setTbFile] = useState<File | null>(null)
  const [tbUploading, setTbUploading] = useState(false)
  const [tbUploadProgress, setTbUploadProgress] = useState(0)
  const [tbUploadError, setTbUploadError] = useState<string | null>(null)

  // Dynamic cascading options for textbook upload modal
  const tbAvailableSubjects = useMemo(() => {
    return getSubjectsForStandard(tbStandard)
  }, [tbStandard])

  const tbSelectedSubjectObj = useMemo(() => {
    return (
      tbAvailableSubjects.find(
        (s) => s.name.toLowerCase() === tbSubject.toLowerCase() || s.id.toLowerCase() === tbSubject.toLowerCase()
      ) || tbAvailableSubjects[0]
    )
  }, [tbAvailableSubjects, tbSubject])

  const tbAvailableMediums = useMemo(() => {
    return getAllowedMediums(tbStandard, tbSelectedSubjectObj?.name || tbSubject)
  }, [tbStandard, tbSelectedSubjectObj, tbSubject])

  const tbAvailableTerms = useMemo(() => {
    return getAllowedTerms(tbStandard, tbSelectedSubjectObj?.name || tbSubject)
  }, [tbStandard, tbSelectedSubjectObj, tbSubject])

  // Live duplicate detection in current database textbooks
  const tbDuplicateInDb = useMemo(() => {
    if (!textbooksList || textbooksList.length === 0) return null
    const stdNum = parseInt(tbStandard, 10)
    return textbooksList.find(
      (t) =>
        t.groupId.toLowerCase() === tbGroup.toLowerCase() &&
        (t.standard === stdNum || String(t.standard) === tbStandard) &&
        t.subject.toLowerCase() === tbSubject.toLowerCase() &&
        t.medium.toLowerCase() === tbMedium.toLowerCase() &&
        (t.term || 'Full Year').toLowerCase() === tbTerm.toLowerCase() &&
        (!replacingTextbookId || t.id !== replacingTextbookId)
    )
  }, [textbooksList, tbGroup, tbStandard, tbSubject, tbMedium, tbTerm, replacingTextbookId])

  // Dynamic subjects for Textbook Management filter bar based on selected Group and Standard
  const textbookFilterSubjects = useMemo(() => {
    const subjectsSet = new Set<string>()

    if (textbookStandardFilter !== 'all') {
      const catalogSubs = getSubjectsForStandard(textbookStandardFilter)
      catalogSubs.forEach((s) => subjectsSet.add(s.name))
    } else {
      // All standards
      Object.values(SAMACHEER_CATALOG).forEach((entry) => {
        entry.subjects.forEach((s) => subjectsSet.add(s.name))
      })
    }

    // Also include any custom/existing subject from textbooksList matching current group & standard filters
    textbooksList.forEach((tb) => {
      const matchesGroup =
        textbookGroupFilter === 'all' || tb.groupId?.toLowerCase() === textbookGroupFilter.toLowerCase()
      const matchesStd =
        textbookStandardFilter === 'all' ||
        tb.standard === parseInt(textbookStandardFilter, 10) ||
        String(tb.standard).toLowerCase() === textbookStandardFilter.toLowerCase()
      if (matchesGroup && matchesStd && tb.subject && tb.subject.trim()) {
        subjectsSet.add(tb.subject.trim())
      }
    })

    return Array.from(subjectsSet).sort()
  }, [textbookGroupFilter, textbookStandardFilter, textbooksList])

  // Reset subject filter if selected subject is no longer available
  useEffect(() => {
    if (textbookSubjectFilter !== 'all' && !textbookFilterSubjects.includes(textbookSubjectFilter)) {
      setTextbookSubjectFilter('all')
    }
  }, [textbookFilterSubjects, textbookSubjectFilter])

  // Notes management state
  const [notesList, setNotesList] = useState<any[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [notesSearchQuery, setNotesSearchQuery] = useState('')
  const [notesStatusFilter, setNotesStatusFilter] = useState<'all' | 'staging' | 'published'>('all')
  const [notesLanguageFilter, setNotesLanguageFilter] = useState<'all' | 'tamil' | 'english'>('all')
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<number>>(new Set())
  const [notesBulkDeleting, setNotesBulkDeleting] = useState(false)
  const [notesPage, setNotesPage] = useState(1)
  const notesPageSize = 25
  const [notesFilteredTotal, setNotesFilteredTotal] = useState(0)

  // 5-Tier Syllabus Cascade for Study Notes (Independent from Question Bank)
  const notesSyllabusCascade = useSyllabusCascade({
    allowAll: true,
    onChange: () => setNotesPage(1),
  })
  const {
    groupId: notesGroupFilter,
    subjectId: notesSubjectFilter,
    classId: notesStandardFilter,
    unitId: notesUnitFilter,
    lessonTitle: notesLessonFilter,
    selectedLessonObj: notesSelectedLessonObj,
  } = notesSyllabusCascade

  // Modals state for Study Notes
  const [isNotesEditModalOpen, setIsNotesEditModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<any | null>(null)
  const [isDeletingNote, setIsDeletingNote] = useState<any | null>(null)
  const [previewingNote, setPreviewingNote] = useState<any | null>(null)
  const [isNotesBulkPublishModalOpen, setIsNotesBulkPublishModalOpen] = useState(false)
  const [isNotesBulkUploadModalOpen, setIsNotesBulkUploadModalOpen] = useState(false)
  const [notesBulkRawText, setNotesBulkRawText] = useState('')
  const [notesBulkParsedCount, setNotesBulkParsedCount] = useState<number | null>(null)
  const [notesBulkParseError, setNotesBulkParseError] = useState<string | null>(null)
  const [isNotesBulkUploading, setIsNotesBulkUploading] = useState(false)
  const [isNotesBulkPublishing, setIsNotesBulkPublishing] = useState(false)
  const [notesPreviewTab, setNotesPreviewTab] = useState<'edit' | 'preview'>('edit')

  // Filter Bar state (reuses cascading syllabus logic)
  const [targetSystemFilter, setTargetSystemFilter] = useState<'study_materials' | 'main_practice'>('study_materials')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 50

  const qbSyllabusCascade = useSyllabusCascade({
    allowAll: true,
    onChange: () => setPage(1),
  })
  const {
    groupId: groupFilter,
    subjectId: subjectFilter,
    classId: standardFilter,
    unitId: unitFilter,
    lessonTitle: lessonFilter,
    selectedSubjectObj: qbSelectedSubjectObj,
    selectedLessonObj: qbSelectedLessonObj,
  } = qbSyllabusCascade

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Partial<QuestionItem> | null>(null)
  const [isDeleting, setIsDeleting] = useState<QuestionItem | null>(null)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [bulkGroupId, setBulkGroupId] = useState<'group1' | 'group2' | 'group4'>('group1')
  const [bulkRawText, setBulkRawText] = useState('')
  const [bulkParsedCount, setBulkParsedCount] = useState<number | null>(null)
  const [bulkParseError, setBulkParseError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Cloud AI Generator Modal state
  const [isCloudAiModalOpen, setIsCloudAiModalOpen] = useState(false)
  const [cloudAiModalMode, setCloudAiModalMode] = useState<CloudAiMode>('notes')

  const handleOpenCloudAiGenerator = (mode: CloudAiMode) => {
    setCloudAiModalMode(mode)
    setIsCloudAiModalOpen(true)
  }

  // Lock background page scrolling strictly when any admin modal is open
  const hasOpenAdminModal =
    isUsersModalOpen ||
    isEditModalOpen ||
    Boolean(isDeleting) ||
    Boolean(deletingTextbook) ||
    isBulkModalOpen ||
    isBulkPublishModalOpen ||
    isUploadTextbookModalOpen ||
    Boolean(selectedTextbookDetail) ||
    isCloudAiModalOpen ||
    isNotesEditModalOpen ||
    Boolean(previewingNote) ||
    Boolean(isDeletingNote) ||
    isNotesBulkPublishModalOpen ||
    isNotesBulkUploadModalOpen ||
    isDriveUploadModalOpen ||
    Boolean(viewingDriveMaterial) ||
    Boolean(deletingDriveMaterial)
  useScrollLock(hasOpenAdminModal)

  // Login handler (single POST attempt with distinct error classification)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setIsLoggingIn(true)

    const cleanUser = usernameInput.trim().toLowerCase()
    const cleanPass = passwordInput.trim()

    if (!cleanUser || !cleanPass) {
      setLoginError('Username and password are required.')
      setIsLoggingIn(false)
      return
    }

    try {
      let res: Response | null = null
      let data: any = {}
      let rawText = ''

      try {
        res = await apiFetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser, password: cleanPass }),
          timeoutMs: 15000,
        })
        rawText = await res.text().catch(() => '')
        if (rawText) {
          try {
            data = JSON.parse(rawText)
          } catch {
            data = {}
          }
        }
      } catch (requestErr: any) {
        console.warn('Admin login request failed:', requestErr)

        if (requestErr?.name === 'TimeoutError' || requestErr?.name === 'AbortError') {
          setLoginError(
            'Authentication request timed out. The backend server may be waking up from a cold start—please try again.'
          )
          return
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setLoginError('Network failure: You appear to be offline. Please check your internet connection.')
          return
        }

        setLoginError(
          'Backend server is unreachable or unavailable. Please verify that the backend service is running and accessible.'
        )
        return
      }

      if (res && res.ok && data.token) {
        localStorage.setItem('tnpsc_admin_token', data.token)
        if (data.user) {
          localStorage.setItem('tnpsc_admin_user', JSON.stringify(data.user))
          setAdminUser(data.user)
        }
        setToken(data.token)
        setUsernameInput('')
        setPasswordInput('')
        showToast('success', `Signed in as ${data.user?.name || cleanUser}`)
        return
      }

      if (!res) {
        setLoginError(
          'Backend server is unreachable. Please verify network or backend server connection.'
        )
        return
      }

      if (res.status === 400) {
        setLoginError(data.message || 'Invalid login request: Username and password are required.')
        return
      }

      if (res.status === 401) {
        setLoginError(data.message || 'Unauthorized (401): Invalid admin username or password.')
        return
      }

      if (res.status === 403) {
        setLoginError(
          data.message || 'Forbidden (403): You do not have permission to access the Admin Portal.'
        )
        return
      }

      if (res.status === 404) {
        setLoginError(
          data.message ||
            'Authentication endpoint not found (404): Verify the backend API URL and /api/admin/login route.'
        )
        return
      }

      if (res.status === 408 || res.status === 504) {
        setLoginError(
          data.message || 'Request timeout (504): The authentication server took too long to respond.'
        )
        return
      }

      // Distinguish database connection failure from general 500/502/503 errors
      if (
        data.dbStatus === 'disconnected' ||
        (typeof data.message === 'string' && /database|postgres/i.test(data.message))
      ) {
        setLoginError(
          data.message ||
            'Database connection failure: Unable to reach PostgreSQL. Please verify database configuration and health.'
        )
        return
      }

      if (res.status === 502 || res.status === 503) {
        setLoginError(
          data.message ||
            `Service unavailable (${res.status}): The backend authentication service is temporarily unavailable.`
        )
        return
      }

      if (res.status === 500) {
        const vercelCrash = rawText.includes('FUNCTION_INVOCATION_FAILED')
          ? 'Backend serverless function failed during invocation (500).'
          : 'Internal server error (500) occurred on the backend authentication service.'
        setLoginError(data.message || vercelCrash)
        return
      }

      setLoginError(data.message || `Login failed (HTTP ${res.status}). Please try again.`)
    } catch (err: any) {
      console.error('Admin login error:', err)
      setLoginError('Unexpected error during authentication. Please try again.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('tnpsc_admin_token')
    localStorage.removeItem('tnpsc_admin_user')
    setToken(null)
    setAdminUser(null)
  }

  // Fetch all admin accounts (DB + .env)
  const fetchAdminUsers = async () => {
    if (!token) return
    setIsLoadingUsers(true)
    setUserActionError(null)
    try {
      let res: Response | null = null
      let data: any = {}
      try {
        res = await apiFetch('/api/admin/users', {
          headers: { Authorization: `Bearer ${token}` },
        })
        data = await res.json().catch(() => ({}))
      } catch (err) {
        console.warn('Backend /api/admin/users unreachable, using standalone accounts:', err)
      }

      if (res && res.ok && data.users) {
        setAdminUsersList(data.users)
      } else {
        // Fallback for static hosts (Vercel)
        const defaultAccounts: AdminUserItem[] = [
          { id: 1, username: 'admin', name: 'Super Admin', role: 'super_admin', source: 'env' },
          { id: 2, username: 'content_admin', name: 'Content Administrator', role: 'admin', source: 'env' },
          { id: 3, username: 'reviewer', name: 'Syllabus Reviewer', role: 'reviewer', source: 'env' },
        ]
        const customRaw = localStorage.getItem('tnpsc_custom_admins')
        const custom: AdminUserItem[] = customRaw ? JSON.parse(customRaw) : []
        setAdminUsersList([...defaultAccounts, ...custom])
      }
    } catch {
      setUserActionError('Network error while loading admin accounts')
    } finally {
      setIsLoadingUsers(false)
    }
  }

  // Create a new admin account
  const handleCreateAdminUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setIsCreatingUser(true)
    setUserActionError(null)

    try {
      let res: Response | null = null
      let data: any = {}

      try {
        res = await apiFetch('/api/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            username: newAdminUsername,
            password: newAdminPassword,
            name: newAdminName,
            role: newAdminRole,
          }),
        })
        data = await res.json().catch(() => ({}))
      } catch (err) {
        console.warn('Backend unreachable, saving admin locally:', err)
      }

      if (res && res.ok) {
        showToast('success', `Admin account "${newAdminUsername}" created successfully!`)
        setNewAdminUsername('')
        setNewAdminPassword('')
        setNewAdminName('')
        setNewAdminRole('admin')
        fetchAdminUsers()
      } else if (!res || res.status === 405 || res.status === 404) {
        // Save to localStorage in Vercel Standalone Mode
        const customRaw = localStorage.getItem('tnpsc_custom_admins')
        const custom: AdminUserItem[] = customRaw ? JSON.parse(customRaw) : []
        const newAcc: AdminUserItem = {
          id: Date.now(),
          username: newAdminUsername.toLowerCase().trim(),
          name: newAdminName.trim(),
          role: newAdminRole,
          source: 'database',
          createdAt: new Date().toISOString(),
        }
        localStorage.setItem('tnpsc_custom_admins', JSON.stringify([...custom, newAcc]))
        showToast('success', `Admin account "${newAdminUsername}" created (Vercel Standalone)!`)
        setNewAdminUsername('')
        setNewAdminPassword('')
        setNewAdminName('')
        setNewAdminRole('admin')
        fetchAdminUsers()
      } else {
        setUserActionError(data.message || 'Failed to create admin account')
      }
    } catch {
      setUserActionError('Network error while creating admin account')
    } finally {
      setIsCreatingUser(false)
    }
  }

  // Delete an admin account
  const handleDeleteAdminUser = async (id: number, username: string) => {
    if (!token) return
    if (!window.confirm(`Are you sure you want to delete admin account "${username}"?`)) return
    try {
      let res: Response | null = null

      try {
        res = await apiFetch(`/api/admin/users/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch (err) {
        console.warn('Backend unreachable, deleting locally:', err)
      }

      if (res && res.ok) {
        showToast('success', `Admin account "${username}" deleted`)
        fetchAdminUsers()
      } else {
        // Local removal for standalone mode
        const customRaw = localStorage.getItem('tnpsc_custom_admins')
        const custom: AdminUserItem[] = customRaw ? JSON.parse(customRaw) : []
        const filtered = custom.filter((c) => c.id !== id)
        localStorage.setItem('tnpsc_custom_admins', JSON.stringify(filtered))
        showToast('success', `Admin account "${username}" deleted`)
        fetchAdminUsers()
      }
    } catch {
      showToast('error', 'Network error while deleting admin account')
    }
  }

  // Auto-sync session user profile and handle expired/invalid tokens cleanly
  useEffect(() => {
    if (token) {
      apiFetch('/api/admin/verify', {
        headers: { Authorization: `Bearer ${token}` },
        timeoutMs: 10000,
      })
        .then(async (res) => {
          if (res.status === 401 || res.status === 403) {
            handleLogout()
            setLoginError('Your admin session has expired. Please sign in again.')
            return null
          }
          return res.json().catch(() => null)
        })
        .then((data) => {
          if (data && data.status === 'success' && data.user) {
            setAdminUser(data.user)
            localStorage.setItem('tnpsc_admin_user', JSON.stringify(data.user))
          }
        })
        .catch(() => {})
    }
  }, [token])

  // Fetch Questions (supports all 5 AI Generator syllabus filters + status, difficulty, search)
  const fetchQuestions = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      if (groupFilter !== 'all') params.set('category', groupFilter)
      if (subjectFilter !== 'all') {
        params.set('subject', qbSelectedSubjectObj?.name || subjectFilter)
      }
      if (standardFilter !== 'all') params.set('classId', String(standardFilter))
      if (unitFilter !== 'all') params.set('unitId', String(unitFilter))
      if (lessonFilter !== 'all' && lessonFilter.trim()) {
        params.set('lessonTitle', lessonFilter.trim())
        if (qbSelectedLessonObj?.id) {
          params.set('lessonId', qbSelectedLessonObj.id)
        }
      }
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (difficultyFilter !== 'all') params.set('difficulty', difficultyFilter)
      params.set('limit', pageSize.toString())
      params.set('offset', ((page - 1) * pageSize).toString())

      let res: Response | null = null
      let data: any = null

      try {
        const endpoint = targetSystemFilter === 'study_materials'
          ? `/api/study-materials/questions/admin?${params.toString()}`
          : `/api/questions/admin?${params.toString()}`
        res = await apiFetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 401 || res.status === 403) {
          handleLogout()
          return
        }
        if (res.ok) {
          data = await res.json()
        }
      } catch (e) {
        console.warn('Backend questions/admin unreachable, using local staged view:', e)
      }

      if (data && data.status === 'success') {
        setQuestions(data.data)
        setMetrics(data.metrics)
        setFilteredTotal(data.filteredTotal)
      } else {
        // Fallback for static hosts (Vercel) when backend is not connected
        const localStagedRaw = localStorage.getItem('tnpsc_staged_questions')
        const localStaged: QuestionItem[] = localStagedRaw ? JSON.parse(localStagedRaw) : []
        const filteredLocal = localStaged.filter((q) => {
          if (groupFilter !== 'all' && q.category?.toLowerCase() !== groupFilter.toLowerCase()) {
            return false
          }
          if (subjectFilter !== 'all') {
            const targetSubj = (qbSelectedSubjectObj?.name || subjectFilter).toLowerCase()
            const qSubj = (q.subject || '').toLowerCase()
            if (targetSubj.includes('tamil')) {
              if (!qSubj.includes('tamil') && !qSubj.includes('தமிழ்')) return false
            } else if (targetSubj.includes('english')) {
              if (!qSubj.includes('english')) return false
            } else if (targetSubj.includes('aptitude')) {
              if (!qSubj.includes('aptitude')) return false
            } else if (qSubj !== targetSubj) {
              return false
            }
          }
          if (standardFilter !== 'all' && Number(q.classId) !== Number(standardFilter)) {
            return false
          }
          if (unitFilter !== 'all' && Number(q.unitId) !== Number(unitFilter)) {
            return false
          }
          if (
            lessonFilter !== 'all' &&
            lessonFilter.trim() &&
            (q.lessonTitle || '').trim().toLowerCase() !== lessonFilter.trim().toLowerCase()
          ) {
            return false
          }
          if (statusFilter !== 'all' && q.status !== statusFilter) {
            return false
          }
          if (difficultyFilter !== 'all' && q.difficulty !== difficultyFilter) {
            return false
          }
          if (searchQuery.trim()) {
            const sq = searchQuery.trim().toLowerCase()
            const matches =
              String(q.id) === sq ||
              (q.question || '').toLowerCase().includes(sq) ||
              (q.lessonTitle || '').toLowerCase().includes(sq) ||
              (q.subject || '').toLowerCase().includes(sq)
            if (!matches) return false
          }
          return true
        })
        setQuestions(filteredLocal)
        setMetrics({
          totalQuestions: 320 + localStaged.length,
          stagingCount: localStaged.length,
          publishedCount: 320,
        })
        setFilteredTotal(filteredLocal.length)
      }
    } catch (err: any) {
      console.error('Failed to load questions:', err)
    } finally {
      setIsLoading(false)
    }
  }, [
    token,
    searchQuery,
    groupFilter,
    subjectFilter,
    qbSelectedSubjectObj,
    standardFilter,
    unitFilter,
    lessonFilter,
    qbSelectedLessonObj,
    statusFilter,
    difficultyFilter,
    targetSystemFilter,
    page,
  ])

  const fetchNotes = useCallback(async () => {
    if (!token) return
    setNotesLoading(true)
    try {
      const params = new URLSearchParams()
      if (notesSearchQuery.trim()) params.set('search', notesSearchQuery.trim())
      if (notesGroupFilter !== 'all') params.set('category', notesGroupFilter)
      if (notesSubjectFilter !== 'all') params.set('subject', notesSubjectFilter)
      if (notesStandardFilter !== 'all') params.set('classId', String(notesStandardFilter))
      if (notesUnitFilter !== 'all') params.set('unitId', String(notesUnitFilter))
      if (notesSelectedLessonObj?.id) {
        params.set('lessonId', notesSelectedLessonObj.id)
      }
      if (notesLessonFilter !== 'all') params.set('lesson', notesLessonFilter)
      if (notesStatusFilter !== 'all') params.set('status', notesStatusFilter)
      if (notesLanguageFilter !== 'all') params.set('language', notesLanguageFilter)
      params.set('limit', String(notesPageSize))
      params.set('offset', String((notesPage - 1) * notesPageSize))

      const res = await apiFetch(`/api/notes/admin?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok && data.status === 'success' && Array.isArray(data.data)) {
        setNotesList(data.data)
        setNotesFilteredTotal(data.total || 0)
        if (data.metrics) {
          setNotesMetrics(data.metrics)
        }
      } else {
        setNotesList([])
        setNotesFilteredTotal(0)
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err)
      setNotesList([])
      setNotesFilteredTotal(0)
    } finally {
      setNotesLoading(false)
    }
  }, [
    token,
    notesSearchQuery,
    notesGroupFilter,
    notesSubjectFilter,
    notesStandardFilter,
    notesUnitFilter,
    notesLessonFilter,
    notesSelectedLessonObj,
    notesStatusFilter,
    notesLanguageFilter,
    notesPage,
  ])

  // Fetch Textbooks
  const fetchTextbooks = useCallback(async () => {
    if (!token) return
    setTextbooksLoading(true)
    try {
      const params = new URLSearchParams()
      if (textbookGroupFilter !== 'all') params.set('group', textbookGroupFilter)
      if (textbookStandardFilter !== 'all') params.set('standard', textbookStandardFilter)
      if (textbookSubjectFilter !== 'all') params.set('subject', textbookSubjectFilter)
      if (textbookMediumFilter !== 'all') params.set('medium', textbookMediumFilter)
      if (textbookStatusFilter !== 'all') params.set('status', textbookStatusFilter)

      const res = await apiFetch(`/api/textbooks?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const { data } = await parseApiResponse(res)
      if (res.ok && data.status === 'success' && Array.isArray(data.data)) {
        setTextbooksList(data.data)
        if (data.metrics) {
          setTextbookMetrics(data.metrics)
        }
      }
    } catch (err) {
      console.error('Failed to fetch textbooks:', err)
    } finally {
      setTextbooksLoading(false)
    }
  }, [token, textbookGroupFilter, textbookStandardFilter, textbookSubjectFilter, textbookMediumFilter, textbookStatusFilter])

  useEffect(() => {
    if (token) {
      fetchTextbooks()
    }
  }, [fetchTextbooks, token])

  // Check Google Drive Status
  const checkDriveStatus = useCallback(async () => {
    setIsCheckingDrive(true)
    try {
      const res = await apiFetch('/api/drive/status')
      const json = await res.json()
      if (res.ok && json.status === 'success') {
        setDriveStatus(json.data)
        if (json.data?.connected) {
          setDriveConnectionError(null)
          setIsConnectingDrive(false)
        }
      }
    } catch (err: any) {
      console.warn('Could not check Google Drive status:', err.message)
    } finally {
      setIsCheckingDrive(false)
    }
  }, [])

  // Fetch Google Drive Materials
  const fetchDriveMaterials = useCallback(async () => {
    setDriveLoading(true)
    try {
      const params = new URLSearchParams()
      if (driveGroupFilter !== 'all') params.set('group', driveGroupFilter)
      if (driveStandardFilter !== 'all') params.set('standard', driveStandardFilter)
      if (driveSubjectFilter !== 'all') params.set('subject', driveSubjectFilter)
      if (driveTermFilter !== 'all') params.set('term', driveTermFilter)
      if (driveSearch.trim()) params.set('search', driveSearch.trim())

      const res = await apiFetch(`/api/drive/materials?${params.toString()}`)
      const json = await res.json()
      if (res.ok && json.status === 'success' && Array.isArray(json.data)) {
        setDriveMaterials(json.data)
      } else {
        setDriveMaterials([])
      }
    } catch (err: any) {
      console.error('Failed to fetch Google Drive materials:', err)
      setDriveMaterials([])
    } finally {
      setDriveLoading(false)
    }
  }, [driveGroupFilter, driveStandardFilter, driveSubjectFilter, driveTermFilter, driveSearch])

  // Connect Google Drive
  const handleConnectGoogleDrive = async () => {
    try {
      setIsConnectingDrive(true)
      setDriveConnectionError(null)
      const authHeader: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
      const originParam = encodeURIComponent(window.location.origin)
      const clientIdParam = import.meta.env.VITE_GOOGLE_CLIENT_ID
        ? `&clientId=${encodeURIComponent(import.meta.env.VITE_GOOGLE_CLIENT_ID)}`
        : ''
      const res = await apiFetch(`/api/drive/auth/url?origin=${originParam}${clientIdParam}`, {
        headers: authHeader,
      })
      const data = await res.json()
      if (res.ok && data.data?.authUrl) {
        window.location.href = data.data.authUrl
      } else {
        setIsConnectingDrive(false)
        const errMsg = data.message || 'Could not initiate Google authorization. Please check server credentials.'
        setDriveConnectionError(errMsg)
        setActionMessage({
          type: 'error',
          text: errMsg,
        })
      }
    } catch (err: any) {
      setIsConnectingDrive(false)
      const errMsg = err.message || 'Connection failed'
      setDriveConnectionError(errMsg)
      setActionMessage({ type: 'error', text: errMsg })
    }
  }

  // Disconnect Google Drive
  const handleDisconnectGoogleDrive = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Google Drive account?')) return
    try {
      const res = await apiFetch('/api/drive/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setActionMessage({ type: 'success', text: 'Google Drive disconnected successfully.' })
        setDriveConnectionError(null)
        setIsConnectingDrive(false)
        checkDriveStatus()
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to disconnect.' })
    }
  }

  // Resumable Direct Upload to Google Drive (Chunked, CORS-bound, Zero Serverless Limits)
  const handleStartDriveUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!driveFile) {
      setDriveUploadError('Please select a PDF document to upload.')
      return
    }
    if (driveFile.type !== 'application/pdf' && !driveFile.name.toLowerCase().endsWith('.pdf')) {
      setDriveUploadError('Invalid file type: Only PDF documents (.pdf) are permitted.')
      return
    }

    setIsDriveUploading(true)
    setDriveUploadError(null)
    setDriveUploadProgress(5)
    setDriveUploadStep('Authorizing and creating Google Drive resumable session...')

    try {
      const finalTitle = driveUploadTitle.trim() || driveFile.name.replace(/\.pdf$/i, '')
      const initRes = await apiFetch('/api/drive/upload/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: `${finalTitle}.pdf`,
          originalFileName: driveFile.name,
          fileSize: driveFile.size,
          mimeType: 'application/pdf',
          origin: window.location.origin, // Explicitly pass current browser origin for Google Drive CORS binding
          group: driveSyllabusCascade.effectiveGroupId,
          subject: driveSyllabusCascade.selectedSubjectObj?.name || 'General Studies',
          standard: driveSyllabusCascade.currentClassId,
          term: driveUploadTerm,
          unit: driveSyllabusCascade.currentUnitId,
          lesson: driveSyllabusCascade.currentLessonTitle,
          lessonId: driveSyllabusCascade.selectedLessonObj?.id,
        }),
      })

      const initData = await initRes.json()
      if (!initRes.ok || !initData.data?.uploadUrl) {
        throw new Error(initData.message || 'Failed to initiate Google Drive upload session.')
      }

      const { uploadUrl, trackingId } = initData.data
      setDriveUploadProgress(15)
      setDriveUploadStep(`Preparing direct streaming for ${(driveFile.size / (1024 * 1024)).toFixed(1)} MB...`)

      // Stream file directly to Google Drive via 5 MB chunks with resume & retry
      const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MB chunks (aligned with 256 KiB Google requirement)
      const totalSize = driveFile.size
      const totalChunks = Math.ceil(totalSize / CHUNK_SIZE)
      let currentOffset = 0
      let googleDriveFileId = ''

      while (currentOffset < totalSize) {
        const chunkIndex = Math.floor(currentOffset / CHUNK_SIZE)
        const chunkEnd = Math.min(currentOffset + CHUNK_SIZE - 1, totalSize - 1)
        const chunkBlob = driveFile.slice(currentOffset, chunkEnd + 1)
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
                // Set only Content-Range and Content-Type. Do not set Authorization to avoid CORS rejection.
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
                    // 308 Resume Incomplete = chunk received successfully
                    const rangeHeader = xhr.getResponseHeader('Range')
                    resolve({ status: 308, range: rangeHeader || undefined })
                  } else if (xhr.status === 200 || xhr.status === 201) {
                    // Upload completed!
                    try {
                      const data = JSON.parse(xhr.responseText || '{}')
                      resolve({ status: xhr.status, fileId: data.id })
                    } catch {
                      resolve({ status: xhr.status })
                    }
                  } else {
                    reject(
                      new Error(
                        `Google Drive returned HTTP ${xhr.status} (${xhr.statusText}): ${xhr.responseText || 'Upload rejected'}`
                      )
                    )
                  }
                }

                xhr.onerror = () => {
                  reject(
                    new Error(
                      `Network / CORS error during Google Drive upload (Chunk ${chunkIndex + 1}/${totalChunks}). ` +
                      `Please check your internet connection, or verify in Google Cloud Console that "${window.location.origin}" is added to Authorized JavaScript origins for your OAuth 2.0 Client ID.`
                    )
                  )
                }

                xhr.ontimeout = () => {
                  reject(new Error(`Upload chunk ${chunkIndex + 1} timed out. Retrying...`))
                }

                // 2 minute timeout per chunk
                xhr.timeout = 120000
                xhr.send(chunkBlob)
              }
            )

            if (chunkResult.status === 308) {
              chunkDone = true
              if (chunkResult.range) {
                const match = chunkResult.range.match(/bytes=0-(\d+)/)
                if (match && match[1]) {
                  currentOffset = parseInt(match[1], 10) + 1
                } else {
                  currentOffset = chunkEnd + 1
                }
              } else {
                currentOffset = chunkEnd + 1
              }
            } else if (chunkResult.status === 200 || chunkResult.status === 201) {
              chunkDone = true
              googleDriveFileId = chunkResult.fileId || ''
              currentOffset = totalSize
            }
          } catch (chunkErr: any) {
            console.warn(`Chunk ${chunkIndex + 1} attempt ${chunkAttempt} failed:`, chunkErr.message)
            if (chunkAttempt >= maxAttempts) {
              throw chunkErr
            }
            // Exponential backoff wait
            await new Promise((r) => setTimeout(r, 1000 * chunkAttempt))

            // Query Google Drive for the current byte offset
            try {
              const checkRes = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                  'Content-Range': `bytes */${totalSize}`,
                },
              })
              if (checkRes.status === 308) {
                const range = checkRes.headers.get('Range')
                if (range) {
                  const match = range.match(/bytes=0-(\d+)/)
                  if (match && match[1]) {
                    currentOffset = parseInt(match[1], 10) + 1
                    console.log(`Resuming upload from confirmed offset: ${currentOffset}`)
                  }
                }
              } else if (checkRes.status === 200 || checkRes.status === 201) {
                const checkData = await checkRes.json().catch(() => ({}))
                googleDriveFileId = checkData.id || ''
                currentOffset = totalSize
                chunkDone = true
              }
            } catch {
              // resume probe failed, will retry chunk directly
            }
          }
        }
      }

      if (!googleDriveFileId) {
        throw new Error('Google Drive upload finished but did not return a valid file ID.')
      }

      setDriveUploadProgress(96)
      setDriveUploadStep('Verifying file in Google Drive & registering in database...')

      const completeRes = await apiFetch('/api/drive/upload/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
      setActionMessage({
        type: 'success',
        text: `PDF "${finalTitle}" (${(driveFile.size / (1024 * 1024)).toFixed(1)} MB) successfully uploaded directly to Google Drive!`,
      })
      setIsDriveUploadModalOpen(false)
      setDriveFile(null)
      setDriveUploadTitle('')
      fetchDriveMaterials()
    } catch (err: any) {
      console.error('Google Drive upload error:', err)
      setDriveUploadError(err.message || 'Failed to upload PDF')
    } finally {
      setIsDriveUploading(false)
    }
  }

  // Delete Drive Material
  const handleDeleteDriveMaterial = async (id: number) => {
    setIsDeletingDriveMaterial(true)
    try {
      const res = await apiFetch(`/api/drive/materials/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Delete failed')
      setActionMessage({ type: 'success', text: 'PDF material successfully deleted from Google Drive and database.' })
      setDeletingDriveMaterial(null)
      fetchDriveMaterials()
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Delete failed' })
    } finally {
      setIsDeletingDriveMaterial(false)
    }
  }

  // Handle OAuth callback query parameters and initial Google Drive check
  useEffect(() => {
    checkDriveStatus()
    fetchDriveMaterials()

    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('gdrive') === 'connected') {
      const email = urlParams.get('email')
      setIsConnectingDrive(false)
      setDriveConnectionError(null)
      setActionMessage({
        type: 'success',
        text: `Google Drive account successfully connected! ${email ? `(${email})` : ''}`,
      })
      setAdminSection('gdrive')
      window.history.replaceState({}, document.title, window.location.pathname)
      // Immediately refresh status and materials list
      checkDriveStatus()
      fetchDriveMaterials()
    } else if (urlParams.get('gdrive_error')) {
      const err = urlParams.get('gdrive_error') || 'Unknown OAuth error'
      setIsConnectingDrive(false)
      setDriveConnectionError(err)
      setActionMessage({
        type: 'error',
        text: `Google Drive connection failed: ${err}`,
      })
      setAdminSection('gdrive')
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [checkDriveStatus, fetchDriveMaterials, setAdminSection])

  // Fetch All Global Metrics for Question Bank, Textbooks, and Study Notes
  const fetchAllMetrics = useCallback(async () => {
    try {
      const authHeader: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
      const [qRes, tRes, nRes] = await Promise.all([
        apiFetch(`/api/questions/metrics?target_system=${targetSystemFilter}`, { headers: authHeader }).catch(() => null),
        apiFetch('/api/textbooks/metrics', { headers: authHeader }).catch(() => null),
        apiFetch('/api/notes/metrics', { headers: authHeader }).catch(() => null),
      ])

      if (qRes && qRes.ok) {
        const qData = await qRes.json()
        if (qData.metrics) setMetrics(qData.metrics)
      }
      if (tRes && tRes.ok) {
        const tData = await tRes.json()
        if (tData.metrics) setTextbookMetrics(tData.metrics)
      }
      if (nRes && nRes.ok) {
        const nData = await nRes.json()
        if (nData.metrics) setNotesMetrics(nData.metrics)
      }
    } catch (e) {
      console.warn('Failed to fetch initial metrics:', e)
    }
  }, [token, targetSystemFilter])

  useEffect(() => {
    if (token) {
      fetchAllMetrics()
    }
  }, [fetchAllMetrics, token, adminSection])

  // Poll active processing jobs
  useEffect(() => {
    const hasActiveProcessing =
      textbooksList.some((t) => t.status === 'processing' || t.status === 'uploaded')

    if (!hasActiveProcessing || !token) return

    const interval = setInterval(() => {
      fetchTextbooks()
    }, 2500)

    return () => clearInterval(interval)
  }, [textbooksList, token, fetchTextbooks])

  // Cascading Handlers for Textbook Upload Modal (Samacheer Kalvi Catalog)
  const handleTbStandardChange = (newStd: StandardId) => {
    setTbStandard(newStd)
    const newSubjects = getSubjectsForStandard(newStd)
    const subjectStillValid = newSubjects.some(
      (s) => s.name.toLowerCase() === tbSubject.toLowerCase()
    )
    const effectiveSubject = subjectStillValid ? tbSubject : newSubjects[0].name
    if (!subjectStillValid) {
      setTbSubject(effectiveSubject)
    }

    const newMediums = getAllowedMediums(newStd, effectiveSubject)
    const mediumStillValid = newMediums.includes(tbMedium)
    const effectiveMedium = mediumStillValid ? tbMedium : newMediums[0]
    if (!mediumStillValid) {
      setTbMedium(effectiveMedium)
    }

    const newTerms = getAllowedTerms(newStd, effectiveSubject)
    const termStillValid = newTerms.includes(tbTerm)
    const effectiveTerm = termStillValid ? tbTerm : newTerms[0]
    if (!termStillValid) {
      setTbTerm(effectiveTerm)
    }

    if (!tbIsCustomBookName) {
      setTbBookName(
        generateSamacheerBookName({
          standard: newStd,
          subject: effectiveSubject,
          medium: effectiveMedium,
          term: effectiveTerm,
        })
      )
    }
  }

  const handleTbSubjectChange = (newSubjectName: string) => {
    setTbSubject(newSubjectName)

    const newMediums = getAllowedMediums(tbStandard, newSubjectName)
    const mediumStillValid = newMediums.includes(tbMedium)
    const effectiveMedium = mediumStillValid ? tbMedium : newMediums[0]
    if (!mediumStillValid) {
      setTbMedium(effectiveMedium)
    }

    const newTerms = getAllowedTerms(tbStandard, newSubjectName)
    const termStillValid = newTerms.includes(tbTerm)
    const effectiveTerm = termStillValid ? tbTerm : newTerms[0]
    if (!termStillValid) {
      setTbTerm(effectiveTerm)
    }

    if (!tbIsCustomBookName) {
      setTbBookName(
        generateSamacheerBookName({
          standard: tbStandard,
          subject: newSubjectName,
          medium: effectiveMedium,
          term: effectiveTerm,
        })
      )
    }
  }

  const handleTbMediumChange = (newMedium: TextbookMedium) => {
    setTbMedium(newMedium)
    if (!tbIsCustomBookName) {
      setTbBookName(
        generateSamacheerBookName({
          standard: tbStandard,
          subject: tbSubject,
          medium: newMedium,
          term: tbTerm,
        })
      )
    }
  }

  const handleTbTermChange = (newTerm: string) => {
    setTbTerm(newTerm)
    if (!tbIsCustomBookName) {
      setTbBookName(
        generateSamacheerBookName({
          standard: tbStandard,
          subject: tbSubject,
          medium: tbMedium,
          term: newTerm,
        })
      )
    }
  }

  const handleTbGroupChange = (newGroup: TnpscGroupId) => {
    setTbGroup(newGroup)
  }

  const handleResetToAutoBookName = () => {
    const auto = generateSamacheerBookName({
      standard: tbStandard,
      subject: tbSubject,
      medium: tbMedium,
      term: tbTerm,
    })
    setTbBookName(auto)
    setTbIsCustomBookName(false)
  }

  // Upload or Replace Textbook
  const handleUploadTextbook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setTbUploadError('Unauthorized (401): Admin authentication token is missing. Please sign in again.')
      return
    }
    if (!tbFile) {
      setTbUploadError('Please select a valid PDF textbook file.')
      return
    }
    if (!tbBookName.trim()) {
      setTbUploadError('Please enter the Textbook Name.')
      return
    }
    if (!tbSubject.trim()) {
      setTbUploadError('Please select a Subject.')
      return
    }
    if (!tbFile.name.toLowerCase().endsWith('.pdf') && tbFile.type !== 'application/pdf') {
      setTbUploadError('Bad Request (400): Only PDF files (.pdf) are supported.')
      return
    }
    if (tbFile.size > 100 * 1024 * 1024) {
      setTbUploadError('Payload Too Large (413): File size exceeds the 100 MB application upload limit.')
      return
    }

    setTbUploading(true)
    setTbUploadProgress(15)
    setTbUploadError(null)

    try {
      const formData = new FormData()
      formData.append('group', tbGroup)
      formData.append('standard', tbStandard)
      formData.append('subject', tbSubject.trim())
      formData.append('medium', tbMedium)
      formData.append('term', tbTerm)
      formData.append('bookName', tbBookName.trim())

      const effectiveReplaceId = replacingTextbookId || tbDuplicateInDb?.id || null
      const shouldReplace = !!effectiveReplaceId
      formData.append('replace', shouldReplace ? 'true' : 'false')
      if (effectiveReplaceId) {
        formData.append('replaceId', String(effectiveReplaceId))
      }
      formData.append('pdf', tbFile)

      setTbUploadProgress(45)

      const res = await apiFetch('/api/textbooks/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        body: formData,
        cache: 'no-store',
        timeoutMs: 180000,
      })

      const { data, rawText } = await parseApiResponse(res)
      setTbUploadProgress(100)

      if (res.status === 409) {
        if (data?.existingId) {
          setReplacingTextbookId(Number(data.existingId))
        }
        setTbUploadError(
          data?.message ||
            'Conflict (409): A textbook with this specification already exists. Click "Replace & Reprocess" below to confirm overwriting it.'
        )
        return
      }

      if (res.status === 304 || !res.ok || !data?.data?.id || data?.data?.status === 'failed') {
        const errMsg = classifyApiError(res, data, rawText, 'POST /api/textbooks/upload')
        setTbUploadError(errMsg)
        showToast('error', errMsg)
        return
      }

      const isAlreadyCompleted = data?.data?.status === 'completed'
      const successMsg = effectiveReplaceId
        ? isAlreadyCompleted
          ? `Textbook replaced and indexed (${data.data.pageCount || 0} pages).`
          : 'Textbook replaced successfully. Background indexing started.'
        : isAlreadyCompleted
          ? `Textbook uploaded and indexed (${data.data.pageCount || 0} pages).`
          : 'Textbook uploaded successfully. Background indexing started.'

      showToast('success', successMsg)
      setIsUploadTextbookModalOpen(false)
      setReplacingTextbookId(null)
      setTbFile(null)
      setTbUploadProgress(0)
      setTbIsCustomBookName(false)
      fetchTextbooks()
    } catch (err: any) {
      console.error('Textbook upload error:', err)
      const friendlyError = await classifyFetchFailure(err, {
        endpointLabel: 'POST /api/textbooks/upload',
        uploadFileSizeBytes: tbFile.size,
      })
      setTbUploadError(friendlyError)
      showToast('error', friendlyError)
    } finally {
      setTbUploading(false)
    }
  }

  // Delete Textbook
  const handleDeleteTextbook = async () => {
    if (!token || !deletingTextbook) return
    setIsDeletingTextbook(true)
    try {
      const res = await apiFetch(`/api/textbooks/${deletingTextbook.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const { data, rawText } = await parseApiResponse(res)
      if (res.ok) {
        showToast('success', data?.message || `Textbook "${deletingTextbook.bookName}" deleted successfully`)
        setDeletingTextbook(null)
        fetchTextbooks()
      } else {
        showToast('error', classifyApiError(res, data, rawText, `DELETE /api/textbooks/${deletingTextbook.id}`))
      }
    } catch (err: any) {
      const friendlyError = await classifyFetchFailure(err, {
        endpointLabel: `DELETE /api/textbooks/${deletingTextbook.id}`,
      })
      showToast('error', friendlyError)
    } finally {
      setIsDeletingTextbook(false)
    }
  }

  // Reprocess Textbook
  const handleReprocessTextbook = async (tb: TextbookItem) => {
    if (!token) return
    try {
      const res = await apiFetch(`/api/textbooks/${tb.id}/reprocess`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        timeoutMs: 120000,
      })
      const { data, rawText } = await parseApiResponse(res)
      if (res.ok) {
        showToast('success', data?.message || `Reprocessing queued for "${tb.bookName}"`)
        fetchTextbooks()
      } else {
        showToast('error', classifyApiError(res, data, rawText, `POST /api/textbooks/${tb.id}/reprocess`))
      }
    } catch (err: any) {
      const friendlyError = await classifyFetchFailure(err, {
        endpointLabel: `POST /api/textbooks/${tb.id}/reprocess`,
      })
      showToast('error', friendlyError)
    }
  }

  // View Textbook Details & Sample Excerpts
  const handleViewTextbookDetails = async (tb: TextbookItem) => {
    setSelectedTextbookDetail(tb)
    setIsLoadingExcerpts(true)
    setTextbookExcerpts([])
    try {
      const res = await apiFetch(`/api/textbooks/search-content?textbookId=${tb.id}&standard=${encodeURIComponent(String(tb.standard))}&subject=${encodeURIComponent(tb.subject)}&medium=${encodeURIComponent(tb.medium)}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const { data } = await parseApiResponse(res)
      const excerpts = Array.isArray(data?.data) ? data.data : data?.data?.chunks
      if (res.ok && data?.status === 'success' && Array.isArray(excerpts)) {
        setTextbookExcerpts(excerpts)
      }
    } catch (e) {
      console.warn('Failed to load excerpts:', e)
    } finally {
      setIsLoadingExcerpts(false)
    }
  }

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  useEffect(() => {
    setSelectedQuestionIds(new Set())
  }, [
    searchQuery,
    groupFilter,
    subjectFilter,
    standardFilter,
    unitFilter,
    lessonFilter,
    qbSelectedLessonObj,
    statusFilter,
    difficultyFilter,
    targetSystemFilter,
    page,
  ])

  useEffect(() => {
    setSelectedNoteIds(new Set())
  }, [notesGroupFilter, notesStatusFilter, notesLanguageFilter])

  const showToast = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text })
    setTimeout(() => setActionMessage(null), 5000)
  }

  const toggleSelectQuestion = (id: number) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllVisible = () => {
    if (selectedQuestionIds.size === questions.length && questions.length > 0) {
      setSelectedQuestionIds(new Set())
    } else {
      setSelectedQuestionIds(new Set(questions.map((q) => q.id)))
    }
  }



  const handleDeleteSelected = async () => {
    if (!token || selectedQuestionIds.size === 0) return
    if (!window.confirm(`Delete ${selectedQuestionIds.size} selected question(s)? This action cannot be undone.`)) return
    setIsBulkDeleting(true)
    try {
      const endpoint = targetSystemFilter === 'study_materials'
        ? '/api/study-materials/questions'
        : '/api/questions'
      const res = await apiFetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: Array.from(selectedQuestionIds) }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('success', data.message || `Deleted ${selectedQuestionIds.size} question(s)`)
        setSelectedQuestionIds(new Set())
        fetchQuestions()
      } else {
        showToast('error', data.message || 'Failed to delete selected questions')
      }
    } catch {
      showToast('error', 'Network error during deletion')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleDeleteAllFiltered = async () => {
    if (!token) return
    const count = filteredTotal
    if (count === 0) {
      showToast('error', 'No questions match current filters')
      return
    }
    if (!window.confirm(`Delete ALL ${count} question(s) matching current filters (Group/Class/Subject/Unit/Lesson/Status/Difficulty)? This action cannot be undone and will permanently remove them.`)) return
    if (!window.confirm(`Final confirmation: Permanently delete ${count} filtered question(s)?`)) return
    setIsBulkDeleting(true)
    try {
      const endpoint = targetSystemFilter === 'study_materials'
        ? '/api/study-materials/questions'
        : '/api/questions'
      const res = await apiFetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          deleteAll: true,
          category: groupFilter !== 'all' ? groupFilter : undefined,
          subject:
            subjectFilter !== 'all'
              ? qbSelectedSubjectObj?.name || subjectFilter
              : undefined,
          classId: standardFilter !== 'all' ? String(standardFilter) : undefined,
          unitId: unitFilter !== 'all' ? String(unitFilter) : undefined,
          lessonTitle:
            lessonFilter !== 'all' && lessonFilter.trim()
              ? lessonFilter.trim()
              : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          difficulty: difficultyFilter !== 'all' ? difficultyFilter : undefined,
          search: searchQuery.trim() ? searchQuery.trim() : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('success', data.message || `Deleted ${data.deletedCount || count} question(s)`)
        setSelectedQuestionIds(new Set())
        fetchQuestions()
      } else {
        showToast('error', data.message || 'Failed to delete questions')
      }
    } catch {
      showToast('error', 'Network error during deletion')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleBulkPublish = async () => {
    if (!token || selectedStagingIds.length === 0 || isBulkPublishing) return
    const ids = selectedStagingIds
    setIsBulkPublishing(true)
    try {
      const endpoint = targetSystemFilter === 'study_materials'
        ? '/api/study-materials/questions/publish'
        : '/api/questions/publish'
      const res = await apiFetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          handleLogout()
          return
        }
        showToast('error', data.message || 'Failed to publish selected questions')
        return
      }

      const publishedCount = data.publishedCount ?? ids.length
      setQuestions((prev) => prev.map((q) => (ids.includes(q.id) ? { ...q, status: 'published' } : q)))
      if (data.metrics) {
        setMetrics(data.metrics)
      } else {
        setMetrics((prev) => ({
          ...prev,
          stagingCount: Math.max(0, prev.stagingCount - publishedCount),
          publishedCount: prev.publishedCount + publishedCount,
        }))
      }
      setSelectedQuestionIds(new Set())
      setIsBulkPublishModalOpen(false)
      showToast('success', data.message || `Successfully published ${publishedCount} questions.`)
      fetchQuestions()
      fetchAllMetrics()
    } catch {
      showToast('error', 'Network error during bulk publishing')
    } finally {
      setIsBulkPublishing(false)
    }
  }

  // Selection helpers for Study Notes
  const toggleSelectNote = (id: number) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllVisibleNotes = () => {
    if (selectedNoteIds.size === notesList.length && notesList.length > 0) {
      setSelectedNoteIds(new Set())
    } else {
      setSelectedNoteIds(new Set(notesList.map((n) => n.id)))
    }
  }

  const selectedStagingNoteIds = useMemo(() => {
    return notesList.filter((n) => selectedNoteIds.has(n.id) && n.status === 'staging').map((n) => n.id)
  }, [notesList, selectedNoteIds])

  // Explicit Toggle Publish/Stage handler for study notes
  const handleTogglePublishNote = async (n: any) => {
    if (!token) return
    const newStatus = n.status === 'published' ? 'staging' : 'published'
    try {
      const res = await apiFetch(`/api/notes/${n.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        showToast('success', `Study Note #${n.id} status changed to ${newStatus}`)
        fetchNotes()
      } else {
        showToast('error', 'Failed to update study note status')
      }
    } catch {
      showToast('error', 'Network error updating study note status')
    }
  }

  // Bulk Publish selected staging notes
  const handleBulkPublishNotes = async () => {
    if (!token || selectedStagingNoteIds.length === 0 || isNotesBulkPublishing) return
    const ids = selectedStagingNoteIds
    setIsNotesBulkPublishing(true)
    try {
      const res = await apiFetch('/api/notes/bulk-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        showToast('success', data.message || `Successfully published ${ids.length} study note(s) to live website.`)
        setSelectedNoteIds(new Set())
        setIsNotesBulkPublishModalOpen(false)
        fetchNotes()
      } else {
        showToast('error', data.message || 'Failed to bulk publish study notes')
      }
    } catch {
      showToast('error', 'Network error during bulk publishing')
    } finally {
      setIsNotesBulkPublishing(false)
    }
  }

  // Delete selected notes
  const handleDeleteSelectedNotes = async () => {
    if (!token || selectedNoteIds.size === 0) return
    if (!window.confirm(`Delete ${selectedNoteIds.size} selected study note(s)? This action cannot be undone.`)) return
    setNotesBulkDeleting(true)
    try {
      const res = await apiFetch('/api/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: Array.from(selectedNoteIds) }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('success', data.message || `Deleted ${selectedNoteIds.size} study note(s)`)
        setSelectedNoteIds(new Set())
        fetchNotes()
      } else {
        showToast('error', data.message || 'Failed to delete selected study notes')
      }
    } catch {
      showToast('error', 'Network error during deletion')
    } finally {
      setNotesBulkDeleting(false)
    }
  }

  // Delete all filtered notes
  const handleDeleteAllFilteredNotes = async () => {
    if (!token) return
    if (notesFilteredTotal === 0) {
      showToast('error', 'No study notes match current filters')
      return
    }
    if (!window.confirm(`Delete ALL ${notesFilteredTotal} study note(s) matching current filters? This action cannot be undone and will permanently remove them.`)) return
    if (!window.confirm(`Final confirmation: Permanently delete ${notesFilteredTotal} filtered study note(s)?`)) return
    setNotesBulkDeleting(true)
    try {
      const res = await apiFetch('/api/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          deleteAll: true,
          category: notesGroupFilter !== 'all' ? notesGroupFilter : undefined,
          subject: notesSubjectFilter !== 'all' ? notesSubjectFilter : undefined,
          classId: notesStandardFilter !== 'all' ? Number(notesStandardFilter) : undefined,
          unitId: notesUnitFilter !== 'all' ? Number(notesUnitFilter) : undefined,
          lesson: notesLessonFilter !== 'all' ? notesLessonFilter : undefined,
          status: notesStatusFilter !== 'all' ? notesStatusFilter : undefined,
          language: notesLanguageFilter !== 'all' ? notesLanguageFilter : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('success', data.message || `Deleted ${data.deletedCount || notesFilteredTotal} study note(s)`)
        setSelectedNoteIds(new Set())
        fetchNotes()
      } else {
        showToast('error', data.message || 'Failed to delete study notes')
      }
    } catch {
      showToast('error', 'Network error during deletion')
    } finally {
      setNotesBulkDeleting(false)
    }
  }

  // Delete single note
  const handleDeleteSingleNote = async () => {
    if (!token || !isDeletingNote) return
    try {
      const res = await apiFetch(`/api/notes/${isDeletingNote.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        showToast('success', `Study note #${isDeletingNote.id} deleted successfully`)
        setIsDeletingNote(null)
        setSelectedNoteIds((prev) => {
          const next = new Set(prev)
          next.delete(isDeletingNote.id)
          return next
        })
        fetchNotes()
      } else {
        showToast('error', 'Failed to delete study note')
      }
    } catch {
      showToast('error', 'Server error during study note deletion')
    }
  }

  // Open add note modal
  const handleOpenAddNoteModal = () => {
    const defaultGroup = notesGroupFilter !== 'all' ? notesGroupFilter : 'group2'
    const subjects = getSubjectsForGroup(defaultGroup as any)
    const defaultSubject = subjects.find(s => s.id === notesSubjectFilter || s.name === notesSubjectFilter) || subjects[0]
    const defaultClassId = notesStandardFilter !== 'all' ? Number(notesStandardFilter) : 6
    const units = getUnitsForSubjectStandard(defaultGroup as any, defaultSubject?.id || 'general-studies', defaultClassId)
    const defaultUnit = units.find(u => u.id === notesUnitFilter) || units[0]
    const defaultUnitId = defaultUnit?.id || 1
    const lessons = getLessonsForSelection(defaultGroup as any, defaultSubject?.id || 'general-studies', defaultClassId, defaultUnitId)
    const defaultLesson = lessons.find(l => l.id === notesSelectedLessonObj?.id) || lessons[0]

    setEditingNote({
      title: '',
      content: '',
      category: defaultGroup,
      subject: defaultSubject?.name || 'General Studies',
      classId: defaultClassId,
      unitId: defaultUnitId,
      lessonId: defaultLesson?.id || '',
      lessonNumber: defaultLesson?.lessonNumber || '',
      lessonTitle: defaultLesson?.title || (notesLessonFilter !== 'all' ? notesLessonFilter : ''),
      topic: '',
      language: notesLanguageFilter !== 'all' ? notesLanguageFilter : 'tamil',
      status: 'staging',
      sourceReference: '',
    })
    setNotesPreviewTab('edit')
    setIsNotesEditModalOpen(true)
  }

  // Save add/edit note
  const handleSaveNote = async () => {
    if (!token || !editingNote) return
    if (!editingNote.content || editingNote.content.trim().length < 5) {
      showToast('error', 'Content is required (minimum 5 characters)')
      return
    }
    if (!editingNote.lessonTitle || !editingNote.lessonTitle.trim()) {
      showToast('error', 'Lesson title is required')
      return
    }

    try {
      const isExisting = Boolean(editingNote.id)
      const url = isExisting ? `/api/notes/${editingNote.id}` : '/api/notes'
      const method = isExisting ? 'PATCH' : 'POST'

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...editingNote,
          lessonId: editingNote.lessonId || undefined,
          lessonNumber: editingNote.lessonNumber || undefined,
          status: editingNote.status || 'staging',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('success', isExisting ? 'Study note updated successfully' : 'Study note created in Staging successfully')
        setIsNotesEditModalOpen(false)
        setEditingNote(null)
        fetchNotes()
      } else {
        showToast('error', data.message || 'Failed to save study note')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Network error saving study note')
    }
  }

  // Bulk Upload Study Notes Parser
  const parseBulkNotesContent = (text: string) => {
    setNotesBulkParseError(null)
    const trimmed = text.trim()
    if (!trimmed) {
      setNotesBulkParsedCount(null)
      return []
    }
    try {
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          setNotesBulkParsedCount(parsed.length)
          return parsed
        }
      }
      // If structured markdown with chapters
      const chapters = trimmed.split(/(?=^#+s+(?:Chapter|இயல்|அலகு|Unit))/im).filter(c => c.trim().length > 10)
      if (chapters.length > 0) {
        setNotesBulkParsedCount(chapters.length)
        return chapters.map((ch, idx) => ({
          title: ch.split('\n')[0].replace(/^#+\s*/, '').trim() || `Chapter ${idx + 1}`,
          content: ch.trim(),
          lessonTitle: notesLessonFilter !== 'all' ? notesLessonFilter : `Chapter ${idx + 1}`,
          lessonId: notesSelectedLessonObj?.id || undefined,
          lessonNumber: notesSelectedLessonObj?.lessonNumber || undefined,
          unitId: notesUnitFilter !== 'all' ? Number(notesUnitFilter) : idx + 1,
          classId: notesStandardFilter !== 'all' ? Number(notesStandardFilter) : 6,
          subject: notesSubjectFilter !== 'all' ? notesSubjectFilter : 'General Studies',
          category: notesGroupFilter !== 'all' ? notesGroupFilter : 'group1',
          language: notesLanguageFilter !== 'all' ? notesLanguageFilter : 'tamil',
          status: 'staging',
        }))
      }
      setNotesBulkParseError('Could not auto-detect notes structure. Please provide a JSON array of note objects.')
      setNotesBulkParsedCount(null)
      return []
    } catch (e: any) {
      setNotesBulkParseError(`JSON Parse error: ${e.message}`)
      setNotesBulkParsedCount(null)
      return []
    }
  }

  const handleBulkUploadNotes = async () => {
    if (!token || !notesBulkRawText.trim() || isNotesBulkUploading) return
    const parsedNotes = parseBulkNotesContent(notesBulkRawText)
    if (!parsedNotes || parsedNotes.length === 0) {
      showToast('error', 'No valid notes to upload')
      return
    }

    setIsNotesBulkUploading(true)
    try {
      const res = await apiFetch('/api/notes/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: parsedNotes }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('success', data.message || `Uploaded ${parsedNotes.length} notes to Staging`)
        setIsNotesBulkUploadModalOpen(false)
        setNotesBulkRawText('')
        setNotesBulkParsedCount(null)
        fetchNotes()
      } else {
        showToast('error', data.message || 'Failed to bulk upload notes')
      }
    } catch (err: any) {
      showToast('error', err.message || 'Network error during bulk upload')
    } finally {
      setIsNotesBulkUploading(false)
    }
  }

  // Add / Edit Modal handlers
  const handleOpenAddModal = () => {
    const defaultGroup = 'group1'
    const defaultClassId = 6
    const subjects = getSubjectsForGroup(defaultGroup)
    const defaultSubjectId = subjects[0]?.id || 'general_science'
    const units = getUnitsForSubjectStandard(defaultGroup, defaultSubjectId, defaultClassId)
    const defaultUnitId = units[0]?.id || 1
    const lessons = getLessonsForSelection(defaultGroup, defaultSubjectId, defaultClassId, defaultUnitId)
    const topics = lessons[0] ? getTopicsForSelection(defaultGroup, defaultSubjectId, defaultClassId, defaultUnitId, lessons[0].title) : []
    setEditingQuestion({
      category: defaultGroup,
      classId: defaultClassId,
      unitId: defaultUnitId,
      subject: subjects[0]?.name || units[0]?.subjectName || 'General Science',
      lessonTitle: lessons[0]?.title || '',
      lessonId: lessons[0]?.id || null,
      topic: topics[0]?.name || '',
      difficulty: 'Medium',
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      explanation: '',
      sourceReference: `Samacheer Kalvi Class ${defaultClassId}`,
      status: 'staging',
    })
    setIsEditModalOpen(true)
  }

  const handleOpenEditModal = (q: QuestionItem) => {
    setEditingQuestion({
      ...q,
      options: [...q.options],
    })
    setIsEditModalOpen(true)
  }

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingQuestion || !token) return

    // Mandatory Group and Topic Validation
    if (!editingQuestion.category) {
      showToast('error', 'Select TNPSC Group is mandatory')
      return
    }
    if (!editingQuestion.topic || !editingQuestion.topic.trim()) {
      showToast('error', 'Topic is required before saving')
      return
    }
    if (!editingQuestion.question || editingQuestion.question.trim().length < 5) {
      showToast('error', 'Question text must be at least 5 characters')
      return
    }
    if (!editingQuestion.lessonTitle || !editingQuestion.lessonTitle.trim()) {
      showToast('error', 'Lesson title is required')
      return
    }
    if (!editingQuestion.options || editingQuestion.options.length !== 4 || editingQuestion.options.some((opt) => !opt.trim())) {
      showToast('error', 'All 4 options must be filled out')
      return
    }

    try {
      const isUpdating = Boolean(editingQuestion.id)
      const url = isUpdating ? `/api/questions/${editingQuestion.id}` : '/api/questions'
      const method = isUpdating ? 'PATCH' : 'POST'

      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingQuestion),
      })

      const data = await res.json()
      if (res.ok) {
        showToast('success', isUpdating ? `Question #${editingQuestion.id} updated successfully` : 'New question created')
        setIsEditModalOpen(false)
        setEditingQuestion(null)
        fetchQuestions()
      } else {
        showToast('error', data.message || 'Operation failed')
      }
    } catch {
      showToast('error', 'Failed to connect to server')
    }
  }

  // Delete handler with explicit confirmation
  const handleConfirmDelete = async () => {
    if (!isDeleting || !token) return
    try {
      const res = await apiFetch(`/api/questions/${isDeleting.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        showToast('success', `Question #${isDeleting.id} deleted successfully`)
        setIsDeleting(null)
        fetchQuestions()
      } else {
        showToast('error', data.message || 'Failed to delete question')
      }
    } catch {
      showToast('error', 'Server error during deletion')
    }
  }

  // Explicit Toggle Publish/Stage handler
  const handleTogglePublish = async (q: QuestionItem) => {
    if (!token) return
    const newStatus = q.status === 'published' ? 'staging' : 'published'
    try {
      const res = await apiFetch(`/api/questions/${q.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        showToast('success', `Question #${q.id} status changed to ${newStatus}`)
        fetchQuestions()
        fetchAllMetrics()
      } else {
        showToast('error', 'Failed to update publication status')
      }
    } catch {
      showToast('error', 'Network error updating question status')
    }
  }

  // Bulk Upload File Reader & Parser
  const parseBulkContent = (text: string) => {
    setBulkParseError(null)
    const trimmed = text.trim()
    if (!trimmed) {
      setBulkParsedCount(null)
      return []
    }

    // Try parsing as JSON first
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          setBulkParsedCount(parsed.length)
          return parsed
        }
      } catch (err: any) {
        setBulkParseError(`JSON Syntax Error: ${err.message}`)
        return []
      }
    }

    // Otherwise, try basic CSV parsing
    try {
      const lines = trimmed.split('\n').filter((l) => l.trim().length > 0)
      if (lines.length <= 1) {
        setBulkParseError('CSV must have a header row and at least 1 data row')
        return []
      }
      const questionsList = []
      // Skip header, parse line
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim().replace(/^"|"$/g, ''))
        if (parts.length >= 8) {
          questionsList.push({
            question: parts[0],
            options: [parts[1], parts[2], parts[3], parts[4]],
            correctAnswer: parseInt(parts[5], 10) || 0,
            lessonTitle: parts[6],
            unitId: parseInt(parts[7], 10) || 1,
            explanation: parts[8] || '',
            sourceReference: parts[9] || null,
          })
        }
      }
      setBulkParsedCount(questionsList.length)
      return questionsList
    } catch (err: any) {
      setBulkParseError(`CSV Parse Error: ${err.message}`)
      return []
    }
  }

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = (event.target?.result as string) || ''
      setBulkRawText(content)
      parseBulkContent(content)
    }
    reader.readAsText(file)
  }

  const handleExecuteBulkUpload = async () => {
    const parsed = parseBulkContent(bulkRawText)
    if (!parsed || parsed.length === 0 || !token) {
      showToast('error', 'No valid questions to upload')
      return
    }

    // Ensure every question has mandatory TNPSC Group, target system, and Topic
    const mappedQuestions = parsed.map((item: any) => ({
      ...item,
      category: item.category || bulkGroupId,
      targetSystem: item.targetSystem || targetSystemFilter,
      lessonId: item.lessonId || (qbSelectedLessonObj && qbSelectedLessonObj.title === item.lessonTitle ? qbSelectedLessonObj.id : null),
      topic: item.topic || (item.lessonTitle ? `${item.lessonTitle}: General Practice` : 'General Practice'),
      status: 'staging',
    }))

    setIsUploading(true)
    try {
      const res = await apiFetch('/api/questions/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questions: mappedQuestions }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('success', data.message || `Uploaded ${data.inserted} questions to Staging for ${bulkGroupId.toUpperCase()}`)
        setIsBulkModalOpen(false)
        setBulkRawText('')
        setBulkParsedCount(null)
        fetchQuestions()
        fetchAllMetrics()
      } else {
        showToast('error', data.message || 'Upload failed')
      }
    } catch {
      showToast('error', 'Network error during upload')
    } finally {
      setIsUploading(false)
    }
  }

  // If not authenticated, render Login Card
  if (!token) {
    return (
      <div className="admin-page">
        <div className="admin-auth-wrapper">
          <motion.div className="admin-auth-card glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="admin-auth-header">
              <div className="admin-auth-icon">
                <Shield size={32} />
              </div>
              <h1 className="admin-auth-title">Admin Access</h1>
              <p className="admin-auth-subtitle">Sign in to manage TNPSC questions & database</p>
            </div>

            {loginError && (
              <div style={{ padding: '0.75rem', marginBottom: '1.25rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.85rem' }}>
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="admin-auth-form">
              <div className="admin-auth-input-group">
                <label className="admin-auth-label">Admin Username</label>
                <input
                  type="text"
                  className="admin-auth-input"
                  placeholder="admin"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  required
                />
              </div>

              <div className="admin-auth-input-group">
                <label className="admin-auth-label">Admin Password</label>
                <input
                  type="password"
                  className="admin-auth-input"
                  placeholder="••••••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="admin-auth-submit" disabled={isLoggingIn}>
                <Shield size={18} />
                <span>{isLoggingIn ? 'Authenticating...' : 'Sign In to Admin Panel'}</span>
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    )
  }

  // Total pages
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize))

  return (
    <div className="admin-page">
      <div className="admin-container">
        {/* Toast Notification */}
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`admin-toast ${actionMessage.type === 'success' ? 'admin-toast-success' : 'admin-toast-error'}`}
          >
            <div className="admin-toast-content">
              {actionMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
              <span>{actionMessage.text}</span>
            </div>
            <button
              className="admin-toast-close"
              onClick={() => setActionMessage(null)}
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}

        {/* Top Header */}
        <div className="admin-header">
          <div className="admin-header-main">
            <div className="admin-badge-row">
              <span className="admin-badge">
                <Sparkles size={13} />
                TNPSC Control Center
              </span>
              <span className="admin-user-pill admin-db-pill">
                <Database size={13} />
                PostgreSQL Connected
              </span>
              <button
                type="button"
                className={`admin-user-pill ${driveStatus.connected ? 'admin-gdrive-connected-pill' : 'admin-gdrive-disconnected-pill'}`}
                onClick={() => {
                  setAdminSection('gdrive')
                  fetchDriveMaterials()
                  checkDriveStatus()
                }}
                title="Google Drive Integration Status (click to manage)"
                style={{
                  cursor: 'pointer',
                  border: driveStatus.connected
                    ? '1px solid rgba(16, 185, 129, 0.4)'
                    : isConnectingDrive
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : driveConnectionError
                    ? '1px solid rgba(239, 68, 68, 0.4)'
                    : '1px solid rgba(255, 215, 0, 0.35)',
                  background: driveStatus.connected
                    ? 'rgba(16, 185, 129, 0.12)'
                    : isConnectingDrive
                    ? 'rgba(245, 158, 11, 0.12)'
                    : driveConnectionError
                    ? 'rgba(239, 68, 68, 0.12)'
                    : 'rgba(255, 215, 0, 0.08)',
                  color: driveStatus.connected
                    ? '#34d399'
                    : isConnectingDrive
                    ? '#fbbf24'
                    : driveConnectionError
                    ? '#f87171'
                    : '#ffd700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}
              >
                <Cloud size={13} className={isConnectingDrive ? 'spinning' : ''} />
                {isConnectingDrive ? (
                  <span>Google Drive: Connecting...</span>
                ) : driveStatus.connected ? (
                  <span>Google Drive: Connected ({driveStatus.email || 'Ready'})</span>
                ) : driveConnectionError ? (
                  <span>Google Drive: Error (Click to Retry)</span>
                ) : (
                  <span>Google Drive: Not Connected</span>
                )}
              </button>
            </div>
            <h1 className="admin-title">
              {adminSection === 'questions' && 'Question Bank Management'}
              {adminSection === 'textbooks' && 'Textbook Management'}
              {adminSection === 'notes' && 'Study Notes Management'}
              {adminSection === 'gdrive' && 'Google Drive PDF Materials'}
            </h1>
            <p className="admin-subtitle">
              {adminSection === 'questions' && 'Review, edit, stage, and publish verified Samacheer Kalvi topic-wise MCQs directly into the database.'}
              {adminSection === 'textbooks' && 'Upload, index, and organize Samacheer Kalvi PDF textbooks for AI study notes and MCQ generation.'}
              {adminSection === 'notes' && 'Review, edit, stage, and publish comprehensive TNPSC Complete Study Notes directly into the database.'}
              {adminSection === 'gdrive' && 'Connect your personal Google Drive account to store and stream official PDF textbooks and study materials with zero serverless size limits.'}
            </p>
          </div>

          <div className="admin-profile-group">
            <span className="admin-user-pill">
              <Shield size={14} style={{ color: 'var(--gold-primary)' }} />
              <span>{adminUser?.name || adminUser?.username || 'Admin'}</span>
              {adminUser?.role && (
                <span className="admin-pill-role-tag">{adminUser.role.replace('_', ' ')}</span>
              )}
            </span>
            <button
              className="admin-users-mgmt-btn"
              onClick={() => {
                setIsUsersModalOpen(true)
                fetchAdminUsers()
              }}
              title="Manage Multiple Admin Accounts"
            >
              <Users size={14} />
              <span>Admin Accounts</span>
            </button>
            <button className="admin-logout-btn" onClick={handleLogout} title="Log out of Admin Portal">
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Navigation Section Tabs */}
        <div className="admin-section-nav">
          <button
            className={`admin-section-tab ${adminSection === 'questions' ? 'active' : ''}`}
            onClick={() => setAdminSection('questions')}
          >
            <Database size={16} />
            <span>Question Bank</span>
            <span className="admin-section-tab-count">{metrics.totalQuestions}</span>
          </button>
          <button
            className={`admin-section-tab ${adminSection === 'textbooks' ? 'active' : ''}`}
            onClick={() => {
              setAdminSection('textbooks')
              fetchTextbooks()
            }}
          >
            <BookOpen size={16} />
            <span>Textbook Management</span>
            <span className="admin-section-tab-count">{textbookMetrics.totalTextbooks}</span>
          </button>
          <button
            className={`admin-section-tab ${adminSection === 'notes' ? 'active' : ''}`}
            onClick={() => {
              setAdminSection('notes')
              fetchNotes()
            }}
          >
            <FileText size={16} />
            <span>Study Notes</span>
            <span className="admin-section-tab-count">{notesMetrics.totalNotes}</span>
          </button>
          <button
            className={`admin-section-tab ${adminSection === 'gdrive' ? 'active' : ''}`}
            onClick={() => {
              setAdminSection('gdrive')
              fetchDriveMaterials()
              checkDriveStatus()
            }}
          >
            <Cloud size={16} />
            <span>Google Drive</span>
            <span className="admin-section-tab-count">{driveMaterials.length}</span>
          </button>
        </div>

        {/* Dynamic 4 Dashboard Statistics Cards HUD for Active Management Tab */}
        {adminSection === 'questions' && (
          <div className="admin-metrics-grid" style={{ marginBottom: '1.75rem' }}>
            <div className="admin-metric-card glass">
              <div className="metric-icon-box metric-icon-gold">
                <Database size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value">{metrics.totalQuestions}</span>
                <span className="metric-label">Total in Database</span>
              </div>
            </div>

            <div className="admin-metric-card glass">
              <div className="metric-icon-box metric-icon-amber">
                <Clock size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value">{metrics.stagingCount}</span>
                <span className="metric-label">In Review (Staging)</span>
              </div>
            </div>

            <div className="admin-metric-card glass">
              <div className="metric-icon-box metric-icon-emerald">
                <CheckCircle size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value">{metrics.publishedCount}</span>
                <span className="metric-label">Live on Website</span>
              </div>
            </div>

            <div className="admin-metric-card glass">
              <div className="metric-icon-box metric-icon-cyan">
                <AlertCircle size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value">{metrics.pendingReviewCount ?? 0}</span>
                <span className="metric-label">Pending Review</span>
              </div>
            </div>
          </div>
        )}

        {adminSection === 'textbooks' && (
          <div className="admin-metrics-grid" style={{ marginBottom: '1.75rem' }}>
            <div className="admin-metric-card glass">
              <div className="metric-icon-box metric-icon-gold">
                <BookOpen size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value">{textbookMetrics.totalTextbooks}</span>
                <span className="metric-label">Total Textbooks in Database</span>
              </div>
            </div>

            <div className="admin-metric-card glass">
              <div className="metric-icon-box metric-icon-amber">
                <Clock size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value">{textbookMetrics.stagingCount}</span>
                <span className="metric-label">In Review (Staging)</span>
              </div>
            </div>

            <div className="admin-metric-card glass">
              <div className="metric-icon-box metric-icon-emerald">
                <CheckCircle size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value">{textbookMetrics.publishedCount}</span>
                <span className="metric-label">Published Textbooks</span>
              </div>
            </div>

            <div className="admin-metric-card glass">
              <div className="metric-icon-box metric-icon-cyan">
                <Layers size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value">
                  {textbookMetrics.classesCovered ? `${textbookMetrics.classesCovered} Standards` : 'Classes 6–12'}
                </span>
                <span className="metric-label">Total Standards / Classes Covered</span>
              </div>
            </div>
          </div>
        )}

        {adminSection === 'notes' && (
          <div className="admin-metrics-grid" style={{ marginBottom: '1.75rem' }}>
            <div className="admin-metric-card glass">
              <div className="metric-icon-box metric-icon-gold">
                <FileText size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value">{notesMetrics.totalNotes}</span>
                <span className="metric-label">Total Study Notes in Database</span>
              </div>
            </div>

            <div className="admin-metric-card glass">
              <div className="metric-icon-box metric-icon-amber">
                <Clock size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value">{notesMetrics.stagingCount}</span>
                <span className="metric-label">In Review (Staging)</span>
              </div>
            </div>

            <div className="admin-metric-card glass">
              <div className="metric-icon-box metric-icon-emerald">
                <CheckCircle size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value">{notesMetrics.publishedCount}</span>
                <span className="metric-label">Published Notes (Live on Website)</span>
              </div>
            </div>

            <div className="admin-metric-card glass">
              <div className="metric-icon-box metric-icon-cyan">
                <Layers size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value">
                  {notesMetrics.classesCovered ? `${notesMetrics.classesCovered} Standards` : 'Classes 6–12'}
                </span>
                <span className="metric-label">Total Standards / Classes Covered</span>
              </div>
            </div>
          </div>
        )}

        {adminSection === 'gdrive' && (
          <div className="admin-metrics-grid" style={{ marginBottom: '1.75rem' }}>
            <div className="admin-metric-card glass">
              <div className="metric-icon-box metric-icon-gold">
                <Cloud size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value">{driveMaterials.length}</span>
                <span className="metric-label">Google Drive Materials</span>
              </div>
            </div>

            <div className="admin-metric-card glass">
              <div
                className="metric-icon-box"
                style={{
                  background: driveStatus.connected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: driveStatus.connected ? '#10b981' : '#ef4444',
                }}
              >
                {driveStatus.connected ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
              </div>
              <div className="metric-info">
                <span className="metric-value" style={{ fontSize: '1.1rem' }}>
                  {driveStatus.connected ? 'Connected' : 'Not Connected'}
                </span>
                <span className="metric-label" style={{ wordBreak: 'break-all' }}>
                  {driveStatus.email || 'OAuth Disconnected'}
                </span>
              </div>
            </div>

            <div className="admin-metric-card glass">
              <div className="metric-icon-box metric-icon-cyan">
                <Folder size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value" style={{ fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {driveStatus.folderName || 'TNPSC Study Hub Materials'}
                </span>
                <span className="metric-label">Target Drive Folder</span>
              </div>
            </div>

            <div className="admin-metric-card glass">
              <div className="metric-icon-box metric-icon-amber">
                <HardDrive size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value">
                  {(driveMaterials.reduce((acc, m) => acc + (m.fileSize || 0), 0) / (1024 * 1024)).toFixed(1)} MB
                </span>
                <span className="metric-label">Total Cloud Materials Size</span>
              </div>
            </div>
          </div>
        )}

        {/* Section 1: Question Bank Management */}
        {adminSection === 'questions' && (
          <>
            {/* Toolbar & Filters */}
        <div className="admin-toolbar glass">
          {/* Target System Toggle: Study Materials (Lesson-wise) vs Main Practice */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Target Question System:</span>
            <div style={{ display: 'inline-flex', padding: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                type="button"
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  background: targetSystemFilter === 'study_materials' ? 'linear-gradient(135deg, rgba(255,215,0,0.3), rgba(245,158,11,0.4))' : 'transparent',
                  color: targetSystemFilter === 'study_materials' ? '#ffd700' : 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => {
                  setTargetSystemFilter('study_materials')
                  setSelectedQuestionIds(new Set())
                  setPage(1)
                }}
              >
                <BookOpen size={14} />
                <span>📚 Study Materials (Lesson-wise Practice)</span>
              </button>
              <button
                type="button"
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  background: targetSystemFilter === 'main_practice' ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.4))' : 'transparent',
                  color: targetSystemFilter === 'main_practice' ? '#a5b4fc' : 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => {
                  setTargetSystemFilter('main_practice')
                  setSelectedQuestionIds(new Set())
                  setPage(1)
                }}
              >
                <Target size={14} />
                <span>🎯 Main Practice Question Bank</span>
              </button>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {targetSystemFilter === 'study_materials'
                ? 'Managing questions linked strictly to syllabus lessons in Study Materials.'
                : 'Managing general question bank questions for the /practice page.'}
            </span>
          </div>

          <div className="admin-toolbar-row">
            <div className="admin-search-wrapper">
              <Search size={16} className="admin-search-icon" />
              <input
                type="text"
                className="admin-search-input"
                placeholder="Search by ID, question snippet, lesson, or subject..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
              />
            </div>

            <div className="admin-action-buttons">
              <button
                className="admin-btn admin-btn-cloud-ai"
                onClick={() => handleOpenCloudAiGenerator('mcq')}
                title="Generate syllabus-based questions from Samacheer Kalvi textbooks"
              >
                <Sparkles size={16} />
                <span>Cloud AI Generator</span>
              </button>
              <button className="admin-btn admin-btn-primary" onClick={handleOpenAddModal}>
                <Plus size={16} />
                <span>Add Question</span>
              </button>
              <button className="admin-btn admin-btn-secondary" onClick={() => setIsBulkModalOpen(true)}>
                <Upload size={16} />
                <span>Bulk Upload</span>
              </button>
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => {
                  setIsUsersModalOpen(true)
                  fetchAdminUsers()
                }}
                title="Manage Admin Logins"
              >
                <Users size={16} />
                <span>Admin Users</span>
              </button>
              <button className="admin-btn admin-btn-secondary" onClick={fetchQuestions} title="Refresh table data">
                <RefreshCw size={15} className={isLoading ? 'spin-icon' : ''} />
              </button>
            </div>
          </div>

          <div className="admin-filter-pills">
            <SyllabusCascadeSelector
              cascade={qbSyllabusCascade}
              allowAll={true}
              variant="filter"
              extraFilters={
                <>
                  <div className="ai-field">
                    <label>Status</label>
                    <select
                      className="ai-select qb-syllabus-select"
                      aria-label="Status"
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value)
                        setPage(1)
                      }}
                    >
                      <option value="all">All Statuses</option>
                      <option value="staging">Staging Only (Under Review)</option>
                      <option value="published">Published Only (Live)</option>
                    </select>
                  </div>

                  <div className="ai-field">
                    <label>Difficulty</label>
                    <select
                      className="ai-select qb-syllabus-select"
                      aria-label="Difficulty"
                      value={difficultyFilter}
                      onChange={(e) => {
                        setDifficultyFilter(e.target.value)
                        setPage(1)
                      }}
                    >
                      <option value="all">All Difficulties</option>
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </>
              }
            />

            <div className="qb-filter-actions-row">
              <div className="admin-filter-count">
                Showing <strong>{questions.length}</strong> of <strong>{filteredTotal}</strong> matching questions | Selected: <strong>{selectedQuestionIds.size}</strong>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {(groupFilter !== 'all' ||
                  subjectFilter !== 'all' ||
                  standardFilter !== 'all' ||
                  unitFilter !== 'all' ||
                  lessonFilter !== 'all' ||
                  statusFilter !== 'all' ||
                  difficultyFilter !== 'all' ||
                  searchQuery.trim() !== '') && (
                  <button
                    className="admin-btn admin-btn-secondary"
                    onClick={() => {
                      qbSyllabusCascade.resetFilters()
                      setStatusFilter('all')
                      setDifficultyFilter('all')
                      setSearchQuery('')
                      setPage(1)
                    }}
                    title="Reset all syllabus and status filters"
                  >
                    <RefreshCcw size={14} />
                    <span>Reset Filters</span>
                  </button>
                )}
                <button className="admin-btn admin-btn-secondary" onClick={toggleSelectAllVisible} disabled={questions.length === 0}>
                  {selectedQuestionIds.size === questions.length && questions.length > 0 ? 'Deselect All Visible' : 'Select All Visible'}
                </button>
                <button
                  className="admin-btn admin-bulk-publish-btn"
                  onClick={() => setIsBulkPublishModalOpen(true)}
                  disabled={selectedStagingIds.length === 0 || isBulkPublishing || isBulkDeleting}
                >
                  <span>🚀 Bulk Publish Selected ({selectedStagingIds.length})</span>
                </button>
                <button className="admin-btn admin-btn-secondary" onClick={handleDeleteSelected} disabled={selectedQuestionIds.size === 0 || isBulkDeleting}>
                  <Trash2 size={14} />
                  <span>Delete Selected ({selectedQuestionIds.size})</span>
                </button>
                <button className="admin-btn" style={{ background: '#ef4444', color: '#fff' }} onClick={handleDeleteAllFiltered} disabled={filteredTotal === 0 || isBulkDeleting}>
                  <Trash2 size={14} />
                  <span>{isBulkDeleting ? 'Deleting...' : `Delete All Filtered (${filteredTotal})`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Questions Table */}
        <div className="admin-table-scroll-hint">
          <span>← Swipe horizontally to view all columns & action buttons →</span>
        </div>
        <div className="admin-table-wrapper glass">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>Sel</th>
                <th style={{ width: '70px' }}>ID</th>
                <th style={{ width: '120px' }}>Status</th>
                <th style={{ width: '140px' }}>Group & Unit</th>
                <th style={{ width: '230px' }}>Lesson & Topic</th>
                <th>Question & Options</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    Loading questions from PostgreSQL...
                  </td>
                </tr>
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    No questions found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                questions.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <input type="checkbox" checked={selectedQuestionIds.has(q.id)} onChange={() => toggleSelectQuestion(q.id)} />
                    </td>
                    <td>
                      <span className="qid-badge">#{q.id}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span className={`status-badge ${q.status === 'published' ? 'status-published' : 'status-staging'}`}>
                          {q.status === 'published' ? <CheckCircle size={12} /> : <Clock size={12} />}
                          {q.status}
                        </span>
                        {q.verificationStatus && (
                          <span className={`verif-badge-${q.verificationStatus}`}>
                            {q.verificationStatus === 'verified' && <CheckCircle2 size={11} />}
                            {q.verificationStatus === 'needs_review' && <AlertCircle size={11} />}
                            {q.verificationStatus === 'rejected' && <X size={11} />}
                            {q.verificationStatus === 'verified' ? 'Verified' : q.verificationStatus === 'needs_review' ? 'Needs Review' : 'Rejected'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span className="ai-tag-pill ai-tag-group" style={{ alignSelf: 'flex-start', fontSize: '0.7rem' }}>
                          {q.category ? q.category.toUpperCase() : 'GROUP1'}
                        </span>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Unit {q.unitId}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Class {q.classId || 'N/A'}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                        {q.lessonTitle}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{q.subject}</div>
                      {q.topic && (
                        <div style={{ fontSize: '0.72rem', color: '#c084fc', marginTop: '0.25rem', fontWeight: 500 }}>
                          📌 {q.topic}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="table-question-title">{q.question}</div>
                      <div className="table-options-grid">
                        {q.options.map((opt, i) => (
                          <div
                            key={i}
                            className={`table-option-pill ${i === q.correctAnswer ? 'correct' : 'normal'}`}
                          >
                            <span className="pill-letter">{String.fromCharCode(65 + i)}</span>
                            <span className="pill-text">{opt}</span>
                          </div>
                        ))}
                      </div>
                      {(q.sourcePage || q.sourceReference) && (
                        <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span className="source-page-pill">
                            <BookOpen size={11} />
                            <span>{q.sourceReference ? q.sourceReference : 'Samacheer Kalvi'}</span>
                            {q.sourcePage ? ` (Page ${q.sourcePage})` : ''}
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="table-action-btn"
                          title="Edit Question & Options"
                          onClick={() => handleOpenEditModal(q)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className={`table-action-btn ${q.status === 'published' ? '' : 'table-action-publish'}`}
                          title={q.status === 'published' ? 'Revert to Staging' : 'Publish Question to Quiz'}
                          onClick={() => handleTogglePublish(q)}
                        >
                          {q.status === 'published' ? <Clock size={14} /> : <CheckCircle size={14} />}
                        </button>
                        <button
                          className="table-action-btn table-action-delete"
                          title="Delete Question"
                          onClick={() => setIsDeleting(q)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="admin-pagination">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages} ({filteredTotal} items)
              </span>
              <div className="pagination-controls">
                <button
                  className="table-action-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="table-action-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
        </>
        )}

        {/* Section 2: Textbook Management */}
        {adminSection === 'textbooks' && (
          <div className="admin-textbooks-section">
            <div className="admin-section-header">
              <div>
                <h2 className="admin-section-title">Samacheer Kalvi Textbook Management</h2>
                <p className="admin-section-subtitle">
                  Upload, process, and manage Classes 6–12 Samacheer Kalvi textbooks in Tamil & English. Texts are extracted, OCR-verified, and mapped to syllabus units for AI generation.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setReplacingTextbookId(null)
                    setTbGroup('group1')
                    setTbStandard('6th')
                    setTbSubject('Tamil')
                    setTbMedium('Tamil')
                    setTbTerm('Term 1')
                    setTbBookName(
                      generateSamacheerBookName({
                        standard: '6th',
                        subject: 'Tamil',
                        medium: 'Tamil',
                        term: 'Term 1',
                      })
                    )
                    setTbIsCustomBookName(false)
                    setTbFile(null)
                    setTbUploadError(null)
                    setIsUploadTextbookModalOpen(true)
                  }}
                >
                  <UploadCloud size={16} />
                  <span>Upload Textbook PDF</span>
                </button>
                <button className="admin-btn admin-btn-secondary" onClick={fetchTextbooks} title="Refresh textbooks">
                  <RefreshCw size={15} className={textbooksLoading ? 'spin-icon' : ''} />
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="admin-filter-bar glass">
              <div className="admin-filter-pills">
                <div className="admin-search-wrapper" style={{ minWidth: '220px', flex: '1' }}>
                  <Search size={15} className="admin-search-icon" />
                  <input
                    type="text"
                    className="admin-search-input"
                    placeholder="Search by book name, subject, standard..."
                    value={textbookSearch}
                    onChange={(e) => setTextbookSearch(e.target.value)}
                  />
                </div>
                <div className="admin-filter-group">
                  {/* 2. All Groups */}
                  <select
                    className="filter-select"
                    value={textbookGroupFilter}
                    onChange={(e) => {
                      setTextbookGroupFilter(e.target.value)
                      setTextbookSubjectFilter('all')
                    }}
                  >
                    <option value="all">All Groups</option>
                    <option value="group1">Group 1</option>
                    <option value="group2">Group 2</option>
                    <option value="group4">Group 4</option>
                  </select>

                  {/* 3. All Standards */}
                  <select
                    className="filter-select"
                    value={textbookStandardFilter}
                    onChange={(e) => {
                      setTextbookStandardFilter(e.target.value)
                      setTextbookSubjectFilter('all')
                    }}
                  >
                    <option value="all">All Standards (6th–12th)</option>
                    {STANDARDS_LIST.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shortLabel} Standard
                      </option>
                    ))}
                  </select>

                  {/* 4. All Subjects (NEW) */}
                  <select
                    className="filter-select"
                    value={textbookSubjectFilter}
                    onChange={(e) => setTextbookSubjectFilter(e.target.value)}
                  >
                    <option value="all">All Subjects</option>
                    {textbookFilterSubjects.map((subj) => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>

                  {/* 5. All Mediums */}
                  <select
                    className="filter-select"
                    value={textbookMediumFilter}
                    onChange={(e) => setTextbookMediumFilter(e.target.value)}
                  >
                    <option value="all">All Mediums</option>
                    <option value="English">English</option>
                    <option value="Tamil">Tamil</option>
                  </select>

                  {/* 6. All Statuses */}
                  <select
                    className="filter-select"
                    value={textbookStatusFilter}
                    onChange={(e) => setTextbookStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="completed">Completed</option>
                    <option value="processing">Processing</option>
                    <option value="uploaded">Uploaded</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Textbooks Table */}
            <div className="admin-table-wrapper glass" style={{ marginTop: '1rem' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>ID</th>
                    <th style={{ width: '90px' }}>Group</th>
                    <th style={{ width: '130px' }}>Standard</th>
                    <th style={{ width: '160px' }}>Subject</th>
                    <th style={{ width: '110px' }}>Medium</th>
                    <th>Book Name</th>
                    <th style={{ width: '100px' }}>Pages / Size</th>
                    <th style={{ width: '140px' }}>Status</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {textbooksLoading ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        Loading textbooks...
                      </td>
                    </tr>
                  ) : textbooksList.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                        <BookOpen size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                        <p style={{ fontWeight: 600 }}>No textbooks uploaded yet</p>
                        <p style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                          Upload Classes 6–12 Samacheer Kalvi PDFs to begin AI question generation.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    textbooksList
                      .filter((tb) => {
                        if (
                          textbookSubjectFilter !== 'all' &&
                          tb.subject?.toLowerCase() !== textbookSubjectFilter.toLowerCase()
                        ) {
                          return false
                        }
                        if (!textbookSearch.trim()) return true
                        const q = textbookSearch.toLowerCase()
                        return (
                          tb.bookName.toLowerCase().includes(q) ||
                          tb.subject.toLowerCase().includes(q) ||
                          String(tb.standard).toLowerCase().includes(q)
                        )
                      })
                      .map((tb) => (
                        <tr key={tb.id}>
                          <td>
                            <span className="qid-badge">#{tb.id}</span>
                          </td>
                          <td>
                            <span className="ai-tag-pill ai-tag-group" style={{ fontSize: '0.7rem' }}>
                              {tb.groupId?.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{tb.standard}</td>
                          <td>{tb.subject}</td>
                          <td>
                            <span style={{ fontSize: '0.8rem', color: tb.medium === 'Tamil' ? '#fbbf24' : '#38bdf8' }}>
                              {tb.medium} {tb.term && tb.term !== 'Full Year' ? `(${tb.term})` : ''}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{tb.bookName}</td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {tb.pageCount > 0 ? `${tb.pageCount} pgs` : 'Pending'}
                            {tb.fileSize ? ` • ${(tb.fileSize / (1024 * 1024)).toFixed(1)}MB` : ''}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <span className={`status-pill-${tb.status}`}>
                                {tb.status === 'completed' && <CheckCircle size={11} />}
                                {tb.status === 'processing' && <RefreshCw size={11} className="spin-icon" />}
                                {tb.status === 'uploaded' && <Clock size={11} />}
                                {tb.status === 'failed' && <AlertTriangle size={11} />}
                                <span>{tb.status.toUpperCase()}</span>
                              </span>
                              {tb.status === 'processing' && tb.job && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                                    <div style={{ width: `${tb.job.progressPercent || 20}%`, height: '100%', background: 'var(--gold-primary)' }} />
                                  </div>
                                  <span style={{ fontSize: '0.68rem' }}>{tb.job.stepDescription || 'Extracting...'}</span>
                                </div>
                              )}
                              {tb.status === 'failed' && tb.errorMessage && (
                                <span style={{ fontSize: '0.7rem', color: '#f87171' }} title={tb.errorMessage}>
                                  {tb.errorMessage.slice(0, 30)}...
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                              <button
                                className="table-action-btn"
                                title="View Details & Extracted Pages"
                                onClick={() => handleViewTextbookDetails(tb)}
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                className="table-action-btn"
                                title="Reprocess Text & OCR"
                                onClick={() => handleReprocessTextbook(tb)}
                              >
                                <RefreshCw size={14} />
                              </button>
                              <button
                                className="table-action-btn"
                                title="Replace Textbook PDF"
                                onClick={() => {
                                  setReplacingTextbookId(tb.id)
                                  setTbGroup(tb.groupId as any)
                                  setTbStandard(normalizeStandardId(tb.standard))
                                  setTbSubject(tb.subject)
                                  setTbMedium(tb.medium)
                                  setTbTerm(tb.term || 'Full Year')
                                  setTbBookName(tb.bookName)
                                  setTbIsCustomBookName(true)
                                  setTbFile(null)
                                  setTbUploadError(null)
                                  setIsUploadTextbookModalOpen(true)
                                }}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className="table-action-btn table-action-delete"
                                title="Delete Textbook"
                                onClick={() => setDeletingTextbook(tb)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 3: Study Notes Management */}
        {adminSection === 'notes' && (
          <>
            {/* Toolbar & Filters (matches Question Bank layout exactly) */}
            <div className="admin-toolbar glass">
              <div className="admin-toolbar-row">
                <div className="admin-search-wrapper">
                  <Search size={16} className="admin-search-icon" />
                  <input
                    type="text"
                    className="admin-search-input"
                    placeholder="Search by ID, title, lesson, subject, or content..."
                    value={notesSearchQuery}
                    onChange={(e) => {
                      setNotesSearchQuery(e.target.value)
                      setNotesPage(1)
                    }}
                  />
                </div>

                <div className="admin-action-buttons">
                  <button
                    className="admin-btn admin-btn-cloud-ai"
                    onClick={() => handleOpenCloudAiGenerator('notes')}
                    title="Generate syllabus-based study notes from Samacheer Kalvi textbooks"
                  >
                    <Sparkles size={16} />
                    <span>Cloud AI Generator</span>
                  </button>
                  <button className="admin-btn admin-btn-primary" onClick={handleOpenAddNoteModal}>
                    <Plus size={16} />
                    <span>Add Study Notes</span>
                  </button>
                  <button className="admin-btn admin-btn-secondary" onClick={() => setIsNotesBulkUploadModalOpen(true)}>
                    <Upload size={16} />
                    <span>Bulk Upload</span>
                  </button>
                  <button
                    className="admin-btn admin-btn-secondary"
                    onClick={() => {
                      setIsUsersModalOpen(true)
                      fetchAdminUsers()
                    }}
                    title="Manage Admin Logins"
                  >
                    <Users size={16} />
                    <span>Admin Users</span>
                  </button>
                  <button className="admin-btn admin-btn-secondary" onClick={fetchNotes} title="Refresh table data">
                    <RefreshCw size={15} className={notesLoading ? 'spin-icon' : ''} />
                  </button>
                </div>
              </div>

              <div className="admin-filter-pills">
                <SyllabusCascadeSelector
                  cascade={notesSyllabusCascade}
                  allowAll={true}
                  variant="filter"
                  extraFilters={
                    <>
                      <div className="ai-field">
                        <label>Status</label>
                        <select
                          className="ai-select qb-syllabus-select"
                          aria-label="Status"
                          value={notesStatusFilter}
                          onChange={(e) => {
                            setNotesStatusFilter(e.target.value as any)
                            setNotesPage(1)
                          }}
                        >
                          <option value="all">All Statuses</option>
                          <option value="staging">Staging Only (Under Review)</option>
                          <option value="published">Published Only (Live on Website)</option>
                        </select>
                      </div>

                      <div className="ai-field">
                        <label>Language</label>
                        <select
                          className="ai-select qb-syllabus-select"
                          aria-label="Language"
                          value={notesLanguageFilter}
                          onChange={(e) => {
                            setNotesLanguageFilter(e.target.value as any)
                            setNotesPage(1)
                          }}
                        >
                          <option value="all">All Languages</option>
                          <option value="tamil">Tamil (தமிழ்)</option>
                          <option value="english">English</option>
                        </select>
                      </div>
                    </>
                  }
                />

                <div className="qb-filter-actions-row">
                  <div className="admin-filter-count">
                    Showing <strong>{notesList.length}</strong> of <strong>{notesFilteredTotal}</strong> matching study notes | Selected: <strong>{selectedNoteIds.size}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {(notesGroupFilter !== 'all' ||
                      notesSubjectFilter !== 'all' ||
                      notesStandardFilter !== 'all' ||
                      notesUnitFilter !== 'all' ||
                      notesLessonFilter !== 'all' ||
                      notesStatusFilter !== 'all' ||
                      notesLanguageFilter !== 'all' ||
                      notesSearchQuery.trim() !== '') && (
                      <button
                        className="admin-btn admin-btn-secondary"
                        onClick={() => {
                          notesSyllabusCascade.resetFilters()
                          setNotesStatusFilter('all')
                          setNotesLanguageFilter('all')
                          setNotesSearchQuery('')
                          setNotesPage(1)
                        }}
                        title="Reset all syllabus and status filters"
                      >
                        <RefreshCcw size={14} />
                        <span>Reset Filters</span>
                      </button>
                    )}
                    <button className="admin-btn admin-btn-secondary" onClick={toggleSelectAllVisibleNotes} disabled={notesList.length === 0}>
                      {selectedNoteIds.size === notesList.length && notesList.length > 0 ? 'Deselect All Visible' : 'Select All Visible'}
                    </button>
                    <button
                      className="admin-btn admin-bulk-publish-btn"
                      onClick={() => setIsNotesBulkPublishModalOpen(true)}
                      disabled={selectedStagingNoteIds.length === 0 || isNotesBulkPublishing || notesBulkDeleting}
                    >
                      <span>🚀 Bulk Publish Selected ({selectedStagingNoteIds.length})</span>
                    </button>
                    <button className="admin-btn admin-btn-secondary" onClick={handleDeleteSelectedNotes} disabled={selectedNoteIds.size === 0 || notesBulkDeleting}>
                      <Trash2 size={14} />
                      <span>Delete Selected ({selectedNoteIds.size})</span>
                    </button>
                    <button className="admin-btn" style={{ background: '#ef4444', color: '#fff' }} onClick={handleDeleteAllFilteredNotes} disabled={notesFilteredTotal === 0 || notesBulkDeleting}>
                      <Trash2 size={14} />
                      <span>{notesBulkDeleting ? 'Deleting...' : `Delete All Filtered (${notesFilteredTotal})`}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Study Notes Table */}
            <div className="admin-table-scroll-hint">
              <span>← Swipe horizontally to view all columns & action buttons →</span>
            </div>
            <div className="admin-table-wrapper glass">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>Sel</th>
                    <th style={{ width: '70px' }}>ID</th>
                    <th style={{ width: '120px' }}>Status</th>
                    <th style={{ width: '140px' }}>Group & Unit</th>
                    <th style={{ width: '230px' }}>Lesson & Subject</th>
                    <th>Note Title & Content Excerpt</th>
                    <th style={{ width: '150px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {notesLoading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        Loading study notes from PostgreSQL...
                      </td>
                    </tr>
                  ) : notesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        No study notes found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    notesList.map((n) => (
                      <tr key={n.id}>
                        <td>
                          <input type="checkbox" checked={selectedNoteIds.has(n.id)} onChange={() => toggleSelectNote(n.id)} />
                        </td>
                        <td>
                          <span className="qid-badge">#{n.id}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <span className={`status-badge ${n.status === 'published' ? 'status-published' : 'status-staging'}`}>
                              {n.status === 'published' ? <CheckCircle size={12} /> : <Clock size={12} />}
                              {n.status}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                              {n.language || 'English'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span className="ai-tag-pill ai-tag-group" style={{ alignSelf: 'flex-start', fontSize: '0.7rem' }}>
                              {n.category ? n.category.toUpperCase() : 'GROUP 1'}
                            </span>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Unit {n.unitId}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Class {n.classId || '6'}</div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                            {n.lessonNumber && (
                              <span className="source-page-pill" style={{ color: 'var(--gold-primary)', borderColor: 'rgba(255, 215, 0, 0.4)', fontWeight: 700, fontSize: '0.75rem', padding: '0.15rem 0.45rem' }}>
                                Lesson {n.lessonNumber}
                              </span>
                            )}
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {n.lessonTitle}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{n.subject}</div>
                          {n.lessonId && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', opacity: 0.85, marginTop: '0.15rem' }}>
                              ID: {n.lessonId}
                            </div>
                          )}
                          {n.topic && (
                            <div style={{ fontSize: '0.72rem', color: '#c084fc', marginTop: '0.25rem', fontWeight: 500 }}>
                              📌 {n.topic}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#fef08a', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                            {n.title}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, maxHeight: '3.6em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {n.content ? n.content.replace(/^[#*`\s-]+/gm, '').slice(0, 160) + '...' : 'No preview content available'}
                          </div>
                          {n.sourceReference && (
                            <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span className="source-page-pill">
                                <BookOpen size={11} />
                                <span>{n.sourceReference}</span>
                              </span>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                            <button
                              className="table-action-btn"
                              title="Full Preview Note"
                              onClick={() => setPreviewingNote(n)}
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              className="table-action-btn"
                              title="Edit Study Note"
                              onClick={() => {
                                const noteToEdit = { ...n }
                                if (!noteToEdit.lessonId && noteToEdit.lessonTitle) {
                                  const currentCat = noteToEdit.category || 'group2'
                                  const subjects = getSubjectsForGroup(currentCat as any)
                                  const subj = subjects.find((s: any) => s.name === noteToEdit.subject || s.id === noteToEdit.subject) || subjects[0]
                                  const lessons = getLessonsForSelection(currentCat as any, subj?.id || 'general-studies', noteToEdit.classId || 6, noteToEdit.unitId || 1)
                                  const matched = lessons.find((l: any) => l.title === noteToEdit.lessonTitle || l.title.includes(noteToEdit.lessonTitle) || noteToEdit.lessonTitle.includes(l.title))
                                  if (matched) {
                                    noteToEdit.lessonId = matched.id
                                    noteToEdit.lessonNumber = matched.lessonNumber
                                  }
                                }
                                setEditingNote(noteToEdit)
                                setNotesPreviewTab('edit')
                                setIsNotesEditModalOpen(true)
                              }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className={`table-action-btn ${n.status === 'published' ? '' : 'table-action-publish'}`}
                              title={n.status === 'published' ? 'Revert to Staging' : 'Publish Note to Study Materials'}
                              onClick={() => handleTogglePublishNote(n)}
                            >
                              {n.status === 'published' ? <Clock size={14} /> : <CheckCircle size={14} />}
                            </button>
                            <button
                              className="table-action-btn table-action-delete"
                              title="Delete Study Note"
                              onClick={() => setIsDeletingNote(n)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Notes Pagination Controls */}
              {Math.ceil(notesFilteredTotal / notesPageSize) > 1 && (
                <div className="admin-pagination">
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Page {notesPage} of {Math.ceil(notesFilteredTotal / notesPageSize)} ({notesFilteredTotal} items)
                  </span>
                  <div className="pagination-controls">
                    <button
                      className="table-action-btn"
                      disabled={notesPage <= 1}
                      onClick={() => setNotesPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      className="table-action-btn"
                      disabled={notesPage >= Math.ceil(notesFilteredTotal / notesPageSize)}
                      onClick={() => setNotesPage((p) => Math.min(Math.ceil(notesFilteredTotal / notesPageSize), p + 1))}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Section 4: Google Drive PDF Materials Management */}
        {adminSection === 'gdrive' && (
          <div className="admin-gdrive-section">
            {/* Google Drive Status Banner Card */}
            <div className="gdrive-status-card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
                <div className="gdrive-status-info">
                  <div className="gdrive-status-icon-box">
                    <Cloud size={28} />
                  </div>
                  <div className="gdrive-status-details">
                    <div className="gdrive-status-title-row">
                      <h3 className="gdrive-status-title">Google Drive Cloud Storage</h3>
                      {isConnectingDrive ? (
                        <span className="gdrive-status-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}>
                          <RefreshCw size={13} className="spinning" />
                          Connecting...
                        </span>
                      ) : driveStatus.connected ? (
                        <span className="gdrive-status-badge gdrive-status-badge-connected">
                          <CheckCircle2 size={13} />
                          Connected: {driveStatus.email || 'Authorized'}
                        </span>
                      ) : (driveConnectionError || driveStatus.error) ? (
                        <span className="gdrive-status-badge gdrive-status-badge-disconnected">
                          <AlertCircle size={13} />
                          Connection Failed
                        </span>
                      ) : (
                        <span className="gdrive-status-badge gdrive-status-badge-disconnected">
                          <AlertCircle size={13} />
                          Not Connected
                        </span>
                      )}
                    </div>
                    <p className="gdrive-status-desc">
                      {isConnectingDrive
                        ? 'Opening Google OAuth authorization consent screen...'
                        : driveStatus.connected
                        ? `Connected to personal Google Drive (${driveStatus.email || 'Authorized'}). Large PDF textbooks stream directly to Google Drive via authorized resumable sessions. Target Folder: "${driveStatus.folderName}".`
                        : driveConnectionError
                        ? `Connection issue detected: ${driveConnectionError}`
                        : 'Connect your personal Google Drive account to store 3–4 GB of TNPSC PDF textbooks with zero Vercel serverless size restrictions.'}
                    </p>
                    {(driveConnectionError || (!driveStatus.connected && driveStatus.error)) && (
                      <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.75rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#fca5a5', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={14} style={{ flexShrink: 0 }} />
                        <span>{driveConnectionError || driveStatus.error}</span>
                      </div>
                    )}
                    {!driveStatus.connected && !driveStatus.configured && (
                      <div style={{ marginTop: '0.65rem', padding: '0.65rem 0.85rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fde68a', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.25rem' }}>
                          <AlertTriangle size={15} />
                          <span>Action Required: Configure GOOGLE_CLIENT_SECRET</span>
                        </div>
                        <div>
                          Open <code>backend/.env</code> and paste your newly rotated Google Client Secret into:
                          <div style={{ marginTop: '0.35rem', fontFamily: 'monospace', background: 'rgba(0,0,0,0.35)', padding: '0.35rem 0.6rem', borderRadius: '4px', color: '#6ee7b7' }}>
                            GOOGLE_CLIENT_SECRET=GOCSPX-your_actual_rotated_secret
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="gdrive-status-actions">
                  {/* Connection State 1: Connecting */}
                  {isConnectingDrive ? (
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      disabled
                      style={{ opacity: 0.85, background: 'linear-gradient(135deg, #f59e0b 0%, #ffd700 100%)', color: '#000', fontWeight: 700 }}
                    >
                      <RefreshCw size={14} className="spinning" />
                      <span>Connecting to Google Drive...</span>
                    </button>
                  ) : driveStatus.connected ? (
                    /* Connection State 2: Connected */
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        onClick={() => checkDriveStatus()}
                        title="Refresh connection status"
                        disabled={isCheckingDrive}
                      >
                        <RefreshCw size={14} className={isCheckingDrive ? 'spinning' : ''} />
                        <span>Check Status</span>
                      </button>
                      <button
                        type="button"
                        className="admin-btn"
                        style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                        onClick={handleDisconnectGoogleDrive}
                      >
                        <LogOut size={14} />
                        <span>Disconnect Drive</span>
                      </button>
                    </div>
                  ) : (driveConnectionError || driveStatus.error) ? (
                    /* Connection State 3: Connection Failed (Retry option) */
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="admin-btn admin-btn-primary"
                        onClick={handleConnectGoogleDrive}
                        style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ffd700 100%)', color: '#000', fontWeight: 700 }}
                      >
                        <RefreshCw size={15} />
                        <span>Retry Connection</span>
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        onClick={() => checkDriveStatus()}
                        title="Check connection status"
                        disabled={isCheckingDrive}
                      >
                        <RefreshCw size={14} className={isCheckingDrive ? 'spinning' : ''} />
                        <span>Check Status</span>
                      </button>
                    </div>
                  ) : (
                    /* Connection State 4: Not Connected */
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="admin-btn admin-btn-primary"
                        onClick={handleConnectGoogleDrive}
                        style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ffd700 100%)', color: '#000', fontWeight: 700 }}
                      >
                        <Cloud size={16} />
                        <span>Connect Google Drive</span>
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        onClick={() => checkDriveStatus()}
                        title="Check connection status"
                        disabled={isCheckingDrive}
                      >
                        <RefreshCw size={14} className={isCheckingDrive ? 'spinning' : ''} />
                        <span>Check Status</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Setup Information Grid */}
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>
                <div>
                  <strong style={{ color: '#ffd700' }}>OAuth Scope:</strong> <code style={{ color: '#cbd5e1' }}>https://www.googleapis.com/auth/drive.file</code> (App-isolated access)
                </div>
                <div>
                  <strong style={{ color: '#ffd700' }}>Target Folder:</strong> <code style={{ color: '#cbd5e1' }}>TNPSC Study Hub Materials</code> (Auto-created on Drive)
                </div>
                <div>
                  <strong style={{ color: '#ffd700' }}>Local Callback:</strong> <code style={{ color: '#cbd5e1' }}>http://localhost:5000/api/drive/oauth/callback</code>
                </div>
                <div>
                  <strong style={{ color: '#ffd700' }}>Production Callback:</strong> <code style={{ color: '#cbd5e1' }}>https://tnpsc-quiz-lval.vercel.app/api/drive/oauth/callback</code>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong style={{ color: '#ffd700' }}>Authorized JavaScript Origins:</strong>{' '}
                  <code style={{ color: '#10b981' }}>http://localhost:5173</code>,{' '}
                  <code style={{ color: '#10b981' }}>https://tnpsc-quiz-lval.vercel.app</code>
                  {typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'http://localhost:5173' && !window.location.origin.includes('vercel.app') && (
                    <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>
                      (Current active origin: <code>{window.location.origin}</code>)
                    </span>
                  )}
                  <span style={{ color: 'rgba(255,255,255,0.45)', marginLeft: '0.5rem' }}>
                    (Add to Google Cloud Console &rarr; OAuth 2.0 Client &rarr; Authorized JavaScript origins for direct browser streaming)
                  </span>
                </div>
              </div>
            </div>

            {/* Toolbar & Filters */}
            <div className="admin-toolbar glass" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="search-bar" style={{ maxWidth: '360px', minWidth: '240px' }}>
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder="Search PDF materials or lessons..."
                      value={driveSearch}
                      onChange={(e) => setDriveSearch(e.target.value)}
                    />
                    {driveSearch && (
                      <button className="search-clear-btn" onClick={() => setDriveSearch('')}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {driveMaterials.length} PDF file{driveMaterials.length === 1 ? '' : 's'} indexed
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    onClick={() => {
                      setDriveGroupFilter('all')
                      setDriveStandardFilter('all')
                      setDriveSubjectFilter('all')
                      setDriveTermFilter('all')
                      setDriveSearch('')
                    }}
                    title="Reset all filters"
                  >
                    <RefreshCw size={14} />
                    <span>Reset Filters</span>
                  </button>

                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    disabled={!driveStatus.connected}
                    onClick={() => {
                      setDriveUploadError(null)
                      setDriveFile(null)
                      setDriveUploadTitle('')
                      setDriveUploadProgress(0)
                      setIsDriveUploadModalOpen(true)
                    }}
                    title={driveStatus.connected ? 'Upload PDF to Google Drive' : 'Please connect Google Drive first'}
                    style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ffd700 100%)', color: '#000', fontWeight: 700 }}
                  >
                    <UploadCloud size={16} />
                    <span>+ Upload PDF to Google Drive</span>
                  </button>
                </div>
              </div>

              {/* Dropdown Filters Row */}
              <div className="filter-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                <div className="filter-group">
                  <label className="filter-label">TNPSC Group</label>
                  <select
                    className="filter-select"
                    value={driveGroupFilter}
                    onChange={(e) => setDriveGroupFilter(e.target.value)}
                  >
                    <option value="all">All Groups</option>
                    <option value="group1">Group 1</option>
                    <option value="group2">Group 2 / 2A</option>
                    <option value="group4">Group 4</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label">Standard / Class</label>
                  <select
                    className="filter-select"
                    value={driveStandardFilter}
                    onChange={(e) => setDriveStandardFilter(e.target.value)}
                  >
                    <option value="all">All Classes</option>
                    {[6, 7, 8, 9, 10, 11, 12].map((std) => (
                      <option key={std} value={std}>
                        Class {std}th
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label">Subject</label>
                  <select
                    className="filter-select"
                    value={driveSubjectFilter}
                    onChange={(e) => setDriveSubjectFilter(e.target.value)}
                  >
                    <option value="all">All Subjects</option>
                    {Array.from(new Set(driveMaterials.map((m) => m.subject).filter(Boolean))).sort().map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label">Term / Volume</label>
                  <select
                    className="filter-select"
                    value={driveTermFilter}
                    onChange={(e) => setDriveTermFilter(e.target.value)}
                  >
                    <option value="all">All Terms</option>
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                    <option value="Full Year">Full Year</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Materials Table Card */}
            <div className="admin-table-card glass">
              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th style={{ minWidth: '220px' }}>Material / File Name</th>
                      <th>Syllabus Alignment</th>
                      <th>Class & Term</th>
                      <th>File Size</th>
                      <th>Uploaded Date</th>
                      <th style={{ textAlign: 'center', width: '190px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driveLoading ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                            <RefreshCw size={24} className="spinning" style={{ color: 'var(--gold-primary)' }} />
                            <span style={{ color: 'var(--text-secondary)' }}>Loading Google Drive materials...</span>
                          </div>
                        </td>
                      </tr>
                    ) : driveMaterials.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                              <Folder size={24} />
                            </div>
                            <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>
                              No Google Drive PDF Materials Found
                            </h4>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: '420px' }}>
                              {!driveStatus.connected
                                ? 'Connect your Google Drive account above to start uploading and organizing textbook PDFs.'
                                : 'No PDF materials match your current filter selections. Click "+ Upload PDF to Google Drive" to add one.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      driveMaterials.map((item, idx) => (
                        <tr key={item.id}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                              <FileText size={20} style={{ color: '#ffd700', flexShrink: 0, marginTop: '2px' }} />
                              <div>
                                <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.9rem', lineHeight: '1.3' }}>
                                  {item.fileName}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                                  Original: {item.originalFileName || item.fileName}
                                </div>
                                {item.lesson && (
                                  <div style={{ fontSize: '0.76rem', color: '#c084fc', marginTop: '2px' }}>
                                    📖 {item.lesson}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span className="badge badge-group" style={{ width: 'fit-content', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                {item.group}
                              </span>
                              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                {item.subject}
                              </span>
                              {item.unit && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {item.unit}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                                Class {item.standard}th
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {item.term || 'Full Year'}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                              {item.fileSize ? `${(item.fileSize / (1024 * 1024)).toFixed(2)} MB` : '—'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                              <button
                                type="button"
                                className="table-action-btn"
                                title="View PDF inside Reader Modal"
                                onClick={() => setViewingDriveMaterial(item)}
                                style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.3)' }}
                              >
                                <Eye size={14} />
                              </button>
                              <a
                                href={getApiUrl(`/api/drive/view/${item.id}`)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="table-action-btn"
                                title="Open PDF Stream in New Tab"
                                style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <ExternalLink size={14} />
                              </a>
                              <button
                                type="button"
                                className="table-action-btn table-action-btn-danger"
                                title="Delete PDF Material"
                                onClick={() => setDeletingDriveMaterial(item)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Question Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingQuestion && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="admin-modal-header">
                <h2 className="admin-modal-title">
                  {editingQuestion.id ? `Edit Question #${editingQuestion.id}` : 'Create New MCQ Question'}
                </h2>
                <button className="admin-modal-close" onClick={() => setIsEditModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveQuestion}>
                <div className="admin-modal-body">
                  {/* Row 1: Group & Subject */}
                  <div className="form-grid-2" style={{ marginBottom: '0.75rem' }}>
                    <div className="form-field">
                      <label>1. TNPSC Examination Group *</label>
                      <select
                        className="filter-select"
                        style={{ width: '100%', padding: '0.65rem' }}
                        value={editingQuestion.category || 'group1'}
                        onChange={(e) => {
                          const newCat = e.target.value as any
                          const currentClassId = editingQuestion.classId || 6
                          const subjects = getSubjectsForGroup(newCat)
                          const defaultSubjectId = subjects[0]?.id || 'general_science'
                          const units = getUnitsForSubjectStandard(newCat, defaultSubjectId, currentClassId)
                          const defaultUnitId = units[0]?.id || 1
                          const lessons = getLessonsForSelection(newCat, defaultSubjectId, currentClassId, defaultUnitId)
                          const topics = lessons[0] ? getTopicsForSelection(newCat, defaultSubjectId, currentClassId, defaultUnitId, lessons[0].title) : []
                          setEditingQuestion({
                            ...editingQuestion,
                            category: newCat,
                            unitId: defaultUnitId,
                            subject: subjects[0]?.name || units[0]?.subjectName || 'General Studies',
                            lessonTitle: lessons[0]?.title || '',
                            lessonId: lessons[0]?.id || null,
                            topic: topics[0]?.name || '',
                          })
                        }}
                        required
                      >
                        {TNPSC_GROUPS.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name} ({g.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>2. Subject Selection *</label>
                      <select
                        className="filter-select"
                        style={{ width: '100%', padding: '0.65rem' }}
                        value={(() => {
                          const currentCat = (editingQuestion.category as any) || 'group1'
                          const currentSubj = editingQuestion.subject || ''
                          const subjects = getSubjectsForGroup(currentCat)
                          const subj = subjects.find((s: any) => s.name === currentSubj) || subjects[0]
                          return subj?.name || currentSubj || ''
                        })()}
                        onChange={(e) => {
                          const selectedSubjectName = e.target.value
                          const currentCat = (editingQuestion.category as any) || 'group1'
                          const currentClassId = editingQuestion.classId || 6
                          const subjects = getSubjectsForGroup(currentCat)
                          const subj = subjects.find((s: any) => s.name === selectedSubjectName) || subjects[0]
                          const subjId = subj?.id || 'general_science'
                          const units = getUnitsForSubjectStandard(currentCat, subjId, currentClassId)
                          const defaultUnitId = units[0]?.id || 1
                          const lessons = getLessonsForSelection(currentCat, subjId, currentClassId, defaultUnitId)
                          const topics = lessons[0] ? getTopicsForSelection(currentCat, subjId, currentClassId, defaultUnitId, lessons[0].title) : []
                          setEditingQuestion({
                            ...editingQuestion,
                            subject: selectedSubjectName,
                            unitId: defaultUnitId,
                            lessonTitle: lessons[0]?.title || '',
                            lessonId: lessons[0]?.id || null,
                            topic: topics[0]?.name || '',
                          })
                        }}
                        required
                      >
                        {(() => {
                          const currentCat = (editingQuestion.category as any) || 'group1'
                          const subjects = getSubjectsForGroup(currentCat)
                          return subjects.map((s: any) => (
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))
                        })()}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Standard & Unit */}
                  <div className="form-grid-2" style={{ marginBottom: '0.75rem' }}>
                    <div className="form-field">
                      <label>3. Standard (6th to 12th) *</label>
                      <select
                        className="filter-select"
                        style={{ width: '100%', padding: '0.65rem' }}
                        value={editingQuestion.classId || 6}
                        onChange={(e) => {
                          const newClassId = parseInt(e.target.value, 10) || 6
                          const currentCat = (editingQuestion.category as any) || 'group1'
                          const currentUnitId = editingQuestion.unitId || 1
                          const currentSubj = editingQuestion.subject || ''
                          const subjects = getSubjectsForGroup(currentCat)
                          const subj = subjects.find((s: any) => s.name === currentSubj) || subjects[0]
                          const subjId = subj?.id || 'general_science'
                          const lessons = getLessonsForSelection(currentCat, subjId, newClassId, currentUnitId)
                          const topics = lessons[0] ? getTopicsForSelection(currentCat, subjId, newClassId, currentUnitId, lessons[0].title) : []
                          setEditingQuestion({
                            ...editingQuestion,
                            classId: newClassId,
                            lessonTitle: lessons[0]?.title || '',
                            lessonId: lessons[0]?.id || null,
                            topic: topics[0]?.name || '',
                            sourceReference: `Samacheer Kalvi Class ${newClassId}`,
                          })
                        }}
                        required
                      >
                        {STANDARDS.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Unit & Lesson Title */}
                  <div className="form-grid-2" style={{ marginBottom: '0.75rem' }}>
                    <div className="form-field">
                      <label>4. Unit (1 to 6) *</label>
                      <select
                        className="filter-select"
                        style={{ width: '100%', padding: '0.65rem' }}
                        value={editingQuestion.unitId || 1}
                        onChange={(e) => {
                          const newUnitId = parseInt(e.target.value, 10) || 1
                          const currentCat = (editingQuestion.category as any) || 'group1'
                          const currentClassId = editingQuestion.classId || 6
                          const currentSubj = editingQuestion.subject || ''
                          const subjects = getSubjectsForGroup(currentCat)
                          const subj = subjects.find((s: any) => s.name === currentSubj) || subjects[0]
                          const subjId = subj?.id || 'general_science'
                          const units = getUnitsForSubjectStandard(currentCat, subjId, currentClassId)
                          const unitObj = units.find((u: any) => u.id === newUnitId)
                          const lessons = getLessonsForSelection(currentCat, subjId, currentClassId, newUnitId)
                          const topics = lessons[0] ? getTopicsForSelection(currentCat, subjId, currentClassId, newUnitId, lessons[0].title) : []
                          setEditingQuestion({
                            ...editingQuestion,
                            unitId: newUnitId,
                            subject: unitObj?.subjectName || subj?.name || editingQuestion.subject || 'General Studies',
                            lessonTitle: lessons[0]?.title || '',
                            lessonId: lessons[0]?.id || null,
                            topic: topics[0]?.name || '',
                          })
                        }}
                        required
                      >
                        {(() => {
                          const currentCat = (editingQuestion.category as any) || 'group1'
                          const currentClassId = editingQuestion.classId || 6
                          const currentSubj = editingQuestion.subject || ''
                          const subjects = getSubjectsForGroup(currentCat)
                          const subj = subjects.find((s: any) => s.name === currentSubj) || subjects[0]
                          const subjId = subj?.id || 'general_science'
                          const units = getUnitsForSubjectStandard(currentCat, subjId, currentClassId)
                          return units.map((u: any) => (
                            <option key={u.id} value={u.id}>
                              {u.unitNumber ? `${u.unitNumber}: ` : ''}{u.title}
                            </option>
                          ))
                        })()}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>5. Lesson Title (Filtered by Std & Unit) *</label>
                      {(() => {
                        const currentCat = (editingQuestion.category as any) || 'group1'
                        const currentUnitId = editingQuestion.unitId || 1
                        const currentClassId = editingQuestion.classId || 6
                        const currentSubj = editingQuestion.subject || ''
                        const subjects = getSubjectsForGroup(currentCat)
                        const subj = subjects.find((s: any) => s.name === currentSubj) || subjects[0]
                        const subjId = subj?.id || 'general_science'
                        const availableEditLessons = getLessonsForSelection(currentCat, subjId, currentClassId, currentUnitId)
                        return (
                          <select
                            className="filter-select"
                            style={{ width: '100%', padding: '0.65rem' }}
                            value={editingQuestion.lessonTitle || ''}
                            onChange={(e) => {
                              const val = e.target.value
                              const matchedLesson = availableEditLessons.find((l: any) => l.title === val)
                              const topics = getTopicsForSelection(currentCat, subjId, currentClassId, currentUnitId, val)
                              setEditingQuestion({
                                ...editingQuestion,
                                lessonTitle: val,
                                lessonId: matchedLesson?.id || null,
                                topic: topics[0]?.name || '',
                              })
                            }}
                            required
                          >
                            <option value="" disabled>-- Select Lesson ({availableEditLessons.length} available) --</option>
                            {availableEditLessons.map((l: any) => (
                              <option key={l.id} value={l.title}>
                                {l.lessonNumber ? `${l.lessonNumber} ` : ''}{l.title}
                              </option>
                            ))}
                            {editingQuestion.lessonTitle &&
                              !availableEditLessons.some((l: any) => l.title === editingQuestion.lessonTitle) && (
                                <option value={editingQuestion.lessonTitle}>
                                  {editingQuestion.lessonTitle}
                                </option>
                              )}
                          </select>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Row 3: Specific Topic */}
                  <div className="form-field" style={{ marginBottom: '0.75rem' }}>
                    <label>6. Specific Syllabus Topic *</label>
                    {(() => {
                      const currentCat = (editingQuestion.category as any) || 'group1'
                      const currentUnitId = editingQuestion.unitId || 1
                      const currentClassId = editingQuestion.classId || 6
                      const currentSubj = editingQuestion.subject || ''
                      const subjects = getSubjectsForGroup(currentCat)
                      const subj = subjects.find((s: any) => s.name === currentSubj) || subjects[0]
                      const subjId = subj?.id || 'general_science'
                      const availableEditTopics = getTopicsForSelection(
                        currentCat,
                        subjId,
                        currentClassId,
                        currentUnitId,
                        editingQuestion.lessonTitle || ''
                      )
                      if (availableEditTopics.length > 0) {
                        return (
                          <select
                            className="filter-select"
                            style={{ width: '100%', padding: '0.65rem' }}
                            value={editingQuestion.topic || ''}
                            onChange={(e) => setEditingQuestion({ ...editingQuestion, topic: e.target.value })}
                            required
                          >
                            <option value="" disabled>-- Select Topic ({availableEditTopics.length} available) --</option>
                            {availableEditTopics.map((t: any) => (
                              <option key={t.id} value={t.name}>
                                {t.name}
                              </option>
                            ))}
                            {editingQuestion.topic &&
                              !availableEditTopics.some((t: any) => t.name === editingQuestion.topic) && (
                                <option value={editingQuestion.topic}>{editingQuestion.topic}</option>
                              )}
                          </select>
                        )
                      }
                      return (
                        <input
                          type="text"
                          value={editingQuestion.topic || ''}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, topic: e.target.value })}
                          placeholder="Select or type exact topic"
                          required
                        />
                      )
                    })()}
                  </div>

                  {/* Row 4: Difficulty */}
                  <div className="form-grid-2">
                    <div className="form-field">
                      <label>Difficulty</label>
                      <select
                        className="filter-select"
                        style={{ width: '100%', padding: '0.65rem' }}
                        value={editingQuestion.difficulty || 'Medium'}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value as any })}
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Question Text</label>
                    <textarea
                      rows={3}
                      value={editingQuestion.question || ''}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                      placeholder="Type question text..."
                      required
                    />
                  </div>

                  {/* 4 Separate Option Inputs */}
                  <div className="options-fieldset">
                    <legend className="options-legend">Four Options & Correct Answer</legend>
                    {['A', 'B', 'C', 'D'].map((letter, index) => (
                      <div key={index} className="option-edit-row">
                        <span className="option-edit-letter">{letter}</span>
                        <input
                          type="text"
                          className="option-edit-input"
                          placeholder={`Option ${letter} text`}
                          value={editingQuestion.options?.[index] || ''}
                          onChange={(e) => {
                            const updatedOptions = [...(editingQuestion.options || ['', '', '', ''])]
                            updatedOptions[index] = e.target.value
                            setEditingQuestion({ ...editingQuestion, options: updatedOptions })
                          }}
                          required
                        />
                        <label className={`option-radio ${editingQuestion.correctAnswer === index ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="correctAnswerSelect"
                            checked={editingQuestion.correctAnswer === index}
                            onChange={() => setEditingQuestion({ ...editingQuestion, correctAnswer: index })}
                          />
                          <span>Correct</span>
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="form-field">
                    <label>Explanation</label>
                    <textarea
                      rows={3}
                      value={editingQuestion.explanation || ''}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                      placeholder="Detailed explanation citing textbook concepts..."
                      required
                    />
                  </div>

                  <div className="form-grid-2">
                    <div className="form-field">
                      <label>Source Reference</label>
                      <input
                        type="text"
                        value={editingQuestion.sourceReference || ''}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, sourceReference: e.target.value })}
                        placeholder="Samacheer Kalvi Class 10 Science, Lesson 1"
                      />
                    </div>
                    <div className="form-field">
                      <label>Publication Status</label>
                      <select
                        className="filter-select"
                        style={{ width: '100%', padding: '0.65rem' }}
                        value={editingQuestion.status || 'staging'}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, status: e.target.value as any })}
                      >
                        <option value="staging">Staging (Under Review)</option>
                        <option value="published">Published (Live in Quiz)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="admin-modal-footer">
                  <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setIsEditModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="admin-btn admin-btn-primary">
                    <FileCheck size={16} />
                    <span>{editingQuestion.id ? 'Save Changes' : 'Create Question'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleting && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal"
              style={{ maxWidth: '480px' }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="admin-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#f87171' }}>
                  <AlertTriangle size={20} />
                  <h2 className="admin-modal-title" style={{ color: '#f87171' }}>Confirm Deletion</h2>
                </div>
                <button className="admin-modal-close" onClick={() => setIsDeleting(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal-body">
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Are you sure you want to permanently delete <strong>Question #{isDeleting.id}</strong>?
                </p>
                <div style={{ padding: '0.85rem', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  {isDeleting.question}
                </div>
                <p style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 600 }}>
                  ⚠️ This action cannot be undone and will immediately remove the question from PostgreSQL.
                </p>
              </div>

              <div className="admin-modal-footer">
                <button className="admin-btn admin-btn-secondary" onClick={() => setIsDeleting(null)}>
                  Cancel
                </button>
                <button
                  className="admin-btn"
                  style={{ background: '#ef4444', color: '#fff' }}
                  onClick={handleConfirmDelete}
                >
                  <Trash2 size={16} />
                  <span>Yes, Delete Question</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Publish Confirmation Modal */}
      <AnimatePresence>
        {isBulkPublishModalOpen && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal"
              style={{ maxWidth: '520px' }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="admin-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#34d399' }}>
                  <CheckCircle size={20} />
                  <h2 className="admin-modal-title">Confirm Bulk Publishing</h2>
                </div>
                <button
                  className="admin-modal-close"
                  onClick={() => setIsBulkPublishModalOpen(false)}
                  disabled={isBulkPublishing}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal-body">
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  You are about to publish <strong>{selectedStagingIds.length}</strong> staging question
                  {selectedStagingIds.length === 1 ? '' : 's'}. These questions will become available to students on the
                  website. Do you want to continue?
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Only the selected staging questions will be published. Published questions are never modified.
                </p>
              </div>

              <div className="admin-modal-footer">
                <button
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setIsBulkPublishModalOpen(false)}
                  disabled={isBulkPublishing}
                >
                  Cancel
                </button>
                <button
                  className="admin-btn admin-bulk-publish-btn"
                  onClick={handleBulkPublish}
                  disabled={isBulkPublishing || selectedStagingIds.length === 0}
                >
                  {isBulkPublishing ? <RefreshCw size={16} className="spin-icon" /> : <CheckCircle size={16} />}
                  <span>{isBulkPublishing ? 'Publishing...' : 'Confirm & Publish'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Upload Modal */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="admin-modal-header">
                <h2 className="admin-modal-title">Bulk Upload Questions (JSON / CSV)</h2>
                <button className="admin-modal-close" onClick={() => setIsBulkModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal-body">
                <div className="form-field" style={{ marginBottom: '1rem' }}>
                  <label style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    Mandatory Target TNPSC Group *
                  </label>
                  <select
                    className="filter-select"
                    style={{ width: '100%', padding: '0.65rem' }}
                    value={bulkGroupId}
                    onChange={(e) => setBulkGroupId(e.target.value as any)}
                  >
                    {TNPSC_GROUPS.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.code})
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    All uploaded questions will be strictly assigned to this group to prevent cross-group leakage.
                  </p>
                </div>

                <div className="bulk-dropzone" onClick={() => document.getElementById('bulk-file-input')?.click()}>
                  <Upload size={32} className="bulk-icon" />
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    Click to select or drag & drop a .JSON or .CSV file
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    All uploaded questions are strictly saved into <strong>Staging</strong> for review before publishing.
                  </p>
                  <input
                    id="bulk-file-input"
                    type="file"
                    accept=".json,.csv"
                    style={{ display: 'none' }}
                    onChange={handleBulkFileChange}
                  />
                </div>

                <div className="form-field" style={{ marginTop: '0.5rem' }}>
                  <label>Or Paste Raw JSON / CSV Data</label>
                  <textarea
                    rows={6}
                    className="bulk-textarea"
                    placeholder={`[
  {
    "question": "Sample Question Text?",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": 0,
    "lessonTitle": "Laws of Motion",
    "unitId": 1,
    "explanation": "Sample explanation",
    "sourceReference": "Class 10 Science"
  }
]`}
                    value={bulkRawText}
                    onChange={(e) => {
                      setBulkRawText(e.target.value)
                      parseBulkContent(e.target.value)
                    }}
                  />
                </div>

                {bulkParseError && (
                  <div style={{ padding: '0.75rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.85rem' }}>
                    {bulkParseError}
                  </div>
                )}

                {bulkParsedCount !== null && !bulkParseError && (
                  <div style={{ padding: '0.75rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={16} />
                    <span>Detected {bulkParsedCount} question(s) ready for staging.</span>
                  </div>
                )}
              </div>

              <div className="admin-modal-footer">
                <button className="admin-btn admin-btn-secondary" onClick={() => setIsBulkModalOpen(false)}>
                  Cancel
                </button>
                <button
                  className="admin-btn admin-btn-primary"
                  disabled={!bulkParsedCount || isUploading}
                  onClick={handleExecuteBulkUpload}
                >
                  <Upload size={16} />
                  <span>{isUploading ? 'Uploading to Staging...' : 'Upload to Staging'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Multiple Admin Accounts Management Modal */}
      <AnimatePresence>
        {isUsersModalOpen && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal admin-users-modal-container"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {/* Header */}
              <div className="admin-modal-header">
                <div className="admin-modal-header-info">
                  <div className="admin-badge-row">
                    <span className="admin-badge">
                      <Users size={13} />
                      Access Control
                    </span>
                    <span className="admin-badge" style={{ borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)' }}>
                      {adminUsersList.length} Active Accounts
                    </span>
                  </div>
                  <h2 className="admin-modal-title">Admin Account Management</h2>
                  <p className="admin-modal-subtitle">
                    Configure multiple administrators, editors, and syllabus reviewers with distinct login credentials.
                  </p>
                </div>
                <button
                  className="admin-modal-close"
                  onClick={() => setIsUsersModalOpen(false)}
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="admin-modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                {userActionError && (
                  <div className="admin-toast-error" style={{ padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                    <AlertTriangle size={16} />
                    <span>{userActionError}</span>
                  </div>
                )}

                <div className="admin-users-grid-layout">
                  {/* Left: Registered Admin Accounts List */}
                  <div className="admin-users-list-card">
                    <div className="admin-users-list-header">
                      <div className="admin-users-list-title">
                        <Shield size={16} style={{ color: 'var(--gold-primary)' }} />
                        <span>Registered Admin Logins</span>
                      </div>
                      <button
                        className="admin-btn admin-btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={fetchAdminUsers}
                        title="Refresh accounts"
                      >
                        <RefreshCw size={13} className={isLoadingUsers ? 'spin-icon' : ''} />
                        <span>Refresh</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {isLoadingUsers && adminUsersList.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Loading admin accounts...
                        </div>
                      ) : adminUsersList.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No admin accounts found.
                        </div>
                      ) : (
                        adminUsersList.map((usr) => {
                          const isRoot = usr.username.toLowerCase() === 'admin'
                          const isEnv = usr.source === 'env'
                          return (
                            <div key={`${usr.source}-${usr.id}-${usr.username}`} className="admin-user-card-item">
                              <div className="admin-user-info-left">
                                <div className="admin-user-avatar">
                                  {usr.name ? usr.name.charAt(0).toUpperCase() : usr.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="admin-user-meta">
                                  <div className="admin-user-name">
                                    <span>{usr.name}</span>
                                    <span
                                      className={`admin-user-tag ${
                                        usr.role === 'super_admin'
                                          ? 'admin-user-tag-super'
                                          : usr.role === 'reviewer'
                                          ? 'admin-user-tag-reviewer'
                                          : usr.role === 'editor'
                                          ? 'admin-user-tag-editor'
                                          : 'admin-user-tag-admin'
                                      }`}
                                    >
                                      {usr.role.replace('_', ' ')}
                                    </span>
                                  </div>
                                  <div className="admin-user-sub">
                                    <span>@{usr.username}</span>
                                    <span>•</span>
                                    <span className="admin-user-tag admin-user-tag-env">
                                      {isEnv ? '.env Config' : 'Database'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <button
                                  className="admin-user-delete-btn"
                                  onClick={() => handleDeleteAdminUser(usr.id, usr.username)}
                                  disabled={isRoot || isEnv}
                                  title={
                                    isRoot
                                      ? 'Root admin cannot be deleted'
                                      : isEnv
                                      ? 'Configured via .env file'
                                      : 'Delete admin account'
                                  }
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* Right: Add New Admin Form */}
                  <div className="admin-user-create-card">
                    <div className="admin-user-create-title">
                      <UserPlus size={16} style={{ color: '#38bdf8' }} />
                      <span>Create New Admin Login</span>
                    </div>

                    <form onSubmit={handleCreateAdminUser} className="admin-user-form">
                      <div className="form-field">
                        <label>Display Name *</label>
                        <input
                          type="text"
                          className="filter-select"
                          style={{ width: '100%', padding: '0.65rem' }}
                          placeholder="e.g. Chandru (Lead Editor)"
                          value={newAdminName}
                          onChange={(e) => setNewAdminName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-field">
                        <label>Username *</label>
                        <input
                          type="text"
                          className="filter-select"
                          style={{ width: '100%', padding: '0.65rem' }}
                          placeholder="e.g. chandru_admin"
                          value={newAdminUsername}
                          onChange={(e) => setNewAdminUsername(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-field">
                        <label>Password *</label>
                        <input
                          type="password"
                          className="filter-select"
                          style={{ width: '100%', padding: '0.65rem' }}
                          placeholder="Min 6 characters"
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-field">
                        <label>Role / Permissions *</label>
                        <select
                          className="filter-select"
                          style={{ width: '100%', padding: '0.65rem' }}
                          value={newAdminRole}
                          onChange={(e) => setNewAdminRole(e.target.value as any)}
                        >
                          <option value="admin">Administrator (Full Access)</option>
                          <option value="editor">Editor (Questions & Staging)</option>
                          <option value="reviewer">Reviewer (Syllabus & Quality)</option>
                          <option value="super_admin">Super Administrator</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="admin-btn admin-btn-primary"
                        style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
                        disabled={isCreatingUser}
                      >
                        <UserPlus size={16} />
                        <span>{isCreatingUser ? 'Creating Account...' : 'Create Admin Account'}</span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="admin-modal-footer">
                <button
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setIsUsersModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload / Replace Textbook Modal */}
      <AnimatePresence>
        {isUploadTextbookModalOpen && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ maxWidth: '640px' }}
            >
              <div className="admin-modal-header">
                <div>
                  <h2 className="admin-modal-title">
                    {replacingTextbookId
                      ? `Replace Textbook #${replacingTextbookId}`
                      : tbDuplicateInDb
                        ? `Update & Re-Index Textbook (#${tbDuplicateInDb.id})`
                        : 'Upload Samacheer Kalvi Textbook'}
                  </h2>
                  <p className="admin-modal-subtitle">
                    Classes 6–12 official syllabus textbooks with dynamic cascading selection and automatic book name generation.
                  </p>
                </div>
                <button
                  className="admin-modal-close"
                  onClick={() => {
                    setIsUploadTextbookModalOpen(false)
                    setReplacingTextbookId(null)
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUploadTextbook}>
                <div className="admin-modal-body">
                  {tbUploadError && (
                    <div
                      className="admin-toast-error"
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.88rem',
                      }}
                    >
                      <AlertTriangle size={16} />
                      <span>{tbUploadError}</span>
                    </div>
                  )}

                  {tbDuplicateInDb && (
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        background: 'rgba(234, 179, 8, 0.12)',
                        border: '1px solid rgba(234, 179, 8, 0.35)',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        fontSize: '0.84rem',
                        color: '#fef08a',
                      }}
                    >
                      <AlertTriangle size={18} style={{ color: '#fbbf24', flexShrink: 0 }} />
                      <div>
                        <strong>Existing Textbook Match (# {tbDuplicateInDb.id}):</strong> "{tbDuplicateInDb.bookName}" is currently indexed.
                        Uploading will overwrite and re-index this textbook.
                      </div>
                    </div>
                  )}

                  {/* 1. Group & 2. Standard */}
                  <div className="form-grid-2" style={{ marginBottom: '0.85rem' }}>
                    <div className="form-field">
                      <label>1. TNPSC Group *</label>
                      <select
                        className="filter-select"
                        style={{ width: '100%', padding: '0.65rem' }}
                        value={tbGroup}
                        onChange={(e) => handleTbGroupChange(e.target.value as any)}
                        required
                      >
                        <option value="group1">TNPSC Group 1</option>
                        <option value="group2">TNPSC Group 2/2A</option>
                        <option value="group4">TNPSC Group 4</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>2. Standard *</label>
                      <select
                        className="filter-select"
                        style={{ width: '100%', padding: '0.65rem' }}
                        value={tbStandard}
                        onChange={(e) => handleTbStandardChange(e.target.value as any)}
                        required
                      >
                        {STANDARDS_LIST.map((std) => (
                          <option key={std.id} value={std.id}>
                            {std.shortLabel} Standard
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 3. Subject & 4. Medium */}
                  <div className="form-grid-2" style={{ marginBottom: '0.85rem' }}>
                    <div className="form-field">
                      <label>3. Subject *</label>
                      <select
                        className="filter-select"
                        style={{ width: '100%', padding: '0.65rem' }}
                        value={tbSubject}
                        onChange={(e) => handleTbSubjectChange(e.target.value)}
                        required
                      >
                        {tbAvailableSubjects.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name} ({s.tamilName})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>4. Medium *</label>
                      <select
                        className="filter-select"
                        style={{ width: '100%', padding: '0.65rem' }}
                        value={tbMedium}
                        onChange={(e) => handleTbMediumChange(e.target.value as any)}
                        required
                      >
                        {tbAvailableMediums.map((m) => (
                          <option key={m} value={m}>
                            {m === 'Tamil' ? 'Tamil Medium' : 'English Medium'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 5. Term & 6. Book Name */}
                  <div className="form-grid-2" style={{ marginBottom: '0.85rem' }}>
                    <div className="form-field">
                      <label>5. Term / Volume *</label>
                      <select
                        className="filter-select"
                        style={{ width: '100%', padding: '0.65rem' }}
                        value={tbTerm}
                        onChange={(e) => handleTbTermChange(e.target.value)}
                        required
                      >
                        {tbAvailableTerms.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ margin: 0 }}>6. Book Name *</label>
                        {tbIsCustomBookName ? (
                          <button
                            type="button"
                            onClick={handleResetToAutoBookName}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--gold-primary)',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: 0,
                            }}
                            title="Reset to official Samacheer Kalvi naming format"
                          >
                            <RefreshCw size={11} />
                            <span>Reset to Auto Name</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle2 size={12} />
                            <span>Auto-Generated</span>
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        className="admin-auth-input"
                        style={{ width: '100%', padding: '0.65rem' }}
                        placeholder="e.g. Samacheer Kalvi 6th Standard - Tamil - Term 1 - Tamil Medium"
                        value={tbBookName}
                        onChange={(e) => {
                          setTbBookName(e.target.value)
                          setTbIsCustomBookName(true)
                        }}
                        required
                      />
                    </div>
                  </div>

                  {/* 7. PDF Upload Dropzone */}
                  <div className="form-field" style={{ marginTop: '0.5rem' }}>
                    <label>7. PDF Textbook File * (Max 100MB)</label>
                    <div
                      className="bulk-dropzone"
                      style={{ padding: '1.25rem', textAlign: 'center', cursor: 'pointer' }}
                      onClick={() => document.getElementById('tb-file-input')?.click()}
                    >
                      <UploadCloud size={28} style={{ color: 'var(--gold-primary)', margin: '0 auto 0.4rem' }} />
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem', fontSize: '0.9rem' }}>
                        {tbFile ? tbFile.name : 'Click to select Samacheer Kalvi PDF'}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 0 }}>
                        {tbFile
                          ? `${(tbFile.size / (1024 * 1024)).toFixed(2)} MB • PDF file selected`
                          : 'Supports searchable and scanned Tamil & English textbooks (OCR & syllabus mapping)'}
                      </p>
                      <input
                        id="tb-file-input"
                        type="file"
                        accept=".pdf,application/pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setTbFile(file)
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Upload Progress */}
                  {tbUploading && (
                    <div style={{ marginTop: '1rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem',
                          marginBottom: '0.25rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span>Uploading & Queuing Background Indexing...</span>
                        <span>{tbUploadProgress}%</span>
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: '6px',
                          background: 'rgba(255,255,255,0.1)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${tbUploadProgress}%`,
                            height: '100%',
                            background: 'var(--gold-primary)',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="admin-modal-footer">
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    onClick={() => {
                      setIsUploadTextbookModalOpen(false)
                      setReplacingTextbookId(null)
                    }}
                    disabled={tbUploading}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="admin-btn admin-btn-primary" disabled={tbUploading || !tbFile}>
                    {tbUploading ? (
                      <>
                        <RefreshCw size={15} className="spin-icon" />
                        <span>Uploading ({tbUploadProgress}%)...</span>
                      </>
                    ) : (
                      <>
                        {replacingTextbookId || tbDuplicateInDb ? <RefreshCw size={15} /> : <UploadCloud size={15} />}
                        <span>
                          {replacingTextbookId || tbDuplicateInDb
                            ? 'Replace & Index Textbook'
                            : 'Upload & Start Indexing'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Textbook Details & Excerpts Modal */}
      <AnimatePresence>
        {selectedTextbookDetail && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ maxWidth: '800px', maxHeight: '85vh' }}
            >
              <div className="admin-modal-header">
                <div>
                  <div className="admin-badge-row">
                    <span className="admin-badge">
                      <BookOpen size={13} />
                      {selectedTextbookDetail.standard} • {selectedTextbookDetail.subject}
                    </span>
                    <span className={`status-pill-${selectedTextbookDetail.status}`}>
                      {selectedTextbookDetail.status.toUpperCase()}
                    </span>
                  </div>
                  <h2 className="admin-modal-title">{selectedTextbookDetail.bookName}</h2>
                </div>
                <button className="admin-modal-close" onClick={() => setSelectedTextbookDetail(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                {/* Metadata summary */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.07)',
                    marginBottom: '1rem',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Group</div>
                    <div style={{ fontWeight: 600 }}>{selectedTextbookDetail.groupId?.toUpperCase()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Standard</div>
                    <div style={{ fontWeight: 600 }}>{selectedTextbookDetail.standard}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Medium</div>
                    <div style={{ fontWeight: 600 }}>{selectedTextbookDetail.medium}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Term</div>
                    <div style={{ fontWeight: 600 }}>{selectedTextbookDetail.term || 'Full Year'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Indexed Pages</div>
                    <div style={{ fontWeight: 600, color: 'var(--gold-primary)' }}>
                      {selectedTextbookDetail.pageCount || 0} pages
                    </div>
                  </div>
                </div>

                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Extracted Content Preview (Sample Passages)
                </h3>

                {isLoadingExcerpts ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading extracted pages...
                  </div>
                ) : textbookExcerpts.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {selectedTextbookDetail.status === 'processing'
                      ? 'Text extraction is currently running in background. Please refresh in a moment.'
                      : 'No extracted pages available for this textbook.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {textbookExcerpts.map((excerpt: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.75rem',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '6px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '0.35rem',
                            fontSize: '0.78rem',
                          }}
                        >
                          <span className="source-page-pill">
                            <BookOpen size={11} />
                            Page {excerpt.pageNumber || 'N/A'}
                            {excerpt.lessonTitle ? ` • ${excerpt.lessonTitle}` : ''}
                          </span>
                          {excerpt.isOcr && (
                            <span style={{ fontSize: '0.7rem', color: '#fbbf24' }}>OCR Extracted</span>
                          )}
                        </div>
                        <p
                          style={{
                            fontSize: '0.82rem',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.5,
                            margin: 0,
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {excerpt.content?.slice(0, 350)}...
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="admin-modal-footer">
                <button className="admin-btn admin-btn-secondary" onClick={() => setSelectedTextbookDetail(null)}>
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Textbook Confirmation Modal */}
      <AnimatePresence>
        {deletingTextbook && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ maxWidth: '480px' }}
            >
              <div className="admin-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171' }}>
                  <AlertTriangle size={20} />
                  <h2 className="admin-modal-title" style={{ color: '#f87171' }}>
                    Confirm Textbook Deletion
                  </h2>
                </div>
                <button className="admin-modal-close" onClick={() => setDeletingTextbook(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal-body">
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  Are you sure you want to permanently delete <strong>"{deletingTextbook.bookName}"</strong> (Class{' '}
                  {deletingTextbook.standard})?
                </p>
                <p
                  style={{
                    color: '#f87171',
                    fontSize: '0.8rem',
                    background: 'rgba(239,68,68,0.1)',
                    padding: '0.65rem',
                    borderRadius: '6px',
                    marginTop: '0.75rem',
                  }}
                >
                  Warning: This will delete the physical PDF file and all cascaded extracted textbook content from the database.
                </p>
              </div>

              <div className="admin-modal-footer">
                <button
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setDeletingTextbook(null)}
                  disabled={isDeletingTextbook}
                >
                  Cancel
                </button>
                <button
                  className="admin-btn"
                  style={{ background: '#ef4444', color: '#fff' }}
                  onClick={handleDeleteTextbook}
                  disabled={isDeletingTextbook}
                >
                  <Trash2 size={16} />
                  <span>{isDeletingTextbook ? 'Deleting...' : 'Delete Textbook'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cloud AI Study Notes & MCQ Generator Modal */}
      <CloudAiGeneratorModal
        isOpen={isCloudAiModalOpen}
        onClose={() => setIsCloudAiModalOpen(false)}
        token={token}
        initialMode={cloudAiModalMode}
        textbooksList={textbooksList}
        fetchTextbooks={fetchTextbooks}
        showToast={showToast}
        onRefreshData={() => {
          fetchQuestions()
          fetchNotes()
          fetchAllMetrics()
        }}
      />

      {/* 1. Add / Edit Study Note Modal */}
      <AnimatePresence>
        {isNotesEditModalOpen && editingNote && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal"
              style={{ maxWidth: '850px' }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="admin-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={20} style={{ color: 'var(--gold-primary)' }} />
                  <h3 className="admin-modal-title">
                    {editingNote.id ? `Edit Study Note #${editingNote.id}` : 'Add New Study Note'}
                  </h3>
                </div>
                <button
                  className="admin-modal-close"
                  onClick={() => {
                    setIsNotesEditModalOpen(false)
                    setEditingNote(null)
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                {/* Dynamic 5-Tier Syllabus Selector for Study Note */}
                {(() => {
                  const currentCat = (editingNote.category as any) || 'group2'
                  const currentClassId = editingNote.classId || 6
                  const subjects = getSubjectsForGroup(currentCat)
                  const currentSubj = subjects.find((s: any) => s.name === editingNote.subject || s.id === editingNote.subject) || subjects[0]
                  const currentSubjId = currentSubj?.id || 'general-studies'
                  const units = getUnitsForSubjectStandard(currentCat, currentSubjId, currentClassId)
                  const currentUnitObj = units.find((u: any) => u.id === editingNote.unitId) || units[0]
                  const currentUnitId = currentUnitObj?.id || 1
                  const lessons = getLessonsForSelection(currentCat, currentSubjId, currentClassId, currentUnitId)

                  return (
                    <>
                      <div className="form-grid-3" style={{ marginBottom: '0.75rem' }}>
                        <div className="ai-field">
                          <label>1. TNPSC Group *</label>
                          <select
                            className="ai-select"
                            value={currentCat}
                            onChange={(e) => {
                              const newCat = e.target.value as any
                              const newSubjects = getSubjectsForGroup(newCat)
                              const newSubj = newSubjects[0]
                              const newUnits = getUnitsForSubjectStandard(newCat, newSubj?.id || 'general-studies', currentClassId)
                              const newUnit = newUnits[0]
                              const newLessons = getLessonsForSelection(newCat, newSubj?.id || 'general-studies', currentClassId, newUnit?.id || 1)
                              const newLesson = newLessons[0]
                              setEditingNote({
                                ...editingNote,
                                category: newCat,
                                subject: newSubj?.name || 'General Studies',
                                unitId: newUnit?.id || 1,
                                lessonId: newLesson?.id || '',
                                lessonNumber: newLesson?.lessonNumber || '',
                                lessonTitle: newLesson?.title || '',
                              })
                            }}
                          >
                            {TNPSC_GROUPS.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name} ({g.code})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="ai-field">
                          <label>2. Subject *</label>
                          <select
                            className="ai-select"
                            value={currentSubj?.name || editingNote.subject}
                            onChange={(e) => {
                              const selectedSubjName = e.target.value
                              const matchedSubj = subjects.find((s: any) => s.name === selectedSubjName) || subjects[0]
                              const newUnits = getUnitsForSubjectStandard(currentCat, matchedSubj?.id || 'general-studies', currentClassId)
                              const newUnit = newUnits[0]
                              const newLessons = getLessonsForSelection(currentCat, matchedSubj?.id || 'general-studies', currentClassId, newUnit?.id || 1)
                              const newLesson = newLessons[0]
                              setEditingNote({
                                ...editingNote,
                                subject: matchedSubj?.name || selectedSubjName,
                                unitId: newUnit?.id || 1,
                                lessonId: newLesson?.id || '',
                                lessonNumber: newLesson?.lessonNumber || '',
                                lessonTitle: newLesson?.title || '',
                              })
                            }}
                          >
                            {subjects.map((s: any) => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="ai-field">
                          <label>3. Standard / Class *</label>
                          <select
                            className="ai-select"
                            value={currentClassId}
                            onChange={(e) => {
                              const newClassId = Number(e.target.value) || 6
                              const newUnits = getUnitsForSubjectStandard(currentCat, currentSubjId, newClassId)
                              const newUnit = newUnits[0]
                              const newLessons = getLessonsForSelection(currentCat, currentSubjId, newClassId, newUnit?.id || 1)
                              const newLesson = newLessons[0]
                              setEditingNote({
                                ...editingNote,
                                classId: newClassId,
                                unitId: newUnit?.id || 1,
                                lessonId: newLesson?.id || '',
                                lessonNumber: newLesson?.lessonNumber || '',
                                lessonTitle: newLesson?.title || '',
                              })
                            }}
                          >
                            {[6, 7, 8, 9, 10, 11, 12].map((std) => (
                              <option key={std} value={std}>{std}th Standard</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="form-grid-3" style={{ marginBottom: '0.75rem' }}>
                        <div className="ai-field">
                          <label>4. Unit *</label>
                          <select
                            className="ai-select"
                            value={currentUnitId}
                            onChange={(e) => {
                              const newUnitId = Number(e.target.value) || 1
                              const newLessons = getLessonsForSelection(currentCat, currentSubjId, currentClassId, newUnitId)
                              const newLesson = newLessons[0]
                              setEditingNote({
                                ...editingNote,
                                unitId: newUnitId,
                                lessonId: newLesson?.id || '',
                                lessonNumber: newLesson?.lessonNumber || '',
                                lessonTitle: newLesson?.title || '',
                              })
                            }}
                          >
                            {units.map((u: any) => (
                              <option key={u.id} value={u.id}>
                                {u.unitNumber ? `Unit ${u.unitNumber}: ` : ''}{u.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="ai-field">
                          <label>5. Lesson Selection (Exact Lesson) *</label>
                          <select
                            className="ai-select"
                            value={editingNote.lessonId || editingNote.lessonTitle || ''}
                            onChange={(e) => {
                              const chosen = e.target.value
                              const matched = lessons.find((l: any) => l.id === chosen) || lessons.find((l: any) => l.title === chosen)
                              setEditingNote({
                                ...editingNote,
                                lessonId: matched?.id || (chosen.startsWith('gt-') || chosen.startsWith('gs-') ? chosen : ''),
                                lessonNumber: matched?.lessonNumber || '',
                                lessonTitle: matched?.title || chosen,
                              })
                            }}
                          >
                            <option value="" disabled>-- Select Lesson ({lessons.length} available) --</option>
                            {lessons.map((l: any) => (
                              <option key={l.id} value={l.id}>
                                {l.lessonNumber ? `Lesson ${l.lessonNumber} – ` : ''}{l.title}
                              </option>
                            ))}
                            {editingNote.lessonTitle && !lessons.some((l: any) => l.id === editingNote.lessonId || l.title === editingNote.lessonTitle) && (
                              <option value={editingNote.lessonTitle}>
                                {editingNote.lessonNumber ? `Lesson ${editingNote.lessonNumber} – ` : ''}{editingNote.lessonTitle}
                              </option>
                            )}
                          </select>
                        </div>

                        <div className="ai-field">
                          <label>Language *</label>
                          <select
                            className="ai-select"
                            value={editingNote.language || 'tamil'}
                            onChange={(e) => setEditingNote({ ...editingNote, language: e.target.value })}
                          >
                            <option value="tamil">Tamil (தமிழ்)</option>
                            <option value="english">English</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )
                })()}

                <div className="form-grid-2" style={{ marginBottom: '0.75rem' }}>
                  <div className="ai-field">
                    <label>Note Title *</label>
                    <input
                      type="text"
                      className="admin-auth-input"
                      value={editingNote.title || ''}
                      onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                      placeholder="Chapter / Topic Title"
                    />
                  </div>

                  <div className="ai-field">
                    <label>Publication Status</label>
                    <select
                      className="ai-select"
                      value={editingNote.status || 'staging'}
                      onChange={(e) => setEditingNote({ ...editingNote, status: e.target.value })}
                    >
                      <option value="staging">Staging (Under Review)</option>
                      <option value="published">Published (Live on Website)</option>
                    </select>
                  </div>
                </div>

                <div className="ai-field" style={{ marginBottom: '0.75rem' }}>
                  <label>Textbook Source Reference</label>
                  <input
                    type="text"
                    className="admin-auth-input"
                    value={editingNote.sourceReference || ''}
                    onChange={(e) => setEditingNote({ ...editingNote, sourceReference: e.target.value })}
                    placeholder="e.g. Samacheer Kalvi 6th Standard Tamil, Pages 9–26"
                  />
                </div>

                <div className="ai-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ margin: 0 }}>Note Content (Markdown Format) *</label>
                    <div style={{ display: 'inline-flex', padding: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px' }}>
                      <button
                        type="button"
                        style={{
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.75rem',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          background: notesPreviewTab === 'edit' ? 'var(--gold-primary)' : 'transparent',
                          color: notesPreviewTab === 'edit' ? '#000' : 'var(--text-secondary)',
                          fontWeight: 600,
                        }}
                        onClick={() => setNotesPreviewTab('edit')}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        style={{
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.75rem',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          background: notesPreviewTab === 'preview' ? 'var(--gold-primary)' : 'transparent',
                          color: notesPreviewTab === 'preview' ? '#000' : 'var(--text-secondary)',
                          fontWeight: 600,
                        }}
                        onClick={() => setNotesPreviewTab('preview')}
                      >
                        Preview
                      </button>
                    </div>
                  </div>

                  {notesPreviewTab === 'edit' ? (
                    <textarea
                      className="ai-textarea"
                      rows={12}
                      style={{
                        fontFamily: "'Noto Sans Tamil', 'Inter', system-ui, -apple-system, sans-serif",
                        fontSize: '0.92rem',
                        lineHeight: 1.85,
                        letterSpacing: 'normal',
                      }}
                      value={editingNote.content || ''}
                      onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                      placeholder="Write markdown note content (Short notes, tables, facts)..."
                    />
                  ) : (
                    <div style={{
                      padding: '1rem',
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      maxHeight: '350px',
                      overflowY: 'auto',
                      fontSize: '0.92rem',
                      lineHeight: 1.85,
                      letterSpacing: 'normal',
                      whiteSpace: 'pre-wrap',
                      fontFamily: "'Noto Sans Tamil', 'Inter', system-ui, sans-serif"
                    }}>
                      {editingNote.content ? cleanTamilUnicodeText(editingNote.content) : 'No content written yet.'}
                    </div>
                  )}
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => {
                    setIsNotesEditModalOpen(false)
                    setEditingNote(null)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={handleSaveNote}
                >
                  <Check size={16} />
                  <span>{editingNote.id ? 'Save Changes' : 'Create Study Note'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Full Note Preview Modal */}
      <AnimatePresence>
        {previewingNote && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal"
              style={{ maxWidth: '900px' }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="admin-modal-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span className="qid-badge">#{previewingNote.id}</span>
                    <span className={`status-badge ${previewingNote.status === 'published' ? 'status-published' : 'status-staging'}`}>
                      {previewingNote.status === 'published' ? <CheckCircle size={12} /> : <Clock size={12} />}
                      {previewingNote.status}
                    </span>
                    <span className="ai-tag-pill ai-tag-group">{previewingNote.category?.toUpperCase()}</span>
                    {previewingNote.lessonNumber && (
                      <span className="ai-tag-pill" style={{ color: 'var(--gold-primary)', borderColor: 'rgba(255, 215, 0, 0.4)', fontWeight: 700 }}>
                        Lesson {previewingNote.lessonNumber}
                      </span>
                    )}
                    <span className="ai-tag-pill">Unit {previewingNote.unitId}</span>
                    <span className="ai-tag-pill">Class {previewingNote.classId || '6'}</span>
                    <span className="ai-tag-pill">{previewingNote.subject}</span>
                  </div>
                  <h3 className="admin-modal-title" style={{ fontSize: '1.15rem' }}>
                    {previewingNote.title || previewingNote.lessonTitle}
                  </h3>
                </div>
                <button className="admin-modal-close" onClick={() => setPreviewingNote(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                {previewingNote.sourceReference && (
                  <div style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(255,215,0,0.08)', borderRadius: '6px', border: '1px solid rgba(255,215,0,0.2)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#fef08a' }}>
                    <BookOpen size={14} />
                    <span><strong>Source Reference:</strong> {previewingNote.sourceReference}</span>
                  </div>
                )}
                {previewingNote.coverageReport && (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 600 }}>
                      <CheckCircle size={15} />
                      <span>Textbook Coverage: {previewingNote.coverageReport.statusVerdict} ({previewingNote.coverageReport.completionPercentage}%)</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                      {previewingNote.coverageReport.processedPages?.length || 0} Pages Covered | {previewingNote.coverageReport.topicsCovered?.length || 0} Topics Verified
                    </div>
                  </div>
                )}
                <div style={{
                  padding: '1.25rem',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  maxHeight: '520px',
                  overflowY: 'auto',
                }}>
                  <TamilStudyNotesRenderer content={previewingNote.content} showLessonHeader={true} />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setPreviewingNote(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => {
                    const toEdit = { ...previewingNote }
                    setPreviewingNote(null)
                    setEditingNote(toEdit)
                    setNotesPreviewTab('edit')
                    setIsNotesEditModalOpen(true)
                  }}
                >
                  <Edit2 size={15} />
                  <span>Edit Note</span>
                </button>
                <button
                  type="button"
                  className={`admin-btn ${previewingNote.status === 'published' ? 'admin-btn-secondary' : 'admin-btn-primary'}`}
                  onClick={async () => {
                    await handleTogglePublishNote(previewingNote)
                    setPreviewingNote((prev: any) => prev ? { ...prev, status: prev.status === 'published' ? 'staging' : 'published' } : null)
                  }}
                >
                  {previewingNote.status === 'published' ? <Clock size={15} /> : <CheckCircle size={15} />}
                  <span>{previewingNote.status === 'published' ? 'Revert to Staging' : 'Publish Live to Website'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Bulk Publish Study Notes Confirmation Modal */}
      <AnimatePresence>
        {isNotesBulkPublishModalOpen && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal"
              style={{ maxWidth: '600px' }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="admin-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={20} style={{ color: '#10b981' }} />
                  <h3 className="admin-modal-title">Bulk Publish Study Notes</h3>
                </div>
                <button className="admin-modal-close" onClick={() => setIsNotesBulkPublishModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal-body">
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  You have selected <strong>{selectedStagingNoteIds.length}</strong> study note(s) currently in <strong>Staging</strong>. Publishing them will make them immediately live and visible to students in <strong>Study Materials → Read Study Notes</strong>.
                </p>

                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  border: '1px solid rgba(255,255,255,0.06)',
                  marginBottom: '1rem'
                }}>
                  {notesList.filter(n => selectedStagingNoteIds.includes(n.id)).map(n => (
                    <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.82rem' }}>
                      <span>#{n.id} {n.title}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{n.lessonTitle}</span>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '0.75rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '6px', fontSize: '0.8rem', color: '#6ee7b7' }}>
                  ✓ Notes will appear strictly under their corresponding Group → Subject → Standard → Unit → Lesson hierarchy in Study Materials.
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setIsNotesBulkPublishModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-btn admin-bulk-publish-btn"
                  disabled={isNotesBulkPublishing}
                  onClick={handleBulkPublishNotes}
                >
                  <span>{isNotesBulkPublishing ? 'Publishing...' : `Confirm & Publish (${selectedStagingNoteIds.length})`}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Bulk Upload Study Notes Modal */}
      <AnimatePresence>
        {isNotesBulkUploadModalOpen && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal"
              style={{ maxWidth: '750px' }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="admin-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Upload size={20} style={{ color: 'var(--gold-primary)' }} />
                  <h3 className="admin-modal-title">Bulk Upload Study Notes</h3>
                </div>
                <button className="admin-modal-close" onClick={() => setIsNotesBulkUploadModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal-body">
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                  Paste a JSON array of study notes or formatted chapter markdown. All uploaded notes will enter <strong>Staging</strong> for your review and approval before publishing.
                </p>

                <div className="ai-field" style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <label>JSON Data or Markdown Chapters *</label>
                    {notesBulkParsedCount !== null && (
                      <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>
                        ✓ {notesBulkParsedCount} note(s) detected
                      </span>
                    )}
                  </div>
                  <textarea
                    className="ai-textarea"
                    rows={10}
                    style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                    value={notesBulkRawText}
                    onChange={(e) => {
                      setNotesBulkRawText(e.target.value)
                      parseBulkNotesContent(e.target.value)
                    }}
                    placeholder={`[
  {
    "title": "Measurements and SI Units",
    "lessonTitle": "1.1 Measurements and SI Units",
    "unitId": 1,
    "classId": 6,
    "subject": "General Studies",
    "category": "group1",
    "language": "tamil",
    "content": "CHAPTER 1: Measurements and SI Units\\n\\nSECTION 1: IMPORTANT ONE-LINER NOTES\\n1. Fundamental units...",
    "sourceReference": "Samacheer Kalvi 6th Standard, Pages 9-26"
  }
]`}
                  />
                  {notesBulkParseError && (
                    <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.35rem' }}>
                      {notesBulkParseError}
                    </div>
                  )}
                </div>

                <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  💡 <strong>Tip:</strong> All uploaded records enter Staging and can be individually edited, previewed, approved, and published to Study Materials.
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setIsNotesBulkUploadModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  disabled={!notesBulkRawText.trim() || isNotesBulkUploading}
                  onClick={handleBulkUploadNotes}
                >
                  <Upload size={16} />
                  <span>{isNotesBulkUploading ? 'Uploading...' : `Upload to Staging (${notesBulkParsedCount || 0})`}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Delete Single Study Note Confirmation Modal */}
      <AnimatePresence>
        {isDeletingNote && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal"
              style={{ maxWidth: '500px' }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="admin-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={20} style={{ color: '#ef4444' }} />
                  <h3 className="admin-modal-title">Delete Study Note</h3>
                </div>
                <button className="admin-modal-close" onClick={() => setIsDeletingNote(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal-body">
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  Are you sure you want to permanently delete Study Note <strong>#{isDeletingNote.id}</strong> ({isDeletingNote.title || isDeletingNote.lessonTitle})?
                </p>
                <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: 0 }}>
                  This action cannot be undone and will permanently remove this note from PostgreSQL.
                </p>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setIsDeletingNote(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  style={{ background: '#ef4444', color: '#fff' }}
                  onClick={handleDeleteSingleNote}
                >
                  <Trash2 size={16} />
                  <span>Delete Permanently</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Google Drive Resumable PDF Upload Modal */}
      <AnimatePresence>
        {isDriveUploadModalOpen && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal"
              style={{ maxWidth: '640px' }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="admin-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <UploadCloud size={20} style={{ color: '#ffd700' }} />
                  <h3 className="admin-modal-title">Upload PDF to Google Drive</h3>
                </div>
                <button
                  className="admin-modal-close"
                  onClick={() => {
                    if (!isDriveUploading) setIsDriveUploadModalOpen(false)
                  }}
                  disabled={isDriveUploading}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleStartDriveUpload}>
                <div className="admin-modal-body">
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(255, 215, 0, 0.08)', borderRadius: '8px', border: '1px solid rgba(255, 215, 0, 0.25)', fontSize: '0.8rem', color: '#fef08a', marginBottom: '1.25rem' }}>
                    ⚡ <strong>Zero Vercel Limits:</strong> Large textbook PDFs stream directly from your browser to Google Drive via authorized resumable sessions. No serverless payload limits apply.
                  </div>

                  {/* Syllabus Cascade Selector */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      1. Syllabus Mapping (Group &rarr; Subject &rarr; Class &rarr; Unit &rarr; Lesson) *
                    </label>
                    <SyllabusCascadeSelector cascade={driveSyllabusCascade} />
                  </div>

                  {/* Material Title & Term */}
                  <div className="form-grid-2" style={{ marginBottom: '1rem' }}>
                    <div className="form-field">
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        2. Material Title
                      </label>
                      <input
                        type="text"
                        className="filter-select"
                        style={{ width: '100%', padding: '0.65rem' }}
                        placeholder="e.g. Standard 10 Science Unit 1 Full Textbook"
                        value={driveUploadTitle}
                        onChange={(e) => setDriveUploadTitle(e.target.value)}
                        disabled={isDriveUploading}
                      />
                    </div>

                    <div className="form-field">
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        3. Term / Volume
                      </label>
                      <select
                        className="filter-select"
                        style={{ width: '100%', padding: '0.65rem' }}
                        value={driveUploadTerm}
                        onChange={(e) => setDriveUploadTerm(e.target.value)}
                        disabled={isDriveUploading}
                      >
                        <option value="Term 1">Term 1</option>
                        <option value="Term 2">Term 2</option>
                        <option value="Term 3">Term 3</option>
                        <option value="Full Year">Full Year</option>
                      </select>
                    </div>
                  </div>

                  {/* File Selector */}
                  <div className="form-field" style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      4. Select PDF Textbook / Study Material (.pdf only) *
                    </label>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      disabled={isDriveUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        setDriveFile(file)
                        if (file && !driveUploadTitle.trim()) {
                          setDriveUploadTitle(file.name.replace(/\.pdf$/i, ''))
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px dashed rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        cursor: 'pointer',
                      }}
                    />
                    {driveFile && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CheckCircle size={14} /> Selected: {driveFile.name} ({(driveFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </div>
                    )}
                  </div>

                  {/* Progress Box during direct resumable streaming */}
                  {isDriveUploading && (
                    <div className="gdrive-resumable-progress-box">
                      <div className="gdrive-progress-step-text">
                        <span>{driveUploadStep}</span>
                        <strong style={{ color: '#ffd700' }}>{driveUploadProgress}%</strong>
                      </div>
                      <div className="gdrive-progress-bar-track" style={{ marginTop: '0.6rem' }}>
                        <div
                          className="gdrive-progress-bar-fill"
                          style={{ width: `${driveUploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {driveUploadError && (
                    <div style={{ marginTop: '0.85rem', padding: '0.65rem 0.85rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '6px', color: '#fca5a5', fontSize: '0.82rem' }}>
                      ⚠️ {driveUploadError}
                    </div>
                  )}
                </div>

                <div className="admin-modal-footer">
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    onClick={() => setIsDriveUploadModalOpen(false)}
                    disabled={isDriveUploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={!driveFile || isDriveUploading}
                    style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ffd700 100%)', color: '#000', fontWeight: 700 }}
                  >
                    <UploadCloud size={16} />
                    <span>{isDriveUploading ? 'Streaming to Drive...' : 'Start Resumable Upload'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. Delete Google Drive Material Confirmation Modal */}
      <AnimatePresence>
        {deletingDriveMaterial && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal"
              style={{ maxWidth: '500px' }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="admin-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={20} style={{ color: '#ef4444' }} />
                  <h3 className="admin-modal-title">Delete Google Drive Material</h3>
                </div>
                <button
                  className="admin-modal-close"
                  onClick={() => {
                    if (!isDeletingDriveMaterial) setDeletingDriveMaterial(null)
                  }}
                  disabled={isDeletingDriveMaterial}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal-body">
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  Are you sure you want to permanently delete <strong>"{deletingDriveMaterial.fileName}"</strong>?
                </p>
                <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.25)', fontSize: '0.8rem', color: '#fca5a5' }}>
                  ⚠️ This action will permanently remove the file from your Google Drive ("TNPSC Study Hub Materials") and remove its metadata record from PostgreSQL.
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setDeletingDriveMaterial(null)}
                  disabled={isDeletingDriveMaterial}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  style={{ background: '#ef4444', color: '#fff' }}
                  disabled={isDeletingDriveMaterial}
                  onClick={() => handleDeleteDriveMaterial(deletingDriveMaterial.id)}
                >
                  <Trash2 size={16} />
                  <span>{isDeletingDriveMaterial ? 'Deleting...' : 'Delete Permanently'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. Google Drive PDF Reader Modal */}
      <GoogleDrivePdfViewer
        isOpen={Boolean(viewingDriveMaterial)}
        material={viewingDriveMaterial}
        onClose={() => setViewingDriveMaterial(null)}
      />

    </div>
  )
}

export default Admin
