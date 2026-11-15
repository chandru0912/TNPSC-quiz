import pool from '../db';
import { AIProviderFactory } from './ai/ai-provider.factory';

export interface TranslatableQuestion {
  id: number;
  subject?: string;
  question: string;
  options: string[];
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  explanation: string;
  tag?: string;
}

export interface TranslatedQuestionPayload {
  questionId: number;
  language: 'en' | 'ta';
  question: string;
  options: string[];
  explanation: string;
  tag?: string | null;
  cached: boolean;
}

const TAMIL_CHAR_REGEX = /[\u0B80-\u0BFF]/g;

/**
 * Returns true if the text is already predominantly in Tamil script.
 */
function isPredominantlyTamil(text: string): boolean {
  if (!text) return false;
  const tamilMatches = text.match(TAMIL_CHAR_REGEX);
  const tamilCount = tamilMatches ? tamilMatches.length : 0;
  const nonSpaceLen = text.replace(/\s+/g, '').length;
  return nonSpaceLen > 0 && tamilCount / nonSpaceLen > 0.35;
}

/**
 * Returns true if a question should NOT be auto-translated (e.g. General Tamil / Pothu Tamil).
 */
function isExemptFromTranslation(subject?: string, questionText?: string): boolean {
  const cleanSubj = (subject || '').toLowerCase().trim();
  if (cleanSubj.includes('general tamil') || cleanSubj.includes('pothu tamil') || cleanSubj === 'tamil') {
    return true;
  }
  if (questionText && isPredominantlyTamil(questionText)) {
    return true;
  }
  return false;
}

/**
 * Overlays cached, approved translations from PostgreSQL onto an array of QuestionDTOs.
 * Never alters question IDs, correctAnswer indices, or duplicates rows.
 */
export async function applyCachedTranslations<T extends TranslatableQuestion>(
  questions: T[],
  targetLanguage: 'en' | 'ta'
): Promise<T[]> {
  if (targetLanguage !== 'ta' || questions.length === 0) {
    return questions;
  }

  const ids = questions.map((q) => q.id).filter((id) => Number.isFinite(id) && id > 0);
  if (ids.length === 0) {
    return questions;
  }

  try {
    const res = await pool.query(
      `SELECT question_id, question_text, options, explanation, tag
       FROM question_translations
       WHERE question_id = ANY($1::int[])
         AND language = $2
         AND approved = TRUE`,
      [ids, targetLanguage]
    );

    if (res.rows.length === 0) {
      return questions;
    }

    const cacheMap = new Map<number, any>();
    for (const row of res.rows) {
      cacheMap.set(Number(row.question_id), row);
    }

    return questions.map((q) => {
      const cached = cacheMap.get(q.id);
      if (!cached) return q;

      const parsedOptions = Array.isArray(cached.options)
        ? cached.options
        : typeof cached.options === 'string'
          ? JSON.parse(cached.options)
          : q.options;

      if (!Array.isArray(parsedOptions) || parsedOptions.length !== q.options.length) {
        return q;
      }

      return {
        ...q,
        question: cached.question_text || q.question,
        options: parsedOptions,
        optionA: parsedOptions[0] ?? q.optionA,
        optionB: parsedOptions[1] ?? q.optionB,
        optionC: parsedOptions[2] ?? q.optionC,
        optionD: parsedOptions[3] ?? q.optionD,
        explanation: cached.explanation ?? q.explanation,
        tag: cached.tag || q.tag,
      };
    });
  } catch (err: any) {
    console.warn('[QuestionTranslation] Failed to load cached translations:', err.message);
    return questions;
  }
}

/**
 * Translates requested question IDs into targetLanguage ('ta') using the active AI provider,
 * reusing existing approved DB cache first and storing new translations for future reuse.
 * Preserves question IDs and option ordering (so correctAnswer index never changes).
 */
export async function translateAndCacheQuestions(
  questionIds: number[],
  targetLanguage: 'en' | 'ta'
): Promise<TranslatedQuestionPayload[]> {
  const cleanIds = Array.from(
    new Set(questionIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))
  ).slice(0, 30);

  if (cleanIds.length === 0) {
    return [];
  }

  const qRes = await pool.query(
    `SELECT id, subject, question_text, options, option_a, option_b, option_c, option_d, explanation, tag
     FROM questions
     WHERE id = ANY($1::int[])`,
    [cleanIds]
  );

  if (qRes.rows.length === 0) {
    return [];
  }

  if (targetLanguage === 'en') {
    return qRes.rows.map((row) => {
      const opts = Array.isArray(row.options)
        ? row.options
        : typeof row.options === 'string'
          ? JSON.parse(row.options)
          : [row.option_a, row.option_b, row.option_c, row.option_d].filter(Boolean);
      return {
        questionId: row.id,
        language: 'en',
        question: row.question_text,
        options: opts,
        explanation: row.explanation || '',
        tag: row.tag || null,
        cached: true,
      };
    });
  }

  // 1. Check PostgreSQL cache first
  const cachedRes = await pool.query(
    `SELECT question_id, question_text, options, explanation, tag
     FROM question_translations
     WHERE question_id = ANY($1::int[])
       AND language = 'ta'
       AND approved = TRUE`,
    [cleanIds]
  );

  const resultsMap = new Map<number, TranslatedQuestionPayload>();
  for (const row of cachedRes.rows) {
    const opts = Array.isArray(row.options)
      ? row.options
      : typeof row.options === 'string'
        ? JSON.parse(row.options)
        : [];
    resultsMap.set(Number(row.question_id), {
      questionId: Number(row.question_id),
      language: 'ta',
      question: row.question_text,
      options: opts,
      explanation: row.explanation || '',
      tag: row.tag || null,
      cached: true,
    });
  }

  // 2. Partition remaining uncached questions
  const toTranslate: Array<{
    id: number;
    question: string;
    options: string[];
    explanation: string;
  }> = [];

  for (const row of qRes.rows) {
    if (resultsMap.has(row.id)) continue;

    const opts: string[] = Array.isArray(row.options)
      ? row.options
      : typeof row.options === 'string'
        ? JSON.parse(row.options)
        : [row.option_a, row.option_b, row.option_c, row.option_d].filter(Boolean);

    if (isExemptFromTranslation(row.subject, row.question_text)) {
      resultsMap.set(row.id, {
        questionId: row.id,
        language: 'ta',
        question: row.question_text,
        options: opts,
        explanation: row.explanation || '',
        tag: row.tag || null,
        cached: true,
      });
      continue;
    }

    toTranslate.push({
      id: row.id,
      question: row.question_text,
      options: opts,
      explanation: row.explanation || '',
    });
  }

  // 3. Translate uncached questions via active AI provider in batches of 10
  if (toTranslate.length > 0) {
    let provider;
    try {
      provider = await AIProviderFactory.getActiveProvider();
      if (!provider.isConfigured()) {
        provider = null;
      }
    } catch {
      provider = null;
    }

    if (provider) {
      const BATCH_SIZE = 10;
      for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
        const batch = toTranslate.slice(i, i + BATCH_SIZE);
        try {
          const prompt = `Translate the following TNPSC competitive exam multiple-choice questions from English into natural, formal academic Tamil (சமச்சீர் கல்வி / TNPSC standard).

STRICT RULES:
1. Return ONLY a JSON object with a "translations" array.
2. Preserve each item's exact "id" number.
3. Preserve the EXACT order and count of "options" (do NOT shuffle or reorder options, so the correct answer index remains identical).
4. Keep scientific symbols, mathematical formulas, SI units, numbers, years, constitutional articles, and standard abbreviations accurate.
5. Use formal academic Tamil educational terminology consistent with Samacheer Kalvi textbooks.
6. Translate "question", every item in "options", and "explanation".

Input JSON:
${JSON.stringify(batch)}

Expected JSON format:
{
  "translations": [
    {
      "id": 123,
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "explanation": "..."
    }
  ]
}`;

          const aiResult = await provider.generateJson<{
            translations?: Array<{
              id: number;
              question: string;
              options: string[];
              explanation?: string;
            }>;
          }>(prompt, {
            systemPrompt: 'You are an expert bilingual TNPSC Tamil translator. Output strict valid JSON only.',
            temperature: 0.2,
            maxTokens: 4000,
            responseFormat: 'json',
            timeoutMs: 25000,
          });

          const translatedList = Array.isArray(aiResult?.translations) ? aiResult.translations : [];
          for (const t of translatedList) {
            const orig = batch.find((b) => b.id === Number(t.id));
            if (!orig) continue;
            if (!t.question || !Array.isArray(t.options) || t.options.length !== orig.options.length) {
              continue;
            }

            const cleanOptions = t.options.map((o, idx) => String(o || orig.options[idx] || '').trim());
            const cleanQuestion = String(t.question).trim();
            const cleanExplanation = String(t.explanation || orig.explanation || '').trim();

            await pool.query(
              `INSERT INTO question_translations (
                 question_id, language, question_text, options, explanation, approved, provider, updated_at
               ) VALUES ($1, 'ta', $2, $3::jsonb, $4, TRUE, $5, CURRENT_TIMESTAMP)
               ON CONFLICT (question_id, language) DO UPDATE SET
                 question_text = EXCLUDED.question_text,
                 options = EXCLUDED.options,
                 explanation = EXCLUDED.explanation,
                 provider = EXCLUDED.provider,
                 updated_at = CURRENT_TIMESTAMP`,
              [orig.id, cleanQuestion, JSON.stringify(cleanOptions), cleanExplanation, provider.name]
            );

            resultsMap.set(orig.id, {
              questionId: orig.id,
              language: 'ta',
              question: cleanQuestion,
              options: cleanOptions,
              explanation: cleanExplanation,
              cached: false,
            });
          }
        } catch (batchErr: any) {
          console.warn('[QuestionTranslation] AI batch translation skipped/failed:', batchErr.message);
        }
      }
    }
  }

  return cleanIds
    .map((id) => resultsMap.get(id))
    .filter((item): item is TranslatedQuestionPayload => Boolean(item));
}
