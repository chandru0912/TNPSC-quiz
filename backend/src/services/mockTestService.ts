import { PoolClient } from 'pg';
import pool from '../db';
import { submitAssessmentAttempt } from './markListService';
import { notifyPlatformContentUpdate } from './studentDashboardService';

export type MockTestStatus = 'draft' | 'published' | 'scheduled' | 'staging' | 'archived';
export type MockTestCategory = 'lesson_wise' | 'unit_wise' | 'full_length';

export interface MockTestConfigInput {
  title: string;
  description?: string;
  tnpscGroup: string;
  testCategory?: MockTestCategory;
  subject?: string;
  standard?: string | null;
  unit?: string | null;
  lesson?: string | null;
  questionsCount: number;
  durationMinutes: number;
  totalMarks: number;
  marksPerQuestion: number;
  negativeMarking: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  status?: MockTestStatus;
  startAt?: string | null;
  endAt?: string | null;
  randomizePerAttempt?: boolean;
  avoidRepeatedQuestions?: boolean;
  includeIncorrectOnRetake?: boolean;
  questionIds: number[];
}

export function normalizeTestCategory(raw?: string | null): MockTestCategory {
  const clean = String(raw || '').trim().toLowerCase();
  if (clean === 'lesson_wise' || clean === 'lesson-wise' || clean === 'lesson') return 'lesson_wise';
  if (clean === 'unit_wise' || clean === 'unit-wise' || clean === 'unit') return 'unit_wise';
  return 'full_length';
}

export function normalizeGroupToCategory(tnpscGroup: string): {
  category: string;
  categoryName: string;
  tnpscGroup: string;
} {
  const clean = String(tnpscGroup || '').trim().toLowerCase();
  if (clean === 'group 1' || clean === 'group1') {
    return { category: 'group1', categoryName: 'TNPSC Group 1', tnpscGroup: 'Group 1' };
  }
  if (clean === 'group 2a' || clean === 'group2a') {
    return { category: 'group2_2a', categoryName: 'TNPSC Group 2A', tnpscGroup: 'Group 2A' };
  }
  if (clean === 'group 2' || clean === 'group2' || clean === 'group 2 & 2a' || clean === 'group2_2a') {
    return { category: 'group2_2a', categoryName: 'TNPSC Group 2', tnpscGroup: 'Group 2' };
  }
  if (clean === 'group 4' || clean === 'group4' || clean === 'group4_vao' || clean.includes('vao')) {
    return { category: 'group4_vao', categoryName: 'TNPSC Group 4', tnpscGroup: 'Group 4' };
  }
  return { category: 'group1', categoryName: `TNPSC ${tnpscGroup || 'Group 1'}`, tnpscGroup: tnpscGroup || 'Group 1' };
}

function normalizeQuestionCategoryMatch(group?: string | null): string[] | null {
  if (!group || group === 'all') return null;
  const clean = group.trim().toLowerCase();
  if (clean === 'group 1' || clean === 'group1') return ['group1', 'group 1'];
  if (clean === 'group 2' || clean === 'group2' || clean === 'group 2a' || clean === 'group2a' || clean === 'group2_2a') {
    return ['group2', 'group 2', 'group2a', 'group 2a', 'group2_2a', 'group 2 & 2a'];
  }
  if (clean === 'group 4' || clean === 'group4' || clean === 'group4_vao') {
    return ['group4', 'group 4', 'group4_vao', 'group 4 & vao'];
  }
  return [clean];
}

function parseStandardNumber(standard?: string | null): number | null {
  if (!standard || standard === 'all') return null;
  const match = String(standard).match(/\d+/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isInteger(num) && num >= 1 && num <= 12 ? num : null;
}

function parseUnitNumber(unit?: string | null): number | null {
  if (!unit || unit === 'all') return null;
  const match = String(unit).match(/\d+/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'mock-test'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function mapAdminMockTestRow(row: any) {
  const assignedCount = Number(row.assigned_questions_count || 0);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || '',
    category: row.category,
    categoryName: row.category_name,
    tnpscGroup: row.tnpsc_group || row.category_name || 'Group 1',
    testCategory: normalizeTestCategory(row.test_category),
    subject: row.subject || 'General Studies',
    standard: row.standard || null,
    unit: row.unit || null,
    lesson: row.lesson || null,
    questionsCount: Number(row.questions_count || 0),
    assignedQuestionsCount: assignedCount,
    durationMinutes: Number(row.duration_minutes || 90),
    totalMarks: Number(row.total_marks || 0),
    marksPerQuestion: Number(row.marks_per_question || 1.5),
    negativeMarking: Number(row.negative_marking || 0),
    difficulty: row.difficulty || 'Medium',
    status: row.status === 'staging' ? 'draft' : row.status,
    rawStatus: row.status,
    randomizePerAttempt: Boolean(row.randomize_per_attempt),
    avoidRepeatedQuestions: row.avoid_repeated_questions !== false,
    includeIncorrectOnRetake: Boolean(row.include_incorrect_on_retake),
    startAt: row.start_at,
    endAt: row.end_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attemptsCount: Number(row.attempts_count || 0),
    avgScorePercentage: Number(row.avg_percentage || 0),
  };
}

export async function getAdminMockTestsOverview(filters?: {
  search?: string;
  group?: string;
  status?: string;
  subject?: string;
  testCategory?: string;
}) {
  const where: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filters?.search?.trim()) {
    where.push(`(LOWER(mt.title) LIKE $${idx} OR LOWER(COALESCE(mt.subject, '')) LIKE $${idx})`);
    params.push(`%${filters.search.trim().toLowerCase()}%`);
    idx++;
  }
  if (filters?.group && filters.group !== 'all') {
    const cleanGroup = filters.group.trim().toLowerCase();
    if (cleanGroup === 'group 2' || cleanGroup === 'group 2a') {
      where.push(`(LOWER(COALESCE(mt.tnpsc_group, '')) = $${idx} OR LOWER(mt.category) = 'group2_2a')`);
      params.push(cleanGroup);
    } else {
      const cat = normalizeGroupToCategory(filters.group).category;
      where.push(`(LOWER(COALESCE(mt.tnpsc_group, '')) = $${idx} OR LOWER(mt.category) = $${idx + 1})`);
      params.push(cleanGroup, cat);
      idx++;
    }
    idx++;
  }
  if (filters?.status && filters.status !== 'all') {
    if (filters.status === 'draft') {
      where.push(`mt.status IN ('draft', 'staging')`);
    } else {
      where.push(`mt.status = $${idx}`);
      params.push(filters.status);
      idx++;
    }
  }
  if (filters?.subject && filters.subject !== 'all') {
    where.push(`LOWER(COALESCE(mt.subject, '')) = $${idx}`);
    params.push(filters.subject.trim().toLowerCase());
    idx++;
  }
  if (filters?.testCategory && filters.testCategory !== 'all') {
    where.push(`COALESCE(mt.test_category, 'full_length') = $${idx}`);
    params.push(normalizeTestCategory(filters.testCategory));
    idx++;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [testsRes, statsRes] = await Promise.all([
    pool.query(
      `SELECT
         mt.*,
         COALESCE(q_cnt.cnt, 0)::int AS assigned_questions_count,
         COALESCE(a_cnt.attempts, 0)::int AS attempts_count,
         COALESCE(a_cnt.avg_pct, 0)::numeric(5,1) AS avg_percentage
       FROM mock_tests mt
       LEFT JOIN (
         SELECT mock_test_id, COUNT(*)::int AS cnt
         FROM mock_test_questions
         GROUP BY mock_test_id
       ) q_cnt ON q_cnt.mock_test_id = mt.id
       LEFT JOIN (
         SELECT
           test_id,
           COUNT(*)::int AS attempts,
           COALESCE(AVG(percentage), 0)::numeric(5,1) AS avg_pct
         FROM mock_test_attempts
         WHERE COALESCE(assessment_type, 'mock_test') = 'mock_test'
           AND COALESCE(status, 'completed') = 'completed'
         GROUP BY test_id
       ) a_cnt ON a_cnt.test_id = mt.id::text OR a_cnt.test_id = mt.slug
       ${whereClause}
       ORDER BY mt.created_at DESC, mt.id DESC`,
      params
    ),
    pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM mock_tests WHERE status <> 'archived') AS total_tests,
        (SELECT COUNT(*)::int FROM mock_tests WHERE status = 'published') AS published_tests,
        (SELECT COUNT(*)::int FROM mock_tests WHERE status IN ('draft', 'staging')) AS draft_tests,
        (SELECT COUNT(*)::int FROM mock_tests WHERE status = 'scheduled') AS scheduled_tests,
        (SELECT COUNT(*)::int FROM mock_test_attempts WHERE COALESCE(assessment_type, 'mock_test') = 'mock_test' AND COALESCE(status, 'completed') = 'completed') AS total_attempts,
        (SELECT COALESCE(AVG(percentage), 0)::numeric(5,1) FROM mock_test_attempts WHERE COALESCE(assessment_type, 'mock_test') = 'mock_test' AND COALESCE(status, 'completed') = 'completed' AND attempted_questions > 0) AS avg_score
    `),
  ]);

  const s = statsRes.rows[0] || {};
  return {
    stats: {
      totalTests: Number(s.total_tests || 0),
      publishedTests: Number(s.published_tests || 0),
      draftTests: Number(s.draft_tests || 0),
      scheduledTests: Number(s.scheduled_tests || 0),
      totalStudentAttempts: Number(s.total_attempts || 0),
      averageStudentScore: Number(s.avg_score || 0),
    },
    tests: testsRes.rows.map(mapAdminMockTestRow),
  };
}

export async function searchQuestionBankForMockTest(filters: {
  group?: string;
  subject?: string;
  standard?: string;
  unit?: string;
  difficulty?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const where: string[] = [`status <> 'archived'`];
  const params: any[] = [];
  let idx = 1;

  const groupMatches = normalizeQuestionCategoryMatch(filters.group);
  if (groupMatches && groupMatches.length > 0) {
    where.push(`LOWER(COALESCE(category, '')) = ANY($${idx}::text[])`);
    params.push(groupMatches);
    idx++;
  }
  if (filters.subject && filters.subject !== 'all') {
    where.push(`LOWER(COALESCE(subject, '')) LIKE $${idx}`);
    params.push(`%${filters.subject.trim().toLowerCase()}%`);
    idx++;
  }
  const stdNum = parseStandardNumber(filters.standard);
  if (stdNum !== null) {
    where.push(`(class_id = $${idx} OR standard_id = $${idx})`);
    params.push(stdNum);
    idx++;
  }
  const unitNum = parseUnitNumber(filters.unit);
  if (unitNum !== null) {
    where.push(`unit_id = $${idx}`);
    params.push(unitNum);
    idx++;
  }
  if (filters.difficulty && filters.difficulty !== 'all') {
    where.push(`LOWER(COALESCE(difficulty, '')) = $${idx}`);
    params.push(filters.difficulty.trim().toLowerCase());
    idx++;
  }
  if (filters.status && filters.status !== 'all') {
    where.push(`status = $${idx}`);
    params.push(filters.status.trim().toLowerCase());
    idx++;
  }
  if (filters.search?.trim()) {
    where.push(
      `(LOWER(question_text) LIKE $${idx} OR LOWER(COALESCE(topic, '')) LIKE $${idx} OR LOWER(COALESCE(lesson_title, '')) LIKE $${idx})`
    );
    params.push(`%${filters.search.trim().toLowerCase()}%`);
    idx++;
  }

  const limit = Math.min(200, Math.max(10, Number(filters.limit) || 50));
  const offset = Math.max(0, Number(filters.offset) || 0);
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [countRes, rowsRes] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total FROM questions ${whereSql}`, params),
    pool.query(
      `SELECT
         id, category, unit_id, class_id, subject, lesson_title, topic,
         difficulty, question_text, options, correct_answer, explanation, status
       FROM questions
       ${whereSql}
       ORDER BY id DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    ),
  ]);

  return {
    total: Number(countRes.rows[0]?.total || 0),
    questions: rowsRes.rows.map((r) => ({
      id: r.id,
      category: r.category,
      unitId: r.unit_id,
      classId: r.class_id,
      subject: r.subject,
      lessonTitle: r.lesson_title,
      topic: r.topic,
      difficulty: r.difficulty,
      question: r.question_text,
      options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options || [],
      correctAnswer: r.correct_answer,
      explanation: r.explanation,
      status: r.status,
    })),
  };
}

export async function autoSelectQuestionsForMockTest(params: {
  group?: string;
  subject?: string;
  standard?: string;
  unit?: string;
  difficulty?: string;
  count: number;
  excludeIds?: number[];
}) {
  const requestedCount = Math.max(1, Math.min(200, Number(params.count) || 25));
  const where: string[] = [
    `status <> 'archived'`,
    `COALESCE(verification_status, 'verified') <> 'rejected'`,
    `correct_answer BETWEEN 0 AND 3`,
  ];
  const queryParams: any[] = [];
  let idx = 1;

  const groupMatches = normalizeQuestionCategoryMatch(params.group);
  if (groupMatches && groupMatches.length > 0) {
    where.push(`LOWER(COALESCE(category, '')) = ANY($${idx}::text[])`);
    queryParams.push(groupMatches);
    idx++;
  }
  if (params.subject && params.subject !== 'all') {
    where.push(`LOWER(COALESCE(subject, '')) LIKE $${idx}`);
    queryParams.push(`%${params.subject.trim().toLowerCase()}%`);
    idx++;
  }
  const stdNum = parseStandardNumber(params.standard);
  if (stdNum !== null) {
    where.push(`(class_id = $${idx} OR standard_id = $${idx})`);
    queryParams.push(stdNum);
    idx++;
  }
  const unitNum = parseUnitNumber(params.unit);
  if (unitNum !== null) {
    where.push(`unit_id = $${idx}`);
    queryParams.push(unitNum);
    idx++;
  }
  if (params.difficulty && params.difficulty !== 'all') {
    where.push(`LOWER(COALESCE(difficulty, '')) = $${idx}`);
    queryParams.push(params.difficulty.trim().toLowerCase());
    idx++;
  }
  const cleanExclude = Array.isArray(params.excludeIds)
    ? params.excludeIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  if (cleanExclude.length > 0) {
    where.push(`NOT (id = ANY($${idx}::int[]))`);
    queryParams.push(cleanExclude);
    idx++;
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const countRes = await pool.query(`SELECT COUNT(*)::int AS eligible FROM questions ${whereSql}`, queryParams);
  const eligible = Number(countRes.rows[0]?.eligible || 0);

  if (eligible < requestedCount) {
    const err: any = new Error(
      `Insufficient questions in Question Bank: only ${eligible} eligible question${eligible === 1 ? '' : 's'} match the selected criteria, but ${requestedCount} were requested.`
    );
    err.statusCode = 400;
    err.eligibleCount = eligible;
    throw err;
  }

  const res = await pool.query(
    `SELECT
       id, category, unit_id, class_id, subject, lesson_title, topic,
       difficulty, question_text, options, correct_answer, explanation, status
     FROM questions
     ${whereSql}
     ORDER BY RANDOM()
     LIMIT $${idx}`,
    [...queryParams, requestedCount]
  );

  return {
    eligibleCount: eligible,
    questions: res.rows.map((r) => ({
      id: r.id,
      category: r.category,
      unitId: r.unit_id,
      classId: r.class_id,
      subject: r.subject,
      lessonTitle: r.lesson_title,
      topic: r.topic,
      difficulty: r.difficulty,
      question: r.question_text,
      options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options || [],
      correctAnswer: r.correct_answer,
      explanation: r.explanation,
      status: r.status,
    })),
  };
}

async function ensureNoDuplicateMockTest(
  client: PoolClient,
  title: string,
  category: string,
  testCategory: MockTestCategory,
  excludeId?: number
) {
  const res = await client.query(
    `SELECT id
     FROM mock_tests
     WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))
       AND category = $2
       AND COALESCE(test_category, 'full_length') = $3
       AND status <> 'archived'
       AND ($4::int IS NULL OR id <> $4)
     LIMIT 1`,
    [title, category, testCategory, excludeId ?? null]
  );
  if (res.rows.length > 0) {
    const err: any = new Error(`A ${testCategory.replace('_', '-')} mock test titled "${title.trim()}" already exists for this TNPSC Group.`);
    err.statusCode = 409;
    throw err;
  }
}

async function validateForPublish(
  client: PoolClient,
  config: {
    title: string;
    tnpscGroup: string;
    testCategory?: MockTestCategory;
    randomizePerAttempt?: boolean;
    questionsCount: number;
    durationMinutes: number;
    totalMarks: number;
    marksPerQuestion: number;
    negativeMarking: number;
    status: string;
    startAt?: string | null;
    endAt?: string | null;
  },
  questionIds: number[]
) {
  if (!config.title?.trim()) {
    const err: any = new Error('Test title is required before publishing.');
    err.statusCode = 400;
    throw err;
  }
  if (!config.tnpscGroup?.trim()) {
    const err: any = new Error('TNPSC Group is required before publishing.');
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isInteger(config.questionsCount) || config.questionsCount <= 0) {
    const err: any = new Error('Total Questions must be greater than 0.');
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isFinite(config.durationMinutes) || config.durationMinutes <= 0) {
    const err: any = new Error('Test Duration must be greater than 0 minutes.');
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isFinite(config.marksPerQuestion) || config.marksPerQuestion <= 0) {
    const err: any = new Error('Marks Per Question must be greater than 0.');
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isFinite(config.totalMarks) || config.totalMarks <= 0) {
    const err: any = new Error('Total Marks must be greater than 0.');
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isFinite(config.negativeMarking) || config.negativeMarking < 0) {
    const err: any = new Error('Negative Marking cannot be negative.');
    err.statusCode = 400;
    throw err;
  }
  if (config.status === 'scheduled' && !config.startAt) {
    const err: any = new Error('Start Date and Time is required for Scheduled tests.');
    err.statusCode = 400;
    throw err;
  }
  if (config.startAt && config.endAt && new Date(config.endAt) <= new Date(config.startAt)) {
    const err: any = new Error('End Date and Time must be after Start Date and Time.');
    err.statusCode = 400;
    throw err;
  }
  const isDynamicFullLength =
    config.testCategory === 'full_length' && Boolean(config.randomizePerAttempt) && questionIds.length === 0;

  if (isDynamicFullLength) {
    const groupMatches = normalizeQuestionCategoryMatch(config.tnpscGroup);
    const bankCheck = await client.query(
      `SELECT COUNT(*)::int AS cnt
       FROM questions
       WHERE status = 'published'
         AND COALESCE(verification_status, 'verified') <> 'rejected'
         AND correct_answer BETWEEN 0 AND 3
         AND ($1::text[] IS NULL OR LOWER(COALESCE(category, '')) = ANY($1::text[]))`,
      [groupMatches]
    );
    const eligible = Number(bankCheck.rows[0]?.cnt || 0);
    if (eligible === 0) {
      const err: any = new Error(
        `No published approved questions exist in the Question Bank for ${config.tnpscGroup} yet.`
      );
      err.statusCode = 400;
      throw err;
    }
    return;
  }

  if (questionIds.length === 0) {
    const err: any = new Error('Please select questions from the Question Bank before publishing.');
    err.statusCode = 400;
    throw err;
  }
  if (questionIds.length !== config.questionsCount) {
    const err: any = new Error(
      `Selected questions (${questionIds.length}) must match Total Questions (${config.questionsCount}) before publishing.`
    );
    err.statusCode = 400;
    throw err;
  }

  const qCheck = await client.query(
    `SELECT id, options, correct_answer
     FROM questions
     WHERE id = ANY($1::int[])`,
    [questionIds]
  );
  if (qCheck.rows.length !== questionIds.length) {
    const err: any = new Error('One or more selected questions no longer exist in the Question Bank.');
    err.statusCode = 400;
    throw err;
  }
  for (const row of qCheck.rows) {
    const opts = typeof row.options === 'string' ? JSON.parse(row.options) : row.options || [];
    if (!Array.isArray(opts) || opts.length < 4) {
      const err: any = new Error(`Question #${row.id} does not have 4 valid options.`);
      err.statusCode = 400;
      throw err;
    }
    if (row.correct_answer === null || row.correct_answer < 0 || row.correct_answer > 3) {
      const err: any = new Error(`Question #${row.id} is missing a valid answer key.`);
      err.statusCode = 400;
      throw err;
    }
  }
}

export async function getAdminMockTestDetail(id: number) {
  const [testRes, questionsRes] = await Promise.all([
    pool.query(
      `SELECT mt.*,
         (SELECT COUNT(*)::int FROM mock_test_questions WHERE mock_test_id = mt.id) AS assigned_questions_count
       FROM mock_tests mt WHERE mt.id = $1`,
      [id]
    ),
    pool.query(
      `SELECT
         mtq.question_order, mtq.marks,
         q.id, q.category, q.unit_id, q.class_id, q.subject, q.lesson_title, q.topic,
         q.difficulty, q.question_text, q.options, q.correct_answer, q.explanation, q.status
       FROM mock_test_questions mtq
       JOIN questions q ON q.id = mtq.question_id
       WHERE mtq.mock_test_id = $1
       ORDER BY mtq.question_order ASC, mtq.id ASC`,
      [id]
    ),
  ]);

  if (testRes.rows.length === 0) return null;

  return {
    test: mapAdminMockTestRow(testRes.rows[0]),
    questions: questionsRes.rows.map((r) => ({
      id: r.id,
      order: r.question_order,
      category: r.category,
      unitId: r.unit_id,
      classId: r.class_id,
      subject: r.subject,
      lessonTitle: r.lesson_title,
      topic: r.topic,
      difficulty: r.difficulty,
      question: r.question_text,
      options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options || [],
      correctAnswer: r.correct_answer,
      explanation: r.explanation,
      status: r.status,
    })),
  };
}

export async function createAdminMockTest(input: MockTestConfigInput, adminUsername: string) {
  const dedupedIds = Array.from(new Set((input.questionIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0)));
  const groupInfo = normalizeGroupToCategory(input.tnpscGroup);
  const testCategory = normalizeTestCategory(input.testCategory);
  const status = input.status || 'draft';
  const marksPerQ = Number(input.marksPerQuestion) || 1.5;
  const totalQ = Number(input.questionsCount) || dedupedIds.length || (testCategory === 'full_length' ? 200 : 25);
  const totalMarks = Number(input.totalMarks) || Number((totalQ * marksPerQ).toFixed(2));
  const negativeMarking = Number(input.negativeMarking) || 0;
  const durationMinutes = Number(input.durationMinutes) || (testCategory === 'full_length' ? 180 : 30);
  const randomizePerAttempt = Boolean(input.randomizePerAttempt) && testCategory === 'full_length';
  const avoidRepeatedQuestions = input.avoidRepeatedQuestions !== false;
  const includeIncorrectOnRetake = Boolean(input.includeIncorrectOnRetake);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!input.title?.trim()) {
      const err: any = new Error('Mock Test Title is required.');
      err.statusCode = 400;
      throw err;
    }

    await ensureNoDuplicateMockTest(client, input.title, groupInfo.category, testCategory);

    if (status === 'published' || status === 'scheduled') {
      await validateForPublish(
        client,
        {
          title: input.title,
          tnpscGroup: groupInfo.tnpscGroup,
          testCategory,
          randomizePerAttempt,
          questionsCount: totalQ,
          durationMinutes,
          totalMarks,
          marksPerQuestion: marksPerQ,
          negativeMarking,
          status,
          startAt: input.startAt,
          endAt: input.endAt,
        },
        dedupedIds
      );
    }

    const slug = slugifyTitle(input.title);
    const insertRes = await client.query(
      `INSERT INTO mock_tests (
         slug, title, description, category, category_name, tnpsc_group, test_category,
         subject, standard, unit, lesson,
         questions_count, duration_minutes, total_marks, marks_per_question, negative_marking,
         difficulty, status, randomize_per_attempt, avoid_repeated_questions, include_incorrect_on_retake,
         start_at, end_at, published_at, created_by, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14, $15, $16,
         $17, $18, $19, $20, $21,
         $22, $23, $24, $25, CURRENT_TIMESTAMP
       ) RETURNING *`,
      [
        slug,
        input.title.trim(),
        input.description?.trim() || '',
        groupInfo.category,
        groupInfo.categoryName,
        groupInfo.tnpscGroup,
        testCategory,
        testCategory === 'full_length'
          ? input.subject?.trim() || 'Full Syllabus'
          : input.subject?.trim() || 'General Studies',
        testCategory === 'full_length' ? null : input.standard?.trim() || null,
        testCategory === 'full_length' ? null : input.unit?.trim() || null,
        testCategory === 'lesson_wise' ? input.lesson?.trim() || null : null,
        totalQ,
        durationMinutes,
        totalMarks,
        marksPerQ,
        negativeMarking,
        input.difficulty || 'Medium',
        status,
        randomizePerAttempt,
        avoidRepeatedQuestions,
        includeIncorrectOnRetake,
        input.startAt ? new Date(input.startAt) : null,
        input.endAt ? new Date(input.endAt) : null,
        status === 'published' ? new Date() : null,
        adminUsername,
      ]
    );

    const created = insertRes.rows[0];
    if (dedupedIds.length > 0) {
      for (let i = 0; i < dedupedIds.length; i++) {
        await client.query(
          `INSERT INTO mock_test_questions (mock_test_id, question_id, question_order, marks)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (mock_test_id, question_id) DO NOTHING`,
          [created.id, dedupedIds[i], i + 1, marksPerQ]
        );
      }
    }

    await client.query('COMMIT');
    notifyPlatformContentUpdate();
    return await getAdminMockTestDetail(created.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateAdminMockTest(id: number, input: MockTestConfigInput) {
  const dedupedIds = Array.from(new Set((input.questionIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0)));
  const groupInfo = normalizeGroupToCategory(input.tnpscGroup);
  const testCategory = normalizeTestCategory(input.testCategory);
  const status = input.status || 'draft';
  const marksPerQ = Number(input.marksPerQuestion) || 1.5;
  const totalQ = Number(input.questionsCount) || dedupedIds.length || 25;
  const totalMarks = Number(input.totalMarks) || Number((totalQ * marksPerQ).toFixed(2));
  const negativeMarking = Number(input.negativeMarking) || 0;
  const durationMinutes = Number(input.durationMinutes) || 30;
  const randomizePerAttempt = Boolean(input.randomizePerAttempt) && testCategory === 'full_length';
  const avoidRepeatedQuestions = input.avoidRepeatedQuestions !== false;
  const includeIncorrectOnRetake = Boolean(input.includeIncorrectOnRetake);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(`SELECT id, published_at FROM mock_tests WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      const err: any = new Error('Mock test not found.');
      err.statusCode = 404;
      throw err;
    }

    await ensureNoDuplicateMockTest(client, input.title, groupInfo.category, testCategory, id);

    if (status === 'published' || status === 'scheduled') {
      await validateForPublish(
        client,
        {
          title: input.title,
          tnpscGroup: groupInfo.tnpscGroup,
          testCategory,
          randomizePerAttempt,
          questionsCount: totalQ,
          durationMinutes,
          totalMarks,
          marksPerQuestion: marksPerQ,
          negativeMarking,
          status,
          startAt: input.startAt,
          endAt: input.endAt,
        },
        dedupedIds
      );
    }

    const publishedAt =
      status === 'published' ? existing.rows[0].published_at || new Date() : existing.rows[0].published_at;

    await client.query(
      `UPDATE mock_tests
       SET title = $1,
           description = $2,
           category = $3,
           category_name = $4,
           tnpsc_group = $5,
           test_category = $6,
           subject = $7,
           standard = $8,
           unit = $9,
           lesson = $10,
           questions_count = $11,
           duration_minutes = $12,
           total_marks = $13,
           marks_per_question = $14,
           negative_marking = $15,
           difficulty = $16,
           status = $17,
           randomize_per_attempt = $18,
           avoid_repeated_questions = $19,
           include_incorrect_on_retake = $20,
           start_at = $21,
           end_at = $22,
           published_at = $23,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $24`,
      [
        input.title.trim(),
        input.description?.trim() || '',
        groupInfo.category,
        groupInfo.categoryName,
        groupInfo.tnpscGroup,
        testCategory,
        testCategory === 'full_length'
          ? input.subject?.trim() || 'Full Syllabus'
          : input.subject?.trim() || 'General Studies',
        testCategory === 'full_length' ? null : input.standard?.trim() || null,
        testCategory === 'full_length' ? null : input.unit?.trim() || null,
        testCategory === 'lesson_wise' ? input.lesson?.trim() || null : null,
        totalQ,
        durationMinutes,
        totalMarks,
        marksPerQ,
        negativeMarking,
        input.difficulty || 'Medium',
        status,
        randomizePerAttempt,
        avoidRepeatedQuestions,
        includeIncorrectOnRetake,
        input.startAt ? new Date(input.startAt) : null,
        input.endAt ? new Date(input.endAt) : null,
        publishedAt,
        id,
      ]
    );

    await client.query(`DELETE FROM mock_test_questions WHERE mock_test_id = $1`, [id]);
    for (let i = 0; i < dedupedIds.length; i++) {
      await client.query(
        `INSERT INTO mock_test_questions (mock_test_id, question_id, question_order, marks)
         VALUES ($1, $2, $3, $4)`,
        [id, dedupedIds[i], i + 1, marksPerQ]
      );
    }

    await client.query('COMMIT');
    notifyPlatformContentUpdate();
    return await getAdminMockTestDetail(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function duplicateAdminMockTest(id: number, adminUsername: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const srcRes = await client.query(`SELECT * FROM mock_tests WHERE id = $1`, [id]);
    if (srcRes.rows.length === 0) {
      const err: any = new Error('Source mock test not found.');
      err.statusCode = 404;
      throw err;
    }
    const src = srcRes.rows[0];
    const newTitle = `${src.title} (Copy)`;
    const newSlug = slugifyTitle(newTitle);

    const insRes = await client.query(
      `INSERT INTO mock_tests (
         slug, title, description, category, category_name, tnpsc_group, test_category,
         subject, standard, unit, lesson,
         questions_count, duration_minutes, total_marks, marks_per_question, negative_marking,
         difficulty, status, randomize_per_attempt, avoid_repeated_questions, include_incorrect_on_retake,
         created_by, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14, $15, $16,
         $17, 'draft', $18, $19, $20,
         $21, CURRENT_TIMESTAMP
       ) RETURNING id`,
      [
        newSlug,
        newTitle,
        src.description || '',
        src.category,
        src.category_name,
        src.tnpsc_group,
        normalizeTestCategory(src.test_category),
        src.subject,
        src.standard,
        src.unit,
        src.lesson || null,
        src.questions_count,
        src.duration_minutes,
        src.total_marks,
        src.marks_per_question,
        src.negative_marking,
        src.difficulty,
        Boolean(src.randomize_per_attempt),
        src.avoid_repeated_questions !== false,
        Boolean(src.include_incorrect_on_retake),
        adminUsername,
      ]
    );
    const newId = insRes.rows[0].id;
    await client.query(
      `INSERT INTO mock_test_questions (mock_test_id, question_id, question_order, marks)
       SELECT $1, question_id, question_order, marks
       FROM mock_test_questions
       WHERE mock_test_id = $2`,
      [newId, id]
    );

    await client.query('COMMIT');
    return await getAdminMockTestDetail(newId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateAdminMockTestStatus(
  id: number,
  nextStatus: MockTestStatus,
  startAt?: string | null,
  endAt?: string | null
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const testRes = await client.query(`SELECT * FROM mock_tests WHERE id = $1`, [id]);
    if (testRes.rows.length === 0) {
      const err: any = new Error('Mock test not found.');
      err.statusCode = 404;
      throw err;
    }
    const row = testRes.rows[0];
    const qRows = await client.query(
      `SELECT question_id FROM mock_test_questions WHERE mock_test_id = $1 ORDER BY question_order ASC`,
      [id]
    );
    const qIds = qRows.rows.map((r) => Number(r.question_id));

    if (nextStatus === 'published' || nextStatus === 'scheduled') {
      await validateForPublish(
        client,
        {
          title: row.title,
          tnpscGroup: row.tnpsc_group || row.category_name || 'Group 1',
          testCategory: normalizeTestCategory(row.test_category),
          randomizePerAttempt: Boolean(row.randomize_per_attempt),
          questionsCount: Number(row.questions_count),
          durationMinutes: Number(row.duration_minutes),
          totalMarks: Number(row.total_marks),
          marksPerQuestion: Number(row.marks_per_question),
          negativeMarking: Number(row.negative_marking),
          status: nextStatus,
          startAt: startAt !== undefined ? startAt : row.start_at,
          endAt: endAt !== undefined ? endAt : row.end_at,
        },
        qIds
      );
    }

    const updated = await client.query(
      `UPDATE mock_tests
       SET status = $1::varchar,
           start_at = COALESCE($2, start_at),
           end_at = COALESCE($3, end_at),
           published_at = CASE WHEN $1::text = 'published' THEN COALESCE(published_at, CURRENT_TIMESTAMP) ELSE published_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [nextStatus, startAt ? new Date(startAt) : null, endAt ? new Date(endAt) : null, id]
    );

    await client.query('COMMIT');
    notifyPlatformContentUpdate();
    return mapAdminMockTestRow(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteAdminMockTest(id: number): Promise<boolean> {
  const res = await pool.query(`DELETE FROM mock_tests WHERE id = $1 RETURNING id`, [id]);
  if (res.rows.length > 0) {
    notifyPlatformContentUpdate();
    return true;
  }
  return false;
}

// ====================================================
// SYLLABUS OPTIONS FOR ADMIN & STUDENT FILTERS
// ====================================================
export async function getSyllabusOptionsForMockTests(filters?: {
  group?: string;
  subject?: string;
  standard?: string;
  unit?: string;
}) {
  const groupMatches = normalizeQuestionCategoryMatch(filters?.group);
  const stdNum = parseStandardNumber(filters?.standard);
  const unitNum = parseUnitNumber(filters?.unit);

  const [subjectsRes, standardsRes, unitsRes, lessonsRes] = await Promise.all([
    pool.query(
      `SELECT DISTINCT TRIM(subject) AS val
       FROM questions
       WHERE status <> 'archived'
         AND subject IS NOT NULL AND TRIM(subject) <> ''
         AND ($1::text[] IS NULL OR LOWER(COALESCE(category, '')) = ANY($1::text[]))
       ORDER BY val ASC`,
      [groupMatches]
    ),
    pool.query(
      `SELECT DISTINCT class_id AS val
       FROM questions
       WHERE status <> 'archived'
         AND class_id BETWEEN 6 AND 12
         AND ($1::text[] IS NULL OR LOWER(COALESCE(category, '')) = ANY($1::text[]))
       ORDER BY val ASC`,
      [groupMatches]
    ),
    pool.query(
      `SELECT DISTINCT unit_id AS val
       FROM questions
       WHERE status <> 'archived'
         AND unit_id IS NOT NULL AND unit_id > 0
         AND ($1::text[] IS NULL OR LOWER(COALESCE(category, '')) = ANY($1::text[]))
       ORDER BY val ASC`,
      [groupMatches]
    ),
    pool.query(
      `SELECT DISTINCT TRIM(lesson_title) AS val
       FROM questions
       WHERE status <> 'archived'
         AND lesson_title IS NOT NULL AND TRIM(lesson_title) <> ''
         AND ($1::text[] IS NULL OR LOWER(COALESCE(category, '')) = ANY($1::text[]))
         AND ($2::text IS NULL OR LOWER(COALESCE(subject, '')) LIKE $2)
         AND ($3::int IS NULL OR class_id = $3)
         AND ($4::int IS NULL OR unit_id = $4)
       ORDER BY val ASC
       LIMIT 200`,
      [
        groupMatches,
        filters?.subject && filters.subject !== 'all' ? `%${filters.subject.trim().toLowerCase()}%` : null,
        stdNum,
        unitNum,
      ]
    ),
  ]);

  return {
    subjects: subjectsRes.rows.map((r) => String(r.val)),
    standards: standardsRes.rows.map((r) => `${r.val}th Standard`),
    units: unitsRes.rows.map((r) => `Unit ${r.val}`),
    lessons: lessonsRes.rows.map((r) => String(r.val)),
  };
}

// ====================================================
// STUDENT PANEL INTEGRATION
// ====================================================
export async function getPublishedMockTestsForStudent(filters?: {
  group?: string;
  testCategory?: string;
}) {
  const where: string[] = [
    `(
      (mt.status = 'published' AND (mt.end_at IS NULL OR mt.end_at >= NOW()))
      OR (
        mt.status = 'scheduled'
        AND (mt.start_at IS NULL OR mt.start_at <= NOW())
        AND (mt.end_at IS NULL OR mt.end_at >= NOW())
      )
    )`,
  ];
  const params: any[] = [];
  let idx = 1;

  if (filters?.group && filters.group !== 'all') {
    const clean = filters.group.trim().toLowerCase();
    if (clean === 'group1' || clean === 'group 1') {
      where.push(`(LOWER(mt.category) = 'group1' OR LOWER(COALESCE(mt.tnpsc_group, '')) = 'group 1')`);
    } else if (clean === 'group2_2a' || clean === 'group 2 & 2a' || clean === 'group 2' || clean === 'group 2a') {
      where.push(
        `(LOWER(mt.category) IN ('group2_2a', 'group2', 'group2a') OR LOWER(COALESCE(mt.tnpsc_group, '')) IN ('group 2', 'group 2a', 'group 2 & 2a'))`
      );
    } else if (clean === 'group4' || clean === 'group4_vao' || clean === 'group 4' || clean === 'group 4 & vao') {
      where.push(
        `(LOWER(mt.category) IN ('group4', 'group4_vao') OR LOWER(COALESCE(mt.tnpsc_group, '')) IN ('group 4', 'group 4 & vao'))`
      );
    }
  }

  if (filters?.testCategory && filters.testCategory !== 'all') {
    where.push(`COALESCE(mt.test_category, 'full_length') = $${idx}`);
    params.push(normalizeTestCategory(filters.testCategory));
    idx++;
  }

  const res = await pool.query(
    `SELECT
       mt.*,
       COALESCE(q_cnt.cnt, 0)::int AS assigned_questions_count,
       COALESCE(a_cnt.attempts, 0)::int AS attempts_count
     FROM mock_tests mt
     LEFT JOIN (
       SELECT mock_test_id, COUNT(*)::int AS cnt
       FROM mock_test_questions
       GROUP BY mock_test_id
     ) q_cnt ON q_cnt.mock_test_id = mt.id
     LEFT JOIN (
       SELECT test_id, COUNT(*)::int AS attempts
       FROM mock_test_attempts
       WHERE COALESCE(assessment_type, 'mock_test') = 'mock_test'
       GROUP BY test_id
     ) a_cnt ON a_cnt.test_id = mt.id::text OR a_cnt.test_id = mt.slug
     WHERE ${where.join(' AND ')}
     ORDER BY COALESCE(mt.published_at, mt.created_at) DESC, mt.id DESC`,
    params
  );

  return res.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || '',
    category: row.category,
    categoryName: row.category_name,
    tnpscGroup: row.tnpsc_group || row.category_name || 'Group 1',
    testCategory: normalizeTestCategory(row.test_category),
    subject: row.subject || 'General Studies',
    standard: row.standard || null,
    unit: row.unit || null,
    lesson: row.lesson || null,
    questionsCount:
      Number(row.assigned_questions_count || 0) > 0 && !row.randomize_per_attempt
        ? Number(row.assigned_questions_count)
        : Number(row.questions_count || 0),
    durationMinutes: Number(row.duration_minutes || 90),
    totalMarks: Number(row.total_marks || Number(row.questions_count || 100) * Number(row.marks_per_question || 1.5)),
    marksPerQuestion: Number(row.marks_per_question || 1.5),
    negativeMarking: Number(row.negative_marking || 0),
    difficulty: row.difficulty || 'Medium',
    status: row.status,
    randomizePerAttempt: Boolean(row.randomize_per_attempt),
    publishedAt: row.published_at || row.created_at,
    attemptsCount: Number(row.attempts_count || 0),
    hasAssignedQuestions: Number(row.assigned_questions_count || 0) > 0,
  }));
}

async function selectFullLengthSyllabusQuestions(mockTest: any, studentId: number) {
  const groupMatches = normalizeQuestionCategoryMatch(mockTest.tnpsc_group || mockTest.category);
  const limit = Math.max(1, Math.min(200, Number(mockTest.questions_count) || 200));
  const avoidRepeated = mockTest.avoid_repeated_questions !== false;
  const includeIncorrect = Boolean(mockTest.include_incorrect_on_retake);

  // Fetch student's previously attempted & incorrect question IDs
  const [qaHistoryRes, mtHistoryRes] = await Promise.all([
    pool.query(
      `SELECT question_id, BOOL_OR(NOT is_correct) AS had_incorrect
       FROM question_attempts
       WHERE student_id = $1 AND question_id IS NOT NULL
       GROUP BY question_id`,
      [studentId]
    ),
    pool.query(
      `SELECT question_responses
       FROM mock_test_attempts
       WHERE student_id = $1 AND COALESCE(assessment_type, 'mock_test') = 'mock_test'
       ORDER BY completed_at DESC
       LIMIT 15`,
      [studentId]
    ),
  ]);

  const seenSet = new Set<number>();
  const incorrectSet = new Set<number>();
  for (const r of qaHistoryRes.rows) {
    const qid = Number(r.question_id);
    if (qid > 0) {
      seenSet.add(qid);
      if (r.had_incorrect) incorrectSet.add(qid);
    }
  }
  for (const r of mtHistoryRes.rows) {
    const resps = Array.isArray(r.question_responses) ? r.question_responses : [];
    for (const item of resps) {
      const qid = Number(item?.questionId);
      if (qid > 0) {
        seenSet.add(qid);
        if (item?.selectedOption !== null && item?.selectedOption !== undefined && !item?.isCorrect) {
          incorrectSet.add(qid);
        }
      }
    }
  }

  // Spread selection across Units, Lessons, and Difficulties (Easy, Medium, Hard)
  const candidatesRes = await pool.query(
    `SELECT
       id, category, unit_id, class_id, subject, lesson_title, topic,
       difficulty, question_text, options
     FROM (
       SELECT
         q.*,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(q.unit_id, 0), LOWER(COALESCE(q.lesson_title, '')), COALESCE(q.difficulty, 'Medium')
           ORDER BY RANDOM()
         ) AS bucket_rank
       FROM questions q
       WHERE q.status = 'published'
         AND COALESCE(q.verification_status, 'verified') <> 'rejected'
         AND q.correct_answer BETWEEN 0 AND 3
         AND ($1::text[] IS NULL OR LOWER(COALESCE(q.category, '')) = ANY($1::text[]))
     ) ranked
     ORDER BY bucket_rank ASC, RANDOM()`,
    [groupMatches]
  );

  const allRows = candidatesRes.rows;
  const picked: any[] = [];
  const pickedIds = new Set<number>();

  const pushUnique = (row: any) => {
    if (picked.length >= limit || pickedIds.has(row.id)) return;
    pickedIds.add(row.id);
    picked.push(row);
  };

  // 1. Optional retake priority: previously incorrect questions
  if (includeIncorrect && incorrectSet.size > 0) {
    for (const row of allRows) {
      if (incorrectSet.has(row.id)) pushUnique(row);
    }
  }

  // 2. Unseen questions across syllabus units/lessons/difficulties
  if (avoidRepeated && seenSet.size > 0) {
    for (const row of allRows) {
      if (!seenSet.has(row.id)) pushUnique(row);
    }
  }

  // 3. Fill remaining slots from approved bank if student has already seen most questions
  for (const row of allRows) {
    pushUnique(row);
  }

  return picked;
}

async function fetchLiveTestQuestionsForStudent(mockTest: any, studentId: number, pinnedSessionQuestionIds?: number[]) {
  // 0. If resuming an existing session with stored question_ids, reload exact order
  if (Array.isArray(pinnedSessionQuestionIds) && pinnedSessionQuestionIds.length > 0) {
    const pinnedRes = await pool.query(
      `SELECT
         q.id, q.category, q.unit_id, q.class_id, q.subject, q.lesson_title, q.topic,
         q.difficulty, q.question_text, q.options
       FROM questions q
       JOIN UNNEST($1::int[]) WITH ORDINALITY AS ord(qid, pos) ON ord.qid = q.id
       ORDER BY ord.pos ASC`,
      [pinnedSessionQuestionIds]
    );
    if (pinnedRes.rows.length > 0) {
      return pinnedRes.rows.map((r, idx) => ({
        id: r.id,
        order: idx + 1,
        category: r.category,
        unitId: r.unit_id,
        classId: r.class_id,
        subject: r.subject || mockTest.subject || 'General Studies',
        lessonTitle: r.lesson_title || mockTest.title,
        topic: r.topic || r.lesson_title || 'General',
        difficulty: r.difficulty || 'Medium',
        question: r.question_text,
        options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options || [],
      }));
    }
  }

  const testCategory = normalizeTestCategory(mockTest.test_category);
  let rows: any[] = [];

  if (testCategory === 'full_length' && Boolean(mockTest.randomize_per_attempt)) {
    rows = await selectFullLengthSyllabusQuestions(mockTest, studentId);
  } else {
    // 1. Prefer explicitly assigned questions from mock_test_questions
    const assignedRes = await pool.query(
      `SELECT
         q.id, q.category, q.unit_id, q.class_id, q.subject, q.lesson_title, q.topic,
         q.difficulty, q.question_text, q.options
       FROM mock_test_questions mtq
       JOIN questions q ON q.id = mtq.question_id
       WHERE mtq.mock_test_id = $1
       ORDER BY mtq.question_order ASC, mtq.id ASC`,
      [mockTest.id]
    );
    rows = assignedRes.rows;

    // 2. Fallback ONLY for legacy seeded mock tests that predate mock_test_questions
    if (rows.length === 0) {
      rows = await selectFullLengthSyllabusQuestions(mockTest, studentId);
    }
  }

  // Never include correct_answer or explanation in the live test payload!
  return rows.map((r, idx) => ({
    id: r.id,
    order: idx + 1,
    category: r.category,
    unitId: r.unit_id,
    classId: r.class_id,
    subject: r.subject || mockTest.subject || 'General Studies',
    lessonTitle: r.lesson_title || mockTest.title,
    topic: r.topic || r.lesson_title || 'General',
    difficulty: r.difficulty || 'Medium',
    question: r.question_text,
    options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options || [],
  }));
}

export async function startStudentMockTestSession(mockTestId: number, studentId: number, isPreview = false) {
  const testRes = await pool.query(
    `SELECT *
     FROM mock_tests
     WHERE id = $1
       AND (
         (status = 'published' AND (end_at IS NULL OR end_at >= NOW()))
         OR (
           status = 'scheduled'
           AND (start_at IS NULL OR start_at <= NOW())
           AND (end_at IS NULL OR end_at >= NOW())
         )
       )`,
    [mockTestId]
  );

  if (testRes.rows.length === 0) {
    const err: any = new Error('This mock test is not currently published or available.');
    err.statusCode = 404;
    throw err;
  }

  const testRow = testRes.rows[0];

  let session: any = {
    id: 0,
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + Number(testRow.duration_minutes || 90) * 60_000).toISOString(),
    answers: {},
    currentQuestionIndex: 0,
  };

  let pinnedQuestionIds: number[] | undefined;

  if (!isPreview) {
    const existingSession = await pool.query(
      `SELECT id, started_at, expires_at, answers, current_question_index, question_ids
       FROM mock_test_sessions
       WHERE mock_test_id = $1 AND student_id = $2 AND status = 'in_progress'
       ORDER BY id DESC
       LIMIT 1`,
      [mockTestId, studentId]
    );

    if (existingSession.rows.length > 0) {
      const s = existingSession.rows[0];
      if (Array.isArray(s.question_ids) && s.question_ids.length > 0) {
        pinnedQuestionIds = s.question_ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0);
      }
      session = {
        id: s.id,
        startedAt: s.started_at,
        expiresAt: s.expires_at,
        answers: s.answers || {},
        currentQuestionIndex: Number(s.current_question_index || 0),
      };
    }
  }

  const questions = await fetchLiveTestQuestionsForStudent(testRow, studentId, pinnedQuestionIds);
  if (questions.length === 0) {
    const err: any = new Error('No published questions are available for this mock test yet.');
    err.statusCode = 400;
    throw err;
  }

  if (!isPreview && session.id === 0) {
    const expiresAt = new Date(Date.now() + Number(testRow.duration_minutes || 90) * 60_000);
    const qIdsPayload = questions.map((q) => q.id);
    const createdSession = await pool.query(
      `INSERT INTO mock_test_sessions (mock_test_id, student_id, status, started_at, expires_at, answers, current_question_index, question_ids)
       VALUES ($1, $2, 'in_progress', CURRENT_TIMESTAMP, $3, '{}'::jsonb, 0, $4::jsonb)
       RETURNING id, started_at, expires_at, answers, current_question_index`,
      [mockTestId, studentId, expiresAt, JSON.stringify(qIdsPayload)]
    );
    const s = createdSession.rows[0];
    session = {
      id: s.id,
      startedAt: s.started_at,
      expiresAt: s.expires_at,
      answers: s.answers || {},
      currentQuestionIndex: 0,
    };
  } else if (!isPreview && session.id > 0 && (!pinnedQuestionIds || pinnedQuestionIds.length === 0)) {
    await pool.query(
      `UPDATE mock_test_sessions SET question_ids = $1::jsonb WHERE id = $2`,
      [JSON.stringify(questions.map((q) => q.id)), session.id]
    );
  }

  return {
    session,
    test: {
      id: testRow.id,
      slug: testRow.slug,
      title: testRow.title,
      description: testRow.description || '',
      category: testRow.category,
      categoryName: testRow.category_name,
      tnpscGroup: testRow.tnpsc_group || testRow.category_name || 'Group 1',
      subject: testRow.subject || 'General Studies',
      questionsCount: questions.length,
      durationMinutes: Number(testRow.duration_minutes || 90),
      totalMarks: Number((questions.length * Number(testRow.marks_per_question || 1.5)).toFixed(2)),
      marksPerQuestion: Number(testRow.marks_per_question || 1.5),
      negativeMarking: Number(testRow.negative_marking || 0),
      difficulty: testRow.difficulty || 'Medium',
    },
    questions,
  };
}

export async function saveStudentMockTestProgress(
  sessionId: number,
  studentId: number,
  answers: Record<string, number>,
  currentQuestionIndex: number
) {
  const res = await pool.query(
    `UPDATE mock_test_sessions
     SET answers = $1::jsonb,
         current_question_index = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND student_id = $4 AND status = 'in_progress'
     RETURNING id, updated_at`,
    [JSON.stringify(answers || {}), Math.max(0, Number(currentQuestionIndex) || 0), sessionId, studentId]
  );
  return res.rows[0] || null;
}

export async function submitStudentMockTest(
  mockTestId: number,
  studentId: number,
  payload: {
    sessionId?: number;
    answers: Record<string, number>;
    timeSpentSeconds?: number;
    submissionToken?: string;
  },
  isPreview = false
) {
  const testRes = await pool.query(`SELECT * FROM mock_tests WHERE id = $1`, [mockTestId]);
  if (testRes.rows.length === 0) {
    const err: any = new Error('Mock test not found.');
    err.statusCode = 404;
    throw err;
  }
  const testRow = testRes.rows[0];
  if (
    !isPreview &&
    !(
      (testRow.status === 'published' && (!testRow.end_at || new Date(testRow.end_at) >= new Date())) ||
      (testRow.status === 'scheduled' &&
        (!testRow.start_at || new Date(testRow.start_at) <= new Date()) &&
        (!testRow.end_at || new Date(testRow.end_at) >= new Date()))
    )
  ) {
    const err: any = new Error('This mock test is not currently published or available for submission.');
    err.statusCode = 403;
    throw err;
  }

  const marksPerQ = Number(testRow.marks_per_question || 1.5);
  const negativeMarking = Number(testRow.negative_marking || 0);

  // Load authoritative questions + answer keys from DB
  // 1. If sessionId has stored question_ids (e.g. randomized Full-length test), grade those exact questions
  let qRes: any = { rows: [] };
  if (payload.sessionId) {
    const sessRes = await pool.query(
      `SELECT question_ids FROM mock_test_sessions WHERE id = $1 AND student_id = $2`,
      [payload.sessionId, studentId]
    );
    const sIds = Array.isArray(sessRes.rows[0]?.question_ids)
      ? sessRes.rows[0].question_ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
      : [];
    if (sIds.length > 0) {
      qRes = await pool.query(
        `SELECT q.id, q.subject, q.topic, q.lesson_title, q.question_text, q.options, q.correct_answer, q.explanation
         FROM questions q
         JOIN UNNEST($1::int[]) WITH ORDINALITY AS ord(qid, pos) ON ord.qid = q.id
         ORDER BY ord.pos ASC`,
        [sIds]
      );
    }
  }

  // 2. Otherwise use mock_test_questions
  if (qRes.rows.length === 0) {
    qRes = await pool.query(
      `SELECT
         q.id, q.subject, q.topic, q.lesson_title, q.question_text, q.options, q.correct_answer, q.explanation
       FROM mock_test_questions mtq
       JOIN questions q ON q.id = mtq.question_id
       WHERE mtq.mock_test_id = $1
       ORDER BY mtq.question_order ASC, mtq.id ASC`,
      [mockTestId]
    );
  }

  // 3. Fallback for legacy seeded mock tests without mock_test_questions
  if (qRes.rows.length === 0) {
    const groupMatches = normalizeQuestionCategoryMatch(testRow.tnpsc_group || testRow.category);
    const limit = Math.max(1, Math.min(200, Number(testRow.questions_count) || 25));
    qRes = await pool.query(
      `SELECT id, subject, topic, lesson_title, question_text, options, correct_answer, explanation
       FROM questions
       WHERE status = 'published'
         AND COALESCE(verification_status, 'verified') <> 'rejected'
         AND ($1::text[] IS NULL OR LOWER(COALESCE(category, '')) = ANY($1::text[]))
       ORDER BY id ASC
       LIMIT $2`,
      [groupMatches, limit]
    );
  }

  const questions: any[] = qRes.rows;
  const answersMap = payload.answers || {};

  let attemptedQuestions = 0;
  let correctAnswers = 0;
  let incorrectAnswers = 0;
  let unansweredQuestions = 0;

  const responses = questions.map((q) => {
    const rawSel = answersMap[String(q.id)];
    const selectedOption =
      rawSel !== undefined && rawSel !== null && Number.isInteger(Number(rawSel)) && Number(rawSel) >= 0
        ? Number(rawSel)
        : null;
    const isAttempted = selectedOption !== null;
    const isCorrect = isAttempted && selectedOption === Number(q.correct_answer);
    if (isAttempted) {
      attemptedQuestions++;
      if (isCorrect) correctAnswers++;
      else incorrectAnswers++;
    } else {
      unansweredQuestions++;
    }

    const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options || [];
    return {
      questionId: q.id,
      questionText: q.question_text,
      options: opts,
      subject: q.subject || testRow.subject || 'General Studies',
      topic: q.topic || q.lesson_title || testRow.title,
      selectedOption,
      correctAnswer: Number(q.correct_answer),
      explanation: q.explanation || '',
      isCorrect,
    };
  });

  const totalQuestions = questions.length;
  const maxScore = Number((totalQuestions * marksPerQ).toFixed(2));
  const rawScore = correctAnswers * marksPerQ - incorrectAnswers * negativeMarking;
  const score = Number(Math.max(0, rawScore).toFixed(2));
  const percentage = totalQuestions > 0 ? Number(((correctAnswers / totalQuestions) * 100).toFixed(2)) : 0;
  const timeSpentSeconds = Math.max(1, Math.round(Number(payload.timeSpentSeconds) || 60));

  if (isPreview) {
    return {
      attemptId: 0,
      testId: String(testRow.id),
      testTitle: testRow.title,
      totalQuestions,
      attemptedQuestions,
      correctAnswers,
      incorrectAnswers,
      unansweredQuestions,
      score,
      maxScore,
      percentage,
      timeSpentSeconds,
      responses,
      preview: true,
    };
  }

  const submitResult = await submitAssessmentAttempt(studentId, {
    testId: String(testRow.id),
    testTitle: testRow.title,
    category: testRow.category,
    assessmentType: 'mock_test',
    subject: testRow.subject || 'General Studies',
    submissionToken: payload.submissionToken,
    totalQuestions,
    attemptedQuestions,
    correctAnswers,
    incorrectAnswers,
    unansweredQuestions,
    score,
    maxScore,
    timeSpentSeconds,
    responses,
  });

  if (payload.sessionId) {
    await pool.query(
      `UPDATE mock_test_sessions
       SET status = 'submitted',
           submitted_at = CURRENT_TIMESTAMP,
           answers = $1::jsonb,
           attempt_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND student_id = $4`,
      [JSON.stringify(answersMap), submitResult.attemptId || null, payload.sessionId, studentId]
    );
  }

  return {
    attemptId: submitResult.attemptId,
    testId: String(testRow.id),
    testTitle: testRow.title,
    totalQuestions,
    attemptedQuestions,
    correctAnswers,
    incorrectAnswers,
    unansweredQuestions,
    score,
    maxScore,
    percentage: submitResult.percentage,
    timeSpentSeconds,
    responses,
    duplicate: Boolean((submitResult as any).duplicate),
  };
}
