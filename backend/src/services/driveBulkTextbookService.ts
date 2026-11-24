import pool from '../db';
import {
  DriveTextbookRow,
  ensureDriveOAuthSchema,
  PublicationStatus,
  ReviewStatus,
} from './driveOAuthService';

export type BulkSelectionScope =
  | 'selected'
  | 'filtered'
  | 'all'
  | 'pending_review'
  | 'published';

export interface DriveTextbookFilters {
  search?: string;
  standard?: string;
  termOrVolume?: string;
  subject?: string;
  medium?: string;
  publicationStatus?: string;
  includeTrashed?: boolean;
}

export interface BulkOperationRequest {
  scope: BulkSelectionScope;
  selectedIds?: number[];
  excludedIds?: number[];
  filters?: DriveTextbookFilters;
  approvePending?: boolean;
  dryRun?: boolean;
  confirmPhrase?: string;
  adminUsername: string;
  adminRole: string;
}

export interface DriveTextbookCounts {
  totalTextbooks: number;
  pendingReview: number;
  approved: number;
  publishedTextbooks: number;
  unpublishedTextbooks: number;
  rejectedTextbooks: number;
  failedSync: number;
  unavailableFiles: number;
  trashedTextbooks: number;
}

// In-process concurrency guard to prevent duplicate concurrent bulk mutations
let activeBulkOperation: string | null = null;

async function withBulkLock<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (activeBulkOperation) {
    const err: any = new Error(
      `Another bulk operation ("${activeBulkOperation}") is already running. Please wait for it to finish.`
    );
    err.statusCode = 409;
    throw err;
  }
  activeBulkOperation = label;
  try {
    return await fn();
  } finally {
    activeBulkOperation = null;
  }
}

function mapRow(r: any): DriveTextbookRow & { deletedAt: string | null; deletedBy: string | null } {
  return {
    id: Number(r.id),
    groupId: String(r.group_id || 'group1'),
    bookName: String(r.book_name || r.file_name || 'Untitled Textbook'),
    standard: Number(r.standard || 6),
    term: r.term || null,
    volume: r.volume || null,
    subject: String(r.subject || 'Unclassified'),
    medium: String(r.medium || '').toLowerCase().includes('tamil') ? 'Tamil' : 'English',
    unit: r.unit !== null && r.unit !== undefined ? Number(r.unit) : null,
    fileName: String(r.file_name || `${r.book_name || 'textbook'}.pdf`),
    mimeType: String(r.mime_type || 'application/pdf'),
    fileSize: Number(r.file_size || 0),
    googleDriveFileId: String(r.google_drive_file_id),
    googleDriveParentFolderId: r.google_drive_parent_folder_id || null,
    driveFolderPath: r.drive_folder_path || null,
    driveModifiedTime: r.drive_modified_time ? new Date(r.drive_modified_time).toISOString() : null,
    driveAvailable: r.drive_available !== false,
    reviewStatus: String(r.review_status || 'PENDING_REVIEW').toUpperCase() as ReviewStatus,
    publicationStatus: String(r.publication_status || 'PENDING_REVIEW').toUpperCase() as PublicationStatus,
    publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
    publishedBy: r.published_by || null,
    lastSyncedAt: r.last_synced_at ? new Date(r.last_synced_at).toISOString() : null,
    downloadCount: Number(r.download_count || 0),
    deletedAt: r.deleted_at ? new Date(r.deleted_at).toISOString() : null,
    deletedBy: r.deleted_by || null,
  };
}

function buildFilterWhere(
  filters: DriveTextbookFilters | undefined,
  startIdx = 1
): { clauses: string[]; params: any[]; nextIdx: number } {
  const clauses: string[] = ['google_drive_file_id IS NOT NULL'];
  const params: any[] = [];
  let idx = startIdx;

  if (filters?.includeTrashed) {
    clauses.push('deleted_at IS NOT NULL');
  } else {
    clauses.push('deleted_at IS NULL');
  }

  if (filters?.standard && filters.standard !== 'all') {
    clauses.push(`standard = $${idx++}`);
    params.push(Number(filters.standard));
  }
  if (filters?.medium && filters.medium !== 'all') {
    clauses.push(`LOWER(medium) = LOWER($${idx++})`);
    params.push(filters.medium);
  }
  if (filters?.subject && filters.subject !== 'all') {
    clauses.push(`LOWER(subject) = LOWER($${idx++})`);
    params.push(filters.subject);
  }
  if (filters?.termOrVolume && filters.termOrVolume !== 'all') {
    clauses.push(
      `(LOWER(COALESCE(term, '')) = LOWER($${idx}) OR LOWER(COALESCE(volume, '')) = LOWER($${idx}))`
    );
    params.push(filters.termOrVolume);
    idx += 1;
  }
  if (filters?.publicationStatus && filters.publicationStatus !== 'all') {
    const st = filters.publicationStatus.toUpperCase();
    if (st === 'UNAVAILABLE') {
      clauses.push(`(drive_available = false OR UPPER(COALESCE(publication_status, '')) = 'UNAVAILABLE')`);
    } else if (st === 'FAILED_SYNC') {
      clauses.push(`UPPER(COALESCE(review_status, '')) = 'NEEDS_REVIEW'`);
    } else {
      clauses.push(`UPPER(COALESCE(publication_status, 'PENDING_REVIEW')) = UPPER($${idx++})`);
      params.push(st);
    }
  }
  if (filters?.search && filters.search.trim()) {
    clauses.push(
      `(book_name ILIKE $${idx} OR file_name ILIKE $${idx} OR subject ILIKE $${idx} OR google_drive_file_id ILIKE $${idx} OR COALESCE(drive_folder_path, '') ILIKE $${idx})`
    );
    params.push(`%${filters.search.trim()}%`);
    idx += 1;
  }

  return { clauses, params, nextIdx: idx };
}

function buildScopeWhere(req: {
  scope: BulkSelectionScope;
  selectedIds?: number[];
  excludedIds?: number[];
  filters?: DriveTextbookFilters;
}): { whereSql: string; params: any[] } {
  const cleanSelected = Array.from(
    new Set((req.selectedIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))
  );
  const cleanExcluded = Array.from(
    new Set((req.excludedIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))
  );

  if (req.scope === 'selected') {
    if (cleanSelected.length === 0) {
      return { whereSql: '1 = 0', params: [] };
    }
    return {
      whereSql: `google_drive_file_id IS NOT NULL AND deleted_at IS NULL AND id = ANY($1::int[])`,
      params: [cleanSelected],
    };
  }

  let baseFilters: DriveTextbookFilters = { includeTrashed: false };
  if (req.scope === 'filtered') {
    baseFilters = { ...(req.filters || {}), includeTrashed: false };
  } else if (req.scope === 'pending_review') {
    baseFilters = { publicationStatus: 'PENDING_REVIEW', includeTrashed: false };
  } else if (req.scope === 'published') {
    baseFilters = { publicationStatus: 'PUBLISHED', includeTrashed: false };
  }

  const { clauses, params, nextIdx } = buildFilterWhere(baseFilters, 1);
  if (cleanExcluded.length > 0) {
    clauses.push(`NOT (id = ANY($${nextIdx}::int[]))`);
    params.push(cleanExcluded);
  }

  return { whereSql: clauses.join(' AND '), params };
}

export async function getDriveTextbookCounts(): Promise<DriveTextbookCounts> {
  await ensureDriveOAuthSchema();

  const [tbRes, failedRes] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NULL)::int AS total_textbooks,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NULL AND UPPER(COALESCE(publication_status, 'PENDING_REVIEW')) = 'PENDING_REVIEW')::int AS pending_review,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NULL AND UPPER(COALESCE(review_status, '')) = 'APPROVED')::int AS approved,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NULL AND UPPER(COALESCE(publication_status, '')) = 'PUBLISHED')::int AS published_textbooks,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NULL AND UPPER(COALESCE(publication_status, '')) = 'UNPUBLISHED')::int AS unpublished_textbooks,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NULL AND UPPER(COALESCE(publication_status, '')) = 'REJECTED')::int AS rejected_textbooks,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NULL AND drive_available = false)::int AS unavailable_files,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NOT NULL)::int AS trashed_textbooks
      FROM textbooks
    `),
    pool.query(`
      SELECT COALESCE(SUM(failed_count), 0)::int AS failed_items,
             COUNT(*) FILTER (WHERE status = 'SYNC_FAILED')::int AS failed_runs
      FROM google_drive_textbook_sync_logs
    `),
  ]);

  const r = tbRes.rows[0] || {};
  const f = failedRes.rows[0] || {};
  return {
    totalTextbooks: Number(r.total_textbooks || 0),
    pendingReview: Number(r.pending_review || 0),
    approved: Number(r.approved || 0),
    publishedTextbooks: Number(r.published_textbooks || 0),
    unpublishedTextbooks: Number(r.unpublished_textbooks || 0),
    rejectedTextbooks: Number(r.rejected_textbooks || 0),
    failedSync: Number(f.failed_runs || 0) + Number(f.failed_items || 0),
    unavailableFiles: Number(r.unavailable_files || 0),
    trashedTextbooks: Number(r.trashed_textbooks || 0),
  };
}

export async function queryDriveTextbooksPaginated(params: {
  filters?: DriveTextbookFilters;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}) {
  await ensureDriveOAuthSchema();

  const page = Math.max(1, Number(params.page) || 1);
  const allowedSizes = [10, 25, 50, 100];
  const rawSize = Number(params.pageSize) || 25;
  const pageSize = allowedSizes.includes(rawSize) ? rawSize : Math.min(100, Math.max(10, rawSize));
  const offset = (page - 1) * pageSize;

  const sortColMap: Record<string, string> = {
    standard: 'standard',
    subject: 'subject',
    bookName: 'book_name',
    fileSize: 'file_size',
    modifiedDate: 'drive_modified_time',
    publicationStatus: 'publication_status',
  };
  const sortCol = sortColMap[params.sortBy || 'standard'] || 'standard';
  const sortDir = params.sortDir === 'desc' ? 'DESC' : 'ASC';

  const { clauses, params: whereParams, nextIdx } = buildFilterWhere(params.filters, 1);
  const whereSql = clauses.join(' AND ');

  const [countRes, rowsRes, facetsRes, liveCounts] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total FROM textbooks WHERE ${whereSql}`, whereParams),
    pool.query(
      `SELECT * FROM textbooks
       WHERE ${whereSql}
       ORDER BY ${sortCol} ${sortDir} NULLS LAST, standard ASC, book_name ASC
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      [...whereParams, pageSize, offset]
    ),
    pool.query(`
      SELECT
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT subject ORDER BY subject), NULL) AS subjects,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT COALESCE(volume, term) ORDER BY COALESCE(volume, term)), NULL) AS terms
      FROM textbooks
      WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NULL
    `),
    getDriveTextbookCounts(),
  ]);

  const total = Number(countRes.rows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items: rowsRes.rows.map(mapRow),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
    facets: {
      subjects: (facetsRes.rows[0]?.subjects || []) as string[],
      termsOrVolumes: (facetsRes.rows[0]?.terms || []) as string[],
    },
    counts: liveCounts,
  };
}

async function recordAuditLog(entry: {
  adminUsername: string;
  adminRole: string;
  action: string;
  scope: string;
  affectedCount: number;
  skippedCount: number;
  failedCount: number;
  details?: Record<string, any>;
}) {
  await pool.query(
    `INSERT INTO google_drive_textbook_audit_logs (
       admin_username, admin_role, action, scope,
       affected_count, skipped_count, failed_count, details
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      entry.adminUsername,
      entry.adminRole,
      entry.action,
      entry.scope,
      entry.affectedCount,
      entry.skippedCount,
      entry.failedCount,
      entry.details ? JSON.stringify(entry.details) : null,
    ]
  );
}

/**
 * Bulk Publish with dry-run summary, metadata validation, Drive availability check,
 * explicit Super Admin approval of pending records, and audit logging.
 */
export async function bulkPublishDriveTextbooks(req: BulkOperationRequest) {
  await ensureDriveOAuthSchema();

  const execute = async () => {
    const { whereSql, params } = buildScopeWhere(req);
    const rowsRes = await pool.query(
      `SELECT id, book_name, subject, standard, medium, review_status, publication_status, drive_available
       FROM textbooks
       WHERE ${whereSql}`,
      params
    );

    const rows = rowsRes.rows;
    const eligibleIds: number[] = [];
    let alreadyPublished = 0;
    let pendingReviewCount = 0;
    const failedValidation: Array<{ id: number; bookName: string; reason: string }> = [];

    for (const r of rows) {
      const pub = String(r.publication_status || 'PENDING_REVIEW').toUpperCase();
      const rev = String(r.review_status || 'PENDING_REVIEW').toUpperCase();

      if (pub === 'PUBLISHED') {
        alreadyPublished += 1;
        continue;
      }
      if (pub === 'REJECTED' || rev === 'REJECTED') {
        failedValidation.push({ id: Number(r.id), bookName: r.book_name, reason: 'Rejected textbook cannot be published.' });
        continue;
      }
      if (r.drive_available === false || pub === 'UNAVAILABLE') {
        failedValidation.push({ id: Number(r.id), bookName: r.book_name, reason: 'Google Drive PDF is unavailable or missing.' });
        continue;
      }
      if (!r.book_name || !r.subject || String(r.subject).toLowerCase() === 'unclassified') {
        failedValidation.push({ id: Number(r.id), bookName: r.book_name || `#${r.id}`, reason: 'Incomplete metadata (missing Subject or Title).' });
        continue;
      }
      if (rev !== 'APPROVED' && (pub === 'PENDING_REVIEW' || rev === 'PENDING_REVIEW' || rev === 'NEEDS_REVIEW')) {
        pendingReviewCount += 1;
        if (!req.approvePending) {
          failedValidation.push({
            id: Number(r.id),
            bookName: r.book_name,
            reason: 'Pending review: enable "Approve & Publish Pending" to publish.',
          });
          continue;
        }
      }
      eligibleIds.push(Number(r.id));
    }

    if (req.dryRun) {
      return {
        dryRun: true,
        totalMatched: rows.length,
        eligibleToPublish: eligibleIds.length,
        alreadyPublished,
        pendingReview: pendingReviewCount,
        failedValidationCount: failedValidation.length,
        failedValidation: failedValidation.slice(0, 25),
      };
    }

    let publishedCount = 0;
    const BATCH_SIZE = 100;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < eligibleIds.length; i += BATCH_SIZE) {
        const batch = eligibleIds.slice(i, i + BATCH_SIZE);
        const upd = await client.query(
          `UPDATE textbooks
           SET review_status = 'APPROVED',
               publication_status = 'PUBLISHED',
               published_by = $1,
               published_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ANY($2::int[]) AND deleted_at IS NULL`,
          [req.adminUsername, batch]
        );
        publishedCount += upd.rowCount || 0;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await recordAuditLog({
      adminUsername: req.adminUsername,
      adminRole: req.adminRole,
      action: 'BULK_PUBLISH',
      scope: req.scope,
      affectedCount: publishedCount,
      skippedCount: alreadyPublished,
      failedCount: failedValidation.length,
      details: { totalMatched: rows.length, approvePending: Boolean(req.approvePending) },
    });

    const counts = await getDriveTextbookCounts();
    return {
      dryRun: false,
      totalMatched: rows.length,
      publishedCount,
      skippedCount: alreadyPublished,
      failedCount: failedValidation.length,
      failedValidation: failedValidation.slice(0, 25),
      counts,
    };
  };

  return req.dryRun ? execute() : withBulkLock('BULK_PUBLISH', execute);
}

/**
 * Bulk Unpublish: sets publication_status = 'UNPUBLISHED', immediately hides from Student Library,
 * preserves Google Drive files and all metadata.
 */
export async function bulkUnpublishDriveTextbooks(req: BulkOperationRequest) {
  await ensureDriveOAuthSchema();

  const execute = async () => {
    const { whereSql, params } = buildScopeWhere(req);
    const matchRes = await pool.query(
      `SELECT id, publication_status FROM textbooks WHERE ${whereSql}`,
      params
    );
    const totalMatched = matchRes.rows.length;
    const toUnpublishIds = matchRes.rows
      .filter((r) => String(r.publication_status || '').toUpperCase() !== 'UNPUBLISHED')
      .map((r) => Number(r.id));
    const skippedCount = totalMatched - toUnpublishIds.length;

    if (req.dryRun) {
      return {
        dryRun: true,
        totalMatched,
        eligibleToUnpublish: toUnpublishIds.length,
        alreadyUnpublished: skippedCount,
      };
    }

    let unpublishedCount = 0;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (toUnpublishIds.length > 0) {
        const upd = await client.query(
          `UPDATE textbooks
           SET publication_status = 'UNPUBLISHED',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ANY($1::int[]) AND deleted_at IS NULL`,
          [toUnpublishIds]
        );
        unpublishedCount = upd.rowCount || 0;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await recordAuditLog({
      adminUsername: req.adminUsername,
      adminRole: req.adminRole,
      action: 'BULK_UNPUBLISH',
      scope: req.scope,
      affectedCount: unpublishedCount,
      skippedCount,
      failedCount: 0,
      details: { totalMatched },
    });

    const counts = await getDriveTextbookCounts();
    return {
      dryRun: false,
      totalMatched,
      unpublishedCount,
      skippedCount,
      counts,
    };
  };

  return req.dryRun ? execute() : withBulkLock('BULK_UNPUBLISH', execute);
}

/**
 * Safe Soft-Delete (Recoverable Trash): removes records from Admin list & Student Library,
 * NEVER deletes original Google Drive PDFs or unrelated tables, and logs audit history.
 */
export async function bulkSoftDeleteDriveTextbooks(req: BulkOperationRequest) {
  await ensureDriveOAuthSchema();

  if (req.scope !== 'selected' && !req.dryRun) {
    if (String(req.confirmPhrase || '').trim() !== 'DELETE ALL TEXTBOOKS') {
      const err: any = new Error(
        'Confirmation phrase mismatch. Type exact phrase "DELETE ALL TEXTBOOKS" to confirm global deletion.'
      );
      err.statusCode = 400;
      throw err;
    }
  }

  const execute = async () => {
    const { whereSql, params } = buildScopeWhere(req);
    const matchRes = await pool.query(`SELECT id FROM textbooks WHERE ${whereSql}`, params);
    const ids = matchRes.rows.map((r) => Number(r.id));

    if (req.dryRun) {
      return { dryRun: true, totalMatched: ids.length };
    }

    let deletedCount = 0;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (ids.length > 0) {
        const upd = await client.query(
          `UPDATE textbooks
           SET deleted_at = CURRENT_TIMESTAMP,
               deleted_by = $1,
               publication_status = 'UNPUBLISHED',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ANY($2::int[]) AND deleted_at IS NULL`,
          [req.adminUsername, ids]
        );
        deletedCount = upd.rowCount || 0;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await recordAuditLog({
      adminUsername: req.adminUsername,
      adminRole: req.adminRole,
      action: req.scope === 'selected' ? 'BULK_SOFT_DELETE_SELECTED' : 'BULK_SOFT_DELETE_GLOBAL',
      scope: req.scope,
      affectedCount: deletedCount,
      skippedCount: 0,
      failedCount: 0,
      details: { driveFilesPreserved: true, recoverableInTrash: true },
    });

    const counts = await getDriveTextbookCounts();
    return {
      dryRun: false,
      deletedCount,
      driveFilesPreserved: true,
      recoverableInTrash: true,
      counts,
    };
  };

  return req.dryRun ? execute() : withBulkLock('BULK_DELETE', execute);
}

export async function restoreTrashedDriveTextbooks(params: {
  ids?: number[];
  restoreAll?: boolean;
  adminUsername: string;
  adminRole: string;
}) {
  await ensureDriveOAuthSchema();

  const cleanIds = Array.from(
    new Set((params.ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))
  );

  let restoredCount = 0;
  if (params.restoreAll) {
    const res = await pool.query(
      `UPDATE textbooks
       SET deleted_at = NULL,
           deleted_by = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NOT NULL`
    );
    restoredCount = res.rowCount || 0;
  } else if (cleanIds.length > 0) {
    const res = await pool.query(
      `UPDATE textbooks
       SET deleted_at = NULL,
           deleted_by = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NOT NULL AND id = ANY($1::int[])`,
      [cleanIds]
    );
    restoredCount = res.rowCount || 0;
  }

  await recordAuditLog({
    adminUsername: params.adminUsername,
    adminRole: params.adminRole,
    action: 'RESTORE_FROM_TRASH',
    scope: params.restoreAll ? 'all' : 'selected',
    affectedCount: restoredCount,
    skippedCount: 0,
    failedCount: 0,
  });

  const counts = await getDriveTextbookCounts();
  return { restoredCount, counts };
}

export async function getDriveTextbookAuditLogs(limit = 30) {
  await ensureDriveOAuthSchema();
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  const res = await pool.query(
    `SELECT id, admin_username, admin_role, action, scope,
            affected_count, skipped_count, failed_count, details, created_at
     FROM google_drive_textbook_audit_logs
     ORDER BY created_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  return res.rows;
}
