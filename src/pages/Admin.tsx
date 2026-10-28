import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiFetch } from '../utils/api'
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
} from 'lucide-react'
import './Admin.css'
import {
  TNPSC_GROUPS,
  STANDARDS,
  getSubjectsForGroup,
  getStandardsForSubject,
  getUnitsForSubjectStandard,
  getLessonsForSelection,
  getTopicsForSelection,
} from '../data/unifiedSyllabusRegistry'

interface QuestionItem {
  id: number
  category: string
  unitId: number
  classId: number | null
  subject: string
  lessonTitle: string
  topic: string | null
  difficulty: 'Easy' | 'Medium' | 'Hard'
  tag: string
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  sourceReference: string | null
  status: 'staging' | 'published' | 'archived'
  createdAt?: string
}

interface AdminMetrics {
  totalQuestions: number
  stagingCount: number
  publishedCount: number
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
  const [metrics, setMetrics] = useState<AdminMetrics>({ totalQuestions: 0, stagingCount: 0, publishedCount: 0 })
  const [filteredTotal, setFilteredTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Filter Bar state
  const [searchQuery, setSearchQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [standardFilter, setStandardFilter] = useState('all')
  const [unitFilter, setUnitFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 25

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
  const [aiGroupId, setAiGroupId] = useState<'group1' | 'group2' | 'group4'>('group1')
  const [aiSubjectId, setAiSubjectId] = useState<string>('general-studies')
  const [aiClassId, setAiClassId] = useState<number>(6)
  const [aiUnitId, setAiUnitId] = useState<number>(1)
  const [aiLessonTitle, setAiLessonTitle] = useState<string>('Measurements and SI Units')
  const [aiTopic, setAiTopic] = useState<string>('')
  const [aiQuestionCount, setAiQuestionCount] = useState<number>(5)
  const [aiDifficulty, setAiDifficulty] = useState<'Medium' | 'Easy' | 'Hard' | 'Mixed'>('Medium')
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('tnpsc_gemini_api_key') || '')
  const [isAIGenerating, setIsAIGenerating] = useState(false)
  const [isAIUploading, setIsAIUploading] = useState(false)
  const [aiNotice, setAiNotice] = useState<string | null>(null)
  const [aiSource, setAiSource] = useState<'gemini' | 'curated_syllabus' | null>(null)
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState<any[]>([])
  const [aiUploadSuccess, setAiUploadSuccess] = useState<{ count: number; lessonTitle: string } | null>(null)
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null)

  // ---------------------------------------------------------------------------
  // 6-TIER CASCADING RESOLUTION: Group -> Subject -> Standard -> Unit -> Lesson -> Topic
  // ---------------------------------------------------------------------------

  // 1. Available subjects for selected Group
  const availableSubjects = getSubjectsForGroup(aiGroupId)
  const selectedSubjectObj = availableSubjects.find((s) => s.id === aiSubjectId) || availableSubjects[0]
  const currentSubjectId = selectedSubjectObj?.id || 'general-studies'

  // 2. Available standards for selected Group & Subject
  const availableStandards = getStandardsForSubject(aiGroupId, currentSubjectId)
  const selectedStandardObj = availableStandards.find((s) => s.id === aiClassId) || availableStandards[0]
  const currentClassId = selectedStandardObj?.id || 6

  // 3. Available units for selected Group, Subject, and Standard
  const availableUnits = getUnitsForSubjectStandard(aiGroupId, currentSubjectId, currentClassId)
  const currentUnit = availableUnits.find((u) => u.id === aiUnitId) || availableUnits[0]
  const currentUnitId = currentUnit?.id || 1

  // 4. Available lessons for selected Group, Subject, Standard, and Unit
  const availableLessons = getLessonsForSelection(aiGroupId, currentSubjectId, currentClassId, currentUnitId)
  const selectedLessonObj = availableLessons.find((l) => l.title === aiLessonTitle) || availableLessons[0]
  const currentLessonTitle = selectedLessonObj?.title || ''

  // 5. Available topics for selected Lesson
  const availableTopics = selectedLessonObj
    ? getTopicsForSelection(aiGroupId, currentSubjectId, currentClassId, currentUnitId, selectedLessonObj.title)
    : []
  const selectedTopicObj = availableTopics.find((t) => t.name === aiTopic) || availableTopics[0]
  const currentTopicName = selectedTopicObj?.name || ''

  // ---------------------------------------------------------------------------
  // EXPLICIT DOWNSTREAM RESET HANDLERS
  // ---------------------------------------------------------------------------

  // 1. When Group changes: resets Subject, Standard, Unit, Lesson, and Topic
  const handleGroupChange = (newGroupId: 'group1' | 'group2' | 'group4') => {
    setAiGroupId(newGroupId)
    const nextSubjects = getSubjectsForGroup(newGroupId)
    const nextSubj = nextSubjects[0]?.id || 'general-studies'
    setAiSubjectId(nextSubj)

    const nextStandards = getStandardsForSubject(newGroupId, nextSubj)
    const nextStd = nextStandards[0]?.id || 6
    setAiClassId(nextStd)

    const nextUnits = getUnitsForSubjectStandard(newGroupId, nextSubj, nextStd)
    const nextUnit = nextUnits[0]?.id || 1
    setAiUnitId(nextUnit)

    const nextLessons = getLessonsForSelection(newGroupId, nextSubj, nextStd, nextUnit)
    const nextLesson = nextLessons[0]?.title || ''
    setAiLessonTitle(nextLesson)

    const nextTopics = getTopicsForSelection(newGroupId, nextSubj, nextStd, nextUnit, nextLesson)
    setAiTopic(nextTopics[0]?.name || '')
  }

  // 2. When Subject changes: resets Standard, Unit, Lesson, and Topic
  const handleSubjectChange = (newSubj: string) => {
    setAiSubjectId(newSubj)

    const nextStandards = getStandardsForSubject(aiGroupId, newSubj)
    const nextStd = nextStandards[0]?.id || 6
    setAiClassId(nextStd)

    const nextUnits = getUnitsForSubjectStandard(aiGroupId, newSubj, nextStd)
    const nextUnit = nextUnits[0]?.id || 1
    setAiUnitId(nextUnit)

    const nextLessons = getLessonsForSelection(aiGroupId, newSubj, nextStd, nextUnit)
    const nextLesson = nextLessons[0]?.title || ''
    setAiLessonTitle(nextLesson)

    const nextTopics = getTopicsForSelection(aiGroupId, newSubj, nextStd, nextUnit, nextLesson)
    setAiTopic(nextTopics[0]?.name || '')
  }

  // 3. When Standard changes: resets Unit, Lesson, and Topic
  const handleStandardChange = (newStd: number) => {
    setAiClassId(newStd)

    const nextUnits = getUnitsForSubjectStandard(aiGroupId, currentSubjectId, newStd)
    const nextUnit = nextUnits[0]?.id || 1
    setAiUnitId(nextUnit)

    const nextLessons = getLessonsForSelection(aiGroupId, currentSubjectId, newStd, nextUnit)
    const nextLesson = nextLessons[0]?.title || ''
    setAiLessonTitle(nextLesson)

    const nextTopics = getTopicsForSelection(aiGroupId, currentSubjectId, newStd, nextUnit, nextLesson)
    setAiTopic(nextTopics[0]?.name || '')
  }

  // 4. When Unit changes: resets Lesson and Topic
  const handleUnitChange = (newUnit: number) => {
    setAiUnitId(newUnit)

    const nextLessons = getLessonsForSelection(aiGroupId, currentSubjectId, currentClassId, newUnit)
    const nextLesson = nextLessons[0]?.title || ''
    setAiLessonTitle(nextLesson)

    const nextTopics = getTopicsForSelection(aiGroupId, currentSubjectId, currentClassId, newUnit, nextLesson)
    setAiTopic(nextTopics[0]?.name || '')
  }

  // 5. When Lesson changes: resets Topic
  const handleLessonChange = (newLesson: string) => {
    setAiLessonTitle(newLesson)

    const nextTopics = getTopicsForSelection(aiGroupId, currentSubjectId, currentClassId, currentUnitId, newLesson)
    setAiTopic(nextTopics[0]?.name || '')
  }

  // 6. When Topic changes
  const handleTopicChange = (newTopic: string) => {
    setAiTopic(newTopic)
  }

  // Defensive fallback synchronization effects
  useEffect(() => {
    const subjects = getSubjectsForGroup(aiGroupId)
    if (!subjects.some((s) => s.id === aiSubjectId)) {
      setAiSubjectId(subjects[0]?.id || 'general-studies')
    }
  }, [aiGroupId, aiSubjectId])

  useEffect(() => {
    const standards = getStandardsForSubject(aiGroupId, currentSubjectId)
    if (!standards.some((s) => s.id === aiClassId)) {
      setAiClassId(standards[0]?.id || 6)
    }
  }, [aiGroupId, currentSubjectId, aiClassId])

  useEffect(() => {
    const units = getUnitsForSubjectStandard(aiGroupId, currentSubjectId, currentClassId)
    if (!units.some((u) => u.id === aiUnitId)) {
      setAiUnitId(units[0]?.id || 1)
    }
  }, [aiGroupId, currentSubjectId, currentClassId, aiUnitId])

  useEffect(() => {
    const lessons = getLessonsForSelection(aiGroupId, currentSubjectId, currentClassId, currentUnitId)
    if (lessons.length > 0) {
      if (!lessons.some((l) => l.title === aiLessonTitle)) {
        setAiLessonTitle(lessons[0].title)
      }
    } else if (aiLessonTitle) {
      setAiLessonTitle('')
    }
  }, [aiGroupId, currentSubjectId, currentClassId, currentUnitId, aiLessonTitle])

  useEffect(() => {
    if (aiLessonTitle) {
      const topics = getTopicsForSelection(aiGroupId, currentSubjectId, currentClassId, currentUnitId, aiLessonTitle)
      if (topics.length > 0) {
        if (!topics.some((t) => t.name === aiTopic)) {
          setAiTopic(topics[0].name)
        }
      } else {
        setAiTopic(`${aiLessonTitle}: Core Concepts`)
      }
    } else if (aiTopic) {
      setAiTopic('')
    }
  }, [aiGroupId, currentSubjectId, currentClassId, currentUnitId, aiLessonTitle, aiTopic])

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
  const isTopicValid = Boolean(currentTopicName || (availableTopics.length > 0))
  const isCountValid = aiQuestionCount >= 1 && aiQuestionCount <= 15
  const isDifficultyValid = ['Medium', 'Easy', 'Hard', 'Mixed'].includes(aiDifficulty)

  const isFormValid =
    isSubjectValid &&
    isStandardValid &&
    isUnitValid &&
    isLessonValid &&
    isTopicValid &&
    isCountValid &&
    isDifficultyValid &&
    !isAIGenerating

  // Generate AI Questions handler
  const handleGenerateAIQuestions = async () => {
    if (!token || !isFormValid) return
    setIsAIGenerating(true)
    setAiNotice(null)
    setAiUploadSuccess(null)

    const activeTopic = aiTopic || currentTopicName || (availableTopics[0]?.name) || `${currentLessonTitle}: Key Concepts`

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
          unitId: currentUnitId,
          unitTitle: currentUnit?.title,
          lessonTitle: currentLessonTitle,
          topic: activeTopic,
          topics: availableTopics.map((t) => t.name),
          description: selectedLessonObj?.description || '',
          count: aiQuestionCount,
          difficulty: aiDifficulty,
          apiKey: geminiApiKey.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (res.ok && data.questions) {
        // Stamp approval selection state
        const taggedQuestions = data.questions.map((q: any) => ({
          ...q,
          category: aiGroupId,
          subject: selectedSubjectObj.name,
          classId: currentClassId,
          unitId: currentUnitId,
          lessonTitle: currentLessonTitle,
          topic: activeTopic,
          selected: true,
        }))
        setAiGeneratedQuestions(taggedQuestions)
        setAiSource(data.source)
        setAiNotice(data.notice || `Generated ${data.count} syllabus-aligned questions ready for review.`)
      } else {
        showToast('error', data.message || 'Failed to generate questions')
      }
    } catch {
      showToast('error', 'Network error while contacting AI Generator endpoint')
    } finally {
      setIsAIGenerating(false)
    }
  }

  // Regenerate an individual question
  const handleRegenerateSingleQuestion = async (qIndex: number) => {
    if (!token || regeneratingIndex !== null) return
    setRegeneratingIndex(qIndex)
    const currentQ = aiGeneratedQuestions[qIndex]
    const targetTopic = currentQ.topic || aiTopic || currentTopicName || (availableTopics[0]?.name) || `${currentLessonTitle}: Key Concepts`

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
          previousQuestion: currentQ.question,
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
    try {
      const res = await apiFetch('/api/questions/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questions: approvedQuestions }),
      })

      const data = await res.json()
      if (res.ok) {
        const countUploaded = data.inserted || approvedQuestions.length
        showToast('success', `Uploaded ${countUploaded} approved questions for "${aiLessonTitle}" to Staging!`)
        setAiUploadSuccess({ count: countUploaded, lessonTitle: aiLessonTitle })
        setAiGeneratedQuestions([])
        fetchQuestions()
      } else {
        showToast('error', data.message || 'Failed to upload generated questions')
      }
    } catch {
      showToast('error', 'Network error during question upload')
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

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setIsLoggingIn(true)
    try {
      const res = await apiFetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.token) {
        localStorage.setItem('tnpsc_admin_token', data.token)
        if (data.user) {
          localStorage.setItem('tnpsc_admin_user', JSON.stringify(data.user))
          setAdminUser(data.user)
        }
        setToken(data.token)
        setUsernameInput('')
        setPasswordInput('')
      } else {
        console.error('Admin login failed:', { status: res.status, statusText: res.statusText, message: data.message })
        setLoginError(data.message || `Login failed (${res.status})`)
      }
    } catch (err) {
      console.error('Admin login error:', err)
      setLoginError('Failed to connect to authentication server. Please ensure the backend is reachable.')
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
      const res = await apiFetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.users) {
        setAdminUsersList(data.users)
      } else {
        setUserActionError(data.message || 'Failed to load admin accounts')
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
      const res = await apiFetch('/api/admin/users', {
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
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        showToast('success', `Admin account "${newAdminUsername}" created successfully!`)
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
      const res = await apiFetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        showToast('success', `Admin account "${username}" deleted`)
        fetchAdminUsers()
      } else {
        showToast('error', data.message || 'Failed to delete admin account')
      }
    } catch {
      showToast('error', 'Network error while deleting admin account')
    }
  }

  // Auto-sync session user profile
  useEffect(() => {
    if (token) {
      apiFetch('/api/admin/verify', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'success' && data.user) {
            setAdminUser(data.user)
            localStorage.setItem('tnpsc_admin_user', JSON.stringify(data.user))
          }
        })
        .catch(() => {})
    }
  }, [token])

  // Fetch Questions
  const fetchQuestions = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      if (groupFilter !== 'all') params.set('category', groupFilter)
      if (standardFilter !== 'all') params.set('classId', standardFilter)
      if (unitFilter !== 'all') params.set('unitId', unitFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (difficultyFilter !== 'all') params.set('difficulty', difficultyFilter)
      params.set('limit', pageSize.toString())
      params.set('offset', ((page - 1) * pageSize).toString())

      const res = await apiFetch(`/api/questions/admin?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401 || res.status === 403) {
        handleLogout()
        return
      }
      const data = await res.json()
      if (data.status === 'success') {
        setQuestions(data.data)
        setMetrics(data.metrics)
        setFilteredTotal(data.filteredTotal)
      }
    } catch (err: any) {
      console.error('Failed to load questions:', err)
    } finally {
      setIsLoading(false)
    }
  }, [token, searchQuery, groupFilter, standardFilter, unitFilter, statusFilter, difficultyFilter, page])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  const showToast = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text })
    setTimeout(() => setActionMessage(null), 5000)
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
            <h1 className="admin-title">Question Bank Management</h1>
            <p className="admin-subtitle">
              Review, edit, stage, and publish verified Samacheer Kalvi topic-wise MCQs directly into the database.
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

        {/* Metrics Cards HUD */}
        <div className="admin-metrics-grid">
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
              <span className="metric-value">6 Units</span>
              <span className="metric-label">Classes 6–12</span>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="admin-toolbar glass">
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
            <div className="admin-filter-group">
              <select
                className="filter-select"
                value={groupFilter}
                onChange={(e) => {
                  setGroupFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All TNPSC Groups</option>
                {TNPSC_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={standardFilter}
                onChange={(e) => {
                  setStandardFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All Standards (6th–12th)</option>
                {STANDARDS.map((s) => (
                  <option key={s.id} value={s.id.toString()}>
                    {s.label}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={unitFilter}
                onChange={(e) => {
                  setUnitFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All Units (1–6)</option>
                <option value="1">Unit 1: General Science</option>
                <option value="2">Unit 2: Geography of India</option>
                <option value="3">Unit 3: History & INM</option>
                <option value="4">Unit 4: Indian Polity</option>
                <option value="5">Unit 5: Indian Economy & TN Admin</option>
                <option value="6">Unit 6: Tamil Nadu Culture</option>
              </select>

              <select
                className="filter-select"
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

              <select
                className="filter-select"
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

            <div className="admin-filter-count">
              Showing <strong>{questions.length}</strong> of <strong>{filteredTotal}</strong> matching questions
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
                      <span className="qid-badge">#{q.id}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${q.status === 'published' ? 'status-published' : 'status-staging'}`}>
                        {q.status === 'published' ? <CheckCircle size={12} /> : <Clock size={12} />}
                        {q.status}
                      </span>
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
                              const topics = getTopicsForSelection(currentCat, subjId, currentClassId, currentUnitId, val)
                              setEditingQuestion({
                                ...editingQuestion,
                                lessonTitle: val,
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

      {/* Gemini AI Question Generator Modal */}
      <AnimatePresence>
        {isAIGeneratorOpen && (
          <div className="admin-modal-backdrop">
            <motion.div
              className="admin-modal ai-modal-container"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {/* Header */}
              <div className="ai-modal-header">
                <div className="ai-modal-header-info">
                  <div className="ai-badge-row">
                    <span className="ai-header-badge">
                      <Sparkles size={13} />
                      Gemini AI Generator
                    </span>
                    <span className="ai-group-badge">
                      {TNPSC_GROUPS.find((g) => g.id === aiGroupId)?.name} • {selectedSubjectObj?.name} • {selectedStandardObj?.label}
                    </span>
                  </div>
                  <h2 className="ai-modal-title">Syllabus-Wise MCQ Generator</h2>
                  <p className="ai-modal-subtitle">
                    Select Group, Subject, Standard, Unit, Lesson & exact Topic to generate authentic syllabus MCQs with Google Gemini.
                  </p>
                </div>
                <button
                  className="admin-modal-close"
                  onClick={() => {
                    setIsAIGeneratorOpen(false)
                    setAiUploadSuccess(null)
                  }}
                  aria-label="Close generator modal"
                >
                  <X size={20} />
                </button>
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
                      <span>Syllabus MCQ Configuration (1 to 6)</span>
                    </h3>

                    {/* Row 1: 1. TNPSC Group, 2. Subject Selection, 3. Standard */}
                    <div className="ai-selection-tier-1">
                      {/* 1. TNPSC Group */}
                      <div className="ai-field">
                        <label>1. TNPSC Group *</label>
                        <select
                          className="ai-select"
                          value={aiGroupId}
                          onChange={(e) => handleGroupChange(e.target.value as any)}
                        >
                          {TNPSC_GROUPS.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 2. Subject Selection (immediately after TNPSC Group and before Standard) */}
                      <div className="ai-field">
                        <label>2. Subject Selection ({availableSubjects.length} Subjects) *</label>
                        <select
                          className="ai-select"
                          value={currentSubjectId}
                          onChange={(e) => handleSubjectChange(e.target.value)}
                        >
                          {availableSubjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 3. Standard */}
                      <div className="ai-field">
                        <label>3. Standard ({availableStandards.length} Standards) *</label>
                        <select
                          className="ai-select"
                          value={currentClassId}
                          onChange={(e) => handleStandardChange(Number(e.target.value))}
                        >
                          {availableStandards.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 2: 4. Unit, 5. Lesson Title */}
                    <div className="ai-selection-tier-2" style={{ marginTop: '0.85rem' }}>
                      {/* 4. Unit */}
                      <div className="ai-field">
                        <label>4. Unit ({availableUnits.length} Units) *</label>
                        <select
                          className="ai-select"
                          value={currentUnitId}
                          onChange={(e) => handleUnitChange(Number(e.target.value))}
                        >
                          {availableUnits.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.unitNumber}: {u.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 5. Lesson Title */}
                      <div className="ai-field">
                        <label>5. Lesson Title ({availableLessons.length} Lessons) *</label>
                        <select
                          className="ai-select"
                          value={currentLessonTitle}
                          onChange={(e) => handleLessonChange(e.target.value)}
                        >
                          {availableLessons.length === 0 ? (
                            <option value="" disabled>No lessons mapped for this selection</option>
                          ) : (
                            availableLessons.map((l) => (
                              <option key={l.id} value={l.title}>
                                {l.lessonNumber} {l.title}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    </div>

                    {/* Row 3: 6. Specific Topic */}
                    <div className="ai-field" style={{ marginTop: '0.85rem' }}>
                      <label>6. Specific Topic ({availableTopics.length} Topics) *</label>
                      <select
                        className="ai-select"
                        value={currentTopicName}
                        onChange={(e) => handleTopicChange(e.target.value)}
                        disabled={availableTopics.length === 0}
                      >
                        {availableTopics.length === 0 ? (
                          <option value="" disabled>No topics available</option>
                        ) : (
                          availableTopics.map((t) => (
                            <option key={t.id} value={t.name}>
                              {t.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

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
                        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Target Topic:</span>
                          <span className="ai-tag-pill ai-tag-topic" style={{ fontSize: '0.78rem' }}>
                            📌 {currentTopicName || (availableTopics[0]?.name) || selectedLessonObj.title}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Generation Settings: 7. Questions Count, 8. Difficulty, 9. Generate Button */}
                    <div className="ai-generation-options">
                      <div className="ai-options-inline">
                        <div className="ai-field ai-field-compact">
                          <label>7. Questions Count</label>
                          <select
                            className="ai-select"
                            value={aiQuestionCount}
                            onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                          >
                            <option value={3}>3 Questions</option>
                            <option value={5}>5 Questions (Recommended)</option>
                            <option value={10}>10 Questions</option>
                          </select>
                        </div>

                        <div className="ai-field ai-field-compact">
                          <label>8. Difficulty</label>
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
                            : `9. Generate ${aiQuestionCount} MCQs for ${selectedSubjectObj?.name || 'Subject'}`}
                        </span>
                      </button>
                    </div>
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

                {/* 5. Review & Preview Table */}
                {aiGeneratedQuestions.length > 0 && !aiUploadSuccess && (
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
                {aiGeneratedQuestions.length > 0 && !aiUploadSuccess && (
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
    </div>
  )
}

export default Admin
