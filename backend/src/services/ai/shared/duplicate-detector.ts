/**
 * Server-Side Duplicate Detection and Avoidance Engine
 * Strictly shared across Anthropic Claude AI and Google Gemini AI.
 * 
 * Verifies generated MCQs against:
 * 1. Published questions in the database (status = 'published')
 * 2. Staged questions awaiting review (status = 'staging')
 * 3. Questions within the current generation batch
 * 
 * Criteria:
 * - Normalized text comparison (Unicode NFC, lowercase, punctuation removal, whitespace trimming)
 * - SHA-256 fingerprint hash
 * - Exact match detection
 * - Jaccard token/word overlap similarity (threshold >= 0.75 / 75%)
 * - Option duplicate detection
 */

import crypto from 'crypto';
import pool from '../../../db';
import { StandardizedMcqItem } from './mcq-schema';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: 'batch_duplicate' | 'exact_database_match' | 'semantic_database_similarity' | 'identical_options';
  matchedQuestionId?: number;
  similarityScore?: number;
  matchedText?: string;
}

export interface BatchDuplicateFilterResult {
  uniqueQuestions: StandardizedMcqItem[];
  duplicateCount: number;
  checkedCount: number;
  duplicateDetails: Array<{
    questionText: string;
    reason: string;
    similarityScore?: number;
    matchedText?: string;
  }>;
}

/**
 * Normalizes question text for robust comparison across Tamil and English:
 * - Unicode NFC normalization
 * - Lowercase
 * - Strips punctuation, quotes, symbols, bullet points
 * - Collapses consecutive whitespace
 */
export function normalizeQuestionText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFC')
    .toLowerCase()
    // Remove punctuation and special symbols while preserving Tamil and English alphanumeric characters
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»“”‘’[\]<>|\\+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes a deterministic SHA-256 fingerprint from normalized question text.
 */
export function computeQuestionFingerprint(text: string): string {
  const normalized = normalizeQuestionText(text);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Computes Jaccard word-level similarity coefficient between two texts.
 * Returns a score between 0.0 and 1.0.
 */
export function computeJaccardSimilarity(textA: string, textB: string): number {
  const normA = normalizeQuestionText(textA);
  const normB = normalizeQuestionText(textB);

  if (normA === normB && normA.length > 0) return 1.0;

  // 1. Word-level similarity
  const wordsA = new Set(normA.split(' ').filter((w) => w.length > 1));
  const wordsB = new Set(normB.split(' ').filter((w) => w.length > 1));

  let wordSim = 0;
  if (wordsA.size > 0 && wordsB.size > 0) {
    let intersectionCount = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) {
        intersectionCount++;
      }
    }
    const unionCount = new Set([...wordsA, ...wordsB]).size;
    wordSim = unionCount === 0 ? 0.0 : intersectionCount / unionCount;
  }

  // 2. Character trigram similarity for morphologically rich/agglutinative text (Tamil & English compounds)
  const getTrigrams = (str: string) => {
    const compact = str.replace(/\s+/g, '');
    const set = new Set<string>();
    for (let i = 0; i <= compact.length - 3; i++) {
      set.add(compact.slice(i, i + 3));
    }
    return set;
  };

  const triA = getTrigrams(normA);
  const triB = getTrigrams(normB);
  let triSim = 0;
  if (triA.size > 0 && triB.size > 0) {
    let triInter = 0;
    for (const t of triA) {
      if (triB.has(t)) triInter++;
    }
    const triUnion = new Set([...triA, ...triB]).size;
    triSim = triUnion === 0 ? 0.0 : triInter / triUnion;
  }

  // Highest confidence between word-level overlap and n-gram morphological overlap
  return Math.max(wordSim, triSim);
}

/**
 * Checks if two sets of 4 options are functionally identical (regardless of order).
 */
export function areOptionsIdentical(optsA: string[], optsB: string[]): boolean {
  if (optsA.length !== 4 || optsB.length !== 4) return false;
  const setA = new Set(optsA.map((o) => normalizeQuestionText(o)));
  const setB = new Set(optsB.map((o) => normalizeQuestionText(o)));
  if (setA.size !== 4 || setB.size !== 4) return false;
  for (const item of setA) {
    if (!setB.has(item)) return false;
  }
  return true;
}

/**
 * Retrieves candidate reference questions from the database for duplicate matching.
 * Scopes to matching subject, standard, or unit when provided, plus global recent questions.
 */
export async function fetchDatabaseCandidateQuestions(params: {
  subject?: string;
  classId?: number;
  unitId?: number;
  lessonTitle?: string;
  limit?: number;
}): Promise<Array<{ id: number; question_text: string; options: any; status: string }>> {
  try {
    const conditions: string[] = ["status IN ('published', 'staging')"];
    const values: any[] = [];
    let idx = 1;

    if (params.classId) {
      conditions.push(`class_id = $${idx++}`);
      values.push(params.classId);
    }

    if (params.subject) {
      conditions.push(`LOWER(subject) = LOWER($${idx++})`);
      values.push(params.subject);
    }

    if (params.unitId) {
      conditions.push(`unit_id = $${idx++}`);
      values.push(params.unitId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT id, question_text, options, status
      FROM questions
      ${whereClause}
      ORDER BY id DESC
      LIMIT ${params.limit || 500}
    `;

    const res = await pool.query(query, values);
    return res.rows;
  } catch (err) {
    console.warn('[DuplicateDetector] Failed to fetch candidate questions from DB:', err);
    return [];
  }
}

/**
 * Evaluates and filters a batch of generated MCQs against intra-batch duplicates and database questions.
 * Enforces >= 0.75 semantic similarity cutoff.
 */
export async function filterDuplicates(
  generatedQuestions: StandardizedMcqItem[],
  context: {
    subject?: string;
    classId?: number;
    unitId?: number;
    lessonTitle?: string;
  } = {}
): Promise<BatchDuplicateFilterResult> {
  const dbCandidates = await fetchDatabaseCandidateQuestions(context);

  const uniqueQuestions: StandardizedMcqItem[] = [];
  const duplicateDetails: BatchDuplicateFilterResult['duplicateDetails'] = [];

  // Track fingerprints of questions accepted into the current batch
  const batchFingerprints = new Set<string>();
  const batchNormalized = new Set<string>();

  for (const q of generatedQuestions) {
    const rawText = q.question || '';
    const normalized = normalizeQuestionText(rawText);
    const fingerprint = computeQuestionFingerprint(rawText);

    q.fingerprint = fingerprint;

    // 1. Intra-batch duplicate check
    if (batchFingerprints.has(fingerprint) || batchNormalized.has(normalized)) {
      duplicateDetails.push({
        questionText: rawText,
        reason: 'Duplicate question within the same generation batch',
      });
      continue;
    }

    // Check batch semantic similarity
    let isBatchSemanticDuplicate = false;
    for (const existing of uniqueQuestions) {
      const sim = computeJaccardSimilarity(rawText, existing.question);
      if (sim >= 0.75) {
        duplicateDetails.push({
          questionText: rawText,
          reason: `High semantic similarity (${Math.round(sim * 100)}%) with another question in this batch`,
          similarityScore: sim,
          matchedText: existing.question,
        });
        isBatchSemanticDuplicate = true;
        break;
      }
    }
    if (isBatchSemanticDuplicate) continue;

    // 2. Database candidate comparison (published + staging)
    let isDbDuplicate = false;
    const qOptions = [q.options.A, q.options.B, q.options.C, q.options.D];

    for (const dbRow of dbCandidates) {
      const dbNorm = normalizeQuestionText(dbRow.question_text);

      // Exact normalized text match
      if (dbNorm === normalized) {
        duplicateDetails.push({
          questionText: rawText,
          reason: `Exact match found in database (${dbRow.status} question #${dbRow.id})`,
          similarityScore: 1.0,
          matchedText: dbRow.question_text,
        });
        isDbDuplicate = true;
        break;
      }

      // Check Jaccard semantic similarity (threshold >= 0.75)
      const sim = computeJaccardSimilarity(rawText, dbRow.question_text);
      if (sim >= 0.75) {
        duplicateDetails.push({
          questionText: rawText,
          reason: `High semantic similarity (${Math.round(sim * 100)}%) with database question #${dbRow.id} (${dbRow.status})`,
          similarityScore: sim,
          matchedText: dbRow.question_text,
        });
        isDbDuplicate = true;
        break;
      }

      // Check identical options set
      let dbOptions: string[] = [];
      if (Array.isArray(dbRow.options)) {
        dbOptions = dbRow.options.map(String);
      }
      if (dbOptions.length === 4 && areOptionsIdentical(qOptions, dbOptions)) {
        duplicateDetails.push({
          questionText: rawText,
          reason: `Identical set of 4 options matches database question #${dbRow.id}`,
          matchedText: dbRow.question_text,
        });
        isDbDuplicate = true;
        break;
      }
    }

    if (isDbDuplicate) continue;

    // Item passed all duplicate checks
    batchFingerprints.add(fingerprint);
    batchNormalized.add(normalized);
    uniqueQuestions.push(q);
  }

  return {
    uniqueQuestions,
    duplicateCount: duplicateDetails.length,
    checkedCount: generatedQuestions.length,
    duplicateDetails,
  };
}
