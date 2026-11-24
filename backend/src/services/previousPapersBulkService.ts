import crypto from 'crypto';
import pool from '../db';
import { broadcastAnalyticsEvent } from './analyticsEventBus';
import { ensurePreviousPapersAdminSchema } from './previousPapersAdminService';

export type PaperBulkScope = 'selected' | 'filtered' | 'all';

export interface PaperBulkFilters {
  group?: string;
  year?: string | number;
  subject?: string;
  medium?: string;
  status?: string;
  search?: string;
  includeDeleted?: boolean;
}

export interface PaperBulkSelectionInput {
  scope: PaperBulkScope;
  selectedIds?: number[];
  excludedIds?: number[];
  filters?: PaperBulkFilters;
}

export interface BulkAdminActor {
  adminUsername: string;
  adminRole: string;
}

// Prevent concurrent duplicate bulk operations on the same action
const activeBulkLocks = new Set<string>();

function acquireBulkLock(action: string) {
  if (activeBulkLocks.has(action)) {
    const err: any = new Error(
      `Another bulk ${action} operation is already in progress. Please wait for it to finish.`
    );
    err.statusCode = 409;
    throw err;
  }
  activeBulkLocks.add(action);
}

function releaseBulkLock(action: string) {
  activeBulkLocks.delete(action);
}

function assertSuperAdmin(actor: BulkAdminActor, actionLabel: string) {
  if (String(actor.adminRole || '').toLowerCase() !== 'super_admin') {
    const err: any = new Error(
      `Forbidden: Only Super Admin is authorized to perform ${actionLabel}.`
    );
    err.statusCode = 403;
    throw err;
  }
}

function sanitizeIdList(ids?: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  return Array.from(
    new Set(ids.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))
  );
}

function buildFilterWhere(filters?: PaperBulkFilters, includeDeleted = false) {
  const conditions: string[] = [includeDeleted ? `p.deleted_at IS NOT NULL` : `p.deleted_at IS NULL`];
  const params: any[] = [];

  if (filters?.group && filters.group !== 'all') {
    const g = String(filters.group).trim().toLowerCase();
    if (g === 'group2' || g === 'group2a' || g === 'group2_2a') {
      conditions.push(`p.category IN ('group2', 'group2a', 'group2_2a')`);
    } else {
      params.push(g);
      conditions.push(`p.category = $${params.length}`);
    }
  }
  if (filters?.year && filters.year !== 'all' && !Number.isNaN(Number(filters.year))) {
    params.push(Number(filters.year));
    conditions.push(`p.year = $${params.length}`);
  }
  if (filters?.subject && filters.subject !== 'all') {
    params.push(`%${String(filters.subject).trim()}%`);
    conditions.push(`LOWER(COALESCE(p.subjects, '')) LIKE LOWER($${params.length})`);
  }
  if (filters?.medium && filters.medium !== 'all') {
    params.push(String(filters.medium).trim());
    conditions.push(`LOWER(COALESCE(p.medium, 'English')) = LOWER($${params.length})`);
  }
  if (filters?.status && filters.status !== 'all') {
    params.push(String(filters.status).trim().toLowerCase());
    conditions.push(`LOWER(COALESCE(p.status, 'draft')) = $${params.length}`);
  }
  if (filters?.search && String(filters.search).trim()) {
    params.push(`%${String(filters.search).trim()}%`);
    conditions.push(
      `(LOWER(COALESCE(p.paper_title, '')) LIKE LOWER($${params.length}) OR LOWER(COALESCE(p.subjects, '')) LIKE LOWER($${params.length}) OR LOWER(COALESCE(p.exam, '')) LIKE LOWER($${params.length}) OR LOWER(COALESCE(p.paper_code, '')) LIKE LOWER($${params.length}))`
    );
  }

  return { conditions, params };
}

interface ScopedPaperSummary {
  id: number;
  year: number;
  exam: string;
  paperTitle: string;
  status: string;
  sourceType: string;
  questionCount: number;
  approvedQuestionCount: number;
  needsReviewCount: number;
  incompleteQuestionCount: number;
  invalidAnswerCount: number;
}

async function resolveScopedPapers(
  input: PaperBulkSelectionInput,
  includeDeleted = false
): Promise<ScopedPaperSummary[]> {
  await ensurePreviousPapersAdminSchema();

  const scope: PaperBulkScope =
    input.scope === 'all' || input.scope === 'filtered' ? input.scope : 'selected';
  const selectedIds = sanitizeIdList(input.selectedIds);
  const excludedIds = sanitizeIdList(input.excludedIds);

  if (scope === 'selected' && selectedIds.length === 0) {
    return [];
  }

  const { conditions, params } =
    scope === 'filtered'
      ? buildFilterWhere(input.filters, includeDeleted)
      : { conditions: [includeDeleted ? `p.deleted_at IS NOT NULL` : `p.deleted_at IS NULL`], params: [] as any[] };

  if (scope === 'selected') {
    params.push(selectedIds);
    conditions.push(`p.id = ANY($${params.length}::int[])`);
  }
  if (excludedIds.length > 0) {
    params.push(excludedIds);
    conditions.push(`NOT (p.id = ANY($${params.length}::int[]))`);
  }

  const res = await pool.query(
    `SELECT
       p.id,
       p.year,
       p.exam,
       COALESCE(p.paper_title, p.exam || ' ' || p.year) AS paper_title,
       LOWER(COALESCE(p.status, 'staging')) AS status,
       COALESCE(p.source_type, 'seed') AS source_type,
       COUNT(q.id)::int AS question_count,
       COUNT(q.id) FILTER (WHERE COALESCE(q.is_approved, false) = true)::int AS approved_question_count,
       COUNT(q.id) FILTER (WHERE COALESCE(q.needs_review, false) = true)::int AS needs_review_count,
       COUNT(q.id) FILTER (
         WHERE COALESCE(TRIM(q.question_text), '') = ''
            OR COALESCE(TRIM(q.option_a), '') = ''
            OR COALESCE(TRIM(q.option_b), '') = ''
            OR COALESCE(TRIM(q.option_c), '') = ''
            OR COALESCE(TRIM(q.option_d), '') = ''
       )::int AS incomplete_question_count,
       COUNT(q.id) FILTER (
         WHERE COALESCE(q.answer_status, '') IN ('conflict', 'unverified')
            OR q.correct_answer IS NULL
            OR q.correct_answer < 0
            OR q.correct_answer > 3
       )::int AS invalid_answer_count
     FROM previous_year_papers p
     LEFT JOIN previous_year_paper_questions q ON q.paper_id = p.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY p.id
     ORDER BY p.year DESC, p.id DESC`,
    params
  );

  return res.rows.map((r: any) => ({
    id: Number(r.id),
    year: Number(r.year || 0),
    exam: String(r.exam || ''),
    paperTitle: String(r.paper_title || ''),
    status: String(r.status || 'staging'),
    sourceType: String(r.source_type || 'seed'),
    questionCount: Number(r.question_count || 0),
    approvedQuestionCount: Number(r.approved_question_count || 0),
    needsReviewCount: Number(r.needs_review_count || 0),
    incompleteQuestionCount: Number(r.incomplete_question_count || 0),
    invalidAnswerCount: Number(r.invalid_answer_count || 0),
  }));
}

function checkPublishEligibility(p: ScopedPaperSummary): { eligible: boolean; reason?: string } {
  if (p.status === 'published') {
    return { eligible: false, reason: 'Already published.' };
  }
  if (p.status !== 'approved' && p.status !== 'unpublished') {
    return {
      eligible: false,
      reason: `Status is "${p.status.toUpperCase()}" — only Approved examinations can be published.`,
    };
  }
  if (!p.year || p.year < 1990 || !p.exam.trim() || !p.paperTitle.trim()) {
    return { eligible: false, reason: 'Examination metadata (Year / Exam / Title) is incomplete.' };
  }
  if (p.questionCount <= 0) {
    return { eligible: false, reason: 'Examination has 0 questions.' };
  }
  if (p.incompleteQuestionCount > 0) {
    return {
      eligible: false,
      reason: `${p.incompleteQuestionCount} question(s) are missing text or options A–D.`,
    };
  }
  if (p.needsReviewCount > 0) {
    return {
      eligible: false,
      reason: `${p.needsReviewCount} question(s) still require review and cannot be published automatically.`,
    };
  }
  if (p.sourceType !== 'seed' && p.invalidAnswerCount > 0) {
    return {
      eligible: false,
      reason: `${p.invalidAnswerCount} question(s) have unverified or conflicting answer keys.`,
    };
  }
  if (p.sourceType === 'manual_paste' && p.approvedQuestionCount < p.questionCount) {
    return {
      eligible: false,
      reason: `${p.questionCount - p.approvedQuestionCount} question(s) are not yet approved.`,
    };
  }
  return { eligible: true };
}

function checkApproveEligibility(p: ScopedPaperSummary): { eligible: boolean; reason?: string } {
  if (p.status === 'published') {
    return { eligible: false, reason: 'Already published — unpublish first before changing approval.' };
  }
  if (p.status === 'approved') {
    return { eligible: false, reason: 'Already approved.' };
  }
  if (p.questionCount <= 0) {
    return { eligible: false, reason: 'Examination has 0 questions.' };
  }
  if (p.incompleteQuestionCount > 0) {
    return {
      eligible: false,
      reason: `${p.incompleteQuestionCount} question(s) are missing text or options A–D.`,
    };
  }
  if (p.sourceType !== 'seed' && p.invalidAnswerCount > 0) {
    return {
      eligible: false,
      reason: `${p.invalidAnswerCount} question(s) have unverified or conflicting answer keys.`,
    };
  }
  return { eligible: true };
}

export async function previewBulkPreviousPapers(input: PaperBulkSelectionInput) {
  const papers = await resolveScopedPapers(input, Boolean(input.filters?.includeDeleted));

  let totalQuestions = 0;
  let approvedQuestions = 0;
  let needsReviewQuestions = 0;
  let eligibleForPublish = 0;
  let eligibleForApprove = 0;
  let eligibleForReject = 0;
  let alreadyPublishedCount = 0;
  let ineligibleCount = 0;
  const sampleIneligible: Array<{ paperId: number; paperTitle: string; reason: string }> = [];

  for (const p of papers) {
    totalQuestions += p.questionCount;
    approvedQuestions += p.approvedQuestionCount;
    needsReviewQuestions += p.needsReviewCount;

    if (p.status === 'published') {
      alreadyPublishedCount += 1;
    }
    if (checkApproveEligibility(p).eligible) {
      eligibleForApprove += 1;
    }
    if (p.status !== 'rejected') {
      eligibleForReject += 1;
    }
    const check = checkPublishEligibility(p);
    if (check.eligible) {
      eligibleForPublish += 1;
    } else {
      ineligibleCount += 1;
      if (sampleIneligible.length < 5) {
        sampleIneligible.push({
          paperId: p.id,
          paperTitle: p.paperTitle,
          reason: check.reason || 'Not eligible.',
        });
      }
    }
  }

  return {
    scope: input.scope,
    totalSelected: papers.length,
    totalQuestions,
    approvedQuestions,
    needsReviewQuestions,
    eligibleForPublish,
    eligibleForApprove,
    eligibleForReject,
    alreadyPublishedCount,
    ineligibleCount,
    sampleIneligible,
  };
}

export async function bulkApprovePreviousPapers(
  input: PaperBulkSelectionInput,
  actor: BulkAdminActor
) {
  assertSuperAdmin(actor, 'Bulk Approve Previous Year Examinations');
  acquireBulkLock('approve');
  try {
    const papers = await resolveScopedPapers(input, false);
    if (papers.length === 0) {
      const err: any = new Error('No examinations matched the selected scope.');
      err.statusCode = 400;
      throw err;
    }

    const bulkOperationId = `pyp_app_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const eligible: ScopedPaperSummary[] = [];
    const skipped: Array<{ paperId: number; paperTitle: string; reason: string }> = [];

    for (const p of papers) {
      const check = checkApproveEligibility(p);
      if (check.eligible) eligible.push(p);
      else skipped.push({ paperId: p.id, paperTitle: p.paperTitle, reason: check.reason || 'Ineligible.' });
    }

    const approvedIds: number[] = [];
    if (eligible.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const p of eligible) {
          await client.query(
            `UPDATE previous_year_paper_questions
             SET is_approved = true,
                 needs_review = false,
                 review_note = NULL
             WHERE paper_id = $1`,
            [p.id]
          );
          await client.query(
            `UPDATE previous_year_papers
             SET status = 'approved',
                 approved_at = CURRENT_TIMESTAMP,
                 rejection_reason = NULL,
                 flagged_count = 0,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND deleted_at IS NULL`,
            [p.id]
          );
          await client.query(
            `INSERT INTO previous_paper_audit_logs
               (admin_id, paper_id, action, previous_status, new_status, bulk_operation_id, details)
             VALUES ($1, $2, 'BULK_APPROVE', $3, 'approved', $4, $5::jsonb)`,
            [
              actor.adminUsername,
              p.id,
              p.status,
              bulkOperationId,
              JSON.stringify({ scope: input.scope, paperTitle: p.paperTitle, questionCount: p.questionCount }),
            ]
          );
          approvedIds.push(p.id);
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    return {
      bulkOperationId,
      scope: input.scope,
      totalMatched: papers.length,
      approvedCount: approvedIds.length,
      skippedCount: skipped.length,
      approvedIds,
      skipped,
    };
  } finally {
    releaseBulkLock('approve');
  }
}

export async function bulkRejectPreviousPapers(
  input: PaperBulkSelectionInput & { rejectionReason?: string },
  actor: BulkAdminActor
) {
  assertSuperAdmin(actor, 'Bulk Reject Previous Year Examinations');
  acquireBulkLock('reject');
  try {
    const papers = await resolveScopedPapers(input, false);
    if (papers.length === 0) {
      const err: any = new Error('No examinations matched the selected scope.');
      err.statusCode = 400;
      throw err;
    }

    const reason = String(input.rejectionReason || '').trim() || 'Rejected during Admin review';
    const bulkOperationId = `pyp_rej_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const toReject = papers.filter((p) => p.status !== 'rejected');
    const skipped = papers
      .filter((p) => p.status === 'rejected')
      .map((p) => ({
        paperId: p.id,
        paperTitle: p.paperTitle,
        reason: 'Already rejected.',
      }));

    const rejectedIds: number[] = [];
    if (toReject.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const p of toReject) {
          await client.query(
            `UPDATE previous_year_papers
             SET status = 'rejected',
                 rejection_reason = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND deleted_at IS NULL`,
            [p.id, reason]
          );
          await client.query(
            `INSERT INTO previous_paper_audit_logs
               (admin_id, paper_id, action, previous_status, new_status, bulk_operation_id, details)
             VALUES ($1, $2, 'BULK_REJECT', $3, 'rejected', $4, $5::jsonb)`,
            [
              actor.adminUsername,
              p.id,
              p.status,
              bulkOperationId,
              JSON.stringify({ scope: input.scope, paperTitle: p.paperTitle, rejectionReason: reason }),
            ]
          );
          rejectedIds.push(p.id);
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      broadcastAnalyticsEvent('previous_paper_published', {
        bulkOperationId,
        rejectedIds,
        status: 'rejected',
      });
    }

    return {
      bulkOperationId,
      scope: input.scope,
      totalMatched: papers.length,
      rejectedCount: rejectedIds.length,
      skippedCount: skipped.length,
      rejectedIds,
      skipped,
      rejectionReason: reason,
    };
  } finally {
    releaseBulkLock('reject');
  }
}

export async function bulkPublishPreviousPapers(
  input: PaperBulkSelectionInput,
  actor: BulkAdminActor
) {
  assertSuperAdmin(actor, 'Bulk Publish Previous Year Examinations');
  acquireBulkLock('publish');
  try {
    const papers = await resolveScopedPapers(input, false);
    if (papers.length === 0) {
      const err: any = new Error('No examinations matched the selected scope.');
      err.statusCode = 400;
      throw err;
    }

    const bulkOperationId = `pyp_pub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const eligible: ScopedPaperSummary[] = [];
    const skipped: Array<{ paperId: number; paperTitle: string; reason: string }> = [];

    for (const p of papers) {
      const check = checkPublishEligibility(p);
      if (check.eligible) eligible.push(p);
      else skipped.push({ paperId: p.id, paperTitle: p.paperTitle, reason: check.reason || 'Ineligible.' });
    }

    const publishedIds: number[] = [];
    if (eligible.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const p of eligible) {
          await client.query(
            `UPDATE previous_year_papers
             SET status = 'published',
                 published_at = CURRENT_TIMESTAMP,
                 published_by = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND deleted_at IS NULL`,
            [p.id, actor.adminUsername]
          );
          await client.query(
            `INSERT INTO previous_paper_audit_logs
               (admin_id, paper_id, action, previous_status, new_status, bulk_operation_id, details)
             VALUES ($1, $2, 'BULK_PUBLISH', $3, 'published', $4, $5::jsonb)`,
            [
              actor.adminUsername,
              p.id,
              p.status,
              bulkOperationId,
              JSON.stringify({
                scope: input.scope,
                paperTitle: p.paperTitle,
                questionCount: p.questionCount,
              }),
            ]
          );
          publishedIds.push(p.id);
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      broadcastAnalyticsEvent('previous_paper_published', {
        bulkOperationId,
        publishedIds,
        status: 'published',
      });
    }

    return {
      bulkOperationId,
      scope: input.scope,
      totalMatched: papers.length,
      publishedCount: publishedIds.length,
      skippedCount: skipped.length,
      failedCount: 0,
      publishedIds,
      skipped,
    };
  } finally {
    releaseBulkLock('publish');
  }
}

export async function bulkUnpublishPreviousPapers(
  input: PaperBulkSelectionInput,
  actor: BulkAdminActor
) {
  assertSuperAdmin(actor, 'Bulk Unpublish Previous Year Examinations');
  acquireBulkLock('unpublish');
  try {
    const papers = await resolveScopedPapers(input, false);
    if (papers.length === 0) {
      const err: any = new Error('No examinations matched the selected scope.');
      err.statusCode = 400;
      throw err;
    }

    const bulkOperationId = `pyp_unpub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const toUnpublish = papers.filter((p) => p.status === 'published');
    const skipped = papers
      .filter((p) => p.status !== 'published')
      .map((p) => ({
        paperId: p.id,
        paperTitle: p.paperTitle,
        reason: `Status is "${p.status.toUpperCase()}" (not currently published).`,
      }));

    const unpublishedIds: number[] = [];
    if (toUnpublish.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const p of toUnpublish) {
          await client.query(
            `UPDATE previous_year_papers
             SET status = 'unpublished',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND deleted_at IS NULL`,
            [p.id]
          );
          await client.query(
            `INSERT INTO previous_paper_audit_logs
               (admin_id, paper_id, action, previous_status, new_status, bulk_operation_id, details)
             VALUES ($1, $2, 'BULK_UNPUBLISH', $3, 'unpublished', $4, $5::jsonb)`,
            [
              actor.adminUsername,
              p.id,
              p.status,
              bulkOperationId,
              JSON.stringify({ scope: input.scope, paperTitle: p.paperTitle }),
            ]
          );
          unpublishedIds.push(p.id);
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      broadcastAnalyticsEvent('previous_paper_published', {
        bulkOperationId,
        unpublishedIds,
        status: 'unpublished',
      });
    }

    return {
      bulkOperationId,
      scope: input.scope,
      totalMatched: papers.length,
      unpublishedCount: unpublishedIds.length,
      skippedCount: skipped.length,
      unpublishedIds,
      skipped,
    };
  } finally {
    releaseBulkLock('unpublish');
  }
}

export async function bulkSoftDeletePreviousPapers(
  input: PaperBulkSelectionInput & { confirmText?: string },
  actor: BulkAdminActor
) {
  assertSuperAdmin(actor, 'Bulk Delete Previous Year Examinations');

  if (input.scope === 'all' && String(input.confirmText || '').trim() !== 'DELETE ALL EXAMINATIONS') {
    const err: any = new Error(
      'Confirmation required: To delete all examinations, you must type "DELETE ALL EXAMINATIONS".'
    );
    err.statusCode = 400;
    throw err;
  }

  acquireBulkLock('delete');
  try {
    const papers = await resolveScopedPapers(input, false);
    if (papers.length === 0) {
      const err: any = new Error('No active examinations matched the selected scope.');
      err.statusCode = 400;
      throw err;
    }

    const bulkOperationId = `pyp_del_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const actionName = input.scope === 'all' ? 'DELETE_ALL_EXAMINATIONS' : 'BULK_DELETE';
    const deletedIds: number[] = [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const p of papers) {
        const nextStatus = p.status === 'published' ? 'unpublished' : p.status;
        await client.query(
          `UPDATE previous_year_papers
           SET deleted_at = CURRENT_TIMESTAMP,
               deleted_by = $2,
               status = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND deleted_at IS NULL`,
          [p.id, actor.adminUsername, nextStatus]
        );
        await client.query(
          `INSERT INTO previous_paper_audit_logs
             (admin_id, paper_id, action, previous_status, new_status, bulk_operation_id, details)
           VALUES ($1, $2, $3, $4, 'deleted', $5, $6::jsonb)`,
          [
            actor.adminUsername,
            p.id,
            actionName,
            p.status,
            bulkOperationId,
            JSON.stringify({ scope: input.scope, paperTitle: p.paperTitle, softDelete: true }),
          ]
        );
        deletedIds.push(p.id);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    broadcastAnalyticsEvent('previous_paper_published', {
      bulkOperationId,
      deletedIds,
      status: 'deleted',
    });

    return {
      bulkOperationId,
      scope: input.scope,
      totalMatched: papers.length,
      deletedCount: deletedIds.length,
      deletedIds,
      recoverable: true,
    };
  } finally {
    releaseBulkLock('delete');
  }
}

export async function bulkRestorePreviousPapers(
  paperIds: number[],
  actor: BulkAdminActor
) {
  assertSuperAdmin(actor, 'Restore Deleted Previous Year Examinations');
  const cleanIds = sanitizeIdList(paperIds);
  if (cleanIds.length === 0) {
    const err: any = new Error('Please select at least one deleted examination to restore.');
    err.statusCode = 400;
    throw err;
  }

  await ensurePreviousPapersAdminSchema();
  const bulkOperationId = `pyp_rest_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const restoredIds: number[] = [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id, status, paper_title FROM previous_year_papers WHERE id = ANY($1::int[]) AND deleted_at IS NOT NULL FOR UPDATE`,
      [cleanIds]
    );
    for (const r of existing.rows) {
      await client.query(
        `UPDATE previous_year_papers
         SET deleted_at = NULL,
             deleted_by = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [r.id]
      );
      await client.query(
        `INSERT INTO previous_paper_audit_logs
           (admin_id, paper_id, action, previous_status, new_status, bulk_operation_id, details)
         VALUES ($1, $2, 'RESTORE_FROM_TRASH', 'deleted', $3, $4, $5::jsonb)`,
        [
          actor.adminUsername,
          r.id,
          String(r.status || 'staging'),
          bulkOperationId,
          JSON.stringify({ paperTitle: r.paper_title }),
        ]
      );
      restoredIds.push(Number(r.id));
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { bulkOperationId, restoredCount: restoredIds.length, restoredIds };
}

export async function listPreviousPaperAuditLogs(limit = 50) {
  await ensurePreviousPapersAdminSchema();
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const res = await pool.query(
    `SELECT l.id, l.admin_id, l.paper_id, l.action, l.previous_status, l.new_status,
            l.bulk_operation_id, l.details, l.created_at,
            p.paper_title, p.year, p.exam
     FROM previous_paper_audit_logs l
     LEFT JOIN previous_year_papers p ON p.id = l.paper_id
     ORDER BY l.created_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  return res.rows.map((r: any) => ({
    id: Number(r.id),
    adminId: String(r.admin_id),
    paperId: r.paper_id != null ? Number(r.paper_id) : null,
    paperTitle: r.paper_title || r.details?.paperTitle || null,
    year: r.year != null ? Number(r.year) : null,
    exam: r.exam || null,
    action: String(r.action),
    previousStatus: r.previous_status || null,
    newStatus: r.new_status || null,
    bulkOperationId: r.bulk_operation_id || null,
    details: r.details || null,
    createdAt: r.created_at,
  }));
}
