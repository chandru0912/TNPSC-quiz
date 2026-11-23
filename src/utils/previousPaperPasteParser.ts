export interface ParsedPreviousPaperQuestion {
  clientId: string
  questionNumber: number
  originalQuestionNumber: string
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctAnswer: number | null // 0=A, 1=B, 2=C, 3=D, null if missing/invalid
  explanation: string
  subject: string
  topic: string
  isDuplicate: boolean
  duplicateOfNumber: number | null
  missingOptions: boolean
  missingAnswer: boolean
  needsReview: boolean
  issues: string[]
}

export interface PasteParseSummary {
  totalPasted: number
  successfullyParsed: number
  missingOptionsCount: number
  missingAnswersCount: number
  duplicateCount: number
  needsReviewCount: number
}

export interface PasteParseResult {
  questions: ParsedPreviousPaperQuestion[]
  summary: PasteParseSummary
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

function cleanLine(line: string): string {
  return line.replace(/^\*{1,2}|\*{1,2}$/g, '').replace(/^#+\s*/, '').trim()
}

export function normalizeQuestionForDuplicateCheck(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0B80-\u0BFF]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Splits a large pasted text (10, 50, 100, 200+ questions) into individual question blocks.
 * Never silently skips any question block.
 */
function splitRawPasteIntoBlocks(rawText: string): { origNum: string; rawBlock: string }[] {
  const normalized = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!normalized) return []

  const lines = normalized.split('\n')
  const blocks: { origNum: string; lines: string[] }[] = []
  let current: { origNum: string; lines: string[] } | null = null
  let sawOptionOrAnswer = false

  const explicitHeaderRegex = /^(?:QUESTION|Question|Ques\.?|Q\.?\s*No\.?|Q\.?|கேள்வி|வினா)\s*(\d{1,4})\s*[:.)\-–—]?\s*(.*)$/i
  const numberedHeaderRegex = /^(\d{1,4})\s*[.)]\s+(\S.*)$/
  const optionLineRegex = /^(?:\(?[A-Da-dஅ-ஈ]\)|[A-Da-dஅ-ஈ][.):\-])\s+\S|^Option\s+[A-Da-d]\s*[:.)\-]\s+\S/i
  const answerLineRegex = /^(?:Correct\s*Answer|Answer|Ans\.?|Key|சரியான\s*விடை|விடை)\s*[:\-–—]/i

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed) {
      if (current) current.lines.push('')
      continue
    }
    if (/^[-_=*]{4,}$/.test(trimmed)) {
      continue
    }

    const clean = cleanLine(trimmed)
    const expMatch = clean.match(explicitHeaderRegex)
    const numMatch = !expMatch ? clean.match(numberedHeaderRegex) : null

    const isNewQuestion =
      Boolean(expMatch) ||
      (Boolean(numMatch) && (!current || sawOptionOrAnswer))

    if (isNewQuestion) {
      if (current && current.lines.some((l) => l.trim().length > 0)) {
        blocks.push(current)
      }
      if (expMatch) {
        const rest = (expMatch[2] || '').trim()
        current = { origNum: expMatch[1], lines: rest ? [rest] : [] }
      } else if (numMatch) {
        current = { origNum: numMatch[1], lines: [numMatch[2].trim()] }
      }
      sawOptionOrAnswer = false
      continue
    }

    if (!current) {
      current = { origNum: String(blocks.length + 1), lines: [] }
    }

    if (optionLineRegex.test(clean) || answerLineRegex.test(clean)) {
      sawOptionOrAnswer = true
    }
    current.lines.push(trimmed)
  }

  if (current && current.lines.some((l) => l.trim().length > 0)) {
    blocks.push(current)
  }

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
    /\(\s*A\s*\)([\s\S]*?)\(\s*B\s*\)([\s\S]*?)\(\s*C\s*\)([\s\S]*?)\(\s*D\s*\)([\s\S]*)$/i,
    /(?:^|\s)A\)\s*([\s\S]*?)\s+B\)\s*([\s\S]*?)\s+C\)\s*([\s\S]*?)\s+D\)\s*([\s\S]*)$/i,
    /\(\s*அ\s*\)([\s\S]*?)\(\s*ஆ\s*\)([\s\S]*?)\(\s*இ\s*\)([\s\S]*?)\(\s*ஈ\s*\)([\s\S]*)$/,
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

function resolveAnswerFromValue(rawVal: string, options: [string, string, string, string]): number | null {
  const val = cleanLine(rawVal)
  if (!val) return null

  // Direct letter/symbol at start: "B", "(B)", "B) Mars", "Option C", "ஆ) ..."
  const letterMatch = val.match(/^(?:Option\s*)?\(?\s*([A-Da-d1-4அஆஇஈ])\s*\)?(?:\s*[:.)\-–—]|\s|$)/i)
  if (letterMatch) {
    const key = letterMatch[1].toLowerCase()
    if (key in OPTION_LETTER_MAP) return OPTION_LETTER_MAP[key]
  }

  // Fallback: match exact option text
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
 * Parses pasted TNPSC Previous Year Questions (Tamil & English) into structured records
 * with full validation, duplicate detection, and zero silent skipping.
 */
export function parsePastedPreviousYearQuestions(
  rawText: string,
  defaultSubject = 'General Studies'
): PasteParseResult {
  const rawBlocks = splitRawPasteIntoBlocks(rawText)
  const questions: ParsedPreviousPaperQuestion[] = []
  const seenNormalized = new Map<string, number>()

  for (let idx = 0; idx < rawBlocks.length; idx++) {
    const { origNum, rawBlock } = rawBlocks[idx]
    const lines = rawBlock.split('\n')

    const stemLines: string[] = []
    const options: [string, string, string, string] = ['', '', '', '']
    let answerRaw = ''
    const explanationLines: string[] = []
    let subject = defaultSubject
    let topic = ''

    let mode: 'stem' | 'option' | 'explanation' = 'stem'
    let activeOptIdx = -1

    for (const rawLine of lines) {
      const trimmed = rawLine.trim()
      if (!trimmed) {
        if (mode === 'explanation' && explanationLines.length > 0) {
          explanationLines.push('')
        }
        continue
      }

      const clean = cleanLine(trimmed)

      // Subject / Topic metadata lines
      const subjMatch = clean.match(/^(?:Subject|பாடம்)\s*[:\-–—]\s*(.+)$/i)
      if (subjMatch) {
        subject = subjMatch[1].trim()
        continue
      }
      const topicMatch = clean.match(/^(?:Topic|தலைப்பு)\s*[:\-–—]\s*(.+)$/i)
      if (topicMatch) {
        topic = topicMatch[1].trim()
        continue
      }

      // Explanation header (same-line or next-line)
      const expMatch = clean.match(/^(?:Explanation|Solution|Rationale|விளக்கம்)\s*[:\-–—]?\s*(.*)$/i)
      if (expMatch && /^(?:Explanation|Solution|Rationale|விளக்கம்)\s*[:\-–—]?/i.test(clean)) {
        // Guard: only treat standalone "Explanation" or "Explanation: ..." as header
        if (clean.includes(':') || clean.includes('-') || clean.includes('–') || /^(?:Explanation|Solution|விளக்கம்)$/i.test(clean)) {
          mode = 'explanation'
          if (expMatch[1] && expMatch[1].trim()) {
            explanationLines.push(expMatch[1].trim())
          }
          continue
        }
      }

      // Answer header
      const ansMatch = clean.match(/^(?:Correct\s*Answer|Answer|Ans\.?|Key|சரியான\s*விடை|விடை)\s*[:\-–—]\s*(.*)$/i)
      if (ansMatch) {
        answerRaw = ansMatch[1].trim()
        mode = 'stem' // wait for explanation or next line
        activeOptIdx = -1
        continue
      }

      // Option line: "A) ...", "(A) ...", "A. ...", "Option A: ...", "(அ) ...", "அ) ..."
      const optMatch = clean.match(/^(?:Option\s+)?\(?\s*([A-Da-dஅஆஇஈ])\s*[.):\-]\s*(.+)$/i)
      if (optMatch && mode !== 'explanation') {
        const key = optMatch[1].toLowerCase()
        if (key in OPTION_LETTER_MAP) {
          activeOptIdx = OPTION_LETTER_MAP[key]
          options[activeOptIdx] = optMatch[2].trim()
          mode = 'option'
          continue
        }
      }

      // Append continuation lines
      if (mode === 'explanation') {
        explanationLines.push(trimmed)
      } else if (mode === 'option' && activeOptIdx >= 0) {
        options[activeOptIdx] = `${options[activeOptIdx]} ${trimmed}`.trim()
      } else {
        stemLines.push(trimmed)
      }
    }

    let questionText = stemLines.join('\n').trim()

    // Handle single-line inline options if options weren't on separate lines
    if (options.filter(Boolean).length === 0 && questionText) {
      const inline = tryInlineOptionsSplit(questionText)
      if (inline) {
        questionText = inline.stem
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

    const correctAnswer = resolveAnswerFromValue(answerRaw, options)
    const explanation = explanationLines.join('\n').trim()

    // Validation checks (never invent missing options or answers!)
    const issues: string[] = []
    if (!questionText) {
      issues.push('Question text is empty')
    }
    const presentOpts = options.filter((o) => o.trim().length > 0).length
    const missingOptions = presentOpts < 4
    if (missingOptions) {
      issues.push(`Missing options (${presentOpts}/4 detected)`)
    }
    const missingAnswer = correctAnswer === null
    if (missingAnswer) {
      issues.push('Missing or invalid correct answer')
    }

    // Duplicate detection
    const norm = normalizeQuestionForDuplicateCheck(questionText)
    let isDuplicate = false
    let duplicateOfNumber: number | null = null
    if (norm.length >= 12) {
      if (seenNormalized.has(norm)) {
        isDuplicate = true
        duplicateOfNumber = seenNormalized.get(norm) ?? null
        issues.push(`Duplicate of Question #${duplicateOfNumber}`)
      } else {
        seenNormalized.set(norm, idx + 1)
      }
    }

    const needsReview = issues.length > 0

    questions.push({
      clientId: `pyp_paste_${idx + 1}_${Date.now()}`,
      questionNumber: idx + 1,
      originalQuestionNumber: origNum || String(idx + 1),
      questionText,
      optionA: options[0],
      optionB: options[1],
      optionC: options[2],
      optionD: options[3],
      correctAnswer,
      explanation,
      subject: subject || defaultSubject,
      topic,
      isDuplicate,
      duplicateOfNumber,
      missingOptions,
      missingAnswer,
      needsReview,
      issues,
    })
  }

  const missingOptionsCount = questions.filter((q) => q.missingOptions).length
  const missingAnswersCount = questions.filter((q) => q.missingAnswer).length
  const duplicateCount = questions.filter((q) => q.isDuplicate).length
  const needsReviewCount = questions.filter((q) => q.needsReview).length
  const successfullyParsed = questions.filter((q) => !q.needsReview).length

  return {
    questions,
    summary: {
      totalPasted: questions.length,
      successfullyParsed,
      missingOptionsCount,
      missingAnswersCount,
      duplicateCount,
      needsReviewCount,
    },
  }
}
