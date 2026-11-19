import { randomUUID } from 'crypto';
import pool from '../db';
import { calculateSafePercentage, notifyStudentDashboardUpdate } from './studentDashboardService';
import { calculateGrade } from './gradeService';
import { calculateAttemptAward } from './awardService';

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
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export async function getStudentMarkList(studentId: number, filters: MarkListFilters = {}) {
  const filterType = String(filters.type || 'all').trim().toLowerCase();
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 25));
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [
    'student_id = $1',
    "COALESCE(status, 'completed') = 'completed'",
    'attempted_questions > 0',
  ];
  const params: any[] = [studentId];

  if (filterType === 'mock_test') {
    whereClauses.push("COALESCE(assessment_type, 'mock_test') = 'mock_test'");
  } else if (filterType === 'lesson_quiz') {
    whereClauses.push("assessment_type IN ('lesson_quiz', 'study_material_quiz')");
  } else if (filterType === 'subject_practice') {
    whereClauses.push("assessment_type IN ('subject_drill', 'previous_paper')");
  }

  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) {
    params.push(filters.from);
    whereClauses.push(`(completed_at AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length}::date`);
  }
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) {
    params.push(filters.to);
    whereClauses.push(`(completed_at AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length}::date`);
  }

  const whereSql = whereClauses.join(' AND ');

  const qaDateWhere: string[] = [
    'student_id = $1',
    "source_system <> 'mock_test'",
    'selected_option IS NOT NULL',
    'selected_option >= 0',
  ];
  const qaParams: any[] = [studentId];
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) {
    qaParams.push(filters.from);
    qaDateWhere.push(`(attempted_at AT TIME ZONE 'Asia/Kolkata')::date >= $${qaParams.length}::date`);
  }
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) {
    qaParams.push(filters.to);
    qaDateWhere.push(`(attempted_at AT TIME ZONE 'Asia/Kolkata')::date <= $${qaParams.length}::date`);
  }

  const [kpiMockRes, kpiQaRes, countsRes, listRes, filteredCountRes] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)::int AS assessments_taken,
         COALESCE(MAX(percentage), 0)::numeric(5,1) AS highest_score,
         COALESCE(SUM(attempted_questions), 0)::int AS mock_attempted,
         COALESCE(SUM(correct_answers), 0)::int AS mock_correct
       FROM mock_test_attempts
       WHERE ${whereSql}`,
      params
    ),
    pool.query(
      `SELECT
         COUNT(CASE WHEN source_system <> 'mock_test' THEN 1 END)::int AS non_mock_attempts,
         COUNT(CASE WHEN source_system <> 'mock_test' AND is_correct THEN 1 END)::int AS non_mock_correct,
         COUNT(DISTINCT CASE WHEN question_id IS NOT NULL THEN question_id::text ELSE 'custom:' || id::text END)::int AS unique_solved
       FROM question_attempts
       WHERE ${qaDateWhere.join(' AND ')}`,
      qaParams
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS all_count,
         COUNT(CASE WHEN COALESCE(assessment_type, 'mock_test') = 'mock_test' THEN 1 END)::int AS mock_test_count,
         COUNT(CASE WHEN assessment_type IN ('lesson_quiz', 'study_material_quiz') THEN 1 END)::int AS lesson_quiz_count,
         COUNT(CASE WHEN assessment_type IN ('subject_drill', 'previous_paper') THEN 1 END)::int AS subject_practice_count
       FROM mock_test_attempts
       WHERE student_id = $1
         AND COALESCE(status, 'completed') = 'completed'
         AND attempted_questions > 0`,
      [studentId]
    ),
    pool.query(
      `SELECT
         id, test_id, test_title, category, assessment_type,
         total_questions, attempted_questions, correct_answers, incorrect_answers, unanswered_questions,
         score, max_score, percentage, time_spent_seconds, completed_at
       FROM mock_test_attempts
       WHERE ${whereSql}
       ORDER BY completed_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    pool.query(`SELECT COUNT(*)::int AS total FROM mock_test_attempts WHERE ${whereSql}`, params),
  ]);

  const mRow = kpiMockRes.rows[0] || {};
  const qRow = kpiQaRes.rows[0] || {};
  const cRow = countsRes.rows[0] || {};

  const totalGradedAttempts = Number(qRow.non_mock_attempts || 0) + Number(mRow.mock_attempted || 0);
  const totalGradedCorrect = Number(qRow.non_mock_correct || 0) + Number(mRow.mock_correct || 0);
  const averageAccuracy = calculateSafePercentage(totalGradedCorrect, totalGradedAttempts);
  const highestScore = Math.round(parseFloat(mRow.highest_score || '0'));

  return {
    metrics: {
      highestScore,
      averageAccuracy,
      assessmentsTaken: Number(mRow.assessments_taken || 0),
      totalSolved: Number(qRow.unique_solved || 0),
    },
    counts: {
      all: Number(cRow.all_count || 0),
      mock_test: Number(cRow.mock_test_count || 0),
      lesson_quiz: Number(cRow.lesson_quiz_count || 0),
      subject_practice: Number(cRow.subject_practice_count || 0),
    },
    pagination: {
      page,
      limit,
      total: Number(filteredCountRes.rows[0]?.total || 0),
    },
    scorecards: listRes.rows.map(formatScorecardRow),
  };
}

export async function getStudentScorecardDetail(studentId: number, attemptId: number) {
  const res = await pool.query(
    `SELECT
       id, test_id, test_title, category, assessment_type,
       total_questions, attempted_questions, correct_answers, incorrect_answers, unanswered_questions,
       score, max_score, percentage, time_spent_seconds,
       subject_breakdown, topic_breakdown, question_responses, completed_at
     FROM mock_test_attempts
     WHERE id = $1 AND student_id = $2
       AND COALESCE(status, 'completed') = 'completed'`,
    [attemptId, studentId]
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  const base = formatScorecardRow(row);

  return {
    ...base,
    accuracyPercentage: calculateSafePercentage(base.correctAnswers, base.attemptedQuestions),
    subjectPerformance: Array.isArray(row.subject_breakdown) ? row.subject_breakdown : [],
    topicPerformance: Array.isArray(row.topic_breakdown) ? row.topic_breakdown : [],
    questionResponses: Array.isArray(row.question_responses) ? row.question_responses : [],
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
