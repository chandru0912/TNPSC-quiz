import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pool from '../db';
import { AIProviderConfigService } from './ai/ai-provider-config.service';
import { getGeminiApiKey, getGeminiModel, getGeminiFallbackModels, resolveGeminiModel } from './ai/providers/gemini/gemini.config';
import { parseGeminiJsonResponse, classifyGeminiError } from './ai/providers/gemini/gemini.validator';
import { GeminiRetryService } from './ai/providers/gemini/geminiRetryService';
import { computeBufferSha256, letterToOptionIndex } from './previousPaperPdfParser';
import { ensurePreviousPapersAdminSchema } from './previousPapersAdminService';

export type PypVerificationStatus =
  | 'VERIFIED'
  | 'ORIGINAL_KEY_ONLY'
  | 'NEEDS_REVIEW'
  | 'ANSWER_MISSING'
  | 'ANSWER_CONFLICT';

export const CANONICAL_TNPSC_SUBJECTS = [
  'General Studies',
  'General Science',
  'Indian Polity',
  'Indian History',
  'Indian Geography',
  'Indian Economy',
  'Aptitude and Mental Ability',
  'General Tamil',
  'General English',
] as const;

export interface PypGeminiTextSettings {
  model?: string;
  batchSize: number; // 10–20 questions per batch (default 15)
  expectedQuestions: number; // default 200
  answerVerificationEnabled: boolean;
  explanationGenerationEnabled: boolean;
  subjectClassificationEnabled: boolean;
  duplicateDetectionEnabled: boolean;
}

export interface PypGeminiExamMetadata {
  group: string;
  examName: string;
  year: number;
  subject: string;
  medium: 'Tamil' | 'English' | 'Bilingual';
  paperType: string;
  expectedQuestions?: number;
}

export interface SourceQuestionBlock {
  sourceQuestionId: string;
  sourceOrder: number;
  originalNumber: string;
  rawText: string;
}

export interface GeminiExtractedMcq {
  clientId: string;
  sourceQuestionId: string;
  questionNumber: number;
  originalQuestionNumber: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  options: { A: string; B: string; C: string; D: string };
  originalAnswer: number | null;
  aiSuggestedAnswer: number | null;
  verifiedAnswer: number | null;
  correctAnswer: number | null;
  verificationStatus: PypVerificationStatus;
  verificationSource: string;
  explanation: string;
  subject: string;
  topic: string;
  standard: string | null;
  unit: string | null;
  medium: 'Tamil' | 'English' | 'Bilingual';
  examYear: number;
  rawSourceText: string;
  isDuplicate: boolean;
  duplicateOfNumber: number | null;
  hasDuplicateOptions: boolean;
  hasFourOptions: boolean;
  isApproved: boolean;
  needsReview: boolean;
  issues: string[];
  aiProvider: 'gemini';
  aiModel: string;
}

export interface GeminiBatchResult {
  questions: any[];
  inputTokens: number | null;
  outputTokens: number | null;
  modelUsed: string;
  attempts?: number;
  geminiStatus?: string;
}

const MAX_SOURCE_TEXT_BYTES = 2 * 1024 * 1024; // 2 MB (~500+ questions safely)
const MAX_JSON_FILE_BYTES = 5 * 1024 * 1024; // 5 MB max JSON file
const MAX_JSON_NESTING_DEPTH = 12;
const GEMINI_BATCH_TIMEOUT_MS = 90_000;
const activeJobIds = new Set<number>();
const activeSourceHashes = new Set<string>();
let aiTextSchemaPromise: Promise<void> | null = null;

const GEMINI_PRICING_PER_1M: Record<string, { input: number; output: number }> = {
  'gemini-3.5-flash': { input: 0.15, output: 0.6 },
  'gemini-3.5-flash-lite': { input: 0.075, output: 0.3 },
  'gemini-flash-lite-latest': { input: 0.075, output: 0.3 },
  'gemini-3.6-flash': { input: 0.15, output: 0.6 },
  'gemini-3.8-flash': { input: 0.15, output: 0.6 },
  'gemini-3.1-flash-lite': { input: 0.075, output: 0.3 },
};

function estimateGeminiCostUsd(model: string, inputTokens: number | null, outputTokens: number | null): number | null {
  if (inputTokens === null || outputTokens === null) return null;
  const p = GEMINI_PRICING_PER_1M[model.toLowerCase()];
  if (!p) return null;
  return Number(((inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output).toFixed(6));
}

export const STRICT_GEMINI_TEXT_SYSTEM_PROMPT = `You are the TNPSC Previous Year Question Paper Extraction, Verification & MCQ Conversion Engine powered by Google Gemini AI.

STRICT SOURCE FIDELITY RULES:
1. Read EVERY source question block supplied in the batch without skipping any question.
2. Preserve the original source order and exact "sourceQuestionId" for every question.
3. Preserve the original meaning, Tamil Unicode characters, English text, mathematical equations, statements, Assertion/Reason, and Match-the-Following structure.
4. NEVER omit any sentence, condition, or supporting line.
5. Extract existing options A, B, C, D and official answer keys when present in the source.
6. If a source question is incomplete or non-MCQ AND sufficient factual context exists in the source, convert it into a clean 4-option MCQ (A, B, C, D) with distinct, non-duplicate options.
7. NEVER invent unsupported facts or fake official answer keys.
8. NEVER generate unrelated filler questions to reach a target count.
9. NEVER silently change an official answer key. Keep "originalAnswer" separate from "aiSuggestedAnswer".
10. If an answer cannot be determined with certainty from the source, leave "originalAnswer": null and mark for manual review.
11. Generate a clear, concise explanation for each question when enabled.
12. Classify subject strictly into one of: ${CANONICAL_TNPSC_SUBJECTS.join(', ')}. Include topic, standard (e.g. "6th"-"12th" or null), and unit (or null) when identifiable.

Return ONLY valid JSON with this exact schema:
{
  "questions": [
    {
      "sourceQuestionId": "Q1",
      "originalQuestionNumber": "1",
      "questionText": "Complete original question text",
      "options": {
        "A": "Option A text",
        "B": "Option B text",
        "C": "Option C text",
        "D": "Option D text"
      },
      "originalAnswer": "B",
      "aiSuggestedAnswer": "B",
      "explanation": "Clear explanation",
      "subject": "General Studies",
      "topic": "Indian Polity",
      "standard": "10th",
      "unit": "Unit 5",
      "medium": "English"
    }
  ]
}`;

export async function ensurePreviousPaperAiSchema(): Promise<void> {
  await ensurePreviousPapersAdminSchema();
  if (!aiTextSchemaPromise) {
    aiTextSchemaPromise = (async () => {
      await pool.query(`
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(32);
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS ai_model VARCHAR(100);
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS ai_suggested_answer INT;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS original_answer INT;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS verification_status VARCHAR(32);
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS verification_source TEXT;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS standard VARCHAR(32);
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS unit VARCHAR(64);
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS source_question_id VARCHAR(64);
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ;

        CREATE TABLE IF NOT EXISTS previous_paper_ai_text_jobs (
          id SERIAL PRIMARY KEY,
          paper_id INT REFERENCES previous_year_papers(id) ON DELETE SET NULL,
          admin_id TEXT NOT NULL,
          provider VARCHAR(24) NOT NULL DEFAULT 'gemini',
          model VARCHAR(100) NOT NULL,
          source_hash VARCHAR(64) NOT NULL,
          source_char_count INT NOT NULL DEFAULT 0,
          source_text TEXT NOT NULL,
          exam_meta JSONB NOT NULL,
          settings JSONB NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'queued',
          stage VARCHAR(48) NOT NULL DEFAULT 'source_received',
          expected_questions INT DEFAULT 200,
          identified_questions INT DEFAULT 0,
          extracted_count INT DEFAULT 0,
          converted_mcq_count INT DEFAULT 0,
          verified_count INT DEFAULT 0,
          needs_review_count INT DEFAULT 0,
          duplicate_count INT DEFAULT 0,
          missing_count INT DEFAULT 0,
          current_batch INT DEFAULT 0,
          total_batches INT DEFAULT 0,
          control_signal VARCHAR(24),
          input_tokens INT,
          output_tokens INT,
          estimated_cost_usd NUMERIC(10,6),
          duration_ms INT DEFAULT 0,
          failed_batches INT DEFAULT 0,
          retry_count INT DEFAULT 0,
          error_message TEXT,
          extracted_questions JSONB DEFAULT '[]'::jsonb,
          missing_source_ids JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS idx_pyp_ai_text_jobs_created ON previous_paper_ai_text_jobs (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_pyp_ai_text_jobs_hash ON previous_paper_ai_text_jobs (source_hash);

        CREATE TABLE IF NOT EXISTS previous_paper_ai_text_batches (
          id SERIAL PRIMARY KEY,
          job_id INT NOT NULL REFERENCES previous_paper_ai_text_jobs(id) ON DELETE CASCADE,
          batch_number INT NOT NULL,
          status VARCHAR(24) NOT NULL DEFAULT 'pending',
          source_blocks JSONB NOT NULL,
          question_count INT DEFAULT 0,
          extracted_count INT DEFAULT 0,
          attempt_count INT DEFAULT 0,
          model_used VARCHAR(100),
          gemini_status VARCHAR(64),
          error_message TEXT,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (job_id, batch_number)
        );

        ALTER TABLE previous_paper_ai_text_batches ADD COLUMN IF NOT EXISTS attempt_count INT DEFAULT 0;
        ALTER TABLE previous_paper_ai_text_batches ADD COLUMN IF NOT EXISTS model_used VARCHAR(100);
        ALTER TABLE previous_paper_ai_text_batches ADD COLUMN IF NOT EXISTS gemini_status VARCHAR(64);

        CREATE INDEX IF NOT EXISTS idx_pyp_ai_text_batches_job ON previous_paper_ai_text_batches (job_id, batch_number ASC);
      `);
    })().catch((err) => {
      aiTextSchemaPromise = null;
      throw err;
    });
  }
  await aiTextSchemaPromise;
}

export async function getGeminiPreviousPaperProviderStatus() {
  const gemini = await AIProviderConfigService.getProviderStatus('gemini');
  return {
    provider: 'gemini' as const,
    name: gemini.name,
    configured: gemini.configured,
    connected: gemini.connected,
    status: gemini.status,
    statusMessage: gemini.statusMessage || null,
    model: gemini.model,
    maskedKey: gemini.maskedKey,
    availableModels: [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.6-flash',
      'gemini-3.8-flash',
    ],
  };
}

export function normalizeCanonicalSubject(raw?: string | null, fallback?: string): { subject: string; uncertain: boolean } {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) {
    const fb = CANONICAL_TNPSC_SUBJECTS.find((c) => c.toLowerCase() === String(fallback || '').toLowerCase());
    return { subject: fb || 'General Studies', uncertain: !fb };
  }
  if (/tamil|தமிழ்|ilakkanam|ilakkiyam|thirukkural/i.test(s)) return { subject: 'General Tamil', uncertain: false };
  if (/english|grammar|comprehension/i.test(s)) return { subject: 'General English', uncertain: false };
  if (/polity|constitution|governance|parliament|அரசியலமைப்பு/i.test(s)) return { subject: 'Indian Polity', uncertain: false };
  if (/history|national\s*movement|culture|heritage|வரலாறு/i.test(s)) return { subject: 'Indian History', uncertain: false };
  if (/geography|river|climate|monsoon|புவியியல்/i.test(s)) return { subject: 'Indian Geography', uncertain: false };
  if (/economy|economic|gdp|rbi|budget|பொருளாதாரம்/i.test(s)) return { subject: 'Indian Economy', uncertain: false };
  if (/science|physics|chemistry|biology|botany|zoology|அறிவியல்/i.test(s)) return { subject: 'General Science', uncertain: false };
  if (/aptitude|mental\s*ability|math|reasoning|percentage|ratio|கணிதம்|திறனறிவு/i.test(s)) {
    return { subject: 'Aptitude and Mental Ability', uncertain: false };
  }
  if (/general\s*studies|current\s*affairs|unit\s*8|unit\s*9|tn\s*admin/i.test(s)) {
    return { subject: 'General Studies', uncertain: false };
  }
  const exact = CANONICAL_TNPSC_SUBJECTS.find((c) => c.toLowerCase() === s);
  if (exact) return { subject: exact, uncertain: false };
  return { subject: 'General Studies', uncertain: true };
}

function parseOptionIndex(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number' && Number.isInteger(val) && val >= 0 && val <= 3) return val;
  const s = String(val).trim();
  if (/^[0-3]$/.test(s)) return Number(s);
  return letterToOptionIndex(s);
}

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministic source-text question boundary splitter supporting English & Tamil formats:
 * - "QUESTION 1:", "Q1.", "Q.1)", "1.", "1)", "(1)", "கேள்வி 1:", "வினா 1."
 * Preserves 100% of original lines, order, and numbering without truncating a single character.
 */
export function splitSourceTextIntoQuestionBlocks(rawSourceText: string): SourceQuestionBlock[] {
  const clean = String(rawSourceText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .normalize('NFC')
    .trim();

  if (!clean) return [];

  const lines = clean.split('\n');
  const qStartRegex =
    /^\s*(?:(?:QUESTION|Q\.?|QUES\.?|கேள்வி|வினா)\s*#?\s*(\d{1,4})\s*[:.)-]?|(\d{1,4})\s*[.)]\s+\S|\((\d{1,4})\)\s+\S)/i;

  const blocks: SourceQuestionBlock[] = [];
  let currentNum = '';
  let currentLines: string[] = [];

  const flush = () => {
    const joined = currentLines.join('\n').trim();
    if (!joined) return;
    const order = blocks.length + 1;
    const origNum = currentNum || String(order);
    blocks.push({
      sourceQuestionId: `Q${order}`,
      sourceOrder: order,
      originalNumber: origNum,
      rawText: joined,
    });
  };

  for (const line of lines) {
    const match = line.match(qStartRegex);
    // Avoid splitting on option lines like "(1) Statement" if we already have options or if number is out of order small sub-statement
    const matchedNum = match ? match[1] || match[2] || match[3] || '' : '';
    const isSubStatement =
      match &&
      !match[1] && // not explicit "Q1" / "QUESTION 1"
      currentLines.length > 0 &&
      Number(matchedNum) <= 4 &&
      blocks.length >= 4 &&
      Number(matchedNum) < blocks.length;

    if (match && !isSubStatement) {
      if (currentLines.length > 0) flush();
      currentNum = matchedNum;
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) flush();

  // Fallback: if no numbered headers were detected, split by double blank lines
  if (blocks.length === 0) {
    const paras = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    return paras.map((p, idx) => ({
      sourceQuestionId: `Q${idx + 1}`,
      sourceOrder: idx + 1,
      originalNumber: String(idx + 1),
      rawText: p,
    }));
  }

  return blocks;
}

export interface JsonSourceValidationReport {
  valid: boolean;
  filename: string | null;
  byteSize: number;
  detectedCount: number;
  validRecords: number;
  invalidRecords: number;
  missingAnswers: number;
  missingOptions: number;
  duplicateRecords: number;
  detectedExamMeta: Partial<PypGeminiExamMetadata> | null;
  errors: string[];
  warnings: string[];
  sourceBlocks: SourceQuestionBlock[];
  previewQuestions: Array<{
    sourceQuestionId: string;
    questionNumber: string;
    questionText: string;
    options: { A: string; B: string; C: string; D: string };
    answer: string | null;
    explanation: string;
    issues: string[];
  }>;
}

function assertSafeJsonDepth(node: unknown, currentDepth = 0): void {
  if (currentDepth > MAX_JSON_NESTING_DEPTH) {
    throw new Error(`JSON nesting depth exceeds maximum safe limit (${MAX_JSON_NESTING_DEPTH}).`);
  }
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      assertSafeJsonDepth(node[i], currentDepth + 1);
    }
  } else {
    for (const val of Object.values(node as Record<string, unknown>)) {
      assertSafeJsonDepth(val, currentDepth + 1);
    }
  }
}

function extractNormalizedOptionsFromJson(item: Record<string, any>): { A: string; B: string; C: string; D: string } {
  const opts = item.options ?? item.choices;
  if (Array.isArray(opts)) {
    return {
      A: String(opts[0] ?? '').normalize('NFC').trim(),
      B: String(opts[1] ?? '').normalize('NFC').trim(),
      C: String(opts[2] ?? '').normalize('NFC').trim(),
      D: String(opts[3] ?? '').normalize('NFC').trim(),
    };
  }
  if (opts && typeof opts === 'object') {
    return {
      A: String(opts.A ?? opts.a ?? opts['1'] ?? '').normalize('NFC').trim(),
      B: String(opts.B ?? opts.b ?? opts['2'] ?? '').normalize('NFC').trim(),
      C: String(opts.C ?? opts.c ?? opts['3'] ?? '').normalize('NFC').trim(),
      D: String(opts.D ?? opts.d ?? opts['4'] ?? '').normalize('NFC').trim(),
    };
  }
  return {
    A: String(item.optionA ?? item.option_a ?? item.A ?? item.a ?? '').normalize('NFC').trim(),
    B: String(item.optionB ?? item.option_b ?? item.B ?? item.b ?? '').normalize('NFC').trim(),
    C: String(item.optionC ?? item.option_c ?? item.C ?? item.c ?? '').normalize('NFC').trim(),
    D: String(item.optionD ?? item.option_d ?? item.D ?? item.d ?? '').normalize('NFC').trim(),
  };
}

/**
 * Validates and normalizes an uploaded JSON question paper on the backend.
 * Supports both { exam, questions: [...] } objects and direct [...] question arrays,
 * guards against malformed or deeply nested JSON, and preserves all original JSON fields.
 */
export function validateAndNormalizeJsonSource(
  rawJsonText: string,
  options?: { filename?: string | null; expectedQuestions?: number }
): JsonSourceValidationReport {
  const clean = String(rawJsonText || '').replace(/^\uFEFF/, '').trim();
  const byteSize = Buffer.byteLength(clean, 'utf8');
  const errors: string[] = [];
  const warnings: string[] = [];
  const emptyReport = (): JsonSourceValidationReport => ({
    valid: false,
    filename: options?.filename || null,
    byteSize,
    detectedCount: 0,
    validRecords: 0,
    invalidRecords: 0,
    missingAnswers: 0,
    missingOptions: 0,
    duplicateRecords: 0,
    detectedExamMeta: null,
    errors,
    warnings,
    sourceBlocks: [],
    previewQuestions: [],
  });

  if (!clean) {
    errors.push('JSON file is empty.');
    return emptyReport();
  }
  if (byteSize > MAX_JSON_FILE_BYTES) {
    errors.push(`JSON file size (${(byteSize / (1024 * 1024)).toFixed(2)} MB) exceeds the 5.0 MB maximum limit.`);
    return emptyReport();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(clean);
  } catch (err: any) {
    errors.push(`Invalid JSON syntax: ${err?.message || 'Unable to parse JSON.'}`);
    return emptyReport();
  }

  try {
    assertSafeJsonDepth(parsed, 0);
  } catch (err: any) {
    errors.push(err?.message || 'JSON structure is too deeply nested.');
    return emptyReport();
  }

  let rawArray: any[] | null = null;
  let detectedExamMeta: Partial<PypGeminiExamMetadata> | null = null;

  if (Array.isArray(parsed)) {
    rawArray = parsed;
  } else if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.questions)) rawArray = parsed.questions;
    else if (Array.isArray(parsed.mcqs)) rawArray = parsed.mcqs;
    else if (Array.isArray(parsed.items)) rawArray = parsed.items;
    else if (Array.isArray(parsed.data)) rawArray = parsed.data;

    if (parsed.exam && typeof parsed.exam === 'object') {
      const ex = parsed.exam;
      detectedExamMeta = {
        ...(ex.group ? { group: String(ex.group) } : {}),
        ...(ex.year ? { year: Number(ex.year) } : {}),
        ...(ex.paperType ? { paperType: String(ex.paperType) } : {}),
        ...(ex.medium ? { medium: /tamil/i.test(String(ex.medium)) ? 'Tamil' : /bilingual/i.test(String(ex.medium)) ? 'Bilingual' : 'English' } : {}),
        ...(ex.title || ex.name || ex.examName ? { examName: String(ex.title || ex.name || ex.examName) } : {}),
        ...(ex.subject ? { subject: String(ex.subject) } : {}),
      };
    }
  }

  if (!rawArray) {
    errors.push('Unsupported JSON root structure. Expected a JSON array of questions or an object containing a "questions" array.');
    return emptyReport();
  }
  if (rawArray.length === 0) {
    errors.push('JSON "questions" array is empty.');
    return emptyReport();
  }

  const seenQIds = new Set<string>();
  const seenTextSigs = new Set<string>();
  const sourceBlocks: SourceQuestionBlock[] = [];
  const previewQuestions: JsonSourceValidationReport['previewQuestions'] = [];

  let validRecords = 0;
  let invalidRecords = 0;
  let missingAnswers = 0;
  let missingOptions = 0;
  let duplicateRecords = 0;

  for (let i = 0; i < rawArray.length; i++) {
    const item = rawArray[i];
    const order = i + 1;
    const issues: string[] = [];

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      invalidRecords += 1;
      issues.push('Record is not a valid JSON object.');
      previewQuestions.push({
        sourceQuestionId: `Q${order}`,
        questionNumber: String(order),
        questionText: '',
        options: { A: '', B: '', C: '', D: '' },
        answer: null,
        explanation: '',
        issues,
      });
      continue;
    }

    const origNum = String(item.questionNumber ?? item.question_number ?? item.qNo ?? item.number ?? item.id ?? order).trim();
    const qText = String(item.question ?? item.questionText ?? item.question_text ?? item.text ?? item.prompt ?? '')
      .normalize('NFC')
      .trim();
    const opts = extractNormalizedOptionsFromJson(item);
    const ansRaw = item.answer ?? item.correctAnswer ?? item.correct_answer ?? item.ans ?? item.key ?? null;
    const ansStr = ansRaw !== null && ansRaw !== undefined && String(ansRaw).trim() !== '' ? String(ansRaw).trim() : null;
    const explanation = String(item.explanation ?? item.solution ?? item.reason ?? '').normalize('NFC').trim();

    if (!qText) issues.push('Missing question text');
    if (!opts.A || !opts.B || !opts.C || !opts.D) {
      missingOptions += 1;
      issues.push('Missing one or more options A–D');
    }
    if (!ansStr) {
      missingAnswers += 1;
      issues.push('Missing answer');
    }

    const sig = qText.length > 10 ? `${normalizeForCompare(qText)}|${normalizeForCompare(opts.A)}` : '';
    const isDupId = seenQIds.has(origNum);
    const isDupText = Boolean(sig && seenTextSigs.has(sig));
    if (isDupId || isDupText) {
      duplicateRecords += 1;
      issues.push(isDupId ? `Duplicate question number (#${origNum})` : 'Duplicate question text');
    }
    seenQIds.add(origNum);
    if (sig) seenTextSigs.add(sig);

    if (!qText) invalidRecords += 1;
    else validRecords += 1;

    // Preserve complete original JSON record (including unknown fields) inside rawText for Gemini + audit!
    const sourceQuestionId = `Q${order}`;
    const rawStructuredBlock = [
      `QUESTION ${origNum}:`,
      qText,
      opts.A ? `A) ${opts.A}` : '',
      opts.B ? `B) ${opts.B}` : '',
      opts.C ? `C) ${opts.C}` : '',
      opts.D ? `D) ${opts.D}` : '',
      ansStr ? `ANSWER: ${ansStr}` : '',
      explanation ? `EXPLANATION: ${explanation}` : '',
      `ORIGINAL_JSON_RECORD: ${JSON.stringify(item)}`,
    ]
      .filter(Boolean)
      .join('\n');

    sourceBlocks.push({
      sourceQuestionId,
      sourceOrder: order,
      originalNumber: origNum,
      rawText: rawStructuredBlock,
    });

    previewQuestions.push({
      sourceQuestionId,
      questionNumber: origNum,
      questionText: qText,
      options: opts,
      answer: ansStr,
      explanation,
      issues,
    });
  }

  if (options?.expectedQuestions && options.expectedQuestions > 0 && rawArray.length !== options.expectedQuestions) {
    warnings.push(
      `JSON contains ${rawArray.length} question(s) vs Expected Questions Count (${options.expectedQuestions}). All ${rawArray.length} JSON records will be processed without inventing filler questions.`
    );
  }

  return {
    valid: errors.length === 0 && sourceBlocks.length > 0,
    filename: options?.filename || null,
    byteSize,
    detectedCount: rawArray.length,
    validRecords,
    invalidRecords,
    missingAnswers,
    missingOptions,
    duplicateRecords,
    detectedExamMeta,
    errors,
    warnings,
    sourceBlocks,
    previewQuestions,
  };
}

export function validateSourceTextInput(sourceText: string, expectedQuestions = 200) {
  const clean = String(sourceText || '').normalize('NFC').trim();
  const byteSize = Buffer.byteLength(clean, 'utf8');
  const charCount = clean.length;
  const blocks = splitSourceTextIntoQuestionBlocks(clean);
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!clean) {
    errors.push('Source text is empty. Please paste Previous Year Questions before processing.');
  }
  if (byteSize > MAX_SOURCE_TEXT_BYTES) {
    errors.push(`Source text (${(byteSize / (1024 * 1024)).toFixed(2)} MB) exceeds the 2.0 MB safety limit.`);
  }
  if (clean && blocks.length === 0) {
    errors.push('Could not detect any question blocks in the pasted text.');
  }
  if (expectedQuestions > 0 && blocks.length > 0 && blocks.length !== expectedQuestions) {
    warnings.push(
      `Detected ${blocks.length} question block(s) vs Expected Questions Count (${expectedQuestions}). All ${blocks.length} detected source questions will be processed without inventing filler questions.`
    );
  }

  return {
    valid: errors.length === 0,
    charCount,
    byteSize,
    estimatedQuestions: blocks.length,
    expectedQuestions,
    errors,
    warnings,
  };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildCompactPromptBlock(block: SourceQuestionBlock): string {
  // Keep ORIGINAL_JSON_RECORD in block.rawText for audit/UI, but strip that duplicated JSON line from the prompt sent to Gemini
  return String(block.rawText || '')
    .split('\n')
    .filter((line) => !line.startsWith('ORIGINAL_JSON_RECORD:'))
    .join('\n')
    .trim();
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          const err: any = new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s (504).`);
          err.statusCode = 504;
          err.status = 504;
          reject(err);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function callGeminiSingleBatchAttempt(
  blocks: SourceQuestionBlock[],
  meta: PypGeminiExamMetadata,
  settings: PypGeminiTextSettings,
  modelOverride?: string
): Promise<GeminiBatchResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const err: any = new Error('Google Gemini API key is not configured. Set GEMINI_API_KEY in backend environment.');
    err.statusCode = 401;
    err.geminiStatus = '401_MISSING_KEY';
    throw err;
  }

  const primaryModel = resolveGeminiModel(modelOverride || settings.model || getGeminiModel());
  const fallbackModels = getGeminiFallbackModels();
  const genAI = new GoogleGenerativeAI(apiKey);

  const userPrompt = [
    `Examination: ${meta.examName} (${meta.group}, Year: ${meta.year}, Medium: ${meta.medium}, Paper Type: ${meta.paperType}, Default Subject: ${meta.subject})`,
    `Options: answerVerification=${settings.answerVerificationEnabled}, explanationGeneration=${settings.explanationGenerationEnabled}, subjectClassification=${settings.subjectClassificationEnabled}`,
    `Batch contains EXACTLY ${blocks.length} source question(s). You MUST return all ${blocks.length} questions in exact order with their matching "sourceQuestionId". Keep explanations concise (1-2 sentences) so the JSON response is complete and never truncated.`,
    '',
    blocks.map((b) => `=== SOURCE_ID: ${b.sourceQuestionId} (Original #${b.originalNumber}) ===\n${buildCompactPromptBlock(b)}`).join('\n\n'),
  ].join('\n');

  try {
    const execResult = await GeminiRetryService.executeWithRetryAndFallback(
      async (currentModel: string) => {
        const geminiModel = genAI.getGenerativeModel({
          model: currentModel,
          systemInstruction: STRICT_GEMINI_TEXT_SYSTEM_PROMPT,
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 16384,
            responseMimeType: 'application/json',
          },
        });

        const response = await withTimeout(
          geminiModel.generateContent(userPrompt),
          GEMINI_BATCH_TIMEOUT_MS,
          `Gemini request (${currentModel})`
        );

        const rawText = (response.response.text() || '').trim();
        if (!rawText) {
          const emptyErr: any = new Error(`Gemini (${currentModel}) returned an empty response.`);
          emptyErr.statusCode = 502;
          emptyErr.geminiStatus = 'EMPTY_RESPONSE';
          throw emptyErr;
        }

        const parsed = parseGeminiJsonResponse<any>(rawText);
        const rawQuestions = Array.isArray(parsed?.questions)
          ? parsed.questions
          : Array.isArray(parsed)
            ? parsed
            : null;

        if (!rawQuestions || rawQuestions.length === 0) {
          const invalidErr: any = new Error(
            `Gemini (${currentModel}) returned invalid or empty "questions" payload (expected ${blocks.length} items).`
          );
          invalidErr.statusCode = 502;
          invalidErr.geminiStatus = 'EMPTY_QUESTIONS';
          throw invalidErr;
        }

        const validObjects = rawQuestions.filter((q: any) => q && typeof q === 'object' && !Array.isArray(q));
        if (validObjects.length === 0) {
          const malformedErr: any = new Error(
            `Gemini (${currentModel}) returned non-object entries in "questions" array.`
          );
          malformedErr.statusCode = 502;
          malformedErr.geminiStatus = 'MALFORMED_QUESTIONS';
          throw malformedErr;
        }

        const usage = response.response.usageMetadata;
        return {
          questions: validObjects,
          inputTokens: typeof usage?.promptTokenCount === 'number' ? usage.promptTokenCount : null,
          outputTokens: typeof usage?.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : null,
        };
      },
      {
        primaryModel,
        fallbackModels,
        maxRetries: 2,
        retryDelaysMs: [1500, 3500],
      }
    );

    return {
      questions: execResult.data.questions,
      inputTokens: execResult.data.inputTokens,
      outputTokens: execResult.data.outputTokens,
      modelUsed: execResult.modelUsed,
      attempts: execResult.attempts,
      geminiStatus: execResult.isFallback ? `200_OK_FALLBACK(${execResult.modelUsed})` : '200_OK',
    };
  } catch (err: any) {
    const classified = classifyGeminiError(err);
    const wrapped: any = new Error(err?.message || classified.message || 'Google Gemini AI extraction failed.');
    wrapped.statusCode = err?.statusCode || classified.statusCode || 500;
    wrapped.errorType = err?.errorType || classified.errorType;
    wrapped.geminiStatus =
      err?.geminiStatus ||
      `${wrapped.statusCode}_${String(wrapped.errorType || 'ERROR').toUpperCase()}`;
    throw wrapped;
  }
}

async function callGeminiForTextBatch(
  blocks: SourceQuestionBlock[],
  meta: PypGeminiExamMetadata,
  settings: PypGeminiTextSettings,
  modelOverride?: string
): Promise<GeminiBatchResult> {
  try {
    return await callGeminiSingleBatchAttempt(blocks, meta, settings, modelOverride);
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    const isSplitRecoverable =
      blocks.length > 5 &&
      (msg.includes('invalid json') ||
        msg.includes('unexpected end') ||
        msg.includes('unterminated') ||
        msg.includes('timed out') ||
        msg.includes('504') ||
        msg.includes('empty response') ||
        msg.includes('empty "questions"'));

    if (!isSplitRecoverable) {
      throw err;
    }

    // Automatically split oversized/truncated batch into two halves so no source question is lost
    const mid = Math.ceil(blocks.length / 2);
    const leftBlocks = blocks.slice(0, mid);
    const rightBlocks = blocks.slice(mid);
    console.warn(
      `[PreviousPaperAI] Splitting batch (${blocks.length} Qs) into ${leftBlocks.length} + ${rightBlocks.length} after error: ${err?.message}`
    );

    const leftRes = await callGeminiSingleBatchAttempt(leftBlocks, meta, settings, modelOverride);
    const rightRes = await callGeminiSingleBatchAttempt(rightBlocks, meta, settings, leftRes.modelUsed || modelOverride);

    return {
      questions: [...leftRes.questions, ...rightRes.questions],
      inputTokens:
        leftRes.inputTokens !== null || rightRes.inputTokens !== null
          ? (leftRes.inputTokens || 0) + (rightRes.inputTokens || 0)
          : null,
      outputTokens:
        leftRes.outputTokens !== null || rightRes.outputTokens !== null
          ? (leftRes.outputTokens || 0) + (rightRes.outputTokens || 0)
          : null,
      modelUsed: rightRes.modelUsed || leftRes.modelUsed,
      attempts: (leftRes.attempts || 1) + (rightRes.attempts || 1),
      geminiStatus: '200_OK_SUB_BATCH_SPLIT',
    };
  }
}

export function normalizeAndVerifyGeminiMcqs(
  rawItems: any[],
  sourceBlocks: SourceQuestionBlock[],
  context: {
    meta: PypGeminiExamMetadata;
    model: string;
    duplicateDetectionEnabled: boolean;
    existingSignatures?: Map<string, number>;
    startNumber?: number;
  }
): { mcqs: GeminiExtractedMcq[]; missingSourceIds: string[] } {
  const seenSignatures = context.existingSignatures || new Map<string, number>();
  const rawBySourceId = new Map<string, any>();
  const rawByOrigNum = new Map<string, any>();
  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i] || {};
    const sid = String(item.sourceQuestionId || '').trim().toUpperCase();
    if (sid) rawBySourceId.set(sid, item);
    const onum = String(item.originalQuestionNumber || '').trim();
    if (onum) rawByOrigNum.set(onum, item);
  }

  const mcqs: GeminiExtractedMcq[] = [];
  const missingSourceIds: string[] = [];
  const baseNum = context.startNumber || 1;

  for (let i = 0; i < sourceBlocks.length; i++) {
    const block = sourceBlocks[i];
    const r =
      rawBySourceId.get(block.sourceQuestionId.toUpperCase()) ||
      rawBySourceId.get(`Q${block.sourceOrder}`) ||
      rawByOrigNum.get(String(block.originalNumber).trim()) ||
      rawItems[i];
    if (!r) {
      missingSourceIds.push(block.sourceQuestionId);
      continue;
    }

    const qNum = baseNum + mcqs.length;
    const questionText = String(r.questionText || '').normalize('NFC').trim();
    const optsObj = r.options && typeof r.options === 'object' ? r.options : {};
    const optionA = String(r.optionA ?? optsObj.A ?? optsObj.a ?? '').normalize('NFC').trim();
    const optionB = String(r.optionB ?? optsObj.B ?? optsObj.b ?? '').normalize('NFC').trim();
    const optionC = String(r.optionC ?? optsObj.C ?? optsObj.c ?? '').normalize('NFC').trim();
    const optionD = String(r.optionD ?? optsObj.D ?? optsObj.d ?? '').normalize('NFC').trim();

    const originalAnswer = parseOptionIndex(r.originalAnswer);
    const aiSuggestedAnswer = parseOptionIndex(r.aiSuggestedAnswer ?? r.correctAnswer);

    let verificationStatus: PypVerificationStatus = 'ANSWER_MISSING';
    let verifiedAnswer: number | null = null;
    let correctAnswer: number | null = originalAnswer;
    const issues: string[] = [];

    if (originalAnswer !== null && aiSuggestedAnswer !== null) {
      if (originalAnswer === aiSuggestedAnswer) {
        verificationStatus = 'VERIFIED';
        verifiedAnswer = originalAnswer;
        correctAnswer = originalAnswer;
      } else {
        verificationStatus = 'ANSWER_CONFLICT';
        verifiedAnswer = null;
        correctAnswer = originalAnswer;
        issues.push(
          `ANSWER_CONFLICT: Source key (${String.fromCharCode(65 + originalAnswer)}) differs from Gemini suggestion (${String.fromCharCode(65 + aiSuggestedAnswer)}).`
        );
      }
    } else if (originalAnswer !== null) {
      verificationStatus = 'ORIGINAL_KEY_ONLY';
      verifiedAnswer = originalAnswer;
      correctAnswer = originalAnswer;
    } else if (aiSuggestedAnswer !== null) {
      verificationStatus = 'NEEDS_REVIEW';
      verifiedAnswer = null;
      correctAnswer = aiSuggestedAnswer;
      issues.push('No official answer key in source text; Gemini suggested answer requires manual review.');
    } else {
      verificationStatus = 'ANSWER_MISSING';
      verifiedAnswer = null;
      correctAnswer = null;
      issues.push('ANSWER_MISSING: No answer detected.');
    }

    const hasFourOptions = Boolean(optionA && optionB && optionC && optionD);
    if (!questionText) issues.push('MISSING_QUESTION_TEXT');
    if (!hasFourOptions) issues.push('MISSING_OPTIONS');

    // Check for duplicate options within the same MCQ
    const normOpts = [optionA, optionB, optionC, optionD].map(normalizeForCompare).filter(Boolean);
    const hasDuplicateOptions = normOpts.length === 4 && new Set(normOpts).size < 4;
    if (hasDuplicateOptions) issues.push('DUPLICATE_OPTIONS');

    const { subject, uncertain } = normalizeCanonicalSubject(r.subject, context.meta.subject);
    if (uncertain) issues.push('Subject classification uncertain — review recommended.');

    // Duplicate question detection across the paper (flag, never silently delete)
    let isDuplicate = false;
    let duplicateOfNumber: number | null = null;
    if (context.duplicateDetectionEnabled && questionText.length > 10) {
      const sig = `${normalizeForCompare(questionText)}|${normalizeForCompare(optionA)}|${normalizeForCompare(optionB)}`;
      if (seenSignatures.has(sig)) {
        isDuplicate = true;
        duplicateOfNumber = seenSignatures.get(sig)!;
        issues.push(`DUPLICATE of Question #${duplicateOfNumber}`);
      } else {
        seenSignatures.set(sig, qNum);
      }
    }

    const mediumRaw = String(r.medium || context.meta.medium || 'English');
    const medium: 'Tamil' | 'English' | 'Bilingual' = /bilingual/i.test(mediumRaw)
      ? 'Bilingual'
      : /tamil/i.test(mediumRaw)
        ? 'Tamil'
        : 'English';

    const needsReview =
      issues.length > 0 ||
      verificationStatus === 'NEEDS_REVIEW' ||
      verificationStatus === 'ANSWER_CONFLICT' ||
      verificationStatus === 'ANSWER_MISSING';

    mcqs.push({
      clientId: `pyp_gem_${Date.now()}_${qNum}_${crypto.randomBytes(2).toString('hex')}`,
      sourceQuestionId: block.sourceQuestionId,
      questionNumber: qNum,
      originalQuestionNumber: String(r.originalQuestionNumber || block.originalNumber || qNum),
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      options: { A: optionA, B: optionB, C: optionC, D: optionD },
      originalAnswer,
      aiSuggestedAnswer,
      verifiedAnswer,
      correctAnswer,
      verificationStatus,
      verificationSource:
        originalAnswer !== null ? 'Official Source Text + Google Gemini AI' : 'Google Gemini AI (Preliminary)',
      explanation: String(r.explanation || '').normalize('NFC').trim(),
      subject,
      topic: String(r.topic || '').normalize('NFC').trim(),
      standard: r.standard ? String(r.standard).trim() : null,
      unit: r.unit ? String(r.unit).trim() : null,
      medium,
      examYear: context.meta.year,
      rawSourceText: block.rawText,
      isDuplicate,
      duplicateOfNumber,
      hasDuplicateOptions,
      hasFourOptions,
      isApproved: !needsReview && (verificationStatus === 'VERIFIED' || verificationStatus === 'ORIGINAL_KEY_ONLY'),
      needsReview,
      issues,
      aiProvider: 'gemini',
      aiModel: context.model,
    });
  }

  return { mcqs, missingSourceIds };
}

async function runTextJobBatches(params: {
  jobId: number;
  targetStatuses: string[];
  mockGeminiFn?: (blocks: SourceQuestionBlock[]) => Promise<GeminiBatchResult>;
}) {
  const { jobId } = params;
  if (activeJobIds.has(jobId)) return;
  activeJobIds.add(jobId);

  const startMs = Date.now();
  try {
    const job = await getGeminiTextJob(jobId);
    if (!job) return;

    const batchesToRun = job.batches.filter((b) => params.targetStatuses.includes(b.status));
    let accumulated: GeminiExtractedMcq[] = Array.isArray(job.extractedQuestions) ? [...job.extractedQuestions] : [];
    const existingBySourceId = new Map<string, GeminiExtractedMcq>();
    const seenSignatures = new Map<string, number>();
    for (const q of accumulated) {
      existingBySourceId.set(q.sourceQuestionId, q);
      if (q.questionText.length > 10) {
        const sig = `${normalizeForCompare(q.questionText)}|${normalizeForCompare(q.optionA)}|${normalizeForCompare(q.optionB)}`;
        seenSignatures.set(sig, q.questionNumber);
      }
    }

    const missingSet = new Set<string>(Array.isArray(job.missingSourceIds) ? job.missingSourceIds : []);
    let totalIn = job.inputTokens;
    let totalOut = job.outputTokens;
    let failedBatches = 0;
    let lastErr: string | null = null;
    let cancelled = false;

    await pool.query(
      `UPDATE previous_paper_ai_text_jobs
       SET status = 'processing', stage = 'mcq_conversion', control_signal = NULL, error_message = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [jobId]
    );

    for (const batch of batchesToRun) {
      const sigRes = await pool.query(`SELECT control_signal FROM previous_paper_ai_text_jobs WHERE id = $1`, [jobId]);
      if (sigRes.rows[0]?.control_signal === 'cancel') {
        cancelled = true;
        break;
      }

      await pool.query(
        `UPDATE previous_paper_ai_text_jobs SET current_batch = $2, stage = 'mcq_conversion', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [jobId, batch.batchNumber]
      );

      // Filter out any source blocks already processed to prevent duplicates on retry!
      const blocksToProcess = batch.sourceBlocks.filter((b) => !existingBySourceId.has(b.sourceQuestionId));
      if (blocksToProcess.length === 0) {
        await pool.query(
          `UPDATE previous_paper_ai_text_batches SET status = 'completed', error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE job_id = $1 AND batch_number = $2`,
          [jobId, batch.batchNumber]
        );
        continue;
      }

      try {
        const result = params.mockGeminiFn
          ? await params.mockGeminiFn(blocksToProcess)
          : await callGeminiForTextBatch(blocksToProcess, job.examMeta, job.settings, job.model);

        if (result.inputTokens !== null) totalIn = (totalIn || 0) + result.inputTokens;
        if (result.outputTokens !== null) totalOut = (totalOut || 0) + result.outputTokens;

        const effectiveModel = result.modelUsed || job.model;
        const { mcqs, missingSourceIds } = normalizeAndVerifyGeminiMcqs(result.questions, blocksToProcess, {
          meta: job.examMeta,
          model: effectiveModel,
          duplicateDetectionEnabled: Boolean(job.settings?.duplicateDetectionEnabled),
          existingSignatures: seenSignatures,
          startNumber: accumulated.length + 1,
        });

        for (const q of mcqs) {
          existingBySourceId.set(q.sourceQuestionId, q);
          missingSet.delete(q.sourceQuestionId);
        }
        for (const mid of missingSourceIds) missingSet.add(mid);

        // Preserve exact original source order
        accumulated = Array.from(existingBySourceId.values())
          .sort((a, b) => {
            const na = parseInt(a.sourceQuestionId.replace(/\D/g, ''), 10) || a.questionNumber;
            const nb = parseInt(b.sourceQuestionId.replace(/\D/g, ''), 10) || b.questionNumber;
            return na - nb;
          })
          .map((q, idx) => ({ ...q, questionNumber: idx + 1 }));

        const batchStatus = missingSourceIds.length > 0 ? 'failed' : 'completed';
        const batchMissingErr =
          missingSourceIds.length > 0
            ? `Incomplete batch extraction: missing ${missingSourceIds.length} source question(s): ${missingSourceIds.join(', ')}`
            : null;
        if (batchStatus === 'failed') {
          failedBatches += 1;
          lastErr = batchMissingErr;
        }

        await pool.query(
          `UPDATE previous_paper_ai_text_batches
           SET status = $3,
               extracted_count = $4,
               attempt_count = COALESCE(attempt_count, 0) + $5,
               model_used = $6,
               gemini_status = $7,
               error_message = $8,
               updated_at = CURRENT_TIMESTAMP
           WHERE job_id = $1 AND batch_number = $2`,
          [
            jobId,
            batch.batchNumber,
            batchStatus,
            mcqs.length,
            result.attempts || 1,
            effectiveModel,
            result.geminiStatus || '200_OK',
            batchMissingErr,
          ]
        );

        // Gentle pacing delay between live Gemini batches to avoid burst rate limits
        if (!params.mockGeminiFn && batchesToRun.length > 1) {
          await sleep(250);
        }
      } catch (batchErr: any) {
        failedBatches += 1;
        lastErr = batchErr?.message || `Gemini batch #${batch.batchNumber} failed.`;
        const geminiStatus = String(batchErr?.geminiStatus || `${batchErr?.statusCode || 500}_ERROR`).slice(0, 64);
        console.error(`[Gemini Text Job #${jobId} Batch #${batch.batchNumber} Error]:`, batchErr);
        for (const b of blocksToProcess) missingSet.add(b.sourceQuestionId);
        await pool.query(
          `UPDATE previous_paper_ai_text_batches
           SET status = 'failed',
               attempt_count = COALESCE(attempt_count, 0) + 1,
               gemini_status = $4,
               error_message = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE job_id = $1 AND batch_number = $2`,
          [jobId, batch.batchNumber, lastErr, geminiStatus]
        );
      }

      // Persist incremental batch progress
      const convertedMcqCount = accumulated.filter((q) => q.hasFourOptions && !q.hasDuplicateOptions).length;
      const verifiedCount = accumulated.filter((q) => q.verificationStatus === 'VERIFIED' || q.verificationStatus === 'ORIGINAL_KEY_ONLY').length;
      const needsReviewCount = accumulated.filter((q) => q.needsReview).length;
      const duplicateCount = accumulated.filter((q) => q.isDuplicate).length;
      const missingArr = Array.from(missingSet);

      await pool.query(
        `UPDATE previous_paper_ai_text_jobs
         SET stage = 'verification',
             extracted_count = $2,
             converted_mcq_count = $3,
             verified_count = $4,
             needs_review_count = $5,
             duplicate_count = $6,
             missing_count = $7,
             failed_batches = $8,
             input_tokens = $9,
             output_tokens = $10,
             estimated_cost_usd = $11,
             duration_ms = $12,
             error_message = $13,
             extracted_questions = $14::jsonb,
             missing_source_ids = $15::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [
          jobId,
          accumulated.length,
          convertedMcqCount,
          verifiedCount,
          needsReviewCount,
          duplicateCount,
          missingArr.length,
          failedBatches,
          totalIn,
          totalOut,
          estimateGeminiCostUsd(job.model, totalIn, totalOut),
          (job.durationMs || 0) + (Date.now() - startMs),
          lastErr,
          JSON.stringify(accumulated),
          JSON.stringify(missingArr),
        ]
      );
    }

    const batchStateRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_cnt,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_cnt
       FROM previous_paper_ai_text_batches
       WHERE job_id = $1`,
      [jobId]
    );
    const totalFailedBatches = Number(batchStateRes.rows[0]?.failed_cnt || 0);
    const totalPendingBatches = Number(batchStateRes.rows[0]?.pending_cnt || 0);
    const missingFinal = Array.from(missingSet).length;
    const unaccounted = Math.max(0, job.identifiedQuestions - accumulated.length);

    const finalStatus = cancelled
      ? 'cancelled'
      : accumulated.length === 0 && totalFailedBatches > 0
        ? 'failed'
        : totalFailedBatches > 0 || totalPendingBatches > 0 || missingFinal > 0 || unaccounted > 0
          ? 'partial'
          : 'completed';

    await pool.query(
      `UPDATE previous_paper_ai_text_jobs
       SET status = $2::varchar,
           stage = CASE WHEN $2::text = 'completed' THEN 'ready_for_review' ELSE stage END,
           failed_batches = $3,
           error_message = CASE WHEN $2::text = 'completed' THEN NULL ELSE COALESCE($4, error_message) END,
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [jobId, finalStatus, totalFailedBatches, lastErr]
    );
  } finally {
    activeJobIds.delete(jobId);
  }
}

export async function processSourceTextWithGemini(params: {
  sourceText?: string;
  inputMethod?: 'text' | 'json';
  jsonContent?: string;
  jsonFilename?: string | null;
  meta: PypGeminiExamMetadata;
  settings: PypGeminiTextSettings;
  adminUsername: string;
  asyncMode?: boolean;
  mockGeminiFn?: (blocks: SourceQuestionBlock[]) => Promise<GeminiBatchResult>;
}) {
  await ensurePreviousPaperAiSchema();

  const method = params.inputMethod === 'json' ? 'json' : 'text';
  let cleanText = '';
  let sourceBlocks: SourceQuestionBlock[] = [];

  if (method === 'json') {
    const jsonReport = validateAndNormalizeJsonSource(params.jsonContent || params.sourceText || '', {
      filename: params.jsonFilename || null,
      expectedQuestions: params.settings.expectedQuestions || 200,
    });
    if (!jsonReport.valid) {
      const err: any = new Error(jsonReport.errors.join(' ') || 'Invalid JSON file.');
      err.statusCode = 400;
      throw err;
    }
    cleanText = (params.jsonContent || params.sourceText || '').normalize('NFC').trim();
    sourceBlocks = jsonReport.sourceBlocks;
  } else {
    const rawText = params.sourceText || '';
    const validation = validateSourceTextInput(rawText, params.settings.expectedQuestions || 200);
    if (!validation.valid) {
      const err: any = new Error(validation.errors.join(' '));
      err.statusCode = 400;
      throw err;
    }
    cleanText = rawText.normalize('NFC').trim();
    sourceBlocks = splitSourceTextIntoQuestionBlocks(cleanText);
  }

  const sourceHash = computeBufferSha256(Buffer.from(`${method}:${cleanText}`, 'utf8'));
  if (activeSourceHashes.has(sourceHash)) {
    const err: any = new Error('This exact source input is already being processed by Google Gemini AI.');
    err.statusCode = 409;
    throw err;
  }

  const resolvedModel = resolveGeminiModel(params.settings.model || getGeminiModel());
  const batchSize = Math.max(5, Math.min(25, Number(params.settings.batchSize) || 15));
  const totalBatches = Math.max(1, Math.ceil(sourceBlocks.length / batchSize));

  const jobIns = await pool.query(
    `INSERT INTO previous_paper_ai_text_jobs (
       admin_id, provider, model, source_hash, source_char_count, source_text,
       exam_meta, settings, status, stage, expected_questions, identified_questions, total_batches
     ) VALUES ($1, 'gemini', $2, $3, $4, $5, $6::jsonb, $7::jsonb, 'processing', 'questions_identified', $8, $9, $10)
     RETURNING id`,
    [
      params.adminUsername,
      resolvedModel,
      sourceHash,
      cleanText.length,
      cleanText,
      JSON.stringify({ ...params.meta, inputMethod: method, jsonFilename: params.jsonFilename || null }),
      JSON.stringify({ ...params.settings, batchSize }),
      params.settings.expectedQuestions || sourceBlocks.length || 200,
      sourceBlocks.length,
      totalBatches,
    ]
  );
  const jobId = Number(jobIns.rows[0].id);

  for (let i = 0; i < sourceBlocks.length; i += batchSize) {
    const batchBlocks = sourceBlocks.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    await pool.query(
      `INSERT INTO previous_paper_ai_text_batches (job_id, batch_number, status, source_blocks, question_count)
       VALUES ($1, $2, 'pending', $3::jsonb, $4)`,
      [jobId, batchNumber, JSON.stringify(batchBlocks), batchBlocks.length]
    );
  }

  const runWork = async () => {
    activeSourceHashes.add(sourceHash);
    try {
      await runTextJobBatches({
        jobId,
        targetStatuses: ['pending'],
        mockGeminiFn: params.mockGeminiFn,
      });
    } finally {
      activeSourceHashes.delete(sourceHash);
    }
  };

  if (params.asyncMode) {
    void runWork().catch((err) => console.error(`[Gemini Text Job #${jobId} Error]:`, err));
    return getGeminiTextJob(jobId);
  }

  await runWork();
  return getGeminiTextJob(jobId);
}

export async function retryFailedBatchesForTextJob(
  jobId: number,
  options: { asyncMode?: boolean; mockGeminiFn?: (blocks: SourceQuestionBlock[]) => Promise<GeminiBatchResult> } = {}
) {
  await ensurePreviousPaperAiSchema();
  const job = await getGeminiTextJob(jobId);
  if (!job) {
    const err: any = new Error('Gemini processing job not found.');
    err.statusCode = 404;
    throw err;
  }
  const hasFailed = job.batches.some((b) => b.status === 'failed' || b.status === 'pending');
  if (!hasFailed) {
    const err: any = new Error('No failed or pending batches remain on this job.');
    err.statusCode = 400;
    throw err;
  }

  await pool.query(
    `UPDATE previous_paper_ai_text_jobs SET retry_count = COALESCE(retry_count, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [jobId]
  );

  const runRetry = () =>
    runTextJobBatches({
      jobId,
      targetStatuses: ['failed', 'pending'],
      mockGeminiFn: options.mockGeminiFn,
    });

  if (options.asyncMode) {
    void runRetry().catch((err) => console.error(`[Gemini Text Retry #${jobId} Error]:`, err));
    return getGeminiTextJob(jobId);
  }

  await runRetry();
  return getGeminiTextJob(jobId);
}

export async function cancelGeminiTextJob(jobId: number) {
  await ensurePreviousPaperAiSchema();
  await pool.query(
    `UPDATE previous_paper_ai_text_jobs
     SET control_signal = 'cancel', status = 'cancelled', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [jobId]
  );
  return getGeminiTextJob(jobId);
}

export async function getGeminiTextJob(jobId: number) {
  await ensurePreviousPaperAiSchema();
  const [jobRes, batchRes] = await Promise.all([
    pool.query(`SELECT * FROM previous_paper_ai_text_jobs WHERE id = $1 LIMIT 1`, [jobId]),
    pool.query(
      `SELECT id, batch_number, status, source_blocks, question_count, extracted_count, attempt_count, model_used, gemini_status, error_message
       FROM previous_paper_ai_text_batches
       WHERE job_id = $1
       ORDER BY batch_number ASC`,
      [jobId]
    ),
  ]);
  if (jobRes.rows.length === 0) return null;
  const r = jobRes.rows[0];
  return {
    id: Number(r.id),
    paperId: r.paper_id != null ? Number(r.paper_id) : null,
    adminId: String(r.admin_id),
    provider: 'gemini' as const,
    model: String(r.model),
    sourceHash: String(r.source_hash),
    sourceCharCount: Number(r.source_char_count || 0),
    examMeta: (r.exam_meta || {}) as PypGeminiExamMetadata,
    settings: (r.settings || {}) as PypGeminiTextSettings,
    status: String(r.status),
    stage: String(r.stage || 'source_received'),
    expectedQuestions: Number(r.expected_questions || 200),
    identifiedQuestions: Number(r.identified_questions || 0),
    extractedCount: Number(r.extracted_count || 0),
    convertedMcqCount: Number(r.converted_mcq_count || 0),
    verifiedCount: Number(r.verified_count || 0),
    needsReviewCount: Number(r.needs_review_count || 0),
    duplicateCount: Number(r.duplicate_count || 0),
    missingCount: Number(r.missing_count || 0),
    currentBatch: Number(r.current_batch || 0),
    totalBatches: Number(r.total_batches || 0),
    inputTokens: r.input_tokens != null ? Number(r.input_tokens) : null,
    outputTokens: r.output_tokens != null ? Number(r.output_tokens) : null,
    estimatedCostUsd: r.estimated_cost_usd != null ? Number(r.estimated_cost_usd) : null,
    durationMs: Number(r.duration_ms || 0),
    failedBatches: Number(r.failed_batches || 0),
    retryCount: Number(r.retry_count || 0),
    errorMessage: r.error_message || null,
    extractedQuestions: (Array.isArray(r.extracted_questions) ? r.extracted_questions : []) as GeminiExtractedMcq[],
    missingSourceIds: (Array.isArray(r.missing_source_ids) ? r.missing_source_ids : []) as string[],
    batches: batchRes.rows.map((b: any) => {
      const blocks = (Array.isArray(b.source_blocks) ? b.source_blocks : []) as SourceQuestionBlock[];
      return {
        id: Number(b.id),
        jobId: Number(r.id),
        batchNumber: Number(b.batch_number),
        status: String(b.status),
        sourceBlocks: blocks,
        sourceQuestionIds: blocks.map((blk) => blk.sourceQuestionId),
        questionCount: Number(b.question_count || 0),
        extractedCount: Number(b.extracted_count || 0),
        attemptCount: Number(b.attempt_count || 0),
        modelUsed: b.model_used || null,
        geminiStatus: b.gemini_status || null,
        errorMessage: b.error_message || null,
      };
    }),
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
}
