import { google } from 'googleapis';
import pool from '../db';
import { getAuthenticatedClient, getOrCreateTargetFolder } from './googleDriveService';
import { classifyPdf } from './bulkClassificationService';

export interface DriveSyncSummary {
  syncLogId: number;
  folderId: string;
  totalDriveFiles: number;
  insertedCount: number;
  updatedCount: number;
  missingCount: number;
  duplicateDriveNames: number;
  textbooksSynced: number;
  indexedCount: number;
  remainingToSync: number;
  hasMore: boolean;
  verifiedAllSynced: boolean;
  startedAt: string;
  completedAt: string;
}

export interface DriveSyncDiagnostic {
  folderId: string;
  foldersScanned: number;
  pageFetches: number;
  totalDriveItems: number;
  totalDrivePdfs: number;
  uniqueDrivePdfIds: number;
  indexedMaterialsCount: number;
  indexedTextbooksCount: number;
  missingFromMaterialsCount: number;
  missingFromTextbooksCount: number;
  duplicateMaterialIds: number;
  duplicateTextbookIds: number;
  missingPdfIds: Array<{ googleDriveFileId: string; fileName: string; size: number }>;
  failedSyncLogs: any[];
}

interface LiveDrivePdf {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderId: string;
  createdTime?: string;
}

function normalizeClassifiedDrivePdf(file: LiveDrivePdf) {
  const classified = classifyPdf({ fileName: file.name, fileSize: file.size });
  const rawLower = file.name.toLowerCase();

  let standard = classified.standardNumber || 6;
  let subject = classified.subject || 'General Studies';
  let medium: 'Tamil' | 'English' = classified.medium === 'English' ? 'English' : 'Tamil';
  let term = classified.term || 'Full Year';

  if (/11thth|class[_ -]?11|\b11th\b/i.test(rawLower)) standard = 11;
  else if (/class[_ -]?12|\b12th\b/i.test(rawLower)) standard = 12;

  if (/ethics\s*and\s*indian\s*culture/i.test(rawLower)) {
    subject = 'Ethics and Indian Culture';
    medium = /_em_|english/i.test(rawLower) ? 'English' : 'Tamil';
    term = 'Full Year';
  } else if (/advance\s*tamil/i.test(rawLower)) {
    subject = 'Advance Tamil';
    medium = 'Tamil';
  } else if (
    /(?:_english_|english_medium|\benglish\b|_em_)/i.test(rawLower) &&
    !/^class[_ -]?\d+[_ -]?english/i.test(rawLower) &&
    !/tamil_medium|_tm_/i.test(rawLower)
  ) {
    medium = 'English';
  }

  let bookName = classified.bookName || file.name.replace(/\.pdf$/i, '').trim();
  if (subject === 'Ethics and Indian Culture' || subject === 'Advance Tamil') {
    bookName = `Samacheer Kalvi ${standard}th Standard - ${subject} - ${term} - ${medium} Medium`;
  } else if (medium === 'English' && /tamil medium/i.test(bookName)) {
    bookName = bookName.replace(/tamil medium/gi, 'English Medium');
  }

  return {
    classified,
    standard,
    subject,
    medium,
    term,
    bookName,
    fileName: bookName.toLowerCase().endsWith('.pdf') ? bookName : `${bookName}.pdf`,
    groupId: classified.primaryGroup || 'group4',
  };
}

/**
 * Recursively lists all non-trashed PDF files inside the target Google Drive folder
 * and any nested subfolders, using nextPageToken pagination and Shared Drive support.
 */
async function listDriveFolderPdfsRecursive(
  drive: any,
  rootFolderId: string
): Promise<LiveDrivePdf[]> {
  const pdfs: LiveDrivePdf[] = [];
  const folderQueue: string[] = [rootFolderId];
  const visitedFolders = new Set<string>();

  while (folderQueue.length > 0) {
    const currentFolderId = folderQueue.shift()!;
    if (visitedFolders.has(currentFolderId)) continue;
    visitedFolders.add(currentFolderId);

    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: `'${currentFolderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, trashed)',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const items = res.data.files || [];
      for (const f of items) {
        if (f.trashed) continue;
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          if (f.id && !visitedFolders.has(f.id)) {
            folderQueue.push(f.id);
          }
        } else if (
          f.id &&
          (f.mimeType === 'application/pdf' || (f.name || '').toLowerCase().endsWith('.pdf'))
        ) {
          pdfs.push({
            id: f.id,
            name: f.name || `unnamed_${f.id}.pdf`,
            mimeType: f.mimeType || 'application/pdf',
            size: Number(f.size || 0),
            folderId: currentFolderId,
            createdTime: f.createdTime || undefined,
          });
        }
      }

      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
  }

  return pdfs;
}

/**
 * Ensures a matching textbook row exists in the `textbooks` table for an active Drive material
 * without duplicating existing textbook records.
 */
async function ensureTextbookRecord(params: {
  googleDriveFileId?: string;
  bookName: string;
  groupId: string;
  standard: number;
  subject: string;
  medium: string;
  term: string;
  fileSize: number;
}): Promise<boolean> {
  const cleanBookName = params.bookName.replace(/\.pdf$/i, '').trim();
  const driveFilePath = params.googleDriveFileId ? `gdrive://${params.googleDriveFileId}` : null;

  if (params.googleDriveFileId) {
    const byDriveId = await pool.query(
      `SELECT id, google_drive_file_id, file_path FROM textbooks
       WHERE google_drive_file_id = $1 OR file_path = $2
       ORDER BY id ASC
       LIMIT 1`,
      [params.googleDriveFileId, driveFilePath]
    );
    if (byDriveId.rows.length > 0) {
      const row = byDriveId.rows[0];
      // Backfill google_drive_file_id or file_path ONLY when missing — never overwrite a different Drive ID
      if (!row.google_drive_file_id && row.file_path === driveFilePath) {
        await pool.query(
          `UPDATE textbooks SET google_drive_file_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [params.googleDriveFileId, row.id]
        );
      } else if (row.google_drive_file_id === params.googleDriveFileId && !row.file_path) {
        await pool.query(
          `UPDATE textbooks SET file_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [driveFilePath, row.id]
        );
      }
      return false;
    }
  }

  // Only match an UNLINKED legacy textbook row (both google_drive_file_id IS NULL and file_path not pointing to another gdrive:// file)
  const existing = await pool.query(
    `SELECT id FROM textbooks
     WHERE google_drive_file_id IS NULL
       AND (file_path IS NULL OR file_path NOT LIKE 'gdrive://%')
       AND (
         LOWER(book_name) = LOWER($1)
         OR (standard = $2 AND LOWER(subject) = LOWER($3) AND LOWER(COALESCE(medium, 'Tamil')) = LOWER($4) AND LOWER(COALESCE(term, 'Full Year')) = LOWER($5))
       )
     ORDER BY id ASC
     LIMIT 1`,
    [cleanBookName, params.standard, params.subject, params.medium, params.term]
  );

  if (existing.rows.length > 0) {
    if (params.googleDriveFileId) {
      await pool.query(
        `UPDATE textbooks
         SET google_drive_file_id = $1,
             file_path = COALESCE(file_path, $2),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND google_drive_file_id IS NULL`,
        [params.googleDriveFileId, driveFilePath, existing.rows[0].id]
      );
    }
    return false;
  }

  await pool.query(
    `INSERT INTO textbooks (group_id, standard, subject, medium, term, book_name, file_path, file_size, google_drive_file_id, status, extraction_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed', 'PENDING')`,
    [
      params.groupId,
      params.standard,
      params.subject,
      params.medium,
      params.term,
      cleanBookName,
      driveFilePath,
      params.fileSize,
      params.googleDriveFileId || null,
    ]
  );
  return true;
}

let syncSchemaEnsured = false;

async function ensureSyncSchema(): Promise<void> {
  if (syncSchemaEnsured) return;
  await pool.query(`
    ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'ACTIVE';
    ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;
    CREATE INDEX IF NOT EXISTS idx_gdrive_materials_sync_status ON google_drive_materials (sync_status);
    CREATE TABLE IF NOT EXISTS google_drive_sync_logs (
      id SERIAL PRIMARY KEY,
      folder_id TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
      total_drive_files INT DEFAULT 0,
      inserted_count INT DEFAULT 0,
      updated_count INT DEFAULT 0,
      missing_count INT DEFAULT 0,
      duplicate_drive_names INT DEFAULT 0,
      error_message TEXT,
      started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP WITH TIME ZONE
    );
  `);
  syncSchemaEnsured = true;
}

/**
 * Synchronizes Google Drive folder contents into PostgreSQL (`google_drive_materials` & `textbooks`).
 * - Uses `google_drive_file_id` as the unique identifier.
 * - Prevents concurrent duplicate sync runs via `google_drive_sync_logs`.
 * - Preserves existing extraction results, page counts, and syllabus mappings on UPSERT.
 * - Marks orphaned DB records as `sync_status = 'MISSING_ON_DRIVE'` without deleting any data.
 */
export async function syncGoogleDriveToDatabase(options?: {
  maxDurationMs?: number;
  batchSize?: number;
}): Promise<DriveSyncSummary> {
  await ensureSyncSchema();
  const isVercel = Boolean(process.env.VERCEL);
  const maxDurationMs = options?.maxDurationMs ?? (isVercel ? 7500 : 120000);
  const batchSize = Math.max(1, Math.min(50, options?.batchSize ?? 25));
  const startedMs = Date.now();

  // Prevent simultaneous duplicate sync operations (45s lock window so timed-out serverless calls recover quickly)
  const runningRes = await pool.query(
    `SELECT id FROM google_drive_sync_logs
     WHERE status = 'RUNNING'
       AND started_at > NOW() - INTERVAL '45 seconds'
     ORDER BY id DESC LIMIT 1`
  );
  if (runningRes.rows.length > 0) {
    throw new Error('A Google Drive synchronization is already in progress. Please wait a few seconds and retry.');
  }

  const auth = await getAuthenticatedClient();
  const folderId = await getOrCreateTargetFolder(auth);
  const drive = google.drive({ version: 'v3', auth });

  const logInsert = await pool.query(
    `INSERT INTO google_drive_sync_logs (folder_id, status) VALUES ($1, 'RUNNING') RETURNING id, started_at`,
    [folderId]
  );
  const syncLogId = Number(logInsert.rows[0].id);
  const startedAt = new Date(logInsert.rows[0].started_at).toISOString();

  try {
    // 1. Fetch ALL live PDFs from Drive folder + subfolders using nextPageToken pagination
    const livePdfs = await listDriveFolderPdfsRecursive(drive, folderId);

    const nameCounts = new Map<string, number>();
    for (const f of livePdfs) {
      nameCounts.set(f.name, (nameCounts.get(f.name) || 0) + 1);
    }
    const duplicateDriveNames = Array.from(nameCounts.values()).filter((c) => c > 1).length;
    const liveIds = new Set<string>(livePdfs.map((f) => f.id));

    // 2. Bulk preload existing google_drive_materials & textbooks in 2 fast queries (eliminates 500+ serial round-trips!)
    const [existingGdmRes, existingTbRes] = await Promise.all([
      pool.query(
        `SELECT id, google_drive_file_id, file_name, file_size, google_drive_folder_id,
                tnpsc_group, subject, standard, medium, term, upload_status, sync_status
         FROM google_drive_materials
         WHERE google_drive_file_id IS NOT NULL`
      ),
      pool.query(
        `SELECT id, google_drive_file_id, file_path
         FROM textbooks`
      ),
    ]);

    const existingGdmByDriveId = new Map<string, any>();
    for (const r of existingGdmRes.rows) {
      if (r.google_drive_file_id) existingGdmByDriveId.set(r.google_drive_file_id, r);
    }

    const existingTbDriveIds = new Set<string>();
    const existingTbFilePaths = new Set<string>();
    for (const t of existingTbRes.rows) {
      if (t.google_drive_file_id) existingTbDriveIds.add(t.google_drive_file_id);
      if (t.file_path) existingTbFilePaths.add(t.file_path);
    }

    const newFiles: LiveDrivePdf[] = [];
    const existingDriveIdsToTouch: string[] = [];
    const missingTextbookSpecs: Array<{
      googleDriveFileId: string;
      bookName: string;
      groupId: string;
      standard: number;
      subject: string;
      medium: string;
      term: string;
      fileSize: number;
    }> = [];

    for (const file of livePdfs) {
      const existing = existingGdmByDriveId.get(file.id);
      if (existing) {
        existingDriveIdsToTouch.push(file.id);
        const drivePath = `gdrive://${file.id}`;
        if (!existingTbDriveIds.has(file.id) && !existingTbFilePaths.has(drivePath) && existing.standard && existing.subject) {
          missingTextbookSpecs.push({
            googleDriveFileId: file.id,
            bookName: String(existing.file_name || file.name).replace(/\.pdf$/i, '').trim(),
            groupId: existing.tnpsc_group || 'group4',
            standard: Number(existing.standard),
            subject: existing.subject,
            medium: existing.medium || 'Tamil',
            term: existing.term || 'Full Year',
            fileSize: file.size || Number(existing.file_size || 0),
          });
        }
      } else {
        newFiles.push(file);
      }
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let textbooksSynced = 0;
    let budgetReached = false;

    // 3. Single bulk UPDATE to refresh sync_status='ACTIVE' & last_synced_at on already-indexed files (never overwrites metadata!)
    if (existingDriveIdsToTouch.length > 0) {
      const touchRes = await pool.query(
        `UPDATE google_drive_materials
         SET upload_status = 'completed',
             sync_status = 'ACTIVE',
             last_synced_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE google_drive_file_id = ANY($1::text[])`,
        [existingDriveIdsToTouch]
      );
      updatedCount = touchRes.rowCount || existingDriveIdsToTouch.length;
    }

    // 4. Batch-insert ONLY missing Drive PDFs into google_drive_materials (incremental, never overwrites existing records)
    for (let i = 0; i < newFiles.length; i += batchSize) {
      if (Date.now() - startedMs >= maxDurationMs && i > 0) {
        budgetReached = true;
        break;
      }
      const slice = newFiles.slice(i, i + batchSize);
      const placeholders: string[] = [];
      const params: any[] = [];
      const cols = 15;

      for (let j = 0; j < slice.length; j++) {
        const file = slice[j];
        const norm = normalizeClassifiedDrivePdf(file);
        const base = j * cols;
        const ph = [];
        for (let c = 1; c <= cols; c++) ph.push(`$${base + c}`);
        placeholders.push(
          `(${ph[0]}, ${ph[1]}, ${ph[2]}, ${ph[3]}, ${ph[4]}, ${ph[5]}, ${ph[6]}, ${ph[7]}, ${ph[8]}, ${ph[9]}, ${ph[10]}, ${ph[11]}::jsonb, ${ph[12]}::jsonb, ${ph[13]}::jsonb, ${ph[14]}, 'completed', 'drive-sync', 'PENDING', 'ACTIVE', CURRENT_TIMESTAMP)`
        );
        params.push(
          norm.fileName,
          file.name,
          file.mimeType,
          file.size,
          file.id,
          file.folderId,
          norm.groupId,
          norm.subject,
          norm.standard,
          norm.term,
          norm.medium,
          JSON.stringify(norm.classified.applicableGroups || ['group1', 'group2', 'group4']),
          JSON.stringify(norm.classified.units || []),
          JSON.stringify(norm.classified),
          norm.classified.confidenceScore || 85
        );

        const drivePath = `gdrive://${file.id}`;
        if (!existingTbDriveIds.has(file.id) && !existingTbFilePaths.has(drivePath)) {
          missingTextbookSpecs.push({
            googleDriveFileId: file.id,
            bookName: norm.bookName,
            groupId: norm.groupId,
            standard: norm.standard,
            subject: norm.subject,
            medium: norm.medium,
            term: norm.term,
            fileSize: file.size,
          });
        }
      }

      const insRes = await pool.query(
        `INSERT INTO google_drive_materials (
           file_name, original_file_name, mime_type, file_size,
           google_drive_file_id, google_drive_folder_id,
           tnpsc_group, subject, standard, term, medium,
           applicable_groups, extracted_toc, classification_meta, confidence_score,
           upload_status, uploaded_by, extraction_status, sync_status, last_synced_at
         )
         VALUES ${placeholders.join(', ')}
         ON CONFLICT DO NOTHING`,
        params
      );
      insertedCount += insRes.rowCount || slice.length;
    }

    // 5. Batch-insert missing textbook catalog entries (1-to-1 by google_drive_file_id, never duplicates)
    for (let i = 0; i < missingTextbookSpecs.length; i += batchSize) {
      if (Date.now() - startedMs >= maxDurationMs && i > 0) {
        budgetReached = true;
        break;
      }
      const slice = missingTextbookSpecs.slice(i, i + batchSize);
      const placeholders: string[] = [];
      const params: any[] = [];
      const cols = 9;

      for (let j = 0; j < slice.length; j++) {
        const spec = slice[j];
        const base = j * cols;
        const ph = [];
        for (let c = 1; c <= cols; c++) ph.push(`$${base + c}`);
        placeholders.push(`(${ph.join(', ')}, 'completed', 'PENDING')`);
        params.push(
          spec.groupId,
          spec.standard,
          spec.subject,
          spec.medium,
          spec.term,
          spec.bookName,
          `gdrive://${spec.googleDriveFileId}`,
          spec.fileSize,
          spec.googleDriveFileId
        );
      }

      const tbInsRes = await pool.query(
        `INSERT INTO textbooks (
           group_id, standard, subject, medium, term, book_name, file_path, file_size, google_drive_file_id, status, extraction_status
         )
         VALUES ${placeholders.join(', ')}
         ON CONFLICT DO NOTHING`,
        params
      );
      textbooksSynced += tbInsRes.rowCount || 0;
    }

    // 6. Only mark MISSING_ON_DRIVE when full incremental sync completed without hitting time budget
    let missingCount = 0;
    if (!budgetReached) {
      const allDbRows = await pool.query(
        `SELECT id, google_drive_file_id FROM google_drive_materials WHERE COALESCE(sync_status, 'ACTIVE') != 'MISSING_ON_DRIVE'`
      );
      const missingIds = allDbRows.rows
        .filter((r) => !r.google_drive_file_id || !liveIds.has(r.google_drive_file_id))
        .map((r) => r.id);

      if (missingIds.length > 0) {
        const markRes = await pool.query(
          `UPDATE google_drive_materials
           SET sync_status = 'MISSING_ON_DRIVE',
               last_synced_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ANY($1::int[])`,
          [missingIds]
        );
        missingCount = markRes.rowCount || missingIds.length;
      }
    }

    // 7. Verify actual indexed count against live Drive file IDs before claiming success
    const verifyRes = await pool.query(
      `SELECT COUNT(DISTINCT google_drive_file_id)::int AS cnt
       FROM google_drive_materials
       WHERE COALESCE(sync_status, 'ACTIVE') = 'ACTIVE'
         AND google_drive_file_id = ANY($1::text[])`,
      [Array.from(liveIds)]
    );
    const indexedCount = Number(verifyRes.rows[0]?.cnt || 0);
    const remainingToSync = Math.max(0, liveIds.size - indexedCount);
    const hasMore = budgetReached || remainingToSync > 0;
    const finalStatus = hasMore ? 'PARTIAL' : 'COMPLETED';

    const doneRes = await pool.query(
      `UPDATE google_drive_sync_logs
       SET status = $1,
           total_drive_files = $2,
           inserted_count = $3,
           updated_count = $4,
           missing_count = $5,
           duplicate_drive_names = $6,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING completed_at`,
      [finalStatus, livePdfs.length, insertedCount, updatedCount, missingCount, duplicateDriveNames, syncLogId]
    );

    return {
      syncLogId,
      folderId,
      totalDriveFiles: livePdfs.length,
      insertedCount,
      updatedCount,
      missingCount,
      duplicateDriveNames,
      textbooksSynced,
      indexedCount,
      remainingToSync,
      hasMore,
      verifiedAllSynced: !hasMore && indexedCount === liveIds.size,
      startedAt,
      completedAt: new Date(doneRes.rows[0].completed_at).toISOString(),
    };
  } catch (err: any) {
    await pool.query(
      `UPDATE google_drive_sync_logs
       SET status = 'FAILED', error_message = $1, completed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [err.message || 'Sync failed', syncLogId]
    );
    throw err;
  }
}

/**
 * Read-only diagnostic audit comparing live Google Drive folder PDFs against PostgreSQL.
 */
export async function getDriveSyncDiagnostic(): Promise<DriveSyncDiagnostic> {
  await ensureSyncSchema();
  const auth = await getAuthenticatedClient();
  const rootFolderId = await getOrCreateTargetFolder(auth);
  const drive = google.drive({ version: 'v3', auth });

  const allItems: any[] = [];
  const pdfs: LiveDrivePdf[] = [];
  const folderQueue: string[] = [rootFolderId];
  const visited = new Set<string>();
  let pageFetches = 0;

  while (folderQueue.length > 0) {
    const currentFolderId = folderQueue.shift()!;
    if (visited.has(currentFolderId)) continue;
    visited.add(currentFolderId);

    let pageToken: string | undefined;
    do {
      pageFetches++;
      const res = await drive.files.list({
        q: `'${currentFolderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, trashed)',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      for (const f of res.data.files || []) {
        if (f.trashed) continue;
        allItems.push(f);
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          if (f.id && !visited.has(f.id)) folderQueue.push(f.id);
        } else if (f.id && (f.mimeType === 'application/pdf' || (f.name || '').toLowerCase().endsWith('.pdf'))) {
          pdfs.push({
            id: f.id,
            name: f.name || `unnamed_${f.id}.pdf`,
            mimeType: f.mimeType || 'application/pdf',
            size: Number(f.size || 0),
            folderId: currentFolderId,
            createdTime: f.createdTime || undefined,
          });
        }
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
  }

  const [gdmRes, tbRes, dupGdmRes, dupTbRes, failedLogsRes] = await Promise.all([
    pool.query(`SELECT google_drive_file_id FROM google_drive_materials WHERE COALESCE(sync_status, 'ACTIVE') = 'ACTIVE'`),
    pool.query(`SELECT google_drive_file_id, file_path FROM textbooks`),
    pool.query(`SELECT google_drive_file_id FROM google_drive_materials GROUP BY google_drive_file_id HAVING COUNT(*) > 1`),
    pool.query(`SELECT google_drive_file_id FROM textbooks WHERE google_drive_file_id IS NOT NULL GROUP BY google_drive_file_id HAVING COUNT(*) > 1`),
    pool.query(`SELECT id, status, total_drive_files, inserted_count, error_message, started_at, completed_at FROM google_drive_sync_logs WHERE status != 'COMPLETED' ORDER BY id DESC LIMIT 10`),
  ]);

  const gdmSet = new Set(gdmRes.rows.map((r) => r.google_drive_file_id).filter(Boolean));
  const tbSet = new Set(
    tbRes.rows.flatMap((r) => [
      r.google_drive_file_id,
      String(r.file_path || '').startsWith('gdrive://') ? String(r.file_path).replace('gdrive://', '').trim() : null,
    ]).filter(Boolean)
  );

  const missingPdfIds = pdfs
    .filter((p) => !gdmSet.has(p.id))
    .map((p) => ({ googleDriveFileId: p.id, fileName: p.name, size: p.size }));
  const missingFromTextbooksCount = pdfs.filter((p) => !tbSet.has(p.id)).length;

  return {
    folderId: rootFolderId,
    foldersScanned: visited.size,
    pageFetches,
    totalDriveItems: allItems.length,
    totalDrivePdfs: pdfs.length,
    uniqueDrivePdfIds: new Set(pdfs.map((p) => p.id)).size,
    indexedMaterialsCount: gdmSet.size,
    indexedTextbooksCount: tbSet.size,
    missingFromMaterialsCount: missingPdfIds.length,
    missingFromTextbooksCount,
    duplicateMaterialIds: dupGdmRes.rows.length,
    duplicateTextbookIds: dupTbRes.rows.length,
    missingPdfIds,
    failedSyncLogs: failedLogsRes.rows,
  };
}

export async function getLatestDriveSyncStatus() {
  await ensureSyncSchema();
  const res = await pool.query(
    `SELECT * FROM google_drive_sync_logs ORDER BY id DESC LIMIT 1`
  );
  return res.rows[0] || null;
}
