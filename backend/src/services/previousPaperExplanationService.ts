import pool from '../db';
import { AIProviderFactory } from './ai/ai-provider.factory';

export interface ExplanationBatchOutcome {
  paperId: number;
  attempted: number;
  generated: number;
  skippedUnverified: number;
  failed: number;
  status: 'completed' | 'partial' | 'failed' | 'skipped';
  message: string;
}

interface ExplanationItemResponse {
  explanations?: {
    id: number;
    explanation: string;
  }[];
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * Generates concise, TNPSC-standard AI explanations for a Previous Year Paper's questions
 * ONLY when a verified/tentative answer is present (never guesses UNVERIFIED answers).
 * Strictly preserves original question text and options untouched.
 * Marks every generated explanation with explanation_source = 'ai_generated'.
 */
export async function generatePreviousPaperExplanations(
  paperId: number,
  options?: {
    onlyMissing?: boolean;
    onProgress?: (percent: number, message: string) => void | Promise<void>;
    logFn?: (stage: string, level: 'info' | 'warn' | 'error', message: string, details?: any) => Promise<void>;
  }
): Promise<ExplanationBatchOutcome> {
  const onlyMissing = options?.onlyMissing !== false;

  const paperRes = await pool.query(
    `SELECT id, exam, year, medium, paper_title FROM previous_year_papers WHERE id = $1`,
    [paperId]
  );
  if (paperRes.rows.length === 0) {
    throw new Error(`Paper #${paperId} not found.`);
  }
  const paper = paperRes.rows[0];
  const isTamil = String(paper.medium || '').toLowerCase().includes('tamil');

  const qRes = await pool.query(
    `SELECT id, question_number, question_text, option_a, option_b, option_c, option_d,
            correct_answer, COALESCE(answer_status, 'unverified') AS answer_status,
            explanation
     FROM previous_year_paper_questions
     WHERE paper_id = $1
     ORDER BY question_number ASC`,
    [paperId]
  );

  const allQuestions = qRes.rows;
  const skippedUnverified = allQuestions.filter(
    (q) => q.answer_status === 'unverified' || q.answer_status === 'conflict'
  ).length;

  const eligible = allQuestions.filter((q) => {
    if (q.answer_status === 'unverified' || q.answer_status === 'conflict') return false;
    if (!q.question_text || !q.option_a || !q.option_b) return false;
    if (onlyMissing && q.explanation && String(q.explanation).trim().length > 15) return false;
    return true;
  });

  if (eligible.length === 0) {
    const existingWithExp = allQuestions.filter(
      (q) => q.explanation && String(q.explanation).trim().length > 15
    ).length;
    const status = existingWithExp > 0 ? 'completed' : 'skipped';
    await pool.query(
      `UPDATE previous_year_papers
       SET explanation_status = $1,
           explanation_generated_count = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [status, existingWithExp, paperId]
    );
    return {
      paperId,
      attempted: 0,
      generated: 0,
      skippedUnverified,
      failed: 0,
      status,
      message:
        skippedUnverified > 0
          ? `Skipped explanation generation: ${skippedUnverified} question(s) have unverified answers.`
          : 'All eligible questions already have explanations.',
    };
  }

  let provider;
  try {
    provider = await AIProviderFactory.getActiveProvider();
    if (!provider.isConfigured()) {
      const gemini = AIProviderFactory.getProvider('gemini');
      if (gemini.isConfigured()) provider = gemini;
    }
  } catch {
    provider = AIProviderFactory.getProvider('gemini');
  }

  if (!provider || !provider.isConfigured()) {
    await pool.query(
      `UPDATE previous_year_papers SET explanation_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [paperId]
    );
    const msg = 'No AI provider is configured for automatic explanation generation. Admin can add explanations manually.';
    if (options?.logFn) await options.logFn('explanations', 'warn', msg);
    return {
      paperId,
      attempted: eligible.length,
      generated: 0,
      skippedUnverified,
      failed: eligible.length,
      status: 'failed',
      message: msg,
    };
  }

  await pool.query(
    `UPDATE previous_year_papers SET explanation_status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [paperId]
  );

  const BATCH_SIZE = 8;
  let generated = 0;
  let failed = 0;

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);
    const pct = Math.min(95, 78 + Math.round(((i + batch.length) / eligible.length) * 18));
    if (options?.onProgress) {
      await options.onProgress(
        pct,
        `Generating TNPSC explanations (${Math.min(i + batch.length, eligible.length)}/${eligible.length})...`
      );
    }

    const itemsPayload = batch.map((q) => {
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
      const ansIdx = Math.max(0, Math.min(3, Number(q.correct_answer) || 0));
      return {
        id: Number(q.id),
        qNum: Number(q.question_number),
        question: String(q.question_text),
        options: opts.map((o, idx) => `${OPTION_LETTERS[idx]}) ${o || ''}`).join(' | '),
        correctAnswer: `${OPTION_LETTERS[ansIdx]}) ${opts[ansIdx] || ''}`,
      };
    });

    const prompt = `You are a TNPSC Examination Subject Expert writing concise, accurate study explanations for official TNPSC Previous Year Questions (${paper.exam} ${paper.year}).

LANGUAGE REQUIREMENT: Write every explanation in ${isTamil ? 'clear academic Tamil (தமிழ்)' : 'clear, concise English'}.

STRICT RULES:
1. Explain clearly WHY the given official Correct Answer is correct using accurate TNPSC/Samacheer Kalvi subject knowledge.
2. Keep each explanation concise (2 to 4 crisp sentences, 35–85 words). Avoid fluff or unnecessary verbosity.
3. NEVER alter or dispute the original question wording or options.
4. Return ONLY valid JSON matching: { "explanations": [ { "id": <number>, "explanation": "<string>" } ] }

QUESTIONS:
${JSON.stringify(itemsPayload, null, 2)}`;

    try {
      const parsed = await provider.generateJson<ExplanationItemResponse>(prompt, {
        temperature: 0.2,
        maxTokens: 3500,
        timeoutMs: 60000,
        retryCount: 1,
      });

      const list = Array.isArray(parsed?.explanations) ? parsed.explanations : [];
      const byId = new Map<number, string>();
      for (const item of list) {
        if (item && Number.isInteger(Number(item.id)) && typeof item.explanation === 'string' && item.explanation.trim().length > 10) {
          byId.set(Number(item.id), item.explanation.trim());
        }
      }

      for (const q of batch) {
        const expText = byId.get(Number(q.id));
        if (expText) {
          await pool.query(
            `UPDATE previous_year_paper_questions
             SET explanation = $1,
                 explanation_source = 'ai_generated'
             WHERE id = $2`,
            [expText, q.id]
          );
          generated += 1;
        } else {
          failed += 1;
        }
      }
    } catch (batchErr: any) {
      failed += batch.length;
      if (options?.logFn) {
        await options.logFn(
          'explanations',
          'warn',
          `Explanation batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${batchErr?.message || 'AI error'}`,
          { batchStart: i, batchSize: batch.length }
        );
      }
    }
  }

  const totalWithExpRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM previous_year_paper_questions
     WHERE paper_id = $1 AND explanation IS NOT NULL AND LENGTH(TRIM(explanation)) > 10`,
    [paperId]
  );
  const totalWithExp = Number(totalWithExpRes.rows[0]?.cnt || 0);
  const finalStatus: 'completed' | 'partial' | 'failed' =
    generated === 0 && failed > 0
      ? 'failed'
      : failed > 0 || skippedUnverified > 0
        ? 'partial'
        : 'completed';

  await pool.query(
    `UPDATE previous_year_papers
     SET explanation_status = $1,
         explanation_generated_count = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [finalStatus, totalWithExp, paperId]
  );

  const summaryMsg = `Generated ${generated} AI explanation(s) (${skippedUnverified} skipped unverified, ${failed} failed).`;
  if (options?.logFn) {
    await options.logFn('explanations', finalStatus === 'failed' ? 'error' : 'info', summaryMsg, {
      generated,
      skippedUnverified,
      failed,
    });
  }

  return {
    paperId,
    attempted: eligible.length,
    generated,
    skippedUnverified,
    failed,
    status: finalStatus,
    message: summaryMsg,
  };
}
