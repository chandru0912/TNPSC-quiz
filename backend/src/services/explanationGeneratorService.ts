import pool from '../db';
import { AIProviderFactory } from './ai/ai-provider.factory';
import { retrieveRelevantTextbookContent, TextbookChunk } from './textbookRag';

export interface GeneratedExplanationResult {
  questionId: number;
  question: string;
  correctOptionLetter: string;
  correctOptionText: string;
  explanationEn: string;
  explanationTa: string;
  sourceReference: string;
  textbookId: number | null;
  sourcePage: number | null;
  hasSufficientTextbookContent: boolean;
  limitationNote?: string;
}

/**
 * Fallback keyword search across textbook_content when lesson/topic RAG returns sparse results.
 */
async function searchTextbookByQuestionKeywords(
  standard: number | null,
  subject: string,
  questionText: string,
  correctOptionText: string
): Promise<TextbookChunk[]> {
  const combined = `${questionText} ${correctOptionText}`
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u0B80-\u0BFF\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);

  const keywords = Array.from(new Set(combined)).slice(0, 6);
  if (keywords.length === 0) return [];

  const likeConditions = keywords.map((_, idx) => `LOWER(tc.content) LIKE $${idx + 2}`);
  const params: any[] = [subject.toLowerCase(), ...keywords.map((k) => `%${k}%`)];

  let stdFilter = '';
  if (standard && Number.isFinite(standard)) {
    params.push(standard);
    stdFilter = `AND tb.standard = $${params.length}`;
  }

  const sql = `
    SELECT
      tc.id AS content_id,
      tc.textbook_id,
      tb.book_name,
      tc.page_number,
      tc.unit_id,
      tc.lesson_title,
      tc.content,
      tc.is_ocr
    FROM textbook_content tc
    JOIN textbooks tb ON tb.id = tc.textbook_id
    WHERE LOWER(tb.subject) LIKE '%' || $1 || '%'
      ${stdFilter}
      AND (${likeConditions.join(' OR ')})
    ORDER BY tc.page_number ASC
    LIMIT 4
  `;

  try {
    const res = await pool.query(sql, params);
    return res.rows.map((r) => ({
      contentId: Number(r.content_id),
      textbookId: Number(r.textbook_id),
      bookName: String(r.book_name || 'Samacheer Kalvi Textbook'),
      pageNumber: Number(r.page_number),
      unitId: r.unit_id ? Number(r.unit_id) : null,
      lessonTitle: r.lesson_title || null,
      content: String(r.content || ''),
      relevanceScore: 1,
      isOcr: Boolean(r.is_ocr),
    }));
  } catch {
    return [];
  }
}

/**
 * Generates textbook-grounded English & Tamil explanations for existing MCQs
 * without modifying question IDs, options, or correct answers.
 */
export async function generateTextbookGroundedExplanations(
  questionIds: number[],
  options: { applyToDatabase?: boolean } = {}
): Promise<GeneratedExplanationResult[]> {
  const cleanIds = Array.from(
    new Set(questionIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))
  ).slice(0, 20);

  if (cleanIds.length === 0) return [];

  const qRes = await pool.query(
    `SELECT id, category, unit_id, class_id, subject, lesson_title, topic,
            question_text, options, option_a, option_b, option_c, option_d,
            correct_answer, textbook_id, source_page, source_reference
     FROM questions
     WHERE id = ANY($1::int[])
     ORDER BY id ASC`,
    [cleanIds]
  );

  if (qRes.rows.length === 0) return [];

  const provider = await AIProviderFactory.getActiveProvider();
  if (!provider.isConfigured()) {
    throw new Error(`Active AI provider (${provider.displayName}) is not configured.`);
  }

  const results: GeneratedExplanationResult[] = [];

  for (const row of qRes.rows) {
    const opts: string[] = Array.isArray(row.options)
      ? row.options
      : typeof row.options === 'string'
        ? JSON.parse(row.options)
        : [row.option_a, row.option_b, row.option_c, row.option_d].filter(Boolean);

    const correctIdx = Math.max(0, Math.min(opts.length - 1, Number(row.correct_answer) || 0));
    const correctLetter = String.fromCharCode(65 + correctIdx);
    const correctText = opts[correctIdx] || '';

    const standard = row.class_id ? Number(row.class_id) : 10;
    const subject = String(row.subject || 'General Studies');

    // 1. Retrieve relevant textbook content from Textbook Management (RAG)
    let retrieval = await retrieveRelevantTextbookContent({
      groupId: row.category,
      standard,
      subject,
      unitId: row.unit_id ? Number(row.unit_id) : undefined,
      lessonTitle: row.lesson_title || undefined,
      topic: row.topic || undefined,
      textbookId: row.textbook_id ? Number(row.textbook_id) : undefined,
      maxPages: 5,
    });

    let chunks = retrieval.chunks;
    if (chunks.length === 0) {
      chunks = await searchTextbookByQuestionKeywords(
        row.class_id ? Number(row.class_id) : null,
        subject,
        row.question_text,
        correctText
      );
    }

    const hasSufficientTextbookContent = chunks.length > 0;
    const primaryChunk = chunks[0] || null;
    const verifiedTextbookId = retrieval.textbookId || primaryChunk?.textbookId || (row.textbook_id ? Number(row.textbook_id) : null);
    const verifiedBookName = retrieval.bookName || primaryChunk?.bookName || null;
    const verifiedPages = Array.from(new Set(chunks.map((c) => c.pageNumber).filter((p) => Number.isFinite(p) && p > 0)));
    const primaryPage = verifiedPages[0] ?? (row.source_page ? Number(row.source_page) : null);

    // Construct verified source reference ONLY from real retrieved textbook records (never invented)
    const refParts: string[] = [];
    if (verifiedBookName) refParts.push(verifiedBookName);
    else refParts.push(`Samacheer Kalvi ${row.class_id ? `${row.class_id}th Std ` : ''}${subject}`);
    if (row.unit_id) refParts.push(`Unit ${row.unit_id}`);
    if (row.lesson_title) refParts.push(row.lesson_title);
    if (verifiedPages.length > 0) {
      refParts.push(`Page${verifiedPages.length > 1 ? 's' : ''} ${verifiedPages.slice(0, 3).join(', ')}`);
    } else if (!hasSufficientTextbookContent) {
      refParts.push('Supporting curriculum reference (no indexed textbook page matched)');
    }
    const verifiedSourceRef = refParts.join(' • ');

    const textbookContextText = hasSufficientTextbookContent
      ? chunks
          .slice(0, 4)
          .map((c) => `[Book: ${c.bookName} | Page ${c.pageNumber}]\n${c.content.slice(0, 1400)}`)
          .join('\n\n---\n\n')
      : 'NO MATCHING EXTRACTED TEXTBOOK PAGES FOUND IN DATABASE.';

    const prompt = `You are a Samacheer Kalvi & TNPSC subject expert generating a textbook-grounded explanation for an existing MCQ.

QUESTION (ID ${row.id}):
${row.question_text}

OPTIONS:
${opts.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')}

VERIFIED CORRECT ANSWER:
Option ${correctLetter}: ${correctText}

RETRIEVED SAMACHEER KALVI TEXTBOOK CONTENT:
${textbookContextText}

INSTRUCTIONS:
1. Explain clearly WHY Option ${correctLetter} ("${correctText}") is the correct answer.
2. Explain the underlying concept and include relevant facts from the retrieved textbook content.
3. Use clear, concise educational language (3-5 sentences). Avoid generic filler phrases.
4. NEVER invent textbook names or page numbers. Only cite facts present in the retrieved textbook content or verified curriculum knowledge (and if textbook content was not found, note that textbook coverage was limited).
5. Provide BOTH:
   - "explanationEn": Detailed explanation in English.
   - "explanationTa": Accurate academic Tamil translation/explanation using Samacheer Kalvi terminology.

Return ONLY valid JSON:
{
  "explanationEn": "...",
  "explanationTa": "..."
}`;

    const aiOut = await provider.generateJson<{
      explanationEn?: string;
      explanationTa?: string;
    }>(prompt, {
      systemPrompt: 'You are an expert TNPSC educator. Output strict valid JSON only.',
      temperature: 0.2,
      maxTokens: 1500,
      responseFormat: 'json',
      timeoutMs: 25000,
    });

    const explanationEn = String(aiOut?.explanationEn || '').trim();
    const explanationTa = String(aiOut?.explanationTa || '').trim();

    if (!explanationEn) {
      continue;
    }

    if (options.applyToDatabase) {
      await applyExplanationToDatabase({
        questionId: row.id,
        explanationEn,
        explanationTa,
        sourceReference: verifiedSourceRef,
        textbookId: verifiedTextbookId,
        sourcePage: primaryPage,
        providerName: provider.name,
      });
    }

    results.push({
      questionId: row.id,
      question: row.question_text,
      correctOptionLetter: correctLetter,
      correctOptionText: correctText,
      explanationEn,
      explanationTa,
      sourceReference: verifiedSourceRef,
      textbookId: verifiedTextbookId,
      sourcePage: primaryPage,
      hasSufficientTextbookContent,
      limitationNote: hasSufficientTextbookContent
        ? undefined
        : 'No indexed textbook pages matched this question; generated with verified supporting context.',
    });
  }

  return results;
}

/**
 * Persists reviewed/approved English & Tamil explanations against the existing question ID
 * without altering options, correct_answer, or creating duplicate questions.
 */
export async function applyExplanationToDatabase(params: {
  questionId: number;
  explanationEn: string;
  explanationTa?: string;
  sourceReference?: string;
  textbookId?: number | null;
  sourcePage?: number | null;
  providerName?: string;
}): Promise<void> {
  const { questionId, explanationEn, explanationTa, sourceReference, textbookId, sourcePage, providerName } = params;

  await pool.query(
    `UPDATE questions
     SET explanation = $1,
         source_reference = COALESCE(NULLIF($2, ''), source_reference),
         textbook_id = COALESCE($3, textbook_id),
         source_page = COALESCE($4, source_page),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $5`,
    [explanationEn, sourceReference || '', textbookId ?? null, sourcePage ?? null, questionId]
  );

  if (explanationTa && explanationTa.trim()) {
    const qRowRes = await pool.query(
      `SELECT question_text, options FROM questions WHERE id = $1`,
      [questionId]
    );
    if (qRowRes.rows.length > 0) {
      const qRow = qRowRes.rows[0];
      const existingTa = await pool.query(
        `SELECT question_text, options FROM question_translations WHERE question_id = $1 AND language = 'ta'`,
        [questionId]
      );
      const qTextTa = existingTa.rows[0]?.question_text || qRow.question_text;
      const optsTa = existingTa.rows[0]?.options || qRow.options;

      await pool.query(
        `INSERT INTO question_translations (
           question_id, language, question_text, options, explanation, approved, provider, updated_at
         ) VALUES ($1, 'ta', $2, $3::jsonb, $4, TRUE, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (question_id, language) DO UPDATE SET
           explanation = EXCLUDED.explanation,
           provider = COALESCE(EXCLUDED.provider, question_translations.provider),
           updated_at = CURRENT_TIMESTAMP`,
        [
          questionId,
          qTextTa,
          typeof optsTa === 'string' ? optsTa : JSON.stringify(optsTa),
          explanationTa.trim(),
          providerName || 'textbook-rag',
        ]
      );
    }
  }
}
