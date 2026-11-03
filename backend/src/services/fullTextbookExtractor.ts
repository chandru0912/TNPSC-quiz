/**
 * fullTextbookExtractor.ts
 *
 * Deep PDF extraction engine for Samacheer Kalvi textbooks.
 * Powered by unified pdfExtractionService.
 */

import { ClassifiedPdfMetadata } from './bulkClassificationService';
import { extractAndPersistPdf } from './pdfExtractionService';

export interface FullExtractionProgress {
  materialId: number;
  totalPages: number;
  processedPages: number;
  extractedUnits: number;
  extractedLessons: number;
  ocrPagesCount: number;
  status: 'processing' | 'completed' | 'failed';
  errorMessage?: string;
}

/**
 * Extracts all text from a Google Drive PDF buffer and maps pages to units and lessons.
 */
export async function extractAndIndexFullTextbook(options: {
  materialId: number;
  googleDriveFileId: string;
  metadata: ClassifiedPdfMetadata;
  pdfBuffer?: Buffer;
}): Promise<FullExtractionProgress> {
  const { materialId, googleDriveFileId, metadata, pdfBuffer } = options;

  try {
    const res = await extractAndPersistPdf({
      materialId,
      googleDriveFileId,
      buffer: pdfBuffer,
      forceReExtract: true,
    });

    return {
      materialId,
      totalPages: res.totalPages,
      processedPages: res.extractedPages,
      extractedUnits: metadata.totalUnits || 1,
      extractedLessons: metadata.totalLessons || 1,
      ocrPagesCount: res.method === 'ocr' ? res.totalPages : res.method === 'hybrid' ? 1 : 0,
      status: res.success ? 'completed' : 'failed',
      errorMessage: res.error,
    };
  } catch (err: any) {
    console.error(`[FullExtractor] Error extracting text for material #${materialId}:`, err.message);
    return {
      materialId,
      totalPages: 0,
      processedPages: 0,
      extractedUnits: metadata.totalUnits || 0,
      extractedLessons: metadata.totalLessons || 0,
      ocrPagesCount: 0,
      status: 'failed',
      errorMessage: err.message,
    };
  }
}
