import { Router, Request, Response } from 'express';
import pool from '../db';
import { classifyTermVolume, getMappedTextbookSubjects, normalizeSubjectKey } from '../services/mcqCascadeService';

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
    return norm.includes(mapped) || mapped.includes(norm);
  });
}

function parseLessonNumberSort(numStr: string): number {
  const parts = String(numStr || '0').split('.').map((p) => parseInt(p, 10) || 0);
  return (parts[0] || 0) * 1000 + (parts[1] || 0);
}

/**
 * GET /api/study-materials/lessons?groupId=&subjectId=&standardId=&unitId=
 * Fetches lessons strictly connected to Study Materials and Google Drive textbooks.
 * Preserves lesson ordering (e.g. 1.1, 1.2...) and displays lesson number & title.
 */
router.get('/lessons', async (req: Request, res: Response) => {
  try {
    const groupId = String(req.query.groupId || 'group4').toLowerCase().trim();
    const subjectId = String(req.query.subjectId || 'general-studies').toLowerCase().trim();
    const standardId = parseInt(String(req.query.standardId || '6'), 10) || 6;
    const unitId = parseInt(String(req.query.unitId || '1'), 10) || 1;

    const mappedSubjects = getMappedTextbookSubjects(subjectId, unitId);

    // 1. Query study_notes database records
    const notesRes = await pool.query(
      `SELECT DISTINCT
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
       ORDER BY lesson_title ASC`,
      [groupId, standardId, unitId]
    );

    // 2. Query google_drive_materials database records
    const gdmRes = await pool.query(
      `SELECT id, file_name, tnpsc_group, standard, subject, term, volume, medium,
              unit, lesson, lesson_id, classification_meta, extracted_toc, extracted_text
       FROM google_drive_materials
       WHERE standard = $1
         AND (applicable_groups IS NULL OR applicable_groups::text ILIKE '%' || $2 || '%' OR LOWER(tnpsc_group) = LOWER($2))`,
      [standardId, groupId]
    );

    // Filter materials by subject alignment
    const relevantMaterials = gdmRes.rows.filter((r) =>
      normalizeSubjectMatch(r.subject, mappedSubjects)
    );

    const lessonMap = new Map<string, LessonOption>();

    // Add lessons found in google_drive_materials (TOC and column)
    for (const mat of relevantMaterials) {
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
          });
        }
      }
    }

    // Add / correlate lessons from study_notes
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
 * GET /api/study-materials/textbooks?groupId=&subjectId=&standardId=&unitId=&lessonId=
 * Fetches textbooks that contain or are associated with the selected lesson.
 */
router.get('/textbooks', async (req: Request, res: Response) => {
  try {
    const groupId = String(req.query.groupId || 'group4').toLowerCase().trim();
    const subjectId = String(req.query.subjectId || 'general-studies').toLowerCase().trim();
    const standardId = parseInt(String(req.query.standardId || '6'), 10) || 6;
    const unitId = parseInt(String(req.query.unitId || '1'), 10) || 1;
    const lessonId = req.query.lessonId ? String(req.query.lessonId).trim() : '';
    const lessonTitle = req.query.lessonTitle ? String(req.query.lessonTitle).trim() : '';

    const mappedSubjects = getMappedTextbookSubjects(subjectId, unitId);

    // 1. Search google_drive_materials
    const gdmRes = await pool.query(
      `SELECT id, file_name, google_drive_file_id, standard, subject, medium,
              term, volume, page_count, extracted_text, classification_meta, extracted_toc
       FROM google_drive_materials
       WHERE standard = $1
         AND (applicable_groups IS NULL OR applicable_groups::text ILIKE '%' || $2 || '%' OR LOWER(tnpsc_group) = LOWER($2))`,
      [standardId, groupId]
    );

    // 2. Search textbooks table
    const tbRes = await pool.query(
      `SELECT id, book_name, file_path, standard, subject, medium, term, volume, page_count, status
       FROM textbooks
       WHERE standard = $1
         AND (group_id IS NULL OR LOWER(group_id) = LOWER($2) OR ($2 = 'group2a' AND LOWER(group_id) = 'group2'))`,
      [standardId, groupId]
    );

    const candidates: TextbookOption[] = [];
    const seenKeys = new Set<string>();

    for (const m of gdmRes.rows) {
      if (!normalizeSubjectMatch(m.subject, mappedSubjects)) continue;

      let isMatch = false;
      const tocList = m.classification_meta?.units || m.extracted_toc || [];

      if (lessonId || lessonTitle) {
        if (Array.isArray(tocList)) {
          for (const u of tocList) {
            const uNum = Number(u.unitNumber ?? u.unit_number);
            if (uNum === unitId && Array.isArray(u.lessons)) {
              if (
                u.lessons.some(
                  (l: any) =>
                    (lessonId && l.lessonId === lessonId) ||
                    (lessonTitle && String(l.title || '').toLowerCase().includes(lessonTitle.toLowerCase()))
                )
              ) {
                isMatch = true;
                break;
              }
            }
          }
        }
        if (!isMatch && (m.lesson_id === lessonId || (lessonTitle && String(m.lesson || '').toLowerCase().includes(lessonTitle.toLowerCase())))) {
          isMatch = true;
        }
      } else {
        isMatch = true;
      }

      // If no strict lesson match found, but this textbook directly covers this standard & unit subject, include it as candidate
      if (!isMatch && mappedSubjects.length > 0) {
        isMatch = true;
      }

      if (isMatch) {
        const key = `drive:${m.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const tvMeta = classifyTermVolume(m.term, m.volume);
          candidates.push({
            id: m.id,
            key,
            sourceType: 'drive',
            textbookId: null,
            materialId: m.id,
            gdriveFileId: m.google_drive_file_id || null,
            bookName: m.file_name,
            subject: m.subject,
            standard: m.standard,
            medium: m.medium || 'Tamil',
            term: tvMeta.term,
            volume: tvMeta.volume,
            termOptions: tvMeta.termOptions.length > 0 ? tvMeta.termOptions : ['Not Applicable'],
            volumeOptions: tvMeta.volumeOptions.length > 0 ? tvMeta.volumeOptions : ['Not Applicable'],
            status: 'completed',
            hasExtractedText: Boolean(m.extracted_text && m.extracted_text.trim().length >= 50),
          });
        }
      }
    }

    for (const tb of tbRes.rows) {
      if (!normalizeSubjectMatch(tb.subject, mappedSubjects)) continue;

      const key = `textbook:${tb.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const tvMeta = classifyTermVolume(tb.term, tb.volume);
        const gdriveId = tb.file_path && tb.file_path.startsWith('gdrive://') ? tb.file_path.replace('gdrive://', '') : null;
        candidates.push({
          id: tb.id,
          key,
          sourceType: 'textbook',
          textbookId: tb.id,
          materialId: null,
          gdriveFileId: gdriveId,
          bookName: tb.book_name,
          subject: tb.subject,
          standard: tb.standard,
          medium: tb.medium || 'Tamil',
          term: tvMeta.term,
          volume: tvMeta.volume,
          termOptions: tvMeta.termOptions.length > 0 ? tvMeta.termOptions : ['Not Applicable'],
          volumeOptions: tvMeta.volumeOptions.length > 0 ? tvMeta.volumeOptions : ['Not Applicable'],
          status: tb.status || 'completed',
          hasExtractedText: true,
        });
      }
    }

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
 * GET /api/study-materials/terms?textbookId=&materialId=
 * Returns available terms dynamically from the selected textbook metadata.
 */
router.get('/terms', async (req: Request, res: Response) => {
  try {
    const textbookId = req.query.textbookId ? parseInt(String(req.query.textbookId), 10) : null;
    const materialId = req.query.materialId ? parseInt(String(req.query.materialId), 10) : null;

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
    const terms = term ? [term] : ['Not Applicable'];

    return res.status(200).json({
      success: true,
      terms,
      selected: terms[0],
    });
  } catch (error: any) {
    console.error('[Study Material Routes] Error fetching terms:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch terms',
      terms: ['Not Applicable'],
      selected: 'Not Applicable',
    });
  }
});

/**
 * GET /api/study-materials/volumes?textbookId=&materialId=&term=
 * Returns available volumes dynamically from the selected textbook metadata.
 */
router.get('/volumes', async (req: Request, res: Response) => {
  try {
    const textbookId = req.query.textbookId ? parseInt(String(req.query.textbookId), 10) : null;
    const materialId = req.query.materialId ? parseInt(String(req.query.materialId), 10) : null;

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

    const { volume } = classifyTermVolume(termValue, volumeValue);
    const volumes = volume ? [volume] : ['Not Applicable'];

    return res.status(200).json({
      success: true,
      volumes,
      selected: volumes[0],
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

export default router;

