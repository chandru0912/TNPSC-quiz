import React, { useEffect, useMemo, useState } from 'react'
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

export type GroupFilterValue = 'all' | 'group1' | 'group2' | 'group4'

export interface UseSyllabusCascadeOptions {
  allowAll?: boolean
  initialGroupId?: GroupFilterValue
  initialSubjectId?: string
  initialClassId?: number | 'all'
  initialUnitId?: number | 'all'
  initialLessonTitle?: string
  onChange?: () => void
}

export interface SyllabusCascadeState {
  groupId: GroupFilterValue
  subjectId: string
  classId: number | 'all'
  unitId: number | 'all'
  lessonTitle: string
  effectiveGroupId: 'group1' | 'group2' | 'group4'
  currentSubjectId: string
  currentClassId: number
  currentUnitId: number
  currentLessonTitle: string
  availableSubjects: SyllabusSubjectConfig[]
  availableStandards: { id: number; label: string; shortLabel: string }[]
  availableUnits: SyllabusUnitOption[]
  availableLessons: LessonItem[]
  selectedSubjectObj: SyllabusSubjectConfig | undefined
  selectedStandardObj: { id: number; label: string; shortLabel: string } | undefined
  currentUnit: SyllabusUnitOption | undefined
  selectedLessonObj: LessonItem | undefined
  handleGroupChange: (newGroupId: GroupFilterValue) => void
  handleSubjectChange: (newSubjectId: string) => void
  handleStandardChange: (newClassId: number | 'all') => void
  handleUnitChange: (newUnitId: number | 'all') => void
  handleLessonChange: (newLessonTitle: string) => void
  syncSelection: (selection: {
    groupId: GroupFilterValue
    subjectId: string
    classId: number | 'all'
    unitId: number | 'all'
    lessonTitle: string
  }) => void
  resetFilters: () => void
}

/**
 * Shared cascading syllabus state hook used by both:
 * 1. Gemini AI Generator (allowAll = false)
 * 2. Question Bank Management & Publishing section (allowAll = true)
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

  // 3. Available units for selected Group, Subject, and Standard
  const availableUnits = useMemo(() => {
    const stdForUnits =
      allowAll && classId === 'all' ? 10 : currentClassId
    return getUnitsForSubjectStandard(effectiveGroupId, effectiveSubjectIdForCascade, stdForUnits)
  }, [allowAll, classId, currentClassId, effectiveGroupId, effectiveSubjectIdForCascade])

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

  // 4. Available lessons for selected Group, Subject, Standard, and Unit
  const availableLessons = useMemo(() => {
    if (!allowAll) {
      return getLessonsForSelection(
        effectiveGroupId,
        effectiveSubjectIdForCascade,
        currentClassId,
        currentUnitId
      )
    }

    // In filter mode (allowAll = true):
    // If specific Standard and Unit are selected, return exact lessons for that combination
    if (classId !== 'all' && unitId !== 'all') {
      return getLessonsForSelection(
        effectiveGroupId,
        effectiveSubjectIdForCascade,
        Number(classId),
        Number(unitId)
      )
    }

    // If Standard is selected and Unit is 'all', aggregate lessons across available units for that Standard
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

    // If Unit is selected and Standard is 'all', aggregate lessons across available standards for that Unit
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

    // If both Standard and Unit are 'all', return lessons for default first Standard & Unit of the active Subject
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

  // ---------------------------------------------------------------------------
  // EXPLICIT DOWNSTREAM RESET HANDLERS
  // ---------------------------------------------------------------------------

  // 1. When Group changes: resets Subject, Standard, Unit, Lesson
  const handleGroupChange = (newGroupId: GroupFilterValue) => {
    setGroupId(newGroupId)
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
    }
    onChange?.()
  }

  // 2. When Subject changes: resets Standard, Unit, Lesson
  const handleSubjectChange = (newSubj: string) => {
    setSubjectId(newSubj)
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
    }
    onChange?.()
  }

  // 3. When Standard changes: resets Unit, Lesson
  const handleStandardChange = (newStd: number | 'all') => {
    setClassId(newStd)
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
    }
    onChange?.()
  }

  // 4. When Unit changes: resets Lesson
  const handleUnitChange = (newUnit: number | 'all') => {
    setUnitId(newUnit)
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
    }
    onChange?.()
  }

  // 5. When Lesson changes
  const handleLessonChange = (newLesson: string) => {
    setLessonTitle(newLesson)
    onChange?.()
  }

  // Sync selection programmatically (e.g., from Gemini AI Generator to Question Bank filter)
  const syncSelection = (selection: {
    groupId: GroupFilterValue
    subjectId: string
    classId: number | 'all'
    unitId: number | 'all'
    lessonTitle: string
  }) => {
    setGroupId(selection.groupId)
    setSubjectId(selection.subjectId)
    setClassId(selection.classId)
    setUnitId(selection.unitId)
    setLessonTitle(selection.lessonTitle)
    onChange?.()
  }

  const resetFilters = () => {
    if (allowAll) {
      setGroupId('all')
      setSubjectId('all')
      setClassId('all')
      setUnitId('all')
      setLessonTitle('all')
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
    const units = getUnitsForSubjectStandard(
      effectiveGroupId,
      effectiveSubjectIdForCascade,
      currentClassId
    )
    if (!units.some((u) => u.id === unitId)) {
      setUnitId(units[0]?.id || 1)
    }
  }, [allowAll, effectiveGroupId, effectiveSubjectIdForCascade, currentClassId, unitId])

  useEffect(() => {
    if (allowAll) return
    const lessons = getLessonsForSelection(
      effectiveGroupId,
      effectiveSubjectIdForCascade,
      currentClassId,
      currentUnitId
    )
    if (lessons.length > 0) {
      if (!lessons.some((l) => l.title === lessonTitle)) {
        setLessonTitle(lessons[0].title)
      }
    } else if (lessonTitle) {
      setLessonTitle('')
    }
  }, [
    allowAll,
    effectiveGroupId,
    effectiveSubjectIdForCascade,
    currentClassId,
    currentUnitId,
    lessonTitle,
  ])

  return {
    groupId,
    subjectId,
    classId,
    unitId,
    lessonTitle,
    effectiveGroupId,
    currentSubjectId,
    currentClassId,
    currentUnitId,
    currentLessonTitle,
    availableSubjects,
    availableStandards,
    availableUnits,
    availableLessons,
    selectedSubjectObj,
    selectedStandardObj,
    currentUnit,
    selectedLessonObj,
    handleGroupChange,
    handleSubjectChange,
    handleStandardChange,
    handleUnitChange,
    handleLessonChange,
    syncSelection,
    resetFilters,
  }
}

export interface SyllabusCascadeSelectorProps {
  cascade: SyllabusCascadeState
  allowAll?: boolean
  variant?: 'generator' | 'filter'
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
  extraFilters,
}) => {
  const {
    groupId,
    subjectId,
    classId,
    unitId,
    lessonTitle,
    currentSubjectId,
    currentClassId,
    currentUnitId,
    currentLessonTitle,
    availableSubjects,
    availableStandards,
    availableUnits,
    availableLessons,
    handleGroupChange,
    handleSubjectChange,
    handleStandardChange,
    handleUnitChange,
    handleLessonChange,
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
              availableLessons.map((l) => (
                <option key={l.id} value={l.title}>
                  {l.lessonNumber} {l.title}
                </option>
              ))
            )}
          </select>
        </div>

        {extraFilters}
      </div>
    </div>
  )
}
