import crypto from 'crypto';
import {
  getPdfParseClass,
  cleanText,
  isScannedText,
  normalizeTamilPdfText,
} from './pdfProcessor';
import { runGoogleCloudVisionPdfOcr } from './ocrService';

export type AnswerVerificationStatus =
  | 'verified_final'
  | 'verified_revised'
  | 'tentative'
  | 'admin_verified'
  | 'unverified'
  | 'conflict';

export type AnswerKeyTier = 'final' | 'revised' | 'tentative';

export const ANSWER_STATUS_PRIORITY: Record<AnswerVerificationStatus, number> = {
  verified_final: 4,
  verified_revised: 3,
  tentative: 2,
  admin_verified: 1,
  unverified: 0,
  conflict: 0,
};

export function keyTierToAnswerStatus(tier: AnswerKeyTier): AnswerVerificationStatus {
  if (tier === 'final') return 'verified_final';
  if (tier === 'revised') return 'verified_revised';
  return 'tentative';
}

export interface ExtractedPaperQuestion {
  questionNumber: number;
  originalQuestionNumber: string;
  sourcePage: number | null;
  section: string;
  subject: string;
  topic: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string | null;
  correctAnswer: number; // 0=A, 1=B, 2=C, 3=D (-1 if unverified)
  answerVerified: boolean;
  answerStatus: AnswerVerificationStatus;
  answerSource: string | null;
  explanation: string;
  explanationSource: 'none' | 'official' | 'ai_generated' | 'admin';
  isDuplicate: boolean;
  extractionStatus: 'ok' | 'needs_review' | 'failed';
  needsReview: boolean;
  reviewNote: string | null;
  hasDiagramHint: boolean;
  medium: string;
}

export interface ParsedAnswerKeyResult {
  answers: Map<number, number>;
  detectedKeyType: AnswerKeyTier | null;
  detectedBookletSeries: string[];
  detectedYear: number | null;
  detectedPaperCode: string | null;
  extractionMethod: 'pdf_text' | 'ocr_vision' | 'text';
  rawEntriesCount: number;
}

export interface PdfExtractionResult {
  questions: ExtractedPaperQuestion[];
  extractionMethod:
    | 'pdf_text'
    | 'pdf_text_tamil_normalized'
    | 'ocr_vision'
    | 'ocr_hybrid'
    | 'scanned_flagged';
  pageCount: number;
  rawCharCount: number;
  expectedCount: number;
  extractedCount: number;
  failedExtractionCount: number;
  missingQuestionNumbers: number[];
  duplicateCount: number;
  flaggedCount: number;
  matchedAnswerKeysCount: number;
  unverifiedAnswerCount: number;
  conflictCount: number;
  answerKeyMeta: {
    keyType: AnswerKeyTier | null;
    bookletCode: string | null;
    totalKeysParsed: number;
  };
  warnings: string[];
}

export function computeBufferSha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const DIAGRAM_CUES_REGEX =
  /\b(diagram|figure|fig\.|chart|graph|table|map|match\s+the\s+following|match\s+list|given\s+below|shown\s+below|flow\s*chart)\b|படம்|அட்டவணை|பொருத்துக|வரைபடம்/i;

const SECTION_HEADER_REGEX =
  /(?:^|\n)\s*(?:PART\s*[-–:]?\s*[A-Z1-4]+[^\n]{0,60}|SECTION\s*[-–:]?\s*[A-Z1-4]+[^\n]{0,60}|GENERAL\s+(?:STUDIES|TAMIL|ENGLISH|SCIENCE)[^\n]{0,40}|APTITUDE\s+AND\s+MENTAL\s+ABILITY[^\n]{0,40}|பகுதி\s*[-–:]?\s*[அஆஇஈA-Z1-4]+[^\n]{0,60}|பொதுத்தமிழ்[^\n]{0,40}|பொது\s*அறிவு[^\n]{0,40}|திறனறிவு[^\n]{0,40})/gi;

export function letterToOptionIndex(raw: string): number | null {
  const s = raw.trim().toUpperCase();
  if (s === 'A' || s === '1' || s === 'அ') return 0;
  if (s === 'B' || s === '2' || s === 'ஆ') return 1;
  if (s === 'C' || s === '3' || s === 'இ') return 2;
  if (s === 'D' || s === '4' || s === 'ஈ') return 3;
  return null;
}

function normalizeForDuplicateCheck(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectAnswerKeyTierFromText(rawText: string, filename?: string): AnswerKeyTier | null {
  const combined = `${filename || ''} ${rawText.slice(0, 1200)}`.toLowerCase();
  if (/\bfinal\s*(?:answer\s*)?key\b|இறுதி\s*விடைக்குறிப்பு/i.test(combined)) return 'final';
  if (/\brevised\s*(?:answer\s*)?key\b|திருத்தப்பட்ட\s*விடைக்குறிப்பு/i.test(combined)) return 'revised';
  if (/\btentative\s*(?:answer\s*)?key\b|தற்காலிக\s*விடைக்குறிப்பு/i.test(combined)) return 'tentative';
  return null;
}

/**
 * Extracts official answer key mappings (questionNumber -> optionIndex 0..3)
 * supporting both single-series and multi-series (Booklet A / B / C / D) TNPSC answer key formats.
 */
export function parseAnswerKeyText(
  rawText: string,
  options?: { bookletCode?: string | null; filename?: string }
): Map<number, number> {
  return parseOfficialAnswerKeyText(rawText, options).answers;
}

export function parseOfficialAnswerKeyText(
  rawText: string,
  options?: { bookletCode?: string | null; filename?: string }
): ParsedAnswerKeyResult {
  const map = new Map<number, number>();
  const detectedKeyType = detectAnswerKeyTierFromText(rawText || '', options?.filename);
  const yearMatch = (rawText || '').slice(0, 1000).match(/\b(20[0-3]\d|199\d)\b/);
  const detectedYear = yearMatch ? Number(yearMatch[1]) : null;
  const codeMatch = (rawText || '').slice(0, 1000).match(/(?:paper\s*code|subject\s*code|code)\s*[:\-]?\s*([A-Z0-9\-/]{2,20})/i);
  const detectedPaperCode = codeMatch ? codeMatch[1].trim() : null;

  if (!rawText || !rawText.trim()) {
    return {
      answers: map,
      detectedKeyType,
      detectedBookletSeries: [],
      detectedYear,
      detectedPaperCode,
      extractionMethod: 'text',
      rawEntriesCount: 0,
    };
  }

  const normalized = normalizeTamilPdfText(cleanText(rawText));
  const targetBooklet = (options?.bookletCode || '').trim().toUpperCase().replace(/[^A-D]/g, '');

  // 1. Try multi-series booklet table rows: e.g. "1   A   C   B   D" (QNo | Series A | Series B | Series C | Series D)
  const detectedSeries: string[] = [];
  const headerSeriesMatch = normalized.match(
    /(?:Q\.?\s*No\.?|Question\s*No\.?)\s+(?:Series\s*)?([A-D])\s+(?:Series\s*)?([A-D])\s+(?:Series\s*)?([A-D])\s+(?:Series\s*)?([A-D])/i
  );
  if (headerSeriesMatch) {
    detectedSeries.push(
      headerSeriesMatch[1].toUpperCase(),
      headerSeriesMatch[2].toUpperCase(),
      headerSeriesMatch[3].toUpperCase(),
      headerSeriesMatch[4].toUpperCase()
    );
    const chosenCol = targetBooklet ? detectedSeries.indexOf(targetBooklet) : 0;
    const colIdx = chosenCol >= 0 ? chosenCol : 0;

    const tableRowRegex =
      /(?:^|\n)\s*(\d{1,3})\s+\(?\s*([A-Da-dஅஆஇஈ])\s*\)?\s+\(?\s*([A-Da-dஅஆஇஈ])\s*\)?\s+\(?\s*([A-Da-dஅஆஇஈ])\s*\)?\s+\(?\s*([A-Da-dஅஆஇஈ])\s*\)?/gm;
    let tm: RegExpExecArray | null;
    while ((tm = tableRowRegex.exec(normalized)) !== null) {
      const qNum = Number(tm[1]);
      const chosenLetter = tm[2 + colIdx];
      const optIdx = letterToOptionIndex(chosenLetter);
      if (qNum >= 1 && qNum <= 300 && optIdx !== null && !map.has(qNum)) {
        map.set(qNum, optIdx);
      }
    }
  }

  // 2. If booklet-specific section exists (e.g. "BOOKLET SERIES B ..."), narrow to that section if requested
  let workingText = normalized;
  if (map.size < 5 && targetBooklet) {
    const sectionPat = new RegExp(
      `(?:BOOKLET|SERIES|SET)\\s*(?:CODE\\s*)?[:\\-]?\\s*${targetBooklet}\\b([\\s\\S]*?)(?=(?:BOOKLET|SERIES|SET)\\s*(?:CODE\\s*)?[:\\-]?\\s*[A-D]\\b|$)`,
      'i'
    );
    const secMatch = normalized.match(sectionPat);
    if (secMatch && secMatch[1] && secMatch[1].length > 30) {
      workingText = secMatch[1];
      if (!detectedSeries.includes(targetBooklet)) detectedSeries.push(targetBooklet);
    }
  }

  // 3. Standard pair matching: "1. A", "1) (B)", "Q.1 - C", "001 : D", "12 (அ)", "45 B"
  if (map.size < 5) {
    const pairRegex =
      /(?:^|[\s,;|])(?:Q\.?\s*)?(\d{1,3})\s*(?:[.)\-:\]]|\s+)\s*\(?\s*([A-Da-dஅஆஇஈ])\s*\)?(?=$|[\s,;|])/gm;
    let m: RegExpExecArray | null;
    while ((m = pairRegex.exec(workingText)) !== null) {
      const qNum = Number(m[1]);
      const optIdx = letterToOptionIndex(m[2]);
      if (qNum >= 1 && qNum <= 300 && optIdx !== null && !map.has(qNum)) {
        map.set(qNum, optIdx);
      }
    }
  }

  return {
    answers: map,
    detectedKeyType,
    detectedBookletSeries: detectedSeries,
    detectedYear,
    detectedPaperCode,
    extractionMethod: 'text',
    rawEntriesCount: map.size,
  };
}

export async function extractTextWithPagesFromPdf(
  pdfBuffer: Buffer
): Promise<{ fullText: string; pageTexts: { page: number; text: string }[]; pageCount: number }> {
  const PDFParseClass = getPdfParseClass();
  let parser: any = null;
  try {
    parser = new PDFParseClass({ data: pdfBuffer });
    const result = await parser.getText();
    const pages: { page: number; text: string }[] = [];

    if (Array.isArray(result?.pages) && result.pages.length > 0) {
      for (let i = 0; i < result.pages.length; i++) {
        const p = result.pages[i];
        const pNum = Number(p?.num || i + 1);
        const pText = String(p?.text || '');
        pages.push({ page: pNum, text: pText });
      }
    }

    const fullText =
      typeof result?.text === 'string' && result.text.trim().length > 0
        ? result.text
        : pages.map((p) => p.text).join('\n\n');

    const pageCount = Number(result?.total || result?.numpages || pages.length || 1);

    if (pages.length === 0 && fullText) {
      pages.push({ page: 1, text: fullText });
    }

    return { fullText, pageTexts: pages, pageCount };
  } finally {
    if (parser && typeof parser.destroy === 'function') {
      await parser.destroy().catch(() => {});
    }
  }
}

export async function parseOfficialAnswerKeyPdf(
  pdfBuffer: Buffer,
  options?: { bookletCode?: string | null; filename?: string }
): Promise<ParsedAnswerKeyResult> {
  const { fullText, pageCount } = await extractTextWithPagesFromPdf(pdfBuffer);
  let effectiveText = fullText;
  let extractionMethod: 'pdf_text' | 'ocr_vision' = 'pdf_text';

  if (isScannedText(fullText) || fullText.trim().length < 60) {
    const pagesToOcr = Array.from({ length: Math.min(pageCount || 1, 20) }, (_, i) => i + 1);
    const ocrMap = await runGoogleCloudVisionPdfOcr(pdfBuffer, pagesToOcr);
    if (ocrMap.size > 0) {
      effectiveText = Array.from(ocrMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, v]) => v.text)
        .join('\n');
      extractionMethod = 'ocr_vision';
    }
  }

  const parsed = parseOfficialAnswerKeyText(effectiveText, options);
  return { ...parsed, extractionMethod };
}

function splitOptionsFromBlock(blockText: string): {
  questionBody: string;
  options: [string, string, string, string];
  optionE: string | null;
  optionsFound: number;
  inlineAnswer: number | null;
} {
  let working = blockText.trim();
  let inlineAnswer: number | null = null;

  // Detect inline answer line like "Answer: B" or "Ans: (C)" or "விடை: ஆ"
  const inlineAnsMatch = working.match(
    /(?:^|\n)\s*(?:Answer|Ans|Correct\s*Answer|Key|விடை)\s*[:\-]?\s*\(?\s*([A-Da-dஅஆஇஈ])\s*\)?.*$/im
  );
  if (inlineAnsMatch) {
    inlineAnswer = letterToOptionIndex(inlineAnsMatch[1]);
    working = working.slice(0, inlineAnsMatch.index).trim();
  }

  // Try matching standard (A)/(B)/(C)/(D), A)/B)/C)/D), A./B./C./D., or Tamil (அ)/(ஆ)/(இ)/(ஈ)
  const patterns: RegExp[] = [
    /\(\s*A\s*\)([\s\S]*?)\(\s*B\s*\)([\s\S]*?)\(\s*C\s*\)([\s\S]*?)\(\s*D\s*\)([\s\S]*)$/i,
    /(?:^|\n|\s)A\)\s*([\s\S]*?)(?:\n|\s)B\)\s*([\s\S]*?)(?:\n|\s)C\)\s*([\s\S]*?)(?:\n|\s)D\)\s*([\s\S]*)$/i,
    /(?:^|\n)\s*A\.\s+([\s\S]*?)(?:\n|\s{2,})B\.\s+([\s\S]*?)(?:\n|\s{2,})C\.\s+([\s\S]*?)(?:\n|\s{2,})D\.\s+([\s\S]*)$/i,
    /\(\s*a\s*\)([\s\S]*?)\(\s*b\s*\)([\s\S]*?)\(\s*c\s*\)([\s\S]*?)\(\s*d\s*\)([\s\S]*)$/,
    /\(?\s*அ\s*[).]\s*([\s\S]*?)\(?\s*ஆ\s*[).]\s*([\s\S]*?)\(?\s*இ\s*[).]\s*([\s\S]*?)\(?\s*ஈ\s*[).]\s*([\s\S]*)$/,
  ];

  for (const pat of patterns) {
    const m = working.match(pat);
    if (m && m.index !== undefined) {
      const qBody = working.slice(0, m.index).trim();
      const opts: [string, string, string, string] = [
        m[1].replace(/\s+/g, ' ').trim(),
        m[2].replace(/\s+/g, ' ').trim(),
        m[3].replace(/\s+/g, ' ').trim(),
        m[4].replace(/\s+/g, ' ').trim(),
      ];

      // Extract optional Option (E) / (உ) cleanly without polluting Option D
      let optionE: string | null = null;
      const optEMatch = opts[3].match(/(?:\(\s*E\s*\)|E\)|\(\s*உ\s*\)|உ\))\s*([\s\S]*)$/i);
      if (optEMatch && optEMatch.index !== undefined) {
        optionE = optEMatch[1].replace(/\s+/g, ' ').trim() || null;
        opts[3] = opts[3].slice(0, optEMatch.index).trim();
      }

      const nonEmpty = opts.filter(Boolean).length;
      if (qBody.length >= 4 && nonEmpty >= 2) {
        return {
          questionBody: qBody.replace(/\s+/g, ' ').trim(),
          options: opts,
          optionE,
          optionsFound: nonEmpty,
          inlineAnswer,
        };
      }
    }
  }

  return {
    questionBody: working.replace(/\s+/g, ' ').trim(),
    options: ['', '', '', ''],
    optionE: null,
    optionsFound: 0,
    inlineAnswer,
  };
}

/**
 * Parses a TNPSC official question paper PDF (and optional Answer Key PDF)
 * with automatic OCR fallback for scanned PDFs, section detection, duplicate detection,
 * missing-question accounting, and answer key tier priority.
 * Never fabricates questions or guesses official answers.
 */
export async function extractQuestionsFromPreviousPaperPdf(params: {
  questionPdfBuffer: Buffer;
  answerKeyPdfBuffer?: Buffer | null;
  answerKeyFilename?: string | null;
  answerKeyType?: AnswerKeyTier | null;
  bookletCode?: string | null;
  expectedTotalQuestions?: number;
  defaultSubject: string;
  medium: string;
  onProgress?: (percent: number, message: string) => void | Promise<void>;
}): Promise<PdfExtractionResult> {
  const warnings: string[] = [];
  const reportProgress = async (pct: number, msg: string) => {
    if (params.onProgress) {
      await params.onProgress(pct, msg);
    }
  };

  await reportProgress(10, 'Reading PDF pages and embedded text layer...');
  const extractedPdf = await extractTextWithPagesFromPdf(params.questionPdfBuffer);
  let { fullText, pageTexts } = extractedPdf;
  const { pageCount } = extractedPdf;

  let rawCharCount = fullText.trim().length;
  const scannedPages: number[] = [];
  for (const p of pageTexts) {
    if (p.text.trim().length < 60) {
      scannedPages.push(p.page);
    }
  }

  const needsFullOcr = isScannedText(fullText) || rawCharCount < 120;
  const needsPartialOcr = !needsFullOcr && scannedPages.length > 0 && scannedPages.length <= 40;
  let usedOcr = false;

  if (needsFullOcr || needsPartialOcr) {
    const targetPages = needsFullOcr
      ? Array.from({ length: Math.min(pageCount, 80) }, (_, i) => i + 1)
      : scannedPages;

    await reportProgress(
      22,
      `Scanned or low-text pages detected (${targetPages.length} pages). Running OCR...`
    );

    try {
      const ocrMap = await runGoogleCloudVisionPdfOcr(params.questionPdfBuffer, targetPages);
      if (ocrMap.size > 0) {
        usedOcr = true;
        const pageByNum = new Map<number, string>();
        for (const p of pageTexts) pageByNum.set(p.page, p.text);
        for (const [pNum, ocrPage] of ocrMap.entries()) {
          if (ocrPage.text.trim().length > (pageByNum.get(pNum)?.trim().length || 0)) {
            pageByNum.set(pNum, ocrPage.text);
          }
        }
        pageTexts = Array.from(pageByNum.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([page, text]) => ({ page, text }));
        fullText = pageTexts.map((p) => p.text).join('\n\n');
        rawCharCount = fullText.trim().length;
      } else if (needsFullOcr) {
        warnings.push(
          'Scanned PDF detected, but Google Cloud Vision OCR is not configured or returned no text. Flagged for manual review or OCR reprocessing.'
        );
      }
    } catch (ocrErr: any) {
      warnings.push(`OCR processing encountered an error: ${ocrErr?.message || 'Unknown OCR error'}.`);
    }
  }

  // Parse Official Answer Key PDF if provided
  let answerKeyMap = new Map<number, number>();
  let resolvedKeyTier: AnswerKeyTier | null = params.answerKeyType || null;
  let totalKeysParsed = 0;

  if (params.answerKeyPdfBuffer && params.answerKeyPdfBuffer.length > 0) {
    await reportProgress(38, 'Extracting official answer key mappings...');
    try {
      const keyResult = await parseOfficialAnswerKeyPdf(params.answerKeyPdfBuffer, {
        bookletCode: params.bookletCode,
        filename: params.answerKeyFilename || undefined,
      });
      answerKeyMap = keyResult.answers;
      totalKeysParsed = keyResult.rawEntriesCount;
      if (!resolvedKeyTier) {
        resolvedKeyTier = keyResult.detectedKeyType || 'final';
      }
      if (answerKeyMap.size === 0) {
        warnings.push(
          'Answer Key PDF was uploaded, but no standard answer key pairs were auto-detected. Questions will remain UNVERIFIED until Admin review.'
        );
      }
    } catch {
      warnings.push('Could not parse Answer Key PDF automatically. Questions marked UNVERIFIED for Admin review.');
    }
  }

  const expectedCount =
    Number(params.expectedTotalQuestions) > 0 ? Number(params.expectedTotalQuestions) : 0;

  if (rawCharCount < 120) {
    return {
      questions: [],
      extractionMethod: 'scanned_flagged',
      pageCount,
      rawCharCount,
      expectedCount,
      extractedCount: 0,
      failedExtractionCount: expectedCount,
      missingQuestionNumbers: expectedCount > 0 ? Array.from({ length: expectedCount }, (_, i) => i + 1) : [],
      duplicateCount: 0,
      flaggedCount: 0,
      matchedAnswerKeysCount: 0,
      unverifiedAnswerCount: 0,
      conflictCount: 0,
      answerKeyMeta: {
        keyType: resolvedKeyTier,
        bookletCode: params.bookletCode || null,
        totalKeysParsed,
      },
      warnings,
    };
  }

  const hasTamilChars = /[\u0B80-\u0BFF]/.test(fullText);
  const extractionMethod: PdfExtractionResult['extractionMethod'] = usedOcr
    ? needsFullOcr
      ? 'ocr_vision'
      : 'ocr_hybrid'
    : hasTamilChars || params.medium.toLowerCase().includes('tamil')
      ? 'pdf_text_tamil_normalized'
      : 'pdf_text';

  await reportProgress(52, 'Segmenting questions, options, and sections...');

  // Annotate pages with markers so we preserve exact sourcePage traceability
  const combinedPages = pageTexts
    .map((p) => {
      const cleaned = normalizeTamilPdfText(cleanText(p.text));
      return `\n<<<PAGE:${p.page}>>>\n${cleaned}`;
    })
    .join('\n');

  // Detect inline Answer Key section near the end of the question paper
  const inlineKeyMap = new Map<number, number>();
  const inlineKeySectionMatch = combinedPages.match(
    /(?:ANSWER\s*KEY|OFFICIAL\s*KEY|விடைக்குறிப்பு)[\s\S]{10,}$/i
  );
  let questionRegion = combinedPages;
  if (inlineKeySectionMatch && inlineKeySectionMatch.index !== undefined) {
    const inlineKeys = parseAnswerKeyText(inlineKeySectionMatch[0], {
      bookletCode: params.bookletCode,
    });
    if (inlineKeys.size >= 3) {
      for (const [k, v] of inlineKeys.entries()) {
        inlineKeyMap.set(k, v);
      }
      questionRegion = combinedPages.slice(0, inlineKeySectionMatch.index);
    }
  }

  // Locate section headers and their positions in questionRegion
  const sectionPositions: { index: number; label: string }[] = [];
  SECTION_HEADER_REGEX.lastIndex = 0;
  let sm: RegExpExecArray | null;
  while ((sm = SECTION_HEADER_REGEX.exec(questionRegion)) !== null) {
    const label = sm[0].replace(/\s+/g, ' ').trim();
    if (label.length >= 4 && label.length <= 80) {
      sectionPositions.push({ index: sm.index, label });
    }
  }

  // Split by question starts: "1.", "1)", "Q.1", "Q1.", "01." at start of line
  const qStartRegex = /(?:^|\n)\s*(?:Q\.?\s*|கேள்வி\s*)?(\d{1,3})\s*[.)]\s+/g;
  const matches: { qNumStr: string; qNum: number; startIndex: number; contentStart: number }[] = [];

  let m: RegExpExecArray | null;
  while ((m = qStartRegex.exec(questionRegion)) !== null) {
    const num = Number(m[1]);
    if (num >= 1 && num <= 300) {
      matches.push({
        qNumStr: m[1],
        qNum: num,
        startIndex: m.index,
        contentStart: m.index + m[0].length,
      });
    }
  }

  const questions: ExtractedPaperQuestion[] = [];
  const seenNumbers = new Set<number>();
  const seenNormalizedTexts = new Map<string, number>();
  let matchedAnswerKeysCount = 0;
  let unverifiedAnswerCount = 0;
  let conflictCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].startIndex : questionRegion.length;

    // Source page traceability
    const beforeSlice = questionRegion.slice(0, cur.startIndex);
    const pageMarkers = beforeSlice.match(/<<<PAGE:(\d+)>>>/g);
    let sourcePage: number | null = 1;
    if (pageMarkers && pageMarkers.length > 0) {
      const lastMarker = pageMarkers[pageMarkers.length - 1];
      const pm = lastMarker.match(/(\d+)/);
      sourcePage = pm ? Number(pm[1]) : 1;
    }

    // Current section lookup
    let currentSection = params.defaultSubject || 'General Studies';
    for (let sIdx = sectionPositions.length - 1; sIdx >= 0; sIdx--) {
      if (sectionPositions[sIdx].index < cur.startIndex) {
        currentSection = sectionPositions[sIdx].label;
        break;
      }
    }

    const rawBlock = questionRegion
      .slice(cur.contentStart, nextStart)
      .replace(/<<<PAGE:\d+>>>/g, ' ')
      .trim();

    if (rawBlock.length < 8) continue;
    if (seenNumbers.has(cur.qNum)) continue;

    const { questionBody, options, optionE, optionsFound, inlineAnswer } = splitOptionsFromBlock(rawBlock);
    if (questionBody.length < 8 && optionsFound === 0) continue;

    seenNumbers.add(cur.qNum);

    // Duplicate text detection
    const normKey = normalizeForDuplicateCheck(questionBody);
    let isDuplicate = false;
    let duplicateOfQ: number | null = null;
    if (normKey.length >= 20) {
      if (seenNormalizedTexts.has(normKey)) {
        isDuplicate = true;
        duplicateOfQ = seenNormalizedTexts.get(normKey) ?? null;
        duplicateCount += 1;
      } else {
        seenNormalizedTexts.set(normKey, cur.qNum);
      }
    }

    // Official Answer Key Matching with Conflict Detection
    const keyFromUploadedFile = answerKeyMap.get(cur.qNum);
    const keyFromInlineSection = inlineKeyMap.get(cur.qNum);
    const fallbackInline = keyFromInlineSection !== undefined ? keyFromInlineSection : inlineAnswer;

    let resolvedAns = -1;
    let answerStatus: AnswerVerificationStatus = 'unverified';
    let answerSource: string | null = null;
    const reviewReasons: string[] = [];

    if (keyFromUploadedFile !== undefined && fallbackInline !== null && fallbackInline !== undefined && keyFromUploadedFile !== fallbackInline) {
      // Two sources conflict -> send to Admin Review
      resolvedAns = keyFromUploadedFile;
      answerStatus = 'conflict';
      answerSource = `conflict:${resolvedKeyTier || 'uploaded'}_vs_inline`;
      conflictCount += 1;
      reviewReasons.push(
        `Answer key conflict: uploaded key says (${String.fromCharCode(65 + keyFromUploadedFile)}) while inline key says (${String.fromCharCode(65 + fallbackInline)}) — Admin verification required`
      );
    } else if (keyFromUploadedFile !== undefined) {
      resolvedAns = keyFromUploadedFile;
      answerStatus = keyTierToAnswerStatus(resolvedKeyTier || 'final');
      answerSource = params.answerKeyFilename
        ? `${resolvedKeyTier || 'final'}:${params.answerKeyFilename}${params.bookletCode ? ` [${params.bookletCode}]` : ''}`
        : `official_${resolvedKeyTier || 'final'}`;
      matchedAnswerKeysCount += 1;
      if (answerStatus === 'tentative') {
        reviewReasons.push('Answer matched from TENTATIVE key — verify against official final key');
      }
    } else if (fallbackInline !== null && fallbackInline !== undefined) {
      resolvedAns = fallbackInline;
      answerStatus = 'tentative';
      answerSource = 'inline_paper_key';
      matchedAnswerKeysCount += 1;
      reviewReasons.push('Answer detected from inline key — verify against official TNPSC answer key');
    } else {
      resolvedAns = -1;
      answerStatus = 'unverified';
      answerSource = null;
      unverifiedAnswerCount += 1;
      reviewReasons.push('UNVERIFIED: No official answer key matched — Admin verification required');
    }

    const hasDiagramHint = DIAGRAM_CUES_REGEX.test(rawBlock);
    if (optionsFound < 4) {
      reviewReasons.push(`Incomplete options (${optionsFound}/4 detected) — verify options A–D`);
    }
    if (isDuplicate) {
      reviewReasons.push(`Possible duplicate of Question #${duplicateOfQ}`);
    }
    if (hasDiagramHint) {
      reviewReasons.push('Diagram/table/match-list reference detected — verify formatting');
    }

    const extractionStatus: 'ok' | 'needs_review' | 'failed' =
      optionsFound === 0 || questionBody.length < 12
        ? 'failed'
        : reviewReasons.length > 0
          ? 'needs_review'
          : 'ok';

    questions.push({
      questionNumber: questions.length + 1,
      originalQuestionNumber: cur.qNumStr,
      sourcePage,
      section: currentSection,
      subject: params.defaultSubject || 'General Studies',
      topic: currentSection,
      questionText: questionBody,
      optionA: options[0] || '',
      optionB: options[1] || '',
      optionC: options[2] || '',
      optionD: options[3] || '',
      optionE,
      correctAnswer: resolvedAns >= 0 ? resolvedAns : 0,
      answerVerified: answerStatus === 'verified_final' || answerStatus === 'verified_revised',
      answerStatus,
      answerSource,
      explanation: '',
      explanationSource: 'none',
      isDuplicate,
      extractionStatus,
      needsReview: reviewReasons.length > 0 || extractionStatus !== 'ok',
      reviewNote: reviewReasons.length > 0 ? reviewReasons.join(' | ') : null,
      hasDiagramHint,
      medium: params.medium || 'English',
    });
  }

  // Account for every expected question number (NEVER invent artificial questions!)
  const targetMax = Math.max(expectedCount, questions.length);
  const missingQuestionNumbers: number[] = [];
  if (expectedCount > 0) {
    for (let n = 1; n <= expectedCount; n++) {
      if (!seenNumbers.has(n)) {
        missingQuestionNumbers.push(n);
      }
    }
    if (missingQuestionNumbers.length > 0) {
      const sample = missingQuestionNumbers.slice(0, 15).join(', ');
      warnings.push(
        `Extracted ${questions.length} of ${expectedCount} expected questions. Missing ${missingQuestionNumbers.length} question(s): #${sample}${missingQuestionNumbers.length > 15 ? '...' : ''}. No artificial questions were created.`
      );
    }
  }

  if (questions.length === 0) {
    warnings.push(
      'No numbered MCQ blocks were auto-extracted from this PDF. Use Reprocess Failed Questions or edit manually in Staging Review.'
    );
  }

  const failedExtractionQuestions = questions.filter((q) => q.extractionStatus === 'failed').length;
  const failedExtractionCount = missingQuestionNumbers.length + failedExtractionQuestions;
  const flaggedCount = questions.filter((q) => q.needsReview).length;

  await reportProgress(
    75,
    `Extracted ${questions.length} questions (${matchedAnswerKeysCount} answers matched, ${unverifiedAnswerCount} unverified, ${failedExtractionCount} failed/missing).`
  );

  return {
    questions,
    extractionMethod,
    pageCount,
    rawCharCount,
    expectedCount: targetMax,
    extractedCount: questions.length,
    failedExtractionCount,
    missingQuestionNumbers,
    duplicateCount,
    flaggedCount,
    matchedAnswerKeysCount,
    unverifiedAnswerCount,
    conflictCount,
    answerKeyMeta: {
      keyType: resolvedKeyTier,
      bookletCode: params.bookletCode || null,
      totalKeysParsed,
    },
    warnings,
  };
}
