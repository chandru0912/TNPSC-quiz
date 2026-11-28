import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Cpu,
  Eye,
  FileJson,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Wifi,
  XCircle,
} from 'lucide-react'
import { apiFetch } from '../../utils/api'
import { notifyStudentSync } from '../../utils/studentSync'
import { estimatePasteTextQuestionCount } from '../../utils/pasteTextMcqEstimator'
import { PasteTextJsonStagingPanel, type PasteConversionSession } from './PasteTextJsonStagingPanel'

export interface QuestionBankAiContext {
  category: string
  subject: string
  classId: number
  unitId: number
  lessonTitle: string
  lessonId?: string | null
  topic: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  medium: 'English' | 'Tamil' | 'Bilingual'
  targetSystem: 'study_materials' | 'main_practice'
  sourceReference?: string
}

interface Props {
  token: string
  mode?: 'previous_papers' | 'question_bank'
  onSavedToStaging?: (paperId: number, savedCount: number) => void
  questionBankContext?: QuestionBankAiContext
  onQuestionBankFieldChange?: (patch: {
    difficulty?: 'Easy' | 'Medium' | 'Hard'
    medium?: 'English' | 'Tamil' | 'Bilingual'
  }) => void
  onSavedToQuestionBank?: (insertedIds: number[], insertedCount: number) => void
  onViewInQuestionBank?: () => void
}

interface GeminiProviderInfo {
  provider: 'gemini'
  name: string
  configured: boolean
  connected: boolean
  status: string
  statusMessage: string | null
  model: string
  maskedKey: string
  availableModels: string[]
}

interface GeminiExtractedMcq {
  clientId: string
  sourceQuestionId: string
  questionNumber: number
  originalQuestionNumber: string
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  originalAnswer: number | null
  aiSuggestedAnswer: number | null
  verifiedAnswer: number | null
  correctAnswer: number | null
  verificationStatus: 'VERIFIED' | 'ORIGINAL_KEY_ONLY' | 'NEEDS_REVIEW' | 'ANSWER_MISSING' | 'ANSWER_CONFLICT'
  verificationSource: string
  explanation: string
  subject: string
  topic: string
  standard: string | null
  unit: string | null
  medium: 'Tamil' | 'English' | 'Bilingual'
  rawSourceText: string
  isDuplicate: boolean
  duplicateOfNumber: number | null
  hasDuplicateOptions: boolean
  hasFourOptions: boolean
  isApproved: boolean
  needsReview: boolean
  issues: string[]
}

interface GeminiTextBatchInfo {
  id?: number
  jobId?: number
  batchNumber: number
  status: string
  sourceQuestionIds?: string[]
  questionCount: number
  extractedCount: number
  attemptCount?: number
  modelUsed?: string | null
  geminiStatus?: string | null
  errorMessage: string | null
}

interface GeminiTextJob {
  id: number
  paperId: number | null
  model: string
  status: string
  stage: string
  expectedQuestions: number
  identifiedQuestions: number
  extractedCount: number
  convertedMcqCount: number
  verifiedCount: number
  needsReviewCount: number
  duplicateCount: number
  missingCount: number
  currentBatch: number
  totalBatches: number
  inputTokens: number | null
  outputTokens: number | null
  estimatedCostUsd: number | null
  durationMs: number
  failedBatches: number
  retryCount: number
  errorMessage: string | null
  extractedQuestions: GeminiExtractedMcq[]
  missingSourceIds: string[]
  batches?: GeminiTextBatchInfo[]
}

const CANONICAL_SUBJECTS = [
  'General Studies',
  'General Science',
  'Indian Polity',
  'Indian History',
  'Indian Geography',
  'Indian Economy',
  'Aptitude and Mental Ability',
  'General Tamil',
  'General English',
]

const GROUP_OPTIONS = [
  { value: 'group1', label: 'TNPSC Group 1' },
  { value: 'group2_2a', label: 'TNPSC Group 2 and 2A' },
  { value: 'group4', label: 'TNPSC Group 4' },
]

export const PreviousPaperAiPdfGenerator: React.FC<Props> = ({
  token,
  mode = 'previous_papers',
  onSavedToStaging,
  questionBankContext,
  onQuestionBankFieldChange,
  onSavedToQuestionBank,
  onViewInQuestionBank,
}) => {
  const isQuestionBank = mode === 'question_bank'
  const authHeaders = { Authorization: `Bearer ${token}` }

  // Google Gemini AI Provider state (exclusively Gemini for this workflow)
  const [geminiInfo, setGeminiInfo] = useState<GeminiProviderInfo | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash')
  const [testingConn, setTestingConn] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Examination / Question Bank metadata & Source Text Input
  const [group, setGroup] = useState(questionBankContext?.category || 'group4')
  const [examName, setExamName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [subject, setSubject] = useState(questionBankContext?.subject || 'General Studies')
  const [medium, setMedium] = useState<'English' | 'Tamil' | 'Bilingual'>(questionBankContext?.medium || 'English')
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>(questionBankContext?.difficulty || 'Medium')
  const [paperType, setPaperType] = useState('Prelims')
  const [expectedQuestions, setExpectedQuestions] = useState<number>(isQuestionBank ? 100 : 200)
  const [batchSize, setBatchSize] = useState<number>(15)
  // Input Method: [ Paste Text ] | [ Upload JSON ]
  const [inputMethod, setInputMethod] = useState<'text' | 'json'>('text')
  const [sourceText, setSourceText] = useState<string>('')
  const [validationReport, setValidationReport] = useState<{
    valid: boolean
    charCount: number
    estimatedQuestions: number
    errors: string[]
    warnings: string[]
  } | null>(null)
  // Isolated Paste Text -> Exact JSON -> Sequential Staging state (Question Bank Paste Text ONLY)
  const [pasteSession, setPasteSession] = useState<PasteConversionSession | null>(null)
  const [convertingPasteText, setConvertingPasteText] = useState<boolean>(false)

  // Option B: JSON File Upload state
  const jsonInputRef = useRef<HTMLInputElement | null>(null)
  const [jsonFileName, setJsonFileName] = useState<string | null>(null)
  const [jsonFileSize, setJsonFileSize] = useState<number>(0)
  const [jsonRawContent, setJsonRawContent] = useState<string>('')
  const [jsonDragOver, setJsonDragOver] = useState<boolean>(false)
  const [validatingJson, setValidatingJson] = useState<boolean>(false)
  const [showJsonPreview, setShowJsonPreview] = useState<boolean>(false)
  const [jsonReport, setJsonReport] = useState<{
    valid: boolean
    filename: string | null
    byteSize: number
    detectedCount: number
    validRecords: number
    invalidRecords: number
    missingAnswers: number
    missingOptions: number
    duplicateRecords: number
    detectedExamMeta: any
    errors: string[]
    warnings: string[]
    previewQuestions: Array<{
      sourceQuestionId: string
      questionNumber: string
      questionText: string
      options: { A: string; B: string; C: string; D: string }
      answer: string | null
      explanation: string
      issues: string[]
    }>
  } | null>(null)

  // Processing toggles
  const [answerVerificationEnabled, setAnswerVerificationEnabled] = useState(true)
  const [explanationGenerationEnabled, setExplanationGenerationEnabled] = useState(true)
  const [subjectClassificationEnabled, setSubjectClassificationEnabled] = useState(true)
  const [duplicateDetectionEnabled, setDuplicateDetectionEnabled] = useState(true)

  // Live Job, Review & Staging state
  const [submitting, setSubmitting] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [savingStaging, setSavingStaging] = useState(false)
  const [publishingStaging, setPublishingStaging] = useState(false)
  const [activeJob, setActiveJob] = useState<GeminiTextJob | null>(null)
  const [savedStagingPaperId, setSavedStagingPaperId] = useState<number | null>(null)
  const [savedQbQuestionIds, setSavedQbQuestionIds] = useState<number[]>([])
  const qbDupCheckedJobKeyRef = useRef<string>('')
  const [questions, setQuestions] = useState<GeminiExtractedMcq[]>([])

  // Keep synced with Question Bank hierarchy selections in Create New MCQ Questions modal
  useEffect(() => {
    if (!isQuestionBank || !questionBankContext) return
    if (questionBankContext.category) setGroup(questionBankContext.category)
    if (questionBankContext.subject) setSubject(questionBankContext.subject)
    if (questionBankContext.medium) setMedium(questionBankContext.medium)
    if (questionBankContext.difficulty) setDifficulty(questionBankContext.difficulty)
  }, [
    isQuestionBank,
    questionBankContext?.category,
    questionBankContext?.subject,
    questionBankContext?.medium,
    questionBankContext?.difficulty,
  ])

  // Check generated MCQs against existing Question Bank for cross-DB duplicates
  useEffect(() => {
    if (!isQuestionBank || !duplicateDetectionEnabled || !activeJob) return
    if (['queued', 'processing'].includes(activeJob.status) || questions.length === 0) return
    const checkKey = `${activeJob.id}:${questions.length}:${questionBankContext?.lessonTitle || ''}`
    if (qbDupCheckedJobKeyRef.current === checkKey) return
    qbDupCheckedJobKeyRef.current = checkKey

    let cancelled = false
    const runDbDuplicateCheck = async () => {
      try {
        const res = await apiFetch('/api/questions/validate-bulk', {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessonTitle: questionBankContext?.lessonTitle || questionBankContext?.topic || subject,
            lessonId: questionBankContext?.lessonId || null,
            subject: questionBankContext?.subject || subject,
            classId: questionBankContext?.classId || null,
            unitId: questionBankContext?.unitId || null,
            questions: questions.map((q) => ({
              clientId: q.clientId,
              question: q.questionText,
              options: [q.optionA, q.optionB, q.optionC, q.optionD],
              correctAnswer: q.correctAnswer ?? 0,
              lessonTitle: questionBankContext?.lessonTitle || questionBankContext?.topic || subject,
            })),
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (cancelled || !res.ok || !Array.isArray(json.results)) return

        const dupByClientId = new Map<string, string>()
        for (const r of json.results) {
          if (r.status === 'duplicate' && r.clientId) {
            dupByClientId.set(r.clientId, r.duplicateReason || 'Duplicate already exists in Question Bank')
          }
        }
        if (dupByClientId.size === 0) return

        setQuestions((prev) =>
          prev.map((q) => {
            const reason = dupByClientId.get(q.clientId)
            if (!reason) return q
            const note = `Question Bank Duplicate: ${reason}`
            return {
              ...q,
              isDuplicate: true,
              isApproved: false,
              needsReview: true,
              issues: q.issues.includes(note) ? q.issues : [...q.issues, note],
            }
          })
        )
      } catch {
        // non-blocking
      }
    }
    void runDbDuplicateCheck()
    return () => {
      cancelled = true
    }
  }, [
    isQuestionBank,
    duplicateDetectionEnabled,
    activeJob?.id,
    activeJob?.status,
    questions.length,
    questionBankContext?.lessonTitle,
    questionBankContext?.lessonId,
    questionBankContext?.subject,
    questionBankContext?.classId,
    questionBankContext?.unitId,
    subject,
    token,
  ])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [reviewFilter, setReviewFilter] = useState<
    'all' | 'verified' | 'needs_review' | 'duplicates' | 'missing_answer'
  >('all')
  const [reviewPage, setReviewPage] = useState(1)
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null)

  const isJobRunning = Boolean(activeJob && ['queued', 'processing'].includes(activeJob.status))

  const loadGeminiStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/previous-papers/ai/provider', { headers: authHeaders })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.status === 'success' && json.data) {
        setGeminiInfo(json.data)
        if (json.data.model) setSelectedModel(json.data.model)
      }
    } catch {
      // ignore transient error
    }
  }, [token])

  useEffect(() => {
    void loadGeminiStatus()
  }, [loadGeminiStatus])

  // Real-time job polling while Gemini processes batches
  useEffect(() => {
    if (!activeJob || !['queued', 'processing'].includes(activeJob.status)) return
    const timer = window.setInterval(async () => {
      try {
        const res = await apiFetch(`/api/admin/previous-papers/ai/jobs/${activeJob.id}`, { headers: authHeaders })
        const json = await res.json().catch(() => ({}))
        if (res.ok && json.status === 'success' && json.data) {
          const updated: GeminiTextJob = json.data
          setActiveJob(updated)
          const qs = Array.isArray(updated.extractedQuestions) ? updated.extractedQuestions : []
          setQuestions(qs)
          setSelectedIds((prev) => (prev.size === 0 && qs.length > 0 ? new Set(qs.map((q) => q.clientId)) : prev))
        }
      } catch {
        // ignore transient poll error
      }
    }, 2200)
    return () => window.clearInterval(timer)
  }, [activeJob?.id, activeJob?.status, token])

  const liveCharCount = sourceText.length
  const liveEstQuestions = useMemo(
    () => estimatePasteTextQuestionCount(sourceText),
    [sourceText]
  )

  const handleTestConnection = async () => {
    setTestingConn(true)
    setBanner(null)
    try {
      const res = await apiFetch('/api/admin/previous-papers/ai/test-connection', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      })
      const json = await res.json().catch(() => ({}))
      setBanner({
        type: res.ok && json.status === 'success' ? 'success' : 'error',
        text: json.message || 'Gemini connection check completed.',
      })
      void loadGeminiStatus()
    } finally {
      setTestingConn(false)
    }
  }

  // Shared Paste Text -> Exact Canonical JSON conversion handler (used by BOTH Question Bank and Previous Year Papers)
  const pasteApiBasePath = isQuestionBank
    ? '/api/questions/paste-import'
    : '/api/admin/previous-papers/paste-import'

  const handleConvertPasteTextToJson = async () => {
    if (!sourceText.trim()) {
      setBanner({ type: 'error', text: 'Please paste MCQ source text into the Paste Text editor first.' })
      return
    }
    setConvertingPasteText(true)
    setBanner(null)
    try {
      const metadataPayload = isQuestionBank
        ? (() => {
            const ctx = questionBankContext
            const qbLang = medium === 'English' ? 'english' : medium === 'Bilingual' ? 'bilingual' : 'tamil'
            return {
              category: ctx?.category || group,
              subject: ctx?.subject || subject,
              classId: ctx?.classId ?? 6,
              unitId: ctx?.unitId ?? 1,
              lessonTitle: (ctx?.lessonTitle || ctx?.topic || subject || 'General Lesson').trim(),
              lessonId: ctx?.lessonId || null,
              topic: (ctx?.topic || ctx?.lessonTitle || subject || 'General Topic').trim(),
              difficulty,
              language: qbLang,
              targetSystem: ctx?.targetSystem || 'main_practice',
              sourceReference: ctx?.sourceReference || null,
            }
          })()
        : {
            group,
            examName: examName.trim() || `TNPSC ${year} ${paperType} Paper`,
            year,
            subject,
            medium,
            paperType,
          }

      const res = await apiFetch(`${pasteApiBasePath}/convert`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        timeoutMs: 60000,
        body: JSON.stringify({
          sourceText,
          expectedQuestions,
          metadata: metadataPayload,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success' || !json.data) {
        setBanner({ type: 'error', text: json.message || 'Failed to convert pasted text to JSON.' })
        return
      }
      const converted: PasteConversionSession = json.data
      setPasteSession(converted)
      setValidationReport({
        valid: converted.canStage,
        charCount: converted.charCount,
        estimatedQuestions: converted.detectedQuestions,
        errors: converted.errors,
        warnings: converted.warnings,
      })
      if (converted.canStage) {
        setBanner({
          type: 'success',
          text: `Converted ${converted.detectedQuestions} question(s) into exact canonical JSON (${converted.validQuestions} valid, 0 content changes). Review the JSON preview below and click "Continue to Staging Upload".`,
        })
      } else {
        setBanner({
          type: 'error',
          text: converted.errors.join(' ') || 'Validation issues found. Inspect the preview below and fix the source text before staging.',
        })
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Error converting pasted text to JSON.' })
    } finally {
      setConvertingPasteText(false)
    }
  }

  const handleValidateInput = async () => {
    if (inputMethod === 'text') {
      await handleConvertPasteTextToJson()
      return
    }
    setBanner(null)
    try {
      const res = await apiFetch('/api/admin/previous-papers/ai/validate-text', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceText, expectedQuestions }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.status === 'success' && json.data) {
        setValidationReport(json.data)
        if (!json.data.valid) {
          setBanner({ type: 'error', text: json.data.errors.join(' ') })
        } else {
          setBanner({
            type: 'success',
            text: `Validated ${json.data.charCount.toLocaleString()} characters — detected ${json.data.estimatedQuestions} source question block(s). Ready for Google Gemini AI processing.`,
          })
        }
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Validation failed.' })
    }
  }

  const handleJsonFileSelected = async (file: File | null) => {
    if (!file) return
    setBanner(null)
    if (!file.name.toLowerCase().endsWith('.json')) {
      setBanner({ type: 'error', text: 'Only .json files are allowed. Please select a valid JSON file.' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setBanner({ type: 'error', text: 'JSON file exceeds the 5 MB maximum upload limit.' })
      return
    }

    setValidatingJson(true)
    setJsonFileName(file.name)
    setJsonFileSize(file.size)
    setShowJsonPreview(false)
    try {
      const content = await file.text()
      setJsonRawContent(content)
      const res = await apiFetch('/api/admin/previous-papers/ai/validate-json', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonContent: content, filename: file.name, expectedQuestions }),
      })
      const json = await res.json().catch(() => ({}))
      if (json.data) {
        setJsonReport(json.data)
        if (json.data.detectedExamMeta) {
          const m = json.data.detectedExamMeta
          if (m.year && Number.isInteger(Number(m.year))) setYear(Number(m.year))
          if (m.medium) setMedium(m.medium)
          if (m.paperType) setPaperType(m.paperType)
          if (m.examName) setExamName(m.examName)
        }
        if (json.data.valid) {
          setBanner({
            type: 'success',
            text: `Validated JSON "${file.name}": ${json.data.detectedCount} question(s) detected (${json.data.validRecords} valid, ${json.data.invalidRecords} invalid). Ready for Step 3 Gemini AI processing.`,
          })
        } else {
          setBanner({ type: 'error', text: (json.data.errors || []).join(' ') || 'Invalid JSON structure.' })
        }
      } else {
        setJsonReport(null)
        setBanner({ type: 'error', text: json.message || 'Failed to validate JSON file.' })
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Unable to read JSON file.' })
    } finally {
      setValidatingJson(false)
      if (jsonInputRef.current) jsonInputRef.current.value = ''
    }
  }

  const handleRemoveJsonFile = () => {
    setJsonFileName(null)
    setJsonFileSize(0)
    setJsonRawContent('')
    setJsonReport(null)
    setShowJsonPreview(false)
    if (jsonInputRef.current) jsonInputRef.current.value = ''
  }

  const canStartStep3 =
    inputMethod === 'json'
      ? Boolean(jsonRawContent.trim() && jsonReport?.valid)
      : Boolean(sourceText.trim())

  const handleStartGeminiProcessing = async () => {
    if (!canStartStep3) {
      setBanner({
        type: 'error',
        text:
          inputMethod === 'json'
            ? 'Please upload a valid .json file before running Step 3.'
            : 'Please paste Previous Year Questions into the Source Text editor first.',
      })
      return
    }
    setSubmitting(true)
    setBanner(null)
    setSavedStagingPaperId(null)
    setSavedQbQuestionIds([])
    qbDupCheckedJobKeyRef.current = ''
    try {
      const effectiveGroup = isQuestionBank ? questionBankContext?.category || group : group
      const effectiveSubject = isQuestionBank ? questionBankContext?.subject || subject : subject
      const effectiveExamName = isQuestionBank
        ? [
            questionBankContext?.subject || subject,
            questionBankContext?.classId ? `Std ${questionBankContext.classId}` : '',
            questionBankContext?.unitId ? `Unit ${questionBankContext.unitId}` : '',
            questionBankContext?.lessonTitle || questionBankContext?.topic || '',
          ]
            .filter(Boolean)
            .join(' • ') || 'Question Bank Gemini Import'
        : examName.trim() || (jsonFileName ? jsonFileName.replace(/\.json$/i, '') : `TNPSC ${year} Previous Year Paper`)

      const res = await apiFetch('/api/admin/previous-papers/ai/process-text', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMethod,
          sourceText: inputMethod === 'text' ? sourceText : undefined,
          jsonContent: inputMethod === 'json' ? jsonRawContent : undefined,
          jsonFilename: inputMethod === 'json' ? jsonFileName : undefined,
          group: effectiveGroup,
          examName: effectiveExamName,
          year,
          subject: effectiveSubject,
          medium,
          paperType: isQuestionBank ? 'QuestionBank' : paperType,
          expectedQuestions,
          batchSize,
          model: selectedModel,
          answerVerificationEnabled,
          explanationGenerationEnabled,
          subjectClassificationEnabled,
          duplicateDetectionEnabled,
          asyncMode: true,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Failed to start Gemini AI processing.' })
        return
      }
      const job: GeminiTextJob = json.data
      setActiveJob(job)
      setQuestions(Array.isArray(job.extractedQuestions) ? job.extractedQuestions : [])
      setReviewPage(1)
      setBanner({
        type: 'success',
        text: `Started Google Gemini AI Job #${job.id}: identified ${job.identifiedQuestions} source question(s) across ${job.totalBatches} batch(es). Tracking real-time progress...`,
      })
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Error starting Gemini AI processing.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelJob = async () => {
    if (!activeJob) return
    const res = await apiFetch(`/api/admin/previous-papers/ai/jobs/${activeJob.id}/cancel`, {
      method: 'POST',
      headers: authHeaders,
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.status === 'success') {
      setActiveJob(json.data)
      setBanner({ type: 'success', text: 'Processing cancelled. Already-extracted questions remain available for review.' })
    }
  }

  const handleRetryFailedBatches = async () => {
    if (!activeJob || retrying) return
    setRetrying(true)
    try {
      const res = await apiFetch(`/api/admin/previous-papers/ai/jobs/${activeJob.id}/retry-failed`, {
        method: 'POST',
        headers: authHeaders,
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.status === 'success') {
        setActiveJob(json.data)
        setBanner({ type: 'success', text: 'Retrying failed batches without duplicating already processed questions...' })
      } else {
        setBanner({ type: 'error', text: json.message || 'Retry failed.' })
      }
    } finally {
      setRetrying(false)
    }
  }

  const updateQuestion = (idx: number, patch: Partial<GeminiExtractedMcq>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)))
  }

  const deleteQuestion = (clientId: string) => {
    setQuestions((prev) => prev.filter((q) => q.clientId !== clientId).map((q, i) => ({ ...q, questionNumber: i + 1 })))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(clientId)
      return next
    })
  }

  const approveAllVerified = () => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.verificationStatus === 'VERIFIED' || q.verificationStatus === 'ORIGINAL_KEY_ONLY'
          ? { ...q, isApproved: true, needsReview: false }
          : q
      )
    )
    setBanner({ type: 'success', text: 'All verified questions marked Approved for Staging.' })
  }

  const handleSaveToStaging = async (saveMode: 'verified' | 'eligible' | 'selected') => {
    const toSave =
      saveMode === 'verified'
        ? questions.filter((q) => q.isApproved || q.verificationStatus === 'VERIFIED' || q.verificationStatus === 'ORIGINAL_KEY_ONLY')
        : saveMode === 'eligible'
          ? questions.filter(
              (q) =>
                q.questionText.trim().length > 0 &&
                q.optionA.trim().length > 0 &&
                q.optionB.trim().length > 0 &&
                q.optionC.trim().length > 0 &&
                q.optionD.trim().length > 0 &&
                q.correctAnswer !== null &&
                q.correctAnswer >= 0 &&
                q.correctAnswer <= 3
            )
          : questions.filter((q) => selectedIds.has(q.clientId))

    if (toSave.length === 0) {
      setBanner({
        type: 'error',
        text:
          saveMode === 'verified'
            ? 'No verified or approved questions available to save.'
            : saveMode === 'eligible'
              ? 'No complete 4-option MCQs with valid answers available to save.'
              : 'Select at least one question first.',
      })
      return
    }
    setSavingStaging(true)
    setBanner(null)
    try {
      if (isQuestionBank) {
        const ctx = questionBankContext
        const lessonTitle = (ctx?.lessonTitle || ctx?.topic || subject || 'General Lesson').trim()
        const validPayload = toSave.filter(
          (q) =>
            q.questionText.trim().length > 0 &&
            q.optionA.trim().length > 0 &&
            q.optionB.trim().length > 0 &&
            q.optionC.trim().length > 0 &&
            q.optionD.trim().length > 0 &&
            q.correctAnswer !== null &&
            q.correctAnswer >= 0 &&
            q.correctAnswer <= 3
        )
        if (validPayload.length === 0) {
          setBanner({
            type: 'error',
            text: 'No complete 4-option MCQs with a valid correct answer (A–D) to save. Please review and fix highlighted questions first.',
          })
          return
        }

        const qbLang = medium === 'English' ? 'english' : medium === 'Bilingual' ? 'bilingual' : 'tamil'
        const res = await apiFetch('/api/questions/upload', {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          timeoutMs: 60000,
          body: JSON.stringify({
            allowPartialStaging: true,
            aiProvider: 'gemini',
            modelId: activeJob?.model || selectedModel,
            generationJobId: activeJob ? String(activeJob.id) : null,
            sourceType: inputMethod === 'json' ? 'gemini_json' : 'gemini_text',
            category: ctx?.category || group,
            targetSystem: ctx?.targetSystem || 'main_practice',
            language: qbLang,
            lessonId: ctx?.lessonId || null,
            questions: validPayload.map((q) => ({
              category: ctx?.category || group,
              subject: ctx?.subject || q.subject || subject,
              classId: ctx?.classId || 6,
              unitId: ctx?.unitId || 1,
              lessonTitle,
              lessonId: ctx?.lessonId || null,
              topic: (ctx?.topic || q.topic || lessonTitle).trim(),
              difficulty,
              language: qbLang,
              targetSystem: ctx?.targetSystem || 'main_practice',
              question: q.questionText.trim(),
              options: [q.optionA.trim(), q.optionB.trim(), q.optionC.trim(), q.optionD.trim()],
              correctAnswer: q.correctAnswer,
              explanation: q.explanation.trim() || 'Verified via Google Gemini AI.',
              sourceReference:
                ctx?.sourceReference ||
                (ctx?.classId ? `Samacheer Kalvi Class ${ctx.classId} • Gemini AI Import` : 'Gemini AI Import'),
              verificationStatus: q.needsReview ? 'needs_review' : 'verified',
              sourceQuestionId: q.sourceQuestionId,
              sourceType: inputMethod === 'json' ? 'gemini_json' : 'gemini_text',
              aiProvider: 'gemini',
              modelId: activeJob?.model || selectedModel,
              generationJobId: activeJob ? String(activeJob.id) : null,
            })),
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.status !== 'success') {
          const detailList = Array.isArray(json.errors)
            ? ` Details: ${json.errors.slice(0, 3).map((e: any) => `#${e.index}: ${e.reason}`).join('; ')}`
            : ''
          setBanner({
            type: 'error',
            text: `${json.message || 'Failed to save questions to Question Bank Staging.'}${detailList}`,
          })
          return
        }
        const insertedIds: number[] = Array.isArray(json.insertedIds) ? json.insertedIds : []
        const insertedCount = Number(json.insertedCount ?? insertedIds.length)
        const skippedDups = Number(json.skippedDuplicates ?? 0)
        const failedCount = Number(json.validationErrorsCount ?? 0)
        if (insertedCount === 0) {
          setBanner({
            type: 'error',
            text: `0 new questions were inserted into Question Bank Staging (${skippedDups} duplicate(s) already exist in Question Bank${failedCount > 0 ? `, ${failedCount} failed validation` : ''}).`,
          })
          return
        }
        setSavedQbQuestionIds((prev) => Array.from(new Set([...prev, ...insertedIds])))
        onSavedToQuestionBank?.(insertedIds, insertedCount)
        setBanner({
          type: 'success',
          text: `Confirmed: ${insertedCount} question(s) inserted into Question Bank STAGING${skippedDups > 0 ? ` (${skippedDups} duplicate(s) skipped)` : ''}${failedCount > 0 ? ` (${failedCount} failed validation)` : ''}. Questions are NOT published yet — open Question Bank Staging/Review or click Publish Approved Questions.`,
        })
        return
      }

      const res = await apiFetch('/api/admin/previous-papers/manual-paste', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        timeoutMs: 60000,
        body: JSON.stringify({
          group,
          year,
          examStream: GROUP_OPTIONS.find((g) => g.value === group)?.label || 'TNPSC Group 4',
          subject,
          paperTitle: examName.trim() || `TNPSC ${year} Gemini Verified Paper`,
          paperType,
          medium,
          totalQuestions: Math.max(expectedQuestions, toSave.length),
          questions: toSave.map((q) => ({
            originalQuestionNumber: q.originalQuestionNumber,
            questionText: q.questionText,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            subject: q.subject,
            topic: q.topic,
            isDuplicate: q.isDuplicate,
            needsReview: q.needsReview,
            reviewNote: q.issues.length > 0 ? q.issues.join(' | ') : null,
          })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setBanner({ type: 'error', text: json.message || 'Failed to save questions to Staging.' })
        return
      }
      const paperId = Number(json.data.paper.id)
      const insertedCount = json.data.questions?.length ?? toSave.length
      setSavedStagingPaperId(paperId)
      setBanner({
        type: 'success',
        text: `Saved ${insertedCount} question(s) to STAGING (Examination #${paperId}). Questions are NOT published yet — preview or publish approved questions below.`,
      })
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Staging save failed.' })
    } finally {
      setSavingStaging(false)
    }
  }

  const handlePublishApprovedPaper = async () => {
    if (publishingStaging) return
    if (isQuestionBank) {
      if (savedQbQuestionIds.length === 0) return
      setPublishingStaging(true)
      setBanner(null)
      try {
        const pubRes = await apiFetch('/api/questions/publish', {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: savedQbQuestionIds }),
        })
        const pubJson = await pubRes.json().catch(() => ({}))
        if (!pubRes.ok || pubJson.status !== 'success') {
          setBanner({ type: 'error', text: pubJson.message || 'Publishing staged Question Bank MCQs failed.' })
          return
        }
        notifyStudentSync()
        const publishedCount = Number(pubJson.publishedCount ?? savedQbQuestionIds.length)
        setBanner({
          type: 'success',
          text: `Published ${publishedCount} approved MCQ(s) to the live Question Bank and Student Practice portal!`,
        })
        onSavedToQuestionBank?.(savedQbQuestionIds, publishedCount)
      } catch (err: any) {
        setBanner({ type: 'error', text: err?.message || 'Publishing failed.' })
      } finally {
        setPublishingStaging(false)
      }
      return
    }

    if (!savedStagingPaperId) return
    setPublishingStaging(true)
    setBanner(null)
    try {
      // First approve valid questions on the staged examination, then publish via transactional API
      await apiFetch(`/api/admin/previous-papers/${savedStagingPaperId}/questions/approve`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ approveAllValid: true }),
      })
      const pubRes = await apiFetch(`/api/admin/previous-papers/${savedStagingPaperId}/status`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      })
      const pubJson = await pubRes.json().catch(() => ({}))
      if (!pubRes.ok || pubJson.status !== 'success') {
        setBanner({ type: 'error', text: pubJson.message || 'Only administrator-approved examinations with all valid questions can be published.' })
        return
      }
      notifyStudentSync()
      setBanner({ type: 'success', text: `Examination #${savedStagingPaperId} published to Student Website!` })
      onSavedToStaging?.(savedStagingPaperId, questions.length)
    } finally {
      setPublishingStaging(false)
    }
  }

  const filteredQuestions = useMemo(() => {
    return questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => {
        if (reviewFilter === 'verified') return q.verificationStatus === 'VERIFIED' || q.verificationStatus === 'ORIGINAL_KEY_ONLY'
        if (reviewFilter === 'needs_review') return q.needsReview
        if (reviewFilter === 'duplicates') return q.isDuplicate
        if (reviewFilter === 'missing_answer') return q.verificationStatus === 'ANSWER_MISSING'
        return true
      })
  }, [questions, reviewFilter])

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE))
  const safePage = Math.min(reviewPage, totalPages)
  const paginatedQuestions = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredQuestions.slice(start, start + PAGE_SIZE)
  }, [filteredQuestions, safePage])

  const verifiedCount = questions.filter((q) => q.verificationStatus === 'VERIFIED' || q.verificationStatus === 'ORIGINAL_KEY_ONLY').length
  const needsReviewCount = questions.filter((q) => q.needsReview).length
  const dupCount = questions.filter((q) => q.isDuplicate).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      {/* SECTION 1: GOOGLE GEMINI AI STATUS & CONFIGURATION */}
      <div className="pypm-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
          <h3 className="pypm-section-heading" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>
            <Cpu size={19} style={{ color: '#38bdf8' }} />
            <span>Google Gemini AI — Text-Based MCQ Extraction &amp; Verification Engine</span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                background: geminiInfo?.connected ? 'rgba(16,185,129,0.18)' : geminiInfo?.configured ? 'rgba(56,189,248,0.16)' : 'rgba(239,68,68,0.16)',
                color: geminiInfo?.connected ? '#34d399' : geminiInfo?.configured ? '#7dd3fc' : '#fca5a5',
              }}
            >
              Gemini: {geminiInfo?.status || 'READY'}
            </span>
            <button type="button" className="pypm-btn pypm-btn-secondary pypm-btn-sm" onClick={() => void handleTestConnection()} disabled={testingConn}>
              {testingConn ? <Loader2 size={14} className="pypm-spin" /> : <Wifi size={14} />}
              <span>Test Gemini Connection</span>
            </button>
          </div>
        </div>

        {isQuestionBank && questionBankContext && (
          <div
            style={{
              padding: '0.6rem 0.85rem',
              borderRadius: '10px',
              background: 'rgba(56,189,248,0.09)',
              border: '1px solid rgba(56,189,248,0.28)',
              fontSize: '0.78rem',
              color: '#bae6fd',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.45rem',
              alignItems: 'center',
            }}
          >
            <strong style={{ color: '#38bdf8' }}>Target Question Bank Mapping:</strong>
            <span>{questionBankContext.category.toUpperCase()}</span>
            <span>·</span>
            <span>{questionBankContext.subject}</span>
            <span>·</span>
            <span>Std {questionBankContext.classId}</span>
            <span>·</span>
            <span>Unit {questionBankContext.unitId}</span>
            {questionBankContext.lessonTitle && (
              <>
                <span>·</span>
                <span>{questionBankContext.lessonTitle}</span>
              </>
            )}
            {questionBankContext.topic && (
              <>
                <span>·</span>
                <span style={{ color: '#fde047' }}>{questionBankContext.topic}</span>
              </>
            )}
          </div>
        )}

        <div className="pypm-form-grid">
          {!isQuestionBank && (
            <>
              <div className="pypm-field">
                <label className="pypm-label">TNPSC Group*</label>
                <select className="pypm-input" value={group} onChange={(e) => setGroup(e.target.value)}>
                  {GROUP_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div className="pypm-field">
                <label className="pypm-label">Examination Name*</label>
                <input
                  type="text"
                  className="pypm-input"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="e.g., TNPSC Group 4 2024 Official Paper"
                />
              </div>
              <div className="pypm-field">
                <label className="pypm-label">Examination Year*</label>
                <input type="number" className="pypm-input" value={year} onChange={(e) => setYear(Number(e.target.value))} />
              </div>
              <div className="pypm-field">
                <label className="pypm-label">Default Subject</label>
                <select className="pypm-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                  {CANONICAL_SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="pypm-field">
            <label className="pypm-label">Medium*</label>
            <select
              className="pypm-input"
              value={medium}
              onChange={(e) => {
                const next = e.target.value as 'English' | 'Tamil' | 'Bilingual'
                setMedium(next)
                onQuestionBankFieldChange?.({ medium: next })
              }}
            >
              <option value="English">English</option>
              <option value="Tamil">Tamil</option>
              <option value="Bilingual">Bilingual (Tamil + English)</option>
            </select>
          </div>
          {isQuestionBank && (
            <div className="pypm-field">
              <label className="pypm-label">Difficulty Level*</label>
              <select
                className="pypm-input"
                value={difficulty}
                onChange={(e) => {
                  const next = e.target.value as 'Easy' | 'Medium' | 'Hard'
                  setDifficulty(next)
                  onQuestionBankFieldChange?.({ difficulty: next })
                }}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          )}
          <div className="pypm-field">
            <label className="pypm-label">Gemini Model</label>
            <select className="pypm-input" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
              {(geminiInfo?.availableModels || ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash']).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="pypm-field">
            <label className="pypm-label">Expected Questions Count</label>
            <input
              type="number"
              min={1}
              max={1000}
              className="pypm-input"
              value={expectedQuestions}
              onChange={(e) => setExpectedQuestions(Number(e.target.value) || 200)}
            />
          </div>
          <div className="pypm-field">
            <label className="pypm-label">Batch Size (10–20 Qs / Batch)</label>
            <input
              type="number"
              min={5}
              max={25}
              className="pypm-input"
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value) || 15)}
            />
          </div>
          {!isQuestionBank && (
            <div className="pypm-field">
              <label className="pypm-label">Paper Type</label>
              <select className="pypm-input" value={paperType} onChange={(e) => setPaperType(e.target.value)}>
                <option value="Prelims">Prelims</option>
                <option value="Mains">Mains</option>
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', color: '#cbd5e1', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#fde047', fontWeight: 700 }}>
            <Settings2 size={14} /> Gemini Controls:
          </span>
          {[
            { label: 'Answer Verification', val: answerVerificationEnabled, set: setAnswerVerificationEnabled },
            { label: 'Explanation Generation', val: explanationGenerationEnabled, set: setExplanationGenerationEnabled },
            { label: 'Subject Classification', val: subjectClassificationEnabled, set: setSubjectClassificationEnabled },
            { label: 'Duplicate Detection', val: duplicateDetectionEnabled, set: setDuplicateDetectionEnabled },
          ].map((t) => (
            <label key={t.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
              <input type="checkbox" className="pypm-checkbox" checked={t.val} onChange={(e) => t.set(e.target.checked)} />
              <span>{t.label}</span>
            </label>
          ))}
        </div>

        {banner && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '11px',
              background: banner.type === 'success' ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
              border: `1px solid ${banner.type === 'success' ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)'}`,
              color: banner.type === 'success' ? '#6ee7b7' : '#fca5a5',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {banner.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span>{banner.text}</span>
          </div>
        )}
      </div>

      {/* SECTION 2: STEP 2 — TWO INPUT METHODS: [ Paste Text ] [ Upload JSON ] */}
      <div className="pypm-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
          <h3 className="pypm-section-heading" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>
            {inputMethod === 'json' ? <FileJson size={19} /> : <ClipboardPaste size={19} />}
            <span>
              {isQuestionBank
                ? 'STEP 2 — Paste MCQ Source Text or Upload JSON File'
                : 'STEP 2 — Paste Previous Year Questions or Upload JSON File'}
            </span>
          </h3>

          {/* Segmented Control: [ Paste Text ] [ Upload JSON ] */}
          <div
            role="tablist"
            aria-label="Input Method"
            style={{
              display: 'inline-flex',
              padding: '4px',
              borderRadius: '11px',
              background: 'rgba(15,23,42,0.85)',
              border: '1px solid rgba(148,163,184,0.24)',
              gap: '4px',
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={inputMethod === 'text'}
              className={`pypm-btn pypm-btn-sm ${inputMethod === 'text' ? 'pypm-btn-purple' : 'pypm-btn-secondary'}`}
              onClick={() => {
                setInputMethod('text')
                setBanner(null)
              }}
            >
              <ClipboardPaste size={14} /> Paste Text
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inputMethod === 'json'}
              className={`pypm-btn pypm-btn-sm ${inputMethod === 'json' ? 'pypm-btn-purple' : 'pypm-btn-secondary'}`}
              onClick={() => {
                setInputMethod('json')
                setBanner(null)
              }}
            >
              <FileJson size={14} /> Upload JSON
            </button>
          </div>
        </div>

        {/* OPTION A: PASTE TEXT */}
        {inputMethod === 'text' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                onClick={() => void handleValidateInput()}
                disabled={!sourceText.trim()}
              >
                <CheckSquare size={14} /> Validate Input
              </button>
              <button
                type="button"
                className="pypm-btn pypm-btn-danger pypm-btn-sm"
                onClick={() => {
                  setSourceText('')
                  setValidationReport(null)
                  setPasteSession(null)
                }}
                disabled={!sourceText}
              >
                <Trash2 size={14} /> Clear Text
              </button>
            </div>

            <textarea
              rows={15}
              className="pypm-input"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Paste complete TNPSC Previous Year Question Paper text here (200+ English or Tamil Unicode questions supported). Original numbering, options, and answer keys are preserved without truncation..."
              style={{
                width: '100%',
                minHeight: '300px',
                fontFamily: "'Noto Sans Tamil', 'Inter', monospace",
                fontSize: '0.88rem',
                lineHeight: 1.6,
                resize: 'vertical',
              }}
            />

            {validationReport && validationReport.warnings.length > 0 && (
              <div style={{ fontSize: '0.78rem', color: '#fcd34d', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={14} /> {validationReport.warnings.join(' ')}
              </div>
            )}
          </>
        )}

        {/* OPTION B: UPLOAD JSON FILE */}
        {inputMethod === 'json' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => void handleJsonFileSelected(e.target.files?.[0] || null)}
            />

            <div
              className={`pypm-dropzone ${jsonDragOver ? 'is-dragover' : ''} ${jsonReport?.valid ? 'has-file' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setJsonDragOver(true)
              }}
              onDragLeave={() => setJsonDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setJsonDragOver(false)
                void handleJsonFileSelected(e.dataTransfer.files?.[0] || null)
              }}
            >
              <FileJson size={30} style={{ color: jsonReport?.valid ? '#34d399' : '#c084fc' }} />
              {validatingJson ? (
                <div style={{ color: '#fde047', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Loader2 size={16} className="pypm-spin" /> Validating JSON syntax &amp; structure on server...
                </div>
              ) : jsonFileName ? (
                <>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>{jsonFileName}</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    {(jsonFileSize / 1024).toFixed(1)} KB ·{' '}
                    <strong style={{ color: '#38bdf8' }}>{jsonReport?.detectedCount ?? 0} question(s) detected</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                    <button type="button" className="pypm-btn pypm-btn-secondary pypm-btn-sm" onClick={() => jsonInputRef.current?.click()}>
                      <Upload size={13} /> Replace File
                    </button>
                    <button type="button" className="pypm-btn pypm-btn-purple pypm-btn-sm" onClick={() => setShowJsonPreview((p) => !p)}>
                      <Eye size={13} /> {showJsonPreview ? 'Hide JSON Preview' : 'Preview JSON Questions'}
                    </button>
                    <button type="button" className="pypm-btn pypm-btn-danger pypm-btn-sm" onClick={handleRemoveJsonFile}>
                      <Trash2 size={13} /> Remove File
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0' }}>
                    Drag &amp; drop a Previous Year Questions <code>.json</code> file here
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                    Supports standard <code>{'{ "exam": {...}, "questions": [...] }'}</code> or direct JSON question arrays (max 5 MB)
                  </div>
                  <button
                    type="button"
                    className="pypm-btn pypm-btn-purple pypm-btn-sm"
                    style={{ marginTop: '0.35rem' }}
                    onClick={() => jsonInputRef.current?.click()}
                  >
                    <Upload size={14} /> Browse JSON File
                  </button>
                </>
              )}
            </div>

            {jsonReport && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.55rem' }}>
                {[
                  { label: 'Detected Questions', value: jsonReport.detectedCount, color: '#38bdf8' },
                  { label: 'Valid Records', value: jsonReport.validRecords, color: '#34d399' },
                  { label: 'Invalid Records', value: jsonReport.invalidRecords, color: jsonReport.invalidRecords > 0 ? '#f87171' : '#64748b' },
                  { label: 'Missing Answers', value: jsonReport.missingAnswers, color: jsonReport.missingAnswers > 0 ? '#fbbf24' : '#64748b' },
                  { label: 'Missing Options', value: jsonReport.missingOptions, color: jsonReport.missingOptions > 0 ? '#fbbf24' : '#64748b' },
                  { label: 'Duplicates', value: jsonReport.duplicateRecords, color: jsonReport.duplicateRecords > 0 ? '#c084fc' : '#64748b' },
                ].map((stat) => (
                  <div key={stat.label} className="pypm-preview-stat">
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{stat.label}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            )}

            {showJsonPreview && jsonReport && jsonReport.previewQuestions.length > 0 && (
              <div
                style={{
                  maxHeight: '280px',
                  overflowY: 'auto',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  background: 'rgba(2,6,23,0.84)',
                  border: '1px solid rgba(148,163,184,0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ color: '#fde047', fontWeight: 700 }}>
                  JSON Source Preview (showing first {Math.min(50, jsonReport.previewQuestions.length)} of {jsonReport.previewQuestions.length} records)
                </div>
                {jsonReport.previewQuestions.slice(0, 50).map((pq) => (
                  <div
                    key={pq.sourceQuestionId}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: '9px',
                      background: 'rgba(15,23,42,0.8)',
                      border: `1px solid ${pq.issues.length > 0 ? 'rgba(251,191,36,0.35)' : 'rgba(52,211,153,0.22)'}`,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                      #{pq.questionNumber}: {pq.questionText || '(Empty question text)'}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.74rem', marginTop: '0.2rem' }}>
                      A) {pq.options.A || '—'} · B) {pq.options.B || '—'} · C) {pq.options.C || '—'} · D) {pq.options.D || '—'} ·{' '}
                      <strong style={{ color: '#34d399' }}>Ans: {pq.answer || 'Missing'}</strong>
                    </div>
                    {pq.issues.length > 0 && (
                      <div style={{ color: '#fcd34d', fontSize: '0.72rem', marginTop: '0.2rem' }}>{pq.issues.join(' · ')}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 3 CTA FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', gap: '1.1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#cbd5e1' }}>
            {inputMethod === 'text' ? (
              <>
                <span>Characters: <strong style={{ color: '#fde047' }}>{liveCharCount.toLocaleString()}</strong></span>
                <span>Estimated Questions: <strong style={{ color: '#38bdf8' }}>{liveEstQuestions}</strong></span>
              </>
            ) : (
              <>
                <span>Source: <strong style={{ color: '#fde047' }}>{jsonFileName || 'No JSON file selected'}</strong></span>
                <span>Detected Questions: <strong style={{ color: '#38bdf8' }}>{jsonReport?.detectedCount ?? 0}</strong></span>
              </>
            )}
            <span>Expected Count: <strong style={{ color: '#34d399' }}>{expectedQuestions}</strong></span>
          </div>

          <button
            type="button"
            className="pypm-btn pypm-btn-primary"
            disabled={!canStartStep3 || submitting || isJobRunning || convertingPasteText}
            onClick={() => {
              if (inputMethod === 'text') {
                void handleConvertPasteTextToJson()
              } else {
                void handleStartGeminiProcessing()
              }
            }}
          >
            {submitting || isJobRunning || convertingPasteText ? <Loader2 size={16} className="pypm-spin" /> : <Sparkles size={16} />}
            <span>
              {inputMethod === 'text'
                ? convertingPasteText
                  ? 'Converting Paste Text to Exact JSON...'
                  : 'STEP 3 — CONVERT PASTE TEXT TO EXACT JSON & PREVIEW'
                : submitting
                  ? 'Submitting to Google Gemini AI...'
                  : isJobRunning
                    ? `Processing Batch ${activeJob?.currentBatch || 0}/${activeJob?.totalBatches || 1}...`
                    : `STEP 3 — PARSE ${inputMethod === 'json' ? 'JSON' : 'TEXT'} QUESTIONS WITH GEMINI AI`}
            </span>
          </button>
        </div>
      </div>

      {/* SHARED PASTE TEXT -> EXACT JSON PREVIEW & SEQUENTIAL STAGING UPLOAD PANEL (Question Bank & Previous Year Papers) */}
      {inputMethod === 'text' && pasteSession && (
        <PasteTextJsonStagingPanel
          key={pasteSession.sessionId || pasteSession.sourceSha256}
          token={token}
          session={pasteSession}
          batchSize={batchSize}
          apiBasePath={pasteApiBasePath}
          destinationLabel={isQuestionBank ? 'Question Bank STAGING' : 'Previous Year Papers STAGING'}
          onRevalidate={() => void handleConvertPasteTextToJson()}
          revalidating={convertingPasteText}
          onSessionUpdated={(updated) => {
            setPasteSession(updated)
            if (updated.expectedQuestions !== expectedQuestions) {
              setExpectedQuestions(updated.expectedQuestions)
            }
          }}
          onSavedToQuestionBank={isQuestionBank ? onSavedToQuestionBank : undefined}
          onSavedToPreviousPaper={!isQuestionBank ? (paperId, count) => {
            setSavedStagingPaperId(paperId)
            onSavedToStaging?.(paperId, count)
          } : undefined}
          onViewInQuestionBank={isQuestionBank ? onViewInQuestionBank : undefined}
        />
      )}

      {/* SECTION 3: REAL-TIME PROCESSING STAGES & COVERAGE REPORT */}
      {activeJob && (
        <div className="pypm-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
            <h3 className="pypm-section-heading" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>
              <RefreshCw size={18} className={isJobRunning ? 'pypm-spin' : ''} />
              <span>
                Gemini Processing Progress — Job #{activeJob.id} ({activeJob.status.toUpperCase()}) · Batch {activeJob.currentBatch}/{activeJob.totalBatches}
              </span>
            </h3>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              {isJobRunning && (
                <button type="button" className="pypm-btn pypm-btn-danger pypm-btn-sm" onClick={() => void handleCancelJob()}>
                  <Square size={13} /> Cancel Processing
                </button>
              )}
              {!isJobRunning && activeJob.failedBatches > 0 && (
                <button type="button" className="pypm-btn pypm-btn-purple pypm-btn-sm" disabled={retrying} onClick={() => void handleRetryFailedBatches()}>
                  {retrying ? <Loader2 size={13} className="pypm-spin" /> : <RotateCcw size={13} />}
                  <span>Retry {activeJob.failedBatches} Failed Batch(es)</span>
                </button>
              )}
            </div>
          </div>

          {/* Real Stage Indicators (no fake percentages) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', fontSize: '0.74rem' }}>
            {[
              { label: '1. Source Text Received', done: true },
              { label: `2. Questions Identified (${activeJob.identifiedQuestions})`, done: activeJob.identifiedQuestions > 0 },
              { label: `3. MCQ Conversion (${activeJob.extractedCount})`, done: activeJob.extractedCount > 0 },
              { label: `4. Answer Verification (${activeJob.verifiedCount})`, done: activeJob.status === 'completed' || activeJob.verifiedCount > 0 },
              { label: `5. Duplicate Detection (${activeJob.duplicateCount})`, done: activeJob.status === 'completed' || activeJob.status === 'partial' },
              { label: '6. Staging Completed', done: Boolean(savedStagingPaperId || savedQbQuestionIds.length > 0) },
            ].map((st) => (
              <span
                key={st.label}
                style={{
                  padding: '0.24rem 0.65rem',
                  borderRadius: '999px',
                  fontWeight: 700,
                  background: st.done ? 'rgba(16,185,129,0.18)' : 'rgba(148,163,184,0.12)',
                  color: st.done ? '#6ee7b7' : '#94a3b8',
                  border: `1px solid ${st.done ? 'rgba(52,211,153,0.4)' : 'rgba(148,163,184,0.2)'}`,
                }}
              >
                {st.label}
              </span>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '0.65rem' }}>
            {[
              { label: 'Expected Source Qs', value: activeJob.expectedQuestions, color: '#94a3b8' },
              { label: 'Identified in Source', value: activeJob.identifiedQuestions, color: '#38bdf8' },
              { label: 'Extracted MCQs', value: activeJob.extractedCount, color: '#e2e8f0' },
              { label: 'Converted 4-Opt MCQs', value: activeJob.convertedMcqCount, color: '#34d399' },
              { label: 'Answer Verified', value: activeJob.verifiedCount, color: '#4ade80' },
              { label: 'Needs Manual Review', value: activeJob.needsReviewCount, color: '#fbbf24' },
              { label: 'Duplicates Flagged', value: activeJob.duplicateCount, color: '#c084fc' },
              { label: 'Missing / Failed', value: activeJob.missingCount, color: activeJob.missingCount > 0 ? '#f87171' : '#64748b' },
            ].map((m) => (
              <div key={m.label} className="pypm-preview-stat">
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{m.label}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {activeJob.errorMessage && (
            <div
              style={{
                padding: '0.75rem 0.95rem',
                borderRadius: '10px',
                background: 'rgba(239,68,68,0.14)',
                border: '1px solid rgba(248,113,113,0.45)',
                color: '#fca5a5',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
              }}
            >
              <XCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700, color: '#fecaca', marginBottom: '0.15rem' }}>
                  Latest Gemini Processing Error (Job #{activeJob.id})
                </div>
                <div>{activeJob.errorMessage}</div>
              </div>
            </div>
          )}

          {activeJob.batches && activeJob.batches.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#cbd5e1' }}>
                Individual Batch Progress ({activeJob.batches.filter((b) => b.status === 'completed').length}/{activeJob.batches.length} Completed)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.45rem' }}>
                {activeJob.batches.map((b) => {
                  const firstId = b.sourceQuestionIds?.[0]
                  const lastId = b.sourceQuestionIds?.[b.sourceQuestionIds.length - 1]
                  const idRange = firstId && lastId ? (firstId === lastId ? firstId : `${firstId}–${lastId}`) : `${b.questionCount} Qs`
                  const isOk = b.status === 'completed'
                  const isFail = b.status === 'failed'
                  return (
                    <div
                      key={b.batchNumber}
                      style={{
                        padding: '0.55rem 0.7rem',
                        borderRadius: '9px',
                        background: 'rgba(15,23,42,0.78)',
                        border: `1px solid ${isOk ? 'rgba(52,211,153,0.38)' : isFail ? 'rgba(248,113,113,0.45)' : 'rgba(148,163,184,0.22)'}`,
                        fontSize: '0.73rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.35rem' }}>
                        <strong style={{ color: '#f8fafc' }}>
                          Batch #{b.batchNumber} ({idRange})
                        </strong>
                        <span
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            padding: '0.1rem 0.42rem',
                            borderRadius: '999px',
                            background: isOk ? 'rgba(16,185,129,0.2)' : isFail ? 'rgba(239,68,68,0.2)' : 'rgba(148,163,184,0.16)',
                            color: isOk ? '#34d399' : isFail ? '#f87171' : '#cbd5e1',
                          }}
                        >
                          {b.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ color: '#94a3b8' }}>
                        Extracted: <strong style={{ color: '#e2e8f0' }}>{b.extractedCount}/{b.questionCount}</strong>
                        {typeof b.attemptCount === 'number' && b.attemptCount > 0 ? ` · Attempts: ${b.attemptCount}` : ''}
                      </div>
                      {(b.modelUsed || b.geminiStatus) && (
                        <div style={{ color: '#7dd3fc', fontSize: '0.68rem' }}>
                          {b.modelUsed ? b.modelUsed : ''}{b.modelUsed && b.geminiStatus ? ' · ' : ''}{b.geminiStatus || ''}
                        </div>
                      )}
                      {b.errorMessage && (
                        <div style={{ color: '#fca5a5', fontSize: '0.69rem', wordBreak: 'break-word' }}>
                          {b.errorMessage}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeJob.missingSourceIds.length > 0 && (
            <div style={{ fontSize: '0.78rem', color: '#fca5a5' }}>
              Missing Source Question IDs ({activeJob.missingSourceIds.length}):{' '}
              <strong>
                {activeJob.missingSourceIds.slice(0, 40).join(', ')}
                {activeJob.missingSourceIds.length > 40 ? ` ... (+${activeJob.missingSourceIds.length - 40} more)` : ''}
              </strong>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: ADMIN PREVIEW INTERFACE & STAGING / PUBLISHING CONTROLS */}
      {questions.length > 0 && (
        <div className="pypm-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
            <h3 className="pypm-section-heading" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>
              <CheckCircle2 size={18} />
              <span>Admin MCQ Preview &amp; Verification ({questions.length} Questions)</span>
            </h3>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              <button type="button" className="pypm-btn pypm-btn-purple pypm-btn-sm" onClick={approveAllVerified}>
                <CheckSquare size={14} /> Approve All Verified ({verifiedCount})
              </button>
              <button
                type="button"
                className="pypm-btn pypm-btn-green pypm-btn-sm"
                disabled={savingStaging}
                onClick={() => void handleSaveToStaging('verified')}
              >
                {savingStaging ? <Loader2 size={14} className="pypm-spin" /> : <Save size={14} />}
                <span>{isQuestionBank ? 'Save Approved Questions to Staging' : 'Save All Verified to Staging'}</span>
              </button>
              {isQuestionBank && (
                <button
                  type="button"
                  className="pypm-btn pypm-btn-purple pypm-btn-sm"
                  disabled={savingStaging}
                  onClick={() => void handleSaveToStaging('eligible')}
                >
                  {savingStaging ? <Loader2 size={14} className="pypm-spin" /> : <Save size={14} />}
                  <span>Save All Eligible Questions to Staging</span>
                </button>
              )}
              <button
                type="button"
                className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                disabled={savingStaging || selectedIds.size === 0}
                onClick={() => void handleSaveToStaging('selected')}
              >
                <Save size={14} /> Save Selected ({selectedIds.size}) to Staging
              </button>
              {!isQuestionBank && savedStagingPaperId && (
                <>
                  <button
                    type="button"
                    className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                    onClick={() => onSavedToStaging?.(savedStagingPaperId, questions.length)}
                  >
                    <Eye size={14} /> Preview Staging Questions
                  </button>
                  <button
                    type="button"
                    className="pypm-btn pypm-btn-emerald pypm-btn-sm"
                    disabled={publishingStaging}
                    onClick={() => void handlePublishApprovedPaper()}
                  >
                    {publishingStaging ? <Loader2 size={14} className="pypm-spin" /> : <Send size={14} />}
                    <span>Publish Approved Questions</span>
                  </button>
                </>
              )}
              {isQuestionBank && savedQbQuestionIds.length > 0 && (
                <>
                  {onViewInQuestionBank && (
                    <button
                      type="button"
                      className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                      onClick={onViewInQuestionBank}
                    >
                      <Eye size={14} /> View in Question Bank (Staging)
                    </button>
                  )}
                  <button
                    type="button"
                    className="pypm-btn pypm-btn-emerald pypm-btn-sm"
                    disabled={publishingStaging}
                    onClick={() => void handlePublishApprovedPaper()}
                  >
                    {publishingStaging ? <Loader2 size={14} className="pypm-spin" /> : <Send size={14} />}
                    <span>Publish Approved Questions ({savedQbQuestionIds.length})</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: `View All Questions (${questions.length})` },
              { id: 'verified', label: `Verified (${verifiedCount})` },
              { id: 'needs_review', label: `Needs Review (${needsReviewCount})` },
              { id: 'duplicates', label: `Duplicates (${dupCount})` },
              { id: 'missing_answer', label: `Missing Answers (${questions.filter((q) => q.verificationStatus === 'ANSWER_MISSING').length})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`pypm-btn pypm-btn-sm ${reviewFilter === f.id ? 'pypm-btn-purple' : 'pypm-btn-secondary'}`}
                onClick={() => {
                  setReviewFilter(f.id as any)
                  setReviewPage(1)
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {paginatedQuestions.map(({ q, idx }) => (
              <div
                key={q.clientId}
                style={{
                  padding: '0.95rem 1.05rem',
                  borderRadius: '13px',
                  background: 'rgba(15,23,42,0.78)',
                  border: `1px solid ${q.isApproved ? 'rgba(52,211,153,0.45)' : q.needsReview ? 'rgba(251,191,36,0.4)' : 'rgba(148,163,184,0.22)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.76rem' }}>
                    <input
                      type="checkbox"
                      className="pypm-checkbox"
                      checked={selectedIds.has(q.clientId)}
                      onChange={() =>
                        setSelectedIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(q.clientId)) next.delete(q.clientId)
                          else next.add(q.clientId)
                          return next
                        })
                      }
                    />
                    <strong style={{ color: '#fde047' }}>{q.sourceQuestionId} (#{q.originalQuestionNumber})</strong>
                    <span
                      style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        fontWeight: 700,
                        background: q.verificationStatus === 'VERIFIED' || q.verificationStatus === 'ORIGINAL_KEY_ONLY' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                        color: q.verificationStatus === 'VERIFIED' || q.verificationStatus === 'ORIGINAL_KEY_ONLY' ? '#34d399' : '#fbbf24',
                      }}
                    >
                      {q.verificationStatus}
                    </span>
                    <span style={{ color: '#7dd3fc' }}>{q.subject}</span>
                    {q.isApproved && <span style={{ color: '#4ade80', fontWeight: 700 }}>APPROVED</span>}
                    {q.isDuplicate && <span style={{ color: '#f87171', fontWeight: 700 }}>DUPLICATE</span>}
                  </div>
                  <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className={`pypm-btn pypm-btn-sm ${q.isApproved ? 'pypm-btn-green' : 'pypm-btn-secondary'}`}
                      onClick={() => updateQuestion(idx, { isApproved: true, needsReview: false })}
                    >
                      <CheckCircle2 size={12} /> Approve
                    </button>
                    <button
                      type="button"
                      className="pypm-btn pypm-btn-orange pypm-btn-sm"
                      onClick={() => updateQuestion(idx, { isApproved: false, needsReview: true })}
                    >
                      <XCircle size={12} /> Reject
                    </button>
                    <button
                      type="button"
                      className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                      onClick={() => setExpandedSourceId(expandedSourceId === q.clientId ? null : q.clientId)}
                    >
                      <Eye size={12} /> Source
                    </button>
                    <button
                      type="button"
                      className="pypm-btn pypm-btn-danger pypm-btn-sm"
                      onClick={() => deleteQuestion(q.clientId)}
                      title="Delete Question"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {q.issues.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#fcd34d', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={13} /> {q.issues.join(' · ')}
                  </div>
                )}

                {expandedSourceId === q.clientId && (
                  <pre
                    style={{
                      margin: 0,
                      padding: '0.65rem',
                      borderRadius: '8px',
                      background: 'rgba(2,6,23,0.85)',
                      color: '#94a3b8',
                      fontSize: '0.74rem',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {q.rawSourceText}
                  </pre>
                )}

                <textarea
                  rows={2}
                  className="pypm-input"
                  value={q.questionText}
                  onChange={(e) => updateQuestion(idx, { questionText: e.target.value })}
                />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.45rem' }}>
                  {(['optionA', 'optionB', 'optionC', 'optionD'] as const).map((optKey, oIdx) => (
                    <div key={optKey} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="radio"
                        name={`gem-ans-${q.clientId}`}
                        checked={q.correctAnswer === oIdx}
                        onChange={() =>
                          updateQuestion(idx, {
                            correctAnswer: oIdx,
                            verifiedAnswer: oIdx,
                            verificationStatus: 'VERIFIED',
                            needsReview: false,
                          })
                        }
                      />
                      <strong style={{ color: q.correctAnswer === oIdx ? '#34d399' : '#94a3b8', fontSize: '0.78rem' }}>
                        {String.fromCharCode(65 + oIdx)})
                      </strong>
                      <input
                        type="text"
                        className="pypm-input"
                        value={q[optKey]}
                        onChange={(e) => updateQuestion(idx, { [optKey]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '0.5rem' }}>
                  <select className="pypm-input" value={q.subject} onChange={(e) => updateQuestion(idx, { subject: e.target.value })}>
                    {CANONICAL_SUBJECTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="pypm-input"
                    value={q.topic}
                    onChange={(e) => updateQuestion(idx, { topic: e.target.value })}
                    placeholder="Topic..."
                  />
                  <input
                    type="text"
                    className="pypm-input"
                    value={q.explanation}
                    onChange={(e) => updateQuestion(idx, { explanation: e.target.value })}
                    placeholder="Explanation..."
                  />
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pypm-pagination-bar">
              <span>
                Page <strong>{safePage}</strong> of <strong>{totalPages}</strong> (<strong>{filteredQuestions.length}</strong> questions)
              </span>
              <div style={{ display: 'inline-flex', gap: '0.45rem' }}>
                <button
                  type="button"
                  className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                  disabled={safePage <= 1}
                  onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  type="button"
                  className="pypm-btn pypm-btn-secondary pypm-btn-sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setReviewPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PreviousPaperAiPdfGenerator
