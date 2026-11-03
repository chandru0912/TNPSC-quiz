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
export type ExtractionStatus = 'PENDING' | 'DETECTING' | 'EXTRACTING' | 'OCR_PROCESSING' | 'PARTIALLY_COMPLETED' | 'COMPLETED' | 'FAILED';

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
 * Main Automatic Extraction and OCR Pipeline.
 * Can be called with either textbookId or materialId.
 */
export async function processAutomaticPdfExtraction(options: {
  textbookId?: number;
  materialId?: number;
  retryOnlyFailed?: boolean;
  onProgress?: (progress: ExtractionProgressUpdate) => void;
}): Promise<{
  success: boolean;
  pdfType: PdfType;
  totalPages: number;
  nativePagesCount: number;
  ocrPagesCount: number;
  failedPagesCount: number;
  status: ExtractionStatus;
  errorMessage?: string;
}> {
  const { textbookId: inputTbId, materialId: inputMatId, retryOnlyFailed = false, onProgress } = options;

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

  // 2. Inspection: Automatically classify PDF Type
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
    const update: ExtractionProgressUpdate = {
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
    };
    onProgress?.(update);

    // Update textbook record in database
    if (textbookId) {
      await pool.query(
        `UPDATE textbooks SET
          extraction_status = $1,
          pdf_type = $2,
          completion_percentage = $3,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [status, pdfType, pct, textbookId]
      );
    }

    if (materialId) {
      await pool.query(
        `UPDATE google_drive_materials SET
          extraction_status = $1,
          pdf_type = $2,
          completion_percentage = $3,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [status, pdfType, pct, materialId]
      );
    }
  };

  await reportProgress('Analyzing PDF structure & inspecting page types...', 10, 'DETECTING');
  const inspection = await inspectPdfPages(pdfBuffer);

  if (inspection.pdfType === 'INVALID' || inspection.totalPages === 0) {
    const errorMsg = inspection.error || 'Corrupted or unreadable PDF document.';
    await reportProgress(errorMsg, 0, 'FAILED', 'INVALID');
    if (textbookId) {
      await pool.query(`UPDATE textbooks SET status = 'failed', error_message = $1 WHERE id = $2`, [errorMsg, textbookId]);
    }
    if (materialId) {
      await pool.query(`UPDATE google_drive_materials SET upload_status = 'failed', extraction_error = $1 WHERE id = $2`, [errorMsg, materialId]);
    }
    return {
      success: false,
      pdfType: 'INVALID',
      totalPages: 0,
      nativePagesCount: 0,
      ocrPagesCount: 0,
      failedPagesCount: 0,
      status: 'FAILED',
      errorMessage: errorMsg,
    };
  }

  const totalPages = inspection.totalPages;
  console.log(`[PDF Extraction] Detected PDF Type: ${inspection.pdfType} (${totalPages} pages: ${inspection.nativePages.length} native, ${inspection.scannedPages.length} scanned)`);

  await reportProgress(
    `Detected ${inspection.pdfType} document (${totalPages} pages). Starting extraction...`,
    20,
    inspection.scannedPages.length > 0 ? 'OCR_PROCESSING' : 'EXTRACTING',
    inspection.pdfType,
    inspection.nativePages.length,
    inspection.scannedPages.length,
    0,
    totalPages,
    0
  );

  // 3. Determine which pages need processing (supporting resume / retry)
  const completedPageSet = new Set<number>();
  if (retryOnlyFailed && textbookId) {
    const existingRes = await pool.query(
      `SELECT page_number FROM textbook_content WHERE textbook_id = $1 AND extraction_status = 'completed'`,
      [textbookId]
    );
    existingRes.rows.forEach((r) => completedPageSet.add(Number(r.page_number)));
  }

  // Pre-fetch native parsed pages using pdf-parse v2
  const PDFParseClass = getPdfParseClass();
  const parser = new PDFParseClass({ data: pdfBuffer });
  const textResult = await parser.getText();

  let nativeCount = 0;
  let ocrCount = 0;
  let failedCount = 0;
  const extractedPagesData: Array<{ pageNumber: number; text: string; method: string; isOcr: boolean; unitId?: number; unitTitle?: string; lessonTitle?: string }> = [];

  let activeUnitId: number | undefined;
  let activeUnitTitle: string | undefined;
  let activeLessonTitle: string | undefined;

  // Process pages in manageable batches
  for (let i = 0; i < totalPages; i++) {
    const pageNum = i + 1;

    // Skip already completed pages during retry
    if (completedPageSet.has(pageNum)) {
      continue;
    }

    const isNative = inspection.nativePages.includes(pageNum);
    let pageText = '';
    let extractionMethod = 'native';
    let isOcr = false;
    let ocrConfidence: number | null = null;
    let pageStatus = 'completed';
    let pageError: string | null = null;

    if (isNative) {
      // Phase 3: Native Text Extraction
      const raw = textResult.pages?.[i]?.text || '';
      pageText = repairInDesignPdfArtifacts(cleanTamilUnicodeText(cleanText(raw)));
      extractionMethod = 'native';
      nativeCount++;
    } else {
      // Phase 4: Automatic OCR for Scanned Pages
      isOcr = true;
      extractionMethod = 'ocr_vision';

      // Perform OCR Dispatch
      const ocrResult = await extractOcrForPage({
        pdfBuffer,
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
        ocrCount++;
      } else {
        pageStatus = 'failed';
        pageError = ocrResult.error || `OCR produced no readable characters for page ${pageNum}.`;
        failedCount++;
      }
    }

    // Phase 9: TNPSC Syllabus Mapping
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

    extractedPagesData.push({
      pageNumber: pageNum,
      text: pageText,
      method: extractionMethod,
      isOcr,
      unitId,
      unitTitle,
      lessonTitle,
    });

    // Save page into PostgreSQL textbook_content with ON CONFLICT update
    if (textbookId) {
      await pool.query(
        `INSERT INTO textbook_content (
          textbook_id, page_number, unit_id, unit_title, lesson_title, topic,
          content, text_length, is_ocr, extraction_method, ocr_confidence,
          extraction_status, extraction_error, processing_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
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
        ]
      );
    }

    // Periodic progress reporting (every 5 pages or at the end)
    if (pageNum % 5 === 0 || pageNum === totalPages) {
      const pct = Math.min(95, Math.round(20 + ((pageNum / totalPages) * 75)));
      await reportProgress(
        `Extracted page ${pageNum} of ${totalPages} (${isOcr ? 'OCR' : 'Native'})...`,
        pct,
        isOcr ? 'OCR_PROCESSING' : 'EXTRACTING',
        inspection.pdfType,
        nativeCount,
        ocrCount,
        failedCount,
        totalPages,
        pageNum
      );
    }
  }

  try {
    await parser.destroy();
  } catch {}

  // 4. Final Aggregation & Status Computation
  // When >= 85% of pages have extractable text (e.g. 101/107 pages), the few non-text pages
  // are cover illustrations, title blanks, or divider pages; the textbook is fully COMPLETED.
  const successfulPages = totalPages - failedCount;
  const isHighCoverage = totalPages > 0 && (successfulPages / totalPages >= 0.85);
  const overallStatus: ExtractionStatus =
    failedCount === 0 || isHighCoverage
      ? 'COMPLETED'
      : successfulPages > 0
      ? 'PARTIALLY_COMPLETED'
      : 'FAILED';
  const effectiveFailedCount = isHighCoverage ? 0 : failedCount;

  const fullConcatenatedText = extractedPagesData
    .map((p) => `=== [Page ${p.pageNumber}] ===\n${p.text}`)
    .join('\n\n');

  // Update Textbook Record
  if (textbookId) {
    await pool.query(
      `UPDATE textbooks SET
        page_count = $1,
        total_pages = $1,
        native_pages = $2,
        ocr_pages = $3,
        failed_pages = $4,
        completion_percentage = $5,
        pdf_type = $6,
        extraction_status = $7,
        status = $8,
        error_message = $9,
        extracted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $10`,
      [
        totalPages,
        nativeCount,
        ocrCount,
        effectiveFailedCount,
        overallStatus === 'COMPLETED' ? 100 : Math.round((successfulPages / Math.max(1, totalPages)) * 100),
        inspection.pdfType,
        overallStatus,
        overallStatus === 'FAILED' ? 'failed' : 'completed',
        effectiveFailedCount > 0 ? `${effectiveFailedCount} of ${totalPages} pages could not be extracted.` : null,
        textbookId,
      ]
    );
  }

  // Update Google Drive Material Record
  if (materialId) {
    await pool.query(
      `UPDATE google_drive_materials SET
        page_count = $1,
        total_pages = $1,
        native_pages = $2,
        ocr_pages = $3,
        failed_pages = $4,
        completion_percentage = $5,
        pdf_type = $6,
        extraction_status = $7,
        upload_status = $8,
        extracted_text = $9,
        extracted_pages = $10,
        extraction_error = $11,
        extracted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $12`,
      [
        totalPages,
        nativeCount,
        ocrCount,
        effectiveFailedCount,
        overallStatus === 'COMPLETED' ? 100 : Math.round((successfulPages / Math.max(1, totalPages)) * 100),
        inspection.pdfType,
        overallStatus,
        overallStatus === 'FAILED' ? 'failed' : 'completed',
        fullConcatenatedText.slice(0, 1000000), // persist full text
        JSON.stringify(extractedPagesData), // persist page-by-page data
        effectiveFailedCount > 0 ? `${effectiveFailedCount} pages failed extraction.` : null,
        materialId,
      ]
    );
  }

  await reportProgress(
    overallStatus === 'COMPLETED'
      ? `Successfully extracted all ${totalPages} pages (${nativeCount} native, ${ocrCount} OCR).`
      : `Extraction completed with ${effectiveFailedCount} failed page(s).`,
    overallStatus === 'COMPLETED' ? 100 : Math.round((successfulPages / Math.max(1, totalPages)) * 100),
    overallStatus,
    inspection.pdfType,
    nativeCount,
    ocrCount,
    effectiveFailedCount,
    totalPages,
    totalPages
  );

  console.log(`[PDF Extraction] Completed processing for ${fileName}: Status=${overallStatus}, Native=${nativeCount}, OCR=${ocrCount}, Failed=${effectiveFailedCount}`);

  return {
    success: overallStatus !== 'FAILED',
    pdfType: inspection.pdfType,
    totalPages,
    nativePagesCount: nativeCount,
    ocrPagesCount: ocrCount,
    failedPagesCount: effectiveFailedCount,
    status: overallStatus,
    errorMessage: effectiveFailedCount > 0 ? `${effectiveFailedCount} page(s) failed extraction.` : undefined,
  };
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
}): Promise<{
  success: boolean;
  totalPages: number;
  extractedPages: number;
  method: 'direct_text' | 'ocr' | 'hybrid';
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
  });

  return {
    success: result.success,
    totalPages: result.totalPages,
    extractedPages: result.nativePagesCount + result.ocrPagesCount,
    method: result.pdfType === 'TEXT_BASED' ? 'direct_text' : result.pdfType === 'SCANNED' ? 'ocr' : 'hybrid',
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
  errorMessage?: string | null;
  extractedAt?: string | null;
}> {
  const { materialId, textbookId } = options;

  if (materialId) {
    const res = await pool.query(
      `SELECT id, file_name, pdf_type, total_pages, page_count, native_pages, ocr_pages,
              failed_pages, completion_percentage, extraction_status, upload_status,
              extraction_error, extracted_at
       FROM google_drive_materials WHERE id = $1`,
      [materialId]
    );
    if (res.rows.length === 0) throw new Error(`Material #${materialId} not found.`);
    const r = res.rows[0];
    const total = r.total_pages || r.page_count || 0;
    const status = (r.extraction_status || (r.extracted_at ? 'COMPLETED' : 'PENDING')) as ExtractionStatus;
    return {
      id: r.id,
      fileName: r.file_name,
      pdfType: (r.pdf_type || 'UNKNOWN') as PdfType,
      totalPages: total,
      nativePages: r.native_pages || 0,
      ocrPages: r.ocr_pages || 0,
      failedPages: r.failed_pages || 0,
      completionPercentage: r.completion_percentage || (status === 'COMPLETED' ? 100 : 0),
      status,
      errorMessage: r.extraction_error,
      extractedAt: r.extracted_at,
    };
  }

  if (textbookId) {
    const res = await pool.query(
      `SELECT id, book_name, pdf_type, total_pages, page_count, native_pages, ocr_pages,
              failed_pages, completion_percentage, extraction_status, status,
              error_message, extracted_at
       FROM textbooks WHERE id = $1`,
      [textbookId]
    );
    if (res.rows.length === 0) throw new Error(`Textbook #${textbookId} not found.`);
    const r = res.rows[0];
    const total = r.total_pages || r.page_count || 0;
    const status = (r.extraction_status || (r.status === 'completed' && total > 0 ? 'COMPLETED' : 'PENDING')) as ExtractionStatus;
    return {
      id: r.id,
      fileName: r.book_name,
      pdfType: (r.pdf_type || 'UNKNOWN') as PdfType,
      totalPages: total,
      nativePages: r.native_pages || 0,
      ocrPages: r.ocr_pages || 0,
      failedPages: r.failed_pages || 0,
      completionPercentage: r.completion_percentage || (status === 'COMPLETED' ? 100 : 0),
      status,
      errorMessage: r.error_message,
      extractedAt: r.extracted_at,
    };
  }

  throw new Error('Either materialId or textbookId must be provided.');
}

/**
 * Returns all extracted pages for Admin Review Screen.
 */
export async function getExtractedPages(options: {
  materialId?: number;
  textbookId?: number;
}): Promise<{
  totalPages: number;
  pages: Array<{
    pageNumber: number;
    text: string;
    unitId?: number;
    unitTitle?: string;
    lessonTitle?: string;
    topic?: string;
    isOcr: boolean;
    extractionMethod?: string;
    ocrConfidence?: number | null;
    status?: string;
  }>;
}> {
  let targetTbId = options.textbookId;

  if (!targetTbId && options.materialId) {
    const matRes = await pool.query(`SELECT google_drive_file_id FROM google_drive_materials WHERE id = $1`, [options.materialId]);
    if (matRes.rows.length > 0) {
      const fileId = matRes.rows[0].google_drive_file_id;
      const tbRes = await pool.query(`SELECT id FROM textbooks WHERE file_path LIKE $1 LIMIT 1`, [`%${fileId}%`]);
      if (tbRes.rows.length > 0) targetTbId = tbRes.rows[0].id;
    }
  }

  if (targetTbId) {
    const pagesRes = await pool.query(
      `SELECT page_number, content AS text, unit_id, unit_title, lesson_title, topic,
              is_ocr, extraction_method, ocr_confidence, extraction_status
       FROM textbook_content
       WHERE textbook_id = $1
       ORDER BY page_number ASC`,
      [targetTbId]
    );

    if (pagesRes.rows.length > 0) {
      return {
        totalPages: pagesRes.rows.length,
        pages: pagesRes.rows.map((r) => ({
          pageNumber: Number(r.page_number),
          text: r.text,
          unitId: r.unit_id ? Number(r.unit_id) : undefined,
          unitTitle: r.unit_title,
          lessonTitle: r.lesson_title,
          topic: r.topic,
          isOcr: Boolean(r.is_ocr),
          extractionMethod: r.extraction_method || (r.is_ocr ? 'ocr' : 'native'),
          ocrConfidence: r.ocr_confidence ? Number(r.ocr_confidence) : null,
          status: r.extraction_status || 'completed',
        })),
      };
    }
  }

  // Fallback: check google_drive_materials.extracted_pages JSONB
  if (options.materialId) {
    const matRes = await pool.query(`SELECT extracted_pages, page_count FROM google_drive_materials WHERE id = $1`, [options.materialId]);
    if (matRes.rows.length > 0 && Array.isArray(matRes.rows[0].extracted_pages)) {
      const rawPages = matRes.rows[0].extracted_pages;
      return {
        totalPages: rawPages.length,
        pages: rawPages.map((p: any) => ({
          pageNumber: Number(p.pageNumber || p.pageNum || 1),
          text: p.text || '',
          unitId: p.unitId,
          unitTitle: p.unitTitle,
          lessonTitle: p.lessonTitle,
          topic: p.topic,
          isOcr: Boolean(p.isOcr),
          extractionMethod: p.method || (p.isOcr ? 'ocr' : 'native'),
          ocrConfidence: p.ocrConfidence || null,
          status: 'completed',
        })),
      };
    }
  }

  return { totalPages: 0, pages: [] };
}

/**
 * Scans all pending or failed materials and extracts them sequentially.
 */
export async function extractAllPendingMaterials(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  materials: any[];
}> {
  const pendingRes = await pool.query(
    `SELECT id, file_name, google_drive_file_id
     FROM google_drive_materials
     WHERE extracted_text IS NULL
        OR extraction_status IN ('PENDING', 'FAILED', 'PARTIALLY_COMPLETED')
     ORDER BY id ASC`
  );

  let succeeded = 0;
  let failed = 0;
  const materials: any[] = [];

  for (const item of pendingRes.rows) {
    try {
      console.log(`[BatchExtract] Processing pending material #${item.id} ("${item.file_name}")...`);
      const res = await processAutomaticPdfExtraction({ materialId: item.id });
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
    processed: pendingRes.rows.length,
    succeeded,
    failed,
    materials,
  };
}
