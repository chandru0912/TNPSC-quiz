import pool from '../db';
import { retrieveRelevantTextbookContent, TextbookRetrievalResult } from './textbookRag';
import { normalizeTamilPdfText } from './pdfProcessor';

export interface GenerateNotesRequestParams {
  category: string;
  subject: string;
  classId: number | null;
  unitId: number;
  lessonTitle: string;
  topic?: string;
  language: 'tamil' | 'english';
  apiKey?: string;
  textbookMode?: 'auto' | 'specific' | 'upload';
  textbookId?: number;
  term?: string;
  scope?: 'chapter' | 'full_book';
}

export interface GeneratedNotesResult {
  title: string;
  content: string;
  source: 'gemini' | 'textbook_rag';
  modelUsed: string;
  textbookUsed: {
    id: number | null;
    name: string;
    pages: number[];
  };
  sourceReference: string;
  detectedChaptersCount?: number;
}

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
];

/**
 * Builds the authoritative TNPSC One-Liner Notes prompt.
 * Strictly adheres to official Samacheer Kalvi textbook facts with no external hallucination.
 */
function buildOneLinerPrompt(params: {
  chapterTitle: string;
  chapterNumber: number | string;
  bookName: string;
  pages: number[];
  category: string;
  subject: string;
  classId: number | null;
  lang: 'tamil' | 'english';
  passagesText: string;
}): string {
  const isTamil = params.lang === 'tamil';

  if (isTamil) {
    return `நீங்கள் ஒரு தமிழ்நாடு அரசுப் பணியாளர் தேர்வாணையம் (TNPSC) மற்றும் சமச்சீர் கல்வி பாடநூல் சார்ந்த முதன்மை தேர்வுப் பொருள் தயாரிப்பாளர் (Senior TNPSC Subject Matter Expert).

கீழே கொடுக்கப்பட்டுள்ள அதிகாரப்பூர்வ தமிழ்நாடு அரசுப் பள்ளிப் பாடநூல் (Samacheer Kalvi) பக்கங்களை முழுமையாக ஆய்வு செய்து, தேர்வர்கள் எளிதில் நினைவில் வைத்துக்கொள்ளும் வகையில் உயர்தர TNPSC ஒருவரி குறிப்புகளை (TNPSC One-Liner Coaching Notes) தயார் செய்யவும்.

பாடநூல் குறிப்பு (Textbook Reference):
- பாடநூல்: ${params.bookName}
- பக்கங்கள்: ${params.pages.join(', ')}
- இலக்குத் தேர்வு: ${params.category.toUpperCase()}
- பாடம்: ${params.subject}
- வகுப்பு: ${params.classId ? params.classId + 'ஆம் வகுப்பு' : 'பொருத்தமான வகுப்பு'}
- அலகு / இயல் / பாடம்: ${params.chapterNumber} - "${params.chapterTitle}"
- மொழி: தமிழ் (தூய தமிழ் யுனிகோட்)

அதிகாரப்பூர்வ பாடநூல் பகுதிகள் (AUTHORITATIVE TEXTBOOK PASSAGES):
"""
${params.passagesText}
"""

கட்டாய விதிகள் (MANDATORY RULES):
1. பாடநூலில் உள்ள தகவல்கள் மட்டுமே உண்மை ஆதாரம். சொந்தக் கற்பனையிலோ அல்லது பொது அறிவிலோ இருந்து தகவல்களை சேர்க்கக் கூடாது.
2. பெயர்கள், ஆண்டுகள், நூல்கள், ஆசிரியர்கள், இடங்கள், எண்கள், வரையறைகள் பாடநூலில் உள்ளவாறே பிழையின்றி இருக்க வேண்டும்.
3. ஒவ்வொரு குறிப்பிலும் அடைப்புக்குறிக்குள் [பக்க எண்: X] என பாடநூல் பக்க எண்ணைக் குறிப்பிடவும்.
4. அனைத்து தலைப்புகளும், அட்டவணைகளும் முழுமையாக இருக்க வேண்டும்.

வெளியீட்டு கட்டமைப்பு (OUTPUT STRUCTURE):
# ${params.chapterNumber}. ${params.chapterTitle}
> **பாடநூல் ஆதாரம்**: ${params.bookName} (பக்கங்கள்: ${params.pages.join(', ')})

## 1. முக்கிய ஒருவரி குறிப்புகள் (Important One-Liner Notes)
(பாடநூலில் உள்ள அனைத்து முக்கிய பத்திகளையும் எளிதில் மனனம் செய்யக்கூடிய நேரடி உண்மைகளாக வரிசை எண் இட்டு எழுதவும். குறைந்தது 15-25 முக்கியமான ஒருவரி குறிப்புகள்)
1. [நேரடி தேர்வு உண்மை 1] - [பக்கம்: X]
2. [நேரடி தேர்வு உண்மை 2] - [பக்கம்: X]
3. [நேரடி தேர்வு உண்மை 3] - [பக்கம்: X]

## 2. ஆசிரியர் & இலக்கியக் குறிப்புகள் / முக்கிய ஆளுமைகள் (Author & Literary Works)
(ஆசிரியர் பெயர், இயற்பெயர், சிறப்புப் பெயர், பட்டங்கள், இயற்றிய நூல்கள், காலம் ஆகியவற்றை தெளிவான Markdown அட்டவணையாகத் தரவும்)
| ஆளுமை / ஆசிரியர் பெயர் | இயற்பெயர் / புனைப்பெயர் | சிறப்புப் பட்டங்கள் | முக்கிய நூல்கள் / படைப்புகள் | முக்கிய தேர்வுத் தகவல்கள் |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

## 3. முக்கிய வகைப்பாடுகள் & ஒப்பீட்டு அட்டவணைகள் (Important Classifications & Tables)
(பாடநூலில் வரும் வகைகள், எண்கள், வேறுபாடுகள், காலவரிசை ஆகியவற்றை நினைவில் நிறுத்த அட்டவணையாகத் தரவும்)
| தலைப்பு / வகைப்பாடு | உட்பிரிவுகள் / முக்கிய எண்கள் | முக்கிய வேறுபாடுகள் & பாடநூல் சான்றுகள் |
|---|---|---|
| ... | ... | ... |

## 4. TNPSC தேர்வு முக்கிய தகவல்கள் (TNPSC High-Yield Exam Facts)
- **முக்கிய ஆண்டுகள் & நிகழ்வுகள்**: ...
- **அடிக்கடி கேட்கப்படும் வரையறைகள்**: ...
- **பாடநூல் சிறப்புக் குறிப்புகள் (Do You Know / தெரிந்து கொள்வோம்)**: ...

## 5. விரைவு மீள்பார்வை வினா-விடை அட்டவணை (Quick Revision Q&A Table)
(தேர்வுக்கு முன் விரைவாக மறுபரிசீலனை செய்ய 5-10 நேரடி கேள்வி-பதில் அட்டவணை)
| எண் | மாதிரி வினா (Question) | பாடநூல் நேரடி விடை (Direct Answer) | பக்க எண் |
|---|---|---|---|
| 1 | ... | ... | ... |
| 2 | ... | ... | ... |

முழுமையான Markdown வடிவத்தில் மட்டுமே விடையளிக்கவும். JSON wrapper அல்லது தேவையில்லாத உரையாடல்களை முற்றிலும் தவிர்க்கவும்.`;
  }

  return `You are a Senior Full-Stack TNPSC Content Expert & Samacheer Kalvi Textbook Specialist.

Analyze the provided official Tamil Nadu State Board (Samacheer Kalvi) textbook passages and generate comprehensive, high-yield TNPSC One-Liner Coaching Notes.

TEXTBOOK REFERENCE:
- Textbook: ${params.bookName}
- Pages: ${params.pages.join(', ')}
- Target Exam: ${params.category.toUpperCase()}
- Subject: ${params.subject}
- Class/Standard: ${params.classId ? params.classId + 'th Standard' : 'Applicable'}
- Unit / Chapter: ${params.chapterNumber} - "${params.chapterTitle}"
- Language: English

PRIMARY TEXTBOOK PASSAGES (AUTHORITATIVE SOURCE):
"""
${params.passagesText}
"""

MANDATORY RULES:
1. The uploaded textbook text is the authoritative reference. Do not invent facts, years, names, dates, or formulas.
2. Convert lengthy textbook paragraphs into numbered, easy-to-memorise direct statements.
3. Include textbook page citations where applicable, e.g., "[Page: X]".
4. Do not skip any examination-oriented fact, table, classification, or literary reference.

OUTPUT STRUCTURE:
# Chapter ${params.chapterNumber}: ${params.chapterTitle}
> **Textbook Reference**: ${params.bookName} (Pages: ${params.pages.join(', ')})

## 1. Important One-Liner Notes
(Generate numbered, concise, direct factual statements. At least 15-25 high-yield one-liner points covering definitions, events, numbers, places, personalities, and scientific laws)
1. [Direct factual statement 1] - [Page: X]
2. [Direct factual statement 2] - [Page: X]
3. [Direct factual statement 3] - [Page: X]

## 2. Author and Literary Works / Key Personalities
(Table of authors, personalities, original names, pen names, titles, and literary or scientific contributions)
| Personality / Author | Original / Pen Name | Titles & Honors | Key Works / Discoveries | Significant Exam Facts |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

## 3. Important Classifications & Comparison Tables
(Convert textbook classifications, categories, numbers, differences, or chronological sequences into clean tables)
| Classification / Topic | Sub-categories / Numbers | Key Features & Distinctions |
|---|---|---|
| ... | ... | ... |

## 4. TNPSC High-Yield Exam Facts
- **Key Dates, Years & Events**: ...
- **Core Definitions & Principles**: ...
- **Exam High-Yield Pointers ("Box Items / Info Bits")**: ...

## 5. Quick Revision Q&A Table
(A compact question-and-answer revision table for quick last-minute exam recall)
| # | Examination Question | Direct Textbook Answer | Page Ref |
|---|---|---|---|
| 1 | ... | ... | ... |
| 2 | ... | ... | ... |

Return ONLY the formatted Markdown. No JSON wrappers, no extra conversational preamble or closing.`;
}

/**
 * Calls Gemini API with fallback over available models.
 */
async function callGeminiApi(prompt: string, apiKey: string): Promise<{ text: string; model: string } | null> {
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
          },
        }),
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data: any = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText && rawText.trim().length > 100) {
          return { text: rawText.trim(), model };
        }
      } else {
        const errText = await res.text();
        console.warn(`Gemini model ${model} returned HTTP ${res.status}:`, errText.slice(0, 150));
      }
    } catch (err: any) {
      console.warn(`Gemini model ${model} call failed:`, err.message);
    }
  }

  return null;
}

/**
 * Synthesizes high-yield One-Liner Notes directly from textbook passages
 * when offline or without an active Gemini API key.
 */
function synthesizeOneLinerFallback(params: {
  chapterTitle: string;
  chapterNumber: number | string;
  bookName: string;
  pages: number[];
  category: string;
  subject: string;
  classId: number | null;
  lang: 'tamil' | 'english';
  passages: { pageNumber: number; content: string }[];
}): string {
  const isTamil = params.lang === 'tamil';

  // Extract clean factual sentences
  const points: { text: string; page: number }[] = [];
  for (const p of params.passages) {
    const rawLines = p.content
      .split(/(?<=[.?!;।\n])\s+/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length >= 25 && s.length <= 220 && !s.toLowerCase().includes('page') && !/^\d+$/.test(s));

    for (const line of rawLines) {
      if (points.length < 24) {
        points.push({ text: line, page: p.pageNumber });
      }
    }
  }

  const renderedPoints = points
    .map((pt, i) => `${i + 1}. ${pt.text} - [${isTamil ? 'பக்கம்' : 'Page'}: ${pt.page}]`)
    .join('\n');

  if (isTamil) {
    return `# ${params.chapterNumber}. ${params.chapterTitle}
> **பாடநூல் ஆதாரம்**: ${params.bookName} (பக்கங்கள்: ${params.pages.join(', ')})

## 1. முக்கிய ஒருவரி குறிப்புகள் (Important One-Liner Notes)
${renderedPoints || `1. ${params.chapterTitle} பாடம் TNPSC பொதுத் தேர்வுக்குரிய சமச்சீர் கல்வி பாடத்திட்டத்தின் கீழ் வருகிறது. - [பக்கம்: ${params.pages[0] || 1}]`}

## 2. ஆசிரியர் & இலக்கியக் குறிப்புகள் / முக்கிய ஆளுமைகள் (Author & Literary Works)
| ஆளுமை / ஆசிரியர் பெயர் | இயற்பெயர் / புனைப்பெயர் | சிறப்புப் பட்டங்கள் | முக்கிய நூல்கள் / படைப்புகள் | முக்கிய தேர்வுத் தகவல்கள் |
|---|---|---|---|---|
| பாடநூல் ஆளுமை | அதிகாரப்பூர்வ சமச்சீர் கல்வி | முதன்மை ஆசிரியர் | ${params.chapterTitle} | ${params.subject} சார்ந்த முக்கிய தகவல்கள் |

## 3. முக்கிய வகைப்பாடுகள் & ஒப்பீட்டு அட்டவணைகள் (Important Classifications & Tables)
| தலைப்பு / வகைப்பாடு | உட்பிரிவுகள் / முக்கிய எண்கள் | முக்கிய வேறுபாடுகள் & பாடநூல் சான்றுகள் |
|---|---|---|
| ${params.chapterTitle} அடிப்படை கூறுகள் | ${params.pages.length} பக்கங்கள் | தமிழ்நாடு பாடநூல் கழகத்தின் நேரடி சமச்சீர் பாடக்குறிப்புகள் |

## 4. TNPSC தேர்வு முக்கிய தகவல்கள் (TNPSC High-Yield Exam Facts)
- **முக்கிய பாடம்**: ${params.chapterTitle} (${params.subject})
- **தேர்வு முக்கியத்துவம்**: TNPSC குரூப் தேர்வுகள் (Group 1, 2, 4) சமச்சீர் கல்வி பாடத்திட்டம்
- **பாடநூல் பக்கங்கள்**: ${params.pages.join(', ')}

## 5. விரைவு மீள்பார்வை வினா-விடை அட்டவணை (Quick Revision Q&A Table)
| எண் | மாதிரி வினா (Question) | பாடநூல் நேரடி விடை (Direct Answer) | பக்க எண் |
|---|---|---|---|
| 1 | ${params.chapterTitle} எந்த வகுப்பின் பாடத்திட்டத்தில் உள்ளது? | ${params.classId ? params.classId + 'ஆம் வகுப்பு' : '6ஆம் வகுப்பு'} (${params.subject}) | ${params.pages[0] || 1} |
| 2 | இப்பாடத்திற்கான அதிகாரப்பூர்வ பாடநூல் எது? | ${params.bookName} | ${params.pages[0] || 1} |`;
  }

  return `# Chapter ${params.chapterNumber}: ${params.chapterTitle}
> **Textbook Reference**: ${params.bookName} (Pages: ${params.pages.join(', ')})

## 1. Important One-Liner Notes
${renderedPoints || `1. ${params.chapterTitle} is part of the authoritative Samacheer Kalvi syllabus for TNPSC examination preparation. - [Page: ${params.pages[0] || 1}]`}

## 2. Author and Literary Works / Key Personalities
| Personality / Author | Original / Pen Name | Titles & Honors | Key Works / Discoveries | Significant Exam Facts |
|---|---|---|---|---|
| Textbook Author | State Board Specialist | Subject Expert | ${params.chapterTitle} | Samacheer Kalvi syllabus standard |

## 3. Important Classifications & Comparison Tables
| Classification / Topic | Sub-categories / Numbers | Key Features & Distinctions |
|---|---|---|
| Core Curriculum | ${params.subject} | Unit ${params.chapterNumber} syllabus definitions |

## 4. TNPSC High-Yield Exam Facts
- **Subject & Scope**: ${params.subject} - Chapter ${params.chapterNumber}: ${params.chapterTitle}
- **Examination Target**: TNPSC Group 1, 2, 2A, 4 Syllabus
- **Source Reference**: ${params.bookName} (Pages: ${params.pages.join(', ')})

## 5. Quick Revision Q&A Table
| # | Examination Question | Direct Textbook Answer | Page Ref |
|---|---|---|---|
| 1 | What is the syllabus level of ${params.chapterTitle}? | Standard ${params.classId || 6} ${params.subject} | Page ${params.pages[0] || 1} |
| 2 | What is the authoritative textbook reference? | ${params.bookName} | Page ${params.pages[0] || 1} |`;
}

/**
 * Main Service: Generates comprehensive TNPSC One-Liner Notes from textbook RAG
 * Supporting both single chapter and full textbook PDF workflows.
 */
export async function generateStudyNotesWithRag(
  params: GenerateNotesRequestParams
): Promise<GeneratedNotesResult> {
  const {
    category,
    subject,
    classId,
    unitId,
    lessonTitle,
    topic,
    language = 'english',
    apiKey,
    textbookMode = 'auto',
    textbookId,
    term = 'Term 1',
    scope = 'chapter',
  } = params;

  const cleanCategory = String(category || 'group1').trim().toLowerCase();
  const parsedUnitId = Number(unitId) || 1;
  const parsedClassId = classId ? Number(classId) : 6;
  const trimmedLesson = String(lessonTitle || '').trim();
  const trimmedTopic = String(topic || trimmedLesson).trim();
  const lang = (String(language || 'english')).toLowerCase() === 'tamil' ? 'tamil' : 'english';
  const effectiveApiKey = (apiKey && typeof apiKey === 'string' && apiKey.trim())
    ? apiKey.trim()
    : (process.env.GEMINI_API_KEY || '').trim();

  const effectiveMedium = /tamil|தமிழ்/i.test(subject) || lang === 'tamil' ? 'Tamil' : 'English';
  const parsedTextbookId = textbookId && !isNaN(Number(textbookId)) ? Number(textbookId) : undefined;

  // 1. Retrieve initial textbook content using RAG service
  const ragResult = await retrieveRelevantTextbookContent({
    groupId: cleanCategory,
    standard: parsedClassId,
    subject,
    medium: effectiveMedium,
    term: term && term !== 'Full Year' ? term : undefined,
    unitId: parsedUnitId,
    lessonTitle: trimmedLesson,
    topic: trimmedTopic,
    textbookId: parsedTextbookId,
    maxPages: scope === 'full_book' ? 75 : 25,
  });

  if (!ragResult.textbookId || !ragResult.hasSufficientContent || ragResult.chunks.length === 0) {
    if (textbookMode === 'specific') {
      throw new Error(`Selected textbook (#${parsedTextbookId || 'ID'}) does not have sufficient indexed content. Please choose another completed textbook or upload a PDF.`);
    } else if (textbookMode === 'upload') {
      throw new Error('The uploaded textbook PDF is still processing or does not have sufficient indexed content. Please wait for indexing to finish.');
    } else {
      throw new Error(`No matching completed Samacheer Kalvi textbook PDF found for ${parsedClassId}th Standard - ${subject} (${term || 'Term 1'}). Please upload the textbook PDF using "Upload New Textbook PDF" or select a specific textbook.`);
    }
  }

  const resolvedTextbookId = ragResult.textbookId;
  const resolvedBookName = ragResult.bookName || `Samacheer Kalvi ${parsedClassId}th Standard ${subject}`;

  // 2. Handle Chapter-Wise vs Full-Book Scope
  if (scope === 'full_book') {
    // Detect and group all chapters from textbook_content
    const chaptersRes = await pool.query(
      `SELECT
         COALESCE(unit_id, 1) as unit_id,
         COALESCE(NULLIF(lesson_title, ''), NULLIF(unit_title, ''), 'Chapter ' || COALESCE(unit_id, 1)) as chapter_title,
         MIN(page_number) as min_page,
         MAX(page_number) as max_page,
         COUNT(*) as page_count
       FROM textbook_content
       WHERE textbook_id = $1 AND (topic IS NULL OR (topic != 'front_matter' AND topic != 'back_matter'))
       GROUP BY unit_id, COALESCE(NULLIF(lesson_title, ''), NULLIF(unit_title, ''), 'Chapter ' || COALESCE(unit_id, 1))
       ORDER BY MIN(page_number) ASC`,
      [resolvedTextbookId]
    );

    const detectedChapters = chaptersRes.rows;

    if (detectedChapters.length > 0) {
      const generatedChapterSections: string[] = [];
      const allReferencedPages: number[] = [];
      let finalSource: 'gemini' | 'textbook_rag' = 'textbook_rag';
      let activeModel = 'textbook-rag-engine';

      for (let i = 0; i < detectedChapters.length; i++) {
        const ch = detectedChapters[i];
        const minP = Number(ch.min_page);
        const maxP = Number(ch.max_page);

        // Fetch pages for this specific chapter
        const pagesRes = await pool.query(
          `SELECT page_number, content
           FROM textbook_content
           WHERE textbook_id = $1 AND page_number BETWEEN $2 AND $3
           ORDER BY page_number ASC`,
          [resolvedTextbookId, minP, maxP]
        );

        const chPassages = pagesRes.rows.map((r: any) => ({
          pageNumber: Number(r.page_number),
          content: r.content,
        }));

        const chPages = chPassages.map((p) => p.pageNumber);
        allReferencedPages.push(...chPages);

        const chPassagesText = chPassages
          .slice(0, 15)
          .map((p) => `--- PAGE ${p.pageNumber} (${resolvedBookName}) ---\n${p.content}`)
          .join('\n\n');

        let chapterContent = '';
        if (effectiveApiKey) {
          const prompt = buildOneLinerPrompt({
            chapterTitle: ch.chapter_title,
            chapterNumber: ch.unit_id || i + 1,
            bookName: resolvedBookName,
            pages: chPages,
            category: cleanCategory,
            subject,
            classId: parsedClassId,
            lang,
            passagesText: chPassagesText,
          });

          const geminiResult = await callGeminiApi(prompt, effectiveApiKey);
          if (geminiResult) {
            chapterContent = geminiResult.text;
            finalSource = 'gemini';
            activeModel = geminiResult.model;
          }
        }

        if (!chapterContent) {
          chapterContent = synthesizeOneLinerFallback({
            chapterTitle: ch.chapter_title,
            chapterNumber: ch.unit_id || i + 1,
            bookName: resolvedBookName,
            pages: chPages,
            category: cleanCategory,
            subject,
            classId: parsedClassId,
            lang,
            passages: chPassages,
          });
        }

        generatedChapterSections.push(chapterContent);
      }

      const combinedContent = generatedChapterSections.join('\n\n---\n\n');
      const uniquePages = Array.from(new Set(allReferencedPages)).sort((a, b) => a - b);
      const sourceRef = `${resolvedBookName} (All Chapters, Pages ${uniquePages[0] || 1}–${uniquePages[uniquePages.length - 1] || uniquePages[0] || 1})`;

      return {
        title: `${resolvedBookName} - Complete One-Liner Notes (${detectedChapters.length} Chapters)`,
        content: combinedContent,
        source: finalSource,
        modelUsed: activeModel,
        textbookUsed: {
          id: resolvedTextbookId,
          name: resolvedBookName,
          pages: uniquePages,
        },
        sourceReference: sourceRef,
        detectedChaptersCount: detectedChapters.length,
      };
    }
  }

  // 3. Single Chapter Scope (Default & Lesson-Wise)
  const passages = ragResult.chunks.map((c) => ({
    pageNumber: c.pageNumber,
    content: c.content,
  }));

  const relevantPages = ragResult.relevantPages;
  const passagesText = passages
    .slice(0, 16)
    .map((p) => `--- PAGE ${p.pageNumber} (${resolvedBookName}) ---\n${p.content}`)
    .join('\n\n');

  let content = '';
  let finalSource: 'gemini' | 'textbook_rag' = 'textbook_rag';
  let activeModel = 'textbook-rag-engine';

  if (effectiveApiKey) {
    const prompt = buildOneLinerPrompt({
      chapterTitle: trimmedLesson || `Unit ${parsedUnitId}`,
      chapterNumber: parsedUnitId,
      bookName: resolvedBookName,
      pages: relevantPages,
      category: cleanCategory,
      subject,
      classId: parsedClassId,
      lang,
      passagesText,
    });

    const geminiResult = await callGeminiApi(prompt, effectiveApiKey);
    if (geminiResult) {
      content = geminiResult.text;
      finalSource = 'gemini';
      activeModel = geminiResult.model;
    }
  }

  if (!content) {
    content = synthesizeOneLinerFallback({
      chapterTitle: trimmedLesson || `Unit ${parsedUnitId}`,
      chapterNumber: parsedUnitId,
      bookName: resolvedBookName,
      pages: relevantPages,
      category: cleanCategory,
      subject,
      classId: parsedClassId,
      lang,
      passages,
    });
  }

  const sourceRef = `${resolvedBookName} (Pages ${relevantPages.join(', ')})`;

  return {
    title: trimmedLesson || `Unit ${parsedUnitId} - ${subject}`,
    content,
    source: finalSource,
    modelUsed: activeModel,
    textbookUsed: {
      id: resolvedTextbookId,
      name: resolvedBookName,
      pages: relevantPages,
    },
    sourceReference: sourceRef,
    detectedChaptersCount: 1,
  };
}
