/**
 * pdfExtractionService.ts
 *
 * Full-Stack Automatic PDF Text Extraction + Multi-Tier OCR System
 * Detects and handles:
 * 1. Text-based PDF
 * 2. Scanned/image-based PDF
 * 3. Mixed PDF (text + scanned pages)
 * 4. Invalid or corrupted PDF
 *
 * Fully integrated with PostgreSQL (textbook_content, textbooks, google_drive_materials),
 * Google Cloud Vision OCR, Tesseract.js, Claude AI Vision, and TNPSC Syllabus Mapping.
 */

import fs from 'fs';
import path from 'path';
import pool from '../db';
import { getPdfParseClass, cleanText, isScannedText, extractPageSyllabusMeta, normalizeTamilPdfText } from './pdfProcessor';
import { extractOcrForPage, OcrResult } from './ocrService';
import { cleanTamilUnicodeText, repairInDesignPdfArtifacts } from './tamilUnicodeCleaner';
import { getDriveFileBuffer } from './googleDriveService';

export type PdfType = 'TEXT_BASED' | 'SCANNED' | 'MIXED' | 'INVALID' | 'UNKNOWN';
export type ExtractionStatus = 'PENDING' | 'PROCESSING' | 'DETECTING' | 'EXTRACTING' | 'OCR_PROCESSING' | 'PARTIALLY_COMPLETED' | 'COMPLETED' | 'FAILED';

// Each HTTP invocation processes a bounded slice so Vercel function termination can never lose progress:
// the page cursor is committed to pdf_extractions after every page and the next call resumes from it.
const DEFAULT_MAX_DURATION_MS = Math.max(2000, parseInt(process.env.PDF_EXTRACTION_TIME_BUDGET_MS || '20000', 10) || 20000);
const DEFAULT_PAGE_LIMIT = Math.max(1, parseInt(process.env.PDF_EXTRACTION_PAGE_LIMIT || '25', 10) || 25);

function meaningfulCharCount(text: string): number {
  return cleanText(text).replace(/[^a-zA-Z0-9\u0B80-\u0BFF]/g, '').length;
}

export interface PageInspectionResult {
  pageNumber: number;
  text: string;
  charCount: number;
  isNative: boolean;
  isScanned: boolean;
  isEmpty: boolean;
}

export interface PdfInspectionReport {
  pdfType: PdfType;
  totalPages: number;
  nativePages: number[];
  scannedPages: number[];
  emptyPages: number[];
  error?: string;
}

export interface ExtractionProgressUpdate {
  textbookId?: number;
  materialId?: number;
  totalPages: number;
  processedPages: number;
  nativePagesCount: number;
  ocrPagesCount: number;
  failedPagesCount: number;
  percentage: number;
  currentStep: string;
  status: ExtractionStatus;
  pdfType: PdfType;
}

/**
 * Page-by-page PDF Inspection to automatically classify document type.
 */
export async function inspectPdfPages(pdfBuffer: Buffer): Promise<PdfInspectionReport> {
  if (!pdfBuffer || pdfBuffer.length === 0) {
    return {
      pdfType: 'INVALID',
      totalPages: 0,
      nativePages: [],
      scannedPages: [],
      emptyPages: [],
      error: 'PDF file is empty (0 bytes).',
    };
  }

  let parser: any = null;
  try {
    const PDFParseClass = getPdfParseClass();
    parser = new PDFParseClass({ data: pdfBuffer });
    const textResult = await parser.getText();

    const totalPages = textResult?.total || textResult?.pages?.length || 0;
    if (totalPages === 0) {
      return {
        pdfType: 'INVALID',
        totalPages: 0,
        nativePages: [],
        scannedPages: [],
        emptyPages: [],
        error: 'PDF has 0 pages or could not be decoded.',
      };
    }

    const nativePages: number[] = [];
    const scannedPages: number[] = [];
    const emptyPages: number[] = [];

    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      const rawText = textResult.pages?.[i]?.text || '';
      const stripped = rawText.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '').trim();
      const cleaned = cleanText(stripped);
      const meaningfulChars = cleaned.replace(/[^a-zA-Z0-9\u0B80-\u0BFF]/g, '').length;

      if (meaningfulChars >= 40) {
        nativePages.push(pageNum);
      } else if (meaningfulChars > 0 && meaningfulChars < 40) {
        scannedPages.push(pageNum);
      } else {
        // Empty or scanned image without any embedded font stream
        scannedPages.push(pageNum);
      }
    }

    let pdfType: PdfType = 'TEXT_BASED';
    if (nativePages.length === totalPages) {
      pdfType = 'TEXT_BASED';
    } else if (scannedPages.length === totalPages) {
      pdfType = 'SCANNED';
    } else if (nativePages.length > 0 && scannedPages.length > 0) {
      pdfType = 'MIXED';
    } else {
      pdfType = 'SCANNED';
    }

    return {
      pdfType,
      totalPages,
      nativePages,
      scannedPages,
      emptyPages,
    };
  } catch (err: any) {
    console.warn('[PDF Inspection] Error inspecting PDF:', err.message);
    return {
      pdfType: 'INVALID',
      totalPages: 0,
      nativePages: [],
      scannedPages: [],
      emptyPages: [],
      error: err.message || 'Corrupted or unreadable PDF.',
    };
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {}
    }
  }
}

/**
 * Finds or creates a mirror record in `textbooks` for a Google Drive material.
 * Ensures `textbook_content` rows are properly indexed and accessible everywhere.
 */
export async function getOrCreateTextbookForDriveMaterial(material: any): Promise<number> {
  const fileId = material.google_drive_file_id;
  const filePath = `gdrive://${fileId}`;
  const bookName = (material.file_name || 'TNPSC Textbook').replace(/\.pdf$/i, '');
  const standard = material.standard || 6;
  const subject = material.subject || 'General Studies';
  const group = material.tnpsc_group || 'group4';
  const medium = material.medium || 'Tamil';
  const term = material.term || 'Term 1';
  const volume = material.volume || null;
  const fileSize = material.file_size || 0;

  // Check if textbook already exists
  const res = await pool.query(
    `SELECT id FROM textbooks WHERE file_path = $1 OR file_path LIKE $2 LIMIT 1`,
    [filePath, `%${fileId}%`]
  );
  if (res.rows.length > 0) {
    return res.rows[0].id;
  }

  // Insert mirror textbook record
  const insertRes = await pool.query(
    `INSERT INTO textbooks (
      group_id, standard, subject, medium, term, volume, book_name, file_path, file_size, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'processing')
    RETURNING id`,
    [group, standard, subject, medium, term, volume, bookName, filePath, fileSize]
  );
  return insertRes.rows[0].id;
}

/**
 * Returns the durable extraction job row for a textbook/material, creating it when missing.
 * The row is the resumable cursor + status record; no in-memory queue is involved.
 */
async function getOrCreateExtractionJob(options: {
  textbookId: number;
  materialId?: number | null;
  fileName: string;
  driveFileId?: string | null;
}): Promise<number> {
  const { textbookId, materialId = null, fileName, driveFileId = null } = options;

  const existing = await pool.query(
    `SELECT id FROM pdf_extractions
     WHERE textbook_id = $1 OR ($2::int IS NOT NULL AND material_id = $2)
     ORDER BY id DESC LIMIT 1`,
    [textbookId, materialId]
  );

  if (existing.rows.length > 0) {
    const jobId = existing.rows[0].id;
    await pool.query(
      `UPDATE pdf_extractions SET
         material_id = COALESCE($2, material_id),
         file_name = $3,
         google_drive_file_id = COALESCE($4, google_drive_file_id),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [jobId, materialId, fileName, driveFileId]
    );
    return jobId;
  }

  const inserted = await pool.query(
    `INSERT INTO pdf_extractions (material_id, textbook_id, file_name, google_drive_file_id, extraction_status)
     VALUES ($1, $2, $3, $4, 'PENDING') RETURNING id`,
    [materialId, textbookId, fileName, driveFileId]
  );
  return inserted.rows[0].id;
}

/**
 * Creates the durable job row for a Drive material without downloading the PDF.
 * Upload endpoints call this before any fire-and-forget work so status survives function termination.
 */
export async function ensureExtractionJobForMaterial(materialId: number): Promise<number | null> {
  const res = await pool.query(`SELECT * FROM google_drive_materials WHERE id = $1`, [materialId]);
  if (res.rows.length === 0) return null;
  const material = res.rows[0];
  const textbookId = await getOrCreateTextbookForDriveMaterial(material);
  return getOrCreateExtractionJob({
    textbookId,
    materialId,
    fileName: material.file_name,
    driveFileId: material.google_drive_file_id,
  });
}

async function aggregateExtractedPages(textbookId: number): Promise<{
  completed: number;
  native: number;
  ocr: number;
  failed: number;
  pageRows: Map<number, { status: string; isOcr: boolean }>;
}> {
  const res = await pool.query(
    `SELECT page_number, extraction_status, is_ocr
     FROM textbook_content WHERE textbook_id = $1`,
    [textbookId]
  );
  const pageRows = new Map<number, { status: string; isOcr: boolean }>();
  let native = 0;
  let ocr = 0;
  let failed = 0;

  for (const row of res.rows) {
    const status = String(row.extraction_status || 'completed');
    const isOcr = Boolean(row.is_ocr);
    pageRows.set(Number(row.page_number), { status, isOcr });
    if (status === 'completed') {
      if (isOcr) ocr++;
      else native++;
    } else if (status === 'failed') {
      failed++;
    }
  }

  return { completed: native + ocr, native, ocr, failed, pageRows };
}

function methodForPdfType(pdfType: PdfType): 'direct_text' | 'ocr' | 'hybrid' {
  if (pdfType === 'TEXT_BASED') return 'direct_text';
  if (pdfType === 'SCANNED') return 'ocr';
  return 'hybrid';
}

async function finalizeExtraction(options: {
  textbookId: number;
  materialId?: number | null;
  jobId: number;
  totalPages: number;
  pdfType: PdfType;
  fileName: string;
}): Promise<{
  status: ExtractionStatus;
  nativePagesCount: number;
  ocrPagesCount: number;
  failedPagesCount: number;
  completionPercentage: number;
}> {
  const { textbookId, materialId = null, jobId, totalPages, pdfType, fileName } = options;
  const counts = await aggregateExtractedPages(textbookId);
  const completed = counts.native + counts.ocr;
  const status: ExtractionStatus =
    counts.failed === 0 && completed >= totalPages
      ? 'COMPLETED'
      : completed > 0
      ? 'PARTIALLY_COMPLETED'
      : 'FAILED';
  const pct = totalPages > 0 ? Math.min(100, Math.round((completed / totalPages) * 100)) : 0;
  const errorMessage = counts.failed > 0 ? `${counts.failed} of ${totalPages} pages could not be extracted.` : null;

  const pagesRes = await pool.query(
    `SELECT page_number, content, unit_id, unit_title, lesson_title, topic, is_ocr, extraction_method,
            ocr_confidence, extraction_status, file_name, standard, subject, term, material_id
     FROM textbook_content WHERE textbook_id = $1 ORDER BY page_number ASC`,
    [textbookId]
  );
  const pagesData = pagesRes.rows.map((r) => ({
    pageNumber: Number(r.page_number),
    text: String(r.content || ''),
    method: r.extraction_method || (r.is_ocr ? 'ocr' : 'native'),
    isOcr: Boolean(r.is_ocr),
    unitId: r.unit_id == null ? undefined : Number(r.unit_id),
    unitTitle: r.unit_title || undefined,
    lessonTitle: r.lesson_title || undefined,
    topic: r.topic || undefined,
    fileName: r.file_name || fileName,
    standard: r.standard || undefined,
    subject: r.subject || undefined,
    term: r.term || undefined,
    pdfId: textbookId,
    materialId: r.material_id || materialId || undefined,
    status: r.extraction_status || 'completed',
    ocrConfidence: r.ocr_confidence ? Number(r.ocr_confidence) : undefined,
  }));
  const extractedText = pagesData
    .map((p) => `=== [Page ${p.pageNumber}] ===\n${p.text}`)
    .join('\n\n')
    .slice(0, 1000000);

  await pool.query(
    `UPDATE textbooks SET
       page_count = $1, total_pages = $1, native_pages = $2, ocr_pages = $3, failed_pages = $4,
       completion_percentage = $5, pdf_type = $6, extraction_status = $7, extraction_method = $8,
       status = $9, error_message = $10, extracted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $11`,
    [
      totalPages,
      counts.native,
      counts.ocr,
      counts.failed,
      pct,
      pdfType,
      status,
      methodForPdfType(pdfType),
      status === 'FAILED' ? 'failed' : 'completed',
      errorMessage,
      textbookId,
    ]
  );

  if (materialId) {
    await pool.query(
      `UPDATE google_drive_materials SET
         page_count = $1, total_pages = $1, native_pages = $2, ocr_pages = $3, failed_pages = $4,
         completion_percentage = $5, pdf_type = $6, extraction_status = $7, extraction_method = $8,
         upload_status = $9, extracted_text = $10, extracted_pages = $11::jsonb, extraction_error = $12,
         extracted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $13`,
      [
        totalPages,
        counts.native,
        counts.ocr,
        counts.failed,
        pct,
        pdfType,
        status,
        methodForPdfType(pdfType),
        status === 'FAILED' ? 'failed' : 'completed',
        extractedText,
        JSON.stringify(pagesData),
        errorMessage,
        materialId,
      ]
    );
  }

  await pool.query(
    `UPDATE pdf_extractions SET
       extraction_status = $2, extraction_method = $3, total_pages = $4, next_page = $5,
       extracted_pages = $6, failed_pages = $7, native_pages = $8, ocr_pages = $9,
       pdf_type = $10, extracted_text = $11, pages_data = $12::jsonb, extraction_error = $13,
       extracted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [
      jobId,
      status,
      methodForPdfType(pdfType),
      totalPages,
      totalPages + 1,
      completed,
      counts.failed,
      counts.native,
      counts.ocr,
      pdfType,
      extractedText,
      JSON.stringify(pagesData),
      errorMessage,
    ]
  );

  console.log(
    `[PDF Extraction] Finalized ${fileName} (textbook #${textbookId}): ${status}, ${completed}/${totalPages} pages, ${counts.failed} failed.`
  );

  return {
    status,
    nativePagesCount: counts.native,
    ocrPagesCount: counts.ocr,
    failedPagesCount: counts.failed,
    completionPercentage: pct,
  };
}

/**
 * Main Automatic Extraction and OCR Pipeline.
 * Can be called with either textbookId or materialId.
 *
 * Processes a bounded slice of pages per invocation and persists the page cursor, so the caller
 * (frontend polling or Admin retry) can resume until `inProgress` is false.
 */
export async function processAutomaticPdfExtraction(options: {
  textbookId?: number;
  materialId?: number;
  retryOnlyFailed?: boolean;
  onProgress?: (progress: ExtractionProgressUpdate) => void;
  maxDurationMs?: number;
  pageLimit?: number;
  processAllPages?: boolean;
}): Promise<{
  success: boolean;
  pdfType: PdfType;
  totalPages: number;
  nativePagesCount: number;
  ocrPagesCount: number;
  failedPagesCount: number;
  extractedPagesCount: number;
  status: ExtractionStatus;
  inProgress: boolean;
  nextPage: number;
  remainingPages: number;
  errorMessage?: string;
}> {
  const {
    textbookId: inputTbId,
    materialId: inputMatId,
    retryOnlyFailed = false,
    onProgress,
    maxDurationMs = DEFAULT_MAX_DURATION_MS,
    pageLimit = DEFAULT_PAGE_LIMIT,
    processAllPages = false,
  } = options;

  const startedAt = Date.now();
  let textbookId = inputTbId;
  let materialId = inputMatId;
  let pdfBuffer: Buffer | null = null;
  let fileName = 'textbook.pdf';
  let standard = 6;
  let subject = 'General Studies';
  let medium = 'Tamil';
  let group = 'group4';
  let term = 'Term 1';
  let materialRow: any = null;

  // 1. Resolve Textbook / Drive Material and get PDF Buffer
  if (materialId) {
    const matRes = await pool.query(`SELECT * FROM google_drive_materials WHERE id = $1`, [materialId]);
    if (matRes.rows.length === 0) {
      throw new Error(`Google Drive Material #${materialId} not found.`);
    }
    materialRow = matRes.rows[0];
    fileName = materialRow.file_name;
    standard = materialRow.standard || 6;
    subject = materialRow.subject || 'General Studies';
    medium = materialRow.medium || 'Tamil';
    group = materialRow.tnpsc_group || 'group4';
    term = materialRow.term || 'Term 1';

    // Ensure corresponding textbook record exists
    if (!textbookId) {
      textbookId = await getOrCreateTextbookForDriveMaterial(materialRow);
    }

    console.log(`[PDF Extraction] Fetching Google Drive PDF buffer for "${fileName}" (ID: ${materialRow.google_drive_file_id})...`);
    pdfBuffer = await getDriveFileBuffer(materialRow.google_drive_file_id);
  } else if (textbookId) {
    const tbRes = await pool.query(`SELECT * FROM textbooks WHERE id = $1`, [textbookId]);
    if (tbRes.rows.length === 0) {
      throw new Error(`Textbook #${textbookId} not found.`);
    }
    const tb = tbRes.rows[0];
    fileName = tb.book_name;
    standard = tb.standard || 6;
    subject = tb.subject || 'General Studies';
    medium = tb.medium || 'Tamil';
    group = tb.group_id || 'group4';
    term = tb.term || 'Term 1';

    if (String(tb.file_path).startsWith('gdrive://')) {
      const gdriveFileId = tb.file_path.replace('gdrive://', '').trim();
      pdfBuffer = await getDriveFileBuffer(gdriveFileId);
    } else if (fs.existsSync(tb.file_path)) {
      pdfBuffer = fs.readFileSync(tb.file_path);
    } else {
      // Check if linked in google_drive_materials
      const gMatRes = await pool.query(`SELECT * FROM google_drive_materials WHERE file_name = $1 OR original_file_name = $1 LIMIT 1`, [tb.book_name]);
      if (gMatRes.rows.length > 0) {
        materialId = gMatRes.rows[0].id;
        materialRow = gMatRes.rows[0];
        pdfBuffer = await getDriveFileBuffer(materialRow.google_drive_file_id);
      } else {
        throw new Error(`Textbook PDF file not found at path: ${tb.file_path}`);
      }
    }
  }

  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error('Unable to acquire PDF buffer (file is empty or missing).');
  }

  // 2. Durable job + bounded per-page processing
  const reportProgress = async (
    step: string,
    pct: number,
    status: ExtractionStatus,
    pdfType: PdfType = 'UNKNOWN',
    native = 0,
    ocr = 0,
    failed = 0,
    total = 0,
    processed = 0
  ) => {
    onProgress?.({
      textbookId,
      materialId,
      totalPages: total,
      processedPages: processed,
      nativePagesCount: native,
      ocrPagesCount: ocr,
      failedPagesCount: failed,
      percentage: pct,
      currentStep: step,
      status,
      pdfType,
    });

    if (textbookId) {
      const textbookStatus =
        status === 'COMPLETED' || status === 'PARTIALLY_COMPLETED'
          ? 'completed'
          : status === 'FAILED'
          ? 'failed'
          : 'processing';
      await pool.query(
        `UPDATE textbooks SET
           extraction_status = $1, pdf_type = $2, completion_percentage = $3,
           native_pages = $4, ocr_pages = $5, failed_pages = $6, status = $7,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $8`,
        [status, pdfType, pct, native, ocr, failed, textbookStatus, textbookId]
      );
    }

    if (materialId) {
      await pool.query(
        `UPDATE google_drive_materials SET
           extraction_status = $1, pdf_type = $2, completion_percentage = $3,
           native_pages = $4, ocr_pages = $5, failed_pages = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7`,
        [status, pdfType, pct, native, ocr, failed, materialId]
      );
    }
  };

  // Advisory lock prevents two overlapping HTTP invocations from processing the same PDF twice.
  const lockClient = await pool.connect();
  const lockKey = `pdf_extraction:${textbookId}`;
  let lockHeld = false;
  let parser: any = null;

  try {
    const lockRes = await lockClient.query(`SELECT pg_try_advisory_lock(hashtext($1)) AS locked`, [lockKey]);
    lockHeld = Boolean(lockRes.rows[0]?.locked);

    if (!lockHeld) {
      const current = await getExtractionStatus({ textbookId, materialId });
      const finished = current.status === 'COMPLETED' || current.status === 'PARTIALLY_COMPLETED' || current.status === 'FAILED';
      return {
        success: current.status !== 'FAILED',
        pdfType: current.pdfType,
        totalPages: current.totalPages,
        nativePagesCount: current.nativePages,
        ocrPagesCount: current.ocrPages,
        failedPagesCount: current.failedPages,
        extractedPagesCount: current.nativePages + current.ocrPages,
        status: finished ? current.status : 'PROCESSING',
        inProgress: !finished,
        nextPage: current.nextPage || 1,
        remainingPages: current.remainingPages || 0,
      };
    }

    const jobId = await getOrCreateExtractionJob({
      textbookId: textbookId!,
      materialId,
      fileName,
      driveFileId: materialRow?.google_drive_file_id || null,
    });

    const jobRes = await pool.query(`SELECT * FROM pdf_extractions WHERE id = $1`, [jobId]);
    const job = jobRes.rows[0] || {};
    const finishedJob = ['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED'].includes(String(job.extraction_status));

    // An explicit new run restarts the cursor; an interrupted run resumes where it stopped.
    let cursor = finishedJob && !retryOnlyFailed ? 1 : Number(job.next_page) || 1;
    if (finishedJob && !retryOnlyFailed) {
      await pool.query(
        `UPDATE pdf_extractions SET
           next_page = 1, extraction_status = 'PROCESSING', extracted_pages = 0, failed_pages = 0,
           native_pages = 0, ocr_pages = 0, extraction_error = NULL, extracted_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [jobId]
      );
    } else if (String(job.extraction_status) !== 'PROCESSING') {
      await pool.query(
        `UPDATE pdf_extractions SET extraction_status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [jobId]
      );
    }

    await reportProgress('Analyzing PDF structure & inspecting page types...', 5, 'DETECTING');

    // One parse for native text; the parser stays alive so scanned pages can be rasterized for OCR.
    const PDFParseClass = getPdfParseClass();
    parser = new PDFParseClass({ data: pdfBuffer });
    let textResult: any;
    try {
      textResult = await parser.getText();
    } catch (parseErr: any) {
      const errorMsg = parseErr?.message || 'Corrupted or unreadable PDF document.';
      await pool.query(
        `UPDATE pdf_extractions SET extraction_status='FAILED', extraction_error=$2, extracted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [jobId, errorMsg]
      );
      await reportProgress(errorMsg, 0, 'FAILED', 'INVALID');
      if (textbookId) {
        await pool.query(`UPDATE textbooks SET status='failed', extraction_status='FAILED', error_message=$1 WHERE id=$2`, [errorMsg, textbookId]);
      }
      if (materialId) {
        await pool.query(`UPDATE google_drive_materials SET upload_status='failed', extraction_status='FAILED', extraction_error=$1 WHERE id=$2`, [errorMsg, materialId]);
      }
      return {
        success: false,
        pdfType: 'INVALID',
        totalPages: 0,
        nativePagesCount: 0,
        ocrPagesCount: 0,
        failedPagesCount: 0,
        extractedPagesCount: 0,
        status: 'FAILED',
        inProgress: false,
        nextPage: 1,
        remainingPages: 0,
        errorMessage: errorMsg,
      };
    }

    const totalPages = Number(textResult?.total || textResult?.pages?.length || 0);
    if (!totalPages) {
      const errorMsg = 'PDF has 0 pages or could not be decoded.';
      await pool.query(
        `UPDATE pdf_extractions SET extraction_status='FAILED', extraction_error=$2, extracted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [jobId, errorMsg]
      );
      await reportProgress(errorMsg, 0, 'FAILED', 'INVALID');
      return {
        success: false,
        pdfType: 'INVALID',
        totalPages: 0,
        nativePagesCount: 0,
        ocrPagesCount: 0,
        failedPagesCount: 0,
        extractedPagesCount: 0,
        status: 'FAILED',
        inProgress: false,
        nextPage: 1,
        remainingPages: 0,
        errorMessage: errorMsg,
      };
    }

    const nativePages = new Set<number>();
    for (let i = 0; i < totalPages; i++) {
      if (meaningfulCharCount(textResult.pages?.[i]?.text || '') >= 40) nativePages.add(i + 1);
    }
    const pdfType: PdfType =
      nativePages.size === totalPages ? 'TEXT_BASED' : nativePages.size === 0 ? 'SCANNED' : 'MIXED';

    const counts = await aggregateExtractedPages(textbookId!);
    let nativeCount = counts.native;
    let ocrCount = counts.ocr;
    let failedCount = counts.failed;
    const pageRows = counts.pageRows;

    let pagesToProcess: number[];
    if (retryOnlyFailed) {
      const failedRes = await pool.query(
        `SELECT page_number FROM textbook_content WHERE textbook_id = $1 AND extraction_status = 'failed' ORDER BY page_number ASC`,
        [textbookId]
      );
      pagesToProcess = failedRes.rows.map((r) => Number(r.page_number));
    } else {
      pagesToProcess = [];
      for (let p = cursor; p <= totalPages; p++) pagesToProcess.push(p);
    }

    // Preserve syllabus continuity for pages that carry no unit/lesson header of their own.
    let activeUnitId: number | undefined;
    let activeUnitTitle: string | undefined;
    let activeLessonTitle: string | undefined;
    if (pagesToProcess.length > 0) {
      const prev = await pool.query(
        `SELECT unit_id, unit_title, lesson_title FROM textbook_content
         WHERE textbook_id = $1 AND page_number < $2 ORDER BY page_number DESC LIMIT 1`,
        [textbookId, pagesToProcess[0]]
      );
      if (prev.rows.length > 0) {
        activeUnitId = prev.rows[0].unit_id == null ? undefined : Number(prev.rows[0].unit_id);
        activeUnitTitle = prev.rows[0].unit_title || undefined;
        activeLessonTitle = prev.rows[0].lesson_title || undefined;
      }
    }

    await reportProgress(
      `Detected ${pdfType} document (${totalPages} pages). Extracting...`,
      Math.min(99, Math.round((counts.completed / totalPages) * 100)),
      'PROCESSING',
      pdfType,
      nativeCount,
      ocrCount,
      failedCount,
      totalPages,
      counts.completed
    );

    let processedThisRun = 0;
    let budgetExhausted = false;

    for (const pageNum of pagesToProcess) {
      if (!processAllPages && (Date.now() - startedAt >= maxDurationMs || processedThisRun >= pageLimit)) {
        budgetExhausted = true;
        break;
      }

      // When extracting all pages, yield briefly every 25 pages so the node event loop remains responsive
      if (processAllPages && processedThisRun > 0 && processedThisRun % 25 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      const i = pageNum - 1;
      const isNative = nativePages.has(pageNum);
      let pageText = '';
      let extractionMethod = 'native';
      let isOcr = false;
      let ocrConfidence: number | null = null;
      let pageStatus = 'completed';
      let pageError: string | null = null;

      if (isNative) {
        const raw = textResult.pages?.[i]?.text || '';
        pageText = repairInDesignPdfArtifacts(cleanTamilUnicodeText(cleanText(raw)));
      } else {
        isOcr = true;
        extractionMethod = 'ocr_vision';
        try {
          const shot = await parser.getScreenshot({
            partial: [pageNum],
            desiredWidth: 1600,
            imageBuffer: true,
            imageDataUrl: false,
          });
          const imageData = shot?.pages?.[0]?.data;
          const imageBuffer = imageData ? Buffer.from(imageData) : null;

          if (!imageBuffer || imageBuffer.length === 0) {
            pageStatus = 'failed';
            pageError = `Could not render page ${pageNum} to an image for OCR.`;
          } else {
            const ocrResult = await extractOcrForPage({
              imageBuffer,
              pageNumber: pageNum,
              standard,
              medium,
              subject,
              totalPages,
            });

            if (ocrResult.text && ocrResult.text.trim().length >= 10) {
              pageText = ocrResult.text;
              extractionMethod = ocrResult.method;
              ocrConfidence = ocrResult.confidence;
            } else {
              pageStatus = 'failed';
              pageError =
                ocrResult.error ||
                `OCR produced no readable characters for page ${pageNum} (blank or unreadable page).`;
            }
          }
        } catch (ocrErr: any) {
          pageStatus = 'failed';
          pageError = `OCR failed for page ${pageNum}: ${ocrErr?.message || 'unknown error'}`;
        }
      }

      // TNPSC syllabus mapping via existing heuristics (no hardcoded lesson data).
      const meta = extractPageSyllabusMeta(pageText, subject, pageNum, totalPages);
      if (meta.unitId) {
        if (meta.unitId !== activeUnitId) activeLessonTitle = undefined;
        activeUnitId = meta.unitId;
      }
      if (meta.unitTitle) activeUnitTitle = meta.unitTitle;
      if (meta.lessonTitle) activeLessonTitle = meta.lessonTitle;

      const unitId = meta.unitId || activeUnitId || 1;
      const unitTitle = meta.unitTitle || activeUnitTitle || `Unit ${unitId}`;
      const lessonTitle = meta.lessonTitle || activeLessonTitle || `${subject} Chapter ${unitId}`;
      const topic = meta.topic || lessonTitle;

      const previous = pageRows.get(pageNum);
      if (previous?.status === 'completed') {
        if (previous.isOcr) ocrCount = Math.max(0, ocrCount - 1);
        else nativeCount = Math.max(0, nativeCount - 1);
      } else if (previous?.status === 'failed') {
        failedCount = Math.max(0, failedCount - 1);
      }

      await pool.query(
        `INSERT INTO textbook_content (
          textbook_id, page_number, unit_id, unit_title, lesson_title, topic,
          content, text_length, is_ocr, extraction_method, ocr_confidence,
          extraction_status, extraction_error, file_name, standard, subject,
          term, material_id, processing_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP)
        ON CONFLICT (textbook_id, page_number) DO UPDATE SET
          unit_id = EXCLUDED.unit_id,
          unit_title = EXCLUDED.unit_title,
          lesson_title = EXCLUDED.lesson_title,
          topic = EXCLUDED.topic,
          content = EXCLUDED.content,
          text_length = EXCLUDED.text_length,
          is_ocr = EXCLUDED.is_ocr,
          extraction_method = EXCLUDED.extraction_method,
          ocr_confidence = EXCLUDED.ocr_confidence,
          extraction_status = EXCLUDED.extraction_status,
          extraction_error = EXCLUDED.extraction_error,
          file_name = EXCLUDED.file_name,
          standard = EXCLUDED.standard,
          subject = EXCLUDED.subject,
          term = EXCLUDED.term,
          material_id = EXCLUDED.material_id,
          processing_timestamp = CURRENT_TIMESTAMP`,
        [
          textbookId,
          pageNum,
          unitId,
          unitTitle,
          lessonTitle,
          topic,
          pageText,
          pageText.length,
          isOcr,
          extractionMethod,
          ocrConfidence,
          pageStatus,
          pageError,
          fileName,
          standard,
          subject,
          term,
          materialId || null,
        ]
      );

      pageRows.set(pageNum, { status: pageStatus, isOcr });
      if (pageStatus === 'completed') {
        if (isOcr) ocrCount++;
        else nativeCount++;
      } else {
        failedCount++;
      }
      processedThisRun++;
      if (!retryOnlyFailed) cursor = pageNum + 1;

      const completedCount = nativeCount + ocrCount;
      const pct = Math.min(99, Math.round((completedCount / totalPages) * 100));

      // Commit the cursor after every page so a killed invocation resumes exactly here.
      await pool.query(
        `UPDATE pdf_extractions SET
           extraction_status = 'PROCESSING', total_pages = $2, next_page = $3, extracted_pages = $4,
           failed_pages = $5, native_pages = $6, ocr_pages = $7, pdf_type = $8, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [jobId, totalPages, cursor, completedCount, failedCount, nativeCount, ocrCount, pdfType]
      );

      if (processedThisRun % 5 === 0) {
        await reportProgress(
          `Extracted page ${pageNum} of ${totalPages} (${isOcr ? 'OCR' : 'Native'})...`,
          pct,
          'PROCESSING',
          pdfType,
          nativeCount,
          ocrCount,
          failedCount,
          totalPages,
          completedCount
        );
      }
    }

    const done = retryOnlyFailed ? !budgetExhausted : cursor > totalPages;

    if (!done) {
      const completedCount = nativeCount + ocrCount;
      const pct = Math.min(99, Math.round((completedCount / totalPages) * 100));
      await reportProgress(
        `Extraction in progress: ${completedCount}/${totalPages} pages stored.`,
        pct,
        'PROCESSING',
        pdfType,
        nativeCount,
        ocrCount,
        failedCount,
        totalPages,
        completedCount
      );
      return {
        success: true,
        pdfType,
        totalPages,
        nativePagesCount: nativeCount,
        ocrPagesCount: ocrCount,
        failedPagesCount: failedCount,
        extractedPagesCount: completedCount,
        status: 'PROCESSING',
        inProgress: true,
        nextPage: cursor,
        remainingPages: Math.max(0, totalPages - completedCount),
      };
    }

    const final = await finalizeExtraction({
      textbookId: textbookId!,
      materialId,
      jobId,
      totalPages,
      pdfType,
      fileName,
    });

    await reportProgress(
      final.status === 'COMPLETED'
        ? `Successfully extracted all ${totalPages} pages (${final.nativePagesCount} native, ${final.ocrPagesCount} OCR).`
        : `Extraction completed with ${final.failedPagesCount} failed page(s).`,
      final.completionPercentage,
      final.status,
      pdfType,
      final.nativePagesCount,
      final.ocrPagesCount,
      final.failedPagesCount,
      totalPages,
      final.nativePagesCount + final.ocrPagesCount
    );

    console.log(
      `[PDF Extraction] ${fileName}: status=${final.status}, native=${final.nativePagesCount}, ocr=${final.ocrPagesCount}, failed=${final.failedPagesCount}`
    );

    return {
      success: final.status !== 'FAILED',
      pdfType,
      totalPages,
      nativePagesCount: final.nativePagesCount,
      ocrPagesCount: final.ocrPagesCount,
      failedPagesCount: final.failedPagesCount,
      extractedPagesCount: final.nativePagesCount + final.ocrPagesCount,
      status: final.status,
      inProgress: false,
      nextPage: totalPages + 1,
      remainingPages: 0,
      errorMessage: final.failedPagesCount > 0 ? `${final.failedPagesCount} page(s) failed extraction.` : undefined,
    };
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {}
    }
    if (lockHeld) {
      try {
        await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [lockKey]);
      } catch {}
    }
    lockClient.release();
  }
}

/**
 * Backward-compatible helper for services calling extractAndPersistPdf
 */
export async function extractAndPersistPdf(options: {
  materialId?: number;
  textbookId?: number;
  googleDriveFileId?: string;
  buffer?: Buffer;
  forceReExtract?: boolean;
  processAllPages?: boolean;
}): Promise<{
  success: boolean;
  totalPages: number;
  extractedPages: number;
  failedPages: number;
  method: 'direct_text' | 'ocr' | 'hybrid';
  status: ExtractionStatus;
  inProgress: boolean;
  nextPage: number;
  remainingPages: number;
  error?: string;
}> {
  let materialId = options.materialId;
  if (!materialId && options.googleDriveFileId) {
    const res = await pool.query(`SELECT id FROM google_drive_materials WHERE google_drive_file_id = $1 LIMIT 1`, [options.googleDriveFileId]);
    if (res.rows.length > 0) materialId = res.rows[0].id;
  }

  const result = await processAutomaticPdfExtraction({
    materialId,
    textbookId: options.textbookId,
    retryOnlyFailed: !options.forceReExtract,
    processAllPages: options.processAllPages ?? false,
  });

  return {
    success: result.success,
    totalPages: result.totalPages,
    extractedPages: result.nativePagesCount + result.ocrPagesCount,
    failedPages: result.failedPagesCount,
    method: result.pdfType === 'TEXT_BASED' ? 'direct_text' : result.pdfType === 'SCANNED' ? 'ocr' : 'hybrid',
    status: result.status,
    inProgress: result.inProgress,
    nextPage: result.nextPage,
    remainingPages: result.remainingPages,
    error: result.errorMessage,
  };
}


/**
 * Returns extraction status and metrics for a textbook or material.
 */
export async function getExtractionStatus(options: {
  materialId?: number;
  textbookId?: number;
}): Promise<{
  id: number;
  fileName: string;
  pdfType: PdfType;
  totalPages: number;
  nativePages: number;
  ocrPages: number;
  failedPages: number;
  completionPercentage: number;
  status: ExtractionStatus;
  nextPage: number;
  remainingPages: number;
  errorMessage?: string | null;
  extractedAt?: string | null;
}> {
  const { materialId, textbookId } = options;

  let base: any;
  let job: any;
  let resolvedTextbookId = textbookId;

  if (materialId) {
    const res = await pool.query(
      `SELECT id, file_name, google_drive_file_id, pdf_type, total_pages, page_count, native_pages, ocr_pages,
              failed_pages, completion_percentage, extraction_status, upload_status,
              extraction_error, extracted_at
       FROM google_drive_materials WHERE id = $1`,
      [materialId]
    );
    if (res.rows.length === 0) throw new Error(`Material #${materialId} not found.`);
    base = res.rows[0];
    if (!resolvedTextbookId) {
      const tbRes = await pool.query(`SELECT id FROM textbooks WHERE file_path = $1 LIMIT 1`, [`gdrive://${base.google_drive_file_id}`]);
      resolvedTextbookId = tbRes.rows[0]?.id;
    }
  } else if (textbookId) {
    const res = await pool.query(
      `SELECT id, book_name, pdf_type, total_pages, page_count, native_pages, ocr_pages,
              failed_pages, completion_percentage, extraction_status, status,
              error_message, extracted_at
       FROM textbooks WHERE id = $1`,
      [textbookId]
    );
    if (res.rows.length === 0) throw new Error(`Textbook #${textbookId} not found.`);
    base = res.rows[0];
  } else {
    throw new Error('Either materialId or textbookId must be provided.');
  }

  if (resolvedTextbookId || materialId) {
    const jobRes = await pool.query(
      `SELECT * FROM pdf_extractions
       WHERE ($1::int IS NOT NULL AND textbook_id = $1) OR ($2::int IS NOT NULL AND material_id = $2)
       ORDER BY id DESC LIMIT 1`,
      [resolvedTextbookId ?? null, materialId ?? null]
    );
    job = jobRes.rows[0];
  }

  const total = Number(job?.total_pages || base.total_pages || base.page_count || 0);
  const nativePages = Number(job?.native_pages || base.native_pages || 0);
  const ocrPages = Number(job?.ocr_pages || base.ocr_pages || 0);
  const failedPages = Number(job?.failed_pages ?? base.failed_pages ?? 0);
  const status = (job?.extraction_status ||
    base.extraction_status ||
    (base.extracted_at ? 'COMPLETED' : 'PENDING')) as ExtractionStatus;
  const nextPage = Number(job?.next_page || 1);
  const completed = nativePages + ocrPages;

  return {
    id: base.id,
    fileName: base.file_name || base.book_name,
    pdfType: (job?.pdf_type || base.pdf_type || 'UNKNOWN') as PdfType,
    totalPages: total,
    nativePages,
    ocrPages,
    failedPages,
    completionPercentage:
      base.completion_percentage != null
        ? Number(base.completion_percentage)
        : total > 0
        ? Math.min(100, Math.round((completed / total) * 100))
        : 0,
    status,
    nextPage,
    remainingPages: total > 0 ? Math.max(0, total - completed) : 0,
    errorMessage: job?.extraction_error ?? base.extraction_error ?? base.error_message ?? null,
    extractedAt: job?.extracted_at || base.extracted_at || null,
  };
}

export interface ExtractedPageItem {
  pageNumber: number;
  text: string;
  unitId?: number;
  unitTitle?: string;
  lessonTitle?: string;
  topic?: string;
  fileName?: string;
  pdfId?: number;
  materialId?: number;
  standard?: number;
  subject?: string;
  term?: string;
  isOcr: boolean;
  extractionMethod?: string;
  ocrConfidence?: number | null;
  status?: string;
}

export interface ExtractedPagesResponse {
  totalPages: number;
  fileName?: string;
  pdfId?: number;
  materialId?: number;
  standard?: number;
  subject?: string;
  term?: string;
  pdfType?: string;
  status?: string;
  nativePages?: number;
  ocrPages?: number;
  failedPages?: number;
  pages: ExtractedPageItem[];
}

/**
 * Returns all extracted pages for Admin Review Screen.
 * Includes complete PDF metadata (PDF File Name, PDF ID, Standard, Subject, Term, Unit, Lesson, Page, Text, Status)
 */
export async function getExtractedPages(options: {
  materialId?: number;
  textbookId?: number;
}): Promise<ExtractedPagesResponse> {
  let targetTbId = options.textbookId;
  let materialRow: any = null;
  let textbookRow: any = null;

  if (options.materialId) {
    const matRes = await pool.query(`SELECT * FROM google_drive_materials WHERE id = $1`, [options.materialId]);
    if (matRes.rows.length > 0) {
      materialRow = matRes.rows[0];
      if (!targetTbId) {
        const fileId = materialRow.google_drive_file_id;
        const tbRes = await pool.query(`SELECT * FROM textbooks WHERE file_path LIKE $1 LIMIT 1`, [`%${fileId}%`]);
        if (tbRes.rows.length > 0) {
          textbookRow = tbRes.rows[0];
          targetTbId = textbookRow.id;
        }
      }
    }
  }

  if (targetTbId && !textbookRow) {
    const tbRes = await pool.query(`SELECT * FROM textbooks WHERE id = $1`, [targetTbId]);
    if (tbRes.rows.length > 0) textbookRow = tbRes.rows[0];
  }

  const docFileName = materialRow?.file_name || textbookRow?.book_name || 'textbook.pdf';
  const docStandard = Number(materialRow?.standard || textbookRow?.standard || 6);
  const docSubject = materialRow?.subject || textbookRow?.subject || 'General Studies';
  const docTerm = materialRow?.term || textbookRow?.term || 'Term 1';
  const docPdfType = materialRow?.pdf_type || textbookRow?.pdf_type || 'UNKNOWN';
  const docStatus = materialRow?.extraction_status || textbookRow?.extraction_status || 'PENDING';
  const docNativePages = Number(materialRow?.native_pages || textbookRow?.native_pages || 0);
  const docOcrPages = Number(materialRow?.ocr_pages || textbookRow?.ocr_pages || 0);
  const docFailedPages = Number(materialRow?.failed_pages || textbookRow?.failed_pages || 0);

  if (targetTbId) {
    const pagesRes = await pool.query(
      `SELECT page_number, content AS text, unit_id, unit_title, lesson_title, topic,
              is_ocr, extraction_method, ocr_confidence, extraction_status,
              file_name, standard, subject, term, material_id
       FROM textbook_content
       WHERE textbook_id = $1
       ORDER BY page_number ASC`,
      [targetTbId]
    );

    if (pagesRes.rows.length > 0) {
      return {
        totalPages: pagesRes.rows.length,
        fileName: docFileName,
        pdfId: targetTbId,
        materialId: options.materialId || materialRow?.id,
        standard: docStandard,
        subject: docSubject,
        term: docTerm,
        pdfType: docPdfType,
        status: docStatus,
        nativePages: docNativePages,
        ocrPages: docOcrPages,
        failedPages: docFailedPages,
        pages: pagesRes.rows.map((r) => ({
          pageNumber: Number(r.page_number),
          text: r.text,
          unitId: r.unit_id ? Number(r.unit_id) : undefined,
          unitTitle: r.unit_title,
          lessonTitle: r.lesson_title,
          topic: r.topic,
          fileName: r.file_name || docFileName,
          pdfId: targetTbId,
          materialId: r.material_id || options.materialId || materialRow?.id,
          standard: r.standard || docStandard,
          subject: r.subject || docSubject,
          term: r.term || docTerm,
          isOcr: Boolean(r.is_ocr),
          extractionMethod: r.extraction_method || (r.is_ocr ? 'ocr' : 'native'),
          ocrConfidence: r.ocr_confidence ? Number(r.ocr_confidence) : null,
          status: r.extraction_status || 'completed',
        })),
      };
    }
  }

  // Fallback: check google_drive_materials.extracted_pages JSONB
  if (options.materialId && materialRow?.extracted_pages && Array.isArray(materialRow.extracted_pages)) {
    const rawPages = materialRow.extracted_pages;
    return {
      totalPages: rawPages.length,
      fileName: docFileName,
      pdfId: targetTbId,
      materialId: options.materialId,
      standard: docStandard,
      subject: docSubject,
      term: docTerm,
      pdfType: docPdfType,
      status: docStatus,
      nativePages: docNativePages,
      ocrPages: docOcrPages,
      failedPages: docFailedPages,
      pages: rawPages.map((p: any) => ({
        pageNumber: Number(p.pageNumber || p.pageNum || 1),
        text: p.text || '',
        unitId: p.unitId,
        unitTitle: p.unitTitle,
        lessonTitle: p.lessonTitle,
        topic: p.topic,
        fileName: p.fileName || docFileName,
        pdfId: targetTbId,
        materialId: options.materialId,
        standard: p.standard || docStandard,
        subject: p.subject || docSubject,
        term: p.term || docTerm,
        isOcr: Boolean(p.isOcr),
        extractionMethod: p.method || (p.isOcr ? 'ocr' : 'native'),
        ocrConfidence: p.ocrConfidence || null,
        status: p.status || 'completed',
      })),
    };
  }

  return {
    totalPages: 0,
    fileName: docFileName,
    pdfId: targetTbId,
    materialId: options.materialId,
    standard: docStandard,
    subject: docSubject,
    term: docTerm,
    pdfType: docPdfType,
    status: docStatus,
    pages: [],
  };
}

/**
 * Returns aggregated extraction statistics across all registered PDF materials.
 */
export async function getOverallExtractionOverview(): Promise<{
  totalFiles: number;
  totalPages: number;
  extractedPages: number;
  failedPages: number;
  nativePages: number;
  ocrPages: number;
  completionPercentage: number;
  statusBreakdown: {
    completed: number;
    partiallyCompleted: number;
    processing: number;
    pending: number;
    failed: number;
  };
}> {
  const res = await pool.query(`
    SELECT
      COUNT(*)::int AS total_files,
      COALESCE(SUM(COALESCE(total_pages, page_count, 0)), 0)::int AS total_pages,
      COALESCE(SUM(COALESCE(native_pages, 0) + COALESCE(ocr_pages, 0)), 0)::int AS extracted_pages,
      COALESCE(SUM(COALESCE(failed_pages, 0)), 0)::int AS failed_pages,
      COALESCE(SUM(COALESCE(native_pages, 0)), 0)::int AS native_pages,
      COALESCE(SUM(COALESCE(ocr_pages, 0)), 0)::int AS ocr_pages,
      COUNT(*) FILTER (WHERE extraction_status = 'COMPLETED')::int AS count_completed,
      COUNT(*) FILTER (WHERE extraction_status = 'PARTIALLY_COMPLETED')::int AS count_partial,
      COUNT(*) FILTER (WHERE extraction_status IN ('PROCESSING', 'EXTRACTING', 'OCR_PROCESSING', 'DETECTING'))::int AS count_processing,
      COUNT(*) FILTER (WHERE extraction_status IN ('PENDING') OR extraction_status IS NULL)::int AS count_pending,
      COUNT(*) FILTER (WHERE extraction_status = 'FAILED')::int AS count_failed
    FROM google_drive_materials
  `);

  const row = res.rows[0] || {};
  const totalFiles = Number(row.total_files || 0);
  const totalPages = Number(row.total_pages || 0);
  const extractedPages = Number(row.extracted_pages || 0);
  const failedPages = Number(row.failed_pages || 0);
  const pct = totalPages > 0 ? Math.min(100, Math.round((extractedPages / totalPages) * 100)) : 0;

  return {
    totalFiles,
    totalPages,
    extractedPages,
    failedPages,
    nativePages: Number(row.native_pages || 0),
    ocrPages: Number(row.ocr_pages || 0),
    completionPercentage: pct,
    statusBreakdown: {
      completed: Number(row.count_completed || 0),
      partiallyCompleted: Number(row.count_partial || 0),
      processing: Number(row.count_processing || 0),
      pending: Number(row.count_pending || 0),
      failed: Number(row.count_failed || 0),
    },
  };
}

/**
 * Scans all pending or failed materials and extracts them sequentially to 100% completion.
 */
export async function extractAllPendingMaterials(options?: {
  limit?: number;
  onProgress?: (processed: number, total: number, currentItem: string) => void;
}): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  materials: any[];
}> {
  const limit = options?.limit || 100;
  const pendingRes = await pool.query(
    `SELECT id, file_name, google_drive_file_id
     FROM google_drive_materials
     WHERE extracted_text IS NULL
        OR extraction_status IN ('PENDING', 'FAILED', 'PARTIALLY_COMPLETED')
     ORDER BY id ASC
     LIMIT $1`,
    [limit]
  );

  let succeeded = 0;
  let failed = 0;
  const materials: any[] = [];
  const total = pendingRes.rows.length;

  for (let idx = 0; idx < total; idx++) {
    const item = pendingRes.rows[idx];
    try {
      console.log(`[BatchExtract] (${idx + 1}/${total}) Processing material #${item.id} ("${item.file_name}")...`);
      options?.onProgress?.(idx + 1, total, item.file_name);
      const res = await processAutomaticPdfExtraction({
        materialId: item.id,
        processAllPages: true,
      });
      if (res.success) {
        succeeded++;
      } else {
        failed++;
      }
      materials.push({ id: item.id, fileName: item.file_name, success: res.success, status: res.status });
    } catch (err: any) {
      failed++;
      console.error(`[BatchExtract] Error processing material #${item.id}:`, err.message);
      materials.push({ id: item.id, fileName: item.file_name, success: false, error: err.message });
    }
  }

  return {
    processed: total,
    succeeded,
    failed,
    materials,
  };
}
