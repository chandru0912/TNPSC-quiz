/**
 * Client-side question boundary estimator using the EXACT same anchored patterns
 * and contextual state machine as backend/src/services/pasteTextMcqParser.ts.
 *
 * Guarantees Estimated Questions === Detected Questions for all supported formats
 * (including ### Q200, **Q1.**, Q.No: 1, Question No. 1, (A)-(E), **Answer: (A)**, Tamil).
 */

const MD_DIVIDER_RE = /^\s*(?:[-*_]\s*){3,}$/
const EXPLICIT_Q_RE =
  /^(?:[*_]{1,3})?(?:Q(?:uestion|ues|No)?\.?\s*(?:No\.?\s*[:.]?\s*)?#?|கேள்வி(?:\s*எண்)?\.?\s*[:.]?\s*|வினா(?:\s*எண்)?\.?\s*[:.]?\s*)(\d{1,5})(?:[*_]{1,3})?\s*(?:[.):\-–—]|$|\s)(?:[*_]{1,3})?\s*(.*)$/i
const BARE_NUM_Q_RE =
  /^(?:[*_]{1,3})?(?:\((\d{1,5})\)|\[(\d{1,5})\]|(\d{1,5})\s*[.):])(?:[*_]{1,3})?\s*(.*)$/
const ANSWER_KEY_HEADER_RE =
  /^(?:[*_]{1,3})?(?:ANSWER\s*KEY|ANSWERS|OFFICIAL\s*KEY|விடைக்குறிப்பு|விடைகள்)\s*:?(?:[*_]{1,3})?\s*$/i
const OPTION_LINE_RE =
  /^(?:[*_]{1,3})?(?:\(([A-Ea-eஅஆஇஈஉ])\)|\[([A-Ea-eஅஆஇஈஉ])\]|([A-Ea-eஅஆஇஈஉ])\s*[.):])(?:[*_]{1,3})?\s*(.*)$/
const ANSWER_LINE_RE =
  /^(?:[*_]{1,3})?(?:Correct\s*Answer|Correct\s*Option|Right\s*Answer|Answer|Ans\.|Ans|Key|சரியான\s*விடை|விடை)(?:[*_]{1,3})?(?:\s*[:\-–—=]\s*|\s+is\s+|\s+)(.*)$/i
const EXPLANATION_LINE_RE =
  /^(?:[*_]{1,3})?(?:Explanation|Exp\.?|Solution|Sol\.?|Rationale|விளக்கம்|குறிப்பு)(?:[*_]{1,3})?\s*(?:[:\-–—]\s*|$)(.*)$/i

function unwrapLine(rawLine: string): string {
  return rawLine
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s*/, '')
    .replace(/^[-*•]\s+/, '')
}

function hasInlineOptions(rawLine: string): boolean {
  const line = unwrapLine(rawLine)
  const tokenRe =
    /(?:^|\t|\s{2,})(?:[*_]{1,2})?(?:\(([A-Ea-eஅஆஇஈஉ])\)|\[([A-Ea-eஅஆஇஈஉ])\]|([A-Ea-eஅஆஇஈஉ])([.)]))(?:[*_]{1,2})?\s+|(?:\s)(?:[*_]{1,2})?(?:\(([A-Ea-eஅஆஇஈஉ])\)|\[([A-Ea-eஅஆஇஈஉ])\]|([A-Ea-eஅஆஇஈஉ])(\)))(?:[*_]{1,2})?\s+/g
  let count = 0
  while (tokenRe.exec(line) !== null) {
    count++
    if (count >= 2) return true
  }
  return false
}

function isOptionLine(rawLine: string): boolean {
  const u = unwrapLine(rawLine)
  return Boolean(u && OPTION_LINE_RE.test(u))
}

function isExplicitQ(rawLine: string): boolean {
  const u = unwrapLine(rawLine)
  return Boolean(u && EXPLICIT_Q_RE.test(u))
}

function isBareQ(rawLine: string): boolean {
  const u = unwrapLine(rawLine)
  if (!u) return false
  const m = BARE_NUM_Q_RE.exec(u)
  if (!m) return false
  const numVal = Number(m[1] || m[2] || m[3] || '0')
  return numVal <= 1500
}

function looksLikeQuestionAhead(lines: string[], startIdx: number): boolean {
  let inspected = 0
  let sawOpt = 0
  for (let i = startIdx + 1; i < lines.length && inspected < 18; i++) {
    const l = lines[i]
    if (!l.trim() || MD_DIVIDER_RE.test(l)) continue
    inspected++
    if (isExplicitQ(l)) break
    if (hasInlineOptions(l) || isOptionLine(l)) {
      sawOpt++
      if (sawOpt >= 2) return true
    }
  }
  return sawOpt >= 1
}

export function estimatePasteTextQuestionCount(raw: string): number {
  const clean = String(raw || '').replace(/\r\n?/g, '\n')
  if (!clean.trim()) return 0

  let lines = clean.split('\n')
  // Strip trailing Answer Key block if present
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 300); i--) {
    if (ANSWER_KEY_HEADER_RE.test(unwrapLine(lines[i]))) {
      lines = lines.slice(0, i)
      break
    }
  }

  let count = 0
  let inBlock = false
  let hasOptions = false
  let inExplanation = false
  let hasAnswer = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (MD_DIVIDER_RE.test(line)) continue

    if (isExplicitQ(line)) {
      const validBoundary = !inExplanation || looksLikeQuestionAhead(lines, i) || /^#{1,6}\s/.test(line.trim())
      if (validBoundary) {
        count++
        inBlock = true
        hasOptions = false
        inExplanation = false
        hasAnswer = false
        continue
      }
    }

    if (isBareQ(line)) {
      let isNew = false
      if (!inBlock) {
        isNew = looksLikeQuestionAhead(lines, i)
      } else if (inExplanation) {
        isNew = looksLikeQuestionAhead(lines, i)
      } else if (hasOptions || hasAnswer) {
        isNew = hasAnswer || looksLikeQuestionAhead(lines, i)
      }
      if (isNew) {
        count++
        inBlock = true
        hasOptions = false
        inExplanation = false
        hasAnswer = false
        continue
      }
    }

    if (!inBlock) {
      if (!line.trim()) continue
      if (/^#{1,6}\s+/.test(line.trim()) && !isExplicitQ(line)) continue
      if (looksLikeQuestionAhead(lines, i)) {
        count++
        inBlock = true
        hasOptions = false
        inExplanation = false
        hasAnswer = false
      }
      continue
    }

    const u = unwrapLine(line)
    if (u && EXPLANATION_LINE_RE.test(u)) {
      inExplanation = true
    } else if (!inExplanation && u && ANSWER_LINE_RE.test(u)) {
      hasAnswer = true
    } else if (!inExplanation && (hasInlineOptions(line) || isOptionLine(line))) {
      hasOptions = true
    }
  }

  return count
}
