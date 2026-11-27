import pool from '../db';
import { StudyManagementService } from './studyManagementService';
import { getGradeBoundaries, resolveGradeFromBoundaries, type GradeBoundary } from './gradeService';
import {
  computeAwardCountersFromRows,
  getAwardSettings,
  resolveAwardForPercentage,
  type AwardCounters,
  type AwardSettings,
} from './awardService';

export type ProgressMode = 'mcq_practice' | 'lesson_wise' | 'all';

export function calculateSafeProgress(completed: number, available: number): number {
  if (!Number.isFinite(available) || available <= 0) return 0;
  const safeCompleted = Math.max(0, Math.min(Number(completed) || 0, available));
  return Math.round((safeCompleted / available) * 100);
}

export interface LessonProgressSummary extends AwardCounters {
  lessonId: string;
  lessonNumber: string;
  lessonTitle: string;
  unitNumber: number;
  status: 'not_started' | 'in_progress' | 'completed';
  totalAttempts: number;
  firstAttemptScore: number | null;
  latestAttemptScore: number | null;
  bestAttemptScore: number | null;
  averageAttemptScore: number | null;
  improvementPercentage: number | null;
  bestGrade: string | null;
  bestGradeColor: string | null;
  latestGrade: string | null;
  lastPracticedAt: string | null;
  mcqCompleted: boolean;
  mockCompleted: boolean;
  isCompletedShared: boolean;
}

export interface UnitProgressSummary extends AwardCounters {
  unitNumber: number;
  unitCode: string;
  title: string;
  totalLessons: number;
  completedLessons: number;
  remainingLessons: number;
  completionPercentage: number;
  totalAttempts: number;
  unitTestAttempts: number;
  unitTestBestScore: number | null;
  unitTestBestGrade: string | null;
  unitTestLatestScore: number | null;
  unitTestAwards: AwardCounters;
}

export interface AttemptHistoryItem {
  id: number;
  attemptUuid: string | null;
  attemptNumber: number;
  attemptDate: string;
  totalQuestions: number;
  attemptedQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  gradeColor: string;
  awardType: string;
  timeSpentSeconds: number;
  assessmentType: string;
  mockTestFormat: string;
}

function normalizeGroupId(raw?: string): 'group1' | 'group2' | 'group4' {
  const g = String(raw || 'group1').toLowerCase().trim();
  if (g.includes('group2') || g === '2') return 'group2';
  if (g.includes('group4') || g.includes('vao') || g === '4') return 'group4';
  return 'group1';
}

function normalizeSubjectId(raw?: string): string {
  const s = String(raw || 'general-studies').toLowerCase().trim();
  if (s.includes('aptitude') || s.includes('mental')) return 'aptitude';
  if (s.includes('tamil')) return 'general-tamil';
  if (s.includes('english')) return 'general-english';
  if (s.includes('general') || s === 'gs') return 'general-studies';
  return s;
}

function groupCategoryCandidates(groupId: 'group1' | 'group2' | 'group4'): string[] {
  if (groupId === 'group2') return ['group2', 'group2a', 'group2_2a'];
  if (groupId === 'group4') return ['group4', 'vao', 'group4_vao'];
  return ['group1'];
}

function resolveModeForAttempt(row: any): 'mcq_practice' | 'lesson_wise' | 'unit_wise' | 'full_length' {
  const fmt = String(row.mock_test_format || '').toLowerCase();
  if (fmt === 'mcq_practice' || fmt === 'lesson_wise' || fmt === 'unit_wise' || fmt === 'full_length') {
    return fmt as any;
  }
  return String(row.assessment_type || '').toLowerCase() === 'mock_test' ? 'full_length' : 'mcq_practice';
}

function matchLessonRow(
  row: any,
  lesson: { id: string; title: string; unit_number?: number }
): boolean {
  if (row.lesson_id && String(row.lesson_id).trim() === String(lesson.id).trim()) {
    return true;
  }
  const rTitle = String(row.lesson_title || '').trim().toLowerCase();
  const lTitle = String(lesson.title || '').trim().toLowerCase();
  if (rTitle && lTitle && rTitle === lTitle) {
    return true;
  }
  return false;
}

function computeStatsFromAttempts(
  attempts: any[],
  boundaries: GradeBoundary[]
) {
  const awards = computeAwardCountersFromRows(attempts);
  if (attempts.length === 0) {
    return {
      totalAttempts: 0,
      firstAttemptScore: null,
      latestAttemptScore: null,
      bestAttemptScore: null,
      averageAttemptScore: null,
      improvementPercentage: null,
      bestGrade: null,
      bestGradeColor: null,
      latestGrade: null,
      lastPracticedAt: null,
      ...awards,
    };
  }

  const ordered = [...attempts].sort(
    (a, b) =>
      new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime() ||
      Number(a.attempt_number || 1) - Number(b.attempt_number || 1)
  );
  const percentages = ordered.map((a) => Number(a.percentage || 0));
  const first = percentages[0];
  const latest = percentages[percentages.length - 1];
  const best = Math.max(...percentages);
  const avg = Math.round((percentages.reduce((s, v) => s + v, 0) / percentages.length) * 10) / 10;
  const improvement = Math.round((latest - first) * 10) / 10;

  const bestResolved = resolveGradeFromBoundaries(best, boundaries);
  const latestResolved = resolveGradeFromBoundaries(latest, boundaries);

  return {
    totalAttempts: ordered.length,
    firstAttemptScore: first,
    latestAttemptScore: latest,
    bestAttemptScore: best,
    averageAttemptScore: avg,
    improvementPercentage: improvement,
    bestGrade: bestResolved.grade,
    bestGradeColor: bestResolved.colorHex,
    latestGrade: latestResolved.grade,
    lastPracticedAt: ordered[ordered.length - 1].completed_at
      ? new Date(ordered[ordered.length - 1].completed_at).toISOString()
      : null,
    ...awards,
  };
}

export async function getStudentSyllabusProgress(
  studentId: number,
  params: {
    groupId: string;
    subjectId: string;
    standardId: number;
    mode?: ProgressMode;
  }
): Promise<{
  groupId: string;
  subjectId: string;
  standardId: number;
  mode: ProgressMode;
  units: UnitProgressSummary[];
  lessons: LessonProgressSummary[];
  gradeBoundaries: GradeBoundary[];
  awardSettings: AwardSettings;
}> {
  const groupId = normalizeGroupId(params.groupId);
  const subjectId = normalizeSubjectId(params.subjectId);
  const standardId = Number(params.standardId) || 6;
  const mode: ProgressMode =
    params.mode === 'lesson_wise'
      ? 'lesson_wise'
      : params.mode === 'all'
        ? 'all'
        : 'mcq_practice';
  const catCandidates = groupCategoryCandidates(groupId);

  const [boundaries, awardSettings, dbUnits, dbLessons, attemptsRes] = await Promise.all([
    getGradeBoundaries(),
    getAwardSettings(),
    StudyManagementService.getUnits(groupId, subjectId, standardId),
    StudyManagementService.getLessons({ examId: groupId, subjectId, standardNumber: standardId }),
    pool.query(
      `SELECT id, attempt_number, total_questions, attempted_questions, correct_answers,
              incorrect_answers, unanswered_questions, score, max_score, percentage,
              grade, award_type, time_spent_seconds, assessment_type, mock_test_format,
              group_id, subject_id, standard_id, unit_id, lesson_id, lesson_title,
              completed_at
       FROM mock_test_attempts
       WHERE student_id = $1
         AND COALESCE(status, 'completed') = 'completed'
         AND attempted_questions > 0
         AND (
           LOWER(COALESCE(group_id, '')) = $2
           OR (group_id IS NULL AND LOWER(COALESCE(category, '')) = ANY($3::text[]))
         )
         AND (standard_id IS NULL OR standard_id = $4)
       ORDER BY completed_at ASC, id ASC`,
      [studentId, groupId, catCandidates, standardId]
    ),
  ]);

  const allAttempts = attemptsRes.rows.filter((r) => {
    const rSub = normalizeSubjectId(r.subject_id || r.subject || 'general-studies');
    return rSub === subjectId;
  });

  const unitIdToNumber = new Map<number, number>();
  for (const u of dbUnits) {
    unitIdToNumber.set(Number(u.id), Number(u.unit_number));
  }

  const lessonSummaries: LessonProgressSummary[] = dbLessons.map((lesson) => {
    const unitNum = Number((lesson as any).unit_number ?? unitIdToNumber.get(Number(lesson.unit_id)) ?? 1);
    const matchingAll = allAttempts.filter(
      (r) =>
        (r.unit_id == null || Number(r.unit_id) === unitNum) &&
        matchLessonRow(r, { id: String(lesson.id), title: lesson.title, unit_number: unitNum })
    );

    const mcqAttempts = matchingAll.filter((r) => resolveModeForAttempt(r) === 'mcq_practice');
    const mockLessonAttempts = matchingAll.filter((r) => resolveModeForAttempt(r) === 'lesson_wise');
    const combinedLessonAttempts = matchingAll.filter((r) => {
      const m = resolveModeForAttempt(r);
      return m === 'mcq_practice' || m === 'lesson_wise';
    });

    const activeAttempts =
      mode === 'lesson_wise'
        ? mockLessonAttempts
        : mode === 'all'
          ? combinedLessonAttempts
          : mcqAttempts;
    const stats = computeStatsFromAttempts(activeAttempts, boundaries);

    const mcqCompleted = mcqAttempts.length > 0;
    const mockCompleted = mockLessonAttempts.length > 0;
    const isCompletedShared = mcqCompleted || mockCompleted;
    const status: 'not_started' | 'in_progress' | 'completed' =
      stats.totalAttempts > 0 ? 'completed' : 'not_started';

    return {
      lessonId: String(lesson.id),
      lessonNumber: lesson.lesson_number || '',
      lessonTitle: lesson.title,
      unitNumber: unitNum,
      status,
      ...stats,
      mcqCompleted,
      mockCompleted,
      isCompletedShared,
    };
  });

  const unitSummaries: UnitProgressSummary[] = dbUnits.map((u) => {
    const uNum = Number(u.unit_number);
    const lessonsInUnit = lessonSummaries.filter((l) => l.unitNumber === uNum);
    const totalLessons = lessonsInUnit.length;
    const completedLessons = lessonsInUnit.filter((l) =>
      mode === 'lesson_wise'
        ? l.mockCompleted
        : mode === 'all'
          ? l.isCompletedShared
          : l.mcqCompleted
    ).length;
    const remainingLessons = Math.max(0, totalLessons - completedLessons);
    const completionPercentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 1000) / 10 : 0;

    const totalAttempts = lessonsInUnit.reduce((sum, l) => sum + l.totalAttempts, 0);
    const goldCount = lessonsInUnit.reduce((sum, l) => sum + l.goldCount, 0);
    const platinumCount = lessonsInUnit.reduce((sum, l) => sum + l.platinumCount, 0);
    const silverCount = lessonsInUnit.reduce((sum, l) => sum + l.silverCount, 0);
    const totalAwards = goldCount + platinumCount + silverCount;

    const unitTestAttempts = allAttempts.filter(
      (r) => resolveModeForAttempt(r) === 'unit_wise' && Number(r.unit_id) === uNum
    );
    const unitTestStats = computeStatsFromAttempts(unitTestAttempts, boundaries);
    const unitTestAwards = computeAwardCountersFromRows(unitTestAttempts);

    return {
      unitNumber: uNum,
      unitCode: u.unit_code || `Unit ${uNum}`,
      title: u.title,
      totalLessons,
      completedLessons,
      remainingLessons,
      completionPercentage,
      totalAttempts,
      goldCount,
      platinumCount,
      silverCount,
      totalAwards,
      unitTestAttempts: unitTestStats.totalAttempts,
      unitTestBestScore: unitTestStats.bestAttemptScore,
      unitTestBestGrade: unitTestStats.bestGrade,
      unitTestLatestScore: unitTestStats.latestAttemptScore,
      unitTestAwards,
    };
  });

  return {
    groupId,
    subjectId,
    standardId,
    mode,
    units: unitSummaries,
    lessons: lessonSummaries,
    gradeBoundaries: boundaries,
    awardSettings,
  };
}

export async function getLessonAttemptHistory(
  studentId: number,
  params: {
    groupId: string;
    subjectId: string;
    standardId: number;
    unitId: number;
    lessonId?: string;
    lessonTitle?: string;
    mode?: ProgressMode | 'all';
  }
) {
  const groupId = normalizeGroupId(params.groupId);
  const subjectId = normalizeSubjectId(params.subjectId);
  const standardId = Number(params.standardId) || 6;
  const unitId = Number(params.unitId) || 1;
  const mode = params.mode || 'all';
  const catCandidates = groupCategoryCandidates(groupId);

  const [boundaries, awardSettings, res] = await Promise.all([
    getGradeBoundaries(),
    getAwardSettings(),
    pool.query(
      `SELECT id, attempt_uuid, attempt_number, completed_at, total_questions,
              attempted_questions, correct_answers, incorrect_answers, unanswered_questions,
              score, max_score, percentage, grade, award_type, time_spent_seconds,
              assessment_type, mock_test_format, subject_id, subject, lesson_id, lesson_title
       FROM mock_test_attempts
       WHERE student_id = $1
         AND COALESCE(status, 'completed') = 'completed'
         AND attempted_questions > 0
         AND (
           LOWER(COALESCE(group_id, '')) = $2
           OR (group_id IS NULL AND LOWER(COALESCE(category, '')) = ANY($3::text[]))
         )
         AND (standard_id IS NULL OR standard_id = $4)
         AND (unit_id IS NULL OR unit_id = $5)
       ORDER BY completed_at ASC, id ASC`,
      [studentId, groupId, catCandidates, standardId, unitId]
    ),
  ]);

  const filtered = res.rows.filter((r) => {
    const rSub = normalizeSubjectId(r.subject_id || r.subject || 'general-studies');
    if (rSub !== subjectId) return false;

    const rMode = resolveModeForAttempt(r);
    if (mode !== 'all' && rMode !== mode) return false;

    const idMatch =
      params.lessonId && r.lesson_id && String(r.lesson_id).trim() === String(params.lessonId).trim();
    const titleMatch =
      params.lessonTitle &&
      r.lesson_title &&
      String(r.lesson_title).trim().toLowerCase() === String(params.lessonTitle).trim().toLowerCase();

    return Boolean(idMatch || titleMatch);
  });

  const stats = computeStatsFromAttempts(filtered, boundaries);
  const attempts: AttemptHistoryItem[] = filtered.map((r, idx) => {
    const pct = Number(r.percentage || 0);
    const resolved = resolveGradeFromBoundaries(pct, boundaries);
    return {
      id: Number(r.id),
      attemptUuid: r.attempt_uuid || null,
      attemptNumber: idx + 1,
      attemptDate: r.completed_at ? new Date(r.completed_at).toISOString() : new Date().toISOString(),
      totalQuestions: Number(r.total_questions || 0),
      attemptedQuestions: Number(r.attempted_questions || 0),
      correctAnswers: Number(r.correct_answers || 0),
      incorrectAnswers: Number(r.incorrect_answers || 0),
      unansweredQuestions: Number(r.unanswered_questions || 0),
      marksObtained: Number(r.score || 0),
      maxMarks: Number(r.max_score || 0),
      percentage: pct,
      grade: r.grade || resolved.grade,
      gradeColor: resolved.colorHex,
      awardType: r.award_type || resolveAwardForPercentage(pct, awardSettings),
      timeSpentSeconds: Number(r.time_spent_seconds || 0),
      assessmentType: String(r.assessment_type || 'mcq_practice'),
      mockTestFormat: resolveModeForAttempt(r),
    };
  });

  return {
    attempts,
    summary: {
      totalAttempts: stats.totalAttempts,
      firstAttemptScore: stats.firstAttemptScore,
      latestAttemptScore: stats.latestAttemptScore,
      bestAttemptScore: stats.bestAttemptScore,
      averageAttemptScore: stats.averageAttemptScore,
      improvementPercentage: stats.improvementPercentage,
      bestGrade: stats.bestGrade,
      bestGradeColor: stats.bestGradeColor,
      goldCount: stats.goldCount,
      platinumCount: stats.platinumCount,
      silverCount: stats.silverCount,
      totalAwards: stats.totalAwards,
    },
  };
}

export async function getMockTestProgressSummary(
  studentId: number,
  params?: { groupId?: string }
) {
  const [boundaries, awardSettings, res, inProgRes, publishedUnitTestsRes] = await Promise.all([
    getGradeBoundaries(),
    getAwardSettings(),
    pool.query(
      `SELECT id, test_id, test_title, category, group_id, assessment_type, mock_test_format,
              percentage, score, max_score, grade, award_type, time_spent_seconds, completed_at, attempt_number
       FROM mock_test_attempts
       WHERE student_id = $1
         AND status = 'completed'
         AND (
           COALESCE(assessment_type, '') = 'mock_test'
           OR COALESCE(mock_test_format, '') IN ('lesson_wise', 'unit_wise', 'full_length')
         )
       ORDER BY completed_at ASC, id ASC`,
      [studentId]
    ),
    pool.query(
      `SELECT DISTINCT mock_test_id
       FROM mock_test_sessions
       WHERE student_id = $1 AND status = 'in_progress'`,
      [studentId]
    ),
    pool.query(
      `SELECT mt.id, mt.category, mt.tnpsc_group, mt.subject, mt.standard, mt.unit
       FROM mock_tests mt
       INNER JOIN (
         SELECT mock_test_id, COUNT(*)::int AS cnt
         FROM mock_test_questions
         GROUP BY mock_test_id
       ) q_cnt ON q_cnt.mock_test_id = mt.id AND q_cnt.cnt > 0
       WHERE COALESCE(mt.test_category, 'full_length') = 'unit_wise'
         AND COALESCE(mt.approval_status, 'approved') = 'approved'
         AND (
           (mt.status = 'published' AND (mt.end_at IS NULL OR mt.end_at >= NOW()))
           OR (
             mt.status = 'scheduled'
             AND (mt.start_at IS NULL OR mt.start_at <= NOW())
             AND (mt.end_at IS NULL OR mt.end_at >= NOW())
           )
         )`
    ),
  ]);

  let rows = res.rows;
  let publishedUnitTests = publishedUnitTestsRes.rows;
  if (params?.groupId) {
    const g = normalizeGroupId(params.groupId);
    const cands = groupCategoryCandidates(g);
    rows = rows.filter(
      (r) =>
        String(r.group_id || '').toLowerCase() === g ||
        cands.includes(String(r.category || '').toLowerCase())
    );
    publishedUnitTests = publishedUnitTests.filter(
      (t) =>
        cands.includes(String(t.category || '').toLowerCase()) ||
        normalizeGroupId(t.tnpsc_group) === g
    );
  }

  // Distinct published Unit Wise test IDs that the student has completed (status = 'completed')
  const completedPublishedTestIds = new Set<string>(
    rows.map((r) => String(r.test_id || '').trim()).filter(Boolean)
  );

  // Per-unit backend progress summary keyed by `${subjectSlug}::${standardNum}::${unitNum}`
  const unitProgressMap: Record<
    string,
    { availableTests: number; completedTests: number; progressPercentage: number }
  > = {};
  for (const t of publishedUnitTests) {
    const subjSlug = normalizeSubjectId(t.subject);
    const stdMatch = String(t.standard || '').match(/\d+/);
    const unitMatch = String(t.unit || '').match(/\d+/);
    if (!stdMatch || !unitMatch) continue;
    const key = `${subjSlug}::${Number(stdMatch[0])}::${Number(unitMatch[0])}`;
    if (!unitProgressMap[key]) {
      unitProgressMap[key] = { availableTests: 0, completedTests: 0, progressPercentage: 0 };
    }
    unitProgressMap[key].availableTests += 1;
    if (completedPublishedTestIds.has(String(t.id))) {
      unitProgressMap[key].completedTests += 1;
    }
  }
  for (const key of Object.keys(unitProgressMap)) {
    const entry = unitProgressMap[key];
    entry.progressPercentage = calculateSafeProgress(entry.completedTests, entry.availableTests);
  }

  const fullLengthRows = rows.filter((r) => resolveModeForAttempt(r) === 'full_length');
  const fullLengthStats = computeStatsFromAttempts(fullLengthRows, boundaries);
  const completedFullTestIds = new Set(
    fullLengthRows.map((r) => String(r.test_id || r.test_title || ''))
  );

  const byTestId: Record<string, ReturnType<typeof computeStatsFromAttempts>> = {};
  const groupedByTest = new Map<string, any[]>();
  for (const r of fullLengthRows) {
    const key = String(r.test_id || '');
    if (!key) continue;
    if (!groupedByTest.has(key)) groupedByTest.set(key, []);
    groupedByTest.get(key)!.push(r);
  }
  for (const [k, list] of groupedByTest.entries()) {
    byTestId[k] = computeStatsFromAttempts(list, boundaries);
  }

  const unitWiseRows = rows.filter((r) => resolveModeForAttempt(r) === 'unit_wise');
  const unitWiseByTestId: Record<string, ReturnType<typeof computeStatsFromAttempts>> = {};
  const groupedUnitWise = new Map<string, any[]>();
  for (const r of unitWiseRows) {
    const key = String(r.test_id || '');
    if (!key) continue;
    if (!groupedUnitWise.has(key)) groupedUnitWise.set(key, []);
    groupedUnitWise.get(key)!.push(r);
  }
  for (const [k, list] of groupedUnitWise.entries()) {
    unitWiseByTestId[k] = computeStatsFromAttempts(list, boundaries);
  }

  const lessonWiseRows = rows.filter((r) => resolveModeForAttempt(r) === 'lesson_wise');
  const lessonWiseByTestId: Record<string, ReturnType<typeof computeStatsFromAttempts>> = {};
  const groupedLessonWise = new Map<string, any[]>();
  for (const r of lessonWiseRows) {
    const key = String(r.test_id || '');
    if (!key) continue;
    if (!groupedLessonWise.has(key)) groupedLessonWise.set(key, []);
    groupedLessonWise.get(key)!.push(r);
  }
  for (const [k, list] of groupedLessonWise.entries()) {
    lessonWiseByTestId[k] = computeStatsFromAttempts(list, boundaries);
  }

  const allByTestId: Record<string, ReturnType<typeof computeStatsFromAttempts>> = {};
  const groupedAll = new Map<string, any[]>();
  for (const r of rows) {
    const key = String(r.test_id || '');
    if (!key) continue;
    if (!groupedAll.has(key)) groupedAll.set(key, []);
    groupedAll.get(key)!.push(r);
  }
  for (const [k, list] of groupedAll.entries()) {
    allByTestId[k] = computeStatsFromAttempts(list, boundaries);
  }

  const inProgressTestIds = inProgRes.rows.map((r) => Number(r.mock_test_id)).filter(Boolean);
  const totalTimeSpentSeconds = rows.reduce((s, r) => s + Number(r.time_spent_seconds || 0), 0);

  return {
    totalMockTestsCompleted: completedFullTestIds.size,
    totalAttempts: fullLengthStats.totalAttempts,
    latestScore: fullLengthStats.latestAttemptScore,
    bestScore: fullLengthStats.bestAttemptScore,
    averageScore: fullLengthStats.averageAttemptScore,
    bestGrade: fullLengthStats.bestGrade,
    bestGradeColor: fullLengthStats.bestGradeColor,
    goldCount: fullLengthStats.goldCount,
    platinumCount: fullLengthStats.platinumCount,
    silverCount: fullLengthStats.silverCount,
    totalAwards: fullLengthStats.totalAwards,
    totalTimeSpentSeconds,
    byTestId,
    unitWiseByTestId,
    lessonWiseByTestId,
    allByTestId,
    unitProgressMap,
    inProgressTestIds,
    gradeBoundaries: boundaries,
    awardSettings,
  };
}

export async function getAdminSyllabusProgressOverview() {
  const [boundaries, awardSettings, lessonsCountRes, missingRes, attemptsAggRes, gradeDistRes, mockAggRes] =
    await Promise.all([
      getGradeBoundaries(),
      getAwardSettings(),
      pool.query(`SELECT COUNT(*)::int AS total_mapped_lessons FROM syllabus_lessons WHERE is_active = true`),
      pool.query(
        `SELECT u.exam_id, u.subject_id, u.unit_number, u.title,
                COUNT(l.id)::int AS lesson_count
         FROM syllabus_units u
         LEFT JOIN syllabus_lessons l ON l.unit_id = u.id AND l.is_active = true
         WHERE u.is_active = true
         GROUP BY u.id, u.exam_id, u.subject_id, u.unit_number, u.title
         HAVING COUNT(l.id) = 0
         ORDER BY u.exam_id, u.subject_id, u.unit_number`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total_attempts,
                COUNT(DISTINCT (student_id, COALESCE(lesson_id, lesson_title)))::int AS total_completed_lessons,
                COALESCE(AVG(percentage), 0)::numeric(5,1) AS avg_percentage,
                COUNT(*) FILTER (WHERE award_type = 'GOLD')::int AS gold_count,
                COUNT(*) FILTER (WHERE award_type = 'PLATINUM')::int AS platinum_count,
                COUNT(*) FILTER (WHERE award_type = 'SILVER')::int AS silver_count
         FROM mock_test_attempts
         WHERE COALESCE(status, 'completed') = 'completed'
           AND attempted_questions > 0`
      ),
      pool.query(
        `SELECT COALESCE(NULLIF(TRIM(grade), ''), 'Ungraded') AS grade_label,
                COUNT(*)::int AS count
         FROM mock_test_attempts
         WHERE COALESCE(status, 'completed') = 'completed'
           AND attempted_questions > 0
         GROUP BY 1
         ORDER BY count DESC`
      ),
      pool.query(
        `SELECT COALESCE(mock_test_format, 'full_length') AS format,
                COUNT(*)::int AS attempts_count,
                COALESCE(AVG(percentage), 0)::numeric(5,1) AS avg_percentage
         FROM mock_test_attempts
         WHERE COALESCE(status, 'completed') = 'completed'
           AND attempted_questions > 0
         GROUP BY 1
         ORDER BY attempts_count DESC`
      ),
    ]);

  return {
    totalMappedLessons: Number(lessonsCountRes.rows[0]?.total_mapped_lessons || 0),
    totalCompletedLessonsByStudents: Number(attemptsAggRes.rows[0]?.total_completed_lessons || 0),
    totalPracticeAttempts: Number(attemptsAggRes.rows[0]?.total_attempts || 0),
    overallAveragePercentage: Number(attemptsAggRes.rows[0]?.avg_percentage || 0),
    goldCount: Number(attemptsAggRes.rows[0]?.gold_count || 0),
    platinumCount: Number(attemptsAggRes.rows[0]?.platinum_count || 0),
    silverCount: Number(attemptsAggRes.rows[0]?.silver_count || 0),
    gradeDistribution: gradeDistRes.rows,
    formatBreakdown: mockAggRes.rows,
    missingSyllabusMappings: missingRes.rows,
    gradeBoundaries: boundaries,
    awardSettings,
  };
}
