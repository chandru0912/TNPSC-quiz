import crypto from 'crypto';
import pool from '../db';
import {
  parsePasteTextToCanonicalJson,
  PasteImportMetadata,
  ParsedPasteMcqItem,
  PasteTextParseResult,
} from './pasteTextMcqParser';
import {
  computeConceptFingerprint,
  computeNormalizedQuestionHash,
} from './questionValidator';
import { invalidateCachePrefix } from '../utils/cache';

let schemaEnsured = false;

export async function ensurePasteImportSchema(): Promise<void> {
  if (schemaEnsured) return;
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_question_id VARCHAR(64);
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_type VARCHAR(48);
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS upload_session_id VARCHAR(80);
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_order INT;
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_e TEXT;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_upload_session_order
        ON questions (upload_session_id, source_order)
        WHERE upload_session_id IS NOT NULL AND source_order IS NOT NULL;

      CREATE TABLE IF NOT EXISTS paste_import_sessions (
        session_id VARCHAR(80) PRIMARY KEY,
        admin_user_id INT,
        source_text TEXT NOT NULL,
        source_sha256 VARCHAR(64) NOT NULL,
        expected_count INT NOT NULL DEFAULT 0,
        detected_count INT NOT NULL DEFAULT 0,
        valid_count INT NOT NULL DEFAULT 0,
        invalid_count INT NOT NULL DEFAULT 0,
        frozen_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(24) NOT NULL DEFAULT 'validated',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS paste_import_items (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(80) NOT NULL REFERENCES paste_import_sessions(session_id) ON DELETE CASCADE,
        source_order INT NOT NULL,
        original_number VARCHAR(32) NOT NULL,
        source_question_key VARCHAR(120) NOT NULL,
        question_id INT REFERENCES questions(id) ON DELETE SET NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'pending',
        error_message TEXT,
        raw_source_block TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_paste_import_session_order UNIQUE (session_id, source_order)
      );

      CREATE INDEX IF NOT EXISTS idx_paste_import_items_session_status
        ON paste_import_items (session_id, status, source_order);
    `);
    schemaEnsured = true;
  } finally {
    client.release();
  }
}

export interface CreatePasteSessionResult extends PasteTextParseResult {
  sessionId: string | null;
}

export async function createPasteImportSession(
  rawSourceText: string,
  expectedQuestions: number,
  metadata: PasteImportMetadata,
  adminUserId?: number | null
): Promise<CreatePasteSessionResult> {
  await ensurePasteImportSchema();

  const parsed = parsePasteTextToCanonicalJson(rawSourceText, expectedQuestions, metadata);

  if (parsed.detectedQuestions === 0) {
    return { ...parsed, sessionId: null };
  }

  const sessionId = `paste_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
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
        JSON.stringify(metadata || {}),
        parsed.canStage ? 'validated' : 'needs_fix',
      ]
    );

    // Bulk insert item tracking rows in exact source_order
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
      // ignore rollback error
    }
    throw err;
  } finally {
    client.release();
  }
}

export interface StagedItemResult {
  sourceOrder: number;
  originalNumber: string;
  status: 'staged' | 'failed';
  questionId: number | null;
  alreadyStaged: boolean;
  error: string | null;
}

export interface StageBatchResult {
  sessionId: string;
  results: StagedItemResult[];
  insertedIds: number[];
  insertedCount: number;
  summary: {
    total: number;
    staged: number;
    failed: number;
    pending: number;
    status: string;
  };
}

function getGroupDisplayName(category: string): string {
  if (category === 'group1') return 'Group 1';
  if (category === 'group2' || category === 'group2a' || category === 'group2_2a') return 'Group 2, 2A';
  if (category === 'group4') return 'Group 4';
  return 'VAO';
}

/**
 * Stage specific questions from a frozen Paste Import session strictly in ascending source_order.
 * Fully idempotent on (sessionId, sourceOrder) — retrying never creates duplicate staging records.
 */
export async function stageSessionQuestionsSequentially(
  sessionId: string,
  requestedOrders?: number[],
  allowValidOnly = false
): Promise<StageBatchResult> {
  await ensurePasteImportSchema();

  const client = await pool.connect();
  try {
    const sessRes = await client.query(
      `SELECT session_id, expected_count, detected_count, valid_count, invalid_count, frozen_json, status
       FROM paste_import_sessions
       WHERE session_id = $1`,
      [sessionId]
    );

    if (sessRes.rows.length === 0) {
      throw new Error(`Upload session "${sessionId}" not found.`);
    }

    const sessionRow = sessRes.rows[0];
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

    const frozenQuestions: ParsedPasteMcqItem[] = Array.isArray(sessionRow.frozen_json)
      ? sessionRow.frozen_json
      : JSON.parse(sessionRow.frozen_json || '[]');

    const byOrder = new Map<number, ParsedPasteMcqItem>();
    for (const q of frozenQuestions) {
      byOrder.set(q.sourceOrder, q);
    }

    // Determine exact ordered list of sourceOrders to process
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
      // Default: all non-staged items in ascending source_order
      const pendingRes = await client.query(
        `SELECT source_order FROM paste_import_items
         WHERE session_id = $1 AND status <> 'staged'
         ORDER BY source_order ASC`,
        [sessionId]
      );
      targetOrders = pendingRes.rows.map((r: any) => Number(r.source_order));
    }

    const results: StagedItemResult[] = [];
    let anyNewlyInserted = false;

    for (const order of targetOrders) {
      const q = byOrder.get(order);
      if (!q) continue;

      // 1. Idempotency check in paste_import_items
      const itemRes = await client.query(
        `SELECT status, question_id FROM paste_import_items
         WHERE session_id = $1 AND source_order = $2`,
        [sessionId, order]
      );
      const existingItem = itemRes.rows[0];
      if (existingItem && existingItem.status === 'staged' && existingItem.question_id) {
        results.push({
          sourceOrder: order,
          originalNumber: q.originalNumber,
          status: 'staged',
          questionId: Number(existingItem.question_id),
          alreadyStaged: true,
          error: null,
        });
        continue;
      }

      // 2. Idempotency check in questions table by (upload_session_id, source_order)
      const existingQRes = await client.query(
        `SELECT id FROM questions
         WHERE upload_session_id = $1 AND source_order = $2
         LIMIT 1`,
        [sessionId, order]
      );
      if (existingQRes.rows.length > 0) {
        const existingId = Number(existingQRes.rows[0].id);
        await client.query(
          `UPDATE paste_import_items
           SET status = 'staged', question_id = $1, error_message = NULL, updated_at = NOW()
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

      // 3. Validate individual question integrity before DB insert (supports 4 or 5 options)
      if (
        !q.questionText ||
        !Array.isArray(q.options) ||
        q.options.length < 4 ||
        q.options.length > 5 ||
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

      // 4. Insert single question into existing `questions` table with status = 'staging'
      try {
        const VALID_CATEGORIES = ['group1', 'group2', 'group2a', 'group4', 'vao', 'group2_2a', 'group4_vao'];
        const category = VALID_CATEGORIES.includes(q.category) ? q.category : 'group4';
        const groupName = getGroupDisplayName(category);
        const subject = q.subject || 'General Studies';
        const subjectId = subject.toLowerCase().replace(/\s+/g, '-');
        const lessonTitle = q.lessonTitle || q.topic || subject;
        const topic = q.topic || lessonTitle;
        const unitId = Math.max(1, Math.min(20, Number(q.unitId || 1)));
        const classId = q.classId ?? null;
        const optionsJson = JSON.stringify(q.options);
        const tag = `TNPSC ${groupName} • Unit ${unitId}: ${subject}`;
        const normalizedHash = computeNormalizedQuestionHash(q.questionText);
        const conceptFp = computeConceptFingerprint(q.questionText, q.options[q.correctAnswer]);

        const insertRes = await client.query(
          `INSERT INTO questions (
             category, exam_group_id, unit_id, class_id, standard_id, subject, subject_id,
             lesson_title, lesson_id, topic, difficulty, tag, question_text,
             options, option_a, option_b, option_c, option_d, option_e, correct_answer,
             explanation, source_reference, status, verification_status,
             target_system, language,
             normalized_question_hash, concept_fingerprint, duplicate_check_status, generation_batch_id,
             source_question_id, source_type, upload_session_id, source_order
           )
           VALUES (
             $1, $2, $3, $4, $5, $6, $7,
             $8, $9, $10, $11, $12, $13,
             $14, $15, $16, $17, $18, $19, $20,
             $21, $22, 'staging', 'needs_review',
             $23, $24,
             $25, $26, 'passed', $27,
             $28, 'paste_text_json', $29, $30
           )
           RETURNING id`,
          [
            category,
            category,
            unitId,
            classId,
            classId,
            subject,
            subjectId,
            lessonTitle,
            q.lessonId || null,
            topic,
            q.difficulty || 'Medium',
            tag,
            q.questionText,
            optionsJson,
            q.options[0],
            q.options[1],
            q.options[2],
            q.options[3],
            q.options[4] || q.optionE || null,
            q.correctAnswer,
            q.explanation || '',
            q.sourceReference || `Paste Import (${sessionId} #${q.originalNumber})`,
            q.targetSystem || 'main_practice',
            q.language || 'english',
            normalizedHash,
            conceptFp,
            sessionId,
            q.sourceQuestionId,
            sessionId,
            order,
          ]
        );

        const insertedId = Number(insertRes.rows[0].id);
        anyNewlyInserted = true;

        await client.query(
          `UPDATE paste_import_items
           SET status = 'staged', question_id = $1, error_message = NULL, updated_at = NOW()
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
        const isUniqueViolation = insertErr?.code === '23505';
        const errMsg = isUniqueViolation
          ? insertErr?.constraint === 'uq_questions_upload_session_order'
            ? 'Already staged in this session'
            : `Question with identical text already exists in lesson "${q.lessonTitle}" (${insertErr?.constraint || 'unique constraint'})`
          : insertErr?.message || 'Database staging insert failed';

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

    // Recompute authoritative session summary
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
      `UPDATE paste_import_sessions
       SET status = $1, updated_at = NOW()
       WHERE session_id = $2`,
      [nextSessionStatus, sessionId]
    );

    if (anyNewlyInserted) {
      invalidateCachePrefix('metrics:questions:');
    }

    const insertedIds = results
      .filter((r) => r.status === 'staged' && r.questionId !== null && !r.alreadyStaged)
      .map((r) => Number(r.questionId));

    return {
      sessionId,
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
  }
}

export async function getPasteImportSession(sessionId: string) {
  await ensurePasteImportSchema();
  const sessRes = await pool.query(
    `SELECT session_id, source_sha256, expected_count, detected_count, valid_count, invalid_count,
            frozen_json, metadata, status, created_at, updated_at
     FROM paste_import_sessions
     WHERE session_id = $1`,
    [sessionId]
  );
  if (sessRes.rows.length === 0) return null;

  const itemsRes = await pool.query(
    `SELECT source_order, original_number, source_question_key, question_id, status, error_message
     FROM paste_import_items
     WHERE session_id = $1
     ORDER BY source_order ASC`,
    [sessionId]
  );

  const row = sessRes.rows[0];
  return {
    sessionId: row.session_id,
    sourceSha256: row.source_sha256,
    expectedQuestions: Number(row.expected_count),
    detectedQuestions: Number(row.detected_count),
    validQuestions: Number(row.valid_count),
    invalidQuestions: Number(row.invalid_count),
    status: row.status,
    metadata: row.metadata,
    questions: row.frozen_json,
    items: itemsRes.rows.map((r: any) => ({
      sourceOrder: Number(r.source_order),
      originalNumber: r.original_number,
      sourceQuestionKey: r.source_question_key,
      questionId: r.question_id ? Number(r.question_id) : null,
      status: r.status,
      errorMessage: r.error_message || null,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Explicitly update expected_count on a frozen session after administrator confirmation.
 * Does NOT re-parse, truncate, or modify any of the frozen questions.
 */
export async function updatePasteImportExpectedCount(sessionId: string, newExpectedCount: number) {
  await ensurePasteImportSchema();
  const safeCount = Math.floor(Number(newExpectedCount));
  if (!Number.isFinite(safeCount) || safeCount < 1 || safeCount > 5000) {
    throw new Error('Expected count must be between 1 and 5000.');
  }
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT detected_count, valid_count, invalid_count FROM paste_import_sessions WHERE session_id = $1`,
      [sessionId]
    );
    if (res.rows.length === 0) throw new Error(`Upload session "${sessionId}" not found.`);
    const detected = Number(res.rows[0].detected_count);
    const invalid = Number(res.rows[0].invalid_count);
    const canStage = detected > 0 && detected === safeCount && invalid === 0;

    await client.query(
      `UPDATE paste_import_sessions
       SET expected_count = $1, status = $2, updated_at = NOW()
       WHERE session_id = $3`,
      [safeCount, canStage ? 'validated' : 'needs_fix', sessionId]
    );

    return {
      sessionId,
      expectedQuestions: safeCount,
      detectedQuestions: detected,
      countMismatch: detected !== safeCount,
      canStage,
    };
  } finally {
    client.release();
  }
}

/**
 * Update ONLY a single question's canonical answer inside the frozen session snapshot
 * without re-parsing or modifying any other valid questions.
 */
export async function updatePasteImportItemAnswer(
  sessionId: string,
  sourceOrder: number,
  correctAnswerIndex: number
) {
  await ensurePasteImportSchema();
  const letters = ['A', 'B', 'C', 'D', 'E'] as const;
  if (!Number.isInteger(correctAnswerIndex) || correctAnswerIndex < 0 || correctAnswerIndex > 3) {
    throw new Error('Selected answer must be A (0), B (1), C (2), or D (3).');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `SELECT expected_count, detected_count, frozen_json FROM paste_import_sessions WHERE session_id = $1 FOR UPDATE`,
      [sessionId]
    );
    if (res.rows.length === 0) throw new Error(`Upload session "${sessionId}" not found.`);

    const expectedCount = Number(res.rows[0].expected_count);
    const detectedCount = Number(res.rows[0].detected_count);
    const frozenQuestions: ParsedPasteMcqItem[] = Array.isArray(res.rows[0].frozen_json)
      ? res.rows[0].frozen_json
      : JSON.parse(res.rows[0].frozen_json || '[]');

    const idx = frozenQuestions.findIndex((q) => q.sourceOrder === sourceOrder);
    if (idx < 0) throw new Error(`Question at sourceOrder ${sourceOrder} not found in session.`);

    const target = { ...frozenQuestions[idx] };
    target.correctAnswer = correctAnswerIndex;
    target.correctAnswerLetter = letters[correctAnswerIndex];

    // Recompute validation issues for THIS item only
    const issues: string[] = [];
    if (!target.questionText) issues.push('Missing question text');
    const missingOpts: string[] = [];
    for (let i = 0; i < 4; i++) {
      if (!target.options[i]) missingOpts.push(letters[i]);
    }
    if (missingOpts.length > 0) issues.push(`Missing option(s): ${missingOpts.join(', ')}`);
    target.issues = issues;
    target.valid = issues.length === 0;

    frozenQuestions[idx] = target;

    let validCount = 0;
    let invalidCount = 0;
    let missingAnswers = 0;
    for (const q of frozenQuestions) {
      if (q.valid) validCount++;
      else invalidCount++;
      if (q.correctAnswer === null) missingAnswers++;
    }

    const countMismatch = expectedCount > 0 && detectedCount !== expectedCount;
    const canStage = detectedCount > 0 && !countMismatch && invalidCount === 0;

    await client.query(
      `UPDATE paste_import_sessions
       SET frozen_json = $1::jsonb, valid_count = $2, invalid_count = $3, status = $4, updated_at = NOW()
       WHERE session_id = $5`,
      [JSON.stringify(frozenQuestions), validCount, invalidCount, canStage ? 'validated' : 'needs_fix', sessionId]
    );

    await client.query(
      `UPDATE paste_import_items
       SET status = CASE WHEN status = 'staged' THEN 'staged' ELSE $1 END,
           error_message = $2,
           updated_at = NOW()
       WHERE session_id = $3 AND source_order = $4`,
      [target.valid ? 'pending' : 'failed', target.valid ? null : target.issues.join('; '), sessionId, sourceOrder]
    );

    await client.query('COMMIT');
    return {
      sessionId,
      updatedItem: target,
      validQuestions: validCount,
      invalidQuestions: invalidCount,
      missingAnswers,
      canStage,
    };
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
