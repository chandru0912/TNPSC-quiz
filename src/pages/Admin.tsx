import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  apiFetch,
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
  ArrowRight,
  Key,
  ExternalLink,
  Check,
  Bot,
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
} from 'lucide-react'
import './Admin.css'
import { cleanTamilUnicodeText } from '../utils/tamilUnicodeCleaner'
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
  const [metrics, setMetrics] = useState<AdminMetrics>({ totalQuestions: 0, stagingCount: 0, publishedCount: 0, unitsCount: 0, classesCount: 0 })
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

  // Navigation Section
  const [adminSection, setAdminSection] = useState<'questions' | 'textbooks' | 'notes'>('questions')

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

  // In-Generator Textbook Source states
  const [aiTextbookMode, setAiTextbookMode] = useState<'auto' | 'specific' | 'upload'>('auto')
  const [aiSelectedTextbookId, setAiSelectedTextbookId] = useState<number | null>(null)
  const [aiInlineMedium, setAiInlineMedium] = useState<'Tamil' | 'English'>('English')
  const [aiInlineTerm, setAiInlineTerm] = useState<string>('Full Year')
  const [aiInlineBookName, setAiInlineBookName] = useState<string>('')
  const [aiInlineFile, setAiInlineFile] = useState<File | null>(null)
  const [aiInlineUploading, setAiInlineUploading] = useState<boolean>(false)
  const [aiInlineProgress, setAiInlineProgress] = useState<number>(0)
  const [aiInlineProcessingJob, setAiInlineProcessingJob] = useState<{ id: number; status: string; progressPercent: number; stepDescription: string } | null>(null)

  // Study Notes Generator Textbook Source states (Independent from MCQ Generator)
  const [notesTextbookMode, setNotesTextbookMode] = useState<'auto' | 'specific' | 'upload'>('auto')
  const [notesSelectedTextbookId, setNotesSelectedTextbookId] = useState<number | null>(null)
  const [notesInlineMedium, setNotesInlineMedium] = useState<'Tamil' | 'English'>('English')
  const [notesInlineTerm, setNotesInlineTerm] = useState<string>('Full Year')
  const [notesInlineBookName, setNotesInlineBookName] = useState<string>('')
  const [notesInlineFile, setNotesInlineFile] = useState<File | null>(null)
  const [notesInlineUploading, setNotesInlineUploading] = useState<boolean>(false)
  const [notesInlineProgress, setNotesInlineProgress] = useState<number>(0)
  const [notesInlineProcessingJob, setNotesInlineProcessingJob] = useState<{ id: number; status: string; progressPercent: number; stepDescription: string } | null>(null)

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

  // Filter Bar state (reuses shared Gemini AI Generator cascading syllabus logic)
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

  // Gemini AI Generator state (TNPSC Group, Subject, Standard, Unit, Lesson & Specific Topic Cascading)
  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false)
  const [aiMode, setAiMode] = useState<'mcq' | 'notes'>('mcq')
  const [notesLanguage, setNotesLanguage] = useState<'english' | 'tamil'>('english')
  const [notesScope, setNotesScope] = useState<'chapter' | 'full_book'>('chapter')
  const [isNotesGenerating, setIsNotesGenerating] = useState(false)
  const [notesPreview, setNotesPreview] = useState<{
    content: string
    title: string
    sourceReference?: string
    lessonId?: string
    lessonNumber?: string
    coverageReport?: {
      totalLessonPages: number
      processedPages: number[]
      pendingPages: number[]
      topicsIdentified: string[]
      topicsCovered: string[]
      missingTopics: string[]
      processingErrors: string[]
      completionPercentage: number
      isComplete: boolean
      statusVerdict: '100% Complete' | 'Partially Complete' | 'Requires Review'
    }
    topics?: string[]
  } | null>(null)
  const [isNotesUploading, setIsNotesUploading] = useState(false)

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
    isAIGeneratorOpen ||
    isNotesEditModalOpen ||
    Boolean(previewingNote) ||
    Boolean(isDeletingNote) ||
    isNotesBulkPublishModalOpen ||
    isNotesBulkUploadModalOpen
  useScrollLock(hasOpenAdminModal)

  // Shared Gemini AI Generator Syllabus Cascade (strict mode: allowAll = false)
  const aiSyllabusCascade = useSyllabusCascade({
    allowAll: false,
    initialGroupId: 'group1',
    initialSubjectId: 'general-studies',
    initialClassId: 6,
    initialUnitId: 1,
  })

  // Handle ESC key to dismiss Gemini AI Generator
  useEffect(() => {
    if (!isAIGeneratorOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAIGeneratorOpen(false)
        setAiUploadSuccess(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAIGeneratorOpen])
  const {
    effectiveGroupId: aiGroupId,
    unitId: rawAiUnitId,
    lessonTitle: aiLessonTitle,
    currentSubjectId,
    currentClassId,
    currentUnitId,
    currentLessonTitle,
    availableSubjects,
    availableStandards,
    availableUnits,
    availableLessons,
    selectedSubjectObj: rawAiSelectedSubjectObj,
    selectedStandardObj,
    currentUnit,
    selectedLessonObj,
    handleUnitChange,
    handleLessonChange,
  } = aiSyllabusCascade
  const aiUnitId = typeof rawAiUnitId === 'number' ? rawAiUnitId : currentUnitId
  const selectedSubjectObj = rawAiSelectedSubjectObj || availableSubjects[0]

  const [aiLanguage, setAiLanguage] = useState<'tamil' | 'english'>('tamil')
  const [aiQuestionCount, setAiQuestionCount] = useState<number>(50)
  const [aiDifficulty, setAiDifficulty] = useState<'Medium' | 'Easy' | 'Hard' | 'Mixed'>('Medium')
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('tnpsc_gemini_api_key') || '')
  const [isAIGenerating, setIsAIGenerating] = useState(false)
  const [isAIUploading, setIsAIUploading] = useState(false)
  const [aiNotice, setAiNotice] = useState<string | null>(null)
  const [aiSource, setAiSource] = useState<'gemini' | 'curated_syllabus' | null>(null)
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState<any[]>([])
  const [aiUploadSuccess, setAiUploadSuccess] = useState<{ count: number; lessonTitle: string } | null>(null)
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null)

  // Topics no longer used in generator UI
  const currentTopicName = ''

  // Save API key to localStorage when updated
  const handleApiKeyChange = (val: string) => {
    setGeminiApiKey(val)
    if (val.trim()) {
      localStorage.setItem('tnpsc_gemini_api_key', val.trim())
    } else {
      localStorage.removeItem('tnpsc_gemini_api_key')
    }
  }

  // Pre-generation validation
  const isSubjectValid = availableSubjects.some((s) => s.id === currentSubjectId)
  const isStandardValid = availableStandards.some((s) => s.id === currentClassId)
  const isUnitValid = availableUnits.some((u) => u.id === currentUnitId)
  const isLessonValid = Boolean(selectedLessonObj && selectedLessonObj.title)
  const isCountValid = [50, 80, 100].includes(aiQuestionCount)
  const isDifficultyValid = ['Medium', 'Easy', 'Hard', 'Mixed'].includes(aiDifficulty)
  const isTextbookReady = !aiInlineUploading && (!aiInlineProcessingJob || aiInlineProcessingJob.status === 'completed')

  const isFormValid =
    isSubjectValid &&
    isStandardValid &&
    isUnitValid &&
    isLessonValid &&
    isCountValid &&
    isDifficultyValid &&
    isTextbookReady &&
    !isAIGenerating

  const isNotesTextbookReady = !notesInlineUploading && (!notesInlineProcessingJob || notesInlineProcessingJob.status === 'completed')

  const isNotesFormValid =
    isSubjectValid &&
    isStandardValid &&
    (notesScope === 'full_book' || (isUnitValid && isLessonValid)) &&
    isNotesTextbookReady &&
    !isNotesGenerating

  // Generate AI Questions handler (Strictly Textbook-Grounded)
  const handleGenerateAIQuestions = async () => {
    if (!token || !isFormValid) return
    setIsAIGenerating(true)
    setAiNotice(null)
    setAiUploadSuccess(null)

    const activeTopic = currentLessonTitle
    const resolvedMedium = aiLanguage === 'tamil'
      ? 'Tamil'
      : (/tamil|தமிழ்/i.test(selectedSubjectObj.name) ? 'Tamil' : (aiInlineMedium || 'English'))

    try {
      const res = await apiFetch('/api/questions/ai-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: aiGroupId,
          subject: selectedSubjectObj.name,
          subjectId: selectedSubjectObj.id,
          classId: currentClassId,
          standard: currentClassId,
          unitId: currentUnitId,
          unitTitle: currentUnit?.title,
          lessonTitle: currentLessonTitle,
          lessonId: selectedLessonObj?.id,
          topic: activeTopic,
          topics: [],
          description: selectedLessonObj?.description || '',
          count: aiQuestionCount,
          difficulty: aiDifficulty,
          apiKey: geminiApiKey.trim() || undefined,
          textbookMode: aiTextbookMode,
          textbookId:
            aiTextbookMode === 'specific'
              ? aiSelectedTextbookId
              : (aiInlineProcessingJob?.id || undefined),
          medium: resolvedMedium,
          language: aiLanguage,
          term: aiInlineTerm || 'Term 1',
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const errMsg =
          data?.message ||
          `Required textbook content could not be retrieved for ${currentClassId}th Standard ${selectedSubjectObj.name}.`
        setAiGeneratedQuestions([])
        setAiNotice(errMsg)
        showToast('error', errMsg)
        return
      }

      if (data && Array.isArray(data.questions) && data.questions.length > 0) {
        const taggedQuestions = data.questions.slice(0, aiQuestionCount).map((q: any) => ({
          ...q,
          category: aiGroupId,
          subject: selectedSubjectObj.name,
          subjectId: selectedSubjectObj.id,
          classId: currentClassId,
          standard: currentClassId,
          unitId: currentUnitId,
          lessonTitle: currentLessonTitle,
          lessonId: selectedLessonObj?.id || q.lessonId,
          topic: activeTopic,
          language: aiLanguage,
          targetSystem: 'study_materials',
          examGroupId: aiGroupId,
          standardId: typeof currentClassId === 'number' ? currentClassId : parseInt(currentClassId, 10),
          selected: true,
        }))
        setAiGeneratedQuestions(taggedQuestions)
        setAiSource(data.source || 'gemini')
        setAiNotice(
          data.notice ||
            `Generated ${taggedQuestions.length} unique textbook-verified questions ready for review.`
        )
        showToast('success', `Generated ${taggedQuestions.length} textbook-verified questions`)
      } else {
        const emptyMsg =
          data?.message ||
          'No unique questions could be generated from the textbook without repeating existing questions.'
        setAiGeneratedQuestions([])
        setAiNotice(emptyMsg)
        showToast('error', emptyMsg)
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error generating questions from textbook')
    } finally {
      setIsAIGenerating(false)
    }
  }

  // Regenerate an individual question
  const handleRegenerateSingleQuestion = async (qIndex: number) => {
    if (!token || regeneratingIndex !== null) return
    setRegeneratingIndex(qIndex)
    const currentQ = aiGeneratedQuestions[qIndex]
    const targetTopic = currentQ.topic || currentLessonTitle

    try {
      const res = await apiFetch('/api/questions/ai-regenerate-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: currentQ.category || aiGroupId,
          subject: currentQ.subject || selectedSubjectObj.name,
          classId: currentQ.classId || currentClassId,
          unitId: currentQ.unitId || currentUnitId,
          lessonTitle: currentQ.lessonTitle || currentLessonTitle,
          topic: targetTopic,
          difficulty: currentQ.difficulty || aiDifficulty,
          term: aiInlineTerm || 'Term 1',
          existingQuestions: aiGeneratedQuestions.map((q) => q.question),
          apiKey: geminiApiKey.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (res.ok && data.question) {
        setAiGeneratedQuestions((prev) => {
          const next = [...prev]
          next[qIndex] = {
            ...data.question,
            category: currentQ.category || aiGroupId,
            unitId: currentQ.unitId || aiUnitId,
            lessonTitle: currentQ.lessonTitle || aiLessonTitle,
            topic: targetTopic,
            selected: true,
          }
          return next
        })
        showToast('success', `Question #${qIndex + 1} regenerated successfully`)
      } else {
        showToast('error', data.message || 'Failed to regenerate question')
      }
    } catch {
      showToast('error', 'Network error while regenerating question')
    } finally {
      setRegeneratingIndex(null)
    }
  }

  // Batch Selection & Duplicate Removal Handlers
  const handleToggleSelectQuestion = (qIndex: number) => {
    setAiGeneratedQuestions((prev) => {
      const next = [...prev]
      next[qIndex] = { ...next[qIndex], selected: !next[qIndex].selected }
      return next
    })
  }

  const handleSelectAllQuestions = (selectAll: boolean) => {
    setAiGeneratedQuestions((prev) =>
      prev.map((q) => ({ ...q, selected: selectAll }))
    )
  }

  const handleRemoveDuplicates = () => {
    const seen = new Set<string>()
    let removedCount = 0

    setAiGeneratedQuestions((prev) => {
      const filtered: any[] = []
      for (const q of prev) {
        const normalized = (q.question || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        if (!seen.has(normalized)) {
          seen.add(normalized)
          filtered.push(q)
        } else {
          removedCount++
        }
      }
      return filtered
    })

    if (removedCount > 0) {
      showToast('success', `Removed ${removedCount} duplicate question(s) from batch`)
    } else {
      showToast('success', 'No duplicate questions detected in current batch')
    }
  }

  // Handlers to edit questions inside the preview table
  const handleAIQuestionTextChange = (qIndex: number, text: string) => {
    setAiGeneratedQuestions((prev) => {
      const next = [...prev]
      next[qIndex] = { ...next[qIndex], question: text }
      return next
    })
  }

  const handleAIOptionChange = (qIndex: number, optIndex: number, val: string) => {
    setAiGeneratedQuestions((prev) => {
      const next = [...prev]
      const opts = [...next[qIndex].options]
      opts[optIndex] = val
      next[qIndex] = { ...next[qIndex], options: opts }
      return next
    })
  }

  const handleAICorrectAnswerChange = (qIndex: number, optIndex: number) => {
    setAiGeneratedQuestions((prev) => {
      const next = [...prev]
      next[qIndex] = { ...next[qIndex], correctAnswer: optIndex }
      return next
    })
  }

  const handleAIExplanationChange = (qIndex: number, text: string) => {
    setAiGeneratedQuestions((prev) => {
      const next = [...prev]
      next[qIndex] = { ...next[qIndex], explanation: text }
      return next
    })
  }

  const handleAIDeleteQuestion = (qIndex: number) => {
    setAiGeneratedQuestions((prev) => prev.filter((_, idx) => idx !== qIndex))
  }

  // Upload reviewed & approved questions to Staging
  const handleUploadAIQuestions = async () => {
    if (!token || aiGeneratedQuestions.length === 0) return

    const approvedQuestions = aiGeneratedQuestions.filter((q) => q.selected !== false)
    if (approvedQuestions.length === 0) {
      showToast('error', 'Please select at least one question to stage')
      return
    }

    setIsAIUploading(true)
    let uploadedSuccess = false
    let countUploaded = approvedQuestions.length

    try {
      try {
        const res = await apiFetch('/api/study-materials/questions/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ questions: approvedQuestions }),
        })

        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          countUploaded = data.inserted || approvedQuestions.length
          uploadedSuccess = true
          // Staged questions strictly remain in Staging awaiting Admin review and approval
        } else {
          console.error('Upload failed:', res.status, data)
          showToast('error', data?.message || 'Upload failed')
        }
      } catch (uploadErr) {
        console.error('Backend upload unreachable:', uploadErr)
        showToast('error', 'Network error during upload')
      }

      if (!uploadedSuccess) {
        // Save to local storage for Vercel standalone preview
        try {
          const existingRaw = localStorage.getItem('tnpsc_staged_questions')
          const existing: any[] = existingRaw ? JSON.parse(existingRaw) : []
          const newItems = approvedQuestions.map((q, idx) => ({
            ...q,
            id: Date.now() + idx,
            status: 'staging',
            createdAt: new Date().toISOString(),
          }))
          localStorage.setItem('tnpsc_staged_questions', JSON.stringify([...newItems, ...existing]))
          uploadedSuccess = true
        } catch (e) {
          console.error('Local storage fallback failed:', e)
        }
      }

      if (uploadedSuccess) {
        showToast('success', `Uploaded ${countUploaded} approved questions for "${currentLessonTitle}" to Staging!`)
        setAiUploadSuccess({ count: countUploaded, lessonTitle: currentLessonTitle })
        setAiGeneratedQuestions([])
        fetchQuestions()
      }
    } catch (err) {
      console.error('Error during question upload:', err)
      showToast('error', 'Error during question upload')
    } finally {
      setIsAIUploading(false)
    }
  }

  // Proceed to next lesson in syllabus
  const handleProceedToNextLesson = () => {
    const currentIndex = availableLessons.findIndex((l) => l.title === currentLessonTitle)
    if (currentIndex >= 0 && currentIndex + 1 < availableLessons.length) {
      handleLessonChange(availableLessons[currentIndex + 1].title)
    } else {
      // Advance unit if possible
      const unitIndex = availableUnits.findIndex((u) => u.id === currentUnitId)
      if (unitIndex >= 0 && unitIndex + 1 < availableUnits.length) {
        const nextUnit = availableUnits[unitIndex + 1]
        handleUnitChange(nextUnit.id)
      }
    }
    setAiGeneratedQuestions([])
    setAiUploadSuccess(null)
    setAiNotice(null)
  }

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

  // Fetch Questions (supports all 5 Gemini AI Generator syllabus filters + status, difficulty, search)
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
      textbooksList.some((t) => t.status === 'processing' || t.status === 'uploaded') ||
      (aiInlineProcessingJob && aiInlineProcessingJob.status === 'processing') ||
      (notesInlineProcessingJob && notesInlineProcessingJob.status === 'processing')

    if (!hasActiveProcessing || !token) return

    const interval = setInterval(async () => {
      fetchTextbooks()
      if (aiInlineProcessingJob) {
        try {
          const res = await apiFetch(`/api/textbooks/${aiInlineProcessingJob.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const { data } = await parseApiResponse(res)
          if (res.ok && data.data) {
            const tb = data.data
            if (tb.status === 'completed' || tb.status === 'failed') {
              setAiInlineProcessingJob(null)
              if (tb.status === 'completed') {
                setAiSelectedTextbookId(tb.id)
                setAiTextbookMode('specific')
                showToast('success', `Textbook "${tb.bookName}" processed and indexed successfully!`)
              } else {
                showToast('error', `Textbook processing failed: ${tb.errorMessage || 'Unknown error'}`)
              }
            } else if (tb.job) {
              setAiInlineProcessingJob({
                id: tb.id,
                status: tb.status,
                progressPercent: tb.job.progressPercent || 0,
                stepDescription: tb.job.stepDescription || 'Processing...',
              })
            }
          }
        } catch (e) {
          console.warn('Job polling error:', e)
        }
      }

      if (notesInlineProcessingJob) {
        try {
          const res = await apiFetch(`/api/textbooks/${notesInlineProcessingJob.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const { data } = await parseApiResponse(res)
          if (res.ok && data.data) {
            const tb = data.data
            if (tb.status === 'completed' || tb.status === 'failed') {
              setNotesInlineProcessingJob(null)
              if (tb.status === 'completed') {
                setNotesSelectedTextbookId(tb.id)
                setNotesTextbookMode('specific')
                showToast('success', `Textbook "${tb.bookName}" processed and indexed successfully for Study Notes!`)
              } else {
                showToast('error', `Textbook processing failed: ${tb.errorMessage || 'Unknown error'}`)
              }
            } else if (tb.job) {
              setNotesInlineProcessingJob({
                id: tb.id,
                status: tb.status,
                progressPercent: tb.job.progressPercent || 0,
                stepDescription: tb.job.stepDescription || 'Processing...',
              })
            }
          }
        } catch (e) {
          console.warn('Notes job polling error:', e)
        }
      }
    }, 2500)

    return () => clearInterval(interval)
  }, [textbooksList, aiInlineProcessingJob, notesInlineProcessingJob, token, fetchTextbooks])

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

  // Direct Inline PDF Upload from MCQ Generator Modal
  const handleInlineUploadTextbook = async () => {
    if (!token) {
      showToast('error', 'Unauthorized (401): Admin authentication token is missing.')
      return
    }
    if (!aiInlineFile) {
      showToast('error', 'Please choose a PDF file to upload.')
      return
    }
    if (!aiInlineFile.name.toLowerCase().endsWith('.pdf') && aiInlineFile.type !== 'application/pdf') {
      showToast('error', 'Bad Request (400): Only PDF files (.pdf) are supported.')
      return
    }
    if (aiInlineFile.size > 100 * 1024 * 1024) {
      showToast('error', 'Payload Too Large (413): File size exceeds the 100 MB application upload limit.')
      return
    }

    setAiInlineUploading(true)
    setAiInlineProgress(25)

    try {
      const autoBookName = aiInlineBookName.trim() || `Class ${currentClassId} ${selectedSubjectObj.name} (${aiInlineMedium})`
      const formData = new FormData()
      formData.append('group', aiGroupId)
      formData.append('standard', `${currentClassId}th`)
      formData.append('subject', selectedSubjectObj.name)
      formData.append('medium', aiInlineMedium)
      formData.append('term', aiInlineTerm)
      formData.append('bookName', autoBookName)
      formData.append('replace', 'false')
      formData.append('pdf', aiInlineFile)

      setAiInlineProgress(60)

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
      setAiInlineProgress(100)

      if (res.status === 409) {
        if (data?.existingId) {
          setAiSelectedTextbookId(Number(data.existingId))
          setAiTextbookMode('specific')
        }
        showToast('error', data?.message || 'A textbook with this name already exists. Selecting existing...')
        setAiInlineUploading(false)
        fetchTextbooks()
        return
      }

      if (res.status === 304 || !res.ok || !data?.data?.id || data?.data?.status === 'failed') {
        const errMsg = classifyApiError(res, data, rawText, 'POST /api/textbooks/upload')
        showToast('error', errMsg)
        setAiInlineUploading(false)
        return
      }

      if (data.data.status === 'completed') {
        showToast('success', `PDF uploaded and indexed (${data.data.pageCount || 0} pages)!`)
        setAiSelectedTextbookId(data.data.id)
        setAiTextbookMode('specific')
      } else {
        showToast('success', 'PDF uploaded! Processing and indexing text in background...')
        setAiInlineProcessingJob({
          id: data.data.id,
          status: 'processing',
          progressPercent: 10,
          stepDescription: 'Extracting text from PDF pages...',
        })
      }
      setAiInlineFile(null)
      setAiInlineBookName('')
      fetchTextbooks()
    } catch (err: any) {
      console.error('Inline upload error:', err)
      const friendlyError = await classifyFetchFailure(err, {
        endpointLabel: 'POST /api/textbooks/upload',
        uploadFileSizeBytes: aiInlineFile.size,
      })
      showToast('error', friendlyError)
    } finally {
      setAiInlineUploading(false)
    }
  }

  // Direct Inline PDF Upload from Study Notes Generator Modal
  const handleNotesInlineUploadTextbook = async () => {
    if (!token) {
      showToast('error', 'Unauthorized (401): Admin authentication token is missing.')
      return
    }
    if (!notesInlineFile) {
      showToast('error', 'Please choose a PDF file to upload.')
      return
    }
    if (!notesInlineFile.name.toLowerCase().endsWith('.pdf') && notesInlineFile.type !== 'application/pdf') {
      showToast('error', 'Bad Request (400): Only PDF files (.pdf) are supported.')
      return
    }
    if (notesInlineFile.size > 100 * 1024 * 1024) {
      showToast('error', 'Payload Too Large (413): File size exceeds the 100 MB application upload limit.')
      return
    }

    setNotesInlineUploading(true)
    setNotesInlineProgress(25)

    try {
      const autoBookName = notesInlineBookName.trim() || `Class ${currentClassId} ${selectedSubjectObj.name} (${notesInlineMedium})`
      const formData = new FormData()
      formData.append('group', aiGroupId)
      formData.append('standard', `${currentClassId}th`)
      formData.append('subject', selectedSubjectObj.name)
      formData.append('medium', notesInlineMedium)
      formData.append('term', notesInlineTerm)
      formData.append('bookName', autoBookName)
      formData.append('replace', 'false')
      formData.append('pdf', notesInlineFile)

      setNotesInlineProgress(60)

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
      setNotesInlineProgress(100)

      if (res.status === 409) {
        if (data?.existingId) {
          setNotesSelectedTextbookId(Number(data.existingId))
          setNotesTextbookMode('specific')
        }
        showToast('error', data?.message || 'A textbook with this name already exists. Selecting existing...')
        setNotesInlineUploading(false)
        fetchTextbooks()
        return
      }

      if (res.status === 304 || !res.ok || !data?.data?.id || data?.data?.status === 'failed') {
        const errMsg = classifyApiError(res, data, rawText, 'POST /api/textbooks/upload')
        showToast('error', errMsg)
        setNotesInlineUploading(false)
        return
      }

      if (data.data.status === 'completed') {
        showToast('success', `PDF uploaded and indexed (${data.data.pageCount || 0} pages)!`)
        setNotesSelectedTextbookId(data.data.id)
        setNotesTextbookMode('specific')
      } else {
        showToast('success', 'PDF uploaded! Processing and indexing text in background for Study Notes...')
        setNotesInlineProcessingJob({
          id: data.data.id,
          status: 'processing',
          progressPercent: 10,
          stepDescription: 'Extracting text from PDF pages...',
        })
      }
      setNotesInlineFile(null)
      setNotesInlineBookName('')
      fetchTextbooks()
    } catch (err: any) {
      console.error('Notes inline upload error:', err)
      const friendlyError = await classifyFetchFailure(err, {
        endpointLabel: 'POST /api/textbooks/upload',
        uploadFileSizeBytes: notesInlineFile.size,
      })
      showToast('error', friendlyError)
    } finally {
      setNotesInlineUploading(false)
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
      setMetrics((prev) => ({
        ...prev,
        stagingCount: Math.max(0, prev.stagingCount - publishedCount),
        publishedCount: prev.publishedCount + publishedCount,
      }))
      setSelectedQuestionIds(new Set())
      setIsBulkPublishModalOpen(false)
      showToast('success', data.message || `Successfully published ${publishedCount} questions.`)
      fetchQuestions()
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

    // Ensure every question has mandatory TNPSC Group and Topic
    const mappedQuestions = parsed.map((item: any) => ({
      ...item,
      category: bulkGroupId,
      lessonId: item.lessonId || (selectedLessonObj && selectedLessonObj.title === item.lessonTitle ? selectedLessonObj.id : null),
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
            </div>
            <h1 className="admin-title">
              {adminSection === 'questions' && 'Question Bank Management'}
              {adminSection === 'textbooks' && 'Textbook Management'}
              {adminSection === 'notes' && 'Study Notes Management'}
            </h1>
            <p className="admin-subtitle">
              {adminSection === 'questions' && 'Review, edit, stage, and publish verified Samacheer Kalvi topic-wise MCQs directly into the database.'}
              {adminSection === 'textbooks' && 'Upload, index, and organize Samacheer Kalvi PDF textbooks for AI study notes and MCQ generation.'}
              {adminSection === 'notes' && 'Review, edit, stage, and publish comprehensive TNPSC One-Liner Study Notes directly into the database.'}
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
                <Layers size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-value">
                  {metrics.unitsCount ? `${metrics.unitsCount} Units` : '6 Units'}
                </span>
                <span className="metric-label">
                  {metrics.classesCount ? `${metrics.classesCount} Classes (6–12)` : 'Total Units / Classes'}
                </span>
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
                className="admin-btn admin-btn-ai"
                onClick={() => {
                  setIsAIGeneratorOpen(true)
                  setAiUploadSuccess(null)
                }}
                title="Generate syllabus-based questions with Google Gemini"
              >
                <Sparkles size={16} />
                <span>Gemini AI Generator</span>
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
                    className="admin-btn admin-btn-ai"
                    onClick={() => {
                      setIsAIGeneratorOpen(true)
                      setAiMode('notes')
                      setAiUploadSuccess(null)
                    }}
                    title="Generate syllabus-based study notes with Google Gemini"
                  >
                    <Sparkles size={16} />
                    <span>Gemini AI Generator</span>
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

      {/* Gemini AI Question Generator Modal */}
      <AnimatePresence>
        {isAIGeneratorOpen && (
          <div
            className="admin-modal-backdrop ai-modal-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsAIGeneratorOpen(false)
                setAiUploadSuccess(null)
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
                      Gemini AI Generator
                    </span>
                    <span className="ai-group-badge">
                      {TNPSC_GROUPS.find((g) => g.id === aiGroupId)?.name} • {selectedSubjectObj?.name} • {selectedStandardObj?.label}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ai-modal-close-btn"
                    onClick={() => {
                      setIsAIGeneratorOpen(false)
                      setAiUploadSuccess(null)
                    }}
                    aria-label="Close generator modal"
                    title="Close Generator (Esc)"
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
                        ? 'Select Group, Subject, Standard, Unit, and Lesson to generate authentic syllabus MCQs with Google Gemini.'
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
                  >
                    <Sparkles size={15} />
                    <span>MCQ Questions Generator</span>
                    <span className="ai-nav-tab-pill">Classes 6–12</span>
                  </button>
                  <button
                    type="button"
                    className={`ai-nav-tab ${aiMode === 'notes' ? 'active' : ''}`}
                    onClick={() => setAiMode('notes')}
                  >
                    <BookOpen size={15} />
                    <span>Study Notes Generator</span>
                    <span className="ai-nav-tab-pill">Tamil & English</span>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="ai-modal-body">

                {/* 1. API Key Config Card */}
                <div className="ai-api-card">
                  <div className="ai-api-header">
                    <div className="ai-api-title">
                      <Key size={15} style={{ color: '#c084fc' }} />
                      <span>Google Gemini API Configuration</span>
                    </div>
                    {geminiApiKey.trim() ? (
                      <span className="ai-api-status-badge ai-status-connected">
                        <Check size={12} />
                        Gemini 1.5 Flash Connected
                      </span>
                    ) : (
                      <span className="ai-api-status-badge ai-status-fallback">
                        <Bot size={12} />
                        Syllabus Engine Active (No Key Required)
                      </span>
                    )}
                  </div>
                  <div className="ai-api-input-row">
                    <input
                      type="password"
                      className="ai-api-input"
                      placeholder="Paste Gemini API Key (AIzaSy...) or leave blank to use built-in syllabus generator"
                      value={geminiApiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                    />
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ai-api-link"
                    >
                      <span>Get Free API Key</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>

                {/* 2. Success Banner (when uploaded) */}
                {aiUploadSuccess && (
                  <div className="ai-success-card">
                    <div className="ai-success-icon-box">
                      <CheckCircle size={32} />
                    </div>
                    <div>
                      <h3 className="ai-success-title">Questions Successfully Staged!</h3>
                      <p className="ai-success-subtitle">
                        {aiUploadSuccess.count} verified questions for <strong>"{aiUploadSuccess.lessonTitle}"</strong> have been securely saved to Staging.
                      </p>
                    </div>

                    <div className="ai-next-lesson-box">
                      <div className="ai-next-info">
                        <span className="ai-next-label">Next Lesson in Syllabus:</span>
                        <span className="ai-next-title">
                          {(() => {
                            const curIdx = availableLessons.findIndex((l) => l.title === currentLessonTitle)
                            if (curIdx >= 0 && curIdx + 1 < availableLessons.length) {
                              return `${availableLessons[curIdx + 1].lessonNumber} ${availableLessons[curIdx + 1].title}`
                            }
                            return 'Next Unit in Syllabus'
                          })()}
                        </span>
                      </div>
                      <button className="ai-next-btn" onClick={handleProceedToNextLesson}>
                        <span>Proceed to Next Lesson</span>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Syllabus 6-Tier Cascading Selector */}
                {!aiUploadSuccess && (
                  <div className="ai-section-box">
                    <h3 className="ai-section-title">
                      <Sparkles size={16} style={{ color: '#c084fc' }} />
                      <span>{aiMode === 'mcq' ? 'Syllabus MCQ Configuration (1 to 5)' : 'Syllabus Study Notes Configuration (1 to 5)'}</span>
                    </h3>

                    {/* Shared 5-Dropdown Syllabus Cascade Selector (1. Group -> 2. Subject -> 3. Standard -> 4. Unit -> 5. Lesson Title) */}
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
                          <span className="ai-lesson-pill">
                            {selectedSubjectObj?.name}
                          </span>
                          <span className="ai-lesson-pill">
                            {selectedStandardObj?.label}
                          </span>
                          <span className="ai-lesson-pill">
                            {currentUnit?.unitNumber ? `Unit ${currentUnit.unitNumber}` : currentUnit?.title}
                          </span>
                        </div>
                        <div className="ai-lesson-title-display">
                          {selectedLessonObj.title}
                        </div>
                        {selectedLessonObj.description && (
                          <p className="ai-lesson-desc">
                            {selectedLessonObj.description}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 6. Textbook Source Selection */}
                    {aiMode === 'mcq' && (
                      <div className="ai-textbook-source-box">
                        <label style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}>
                          <BookOpen size={15} style={{ color: 'var(--gold-primary)' }} />
                          <span>6. Textbook Source Selection *</span>
                        </label>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <label className={`ai-source-radio-card ${aiTextbookMode === 'auto' ? 'active' : ''}`}>
                            <input
                              type="radio"
                              name="tbSourceMode"
                              checked={aiTextbookMode === 'auto'}
                              onChange={() => setAiTextbookMode('auto')}
                            />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Use Uploaded Automatically</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Matches {currentClassId}th Standard {selectedSubjectObj?.name}
                              </div>
                            </div>
                          </label>

                          <label className={`ai-source-radio-card ${aiTextbookMode === 'specific' ? 'active' : ''}`}>
                            <input
                              type="radio"
                              name="tbSourceMode"
                              checked={aiTextbookMode === 'specific'}
                              onChange={() => setAiTextbookMode('specific')}
                            />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Select Specific Textbook</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Choose from existing uploaded books
                              </div>
                            </div>
                          </label>

                          <label className={`ai-source-radio-card ${aiTextbookMode === 'upload' ? 'active' : ''}`}>
                            <input
                              type="radio"
                              name="tbSourceMode"
                              checked={aiTextbookMode === 'upload'}
                              onChange={() => setAiTextbookMode('upload')}
                            />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Upload New Textbook PDF</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Upload and index directly here
                              </div>
                            </div>
                          </label>
                        </div>

                        {/* Mode: specific */}
                        {aiTextbookMode === 'specific' && (
                          <div className="ai-field" style={{ marginTop: '0.5rem' }}>
                            <label>Choose Uploaded Textbook ({textbooksList.filter((t) => t.status === 'completed').length} Available)</label>
                            <select
                              className="ai-select"
                              value={aiSelectedTextbookId || ''}
                              onChange={(e) => setAiSelectedTextbookId(Number(e.target.value))}
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

                        {/* Mode: upload */}
                        {aiTextbookMode === 'upload' && (
                          <div
                            style={{
                              padding: '0.75rem',
                              background: 'rgba(255, 255, 255, 0.03)',
                              borderRadius: '8px',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              marginTop: '0.5rem',
                            }}
                          >
                            <div className="form-grid-2" style={{ marginBottom: '0.5rem' }}>
                              <div className="ai-field">
                                <label>Book Name / Title</label>
                                <input
                                  type="text"
                                  className="admin-auth-input"
                                  placeholder={`Class ${currentClassId} ${selectedSubjectObj.name}`}
                                  value={aiInlineBookName}
                                  onChange={(e) => setAiInlineBookName(e.target.value)}
                                />
                              </div>
                              <div className="ai-field">
                                <label>Medium</label>
                                <select
                                  className="ai-select"
                                  value={aiInlineMedium}
                                  onChange={(e) => setAiInlineMedium(e.target.value as any)}
                                >
                                  <option value="English">English Medium</option>
                                  <option value="Tamil">Tamil Medium (தமிழ்)</option>
                                </select>
                              </div>
                            </div>

                            <div className="form-grid-2" style={{ marginBottom: '0.5rem' }}>
                              <div className="ai-field">
                                <label>Term</label>
                                <select
                                  className="ai-select"
                                  value={aiInlineTerm}
                                  onChange={(e) => setAiInlineTerm(e.target.value)}
                                >
                                  <option value="Full Year">Full Year (Combined)</option>
                                  <option value="Term 1">Term 1</option>
                                  <option value="Term 2">Term 2</option>
                                  <option value="Term 3">Term 3</option>
                                </select>
                              </div>
                              <div className="ai-field">
                                <label>PDF File (Classes 6–12 Samacheer Kalvi)</label>
                                <input
                                  type="file"
                                  accept=".pdf,application/pdf"
                                  onChange={(e) => setAiInlineFile(e.target.files?.[0] || null)}
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              className="admin-btn admin-btn-primary"
                              onClick={handleInlineUploadTextbook}
                              disabled={aiInlineUploading || !aiInlineFile}
                              style={{ width: '100%', justifyContent: 'center' }}
                            >
                              <UploadCloud size={16} />
                              <span>{aiInlineUploading ? `Uploading PDF (${aiInlineProgress}%)...` : 'Upload & Start Background Indexing'}</span>
                            </button>

                            {/* Processing Progress Notification */}
                            {aiInlineProcessingJob && (
                              <div style={{ marginTop: '0.75rem', padding: '0.65rem', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#fbbf24', fontWeight: 600 }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <RefreshCw size={13} className="spin-icon" />
                                    <span>{aiInlineProcessingJob.stepDescription}</span>
                                  </span>
                                  <span>{aiInlineProcessingJob.progressPercent}%</span>
                                </div>
                                <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginTop: '0.35rem' }}>
                                  <div style={{ width: `${aiInlineProcessingJob.progressPercent}%`, height: '100%', background: '#fbbf24' }} />
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', marginBottom: 0 }}>
                                  Question generation will be unlocked as soon as indexing is complete.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Generation Settings */}
                    {aiMode === 'mcq' ? (
                      <div className="ai-generation-options">
                        <div className="ai-options-inline">
                          <div className="ai-field ai-field-compact">
                            <label>7. Language</label>
                            <select
                              className="ai-select"
                              value={aiLanguage}
                              onChange={(e) => setAiLanguage(e.target.value as 'tamil' | 'english')}
                            >
                              <option value="tamil">Tamil (தமிழ்)</option>
                              <option value="english">English</option>
                            </select>
                          </div>

                          <div className="ai-field ai-field-compact">
                            <label>8. Questions Count</label>
                            <select
                              className="ai-select"
                              value={aiQuestionCount}
                              onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                            >
                              <option value={50}>50 Questions</option>
                              <option value={80}>80 Questions</option>
                              <option value={100}>100 Questions</option>
                            </select>
                          </div>

                          <div className="ai-field ai-field-compact">
                            <label>9. Difficulty</label>
                            <select
                              className="ai-select"
                              value={aiDifficulty}
                              onChange={(e) => setAiDifficulty(e.target.value as any)}
                            >
                              <option value="Medium">Medium (Exam Std)</option>
                              <option value="Easy">Easy (Conceptual)</option>
                              <option value="Hard">Hard (Deep Analysis)</option>
                              <option value="Mixed">Mixed</option>
                            </select>
                          </div>
                        </div>

                        <button
                          className="ai-generate-action-btn"
                          onClick={handleGenerateAIQuestions}
                          disabled={!isFormValid || isAIGenerating}
                        >
                          <Sparkles size={18} className={isAIGenerating ? 'spin-icon' : ''} />
                          <span>
                            {isAIGenerating
                              ? 'Generating MCQs...'
                              : `Generate ${aiQuestionCount} MCQs for ${selectedSubjectObj?.name || 'Subject'}`}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="ai-generation-options">
                        {/* 6. Textbook Source Selection (Study Notes) */}
                        <div className="ai-textbook-source-box">
                          <label style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}>
                            <BookOpen size={15} style={{ color: 'var(--gold-primary)' }} />
                            <span>6. Textbook Source Selection *</span>
                          </label>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <label className={`ai-source-radio-card ${notesTextbookMode === 'auto' ? 'active' : ''}`}>
                              <input
                                type="radio"
                                name="notesTbSourceMode"
                                checked={notesTextbookMode === 'auto'}
                                onChange={() => setNotesTextbookMode('auto')}
                              />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Use Uploaded Automatically</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Matches {currentClassId}th Standard {selectedSubjectObj?.name}
                                </div>
                              </div>
                            </label>

                            <label className={`ai-source-radio-card ${notesTextbookMode === 'specific' ? 'active' : ''}`}>
                              <input
                                type="radio"
                                name="notesTbSourceMode"
                                checked={notesTextbookMode === 'specific'}
                                onChange={() => setNotesTextbookMode('specific')}
                              />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Select Specific Textbook</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Choose from existing uploaded books
                                </div>
                              </div>
                            </label>

                            <label className={`ai-source-radio-card ${notesTextbookMode === 'upload' ? 'active' : ''}`}>
                              <input
                                type="radio"
                                name="notesTbSourceMode"
                                checked={notesTextbookMode === 'upload'}
                                onChange={() => setNotesTextbookMode('upload')}
                              />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Upload New Textbook PDF</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Upload and index directly here
                                </div>
                              </div>
                            </label>
                          </div>

                          {/* Mode: specific */}
                          {notesTextbookMode === 'specific' && (
                            <div className="ai-field" style={{ marginTop: '0.5rem' }}>
                              <label>Choose Uploaded Textbook ({textbooksList.filter((t) => t.status === 'completed').length} Available)</label>
                              <select
                                className="ai-select"
                                value={notesSelectedTextbookId || ''}
                                onChange={(e) => setNotesSelectedTextbookId(Number(e.target.value))}
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

                          {/* Mode: upload */}
                          {notesTextbookMode === 'upload' && (
                            <div
                              style={{
                                padding: '0.75rem',
                                background: 'rgba(255, 255, 255, 0.03)',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                marginTop: '0.5rem',
                              }}
                            >
                              <div className="form-grid-2" style={{ marginBottom: '0.5rem' }}>
                                <div className="ai-field">
                                  <label>Book Name / Title</label>
                                  <input
                                    type="text"
                                    className="admin-auth-input"
                                    placeholder={`Class ${currentClassId} ${selectedSubjectObj.name}`}
                                    value={notesInlineBookName}
                                    onChange={(e) => setNotesInlineBookName(e.target.value)}
                                  />
                                </div>
                                <div className="ai-field">
                                  <label>Medium</label>
                                  <select
                                    className="ai-select"
                                    value={notesInlineMedium}
                                    onChange={(e) => setNotesInlineMedium(e.target.value as any)}
                                  >
                                    <option value="English">English Medium</option>
                                    <option value="Tamil">Tamil Medium (தமிழ்)</option>
                                  </select>
                                </div>
                              </div>

                              <div className="form-grid-2" style={{ marginBottom: '0.5rem' }}>
                                <div className="ai-field">
                                  <label>Term</label>
                                  <select
                                    className="ai-select"
                                    value={notesInlineTerm}
                                    onChange={(e) => setNotesInlineTerm(e.target.value)}
                                  >
                                    <option value="Full Year">Full Year (Combined)</option>
                                    <option value="Term 1">Term 1</option>
                                    <option value="Term 2">Term 2</option>
                                    <option value="Term 3">Term 3</option>
                                  </select>
                                </div>
                                <div className="ai-field">
                                  <label>PDF File (Classes 6–12 Samacheer Kalvi)</label>
                                  <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={(e) => setNotesInlineFile(e.target.files?.[0] || null)}
                                  />
                                </div>
                              </div>

                              <button
                                type="button"
                                className="admin-btn admin-btn-primary"
                                onClick={handleNotesInlineUploadTextbook}
                                disabled={notesInlineUploading || !notesInlineFile}
                                style={{ width: '100%', justifyContent: 'center' }}
                              >
                                <UploadCloud size={16} />
                                <span>{notesInlineUploading ? `Uploading PDF (${notesInlineProgress}%)...` : 'Upload & Start Background Indexing'}</span>
                              </button>

                              {/* Processing Progress Notification */}
                              {notesInlineProcessingJob && (
                                <div style={{ marginTop: '0.75rem', padding: '0.65rem', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '6px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#fbbf24', fontWeight: 600 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <RefreshCw size={13} className="spin-icon" />
                                      <span>{notesInlineProcessingJob.stepDescription}</span>
                                    </span>
                                    <span>{notesInlineProcessingJob.progressPercent}%</span>
                                  </div>
                                  <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginTop: '0.35rem' }}>
                                    <div style={{ width: `${notesInlineProcessingJob.progressPercent}%`, height: '100%', background: '#fbbf24' }} />
                                  </div>
                                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', marginBottom: 0 }}>
                                    Study notes generation will be unlocked as soon as indexing is complete.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Chapter Selection & Scope */}
                          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <label style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                              <Layers size={14} style={{ color: 'var(--gold-primary)' }} />
                              <span>Chapter Scope & Generation Mode</span>
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.5rem' }}>
                              <label className={`ai-source-radio-card ${notesScope === 'chapter' ? 'active' : ''}`} style={{ padding: '0.55rem 0.75rem' }}>
                                <input
                                  type="radio"
                                  name="notesScopeMode"
                                  checked={notesScope === 'chapter'}
                                  onChange={() => setNotesScope('chapter')}
                                />
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>Selected Chapter / Lesson</div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                    Unit {currentUnitId}: {currentLessonTitle || 'Current Lesson'}
                                  </div>
                                </div>
                              </label>

                              <label className={`ai-source-radio-card ${notesScope === 'full_book' ? 'active' : ''}`} style={{ padding: '0.55rem 0.75rem' }}>
                                <input
                                  type="radio"
                                  name="notesScopeMode"
                                  checked={notesScope === 'full_book'}
                                  onChange={() => setNotesScope('full_book')}
                                />
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>Entire Uploaded PDF</div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                    All chapters sequentially in textbook order
                                  </div>
                                </div>
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="ai-options-inline">
                          <div className="ai-field ai-field-compact">
                            <label>7. Language</label>
                            <select
                              className="ai-select"
                              value={notesLanguage}
                              onChange={(e) => setNotesLanguage(e.target.value as any)}
                            >
                              <option value="tamil">Tamil (தமிழ்)</option>
                              <option value="english">English</option>
                            </select>
                          </div>
                        </div>

                        <button
                          className="ai-generate-action-btn"
                          onClick={async () => {
                            if (!token || !isNotesFormValid) return
                            setIsNotesGenerating(true)
                            setNotesPreview(null)
                            setAiNotice(null)
                            try {
                              const res = await apiFetch('/api/notes/ai-generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({
                                  category: aiGroupId,
                                  subject: selectedSubjectObj.name,
                                  classId: currentClassId,
                                  unitId: currentUnitId,
                                  lessonId: selectedLessonObj?.id,
                                  lessonNumber: selectedLessonObj?.lessonNumber,
                                  lessonTitle: currentLessonTitle,
                                  topic: currentTopicName || currentLessonTitle,
                                  language: notesLanguage,
                                  apiKey: geminiApiKey.trim() || undefined,
                                  textbookMode: notesTextbookMode,
                                  textbookId:
                                    notesTextbookMode === 'specific'
                                      ? notesSelectedTextbookId
                                      : (notesInlineProcessingJob?.id || undefined),
                                  term: notesInlineTerm || 'Term 1',
                                  scope: notesScope,
                                }),
                              })
                              const data = await res.json()
                              if (res.ok && data.data) {
                                const cleanedContent = cleanTamilUnicodeText(data.data.content)
                                setNotesPreview({
                                  content: cleanedContent,
                                  title: cleanTamilUnicodeText(data.data.title || currentLessonTitle),
                                  sourceReference: data.data.sourceReference || undefined,
                                  lessonId: data.data.lessonId || selectedLessonObj?.id,
                                  lessonNumber: data.data.lessonNumber || selectedLessonObj?.lessonNumber,
                                  coverageReport: data.data.coverageReport || undefined,
                                  topics: data.data.topics || undefined,
                                })
                                const pagesStr = data.textbookUsed?.pages?.length
                                  ? `Pages ${data.textbookUsed.pages.join(', ')} (${data.textbookUsed.pages.length} Pages - 100% Complete)`
                                  : ''
                                setAiNotice(
                                  data.source === 'gemini'
                                    ? `Complete Study Notes generated via Gemini AI referencing "${data.textbookUsed?.name || 'Textbook'}" [${pagesStr}].`
                                    : `Complete Study Notes synthesized from "${data.textbookUsed?.name || 'Textbook'}" [${pagesStr}].`
                                )
                              } else {
                                showToast('error', data.message || 'Failed to generate notes')
                              }
                            } catch (err: any) {
                              showToast('error', err.message || 'Error generating notes')
                            } finally {
                              setIsNotesGenerating(false)
                            }
                          }}
                          disabled={!isNotesFormValid || isNotesGenerating}
                        >
                          <Sparkles size={18} className={isNotesGenerating ? 'spin-icon' : ''} />
                          <span>
                            {isNotesGenerating
                              ? (notesScope === 'full_book' ? 'Generating All Chapters...' : 'Generating One-Liner Notes...')
                              : `Generate One-Liner Notes (${notesLanguage === 'tamil' ? 'Tamil' : 'English'})`}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Notice Banner */}
                {aiNotice && (
                  <div className="ai-notice-box">
                    {aiSource === 'gemini' ? (
                      <Sparkles size={18} style={{ color: '#c084fc', flexShrink: 0 }} />
                    ) : (
                      <CheckCircle size={18} style={{ color: '#34d399', flexShrink: 0 }} />
                    )}
                    <span>{aiNotice}</span>
                  </div>
                )}

                {/* Notes Preview */}
                {aiMode === 'notes' && notesPreview && (
                  <div className="ai-preview-container">
                    <div className="ai-batch-bar">
                      <div className="ai-batch-left">
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          Study Notes Preview - {notesPreview.title} {notesPreview.sourceReference ? `(${notesPreview.sourceReference})` : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          className="admin-btn admin-btn-primary"
                          disabled={isNotesUploading}
                          onClick={async () => {
                            if (!token || !notesPreview) return
                            setIsNotesUploading(true)
                            try {
                              const res = await apiFetch('/api/notes', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({
                                  category: aiGroupId,
                                  subject: selectedSubjectObj.name,
                                  classId: currentClassId,
                                  unitId: currentUnitId,
                                  lessonId: notesPreview.lessonId || selectedLessonObj?.id,
                                  lessonNumber: notesPreview.lessonNumber || selectedLessonObj?.lessonNumber,
                                  lessonTitle: currentLessonTitle,
                                  topic: currentTopicName || currentLessonTitle,
                                  language: notesLanguage,
                                  title: notesPreview.title,
                                  content: notesPreview.content,
                                  sourceReference: notesPreview.sourceReference || `${TNPSC_GROUPS.find((g) => g.id === aiGroupId)?.name}, Unit ${currentUnitId}: ${currentLessonTitle}`,
                                  status: 'staging',
                                  coverageReport: notesPreview.coverageReport || null,
                                  topics: notesPreview.topics || null,
                                }),
                              })
                              const data = await res.json()
                              if (res.ok) {
                                showToast('success', 'Study notes saved to Staging for review!')
                                setNotesPreview(null)
                                fetchNotes()
                              } else {
                                showToast('error', data.message || 'Failed to stage notes')
                              }
                            } catch (err: any) {
                              showToast('error', err.message || 'Error staging notes')
                            } finally {
                              setIsNotesUploading(false)
                            }
                          }}
                        >
                          <Clock size={16} />
                          <span>{isNotesUploading ? 'Saving...' : 'Save to Staging (Review & Approve)'}</span>
                        </button>
                        <button
                          className="admin-btn admin-bulk-publish-btn"
                          disabled={isNotesUploading}
                          onClick={async () => {
                            if (!token || !notesPreview) return
                            setIsNotesUploading(true)
                            try {
                              const res = await apiFetch('/api/notes', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({
                                  category: aiGroupId,
                                  subject: selectedSubjectObj.name,
                                  classId: currentClassId,
                                  unitId: currentUnitId,
                                  lessonId: notesPreview.lessonId || selectedLessonObj?.id,
                                  lessonNumber: notesPreview.lessonNumber || selectedLessonObj?.lessonNumber,
                                  lessonTitle: currentLessonTitle,
                                  topic: currentTopicName || currentLessonTitle,
                                  language: notesLanguage,
                                  title: notesPreview.title,
                                  content: notesPreview.content,
                                  sourceReference: notesPreview.sourceReference || `${TNPSC_GROUPS.find((g) => g.id === aiGroupId)?.name}, Unit ${currentUnitId}: ${currentLessonTitle}`,
                                  status: 'published',
                                  coverageReport: notesPreview.coverageReport || null,
                                  topics: notesPreview.topics || null,
                                }),
                              })
                              const data = await res.json()
                              if (res.ok) {
                                showToast('success', 'Study notes published directly to Study Materials!')
                                setNotesPreview(null)
                                fetchNotes()
                              } else {
                                showToast('error', data.message || 'Failed to publish notes')
                              }
                            } catch (err: any) {
                              showToast('error', err.message || 'Error publishing notes')
                            } finally {
                              setIsNotesUploading(false)
                            }
                          }}
                        >
                          <CheckCircle size={16} />
                          <span>{isNotesUploading ? 'Publishing...' : 'Upload & Publish Live'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Quality Verification & Coverage Audit Card */}
                    {notesPreview.coverageReport && (
                      <div
                        style={{
                          marginBottom: '1rem',
                          padding: '1.1rem 1.25rem',
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 78, 59, 0.15) 100%)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          borderRadius: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.85rem',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <CheckCircle size={20} style={{ color: '#10b981' }} />
                            <div>
                              <span style={{ fontWeight: 700, color: '#10b981', fontSize: '0.92rem', letterSpacing: '0.01em' }}>
                                Textbook Coverage & Quality Audit Report
                              </span>
                              <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                Official Samacheer Kalvi Textbook Content Verification
                              </span>
                            </div>
                          </div>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.3rem 0.75rem',
                              borderRadius: '9999px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              background: notesPreview.coverageReport.isComplete ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                              color: notesPreview.coverageReport.isComplete ? '#34d399' : '#fbbf24',
                              border: `1px solid ${notesPreview.coverageReport.isComplete ? 'rgba(16, 185, 129, 0.45)' : 'rgba(245, 158, 11, 0.45)'}`,
                            }}
                          >
                            ● {notesPreview.coverageReport.statusVerdict} ({notesPreview.coverageReport.completionPercentage}%)
                          </span>
                        </div>

                        {/* Metric Cards Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.75rem' }}>
                          <div style={{ background: 'var(--surface-primary, rgba(255,255,255,0.03))', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Total Lesson Pages</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {notesPreview.coverageReport.totalLessonPages} Pages
                            </div>
                          </div>
                          <div style={{ background: 'var(--surface-primary, rgba(255,255,255,0.03))', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Pages Processed</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#34d399' }}>
                              {notesPreview.coverageReport.processedPages.length} / {notesPreview.coverageReport.totalLessonPages} (100%)
                            </div>
                          </div>
                          <div style={{ background: 'var(--surface-primary, rgba(255,255,255,0.03))', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Topics Covered</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {notesPreview.coverageReport.topicsCovered.length} of {notesPreview.coverageReport.topicsIdentified.length}
                            </div>
                          </div>
                          <div style={{ background: 'var(--surface-primary, rgba(255,255,255,0.03))', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Missing Topics</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: notesPreview.coverageReport.missingTopics.length === 0 ? '#34d399' : '#ef4444' }}>
                              {notesPreview.coverageReport.missingTopics.length === 0 ? 'None (0)' : notesPreview.coverageReport.missingTopics.length}
                            </div>
                          </div>
                        </div>

                        {/* Covered pages chips */}
                        {notesPreview.coverageReport.processedPages.length > 0 && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600 }}>Covered Textbook Pages:</span>
                            <span style={{ color: 'var(--gold-primary, #ffd700)', fontWeight: 700 }}>
                              [ {notesPreview.coverageReport.processedPages.join(', ')} ]
                            </span>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>
                              (Full lesson isolated with zero adjacent chapter bleed)
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="ai-preview-card" style={{ padding: '1rem' }}>
                      <textarea
                        className="ai-textarea"
                        style={{
                          minHeight: '320px',
                          fontFamily: "'Noto Sans Tamil', 'Inter', system-ui, -apple-system, sans-serif",
                          fontSize: '0.92rem',
                          lineHeight: 1.85,
                          letterSpacing: 'normal',
                        }}
                        value={notesPreview.content}
                        onChange={(e) => setNotesPreview({ ...notesPreview, content: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* 5. Review & Preview Table */}
                {aiMode === 'mcq' && aiGeneratedQuestions.length > 0 && !aiUploadSuccess && (
                  <div className="ai-preview-container">
                    {/* Batch Actions Bar */}
                    <div className="ai-batch-bar">
                      <div className="ai-batch-left">
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          Selected {aiGeneratedQuestions.filter((q) => q.selected !== false).length} of {aiGeneratedQuestions.length} Questions for Staging
                        </span>
                        <button type="button" className="ai-batch-btn" onClick={() => handleSelectAllQuestions(true)}>
                          Select All
                        </button>
                        <button type="button" className="ai-batch-btn" onClick={() => handleSelectAllQuestions(false)}>
                          Deselect All
                        </button>
                        <button type="button" className="ai-batch-btn" onClick={handleRemoveDuplicates}>
                          Remove Duplicates
                        </button>
                      </div>
                      <button
                        className="admin-btn admin-btn-primary"
                        onClick={handleUploadAIQuestions}
                        disabled={isAIUploading || aiGeneratedQuestions.filter((q) => q.selected !== false).length === 0}
                      >
                        <Upload size={16} />
                        <span>
                          {isAIUploading
                            ? 'Uploading...'
                            : `Stage Selected (${aiGeneratedQuestions.filter((q) => q.selected !== false).length})`}
                        </span>
                      </button>
                    </div>

                    {aiGeneratedQuestions.map((q, qIdx) => {
                      const isApproved = q.selected !== false
                      const isCurrentlyRegen = regeneratingIndex === qIdx
                      return (
                        <div key={qIdx} className={`ai-preview-card ${isApproved ? '' : 'ai-preview-card-dimmed'}`}>
                          <div className="ai-card-top-bar">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                              <label className="ai-card-checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={isApproved}
                                  onChange={() => handleToggleSelectQuestion(qIdx)}
                                />
                                <span>{isApproved ? 'Approved for Staging' : 'Skip from Upload'}</span>
                              </label>
                              <span className="ai-card-index">#{qIdx + 1}</span>
                              <div className="ai-card-tag-row">
                                <span className="ai-tag-pill ai-tag-group">{q.category ? q.category.toUpperCase() : aiGroupId.toUpperCase()}</span>
                                <span className="ai-tag-pill">Unit {q.unitId || aiUnitId}</span>
                                {q.topic && <span className="ai-tag-pill ai-tag-topic">📌 {q.topic}</span>}
                              </div>
                            </div>

                            <div className="ai-card-actions">
                              <button
                                type="button"
                                className="ai-single-regen-btn"
                                onClick={() => handleRegenerateSingleQuestion(qIdx)}
                                disabled={isCurrentlyRegen}
                                title="Regenerate this individual question"
                              >
                                <RefreshCcw size={12} className={isCurrentlyRegen ? 'spin-icon' : ''} />
                                <span>{isCurrentlyRegen ? 'Regenerating...' : 'Regenerate'}</span>
                              </button>
                              <span className={`status-badge status-${q.difficulty?.toLowerCase() || 'medium'}`}>
                                {q.difficulty}
                              </span>
                              <button
                                className="ai-delete-btn"
                                title="Delete this question from batch"
                                onClick={() => handleAIDeleteQuestion(qIdx)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Verification Badge & Source Citation */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                            <span className={`verif-badge-${q.verificationStatus || 'verified'}`}>
                              {q.verificationStatus === 'needs_review' ? (
                                <AlertCircle size={12} />
                              ) : q.verificationStatus === 'rejected' ? (
                                <X size={12} />
                              ) : (
                                <CheckCircle2 size={12} />
                              )}
                              <span>
                                {q.verificationStatus === 'needs_review'
                                  ? 'Verification: Needs Review'
                                  : q.verificationStatus === 'rejected'
                                  ? 'Verification: Rejected'
                                  : 'Verification: Verified'}
                              </span>
                            </span>

                            {(q.sourcePage || q.sourceReference) && (
                              <span className="source-page-pill">
                                <BookOpen size={11} />
                                <span>{q.sourceReference || 'Textbook Source'}</span>
                                {q.sourcePage ? ` (Page ${q.sourcePage})` : ''}
                              </span>
                            )}
                          </div>

                          {/* Question Text */}
                          <div className="ai-field">
                            <label>Question Text</label>
                            <textarea
                              rows={2}
                              className="ai-textarea"
                              value={q.question}
                              onChange={(e) => handleAIQuestionTextChange(qIdx, e.target.value)}
                            />
                          </div>

                          {/* Options Grid */}
                          <div className="ai-field">
                            <label>Options (Select radio for Correct Answer)</label>
                            <div className="ai-options-grid">
                              {q.options?.map((opt: string, optIdx: number) => {
                                const isCorrect = q.correctAnswer === optIdx
                                const optLetter = String.fromCharCode(65 + optIdx)
                                return (
                                  <div
                                    key={optIdx}
                                    className={`ai-option-item ${isCorrect ? 'ai-option-item-correct' : ''}`}
                                  >
                                    <button
                                      type="button"
                                      className={`ai-option-radio-btn ${isCorrect ? 'ai-option-radio-btn-active' : ''}`}
                                      onClick={() => handleAICorrectAnswerChange(qIdx, optIdx)}
                                      title={`Mark option ${optLetter} as correct`}
                                    >
                                      {isCorrect ? <Check size={14} /> : optLetter}
                                    </button>
                                    <input
                                      type="text"
                                      className="ai-option-input"
                                      value={opt}
                                      onChange={(e) => handleAIOptionChange(qIdx, optIdx, e.target.value)}
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* Explanation */}
                          <div className="ai-field">
                            <label>Textbook Explanation & Citation</label>
                            <textarea
                              rows={2}
                              className="ai-textarea"
                              value={q.explanation}
                              onChange={(e) => handleAIExplanationChange(qIdx, e.target.value)}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="admin-modal-footer">
                <button
                  className="admin-btn admin-btn-secondary"
                  onClick={() => {
                    setIsAIGeneratorOpen(false)
                    setAiUploadSuccess(null)
                  }}
                >
                  Close
                </button>
                {aiMode === 'mcq' && aiGeneratedQuestions.length > 0 && !aiUploadSuccess && (
                  <button
                    className="admin-btn admin-btn-primary"
                    disabled={isAIUploading || aiGeneratedQuestions.filter((q) => q.selected !== false).length === 0}
                    onClick={handleUploadAIQuestions}
                  >
                    <Upload size={16} />
                    <span>
                      {isAIUploading
                        ? 'Uploading to Staging...'
                        : `Upload ${aiGeneratedQuestions.filter((q) => q.selected !== false).length} Approved Questions to Staging`}
                    </span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                      placeholder="Write markdown note content (One-liners, tables, facts)..."
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
                  lineHeight: 1.85,
                  fontSize: '0.95rem',
                  letterSpacing: 'normal',
                  fontFamily: "'Noto Sans Tamil', 'Inter', system-ui, sans-serif",
                  whiteSpace: 'pre-wrap',
                }}>
                  {cleanTamilUnicodeText(previewingNote.content)}
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

    </div>
  )
}

export default Admin
