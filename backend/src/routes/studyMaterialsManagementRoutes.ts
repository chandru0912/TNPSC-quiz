import { Router, Request, Response } from 'express';
import multer from 'multer';
import { StudyManagementService } from '../services/studyManagementService';
import { AISyllabusImportService } from '../services/aiSyllabusImportService';
import { TextbookAiLessonService } from '../services/textbookAiLessonService';
import { SharedTextbookRepositoryService } from '../services/sharedTextbookRepositoryService';
import { requireAdminAuth } from '../middleware/auth';

const router = Router();

// Configure memory storage for syllabus PDF uploads
const syllabusUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are supported for syllabus import.'));
    }
  },
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
    const ok = await StudyManagementService.deleteSubject(req.params.id);
    return res.status(200).json({ success: ok });
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
    const subjectId = String(req.query.subjectId || 'general-studies');
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
    const deps = await StudyManagementService.getUnitDependencies(id);
    if (!deps.exists) {
      return res.status(404).json({ success: false, message: `Unit #${id} was not found.` });
    }
    const { exists: _exists, ...dependencies } = deps;
    return res.status(200).json({ success: true, dependencies });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/units/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const force = req.query.force === 'true' || req.body?.force === true;
    const result = await StudyManagementService.deleteUnit(id, force);
    if (!result.success) {
      const status = result.notFound ? 404 : result.dependencies ? 409 : 400;
      return res.status(status).json({ success: false, message: result.message, dependencies: result.dependencies });
    }
    return res.status(200).json({ success: true, deleted: result.deleted });
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
    const result = await StudyManagementService.deleteLesson(req.params.id, force);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message, dependencies: result.dependencies });
    }
    return res.status(200).json({ success: true });
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
    const result = await StudyManagementService.deleteTopic(id, force);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message, dependencies: result.dependencies });
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
// AI SYLLABUS IMPORT & GENERATION (SHARED TEXTBOOK REPOSITORY, PDF UPLOAD & DIRECT TEXT PASTE)
// ===========================================================================

router.get('/ai-syllabus/textbooks', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { standard, subject, term, medium, search } = req.query;
    const textbooks = await SharedTextbookRepositoryService.listAvailableTextbooks({
      standard: standard as any,
      subject: subject ? String(subject) : undefined,
      term: term ? String(term) : undefined,
      medium: medium ? String(medium) : undefined,
      search: search ? String(search) : undefined,
    });
    return res.status(200).json({ success: true, count: textbooks.length, textbooks });
  } catch (err: any) {
    console.error('[StudyManagement API] /ai-syllabus/textbooks error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/ai-syllabus/analyze-textbook', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { textbookId, examId, subjectId, standard, extractionMode } = req.body;
    if (!textbookId) {
      return res.status(400).json({ success: false, message: 'textbookId is required.' });
    }
    const analysis = await SharedTextbookRepositoryService.extractSyllabusFromTextbook({
      textbookId: Number(textbookId),
      examId: String(examId || 'group1'),
      subjectId: subjectId ? String(subjectId) : undefined,
      standard: standard ? Number(standard) : undefined,
      extractionMode,
    });
    return res.status(200).json({ success: true, ...analysis });
  } catch (err: any) {
    console.error('[StudyManagement API] /ai-syllabus/analyze-textbook error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/ai-syllabus/upload', requireAdminAuth, syllabusUpload.single('pdf'), async (req: Request, res: Response) => {
  try {
    const examId = String(req.body.examId || 'group1');
    const subjectId = req.body.subjectId ? String(req.body.subjectId) : undefined;
    const syllabusText = typeof req.body.syllabusText === 'string' ? req.body.syllabusText : undefined;
    const fileName = req.file?.originalname || (syllabusText ? 'pasted-syllabus.txt' : 'syllabus.pdf');
    const rawStandard = req.body.standard;
    const standard: number | 'all' | undefined =
      rawStandard === 'all'
        ? 'all'
        : (parseInt(String(rawStandard), 10) >= 6 && parseInt(String(rawStandard), 10) <= 12
          ? parseInt(String(rawStandard), 10)
          : undefined);

    if (!req.file?.buffer && (!syllabusText || syllabusText.trim().length < 30)) {
      return res.status(400).json({
        success: false,
        message: 'A valid PDF file or syllabus text (minimum 30 characters) is required.',
      });
    }

    const analysis = await AISyllabusImportService.analyzeSyllabus({
      pdfBuffer: req.file?.buffer,
      rawText: syllabusText,
      examId,
      subjectId,
      fileName,
      standard,
    });

    return res.status(200).json({ success: true, ...analysis });
  } catch (err: any) {
    console.error('[StudyManagement API] /ai-syllabus/upload error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/ai-syllabus/analyze-text', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { syllabusText, examId, subjectId, standard: rawStandard } = req.body;
    if (!syllabusText || typeof syllabusText !== 'string' || syllabusText.trim().length < 30) {
      return res.status(400).json({
        success: false,
        message: 'Please provide syllabus text (minimum 30 characters) for analysis.',
      });
    }

    const cleanExamId = String(examId || 'group1');
    const cleanSubId = subjectId ? String(subjectId) : undefined;
    const standard: number | 'all' | undefined =
      rawStandard === 'all'
        ? 'all'
        : (parseInt(String(rawStandard), 10) >= 6 && parseInt(String(rawStandard), 10) <= 12
          ? parseInt(String(rawStandard), 10)
          : undefined);

    const analysis = await AISyllabusImportService.analyzeSyllabus({
      rawText: syllabusText,
      examId: cleanExamId,
      subjectId: cleanSubId,
      fileName: 'direct-text-paste.txt',
      standard,
    });

    return res.status(200).json({ success: true, ...analysis });
  } catch (err: any) {
    console.error('[StudyManagement API] /ai-syllabus/analyze-text error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/ai-syllabus/publish', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { examId, subjectSlug, subjectName, units, overwriteExisting } = req.body;
    if (!examId || !subjectSlug || !Array.isArray(units) || units.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'examId, subjectSlug, and approved units array are required.',
      });
    }

    const result = await AISyllabusImportService.publishApprovedSyllabus({
      examId,
      subjectSlug,
      subjectName,
      units,
      overwriteExisting: Boolean(overwriteExisting),
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[StudyManagement API] /ai-syllabus/publish error:', err);
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

