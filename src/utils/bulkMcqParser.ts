export type ParsedMcqStatus = 'valid' | 'duplicate' | 'error'

export interface ParsedBulkMcq {
  clientId: string
  index: number
  question: string
  options: [string, string, string, string]
  correctAnswer: number | null // 0..3
  rawAnswerLine: string
  explanation: string
  topic: string
  difficulty: 'Easy' | 'Medium' | 'Moderate' | 'Hard' | 'Difficult' | 'Advanced'
  sourcePage: number | null
  status: ParsedMcqStatus
  issues: string[]
  duplicateReason?: string | null
  matchedQuestion?: string | null
  serverValidated?: boolean
}

const OPTION_LETTER_MAP: Record<string, number> = {
  a: 0, b: 1, c: 2, d: 3,
  '1': 0, '2': 1, '3': 2, '4': 3,
  'அ': 0, 'ஆ': 1, 'இ': 2, 'ஈ': 3,
}

export function normalizeForClientCompare(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0B80-\u0BFF]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSetClient(text: string): Set<string> {
  const stop = new Set([
    'the', 'and', 'for', 'with', 'from', 'which', 'what', 'who', 'where', 'when', 'how',
    'following', 'correct', 'statement', 'choose', 'identify', 'is', 'are', 'was', 'were',
    'என்ன', 'எது', 'யார்', 'பின்வரும்', 'சரியான',
  ])
  return new Set(
    normalizeForClientCompare(text)
      .split(' ')
      .filter((w) => (w.length > 2 || /^\d+$/.test(w)) && !stop.has(w))
  )
}

function jaccardClient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

function cleanMarkdown(line: string): string {
  return line.replace(/^\*{1,2}|\*{1,2}$/g, '').replace(/^#+\s*/, '').trim()
}

function parseDifficulty(raw: string, fallback: ParsedBulkMcq['difficulty']): ParsedBulkMcq['difficulty'] {
  const v = raw.trim().toLowerCase()
  if (v === 'easy') return 'Easy'
  if (v === 'moderate') return 'Moderate'
  if (v === 'medium') return 'Medium'
  if (v === 'difficult') return 'Difficult'
  if (v === 'hard') return 'Hard'
  if (v === 'advanced') return 'Advanced'
  return fallback
}

/**
 * Splits a large pasted text block (10, 50, 100, 200+ MCQs) into individual question blocks.
 */
function splitIntoQuestionBlocks(rawText: string): string[] {
  const text = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!text) return []

  const lines = text.split('\n')
  const blocks: string[] = []
  let current: string[] = []
  let sawOptionInCurrent = false

  const isExplicitQuestionHeader = (line: string): boolean => {
    const clean = cleanMarkdown(line)
    if (/^(?:Question|Ques|Q\.?|வினா)\s*\d+\s*[:.)\-–—]/i.test(clean)) return true
    if (/^(?:Question|Ques|வினா)\s*\d+\s*$/i.test(clean)) return true
    // Numbered question like "1. What is..." or "12) Which..." ONLY when we haven't started options yet,
    // OR we already saw options/answer in the previous question (so numbered statements "1. ... 2. ..." inside a stem aren't split!)
    if (/^\d{1,4}\s*[.)]\s+\S/.test(clean)) {
      if (current.length === 0 || sawOptionInCurrent) return true
    }
    return false
  }

  const isOptionLine = (line: string): boolean => {
    const clean = cleanMarkdown(line)
    return /^(?:\(?[A-Da-dஅ-ஈ]\)|[A-Da-dஅ-ஈ][.):\-])\s+\S/.test(clean) || /^Option\s+[A-Da-d]\s*[:.)\-]\s+\S/i.test(clean)
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed) {
      if (current.length > 0) current.push('')
      continue
    }
    if (/^[-_=*]{4,}$/.test(trimmed)) {
      continue
    }

    if (isExplicitQuestionHeader(trimmed) && current.length > 0 && sawOptionInCurrent) {
      blocks.push(current.join('\n').trim())
      current = [trimmed]
      sawOptionInCurrent = false
      continue
    }

    if (isOptionLine(trimmed)) {
      sawOptionInCurrent = true
    }
    current.push(trimmed)
  }

  if (current.length > 0) {
    const joined = current.join('\n').trim()
    if (joined) blocks.push(joined)
  }

  return blocks
}

/**
 * Expands inline options like "A) Kilogram  B) Metre  C) Second  D) Kelvin" into separate lines.
 */
function expandInlineOptions(line: string): string[] {
  const clean = cleanMarkdown(line)
  if (/(?:^|\s)\(?[Aa][).]\s+/.test(clean) && /\s\(?[Bb][).]\s+/.test(clean)) {
    const parts = clean.split(/(?=(?:^|\s)\(?[A-Da-d][).]\s+)/g).map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2) return parts
  }
  return [line]
}

function parseSingleBlock(
  block: string,
  index: number,
  defaults: { topic: string; difficulty: ParsedBulkMcq['difficulty'] }
): ParsedBulkMcq {
  const rawLines = block.split('\n').flatMap(expandInlineOptions)
  const questionLines: string[] = []
  const options: string[] = ['', '', '', '']
  const foundOptionIndices = new Set<number>()
  let rawAnswerLine = ''
  const explanationLines: string[] = []
  let topic = defaults.topic
  let difficulty: ParsedBulkMcq['difficulty'] = defaults.difficulty
  let sourcePage: number | null = null

  type Section = 'question' | 'options' | 'explanation'
  let section: Section = 'question'
  let lastOptionIdx = -1

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim()
    if (!trimmed) continue
    const clean = cleanMarkdown(trimmed)

    // Metadata lines: Topic, Difficulty, Page
    const topicMatch = clean.match(/^(?:Topic|Subtopic|தலைப்பு)\s*[:\-–—]\s*(.+)$/i)
    if (topicMatch) {
      topic = topicMatch[1].trim()
      continue
    }
    const diffMatch = clean.match(/^(?:Difficulty|Level|கடினத்தன்மை)\s*[:\-–—]\s*(.+)$/i)
    if (diffMatch) {
      difficulty = parseDifficulty(diffMatch[1], defaults.difficulty)
      continue
    }
    const pageMatch = clean.match(/^(?:Page|PDF\s*Page|Source\s*Page|பக்கம்)\s*[:\-–—]?\s*(\d{1,4})/i)
    if (pageMatch && section !== 'question') {
      sourcePage = parseInt(pageMatch[1], 10)
      continue
    }

    // Answer line
    const ansMatch = clean.match(
      /^(?:Correct\s*Answer|Correct\s*Option|Answer|Ans|Key|Right\s*Answer|சரியான\s*விடை|விடை)\s*[:\-–—]?\s*(.+)$/i
    )
    if (ansMatch && (foundOptionIndices.size > 0 || section !== 'question')) {
      rawAnswerLine = ansMatch[1].trim()
      section = 'options'
      continue
    }

    // Explanation line
    const expMatch = clean.match(/^(?:Explanation|Solution|Reason|Rationale|விளக்கம்)\s*[:\-–—]?\s*(.*)$/i)
    if (expMatch) {
      section = 'explanation'
      if (expMatch[1].trim()) explanationLines.push(expMatch[1].trim())
      continue
    }

    // Option line: A) ..., (A) ..., A. ..., Option A: ..., அ) ...
    const optMatch = clean.match(/^(?:Option\s+|விடை\s+)?\(?([A-Da-dஅ-ஈ])\)?\s*[.):\-]\s*(.+)$/i)
    if (optMatch && section !== 'explanation') {
      const letterKey = optMatch[1].toLowerCase()
      const idx = OPTION_LETTER_MAP[letterKey]
      if (idx !== undefined) {
        section = 'options'
        lastOptionIdx = idx
        foundOptionIndices.add(idx)
        options[idx] = cleanMarkdown(optMatch[2].trim())
        continue
      }
    }

    if (section === 'explanation') {
      explanationLines.push(clean)
    } else if (section === 'options' && lastOptionIdx >= 0 && !rawAnswerLine) {
      options[lastOptionIdx] = `${options[lastOptionIdx]} ${clean}`.trim()
    } else {
      // Strip leading "Question 1:", "Q1.", "1." on the first line of the question
      let qLine = clean
      if (questionLines.length === 0) {
        qLine = qLine
          .replace(/^(?:Question|Ques|Q\.?|வினா)\s*\d+\s*[:.)\-–—]?\s*/i, '')
          .replace(/^\d{1,4}\s*[.)]\s+/, '')
          .trim()
      }
      if (qLine) questionLines.push(qLine)
    }
  }

  let question = questionLines.join('\n').trim()
  if (question.endsWith(':')) {
    question = `${question.slice(0, -1).trim()}?`
  }

  // Resolve correct answer & detect multiple / mismatched answers
  const issues: string[] = []
  let correctAnswer: number | null = null

  if (!question || question.length < 10) {
    issues.push('Question text is missing or too short (minimum 10 characters).')
  } else if (!question.endsWith('?')) {
    // Auto-normalize interrogative or flag
    question = `${question}?`
  }

  const missingOptLetters = ['A', 'B', 'C', 'D'].filter((_, i) => !options[i] || !options[i].trim())
  if (missingOptLetters.length > 0) {
    issues.push(`Missing option(s): ${missingOptLetters.join(', ')}.`)
  } else {
    const uniqueNorm = new Set(options.map((o) => normalizeForClientCompare(o)))
    if (uniqueNorm.size < 4) {
      issues.push('Duplicate options detected (all 4 options must be distinct).')
    }
  }

  if (!rawAnswerLine) {
    issues.push('Missing Correct Answer.')
  } else {
    const cleanAns = cleanMarkdown(rawAnswerLine)
    // Check for multiple answers like "A and B", "A, B", "A & C"
    if (/^\(?[A-Da-d]\)?\s*(?:,|&|and|\/)\s*\(?[A-Da-d]\)?/i.test(cleanAns)) {
      issues.push(`Multiple correct answers detected ("${cleanAns}"). Exactly one correct answer is required.`)
    } else {
      // Match leading letter + optional text: "B) Metre", "(B) Metre", "B. Metre", "Option B", "B"
      const letterWithText = cleanAns.match(/^(?:Option\s+|விடை\s+)?\(?([A-Da-dஅ-ஈ])\)?(?:\s*[.):\-–—]\s*(.*))?$/i)
      if (letterWithText) {
        const idx = OPTION_LETTER_MAP[letterWithText[1].toLowerCase()]
        if (idx !== undefined) {
          correctAnswer = idx
          const trailingText = (letterWithText[2] || '').trim()
          if (trailingText && options[idx]) {
            const normTrail = normalizeForClientCompare(trailingText)
            const normOpt = normalizeForClientCompare(options[idx])
            if (normTrail && normOpt && normTrail !== normOpt && !normOpt.includes(normTrail) && !normTrail.includes(normOpt)) {
              issues.push(
                `Suspicious answer key: "${cleanAns}" does not match Option ${['A', 'B', 'C', 'D'][idx]} ("${options[idx]}"). Please verify.`
              )
            }
          }
        }
      } else {
        // Try matching by exact option text
        const normAns = normalizeForClientCompare(cleanAns)
        const matchedIndices = options
          .map((o, i) => (normalizeForClientCompare(o) === normAns ? i : -1))
          .filter((i) => i >= 0)
        if (matchedIndices.length === 1) {
          correctAnswer = matchedIndices[0]
        } else if (matchedIndices.length > 1) {
          issues.push(`Answer "${cleanAns}" matches multiple options.`)
        } else {
          issues.push(`Correct answer "${cleanAns}" does not match options A, B, C, or D.`)
        }
      }
    }
  }

  const explanation = explanationLines.join(' ').trim()

  return {
    clientId: `bulk_${Date.now().toString(36)}_${index}_${Math.random().toString(36).slice(2, 6)}`,
    index: index + 1,
    question,
    options: [options[0] || '', options[1] || '', options[2] || '', options[3] || ''],
    correctAnswer,
    rawAnswerLine,
    explanation,
    topic: topic || defaults.topic,
    difficulty,
    sourcePage,
    status: issues.length > 0 ? 'error' : 'valid',
    issues,
  }
}

/**
 * Re-validates a list of parsed MCQs (including after inline admin edits)
 * and marks exact / semantic duplicates within the pasted batch.
 */
export function revalidateParsedBatch(items: ParsedBulkMcq[]): ParsedBulkMcq[] {
  const seenValid: Array<{ norm: string; tokens: Set<string>; question: string }> = []

  return items.map((item, idx) => {
    const issues: string[] = []
    const q = item.question.trim()
    if (!q || q.length < 10) {
      issues.push('Question text is missing or too short (minimum 10 characters).')
    }
    const missingOpts = ['A', 'B', 'C', 'D'].filter((_, i) => !item.options[i]?.trim())
    if (missingOpts.length > 0) {
      issues.push(`Missing option(s): ${missingOpts.join(', ')}.`)
    } else {
      const uniq = new Set(item.options.map((o) => normalizeForClientCompare(o)))
      if (uniq.size < 4) {
        issues.push('Duplicate options detected (all 4 options must be distinct).')
      }
    }
    if (item.correctAnswer === null || item.correctAnswer < 0 || item.correctAnswer > 3) {
      issues.push('Correct answer must be selected (A, B, C, or D).')
    }

    // Preserve any suspicious answer-key warning if still unresolved
    for (const prevIssue of item.issues) {
      if (prevIssue.startsWith('Suspicious answer key:') && issues.length === 0) {
        issues.push(prevIssue)
      }
    }

    if (issues.length > 0) {
      return { ...item, index: idx + 1, status: 'error', issues, duplicateReason: null, matchedQuestion: null }
    }

    const norm = normalizeForClientCompare(q)
    const toks = tokenSetClient(q)
    let dupReason: string | null = null
    let matchedQ: string | null = null

    for (const prev of seenValid) {
      if (prev.norm === norm) {
        dupReason = 'EXACT (within pasted batch)'
        matchedQ = prev.question
        break
      }
      if (jaccardClient(toks, prev.tokens) >= 0.78) {
        dupReason = 'SEMANTIC (within pasted batch)'
        matchedQ = prev.question
        break
      }
    }

    if (dupReason) {
      return {
        ...item,
        index: idx + 1,
        status: 'duplicate',
        issues: [`Duplicate question: ${dupReason}`],
        duplicateReason: dupReason,
        matchedQuestion: matchedQ,
      }
    }

    seenValid.push({ norm, tokens: toks, question: q })
    return {
      ...item,
      index: idx + 1,
      status: 'valid',
      issues: [],
      duplicateReason: null,
      matchedQuestion: null,
    }
  })
}

/**
 * Parses raw pasted MCQ text into validated, preview-ready items.
 */
export function parseBulkMcqText(
  rawText: string,
  defaults: { topic: string; difficulty: ParsedBulkMcq['difficulty'] }
): ParsedBulkMcq[] {
  const blocks = splitIntoQuestionBlocks(rawText)
  const parsed = blocks.map((block, i) => parseSingleBlock(block, i, defaults))
  return revalidateParsedBatch(parsed)
}
