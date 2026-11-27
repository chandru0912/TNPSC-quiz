import { google } from 'googleapis';
import pool from '../db';
import {
  cleanCredential,
  getAuthenticatedClient,
  getConnectionStatus,
  getFileStream,
  withDriveRetry,
} from './googleDriveService';

export const TEXTBOOKS_ROOT_FOLDER_NAME = 'TNPSC Study Hub Textbooks';

export type TextbookPublicationStatus =
  | 'pending_review'
  | 'published'
  | 'unpublished'
  | 'unavailable';

export interface DriveTextbookRecord {
  id: number;
  googleDriveFileId: string;
  googleDriveParentFolderId: string | null;
  bookName: string;
  standard: number;
  medium: 'Tamil' | 'English';
  subject: string;
  term: string | null;
  volume: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  driveModifiedTime: string | null;
  driveFolderPath: string | null;
  driveAvailable: boolean;
  publicationStatus: TextbookPublicationStatus;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
}

export interface DriveTextbookSyncResult {
  syncLogId: number;
  rootFolderId: string;
  rootFolderName: string;
  foldersScanned: number;
  discoveredCount: number;
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  duplicateCount: number;
  unavailableCount: number;
  failedCount: number;
  errors: string[];
  startedAt: string;
  completedAt: string;
}

let schemaPromise: Promise<void> | null = null;

/**
 * Ensures metadata-only Google Drive Textbook Library columns and indexes exist on `textbooks`.
 * Strictly stores ONLY metadata & Google Drive file references — NEVER PDF binary data.
 */
export async function ensureDriveTextbookLibrarySchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS google_drive_file_id TEXT;
        ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS google_drive_parent_folder_id TEXT;
        ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS volume TEXT;
        ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS file_name TEXT;
        ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120) DEFAULT 'application/pdf';
        ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS drive_modified_time TIMESTAMPTZ;
        ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS drive_folder_path TEXT;
        ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS drive_available BOOLEAN DEFAULT true;
        ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS publication_status VARCHAR(24) DEFAULT 'pending_review';
        ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_textbooks_drive_file_id_unique
          ON textbooks (google_drive_file_id)
          WHERE google_drive_file_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_textbooks_library_hierarchy
          ON textbooks (publication_status, standard, medium, subject);

        CREATE TABLE IF NOT EXISTS drive_textbook_sync_logs (
          id SERIAL PRIMARY KEY,
          root_folder_id TEXT,
          root_folder_name TEXT,
          status VARCHAR(24) NOT NULL DEFAULT 'running',
          folders_scanned INT DEFAULT 0,
          discovered_count INT DEFAULT 0,
          inserted_count INT DEFAULT 0,
          updated_count INT DEFAULT 0,
          unchanged_count INT DEFAULT 0,
          duplicate_count INT DEFAULT 0,
          unavailable_count INT DEFAULT 0,
          failed_count INT DEFAULT 0,
          error_logs JSONB DEFAULT '[]'::jsonb,
          started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMPTZ
        );
      `);
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  await schemaPromise;
}

function mapTextbookRow(r: any): DriveTextbookRecord {
  const rawPub = String(r.publication_status || 'pending_review').trim().toLowerCase();
  const normalizedPub: TextbookPublicationStatus =
    r.drive_available === false || rawPub === 'unavailable'
      ? 'unavailable'
      : rawPub === 'published'
        ? 'published'
        : rawPub === 'unpublished'
          ? 'unpublished'
          : 'pending_review';
  return {
    id: Number(r.id),
    googleDriveFileId: String(r.google_drive_file_id || ''),
    googleDriveParentFolderId: r.google_drive_parent_folder_id || null,
    bookName: String(r.book_name || r.file_name || 'Untitled Textbook'),
    standard: Number(r.standard || 6),
    medium: String(r.medium || '').toLowerCase().includes('tamil') ? 'Tamil' : 'English',
    subject: String(r.subject || 'General'),
    term: r.term || null,
    volume: r.volume || null,
    fileName: String(r.file_name || r.book_name || 'textbook.pdf'),
    mimeType: String(r.mime_type || 'application/pdf'),
    fileSize: Number(r.file_size || 0),
    driveModifiedTime: r.drive_modified_time ? new Date(r.drive_modified_time).toISOString() : null,
    driveFolderPath: r.drive_folder_path || null,
    driveAvailable: r.drive_available !== false,
    publicationStatus: normalizedPub,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    lastSyncedAt: r.last_synced_at ? new Date(r.last_synced_at).toISOString() : null,
  };
}

/**
 * Classifies Standard (6-12), Term (6-10), Volume (11-12), Medium (Tamil/English),
 * Subject, and clean Book Name purely from actual Google Drive folder path + filename.
 */
export function classifyDriveTextbookMetadata(
  fileName: string,
  folderSegments: string[]
): {
  standard: number;
  medium: 'Tamil' | 'English';
  subject: string;
  term: string | null;
  volume: string | null;
  bookName: string;
} {
  const combined = [...folderSegments, fileName].join(' / ');
  const lower = combined.toLowerCase();

  // 1. Standard (6..12)
  let standard = 6;
  const stdPatterns = [
    /\b(12|11|10|9|8|7|6)(?:th)?\s*(?:std|standard|class)\b/i,
    /\b(?:std|standard|class|grade)[\s._-]*(12|11|10|9|8|7|6)\b/i,
    /\b(12|11|10|9|8|7|6)th\b/i,
    /(?:^|[\s/_-])(12|11|10|9|8|7|6)(?:$|[\s/_-])/,
  ];
  for (const pat of stdPatterns) {
    const m = combined.match(pat);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (n >= 6 && n <= 12) {
        standard = n;
        break;
      }
    }
  }

  // Normalize underscores/hyphens/dots to spaces so \b matches cleanly on filenames like "12th_History_Vol1_TM.pdf"
  const normalizedCombined = combined.replace(/[_.-]+/g, ' ');

  // 2. Medium (Tamil vs English)
  let medium: 'Tamil' | 'English' = 'English';
  if (/tamil\s*medium|\btm\b|தமிழ்\s*வழி/i.test(normalizedCombined)) {
    medium = 'Tamil';
  } else if (/english\s*medium|\bem\b|ஆங்கில\s*வழி/i.test(normalizedCombined)) {
    medium = 'English';
  } else if (/[\u0B80-\u0BFF]/.test(fileName)) {
    medium = 'Tamil';
  }

  // 3. Term (for 6-10) & Volume (for 11-12) — never force Term on 11-12 or Volume on 6-10
  let term: string | null = null;
  let volume: string | null = null;

  const termMatch = normalizedCombined.match(/\bterm\s*([1-3]|i{1,3})\b|பருவம்\s*([1-3])/i);
  const volMatch = normalizedCombined.match(/\bvol(?:ume)?\s*([1-3]|i{1,3})\b|தொகுதி\s*([1-3])/i);

  const romanToDigit = (v: string) => {
    const u = v.toUpperCase();
    if (u === 'I') return '1';
    if (u === 'II') return '2';
    if (u === 'III') return '3';
    return v;
  };

  if (standard <= 10) {
    if (termMatch) {
      const num = romanToDigit(termMatch[1] || termMatch[2] || '1');
      term = `Term ${num}`;
    } else if (/full\s*year|combined|full\s*book/i.test(lower)) {
      term = 'Full Book';
    }
  } else {
    if (volMatch) {
      const num = romanToDigit(volMatch[1] || volMatch[2] || '1');
      volume = `Volume ${num}`;
    } else if (/full\s*book|single\s*volume/i.test(lower)) {
      volume = 'Full Book';
    }
  }

  // 4. Subject detection
  const subjectRules: Array<[RegExp, string]> = [
    [/social\s*science|சமூக\s*அறிவியல்/i, 'Social Science'],
    [/computer\s*science|கணினி\s*அறிவியல்/i, 'Computer Science'],
    [/computer\s*applications/i, 'Computer Applications'],
    [/ethics\s*(?:and|&)\s*indian\s*culture|அறவியலும்\s*இந்தியப்\s*பண்பாடும்/i, 'Ethics and Indian Culture'],
    [/political\s*science|indian\s*polity|அரசியல்\s*அறிவியல்/i, 'Political Science'],
    [/math(?:ematics|s)?|கணிதம்/i, 'Mathematics'],
    [/physics|இயற்பியல்/i, 'Physics'],
    [/chemistry|வேதியியல்/i, 'Chemistry'],
    [/botany|தாவரவியல்/i, 'Botany'],
    [/zoology|விலங்கியல்/i, 'Zoology'],
    [/biology|உயிரியல்/i, 'Biology'],
    [/science|அறிவியல்/i, 'Science'],
    [/history|வரலாறு/i, 'History'],
    [/geography|புவியியல்/i, 'Geography'],
    [/economics|பொருளியல்/i, 'Economics'],
    [/commerce|வணிகவியல்/i, 'Commerce'],
    [/accountancy|கணக்குப்பதிவியல்/i, 'Accountancy'],
    [/statistics|புள்ளியியல்/i, 'Statistics'],
    [/advance\s*tamil|சிறப்புத்?\s*தமிழ்/i, 'Advance Tamil'],
    [/\btamil\b|பொதுத்தமிழ்|தமிழ்/i, 'Tamil'],
    [/\benglish\b|ஆங்கிலம்/i, 'English'],
  ];

  let subject = 'General Studies';
  // Normalize underscores/hyphens/dots to spaces so multi-word subjects like "Social_Science" match reliably
  const subjectHint = [
    ...folderSegments.filter((seg) => !/medium|term|vol|standard|std|class|textbook/i.test(seg)),
    fileName
      .replace(/\.pdf$/i, '')
      .replace(/[_.-]+/g, ' ')
      .replace(/english\s*medium|tamil\s*medium/gi, ''),
  ]
    .join(' ')
    .replace(/[_.-]+/g, ' ');
  for (const [pat, label] of subjectRules) {
    if (pat.test(subjectHint)) {
      subject = label;
      break;
    }
  }

  // Clean book name preserving original filename readability
  const baseName = fileName
    .replace(/\.pdf$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    standard,
    medium,
    subject,
    term,
    volume,
    bookName: baseName || `${standard}th Std ${subject}`,
  };
}

/**
 * Locates the existing root folder named "TNPSC Study Hub Textbooks" (or GOOGLE_DRIVE_TEXTBOOKS_FOLDER_ID).
 * Never creates duplicate folders.
 */
export async function locateTextbooksRootFolder(
  authClient: any,
  customFolderName?: string
): Promise<{ folderId: string; folderName: string }> {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const envFolderId = cleanCredential(process.env.GOOGLE_DRIVE_TEXTBOOKS_FOLDER_ID);

  if (envFolderId && !customFolderName) {
    const existing = await withDriveRetry<any>(() =>
      drive.files.get({
        fileId: envFolderId,
        fields: 'id, name, trashed, mimeType',
        supportsAllDrives: true,
      })
    );
    if (existing.data?.id && !existing.data.trashed) {
      return { folderId: existing.data.id, folderName: existing.data.name || TEXTBOOKS_ROOT_FOLDER_NAME };
    }
  }

  const targetName = (customFolderName || TEXTBOOKS_ROOT_FOLDER_NAME).trim();
  const q = `name = '${targetName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const listRes = await withDriveRetry<any>(() =>
    drive.files.list({
      q,
      spaces: 'drive',
      fields: 'files(id, name, modifiedTime)',
      pageSize: 5,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
  );

  if (listRes.data.files && listRes.data.files.length > 0 && listRes.data.files[0].id) {
    return {
      folderId: listRes.data.files[0].id,
      folderName: listRes.data.files[0].name || targetName,
    };
  }

  const err: any = new Error(
    `Google Drive folder "${targetName}" was not found. Please ensure the folder exists and is accessible by the connected Google account (or configure GOOGLE_DRIVE_TEXTBOOKS_FOLDER_ID).`
  );
  err.statusCode = 404;
  throw err;
}

/**
 * Recursively scans Google Drive folder metadata ONLY (zero PDF downloads!)
 * and synchronizes discovered 6th–12th Standard textbook metadata into Neon PostgreSQL.
 * Strictly separate from AI/OCR extraction — NEVER triggers OCR or AI processing.
 */
export async function syncGoogleDriveTextbooksMetadata(options?: {
  folderName?: string;
}): Promise<DriveTextbookSyncResult> {
  await ensureDriveTextbookLibrarySchema();
  const startedAt = new Date().toISOString();

  const authClient = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth: authClient });
  const { folderId: rootFolderId, folderName: rootFolderName } = await locateTextbooksRootFolder(
    authClient,
    options?.folderName
  );

  const logInsert = await pool.query(
    `INSERT INTO drive_textbook_sync_logs (root_folder_id, root_folder_name, status, started_at)
     VALUES ($1, $2, 'running', CURRENT_TIMESTAMP)
     RETURNING id`,
    [rootFolderId, rootFolderName]
  );
  const syncLogId = Number(logInsert.rows[0].id);

  const errors: string[] = [];
  let foldersScanned = 0;
  let insertedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;

  const discoveredFileIds = new Set<string>();
  const discoveredFiles: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    parentFolderId: string;
    modifiedTime: string | null;
    folderSegments: string[];
  }> = [];

  try {
    // Recursive BFS scan of subfolders (metadata-only, paginated 1000/page)
    const queue: Array<{ id: string; segments: string[] }> = [{ id: rootFolderId, segments: [] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      foldersScanned += 1;

      let pageToken: string | undefined;
      do {
        const res = await withDriveRetry<any>(() =>
          drive.files.list({
            q: `'${current.id}' in parents and trashed = false`,
            fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)',
            pageSize: 1000,
            pageToken,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          })
        );

        const files = res.data?.files || [];
        for (const f of files) {
          if (!f.id || !f.name) continue;
          if (f.mimeType === 'application/vnd.google-apps.folder') {
            queue.push({ id: f.id, segments: [...current.segments, f.name] });
          } else if (f.mimeType === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
            if (discoveredFileIds.has(f.id)) {
              duplicateCount += 1;
              continue;
            }
            discoveredFileIds.add(f.id);
            discoveredFiles.push({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType || 'application/pdf',
              size: Number(f.size || 0),
              parentFolderId: current.id,
              modifiedTime: f.modifiedTime || null,
              folderSegments: current.segments,
            });
          }
        }
        pageToken = res.data?.nextPageToken || undefined;
      } while (pageToken);
    }

    // Load existing synced Drive records for incremental diffing
    const existingRes = await pool.query(
      `SELECT id, google_drive_file_id, file_size, drive_modified_time, drive_available
       FROM textbooks
       WHERE google_drive_file_id IS NOT NULL`
    );
    const existingByDriveId = new Map<string, any>();
    for (const r of existingRes.rows) {
      existingByDriveId.set(String(r.google_drive_file_id), r);
    }

    for (const file of discoveredFiles) {
      try {
        const meta = classifyDriveTextbookMetadata(file.name, file.folderSegments);
        const folderPath = [rootFolderName, ...file.folderSegments].join(' / ');
        const existing = existingByDriveId.get(file.id);

        if (existing) {
          const prevMod = existing.drive_modified_time
            ? new Date(existing.drive_modified_time).toISOString()
            : null;
          const nextMod = file.modifiedTime ? new Date(file.modifiedTime).toISOString() : null;
          const changed =
            Number(existing.file_size || 0) !== file.size ||
            prevMod !== nextMod ||
            existing.drive_available === false;

          if (changed) {
            await pool.query(
              `UPDATE textbooks
               SET google_drive_parent_folder_id = $1,
                   file_name = $2,
                   mime_type = $3,
                   file_size = $4,
                   drive_modified_time = $5,
                   drive_folder_path = $6,
                   drive_available = true,
                   publication_status = CASE WHEN publication_status = 'unavailable' THEN 'pending_review' ELSE publication_status END,
                   last_synced_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $7`,
              [
                file.parentFolderId,
                file.name,
                file.mimeType,
                file.size,
                nextMod,
                folderPath,
                existing.id,
              ]
            );
            updatedCount += 1;
          } else {
            await pool.query(`UPDATE textbooks SET last_synced_at = CURRENT_TIMESTAMP WHERE id = $1`, [
              existing.id,
            ]);
            unchangedCount += 1;
          }
        } else {
          const groupId = meta.standard >= 11 ? 'group1' : 'group4';
          await pool.query(
            `INSERT INTO textbooks (
               group_id, standard, subject, medium, term, volume, book_name,
               file_path, file_name, mime_type, file_size,
               google_drive_file_id, google_drive_parent_folder_id,
               drive_modified_time, drive_folder_path, drive_available,
               publication_status, status, last_synced_at, updated_at
             )
             VALUES (
               $1, $2, $3, $4, $5, $6, $7,
               $8, $9, $10, $11,
               $12, $13,
               $14, $15, true,
               'pending_review', 'uploaded', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
             )
             ON CONFLICT (group_id, standard, subject, medium, term, book_name) DO UPDATE SET
               google_drive_file_id = EXCLUDED.google_drive_file_id,
               google_drive_parent_folder_id = EXCLUDED.google_drive_parent_folder_id,
               volume = COALESCE(EXCLUDED.volume, textbooks.volume),
               file_name = EXCLUDED.file_name,
               mime_type = EXCLUDED.mime_type,
               file_size = EXCLUDED.file_size,
               drive_modified_time = EXCLUDED.drive_modified_time,
               drive_folder_path = EXCLUDED.drive_folder_path,
               drive_available = true,
               last_synced_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP`,
            [
              groupId,
              meta.standard,
              meta.subject,
              meta.medium,
              meta.term || (meta.standard >= 11 ? meta.volume || 'Full Book' : 'Full Year'),
              meta.volume,
              meta.bookName,
              `gdrive://${file.id}`,
              file.name,
              file.mimeType,
              file.size,
              file.id,
              file.parentFolderId,
              file.modifiedTime ? new Date(file.modifiedTime).toISOString() : null,
              folderPath,
            ]
          );
          insertedCount += 1;
        }
      } catch (fileErr: any) {
        failedCount += 1;
        errors.push(`${file.name}: ${fileErr?.message || 'Metadata sync error'}`);
      }
    }

    // Mark previously synced Drive files missing from Drive as unavailable (NEVER delete Drive files!)
    let unavailableCount = 0;
    for (const [driveId, row] of existingByDriveId.entries()) {
      if (!discoveredFileIds.has(driveId) && row.drive_available !== false) {
        await pool.query(
          `UPDATE textbooks
           SET drive_available = false,
               publication_status = 'unavailable',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [row.id]
        );
        unavailableCount += 1;
      }
    }

    const completedAt = new Date().toISOString();
    await pool.query(
      `UPDATE drive_textbook_sync_logs
       SET status = $1,
           folders_scanned = $2,
           discovered_count = $3,
           inserted_count = $4,
           updated_count = $5,
           unchanged_count = $6,
           duplicate_count = $7,
           unavailable_count = $8,
           failed_count = $9,
           error_logs = $10::jsonb,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $11`,
      [
        failedCount > 0 ? 'partial' : 'completed',
        foldersScanned,
        discoveredFiles.length,
        insertedCount,
        updatedCount,
        unchangedCount,
        duplicateCount,
        unavailableCount,
        failedCount,
        JSON.stringify(errors.slice(0, 50)),
        syncLogId,
      ]
    );

    return {
      syncLogId,
      rootFolderId,
      rootFolderName,
      foldersScanned,
      discoveredCount: discoveredFiles.length,
      insertedCount,
      updatedCount,
      unchangedCount,
      duplicateCount,
      unavailableCount,
      failedCount,
      errors,
      startedAt,
      completedAt,
    };
  } catch (err: any) {
    await pool.query(
      `UPDATE drive_textbook_sync_logs
       SET status = 'failed',
           error_logs = $1::jsonb,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify([err?.message || 'Drive sync failed']), syncLogId]
    );
    throw err;
  }
}

export async function getAdminDriveTextbooksOverview() {
  await ensureDriveTextbookLibrarySchema();
  const [countsRes, logsRes, driveStatus] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NULL)::int AS total_synchronized,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NULL AND LOWER(COALESCE(publication_status, 'pending_review')) = 'pending_review')::int AS pending_review,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NULL AND LOWER(COALESCE(publication_status, '')) = 'published' AND COALESCE(drive_available, true) = true)::int AS published_count,
        COUNT(*) FILTER (WHERE google_drive_file_id IS NOT NULL AND deleted_at IS NULL AND (COALESCE(drive_available, true) = false OR LOWER(COALESCE(publication_status, '')) = 'unavailable'))::int AS unavailable_count
      FROM textbooks
    `),
    pool.query(`
      SELECT * FROM drive_textbook_sync_logs
      ORDER BY started_at DESC
      LIMIT 10
    `),
    getConnectionStatus(false),
  ]);

  const c = countsRes.rows[0] || {};
  const lastLog = logsRes.rows[0] || null;
  return {
    driveStatus,
    rootFolderName: lastLog?.root_folder_name || TEXTBOOKS_ROOT_FOLDER_NAME,
    totalDiscovered: Number(lastLog?.discovered_count ?? c.total_synchronized ?? 0),
    totalSynchronized: Number(c.total_synchronized || 0),
    pendingReview: Number(c.pending_review || 0),
    publishedTextbooks: Number(c.published_count || 0),
    failedSync: Number(lastLog?.failed_count || 0),
    unavailableDriveFiles: Number(c.unavailable_count || 0),
    recentLogs: logsRes.rows.map((l: any) => ({
      id: Number(l.id),
      rootFolderName: l.root_folder_name,
      status: l.status,
      foldersScanned: Number(l.folders_scanned || 0),
      discoveredCount: Number(l.discovered_count || 0),
      insertedCount: Number(l.inserted_count || 0),
      updatedCount: Number(l.updated_count || 0),
      failedCount: Number(l.failed_count || 0),
      unavailableCount: Number(l.unavailable_count || 0),
      errorLogs: Array.isArray(l.error_logs) ? l.error_logs : [],
      startedAt: l.started_at,
      completedAt: l.completed_at,
    })),
  };
}

export interface LibraryFacetOption {
  value: string;
  label: string;
  count: number;
}

export interface LibraryFacets {
  standards: LibraryFacetOption[];
  termsOrVolumes: LibraryFacetOption[];
  mediums: LibraryFacetOption[];
  subjects: LibraryFacetOption[];
  statuses: LibraryFacetOption[];
}

function buildLibraryWhere(
  filters: {
    standard?: string;
    termOrVolume?: string;
    medium?: string;
    subject?: string;
    publicationStatus?: string;
    search?: string;
  },
  excludeField?: 'standard' | 'termOrVolume' | 'medium' | 'subject' | 'publicationStatus'
): { whereSql: string; params: any[] } {
  const conditions: string[] = ['google_drive_file_id IS NOT NULL', 'deleted_at IS NULL'];
  const params: any[] = [];

  if (excludeField !== 'standard' && filters.standard && filters.standard !== 'all') {
    const parsedStd = Number(String(filters.standard).replace(/[^0-9]/g, ''));
    if (Number.isInteger(parsedStd) && parsedStd >= 6 && parsedStd <= 12) {
      params.push(parsedStd);
      conditions.push(`standard = $${params.length}`);
    }
  }
  if (excludeField !== 'termOrVolume' && filters.termOrVolume && filters.termOrVolume !== 'all') {
    const cleanTv = filters.termOrVolume.trim();
    if (cleanTv) {
      params.push(cleanTv);
      conditions.push(
        `(LOWER(TRIM(COALESCE(term, ''))) = LOWER($${params.length}) OR LOWER(TRIM(COALESCE(volume, ''))) = LOWER($${params.length}))`
      );
    }
  }
  if (excludeField !== 'medium' && filters.medium && filters.medium !== 'all') {
    const cleanMed = filters.medium.trim();
    if (cleanMed) {
      params.push(cleanMed);
      conditions.push(`LOWER(TRIM(COALESCE(medium, ''))) = LOWER($${params.length})`);
    }
  }
  if (excludeField !== 'subject' && filters.subject && filters.subject !== 'all' && filters.subject.trim()) {
    params.push(filters.subject.trim());
    conditions.push(`LOWER(TRIM(COALESCE(subject, ''))) = LOWER($${params.length})`);
  }
  if (excludeField !== 'publicationStatus' && filters.publicationStatus && filters.publicationStatus !== 'all') {
    const cleanStatus = filters.publicationStatus.trim().toLowerCase();
    if (cleanStatus === 'unavailable') {
      conditions.push(`(COALESCE(drive_available, true) = false OR LOWER(COALESCE(publication_status, '')) = 'unavailable')`);
    } else if (cleanStatus === 'approved') {
      conditions.push(`LOWER(COALESCE(review_status, '')) = 'approved'`);
    } else if (cleanStatus) {
      params.push(cleanStatus);
      conditions.push(`LOWER(COALESCE(publication_status, 'pending_review')) = $${params.length}`);
    }
  }
  if (filters.search && filters.search.trim()) {
    params.push(`%${filters.search.trim()}%`);
    const p = `$${params.length}`;
    conditions.push(
      `(
        book_name ILIKE ${p}
        OR COALESCE(file_name, '') ILIKE ${p}
        OR COALESCE(subject, '') ILIKE ${p}
        OR COALESCE(medium, '') ILIKE ${p}
        OR COALESCE(term, '') ILIKE ${p}
        OR COALESCE(volume, '') ILIKE ${p}
        OR (CAST(standard AS TEXT) || 'th Standard') ILIKE ${p}
        OR COALESCE(google_drive_file_id, '') ILIKE ${p}
        OR COALESCE(drive_folder_path, '') ILIKE ${p}
      )`
    );
  }

  return { whereSql: conditions.join(' AND '), params };
}

const LIB_TERM_VOL_ORDER: Record<string, number> = {
  'term 1': 1,
  'term 2': 2,
  'term 3': 3,
  'volume 1': 4,
  'volume 2': 5,
  'volume 3': 6,
  'full year': 7,
  'full book': 8,
};

const LIB_STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  published: 'Published',
  unpublished: 'Unpublished',
  rejected: 'Rejected',
  unavailable: 'Unavailable',
};

export async function getAdminDriveTextbookFacets(filters: {
  standard?: string;
  termOrVolume?: string;
  medium?: string;
  subject?: string;
  publicationStatus?: string;
  search?: string;
} = {}): Promise<LibraryFacets> {
  await ensureDriveTextbookLibrarySchema();

  const stdW = buildLibraryWhere(filters, 'standard');
  const tvW = buildLibraryWhere(filters, 'termOrVolume');
  const medW = buildLibraryWhere(filters, 'medium');
  const subW = buildLibraryWhere(filters, 'subject');
  const stW = buildLibraryWhere(filters, 'publicationStatus');

  const [stdRes, tvRes, medRes, subRes, stRes] = await Promise.all([
    pool.query(
      `SELECT standard AS val, COUNT(*)::int AS cnt
       FROM textbooks
       WHERE ${stdW.whereSql} AND standard IS NOT NULL
       GROUP BY standard
       ORDER BY standard ASC`,
      stdW.params
    ),
    pool.query(
      `SELECT val, COUNT(*)::int AS cnt
       FROM (
         SELECT NULLIF(TRIM(COALESCE(NULLIF(TRIM(volume), ''), NULLIF(TRIM(term), ''))), '') AS val
         FROM textbooks
         WHERE ${tvW.whereSql}
       ) t
       WHERE val IS NOT NULL
       GROUP BY val
       ORDER BY val ASC`,
      tvW.params
    ),
    pool.query(
      `SELECT
         CASE WHEN LOWER(TRIM(COALESCE(medium, ''))) LIKE '%tamil%' THEN 'Tamil' ELSE 'English' END AS val,
         COUNT(*)::int AS cnt
       FROM textbooks
       WHERE ${medW.whereSql}
       GROUP BY 1
       ORDER BY 1 ASC`,
      medW.params
    ),
    pool.query(
      `SELECT TRIM(subject) AS val, COUNT(*)::int AS cnt
       FROM textbooks
       WHERE ${subW.whereSql} AND subject IS NOT NULL AND TRIM(subject) <> ''
       GROUP BY TRIM(subject)
       ORDER BY TRIM(subject) ASC`,
      subW.params
    ),
    pool.query(
      `SELECT
         CASE
           WHEN COALESCE(drive_available, true) = false OR LOWER(COALESCE(publication_status, '')) = 'unavailable' THEN 'unavailable'
           ELSE LOWER(COALESCE(publication_status, 'pending_review'))
         END AS val,
         COUNT(*)::int AS cnt
       FROM textbooks
       WHERE ${stW.whereSql}
       GROUP BY 1
       ORDER BY 1 ASC`,
      stW.params
    ),
  ]);

  const standards: LibraryFacetOption[] = stdRes.rows
    .map((r) => ({ value: String(r.val), label: `${r.val}th Standard`, count: Number(r.cnt || 0) }))
    .filter((o) => o.count > 0);

  const termsOrVolumes: LibraryFacetOption[] = tvRes.rows
    .map((r) => ({ value: String(r.val), label: String(r.val), count: Number(r.cnt || 0) }))
    .filter((o) => o.count > 0)
    .sort((a, b) => {
      const oa = LIB_TERM_VOL_ORDER[a.value.toLowerCase()] ?? 99;
      const ob = LIB_TERM_VOL_ORDER[b.value.toLowerCase()] ?? 99;
      return oa !== ob ? oa - ob : a.label.localeCompare(b.label);
    });

  const mediums: LibraryFacetOption[] = medRes.rows
    .map((r) => ({
      value: String(r.val),
      label: r.val === 'Tamil' ? 'Tamil Medium' : 'English Medium',
      count: Number(r.cnt || 0),
    }))
    .filter((o) => o.count > 0)
    .sort((a, b) => (a.value === 'Tamil' ? -1 : b.value === 'Tamil' ? 1 : a.label.localeCompare(b.label)));

  const subjects: LibraryFacetOption[] = subRes.rows
    .map((r) => ({ value: String(r.val), label: String(r.val), count: Number(r.cnt || 0) }))
    .filter((o) => o.count > 0);

  const statusOrder = ['pending_review', 'approved', 'published', 'unpublished', 'rejected', 'unavailable'];
  const statuses: LibraryFacetOption[] = stRes.rows
    .map((r) => {
      const val = String(r.val || 'pending_review').toLowerCase();
      return {
        value: val,
        label: LIB_STATUS_LABELS[val] || val.replace(/_/g, ' '),
        count: Number(r.cnt || 0),
      };
    })
    .filter((o) => o.count > 0)
    .sort((a, b) => {
      const ia = statusOrder.indexOf(a.value);
      const ib = statusOrder.indexOf(b.value);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  return { standards, termsOrVolumes, mediums, subjects, statuses };
}

export async function listAdminDriveTextbooks(filters: {
  standard?: string;
  termOrVolume?: string;
  medium?: string;
  subject?: string;
  publicationStatus?: string;
  search?: string;
} = {}): Promise<DriveTextbookRecord[]> {
  await ensureDriveTextbookLibrarySchema();
  const { whereSql, params } = buildLibraryWhere(filters);

  const res = await pool.query(
    `SELECT * FROM textbooks
     WHERE ${whereSql}
     ORDER BY standard ASC, medium ASC, subject ASC, term ASC NULLS LAST, volume ASC NULLS LAST, book_name ASC`,
    params
  );

  return res.rows.map(mapTextbookRow);
}

export async function updateDriveTextbookMetadata(
  id: number,
  patch: {
    bookName?: string;
    standard?: number;
    medium?: 'Tamil' | 'English';
    subject?: string;
    term?: string | null;
    volume?: string | null;
  }
): Promise<DriveTextbookRecord | null> {
  await ensureDriveTextbookLibrarySchema();
  const curRes = await pool.query(`SELECT * FROM textbooks WHERE id = $1`, [id]);
  if (curRes.rows.length === 0) return null;
  const cur = curRes.rows[0];

  const nextStd = patch.standard && patch.standard >= 6 && patch.standard <= 12 ? patch.standard : Number(cur.standard);
  const nextMed = patch.medium === 'Tamil' || patch.medium === 'English' ? patch.medium : cur.medium;
  const nextSubj = patch.subject?.trim() || cur.subject;
  const nextTerm = patch.term !== undefined ? (patch.term ? patch.term.trim() : null) : cur.term;
  const nextVol = patch.volume !== undefined ? (patch.volume ? patch.volume.trim() : null) : cur.volume;
  const nextName = patch.bookName?.trim() || cur.book_name;

  const upd = await pool.query(
    `UPDATE textbooks
     SET book_name = $1,
         standard = $2,
         medium = $3,
         subject = $4,
         term = $5,
         volume = $6,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $7
     RETURNING *`,
    [nextName, nextStd, nextMed, nextSubj, nextTerm, nextVol, id]
  );

  return mapTextbookRow(upd.rows[0]);
}

export async function verifyDriveTextbookFile(id: number): Promise<DriveTextbookRecord | null> {
  await ensureDriveTextbookLibrarySchema();
  const res = await pool.query(`SELECT * FROM textbooks WHERE id = $1`, [id]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  if (!row.google_drive_file_id) {
    throw new Error('This textbook record is not linked to a Google Drive File ID.');
  }

  const authClient = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  try {
    const fileRes = await withDriveRetry<any>(() =>
      drive.files.get({
        fileId: row.google_drive_file_id,
        fields: 'id, name, mimeType, size, modifiedTime, trashed',
        supportsAllDrives: true,
      })
    );
    const available = Boolean(fileRes.data?.id && !fileRes.data.trashed);
    const upd = await pool.query(
      `UPDATE textbooks
       SET drive_available = $1,
           file_size = COALESCE($2, file_size),
           drive_modified_time = COALESCE($3, drive_modified_time),
           publication_status = CASE WHEN $1 = false THEN 'unavailable' WHEN publication_status = 'unavailable' THEN 'pending_review' ELSE publication_status END,
           last_synced_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [
        available,
        fileRes.data?.size ? Number(fileRes.data.size) : null,
        fileRes.data?.modifiedTime ? new Date(fileRes.data.modifiedTime).toISOString() : null,
        id,
      ]
    );
    return mapTextbookRow(upd.rows[0]);
  } catch (err: any) {
    if (err?.response?.status === 404) {
      const upd = await pool.query(
        `UPDATE textbooks
         SET drive_available = false,
             publication_status = 'unavailable',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      return mapTextbookRow(upd.rows[0]);
    }
    throw err;
  }
}

export async function bulkUpdateDriveTextbookPublication(
  ids: number[],
  action: 'publish' | 'unpublish' | 'remove'
): Promise<{ updatedCount: number; skippedUnavailable: number }> {
  await ensureDriveTextbookLibrarySchema();
  const cleanIds = Array.from(new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)));
  if (cleanIds.length === 0) return { updatedCount: 0, skippedUnavailable: 0 };

  if (action === 'remove') {
    // Removes ONLY from Student Library (sets unpublished) — NEVER deletes original Google Drive PDF!
    const res = await pool.query(
      `UPDATE textbooks
       SET publication_status = 'unpublished',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1::int[])`,
      [cleanIds]
    );
    return { updatedCount: res.rowCount || 0, skippedUnavailable: 0 };
  }

  if (action === 'unpublish') {
    const res = await pool.query(
      `UPDATE textbooks
       SET publication_status = 'unpublished',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1::int[])`,
      [cleanIds]
    );
    return { updatedCount: res.rowCount || 0, skippedUnavailable: 0 };
  }

  // Publish ONLY verified & Drive-available textbooks
  const res = await pool.query(
    `UPDATE textbooks
     SET publication_status = 'published',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ANY($1::int[])
       AND google_drive_file_id IS NOT NULL
       AND COALESCE(drive_available, true) = true`,
    [cleanIds]
  );
  const updatedCount = res.rowCount || 0;
  return {
    updatedCount,
    skippedUnavailable: Math.max(0, cleanIds.length - updatedCount),
  };
}

/**
 * Student Portal Textbook Library query:
 * Returns ONLY published, Drive-available textbooks for the selected standard,
 * along with dynamic Terms (for 6–10) or Volumes (for 11–12), Mediums, and Subjects.
 */
export async function getPublishedStudentLibraryForStandard(standard: number) {
  await ensureDriveTextbookLibrarySchema();
  const res = await pool.query(
    `SELECT * FROM textbooks
     WHERE standard = $1
       AND google_drive_file_id IS NOT NULL
       AND publication_status = 'published'
       AND COALESCE(drive_available, true) = true
     ORDER BY medium ASC, subject ASC, term ASC NULLS LAST, volume ASC NULLS LAST, book_name ASC`,
    [standard]
  );

  const books = res.rows.map(mapTextbookRow);
  const isHigherSecondary = standard >= 11;

  const termsOrVolumesSet = new Set<string>();
  const mediumsSet = new Set<'Tamil' | 'English'>();
  const subjectsSet = new Set<string>();

  for (const b of books) {
    mediumsSet.add(b.medium);
    subjectsSet.add(b.subject);
    if (isHigherSecondary) {
      if (b.volume) termsOrVolumesSet.add(b.volume);
    } else {
      if (b.term) termsOrVolumesSet.add(b.term);
    }
  }

  const sortOrder = (label: string) => {
    const m = label.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 99;
  };

  return {
    standard,
    hierarchyType: isHigherSecondary ? ('volume' as const) : ('term' as const),
    availableTerms: isHigherSecondary
      ? []
      : Array.from(termsOrVolumesSet).sort((a, b) => sortOrder(a) - sortOrder(b) || a.localeCompare(b)),
    availableVolumes: isHigherSecondary
      ? Array.from(termsOrVolumesSet).sort((a, b) => sortOrder(a) - sortOrder(b) || a.localeCompare(b))
      : [],
    availableMediums: Array.from(mediumsSet),
    availableSubjects: Array.from(subjectsSet).sort(),
    books,
  };
}

/**
 * Resolves a textbook record for secure backend PDF streaming from Google Drive.
 * Enforces publication_status = 'published' for non-admin students.
 */
export async function getDriveStreamForTextbook(
  textbookId: number,
  isAdmin: boolean
): Promise<{
  stream: NodeJS.ReadableStream;
  fileName: string;
  mimeType: string;
  fileSize: number;
}> {
  await ensureDriveTextbookLibrarySchema();
  const res = await pool.query(`SELECT * FROM textbooks WHERE id = $1`, [textbookId]);
  if (res.rows.length === 0) {
    const err: any = new Error('Textbook not found.');
    err.statusCode = 404;
    throw err;
  }

  const row = res.rows[0];
  if (!isAdmin && row.publication_status !== 'published') {
    const err: any = new Error('This textbook is not published in the Student Library.');
    err.statusCode = 403;
    throw err;
  }
  if (!row.google_drive_file_id || row.drive_available === false) {
    const err: any = new Error('Original Google Drive PDF is currently unavailable.');
    err.statusCode = 404;
    throw err;
  }

  const driveStream = await getFileStream(row.google_drive_file_id);
  const rawName = String(row.file_name || `${row.book_name || 'textbook'}.pdf`).trim();
  const safeName = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;

  return {
    stream: driveStream.stream,
    fileName: safeName,
    mimeType: 'application/pdf',
    fileSize: Number(driveStream.contentLength || row.file_size || 0),
  };
}
