/**
 * textbookIndexingService.ts
 *
 * System-wide Textbook Page Indexing, Lesson-to-Page Mapping,
 * Verification, and Admin Control Center service (Standards 6–12, Tamil & English).
 *
 * Guarantees:
 * - Never deletes valid extracted content or overwrites valid text with empty strings.
 * - Strictly isolates standards, subjects, and mediums (no cross-bleed).
 * - Batched multi-row SQL updates (fast over Neon cloud latency).
 * - Fully idempotent and resumable across all 120+ textbooks.
 */

import crypto from 'crypto';
import pool from '../db';
import { extractPageSyllabusMeta, isFrontOrBackMatterPage, normalizeTamilPdfText } from './pdfProcessor';

export interface TextbookIndexingResult {
  textbookId: number;
  bookName: string;
  standard: number;
  subject: string;
  medium: string;
  term: string | null;
  totalPages: number;
  extractedPages: number;
  indexedPages: number;
  matterPages: number;
  blankPages: number;
  failedPages: number;
  distinctUnits: number;
  distinctLessons: number;
  mappedSyllabusLessons: number;
  indexingStatus: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'PENDING' | 'FAILED';
  durationMs: number;
}

export interface IndexingOverviewMetrics {
  totalTextbooks: number;
  totalPdfs: number;
  totalSyllabusLessons: number;
  mappedSyllabusLessons: number;
  totalPages: number;
  extractedPages: number;
  indexedPages: number;
  matterPages: number;
  blankPages: number;
  pendingPages: number;
  failedPages: number;
  processingPages: number;
  nativePages: number;
  ocrPages: number;
  completedTextbooks: number;
  partialTextbooks: number;
  failedTextbooks: number;
  pendingTextbooks: number;
  incompletePublishedTextbooks: number;
  lastProcessingTime: string | null;
  lastIndexedTime: string | null;
  byStandard: Array<{
    standard: number;
    textbooks: number;
    totalPages: number;
    extractedPages: number;
    indexedPages: number;
    failedPages: number;
    completedTextbooks: number;
    partialTextbooks: number;
    distinctLessons: number;
    mappedSyllabusLessons: number;
  }>;
  recentJobs: Array<{
    jobId: string;
    jobType: string;
    status: string;
    totalItems: number;
    processedItems: number;
    succeededItems: number;
    failedItems: number;
    cursorTextbookId: number;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
  }>;
}

export interface IndexingVerificationReport {
  passed: boolean;
  checkedAt: string;
  totals: {
    totalTextbooks: number;
    totalPages: number;
    completedPages: number;
    indexedBodyPages: number;
    matterPages: number;
    blankPages: number;
    failedPages: number;
    pendingPages: number;
    duplicatePageRows: number;
    nullLessonIdOnIndexedPages: number;
    hardcodedClass6UnitBleed: number;
    textbooksWithZeroIndexedPages: number;
    textbooksWithPageCountMismatch: number;
    mappedSyllabusLessons: number;
    totalSyllabusLessons: number;
  };
  issues: string[];
}

let indexingSchemaEnsured = false;
export async function ensureIndexingSchema(): Promise<void> {
  if (indexingSchemaEnsured) return;
  await pool.query(`
    ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS lesson_id TEXT DEFAULT NULL;
    ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
    ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS medium VARCHAR(30) DEFAULT NULL;
    ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS chapter_title TEXT DEFAULT NULL;
    ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS indexing_status VARCHAR(30) DEFAULT 'pending';
    ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS indexed_pages INT DEFAULT 0;
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS indexing_status VARCHAR(30) DEFAULT 'PENDING';
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS indexed_lessons_count INT DEFAULT 0;
    ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS last_indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    CREATE TABLE IF NOT EXISTS textbook_indexing_jobs (
      job_id VARCHAR(64) PRIMARY KEY,
      job_type VARCHAR(40) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      total_items INT DEFAULT 0,
      processed_items INT DEFAULT 0,
      succeeded_items INT DEFAULT 0,
      failed_items INT DEFAULT 0,
      cursor_textbook_id INT DEFAULT 0,
      filters JSONB DEFAULT '{}'::jsonb,
      summary JSONB DEFAULT '{}'::jsonb,
      error_logs JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
    );
  `);
  indexingSchemaEnsured = true;
}

const STOP_WORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'into', 'under', 'that', 'this', 'are', 'was',
  'lesson', 'unit', 'chapter', 'part', 'standard', 'term', 'tnpsc', 'study', 'book',
  'class', 'std', 'new', 'syllabus', 'general', 'volume', 'medium', 'english', 'tamil',
  'மற்றும்', 'ஒரு', 'ஆகிய', 'போன்ற', 'பற்றி', 'பகுதி', 'வகுப்பு', 'பாடம்', 'இயல்', 'அலகு',
]);

// Bilingual Tamil <-> English keyword bridge for matching English syllabus lessons to Tamil textbooks (and vice versa)
const BILINGUAL_SYNONYMS: Array<[RegExp, string[]]> = [
  [/measurement|si unit|அளவீடு/i, ['measurement', 'அளவீடு', 'அளவீடுகள்', 'பன்னாட்டு', 'நீளம்', 'நிறை', 'காலம்']],
  [/force|motion|விசை|இயக்கம்/i, ['force', 'motion', 'விசை', 'இயக்கம்', 'வேகம்', 'திசைவேகம்']],
  [/matter|பருப்பொருள்/i, ['matter', 'பருப்பொருள்', 'பருப்பொருட்கள்', 'திண்மம்', 'திரவம்', 'வாயு']],
  [/heat|temperature|வெப்பம்|வெப்பநிலை/i, ['heat', 'temperature', 'வெப்பம்', 'வெப்பநிலை', 'வெப்பமானி']],
  [/light|optics|ஒளி/i, ['light', 'optics', 'ஒளி', 'ஒளியியல்', 'ஆடி', 'லென்ஸ்']],
  [/sound|ஒலி/i, ['sound', 'ஒலி', 'அதிர்வு', 'அலை']],
  [/electric|electricity|மின்னியல்|மின்சாரம்/i, ['electric', 'electricity', 'மின்னியல்', 'மின்சாரம்', 'மின்னோட்டம்']],
  [/magnet|காந்தம்|காந்தவியல்/i, ['magnet', 'magnetism', 'காந்தம்', 'காந்தவியல்']],
  [/cell|உயிரணு|செல்/i, ['cell', 'செல்', 'உயிரணு', 'உட்கரு']],
  [/plant|தாவர/i, ['plant', 'botany', 'தாவரம்', 'தாவரவியல்', 'ஒளிச்சேர்க்கை']],
  [/animal|விலங்கு/i, ['animal', 'zoology', 'விலங்கு', 'விலங்கியல்']],
  [/acid|base|salt|அமிலம்|காரம்|உப்பு/i, ['acid', 'base', 'salt', 'அமிலம்', 'காரம்', 'உப்பு']],
  [/atomic|atom|அணு/i, ['atom', 'atomic', 'அணு', 'அணுக்கரு', 'எலக்ட்ரான்']],
  [/indus|சிந்து/i, ['indus', 'harappa', 'சிந்து', 'ஹரப்பா', 'மொகஞ்சதாரோ']],
  [/vedic|வேத/i, ['vedic', 'வேத', 'வேதகாலம்']],
  [/gupta|குப்த/i, ['gupta', 'குப்தர்', 'குப்தர்கள்']],
  [/delhi sultan|டெல்லி சுல்தான்/i, ['delhi', 'sultanate', 'டெல்லி', 'சுல்தான்']],
  [/mughal|முகலாய/i, ['mughal', 'முகலாயர்', 'முகலாயர்கள்']],
  [/maratha|மராத்திய/i, ['maratha', 'மராத்தியர்', 'சிவாஜி']],
  [/vijayanagar|bahmani|விஜயநகர|பாமினி/i, ['vijayanagar', 'bahmani', 'விஜயநகர', 'பாமினி']],
  [/chola|pandya|chera|sangam|சோழ|பாண்டிய|சேர|சங்க/i, ['chola', 'pandya', 'chera', 'sangam', 'சோழர்', 'பாண்டியர்', 'சேரர்', 'சங்க']],
  [/constitution|அரசியலமைப்பு/i, ['constitution', 'அரசியலமைப்பு', 'அடிப்படை உரிமை', 'நாடாளுமன்றம்']],
  [/parliament|நாடாளுமன்றம்/i, ['parliament', 'நாடாளுமன்றம்', 'மக்களவை', 'மாநிலங்களவை']],
  [/judiciary|நீதித்துறை/i, ['judiciary', 'supreme court', 'நீதித்துறை', 'உச்சநீதிமன்றம்']],
  [/panchayat|local self|உள்ளாட்சி|பஞ்சாயத்து/i, ['panchayat', 'local', 'உள்ளாட்சி', 'பஞ்சாயத்து']],
  [/atmosphere|வளிமண்டலம்/i, ['atmosphere', 'வளிமண்டலம்', 'வானிலை', 'காலநிலை']],
  [/lithosphere|பாறைக்கோளம்/i, ['lithosphere', 'பாறைக்கோளம்', 'புவியோட்டு']],
  [/hydrosphere|நீர்க்கோளம்/i, ['hydrosphere', 'நீர்க்கோளம்', 'கடல்']],
  [/climate|monsoon|காலநிலை|பருவமழை/i, ['climate', 'monsoon', 'காலநிலை', 'பருவமழை']],
  [/disaster|பேரிடர்/i, ['disaster', 'hazard', 'பேரிடர்', 'இடர்']],
  [/agriculture|வேளாண்மை/i, ['agriculture', 'வேளாண்மை', 'பயிர்']],
  [/tax|gdp|national income|வரி|தேசிய வருமானம்/i, ['tax', 'gdp', 'national income', 'வரி', 'தேசிய வருமானம்']],
  [/banking|rbi|money|வங்கி|பணம்/i, ['banking', 'rbi', 'money', 'வங்கி', 'பணம்', 'ரிசர்வ்']],
  [/national movement|freedom|gandhi|விடுதலை|காந்தி/i, ['national movement', 'freedom', 'gandhi', 'விடுதலை', 'காந்தி', 'சுதந்திர']],
  [/thirukkural|திருக்குறள்/i, ['thirukkural', 'திருக்குறள்', 'திருவள்ளுவர்']],
];

export function extractBilingualKeywords(text: string): string[] {
  const normalized = normalizeTamilPdfText(text || '').toLowerCase();
  const baseWords = normalized
    .replace(/[^a-z0-9\u0B80-\u0BFF\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  const out = new Set<string>(baseWords);
  for (const [pattern, syns] of BILINGUAL_SYNONYMS) {
    if (pattern.test(normalized)) {
      for (const s of syns) out.add(s.toLowerCase());
    }
  }
  return Array.from(out).slice(0, 28);
}

interface TocEntry {
  unitNumber: number;
  title: string;
  printedPage: number | null;
}

/**
 * Parses Table of Contents entries from the first ~10 pages of a textbook if present.
 */
function parseTocFromPages(pages: Array<{ page_number: number; content: string }>): TocEntry[] {
  const entries: TocEntry[] = [];
  const seen = new Set<string>();

  const frontPages = pages.filter((p) => p.page_number <= 12);
  for (const p of frontPages) {
    const text = normalizeTamilPdfText(p.content || '');
    if (!/(?:contents|பொருளடக்கம்|index|unit\s*1|அலகு\s*1|இயல்\s*1)/i.test(text)) continue;

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      // Match patterns like "1. Measurement ... 1" or "Unit 1 Evolution of Humans 102" or "1 அளவீடுகள் 1"
      const m = line.match(/^(?:(?:unit|chapter|lesson|அலகு|இயல்|பாடம்)\s*[-:.]?\s*)?(\d{1,2})[.)\s]+([^\d\n]{3,90}?)(?:\s+\.{2,}\s*|\s+)(\d{1,3})\s*$/i);
      if (m) {
        const unitNumber = parseInt(m[1], 10);
        const title = m[2].replace(/[.\-–—:|]+$/g, '').trim();
        const printedPage = parseInt(m[3], 10);
        if (unitNumber >= 1 && unitNumber <= 25 && title.length >= 3 && printedPage >= 1 && printedPage <= 500) {
          const key = `${unitNumber}:${title.toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            entries.push({ unitNumber, title, printedPage });
          }
        }
      }
    }
  }
  return entries;
}

function makeSlug(text: string): string {
  const ascii = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0B80-\u0BFF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return ascii || 'lesson';
}

function isSubjectCompatible(syllabusSubjectId: string, syllabusUnitNum: number, textbookSubject: string, lessonTitle: string): boolean {
  const tbSub = String(textbookSubject || '').toLowerCase().trim();
  const sylSub = String(syllabusSubjectId || '').toLowerCase().trim();

  if (sylSub.includes('tamil')) return tbSub.includes('tamil');
  if (sylSub.includes('english')) return tbSub.includes('english');
  if (sylSub.includes('aptitude') || sylSub.includes('mental')) {
    return tbSub.includes('math') || tbSub.includes('aptitude');
  }

  // General Studies spans Science, Social Science, Physics, Chemistry, Botany, Zoology, History, Geography, Civics, Economics, Political Science, Ethics
  if (sylSub.includes('general-studies') || sylSub.includes('general_studies')) {
    const titleLow = String(lessonTitle || '').toLowerCase();
    if (tbSub.includes('tamil') || tbSub.includes('english') || tbSub.includes('math')) return false;
    if (syllabusUnitNum === 1) {
      return /science|physics|chemistry|biology|botany|zoology/i.test(tbSub) && !/social|political/i.test(tbSub);
    }
    if (syllabusUnitNum === 2 || syllabusUnitNum === 3) {
      return /social|geography|science|economics/i.test(tbSub);
    }
    if (syllabusUnitNum === 4 || syllabusUnitNum === 7 || syllabusUnitNum === 8) {
      return /social|history|ethics|indian culture/i.test(tbSub) || (/tamil/i.test(tbSub) && /sangam|thirukkural|சங்க|திருக்குறள்/i.test(titleLow));
    }
    if (syllabusUnitNum === 5 || syllabusUnitNum === 9) {
      return /social|civics|political|polity|commerce/i.test(tbSub);
    }
    if (syllabusUnitNum === 6) {
      return /social|economics|economy|commerce/i.test(tbSub);
    }
    return true;
  }

  return tbSub.includes(sylSub) || sylSub.includes(tbSub);
}

function termCompatible(syllabusTerm: string | null, textbookTerm: string | null): boolean {
  const s = String(syllabusTerm || '').toLowerCase().trim();
  const t = String(textbookTerm || '').toLowerCase().trim();
  if (!s || !t || s === 'full year' || t === 'full year' || s === 'all') return true;
  if (s === t) return true;
  const sNum = s.match(/(\d)/)?.[1];
  const tNum = t.match(/(\d)/)?.[1];
  if (sNum && tNum) return sNum === tNum;
  return true;
}

/**
 * Indexes all extracted pages of a single textbook in PostgreSQL (zero Drive re-downloads),
 * repairing unit_id, unit_title, chapter_title, lesson_id, lesson_title, medium, indexing_status,
 * and mapping compatible syllabus_lessons rows to exact page ranges.
 */
export async function indexTextbookPages(textbookId: number): Promise<TextbookIndexingResult> {
  await ensureIndexingSchema();
  const started = Date.now();

  const tbRes = await pool.query(
    `SELECT id, book_name, standard, subject, medium, term, volume, page_count, status, google_drive_file_id
     FROM textbooks
     WHERE id = $1`,
    [textbookId]
  );
  if (tbRes.rows.length === 0) {
    throw new Error(`Textbook #${textbookId} not found.`);
  }
  const tb = tbRes.rows[0];
  const standard = Number(tb.standard) || 6;
  const subject = String(tb.subject || 'General Studies');
  const medium = String(tb.medium || 'English');
  const term = tb.term ? String(tb.term) : null;

  const pagesRes = await pool.query(
    `SELECT id, page_number, content, text_length, extraction_status, is_ocr
     FROM textbook_content
     WHERE textbook_id = $1
     ORDER BY page_number ASC`,
    [textbookId]
  );
  const pages = pagesRes.rows;
  const totalPages = Math.max(Number(tb.page_count || 0), pages.length);

  if (pages.length === 0) {
    await pool.query(
      `UPDATE textbooks SET
         indexed_pages = 0,
         indexing_status = 'PENDING',
         indexed_lessons_count = 0,
         last_indexed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [textbookId]
    );
    return {
      textbookId,
      bookName: tb.book_name,
      standard,
      subject,
      medium,
      term,
      totalPages,
      extractedPages: 0,
      indexedPages: 0,
      matterPages: 0,
      blankPages: 0,
      failedPages: 0,
      distinctUnits: 0,
      distinctLessons: 0,
      mappedSyllabusLessons: 0,
      indexingStatus: 'PENDING',
      durationMs: Date.now() - started,
    };
  }

  const tocEntries = parseTocFromPages(pages);

  // Estimate offset between printed page numbers and PDF page numbers
  let tocPageOffset = 0;
  if (tocEntries.length > 0) {
    const firstEntry = tocEntries[0];
    const firstWords = extractBilingualKeywords(firstEntry.title).slice(0, 3);
    if (firstWords.length > 0 && firstEntry.printedPage != null) {
      const hit = pages.find(
        (p) =>
          p.page_number > 4 &&
          p.page_number <= 30 &&
          firstWords.some((w) => normalizeTamilPdfText(p.content || '').toLowerCase().includes(w))
      );
      if (hit) {
        tocPageOffset = hit.page_number - firstEntry.printedPage;
      }
    }
  }

  // Build ordered page indexing updates
  let activeUnitId = 1;
  let activeUnitTitle = `Unit 1`;
  let activeChapterTitle: string | null = null;
  let activeLessonTitle = `${subject} Chapter 1`;
  let activeTopic: string | null = null;

  let extractedPages = 0;
  let indexedPages = 0;
  let matterPages = 0;
  let blankPages = 0;
  let failedPages = 0;

  const unitSet = new Set<number>();
  const lessonSet = new Set<string>();

  interface PagePlan {
    id: number;
    pageNumber: number;
    unitId: number;
    unitTitle: string;
    chapterTitle: string | null;
    lessonId: string;
    lessonTitle: string;
    topic: string;
    medium: string;
    indexingStatus: string;
    lowerContent: string;
  }

  const pagePlans: PagePlan[] = [];

  for (const row of pages) {
    const pageNum = Number(row.page_number);
    const rawContent = String(row.content || '');
    const normalizedContent = normalizeTamilPdfText(rawContent);
    const lowerContent = normalizedContent.toLowerCase();
    const extStatus = String(row.extraction_status || 'completed').toLowerCase();

    if (extStatus === 'failed') {
      failedPages++;
      pagePlans.push({
        id: Number(row.id),
        pageNumber: pageNum,
        unitId: activeUnitId,
        unitTitle: activeUnitTitle,
        chapterTitle: activeChapterTitle,
        lessonId: `tb${textbookId}-u${activeUnitId}-${makeSlug(activeLessonTitle)}`,
        lessonTitle: activeLessonTitle,
        topic: activeTopic || activeLessonTitle,
        medium,
        indexingStatus: 'failed',
        lowerContent,
      });
      continue;
    }

    if (extStatus === 'skipped' || normalizedContent.replace(/[^a-zA-Z0-9\u0B80-\u0BFF]/g, '').length < 10) {
      blankPages++;
      extractedPages++;
      pagePlans.push({
        id: Number(row.id),
        pageNumber: pageNum,
        unitId: activeUnitId,
        unitTitle: activeUnitTitle,
        chapterTitle: activeChapterTitle,
        lessonId: `tb${textbookId}-u${activeUnitId}-blank`,
        lessonTitle: activeLessonTitle,
        topic: 'blank_page',
        medium,
        indexingStatus: 'blank',
        lowerContent,
      });
      continue;
    }

    extractedPages++;

    // Check TOC boundary hit first (if TOC parsed cleanly)
    const tocHit = tocEntries.find(
      (e) => e.printedPage != null && e.printedPage + tocPageOffset === pageNum
    );
    if (tocHit) {
      activeUnitId = tocHit.unitNumber;
      activeUnitTitle = `Unit ${tocHit.unitNumber} - ${tocHit.title}`;
      activeChapterTitle = tocHit.title;
      activeLessonTitle = tocHit.title;
    }

    const meta = extractPageSyllabusMeta(normalizedContent, subject, pageNum, totalPages, standard, medium);

    if (meta.topic === 'front_matter' || meta.topic === 'back_matter') {
      matterPages++;
      pagePlans.push({
        id: Number(row.id),
        pageNumber: pageNum,
        unitId: 0,
        unitTitle: meta.topic === 'front_matter' ? 'Front Matter' : 'Back Matter',
        chapterTitle: null,
        lessonId: `tb${textbookId}-${meta.topic}`,
        lessonTitle: meta.topic === 'front_matter' ? 'Front Matter' : 'Back Matter',
        topic: meta.topic,
        medium,
        indexingStatus: meta.topic,
        lowerContent,
      });
      continue;
    }

    if (meta.unitId) {
      if (meta.unitId !== activeUnitId && !tocHit) {
        activeLessonTitle = meta.lessonTitle || `${subject} Unit ${meta.unitId}`;
        activeChapterTitle = meta.chapterTitle || null;
      }
      activeUnitId = meta.unitId;
    }
    if (meta.unitTitle) activeUnitTitle = meta.unitTitle;
    if (meta.chapterTitle) activeChapterTitle = meta.chapterTitle;
    if (meta.lessonTitle) activeLessonTitle = meta.lessonTitle;
    if (meta.topic) activeTopic = meta.topic;

    const canonicalLessonId = `tb${textbookId}-u${activeUnitId}-${makeSlug(activeLessonTitle)}`;
    unitSet.add(activeUnitId);
    lessonSet.add(activeLessonTitle);
    indexedPages++;

    pagePlans.push({
      id: Number(row.id),
      pageNumber: pageNum,
      unitId: activeUnitId,
      unitTitle: activeUnitTitle,
      chapterTitle: activeChapterTitle || activeLessonTitle,
      lessonId: canonicalLessonId,
      lessonTitle: activeLessonTitle,
      topic: activeTopic || activeLessonTitle,
      medium,
      indexingStatus: 'indexed',
      lowerContent,
    });
  }

  // Match syllabus_lessons for this standard + compatible subject/term to exact pages in this textbook
  const sylRes = await pool.query(
    `SELECT sl.id, sl.unit_id, su.unit_number, sl.subject_id, sl.standard_number, sl.term,
            sl.lesson_number, sl.title, sl.textbook_id, sl.source_page_start
     FROM syllabus_lessons sl
     LEFT JOIN syllabus_units su ON su.id = sl.unit_id
     WHERE sl.standard_number = $1 AND COALESCE(sl.is_active, true) = true`,
    [standard]
  );

  const bodyPlans = pagePlans.filter((p) => p.indexingStatus === 'indexed');
  const syllabusUpdates: Array<{
    lessonId: string;
    startPage: number;
    endPage: number;
    pageRef: string;
  }> = [];

  for (const sl of sylRes.rows) {
    const unitNum = Number(sl.unit_number || 1);
    if (!isSubjectCompatible(sl.subject_id, unitNum, subject, sl.title)) continue;
    if (!termCompatible(sl.term, term)) continue;

    // Prefer English textbooks for English-title syllabus lessons unless it's General Tamil or Tamil-script title
    const isTamilTitle = /[\u0B80-\u0BFF]/.test(String(sl.title || '')) || /tamil/i.test(String(sl.subject_id || ''));
    if (sl.textbook_id && Number(sl.textbook_id) !== textbookId && sl.source_page_start != null) {
      // Only overwrite if this textbook is a better medium match
      const thisMediumMatches = isTamilTitle ? medium.toLowerCase() === 'tamil' : medium.toLowerCase() === 'english';
      if (!thisMediumMatches) continue;
    }

    const keywords = extractBilingualKeywords(sl.title);
    if (keywords.length === 0 || bodyPlans.length === 0) continue;

    // Score each body page
    const scored: Array<{ pageNumber: number; score: number }> = [];
    const cleanTitleLow = normalizeTamilPdfText(sl.title || '').toLowerCase().trim();

    for (const bp of bodyPlans) {
      let score = 0;
      const bpLessonLow = bp.lessonTitle.toLowerCase();
      if (cleanTitleLow.length >= 4 && (bpLessonLow.includes(cleanTitleLow) || cleanTitleLow.includes(bpLessonLow))) {
        score += 60;
      }
      if (cleanTitleLow.length >= 5 && bp.lowerContent.includes(cleanTitleLow)) {
        score += 40;
      }
      let kwHits = 0;
      for (const kw of keywords) {
        if (bp.lowerContent.includes(kw)) {
          kwHits++;
          score += 6;
        }
      }
      if (score >= 12 || kwHits >= Math.min(2, keywords.length)) {
        scored.push({ pageNumber: bp.pageNumber, score });
      }
    }

    if (scored.length === 0) continue;

    // Pick contiguous cluster around highest-scoring page
    scored.sort((a, b) => b.score - a.score || a.pageNumber - b.pageNumber);
    const anchor = scored[0].pageNumber;
    const clusterPages = scored
      .map((s) => s.pageNumber)
      .filter((pn) => Math.abs(pn - anchor) <= 18)
      .sort((a, b) => a - b);

    const startPage = clusterPages[0] ?? anchor;
    const endPage = Math.min(
      bodyPlans[bodyPlans.length - 1].pageNumber,
      Math.max(clusterPages[clusterPages.length - 1] ?? anchor, startPage + 2)
    );

    syllabusUpdates.push({
      lessonId: String(sl.id),
      startPage,
      endPage,
      pageRef: `${tb.book_name} • Pages ${startPage}–${endPage}`,
    });

    // Tag the anchor/cluster pages with this syllabus lesson_id if they only had a generic fallback slug
    for (const bp of bodyPlans) {
      if (bp.pageNumber >= startPage && bp.pageNumber <= endPage && bp.lessonId.startsWith(`tb${textbookId}-`)) {
        bp.lessonId = String(sl.id);
      }
    }
  }

  // Batched UNNEST update for textbook_content (1 single SQL round-trip for the entire textbook!)
  if (pagePlans.length > 0) {
    const ids = pagePlans.map((p) => p.id);
    const unitIds = pagePlans.map((p) => p.unitId);
    const unitTitles = pagePlans.map((p) => p.unitTitle);
    const chapterTitles = pagePlans.map((p) => p.chapterTitle);
    const lessonIds = pagePlans.map((p) => p.lessonId);
    const lessonTitles = pagePlans.map((p) => p.lessonTitle);
    const topics = pagePlans.map((p) => p.topic);
    const mediums = pagePlans.map((p) => p.medium);
    const statuses = pagePlans.map((p) => p.indexingStatus);

    await pool.query(
      `UPDATE textbook_content AS tc
       SET unit_id = v.unit_id,
           unit_title = v.unit_title,
           chapter_title = v.chapter_title,
           lesson_id = v.lesson_id,
           lesson_title = v.lesson_title,
           topic = v.topic,
           medium = v.medium,
           indexing_status = v.indexing_status,
           indexed_at = CURRENT_TIMESTAMP
       FROM UNNEST(
         $1::int[], $2::int[], $3::text[], $4::text[], $5::text[],
         $6::text[], $7::text[], $8::varchar[], $9::varchar[]
       ) AS v(id, unit_id, unit_title, chapter_title, lesson_id, lesson_title, topic, medium, indexing_status)
       WHERE tc.id = v.id`,
      [ids, unitIds, unitTitles, chapterTitles, lessonIds, lessonTitles, topics, mediums, statuses]
    );
  }

  // Batched UNNEST update for matched syllabus_lessons
  if (syllabusUpdates.length > 0) {
    const slIds = syllabusUpdates.map((u) => u.lessonId);
    const starts = syllabusUpdates.map((u) => u.startPage);
    const ends = syllabusUpdates.map((u) => u.endPage);
    const refs = syllabusUpdates.map((u) => u.pageRef);

    await pool.query(
      `UPDATE syllabus_lessons AS sl
       SET textbook_id = $5,
           source_page_start = v.start_page,
           source_page_end = v.end_page,
           textbook_title = $6,
           textbook_page_reference = v.page_ref,
           mapping_status = 'FULLY MAPPED',
           verification_status = 'VERIFIED',
           updated_at = CURRENT_TIMESTAMP
       FROM UNNEST($1::varchar[], $2::int[], $3::int[], $4::text[]) AS v(id, start_page, end_page, page_ref)
       WHERE sl.id = v.id`,
      [slIds, starts, ends, refs, textbookId, tb.book_name]
    );
  }

  let indexingStatus: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'PENDING' | 'FAILED' = 'COMPLETED';
  if (indexedPages === 0 && failedPages > 0) {
    indexingStatus = 'FAILED';
  } else if (failedPages > 0 || extractedPages < totalPages) {
    indexingStatus = 'PARTIALLY_COMPLETED';
  } else if (indexedPages === 0) {
    indexingStatus = 'PENDING';
  }

  await pool.query(
    `UPDATE textbooks
     SET indexed_pages = $2,
         indexing_status = $3,
         indexed_lessons_count = $4,
         last_indexed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [textbookId, indexedPages, indexingStatus, Math.max(lessonSet.size, syllabusUpdates.length)]
  );

  return {
    textbookId,
    bookName: tb.book_name,
    standard,
    subject,
    medium,
    term,
    totalPages,
    extractedPages,
    indexedPages,
    matterPages,
    blankPages,
    failedPages,
    distinctUnits: unitSet.size,
    distinctLessons: lessonSet.size,
    mappedSyllabusLessons: syllabusUpdates.length,
    indexingStatus,
    durationMs: Date.now() - started,
  };
}

/**
 * Chunked, resumable batch indexer for Admin Panel & CLI bulk recovery.
 */
export async function runChunkedIndexingBatch(options?: {
  cursorTextbookId?: number;
  batchSize?: number;
  standard?: number;
  medium?: string;
  onlyIncomplete?: boolean;
  jobId?: string;
}): Promise<{
  jobId: string;
  processed: number;
  succeeded: number;
  failed: number;
  nextCursor: number;
  hasMore: boolean;
  remaining: number;
  results: TextbookIndexingResult[];
  errors: Array<{ textbookId: number; error: string }>;
}> {
  await ensureIndexingSchema();

  const cursor = Math.max(0, Number(options?.cursorTextbookId || 0));
  const batchSize = Math.min(25, Math.max(1, Number(options?.batchSize || 8)));
  const jobId = options?.jobId || `idx_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  const conditions: string[] = [`t.id > $1`];
  const params: any[] = [cursor];
  let pIdx = 2;

  if (options?.standard && options.standard >= 6 && options.standard <= 12) {
    conditions.push(`t.standard = $${pIdx++}`);
    params.push(options.standard);
  }
  if (options?.medium && options.medium !== 'all') {
    conditions.push(`LOWER(t.medium) = LOWER($${pIdx++})`);
    params.push(options.medium);
  }
  if (options?.onlyIncomplete) {
    conditions.push(`COALESCE(t.indexing_status, 'PENDING') <> 'COMPLETED'`);
  }

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM textbooks t WHERE ${conditions.join(' AND ')}`,
    params
  );
  const totalRemainingBefore = Number(countRes.rows[0]?.cnt || 0);

  const batchRes = await pool.query(
    `SELECT t.id FROM textbooks t WHERE ${conditions.join(' AND ')} ORDER BY t.id ASC LIMIT $${pIdx}`,
    [...params, batchSize]
  );

  // Upsert durable job record
  await pool.query(
    `INSERT INTO textbook_indexing_jobs (job_id, job_type, status, total_items, cursor_textbook_id, filters)
     VALUES ($1, 'index_all', 'PROCESSING', $2, $3, $4::jsonb)
     ON CONFLICT (job_id) DO UPDATE SET
       status = 'PROCESSING',
       updated_at = CURRENT_TIMESTAMP`,
    [jobId, totalRemainingBefore, cursor, JSON.stringify(options || {})]
  );

  const results: TextbookIndexingResult[] = [];
  const errors: Array<{ textbookId: number; error: string }> = [];
  let nextCursor = cursor;

  for (const row of batchRes.rows) {
    const tbId = Number(row.id);
    nextCursor = tbId;
    try {
      const r = await indexTextbookPages(tbId);
      results.push(r);
    } catch (err: any) {
      errors.push({ textbookId: tbId, error: err?.message || 'Indexing failed' });
    }
  }

  const remaining = Math.max(0, totalRemainingBefore - batchRes.rows.length);
  const hasMore = remaining > 0;
  const finalStatus = hasMore
    ? 'PROCESSING'
    : errors.length > 0
    ? 'PARTIALLY_COMPLETED'
    : 'COMPLETED';

  await pool.query(
    `UPDATE textbook_indexing_jobs
     SET status = $2,
         processed_items = processed_items + $3,
         succeeded_items = succeeded_items + $4,
         failed_items = failed_items + $5,
         cursor_textbook_id = $6,
         error_logs = COALESCE(error_logs, '[]'::jsonb) || $7::jsonb,
         completed_at = CASE WHEN $2 IN ('COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED') THEN CURRENT_TIMESTAMP ELSE completed_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE job_id = $1`,
    [jobId, finalStatus, batchRes.rows.length, results.length, errors.length, nextCursor, JSON.stringify(errors)]
  );

  return {
    jobId,
    processed: batchRes.rows.length,
    succeeded: results.length,
    failed: errors.length,
    nextCursor,
    hasMore,
    remaining,
    results,
    errors,
  };
}

/**
 * Global Textbook Indexing Control Center Overview Metrics.
 */
export async function getIndexingControlCenterOverview(): Promise<IndexingOverviewMetrics> {
  await ensureIndexingSchema();

  const [aggRes, stdRes, sylRes, pdfRes, jobsRes] = await Promise.all([
    pool.query(`
      WITH tb_stats AS (
        SELECT
          t.id,
          t.standard,
          t.status,
          COALESCE(t.indexing_status, 'PENDING') AS indexing_status,
          COALESCE(t.page_count, 0) AS declared_pages,
          t.extracted_at,
          t.last_indexed_at,
          COUNT(tc.id)::int AS stored_rows,
          COUNT(tc.id) FILTER (WHERE tc.extraction_status = 'completed')::int AS completed_pages,
          COUNT(tc.id) FILTER (WHERE tc.extraction_status = 'failed')::int AS failed_pages,
          COUNT(tc.id) FILTER (WHERE tc.extraction_status IN ('pending', 'processing'))::int AS processing_pages,
          COUNT(tc.id) FILTER (WHERE tc.extraction_status = 'completed' AND NOT COALESCE(tc.is_ocr, false))::int AS native_pages,
          COUNT(tc.id) FILTER (WHERE tc.extraction_status = 'completed' AND COALESCE(tc.is_ocr, false))::int AS ocr_pages,
          COUNT(tc.id) FILTER (WHERE tc.indexing_status = 'indexed')::int AS indexed_pages,
          COUNT(tc.id) FILTER (WHERE tc.indexing_status IN ('front_matter', 'back_matter'))::int AS matter_pages,
          COUNT(tc.id) FILTER (WHERE tc.indexing_status = 'blank')::int AS blank_pages
        FROM textbooks t
        LEFT JOIN textbook_content tc ON tc.textbook_id = t.id
        GROUP BY t.id
      )
      SELECT
        COUNT(*)::int AS total_textbooks,
        COALESCE(SUM(GREATEST(declared_pages, stored_rows)), 0)::int AS total_pages,
        COALESCE(SUM(completed_pages), 0)::int AS extracted_pages,
        COALESCE(SUM(indexed_pages), 0)::int AS indexed_pages,
        COALESCE(SUM(matter_pages), 0)::int AS matter_pages,
        COALESCE(SUM(blank_pages), 0)::int AS blank_pages,
        COALESCE(SUM(failed_pages), 0)::int AS failed_pages,
        COALESCE(SUM(processing_pages), 0)::int AS processing_pages,
        COALESCE(SUM(native_pages), 0)::int AS native_pages,
        COALESCE(SUM(ocr_pages), 0)::int AS ocr_pages,
        COUNT(*) FILTER (WHERE indexing_status = 'COMPLETED' AND failed_pages = 0)::int AS completed_textbooks,
        COUNT(*) FILTER (WHERE indexing_status = 'PARTIALLY_COMPLETED' OR (indexing_status = 'COMPLETED' AND failed_pages > 0))::int AS partial_textbooks,
        COUNT(*) FILTER (WHERE indexing_status = 'FAILED')::int AS failed_textbooks,
        COUNT(*) FILTER (WHERE indexing_status = 'PENDING')::int AS pending_textbooks,
        COUNT(*) FILTER (WHERE status IN ('completed', 'published') AND (indexing_status <> 'COMPLETED' OR failed_pages > 0 OR indexed_pages = 0))::int AS incomplete_published,
        MAX(extracted_at) AS last_processing_time,
        MAX(last_indexed_at) AS last_indexed_time
      FROM tb_stats
    `),
    pool.query(`
      WITH per_tb AS (
        SELECT
          t.id, t.standard, COALESCE(t.indexing_status, 'PENDING') AS indexing_status,
          GREATEST(COALESCE(t.page_count, 0), COUNT(tc.id))::int AS total_pages,
          COUNT(tc.id) FILTER (WHERE tc.extraction_status = 'completed')::int AS extracted_pages,
          COUNT(tc.id) FILTER (WHERE tc.indexing_status = 'indexed')::int AS indexed_pages,
          COUNT(tc.id) FILTER (WHERE tc.extraction_status = 'failed')::int AS failed_pages,
          COUNT(DISTINCT tc.lesson_title) FILTER (WHERE tc.indexing_status = 'indexed')::int AS distinct_lessons
        FROM textbooks t
        LEFT JOIN textbook_content tc ON tc.textbook_id = t.id
        GROUP BY t.id
      ),
      syl_std AS (
        SELECT standard_number AS standard,
               COUNT(*) FILTER (WHERE textbook_id IS NOT NULL AND source_page_start IS NOT NULL)::int AS mapped_syl
        FROM syllabus_lessons
        GROUP BY standard_number
      )
      SELECT
        p.standard,
        COUNT(*)::int AS textbooks,
        COALESCE(SUM(p.total_pages), 0)::int AS total_pages,
        COALESCE(SUM(p.extracted_pages), 0)::int AS extracted_pages,
        COALESCE(SUM(p.indexed_pages), 0)::int AS indexed_pages,
        COALESCE(SUM(p.failed_pages), 0)::int AS failed_pages,
        COUNT(*) FILTER (WHERE p.indexing_status = 'COMPLETED' AND p.failed_pages = 0)::int AS completed_textbooks,
        COUNT(*) FILTER (WHERE p.indexing_status <> 'COMPLETED' OR p.failed_pages > 0)::int AS partial_textbooks,
        COALESCE(SUM(p.distinct_lessons), 0)::int AS distinct_lessons,
        COALESCE(MAX(s.mapped_syl), 0)::int AS mapped_syllabus_lessons
      FROM per_tb p
      LEFT JOIN syl_std s ON s.standard = p.standard
      GROUP BY p.standard
      ORDER BY p.standard ASC
    `),
    pool.query(`
      SELECT
        COUNT(*)::int AS total_lessons,
        COUNT(*) FILTER (WHERE textbook_id IS NOT NULL AND source_page_start IS NOT NULL)::int AS mapped_lessons
      FROM syllabus_lessons
      WHERE COALESCE(is_active, true) = true
    `),
    pool.query(`
      SELECT COUNT(*)::int AS total_pdfs
      FROM google_drive_materials
      WHERE COALESCE(sync_status, 'ACTIVE') = 'ACTIVE'
    `),
    pool.query(`
      SELECT job_id, job_type, status, total_items, processed_items, succeeded_items, failed_items,
             cursor_textbook_id, created_at, updated_at, completed_at
      FROM textbook_indexing_jobs
      ORDER BY created_at DESC
      LIMIT 10
    `),
  ]);

  const a = aggRes.rows[0] || {};
  const totalPages = Number(a.total_pages || 0);
  const extractedPages = Number(a.extracted_pages || 0);
  const failedPages = Number(a.failed_pages || 0);
  const pendingPages = Math.max(0, totalPages - extractedPages - failedPages);

  return {
    totalTextbooks: Number(a.total_textbooks || 0),
    totalPdfs: Number(pdfRes.rows[0]?.total_pdfs || a.total_textbooks || 0),
    totalSyllabusLessons: Number(sylRes.rows[0]?.total_lessons || 0),
    mappedSyllabusLessons: Number(sylRes.rows[0]?.mapped_lessons || 0),
    totalPages,
    extractedPages,
    indexedPages: Number(a.indexed_pages || 0),
    matterPages: Number(a.matter_pages || 0),
    blankPages: Number(a.blank_pages || 0),
    pendingPages,
    failedPages,
    processingPages: Number(a.processing_pages || 0),
    nativePages: Number(a.native_pages || 0),
    ocrPages: Number(a.ocr_pages || 0),
    completedTextbooks: Number(a.completed_textbooks || 0),
    partialTextbooks: Number(a.partial_textbooks || 0),
    failedTextbooks: Number(a.failed_textbooks || 0),
    pendingTextbooks: Number(a.pending_textbooks || 0),
    incompletePublishedTextbooks: Number(a.incomplete_published || 0),
    lastProcessingTime: a.last_processing_time ? new Date(a.last_processing_time).toISOString() : null,
    lastIndexedTime: a.last_indexed_time ? new Date(a.last_indexed_time).toISOString() : null,
    byStandard: stdRes.rows.map((r) => ({
      standard: Number(r.standard),
      textbooks: Number(r.textbooks),
      totalPages: Number(r.total_pages),
      extractedPages: Number(r.extracted_pages),
      indexedPages: Number(r.indexed_pages),
      failedPages: Number(r.failed_pages),
      completedTextbooks: Number(r.completed_textbooks),
      partialTextbooks: Number(r.partial_textbooks),
      distinctLessons: Number(r.distinct_lessons),
      mappedSyllabusLessons: Number(r.mapped_syllabus_lessons),
    })),
    recentJobs: jobsRes.rows.map((j) => ({
      jobId: j.job_id,
      jobType: j.job_type,
      status: j.status,
      totalItems: Number(j.total_items || 0),
      processedItems: Number(j.processed_items || 0),
      succeededItems: Number(j.succeeded_items || 0),
      failedItems: Number(j.failed_items || 0),
      cursorTextbookId: Number(j.cursor_textbook_id || 0),
      createdAt: new Date(j.created_at).toISOString(),
      updatedAt: new Date(j.updated_at).toISOString(),
      completedAt: j.completed_at ? new Date(j.completed_at).toISOString() : null,
    })),
  };
}

/**
 * Automated Data Integrity & Verification Suite (Phase 9).
 */
export async function verifyAllTextbooksIntegrity(): Promise<IndexingVerificationReport> {
  await ensureIndexingSchema();

  const [countsRes, dupRes, bleedRes, tbCheckRes, sylRes] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int AS total_pages,
        COUNT(*) FILTER (WHERE extraction_status = 'completed')::int AS completed_pages,
        COUNT(*) FILTER (WHERE indexing_status = 'indexed')::int AS indexed_body_pages,
        COUNT(*) FILTER (WHERE indexing_status IN ('front_matter', 'back_matter'))::int AS matter_pages,
        COUNT(*) FILTER (WHERE indexing_status = 'blank')::int AS blank_pages,
        COUNT(*) FILTER (WHERE extraction_status = 'failed' OR indexing_status = 'failed')::int AS failed_pages,
        COUNT(*) FILTER (WHERE COALESCE(indexing_status, 'pending') = 'pending')::int AS pending_pages,
        COUNT(*) FILTER (WHERE indexing_status = 'indexed' AND (lesson_id IS NULL OR TRIM(lesson_id) = ''))::int AS null_lesson_id_indexed
      FROM textbook_content
    `),
    pool.query(`
      SELECT COUNT(*)::int AS dup_count FROM (
        SELECT textbook_id, page_number FROM textbook_content GROUP BY textbook_id, page_number HAVING COUNT(*) > 1
      ) d
    `),
    pool.query(`
      SELECT COUNT(*)::int AS bleed_count
      FROM textbook_content tc
      JOIN textbooks t ON t.id = tc.textbook_id
      WHERE NOT (t.standard = 6 AND LOWER(t.subject) LIKE '%tamil%' AND LOWER(t.medium) = 'tamil')
        AND tc.unit_title IN ('இயல் 1 - தமிழ் தேன்', 'இயல் 2 - இயற்கை இன்பம்', 'இயல் 3 - எந்திர உலகம்')
    `),
    pool.query(`
      WITH per_tb AS (
        SELECT t.id, COALESCE(t.page_count, 0) AS declared_pages,
               COUNT(tc.id)::int AS stored_pages,
               COUNT(tc.id) FILTER (WHERE tc.indexing_status = 'indexed')::int AS indexed_pages
        FROM textbooks t
        LEFT JOIN textbook_content tc ON tc.textbook_id = t.id
        GROUP BY t.id
      )
      SELECT
        COUNT(*)::int AS total_textbooks,
        COUNT(*) FILTER (WHERE indexed_pages = 0)::int AS zero_indexed,
        COUNT(*) FILTER (WHERE stored_pages <> declared_pages)::int AS page_mismatch
      FROM per_tb
    `),
    pool.query(`
      SELECT
        COUNT(*)::int AS total_syl,
        COUNT(*) FILTER (WHERE textbook_id IS NOT NULL AND source_page_start IS NOT NULL)::int AS mapped_syl
      FROM syllabus_lessons
      WHERE COALESCE(is_active, true) = true
    `),
  ]);

  const c = countsRes.rows[0] || {};
  const tb = tbCheckRes.rows[0] || {};
  const syl = sylRes.rows[0] || {};

  const totals = {
    totalTextbooks: Number(tb.total_textbooks || 0),
    totalPages: Number(c.total_pages || 0),
    completedPages: Number(c.completed_pages || 0),
    indexedBodyPages: Number(c.indexed_body_pages || 0),
    matterPages: Number(c.matter_pages || 0),
    blankPages: Number(c.blank_pages || 0),
    failedPages: Number(c.failed_pages || 0),
    pendingPages: Number(c.pending_pages || 0),
    duplicatePageRows: Number(dupRes.rows[0]?.dup_count || 0),
    nullLessonIdOnIndexedPages: Number(c.null_lesson_id_indexed || 0),
    hardcodedClass6UnitBleed: Number(bleedRes.rows[0]?.bleed_count || 0),
    textbooksWithZeroIndexedPages: Number(tb.zero_indexed || 0),
    textbooksWithPageCountMismatch: Number(tb.page_mismatch || 0),
    mappedSyllabusLessons: Number(syl.mapped_syl || 0),
    totalSyllabusLessons: Number(syl.total_syl || 0),
  };

  const issues: string[] = [];
  if (totals.duplicatePageRows > 0) issues.push(`Found ${totals.duplicatePageRows} duplicate (textbook_id, page_number) rows.`);
  if (totals.nullLessonIdOnIndexedPages > 0) issues.push(`Found ${totals.nullLessonIdOnIndexedPages} indexed pages with NULL lesson_id.`);
  if (totals.hardcodedClass6UnitBleed > 0) issues.push(`Found ${totals.hardcodedClass6UnitBleed} non-Class-6-Tamil pages with hardcoded Class 6 Tamil unit titles.`);
  if (totals.pendingPages > 0) issues.push(`Found ${totals.pendingPages} pages still in pending indexing_status.`);
  if (totals.textbooksWithZeroIndexedPages > 0) issues.push(`Found ${totals.textbooksWithZeroIndexedPages} textbooks with 0 indexed pages.`);
  if (totals.textbooksWithPageCountMismatch > 0) issues.push(`Found ${totals.textbooksWithPageCountMismatch} textbooks where stored page count != declared page_count.`);

  // Note: failedPages are documented non-extractable pages (tracked explicitly, not hidden).
  const passed =
    totals.duplicatePageRows === 0 &&
    totals.nullLessonIdOnIndexedPages === 0 &&
    totals.hardcodedClass6UnitBleed === 0 &&
    totals.pendingPages === 0 &&
    totals.textbooksWithZeroIndexedPages === 0 &&
    totals.textbooksWithPageCountMismatch === 0;

  return {
    passed,
    checkedAt: new Date().toISOString(),
    totals,
    issues,
  };
}
