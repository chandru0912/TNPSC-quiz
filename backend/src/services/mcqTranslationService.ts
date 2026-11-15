import crypto from 'crypto';
import pool from '../db';
import { AIProviderFactory } from './ai/ai-provider.factory';
import { IAIProvider } from './ai/ai-provider.interface';

/**
 * Independent English -> Tamil display translation for Study Materials MCQs.
 * The original `questions` row is the single canonical question bank.
 * This service only reads it and stores a validated, versioned Tamil display copy.
 */

const TARGET_LANGUAGE = 'ta';
// Batching 5 keeps each AI response well under the provider output-token cap:
// explanation-rich MCQs truncate JSON at 10 per call, which fails validation.
const AI_BATCH_SIZE = 5;
export const MAX_TRANSLATION_IDS = 100;

const TAMIL_CHAR_REGEX = /[\u0B80-\u0BFF]/;
const LATIN_LETTER_REGEX = /[A-Za-z]/;
const NUMBER_TOKEN_REGEX = /\d+(?:[.,]\d+)?/g;

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
  failures: McqTranslationFailure[];
}

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

function missingNumberTokens(source: string, translated: string): string[] {
  const sourceTokens = source.match(NUMBER_TOKEN_REGEX) || [];
  const translatedTokens = new Set(translated.match(NUMBER_TOKEN_REGEX) || []);
  return Array.from(new Set(sourceTokens)).filter((token) => !translatedTokens.has(token));
}

/**
 * A translation is accepted only when it preserves the option count/order,
 * contains Tamil text, and keeps every numeric token from the English source.
 * Correct answer identity is never part of the payload, so its index cannot change.
 */
function validateTranslation(source: SourceQuestion, raw: RawTranslation): string | null {
  if (Number(raw?.id) !== source.id) return 'Translation ID mismatch.';
  const question = String(raw?.question ?? '').trim();
  if (!question) return 'Translated question is empty.';
  if (LATIN_LETTER_REGEX.test(source.question) && !hasTamil(question)) {
    return 'Translated question is not in Tamil.';
  }
  if (missingNumberTokens(source.question, question).length > 0) {
    return 'Translated question does not preserve numeric values.';
  }

  if (!Array.isArray(raw.options) || raw.options.length !== 4) {
    return 'Translated options must contain exactly four items.';
  }
  const options = raw.options.map((opt) => String(opt ?? '').trim());
  if (options.some((opt) => !opt)) return 'One or more translated options are empty.';

  const sourceOptionsHaveLetters = source.options.some((opt) => LATIN_LETTER_REGEX.test(opt));
  if (sourceOptionsHaveLetters && !options.some((opt) => hasTamil(opt))) {
    return 'Translated options are not in Tamil.';
  }
  for (let i = 0; i < 4; i++) {
    if (missingNumberTokens(source.options[i], options[i]).length > 0) {
      return `Translated option ${String.fromCharCode(65 + i)} does not preserve numeric values.`;
    }
  }

  const explanation = String(raw.explanation ?? '').trim();
  if (source.explanation && !explanation) return 'Translated explanation is empty.';
  if (source.explanation && LATIN_LETTER_REGEX.test(source.explanation) && explanation && !hasTamil(explanation)) {
    return 'Translated explanation is not in Tamil.';
  }
  return null;
}

function toRawTranslation(row: {
  translated_question: string;
  translated_option_a: string;
  translated_option_b: string;
  translated_option_c: string;
  translated_option_d: string;
  translated_explanation: string;
}, id: number): RawTranslation {
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

async function resolveConfiguredProvider(): Promise<IAIProvider> {
  const active = await AIProviderFactory.getActiveProvider();
  if (active.isConfigured()) return active;

  for (const name of ['gemini', 'claude', 'openai']) {
    const provider = AIProviderFactory.getProvider(name);
    if (provider.isConfigured()) return provider;
  }
  throw new Error('No AI provider is configured for MCQ translation.');
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

interface BatchOutcome {
  translations: Map<number, RawTranslation>;
  failed: Map<number, string>;
  rateLimited: boolean;
}

async function callProvider(provider: IAIProvider, sources: SourceQuestion[]): Promise<BatchOutcome> {
  const translations = new Map<number, RawTranslation>();
  const failed = new Map<number, string>();
  if (sources.length === 0) return { translations, failed, rateLimited: false };

  const input = sources.map((source) => ({
    id: source.id,
    subject: source.subject,
    lesson: source.lessonTitle,
    question: source.question,
    options: source.options,
    explanation: source.explanation,
  }));

  const prompt = `Translate these TNPSC Study Materials multiple-choice questions from English into formal academic Tamil (Samacheer Kalvi / TNPSC standard).

STRICT RULES:
1. Return ONLY a JSON object with a "translations" array.
2. Keep each item's exact "id" and the original question order.
3. Return exactly 4 "options" per question, in the SAME A, B, C, D order. Never reorder, add, remove, or merge options.
4. Translate the question, all four options, and the full explanation into Tamil. Preserve the explanation's section meaning and line breaks (Approach, Step-by-step Solution, Correct Option, Why Other Options Are Incorrect, Textbook Source Reference).
5. Preserve every number, formula, symbol, SI unit, year, article number, and mathematical expression exactly (e.g. 9.8 m/s², H₂O, Article 21, 1947).
6. Keep standard scientific abbreviations in their standard form when used by Tamil textbooks (e.g. SI, DNA, RNA, ATP).
7. Use formal textbook Tamil, not conversational Tamil. Do not add commentary or answers that are not in the source.

Input JSON:
${JSON.stringify({ questions: input })}

Expected JSON format:
{
  "translations": [
    {
      "id": 123,
      "question": "தமிழ் கேள்வி",
      "options": ["...", "...", "...", "..."],
      "explanation": "தமிழ் விளக்கம்"
    }
  ]
}`;

  try {
    const aiResult = await provider.generateJson<{ translations?: RawTranslation[] }>(prompt, {
      systemPrompt: 'You are an expert bilingual TNPSC Tamil translator. Output strict valid JSON only.',
      temperature: 0.2,
      maxTokens: 6000,
      responseFormat: 'json',
      timeoutMs: 45000,
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
  } catch (err: any) {
    const rateLimited = isRateLimitError(err);
    const message = rateLimited
      ? 'Translation service is rate limited. Please retry shortly.'
      : 'Translation service is temporarily unavailable.';
    console.warn('[McqTranslation] AI batch translation failed:', {
      questionIds: sources.map((source) => source.id),
      error: err?.message || String(err),
    });
    for (const source of sources) failed.set(source.id, message);
    return { translations, failed, rateLimited };
  }

  return { translations, failed, rateLimited: false };
}

async function saveTranslations(
  providerName: string,
  sources: Map<number, SourceQuestion>,
  translations: Map<number, RawTranslation>
): Promise<void> {
  for (const [id, translation] of translations) {
    const source = sources.get(id);
    if (!source) continue;
    try {
      await pool.query(
        `INSERT INTO mcq_question_translations (
           question_id, translation_language,
           translated_question, translated_option_a, translated_option_b,
           translated_option_c, translated_option_d, translated_explanation,
           source_content_hash, translation_status, provider, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved', $10, CURRENT_TIMESTAMP)
         ON CONFLICT (question_id, translation_language) DO UPDATE SET
           translated_question = EXCLUDED.translated_question,
           translated_option_a = EXCLUDED.translated_option_a,
           translated_option_b = EXCLUDED.translated_option_b,
           translated_option_c = EXCLUDED.translated_option_c,
           translated_option_d = EXCLUDED.translated_option_d,
           translated_explanation = EXCLUDED.translated_explanation,
           source_content_hash = EXCLUDED.source_content_hash,
           translation_status = 'approved',
           provider = EXCLUDED.provider,
           updated_at = CURRENT_TIMESTAMP
         WHERE mcq_question_translations.source_content_hash <> EXCLUDED.source_content_hash`,
        [
          id,
          TARGET_LANGUAGE,
          translation.question,
          translation.options[0],
          translation.options[1],
          translation.options[2],
          translation.options[3],
          translation.explanation,
          source.contentHash,
          providerName,
        ]
      );
    } catch (err: any) {
      // The validated translation is still returned for this session; it will be retried on the next request.
      console.warn('[McqTranslation] Failed to cache translation:', {
        questionId: id,
        error: err?.message || String(err),
      });
    }
  }
}

export function normalizeQuestionIds(rawIds: unknown): number[] {
  if (!Array.isArray(rawIds)) return [];
  const ids = rawIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  return Array.from(new Set(ids)).slice(0, MAX_TRANSLATION_IDS);
}

export async function translateStudyMaterialQuestions(rawIds: unknown): Promise<McqTranslationResult> {
  const ids = normalizeQuestionIds(rawIds);
  if (ids.length === 0) return { translations: [], failures: [] };

  const sourceResult = await pool.query<SourceQuestionRow>(
    `SELECT id, subject, lesson_title, question_text, options,
            option_a, option_b, option_c, option_d, explanation
     FROM questions
     WHERE id = ANY($1::int[])
       AND target_system = 'study_materials'
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
      failures.set(id, 'Question is not an available published Study Materials question.');
    }
  }

  const availableSources = ids
    .map((id) => sourcesById.get(id))
    .filter((source): source is SourceQuestion => Boolean(source));

  if (availableSources.length > 0) {
    const cachedResult = await pool.query(
      `SELECT question_id, translated_question, translated_option_a, translated_option_b,
              translated_option_c, translated_option_d, translated_explanation, source_content_hash
       FROM mcq_question_translations
       WHERE question_id = ANY($1::int[])
         AND translation_language = $2
         AND translation_status = 'approved'`,
      [availableSources.map((source) => source.id), TARGET_LANGUAGE]
    );

    for (const row of cachedResult.rows) {
      const id = Number(row.question_id);
      const source = sourcesById.get(id);
      if (!source || row.source_content_hash !== source.contentHash) continue;
      const raw = toRawTranslation(row, id);
      if (validateTranslation(source, raw)) continue;
      translations.set(id, {
        questionId: id,
        question: raw.question,
        options: [raw.options[0], raw.options[1], raw.options[2], raw.options[3]],
        explanation: raw.explanation,
        cached: true,
      });
    }
  }

  const pending = availableSources.filter((source) => !translations.has(source.id));
  if (pending.length > 0) {
    let provider: IAIProvider | null = null;
    try {
      provider = await resolveConfiguredProvider();
    } catch (err: any) {
      console.warn('[McqTranslation] Provider resolution failed:', err?.message || String(err));
    }

    if (!provider) {
      for (const source of pending) {
        failures.set(source.id, 'Translation service is not configured. Please retry later.');
      }
    } else {
      for (let offset = 0; offset < pending.length; offset += AI_BATCH_SIZE) {
        const batch = pending.slice(offset, offset + AI_BATCH_SIZE);
        let outcome = await callProvider(provider, batch);

        const retrySources = batch.filter((source) => !outcome.translations.has(source.id));
        if (retrySources.length > 0 && !outcome.rateLimited) {
          const retryOutcome = await callProvider(provider, retrySources);
          for (const [id, raw] of retryOutcome.translations) outcome.translations.set(id, raw);
          outcome = { ...outcome, failed: retryOutcome.failed, rateLimited: retryOutcome.rateLimited };
        }

        for (const [id, raw] of outcome.translations) {
          const source = sourcesById.get(id);
          if (!source) continue;
          translations.set(id, {
            questionId: id,
            question: raw.question,
            options: [raw.options[0], raw.options[1], raw.options[2], raw.options[3]],
            explanation: raw.explanation,
            cached: false,
          });
        }

        await saveTranslations(provider.name, sourcesById, outcome.translations);

        for (const [id, message] of outcome.failed) {
          if (!outcome.translations.has(id)) failures.set(id, message);
        }
        for (const source of batch) {
          if (!translations.has(source.id) && !failures.has(source.id)) {
            failures.set(source.id, 'Translation could not be validated.');
          }
        }

        if (outcome.rateLimited) {
          for (const source of pending.slice(offset + AI_BATCH_SIZE)) {
            failures.set(source.id, 'Translation service is rate limited. Please retry shortly.');
          }
          break;
        }
      }
    }
  }

  // Preserve the requested question order, same as the canonical question bank.
  return {
    translations: ids
      .map((id) => translations.get(id))
      .filter((item): item is McqTranslationPayload => Boolean(item)),
    failures: ids
      .filter((id) => failures.has(id) && !translations.has(id))
      .map((id) => ({ questionId: id, message: failures.get(id) || 'Translation unavailable.' })),
  };
}
