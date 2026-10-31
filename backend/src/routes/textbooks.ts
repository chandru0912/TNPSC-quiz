import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import pool from '../db';
import { ensureDatabaseSchema } from '../migrate';
import { requireAdminAuth } from '../middleware/auth';
import { processTextbookPdf } from '../services/pdfProcessor';
import { retrieveRelevantTextbookContent } from '../services/textbookRag';
import {
  TNPSC_GROUPS_LIST,
  STANDARDS_LIST,
  SAMACHEER_CATALOG,
  generateSamacheerBookName,
} from '../data/samacheerTextbookCatalog';

const router = Router();

// Ensure PostgreSQL schema is initialized and prevent HTTP 304 / caching on all textbook endpoints
router.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    delete req.headers['if-none-match'];
    delete req.headers['if-modified-since'];
    delete req.headers['if-match'];
    delete req.headers['if-unmodified-since'];

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    await ensureDatabaseSchema();
    next();
  } catch (err) {
    next(err);
  }
});

// Configure upload storage directory safely (supports read-only serverless filesystems like Vercel)
function resolveUploadsDir(): string {
  const preferredDir = process.env.VERCEL
    ? path.join(os.tmpdir(), 'tnpsc-uploads', 'textbooks')
    : path.resolve(__dirname, '../../uploads/textbooks');

  try {
    if (!fs.existsSync(preferredDir)) {
      fs.mkdirSync(preferredDir, { recursive: true });
    }
    return preferredDir;
  } catch {
    const fallbackDir = path.join(os.tmpdir(), 'tnpsc-uploads', 'textbooks');
    try {
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
    } catch {
      // Ignore directory creation errors at startup; handled on upload
    }
    return fallbackDir;
  }
}

const UPLOADS_DIR = resolveUploadsDir();

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = resolveUploadsDir();
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const cleanOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `tb_${timestamp}_${cleanOriginalName}`);
  },
});

// File filter: strict PDF validation
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const isPdf =
    file.mimetype === 'application/pdf' ||
    path.extname(file.originalname).toLowerCase() === '.pdf';

  if (isPdf) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type: Only PDF documents (.pdf) are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max file size
  },
});

// Multer middleware wrapper with proper HTTP status classification (413 for size limit, 400 for validation)
function handlePdfUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('pdf')(req, res, (err: any) => {
    if (!err) {
      return next();
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          status: 'error',
          message: 'Payload Too Large (413): PDF file exceeds the 100 MB application upload limit.',
        });
      }
      return res.status(400).json({
        status: 'error',
        message: `Bad Request (400): ${err.message}`,
      });
    }
    return res.status(400).json({
      status: 'error',
      message: err.message || 'Bad Request (400): Invalid PDF file upload.',
    });
  });
}

/**
 * Normalizes Group names to standard identifiers (group1, group2, group4)
 */
function normalizeGroupId(val: string): string {
  const clean = String(val || '').trim().toLowerCase();
  if (clean.includes('group 1') || clean === 'group1') return 'group1';
  if (clean.includes('group 2') || clean.includes('group2') || clean.includes('2a')) return 'group2';
  if (clean.includes('group 4') || clean === 'group4' || clean.includes('vao')) return 'group4';
  return clean || 'group1';
}

/**
 * Normalizes Standard (6 to 12)
 */
function normalizeStandard(val: any): number {
  if (typeof val === 'number') return val;
  const match = String(val || '').match(/(\d{1,2})/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (parsed >= 6 && parsed <= 12) return parsed;
  }
  return 6;
}

/**
 * Shared handler for POST /api/textbooks/upload and PUT /api/textbooks/:id
 */
async function handleUploadOrReplaceTextbook(req: Request, res: Response) {
  let uploadedFilePath: string | null = null;
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No PDF file uploaded.' });
    }

    uploadedFilePath = req.file.path;

    const {
      group,
      groupId,
      standard = 6,
      subject,
      medium = 'English',
      term = 'Full Year',
      bookName,
      replace = false,
      replaceId,
    } = req.body;

    if (!subject || !String(subject).trim()) {
      if (fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
      return res.status(400).json({ status: 'error', message: 'Subject is required.' });
    }

    const cleanGroupId = normalizeGroupId(group || groupId || 'group1');
    const parsedStandard = normalizeStandard(standard);
    const cleanSubject = String(subject).trim();
    const cleanMedium = String(medium).trim().toLowerCase() === 'tamil' ? 'Tamil' : 'English';
    const cleanTerm = term && String(term).trim() ? String(term).trim() : 'Full Year';
    const cleanBookName = (bookName && String(bookName).trim())
      ? String(bookName).trim()
      : generateSamacheerBookName({
          standard: parsedStandard,
          subject: cleanSubject,
          medium: cleanMedium,
          term: cleanTerm,
        });

    if (!cleanBookName) {
      if (fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
      return res.status(400).json({ status: 'error', message: 'Book Name could not be generated or validated.' });
    }
    const fileSize = req.file.size;

    const targetReplaceId = req.params.id
      ? parseInt(req.params.id, 10)
      : replaceId
        ? parseInt(String(replaceId), 10)
        : NaN;
    const hasValidReplaceId = !isNaN(targetReplaceId) && targetReplaceId > 0;
    const shouldReplace =
      String(replace).toLowerCase() === 'true' ||
      replace === true ||
      hasValidReplaceId ||
      req.method === 'PUT';

    // 1. Check if replacing a specific textbook by ID
    let existingRecord: { id: number; file_path: string; status: string } | null = null;
    if (hasValidReplaceId) {
      const idRes = await pool.query(
        `SELECT id, file_path, status FROM textbooks WHERE id = $1`,
        [targetReplaceId]
      );
      if (idRes.rows.length > 0) {
        existingRecord = idRes.rows[0];
      }
    }

    // 2. Duplicate check: group_id, standard, subject, medium, term, book_name
    const duplicateRes = await pool.query(
      `SELECT id, file_path, status FROM textbooks 
       WHERE group_id = $1 AND standard = $2 AND LOWER(subject) = LOWER($3) 
         AND medium = $4 AND term = $5 AND LOWER(book_name) = LOWER($6)`,
      [cleanGroupId, parsedStandard, cleanSubject, cleanMedium, cleanTerm, cleanBookName]
    );
    const duplicateSpecRecord = duplicateRes.rows[0] || null;

    if (!existingRecord && duplicateSpecRecord) {
      existingRecord = duplicateSpecRecord;
    }

    let textbookId: number;

    if (existingRecord) {
      if (!shouldReplace) {
        // Clean up newly uploaded file to avoid orphaned files on disk
        if (fs.existsSync(uploadedFilePath)) {
          fs.unlinkSync(uploadedFilePath);
        }
        return res.status(409).json({
          status: 'error',
          message: `A textbook with this specification already exists (ID: ${existingRecord.id}, "${cleanBookName}"). To overwrite it, confirm replace.`,
          existingId: existingRecord.id,
        });
      }

      // If replacing by ID and the updated metadata also collides with a different row, remove the colliding duplicate
      if (duplicateSpecRecord && duplicateSpecRecord.id !== existingRecord.id) {
        if (duplicateSpecRecord.file_path && fs.existsSync(duplicateSpecRecord.file_path)) {
          try {
            fs.unlinkSync(duplicateSpecRecord.file_path);
          } catch {}
        }
        await pool.query(`DELETE FROM textbooks WHERE id = $1`, [duplicateSpecRecord.id]);
      }

      // Remove old file from disk before updating
      if (
        existingRecord.file_path &&
        existingRecord.file_path !== uploadedFilePath &&
        fs.existsSync(existingRecord.file_path)
      ) {
        try {
          fs.unlinkSync(existingRecord.file_path);
        } catch {}
      }

      const updateRes = await pool.query(
        `UPDATE textbooks 
         SET group_id = $1,
             standard = $2,
             subject = $3,
             medium = $4,
             term = $5,
             book_name = $6,
             file_path = $7,
             file_size = $8,
             status = 'uploaded',
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $9 
         RETURNING *`,
        [
          cleanGroupId,
          parsedStandard,
          cleanSubject,
          cleanMedium,
          cleanTerm,
          cleanBookName,
          uploadedFilePath,
          fileSize,
          existingRecord.id,
        ]
      );
      textbookId = updateRes.rows[0].id;
    } else {
      // Insert new textbook
      const insertRes = await pool.query(
        `INSERT INTO textbooks (group_id, standard, subject, medium, term, book_name, file_path, file_size, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded')
         RETURNING *`,
        [
          cleanGroupId,
          parsedStandard,
          cleanSubject,
          cleanMedium,
          cleanTerm,
          cleanBookName,
          uploadedFilePath,
          fileSize,
        ]
      );
      textbookId = insertRes.rows[0].id;
    }

    // Await PDF extraction and database indexing so the response always reflects the verified database state
    await processTextbookPdf({
      textbookId,
      filePath: uploadedFilePath,
      groupId: cleanGroupId,
      standard: parsedStandard,
      subject: cleanSubject,
      medium: cleanMedium,
      term: cleanTerm,
    });

    const finalRes = await pool.query(
      `SELECT status, page_count, error_message, file_size FROM textbooks WHERE id = $1`,
      [textbookId]
    );
    const finalRow = finalRes.rows[0] || {
      status: 'completed',
      page_count: 0,
      error_message: null,
      file_size: fileSize,
    };

    if (finalRow.status === 'failed') {
      return res.status(422).json({
        status: 'error',
        message: finalRow.error_message || 'PDF uploaded, but text extraction and indexing failed.',
        data: {
          id: textbookId,
          groupId: cleanGroupId,
          standard: parsedStandard,
          subject: cleanSubject,
          medium: cleanMedium,
          term: cleanTerm,
          bookName: cleanBookName,
          fileSize: Number(finalRow.file_size || fileSize),
          pageCount: finalRow.page_count || 0,
          status: finalRow.status,
          errorMessage: finalRow.error_message,
        },
      });
    }

    return res.status(201).json({
      status: 'success',
      message:
        finalRow.status === 'completed'
          ? `Textbook uploaded and indexed successfully (${finalRow.page_count || 0} pages).`
          : 'Textbook uploaded and processing started.',
      data: {
        id: textbookId,
        groupId: cleanGroupId,
        standard: parsedStandard,
        subject: cleanSubject,
        medium: cleanMedium,
        term: cleanTerm,
        bookName: cleanBookName,
        fileSize: Number(finalRow.file_size || fileSize),
        pageCount: finalRow.page_count || 0,
        status: finalRow.status,
        errorMessage: finalRow.error_message,
      },
    });
  } catch (error: any) {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch {}
    }
    console.error('[Textbooks Route] Upload error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to upload textbook.',
    });
  }
}

/**
 * POST /api/textbooks/upload (Protected Admin)
 * Uploads textbook PDF, records metadata, prevents duplicates, starts async processing.
 */
router.post('/upload', requireAdminAuth, handlePdfUpload, handleUploadOrReplaceTextbook);

/**
 * PUT /api/textbooks/:id (Protected Admin)
 * Replaces an existing textbook PDF by ID and re-indexes it.
 */
router.put('/:id', requireAdminAuth, handlePdfUpload, handleUploadOrReplaceTextbook);

/**
 * GET /api/textbooks/catalog (Public / Admin)
 * Returns the authoritative Samacheer Kalvi Classes 6–12 catalogue with groups, standards, subjects, mediums and terms.
 */
router.get('/catalog', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'success',
    data: {
      groups: TNPSC_GROUPS_LIST,
      standards: STANDARDS_LIST,
      catalog: SAMACHEER_CATALOG,
    },
  });
});

/**
 * GET /api/textbooks (Public / Admin)
 * Returns list of textbooks with filters.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { group, groupId, standard, subject, medium, status, search } = req.query;
    const effectiveGroup = group || groupId;
    const conditions: string[] = [];
    const values: any[] = [];
    let pIdx = 1;

    if (effectiveGroup && typeof effectiveGroup === 'string' && effectiveGroup !== 'all') {
      conditions.push(`group_id = $${pIdx++}`);
      values.push(normalizeGroupId(effectiveGroup));
    }

    if (standard && typeof standard === 'string' && standard !== 'all') {
      conditions.push(`standard = $${pIdx++}`);
      values.push(normalizeStandard(standard));
    }

    if (subject && typeof subject === 'string' && subject !== 'all' && subject.trim() !== '') {
      conditions.push(`LOWER(subject) = LOWER($${pIdx++})`);
      values.push(subject.trim());
    }

    if (medium && typeof medium === 'string' && medium !== 'all') {
      conditions.push(`LOWER(medium) = LOWER($${pIdx++})`);
      values.push(medium.trim());
    }

    if (status && typeof status === 'string' && status !== 'all') {
      conditions.push(`status = $${pIdx++}`);
      values.push(status.trim());
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      conditions.push(`(LOWER(book_name) LIKE $${pIdx} OR LOWER(subject) LIKE $${pIdx})`);
      values.push(`%${search.trim().toLowerCase()}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT id, group_id, standard, subject, medium, term, book_name, file_size, page_count, status, error_message, created_at, updated_at
      FROM textbooks
      ${whereClause}
      ORDER BY standard ASC, subject ASC, id DESC
    `;

    const result = await pool.query(query, values);

    // Global Metrics for Textbooks HUD
    const metricsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN status IN ('uploaded', 'processing', 'staging') THEN 1 END) as staging_count,
        COUNT(CASE WHEN status IN ('completed', 'published') THEN 1 END) as published_count,
        COUNT(DISTINCT standard) as standards_count
      FROM textbooks;
    `);
    const metricsRow = metricsResult.rows[0];
    const metrics = {
      totalTextbooks: parseInt(metricsRow?.total_count || '0', 10),
      stagingCount: parseInt(metricsRow?.staging_count || '0', 10),
      publishedCount: parseInt(metricsRow?.published_count || '0', 10),
      classesCovered: parseInt(metricsRow?.standards_count || '0', 10),
    };

    return res.status(200).json({
      status: 'success',
      count: result.rows.length,
      metrics,
      data: result.rows.map((r) => ({
        id: r.id,
        groupId: r.group_id,
        standard: r.standard,
        subject: r.subject,
        medium: r.medium,
        term: r.term,
        bookName: r.book_name,
        fileSize: Number(r.file_size),
        pageCount: r.page_count,
        status: r.status,
        errorMessage: r.error_message,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('[Textbooks Route] List error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve textbooks.' });
  }
});

/**
 * GET /api/textbooks/search-content (Public / Admin)
 * RAG search for textbook content pages based on syllabus parameters.
 */
router.get('/search-content', async (req: Request, res: Response) => {
  try {
    const { group, standard, subject, medium, term, unitId, lessonTitle, topic, textbookId } = req.query;

    const parsedStandard = normalizeStandard(standard);
    const parsedUnitId = unitId ? parseInt(String(unitId), 10) : undefined;
    const parsedTextbookId = textbookId ? parseInt(String(textbookId), 10) : undefined;

    const result = await retrieveRelevantTextbookContent({
      groupId: group ? normalizeGroupId(String(group)) : undefined,
      standard: parsedStandard,
      subject: String(subject || ''),
      medium: medium ? String(medium) : 'English',
      term: term ? String(term) : undefined,
      unitId: isNaN(Number(parsedUnitId)) ? undefined : parsedUnitId,
      lessonTitle: lessonTitle ? String(lessonTitle) : undefined,
      topic: topic ? String(topic) : undefined,
      textbookId: isNaN(Number(parsedTextbookId)) ? undefined : parsedTextbookId,
    });

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error: any) {
    console.error('[Textbooks Route] Search content error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve textbook content.' });
  }
});

/**
 * GET /api/textbooks/metrics (Public / Admin)
 * Returns live HUD metrics for Textbook Management.
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const metricsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN status IN ('uploaded', 'processing', 'staging') THEN 1 END) as staging_count,
        COUNT(CASE WHEN status IN ('completed', 'published') THEN 1 END) as published_count,
        COUNT(DISTINCT standard) as standards_count
      FROM textbooks;
    `);
    const metricsRow = metricsResult.rows[0];
    return res.status(200).json({
      status: 'success',
      metrics: {
        totalTextbooks: parseInt(metricsRow?.total_count || '0', 10),
        stagingCount: parseInt(metricsRow?.staging_count || '0', 10),
        publishedCount: parseInt(metricsRow?.published_count || '0', 10),
        classesCovered: parseInt(metricsRow?.standards_count || '0', 10),
      },
    });
  } catch (error: any) {
    console.error('[Textbooks Route] Metrics error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve textbook metrics.' });
  }
});

/**
 * GET /api/textbooks/:id (Public / Admin)
 * Returns single textbook details and processing job status.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid textbook ID.' });
    }

    const tbRes = await pool.query(
      `SELECT id, group_id, standard, subject, medium, term, book_name, file_size, page_count, status, error_message, created_at, updated_at
       FROM textbooks WHERE id = $1`,
      [id]
    );

    if (tbRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Textbook not found.' });
    }

    const jobRes = await pool.query(
      `SELECT id, status, progress_percent, step_description, error_message, updated_at
       FROM textbook_processing_jobs 
       WHERE textbook_id = $1 
       ORDER BY id DESC LIMIT 1`,
      [id]
    );

    const r = tbRes.rows[0];
    const job = jobRes.rows[0] || null;

    return res.status(200).json({
      status: 'success',
      data: {
        id: r.id,
        groupId: r.group_id,
        standard: r.standard,
        subject: r.subject,
        medium: r.medium,
        term: r.term,
        bookName: r.book_name,
        fileSize: Number(r.file_size),
        pageCount: r.page_count,
        status: r.status,
        errorMessage: r.error_message,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        job: job
          ? {
              status: job.status,
              progressPercent: job.progress_percent,
              stepDescription: job.step_description,
              errorMessage: job.error_message,
              updatedAt: job.updated_at,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('[Textbooks Route] Details error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve textbook.' });
  }
});

/**
 * DELETE /api/textbooks/:id (Protected Admin)
 * Deletes textbook record, cascading to extracted pages and jobs, and removes file from disk.
 */
router.delete('/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid textbook ID.' });
    }

    const tbRes = await pool.query(`SELECT id, file_path, book_name FROM textbooks WHERE id = $1`, [id]);
    if (tbRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Textbook not found.' });
    }

    const { file_path, book_name } = tbRes.rows[0];

    // Remove file from disk
    if (file_path && fs.existsSync(file_path)) {
      try {
        fs.unlinkSync(file_path);
      } catch (fErr) {
        console.warn(`[Textbooks Route] Failed to unlink ${file_path}:`, fErr);
      }
    }

    await pool.query(`DELETE FROM textbooks WHERE id = $1`, [id]);

    return res.status(200).json({
      status: 'success',
      message: `Textbook "${book_name}" and its indexed content deleted successfully.`,
    });
  } catch (error: any) {
    console.error('[Textbooks Route] Delete error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to delete textbook.' });
  }
});

/**
 * POST /api/textbooks/:id/reprocess (Protected Admin)
 * Re-triggers PDF extraction and indexing for an existing textbook.
 */
router.post('/:id/reprocess', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid textbook ID.' });
    }

    const tbRes = await pool.query(
      `SELECT id, group_id, standard, subject, medium, file_path, book_name FROM textbooks WHERE id = $1`,
      [id]
    );

    if (tbRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Textbook not found.' });
    }

    const r = tbRes.rows[0];

    await processTextbookPdf({
      textbookId: r.id,
      filePath: r.file_path,
      groupId: r.group_id,
      standard: r.standard,
      subject: r.subject,
      medium: r.medium,
    });

    const finalRes = await pool.query(
      `SELECT status, page_count, error_message FROM textbooks WHERE id = $1`,
      [id]
    );
    const finalRow = finalRes.rows[0] || { status: 'completed', page_count: 0, error_message: null };

    if (finalRow.status === 'failed') {
      return res.status(422).json({
        status: 'error',
        message: finalRow.error_message || `Reprocessing failed for "${r.book_name}".`,
      });
    }

    return res.status(200).json({
      status: 'success',
      message: `Reprocessing completed for "${r.book_name}" (${finalRow.page_count || 0} pages).`,
      data: {
        id: r.id,
        status: finalRow.status,
        pageCount: finalRow.page_count || 0,
      },
    });
  } catch (error: any) {
    console.error('[Textbooks Route] Reprocess error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to initiate reprocessing.' });
  }
});

export default router;

