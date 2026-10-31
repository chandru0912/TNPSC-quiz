import { Router, Request, Response } from 'express';
import { PoolClient } from 'pg';
import pool from '../db';
import { requireAdminAuth } from '../middleware/auth';
import {
  isSemanticallyDuplicate,
  isValidQuestionText,
  resolveCorrectAnswerIndex,
  ExistingDbQuestionRecord,
} from '../services/aiMcqEngine';
import { mapRowToQuestion, QuestionDTO } from './questions';

const router = Router();

/**
 * GET /api/study-materials/questions (Public Student Practice Endpoint)
 * Strictly queries ONLY questions with target_system = 'study_materials' AND status = 'published'.
 * NEVER returns Main MCQ Practice questions.
 * Filter by: group (category), subject (subjectId), standard (classId), unitId, lessonId, lesson (lessonTitle), language.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      group,
      category,
      subject,
      subjectId,
      standard,
      classId,
      unitId,
      unit,
      lessonId,
      lesson,
      lessonTitle,
      language = 'tamil',
      limit = '300',
      offset = '0',
    } = req.query;

    const queryConditions: string[] = ["target_system = 'study_materials'", "status = 'published'"];
    const values: any[] = [];
    let paramIndex = 1;

    // 1. Exam Group / Category Filter
    const rawGroup = (group || category) as string | undefined;
    if (rawGroup && typeof rawGroup === 'string' && rawGroup !== 'all') {
      const cleanGroup = rawGroup.trim().toLowerCase();
      if (cleanGroup === 'group2_2a' || cleanGroup === 'group2' || cleanGroup === 'group2a') {
        queryConditions.push(`(category IN ('group2', 'group2a', 'group2_2a') OR exam_group_id IN ('group2', 'group2a', 'group2_2a'))`);
      } else if (cleanGroup === 'group4_vao' || cleanGroup === 'group4' || cleanGroup === 'vao') {
        queryConditions.push(`(category IN ('group4', 'vao', 'group4_vao') OR exam_group_id IN ('group4', 'vao', 'group4_vao'))`);
      } else {
        queryConditions.push(`(category = $${paramIndex} OR exam_group_id = $${paramIndex})`);
        values.push(cleanGroup);
        paramIndex++;
      }
    }

    // 2. Unit Filter
    const parsedUnit = Number(unitId || unit);
    if (!isNaN(parsedUnit) && parsedUnit > 0) {
      queryConditions.push(`unit_id = $${paramIndex++}`);
      values.push(parsedUnit);
    }

    // 3. Standard / Class Filter
    const parsedClass = Number(classId || standard);
    if (!isNaN(parsedClass) && parsedClass > 0) {
      queryConditions.push(`(class_id = $${paramIndex} OR standard_id = $${paramIndex} OR class_id IS NULL)`);
      values.push(parsedClass);
      paramIndex++;
    }

    // 4. Subject Filter
    const rawSubj = (subject || subjectId) as string | undefined;
    if (rawSubj && typeof rawSubj === 'string' && rawSubj.trim() !== '' && rawSubj.toLowerCase() !== 'all') {
      const cleanSubj = rawSubj.trim().toLowerCase();
      if (cleanSubj.includes('tamil') || cleanSubj.includes('தமிழ்')) {
        queryConditions.push(`(LOWER(subject) LIKE '%tamil%' OR LOWER(subject) LIKE '%தமிழ்%' OR subject_id = 'general-tamil')`);
      } else if (cleanSubj.includes('english')) {
        queryConditions.push(`(LOWER(subject) LIKE '%english%' OR subject_id = 'general-english')`);
      } else if (cleanSubj.includes('aptitude')) {
        queryConditions.push(`(LOWER(subject) LIKE '%aptitude%' OR subject_id = 'aptitude')`);
      } else if (cleanSubj === 'general-studies' || cleanSubj === 'general studies') {
        queryConditions.push(`(LOWER(subject) IN ('general studies', 'general-studies', 'general science', 'geography', 'history & inm', 'indian polity', 'economy & tn admin', 'tamil nadu heritage') OR subject_id = 'general-studies')`);
      } else {
        queryConditions.push(`(LOWER(subject) = $${paramIndex} OR subject_id = $${paramIndex})`);
        values.push(cleanSubj);
        paramIndex++;
      }
    }

    // 5. Strict Lesson Filter (Exact 1-to-1 mapping)
    const cleanLessonId = lessonId && typeof lessonId === 'string' && lessonId.trim() !== 'all' ? lessonId.trim() : null;
    const cleanLessonTitle = (lessonTitle || lesson) as string | undefined;
    const cleanTitle = cleanLessonTitle && typeof cleanLessonTitle === 'string' && cleanLessonTitle.trim() !== 'all' ? cleanLessonTitle.trim() : null;

    if (cleanLessonId && cleanTitle) {
      queryConditions.push(`(lesson_id = $${paramIndex} OR (lesson_id IS NULL AND LOWER(TRIM(lesson_title)) = LOWER(TRIM($${paramIndex + 1}))))`);
      values.push(cleanLessonId);
      values.push(cleanTitle);
      paramIndex += 2;
    } else if (cleanLessonId) {
      queryConditions.push(`lesson_id = $${paramIndex++}`);
      values.push(cleanLessonId);
    } else if (cleanTitle) {
      queryConditions.push(`LOWER(TRIM(lesson_title)) = LOWER(TRIM($${paramIndex++}))`);
      values.push(cleanTitle);
    }

    // 6. Strict Language Filter
    if (language && typeof language === 'string') {
      const cleanLang = language.trim().toLowerCase();
      if (cleanLang === 'english') {
        queryConditions.push(`LOWER(language) = 'english'`);
      } else {
        // Tamil is default; also accommodates legacy rows where language is null
        queryConditions.push(`(LOWER(language) = 'tamil' OR language IS NULL)`);
      }
    }

    const whereClause = `WHERE ${queryConditions.join(' AND ')}`;
    const safeLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || 300), 500);
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

    const questions: QuestionDTO[] = dataResult.rows.map(mapRowToQuestion);

    return res.status(200).json({
      status: 'success',
      targetSystem: 'study_materials',
      total: totalCount,
      count: questions.length,
      limit: safeLimit,
      offset: safeOffset,
      data: questions,
    });
  } catch (error: any) {
    console.error('Error fetching Study Materials questions:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve Study Materials questions from database',
      error: error.message,
    });
  }
});

/**
 * GET /api/study-materials/questions/admin (Protected Admin Endpoint)
 * List and filter Study Materials questions (staging and published)
 */
router.get('/admin', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const {
      search,
      group,
      category,
      subject,
      classId,
      standard,
      unitId,
      lessonId,
      lessonTitle,
      lesson,
      language,
      status,
      difficulty,
      limit = '50',
      offset = '0',
    } = req.query;

    const queryConditions: string[] = ["target_system = 'study_materials'"];
    const values: any[] = [];
    let paramIndex = 1;

    // Filter by group
    const rawGroup = (group || category) as string | undefined;
    if (rawGroup && typeof rawGroup === 'string' && rawGroup !== 'all') {
      const cleanGroup = rawGroup.trim().toLowerCase();
      if (cleanGroup === 'group2_2a' || cleanGroup === 'group2' || cleanGroup === 'group2a') {
        queryConditions.push(`(category IN ('group2', 'group2a', 'group2_2a') OR exam_group_id IN ('group2', 'group2a', 'group2_2a'))`);
      } else if (cleanGroup === 'group4_vao' || cleanGroup === 'group4' || cleanGroup === 'vao') {
        queryConditions.push(`(category IN ('group4', 'vao', 'group4_vao') OR exam_group_id IN ('group4', 'vao', 'group4_vao'))`);
      } else {
        queryConditions.push(`(category = $${paramIndex} OR exam_group_id = $${paramIndex})`);
        values.push(cleanGroup);
        paramIndex++;
      }
    }

    // Filter by unit
    const parsedUnit = Number(unitId);
    if (!isNaN(parsedUnit) && parsedUnit > 0) {
      queryConditions.push(`unit_id = $${paramIndex++}`);
      values.push(parsedUnit);
    }

    // Filter by class / standard
    const parsedClass = Number(classId || standard);
    if (!isNaN(parsedClass) && parsedClass > 0) {
      queryConditions.push(`(class_id = $${paramIndex} OR standard_id = $${paramIndex})`);
      values.push(parsedClass);
      paramIndex++;
    }

    // Filter by subject
    if (subject && typeof subject === 'string' && subject !== 'all') {
      queryConditions.push(`LOWER(subject) = $${paramIndex++}`);
      values.push(subject.trim().toLowerCase());
    }

    // Filter by lessonId
    if (lessonId && typeof lessonId === 'string' && lessonId.trim() !== 'all') {
      queryConditions.push(`lesson_id = $${paramIndex++}`);
      values.push(lessonId.trim());
    }

    // Filter by lessonTitle
    const lTitle = (lessonTitle || lesson) as string | undefined;
    if (lTitle && typeof lTitle === 'string' && lTitle.trim() !== 'all') {
      queryConditions.push(`LOWER(TRIM(lesson_title)) = LOWER(TRIM($${paramIndex++}))`);
      values.push(lTitle.trim());
    }

    // Filter by language
    if (language && typeof language === 'string' && language !== 'all') {
      queryConditions.push(`LOWER(language) = $${paramIndex++}`);
      values.push(language.trim().toLowerCase());
    }

    // Filter by status
    if (status && typeof status === 'string' && status !== 'all') {
      queryConditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    // Filter by difficulty
    if (difficulty && typeof difficulty === 'string' && difficulty !== 'all') {
      queryConditions.push(`difficulty = $${paramIndex++}`);
      values.push(difficulty);
    }

    // Search query
    if (search && typeof search === 'string' && search.trim()) {
      const trimmed = search.trim();
      if (!isNaN(Number(trimmed))) {
        queryConditions.push(`(id = $${paramIndex} OR LOWER(question_text) LIKE $${paramIndex + 1} OR LOWER(lesson_title) LIKE $${paramIndex + 1})`);
        values.push(Number(trimmed));
        values.push(`%${trimmed.toLowerCase()}%`);
        paramIndex += 2;
      } else {
        queryConditions.push(`(LOWER(question_text) LIKE $${paramIndex} OR LOWER(lesson_title) LIKE $${paramIndex} OR LOWER(subject) LIKE $${paramIndex})`);
        values.push(`%${trimmed.toLowerCase()}%`);
        paramIndex++;
      }
    }

    const whereClause = `WHERE ${queryConditions.join(' AND ')}`;
    const safeLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || 50), 200);
    const safeOffset = Math.max(0, parseInt(offset as string, 10) || 0);

    // Global Metrics for Study Materials
    const metricsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'staging' THEN 1 END) as staging_count,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
        COUNT(DISTINCT unit_id) as units_count,
        COUNT(DISTINCT class_id) as classes_count
      FROM questions
      WHERE target_system = 'study_materials';
    `);
    const metrics = metricsResult.rows[0];

    const countQuery = `SELECT COUNT(*) AS filtered_total FROM questions ${whereClause}`;
    const countResult = await pool.query(countQuery, values);
    const filteredTotal = parseInt(countResult.rows[0].filtered_total, 10);

    const dataQuery = `
      SELECT * FROM questions 
      ${whereClause} 
      ORDER BY id DESC 
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const dataValues = [...values, safeLimit, safeOffset];
    const dataResult = await pool.query(dataQuery, dataValues);

    return res.status(200).json({
      status: 'success',
      targetSystem: 'study_materials',
      metrics: {
        totalQuestions: parseInt(metrics?.total_count || '0', 10),
        stagingCount: parseInt(metrics?.staging_count || '0', 10),
        publishedCount: parseInt(metrics?.published_count || '0', 10),
        unitsCount: parseInt(metrics?.units_count || '0', 10),
        classesCount: parseInt(metrics?.classes_count || '0', 10),
      },
      filteredTotal,
      data: dataResult.rows.map(mapRowToQuestion),
    });
  } catch (error: any) {
    console.error('Error fetching Study Materials admin questions:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve Study Materials questions',
      error: error.message,
    });
  }
});

/**
 * POST /api/study-materials/questions/upload (Protected)
 * Uploads Gemini AI generated questions directly into Study Materials staging.
 * Enforces target_system = 'study_materials'.
 */
router.post('/upload', requireAdminAuth, async (req: Request, res: Response) => {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    const rawList = Array.isArray(req.body) ? req.body : req.body?.questions;

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request body: expected an array of questions or { questions: [...] }',
      });
    }

    let insertedCount = 0;
    let skippedDuplicates = 0;
    const insertedIds: number[] = [];
    const validationErrors: { index: number; reason: string }[] = [];
    const validQuestions: any[] = [];

    rawList.forEach((q, index) => {
      const rawQuestionText = q.question || q.questionText || q.question_text;
      const lessonTitle = q.lessonTitle || q.lesson_title || q.lesson;
      const lessonId = (q.lessonId || q.lesson_id || req.body?.lessonId || '').trim() || null;
      const unitId = Number(q.unitId || q.unit_id || String(q.unit || '').replace(/\D+/g, '') || 1);
      const rawCorrectAnswer = q.correctAnswer !== undefined ? q.correctAnswer : q.correct_answer;
      let options = q.options;

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
      if (!Array.isArray(options) || options.length !== 4 || options.some((opt) => typeof opt !== 'string' || !opt.trim())) {
        validationErrors.push({ index: index + 1, reason: 'Options must have exactly 4 non-empty items' });
        return;
      }
      const cleanedOptions = options.map((opt: string) => String(opt).trim());
      const correctAnswer = resolveCorrectAnswerIndex(rawCorrectAnswer, cleanedOptions);
      if (correctAnswer < 0 || correctAnswer > 3) {
        validationErrors.push({ index: index + 1, reason: 'correctAnswer must match one of the 4 options or be index 0..3' });
        return;
      }

      const rawCategory = (q.category || req.body?.category || 'group2').trim().toLowerCase();
      const topic = (q.topic || lessonTitle || '').trim();
      const rawLang = String(q.language || req.body?.language || '').trim().toLowerCase();
      const resolvedLang = rawLang === 'english' ? 'english' : 'tamil';
      const classId = q.classId || q.class_id || q.standard || q.standardId || null;
      const subject = q.subject || 'General Studies';
      const subjectId = q.subjectId || q.subject_id || (subject ? subject.toLowerCase().replace(/\s+/g, '-') : 'general-studies');

      validQuestions.push({
        targetSystem: 'study_materials',
        category: rawCategory,
        examGroupId: rawCategory,
        unitId,
        classId,
        standardId: classId,
        subject,
        subjectId,
        lessonTitle: lessonTitle.trim(),
        lessonId,
        language: resolvedLang,
        topic,
        difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium',
        tag: q.tag || `TNPSC • Unit ${unitId}: ${subject}`,
        questionText: questionText.trim(),
        options: JSON.stringify(cleanedOptions),
        optionA: cleanedOptions[0],
        optionB: cleanedOptions[1],
        optionC: cleanedOptions[2],
        optionD: cleanedOptions[3],
        correctAnswer,
        correctAnswerText: cleanedOptions[correctAnswer],
        explanation: (q.explanation || 'No explanation provided.').trim(),
        sourceReference: q.sourceReference || q.source_reference || null,
        status: 'staging',
        textbookId: q.textbookId || q.textbook_id || null,
        sourcePage: q.sourcePage || q.source_page || null,
        verificationStatus: ['verified', 'needs_review', 'rejected'].includes(q.verificationStatus || q.verification_status)
          ? (q.verificationStatus || q.verification_status)
          : 'verified',
      });
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Validation failed: ${validationErrors.length} question(s) had errors.`,
        errors: validationErrors,
      });
    }

    if (validQuestions.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid questions found in upload',
      });
    }

    // Semantic Duplicate Check against Study Materials questions
    const uniqueLessons = Array.from(new Set(validQuestions.map((vq) => vq.lessonTitle.toLowerCase())));
    const existingDbRes = await client.query(
      `SELECT question_text, options, correct_answer FROM questions
       WHERE target_system = 'study_materials'
         AND (LOWER(lesson_title) = ANY($1) OR (class_id = $2 AND LOWER(subject) = LOWER($3) AND unit_id = $4))`,
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
          target_system, category, exam_group_id, unit_id, class_id, standard_id,
          subject, subject_id, lesson_title, lesson_id, language, topic,
          difficulty, tag, question_text, options, option_a, option_b, option_c, option_d,
          correct_answer, explanation, source_reference, status, textbook_id, source_page, verification_status
        )
        VALUES (
          'study_materials', $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, 'staging', $23, $24, $25
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
        q.language,
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
      targetSystem: 'study_materials',
      message: `Study Materials questions staged: ${insertedCount} inserted, ${skippedDuplicates} duplicates skipped.`,
      received: rawList.length,
      validated: validQuestions.length,
      inserted: insertedCount,
      skippedDuplicates,
      insertedIds,
    });
  } catch (error: any) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    console.error('Error in Study Materials upload:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to process Study Materials question upload',
      error: error.message,
    });
  } finally {
    client?.release();
  }
});

/**
 * PATCH /api/study-materials/questions/publish (Protected)
 * Publishes selected staging questions exclusively to Study Materials.
 * Validates that each question has valid lesson metadata.
 */
router.patch('/publish', requireAdminAuth, async (req: Request, res: Response) => {
  const { ids } = req.body || {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'A non-empty ids array is required.',
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

    // Lock selected rows strictly scoped to target_system = 'study_materials'
    const existing = await client.query(
      `SELECT id, status, lesson_id, lesson_title, target_system FROM questions 
       WHERE id = ANY($1) AND target_system = 'study_materials' FOR UPDATE`,
      [uniqueIds]
    );
    const foundStatus = new Map<number, string>(existing.rows.map((row: any) => [row.id, row.status] as [number, string]));
    const missingIds = uniqueIds.filter((id) => !foundStatus.has(id));
    const ineligibleIds = uniqueIds.filter((id) => foundStatus.has(id) && foundStatus.get(id) !== 'staging');

    if (missingIds.length > 0 || ineligibleIds.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        status: 'error',
        message: `Cannot publish: ${missingIds.length} question(s) not found in Study Materials and ${ineligibleIds.length} not in staging.`,
        missingIds,
        ineligibleIds,
      });
    }

    // Strict Lesson Mapping Validation
    const invalidLessonQuestions = existing.rows.filter((row: any) => {
      const hasLessonId = row.lesson_id && String(row.lesson_id).trim().length > 0;
      const hasLessonTitle = row.lesson_title && String(row.lesson_title).trim().length > 0;
      return !hasLessonId && !hasLessonTitle;
    });

    if (invalidLessonQuestions.length > 0) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        status: 'error',
        message: `Cannot publish: ${invalidLessonQuestions.length} question(s) lack required lesson metadata.`,
        invalidIds: invalidLessonQuestions.map((row: any) => row.id),
      });
    }

    const result = await client.query(
      `UPDATE questions 
       SET status = 'published', updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1) AND status = 'staging' AND target_system = 'study_materials'
       RETURNING id`,
      [uniqueIds]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      status: 'success',
      targetSystem: 'study_materials',
      message: `Successfully published ${result.rowCount} questions exclusively to Study Materials.`,
      publishedCount: result.rowCount,
      publishedIds: result.rows.map((row: any) => row.id),
    });
  } catch (error: any) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    console.error('Error publishing Study Materials questions:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to publish Study Materials questions',
      error: error.message,
    });
  } finally {
    client?.release();
  }
});

/**
 * DELETE /api/study-materials/questions (Batch / Filtered Deletion)
 * Deletes questions strictly belonging to target_system = 'study_materials'.
 */
router.delete('/', requireAdminAuth, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { ids, deleteAll = false } = req.body || {};

    if (Array.isArray(ids) && ids.length > 0) {
      const validIds = ids.filter((id: any) => !isNaN(Number(id))).map((id: any) => Number(id));
      if (validIds.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No valid question IDs provided' });
      }
      const result = await client.query(
        "DELETE FROM questions WHERE id = ANY($1) AND target_system = 'study_materials' RETURNING id",
        [validIds]
      );
      return res.status(200).json({
        status: 'success',
        message: `Deleted ${result.rowCount} Study Materials question(s)`,
        deletedCount: result.rowCount,
      });
    }

    if (deleteAll) {
      const result = await client.query("DELETE FROM questions WHERE target_system = 'study_materials' RETURNING id");
      return res.status(200).json({
        status: 'success',
        message: `Deleted all ${result.rowCount} Study Materials question(s)`,
        deletedCount: result.rowCount,
      });
    }

    return res.status(400).json({ status: 'error', message: 'Invalid deletion request. Provide ids array or deleteAll: true' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Failed to delete Study Materials questions', error: error.message });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/study-materials/questions/:id (Protected)
 * Deletes a question strictly belonging to Study Materials.
 */
router.delete('/:id(\\d+)', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await pool.query(
      `DELETE FROM questions WHERE id = $1 AND target_system = 'study_materials' RETURNING id`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ status: 'error', message: `Study Materials question #${id} not found` });
    }
    return res.status(200).json({
      status: 'success',
      message: `Study Materials question #${id} deleted successfully`,
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Failed to delete question', error: error.message });
  }
});

export default router;
