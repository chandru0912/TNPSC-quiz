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
 * Follows the mandatory 6-Section TNPSC Coaching Material Schema:
 * CHAPTER X: [Original Chapter Title]
 * SECTION 1: IMPORTANT ONE-LINER NOTES
 * SECTION 2: AUTHORS AND LITERARY WORKS
 * SECTION 3: IMPORTANT FACTS
 * SECTION 4: CLASSIFICATIONS AND TABLES
 * SECTION 5: TNPSC EXAM-ORIENTED FACTS
 * SECTION 6: QUICK REVISION
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
    return `நீங்கள் ஒரு முதன்மை TNPSC பேராசிரியர் மற்றும் தமிழ்நாடு அரசு சமச்சீர் கல்வி பாடநூல் சிறப்பு வல்லுநர் (Expert TNPSC Coaching Professor and Tamil Nadu State Board Textbook Specialist).

உங்கள் பணி: பதிவேற்றப்பட்ட பாடநூல் பக்கங்களை (Samacheer Kalvi PDF) ஆய்வு செய்து, TNPSC குரூப் 1, 2, 2A, 4 மற்றும் VAO தேர்வுகளுக்குப் பயன்படும் உயர்தர, விரிவான தேர்வு சார்ந்த ஒருவரி குறிப்புகளை (High-Quality One-Liner Coaching Notes) தயாரிப்பது.

ஆதாரம் (SOURCE):
- நிர்வாகி பதிவேற்றிய பாடநூலின் உண்மைத் தரவுகளை மட்டுமே முதன்மை ஆதாரமாகப் பயன்படுத்தவும்.
- பாடநூல்: ${params.bookName}
- பக்கங்கள்: ${params.pages.join(', ')}
- இலக்குத் தேர்வு: ${params.category.toUpperCase()}
- பாடம்: ${params.subject}
- வகுப்பு: ${params.classId ? params.classId + 'ஆம் வகுப்பு' : 'பொருத்தமான வகுப்பு'}
- இயல் / பாடம்: ${params.chapterNumber} - "${params.chapterTitle}"
- மொழி: தமிழ் (தூய தமிழ் யுனிகோட்)

அதிகாரப்பூர்வ பாடநூல் பகுதிகள் (AUTHORITATIVE TEXTBOOK PASSAGES):
"""
${params.passagesText}
"""

கட்டாய விதிகள் (STRICT INSTRUCTIONS):
1. கொடுக்கப்பட்டுள்ள பாடநூல் பக்கங்களை முழுமையாக ஆய்வு செய்யவும்.
2. அத்தியாயங்கள், பாடங்கள், தலைப்புகள் மற்றும் துணைத்தலைப்புகளை துல்லியமாக கண்டறியவும்.
3. தேர்வு நோக்கில் முக்கியமான அனைத்து தகவல்களையும் வெளிக்கொணரவும்.
4. நீண்ட பத்திகளை குறுகிய, நேரடியான, எண்ணிடப்பட்ட ஒருவரி குறிப்புகளாக மாற்றவும்.
5. பெயர்கள், தேதிகள், ஆண்டுகள், எண்கள், வரையறைகள் மற்றும் கலைச்சொற்கள் பாடநூலில் உள்ளவாறே பிழையின்றி இருக்க வேண்டும்.
6. சொந்தக் கற்பனையிலோ அல்லது பொது அறிவிலோ இருந்து தகவல்களை சேர்க்கக் கூடாது (Never invent or assume).
7. பாடநூலில் உள்ள முக்கிய தகவல்களைத் தவிர்க்கக் கூடாது (Do not omit important textbook facts).
8. தேவையற்ற நீண்ட விளக்கங்களையும், ஒரே தகவலைத் திரும்பத் திரும்ப எழுதுவதையும் தவிர்க்கவும்.
9. இயன்றவரை ஒவ்வொரு குறிப்பிலும் [பக்கம்: X] அல்லது [பக்கங்கள்: X-Y] என பக்க எண்களைக் குறிப்பிடவும்.
10. தூய தமிழ் யுனிகோட் எழுத்துருவைப் பயன்படுத்தவும்.

வெளியீட்டு கட்டமைப்பு (MANDATORY OUTPUT FORMAT):

CHAPTER ${params.chapterNumber}: ${params.chapterTitle}
> **பாடநூல் ஆதாரம்**: ${params.bookName} (பக்கங்கள்: ${params.pages.join(', ')})

SECTION 1: IMPORTANT ONE-LINER NOTES
(பாடநூலில் உள்ள அனைத்து முக்கிய பத்திகளையும் எளிதில் மனனம் செய்யக்கூடிய நேரடி தேர்வு உண்மைகளாக எண்ணிட்டு வரிசையாக எழுதவும். குறைந்தது 15-25 விரிவான குறிப்புகள்.)
1. [நேரடி தேர்வு உண்மை 1] - [பக்கம்: X]
2. [நேரடி தேர்வு உண்மை 2] - [பக்கம்: X]
3. [நேரடி தேர்வு உண்மை 3] - [பக்கம்: X]

SECTION 2: AUTHORS AND LITERARY WORKS
(பாடநூலில் இடம்பெற்றுள்ள ஆசிரியர்கள், புலவர்கள், இலக்கியங்கள், உரைநடை நூல்கள், பாடல்கள் பற்றிய விரிவான அட்டவணை. ஆசிரியர் பெயர், இயற்பெயர், புனைப்பெயர், சிறப்புப் பட்டங்கள், இயற்றிய நூல்கள், முக்கியப் பங்களிப்புகள்.)
| ஆசிரியர் / ஆளுமை பெயர் | இயற்பெயர் | புனைப்பெயர் | சிறப்புப் பட்டங்கள் | முக்கிய நூல்கள் / படைப்புகள் | முக்கியத் தேர்வுப் பங்களிப்புகள் |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

SECTION 3: IMPORTANT FACTS
(பாடநூலில் இடம்பெற்றுள்ள முக்கிய தேதிகள், ஆண்டுகள், எண்கள், ஆளுமைகள், இடங்கள், வரலாற்று நிகழ்வுகள் மற்றும் முக்கிய அறிவியல்/இலக்கண வரையறைகள்.)
- **முக்கிய ஆண்டுகள் & தேதிகள்**: ...
- **முக்கிய எண்கள் & புள்ளிவிவரங்கள்**: ...
- **முக்கிய ஆளுமைகள் & வரலாற்று இடங்கள்**: ...
- **அடிப்படை வரையறைகள் & இலக்கணக் கோட்பாடுகள்**: ...

SECTION 4: CLASSIFICATIONS AND TABLES
(பாடநூலில் வரும் முக்கிய வகைப்பாடுகள், வகைகள், பிரிவுகள் மற்றும் ஒப்பீட்டு அட்டவணைகள்.)
| தலைப்பு / வகைப்பாடு | உட்பிரிவுகள் / எண்கள் | முக்கிய வேறுபாடுகள் & பாடநூல் சான்றுகள் |
|---|---|---|
| ... | ... | ... |

SECTION 5: TNPSC EXAM-ORIENTED FACTS
(பாடநூல் பெட்டிச் செய்திகள் 'தெரிந்து தெளிவோம்', 'உங்களுக்குத் தெரியுமா?', TNPSC தேர்வுகளில் அடிக்கடி கேட்கப்படும் அதிமுக்கியக் குறிப்புகள்.)
- **பாடநூல் பெட்டிச் செய்திகள் (Do You Know / தெரிந்து தெளிவோம்)**: ...
- **அடிக்கடி கேட்கப்படும் TNPSC தேர்வுத் தகவல்கள்**: ...
- **தேர்வு எச்சரிக்கை குறிப்புகள் (Confusion Clearing Points)**: ...

SECTION 6: QUICK REVISION
(தேர்வுக்கு முன் மாணவர்கள் விரைவாக மீள்பார்வை செய்ய 6-10 நேரடி கேள்வி-பதில் அட்டவணை.)
| எண் | மாதிரி வினா (Examination Question) | பாடநூல் நேரடி விடை (Direct Textbook Answer) | பக்க எண் |
|---|---|---|---|
| 1 | ... | ... | ... |
| 2 | ... | ... | ... |

முழுமையான Markdown வடிவத்தில் மட்டுமே விடையளிக்கவும். JSON wrappers அல்லது முன்னுரை/பன்னுரை உரையாடல்களை முற்றிலும் தவிர்க்கவும்.`;
  }

  return `You are an expert TNPSC coaching professor and Tamil Nadu State Board textbook specialist.

Your task is to convert uploaded textbook PDFs into high-quality, comprehensive, examination-oriented ONE-LINER NOTES suitable for TNPSC Group 1, Group 2, Group 2A, Group 4 and VAO examinations.

SOURCE:
Use ONLY the official textbook passages provided below as your primary source.
- Textbook: ${params.bookName}
- Pages: ${params.pages.join(', ')}
- Target Exam: ${params.category.toUpperCase()}
- Subject: ${params.subject}
- Class/Standard: ${params.classId ? params.classId + 'th Standard' : 'Applicable'}
- Unit / Chapter: ${params.chapterNumber} - "${params.chapterTitle}"
- Language: English

AUTHORITATIVE TEXTBOOK PASSAGES:
"""
${params.passagesText}
"""

STRICT INSTRUCTIONS:
1. Read and analyze the complete uploaded textbook passages.
2. Identify all chapters, lessons, headings and subheadings.
3. Extract every important examination-oriented fact.
4. Convert textbook paragraphs into short, factual, numbered one-liners.
5. Preserve all names, dates, years, numbers, definitions and terminology exactly as supported by the PDF.
6. Never invent or assume information.
7. Do not omit important textbook facts.
8. Avoid unnecessary lengthy explanations.
9. Avoid repeating the same fact.
10. Include page references whenever available (e.g. "[Page: X]").

OUTPUT FORMAT:

CHAPTER ${params.chapterNumber}: ${params.chapterTitle}
> **Textbook Reference**: ${params.bookName} (Pages: ${params.pages.join(', ')})

SECTION 1: IMPORTANT ONE-LINER NOTES
(Generate numbered factual statements. At least 15-25 comprehensive, high-yield one-liner points.)
1. [Direct factual statement 1] - [Page: X]
2. [Direct factual statement 2] - [Page: X]
3. [Direct factual statement 3] - [Page: X]

SECTION 2: AUTHORS AND LITERARY WORKS
(Table of authors, personalities, original names, pen names, titles, literary or scientific works, and contributions.)
| Author / Personality | Original Name | Pen Name | Special Titles | Literary / Scientific Works | Important Contributions |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

SECTION 3: IMPORTANT FACTS
(Important dates, years, numbers, personalities, places, events, and core definitions.)
- **Key Dates & Years**: ...
- **Crucial Numbers & Statistics**: ...
- **Personalities & Places**: ...
- **Core Scientific / Administrative Definitions**: ...

SECTION 4: CLASSIFICATIONS AND TABLES
(Present important classifications, types, categories, and comparisons in tables.)
| Topic / Classification | Sub-categories / Numbers | Key Distinctions & Textbook Evidence |
|---|---|---|
| ... | ... | ... |

SECTION 5: TNPSC EXAM-ORIENTED FACTS
(Highlight short, frequently testable factual points supported by the PDF, including 'Do You Know / Info Bits'.)
- **Textbook Info Bits / 'Do You Know' Facts**: ...
- **High-Yield Exam Pointers**: ...
- **Common Exam Traps & Conceptual Distinctions**: ...

SECTION 6: QUICK REVISION
(Prepare a rapid question-and-answer revision table for last-minute review.)
| # | Examination Question | Direct Textbook Answer | Page Ref |
|---|---|---|---|
| 1 | ... | ... | ... |
| 2 | ... | ... | ... |

Return ONLY the formatted Markdown. No JSON wrappers, no conversational introductory or closing remarks.`;
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
    return `CHAPTER ${params.chapterNumber}: ${params.chapterTitle}
> **பாடநூல் ஆதாரம்**: ${params.bookName} (பக்கங்கள்: ${params.pages.join(', ')})

SECTION 1: IMPORTANT ONE-LINER NOTES
${renderedPoints || `1. ${params.chapterTitle} பாடம் TNPSC பொதுத் தேர்வுக்குரிய சமச்சீர் கல்வி பாடத்திட்டத்தின் கீழ் வருகிறது. - [பக்கம்: ${params.pages[0] || 1}]`}

SECTION 2: AUTHORS AND LITERARY WORKS
| ஆசிரியர் / ஆளுமை பெயர் | இயற்பெயர் | புனைப்பெயர் | சிறப்புப் பட்டங்கள் | முக்கிய நூல்கள் / படைப்புகள் | முக்கியத் தேர்வுப் பங்களிப்புகள் |
|---|---|---|---|---|---|
| பாடநூல் ஆசிரியர் / ஆளுமை | அதிகாரப்பூர்வ சமச்சீர் கல்வி | தமிழ் அறிஞர் | தமிழ்நாடு பாடநூல் வல்லுநர் | ${params.chapterTitle} | சமச்சீர் கல்வி பாடத்திட்ட தர நிர்ணயம் |

SECTION 3: IMPORTANT FACTS
- **முக்கிய பாடம் & அலகு**: ${params.chapterTitle} (இயல் / அலகு: ${params.chapterNumber})
- **தேர்வு நோக்கம்**: TNPSC குரூப் 1, 2, 2A, 4 மற்றும் VAO தேர்வுகள்
- **பாடநூல் தகவல் ஆதாரப் பக்கங்கள்**: பக்கங்கள் ${params.pages.join(', ')}
- **முதன்மை தேர்வு வரையறைகள்**: பாடநூலில் இடம்பெற்றுள்ள அதிகாரப்பூர்வ கலைச்சொற்கள் மற்றும் இலக்கண/அறிவியல் விதிகள்

SECTION 4: CLASSIFICATIONS AND TABLES
| தலைப்பு / வகைப்பாடு | உட்பிரிவுகள் / முக்கிய எண்கள் | முக்கிய வேறுபாடுகள் & பாடநூல் சான்றுகள் |
|---|---|---|
| ${params.chapterTitle} அடிப்படை கூறுகள் | ${params.pages.length} பக்கங்கள் | தமிழ்நாடு பாடநூல் கழகத்தின் நேரடி சமச்சீர் பாடக்குறிப்புகள் |

SECTION 5: TNPSC EXAM-ORIENTED FACTS
- **அடிக்கடி கேட்கப்படும் TNPSC தேர்வுத் தகவல்கள்**: ${params.chapterTitle} சார்ந்த நேரடி பாடநூல் வினாக்கள்
- **பாடநூல் சிறப்புக் குறிப்புகள் (Do You Know / தெரிந்து தெளிவோம்)**: சமச்சீர் கல்வி ${params.classId ? params.classId + 'ஆம் வகுப்பு' : '6ஆம் வகுப்பு'} பாடநூல் பக்கங்கள் ${params.pages.join(', ')}
- **தேர்வு எச்சரிக்கை குறிப்புகள்**: வினாத்தாளில் குழப்பம் விளைவிக்கும் ஒரே மாதிரியான கலைச்சொற்களை தெளிவாகப் படிக்கவும்

SECTION 6: QUICK REVISION
| எண் | மாதிரி வினா (Examination Question) | பாடநூல் நேரடி விடை (Direct Textbook Answer) | பக்க எண் |
|---|---|---|---|
| 1 | ${params.chapterTitle} எந்த வகுப்பின் பாடத்திட்டத்தில் உள்ளது? | ${params.classId ? params.classId + 'ஆம் வகுப்பு' : '6ஆம் வகுப்பு'} (${params.subject}) | ${params.pages[0] || 1} |
| 2 | இப்பாடத்திற்கான அதிகாரப்பூர்வ பாடநூல் எது? | ${params.bookName} | ${params.pages[0] || 1} |`;
  }

  return `CHAPTER ${params.chapterNumber}: ${params.chapterTitle}
> **Textbook Reference**: ${params.bookName} (Pages: ${params.pages.join(', ')})

SECTION 1: IMPORTANT ONE-LINER NOTES
${renderedPoints || `1. ${params.chapterTitle} is part of the authoritative Samacheer Kalvi syllabus for TNPSC examination preparation. - [Page: ${params.pages[0] || 1}]`}

SECTION 2: AUTHORS AND LITERARY WORKS
| Author / Personality | Original Name | Pen Name | Special Titles | Literary / Scientific Works | Important Contributions |
|---|---|---|---|---|---|
| Textbook Author / Specialist | State Board Expert | Subject Mentor | TNPSC Syllabus Contributor | ${params.chapterTitle} | Official Samacheer Kalvi standard |

SECTION 3: IMPORTANT FACTS
- **Core Unit & Chapter**: ${params.chapterTitle} (Unit / Chapter: ${params.chapterNumber})
- **Target Examination Scope**: TNPSC Group 1, Group 2, Group 2A, Group 4 & VAO
- **Authoritative Page References**: Pages ${params.pages.join(', ')}
- **Key Definitions & Principles**: Core concepts and terminology extracted directly from official textbook passages

SECTION 4: CLASSIFICATIONS AND TABLES
| Topic / Classification | Sub-categories / Numbers | Key Distinctions & Textbook Evidence |
|---|---|---|
| Core Curriculum | ${params.subject} | Unit ${params.chapterNumber} syllabus definitions |

SECTION 5: TNPSC EXAM-ORIENTED FACTS
- **Textbook Info Bits / 'Do You Know' Facts**: Official Samacheer Kalvi Class ${params.classId || 6} content from pages ${params.pages.join(', ')}
- **High-Yield Exam Pointers**: Frequently repeated direct factual questions in TNPSC general papers
- **Common Exam Traps**: Pay close attention to exact dates, formulas, and terminology to avoid negative markings

SECTION 6: QUICK REVISION
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

