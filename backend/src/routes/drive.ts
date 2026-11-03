import { Router, Request, Response, NextFunction } from 'express';
import pool from '../db';
import { requireAdminAuth, AuthenticatedRequest } from '../middleware/auth';
import {
  getAuthorizationUrl,
  handleOAuthCallback,
  verifyOAuthState,
  verifyGoogleClientCredentials,
  getConnectionStatus,
  initiateResumableUpload,
  verifyUploadedFile,
  deleteDriveFile,
  getFileStream,
  disconnectGoogleDrive,
  resolveRedirectUri,
  cleanCredential,
  TARGET_FOLDER_NAME,
  listGoogleDrivePdfs,
  extractTextFromGoogleDrivePdf,
} from '../services/googleDriveService';
import { ensureDatabaseSchema } from '../migrate';
import {
  classifyPdf,
  ClassifyPdfInput,
  ClassifiedPdfMetadata,
} from '../services/bulkClassificationService';
import { extractAndIndexFullTextbook } from '../services/fullTextbookExtractor';

const router = Router();

// Middleware: ensure database schema is active and prevent stale API caching
router.use(async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    await ensureDatabaseSchema();
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/drive and GET /api/drive/status
 * Public status endpoint reporting Google Drive integration state and route map.
 */
router.get(['/', '/status'], async (_req: Request, res: Response) => {
  try {
    const status = await getConnectionStatus();
    return res.status(200).json({
      status: 'success',
      data: status,
      endpoints: {
        status: 'GET /api/drive/status',
        configCheck: 'GET /api/drive/config-check',
        authUrl: 'GET /api/drive/auth/url',
        callback: 'GET /api/drive/oauth/callback',
        disconnect: 'POST /api/drive/disconnect',
        uploadInitiate: 'POST /api/drive/upload/initiate',
        uploadComplete: 'POST /api/drive/upload/complete',
        materials: 'GET /api/drive/materials',
        view: 'GET /api/drive/view/:id',
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to check Google Drive status',
    });
  }
});

/**
 * GET /api/drive/config-check (Protected)
 * Admin only: Performs an automated Google Cloud OAuth 2.0 configuration probe
 * and reports whether GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are authentic and accepted by Google.
 */
router.get('/config-check', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reqHost = (req.headers['x-forwarded-host'] || req.headers.host || '') as string;
    const redirectUri = resolveRedirectUri(req.query.redirectUri as string, reqHost);
    const probe = await verifyGoogleClientCredentials(redirectUri);

    const rawId = process.env.GOOGLE_CLIENT_ID || '';
    const rawSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const cleanId = cleanCredential(rawId);
    const cleanSecret = cleanCredential(rawSecret);

    return res.status(200).json({
      status: 'success',
      data: {
        googleVerification: probe,
        redirectUri,
        clientId: {
          configured: Boolean(cleanId),
          length: cleanId.length,
          previewPrefix: cleanId ? cleanId.slice(0, 16) + '...' : '',
          previewSuffix: cleanId ? '...' + cleanId.slice(-24) : '',
          hasQuotes: /^["']|["']$/.test(rawId),
          hasWhitespace: /\s/.test(rawId),
        },
        clientSecret: {
          configured: Boolean(cleanSecret),
          length: cleanSecret.length,
          startsWithGocspx: cleanSecret.startsWith('GOCSPX-'),
          hasQuotes: /^["']|["']$/.test(rawSecret),
          hasWhitespace: /\s/.test(rawSecret),
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Config check probe failed',
    });
  }
});

/**
 * GET /api/drive/auth/url (and aliases /auth, /auth-url, /connect, /oauth/url)
 * Admin only: Generates a CSRF-protected Google OAuth 2.0 authorization URL.
 */
router.get(
  ['/auth/url', '/auth', '/auth-url', '/connect', '/oauth/url'],
  requireAdminAuth,
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const adminUsername = req.adminUser?.username || 'admin';
      const reqHost = (req.headers['x-forwarded-host'] || req.headers.host || '') as string;
      const redirectUri = resolveRedirectUri(req.query.redirectUri as string, reqHost);

      // Extract frontend origin hint from query, referer, or environment
      let frontendOrigin: string | undefined;
      const queryOrigin = typeof req.query.origin === 'string' ? req.query.origin.trim() : '';
      if (queryOrigin && /^https?:\/\//i.test(queryOrigin)) {
        frontendOrigin = queryOrigin.replace(/\/+$/, '');
      } else if (req.headers.referer) {
        try {
          frontendOrigin = new URL(req.headers.referer).origin;
        } catch {
          // ignore referer parse failure
        }
      }
      if (!frontendOrigin && process.env.FRONTEND_URL) {
        frontendOrigin = process.env.FRONTEND_URL.trim().replace(/\/+$/, '');
      }

      const clientIdHint = typeof req.query.clientId === 'string' ? req.query.clientId.trim() : undefined;
      const authUrl = getAuthorizationUrl(adminUsername, redirectUri, frontendOrigin, clientIdHint);

      return res.status(200).json({
        status: 'success',
        data: {
          authUrl,
          redirectUri,
          frontendOrigin: frontendOrigin || null,
          scope: 'https://www.googleapis.com/auth/drive.file',
        },
      });
    } catch (err: any) {
      return res.status(500).json({
        status: 'error',
        message: err.message || 'Failed to generate Google authorization URL',
      });
    }
  }
);

/**
 * GET /api/drive/oauth/callback (and alias /callback)
 * Google OAuth 2.0 redirect callback endpoint.
 * Validates CSRF state, exchanges code for tokens, and redirects back to Admin Panel.
 */
router.get(['/oauth/callback', '/callback'], async (req: Request, res: Response) => {
  const { code, state, error: googleError } = req.query;

  const reqHost = (req.headers['x-forwarded-host'] || req.headers.host || '') as string;
  const isLocalHost = reqHost.includes('localhost') || reqHost.includes('127.0.0.1');
  const configuredFrontend = process.env.FRONTEND_URL?.trim().replace(/\/+$/, '');

  let defaultFrontend = 'http://localhost:5173';
  if (configuredFrontend) {
    defaultFrontend = configuredFrontend;
  } else if (!isLocalHost && reqHost) {
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    defaultFrontend = `${proto}://${reqHost}`;
  } else if (process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)) {
    defaultFrontend = 'https://tnpsc-quiz-lval.vercel.app';
  }

  // Attempt to decode state to retrieve the exact frontend origin that initiated OAuth
  let originFromState: string | undefined;
  if (typeof state === 'string' && state.trim()) {
    const stateCheck = verifyOAuthState(state.trim());
    if (stateCheck.isValid && stateCheck.frontendOrigin && /^https?:\/\//i.test(stateCheck.frontendOrigin)) {
      originFromState = stateCheck.frontendOrigin;
    }
  }

  const effectiveFrontend = (originFromState || defaultFrontend).replace(/\/+$/, '');

  if (googleError) {
    console.error('[GoogleDriveOAuth] Google returned error:', googleError);
    return res.redirect(`${effectiveFrontend}/admin?gdrive_error=${encodeURIComponent(String(googleError))}`);
  }

  if (!code || !state) {
    return res.redirect(
      `${effectiveFrontend}/admin?gdrive_error=${encodeURIComponent('Missing authorization code or state parameter.')}`
    );
  }

  try {
    const redirectUri = resolveRedirectUri(undefined, reqHost);
    const result = await handleOAuthCallback(String(code), String(state), redirectUri);

    return res.redirect(
      `${effectiveFrontend}/admin?gdrive=connected&email=${encodeURIComponent(result.email || '')}`
    );
  } catch (err: any) {
    console.error('[GoogleDriveOAuth] Callback processing failed:', err.message);
    return res.redirect(`${effectiveFrontend}/admin?gdrive_error=${encodeURIComponent(err.message || 'OAuth failed')}`);
  }
});

/**
 * POST /api/drive/disconnect
 * Admin only: Disconnects Google Drive account by removing stored tokens.
 */
router.post('/disconnect', requireAdminAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    await disconnectGoogleDrive();
    return res.status(200).json({
      status: 'success',
      message: 'Google Drive account disconnected successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to disconnect Google Drive',
    });
  }
});

/**
 * POST /api/drive/upload/initiate
 * Admin only: Validates PDF metadata and initiates a direct Google Drive Resumable Upload session.
 */
router.post('/upload/initiate', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      fileName,
      originalFileName,
      fileSize,
      mimeType = 'application/pdf',
      group = 'group1',
      subject,
      standard,
      term = 'Term 1',
      unit = 1,
      lesson,
      lessonId,
      origin,
    } = req.body;

    if (!fileName || !fileSize) {
      return res.status(400).json({
        status: 'error',
        message: 'File name and file size are required to initiate upload.',
      });
    }

    if (mimeType !== 'application/pdf' && !fileName.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({
        status: 'error',
        message: 'Only PDF documents (.pdf) can be uploaded to Google Drive.',
      });
    }

    const parsedSize = parseInt(String(fileSize), 10);
    // Allow large files up to 500 MB per PDF
    if (isNaN(parsedSize) || parsedSize <= 0 || parsedSize > 500 * 1024 * 1024) {
      return res.status(400).json({
        status: 'error',
        message: 'File size must be greater than 0 and less than 500 MB.',
      });
    }

    const parsedStandard = standard ? parseInt(String(standard), 10) : null;
    const parsedUnit = unit ? parseInt(String(unit), 10) : 1;
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.\-_ ()]/g, '_');

    // Resolve client origin for Google Drive CORS binding
    let clientOrigin = typeof origin === 'string' ? origin.trim().replace(/\/+$/, '') : '';
    if (!clientOrigin && typeof req.headers.origin === 'string') {
      clientOrigin = req.headers.origin.trim().replace(/\/+$/, '');
    }
    if (!clientOrigin && typeof req.headers.referer === 'string') {
      try {
        clientOrigin = new URL(req.headers.referer).origin;
      } catch {
        // ignore invalid referer
      }
    }
    if (!clientOrigin && process.env.FRONTEND_URL) {
      clientOrigin = process.env.FRONTEND_URL.trim().replace(/\/+$/, '');
    }

    // 1. Initiate resumable upload with Google Drive API (passes origin for CORS)
    const { uploadUrl, folderId } = await initiateResumableUpload({
      fileName: cleanFileName,
      fileSize: parsedSize,
      mimeType: 'application/pdf',
      origin: clientOrigin || undefined,
    });

    // 2. Pre-create pending record in PostgreSQL
    const insertRes = await pool.query(
      `INSERT INTO google_drive_materials (
        file_name, original_file_name, mime_type, file_size,
        google_drive_file_id, google_drive_folder_id,
        tnpsc_group, subject, standard, term, unit, lesson, lesson_id,
        upload_status, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'initiating', $14)
      RETURNING id, file_name, upload_status`,
      [
        cleanFileName,
        originalFileName || cleanFileName,
        'application/pdf',
        parsedSize,
        `pending_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        folderId,
        group,
        subject || 'General Studies',
        parsedStandard,
        term,
        parsedUnit,
        lesson || null,
        lessonId || null,
        req.adminUser?.username || 'admin',
      ]
    );

    const trackingId = insertRes.rows[0].id;

    return res.status(200).json({
      status: 'success',
      data: {
        uploadUrl,
        trackingId,
        folderId,
        folderName: TARGET_FOLDER_NAME,
        cleanFileName,
      },
    });
  } catch (err: any) {
    console.error('[DriveUploadInitiate] Error:', err.message);
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to initiate Google Drive resumable upload session',
    });
  }
});

/**
 * POST /api/drive/upload/complete
 * Admin only: Verifies that the file was successfully received by Google Drive,
 * inspects verified file metadata, and updates PostgreSQL to status 'completed'.
 */
router.post('/upload/complete', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { trackingId, googleDriveFileId } = req.body;

    if (!trackingId || !googleDriveFileId) {
      return res.status(400).json({
        status: 'error',
        message: 'trackingId and googleDriveFileId are required to complete upload.',
      });
    }

    // 1. Verify existence and integrity in Google Drive
    const verified = await verifyUploadedFile(googleDriveFileId);

    // 2. Update PostgreSQL record
    const updateRes = await pool.query(
      `UPDATE google_drive_materials
       SET google_drive_file_id = $1,
           file_size = $2,
           upload_status = 'completed',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [verified.id, verified.size, trackingId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `Upload tracking record #${trackingId} not found in database.`,
      });
    }

    const row = updateRes.rows[0];
    return res.status(200).json({
      status: 'success',
      message: `PDF "${row.file_name}" successfully uploaded and verified in Google Drive!`,
      data: {
        id: row.id,
        fileName: row.file_name,
        fileSize: row.file_size,
        googleDriveFileId: row.google_drive_file_id,
        group: row.tnpsc_group,
        subject: row.subject,
        standard: row.standard,
        term: row.term,
        unit: row.unit,
        lesson: row.lesson,
        lessonId: row.lesson_id,
        uploadStatus: row.upload_status,
        createdAt: row.created_at,
      },
    });
  } catch (err: any) {
    console.error('[DriveUploadComplete] Error:', err.message);
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to verify uploaded file in Google Drive',
    });
  }
});

/**
 * GET /api/drive/files (and aliases /library, /list)
 * Admin & AI Generators: Lists all available Google Drive textbook PDFs.
 * Supports query parameters: search, standard, subject, group, sync (syncs with Drive folder).
 */
router.get(['/files', '/library', '/list'], requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { search, standard, subject, group, sync } = req.query;
    const syncFromDrive = String(sync).toLowerCase() === 'true' || sync === '1';
    const parsedStandard = standard && !isNaN(Number(standard)) ? Number(standard) : undefined;

    const files = await listGoogleDrivePdfs({
      search: search ? String(search).trim() : undefined,
      standard: parsedStandard,
      subject: subject ? String(subject).trim() : undefined,
      group: group ? String(group).trim() : undefined,
      syncFromDrive,
    });

    return res.status(200).json({
      status: 'success',
      total: files.length,
      data: files,
    });
  } catch (err: any) {
    console.error('[DriveListFiles] Error:', err.message);
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to list Google Drive PDF textbooks',
    });
  }
});

/**
 * POST /api/drive/extract-text
 * Admin & AI Generators: Diagnostic/Preview endpoint to extract text from a Google Drive PDF.
 */
router.post('/extract-text', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { fileId, materialId, lessonTitle, unitId, standard, subject } = req.body;
    if (!fileId && !materialId) {
      return res.status(400).json({ status: 'error', message: 'fileId or materialId is required.' });
    }

    const extraction = await extractTextFromGoogleDrivePdf({
      fileId: fileId ? String(fileId).trim() : '',
      materialId: materialId ? Number(materialId) : undefined,
      lessonTitle: lessonTitle ? String(lessonTitle).trim() : undefined,
      unitId: unitId ? Number(unitId) : undefined,
      standard: standard ? Number(standard) : undefined,
      subject: subject ? String(subject).trim() : undefined,
    });

    return res.status(200).json({
      status: 'success',
      data: {
        fileName: extraction.fileName,
        fileId: extraction.fileId,
        pageCount: extraction.pageCount,
        relevantPages: extraction.relevantPages,
        matchedLesson: extraction.matchedLesson,
        fromCache: extraction.fromCache,
        totalTextLength: extraction.text.length,
        samplePreview: extraction.text.substring(0, 1000),
      },
    });
  } catch (err: any) {
    console.error('[DriveExtractText] Error:', err.message);
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to extract text from Google Drive PDF',
    });
  }
});

/**
 * POST /api/drive/bulk/classify
 * Admin only: Classifies a batch of PDF files using filename heuristics,
 * cover page metadata, and Table of Contents matching against TNPSC syllabus.
 */
router.post('/bulk/classify', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Array of files is required for classification.' });
    }

    const results: ClassifiedPdfMetadata[] = files.map((f: ClassifyPdfInput) => classifyPdf(f));

    return res.status(200).json({
      status: 'success',
      total: results.length,
      data: results,
    });
  } catch (err: any) {
    console.error('[BulkClassify] Error:', err.message);
    return res.status(500).json({ status: 'error', message: err.message || 'Bulk classification failed.' });
  }
});

/**
 * POST /api/drive/bulk/check-duplicates
 * Admin only: Verifies whether any files in the batch have already been uploaded based on checksum.
 */
router.post('/bulk/check-duplicates', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { checksums = [] } = req.body;
    if (!Array.isArray(checksums) || checksums.length === 0) {
      return res.status(200).json({ status: 'success', existing: {} });
    }

    const cleanChecksums = checksums.map((c: any) => String(c).trim()).filter(Boolean);
    if (cleanChecksums.length === 0) {
      return res.status(200).json({ status: 'success', existing: {} });
    }

    const query = `
      SELECT id, file_name, file_size, google_drive_file_id, file_checksum, upload_status, tnpsc_group, subject, standard
      FROM google_drive_materials
      WHERE file_checksum = ANY($1) AND upload_status = 'completed'
    `;
    const resDb = await pool.query(query, [cleanChecksums]);

    const existingMap: Record<string, any> = {};
    resDb.rows.forEach((row) => {
      if (row.file_checksum && !existingMap[row.file_checksum]) {
        existingMap[row.file_checksum] = {
          id: row.id,
          fileName: row.file_name,
          fileSize: row.file_size,
          googleDriveFileId: row.google_drive_file_id,
          group: row.tnpsc_group,
          subject: row.subject,
          standard: row.standard,
        };
      }
    });

    return res.status(200).json({
      status: 'success',
      existing: existingMap,
    });
  } catch (err: any) {
    console.error('[BulkCheckDuplicates] Error:', err.message);
    return res.status(500).json({ status: 'error', message: err.message || 'Duplicate check failed.' });
  }
});

/**
 * POST /api/drive/bulk/register
 * Admin only: Atomically registers an uploaded PDF across all applicable TNPSC groups,
 * saves syllabus mappings, and synchronizes with textbooks table.
 */
router.post('/bulk/register', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      trackingId,
      googleDriveFileId,
      metadata,
      batchId,
    }: {
      trackingId: number;
      googleDriveFileId: string;
      metadata: ClassifiedPdfMetadata;
      batchId?: string;
    } = req.body;

    if (!trackingId || !googleDriveFileId || !metadata) {
      return res.status(400).json({ status: 'error', message: 'trackingId, googleDriveFileId, and metadata are required.' });
    }

    await client.query('BEGIN');

    // 1. Verify existence in Google Drive
    const verified = await verifyUploadedFile(googleDriveFileId);

    // 2. Update primary google_drive_materials record
    const applicableGroupsJson = JSON.stringify(metadata.applicableGroups || [metadata.primaryGroup || 'group1']);
    const unitsJson = JSON.stringify(metadata.units || []);
    const metaJson = JSON.stringify(metadata);

    const primaryUpdate = await client.query(
      `UPDATE google_drive_materials
       SET google_drive_file_id = $1,
           file_size = $2,
           upload_status = 'completed',
           tnpsc_group = $3,
           subject = $4,
           standard = $5,
           term = $6,
           medium = $7,
           file_checksum = $8,
           applicable_groups = $9::jsonb,
           extracted_toc = $10::jsonb,
           classification_meta = $11::jsonb,
           confidence_score = $12,
           batch_id = $13,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $14
       RETURNING *`,
      [
        verified.id,
        verified.size,
        metadata.primaryGroup || 'group1',
        metadata.subject,
        metadata.standardNumber,
        metadata.term,
        metadata.medium,
        metadata.checksum || null,
        applicableGroupsJson,
        unitsJson,
        metaJson,
        metadata.confidenceScore || 100,
        batchId || null,
        trackingId,
      ]
    );

    if (primaryUpdate.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ status: 'error', message: `Tracking record #${trackingId} not found.` });
    }

    const mainRow = primaryUpdate.rows[0];

    // 3. Register cross-group associations if the textbook applies to multiple groups
    const additionalGroups = (metadata.applicableGroups || []).filter((g) => g !== metadata.primaryGroup);
    for (const group of additionalGroups) {
      await client.query(
        `INSERT INTO google_drive_materials (
          file_name, original_file_name, mime_type, file_size,
          google_drive_file_id, google_drive_folder_id,
          tnpsc_group, subject, standard, term, unit, lesson, lesson_id,
          upload_status, uploaded_by, medium, file_checksum, applicable_groups,
          extracted_toc, classification_meta, confidence_score, batch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'completed', $14, $15, $16, $17::jsonb, $18::jsonb, $19::jsonb, $20, $21)
        ON CONFLICT (google_drive_file_id) DO NOTHING`,
        [
          mainRow.file_name,
          mainRow.original_file_name,
          mainRow.mime_type,
          verified.size,
          verified.id,
          mainRow.google_drive_folder_id,
          group,
          metadata.subject,
          metadata.standardNumber,
          metadata.term,
          1,
          metadata.units[0]?.lessons[0]?.title || null,
          metadata.units[0]?.lessons[0]?.lessonId || null,
          req.adminUser?.username || 'admin',
          metadata.medium,
          metadata.checksum || null,
          applicableGroupsJson,
          unitsJson,
          metaJson,
          metadata.confidenceScore || 100,
          batchId || null,
        ]
      );
    }

    // 4. Ensure textbook record in textbooks table
    await client.query(
      `INSERT INTO textbooks (
        group_id, standard, subject, medium, term, book_name, file_path, file_size, page_count, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed')
      ON CONFLICT (group_id, standard, subject, medium, term, book_name)
      DO UPDATE SET
        file_path = EXCLUDED.file_path,
        file_size = EXCLUDED.file_size,
        status = 'completed',
        updated_at = CURRENT_TIMESTAMP`,
      [
        metadata.primaryGroup || 'group1',
        metadata.standardNumber,
        metadata.subject,
        metadata.medium,
        metadata.term,
        metadata.bookName,
        `gdrive://${verified.id}`,
        verified.size,
        metadata.pageCount || 0,
      ]
    );

    // 5. Update batch tracking if provided
    if (batchId) {
      await client.query(
        `INSERT INTO bulk_upload_batches (batch_id, total_files, completed_files, status, created_by)
         VALUES ($1, 1, 1, 'processing', $2)
         ON CONFLICT (batch_id)
         DO UPDATE SET
           completed_files = bulk_upload_batches.completed_files + 1,
           updated_at = CURRENT_TIMESTAMP`,
        [batchId, req.adminUser?.username || 'admin']
      );
    }

    await client.query('COMMIT');

    // 6. Asynchronously trigger full text indexing in background
    extractAndIndexFullTextbook({
      materialId: mainRow.id,
      googleDriveFileId: verified.id,
      metadata,
    }).catch((bgErr) => {
      console.warn(`[BackgroundIndex] Non-fatal extraction notice for #${mainRow.id}:`, bgErr.message);
    });

    return res.status(200).json({
      status: 'success',
      message: `Successfully registered "${metadata.bookName}" across ${metadata.applicableGroups?.length || 1} TNPSC group(s).`,
      data: {
        id: mainRow.id,
        googleDriveFileId: verified.id,
        bookName: metadata.bookName,
        applicableGroups: metadata.applicableGroups,
        totalUnits: metadata.totalUnits,
        totalLessons: metadata.totalLessons,
      },
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[BulkRegister] Error:', err.message);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to register bulk PDF upload.' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/drive/bulk/batches/:batchId
 * Admin only: Retrieves batch progress summary.
 */
router.get('/bulk/batches/:batchId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const resDb = await pool.query(`SELECT * FROM bulk_upload_batches WHERE batch_id = $1 LIMIT 1`, [batchId]);
    if (resDb.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: `Batch ${batchId} not found.` });
    }
    return res.status(200).json({ status: 'success', data: resDb.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch batch status.' });
  }
});

/**
 * GET /api/drive/materials
 * Public & Admin: Lists Google Drive PDF study materials with flexible syllabus filters.
 */
router.get('/materials', async (req: Request, res: Response) => {
  try {
    const {
      group,
      subject,
      standard,
      term,
      unit,
      lessonId,
      lesson,
      search,
      status = 'completed',
      limit = '50',
      offset = '0',
    } = req.query;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status && status !== 'all') {
      conditions.push(`upload_status = $${idx++}`);
      values.push(status);
    }

    if (group && group !== 'all') {
      const cleanGroup = String(group).toLowerCase().trim();
      if (cleanGroup.includes('group1')) {
        conditions.push(`(LOWER(tnpsc_group) LIKE '%group1%' OR (applicable_groups IS NOT NULL AND applicable_groups @> '["group1"]'::jsonb))`);
      } else if (cleanGroup.includes('group4')) {
        conditions.push(`(LOWER(tnpsc_group) LIKE '%group4%' OR LOWER(tnpsc_group) LIKE '%vao%' OR (applicable_groups IS NOT NULL AND applicable_groups @> '["group4"]'::jsonb))`);
      } else {
        conditions.push(`(LOWER(tnpsc_group) LIKE '%group2%' OR LOWER(tnpsc_group) LIKE '%2a%' OR (applicable_groups IS NOT NULL AND applicable_groups @> '["group2"]'::jsonb))`);
      }
    }

    if (subject && subject !== 'all') {
      conditions.push(`(LOWER(subject) = LOWER($${idx}) OR LOWER(subject) LIKE '%' || LOWER($${idx}) || '%')`);
      values.push(String(subject).replace(/-/g, ' '));
      idx++;
    }

    if (standard && !isNaN(Number(standard))) {
      conditions.push(`standard = $${idx++}`);
      values.push(Number(standard));
    }

    if (term && term !== 'all') {
      conditions.push(`(term ILIKE $${idx} OR term = 'Full Year' OR term IS NULL)`);
      values.push(`%${term}%`);
      idx++;
    }

    if (unit && !isNaN(Number(unit))) {
      conditions.push(`unit = $${idx++}`);
      values.push(Number(unit));
    }

    if (lessonId && lessonId !== 'all') {
      conditions.push(`lesson_id = $${idx++}`);
      values.push(String(lessonId));
    } else if (lesson && lesson !== 'all') {
      conditions.push(`(LOWER(lesson) LIKE '%' || LOWER($${idx}) || '%' OR LOWER(file_name) LIKE '%' || LOWER($${idx}) || '%')`);
      values.push(String(lesson));
      idx++;
    }

    if (search && String(search).trim()) {
      conditions.push(
        `(LOWER(file_name) LIKE '%' || LOWER($${idx}) || '%' OR LOWER(subject) LIKE '%' || LOWER($${idx}) || '%' OR LOWER(lesson) LIKE '%' || LOWER($${idx}) || '%')`
      );
      values.push(String(search).trim());
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeLimit = Math.min(Math.max(1, parseInt(String(limit), 10) || 50), 200);
    const safeOffset = Math.max(0, parseInt(String(offset), 10) || 0);

    const countRes = await pool.query(`SELECT COUNT(*) AS total FROM google_drive_materials ${whereClause}`, values);
    const total = parseInt(countRes.rows[0].total, 10);

    const dataQuery = `
      SELECT id, file_name, original_file_name, mime_type, file_size,
             google_drive_file_id, google_drive_folder_id,
             tnpsc_group, subject, standard, term, unit, lesson, lesson_id,
             upload_status, uploaded_by, created_at, updated_at,
             applicable_groups, extracted_toc, confidence_score, medium
      FROM google_drive_materials
      ${whereClause}
      ORDER BY id DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const dataRes = await pool.query(dataQuery, [...values, safeLimit, safeOffset]);

    const items = dataRes.rows.map((row) => ({
      id: row.id,
      fileName: row.file_name,
      originalFileName: row.original_file_name,
      mimeType: row.mime_type,
      fileSize: parseInt(row.file_size, 10),
      googleDriveFileId: row.google_drive_file_id,
      group: row.tnpsc_group,
      applicableGroups: row.applicable_groups || [row.tnpsc_group],
      extractedToc: row.extracted_toc || [],
      confidenceScore: row.confidence_score || 100,
      medium: row.medium || 'Tamil',
      subject: row.subject,
      standard: row.standard,
      term: row.term,
      unit: row.unit,
      lesson: row.lesson,
      lessonId: row.lesson_id,
      uploadStatus: row.upload_status,
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      viewUrl: `/api/drive/view/${row.id}`,
    }));

    return res.status(200).json({
      status: 'success',
      data: items,
      total,
      limit: safeLimit,
      offset: safeOffset,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to list PDF study materials',
    });
  }
});

/**
 * GET /api/drive/materials/:id
 * Retrieves metadata for a single PDF material.
 */
router.get('/materials/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid material ID is required.' });
    }

    const resDb = await pool.query(
      `SELECT * FROM google_drive_materials WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (resDb.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'PDF study material not found.' });
    }

    const row = resDb.rows[0];
    return res.status(200).json({
      status: 'success',
      data: {
        id: row.id,
        fileName: row.file_name,
        originalFileName: row.original_file_name,
        mimeType: row.mime_type,
        fileSize: parseInt(row.file_size, 10),
        googleDriveFileId: row.google_drive_file_id,
        group: row.tnpsc_group,
        subject: row.subject,
        standard: row.standard,
        term: row.term,
        unit: row.unit,
        lesson: row.lesson,
        lessonId: row.lesson_id,
        uploadStatus: row.upload_status,
        createdAt: row.created_at,
        viewUrl: `/api/drive/view/${row.id}`,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to retrieve material metadata',
    });
  }
});

/**
 * GET /api/drive/view/:id
 * Secure PDF streaming and viewing endpoint for students and administrators.
 * Supports HTTP Range headers for fast chunked loading and page seeking in browser.
 */
router.get('/view/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid material ID is required.' });
    }

    const resDb = await pool.query(
      `SELECT id, file_name, mime_type, file_size, google_drive_file_id, upload_status 
       FROM google_drive_materials 
       WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (resDb.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'PDF material not found.' });
    }

    const material = resDb.rows[0];
    if (material.upload_status !== 'completed') {
      return res.status(400).json({
        status: 'error',
        message: `This PDF is not ready for viewing yet (Status: ${material.upload_status}).`,
      });
    }

    const rangeHeader = req.headers.range as string | undefined;
    const fileResult = await getFileStream(material.google_drive_file_id, rangeHeader);

    // Set streaming headers
    res.status(fileResult.statusCode);
    res.setHeader('Content-Type', fileResult.contentType || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(material.file_name)}"`
    );
    res.setHeader('Accept-Ranges', 'bytes');

    if (fileResult.contentLength) {
      res.setHeader('Content-Length', String(fileResult.contentLength));
    }
    if (fileResult.contentRange) {
      res.setHeader('Content-Range', fileResult.contentRange);
    }

    // Pipe the Google Drive stream directly to the response
    fileResult.stream.on('error', (streamErr: any) => {
      console.error('[DriveViewStream] Error during streaming:', streamErr.message);
      if (!res.headersSent) {
        res.status(500).json({ status: 'error', message: 'Failed to stream PDF from Google Drive' });
      }
    });

    fileResult.stream.pipe(res);
  } catch (err: any) {
    console.error('[DriveView] Error:', err.message);
    if (!res.headersSent) {
      return res.status(500).json({
        status: 'error',
        message: err.message || 'Failed to open PDF document',
      });
    }
  }
});

/**
 * DELETE /api/drive/materials
 * Admin only: Bulk deletes PDF materials from Google Drive and PostgreSQL database.
 * Supports:
 * 1. { ids: number[] } -> Delete selected materials
 * 2. { deleteAll: true, group?, standard?, subject?, term?, search? } -> Delete all (optionally filtered) materials
 */
router.delete('/materials', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids, deleteAll, group, standard, subject, term, search } = req.body || {};

    let targetRows: { id: number; file_name: string; google_drive_file_id: string }[] = [];

    if (Array.isArray(ids) && ids.length > 0) {
      const validIds = ids.map((id: any) => Number(id)).filter((id: number) => !isNaN(id) && id > 0);
      if (validIds.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No valid material IDs provided.' });
      }
      const dbRes = await pool.query(
        `SELECT id, file_name, google_drive_file_id FROM google_drive_materials WHERE id = ANY($1)`,
        [validIds]
      );
      targetRows = dbRes.rows;
    } else if (deleteAll) {
      const conditions: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (group && group !== 'all') {
        conditions.push(`(tnpsc_group = $${idx} OR applicable_groups @> $${idx + 1}::jsonb)`);
        values.push(String(group));
        values.push(JSON.stringify([String(group)]));
        idx += 2;
      }
      if (subject && subject !== 'all') {
        conditions.push(`LOWER(subject) = LOWER($${idx++})`);
        values.push(String(subject));
      }
      if (standard && standard !== 'all' && !isNaN(Number(standard))) {
        conditions.push(`standard = $${idx++}`);
        values.push(Number(standard));
      }
      if (term && term !== 'all') {
        conditions.push(`(term ILIKE $${idx} OR term = 'Full Year' OR term IS NULL)`);
        values.push(`%${term}%`);
        idx++;
      }
      if (search && String(search).trim()) {
        conditions.push(
          `(LOWER(file_name) LIKE '%' || LOWER($${idx}) || '%' OR LOWER(subject) LIKE '%' || LOWER($${idx}) || '%' OR LOWER(lesson) LIKE '%' || LOWER($${idx}) || '%')`
        );
        values.push(String(search).trim());
        idx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const dbRes = await pool.query(
        `SELECT id, file_name, google_drive_file_id FROM google_drive_materials ${whereClause}`,
        values
      );
      targetRows = dbRes.rows;
    } else {
      return res.status(400).json({ status: 'error', message: 'Provide either "ids" array or "deleteAll: true".' });
    }

    if (targetRows.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No PDF materials found to delete.',
        deletedCount: 0,
      });
    }

    const targetIds = targetRows.map((r) => r.id);

    // Delete associated files from Google Drive in parallel (graceful error handling)
    await Promise.allSettled(
      targetRows.map(async (row) => {
        if (row.google_drive_file_id && !row.google_drive_file_id.startsWith('pending_')) {
          try {
            await deleteDriveFile(row.google_drive_file_id);
          } catch (driveErr: any) {
            console.warn(`[BulkDeleteDrive] Drive deletion warning for file ID ${row.google_drive_file_id}:`, driveErr.message);
          }
        }
      })
    );

    // Delete records from PostgreSQL database
    const deleteRes = await pool.query(
      `DELETE FROM google_drive_materials WHERE id = ANY($1) RETURNING id`,
      [targetIds]
    );

    return res.status(200).json({
      status: 'success',
      message: `Successfully deleted ${deleteRes.rowCount} PDF material(s) from Google Drive and database.`,
      deletedCount: deleteRes.rowCount,
      deletedIds: targetIds,
    });
  } catch (err: any) {
    console.error('[BulkDriveDelete] Error:', err.message);
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to delete PDF materials',
    });
  }
});

/**
 * DELETE /api/drive/materials/:id
 * Admin only: Deletes the PDF from Google Drive and removes its record from PostgreSQL.
 */
router.delete('/materials/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid material ID is required.' });
    }

    const resDb = await pool.query(
      `SELECT id, file_name, google_drive_file_id FROM google_drive_materials WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (resDb.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'PDF study material not found in database.' });
    }

    const material = resDb.rows[0];

    // Delete from Google Drive if it has an assigned Drive file ID
    if (material.google_drive_file_id && !material.google_drive_file_id.startsWith('pending_')) {
      try {
        await deleteDriveFile(material.google_drive_file_id);
      } catch (driveErr: any) {
        console.warn(`[DriveDelete] Google Drive file deletion warning:`, driveErr.message);
      }
    }

    // Delete from PostgreSQL
    await pool.query(`DELETE FROM google_drive_materials WHERE id = $1`, [id]);

    return res.status(200).json({
      status: 'success',
      message: `PDF material "${material.file_name}" successfully removed from Google Drive and database.`,
      deletedId: id,
    });
  } catch (err: any) {
    console.error('[DriveDelete] Error:', err.message);
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to delete PDF material',
    });
  }
});

export default router;

