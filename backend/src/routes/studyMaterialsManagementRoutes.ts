import { Router, Request, Response, NextFunction } from 'express';
import { StudyManagementService } from '../services/studyManagementService';
import { TextbookAiLessonService } from '../services/textbookAiLessonService';
import { requireAdminAuth } from '../middleware/auth';
import { invalidateCachePrefix } from '../utils/cache';

const router = Router();

// Invalidate syllabus cache whenever admin modifies study materials
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        invalidateCachePrefix('syllabus:');
      }
    });
  }
  next();
});

// ===========================================================================
// HIERARCHY TREE (Nested Units -> Lessons -> Topics -> Notes)
// ===========================================================================
router.get('/tree', async (req: Request, res: Response) => {
  try {
    const examId = String(req.query.examId || 'group1');
    const subjectId = String(req.query.subjectId || 'general-studies');
    const standardNumber = req.query.standardId ? parseInt(String(req.query.standardId), 10) : undefined;
    const unitNumber = req.query.unitNumber ? parseInt(String(req.query.unitNumber), 10) : undefined;

    const tree = await StudyManagementService.getFullHierarchyTree({
      examId,
      subjectId,
      standardNumber,
      unitNumber,
    });

    return res.status(200).json({
      success: true,
      examId,
      subjectId,
      standardNumber,
      tree,
    });
  } catch (err: any) {
    console.error('[StudyManagement API] /tree error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ===========================================================================
// EXAMS
// ===========================================================================
router.get('/exams', async (_req: Request, res: Response) => {
  try {
    const exams = await StudyManagementService.getExams();
    return res.status(200).json({ success: true, exams });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/exams', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id, name, code, badge, description, display_order } = req.body;
    if (!id || !name) {
      return res.status(400).json({ success: false, message: 'Exam ID and Name are required.' });
    }
    const created = await StudyManagementService.createExam({
      id,
      name,
      code,
      badge,
      description,
      display_order,
    });
    return res.status(201).json({ success: true, exam: created });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/exams/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const updated = await StudyManagementService.updateExam(req.params.id, req.body);
    return res.status(200).json({ success: true, exam: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/exams/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const ok = await StudyManagementService.deleteExam(req.params.id);
    return res.status(200).json({ success: ok });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ===========================================================================
// SUBJECTS
// ===========================================================================
router.get('/subjects', async (req: Request, res: Response) => {
  try {
    const examId = req.query.examId ? String(req.query.examId) : undefined;
    const subjects = await StudyManagementService.getSubjects(examId);
    return res.status(200).json({ success: true, subjects });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/subjects', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { exam_id, subject_slug, name, description, display_order } = req.body;
    if (!exam_id || !subject_slug || !name) {
      return res.status(400).json({ success: false, message: 'exam_id, subject_slug, and name are required.' });
    }
    const created = await StudyManagementService.createSubject({
      exam_id,
      subject_slug,
      name,
      description,
      display_order,
    });
    return res.status(201).json({ success: true, subject: created });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/subjects/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const updated = await StudyManagementService.updateSubject(req.params.id, req.body);
    return res.status(200).json({ success: true, subject: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/subjects/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const examId = req.query.examId ? String(req.query.examId) : req.body?.examId;
    const ok = await StudyManagementService.deleteSubject(req.params.id, examId ? { examId } : undefined);
    return res.status(200).json({ success: ok });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// ===========================================================================
// STANDARDS (Scoped Standard Content Deletion)
// ===========================================================================
router.delete('/standards/:standardId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const standardNumber = parseInt(req.params.standardId, 10);
    const examId = String(req.query.examId || req.body?.examId || '').trim();
    const subjectId = req.query.subjectId
      ? String(req.query.subjectId)
      : req.body?.subjectId
      ? String(req.body.subjectId)
      : undefined;

    if (!examId || !Number.isInteger(standardNumber)) {
      return res.status(400).json({
        success: false,
        message: 'examId and a valid standardId (6 to 12) are required.',
      });
    }

    const result = await StudyManagementService.deleteStandardContent({
      examId,
      subjectId,
      standardNumber,
    });
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ===========================================================================
// UNITS
// ===========================================================================
router.get('/units', async (req: Request, res: Response) => {
  try {
    const examId = String(req.query.examId || 'group1');
    const subjectId = String(req.query.subjectId || 'all');
    const standardId = req.query.standardId ? parseInt(String(req.query.standardId), 10) : undefined;

    const units = await StudyManagementService.getUnits(examId, subjectId, standardId);
    return res.status(200).json({ success: true, units });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/units', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { exam_id, subject_id, standard_number, unit_number, unit_code, title, subject_name, description, question_count } = req.body;
    if (!exam_id || !subject_id || unit_number == null || !title) {
      return res.status(400).json({ success: false, message: 'exam_id, subject_id, unit_number and title are required.' });
    }
    const created = await StudyManagementService.createUnit({
      exam_id,
      subject_id,
      standard_number,
      unit_number: Number(unit_number),
      unit_code,
      title,
      subject_name,
      description,
      question_count,
    });
    return res.status(201).json({ success: true, unit: created });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/units/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await StudyManagementService.updateUnit(id, req.body);
    return res.status(200).json({ success: true, unit: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/units/:id/dependencies', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid unit ID.' });
    }
    const examId = req.query.examId ? String(req.query.examId) : undefined;
    const subjectId = req.query.subjectId ? String(req.query.subjectId) : undefined;
    const rawStd = req.query.standardId ?? req.query.standardNumber;
    const standardNumber =
      rawStd != null && String(rawStd).trim() !== '' && String(rawStd) !== 'all' && !isNaN(Number(rawStd))
        ? parseInt(String(rawStd), 10)
        : null;

    const deps = await StudyManagementService.getUnitDependencies(id, {
      examId,
      subjectId,
      standardNumber,
    });
    if (!deps.exists) {
      return res.status(404).json({ success: false, message: `Unit #${id} was not found.` });
    }
    if (deps.invalidOwnership) {
      return res.status(400).json({ success: false, invalidOwnership: true, message: deps.ownershipError });
    }
    return res.status(200).json({
      success: true,
      dependencies: {
        lessons: deps.lessons,
        topics: deps.topics,
        notes: deps.notes,
        questions: deps.questions,
      },
      scope: {
        unitId: deps.unit?.id,
        examId: deps.unit?.exam_id,
        subjectId: deps.unit?.subject_id,
        standardNumber: deps.scopeStandard ?? null,
        unitNumber: deps.unit?.unit_number,
        unitCode: deps.unit?.unit_code,
        unitTitle: deps.unit?.title,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/units/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const force = req.query.force === 'true' || req.body?.force === true;
    const examId = req.query.examId ? String(req.query.examId) : req.body?.examId;
    const subjectId = req.query.subjectId ? String(req.query.subjectId) : req.body?.subjectId;
    const rawStd = req.query.standardId ?? req.query.standardNumber ?? req.body?.standardId ?? req.body?.standardNumber;
    const standardNumber =
      rawStd != null && String(rawStd).trim() !== '' && String(rawStd) !== 'all' && !isNaN(Number(rawStd))
        ? parseInt(String(rawStd), 10)
        : null;

    const result = await StudyManagementService.deleteUnit(id, force, {
      examId,
      subjectId,
      standardNumber,
    });
    if (!result.success) {
      const status = result.notFound ? 404 : result.invalidOwnership ? 400 : result.dependencies ? 409 : 400;
      return res.status(status).json({
        success: false,
        invalidOwnership: result.invalidOwnership,
        message: result.message,
        scope: result.scope,
        dependencies: result.dependencies,
      });
    }
    return res.status(200).json({ success: true, scope: result.scope, deleted: result.deleted });
  } catch (err: any) {
    console.error('[StudyManagement API] DELETE /units/:id error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ===========================================================================
// LESSONS
// ===========================================================================
router.get('/lessons', async (req: Request, res: Response) => {
  try {
    const unitId = req.query.unitId ? parseInt(String(req.query.unitId), 10) : undefined;
    const unitNumber = req.query.unitNumber ? parseInt(String(req.query.unitNumber), 10) : undefined;
    const examId = req.query.examId ? String(req.query.examId) : undefined;
    const subjectId = req.query.subjectId ? String(req.query.subjectId) : undefined;
    const standardNumber = (req.query.standardId || req.query.standardNumber || req.query.classId)
      ? parseInt(String(req.query.standardId || req.query.standardNumber || req.query.classId), 10)
      : undefined;

    const lessons = await StudyManagementService.getLessons({
      unitId,
      unitNumber,
      examId,
      subjectId,
      standardNumber,
    });
    return res.status(200).json({ success: true, lessons });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/lessons', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { unit_id, exam_id, subject_id, standard_number, lesson_number, title, term, description, status } = req.body;
    if (!unit_id || !exam_id || !subject_id || !standard_number || !lesson_number || !title) {
      return res.status(400).json({
        success: false,
        message: 'unit_id, exam_id, subject_id, standard_number, lesson_number and title are required.',
      });
    }
    const created = await StudyManagementService.createLesson({
      unit_id: Number(unit_id),
      exam_id,
      subject_id,
      standard_number: Number(standard_number),
      lesson_number,
      title,
      term,
      description,
      status,
    });
    return res.status(201).json({ success: true, lesson: created });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/lessons/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const updated = await StudyManagementService.updateLesson(req.params.id, req.body);
    return res.status(200).json({ success: true, lesson: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/lessons/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true' || req.body?.force === true;
    const rawUnitId = req.query.unitId ?? req.body?.unitId;
    const unitId = rawUnitId != null && !isNaN(Number(rawUnitId)) ? parseInt(String(rawUnitId), 10) : undefined;
    const examId = req.query.examId ? String(req.query.examId) : req.body?.examId;
    const subjectId = req.query.subjectId ? String(req.query.subjectId) : req.body?.subjectId;
    const rawStd = req.query.standardId ?? req.query.standardNumber ?? req.body?.standardId ?? req.body?.standardNumber;
    const standardNumber =
      rawStd != null && String(rawStd).trim() !== '' && String(rawStd) !== 'all' && !isNaN(Number(rawStd))
        ? parseInt(String(rawStd), 10)
        : undefined;

    const result = await StudyManagementService.deleteLesson(req.params.id, force, {
      unitId,
      examId,
      subjectId,
      standardNumber,
    });
    if (!result.success) {
      const status = result.notFound ? 404 : result.invalidOwnership ? 400 : result.dependencies ? 409 : 400;
      return res.status(status).json({
        success: false,
        invalidOwnership: result.invalidOwnership,
        message: result.message,
        dependencies: result.dependencies,
      });
    }
    return res.status(200).json({ success: true, deleted: result.deleted });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ===========================================================================
// TOPICS
// ===========================================================================
router.get('/topics', async (req: Request, res: Response) => {
  try {
    const lessonId = String(req.query.lessonId || '').trim();
    const lessonTitle = String(req.query.lessonTitle || req.query.title || '').trim();
    const rawUnitId = req.query.unitId != null ? String(req.query.unitId).trim() : '';
    const unitId = (rawUnitId && !isNaN(Number(rawUnitId))) ? parseInt(rawUnitId, 10) : undefined;

    if (!lessonId && !lessonTitle) {
      return res.status(400).json({ success: false, message: 'lessonId or lessonTitle query parameter is required.', topics: [] });
    }
    const topics = await StudyManagementService.getTopics(lessonId || lessonTitle, { unitId, lessonTitle });
    return res.status(200).json({ success: true, lessonId, lessonTitle, topics });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message, topics: [] });
  }
});

router.post('/topics', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { lesson_id, unit_id, topic_name, description, display_order } = req.body;
    if (!lesson_id || !unit_id || !topic_name) {
      return res.status(400).json({ success: false, message: 'lesson_id, unit_id, and topic_name are required.' });
    }
    const created = await StudyManagementService.createTopic({
      lesson_id,
      unit_id: Number(unit_id),
      topic_name,
      description,
      display_order,
    });
    return res.status(201).json({ success: true, topic: created });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/topics/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await StudyManagementService.updateTopic(id, req.body);
    return res.status(200).json({ success: true, topic: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/topics/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const force = req.query.force === 'true' || req.body?.force === true;
    const lessonId = req.query.lessonId ? String(req.query.lessonId) : req.body?.lessonId;
    const rawUnitId = req.query.unitId ?? req.body?.unitId;
    const unitId = rawUnitId != null && !isNaN(Number(rawUnitId)) ? parseInt(String(rawUnitId), 10) : undefined;

    const result = await StudyManagementService.deleteTopic(id, force, { lessonId, unitId });
    if (!result.success) {
      const status = result.notFound ? 404 : result.invalidOwnership ? 400 : result.dependencies ? 409 : 400;
      return res.status(status).json({
        success: false,
        invalidOwnership: result.invalidOwnership,
        message: result.message,
        dependencies: result.dependencies,
      });
    }
    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ===========================================================================
// REORDER (Units, Lessons, Topics)
// ===========================================================================
router.post('/reorder', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { type, items } = req.body;
    if (!type || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'type (units|lessons|topics) and items array are required.' });
    }
    if (type === 'units') {
      await StudyManagementService.reorderUnits(items);
    } else if (type === 'lessons') {
      await StudyManagementService.reorderLessons(items);
    } else if (type === 'topics') {
      await StudyManagementService.reorderTopics(items);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid reorder type. Must be units, lessons, or topics.' });
    }
    return res.status(200).json({ success: true, type, count: items.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ===========================================================================
// STUDY NOTES SAVE / ATTACH
// ===========================================================================
router.get('/notes', async (req: Request, res: Response) => {
  try {
    const topicId = req.query.topicId ? String(req.query.topicId) : undefined;
    const lessonId = req.query.lessonId ? String(req.query.lessonId) : undefined;
    const lessonTitle = req.query.lessonTitle ? String(req.query.lessonTitle) : undefined;

    const notes = await StudyManagementService.getNotesForTopicOrLesson({
      topicId,
      lessonId,
      lessonTitle,
    });
    return res.status(200).json({ success: true, notes });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/notes', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const note = await StudyManagementService.saveStudyNote(req.body);
    return res.status(200).json({ success: true, note });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ===========================================================================
// TEXTBOOK-BASED AI LESSON FILTERING & GENERATION
// ===========================================================================
router.get('/textbooks', async (req: Request, res: Response) => {
  try {
    const standard = req.query.standard ? parseInt(String(req.query.standard), 10) : undefined;
    const subject = req.query.subject ? String(req.query.subject) : undefined;
    const term = req.query.term ? String(req.query.term) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

    const textbooks = await TextbookAiLessonService.listAvailableTextbooks({
      standard,
      subject,
      term,
      search,
    });

    return res.status(200).json({ success: true, textbooks });
  } catch (err: any) {
    console.error('[StudyManagement API] /textbooks error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/match-textbook-lessons', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const {
      unitId,
      unitNumber,
      unitTitle,
      examId,
      subjectId,
      standard,
      subject,
      term,
      tnpscTopics,
      materialIds,
    } = req.body;

    if (!unitId) {
      return res.status(400).json({ success: false, message: 'unitId is required.' });
    }
    if (!materialIds || !Array.isArray(materialIds) || materialIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one textbook PDF must be selected.' });
    }

    const topicsArray: string[] = Array.isArray(tnpscTopics)
      ? tnpscTopics
      : typeof tnpscTopics === 'string'
      ? tnpscTopics.split(/[\n,;•·-]+/).map(s => s.trim()).filter(s => s.length > 2)
      : [];

    const result = await TextbookAiLessonService.matchLessonsWithAi({
      unitId: Number(unitId),
      unitNumber: Number(unitNumber) || 1,
      unitTitle: String(unitTitle || ''),
      examId: String(examId || 'group1'),
      subjectId: String(subjectId || 'general-studies'),
      standard: Number(standard) || 6,
      subject: String(subject || 'General'),
      term: String(term || 'Term 1'),
      tnpscTopics: topicsArray,
      materialIds: materialIds.map(Number),
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    console.error('[StudyManagement API] /match-textbook-lessons error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/save-textbook-lessons', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { unitId, examId, subjectId, lessons } = req.body;

    if (!unitId || !lessons || !Array.isArray(lessons) || lessons.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'unitId and a non-empty array of approved lessons are required.',
      });
    }

    const result = await TextbookAiLessonService.saveApprovedLessons({
      unitId: Number(unitId),
      examId: String(examId || 'group1'),
      subjectId: String(subjectId || 'general-studies'),
      lessons,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[StudyManagement API] /save-textbook-lessons error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

