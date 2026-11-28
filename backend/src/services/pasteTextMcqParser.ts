import crypto from 'crypto';

export interface PasteImportMetadata {
  category?: string;
  subject?: string;
  classId?: number | null;
  unitId?: number;
  lessonTitle?: string;
  lessonId?: string | null;
  topic?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  language?: 'english' | 'tamil' | 'bilingual';
  targetSystem?: 'study_materials' | 'main_practice';
  sourceReference?: string | null;
}

export type AnswerLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ParsedPasteMcqItem {
  sourceOrder: number;
  originalNumber: string;
  sourceQuestionId: string;
  question: string;
  questionText: string;
  options: string[]; // 4 options (A-D) or 5 options (A-E) preserved in original order
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string | null;
  originalAnswerText: string | null;
  correctAnswer: number | null; // 0..4 or null if missing
  correctAnswerLetter: AnswerLetter | null;
  explanation: string;
  rawSourceBlock: string;
  valid: boolean;
  issues: string[];
  // Canonical metadata fields for direct staging compatibility
  category: string;
  subject: string;
  classId: number | null;
  unitId: number;
  lessonTitle: string;
  lessonId: string | null;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  language: 'english' | 'tamil' | 'bilingual';
  targetSystem: 'study_materials' | 'main_practice';
  sourceReference: string | null;
  sourceType: 'paste_text_json';
}

export type PreambleCategory = 'document_title' | 'instructions' | 'source_metadata' | 'unrecognized';

export interface PreambleItem {
  lineNumber: number;
  category: PreambleCategory;
  text: string;
}

export interface PasteTextParseResult {
  sourceSha256: string;
  charCount: number;
  expectedQuestions: number;
  estimatedQuestions: number;
  detectedQuestions: number;
  validQuestions: number;
  invalidQuestions: number;
  missingAnswers: number;
  missingOptions: number;
  duplicateOriginalNumbers: string[];
  preambleItems: PreambleItem[];
  unrecognizedBoundaries: string[];
  countMismatch: boolean;
  canStage: boolean;
  errors: string[];
  warnings: string[];
  questions: ParsedPasteMcqItem[];
}

const LETTERS: AnswerLetter[] = ['A', 'B', 'C', 'D', 'E'];
const TAMIL_LETTER_MAP: Record<string, number> = {
  'அ': 0,
  'ஆ': 1,
  'இ': 2,
  'ஈ': 3,
  'உ': 4,
};

// Horizontal divider line in Markdown (e.g. --- or ***)
const MD_DIVIDER_RE = /^\s*(?:[-*_]\s*){3,}$/;

/**
 * Strip leading Markdown heading/bullet/bold wrappers ONLY for structural pattern detection.
 * Returns the cleaned prefix-free text for regex matching without mutating source content.
 */
function unwrapLineForDetection(rawLine: string): string {
  let s = rawLine.trim();
  // Strip leading Markdown heading markers (###, ##, #)
  s = s.replace(/^#{1,6}\s+/, '');
  // Strip leading blockquote marker
  s = s.replace(/^>\s*/, '');
  // Strip leading bullet markers (- , * , • ) ONLY when followed by whitespace
  s = s.replace(/^[-*•]\s+/, '');
  return s;
}

/**
 * Strip surrounding Markdown emphasis (**...**, *...*, __...__) from a structural token or header line.
 */
function stripEdgeMarkdown(s: string): string {
  return s.replace(/^[*_]+/, '').replace(/[*_]+$/, '').trim();
}

// Explicit question prefix (after unwrapping ### / bullet):
// Matches: Q1., Q.1, Q 1., Q200, Q200., **Q1.**, **Q200**, Q.No.1, Q.No: 1, Question 1., Question No. 1, கேள்வி 1., வினா 1.
const EXPLICIT_Q_RE =
  /^(?:[*_]{1,3})?(?:Q(?:uestion|ues|No)?\.?\s*(?:No\.?\s*[:.]?\s*)?#?|கேள்வி(?:\s*எண்)?\.?\s*[:.]?\s*|வினா(?:\s*எண்)?\.?\s*[:.]?\s*)(\d{1,5})(?:[*_]{1,3})?\s*(?:[.):\-–—]|$|\s)(?:[*_]{1,3})?\s*(.*)$/i;

// Bare numeric question prefix (after unwrapping ### / bullet):
// Matches: 1., 1), (1), [1], 1:, **1.**
const BARE_NUM_Q_RE =
  /^(?:[*_]{1,3})?(?:\((\d{1,5})\)|\[(\d{1,5})\]|(\d{1,5})\s*[.):])(?:[*_]{1,3})?\s*(.*)$/;

// Answer key section header at end of document
const ANSWER_KEY_HEADER_RE =
  /^(?:[*_]{1,3})?(?:ANSWER\s*KEY|ANSWERS|OFFICIAL\s*KEY|விடைக்குறிப்பு|விடைகள்)\s*:?(?:[*_]{1,3})?\s*$/i;

// Single-line option start (supports A-E and Tamil அ-உ, with optional Markdown bold/bullets):
// Matches: (A) text, A) text, A. text, A: text, [A] text, **(A)** text, **A)** text, - (A) text, - **(A)** text
const OPTION_LINE_RE =
  /^(?:[*_]{1,3})?(?:\(([A-Ea-eஅஆஇஈஉ])\)|\[([A-Ea-eஅஆஇஈஉ])\]|([A-Ea-eஅஆஇஈஉ])\s*[.):])(?:[*_]{1,3})?\s*(.*)$/;

// Answer line (supports Markdown bold/italics/bullets/headings, including **Answer:** **...**):
// Matches: Answer: A, Answer: (A), **Answer: (A)**, **Answer:** (A), **Correct Answer: (B)**, Ans: C, Ans. C, விடை: அ, சரியான விடை: ஆ
const ANSWER_LINE_RE =
  /^(?:[*_]{1,3})?(?:Correct\s*Answer|Correct\s*Option|Right\s*Answer|Answer|Ans\.|Ans|Key|சரியான\s*விடை|விடை)(?:[*_]{1,3})?(?:\s*[:\-–—=]\s*(?:[*_]{1,3})?\s*|\s+is\s+|\s+)(.*)$/i;

// Explanation line (supports Markdown bold/italics/bullets/headings):
// Matches: Explanation:, **Explanation:**, ### Explanation, Exp:, Solution:, Sol:, விளக்கம்:, குறிப்பு:
const EXPLANATION_LINE_RE =
  /^(?:[*_]{1,3})?(?:Explanation|Exp\.?|Solution|Sol\.?|Rationale|விளக்கம்|குறிப்பு)(?:[*_]{1,3})?\s*(?:[:\-–—]\s*(?:[*_]{1,3})?\s*|$)(.*)$/i;

// Standalone Markdown section heading between parts (e.g. "## Part-C: General English (Questions 101-200)")
const MD_PART_HEADING_RE = /^\s*#{1,3}\s+(?:Part[\s\-–—]*[A-Z0-9]|Section[\s\-–—]*[A-Z0-9]|பகுதி)/i;

function classifyPreambleLine(rawLine: string): PreambleCategory {
  const trimmed = rawLine.trim();
  const unwrapped = stripEdgeMarkdown(unwrapLineForDetection(trimmed));
  if (/^#{1,6}\s+/.test(trimmed)) return 'document_title';
  if (/^(?:Note|Instructions?|Directions?|Important|Warning|குறிப்பு|அறிவுரை)\s*[:\-–—]/i.test(unwrapped)) {
    return 'instructions';
  }
  if (/^(?:Exam|Paper|Subject|Total\s*Questions?|Time|Duration|Marks|Year|Group|Medium|Code|Date|Booklet|Source|Part[\s\-–—]*[A-Z]|தேர்வு|பாடம்)\s*[:\-–—]/i.test(unwrapped)) {
    return 'source_metadata';
  }
  return 'unrecognized';
}

function mapOptionLetterToIndex(rawLetter: string): number {
  const trimmed = rawLetter.trim();
  if (trimmed in TAMIL_LETTER_MAP) return TAMIL_LETTER_MAP[trimmed];
  const upper = trimmed.toUpperCase();
  const idx = LETTERS.indexOf(upper as AnswerLetter);
  return idx >= 0 ? idx : -1;
}

/**
 * Detect inline options on a single line like:
 *   A) Kilogram   B) Metre   C) Second   D) Kelvin
 *   (A) One (B) Two (C) Three (D) Four (E) Answer not known
 *   அ) ஒன்று  ஆ) இரண்டு  இ) மூன்று  ஈ) நான்கு
 */
function splitInlineOptions(rawLine: string): Array<{ index: number; text: string }> | null {
  const line = unwrapLineForDetection(rawLine);
  const tokenRe =
    /(?:^|\t|\s{2,})(?:[*_]{1,2})?(?:\(([A-Ea-eஅஆஇஈஉ])\)|\[([A-Ea-eஅஆஇஈஉ])\]|([A-Ea-eஅஆஇஈஉ])([.)]))(?:[*_]{1,2})?\s+|(?:\s)(?:[*_]{1,2})?(?:\(([A-Ea-eஅஆஇஈஉ])\)|\[([A-Ea-eஅஆஇஈஉ])\]|([A-Ea-eஅஆஇஈஉ])(\)))(?:[*_]{1,2})?\s+/g;
  const matches: Array<{ index: number; matchStart: number; textStart: number; style: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(line)) !== null) {
    const letter = m[1] || m[2] || m[3] || m[5] || m[6] || m[7] || '';
    const optIdx = mapOptionLetterToIndex(letter);
    if (optIdx < 0) continue;
    const style = m[1] || m[5] ? 'paren' : m[2] || m[6] ? 'bracket' : m[4] || m[8] || 'dot';
    matches.push({
      index: optIdx,
      matchStart: m.index,
      textStart: m.index + m[0].length,
      style,
    });
  }
  if (matches.length < 2) return null;

  if (matches[0].matchStart > 2) return null;
  const firstStyle = matches[0].style;
  for (let i = 1; i < matches.length; i++) {
    if (matches[i].index <= matches[i - 1].index) return null;
    if (matches[i].style !== firstStyle) return null;
  }

  const out: Array<{ index: number; text: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].textStart;
    const end = i + 1 < matches.length ? matches[i + 1].matchStart : line.length;
    out.push({
      index: matches[i].index,
      text: line.slice(start, end).trim(),
    });
  }
  return out;
}

function matchOptionLine(rawLine: string): { index: number; text: string; isLowerLatin: boolean } | null {
  const unwrapped = unwrapLineForDetection(rawLine);
  if (!unwrapped) return null;
  const optM = OPTION_LINE_RE.exec(unwrapped);
  if (!optM) return null;
  const letter = optM[1] || optM[2] || optM[3] || '';
  const idx = mapOptionLetterToIndex(letter);
  if (idx < 0) return null;
  const isLowerLatin = /^[a-e]$/.test(letter);
  return { index: idx, text: (optM[4] || '').trimEnd(), isLowerLatin };
}

function matchExplicitQuestionHeader(rawLine: string): { originalNumber: string; body: string } | null {
  const unwrapped = unwrapLineForDetection(rawLine);
  if (!unwrapped) return null;
  const m = EXPLICIT_Q_RE.exec(unwrapped);
  if (!m) return null;
  const numStr = m[1];
  let body = (m[2] || '').trimEnd();
  // If entire heading was wrapped in **...**, strip lone trailing **
  if (/^\*{1,3}/.test(unwrapped) && /\*{1,3}$/.test(body) && !/^\*{1,3}/.test(body)) {
    body = body.replace(/\*{1,3}$/, '').trimEnd();
  }
  return { originalNumber: numStr, body };
}

function matchBareNumericHeader(rawLine: string): { originalNumber: string; body: string } | null {
  const unwrapped = unwrapLineForDetection(rawLine);
  if (!unwrapped) return null;
  const m = BARE_NUM_Q_RE.exec(unwrapped);
  if (!m) return null;
  const numStr = m[1] || m[2] || m[3] || '';
  const numVal = Number(numStr);
  // Guard against years like "1947." or "2024." being misread as bare question numbers
  if (numVal > 1500) return null;
  let body = (m[4] || '').trimEnd();
  if (/^\*{1,3}/.test(unwrapped) && /\*{1,3}$/.test(body) && !/^\*{1,3}/.test(body)) {
    body = body.replace(/\*{1,3}$/, '').trimEnd();
  }
  return { originalNumber: numStr, body };
}

function matchAnswerLine(rawLine: string): { rawLineTrimmed: string; body: string } | null {
  const unwrapped = unwrapLineForDetection(rawLine);
  if (!unwrapped) return null;
  const m = ANSWER_LINE_RE.exec(unwrapped);
  if (!m) return null;
  return { rawLineTrimmed: rawLine.trim(), body: (m[1] || '').trim() };
}

function matchExplanationLine(rawLine: string): { body: string } | null {
  const unwrapped = unwrapLineForDetection(rawLine);
  if (!unwrapped) return null;
  const m = EXPLANATION_LINE_RE.exec(unwrapped);
  if (!m) return null;
  return { body: (m[1] || '').trimEnd() };
}

/**
 * Look ahead up to 18 non-empty lines to verify whether a candidate bare-number line
 * is actually followed by MCQ options (A/B) before another explicit question header.
 */
function looksLikeQuestionAhead(lines: string[], startIdx: number): boolean {
  let sawOptionA = false;
  let sawOptionB = false;
  let inspected = 0;
  for (let i = startIdx + 1; i < lines.length && inspected < 18; i++) {
    const l = lines[i];
    if (!l.trim() || MD_DIVIDER_RE.test(l)) continue;
    inspected++;
    if (matchExplicitQuestionHeader(l)) break;
    const inline = splitInlineOptions(l);
    if (inline) {
      if (inline.some((o) => o.index === 0)) sawOptionA = true;
      if (inline.some((o) => o.index === 1)) sawOptionB = true;
    } else {
      const opt = matchOptionLine(l);
      if (opt) {
        if (opt.index === 0) sawOptionA = true;
        if (opt.index === 1) sawOptionB = true;
      }
    }
    if (sawOptionA && sawOptionB) return true;
  }
  return sawOptionA;
}

/**
 * Extract trailing Answer Key block (if present at end of pasted text).
 */
function extractTrailingAnswerKey(lines: string[]): {
  bodyLines: string[];
  answerKeyMap: Map<string, string>;
} {
  const answerKeyMap = new Map<string, string>();
  let headerIdx = -1;
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 300); i--) {
    const unwrapped = unwrapLineForDetection(lines[i]);
    if (ANSWER_KEY_HEADER_RE.test(unwrapped)) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return { bodyLines: lines, answerKeyMap };

  const tailText = lines.slice(headerIdx + 1).join('\n');
  const pairRe = /(?:Q\.?\s*)?(\d{1,5})\s*[.):\-–—]\s*\(?([A-Ea-eஅஆஇஈஉ])\)?/g;
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(tailText)) !== null) {
    answerKeyMap.set(m[1], m[2]);
  }
  if (answerKeyMap.size === 0) return { bodyLines: lines, answerKeyMap };
  return { bodyLines: lines.slice(0, headerIdx), answerKeyMap };
}

/**
 * Resolve answer token (e.g. "(A)", "**(A)**", "B", "Option B", "B) Metre", "ஆ", or exact option text)
 * into 0..4 index without altering any option text.
 * Detects multi-answer notation (e.g. "A, C" or "(A) and (C)") without guessing.
 */
function resolveAnswerIndexExact(
  rawAnswer: string | null | undefined,
  options: string[]
): { index: number | null; multiAnswers: AnswerLetter[] | null } {
  if (!rawAnswer) return { index: null, multiAnswers: null };
  const cleaned = stripEdgeMarkdown(rawAnswer.trim());
  if (!cleaned) return { index: null, multiAnswers: null };

  // Detect explicit multi-answer formats like "A, C", "(A), (C)", "A and C", "A / C"
  const multiRe =
    /^(?:\(?([A-Ea-eஅஆஇஈஉ])\)?(?:\s*(?:,|\/|&|\band\b|\bor\b)\s*\(?([A-Ea-eஅஆஇஈஉ])\)?)+)$/i;
  if (multiRe.test(cleaned)) {
    const tokens = cleaned.match(/[A-Ea-eஅஆஇஈஉ]/g) || [];
    const mapped = Array.from(
      new Set(
        tokens
          .map((t) => mapOptionLetterToIndex(t))
          .filter((i) => i >= 0)
          .map((i) => LETTERS[i])
      )
    );
    if (mapped.length > 1) {
      return { index: null, multiAnswers: mapped };
    }
  }

  // Direct letter / parenthesized letter / bracketed letter / "Option B" / "B) text"
  const directRe =
    /^(?:option\s*)?(?:[*_]{1,2})?(?:\(([A-Ea-eஅஆஇஈஉ])\)|\[([A-Ea-eஅஆஇஈஉ])\]|([A-Ea-eஅஆஇஈஉ])(?:\s*[.):\-–—]|\s|$))(?:[*_]{1,2})?/i;
  const dm = directRe.exec(cleaned);
  if (dm) {
    const token = dm[1] || dm[2] || dm[3] || '';
    const idx = mapOptionLetterToIndex(token);
    if (idx >= 0) return { index: idx, multiAnswers: null };
  }

  // Exact match against one of the options
  const exactIdx = options.findIndex((opt) => opt.trim() !== '' && opt.trim() === cleaned);
  if (exactIdx >= 0) return { index: exactIdx, multiAnswers: null };

  const lower = cleaned.toLowerCase();
  const ciIdx = options.findIndex((opt) => opt.trim() !== '' && opt.trim().toLowerCase() === lower);
  if (ciIdx >= 0) return { index: ciIdx, multiAnswers: null };

  // Numeric 1..5 if explicitly "Option 2" or standalone digit 1..5
  const numM = /^(?:option\s*)?([1-5])$/i.exec(cleaned);
  if (numM) return { index: Number(numM[1]) - 1, multiAnswers: null };

  return { index: null, multiAnswers: null };
}

interface RawQuestionBlock {
  originalNumber: string;
  firstLineBody: string;
  rawLines: string[];
}

/**
 * Deterministic anchored structural splitter that preserves every character of every block.
 */
export function splitIntoQuestionBlocks(lines: string[]): {
  blocks: RawQuestionBlock[];
  preambleItems: PreambleItem[];
  unrecognizedBoundaries: string[];
} {
  const blocks: RawQuestionBlock[] = [];
  const preambleItems: PreambleItem[] = [];
  const unrecognizedBoundaries: string[] = [];
  let current: RawQuestionBlock | null = null;
  let currentHasOptions = false;
  let currentInExplanation = false;
  let currentHasAnswer = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip standalone Markdown horizontal rules between questions
    if (MD_DIVIDER_RE.test(line)) {
      continue;
    }

    // Skip mid-document standalone part headings (e.g. "## Part-C: General English (Questions 101-200)")
    if (current && MD_PART_HEADING_RE.test(line) && !matchExplicitQuestionHeader(line)) {
      continue;
    }

    // 1. Explicit question header (Q1., ### Q200, **Q1.**, Q.No: 1, Question No. 1, கேள்வி 1.)
    const expQ = matchExplicitQuestionHeader(line);
    if (expQ) {
      const isValidBoundary = !currentInExplanation || looksLikeQuestionAhead(lines, i) || /^#{1,6}\s/.test(line.trim());
      if (isValidBoundary) {
        if (current) blocks.push(current);
        current = {
          originalNumber: expQ.originalNumber,
          firstLineBody: expQ.body,
          rawLines: [line],
        };
        currentHasOptions = false;
        currentInExplanation = false;
        currentHasAnswer = false;
        continue;
      }
    }

    // 2. Bare numeric question header (1., 1), (1), [1], 1:)
    const bareQ = matchBareNumericHeader(line);
    if (bareQ) {
      let isNewQuestion = false;
      if (!current) {
        isNewQuestion = looksLikeQuestionAhead(lines, i);
      } else if (currentInExplanation) {
        isNewQuestion = looksLikeQuestionAhead(lines, i);
      } else if (currentHasOptions || currentHasAnswer) {
        isNewQuestion = currentHasAnswer || looksLikeQuestionAhead(lines, i);
      } else {
        isNewQuestion = false;
      }

      if (isNewQuestion) {
        if (current) blocks.push(current);
        current = {
          originalNumber: bareQ.originalNumber,
          firstLineBody: bareQ.body,
          rawLines: [line],
        };
        currentHasOptions = false;
        currentInExplanation = false;
        currentHasAnswer = false;
        continue;
      }
    }

    if (!current) {
      if (!line.trim()) continue;
      // Classify preamble lines before Question 1 (never attach to Q1, never discard silently)
      const category = classifyPreambleLine(line);
      if (category === 'unrecognized' && looksLikeQuestionAhead(lines, i)) {
        current = {
          originalNumber: '1',
          firstLineBody: line.trimEnd(),
          rawLines: [line],
        };
        currentHasOptions = false;
        currentInExplanation = false;
        currentHasAnswer = false;
      } else {
        preambleItems.push({
          lineNumber: i + 1,
          category,
          text: line.trim(),
        });
        if (category === 'unrecognized' && unrecognizedBoundaries.length < 20) {
          unrecognizedBoundaries.push(line.trim().slice(0, 120));
        }
      }
      continue;
    }

    // Track structural state within current block
    if (matchExplanationLine(line)) {
      currentInExplanation = true;
    } else if (!currentInExplanation && matchAnswerLine(line)) {
      currentHasAnswer = true;
    } else if (!currentInExplanation && (splitInlineOptions(line) || matchOptionLine(line))) {
      currentHasOptions = true;
    }

    current.rawLines.push(line);
  }

  if (current) blocks.push(current);
  return { blocks, preambleItems, unrecognizedBoundaries };
}

/**
 * Parse a single raw question block structurally without altering source wording.
 */
function parseQuestionBlock(
  block: RawQuestionBlock,
  sourceOrder: number,
  answerKeyMap: Map<string, string>,
  meta: Required<
    Pick<
      PasteImportMetadata,
      'category' | 'subject' | 'unitId' | 'lessonTitle' | 'topic' | 'difficulty' | 'language' | 'targetSystem'
    >
  > & { classId: number | null; lessonId: string | null; sourceReference: string | null }
): ParsedPasteMcqItem {
  const questionLines: string[] = [];
  const optionLines: [string[], string[], string[], string[], string[]] = [[], [], [], [], []];
  const explanationLines: string[] = [];
  let rawAnswerText: string | null = null;
  let originalAnswerText: string | null = null;

  let activeSection: 'question' | 'option' | 'answer' | 'explanation' = 'question';
  let activeOptionIdx = -1;

  if (block.firstLineBody.trim()) {
    questionLines.push(block.firstLineBody.trimEnd());
  }

  // Detect Match-the-following pattern: lowercase (a)-(d) sub-items inside the question stem
  // followed by uppercase (A)-(D)/(E) actual MCQ options. When detected, keep lowercase (a)-(d)
  // lines verbatim inside questionLines so they are never mistaken for options!
  let hasLowerLatinBeforeUpper = false;
  {
    let firstUpperIdx = -1;
    let upperCount = 0;
    let lowerBeforeUpperCount = 0;
    for (let i = 1; i < block.rawLines.length; i++) {
      const rl = block.rawLines[i];
      if (matchAnswerLine(rl) || matchExplanationLine(rl)) break;
      const om = matchOptionLine(rl);
      if (om) {
        if (!om.isLowerLatin) {
          if (firstUpperIdx === -1) firstUpperIdx = i;
          upperCount++;
        } else if (firstUpperIdx === -1) {
          lowerBeforeUpperCount++;
        }
      }
    }
    if (upperCount >= 2 && lowerBeforeUpperCount >= 2) {
      hasLowerLatinBeforeUpper = true;
    }
  }

  for (let i = 1; i < block.rawLines.length; i++) {
    const rawLine = block.rawLines[i];
    const trimmed = rawLine.trim();

    if (MD_DIVIDER_RE.test(rawLine)) continue;

    // 1. Check Explanation header
    const expM = matchExplanationLine(rawLine);
    if (expM) {
      activeSection = 'explanation';
      activeOptionIdx = -1;
      if (expM.body.trim()) explanationLines.push(expM.body.trimEnd());
      continue;
    }

    // 2. Check Answer header (never inside explanation)
    if (activeSection !== 'explanation') {
      const ansM = matchAnswerLine(rawLine);
      if (ansM) {
        activeSection = 'answer';
        activeOptionIdx = -1;
        originalAnswerText = ansM.rawLineTrimmed;
        const ansBody = ansM.body;
        const inlineExpIdx = ansBody.search(/\s+(?:[*_]{1,2})?(?:Explanation|Exp\.?|விளக்கம்)(?:[*_]{1,2})?\s*[:\-–—]/i);
        if (inlineExpIdx > 0) {
          rawAnswerText = ansBody.slice(0, inlineExpIdx).trim();
          const expPart = ansBody
            .slice(inlineExpIdx)
            .replace(/^\s*(?:[*_]{1,2})?(?:Explanation|Exp\.?|விளக்கம்)(?:[*_]{1,2})?\s*[:\-–—]\s*/i, '');
          if (expPart.trim()) explanationLines.push(expPart.trimEnd());
          activeSection = 'explanation';
        } else {
          rawAnswerText = ansBody;
        }
        continue;
      }
    }

    // 3. Check Options (only when in question or option section — never mistake answer/explanation refs for options)
    if (activeSection === 'question' || activeSection === 'option') {
      const inlineOpts = splitInlineOptions(rawLine);
      if (inlineOpts) {
        activeSection = 'option';
        for (const opt of inlineOpts) {
          if (opt.text) optionLines[opt.index].push(opt.text);
          activeOptionIdx = opt.index;
        }
        continue;
      }

      const optM = matchOptionLine(rawLine);
      if (optM && !(hasLowerLatinBeforeUpper && optM.isLowerLatin)) {
        activeSection = 'option';
        activeOptionIdx = optM.index;
        if (optM.text.trim()) optionLines[optM.index].push(optM.text.trim());
        continue;
      }
    }

    // 4. Continuation lines: preserve multiline content verbatim
    if (activeSection === 'question') {
      if (trimmed || questionLines.length > 0) {
        questionLines.push(rawLine.trimEnd());
      }
    } else if (activeSection === 'option' && activeOptionIdx >= 0) {
      if (trimmed) {
        optionLines[activeOptionIdx].push(trimmed);
      }
    } else if (activeSection === 'explanation') {
      if (trimmed || explanationLines.length > 0) {
        explanationLines.push(rawLine.trimEnd());
      }
    } else if (activeSection === 'answer') {
      if (!rawAnswerText && trimmed) {
        rawAnswerText = trimmed;
        originalAnswerText = originalAnswerText ? `${originalAnswerText} ${trimmed}` : trimmed;
      } else if (trimmed) {
        explanationLines.push(rawLine.trimEnd());
        activeSection = 'explanation';
      }
    }
  }

  const questionText = questionLines.join('\n').trim();
  const optA = optionLines[0].join('\n').trim();
  const optB = optionLines[1].join('\n').trim();
  const optC = optionLines[2].join('\n').trim();
  const optD = optionLines[3].join('\n').trim();
  const optE = optionLines[4].join('\n').trim();
  const hasOptionE = optE.length > 0;

  // Preserve 5 options (A-E) if E exists, otherwise 4 options (A-D)
  const options: string[] = hasOptionE ? [optA, optB, optC, optD, optE] : [optA, optB, optC, optD];
  const explanation = explanationLines.join('\n').trim();

  // Fallback to trailing Answer Key only if inline answer is absent
  if (!rawAnswerText && answerKeyMap.has(block.originalNumber)) {
    rawAnswerText = answerKeyMap.get(block.originalNumber) || null;
    originalAnswerText = rawAnswerText;
  }

  const resolvedAns = resolveAnswerIndexExact(rawAnswerText, options);
  const correctAnswer = resolvedAns.index;
  const correctAnswerLetter = correctAnswer !== null ? LETTERS[correctAnswer] : null;

  const issues: string[] = [];
  if (!questionText) issues.push('Missing question text');
  const missingOptLetters: string[] = [];
  for (let idx = 0; idx < 4; idx++) {
    if (!options[idx]) missingOptLetters.push(LETTERS[idx]);
  }
  if (missingOptLetters.length > 0) {
    issues.push(`Missing option(s): ${missingOptLetters.join(', ')}`);
  }
  if (correctAnswer === null) {
    if (resolvedAns.multiAnswers) {
      issues.push(
        `Multiple answers listed (${resolvedAns.multiAnswers.join(', ')}) — select a single canonical answer during review`
      );
    } else if (rawAnswerText) {
      const cleanNote = stripEdgeMarkdown(rawAnswerText);
      issues.push(
        /expert\s*committee/i.test(cleanNote)
          ? `No final answer key in source (Expert Committee decision pending): "${cleanNote}"`
          : `Unrecognized answer "${cleanNote}"`
      );
    } else {
      issues.push('Missing correct answer');
    }
  } else if (correctAnswer >= options.length || !options[correctAnswer]) {
    issues.push(`Answer (${LETTERS[correctAnswer]}) points to an empty option`);
  }

  const rawSourceBlock = block.rawLines.join('\n').trim();

  return {
    sourceOrder,
    originalNumber: block.originalNumber,
    sourceQuestionId: `Q${block.originalNumber}#${sourceOrder}`,
    question: questionText,
    questionText,
    options,
    optionA: optA,
    optionB: optB,
    optionC: optC,
    optionD: optD,
    optionE: hasOptionE ? optE : null,
    originalAnswerText,
    correctAnswer,
    correctAnswerLetter,
    explanation,
    rawSourceBlock,
    valid: issues.length === 0,
    issues,
    category: meta.category,
    subject: meta.subject,
    classId: meta.classId,
    unitId: meta.unitId,
    lessonTitle: meta.lessonTitle,
    lessonId: meta.lessonId,
    topic: meta.topic,
    difficulty: meta.difficulty,
    language: meta.language,
    targetSystem: meta.targetSystem,
    sourceReference: meta.sourceReference,
    sourceType: 'paste_text_json',
  };
}

/**
 * Main lossless deterministic parser:
 * Paste Text -> Exact Canonical JSON + Strict Validation Report.
 */
export function parsePasteTextToCanonicalJson(
  rawSourceText: string,
  expectedQuestions: number,
  metadata: PasteImportMetadata = {}
): PasteTextParseResult {
  const normalizedLineEndings = String(rawSourceText || '').replace(/\r\n?/g, '\n');
  const sourceSha256 = crypto.createHash('sha256').update(normalizedLineEndings, 'utf8').digest('hex');

  const safeExpected =
    Number.isFinite(Number(expectedQuestions)) && Number(expectedQuestions) > 0
      ? Math.floor(Number(expectedQuestions))
      : 0;

  const resolvedCategory = (metadata.category || 'group4').trim().toLowerCase();
  const resolvedSubject = (metadata.subject || 'General Studies').trim();
  const resolvedUnitId = Math.max(1, Math.min(20, Number(metadata.unitId || 1) || 1));
  const resolvedClassId = metadata.classId !== undefined && metadata.classId !== null ? Number(metadata.classId) : 6;
  const resolvedLessonTitle = (metadata.lessonTitle || metadata.topic || resolvedSubject || 'General Lesson').trim();
  const resolvedTopic = (metadata.topic || resolvedLessonTitle).trim();
  const resolvedDifficulty = (['Easy', 'Medium', 'Hard'].includes(String(metadata.difficulty))
    ? metadata.difficulty
    : 'Medium') as 'Easy' | 'Medium' | 'Hard';
  const resolvedLanguage = (['english', 'tamil', 'bilingual'].includes(String(metadata.language).toLowerCase())
    ? String(metadata.language).toLowerCase()
    : 'english') as 'english' | 'tamil' | 'bilingual';
  const resolvedTargetSystem: 'study_materials' | 'main_practice' =
    metadata.targetSystem === 'study_materials' ? 'study_materials' : 'main_practice';

  const resolvedMeta = {
    category: resolvedCategory,
    subject: resolvedSubject,
    classId: Number.isFinite(resolvedClassId) ? resolvedClassId : null,
    unitId: resolvedUnitId,
    lessonTitle: resolvedLessonTitle,
    lessonId: metadata.lessonId ? String(metadata.lessonId).trim() : null,
    topic: resolvedTopic,
    difficulty: resolvedDifficulty,
    language: resolvedLanguage,
    targetSystem: resolvedTargetSystem,
    sourceReference: metadata.sourceReference ? String(metadata.sourceReference).trim() : null,
  };

  if (!normalizedLineEndings.trim()) {
    return {
      sourceSha256,
      charCount: 0,
      expectedQuestions: safeExpected,
      estimatedQuestions: 0,
      detectedQuestions: 0,
      validQuestions: 0,
      invalidQuestions: 0,
      missingAnswers: 0,
      missingOptions: 0,
      duplicateOriginalNumbers: [],
      preambleItems: [],
      unrecognizedBoundaries: [],
      countMismatch: safeExpected > 0,
      canStage: false,
      errors: ['Paste Text input is empty.'],
      warnings: [],
      questions: [],
    };
  }

  const allLines = normalizedLineEndings.split('\n');
  const { bodyLines, answerKeyMap } = extractTrailingAnswerKey(allLines);
  const { blocks: rawBlocks, preambleItems, unrecognizedBoundaries } = splitIntoQuestionBlocks(bodyLines);

  const questions: ParsedPasteMcqItem[] = rawBlocks.map((block, idx) =>
    parseQuestionBlock(block, idx + 1, answerKeyMap, resolvedMeta)
  );

  const seenNumbers = new Map<string, number>();
  const duplicateOriginalNumbersSet = new Set<string>();
  let validQuestions = 0;
  let invalidQuestions = 0;
  let missingAnswers = 0;
  let missingOptions = 0;

  for (const q of questions) {
    const prevCount = seenNumbers.get(q.originalNumber) || 0;
    if (prevCount >= 1) duplicateOriginalNumbersSet.add(q.originalNumber);
    seenNumbers.set(q.originalNumber, prevCount + 1);

    if (q.correctAnswer === null) missingAnswers++;
    if (q.options.slice(0, 4).some((o) => !o)) missingOptions++;
    if (q.valid) validQuestions++;
    else invalidQuestions++;
  }

  const duplicateOriginalNumbers = Array.from(duplicateOriginalNumbersSet);
  const detectedQuestions = questions.length;
  const countMismatch = safeExpected > 0 && detectedQuestions !== safeExpected;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (detectedQuestions === 0) {
    errors.push('No MCQ questions could be detected from the pasted text.');
  }
  if (countMismatch) {
    errors.push(
      `Expected ${safeExpected} question(s), but detected ${detectedQuestions}. Please inspect and correct the source text or Expected Questions Count before staging.`
    );
  }
  if (invalidQuestions > 0) {
    errors.push(
      `${invalidQuestions} question(s) failed validation (${missingOptions} with missing options, ${missingAnswers} with missing/unrecognized answers). Fix them in the source text and re-validate.`
    );
  }
  if (duplicateOriginalNumbers.length > 0) {
    warnings.push(
      `Duplicate original question number(s) detected: ${duplicateOriginalNumbers.slice(0, 20).join(', ')}${duplicateOriginalNumbers.length > 20 ? ` (+${duplicateOriginalNumbers.length - 20} more)` : ''}. All questions are preserved separately by sequential sourceOrder.`
    );
  }
  if (unrecognizedBoundaries.length > 0) {
    warnings.push(
      `${unrecognizedBoundaries.length} preamble/unrecognized line(s) appeared before Question 1.`
    );
  }

  // Harmless duplicate original numbers NEVER block staging when all questions are valid and count matches
  const canStage = detectedQuestions > 0 && !countMismatch && invalidQuestions === 0;

  return {
    sourceSha256,
    charCount: normalizedLineEndings.length,
    expectedQuestions: safeExpected,
    estimatedQuestions: detectedQuestions,
    detectedQuestions,
    validQuestions,
    invalidQuestions,
    missingAnswers,
    missingOptions,
    duplicateOriginalNumbers,
    preambleItems,
    unrecognizedBoundaries,
    countMismatch,
    canStage,
    errors,
    warnings,
    questions,
  };
}
