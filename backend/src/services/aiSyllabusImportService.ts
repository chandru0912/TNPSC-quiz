/**
 * aiSyllabusImportService.ts
 *
 * Full-Stack AI & Structural Syllabus PDF Extraction, Structuring, Deduplication, and Publishing.
 * Supports TNPSC Group 1, Group 2, Group 2A, and Group 4.
 *
 * Workflow:
 * 1. Extract raw text from uploaded syllabus PDF (pdf-parse + text cleaning + Tamil unicode normalization).
 * 2. Structure syllabus using active AI provider (Gemini / Claude).
 * 3. Graceful fallback: If AI provider is rate-limited or lacks credits, uses the Authoritative
 *    TNPSC Structural Syllabus Parser to extract Units, Lessons, Topics, and Standards reliably.
 * 4. Compare with existing database hierarchy to prevent duplicates and detect differences.
 * 5. Returns structured draft for Admin Review (Review, Edit, Regenerate, Approve).
 * 6. Commit approved syllabus into PostgreSQL (syllabus_units, syllabus_lessons, syllabus_topics).
 */

import pool from '../db';
import { getPdfParseClass, cleanText, isScannedText } from './pdfProcessor';
import { cleanTamilUnicodeText } from './tamilUnicodeCleaner';
import { AIProviderFactory } from './ai/ai-provider.factory';
import { AIProviderConfigService } from './ai/ai-provider-config.service';

export interface ExtractedTopicDraft {
  topic_name: string;
  description?: string;
  display_order: number;
}

export interface ExtractedLessonDraft {
  lesson_number: string;
  title: string;
  standard_number: number;
  term?: string;
  description?: string;
  topics: ExtractedTopicDraft[];
}

export interface ExtractedUnitDraft {
  unit_number: number;
  unit_code: string;
  title: string;
  standard_number: number;
  term?: string;
  subject_slug?: string;
  subject_name?: string;
  standard_reference?: string;
  description?: string;
  question_count?: number;
  is_existing?: boolean;
  selected_for_publish?: boolean;
  lessons: ExtractedLessonDraft[];
}

export interface SyllabusAnalysisResult {
  exam_id: string;
  exam_name: string;
  subject_slug: string;
  subject_name: string;
  total_units: number;
  total_lessons: number;
  total_topics: number;
  extracted_text_preview: string;
  parsing_mode: 'ai_cloud' | 'structural_parser';
  units: ExtractedUnitDraft[];
  existing_comparison: {
    existing_units_count: number;
    new_units_count: number;
    duplicate_units: string[];
  };
}

const ROMAN_NUMERAL_MAP: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  xi: 11,
  xii: 12,
  xiii: 13,
  xiv: 14,
  xv: 15,
  xvi: 16,
  xvii: 17,
  xviii: 18,
  xix: 19,
  xx: 20,
  xxi: 21,
  xxii: 22,
  xxiii: 23,
  xxiv: 24,
  xxv: 25,
};

const TAMIL_NUMERAL_MAP: Record<string, number> = {
  '௧': 1,
  '௨': 2,
  '௩': 3,
  '௪': 4,
  '௫': 5,
  '௬': 6,
  '௭': 7,
  '௮': 8,
  '௯': 9,
  '௰': 10,
};

export class AISyllabusImportService {
  /**
   * Robustly parses any unit number or representation (e.g. 1, "1", "Unit 2", "Unit II", "IV", "அலகு 3").
   * Returns a normalized positive integer `num` and formatted display code `code` (e.g. "Unit 1").
   */
  static parseUnitNumber(val: any, fallbackIdx: number): { num: number; code: string } {
    if (typeof val === 'number' && !isNaN(val) && val > 0) {
      return { num: Math.floor(val), code: `Unit ${Math.floor(val)}` };
    }

    if (typeof val === 'string') {
      const s = val.trim();
      // Direct decimal integer: "1", "02"
      const directNum = parseInt(s, 10);
      if (!isNaN(directNum) && directNum > 0 && String(directNum) === s) {
        return { num: directNum, code: `Unit ${directNum}` };
      }

      // Prefix match: "Unit 1", "UNIT-2", "அலகு 3"
      const matchPrefixNum = s.match(/(?:Unit|UNIT|அலகு|Unit\s*No\.?|Unit\s*#)?\s*[-–:]?\s*(\d+)/i);
      if (matchPrefixNum && matchPrefixNum[1]) {
        const n = parseInt(matchPrefixNum[1], 10);
        if (!isNaN(n) && n > 0) {
          return { num: n, code: `Unit ${n}` };
        }
      }

      // Roman numerals: "Unit I", "Unit IV", "III"
      const matchRoman = s.match(/(?:Unit|UNIT|அலகு)?\s*[-–:]?\s*([ivxlcdm]+)$/i);
      if (matchRoman && matchRoman[1]) {
        const romanKey = matchRoman[1].toLowerCase();
        if (ROMAN_NUMERAL_MAP[romanKey]) {
          const n = ROMAN_NUMERAL_MAP[romanKey];
          return { num: n, code: `Unit ${matchRoman[1].toUpperCase()}` };
        }
      }

      // Tamil numerals: "௧", "௨"
      for (const [tChar, tNum] of Object.entries(TAMIL_NUMERAL_MAP)) {
        if (s.includes(tChar)) {
          return { num: tNum, code: `Unit ${tNum}` };
        }
      }
    }

    const fallback = Math.max(1, fallbackIdx);
    return { num: fallback, code: `Unit ${fallback}` };
  }

  /**
   * Extract text from PDF buffer
   */
  static async extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
    try {
      const PDFParseClass = getPdfParseClass();
      const parser = new PDFParseClass({ data: pdfBuffer });
      const parseResult = await parser.getText();
      const rawText = typeof parseResult === 'string' ? parseResult : parseResult?.text || '';
      const cleaned = cleanTamilUnicodeText(cleanText(rawText));

      if (cleaned.length < 50 && isScannedText(rawText)) {
        console.warn('[AISyllabus] Minimal native text detected in PDF');
      }

      return cleaned;
    } catch (err: any) {
      console.error('[AISyllabus] PDF extraction failed:', err);
      throw new Error(`Failed to extract text from syllabus PDF: ${err.message}`);
    }
  }

  /**
   * Helper to parse and structure topics and titles under a single lesson block.
   * Primary delimiters in TNPSC syllabi are spaced hyphens, em/en-dashes, semicolons, bullets, or newlines.
   * Commas are respected as delimiters when no hyphens exist (e.g. lists of compounds or subjects).
   */
  static parseLessonTopics(lessonText: string): {
    title: string;
    topics: ExtractedTopicDraft[];
  } {
    // Primary delimiters: spaced hyphens/dashes, em/en dashes, semicolons, bullets, or newlines.
    // Preserves hyphenated words like "socio-economic", "non-cooperation", "inter-state".
    let parts = lessonText
      .split(/(?:\s+[-–—]\s*|\s*[-–—]\s+|[–—•;]|\n)/)
      .map((t) => t.trim().replace(/^[,.]+|[,.]+$/g, ''))
      .filter((t) => t.length > 2);

    // If there are no hyphen delimiters, check if it's a comma-separated list
    // e.g. "Elements and Compounds, Acids, Bases, Salts, Petroleum Products, Fertilizers, Pesticides"
    if (parts.length === 1 && parts[0].includes(',')) {
      const commaParts = parts[0]
        .split(',')
        .map((c) => c.trim().replace(/^[,.]+|[,.]+$/g, ''))
        .filter((c) => c.length > 2);
      if (commaParts.length > 1) {
        parts = commaParts;
      }
    }

    // Deduplicate preserving sequence
    const seen = new Set<string>();
    const cleanTopics: string[] = [];
    for (const p of parts) {
      if (!seen.has(p)) {
        seen.add(p);
        cleanTopics.push(p);
      }
    }

    let title = cleanTopics[0] || 'Lesson';
    if (title.length > 60 && title.includes(',')) {
      title = title.split(',')[0].trim();
    }

    return {
      title,
      topics: cleanTopics.map((top, idx) => ({
        topic_name: top,
        display_order: idx + 1,
      })),
    };
  }

  /**
   * Authoritative Structural Parser for TNPSC Syllabus text.
   * Accurately parses Units, Modules, and Topics when external AI APIs are unreachable or offline.
   */
  static parseSyllabusStructurally(
    syllabusText: string,
    cleanExamId: string,
    subjectSlug?: string,
    targetStandard?: number | 'all'
  ): {
    examName: string;
    subjectName: string;
    subjectSlug: string;
    units: ExtractedUnitDraft[];
  } {
    const lines = syllabusText.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Detect Exam Name
    let examName = 'TNPSC Examination';
    if (cleanExamId === 'group1') examName = 'TNPSC Group 1';
    else if (cleanExamId === 'group2' || cleanExamId === 'group2a') examName = 'TNPSC Group 2, 2A';
    else if (cleanExamId === 'group4') examName = 'TNPSC Group 4';

    for (const line of lines.slice(0, 15)) {
      if (/Group\s*[-–I]+(?:\s*and\s*[-–IIA]+)?/i.test(line)) {
        examName = line.replace(/^(?:Combined Civil Services|Examination|Notification)[\s–-]*/i, '').trim() || examName;
        break;
      }
    }

    // 2. Identify Subject Scope & Universal Mode
    const isUniversalAll = !subjectSlug || subjectSlug === 'all' || subjectSlug === 'auto';
    const targetSubSlug = isUniversalAll ? 'all' : subjectSlug;
    let subjectName = isUniversalAll ? 'Complete Syllabus (All Units)' : 'General Studies';
    if (targetSubSlug === 'aptitude') subjectName = 'Aptitude and Mental Ability';
    else if (targetSubSlug === 'general-tamil') subjectName = 'General Tamil';
    else if (targetSubSlug === 'general-english') subjectName = 'General English';

    // 3. Parse Unit Headings and Content across ALL sections and pages
    const unitRegex = /^(?:Part\s*[-–:]?\s*[A-D]\s*[:–-]\s*)?(?:Unit|UNIT|அலகு)\s*[-–:]?\s*([IVXLCDM\d]+|[௧-௰\d]+)\s*[:–-]?\s*(.*)$/i;

    interface RawUnitBlock {
      rawNum: string;
      title: string;
      part: string;
      standard: number;
      term: string;
      lines: string[];
    }

    const unitBlocks: RawUnitBlock[] = [];
    let currentBlock: RawUnitBlock | null = null;
    let currentPart = 'A';
    const hasExplicitParts = lines.some((l) => /^Part\s*[-–:]?\s*[A-D]/i.test(l));

    let currentStandard: number = typeof targetStandard === 'number' && targetStandard >= 6 && targetStandard <= 12
      ? targetStandard
      : (cleanExamId === 'group4' ? 10 : 11);
    let currentTerm = 'Term 1';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for Class / Standard heading
      const classMatch = line.match(/(?:(?:Class|Standard|Std|வகுப்பு)\s*[-–:]?\s*(\d{1,2})|(\d{1,2})(?:th|st|nd|rd)\s*(?:Class|Standard|Std|வகுப்பு)?)/i);
      if (classMatch) {
        const stdVal = parseInt(classMatch[1] || classMatch[2], 10);
        if (!isNaN(stdVal) && stdVal >= 6 && stdVal <= 12) {
          if (targetStandard === 'all' || !targetStandard || targetStandard === stdVal) {
            currentStandard = stdVal;
          }
        }
      }

      // Check for Term heading
      const termMatch = line.match(/(?:Term|பருவம்|Semester)\s*[-–:]?\s*([123]|I{1,3})/i);
      if (termMatch) {
        const tVal = termMatch[1].toUpperCase();
        currentTerm = `Term ${tVal === 'I' ? 1 : tVal === 'II' ? 2 : tVal === 'III' ? 3 : tVal}`;
      }

      const partMatch = line.match(/^Part\s*[-–:]?\s*([A-D])/i);
      if (partMatch) {
        currentPart = partMatch[1].toUpperCase();
      }

      // If a specific single subject was explicitly requested, filter to that section
      if (hasExplicitParts && !isUniversalAll) {
        if (targetSubSlug === 'general-studies' && currentPart !== 'A') {
          currentBlock = null;
          continue;
        } else if (targetSubSlug === 'aptitude' && currentPart !== 'B') {
          currentBlock = null;
          continue;
        } else if ((targetSubSlug === 'general-tamil' || targetSubSlug === 'general-english') && currentPart !== 'C') {
          currentBlock = null;
          continue;
        }
      }

      const match = line.match(unitRegex);

      if (match) {
        const rawNum = match[1].trim();
        let title = match[2].trim();

        // If title is on the subsequent line
        if (!title && i + 1 < lines.length && !lines[i + 1].match(unitRegex) && !lines[i + 1].match(/^Part\s*[-–:]?\s*[A-D]/i) && !lines[i + 1].match(/(?:Class|Standard|Std|வகுப்பு)\s*[-–:]?\s*\d+/i)) {
          title = lines[i + 1].trim();
          i++; // skip next line since consumed as title
        }

        if (!title) {
          title = `Unit ${rawNum}`;
        }

        // Strip trailing question counts like "(10 Questions)" from the title
        title = title.replace(/\s*\(\d+\s*Questions?\)\s*$/i, '').trim();

        currentBlock = {
          rawNum,
          title,
          part: currentPart,
          standard: currentStandard,
          term: currentTerm,
          lines: [],
        };
        unitBlocks.push(currentBlock);
      } else if (currentBlock) {
        // Collect body lines belonging to current unit
        currentBlock.lines.push(line);
      }
    }

    // 4. Construct Lessons & Topics under each Unit
    const units: ExtractedUnitDraft[] = [];
    const seqMap = new Map<number, number>();

    for (const b of unitBlocks) {
      if (typeof targetStandard === 'number' && b.standard !== targetStandard) {
        continue;
      }

      const prevSeq = seqMap.get(b.standard) || 1;
      let unitNum = parseInt(b.rawNum, 10);
      if (isNaN(unitNum)) {
        unitNum = ROMAN_NUMERAL_MAP[b.rawNum.toLowerCase()] || TAMIL_NUMERAL_MAP[b.rawNum] || prevSeq;
      }
      seqMap.set(b.standard, unitNum + 1);

      // Determine subject domain
      let unitSubjectSlug = 'general-studies';
      let unitSubjectName = 'General Studies';
      let standardRef = `Class ${b.standard} Standard`;

      if (!isUniversalAll) {
        unitSubjectSlug = targetSubSlug;
        unitSubjectName = subjectName;
      } else {
        if (b.part === 'B' || /aptitude|mental\s*ability|reasoning|திறனறிவு/i.test(b.title)) {
          unitSubjectSlug = 'aptitude';
          unitSubjectName = 'Aptitude and Mental Ability';
        } else if (b.part === 'C' && /english|grammar|vocabulary|writing\s*skills|translation|literary/i.test(b.title)) {
          unitSubjectSlug = 'general-english';
          unitSubjectName = 'General English';
        } else if (
          b.part === 'C' ||
          /பொதுத்\s*தமிழ்|இலக்கணம்|இலக்கியம்|கவிதை|உரைநடை|அறிஞர்கள்/i.test(b.title) ||
          (/tamil|தமிழ்/i.test(b.title) && !/tamil\s*nadu/i.test(b.title))
        ) {
          unitSubjectSlug = 'general-tamil';
          unitSubjectName = 'General Tamil';
        } else if (/english|grammar|literature|comprehension/i.test(b.title)) {
          unitSubjectSlug = 'general-english';
          unitSubjectName = 'General English';
        }
      }

      // Check for inline standard indicators
      const allUnitText = b.title + ' ' + b.lines.slice(0, 5).join(' ');
      if (/SSLC\s*Standard/i.test(allUnitText)) {
        b.standard = 10;
        standardRef = 'SSLC Standard (Class 10)';
      } else if (/Degree\s*Standard/i.test(allUnitText)) {
        b.standard = 11;
        standardRef = 'Degree Standard (Degree/HSC)';
      } else if (/HSC\s*Standard|Higher\s*Secondary/i.test(allUnitText)) {
        b.standard = 12;
        standardRef = 'Higher Secondary (Class 12)';
      }

      // Extract question count if present in raw text
      let questionCount = 15;
      const joinedText = b.lines.join(' ');
      const qMatch = (b.title + ' ' + joinedText).match(/(\d+)\s*Questions?/i);
      if (qMatch) {
        questionCount = parseInt(qMatch[1], 10);
      }

      // Break unit text into distinct lessons
      const lessons: ExtractedLessonDraft[] = [];
      const fullUnitBody = b.lines.join('\n');
      const markerRegex = /(?:^|\s)(?:\(([ivxlcdm\d]+|[a-z]|[௧-௰]|[அ-ஔ])\)|(?<=\s|^)([ivxlcdm]+)\.\s+|(?<=\s|^)(\d+)[\.\)]\s+)/gi;

      const markerMatches: { index: number; markerLength: number; rawNum: string }[] = [];
      let mMatch: RegExpExecArray | null;
      while ((mMatch = markerRegex.exec(fullUnitBody)) !== null) {
        const rawNum = (mMatch[1] || mMatch[2] || mMatch[3] || '').trim();
        markerMatches.push({
          index: mMatch.index,
          markerLength: mMatch[0].length,
          rawNum,
        });
      }

      if (markerMatches.length > 0) {
        for (let idx = 0; idx < markerMatches.length; idx++) {
          const cur = markerMatches[idx];
          const start = cur.index + cur.markerLength;
          const end = idx + 1 < markerMatches.length ? markerMatches[idx + 1].index : fullUnitBody.length;
          const lessonRawText = fullUnitBody.slice(start, end).trim();

          const { title, topics } = this.parseLessonTopics(lessonRawText);

          lessons.push({
            lesson_number: cur.rawNum || String(idx + 1),
            title,
            standard_number: b.standard,
            term: b.term,
            description: lessonRawText.slice(0, 160),
            topics: topics.length > 0 ? topics : [{ topic_name: title, display_order: 1 }],
          });
        }
      } else {
        // If no markers matched, inspect lines or major clauses
        const nonBlankLines = b.lines.filter((l) => l.trim().length > 3);
        if (nonBlankLines.length > 1) {
          nonBlankLines.forEach((line, lIdx) => {
            const { title, topics } = this.parseLessonTopics(line);
            lessons.push({
              lesson_number: String(lIdx + 1),
              title,
              standard_number: b.standard,
              term: b.term,
              description: line.slice(0, 160),
              topics: topics.length > 0 ? topics : [{ topic_name: title, display_order: 1 }],
            });
          });
        } else {
          const { title, topics } = this.parseLessonTopics(fullUnitBody);
          lessons.push({
            lesson_number: '1',
            title: title || b.title,
            standard_number: b.standard,
            term: b.term,
            description: `Official TNPSC syllabus topics for ${b.title}`,
            topics: topics.length > 0 ? topics : [{ topic_name: b.title, display_order: 1 }],
          });
        }
      }

      units.push({
        unit_number: unitNum,
        unit_code: `Unit ${b.rawNum}`,
        title: b.title,
        standard_number: b.standard,
        term: b.term,
        subject_slug: unitSubjectSlug,
        subject_name: unitSubjectName,
        standard_reference: standardRef,
        description: `Official TNPSC syllabus for ${b.title}`,
        question_count: questionCount,
        selected_for_publish: true,
        lessons,
      });
    }

    return {
      examName,
      subjectName,
      subjectSlug: targetSubSlug,
      units,
    };
  }

  /**
   * Universal Syllabus Analysis: Supports both PDF file buffer and direct raw text paste.
   * Uses the same AI extraction engine with authoritative structural parser fallback.
   * Preserves strict hierarchy: TNPSC Group -> Subject -> Unit -> Unit Title -> Lesson -> Topic.
   */
  static async analyzeSyllabus(params: {
    pdfBuffer?: Buffer;
    rawText?: string;
    examId: string;
    subjectId?: string;
    fileName?: string;
    standard?: number | 'all';
  }): Promise<SyllabusAnalysisResult> {
    const { pdfBuffer, rawText, examId, subjectId, fileName, standard } = params;
    const rawExamId = examId.toLowerCase().trim();
    const cleanExamId = rawExamId === 'group2a' ? 'group2' : rawExamId;

    // 1. Obtain syllabus text from either PDF buffer or raw text paste
    let syllabusText = '';
    if (pdfBuffer && pdfBuffer.length > 0) {
      syllabusText = await this.extractTextFromPdf(pdfBuffer);
    } else if (rawText && typeof rawText === 'string') {
      syllabusText = cleanTamilUnicodeText(cleanText(rawText));
    }

    if (!syllabusText || syllabusText.trim().length < 30) {
      throw new Error(
        'Syllabus content is empty or too short. Please provide a valid TNPSC syllabus PDF or paste syllabus text.'
      );
    }

    // 2. Load existing units in database for comparison & deduplication
    const existingUnitsRes = await pool.query(
      'SELECT unit_number, unit_code, title FROM syllabus_units WHERE exam_id = $1 AND is_active = true',
      [cleanExamId]
    );
    const existingUnitMap = new Map<number, string>();
    existingUnitsRes.rows.forEach((r) => {
      existingUnitMap.set(r.unit_number, r.title);
    });

    let rawUnits: ExtractedUnitDraft[] = [];
    let detectedExamName = cleanExamId.toUpperCase();
    let detectedSubSlug = subjectId || 'general-studies';
    let detectedSubName = 'General Studies';
    let parsingMode: 'ai_cloud' | 'structural_parser' = 'ai_cloud';

    // 3. Try AI Structured Extraction first (only if active provider is configured and available)
    try {
      const aiProvider = await AIProviderFactory.getActiveProvider();
      const statusInfo = await AIProviderConfigService.getProviderStatus(aiProvider.name).catch(() => null);

      if (statusInfo && (statusInfo.status === 'BILLING_REQUIRED' || statusInfo.status === 'OFFLINE' || statusInfo.status === 'MODEL_NOT_AVAILABLE')) {
        console.log(`[AISyllabus] AI provider (${aiProvider.name}) status is "${statusInfo.status}". Using Authoritative Structural Syllabus Parser directly.`);
      } else {
        console.log(`[AISyllabus] Invoking AI Provider (${aiProvider.name}) for ${cleanExamId}...`);

        const systemPrompt = `You are an authoritative TNPSC Examination Syllabus Architect.
Parse official TNPSC syllabus documents into an exact structured JSON format.

CRITICAL EXTRACTION REQUIREMENTS:
1. Extract all Units (Unit 1, Unit 2... or Unit I, Unit II...) with their EXACT official title.
2. LESSON DETECTION: Each Roman numeral, number, or sub-item (e.g. (i), (ii), (iii), 1., 2., a., b.) MUST be extracted as a SEPARATE Lesson object in the unit's 'lessons' array.
3. NEVER merge multiple (i), (ii) subheadings into one giant lesson.
4. TOPIC ISOLATION: Each lesson must have its own 'topics' array containing strictly the syllabus topics belonging to that specific lesson. Do NOT leak or mix topics between lessons.
5. The lesson title should be the main topic / sub-heading (e.g. "Scientific Knowledge and Scientific Temper", "Nature of Universe", "Elements and Compounds", "Main concepts of Life Science").
6. Maintain the exact sequence: TNPSC Group -> Subject -> Unit -> Unit Title -> Lesson -> Topic.
7. Assign standard_number (10 for SSLC, 11/12 for Degree) and Term ("Term 1").

Return strictly JSON matching this schema:
{
  "exam_id": "${cleanExamId}",
  "exam_name": "Official Exam Name",
  "subject_slug": "${detectedSubSlug}",
  "subject_name": "${detectedSubName}",
  "units": [
    {
      "unit_number": 1,
      "unit_code": "Unit I",
      "title": "Exact Unit Title",
      "description": "Scope description",
      "question_count": 15,
      "lessons": [
        {
          "lesson_number": "1",
          "title": "Lesson Title",
          "standard_number": 10,
          "term": "Term 1",
          "description": "Summary",
          "topics": ["Topic 1", "Topic 2", "Topic 3"]
        }
      ]
    }
  ]
}`;

        const textSample = syllabusText.slice(0, 45000);
        const userPrompt = `Parse the following official TNPSC syllabus for "${cleanExamId}":
Source: ${fileName || 'pasted_text_input'}

--- SYLLABUS CONTENT ---
${textSample}
--- END CONTENT ---`;

        const rawPromise = aiProvider.generateJson<any>(
          `${systemPrompt}\n\n${userPrompt}`,
          {
            responseFormat: 'json',
            temperature: 0.1,
            maxTokens: 8000,
          }
        );

        // Safeguard against unhandled rejection if timeout triggers first
        const safeAiPromise = rawPromise.catch((err) => {
          console.warn('[AISyllabus] Background AI provider error:', err?.message || err);
          return null;
        });

        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => {
            console.warn('[AISyllabus] AI provider call timed out (5s), switching to Authoritative Structural Parser');
            resolve(null);
          }, 5000)
        );

        const aiParsed = await Promise.race([safeAiPromise, timeoutPromise]);

        if (aiParsed && Array.isArray(aiParsed.units) && aiParsed.units.length > 0) {
          detectedExamName = aiParsed.exam_name || detectedExamName;
          detectedSubSlug = aiParsed.subject_slug || detectedSubSlug;
          detectedSubName = aiParsed.subject_name || detectedSubName;
          rawUnits = aiParsed.units;
          parsingMode = 'ai_cloud';
        }
      }
    } catch (aiErr: any) {
      console.warn(
        `[AISyllabus] AI cloud call skipped or unavailable (${aiErr.message}). Activating Authoritative Structural Syllabus Parser...`
      );
    }

    // 4. Fallback to Structural Syllabus Parser if AI returned empty or failed
    if (rawUnits.length === 0) {
      console.log('[AISyllabus] Running Structural Syllabus Parser...');
      const structural = this.parseSyllabusStructurally(syllabusText, cleanExamId, subjectId, standard);
      detectedExamName = structural.examName;
      detectedSubSlug = structural.subjectSlug;
      detectedSubName = structural.subjectName;
      rawUnits = structural.units;
      parsingMode = 'structural_parser';
    }

    if (rawUnits.length === 0) {
      throw new Error(
        'Could not identify any syllabus units in the provided content. Please verify this contains an official TNPSC syllabus with Units and Lessons.'
      );
    }

    // 5. Correlate with existing database units to detect duplicates and count stats
    const duplicateUnits: string[] = [];
    let totalLessons = 0;
    let totalTopics = 0;

    const formattedUnits: ExtractedUnitDraft[] = rawUnits.map((u: any, uIdx: number) => {
      const parsedNum = AISyllabusImportService.parseUnitNumber(u.unit_number || u.unit_code, uIdx + 1);
      const unitNum = parsedNum.num;
      const unitCode = u.unit_code && typeof u.unit_code === 'string' && u.unit_code.trim().length > 0
        ? u.unit_code.trim()
        : parsedNum.code;
      const isExisting = existingUnitMap.has(unitNum);
      if (isExisting) {
        duplicateUnits.push(`Unit ${unitNum}: "${existingUnitMap.get(unitNum)}"`);
      }

      const unitStd = typeof u.standard_number === 'number' && u.standard_number >= 6 && u.standard_number <= 12
        ? u.standard_number
        : (typeof standard === 'number' && standard >= 6 && standard <= 12 ? standard : (cleanExamId === 'group4' ? 10 : 11));
      const unitTerm = u.term || 'Term 1';

      const lessons: ExtractedLessonDraft[] = (u.lessons || []).map((l: any, lIdx: number) => {
        const rawTopics = Array.isArray(l.topics) ? l.topics : [];
        const formattedTopics: ExtractedTopicDraft[] = rawTopics.map((t: any, tIdx: number) => ({
          topic_name: typeof t === 'string' ? t.trim() : t.topic_name || `Topic ${tIdx + 1}`,
          description: typeof t === 'object' ? t.description : undefined,
          display_order: tIdx + 1,
        }));

        totalTopics += formattedTopics.length;
        totalLessons++;

        const lessonStd = typeof l.standard_number === 'number' && l.standard_number >= 6 && l.standard_number <= 12
          ? l.standard_number
          : unitStd;

        return {
          lesson_number: l.lesson_number || `${unitNum}.${lIdx + 1}`,
          title: l.title || `Lesson ${lIdx + 1}`,
          standard_number: lessonStd,
          term: l.term || unitTerm,
          description: l.description || '',
          topics: formattedTopics,
        };
      });

      return {
        unit_number: unitNum,
        unit_code: unitCode,
        title: u.title || `Unit ${unitNum}`,
        standard_number: unitStd,
        term: unitTerm,
        subject_slug: u.subject_slug || detectedSubSlug,
        subject_name: u.subject_name || detectedSubName,
        standard_reference: u.standard_reference || `Class ${unitStd} Standard`,
        description: u.description || '',
        question_count: parseInt(u.question_count, 10) || 15,
        is_existing: isExisting,
        selected_for_publish: true,
        lessons,
      };
    });

    return {
      exam_id: cleanExamId,
      exam_name: detectedExamName,
      subject_slug: detectedSubSlug,
      subject_name: detectedSubName,
      total_units: formattedUnits.length,
      total_lessons: totalLessons,
      total_topics: totalTopics,
      extracted_text_preview: syllabusText.slice(0, 1000) + '...',
      parsing_mode: parsingMode,
      units: formattedUnits,
      existing_comparison: {
        existing_units_count: duplicateUnits.length,
        new_units_count: formattedUnits.length - duplicateUnits.length,
        duplicate_units: duplicateUnits,
      },
    };
  }

  /**
   * Process Syllabus PDF (backward-compatible wrapper around analyzeSyllabus)
   */
  static async analyzeSyllabusPdf(params: {
    pdfBuffer: Buffer;
    examId: string;
    subjectId?: string;
    fileName?: string;
    standard?: number | 'all';
  }): Promise<SyllabusAnalysisResult> {
    return this.analyzeSyllabus(params);
  }

  /**
   * Publish Approved Syllabus into PostgreSQL database
   */
  static async publishApprovedSyllabus(params: {
    examId: string;
    subjectSlug: string;
    subjectName?: string;
    units: ExtractedUnitDraft[];
    overwriteExisting?: boolean;
  }): Promise<{
    success: boolean;
    unitsSaved: number;
    lessonsSaved: number;
    topicsSaved: number;
    message: string;
  }> {
    const { examId, subjectSlug, subjectName, units, overwriteExisting } = params;
    const rawExamId = examId.toLowerCase().trim();
    const cleanExamId = rawExamId === 'group2a' ? 'group2' : rawExamId;
    const cleanSubSlug = subjectSlug.toLowerCase().trim();

    const client = await pool.connect();
    let unitsSaved = 0;
    let lessonsSaved = 0;
    let topicsSaved = 0;

    try {
      await client.query('BEGIN');

      // 1. Ensure Subject exists in syllabus_subjects
      const baseSubSlug = cleanSubSlug !== 'all' ? cleanSubSlug : 'general-studies';
      const subjectPk = `${cleanExamId}-${baseSubSlug}`;
      await client.query(
        `INSERT INTO syllabus_subjects (id, exam_id, subject_slug, name, display_order)
         VALUES ($1, $2, $3, $4, 1)
         ON CONFLICT (id) DO UPDATE SET
           name = COALESCE(EXCLUDED.name, syllabus_subjects.name)`,
        [subjectPk, cleanExamId, baseSubSlug, subjectName || 'General Studies']
      );

      // 2. Iterate each approved Unit
      for (let uIdx = 0; uIdx < units.length; uIdx++) {
        const u = units[uIdx];
        // Skip unit if excluded by admin
        if (u.selected_for_publish === false) {
          continue;
        }

        const parsedNum = AISyllabusImportService.parseUnitNumber(u.unit_number || u.unit_code, uIdx + 1);
        const unitNum = parsedNum.num;
        const unitCode = u.unit_code && typeof u.unit_code === 'string' && u.unit_code.trim().length > 0
          ? u.unit_code.trim()
          : parsedNum.code;

        const unitSubSlug = (u.subject_slug || baseSubSlug).toLowerCase().trim();
        const unitSubName =
          u.subject_name ||
          (unitSubSlug === 'aptitude'
            ? 'Aptitude and Mental Ability'
            : unitSubSlug.includes('tamil')
            ? 'General Tamil'
            : unitSubSlug.includes('english')
            ? 'General English'
            : 'General Studies');

        // Dynamically ensure the unit's subject exists
        const unitSubPk = `${cleanExamId}-${unitSubSlug}`;
        await client.query(
          `INSERT INTO syllabus_subjects (id, exam_id, subject_slug, name, display_order)
           VALUES ($1, $2, $3, $4, 1)
           ON CONFLICT (id) DO UPDATE SET
             name = COALESCE(EXCLUDED.name, syllabus_subjects.name)`,
          [unitSubPk, cleanExamId, unitSubSlug, unitSubName]
        );

        // Find existing canonical TNPSC parent unit (identified strictly by exam, subject, and unit_number)
        const unitStd = typeof u.standard_number === 'number' && u.standard_number >= 6 && u.standard_number <= 12
          ? u.standard_number
          : (cleanExamId === 'group4' ? 10 : 11);

        let existingUnitRes = await client.query(
          `SELECT id FROM syllabus_units 
           WHERE exam_id = $1 AND subject_id = $2 AND unit_number = $3 AND is_active = true`,
          [cleanExamId, unitSubSlug, unitNum]
        );

        if (existingUnitRes.rows.length === 0) {
          existingUnitRes = await client.query(
            `SELECT id FROM syllabus_units 
             WHERE exam_id = $1 AND subject_id = $2 
               AND (LOWER(unit_code) = LOWER($3) OR LOWER(title) = LOWER($4))
               AND is_active = true
             LIMIT 1`,
            [cleanExamId, unitSubSlug, unitCode, u.title]
          );
        }

        let unitDbId: number;

        if (existingUnitRes.rows.length > 0) {
          // REUSE THE SINGLE PARENT UNIT
          unitDbId = existingUnitRes.rows[0].id;
          if (overwriteExisting) {
            await client.query(
              `UPDATE syllabus_units
               SET title = $1, unit_code = $2, subject_name = $3, description = $4, question_count = $5, updated_at = CURRENT_TIMESTAMP
               WHERE id = $6`,
              [u.title, unitCode, unitSubName, u.description || '', u.question_count || 15, unitDbId]
            );
          }
        } else {
          // Create the single parent unit (parent units hold all standards, standard_number = null)
          const insertUnitRes = await client.query(
            `INSERT INTO syllabus_units (
              exam_id, subject_id, standard_number, unit_number, unit_code, title, subject_name,
              description, question_count, display_order, is_active
            ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, true)
            ON CONFLICT (exam_id, subject_id, unit_number) WHERE is_active = true
            DO UPDATE SET
              title = EXCLUDED.title,
              unit_code = EXCLUDED.unit_code,
              updated_at = CURRENT_TIMESTAMP
            RETURNING id`,
            [
              cleanExamId,
              unitSubSlug,
              unitNum,
              unitCode,
              u.title,
              unitSubName,
              u.description || '',
              u.question_count || 15,
              unitNum,
            ]
          );
          unitDbId = insertUnitRes.rows[0].id;
        }

        unitsSaved++;

        // 3. Iterate Lessons under Unit
        let lessonOrder = 1;
        for (const l of u.lessons) {
          const lessonStd = typeof l.standard_number === 'number' && l.standard_number >= 6 && l.standard_number <= 12
            ? l.standard_number
            : unitStd;
          const safeLessonNum =
            (l.lesson_number || String(lessonOrder)).replace(/[^a-zA-Z0-9]/g, '') || String(lessonOrder);
          const rawSlug = l.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40);
          const titleSlug = rawSlug || `lesson-${lessonOrder}`;
          const lessonId = `${cleanExamId}-${unitSubSlug}-std${lessonStd}-u${unitNum}-l${safeLessonNum}-${titleSlug}`;

          await client.query(
            `INSERT INTO syllabus_lessons (
              id, unit_id, exam_id, subject_id, standard_number, lesson_number,
              title, term, description, status, display_order, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Available', $10, true)
            ON CONFLICT (id) DO UPDATE SET
              unit_id = EXCLUDED.unit_id,
              title = EXCLUDED.title,
              standard_number = EXCLUDED.standard_number,
              term = EXCLUDED.term,
              description = EXCLUDED.description,
              updated_at = CURRENT_TIMESTAMP`,
            [
              lessonId,
              unitDbId,
              cleanExamId,
              unitSubSlug,
              lessonStd,
              l.lesson_number,
              l.title,
              l.term || u.term || 'Term 1',
              l.description || '',
              lessonOrder++,
            ]
          );

          lessonsSaved++;

          // 4. Iterate Topics under Lesson
          let topicOrder = 1;
          for (const t of l.topics) {
            await client.query(
              `INSERT INTO syllabus_topics (
                lesson_id, unit_id, topic_name, description, display_order, is_active
              ) VALUES ($1, $2, $3, $4, $5, true)
              ON CONFLICT (lesson_id, topic_name) DO UPDATE SET
                unit_id = EXCLUDED.unit_id,
                description = COALESCE(EXCLUDED.description, syllabus_topics.description)`,
              [lessonId, unitDbId, t.topic_name, t.description || null, topicOrder++]
            );

            topicsSaved++;
          }
        }
      }

      await client.query('COMMIT');

      return {
        success: true,
        unitsSaved,
        lessonsSaved,
        topicsSaved,
        message: `Successfully saved ${unitsSaved} Units, ${lessonsSaved} Lessons, and ${topicsSaved} Topics into ${cleanExamId.toUpperCase()} syllabus.`,
      };
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[AISyllabus] Failed to publish syllabus:', err);
      throw new Error(`Failed to commit syllabus to database: ${err.message}`);
    } finally {
      client.release();
    }
  }
}
