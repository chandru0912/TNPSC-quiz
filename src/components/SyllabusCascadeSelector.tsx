import React, { useEffect, useMemo, useState, useRef } from 'react'
import {
  TNPSC_GROUPS,
  getSubjectsForGroup,
  getStandardsForSubject,
  getUnitsForSubjectStandard,
  getLessonsForSelection,
  type SyllabusSubjectConfig,
  type SyllabusUnitOption,
  type LessonItem,
} from '../data/unifiedSyllabusRegistry'
import { dynamicSyllabusService, type DynamicTopic } from '../services/dynamicSyllabusService'

export type GroupFilterValue = 'all' | 'group1' | 'group2' | 'group4'

export interface UseSyllabusCascadeOptions {
  allowAll?: boolean
  initialGroupId?: GroupFilterValue
  initialSubjectId?: string
  initialClassId?: number | 'all'
  initialUnitId?: number | 'all'
  initialLessonTitle?: string
  initialTopic?: string
  onChange?: () => void
}

export interface SyllabusCascadeState {
  groupId: GroupFilterValue
  subjectId: string
  classId: number | 'all'
  unitId: number | 'all'
  lessonTitle: string
  topic: string
  effectiveGroupId: 'group1' | 'group2' | 'group4'
  currentSubjectId: string
  currentClassId: number
  currentUnitId: number
  currentLessonTitle: string
  availableSubjects: SyllabusSubjectConfig[]
  availableStandards: { id: number; label: string; shortLabel: string }[]
  availableUnits: SyllabusUnitOption[]
  availableLessons: LessonItem[]
  availableTopics: DynamicTopic[]
  selectedSubjectObj: SyllabusSubjectConfig | undefined
  selectedStandardObj: { id: number; label: string; shortLabel: string } | undefined
  currentUnit: SyllabusUnitOption | undefined
  selectedLessonObj: LessonItem | undefined
  handleGroupChange: (newGroupId: GroupFilterValue) => void
  handleSubjectChange: (newSubjectId: string) => void
  handleStandardChange: (newClassId: number | 'all') => void
  handleUnitChange: (newUnitId: number | 'all') => void
  handleLessonChange: (newLessonTitle: string) => void
  handleTopicChange: (newTopic: string) => void
  syncSelection: (selection: {
    groupId: GroupFilterValue
    subjectId: string
    classId: number | 'all'
    unitId: number | 'all'
    lessonTitle: string
    topic?: string
  }) => void
  resetFilters: () => void
}

/**
 * Shared cascading syllabus state hook used by:
 * - Question Bank Management & Publishing section
 * - Study Notes Management & Publishing section
 *
 * Powered by a single source of truth: src/data/unifiedSyllabusRegistry.ts
 */
export function useSyllabusCascade(options: UseSyllabusCascadeOptions = {}): SyllabusCascadeState {
  const {
    allowAll = false,
    initialGroupId = allowAll ? 'all' : 'group1',
    initialSubjectId = allowAll ? 'all' : 'general-studies',
    initialClassId = allowAll ? 'all' : 6,
    initialUnitId = allowAll ? 'all' : 1,
    initialLessonTitle = allowAll ? 'all' : '',
    onChange,
  } = options

  const [groupId, setGroupId] = useState<GroupFilterValue>(initialGroupId)
  const [subjectId, setSubjectId] = useState<string>(initialSubjectId)
  const [classId, setClassId] = useState<number | 'all'>(initialClassId)
  const [unitId, setUnitId] = useState<number | 'all'>(initialUnitId)
  const [lessonTitle, setLessonTitle] = useState<string>(initialLessonTitle)
  const [topic, setTopic] = useState<string>(options.initialTopic || (allowAll ? 'all' : ''))
  const [dynamicUnits, setDynamicUnits] = useState<SyllabusUnitOption[]>([])
  const [dynamicLessons, setDynamicLessons] = useState<LessonItem[]>([])
  const [dynamicTopics, setDynamicTopics] = useState<DynamicTopic[]>([])
  const [syncVersion, setSyncVersion] = useState(0)

  // Request sequence guards to prevent race conditions from overwriting newer selections
  const lessonReqSeq = useRef(0)
  const topicReqSeq = useRef(0)

  // Auto-subscribe to Master Syllabus updates from Study Materials Management
  useEffect(() => {
    const unsub = dynamicSyllabusService.subscribe(() => {
      setSyncVersion((v) => v + 1)
    })
    return unsub
  }, [])

  // Effective group for computing available syllabus options
  // When 'all' is selected in filter mode, 'group2' exposes all 4 subjects (General Studies, Aptitude, General English, General Tamil)
  const effectiveGroupId: 'group1' | 'group2' | 'group4' =
    groupId === 'all' ? 'group2' : groupId

  // 1. Available subjects for selected Group
  const availableSubjects = useMemo(
    () => getSubjectsForGroup(effectiveGroupId),
    [effectiveGroupId]
  )

  const selectedSubjectObj = useMemo(() => {
    if (allowAll && subjectId === 'all') return undefined
    return availableSubjects.find((s) => s.id === subjectId) || availableSubjects[0]
  }, [allowAll, availableSubjects, subjectId])

  const currentSubjectId = allowAll
    ? subjectId === 'all'
      ? 'all'
      : selectedSubjectObj?.id || 'all'
    : selectedSubjectObj?.id || 'general-studies'

  const effectiveSubjectIdForCascade =
    currentSubjectId === 'all'
      ? availableSubjects[0]?.id || 'general-studies'
      : currentSubjectId

  // 2. Available standards for selected Group & Subject
  const availableStandards = useMemo(
    () => getStandardsForSubject(effectiveGroupId, effectiveSubjectIdForCascade),
    [effectiveGroupId, effectiveSubjectIdForCascade]
  )

  const selectedStandardObj = useMemo(() => {
    if (allowAll && classId === 'all') return undefined
    const numClass = typeof classId === 'number' ? classId : Number(classId)
    return availableStandards.find((s) => s.id === numClass) || availableStandards[0]
  }, [allowAll, availableStandards, classId])

  const currentClassId = allowAll
    ? classId === 'all'
      ? 6
      : selectedStandardObj?.id || 6
    : selectedStandardObj?.id || 6

  // Fetch PostgreSQL dynamic units from Master Syllabus API
  useEffect(() => {
    let mounted = true
    dynamicSyllabusService
      .getUnits(
        effectiveGroupId,
        effectiveSubjectIdForCascade,
        allowAll && classId === 'all' ? undefined : currentClassId
      )
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
  }, [effectiveGroupId, effectiveSubjectIdForCascade, currentClassId, classId, allowAll, syncVersion])

  // 3. Available units for selected Group, Subject, and Standard
  const availableUnits = useMemo(() => {
    const stdForUnits =
      allowAll && classId === 'all' ? 10 : currentClassId
    const canonical = getUnitsForSubjectStandard(effectiveGroupId, effectiveSubjectIdForCascade, stdForUnits)
    if (dynamicUnits.length === 0) return canonical

    const seenIds = new Set(dynamicUnits.map((u) => u.id))
    const combined = [...dynamicUnits]
    canonical.forEach((c) => {
      if (!seenIds.has(c.id)) {
        combined.push(c)
      }
    })
    return combined.sort((a, b) => a.id - b.id)
  }, [allowAll, classId, currentClassId, dynamicUnits, effectiveGroupId, effectiveSubjectIdForCascade])

  const currentUnit = useMemo(() => {
    if (allowAll && unitId === 'all') return undefined
    const numUnit = typeof unitId === 'number' ? unitId : Number(unitId)
    return availableUnits.find((u) => u.id === numUnit) || availableUnits[0]
  }, [allowAll, availableUnits, unitId])

  const currentUnitId = allowAll
    ? unitId === 'all'
      ? 1
      : currentUnit?.id || 1
    : currentUnit?.id || 1

  // Fetch PostgreSQL dynamic lessons from Master Syllabus API
  useEffect(() => {
    let mounted = true
    const seq = ++lessonReqSeq.current
    const stdNum = allowAll && classId === 'all' ? undefined : currentClassId
    const uNum = allowAll && unitId === 'all' ? undefined : currentUnitId

    // Clear dynamic lessons immediately on criteria change to prevent stale cross-unit display
    setDynamicLessons([])

    dynamicSyllabusService
      .getLessons({
        examId: effectiveGroupId,
        subjectId: effectiveSubjectIdForCascade,
        standardNumber: stdNum,
        unitNumber: uNum,
        unitId: typeof unitId === 'number' ? unitId : undefined,
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
          }))
          setDynamicLessons(mapped)

          if (!allowAll) {
            setLessonTitle((prev) => {
              if (prev && mapped.some((m) => m.title === prev)) return prev
              return mapped[0]?.title || ''
            })
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
  }, [effectiveGroupId, effectiveSubjectIdForCascade, currentClassId, currentUnitId, classId, unitId, allowAll, syncVersion])

  // 4. Available lessons for selected Group, Subject, Standard, and Unit
  const availableLessons = useMemo(() => {
    if (dynamicLessons.length > 0) {
      return dynamicLessons
    }
    if (!allowAll) {
      return getLessonsForSelection(
        effectiveGroupId,
        effectiveSubjectIdForCascade,
        currentClassId,
        currentUnitId
      )
    }

    // In filter mode (allowAll = true):
    if (classId !== 'all' && unitId !== 'all') {
      return getLessonsForSelection(
        effectiveGroupId,
        effectiveSubjectIdForCascade,
        Number(classId),
        Number(unitId)
      )
    }

    if (classId !== 'all' && unitId === 'all') {
      const seen = new Set<string>()
      const collected: LessonItem[] = []
      for (const u of availableUnits) {
        const list = getLessonsForSelection(
          effectiveGroupId,
          effectiveSubjectIdForCascade,
          Number(classId),
          u.id
        )
        for (const l of list) {
          if (!seen.has(l.title)) {
            seen.add(l.title)
            collected.push(l)
          }
        }
      }
      return collected
    }

    if (classId === 'all' && unitId !== 'all') {
      const seen = new Set<string>()
      const collected: LessonItem[] = []
      for (const s of availableStandards) {
        const list = getLessonsForSelection(
          effectiveGroupId,
          effectiveSubjectIdForCascade,
          s.id,
          Number(unitId)
        )
        for (const l of list) {
          if (!seen.has(l.title)) {
            seen.add(l.title)
            collected.push(l)
          }
        }
      }
      return collected
    }

    return getLessonsForSelection(
      effectiveGroupId,
      effectiveSubjectIdForCascade,
      availableStandards[0]?.id || 6,
      availableUnits[0]?.id || 1
    )
  }, [
    allowAll,
    availableStandards,
    availableUnits,
    classId,
    currentClassId,
    currentUnitId,
    dynamicLessons,
    effectiveGroupId,
    effectiveSubjectIdForCascade,
    unitId,
  ])

  const selectedLessonObj = useMemo(() => {
    if (allowAll && (lessonTitle === 'all' || !lessonTitle)) return undefined
    return (
      availableLessons.find((l) => l.title === lessonTitle) ||
      (allowAll ? undefined : availableLessons[0])
    )
  }, [allowAll, availableLessons, lessonTitle])

  const currentLessonTitle = allowAll
    ? lessonTitle === 'all'
      ? 'all'
      : selectedLessonObj?.title || lessonTitle || 'all'
    : selectedLessonObj?.title || ''

  // Fetch PostgreSQL dynamic topics when selectedLessonObj changes
  useEffect(() => {
    let mounted = true
    const seq = ++topicReqSeq.current
    if (selectedLessonObj?.id || selectedLessonObj?.title) {
      dynamicSyllabusService
        .getTopics(selectedLessonObj.id || '', {
          lessonTitle: selectedLessonObj.title,
          unitId: typeof currentUnitId === 'number' ? currentUnitId : undefined,
        })
        .then((tList) => {
          if (!mounted || seq !== topicReqSeq.current) return
          setDynamicTopics(tList)
          if (!allowAll && tList.length > 0) {
            setTopic((prev) => {
              if (prev && tList.some((t) => t.topic_name === prev)) return prev
              return tList[0]?.topic_name || ''
            })
          }
        })
    } else {
      setDynamicTopics([])
      if (!allowAll) setTopic('')
    }
    return () => {
      mounted = false
    }
  }, [selectedLessonObj?.id, selectedLessonObj?.title, currentUnitId, syncVersion, allowAll])

  // ---------------------------------------------------------------------------
  // EXPLICIT DOWNSTREAM RESET HANDLERS
  // ---------------------------------------------------------------------------

  // 1. When Group changes: resets Subject, Standard, Unit, Lesson, Topic
  const handleGroupChange = (newGroupId: GroupFilterValue) => {
    setGroupId(newGroupId)
    setDynamicLessons([])
    setDynamicTopics([])
    setTopic(allowAll ? 'all' : '')
    if (allowAll) {
      if (newGroupId === 'all') {
        setSubjectId('all')
        setClassId('all')
        setUnitId('all')
        setLessonTitle('all')
      } else {
        const nextSubjects = getSubjectsForGroup(newGroupId)
        const validSubj =
          subjectId !== 'all' && nextSubjects.some((s) => s.id === subjectId)
            ? subjectId
            : 'all'
        setSubjectId(validSubj)
        setClassId('all')
        setUnitId('all')
        setLessonTitle('all')
      }
    } else {
      const strictGroup = newGroupId === 'all' ? 'group1' : newGroupId
      const nextSubjects = getSubjectsForGroup(strictGroup)
      const nextSubj = nextSubjects[0]?.id || 'general-studies'
      setSubjectId(nextSubj)

      const nextStandards = getStandardsForSubject(strictGroup, nextSubj)
      const nextStd = nextStandards[0]?.id || 6
      setClassId(nextStd)

      const nextUnits = getUnitsForSubjectStandard(strictGroup, nextSubj, nextStd)
      const nextUnit = nextUnits[0]?.id || 1
      setUnitId(nextUnit)

      const nextLessons = getLessonsForSelection(strictGroup, nextSubj, nextStd, nextUnit)
      const nextLesson = nextLessons[0]?.title || ''
      setLessonTitle(nextLesson)
      setTopic(nextLessons[0]?.topics?.[0]?.name || '')
    }
    onChange?.()
  }

  // 2. When Subject changes: resets Standard, Unit, Lesson, Topic
  const handleSubjectChange = (newSubj: string) => {
    setSubjectId(newSubj)
    setDynamicLessons([])
    setDynamicTopics([])
    setTopic(allowAll ? 'all' : '')
    if (allowAll) {
      const nextStandards = getStandardsForSubject(
        effectiveGroupId,
        newSubj === 'all' ? 'general-studies' : newSubj
      )
      if (classId !== 'all' && !nextStandards.some((s) => s.id === Number(classId))) {
        setClassId('all')
      }
      setUnitId('all')
      setLessonTitle('all')
    } else {
      const nextStandards = getStandardsForSubject(effectiveGroupId, newSubj)
      const nextStd = nextStandards[0]?.id || 6
      setClassId(nextStd)

      const nextUnits = getUnitsForSubjectStandard(effectiveGroupId, newSubj, nextStd)
      const nextUnit = nextUnits[0]?.id || 1
      setUnitId(nextUnit)

      const nextLessons = getLessonsForSelection(effectiveGroupId, newSubj, nextStd, nextUnit)
      const nextLesson = nextLessons[0]?.title || ''
      setLessonTitle(nextLesson)
      setTopic(nextLessons[0]?.topics?.[0]?.name || '')
    }
    onChange?.()
  }

  // 3. When Standard changes: resets Unit, Lesson, Topic
  const handleStandardChange = (newStd: number | 'all') => {
    setClassId(newStd)
    setDynamicLessons([])
    setDynamicTopics([])
    setTopic(allowAll ? 'all' : '')
    if (allowAll) {
      if (newStd !== 'all' && unitId !== 'all') {
        const nextUnits = getUnitsForSubjectStandard(
          effectiveGroupId,
          effectiveSubjectIdForCascade,
          Number(newStd)
        )
        if (!nextUnits.some((u) => u.id === Number(unitId))) {
          setUnitId('all')
        }
      }
      setLessonTitle('all')
    } else {
      const strictStd = newStd === 'all' ? 6 : Number(newStd)
      const nextUnits = getUnitsForSubjectStandard(
        effectiveGroupId,
        effectiveSubjectIdForCascade,
        strictStd
      )
      const nextUnit = nextUnits[0]?.id || 1
      setUnitId(nextUnit)

      const nextLessons = getLessonsForSelection(
        effectiveGroupId,
        effectiveSubjectIdForCascade,
        strictStd,
        nextUnit
      )
      const nextLesson = nextLessons[0]?.title || ''
      setLessonTitle(nextLesson)
      setTopic(nextLessons[0]?.topics?.[0]?.name || '')
    }
    onChange?.()
  }

  // 4. When Unit changes: resets Lesson and Topic strictly to only this unit's items
  const handleUnitChange = (newUnit: number | 'all') => {
    setUnitId(newUnit)
    setDynamicLessons([])
    setDynamicTopics([])
    setTopic(allowAll ? 'all' : '')
    if (allowAll) {
      setLessonTitle('all')
    } else {
      const strictUnit = newUnit === 'all' ? 1 : Number(newUnit)
      const nextLessons = getLessonsForSelection(
        effectiveGroupId,
        effectiveSubjectIdForCascade,
        currentClassId,
        strictUnit
      )
      const nextLesson = nextLessons[0]?.title || ''
      setLessonTitle(nextLesson)
      setTopic(nextLessons[0]?.topics?.[0]?.name || '')
    }
    onChange?.()
  }

  // 5. When Lesson changes: resets Topic strictly to this lesson's topics
  const handleLessonChange = (newLesson: string) => {
    setLessonTitle(newLesson)
    setDynamicTopics([])
    setTopic(allowAll ? 'all' : '')
    onChange?.()
  }

  // 6. When Topic changes
  const handleTopicChange = (newTopic: string) => {
    setTopic(newTopic)
    onChange?.()
  }

  // Sync selection programmatically (e.g., to Question Bank filter)
  const syncSelection = (selection: {
    groupId: GroupFilterValue
    subjectId: string
    classId: number | 'all'
    unitId: number | 'all'
    lessonTitle: string
    topic?: string
  }) => {
    setGroupId(selection.groupId)
    setSubjectId(selection.subjectId)
    setClassId(selection.classId)
    setUnitId(selection.unitId)
    setLessonTitle(selection.lessonTitle)
    if (selection.topic !== undefined) {
      setTopic(selection.topic)
    }
    onChange?.()
  }

  const resetFilters = () => {
    if (allowAll) {
      setGroupId('all')
      setSubjectId('all')
      setClassId('all')
      setUnitId('all')
      setLessonTitle('all')
      setTopic('all')
    } else {
      handleGroupChange('group1')
    }
    onChange?.()
  }

  // Defensive fallback synchronization effects for strict mode
  useEffect(() => {
    if (allowAll) return
    const subjects = getSubjectsForGroup(effectiveGroupId)
    if (!subjects.some((s) => s.id === subjectId)) {
      setSubjectId(subjects[0]?.id || 'general-studies')
    }
  }, [allowAll, effectiveGroupId, subjectId])

  useEffect(() => {
    if (allowAll) return
    const standards = getStandardsForSubject(effectiveGroupId, effectiveSubjectIdForCascade)
    if (!standards.some((s) => s.id === classId)) {
      setClassId(standards[0]?.id || 6)
    }
  }, [allowAll, effectiveGroupId, effectiveSubjectIdForCascade, classId])

  useEffect(() => {
    if (allowAll) return
    if (availableUnits.length > 0 && !availableUnits.some((u) => u.id === unitId)) {
      setUnitId(availableUnits[0].id)
    }
  }, [allowAll, availableUnits, unitId])

  useEffect(() => {
    if (allowAll) return
    if (availableLessons.length > 0) {
      if (!availableLessons.some((l) => l.title === lessonTitle)) {
        setLessonTitle(availableLessons[0].title)
      }
    } else if (lessonTitle) {
      setLessonTitle('')
    }
  }, [
    allowAll,
    availableLessons,
    lessonTitle,
  ])

  return {
    groupId,
    subjectId,
    classId,
    unitId,
    lessonTitle,
    topic,
    effectiveGroupId,
    currentSubjectId,
    currentClassId,
    currentUnitId,
    currentLessonTitle,
    availableSubjects,
    availableStandards,
    availableUnits,
    availableLessons,
    availableTopics: dynamicTopics,
    selectedSubjectObj,
    selectedStandardObj,
    currentUnit,
    selectedLessonObj,
    handleGroupChange,
    handleSubjectChange,
    handleStandardChange,
    handleUnitChange,
    handleLessonChange,
    handleTopicChange,
    syncSelection,
    resetFilters,
  }
}

export interface SyllabusCascadeSelectorProps {
  cascade: SyllabusCascadeState
  allowAll?: boolean
  variant?: 'generator' | 'filter'
  showTopic?: boolean
  extraFilters?: React.ReactNode
}

/**
 * Shared 5-Dropdown Syllabus Selection Component
 * Renders the 5 syllabus dropdowns in the exact required order:
 * 1. TNPSC Group
 * 2. Subject Selection
 * 3. Standard
 * 4. Unit
 * 5. Lesson Title
 */
export const SyllabusCascadeSelector: React.FC<SyllabusCascadeSelectorProps> = ({
  cascade,
  allowAll = false,
  variant = 'generator',
  showTopic = false,
  extraFilters,
}) => {
  const {
    groupId,
    subjectId,
    classId,
    unitId,
    lessonTitle,
    topic,
    currentSubjectId,
    currentClassId,
    currentUnitId,
    currentLessonTitle,
    availableSubjects,
    availableStandards,
    availableUnits,
    availableLessons,
    availableTopics,
    handleGroupChange,
    handleSubjectChange,
    handleStandardChange,
    handleUnitChange,
    handleLessonChange,
    handleTopicChange,
  } = cascade

  const selectClassName = variant === 'filter' ? 'ai-select qb-syllabus-select' : 'ai-select'

  return (
    <div className={variant === 'filter' ? 'qb-syllabus-cascade-wrapper' : 'ai-syllabus-cascade-wrapper'}>
      {/* Row 1: 1. TNPSC Group, 2. Subject Selection, 3. Standard */}
      <div className="ai-selection-tier-1">
        {/* 1. TNPSC Group */}
        <div className="ai-field">
          <label>1. TNPSC Group {!allowAll && '*'}</label>
          <select
            className={selectClassName}
            aria-label="1. TNPSC Group"
            value={groupId}
            onChange={(e) => handleGroupChange(e.target.value as GroupFilterValue)}
          >
            {allowAll && <option value="all">All TNPSC Groups</option>}
            {TNPSC_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Subject Selection */}
        <div className="ai-field">
          <label>
            2. Subject Selection ({availableSubjects.length} Subjects) {!allowAll && '*'}
          </label>
          <select
            className={selectClassName}
            aria-label="2. Subject Selection"
            value={allowAll ? subjectId : currentSubjectId}
            onChange={(e) => handleSubjectChange(e.target.value)}
          >
            {allowAll && <option value="all">All Subjects ({availableSubjects.length})</option>}
            {availableSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Standard */}
        <div className="ai-field">
          <label>
            3. Standard ({availableStandards.length} Standards) {!allowAll && '*'}
          </label>
          <select
            className={selectClassName}
            aria-label="3. Standard"
            value={allowAll ? String(classId) : String(currentClassId)}
            onChange={(e) => {
              const val = e.target.value
              handleStandardChange(val === 'all' ? 'all' : Number(val))
            }}
          >
            {allowAll && (
              <option value="all">
                All Standards ({availableStandards[0]?.shortLabel || '6th'}–
                {availableStandards[availableStandards.length - 1]?.shortLabel || '12th'})
              </option>
            )}
            {availableStandards.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: 4. Unit, 5. Lesson Title (+ optional extraFilters in Question Bank filter mode) */}
      <div
        className={variant === 'filter' ? 'qb-selection-tier-2' : 'ai-selection-tier-2'}
        style={{ marginTop: '0.85rem' }}
      >
        {/* 4. Unit */}
        <div className="ai-field">
          <label>
            4. Unit ({availableUnits.length} Units) {!allowAll && '*'}
          </label>
          <select
            className={selectClassName}
            aria-label="4. Unit"
            value={allowAll ? String(unitId) : String(currentUnitId)}
            onChange={(e) => {
              const val = e.target.value
              handleUnitChange(val === 'all' ? 'all' : Number(val))
            }}
          >
            {allowAll && <option value="all">All Units ({availableUnits.length})</option>}
            {availableUnits.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.unitNumber}: {u.title}
              </option>
            ))}
          </select>
        </div>

        {/* 5. Lesson Title */}
        <div className="ai-field">
          <label>
            5. Lesson Title ({availableLessons.length} Lessons) {!allowAll && '*'}
          </label>
          <select
            className={selectClassName}
            aria-label="5. Lesson Title"
            value={allowAll ? lessonTitle : currentLessonTitle}
            onChange={(e) => handleLessonChange(e.target.value)}
          >
            {allowAll && <option value="all">All Lessons ({availableLessons.length})</option>}
            {availableLessons.length === 0 ? (
              !allowAll && (
                <option value="" disabled>
                  No lessons mapped for this selection
                </option>
              )
            ) : (
              availableLessons.map((l) => {
                const numPrefix = l.lessonNumber
                  ? l.lessonNumber.toLowerCase().startsWith('lesson')
                    ? l.lessonNumber
                    : `Lesson ${l.lessonNumber}`
                  : ''
                const displayLabel = numPrefix ? `${numPrefix} – ${l.title}` : l.title
                return (
                  <option key={l.id} value={l.title}>
                    {displayLabel}
                  </option>
                )
              })
            )}
          </select>
        </div>

        {/* 6. Specific Topic (When available or showTopic requested) */}
        {(showTopic || (availableTopics && availableTopics.length > 0)) && (
          <div className="ai-field">
            <label>
              6. Specific Topic ({availableTopics?.length || 0} Topics)
            </label>
            <select
              className={selectClassName}
              aria-label="6. Specific Topic"
              value={topic}
              onChange={(e) => handleTopicChange(e.target.value)}
            >
              {allowAll && <option value="all">All Topics ({availableTopics?.length || 0})</option>}
              {!availableTopics || availableTopics.length === 0 ? (
                <option value="">Entire Lesson / All Topics</option>
              ) : (
                <>
                  <option value="">Entire Lesson / All Topics</option>
                  {availableTopics.map((t) => (
                    <option key={t.id} value={t.topic_name}>
                      {t.topic_name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        )}

        {extraFilters}
      </div>
    </div>
  )
}
