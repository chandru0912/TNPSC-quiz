import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BookOpen, CheckCircle, Info, RefreshCw, Sparkles, Zap, Cpu } from 'lucide-react'
import { apiFetch } from '../utils/api'
import {
  getStandardsForSubject,
  getSubjectsForGroup,
  getUnitsForSubjectStandard,
} from '../data/unifiedSyllabusRegistry'

export type GroupId = 'group1' | 'group2' | 'group2a' | 'group4'
export type Language = 'tamil' | 'english'
export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export interface GroupItem {
  id: GroupId
  name: string
  code: string
  badge: string
}

export interface SubjectItem {
  id: string
  name: string
  description?: string
}

export interface StandardItem {
  id: number
  label: string
  shortLabel: string
}

export interface UnitItem {
  id: number
  unitNumber: string
  title: string
  subjectName: string
  notesCount?: number
  materialsCount?: number
  hasStudyNotes?: boolean
  hasTextbook?: boolean
}

export interface LessonItem {
  lessonId: string
  lessonNumber: string
  title: string
  unitId: number
  term?: string | null
  volume?: string | null
  notesCount: number
  textbooksCount: number
  hasStudyNotes: boolean
  hasTextbook: boolean
  source?: 'study_notes' | 'google_drive' | 'syllabus'
}

export interface TextbookCandidate {
  id: number
  key: string
  sourceType: 'drive' | 'textbook'
  textbookId: number | null
  materialId: number | null
  gdriveFileId: string | null
  bookName: string
  subject: string
  standard: number
  medium: string
  term: string | null
  volume: string | null
  termOptions: string[]
  volumeOptions: string[]
  status: string
  hasExtractedText: boolean
  totalPages?: number
  extractionStatus?: string
}

export interface GeneratedQuestion {
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  lessonTitle: string
  lessonNumber?: string | null
  sourcePdf?: string | null
  sourcePage?: number | null
}

export interface GenerationResult {
  count: number
  sourceName: string
  pages: number[]
  staged: boolean
  questions: GeneratedQuestion[]
}

export interface McqCascadeGeneratorProps {
  token: string | null
  showToast?: (type: 'success' | 'error', text: string) => void
  onRefreshData?: () => void
}

const GROUPS_LIST: GroupItem[] = [
  { id: 'group1', name: 'TNPSC Group 1', code: 'Code: 497', badge: 'Degree Standard • Prelims' },
  { id: 'group2', name: 'TNPSC Group 2', code: 'Code: 495', badge: 'Degree Standard • Prelims' },
  { id: 'group2a', name: 'TNPSC Group 2A', code: 'Code: 495', badge: 'Degree Standard • Non-Interview' },
  { id: 'group4', name: 'TNPSC Group 4', code: 'Code: 496', badge: 'SSLC Standard • Single Paper' },
]

export const McqCascadeGenerator: React.FC<McqCascadeGeneratorProps> = ({
  token,
  showToast,
  onRefreshData,
}) => {
  // Step 1: TNPSC Group
  const [groupId, setGroupId] = useState<GroupId>('group4')

  // Step 2: Subject
  const [subjectId, setSubjectId] = useState('general-studies')

  // Step 3: Standard
  const [standard, setStandard] = useState(6)

  // Step 4: Unit
  const [unitId, setUnitId] = useState<number | ''>(1)
  const [unitsList, setUnitsList] = useState<UnitItem[]>([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  // Step 5: Term (Dynamic Term Selection: 5th position)
  const [term, setTerm] = useState('Term 1')
  const [termOptions, setTermOptions] = useState<string[]>(['Term 1', 'Term 2', 'Term 3'])
  const [isLoadingTerms, setIsLoadingTerms] = useState(false)

  // Step 6: Lesson Selection (Mandatory before textbook mapping)
  const [lessonsList, setLessonsList] = useState<LessonItem[]>([])
  const [selectedLessonKey, setSelectedLessonKey] = useState('')
  const [isLoadingLessons, setIsLoadingLessons] = useState(false)

  // Step 7: Automatic Textbook Selection (Mapped to Subject, Standard, Unit, Term, Lesson)
  const [textbooksList, setTextbooksList] = useState<TextbookCandidate[]>([])
  const [selectedTextbookKey, setSelectedTextbookKey] = useState('')
  const [isLoadingTextbooks, setIsLoadingTextbooks] = useState(false)

  // Step 8: Volume (when applicable)
  const [volume, setVolume] = useState('Not Applicable')
  const [volumeOptions, setVolumeOptions] = useState<string[]>(['Not Applicable'])
  const [isLoadingVolumes, setIsLoadingVolumes] = useState(false)

  // Independent Settings: Steps 9, 10, 11 (Preserved across cascading resets)
  const [language, setLanguage] = useState<Language>('tamil')
  const [questionCount, setQuestionCount] = useState(50)
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium')

  // Independent AI Provider Selection
  const [aiProvider, setAiProvider] = useState<'claude' | 'gemini'>('claude')

  // Execution & Progress State
  const [isGenerating, setIsGenerating] = useState(false)
  const [extractingMap, setExtractingMap] = useState<Record<string, boolean>>({})
  const [progress, setProgress] = useState<{ pct: number; step: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)

  // Dynamic Subjects & Standards derived from registry
  const subjects = useMemo(() => getSubjectsForGroup(groupId), [groupId])
  const standards = useMemo(
    () => getStandardsForSubject(groupId, subjectId),
    [groupId, subjectId]
  )

  const selectedLesson = useMemo(() => {
    return (
      lessonsList.find((l) => `${l.lessonNumber}:${l.title}` === selectedLessonKey) ||
      lessonsList.find((l) => l.lessonId === selectedLessonKey) ||
      null
    )
  }, [lessonsList, selectedLessonKey])

  const selectedTextbook = useMemo(() => {
    return textbooksList.find((t) => t.key === selectedTextbookKey) || null
  }, [textbooksList, selectedTextbookKey])

  const selectedUnit = useMemo(() => {
    return unitsList.find((u) => u.id === unitId) || null
  }, [unitsList, unitId])

  // Validation before MCQ generation (Part 9)
  const validationErrors = useMemo(() => {
    const errs: string[] = []
    if (!groupId) errs.push('1. Select TNPSC Group')
    if (!subjectId) errs.push('2. Select Subject')
    if (!standard) errs.push('3. Select Standard')
    if (unitId === '') errs.push('4. Select Unit')
    if (!term) errs.push('5. Select Term')
    if (!selectedLesson) errs.push('6. Select a Lesson (Mandatory)')
    if (!selectedTextbook) errs.push('7. Match a Textbook')
    if (
      selectedTextbook &&
      !selectedTextbook.hasExtractedText &&
      selectedTextbook.extractionStatus !== 'COMPLETED' &&
      selectedTextbook.extractionStatus !== 'PARTIALLY_COMPLETED'
    ) {
      errs.push('8. Extract textbook PDF text before generation')
    }
    return errs
  }, [groupId, subjectId, standard, unitId, term, selectedLesson, selectedTextbook])

  // =========================================================================
  // Cascading Reset Handlers (Part 7)
  // =========================================================================

  // 1. Group Change -> Resets: Subject, Standard, Unit, Term, Lesson, Textbook
  const handleGroupChange = (nextGroup: GroupId) => {
    setGroupId(nextGroup)
    const nextSubjects = getSubjectsForGroup(nextGroup)
    const nextSub = nextSubjects[0]?.id || 'general-studies'
    setSubjectId(nextSub)
    const nextStandards = getStandardsForSubject(nextGroup, nextSub)
    const nextStd = nextStandards[0]?.id || 6
    setStandard(nextStd)
    setUnitId('')
    setUnitsList([])
    setLessonsList([])
    setSelectedLessonKey('')
    setTextbooksList([])
    setSelectedTextbookKey('')
    setVolume('Not Applicable')
    setVolumeOptions(['Not Applicable'])
    setResult(null)
    setError(null)
    loadUnits(nextGroup, nextSub, nextStd)
  }

  // 2. Subject Change -> Resets: Standard, Unit, Term, Lesson, Textbook
  const handleSubjectChange = (nextSubject: string) => {
    setSubjectId(nextSubject)
    const nextStandards = getStandardsForSubject(groupId, nextSubject)
    const nextStd = nextStandards[0]?.id || 6
    setStandard(nextStd)
    setUnitId('')
    setUnitsList([])
    setLessonsList([])
    setSelectedLessonKey('')
    setTextbooksList([])
    setSelectedTextbookKey('')
    setVolume('Not Applicable')
    setVolumeOptions(['Not Applicable'])
    setResult(null)
    setError(null)
    loadUnits(groupId, nextSubject, nextStd)
  }

  // 3. Standard Change -> Resets: Unit, Term, Lesson, Textbook
  const handleStandardChange = (nextStandard: number) => {
    setStandard(nextStandard)
    setUnitId('')
    setUnitsList([])
    setLessonsList([])
    setSelectedLessonKey('')
    setTextbooksList([])
    setSelectedTextbookKey('')
    setVolume('Not Applicable')
    setVolumeOptions(['Not Applicable'])
    setResult(null)
    setError(null)
    loadUnits(groupId, subjectId, nextStandard)
  }

  // 4. Unit Change -> Resets: Term, Lesson, Textbook
  const handleUnitChange = (nextUnitId: number | '') => {
    setUnitId(nextUnitId)
    setLessonsList([])
    setSelectedLessonKey('')
    setTextbooksList([])
    setSelectedTextbookKey('')
    setVolume('Not Applicable')
    setVolumeOptions(['Not Applicable'])
    setResult(null)
    setError(null)

    if (nextUnitId !== '') {
      loadTerms(groupId, subjectId, standard, nextUnitId)
    }
  }

  // 5. Term Change -> Resets: Lesson, Textbook
  const handleTermChange = (nextTerm: string) => {
    setTerm(nextTerm)
    setLessonsList([])
    setSelectedLessonKey('')
    setTextbooksList([])
    setSelectedTextbookKey('')
    setVolume('Not Applicable')
    setVolumeOptions(['Not Applicable'])
    setResult(null)
    setError(null)

    if (unitId !== '') {
      loadLessons(groupId, subjectId, standard, Number(unitId), nextTerm)
    }
  }

  // 6. Lesson Selection -> Refreshes: Matching Textbooks
  const handleLessonSelect = (lesson: LessonItem) => {
    const key = `${lesson.lessonNumber}:${lesson.title}`
    setSelectedLessonKey(key)
    setTextbooksList([])
    setSelectedTextbookKey('')
    setVolume('Not Applicable')
    setVolumeOptions(['Not Applicable'])
    setResult(null)
    setError(null)

    loadTextbooks(groupId, subjectId, standard, lesson.unitId, term, lesson.lessonId, lesson.title)
  }

  // 7. Textbook Selection -> Updates Volume Options
  const handleTextbookSelect = (candidate: TextbookCandidate) => {
    setSelectedTextbookKey(candidate.key)
    loadVolumes(candidate, standard, term)
  }

  // 8. Volume Change
  const handleVolumeChange = (nextVolume: string) => {
    setVolume(nextVolume)
    setResult(null)
    setError(null)
  }

  // =========================================================================
  // Data Fetching Functions
  // =========================================================================

  const loadUnits = (grp: GroupId, sub: string, std: number) => {
    setIsLoadingUnits(true)
    setError(null)

    const query = new URLSearchParams({
      groupId: grp,
      subjectId: sub,
      standardId: String(std),
    })

    apiFetch(`/api/syllabus/units?${query.toString()}`)
      .then(async (res) => {
        const data = await res.json()
        if (data.success && Array.isArray(data.units) && data.units.length > 0) {
          setUnitsList(data.units)
          const firstUnit = data.units[0]
          setUnitId(firstUnit.id)
          loadTerms(grp, sub, std, firstUnit.id)
        } else {
          const fallback = getUnitsForSubjectStandard(grp, sub, std)
          setUnitsList(fallback)
          if (fallback.length > 0) {
            setUnitId(fallback[0].id)
            loadTerms(grp, sub, std, fallback[0].id)
          }
        }
      })
      .catch(() => {
        const fallback = getUnitsForSubjectStandard(grp, sub, std)
        setUnitsList(fallback)
        if (fallback.length > 0) {
          setUnitId(fallback[0].id)
          loadTerms(grp, sub, std, fallback[0].id)
        }
      })
      .finally(() => {
        setIsLoadingUnits(false)
      })
  }

  const loadTerms = (grp: GroupId, sub: string, std: number, uId: number) => {
    setIsLoadingTerms(true)

    const query = new URLSearchParams({
      groupId: grp,
      subjectId: sub,
      standardId: String(std),
      unitId: String(uId),
    })

    apiFetch(`/api/study-materials/terms?${query.toString()}`)
      .then(async (res) => {
        const data = await res.json()
        if (data.success && Array.isArray(data.terms) && data.terms.length > 0) {
          setTermOptions(data.terms)
          const chosenTerm = data.selected || data.terms[0]
          setTerm(chosenTerm)
          loadLessons(grp, sub, std, uId, chosenTerm)
        } else {
          const fallback = std >= 10 ? ['Full Year'] : ['Term 1', 'Term 2', 'Term 3']
          setTermOptions(fallback)
          setTerm(fallback[0])
          loadLessons(grp, sub, std, uId, fallback[0])
        }
      })
      .catch(() => {
        const fallback = std >= 10 ? ['Full Year'] : ['Term 1', 'Term 2', 'Term 3']
        setTermOptions(fallback)
        setTerm(fallback[0])
        loadLessons(grp, sub, std, uId, fallback[0])
      })
      .finally(() => {
        setIsLoadingTerms(false)
      })
  }

  const loadLessons = (grp: GroupId, sub: string, std: number, uId: number, t: string) => {
    setIsLoadingLessons(true)
    setError(null)

    const query = new URLSearchParams({
      groupId: grp,
      subjectId: sub,
      standardId: String(std),
      unitId: String(uId),
      term: t,
    })

    apiFetch(`/api/study-materials/lessons?${query.toString()}`)
      .then(async (res) => {
        const data = await res.json()
        if (data.success && Array.isArray(data.lessons)) {
          setLessonsList(data.lessons)
        } else {
          setLessonsList([])
        }
      })
      .catch((err) => {
        console.error('Error fetching lessons:', err)
        setError('Failed to load lessons from Study Materials database.')
        setLessonsList([])
      })
      .finally(() => {
        setIsLoadingLessons(false)
      })
  }

  const loadTextbooks = (
    grp: GroupId,
    sub: string,
    std: number,
    uId: number,
    t: string,
    lessonId: string,
    lessonTitle: string
  ) => {
    setIsLoadingTextbooks(true)
    setError(null)

    const query = new URLSearchParams({
      groupId: grp,
      subjectId: sub,
      standardId: String(std),
      unitId: String(uId),
      term: t,
      lessonId,
      lessonTitle,
    })

    apiFetch(`/api/study-materials/textbooks?${query.toString()}`)
      .then(async (res) => {
        const data = await res.json()
        if (data.success && Array.isArray(data.textbooks) && data.textbooks.length > 0) {
          setTextbooksList(data.textbooks)

          // Auto-select:
          // 1. If only 1 textbook, select it!
          // 2. If multiple, select the one matching the active Language preference (Tamil / English)
          let autoChoice = data.textbooks[0]
          if (data.textbooks.length > 1) {
            const prefMedium = language === 'tamil' ? 'Tamil' : 'English'
            const mediumMatch = data.textbooks.find(
              (tb: TextbookCandidate) => tb.medium.toLowerCase() === prefMedium.toLowerCase()
            )
            if (mediumMatch) autoChoice = mediumMatch
          }

          setSelectedTextbookKey(autoChoice.key)
          loadVolumes(autoChoice, std, t)
        } else {
          setTextbooksList([])
          setSelectedTextbookKey('')
        }
      })
      .catch((err) => {
        console.error('Error fetching textbooks:', err)
        setError('Failed to load textbooks associated with this lesson.')
        setTextbooksList([])
        setSelectedTextbookKey('')
      })
      .finally(() => {
        setIsLoadingTextbooks(false)
      })
  }

  const loadVolumes = (candidate: TextbookCandidate, std: number, t: string) => {
    setIsLoadingVolumes(true)

    const query = new URLSearchParams({
      standardId: String(std),
      term: t,
    })
    if (candidate.materialId) query.set('materialId', String(candidate.materialId))
    if (candidate.textbookId) query.set('textbookId', String(candidate.textbookId))

    apiFetch(`/api/study-materials/volumes?${query.toString()}`)
      .then(async (res) => {
        const data = await res.json()
        if (data.success && Array.isArray(data.volumes) && data.volumes.length > 0) {
          setVolumeOptions(data.volumes)
          setVolume(data.selected || data.volumes[0])
        } else {
          setVolumeOptions(['Not Applicable'])
          setVolume('Not Applicable')
        }
      })
      .catch(() => {
        setVolumeOptions(['Not Applicable'])
        setVolume('Not Applicable')
      })
      .finally(() => {
        setIsLoadingVolumes(false)
      })
  }

  // Initial load on mount
  useEffect(() => {
    loadUnits(groupId, subjectId, standard)
    apiFetch('/api/ai/providers')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const active = data.find((p: any) => p.isActive)
          if (active && (active.provider === 'gemini' || active.provider === 'claude')) {
            setAiProvider(active.provider)
          }
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // =========================================================================
  // Manual / Real-time PDF Extraction
  // =========================================================================

  const handleTriggerExtract = async (candidate: TextbookCandidate) => {
    const activeToken = token || localStorage.getItem('tnpsc_admin_token') || ''
    const key = candidate.key
    setExtractingMap((prev) => ({ ...prev, [key]: true }))

    try {
      let endpoint = ''
      if (candidate.materialId) {
        endpoint = `/api/drive/extract/${candidate.materialId}?wait=true`
      } else if (candidate.textbookId) {
        endpoint = `/api/textbooks/${candidate.textbookId}/extract?wait=true`
      }

      if (endpoint) {
        const res = await apiFetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${activeToken}` },
        })
        const data = await res.json()
        if (data.status === 'success' || data.success) {
          showToast?.('success', 'PDF text successfully extracted and indexed!')
          if (selectedLesson) {
            loadTextbooks(
              groupId,
              subjectId,
              standard,
              selectedLesson.unitId,
              term,
              selectedLesson.lessonId,
              selectedLesson.title
            )
          }
        } else {
          showToast?.('error', data.message || 'Extraction failed.')
        }
      }
    } catch (err: any) {
      showToast?.('error', err.message || 'Failed to extract PDF text.')
    } finally {
      setExtractingMap((prev) => ({ ...prev, [key]: false }))
    }
  }

  // =========================================================================
  // Generate MCQs with Claude AI Execution (Part 8 & 9)
  // =========================================================================

  const handleGenerate = async () => {
    const activeToken = token || localStorage.getItem('tnpsc_admin_token') || ''
    if (!activeToken) {
      setError('Admin authorization token missing. Please sign in again.')
      return
    }

    if (validationErrors.length > 0) {
      setError(validationErrors[0])
      return
    }

    if (!selectedLesson || !selectedTextbook) return

    setIsGenerating(true)
    setProgress({ pct: 5, step: `Connecting to ${aiProvider === 'claude' ? 'Claude AI' : 'Gemini AI'} & verifying lesson textbook...` })
    setError(null)
    setResult(null)

    const payload = {
      provider: aiProvider,
      category: groupId,
      standard,
      subject: subjects.find((s) => s.id === subjectId)?.name || 'General Studies',
      term: term !== 'Not Applicable' ? term : undefined,
      volume: volume !== 'Not Applicable' ? volume : undefined,
      unitId: Number(unitId) || 1,
      unitTitle: selectedUnit?.title || `Unit ${unitId}`,
      lessonTitle: selectedLesson.title,
      lessonId: selectedLesson.lessonId || undefined,
      lessonNumber: selectedLesson.lessonNumber || undefined,
      topic: selectedLesson.title,
      language,
      mode: 'mcq',
      questionCount,
      difficulty,
      textbookMode: selectedTextbook.sourceType === 'drive' ? 'gdrive' : 'specific',
      textbookId: selectedTextbook.textbookId || undefined,
      gdriveFileId: selectedTextbook.gdriveFileId || undefined,
      gdriveMaterialId: selectedTextbook.materialId || undefined,
      autoSaveToStaging: true,
    }

    try {
      const res = await apiFetch('/api/ai/generate?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify(payload),
        timeoutMs: 0,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message || `Generation failed with HTTP ${res.status}.`)
      }
      if (!res.body) throw new Error('Streaming response is not available in this browser.')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let completed: any = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const event of events) {
          const line = event.split('\n').find((part) => part.startsWith('data:'))
          if (!line) continue
          let data: any
          try {
            data = JSON.parse(line.slice(5).trim())
          } catch {
            continue
          }
          if (data.type === 'progress') {
            setProgress({
              pct: Number(data.progressPercent || 0),
              step: String(data.stepName || 'Generating...'),
            })
          } else if (data.type === 'complete') {
            completed = data
          } else if (data.type === 'error' || data.status === 'error') {
            throw new Error(data.error || data.message || 'Claude MCQ generation failed.')
          }
        }
      }

      if (!completed) throw new Error('Claude did not return a completion event. Please try again.')
      const questions: GeneratedQuestion[] = Array.isArray(completed?.mcqs?.questions)
        ? completed.mcqs.questions
        : []
      if (questions.length === 0) {
        throw new Error('Claude returned no verified questions for this lesson.')
      }

      setResult({
        count: questions.length,
        sourceName: completed?.textbookUsed?.name || selectedTextbook.bookName,
        pages: Array.isArray(completed?.textbookUsed?.relevantPages)
          ? completed.textbookUsed.relevantPages
          : [],
        staged: completed?.mcqs?.status === 'staging',
        questions,
      })
      setProgress({ pct: 100, step: 'Completed' })
      showToast?.('success', `${questions.length} lesson-grounded questions saved to Staging.`)
      onRefreshData?.()
    } catch (err: any) {
      const message = err?.message || 'MCQ generation failed.'
      setError(message)
      showToast?.('error', message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="ai-section-box">
      <h3 className="ai-section-title">
        <Sparkles size={16} style={{ color: '#c084fc' }} />
        <span>TNPSC Syllabus-Wise Claude AI MCQ Generator</span>
      </h3>

      {/* =====================================================================
          PART 1 & 2: STRICT SELECTION ORDER (Steps 1 to 5)
          1. TNPSC Group
          2. Subject
          3. Standard
          4. Unit
          5. Term (Dynamic: 5th position)
      ====================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {/* 1. TNPSC Group */}
        <div className="ai-field">
          <label>1. TNPSC Group *</label>
          <select
            className="ai-select"
            value={groupId}
            onChange={(e) => handleGroupChange(e.target.value as GroupId)}
          >
            {GROUPS_LIST.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Subject */}
        <div className="ai-field">
          <label>2. Subject *</label>
          <select
            className="ai-select"
            value={subjectId}
            onChange={(e) => handleSubjectChange(e.target.value)}
          >
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Standard */}
        <div className="ai-field">
          <label>3. Standard *</label>
          <select
            className="ai-select"
            value={standard}
            onChange={(e) => handleStandardChange(Number(e.target.value))}
          >
            {standards.map((std) => (
              <option key={std.id} value={std.id}>
                {std.label}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Unit */}
        <div className="ai-field">
          <label>4. Unit *</label>
          <select
            className="ai-select"
            value={unitId}
            onChange={(e) => handleUnitChange(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={isLoadingUnits}
          >
            <option value="">-- Select Unit --</option>
            {unitsList.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unitNumber}: {unit.title} {unit.hasStudyNotes ? '★ (Notes)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 5. Term (Dynamic Term Selection: 5th position) */}
        <div className="ai-field">
          <label>5. Term *</label>
          <select
            className="ai-select"
            value={term}
            onChange={(e) => handleTermChange(e.target.value)}
            disabled={!unitId || isLoadingTerms}
          >
            {termOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* =====================================================================
          PART 3: DYNAMIC LESSON SELECTION (Step 6)
          Mandatory before proceeding to textbook mapping
      ====================================================================== */}
      <div className="ai-field" style={{ marginTop: '0.95rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.35rem',
          }}
        >
          <label style={{ margin: 0 }}>
            6. Lesson Selection ({term}) *
          </label>
          {lessonsList.length > 0 && (
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {lessonsList.length} lesson{lessonsList.length > 1 ? 's' : ''} available
            </span>
          )}
        </div>

        {isLoadingLessons ? (
          <div className="ai-notice-box">
            <RefreshCw
              size={14}
              className="spin-icon"
              style={{ display: 'inline', marginRight: '0.4rem' }}
            />
            Loading lessons for {term}...
          </div>
        ) : !unitId ? (
          <div className="ai-notice-box">Select a Unit above to load its connected lessons.</div>
        ) : lessonsList.length === 0 ? (
          <div
            className="ai-notice-box"
            style={{
              background: 'rgba(245, 158, 11, 0.12)',
              borderColor: 'rgba(245, 158, 11, 0.35)',
              color: '#fcd34d',
            }}
          >
            No lessons registered for Unit {unitId} in {term}. Try selecting another term or unit.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: '0.5rem',
              maxHeight: '280px',
              overflowY: 'auto',
              paddingRight: '0.35rem',
            }}
          >
            {lessonsList.map((lesson) => {
              const active =
                selectedLessonKey === `${lesson.lessonNumber}:${lesson.title}` ||
                selectedLessonKey === lesson.lessonId
              return (
                <button
                  key={`${lesson.lessonNumber}-${lesson.title}`}
                  type="button"
                  className={`ai-lesson-card ${active ? 'active' : ''}`}
                  onClick={() => handleLessonSelect(lesson)}
                  style={{
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderColor: active ? 'var(--gold-primary)' : undefined,
                    background: active ? 'rgba(234, 179, 8, 0.08)' : undefined,
                  }}
                >
                  <div className="ai-lesson-meta-row">
                    <span
                      className="ai-lesson-pill"
                      style={{ color: 'var(--gold-primary)', fontWeight: 600 }}
                    >
                      Lesson {lesson.lessonNumber}
                    </span>
                    <span className="ai-lesson-pill">{lesson.term || term}</span>
                    <span className="ai-lesson-pill">Unit {lesson.unitId}</span>
                    {lesson.hasStudyNotes && (
                      <span
                        className="ai-lesson-pill"
                        style={{ color: '#86efac', background: 'rgba(34, 197, 94, 0.15)' }}
                      >
                        ✓ Notes ({lesson.notesCount})
                      </span>
                    )}
                    {lesson.hasTextbook && (
                      <span
                        className="ai-lesson-pill"
                        style={{ color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)' }}
                      >
                        ✓ Textbook ({lesson.textbooksCount})
                      </span>
                    )}
                  </div>
                  <div
                    className="ai-lesson-title-display"
                    style={{ fontSize: '0.88rem', marginTop: '0.3rem', fontWeight: 600 }}
                  >
                    {lesson.title}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* =====================================================================
          PART 4 & 6: AUTOMATIC TEXTBOOK SELECTION & DISPLAY (Step 7)
          Appears automatically based on Subject, Standard, Unit, Term, Lesson
      ====================================================================== */}
      <div className="ai-field" style={{ marginTop: '0.95rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.35rem',
          }}
        >
          <label style={{ margin: 0 }}>
            7. Automatically Matched Textbook(s) *
          </label>
          {textbooksList.length > 0 && (
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {textbooksList.length} mapped textbook{textbooksList.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {!selectedLesson ? (
          <div className="ai-notice-box">
            <Info size={14} style={{ display: 'inline', marginRight: '0.35rem' }} />
            Select a Lesson above to automatically match the prescribed Samacheer Kalvi textbook.
          </div>
        ) : isLoadingTextbooks ? (
          <div className="ai-notice-box">
            <RefreshCw
              size={14}
              className="spin-icon"
              style={{ display: 'inline', marginRight: '0.4rem' }}
            />
            Matching Samacheer Kalvi textbooks for &ldquo;{selectedLesson.title}&rdquo;...
          </div>
        ) : textbooksList.length === 0 ? (
          <div
            className="ai-notice-box"
            style={{
              background: 'rgba(245, 158, 11, 0.12)',
              borderColor: 'rgba(245, 158, 11, 0.35)',
              color: '#fcd34d',
            }}
          >
            No textbook mapped yet for &ldquo;{selectedLesson.title}&rdquo;. Please upload the
            prescribed Samacheer Kalvi textbook PDF to Google Drive.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {textbooksList.map((candidate) => {
              const active = candidate.key === selectedTextbookKey
              const isExtracted =
                candidate.hasExtractedText ||
                candidate.extractionStatus === 'COMPLETED' ||
                candidate.extractionStatus === 'PARTIALLY_COMPLETED'
              const isExtracting =
                extractingMap[candidate.key] ||
                candidate.extractionStatus === 'PROCESSING' ||
                candidate.extractionStatus === 'EXTRACTING' ||
                candidate.extractionStatus === 'OCR_PROCESSING'

              return (
                <div
                  key={candidate.key}
                  className={`ai-source-radio-card ${active ? 'active' : ''}`}
                  onClick={() => handleTextbookSelect(candidate)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.85rem',
                    borderRadius: '8px',
                    border: active
                      ? '1.5px solid var(--gold-primary)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    background: active
                      ? 'rgba(234, 179, 8, 0.08)'
                      : 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <BookOpen
                    size={22}
                    style={{
                      color: active ? 'var(--gold-primary)' : '#9ca3af',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          color: active ? '#fef08a' : 'inherit',
                        }}
                      >
                        {candidate.bookName}
                      </span>
                      {active && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#86efac',
                            background: 'rgba(34, 197, 94, 0.2)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          SELECTED ✓
                        </span>
                      )}
                    </div>

                    {/* Metadata Badges */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.35rem',
                        marginTop: '0.4rem',
                      }}
                    >
                      <span className="ai-lesson-pill" style={{ color: '#93c5fd' }}>
                        Class {candidate.standard}
                      </span>
                      <span className="ai-lesson-pill" style={{ color: '#fed7aa' }}>
                        Subject: {candidate.subject}
                      </span>
                      <span className="ai-lesson-pill" style={{ color: '#a7f3d0' }}>
                        Medium: {candidate.medium}
                      </span>
                      {candidate.term && (
                        <span className="ai-lesson-pill" style={{ color: '#fbcfe8' }}>
                          {candidate.term}
                        </span>
                      )}
                      {candidate.volume && candidate.volume !== 'Not Applicable' && (
                        <span className="ai-lesson-pill">{candidate.volume}</span>
                      )}
                      <span className="ai-lesson-pill" style={{ color: 'var(--text-muted)' }}>
                        {candidate.sourceType === 'drive'
                          ? '📁 Google Drive Storage'
                          : '📚 Textbooks Database'}
                      </span>
                      {candidate.gdriveFileId && (
                        <span className="ai-lesson-pill" style={{ color: '#c084fc' }}>
                          PDF File ID: {candidate.gdriveFileId.slice(0, 12)}...
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Extraction & Status Action */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '0.35rem',
                      flexShrink: 0,
                    }}
                  >
                    {isExtracted ? (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: '#86efac',
                          background: 'rgba(34, 197, 94, 0.15)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckCircle size={12} />
                        ✓ {candidate.totalPages || 'Full'} Pages Indexed
                      </span>
                    ) : isExtracting ? (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: '#93c5fd',
                          background: 'rgba(59, 130, 246, 0.15)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <RefreshCw size={12} className="spin-icon" />
                        Extracting PDF...
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTriggerExtract(candidate)
                        }}
                        style={{
                          fontSize: '0.74rem',
                          color: '#fbbf24',
                          background: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Zap size={12} />⚡ Extract PDF Text
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* =====================================================================
          PART 5: DYNAMIC VOLUME (Step 8) & GENERATION OPTIONS (Steps 9 to 11)
          8. Volume (when applicable)
          9. Language
          10. Questions Count
          11. Difficulty
      ====================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
          gap: '0.75rem',
          marginTop: '1rem',
        }}
      >
        {/* 8. Volume (when applicable) */}
        <div className="ai-field">
          <label>8. Volume</label>
          <select
            className="ai-select"
            value={volume}
            onChange={(e) => handleVolumeChange(e.target.value)}
            disabled={!selectedTextbook || isLoadingVolumes}
          >
            {volumeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* 9. Language */}
        <div className="ai-field">
          <label>9. Language</label>
          <select
            className="ai-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            <option value="tamil">Tamil (தமிழ்)</option>
            <option value="english">English</option>
          </select>
        </div>

        {/* 10. Questions Count */}
        <div className="ai-field">
          <label>10. Questions Count</label>
          <select
            className="ai-select"
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
          >
            <option value={10}>10 Questions</option>
            <option value={20}>20 Questions</option>
            <option value={25}>25 Questions</option>
            <option value={30}>30 Questions</option>
            <option value={50}>50 Questions</option>
            <option value={100}>100 Questions</option>
            <option value={200}>200 Questions</option>
          </select>
        </div>

        {/* 11. Difficulty */}
        <div className="ai-field">
          <label>11. Difficulty</label>
          <select
            className="ai-select"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          >
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Error & Validation Notice */}
      {error && (
        <div
          className="ai-notice-box"
          style={{
            marginTop: '0.85rem',
            background: 'rgba(239, 68, 68, 0.12)',
            borderColor: 'rgba(239, 68, 68, 0.35)',
            color: '#fca5a5',
          }}
        >
          <AlertTriangle size={14} style={{ display: 'inline', marginRight: '0.35rem' }} /> {error}
        </div>
      )}

      {/* AI Provider Selector Pill Row */}
      <div
        style={{
          marginTop: '1.25rem',
          padding: '0.75rem 1rem',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cpu size={16} style={{ color: aiProvider === 'claude' ? '#c084fc' : '#38bdf8' }} />
          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#f8fafc' }}>AI Provider Engine:</span>
        </div>
        <div style={{ display: 'inline-flex', padding: '3px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <button
            type="button"
            onClick={() => setAiProvider('claude')}
            disabled={isGenerating}
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '6px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              background: aiProvider === 'claude' ? 'rgba(192, 132, 252, 0.25)' : 'transparent',
              color: aiProvider === 'claude' ? '#e9d5ff' : '#94a3b8',
              boxShadow: aiProvider === 'claude' ? '0 2px 8px rgba(192, 132, 252, 0.2)' : 'none',
            }}
          >
            🟣 Anthropic Claude AI
          </button>
          <button
            type="button"
            onClick={() => setAiProvider('gemini')}
            disabled={isGenerating}
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '6px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              background: aiProvider === 'gemini' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
              color: aiProvider === 'gemini' ? '#bae6fd' : '#94a3b8',
              boxShadow: aiProvider === 'gemini' ? '0 2px 8px rgba(56, 189, 248, 0.2)' : 'none',
            }}
          >
            🔵 Google Gemini AI
          </button>
        </div>
      </div>

      {/* =====================================================================
          STEP 12: GENERATE MCQS WITH CLAUDE OR GEMINI AI
      ====================================================================== */}
      <div style={{ marginTop: '0.85rem' }}>
        <button
          className="ai-generate-action-btn"
          onClick={handleGenerate}
          disabled={isGenerating || validationErrors.length > 0}
          style={{
            opacity: isGenerating || validationErrors.length > 0 ? 0.6 : 1,
            cursor: isGenerating || validationErrors.length > 0 ? 'not-allowed' : 'pointer',
            background: aiProvider === 'claude'
              ? 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)'
              : 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
            color: '#000000',
            fontWeight: 700,
          }}
        >
          {isGenerating ? (
            <RefreshCw size={18} className="spin-icon" />
          ) : (
            <Sparkles size={18} />
          )}
          <span>
            {isGenerating
              ? `Generating MCQs with ${aiProvider === 'claude' ? 'Claude AI' : 'Gemini AI'}...`
              : `12. Generate ${questionCount} MCQs with ${aiProvider === 'claude' ? 'Claude AI' : 'Gemini AI'}`}
          </span>
        </button>

        {validationErrors.length > 0 && !isGenerating && (
          <div
            style={{
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
              marginTop: '0.35rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <Info size={12} />
            <span>Required before generation: {validationErrors[0]}</span>
          </div>
        )}
      </div>

      {/* Real-time Progress Bar */}
      {isGenerating && progress && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.85rem',
            background: 'rgba(234, 179, 8, 0.12)',
            border: '1px solid rgba(234, 179, 8, 0.35)',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.85rem',
              color: '#fbbf24',
              fontWeight: 600,
            }}
          >
            <span>{progress.step}</span>
            <span>{progress.pct}%</span>
          </div>
          <div
            style={{
              marginTop: '0.45rem',
              height: '6px',
              borderRadius: '9999px',
              background: 'rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress.pct}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #f59e0b, #eab308)',
              }}
            />
          </div>
        </div>
      )}

      {/* Generation Results Preview */}
      {result && (
        <div className="ai-section-box" style={{ marginTop: '1rem' }}>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              color: '#86efac',
              fontWeight: 700,
            }}
          >
            <CheckCircle size={18} />
            <span>
              {result.count} questions {result.staged ? 'saved to Staging' : 'generated for review'}
            </span>
          </div>
          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              marginTop: '0.3rem',
            }}
          >
            Source Textbook: {result.sourceName}
            {result.pages.length ? ` • PDF pages ${result.pages.join(', ')}` : ''}
          </div>
          <div
            style={{
              maxHeight: '420px',
              overflowY: 'auto',
              marginTop: '0.75rem',
              paddingRight: '0.35rem',
            }}
          >
            {result.questions.map((question, index) => (
              <div key={index} className="ai-lesson-card" style={{ marginBottom: '0.65rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--gold-primary)', marginRight: '0.35rem' }}>
                    Q{index + 1}.
                  </span>
                  {question.question}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '0.35rem',
                    marginTop: '0.45rem',
                  }}
                >
                  {question.options.map((option, optionIndex) => (
                    <div
                      key={optionIndex}
                      style={{
                        padding: '0.4rem 0.55rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        background:
                          question.correctAnswer === optionIndex
                            ? 'rgba(34, 197, 94, 0.15)'
                            : 'rgba(255,255,255,0.04)',
                        border:
                          question.correctAnswer === optionIndex
                            ? '1px solid rgba(34, 197, 94, 0.4)'
                            : '1px solid rgba(255,255,255,0.06)',
                        color:
                          question.correctAnswer === optionIndex ? '#86efac' : 'inherit',
                      }}
                    >
                      <strong style={{ marginRight: '0.3rem' }}>
                        {String.fromCharCode(65 + optionIndex)}.
                      </strong>
                      {option}
                    </div>
                  ))}
                </div>
                {question.explanation && (
                  <div
                    style={{
                      fontSize: '0.76rem',
                      color: 'var(--text-muted)',
                      marginTop: '0.4rem',
                    }}
                  >
                    {question.explanation}
                  </div>
                )}
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.3rem',
                  }}
                >
                  {question.sourcePdf || result.sourceName}
                  {question.sourcePage ? ` • p. ${question.sourcePage}` : ''}
                  {question.lessonNumber ? ` • Lesson ${question.lessonNumber}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default McqCascadeGenerator
