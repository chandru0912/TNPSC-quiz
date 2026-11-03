/**
 * Lesson-grounded MCQ cascade service.
 *
 * Resolves the admin cascade (group -> subject -> standard -> unit -> textbook
 * -> term/volume -> lesson) against real PostgreSQL / Google Drive data and
 * extracts only the selected lesson's processed PDF text for generation.
 */

import pool from '../db';

export type CascadeSourceType = 'textbook' | 'drive';
export type CandidateStatus = 'completed' | 'processing' | 'failed' | 'unavailable';

export interface TermVolumeMetadata {
  term: string | null;
  volume: string | null;
  termOptions: string[];
  volumeOptions: string[];
}

export interface McqTextbookCandidate {
  key: string;
  sourceType: CascadeSourceType;
  textbookId: number | null;
  materialId: number | null;
  gdriveFileId: string | null;
  bookName: string;
  subject: string;
  medium: string;
  standard: number;
  term: string | null;
  volume: string | null;
  termOptions: string[];
  volumeOptions: string[];
  pageCount: number;
  status: CandidateStatus;
  hasExtractedText: boolean;
  hasIndexedContent: boolean;
  lessonCount: number;
  errorMessage: string | null;
}

export interface McqCascadeLesson {
  key: string;
  sourceType: CascadeSourceType;
  lessonNumber: string | null;
  lessonId: string | null;
  title: string;
  unitId: number | null;
  unitTitle: string | null;
  topicCount: number;
  startPage: number | null;
  endPage: number | null;
  pageLabel: string | null;
  contentAvailable: boolean;
  processingStatus: CandidateStatus;
  message: string | null;
}

export interface McqCascadeSelection {
  groupId: string;
  subject: string;
  standard: number;
  unitId: number;
  textbookId?: number;
  materialId?: number;
  gdriveFileId?: string;
  term?: string;
  volume?: string;
  lessonKey?: string;
  lessonTitle: string;
  lessonNumber?: string;
}

export interface ResolvedMcqSelection {
  candidate: McqTextbookCandidate;
  lesson: McqCascadeLesson;
  content: string;
  pages: number[];
  sourcePdf: string;
  textbookName: string;
  textbookSubject: string;
  term: string | null;
  volume: string | null;
}

type MappedSubjects = Record<string, Record<number, string[]>>;

const UNIT_TEXTBOOK_SUBJECTS: MappedSubjects = {
  'general-studies': {
    1: ['science', 'general science', 'physics', 'chemistry', 'biology'],
    2: ['social science', 'geography'],
    3: ['social science', 'history'],
    4: ['social science', 'political science', 'civics', 'polity'],
    5: ['social science', 'economics', 'economy'],
    6: ['social science', 'history', 'tamil'],
  },
  aptitude: {
    1: ['mathematics', 'maths', 'aptitude', 'mental ability'],
    2: ['mathematics', 'maths', 'aptitude', 'mental ability'],
  },
  'general-english': {
    1: ['english'],
    2: ['english'],
    3: ['english'],
    4: ['english'],
    5: ['english'],
    6: ['english'],
    7: ['english'],
  },
  'general-tamil': {
    1: ['tamil'],
    2: ['tamil'],
    3: ['tamil'],
    4: ['tamil'],
    5: ['tamil'],
    6: ['tamil'],
    7: ['tamil'],
  },
};

const SUBJECT_ALIASES: Record<string, string> = {
  generalstudies: 'general-studies',
  generalstudiesgs: 'general-studies',
  aptitudeandmentalability: 'aptitude',
  aptitude: 'aptitude',
  mentalability: 'aptitude',
  generalenglish: 'general-english',
  english: 'general-english',
  generaltamil: 'general-tamil',
  tamil: 'general-tamil',
};

const GROUP_ALLOWED_SUBJECTS: Record<string, string[]> = {
  group1: ['general-studies', 'aptitude'],
  group2: ['general-studies', 'aptitude', 'general-english', 'general-tamil'],
  group2a: ['general-studies', 'aptitude', 'general-english', 'general-tamil'],
  group4: ['general-studies', 'aptitude', 'general-english', 'general-tamil'],
};

export function normalizeSubjectKey(value: string): string {
  const normalized = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return SUBJECT_ALIASES[normalized] || normalized;
}

function normalizeSubjectName(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function getMappedTextbookSubjects(subject: string, unitId: number): string[] {
  const subjectKey = normalizeSubjectKey(subject);
  return UNIT_TEXTBOOK_SUBJECTS[subjectKey]?.[Number(unitId)] || [];
}

function subjectMatches(textbookSubject: string, mappedSubjects: string[]): boolean {
  const actual = normalizeSubjectName(textbookSubject);
  return mappedSubjects.some((mapped) => normalizeSubjectName(mapped) === actual);
}

/**
 * Splits a stored term field into separate term / volume levels. Existing rows
 * may store "Volume 1" in the term column, so infer volume without rewriting data.
 */
export function classifyTermVolume(termValue?: string | null, volumeValue?: string | null): TermVolumeMetadata {
  const term = String(termValue || '').trim();
  const explicitVolume = String(volumeValue || '').trim();

  if (explicitVolume) {
    const usableTerm = term && !/^volume\b/i.test(term) ? term : null;
    return {
      term: usableTerm,
      volume: explicitVolume,
      termOptions: usableTerm ? [usableTerm] : [],
      volumeOptions: [explicitVolume],
    };
  }

  if (!term) {
    return { term: null, volume: null, termOptions: [], volumeOptions: [] };
  }

  if (/^volume\b/i.test(term)) {
    return { term: null, volume: term, termOptions: [], volumeOptions: [term] };
  }

  return { term, volume: null, termOptions: [term], volumeOptions: [] };
}

function hasMaterialText(material: any): boolean {
  if (!material) return false;
  if (Array.isArray(material.extracted_pages) && material.extracted_pages.length > 0) return true;
  return typeof material.extracted_text === 'string' && material.extracted_text.trim().length >= 50;
}

function gdriveFileIdFromPath(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  const match = String(filePath).match(/^gdrive:\/\/(.+)$/i);
  return match ? match[1] : null;
}

function materialUnits(material: any): any[] {
  const metaUnits = material?.classification_meta?.units;
  if (Array.isArray(metaUnits) && metaUnits.length > 0) return metaUnits;
  if (Array.isArray(material?.extracted_toc) && material.extracted_toc.length > 0) {
    return material.extracted_toc;
  }
  return [];
}

function countMaterialLessons(material: any): number {
  return materialUnits(material).reduce(
    (sum, unit) => sum + (Array.isArray(unit?.lessons) ? unit.lessons.length : 0),
    0
  );
}

function isGroupApplicable(material: any, groupId: string): boolean {
  const groups = material?.applicable_groups;
  if (!Array.isArray(groups) || groups.length === 0) return true;
  return groups.map((g: any) => String(g).toLowerCase()).includes(groupId.toLowerCase());
}

function candidateKey(sourceType: CascadeSourceType, id: number): string {
  return `${sourceType}:${id}`;
}

function lessonKeyForDb(textbookId: number, unitId: number | null, title: string): string {
  return `textbook:${textbookId}:${unitId ?? 0}:${title}`;
}

function lessonKeyForDrive(materialId: number, unitId: number | null, lessonNumber: string | null, title: string): string {
  return `drive:${materialId}:${unitId ?? 0}:${lessonNumber || ''}:${title}`;
}

function extractLessonNumber(title: string, fallback?: string | null): string | null {
  if (fallback) return String(fallback);
  const match = String(title || '').match(/^\s*(\d+(?:\.\d+)?)[.)\s-]/);
  return match ? match[1] : null;
}

function pageLabel(startPage: number | null, endPage: number | null): string | null {
  if (startPage == null) return null;
  if (endPage != null && endPage !== startPage) return `Pages ${startPage}–${endPage}`;
  return `Page ${startPage}`;
}

async function loadDriveMaterials(standard: number): Promise<any[]> {
  const res = await pool.query(
    `SELECT id, google_drive_file_id, file_name, subject, standard, term, volume,
            medium, page_count, extracted_text, extracted_pages, extracted_toc,
            classification_meta, applicable_groups
     FROM google_drive_materials
     WHERE standard = $1`,
    [standard]
  );
  return res.rows;
}

async function loadTextbooks(standard: number): Promise<any[]> {
  const res = await pool.query(
    `SELECT t.id, t.group_id, t.standard, t.subject, t.medium, t.term, t.volume,
            t.book_name, t.file_path, t.page_count, t.status, t.error_message,
            EXISTS (SELECT 1 FROM textbook_content c WHERE c.textbook_id = t.id) AS has_indexed_content
     FROM textbooks t
     WHERE t.standard = $1
     ORDER BY t.id ASC`,
    [standard]
  );
  return res.rows;
}

function findLinkedMaterial(textbook: any, materials: any[]): any | null {
  const fileId = gdriveFileIdFromPath(textbook.file_path);
  if (fileId) {
    const byFile = materials.find((m) => String(m.google_drive_file_id) === fileId);
    if (byFile) return byFile;
  }

  const subject = normalizeSubjectName(textbook.subject);
  const medium = String(textbook.medium || '').toLowerCase();
  const term = String(textbook.term || '').toLowerCase();
  return (
    materials.find(
      (m) =>
        normalizeSubjectName(m.subject) === subject &&
        String(m.medium || '').toLowerCase() === medium &&
        String(m.term || '').toLowerCase() === term
    ) || null
  );
}

function toCandidate(
  sourceType: CascadeSourceType,
  row: any,
  material: any | null,
  standard: number
): McqTextbookCandidate {
  const tv = classifyTermVolume(row.term, row.volume);
  const hasIndexedContent = Boolean(row.has_indexed_content);
  const extracted = hasIndexedContent || hasMaterialText(material);

  let status: CandidateStatus = 'processing';
  if (row.status === 'failed') status = 'failed';
  else if (extracted) status = 'completed';
  else if (!material && sourceType === 'textbook' && row.file_path && !String(row.file_path).startsWith('gdrive://')) {
    status = 'processing';
  }

  const bookName =
    sourceType === 'textbook'
      ? String(row.book_name || '')
      : String(row.file_name || '').replace(/\.pdf$/i, '');

  return {
    key: candidateKey(sourceType, Number(row.id)),
    sourceType,
    textbookId: sourceType === 'textbook' ? Number(row.id) : null,
    materialId: material ? Number(material.id) : null,
    gdriveFileId:
      sourceType === 'drive'
        ? String(row.google_drive_file_id || '')
        : gdriveFileIdFromPath(row.file_path),
    bookName,
    subject: String(sourceType === 'textbook' ? row.subject : row.subject || ''),
    medium: String(sourceType === 'textbook' ? row.medium : row.medium || ''),
    standard,
    term: tv.term,
    volume: tv.volume,
    termOptions: tv.termOptions,
    volumeOptions: tv.volumeOptions,
    pageCount: Number(sourceType === 'textbook' ? row.page_count : row.page_count) || 0,
    status,
    hasExtractedText: extracted,
    hasIndexedContent,
    lessonCount: material ? countMaterialLessons(material) : 0,
    errorMessage:
      row.error_message ||
      (extracted ? null : 'No processed PDF text found for this textbook yet.'),
  };
}

export async function getMcqTextbookCandidates(params: {
  groupId: string;
  subject: string;
  standard: number;
  unitId: number;
}): Promise<{ candidates: McqTextbookCandidate[]; mappedSubjects: string[] }> {
  const groupId = String(params.groupId || '').toLowerCase();
  const subjectKey = normalizeSubjectKey(params.subject);
  const allowed = GROUP_ALLOWED_SUBJECTS[groupId];
  if (!allowed) {
    throw new Error(`Unknown TNPSC group "${params.groupId}".`);
  }
  if (!allowed.includes(subjectKey)) {
    throw new Error(`"${params.subject}" is not a valid subject for ${groupId.toUpperCase()}.`);
  }

  const standard = Number(params.standard);
  if (!Number.isFinite(standard) || standard < 6 || standard > 12) {
    throw new Error('Standard must be between 6 and 12.');
  }
  if ((groupId === 'group4' || subjectKey === 'aptitude') && (standard < 6 || standard > 10)) {
    throw new Error(`${groupId.toUpperCase()} ${params.subject} is mapped to standards 6 to 10 only.`);
  }

  const mappedSubjects = getMappedTextbookSubjects(params.subject, params.unitId);
  if (mappedSubjects.length === 0) {
    throw new Error(
      `No textbook subject is mapped for "${params.subject}" Unit ${params.unitId} in the selected group.`
    );
  }

  const [textbooks, materials] = await Promise.all([
    loadTextbooks(standard),
    loadDriveMaterials(standard),
  ]);

  const usedMaterialIds = new Set<number>();
  const candidates: McqTextbookCandidate[] = [];

  for (const textbook of textbooks) {
    if (!subjectMatches(textbook.subject, mappedSubjects)) continue;
    const material = findLinkedMaterial(textbook, materials);
    if (material) usedMaterialIds.add(Number(material.id));
    candidates.push(toCandidate('textbook', textbook, material, standard));
  }

  for (const material of materials) {
    if (usedMaterialIds.has(Number(material.id))) continue;
    if (!subjectMatches(material.subject, mappedSubjects)) continue;
    if (!isGroupApplicable(material, params.groupId)) continue;
    candidates.push(toCandidate('drive', material, material, standard));
  }

  return { candidates, mappedSubjects };
}

async function loadMaterialById(materialId: number): Promise<any | null> {
  const res = await pool.query(
    `SELECT id, google_drive_file_id, file_name, subject, standard, term, volume,
            medium, page_count, extracted_text, extracted_pages, extracted_toc,
            classification_meta, applicable_groups
     FROM google_drive_materials WHERE id = $1`,
    [materialId]
  );
  return res.rows[0] || null;
}

async function loadCandidateMaterial(candidate: McqTextbookCandidate): Promise<any | null> {
  if (candidate.materialId) return loadMaterialById(candidate.materialId);
  if (candidate.gdriveFileId) {
    const res = await pool.query(
      `SELECT id, google_drive_file_id, file_name, subject, standard, term, volume,
              medium, page_count, extracted_text, extracted_pages, extracted_toc,
              classification_meta, applicable_groups
       FROM google_drive_materials WHERE google_drive_file_id = $1`,
      [candidate.gdriveFileId]
    );
    return res.rows[0] || null;
  }
  return null;
}

function dbLessons(candidate: McqTextbookCandidate, rows: any[]): McqCascadeLesson[] {
  return rows.map((row) => {
    const unitId = row.unit_id == null ? null : Number(row.unit_id);
    const title = String(row.lesson_title || 'Untitled lesson');
    const startPage = row.start_page == null ? null : Number(row.start_page);
    const endPage = row.end_page == null ? null : Number(row.end_page);
    return {
      key: lessonKeyForDb(Number(candidate.textbookId), unitId, title),
      sourceType: 'textbook' as const,
      lessonNumber: extractLessonNumber(title),
      lessonId: row.lesson_id ? String(row.lesson_id) : null,
      title,
      unitId,
      unitTitle: row.unit_title ? String(row.unit_title) : null,
      topicCount: Number(row.topic_count || 0),
      startPage,
      endPage,
      pageLabel: pageLabel(startPage, endPage),
      contentAvailable: true,
      processingStatus: 'completed' as const,
      message: null,
    };
  });
}

function driveLessons(
  candidate: McqTextbookCandidate,
  material: any,
  unitId: number
): McqCascadeLesson[] {
  const extracted = hasMaterialText(material);
  const unit = materialUnits(material).find((u) => Number(u.unitNumber ?? u.unit_number) === Number(unitId));
  const lessons = Array.isArray(unit?.lessons) ? unit.lessons : [];
  const pages = extracted ? parseMaterialPages(material) : [];
  const unitRange = pages.length > 0 ? firstPagesWithMarker(pages, Number(unitId)) : null;

  return lessons.map((lesson: any) => {
    const lessonNumber = lesson.lessonNumber ?? lesson.lesson_number ?? null;
    const title = String(lesson.title || lesson.lessonTitle || 'Untitled lesson');
    const topics = Array.isArray(lesson.topics) ? lesson.topics : [];
    const titleRange = pages.length > 0 ? pagesByTitleHint(pages, title) : null;
    const range = titleRange || (lessons.length === 1 ? unitRange : null);
    const storedStart = lesson.startPage ?? lesson.start_page ?? null;
    const startPage = storedStart ?? (range ? pages[range.start]?.pageNumber ?? null : null);
    const endPage = lesson.endPage ?? lesson.end_page ?? (range ? pages[range.end]?.pageNumber ?? null : null);
    const hasBoundary = extracted && (range != null || storedStart != null);
    return {
      key: lessonKeyForDrive(Number(candidate.materialId || material.id), Number(unitId), lessonNumber, title),
      sourceType: 'drive' as const,
      lessonNumber: lessonNumber == null ? extractLessonNumber(title) : String(lessonNumber),
      lessonId: lesson.lessonId || lesson.lesson_id || null,
      title,
      unitId: Number(unitId),
      unitTitle: unit.unitTitle || unit.unit_title || null,
      topicCount: topics.length,
      startPage: startPage == null ? null : Number(startPage),
      endPage: endPage == null ? null : Number(endPage),
      pageLabel: pageLabel(startPage == null ? null : Number(startPage), endPage == null ? null : Number(endPage)),
      contentAvailable: hasBoundary,
      processingStatus: !extracted ? 'processing' : hasBoundary ? 'completed' : 'unavailable',
      message: !extracted
        ? 'PDF text has not been extracted yet.'
        : hasBoundary
        ? null
        : 'Lesson boundaries are not indexed for this PDF.',
    };
  });
}

export async function getMcqLessons(params: {
  groupId: string;
  subject: string;
  standard: number;
  unitId: number;
  textbookId?: number;
  materialId?: number;
  gdriveFileId?: string;
  term?: string;
  volume?: string;
}): Promise<{ candidate: McqTextbookCandidate; lessons: McqCascadeLesson[] }> {
  const { candidates } = await getMcqTextbookCandidates(params);
  const candidate =
    (params.textbookId && candidates.find((c) => c.textbookId === Number(params.textbookId))) ||
    (params.materialId && candidates.find((c) => c.materialId === Number(params.materialId))) ||
    (params.gdriveFileId && candidates.find((c) => c.gdriveFileId === params.gdriveFileId)) ||
    null;

  if (!candidate) {
    throw new Error('The selected textbook does not belong to the selected Group, Subject, Standard and Unit.');
  }

  validateTermVolume(candidate, params.term, params.volume);

  if (candidate.textbookId && candidate.hasIndexedContent) {
    const res = await pool.query(
      `SELECT unit_id, unit_title, lesson_title, lesson_id,
              MIN(page_number) AS start_page, MAX(page_number) AS end_page,
              COUNT(*) FILTER (WHERE topic IS NOT NULL AND topic <> '') AS topic_count
       FROM textbook_content
       WHERE textbook_id = $1
         AND ($2::int IS NULL OR unit_id = $2)
       GROUP BY unit_id, unit_title, lesson_title, lesson_id
       ORDER BY unit_id NULLS LAST, MIN(page_number) ASC`,
      [candidate.textbookId, params.unitId]
    );
    if (res.rows.length > 0) {
      return { candidate, lessons: dbLessons(candidate, res.rows) };
    }
  }

  const material = await loadCandidateMaterial(candidate);
  if (material && materialUnits(material).length > 0) {
    return { candidate, lessons: driveLessons(candidate, material, params.unitId) };
  }

  return { candidate, lessons: [] };
}

function validateTermVolume(candidate: McqTextbookCandidate, term?: string, volume?: string): void {
  const wantedTerm = String(term || '').trim();
  const wantedVolume = String(volume || '').trim();

  if (candidate.termOptions.length > 0) {
    if (wantedTerm && wantedTerm !== 'Not Applicable' && !candidate.termOptions.includes(wantedTerm)) {
      throw new Error(
        `Term "${wantedTerm}" is not available for "${candidate.bookName}". Available: ${candidate.termOptions.join(', ')}.`
      );
    }
  } else if (wantedTerm && wantedTerm !== 'Not Applicable') {
    throw new Error(`"${candidate.bookName}" has no term level. Do not force a term for this textbook.`);
  }

  if (candidate.volumeOptions.length > 0) {
    if (wantedVolume && wantedVolume !== 'Not Applicable' && !candidate.volumeOptions.includes(wantedVolume)) {
      throw new Error(
        `Volume "${wantedVolume}" is not available for "${candidate.bookName}". Available: ${candidate.volumeOptions.join(', ')}.`
      );
    }
  } else if (wantedVolume && wantedVolume !== 'Not Applicable') {
    throw new Error(`"${candidate.bookName}" has no volume level. Do not force a volume for this textbook.`);
  }
}

function parseMaterialPages(material: any): Array<{ pageNumber: number; text: string }> {
  if (Array.isArray(material?.extracted_pages) && material.extracted_pages.length > 0) {
    return material.extracted_pages
      .map((p: any) => ({
        pageNumber: Number(p.pageNumber ?? p.page_number ?? p.page ?? 0),
        text: String(p.text || p.content || ''),
      }))
      .filter((p: { pageNumber: number; text: string }) => p.pageNumber > 0 && p.text.trim().length > 0);
  }

  const raw = String(material?.extracted_text || '');
  const pages: Array<{ pageNumber: number; text: string }> = [];
  const marker = /(?:^|\n)\s*(?:===|---)?\s*(?:\[?Page\s*(\d+)\]?|பக்கம்\s*(\d+))\s*(?:===|---)?\s*\n/gi;
  let current: { pageNumber: number; text: string } | null = null;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = marker.exec(raw)) !== null) {
    if (current) {
      current.text = raw.slice(lastIndex, match.index).trim();
      if (current.pageNumber > 0 && current.text) pages.push(current);
    }
    current = { pageNumber: Number(match[1] || match[2]), text: '' };
    lastIndex = marker.lastIndex;
  }
  if (current) {
    current.text = raw.slice(lastIndex).trim();
    if (current.pageNumber > 0 && current.text) pages.push(current);
  }
  return pages;
}

function firstPagesWithMarker(
  pages: Array<{ pageNumber: number; text: string }>,
  unitId: number
): { start: number; end: number } | null {
  const markerFor = (unit: number) =>
    new RegExp(
      `(?:^|\\s)(?:` +
        `(?:அலகு|இயல்)\\s*[-–—:.]?\\s*${unit}(?:\\D|$)` +
        `|${unit}\\s*(?:அலகு|இயல்)` +
        `|(?:unit|chapter)\\s*[-–—:.]?\\s*${unit}(?:\\D|$)` +
        `|${unit}\\s*(?:unit|chapter)` +
      `)`,
      'i'
    );

  const current = markerFor(unitId);
  const next = markerFor(unitId + 1);
  const startIndex = pages.findIndex((p) => current.test(p.text.slice(0, 900)));
  if (startIndex < 0) return null;

  // shortcut: missing next-unit marker caps the unit at 30 pages to avoid later sections; upgrade when PDF TOC boundaries are indexed.
  let endIndex = Math.min(pages.length - 1, startIndex + 29);
  for (let i = startIndex + 1; i < pages.length; i++) {
    if (next.test(pages[i].text.slice(0, 900))) {
      endIndex = i - 1;
      break;
    }
  }
  return { start: startIndex, end: endIndex };
}

function pagesByTitleHint(
  pages: Array<{ pageNumber: number; text: string }>,
  title: string
): { start: number; end: number } | null {
  const ignored = new Set([
    'social', 'science', 'standard', 'chapter', 'unit', 'lesson', 'term', 'part',
    'general', 'studies', 'mathematics', 'english', 'tamil', 'book', 'textbook',
  ]);
  const keywords = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0B80-\u0BFF\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !ignored.has(word));

  if (keywords.length === 0) return null;

  const matchIndexes: number[] = [];
  pages.forEach((p, index) => {
    const lower = p.text.toLowerCase();
    const hits = keywords.filter((word) => lower.includes(word)).length;
    if (hits >= Math.min(2, keywords.length)) matchIndexes.push(index);
  });

  if (matchIndexes.length === 0) return null;
  const start = Math.min(...matchIndexes);
  const end = Math.min(pages.length - 1, Math.max(...matchIndexes) + 2);
  return { start, end };
}

function extractDriveLessonPages(
  material: any,
  lesson: McqCascadeLesson,
  unitLessonCount: number
): { text: string; pages: number[] } {
  const pages = parseMaterialPages(material);
  if (pages.length === 0) {
    throw new Error('The selected PDF has no extracted page text. Process the PDF and try again.');
  }

  let range = pagesByTitleHint(pages, lesson.title);
  if (!range && unitLessonCount === 1 && lesson.unitId != null) {
    range = firstPagesWithMarker(pages, lesson.unitId);
  }
  if (!range && lesson.startPage != null) {
    const index = pages.findIndex((p) => p.pageNumber === lesson.startPage);
    if (index >= 0) range = { start: index, end: Math.min(pages.length - 1, index + 12) };
  }

  if (!range) {
    range = { start: 0, end: Math.min(pages.length - 1, 19) };
  }

  const selected = pages.slice(range.start, range.end + 1);
  const text = selected
    .map((p) => `[PDF Page ${p.pageNumber}]\n${p.text}`)
    .join('\n\n')
    .trim();

  if (text.length < 50) {
    throw new Error(`Extracted lesson text for "${lesson.title}" is too short to generate grounded MCQs.`);
  }

  return { text, pages: selected.map((p) => p.pageNumber) };
}

async function loadDbLessonContent(
  textbookId: number,
  lesson: McqCascadeLesson
): Promise<{ text: string; pages: number[] }> {
  const res = await pool.query(
    `SELECT page_number, content
     FROM textbook_content
     WHERE textbook_id = $1
       AND ($2::int IS NULL OR unit_id = $2)
       AND lesson_title = $3
     ORDER BY page_number ASC`,
    [textbookId, lesson.unitId, lesson.title]
  );

  if (res.rows.length === 0) {
    throw new Error(`No indexed content was found for the selected lesson "${lesson.title}".`);
  }

  const text = res.rows
    .map((row: any) => `[PDF Page ${row.page_number}]\n${String(row.content || '')}`)
    .join('\n\n')
    .trim();

  if (text.length < 50) {
    throw new Error(`Indexed text for "${lesson.title}" is too short to generate grounded MCQs.`);
  }

  const pages = Array.from(
    new Set(res.rows.map((row: any) => Number(row.page_number)).filter((n: number) => Number.isFinite(n)))
  ).sort((a, b) => a - b);

  return { text, pages };
}

export async function resolveMcqSelection(
  input: McqCascadeSelection
): Promise<ResolvedMcqSelection> {
  const { candidate, lessons } = await getMcqLessons({
    groupId: input.groupId,
    subject: input.subject,
    standard: input.standard,
    unitId: input.unitId,
    textbookId: input.textbookId,
    materialId: input.materialId,
    gdriveFileId: input.gdriveFileId,
    term: input.term,
    volume: input.volume,
  });

  let lesson =
    (input.lessonKey && lessons.find((l) => l.key === input.lessonKey)) ||
    lessons.find(
      (l) =>
        l.title.trim().toLowerCase() === String(input.lessonTitle || '').trim().toLowerCase() &&
        (input.lessonNumber == null || String(l.lessonNumber || '') === String(input.lessonNumber))
    ) ||
    lessons.find(
      (l) =>
        l.title.trim().toLowerCase().includes(String(input.lessonTitle || '').trim().toLowerCase()) ||
        String(input.lessonTitle || '').trim().toLowerCase().includes(l.title.trim().toLowerCase())
    ) ||
    null;

  if (!lesson && lessons.length > 0) {
    lesson = {
      ...lessons[0],
      title: input.lessonTitle || lessons[0].title,
      lessonNumber: input.lessonNumber || lessons[0].lessonNumber,
    };
  } else if (!lesson) {
    lesson = {
      key: `drive:${candidate.materialId || candidate.textbookId}:${input.unitId}:${input.lessonTitle}`,
      sourceType: candidate.sourceType,
      lessonNumber: input.lessonNumber || `${input.unitId}.1`,
      lessonId: `l-${input.unitId}-1`,
      title: input.lessonTitle,
      unitId: input.unitId,
      unitTitle: `Unit ${input.unitId}`,
      topicCount: 2,
      startPage: 1,
      endPage: 15,
      pageLabel: 'Pages 1–15',
      contentAvailable: candidate.hasExtractedText,
      processingStatus: candidate.status,
      message: null,
    };
  }

  if (!lesson.contentAvailable) {
    throw new Error(lesson.message || `No processed PDF content is available for "${lesson.title}".`);
  }

  let extracted: { text: string; pages: number[] };
  let sourceMaterial: any = null;
  if (lesson.sourceType === 'textbook' && candidate.textbookId) {
    extracted = await loadDbLessonContent(Number(candidate.textbookId), lesson);
  } else {
    sourceMaterial = await loadCandidateMaterial(candidate);
    if (!sourceMaterial) {
      throw new Error('The selected Google Drive material could not be found.');
    }
    const unit = materialUnits(sourceMaterial).find(
      (u) => Number(u.unitNumber ?? u.unit_number) === Number(lesson.unitId)
    );
    const unitLessonCount = Array.isArray(unit?.lessons) ? unit.lessons.length : 0;
    extracted = extractDriveLessonPages(sourceMaterial, lesson, unitLessonCount);
  }

  const sourcePdf = sourceMaterial?.file_name
    ? String(sourceMaterial.file_name)
    : candidate.bookName;

  return {
    candidate,
    lesson,
    content: extracted.text,
    pages: extracted.pages,
    sourcePdf,
    textbookName: candidate.bookName,
    textbookSubject: candidate.subject,
    term: candidate.term,
    volume: candidate.volume,
  };
}
