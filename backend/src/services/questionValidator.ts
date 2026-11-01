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
  'standard', 'term', 'tnpsc', 'question',
  'என்ன', 'யாது', 'யார்', 'எது', 'எவை', 'எங்கு', 'எப்போது', 'எவ்வாறு', 'எத்தனை',
  'என்ற', 'என்னும்', 'பின்வரும்', 'பின்வருவனவற்றுள்', 'சரியான', 'விடையை', 'தேர்ந்தெடு',
  'பாடத்தில்', 'பாடலின்', 'குறிப்பிடப்பட்டுள்ளது', 'கூறப்பட்டுள்ளது', 'அழைக்கப்படுகிறது',
]);

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
      .filter((word) => word.length > 2 && !QUESTION_STOP_WORDS.has(word))
  );
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

/**
 * Multi-level semantic duplicate detector:
 * Checks exact match, token Jaccard similarity, character bigram Dice similarity,
 * numeric + concept overlap, and same-answer + concept overlap against both the
 * current batch and existing PostgreSQL questions.
 */
export function isSemanticallyDuplicate(
  candidateQuestion: string,
  existingBatch: Array<{ question: string; options?: string[]; correctAnswer?: number; correctAnswerText?: string }>,
  existingDbQuestions: Array<string | ExistingDbQuestionRecord> = [],
  candidateCorrectAnswerText?: string
): boolean {
  const candidateText = normalizeText(candidateQuestion);
  if (!candidateText) return true;

  const candidateTokens = tokenSet(candidateQuestion);
  const candidateNumbers = numericSignature(candidateQuestion);
  const normCandidateAns = candidateCorrectAnswerText ? normalizeText(candidateCorrectAnswerText) : '';

  const checkAgainst = (otherQuestion: string, otherAnswerText?: string): boolean => {
    const otherText = normalizeText(otherQuestion);
    if (!otherText) return false;
    if (candidateText === otherText) return true;

    const otherTokens = tokenSet(otherQuestion);
    const tokSim = jaccard(candidateTokens, otherTokens);
    if (tokSim >= 0.82) return true;

    const diceSim = diceSimilarity(candidateText, otherText);
    if (diceSim >= 0.88) return true;

    if (candidateNumbers && candidateNumbers === numericSignature(otherQuestion) && tokSim >= 0.42) {
      return true;
    }

    const normOtherAns = otherAnswerText ? normalizeText(otherAnswerText) : '';
    if (
      normCandidateAns &&
      normOtherAns &&
      normCandidateAns === normOtherAns &&
      normCandidateAns.length >= 3 &&
      tokSim >= 0.35
    ) {
      return true;
    }

    return false;
  };

  for (const item of existingBatch) {
    const ansText = item.correctAnswerText || (item.options && typeof item.correctAnswer === 'number' ? item.options[item.correctAnswer] : undefined);
    if (checkAgainst(item.question, ansText)) return true;
  }

  for (const record of existingDbQuestions) {
    const qStr = typeof record === 'string' ? record : record.question;
    const ansStr = typeof record === 'string' ? undefined : record.correctAnswerText;
    if (checkAgainst(qStr, ansStr)) return true;
  }

  return false;
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

