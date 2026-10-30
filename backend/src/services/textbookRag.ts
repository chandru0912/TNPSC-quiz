import pool from '../db';
import { isFrontOrBackMatterPage, normalizeTamilPdfText } from './pdfProcessor';

export interface TextbookSearchQuery {
  groupId?: string;
  standard: number;
  subject: string;
  medium?: string;
  term?: string;
  unitId?: number;
  lessonTitle?: string;
  topic?: string;
  textbookId?: number;
  maxPages?: number;
}

export interface TextbookChunk {
  contentId: number;
  textbookId: number;
  bookName: string;
  pageNumber: number;
  unitId: number | null;
  lessonTitle: string | null;
  content: string;
  relevanceScore: number;
  isOcr: boolean;
}

export interface TextbookRetrievalResult {
  textbookId: number | null;
  bookName: string | null;
  standard: number;
  subject: string;
  medium: string;
  term?: string | null;
  chunks: TextbookChunk[];
  relevantPages: number[];
  totalAvailablePages: number;
  hasSufficientContent: boolean;
}

/**
 * Extracts key search keywords from lesson title and topic
 * Excludes generic stop words to focus on meaningful terms.
 */
function extractKeywords(lessonTitle?: string, topic?: string): string[] {
  const text = `${lessonTitle || ''} ${topic || ''}`.toLowerCase();
  const stopWords = new Set([
    'and', 'the', 'for', 'with', 'from', 'into', 'under', 'that', 'this',
    'lesson', 'unit', 'chapter', 'part', 'standard', 'term', 'tnpsc', 'study',
    'class', 'std', 'new', 'syllabus', 'general', 'tamil',
    'மற்றும்', 'ஒரு', 'ஆகிய', 'போன்ற', 'பற்றி', 'பகுதி', 'வகுப்பு', 'பாடம்', 'இயல்'
  ]);

  const rawWords = text
    .replace(/[^a-zA-Z0-9\u0B80-\u0BFF\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  return Array.from(new Set(rawWords)).slice(0, 20);
}

/**
 * Retrieves relevant textbook content strictly filtered by syllabus criteria.
 * Avoids leaking unrelated textbook content or front/back matter into Gemini prompt context.
 */
export async function retrieveRelevantTextbookContent(
  query: TextbookSearchQuery
): Promise<TextbookRetrievalResult> {
  const {
    groupId,
    standard,
    subject,
    medium = 'English',
    term,
    unitId,
    lessonTitle,
    topic,
    textbookId,
    maxPages = 22,
  } = query;

  // 1. Identify Target Textbook
  let resolvedTextbookId = textbookId;
  let resolvedBookName: string | null = null;
  let resolvedMedium = medium;
  let resolvedTerm: string | null = term || null;

  const isTamilSubject =
    /tamil|தமிழ்/i.test(subject || '') ||
    /tamil|தமிழ்/i.test(medium || '') ||
    /[\u0B80-\u0BFF]/.test(lessonTitle || '');

  if (resolvedTextbookId) {
    const tbRes = await pool.query(
      `SELECT id, book_name, medium, standard, subject, term FROM textbooks WHERE id = $1 AND status = 'completed'`,
      [resolvedTextbookId]
    );
    if (tbRes.rows.length > 0) {
      resolvedBookName = tbRes.rows[0].book_name;
      resolvedMedium = tbRes.rows[0].medium;
      resolvedTerm = tbRes.rows[0].term || resolvedTerm;
    } else {
      return {
        textbookId: null,
        bookName: null,
        standard,
        subject,
        medium,
        term: resolvedTerm,
        chunks: [],
        relevantPages: [],
        totalAvailablePages: 0,
        hasSufficientContent: false,
      };
    }
  } else {
    // Auto-select matching completed textbook for the exact standard
    const conditions: string[] = [`status = 'completed'`, `standard = $1`];
    const vals: any[] = [standard];
    let pIdx = 2;

    if (term && term !== 'Full Year' && term !== 'all') {
      conditions.push(`(LOWER(term) = LOWER($${pIdx++}) OR term IS NULL OR term = 'Full Year')`);
      vals.push(term);
    }

    if (isTamilSubject) {
      // Match Tamil textbooks whether uploaded with subject='General Tamil', 'Tamil', or 'General Studies' + medium='Tamil'
      conditions.push(
        `(LOWER(subject) LIKE '%tamil%' OR LOWER(medium) = 'tamil' OR LOWER(file_path) LIKE '%tamil%' OR LOWER(book_name) LIKE '%tamil%')`
      );
    } else if (subject) {
      conditions.push(
        `(LOWER(subject) = LOWER($${pIdx}) OR LOWER(subject) LIKE '%' || LOWER($${pIdx}) || '%')`
      );
      vals.push(subject);
      pIdx++;
      if (medium) {
        conditions.push(`LOWER(medium) = LOWER($${pIdx++})`);
        vals.push(medium);
      }
    }

    let orderExpr = `id DESC`;
    if (groupId) {
      orderExpr = `CASE WHEN LOWER(group_id) = LOWER($${pIdx++}) THEN 0 ELSE 1 END ASC, id DESC`;
      vals.push(groupId);
    }

    const selectQuery = `
      SELECT id, book_name, medium, subject, term
      FROM textbooks 
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderExpr}
      LIMIT 1
    `;
    const tbRes = await pool.query(selectQuery, vals);
    if (tbRes.rows.length > 0) {
      resolvedTextbookId = tbRes.rows[0].id;
      resolvedBookName = tbRes.rows[0].book_name;
      resolvedMedium = tbRes.rows[0].medium;
      resolvedTerm = tbRes.rows[0].term || resolvedTerm;
    }
  }

  if (!resolvedTextbookId) {
    return {
      textbookId: null,
      bookName: null,
      standard,
      subject,
      medium,
      term: resolvedTerm,
      chunks: [],
      relevantPages: [],
      totalAvailablePages: 0,
      hasSufficientContent: false,
    };
  }

  // 2. Fetch all pages for the textbook
  const keywords = extractKeywords(lessonTitle, topic);
  const contentQuery = `
    SELECT id, textbook_id, page_number, unit_id, unit_title, lesson_title, topic, content, is_ocr
    FROM textbook_content
    WHERE textbook_id = $1
    ORDER BY page_number ASC
  `;
  const contentRes = await pool.query(contentQuery, [resolvedTextbookId]);
  const allPages = contentRes.rows;

  if (allPages.length === 0) {
    return {
      textbookId: resolvedTextbookId,
      bookName: resolvedBookName,
      standard,
      subject,
      medium: resolvedMedium,
      term: resolvedTerm,
      chunks: [],
      relevantPages: [],
      totalAvailablePages: 0,
      hasSufficientContent: false,
    };
  }

  const totalPagesCount = allPages.length;

  // Exclude front matter (cover, copyright, national anthem, table of contents) and back matter (committee page)
  const bodyPages = allPages.filter((row) => {
    if (row.topic === 'front_matter' || row.topic === 'back_matter') return false;
    const cleaned = normalizeTamilPdfText(row.content || '');
    const matter = isFrontOrBackMatterPage(cleaned, row.page_number, totalPagesCount);
    return matter === null;
  });

  const candidatePages = bodyPages.length > 0 ? bodyPages : allPages;

  const lowerLessonQuery = (lessonTitle || '').toLowerCase();
  const isGrammarLessonQuery =
    /இலக்கணம்|grammar|எழுத்து|மொழிமுதல்|சார்பெழுத்து|வேர்ச்சொல்/i.test(
      `${lessonTitle || ''} ${topic || ''}`
    );
  const isLiteratureOrProseQuery =
    /இலக்கியம்|literature|செய்யுள்|உரைநடை|prose|poetry|திருக்குறள்|இன்பத்தமிழ்|தமிழ்க்கும்மி|வளர்தமிழ்/i.test(
      `${lessonTitle || ''} ${topic || ''}`
    );

  // Score each page based on unit match, lesson match, and normalized keyword matches
  const scoredPages: TextbookChunk[] = candidatePages.map((row) => {
    let score = 0;
    const normalizedContent = normalizeTamilPdfText(row.content || '');
    const lowerContent = normalizedContent.toLowerCase();
    const rowLesson = normalizeTamilPdfText(row.lesson_title || '').toLowerCase();

    // 1. Unit match
    if (unitId && row.unit_id === unitId) {
      score += 30;
    } else if (unitId && row.unit_id && row.unit_id !== unitId) {
      // Slightly lower score for other units unless specifically matched by lesson/grammar topic
      score -= 5;
    }

    // 2. Direct lesson title match
    if (
      lowerLessonQuery &&
      rowLesson &&
      (rowLesson.includes(lowerLessonQuery) || lowerLessonQuery.includes(rowLesson))
    ) {
      score += 45;
    }

    // 3. Specific Tamil lesson title matching inside page content
    if (lowerLessonQuery && rowLesson && lowerContent.includes(rowLesson)) {
      score += 15;
    }

    // 4. Grammar / Literature section boost when syllabus lesson is a broad Part A / Part B / Part C header
    if (isGrammarLessonQuery && /இலக்கணம்|கற்கண்டு|எழுத்து|மாத்திரை|குறில்|நெடில்|வல்லினம்|மெல்லினம்|இடையினம்|சார்பெழுத்து/.test(lowerContent)) {
      score += 20;
    }
    if (isLiteratureOrProseQuery && /கவிதைப்பேழை|உரைநடை|விரிவானம்|நூல்\s*வெளி|சொல்லும்\s*பொருளும்/.test(lowerContent)) {
      score += 15;
    }

    // 5. Keyword matches in page content
    for (const kw of keywords) {
      if (lowerContent.includes(kw)) {
        score += 8;
      }
    }

    return {
      contentId: row.id,
      textbookId: row.textbook_id,
      bookName: resolvedBookName || 'Samacheer Kalvi Textbook',
      pageNumber: row.page_number,
      unitId: row.unit_id,
      lessonTitle: row.lesson_title ? normalizeTamilPdfText(row.lesson_title) : null,
      content: normalizedContent,
      relevanceScore: score,
      isOcr: Boolean(row.is_ocr),
    };
  });

  // Strictly scope to the selected unit's pages when the textbook has unit mappings for that unit
  const unitScopedPages = unitId
    ? scoredPages.filter((p) => p.unitId === unitId)
    : [];
  const poolToSelectFrom = unitScopedPages.length >= 3 ? unitScopedPages : scoredPages;

  // Select chunks with positive relevance score
  let selectedChunks = poolToSelectFrom.filter((p) => p.relevanceScore > 0);

  if (selectedChunks.length === 0) {
    if (unitScopedPages.length > 0) {
      selectedChunks = unitScopedPages.slice(0, maxPages);
    } else {
      selectedChunks = poolToSelectFrom.filter((p) => p.content.length > 100).slice(0, maxPages);
    }
  } else {
    // Sort by relevance score descending, then page number ascending
    selectedChunks.sort((a, b) => b.relevanceScore - a.relevanceScore || a.pageNumber - b.pageNumber);
    selectedChunks = selectedChunks.slice(0, maxPages);
    // Re-order by page number ascending for natural reading order
    selectedChunks.sort((a, b) => a.pageNumber - b.pageNumber);
  }

  const relevantPages = Array.from(new Set(selectedChunks.map((c) => c.pageNumber)));
  const totalLength = selectedChunks.reduce((acc, c) => acc + c.content.length, 0);

  // Require at least 150 characters of real lesson body content
  const hasSufficientContent = totalLength >= 150 && relevantPages.length > 0;

  return {
    textbookId: resolvedTextbookId,
    bookName: resolvedBookName,
    standard,
    subject,
    medium: resolvedMedium,
    term: resolvedTerm,
    chunks: selectedChunks,
    relevantPages,
    totalAvailablePages: allPages.length,
    hasSufficientContent,
  };
}


