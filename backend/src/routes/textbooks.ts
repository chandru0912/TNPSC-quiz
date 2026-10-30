import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../db';
import { requireAdminAuth } from '../middleware/auth';
import { processTextbookPdf } from '../services/pdfProcessor';
import { retrieveRelevantTextbookContent } from '../services/textbookRag';

const router = Router();

// Configure upload storage directory
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/textbooks');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
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
    cb(new Error('Invalid file type: Only PDF documents are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max file size
  },
});

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
 * POST /api/textbooks/upload (Protected Admin)
 * Uploads textbook PDF, records metadata, prevents duplicates, starts async processing.
 */
router.post(
  '/upload',
  requireAdminAuth,
  upload.single('pdf'),
  async (req: Request, res: Response) => {
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
        return res.status(400).json({ status: 'error', message: 'Subject is required.' });
      }

      if (!bookName || !String(bookName).trim()) {
        return res.status(400).json({ status: 'error', message: 'Book Name is required.' });
      }

      const cleanGroupId = normalizeGroupId(group || groupId || 'group1');
      const parsedStandard = normalizeStandard(standard);
      const cleanSubject = String(subject).trim();
      const cleanMedium = String(medium).trim().toLowerCase() === 'tamil' ? 'Tamil' : 'English';
      const cleanTerm = term && String(term).trim() ? String(term).trim() : 'Full Year';
      const cleanBookName = String(bookName).trim();
      const fileSize = req.file.size;

      // Duplicate check: group_id, standard, subject, medium, term, book_name
      const duplicateRes = await pool.query(
        `SELECT id, file_path, status FROM textbooks 
         WHERE group_id = $1 AND standard = $2 AND LOWER(subject) = LOWER($3) 
           AND medium = $4 AND term = $5 AND LOWER(book_name) = LOWER($6)`,
        [cleanGroupId, parsedStandard, cleanSubject, cleanMedium, cleanTerm, cleanBookName]
      );

      let textbookId: number;

      if (duplicateRes.rows.length > 0) {
        const existing = duplicateRes.rows[0];
        const shouldReplace = String(replace) === 'true' || replace === true || Boolean(replaceId);

        if (!shouldReplace) {
          // Clean up newly uploaded file to avoid orphaned files on disk
          if (fs.existsSync(uploadedFilePath)) {
            fs.unlinkSync(uploadedFilePath);
          }
          return res.status(409).json({
            status: 'error',
            message: `A textbook with this specification already exists (ID: ${existing.id}, "${cleanBookName}"). To overwrite it, confirm replace.`,
            existingId: existing.id,
          });
        }

        // Replace existing textbook
        if (existing.file_path && fs.existsSync(existing.file_path)) {
          try {
            fs.unlinkSync(existing.file_path);
          } catch {}
        }

        const updateRes = await pool.query(
          `UPDATE textbooks 
           SET file_path = $1, file_size = $2, status = 'uploaded', error_message = NULL, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $3 
           RETURNING *`,
          [uploadedFilePath, fileSize, existing.id]
        );
        textbookId = updateRes.rows[0].id;
      } else {
        // Insert new textbook
        const insertRes = await pool.query(
          `INSERT INTO textbooks (group_id, standard, subject, medium, term, book_name, file_path, file_size, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded')
           RETURNING *`,
          [cleanGroupId, parsedStandard, cleanSubject, cleanMedium, cleanTerm, cleanBookName, uploadedFilePath, fileSize]
        );
        textbookId = insertRes.rows[0].id;
      }

      // Trigger asynchronous PDF processing engine
      processTextbookPdf({
        textbookId,
        filePath: uploadedFilePath,
        groupId: cleanGroupId,
        standard: parsedStandard,
        subject: cleanSubject,
        medium: cleanMedium,
      }).catch((err) => {
        console.error(`[Textbook Route] Async processing failure for ${textbookId}:`, err);
      });

      return res.status(201).json({
        status: 'success',
        message: 'Textbook uploaded successfully. Processing and indexing started.',
        data: {
          id: textbookId,
          groupId: cleanGroupId,
          standard: parsedStandard,
          subject: cleanSubject,
          medium: cleanMedium,
          term: cleanTerm,
          bookName: cleanBookName,
          status: 'uploaded',
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
);

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
    return res.status(200).json({
      status: 'success',
      count: result.rows.length,
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

    processTextbookPdf({
      textbookId: r.id,
      filePath: r.file_path,
      groupId: r.group_id,
      standard: r.standard,
      subject: r.subject,
      medium: r.medium,
    }).catch((err) => {
      console.error(`[Textbooks Route] Reprocess failure for ${id}:`, err);
    });

    return res.status(200).json({
      status: 'success',
      message: `Reprocessing initiated for "${r.book_name}".`,
    });
  } catch (error: any) {
    console.error('[Textbooks Route] Reprocess error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to initiate reprocessing.' });
  }
});

export default router;

