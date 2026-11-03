import { Router, Request, Response } from 'express';
import pool from '../db';
import { classifyTermVolume, getMappedTextbookSubjects, normalizeSubjectKey } from '../services/mcqCascadeService';
import { getCanonicalLessons } from '../data/canonicalSyllabusLessons';
import { getRegisteredTopicsForLesson } from '../services/topicAlignmentService';

const router = Router();

export interface LessonOption {
  lessonId: string;
  lessonNumber: string;
  title: string;
  unitId: number;
  term?: string | null;
  volume?: string | null;
  notesCount: number;
  textbooksCount: number;
  hasStudyNotes: boolean;
  hasTextbook: boolean;
  source: 'study_notes' | 'google_drive' | 'syllabus';
  topics: string[];
}

function resolveTopicsForLesson(title: string): string[] {
  const reg = getRegisteredTopicsForLesson(title);
  if (reg && reg.length > 0) return reg;
  return [
    `${title}: Core Principles & Definitions`,
    `${title}: Facts, Figures & Key Concepts`,
    `${title}: TNPSC Exam Applications`,
  ];
}

export interface TextbookOption {
  id: number;
  key: string;
  sourceType: 'drive' | 'textbook';
  textbookId: number | null;
  materialId: number | null;
  gdriveFileId: string | null;
  bookName: string;
  subject: string;
  standard: number;
  medium: string;
  term: string | null;
  volume: string | null;
  termOptions: string[];
  volumeOptions: string[];
  status: string;
  hasExtractedText: boolean;
  extractionStatus?: string;
  totalPages?: number;
}

function normalizeSubjectMatch(materialSubject: string, mappedSubjects: string[]): boolean {
  const norm = String(materialSubject || '').toLowerCase().trim();
  return mappedSubjects.some((m) => {
    const mapped = m.toLowerCase().trim();
    if (norm === mapped) return true;
    if (norm === 'social science') {
      return mapped === 'social science' || mapped === 'geography' || mapped === 'history' || mapped === 'polity' || mapped === 'civics' || mapped === 'economics';
    }
    if (norm === 'science') {
      return mapped === 'science' || mapped === 'general science' || mapped === 'physics' || mapped === 'chemistry' || mapped === 'biology';
    }
    if (norm === 'mathematics' || norm === 'maths') {
      return mapped === 'mathematics' || mapped === 'maths' || mapped === 'aptitude' || mapped === 'mental ability';
    }
    if (norm === 'tamil') {
      return mapped === 'tamil' || mapped === 'general tamil';
    }
    if (norm === 'english') {
      return mapped === 'english' || mapped === 'general english';
    }
    return norm.includes(mapped) || mapped.includes(norm);
  });
}

function parseLessonNumberSort(numStr: string): number {
  const parts = String(numStr || '0').split('.').map((p) => parseInt(p, 10) || 0);
  return (parts[0] || 0) * 1000 + (parts[1] || 0);
}

/**
 * GET /api/study-materials/terms?groupId=&subjectId=&standardId=&unitId=&textbookId=&materialId=
 * Returns available terms dynamically from the syllabus and textbook database.
 * Supports: Term 1, Term 2, Term 3 for 6-8; Term 1, 2, 3, Full Year for 9; Full Year for 10-12.
 */
router.get('/terms', async (req: Request, res: Response) => {
  try {
    const textbookId = req.query.textbookId ? parseInt(String(req.query.textbookId), 10) : null;
    const materialId = req.query.materialId ? parseInt(String(req.query.materialId), 10) : null;
    const standardId = req.query.standardId
      ? parseInt(String(req.query.standardId), 10)
      : (req.query.standard ? parseInt(String(req.query.standard), 10) : null);
    const subjectId = req.query.subjectId ? String(req.query.subjectId).trim().toLowerCase() : '';

    let terms: string[] = [];

    if (materialId || textbookId) {
      let termValue: string | null = null;
      let volumeValue: string | null = null;

      if (materialId) {
        const resMat = await pool.query(
          'SELECT term, volume, classification_meta FROM google_drive_materials WHERE id = $1',
          [materialId]
        );
        if (resMat.rows[0]) {
          termValue = resMat.rows[0].term || resMat.rows[0].classification_meta?.term || null;
          volumeValue = resMat.rows[0].volume || resMat.rows[0].classification_meta?.volume || null;
        }
      } else if (textbookId) {
        const resTb = await pool.query(
          'SELECT term, volume FROM textbooks WHERE id = $1',
          [textbookId]
        );
        if (resTb.rows[0]) {
          termValue = resTb.rows[0].term || null;
          volumeValue = resTb.rows[0].volume || null;
        }
      }

      const { term } = classifyTermVolume(termValue, volumeValue);
      terms = term ? [term] : ['Not Applicable'];
    } else if (standardId != null) {
      if (standardId >= 10) {
        terms = ['Full Year'];
      } else if (standardId === 9) {
        const dbTerms = await pool.query(
          `SELECT DISTINCT term FROM google_drive_materials WHERE standard = $1 AND term IS NOT NULL`,
          [standardId]
        );
        const termsSet = new Set<string>();
        dbTerms.rows.forEach((r) => { if (r.term) termsSet.add(r.term); });
        termsSet.add('Term 1');
        termsSet.add('Term 2');
        termsSet.add('Term 3');
        terms = ['Term 1', 'Term 2', 'Term 3', 'Full Year'].filter((t) => termsSet.has(t));
        if (terms.length === 0) terms = ['Term 1', 'Full Year'];
      } else {
        // Standards 6, 7, 8
        const dbTerms = await pool.query(
          `SELECT DISTINCT term FROM google_drive_materials WHERE standard = $1 AND term IS NOT NULL`,
          [standardId]
        );
        const termsSet = new Set<string>();
        dbTerms.rows.forEach((r) => { if (r.term) termsSet.add(r.term); });
        termsSet.add('Term 1');
        termsSet.add('Term 2');
        termsSet.add('Term 3');
        terms = ['Term 1', 'Term 2', 'Term 3'].filter((t) => termsSet.has(t));
        if (terms.length === 0) terms = ['Term 1', 'Term 2', 'Term 3'];
      }
    } else {
      terms = ['Term 1', 'Term 2', 'Term 3'];
    }

    const selected = terms.includes('Term 1') ? 'Term 1' : (terms[0] || 'Full Year');

    return res.status(200).json({
      success: true,
      standardId,
      terms,
      selected,
    });
  } catch (error: any) {
    console.error('[Study Material Routes] Error fetching terms:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch terms',
      terms: ['Term 1'],
      selected: 'Term 1',
    });
  }
});

/**
 * GET /api/study-materials/lessons?groupId=&subjectId=&standardId=&unitId=&term=
 * Fetches lessons strictly belonging to the selected Group -> Subject -> Standard -> Unit -> Term.
 * Automatically falls back to the authoritative Canonical Syllabus Lessons dataset.
 */
router.get('/lessons', async (req: Request, res: Response) => {
  try {
    const groupId = String(req.query.groupId || 'group4').toLowerCase().trim();
    const subjectId = String(req.query.subjectId || 'general-studies').toLowerCase().trim();
    const standardId = parseInt(String(req.query.standardId || '6'), 10) || 6;
    const unitId = parseInt(String(req.query.unitId || '1'), 10) || 1;
    const term = req.query.term ? String(req.query.term).trim() : '';

    const mappedSubjects = getMappedTextbookSubjects(subjectId, unitId);

    // 1. Query study_notes database records
    let notesQuery = `
      SELECT DISTINCT
        id,
        COALESCE(lesson_id, lesson_code, '') AS lesson_id,
        COALESCE(lesson_number, '') AS lesson_number,
        lesson_title,
        unit_id,
        term
      FROM study_notes
      WHERE (LOWER(category) = LOWER($1) OR ($1 = 'group2a' AND LOWER(category) = 'group2'))
        AND class_id = $2
        AND unit_id = $3
        AND lesson_title IS NOT NULL AND TRIM(lesson_title) <> ''
    `;
    const notesParams: any[] = [groupId, standardId, unitId];

    if (term && term !== 'Not Applicable' && term !== 'All') {
      notesQuery += ` AND (term ILIKE $4 OR (class_id >= 10 AND (term IS NULL OR term ILIKE '%Full Year%')))`;
      notesParams.push(`%${term}%`);
    }
    notesQuery += ` ORDER BY lesson_title ASC`;

    const notesRes = await pool.query(notesQuery, notesParams);

    // 2. Query google_drive_materials database records
    const gdmRes = await pool.query(
      `SELECT id, file_name, tnpsc_group, standard, subject, term, volume, medium,
              unit, lesson, lesson_id, classification_meta, extracted_toc, extracted_text
       FROM google_drive_materials
       WHERE standard = $1
         AND (applicable_groups IS NULL OR applicable_groups::text ILIKE '%' || $2 || '%' OR LOWER(tnpsc_group) = LOWER($2))`,
      [standardId, groupId]
    );

    const relevantMaterials = gdmRes.rows.filter((r) =>
      normalizeSubjectMatch(r.subject, mappedSubjects)
    );

    const lessonMap = new Map<string, LessonOption>();

    // Add lessons found in google_drive_materials (TOC and column)
    for (const mat of relevantMaterials) {
      if (term && term !== 'Not Applicable' && term !== 'All' && mat.term && standardId < 10) {
        if (!mat.term.toLowerCase().includes(term.toLowerCase())) continue;
      }

      const unitsList = mat.classification_meta?.units || mat.extracted_toc || [];
      let foundInToc = false;

      if (Array.isArray(unitsList) && unitsList.length > 0) {
        for (const u of unitsList) {
          const uNum = Number(u.unitNumber ?? u.unit_number);
          if (uNum === unitId && Array.isArray(u.lessons)) {
            u.lessons.forEach((l: any, idx: number) => {
              foundInToc = true;
              const lessonNum = l.lessonNumber || `${unitId}.${idx + 1}`;
              const key = `${lessonNum}:${l.title}`.toLowerCase();

              const existing = lessonMap.get(key);
              if (existing) {
                existing.textbooksCount += 1;
                existing.hasTextbook = true;
              } else {
                lessonMap.set(key, {
                  lessonId: l.lessonId || `lesson-${unitId}-${idx + 1}`,
                  lessonNumber: lessonNum,
                  title: l.title,
                  unitId,
                  term: mat.term || null,
                  volume: mat.volume || null,
                  notesCount: 0,
                  textbooksCount: 1,
                  hasStudyNotes: false,
                  hasTextbook: true,
                  source: 'google_drive',
                  topics: resolveTopicsForLesson(l.title),
                });
              }
            });
          }
        }
      }

      if (!foundInToc && mat.unit === unitId && mat.lesson) {
        const lessonNum = `${unitId}.1`;
        const key = `${lessonNum}:${mat.lesson}`.toLowerCase();
        const existing = lessonMap.get(key);
        if (existing) {
          existing.textbooksCount += 1;
          existing.hasTextbook = true;
        } else {
          lessonMap.set(key, {
            lessonId: mat.lesson_id || `lesson-${unitId}-1`,
            lessonNumber: lessonNum,
            title: mat.lesson,
            unitId,
            term: mat.term || null,
            volume: mat.volume || null,
            notesCount: 0,
            textbooksCount: 1,
            hasStudyNotes: false,
            hasTextbook: true,
            source: 'google_drive',
            topics: resolveTopicsForLesson(mat.lesson),
          });
        }
      }
    }

    // Add lessons from study_notes
    for (const note of notesRes.rows) {
      const lessonNum = note.lesson_number || `${unitId}.1`;
      const key = `${lessonNum}:${note.lesson_title}`.toLowerCase();
      const existing = lessonMap.get(key);
      if (existing) {
        existing.notesCount += 1;
        existing.hasStudyNotes = true;
        if (note.lesson_id && !existing.lessonId) {
          existing.lessonId = note.lesson_id;
        }
      } else {
        lessonMap.set(key, {
          lessonId: note.lesson_id || `note-${unitId}-${note.id}`,
          lessonNumber: lessonNum,
          title: note.lesson_title,
          unitId,
          term: note.term || null,
          volume: null,
          notesCount: 1,
          textbooksCount: 0,
          hasStudyNotes: true,
          hasTextbook: false,
          source: 'study_notes',
          topics: resolveTopicsForLesson(note.lesson_title),
        });
      }
    }

    // 3. Fallback to Canonical Syllabus Lessons dataset
    const canonicalLessons = getCanonicalLessons(subjectId, standardId, unitId, term);
    for (const can of canonicalLessons) {
      const key = `${can.lessonNumber}:${can.title}`.toLowerCase();
      if (!lessonMap.has(key)) {
        lessonMap.set(key, {
          lessonId: can.lessonId,
          lessonNumber: can.lessonNumber,
          title: can.title,
          unitId: can.unitId,
          term: can.term,
          volume: can.volume || null,
          notesCount: 0,
          textbooksCount: relevantMaterials.length > 0 ? 1 : 0,
          hasStudyNotes: false,
          hasTextbook: relevantMaterials.length > 0,
          source: 'syllabus',
          topics: resolveTopicsForLesson(can.title),
        });
      }
    }

    // Sort lessons naturally by lesson number (1.1, 1.2, 1.3...)
    const lessons = Array.from(lessonMap.values()).sort((a, b) => {
      const diff = parseLessonNumberSort(a.lessonNumber) - parseLessonNumberSort(b.lessonNumber);
      if (diff !== 0) return diff;
      return a.title.localeCompare(b.title);
    });

    return res.status(200).json({
      success: true,
      groupId,
      subjectId,
      standardId,
      unitId,
      term: term || 'All',
      count: lessons.length,
      lessons,
    });
  } catch (error: any) {
    console.error('[Study Material Routes] Error fetching lessons:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch lessons',
      lessons: [],
    });
  }
});

/**
 * GET /api/study-materials/topics?lessonTitle=&lessonNumber=
 * Returns topics and subtopics for a specific lesson from the authoritative registry.
 */
router.get('/topics', async (req: Request, res: Response) => {
  try {
    const lessonTitle = String(req.query.lessonTitle || '').trim();
    const lessonNumber = String(req.query.lessonNumber || '').trim();
    if (!lessonTitle) {
      return res.status(400).json({ success: false, message: 'lessonTitle is required' });
    }
    const topics = resolveTopicsForLesson(lessonTitle);
    return res.status(200).json({
      success: true,
      lessonTitle,
      lessonNumber,
      count: topics.length,
      topics,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message, topics: [] });
  }
});

/**
 * GET /api/study-materials/textbooks?groupId=&subjectId=&standardId=&unitId=&term=&lessonId=&lessonTitle=
 * Automatically identifies and returns the matching Samacheer Kalvi textbooks for the selected
 * Subject, Standard, Unit, Term, and Lesson.
 */
router.get('/textbooks', async (req: Request, res: Response) => {
  try {
    const groupId = String(req.query.groupId || 'group4').toLowerCase().trim();
    const subjectId = String(req.query.subjectId || 'general-studies').toLowerCase().trim();
    const standardId = parseInt(String(req.query.standardId || '6'), 10) || 6;
    const unitId = parseInt(String(req.query.unitId || '1'), 10) || 1;
    const term = req.query.term ? String(req.query.term).trim() : '';
    const lessonId = req.query.lessonId ? String(req.query.lessonId).trim() : '';
    const lessonTitle = req.query.lessonTitle ? String(req.query.lessonTitle).trim() : '';

    const mappedSubjects = getMappedTextbookSubjects(subjectId, unitId, lessonTitle);

    // 1. Search google_drive_materials
    const gdmRes = await pool.query(
      `SELECT id, file_name, google_drive_file_id, standard, subject, medium,
              term, volume, page_count, total_pages, extraction_status, extracted_text, classification_meta, extracted_toc
       FROM google_drive_materials
       WHERE standard = $1
         AND (applicable_groups IS NULL OR applicable_groups::text ILIKE '%' || $2 || '%' OR LOWER(tnpsc_group) = LOWER($2))`,
      [standardId, groupId]
    );

    // 2. Search textbooks table
    const tbRes = await pool.query(
      `SELECT t.id, t.book_name, t.file_path, t.standard, t.subject, t.medium, t.term, t.volume,
              t.page_count, t.total_pages, t.extraction_status, t.status,
              EXISTS (SELECT 1 FROM textbook_content c WHERE c.textbook_id = t.id) AS has_indexed_content
       FROM textbooks t
       WHERE t.standard = $1
         AND (t.group_id IS NULL OR LOWER(t.group_id) = LOWER($2) OR ($2 = 'group2a' AND LOWER(t.group_id) = 'group2'))`,
      [standardId, groupId]
    );

    const candidates: TextbookOption[] = [];
    const seenSignatures = new Set<string>();

    // Process google_drive_materials
    for (const m of gdmRes.rows) {
      if (!normalizeSubjectMatch(m.subject, mappedSubjects)) continue;

      const tvMeta = classifyTermVolume(m.term, m.volume);
      const candTerm = tvMeta.term || m.term;

      // Term filtering
      if (term && term !== 'Not Applicable' && term !== 'All' && standardId < 10) {
        if (candTerm && !candTerm.toLowerCase().includes(term.toLowerCase())) {
          continue;
        }
      }

      const sig = `${m.file_name}-${m.standard}-${m.medium}-${candTerm}`.toLowerCase();
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        candidates.push({
          id: m.id,
          key: `drive:${m.id}`,
          sourceType: 'drive',
          textbookId: null,
          materialId: m.id,
          gdriveFileId: m.google_drive_file_id || null,
          bookName: m.file_name,
          subject: m.subject,
          standard: m.standard,
          medium: m.medium || 'Tamil',
          term: candTerm,
          volume: tvMeta.volume,
          termOptions: tvMeta.termOptions.length > 0 ? tvMeta.termOptions : ['Not Applicable'],
          volumeOptions: tvMeta.volumeOptions.length > 0 ? tvMeta.volumeOptions : ['Not Applicable'],
          status: 'completed',
          hasExtractedText: Boolean(m.extracted_text && m.extracted_text.trim().length >= 50),
          extractionStatus: m.extraction_status || (m.extracted_text ? 'COMPLETED' : 'PENDING'),
          totalPages: m.total_pages || m.page_count || 0,
        });
      }
    }

    // Process textbooks table
    for (const tb of tbRes.rows) {
      if (!normalizeSubjectMatch(tb.subject, mappedSubjects)) continue;

      const tvMeta = classifyTermVolume(tb.term, tb.volume);
      const candTerm = tvMeta.term || tb.term;

      // Term filtering
      if (term && term !== 'Not Applicable' && term !== 'All' && standardId < 10) {
        if (candTerm && !candTerm.toLowerCase().includes(term.toLowerCase())) {
          continue;
        }
      }

      const sig = `${tb.book_name}-${tb.standard}-${tb.medium}-${candTerm}`.toLowerCase();
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        const gdriveId = tb.file_path && tb.file_path.startsWith('gdrive://')
          ? tb.file_path.replace('gdrive://', '')
          : null;
        candidates.push({
          id: tb.id,
          key: `textbook:${tb.id}`,
          sourceType: 'textbook',
          textbookId: tb.id,
          materialId: null,
          gdriveFileId: gdriveId,
          bookName: tb.book_name,
          subject: tb.subject,
          standard: tb.standard,
          medium: tb.medium || 'Tamil',
          term: candTerm,
          volume: tvMeta.volume,
          termOptions: tvMeta.termOptions.length > 0 ? tvMeta.termOptions : ['Not Applicable'],
          volumeOptions: tvMeta.volumeOptions.length > 0 ? tvMeta.volumeOptions : ['Not Applicable'],
          status: tb.status || 'completed',
          hasExtractedText: Boolean(tb.has_indexed_content),
          extractionStatus: tb.extraction_status || (tb.has_indexed_content ? 'COMPLETED' : 'PENDING'),
          totalPages: tb.total_pages || tb.page_count || 0,
        });
      }
    }

    // Sort: extracted text first, then medium (Tamil first, English second)
    candidates.sort((a, b) => {
      if (a.hasExtractedText && !b.hasExtractedText) return -1;
      if (!a.hasExtractedText && b.hasExtractedText) return 1;
      if (a.medium === 'Tamil' && b.medium !== 'Tamil') return -1;
      if (a.medium !== 'Tamil' && b.medium === 'Tamil') return 1;
      return a.bookName.localeCompare(b.bookName);
    });

    return res.status(200).json({
      success: true,
      count: candidates.length,
      textbooks: candidates,
    });
  } catch (error: any) {
    console.error('[Study Material Routes] Error fetching textbooks:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch textbooks',
      textbooks: [],
    });
  }
});

/**
 * GET /api/study-materials/volumes?textbookId=&materialId=&standardId=&term=
 * Returns available volumes dynamically.
 */
router.get('/volumes', async (req: Request, res: Response) => {
  try {
    const textbookId = req.query.textbookId ? parseInt(String(req.query.textbookId), 10) : null;
    const materialId = req.query.materialId ? parseInt(String(req.query.materialId), 10) : null;
    const standardId = req.query.standardId ? parseInt(String(req.query.standardId), 10) : null;

    let termValue: string | null = null;
    let volumeValue: string | null = null;

    if (materialId) {
      const resMat = await pool.query(
        'SELECT term, volume, classification_meta FROM google_drive_materials WHERE id = $1',
        [materialId]
      );
      if (resMat.rows[0]) {
        termValue = resMat.rows[0].term || resMat.rows[0].classification_meta?.term || null;
        volumeValue = resMat.rows[0].volume || resMat.rows[0].classification_meta?.volume || null;
      }
    } else if (textbookId) {
      const resTb = await pool.query(
        'SELECT term, volume FROM textbooks WHERE id = $1',
        [textbookId]
      );
      if (resTb.rows[0]) {
        termValue = resTb.rows[0].term || null;
        volumeValue = resTb.rows[0].volume || null;
      }
    }

    const { volume, volumeOptions } = classifyTermVolume(termValue, volumeValue);
    let volumes = volumeOptions.length > 0 ? volumeOptions : ['Not Applicable'];

    if (standardId != null && standardId >= 11) {
      volumes = ['Volume 1', 'Volume 2', 'Not Applicable'];
    }

    return res.status(200).json({
      success: true,
      volumes,
      selected: volume || volumes[0] || 'Not Applicable',
    });
  } catch (error: any) {
    console.error('[Study Material Routes] Error fetching volumes:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch volumes',
      volumes: ['Not Applicable'],
      selected: 'Not Applicable',
    });
  }
});

/**
 * GET /api/study-materials/topics?lessonTitle=&subjectId=&standardId=&unitId=&term=
 * Returns canonical topic list for the selected lesson.
 * Primary source: SYLLABUS_TOPIC_REGISTRY in topicAlignmentService (covers all mapped lessons).
 * Fallback: study_notes DB DISTINCT topic column for the lesson.
 */
router.get('/topics', async (req: Request, res: Response) => {
  try {
    const lessonTitle = String(req.query.lessonTitle || '').trim();
    const subjectId   = String(req.query.subjectId  || '').toLowerCase().trim();
    const standardId  = parseInt(String(req.query.standardId || '0'), 10) || 0;
    const unitId      = parseInt(String(req.query.unitId     || '0'), 10) || 0;
    const term        = String(req.query.term || '').trim();

    if (!lessonTitle) {
      return res.status(400).json({ success: false, message: 'lessonTitle is required', topics: [] });
    }

    // 1. Try the built-in authoritative SYLLABUS_TOPIC_REGISTRY
    const registryTopics = getRegisteredTopicsForLesson(lessonTitle);

    if (registryTopics.length > 0) {
      return res.status(200).json({
        success: true,
        lessonTitle,
        source: 'registry',
        count: registryTopics.length,
        topics: registryTopics,
      });
    }

    // 2. Fallback: query study_notes DB for distinct topics
    let dbTopics: string[] = [];
    try {
      const params: any[] = [lessonTitle];
      let query = `
        SELECT DISTINCT topic
        FROM study_notes
        WHERE LOWER(TRIM(lesson_title)) = LOWER(TRIM($1))
          AND topic IS NOT NULL AND TRIM(topic) <> ''
      `;
      if (standardId > 0) { params.push(standardId); query += ` AND class_id = $${params.length}`; }
      if (unitId > 0)     { params.push(unitId);      query += ` AND unit_id  = $${params.length}`; }
      if (term)           { params.push(`%${term}%`); query += ` AND term ILIKE $${params.length}`; }
      query += ' ORDER BY topic ASC';

      const dbRes = await pool.query(query, params);
      dbTopics = dbRes.rows.map((r: { topic: string }) => r.topic).filter(Boolean);
    } catch {
      // DB fallback failed silently
    }

    if (dbTopics.length > 0) {
      return res.status(200).json({
        success: true,
        lessonTitle,
        source: 'study_notes',
        count: dbTopics.length,
        topics: dbTopics,
      });
    }

    // 3. Final fallback: canonical lessons mappedSubject as one generic topic
    if (subjectId && standardId && unitId) {
      const canonicals = getCanonicalLessons(subjectId, standardId, unitId, term);
      const canonical  = canonicals.find(
        (c) => c.title.toLowerCase() === lessonTitle.toLowerCase()
      );
      if (canonical?.mappedSubject) {
        return res.status(200).json({
          success: true,
          lessonTitle,
          source: 'canonical',
          count: 1,
          topics: [canonical.mappedSubject],
        });
      }
    }

    // No topics found – return empty with success so the UI shows "All Topics" option
    return res.status(200).json({
      success: true,
      lessonTitle,
      source: 'none',
      count: 0,
      topics: [],
    });
  } catch (error: any) {
    console.error('[Study Material Routes] Error fetching topics:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch topics',
      topics: [],
    });
  }
});

export default router;
