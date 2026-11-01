import React, { useMemo } from 'react'
import { CheckCircle2, ChevronRight, BookOpen, Layers } from 'lucide-react'
import { cleanTamilUnicodeText } from '../utils/tamilUnicodeCleaner'

export interface TamilStudyNotesRendererProps {
  content: string
  className?: string
  showLessonHeader?: boolean
}

interface TableBlock {
  type: 'table'
  headers: string[]
  rows: string[][]
}

interface HeadingBlock {
  type: 'heading'
  level: number
  text: string
}

interface ListBlock {
  type: 'list'
  ordered: boolean
  items: Array<{ num?: string; text: string }>
}

interface CalloutBlock {
  type: 'callout'
  text: string
}

interface ParagraphBlock {
  type: 'paragraph'
  text: string
}

type ContentBlock = TableBlock | HeadingBlock | ListBlock | CalloutBlock | ParagraphBlock

/**
 * Parses raw markdown into structured semantic blocks for optimal Tamil typography.
 */
function parseContentBlocks(raw: string): ContentBlock[] {
  if (!raw) return []
  const cleaned = cleanTamilUnicodeText(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = cleaned.split('\n')
  const blocks: ContentBlock[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()

    // 1. Skip empty lines
    if (!line) {
      i++
      continue
    }

    // 2. Table detection (starts with |)
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }

      if (tableLines.length >= 2) {
        const rawHeaders = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map((h) => h.trim())

        const rows: string[][] = []
        for (let r = 1; r < tableLines.length; r++) {
          const rLine = tableLines[r]
          if (rLine.replace(/[\s|:-]/g, '') === '') continue // separator line like |---|---|
          const cols = rLine
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim())
          if (cols.length > 0) rows.push(cols)
        }

        if (rawHeaders.length > 0) {
          blocks.push({
            type: 'table',
            headers: rawHeaders,
            rows,
          })
          continue
        }
      }
    }

    // 3. Headings (#, ##, ###, ####)
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      })
      i++
      continue
    }

    // 4. Blockquotes / Callouts (> quote)
    if (line.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''))
        i++
      }
      blocks.push({
        type: 'callout',
        text: quoteLines.join(' ').trim(),
      })
      continue
    }

    // 5. Unordered List items (- , * , • )
    if (/^[-*•]\s+/.test(line)) {
      const items: Array<{ text: string }> = []
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push({
          text: lines[i].trim().replace(/^[-*•]\s+/, ''),
        })
        i++
      }
      blocks.push({
        type: 'list',
        ordered: false,
        items,
      })
      continue
    }

    // 6. Ordered List items (1. , 2. )
    const numMatch = line.match(/^(\d+)[\.\)]\s+(.+)$/)
    if (numMatch) {
      const items: Array<{ num: string; text: string }> = []
      while (i < lines.length) {
        const m = lines[i].trim().match(/^(\d+)[\.\)]\s+(.+)$/)
        if (!m) break
        items.push({
          num: m[1],
          text: m[2].trim(),
        })
        i++
      }
      blocks.push({
        type: 'list',
        ordered: true,
        items,
      })
      continue
    }

    // 7. Regular Paragraph
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('|') &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !/^\d+[\.\)]\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim())
      i++
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: paraLines.join(' '),
      })
    }
  }

  return blocks
}

/**
 * Renders inline Markdown tokens (bold, italic, code) while strictly preserving Tamil script ligatures.
 */
function renderInlineFormatting(rawText: string) {
  if (!rawText) return null
  const text = cleanTamilUnicodeText(rawText)

  // Tokenize **bold**, *italic*, and `code`
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)

  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={idx} className="tamil-inline-strong">
          {token.slice(2, -2)}
        </strong>
      )
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return (
        <em key={idx} className="tamil-inline-em">
          {token.slice(1, -1)}
        </em>
      )
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <code key={idx} className="tamil-inline-code">
          {token.slice(1, -1)}
        </code>
      )
    }
    return <span key={idx}>{token}</span>
  })
}

export const TamilStudyNotesRenderer: React.FC<TamilStudyNotesRendererProps> = ({
  content,
  className = '',
  showLessonHeader = false,
}) => {
  const blocks = useMemo(() => parseContentBlocks(content), [content])

  return (
    <div className={`tamil-notes-renderer ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            if (block.level === 1) {
              if (!showLessonHeader) return null
              return (
                <h2 key={idx} className="tamil-heading-l1">
                  <BookOpen size={22} className="tamil-heading-icon" />
                  <span>{renderInlineFormatting(block.text)}</span>
                </h2>
              )
            }
            if (block.level === 2 || block.level === 3) {
              return (
                <h3 key={idx} className="tamil-heading-l2">
                  <Layers size={18} className="tamil-heading-icon-accent" />
                  <span>{renderInlineFormatting(block.text)}</span>
                </h3>
              )
            }
            return (
              <h4 key={idx} className="tamil-heading-l4">
                <ChevronRight size={15} className="tamil-heading-bullet-arrow" />
                <span>{renderInlineFormatting(block.text)}</span>
              </h4>
            )
          }

          case 'list': {
            if (block.ordered) {
              return (
                <div key={idx} className="tamil-ordered-list">
                  {block.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="tamil-list-item">
                      <div className="tamil-num-badge">{item.num || itemIdx + 1}</div>
                      <div className="tamil-list-text">{renderInlineFormatting(item.text)}</div>
                    </div>
                  ))}
                </div>
              )
            }
            return (
              <div key={idx} className="tamil-bullet-list">
                {block.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="tamil-list-item">
                    <CheckCircle2 size={16} className="tamil-bullet-icon" />
                    <div className="tamil-list-text">{renderInlineFormatting(item.text)}</div>
                  </div>
                ))}
              </div>
            )
          }

          case 'table': {
            return (
              <div key={idx} className="tamil-table-responsive-wrapper">
                <table className="tamil-markdown-table">
                  <thead>
                    <tr>
                      {block.headers.map((h, hIdx) => (
                        <th key={hIdx}>{renderInlineFormatting(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((col, cIdx) => (
                          <td key={cIdx}>{renderInlineFormatting(col)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }

          case 'callout': {
            return (
              <div key={idx} className="tamil-callout-card">
                <div className="tamil-callout-indicator" />
                <div className="tamil-callout-content">{renderInlineFormatting(block.text)}</div>
              </div>
            )
          }

          case 'paragraph': {
            return (
              <p key={idx} className="tamil-paragraph">
                {renderInlineFormatting(block.text)}
              </p>
            )
          }

          default:
            return null
        }
      })}
    </div>
  )
}
export default TamilStudyNotesRenderer
