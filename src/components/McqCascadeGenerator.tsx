import React, { useEffect, useMemo, useState, useRef } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle,
  Cpu,
  Info,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react'
import { apiFetch } from '../utils/api'
import {
  TNPSC_GROUPS,
  getStandardsForSubject,
  getSubjectsForGroup,
  getTermsForStandard,
  getUnitsForSubjectStandardAndTerm,
  getLessonsForSelection,
  type LessonItem,
} from '../data/unifiedSyllabusRegistry'
import { dynamicSyllabusService } from '../services/dynamicSyllabusService'
import { compareLessons, compareTopics } from '../utils/naturalSort'

export type GroupId = 'group1' | 'group2' | 'group2a' | 'group4'
export type Language = 'tamil' | 'english'
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Mixed'

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
  topic?: string | null
  sourcePdf?: string | null
  sourcePage?: number | null
  aiProvider?: 'claude' | 'gemini' | string
}

export interface GenerationResult {
  count: number
  sourceName: string
  pages: number[]
  staged: boolean
  questions: GeneratedQuestion[]
  jobId?: string
  requestedCount?: number
  generatedCount?: number
  failedCount?: number
  provider?: string
  groupLabel?: string
  subject?: string
  standard?: number
  unitLabel?: string
  lessonTitle?: string
  medium?: string
  status?: string
}

export interface McqCascadeGeneratorProps {
  token: string | null
  showToast?: (type: 'success' | 'error', text: string) => void
  onRefreshData?: () => void
  onNavigateToStaging?: (jobId?: string) => void
}

export const McqCascadeGenerator: React.FC<McqCascadeGeneratorProps> = ({
  token,
  showToast,
  onRefreshData,
  onNavigateToStaging,
}) => {
  // =========================================================================
  // Dropdown States: Synchronized with Study Notes Generation
  // 1. TNPSC Group
  // 2. Subject
  // 3. Standard
  // 4. Term (4th field)
  // 5. Unit (5th field)
  // 6. Lesson Title (6th field)
  // =========================================================================

  const [groupId, setGroupId] = useState<GroupId>('group1')
  const [subjectId, setSubjectId] = useState('general-studies')
  const [standard, setStandard] = useState(6)
  const [term, setTerm] = useState('Term 1')
  const [unitId, setUnitId] = useState<number>(1)
  const [selectedLessonTitle, setSelectedLessonTitle] = useState('')

  // Step 7: Topic / Subtopic Selection
  const [availableTopics, setAvailableTopics] = useState<string[]>([])
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])

  // Textbook Candidate Grounding (Auto-matched to lesson)
  const [textbooksList, setTextbooksList] = useState<TextbookCandidate[]>([])
  const [selectedTextbookKey, setSelectedTextbookKey] = useState('')
  const [isLoadingTextbooks, setIsLoadingTextbooks] = useState(false)

  // Volume (optional / when applicable)
  const [volume, setVolume] = useState('Not Applicable')
  const [volumeOptions, setVolumeOptions] = useState<string[]>(['Not Applicable'])

  // Step 8: AI Provider Engine Selection (Independent Claude & Gemini)
  const [aiProvider, setAiProvider] = useState<'claude' | 'gemini'>('claude')
  const [claudeStatusInfo, setClaudeStatusInfo] = useState<{ configured: boolean; connected: boolean; model?: string } | null>(null)
  const [geminiStatusInfo, setGeminiStatusInfo] = useState<{ configured: boolean; connected: boolean; model?: string; status?: string } | null>(null)

  // Steps 9, 10, 11: Generation Settings
  const [questionCount, setQuestionCount] = useState(25)
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium')
  const [language, setLanguage] = useState<Language>('tamil')

  // Step 12: Execution & Progress State
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [extractingMap, setExtractingMap] = useState<Record<string, boolean>>({})
  const [progress, setProgress] = useState<{ pct: number; step: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)

  // =========================================================================
  // Synchronized Data Sources directly from unifiedSyllabusRegistry
  // (The exact single source of truth used by Study Notes Generation)
  // =========================================================================

  const [dynamicUnits, setDynamicUnits] = useState<any[]>([])
  const [dynamicLessons, setDynamicLessons] = useState<any[]>([])
  const [syncVersion, setSyncVersion] = useState(0)

  // Request sequence guards to avoid race conditions
  const lessonReqSeq = useRef(0)
  const topicReqSeq = useRef(0)
  void lessonReqSeq
  void topicReqSeq

  // Auto-subscribe to Master Syllabus updates from Study Materials Management
  useEffect(() => {
    const unsub = dynamicSyllabusService.subscribe(() => {
      setSyncVersion((v) => v + 1)
    })
    return unsub
  }, [])

  const effectiveGroupId: 'group1' | 'group2' | 'group4' =
    groupId === 'group2a' ? 'group2' : groupId

  // 1. Available subjects for selected Group
  const availableSubjects = useMemo(
    () => getSubjectsForGroup(effectiveGroupId),
    [effectiveGroupId]
  )

  // 2. Available standards for selected Group & Subject
  const availableStandards = useMemo(
    () => getStandardsForSubject(effectiveGroupId, subjectId),
    [effectiveGroupId, subjectId]
  )

  // 3. Available terms for selected Standard (Classes 6-9: Term 1, 2, 3; Classes 10-12: Full Year)
  const availableTerms = useMemo(
    () => getTermsForStandard(standard),
    [standard]
  )

  // Fetch PostgreSQL dynamic units
  useEffect(() => {
    let mounted = true
    dynamicSyllabusService
      .getUnits(effectiveGroupId, subjectId, standard)
      .then((units) => {
        if (!mounted || !units || units.length === 0) return
        setDynamicUnits(
          units.map((u) => ({
            id: u.unit_number || u.id,
            unitNumber: u.unit_code || u.unitNumber || `Unit ${u.unit_number || u.id}`,
            title: u.title,
            subjectName: u.subject_name || u.subjectName || 'General Studies',
          }))
        )
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [effectiveGroupId, subjectId, standard, syncVersion])

  // 4. Available units for selected Group, Subject, Standard & Term
  const availableUnits = useMemo(() => {
    const canonical = getUnitsForSubjectStandardAndTerm(effectiveGroupId, subjectId, standard, term)
    if (dynamicUnits.length === 0) return canonical

    const seenIds = new Set(dynamicUnits.map((u) => u.id))
    const combined = [...dynamicUnits]
    canonical.forEach((c) => {
      if (!seenIds.has(c.id)) combined.push(c)
    })
    return combined.sort((a, b) => a.id - b.id)
  }, [dynamicUnits, effectiveGroupId, subjectId, standard, term])

  // Fetch PostgreSQL dynamic lessons strictly for selected Unit
  useEffect(() => {
    let mounted = true
    const seq = ++lessonReqSeq.current
    setDynamicLessons([])

    dynamicSyllabusService
      .getLessons({
        examId: effectiveGroupId,
        subjectId,
        standardNumber: standard,
        unitNumber: Number(unitId),
        unitId: Number(unitId),
      })
      .then((lessons) => {
        if (!mounted || seq !== lessonReqSeq.current) return
        if (lessons && lessons.length > 0) {
          const mapped = lessons.map((l) => ({
            id: l.id,
            lessonNumber: l.lesson_number,
            title: l.title,
            description: l.description,
            term: l.term || 'Term 1',
            classId: l.standard_number,
            topicsCount: l.topics_count || 0,
            topics: [],
          })).sort(compareLessons)
          setDynamicLessons(mapped)

          // If current lesson doesn't belong to this unit's lessons, auto-apply the first lesson
          if (!mapped.some((m) => m.title === selectedLessonTitle)) {
            applySelectedLesson(mapped[0], groupId, subjectId, standard, Number(unitId), term)
          }
        } else {
          setDynamicLessons([])
        }
      })
      .catch(() => {
        if (mounted && seq === lessonReqSeq.current) {
          setDynamicLessons([])
        }
      })
    return () => {
      mounted = false
    }
  }, [effectiveGroupId, subjectId, standard, unitId, syncVersion])

  // 5. Available lesson titles strictly from Study Notes Generation structure
  const availableLessons = useMemo(() => {
    if (dynamicLessons.length > 0) {
      return [...dynamicLessons].sort(compareLessons)
    }
    return [...getLessonsForSelection(effectiveGroupId, subjectId, standard, Number(unitId), term)].sort(compareLessons)
  }, [dynamicLessons, effectiveGroupId, subjectId, standard, unitId, term])

  // 6. Currently selected Lesson object
  const selectedLessonObj: LessonItem | undefined = useMemo(() => {
    return availableLessons.find((l) => l.title === selectedLessonTitle) || availableLessons[0]
  }, [availableLessons, selectedLessonTitle])

  // Fetch PostgreSQL dynamic topics strictly for selected Lesson
  useEffect(() => {
    let mounted = true
    const seq = ++topicReqSeq.current
    if (selectedLessonObj?.id || selectedLessonObj?.title) {
      dynamicSyllabusService
        .getTopics(selectedLessonObj.id || '', {
          lessonTitle: selectedLessonObj.title,
          unitId: Number(unitId) || undefined,
        })
        .then((tList) => {
        if (!mounted || seq !== topicReqSeq.current) return
        if (tList.length > 0) {
          const seen = new Set<string>()
          const names = [...tList]
            .sort(compareTopics)
            .map((t) => String(t.topic_name || '').trim())
            .filter((name) => {
              const key = name.toLowerCase().replace(/\s+/g, ' ')
              if (!key || seen.has(key)) return false
              seen.add(key)
              return true
            })
          setAvailableTopics(names)
          setSelectedTopics(names)
        } else {
          const seen = new Set<string>()
          const staticTopics = (selectedLessonObj.topics || [])
            .map((t: any) => String(typeof t === 'string' ? t : t.name || '').trim())
            .filter((name) => {
              const key = name.toLowerCase().replace(/\s+/g, ' ')
              if (!key || seen.has(key)) return false
              seen.add(key)
              return true
            })
          setAvailableTopics(staticTopics)
          setSelectedTopics(staticTopics)
        }
      })
    } else {
      setAvailableTopics([])
      setSelectedTopics([])
    }
    return () => {
      mounted = false
    }
  }, [selectedLessonObj?.id, selectedLessonObj?.title, syncVersion])

  const selectedTextbook = useMemo(() => {
    return textbooksList.find((t) => t.key === selectedTextbookKey) || null
  }, [textbooksList, selectedTextbookKey])

  // =========================================================================
  // Validation before MCQ generation
  // =========================================================================

  const validationErrors = useMemo(() => {
    const errs: string[] = []
    if (!groupId) errs.push('1. Select TNPSC Group')
    if (!subjectId) errs.push('2. Select Subject')
    if (!standard) errs.push('3. Select Standard')
    if (!term) errs.push('4. Select Term')
    if (!unitId) errs.push('5. Select Unit')
    if (!selectedLessonObj) errs.push('6. Select a Lesson Title')
    if (availableTopics.length > 0 && selectedTopics.length === 0) {
      errs.push('7. Select at least one Topic / Subtopic')
    }
    if (!selectedTextbook) errs.push('Match a Verified Textbook')
    if (
      selectedTextbook &&
      !selectedTextbook.hasExtractedText &&
      selectedTextbook.extractionStatus !== 'COMPLETED' &&
      selectedTextbook.extractionStatus !== 'PARTIALLY_COMPLETED'
    ) {
      errs.push('Extract textbook PDF text before generation')
    }
    return errs
  }, [groupId, subjectId, standard, term, unitId, selectedLessonObj, availableTopics, selectedTopics, selectedTextbook])

  // Helper to apply newly selected lesson and ground textbook
  const applySelectedLesson = (
    lesson: LessonItem | undefined,
    grp: GroupId,
    sub: string,
    std: number,
    uId: number,
    t: string
  ) => {
    if (!lesson) {
      setSelectedLessonTitle('')
      setAvailableTopics([])
      setSelectedTopics([])
      setTextbooksList([])
      setSelectedTextbookKey('')
      setResult(null)
      setError(null)
      return
    }

    setSelectedLessonTitle(lesson.title)
    setResult(null)
    setError(null)

    // Extract syllabus topics strictly from the lesson structure (deduplicated)
    const seenTopics = new Set<string>()
    const topics: string[] = []
    if (Array.isArray(lesson.topics) && lesson.topics.length > 0) {
      lesson.topics.forEach((tp) => {
        const name = String(typeof tp === 'string' ? tp : tp?.name || '').trim()
        const key = name.toLowerCase().replace(/\s+/g, ' ')
        if (name && !seenTopics.has(key)) {
          seenTopics.add(key)
          topics.push(name)
        }
      })
    }

    if (topics.length > 0) {
      setAvailableTopics(topics)
      setSelectedTopics(topics)
    } else {
      setAvailableTopics([lesson.title])
      setSelectedTopics([lesson.title])
    }

    loadTextbooks(grp, sub, std, uId, t, lesson.id, lesson.title)
  }

  // =========================================================================
  // Cascading Selection Handlers with Downstream Resets
  // =========================================================================

  // 1. Group Change -> filters Subjects, resets downstream
  const handleGroupChange = (newGroupId: GroupId) => {
    setGroupId(newGroupId)
    const effGroup: 'group1' | 'group2' | 'group4' = newGroupId === 'group2a' ? 'group2' : newGroupId
    const nextSubjects = getSubjectsForGroup(effGroup)
    const nextSub = nextSubjects[0]?.id || 'general-studies'
    setSubjectId(nextSub)

    const nextStandards = getStandardsForSubject(effGroup, nextSub)
    const nextStd = nextStandards[0]?.id || 6
    setStandard(nextStd)

    const nextTerms = getTermsForStandard(nextStd)
    const nextTerm = nextTerms[0] || 'Term 1'
    setTerm(nextTerm)

    const nextUnits = getUnitsForSubjectStandardAndTerm(effGroup, nextSub, nextStd, nextTerm)
    const nextUnit = nextUnits[0]?.id || 1
    setUnitId(nextUnit)

    const nextLessons = getLessonsForSelection(effGroup, nextSub, nextStd, nextUnit, nextTerm)
    const nextLesson = nextLessons[0]
    applySelectedLesson(nextLesson, newGroupId, nextSub, nextStd, nextUnit, nextTerm)
  }

  // 2. Subject Change -> filters Standards, resets downstream
  const handleSubjectChange = (newSubject: string) => {
    setSubjectId(newSubject)
    const nextStandards = getStandardsForSubject(effectiveGroupId, newSubject)
    const nextStd = nextStandards[0]?.id || 6
    setStandard(nextStd)

    const nextTerms = getTermsForStandard(nextStd)
    const nextTerm = nextTerms[0] || 'Term 1'
    setTerm(nextTerm)

    const nextUnits = getUnitsForSubjectStandardAndTerm(effectiveGroupId, newSubject, nextStd, nextTerm)
    const nextUnit = nextUnits[0]?.id || 1
    setUnitId(nextUnit)

    const nextLessons = getLessonsForSelection(effectiveGroupId, newSubject, nextStd, nextUnit, nextTerm)
    const nextLesson = nextLessons[0]
    applySelectedLesson(nextLesson, groupId, newSubject, nextStd, nextUnit, nextTerm)
  }

  // 3. Standard Change -> filters Terms, resets downstream
  const handleStandardChange = (newStandard: number) => {
    setStandard(newStandard)
    const nextTerms = getTermsForStandard(newStandard)
    const nextTerm = nextTerms.includes(term) ? term : nextTerms[0]
    setTerm(nextTerm)

    const nextUnits = getUnitsForSubjectStandardAndTerm(effectiveGroupId, subjectId, newStandard, nextTerm)
    const nextUnit = nextUnits[0]?.id || 1
    setUnitId(nextUnit)

    const nextLessons = getLessonsForSelection(effectiveGroupId, subjectId, newStandard, nextUnit, nextTerm)
    const nextLesson = nextLessons[0]
    applySelectedLesson(nextLesson, groupId, subjectId, newStandard, nextUnit, nextTerm)
  }

  // 4. Term Change -> filters Units, resets downstream
  const handleTermChange = (newTerm: string) => {
    setTerm(newTerm)
    const nextUnits = getUnitsForSubjectStandardAndTerm(effectiveGroupId, subjectId, standard, newTerm)
    const validUnit = nextUnits.some((u) => u.id === Number(unitId)) ? Number(unitId) : nextUnits[0]?.id || 1
    setUnitId(validUnit)

    const nextLessons = getLessonsForSelection(effectiveGroupId, subjectId, standard, validUnit, newTerm)
    const nextLesson = nextLessons[0]
    applySelectedLesson(nextLesson, groupId, subjectId, standard, validUnit, newTerm)
  }

  // 5. Unit Change -> strictly filters Lesson Titles to this unit only, resets downstream
  const handleUnitChange = (newUnitId: number) => {
    setUnitId(newUnitId)
    setDynamicLessons([])
    setAvailableTopics([])
    setSelectedTopics([])
    const nextLessons = getLessonsForSelection(effectiveGroupId, subjectId, standard, newUnitId, term)
    const nextLesson = nextLessons[0]
    applySelectedLesson(nextLesson, groupId, subjectId, standard, newUnitId, term)
  }

  // 6. Lesson Title Change
  const handleLessonChange = (newLessonTitle: string) => {
    const nextLesson = availableLessons.find((l) => l.title === newLessonTitle) || availableLessons[0]
    applySelectedLesson(nextLesson, groupId, subjectId, standard, Number(unitId), term)
  }

  // Step 7: Topic selection handlers
  const handleToggleTopic = (t: string) => {
    setSelectedTopics((prev) => {
      if (prev.includes(t)) {
        return prev.filter((item) => item !== t)
      } else {
        return [...prev, t]
      }
    })
  }

  const handleSelectAllTopics = () => {
    setSelectedTopics([...availableTopics])
  }

  const handleClearAllTopics = () => {
    setSelectedTopics([])
  }

  // Textbook candidate selection
  const handleTextbookSelect = (candidate: TextbookCandidate) => {
    setSelectedTextbookKey(candidate.key)
    loadVolumes(candidate, standard, term)
  }

  // Volume Change
  const handleVolumeChange = (nextVolume: string) => {
    setVolume(nextVolume)
    setResult(null)
    setError(null)
  }

  // =========================================================================
  // Textbook Matching & Extraction
  // =========================================================================

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
  }

  // Initial load on mount (Default: TNPSC Group 1)
  useEffect(() => {
    const effGroup: 'group1' | 'group2' | 'group4' = 'group1'
    const nextSubjects = getSubjectsForGroup(effGroup)
    const nextSub = nextSubjects[0]?.id || 'general-studies'
    const nextStandards = getStandardsForSubject(effGroup, nextSub)
    const nextStd = nextStandards[0]?.id || 6
    const nextTerms = getTermsForStandard(nextStd)
    const nextTerm = nextTerms[0] || 'Term 1'
    const nextUnits = getUnitsForSubjectStandardAndTerm(effGroup, nextSub, nextStd, nextTerm)
    const nextUnit = nextUnits[0]?.id || 1
    const nextLessons = getLessonsForSelection(effGroup, nextSub, nextStd, nextUnit, nextTerm)
    const nextLesson = nextLessons[0]

    setGroupId('group1')
    setSubjectId(nextSub)
    setStandard(nextStd)
    setTerm(nextTerm)
    setUnitId(nextUnit)
    if (nextLesson) {
      setSelectedLessonTitle(nextLesson.title)
      const topics: string[] = []
      if (Array.isArray(nextLesson.topics) && nextLesson.topics.length > 0) {
        nextLesson.topics.forEach((tp) => {
          if (typeof tp === 'string') topics.push(tp)
          else if (tp && typeof tp.name === 'string') topics.push(tp.name)
        })
      }
      setAvailableTopics(topics.length > 0 ? topics : [nextLesson.title])
      setSelectedTopics(topics.length > 0 ? topics : [nextLesson.title])
      loadTextbooks('group1', nextSub, nextStd, nextUnit, nextTerm, nextLesson.id, nextLesson.title)
    }

    const activeToken = token || localStorage.getItem('tnpsc_admin_token') || ''
    apiFetch('/api/ai/providers', {
      headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        const statuses = Array.isArray(data) ? data : (data?.providers || [])
        if (Array.isArray(statuses) && statuses.length > 0) {
          const active = statuses.find((p: any) => p.isActive) || statuses.find((p: any) => p.provider === data?.activeProvider)
          if (active && (active.provider === 'gemini' || active.provider === 'claude')) {
            setAiProvider(active.provider)
          }
          const c = statuses.find((p: any) => p.provider === 'claude')
          if (c) setClaudeStatusInfo({ configured: Boolean(c.configured), connected: Boolean(c.connected), model: c.model })
          const g = statuses.find((p: any) => p.provider === 'gemini')
          if (g) setGeminiStatusInfo({ configured: Boolean(g.configured), connected: Boolean(g.connected), model: g.model, status: g.status })
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Real-time PDF Extraction
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
        const MAX_ROUNDS = 120
        let last: any = null

        for (let round = 0; round < MAX_ROUNDS; round++) {
          const res = await apiFetch(endpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${activeToken}` },
          })
          const data = await res.json()

          if (!res.ok || (!data.success && data.status !== 'success')) {
            showToast?.('error', data.message || 'Extraction failed.')
            return
          }

          last = data.data || data
          if (!last?.inProgress) {
            showToast?.('success', data.message || 'PDF text successfully extracted and indexed!')
            if (selectedLessonObj) {
              loadTextbooks(
                groupId,
                subjectId,
                standard,
                Number(unitId),
                term,
                selectedLessonObj.id,
                selectedLessonObj.title
              )
            }
            return
          }

          await new Promise((resolve) => setTimeout(resolve, 400))
        }

        showToast?.(
          'error',
          `Extraction is still running (${last?.extractedPagesCount ?? 0}/${last?.totalPages ?? 0} pages). Click Extract again to resume.`
        )
      }
    } catch (err: any) {
      showToast?.('error', err.message || 'Failed to extract PDF text.')
    } finally {
      setExtractingMap((prev) => ({ ...prev, [key]: false }))
    }
  }

  // =========================================================================
  // Generate MCQs with Claude AI or Gemini AI Execution
  // =========================================================================

  const isMountedRef = React.useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const pollJobUntilSettled = React.useCallback(
    async (jobId: string, activeToken: string, fallbackSourceName?: string) => {
      const pollStart = Date.now()
      while (isMountedRef.current && Date.now() - pollStart < 15 * 60 * 1000) {
        const statusRes = await apiFetch(`/api/admin/mcq-generation/jobs/${encodeURIComponent(jobId)}`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        }).catch(() => null)

        if (statusRes && statusRes.ok) {
          const statusBody = await statusRes.json().catch(() => null)
          const latestJob = statusBody?.job
          if (latestJob && isMountedRef.current) {
            setProgress({
              pct: Math.max(5, Number(latestJob.progress) || 0),
              step:
                latestJob.current_step ||
                `${latestJob.status} (${latestJob.generated_count}/${latestJob.requested_question_count})`,
            })

            if (latestJob.status === 'COMPLETED') {
              setActiveJobId(null)
              const groupLabel =
                TNPSC_GROUPS.find((g) => g.id === latestJob.group_id)?.name ||
                String(latestJob.group_id || '').toUpperCase()
              setResult({
                count: latestJob.generated_count,
                sourceName: latestJob.textbook_name || fallbackSourceName || latestJob.lesson_title,
                pages: [],
                staged: true,
                questions: [],
                jobId: latestJob.job_id,
                requestedCount: latestJob.requested_question_count,
                generatedCount: latestJob.generated_count,
                failedCount: latestJob.failed_count || 0,
                provider: latestJob.provider === 'claude' ? 'Claude AI' : 'Gemini AI',
                groupLabel,
                subject: latestJob.subject,
                standard: latestJob.standard_id,
                unitLabel: latestJob.unit_title ? `Unit ${latestJob.unit_id} - ${latestJob.unit_title}` : `Unit ${latestJob.unit_id}`,
                lessonTitle: latestJob.lesson_title,
                medium: latestJob.language === 'tamil' ? 'Tamil Medium' : 'English Medium',
                status: latestJob.generated_count < latestJob.requested_question_count ? 'Partial Success (Saved to Staging)' : 'Completed & Saved to Staging',
              })
              setProgress({
                pct: 100,
                step: `Completed: ${latestJob.generated_count} questions saved to Staging`,
              })
              showToast?.('success', `${latestJob.generated_count} lesson-grounded questions saved to Staging.`)
              onRefreshData?.()
              return
            }

            if (latestJob.status === 'FAILED') {
              setActiveJobId(null)
              setError(latestJob.error_message || 'Background MCQ generation job failed.')
              return
            }

            if (latestJob.status === 'CANCELLED') {
              setActiveJobId(null)
              setError('MCQ generation job was cancelled.')
              return
            }
          }
        }

        await new Promise((r) => setTimeout(r, 1200))
      }
    },
    [onRefreshData, showToast]
  )

  // Restore any active background job from PostgreSQL when reopening the generator modal or navigating back
  useEffect(() => {
    const activeToken = token || localStorage.getItem('tnpsc_admin_token') || ''
    if (!activeToken) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch('/api/admin/mcq-generation/jobs?active=true&limit=5', {
          headers: { Authorization: `Bearer ${activeToken}` },
        })
        if (!res.ok || cancelled) return
        const data = await res.json().catch(() => null)
        const activeJobs = Array.isArray(data?.jobs) ? data.jobs : []
        if (activeJobs.length === 0 || cancelled) return

        const preferredId = sessionStorage.getItem('tnpsc_last_mcq_job_id')
        const targetJob =
          (preferredId && activeJobs.find((j: any) => j.job_id === preferredId)) || activeJobs[0]
        if (!targetJob || cancelled) return

        setActiveJobId(targetJob.job_id)
        setProgress({
          pct: Math.max(5, Number(targetJob.progress) || 0),
          step:
            targetJob.current_step ||
            `Resumed monitor for ${targetJob.lesson_title} (${targetJob.generated_count}/${targetJob.requested_question_count})`,
        })
        await pollJobUntilSettled(targetJob.job_id, activeToken, targetJob.textbook_name)
      } catch {
        // Non-fatal restore check
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, pollJobUntilSettled])

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

    if (!selectedLessonObj || !selectedTextbook) return

    setIsGenerating(true)
    setProgress({ pct: 5, step: `Connecting to ${aiProvider === 'claude' ? 'Claude AI' : 'Gemini AI'} & verifying lesson textbook...` })
    setError(null)
    setResult(null)

    const topicsToPass = selectedTopics.length > 0 ? selectedTopics : [selectedLessonObj.title]

    const payload = {
      provider: aiProvider,
      category: groupId,
      standard,
      subject: availableSubjects.find((s) => s.id === subjectId)?.name || 'General Studies',
      term: term !== 'Not Applicable' ? term : undefined,
      volume: volume !== 'Not Applicable' ? volume : undefined,
      unitId: Number(unitId) || 1,
      unitTitle: availableUnits.find((u) => u.id === Number(unitId))?.title || `Unit ${unitId}`,
      lessonTitle: selectedLessonObj.title,
      lessonId: selectedLessonObj.id || undefined,
      lessonNumber: selectedLessonObj.lessonNumber || undefined,
      topic: topicsToPass[0],
      selectedTopics: topicsToPass,
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
      const res = await apiFetch('/api/admin/mcq-generation/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({ ...payload, subjectId }),
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.success || !body?.job) {
        throw new Error(body?.message || `Failed to queue MCQ generation job (HTTP ${res.status}).`)
      }

      const createdJob = body.job
      sessionStorage.setItem('tnpsc_last_mcq_job_id', createdJob.job_id)
      setActiveJobId(createdJob.job_id)
      window.dispatchEvent(new CustomEvent('tnpsc:mcq-job-created', { detail: createdJob }))
      setProgress({
        pct: Math.max(5, Number(createdJob.progress) || 5),
        step: `Background Job ${createdJob.job_id} queued (${createdJob.generated_count}/${createdJob.requested_question_count}). You can close this modal or switch pages safely.`,
      })
      showToast?.(
        'success',
        `Background MCQ generation started (${createdJob.requested_question_count} questions). Generation will continue even if you close this modal.`
      )

      // Poll job status while modal stays open (unmounting modal NEVER cancels backend job)
      await pollJobUntilSettled(createdJob.job_id, activeToken, selectedTextbook.bookName)
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
        <span>TNPSC Syllabus-Wise Claude & Gemini AI MCQ Generator</span>
      </h3>

      {/* =====================================================================
          PART 1: EXACT 6-DROPDOWN SYLLABUS HIERARCHY
          Sequence exactly matches Study Notes Generation:
          1. TNPSC Group
          2. Subject
          3. Standard
          4. Term
          5. Unit
          6. Lesson Title
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
            {TNPSC_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Subject */}
        <div className="ai-field">
          <label>2. Subject ({availableSubjects.length}) *</label>
          <select
            className="ai-select"
            value={subjectId}
            onChange={(e) => handleSubjectChange(e.target.value)}
          >
            {availableSubjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Standard */}
        <div className="ai-field">
          <label>3. Standard ({availableStandards.length}) *</label>
          <select
            className="ai-select"
            value={standard}
            onChange={(e) => handleStandardChange(Number(e.target.value))}
          >
            {availableStandards.map((std) => (
              <option key={std.id} value={std.id}>
                {std.label}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Term (4th field) */}
        <div className="ai-field">
          <label>4. Term ({availableTerms.length}) *</label>
          <select
            className="ai-select"
            value={term}
            onChange={(e) => handleTermChange(e.target.value)}
          >
            {availableTerms.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* 5. Unit (5th field) */}
        <div className="ai-field">
          <label>5. Unit ({availableUnits.length}) *</label>
          <select
            className="ai-select"
            value={unitId}
            onChange={(e) => handleUnitChange(Number(e.target.value))}
          >
            {availableUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unitNumber}: {unit.title}
              </option>
            ))}
          </select>
        </div>

        {/* 6. Lesson Title (6th field) */}
        <div className="ai-field">
          <label>6. Lesson Title ({availableLessons.length}) *</label>
          <select
            className="ai-select"
            value={selectedLessonTitle}
            onChange={(e) => handleLessonChange(e.target.value)}
          >
            {availableLessons.length === 0 ? (
              <option value="" disabled>No lessons available</option>
            ) : (
              availableLessons.map((lesson) => (
                <option key={lesson.id} value={lesson.title}>
                  {lesson.lessonNumber ? `${lesson.lessonNumber} – ` : ''}{lesson.title}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Active Lesson Details Card */}
      {selectedLessonObj && (
        <div className="ai-lesson-card" style={{ marginTop: '0.85rem' }}>
          <div className="ai-lesson-meta-row">
            <span className="ai-lesson-pill" style={{ color: 'var(--gold-primary)', fontWeight: 600 }}>
              {selectedLessonObj.lessonNumber ? `Lesson ${selectedLessonObj.lessonNumber}` : 'Selected Lesson'}
            </span>
            <span className="ai-lesson-pill">{selectedLessonObj.term || term}</span>
            <span className="ai-lesson-pill">Unit {unitId}</span>
            <span className="ai-lesson-pill">Class {standard}th</span>
          </div>
          <div className="ai-lesson-title-display" style={{ fontSize: '0.92rem', marginTop: '0.35rem', fontWeight: 600 }}>
            {selectedLessonObj.title}
          </div>
          {selectedLessonObj.description && (
            <p className="ai-lesson-desc" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }}>
              {selectedLessonObj.description}
            </p>
          )}
        </div>
      )}

      {/* =====================================================================
          STEP 7: TOPIC / SUBTOPIC SELECTION
          Interactive checkboxes/pills with Select All and Clear toggle
      ====================================================================== */}
      {selectedLessonObj && (
        <div className="ai-field" style={{ marginTop: '0.95rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.35rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ margin: 0 }}>
                7. Topic / Subtopic Selection *
              </label>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: selectedTopics.length > 0 ? '#38bdf8' : '#94a3b8',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  padding: '2px 8px',
                  borderRadius: '999px',
                }}
              >
                {selectedTopics.length} of {availableTopics.length} Selected
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={handleSelectAllTopics}
                disabled={availableTopics.length === 0}
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  borderRadius: '6px',
                  padding: '3px 9px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearAllTopics}
                disabled={selectedTopics.length === 0}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#94a3b8',
                  borderRadius: '6px',
                  padding: '3px 9px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {availableTopics.length === 0 ? (
            <div className="ai-notice-box" style={{ color: 'var(--text-muted)' }}>
              No granular subtopics found. The full lesson title will be used as the topic focus.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.45rem',
                padding: '0.75rem',
                background: 'rgba(15, 23, 42, 0.55)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {availableTopics.map((topicItem) => {
                const isSelected = selectedTopics.includes(topicItem)
                return (
                  <button
                    key={topicItem}
                    type="button"
                    onClick={() => handleToggleTopic(topicItem)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      border: isSelected
                        ? '1px solid rgba(192, 132, 252, 0.6)'
                        : '1px solid rgba(255, 255, 255, 0.12)',
                      background: isSelected
                        ? 'rgba(192, 132, 252, 0.18)'
                        : 'rgba(255, 255, 255, 0.03)',
                      color: isSelected ? '#f5d0fe' : 'var(--text-secondary)',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '3px',
                        border: isSelected ? '1px solid #c084fc' : '1px solid #64748b',
                        background: isSelected ? '#c084fc' : 'transparent',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#000',
                        fontSize: '10px',
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      {isSelected ? '✓' : ''}
                    </span>
                    <span>{topicItem}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          AUTOMATICALLY MATCHED TEXTBOOK GROUNDING
          Keeps verified textbook card visible showing auto-attached textbook & page count
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
            Prescribed Samacheer Kalvi Textbook *
          </label>
          {textbooksList.length > 0 && (
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {textbooksList.length} mapped textbook{textbooksList.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {!selectedLessonObj ? (
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
            Matching Samacheer Kalvi textbooks for &ldquo;{selectedLessonObj.title}&rdquo;...
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
            No textbook mapped yet for &ldquo;{selectedLessonObj.title}&rdquo;. Please upload the
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
          STEP 8: INDEPENDENT AI PROVIDER SELECTION
          Claude AI & Gemini AI with real-time connection badges
      ====================================================================== */}
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
          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#f8fafc' }}>
            8. AI Provider Engine:
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
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

          {/* Real-time Status Badge */}
          {aiProvider === 'gemini' ? (
            geminiStatusInfo?.connected ? (
              <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.45)', color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Check size={11} /> CONNECTED ({geminiStatusInfo.model})
              </span>
            ) : geminiStatusInfo?.status === 'MODEL_NOT_AVAILABLE' ? (
              <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.45)', color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertTriangle size={11} /> MODEL UNAVAILABLE ({geminiStatusInfo.model})
              </span>
            ) : geminiStatusInfo?.configured ? (
              <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(56, 189, 248, 0.2)', border: '1px solid rgba(56, 189, 248, 0.45)', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Check size={11} /> READY ({geminiStatusInfo.model})
              </span>
            ) : (
              <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertTriangle size={11} /> NOT CONFIGURED
              </span>
            )
          ) : (
            claudeStatusInfo?.connected ? (
              <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.45)', color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Check size={11} /> CONNECTED ({claudeStatusInfo.model})
              </span>
            ) : claudeStatusInfo?.configured ? (
              <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(192, 132, 252, 0.2)', border: '1px solid rgba(192, 132, 252, 0.45)', color: '#c084fc', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Check size={11} /> READY ({claudeStatusInfo.model})
              </span>
            ) : (
              <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertTriangle size={11} /> NOT CONFIGURED
              </span>
            )
          )}
        </div>
      </div>

      {/* =====================================================================
          STEPS 9, 10, 11: GENERATION SETTINGS
          9. Number of Questions
          10. Difficulty
          11. Language
      ====================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
          gap: '0.75rem',
          marginTop: '1rem',
        }}
      >
        {/* 9. Questions Count */}
        <div className="ai-field">
          <label>9. Questions Count</label>
          <select
            className="ai-select"
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
          >
            <option value={5}>5 Questions</option>
            <option value={10}>10 Questions</option>
            <option value={15}>15 Questions</option>
            <option value={20}>20 Questions</option>
            <option value={25}>25 Questions</option>
            <option value={30}>30 Questions</option>
            <option value={50}>50 Questions</option>
            <option value={80}>80 Questions</option>
            <option value={100}>100 Questions</option>
            <option value={200}>200 Questions</option>
          </select>
        </div>

        {/* 10. Difficulty */}
        <div className="ai-field">
          <label>10. Difficulty</label>
          <select
            className="ai-select"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          >
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
            <option value="Mixed">Mixed</option>
          </select>
        </div>

        {/* 11. Language */}
        <div className="ai-field">
          <label>11. Language</label>
          <select
            className="ai-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            <option value="tamil">Tamil (தமிழ்)</option>
            <option value="english">English</option>
          </select>
        </div>

        {/* Volume selector (if candidate has multiple volumes) */}
        {volumeOptions.length > 1 && volumeOptions[0] !== 'Not Applicable' && (
          <div className="ai-field">
            <label>Volume</label>
            <select
              className="ai-select"
              value={volume}
              onChange={(e) => handleVolumeChange(e.target.value)}
            >
              {volumeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
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
      {(isGenerating || activeJobId) && progress && (
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

      {/* Generation Results Preview (Inline Staging Success Panel — No Auto-Redirect) */}
      {result && (
        <div
          className="ai-section-box"
          style={{
            marginTop: '1rem',
            border: '1px solid rgba(34, 197, 94, 0.45)',
            background: 'rgba(20, 83, 45, 0.22)',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              color: '#86efac',
              fontWeight: 700,
              fontSize: '1rem',
            }}
          >
            <CheckCircle size={20} />
            <span>
              ✓ {result.count} Questions {result.staged ? 'Saved to Staging' : 'Generated for Review'}
            </span>
          </div>
          <div
            style={{
              fontSize: '0.82rem',
              color: '#cbd5e1',
              marginTop: '0.35rem',
            }}
          >
            Source Textbook: <strong>{result.sourceName}</strong>
            {result.medium ? ` (${result.medium})` : ''}
            {result.pages.length ? ` • PDF pages ${result.pages.join(', ')}` : ''}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '0.55rem',
              marginTop: '0.8rem',
              padding: '0.75rem',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.55)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.78rem',
              color: '#cbd5e1',
            }}
          >
            <div><span style={{ color: '#94a3b8' }}>Requested:</span> <strong>{result.requestedCount ?? result.count}</strong></div>
            <div><span style={{ color: '#94a3b8' }}>Generated:</span> <strong style={{ color: '#86efac' }}>{result.generatedCount ?? result.count}</strong></div>
            <div><span style={{ color: '#94a3b8' }}>Saved to Staging:</span> <strong style={{ color: '#86efac' }}>{result.count}</strong></div>
            <div><span style={{ color: '#94a3b8' }}>Failed:</span> <strong style={{ color: (result.failedCount || 0) > 0 ? '#fca5a5' : '#cbd5e1' }}>{result.failedCount ?? 0}</strong></div>
            {result.groupLabel && <div><span style={{ color: '#94a3b8' }}>TNPSC Group:</span> <strong>{result.groupLabel}</strong></div>}
            {result.subject && <div><span style={{ color: '#94a3b8' }}>Subject:</span> <strong>{result.subject}</strong></div>}
            {result.standard != null && <div><span style={{ color: '#94a3b8' }}>Standard:</span> <strong>Class {result.standard}</strong></div>}
            {result.unitLabel && <div><span style={{ color: '#94a3b8' }}>Unit:</span> <strong>{result.unitLabel}</strong></div>}
            {result.lessonTitle && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#94a3b8' }}>Lesson:</span> <strong>{result.lessonTitle}</strong></div>}
            <div><span style={{ color: '#94a3b8' }}>Status:</span> <strong style={{ color: '#86efac' }}>{result.status || 'Completed & Saved to Staging'}</strong></div>
            {result.provider && <div><span style={{ color: '#94a3b8' }}>AI Provider:</span> <strong>{result.provider}</strong></div>}
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.6rem',
              marginTop: '0.85rem',
            }}
          >
            {onNavigateToStaging && (
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => onNavigateToStaging(result.jobId)}
                style={{ padding: '0.5rem 0.95rem', fontSize: '0.82rem' }}
              >
                View Staging Questions ({result.count})
              </button>
            )}
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => {
                setResult(null)
                setProgress(null)
                setError(null)
                setActiveJobId(null)
              }}
              style={{ padding: '0.5rem 0.95rem', fontSize: '0.82rem' }}
            >
              Generate Again
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => {
                showToast?.('success', 'Remaining on MCQ Generator. Your saved questions are ready in Staging.')
              }}
              style={{ padding: '0.5rem 0.95rem', fontSize: '0.82rem' }}
            >
              Stay on Generator
            </button>
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
                  {question.topic ? ` • Topic: ${question.topic}` : ''}
                  {question.aiProvider && (
                    <span
                      style={{
                        marginLeft: '0.5rem',
                        padding: '0.12rem 0.45rem',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                        background: question.aiProvider === 'gemini' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(192, 132, 252, 0.18)',
                        border: question.aiProvider === 'gemini' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(192, 132, 252, 0.4)',
                        color: question.aiProvider === 'gemini' ? '#38bdf8' : '#c084fc',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      {question.aiProvider === 'gemini' ? '🔵 Gemini AI' : '🟣 Claude AI'}
                    </span>
                  )}
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
