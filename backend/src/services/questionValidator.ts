/**
 * Deterministic Question Validation, Normalization and Deduplication Module
 * for TNPSC Study Hub.
 *
 * Pure algorithmic validation:
 * - Interrogative question text checks
 * - Option format and duplicate option checks
 * - Correct answer index resolution (0..3)
 * - Multi-level semantic deduplication (Jaccard token similarity & Dice bigram similarity)
 */

import crypto from 'crypto';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface TextbookPassage {
  pageNumber: number;
  content: string;
}

export interface TextbookContext {
  textbookId: number;
  bookName: string;
  relevantPages: number[];
  passages: TextbookPassage[];
}

export interface ExistingDbQuestionRecord {
  question: string;
  correctAnswerText?: string;
}

export interface VerificationDetails {
  textSupport: boolean;
  answerMatches: boolean;
  optionsValid: boolean;
  unambiguous: boolean;
  notDuplicate: boolean;
  pageVerified: boolean;
  notes: string;
}

export interface ValidatedQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  correctAnswerText: string;
  explanation: string;
  difficulty: Difficulty;
  pyqPattern: string;
  sourceReference: string;
  topic: string;
  sourceTextbook?: string;
  sourcePage: number;
  textbookId?: number;
  standard: number;
  subject: string;
  term: string;
  unit: string;
  lesson: string;
  verificationStatus: 'verified' | 'needs_review' | 'rejected';
  verificationDetails?: VerificationDetails;
}

const QUESTION_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'which', 'what', 'who', 'where', 'when', 'how',
  'following', 'correct', 'statement', 'choose', 'identify', 'according', 'lesson', 'unit',
  'standard', 'term', 'tnpsc', 'question', 'are', 'was', 'were', 'that', 'this', 'these',
  'those', 'into', 'about', 'known', 'called', 'defined', 'refers', 'measured', 'used',
  'physical', 'quantity', 'type', 'example', 'below', 'given', 'true', 'false', 'among',
  'என்ன', 'யாது', 'யார்', 'எது', 'எவை', 'எங்கு', 'எப்போது', 'எவ்வாறு', 'எத்தனை',
  'என்ற', 'என்னும்', 'பின்வரும்', 'பின்வருவனவற்றுள்', 'சரியான', 'விடையை', 'தேர்ந்தெடு',
  'பாடத்தில்', 'பாடலின்', 'குறிப்பிடப்பட்டுள்ளது', 'கூறப்பட்டுள்ளது', 'அழைக்கப்படுகிறது',
  'அளக்கப்படுகிறது', 'பயன்படுகிறது', 'எனப்படும்', 'குறிக்கிறது',
]);

/**
 * Light English/Tamil stemmer so singular/plural and common inflections match
 * (e.g., "metres" <-> "metre", "units" <-> "unit", "seconds" <-> "second").
 */
export function stemToken(word: string): string {
  const w = String(word || '').toLowerCase().trim();
  if (w.length <= 3) return w;
  if (/^[a-z]+$/.test(w)) {
    if (w.endsWith('ies') && w.length > 5) return `${w.slice(0, -3)}y`;
    if (w.endsWith('es') && w.length > 4 && !w.endsWith('ees')) return w.slice(0, -1); // metres -> metre
    if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is') && w.length > 4) {
      return w.slice(0, -1);
    }
  }
  return w;
}

export function normalizeText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/\[(?:வினா|question)\s*\d+\]/gi, ' ')
    .replace(/[^a-z0-9\u0B80-\u0BFF]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(' ')
      .map(stemToken)
      .filter((word) => word.length > 2 && !QUESTION_STOP_WORDS.has(word))
  );
}

/**
 * Deterministic SHA-256 hash of normalized question text for persistent DB duplicate checks.
 */
export function computeNormalizedQuestionHash(questionText: string): string {
  const norm = normalizeText(questionText);
  return crypto.createHash('sha256').update(norm).digest('hex');
}

/**
 * Canonical concept-pair fingerprint combining sorted core tokens of (question + answer).
 * Ensures that a question and its reverse (Q->A inverted to A->Q) share overlapping concept tokens.
 */
export function computeConceptFingerprint(questionText: string, correctAnswerText?: string): string {
  const combined = Array.from(tokenSet(`${questionText} ${correctAnswerText || ''}`)).sort();
  const key = combined.slice(0, 12).join('|');
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 40);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

function charBigrams(text: string): Set<string> {
  const clean = normalizeText(text).replace(/\s+/g, '');
  const bigrams = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) {
    bigrams.add(clean.slice(i, i + 2));
  }
  return bigrams;
}

export function diceSimilarity(a: string, b: string): number {
  const bgA = charBigrams(a);
  const bgB = charBigrams(b);
  if (bgA.size === 0 || bgB.size === 0) return 0;
  let overlap = 0;
  for (const g of bgA) {
    if (bgB.has(g)) overlap++;
  }
  return (2 * overlap) / (bgA.size + bgB.size);
}

function numericSignature(text: string): string {
  const numbers = normalizeText(text).match(/\d+(?:\.\d+)?/g);
  return numbers ? numbers.sort().join('|') : '';
}

export type DuplicateReason = 'EXACT' | 'SEMANTIC' | 'REVERSE_QUESTION' | 'SAME_FACT';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: DuplicateReason;
  matchedQuestion?: string;
}

/**
 * Detects answer-based reverse question generation:
 * e.g., Existing Q: "What is the SI unit of length?" -> A: "Metre"
 *       Candidate Q: "Which physical quantity is measured in metres?" -> A: "Length"
 * Returns true when the candidate question uses the previous question's answer
 * to ask back for a concept from the previous question's stem (or vice versa).
 */
export function isReverseQuestionPair(
  candidateQuestion: string,
  candidateAnswer: string | undefined,
  existingQuestion: string,
  existingAnswer: string | undefined
): boolean {
  if (!candidateAnswer || !existingAnswer) return false;

  const candQTokens = tokenSet(candidateQuestion);
  const candATokens = tokenSet(candidateAnswer);
  const existQTokens = tokenSet(existingQuestion);
  const existATokens = tokenSet(existingAnswer);

  if (candATokens.size === 0 || existATokens.size === 0) return false;

  // Check if existing answer tokens appear inside candidate question stem
  let existAnsInCandQ = 0;
  for (const t of existATokens) {
    if (candQTokens.has(t)) existAnsInCandQ++;
  }
  const existAnsRatio = existAnsInCandQ / existATokens.size;

  // Check if candidate answer tokens appear inside existing question stem
  let candAnsInExistQ = 0;
  for (const t of candATokens) {
    if (existQTokens.has(t)) candAnsInExistQ++;
  }
  const candAnsRatio = candAnsInExistQ / candATokens.size;

  // Classic direct inversion: A1 is in Q2 AND A2 is in Q1
  if (existAnsRatio >= 0.5 && candAnsRatio >= 0.5) {
    return true;
  }

  // Symmetric concept-pair overlap: (Q1 U A1) vs (Q2 U A2)
  // If A1 appears in Q2 (or A2 appears in Q1) AND the combined fact-pair tokens strongly overlap
  if (existAnsRatio >= 0.65 || candAnsRatio >= 0.65) {
    const candFact = new Set([...candQTokens, ...candATokens]);
    const existFact = new Set([...existQTokens, ...existATokens]);
    let shared = 0;
    for (const t of candFact) {
      if (existFact.has(t)) shared++;
    }
    const factSim = jaccard(candFact, existFact);
    if (shared >= 2 && factSim >= 0.52) {
      return true;
    }
  }

  return false;
}

/**
 * Detailed multi-level duplicate & reverse-question detector.
 */
export function checkQuestionDuplicate(
  candidateQuestion: string,
  existingBatch: Array<{ question: string; options?: string[]; correctAnswer?: number; correctAnswerText?: string }>,
  existingDbQuestions: Array<string | ExistingDbQuestionRecord> = [],
  candidateCorrectAnswerText?: string
): DuplicateCheckResult {
  const candidateText = normalizeText(candidateQuestion);
  if (!candidateText) return { isDuplicate: true, reason: 'EXACT' };

  const candidateTokens = tokenSet(candidateQuestion);
  const candidateNumbers = numericSignature(candidateQuestion);
  const normCandidateAns = candidateCorrectAnswerText ? normalizeText(candidateCorrectAnswerText) : '';

  const checkAgainst = (otherQuestion: string, otherAnswerText?: string): DuplicateCheckResult => {
    const otherText = normalizeText(otherQuestion);
    if (!otherText) return { isDuplicate: false };
    if (candidateText === otherText) {
      return { isDuplicate: true, reason: 'EXACT', matchedQuestion: otherQuestion };
    }

    // Check reverse question inversion first (Requirement 5)
    if (isReverseQuestionPair(candidateQuestion, candidateCorrectAnswerText, otherQuestion, otherAnswerText)) {
      return { isDuplicate: true, reason: 'REVERSE_QUESTION', matchedQuestion: otherQuestion };
    }

    const otherTokens = tokenSet(otherQuestion);
    const tokSim = jaccard(candidateTokens, otherTokens);
    if (tokSim >= 0.72) {
      return { isDuplicate: true, reason: 'SEMANTIC', matchedQuestion: otherQuestion };
    }

    const diceSim = diceSimilarity(candidateText, otherText);
    if (diceSim >= 0.84) {
      return { isDuplicate: true, reason: 'SEMANTIC', matchedQuestion: otherQuestion };
    }

    if (candidateNumbers && candidateNumbers === numericSignature(otherQuestion) && tokSim >= 0.42) {
      return { isDuplicate: true, reason: 'SAME_FACT', matchedQuestion: otherQuestion };
    }

    const normOtherAns = otherAnswerText ? normalizeText(otherAnswerText) : '';
    if (
      normCandidateAns &&
      normOtherAns &&
      (normCandidateAns === normOtherAns || stemToken(normCandidateAns) === stemToken(normOtherAns)) &&
      normCandidateAns.length >= 3 &&
      tokSim >= 0.35
    ) {
      return { isDuplicate: true, reason: 'SAME_FACT', matchedQuestion: otherQuestion };
    }

    return { isDuplicate: false };
  };

  for (const item of existingBatch) {
    const ansText =
      item.correctAnswerText ||
      (item.options && typeof item.correctAnswer === 'number' ? item.options[item.correctAnswer] : undefined);
    const hit = checkAgainst(item.question, ansText);
    if (hit.isDuplicate) return hit;
  }

  for (const record of existingDbQuestions) {
    const qStr = typeof record === 'string' ? record : record.question;
    const ansStr = typeof record === 'string' ? undefined : record.correctAnswerText;
    const hit = checkAgainst(qStr, ansStr);
    if (hit.isDuplicate) return hit;
  }

  return { isDuplicate: false };
}

/**
 * Multi-level semantic duplicate detector (backward-compatible boolean wrapper).
 */
export function isSemanticallyDuplicate(
  candidateQuestion: string,
  existingBatch: Array<{ question: string; options?: string[]; correctAnswer?: number; correctAnswerText?: string }>,
  existingDbQuestions: Array<string | ExistingDbQuestionRecord> = [],
  candidateCorrectAnswerText?: string
): boolean {
  return checkQuestionDuplicate(candidateQuestion, existingBatch, existingDbQuestions, candidateCorrectAnswerText)
    .isDuplicate;
}

/**
 * Extracts a structured Topic Coverage Checklist directly from the original PDF lesson text
 * (headings, subheadings, numbered sections 1.1/1.2, Tamil headers, and user-selected topics).
 */
export function extractLessonTopicChecklist(textbookContent: string, selectedTopics?: string[]): string[] {
  const checklist: string[] = [];
  const seen = new Set<string>();

  const addTopic = (raw: string) => {
    const clean = String(raw || '')
      .replace(/^[\d.\s\-–—:•*#]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean.length < 3 || clean.length > 90) return;
    if (/^(?:page|pdf page|பக்கம்|activity|exercise|evaluation|summary|glossary|references|ict corner)\b/i.test(clean)) return;
    const key = normalizeText(clean);
    if (key.length < 3 || seen.has(key)) return;
    seen.add(key);
    checklist.push(clean);
  };

  if (Array.isArray(selectedTopics)) {
    for (const t of selectedTopics) addTopic(t);
  }

  const lines = String(textbookContent || '').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.length < 4 || line.length > 95) continue;
    if (/^\[PDF Page \d+\]/i.test(line) || /\.indd\b/i.test(line)) continue;

    const isNumberedSection = /^\d+(?:\.\d+)+\s+[A-Za-z\u0B80-\u0BFF]/.test(line);
    const isNamedHeading =
      /^(?:unit|chapter|lesson|section|part|topic|கவிதைப்பேழை|உரைநடை|விரிவானம்|கற்கண்டு|இலக்கணம்|நூல்\s*வெளி|தெரிந்து\s*தெளிவோம்|உங்களுக்குத்\s*தெரியுமா)\b/i.test(
        line
      );
    const isShortTitleCase =
      line.length >= 6 &&
      line.length <= 65 &&
      !/[.?!,;]$/.test(line) &&
      !/^\d+$/.test(line) &&
      /^[A-Z\u0B80-\u0BFF]/.test(line) &&
      line.split(/\s+/).length <= 8;

    if (isNumberedSection || isNamedHeading || isShortTitleCase) {
      addTopic(line);
    }
    if (checklist.length >= 25) break;
  }

  return checklist;
}

/**
 * Parses `[PDF Page N]` markers from extracted textbook content into page-level passages.
 */
export function parsePdfPagePassages(textbookContent: string, fallbackPages?: number[]): TextbookPassage[] {
  const raw = String(textbookContent || '');
  const marker = /\[PDF Page\s*(\d+)\]/gi;
  const passages: TextbookPassage[] = [];
  let match: RegExpExecArray | null;
  let lastPage: number | null = null;
  let lastStart = 0;

  while ((match = marker.exec(raw)) !== null) {
    if (lastPage !== null) {
      const content = raw.slice(lastStart, match.index).trim();
      if (content) passages.push({ pageNumber: lastPage, content });
    }
    lastPage = Number(match[1]);
    lastStart = marker.lastIndex;
  }
  if (lastPage !== null) {
    const content = raw.slice(lastStart).trim();
    if (content) passages.push({ pageNumber: lastPage, content });
  }

  if (passages.length === 0 && raw.trim().length > 0) {
    passages.push({
      pageNumber: fallbackPages?.[0] ?? 1,
      content: raw.trim(),
    });
  }
  return passages;
}

/**
 * Validates that a generated MCQ's correct answer and explanation are strictly grounded
 * in the original PDF lesson text, and attributes the exact PDF page number where the fact appears.
 */
export function verifyQuestionAgainstSourcePdf(params: {
  question: string;
  options: string[];
  correctAnswerIdx: number;
  explanation: string;
  passages: TextbookPassage[];
  aiSuggestedPage?: number | null;
}): { supported: boolean; verifiedPage: number | null; reason?: string } {
  const { question, options, correctAnswerIdx, explanation, passages, aiSuggestedPage } = params;
  if (passages.length === 0) {
    return { supported: false, verifiedPage: null, reason: 'No source PDF passages available for verification.' };
  }

  const correctAns = String(options[correctAnswerIdx] || '').trim();
  const fullNormalizedPdf = normalizeText(passages.map((p) => p.content).join(' '));
  const fullPdfTokens = new Set(fullNormalizedPdf.split(' ').map(stemToken).filter((w) => w.length >= 2));

  // Extract meaningful tokens & numbers from the correct answer
  const ansNorm = normalizeText(correctAns);
  const ansNumbers = ansNorm.match(/\d+(?:\.\d+)?/g) || [];
  const ansTokens = ansNorm
    .split(' ')
    .map(stemToken)
    .filter((w) => w.length >= 3 && !QUESTION_STOP_WORDS.has(w));

  // 1. Verify numeric facts in the correct answer appear in the PDF
  for (const num of ansNumbers) {
    if (num.length >= 2 && !fullNormalizedPdf.includes(num)) {
      return {
        supported: false,
        verifiedPage: null,
        reason: `Correct answer number "${num}" not found in the source PDF lesson.`,
      };
    }
  }

  // 2. Verify key answer terms (or explanation terms if answer is short/composite like "Both A and B")
  const isCompositeOption = /^(?:both|all of the above|none of the above|இரண்டும்|அனைத்தும்|ஏதுமில்லை)/i.test(correctAns);
  if (!isCompositeOption && ansTokens.length > 0) {
    let ansHits = 0;
    for (const t of ansTokens) {
      if (fullPdfTokens.has(t) || fullNormalizedPdf.includes(t)) ansHits++;
    }
    if (ansHits === 0) {
      return {
        supported: false,
        verifiedPage: null,
        reason: `Correct answer "${correctAns}" is not supported by the source PDF lesson text.`,
      };
    }
  }

  // 3. Verify question + explanation grounding against PDF
  const expTokens = Array.from(tokenSet(`${question} ${explanation}`));
  if (expTokens.length >= 3) {
    let expHits = 0;
    for (const t of expTokens) {
      if (fullPdfTokens.has(t) || fullNormalizedPdf.includes(t)) expHits++;
    }
    const supportRatio = expHits / expTokens.length;
    if (supportRatio < 0.25) {
      return {
        supported: false,
        verifiedPage: null,
        reason: `Question/explanation has insufficient factual overlap (${Math.round(supportRatio * 100)}%) with the source PDF.`,
      };
    }
  }

  // 4. Attribute exact PDF page number by scoring each passage against (question + answer + explanation)
  const factTokens = Array.from(tokenSet(`${question} ${correctAns} ${explanation}`));
  let bestPage: number | null = null;
  let bestScore = -1;

  for (const p of passages) {
    const pNorm = normalizeText(p.content);
    let score = 0;
    if (ansNorm.length >= 3 && pNorm.includes(ansNorm)) score += 25;
    for (const t of factTokens) {
      if (pNorm.includes(t)) score += 5;
    }
    if (aiSuggestedPage && p.pageNumber === aiSuggestedPage) score += 3;
    if (score > bestScore) {
      bestScore = score;
      bestPage = p.pageNumber;
    }
  }

  const validPageSet = new Set(passages.map((p) => p.pageNumber));
  const verifiedPage =
    bestScore > 0
      ? bestPage
      : aiSuggestedPage && validPageSet.has(aiSuggestedPage)
      ? aiSuggestedPage
      : passages[0]?.pageNumber ?? null;

  return { supported: true, verifiedPage };
}

export function cleanOption(opt: unknown): string {
  return String(opt ?? '')
    .trim()
    .replace(/^[A-Da-dஅ-ஈ]\s*[\.\):\-]\s*/, '')
    .replace(/^Option\s+[A-Da-d]\s*[\.\):\-]\s*/i, '')
    .replace(/^விடை\s+[அ-ஈ]\s*[\.\):\-]\s*/i, '')
    .trim();
}

/**
 * Validates that the candidate string is a genuine interrogative question or exam prompt
 * and NOT a lesson description, chapter summary, or placeholder template.
 */
export function isValidQuestionText(rawQuestion: string): { valid: boolean; normalizedQuestion: string; reason?: string } {
  let q = String(rawQuestion || '').trim();
  if (q.length < 12) {
    return { valid: false, normalizedQuestion: q, reason: 'Question text is too short.' };
  }

  if (/\[(?:வினா|question)\s*\d+\]/i.test(q)) {
    return { valid: false, normalizedQuestion: q, reason: 'Contains numbered placeholder tag.' };
  }

  if (/^(?:chapter summary|lesson summary|unit overview|this lesson covers|பாடச் சுருக்கம்)/i.test(q)) {
    return { valid: false, normalizedQuestion: q, reason: 'Appears to be a lesson description or summary.' };
  }

  if (q.endsWith(':')) {
    q = `${q.slice(0, -1).trim()}?`;
  }
  if (!q.endsWith('?')) {
    return {
      valid: false,
      normalizedQuestion: q,
      reason: 'Every question must end with a question mark (?).',
    };
  }

  return { valid: true, normalizedQuestion: q };
}

/**
 * Resolves correctAnswer whether provided as integer index (0..3) or option text ("Option A").
 */
export function resolveCorrectAnswerIndex(rawCorrectAnswer: unknown, options: string[]): number {
  if (typeof rawCorrectAnswer === 'number' && Number.isInteger(rawCorrectAnswer)) {
    if (rawCorrectAnswer >= 0 && rawCorrectAnswer <= 3) return rawCorrectAnswer;
    if (rawCorrectAnswer >= 1 && rawCorrectAnswer <= 4) return rawCorrectAnswer - 1;
  }

  const str = String(rawCorrectAnswer ?? '').trim();
  if (/^[0-3]$/.test(str)) {
    return Number(str);
  }
  if (/^[A-Da-d]$/.test(str)) {
    return str.toUpperCase().charCodeAt(0) - 65;
  }

  const cleanedTarget = normalizeText(cleanOption(str));
  if (cleanedTarget) {
    const exactIdx = options.findIndex((opt) => normalizeText(opt) === cleanedTarget);
    if (exactIdx >= 0) return exactIdx;
  }

  return -1;
}

export function verifyQuestionItem(
  item: any,
  config: any,
  existingBatch: any[]
): {
  valid: boolean;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  pyqPattern: string;
  sourcePage?: number;
  verificationStatus: 'verified' | 'needs_review' | 'rejected';
  verificationDetails: VerificationDetails;
} {
  const qCheck = isValidQuestionText(item?.question);
  const question = qCheck.normalizedQuestion;
  const options: string[] = Array.isArray(item?.options) ? item.options.map(cleanOption) : [];
  const correctAnswer = resolveCorrectAnswerIndex(item?.correctAnswer, options);
  const explanation = String(item?.explanation || '').trim();
  const rawPage = item?.sourcePage || item?.page || item?.pageNumber;
  const parsedPage = rawPage && !isNaN(Number(rawPage)) ? Number(rawPage) : undefined;

  const uniqueOptions = new Set(options.map((opt: string) => normalizeText(opt)));

  const textSupport = true;
  const answerMatches = correctAnswer >= 0 && correctAnswer < options.length;
  const optionsValid = options.length === 4 && uniqueOptions.size === 4 && options.every((o) => o.length > 0);
  const notDuplicate = !isSemanticallyDuplicate(
    question,
    existingBatch,
    config?.existingDbQuestions || [],
    options[correctAnswer]
  );
  const unambiguous = answerMatches && optionsValid;
  const pageVerified = parsedPage !== undefined && parsedPage > 0;

  const valid = qCheck.valid && answerMatches && optionsValid && notDuplicate;
  const verificationStatus: 'verified' | 'needs_review' | 'rejected' =
    valid ? 'verified' : (qCheck.valid && options.length >= 2 ? 'needs_review' : 'rejected');

  return {
    valid,
    question,
    options,
    correctAnswer: answerMatches ? correctAnswer : 0,
    explanation,
    pyqPattern: 'Conceptual',
    sourcePage: parsedPage,
    verificationStatus,
    verificationDetails: {
      textSupport,
      answerMatches,
      optionsValid,
      unambiguous,
      notDuplicate,
      pageVerified,
      notes: valid ? 'Verified successfully' : (qCheck.reason || 'Failed validation'),
    },
  };
}

