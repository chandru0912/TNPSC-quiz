import crypto from 'crypto';
import pool from '../db';
import { AIProviderFactory } from './ai/ai-provider.factory';
import { IAIProvider } from './ai/ai-provider.interface';

/**
 * Study Materials Global Language Translation Engine (English <-> Tamil)
 * Reuses the existing AIProviderFactory (Gemini / Claude / OpenAI with automatic failover)
 * and persists all verified translations in PostgreSQL (`study_material_translations`)
 * backed by a fast bounded in-memory LRU cache (<1ms hit latency).
 *
 * Strictly read-only with respect to canonical English study_notes / syllabus tables.
 */

export type StudyMaterialLang = 'en' | 'ta';
export type StudyMaterialContentType = 'ui' | 'heading' | 'syllabus' | 'lesson' | 'note_markdown';

export interface StudyMaterialTranslationInputItem {
  key: string;
  text: string;
  type?: StudyMaterialContentType;
}

export interface StudyMaterialTranslationResult {
  translations: Record<string, string>;
  failedKeys: string[];
  stats: {
    total: number;
    memoryHits: number;
    dbHits: number;
    aiTranslated: number;
    skipped: number;
    failed: number;
  };
}

const MAX_ITEMS_PER_REQUEST = 150;
const SHORT_BATCH_SIZE = 12;
const SPLIT_BATCH_SIZE = 3;
const MAX_CONCURRENCY = 3;
const LONG_MARKDOWN_THRESHOLD = 1600;
const AI_TIMEOUT_MS = Number(process.env.TRANSLATION_TIMEOUT_MS) || 35000;
const MEMORY_CACHE_MAX_ENTRIES = 10000;

const TAMIL_CHAR_REGEX = /[\u0B80-\u0BFF]/;
const LATIN_WORD_REGEX = /[A-Za-z]{2,}/;

// Bounded in-memory LRU cache: `${targetLang}:${contentHash}` -> translatedText
const memoryCache = new Map<string, string>();
// In-flight deduplication: `${targetLang}:${contentHash}` -> Promise<string | null>
const inFlightRequests = new Map<string, Promise<string | null>>();

// Provider cooldown tracking (shared resilience pattern with MCQ translation engine)
const providerCooldownUntil = new Map<string, { until: number; reason: string }>();

let schemaEnsuredPromise: Promise<void> | null = null;

export async function ensureStudyMaterialTranslationSchema(): Promise<void> {
  if (!schemaEnsuredPromise) {
    schemaEnsuredPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS study_material_translations (
          id BIGSERIAL PRIMARY KEY,
          content_hash VARCHAR(64) NOT NULL,
          source_lang VARCHAR(8) NOT NULL DEFAULT 'en',
          target_lang VARCHAR(8) NOT NULL DEFAULT 'ta',
          content_type VARCHAR(32) NOT NULL DEFAULT 'syllabus',
          source_text TEXT NOT NULL,
          translated_text TEXT NOT NULL,
          provider VARCHAR(40) NULL,
          model_name VARCHAR(80) NULL,
          status VARCHAR(24) NOT NULL DEFAULT 'approved',
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_sm_translations_hash_lang UNIQUE (content_hash, target_lang)
        );

        CREATE INDEX IF NOT EXISTS idx_sm_trans_lang_status
          ON study_material_translations (target_lang, status);
        CREATE INDEX IF NOT EXISTS idx_sm_trans_hash
          ON study_material_translations (content_hash);
      `);
    })().catch((err) => {
      schemaEnsuredPromise = null;
      throw err;
    });
  }
  await schemaEnsuredPromise;
}

function getMemoryCached(cacheKey: string): string | null {
  const val = memoryCache.get(cacheKey);
  if (val === undefined) return null;
  // Refresh LRU recency
  memoryCache.delete(cacheKey);
  memoryCache.set(cacheKey, val);
  return val;
}

function setMemoryCached(cacheKey: string, value: string): void {
  if (memoryCache.has(cacheKey)) {
    memoryCache.delete(cacheKey);
  }
  memoryCache.set(cacheKey, value);
  if (memoryCache.size > MEMORY_CACHE_MAX_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest !== undefined) memoryCache.delete(oldest);
  }
}

function computeContentHash(text: string, sourceLang: StudyMaterialLang, targetLang: StudyMaterialLang): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  return crypto
    .createHash('sha256')
    .update(`v1|${sourceLang}|${targetLang}|${normalized}`)
    .digest('hex');
}

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
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('rate-limit') ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('too many requests')
  );
}

function isFatalProviderError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('insufficient_credits') ||
    msg.includes('credit balance') ||
    msg.includes('insufficient credits') ||
    msg.includes('unpaid invoice') ||
    msg.includes('billing') ||
    msg.includes('invalid_api_key') ||
    msg.includes('authentication') ||
    msg.includes('unauthorized') ||
    msg.includes('401') ||
    msg.includes('403')
  );
}

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
    // Fallback scan below
  }

  for (const name of ['gemini', 'claude', 'openai'] as const) {
    try {
      addIfConfigured(AIProviderFactory.getProvider(name));
    } catch {
      // Ignore unconfigured provider
    }
  }

  return [...healthy, ...cooling];
}

function shouldSkipTranslation(text: string, targetLang: StudyMaterialLang): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  // Pure numbers, punctuation, symbols, URLs, or technical IDs
  if (/^[\d\s.,:%+\-–—/()[\]{}|•·#*]+$/.test(trimmed)) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^ID:\s*[A-Za-z0-9_\-:]+$/i.test(trimmed)) return true;

  const hasTamil = TAMIL_CHAR_REGEX.test(trimmed);
  const hasLatin = LATIN_WORD_REGEX.test(trimmed);

  // Already purely in target language
  if (targetLang === 'ta' && hasTamil && !hasLatin) return true;
  if (targetLang === 'en' && hasLatin && !hasTamil) return true;
  return false;
}

function splitMarkdownIntoChunks(markdown: string, maxChars = LONG_MARKDOWN_THRESHOLD): string[] {
  const normalized = markdown.replace(/\r\n/g, '\n');
  if (normalized.length <= maxChars) return [normalized];

  // Split by double newline (paragraphs / tables / heading blocks)
  const blocks = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = block;
    } else if (block.length > maxChars && !current) {
      // Single very large block (e.g. long table or list): split by single lines
      const lines = block.split('\n');
      let lineBuf = '';
      for (const line of lines) {
        const nextLine = lineBuf ? `${lineBuf}\n${line}` : line;
        if (nextLine.length > maxChars && lineBuf) {
          chunks.push(lineBuf);
          lineBuf = line;
        } else {
          lineBuf = nextLine;
        }
      }
      if (lineBuf) current = lineBuf;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

interface BatchWorkItem {
  hash: string;
  text: string;
  type: StudyMaterialContentType;
}

async function callProviderForBatch(
  provider: IAIProvider,
  items: BatchWorkItem[],
  sourceLang: StudyMaterialLang,
  targetLang: StudyMaterialLang
): Promise<{
  translated: Map<string, string>;
  failed: Set<string>;
  providerName: string;
  modelName: string | null;
}> {
  const translated = new Map<string, string>();
  const failed = new Set<string>();
  const modelName: string | null = (provider as any)?.model || null;

  const directionLabel =
    targetLang === 'ta'
      ? 'English to formal Samacheer Kalvi / TNPSC academic Tamil (தமிழ்)'
      : 'Tamil (தமிழ்) to clear, formal academic English';

  const indexedInput = items.map((item, idx) => ({
    i: idx,
    type: item.type,
    text: item.text,
  }));

  const prompt = `Translate the following TNPSC Study Materials items from ${directionLabel}.

STRICT RULES:
1. Return ONLY valid JSON matching the exact schema below. No markdown fences or extra text.
2. Preserve EVERY item index "i" accurately — translate all ${items.length} items completely without omitting or merging any item.
3. Preserve exact formatting: Markdown headings (##, ###), bullet lists (-, *), numbered lists, Markdown tables (| col |), bold (**text**), and line breaks.
4. Preserve all numbers, dates, years, percentages, formulas, chemical symbols, SI units (e.g., cm³, kg/m³, m/s², H₂O, CO₂), and standard abbreviations (TNPSC, VAO, SI, DNA, RNA, RBI, ISRO, Article 21).
5. Use accurate, natural TNPSC educational Tamil terminology (never conversational slang, never awkward literal transliteration when standard Tamil textbook terms exist).
6. For short UI labels/buttons/headings, keep the translation concise so it fits cleanly in UI buttons and badges.
7. Never translate internal codes or database IDs.

Input JSON:
${JSON.stringify({ items: indexedInput })}

Expected JSON output:
{"translations":[{"i":0,"text":"translated content here"}]}`;

  try {
    const aiResult = await provider.generateJson<{ translations?: Array<{ i: number; text: string }> }>(
      prompt,
      {
        systemPrompt:
          'You are an expert bilingual TNPSC Tamil & English Samacheer Kalvi textbook translator. Output strict valid JSON only.',
        temperature: 0.15,
        maxTokens: 7000,
        responseFormat: 'json',
        timeoutMs: AI_TIMEOUT_MS,
        retryCount: 1,
      }
    );

    const returned = Array.isArray(aiResult?.translations) ? aiResult.translations : [];
    const byIdx = new Map<number, string>();
    for (const entry of returned) {
      const idx = Number(entry?.i);
      if (Number.isInteger(idx) && typeof entry?.text === 'string' && entry.text.trim()) {
        byIdx.set(idx, entry.text.trim());
      }
    }

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const tr = byIdx.get(idx);
      if (!tr) {
        failed.add(item.hash);
        continue;
      }
      // Basic sanity check: ensure Tamil output actually contains Tamil script when translating prose to Tamil
      if (targetLang === 'ta' && LATIN_WORD_REGEX.test(item.text) && !TAMIL_CHAR_REGEX.test(tr) && item.text.length > 6) {
        failed.add(item.hash);
        continue;
      }
      translated.set(item.hash, tr);
    }

    return { translated, failed, providerName: provider.name, modelName };
  } catch (err: any) {
    if (isFatalProviderError(err)) {
      markProviderCooldown(provider.name, 5 * 60 * 1000, err?.message || 'Auth/Billing error');
    } else if (isRateLimitError(err)) {
      markProviderCooldown(provider.name, 30 * 1000, 'Rate limited');
    }

    console.warn(`[StudyMaterialsTranslation] Provider "${provider.name}" batch failed:`, {
      count: items.length,
      error: err?.message || String(err),
    });

    for (const item of items) failed.add(item.hash);
    return { translated, failed, providerName: provider.name, modelName };
  }
}

async function translateBatchWithFailover(
  providers: IAIProvider[],
  batch: BatchWorkItem[],
  sourceLang: StudyMaterialLang,
  targetLang: StudyMaterialLang
): Promise<{
  translated: Map<string, string>;
  failed: Set<string>;
  providerName: string;
  modelName: string | null;
}> {
  const combined = new Map<string, string>();
  let remaining = [...batch];
  let lastProvider: string = providers[0]?.name || 'unknown';
  let lastModel: string | null = (providers[0] as any)?.model || null;

  for (const provider of providers) {
    if (remaining.length === 0) break;
    if (isProviderInCooldown(provider.name) && providers.some((p) => !isProviderInCooldown(p.name))) {
      continue;
    }
    const outcome = await callProviderForBatch(provider, remaining, sourceLang, targetLang);
    lastProvider = outcome.providerName;
    lastModel = outcome.modelName;

    for (const [hash, text] of outcome.translated.entries()) {
      combined.set(hash, text);
    }
    remaining = remaining.filter((item) => !combined.has(item.hash));
  }

  // Split-batch recovery if a large batch partially failed
  if (remaining.length > SPLIT_BATCH_SIZE && providers.length > 0) {
    const activeProvider = providers.find((p) => !isProviderInCooldown(p.name)) || providers[0];
    const stillMissing: BatchWorkItem[] = [];
    for (let i = 0; i < remaining.length; i += SPLIT_BATCH_SIZE) {
      const subBatch = remaining.slice(i, i + SPLIT_BATCH_SIZE);
      const subOutcome = await callProviderForBatch(activeProvider, subBatch, sourceLang, targetLang);
      for (const [hash, text] of subOutcome.translated.entries()) {
        combined.set(hash, text);
      }
      for (const item of subBatch) {
        if (!combined.has(item.hash)) stillMissing.push(item);
      }
    }
    remaining = stillMissing;
  }

  return {
    translated: combined,
    failed: new Set(remaining.map((r) => r.hash)),
    providerName: lastProvider,
    modelName: lastModel,
  };
}

async function persistTranslations(
  rows: Array<{
    hash: string;
    sourceLang: StudyMaterialLang;
    targetLang: StudyMaterialLang;
    type: StudyMaterialContentType;
    sourceText: string;
    translatedText: string;
    providerName: string;
    modelName: string | null;
  }>
): Promise<void> {
  if (rows.length === 0) return;
  try {
    await ensureStudyMaterialTranslationSchema();
    for (const row of rows) {
      await pool.query(
        `INSERT INTO study_material_translations (
           content_hash, source_lang, target_lang, content_type,
           source_text, translated_text, provider, model_name,
           status, retry_count, last_error, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'approved', 0, NULL, NOW())
         ON CONFLICT (content_hash, target_lang)
         DO UPDATE SET
           translated_text = EXCLUDED.translated_text,
           provider = EXCLUDED.provider,
           model_name = EXCLUDED.model_name,
           status = 'approved',
           last_error = NULL,
           updated_at = NOW()`,
        [
          row.hash,
          row.sourceLang,
          row.targetLang,
          row.type,
          row.sourceText,
          row.translatedText,
          row.providerName,
          row.modelName,
        ]
      );
    }
  } catch (err) {
    console.warn('[StudyMaterialsTranslation] Failed to persist translations to PostgreSQL:', err);
  }
}

async function translateLongMarkdownItem(
  providers: IAIProvider[],
  item: BatchWorkItem,
  sourceLang: StudyMaterialLang,
  targetLang: StudyMaterialLang
): Promise<{ translatedText: string | null; providerName: string; modelName: string | null }> {
  const chunks = splitMarkdownIntoChunks(item.text, LONG_MARKDOWN_THRESHOLD);
  const chunkWork: BatchWorkItem[] = chunks.map((chunkText, idx) => ({
    hash: `${item.hash}_chunk_${idx}`,
    text: chunkText,
    type: 'note_markdown',
  }));

  const translatedChunks: string[] = new Array(chunks.length);
  let providerName: string = providers[0]?.name || 'unknown';
  let modelName: string | null = null;

  // Process chunks with controlled concurrency (max 3 parallel)
  for (let i = 0; i < chunkWork.length; i += MAX_CONCURRENCY) {
    const slice = chunkWork.slice(i, i + MAX_CONCURRENCY);
    const results = await Promise.all(
      slice.map((cw) => translateBatchWithFailover(providers, [cw], sourceLang, targetLang))
    );
    for (let j = 0; j < slice.length; j++) {
      const res = results[j];
      providerName = res.providerName;
      modelName = res.modelName;
      const tr = res.translated.get(slice[j].hash);
      if (!tr) {
        return { translatedText: null, providerName, modelName };
      }
      translatedChunks[i + j] = tr;
    }
  }

  return {
    translatedText: translatedChunks.join('\n\n'),
    providerName,
    modelName,
  };
}

/**
 * Main entry point for Study Materials batch translation.
 * Resolves RAM cache -> PostgreSQL cache -> parallel AI batches for missing items only.
 */
export async function translateStudyMaterialBatch(
  rawItems: StudyMaterialTranslationInputItem[],
  options: {
    targetLang: StudyMaterialLang;
    sourceLang?: StudyMaterialLang;
  }
): Promise<StudyMaterialTranslationResult> {
  const targetLang: StudyMaterialLang = options.targetLang === 'en' ? 'en' : 'ta';
  const sourceLang: StudyMaterialLang = options.sourceLang || (targetLang === 'ta' ? 'en' : 'ta');

  const items = rawItems.slice(0, MAX_ITEMS_PER_REQUEST);
  const translations: Record<string, string> = {};
  const failedKeys: string[] = [];

  let memoryHits = 0;
  let dbHits = 0;
  let aiTranslated = 0;
  let skipped = 0;

  // Map unique contentHash -> { workItem, keys[] }
  const pendingByHash = new Map<string, { work: BatchWorkItem; keys: string[] }>();

  for (const item of items) {
    const key = String(item?.key ?? '').trim();
    const text = String(item?.text ?? '');
    if (!key) continue;

    if (shouldSkipTranslation(text, targetLang)) {
      translations[key] = text;
      skipped++;
      continue;
    }

    const hash = computeContentHash(text, sourceLang, targetLang);
    const cacheKey = `${targetLang}:${hash}`;
    const memHit = getMemoryCached(cacheKey);
    if (memHit !== null) {
      translations[key] = memHit;
      memoryHits++;
      continue;
    }

    const existing = pendingByHash.get(hash);
    if (existing) {
      existing.keys.push(key);
    } else {
      pendingByHash.set(hash, {
        work: {
          hash,
          text: text.replace(/\r\n/g, '\n').trim(),
          type: item.type || 'syllabus',
        },
        keys: [key],
      });
    }
  }

  // Step 2: Batch lookup in PostgreSQL persistent cache
  if (pendingByHash.size > 0) {
    try {
      await ensureStudyMaterialTranslationSchema();
      const hashes = Array.from(pendingByHash.keys());
      const dbRes = await pool.query(
        `SELECT content_hash, translated_text
         FROM study_material_translations
         WHERE target_lang = $1 AND status = 'approved' AND content_hash = ANY($2::varchar[])`,
        [targetLang, hashes]
      );

      for (const row of dbRes.rows) {
        const hash = String(row.content_hash);
        const translatedText = String(row.translated_text);
        const entry = pendingByHash.get(hash);
        if (entry && translatedText) {
          setMemoryCached(`${targetLang}:${hash}`, translatedText);
          for (const k of entry.keys) {
            translations[k] = translatedText;
            dbHits++;
          }
          pendingByHash.delete(hash);
        }
      }
    } catch (err) {
      console.warn('[StudyMaterialsTranslation] DB cache lookup error (continuing with AI):', err);
    }
  }

  // Step 3: Wait for any in-flight translations for remaining hashes
  const toTranslate: Array<{ work: BatchWorkItem; keys: string[] }> = [];
  const awaitedPromises: Array<Promise<void>> = [];

  for (const [hash, entry] of pendingByHash.entries()) {
    const cacheKey = `${targetLang}:${hash}`;
    const existingFlight = inFlightRequests.get(cacheKey);
    if (existingFlight) {
      awaitedPromises.push(
        existingFlight.then((resText) => {
          if (resText) {
            for (const k of entry.keys) {
              translations[k] = resText;
              memoryHits++;
            }
          } else {
            for (const k of entry.keys) failedKeys.push(k);
          }
        })
      );
    } else {
      toTranslate.push(entry);
    }
  }

  // Step 4: Translate truly missing items via AI providers
  if (toTranslate.length > 0) {
    const providers = await getOrderedConfiguredProviders();
    if (providers.length === 0) {
      for (const entry of toTranslate) {
        for (const k of entry.keys) failedKeys.push(k);
      }
    } else {
      // Register deferred resolvers for in-flight deduplication
      const resolvers = new Map<string, (val: string | null) => void>();
      for (const entry of toTranslate) {
        const cacheKey = `${targetLang}:${entry.work.hash}`;
        const p = new Promise<string | null>((resolve) => {
          resolvers.set(cacheKey, resolve);
        });
        inFlightRequests.set(cacheKey, p);
      }

      const shortEntries = toTranslate.filter((e) => e.work.text.length <= LONG_MARKDOWN_THRESHOLD);
      const longEntries = toTranslate.filter((e) => e.work.text.length > LONG_MARKDOWN_THRESHOLD);
      const rowsToPersist: Array<{
        hash: string;
        sourceLang: StudyMaterialLang;
        targetLang: StudyMaterialLang;
        type: StudyMaterialContentType;
        sourceText: string;
        translatedText: string;
        providerName: string;
        modelName: string | null;
      }> = [];

      try {
        // 4a. Process short items in parallel batches (concurrency = MAX_CONCURRENCY)
        const shortBatches: Array<Array<{ work: BatchWorkItem; keys: string[] }>> = [];
        for (let i = 0; i < shortEntries.length; i += SHORT_BATCH_SIZE) {
          shortBatches.push(shortEntries.slice(i, i + SHORT_BATCH_SIZE));
        }

        for (let i = 0; i < shortBatches.length; i += MAX_CONCURRENCY) {
          const wave = shortBatches.slice(i, i + MAX_CONCURRENCY);
          const waveResults = await Promise.all(
            wave.map((b) =>
              translateBatchWithFailover(
                providers,
                b.map((e) => e.work),
                sourceLang,
                targetLang
              )
            )
          );

          for (let w = 0; w < wave.length; w++) {
            const batchEntries = wave[w];
            const res = waveResults[w];
            for (const entry of batchEntries) {
              const tr = res.translated.get(entry.work.hash);
              const cacheKey = `${targetLang}:${entry.work.hash}`;
              if (tr) {
                setMemoryCached(cacheKey, tr);
                for (const k of entry.keys) {
                  translations[k] = tr;
                  aiTranslated++;
                }
                rowsToPersist.push({
                  hash: entry.work.hash,
                  sourceLang,
                  targetLang,
                  type: entry.work.type,
                  sourceText: entry.work.text,
                  translatedText: tr,
                  providerName: res.providerName,
                  modelName: res.modelName,
                });
                resolvers.get(cacheKey)?.(tr);
              } else {
                for (const k of entry.keys) failedKeys.push(k);
                resolvers.get(cacheKey)?.(null);
              }
              inFlightRequests.delete(cacheKey);
            }
          }
        }

        // 4b. Process long markdown/textbook chapters sequentially with internal chunk parallelism
        for (const entry of longEntries) {
          const cacheKey = `${targetLang}:${entry.work.hash}`;
          const longRes = await translateLongMarkdownItem(providers, entry.work, sourceLang, targetLang);
          if (longRes.translatedText) {
            setMemoryCached(cacheKey, longRes.translatedText);
            for (const k of entry.keys) {
              translations[k] = longRes.translatedText;
              aiTranslated++;
            }
            rowsToPersist.push({
              hash: entry.work.hash,
              sourceLang,
              targetLang,
              type: 'note_markdown',
              sourceText: entry.work.text,
              translatedText: longRes.translatedText,
              providerName: longRes.providerName,
              modelName: longRes.modelName,
            });
            resolvers.get(cacheKey)?.(longRes.translatedText);
          } else {
            for (const k of entry.keys) failedKeys.push(k);
            resolvers.get(cacheKey)?.(null);
          }
          inFlightRequests.delete(cacheKey);
        }

        // Persist all newly translated rows to PostgreSQL
        if (rowsToPersist.length > 0) {
          await persistTranslations(rowsToPersist);
        }
      } finally {
        // Ensure no dangling in-flight promises
        for (const entry of toTranslate) {
          const cacheKey = `${targetLang}:${entry.work.hash}`;
          if (inFlightRequests.has(cacheKey)) {
            resolvers.get(cacheKey)?.(null);
            inFlightRequests.delete(cacheKey);
          }
        }
      }
    }
  }

  if (awaitedPromises.length > 0) {
    await Promise.all(awaitedPromises);
  }

  return {
    translations,
    failedKeys,
    stats: {
      total: items.length,
      memoryHits,
      dbHits,
      aiTranslated,
      skipped,
      failed: failedKeys.length,
    },
  };
}
