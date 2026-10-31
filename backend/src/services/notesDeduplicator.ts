/**
 * notesDeduplicator.ts
 *
 * Strict Duplicate Content Prevention System for TNPSC Study Notes.
 *
 * Capabilities:
 * 1. Normalized text hashing (SHA-256) & multi-metric similarity detection.
 * 2. Intra-lesson markdown deduplication (never repeat topics, paragraphs, definitions, examples, facts, or table rows).
 * 3. Cross-chunk multi-pass deduplication (merges sequential PDF chunks into unified 11-section format without repetition).
 * 4. Database-level duplicate detection (checks candidate notes against Staging & Published notes for the same lesson).
 * 5. Publishing duplicate prevention (ensures only 1 authoritative note per lesson is live on the website).
 * 6. Smart merge utility (merges novel textbook points into existing notes without data loss).
 */

import crypto from 'crypto';
import { Pool, PoolClient } from 'pg';
import { cleanTamilUnicodeText } from './tamilUnicodeCleaner';

export interface DeduplicationStats {
  duplicateLinesRemoved: number;
  duplicateParagraphsRemoved: number;
  duplicateDefinitionsRemoved: number;
  duplicateExamplesRemoved: number;
  duplicateFactsRemoved: number;
  duplicateTableRowsRemoved: number;
  uniqueTopicsCount: number;
  contentHash: string;
}

export interface DuplicateCheckParams {
  category: string;
  subject: string;
  classId?: number | null;
  unitId: number;
  lessonId?: string | null;
  lessonTitle: string;
  language?: string;
  content: string;
  currentNoteId?: number;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType?: 'exact' | 'near_duplicate' | 'none';
  similarityScore?: number;
  existingNote?: {
    id: number;
    title: string;
    status: 'staging' | 'published' | 'archived';
    lessonId?: string | null;
    similarity: number;
  };
  recommendation?: 'skip' | 'update_existing' | 'allow';
}

/**
 * Normalizes text for comparison and content hashing.
 * Removes markdown markers, collapses spaces, and cleans Tamil Unicode NFC.
 */
export function normalizeTextForComparison(text: string): string {
  if (!text) return '';
  return cleanTamilUnicodeText(text)
    .normalize('NFC')
    .replace(/[#*_~`>|\-\+\(\)\[\]:;!?\.,\"\'\/\\\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Computes a deterministic SHA-256 content hash of normalized study notes.
 */
export function computeContentHash(content: string): string {
  const normalized = normalizeTextForComparison(content);
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Calculates text similarity score between 0.0 (completely distinct) and 1.0 (identical)
 * using a hybrid blend of Token Jaccard and Character 3-Gram Shingle overlap.
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const norm1 = normalizeTextForComparison(text1);
  const norm2 = normalizeTextForComparison(text2);

  if (!norm1 || !norm2) return 0.0;
  if (norm1 === norm2) return 1.0;

  // 1. Word token Jaccard similarity
  const tokens1 = norm1.split(' ').filter((w) => w.length > 1);
  const tokens2 = norm2.split(' ').filter((w) => w.length > 1);

  if (tokens1.length === 0 || tokens2.length === 0) return 0.0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  let wordInter = 0;
  for (const t of set1) {
    if (set2.has(t)) wordInter++;
  }
  const wordUnion = new Set([...tokens1, ...tokens2]).size;
  const wordJaccard = wordUnion > 0 ? wordInter / wordUnion : 0;

  // 2. Character 3-gram shingle similarity (captures morphological & suffix variations in Tamil)
  const getShingles = (str: string): Set<string> => {
    const shingles = new Set<string>();
    const clean = str.replace(/\s+/g, '');
    for (let i = 0; i <= clean.length - 3; i++) {
      shingles.add(clean.substring(i, i + 3));
    }
    return shingles;
  };

  const shingles1 = getShingles(norm1);
  const shingles2 = getShingles(norm2);

  let shingleInter = 0;
  for (const s of shingles1) {
    if (shingles2.has(s)) shingleInter++;
  }
  const shingleUnion = new Set([...shingles1, ...shingles2]).size;
  const shingleJaccard = shingleUnion > 0 ? shingleInter / shingleUnion : 0;

  // Blend: 50% word-level + 50% character-shingle level
  return Math.round((0.5 * wordJaccard + 0.5 * shingleJaccard) * 1000) / 1000;
}

/**
 * Extracts key from a definition line (e.g. "- **மாத்திரை**: கால அளவு" -> "மாத்திரை")
 */
function extractDefinitionTermKey(line: string): string | null {
  const match = line.match(/^[-*]\s*\*\*([^*]+)\*\*\s*[:–—]/);
  if (match) {
    return normalizeTextForComparison(match[1]);
  }
  const altMatch = line.match(/^[-*]\s*([^:–—]+)[:–—]/);
  if (altMatch && altMatch[1].length < 40) {
    return normalizeTextForComparison(altMatch[1]);
  }
  return null;
}

/**
 * Deduplicates rows in a markdown table.
 */
function deduplicateMarkdownTable(tableBlock: string): { cleanTable: string; rowsRemoved: number } {
  const lines = tableBlock.trim().split('\n');
  if (lines.length < 3) return { cleanTable: tableBlock, rowsRemoved: 0 };

  const header1 = lines[0];
  const header2 = lines[1]; // separator row e.g. |---|---|
  const dataRows = lines.slice(2);

  const seenRows = new Set<string>();
  const uniqueDataRows: string[] = [];
  let rowsRemoved = 0;

  for (const row of dataRows) {
    const trimmed = row.trim();
    if (!trimmed.startsWith('|')) {
      uniqueDataRows.push(row);
      continue;
    }
    const norm = normalizeTextForComparison(trimmed);
    if (seenRows.has(norm)) {
      rowsRemoved++;
      continue;
    }
    seenRows.add(norm);
    uniqueDataRows.push(row);
  }

  return {
    cleanTable: [header1, header2, ...uniqueDataRows].join('\n'),
    rowsRemoved,
  };
}

/**
 * Deduplicates bullet list lines and items while preserving the most informative version.
 */
function deduplicateBulletList(
  lines: string[],
  seenGlobal: Set<string>
): { uniqueLines: string[]; removed: number } {
  const uniqueLines: string[] = [];
  let removed = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      uniqueLines.push(line);
      continue;
    }

    // Check if line is bullet or numbered
    const isBulletOrNum = /^[-*]\s+|\d+[\.\)]\s+/.test(trimmed);
    if (!isBulletOrNum) {
      uniqueLines.push(line);
      continue;
    }

    const norm = normalizeTextForComparison(trimmed);
    if (norm.length < 5) {
      uniqueLines.push(line);
      continue;
    }

    if (seenGlobal.has(norm)) {
      removed++;
      continue;
    }

    // Check similarity with already seen items (>= 88% similarity is considered a duplicate)
    let isNearDup = false;
    for (const seen of seenGlobal) {
      if (calculateTextSimilarity(norm, seen) >= 0.88) {
        isNearDup = true;
        break;
      }
    }

    if (isNearDup) {
      removed++;
      continue;
    }

    seenGlobal.add(norm);
    uniqueLines.push(line);
  }

  return { uniqueLines, removed };
}

/**
 * Deduplicates paragraphs in a section body.
 */
function deduplicateParagraphs(
  body: string,
  seenGlobal: Set<string>
): { cleanBody: string; paragraphsRemoved: number } {
  const paragraphs = body.split(/\n\s*\n/);
  const uniqueParagraphs: string[] = [];
  let paragraphsRemoved = 0;

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    // Don't deduplicate headings or short markdown dividers
    if (trimmed.startsWith('#') || trimmed.startsWith('---') || trimmed.startsWith('|')) {
      uniqueParagraphs.push(p);
      continue;
    }

    const norm = normalizeTextForComparison(trimmed);
    if (norm.length < 15) {
      uniqueParagraphs.push(p);
      continue;
    }

    if (seenGlobal.has(norm)) {
      paragraphsRemoved++;
      continue;
    }

    // Near-duplicate paragraph check (>= 85% overlap)
    let isDup = false;
    for (const seen of seenGlobal) {
      if (calculateTextSimilarity(norm, seen) >= 0.85) {
        isDup = true;
        break;
      }
    }

    if (isDup) {
      paragraphsRemoved++;
      continue;
    }

    seenGlobal.add(norm);
    uniqueParagraphs.push(p);
  }

  return {
    cleanBody: uniqueParagraphs.join('\n\n'),
    paragraphsRemoved,
  };
}

export interface ParsedMarkdownSection {
  number: number;
  headerLine: string;
  title: string;
  body: string;
}

/**
 * Parses markdown into its numbered sections (1 to 12).
 */
export function parseSectionsFromMarkdown(markdown: string): {
  preamble: string;
  sections: ParsedMarkdownSection[];
} {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const sectionRegex = /(?:^|\n)(##\s*(\d+)[\.:\s]+([^\n]+)|(?:SECTION|பிரிவு)\s*(\d+)[\.:\s]*([^\n]+)|###\s*📋?\s*([^\n]*(?:ஆய்வு அறிக்கை|Quality Audit|Coverage Report)[^\n]*))/gi;
  const matches = [...normalized.matchAll(sectionRegex)];

  if (matches.length === 0) {
    return {
      preamble: '',
      sections: [
        {
          number: 1,
          headerLine: '## 1. COMPREHENSIVE STUDY NOTES',
          title: 'Comprehensive Study Notes',
          body: normalized,
        },
      ],
    };
  }

  const preamble = normalized.substring(0, matches[0].index || 0).trim();
  const sections: ParsedMarkdownSection[] = [];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const secNum = parseInt(m[2] || m[4] || (m[6] ? '12' : `${i + 1}`), 10);
    const headerLine = m[1].trim();
    const title = (m[3] || m[5] || m[6] || '').trim();
    const startIndex = (m.index || 0) + m[0].length;
    const endIndex = i + 1 < matches.length ? matches[i + 1].index : normalized.length;
    const body = normalized.substring(startIndex, endIndex).trim();

    sections.push({
      number: secNum,
      headerLine,
      title,
      body,
    });
  }

  return { preamble, sections };
}

/**
 * Strict intra-note deduplication:
 * Removes duplicate topics, repeated definitions, duplicate examples, identical facts,
 * repeated table rows, and repeated paragraphs across the entire Study Note.
 */
export function deduplicateMarkdownContent(markdown: string): {
  cleanedMarkdown: string;
  stats: DeduplicationStats;
} {
  const { preamble, sections } = parseSectionsFromMarkdown(markdown);

  const seenNormalizedPhrases = new Set<string>();
  const seenTopics = new Set<string>();
  const seenDefinitionTerms = new Map<string, string>(); // termKey -> fullLine

  let duplicateLinesRemoved = 0;
  let duplicateParagraphsRemoved = 0;
  let duplicateDefinitionsRemoved = 0;
  let duplicateExamplesRemoved = 0;
  let duplicateFactsRemoved = 0;
  let duplicateTableRowsRemoved = 0;

  const cleanedSections: ParsedMarkdownSection[] = [];

  for (const sec of sections) {
    let cleanBody = sec.body;

    // Section 3: All Main Topics (Maintain strict unique topics)
    if (sec.number === 3) {
      const lines = cleanBody.split('\n');
      const uniqueTopicLines: string[] = [];
      let itemNum = 1;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const norm = normalizeTextForComparison(trimmed);
        if (norm.length < 3) continue;

        if (seenTopics.has(norm)) {
          duplicateLinesRemoved++;
          continue;
        }
        seenTopics.add(norm);

        // Standardize numbering: 1. ... 2. ...
        const cleanText = trimmed.replace(/^[\d\.\-\*\)]+\s*/, '');
        uniqueTopicLines.push(`${itemNum++}. ${cleanText}`);
      }
      cleanBody = uniqueTopicLines.join('\n');
    }

    // Section 4: All Subtopics (Maintain unique subtopics)
    else if (sec.number === 4) {
      const lines = cleanBody.split('\n');
      const uniqueSubLines: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const norm = normalizeTextForComparison(trimmed);
        if (norm.length < 3) continue;

        if (seenTopics.has(norm)) {
          duplicateLinesRemoved++;
          continue;
        }
        seenTopics.add(norm);
        uniqueSubLines.push(trimmed);
      }
      cleanBody = uniqueSubLines.join('\n');
    }

    // Section 5: Detailed Explanations (Prevent duplicate paragraphs)
    else if (sec.number === 5) {
      const { cleanBody: dedupedBody, paragraphsRemoved } = deduplicateParagraphs(
        cleanBody,
        seenNormalizedPhrases
      );
      cleanBody = dedupedBody;
      duplicateParagraphsRemoved += paragraphsRemoved;
    }

    // Section 6: Definitions and Important Terms (Unique terms only)
    else if (sec.number === 6) {
      const lines = cleanBody.split('\n');
      const uniqueDefLines: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
          uniqueDefLines.push(line);
          continue;
        }

        const termKey = extractDefinitionTermKey(trimmed);
        if (termKey) {
          if (seenDefinitionTerms.has(termKey)) {
            // Keep the definition that has page citation or is longer
            const existing = seenDefinitionTerms.get(termKey)!;
            if (/பக்கம்|page/i.test(trimmed) && !/பக்கம்|page/i.test(existing)) {
              // Replace with more detailed version
              const idx = uniqueDefLines.indexOf(existing);
              if (idx !== -1) uniqueDefLines[idx] = trimmed;
              seenDefinitionTerms.set(termKey, trimmed);
            }
            duplicateDefinitionsRemoved++;
            continue;
          }
          seenDefinitionTerms.set(termKey, trimmed);
          uniqueDefLines.push(trimmed);
        } else {
          uniqueDefLines.push(trimmed);
        }
      }
      cleanBody = uniqueDefLines.join('\n');
    }

    // Section 7: Examples from Textbook (Unique examples)
    else if (sec.number === 7) {
      const lines = cleanBody.split('\n');
      const { uniqueLines, removed } = deduplicateBulletList(lines, seenNormalizedPhrases);
      cleanBody = uniqueLines.join('\n');
      duplicateExamplesRemoved += removed;
    }

    // Section 8: Important Facts and Information (Unique facts)
    else if (sec.number === 8) {
      const lines = cleanBody.split('\n');
      const { uniqueLines, removed } = deduplicateBulletList(lines, seenNormalizedPhrases);
      cleanBody = uniqueLines.join('\n');
      duplicateFactsRemoved += removed;
    }

    // Section 9: Tables and Classifications (Deduplicate table rows)
    else if (sec.number === 9 || sec.number === 11 || sec.number === 12) {
      if (cleanBody.includes('|')) {
        const { cleanTable, rowsRemoved } = deduplicateMarkdownTable(cleanBody);
        cleanBody = cleanTable;
        duplicateTableRowsRemoved += rowsRemoved;
      }
    }

    // Section 10: Important Exam-Oriented Points (Unique points)
    else if (sec.number === 10) {
      const lines = cleanBody.split('\n');
      const { uniqueLines, removed } = deduplicateBulletList(lines, seenNormalizedPhrases);
      cleanBody = uniqueLines.join('\n');
      duplicateLinesRemoved += removed;
    }

    // General fallback deduplication on paragraph level
    else if (sec.number === 2) {
      const { cleanBody: dedupedBody, paragraphsRemoved } = deduplicateParagraphs(
        cleanBody,
        seenNormalizedPhrases
      );
      cleanBody = dedupedBody;
      duplicateParagraphsRemoved += paragraphsRemoved;
    }

    cleanedSections.push({
      ...sec,
      body: cleanBody.trim(),
    });
  }

  // Re-assemble markdown
  const assembledParts: string[] = [];
  if (preamble) assembledParts.push(preamble);

  for (const s of cleanedSections) {
    assembledParts.push(`${s.headerLine}\n${s.body}`);
  }

  const finalMarkdown = assembledParts.join('\n\n');
  const contentHash = computeContentHash(finalMarkdown);

  return {
    cleanedMarkdown: finalMarkdown,
    stats: {
      duplicateLinesRemoved,
      duplicateParagraphsRemoved,
      duplicateDefinitionsRemoved,
      duplicateExamplesRemoved,
      duplicateFactsRemoved,
      duplicateTableRowsRemoved,
      uniqueTopicsCount: seenTopics.size,
      contentHash,
    },
  };
}

/**
 * Merges multi-chunk sequential PDF responses into a single cohesive 11-section document.
 * Eliminates repeated preambles, repeated introductions, and duplicate sections across chunks.
 */
export function mergeAndDeduplicateChunks(chunkMarkdowns: string[]): string {
  if (chunkMarkdowns.length === 0) return '';
  if (chunkMarkdowns.length === 1) {
    return deduplicateMarkdownContent(chunkMarkdowns[0]).cleanedMarkdown;
  }

  // Map of section number -> aggregated content pieces
  const aggregatedSections = new Map<number, { headerLine: string; title: string; bodies: string[] }>();
  let primaryPreamble = '';

  for (let idx = 0; idx < chunkMarkdowns.length; idx++) {
    const rawChunk = chunkMarkdowns[idx];
    const { preamble, sections } = parseSectionsFromMarkdown(rawChunk);

    if (idx === 0 && preamble) {
      primaryPreamble = preamble;
    }

    for (const sec of sections) {
      if (!aggregatedSections.has(sec.number)) {
        aggregatedSections.set(sec.number, {
          headerLine: sec.headerLine,
          title: sec.title,
          bodies: [sec.body],
        });
      } else {
        const existing = aggregatedSections.get(sec.number)!;
        existing.bodies.push(sec.body);
      }
    }
  }

  // Combine aggregated sections in numeric order 1 to 12
  const combinedParts: string[] = [];
  if (primaryPreamble) combinedParts.push(primaryPreamble);

  const sortedSecNums = Array.from(aggregatedSections.keys()).sort((a, b) => a - b);
  for (const num of sortedSecNums) {
    const sec = aggregatedSections.get(num)!;
    // Don't duplicate full section 1 & 2 across chunks, just keep the first or merged introduction
    const mergedBody = num === 1 || num === 2 ? sec.bodies[0] : sec.bodies.join('\n\n');
    combinedParts.push(`${sec.headerLine}\n${mergedBody}`);
  }

  const mergedRawMarkdown = combinedParts.join('\n\n');
  return deduplicateMarkdownContent(mergedRawMarkdown).cleanedMarkdown;
}

export function getEquivalentCategories(cat: string): string[] {
  const c = (cat || '').trim().toLowerCase();
  if (c === 'group2' || c === 'group2a' || c === 'group2_2a') {
    return ['group2', 'group2a', 'group2_2a'];
  }
  if (c === 'group4' || c === 'vao' || c === 'group4_vao') {
    return ['group4', 'vao', 'group4_vao'];
  }
  return [c];
}

/**
 * Checks if a candidate study note already exists in the database
 * for the same TNPSC Group, Subject, Standard, Unit and Lesson.
 * Detects both exact hash matches and near-duplicate similarity (>= 88%).
 */
export async function checkDuplicateNoteInDb(
  client: PoolClient | Pool,
  params: DuplicateCheckParams
): Promise<DuplicateCheckResult> {
  const { category, subject, classId, unitId, lessonId, lessonTitle, content, currentNoteId } = params;

  const candidateHash = computeContentHash(content);
  const equivalentCats = getEquivalentCategories(category);
  const parsedUnitId = Number(unitId) || 1;
  const parsedClassId = classId ? Number(classId) : null;
  const targetLessonId = lessonId ? String(lessonId).trim() : null;
  const targetLessonTitle = cleanTamilUnicodeText(lessonTitle || '').trim();

  // 1. Check exact content hash match across all notes
  const hashQuery = `
    SELECT id, title, lesson_title, lesson_id, status, category, subject, unit_id, class_id
    FROM study_notes
    WHERE content_hash = $1
      ${currentNoteId ? `AND id != ${Number(currentNoteId)}` : ''}
    LIMIT 1;
  `;
  const hashResult = await client.query(hashQuery, [candidateHash]);

  if (hashResult.rows.length > 0) {
    const matched = hashResult.rows[0];
    return {
      isDuplicate: true,
      duplicateType: 'exact',
      similarityScore: 1.0,
      existingNote: {
        id: matched.id,
        title: matched.title || matched.lesson_title,
        status: matched.status,
        lessonId: matched.lesson_id,
        similarity: 1.0,
      },
      recommendation: matched.status === 'published' ? 'skip' : 'update_existing',
    };
  }

  // 2. Query existing notes for the same syllabus coordinates (lessonId or lessonTitle matching)
  const syllabusQueryConditions: string[] = ['category = ANY($1)', 'unit_id = $2'];
  const values: any[] = [equivalentCats, parsedUnitId];
  let pIdx = 3;

  if (parsedClassId) {
    syllabusQueryConditions.push(`(class_id = $${pIdx} OR class_id IS NULL)`);
    values.push(parsedClassId);
    pIdx++;
  }

  if (targetLessonId) {
    syllabusQueryConditions.push(`(lesson_id = $${pIdx} OR LOWER(lesson_title) = LOWER($${pIdx + 1}))`);
    values.push(targetLessonId, targetLessonTitle);
    pIdx += 2;
  } else if (targetLessonTitle) {
    syllabusQueryConditions.push(`LOWER(lesson_title) = LOWER($${pIdx})`);
    values.push(targetLessonTitle);
    pIdx++;
  }

  if (currentNoteId) {
    syllabusQueryConditions.push(`id != $${pIdx++}`);
    values.push(Number(currentNoteId));
  }

  const existingNotesQuery = `
    SELECT id, title, lesson_title, lesson_id, status, content, content_hash
    FROM study_notes
    WHERE ${syllabusQueryConditions.join(' AND ')}
    ORDER BY id DESC
    LIMIT 10;
  `;

  const existingNotesResult = await client.query(existingNotesQuery, values);

  for (const existing of existingNotesResult.rows) {
    // If exact hash matches
    if (existing.content_hash && existing.content_hash === candidateHash) {
      return {
        isDuplicate: true,
        duplicateType: 'exact',
        similarityScore: 1.0,
        existingNote: {
          id: existing.id,
          title: existing.title || existing.lesson_title,
          status: existing.status,
          lessonId: existing.lesson_id,
          similarity: 1.0,
        },
        recommendation: existing.status === 'published' ? 'skip' : 'update_existing',
      };
    }

    // Calculate semantic & shingle similarity
    const similarity = calculateTextSimilarity(content, existing.content || '');
    if (similarity >= 0.88) {
      return {
        isDuplicate: true,
        duplicateType: 'near_duplicate',
        similarityScore: similarity,
        existingNote: {
          id: existing.id,
          title: existing.title || existing.lesson_title,
          status: existing.status,
          lessonId: existing.lesson_id,
          similarity,
        },
        recommendation: existing.status === 'published' ? 'skip' : 'update_existing',
      };
    }
  }

  return {
    isDuplicate: false,
    duplicateType: 'none',
    similarityScore: 0.0,
    recommendation: 'allow',
  };
}

/**
 * Smart merge utility:
 * Merges novel items (definitions, examples, facts, tables) from new content into existing content
 * without losing any unique information or repeating existing points.
 */
export function smartMergeNotes(existingContent: string, newContent: string): string {
  const parsedExisting = parseSectionsFromMarkdown(existingContent);
  const parsedNew = parseSectionsFromMarkdown(newContent);

  const existingSecMap = new Map<number, ParsedMarkdownSection>();
  for (const s of parsedExisting.sections) {
    existingSecMap.set(s.number, s);
  }

  for (const newSec of parsedNew.sections) {
    if (!existingSecMap.has(newSec.number)) {
      existingSecMap.set(newSec.number, newSec);
    } else {
      const existingSec = existingSecMap.get(newSec.number)!;
      // Combine bodies
      existingSec.body = `${existingSec.body}\n\n${newSec.body}`;
    }
  }

  // Re-assemble and run through intra-note deduplicator
  const combinedParts: string[] = [];
  if (parsedExisting.preamble) combinedParts.push(parsedExisting.preamble);

  const sortedNums = Array.from(existingSecMap.keys()).sort((a, b) => a - b);
  for (const num of sortedNums) {
    const s = existingSecMap.get(num)!;
    combinedParts.push(`${s.headerLine}\n${s.body}`);
  }

  return deduplicateMarkdownContent(combinedParts.join('\n\n')).cleanedMarkdown;
}
