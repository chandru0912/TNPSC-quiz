import React, { useEffect, useState } from 'react'
import {
  FileText,
  BookOpen,
  GraduationCap,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import { apiFetch } from '../utils/api'
import { subscribeStudentSync } from '../utils/studentSync'
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker'
import {
  getSubjectsForGroup,
  getStandardsForSubject,
} from '../data/unifiedSyllabusRegistry'
import {
  dynamicSyllabusService,
  type DynamicUnit,
  type DynamicLesson,
} from '../services/dynamicSyllabusService'
import { LessonAwardSummaryBar } from '../components/exam/AchievementAwards'
import './MCQPractice.css'
import './MarkList.css'

export const MarkList: React.FC = () => {
  useStudyTimeTracker()

  const [selectedGroup, setSelectedGroup] = useState<'group1' | 'group2' | 'group4'>('group1')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('general-studies')
  const [selectedStandardId, setSelectedStandardId] = useState<number>(6)
  const [activeUnitFilter, setActiveUnitFilter] = useState<number | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null)

  const [dynamicUnits, setDynamicUnits] = useState<DynamicUnit[]>([])
  const [isUnitsLoading, setIsUnitsLoading] = useState<boolean>(true)
  const [unitsCountByStandard, setUnitsCountByStandard] = useState<Record<number, number>>({})
  const [dynamicLessons, setDynamicLessons] = useState<DynamicLesson[]>([])
  const [isLessonsLoading, setIsLessonsLoading] = useState<boolean>(false)
  const [syllabusRefreshTick, setSyllabusRefreshTick] = useState<number>(0)
  const [progressRefreshTick, setProgressRefreshTick] = useState<number>(0)

  const [syllabusFacets, setSyllabusFacets] = useState<{
    totalQuestions: number
    subjects: { id?: string; name: string; questionCount: number }[]
    standards: { classId: number; questionCount: number }[]
    units: { unitId: number; questionCount: number }[]
    lessons: {
      lessonId: string | null
      lessonTitle: string
      questionCount: number
    }[]
  }>({
    totalQuestions: 0,
    subjects: [],
    standards: [],
    units: [],
    lessons: [],
  })

  const [unitProgressByNum, setUnitProgressByNum] = useState<
    Record<
      number,
      {
        totalLessons: number
        completedLessons: number
        remainingLessons: number
        completionPercentage: number
        totalAttempts: number
      }
    >
  >({})

  const [lessonProgressById, setLessonProgressById] = useState<
    Record<
      string,
      {
        status: 'not_started' | 'in_progress' | 'completed'
        totalAttempts: number
        latestAttemptScore: number | null
        bestAttemptScore: number | null
        goldCount: number
        platinumCount: number
        silverCount: number
        totalAwards: number
      }
    >
  >({})

  const groups: { id: 'group1' | 'group2' | 'group4'; name: string }[] = [
    { id: 'group1', name: 'TNPSC Group 1' },
    { id: 'group2', name: 'TNPSC Group 2 & 2A' },
    { id: 'group4', name: 'TNPSC Group 4' },
  ]

  const hierarchySubjects = getSubjectsForGroup(selectedGroup).map((sub) => {
    const matched = syllabusFacets.subjects.find(
      (f) => f.id === sub.id || f.name.toLowerCase() === sub.name.toLowerCase()
    )
    return {
      ...sub,
      questionCount: matched ? matched.questionCount : 0,
    }
  })

  const effectiveSubjectId = hierarchySubjects.some((s) => s.id === selectedSubjectId)
    ? selectedSubjectId
    : hierarchySubjects[0]?.id || 'general-studies'

  const hierarchyStandards = effectiveSubjectId
    ? getStandardsForSubject(selectedGroup, effectiveSubjectId).map((st) => {
        const matched = syllabusFacets.standards.find((f) => Number(f.classId) === st.id)
        return {
          ...st,
          questionCount: matched ? matched.questionCount : 0,
        }
      })
    : []

  const effectiveClassId: number | null =
    hierarchyStandards.length > 0
      ? hierarchyStandards.some((s) => s.id === selectedStandardId)
        ? selectedStandardId
        : hierarchyStandards[0].id
      : null

  // Subscribe to Study Materials & Student sync events
  useEffect(() => {
    const unsubSyl = dynamicSyllabusService.subscribe(() => {
      setSyllabusRefreshTick((t) => t + 1)
    })
    const unsubStu = subscribeStudentSync(() => {
      setProgressRefreshTick((t) => t + 1)
    })
    return () => {
      unsubSyl()
      unsubStu()
    }
  }, [])

  // Fetch live syllabus question counts
  useEffect(() => {
    let isMounted = true
    const fetchFacets = async () => {
      try {
        const params = new URLSearchParams()
        params.set('category', selectedGroup)
        if (effectiveSubjectId) params.set('subject', effectiveSubjectId)
        if (effectiveClassId) params.set('classId', String(effectiveClassId))
        if (activeUnitFilter) params.set('unitId', String(activeUnitFilter))

        const res = await apiFetch(`/api/questions/syllabus-facets?${params.toString()}`)
        if (!res.ok) return
        const data = await res.json()
        if (isMounted && data?.status === 'success') {
          setSyllabusFacets({
            totalQuestions: data.totalQuestions || 0,
            subjects: Array.isArray(data.subjects) ? data.subjects : [],
            standards: Array.isArray(data.standards) ? data.standards : [],
            units: Array.isArray(data.units) ? data.units : [],
            lessons: Array.isArray(data.lessons) ? data.lessons : [],
          })
        }
      } catch {
        // Ignore facet error
      }
    }
    fetchFacets()
    return () => {
      isMounted = false
    }
  }, [selectedGroup, effectiveSubjectId, effectiveClassId, activeUnitFilter, syllabusRefreshTick])

  // Fetch live Study Materials Units
  useEffect(() => {
    let isMounted = true
    if (!effectiveSubjectId || !effectiveClassId) {
      setDynamicUnits([])
      setIsUnitsLoading(false)
      return () => {
        isMounted = false
      }
    }
    setIsUnitsLoading(true)
    dynamicSyllabusService
      .getUnits(selectedGroup, effectiveSubjectId, effectiveClassId, { allowEmpty: true })
      .then((units) => {
        if (isMounted) {
          setDynamicUnits(units)
          setIsUnitsLoading(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setDynamicUnits([])
          setIsUnitsLoading(false)
        }
      })
    return () => {
      isMounted = false
    }
  }, [selectedGroup, effectiveSubjectId, effectiveClassId, syllabusRefreshTick])

  // Fetch unit counts per standard card
  useEffect(() => {
    let isMounted = true
    if (!effectiveSubjectId) {
      setUnitsCountByStandard({})
      return () => {
        isMounted = false
      }
    }
    const stdIds = getStandardsForSubject(selectedGroup, effectiveSubjectId).map((s) => s.id)
    Promise.all(
      stdIds.map(async (stdId) => {
        const units = await dynamicSyllabusService.getUnits(selectedGroup, effectiveSubjectId, stdId, {
          allowEmpty: true,
        })
        return [stdId, units.length] as const
      })
    )
      .then((entries) => {
        if (isMounted) {
          setUnitsCountByStandard(Object.fromEntries(entries))
        }
      })
      .catch(() => {
        if (isMounted) {
          setUnitsCountByStandard({})
        }
      })
    return () => {
      isMounted = false
    }
  }, [selectedGroup, effectiveSubjectId, syllabusRefreshTick])

  // Fetch live Study Materials Lessons when a unit is opened
  useEffect(() => {
    let isMounted = true
    if (!effectiveSubjectId || !effectiveClassId || !activeUnitFilter) {
      setDynamicLessons([])
      setIsLessonsLoading(false)
      return () => {
        isMounted = false
      }
    }
    setIsLessonsLoading(true)
    dynamicSyllabusService
      .getLessons({
        examId: selectedGroup,
        subjectId: effectiveSubjectId,
        standardNumber: effectiveClassId,
        unitNumber: activeUnitFilter,
      })
      .then((lessons) => {
        if (isMounted) {
          setDynamicLessons(lessons)
          setIsLessonsLoading(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setDynamicLessons([])
          setIsLessonsLoading(false)
        }
      })
    return () => {
      isMounted = false
    }
  }, [selectedGroup, effectiveSubjectId, effectiveClassId, activeUnitFilter, syllabusRefreshTick])

  // Fetch authenticated student's combined MCQ Practice & Mock Test performance records
  useEffect(() => {
    let isMounted = true
    const studentToken = localStorage.getItem('tnpsc_student_token')
    if (!studentToken || !effectiveSubjectId || !effectiveClassId) {
      setUnitProgressByNum({})
      setLessonProgressById({})
      return () => {
        isMounted = false
      }
    }

    const q = new URLSearchParams({
      groupId: selectedGroup,
      subjectId: effectiveSubjectId,
      standardId: String(effectiveClassId),
      mode: 'all',
    })
    apiFetch(`/api/student/syllabus-progress?${q.toString()}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    })
      .then(async (res) => {
        if (!res.ok) return
        const json = await res.json()
        if (!isMounted || json?.status !== 'success' || !json?.data) return
        const uMap: Record<number, any> = {}
        for (const u of json.data.units || []) {
          uMap[Number(u.unitNumber)] = u
        }
        const lMap: Record<string, any> = {}
        for (const l of json.data.lessons || []) {
          if (l.lessonId) lMap[String(l.lessonId)] = l
          if (l.lessonTitle) lMap[`title:${String(l.lessonTitle).trim().toLowerCase()}`] = l
        }
        setUnitProgressByNum(uMap)
        setLessonProgressById(lMap)
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [selectedGroup, effectiveSubjectId, effectiveClassId, progressRefreshTick, syllabusRefreshTick])

  const hierarchyUnits =
    effectiveSubjectId && effectiveClassId
      ? dynamicUnits.map((u) => {
          const unitNum = Number(u.unit_number)
          const matched = syllabusFacets.units.find((f) => Number(f.unitId) === unitNum)
          return {
            id: unitNum,
            unitNumber: u.unitNumber || u.unit_code || `Unit ${unitNum}`,
            title: u.title,
            questionCount: matched ? matched.questionCount : 0,
          }
        })
      : []

  const hierarchyLessons =
    effectiveSubjectId && effectiveClassId && activeUnitFilter
      ? dynamicLessons.map((l) => {
          const normTitle = (l.title || '').trim().toLowerCase()
          const matched = syllabusFacets.lessons.find(
            (f) => (f.lessonId && f.lessonId === l.id) || f.lessonTitle.trim().toLowerCase() === normTitle
          )
          return {
            id: l.id,
            lessonNumber: l.lesson_number || '',
            title: l.title,
            questionCount: matched ? matched.questionCount : 0,
          }
        })
      : []

  const activeSubjectObj = hierarchySubjects.find((s) => s.id === effectiveSubjectId) || null
  const activeUnitObj = hierarchyUnits.find((u) => u.id === activeUnitFilter) || null
  const currentView: 'browse' | 'lessons' = activeUnitFilter ? 'lessons' : 'browse'

  const handleGroupSelect = (grp: 'group1' | 'group2' | 'group4') => {
    const nextSubs = getSubjectsForGroup(grp)
    const defaultSubject = nextSubs[0]?.id || 'general-studies'
    const nextStds = getStandardsForSubject(grp, defaultSubject)
    const defaultStandard = nextStds[0]?.id || 6
    setSelectedGroup(grp)
    setSelectedSubjectId(defaultSubject)
    setSelectedStandardId(defaultStandard)
    setSelectedUnitId(null)
    setActiveUnitFilter(null)
  }

  return (
    <div className="practice">
      <div className="practice-container">
        <div className="practice-header">
          <h1 className="practice-title">
            <FileText size={32} />
            <span>
              Student <span className="gradient-text">Mark List</span>
            </span>
          </h1>
        </div>

        {/* 1. TNPSC Group Selection Tabs (Visible on browse selection view) */}
        {currentView === 'browse' && (
          <div className="practice-categories glass">
            {groups.map((group) => {
              const isActive = selectedGroup === group.id
              return (
                <button
                  key={group.id}
                  type="button"
                  className={`practice-category-tab ${isActive ? 'active' : ''}`}
                  onClick={() => handleGroupSelect(group.id)}
                >
                  {group.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Compact Syllabus Breadcrumb (Lessons view only) */}
        {currentView === 'lessons' && (
          <div className="practice-breadcrumb-row">
            <nav className="practice-breadcrumb glass" aria-label="Mark list syllabus breadcrumb">
              <button
                type="button"
                className="breadcrumb-crumb"
                onClick={() => setActiveUnitFilter(null)}
              >
                {selectedGroup === 'group2'
                  ? 'TNPSC Group 2 & 2A'
                  : selectedGroup === 'group4'
                    ? 'TNPSC Group 4'
                    : 'TNPSC Group 1'}
              </button>

              {activeSubjectObj && (
                <>
                  <ChevronRight size={14} className="breadcrumb-sep" />
                  <button
                    type="button"
                    className="breadcrumb-crumb"
                    onClick={() => setActiveUnitFilter(null)}
                  >
                    {activeSubjectObj.name}
                  </button>
                </>
              )}

              {effectiveClassId && (
                <>
                  <ChevronRight size={14} className="breadcrumb-sep" />
                  <button
                    type="button"
                    className="breadcrumb-crumb"
                    onClick={() => setActiveUnitFilter(null)}
                  >
                    {`${effectiveClassId}th Standard`}
                  </button>
                </>
              )}

              {activeUnitFilter && (
                <>
                  <ChevronRight size={14} className="breadcrumb-sep" />
                  <span className="breadcrumb-crumb current">
                    {activeUnitObj ? `${activeUnitObj.unitNumber}: ${activeUnitObj.title}` : `Unit ${activeUnitFilter}`}
                  </span>
                </>
              )}
            </nav>
          </div>
        )}

        {/* BROWSE VIEW: Compact Subjects + 6th-12th Standards + Unit Progress Cards */}
        {currentView === 'browse' && (
          <div className="hierarchy-navigator">
            {/* 2. Subject Selection */}
            <section className="hierarchy-section glass compact-subjects-section">
              <div className="hierarchy-section-header compact-header">
                <span className="hierarchy-step-badge">Subject</span>
                <h3>Select Subject</h3>
              </div>
              <div className="compact-subject-grid">
                {hierarchySubjects.map((sub) => {
                  const isActiveSub = effectiveSubjectId === sub.id
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      className={`compact-subject-card ${isActiveSub ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedSubjectId(sub.id)
                        setSelectedUnitId(null)
                        setActiveUnitFilter(null)
                      }}
                    >
                      <div className="compact-subject-left">
                        <BookOpen size={15} className="compact-subject-icon" />
                        <span className="compact-subject-title">{sub.name}</span>
                      </div>
                      <span className={`compact-count-badge ${sub.questionCount > 0 ? 'has-qs' : ''}`}>
                        {sub.questionCount} Qs
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* 3. Standard Selection */}
            <section className="classes-top-section glass">
              <div className="classes-section-header">
                <div className="classes-heading-group">
                  <div className="classes-title-badge">
                    <GraduationCap size={16} />
                    <span>Samacheer Kalvi Standard Mapping</span>
                  </div>
                  <h2 className="classes-main-heading">
                    {activeSubjectObj?.name} — Select Standard
                  </h2>
                </div>
                <span className="classes-count-badge">{hierarchyStandards.length} Standards</span>
              </div>

              <div className="class-cards-grid">
                {hierarchyStandards.map((cls) => {
                  const unitCount = unitsCountByStandard[cls.id] ?? 0
                  const isActiveStd = effectiveClassId === cls.id
                  return (
                    <div
                      key={cls.id}
                      role="button"
                      tabIndex={0}
                      className={`class-card glass ${isActiveStd ? 'active-standard' : ''}`}
                      onClick={() => {
                        setSelectedStandardId(cls.id)
                        setSelectedUnitId(null)
                        setActiveUnitFilter(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedStandardId(cls.id)
                          setSelectedUnitId(null)
                          setActiveUnitFilter(null)
                        }
                      }}
                    >
                      <div className="class-card-top">
                        <span className="class-num-badge">{cls.id}th</span>
                        <span className="class-badge-samacheer">Samacheer Kalvi</span>
                      </div>

                      <div className="class-card-main">
                        <div className="class-icon-circle">
                          <GraduationCap size={20} />
                        </div>
                        <h3 className="class-card-title">{cls.label}</h3>
                        <p className="class-card-desc">
                          {unitCount} {unitCount === 1 ? 'Unit' : 'Units'} • {cls.questionCount} Questions
                        </p>
                      </div>

                      <div className="class-card-cta">
                        <span>{isActiveStd ? 'Selected' : 'Select'}</span>
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* 4. Unit Selection — Lesson Completion & Progress Only (No Award Badges) */}
            {effectiveClassId && (
              <section className="hierarchy-section glass unified-units-section">
                <div className="hierarchy-section-header">
                  <span className="hierarchy-step-badge">{effectiveClassId}th Standard</span>
                  <h3>Select Unit — {effectiveClassId}th Standard ({activeSubjectObj?.name})</h3>
                </div>
                {isUnitsLoading && hierarchyUnits.length === 0 ? (
                  <p className="hierarchy-empty-note">Loading units from Study Materials...</p>
                ) : hierarchyUnits.length > 0 ? (
                  <div className="hierarchy-card-grid">
                    {hierarchyUnits.map((u) => {
                      const uProg = unitProgressByNum[u.id]
                      const totalL = uProg?.totalLessons ?? 0
                      const completedL = uProg?.completedLessons ?? 0
                      const remainingL = uProg?.remainingLessons ?? totalL
                      const pctL = uProg?.completionPercentage ?? 0
                      return (
                        <button
                          key={u.id}
                          type="button"
                          className={`hierarchy-card ${selectedUnitId === u.id ? 'selected-unit' : ''}`}
                          onClick={() => {
                            setSelectedUnitId(u.id)
                            setActiveUnitFilter(u.id)
                          }}
                        >
                          <div className="hierarchy-card-top">
                            <span className="hierarchy-unit-num">{u.unitNumber}</span>
                            <span className={`hierarchy-count-pill ${u.questionCount > 0 ? 'has-qs' : ''}`}>
                              {u.questionCount} Questions
                            </span>
                          </div>
                          <span className="hierarchy-card-title">{u.title}</span>
                          <div className="unit-card-progress-summary">
                            <div className="unit-progress-metrics">
                              <span>Lessons: <strong>{totalL}</strong></span>
                              <span>Completed: <strong>{completedL}</strong></span>
                              <span>Remaining: <strong>{remainingL}</strong></span>
                              <span className="unit-progress-pct">Progress: <strong>{pctL}%</strong></span>
                            </div>
                            <div className="unit-progress-track" aria-label={`Unit progress ${pctL}%`}>
                              <div
                                className="unit-progress-fill"
                                style={{ width: `${Math.min(100, Math.max(0, pctL))}%` }}
                              />
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="hierarchy-empty-note">
                    No units mapped in Study Materials for {effectiveClassId}th Standard ({activeSubjectObj?.name}).
                  </p>
                )}
              </section>
            )}
          </div>
        )}

        {/* 5. LESSON SELECTION VIEW — Lesson Performance & Gold / Platinum / Silver Badges */}
        {currentView === 'lessons' && (
          <div className="hierarchy-navigator">
            <div className="page-step-back-row">
              <button
                type="button"
                className="back-btn glass"
                onClick={() => setActiveUnitFilter(null)}
              >
                <ArrowLeft size={16} />
                <span>Back to Units</span>
              </button>
            </div>

            <section className="hierarchy-section glass">
              <div className="hierarchy-section-header">
                <span className="hierarchy-step-badge">
                  {activeUnitObj?.unitNumber || `Unit ${activeUnitFilter}`}
                </span>
                <h3>
                  {activeUnitObj?.title || 'Lessons'} — {effectiveClassId}th Standard
                </h3>
              </div>
              {isLessonsLoading ? (
                <p className="hierarchy-empty-note">Loading lessons from Study Materials...</p>
              ) : hierarchyLessons.length > 0 ? (
                <div className="hierarchy-lesson-list">
                  {hierarchyLessons.map((l) => {
                    const lProg =
                      lessonProgressById[String(l.id)] ||
                      lessonProgressById[`title:${l.title.trim().toLowerCase()}`]
                    const status = lProg?.status || 'not_started'
                    const statusLabel =
                      status === 'completed'
                        ? 'Completed'
                        : status === 'in_progress'
                          ? 'In Progress'
                          : 'Not Started'
                    return (
                      <div key={l.id} className={`hierarchy-lesson-row lesson-status-${status}`}>
                        <div className="hierarchy-lesson-main-col">
                          <div className="hierarchy-lesson-info">
                            <div className="lesson-num-status-row">
                              <span className="hierarchy-lesson-num">Lesson {l.lessonNumber}</span>
                              <span className={`lesson-status-badge status-${status}`}>
                                {statusLabel}
                              </span>
                              {lProg && lProg.totalAttempts > 0 && (
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                  Attempts: <strong style={{ color: '#e2e8f0' }}>{lProg.totalAttempts}</strong>
                                  {lProg.latestAttemptScore != null && (
                                    <> • Latest: <strong style={{ color: '#e2e8f0' }}>{lProg.latestAttemptScore}%</strong></>
                                  )}
                                  {lProg.bestAttemptScore != null && (
                                    <> • Best: <strong style={{ color: '#fde047' }}>{lProg.bestAttemptScore}%</strong></>
                                  )}
                                </span>
                              )}
                            </div>
                            <span className="hierarchy-lesson-title">{l.title}</span>
                          </div>
                        </div>

                        <div className="hierarchy-lesson-meta">
                          <LessonAwardSummaryBar
                            goldCount={lProg?.goldCount ?? 0}
                            platinumCount={lProg?.platinumCount ?? 0}
                            silverCount={lProg?.silverCount ?? 0}
                            showTotal={false}
                          />
                          <span className={`hierarchy-count-pill ${l.questionCount > 0 ? 'has-qs' : ''}`}>
                            {l.questionCount} Questions
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="hierarchy-empty-note">
                  No lessons configured for this Standard and Unit in Study Materials.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default MarkList
