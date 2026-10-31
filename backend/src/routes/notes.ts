import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAdminAuth } from '../middleware/auth';
import { generateStudyNotesWithRag } from '../services/studyNotesEngine';

const router = Router();

function mapRowToNote(row: any) {
  return {
    id: row.id,
    category: row.category,
    unitId: row.unit_id,
    classId: row.class_id,
    subject: row.subject,
    lessonTitle: row.lesson_title,
    topic: row.topic,
    language: row.language,
    title: row.title,
    content: row.content,
    contentHtml: row.content_html,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
    status: row.status,
    sourceReference: row.source_reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Public: Get notes
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, unitId, classId, lesson, subject, language, status, limit = '100', offset = '0' } = req.query;

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

    if (unitId && !isNaN(Number(unitId))) {
      queryConditions.push(`unit_id = $${paramIndex++}`);
      values.push(Number(unitId));
    }

    if (classId && !isNaN(Number(classId))) {
      queryConditions.push(`class_id = $${paramIndex++}`);
      values.push(Number(classId));
    }

    if (subject && typeof subject === 'string' && subject.trim()) {
      queryConditions.push(`LOWER(subject) = $${paramIndex++}`);
      values.push(subject.trim().toLowerCase());
    }

    if (lesson && typeof lesson === 'string' && lesson.trim()) {
      queryConditions.push(`LOWER(lesson_title) = LOWER($${paramIndex++})`);
      values.push(lesson.trim());
    }

    if (language && typeof language === 'string') {
      queryConditions.push(`language = $${paramIndex++}`);
      values.push(language.trim().toLowerCase());
    }

    if (status && typeof status === 'string' && status !== 'all') {
      queryConditions.push(`status = $${paramIndex++}`);
      values.push(status);
    } else if (!status) {
      queryConditions.push(`status = 'published'`);
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
      ORDER BY created_at DESC, id DESC 
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

// Admin: list all
router.get('/admin', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { category, lesson, status, language, limit = '50', offset = '0' } = req.query;
    const queryConditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (category && typeof category === 'string' && category !== 'all') {
      queryConditions.push(`category = $${paramIndex++}`);
      values.push(category);
    }
    if (lesson && typeof lesson === 'string' && lesson.trim()) {
      queryConditions.push(`LOWER(lesson_title) LIKE $${paramIndex++}`);
      values.push(`%${lesson.trim().toLowerCase()}%`);
    }
    if (status && typeof status === 'string' && status !== 'all') {
      queryConditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (language && typeof language === 'string' && language !== 'all') {
      queryConditions.push(`language = $${paramIndex++}`);
      values.push(language);
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

    res.status(200).json({
      status: 'success',
      total,
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

// AI generate One-Liner Notes grounded in Samacheer Kalvi textbook content
router.post('/ai-generate', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const {
      category = 'group1',
      unitId,
      classId,
      lessonTitle,
      topic,
      subject = 'General Studies',
      language = 'english',
      apiKey,
      textbookMode = 'auto',
      textbookId,
      term = 'Term 1',
      scope = 'chapter',
    } = req.body;

    const cleanCategory = String(category || '').trim().toLowerCase();
    const parsedUnitId = Number(unitId) || 1;
    const parsedClassId = classId ? Number(classId) : 6;
    const trimmedLesson = String(lessonTitle || '').trim();
    const trimmedTopic = String(topic || trimmedLesson).trim();
    const lang = (String(language || 'english')).toLowerCase() === 'tamil' ? 'tamil' : 'english';
    const effectiveApiKey = (apiKey && typeof apiKey === 'string' && apiKey.trim())
      ? apiKey.trim()
      : (process.env.GEMINI_API_KEY || '').trim();

    if (scope !== 'full_book' && !trimmedLesson) {
      return res.status(400).json({ status: 'error', message: 'lessonTitle is required for chapter-wise notes.' });
    }

    const result = await generateStudyNotesWithRag({
      category: cleanCategory,
      subject,
      classId: parsedClassId,
      unitId: parsedUnitId,
      lessonTitle: trimmedLesson,
      topic: trimmedTopic,
      language: lang,
      apiKey: effectiveApiKey,
      textbookMode,
      textbookId: textbookId ? Number(textbookId) : undefined,
      term,
      scope,
    });

    return res.status(200).json({
      status: 'success',
      source: result.source,
      model: result.modelUsed,
      textbookUsed: result.textbookUsed,
      detectedChaptersCount: result.detectedChaptersCount,
      data: {
        category: cleanCategory,
        unitId: parsedUnitId,
        classId: parsedClassId,
        subject,
        lessonTitle: trimmedLesson || result.title,
        topic: trimmedTopic,
        language: lang,
        title: result.title,
        content: result.content,
        contentHtml: null,
        sourceReference: result.sourceReference,
      },
    });
  } catch (error: any) {
    console.error('Error generating study notes:', error);
    return res.status(400).json({
      status: 'error',
      message: error.message || 'Failed to generate study notes',
    });
  }
});

// Create note
router.post('/', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const n = req.body;
    const content = n.content || n.contentText || '';
    const lessonTitle = n.lessonTitle || n.lesson_title;
    const unitId = Number(n.unitId || n.unit_id);
    const category = (n.category || 'group1').trim().toLowerCase();
    const subject = n.subject || 'General Studies';
    const classId = n.classId || n.class_id || null;
    const topic = n.topic || '';
    const language = (n.language || 'english').trim().toLowerCase();
    const title = n.title || lessonTitle || 'Study Notes';
    const contentHtml = n.contentHtml || n.content_html || null;
    const tags = Array.isArray(n.tags) ? JSON.stringify(n.tags) : JSON.stringify([]);
    const sourceReference = n.sourceReference || n.source_reference || null;
    const status = n.status === 'staging' ? 'staging' : n.status === 'archived' ? 'archived' : 'published';

    if (!content || content.trim().length < 10) {
      return res.status(400).json({ status: 'error', message: 'Content is required (minimum 10 chars)' });
    }
    if (!lessonTitle || typeof lessonTitle !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Lesson title is required' });
    }
    if (isNaN(unitId) || unitId < 1) {
      return res.status(400).json({ status: 'error', message: 'Valid unitId is required' });
    }

    const insertQuery = `
      INSERT INTO study_notes (
        category, unit_id, class_id, subject, lesson_title, topic, language, title, content, content_html, tags, status, source_reference
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *;
    `;
    const values = [category, unitId, classId, subject, lessonTitle.trim(), topic, language, title.trim(), content, contentHtml, tags, status, sourceReference];

    const result = await pool.query(insertQuery, values);
    return res.status(201).json({ status: 'success', message: 'Study notes created successfully', data: mapRowToNote(result.rows[0]) });
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

    if (b.content !== undefined) { updateClauses.push(`content = $${pIdx++}`); values.push(b.content); }
    if (b.contentHtml !== undefined) { updateClauses.push(`content_html = $${pIdx++}`); values.push(b.contentHtml); }
    if (b.title !== undefined) { updateClauses.push(`title = $${pIdx++}`); values.push(b.title); }
    if (b.status !== undefined && ['staging','published','archived'].includes(b.status)) { updateClauses.push(`status = $${pIdx++}`); values.push(b.status); }
    if (b.tags !== undefined) { updateClauses.push(`tags = $${pIdx++}`); values.push(JSON.stringify(Array.isArray(b.tags) ? b.tags : [])); }

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
