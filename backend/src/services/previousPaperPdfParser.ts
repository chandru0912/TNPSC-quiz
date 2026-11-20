import crypto from 'crypto';
import {
  getPdfParseClass,
  cleanText,
  isScannedText,
  normalizeTamilPdfText,
} from './pdfProcessor';

export interface ExtractedPaperQuestion {
  questionNumber: number;
  originalQuestionNumber: string;
  sourcePage: number | null;
  subject: string;
  topic: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: number; // 0=A, 1=B, 2=C, 3=D
  answerVerified: boolean;
  explanation: string;
  needsReview: boolean;
  reviewNote: string | null;
  hasDiagramHint: boolean;
  medium: string;
}

export interface PdfExtractionResult {
  questions: ExtractedPaperQuestion[];
  extractionMethod: 'pdf_text' | 'pdf_text_tamil_normalized' | 'scanned_flagged';
  pageCount: number;
  rawCharCount: number;
  flaggedCount: number;
  matchedAnswerKeysCount: number;
  warnings: string[];
}

export function computeBufferSha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const DIAGRAM_CUES_REGEX =
  /\b(diagram|figure|fig\.|chart|graph|table|map|match\s+the\s+following|match\s+list|given\s+below|shown\s+below|flow\s*chart)\b|படம்|அட்டவணை|பொருத்துக|வரைபடம்/i;

function letterToOptionIndex(raw: string): number | null {
  const s = raw.trim().toUpperCase();
  if (s === 'A' || s === '1' || s === 'அ') return 0;
  if (s === 'B' || s === '2' || s === 'ஆ') return 1;
  if (s === 'C' || s === '3' || s === 'இ') return 2;
  if (s === 'D' || s === '4' || s === 'ஈ') return 3;
  return null;
}

/**
 * Extracts official answer key mappings (questionNumber -> optionIndex 0..3)
 * from an Answer Key PDF text or inline answer key section.
 */
export function parseAnswerKeyText(rawText: string): Map<number, number> {
  const map = new Map<number, number>();
  if (!rawText || !rawText.trim()) return map;

  const normalized = normalizeTamilPdfText(cleanText(rawText));

  // Match common TNPSC answer key formats:
  // "1. A", "1) (B)", "Q.1 - C", "001 : D", "12 (அ)", "45 B"
  const pairRegex =
    /(?:^|[\s,;|])(?:Q\.?\s*)?(\d{1,3})\s*(?:[.)\-:\]]|\s+)\s*\(?\s*([A-Da-dஅஆஇஈ])\s*\)?(?=$|[\s,;|])/gm;

  let m: RegExpExecArray | null;
  while ((m = pairRegex.exec(normalized)) !== null) {
    const qNum = Number(m[1]);
    const optIdx = letterToOptionIndex(m[2]);
    if (qNum >= 1 && qNum <= 300 && optIdx !== null && !map.has(qNum)) {
      map.set(qNum, optIdx);
    }
  }

  return map;
}

async function extractTextWithPagesFromPdf(
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

    const pageCount =
      Number(result?.total || result?.numpages || pages.length || 1);

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

function splitOptionsFromBlock(blockText: string): {
  questionBody: string;
  options: [string, string, string, string];
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
    // (A) ... (B) ... (C) ... (D) ...
    /\(\s*A\s*\)([\s\S]*?)\(\s*B\s*\)([\s\S]*?)\(\s*C\s*\)([\s\S]*?)\(\s*D\s*\)([\s\S]*)$/i,
    // A) ... B) ... C) ... D) ...
    /(?:^|\n|\s)A\)\s*([\s\S]*?)(?:\n|\s)B\)\s*([\s\S]*?)(?:\n|\s)C\)\s*([\s\S]*?)(?:\n|\s)D\)\s*([\s\S]*)$/i,
    // A. ... B. ... C. ... D. ...
    /(?:^|\n)\s*A\.\s+([\s\S]*?)(?:\n|\s{2,})B\.\s+([\s\S]*?)(?:\n|\s{2,})C\.\s+([\s\S]*?)(?:\n|\s{2,})D\.\s+([\s\S]*)$/i,
    // (a) ... (b) ... (c) ... (d) ...
    /\(\s*a\s*\)([\s\S]*?)\(\s*b\s*\)([\s\S]*?)\(\s*c\s*\)([\s\S]*?)\(\s*d\s*\)([\s\S]*)$/,
    // Tamil (அ) ... (ஆ) ... (இ) ... (ஈ) ...
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
      // Trim trailing "(E) Answer not known" common in TNPSC official papers from option D
      opts[3] = opts[3].replace(/\(\s*E\s*\)[\s\S]*$/i, '').replace(/E\)\s*Answer\s+not\s+known[\s\S]*$/i, '').trim();
      const nonEmpty = opts.filter(Boolean).length;
      if (qBody.length >= 4 && nonEmpty >= 2) {
        return {
          questionBody: qBody.replace(/\s+/g, ' ').trim(),
          options: opts,
          optionsFound: nonEmpty,
          inlineAnswer,
        };
      }
    }
  }

  return {
    questionBody: working.replace(/\s+/g, ' ').trim(),
    options: ['', '', '', ''],
    optionsFound: 0,
    inlineAnswer,
  };
}

/**
 * Parses a TNPSC official question paper PDF (and optional Answer Key PDF)
 * into structured questions with source page & original question number traceability.
 * Never fabricates questions or answers — flags incomplete/unverified items for Admin review.
 */
export async function extractQuestionsFromPreviousPaperPdf(params: {
  questionPdfBuffer: Buffer;
  answerKeyPdfBuffer?: Buffer | null;
  defaultSubject: string;
  medium: string;
}): Promise<PdfExtractionResult> {
  const warnings: string[] = [];
  const { fullText, pageTexts, pageCount } = await extractTextWithPagesFromPdf(params.questionPdfBuffer);

  let answerKeyMap = new Map<number, number>();
  if (params.answerKeyPdfBuffer && params.answerKeyPdfBuffer.length > 0) {
    try {
      const keyData = await extractTextWithPagesFromPdf(params.answerKeyPdfBuffer);
      answerKeyMap = parseAnswerKeyText(keyData.fullText);
      if (answerKeyMap.size === 0) {
        warnings.push('Answer Key PDF was uploaded, but no standard answer key pairs were auto-detected. Please verify answers manually.');
      }
    } catch {
      warnings.push('Could not parse Answer Key PDF automatically. Please verify answers manually.');
    }
  }

  const rawCharCount = fullText.trim().length;
  const scanned = isScannedText(fullText);

  if (scanned && rawCharCount < 120) {
    warnings.push(
      'This PDF appears to be a scanned image PDF with minimal embedded text. Please review and add/correct questions manually or upload a text-searchable official PDF.'
    );
    return {
      questions: [],
      extractionMethod: 'scanned_flagged',
      pageCount,
      rawCharCount,
      flaggedCount: 0,
      matchedAnswerKeysCount: 0,
      warnings,
    };
  }

  const hasTamilChars = /[\u0B80-\u0BFF]/.test(fullText);
  const extractionMethod: PdfExtractionResult['extractionMethod'] =
    hasTamilChars || params.medium.toLowerCase().includes('tamil')
      ? 'pdf_text_tamil_normalized'
      : 'pdf_text';

  // Annotate pages with markers so we preserve exact sourcePage traceability
  const combinedPages = pageTexts
    .map((p) => {
      const cleaned = normalizeTamilPdfText(cleanText(p.text));
      return `\n<<<PAGE:${p.page}>>>\n${cleaned}`;
    })
    .join('\n');

  // Also check if there is an inline Answer Key section near the end of the question paper
  const inlineKeySectionMatch = combinedPages.match(
    /(?:ANSWER\s*KEY|OFFICIAL\s*KEY|விடைக்குறிப்பு)[\s\S]{10,}$/i
  );
  let questionRegion = combinedPages;
  if (inlineKeySectionMatch && inlineKeySectionMatch.index !== undefined) {
    const inlineKeys = parseAnswerKeyText(inlineKeySectionMatch[0]);
    if (inlineKeys.size >= 3) {
      for (const [k, v] of inlineKeys.entries()) {
        if (!answerKeyMap.has(k)) answerKeyMap.set(k, v);
      }
      questionRegion = combinedPages.slice(0, inlineKeySectionMatch.index);
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
  let matchedAnswerKeysCount = 0;

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].startIndex : questionRegion.length;

    // Determine source page from nearest preceding <<<PAGE:N>>> marker
    const beforeSlice = questionRegion.slice(0, cur.startIndex);
    const pageMarkers = beforeSlice.match(/<<<PAGE:(\d+)>>>/g);
    let sourcePage: number | null = 1;
    if (pageMarkers && pageMarkers.length > 0) {
      const lastMarker = pageMarkers[pageMarkers.length - 1];
      const pm = lastMarker.match(/(\d+)/);
      sourcePage = pm ? Number(pm[1]) : 1;
    }

    const rawBlock = questionRegion
      .slice(cur.contentStart, nextStart)
      .replace(/<<<PAGE:\d+>>>/g, ' ')
      .trim();

    if (rawBlock.length < 8) continue;

    // Avoid duplicate question numbers (e.g. bilingual side-by-side or header numbers)
    if (seenNumbers.has(cur.qNum)) continue;

    const { questionBody, options, optionsFound, inlineAnswer } = splitOptionsFromBlock(rawBlock);

    // Skip noise lines that are neither a real question nor have options
    if (questionBody.length < 8 && optionsFound === 0) continue;

    seenNumbers.add(cur.qNum);

    const hasDiagramHint = DIAGRAM_CUES_REGEX.test(rawBlock);
    const keyFromFile = answerKeyMap.get(cur.qNum);
    const resolvedAns = keyFromFile !== undefined ? keyFromFile : inlineAnswer;
    const answerVerified = resolvedAns !== null && resolvedAns !== undefined;
    if (answerVerified) matchedAnswerKeysCount += 1;

    const reviewReasons: string[] = [];
    if (optionsFound < 4) {
      reviewReasons.push(`Only ${optionsFound}/4 options detected — please verify options A–D`);
    }
    if (!answerVerified) {
      reviewReasons.push('Correct answer not detected — please select verified answer');
    }
    if (hasDiagramHint) {
      reviewReasons.push('Possible diagram/table/match-list reference detected — verify formatting');
    }

    questions.push({
      questionNumber: questions.length + 1,
      originalQuestionNumber: cur.qNumStr,
      sourcePage,
      subject: params.defaultSubject || 'General Studies',
      topic: params.defaultSubject || 'General Studies',
      questionText: questionBody,
      optionA: options[0] || '',
      optionB: options[1] || '',
      optionC: options[2] || '',
      optionD: options[3] || '',
      correctAnswer: answerVerified ? Number(resolvedAns) : 0,
      answerVerified,
      explanation: '',
      needsReview: reviewReasons.length > 0,
      reviewNote: reviewReasons.length > 0 ? reviewReasons.join(' | ') : null,
      hasDiagramHint,
      medium: params.medium || 'English',
    });
  }

  if (questions.length === 0) {
    warnings.push(
      'No numbered MCQ blocks were auto-extracted from this PDF. You can add/edit questions manually in the Question Review editor before publishing.'
    );
  }

  const flaggedCount = questions.filter((q) => q.needsReview).length;

  return {
    questions,
    extractionMethod,
    pageCount,
    rawCharCount,
    flaggedCount,
    matchedAnswerKeysCount,
    warnings,
  };
}
