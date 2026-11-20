import { randomUUID } from 'crypto';
import pool from '../db';
import { broadcastAnalyticsEvent } from './analyticsEventBus';
import { calculateSafePercentage, notifyStudentDashboardUpdate } from './studentDashboardService';
import { calculateGrade } from './gradeService';
import { calculateAttemptAward, getAwardSettings, resolveAwardForPercentage, AwardType } from './awardService';

export type AssessmentType =
  | 'mock_test'
  | 'lesson_quiz'
  | 'subject_drill'
  | 'study_material_quiz'
  | 'previous_paper';

export type MarkListCategory = 'mock_test' | 'lesson_quiz' | 'subject_practice';

export interface QuestionResponseInput {
  questionId?: number | string | null;
  questionText?: string;
  options?: string[];
  subject?: string;
  topic?: string;
  selectedOption: number | null;
  correctAnswer: number;
  isCorrect: boolean;
}

export interface SubmitAssessmentInput {
  testId?: string | null;
  testTitle: string;
  category?: string;
  subject?: string;
  assessmentType?: string;
  submissionToken?: string;
  totalQuestions: number;
  attemptedQuestions: number;
  correctAnswers: number;
  incorrectAnswers?: number;
  unansweredQuestions?: number;
  score?: number;
  maxScore?: number;
  timeSpentSeconds?: number;
  startedAt?: string;
  responses?: QuestionResponseInput[];
  groupId?: string;
  subjectId?: string;
  standardId?: number | null;
  unitId?: number | null;
  lessonId?: string | null;
  lessonTitle?: string | null;
  mockTestFormat?: 'mcq_practice' | 'lesson_wise' | 'unit_wise' | 'full_length';
}

export function normalizeTestKey(testId?: string | null, testTitle?: string): string {
  const cleanId = String(testId || '').trim().toLowerCase();
  if (cleanId) return cleanId.slice(0, 255);
  return String(testTitle || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 255) || 'assessment';
}

export function inferCanonicalSubject(rawSubject?: string, testTitle?: string): string {
  const combined = `${rawSubject || ''} ${testTitle || ''}`.toLowerCase();
  if (combined.includes('science') || combined.includes('physics') || combined.includes('chemistry') || combined.includes('biology')) {
    return 'General Science';
  }
  if (combined.includes('history') || combined.includes('heritage') || combined.includes('culture') || combined.includes('national movement')) {
    return 'History';
  }
  if (combined.includes('geography')) {
    return 'Geography';
  }
  if (combined.includes('polity') || combined.includes('constitution') || combined.includes('governance')) {
    return 'Polity';
  }
  if (combined.includes('aptitude') || combined.includes('mental ability') || combined.includes('math') || combined.includes('reasoning')) {
    return 'Aptitude & Mental Ability';
  }
  if (combined.includes('economy') || combined.includes('economic')) {
    return 'Economy';
  }
  if (combined.includes('tamil')) {
    return 'General Tamil';
  }
  const trimmed = String(rawSubject || '').trim();
  return trimmed || 'General Studies';
}

export function normalizeAssessmentType(rawType?: string, testTitle?: string): AssessmentType {
  const clean = String(rawType || '').trim().toLowerCase();
  if (clean === 'mock_test' || clean === 'mock') return 'mock_test';
  if (clean === 'lesson_quiz' || clean === 'lesson') return 'lesson_quiz';
  if (clean === 'subject_drill' || clean === 'subject_practice' || clean === 'drill') return 'subject_drill';
  if (clean === 'study_material_quiz' || clean === 'study_materials') return 'study_material_quiz';
  if (clean === 'previous_paper' || clean === 'previous_papers' || clean === 'pyq') return 'previous_paper';

  const titleLower = String(testTitle || '').toLowerCase();
  if (titleLower.includes('mock')) return 'mock_test';
  if (titleLower.includes('previous') || titleLower.includes('pyq')) return 'previous_paper';
  if (titleLower.includes('lesson')) return 'lesson_quiz';
  return 'mock_test';
}

export function mapAssessmentTypeToCategory(assessmentType: string): MarkListCategory {
  switch (assessmentType) {
    case 'lesson_quiz':
    case 'study_material_quiz':
      return 'lesson_quiz';
    case 'subject_drill':
    case 'previous_paper':
      return 'subject_practice';
    default:
      return 'mock_test';
  }
}

function buildPerformanceBreakdown(
  responses: QuestionResponseInput[],
  keyField: 'subject' | 'topic',
  fallbackLabel: string
) {
  const map = new Map<string, { name: string; total: number; correct: number; incorrect: number }>();

  for (const r of responses) {
    if (r.selectedOption === null || r.selectedOption === undefined || r.selectedOption < 0) {
      continue;
    }
    const label = String(r[keyField] || '').trim() || fallbackLabel;
    const entry = map.get(label) || { name: label, total: 0, correct: 0, incorrect: 0 };
    entry.total += 1;
    if (r.isCorrect) {
      entry.correct += 1;
    } else {
      entry.incorrect += 1;
    }
    map.set(label, entry);
  }

  return Array.from(map.values()).map((entry) => ({
    ...entry,
    accuracy: calculateSafePercentage(entry.correct, entry.total),
  }));
}

function formatScorecardRow(row: any) {
  const totalQ = Number(row.total_questions || 0);
  const attemptedQ = Number(row.attempted_questions || 0);
  const correctA = Number(row.correct_answers || 0);
  const incorrectA = Number(row.incorrect_answers || 0);
  const unansweredQ =
    row.unanswered_questions !== undefined && row.unanswered_questions !== null
      ? Number(row.unanswered_questions)
      : Math.max(0, totalQ - attemptedQ);
  const marksObtained = parseFloat(row.score ?? 0);
  const maxMarks = parseFloat(row.max_score ?? totalQ);
  const percentage = Math.round(parseFloat(row.percentage ?? 0) * 10) / 10;
  const assessmentType = row.assessment_type || 'mock_test';
  const category = mapAssessmentTypeToCategory(assessmentType);
  const status: 'excellent' | 'passed' | 'needs_practice' =
    percentage >= 80 ? 'excellent' : percentage >= 50 ? 'passed' : 'needs_practice';

  const groupTag = String(row.category || 'TNPSC').toUpperCase().replace(/_/g, ' ');
  const completedAt = row.completed_at ? new Date(row.completed_at).toISOString() : new Date().toISOString();
  const dateFormatted = new Date(completedAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return {
    id: row.id,
    testId: row.test_id || null,
    testName: row.test_title,
    assessmentType,
    category,
    groupTag,
    totalQuestions: totalQ,
    attemptedQuestions: attemptedQ,
    correctAnswers: correctA,
    incorrectAnswers: incorrectA,
    unansweredQuestions: unansweredQ,
    marksObtained,
    maxMarks,
    percentage,
    timeSpentSeconds: Number(row.time_spent_seconds || 0),
    date: dateFormatted,
    completedAt,
    status,
  };
}

export async function submitAssessmentAttempt(studentId: number, input: SubmitAssessmentInput) {
  const cleanTitle = String(input.testTitle || '').trim();
  if (!cleanTitle) {
    throw new Error('Test title is required.');
  }

  const tTotal = Math.max(1, Number(input.totalQuestions) || 1);
  const tAttempted = Math.max(0, Number(input.attemptedQuestions) || 0);
  if (tAttempted <= 0) {
    return {
      ignored: true,
      attemptId: 0,
      percentage: 0,
      message: 'Abandoned assessment with zero answered questions was not recorded.',
    };
  }

  const tCorrect = Math.max(0, Math.min(tAttempted, Number(input.correctAnswers) || 0));
  const tIncorrect =
    input.incorrectAnswers !== undefined
      ? Math.max(0, Number(input.incorrectAnswers))
      : Math.max(0, tAttempted - tCorrect);
  const tUnanswered =
    input.unansweredQuestions !== undefined
      ? Math.max(0, Number(input.unansweredQuestions))
      : Math.max(0, tTotal - tAttempted);
  const tScore = input.score !== undefined ? Number(input.score) : tCorrect;
  const tMaxScore = input.maxScore !== undefined && Number(input.maxScore) > 0 ? Number(input.maxScore) : tTotal;
  const percentage = tMaxScore > 0 ? Math.round((tScore / tMaxScore) * 1000) / 10 : 0;
  const tTime = Math.max(0, Math.floor(Number(input.timeSpentSeconds) || 0));
  const assessmentType = normalizeAssessmentType(input.assessmentType, cleanTitle);
  const cleanSubmissionToken =
    input.submissionToken && typeof input.submissionToken === 'string' && input.submissionToken.trim()
      ? input.submissionToken.trim().slice(0, 120)
      : null;

  const responses = Array.isArray(input.responses) ? input.responses.slice(0, 300) : [];
  const subjectBreakdown = buildPerformanceBreakdown(responses, 'subject', 'General Studies');
  const topicBreakdown = buildPerformanceBreakdown(responses, 'topic', cleanTitle);
  const testKey = normalizeTestKey(input.testId, cleanTitle);
  const resolvedSubject = inferCanonicalSubject(input.subject || subjectBreakdown[0]?.name, cleanTitle);
  const startedAtDate = input.startedAt ? new Date(input.startedAt) : new Date(Date.now() - tTime * 1000);
  const cleanStartedAt = Number.isNaN(startedAtDate.getTime()) ? new Date() : startedAtDate;
  const gradeResult = await calculateGrade(percentage);
  const awardResult = await calculateAttemptAward(percentage);
  const attemptUuid = randomUUID();

  const rawGroup = String(input.groupId || input.category || 'group1').toLowerCase().trim();
  const normGroupId =
    rawGroup.includes('group2') || rawGroup === '2'
      ? 'group2'
      : rawGroup.includes('group4') || rawGroup.includes('vao') || rawGroup === '4'
        ? 'group4'
        : 'group1';
  const normSubjectId = input.subjectId ? String(input.subjectId).trim().toLowerCase() : null;
  const normStandardId = input.standardId != null && !Number.isNaN(Number(input.standardId)) ? Number(input.standardId) : null;
  const normUnitId = input.unitId != null && !Number.isNaN(Number(input.unitId)) ? Number(input.unitId) : null;
  const normLessonId = input.lessonId ? String(input.lessonId).trim() : null;
  const normLessonTitle = input.lessonTitle ? String(input.lessonTitle).trim() : null;
  const normFormat = input.mockTestFormat || (assessmentType === 'mock_test' ? 'full_length' : 'mcq_practice');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (cleanSubmissionToken) {
      const existing = await client.query(
        `SELECT id, percentage, attempt_number, award_type FROM mock_test_attempts WHERE student_id = $1 AND submission_token = $2`,
        [studentId, cleanSubmissionToken]
      );
      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return {
          duplicate: true,
          attemptId: existing.rows[0].id,
          attemptNumber: existing.rows[0].attempt_number || 1,
          percentage: parseFloat(existing.rows[0].percentage || '0'),
          awardType: existing.rows[0].award_type || awardResult.awardType,
          message: 'Assessment submission already recorded.',
        };
      }
    }

    const attemptSeqRes = await client.query(
      `SELECT COALESCE(MAX(attempt_number), 0)::int + 1 AS next_attempt
       FROM mock_test_attempts
       WHERE student_id = $1
         AND COALESCE(NULLIF(TRIM(test_key), ''), COALESCE(NULLIF(TRIM(test_id), ''), LOWER(TRIM(test_title)))) = $2
         AND COALESCE(status, 'completed') = 'completed'`,
      [studentId, testKey]
    );
    const attemptNumber = Number(attemptSeqRes.rows[0]?.next_attempt || 1);

    const insertRes = await client.query(
      `INSERT INTO mock_test_attempts (
         student_id, test_id, test_key, test_title, category, subject, assessment_type, submission_token,
         attempt_number, total_questions, attempted_questions, correct_answers, incorrect_answers, unanswered_questions,
         score, max_score, percentage, time_spent_seconds, status,
         subject_breakdown, topic_breakdown, question_responses, started_at, completed_at,
         group_id, subject_id, standard_id, unit_id, lesson_id, lesson_title, mock_test_format, grade, attempt_uuid,
         award_type, award_threshold_snapshot
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'completed',
         $19::jsonb, $20::jsonb, $21::jsonb, $22, CURRENT_TIMESTAMP,
         $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33::jsonb
       )
       RETURNING id`,
      [
        studentId,
        input.testId ? String(input.testId) : null,
        testKey,
        cleanTitle,
        input.category || 'group1',
        resolvedSubject,
        assessmentType,
        cleanSubmissionToken,
        attemptNumber,
        tTotal,
        tAttempted,
        tCorrect,
        tIncorrect,
        tUnanswered,
        tScore,
        tMaxScore,
        percentage,
        tTime,
        JSON.stringify(subjectBreakdown),
        JSON.stringify(topicBreakdown),
        JSON.stringify(responses),
        cleanStartedAt,
        normGroupId,
        normSubjectId,
        normStandardId,
        normUnitId,
        normLessonId,
        normLessonTitle,
        normFormat,
        gradeResult.grade,
        attemptUuid,
        awardResult.awardType,
        JSON.stringify(awardResult.snapshot),
      ]
    );

    await client.query(
      `INSERT INTO daily_streaks (student_id, activity_date, mock_tests_count)
       VALUES ($1, timezone('Asia/Kolkata', CURRENT_TIMESTAMP)::date, 1)
       ON CONFLICT (student_id, activity_date)
       DO UPDATE SET mock_tests_count = daily_streaks.mock_tests_count + 1`,
      [studentId]
    );

    await client.query(
      `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        studentId,
        assessmentType === 'mock_test' ? 'mock_test' : 'assessment',
        String(insertRes.rows[0].id),
        cleanTitle,
        JSON.stringify({
          category: input.category || 'group1',
          assessmentType,
          totalQuestions: tTotal,
          score: tScore,
          maxScore: tMaxScore,
          percentage,
        }),
      ]
    );

    await client.query('COMMIT');
    notifyStudentDashboardUpdate(studentId);
    broadcastAnalyticsEvent('assessment_submitted', { assessmentType });

    return {
      duplicate: false,
      attemptId: insertRes.rows[0].id,
      attemptNumber,
      attemptUuid,
      percentage,
      grade: gradeResult.grade,
      gradeColor: gradeResult.colorHex,
      awardType: awardResult.awardType,
      message: 'Assessment submission recorded successfully.',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export interface MarkListFilters {
  type?: string;
  category?: string;
  testCategory?: string;
  group?: string;
  subject?: string;
  standard?: number | string;
  unit?: number | string;
  lesson?: string;
  year?: number | string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

type MarkListResultCategory = 'mcq_practice' | 'previous_paper' | 'mock_test';
type MockTestSubCategory = 'lesson_wise' | 'unit_wise' | 'full_length';

function resolveMarkListResultCategory(row: {
  assessment_type?: string | null;
  mock_test_format?: string | null;
}): MarkListResultCategory {
  const aType = String(row.assessment_type || '').toLowerCase().trim();
  const fmt = String(row.mock_test_format || '').toLowerCase().trim();
  if (aType === 'previous_paper') return 'previous_paper';
  if (
    aType === 'mock_test' ||
    fmt === 'lesson_wise' ||
    fmt === 'unit_wise' ||
    fmt === 'full_length'
  ) {
    return 'mock_test';
  }
  return 'mcq_practice';
}

function resolveMockTestSubCategory(row: {
  mock_test_format?: string | null;
  mt_test_category?: string | null;
}): MockTestSubCategory {
  const raw = String(row.mock_test_format || row.mt_test_category || '').toLowerCase().trim();
  if (raw === 'lesson_wise' || raw === 'lesson-wise') return 'lesson_wise';
  if (raw === 'unit_wise' || raw === 'unit-wise') return 'unit_wise';
  return 'full_length';
}

function formatMockTestSubCategoryLabel(sub: MockTestSubCategory): string {
  if (sub === 'lesson_wise') return 'Lesson-wise Test';
  if (sub === 'unit_wise') return 'Unit-wise Test';
  return 'Full-length Mock Test';
}

function parseLeadingInt(val?: string | number | null): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number' && Number.isFinite(val)) return Math.trunc(val);
  const m = String(val).match(/\d+/);
  return m ? Number(m[0]) : null;
}

function formatGroupLabel(rawGroup?: string | null, rawCategory?: string | null): { id: string; label: string } {
  const combined = `${rawGroup || ''} ${rawCategory || ''}`.toLowerCase();
  if (combined.includes('group2') || combined.includes('2a') || combined.includes('group 2')) {
    return { id: 'group2', label: 'TNPSC Group 2 & 2A' };
  }
  if (combined.includes('group4') || combined.includes('vao') || combined.includes('group 4')) {
    return { id: 'group4', label: 'TNPSC Group 4' };
  }
  return { id: 'group1', label: 'TNPSC Group 1' };
}

function formatSubjectLabel(rawSubjectId?: string | null, rawSubject?: string | null): string {
  const slug = String(rawSubjectId || '').toLowerCase().trim();
  if (slug === 'general-studies') return 'General Studies';
  if (slug === 'aptitude') return 'Aptitude & Mental Ability';
  if (slug === 'general-tamil') return 'General Tamil';
  if (slug === 'general-english') return 'General English';
  const s = String(rawSubject || '').trim();
  return s || 'General Studies';
}

function extractExamYear(title?: string | null, joinedYear?: number | string | null): number | null {
  if (joinedYear != null && !Number.isNaN(Number(joinedYear)) && Number(joinedYear) > 1900) {
    return Number(joinedYear);
  }
  const m = String(title || '').match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

async function computeRankMapForTestKeys(
  studentId: number,
  testKeys: string[]
): Promise<Map<string, { rank: number; totalParticipants: number; percentile: number }>> {
  const rankMap = new Map<string, { rank: number; totalParticipants: number; percentile: number }>();
  const uniqueKeys = Array.from(new Set(testKeys.filter(Boolean)));
  if (uniqueKeys.length === 0) return rankMap;

  try {
    const res = await pool.query(
      `WITH student_best AS (
         SELECT
           COALESCE(NULLIF(TRIM(test_key), ''), COALESCE(NULLIF(TRIM(test_id), ''), LOWER(TRIM(test_title)))) AS resolved_key,
           student_id,
           MAX(percentage) AS best_pct,
           MAX(score) AS best_score,
           MIN(time_spent_seconds) AS best_time
         FROM mock_test_attempts
         WHERE COALESCE(status, 'completed') = 'completed'
           AND attempted_questions > 0
           AND COALESCE(NULLIF(TRIM(test_key), ''), COALESCE(NULLIF(TRIM(test_id), ''), LOWER(TRIM(test_title)))) = ANY($1::text[])
         GROUP BY 1, 2
       ),
       ranked AS (
         SELECT
           resolved_key,
           student_id,
           DENSE_RANK() OVER (
             PARTITION BY resolved_key
             ORDER BY best_pct DESC, best_score DESC, best_time ASC
           )::int AS rank_pos,
           COUNT(*) OVER (PARTITION BY resolved_key)::int AS total_participants
         FROM student_best
       )
       SELECT resolved_key, rank_pos, total_participants
       FROM ranked
       WHERE student_id = $2`,
      [uniqueKeys, studentId]
    );

    for (const r of res.rows) {
      const total = Number(r.total_participants || 0);
      const pos = Number(r.rank_pos || 0);
      if (total > 0 && pos > 0) {
        const percentile =
          total === 1
            ? 100
            : Math.max(0, Math.min(100, Math.round(((total - pos) / (total - 1)) * 1000) / 10));
        rankMap.set(String(r.resolved_key), {
          rank: pos,
          totalParticipants: total,
          percentile,
        });
      }
    }
  } catch (err) {
    console.error('[MarkList Rank Calculation Notice]:', err);
  }

  return rankMap;
}

export async function getStudentMarkList(studentId: number, filters: MarkListFilters = {}) {
  const filterCategory = String(filters.category || filters.type || 'all').trim().toLowerCase();
  const filterTestCategory = String(filters.testCategory || 'all').trim().toLowerCase();
  const filterGroup = String(filters.group || 'all').trim().toLowerCase();
  const filterSubject = String(filters.subject || 'all').trim().toLowerCase();
  const filterStandard =
    filters.standard !== undefined && filters.standard !== '' && filters.standard !== 'all'
      ? Number(filters.standard)
      : null;
  const filterUnit =
    filters.unit !== undefined && filters.unit !== '' && filters.unit !== 'all'
      ? Number(filters.unit)
      : null;
  const filterLesson = String(filters.lesson || '').trim().toLowerCase();
  const filterYear =
    filters.year !== undefined && filters.year !== '' && filters.year !== 'all'
      ? Number(filters.year)
      : null;

  const awardSettings = await getAwardSettings();

  const rowsRes = await pool.query(
    `SELECT
       a.id,
       a.attempt_uuid,
       a.test_id,
       COALESCE(NULLIF(TRIM(a.test_key), ''), COALESCE(NULLIF(TRIM(a.test_id), ''), LOWER(TRIM(a.test_title)))) AS resolved_test_key,
       a.test_title,
       a.category,
       a.subject,
       a.assessment_type,
       a.attempt_number,
       a.total_questions,
       a.attempted_questions,
       a.correct_answers,
       a.incorrect_answers,
       a.unanswered_questions,
       a.score,
       a.max_score,
       a.percentage,
       a.time_spent_seconds,
       a.started_at,
       a.completed_at,
       a.group_id,
       a.subject_id,
       a.standard_id,
       a.unit_id,
       a.lesson_id,
       a.lesson_title,
       a.mock_test_format,
       a.grade,
       a.award_type,
       p.year AS pyp_year,
       p.exam AS pyp_exam,
       p.subjects AS pyp_subjects,
       mt.test_category AS mt_test_category,
       mt.tnpsc_group AS mt_tnpsc_group,
       mt.subject AS mt_subject,
       mt.standard AS mt_standard,
       mt.unit AS mt_unit,
       mt.lesson AS mt_lesson,
       mt.negative_marking AS mt_negative_marking
     FROM mock_test_attempts a
     LEFT JOIN previous_year_papers p
       ON a.test_id = ('pyp-' || p.id::text)
     LEFT JOIN mock_tests mt
       ON a.test_id IS NOT NULL AND (mt.id::text = a.test_id OR mt.slug = a.test_id)
     WHERE a.student_id = $1
       AND COALESCE(a.status, 'completed') = 'completed'
       AND a.attempted_questions > 0
       AND (
         a.assessment_type IN ('lesson_quiz', 'study_material_quiz', 'subject_drill', 'previous_paper', 'mock_test')
         OR COALESCE(a.mock_test_format, '') IN ('mcq_practice', 'lesson_wise', 'unit_wise', 'full_length')
       )
     ORDER BY a.completed_at DESC, a.id DESC`,
    [studentId]
  );

  const allTestKeys = rowsRes.rows.map((r) => String(r.resolved_test_key || ''));
  const rankMap = await computeRankMapForTestKeys(studentId, allTestKeys);

  const normalizedAttempts = rowsRes.rows.map((row) => {
    const resultCategory = resolveMarkListResultCategory(row);
    const isPreviousPaper = resultCategory === 'previous_paper';
    const isMockTest = resultCategory === 'mock_test';
    const testCategory: MockTestSubCategory | null = isMockTest ? resolveMockTestSubCategory(row) : null;
    const testCategoryLabel: string | null = testCategory ? formatMockTestSubCategoryLabel(testCategory) : null;

    const groupInfo = formatGroupLabel(row.group_id || row.mt_tnpsc_group, row.category);
    const subjectLabel = isPreviousPaper
      ? String(row.pyp_subjects || row.subject || 'Previous Year Paper').trim()
      : formatSubjectLabel(row.subject_id, row.subject || row.mt_subject);
    const totalQ = Number(row.total_questions || 0);
    const attemptedQ = Number(row.attempted_questions || 0);
    const correctA = Number(row.correct_answers || 0);
    const incorrectA = Number(row.incorrect_answers || 0);
    const unansweredQ =
      row.unanswered_questions !== undefined && row.unanswered_questions !== null
        ? Number(row.unanswered_questions)
        : Math.max(0, totalQ - attemptedQ);
    const marksObtained = Math.round(parseFloat(row.score ?? 0) * 100) / 100;
    const maxMarks = Math.round(parseFloat(row.max_score ?? totalQ) * 100) / 100;
    const percentage =
      maxMarks > 0 ? Math.round((marksObtained / maxMarks) * 1000) / 10 : Math.round(parseFloat(row.percentage ?? 0) * 10) / 10;
    const accuracy = calculateSafePercentage(correctA, attemptedQ);
    const configuredNegPerWrong = isMockTest && row.mt_negative_marking != null ? Number(row.mt_negative_marking) : 0;
    const expectedPositiveMarks = maxMarks > 0 && totalQ > 0 ? (correctA * maxMarks) / totalQ : correctA;
    const negativeMarks =
      configuredNegPerWrong > 0 && incorrectA > 0
        ? Math.round(incorrectA * configuredNegPerWrong * 100) / 100
        : expectedPositiveMarks > marksObtained
          ? Math.round((expectedPositiveMarks - marksObtained) * 100) / 100
          : 0;

    const storedAward = String(row.award_type || '').toUpperCase().trim();
    const awardType: AwardType =
      storedAward === 'GOLD' || storedAward === 'PLATINUM' || storedAward === 'SILVER' || storedAward === 'NONE'
        ? (storedAward as AwardType)
        : resolveAwardForPercentage(percentage, awardSettings);

    const completedAt = row.completed_at ? new Date(row.completed_at).toISOString() : new Date().toISOString();
    const dateFormatted = new Date(completedAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const dateIsoIst = new Date(completedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const testKey = String(row.resolved_test_key || '');
    const rankInfo = rankMap.get(testKey) || null;
    const examYear = isPreviousPaper ? extractExamYear(row.test_title, row.pyp_year) : null;
    const resolvedStandardId =
      row.standard_id != null ? Number(row.standard_id) : parseLeadingInt(row.mt_standard);
    const resolvedUnitId =
      row.unit_id != null ? Number(row.unit_id) : parseLeadingInt(row.mt_unit);
    const resolvedLessonTitle = isPreviousPaper
      ? null
      : isMockTest
        ? row.lesson_title || row.mt_lesson || null
        : row.lesson_title || String(row.test_title || '');

    return {
      id: Number(row.id),
      attemptUuid: row.attempt_uuid || null,
      testId: row.test_id || null,
      testKey,
      testTitle: String(row.test_title || row.lesson_title || 'Assessment'),
      resultCategory,
      testCategory,
      testCategoryLabel,
      assessmentType: String(row.assessment_type || (isMockTest ? 'mock_test' : 'lesson_quiz')),
      groupId: groupInfo.id,
      groupLabel: groupInfo.label,
      subjectId: row.subject_id || null,
      subjectLabel,
      standardId: resolvedStandardId,
      unitId: resolvedUnitId,
      lessonId: row.lesson_id || null,
      lessonTitle: resolvedLessonTitle,
      examName: isPreviousPaper ? String(row.pyp_exam || groupInfo.label) : null,
      examYear,
      attemptNumber: Number(row.attempt_number || 1),
      totalQuestions: totalQ,
      attemptedQuestions: attemptedQ,
      correctAnswers: correctA,
      incorrectAnswers: incorrectA,
      unansweredQuestions: unansweredQ,
      marksObtained,
      maxMarks,
      negativeMarks,
      percentage,
      accuracy,
      awardType,
      grade: row.grade || null,
      rank: rankInfo?.rank ?? null,
      totalParticipants: rankInfo?.totalParticipants ?? null,
      percentile: rankInfo?.percentile ?? null,
      timeSpentSeconds: Number(row.time_spent_seconds || 0),
      date: dateFormatted,
      dateIsoIst,
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
      completedAt,
    };
  });

  // Collect available filter options from all student attempts (never hardcoded)
  const availableGroups = Array.from(new Map(normalizedAttempts.map((a) => [a.groupId, a.groupLabel])).entries()).map(
    ([id, label]) => ({ id, label })
  );
  const availableSubjects = Array.from(
    new Set(
      normalizedAttempts
        .filter((a) => a.resultCategory === 'mcq_practice' || a.resultCategory === 'mock_test')
        .map((a) => a.subjectLabel)
    )
  ).sort();
  const availableStandards = Array.from(
    new Set(normalizedAttempts.map((a) => a.standardId).filter((s): s is number => s !== null))
  ).sort((a, b) => a - b);
  const availableUnits = Array.from(
    new Set(normalizedAttempts.map((a) => a.unitId).filter((u): u is number => u !== null))
  ).sort((a, b) => a - b);
  const availableLessons = Array.from(
    new Set(normalizedAttempts.map((a) => a.lessonTitle).filter((l): l is string => Boolean(l)))
  ).sort();
  const availableYears = Array.from(
    new Set(normalizedAttempts.map((a) => a.examYear).filter((y): y is number => y !== null))
  ).sort((a, b) => b - a);
  const availableTestCategories = Array.from(
    new Map(
      normalizedAttempts
        .filter((a) => a.resultCategory === 'mock_test' && a.testCategory && a.testCategoryLabel)
        .map((a) => [a.testCategory as string, a.testCategoryLabel as string])
    ).entries()
  ).map(([id, label]) => ({ id, label }));

  // Apply active filters
  const filteredAttempts = normalizedAttempts.filter((item) => {
    if (filterCategory === 'mcq_practice' && item.resultCategory !== 'mcq_practice') return false;
    if (filterCategory === 'previous_paper' && item.resultCategory !== 'previous_paper') return false;
    if (filterCategory === 'mock_test' && item.resultCategory !== 'mock_test') return false;
    if (filterTestCategory !== 'all') {
      if (item.resultCategory !== 'mock_test' || item.testCategory !== filterTestCategory) return false;
    }
    if (filterGroup !== 'all' && item.groupId !== filterGroup) return false;
    if (filterSubject !== 'all' && item.subjectLabel.toLowerCase() !== filterSubject && String(item.subjectId || '').toLowerCase() !== filterSubject) {
      return false;
    }
    if (filterStandard !== null && !Number.isNaN(filterStandard) && item.standardId !== filterStandard) return false;
    if (filterUnit !== null && !Number.isNaN(filterUnit) && item.unitId !== filterUnit) return false;
    if (filterLesson && !String(item.lessonTitle || item.testTitle).toLowerCase().includes(filterLesson)) return false;
    if (filterYear !== null && !Number.isNaN(filterYear) && item.examYear !== filterYear) return false;
    if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from) && item.dateIsoIst < filters.from) return false;
    if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to) && item.dateIsoIst > filters.to) return false;
    return true;
  });

  // Group attempts by comparable testKey so each test shows Latest Attempt, Best Attempt, and full Attempt History
  const groupByTest = (items: typeof filteredAttempts) => {
    const map = new Map<string, typeof filteredAttempts>();
    for (const it of items) {
      const key = `${it.resultCategory}::${it.testKey}`;
      const list = map.get(key) || [];
      list.push(it);
      map.set(key, list);
    }

    return Array.from(map.values()).map((attempts) => {
      // attempts are already sorted newest-first (completed_at DESC)
      const latestAttempt = attempts[0];
      const firstAttempt = attempts[attempts.length - 1];
      let bestAttempt = attempts[0];
      for (const a of attempts) {
        if (
          a.percentage > bestAttempt.percentage ||
          (a.percentage === bestAttempt.percentage && a.marksObtained > bestAttempt.marksObtained)
        ) {
          bestAttempt = a;
        }
      }
      return {
        testKey: latestAttempt.testKey,
        testId: latestAttempt.testId,
        testTitle: latestAttempt.testTitle,
        resultCategory: latestAttempt.resultCategory,
        testCategory: latestAttempt.testCategory,
        testCategoryLabel: latestAttempt.testCategoryLabel,
        groupId: latestAttempt.groupId,
        groupLabel: latestAttempt.groupLabel,
        subjectId: latestAttempt.subjectId,
        subjectLabel: latestAttempt.subjectLabel,
        standardId: latestAttempt.standardId,
        unitId: latestAttempt.unitId,
        lessonId: latestAttempt.lessonId,
        lessonTitle: latestAttempt.lessonTitle,
        examName: latestAttempt.examName,
        examYear: latestAttempt.examYear,
        totalAttempts: attempts.length,
        firstAttemptDate: firstAttempt.date,
        latestAttempt,
        bestAttempt,
        rank: latestAttempt.rank,
        totalParticipants: latestAttempt.totalParticipants,
        percentile: latestAttempt.percentile,
        attempts,
      };
    });
  };

  const mcqAttempts = filteredAttempts.filter((a) => a.resultCategory === 'mcq_practice');
  const previousPaperAttempts = filteredAttempts.filter((a) => a.resultCategory === 'previous_paper');
  const mockTestAttempts = filteredAttempts.filter((a) => a.resultCategory === 'mock_test');

  const mcqPracticeResults = groupByTest(mcqAttempts);
  const previousPaperResults = groupByTest(previousPaperAttempts);
  const mockTestResults = groupByTest(mockTestAttempts);

  // Summary statistics across the student's filtered completed results
  let totalQuestionsAttempted = 0;
  let totalCorrect = 0;
  let overallMarksObtained = 0;
  let overallMaxMarks = 0;
  let goldCount = 0;
  let platinumCount = 0;
  let silverCount = 0;

  for (const a of filteredAttempts) {
    totalQuestionsAttempted += a.attemptedQuestions;
    totalCorrect += a.correctAnswers;
    overallMarksObtained += a.marksObtained;
    overallMaxMarks += a.maxMarks;
    if (a.awardType === 'GOLD') goldCount += 1;
    else if (a.awardType === 'PLATINUM') platinumCount += 1;
    else if (a.awardType === 'SILVER') silverCount += 1;
  }

  const overallAccuracy = calculateSafePercentage(totalCorrect, totalQuestionsAttempted);
  const totalAwardsEarned = goldCount + platinumCount + silverCount;

  return {
    summary: {
      totalTestsCompleted: filteredAttempts.length,
      uniqueTestsCompleted: mcqPracticeResults.length + previousPaperResults.length + mockTestResults.length,
      totalQuestionsAttempted,
      overallMarksObtained: Math.round(overallMarksObtained * 100) / 100,
      overallMaxMarks: Math.round(overallMaxMarks * 100) / 100,
      overallAccuracy,
      totalAwardsEarned,
      goldCount,
      platinumCount,
      silverCount,
      mcqPracticeCount: mcqPracticeResults.length,
      previousPapersCount: previousPaperResults.length,
      mockTestsCount: mockTestResults.length,
    },
    counts: {
      all: normalizedAttempts.length,
      mcq_practice: normalizedAttempts.filter((a) => a.resultCategory === 'mcq_practice').length,
      previous_paper: normalizedAttempts.filter((a) => a.resultCategory === 'previous_paper').length,
      mock_test: normalizedAttempts.filter((a) => a.resultCategory === 'mock_test').length,
    },
    availableFilters: {
      groups: availableGroups,
      subjects: availableSubjects,
      standards: availableStandards,
      units: availableUnits,
      lessons: availableLessons,
      years: availableYears,
      testCategories: availableTestCategories,
    },
    mcqPracticeResults,
    previousPaperResults,
    mockTestResults,
    // Backward-compatible scorecards array
    scorecards: filteredAttempts.slice(0, 100),
  };
}

export async function getStudentScorecardDetail(studentId: number, attemptId: number) {
  const res = await pool.query(
    `SELECT
       a.id, a.test_id,
       COALESCE(NULLIF(TRIM(a.test_key), ''), COALESCE(NULLIF(TRIM(a.test_id), ''), LOWER(TRIM(a.test_title)))) AS resolved_test_key,
       a.test_title, a.category, a.subject, a.assessment_type, a.mock_test_format, a.attempt_number,
       a.total_questions, a.attempted_questions, a.correct_answers, a.incorrect_answers, a.unanswered_questions,
       a.score, a.max_score, a.percentage, a.time_spent_seconds,
       a.group_id, a.subject_id, a.standard_id, a.unit_id, a.lesson_id, a.lesson_title, a.grade, a.award_type,
       a.subject_breakdown, a.topic_breakdown, a.question_responses, a.completed_at,
       p.year AS pyp_year, p.exam AS pyp_exam, p.subjects AS pyp_subjects,
       mt.test_category AS mt_test_category, mt.tnpsc_group AS mt_tnpsc_group,
       mt.subject AS mt_subject, mt.standard AS mt_standard, mt.unit AS mt_unit,
       mt.lesson AS mt_lesson, mt.negative_marking AS mt_negative_marking
     FROM mock_test_attempts a
     LEFT JOIN previous_year_papers p
       ON a.test_id = ('pyp-' || p.id::text)
     LEFT JOIN mock_tests mt
       ON a.test_id IS NOT NULL AND (mt.id::text = a.test_id OR mt.slug = a.test_id)
     WHERE a.id = $1 AND a.student_id = $2
       AND COALESCE(a.status, 'completed') = 'completed'`,
    [attemptId, studentId]
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  const base = formatScorecardRow(row);
  const awardSettings = await getAwardSettings();
  const storedAward = String(row.award_type || '').toUpperCase().trim();
  const awardType: AwardType =
    storedAward === 'GOLD' || storedAward === 'PLATINUM' || storedAward === 'SILVER' || storedAward === 'NONE'
      ? (storedAward as AwardType)
      : resolveAwardForPercentage(base.percentage, awardSettings);

  const testKey = String(row.resolved_test_key || '');
  const rankMap = await computeRankMapForTestKeys(studentId, [testKey]);
  const rankInfo = rankMap.get(testKey) || null;
  const resultCategory = resolveMarkListResultCategory(row);
  const isPreviousPaper = resultCategory === 'previous_paper';
  const isMockTest = resultCategory === 'mock_test';
  const testCategory = isMockTest ? resolveMockTestSubCategory(row) : null;
  const testCategoryLabel = testCategory ? formatMockTestSubCategoryLabel(testCategory) : null;
  const groupInfo = formatGroupLabel(row.group_id || row.mt_tnpsc_group, row.category);
  const marksPerQ = base.totalQuestions > 0 ? Math.round((base.maxMarks / base.totalQuestions) * 100) / 100 : 1;
  const configuredNegPerWrong = isMockTest && row.mt_negative_marking != null ? Number(row.mt_negative_marking) : 0;
  const expectedPositiveMarks =
    base.maxMarks > 0 && base.totalQuestions > 0 ? (base.correctAnswers * base.maxMarks) / base.totalQuestions : base.correctAnswers;
  const negativeMarks =
    configuredNegPerWrong > 0 && base.incorrectAnswers > 0
      ? Math.round(base.incorrectAnswers * configuredNegPerWrong * 100) / 100
      : expectedPositiveMarks > base.marksObtained
        ? Math.round((expectedPositiveMarks - base.marksObtained) * 100) / 100
        : 0;

  const rawResponses = Array.isArray(row.question_responses) ? row.question_responses : [];
  const enrichedResponses = rawResponses.map((q: any, idx: number) => {
    const selectedOption = q?.selectedOption ?? null;
    const correctAnswer = q?.correctAnswer ?? null;
    const isUnanswered = selectedOption === null || selectedOption === undefined || Number(selectedOption) < 0;
    const isCorrect = Boolean(!isUnanswered && q?.isCorrect);
    return {
      index: idx + 1,
      questionId: q?.questionId ?? null,
      questionText: q?.questionText || `Question ${idx + 1}`,
      options: Array.isArray(q?.options) ? q.options : [],
      subject: q?.subject || null,
      topic: q?.topic || null,
      selectedOption: isUnanswered ? null : Number(selectedOption),
      correctAnswer: correctAnswer !== null && correctAnswer !== undefined ? Number(correctAnswer) : null,
      status: isUnanswered ? 'unanswered' : isCorrect ? 'correct' : 'incorrect',
      isCorrect,
      marksAwarded: isCorrect ? marksPerQ : 0,
    };
  });

  return {
    ...base,
    attemptNumber: Number(row.attempt_number || 1),
    resultCategory,
    testCategory,
    testCategoryLabel,
    negativeMarks,
    groupId: groupInfo.id,
    groupLabel: groupInfo.label,
    subjectLabel: isPreviousPaper
      ? String(row.pyp_subjects || row.subject || 'Previous Year Paper').trim()
      : formatSubjectLabel(row.subject_id, row.subject || row.mt_subject),
    standardId: row.standard_id != null ? Number(row.standard_id) : parseLeadingInt(row.mt_standard),
    unitId: row.unit_id != null ? Number(row.unit_id) : parseLeadingInt(row.mt_unit),
    lessonTitle: row.lesson_title || row.mt_lesson || null,
    examYear: isPreviousPaper ? extractExamYear(row.test_title, row.pyp_year) : null,
    awardType,
    grade: row.grade || null,
    rank: rankInfo?.rank ?? null,
    totalParticipants: rankInfo?.totalParticipants ?? null,
    percentile: rankInfo?.percentile ?? null,
    accuracyPercentage: calculateSafePercentage(base.correctAnswers, base.attemptedQuestions),
    subjectPerformance: Array.isArray(row.subject_breakdown) ? row.subject_breakdown : [],
    topicPerformance: Array.isArray(row.topic_breakdown) ? row.topic_breakdown : [],
    questionResponses: enrichedResponses,
  };
}

export async function getAdminAssessmentAnalytics() {
  const [summaryRes, byTypeRes, publishedRes] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int AS total_submissions,
        COUNT(DISTINCT student_id)::int AS active_students,
        COALESCE(AVG(percentage), 0)::numeric(5,1) AS avg_percentage,
        COALESCE(MAX(percentage), 0)::numeric(5,1) AS highest_percentage
      FROM mock_test_attempts
      WHERE COALESCE(status, 'completed') = 'completed'
        AND attempted_questions > 0
    `),
    pool.query(`
      SELECT
        COALESCE(assessment_type, 'mock_test') AS assessment_type,
        COUNT(*)::int AS submissions,
        COALESCE(AVG(percentage), 0)::numeric(5,1) AS avg_percentage
      FROM mock_test_attempts
      WHERE COALESCE(status, 'completed') = 'completed'
        AND attempted_questions > 0
      GROUP BY COALESCE(assessment_type, 'mock_test')
      ORDER BY submissions DESC
    `),
    pool.query(`SELECT COUNT(*)::int AS published_mock_tests FROM mock_tests WHERE status = 'published'`),
  ]);

  const s = summaryRes.rows[0] || {};
  return {
    totalSubmissions: Number(s.total_submissions || 0),
    activeStudents: Number(s.active_students || 0),
    avgPercentage: parseFloat(s.avg_percentage || '0'),
    highestPercentage: parseFloat(s.highest_percentage || '0'),
    publishedMockTests: Number(publishedRes.rows[0]?.published_mock_tests || 0),
    byType: byTypeRes.rows.map((r) => ({
      assessmentType: r.assessment_type,
      submissions: Number(r.submissions || 0),
      avgPercentage: parseFloat(r.avg_percentage || '0'),
    })),
  };
}
