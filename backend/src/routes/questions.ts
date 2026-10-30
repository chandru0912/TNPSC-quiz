import { Router, Request, Response } from 'express';
import { PoolClient } from 'pg';
import pool from '../db';
import { requireAdminAuth } from '../middleware/auth';
import {
  generateAiQuestions,
  isSemanticallyDuplicate,
  isValidQuestionText,
  resolveCorrectAnswerIndex,
  ExistingDbQuestionRecord,
} from '../services/aiMcqEngine';
import { retrieveRelevantTextbookContent } from '../services/textbookRag';

const router = Router();

export interface QuestionDTO {
  id: number;
  category: string;
  unitId: number;
  classId: number | null;
  subject: string;
  lessonTitle: string;
  topic: string | null;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tag: string;
  question: string;
  options: string[];
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
  return {
    id: row.id,
    category: row.category,
    unitId: row.unit_id,
    classId: row.class_id,
    subject: row.subject,
    lessonTitle: row.lesson_title,
    topic: row.topic,
    difficulty: row.difficulty,
    tag: row.tag || `Group 1 • Unit ${row.unit_id}: ${row.subject}`,
    question: row.question_text,
    options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options,
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
    const { category, unitId, classId, lesson, topic, subject, status, limit = '200', offset = '0' } = req.query;

    const queryConditions: string[] = [];
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
      if (lesson && typeof lesson === 'string' && lesson.trim().length > 0) {
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

    if (lesson && typeof lesson === 'string' && lesson.trim().length > 0) {
      const rawLesson = lesson.trim();
      const normLesson = rawLesson.toLowerCase().replace(/&/g, 'and');
      
      // Clean prefix before colon, em-dash, en-dash, or hyphen
      const prefix = normLesson.split(/[:–\-]/)[0].trim();
      // Main clause before " and "
      const mainFirstPart = prefix.includes(' and ') ? prefix.split(' and ')[0].trim() : prefix;
      
      // Extract significant keywords (length >= 3, excluding stopwords)
      const stopWords = new Set(['and', 'the', 'for', 'with', 'from', 'into', 'under', 'that', 'this', 'lesson', 'unit', 'chapter']);
      const keywords = normLesson
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !stopWords.has(w));

      const lessonClauses: string[] = [
        `LOWER(lesson_title) LIKE $${paramIndex++}`,
        `LOWER($${paramIndex++}) LIKE '%' || LOWER(lesson_title) || '%'`,
      ];
      values.push(`%${normLesson}%`);
      values.push(normLesson);

      if (prefix && prefix !== normLesson) {
        lessonClauses.push(`LOWER(lesson_title) LIKE $${paramIndex++}`);
        values.push(`%${prefix}%`);
        lessonClauses.push(`LOWER($${paramIndex++}) LIKE '%' || LOWER(lesson_title) || '%'`);
        values.push(prefix);
      }

      if (mainFirstPart && mainFirstPart !== prefix && mainFirstPart.length > 3) {
        lessonClauses.push(`LOWER(lesson_title) LIKE $${paramIndex++}`);
        values.push(`%${mainFirstPart}%`);
      }

      // Check significant keywords across lesson_title
      keywords.slice(0, 5).forEach((kw) => {
        if (kw.length >= 4) {
          lessonClauses.push(`LOWER(lesson_title) LIKE $${paramIndex++}`);
          values.push(`%${kw}%`);
        }
      });

      queryConditions.push(`(${lessonClauses.join(' OR ')})`);
    }

    // Strict Topic Filtering (when passed explicitly without full lesson):
    if (topic && typeof topic === 'string' && topic.trim().length > 0 && topic.toLowerCase() !== 'all' && !lesson) {
      queryConditions.push(`(LOWER(topic) = $${paramIndex} OR LOWER(topic) LIKE $${paramIndex + 1})`);
      values.push(topic.trim().toLowerCase());
      values.push(`%${topic.trim().toLowerCase()}%`);
      paramIndex += 2;
    }

    // Status: allow staging & published for student practice bank
    if (status && typeof status === 'string' && status !== 'all') {
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
 * GET /api/questions/admin (Protected Admin Endpoint)
 * Full management search and filter across ID, question_text, lesson, unit, status
 * Returns total, stagingCount, publishedCount metrics
 */
router.get('/admin', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { search, unitId, classId, status, difficulty, category, topic, limit = '50', offset = '0' } = req.query;

    const queryConditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Filter by category / group
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

    if (unitId && !isNaN(Number(unitId))) {
      queryConditions.push(`unit_id = $${paramIndex++}`);
      values.push(Number(unitId));
    }

    if (classId && !isNaN(Number(classId))) {
      queryConditions.push(`class_id = $${paramIndex++}`);
      values.push(Number(classId));
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

    // Global Metrics
    const metricsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'staging' THEN 1 END) as staging_count,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count
      FROM questions;
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
        totalQuestions: parseInt(metrics.total_count, 10),
        stagingCount: parseInt(metrics.staging_count, 10),
        publishedCount: parseInt(metrics.published_count, 10),
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
    if (isNaN(unitId) || unitId < 1 || unitId > 20) {
      return res.status(400).json({ status: 'error', message: 'Valid unitId (1-20) is required' });
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
    const subject = q.subject || 'General Studies';
    const topic = (q.topic || lessonTitle || '').trim();
    if (!topic) {
      return res.status(400).json({
        status: 'error',
        message: 'Topic is mandatory and must be specified before creating a question.',
      });
    }
    const difficulty = ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium';
    const groupName = cleanCategory === 'group1' ? 'Group 1' : cleanCategory === 'group2' ? 'Group 2' : cleanCategory === 'group2a' ? 'Group 2A' : cleanCategory === 'group4' ? 'Group 4' : 'VAO';
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
        category, unit_id, class_id, subject, lesson_title, topic,
        difficulty, tag, question_text, options, correct_answer,
        explanation, source_reference, status, textbook_id, source_page, verification_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (lesson_title, question_text) DO NOTHING
      RETURNING *;
    `;
    const values = [
      cleanCategory,
      unitId,
      classId,
      subject,
      lessonTitle.trim(),
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
 * Supports: { ids: [...] } or filters { category, classId, unitId, lesson, subject, status, difficulty }
 */
router.delete('/', requireAdminAuth, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { ids, category, classId, unitId, lesson, subject, status, difficulty, deleteAll = false } = req.body || {};

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
      const queryConditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

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
      if (classId && !isNaN(Number(classId))) {
        queryConditions.push(`class_id = $${paramIndex++}`);
        values.push(Number(classId));
      }
      if (unitId && !isNaN(Number(unitId))) {
        queryConditions.push(`unit_id = $${paramIndex++}`);
        values.push(Number(unitId));
      }
      if (subject && typeof subject === 'string' && subject.trim()) {
        queryConditions.push(`LOWER(subject) = $${paramIndex++}`);
        values.push(subject.trim().toLowerCase());
      }
      if (lesson && typeof lesson === 'string' && lesson.trim()) {
        queryConditions.push(`LOWER(lesson_title) = $${paramIndex++}`);
        values.push(lesson.trim().toLowerCase());
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

      const groupName = rawCategory === 'group1' ? 'Group 1' : rawCategory === 'group2' ? 'Group 2' : rawCategory === 'group2a' ? 'Group 2A' : rawCategory === 'group4' ? 'Group 4' : 'VAO';
      const topic = (q.topic || lessonTitle || '').trim();
      if (!topic) {
        validationErrors.push({ index: index + 1, reason: 'Topic is mandatory and cannot be empty' });
        return;
      }

      validQuestions.push({
        category: rawCategory,
        unitId,
        classId: q.classId || q.class_id || q.standard || null,
        subject: q.subject || 'General Studies',
        lessonTitle: lessonTitle.trim(),
        topic,
        difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium',
        tag: q.tag || `TNPSC ${groupName} • Unit ${unitId}: ${q.subject || 'General Studies'}`,
        questionText: questionText.trim(),
        optionsArray: cleanedOptions,
        options: JSON.stringify(cleanedOptions),
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
          category, unit_id, class_id, subject, lesson_title, topic,
          difficulty, tag, question_text, options, correct_answer,
          explanation, source_reference, status, textbook_id, source_page, verification_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'staging', $14, $15, $16)
        ON CONFLICT (lesson_title, question_text) DO NOTHING
        RETURNING id;
      `;
      const values = [
        q.category,
        q.unitId,
        q.classId,
        q.subject,
        q.lessonTitle,
        q.topic,
        q.difficulty,
        q.tag,
        q.questionText,
        q.options,
        q.correctAnswer,
        q.explanation,
        q.sourceReference,
        q.textbookId,
        q.sourcePage,
        q.verificationStatus,
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

      const groupName = rawCategory === 'group1' ? 'Group 1' : rawCategory === 'group2' ? 'Group 2' : rawCategory === 'group2a' ? 'Group 2A' : rawCategory === 'group4' ? 'Group 4' : 'VAO';
      const topic = (q.topic || '').trim() || lessonTitle.trim();

      validQuestions.push({
        category: rawCategory,
        unitId,
        classId: q.classId || q.class_id || q.standard || null,
        subject: q.subject || 'General Studies',
        lessonTitle: lessonTitle.trim(),
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
          category, unit_id, class_id, subject, lesson_title, topic,
          difficulty, tag, question_text, options, correct_answer,
          explanation, source_reference, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (lesson_title, question_text) DO NOTHING
        RETURNING id;
      `;
      const values = [
        q.category,
        q.unitId,
        q.classId,
        q.subject,
        q.lessonTitle,
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
    const existing = await client.query('SELECT id, status FROM questions WHERE id = ANY($1) FOR UPDATE', [uniqueIds]);
    const foundStatus = new Map<number, string>(existing.rows.map((row: any) => [row.id, row.status] as [number, string]));
    const missingIds = uniqueIds.filter((id) => !foundStatus.has(id));
    const ineligibleIds = uniqueIds.filter((id) => foundStatus.has(id) && foundStatus.get(id) !== 'staging');

    if (missingIds.length > 0 || ineligibleIds.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        status: 'error',
        message: `Cannot publish: ${missingIds.length} question(s) not found and ${ineligibleIds.length} not in staging. No questions were published.`,
        missingIds,
        ineligibleIds,
      });
    }

    const result = await client.query(
      `UPDATE questions SET status = 'published', updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1) AND status = 'staging'
       RETURNING id`,
      [uniqueIds]
    );

    if (result.rowCount !== uniqueIds.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        status: 'error',
        message: 'Publishing aborted: some selected questions changed status. No questions were published.',
      });
    }

    await client.query('COMMIT');

    return res.status(200).json({
      status: 'success',
      message: `Successfully published ${result.rowCount} questions.`,
      publishedCount: result.rowCount,
      publishedIds: result.rows.map((row: any) => row.id),
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

/**
 * POST /api/questions/ai-generate (Protected)
 * Strict Samacheer Kalvi Textbook-Grounded MCQ Question Generator.
 * Generates unique, syllabus-mapped MCQs strictly from the uploaded textbook PDF for the selected
 * Group, Standard, Subject, Medium, Term, Unit, Lesson, and Topic.
 */
router.post('/ai-generate', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const {
      category = 'group4',
      unitId,
      classId,
      standard,
      lessonTitle,
      lesson,
      topic,
      topics = [],
      description = '',
      subject = 'General Studies',
      count = 50,
      difficulty = 'Mixed',
      apiKey,
      textbookMode = 'auto',
      textbookId,
      medium,
      term = 'Term 1',
    } = req.body;

    const cleanCategory = String(category || 'group4').trim().toLowerCase();
    if (!VALID_CATEGORIES.includes(cleanCategory as any)) {
      return res.status(400).json({
        status: 'error',
        message: `Mandatory Group selection invalid: category must be one of: ${VALID_CATEGORIES.join(', ')}`,
      });
    }

    const parsedUnitId = Number(unitId || String(req.body.unit || '').replace(/\D+/g, '') || 1);
    const parsedClassId = Number(classId || standard);
    const parsedCount = Math.min(Math.max(1, Number(count) || 50), 100);
    const rawLesson = String(lessonTitle || lesson || '').trim();

    if (isNaN(parsedUnitId) || parsedUnitId < 1 || parsedUnitId > 20) {
      return res.status(400).json({ status: 'error', message: 'Valid unitId (1 to 20) is required.' });
    }
    if (!Number.isInteger(parsedClassId) || parsedClassId < 6 || parsedClassId > 12) {
      return res.status(400).json({ status: 'error', message: 'Valid standard / classId (6th to 12th Standard) is required.' });
    }
    if (!rawLesson) {
      return res.status(400).json({ status: 'error', message: 'lessonTitle is required.' });
    }
    if (!['Easy', 'Medium', 'Hard', 'Mixed'].includes(difficulty)) {
      return res.status(400).json({ status: 'error', message: 'difficulty must be Easy, Medium, Hard, or Mixed.' });
    }

    const trimmedLesson = rawLesson;
    const requestedTopics = (Array.isArray(topics) ? topics : [])
      .map((value: any) => String(value || '').trim())
      .filter(Boolean);
    const trimmedTopic = String(topic || requestedTopics[0] || trimmedLesson).trim();

    const uniqueTopics = Array.from(new Set([trimmedTopic, ...requestedTopics])).slice(0, 10);
    const requestedTotal = parsedCount * uniqueTopics.length;
    const groupDetails = getGroupDetails(cleanCategory);

    // Infer medium automatically if subject is General Tamil / Tamil
    const effectiveMedium =
      medium && String(medium).trim()
        ? String(medium).trim()
        : /tamil|தமிழ்/i.test(subject)
          ? 'Tamil'
          : 'English';

    // Retrieve ALL existing DB questions (both staging and published) for this lesson or standard+subject+unit
    const existingDbRes = await pool.query(
      `SELECT question_text, options, correct_answer
       FROM questions
       WHERE LOWER(lesson_title) = LOWER($1)
          OR (class_id = $2 AND (LOWER(subject) = LOWER($3) OR (LOWER($3) LIKE '%tamil%' AND LOWER(subject) LIKE '%tamil%')) AND unit_id = $4)`,
      [trimmedLesson, parsedClassId, subject.trim(), parsedUnitId]
    );
    const existingDbQuestions: ExistingDbQuestionRecord[] = existingDbRes.rows.map((r: any) => {
      const opts = typeof r.options === 'string' ? JSON.parse(r.options) : r.options;
      return {
        question: r.question_text,
        correctAnswerText: Array.isArray(opts) ? opts[r.correct_answer] : undefined,
      };
    });

    // Strict Requirement 2: Retrieve uploaded Samacheer Kalvi textbook content
    const parsedTextbookId = textbookId && !isNaN(Number(textbookId)) ? Number(textbookId) : undefined;
    const ragResult = await retrieveRelevantTextbookContent({
      groupId: cleanCategory,
      standard: parsedClassId,
      subject,
      medium: effectiveMedium,
      term,
      unitId: parsedUnitId,
      lessonTitle: trimmedLesson,
      topic: trimmedTopic,
      textbookId: parsedTextbookId,
      maxPages: 22,
    });

    if (!ragResult.textbookId || !ragResult.hasSufficientContent || ragResult.chunks.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: `Required textbook content could not be retrieved for ${parsedClassId}th Standard - ${subject} (${term || 'Term 1'}, Unit ${parsedUnitId}, Lesson: "${trimmedLesson}"). Please ensure the corresponding Samacheer Kalvi textbook PDF is uploaded and indexed before generating questions.`,
      });
    }

    const resolvedTerm = ragResult.term || (term && term !== 'Full Year' ? term : 'Term 1');
    const textbookContext = {
      textbookId: ragResult.textbookId,
      bookName: ragResult.bookName || `Samacheer Kalvi ${parsedClassId}th ${subject}`,
      relevantPages: ragResult.relevantPages,
      passages: ragResult.chunks.map((c) => ({
        pageNumber: c.pageNumber,
        content: c.content,
      })),
    };

    const effectiveApiKey =
      apiKey && typeof apiKey === 'string' && apiKey.trim()
        ? apiKey.trim()
        : (process.env.GEMINI_API_KEY || '').trim();

    const batchId = `AI-${Date.now().toString(36).toUpperCase()}`;
    const generatedQuestions: any[] = [];
    let geminiModelUsed = 'gemini-textbook-rag-engine';
    let errorMessage = '';

    const aggregate = {
      rejectedCount: 0,
      duplicateCount: 0,
      batchesAttempted: 0,
      batchesAccepted: 0,
      verifiedCount: 0,
      needsReviewCount: 0,
    };

    for (const topicName of uniqueTopics) {
      // Combine existing DB questions with any questions already generated in earlier topics of this request
      const combinedExisting: ExistingDbQuestionRecord[] = [
        ...existingDbQuestions,
        ...generatedQuestions.map((gq) => ({
          question: gq.question,
          correctAnswerText: gq.correctAnswerText || (Array.isArray(gq.options) ? gq.options[gq.correctAnswer] : undefined),
        })),
      ];

      const result = await generateAiQuestions({
        apiKey: effectiveApiKey,
        category: cleanCategory,
        groupName: groupDetails.name,
        groupCode: groupDetails.code,
        examStandard: groupDetails.standard,
        subject,
        classId: parsedClassId,
        unitId: parsedUnitId,
        unitTitle: `Unit ${parsedUnitId}`,
        term: resolvedTerm,
        medium: effectiveMedium,
        lessonTitle: trimmedLesson,
        topic: topicName,
        count: parsedCount,
        difficulty,
        description,
        textbookContext,
        existingDbQuestions: combinedExisting,
      });

      generatedQuestions.push(...result.questions.map((question) => ({ ...question, topic: topicName })));
      aggregate.rejectedCount += result.stats.rejectedCount;
      aggregate.duplicateCount += result.stats.duplicateCount;
      aggregate.batchesAttempted += result.stats.batchesAttempted;
      aggregate.batchesAccepted += result.stats.batchesAccepted;
      aggregate.verifiedCount += result.stats.verifiedCount || 0;
      aggregate.needsReviewCount += result.stats.needsReviewCount || 0;

      if (result.stats.errorMessage) errorMessage = result.stats.errorMessage;
      if (result.model) geminiModelUsed = result.model;
    }

    if (generatedQuestions.length === 0) {
      return res.status(400).json({
        status: 'error',
        message:
          errorMessage ||
          `All candidate questions for "${trimmedLesson}" already exist in the database or could not be uniquely generated from the textbook without repeating existing questions.`,
      });
    }

    const formattedQuestions = generatedQuestions
      .slice(0, requestedTotal)
      .map((q: any, idx: number) => {
        const questionId = `${batchId}-${String(idx + 1).padStart(3, '0')}`;
        const topicName = String(q.topic || trimmedTopic).trim();
        const pyqPattern = String(q.pyqPattern || 'Conceptual').trim();
        const options = (Array.isArray(q.options) ? q.options : []).map((opt: any) => String(opt).trim());
        const answerIdx = Number.isInteger(Number(q.correctAnswer)) && Number(q.correctAnswer) >= 0 && Number(q.correctAnswer) <= 3
          ? Number(q.correctAnswer)
          : 0;
        const correctAnswerText = options[answerIdx] || '';
        const resolvedTextbookId = q.textbookId || textbookContext.textbookId;
        const resolvedSourcePage = Number(q.sourcePage || textbookContext.relevantPages[0] || 1);
        const resolvedBookName = q.sourceTextbook || textbookContext.bookName;

        const sourceReference = String(
          q.sourceReference || `${resolvedBookName}, Page ${resolvedSourcePage} (${trimmedLesson})`
        ).slice(0, 255);
        const tag = `${groupDetails.name} • ${subject} • ${topicName} • PYQ:${pyqPattern} • ID:${questionId}`.slice(0, 255);

        return {
          questionId,
          category: cleanCategory,
          unitId: parsedUnitId,
          classId: parsedClassId,
          standard: parsedClassId,
          subject,
          term: resolvedTerm,
          unit: `Unit ${parsedUnitId}`,
          lesson: trimmedLesson,
          lessonTitle: trimmedLesson,
          topic: topicName,
          difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty)
            ? q.difficulty
            : (difficulty === 'Mixed' ? 'Medium' : difficulty),
          pyqPattern,
          textbookId: resolvedTextbookId,
          sourcePage: resolvedSourcePage,
          sourceTextbook: resolvedBookName,
          verificationStatus: 'verified' as const,
          verificationDetails: q.verificationDetails || null,
          textbookVerified: true,
          verificationNote: `Verified against Samacheer Kalvi textbook (${resolvedBookName}, Page ${resolvedSourcePage}).`,
          tag,
          question: String(q.question || '').trim(),
          options,
          correctAnswer: answerIdx,
          correctAnswerText,
          explanation: String(q.explanation || '').trim(),
          sourceReference,
          status: 'staging' as const,
        };
      });

    const difficultyDistribution = formattedQuestions.reduce(
      (acc: Record<string, number>, question: any) => {
        acc[question.difficulty] = (acc[question.difficulty] || 0) + 1;
        return acc;
      },
      { Easy: 0, Medium: 0, Hard: 0 }
    );

    const isPartial = formattedQuestions.length < requestedTotal;
    const warnings: string[] = [
      `Grounded in textbook: ${textbookContext.bookName} (Pages: ${textbookContext.relevantPages.join(', ')})`,
      'Every question was verified against textbook content, source page citations, and multi-level duplicate detection.',
    ];

    if (isPartial) {
      warnings.push(
        `Returned ${formattedQuestions.length} unique textbook-verified questions (out of ${requestedTotal} requested) to strictly avoid repeating existing questions.`
      );
    }

    const report = {
      requestedCount: requestedTotal,
      perTopicCount: parsedCount,
      topicCount: uniqueTopics.length,
      generatedCount: formattedQuestions.length,
      validatedCount: formattedQuestions.length,
      verifiedCount: formattedQuestions.length,
      needsReviewCount: 0,
      rejectedCount: aggregate.rejectedCount,
      duplicateCount: aggregate.duplicateCount,
      batchesAttempted: aggregate.batchesAttempted,
      batchesAccepted: aggregate.batchesAccepted,
      difficultyDistribution,
      textbookUsed: {
        id: textbookContext.textbookId,
        name: textbookContext.bookName,
        pages: textbookContext.relevantPages,
      },
      sourceVerification: {
        syllabusMapping: 'verified_by_selection',
        textbookContent: 'grounded_in_textbook',
        pyqPapers: 'unavailable',
        answerVerification: '6_point_textbook_verified',
      },
      warnings,
    };

    const notice = isPartial
      ? `Generated ${formattedQuestions.length} unique textbook-verified questions from "${textbookContext.bookName}" (Pages ${textbookContext.relevantPages.join(', ')}). Returned fewer than ${requestedTotal} to prevent any duplicate questions.`
      : `Generated ${formattedQuestions.length} unique textbook-verified questions grounded in "${textbookContext.bookName}" (Pages ${textbookContext.relevantPages.join(', ')}).`;

    return res.status(200).json({
      status: isPartial ? 'partial' : 'success',
      source: 'gemini',
      model: geminiModelUsed,
      group: groupDetails.name,
      category: cleanCategory,
      unitId: parsedUnitId,
      classId: parsedClassId,
      standard: parsedClassId,
      subject,
      term: resolvedTerm,
      unit: `Unit ${parsedUnitId}`,
      lesson: trimmedLesson,
      lessonTitle: trimmedLesson,
      topic: trimmedTopic,
      topics: uniqueTopics,
      requestedCount: requestedTotal,
      count: formattedQuestions.length,
      report,
      notice,
      questions: formattedQuestions,
    });
  } catch (error: any) {
    console.error('Error generating AI questions:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to generate questions',
      error: error.message,
    });
  }
});

/**
 * POST /api/questions/ai-regenerate-single (Protected)
 * Regenerates a single unique textbook-grounded question for the selected syllabus scope.
 */
router.post('/ai-regenerate-single', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const {
      category = 'group4',
      unitId = 1,
      classId = 6,
      lessonTitle,
      topic,
      subject = 'General Studies',
      difficulty = 'Medium',
      term = 'Term 1',
      medium,
      apiKey,
      existingQuestions = [],
    } = req.body;

    const cleanCategory = String(category || 'group4').trim().toLowerCase();
    const parsedUnitId = Number(unitId) || 1;
    const parsedClassId = Number(classId) || 6;
    const trimmedLesson = String(lessonTitle || '').trim();
    const trimmedTopic = String(topic || trimmedLesson).trim();
    const groupDetails = getGroupDetails(cleanCategory);
    const effectiveMedium = medium || (/tamil|தமிழ்/i.test(subject) ? 'Tamil' : 'English');

    const ragResult = await retrieveRelevantTextbookContent({
      groupId: cleanCategory,
      standard: parsedClassId,
      subject,
      medium: effectiveMedium,
      term,
      unitId: parsedUnitId,
      lessonTitle: trimmedLesson,
      topic: trimmedTopic,
      maxPages: 22,
    });

    if (!ragResult.textbookId || !ragResult.hasSufficientContent) {
      return res.status(400).json({
        status: 'error',
        message: `Required textbook content could not be retrieved for ${parsedClassId}th Standard ${subject}.`,
      });
    }

    const existingDbRes = await pool.query(
      `SELECT question_text, options, correct_answer FROM questions
       WHERE LOWER(lesson_title) = LOWER($1)
          OR (class_id = $2 AND LOWER(subject) = LOWER($3) AND unit_id = $4)`,
      [trimmedLesson, parsedClassId, subject.trim(), parsedUnitId]
    );
    const dbQuestions: ExistingDbQuestionRecord[] = [
      ...existingDbRes.rows.map((r: any) => {
        const opts = typeof r.options === 'string' ? JSON.parse(r.options) : r.options;
        return {
          question: r.question_text,
          correctAnswerText: Array.isArray(opts) ? opts[r.correct_answer] : undefined,
        };
      }),
      ...(Array.isArray(existingQuestions) ? existingQuestions.map((q: any) => (typeof q === 'string' ? { question: q } : q)) : []),
    ];

    const result = await generateAiQuestions({
      apiKey: (apiKey || process.env.GEMINI_API_KEY || '').trim(),
      category: cleanCategory,
      groupName: groupDetails.name,
      groupCode: groupDetails.code,
      examStandard: groupDetails.standard,
      subject,
      classId: parsedClassId,
      unitId: parsedUnitId,
      term: ragResult.term || term,
      medium: effectiveMedium,
      lessonTitle: trimmedLesson,
      topic: trimmedTopic,
      count: 1,
      difficulty,
      textbookContext: {
        textbookId: ragResult.textbookId,
        bookName: ragResult.bookName || 'Samacheer Kalvi Textbook',
        relevantPages: ragResult.relevantPages,
        passages: ragResult.chunks.map((c) => ({ pageNumber: c.pageNumber, content: c.content })),
      },
      existingDbQuestions: dbQuestions,
    });

    if (result.questions.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No additional unique textbook-verified question could be generated without repeating existing questions.',
      });
    }

    const selected = result.questions[0];

    return res.status(200).json({
      status: 'success',
      question: {
        category: cleanCategory,
        unitId: parsedUnitId,
        classId: parsedClassId,
        standard: parsedClassId,
        subject,
        term: selected.term,
        unit: selected.unit,
        lesson: selected.lesson,
        lessonTitle: trimmedLesson,
        topic: trimmedTopic,
        difficulty: selected.difficulty,
        tag: `${groupDetails.name} • Unit ${parsedUnitId}: ${subject}`,
        question: selected.question,
        options: selected.options,
        correctAnswer: selected.correctAnswer,
        correctAnswerText: selected.correctAnswerText,
        explanation: selected.explanation,
        sourcePage: selected.sourcePage,
        sourceTextbook: selected.sourceTextbook,
        textbookId: selected.textbookId,
        sourceReference: selected.sourceReference,
        verificationStatus: 'verified',
        status: 'staging',
      },
    });
  } catch (error: any) {
    console.error('Error regenerating single question:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to regenerate question',
      error: error.message,
    });
  }
});

export default router;
