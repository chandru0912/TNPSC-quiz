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
  startedAt: string;
  completedAt: string;
}

interface LiveDrivePdf {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderId: string;
  createdTime?: string;
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
  if (params.googleDriveFileId) {
    const byDriveId = await pool.query(
      `SELECT id FROM textbooks WHERE google_drive_file_id = $1 LIMIT 1`,
      [params.googleDriveFileId]
    );
    if (byDriveId.rows.length > 0) {
      return false;
    }
  }

  const existing = await pool.query(
    `SELECT id, google_drive_file_id FROM textbooks
     WHERE LOWER(book_name) = LOWER($1)
        OR (standard = $2 AND LOWER(subject) = LOWER($3) AND LOWER(COALESCE(medium, 'Tamil')) = LOWER($4) AND LOWER(COALESCE(term, 'Full Year')) = LOWER($5))
     ORDER BY id ASC
     LIMIT 1`,
    [params.bookName, params.standard, params.subject, params.medium, params.term]
  );

  if (existing.rows.length > 0) {
    if (params.googleDriveFileId && !existing.rows[0].google_drive_file_id) {
      await pool.query(
        `UPDATE textbooks SET google_drive_file_id = $1 WHERE id = $2 AND google_drive_file_id IS NULL`,
        [params.googleDriveFileId, existing.rows[0].id]
      );
    }
    return false;
  }

  await pool.query(
    `INSERT INTO textbooks (group_id, standard, subject, medium, term, book_name, file_size, google_drive_file_id, status, extraction_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', 'PENDING')`,
    [
      params.groupId,
      params.standard,
      params.subject,
      params.medium,
      params.term,
      params.bookName,
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
export async function syncGoogleDriveToDatabase(): Promise<DriveSyncSummary> {
  await ensureSyncSchema();
  // Prevent simultaneous duplicate sync operations (within 3 minutes)
  const runningRes = await pool.query(
    `SELECT id FROM google_drive_sync_logs
     WHERE status = 'RUNNING'
       AND started_at > NOW() - INTERVAL '3 minutes'
     ORDER BY id DESC LIMIT 1`
  );
  if (runningRes.rows.length > 0) {
    throw new Error('A Google Drive synchronization is already in progress. Please wait a moment and refresh.');
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
    const livePdfs = await listDriveFolderPdfsRecursive(drive, folderId);

    const nameCounts = new Map<string, number>();
    for (const f of livePdfs) {
      nameCounts.set(f.name, (nameCounts.get(f.name) || 0) + 1);
    }
    const duplicateDriveNames = Array.from(nameCounts.values()).filter((c) => c > 1).length;

    let insertedCount = 0;
    let updatedCount = 0;
    let textbooksSynced = 0;

    const liveIds = new Set<string>();

    for (const file of livePdfs) {
      liveIds.add(file.id);

      const existingRes = await pool.query(
        `SELECT id, file_name, tnpsc_group, subject, standard, medium, term, upload_status
         FROM google_drive_materials
         WHERE google_drive_file_id = $1
         ORDER BY id DESC
         LIMIT 1`,
        [file.id]
      );

      if (existingRes.rows.length > 0) {
        const row = existingRes.rows[0];
        await pool.query(
          `UPDATE google_drive_materials
           SET file_size = CASE WHEN $1 > 0 THEN $1 ELSE file_size END,
               google_drive_folder_id = $2,
               upload_status = 'completed',
               sync_status = 'ACTIVE',
               last_synced_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [file.size, file.folderId, row.id]
        );
        updatedCount++;

        if (row.standard && row.subject) {
          const addedTb = await ensureTextbookRecord({
            googleDriveFileId: file.id,
            bookName: row.file_name || file.name,
            groupId: row.tnpsc_group || 'group4',
            standard: Number(row.standard),
            subject: row.subject,
            medium: row.medium || 'Tamil',
            term: row.term || 'Full Year',
            fileSize: file.size,
          });
          if (addedTb) textbooksSynced++;
        }
      } else {
        const classified = classifyPdf({
          fileName: file.name,
          fileSize: file.size,
        });

        await pool.query(
          `INSERT INTO google_drive_materials (
             file_name, original_file_name, mime_type, file_size,
             google_drive_file_id, google_drive_folder_id,
             tnpsc_group, subject, standard, term, medium,
             applicable_groups, extracted_toc, classification_meta, confidence_score,
             upload_status, uploaded_by, extraction_status, sync_status, last_synced_at
           )
           VALUES (
             $1, $2, $3, $4,
             $5, $6,
             $7, $8, $9, $10, $11,
             $12::jsonb, $13::jsonb, $14::jsonb, $15,
             'completed', 'drive-sync', 'PENDING', 'ACTIVE', CURRENT_TIMESTAMP
           )`,
          [
            classified.bookName ? `${classified.bookName}.pdf` : file.name,
            file.name,
            file.mimeType,
            file.size,
            file.id,
            file.folderId,
            classified.primaryGroup || 'group4',
            classified.subject || 'General Studies',
            classified.standardNumber || 6,
            classified.term || 'Full Year',
            classified.medium || 'Tamil',
            JSON.stringify(classified.applicableGroups || ['group1', 'group2', 'group4']),
            JSON.stringify(classified.units || []),
            JSON.stringify(classified),
            classified.confidenceScore || 85,
          ]
        );
        insertedCount++;

        const addedTb = await ensureTextbookRecord({
          googleDriveFileId: file.id,
          bookName: classified.bookName ? `${classified.bookName}.pdf` : file.name,
          groupId: classified.primaryGroup || 'group4',
          standard: classified.standardNumber || 6,
          subject: classified.subject || 'General Studies',
          medium: classified.medium || 'Tamil',
          term: classified.term || 'Full Year',
          fileSize: file.size,
        });
        if (addedTb) textbooksSynced++;
      }
    }

    // Safely mark database records whose Google Drive file ID is no longer present in the Drive folder
    let missingCount = 0;
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

    const doneRes = await pool.query(
      `UPDATE google_drive_sync_logs
       SET status = 'COMPLETED',
           total_drive_files = $1,
           inserted_count = $2,
           updated_count = $3,
           missing_count = $4,
           duplicate_drive_names = $5,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING completed_at`,
      [livePdfs.length, insertedCount, updatedCount, missingCount, duplicateDriveNames, syncLogId]
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

export async function getLatestDriveSyncStatus() {
  await ensureSyncSchema();
  const res = await pool.query(
    `SELECT * FROM google_drive_sync_logs ORDER BY id DESC LIMIT 1`
  );
  return res.rows[0] || null;
}
