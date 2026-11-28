import crypto from 'crypto';
import pool from '../db';
import {
  parsePasteTextToCanonicalJson,
  ParsedPasteMcqItem,
  PasteTextParseResult,
} from './pasteTextMcqParser';
import {
  ensurePasteImportSchema,
  updatePasteImportExpectedCount,
  updatePasteImportItemAnswer,
  StageBatchResult,
  StagedItemResult,
} from './pasteImportSessionService';
import {
  ensurePreviousPapersAdminSchema,
  normalizeGroupCategory,
  recomputePaperSummaryCounts,
} from './previousPapersAdminService';

export interface PypPasteMetadata {
  group: string;
  examName: string;
  year: number;
  subject: string;
  medium: 'English' | 'Tamil' | 'Bilingual';
  paperType: string;
}

let pypPasteSchemaEnsured = false;

async function ensurePypPasteColumns(): Promise<void> {
  await ensurePasteImportSchema();
  await ensurePreviousPapersAdminSchema();
  if (pypPasteSchemaEnsured) return;
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE paste_import_items ADD COLUMN IF NOT EXISTS pyp_question_id INT;
      ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS option_e TEXT;
    `);
    pypPasteSchemaEnsured = true;
  } finally {
    client.release();
  }
}

export interface CreatePypPasteSessionResult extends PasteTextParseResult {
  sessionId: string | null;
}

/**
 * Previous Year Papers Paste Text -> Exact Canonical JSON conversion.
 * Calls the EXACT SAME shared `parsePasteTextToCanonicalJson` engine as Question Bank.
 * Persists a recoverable session with PYP metadata (never writes to `questions` table).
 */
export async function createPypPasteImportSession(
  rawSourceText: string,
  expectedQuestions: number,
  pypMeta: PypPasteMetadata,
  adminUserId?: number | null
): Promise<CreatePypPasteSessionResult> {
  await ensurePypPasteColumns();

  const { category, exam: canonicalExam } = normalizeGroupCategory(pypMeta.group || 'group4');
  const cleanYear = Number(pypMeta.year) || new Date().getFullYear();
  const cleanSubject = (pypMeta.subject || 'General Studies').trim();
  const cleanMedium = (['English', 'Tamil', 'Bilingual'].includes(pypMeta.medium)
    ? pypMeta.medium
    : 'English') as 'English' | 'Tamil' | 'Bilingual';
  const cleanPaperType = (pypMeta.paperType || 'Prelims').trim();
  const cleanExamName = (pypMeta.examName || '').trim() || `${canonicalExam} ${cleanYear} — ${cleanPaperType}`;

  const langForParser =
    cleanMedium === 'English' ? 'english' : cleanMedium === 'Bilingual' ? 'bilingual' : 'tamil';

  // Invoke the single shared lossless parser
  const parsed = parsePasteTextToCanonicalJson(rawSourceText, expectedQuestions, {
    category,
    subject: cleanSubject,
    classId: null,
    unitId: 1,
    lessonTitle: cleanExamName,
    topic: cleanSubject,
    difficulty: 'Medium',
    language: langForParser,
    targetSystem: 'main_practice',
    sourceReference: `${canonicalExam} ${cleanYear} (${cleanPaperType})`,
  });

  if (parsed.detectedQuestions === 0) {
    return { ...parsed, sessionId: null };
  }

  const sessionId = `pyp_paste_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const storedMetadata = {
    module: 'previous_papers',
    group: pypMeta.group || 'group4',
    category,
    examLabel: canonicalExam,
    examName: cleanExamName,
    year: cleanYear,
    subject: cleanSubject,
    medium: cleanMedium,
    paperType: cleanPaperType,
    paperId: null as number | null,
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO paste_import_sessions (
         session_id, admin_user_id, source_text, source_sha256,
         expected_count, detected_count, valid_count, invalid_count,
         frozen_json, metadata, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)`,
      [
        sessionId,
        adminUserId ?? null,
        rawSourceText,
        parsed.sourceSha256,
        parsed.expectedQuestions,
        parsed.detectedQuestions,
        parsed.validQuestions,
        parsed.invalidQuestions,
        JSON.stringify(parsed.questions),
        JSON.stringify(storedMetadata),
        parsed.canStage ? 'validated' : 'needs_fix',
      ]
    );

    const orders: number[] = [];
    const origNums: string[] = [];
    const keys: string[] = [];
    const statuses: string[] = [];
    const errs: Array<string | null> = [];
    const rawBlocks: string[] = [];

    for (const q of parsed.questions) {
      orders.push(q.sourceOrder);
      origNums.push(q.originalNumber);
      keys.push(`${sessionId}:q:${q.sourceOrder}`);
      statuses.push(q.valid ? 'pending' : 'failed');
      errs.push(q.valid ? null : q.issues.join('; '));
      rawBlocks.push(q.rawSourceBlock);
    }

    await client.query(
      `INSERT INTO paste_import_items (
         session_id, source_order, original_number, source_question_key,
         status, error_message, raw_source_block
       )
       SELECT $1, o, n, k, s, e, r
       FROM UNNEST($2::int[], $3::varchar[], $4::varchar[], $5::varchar[], $6::text[], $7::text[])
         AS t(o, n, k, s, e, r)`,
      [sessionId, orders, origNums, keys, statuses, errs, rawBlocks]
    );

    await client.query('COMMIT');
    return { ...parsed, sessionId };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw err;
  } finally {
    client.release();
  }
}

export interface PypStageBatchResult extends StageBatchResult {
  paperId: number;
}

/**
 * Stage questions from a frozen PYP Paste Import session sequentially into
 * `previous_year_papers` (status='staging') and `previous_year_paper_questions`.
 * Strictly isolated from `questions` table. Fully idempotent on (sessionId, sourceOrder).
 */
export async function stagePypSessionQuestionsSequentially(
  sessionId: string,
  requestedOrders?: number[],
  allowValidOnly = false
): Promise<PypStageBatchResult> {
  await ensurePypPasteColumns();

  const client = await pool.connect();
  let paperId = 0;
  try {
    const sessRes = await client.query(
      `SELECT session_id, source_sha256, expected_count, detected_count, valid_count, invalid_count,
              frozen_json, metadata, admin_user_id
       FROM paste_import_sessions
       WHERE session_id = $1`,
      [sessionId]
    );
    if (sessRes.rows.length === 0) {
      throw new Error(`Upload session "${sessionId}" not found.`);
    }

    const sessionRow = sessRes.rows[0];
    const meta = typeof sessionRow.metadata === 'string'
      ? JSON.parse(sessionRow.metadata || '{}')
      : (sessionRow.metadata || {});

    if (meta.module !== 'previous_papers') {
      throw new Error('This upload session does not belong to Previous Year Papers.');
    }

    const expectedCount = Number(sessionRow.expected_count || 0);
    const detectedCount = Number(sessionRow.detected_count || 0);
    const invalidCount = Number(sessionRow.invalid_count || 0);

    if (expectedCount > 0 && detectedCount !== expectedCount) {
      throw new Error(
        `Count mismatch: expected ${expectedCount} question(s), detected ${detectedCount}. Confirm expected count before staging.`
      );
    }
    if (invalidCount > 0 && !allowValidOnly) {
      throw new Error(
        `Session contains ${invalidCount} invalid question(s). Assign answers or explicitly choose "Stage Valid Only".`
      );
    }

    // Create (once per session) or reuse the staging record in `previous_year_papers`
    paperId = Number(meta.paperId || 0);
    if (!paperId) {
      const year = Number(meta.year) || new Date().getFullYear();
      const examLabel = String(meta.examLabel || 'TNPSC Group 4');
      const category = String(meta.category || 'group4');
      const paperTitle = String(meta.examName || `${examLabel} ${year} — Pasted Paper`);
      const paperType = String(meta.paperType || 'Prelims');
      const medium = String(meta.medium || 'English');
      const subject = String(meta.subject || 'General Studies');
      // Unique per-session hash so retries never collide with another paper
      const sessionPaperHash = crypto
        .createHash('sha256')
        .update(`${sessionId}:${sessionRow.source_sha256}`)
        .digest('hex');

      const insertPaper = await client.query(
        `INSERT INTO previous_year_papers (
           year, exam, category, subjects, paper_title, paper_type, medium, difficulty,
           total_questions, expected_questions, duration_minutes, marks_per_question, negative_marking,
           status, pdf_file_hash, extraction_method,
           processing_status, processing_progress, processing_message,
           explanation_status, source_type, created_by, updated_at
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, 'Medium',
           0, $8, 180, 1.5, 0,
           'staging', $9, 'paste_text_json',
           'processing', 0, $10,
           'completed', 'paste_text_json', $11, CURRENT_TIMESTAMP
         )
         RETURNING id`,
        [
          year,
          examLabel,
          category,
          subject,
          paperTitle,
          paperType,
          medium,
          expectedCount || detectedCount,
          sessionPaperHash,
          `Sequential paste staging started (session ${sessionId}).`,
          sessionRow.admin_user_id ?? null,
        ]
      );
      paperId = Number(insertPaper.rows[0].id);

      meta.paperId = paperId;
      await client.query(
        `UPDATE paste_import_sessions SET metadata = $1::jsonb, updated_at = NOW() WHERE session_id = $2`,
        [JSON.stringify(meta), sessionId]
      );
    }

    const frozenQuestions: ParsedPasteMcqItem[] = Array.isArray(sessionRow.frozen_json)
      ? sessionRow.frozen_json
      : JSON.parse(sessionRow.frozen_json || '[]');
    const byOrder = new Map<number, ParsedPasteMcqItem>(frozenQuestions.map((q) => [q.sourceOrder, q]));

    let targetOrders: number[];
    if (Array.isArray(requestedOrders) && requestedOrders.length > 0) {
      targetOrders = Array.from(
        new Set(
          requestedOrders
            .map((n) => Math.floor(Number(n)))
            .filter((n) => Number.isFinite(n) && byOrder.has(n))
        )
      ).sort((a, b) => a - b);
    } else {
      const pendingRes = await client.query(
        `SELECT source_order FROM paste_import_items
         WHERE session_id = $1 AND status <> 'staged'
         ORDER BY source_order ASC`,
        [sessionId]
      );
      targetOrders = pendingRes.rows.map((r: any) => Number(r.source_order));
    }

    const results: StagedItemResult[] = [];
    const paperSubject = String(meta.subject || 'General Studies');
    const paperMedium = String(meta.medium || 'English');

    for (const order of targetOrders) {
      const q = byOrder.get(order);
      if (!q) continue;

      // 1. Idempotency check in paste_import_items
      const itemRes = await client.query(
        `SELECT status, pyp_question_id FROM paste_import_items
         WHERE session_id = $1 AND source_order = $2`,
        [sessionId, order]
      );
      const existingItem = itemRes.rows[0];
      if (existingItem && existingItem.status === 'staged' && existingItem.pyp_question_id) {
        results.push({
          sourceOrder: order,
          originalNumber: q.originalNumber,
          status: 'staged',
          questionId: Number(existingItem.pyp_question_id),
          alreadyStaged: true,
          error: null,
        });
        continue;
      }

      // 2. Idempotency check in previous_year_paper_questions by (paper_id, question_number = sourceOrder)
      const existingPypQ = await client.query(
        `SELECT id FROM previous_year_paper_questions
         WHERE paper_id = $1 AND question_number = $2
         LIMIT 1`,
        [paperId, order]
      );
      if (existingPypQ.rows.length > 0) {
        const existingId = Number(existingPypQ.rows[0].id);
        await client.query(
          `UPDATE paste_import_items
           SET status = 'staged', pyp_question_id = $1, error_message = NULL, updated_at = NOW()
           WHERE session_id = $2 AND source_order = $3`,
          [existingId, sessionId, order]
        );
        results.push({
          sourceOrder: order,
          originalNumber: q.originalNumber,
          status: 'staged',
          questionId: existingId,
          alreadyStaged: true,
          error: null,
        });
        continue;
      }

      // 3. Validate individual question before insert
      if (
        !q.questionText ||
        !Array.isArray(q.options) ||
        q.options.length < 4 ||
        q.options.slice(0, 4).some((o) => !o || !o.trim()) ||
        q.correctAnswer === null ||
        q.correctAnswer < 0 ||
        q.correctAnswer >= q.options.length
      ) {
        const errMsg = q.issues.length > 0 ? q.issues.join('; ') : 'Question failed structural validation.';
        await client.query(
          `UPDATE paste_import_items
           SET status = 'failed', error_message = $1, updated_at = NOW()
           WHERE session_id = $2 AND source_order = $3`,
          [errMsg, sessionId, order]
        );
        results.push({
          sourceOrder: order,
          originalNumber: q.originalNumber,
          status: 'failed',
          questionId: null,
          alreadyStaged: false,
          error: errMsg,
        });
        continue;
      }

      // 4. Insert single question into `previous_year_paper_questions` (never `questions`!)
      try {
        const expText = q.explanation?.trim() || null;
        const insertRes = await client.query(
          `INSERT INTO previous_year_paper_questions (
             paper_id, question_number, original_question_number, section,
             subject, topic, question_text, option_a, option_b, option_c, option_d, option_e,
             correct_answer, answer_status, answer_source, explanation, explanation_source,
             is_duplicate, extraction_status, needs_review, review_note, medium, is_approved
           )
           VALUES (
             $1, $2, $3, $4,
             $5, $6, $7, $8, $9, $10, $11, $12,
             $13, 'admin_verified', 'paste_text_json', $14, $15,
             false, 'ok', false, NULL, $16, false
           )
           RETURNING id`,
          [
            paperId,
            order,
            q.originalNumber || String(order),
            paperSubject,
            q.subject || paperSubject,
            q.topic || paperSubject,
            q.questionText,
            q.options[0],
            q.options[1],
            q.options[2],
            q.options[3],
            q.options[4] || q.optionE || null,
            q.correctAnswer,
            expText,
            expText ? 'admin' : 'none',
            paperMedium,
          ]
        );

        const insertedId = Number(insertRes.rows[0].id);
        await client.query(
          `UPDATE paste_import_items
           SET status = 'staged', pyp_question_id = $1, error_message = NULL, updated_at = NOW()
           WHERE session_id = $2 AND source_order = $3`,
          [insertedId, sessionId, order]
        );

        results.push({
          sourceOrder: order,
          originalNumber: q.originalNumber,
          status: 'staged',
          questionId: insertedId,
          alreadyStaged: false,
          error: null,
        });
      } catch (insertErr: any) {
        const errMsg = insertErr?.message || 'Previous Year Paper staging insert failed';
        await client.query(
          `UPDATE paste_import_items
           SET status = 'failed', error_message = $1, updated_at = NOW()
           WHERE session_id = $2 AND source_order = $3`,
          [errMsg, sessionId, order]
        );
        results.push({
          sourceOrder: order,
          originalNumber: q.originalNumber,
          status: 'failed',
          questionId: null,
          alreadyStaged: false,
          error: errMsg,
        });
      }
    }

    const aggRes = await client.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'staged')::int AS staged,
         COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
       FROM paste_import_items
       WHERE session_id = $1`,
      [sessionId]
    );
    const agg = aggRes.rows[0] || { total: 0, staged: 0, failed: 0, pending: 0 };
    const nextSessionStatus =
      agg.pending === 0 && agg.failed === 0 && agg.staged === agg.total
        ? 'completed'
        : agg.pending === 0 && agg.failed > 0
          ? 'partial'
          : 'uploading';

    await client.query(
      `UPDATE paste_import_sessions SET status = $1, updated_at = NOW() WHERE session_id = $2`,
      [nextSessionStatus, sessionId]
    );

    const progressPct = agg.total > 0 ? Math.round((Number(agg.staged) / Number(agg.total)) * 100) : 0;
    await client.query(
      `UPDATE previous_year_papers
       SET total_questions = $1,
           processing_status = $2,
           processing_progress = $3,
           processing_message = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [
        Number(agg.staged),
        nextSessionStatus === 'completed' ? 'completed' : 'processing',
        progressPct,
        `Staged ${agg.staged}/${agg.total} question(s) via shared Paste Text engine (session ${sessionId}).`,
        paperId,
      ]
    );

    const insertedIds = results
      .filter((r) => r.status === 'staged' && r.questionId !== null && !r.alreadyStaged)
      .map((r) => Number(r.questionId));

    return {
      sessionId,
      paperId,
      results,
      insertedIds,
      insertedCount: insertedIds.length,
      summary: {
        total: Number(agg.total),
        staged: Number(agg.staged),
        failed: Number(agg.failed),
        pending: Number(agg.pending),
        status: nextSessionStatus,
      },
    };
  } finally {
    client.release();
    if (paperId > 0) {
      await recomputePaperSummaryCounts(paperId).catch(() => {});
    }
  }
}

export { updatePasteImportExpectedCount, updatePasteImportItemAnswer };
