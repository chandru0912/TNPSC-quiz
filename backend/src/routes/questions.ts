import { Router, Request, Response } from 'express';
import { PoolClient } from 'pg';
import pool from '../db';
import { requireAdminAuth, verifyAdminToken } from '../middleware/auth';
import {
  isSemanticallyDuplicate,
  isValidQuestionText,
  resolveCorrectAnswerIndex,
  ExistingDbQuestionRecord,
} from '../services/questionValidator';

const router = Router();

export interface QuestionDTO {
  id: number;
  category: string;
  unitId: number;
  classId: number | null;
  subject: string;
  lessonTitle: string;
  lessonId?: string | null;
  targetSystem?: 'study_materials' | 'main_practice';
  language?: string;
  examGroupId?: string | null;
  subjectId?: string | null;
  standardId?: number | null;
  topic: string | null;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tag: string;
  question: string;
  options: string[];
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer: number;
  explanation: string;
  sourceReference: string | null;
  status: 'staging' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  textbookId?: number | null;
  sourcePage?: number | null;
  verificationStatus?: 'verified' | 'needs_review' | 'rejected';
}

// Convert DB row to camelCase frontend-friendly QuestionDTO
export function mapRowToQuestion(row: any): QuestionDTO {
  const parsedOptions = typeof row.options === 'string' ? JSON.parse(row.options) : (row.options || []);
  return {
    id: row.id,
    category: row.category,
    unitId: row.unit_id,
    classId: row.class_id,
    subject: row.subject,
    lessonTitle: row.lesson_title,
    lessonId: row.lesson_id || null,
    targetSystem: row.target_system || 'main_practice',
    language: row.language || 'tamil',
    examGroupId: row.exam_group_id || row.category,
    subjectId: row.subject_id || null,
    standardId: row.standard_id || row.class_id,
    topic: row.topic,
    difficulty: row.difficulty,
    tag: row.tag || `Group 1 • Unit ${row.unit_id}: ${row.subject}`,
    question: row.question_text,
    options: parsedOptions,
    optionA: row.option_a || parsedOptions[0] || '',
    optionB: row.option_b || parsedOptions[1] || '',
    optionC: row.option_c || parsedOptions[2] || '',
    optionD: row.option_d || parsedOptions[3] || '',
    correctAnswer: row.correct_answer,
    explanation: row.explanation,
    sourceReference: row.source_reference,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    textbookId: row.textbook_id || null,
    sourcePage: row.source_page || null,
    verificationStatus: row.verification_status || 'needs_review',
  };
}

/**
 * GET /api/questions (Public Endpoint for Students)
 * Filter by: category, unitId, classId, lesson, status, limit, offset
 * Defaults to status='published' so staging questions are never exposed to students.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, unitId, classId, lesson, lessonId, topic, subject, status, limit = '200', offset = '0' } = req.query;

    const targetSystem = req.query.target_system as string | undefined;
    const queryConditions: string[] = [];
    if (targetSystem === 'study_materials') {
      queryConditions.push("target_system = 'study_materials'");
    } else if (targetSystem === 'main_practice') {
      queryConditions.push("(target_system = 'main_practice' OR target_system IS NULL)");
    }
    // If targetSystem is not specified or 'all', students have access to all published practice questions
    const values: any[] = [];
    let paramIndex = 1;

    // Strict Category / Group Filtering:
    // Prevents question leakage so students see only questions for their exact selected Group.
    if (category && typeof category === 'string' && category !== 'all') {
      const cleanCat = category.trim().toLowerCase();
      if (cleanCat === 'group2_2a' || cleanCat === 'group2' || cleanCat === 'group2a') {
        queryConditions.push(`category IN ('group2', 'group2a', 'group2_2a')`);
      } else if (cleanCat === 'group4_vao' || cleanCat === 'group4' || cleanCat === 'vao') {
        queryConditions.push(`category IN ('group4', 'vao', 'group4_vao')`);
      } else {
        queryConditions.push(`category = $${paramIndex++}`);
        values.push(cleanCat);
      }
    }

    if (unitId && !isNaN(Number(unitId))) {
      queryConditions.push(`unit_id = $${paramIndex++}`);
      values.push(Number(unitId));
    }

    if (classId && !isNaN(Number(classId))) {
      // If a specific lesson search is also provided, allow matching questions mapped to this class OR without explicit classId
      if ((lesson && typeof lesson === 'string' && lesson.trim().length > 0) || (lessonId && typeof lessonId === 'string' && lessonId.trim().length > 0)) {
        queryConditions.push(`(class_id = $${paramIndex} OR class_id IS NULL)`);
        values.push(Number(classId));
        paramIndex++;
      } else {
        queryConditions.push(`class_id = $${paramIndex++}`);
        values.push(Number(classId));
      }
    }

    if (subject && typeof subject === 'string' && subject.trim() !== '' && subject.toLowerCase() !== 'general-studies' && subject.toLowerCase() !== 'all') {
      queryConditions.push(`LOWER(subject) = $${paramIndex++}`);
      values.push(subject.trim().toLowerCase());
    }

    // Strict Lesson Mapping:
    // If lessonId is provided, query strictly by lesson_id (or exact lesson_title if legacy row)
    // If only lesson (title) is provided, match by exact lesson_title (case-insensitive, trimmed)
    // NEVER use loose keyword/substring matching which causes questions from one lesson to leak into others!
    const cleanLessonId = lessonId && typeof lessonId === 'string' && lessonId.trim() !== 'all' ? lessonId.trim() : null;
    const cleanLesson = lesson && typeof lesson === 'string' && lesson.trim() !== 'all' ? lesson.trim() : null;

    if (cleanLessonId && cleanLesson) {
      queryConditions.push(`(lesson_id = $${paramIndex} OR (lesson_id IS NULL AND LOWER(TRIM(lesson_title)) = LOWER(TRIM($${paramIndex + 1}))))`);
      values.push(cleanLessonId);
      values.push(cleanLesson);
      paramIndex += 2;
    } else if (cleanLessonId) {
      queryConditions.push(`lesson_id = $${paramIndex++}`);
      values.push(cleanLessonId);
    } else if (cleanLesson) {
      queryConditions.push(`LOWER(TRIM(lesson_title)) = LOWER(TRIM($${paramIndex++}))`);
      values.push(cleanLesson);
    }

    // Strict Topic Filtering:
    if (topic && typeof topic === 'string' && topic.trim().length > 0 && topic.toLowerCase() !== 'all') {
      queryConditions.push(`(LOWER(topic) = $${paramIndex} OR LOWER(topic) LIKE $${paramIndex + 1})`);
      values.push(topic.trim().toLowerCase());
      values.push(`%${topic.trim().toLowerCase()}%`);
      paramIndex += 2;
    }

    // Strict Publishing Visibility (Requirements 6 & 11):
    // Non-admin (students) can ONLY see 'published' content.
    // Draft, staging, and unpublished content are strictly hidden from students.
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const isAdmin = token ? !!verifyAdminToken(token) : false;

    if (!isAdmin) {
      queryConditions.push("status = 'published'");
    } else if (status && typeof status === 'string' && status !== 'all') {
      queryConditions.push(`status = $${paramIndex++}`);
      values.push(status);
    } else if (!status) {
      queryConditions.push(`status IN ('published', 'staging')`);
    }

    const whereClause = queryConditions.length > 0 ? `WHERE ${queryConditions.join(' AND ')}` : '';
    const safeLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || 100), 500);
    const safeOffset = Math.max(0, parseInt(offset as string, 10) || 0);

    const countQuery = `SELECT COUNT(*) AS total FROM questions ${whereClause}`;
    const totalResult = await pool.query(countQuery, values);
    const totalCount = parseInt(totalResult.rows[0].total, 10);

    const dataQuery = `
      SELECT * FROM questions 
      ${whereClause} 
      ORDER BY id ASC 
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const dataValues = [...values, safeLimit, safeOffset];
    const dataResult = await pool.query(dataQuery, dataValues);

    const questions = dataResult.rows.map(mapRowToQuestion);

    res.status(200).json({
      status: 'success',
      total: totalCount,
      count: questions.length,
      limit: safeLimit,
      offset: safeOffset,
      data: questions,
    });
  } catch (error: any) {
    console.error('Error fetching questions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve questions from database',
      error: error.message,
    });
  }
});

/**
 * Helper: Apply syllabus Subject filter condition to SQL query
 * Supports both subject IDs ('general-studies', 'aptitude', 'general-english', 'general-tamil')
 * and display names ('General Studies', 'Aptitude and Mental Ability', 'General English', 'General Tamil', etc.)
 */
function applySubjectFilterCondition(
  rawSubject: unknown,
  queryConditions: string[],
  values: any[],
  paramIndex: number
): number {
  if (!rawSubject || typeof rawSubject !== 'string') return paramIndex;
  const norm = rawSubject.trim().toLowerCase();
  if (!norm || norm === 'all') return paramIndex;

  if (norm === 'general-studies' || norm === 'general studies') {
    queryConditions.push(
      `LOWER(TRIM(subject)) IN ('general studies', 'general-studies', 'general science', 'geography', 'history & inm', 'indian polity', 'economy & tn admin', 'tamil nadu heritage', 'science', 'social science')`
    );
  } else if (
    norm === 'aptitude' ||
    norm === 'aptitude and mental ability' ||
    norm === 'aptitude & mental ability'
  ) {
    queryConditions.push(
      `(LOWER(TRIM(subject)) IN ('aptitude', 'aptitude and mental ability', 'aptitude & mental ability') OR LOWER(subject) LIKE '%aptitude%')`
    );
  } else if (norm === 'general-english' || norm === 'general english') {
    queryConditions.push(
      `(LOWER(TRIM(subject)) IN ('general-english', 'general english', 'english') OR LOWER(subject) LIKE '%english%')`
    );
  } else if (
    norm === 'general-tamil' ||
    norm === 'general tamil' ||
    norm.includes('tamil') ||
    norm.includes('தமிழ்')
  ) {
    queryConditions.push(
      `(LOWER(TRIM(subject)) IN ('general-tamil', 'general tamil', 'tamil', 'பொதுத் தமிழ்', 'பொதுத்தமிழ்') OR LOWER(subject) LIKE '%tamil%' OR subject LIKE '%தமிழ்%')`
    );
  } else {
    queryConditions.push(`LOWER(TRIM(subject)) = $${paramIndex++}`);
    values.push(norm);
  }
  return paramIndex;
}

/**
 * Helper: Apply syllabus Lesson Title filter condition to SQL query
 */
function applyLessonFilterCondition(
  rawLesson: unknown,
  queryConditions: string[],
  values: any[],
  paramIndex: number
): number {
  if (!rawLesson || typeof rawLesson !== 'string') return paramIndex;
  const trimmed = rawLesson.trim();
  if (!trimmed || trimmed.toLowerCase() === 'all') return paramIndex;

  queryConditions.push(`LOWER(TRIM(lesson_title)) = LOWER(TRIM($${paramIndex++}))`);
  values.push(trimmed);
  return paramIndex;
}

/**
 * GET /api/questions/admin (Protected Admin Endpoint)
 * Full management search and filter across ID, question_text, group (category), subject, standard (classId), unit (unitId), lessonTitle, status, difficulty
 * Returns total, stagingCount, publishedCount metrics
 */
router.get('/admin', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const {
      search,
      unitId,
      classId,
      subject,
      lessonTitle,
      lesson,
      lessonId,
      status,
      difficulty,
      category,
      topic,
      limit = '50',
      offset = '0',
    } = req.query;

    const targetSystem = req.query.target_system as string | undefined;
    const queryConditions: string[] = [];
    if (targetSystem === 'study_materials') {
      queryConditions.push("target_system = 'study_materials'");
    } else if (targetSystem === 'all') {
      // no target_system restriction - view all questions across the platform
    } else {
      queryConditions.push("(target_system = 'main_practice' OR target_system IS NULL)");
    }
    const values: any[] = [];
    let paramIndex = 1;

    // 1. Filter by TNPSC Group (category)
    if (category && typeof category === 'string' && category !== 'all') {
      const lowerCat = category.trim().toLowerCase();
      if (lowerCat === 'group2_2a' || lowerCat === 'group2' || lowerCat === 'group2a') {
        queryConditions.push(`LOWER(category) IN ('group2', 'group2a', 'group2_2a')`);
      } else if (lowerCat === 'group4' || lowerCat === 'vao' || lowerCat === 'group4_vao') {
        queryConditions.push(`LOWER(category) IN ('group4', 'vao', 'group4_vao')`);
      } else {
        queryConditions.push(`LOWER(category) = $${paramIndex++}`);
        values.push(lowerCat);
      }
    }

    // 2. Filter by Subject Selection
    paramIndex = applySubjectFilterCondition(subject, queryConditions, values, paramIndex);

    // 3. Filter by Standard (classId)
    if (classId && classId !== 'all' && !isNaN(Number(classId))) {
      queryConditions.push(`class_id = $${paramIndex++}`);
      values.push(Number(classId));
    }

    // 4. Filter by Unit (unitId)
    if (unitId && unitId !== 'all' && !isNaN(Number(unitId))) {
      queryConditions.push(`unit_id = $${paramIndex++}`);
      values.push(Number(unitId));
    }

    // 5. Filter by Lesson ID and Lesson Title (resilient matching)
    const cleanLessonId = lessonId && typeof lessonId === 'string' && lessonId.trim() && lessonId.trim() !== 'all' ? lessonId.trim() : null;
    const cleanLessonTitle = (lessonTitle || lesson) as string | undefined;
    const cleanTitle = cleanLessonTitle && typeof cleanLessonTitle === 'string' && cleanLessonTitle.trim() && cleanLessonTitle.trim() !== 'all' ? cleanLessonTitle.trim() : null;

    if (cleanLessonId && cleanTitle) {
      queryConditions.push(`(lesson_id = $${paramIndex} OR LOWER(TRIM(lesson_title)) = LOWER(TRIM($${paramIndex + 1})) OR LOWER(lesson_title) LIKE $${paramIndex + 2})`);
      values.push(cleanLessonId);
      values.push(cleanTitle);
      values.push(`%${cleanTitle.slice(0, 30)}%`);
      paramIndex += 3;
    } else if (cleanLessonId) {
      queryConditions.push(`(lesson_id = $${paramIndex} OR LOWER(lesson_title) LIKE $${paramIndex + 1})`);
      values.push(cleanLessonId);
      values.push(`%${cleanLessonId}%`);
      paramIndex += 2;
    } else if (cleanTitle) {
      queryConditions.push(`(LOWER(TRIM(lesson_title)) = LOWER(TRIM($${paramIndex})) OR LOWER(lesson_title) LIKE $${paramIndex + 1})`);
      values.push(cleanTitle);
      values.push(`%${cleanTitle.slice(0, 30)}%`);
      paramIndex += 2;
    }

    // Filter by topic
    if (topic && typeof topic === 'string' && topic.trim() && topic !== 'all') {
      queryConditions.push(`LOWER(topic) LIKE $${paramIndex++}`);
      values.push(`%${topic.trim().toLowerCase()}%`);
    }

    // Search by ID or text match
    if (search && typeof search === 'string' && search.trim()) {
      const trimmed = search.trim();
      if (!isNaN(Number(trimmed))) {
        queryConditions.push(`(id = $${paramIndex} OR LOWER(question_text) LIKE $${paramIndex + 1} OR LOWER(lesson_title) LIKE $${paramIndex + 1})`);
        values.push(Number(trimmed));
        values.push(`%${trimmed.toLowerCase()}%`);
        paramIndex += 2;
      } else {
        queryConditions.push(`(LOWER(question_text) LIKE $${paramIndex} OR LOWER(lesson_title) LIKE $${paramIndex} OR LOWER(subject) LIKE $${paramIndex} OR LOWER(topic) LIKE $${paramIndex})`);
        values.push(`%${trimmed.toLowerCase()}%`);
        paramIndex++;
      }
    }

    if (status && typeof status === 'string' && status !== 'all') {
      queryConditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (difficulty && typeof difficulty === 'string' && difficulty !== 'all') {
      queryConditions.push(`difficulty = $${paramIndex++}`);
      values.push(difficulty);
    }

    const whereClause = queryConditions.length > 0 ? `WHERE ${queryConditions.join(' AND ')}` : '';
    const safeLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || 50), 200);
    const safeOffset = Math.max(0, parseInt(offset as string, 10) || 0);

    // Dynamic Metrics matching target system
    const metricsWhere = targetSystem === 'study_materials'
      ? "target_system = 'study_materials'"
      : targetSystem === 'main_practice'
      ? "(target_system = 'main_practice' OR target_system IS NULL)"
      : "1=1";

    const metricsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'staging' THEN 1 END) as staging_count,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
        COUNT(CASE WHEN verification_status = 'needs_review' OR verification_status IS NULL THEN 1 END) as pending_review_count,
        COUNT(DISTINCT unit_id) as units_count,
        COUNT(DISTINCT class_id) as classes_count
      FROM questions
      WHERE ${metricsWhere};
    `);
    const metrics = metricsResult.rows[0];

    // Filtered count
    const countQuery = `SELECT COUNT(*) AS filtered_total FROM questions ${whereClause}`;
    const countResult = await pool.query(countQuery, values);
    const filteredTotal = parseInt(countResult.rows[0].filtered_total, 10);

    // Filtered data
    const dataQuery = `
      SELECT * FROM questions 
      ${whereClause} 
      ORDER BY id DESC 
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const dataValues = [...values, safeLimit, safeOffset];
    const dataResult = await pool.query(dataQuery, dataValues);

    res.status(200).json({
      status: 'success',
      metrics: {
        totalQuestions: parseInt(metrics?.total_count || '0', 10),
        stagingCount: parseInt(metrics?.staging_count || '0', 10),
        publishedCount: parseInt(metrics?.published_count || '0', 10),
        pendingReviewCount: parseInt(metrics?.pending_review_count || '0', 10),
        unitsCount: parseInt(metrics?.units_count || '0', 10),
        classesCount: parseInt(metrics?.classes_count || '0', 10),
      },
      filteredTotal,
      limit: safeLimit,
      offset: safeOffset,
      data: dataResult.rows.map(mapRowToQuestion),
    });
  } catch (error: any) {
    console.error('Error in admin questions query:', error?.message || error);
    console.error('Admin query stack:', error?.stack);
    console.error('Admin query details:', { code: error?.code, detail: error?.detail, constraint: error?.constraint });
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve admin questions',
      error: error?.message || 'Unknown database error',
    });
  }
});

/**
 * GET /api/questions/metrics (Public / Admin)
 * Returns live HUD metrics for Question Bank directly from PostgreSQL.
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const targetSystem = req.query.target_system as string | undefined;
    let whereFilter = "1=1";
    if (targetSystem === 'study_materials') {
      whereFilter = "target_system = 'study_materials'";
    } else if (targetSystem === 'main_practice') {
      whereFilter = "(target_system = 'main_practice' OR target_system IS NULL)";
    }

    const metricsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'staging' THEN 1 END) as staging_count,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
        COUNT(CASE WHEN verification_status = 'needs_review' OR verification_status IS NULL THEN 1 END) as pending_review_count,
        COUNT(DISTINCT unit_id) as units_count,
        COUNT(DISTINCT class_id) as classes_count
      FROM questions
      WHERE ${whereFilter};
    `);
    const metrics = metricsResult.rows[0];
    return res.status(200).json({
      status: 'success',
      metrics: {
        totalQuestions: parseInt(metrics?.total_count || '0', 10),
        stagingCount: parseInt(metrics?.staging_count || '0', 10),
        publishedCount: parseInt(metrics?.published_count || '0', 10),
        pendingReviewCount: parseInt(metrics?.pending_review_count || '0', 10),
        unitsCount: parseInt(metrics?.units_count || '0', 10),
        classesCount: parseInt(metrics?.classes_count || '0', 10),
      },
    });
  } catch (error: any) {
    console.error('Error fetching questions metrics:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve question metrics' });
  }
});

/**
 * GET /api/questions/:id
 * Fetch single question by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid question ID' });
    }

    const result = await pool.query('SELECT * FROM questions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Question not found' });
    }

    return res.status(200).json({
      status: 'success',
      data: mapRowToQuestion(result.rows[0]),
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch question',
      error: error.message,
    });
  }
});

/**
 * POST /api/questions (Protected)
 * Add a single new question
 */
router.post('/', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const q = req.body;
    const rawQuestionText = q.question || q.questionText || q.question_text;
    const lessonTitle = q.lessonTitle || q.lesson_title || q.lesson;
    const unitId = Number(q.unitId || q.unit_id || String(q.unit || '').replace(/\D+/g, '') || 1);
    const rawCorrectAnswer = q.correctAnswer !== undefined ? q.correctAnswer : q.correct_answer;
    const options = Array.isArray(q.options) ? q.options.map((o: any) => String(o || '').trim()) : [];

    const qValidation = isValidQuestionText(rawQuestionText);
    if (!qValidation.valid) {
      return res.status(400).json({ status: 'error', message: qValidation.reason || 'Valid question ending with ? is required' });
    }
    const questionText = qValidation.normalizedQuestion;

    if (!lessonTitle || typeof lessonTitle !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Lesson title is required' });
    }
    if (isNaN(unitId) || unitId < 1) {
      return res.status(400).json({ status: 'error', message: 'Valid unitId is required' });
    }
    if (options.length !== 4 || options.some((opt: string) => !opt)) {
      return res.status(400).json({ status: 'error', message: 'Options must be an array of exactly 4 non-empty strings' });
    }
    const correctAnswer = resolveCorrectAnswerIndex(rawCorrectAnswer, options);
    if (correctAnswer < 0 || correctAnswer > 3) {
      return res.status(400).json({ status: 'error', message: 'Correct answer must be a valid option or integer between 0 and 3' });
    }

    const VALID_CATEGORIES = ['group1', 'group2', 'group2a', 'group4', 'vao', 'group2_2a', 'group4_vao'];
    const cleanCategory = (q.category || 'group4').trim().toLowerCase();
    if (!VALID_CATEGORIES.includes(cleanCategory)) {
      return res.status(400).json({
        status: 'error',
        message: `Mandatory Group selection invalid: category must be one of: ${VALID_CATEGORIES.join(', ')}`,
      });
    }

    const classId = q.classId || q.class_id || q.standard || null;
    const lessonId = (q.lessonId || q.lesson_id || '').trim() || null;
    const subject = q.subject || 'General Studies';
    const topic = (q.topic || lessonTitle || '').trim();
    if (!topic) {
      return res.status(400).json({
        status: 'error',
        message: 'Topic is mandatory and must be specified before creating a question.',
      });
    }
    const difficulty = ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium';
    const groupName = cleanCategory === 'group1' ? 'Group 1' : (cleanCategory === 'group2' || cleanCategory === 'group2a' || cleanCategory === 'group2_2a') ? 'Group 2, 2A' : cleanCategory === 'group4' ? 'Group 4' : 'VAO';
    const tag = q.tag || `TNPSC ${groupName} • Unit ${unitId}: ${subject}`;
    const explanation = (q.explanation || 'No explanation provided.').trim();
    const sourceReference = q.sourceReference || q.source_reference || null;
    const status = q.status === 'published' ? 'published' : 'staging'; // defaults to staging for safety
    const textbookId = q.textbookId || q.textbook_id || null;
    const sourcePage = q.sourcePage || q.source_page || null;
    const verificationStatus = ['verified', 'needs_review', 'rejected'].includes(q.verificationStatus || q.verification_status)
      ? (q.verificationStatus || q.verification_status)
      : 'needs_review';

    // Semantic Duplicate Check against PostgreSQL before insertion
    const existingRes = await pool.query(
      `SELECT question_text, options, correct_answer FROM questions
       WHERE LOWER(lesson_title) = LOWER($1)
          OR (class_id = $2 AND LOWER(subject) = LOWER($3) AND unit_id = $4)`,
      [lessonTitle.trim(), classId ? Number(classId) : null, subject.trim(), unitId]
    );
    const dbRecords: ExistingDbQuestionRecord[] = existingRes.rows.map((r: any) => {
      const opts = typeof r.options === 'string' ? JSON.parse(r.options) : r.options;
      return {
        question: r.question_text,
        correctAnswerText: Array.isArray(opts) ? opts[r.correct_answer] : undefined,
      };
    });

    if (isSemanticallyDuplicate(questionText, [], dbRecords, options[correctAnswer])) {
      return res.status(409).json({
        status: 'error',
        message: 'Duplicate or semantically identical question already exists in the database for this lesson.',
      });
    }

    const insertQuery = `
      INSERT INTO questions (
        category, unit_id, class_id, subject, lesson_title, lesson_id, topic,
        difficulty, tag, question_text, options, correct_answer,
        explanation, source_reference, status, textbook_id, source_page, verification_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (lesson_title, question_text) DO NOTHING
      RETURNING *;
    `;
    const values = [
      cleanCategory,
      unitId,
      classId,
      subject,
      lessonTitle.trim(),
      lessonId,
      topic,
      difficulty,
      tag,
      questionText.trim(),
      JSON.stringify(options.map((opt: string) => opt.trim())),
      correctAnswer,
      explanation,
      sourceReference,
      status,
      textbookId,
      sourcePage,
      verificationStatus,
    ];

    const result = await pool.query(insertQuery, values);
    if (result.rows.length === 0) {
      return res.status(409).json({
        status: 'error',
        message: 'A question with this exact text already exists for this lesson (duplicate prevented).',
      });
    }

    return res.status(201).json({
      status: 'success',
      message: 'Question created successfully',
      data: mapRowToQuestion(result.rows[0]),
    });
  } catch (error: any) {
    console.error('Error creating question:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create question',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/questions/:id (Protected)
 * Edit an existing question by ID with atomic field updates
 * Specifically supports updating individual fields, including a single option,
 * without changing other fields.
 */
router.patch('/:id(\\d+)', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid question ID' });
    }

    // 1. Fetch current question state
    const currentRes = await pool.query('SELECT * FROM questions WHERE id = $1', [id]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: `Question #${id} not found` });
    }
    const current = currentRes.rows[0];
    let currentOptions: string[] = typeof current.options === 'string' ? JSON.parse(current.options) : current.options;

    const b = req.body;

    // Handle single-option update (e.g. { optionIndex: 1, optionValue: "Updated Text" })
    if (typeof b.optionIndex === 'number' && b.optionIndex >= 0 && b.optionIndex <= 3 && typeof b.optionValue === 'string') {
      currentOptions[b.optionIndex] = b.optionValue.trim();
    } else if (Array.isArray(b.options) && b.options.length === 4) {
      currentOptions = b.options.map((o: any) => String(o).trim());
    }

    // Prepare fields to update dynamically
    const updateClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [];
    let pIdx = 1;

    // Always persist options (whether full array or single option changed)
    updateClauses.push(`options = $${pIdx++}`);
    values.push(JSON.stringify(currentOptions));

    if (b.question !== undefined || b.questionText !== undefined) {
      const qText = String(b.question || b.questionText).trim();
      if (qText.length < 5) return res.status(400).json({ status: 'error', message: 'Question text too short' });
      updateClauses.push(`question_text = $${pIdx++}`);
      values.push(qText);
    }

    if (b.correctAnswer !== undefined) {
      const cAns = Number(b.correctAnswer);
      if (isNaN(cAns) || cAns < 0 || cAns > 3) return res.status(400).json({ status: 'error', message: 'correctAnswer must be 0-3' });
      updateClauses.push(`correct_answer = $${pIdx++}`);
      values.push(cAns);
    }

    if (b.explanation !== undefined) {
      updateClauses.push(`explanation = $${pIdx++}`);
      values.push(String(b.explanation).trim());
    }

    if (b.lessonTitle !== undefined) {
      updateClauses.push(`lesson_title = $${pIdx++}`);
      values.push(String(b.lessonTitle).trim());
    }

    if (b.lessonId !== undefined) {
      updateClauses.push(`lesson_id = $${pIdx++}`);
      values.push(b.lessonId ? String(b.lessonId).trim() : null);
    }

    if (b.unitId !== undefined && !isNaN(Number(b.unitId))) {
      updateClauses.push(`unit_id = $${pIdx++}`);
      values.push(Number(b.unitId));
    }

    if (b.classId !== undefined) {
      updateClauses.push(`class_id = $${pIdx++}`);
      values.push(b.classId === null ? null : Number(b.classId));
    }

    if (b.subject !== undefined) {
      updateClauses.push(`subject = $${pIdx++}`);
      values.push(String(b.subject).trim());
    }

    if (b.topic !== undefined) {
      updateClauses.push(`topic = $${pIdx++}`);
      values.push(b.topic ? String(b.topic).trim() : null);
    }

    if (b.difficulty !== undefined && ['Easy', 'Medium', 'Hard'].includes(b.difficulty)) {
      updateClauses.push(`difficulty = $${pIdx++}`);
      values.push(b.difficulty);
    }

    if (b.sourceReference !== undefined) {
      updateClauses.push(`source_reference = $${pIdx++}`);
      values.push(b.sourceReference ? String(b.sourceReference).trim() : null);
    }

    if (b.status !== undefined && ['staging', 'published', 'archived'].includes(b.status)) {
      updateClauses.push(`status = $${pIdx++}`);
      values.push(b.status);
    }

    values.push(id);
    const updateQuery = `
      UPDATE questions 
      SET ${updateClauses.join(', ')} 
      WHERE id = $${pIdx} 
      RETURNING *;
    `;

    const updatedResult = await pool.query(updateQuery, values);
    return res.status(200).json({
      status: 'success',
      message: `Question #${id} updated successfully`,
      data: mapRowToQuestion(updatedResult.rows[0]),
    });
  } catch (error: any) {
    console.error('Error updating question:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to update question',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/questions (Protected) - Bulk delete
 * Supports: { ids: [...] } or filters { category, subject, classId, unitId, lessonTitle, lesson, status, difficulty, search }
 */
router.delete('/', requireAdminAuth, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      ids,
      category,
      subject,
      classId,
      unitId,
      lessonTitle,
      lesson,
      status,
      difficulty,
      search,
      deleteAll = false,
    } = req.body || {};

    if (Array.isArray(ids) && ids.length > 0) {
      const validIds = ids.filter((id: any) => !isNaN(Number(id))).map((id: any) => Number(id));
      if (validIds.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No valid question IDs provided' });
      }
      const result = await client.query('DELETE FROM questions WHERE id = ANY($1) RETURNING id', [validIds]);
      return res.status(200).json({
        status: 'success',
        message: `Deleted ${result.rowCount} question(s)`,
        deletedCount: result.rowCount,
      });
    }

    if (deleteAll) {
      const queryConditions: string[] = ["(target_system = 'main_practice' OR target_system IS NULL)"];
      const values: any[] = [];
      let paramIndex = 1;

      if (category && typeof category === 'string' && category !== 'all') {
        const cleanCat = category.trim().toLowerCase();
        if (cleanCat === 'group2_2a' || cleanCat === 'group2' || cleanCat === 'group2a') {
          queryConditions.push(`LOWER(category) IN ('group2', 'group2a', 'group2_2a')`);
        } else if (cleanCat === 'group4_vao' || cleanCat === 'group4' || cleanCat === 'vao') {
          queryConditions.push(`LOWER(category) IN ('group4', 'vao', 'group4_vao')`);
        } else {
          queryConditions.push(`LOWER(category) = $${paramIndex++}`);
          values.push(cleanCat);
        }
      }
      paramIndex = applySubjectFilterCondition(subject, queryConditions, values, paramIndex);
      if (classId && classId !== 'all' && !isNaN(Number(classId))) {
        queryConditions.push(`class_id = $${paramIndex++}`);
        values.push(Number(classId));
      }
      if (unitId && unitId !== 'all' && !isNaN(Number(unitId))) {
        queryConditions.push(`unit_id = $${paramIndex++}`);
        values.push(Number(unitId));
      }
      paramIndex = applyLessonFilterCondition(lessonTitle || lesson, queryConditions, values, paramIndex);

      if (search && typeof search === 'string' && search.trim()) {
        const trimmed = search.trim();
        if (!isNaN(Number(trimmed))) {
          queryConditions.push(
            `(id = $${paramIndex} OR LOWER(question_text) LIKE $${paramIndex + 1} OR LOWER(lesson_title) LIKE $${paramIndex + 1})`
          );
          values.push(Number(trimmed));
          values.push(`%${trimmed.toLowerCase()}%`);
          paramIndex += 2;
        } else {
          queryConditions.push(
            `(LOWER(question_text) LIKE $${paramIndex} OR LOWER(lesson_title) LIKE $${paramIndex} OR LOWER(subject) LIKE $${paramIndex} OR LOWER(topic) LIKE $${paramIndex})`
          );
          values.push(`%${trimmed.toLowerCase()}%`);
          paramIndex++;
        }
      }
      if (status && typeof status === 'string' && status !== 'all') {
        queryConditions.push(`status = $${paramIndex++}`);
        values.push(status);
      }
      if (difficulty && typeof difficulty === 'string' && difficulty !== 'all') {
        queryConditions.push(`difficulty = $${paramIndex++}`);
        values.push(difficulty);
      }

      const whereClause = queryConditions.length > 0 ? `WHERE ${queryConditions.join(' AND ')}` : '';
      const countQuery = `SELECT COUNT(*) AS total FROM questions ${whereClause}`;
      const countResult = await client.query(countQuery, values);
      const totalToDelete = parseInt(countResult.rows[0].total, 10);

      if (totalToDelete === 0) {
        return res.status(200).json({ status: 'success', message: 'No questions found to delete', deletedCount: 0 });
      }

      const deleteQuery = `DELETE FROM questions ${whereClause} RETURNING id`;
      const deleteResult = await client.query(deleteQuery, values);
      return res.status(200).json({
        status: 'success',
        message: `Deleted ${deleteResult.rowCount} question(s)`,
        deletedCount: deleteResult.rowCount,
      });
    }

    return res.status(400).json({ status: 'error', message: 'Provide ids array or deleteAll with filters' });
  } catch (error: any) {
    console.error('Error in bulk delete:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to delete questions', error: error.message });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/questions/:id (Protected)
 * Explicit question deletion
 */
router.delete('/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid question ID' });
    }

    const result = await pool.query('DELETE FROM questions WHERE id = $1 RETURNING id, lesson_title, question_text;', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: `Question #${id} not found` });
    }

    return res.status(200).json({
      status: 'success',
      message: `Question #${id} deleted successfully`,
      deleted: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error deleting question:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete question',
      error: error.message,
    });
  }
});

/**
 * POST /api/questions/upload (Protected)
 * Validates and uploads questions in bulk via JSON/CSV
 * Always forces status = 'staging' so uploads are NEVER automatically published!
 */
router.post('/upload', requireAdminAuth, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const rawList = Array.isArray(req.body) ? req.body : req.body?.questions;

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid payload: expected an array of questions or { questions: [...] }',
      });
    }

    let insertedCount = 0;
    let skippedDuplicates = 0;
    const validationErrors: { index: number; reason: string }[] = [];
    const validQuestions: any[] = [];
    const insertedIds: number[] = [];

    rawList.forEach((q, index) => {
      const rawQuestionText = q.question || q.questionText || q.question_text;
      const lessonTitle = q.lessonTitle || q.lesson_title || q.lesson;
      const unitId = Number(q.unitId || q.unit_id || String(q.unit || '').replace(/\D+/g, '') || 1);
      const rawCorrectAnswer = q.correctAnswer !== undefined ? q.correctAnswer : q.correct_answer;
      let options = q.options;

      // Parse stringified options if coming from CSV
      if (typeof options === 'string') {
        try {
          options = JSON.parse(options);
        } catch {
          options = options.split('|').map((s: string) => s.trim());
        }
      }

      const qValidation = isValidQuestionText(rawQuestionText);
      if (!qValidation.valid) {
        validationErrors.push({ index: index + 1, reason: qValidation.reason || 'Missing or invalid question text' });
        return;
      }
      const questionText = qValidation.normalizedQuestion;

      if (!lessonTitle || typeof lessonTitle !== 'string') {
        validationErrors.push({ index: index + 1, reason: 'Missing lesson title' });
        return;
      }
      if (isNaN(unitId) || unitId < 1 || unitId > 20) {
        validationErrors.push({ index: index + 1, reason: 'unitId must be between 1 and 20' });
        return;
      }
      if (!Array.isArray(options) || options.length !== 4 || options.some(opt => typeof opt !== 'string' || !opt.trim())) {
        validationErrors.push({ index: index + 1, reason: 'Options must have exactly 4 non-empty items' });
        return;
      }
      const cleanedOptions = options.map((opt: string) => String(opt).trim());
      const correctAnswer = resolveCorrectAnswerIndex(rawCorrectAnswer, cleanedOptions);
      if (correctAnswer < 0 || correctAnswer > 3) {
        validationErrors.push({ index: index + 1, reason: 'correctAnswer must match one of the 4 options or be index 0..3' });
        return;
      }

      const VALID_CATEGORIES = ['group1', 'group2', 'group2a', 'group4', 'vao', 'group2_2a', 'group4_vao'];
      const rawCategory = (q.category || req.body?.category || 'group4').trim().toLowerCase();
      if (!VALID_CATEGORIES.includes(rawCategory)) {
        validationErrors.push({ index: index + 1, reason: `Mandatory Group invalid: "${rawCategory}". Must be one of: ${VALID_CATEGORIES.join(', ')}` });
        return;
      }

      const groupName = rawCategory === 'group1' ? 'Group 1' : (rawCategory === 'group2' || rawCategory === 'group2a' || rawCategory === 'group2_2a') ? 'Group 2, 2A' : rawCategory === 'group4' ? 'Group 4' : 'VAO';
      const topic = (q.topic || lessonTitle || '').trim();
      if (!topic) {
        validationErrors.push({ index: index + 1, reason: 'Topic is mandatory and cannot be empty' });
        return;
      }

      const rawTargetSystem = q.targetSystem || q.target_system || req.body?.targetSystem || 'study_materials';
      const resolvedTargetSystem = ['study_materials', 'main_practice'].includes(rawTargetSystem) ? rawTargetSystem : 'study_materials';
      const rawLang = String(q.language || req.body?.language || '').trim().toLowerCase();
      const resolvedLang = rawLang === 'english' ? 'english' : 'tamil';
      const resolvedClassId = q.classId || q.class_id || q.standard || null;
      const resolvedSubj = q.subject || 'General Studies';
      const resolvedSubjId = q.subjectId || q.subject_id || resolvedSubj.toLowerCase().replace(/\s+/g, '-');
      const resolvedLessonId = (q.lessonId || q.lesson_id || req.body?.lessonId || '').trim() ||
        ((lessonTitle.includes('எழுத்து இலக்கணம்') || lessonTitle.includes('1.1')) && Number(resolvedClassId) === 6 && unitId === 1 ? 'gt-1-6-t1-l1' : null);

      validQuestions.push({
        category: rawCategory,
        examGroupId: rawCategory,
        unitId,
        classId: resolvedClassId,
        standardId: resolvedClassId,
        subject: resolvedSubj,
        subjectId: resolvedSubjId,
        lessonTitle: lessonTitle.trim(),
        lessonId: resolvedLessonId,
        topic,
        difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium',
        tag: q.tag || `TNPSC ${groupName} • Unit ${unitId}: ${resolvedSubj}`,
        questionText: questionText.trim(),
        optionsArray: cleanedOptions,
        options: JSON.stringify(cleanedOptions),
        optionA: cleanedOptions[0],
        optionB: cleanedOptions[1],
        optionC: cleanedOptions[2],
        optionD: cleanedOptions[3],
        correctAnswer,
        correctAnswerText: cleanedOptions[correctAnswer],
        explanation: (q.explanation || 'No explanation provided.').trim(),
        sourceReference: q.sourceReference || q.source_reference || null,
        status: 'staging', // STRICT: Always enters staging state!
        textbookId: q.textbookId || q.textbook_id || null,
        sourcePage: q.sourcePage || q.source_page || null,
        verificationStatus: ['verified', 'needs_review', 'rejected'].includes(q.verificationStatus || q.verification_status)
          ? (q.verificationStatus || q.verification_status)
          : 'needs_review',
        targetSystem: resolvedTargetSystem,
        language: resolvedLang,
      });
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Validation failed: ${validationErrors.length} question(s) had errors. Rejecting batch to prevent invalid mappings.`,
        errors: validationErrors,
      });
    }

    if (validQuestions.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid questions found in upload',
        errors: validationErrors,
      });
    }

    // Fetch existing DB questions for the lessons/units in this batch for semantic duplicate validation
    const uniqueLessons = Array.from(new Set(validQuestions.map((vq) => vq.lessonTitle.toLowerCase())));
    const existingDbRes = await client.query(
      `SELECT question_text, options, correct_answer FROM questions
       WHERE LOWER(lesson_title) = ANY($1)
          OR (class_id = $2 AND LOWER(subject) = LOWER($3) AND unit_id = $4)`,
      [
        uniqueLessons,
        validQuestions[0].classId ? Number(validQuestions[0].classId) : null,
        validQuestions[0].subject,
        validQuestions[0].unitId,
      ]
    );
    const dbRecords: ExistingDbQuestionRecord[] = existingDbRes.rows.map((r: any) => {
      const opts = typeof r.options === 'string' ? JSON.parse(r.options) : r.options;
      return {
        question: r.question_text,
        correctAnswerText: Array.isArray(opts) ? opts[r.correct_answer] : undefined,
      };
    });

    const acceptedForInsert: Array<{ question: string; correctAnswerText?: string }> = [];

    await client.query('BEGIN');

    for (const q of validQuestions) {
      if (isSemanticallyDuplicate(q.questionText, acceptedForInsert, dbRecords, q.correctAnswerText)) {
        skippedDuplicates++;
        continue;
      }

      const insertQuery = `
        INSERT INTO questions (
          category, exam_group_id, unit_id, class_id, standard_id, subject, subject_id,
          lesson_title, lesson_id, topic, difficulty, tag, question_text,
          options, option_a, option_b, option_c, option_d, correct_answer,
          explanation, source_reference, status, textbook_id, source_page, verification_status,
          target_system, language
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19,
          $20, $21, 'staging', $22, $23, $24,
          $25, $26
        )
        ON CONFLICT (lesson_title, question_text) DO NOTHING
        RETURNING id;
      `;
      const values = [
        q.category,
        q.examGroupId,
        q.unitId,
        q.classId,
        q.standardId,
        q.subject,
        q.subjectId,
        q.lessonTitle,
        q.lessonId,
        q.topic,
        q.difficulty,
        q.tag,
        q.questionText,
        q.options,
        q.optionA,
        q.optionB,
        q.optionC,
        q.optionD,
        q.correctAnswer,
        q.explanation,
        q.sourceReference,
        q.textbookId,
        q.sourcePage,
        q.verificationStatus,
        q.targetSystem,
        q.language,
      ];

      const resInsert = await client.query(insertQuery, values);
      if (resInsert.rowCount && resInsert.rowCount > 0) {
        insertedCount++;
        acceptedForInsert.push({ question: q.questionText, correctAnswerText: q.correctAnswerText });
        if (resInsert.rows && resInsert.rows[0] && resInsert.rows[0].id) {
          insertedIds.push(resInsert.rows[0].id);
        }
      } else {
        skippedDuplicates++;
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      status: 'success',
      message: `Bulk upload completed: ${insertedCount} staged, ${skippedDuplicates} duplicates skipped.`,
      received: rawList.length,
      validated: validQuestions.length,
      inserted: insertedCount,
      skippedDuplicates,
      insertedIds,
      validationErrorsCount: validationErrors.length,
      validationErrors: validationErrors.slice(0, 10),
    });
  } catch (error: any) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr: any) {
      console.error('Rollback error during bulk upload:', rollbackErr?.message || rollbackErr);
    }
    console.error('Error during bulk upload:', error?.message || error);
    console.error('Bulk upload stack:', error?.stack);
    console.error('Bulk upload details:', {
      code: error?.code,
      detail: error?.detail,
      constraint: error?.constraint,
      table: error?.table,
      column: error?.column,
    });
    return res.status(500).json({
      status: 'error',
      message: 'Failed to process bulk upload',
      error: error?.message || 'Unknown database error',
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/questions/batch (Protected)
 */
router.post('/batch', requireAdminAuth, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const rawList = Array.isArray(req.body) ? req.body : req.body?.questions;
    const defaultStatus = req.body?.stageOnly ? 'staging' : (req.body?.defaultStatus || 'staging');

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request body: expected an array of questions or { questions: [...] }',
      });
    }

    let insertedCount = 0;
    let skippedDuplicates = 0;
    const validationErrors: { index: number; reason: string }[] = [];
    const validQuestions: any[] = [];

    rawList.forEach((q, index) => {
      const rawQuestionText = q.question || q.questionText || q.question_text;
      const lessonTitle = q.lessonTitle || q.lesson_title || q.lesson;
      const unitId = Number(q.unitId || q.unit_id || String(q.unit || '').replace(/\D+/g, '') || 1);
      const rawCorrectAnswer = q.correctAnswer !== undefined ? q.correctAnswer : q.correct_answer;
      const options = Array.isArray(q.options) ? q.options.map((o: any) => String(o || '').trim()) : [];

      const qValidation = isValidQuestionText(rawQuestionText);
      if (!qValidation.valid) {
        validationErrors.push({ index, reason: qValidation.reason || 'Missing or invalid question text' });
        return;
      }
      const questionText = qValidation.normalizedQuestion;

      if (!lessonTitle || typeof lessonTitle !== 'string') {
        validationErrors.push({ index, reason: 'Missing lesson title' });
        return;
      }
      if (isNaN(unitId) || unitId < 1 || unitId > 20) {
        validationErrors.push({ index, reason: 'Invalid unitId (must be between 1 and 20)' });
        return;
      }
      if (options.length !== 4 || options.some((opt: string) => !opt)) {
        validationErrors.push({ index, reason: 'Options must be an array of exactly 4 non-empty strings' });
        return;
      }
      const correctAnswer = resolveCorrectAnswerIndex(rawCorrectAnswer, options);
      if (correctAnswer < 0 || correctAnswer > 3) {
        validationErrors.push({ index, reason: 'correctAnswer must match one of the 4 options or be 0..3' });
        return;
      }

      const VALID_CATEGORIES = ['group1', 'group2', 'group2a', 'group4', 'vao', 'group2_2a', 'group4_vao'];
      const rawCategory = (q.category || req.body?.category || 'group4').trim().toLowerCase();
      if (!VALID_CATEGORIES.includes(rawCategory)) {
        validationErrors.push({ index, reason: `Invalid group/category: "${rawCategory}". Must be one of: ${VALID_CATEGORIES.join(', ')}` });
        return;
      }

      const groupName = rawCategory === 'group1' ? 'Group 1' : (rawCategory === 'group2' || rawCategory === 'group2a' || rawCategory === 'group2_2a') ? 'Group 2, 2A' : rawCategory === 'group4' ? 'Group 4' : 'VAO';
      const topic = (q.topic || '').trim() || lessonTitle.trim();

      const resolvedLessonId = (q.lessonId || q.lesson_id || req.body?.lessonId || '').trim() || null;

      validQuestions.push({
        category: rawCategory,
        unitId,
        classId: q.classId || q.class_id || q.standard || null,
        subject: q.subject || 'General Studies',
        lessonTitle: lessonTitle.trim(),
        lessonId: resolvedLessonId,
        topic,
        difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium',
        tag: q.tag || `TNPSC ${groupName} • Unit ${unitId}: ${q.subject || 'General Studies'}`,
        questionText: questionText.trim(),
        options: JSON.stringify(options),
        correctAnswer,
        correctAnswerText: options[correctAnswer],
        explanation: (q.explanation || 'No explanation provided.').trim(),
        sourceReference: (q.sourceReference || q.source_reference || null),
        status: q.status || defaultStatus,
      });
    });

    if (validQuestions.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid questions passed validation',
        errors: validationErrors,
      });
    }

    const uniqueLessons = Array.from(new Set(validQuestions.map((vq) => vq.lessonTitle.toLowerCase())));
    const existingDbRes = await client.query(
      `SELECT question_text, options, correct_answer FROM questions
       WHERE LOWER(lesson_title) = ANY($1)
          OR (class_id = $2 AND LOWER(subject) = LOWER($3) AND unit_id = $4)`,
      [
        uniqueLessons,
        validQuestions[0].classId ? Number(validQuestions[0].classId) : null,
        validQuestions[0].subject,
        validQuestions[0].unitId,
      ]
    );
    const dbRecords: ExistingDbQuestionRecord[] = existingDbRes.rows.map((r: any) => {
      const opts = typeof r.options === 'string' ? JSON.parse(r.options) : r.options;
      return {
        question: r.question_text,
        correctAnswerText: Array.isArray(opts) ? opts[r.correct_answer] : undefined,
      };
    });
    const acceptedForInsert: Array<{ question: string; correctAnswerText?: string }> = [];

    await client.query('BEGIN');

    for (const q of validQuestions) {
      if (isSemanticallyDuplicate(q.questionText, acceptedForInsert, dbRecords, q.correctAnswerText)) {
        skippedDuplicates++;
        continue;
      }

      const insertQuery = `
        INSERT INTO questions (
          category, unit_id, class_id, subject, lesson_title, lesson_id, topic,
          difficulty, tag, question_text, options, correct_answer,
          explanation, source_reference, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (lesson_title, question_text) DO NOTHING
        RETURNING id;
      `;
      const values = [
        q.category,
        q.unitId,
        q.classId,
        q.subject,
        q.lessonTitle,
        q.lessonId,
        q.topic,
        q.difficulty,
        q.tag,
        q.questionText,
        q.options,
        q.correctAnswer,
        q.explanation,
        q.sourceReference,
        q.status,
      ];

      const result = await client.query(insertQuery, values);
      if (result.rowCount && result.rowCount > 0) {
        insertedCount++;
        acceptedForInsert.push({ question: q.questionText, correctAnswerText: q.correctAnswerText });
      } else {
        skippedDuplicates++;
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      status: 'success',
      received: rawList.length,
      validated: validQuestions.length,
      inserted: insertedCount,
      skippedDuplicates,
      validationErrorsCount: validationErrors.length,
      validationErrors: validationErrors.slice(0, 10),
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error during batch question insertion:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to process batch questions',
      error: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/questions/publish (Protected)
 * Publishes ONLY the explicitly selected staging questions.
 * Never falls back to publishing all staging questions.
 */
router.patch('/publish', requireAdminAuth, async (req: Request, res: Response) => {
  const { ids } = req.body || {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'A non-empty ids array is required. Bulk publishing never publishes all staging questions.',
    });
  }

  const parsedIds = ids.map((id: any) => Number(id));
  if (parsedIds.some((id: number) => !Number.isInteger(id) || id <= 0)) {
    return res.status(400).json({ status: 'error', message: 'All question IDs must be positive integers.' });
  }
  const uniqueIds = [...new Set(parsedIds)];

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Lock the selected rows so status cannot change between validation and update.
    const existing = await client.query(
      `SELECT id, status, lesson_id, lesson_title, unit_id, category, subject, class_id, target_system FROM questions 
       WHERE id = ANY($1) FOR UPDATE`,
      [uniqueIds]
    );
    const foundStatus = new Map<number, string>(existing.rows.map((row: any) => [row.id, row.status] as [number, string]));
    const missingIds = uniqueIds.filter((id) => !foundStatus.has(id));
    if (missingIds.length > 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: `Cannot publish: ${missingIds.length} question(s) not found in the database.`,
        missingIds,
      });
    }

    const alreadyPublishedIds = uniqueIds.filter((id) => foundStatus.get(id) === 'published');
    const stagingIds = uniqueIds.filter((id) => foundStatus.get(id) === 'staging');
    const invalidStatusIds = uniqueIds.filter((id) => !['staging', 'published'].includes(foundStatus.get(id) || ''));

    if (invalidStatusIds.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        status: 'error',
        message: `Cannot publish: ${invalidStatusIds.length} question(s) are archived or in an invalid state.`,
        invalidStatusIds,
      });
    }

    // Idempotent: If all selected questions are already published, return success immediately
    if (stagingIds.length === 0 && alreadyPublishedIds.length > 0) {
      await client.query('COMMIT');
      const metricsRes = await pool.query(`
        SELECT 
          COUNT(*) as total_count,
          COUNT(CASE WHEN status = 'staging' THEN 1 END) as staging_count,
          COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
          COUNT(CASE WHEN verification_status = 'needs_review' OR verification_status IS NULL THEN 1 END) as pending_review_count
        FROM questions;
      `);
      const m = metricsRes.rows[0];
      return res.status(200).json({
        status: 'success',
        message: 'All selected questions are already published.',
        publishedCount: 0,
        publishedIds: alreadyPublishedIds,
        metrics: {
          totalQuestions: parseInt(m?.total_count || '0', 10),
          stagingCount: parseInt(m?.staging_count || '0', 10),
          publishedCount: parseInt(m?.published_count || '0', 10),
          pendingReviewCount: parseInt(m?.pending_review_count || '0', 10),
        },
      });
    }

    // Strict Lesson Mapping Validation on staging rows
    const stagingRows = existing.rows.filter((row: any) => stagingIds.includes(row.id));
    const invalidLessonQuestions = stagingRows.filter((row: any) => {
      const hasLessonId = row.lesson_id && String(row.lesson_id).trim().length > 0;
      const hasLessonTitle = row.lesson_title && String(row.lesson_title).trim().length > 0;
      return !hasLessonId && !hasLessonTitle;
    });

    if (invalidLessonQuestions.length > 0) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        status: 'error',
        message: `Cannot publish: ${invalidLessonQuestions.length} question(s) lack required lesson metadata. Strict lesson-wise publishing requires an associated lesson.`,
        invalidIds: invalidLessonQuestions.map((row: any) => row.id),
      });
    }

    // Update staging questions to published with full metadata preservation
    const result = await client.query(
      `UPDATE questions 
       SET status = 'published',
           updated_at = CURRENT_TIMESTAMP,
           exam_group_id = COALESCE(exam_group_id, category),
           subject_id = COALESCE(subject_id, LOWER(REPLACE(subject, ' ', '-'))),
           standard_id = COALESCE(standard_id, class_id),
           language = COALESCE(language, 'tamil'),
           lesson_id = CASE
             WHEN lesson_id IS NOT NULL AND TRIM(lesson_id) != '' THEN TRIM(lesson_id)
             WHEN (lesson_title LIKE '%எழுத்து இலக்கணம்%' OR lesson_title LIKE '%1.1%') AND class_id = 6 AND unit_id = 1 THEN 'gt-1-6-t1-l1'
             ELSE COALESCE(lesson_id, 'gt-1-6-t1-l1')
           END,
           option_a = COALESCE(option_a, options->>0),
           option_b = COALESCE(option_b, options->>1),
           option_c = COALESCE(option_c, options->>2),
           option_d = COALESCE(option_d, options->>3)
       WHERE id = ANY($1) AND status = 'staging'
       RETURNING id`,
      [stagingIds]
    );

    if (result.rowCount !== stagingIds.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        status: 'error',
        message: 'Publishing aborted: some selected questions changed status during publishing. No questions were published.',
      });
    }

    await client.query('COMMIT');

    // Query accurate live counts directly from PostgreSQL
    const liveMetricsRes = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'staging' THEN 1 END) as staging_count,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
        COUNT(CASE WHEN verification_status = 'needs_review' OR verification_status IS NULL THEN 1 END) as pending_review_count
      FROM questions;
    `);
    const liveM = liveMetricsRes.rows[0];

    const allPublishedIds = [...result.rows.map((row: any) => row.id), ...alreadyPublishedIds];

    return res.status(200).json({
      status: 'success',
      message: `Successfully published ${result.rowCount} question(s).`,
      publishedCount: result.rowCount,
      publishedIds: allPublishedIds,
      metrics: {
        totalQuestions: parseInt(liveM?.total_count || '0', 10),
        stagingCount: parseInt(liveM?.staging_count || '0', 10),
        publishedCount: parseInt(liveM?.published_count || '0', 10),
        pendingReviewCount: parseInt(liveM?.pending_review_count || '0', 10),
      },
    });
  } catch (error: any) {
    try {
      if (client) await client.query('ROLLBACK');
    } catch (rollbackError: any) {
      console.error('Rollback error during bulk publish:', rollbackError?.message || rollbackError);
    }
    console.error('Error publishing questions:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to publish questions',
      error: error.message,
    });
  } finally {
    client?.release();
  }
});

export const VALID_CATEGORIES = ['group1', 'group2', 'group2a', 'group4', 'vao'] as const;

export function getGroupDetails(category: string) {
  switch (category?.toLowerCase()) {
    case 'group1':
      return { name: 'TNPSC Group 1', code: 'Code: 497', standard: 'Degree Standard' };
    case 'group2':
    case 'group2a':
    case 'group2_2a':
      return { name: 'TNPSC Group 2 & 2A', code: 'Code: 495', standard: 'Degree Standard' };
    case 'group4':
    case 'vao':
    case 'group4_vao':
      return { name: 'TNPSC Group 4', code: 'Code: 496', standard: 'SSLC Standard' };
    default:
      return { name: 'TNPSC Examination', code: 'TNPSC', standard: 'Degree/SSLC Standard' };
  }
}

export default router;
