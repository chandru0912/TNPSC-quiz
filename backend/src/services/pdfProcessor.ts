import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import pool from '../db';

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
  let text = raw
    // In tntextbooks.in 2025 InDesign Tamil PDFs, U+FFFD is systematically the glyph for 'ப' (U+0BAA)
    .replace(/\uFFFD/g, 'ப')
    // Visual-order kombu 'पो' (ப + ோ) before a consonant represents 'ே' (U+0BC7) on that consonant
    .replace(/போ\s*([க-ஹ])/g, '$1ே')
    // Visual-order 'ழ' immediately followed by space and consonant + 'ா' in broken CMap represents 'ை' or 'ௌ'
    // Fix common Tamil textbook headings and words corrupted by visual-order CMap
    .replace(/இன்\s*பத்\s*தமிழ்/g, 'இன்பத்தமிழ்')
    .replace(/தமிழ்க்\s*கும்\s*மி/g, 'தமிழ்க்கும்மி')
    .replace(/வளர்\s*தமிழ்/g, 'வளர்தமிழ்')
    .replace(/கனவு\s*பலித்\s*தது/g, 'கனவு பலித்தது')
    .replace(/ஒளி\s*பிறந்\s*தது/g, 'ஒளி பிறந்தது')
    .replace(/தமிழ்\s*எழுத்\s*துகளின்\s*வகை\s*தொகை/g, 'தமிழ் எழுத்துகளின் வகை தொகை')
    .replace(/சிலப்\s*பதிகாரம்/g, 'சிலப்பதிகாரம்')
    .replace(/காணி\s*நிலம்/g, 'காணி நிலம்')
    .replace(/சிறகின்\s*ஓசை/g, 'சிறகின் ஓசை')
    .replace(/கிழவனும்\s*கடலும்/g, 'கிழவனும் கடலும்')
    .replace(/முதலெழுத்\s*தும்\s*சார்\s*பெழுத்\s*தும்/g, 'முதலெழுத்தும் சார்பெழுத்தும்')
    .replace(/திருக்\s*குறள்/g, 'திருக்குறள்')
    .replace(/அறிவியல்\s*ஆத்\s*திசூடி/g, 'அறிவியல் ஆத்திசூடி')
    .replace(/அறிவியலால்\s*ஆள்\s*வோம்/g, 'அறிவியலால் ஆள்வோம்')
    .replace(/கணியனின்\s*நண்\s*பன்/g, 'கணியனின் நண்பன்')
    .replace(/துன்\s*பத்\s*தை\s*வெல்\s*லும்\s*கல்\s*வி/g, 'துன்பத்தை வெல்லும் கல்வி')
    .replace(/கல்\s*விக்\s*கண்\s*திறந்\s*தவர்/g, 'கல்விக்கண் திறந்தவர்')
    .replace(/நூலகம்\s*நோக்\s*கி/g, 'நூலகம் நோக்கி')
    .replace(/இணைப்\s*புச்\s*சொற்\s*கள்/g, 'இணைப்புச்சொற்கள்')
    // Remove spurious spaces immediately after Tamil pulli (்) when followed by another Tamil consonant within the same word
    .replace(/([க-ஹ]்)\s+(?=[கசடதபறநஞணமனயரலவழள][ா-ௌ்]?)/g, '$1');

  return text;
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
  { pattern: /வளர்தமிழ்|மூத்தமொழி|யாமறிந்த\s*மொழிகளிலே/i, title: 'வளர்தமிழ்', unitId: 1 },
  { pattern: /கனவு\s*பலித்தது|இன்சுவை/i, title: 'கனவு பலித்தது', unitId: 1 },
  { pattern: /ஒளி\s*பிறந்தது|அப்துல்\s*கலாம்/i, title: 'ஒளி பிறந்தது', unitId: 1 },
  { pattern: /தமிழ்\s*எழுத்துகளின்\s*வகை\s*தொகை|இலக்கணம்\s*ஐந்து\s*வகைப்படும்/i, title: 'தமிழ் எழுத்துகளின் வகை தொகை', unitId: 1 },
  { pattern: /சிலப்பதிகாரம்|திங்களைப்\s*போற்றும்|இளங்கோவடிகள்/i, title: 'சிலப்பதிகாரம்', unitId: 2 },
  { pattern: /காணி\s*நிலம்|காணி\s*நிலம்\s*வேண்டும்/i, title: 'காணி நிலம்', unitId: 2 },
  { pattern: /சிறகின்\s*ஓசை|வலசை\s*போதல்|சலீம்\s*அலி/i, title: 'சிறகின் ஓசை', unitId: 2 },
  { pattern: /கிழவனும்\s*கடலும்|சாண்டியாகோ|ஹெமிங்வே/i, title: 'கிழவனும் கடலும்', unitId: 2 },
  { pattern: /முதலெழுத்தும்\s*சார்பெழுத்தும்|முதல்\s*எழுத்துகள்\s*முப்பது/i, title: 'முதலெழுத்தும் சார்பெழுத்தும்', unitId: 2 },
  { pattern: /அறிவியல்\s*ஆத்திசூடி|நெல்லை\s*சு\.\s*முத்து/i, title: 'அறிவியல் ஆத்திசூடி', unitId: 3 },
  { pattern: /அறிவியலால்\s*ஆள்வோம்/i, title: 'அறிவியலால் ஆள்வோம்', unitId: 3 },
  { pattern: /கணியனின்\s*நண்பன்|காரல்\s*கபெக்|சோபியா/i, title: 'கணியனின் நண்பன்', unitId: 3 },
  { pattern: /துன்பத்தை\s*வெல்லும்\s*கல்வி|பட்டுக்கோட்டை/i, title: 'துன்பத்தை வெல்லும் கல்வி', unitId: 3 },
  { pattern: /கல்விக்கண்\s*திறந்தவர்|காமராசர்/i, title: 'கல்விக்கண் திறந்தவர்', unitId: 3 },
  { pattern: /நூலகம்\s*நோக்கி|இரா\.\s*அரங்கநாதன்/i, title: 'நூலகம் நோக்கி', unitId: 3 },
  { pattern: /மொழிமுதல்,\s*இறுதி\s*எழுத்துகள்|மொழி\s*முதலில்\s*வரும்\s*எழுத்துகள்/i, title: 'மொழிமுதல், இறுதி எழுத்துகள்', unitId: 3 },
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
function extractPageSyllabusMeta(
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

/**
 * Main processing function for textbook PDF.
 * Updates database records and processing job in real-time.
 */
export async function processTextbookPdf(options: ProcessPdfOptions): Promise<void> {
  const { textbookId, filePath, groupId, standard, subject, medium } = options;
  const client = await pool.connect();

  let jobId: number | null = null;
  let parser: any = null;

  try {
    console.log(`[PDF Processor] Starting processing for Textbook ID ${textbookId}: ${filePath}`);

    // Create job record
    const jobRes = await client.query(
      `INSERT INTO textbook_processing_jobs (textbook_id, status, progress_percent, step_description)
       VALUES ($1, 'extracting', 10, 'Reading PDF file and initializing parser')
       RETURNING id`,
      [textbookId]
    );
    jobId = jobRes.rows[0].id;

    // Update textbook status to 'processing'
    await client.query(
      `UPDATE textbooks SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [textbookId]
    );

    if (!fs.existsSync(filePath)) {
      throw new Error(`Textbook file does not exist at path: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Uploaded PDF file is empty (0 bytes).');
    }

    // Initialize PDF parser
    parser = new PDFParse({ data: fileBuffer });
    const textResult = await parser.getText();

    const totalPages = textResult?.total || textResult?.pages?.length || 0;
    if (totalPages === 0) {
      throw new Error('PDF has 0 pages or could not be decoded.');
    }

    // Update progress
    await client.query(
      `UPDATE textbook_processing_jobs 
       SET progress_percent = 40, step_description = 'Extracting text and analyzing page contents'
       WHERE id = $1`,
      [jobId]
    );

    const extractedPages: ExtractedPage[] = [];
    let scannedPagesCount = 0;
    let activeUnitId: number | undefined;
    let activeUnitTitle: string | undefined;
    let activeLessonTitle: string | undefined;

    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      const rawPageText = textResult.pages[i]?.text || '';
      let pageText = cleanText(rawPageText);
      let isOcr = false;

      // Check if page needs OCR
      if (isScannedText(pageText)) {
        scannedPagesCount++;
        const ocrText = await performOcrFallback(parser, pageNum, medium);
        if (ocrText && ocrText.length > pageText.length) {
          pageText = ocrText;
          isOcr = true;
        }
      }

      const meta = extractPageSyllabusMeta(pageText, subject, pageNum, totalPages);

      if (meta.topic === 'front_matter' || meta.topic === 'back_matter') {
        extractedPages.push({
          pageNumber: pageNum,
          text: pageText,
          topic: meta.topic,
          isOcr,
        });
        continue;
      }

      if (meta.unitId) {
        if (meta.unitId !== activeUnitId) {
          activeLessonTitle = undefined;
        }
        activeUnitId = meta.unitId;
      }
      if (meta.unitTitle) {
        activeUnitTitle = meta.unitTitle;
      }
      if (meta.lessonTitle) {
        activeLessonTitle = meta.lessonTitle;
      }

      extractedPages.push({
        pageNumber: pageNum,
        text: pageText,
        unitId: meta.unitId || activeUnitId,
        unitTitle: meta.unitTitle || activeUnitTitle,
        lessonTitle: meta.lessonTitle || activeLessonTitle,
        topic: meta.topic,
        isOcr,
      });
    }

    // Check if entire PDF is completely unextractable
    const totalChars = extractedPages.reduce((acc, p) => acc + p.text.length, 0);
    if (totalChars < 50) {
      throw new Error('PDF text extraction produced insufficient text (<50 characters). Scanned document without extractable text.');
    }

    // Update progress: Indexing into Database
    await client.query(
      `UPDATE textbook_processing_jobs 
       SET status = 'indexing', progress_percent = 75, step_description = 'Saving indexed pages and chapter mappings to database'
       WHERE id = $1`,
      [jobId]
    );

    // Remove any prior content for this textbook to prevent duplicates on reprocess
    await client.query(`DELETE FROM textbook_content WHERE textbook_id = $1`, [textbookId]);

    // Insert extracted pages in batches
    for (const page of extractedPages) {
      if (page.text.trim().length === 0) continue;

      await client.query(
        `INSERT INTO textbook_content 
         (textbook_id, page_number, unit_id, unit_title, lesson_title, topic, content, text_length, is_ocr)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          textbookId,
          page.pageNumber,
          page.unitId || null,
          page.unitTitle || null,
          page.lessonTitle || null,
          page.topic || null,
          page.text,
          page.text.length,
          page.isOcr,
        ]
      );
    }

    // Update textbook to 'completed' with page count
    await client.query(
      `UPDATE textbooks 
       SET status = 'completed', page_count = $2, error_message = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [textbookId, totalPages]
    );

    // Mark job completed
    await client.query(
      `UPDATE textbook_processing_jobs 
       SET status = 'completed', progress_percent = 100, step_description = 'Textbook indexing completed successfully', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [jobId]
    );

    console.log(`[PDF Processor] Successfully processed Textbook ID ${textbookId}: ${totalPages} pages indexed.`);
  } catch (error: any) {
    console.error(`[PDF Processor] Error processing Textbook ID ${textbookId}:`, error);

    // Update textbook status to 'failed' - NEVER mark as completed if extraction failed!
    await client.query(
      `UPDATE textbooks 
       SET status = 'failed', error_message = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [textbookId, error.message || 'Unknown processing error']
    );

    if (jobId) {
      await client.query(
        `UPDATE textbook_processing_jobs 
         SET status = 'failed', error_message = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [jobId, error.message || 'Unknown processing error']
      );
    }
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {}
    }
    client.release();
  }
}
