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
 * Avoids leaking unrelated textbook content or front/back matter into AI prompt context.
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

export interface CompleteLessonRetrievalResult {
  textbookId: number | null;
  bookName: string | null;
  standard: number;
  subject: string;
  medium: string;
  term?: string | null;
  chunks: TextbookChunk[];
  relevantPages: number[];
  totalLessonPages: number;
  startPage: number;
  endPage: number;
  hasSufficientContent: boolean;
  topicsIdentified: string[];
}

/**
 * Extracts all educational topics and subtopics from page text
 */
function extractLessonTopics(chunks: TextbookChunk[]): string[] {
  const topics: string[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    const lines = chunk.content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    for (const line of lines) {
      // Catch headings, bullets, and section titles
      const isHeading =
        /^(?:[#*•-]|(?:\d+[.:\s]))/.test(line) ||
        (line.length >= 4 && line.length <= 60 && !/[.?!]$/.test(line) && !/^\d+$/.test(line) && !line.includes('indd') && !line.includes('Page'));
      
      if (isHeading) {
        const clean = normalizeTamilPdfText(line.replace(/^[#*•\s\d.:-]+/, '').trim());
        if (clean.length >= 4 && clean.length <= 80 && !seen.has(clean.toLowerCase())) {
          seen.add(clean.toLowerCase());
          topics.push(clean);
        }
      }
    }
  }

  return topics;
}

/**
 * Retrieves COMPLETE, contiguous lesson pages without artificial truncation.
 * Strictly isolates the selected lesson and covers every single page from beginning to end.
 */
export async function retrieveCompleteLessonContent(
  query: TextbookSearchQuery
): Promise<CompleteLessonRetrievalResult> {
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
    }
  } else {
    const conditions: string[] = [`status = 'completed'`, `standard = $1`];
    const vals: any[] = [standard];
    let pIdx = 2;

    if (term && term !== 'Full Year' && term !== 'all') {
      conditions.push(`(LOWER(term) = LOWER($${pIdx++}) OR term IS NULL OR term = 'Full Year')`);
      vals.push(term);
    }

    if (isTamilSubject) {
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
      totalLessonPages: 0,
      startPage: 0,
      endPage: 0,
      hasSufficientContent: false,
      topicsIdentified: [],
    };
  }

  // 2. Load all indexed body pages
  const contentQuery = `
    SELECT id, textbook_id, page_number, unit_id, unit_title, lesson_title, topic, content, is_ocr
    FROM textbook_content
    WHERE textbook_id = $1
    ORDER BY page_number ASC
  `;
  const contentRes = await pool.query(contentQuery, [resolvedTextbookId]);
  const allRows = contentRes.rows;
  const totalPagesCount = allRows.length;

  if (totalPagesCount === 0) {
    return {
      textbookId: resolvedTextbookId,
      bookName: resolvedBookName,
      standard,
      subject,
      medium: resolvedMedium,
      term: resolvedTerm,
      chunks: [],
      relevantPages: [],
      totalLessonPages: 0,
      startPage: 0,
      endPage: 0,
      hasSufficientContent: false,
      topicsIdentified: [],
    };
  }

  // Exclude front and back matter
  const bodyRows = allRows.filter((r) => {
    if (r.topic === 'front_matter' || r.topic === 'back_matter') return false;
    const cleaned = normalizeTamilPdfText(r.content || '');
    return isFrontOrBackMatterPage(cleaned, r.page_number, totalPagesCount) === null;
  });

  const candidateRows = bodyRows.length > 0 ? bodyRows : allRows;

  // 3. Filter to Unit Rows if unitId is provided
  const unitRows = unitId
    ? candidateRows.filter((r) => r.unit_id === unitId)
    : candidateRows;

  const activePool = unitRows.length >= 3 ? unitRows : candidateRows;

  // 4. Exact Lesson Boundary Detection
  const cleanLessonTitle = (lessonTitle || '').trim();
  const lowerLesson = cleanLessonTitle.toLowerCase();
  const strippedQuery = cleanLessonTitle.replace(/^[0-9]+(\.[0-9]+)*[:\s–—\-]*/, '').trim();
  const queryParts = strippedQuery.split(/[:–—\-,&]/).map((s) => s.trim()).filter((s) => s.length >= 2);
  const primaryTitle = queryParts[0] || strippedQuery;

  let startPage: number | null = null;
  let endPage: number | null = null;

  // First: Check if activePool has explicit matching lesson_title in database
  const explicitMatchingRows = activePool.filter((r) => {
    if (!r.lesson_title) return false;
    const normRowLesson = normalizeTamilPdfText(r.lesson_title).toLowerCase();
    const pLow = primaryTitle.toLowerCase();
    const matchesPrimary = normRowLesson.includes(pLow) || pLow.includes(normRowLesson);
    const matchesParts = queryParts.some((part) => {
      const partLow = part.toLowerCase();
      return normRowLesson.includes(partLow) || partLow.includes(normRowLesson);
    });
    return matchesPrimary || matchesParts || (cleanLessonTitle && normRowLesson.includes(lowerLesson));
  });

  if (explicitMatchingRows.length > 0) {
    startPage = Math.min(...explicitMatchingRows.map((r) => r.page_number));
    endPage = Math.max(...explicitMatchingRows.map((r) => r.page_number));
  }

  const isGrammarLesson =
    /இலக்கணம்|grammar|எழுத்து|வகை.*தொகை|மாத்திரை|இனவெழுத்து|சுட்டெழுத்து|மயங்கொலி|நால்வகை|வேர்ச்சொல்|சார்பெழுத்து|புணர்ச்சி|அணி/i.test(
      `${cleanLessonTitle} ${topic || ''}`
    );

  if (!startPage && isTamilSubject && isGrammarLesson) {
    // In Tamil textbooks, Grammar is under 'கற்கண்டு' or explicit grammar heading
    const karkanduRow = activePool.find((r) =>
      /கற்கண்டு|தமிழ்\s*எழுத்துகளின்\s*வகை|இலக்கண\s*வ[ழை]க்க[ள்ள]\s*ஐந்து|இலக்கணம்/i.test(normalizeTamilPdfText(r.content))
    );
    if (karkanduRow) {
      startPage = karkanduRow.page_number;
      endPage = Math.max(...activePool.map((r) => r.page_number));
    }
  }

  // If startPage not found via grammar pattern, check explicit lesson / chapter headings
  if (!startPage) {
    const matchingRow = activePool.find((r) => {
      const normContent = normalizeTamilPdfText(r.content);
      return (
        normContent.toLowerCase().includes(primaryTitle.toLowerCase()) ||
        (r.lesson_title && r.lesson_title.toLowerCase().includes(primaryTitle.toLowerCase()))
      );
    });

    if (matchingRow) {
      startPage = matchingRow.page_number;
      const subsequentRows = activePool.filter((r) => r.page_number > startPage!);
      const nextChapterRow = subsequentRows.find((r) => {
        const cleanedContent = normalizeTamilPdfText(r.content).replace(/.*\.indd.*/gi, '');
        return /(?:^|\n)\s*(?:கவிதைப்பேழை|உரைநடை\s*உலகம்|விரிவானம்|கற்கண்டு|இயல்\s*(?:ஒன்று|இரண்டு|மூன்று|\d)|பாடம்\s*\d|Chapter\s*\d|Unit\s*\d)\b/i.test(cleanedContent);
      });

      if (nextChapterRow) {
        endPage = nextChapterRow.page_number - 1;
      } else {
        endPage = Math.max(...activePool.map((r) => r.page_number));
      }
    }
  }

  // Fallback to full unit boundary if sub-lesson not isolated
  if (!startPage || !endPage || startPage > endPage) {
    startPage = Math.min(...activePool.map((r) => r.page_number));
    endPage = Math.max(...activePool.map((r) => r.page_number));
  }

  // Extract ALL contiguous pages between startPage and endPage inclusive
  const selectedRows = candidateRows.filter(
    (r) => r.page_number >= startPage! && r.page_number <= endPage!
  );

  const chunks: TextbookChunk[] = selectedRows.map((row) => ({
    contentId: row.id,
    textbookId: row.textbook_id,
    bookName: resolvedBookName || 'Samacheer Kalvi Textbook',
    pageNumber: row.page_number,
    unitId: row.unit_id,
    lessonTitle: row.lesson_title ? normalizeTamilPdfText(row.lesson_title) : null,
    content: normalizeTamilPdfText(row.content),
    relevanceScore: 100,
    isOcr: Boolean(row.is_ocr),
  }));

  chunks.sort((a, b) => a.pageNumber - b.pageNumber);
  const relevantPages = chunks.map((c) => c.pageNumber);
  const topicsIdentified = extractLessonTopics(chunks);
  const totalLength = chunks.reduce((acc, c) => acc + c.content.length, 0);

  return {
    textbookId: resolvedTextbookId,
    bookName: resolvedBookName,
    standard,
    subject,
    medium: resolvedMedium,
    term: resolvedTerm,
    chunks,
    relevantPages,
    totalLessonPages: relevantPages.length,
    startPage: relevantPages[0] || startPage,
    endPage: relevantPages[relevantPages.length - 1] || endPage,
    hasSufficientContent: totalLength >= 100 && relevantPages.length > 0,
    topicsIdentified,
  };
}




export interface DiscoveredLesson {
  unitId: number;
  lessonTitle: string;
  lessonNumber: string;
  startPage: number;
  endPage: number;
  pageCount: number;
  pages: number[];
  chunks: TextbookChunk[];
  topicsIdentified: string[];
}

export interface ScopeLessonsDiscoveryResult {
  textbookId: number | null;
  bookName: string | null;
  scope: string;
  term?: string | null;
  totalPagesInScope: number;
  totalLessonsInScope: number;
  lessons: DiscoveredLesson[];
}

/**
 * Discovers and segments ALL lessons in the requested scope without skipping any page.
 * Scopes supported:
 *  - 'lesson' | 'chapter': Selected lesson
 *  - 'unit': Entire Unit (all lessons in unit)
 *  - 'term': Entire Term (all units and lessons in term)
 *  - 'full_book': Entire Uploaded Textbook (all pages and lessons)
 */
export async function discoverLessonsInScope(params: {
  groupId?: string;
  standard: number;
  subject: string;
  medium?: string;
  term?: string;
  unitId?: number;
  lessonTitle?: string;
  textbookId?: number;
  scope: 'lesson' | 'chapter' | 'unit' | 'term' | 'full_book';
}): Promise<ScopeLessonsDiscoveryResult> {
  const {
    groupId,
    standard,
    subject,
    medium = 'English',
    term,
    unitId,
    lessonTitle,
    textbookId,
    scope = 'lesson',
  } = params;

  // 1. Resolve Target Textbook
  let resolvedTextbookId = textbookId;
  let resolvedBookName: string | null = null;
  let resolvedMedium = medium;
  let resolvedTerm: string | null = term || null;

  if (resolvedTextbookId) {
    const tbRes = await pool.query(
      `SELECT id, book_name, medium, standard, subject, term FROM textbooks WHERE id = $1 AND status = 'completed'`,
      [resolvedTextbookId]
    );
    if (tbRes.rows.length > 0) {
      resolvedBookName = tbRes.rows[0].book_name;
      resolvedMedium = tbRes.rows[0].medium;
      resolvedTerm = tbRes.rows[0].term || resolvedTerm;
    }
  } else {
    const isTamilSubject =
      /tamil|தமிழ்/i.test(subject || '') ||
      /tamil|தமிழ்/i.test(medium || '') ||
      /[஀-௿]/.test(lessonTitle || '');

    const conditions: string[] = [`status = 'completed'`, `standard = $1`];
    const vals: any[] = [standard];
    let pIdx = 2;

    if (term && term !== 'Full Year' && term !== 'all') {
      conditions.push(`(LOWER(term) = LOWER($${pIdx++}) OR term IS NULL OR term = 'Full Year')`);
      vals.push(term);
    }

    if (isTamilSubject) {
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
      scope,
      term: resolvedTerm,
      totalPagesInScope: 0,
      totalLessonsInScope: 0,
      lessons: [],
    };
  }

  // 2. Load all pages for this textbook
  const contentQuery = `
    SELECT id, textbook_id, page_number, unit_id, unit_title, lesson_title, topic, content, is_ocr
    FROM textbook_content
    WHERE textbook_id = $1
    ORDER BY page_number ASC
  `;
  const contentRes = await pool.query(contentQuery, [resolvedTextbookId]);
  const allRows = contentRes.rows;

  if (allRows.length === 0) {
    return {
      textbookId: resolvedTextbookId,
      bookName: resolvedBookName,
      scope,
      term: resolvedTerm,
      totalPagesInScope: 0,
      totalLessonsInScope: 0,
      lessons: [],
    };
  }

  // Filter out front and back matter
  const bodyRows = allRows.filter((r) => {
    if (r.topic === 'front_matter' || r.topic === 'back_matter') return false;
    const cleaned = normalizeTamilPdfText(r.content || '');
    return isFrontOrBackMatterPage(cleaned, r.page_number, allRows.length) === null;
  });

  const candidateRows = bodyRows.length > 0 ? bodyRows : allRows;

  // Filter rows according to scope
  let scopedRows = candidateRows;
  if (scope === 'unit' && unitId) {
    scopedRows = candidateRows.filter((r) => r.unit_id === unitId);
    if (scopedRows.length === 0) scopedRows = candidateRows;
  }

  // If scope is single lesson, use retrieveCompleteLessonContent
  if (scope === 'lesson' || scope === 'chapter') {
    const singleLesson = await retrieveCompleteLessonContent({
      groupId,
      standard,
      subject,
      medium: resolvedMedium,
      term: resolvedTerm || undefined,
      unitId,
      lessonTitle,
      textbookId: resolvedTextbookId,
    });

    if (!singleLesson.hasSufficientContent || singleLesson.chunks.length === 0) {
      return {
        textbookId: resolvedTextbookId,
        bookName: resolvedBookName,
        scope,
        term: resolvedTerm,
        totalPagesInScope: 0,
        totalLessonsInScope: 0,
        lessons: [],
      };
    }

    return {
      textbookId: resolvedTextbookId,
      bookName: resolvedBookName,
      scope,
      term: resolvedTerm,
      totalPagesInScope: singleLesson.totalLessonPages,
      totalLessonsInScope: 1,
      lessons: [
        {
          unitId: unitId || 1,
          lessonTitle: lessonTitle || singleLesson.chunks[0]?.lessonTitle || 'Lesson',
          lessonNumber: `${unitId || 1}.1`,
          startPage: singleLesson.startPage,
          endPage: singleLesson.endPage,
          pageCount: singleLesson.totalLessonPages,
          pages: singleLesson.relevantPages,
          chunks: singleLesson.chunks,
          topicsIdentified: singleLesson.topicsIdentified,
        },
      ],
    };
  }

  // Multi-lesson grouping for 'unit', 'term', 'full_book'
  const lessonGroups: Array<{
    unitId: number;
    title: string;
    rows: any[];
  }> = [];

  let currentGroup: { unitId: number; title: string; rows: any[] } | null = null;

  for (const r of scopedRows) {
    const u = r.unit_id || 1;
    let lTitle = r.lesson_title ? normalizeTamilPdfText(r.lesson_title).trim() : null;

    if (!lTitle) {
      // If intro page at start of unit, merge with next or attach to current unit intro
      if (currentGroup && currentGroup.unitId === u) {
        currentGroup.rows.push(r);
        continue;
      }
      lTitle = `Unit ${u} Introductory Concepts`;
    }

    if (!currentGroup || currentGroup.unitId !== u || currentGroup.title !== lTitle) {
      if (currentGroup) lessonGroups.push(currentGroup);
      currentGroup = {
        unitId: u,
        title: lTitle,
        rows: [r],
      };
    } else {
      currentGroup.rows.push(r);
    }
  }
  if (currentGroup) lessonGroups.push(currentGroup);

  // If the first item of a unit is just a 1-page intro (e.g. Unit 1 Introduction), merge into the first real lesson
  const consolidatedGroups: typeof lessonGroups = [];
  for (let i = 0; i < lessonGroups.length; i++) {
    const g = lessonGroups[i];
    const isShortIntro = g.rows.length <= 1 && /Introductory Concepts|Introduction|அறிமுகம்/i.test(g.title);
    if (isShortIntro && i + 1 < lessonGroups.length && lessonGroups[i + 1].unitId === g.unitId) {
      lessonGroups[i + 1].rows.unshift(...g.rows);
      continue;
    }
    consolidatedGroups.push(g);
  }

  // Build DiscoveredLesson array
  const unitIndexTracker: Record<number, number> = {};
  const discoveredLessons: DiscoveredLesson[] = consolidatedGroups.map((g) => {
    unitIndexTracker[g.unitId] = (unitIndexTracker[g.unitId] || 0) + 1;
    const lNum = `${g.unitId}.${unitIndexTracker[g.unitId]}`;

    const chunks: TextbookChunk[] = g.rows.map((row) => ({
      contentId: row.id,
      textbookId: row.textbook_id,
      bookName: resolvedBookName || 'Samacheer Kalvi Textbook',
      pageNumber: row.page_number,
      unitId: row.unit_id,
      lessonTitle: row.lesson_title ? normalizeTamilPdfText(row.lesson_title) : null,
      content: normalizeTamilPdfText(row.content),
      relevanceScore: 100,
      isOcr: Boolean(row.is_ocr),
    }));

    chunks.sort((a, b) => a.pageNumber - b.pageNumber);
    const pages = chunks.map((c) => c.pageNumber);
    const topicsIdentified = extractLessonTopics(chunks);

    return {
      unitId: g.unitId,
      lessonTitle: g.title,
      lessonNumber: lNum,
      startPage: pages[0],
      endPage: pages[pages.length - 1],
      pageCount: pages.length,
      pages,
      chunks,
      topicsIdentified,
    };
  });

  const totalPagesInScope = Array.from(new Set(scopedRows.map((r) => r.page_number))).length;

  return {
    textbookId: resolvedTextbookId,
    bookName: resolvedBookName,
    scope,
    term: resolvedTerm,
    totalPagesInScope,
    totalLessonsInScope: discoveredLessons.length,
    lessons: discoveredLessons,
  };
}
