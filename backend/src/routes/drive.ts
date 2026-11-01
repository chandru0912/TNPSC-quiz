import { Router, Request, Response, NextFunction } from 'express';
import pool from '../db';
import { requireAdminAuth, AuthenticatedRequest } from '../middleware/auth';
import {
  getAuthorizationUrl,
  handleOAuthCallback,
  getConnectionStatus,
  initiateResumableUpload,
  verifyUploadedFile,
  deleteDriveFile,
  getFileStream,
  disconnectGoogleDrive,
  resolveRedirectUri,
  TARGET_FOLDER_NAME,
} from '../services/googleDriveService';
import { ensureDatabaseSchema } from '../migrate';

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
 * GET /api/drive/status
 * Public status endpoint reporting Google Drive integration state.
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await getConnectionStatus();
    return res.status(200).json({
      status: 'success',
      data: status,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to check Google Drive status',
    });
  }
});

/**
 * GET /api/drive/auth/url
 * Admin only: Generates a CSRF-protected Google OAuth 2.0 authorization URL.
 */
router.get('/auth/url', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminUsername = req.adminUser?.username || 'admin';
    const reqHost = (req.headers['x-forwarded-host'] || req.headers.host || '') as string;
    const redirectUri = resolveRedirectUri(req.query.redirectUri as string, reqHost);
    const authUrl = getAuthorizationUrl(adminUsername, redirectUri);

    return res.status(200).json({
      status: 'success',
      data: {
        authUrl,
        redirectUri,
        scope: 'https://www.googleapis.com/auth/drive.file',
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to generate Google authorization URL',
    });
  }
});

/**
 * GET /api/drive/oauth/callback
 * Google OAuth 2.0 redirect callback endpoint.
 * Validates CSRF state, exchanges code for tokens, and redirects back to Admin Panel.
 */
router.get('/oauth/callback', async (req: Request, res: Response) => {
  const { code, state, error: googleError } = req.query;

  const reqHost = (req.headers['x-forwarded-host'] || req.headers.host || '') as string;
  const isLocalHost = reqHost.includes('localhost') || reqHost.includes('127.0.0.1');
  const configuredFrontend = process.env.FRONTEND_URL?.trim().replace(/\/+$/, '');

  let frontendOrigin = 'http://localhost:5173';
  if (configuredFrontend) {
    frontendOrigin = configuredFrontend;
  } else if (!isLocalHost && reqHost) {
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    frontendOrigin = `${proto}://${reqHost}`;
  } else if (process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)) {
    frontendOrigin = 'https://tnpsc-quiz-lval.vercel.app';
  }

  if (googleError) {
    console.error('[GoogleDriveOAuth] Google returned error:', googleError);
    return res.redirect(`${frontendOrigin}/admin?gdrive_error=${encodeURIComponent(String(googleError))}`);
  }

  if (!code || !state) {
    return res.redirect(
      `${frontendOrigin}/admin?gdrive_error=${encodeURIComponent('Missing authorization code or state parameter.')}`
    );
  }

  try {
    const redirectUri = resolveRedirectUri(undefined, reqHost);
    const result = await handleOAuthCallback(String(code), String(state), redirectUri);

    return res.redirect(
      `${frontendOrigin}/admin?gdrive=connected&email=${encodeURIComponent(result.email || '')}`
    );
  } catch (err: any) {
    console.error('[GoogleDriveOAuth] Callback processing failed:', err.message);
    return res.redirect(`${frontendOrigin}/admin?gdrive_error=${encodeURIComponent(err.message || 'OAuth failed')}`);
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

    // 1. Initiate resumable upload with Google Drive API
    const { uploadUrl, folderId } = await initiateResumableUpload({
      fileName: cleanFileName,
      fileSize: parsedSize,
      mimeType: 'application/pdf',
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
        conditions.push(`LOWER(tnpsc_group) LIKE '%group1%'`);
      } else if (cleanGroup.includes('group4')) {
        conditions.push(`(LOWER(tnpsc_group) LIKE '%group4%' OR LOWER(tnpsc_group) LIKE '%vao%')`);
      } else {
        conditions.push(`(LOWER(tnpsc_group) LIKE '%group2%' OR LOWER(tnpsc_group) LIKE '%2a%')`);
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
             upload_status, uploaded_by, created_at, updated_at
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

