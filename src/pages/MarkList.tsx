import React, { useCallback, useEffect, useState } from 'react'
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  History,
  Layers,
  Loader2,
  RefreshCw,
  RotateCcw,
  Target,
  Trophy,
  X,
  XCircle,
  MinusCircle,
} from 'lucide-react'
import { apiFetch } from '../utils/api'
import { subscribeStudentSync } from '../utils/studentSync'
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker'
import { AwardShieldLogo, type AchievementAwardResult, type AchievementAwardTier } from '../components/exam/AchievementAwards'
import './MarkList.css'

interface AttemptItem {
  id: number
  attemptUuid: string | null
  testId: string | null
  testKey: string
  testTitle: string
  resultCategory: 'mcq_practice' | 'previous_paper' | 'mock_test'
  testCategory?: 'lesson_wise' | 'unit_wise' | 'full_length' | null
  testCategoryLabel?: string | null
  assessmentType: string
  groupId: string
  groupLabel: string
  subjectId: string | null
  subjectLabel: string
  standardId: number | null
  unitId: number | null
  lessonId: string | null
  lessonTitle: string | null
  examName: string | null
  examYear: number | null
  attemptNumber: number
  totalQuestions: number
  attemptedQuestions: number
  correctAnswers: number
  incorrectAnswers: number
  unansweredQuestions: number
  marksObtained: number
  maxMarks: number
  negativeMarks: number
  percentage: number
  accuracy: number
  awardType: AchievementAwardResult
  grade: string | null
  rank: number | null
  totalParticipants: number | null
  percentile: number | null
  timeSpentSeconds: number
  date: string
  completedAt: string
}

interface GroupedTestResult {
  testKey: string
  testId: string | null
  testTitle: string
  resultCategory: 'mcq_practice' | 'previous_paper' | 'mock_test'
  testCategory?: 'lesson_wise' | 'unit_wise' | 'full_length' | null
  testCategoryLabel?: string | null
  groupId: string
  groupLabel: string
  subjectId: string | null
  subjectLabel: string
  standardId: number | null
  unitId: number | null
  lessonId: string | null
  lessonTitle: string | null
  examName: string | null
  examYear: number | null
  totalAttempts: number
  firstAttemptDate: string
  latestAttempt: AttemptItem
  bestAttempt: AttemptItem
  rank: number | null
  totalParticipants: number | null
  percentile: number | null
  attempts: AttemptItem[]
}

interface MarkListResponse {
  summary: {
    totalTestsCompleted: number
    uniqueTestsCompleted: number
    totalQuestionsAttempted: number
    overallMarksObtained: number
    overallMaxMarks: number
    overallAccuracy: number
    totalAwardsEarned: number
    goldCount: number
    platinumCount: number
    silverCount: number
    mcqPracticeCount: number
    previousPapersCount: number
    mockTestsCount?: number
  }
  counts: {
    all: number
    mcq_practice: number
    previous_paper: number
    mock_test: number
  }
  availableFilters: {
    groups: { id: string; label: string }[]
    subjects: string[]
    standards: number[]
    units: number[]
    lessons: string[]
    years: number[]
    testCategories?: { id: string; label: string }[]
  }
  mcqPracticeResults: GroupedTestResult[]
  previousPaperResults: GroupedTestResult[]
  mockTestResults?: GroupedTestResult[]
}

interface DetailedQuestionResponse {
  index: number
  questionId: number | string | null
  questionText: string
  options: string[]
  subject: string | null
  topic: string | null
  selectedOption: number | null
  correctAnswer: number | null
  status: 'correct' | 'incorrect' | 'unanswered'
  isCorrect: boolean
  marksAwarded: number
}

interface DetailedScorecard {
  id: number
  testName: string
  attemptNumber: number
  resultCategory: 'mcq_practice' | 'previous_paper' | 'mock_test'
  testCategory?: 'lesson_wise' | 'unit_wise' | 'full_length' | null
  testCategoryLabel?: string | null
  negativeMarks?: number
  groupLabel: string
  subjectLabel: string
  standardId: number | null
  unitId: number | null
  lessonTitle: string | null
  examYear: number | null
  totalQuestions: number
  attemptedQuestions: number
  correctAnswers: number
  incorrectAnswers: number
  unansweredQuestions: number
  marksObtained: number
  maxMarks: number
  percentage: number
  accuracyPercentage: number
  timeSpentSeconds: number
  awardType: AchievementAwardResult
  grade: string | null
  rank: number | null
  totalParticipants: number | null
  percentile: number | null
  date: string
  questionResponses: DetailedQuestionResponse[]
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0))
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

function toRomanUnit(unitId: number): string {
  const map: Record<number, string> = {
    1: 'Unit I',
    2: 'Unit II',
    3: 'Unit III',
    4: 'Unit IV',
    5: 'Unit V',
    6: 'Unit VI',
    7: 'Unit VII',
    8: 'Unit VIII',
    9: 'Unit IX',
    10: 'Unit X',
  }
  return map[unitId] || `Unit ${unitId}`
}

function optionLetter(idx: number | null): string {
  if (idx === null || idx < 0) return 'Not Answered'
  return String.fromCharCode(65 + idx)
}

export const MarkList: React.FC = () => {
  useStudyTimeTracker()

  const [activeCategory, setActiveCategory] = useState<'all' | 'mcq_practice' | 'previous_paper' | 'mock_test'>('all')
  const [selectedTestCategory, setSelectedTestCategory] = useState<string>('all')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedStandard, setSelectedStandard] = useState<string>('all')
  const [selectedUnit, setSelectedUnit] = useState<string>('all')
  const [selectedLesson, setSelectedLesson] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')

  const [data, setData] = useState<MarkListResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [expandedTestKeys, setExpandedTestKeys] = useState<Record<string, boolean>>({})

  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false)
  const [detailLoading, setDetailLoading] = useState<boolean>(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<DetailedScorecard | null>(null)

  const fetchMarkList = useCallback(async () => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const params = new URLSearchParams()
      if (activeCategory !== 'all') params.set('category', activeCategory)
      if (selectedTestCategory !== 'all') params.set('testCategory', selectedTestCategory)
      if (selectedGroup !== 'all') params.set('group', selectedGroup)
      if (selectedSubject !== 'all') params.set('subject', selectedSubject)
      if (selectedStandard !== 'all') params.set('standard', selectedStandard)
      if (selectedUnit !== 'all') params.set('unit', selectedUnit)
      if (selectedLesson.trim()) params.set('lesson', selectedLesson.trim())
      if (selectedYear !== 'all') params.set('year', selectedYear)
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)

      const res = await apiFetch(`/api/student/mark-list?${params.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setErrorMsg(json.message || 'Unable to load your mark list right now.')
        return
      }
      setData(json.data as MarkListResponse)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error while loading your mark list.')
    } finally {
      setIsLoading(false)
    }
  }, [
    activeCategory,
    selectedTestCategory,
    selectedGroup,
    selectedSubject,
    selectedStandard,
    selectedUnit,
    selectedLesson,
    selectedYear,
    fromDate,
    toDate,
  ])

  useEffect(() => {
    void fetchMarkList()
  }, [fetchMarkList])

  useEffect(() => {
    return subscribeStudentSync(() => {
      void fetchMarkList()
    })
  }, [fetchMarkList])

  const openAttemptDetail = async (attemptId: number) => {
    setDetailModalOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setSelectedDetail(null)
    try {
      const res = await apiFetch(`/api/student/mark-list/${attemptId}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status !== 'success') {
        setDetailError(json.message || 'Could not load detailed result.')
        return
      }
      setSelectedDetail(json.data as DetailedScorecard)
    } catch (err: any) {
      setDetailError(err?.message || 'Failed to load detailed result.')
    } finally {
      setDetailLoading(false)
    }
  }

  const toggleHistory = (key: string) => {
    setExpandedTestKeys((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const resetFilters = () => {
    setActiveCategory('all')
    setSelectedTestCategory('all')
    setSelectedGroup('all')
    setSelectedSubject('all')
    setSelectedStandard('all')
    setSelectedUnit('all')
    setSelectedLesson('')
    setSelectedYear('all')
    setFromDate('')
    setToDate('')
  }

  const hasActiveFilters =
    activeCategory !== 'all' ||
    selectedTestCategory !== 'all' ||
    selectedGroup !== 'all' ||
    selectedSubject !== 'all' ||
    selectedStandard !== 'all' ||
    selectedUnit !== 'all' ||
    selectedLesson.trim() !== '' ||
    selectedYear !== 'all' ||
    fromDate !== '' ||
    toDate !== ''

  const summary = data?.summary || {
    totalTestsCompleted: 0,
    uniqueTestsCompleted: 0,
    totalQuestionsAttempted: 0,
    overallMarksObtained: 0,
    overallMaxMarks: 0,
    overallAccuracy: 0,
    totalAwardsEarned: 0,
    goldCount: 0,
    platinumCount: 0,
    silverCount: 0,
    mcqPracticeCount: 0,
    previousPapersCount: 0,
    mockTestsCount: 0,
  }

  const counts = data?.counts || { all: 0, mcq_practice: 0, previous_paper: 0, mock_test: 0 }
  const availableFilters = data?.availableFilters || {
    groups: [],
    subjects: [],
    standards: [],
    units: [],
    lessons: [],
    years: [],
    testCategories: [],
  }

  const mcqResults = data?.mcqPracticeResults || []
  const pypResults = data?.previousPaperResults || []
  const mockResults = data?.mockTestResults || []

  const renderAwardBadge = (awardType: AchievementAwardResult) => {
    if (!awardType || awardType === 'NONE') return null
    const tier: AchievementAwardTier = awardType
    const label =
      tier === 'GOLD'
        ? 'Gold Award'
        : tier === 'PLATINUM'
          ? 'Platinum Award'
          : 'Silver Award'
    return (
      <span className={`ml-award-pill ml-award-${tier.toLowerCase()}`}>
        <AwardShieldLogo tier={tier} size={18} />
        <span>{label}</span>
      </span>
    )
  }

  const renderResultCard = (item: GroupedTestResult) => {
    const latest = item.latestAttempt
    const best = item.bestAttempt
    const isExpanded = Boolean(expandedTestKeys[`${item.resultCategory}::${item.testKey}`])
    const expandKey = `${item.resultCategory}::${item.testKey}`
    const isPreviousPaper = item.resultCategory === 'previous_paper'
    const isMockTest = item.resultCategory === 'mock_test'

    const hierarchyParts: string[] = [item.groupLabel]
    if (!isPreviousPaper) {
      if (item.subjectLabel) hierarchyParts.push(item.subjectLabel)
      if (item.standardId) hierarchyParts.push(`${item.standardId}th Standard`)
      if (item.unitId) hierarchyParts.push(toRomanUnit(item.unitId))
      if (item.lessonTitle) hierarchyParts.push(item.lessonTitle)
    } else {
      if (item.examName && item.examName !== item.groupLabel) hierarchyParts.push(item.examName)
      if (item.examYear) hierarchyParts.push(`${item.examYear} Exam`)
      if (item.subjectLabel) hierarchyParts.push(item.subjectLabel)
    }

    return (
      <article key={expandKey} className="ml-result-card glass">
        <div className="ml-card-top">
          <div className="ml-card-header-left">
            <div className="ml-category-row">
              <span className={`ml-cat-tag ${isPreviousPaper ? 'cat-pyp' : isMockTest ? 'cat-mock' : 'cat-mcq'}`}>
                {isPreviousPaper ? 'Previous Year Paper' : isMockTest ? 'Mock Test' : 'MCQ Practice'}
              </span>
              {isMockTest && item.testCategoryLabel && (
                <span className="ml-subcat-pill">{item.testCategoryLabel}</span>
              )}
              {item.examYear && <span className="ml-year-pill">{item.examYear}</span>}
              <span className="ml-date-pill">
                <Calendar size={13} />
                <span>{latest.date}</span>
              </span>
              {latest.timeSpentSeconds > 0 && (
                <span className="ml-date-pill">
                  <Clock size={13} />
                  <span>{formatDuration(latest.timeSpentSeconds)}</span>
                </span>
              )}
              {item.totalAttempts > 1 && (
                <span className="ml-attempts-pill">
                  <History size={13} />
                  <span>{item.totalAttempts} Attempts</span>
                </span>
              )}
            </div>

            <div className="ml-hierarchy-trail" aria-label="Test hierarchy">
              {hierarchyParts.join(' → ')}
            </div>

            <h3 className="ml-card-title">{item.testTitle}</h3>
          </div>

          <div className="ml-card-header-right">
            {renderAwardBadge(latest.awardType)}
            {item.rank !== null && item.totalParticipants !== null && (
              <div className="ml-rank-pill" title="Calculated among students who completed this test">
                <Trophy size={14} />
                <span>
                  Rank <strong>#{item.rank}</strong> / {item.totalParticipants}
                  {item.percentile !== null ? ` (${item.percentile}%ile)` : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Core Score & Question Breakdown */}
        <div className="ml-metrics-grid">
          <div className="ml-metric-box">
            <span className="ml-metric-label">Total Questions</span>
            <strong className="ml-metric-val">{latest.totalQuestions}</strong>
          </div>
          <div className="ml-metric-box metric-correct">
            <span className="ml-metric-label">Correct</span>
            <strong className="ml-metric-val">{latest.correctAnswers}</strong>
          </div>
          <div className="ml-metric-box metric-wrong">
            <span className="ml-metric-label">Incorrect</span>
            <strong className="ml-metric-val">{latest.incorrectAnswers}</strong>
          </div>
          <div className="ml-metric-box metric-unanswered">
            <span className="ml-metric-label">Unanswered</span>
            <strong className="ml-metric-val">{latest.unansweredQuestions}</strong>
          </div>
          <div className="ml-metric-box metric-marks">
            <span className="ml-metric-label">Marks Obtained</span>
            <strong className="ml-metric-val">
              {latest.marksObtained} / {latest.maxMarks}
            </strong>
          </div>
          <div className="ml-metric-box metric-pct">
            <span className="ml-metric-label">Percentage</span>
            <strong className="ml-metric-val">{latest.percentage}%</strong>
          </div>
          <div className="ml-metric-box metric-acc">
            <span className="ml-metric-label">Accuracy</span>
            <strong className="ml-metric-val">{latest.accuracy}%</strong>
          </div>
          {(isPreviousPaper || isMockTest) && latest.negativeMarks > 0 && (
            <div className="ml-metric-box metric-wrong">
              <span className="ml-metric-label">Negative Marks</span>
              <strong className="ml-metric-val">-{latest.negativeMarks}</strong>
            </div>
          )}
        </div>

        {/* Latest vs Best Comparison + Actions */}
        <div className="ml-card-footer">
          <div className="ml-attempt-badges">
            <span className="ml-attempt-tag latest">
              Latest (Attempt #{latest.attemptNumber}): <strong>{latest.marksObtained}/{latest.maxMarks} ({latest.percentage}%)</strong>
            </span>
            {item.totalAttempts > 1 && (
              <span className="ml-attempt-tag best">
                Best (Attempt #{best.attemptNumber}): <strong>{best.marksObtained}/{best.maxMarks} ({best.percentage}%)</strong>
              </span>
            )}
          </div>

          <div className="ml-card-actions">
            {item.totalAttempts > 1 && (
              <button
                type="button"
                className="ml-btn ml-btn-secondary"
                onClick={() => toggleHistory(expandKey)}
              >
                <History size={15} />
                <span>{isExpanded ? 'Hide History' : `Attempt History (${item.totalAttempts})`}</span>
                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            )}
            <button
              type="button"
              className="ml-btn ml-btn-primary"
              onClick={() => void openAttemptDetail(latest.id)}
            >
              <Eye size={15} />
              <span>View Result</span>
            </button>
          </div>
        </div>

        {/* Expandable Individual Attempt History */}
        {isExpanded && item.attempts.length > 0 && (
          <div className="ml-history-panel">
            <div className="ml-history-header">
              <span>Complete Attempt History (First Attempt: {item.firstAttemptDate})</span>
            </div>
            <div className="ml-history-list">
              {item.attempts.map((att) => {
                const isLatest = att.id === latest.id
                const isBest = att.id === best.id
                return (
                  <div key={att.id} className="ml-history-row">
                    <div className="ml-history-row-left">
                      <span className="ml-history-attempt-num">Attempt #{att.attemptNumber}</span>
                      {isLatest && <span className="ml-mini-tag tag-latest">Latest</span>}
                      {isBest && <span className="ml-mini-tag tag-best">Best</span>}
                      <span className="ml-history-date">{att.date}</span>
                    </div>
                    <div className="ml-history-row-mid">
                      <span>Marks: <strong>{att.marksObtained}/{att.maxMarks}</strong></span>
                      <span>Score: <strong>{att.percentage}%</strong></span>
                      <span>Accuracy: <strong className="text-green">{att.accuracy}%</strong></span>
                      {renderAwardBadge(att.awardType)}
                    </div>
                    <button
                      type="button"
                      className="ml-btn ml-btn-sm ml-btn-primary"
                      onClick={() => void openAttemptDetail(att.id)}
                    >
                      <Eye size={13} />
                      <span>View</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </article>
    )
  }

  return (
    <div className="marklist-page">
      <div className="marklist-container">
        {/* Page Header */}
        <header className="marklist-header">
          <div>
            <h1 className="marklist-title">
              <FileText size={30} />
              <span>
                Student <span className="gradient-text">Mark List</span>
              </span>
            </h1>
            <p className="marklist-subtitle">
              Real-time examination results, marks, accuracy, awards, and attempt history across MCQ Practice, Previous Year Papers, and Mock Tests
            </p>
          </div>
          <button
            type="button"
            className="ml-btn ml-btn-secondary"
            onClick={() => void fetchMarkList()}
            disabled={isLoading}
          >
            <RefreshCw size={15} className={isLoading ? 'ml-spin' : ''} />
            <span>Refresh Results</span>
          </button>
        </header>

        {/* Top Summary Statistics */}
        <section className="ml-summary-grid" aria-label="Overall examination summary">
          <div className="ml-summary-card glass">
            <div className="ml-summary-icon icon-purple">
              <Layers size={20} />
            </div>
            <div>
              <span className="ml-summary-label">Total Tests Completed</span>
              <strong className="ml-summary-value">{summary.totalTestsCompleted}</strong>
            </div>
          </div>

          <div className="ml-summary-card glass">
            <div className="ml-summary-icon icon-blue">
              <BookOpen size={20} />
            </div>
            <div>
              <span className="ml-summary-label">Questions Attempted</span>
              <strong className="ml-summary-value">{summary.totalQuestionsAttempted}</strong>
            </div>
          </div>

          <div className="ml-summary-card glass">
            <div className="ml-summary-icon icon-gold">
              <Trophy size={20} />
            </div>
            <div>
              <span className="ml-summary-label">Overall Marks</span>
              <strong className="ml-summary-value">
                {summary.overallMarksObtained} / {summary.overallMaxMarks}
              </strong>
            </div>
          </div>

          <div className="ml-summary-card glass">
            <div className="ml-summary-icon icon-green">
              <Target size={20} />
            </div>
            <div>
              <span className="ml-summary-label">Overall Accuracy</span>
              <strong className="ml-summary-value text-green">{summary.overallAccuracy}%</strong>
            </div>
          </div>

          <div className="ml-summary-card glass">
            <div className="ml-summary-icon icon-gold">
              <Award size={20} />
            </div>
            <div>
              <span className="ml-summary-label">Total Awards Earned</span>
              <strong className="ml-summary-value">{summary.totalAwardsEarned}</strong>
              <div className="ml-summary-awards-row" aria-label="Award breakdown">
                <span
                  className="ml-summary-award-item tier-gold"
                  title="Gold Award"
                  aria-label={`Gold Award: ${summary.goldCount}`}
                >
                  <AwardShieldLogo tier="GOLD" size={15} showLabel={false} />
                  <span>× {summary.goldCount}</span>
                </span>
                <span
                  className="ml-summary-award-item tier-platinum"
                  title="Platinum Award"
                  aria-label={`Platinum Award: ${summary.platinumCount}`}
                >
                  <AwardShieldLogo tier="PLATINUM" size={15} showLabel={false} />
                  <span>× {summary.platinumCount}</span>
                </span>
                <span
                  className="ml-summary-award-item tier-silver"
                  title="Silver Award"
                  aria-label={`Silver Award: ${summary.silverCount}`}
                >
                  <AwardShieldLogo tier="SILVER" size={15} showLabel={false} />
                  <span>× {summary.silverCount}</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Result Category Tabs */}
        <div className="ml-category-tabs glass" role="tablist" aria-label="Result categories">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'all'}
            className={`ml-cat-tab ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            All Results <span className="ml-tab-count">{counts.all}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'mcq_practice'}
            className={`ml-cat-tab ${activeCategory === 'mcq_practice' ? 'active' : ''}`}
            onClick={() => setActiveCategory('mcq_practice')}
          >
            MCQ Practice Results <span className="ml-tab-count">{counts.mcq_practice}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'previous_paper'}
            className={`ml-cat-tab ${activeCategory === 'previous_paper' ? 'active' : ''}`}
            onClick={() => setActiveCategory('previous_paper')}
          >
            Previous Papers Results <span className="ml-tab-count">{counts.previous_paper}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'mock_test'}
            className={`ml-cat-tab ${activeCategory === 'mock_test' ? 'active' : ''}`}
            onClick={() => setActiveCategory('mock_test')}
          >
            Mock Test Results <span className="ml-tab-count">{counts.mock_test}</span>
          </button>
        </div>

        {/* Result Filter Bar */}
        <section className="ml-filters-bar glass" aria-label="Filter results">
          <div className="ml-filters-title">
            <Filter size={15} />
            <span>Filter Results</span>
            {hasActiveFilters && (
              <button type="button" className="ml-reset-btn" onClick={resetFilters}>
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="ml-filters-grid">
            <select
              className="ml-filter-input"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              aria-label="Filter by TNPSC Group"
            >
              <option value="all">All TNPSC Groups</option>
              {availableFilters.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>

            <select
              className="ml-filter-input"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              aria-label="Filter by Subject"
            >
              <option value="all">All Subjects</option>
              {availableFilters.subjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>

            <select
              className="ml-filter-input"
              value={selectedStandard}
              onChange={(e) => setSelectedStandard(e.target.value)}
              aria-label="Filter by Standard"
            >
              <option value="all">All Standards</option>
              {availableFilters.standards.map((std) => (
                <option key={std} value={String(std)}>
                  {std}th Standard
                </option>
              ))}
            </select>

            <select
              className="ml-filter-input"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              aria-label="Filter by Unit"
            >
              <option value="all">All Units</option>
              {availableFilters.units.map((u) => (
                <option key={u} value={String(u)}>
                  {toRomanUnit(u)}
                </option>
              ))}
            </select>

            <input
              type="text"
              className="ml-filter-input"
              placeholder="Filter by Lesson..."
              value={selectedLesson}
              onChange={(e) => setSelectedLesson(e.target.value)}
              aria-label="Filter by Lesson"
            />

            <select
              className="ml-filter-input"
              value={selectedTestCategory}
              onChange={(e) => setSelectedTestCategory(e.target.value)}
              aria-label="Filter by Test Category"
            >
              <option value="all">All Test Categories</option>
              <option value="lesson_wise">Lesson-wise Test</option>
              <option value="unit_wise">Unit-wise Test</option>
              <option value="full_length">Full-length Mock Test</option>
            </select>

            <select
              className="ml-filter-input"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              aria-label="Filter by Examination Year"
            >
              <option value="all">All Exam Years</option>
              {availableFilters.years.map((yr) => (
                <option key={yr} value={String(yr)}>
                  {yr}
                </option>
              ))}
            </select>

            <input
              type="date"
              className="ml-filter-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="From date"
              title="From Date"
            />

            <input
              type="date"
              className="ml-filter-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="To date"
              title="To Date"
            />
          </div>
        </section>

        {/* Loading / Error State */}
        {errorMsg && (
          <div className="ml-error-banner glass">
            <XCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {isLoading ? (
          <div className="ml-loading-box glass">
            <Loader2 size={28} className="ml-spin" />
            <span>Loading your examination results...</span>
          </div>
        ) : (
          <div className="ml-sections-stack">
            {/* Section 1: MCQ Practice Results */}
            {(activeCategory === 'all' || activeCategory === 'mcq_practice') && (
              <section className="ml-results-section">
                <div className="ml-section-heading">
                  <h2>
                    <BookOpen size={20} />
                    <span>MCQ Practice Results</span>
                  </h2>
                  <span className="ml-section-badge">{mcqResults.length} Tests</span>
                </div>

                {mcqResults.length > 0 ? (
                  <div className="ml-cards-list">{mcqResults.map(renderResultCard)}</div>
                ) : (
                  <div className="ml-empty-box glass">
                    <p>No completed MCQ Practice results match your current filter.</p>
                  </div>
                )}
              </section>
            )}

            {/* Section 2: Previous Papers Results */}
            {(activeCategory === 'all' || activeCategory === 'previous_paper') && (
              <section className="ml-results-section">
                <div className="ml-section-heading">
                  <h2>
                    <FileText size={20} />
                    <span>Previous Papers Results</span>
                  </h2>
                  <span className="ml-section-badge">{pypResults.length} Papers</span>
                </div>

                {pypResults.length > 0 ? (
                  <div className="ml-cards-list">{pypResults.map(renderResultCard)}</div>
                ) : (
                  <div className="ml-empty-box glass">
                    <p>No completed Previous Year Paper results match your current filter.</p>
                  </div>
                )}
              </section>
            )}

            {/* Section 3: Mock Test Results */}
            {(activeCategory === 'all' || activeCategory === 'mock_test') && (
              <section className="ml-results-section">
                <div className="ml-section-heading">
                  <h2>
                    <GraduationCap size={20} />
                    <span>Mock Test Results</span>
                  </h2>
                  <span className="ml-section-badge">{mockResults.length} Tests</span>
                </div>

                {mockResults.length > 0 ? (
                  <div className="ml-cards-list">{mockResults.map(renderResultCard)}</div>
                ) : (
                  <div className="ml-empty-box glass">
                    <p>No completed Mock Test results match your current filter.</p>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      {/* Detailed Result Modal */}
      {detailModalOpen && (
        <div
          className="ml-modal-backdrop"
          onClick={() => setDetailModalOpen(false)}
          role="presentation"
        >
          <div
            className="ml-modal-card glass"
            role="dialog"
            aria-modal="true"
            aria-label="Detailed Test Result"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ml-modal-header">
              <div>
                <h2 className="ml-modal-title">
                  {selectedDetail?.testName || 'Examination Result Details'}
                </h2>
                {selectedDetail && (
                  <p className="ml-modal-sub">
                    {selectedDetail.groupLabel} · {selectedDetail.subjectLabel}
                    {selectedDetail.testCategoryLabel ? ` · ${selectedDetail.testCategoryLabel}` : ''}
                    {selectedDetail.examYear ? ` · ${selectedDetail.examYear}` : ''} · Attempt #{selectedDetail.attemptNumber} · {selectedDetail.date}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="ml-modal-close"
                onClick={() => setDetailModalOpen(false)}
                aria-label="Close result details"
              >
                <X size={18} />
              </button>
            </div>

            {detailLoading ? (
              <div className="ml-modal-loading">
                <Loader2 size={26} className="ml-spin" />
                <span>Loading detailed scorecard...</span>
              </div>
            ) : detailError ? (
              <div className="ml-error-banner">{detailError}</div>
            ) : selectedDetail ? (
              <div className="ml-modal-body">
                <div className="ml-detail-badges-row">
                  {renderAwardBadge(selectedDetail.awardType)}
                  {selectedDetail.rank !== null && selectedDetail.totalParticipants !== null && (
                    <span className="ml-rank-pill">
                      <Trophy size={14} />
                      <span>
                        Rank <strong>#{selectedDetail.rank}</strong> / {selectedDetail.totalParticipants}
                        {selectedDetail.percentile !== null ? ` (${selectedDetail.percentile}%ile)` : ''}
                      </span>
                    </span>
                  )}
                  <span className="ml-date-pill">
                    <Clock size={14} />
                    <span>Time Taken: {formatDuration(selectedDetail.timeSpentSeconds)}</span>
                  </span>
                </div>

                <div className="ml-detail-stats-grid">
                  <div className="ml-metric-box">
                    <span className="ml-metric-label">Total Questions</span>
                    <strong className="ml-metric-val">{selectedDetail.totalQuestions}</strong>
                  </div>
                  <div className="ml-metric-box metric-correct">
                    <span className="ml-metric-label">Correct</span>
                    <strong className="ml-metric-val">{selectedDetail.correctAnswers}</strong>
                  </div>
                  <div className="ml-metric-box metric-wrong">
                    <span className="ml-metric-label">Incorrect</span>
                    <strong className="ml-metric-val">{selectedDetail.incorrectAnswers}</strong>
                  </div>
                  <div className="ml-metric-box metric-unanswered">
                    <span className="ml-metric-label">Unanswered</span>
                    <strong className="ml-metric-val">{selectedDetail.unansweredQuestions}</strong>
                  </div>
                  <div className="ml-metric-box metric-marks">
                    <span className="ml-metric-label">Marks Obtained</span>
                    <strong className="ml-metric-val">
                      {selectedDetail.marksObtained} / {selectedDetail.maxMarks}
                    </strong>
                  </div>
                  <div className="ml-metric-box metric-pct">
                    <span className="ml-metric-label">Percentage</span>
                    <strong className="ml-metric-val">{selectedDetail.percentage}%</strong>
                  </div>
                  <div className="ml-metric-box metric-acc">
                    <span className="ml-metric-label">Accuracy</span>
                    <strong className="ml-metric-val">{selectedDetail.accuracyPercentage}%</strong>
                  </div>
                  {(selectedDetail.negativeMarks ?? 0) > 0 && (
                    <div className="ml-metric-box metric-wrong">
                      <span className="ml-metric-label">Negative Marks</span>
                      <strong className="ml-metric-val">-{selectedDetail.negativeMarks}</strong>
                    </div>
                  )}
                </div>

                {selectedDetail.questionResponses.length > 0 && (
                  <div className="ml-review-section">
                    <h3>Question-Level Review ({selectedDetail.questionResponses.length})</h3>
                    <div className="ml-review-list">
                      {selectedDetail.questionResponses.map((qr) => (
                        <div key={qr.index} className={`ml-review-item status-${qr.status}`}>
                          <div className="ml-review-top">
                            <span className="ml-review-qnum">Q{qr.index}</span>
                            <span className={`ml-review-status status-${qr.status}`}>
                              {qr.status === 'correct' && <CheckCircle2 size={14} />}
                              {qr.status === 'incorrect' && <XCircle size={14} />}
                              {qr.status === 'unanswered' && <MinusCircle size={14} />}
                              <span>
                                {qr.status === 'correct'
                                  ? 'Correct'
                                  : qr.status === 'incorrect'
                                    ? 'Incorrect'
                                    : 'Unanswered'}
                              </span>
                            </span>
                            <span className="ml-review-marks">
                              Marks: <strong>+{qr.marksAwarded}</strong>
                            </span>
                          </div>

                          <p className="ml-review-question">{qr.questionText}</p>

                          <div className="ml-review-answers">
                            <span>
                              Your Answer:{' '}
                              <strong>
                                {qr.selectedOption !== null && qr.options[qr.selectedOption]
                                  ? `${optionLetter(qr.selectedOption)}) ${qr.options[qr.selectedOption]}`
                                  : optionLetter(qr.selectedOption)}
                              </strong>
                            </span>
                            {qr.correctAnswer !== null && (
                              <span className="text-green">
                                Correct Answer:{' '}
                                <strong>
                                  {qr.options[qr.correctAnswer]
                                    ? `${optionLetter(qr.correctAnswer)}) ${qr.options[qr.correctAnswer]}`
                                    : optionLetter(qr.correctAnswer)}
                                </strong>
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export default MarkList
