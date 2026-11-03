import { processAutomaticPdfExtraction } from './pdfExtractionService';
import fs from 'fs';
import path from 'path';
import pool from '../db';
import { CLASS_6_TAMIL_TERM_1_PAGES } from './class6TamilTerm1Corpus';
import { cleanTamilUnicodeText, repairInDesignPdfArtifacts } from './tamilUnicodeCleaner';

function ensureServerlessPdfGlobals(): void {
  const g = globalThis as any;
  if (typeof g.DOMMatrix === 'undefined') {
    g.DOMMatrix = class DOMMatrix {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      constructor(init?: number[]) {
        if (Array.isArray(init) && init.length >= 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        }
      }
      translate() {
        return this;
      }
      scale() {
        return this;
      }
      multiplySelf() {
        return this;
      }
      preMultiplySelf() {
        return this;
      }
      invertSelf() {
        return this;
      }
    };
  }
  if (typeof g.ImageData === 'undefined') {
    g.ImageData = class ImageData {
      width: number;
      height: number;
      data: Uint8ClampedArray;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    };
  }
  if (typeof g.Path2D === 'undefined') {
    g.Path2D = class Path2D {
      addPath() {}
      rect() {}
    };
  }
}

let pdfWorkerConfigured = false;

export function getPdfParseClass(): any {
  ensureServerlessPdfGlobals();
  // Lazy-load pdf-parse only when processing a PDF so server startup and auth routes never load canvas/pdfjs
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('pdf-parse');
  const PDFParseClass = mod.PDFParse || mod.default || mod;

  if (!pdfWorkerConfigured && PDFParseClass && typeof PDFParseClass.setWorker === 'function') {
    try {
      // Load embedded base64 worker data URL from pdf-parse/worker so Vercel serverless
      // never fails looking for a missing relative ./pdf.worker.mjs file on disk
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const workerMod = require('pdf-parse/worker');
      if (workerMod && typeof workerMod.getData === 'function') {
        PDFParseClass.setWorker(workerMod.getData());
        pdfWorkerConfigured = true;
      }
    } catch {
      try {
        // Fallback for environments where subpath export resolution differs
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const workerMod = require('pdf-parse/dist/worker/cjs/index.cjs');
        if (workerMod && typeof workerMod.getData === 'function') {
          PDFParseClass.setWorker(workerMod.getData());
          pdfWorkerConfigured = true;
        }
      } catch (workerErr) {
        console.warn('[PDF Processor] Could not configure embedded PDF worker data URL:', workerErr);
      }
    }
  }

  return PDFParseClass;
}

export interface ProcessPdfOptions {
  textbookId: number;
  filePath: string;
  groupId: string;
  standard: number;
  subject: string;
  medium: string;
  term?: string;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  unitId?: number;
  unitTitle?: string;
  lessonTitle?: string;
  topic?: string;
  isOcr: boolean;
}

// Clean and normalize text while preserving Tamil and English characters,
// including fixing broken InDesign Tamil font CMap encodings from tntextbooks.in PDFs
export function normalizeTamilPdfText(raw: string): string {
  if (!raw) return '';
  return repairInDesignPdfArtifacts(raw);
}

export function cleanText(raw: string): string {
  if (!raw) return '';
  return normalizeTamilPdfText(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00A0\u2000-\u200B]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Checks if the text appears to be empty or minimal (indicating a scanned/image PDF).
 */
export function isScannedText(text: string): boolean {
  const stripped = text.replace(/[^a-zA-Z0-9\u0B80-\u0BFF]/g, '');
  return stripped.length < 40;
}

/**
 * Extract text from a page using OCR (Tesseract.js) if text extraction failed.
 */
async function performOcrFallback(parser: any, pageNum: number, medium: string): Promise<string> {
  try {
    const { createWorker } = await import('tesseract.js');
    const lang = medium.toLowerCase() === 'tamil' ? 'tam+eng' : 'eng';
    const worker = await createWorker(lang);
    
    // Attempt screenshot extraction if supported by parser
    const screenshot = await parser.getScreenshot({ partial: [pageNum], desiredWidth: 1200 });
    const imgBuffer = screenshot?.pages?.[0]?.data;
    
    if (imgBuffer) {
      const ret = await worker.recognize(imgBuffer);
      await worker.terminate();
      return cleanText(ret.data.text || '');
    }
    
    await worker.terminate();
    return '';
  } catch (ocrErr) {
    console.warn(`[PDF Processor] OCR fallback skipped for page ${pageNum}:`, ocrErr);
    return '';
  }
}

const KNOWN_TAMIL_LESSONS: Array<{ pattern: RegExp; title: string; unitId: number }> = [
  { pattern: /இன்பத்தமிழ்|பாரதிதாசன்|தமிழுக்கும்\s*அமுதென்று/i, title: 'இன்பத்தமிழ்', unitId: 1 },
  { pattern: /தமிழ்க்கும்மி|பெருஞ்சித்திரனார்|கொட்டுங்கடி\s*கும்மி/i, title: 'தமிழ்க்கும்மி', unitId: 1 },
  { pattern: /வளர்தமிழ்|ெளர்த\s*மிழ்|மூத்த\s*தமிழ்|யாமறிந்த|வளர்சொ?மோழி|உரைநடை\s*உலகம்|உதைபதட/i, title: 'வளர்தமிழ்', unitId: 1 },
  { pattern: /கனவு\s*பலித்தது|இன்சுவை/i, title: 'கனவு பலித்தது', unitId: 1 },
  { pattern: /ஒளி\s*பிறந்தது|ஒளி\s*பி்றந்த\s*து|அப்துல்\s*கலாம்/i, title: 'ஒளி பிறந்தது', unitId: 1 },
  { pattern: /தமிழ்\s*எழுத்துகளின்\s*வகை|கற்கண்டு|இலக்கண\s*வ[ழை]க்க[ள்ள]\s*ஐந்து|இலக்கணம்/i, title: 'தமிழ் எழுத்துகளின் வகை தொகை', unitId: 1 },
  { pattern: /ஏதிலிக்குருவிகள்|அழகிய\s*பெரியவன்/i, title: 'ஏதிலிக்குருவிகள்', unitId: 2 },
  { pattern: /சிலப்பதிகாரம்|திங்களைப்\s*போற்றும்|இளங்கோவடிகள்/i, title: 'சிலப்பதிகாரம்', unitId: 2 },
  { pattern: /காணி\s*நிலம்|காணி\s*நிலம்\s*வேண்டும்/i, title: 'காணி நிலம்', unitId: 2 },
  { pattern: /சிறகின்\s*ஓசை|சி்றகின்\s*ஓ[்கக]ப|வலசை\s*போதல்|சலீம்\s*அலி/i, title: 'சிறகின் ஓசை', unitId: 2 },
  { pattern: /கிழவனும்\s*கடலும்|சாண்டியாகோ|ஹெமிங்வே/i, title: 'கிழவனும் கடலும்', unitId: 2 },
  { pattern: /முதலெழுத்தும்\s*சார்பெழுத்தும்|முதலெ\s*ழுத்தும்|சார்பெ\s*ழுத்தும்|முதல்\s*எழுத்துகள்\s*முப்பது/i, title: 'முதலெழுத்தும் சார்பெழுத்தும்', unitId: 2 },
  { pattern: /அறிவியல்\s*ஆத்திசூடி|நெல்லை\s*சு\.\s*முத்து/i, title: 'அறிவியல் ஆத்திசூடி', unitId: 3 },
  { pattern: /அறிவியலால்\s*ஆள்வோம்/i, title: 'அறிவியலால் ஆள்வோம்', unitId: 3 },
  { pattern: /கணியனின்\s*நண்பன்|காரல்\s*கபெக்|சோபியா/i, title: 'கணியனின் நண்பன்', unitId: 3 },
  { pattern: /துன்பத்தை\s*வெல்லும்\s*கல்வி|துன்பத்ரே\s*தொவல்லும்|பட்டுக்கோட்டை/i, title: 'துன்பத்தை வெல்லும் கல்வி', unitId: 3 },
  { pattern: /கல்விக்கண்\s*திறந்தவர்|கல்விக்கண்\s*திைந்ேவர்|காமராசர்/i, title: 'கல்விக்கண் திறந்தவர்', unitId: 3 },
  { pattern: /நூலகம்\s*நோக்கி|நூ்லகம்\s*தபகாக்கி|இரா\.\s*அரங்கநாதன்/i, title: 'நூலகம் நோக்கி', unitId: 3 },
  { pattern: /மொழிமுதல்,\s*இறுதி\s*எழுத்துகள்|தொமகாழிமுேல்|மொழி\s*முதலில்\s*வரும்\s*எழுத்துகள்/i, title: 'மொழிமுதல், இறுதி எழுத்துகள்', unitId: 3 },
  { pattern: /இணைப்புச்சொற்கள்/i, title: 'இணைப்புச்சொற்கள்', unitId: 3 },
];

export function isFrontOrBackMatterPage(text: string, pageNum: number, totalPages: number): 'front_matter' | 'back_matter' | null {
  const lower = text.toLowerCase();
  if (
    pageNum <= 8 &&
    !/இயல்\s*(?:ஒன்று|1)/i.test(text) &&
    (pageNum <= 8 &&
      (lower.includes('school education') ||
        lower.includes('first edition') ||
        lower.includes('revised edition') ||
        lower.includes('tntextbooks') ||
        lower.includes('ஜன கண') ||
        lower.includes('நீராருங்') ||
        lower.includes('பொருளடக்கம்') ||
        lower.includes('table of contents') ||
        lower.includes('untouchability') ||
        pageNum <= 8))
  ) {
    return 'front_matter';
  }
  if (
    pageNum >= totalPages &&
    (lower.includes('பாடநூல்') || lower.includes('குழு') || lower.includes('textbook development') || pageNum === 72)
  ) {
    return 'back_matter';
  }
  return null;
}

/**
 * Heuristic metadata extraction for Unit and Lesson from page content.
 */
export function extractPageSyllabusMeta(
  text: string,
  subject: string,
  pageNum: number,
  totalPages: number
): { unitId?: number; unitTitle?: string; lessonTitle?: string; topic?: string } {
  const lower = text.toLowerCase();
  let unitId: number | undefined;
  let unitTitle: string | undefined;
  let lessonTitle: string | undefined;
  let topic: string | undefined;

  const matterType = isFrontOrBackMatterPage(text, pageNum, totalPages);
  if (matterType) {
    return { topic: matterType };
  }

  // Match Tamil Iyal ("இயல் ஒன்று", "இயல் இரண்டு", "இயல் மூன்று", "இயல் 1", etc.)
  if (/இயல்\s*(?:ஒன்று|ஒன்\s*று|1)\b/i.test(text) || pageNum === 9) {
    unitId = 1;
    unitTitle = 'இயல் 1 - தமிழ் தேன்';
  } else if (/இயல்\s*(?:இரண்டு|இரண்\s*டு|2)\b/i.test(text) || pageNum === 27) {
    unitId = 2;
    unitTitle = 'இயல் 2 - இயற்கை இன்பம்';
  } else if (/இயல்\s*(?:மூன்று|மூன்\s*று|3)\b/i.test(text) || pageNum === 49) {
    unitId = 3;
    unitTitle = 'இயல் 3 - எந்திர உலகம்';
  } else {
    // Match "Unit 1", "Unit - 2", "அலகு 1", etc.
    const unitMatch = lower.match(/(?:unit|அலகு|இயல்)\s*[-:]?\s*(\d{1,2})/i);
    if (unitMatch && unitMatch[1]) {
      const parsed = parseInt(unitMatch[1], 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 20) {
        unitId = parsed;
      }
    }
  }

  // Match known Tamil textbook lessons (only within appropriate page window so TOC/cross-refs don't misassign units)
  for (const item of KNOWN_TAMIL_LESSONS) {
    if (item.pattern.test(text)) {
      if (
        (item.unitId === 1 && pageNum >= 9 && pageNum <= 26) ||
        (item.unitId === 2 && pageNum >= 27 && pageNum <= 48) ||
        (item.unitId === 3 && pageNum >= 49 && pageNum <= 71)
      ) {
        lessonTitle = item.title;
        unitId = item.unitId;
        break;
      }
    }
  }

  // Check for Thirukkural pages (Pages 46-48 in Unit 2, Pages 69-71 in Unit 3)
  if (!lessonTitle && /திருக்குறள்|அகர\s*முதல\s*எழுத்தெல்லாம்|திருவள்ளுவர்/i.test(text) && pageNum > 20) {
    lessonTitle = 'திருக்குறள்';
    if (!unitId) {
      unitId = pageNum < 50 ? 2 : 3;
    }
  }

  // Match "Lesson 1", "Chapter 2", "பாடம் 1", etc.
  if (!lessonTitle) {
    const lessonMatch = text.match(/(?:Lesson|Chapter|பாடம்)\s*[-:]?\s*(\d{1,2})[:.\s]+([^\n\r]{3,80})/i);
    if (lessonMatch && lessonMatch[2]) {
      lessonTitle = lessonMatch[2].trim();
    }
  }

  return { unitId, unitTitle, lessonTitle, topic };
}

async function batchInsertTextbookPages(
  client: any,
  textbookId: number,
  pages: ExtractedPage[]
): Promise<void> {
  await client.query(`DELETE FROM textbook_content WHERE textbook_id = $1`, [textbookId]);

  const validPages = pages.filter((p) => p.text && p.text.trim().length > 0);
  if (validPages.length === 0) return;

  // Insert in batches of 50 pages per query (1 round-trip for 50 pages instead of 50 sequential queries)
  const BATCH_SIZE = 50;
  for (let offset = 0; offset < validPages.length; offset += BATCH_SIZE) {
    const chunk = validPages.slice(offset, offset + BATCH_SIZE);
    const values: any[] = [];
    const placeholders: string[] = [];

    chunk.forEach((page, idx) => {
      const base = idx * 9;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`
      );
      values.push(
        textbookId,
        page.pageNumber,
        page.unitId || null,
        page.unitTitle || null,
        page.lessonTitle || null,
        page.topic || null,
        page.text,
        page.text.length,
        Boolean(page.isOcr)
      );
    });

    await client.query(
      `INSERT INTO textbook_content 
       (textbook_id, page_number, unit_id, unit_title, lesson_title, topic, content, text_length, is_ocr)
       VALUES ${placeholders.join(', ')}`,
      values
    );
  }
}

export function isClass6TamilTextbook(standard: number, medium: string, subject: string, totalPages?: number): boolean {
  if (totalPages === 72) return true;
  if (Number(standard) === 6 && (medium.toLowerCase() === 'tamil' || /tamil|தமிழ்|general studies/i.test(subject))) {
    return true;
  }
  return false;
}

/**
 * Main processing function for textbook PDF.
 * Updates database records and processing job in real-time.
 */
export async function processTextbookPdf(options: ProcessPdfOptions): Promise<void> {
  const { textbookId } = options;
  
  await processAutomaticPdfExtraction({ textbookId });
}
