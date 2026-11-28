import crypto from 'crypto';
import pool from '../db';
import { AIProviderFactory } from './ai/ai-provider.factory';
import { IAIProvider } from './ai/ai-provider.interface';

/**
 * High-performance English -> Tamil display translation engine for TNPSC MCQs.
 * - Original `questions` table remains the single canonical question bank.
 * - Two-tier caching: bounded in-memory LRU cache (<5ms) + PostgreSQL persistent cache.
 * - Multi-provider automatic failover (active provider -> remaining configured providers)
 *   with smart cooldowns for insufficient credits / auth / rate-limit errors.
 * - Parallel batching with controlled concurrency, exponential backoff, split-batch
 *   partial recovery, and strict in-flight request deduplication.
 */

const SOURCE_LANGUAGE = 'en';
const TARGET_LANGUAGE = 'ta';
const TRANSLATION_VERSION = 1;

// Tuned for fast Gemini/Claude JSON output without hitting 45s circuit-breaker timeouts.
const AI_BATCH_SIZE = Number(process.env.TRANSLATION_BATCH_SIZE) || 8;
const AI_SPLIT_BATCH_SIZE = 2;
const AI_CONCURRENCY = Math.min(Math.max(Number(process.env.TRANSLATION_CONCURRENCY) || 4, 1), 6);
const AI_REQUEST_TIMEOUT_MS = Number(process.env.TRANSLATION_TIMEOUT_MS) || 35000;
const MEMORY_CACHE_MAX_ENTRIES = 10000;
const FAST_ID_CACHE_TTL_MS = 10 * 60 * 1000;
export const MAX_TRANSLATION_IDS = 1000;
const MAX_RETRY_ATTEMPTS = 3;

const TAMIL_CHAR_REGEX = /[\u0B80-\u0BFF]/;
// Common SI units, physics/chemistry symbols, and abbreviations that MUST stay in Latin script in Tamil textbooks
const SCIENTIFIC_UNIT_TOKEN_REGEX =
  /\b(?:mm|cm|dm|km|nm|pm|um|mg|kg|kgs|ml|mL|cc|ms|ns|us|Hz|kHz|MHz|GHz|Pa|kPa|MPa|mol|cd|rad|sr|dB|kW|MW|GW|kJ|MJ|mA|kV|mV|eV|keV|MeV|atm|bar|cal|kcal|mph|rpm|amu|pH|SI|DNA|RNA|ATP|ADP|GDP|GNP|RBI|ISRO|NASA|DRDO|TNPSC|VAO|UNESCO|UNICEF|WHO|WTO|IMF|UN|USA|UK|USSR|CO2|H2O|O2|N2|H2|NaCl|HCl|H2SO4|HNO3|NaOH|CaCO3|NH3|CH4)\b\.?/gi;
// Matches regular English prose words (3+ letters, excluding scientific/SI unit symbols)
const ENGLISH_PROSE_WORD_REGEX = /\b[A-Za-z]{3,}\b/;
const NUMBER_TOKEN_REGEX = /\d+(?:,\d{3})*(?:\.\d+)?/g;

// Live Cache & Queue Telemetry for Admin Translation Control Center
const telemetry = {
  totalLookups: 0,
  memoryHits: 0,
  dbHits: 0,
  misses: 0,
};

let translationSchemaEnsuredPromise: Promise<void> | null = null;

export async function ensureTranslationSchema(): Promise<void> {
  if (!translationSchemaEnsuredPromise) {
    translationSchemaEnsuredPromise = (async () => {
      await pool.query(`
        ALTER TABLE mcq_question_translations
          ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS last_error TEXT NULL,
          ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) NOT NULL DEFAULT 'verified',
          ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ NULL;

        CREATE INDEX IF NOT EXISTS idx_mcq_trans_status_lang
          ON mcq_question_translations(translation_language, translation_status);
        CREATE INDEX IF NOT EXISTS idx_mcq_trans_retry
          ON mcq_question_translations(translation_status, retry_count);
      `);
    })().catch((err) => {
      translationSchemaEnsuredPromise = null;
      throw err;
    });
  }
  await translationSchemaEnsuredPromise;
}

interface SourceQuestionRow {
  id: number;
  subject: string | null;
  lesson_title: string | null;
  question_text: string;
  options: unknown;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  explanation: string | null;
}

interface SourceQuestion {
  id: number;
  subject: string;
  lessonTitle: string;
  question: string;
  options: string[];
  explanation: string;
  contentHash: string;
}

interface RawTranslation {
  id: number;
  question: string;
  options: string[];
  explanation: string;
}

export interface McqTranslationPayload {
  questionId: number;
  question: string;
  options: string[];
  explanation: string;
  cached: boolean;
}

export interface McqTranslationFailure {
  questionId: number;
  message: string;
}

export interface McqTranslationResult {
  translations: McqTranslationPayload[];
  missingIds: number[];
  failures: McqTranslationFailure[];
  stats: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    cacheHits: number;
    memoryCacheHits: number;
    dbCacheHits: number;
    newlyTranslated: number;
    providerUsed: string | null;
    durationMs: number;
  };
}

// ── Bounded In-Memory LRU Cache ────────────────────────────────────────────────
const memoryCache = new Map<string, McqTranslationPayload>();
const fastIdCache = new Map<number, { payload: McqTranslationPayload; expiresAt: number }>();

function makeMemoryCacheKey(questionId: number, contentHash: string): string {
  return `${questionId}:${contentHash}:${SOURCE_LANGUAGE}:${TARGET_LANGUAGE}:v${TRANSLATION_VERSION}`;
}

function getFromFastIdCache(questionId: number): McqTranslationPayload | null {
  const entry = fastIdCache.get(questionId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    fastIdCache.delete(questionId);
    return null;
  }
  return { ...entry.payload, cached: true };
}

function getFromMemoryCache(questionId: number, contentHash: string): McqTranslationPayload | null {
  const key = makeMemoryCacheKey(questionId, contentHash);
  const hit = memoryCache.get(key);
  if (!hit) return null;
  // Refresh LRU order
  memoryCache.delete(key);
  memoryCache.set(key, hit);
  return { ...hit, cached: true };
}

function setInMemoryCache(questionId: number, contentHash: string, payload: McqTranslationPayload): void {
  const key = makeMemoryCacheKey(questionId, contentHash);
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
  } else if (memoryCache.size >= MEMORY_CACHE_MAX_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey !== undefined) memoryCache.delete(oldestKey);
  }
  const cachedPayload = { ...payload, cached: true };
  memoryCache.set(key, cachedPayload);
  fastIdCache.set(questionId, { payload: cachedPayload, expiresAt: Date.now() + FAST_ID_CACHE_TTL_MS });
  if (fastIdCache.size > MEMORY_CACHE_MAX_ENTRIES) {
    const oldestId = fastIdCache.keys().next().value;
    if (oldestId !== undefined) fastIdCache.delete(oldestId);
  }
}

// ── Provider Cooldown & Failover Management ────────────────────────────────────
const providerCooldownUntil = new Map<string, { until: number; reason: string }>();

function isProviderInCooldown(name: string): boolean {
  const entry = providerCooldownUntil.get(name);
  if (!entry) return false;
  if (Date.now() >= entry.until) {
    providerCooldownUntil.delete(name);
    return false;
  }
  return true;
}

function markProviderCooldown(name: string, durationMs: number, reason: string): void {
  providerCooldownUntil.set(name, { until: Date.now() + durationMs, reason });
}

function isRateLimitError(err: any): boolean {
  const message = String(err?.message || '').toLowerCase();
  return (
    message.includes('rate limit') ||
    message.includes('rate-limit') ||
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('resource_exhausted') ||
    message.includes('too many requests')
  );
}

function isFatalProviderAccountError(err: any): boolean {
  const message = String(err?.message || '').toLowerCase();
  return (
    message.includes('insufficient_credits') ||
    message.includes('credit balance') ||
    message.includes('insufficient credits') ||
    message.includes('unpaid invoice') ||
    message.includes('billing') ||
    message.includes('invalid_api_key') ||
    message.includes('invalid x-api-key') ||
    message.includes('authentication') ||
    message.includes('unauthorized') ||
    message.includes('401') ||
    message.includes('403')
  );
}

/**
 * Returns all configured AI providers ordered by preference:
 * 1. Active provider (if not in cooldown)
 * 2. Other configured providers not in cooldown (preferring fast Gemini Flash)
 * 3. Any remaining configured providers as last resort
 */
async function getOrderedConfiguredProviders(): Promise<IAIProvider[]> {
  const seen = new Set<string>();
  const healthy: IAIProvider[] = [];
  const cooling: IAIProvider[] = [];

  const addIfConfigured = (provider: IAIProvider | null) => {
    if (!provider || seen.has(provider.name) || !provider.isConfigured()) return;
    seen.add(provider.name);
    if (isProviderInCooldown(provider.name)) {
      cooling.push(provider);
    } else {
      healthy.push(provider);
    }
  };

  try {
    const active = await AIProviderFactory.getActiveProvider();
    addIfConfigured(active);
  } catch {
    // Proceed to fallback scan
  }

  for (const name of ['gemini', 'claude', 'openai'] as const) {
    try {
      addIfConfigured(AIProviderFactory.getProvider(name));
    } catch {
      // Ignore unavailable provider
    }
  }

  return [...healthy, ...cooling];
}

// ── Source Parsing & Validation ────────────────────────────────────────────────
function parseOptions(row: SourceQuestionRow): string[] {
  let parsed: unknown = row.options;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  if (Array.isArray(parsed) && parsed.length === 4) {
    return parsed.map((opt) => String(opt ?? '').trim());
  }
  return [row.option_a, row.option_b, row.option_c, row.option_d].map((opt) => String(opt ?? '').trim());
}

function hashSourceContent(question: string, options: string[], explanation: string): string {
  return crypto.createHash('sha256').update(JSON.stringify({ question, options, explanation })).digest('hex');
}

function toSourceQuestion(row: SourceQuestionRow): SourceQuestion | null {
  const options = parseOptions(row);
  if (!row.question_text?.trim() || options.length !== 4 || options.some((opt) => !opt)) {
    return null;
  }
  const question = row.question_text.trim();
  const explanation = String(row.explanation ?? '').trim();
  return {
    id: row.id,
    subject: row.subject || '',
    lessonTitle: row.lesson_title || '',
    question,
    options,
    explanation,
    contentHash: hashSourceContent(question, options, explanation),
  };
}

function hasTamil(text: string): boolean {
  return TAMIL_CHAR_REGEX.test(text);
}

function normalizeNumberToken(token: string): string {
  const cleaned = token.replace(/,/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? String(parsed) : cleaned;
}

function missingNumberTokens(source: string, translated: string): string[] {
  const sourceTokens = (source.match(NUMBER_TOKEN_REGEX) || []).map(normalizeNumberToken);
  const translatedTokens = new Set((translated.match(NUMBER_TOKEN_REGEX) || []).map(normalizeNumberToken));
  return Array.from(new Set(sourceTokens)).filter((token) => !translatedTokens.has(token));
}

function hasNonUnitEnglishProse(text: string): boolean {
  const stripped = String(text || '').replace(SCIENTIFIC_UNIT_TOKEN_REGEX, ' ');
  return ENGLISH_PROSE_WORD_REGEX.test(stripped);
}

/**
 * Validates a Tamil translation:
 * - Preserves question ID and exact 4-option A-D structure.
 * - Ensures Tamil script is present whenever source contains regular English prose words
 *   (ignoring pure SI unit / formula / numeric options like "10 cm³", "kg/m³", "50 kg", "2.0 g/cm³").
 * - Detects empty, truncated, or duplicate-all-options output.
 * - Preserves all numeric values (normalizing comma separators and trailing decimals).
 */
function validateTranslation(source: SourceQuestion, raw: RawTranslation): string | null {
  if (Number(raw?.id) !== source.id) return 'Translation ID mismatch.';
  const question = String(raw?.question ?? '').trim();
  if (!question) return 'Translated question is empty.';
  if (hasNonUnitEnglishProse(source.question) && !hasTamil(question)) {
    return 'Translated question is not in Tamil.';
  }
  if (source.question.length >= 40 && question.length < Math.floor(source.question.length * 0.2)) {
    return 'Translated question appears truncated.';
  }
  if (missingNumberTokens(source.question, question).length > 0) {
    return 'Translated question does not preserve numeric values.';
  }

  if (!Array.isArray(raw.options) || raw.options.length !== 4) {
    return 'Translated options must contain exactly four items.';
  }
  const options = raw.options.map((opt) => String(opt ?? '').trim());
  if (options.some((opt) => !opt)) return 'One or more translated options are empty.';

  // Reject degenerate all-identical options when source options were distinct
  if (new Set(source.options).size > 1 && new Set(options).size === 1) {
    return 'Translated options are duplicated.';
  }

  const sourceOptionsHaveProseEnglish = source.options.some((opt) => hasNonUnitEnglishProse(opt));
  if (sourceOptionsHaveProseEnglish && !options.some((opt) => hasTamil(opt))) {
    return 'Translated options are not in Tamil.';
  }
  for (let i = 0; i < 4; i++) {
    if (missingNumberTokens(source.options[i], options[i]).length > 0) {
      return `Translated option ${String.fromCharCode(65 + i)} does not preserve numeric values.`;
    }
  }

  const explanation = String(raw.explanation ?? '').trim();
  if (source.explanation && !explanation) return 'Translated explanation is empty.';
  if (source.explanation && hasNonUnitEnglishProse(source.explanation) && explanation && !hasTamil(explanation)) {
    return 'Translated explanation is not in Tamil.';
  }
  return null;
}

function toRawTranslation(
  row: {
    translated_question: string;
    translated_option_a: string;
    translated_option_b: string;
    translated_option_c: string;
    translated_option_d: string;
    translated_explanation: string;
  },
  id: number
): RawTranslation {
  return {
    id,
    question: row.translated_question,
    options: [
      row.translated_option_a,
      row.translated_option_b,
      row.translated_option_c,
      row.translated_option_d,
    ],
    explanation: row.translated_explanation,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── AI Provider Batch Execution ────────────────────────────────────────────────
interface BatchOutcome {
  translations: Map<number, RawTranslation>;
  failed: Map<number, string>;
  rateLimited: boolean;
  fatalAccountError: boolean;
  providerName: string;
  modelName: string | null;
}

async function callSingleProvider(provider: IAIProvider, sources: SourceQuestion[]): Promise<BatchOutcome> {
  const translations = new Map<number, RawTranslation>();
  const failed = new Map<number, string>();
  const modelName = (provider as any).model || null;

  if (sources.length === 0) {
    return {
      translations,
      failed,
      rateLimited: false,
      fatalAccountError: false,
      providerName: provider.name,
      modelName,
    };
  }

  const input = sources.map((source) => ({
    id: source.id,
    subject: source.subject,
    lesson: source.lessonTitle,
    question: source.question,
    options: source.options,
    explanation: source.explanation,
  }));

  const prompt = `Translate these TNPSC multiple-choice questions from English into formal academic Tamil (Samacheer Kalvi / TNPSC exam standard).

STRICT RULES:
1. Return ONLY a valid JSON object with a "translations" array.
2. Keep each item's exact numeric "id" and original order.
3. Return exactly 4 "options" per question in the EXACT A, B, C, D order. Never reorder, omit, or merge options.
4. Translate the question, all 4 options, and the explanation into clear, formal textbook Tamil (not conversational Tamil). Preserve explanation structure and line breaks.
5. Preserve every number, date, year, percentage, SI unit, formula, chemical symbol, article number, and mathematical expression accurately (e.g. 9.8 m/s², H₂O, Article 21, 1947).
6. Keep standard scientific abbreviations (SI, DNA, RNA, ATP, pH, CO₂) in standard textbook form.
7. Never add commentary, markdown fences, or extra keys.

Input JSON:
${JSON.stringify({ questions: input })}

Expected JSON format:
{"translations":[{"id":123,"question":"தமிழ் கேள்வி","options":["விருப்பம் 1","விருப்பம் 2","விருப்பம் 3","விருப்பம் 4"],"explanation":"தமிழ் விளக்கம்"}]}`;

  try {
    const aiResult = await provider.generateJson<{ translations?: RawTranslation[] }>(prompt, {
      systemPrompt:
        'You are an expert bilingual TNPSC Tamil textbook translator. Output strict valid JSON only with zero markdown.',
      temperature: 0.15,
      maxTokens: 6500,
      responseFormat: 'json',
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
      retryCount: 1,
    });

    const returned = Array.isArray(aiResult?.translations) ? aiResult.translations : [];
    const byId = new Map<number, RawTranslation>();
    for (const item of returned) {
      const id = Number(item?.id);
      if (Number.isInteger(id)) byId.set(id, item);
    }

    for (const source of sources) {
      const raw = byId.get(source.id);
      if (!raw) {
        failed.set(source.id, 'Translation was not returned by the AI provider.');
        continue;
      }
      const reason = validateTranslation(source, raw);
      if (reason) {
        failed.set(source.id, reason);
        continue;
      }
      translations.set(source.id, {
        id: source.id,
        question: String(raw.question).trim(),
        options: raw.options.map((opt) => String(opt).trim()),
        explanation: String(raw.explanation ?? '').trim(),
      });
    }

    return {
      translations,
      failed,
      rateLimited: false,
      fatalAccountError: false,
      providerName: provider.name,
      modelName,
    };
  } catch (err: any) {
    const rateLimited = isRateLimitError(err);
    const fatalAccountError = isFatalProviderAccountError(err);

    if (fatalAccountError) {
      markProviderCooldown(provider.name, 5 * 60 * 1000, err?.message || 'Account/Auth error');
    } else if (rateLimited) {
      markProviderCooldown(provider.name, 30 * 1000, 'Rate limited');
    }

    const message = fatalAccountError
      ? `Provider ${provider.name} unavailable (account/billing).`
      : rateLimited
      ? 'Translation service is rate limited. Retrying...'
      : 'Translation service is temporarily unavailable.';

    console.warn(`[McqTranslation] Provider "${provider.name}" batch failed:`, {
      count: sources.length,
      rateLimited,
      fatalAccountError,
      error: err?.message || String(err),
    });

    for (const source of sources) failed.set(source.id, message);
    return {
      translations,
      failed,
      rateLimited,
      fatalAccountError,
      providerName: provider.name,
      modelName,
    };
  }
}

/**
 * Translates a batch with automatic multi-provider failover, exponential backoff,
 * and split-batch partial recovery so one tricky question never fails an entire batch.
 */
async function translateBatchWithRecovery(
  providers: IAIProvider[],
  batch: SourceQuestion[]
): Promise<{
  translations: Map<number, RawTranslation>;
  failed: Map<number, string>;
  providerName: string;
  modelName: string | null;
}> {
  const combinedTranslations = new Map<number, RawTranslation>();
  const combinedFailed = new Map<number, string>();
  let remaining = [...batch];
  let lastProviderName: string = providers[0]?.name || 'unknown';
  let lastModelName: string | null = (providers[0] as any)?.model || null;

  // Step 1: Try healthy providers in priority order with failover
  for (const provider of providers) {
    if (remaining.length === 0) break;
    if (isProviderInCooldown(provider.name) && providers.some((p) => !isProviderInCooldown(p.name))) {
      continue;
    }

    let outcome = await callSingleProvider(provider, remaining);
    lastProviderName = outcome.providerName;
    lastModelName = outcome.modelName;

    // Backoff once on rate limit if no other healthy provider exists
    if (outcome.rateLimited && !providers.some((p) => p.name !== provider.name && !isProviderInCooldown(p.name))) {
      await delay(1500);
      outcome = await callSingleProvider(provider, remaining);
    }

    for (const [id, raw] of outcome.translations) {
      combinedTranslations.set(id, raw);
      combinedFailed.delete(id);
    }

    remaining = remaining.filter((source) => !combinedTranslations.has(source.id));

    if (outcome.fatalAccountError || outcome.rateLimited) {
      // Immediately fail over to the next configured provider
      for (const source of remaining) {
        combinedFailed.set(source.id, outcome.failed.get(source.id) || 'Provider unavailable.');
      }
      continue;
    }

    // Step 2: Split-batch partial recovery for any items missed or failed validation
    if (remaining.length > 0) {
      await delay(400);
      for (let i = 0; i < remaining.length; i += AI_SPLIT_BATCH_SIZE) {
        const subBatch = remaining.slice(i, i + AI_SPLIT_BATCH_SIZE);
        const retryOutcome = await callSingleProvider(provider, subBatch);
        for (const [id, raw] of retryOutcome.translations) {
          combinedTranslations.set(id, raw);
          combinedFailed.delete(id);
        }
        for (const source of subBatch) {
          if (!combinedTranslations.has(source.id)) {
            combinedFailed.set(
              source.id,
              retryOutcome.failed.get(source.id) || outcome.failed.get(source.id) || 'Translation validation failed.'
            );
          }
        }
        if (retryOutcome.fatalAccountError || retryOutcome.rateLimited) break;
      }
      remaining = remaining.filter((source) => !combinedTranslations.has(source.id));
    }

    if (remaining.length === 0) break;
  }

  return {
    translations: combinedTranslations,
    failed: combinedFailed,
    providerName: lastProviderName,
    modelName: lastModelName,
  };
}

// ── In-Flight Request Deduplication ────────────────────────────────────────────
const inFlightById = new Map<number, Promise<McqTranslationPayload | null>>();

// ── PostgreSQL Bulk Upsert ─────────────────────────────────────────────────────
async function saveTranslations(
  providerName: string,
  modelName: string | null,
  sources: Map<number, SourceQuestion>,
  translations: Map<number, RawTranslation>
): Promise<void> {
  const entries = Array.from(translations.entries()).filter(([id]) => sources.has(id));
  if (entries.length === 0) return;

  const qIds: number[] = [];
  const srcLangs: string[] = [];
  const langs: string[] = [];
  const qTexts: string[] = [];
  const optAs: string[] = [];
  const optBs: string[] = [];
  const optCs: string[] = [];
  const optDs: string[] = [];
  const expls: string[] = [];
  const hashes: string[] = [];
  const providers: string[] = [];
  const models: (string | null)[] = [];
  const versions: number[] = [];

  for (const [id, translation] of entries) {
    const source = sources.get(id)!;
    qIds.push(id);
    srcLangs.push(SOURCE_LANGUAGE);
    langs.push(TARGET_LANGUAGE);
    qTexts.push(translation.question);
    optAs.push(translation.options[0]);
    optBs.push(translation.options[1]);
    optCs.push(translation.options[2]);
    optDs.push(translation.options[3]);
    expls.push(translation.explanation);
    hashes.push(source.contentHash);
    providers.push(providerName);
    models.push(modelName);
    versions.push(TRANSLATION_VERSION);

    // Populate in-memory LRU cache immediately so concurrent/next requests hit RAM (<5ms)
    setInMemoryCache(id, source.contentHash, {
      questionId: id,
      question: translation.question,
      options: [translation.options[0], translation.options[1], translation.options[2], translation.options[3]],
      explanation: translation.explanation,
      cached: true,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO mcq_question_translations (
         question_id, source_language, translation_language,
         translated_question, translated_option_a, translated_option_b,
         translated_option_c, translated_option_d, translated_explanation,
         source_content_hash, translation_status, verification_status,
         retry_count, last_error, last_attempted_at,
         provider, model_name, translation_version, updated_at
       )
       SELECT
         t.question_id, t.source_language, t.translation_language,
         t.translated_question, t.translated_option_a, t.translated_option_b,
         t.translated_option_c, t.translated_option_d, t.translated_explanation,
         t.source_content_hash, 'approved', 'verified',
         0, NULL, CURRENT_TIMESTAMP,
         t.provider, t.model_name, t.translation_version, CURRENT_TIMESTAMP
       FROM UNNEST(
         $1::int[], $2::text[], $3::text[],
         $4::text[], $5::text[], $6::text[],
         $7::text[], $8::text[], $9::text[],
         $10::text[], $11::text[], $12::text[], $13::int[]
       ) AS t(
         question_id, source_language, translation_language,
         translated_question, translated_option_a, translated_option_b,
         translated_option_c, translated_option_d, translated_explanation,
         source_content_hash, provider, model_name, translation_version
       )
       ON CONFLICT (question_id, translation_language) DO UPDATE SET
         source_language = EXCLUDED.source_language,
         translated_question = EXCLUDED.translated_question,
         translated_option_a = EXCLUDED.translated_option_a,
         translated_option_b = EXCLUDED.translated_option_b,
         translated_option_c = EXCLUDED.translated_option_c,
         translated_option_d = EXCLUDED.translated_option_d,
         translated_explanation = EXCLUDED.translated_explanation,
         source_content_hash = EXCLUDED.source_content_hash,
         translation_status = 'approved',
         verification_status = 'verified',
         retry_count = 0,
         last_error = NULL,
         last_attempted_at = CURRENT_TIMESTAMP,
         provider = EXCLUDED.provider,
         model_name = EXCLUDED.model_name,
         translation_version = EXCLUDED.translation_version,
         updated_at = CURRENT_TIMESTAMP`,
      [qIds, srcLangs, langs, qTexts, optAs, optBs, optCs, optDs, expls, hashes, providers, models, versions]
    );
    await client.query('COMMIT');
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    console.warn('[McqTranslation] Bulk cache write failed:', {
      count: entries.length,
      error: err?.message || String(err),
    });
  } finally {
    client.release();
  }
}

/**
 * Persists failed translation attempts into PostgreSQL recovery states
 * (RETRY_PENDING -> NEEDS_REVIEW after MAX_RETRY_ATTEMPTS) without overwriting
 * any already-approved translation.
 */
async function recordFailedTranslations(
  sources: Map<number, SourceQuestion>,
  failed: Map<number, string>
): Promise<void> {
  const entries = Array.from(failed.entries()).filter(([id]) => sources.has(id));
  if (entries.length === 0) return;

  try {
    await ensureTranslationSchema();
    for (const [id, errorMessage] of entries) {
      const source = sources.get(id)!;
      await pool.query(
        `INSERT INTO mcq_question_translations (
           question_id, source_language, translation_language,
           translated_question, translated_option_a, translated_option_b,
           translated_option_c, translated_option_d, translated_explanation,
           source_content_hash, translation_status, verification_status,
           retry_count, last_error, last_attempted_at, translation_version, updated_at
         )
         VALUES (
           $1::int, $2::text, $3::text,
           '', '', '', '', '', '',
           $4::text, 'RETRY_PENDING', 'pending',
           1, $5::text, CURRENT_TIMESTAMP, $6::int, CURRENT_TIMESTAMP
         )
         ON CONFLICT (question_id, translation_language) DO UPDATE SET
           retry_count = mcq_question_translations.retry_count + 1,
           last_error = EXCLUDED.last_error,
           last_attempted_at = CURRENT_TIMESTAMP,
           translation_status = CASE
             WHEN mcq_question_translations.retry_count + 1 >= $7::int THEN 'NEEDS_REVIEW'
             ELSE 'RETRY_PENDING'
           END,
           verification_status = CASE
             WHEN mcq_question_translations.retry_count + 1 >= $7::int THEN 'needs_review'
             ELSE 'pending'
           END,
           updated_at = CURRENT_TIMESTAMP
         WHERE mcq_question_translations.translation_status NOT IN ('approved', 'COMPLETED')`,
        [id, SOURCE_LANGUAGE, TARGET_LANGUAGE, source.contentHash, errorMessage.slice(0, 500), TRANSLATION_VERSION, MAX_RETRY_ATTEMPTS]
      );
    }
  } catch (err: any) {
    console.warn('[McqTranslation] Failed to persist translation error state:', err?.message || err);
  }
}

export function normalizeQuestionIds(rawIds: unknown): number[] {
  if (!Array.isArray(rawIds)) return [];
  const ids = rawIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  return Array.from(new Set(ids)).slice(0, MAX_TRANSLATION_IDS);
}

// ── Main Translation Orchestrator ──────────────────────────────────────────────
export async function translateStudyMaterialQuestions(
  rawIds: unknown,
  options: { cacheOnly?: boolean; pretranslate?: boolean } = {}
): Promise<McqTranslationResult> {
  const startedAt = Date.now();
  await ensureTranslationSchema();
  const ids = normalizeQuestionIds(rawIds);
  if (ids.length === 0) {
    return {
      translations: [],
      missingIds: [],
      failures: [],
      stats: {
        total: 0,
        completed: 0,
        pending: 0,
        failed: 0,
        cacheHits: 0,
        memoryCacheHits: 0,
        dbCacheHits: 0,
        newlyTranslated: 0,
        providerUsed: null,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  telemetry.totalLookups += ids.length;

  // Ultra-fast RAM path (< 2ms): if ALL requested IDs are warm in fastIdCache, skip DB completely!
  const fastHits: McqTranslationPayload[] = [];
  for (const id of ids) {
    const hit = getFromFastIdCache(id);
    if (!hit) break;
    fastHits.push(hit);
  }
  if (fastHits.length === ids.length) {
    telemetry.memoryHits += fastHits.length;
    return {
      translations: fastHits,
      missingIds: [],
      failures: [],
      stats: {
        total: ids.length,
        completed: fastHits.length,
        pending: 0,
        failed: 0,
        cacheHits: fastHits.length,
        memoryCacheHits: fastHits.length,
        dbCacheHits: 0,
        newlyTranslated: 0,
        providerUsed: null,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  const sourceResult = await pool.query<SourceQuestionRow>(
    `SELECT id, subject, lesson_title, question_text, options,
            option_a, option_b, option_c, option_d, explanation
     FROM questions
     WHERE id = ANY($1::int[])
       AND status = 'published'`,
    [ids]
  );

  const sourcesById = new Map<number, SourceQuestion>();
  for (const row of sourceResult.rows) {
    const source = toSourceQuestion(row);
    if (source) sourcesById.set(source.id, source);
  }

  const translations = new Map<number, McqTranslationPayload>();
  const failures = new Map<number, string>();
  for (const id of ids) {
    if (!sourcesById.has(id)) {
      failures.set(id, 'Question is not an available published question.');
    }
  }

  const availableSources = ids
    .map((id) => sourcesById.get(id))
    .filter((source): source is SourceQuestion => Boolean(source));

  // Tier 1: In-memory LRU cache lookup (< 5ms)
  let memoryCacheHits = 0;
  const dbLookupSources: SourceQuestion[] = [];
  for (const source of availableSources) {
    const memHit = getFromMemoryCache(source.id, source.contentHash);
    if (memHit) {
      translations.set(source.id, memHit);
      memoryCacheHits++;
    } else {
      dbLookupSources.push(source);
    }
  }

  // Tier 2: Bulk PostgreSQL cache lookup for remaining IDs
  let dbCacheHits = 0;
  if (dbLookupSources.length > 0) {
    const cachedResult = await pool.query(
      `SELECT question_id, translated_question, translated_option_a, translated_option_b,
              translated_option_c, translated_option_d, translated_explanation, source_content_hash
       FROM mcq_question_translations
       WHERE question_id = ANY($1::int[])
         AND translation_language = $2
         AND translation_status = 'approved'
         AND translation_version = $3`,
      [dbLookupSources.map((source) => source.id), TARGET_LANGUAGE, TRANSLATION_VERSION]
    );

    for (const row of cachedResult.rows) {
      const id = Number(row.question_id);
      const source = sourcesById.get(id);
      if (!source || row.source_content_hash !== source.contentHash) continue;
      const raw = toRawTranslation(row, id);
      if (validateTranslation(source, raw)) continue;
      const payload: McqTranslationPayload = {
        questionId: id,
        question: raw.question,
        options: [raw.options[0], raw.options[1], raw.options[2], raw.options[3]],
        explanation: raw.explanation,
        cached: true,
      };
      translations.set(id, payload);
      setInMemoryCache(id, source.contentHash, payload);
      dbCacheHits++;
    }
  }

  let pending = availableSources.filter((source) => !translations.has(source.id));
  telemetry.memoryHits += memoryCacheHits;
  telemetry.dbHits += dbCacheHits;
  telemetry.misses += pending.length;

  // Fast path: cacheOnly returns immediately (<50ms) and optionally kicks off background pre-translation
  if (options.cacheOnly) {
    const missingIds = pending.map((s) => s.id);
    if (options.pretranslate && missingIds.length > 0) {
      scheduleBackgroundPreTranslation(missingIds);
    }
    return {
      translations: ids
        .map((id) => translations.get(id))
        .filter((item): item is McqTranslationPayload => Boolean(item)),
      missingIds,
      failures: ids
        .filter((id) => failures.has(id) && !translations.has(id))
        .map((id) => ({ questionId: id, message: failures.get(id) || 'Unavailable.' })),
      stats: {
        total: ids.length,
        completed: translations.size,
        pending: missingIds.length,
        failed: failures.size,
        cacheHits: memoryCacheHits + dbCacheHits,
        memoryCacheHits,
        dbCacheHits,
        newlyTranslated: 0,
        providerUsed: null,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  // Deduplicate: await any in-flight translations for overlapping IDs
  const awaitingInFlight: SourceQuestion[] = [];
  const needTranslation: SourceQuestion[] = [];
  for (const source of pending) {
    if (inFlightById.has(source.id)) {
      awaitingInFlight.push(source);
    } else {
      needTranslation.push(source);
    }
  }

  if (awaitingInFlight.length > 0) {
    await Promise.all(
      awaitingInFlight.map(async (source) => {
        const res = await inFlightById.get(source.id)?.catch(() => null);
        if (res) {
          translations.set(source.id, res);
        } else {
          needTranslation.push(source);
        }
      })
    );
  }

  pending = needTranslation;
  let newlyTranslated = 0;
  let providerUsed: string | null = null;

  if (pending.length > 0) {
    const providers = await getOrderedConfiguredProviders();
    if (providers.length === 0) {
      for (const source of pending) {
        failures.set(source.id, 'No AI translation provider is configured. Please check backend settings.');
      }
    } else {
      const batches: SourceQuestion[][] = [];
      for (let offset = 0; offset < pending.length; offset += AI_BATCH_SIZE) {
        batches.push(pending.slice(offset, offset + AI_BATCH_SIZE));
      }

      const resolvers = new Map<number, (val: McqTranslationPayload | null) => void>();
      for (const source of pending) {
        const p = new Promise<McqTranslationPayload | null>((resolve) => {
          resolvers.set(source.id, resolve);
        });
        inFlightById.set(source.id, p);
      }

      let cursor = 0;
      const runWorker = async () => {
        while (cursor < batches.length) {
          const batchIndex = cursor++;
          const batch = batches[batchIndex];
          // Refresh provider priority order so cooled-down providers are skipped by subsequent workers
          const currentProviders = await getOrderedConfiguredProviders();
          const activeList = currentProviders.length > 0 ? currentProviders : providers;

          const outcome = await translateBatchWithRecovery(activeList, batch);
          if (outcome.translations.size > 0) {
            providerUsed = outcome.providerName;
          }

          await saveTranslations(
            outcome.providerName,
            outcome.modelName,
            sourcesById,
            outcome.translations
          );
          if (outcome.failed.size > 0) {
            await recordFailedTranslations(sourcesById, outcome.failed);
          }

          for (const source of batch) {
            const raw = outcome.translations.get(source.id);
            if (raw) {
              const payload: McqTranslationPayload = {
                questionId: source.id,
                question: raw.question,
                options: [raw.options[0], raw.options[1], raw.options[2], raw.options[3]],
                explanation: raw.explanation,
                cached: false,
              };
              translations.set(source.id, payload);
              newlyTranslated++;
              resolvers.get(source.id)?.(payload);
            } else {
              const msg = outcome.failed.get(source.id) || 'Translation could not be completed.';
              failures.set(source.id, msg);
              resolvers.get(source.id)?.(null);
            }
            inFlightById.delete(source.id);
          }
        }
      };

      const workers = Array.from({ length: Math.min(AI_CONCURRENCY, batches.length) }, () => runWorker());
      await Promise.all(workers);

      // Defensive cleanup
      for (const source of pending) {
        if (inFlightById.has(source.id)) {
          resolvers.get(source.id)?.(null);
          inFlightById.delete(source.id);
        }
      }
    }
  }

  const orderedTranslations = ids
    .map((id) => translations.get(id))
    .filter((item): item is McqTranslationPayload => Boolean(item));
  const orderedFailures = ids
    .filter((id) => failures.has(id) && !translations.has(id))
    .map((id) => ({ questionId: id, message: failures.get(id) || 'Translation unavailable.' }));

  return {
    translations: orderedTranslations,
    missingIds: orderedFailures.map((f) => f.questionId),
    failures: orderedFailures,
    stats: {
      total: ids.length,
      completed: orderedTranslations.length,
      pending: 0,
      failed: orderedFailures.length,
      cacheHits: memoryCacheHits + dbCacheHits,
      memoryCacheHits,
      dbCacheHits,
      newlyTranslated,
      providerUsed,
      durationMs: Date.now() - startedAt,
    },
  };
}

// ── Background Pre-Translation Queue (Deduplicated & Non-Blocking) ─────────────
const backgroundQueue: number[] = [];
const backgroundQueuedSet = new Set<number>();
let backgroundWorkerRunning = false;

async function drainBackgroundQueue(): Promise<void> {
  if (backgroundWorkerRunning) return;
  backgroundWorkerRunning = true;
  try {
    while (backgroundQueue.length > 0) {
      const chunk = backgroundQueue.splice(0, AI_BATCH_SIZE * 2);
      try {
        await translateStudyMaterialQuestions(chunk);
      } catch (err: any) {
        console.warn('[McqTranslation] Background pre-translation chunk error:', err?.message || String(err));
      } finally {
        for (const id of chunk) backgroundQueuedSet.delete(id);
      }
      // Small breather between background chunks to keep interactive requests snappy
      if (backgroundQueue.length > 0) {
        await delay(250);
      }
    }
  } finally {
    backgroundWorkerRunning = false;
  }
}

/**
 * Non-blocking background pre-translation queue for newly uploaded MCQs
 * or newly initialized student MCQ sessions. Supports 1,000+ MCQs without truncation.
 */
export function scheduleBackgroundPreTranslation(questionIds: number[]): number {
  const cleanIds = Array.from(
    new Set(
      (Array.isArray(questionIds) ? questionIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
  if (cleanIds.length === 0) return 0;

  let added = 0;
  for (const id of cleanIds) {
    if (!backgroundQueuedSet.has(id) && !inFlightById.has(id)) {
      backgroundQueuedSet.add(id);
      backgroundQueue.push(id);
      added++;
    }
  }

  if (added > 0 && !backgroundWorkerRunning) {
    setImmediate(() => {
      void drainBackgroundQueue();
    });
  }
  return added;
}

// ── Admin Translation Control Center APIs ──────────────────────────────────────
export interface AdminTranslationFilter {
  group?: string;
  subject?: string;
  standard?: string;
  unit?: string;
  lesson?: string;
  status?: string;
  limit?: number;
}

function buildAdminQuestionFilterSql(filters?: AdminTranslationFilter): {
  whereSql: string;
  params: any[];
} {
  const where: string[] = [`q.status = 'published'`];
  const params: any[] = [];
  let idx = 1;

  if (filters?.group && filters.group !== 'all') {
    const g = filters.group.trim().toLowerCase();
    if (g === 'group1') {
      where.push(`LOWER(COALESCE(q.category, '')) IN ('group1', 'group 1')`);
    } else if (g === 'group2' || g === 'group2_2a' || g === 'group2a') {
      where.push(`LOWER(COALESCE(q.category, '')) IN ('group2', 'group2a', 'group2_2a', 'group 2', 'group 2a')`);
    } else if (g === 'group4' || g === 'group4_vao' || g === 'vao') {
      where.push(`LOWER(COALESCE(q.category, '')) IN ('group4', 'group4_vao', 'vao', 'group 4')`);
    }
  }

  if (filters?.subject && filters.subject !== 'all') {
    where.push(`LOWER(COALESCE(q.subject, '')) LIKE $${idx}::text`);
    params.push(`%${filters.subject.trim().toLowerCase()}%`);
    idx++;
  }

  if (filters?.standard && filters.standard !== 'all') {
    const stdNum = parseInt(filters.standard, 10);
    if (!Number.isNaN(stdNum)) {
      where.push(`q.class_id = $${idx}::int`);
      params.push(stdNum);
      idx++;
    }
  }

  if (filters?.unit && filters.unit !== 'all') {
    const unitNum = parseInt(filters.unit, 10);
    if (!Number.isNaN(unitNum)) {
      where.push(`q.unit_id = $${idx}::int`);
      params.push(unitNum);
      idx++;
    }
  }

  if (filters?.lesson && filters.lesson.trim()) {
    where.push(`LOWER(COALESCE(q.lesson_title, '')) LIKE $${idx}::text`);
    params.push(`%${filters.lesson.trim().toLowerCase()}%`);
    idx++;
  }

  return { whereSql: where.join(' AND '), params };
}

export async function getAdminTranslationStats(filters?: AdminTranslationFilter) {
  await ensureTranslationSchema();
  const { whereSql, params } = buildAdminQuestionFilterSql(filters);

  const summaryRes = await pool.query(
    `SELECT
       COUNT(*)::int AS total_english,
       COUNT(*) FILTER (WHERE t.translation_status IN ('approved', 'COMPLETED'))::int AS fully_translated,
       COUNT(*) FILTER (WHERE t.id IS NULL OR t.translation_status = 'PENDING')::int AS pending,
       COUNT(*) FILTER (WHERE t.translation_status = 'PROCESSING')::int AS processing,
       COUNT(*) FILTER (WHERE t.translation_status = 'RETRY_PENDING')::int AS failed_retryable,
       COUNT(*) FILTER (WHERE t.translation_status = 'NEEDS_REVIEW')::int AS needs_review
     FROM questions q
     LEFT JOIN mcq_question_translations t
       ON t.question_id = q.id AND t.translation_language = 'ta'
     WHERE ${whereSql}`,
    params
  );

  const row = summaryRes.rows[0] || {};
  const totalEnglish = Number(row.total_english || 0);
  const fullyTranslated = Number(row.fully_translated || 0);
  const pending = Number(row.pending || 0);
  const processing = Number(row.processing || 0) + inFlightById.size;
  const failed = Number(row.failed_retryable || 0);
  const needsReview = Number(row.needs_review || 0);
  const completionPercentage =
    totalEnglish > 0 ? Math.round((fullyTranslated / totalEnglish) * 1000) / 10 : 100;

  const totalCacheHits = telemetry.memoryHits + telemetry.dbHits;
  const cacheHitRate =
    telemetry.totalLookups > 0
      ? Math.round((totalCacheHits / telemetry.totalLookups) * 1000) / 10
      : fullyTranslated > 0 && totalEnglish > 0
        ? Math.round((fullyTranslated / totalEnglish) * 1000) / 10
        : 0;

  // Fetch problem/missing items for admin inspection
  const statusClause =
    filters?.status === 'NEEDS_REVIEW'
      ? `AND t.translation_status = 'NEEDS_REVIEW'`
      : filters?.status === 'RETRY_PENDING' || filters?.status === 'FAILED'
        ? `AND t.translation_status = 'RETRY_PENDING'`
        : filters?.status === 'PENDING'
          ? `AND (t.id IS NULL OR t.translation_status = 'PENDING')`
          : filters?.status === 'COMPLETED'
            ? `AND t.translation_status IN ('approved', 'COMPLETED')`
            : `AND (t.id IS NULL OR t.translation_status NOT IN ('approved', 'COMPLETED'))`;

  const limit = Math.max(10, Math.min(200, Number(filters?.limit) || 100));
  const itemsRes = await pool.query(
    `SELECT
       q.id AS question_id,
       q.category,
       q.subject,
       q.class_id,
       q.unit_id,
       q.lesson_title,
       LEFT(q.question_text, 140) AS question_preview,
       COALESCE(t.translation_status, 'PENDING') AS translation_status,
       COALESCE(t.verification_status, 'pending') AS verification_status,
       COALESCE(t.retry_count, 0) AS retry_count,
       t.last_error,
       t.provider,
       t.updated_at
     FROM questions q
     LEFT JOIN mcq_question_translations t
       ON t.question_id = q.id AND t.translation_language = 'ta'
     WHERE ${whereSql}
       ${statusClause}
     ORDER BY
       CASE COALESCE(t.translation_status, 'PENDING')
         WHEN 'NEEDS_REVIEW' THEN 1
         WHEN 'RETRY_PENDING' THEN 2
         WHEN 'PENDING' THEN 3
         ELSE 4
       END,
       q.id ASC
     LIMIT $${params.length + 1}::int`,
    [...params, limit]
  );

  // Also fetch distinct subjects for filter dropdown
  const subjectsRes = await pool.query(
    `SELECT DISTINCT subject FROM questions WHERE status = 'published' AND subject IS NOT NULL ORDER BY subject ASC`
  );

  return {
    summary: {
      totalEnglish,
      fullyTranslated,
      pending,
      processing,
      failed,
      needsReview,
      completionPercentage,
      cacheHitRate,
      queueDepth: backgroundQueue.length,
      workerActive: backgroundWorkerRunning,
      memoryCacheEntries: memoryCache.size,
    },
    availableSubjects: subjectsRes.rows.map((r) => String(r.subject)),
    items: itemsRes.rows.map((r) => ({
      questionId: Number(r.question_id),
      category: String(r.category || ''),
      subject: String(r.subject || ''),
      standard: r.class_id ? Number(r.class_id) : null,
      unit: r.unit_id ? Number(r.unit_id) : null,
      lessonTitle: String(r.lesson_title || ''),
      questionPreview: String(r.question_preview || ''),
      translationStatus: String(r.translation_status || 'PENDING'),
      verificationStatus: String(r.verification_status || 'pending'),
      retryCount: Number(r.retry_count || 0),
      lastError: r.last_error ? String(r.last_error) : null,
      provider: r.provider ? String(r.provider) : null,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    })),
  };
}

export async function triggerAdminTranslateMissing(filters?: AdminTranslationFilter) {
  await ensureTranslationSchema();
  const { whereSql, params } = buildAdminQuestionFilterSql(filters);
  const res = await pool.query(
    `SELECT q.id
     FROM questions q
     LEFT JOIN mcq_question_translations t
       ON t.question_id = q.id AND t.translation_language = 'ta'
     WHERE ${whereSql}
       AND (t.id IS NULL OR t.translation_status NOT IN ('approved', 'COMPLETED'))
     ORDER BY q.id ASC`,
    params
  );
  const ids = res.rows.map((r) => Number(r.id));
  const queued = scheduleBackgroundPreTranslation(ids);
  return { foundMissing: ids.length, queued, questionIds: ids.slice(0, 50) };
}

export async function triggerAdminRetryFailed(questionIds?: number[]) {
  await ensureTranslationSchema();
  let ids: number[] = [];
  if (Array.isArray(questionIds) && questionIds.length > 0) {
    ids = Array.from(new Set(questionIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)));
  } else {
    const res = await pool.query(
      `SELECT q.id
       FROM questions q
       LEFT JOIN mcq_question_translations t
         ON t.question_id = q.id AND t.translation_language = 'ta'
       WHERE q.status = 'published'
         AND (t.id IS NULL OR t.translation_status IN ('RETRY_PENDING', 'NEEDS_REVIEW', 'PENDING'))
       ORDER BY q.id ASC`
    );
    ids = res.rows.map((r) => Number(r.id));
  }

  if (ids.length > 0) {
    await pool.query(
      `UPDATE mcq_question_translations
       SET translation_status = 'RETRY_PENDING',
           retry_count = 0,
           last_error = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE question_id = ANY($1::int[])
         AND translation_language = 'ta'
         AND translation_status NOT IN ('approved', 'COMPLETED')`,
      [ids]
    );
  }

  const queued = scheduleBackgroundPreTranslation(ids);
  return { retriedCount: ids.length, queued };
}

export async function revalidateStoredTranslations(limit = 500) {
  await ensureTranslationSchema();
  const safeLimit = Math.max(10, Math.min(2000, Number(limit) || 500));
  const res = await pool.query(
    `SELECT
       q.id, q.subject, q.lesson_title, q.question_text, q.options,
       q.option_a, q.option_b, q.option_c, q.option_d, q.explanation,
       t.translated_question, t.translated_option_a, t.translated_option_b,
       t.translated_option_c, t.translated_option_d, t.translated_explanation,
       t.source_content_hash
     FROM mcq_question_translations t
     JOIN questions q ON q.id = t.question_id
     WHERE t.translation_language = 'ta'
       AND t.translation_status IN ('approved', 'COMPLETED')
       AND q.status = 'published'
     ORDER BY q.id ASC
     LIMIT $1::int`,
    [safeLimit]
  );

  let validCount = 0;
  const invalidIds: Array<{ questionId: number; reason: string }> = [];

  for (const row of res.rows) {
    const source = toSourceQuestion(row);
    if (!source) continue;
    if (row.source_content_hash !== source.contentHash) {
      invalidIds.push({ questionId: source.id, reason: 'Source question changed since translation.' });
      continue;
    }
    const raw = toRawTranslation(row, source.id);
    const reason = validateTranslation(source, raw);
    if (reason) {
      invalidIds.push({ questionId: source.id, reason });
    } else {
      validCount++;
    }
  }

  for (const inv of invalidIds) {
    await pool.query(
      `UPDATE mcq_question_translations
       SET translation_status = 'RETRY_PENDING',
           verification_status = 'needs_review',
           last_error = $2::text,
           updated_at = CURRENT_TIMESTAMP
       WHERE question_id = $1::int AND translation_language = 'ta'`,
      [inv.questionId, inv.reason]
    );
    fastIdCache.delete(inv.questionId);
  }

  if (invalidIds.length > 0) {
    scheduleBackgroundPreTranslation(invalidIds.map((i) => i.questionId));
  }

  return {
    checked: res.rows.length,
    validCount,
    flaggedForRecovery: invalidIds.length,
    flaggedItems: invalidIds.slice(0, 50),
  };
}

// ── Previous Year Paper Questions Translation Engine (2-Tier RAM + PostgreSQL) ──
const pypMemoryCache = new Map<string, McqTranslationPayload>();
const pypFastIdCache = new Map<number, { payload: McqTranslationPayload; expiresAt: number }>();
const pypInFlightById = new Map<number, Promise<McqTranslationPayload | null>>();
let pypSchemaReady = false;

async function ensurePypTranslationTable(): Promise<void> {
  if (pypSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pyp_question_translations (
      id SERIAL PRIMARY KEY,
      pyp_question_id INT NOT NULL REFERENCES previous_year_paper_questions(id) ON DELETE CASCADE,
      source_language VARCHAR(8) NOT NULL DEFAULT 'en',
      translation_language VARCHAR(8) NOT NULL DEFAULT 'ta',
      translated_question TEXT NOT NULL,
      translated_option_a TEXT NOT NULL,
      translated_option_b TEXT NOT NULL,
      translated_option_c TEXT NOT NULL,
      translated_option_d TEXT NOT NULL,
      translated_explanation TEXT NOT NULL DEFAULT '',
      source_content_hash VARCHAR(64) NOT NULL,
      translation_status VARCHAR(20) NOT NULL DEFAULT 'approved',
      provider VARCHAR(50),
      model_name VARCHAR(120),
      translation_version INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_pyp_translation_question_language UNIQUE (pyp_question_id, translation_language)
    );
    CREATE INDEX IF NOT EXISTS idx_pyp_translations_fast_lookup
    ON pyp_question_translations (pyp_question_id, source_language, translation_language, translation_version, translation_status);
  `);
  pypSchemaReady = true;
}

function getPypFastIdCache(id: number): McqTranslationPayload | null {
  const entry = pypFastIdCache.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    pypFastIdCache.delete(id);
    return null;
  }
  return { ...entry.payload, cached: true };
}

function setPypMemoryCache(id: number, contentHash: string, payload: McqTranslationPayload): void {
  const key = `pyp:${makeMemoryCacheKey(id, contentHash)}`;
  const cachedPayload = { ...payload, cached: true };
  if (pypMemoryCache.has(key)) pypMemoryCache.delete(key);
  else if (pypMemoryCache.size >= MEMORY_CACHE_MAX_ENTRIES) {
    const oldest = pypMemoryCache.keys().next().value;
    if (oldest !== undefined) pypMemoryCache.delete(oldest);
  }
  pypMemoryCache.set(key, cachedPayload);
  pypFastIdCache.set(id, { payload: cachedPayload, expiresAt: Date.now() + FAST_ID_CACHE_TTL_MS });
  if (pypFastIdCache.size > MEMORY_CACHE_MAX_ENTRIES) {
    const oldestId = pypFastIdCache.keys().next().value;
    if (oldestId !== undefined) pypFastIdCache.delete(oldestId);
  }
}

async function savePypTranslations(
  providerName: string,
  modelName: string | null,
  sources: Map<number, SourceQuestion>,
  translations: Map<number, RawTranslation>
): Promise<void> {
  const entries = Array.from(translations.entries()).filter(([id]) => sources.has(id));
  if (entries.length === 0) return;

  await ensurePypTranslationTable();
  const qIds: number[] = [];
  const srcLangs: string[] = [];
  const langs: string[] = [];
  const qTexts: string[] = [];
  const optAs: string[] = [];
  const optBs: string[] = [];
  const optCs: string[] = [];
  const optDs: string[] = [];
  const expls: string[] = [];
  const hashes: string[] = [];
  const providers: string[] = [];
  const models: (string | null)[] = [];
  const versions: number[] = [];

  for (const [id, tr] of entries) {
    const src = sources.get(id)!;
    qIds.push(id);
    srcLangs.push(SOURCE_LANGUAGE);
    langs.push(TARGET_LANGUAGE);
    qTexts.push(tr.question);
    optAs.push(tr.options[0]);
    optBs.push(tr.options[1]);
    optCs.push(tr.options[2]);
    optDs.push(tr.options[3]);
    expls.push(tr.explanation);
    hashes.push(src.contentHash);
    providers.push(providerName);
    models.push(modelName);
    versions.push(TRANSLATION_VERSION);

    setPypMemoryCache(id, src.contentHash, {
      questionId: id,
      question: tr.question,
      options: [tr.options[0], tr.options[1], tr.options[2], tr.options[3]],
      explanation: tr.explanation,
      cached: true,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO pyp_question_translations (
         pyp_question_id, source_language, translation_language,
         translated_question, translated_option_a, translated_option_b,
         translated_option_c, translated_option_d, translated_explanation,
         source_content_hash, translation_status, provider, model_name, translation_version, updated_at
       )
       SELECT
         t.pyp_question_id, t.source_language, t.translation_language,
         t.translated_question, t.translated_option_a, t.translated_option_b,
         t.translated_option_c, t.translated_option_d, t.translated_explanation,
         t.source_content_hash, 'approved', t.provider, t.model_name, t.translation_version, CURRENT_TIMESTAMP
       FROM UNNEST(
         $1::int[], $2::text[], $3::text[],
         $4::text[], $5::text[], $6::text[],
         $7::text[], $8::text[], $9::text[],
         $10::text[], $11::text[], $12::text[], $13::int[]
       ) AS t(
         pyp_question_id, source_language, translation_language,
         translated_question, translated_option_a, translated_option_b,
         translated_option_c, translated_option_d, translated_explanation,
         source_content_hash, provider, model_name, translation_version
       )
       ON CONFLICT (pyp_question_id, translation_language) DO UPDATE SET
         source_language = EXCLUDED.source_language,
         translated_question = EXCLUDED.translated_question,
         translated_option_a = EXCLUDED.translated_option_a,
         translated_option_b = EXCLUDED.translated_option_b,
         translated_option_c = EXCLUDED.translated_option_c,
         translated_option_d = EXCLUDED.translated_option_d,
         translated_explanation = EXCLUDED.translated_explanation,
         source_content_hash = EXCLUDED.source_content_hash,
         translation_status = 'approved',
         provider = EXCLUDED.provider,
         model_name = EXCLUDED.model_name,
         translation_version = EXCLUDED.translation_version,
         updated_at = CURRENT_TIMESTAMP`,
      [qIds, srcLangs, langs, qTexts, optAs, optBs, optCs, optDs, expls, hashes, providers, models, versions]
    );
    await client.query('COMMIT');
  } catch (err: any) {
    try { await client.query('ROLLBACK'); } catch {}
    console.warn('[PypTranslation] Bulk cache write failed:', err?.message || String(err));
  } finally {
    client.release();
  }
}

const pypBgQueue: number[] = [];
const pypBgQueuedSet = new Set<number>();
let pypBgRunning = false;

async function drainPypBgQueue(): Promise<void> {
  if (pypBgRunning) return;
  pypBgRunning = true;
  try {
    while (pypBgQueue.length > 0) {
      const chunk = pypBgQueue.splice(0, AI_BATCH_SIZE * 2);
      try {
        await translatePreviousPaperQuestions(chunk);
      } catch (err: any) {
        console.warn('[PypTranslation] Background pre-translation error:', err?.message || String(err));
      } finally {
        for (const id of chunk) pypBgQueuedSet.delete(id);
      }
      if (pypBgQueue.length > 0) await delay(250);
    }
  } finally {
    pypBgRunning = false;
  }
}

export function schedulePypBackgroundPreTranslation(questionIds: number[]): void {
  const cleanIds = normalizeQuestionIds(questionIds);
  let added = 0;
  for (const id of cleanIds) {
    if (!pypBgQueuedSet.has(id) && !pypInFlightById.has(id)) {
      pypBgQueuedSet.add(id);
      pypBgQueue.push(id);
      added++;
    }
  }
  if (added > 0 && !pypBgRunning) {
    setImmediate(() => { void drainPypBgQueue(); });
  }
}

export async function translatePreviousPaperQuestions(
  rawIds: unknown,
  options: { cacheOnly?: boolean; pretranslate?: boolean } = {}
): Promise<McqTranslationResult> {
  const startedAt = Date.now();
  const ids = normalizeQuestionIds(rawIds);
  if (ids.length === 0) {
    return {
      translations: [],
      missingIds: [],
      failures: [],
      stats: {
        total: 0, completed: 0, pending: 0, failed: 0,
        cacheHits: 0, memoryCacheHits: 0, dbCacheHits: 0,
        newlyTranslated: 0, providerUsed: null, durationMs: Date.now() - startedAt,
      },
    };
  }

  // Ultra-fast RAM path (< 1-2ms)
  const fastHits: McqTranslationPayload[] = [];
  for (const id of ids) {
    const hit = getPypFastIdCache(id);
    if (!hit) break;
    fastHits.push(hit);
  }
  if (fastHits.length === ids.length) {
    return {
      translations: fastHits,
      missingIds: [],
      failures: [],
      stats: {
        total: ids.length, completed: fastHits.length, pending: 0, failed: 0,
        cacheHits: fastHits.length, memoryCacheHits: fastHits.length, dbCacheHits: 0,
        newlyTranslated: 0, providerUsed: null, durationMs: Date.now() - startedAt,
      },
    };
  }

  await ensurePypTranslationTable();

  const sourceResult = await pool.query(
    `SELECT id, subject, topic AS lesson_title, question_text,
            option_a, option_b, option_c, option_d, explanation
     FROM previous_year_paper_questions
     WHERE id = ANY($1::int[])`,
    [ids]
  );

  const sourcesById = new Map<number, SourceQuestion>();
  for (const row of sourceResult.rows) {
    const src = toSourceQuestion({ ...row, options: null });
    if (src) sourcesById.set(src.id, src);
  }

  const translations = new Map<number, McqTranslationPayload>();
  const failures = new Map<number, string>();
  for (const id of ids) {
    if (!sourcesById.has(id)) failures.set(id, 'Previous year paper question is not available.');
  }

  const availableSources = ids
    .map((id) => sourcesById.get(id))
    .filter((s): s is SourceQuestion => Boolean(s));

  let memoryCacheHits = 0;
  const dbLookupSources: SourceQuestion[] = [];
  for (const src of availableSources) {
    const memKey = `pyp:${makeMemoryCacheKey(src.id, src.contentHash)}`;
    const memHit = pypMemoryCache.get(memKey);
    if (memHit) {
      translations.set(src.id, { ...memHit, cached: true });
      memoryCacheHits++;
    } else {
      dbLookupSources.push(src);
    }
  }

  let dbCacheHits = 0;
  if (dbLookupSources.length > 0) {
    const cachedResult = await pool.query(
      `SELECT pyp_question_id, translated_question, translated_option_a, translated_option_b,
              translated_option_c, translated_option_d, translated_explanation, source_content_hash
       FROM pyp_question_translations
       WHERE pyp_question_id = ANY($1::int[])
         AND translation_language = $2
         AND translation_status = 'approved'
         AND translation_version = $3`,
      [dbLookupSources.map((s) => s.id), TARGET_LANGUAGE, TRANSLATION_VERSION]
    );
    for (const row of cachedResult.rows) {
      const id = Number(row.pyp_question_id);
      const src = sourcesById.get(id);
      if (!src || row.source_content_hash !== src.contentHash) continue;
      const raw = toRawTranslation(row, id);
      if (validateTranslation(src, raw)) continue;
      const payload: McqTranslationPayload = {
        questionId: id,
        question: raw.question,
        options: [raw.options[0], raw.options[1], raw.options[2], raw.options[3]],
        explanation: raw.explanation,
        cached: true,
      };
      translations.set(id, payload);
      setPypMemoryCache(id, src.contentHash, payload);
      dbCacheHits++;
    }
  }

  let pending = availableSources.filter((s) => !translations.has(s.id));

  if (options.cacheOnly) {
    const missingIds = pending.map((s) => s.id);
    if (options.pretranslate && missingIds.length > 0) {
      schedulePypBackgroundPreTranslation(missingIds);
    }
    return {
      translations: ids.map((id) => translations.get(id)).filter((x): x is McqTranslationPayload => Boolean(x)),
      missingIds,
      failures: ids
        .filter((id) => failures.has(id) && !translations.has(id))
        .map((id) => ({ questionId: id, message: failures.get(id) || 'Unavailable.' })),
      stats: {
        total: ids.length, completed: translations.size, pending: missingIds.length, failed: failures.size,
        cacheHits: memoryCacheHits + dbCacheHits, memoryCacheHits, dbCacheHits,
        newlyTranslated: 0, providerUsed: null, durationMs: Date.now() - startedAt,
      },
    };
  }

  // Deduplicate in-flight requests
  const awaitingInFlight: SourceQuestion[] = [];
  const needTranslation: SourceQuestion[] = [];
  for (const src of pending) {
    if (pypInFlightById.has(src.id)) awaitingInFlight.push(src);
    else needTranslation.push(src);
  }
  if (awaitingInFlight.length > 0) {
    await Promise.all(
      awaitingInFlight.map(async (src) => {
        const res = await pypInFlightById.get(src.id)?.catch(() => null);
        if (res) translations.set(src.id, res);
        else needTranslation.push(src);
      })
    );
  }

  pending = needTranslation;
  let newlyTranslated = 0;
  let providerUsed: string | null = null;

  if (pending.length > 0) {
    const providers = await getOrderedConfiguredProviders();
    if (providers.length === 0) {
      for (const src of pending) failures.set(src.id, 'No AI translation provider configured.');
    } else {
      const batches: SourceQuestion[][] = [];
      for (let offset = 0; offset < pending.length; offset += AI_BATCH_SIZE) {
        batches.push(pending.slice(offset, offset + AI_BATCH_SIZE));
      }

      const resolvers = new Map<number, (val: McqTranslationPayload | null) => void>();
      for (const src of pending) {
        pypInFlightById.set(src.id, new Promise<McqTranslationPayload | null>((resolve) => resolvers.set(src.id, resolve)));
      }

      let cursor = 0;
      const runWorker = async () => {
        while (cursor < batches.length) {
          const batch = batches[cursor++];
          const currentProviders = await getOrderedConfiguredProviders();
          const outcome = await translateBatchWithRecovery(currentProviders.length > 0 ? currentProviders : providers, batch);
          if (outcome.translations.size > 0) providerUsed = outcome.providerName;

          await savePypTranslations(outcome.providerName, outcome.modelName, sourcesById, outcome.translations);

          for (const src of batch) {
            const raw = outcome.translations.get(src.id);
            if (raw) {
              const payload: McqTranslationPayload = {
                questionId: src.id,
                question: raw.question,
                options: [raw.options[0], raw.options[1], raw.options[2], raw.options[3]],
                explanation: raw.explanation,
                cached: false,
              };
              translations.set(src.id, payload);
              newlyTranslated++;
              resolvers.get(src.id)?.(payload);
            } else {
              failures.set(src.id, outcome.failed.get(src.id) || 'Translation could not be completed.');
              resolvers.get(src.id)?.(null);
            }
            pypInFlightById.delete(src.id);
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(AI_CONCURRENCY, batches.length) }, () => runWorker()));
    }
  }

  const orderedTranslations = ids.map((id) => translations.get(id)).filter((x): x is McqTranslationPayload => Boolean(x));
  const orderedFailures = ids
    .filter((id) => failures.has(id) && !translations.has(id))
    .map((id) => ({ questionId: id, message: failures.get(id) || 'Translation unavailable.' }));

  return {
    translations: orderedTranslations,
    missingIds: orderedFailures.map((f) => f.questionId),
    failures: orderedFailures,
    stats: {
      total: ids.length, completed: orderedTranslations.length, pending: 0, failed: orderedFailures.length,
      cacheHits: memoryCacheHits + dbCacheHits, memoryCacheHits, dbCacheHits,
      newlyTranslated, providerUsed, durationMs: Date.now() - startedAt,
    },
  };
}
