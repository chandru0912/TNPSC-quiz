import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BookOpen, CheckCircle, RefreshCw, Sparkles } from 'lucide-react'
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

  // Step 5: Lesson (Directly from Study Materials database)
  const [lessonsList, setLessonsList] = useState<LessonItem[]>([])
  const [selectedLessonKey, setSelectedLessonKey] = useState('')
  const [isLoadingLessons, setIsLoadingLessons] = useState(false)

  // Step 6: Textbook (Appears AFTER Lesson)
  const [textbooksList, setTextbooksList] = useState<TextbookCandidate[]>([])
  const [selectedTextbookKey, setSelectedTextbookKey] = useState('')
  const [isLoadingTextbooks, setIsLoadingTextbooks] = useState(false)

  // Step 7: Term (From selected textbook metadata)
  const [term, setTerm] = useState('Term 1')
  const [termOptions, setTermOptions] = useState<string[]>(['Term 1'])
  const [isLoadingTerms, setIsLoadingTerms] = useState(false)

  // Step 8: Volume (From selected textbook metadata)
  const [volume, setVolume] = useState('Not Applicable')
  const [volumeOptions, setVolumeOptions] = useState<string[]>(['Not Applicable'])
  const [isLoadingVolumes, setIsLoadingVolumes] = useState(false)

  // Independent Settings: Steps 9, 10, 11 (Preserved across cascading resets)
  const [language, setLanguage] = useState<Language>('tamil')
  const [questionCount, setQuestionCount] = useState(50)
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium')

  // Execution & Progress State
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState<{ pct: number; step: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)

  // Dynamic Subjects & Standards derived from registry with fallback
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

  // =========================================================================
  // Cascading Reset Handlers
  // =========================================================================

  const resetFromStandard = (std: number) => {
    setUnitId('')
    setUnitsList([])
    resetFromUnit()
    loadUnits(groupId, subjectId, std)
  }

  const resetFromUnit = () => {
    setLessonsList([])
    setSelectedLessonKey('')
    resetFromLesson()
  }

  const resetFromLesson = () => {
    setTextbooksList([])
    setSelectedTextbookKey('')
    resetFromTextbook()
  }

  const resetFromTextbook = () => {
    setTerm('Not Applicable')
    setTermOptions(['Not Applicable'])
    resetFromTerm()
  }

  const resetFromTerm = () => {
    setVolume('Not Applicable')
    setVolumeOptions(['Not Applicable'])
    setResult(null)
    setError(null)
  }

  // 1. Group Change -> Resets Subject, Standard, Unit, Lesson, Textbook, Term, Volume
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
    resetFromUnit()
    loadUnits(nextGroup, nextSub, nextStd)
  }

  // 2. Subject Change -> Resets Standard, Unit, Lesson, Textbook, Term, Volume
  const handleSubjectChange = (nextSubject: string) => {
    setSubjectId(nextSubject)
    const nextStandards = getStandardsForSubject(groupId, nextSubject)
    const nextStd = nextStandards[0]?.id || 6
    setStandard(nextStd)
    setUnitId('')
    setUnitsList([])
    resetFromUnit()
    loadUnits(groupId, nextSubject, nextStd)
  }

  // 3. Standard Change -> Resets Unit, Lesson, Textbook, Term, Volume
  const handleStandardChange = (nextStandard: number) => {
    setStandard(nextStandard)
    resetFromStandard(nextStandard)
  }

  // 4. Unit Change -> Resets Lesson, Textbook, Term, Volume
  const handleUnitChange = (nextUnitId: number | '') => {
    setUnitId(nextUnitId)
    resetFromUnit()
    if (nextUnitId !== '') {
      loadLessons(groupId, subjectId, standard, nextUnitId)
    }
  }

  // 5. Lesson Change -> Resets Textbook, Term, Volume
  const handleLessonSelect = (lesson: LessonItem) => {
    const key = `${lesson.lessonNumber}:${lesson.title}`
    setSelectedLessonKey(key)
    resetFromLesson()
    loadTextbooks(groupId, subjectId, standard, lesson.unitId, lesson.lessonId, lesson.title)
  }

  // 6. Textbook Change -> Resets Term, Volume
  const handleTextbookSelect = (candidate: TextbookCandidate) => {
    setSelectedTextbookKey(candidate.key)
    resetFromTextbook()
    loadTerms(candidate)
  }

  // 7. Term Change -> Resets Volume
  const handleTermChange = (nextTerm: string) => {
    setTerm(nextTerm)
    resetFromTerm()
    if (selectedTextbook) {
      loadVolumes(selectedTextbook, nextTerm)
    }
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
          // Default select the first unit
          const firstUnit = data.units[0]
          setUnitId(firstUnit.id)
          loadLessons(grp, sub, std, firstUnit.id)
        } else {
          // Fallback to unified syllabus registry units if API is initializing
          const fallback = getUnitsForSubjectStandard(grp, sub, std)
          setUnitsList(fallback)
          if (fallback.length > 0) {
            setUnitId(fallback[0].id)
            loadLessons(grp, sub, std, fallback[0].id)
          }
        }
      })
      .catch(() => {
        const fallback = getUnitsForSubjectStandard(grp, sub, std)
        setUnitsList(fallback)
        if (fallback.length > 0) {
          setUnitId(fallback[0].id)
          loadLessons(grp, sub, std, fallback[0].id)
        }
      })
      .finally(() => {
        setIsLoadingUnits(false)
      })
  }

  const loadLessons = (grp: GroupId, sub: string, std: number, uId: number) => {
    setIsLoadingLessons(true)
    setError(null)

    const query = new URLSearchParams({
      groupId: grp,
      subjectId: sub,
      standardId: String(std),
      unitId: String(uId),
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
      lessonId,
      lessonTitle,
    })

    apiFetch(`/api/study-materials/textbooks?${query.toString()}`)
      .then(async (res) => {
        const data = await res.json()
        if (data.success && Array.isArray(data.textbooks) && data.textbooks.length > 0) {
          setTextbooksList(data.textbooks)
          // If only one textbook is available, automatically select it!
          if (data.textbooks.length === 1) {
            const onlyTb = data.textbooks[0]
            setSelectedTextbookKey(onlyTb.key)
            loadTerms(onlyTb)
          }
        } else {
          setTextbooksList([])
        }
      })
      .catch((err) => {
        console.error('Error fetching textbooks:', err)
        setError('Failed to load textbooks associated with this lesson.')
        setTextbooksList([])
      })
      .finally(() => {
        setIsLoadingTextbooks(false)
      })
  }

  const loadTerms = (candidate: TextbookCandidate) => {
    setIsLoadingTerms(true)

    const query = new URLSearchParams()
    if (candidate.materialId) query.set('materialId', String(candidate.materialId))
    if (candidate.textbookId) query.set('textbookId', String(candidate.textbookId))

    apiFetch(`/api/study-materials/terms?${query.toString()}`)
      .then(async (res) => {
        const data = await res.json()
        if (data.success && Array.isArray(data.terms) && data.terms.length > 0) {
          setTermOptions(data.terms)
          const chosenTerm = data.selected || data.terms[0]
          setTerm(chosenTerm)
          loadVolumes(candidate, chosenTerm)
        } else {
          setTermOptions(['Not Applicable'])
          setTerm('Not Applicable')
          loadVolumes(candidate, 'Not Applicable')
        }
      })
      .catch(() => {
        setTermOptions(['Not Applicable'])
        setTerm('Not Applicable')
        loadVolumes(candidate, 'Not Applicable')
      })
      .finally(() => {
        setIsLoadingTerms(false)
      })
  }

  const loadVolumes = (candidate: TextbookCandidate, selectedTerm: string) => {
    setIsLoadingVolumes(true)

    const query = new URLSearchParams()
    if (candidate.materialId) query.set('materialId', String(candidate.materialId))
    if (candidate.textbookId) query.set('textbookId', String(candidate.textbookId))
    if (selectedTerm && selectedTerm !== 'Not Applicable') query.set('term', selectedTerm)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // =========================================================================
  // Generate MCQs Execution
  // =========================================================================

  const handleGenerate = async () => {
    const activeToken = token || localStorage.getItem('tnpsc_admin_token') || ''
    if (!activeToken) {
      setError('Admin authorization token missing. Please sign in again.')
      return
    }

    if (!selectedLesson) {
      setError('Please select a lesson from the Study Materials database before generating MCQs.')
      return
    }

    if (!selectedTextbook) {
      setError('Please select a textbook associated with the selected lesson.')
      return
    }

    setIsGenerating(true)
    setProgress({ pct: 5, step: 'Connecting to Claude AI & verifying lesson textbook...' })
    setError(null)
    setResult(null)

    const payload = {
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
        <span>Study Materials-Connected Dynamic Syllabus MCQ Generator</span>
      </h3>

      {/* Grid: Steps 1 to 4 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
        {/* 1. TNPSC Group */}
        <div className="ai-field">
          <label>1. TNPSC Group *</label>
          <select className="ai-select" value={groupId} onChange={(e) => handleGroupChange(e.target.value as GroupId)}>
            {GROUPS_LIST.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {/* 2. Subject */}
        <div className="ai-field">
          <label>2. Subject *</label>
          <select className="ai-select" value={subjectId} onChange={(e) => handleSubjectChange(e.target.value)}>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        </div>

        {/* 3. Standard */}
        <div className="ai-field">
          <label>3. Standard *</label>
          <select className="ai-select" value={standard} onChange={(e) => handleStandardChange(Number(e.target.value))}>
            {standards.map((std) => (
              <option key={std.id} value={std.id}>{std.label}</option>
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
      </div>

      {/* 5. Lesson Selection (MUST be selected BEFORE Textbook) */}
      <div className="ai-field" style={{ marginTop: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
          <label style={{ margin: 0 }}>5. Lesson Selection (Study Materials Database) *</label>
          {lessonsList.length > 0 && (
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {lessonsList.length} lessons available
            </span>
          )}
        </div>

        {isLoadingLessons ? (
          <div className="ai-notice-box">
            <RefreshCw size={14} className="spin-icon" style={{ display: 'inline', marginRight: '0.4rem' }} />
            Loading lessons from Study Materials database...
          </div>
        ) : !unitId ? (
          <div className="ai-notice-box">Select a Unit above to load its connected lessons.</div>
        ) : lessonsList.length === 0 ? (
          <div
            className="ai-notice-box"
            style={{ background: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.35)', color: '#fcd34d' }}
          >
            No lessons registered in Study Materials for this Unit. Upload materials or notes for Unit {unitId}.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.35rem' }}>
            {lessonsList.map((lesson) => {
              const active = selectedLessonKey === `${lesson.lessonNumber}:${lesson.title}` || selectedLessonKey === lesson.lessonId
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
                    <span className="ai-lesson-pill" style={{ color: 'var(--gold-primary)', fontWeight: 600 }}>
                      Lesson {lesson.lessonNumber}
                    </span>
                    <span className="ai-lesson-pill">Unit {lesson.unitId}</span>
                    {lesson.hasStudyNotes && (
                      <span className="ai-lesson-pill" style={{ color: '#86efac', background: 'rgba(34, 197, 94, 0.15)' }}>
                        ✓ Study Notes ({lesson.notesCount})
                      </span>
                    )}
                    {lesson.hasTextbook && (
                      <span className="ai-lesson-pill" style={{ color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)' }}>
                        ✓ Textbook ({lesson.textbooksCount})
                      </span>
                    )}
                  </div>
                  <div className="ai-lesson-title-display" style={{ fontSize: '0.88rem', marginTop: '0.3rem', fontWeight: 600 }}>
                    {lesson.title}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 6. Textbook Selection (Appears AFTER Lesson Selection) */}
      <div className="ai-field" style={{ marginTop: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
          <label style={{ margin: 0 }}>6. Textbook Selection (Associated with Selected Lesson) *</label>
          {textbooksList.length > 0 && (
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {textbooksList.length} textbook{textbooksList.length > 1 ? 's' : ''} available
            </span>
          )}
        </div>

        {!selectedLesson ? (
          <div className="ai-notice-box">Select a Lesson above to view and match associated textbooks.</div>
        ) : isLoadingTextbooks ? (
          <div className="ai-notice-box">
            <RefreshCw size={14} className="spin-icon" style={{ display: 'inline', marginRight: '0.4rem' }} />
            Matching textbooks for &ldquo;{selectedLesson.title}&rdquo;...
          </div>
        ) : textbooksList.length === 0 ? (
          <div
            className="ai-notice-box"
            style={{ background: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.35)', color: '#fcd34d' }}
          >
            No textbook found containing &ldquo;{selectedLesson.title}&rdquo;. Please upload the Samacheer Kalvi textbook PDF to Google Drive.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {textbooksList.map((candidate) => {
              const active = candidate.key === selectedTextbookKey
              return (
                <button
                  key={candidate.key}
                  type="button"
                  className={`ai-source-radio-card ${active ? 'active' : ''}`}
                  onClick={() => handleTextbookSelect(candidate)}
                  style={{
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderColor: active ? 'var(--gold-primary)' : undefined,
                    background: active ? 'rgba(234, 179, 8, 0.08)' : undefined,
                  }}
                >
                  <BookOpen size={18} style={{ color: active ? 'var(--gold-primary)' : '#9ca3af', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.86rem', color: active ? '#fef08a' : 'inherit' }}>
                      {candidate.bookName}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      Standard {candidate.standard} • Medium: {candidate.medium} • Subject: {candidate.subject}
                      {candidate.term ? ` • ${candidate.term}` : ''}
                      {candidate.volume ? ` • ${candidate.volume}` : ''}
                      {candidate.sourceType === 'drive' ? ' (Google Drive)' : ' (Textbooks DB)'}
                    </div>
                  </div>
                  {active && (
                    <span style={{ fontSize: '0.74rem', color: '#86efac', fontWeight: 600 }}>
                      Selected ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 7 & 8. Term & Volume Selection (Derived from Selected Textbook Metadata) */}
      <div className="ai-options-inline" style={{ marginTop: '0.9rem' }}>
        <div className="ai-field ai-field-compact">
          <label>7. Term</label>
          <select
            className="ai-select"
            value={term}
            onChange={(e) => handleTermChange(e.target.value)}
            disabled={!selectedTextbook || isLoadingTerms}
          >
            {termOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div className="ai-field ai-field-compact">
          <label>8. Volume</label>
          <select
            className="ai-select"
            value={volume}
            onChange={(e) => handleVolumeChange(e.target.value)}
            disabled={!selectedTextbook || isLoadingVolumes}
          >
            {volumeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Notice */}
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

      {/* 9, 10, 11: Independent Generation Options */}
      <div className="ai-generation-options" style={{ marginTop: '1rem' }}>
        <div className="ai-options-inline">
          {/* 9. Language */}
          <div className="ai-field ai-field-compact">
            <label>9. Language</label>
            <select className="ai-select" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
              <option value="tamil">Tamil (தமிழ்)</option>
              <option value="english">English</option>
            </select>
          </div>

          {/* 10. Questions Count */}
          <div className="ai-field ai-field-compact">
            <label>10. Questions Count</label>
            <select className="ai-select" value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))}>
              <option value={25}>25 Questions</option>
              <option value={50}>50 Questions</option>
              <option value={100}>100 Questions</option>
              <option value={200}>200 Questions</option>
            </select>
          </div>

          {/* 11. Difficulty */}
          <div className="ai-field ai-field-compact">
            <label>11. Difficulty</label>
            <select className="ai-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>

        {/* 12. Generate MCQs Button */}
        <button
          className="ai-generate-action-btn"
          onClick={handleGenerate}
          disabled={isGenerating || !selectedLesson || !selectedTextbook}
          style={{ marginTop: '0.85rem' }}
        >
          {isGenerating ? <RefreshCw size={18} className="spin-icon" /> : <Sparkles size={18} />}
          <span>{isGenerating ? 'Generating MCQs from Textbook...' : `12. Generate ${questionCount} MCQs with Claude AI`}</span>
        </button>
      </div>

      {/* Real-time Progress Bar */}
      {isGenerating && progress && (
        <div style={{ marginTop: '1rem', padding: '0.85rem', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.35)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#fbbf24', fontWeight: 600 }}>
            <span>{progress.step}</span>
            <span>{progress.pct}%</span>
          </div>
          <div style={{ marginTop: '0.45rem', height: '6px', borderRadius: '9999px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{ width: `${progress.pct}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #eab308)' }} />
          </div>
        </div>
      )}

      {/* Generation Results (Staging Preview) */}
      {result && (
        <div className="ai-section-box" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#86efac', fontWeight: 700 }}>
            <CheckCircle size={18} />
            <span>
              {result.count} questions {result.staged ? 'saved to Staging' : 'generated for review'}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
            Source Textbook: {result.sourceName}
            {result.pages.length ? ` • PDF pages ${result.pages.join(', ')}` : ''}
          </div>
          <div style={{ maxHeight: '420px', overflowY: 'auto', marginTop: '0.75rem', paddingRight: '0.35rem' }}>
            {result.questions.map((question, index) => (
              <div key={index} className="ai-lesson-card" style={{ marginBottom: '0.65rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--gold-primary)', marginRight: '0.35rem' }}>Q{index + 1}.</span>
                  {question.question}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.35rem', marginTop: '0.45rem' }}>
                  {question.options.map((option, optionIndex) => (
                    <div
                      key={optionIndex}
                      style={{
                        padding: '0.4rem 0.55rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        background: question.correctAnswer === optionIndex ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.04)',
                        border: question.correctAnswer === optionIndex ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(255,255,255,0.06)',
                        color: question.correctAnswer === optionIndex ? '#86efac' : 'inherit',
                      }}
                    >
                      <strong style={{ marginRight: '0.3rem' }}>{String.fromCharCode(65 + optionIndex)}.</strong>
                      {option}
                    </div>
                  ))}
                </div>
                {question.explanation && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    {question.explanation}
                  </div>
                )}
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
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
