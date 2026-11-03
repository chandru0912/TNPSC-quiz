/**
 * OCR Service for TNPSC Study Hub
 * Multi-tiered OCR supporting Tamil (ta) and English (en) documents.
 * 
 * Hierarchy:
 * 1. Google Cloud Vision OCR (DOCUMENT_TEXT_DETECTION, ta/en)
 * 2. Claude AI Vision OCR (Anthropic Claude 3.5 Sonnet)
 * 3. Tesseract.js (tam+eng local fallback)
 * 4. Samacheer Kalvi verified corpus fallback (for Class 6 Tamil standard textbooks)
 */

import { ImageAnnotatorClient } from '@google-cloud/vision';
import { Storage } from '@google-cloud/storage';
import Anthropic from '@anthropic-ai/sdk';
import { cleanTamilUnicodeText, repairInDesignPdfArtifacts } from './tamilUnicodeCleaner';
import { CLASS_6_TAMIL_TERM_1_PAGES } from './class6TamilTerm1Corpus';

export interface OcrResult {
  text: string;
  confidence: number;
  method: 'ocr_vision' | 'ocr_claude' | 'ocr_tesseract' | 'corpus';
  error?: string;
}

let visionClientInstance: ImageAnnotatorClient | null = null;
let visionClientInitialized = false;

/**
 * Initializes Google Cloud Vision client securely from environment variables.
 * Supports service account file path, service account JSON string, or default auth.
 */
function getGoogleVisionClient(): ImageAnnotatorClient | null {
  if (visionClientInitialized) return visionClientInstance;
  visionClientInitialized = true;

  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      visionClientInstance = new ImageAnnotatorClient();
      console.log('[OCR Service] Google Cloud Vision initialized via GOOGLE_APPLICATION_CREDENTIALS.');
      return visionClientInstance;
    }

    if (process.env.GOOGLE_VISION_SERVICE_ACCOUNT_KEY) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_VISION_SERVICE_ACCOUNT_KEY);
        visionClientInstance = new ImageAnnotatorClient({ credentials });
        console.log('[OCR Service] Google Cloud Vision initialized via GOOGLE_VISION_SERVICE_ACCOUNT_KEY.');
        return visionClientInstance;
      } catch (parseErr) {
        console.warn('[OCR Service] Failed to parse GOOGLE_VISION_SERVICE_ACCOUNT_KEY JSON:', parseErr);
      }
    }

    if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      visionClientInstance = new ImageAnnotatorClient({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
      });
      console.log('[OCR Service] Google Cloud Vision initialized via client email & private key.');
      return visionClientInstance;
    }

    // Try default application credentials if running on GCP / Cloud Run
    if (process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT) {
      visionClientInstance = new ImageAnnotatorClient();
      return visionClientInstance;
    }
  } catch (err: any) {
    console.warn('[OCR Service] Google Cloud Vision client initialization notice:', err.message);
  }

  return null;
}

/**
 * Performs Google Cloud Vision DOCUMENT_TEXT_DETECTION on a PDF file buffer for specified pages.
 * Uses files:annotate for up to 5 pages per request.
 */
export async function runGoogleCloudVisionPdfOcr(
  pdfBuffer: Buffer,
  pageNumbers: number[]
): Promise<Map<number, { text: string; confidence: number }>> {
  const resultMap = new Map<number, { text: string; confidence: number }>();
  const client = getGoogleVisionClient();
  if (!client) return resultMap;

  try {
    // Process in chunks of up to 5 pages (Google Cloud Vision files:annotate synchronous limit)
    const CHUNK_SIZE = 5;
    for (let i = 0; i < pageNumbers.length; i += CHUNK_SIZE) {
      const pageChunk = pageNumbers.slice(i, i + CHUNK_SIZE);
      const request = {
        inputConfig: {
          content: pdfBuffer,
          mimeType: 'application/pdf',
        },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' as const }],
        pages: pageChunk,
        imageContext: {
          languageHints: ['ta', 'en'],
        },
      };

      const [response] = await client.batchAnnotateFiles({
        requests: [request],
      });

      const fileResponses = response.responses?.[0]?.responses || [];
      fileResponses.forEach((pageRes, idx) => {
        const actualPageNum = pageChunk[idx];
        const fullText = pageRes.fullTextAnnotation?.text || '';
        
        // Calculate average confidence from pages/blocks if present
        let totalConfidence = 0;
        let count = 0;
        const pagesList = pageRes.fullTextAnnotation?.pages || [];
        for (const p of pagesList) {
          if (p.confidence) {
            totalConfidence += p.confidence * 100;
            count++;
          }
          for (const block of p.blocks || []) {
            if (block.confidence) {
              totalConfidence += block.confidence * 100;
              count++;
            }
          }
        }
        const avgConfidence = count > 0 ? Math.round(totalConfidence / count) : 95;

        if (fullText && fullText.trim().length > 0) {
          resultMap.set(actualPageNum, {
            text: repairInDesignPdfArtifacts(cleanTamilUnicodeText(fullText.trim())),
            confidence: avgConfidence,
          });
        }
      });
    }
  } catch (visionErr: any) {
    console.warn('[OCR Service] Google Cloud Vision PDF annotation error:', visionErr.message);
  }

  return resultMap;
}

/**
 * Performs Google Cloud Vision DOCUMENT_TEXT_DETECTION on a raw image buffer (PNG/JPEG).
 */
export async function runGoogleCloudVisionImageOcr(
  imageBuffer: Buffer
): Promise<OcrResult | null> {
  const client = getGoogleVisionClient();
  if (!client) return null;

  try {
    const [result] = await client.documentTextDetection({
      image: { content: imageBuffer },
      imageContext: { languageHints: ['ta', 'en'] },
    });

    const fullText = result.fullTextAnnotation?.text || '';
    if (!fullText || fullText.trim().length === 0) return null;

    let totalConfidence = 0;
    let count = 0;
    for (const p of result.fullTextAnnotation?.pages || []) {
      if (p.confidence) {
        totalConfidence += p.confidence * 100;
        count++;
      }
    }
    const avgConfidence = count > 0 ? Math.round(totalConfidence / count) : 95;

    return {
      text: repairInDesignPdfArtifacts(cleanTamilUnicodeText(fullText.trim())),
      confidence: avgConfidence,
      method: 'ocr_vision',
    };
  } catch (err: any) {
    console.warn('[OCR Service] Google Cloud Vision image annotation error:', err.message);
    return null;
  }
}

/**
 * Performs OCR using Claude AI Vision via Anthropic Messages API.
 * High-accuracy transcription for Tamil and English complex layouts.
 */
export async function runClaudeVisionOcr(
  imageBuffer: Buffer,
  medium: string = 'Tamil'
): Promise<OcrResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const anthropic = new Anthropic({ apiKey });
    const base64Data = imageBuffer.toString('base64');
    const prompt = medium.toLowerCase() === 'tamil'
      ? `Transcribe the exact text from this Tamil textbook page. Preserve all Tamil Unicode characters, headings, paragraphs, and Tamil numerals faithfully. Output only the transcribed text without extra conversational commentary.`
      : `Transcribe the exact text from this textbook page. Preserve all headings, lists, tables, and paragraphs. Output only the transcribed text without extra commentary.`;

    const response = await (anthropic.messages.create as any)({
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const textPart = response.content.find((c: any) => c.type === 'text') as { text: string } | undefined;
    const text = textPart?.text ? repairInDesignPdfArtifacts(cleanTamilUnicodeText(textPart.text.trim())) : '';

    if (text.length >= 20) {
      return {
        text,
        confidence: 96,
        method: 'ocr_claude',
      };
    }
  } catch (claudeErr: any) {
    console.warn('[OCR Service] Claude Vision OCR notice:', claudeErr.message);
  }

  return null;
}

/**
 * Performs local OCR using Tesseract.js (tam+eng).
 */
export async function runTesseractOcr(
  imageBuffer: Buffer,
  medium: string = 'Tamil'
): Promise<OcrResult | null> {
  try {
    const { createWorker } = await import('tesseract.js');
    const lang = medium.toLowerCase() === 'tamil' ? 'tam+eng' : 'eng';
    const worker = await createWorker(lang);
    const ret = await worker.recognize(imageBuffer);
    await worker.terminate();

    const text = repairInDesignPdfArtifacts(cleanTamilUnicodeText(ret.data.text || '')).trim();
    const confidence = Math.round(ret.data.confidence || 75);

    if (text.length >= 20) {
      return {
        text,
        confidence,
        method: 'ocr_tesseract',
      };
    }
  } catch (tessErr: any) {
    console.warn('[OCR Service] Tesseract OCR notice:', tessErr.message);
  }

  return null;
}

/**
 * Unified OCR Dispatcher for a single page.
 * Evaluates available OCR providers in priority order.
 */
export async function extractOcrForPage(options: {
  pdfBuffer?: Buffer;
  imageBuffer?: Buffer | null;
  pageNumber: number;
  standard?: number;
  medium?: string;
  subject?: string;
  totalPages?: number;
}): Promise<OcrResult> {
  const { pdfBuffer, imageBuffer, pageNumber, standard = 6, medium = 'Tamil', subject = 'General Studies', totalPages } = options;

  // 1. Try Google Cloud Vision PDF batch OCR if pdfBuffer is available
  if (pdfBuffer && pdfBuffer.length > 0) {
    const visionPdfResults = await runGoogleCloudVisionPdfOcr(pdfBuffer, [pageNumber]);
    const visionPage = visionPdfResults.get(pageNumber);
    if (visionPage && visionPage.text.length >= 30) {
      return {
        text: visionPage.text,
        confidence: visionPage.confidence,
        method: 'ocr_vision',
      };
    }
  }

  // 2. Try Google Cloud Vision on image buffer if provided
  if (imageBuffer && imageBuffer.length > 0) {
    const visionImg = await runGoogleCloudVisionImageOcr(imageBuffer);
    if (visionImg && visionImg.text.length >= 30) {
      return visionImg;
    }

    // 3. Try Claude Vision OCR
    const claudeRes = await runClaudeVisionOcr(imageBuffer, medium);
    if (claudeRes && claudeRes.text.length >= 30) {
      return claudeRes;
    }

    // 4. Try Tesseract.js OCR
    const tessRes = await runTesseractOcr(imageBuffer, medium);
    if (tessRes && tessRes.text.length >= 30) {
      return tessRes;
    }
  }

  // 5. Fallback: Check verified Samacheer Kalvi Class 6 Tamil Term 1 corpus
  const isClass6Tamil = Number(standard) === 6 && (medium.toLowerCase() === 'tamil' || /tamil|தமிழ்/i.test(subject));
  if (isClass6Tamil && CLASS_6_TAMIL_TERM_1_PAGES.length > 0) {
    const corpusItem = CLASS_6_TAMIL_TERM_1_PAGES.find((p) => p.pageNumber === pageNumber);
    if (corpusItem && corpusItem.text && corpusItem.text.trim().length >= 20) {
      return {
        text: repairInDesignPdfArtifacts(cleanTamilUnicodeText(corpusItem.text.trim())),
        confidence: 99,
        method: 'corpus',
      };
    }
  }

  return {
    text: '',
    confidence: 0,
    method: 'ocr_vision',
    error: `OCR could not extract legible text for page ${pageNumber}.`,
  };
}
