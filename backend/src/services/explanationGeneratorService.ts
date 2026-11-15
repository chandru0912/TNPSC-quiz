import pool from '../db';
import { AIProviderFactory } from './ai/ai-provider.factory';
import { retrieveRelevantTextbookContent, TextbookChunk } from './textbookRag';

export interface StructuredExplanationFields {
  approach: string;
  stepByStep: string;
  correctOptionReasoning: string;
  incorrectOptionsReasoning: string;
}

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
  needsAdminReview: boolean;
  limitationNote?: string;
}

/**
 * Formats structured explanation sections into a clean, readable educational block.
 */
function formatStructuredExplanation(
  sections: StructuredExplanationFields,
  lang: 'en' | 'ta',
  sourceRef: string
): string {
  if (lang === 'ta') {
    return [
      `அணுகுமுறை: ${sections.approach}`,
      `படிப்படியான தீர்வு:\n${sections.stepByStep}`,
      `சரியான விருப்பம்: ${sections.correctOptionReasoning}`,
      `மற்ற விருப்பங்கள் தவறானதற்கான காரணம்:\n${sections.incorrectOptionsReasoning}`,
      `பாடநூல் ஆதாரம்: ${sourceRef}`,
    ]
      .filter((p) => p.trim().length > 0)
      .join('\n\n');
  }

  return [
    `Approach: ${sections.approach}`,
    `Step-by-step Solution:\n${sections.stepByStep}`,
    `Correct Option: ${sections.correctOptionReasoning}`,
    `Why Other Options Are Incorrect:\n${sections.incorrectOptionsReasoning}`,
    `Textbook Source Reference: ${sourceRef}`,
  ]
    .filter((p) => p.trim().length > 0)
    .join('\n\n');
}

/**
 * Strictly scoped keyword fallback within the SAME standard, subject, and lesson/unit
 * so unrelated textbook lessons are never used.
 */
async function searchSameLessonTextbookChunks(
  standard: number | null,
  subject: string,
  unitId: number | null,
  lessonTitle: string | null,
  questionText: string,
  correctOptionText: string
): Promise<TextbookChunk[]> {
  if (!standard || (!unitId && !lessonTitle)) {
    return [];
  }

  const combined = `${questionText} ${correctOptionText}`
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u0B80-\u0BFF\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);

  const keywords = Array.from(new Set(combined)).slice(0, 6);
  if (keywords.length === 0) return [];

  const params: any[] = [subject.toLowerCase(), standard];
  const conditions: string[] = [
    `LOWER(tb.subject) LIKE '%' || $1 || '%'`,
    `tb.standard = $2`,
  ];

  if (lessonTitle && lessonTitle.trim()) {
    params.push(`%${lessonTitle.trim().toLowerCase()}%`);
    if (unitId) {
      params.push(unitId);
      conditions.push(`(LOWER(COALESCE(tc.lesson_title, '')) LIKE $${params.length - 1} OR tc.unit_id = $${params.length})`);
    } else {
      conditions.push(`LOWER(COALESCE(tc.lesson_title, '')) LIKE $${params.length}`);
    }
  } else if (unitId) {
    params.push(unitId);
    conditions.push(`tc.unit_id = $${params.length}`);
  }

  const kwStartIdx = params.length + 1;
  const likeConditions = keywords.map((_, idx) => `LOWER(tc.content) LIKE $${kwStartIdx + idx}`);
  params.push(...keywords.map((k) => `%${k}%`));

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
    WHERE ${conditions.join(' AND ')}
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
 * Generates structured, textbook-grounded English & Tamil explanations for existing MCQs
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

    // 1. Retrieve relevant textbook content strictly by syllabus mapping
    const retrieval = await retrieveRelevantTextbookContent({
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
      chunks = await searchSameLessonTextbookChunks(
        row.class_id ? Number(row.class_id) : null,
        subject,
        row.unit_id ? Number(row.unit_id) : null,
        row.lesson_title || null,
        row.question_text,
        correctText
      );
    }

    const hasSufficientTextbookContent = chunks.length > 0;
    const primaryChunk = chunks[0] || null;
    const verifiedTextbookId =
      retrieval.textbookId || primaryChunk?.textbookId || (row.textbook_id ? Number(row.textbook_id) : null);

    // Fetch verified textbook metadata (term, book_name, standard, subject)
    let tbMeta: { bookName?: string; term?: string | null; standard?: number; subject?: string } = {};
    if (verifiedTextbookId) {
      try {
        const tbRes = await pool.query(
          `SELECT book_name, term, standard, subject FROM textbooks WHERE id = $1`,
          [verifiedTextbookId]
        );
        if (tbRes.rows.length > 0) {
          tbMeta = {
            bookName: tbRes.rows[0].book_name,
            term: tbRes.rows[0].term,
            standard: tbRes.rows[0].standard,
            subject: tbRes.rows[0].subject,
          };
        }
      } catch {}
    }

    const verifiedBookName = tbMeta.bookName || retrieval.bookName || primaryChunk?.bookName || null;
    const verifiedPages = Array.from(
      new Set(chunks.map((c) => c.pageNumber).filter((p) => Number.isFinite(p) && p > 0))
    );
    const primaryPage = verifiedPages[0] ?? (row.source_page ? Number(row.source_page) : null);

    // Build verified source reference ONLY from real syllabus & retrieved textbook metadata
    const refParts: string[] = [];
    if (verifiedBookName) refParts.push(verifiedBookName);
    refParts.push(`Standard ${tbMeta.standard || standard}`);
    refParts.push(tbMeta.subject || subject);
    if (tbMeta.term) refParts.push(tbMeta.term);
    if (row.unit_id) refParts.push(`Unit ${row.unit_id}`);
    if (row.lesson_title) refParts.push(`Lesson: ${row.lesson_title}`);
    if (verifiedPages.length > 0) {
      refParts.push(`Page${verifiedPages.length > 1 ? 's' : ''} ${verifiedPages.slice(0, 3).join(', ')}`);
    } else if (!hasSufficientTextbookContent) {
      refParts.push('Textbook page evidence unavailable — pending Admin Review');
    }
    const verifiedSourceRef = refParts.join(' • ');

    const textbookContextText = hasSufficientTextbookContent
      ? chunks
          .slice(0, 4)
          .map((c) => `[Book: ${c.bookName} | Page ${c.pageNumber}]\n${c.content.slice(0, 1400)}`)
          .join('\n\n---\n\n')
      : 'NO MATCHING EXTRACTED TEXTBOOK PAGES FOUND FOR THIS SYLLABUS LESSON.';

    const incorrectOptionsList = opts
      .map((o, i) => ({ letter: String.fromCharCode(65 + i), text: o, index: i }))
      .filter((o) => o.index !== correctIdx);

    const prompt = `You are a Samacheer Kalvi & TNPSC subject expert generating a strictly textbook-grounded structured explanation for an existing MCQ.

QUESTION (ID ${row.id}):
${row.question_text}

ALL OPTIONS:
${opts.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')}

VERIFIED CORRECT ANSWER (MUST BE SUPPORTED):
Option ${correctLetter}: ${correctText}

INCORRECT OPTIONS TO ADDRESS:
${incorrectOptionsList.map((o) => `${o.letter}) ${o.text}`).join('\n')}

RETRIEVED SAMACHEER KALVI TEXTBOOK CONTENT:
${textbookContextText}

STRICT RULES:
1. Base your explanation on the retrieved Samacheer Kalvi textbook content above.
2. Verify and explain why Option ${correctLetter} ("${correctText}") is correct.
3. Explain WHY each incorrect option (${incorrectOptionsList.map((o) => o.letter).join(', ')}) is incorrect.
4. NEVER invent facts, textbook names, or page numbers. If textbook content is missing or insufficient, state only verified core educational reasoning without fabricating textbook citations.
5. Return structured fields in BOTH English ("en") and Samacheer Kalvi academic Tamil ("ta"):
   - "approach": Brief problem-solving or conceptual approach.
   - "stepByStep": Clear numbered/logical steps leading to the answer.
   - "correctOptionReasoning": Why Option ${correctLetter} is correct with textbook facts.
   - "incorrectOptionsReasoning": Bullet/line explanation of why each of the other 3 options is wrong.

Return ONLY valid JSON:
{
  "en": {
    "approach": "...",
    "stepByStep": "...",
    "correctOptionReasoning": "...",
    "incorrectOptionsReasoning": "..."
  },
  "ta": {
    "approach": "...",
    "stepByStep": "...",
    "correctOptionReasoning": "...",
    "incorrectOptionsReasoning": "..."
  }
}`;

    const aiOut = await provider.generateJson<{
      en?: StructuredExplanationFields;
      ta?: StructuredExplanationFields;
    }>(prompt, {
      systemPrompt: 'You are an expert TNPSC educator. Output strict valid JSON only.',
      temperature: 0.2,
      maxTokens: 2500,
      responseFormat: 'json',
      timeoutMs: 25000,
    });

    if (!aiOut?.en?.correctOptionReasoning) {
      continue;
    }

    const explanationEn = formatStructuredExplanation(aiOut.en, 'en', verifiedSourceRef);
    const explanationTa = aiOut.ta?.correctOptionReasoning
      ? formatStructuredExplanation(aiOut.ta, 'ta', verifiedSourceRef)
      : '';
    const needsAdminReview = !hasSufficientTextbookContent;

    if (options.applyToDatabase) {
      await applyExplanationToDatabase({
        questionId: row.id,
        explanationEn,
        explanationTa,
        sourceReference: verifiedSourceRef,
        textbookId: verifiedTextbookId,
        sourcePage: primaryPage,
        providerName: provider.name,
        needsAdminReview,
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
      needsAdminReview,
      limitationNote: needsAdminReview
        ? 'Textbook evidence unavailable for this lesson — marked for Admin Review.'
        : undefined,
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
  needsAdminReview?: boolean;
}): Promise<void> {
  const {
    questionId,
    explanationEn,
    explanationTa,
    sourceReference,
    textbookId,
    sourcePage,
    providerName,
    needsAdminReview,
  } = params;

  const verificationStatus = needsAdminReview ? 'needs_review' : 'verified';

  await pool.query(
    `UPDATE questions
     SET explanation = $1,
         source_reference = COALESCE(NULLIF($2, ''), source_reference),
         textbook_id = COALESCE($3, textbook_id),
         source_page = COALESCE($4, source_page),
         verification_status = $5,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $6`,
    [explanationEn, sourceReference || '', textbookId ?? null, sourcePage ?? null, verificationStatus, questionId]
  );
}
