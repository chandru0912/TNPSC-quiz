import { Router, Request, Response } from 'express';
import pool from '../db';
import { StudyManagementService } from '../services/studyManagementService';
import { requireAdminAuth } from '../middleware/auth';

const router = Router();

export interface GroupOption {
  id: string;
  name: string;
  code: string;
  badge: string;
  description?: string;
}

export interface SubjectOption {
  id: string;
  name: string;
  description?: string;
}

export interface StandardOption {
  id: number;
  label: string;
  shortLabel: string;
}

export interface UnitOption {
  id: number;
  unitNumber: string;
  unit_number?: number;
  title: string;
  subjectName: string;
  notesCount: number;
  materialsCount: number;
  hasStudyNotes: boolean;
  hasTextbook: boolean;
}

const TNPSC_GROUPS: GroupOption[] = [
  { id: 'group1', name: 'TNPSC Group 1', code: '', badge: '', description: '' },
  { id: 'group2', name: 'TNPSC Group 2, 2A', code: '', badge: '', description: '' },
  { id: 'group4', name: 'TNPSC Group 4', code: '', badge: '', description: '' },
];

const GROUP_SUBJECTS: Record<string, SubjectOption[]> = {
  group1: [
    { id: 'general-studies', name: 'General Studies', description: 'General Science, History, Polity, Economy, Geography, TN Heritage' },
    { id: 'aptitude', name: 'Aptitude and Mental Ability', description: 'Mental ability, Simplification, Ratio, Logical reasoning' },
  ],
  group2: [
    { id: 'general-studies', name: 'General Studies', description: 'General Science, History, Polity, Economy, Geography, TN Heritage' },
    { id: 'aptitude', name: 'Aptitude and Mental Ability', description: 'Mental ability, Simplification, Ratio, Logical reasoning' },
    { id: 'general-english', name: 'General English', description: 'Grammar, Literature, Vocabulary, Comprehension' },
    { id: 'general-tamil', name: 'General Tamil', description: 'இலக்கணம், இலக்கியம், தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும்' },
  ],
  group2a: [
    { id: 'general-studies', name: 'General Studies', description: 'General Science, History, Polity, Economy, Geography, TN Heritage' },
    { id: 'aptitude', name: 'Aptitude and Mental Ability', description: 'Mental ability, Simplification, Ratio, Logical reasoning' },
    { id: 'general-english', name: 'General English', description: 'Grammar, Literature, Vocabulary, Comprehension' },
    { id: 'general-tamil', name: 'General Tamil', description: 'இலக்கணம், இலக்கியம், தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும்' },
  ],
  group4: [
    { id: 'general-studies', name: 'General Studies', description: 'General Science, History, Polity, Economy, Geography, TN Heritage' },
    { id: 'aptitude', name: 'Aptitude and Mental Ability', description: 'Mental ability, Simplification, Ratio, Logical reasoning' },
    { id: 'general-tamil', name: 'General Tamil', description: 'இலக்கணம், இலக்கியம், தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும்' },
    { id: 'general-english', name: 'General English', description: 'Grammar, Literature, Vocabulary, Comprehension' },
  ],
};

const ALL_STANDARDS: StandardOption[] = [
  { id: 6, label: '6th Standard', shortLabel: '6th Std' },
  { id: 7, label: '7th Standard', shortLabel: '7th Std' },
  { id: 8, label: '8th Standard', shortLabel: '8th Std' },
  { id: 9, label: '9th Standard', shortLabel: '9th Std' },
  { id: 10, label: '10th Standard', shortLabel: '10th Std' },
  { id: 11, label: '11th Standard', shortLabel: '11th Std' },
  { id: 12, label: '12th Standard', shortLabel: '12th Std' },
];

function getCanonicalUnits(subjectId: string, standardId: number) {
  const normSub = String(subjectId || '').toLowerCase().trim();

  if (normSub === 'general-studies') {
    return [
      { id: 1, unitNumber: 'Unit 1', title: 'General Science', subjectName: 'General Science' },
      { id: 2, unitNumber: 'Unit 2', title: 'Geography of India', subjectName: 'Geography' },
      { id: 3, unitNumber: 'Unit 3', title: 'History & Culture of India and INM', subjectName: 'History & INM' },
      { id: 4, unitNumber: 'Unit 4', title: 'Indian Polity', subjectName: 'Indian Polity' },
      { id: 5, unitNumber: 'Unit 5', title: 'Indian Economy & TN Admin', subjectName: 'Economy & TN Admin' },
      { id: 6, unitNumber: 'Unit 6', title: 'History, Culture & Heritage of Tamil Nadu', subjectName: 'Tamil Nadu Heritage' },
    ];
  }

  if (normSub === 'aptitude') {
    if (standardId === 10) {
      return [
        { id: 1, unitNumber: 'Unit 1', title: 'Aptitude & Mental Ability', subjectName: 'Aptitude' },
        { id: 2, unitNumber: 'Unit 2', title: 'Reasoning & Analytical Ability', subjectName: 'Aptitude' },
      ];
    }
    return [
      { id: 1, unitNumber: 'Unit 1', title: 'Aptitude & Mental Ability', subjectName: 'Aptitude' },
    ];
  }

  if (normSub === 'general-tamil') {
    return [
      { id: 1, unitNumber: 'அலகு 1', title: 'பகுதி (அ) - இலக்கணம் (Grammar)', subjectName: 'General Tamil' },
      { id: 2, unitNumber: 'அலகு 2', title: 'பகுதி (ஆ) - இலக்கியம் (Literature)', subjectName: 'General Tamil' },
      { id: 3, unitNumber: 'அலகு 3', title: 'பகுதி (ஆ) - அற இலக்கியங்கள் & காப்பியங்கள்', subjectName: 'General Tamil' },
      { id: 4, unitNumber: 'அலகு 4', title: 'பகுதி (ஆ) - பக்தி இலக்கியம் & சிற்றிலக்கியங்கள்', subjectName: 'General Tamil' },
      { id: 5, unitNumber: 'அலகு 5', title: 'பகுதி (இ) - தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும்', subjectName: 'General Tamil' },
      { id: 6, unitNumber: 'அலகு 6', title: 'பகுதி (இ) - நவீன இலக்கியம் & உரைநடை', subjectName: 'General Tamil' },
      { id: 7, unitNumber: 'அலகு 7', title: 'பகுதி (இ) - நாட்டுப்புறக் கலைகள் & பயன்பாட்டுத் தமிழ்', subjectName: 'General Tamil' },
    ];
  }

  if (normSub === 'general-english') {
    return [
      { id: 1, unitNumber: 'Unit 1', title: 'Grammar', subjectName: 'General English' },
      { id: 2, unitNumber: 'Unit 2', title: 'Vocabulary', subjectName: 'General English' },
      { id: 3, unitNumber: 'Unit 3', title: 'Writing Skills', subjectName: 'General English' },
      { id: 4, unitNumber: 'Unit 4', title: 'Technical Terms', subjectName: 'General English' },
      { id: 5, unitNumber: 'Unit 5', title: 'Reading Comprehension', subjectName: 'General English' },
      { id: 6, unitNumber: 'Unit 6', title: 'Translation', subjectName: 'General English' },
      { id: 7, unitNumber: 'Unit 7', title: 'Literary Works (SSLC Standard)', subjectName: 'General English' },
    ];
  }

  return [];
}

/**
 * GET /api/syllabus
 * Returns full hierarchy tree or syllabus summary from database.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const examId = String(req.query.examId || req.query.groupId || 'group1');
    const subjectId = String(req.query.subjectId || 'general-studies');
    const standardNumber = (req.query.standardId || req.query.standardNumber || req.query.classId)
      ? parseInt(String(req.query.standardId || req.query.standardNumber || req.query.classId), 10)
      : undefined;

    const tree = await StudyManagementService.getFullHierarchyTree({
      examId,
      subjectId,
      standardNumber,
    });
    return res.status(200).json({ success: true, examId, subjectId, standardNumber, tree });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/syllabus/exams
 * Returns supported TNPSC Exams from database (single source of truth).
 */
router.get('/exams', async (_req: Request, res: Response) => {
  try {
    const exams = await StudyManagementService.getExams();
    return res.status(200).json({ success: true, exams, groups: exams });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message, exams: TNPSC_GROUPS, groups: TNPSC_GROUPS });
  }
});

/**
 * GET /api/syllabus/groups
 * Alias for /exams
 */
router.get('/groups', async (_req: Request, res: Response) => {
  try {
    const exams = await StudyManagementService.getExams();
    return res.status(200).json({ success: true, groups: exams, exams });
  } catch (err: any) {
    return res.status(200).json({ success: true, groups: TNPSC_GROUPS, exams: TNPSC_GROUPS });
  }
});

/**
 * GET /api/syllabus/subjects?groupId=
 * Returns subjects configured strictly for the specified TNPSC Group from database or fallback.
 */
router.get('/subjects', async (req: Request, res: Response) => {
  let rawGroup = String(req.query.groupId || 'group4').toLowerCase().trim();
  const groupId = rawGroup === 'group2a' ? 'group2' : rawGroup;
  try {
    const dbSubs = await pool.query(
      'SELECT * FROM syllabus_subjects WHERE exam_id = $1 AND is_active = true ORDER BY display_order ASC, name ASC',
      [groupId]
    );
    if (dbSubs.rows.length > 0) {
      return res.status(200).json({
        success: true,
        groupId,
        subjects: dbSubs.rows.map((s) => ({
          id: s.subject_slug,
          name: s.name,
          description: s.description || '',
        })),
      });
    }
  } catch (err: any) {
    // Fallback to static
  }
  const subjects = GROUP_SUBJECTS[groupId] || GROUP_SUBJECTS.group4;

  return res.status(200).json({
    success: true,
    groupId,
    subjects,
  });
});

/**
 * GET /api/syllabus/standards?groupId=&subjectId=
 * Returns standards dynamically based on Group and Subject.
 * Group 4 & Aptitude: 6th to 10th (SSLC).
 * Group 1, 2, 2A with General Studies / Tamil / English: 6th to 12th.
 */
router.get('/standards', (req: Request, res: Response) => {
  let rawGroup = String(req.query.groupId || 'group4').toLowerCase().trim();
  const groupId = rawGroup === 'group2a' ? 'group2' : rawGroup;
  const subjectId = String(req.query.subjectId || 'general-studies').toLowerCase().trim();

  let standards = ALL_STANDARDS;
  if (groupId === 'group4' || subjectId === 'aptitude') {
    standards = ALL_STANDARDS.filter((s) => s.id >= 6 && s.id <= 10);
  }

  return res.status(200).json({
    success: true,
    groupId,
    subjectId,
    standards,
  });
});

/**
 * GET /api/syllabus/units?groupId=&subjectId=&standardId=
 * Loads units dynamically based on Selected Group, Subject, Standard.
 * Cross-references with PostgreSQL study_notes and google_drive_materials to report live counts.
 */
router.get('/units', async (req: Request, res: Response) => {
  try {
    const rawGroupId = String(req.query.groupId || 'group4').toLowerCase().trim();
    const groupId = (rawGroupId === 'group2_2a' || rawGroupId === 'group2' || rawGroupId === 'group-2' || rawGroupId === 'group2a')
      ? 'group2'
      : (rawGroupId === 'group4_vao' || rawGroupId === 'group4' || rawGroupId === 'group-4' || rawGroupId === 'vao')
      ? 'group4'
      : rawGroupId;
    const subjectId = String(req.query.subjectId || 'general-studies').toLowerCase().trim();
    const standardId = parseInt(String(req.query.standardId || '6'), 10) || 6;

    // Query database syllabus_units first, fallback to canonical
    let baseUnits: Array<{ id: number; unitNumber: string; title: string; subjectName: string }> = [];
    try {
      const dbUnitsRes = await pool.query(
        `SELECT * FROM syllabus_units
         WHERE (exam_id = $1 OR ($1 = 'group2a' AND exam_id = 'group2') OR ($1 = 'group2' AND exam_id = 'group2a'))
           AND (subject_id = $2 OR subject_id = $3 OR subject_id = 'all')
           AND is_active = true
         ORDER BY display_order ASC, unit_number ASC`,
        [groupId, subjectId, `${groupId}-${subjectId}`]
      );
      if (dbUnitsRes.rows.length > 0) {
        baseUnits = dbUnitsRes.rows.map((r) => ({
          id: r.id,
          unitNumber: r.unit_code || `Unit ${r.unit_number}`,
          unitNum: r.unit_number,
          title: r.title,
          subjectName: r.subject_name || r.title,
        }));
      }
    } catch (err: any) {
      // Fallback
    }

    if (baseUnits.length === 0) {
      baseUnits = getCanonicalUnits(subjectId, standardId);
    }

    // Query live counts from study_notes
    const notesCountRes = await pool.query(
      `SELECT unit_id, COUNT(*)::int AS count
       FROM study_notes
       WHERE (LOWER(category) = LOWER($1) OR ($1 = 'group2a' AND LOWER(category) = 'group2'))
         AND class_id = $2
       GROUP BY unit_id`,
      [groupId, standardId]
    );
    const notesCountMap = new Map<number, number>();
    for (const row of notesCountRes.rows) {
      if (row.unit_id != null) {
        notesCountMap.set(Number(row.unit_id), Number(row.count || 0));
      }
    }

    // Query live materials count from google_drive_materials
    const materialsRes = await pool.query(
      `SELECT id, unit, classification_meta, extracted_toc
       FROM google_drive_materials
       WHERE standard = $1
         AND (applicable_groups IS NULL OR applicable_groups::text ILIKE '%' || $2 || '%' OR LOWER(tnpsc_group) = LOWER($2))`,
      [standardId, groupId]
    );

    const materialsCountMap = new Map<number, number>();
    for (const row of materialsRes.rows) {
      const unitsList = row.classification_meta?.units || row.extracted_toc || [];
      if (Array.isArray(unitsList) && unitsList.length > 0) {
        for (const u of unitsList) {
          const uNum = Number(u.unitNumber ?? u.unit_number);
          if (uNum) {
            materialsCountMap.set(uNum, (materialsCountMap.get(uNum) || 0) + 1);
          }
        }
      } else if (row.unit != null) {
        const uNum = Number(row.unit);
        materialsCountMap.set(uNum, (materialsCountMap.get(uNum) || 0) + 1);
      }
    }

    const units: UnitOption[] = baseUnits.map((u: any) => {
      const notesCount = notesCountMap.get(u.id) || notesCountMap.get(u.unitNum) || 0;
      const materialsCount = materialsCountMap.get(u.unitNum) || materialsCountMap.get(u.id) || 0;
      return {
        id: u.id,
        unitNumber: u.unitNumber,
        unit_number: u.unitNum,
        title: u.title,
        subjectName: u.subjectName,
        notesCount,
        materialsCount,
        hasStudyNotes: notesCount > 0,
        hasTextbook: materialsCount > 0,
      };
    });

    return res.status(200).json({
      success: true,
      groupId,
      subjectId,
      standardId,
      units,
    });
  } catch (error: any) {
    console.error('[Syllabus Routes] Error fetching units:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch syllabus units',
      units: [],
    });
  }
});

/**
 * GET /api/syllabus/lessons
 * Returns lessons for the specified unit/exam/subject/standard from PostgreSQL.
 */
router.get('/lessons', async (req: Request, res: Response) => {
  try {
    const rawUnitId = req.query.unitId != null ? String(req.query.unitId).trim() : '';
    const rawUnitNum = req.query.unitNumber != null ? String(req.query.unitNumber).trim() : '';
    const unitId = (rawUnitId && rawUnitId !== 'all' && !isNaN(Number(rawUnitId))) ? parseInt(rawUnitId, 10) : undefined;
    const unitNumber = (rawUnitNum && rawUnitNum !== 'all' && !isNaN(Number(rawUnitNum))) ? parseInt(rawUnitNum, 10) : undefined;
    const rawExam = String(req.query.examId || req.query.groupId || '').toLowerCase().trim();
    const examId = rawExam === 'group2a' ? 'group2' : (rawExam || undefined);
    const rawSubject = req.query.subjectId ? String(req.query.subjectId).trim() : '';
    const subjectId = (rawSubject && rawSubject !== 'all') ? rawSubject : undefined;

    const rawStd = req.query.standardId || req.query.standardNumber || req.query.classId;
    const standardStr = rawStd != null ? String(rawStd).trim() : '';
    const standardNumber = (standardStr && standardStr !== 'all' && !isNaN(Number(standardStr)))
      ? parseInt(standardStr, 10)
      : undefined;

    const lessons = await StudyManagementService.getLessons({
      unitId,
      unitNumber,
      examId,
      subjectId,
      standardNumber,
    });

    return res.status(200).json({
      success: true,
      examId,
      subjectId,
      standardNumber,
      unitId: unitId ?? unitNumber,
      unitNumber,
      lessons,
    });
  } catch (err: any) {
    console.error('[Syllabus Routes] /lessons error:', err);
    return res.status(500).json({ success: false, message: err.message, lessons: [] });
  }
});

/**
 * GET /api/syllabus/topics
 * Returns specific topics for the given lesson from PostgreSQL.
 */
router.get('/topics', async (req: Request, res: Response) => {
  try {
    const lessonId = String(req.query.lessonId || '').trim();
    const lessonTitle = String(req.query.lessonTitle || req.query.title || '').trim();
    const rawUnitId = req.query.unitId != null ? String(req.query.unitId).trim() : '';
    const unitId = (rawUnitId && !isNaN(Number(rawUnitId))) ? parseInt(rawUnitId, 10) : undefined;

    if (!lessonId && !lessonTitle) {
      return res.status(400).json({ success: false, message: 'lessonId or lessonTitle query parameter is required', topics: [] });
    }
    const topics = await StudyManagementService.getTopics(lessonId || lessonTitle, { unitId, lessonTitle });
    return res.status(200).json({ success: true, lessonId, lessonTitle, topics });
  } catch (err: any) {
    console.error('[Syllabus Routes] /topics error:', err);
    return res.status(500).json({ success: false, message: err.message, topics: [] });
  }
});

// ===========================================================================
// ADMIN MANAGEMENT CRUD & REORDER (Section 9 Architecture)
// ===========================================================================

// UNITS
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

router.patch('/units/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await StudyManagementService.updateUnit(id, req.body);
    return res.status(200).json({ success: true, unit: updated });
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

router.delete('/units/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const force = req.query.force === 'true' || req.body?.force === true;
    const result = await StudyManagementService.deleteUnit(id, force);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message, dependencies: result.dependencies });
    }
    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// LESSONS
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

router.patch('/lessons/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const updated = await StudyManagementService.updateLesson(req.params.id, req.body);
    return res.status(200).json({ success: true, lesson: updated });
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

// TOPICS
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

router.patch('/topics/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await StudyManagementService.updateTopic(id, req.body);
    return res.status(200).json({ success: true, topic: updated });
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

// REORDER
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

export default router;

