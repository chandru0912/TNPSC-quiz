export type QuestionStatusFlag =
  | 'MISSING_OPTIONS'
  | 'MISSING_ANSWER'
  | 'ANSWER_CONFLICT'
  | 'CONTENT_INCOMPLETE'
  | 'DUPLICATE'
  | 'EMPTY_QUESTION'

export type AnswerVerificationStatus =
  | 'VERIFIED'
  | 'ORIGINAL_KEY_ONLY'
  | 'NEEDS_REVIEW'
  | 'ANSWER_MISSING'
  | 'ANSWER_CONFLICT'

export interface ContentIntegrityReport {
  isComplete: boolean
  totalSourceLines: number
  preservedLines: number
  preservedLineRatio: number
  missingLines: string[]
}

export interface ParsedPreviousPaperQuestion {
  clientId: string
  questionNumber: number
  originalQuestionNumber: string
  originalQuestionText: string
  questionText: string
  rawSourceBlock: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  originalAnswer: number | null // 0=A, 1=B, 2=C, 3=D, null if missing
  validatedAnswer: number | null // Authoritative/verified answer if available, else originalAnswer
  correctAnswer: number | null // Active selected answer (0=A, 1=B, 2=C, 3=D, null if missing)
  answerVerificationStatus: AnswerVerificationStatus
  verificationSource: string
  explanation: string
  subject: string
  topic: string
  medium: 'Tamil' | 'English' | 'Bilingual'
  source: string
  contentIntegrity: ContentIntegrityReport
  isDuplicate: boolean
  duplicateOfNumber: number | null
  missingOptions: boolean
  missingAnswer: boolean
  hasAnswerConflict: boolean
  needsReview: boolean
  statusFlags: QuestionStatusFlag[]
  issues: string[]
}

export interface FailedQuestionDiagnostic {
  questionNumber: number
  originalQuestionNumber: string
  issues: string[]
}

export interface PasteParseSummary {
  rawEstimatedCount: number
  totalPasted: number
  totalDetected: number
  fullyProcessed: number
  successfullyParsed: number
  verifiedCount: number
  invalidCount: number
  missingOptionsCount: number
  missingAnswersCount: number
  answerConflictCount: number
  contentIncompleteCount: number
  duplicateCount: number
  needsReviewCount: number
  lostQuestionsEstimate: number
  missingSequenceNumbers: number[]
  failedQuestions: FailedQuestionDiagnostic[]
}

export interface PasteParseResult {
  questions: ParsedPreviousPaperQuestion[]
  summary: PasteParseSummary
}

export interface PasteParseProgress {
  currentQuestionNumber: number
  processed: number
  total: number
  valid: number
  needsReview: number
  missingOptions: number
  missingAnswers: number
  answerConflicts: number
  done: boolean
}

export interface ParseEngineOptions {
  defaultSubject?: string
  defaultMedium?: string
  sourceLabel?: string
  verifiedAnswerKey?: Record<string, number | string>
}

const OPTION_LETTER_MAP: Record<string, number> = {
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  '1': 0,
  '2': 1,
  '3': 2,
  '4': 3,
  'அ': 0,
  'ஆ': 1,
  'இ': 2,
  'ஈ': 3,
}

const TAMIL_DIGIT_MAP: Record<string, string> = {
  '௦': '0',
  '௧': '1',
  '௨': '2',
  '௩': '3',
  '௪': '4',
  '௫': '5',
  '௬': '6',
  '௭': '7',
  '௮': '8',
  '௯': '9',
}

let parseRunCounter = 0

function normalizeTamilDigits(input: string): string {
  return input.replace(/[௦-௯]/g, (ch) => TAMIL_DIGIT_MAP[ch] ?? ch)
}

/**
 * Strips paired markdown wrappers (e.g. "**1.**", "**Answer:**", "### Q1.")
 * while preserving mathematical multiplication asterisks (e.g. "2 * 3 = 6").
 */
function stripMarkdownWrappers(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^\*{1,2}\s*|\s*\*{1,2}$/g, '')
    .trim()
}

export function normalizeQuestionForDuplicateCheck(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0B80-\u0BFF]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Explicit question headers
const EXPLICIT_HEADER_REGEX =
  /^(?:QUESTION\s*No\.?|Question\s*No\.?|QUESTION|Question|Ques\.?\s*No\.?|Ques\.?|Q\.?\s*No\.?|Q\.?|கேள்வி(?:\s*எண்)?|வினா(?:\s*எண்)?)\s*([0-9௦-௯]{1,4})\s*[:.)\-–—]?\s*(.*)$/i

// Numbered headers: "1. Text", "01. Text", "1) Text", "1 - Text", "1: Text", or standalone "1."
const NUMBERED_HEADER_REGEX =
  /^([0-9௦-௯]{1,4})\s*(?:[.)]|[:\-–—])(?:\s+(.*)|\s*)$/

// Option line markers: "(A) ...", "A) ...", "A. ...", "Option A: ...", "(அ) ...", "அ) ..."
// Guard: never match "Assertion (A):" or "A: <assertion>" when followed by Reason (R)
const ALPHA_OPTION_LINE_REGEX =
  /^(?:Option\s+)?(?:\(\s*([A-Da-dஅஆஇஈ])\s*\)|([A-Da-dஅஆஇஈ])\s*[.):\-–—])\s*(.+)$/i

const NUMERIC_PAREN_OPTION_LINE_REGEX = /^\(\s*([1-4])\s*\)\s*(.+)$/

// Answer header markers
const ANSWER_LINE_REGEX =
  /^(?:Official\s*Answer\s*Key|Correct\s*Answer|Answer\s*Key|Answer|Ans\.?|Key|சரியான\s*விடை|விடை)\s*(?:[:\-–—]|(?=\s*\(?[A-Da-d1-4அஆஇஈ]\)?))\s*(.*)$/i

// Verified/authoritative secondary answer key marker (for conflict detection)
const VERIFIED_KEY_LINE_REGEX =
  /^(?:Verified\s*Answer|Authoritative\s*Answer|Official\s*Key)\s*[:\-–—]\s*(.*)$/i

// Explanation header markers
const EXPLANATION_LINE_REGEX =
  /^(?:Answer\s*Explanation|Explanation|Solution|Rationale|விடை\s*விளக்கம்|விளக்கம்)\s*[:\-–—]?\s*(.*)$/i

// Match-the-following / Codes markers
const MATCH_CODES_MARKER_REGEX = /^(?:Codes?|Select\s+the\s+correct\s+answer|குறியீடுகள்|சரியான\s+குறியீட்டை)\s*[:\-–—]?/i

function lineContainsInlineOptions(clean: string): boolean {
  return (
    (/\(\s*A\s*\)[\s\S]*?\(\s*B\s*\)/i.test(clean) && /\(\s*C\s*\)[\s\S]*?\(\s*D\s*\)/i.test(clean)) ||
    (/(?:^|\s)A\)\s*[\s\S]*?\s+B\)\s*/i.test(clean) && /\s+C\)\s*[\s\S]*?\s+D\)\s*/i.test(clean)) ||
    (/(?:^|\s)A\.\s+[\s\S]*?\s+B\.\s+/i.test(clean) && /\s+C\.\s+[\s\S]*?\s+D\.\s+/i.test(clean)) ||
    (/\(\s*1\s*\)[\s\S]*?\(\s*2\s*\)/.test(clean) && /\(\s*3\s*\)[\s\S]*?\(\s*4\s*\)/.test(clean)) ||
    (/\(\s*அ\s*\)[\s\S]*?\(\s*ஆ\s*\)/.test(clean) && /\(\s*இ\s*\)[\s\S]*?\(\s*ஈ\s*\)/.test(clean))
  )
}

function isOptionOrAnswerIndicator(clean: string): boolean {
  if (/^(?:Assertion|Reason|கூற்று|காரணம்)\b/i.test(clean)) return false
  return (
    ALPHA_OPTION_LINE_REGEX.test(clean) ||
    NUMERIC_PAREN_OPTION_LINE_REGEX.test(clean) ||
    ANSWER_LINE_REGEX.test(clean) ||
    lineContainsInlineOptions(clean)
  )
}

function isExplanationHeader(clean: string): boolean {
  if (!EXPLANATION_LINE_REGEX.test(clean)) return false
  return (
    /[:\-–—]/.test(clean) ||
    /^(?:Answer\s*Explanation|Explanation|Solution|Rationale|விடை\s*விளக்கம்|விளக்கம்)$/i.test(clean)
  )
}

function detectMedium(text: string, fallback = 'English'): 'Tamil' | 'English' | 'Bilingual' {
  const tamilChars = (text.match(/[\u0B80-\u0BFF]/g) || []).length
  const latinChars = (text.match(/[A-Za-z]/g) || []).length
  if (tamilChars > 10 && latinChars > 20) return 'Bilingual'
  if (tamilChars > 5) return 'Tamil'
  if (latinChars > 0) return 'English'
  return fallback.toLowerCase().includes('tamil') ? 'Tamil' : 'English'
}

/**
 * Deterministic TNPSC subject & topic classifier used only when the pasted question
 * does not explicitly specify Subject: / Topic: metadata.
 */
function classifySubjectAndTopic(
  questionText: string,
  defaultSubject: string
): { subject: string; topic: string } {
  const lower = questionText.toLowerCase()
  if (/[\u0B80-\u0BFF]/.test(questionText) && /(திருக்குறள்|சங்க|இலக்கணம்|தொல்காப்பியம்|சிலப்பதிகாரம்|பாரதியார்|பகுபத)/.test(questionText)) {
    return { subject: 'General Tamil', topic: 'Tamil Literature & Grammar' }
  }
  if (/(article\s+\d+|constitution|parliament|supreme court|fundamental rights|panchayat|governor|president|lok sabha|rajya sabha|அரசியலமைப்பு|பாராளுமன்றம்)/i.test(lower)) {
    return { subject: 'Indian Polity', topic: 'Constitution & Governance' }
  }
  if (/(sangam|chola|chera|pandya|pallava|indus valley|maurya|gupta|mughal|gandhi|independence|1857|1947|congress|சோழர்|பாண்டியர்|சேரர்|பல்லவர்)/i.test(lower)) {
    return { subject: 'History & Culture', topic: 'Indian & Tamil Nadu History' }
  }
  if (/(river|mountain|monsoon|climate|soil|latitude|longitude|plateau|kaveri|vaigai|himalaya|planet|solar system|ஆறு|பருவமழை)/i.test(lower)) {
    return { subject: 'Geography', topic: 'Physical & Indian Geography' }
  }
  if (/(gdp|inflation|rbi|fiscal|budget|five year plan|niti aayog|tax|gst|monetary|பணவீக்கம்|பொருளாதாரம்)/i.test(lower)) {
    return { subject: 'Indian Economy', topic: 'Economic Planning & Finance' }
  }
  if (/(√|π|x²|equation|ratio|percentage|compound interest|simple interest|hcf|lcm|profit|loss|probability|average|speed|distance|விகிதம்|சதவீதம்)/i.test(lower)) {
    return { subject: 'Aptitude & Mental Ability', topic: 'Quantitative Aptitude' }
  }
  if (/(atom|molecule|acid|base|photosynthesis|dna|enzyme|newton|ohm|voltage|gravity|vitamin|cell|virus|bacteria|அணு|ஒளிச்சேர்க்கை)/i.test(lower)) {
    return { subject: 'General Science', topic: 'Physics, Chemistry & Biology' }
  }
  return { subject: defaultSubject || 'General Studies', topic: '' }
}

/**
 * Extracts an optional trailing standalone "OFFICIAL ANSWER KEY" / "ANSWER KEY" block
 * pasted at the bottom of Step 2 (e.g., "1-A, 2-B, 3-C" or "1. (A)\n2. (B)") without altering questions.
 */
function extractTrailingAnswerKeySection(rawText: string): {
  bodyText: string
  trailingKeyMap: Record<string, number>
} {
  const normalized = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const keyHeaderMatch = normalized.match(
    /\n\s*(?:#{1,3}\s*)?(?:\*{1,2})?(?:OFFICIAL\s+ANSWER\s+KEY|ANSWER\s+KEY\s+SECTION|VERIFIED\s+ANSWER\s+KEY)(?:\*{1,2})?\s*[:\-–—]?\s*\n([\s\S]+)$/i
  )
  if (!keyHeaderMatch || keyHeaderMatch.index === undefined) {
    return { bodyText: normalized, trailingKeyMap: {} }
  }

  const keyBlock = keyHeaderMatch[1]
  const trailingKeyMap: Record<string, number> = {}
  const pairRegex = /(?:Q\.?\s*)?(\d{1,4})\s*[:.)\-–—]\s*\(?\s*([A-Da-d1-4அஆஇஈ])\s*\)?/gi
  let m: RegExpExecArray | null
  while ((m = pairRegex.exec(keyBlock)) !== null) {
    const qNum = String(parseInt(m[1], 10))
    const key = m[2].toLowerCase()
    if (key in OPTION_LETTER_MAP) {
      trailingKeyMap[qNum] = OPTION_LETTER_MAP[key]
    }
  }

  // Only treat as a trailing answer key section if at least 2 entries were parsed
  if (Object.keys(trailingKeyMap).length >= 2) {
    return {
      bodyText: normalized.slice(0, keyHeaderMatch.index).trim(),
      trailingKeyMap,
    }
  }
  return { bodyText: normalized, trailingKeyMap: {} }
}

function estimateRawQuestionCount(bodyText: string): number {
  const trimmed = bodyText.trim()
  if (!trimmed) return 0
  const lines = trimmed.split('\n')
  let explicitCount = 0
  let answerCount = 0
  for (const rawLine of lines) {
    const clean = stripMarkdownWrappers(rawLine.trim())
    if (!clean) continue
    if (EXPLICIT_HEADER_REGEX.test(clean)) explicitCount++
    if (ANSWER_LINE_REGEX.test(clean)) answerCount++
  }
  return Math.max(explicitCount, answerCount)
}

/**
 * Splits a large pasted text (10, 50, 100, 200, 500+ questions) into individual question blocks.
 * Never truncates, never caps question count, and preserves Match-the-Following, Assertion-Reason,
 * and multi-statement questions intact.
 */
export function splitRawPasteIntoBlocks(rawText: string): { origNum: string; rawBlock: string }[] {
  const normalized = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!normalized) return []

  const lines = normalized.split('\n')
  const blocks: { origNum: string; lines: string[] }[] = []
  let current: { origNum: string; lines: string[] } | null = null
  let sawOptionOrAnswer = false
  let sawAnswerOrExplanation = false
  let lastWasBlank = false
  let lastQuestionNum = 0

  const flushCurrent = () => {
    if (current && current.lines.some((l) => l.trim().length > 0)) {
      blocks.push(current)
    }
    current = null
    sawOptionOrAnswer = false
    sawAnswerOrExplanation = false
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    if (!trimmed) {
      if (current) current.lines.push('')
      lastWasBlank = true
      continue
    }

    if (/^[-_=*─—]{4,}$/.test(trimmed)) {
      lastWasBlank = true
      continue
    }

    const clean = stripMarkdownWrappers(trimmed)
    const expMatch = clean.match(EXPLICIT_HEADER_REGEX)
    const isParenOption = NUMERIC_PAREN_OPTION_LINE_REGEX.test(clean)
    const numMatch = !expMatch && !isParenOption ? clean.match(NUMBERED_HEADER_REGEX) : null

    let isNewQuestion = false
    let parsedNumStr = ''
    let restText = ''

    if (expMatch) {
      isNewQuestion = true
      parsedNumStr = normalizeTamilDigits(expMatch[1])
      restText = (expMatch[2] || '').trim()
    } else if (numMatch) {
      parsedNumStr = normalizeTamilDigits(numMatch[1])
      const numVal = parseInt(parsedNumStr, 10)
      restText = (numMatch[2] || '').trim()

      const looksLikeYearOrHuge = numVal > 1500
      if (!looksLikeYearOrHuge) {
        if (!current) {
          isNewQuestion = true
        } else if (sawOptionOrAnswer || sawAnswerOrExplanation) {
          // Guard against embedded numbered lists inside explanations (e.g. "1. ... 2. ...")
          if (sawAnswerOrExplanation && numVal <= 4 && lastQuestionNum >= 4 && numVal !== lastQuestionNum + 1) {
            isNewQuestion = false
          } else {
            isNewQuestion = true
          }
        } else if (lastWasBlank && lastQuestionNum > 0 && numVal === lastQuestionNum + 1) {
          isNewQuestion = true
        }
      }
    } else if (
      current &&
      lastWasBlank &&
      sawAnswerOrExplanation &&
      !isOptionOrAnswerIndicator(clean) &&
      !isExplanationHeader(clean) &&
      !/^(?:Subject|Topic|பாடம்|தலைப்பு)\s*[:\-–—]/i.test(clean)
    ) {
      let lookAheadHasOptions = false
      for (let j = i; j < Math.min(lines.length, i + 10); j++) {
        const la = stripMarkdownWrappers(lines[j].trim())
        if (!la) continue
        if (EXPLICIT_HEADER_REGEX.test(la)) break
        if (ALPHA_OPTION_LINE_REGEX.test(la) || NUMERIC_PAREN_OPTION_LINE_REGEX.test(la) || lineContainsInlineOptions(la)) {
          lookAheadHasOptions = true
          break
        }
      }
      if (lookAheadHasOptions) {
        isNewQuestion = true
        parsedNumStr = String(blocks.length + 2)
        restText = trimmed
      }
    }

    if (isNewQuestion) {
      flushCurrent()
      const numInt = parseInt(parsedNumStr, 10)
      if (!isNaN(numInt) && numInt > 0) {
        lastQuestionNum = numInt
      }
      current = {
        origNum: parsedNumStr || String(blocks.length + 1),
        lines: restText ? [restText] : [],
      }
      if (restText && isOptionOrAnswerIndicator(stripMarkdownWrappers(restText))) {
        sawOptionOrAnswer = true
      }
      lastWasBlank = false
      continue
    }

    if (!current) {
      current = { origNum: String(blocks.length + 1), lines: [] }
      lastQuestionNum = blocks.length + 1
    }

    if (ANSWER_LINE_REGEX.test(clean) || VERIFIED_KEY_LINE_REGEX.test(clean) || isExplanationHeader(clean)) {
      sawOptionOrAnswer = true
      sawAnswerOrExplanation = true
    } else if (isOptionOrAnswerIndicator(clean)) {
      sawOptionOrAnswer = true
    }

    current.lines.push(trimmed)
    lastWasBlank = false
  }

  flushCurrent()

  return blocks.map((b) => ({
    origNum: b.origNum,
    rawBlock: b.lines.join('\n').trim(),
  }))
}

function tryInlineOptionsSplit(text: string): {
  stem: string
  options: [string, string, string, string]
} | null {
  const patterns = [
    /\(\s*A\s*\)\s*([\s\S]*?)\(\s*B\s*\)\s*([\s\S]*?)\(\s*C\s*\)\s*([\s\S]*?)\(\s*D\s*\)\s*([\s\S]*)$/i,
    /(?:^|\s)A\)\s*([\s\S]*?)\s+B\)\s*([\s\S]*?)\s+C\)\s*([\s\S]*?)\s+D\)\s*([\s\S]*)$/i,
    /(?:^|\s)A\.\s+([\s\S]*?)\s+B\.\s+([\s\S]*?)\s+C\.\s+([\s\S]*?)\s+D\.\s+([\s\S]*)$/i,
    /\(\s*1\s*\)\s*([\s\S]*?)\(\s*2\s*\)\s*([\s\S]*?)\(\s*3\s*\)\s*([\s\S]*?)\(\s*4\s*\)\s*([\s\S]*)$/,
    /\(\s*அ\s*\)\s*([\s\S]*?)\(\s*ஆ\s*\)\s*([\s\S]*?)\(\s*இ\s*\)\s*([\s\S]*?)\(\s*ஈ\s*\)\s*([\s\S]*)$/,
  ]
  for (const pat of patterns) {
    const m = text.match(pat)
    if (m && m.index !== undefined) {
      const stem = text.slice(0, m.index).trim()
      const opts: [string, string, string, string] = [
        m[1].replace(/\s+/g, ' ').trim(),
        m[2].replace(/\s+/g, ' ').trim(),
        m[3].replace(/\s+/g, ' ').trim(),
        m[4].replace(/\s+/g, ' ').trim(),
      ]
      if (opts.filter(Boolean).length >= 2) {
        return { stem, options: opts }
      }
    }
  }
  return null
}

function tryTwoColumnOptionPair(clean: string): { idx1: number; val1: string; idx2: number; val2: string } | null {
  const pairPatterns: { regex: RegExp; idx1: number; idx2: number }[] = [
    { regex: /^\(\s*A\s*\)\s*(.+?)\s{2,}\(\s*B\s*\)\s*(.+)$/i, idx1: 0, idx2: 1 },
    { regex: /^\(\s*C\s*\)\s*(.+?)\s{2,}\(\s*D\s*\)\s*(.+)$/i, idx1: 2, idx2: 3 },
    { regex: /^A[.)]\s*(.+?)\s{2,}B[.)]\s*(.+)$/i, idx1: 0, idx2: 1 },
    { regex: /^C[.)]\s*(.+?)\s{2,}D[.)]\s*(.+)$/i, idx1: 2, idx2: 3 },
    { regex: /^\(\s*1\s*\)\s*(.+?)\s{2,}\(\s*2\s*\)\s*(.+)$/, idx1: 0, idx2: 1 },
    { regex: /^\(\s*3\s*\)\s*(.+?)\s{2,}\(\s*4\s*\)\s*(.+)$/, idx1: 2, idx2: 3 },
    { regex: /^\(\s*அ\s*\)\s*(.+?)\s{2,}\(\s*ஆ\s*\)\s*(.+)$/, idx1: 0, idx2: 1 },
    { regex: /^\(\s*இ\s*\)\s*(.+?)\s{2,}\(\s*ஈ\s*\)\s*(.+)$/, idx1: 2, idx2: 3 },
  ]
  for (const { regex, idx1, idx2 } of pairPatterns) {
    const m = clean.match(regex)
    if (m) {
      return { idx1, val1: m[1].trim(), idx2, val2: m[2].trim() }
    }
  }
  return null
}

function resolveAnswerFromValue(rawVal: string | number | null | undefined, options: [string, string, string, string]): number | null {
  if (typeof rawVal === 'number') {
    return Number.isInteger(rawVal) && rawVal >= 0 && rawVal <= 3 ? rawVal : null
  }
  const val = stripMarkdownWrappers(String(rawVal || ''))
  if (!val) return null

  const letterMatch = val.match(/^(?:Option\s*)?\(?\s*([A-Da-d1-4அஆஇஈ])\s*\)?(?:\s*[:.)\-–—]|\s|$)/i)
  if (letterMatch) {
    const key = letterMatch[1].toLowerCase()
    if (key in OPTION_LETTER_MAP) return OPTION_LETTER_MAP[key]
  }

  const normVal = normalizeQuestionForDuplicateCheck(val)
  if (normVal.length >= 2) {
    for (let i = 0; i < 4; i++) {
      if (options[i] && normalizeQuestionForDuplicateCheck(options[i]) === normVal) {
        return i
      }
    }
  }

  return null
}

/**
 * Verifies that every substantive line from the original source block is preserved
 * in the extracted questionText, options, explanation, or metadata.
 */
function validateContentIntegrity(
  rawBlock: string,
  extracted: {
    questionText: string
    options: [string, string, string, string]
    explanation: string
  }
): ContentIntegrityReport {
  const combinedNorm = normalizeQuestionForDuplicateCheck(
    `${extracted.questionText}\n${extracted.options.join('\n')}\n${extracted.explanation}`
  )
  const sourceLines = rawBlock
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      if (!l || /^[-_=*─—]{4,}$/.test(l)) return false
      const c = stripMarkdownWrappers(l)
      if (/^(?:Subject|Topic|பாடம்|தலைப்பு)\s*[:\-–—]/i.test(c)) return false
      if (ANSWER_LINE_REGEX.test(c) || VERIFIED_KEY_LINE_REGEX.test(c)) return false
      if (/^(?:Answer\s*Explanation|Explanation|Solution|Rationale|விடை\s*விளக்கம்|விளக்கம்)\s*[:\-–—]?$/i.test(c)) {
        return false
      }
      if (/^(?:\(\s*E\s*\)|E\))\s*Answer\s+not\s+known/i.test(c)) return false
      return normalizeQuestionForDuplicateCheck(c).length >= 3
    })

  const missingLines: string[] = []
  for (const line of sourceLines) {
    const clean = stripMarkdownWrappers(line)
      .replace(/(?:^|\s)(?:Option\s+)?(?:\(\s*[A-Da-d1-4அஆஇஈ]\s*\)|[A-Da-d1-4அஆஇஈ]\s*[.):\-–—])(?=\s|$)/gi, ' ')
      .replace(/^(?:Answer\s*Explanation|Explanation|Solution|Rationale|விடை\s*விளக்கம்|விளக்கம்)\s*[:\-–—]\s*/i, '')
      .trim()
    const norm = normalizeQuestionForDuplicateCheck(clean)
    if (norm.length < 2) continue
    if (!combinedNorm.includes(norm)) {
      const tokens = norm.split(' ').filter((t) => t.length >= 2)
      if (tokens.length === 0) {
        const singleTokens = norm.split(' ').filter(Boolean)
        if (!singleTokens.every((t) => combinedNorm.includes(t))) {
          missingLines.push(line)
        }
      } else {
        const matched = tokens.filter((t) => combinedNorm.includes(t)).length
        if (matched / tokens.length < 0.8) {
          missingLines.push(line)
        }
      }
    }
  }

  const totalSourceLines = sourceLines.length
  const preservedLines = Math.max(0, totalSourceLines - missingLines.length)
  const preservedLineRatio = totalSourceLines === 0 ? 1 : preservedLines / totalSourceLines

  return {
    isComplete: missingLines.length === 0,
    totalSourceLines,
    preservedLines,
    preservedLineRatio,
    missingLines,
  }
}

/**
 * Processes a single isolated question block sequentially through all 15 steps:
 * question text preservation -> option extraction -> answer extraction -> conflict validation
 * -> explanation extraction -> metadata -> content-integrity validation.
 */
export function processSingleQuestionBlock(
  block: { origNum: string; rawBlock: string },
  idx: number,
  runId: number,
  optionsCfg: ParseEngineOptions = {},
  trailingKeyMap: Record<string, number> = {}
): Omit<ParsedPreviousPaperQuestion, 'isDuplicate' | 'duplicateOfNumber'> {
  const defaultSubject = optionsCfg.defaultSubject || 'General Studies'
  const defaultMedium = optionsCfg.defaultMedium || 'English'
  const sourceLabel = optionsCfg.sourceLabel || 'Previous Year Paper'
  const { origNum, rawBlock } = block
  const lines = rawBlock.split('\n')

  // Pre-scan for Match-the-Following structure: if a "Codes:" / "Code:" marker exists inside the block,
  // any (a)-(d) lines BEFORE that marker belong to the question table (stem), NOT final MCQ options!
  const matchCodesLineIndex = lines.findIndex((l) => MATCH_CODES_MARKER_REGEX.test(stripMarkdownWrappers(l.trim())))
  const hasAssertionReasonPairs =
    lines.some((l) => /^(?:Assertion\s*\(A\)|கூற்று\s*\(A\)|A\s*:)/i.test(stripMarkdownWrappers(l.trim()))) &&
    lines.some((l) => /^(?:Reason\s*\(R\)|காரணம்\s*\(R\)|R\s*:)/i.test(stripMarkdownWrappers(l.trim())))

  const stemLines: string[] = []
  const options: [string, string, string, string] = ['', '', '', '']
  let answerRaw = ''
  let verifiedKeyInlineRaw = ''
  let waitingForAnswerNextLine = false
  const explanationLines: string[] = []
  let explicitSubject = ''
  let explicitTopic = ''

  let mode: 'stem' | 'option' | 'explanation' = 'stem'
  let activeOptIdx = -1

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx]
    const trimmed = rawLine.trim()
    if (!trimmed) {
      if (mode === 'explanation' && explanationLines.length > 0) {
        explanationLines.push('')
      }
      continue
    }

    const clean = stripMarkdownWrappers(trimmed)

    // Subject / Topic metadata lines
    const subjMatch = clean.match(/^(?:Subject|பாடம்)\s*[:\-–—]\s*(.+)$/i)
    if (subjMatch) {
      explicitSubject = subjMatch[1].trim()
      continue
    }
    const topicMatch = clean.match(/^(?:Topic|தலைப்பு)\s*[:\-–—]\s*(.+)$/i)
    if (topicMatch) {
      explicitTopic = topicMatch[1].trim()
      continue
    }

    // Verified secondary answer line (used for conflict checking, never overwrites original)
    const verifiedMatch = clean.match(VERIFIED_KEY_LINE_REGEX)
    if (verifiedMatch) {
      verifiedKeyInlineRaw = (verifiedMatch[1] || '').trim()
      continue
    }

    // Explanation header
    if (isExplanationHeader(clean)) {
      const expMatch = clean.match(EXPLANATION_LINE_REGEX)
      mode = 'explanation'
      waitingForAnswerNextLine = false
      activeOptIdx = -1
      if (expMatch && expMatch[1] && expMatch[1].trim()) {
        explanationLines.push(expMatch[1].trim())
      }
      continue
    }

    // Answer header
    const ansMatch = clean.match(ANSWER_LINE_REGEX)
    if (ansMatch) {
      const val = (ansMatch[1] || '').trim()
      if (val) {
        answerRaw = val
        waitingForAnswerNextLine = false
      } else {
        waitingForAnswerNextLine = true
      }
      mode = 'stem'
      activeOptIdx = -1
      continue
    }

    if (waitingForAnswerNextLine) {
      answerRaw = clean
      waitingForAnswerNextLine = false
      continue
    }

    // Protect Match-the-Following table lines before "Codes:" from being misparsed as options
    const insideMatchTable = matchCodesLineIndex >= 0 && lineIdx <= matchCodesLineIndex
    // Protect Assertion (A): / Reason (R): / A: / R: lines from being misparsed as Option A
    const isAssertionOrReasonLine =
      /^(?:Assertion|Reason|கூற்று|காரணம்)\b/i.test(clean) ||
      (hasAssertionReasonPairs && /^[AR]\s*:/i.test(clean))

    if (mode !== 'explanation' && !insideMatchTable && !isAssertionOrReasonLine) {
      if (lineContainsInlineOptions(clean)) {
        const inline = tryInlineOptionsSplit(clean)
        if (inline) {
          if (inline.stem) stemLines.push(inline.stem)
          options[0] = inline.options[0]
          options[1] = inline.options[1]
          options[2] = inline.options[2]
          options[3] = inline.options[3]
          mode = 'option'
          activeOptIdx = 3
          continue
        }
      }

      const pair = tryTwoColumnOptionPair(clean)
      if (pair) {
        options[pair.idx1] = pair.val1
        options[pair.idx2] = pair.val2
        mode = 'option'
        activeOptIdx = pair.idx2
        continue
      }

      const alphaOpt = clean.match(ALPHA_OPTION_LINE_REGEX)
      if (alphaOpt) {
        const key = (alphaOpt[1] || alphaOpt[2] || '').toLowerCase()
        if (key in OPTION_LETTER_MAP) {
          activeOptIdx = OPTION_LETTER_MAP[key]
          options[activeOptIdx] = (alphaOpt[3] || '').trim()
          mode = 'option'
          continue
        }
      }

      const numOpt = clean.match(NUMERIC_PAREN_OPTION_LINE_REGEX)
      if (numOpt) {
        const key = numOpt[1]
        if (key in OPTION_LETTER_MAP) {
          activeOptIdx = OPTION_LETTER_MAP[key]
          options[activeOptIdx] = (numOpt[2] || '').trim()
          mode = 'option'
          continue
        }
      }
    }

    if (mode === 'explanation') {
      explanationLines.push(trimmed)
    } else if (mode === 'option' && activeOptIdx >= 0) {
      options[activeOptIdx] = `${options[activeOptIdx]} ${trimmed}`.trim()
    } else {
      stemLines.push(trimmed)
    }
  }

  let originalQuestionText = stemLines.join('\n').trim()
  let questionText = originalQuestionText

  // Handle inline options embedded at the end of the stem
  if (options.filter(Boolean).length === 0 && questionText) {
    const inline = tryInlineOptionsSplit(questionText)
    if (inline) {
      questionText = inline.stem
      originalQuestionText = inline.stem
      options[0] = inline.options[0]
      options[1] = inline.options[1]
      options[2] = inline.options[2]
      options[3] = inline.options[3]
    }
  }

  // Strip TNPSC trailing "(E) Answer not known" if present on Option D
  options[3] = options[3]
    .replace(/\s*(?:\(\s*E\s*\)|E\))\s*Answer\s+not\s+known[\s\S]*$/i, '')
    .trim()

  const originalAnswer = resolveAnswerFromValue(answerRaw, options)
  const externalKeyRaw =
    verifiedKeyInlineRaw ||
    ((optionsCfg.verifiedAnswerKey ? optionsCfg.verifiedAnswerKey[origNum] ?? optionsCfg.verifiedAnswerKey[String(idx + 1)] : undefined) ??
      trailingKeyMap[origNum] ??
      trailingKeyMap[String(idx + 1)])
  const authoritativeAnswer = resolveAnswerFromValue(externalKeyRaw, options)

  // Answer validation priority (never silently overwrite original answer on conflict!)
  let validatedAnswer: number | null = originalAnswer
  let correctAnswer: number | null = originalAnswer
  let answerVerificationStatus: AnswerVerificationStatus = 'ANSWER_MISSING'
  let verificationSource = 'None'
  let hasAnswerConflict = false

  if (originalAnswer !== null && authoritativeAnswer !== null) {
    if (originalAnswer === authoritativeAnswer) {
      validatedAnswer = authoritativeAnswer
      correctAnswer = authoritativeAnswer
      answerVerificationStatus = 'VERIFIED'
      verificationSource = 'Official Answer Key'
    } else {
      // Conflict detected: preserve originalAnswer as active until admin resolves, store validatedAnswer separately
      validatedAnswer = authoritativeAnswer
      correctAnswer = originalAnswer
      answerVerificationStatus = 'ANSWER_CONFLICT'
      verificationSource = 'Conflict: Original vs Official Key'
      hasAnswerConflict = true
    }
  } else if (authoritativeAnswer !== null) {
    validatedAnswer = authoritativeAnswer
    correctAnswer = authoritativeAnswer
    answerVerificationStatus = 'VERIFIED'
    verificationSource = 'Official Answer Key'
  } else if (originalAnswer !== null) {
    validatedAnswer = originalAnswer
    correctAnswer = originalAnswer
    answerVerificationStatus = 'ORIGINAL_KEY_ONLY'
    verificationSource = 'Admin Supplied / Paper Key'
  } else {
    validatedAnswer = null
    correctAnswer = null
    answerVerificationStatus = 'ANSWER_MISSING'
    verificationSource = 'None'
  }

  const explanation = explanationLines.join('\n').trim()
  const inferred = classifySubjectAndTopic(questionText, defaultSubject)
  const subject = explicitSubject || inferred.subject
  const topic = explicitTopic || inferred.topic
  const medium = detectMedium(`${questionText} ${options.join(' ')}`, defaultMedium)

  // Content-integrity validation against rawSourceBlock
  const contentIntegrity = validateContentIntegrity(rawBlock, {
    questionText,
    options,
    explanation,
  })

  const statusFlags: QuestionStatusFlag[] = []
  const issues: string[] = []
  if (!questionText) {
    statusFlags.push('EMPTY_QUESTION')
    issues.push('Question text is empty')
  }
  const presentOpts = options.filter((o) => o.trim().length > 0).length
  const missingOptions = presentOpts < 4
  if (missingOptions) {
    statusFlags.push('MISSING_OPTIONS')
    issues.push(`MISSING_OPTIONS (${presentOpts}/4 detected)`)
  }
  const missingAnswer = correctAnswer === null
  if (missingAnswer) {
    statusFlags.push('MISSING_ANSWER')
    issues.push('ANSWER_MISSING')
  }
  if (hasAnswerConflict) {
    statusFlags.push('ANSWER_CONFLICT')
    issues.push(
      `ANSWER_CONFLICT (Original: ${String.fromCharCode(65 + (originalAnswer ?? 0))} vs Verified: ${String.fromCharCode(65 + (validatedAnswer ?? 0))})`
    )
  }
  if (!contentIntegrity.isComplete) {
    statusFlags.push('CONTENT_INCOMPLETE')
    issues.push(`CONTENT_INCOMPLETE (${contentIntegrity.missingLines.length} source line(s) missing)`)
  }

  return {
    clientId: `pyp_${runId}_${idx + 1}`,
    questionNumber: idx + 1,
    originalQuestionNumber: origNum || String(idx + 1),
    originalQuestionText,
    questionText,
    rawSourceBlock: rawBlock,
    optionA: options[0],
    optionB: options[1],
    optionC: options[2],
    optionD: options[3],
    originalAnswer,
    validatedAnswer,
    correctAnswer,
    answerVerificationStatus,
    verificationSource,
    explanation,
    subject,
    topic,
    medium,
    source: sourceLabel,
    contentIntegrity,
    missingOptions,
    missingAnswer,
    hasAnswerConflict,
    needsReview: issues.length > 0,
    statusFlags,
    issues,
  }
}

/**
 * Allows individual error recovery / retry on a single question block without affecting the rest of the dataset.
 */
export function reprocessSingleQuestion(
  existing: ParsedPreviousPaperQuestion,
  optionsCfg: ParseEngineOptions = {}
): ParsedPreviousPaperQuestion {
  const reprocessed = processSingleQuestionBlock(
    { origNum: existing.originalQuestionNumber, rawBlock: existing.rawSourceBlock || existing.originalQuestionText },
    existing.questionNumber - 1,
    Date.now(),
    optionsCfg
  )
  return {
    ...reprocessed,
    clientId: existing.clientId,
    isDuplicate: existing.isDuplicate,
    duplicateOfNumber: existing.duplicateOfNumber,
  }
}

function finalizeParsedQuestions(
  baseQuestions: Omit<ParsedPreviousPaperQuestion, 'isDuplicate' | 'duplicateOfNumber'>[],
  rawEstimatedCount: number
): PasteParseResult {
  const seenNormalized = new Map<string, number>()
  const questions: ParsedPreviousPaperQuestion[] = []

  for (let i = 0; i < baseQuestions.length; i++) {
    const q = baseQuestions[i]
    const norm = normalizeQuestionForDuplicateCheck(q.questionText)
    let isDuplicate = false
    let duplicateOfNumber: number | null = null
    const statusFlags = [...q.statusFlags]
    const issues = [...q.issues]

    if (norm.length >= 12) {
      if (seenNormalized.has(norm)) {
        isDuplicate = true
        duplicateOfNumber = seenNormalized.get(norm) ?? null
        statusFlags.push('DUPLICATE')
        issues.push(`Duplicate of Question #${duplicateOfNumber}`)
      } else {
        seenNormalized.set(norm, q.questionNumber)
      }
    }

    questions.push({
      ...q,
      isDuplicate,
      duplicateOfNumber,
      statusFlags,
      issues,
      needsReview: issues.length > 0,
    })
  }

  const numericOrig = questions
    .map((q) => parseInt(q.originalQuestionNumber, 10))
    .filter((n) => Number.isInteger(n) && n > 0 && n <= 2000)
  const missingSequenceNumbers: number[] = []
  if (numericOrig.length >= 3) {
    const presentSet = new Set(numericOrig)
    const minN = Math.min(...numericOrig)
    const maxN = Math.max(...numericOrig)
    if (minN <= 5 && maxN <= numericOrig.length + 50) {
      for (let n = minN; n <= maxN; n++) {
        if (!presentSet.has(n)) {
          missingSequenceNumbers.push(n)
        }
      }
    }
  }

  const missingOptionsCount = questions.filter((q) => q.missingOptions).length
  const missingAnswersCount = questions.filter((q) => q.missingAnswer).length
  const answerConflictCount = questions.filter((q) => q.hasAnswerConflict).length
  const contentIncompleteCount = questions.filter((q) => !q.contentIntegrity.isComplete).length
  const duplicateCount = questions.filter((q) => q.isDuplicate).length
  const verifiedCount = questions.filter((q) => q.answerVerificationStatus === 'VERIFIED').length
  const invalidCount = questions.filter(
    (q) => !q.questionText.trim() || q.missingOptions || q.missingAnswer || q.hasAnswerConflict || !q.contentIntegrity.isComplete
  ).length
  const needsReviewCount = questions.filter((q) => q.needsReview).length
  const successfullyParsed = questions.filter((q) => !q.needsReview).length
  const totalDetected = questions.length
  const effectiveRawEstimate = Math.max(rawEstimatedCount, totalDetected)
  const lostQuestionsEstimate = Math.max(0, effectiveRawEstimate - totalDetected)

  const failedQuestions: FailedQuestionDiagnostic[] = questions
    .filter((q) => q.needsReview)
    .map((q) => ({
      questionNumber: q.questionNumber,
      originalQuestionNumber: q.originalQuestionNumber,
      issues: q.issues,
    }))

  return {
    questions,
    summary: {
      rawEstimatedCount: effectiveRawEstimate,
      totalPasted: totalDetected,
      totalDetected,
      fullyProcessed: totalDetected,
      successfullyParsed,
      verifiedCount,
      invalidCount,
      missingOptionsCount,
      missingAnswersCount,
      answerConflictCount,
      contentIncompleteCount,
      duplicateCount,
      needsReviewCount,
      lostQuestionsEstimate,
      missingSequenceNumbers,
      failedQuestions,
    },
  }
}

/**
 * Synchronous sequential question-by-question reading & validation engine.
 */
export function parsePastedPreviousYearQuestions(
  rawText: string,
  defaultSubjectOrOptions: string | ParseEngineOptions = 'General Studies'
): PasteParseResult {
  const optionsCfg: ParseEngineOptions =
    typeof defaultSubjectOrOptions === 'string'
      ? { defaultSubject: defaultSubjectOrOptions }
      : defaultSubjectOrOptions
  parseRunCounter += 1
  const runId = parseRunCounter
  const { bodyText, trailingKeyMap } = extractTrailingAnswerKeySection(rawText)
  const rawEstimatedCount = estimateRawQuestionCount(bodyText)
  const rawBlocks = splitRawPasteIntoBlocks(bodyText)

  // Process sequentially Question 1 -> Question 2 -> ... -> Question N
  const baseQuestions: Omit<ParsedPreviousPaperQuestion, 'isDuplicate' | 'duplicateOfNumber'>[] = []
  for (let idx = 0; idx < rawBlocks.length; idx++) {
    baseQuestions.push(processSingleQuestionBlock(rawBlocks[idx], idx, runId, optionsCfg, trailingKeyMap))
  }
  return finalizeParsedQuestions(baseQuestions, rawEstimatedCount)
}

/**
 * Non-blocking asynchronous sequential question-by-question reading engine for 200–500+ questions.
 * Emits live "Processing Question X / Y" progress without blocking the browser UI.
 */
export async function parsePastedPreviousYearQuestionsAsync(
  rawText: string,
  defaultSubjectOrOptions: string | ParseEngineOptions = 'General Studies',
  onProgress?: (progress: PasteParseProgress) => void,
  chunkSize = 25
): Promise<PasteParseResult> {
  const optionsCfg: ParseEngineOptions =
    typeof defaultSubjectOrOptions === 'string'
      ? { defaultSubject: defaultSubjectOrOptions }
      : defaultSubjectOrOptions
  parseRunCounter += 1
  const runId = parseRunCounter
  const { bodyText, trailingKeyMap } = extractTrailingAnswerKeySection(rawText)
  const rawEstimatedCount = estimateRawQuestionCount(bodyText)
  const rawBlocks = splitRawPasteIntoBlocks(bodyText)
  const total = rawBlocks.length
  const baseQuestions: Omit<ParsedPreviousPaperQuestion, 'isDuplicate' | 'duplicateOfNumber'>[] = []

  let validSoFar = 0
  let reviewSoFar = 0
  let missingOptionsSoFar = 0
  let missingAnswersSoFar = 0
  let answerConflictsSoFar = 0

  for (let start = 0; start < total; start += chunkSize) {
    const end = Math.min(total, start + chunkSize)
    for (let idx = start; idx < end; idx++) {
      const parsed = processSingleQuestionBlock(rawBlocks[idx], idx, runId, optionsCfg, trailingKeyMap)
      baseQuestions.push(parsed)
      if (parsed.needsReview) reviewSoFar++
      else validSoFar++
      if (parsed.missingOptions) missingOptionsSoFar++
      if (parsed.missingAnswer) missingAnswersSoFar++
      if (parsed.hasAnswerConflict) answerConflictsSoFar++
    }
    onProgress?.({
      currentQuestionNumber: end,
      processed: end,
      total,
      valid: validSoFar,
      needsReview: reviewSoFar,
      missingOptions: missingOptionsSoFar,
      missingAnswers: missingAnswersSoFar,
      answerConflicts: answerConflictsSoFar,
      done: false,
    })
    if (end < total) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }

  const finalResult = finalizeParsedQuestions(baseQuestions, rawEstimatedCount)
  onProgress?.({
    currentQuestionNumber: finalResult.summary.totalDetected,
    processed: finalResult.summary.fullyProcessed,
    total: finalResult.summary.totalDetected,
    valid: finalResult.summary.successfullyParsed,
    needsReview: finalResult.summary.needsReviewCount,
    missingOptions: finalResult.summary.missingOptionsCount,
    missingAnswers: finalResult.summary.missingAnswersCount,
    answerConflicts: finalResult.summary.answerConflictCount,
    done: true,
  })
  return finalResult
}
