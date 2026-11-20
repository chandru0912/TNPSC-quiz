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
  questionLanguage?: 'en' | 'ta' | 'both';
  randomizeOptions?: boolean;
  questionIds: number[];
}

export function normalizeTestCategory(raw?: string | null): MockTestCategory {
  const clean = String(raw || '').trim().toLowerCase();
  if (clean === 'lesson_wise' || clean === 'lesson-wise' || clean === 'lesson') return 'lesson_wise';
  if (clean === 'unit_wise' || clean === 'unit-wise' || clean === 'unit') return 'unit_wise';
  return 'full_length';
}

export function getSubjectAliases(rawSubject?: string | null): string[] | null {
  const clean = String(rawSubject || '').trim().toLowerCase();
  if (!clean || clean === 'all' || clean === 'full syllabus' || clean === 'full-syllabus') return null;
  if (
    clean === 'general-studies' ||
    clean === 'general studies' ||
    clean === 'gs' ||
    clean === 'general science' ||
    clean === 'history' ||
    clean === 'indian polity' ||
    clean === 'geography' ||
    clean === 'economy' ||
    clean === 'unit 8 & unit 9'
  ) {
    return [
      'general-studies',
      'general studies',
      'general science',
      'history',
      'indian polity',
      'geography',
      'economy',
      'unit 8 & unit 9',
    ];
  }
  if (
    clean === 'aptitude' ||
    clean === 'aptitude-and-mental-ability' ||
    clean === 'aptitude and mental ability' ||
    clean === 'aptitude & mental ability' ||
    clean === 'mental ability'
  ) {
    return [
      'aptitude',
      'aptitude-and-mental-ability',
      'aptitude and mental ability',
      'aptitude & mental ability',
      'mental ability',
    ];
  }
  if (clean === 'general-tamil' || clean === 'general tamil' || clean.includes('tamil')) {
    return ['general-tamil', 'general tamil'];
  }
  if (clean === 'general-english' || clean === 'general english' || clean.includes('english')) {
    return ['general-english', 'general english'];
  }
  return [clean];
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
    questionLanguage: (row.question_language as 'en' | 'ta' | 'both') || 'both',
    randomizeOptions: Boolean(row.randomize_options),
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
       q.id, q.category, q.unit_id, q.class_id, q.subject, q.lesson_title, q.topic,
       q.difficulty, q.question_text, q.options, q.correct_answer, q.explanation, q.status
     FROM questions q
     ${whereSql}
     ORDER BY
       CASE WHEN EXISTS (
         SELECT 1
         FROM mock_test_questions mtq
         JOIN mock_tests mt ON mt.id = mtq.mock_test_id
         WHERE mtq.question_id = q.id
           AND COALESCE(mt.status, 'draft') <> 'archived'
           AND mt.test_category = 'unit_wise'
       ) THEN 1 ELSE 0 END ASC,
       RANDOM()
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
    standard?: string | null;
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
    const stdNum = parseStandardNumber(config.standard);
    const bankCheck = await client.query(
      `SELECT COUNT(*)::int AS cnt
       FROM questions
       WHERE status = 'published'
         AND COALESCE(verification_status, 'verified') <> 'rejected'
         AND correct_answer BETWEEN 0 AND 3
         AND ($1::text[] IS NULL OR LOWER(COALESCE(category, '')) = ANY($1::text[]))
         AND ($2::int IS NULL OR class_id = $2 OR standard_id = $2)`,
      [groupMatches, stdNum]
    );
    const eligible = Number(bankCheck.rows[0]?.cnt || 0);
    if (eligible < config.questionsCount) {
      const err: any = new Error(
        `Insufficient published questions for ${config.tnpscGroup}${config.standard ? ` (${config.standard})` : ''}: ${eligible} eligible found, but ${config.questionsCount} required.`
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
  const questionLanguage = input.questionLanguage === 'en' || input.questionLanguage === 'ta' ? input.questionLanguage : 'both';
  const randomizeOptions = Boolean(input.randomizeOptions);

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
          standard: input.standard?.trim() || null,
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
         question_language, randomize_options,
         start_at, end_at, published_at, created_by, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14, $15, $16,
         $17, $18, $19, $20, $21,
         $22, $23,
         $24, $25, $26, $27, CURRENT_TIMESTAMP
       ) RETURNING *`,
      [
        slug,
        input.title.trim(),
        input.description?.trim() || '',
        groupInfo.category,
        groupInfo.categoryName,
        groupInfo.tnpscGroup,
        testCategory,
        input.subject?.trim() || 'General Studies',
        input.standard?.trim() || null,
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
        questionLanguage,
        randomizeOptions,
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
  const questionLanguage = input.questionLanguage === 'en' || input.questionLanguage === 'ta' ? input.questionLanguage : 'both';
  const randomizeOptions = Boolean(input.randomizeOptions);

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
          standard: input.standard?.trim() || null,
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
           question_language = $21,
           randomize_options = $22,
           start_at = $23,
           end_at = $24,
           published_at = $25,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $26`,
      [
        input.title.trim(),
        input.description?.trim() || '',
        groupInfo.category,
        groupInfo.categoryName,
        groupInfo.tnpscGroup,
        testCategory,
        input.subject?.trim() || 'General Studies',
        input.standard?.trim() || null,
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
        questionLanguage,
        randomizeOptions,
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
          standard: row.standard || null,
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
  subject?: string;
  standard?: string;
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

  if (filters?.subject && filters.subject !== 'all') {
    const subjectAliases = getSubjectAliases(filters.subject);
    if (subjectAliases && subjectAliases.length > 0) {
      where.push(`LOWER(COALESCE(mt.subject, '')) = ANY($${idx}::text[])`);
      params.push(subjectAliases);
      idx++;
    }
  }

  if (filters?.standard && filters.standard !== 'all') {
    const stdNum = parseStandardNumber(filters.standard);
    if (stdNum !== null) {
      where.push(`(mt.standard IS NULL OR mt.standard ~ ('(^|[^0-9])' || $${idx}::text || '([^0-9]|$)'))`);
      params.push(String(stdNum));
      idx++;
    }
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
    questionLanguage: (row.question_language as 'en' | 'ta' | 'both') || 'both',
    randomizeOptions: Boolean(row.randomize_options),
    publishedAt: row.published_at || row.created_at,
    attemptsCount: Number(row.attempts_count || 0),
    hasAssignedQuestions: Number(row.assigned_questions_count || 0) > 0,
  }));
}

async function selectFullLengthSyllabusQuestions(mockTest: any, studentId: number) {
  const groupMatches = normalizeQuestionCategoryMatch(mockTest.tnpsc_group || mockTest.category);
  const stdNum = parseStandardNumber(mockTest.standard);
  const subjectAliases = getSubjectAliases(mockTest.subject);
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
         AND ($2::int IS NULL OR q.class_id = $2 OR q.standard_id = $2)
         AND ($3::text[] IS NULL OR LOWER(COALESCE(q.subject, '')) = ANY($3::text[]) OR LOWER(COALESCE(q.subject_id, '')) = ANY($3::text[]))
       ) ranked
       ORDER BY bucket_rank ASC, RANDOM()`,
    [groupMatches, stdNum, subjectAliases]
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

  const parsedStd = testRow.standard != null ? parseInt(String(testRow.standard).replace(/\D+/g, ''), 10) : NaN;
  const parsedUnit = testRow.unit != null ? parseInt(String(testRow.unit).replace(/\D+/g, ''), 10) : NaN;
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
    groupId: testRow.tnpsc_group || testRow.category,
    subjectId: testRow.subject || undefined,
    standardId: !Number.isNaN(parsedStd) ? parsedStd : null,
    unitId: !Number.isNaN(parsedUnit) ? parsedUnit : null,
    lessonTitle: testRow.lesson || null,
    mockTestFormat: normalizeTestCategory(testRow.test_category),
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
    grade: (submitResult as any).grade,
    gradeColor: (submitResult as any).gradeColor,
    awardType: (submitResult as any).awardType,
    timeSpentSeconds,
    responses,
    duplicate: Boolean((submitResult as any).duplicate),
  };
}
// ====================================================
// SYLLABUS-DRIVEN MOCK TESTS (Lesson-wise / Unit-wise / Full-length Standard-wise)
// ====================================================
export async function startSyllabusMockTestSession(params: {
  group: string;
  testCategory: MockTestCategory;
  subject?: string;
  standard?: string | number | null;
  unitId?: number | null;
  lessonId?: string | null;
  lessonTitle?: string | null;
  limit?: number;
  durationMinutes?: number;
  marksPerQuestion?: number;
  negativeMarking?: number;
  title?: string;
}) {
  const groupInfo = normalizeGroupToCategory(params.group);
  const groupMatches = normalizeQuestionCategoryMatch(params.group);
  const testCategory = normalizeTestCategory(params.testCategory);
  const stdNum = parseStandardNumber(params.standard !== undefined && params.standard !== null ? String(params.standard) : null);
  const unitNum = params.unitId && Number(params.unitId) > 0 ? Number(params.unitId) : null;

  const where: string[] = [
    `status = 'published'`,
    `COALESCE(verification_status, 'verified') <> 'rejected'`,
    `correct_answer BETWEEN 0 AND 3`,
  ];
  const queryParams: any[] = [];
  let idx = 1;

  if (groupMatches && groupMatches.length > 0) {
    where.push(`LOWER(COALESCE(category, '')) = ANY($${idx}::text[])`);
    queryParams.push(groupMatches);
    idx++;
  }

  if (testCategory !== 'full_length' && params.subject && params.subject !== 'all' && params.subject !== 'Full Syllabus') {
    const cleanSub = params.subject.trim().toLowerCase();
    if (cleanSub !== 'general-studies') {
      where.push(`(LOWER(COALESCE(subject, '')) LIKE $${idx} OR LOWER(COALESCE(subject_id, '')) = $${idx + 1})`);
      queryParams.push(`%${cleanSub.replace(/-/g, ' ')}%`, cleanSub);
      idx += 2;
    }
  }

  if (stdNum !== null) {
    where.push(`(class_id = $${idx} OR standard_id = $${idx})`);
    queryParams.push(stdNum);
    idx++;
  }

  if (testCategory === 'unit_wise' || testCategory === 'lesson_wise') {
    if (unitNum !== null) {
      where.push(`unit_id = $${idx}`);
      queryParams.push(unitNum);
      idx++;
    }
  }

  if (testCategory === 'lesson_wise') {
    if (params.lessonId && params.lessonTitle) {
      where.push(`(lesson_id = $${idx} OR LOWER(TRIM(COALESCE(lesson_title, ''))) = LOWER(TRIM($${idx + 1})))`);
      queryParams.push(params.lessonId, params.lessonTitle);
      idx += 2;
    } else if (params.lessonId) {
      where.push(`lesson_id = $${idx}`);
      queryParams.push(params.lessonId);
      idx++;
    } else if (params.lessonTitle) {
      where.push(`LOWER(TRIM(COALESCE(lesson_title, ''))) = LOWER(TRIM($${idx}))`);
      queryParams.push(params.lessonTitle);
      idx++;
    }
  }

  const maxLimit = Math.min(200, Math.max(1, Number(params.limit) || (testCategory === 'full_length' ? 200 : 100)));
  const res = await pool.query(
    `SELECT
       id, category, unit_id, class_id, subject, lesson_title, topic,
       difficulty, question_text, options
     FROM questions
     WHERE ${where.join(' AND ')}
     ORDER BY ${testCategory === 'full_length' ? 'RANDOM()' : 'id ASC'}
     LIMIT $${idx}`,
    [...queryParams, maxLimit]
  );

  // Deduplicate by question ID and normalized text
  const seenText = new Set<string>();
  const uniqueRows: any[] = [];
  for (const r of res.rows) {
    const key = `${String(r.question_text || '').trim().toLowerCase()}`;
    if (!seenText.has(key)) {
      seenText.add(key);
      uniqueRows.push(r);
    }
  }

  if (uniqueRows.length === 0) {
    const err: any = new Error('No published questions are available for this selection yet.');
    err.statusCode = 404;
    throw err;
  }

  const marksPerQ = Number(params.marksPerQuestion) || 1.5;
  const negativeMarking = Number(params.negativeMarking) || 0;
  const durationMinutes = Number(params.durationMinutes) || Math.max(15, uniqueRows.length);
  const title =
    params.title?.trim() ||
    (testCategory === 'lesson_wise'
      ? `${params.lessonTitle || 'Lesson'} â€” Mock Test`
      : testCategory === 'unit_wise'
        ? `Unit ${unitNum || ''} â€” Unit Mock Test`
        : `${groupInfo.tnpscGroup} ${stdNum ? `${stdNum}th Standard ` : ''}Full-length Mock Test`);

  return {
    test: {
      id: 0,
      slug: `syllabus-${testCategory}-${Date.now()}`,
      title,
      category: groupInfo.category,
      categoryName: groupInfo.categoryName,
      tnpscGroup: groupInfo.tnpscGroup,
      testCategory,
      subject: params.subject || 'General Studies',
      standard: stdNum ? `${stdNum}th Standard` : null,
      unit: unitNum ? `Unit ${unitNum}` : null,
      lesson: params.lessonTitle || null,
      questionsCount: uniqueRows.length,
      durationMinutes,
      totalMarks: Number((uniqueRows.length * marksPerQ).toFixed(2)),
      marksPerQuestion: marksPerQ,
      negativeMarking,
    },
    questions: uniqueRows.map((r, i) => ({
      id: r.id,
      order: i + 1,
      category: r.category,
      unitId: r.unit_id,
      classId: r.class_id,
      subject: r.subject || params.subject || 'General Studies',
      lessonTitle: r.lesson_title || title,
      topic: r.topic || r.lesson_title || 'General',
      difficulty: r.difficulty || 'Medium',
      question: r.question_text,
      options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options || [],
    })),
  };
}

export async function submitSyllabusMockTest(
  studentId: number,
  payload: {
    testTitle: string;
    group: string;
    testCategory: MockTestCategory;
    subject?: string;
    subjectId?: string;
    standard?: string;
    unit?: string;
    lesson?: string;
    lessonId?: string;
    questionIds: number[];
    answers: Record<string, number>;
    timeSpentSeconds?: number;
    marksPerQuestion?: number;
    negativeMarking?: number;
    submissionToken?: string;
  },
  isPreview = false
) {
  const cleanIds = Array.from(new Set((payload.questionIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0)));
  if (cleanIds.length === 0) {
    const err: any = new Error('No question IDs provided for submission.');
    err.statusCode = 400;
    throw err;
  }

  const qRes = await pool.query(
    `SELECT q.id, q.subject, q.topic, q.lesson_title, q.question_text, q.options, q.correct_answer, q.explanation
     FROM questions q
     JOIN UNNEST($1::int[]) WITH ORDINALITY AS ord(qid, pos) ON ord.qid = q.id
     ORDER BY ord.pos ASC`,
    [cleanIds]
  );

  const questions: any[] = qRes.rows;
  const answersMap = payload.answers || {};
  const marksPerQ = Number(payload.marksPerQuestion) || 1.5;
  const negativeMarking = Number(payload.negativeMarking) || 0;

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
      subject: q.subject || payload.subject || 'General Studies',
      topic: q.topic || q.lesson_title || payload.testTitle,
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
      testTitle: payload.testTitle,
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

  const groupInfo = normalizeGroupToCategory(payload.group);
  const parsedStd = payload.standard ? parseInt(String(payload.standard).replace(/\D+/g, ''), 10) : NaN;
  const parsedUnit = payload.unit ? parseInt(String(payload.unit).replace(/\D+/g, ''), 10) : NaN;
  const normLessonSlug = payload.lesson ? String(payload.lesson).trim().toLowerCase().replace(/\s+/g, '-') : '';
  const syllabusTestId =
    payload.testCategory === 'lesson_wise'
      ? `syllabus-lesson-${groupInfo.category}-${(payload.subject || 'gs').toLowerCase()}-${!Number.isNaN(parsedStd) ? parsedStd : 0}-${!Number.isNaN(parsedUnit) ? parsedUnit : 0}-${normLessonSlug || 'lesson'}`
      : `syllabus-unit-${groupInfo.category}-${(payload.subject || 'gs').toLowerCase()}-${!Number.isNaN(parsedStd) ? parsedStd : 0}-${!Number.isNaN(parsedUnit) ? parsedUnit : 0}`;
  const submitResult = await submitAssessmentAttempt(studentId, {
    testId: syllabusTestId,
    testTitle: payload.testTitle,
    category: groupInfo.category,
    assessmentType: 'mock_test',
    subject: payload.subject || 'General Studies',
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
    groupId: payload.group,
    subjectId: payload.subjectId || payload.subject,
    standardId: !Number.isNaN(parsedStd) ? parsedStd : null,
    unitId: !Number.isNaN(parsedUnit) ? parsedUnit : null,
    lessonId: payload.lessonId || null,
    lessonTitle: payload.lesson || null,
    mockTestFormat: payload.testCategory,
  });

  return {
    attemptId: submitResult.attemptId,
    testTitle: payload.testTitle,
    totalQuestions,
    attemptedQuestions,
    correctAnswers,
    incorrectAnswers,
    unansweredQuestions,
    score,
    maxScore,
    percentage: submitResult.percentage,
    grade: (submitResult as any).grade,
    gradeColor: (submitResult as any).gradeColor,
    awardType: (submitResult as any).awardType,
    attemptNumber: (submitResult as any).attemptNumber,
    timeSpentSeconds,
    responses,
    duplicate: Boolean((submitResult as any).duplicate),
  };
}

// ====================================================
// MOCK TEST MCQ GENERATOR — POOL AVAILABILITY & GENERATION
// ====================================================
export interface GeneratorPoolFilter {
  mode: MockTestCategory;
  group?: string;
  subject?: string;
  standards?: number[];
  units?: number[];
  lesson?: string;
  difficulty?: string;
  questionType?: string;
  language?: string;
  includeStaging?: boolean;
  search?: string;
  excludeIds?: number[];
}

function buildGeneratorPoolWhere(filters: GeneratorPoolFilter): { whereSql: string; params: any[] } {
  const statusClause = filters.includeStaging
    ? `status IN ('published', 'staging')`
    : `status = 'published'`;
  const where: string[] = [
    statusClause,
    `COALESCE(verification_status, 'verified') <> 'rejected'`,
    `correct_answer BETWEEN 0 AND 3`,
  ];
  const params: any[] = [];
  let idx = 1;

  const groupMatches = normalizeQuestionCategoryMatch(filters.group);
  if (groupMatches && groupMatches.length > 0) {
    where.push(`LOWER(COALESCE(category, '')) = ANY($${idx}::text[])`);
    params.push(groupMatches);
    idx++;
  }

  if (filters.subject && filters.subject !== 'all') {
    const aliases = getSubjectAliases(filters.subject);
    if (aliases && aliases.length > 0) {
      where.push(
        `(LOWER(COALESCE(subject, '')) = ANY($${idx}::text[]) OR LOWER(COALESCE(subject_id, '')) = ANY($${idx}::text[]))`
      );
      params.push(aliases);
      idx++;
    }
  }

  const cleanStandards = Array.isArray(filters.standards)
    ? filters.standards.map(Number).filter((n) => Number.isInteger(n) && n >= 6 && n <= 12)
    : [];
  if (cleanStandards.length > 0) {
    // Lesson-wise & Unit-wise strictly enforce a single Standard (never mix 6th/7th/8th)
    const enforcedStandards =
      filters.mode === 'full_length' ? cleanStandards : [cleanStandards[0]];
    where.push(`(class_id = ANY($${idx}::int[]) OR standard_id = ANY($${idx}::int[]))`);
    params.push(enforcedStandards);
    idx++;
  }

  const cleanUnits = Array.isArray(filters.units)
    ? filters.units.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  if (cleanUnits.length > 0) {
    const enforcedUnits = filters.mode === 'full_length' ? cleanUnits : [cleanUnits[0]];
    where.push(`unit_id = ANY($${idx}::int[])`);
    params.push(enforcedUnits);
    idx++;
  }

  // Allow lesson filter in both lesson_wise and optional lesson narrowing in unit_wise
  if (filters.lesson?.trim() && filters.lesson !== 'all') {
    const cleanLesson = filters.lesson.trim().toLowerCase();
    where.push(
      `(LOWER(COALESCE(lesson_title, '')) = $${idx} OR LOWER(COALESCE(lesson_id, '')) = $${idx} OR LOWER(COALESCE(lesson_title, '')) LIKE $${idx + 1})`
    );
    params.push(cleanLesson, `%${cleanLesson}%`);
    idx += 2;
  }

  if (filters.difficulty && filters.difficulty !== 'all') {
    where.push(`LOWER(COALESCE(difficulty, '')) = $${idx}`);
    params.push(filters.difficulty.trim().toLowerCase());
    idx++;
  }

  if (filters.questionType && filters.questionType !== 'all') {
    where.push(`LOWER(COALESCE(target_system, 'main_practice')) = $${idx}`);
    params.push(filters.questionType.trim().toLowerCase());
    idx++;
  }

  if (filters.language && filters.language !== 'all') {
    const lang = filters.language.trim().toLowerCase();
    if (lang === 'tamil' || lang === 'ta') {
      where.push(`(LOWER(COALESCE(language, '')) IN ('tamil', 'ta') OR question_text ~ '[\\u0B80-\\u0BFF]')`);
    } else if (lang === 'english' || lang === 'en') {
      where.push(`(LOWER(COALESCE(language, 'english')) IN ('english', 'en') AND question_text !~ '[\\u0B80-\\u0BFF]')`);
    }
  }

  if (filters.search?.trim()) {
    const rawSearch = filters.search.trim();
    const numericId = /^\d+$/.test(rawSearch) ? Number(rawSearch) : null;
    if (numericId !== null) {
      where.push(`(id = $${idx} OR LOWER(question_text) LIKE $${idx + 1})`);
      params.push(numericId, `%${rawSearch.toLowerCase()}%`);
      idx += 2;
    } else {
      where.push(
        `(LOWER(question_text) LIKE $${idx} OR LOWER(COALESCE(lesson_title, '')) LIKE $${idx} OR LOWER(COALESCE(topic, '')) LIKE $${idx})`
      );
      params.push(`%${rawSearch.toLowerCase()}%`);
      idx++;
    }
  }

  const cleanExclude = Array.isArray(filters.excludeIds)
    ? filters.excludeIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  if (cleanExclude.length > 0) {
    where.push(`NOT (id = ANY($${idx}::int[]))`);
    params.push(cleanExclude);
    idx++;
  }

  return { whereSql: `WHERE ${where.join(' AND ')}`, params };
}

export async function getGeneratorPoolAvailability(filters: GeneratorPoolFilter) {
  const { whereSql, params } = buildGeneratorPoolWhere(filters);
  const res = await pool.query(
    `SELECT
       COALESCE(standard_id, class_id) AS std_id,
       unit_id,
       COALESCE(NULLIF(TRIM(lesson_title), ''), 'General') AS lesson_title,
       COALESCE(difficulty, 'Medium') AS difficulty,
       COUNT(*)::int AS cnt
     FROM questions
     ${whereSql}
     GROUP BY 1, 2, 3, 4
     ORDER BY 1 ASC NULLS LAST, 2 ASC NULLS LAST, 3 ASC`,
    params
  );

  let totalAvailable = 0;
  const byDifficulty: Record<'Easy' | 'Medium' | 'Hard', number> = { Easy: 0, Medium: 0, Hard: 0 };
  const lessonMap = new Map<string, { lessonTitle: string; standardId: number | null; unitId: number | null; count: number }>();
  const stdMap = new Map<number, number>();

  for (const r of res.rows) {
    const count = Number(r.cnt || 0);
    totalAvailable += count;
    const diff = String(r.difficulty || 'Medium');
    if (diff === 'Easy') byDifficulty.Easy += count;
    else if (diff === 'Hard') byDifficulty.Hard += count;
    else byDifficulty.Medium += count;

    const stdId = r.std_id != null ? Number(r.std_id) : null;
    const unitId = r.unit_id != null ? Number(r.unit_id) : null;
    if (stdId != null) {
      stdMap.set(stdId, (stdMap.get(stdId) || 0) + count);
    }
    const lKey = `${stdId ?? 0}::${unitId ?? 0}::${String(r.lesson_title).toLowerCase()}`;
    const existing = lessonMap.get(lKey);
    if (existing) {
      existing.count += count;
    } else {
      lessonMap.set(lKey, {
        lessonTitle: String(r.lesson_title),
        standardId: stdId,
        unitId,
        count,
      });
    }
  }

  return {
    totalAvailable,
    byDifficulty,
    byLesson: Array.from(lessonMap.values()),
    byStandard: Array.from(stdMap.entries())
      .map(([standardId, count]) => ({ standardId, count }))
      .sort((a, b) => a.standardId - b.standardId),
  };
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function generateMockTestQuestionPool(input: GeneratorPoolFilter & {
  totalQuestions: number;
  difficultyDistribution?: { easyPct?: number; mediumPct?: number; hardPct?: number };
  standardDistribution?: Record<number, number>;
  distributeAcrossLessons?: boolean;
  distributeAcrossStandards?: boolean;
  randomizeSelection?: boolean;
  randomizeOrder?: boolean;
}) {
  const requestedCount = Math.max(1, Math.min(200, Number(input.totalQuestions) || 25));
  const { whereSql, params } = buildGeneratorPoolWhere({
    mode: input.mode,
    group: input.group,
    subject: input.subject,
    standards: input.standards,
    units: input.units,
    lesson: input.lesson,
    difficulty: input.difficulty,
    questionType: input.questionType,
    language: input.language,
    includeStaging: input.includeStaging,
    search: input.search,
    excludeIds: input.excludeIds,
  });

  const rowsRes = await pool.query(
    `SELECT
       id, category, unit_id, COALESCE(standard_id, class_id) AS class_id,
       subject, lesson_title, topic, difficulty, question_text, options,
       correct_answer, explanation, status
     FROM questions
     ${whereSql}
     ORDER BY id ASC`,
    params
  );

  const allCandidates = rowsRes.rows.map((r) => ({
    id: Number(r.id),
    category: r.category,
    unitId: r.unit_id != null ? Number(r.unit_id) : null,
    classId: r.class_id != null ? Number(r.class_id) : null,
    subject: r.subject || 'General Studies',
    lessonTitle: r.lesson_title || 'General',
    topic: r.topic || null,
    difficulty: (r.difficulty === 'Easy' || r.difficulty === 'Hard' ? r.difficulty : 'Medium') as 'Easy' | 'Medium' | 'Hard',
    question: r.question_text,
    options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options || [],
    correctAnswer: Number(r.correct_answer),
    explanation: r.explanation || '',
    status: r.status || 'published',
  }));

  if (allCandidates.length < requestedCount) {
    const err: any = new Error(
      `Insufficient questions in Question Bank: only ${allCandidates.length} eligible question${allCandidates.length === 1 ? '' : 's'} match the selected syllabus scope, but ${requestedCount} were requested.`
    );
    err.statusCode = 400;
    err.eligibleCount = allCandidates.length;
    throw err;
  }

  const randomizeSel = input.randomizeSelection !== false;
  const poolItems = randomizeSel ? shuffleArray(allCandidates) : allCandidates;
  const picked: typeof allCandidates = [];
  const pickedIds = new Set<number>();

  const takeOne = (item: (typeof allCandidates)[number]) => {
    if (picked.length >= requestedCount || pickedIds.has(item.id)) return false;
    pickedIds.add(item.id);
    picked.push(item);
    return true;
  };

  // Helper: round-robin selection across a grouping key (lesson or standard/unit)
  const pickRoundRobin = (items: typeof allCandidates, targetCount: number, keyFn: (it: (typeof allCandidates)[number]) => string) => {
    const buckets = new Map<string, typeof allCandidates>();
    for (const it of items) {
      if (pickedIds.has(it.id)) continue;
      const k = keyFn(it);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(it);
    }
    const keys = randomizeSel ? shuffleArray(Array.from(buckets.keys())) : Array.from(buckets.keys());
    let added = 0;
    let progress = true;
    while (added < targetCount && picked.length < requestedCount && progress) {
      progress = false;
      for (const k of keys) {
        if (added >= targetCount || picked.length >= requestedCount) break;
        const list = buckets.get(k);
        if (list && list.length > 0) {
          const nextItem = list.shift()!;
          if (takeOne(nextItem)) {
            added++;
            progress = true;
          }
        }
      }
    }
  };

  const useDifficultySplit =
    (!input.difficulty || input.difficulty === 'all') &&
    input.difficultyDistribution &&
    ((Number(input.difficultyDistribution.easyPct) || 0) +
      (Number(input.difficultyDistribution.mediumPct) || 0) +
      (Number(input.difficultyDistribution.hardPct) || 0)) > 0;

  const bucketKeyFn =
    input.mode === 'unit_wise' && input.distributeAcrossLessons
      ? (it: (typeof allCandidates)[number]) => String(it.lessonTitle || 'General').toLowerCase()
      : input.mode === 'full_length' && input.distributeAcrossStandards
        ? (it: (typeof allCandidates)[number]) => `${it.classId ?? 0}::${it.unitId ?? 0}`
        : null;

  // Optional per-Standard explicit quota distribution for Full-length Mock Tests
  if (input.mode === 'full_length' && input.standardDistribution && typeof input.standardDistribution === 'object') {
    const entries = Object.entries(input.standardDistribution)
      .map(([stdKey, qCount]) => [Number(stdKey), Math.max(0, Number(qCount) || 0)] as [number, number])
      .filter(([stdNum, qCount]) => Number.isInteger(stdNum) && stdNum >= 6 && stdNum <= 12 && qCount > 0);

    for (const [stdNum, quota] of entries) {
      const stdPool = poolItems.filter((q) => q.classId === stdNum);
      let takenForStd = 0;
      for (const item of stdPool) {
        if (takenForStd >= quota || picked.length >= requestedCount) break;
        if (takeOne(item)) takenForStd++;
      }
    }
  }

  if (useDifficultySplit && input.difficultyDistribution) {
    const easyPct = Math.max(0, Number(input.difficultyDistribution.easyPct) || 0);
    const mediumPct = Math.max(0, Number(input.difficultyDistribution.mediumPct) || 0);
    const hardPct = Math.max(0, Number(input.difficultyDistribution.hardPct) || 0);
    const pctSum = easyPct + mediumPct + hardPct;
    const easyTarget = Math.round((easyPct / pctSum) * requestedCount);
    const mediumTarget = Math.round((mediumPct / pctSum) * requestedCount);
    const hardTarget = Math.max(0, requestedCount - easyTarget - mediumTarget);

    const targets: Array<['Easy' | 'Medium' | 'Hard', number]> = [
      ['Easy', easyTarget],
      ['Medium', mediumTarget],
      ['Hard', hardTarget],
    ];
    for (const [diff, target] of targets) {
      if (target <= 0) continue;
      const matchingDiff = poolItems.filter((q) => q.difficulty === diff);
      if (bucketKeyFn) {
        pickRoundRobin(matchingDiff, target, bucketKeyFn);
      } else {
        let count = 0;
        for (const item of matchingDiff) {
          if (count >= target) break;
          if (takeOne(item)) count++;
        }
      }
    }
  }

  // Fill remaining slots (with balanced round-robin if enabled)
  if (picked.length < requestedCount) {
    if (bucketKeyFn) {
      pickRoundRobin(poolItems, requestedCount - picked.length, bucketKeyFn);
    } else {
      for (const item of poolItems) {
        if (picked.length >= requestedCount) break;
        takeOne(item);
      }
    }
  }

  const finalQuestions = input.randomizeOrder !== false ? shuffleArray(picked) : picked;

  return {
    eligibleCount: allCandidates.length,
    selectedCount: finalQuestions.length,
    questions: finalQuestions,
  };
}

export async function getGeneratorQuestionBankList(
  filters: GeneratorPoolFilter & { limit?: number; offset?: number }
) {
  const { whereSql, params } = buildGeneratorPoolWhere(filters);
  const limit = Math.min(100, Math.max(5, Number(filters.limit) || 20));
  const offset = Math.max(0, Number(filters.offset) || 0);
  const nextIdx = params.length + 1;

  const [countRes, rowsRes] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total FROM questions ${whereSql}`, params),
    pool.query(
      `SELECT
         id, category, unit_id, COALESCE(standard_id, class_id) AS class_id,
         subject, lesson_title, topic, difficulty, question_text, options,
         correct_answer, explanation, status,
         COALESCE(language, 'english') AS language,
         COALESCE(target_system, 'main_practice') AS target_system
       FROM questions
       ${whereSql}
       ORDER BY id DESC
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      [...params, limit, offset]
    ),
  ]);

  return {
    total: Number(countRes.rows[0]?.total || 0),
    questions: rowsRes.rows.map((r) => ({
      id: Number(r.id),
      category: r.category,
      unitId: r.unit_id != null ? Number(r.unit_id) : null,
      classId: r.class_id != null ? Number(r.class_id) : null,
      subject: r.subject || 'General Studies',
      lessonTitle: r.lesson_title || 'General',
      topic: r.topic || null,
      difficulty: (r.difficulty === 'Easy' || r.difficulty === 'Hard' ? r.difficulty : 'Medium') as 'Easy' | 'Medium' | 'Hard',
      question: r.question_text,
      options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options || [],
      correctAnswer: Number(r.correct_answer),
      explanation: r.explanation || '',
      status: r.status || 'published',
      language: r.language || 'english',
      targetSystem: r.target_system || 'main_practice',
    })),
  };
}

export async function validateSelectedMockTestQuestions(
  questionIds: number[],
  includeStaging = false
) {
  const rawIds = Array.isArray(questionIds) ? questionIds.map(Number) : [];
  const seen = new Set<number>();
  const duplicateIds: number[] = [];
  const uniqueIds: number[] = [];

  for (const id of rawIds) {
    if (!Number.isInteger(id) || id <= 0) continue;
    if (seen.has(id)) {
      duplicateIds.push(id);
    } else {
      seen.add(id);
      uniqueIds.push(id);
    }
  }

  if (uniqueIds.length === 0) {
    return {
      valid: false,
      uniqueCount: 0,
      duplicateIds,
      missingIds: [],
      invalidIds: [],
      message: 'Please select at least 1 valid question from the Question Bank.',
    };
  }

  const res = await pool.query(
    `SELECT id, status, COALESCE(verification_status, 'verified') AS verification_status, correct_answer
     FROM questions
     WHERE id = ANY($1::int[])`,
    [uniqueIds]
  );

  const byId = new Map<number, any>();
  for (const r of res.rows) byId.set(Number(r.id), r);

  const missingIds: number[] = [];
  const invalidIds: number[] = [];
  const allowedStatuses = includeStaging ? ['published', 'staging'] : ['published'];

  for (const id of uniqueIds) {
    const row = byId.get(id);
    if (!row) {
      missingIds.push(id);
    } else if (
      !allowedStatuses.includes(String(row.status || '').toLowerCase()) ||
      String(row.verification_status || '').toLowerCase() === 'rejected' ||
      Number(row.correct_answer) < 0 ||
      Number(row.correct_answer) > 3
    ) {
      invalidIds.push(id);
    }
  }

  const valid = duplicateIds.length === 0 && missingIds.length === 0 && invalidIds.length === 0;
  return {
    valid,
    uniqueCount: uniqueIds.length,
    duplicateIds,
    missingIds,
    invalidIds,
    message: valid
      ? `All ${uniqueIds.length} selected questions are verified and unique.`
      : `Validation issues: ${duplicateIds.length} duplicates, ${missingIds.length} missing, ${invalidIds.length} ineligible.`,
  };
}
