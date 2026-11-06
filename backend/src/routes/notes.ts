import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAdminAuth, verifyAdminToken } from '../middleware/auth';
import { cleanTamilUnicodeText } from '../services/tamilUnicodeCleaner';
import {
  computeContentHash,
  checkDuplicateNoteInDb,
  deduplicateMarkdownContent,
  getEquivalentCategories,
} from '../services/notesDeduplicator';
import { buildCanonicalLessonCode, resolveSyllabusLessonId } from '../services/lessonMapping';
import {
  splitAndAlignNotesByTopic,
  persistTopicAlignedNotes,
  migrateAllExistingStudyMaterials,
} from '../services/topicAlignmentService';

const router = Router();

function mapRowToNote(row: any) {
  return {
    id: row.id,
    category: row.category,
    unitId: row.unit_id,
    classId: row.class_id,
    subject: row.subject,
    term: row.term || 'Term 1',
    lessonId: row.lesson_id || null,
    lessonNumber: row.lesson_number || null,
    lessonCode: row.lesson_code || null,
    lessonTitle: cleanTamilUnicodeText(row.lesson_title || ''),
    topic: row.topic,
    language: row.language,
    title: cleanTamilUnicodeText(row.title || ''),
    content: cleanTamilUnicodeText(row.content || ''),
    contentHtml: row.content_html,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
    status: row.status,
    sourceReference: row.source_reference,
    coverageReport: row.coverage_report || null,
    topics: row.topics || null,
    contentHash: row.content_hash || null,
    deduplicationMeta: row.deduplication_meta || null,
    topicOrder: row.topic_order ?? 0,
    topicId: row.topic_id || null,
    subtopics: typeof row.subtopics === 'string' ? JSON.parse(row.subtopics) : (row.subtopics || []),
    generationStatus: row.generation_status || 'completed',
    generationMeta: row.generation_meta || null,
    noteFormat: row.note_format || 'short',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Public: Get notes
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      category,
      unitId,
      classId,
      lessonId,
      lesson_id,
      lessonNumber,
      lesson_number,
      lessonCode,
      lesson_code,
      term,
      lesson,
      subject,
      language,
      status,
      format,
      note_format,
      topic,
      topicId,
      topic_id,
      limit = '100',
      offset = '0',
      strictLanguage,
    } = req.query;

    const queryConditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (category && typeof category === 'string' && category !== 'all') {
      const cleanCat = category.trim().toLowerCase();
      if (cleanCat === 'group2_2a' || cleanCat === 'group2' || cleanCat === 'group2a') {
        queryConditions.push(`category IN ('group2', 'group2a', 'group2_2a')`);
      } else if (cleanCat === 'group4_vao' || cleanCat === 'group4' || cleanCat === 'vao') {
        queryConditions.push(`category IN ('group4', 'vao', 'group4_vao')`);
      } else if (cleanCat === 'group1') {
        queryConditions.push(`category IN ('group1')`);
      } else {
        queryConditions.push(`LOWER(category) = $${paramIndex++}`);
        values.push(cleanCat);
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

    if (subject && typeof subject === 'string' && subject.trim() && subject !== 'all') {
      const normSub = subject.trim().toLowerCase().replace(/-/g, ' ');
      queryConditions.push(`(
        LOWER(REPLACE(subject, '-', ' ')) = $${paramIndex}
        OR LOWER(subject) LIKE '%' || $${paramIndex} || '%'
        OR $${paramIndex} LIKE '%' || LOWER(REPLACE(subject, '-', ' ')) || '%'
      )`);
      values.push(normSub);
      paramIndex++;
    }

    if (term && typeof term === 'string' && term.trim() && term !== 'all') {
      const cleanTerm = term.trim();
      queryConditions.push(`(term IS NULL OR LOWER(term) = LOWER($${paramIndex++}) OR LOWER(term) = 'full year' OR LOWER($${paramIndex - 1}) = 'full year')`);
      values.push(cleanTerm);
    }

    // Exact lessonCode / lessonId / lessonNumber / lessonTitle matching
    const effectiveLessonCode = (typeof lessonCode === 'string' && lessonCode.trim() && lessonCode !== 'all')
      ? lessonCode.trim()
      : (typeof lesson_code === 'string' && lesson_code.trim() && lesson_code !== 'all')
        ? lesson_code.trim()
        : null;

    const effectiveLessonId = (typeof lessonId === 'string' && lessonId.trim() && lessonId !== 'all')
      ? lessonId.trim()
      : (typeof lesson_id === 'string' && lesson_id.trim() && lesson_id !== 'all')
        ? lesson_id.trim()
        : null;

    const effectiveLessonNumber = (typeof lessonNumber === 'string' && lessonNumber.trim() && lessonNumber !== 'all')
      ? lessonNumber.trim()
      : (typeof lesson_number === 'string' && lesson_number.trim() && lesson_number !== 'all')
        ? lesson_number.trim()
        : null;

    const hasLessonFilter = effectiveLessonCode || effectiveLessonId || effectiveLessonNumber || (lesson && typeof lesson === 'string' && lesson.trim() && lesson !== 'all');

    if (hasLessonFilter) {
      const lessonConditions: string[] = [];

      if (effectiveLessonCode) {
        lessonConditions.push(`(lesson_code = $${paramIndex} OR lesson_id = $${paramIndex})`);
        values.push(effectiveLessonCode);
        paramIndex++;
      }

      if (effectiveLessonId) {
        lessonConditions.push(`(lesson_id = $${paramIndex} OR lesson_code = $${paramIndex})`);
        values.push(effectiveLessonId);
        paramIndex++;
      }

      if (effectiveLessonNumber) {
        const cleanNum = effectiveLessonNumber.replace(/[^0-9.]/g, '');
        lessonConditions.push(`(
          lesson_number = $${paramIndex}
          OR lesson_number = $${paramIndex + 1}
          OR lesson_id LIKE '%' || $${paramIndex + 2} || '%'
          OR lesson_code LIKE '%' || $${paramIndex + 2} || '%'
        )`);
        values.push(effectiveLessonNumber, cleanNum, `l${cleanNum.replace('.', '_')}`);
        paramIndex += 3;
      }

      if (lesson && typeof lesson === 'string' && lesson.trim() && lesson !== 'all') {
        const trimmedLesson = lesson.trim();
        const stripped = trimmedLesson.replace(/^[0-9]+(\.[0-9]+)*[:\s-]*/, '').trim();
        lessonConditions.push(`(
          LOWER(lesson_title) = LOWER($${paramIndex})
          OR LOWER(title) = LOWER($${paramIndex})
          OR LOWER(lesson_title) LIKE '%' || LOWER($${paramIndex + 1}) || '%'
          OR LOWER($${paramIndex}) LIKE '%' || LOWER(lesson_title) || '%'
        )`);
        values.push(trimmedLesson, stripped || trimmedLesson);
        paramIndex += 2;
      }

      queryConditions.push(`(${lessonConditions.join(' OR ')})`);
    }

    let orderBy = 'created_at DESC, id DESC';
    if (effectiveLessonCode || effectiveLessonId || effectiveLessonNumber) {
      const rankP1 = effectiveLessonCode || '__none__';
      const rankP2 = effectiveLessonId || '__none__';
      const rankP3 = effectiveLessonNumber || '__none__';
      orderBy = `CASE 
        WHEN lesson_code = '${rankP1.replace(/'/g, "''")}' THEN 0
        WHEN lesson_id = '${rankP2.replace(/'/g, "''")}' THEN 1
        WHEN lesson_number = '${rankP3.replace(/'/g, "''")}' THEN 2
        ELSE 3
      END ASC, ${orderBy}`;
    }

    if (language && typeof language === 'string' && language !== 'all') {
      const lang = language.trim().toLowerCase();
      if (strictLanguage === 'true') {
        queryConditions.push(`LOWER(language) = $${paramIndex++}`);
        values.push(lang);
      } else {
        const safeLang = lang.replace(/[^a-z0-9]/gi, '');
        orderBy = `CASE WHEN LOWER(language) = '${safeLang}' THEN 0 ELSE 1 END, ${orderBy}`;
      }
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
      orderBy = `CASE WHEN status = 'published' THEN 0 ELSE 1 END, ${orderBy}`;
    }

    const effectiveFormat = format || note_format;
    if (effectiveFormat && typeof effectiveFormat === 'string' && (effectiveFormat === 'short' || effectiveFormat === 'full')) {
      queryConditions.push(`COALESCE(note_format, 'short') = $${paramIndex++}`);
      values.push(effectiveFormat.trim().toLowerCase());
    }

    const effectiveTopicId = (typeof topicId === 'string' && topicId) || (typeof topic_id === 'string' && topic_id);
    if (effectiveTopicId && effectiveTopicId !== 'all') {
      queryConditions.push(`(topic_id = $${paramIndex} OR topic = $${paramIndex})`);
      values.push(effectiveTopicId);
      paramIndex++;
    } else if (topic && typeof topic === 'string' && topic !== 'all') {
      queryConditions.push(`(topic = $${paramIndex} OR topic_id = $${paramIndex})`);
      values.push(topic);
      paramIndex++;
    }

    const whereClause = queryConditions.length > 0 ? `WHERE ${queryConditions.join(' AND ')}` : '';
    const safeLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || 100), 500);
    const safeOffset = Math.max(0, parseInt(offset as string, 10) || 0);

    const countQuery = `SELECT COUNT(*) AS total FROM study_notes ${whereClause}`;
    const totalResult = await pool.query(countQuery, values);
    const totalCount = parseInt(totalResult.rows[0].total, 10);

    const dataQuery = `
      SELECT * FROM study_notes 
      ${whereClause} 
      ORDER BY CASE WHEN topic_order > 0 THEN topic_order ELSE 99999 END ASC, ${orderBy}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const dataValues = [...values, safeLimit, safeOffset];
    const dataResult = await pool.query(dataQuery, dataValues);

    res.status(200).json({
      status: 'success',
      total: totalCount,
      count: dataResult.rows.length,
      limit: safeLimit,
      offset: safeOffset,
      data: dataResult.rows.map(mapRowToNote),
    });
  } catch (error: any) {
    console.error('Error fetching study notes:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve study notes',
      error: error.message,
    });
  }
});

// Admin: list all with rich search, syllabus cascade filters, pagination
router.get('/admin', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const {
      search,
      category,
      subject,
      classId,
      unitId,
      lessonId,
      lesson_id,
      lesson,
      status,
      language,
      format,
      note_format,
      topic,
      topicId,
      topic_id,
      limit = '50',
      offset = '0',
    } = req.query;

    const queryConditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      const numQ = Number(search.trim());
      if (!isNaN(numQ) && numQ > 0) {
        queryConditions.push(`(id = $${paramIndex} OR LOWER(title) LIKE $${paramIndex + 1} OR LOWER(lesson_title) LIKE $${paramIndex + 1} OR LOWER(content) LIKE $${paramIndex + 1})`);
        values.push(numQ, q);
        paramIndex += 2;
      } else {
        queryConditions.push(`(LOWER(title) LIKE $${paramIndex} OR LOWER(lesson_title) LIKE $${paramIndex} OR LOWER(subject) LIKE $${paramIndex} OR LOWER(content) LIKE $${paramIndex} OR LOWER(source_reference) LIKE $${paramIndex})`);
        values.push(q);
        paramIndex++;
      }
    }

    if (category && typeof category === 'string' && category !== 'all') {
      const cleanCat = category.trim().toLowerCase();
      if (cleanCat === 'group2_2a' || cleanCat === 'group2' || cleanCat === 'group2a') {
        queryConditions.push(`category IN ('group2', 'group2a', 'group2_2a')`);
      } else if (cleanCat === 'group4_vao' || cleanCat === 'group4' || cleanCat === 'vao') {
        queryConditions.push(`category IN ('group4', 'vao', 'group4_vao')`);
      } else if (cleanCat === 'group1') {
        queryConditions.push(`category IN ('group1')`);
      } else {
        queryConditions.push(`LOWER(category) = $${paramIndex++}`);
        values.push(cleanCat);
      }
    }

    if (subject && typeof subject === 'string' && subject !== 'all' && subject.trim()) {
      const normSub = subject.trim().toLowerCase().replace(/-/g, ' ');
      queryConditions.push(`(
        LOWER(REPLACE(subject, '-', ' ')) = $${paramIndex}
        OR LOWER(subject) LIKE '%' || $${paramIndex} || '%'
        OR $${paramIndex} LIKE '%' || LOWER(REPLACE(subject, '-', ' ')) || '%'
      )`);
      values.push(normSub);
      paramIndex++;
    }

    if (classId && classId !== 'all' && !isNaN(Number(classId))) {
      queryConditions.push(`class_id = $${paramIndex++}`);
      values.push(Number(classId));
    }

    if (unitId && unitId !== 'all' && !isNaN(Number(unitId))) {
      queryConditions.push(`unit_id = $${paramIndex++}`);
      values.push(Number(unitId));
    }

    const effectiveAdminLessonId = (typeof lessonId === 'string' && lessonId.trim() && lessonId !== 'all')
      ? lessonId.trim()
      : (typeof lesson_id === 'string' && lesson_id.trim() && lesson_id !== 'all')
        ? lesson_id.trim()
        : null;

    if (effectiveAdminLessonId) {
      if (lesson && typeof lesson === 'string' && lesson !== 'all' && lesson.trim()) {
        queryConditions.push(`(lesson_id = $${paramIndex} OR (lesson_id IS NULL AND LOWER(lesson_title) LIKE $${paramIndex + 1}))`);
        values.push(effectiveAdminLessonId, `%${lesson.trim().toLowerCase()}%`);
        paramIndex += 2;
      } else {
        queryConditions.push(`lesson_id = $${paramIndex++}`);
        values.push(effectiveAdminLessonId);
      }
    } else if (lesson && typeof lesson === 'string' && lesson !== 'all' && lesson.trim()) {
      const trimmedLesson = lesson.trim();
      const stripped = trimmedLesson.replace(/^[0-9]+(\.[0-9]+)*[:\s-]*/, '').trim();
      queryConditions.push(`(
        LOWER(lesson_title) LIKE $${paramIndex}
        OR LOWER(lesson_title) LIKE $${paramIndex + 1}
      )`);
      values.push(`%${trimmedLesson.toLowerCase()}%`, `%${(stripped || trimmedLesson).toLowerCase()}%`);
      paramIndex += 2;
    }

    if (status && typeof status === 'string' && status !== 'all') {
      queryConditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (language && typeof language === 'string' && language !== 'all') {
      queryConditions.push(`language = $${paramIndex++}`);
      values.push(language.toLowerCase());
    }

    const effectiveFormat = format || note_format;
    if (effectiveFormat && typeof effectiveFormat === 'string' && (effectiveFormat === 'short' || effectiveFormat === 'full')) {
      queryConditions.push(`COALESCE(note_format, 'short') = $${paramIndex++}`);
      values.push(effectiveFormat.trim().toLowerCase());
    }

    const effectiveTopicId = (typeof topicId === 'string' && topicId) || (typeof topic_id === 'string' && topic_id);
    if (effectiveTopicId && effectiveTopicId !== 'all') {
      queryConditions.push(`(topic_id = $${paramIndex} OR topic = $${paramIndex})`);
      values.push(effectiveTopicId);
      paramIndex++;
    } else if (topic && typeof topic === 'string' && topic !== 'all') {
      queryConditions.push(`(topic = $${paramIndex} OR topic_id = $${paramIndex})`);
      values.push(topic);
      paramIndex++;
    }

    const whereClause = queryConditions.length > 0 ? `WHERE ${queryConditions.join(' AND ')}` : '';
    const safeLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || 50), 200);
    const safeOffset = Math.max(0, parseInt(offset as string, 10) || 0);

    const countQuery = `SELECT COUNT(*) AS total FROM study_notes ${whereClause}`;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    const dataQuery = `
      SELECT * FROM study_notes 
      ${whereClause} 
      ORDER BY id DESC 
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const dataValues = [...values, safeLimit, safeOffset];
    const dataResult = await pool.query(dataQuery, dataValues);

    // Global Metrics for Study Notes HUD
    const metricsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'staging' THEN 1 END) as staging_count,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
        COUNT(DISTINCT class_id) as standards_count
      FROM study_notes;
    `);
    const metricsRow = metricsResult.rows[0];
    const metrics = {
      totalNotes: parseInt(metricsRow?.total_count || '0', 10),
      stagingCount: parseInt(metricsRow?.staging_count || '0', 10),
      publishedCount: parseInt(metricsRow?.published_count || '0', 10),
      classesCovered: parseInt(metricsRow?.standards_count || '0', 10),
    };

    res.status(200).json({
      status: 'success',
      total,
      metrics,
      limit: safeLimit,
      offset: safeOffset,
      data: dataResult.rows.map(mapRowToNote),
    });
  } catch (error: any) {
    console.error('Error in admin study notes query:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve admin study notes',
      error: error.message,
    });
  }
});

/**
 * GET /api/notes/metrics (Public / Admin)
 * Returns live HUD metrics for Study Notes.
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const metricsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'staging' THEN 1 END) as staging_count,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
        COUNT(DISTINCT class_id) as standards_count
      FROM study_notes;
    `);
    const metricsRow = metricsResult.rows[0];
    return res.status(200).json({
      status: 'success',
      metrics: {
        totalNotes: parseInt(metricsRow?.total_count || '0', 10),
        stagingCount: parseInt(metricsRow?.staging_count || '0', 10),
        publishedCount: parseInt(metricsRow?.published_count || '0', 10),
        classesCovered: parseInt(metricsRow?.standards_count || '0', 10),
      },
    });
  } catch (error: any) {
    console.error('Error in study notes metrics query:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve study notes metrics' });
  }
});

// Bulk publish study notes with strict duplicate prevention
router.post('/bulk-publish', requireAdminAuth, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No note IDs provided for bulk publish' });
    }
    const validIds = ids.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);
    if (validIds.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No valid note IDs provided' });
    }

    await client.query('BEGIN');

    // 1. Fetch details of all requested notes
    const notesQuery = await client.query(
      `SELECT id, category, subject, unit_id, class_id, lesson_id, lesson_title, content_hash, note_format
       FROM study_notes
       WHERE id = ANY($1)
       ORDER BY id DESC`,
      [validIds]
    );

    // 2. Deduplicate within the requested batch: keep at most 1 note per lesson and format
    const lessonSeen = new Set<string>();
    const noteIdsToPublish: number[] = [];
    let duplicatesSkipped = 0;

    for (const note of notesQuery.rows) {
      const normCat = getEquivalentCategories(note.category)[0];
      const noteFormat = note.note_format || 'short';
      const lessonKey = `${normCat}::${note.subject}::${note.unit_id}::${note.lesson_id || note.lesson_title.toLowerCase().trim()}::${noteFormat}`;
      if (lessonSeen.has(lessonKey)) {
        duplicatesSkipped++;
        continue;
      }
      lessonSeen.add(lessonKey);
      noteIdsToPublish.push(note.id);

      // 3. Archive any existing published note for this lesson and format to prevent duplicate live notes
      await client.query(
        `UPDATE study_notes
         SET status = 'archived', updated_at = CURRENT_TIMESTAMP
         WHERE status = 'published'
           AND id != $1
           AND category = ANY($2)
           AND unit_id = $3
           AND (lesson_id = $4 OR (lesson_id IS NULL AND LOWER(lesson_title) = LOWER($5)))
           AND COALESCE(note_format, 'short') = $6`,
        [note.id, getEquivalentCategories(note.category), note.unit_id, note.lesson_id, note.lesson_title, noteFormat]
      );
    }

    if (noteIdsToPublish.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ status: 'error', message: 'No unique notes available to publish' });
    }

    // 4. Mark the unique chosen notes as published
    const publishRes = await client.query(
      `UPDATE study_notes
       SET status = 'published', updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1)
       RETURNING id`,
      [noteIdsToPublish]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      status: 'success',
      message: `Published ${publishRes.rowCount} unique study note(s) successfully.${duplicatesSkipped > 0 ? ` (${duplicatesSkipped} duplicate lesson notes prevented).` : ''}`,
      publishedCount: publishRes.rowCount,
      duplicatesSkipped,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error in bulk-publish study notes:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to publish study notes', error: error.message });
  } finally {
    client.release();
  }
});

// Bulk upload study notes with strict duplicate detection
router.post('/bulk-upload', requireAdminAuth, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { notes } = req.body;
    if (!Array.isArray(notes) || notes.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No notes provided in bulk upload' });
    }

    await client.query('BEGIN');
    const insertedNotes = [];
    const batchSeenHashes = new Set<string>();
    let duplicatesSkipped = 0;

    for (const n of notes) {
      let rawContent = cleanTamilUnicodeText(n.content || n.contentText || '');
      if (!rawContent || rawContent.trim().length < 5) continue;

      // Intra-note deduplication
      const dedup = deduplicateMarkdownContent(rawContent);
      const content = dedup.cleanedMarkdown;
      const contentHash = dedup.stats.contentHash;

      // Check within uploaded batch
      if (batchSeenHashes.has(contentHash)) {
        duplicatesSkipped++;
        continue;
      }
      batchSeenHashes.add(contentHash);

      const lessonTitle = cleanTamilUnicodeText(n.lessonTitle || n.lesson_title || 'General Lesson');
      const lessonId = (n.lessonId || n.lesson_id || null) ? String(n.lessonId || n.lesson_id).trim() : null;
      const lessonNumber = (n.lessonNumber || n.lesson_number || null) ? String(n.lessonNumber || n.lesson_number).trim() : null;
      const unitId = Number(n.unitId || n.unit_id) || 1;
      const category = (n.category || 'group1').trim().toLowerCase();
      const subject = n.subject || 'General Studies';
      const classId = n.classId ? Number(n.classId) : (n.class_id ? Number(n.class_id) : 6);
      const topic = n.topic || '';
      const language = (n.language || 'english').trim().toLowerCase();
      const title = cleanTamilUnicodeText(n.title || lessonTitle);
      const sourceReference = n.sourceReference || n.source_reference || null;
      const coverageReport = n.coverageReport || n.coverage_report || null;
      const topics = Array.isArray(n.topics) ? JSON.stringify(n.topics) : (n.topics ? JSON.stringify(n.topics) : null);
      const status = n.status === 'published' ? 'published' : 'staging';

      // Check against database for duplicate
      const dupCheck = await checkDuplicateNoteInDb(client, {
        category,
        subject,
        classId,
        unitId,
        lessonId,
        lessonTitle,
        language,
        content,
      });

      if (dupCheck.isDuplicate) {
        duplicatesSkipped++;
        continue;
      }

      const deduplicationMeta = JSON.stringify({
        contentHash,
        dedupStats: dedup.stats,
      });

      const res = await client.query(
        `INSERT INTO study_notes (
           category, unit_id, class_id, subject, lesson_id, lesson_number, lesson_title, topic, language, title, content, status, source_reference, coverage_report, topics, content_hash, deduplication_meta
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING id`,
        [category, unitId, classId, subject, lessonId, lessonNumber, lessonTitle, topic, language, title, content, status, sourceReference, coverageReport ? JSON.stringify(coverageReport) : null, topics, contentHash, deduplicationMeta]
      );
      insertedNotes.push(res.rows[0]);
    }

    await client.query('COMMIT');
    return res.status(201).json({
      status: 'success',
      message: `Successfully uploaded ${insertedNotes.length} study note(s) to Staging.${duplicatesSkipped > 0 ? ` (${duplicatesSkipped} duplicate note(s) skipped).` : ''}`,
      count: insertedNotes.length,
      duplicatesSkipped,
      data: insertedNotes,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error in bulk-upload study notes:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to bulk upload study notes', error: error.message });
  } finally {
    client.release();
  }
});

// Publish all notes belonging to a scope or array of IDs
router.post('/publish-scope', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { noteIds, category, classId, subject, term, unitId } = req.body;
    let updatedCount = 0;

    if (Array.isArray(noteIds) && noteIds.length > 0) {
      const result = await pool.query(
        `UPDATE study_notes
         SET status = 'published', updated_at = CURRENT_TIMESTAMP
         WHERE id = ANY($1::int[])
         RETURNING id`,
        [noteIds.map(Number)]
      );
      updatedCount = result.rows.length;
    } else if (category && classId && subject) {
      const conditions = [
        `category = ANY($1)`,
        `class_id = $2`,
      ];
      const values: any[] = [getEquivalentCategories(category), Number(classId)];
      let pIdx = 3;

      if (unitId && !isNaN(Number(unitId))) {
        conditions.push(`unit_id = $${pIdx++}`);
        values.push(Number(unitId));
      }
      if (term && term !== 'all' && term !== 'Full Year') {
        conditions.push(`(LOWER(term) = LOWER($${pIdx++}) OR term IS NULL)`);
        values.push(term);
      }

      const result = await pool.query(
        `UPDATE study_notes
         SET status = 'published', updated_at = CURRENT_TIMESTAMP
         WHERE ${conditions.join(' AND ')}
         RETURNING id`,
        values
      );
      updatedCount = result.rows.length;
    }

    return res.status(200).json({
      status: 'success',
      message: `Successfully published ${updatedCount} lesson study notes live to Study Materials!`,
      publishedCount: updatedCount,
    });
  } catch (err: any) {
    console.error('Error publishing scope notes:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to publish scope notes' });
  }
});

// Admin: Migrate and organize ALL existing study materials into topic-wise notes
router.post('/migrate-topics', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const stats = await migrateAllExistingStudyMaterials(pool);
    return res.status(200).json({
      status: 'success',
      message: `Successfully migrated and organized ${stats.lessonsProcessed} lesson(s) into ${stats.topicsCreated} topic records across PostgreSQL.`,
      stats,
    });
  } catch (error: any) {
    console.error('Error in migrate-topics route:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Failed to migrate topic notes' });
  }
});

// Helper: Synchronize topic records across all note mutations
async function alignAndPersistNoteTopics(params: {
  content: string;
  category: string;
  subject: string;
  classId?: number;
  unitId: number;
  term?: string;
  lessonId?: string;
  lessonNumber?: string;
  lessonTitle: string;
  language?: string;
  noteFormat?: 'short' | 'full';
  status?: string;
  sourceReference?: string;
}): Promise<number> {
  try {
    const separation = splitAndAlignNotesByTopic({
      content: params.content,
      category: params.category,
      subject: params.subject,
      classId: params.classId || 6,
      unitId: params.unitId,
      lessonTitle: params.lessonTitle.trim(),
      lessonId: params.lessonId || undefined,
      lessonNumber: params.lessonNumber || '1.1',
      language: params.language,
    });
    if (separation.topics.length > 0) {
      const res = await persistTopicAlignedNotes(pool, {
        category: params.category,
        subject: params.subject,
        classId: params.classId || 6,
        unitId: params.unitId,
        term: params.term || 'Term 1',
        lessonId: params.lessonId || undefined,
        lessonNumber: params.lessonNumber || '1.1',
        lessonTitle: params.lessonTitle.trim(),
        language: params.language || 'tamil',
        noteFormat: params.noteFormat || 'short',
        sourceReference: params.sourceReference || 'Samacheer Kalvi Textbook',
        status: params.status === 'staging' ? 'staging' : 'published',
        separationResult: separation,
      });
      return res.savedTopicIds.length;
    }
  } catch (err) {
    console.warn('[alignAndPersistNoteTopics] Non-fatal alignment warning:', err);
  }
  return 0;
}

// Create note
router.post('/', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const n = req.body;
    let rawContent = cleanTamilUnicodeText(n.content || n.contentText || '');
    const lessonTitle = cleanTamilUnicodeText(n.lessonTitle || n.lesson_title || n.title || 'Study Notes');
    const title = cleanTamilUnicodeText(n.title || lessonTitle || 'Study Notes');
    const lessonId = (n.lessonId || n.lesson_id || null) ? String(n.lessonId || n.lesson_id).trim() : null;
    const lessonNumber = (n.lessonNumber || n.lesson_number || null) ? String(n.lessonNumber || n.lesson_number).trim() : null;
    const unitId = typeof n.unitId === 'number'
      ? n.unitId
      : (parseInt(String(n.unitId || n.unit_id || '').replace(/\D/g, ''), 10) || 1);
    const category = (n.category || 'group1').trim().toLowerCase();
    const subject = n.subject || 'General Studies';
    const rawClass = n.classId || n.class_id;
    const classId = typeof rawClass === 'number' ? rawClass : (parseInt(String(rawClass || '').replace(/\D/g, ''), 10) || null);
    const term = n.term || 'Term 1';
    const lessonCode = n.lessonCode || n.lesson_code || buildCanonicalLessonCode({
      category,
      classId: classId || 6,
      subject,
      term,
      unitId,
      lessonNumber: lessonNumber || '1.1',
      lessonId: lessonId || undefined,
    });
    const topic = n.topic || title;
    const language = (n.language || 'english').trim().toLowerCase();
    const contentHtml = n.contentHtml || n.content_html || null;
    const tags = Array.isArray(n.tags) ? JSON.stringify(n.tags) : JSON.stringify([]);
    const sourceReference = n.sourceReference || n.source_reference || null;
    const status = n.status === 'staging' ? 'staging' : n.status === 'archived' ? 'archived' : 'published';
    const coverageReport = n.coverageReport || n.coverage_report || null;
    const topics = Array.isArray(n.topics) ? JSON.stringify(n.topics) : (n.topics ? JSON.stringify(n.topics) : null);
    const topicOrder = typeof n.topicOrder === 'number' ? n.topicOrder : (typeof n.topic_order === 'number' ? n.topic_order : 0);
    const generationStatus = n.generationStatus || n.generation_status || 'completed';
    const generationMeta = n.generationMeta || n.generation_meta ? JSON.stringify(n.generationMeta || n.generation_meta) : null;
    const noteFormat = (n.noteFormat || n.note_format) === 'full' ? 'full' : 'short';

    if (!rawContent || rawContent.trim().length < 10) {
      return res.status(400).json({ status: 'error', message: 'Content is required (minimum 10 chars)' });
    }
    if (!lessonTitle || typeof lessonTitle !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Lesson title is required' });
    }
    if (isNaN(unitId) || unitId < 1) {
      return res.status(400).json({ status: 'error', message: 'Valid unitId is required' });
    }

    // 1. Strict intra-note deduplication
    const dedup = deduplicateMarkdownContent(rawContent);
    const content = dedup.cleanedMarkdown;
    const contentHash = dedup.stats.contentHash;
    const deduplicationMeta = JSON.stringify({
      contentHash,
      dedupStats: dedup.stats,
    });

    // 2. Strict database duplicate check against Staging and Published notes
    const dupCheck = await checkDuplicateNoteInDb(pool, {
      category,
      subject,
      classId,
      unitId,
      lessonId,
      lessonTitle,
      language,
      noteFormat,
      content,
    });

    if (dupCheck.isDuplicate && dupCheck.existingNote) {
      // Case 1: Publishing a note that is in staging, or client requested forceUpdate/replaceExisting
      if ((status === 'published' && dupCheck.existingNote.status === 'staging') || n.forceUpdate || n.replaceExisting) {
        if (status === 'published') {
          // Archive any other published note for this lesson and format
          await pool.query(
            `UPDATE study_notes
             SET status = 'archived', updated_at = CURRENT_TIMESTAMP
             WHERE status = 'published' AND id != $1
               AND category = ANY($2)
               AND unit_id = $3
               AND (lesson_code = $4 OR lesson_id = $5 OR (lesson_id IS NULL AND LOWER(lesson_title) = LOWER($6)))
               AND COALESCE(note_format, 'short') = $7`,
            [dupCheck.existingNote.id, getEquivalentCategories(category), unitId, lessonCode, lessonId, lessonTitle.trim(), noteFormat]
          );
        }

        const updateRes = await pool.query(
          `UPDATE study_notes
           SET content = $1, title = $2, lesson_title = $3, lesson_number = $4,
               source_reference = $5, coverage_report = $6, topics = $7,
               content_hash = $8, deduplication_meta = $9, status = $10,
               term = $11, lesson_code = $12, topic_order = $13, generation_status = $14, generation_meta = $15,
               note_format = $16, updated_at = CURRENT_TIMESTAMP
           WHERE id = $17
           RETURNING *;`,
          [
            content,
            title.trim(),
            lessonTitle.trim(),
            lessonNumber,
            sourceReference,
            coverageReport ? JSON.stringify(coverageReport) : null,
            topics,
            contentHash,
            deduplicationMeta,
            status,
            term,
            lessonCode,
            topicOrder,
            generationStatus,
            generationMeta,
            noteFormat,
            dupCheck.existingNote.id,
          ]
        );

        // Keep topic records synchronized
        await alignAndPersistNoteTopics({
          content,
          category,
          subject,
          classId: classId || 6,
          unitId,
          term,
          lessonId: lessonId || undefined,
          lessonNumber: lessonNumber || '1.1',
          lessonTitle,
          language,
          noteFormat,
          sourceReference: sourceReference || 'Samacheer Kalvi Textbook',
          status: status === 'staging' ? 'staging' : 'published',
        });

        return res.status(200).json({
          status: 'success',
          message: status === 'published'
            ? `Study note (#${dupCheck.existingNote.id}) successfully published live to Study Materials!`
            : `Study note (#${dupCheck.existingNote.id}) successfully saved to Staging!`,
          data: mapRowToNote(updateRes.rows[0]),
          isUpdatedExisting: true,
        });
      }

      // Case 2: Saving to staging when an identical note is already in staging
      if (status === 'staging' && dupCheck.existingNote.status === 'staging') {
        const updateRes = await pool.query(
          `UPDATE study_notes
           SET content = $1, title = $2, lesson_title = $3, lesson_number = $4,
               source_reference = $5, coverage_report = $6, topics = $7,
               content_hash = $8, deduplication_meta = $9,
               term = $10, lesson_code = $11, topic_order = $12, generation_status = $13, generation_meta = $14,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $15
           RETURNING *;`,
          [
            content,
            title.trim(),
            lessonTitle.trim(),
            lessonNumber,
            sourceReference,
            coverageReport ? JSON.stringify(coverageReport) : null,
            topics,
            contentHash,
            deduplicationMeta,
            term,
            lessonCode,
            topicOrder,
            generationStatus,
            generationMeta,
            dupCheck.existingNote.id,
          ]
        );

        // Keep topic records synchronized
        await alignAndPersistNoteTopics({
          content,
          category,
          subject,
          classId: classId || 6,
          unitId,
          term,
          lessonId: lessonId || undefined,
          lessonNumber: lessonNumber || '1.1',
          lessonTitle,
          language,
          noteFormat,
          sourceReference: sourceReference || 'Samacheer Kalvi Textbook',
          status: 'staging',
        });

        return res.status(200).json({
          status: 'success',
          message: `Study note (#${dupCheck.existingNote.id}) successfully updated and saved in Staging!`,
          data: mapRowToNote(updateRes.rows[0]),
          isUpdatedExisting: true,
        });
      }

      // Case 3: Note is already published live and no forceUpdate requested
      return res.status(409).json({
        status: 'duplicate_prevented',
        message: `Duplicate Study Note Prevented: An identical study note (#${dupCheck.existingNote.id}) already exists in ${dupCheck.existingNote.status.toUpperCase()} (${Math.round((dupCheck.similarityScore || 1) * 100)}% match).`,
        existingNote: dupCheck.existingNote,
        isDuplicate: true,
        similarityScore: dupCheck.similarityScore,
      });
    }

    // 2.5 Check if there is an existing staging note for this exact lesson and format to promote or update
    if (status === 'published' || (status === 'staging' && (n.replaceExisting || n.forceUpdate))) {
      const existingStagedRes = await pool.query(
        `SELECT id, status, lesson_title, lesson_id
         FROM study_notes
         WHERE status = 'staging'
           AND category = ANY($1)
           AND unit_id = $2
           AND (lesson_code = $3 OR lesson_id = $4 OR (lesson_id IS NULL AND LOWER(lesson_title) = LOWER($5)))
           AND COALESCE(note_format, 'short') = $6
         ORDER BY id DESC
         LIMIT 1;`,
        [getEquivalentCategories(category), unitId, lessonCode, lessonId, lessonTitle.trim(), noteFormat]
      );

      if (existingStagedRes.rows.length > 0) {
        const stagedToPromote = existingStagedRes.rows[0];
        if (status === 'published') {
          // Archive any other published notes for this lesson and format
          await pool.query(
            `UPDATE study_notes
             SET status = 'archived', updated_at = CURRENT_TIMESTAMP
             WHERE status = 'published' AND id != $1
               AND category = ANY($2)
               AND unit_id = $3
               AND (lesson_code = $4 OR lesson_id = $5 OR (lesson_id IS NULL AND LOWER(lesson_title) = LOWER($6)))
               AND COALESCE(note_format, 'short') = $7`,
            [stagedToPromote.id, getEquivalentCategories(category), unitId, lessonCode, lessonId, lessonTitle.trim(), noteFormat]
          );
        }

        const updateRes = await pool.query(
          `UPDATE study_notes
           SET content = $1, title = $2, lesson_title = $3, lesson_number = $4,
               source_reference = $5, coverage_report = $6, topics = $7,
               content_hash = $8, deduplication_meta = $9, status = $10,
               term = $11, lesson_code = $12, topic_order = $13, generation_status = $14, generation_meta = $15,
               note_format = $16, updated_at = CURRENT_TIMESTAMP
           WHERE id = $17
           RETURNING *;`,
          [
            content,
            title.trim(),
            lessonTitle.trim(),
            lessonNumber,
            sourceReference,
            coverageReport ? JSON.stringify(coverageReport) : null,
            topics,
            contentHash,
            deduplicationMeta,
            status,
            term,
            lessonCode,
            topicOrder,
            generationStatus,
            generationMeta,
            noteFormat,
            stagedToPromote.id,
          ]
        );

        // Keep topic records synchronized
        await alignAndPersistNoteTopics({
          content,
          category,
          subject,
          classId: classId || 6,
          unitId,
          term,
          lessonId: lessonId || undefined,
          lessonNumber: lessonNumber || '1.1',
          lessonTitle,
          language,
          noteFormat,
          sourceReference: sourceReference || 'Samacheer Kalvi Textbook',
          status: status === 'staging' ? 'staging' : 'published',
        });

        return res.status(200).json({
          status: 'success',
          message: status === 'published'
            ? `Study note (#${stagedToPromote.id}) successfully published live to Study Materials!`
            : `Study note (#${stagedToPromote.id}) successfully saved to Staging!`,
          data: mapRowToNote(updateRes.rows[0]),
          isUpdatedExisting: true,
        });
      }
    }

    // 3. If publishing directly, archive any prior published or staged notes for this lesson and format
    if (status === 'published') {
      await pool.query(
        `UPDATE study_notes
         SET status = 'archived', updated_at = CURRENT_TIMESTAMP
         WHERE (status = 'published' OR status = 'staging')
           AND category = ANY($1)
           AND unit_id = $2
           AND (lesson_code = $3 OR lesson_id = $4 OR (lesson_id IS NULL AND LOWER(lesson_title) = LOWER($5)))
           AND COALESCE(note_format, 'short') = $6`,
        [getEquivalentCategories(category), unitId, lessonCode, lessonId, lessonTitle.trim(), noteFormat]
      );
    }

    const insertQuery = `
      INSERT INTO study_notes (
        category, unit_id, class_id, subject, term, lesson_id, lesson_number, lesson_code,
        lesson_title, topic, language, title, content, content_html, tags, status, source_reference, coverage_report, topics, content_hash, deduplication_meta,
        topic_order, generation_status, generation_meta, note_format
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
      RETURNING *;
    `;
    const values = [
      category,
      unitId,
      classId,
      subject,
      term,
      lessonId,
      lessonNumber,
      lessonCode,
      lessonTitle.trim(),
      topic.trim(),
      language,
      title.trim(),
      content,
      contentHtml,
      tags,
      status,
      sourceReference,
      coverageReport ? JSON.stringify(coverageReport) : null,
      topics,
      contentHash,
      deduplicationMeta,
      topicOrder,
      generationStatus,
      generationMeta,
      noteFormat,
    ];

    const result = await pool.query(insertQuery, values);
    const createdRow = result.rows[0];

    // Automatically align and separate note content into individual topic records
    let topicCount = 0;
    try {
      const separation = splitAndAlignNotesByTopic({
        content,
        category,
        subject,
        classId: classId || 6,
        unitId,
        lessonTitle: lessonTitle.trim(),
        lessonId: lessonId || undefined,
        lessonNumber: lessonNumber || '1.1',
        language,
      });

      if (separation.topics.length > 0) {
        const persistRes = await persistTopicAlignedNotes(pool, {
          category,
          subject,
          classId: classId || 6,
          unitId,
          term,
          lessonId: lessonId || undefined,
          lessonNumber: lessonNumber || '1.1',
          lessonTitle: lessonTitle.trim(),
          language,
          noteFormat,
          sourceReference: sourceReference || 'Samacheer Kalvi Textbook',
          status: status === 'staging' ? 'staging' : 'published',
          separationResult: separation,
        });
        topicCount = persistRes.savedTopicIds.length;
      }
    } catch (sepErr) {
      console.warn('[NotesRoute] Automatic topic separation non-fatal warning:', sepErr);
    }

    return res.status(201).json({
      status: 'success',
      message: status === 'published'
        ? `Study notes published directly to Study Materials (${topicCount} topic(s) separated)!`
        : `Study notes saved to Staging successfully (${topicCount} topic(s) separated)!`,
      data: mapRowToNote(createdRow),
      topicsSeparated: topicCount,
    });
  } catch (error: any) {
    console.error('Error creating study note:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to create study notes', error: error.message });
  }
});

// Update note
router.patch('/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ status: 'error', message: 'Invalid note ID' });

    const b = req.body;
    const updateClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [];
    let pIdx = 1;

    // Deduplication check when publishing
    if (b.status === 'published') {
      const curr = await pool.query(`SELECT category, unit_id, lesson_id, lesson_title FROM study_notes WHERE id = $1`, [id]);
      if (curr.rows.length > 0) {
        const cNote = curr.rows[0];
        // Archive any prior published note for this lesson to prevent duplicate published notes
        await pool.query(
          `UPDATE study_notes
           SET status = 'archived', updated_at = CURRENT_TIMESTAMP
           WHERE status = 'published'
             AND id != $1
             AND category = ANY($2)
             AND unit_id = $3
             AND (lesson_id = $4 OR (lesson_id IS NULL AND LOWER(lesson_title) = LOWER($5)))`,
          [id, getEquivalentCategories(cNote.category), cNote.unit_id, cNote.lesson_id, cNote.lesson_title]
        );
      }
    }

    if (b.content !== undefined) {
      const dedup = deduplicateMarkdownContent(cleanTamilUnicodeText(b.content));
      updateClauses.push(`content = $${pIdx++}`);
      values.push(dedup.cleanedMarkdown);
      updateClauses.push(`content_hash = $${pIdx++}`);
      values.push(dedup.stats.contentHash);
      updateClauses.push(`deduplication_meta = $${pIdx++}`);
      values.push(JSON.stringify(dedup.stats));
    }
    if (b.contentHtml !== undefined) { updateClauses.push(`content_html = $${pIdx++}`); values.push(b.contentHtml); }
    if (b.title !== undefined) { updateClauses.push(`title = $${pIdx++}`); values.push(cleanTamilUnicodeText(b.title)); }
    if (b.lessonId !== undefined || b.lesson_id !== undefined) { updateClauses.push(`lesson_id = $${pIdx++}`); values.push((b.lessonId || b.lesson_id) ? String(b.lessonId || b.lesson_id).trim() : null); }
    if (b.lessonNumber !== undefined || b.lesson_number !== undefined) { updateClauses.push(`lesson_number = $${pIdx++}`); values.push((b.lessonNumber || b.lesson_number) ? String(b.lessonNumber || b.lesson_number).trim() : null); }
    if (b.lessonTitle !== undefined || b.lesson_title !== undefined) { updateClauses.push(`lesson_title = $${pIdx++}`); values.push(cleanTamilUnicodeText(b.lessonTitle || b.lesson_title)); }
    if (b.subject !== undefined) { updateClauses.push(`subject = $${pIdx++}`); values.push(b.subject); }
    if (b.category !== undefined) { updateClauses.push(`category = $${pIdx++}`); values.push(b.category); }
    if (b.unitId !== undefined || b.unit_id !== undefined) { updateClauses.push(`unit_id = $${pIdx++}`); values.push(Number(b.unitId || b.unit_id)); }
    if (b.classId !== undefined || b.class_id !== undefined) { updateClauses.push(`class_id = $${pIdx++}`); values.push(Number(b.classId || b.class_id)); }
    if (b.language !== undefined) { updateClauses.push(`language = $${pIdx++}`); values.push(b.language); }
    if (b.sourceReference !== undefined || b.source_reference !== undefined) { updateClauses.push(`source_reference = $${pIdx++}`); values.push(b.sourceReference || b.source_reference); }
    if (b.status !== undefined && ['staging','published','archived'].includes(b.status)) { updateClauses.push(`status = $${pIdx++}`); values.push(b.status); }
    if (b.tags !== undefined) { updateClauses.push(`tags = $${pIdx++}`); values.push(JSON.stringify(Array.isArray(b.tags) ? b.tags : [])); }
    if (b.coverageReport !== undefined || b.coverage_report !== undefined) {
      updateClauses.push(`coverage_report = $${pIdx++}`);
      const cr = b.coverageReport !== undefined ? b.coverageReport : b.coverage_report;
      values.push(cr ? JSON.stringify(cr) : null);
    }
    if (b.topics !== undefined) {
      updateClauses.push(`topics = $${pIdx++}`);
      values.push(b.topics ? JSON.stringify(b.topics) : null);
    }

    values.push(id);
    const updateQuery = `UPDATE study_notes SET ${updateClauses.join(', ')} WHERE id = $${pIdx} RETURNING *;`;
    const result = await pool.query(updateQuery, values);
    if (result.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Note not found' });
    return res.status(200).json({ status: 'success', message: 'Study notes updated successfully', data: mapRowToNote(result.rows[0]) });
  } catch (error: any) {
    console.error('Error updating study note:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to update study notes', error: error.message });
  }
});

// Explicitly reassign study note to canonical syllabus lesson
router.post('/:id/reassign', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ status: 'error', message: 'Invalid note ID' });

    const { category, subject, classId, unitId, lessonId, lessonNumber, lessonTitle } = req.body;
    if (!lessonId || !lessonTitle) {
      return res.status(400).json({ status: 'error', message: 'lessonId and lessonTitle are required for reassignment' });
    }

    const updateQuery = `
      UPDATE study_notes
      SET 
        category = COALESCE($1, category),
        subject = COALESCE($2, subject),
        class_id = COALESCE($3, class_id),
        unit_id = COALESCE($4, unit_id),
        lesson_id = $5,
        lesson_number = $6,
        lesson_title = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *;
    `;
    const values = [
      category ? String(category).trim().toLowerCase() : null,
      subject ? String(subject).trim() : null,
      classId ? Number(classId) : null,
      unitId ? Number(unitId) : null,
      String(lessonId).trim(),
      lessonNumber ? String(lessonNumber).trim() : null,
      cleanTamilUnicodeText(String(lessonTitle).trim()),
      id,
    ];

    const result = await pool.query(updateQuery, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Study note not found' });
    }

    return res.status(200).json({
      status: 'success',
      message: `Study Note #${id} safely reassigned to ${lessonNumber ? `Lesson ${lessonNumber}` : lessonId}`,
      data: mapRowToNote(result.rows[0]),
    });
  } catch (error: any) {
    console.error('Error reassigning study note:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to reassign note', error: error.message });
  }
});

// Bulk delete notes
router.delete('/', requireAdminAuth, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { ids, category, classId, unitId, lesson, subject, language, status, deleteAll = false } = req.body || {};

    if (Array.isArray(ids) && ids.length > 0) {
      const validIds = ids.filter((id: any) => !isNaN(Number(id))).map((id: any) => Number(id));
      if (validIds.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No valid note IDs provided' });
      }
      const result = await client.query('DELETE FROM study_notes WHERE id = ANY($1) RETURNING id', [validIds]);
      return res.status(200).json({
        status: 'success',
        message: `Deleted ${result.rowCount} study note(s)`,
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
      if (language && typeof language === 'string' && language !== 'all') {
        queryConditions.push(`language = $${paramIndex++}`);
        values.push(language.trim().toLowerCase());
      }
      if (status && typeof status === 'string' && status !== 'all') {
        queryConditions.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      const whereClause = queryConditions.length > 0 ? `WHERE ${queryConditions.join(' AND ')}` : '';
      const countQuery = `SELECT COUNT(*) AS total FROM study_notes ${whereClause}`;
      const countResult = await client.query(countQuery, values);
      const totalToDelete = parseInt(countResult.rows[0].total, 10);

      if (totalToDelete === 0) {
        return res.status(200).json({ status: 'success', message: 'No study notes found to delete', deletedCount: 0 });
      }

      const deleteQuery = `DELETE FROM study_notes ${whereClause} RETURNING id`;
      const deleteResult = await client.query(deleteQuery, values);
      return res.status(200).json({
        status: 'success',
        message: `Deleted ${deleteResult.rowCount} study note(s)`,
        deletedCount: deleteResult.rowCount,
      });
    }

    return res.status(400).json({ status: 'error', message: 'Provide ids array or deleteAll with filters' });
  } catch (error: any) {
    console.error('Error in bulk delete notes:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to delete study notes', error: error.message });
  } finally {
    client.release();
  }
});

// Delete note
router.delete('/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ status: 'error', message: 'Invalid note ID' });
    const result = await pool.query('DELETE FROM study_notes WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Note not found' });
    return res.status(200).json({ status: 'success', message: 'Study notes deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting study note:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to delete study notes', error: error.message });
  }
});

export default router;
