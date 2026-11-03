import { Router, Request, Response } from 'express';
import pool from '../db';

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
  title: string;
  subjectName: string;
  notesCount: number;
  materialsCount: number;
  hasStudyNotes: boolean;
  hasTextbook: boolean;
}

const TNPSC_GROUPS: GroupOption[] = [
  { id: 'group1', name: 'TNPSC Group 1', code: 'Code: 497', badge: 'Degree Standard • Prelims', description: 'Deputy Collector, DSP, Commercial Tax Officer' },
  { id: 'group2', name: 'TNPSC Group 2', code: 'Code: 495', badge: 'Degree Standard • Prelims & Interview', description: 'Sub Registrar, Municipal Commissioner' },
  { id: 'group2a', name: 'TNPSC Group 2A', code: 'Code: 495', badge: 'Degree Standard • Non-Interview', description: 'Assistant Section Officer, Senior Inspector' },
  { id: 'group4', name: 'TNPSC Group 4', code: 'Code: 496', badge: 'SSLC Standard • Single Paper', description: 'Junior Assistant, VAO, Bill Collector, Typist' },
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
 * GET /api/syllabus/groups
 * Returns supported TNPSC Groups: Group 1, Group 2, Group 2A, Group 4.
 */
router.get('/groups', (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    groups: TNPSC_GROUPS,
  });
});

/**
 * GET /api/syllabus/subjects?groupId=
 * Returns subjects configured strictly for the specified TNPSC Group.
 */
router.get('/subjects', (req: Request, res: Response) => {
  const groupId = String(req.query.groupId || 'group4').toLowerCase().trim();
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
  const groupId = String(req.query.groupId || 'group4').toLowerCase().trim();
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
    const groupId = String(req.query.groupId || 'group4').toLowerCase().trim();
    const subjectId = String(req.query.subjectId || 'general-studies').toLowerCase().trim();
    const standardId = parseInt(String(req.query.standardId || '6'), 10) || 6;

    const baseUnits = getCanonicalUnits(subjectId, standardId);

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

    const units: UnitOption[] = baseUnits.map((u) => {
      const notesCount = notesCountMap.get(u.id) || 0;
      const materialsCount = materialsCountMap.get(u.id) || 0;
      return {
        id: u.id,
        unitNumber: u.unitNumber,
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

export default router;

