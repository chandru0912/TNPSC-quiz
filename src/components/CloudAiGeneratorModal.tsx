import React, { useState, useEffect } from 'react'
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
  ArrowRight,
  Trash2,
  Cpu,
} from 'lucide-react'
import { apiFetch, classifyFetchFailure } from '../utils/api'
import { SyllabusCascadeSelector, useSyllabusCascade } from './SyllabusCascadeSelector'
import { cleanTamilUnicodeText } from '../utils/tamilUnicodeCleaner'
import { TNPSC_GROUPS } from '../data/unifiedSyllabusRegistry'

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
  fetchTextbooks,
  showToast,
  onRefreshData,
}) => {
  const [aiMode, setAiMode] = useState<CloudAiMode>(initialMode)

  // API Key Configuration
  const [cloudApiKey, setCloudApiKey] = useState<string>(() => localStorage.getItem('tnpsc_cloud_ai_key') || '')
  const [isKeyConfiguredOnServer, setIsKeyConfiguredOnServer] = useState<boolean>(false)
  const [serverModel, setServerModel] = useState<string>('gpt-4o-mini')

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
    availableUnits,
    availableLessons,
    selectedSubjectObj,
    selectedStandardObj,
    currentUnit,
    selectedLessonObj,
    handleLessonChange,
    handleUnitChange,
  } = aiSyllabusCascade

  // Textbook Source Selection States (Unified across modes)
  const [textbookMode, setTextbookMode] = useState<'auto' | 'specific' | 'upload'>('auto')
  const [selectedTextbookId, setSelectedTextbookId] = useState<number | null>(null)
  const [inlineBookName, setInlineBookName] = useState<string>('')
  const [inlineMedium, setInlineMedium] = useState<'Tamil' | 'English'>('English')
  const [inlineTerm, setInlineTerm] = useState<string>('Full Year')
  const [inlineFile, setInlineFile] = useState<File | null>(null)
  const [isInlineUploading, setIsInlineUploading] = useState<boolean>(false)
  const [inlineUploadProgress, setInlineUploadProgress] = useState<number>(0)
  const [inlineProcessingJob, setInlineProcessingJob] = useState<{ id: number; status: string; progressPercent: number; stepDescription: string } | null>(null)

  // MCQ Options
  const [aiLanguage, setAiLanguage] = useState<'tamil' | 'english'>('tamil')
  const [aiQuestionCount, setAiQuestionCount] = useState<number>(50)
  const [aiDifficulty, setAiDifficulty] = useState<'Medium' | 'Easy' | 'Hard' | 'Mixed'>('Medium')
  const [isAIGenerating, setIsAIGenerating] = useState<boolean>(false)
  const [aiNotice, setAiNotice] = useState<string | null>(null)
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState<any[]>([])
  const [aiUploadSuccess, setAiUploadSuccess] = useState<{ count: number; lessonTitle: string } | null>(null)
  const [isAIUploading, setIsAIUploading] = useState<boolean>(false)

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

  // Save API key to localStorage when updated
  const handleApiKeyChange = (key: string) => {
    setCloudApiKey(key)
    localStorage.setItem('tnpsc_cloud_ai_key', key.trim())
  }

  // Poll inline textbook upload progress
  useEffect(() => {
    if (!inlineProcessingJob || inlineProcessingJob.status !== 'processing' || !token) return
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/textbooks/${inlineProcessingJob.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (res.ok && data.data) {
          const tb = data.data
          if (tb.status === 'completed' || tb.status === 'failed') {
            setInlineProcessingJob(null)
            if (tb.status === 'completed') {
              setSelectedTextbookId(tb.id)
              setTextbookMode('specific')
              showToast?.('success', `Textbook "${tb.bookName}" processed and indexed successfully!`)
              fetchTextbooks?.()
            } else {
              showToast?.('error', `Textbook processing failed: ${tb.errorMessage || 'Unknown error'}`)
            }
          } else if (tb.job) {
            setInlineProcessingJob({
              id: tb.id,
              status: tb.status,
              progressPercent: tb.job.progressPercent || 0,
              stepDescription: tb.job.stepDescription || 'Processing PDF...',
            })
          }
        }
      } catch (e) {
        console.warn('Inline job polling error:', e)
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [inlineProcessingJob, token, fetchTextbooks, showToast])

  if (!isOpen) return null

  // Direct Inline PDF Upload handler
  const handleInlineUploadTextbook = async () => {
    if (!token) return
    if (!inlineFile) {
      showToast?.('error', 'Please choose a PDF file to upload.')
      return
    }
    if (!inlineFile.name.toLowerCase().endsWith('.pdf') && inlineFile.type !== 'application/pdf') {
      showToast?.('error', 'Bad Request (400): Only PDF files (.pdf) are supported.')
      return
    }

    setIsInlineUploading(true)
    setInlineUploadProgress(25)

    try {
      const autoBookName = inlineBookName.trim() || `Class ${currentClassId} ${selectedSubjectObj?.name || 'Subject'} (${inlineMedium})`
      const formData = new FormData()
      formData.append('group', aiGroupId)
      formData.append('standard', `${currentClassId}th`)
      formData.append('subject', selectedSubjectObj?.name || 'General Studies')
      formData.append('medium', inlineMedium)
      formData.append('term', inlineTerm)
      formData.append('bookName', autoBookName)
      formData.append('pdf', inlineFile)

      const res = await apiFetch('/api/textbooks/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Upload failed')

      showToast?.('success', `Textbook uploaded. Indexing started for "${autoBookName}"!`)
      fetchTextbooks?.()

      if (data.data?.id) {
        setSelectedTextbookId(data.data.id)
        setInlineProcessingJob({
          id: data.data.id,
          status: 'processing',
          progressPercent: 20,
          stepDescription: 'Extracting educational text from PDF...',
        })
      }
    } catch (err: any) {
      const friendly = await classifyFetchFailure(err, { endpointLabel: 'POST /api/textbooks/upload' })
      showToast?.('error', friendly)
    } finally {
      setIsInlineUploading(false)
      setInlineFile(null)
    }
  }

  // 1. Generate Notes Handler (Connected to new Cloud AI service)
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

    if (isNotesGenerating) return

    setIsNotesGenerating(true)
    setNotesPreview(null)
    setFullNotesPreview(null)
    setAiNotice(null)
    setNotesProgressStep('Connecting to Cloud AI & Reading Textbook...')
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
          term: inlineTerm || 'Term 1',
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
          apiKey: cloudApiKey.trim() || undefined,
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

  // 2. Generate MCQs Handler (Connected to new Cloud AI service)
  const handleGenerateMCQs = async () => {
    const activeToken = token || localStorage.getItem('tnpsc_admin_token') || ''
    if (!activeToken) {
      showToast?.('error', 'Admin authorization token missing. Please sign in again.')
      return
    }

    if (!currentLessonTitle) {
      showToast?.('error', 'Please select a lesson title to generate questions.')
      return
    }

    if (textbookMode === 'specific' && !selectedTextbookId) {
      showToast?.('error', 'Please select a specific textbook from the dropdown or switch to Automatic mode.')
      return
    }

    if (isAIGenerating) return

    setIsAIGenerating(true)
    setAiGeneratedQuestions([])
    setAiNotice(null)
    setAiUploadSuccess(null)

    try {
      const response = await apiFetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        timeoutMs: 300000,
        body: JSON.stringify({
          category: aiGroupId,
          standard: currentClassId,
          subject: selectedSubjectObj?.name || 'General Studies',
          term: inlineTerm || 'Term 1',
          unitId: currentUnitId,
          unitTitle: currentUnit?.title,
          lessonTitle: currentLessonTitle,
          lessonId: selectedLessonObj?.id,
          lessonNumber: selectedLessonObj?.lessonNumber || '1.1',
          topic: currentLessonTitle,
          language: aiLanguage,
          mode: 'mcq',
          questionCount: aiQuestionCount,
          difficulty: aiDifficulty,
          textbookMode,
          textbookId: textbookMode === 'specific' ? selectedTextbookId : undefined,
          apiKey: cloudApiKey.trim() || undefined,
          autoSaveToStaging: true,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.status === 'error') {
        const errMsg = data.message || data.error || 'Failed to generate MCQs'
        throw new Error(errMsg)
      }

      if (data.mcqs?.questions && data.mcqs.questions.length > 0) {
        setAiGeneratedQuestions(data.mcqs.questions)
        showToast?.('success', `Generated and staged ${data.mcqs.questions.length} questions for "${currentLessonTitle}"!`)
        onRefreshData?.()
      } else {
        throw new Error('No valid questions generated for this lesson.')
      }
    } catch (err: any) {
      console.error('MCQ generation error:', err)
      const msg = err.message || 'Failed to generate MCQs'
      showToast?.('error', msg)
      setAiNotice(msg)
    } finally {
      setIsAIGenerating(false)
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
          term: inlineTerm || 'Term 1',
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

  // Upload Approved MCQs to Staging
  const handleUploadApprovedMCQs = async () => {
    if (!token || aiGeneratedQuestions.length === 0) return
    setIsAIUploading(true)
    try {
      const formatted = aiGeneratedQuestions.map((q) => ({
        ...q,
        category: aiGroupId,
        classId: currentClassId,
        subject: selectedSubjectObj?.name || 'General Studies',
        unitId: currentUnitId,
        lessonTitle: currentLessonTitle,
        lessonId: selectedLessonObj?.id || null,
        topic: q.topic || currentLessonTitle,
        status: 'staging',
        targetSystem: 'study_materials',
      }))

      const res = await apiFetch('/api/study-materials/questions/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questions: formatted }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to upload questions')

      showToast?.('success', `Uploaded ${aiGeneratedQuestions.length} approved questions for "${currentLessonTitle}" to Staging!`)
      setAiUploadSuccess({ count: aiGeneratedQuestions.length, lessonTitle: currentLessonTitle })
      setAiGeneratedQuestions([])
      onRefreshData?.()
    } catch (err: any) {
      showToast?.('error', err.message || 'Failed to upload questions')
    } finally {
      setIsAIUploading(false)
    }
  }

  // Next Lesson Navigation in Syllabus
  const handleProceedToNextLesson = () => {
    const currentIndex = availableLessons.findIndex((l) => l.title === currentLessonTitle)
    if (currentIndex >= 0 && currentIndex + 1 < availableLessons.length) {
      handleLessonChange(availableLessons[currentIndex + 1].title)
    } else {
      const unitIndex = availableUnits.findIndex((u) => u.id === currentUnitId)
      if (unitIndex >= 0 && unitIndex + 1 < availableUnits.length) {
        handleUnitChange(availableUnits[unitIndex + 1].id)
      }
    }
    setAiGeneratedQuestions([])
    setAiUploadSuccess(null)
    setAiNotice(null)
  }

  return (
    <AnimatePresence>
      <div
        className="admin-modal-backdrop ai-modal-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isAIGenerating && !isNotesGenerating) {
            onClose()
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
                  Cloud AI Generator
                </span>
                <span className="ai-group-badge">
                  {TNPSC_GROUPS.find((g) => g.id === aiGroupId)?.name} • {selectedSubjectObj?.name} • {selectedStandardObj?.label}
                </span>
              </div>
              <button
                type="button"
                className="ai-modal-close-btn"
                onClick={() => {
                  onClose()
                  setAiUploadSuccess(null)
                }}
                aria-label="Close generator modal"
                title="Close Generator (Esc)"
                disabled={isAIGenerating || isNotesGenerating}
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
                    ? 'Select Group, Subject, Standard, Unit, and Lesson to generate authentic syllabus MCQs with Cloud AI.'
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
                disabled={isAIGenerating || isNotesGenerating}
              >
                <Sparkles size={15} />
                <span>MCQ Questions Generator</span>
                <span className="ai-nav-tab-pill">Classes 6–12</span>
              </button>
              <button
                type="button"
                className={`ai-nav-tab ${aiMode === 'notes' ? 'active' : ''}`}
                onClick={() => setAiMode('notes')}
                disabled={isAIGenerating || isNotesGenerating}
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
                  <span>Cloud AI Configuration</span>
                </div>
                {cloudApiKey.trim() || isKeyConfiguredOnServer ? (
                  <span className="ai-api-status-badge ai-status-connected">
                    <Check size={12} />
                    Cloud AI Ready ({serverModel})
                  </span>
                ) : (
                  <span className="ai-api-status-badge ai-status-fallback">
                    <Cpu size={12} />
                    Server Environment Active
                  </span>
                )}
              </div>
              <div className="ai-api-input-row">
                <input
                  type="password"
                  className="ai-api-input"
                  placeholder="Paste Cloud AI API Key (sk-... / AIza...) or leave blank to use server environment variable"
                  value={cloudApiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                />
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
                          return `${availableLessons[curIdx + 1].lessonNumber ? availableLessons[curIdx + 1].lessonNumber + ' ' : ''}${availableLessons[curIdx + 1].title}`
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

            {/* 3. Syllabus 5-Tier Cascading Selector & Lesson Card */}
            {!aiUploadSuccess && (
              <div className="ai-section-box">
                <h3 className="ai-section-title">
                  <Sparkles size={16} style={{ color: '#c084fc' }} />
                  <span>{aiMode === 'mcq' ? 'Syllabus MCQ Configuration (1 to 5)' : 'Syllabus Study Notes Configuration (1 to 5)'}</span>
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
                  <label style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}>
                    <BookOpen size={15} style={{ color: 'var(--gold-primary)' }} />
                    <span>6. Textbook Source Selection *</span>
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {/* Radio 1: Auto */}
                    <label className={`ai-source-radio-card ${textbookMode === 'auto' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="unifiedTbSourceMode"
                        checked={textbookMode === 'auto'}
                        onChange={() => setTextbookMode('auto')}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Use Uploaded Automatically</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Matches {currentClassId}th Standard {selectedSubjectObj?.name}
                        </div>
                      </div>
                    </label>

                    {/* Radio 2: Specific */}
                    <label className={`ai-source-radio-card ${textbookMode === 'specific' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="unifiedTbSourceMode"
                        checked={textbookMode === 'specific'}
                        onChange={() => setTextbookMode('specific')}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Select Specific Textbook</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Choose from existing uploaded books</div>
                      </div>
                    </label>

                    {/* Radio 3: Upload */}
                    <label className={`ai-source-radio-card ${textbookMode === 'upload' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="unifiedTbSourceMode"
                        checked={textbookMode === 'upload'}
                        onChange={() => setTextbookMode('upload')}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Upload New Textbook PDF</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Upload and index directly here</div>
                      </div>
                    </label>
                  </div>

                  {/* Mode: specific */}
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

                  {/* Mode: upload */}
                  {textbookMode === 'upload' && (
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
                            placeholder={`Class ${currentClassId} ${selectedSubjectObj?.name || 'Subject'}`}
                            value={inlineBookName}
                            onChange={(e) => setInlineBookName(e.target.value)}
                          />
                        </div>
                        <div className="ai-field">
                          <label>Medium</label>
                          <select
                            className="ai-select"
                            value={inlineMedium}
                            onChange={(e) => setInlineMedium(e.target.value as any)}
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
                            value={inlineTerm}
                            onChange={(e) => setInlineTerm(e.target.value)}
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
                            onChange={(e) => setInlineFile(e.target.files?.[0] || null)}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        className="admin-btn admin-btn-primary"
                        onClick={handleInlineUploadTextbook}
                        disabled={isInlineUploading || !inlineFile}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        <UploadCloud size={16} />
                        <span>{isInlineUploading ? `Uploading PDF (${inlineUploadProgress}%)...` : 'Upload & Start Background Indexing'}</span>
                      </button>

                      {inlineProcessingJob && (
                        <div style={{ marginTop: '0.75rem', padding: '0.65rem', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#fbbf24', fontWeight: 600 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <RefreshCw size={13} className="spin-icon" />
                              <span>{inlineProcessingJob.stepDescription}</span>
                            </span>
                            <span>{inlineProcessingJob.progressPercent}%</span>
                          </div>
                          <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginTop: '0.35rem' }}>
                            <div style={{ width: `${inlineProcessingJob.progressPercent}%`, height: '100%', background: '#fbbf24' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 5. Generation Settings & Action Buttons */}
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
                      onClick={handleGenerateMCQs}
                      disabled={isAIGenerating}
                    >
                      <Sparkles size={18} className={isAIGenerating ? 'spin-icon' : ''} />
                      <span>
                        {isAIGenerating
                          ? 'Generating Questions...'
                          : `Generate ${aiQuestionCount} Questions`}
                      </span>
                    </button>
                  </div>
                ) : (
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
                )}

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
                        <div style={{ background: '#131c2e', padding: '1.25rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '450px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.92rem' }}>
                          {currentPreview.content}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* 7. MCQ Questions Preview & Approval */}
            {aiMode === 'mcq' && aiGeneratedQuestions.length > 0 && !aiUploadSuccess && (
              <div className="ai-section-box" style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 className="ai-section-title" style={{ margin: 0 }}>
                    <Sparkles size={16} style={{ color: '#c084fc' }} />
                    <span>Generated Questions ({aiGeneratedQuestions.length})</span>
                  </h3>
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    onClick={handleUploadApprovedMCQs}
                    disabled={isAIUploading}
                  >
                    <Upload size={14} />
                    <span>{isAIUploading ? 'Uploading...' : `Upload ${aiGeneratedQuestions.length} to Staging`}</span>
                  </button>
                </div>

                <div style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {aiGeneratedQuestions.map((q, qIdx) => (
                    <div key={qIdx} className="ai-lesson-card" style={{ marginBottom: '0.75rem', padding: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--gold-primary)', marginRight: '0.4rem' }}>Q{qIdx + 1}.</span>
                          {q.question}
                        </div>
                        <button
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                          onClick={() => setAiGeneratedQuestions((prev) => prev.filter((_, i) => i !== qIdx))}
                          title="Remove question"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', marginTop: '0.5rem' }}>
                        {q.options.map((opt: string, optIdx: number) => {
                          const isCorrect = q.correctAnswer === optIdx
                          return (
                            <div
                              key={optIdx}
                              style={{
                                padding: '0.45rem 0.65rem',
                                borderRadius: '6px',
                                background: isCorrect ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                border: isCorrect ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                                color: isCorrect ? '#86efac' : 'inherit',
                                fontSize: '0.82rem',
                                fontWeight: isCorrect ? 600 : 400,
                              }}
                            >
                              <span style={{ fontWeight: 700, marginRight: '0.35rem' }}>{String.fromCharCode(65 + optIdx)}.</span>
                              {opt}
                            </div>
                          )
                        })}
                      </div>

                      {q.explanation && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.65rem', borderRadius: '4px' }}>
                          <strong style={{ color: 'var(--text-secondary)' }}>விளக்கம்: </strong>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="admin-modal-footer">
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => {
                onClose()
                setAiUploadSuccess(null)
              }}
              disabled={isAIGenerating || isNotesGenerating}
            >
              Close
            </button>
            {aiMode === 'mcq' && aiGeneratedQuestions.length > 0 && !aiUploadSuccess && (
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                disabled={isAIUploading}
                onClick={handleUploadApprovedMCQs}
              >
                <Upload size={16} />
                <span>{isAIUploading ? 'Uploading to Staging...' : `Upload ${aiGeneratedQuestions.length} Approved Questions to Staging`}</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default CloudAiGeneratorModal
