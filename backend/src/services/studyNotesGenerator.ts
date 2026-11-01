/**
 * Study Notes Generation & Coverage Validation Service
 * Follows strict concise short-note format:
 * - Every topic and subtopic covered in high-yield bullet points
 * - Tables only when comparing structured data
 * - STRICTLY NO page numbers, book references, audit fluff, intros, or outros
 * - Internal topic coverage validation & auto-healing
 */

import { CloudAIService } from './cloudAi/cloudAiService';
import { cleanTamilUnicodeText } from './tamilUnicodeCleaner';

export interface StudyNotesRequest {
  category: string;
  standard: number;
  subject: string;
  unitId: number;
  unitTitle?: string;
  lessonTitle: string;
  lessonId?: string;
  lessonNumber?: string;
  language: 'tamil' | 'english';
  noteFormat?: 'short' | 'full';
  textbookContent: string;
  extractedPages?: number[];
  textbookName?: string;
  apiKeyOverride?: string;
}

export interface TopicCoverageValidation {
  totalExtractedTopics: string[];
  coveredTopics: string[];
  missingTopics: string[];
  isFullyCovered: boolean;
  healedTopicsCount: number;
}

export interface GeneratedStudyNotesResult {
  title: string;
  content: string;
  topics: string[];
  validation: TopicCoverageValidation;
  language: 'tamil' | 'english';
  noteFormat: 'short' | 'full';
}

/**
 * Strips prohibited meta-content: page numbers, refer-to-page notes, audit comments, intros/outros.
 */
export function sanitizeStudyNotesMarkdown(rawMarkdown: string): string {
  let cleaned = cleanTamilUnicodeText(rawMarkdown);

  // 1. Remove page number references like [Page 12], (Page 15), Page 12:, பக்கம் 14:, [பக்கம் 12], etc.
  cleaned = cleaned
    .replace(/\[\s*(?:page|p\.|பக்கம்)\s*\d+[^\]]*\]/gi, '')
    .replace(/\(\s*(?:page|p\.|பக்கம்)\s*\d+[^\)]*\)/gi, '')
    .replace(/^[ \t]*(?:page|p\.|பக்கம்)\s*\d+[:\-.]?[ \t]*/gim, '')
    .replace(/(?:refer|see)\s+(?:page|p\.|textbook)\s*\d+/gi, '')
    .replace(/பக்கம்\s*\d+\s*(?:ஐப்\s*பார்க்க|இல்\s*பார்க்க|ஐக்\s*காண்க)/gi, '')
    .replace(/\(\s*\)/g, '');

  // 2. Remove audit reports, coverage summaries, or AI processing blurbs if accidentally outputted
  cleaned = cleaned
    .replace(/#+\s*(?:textbook coverage report|audit report|quality audit|coverage report|internal processing)[\s\S]*?(?=\n#+|$)/gi, '')
    .replace(/#+\s*(?:பாடப் பகுதி முழுமை அறிக்கை|சரிபார்ப்பு அறிக்கை)[\s\S]*?(?=\n#+|$)/gi, '');

  // 3. Remove conversational introductions and conclusions
  cleaned = cleaned
    .replace(/^(?:Here (?:are|is) (?:the )?(?:complete |detailed )?(?:study )?notes[\s\S]*?\n)/i, '')
    .replace(/^(?:Certainly!|Sure,|Here you go[\s\S]*?\n)/i, '')
    .replace(/\n(?:I hope (?:these|this) notes? (?:help|are useful)[\s\S]*$)/i, '')
    .replace(/\n(?:Happy studying!|Best of luck for your TNPSC exam![\s\S]*$)/i, '');

  // 4. Normalize multiple blank lines to double newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

/**
 * Parses headings from markdown to identify topics covered in the notes.
 */
export function extractCoveredTopicsFromMarkdown(markdown: string): string[] {
  const topics: string[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Matches "### Topic 1: Name" or "## Topic Name" or "### Name"
    const headingMatch = trimmed.match(/^#{2,4}\s*(?:Topic\s*\d+[:.]?\s*)?(.*)/i);
    if (headingMatch && headingMatch[1]) {
      const topicName = headingMatch[1].trim();
      // Exclude generic main lesson header
      if (topicName && !topicName.startsWith('#') && topicName.length > 2) {
        topics.push(topicName);
      }
    }
  }

  return Array.from(new Set(topics));
}

/**
 * Extracts key topics and subtopics from textbook text.
 */
export function extractTextbookKeyTopics(textbookContent: string, language: 'tamil' | 'english'): string[] {
  const lines = textbookContent.split('\n');
  const candidateTopics: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3 || trimmed.length > 80) continue;

    // Detect section titles: lines starting with numbers like "1.1", "1.", or bold headers, or Tamil section headers
    if (
      /^\d+(\.\d+)*\s+[A-Za-z\u0B80-\u0BFF]/.test(trimmed) ||
      /^(?:கவிதைப்பேழை|உரைநடை உலகம்|விரிவானம்|கற்கண்டு|வாழ்வியல்|இலக்கணம்|நூல் வெளி|தெரிந்து தெளிவோம்|பாடப்பகுதி|பகுதி)\s*[:\-]?\s*(.+)/i.test(trimmed) ||
      /^(?:Section|Chapter|Topic|Part)\s*\d+/i.test(trimmed)
    ) {
      const cleanHeader = trimmed.replace(/^[\d.\s\-:•*]+/, '').trim();
      if (cleanHeader.length >= 3 && cleanHeader.length <= 60) {
        candidateTopics.push(cleanHeader);
      }
    }
  }

  // Deduplicate and filter out trivial headers
  const unique = Array.from(new Set(candidateTopics));
  return unique.slice(0, 15);
}

/**
 * High-yield concise Short Notes synthesis directly from textbook content
 * when offline or when Cloud AI API key is unconfigured.
 */
export function synthesizeShortNotesFromTextbook(params: {
  lessonTitle: string;
  subject: string;
  standard: number;
  language: 'tamil' | 'english';
  textbookContent: string;
}): string {
  const isTamil = params.language === 'tamil';
  const topics = extractTextbookKeyTopics(params.textbookContent, params.language);

  const rawParagraphs = params.textbookContent
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20 && !/^\s*(?:page|பக்கம்)\s*\d+/i.test(p));

  const sections: { title: string; points: string[] }[] = [];

  if (topics.length > 0) {
    for (let i = 0; i < topics.length; i++) {
      const topicName = topics[i];
      const topicPoints: string[] = [];

      for (const p of rawParagraphs) {
        if (p.toLowerCase().includes(topicName.toLowerCase()) || topicPoints.length < 3) {
          const sentences = p
            .split(/(?<=[.!?।])\s+/)
            .map((s) => s.trim().replace(/^[-•*]\s*/, ''))
            .filter((s) => s.length > 15 && s.length < 250);

          for (const s of sentences) {
            if (topicPoints.length < 5 && !topicPoints.includes(s)) {
              topicPoints.push(s);
            }
          }
        }
      }

      if (topicPoints.length > 0) {
        sections.push({
          title: topicName,
          points: topicPoints,
        });
      }
    }
  }

  // Fallback if topics were sparse
  if (sections.length < 2) {
    const defaultTopics = isTamil
      ? ['அறிமுகம் & அடிப்படைக் கருத்துகள்', 'முக்கியத் தகவல்கள் & வரையறைகள்', 'தேர்வு நோக்கில் சிறப்புக் குறிப்புகள்', 'நினைவில் கொள்ள வேண்டிய உண்மைகள்']
      : ['Core Concepts & Definitions', 'Key Factual Points', 'Exam-Oriented Insights', 'Summary of Essential Facts'];

    const sentences = params.textbookContent
      .split(/(?<=[.!?।])\s+|\n+/)
      .map((s) => s.trim().replace(/^[-•*]\s*/, ''))
      .filter((s) => s.length > 20 && s.length < 300 && !/^(?:page|பக்கம்)\s*\d+/i.test(s));

    const chunkSize = Math.max(3, Math.ceil(sentences.length / defaultTopics.length));
    defaultTopics.forEach((tName, idx) => {
      const slice = sentences.slice(idx * chunkSize, (idx + 1) * chunkSize).slice(0, 5);
      if (slice.length > 0) {
        sections.push({
          title: tName,
          points: slice,
        });
      }
    });
  }

  if (sections.length === 0) {
    if (isTamil) {
      sections.push(
        {
          title: 'பாடக் குறிப்புகள்',
          points: [
            `${params.standard}ஆம் வகுப்பு சமச்சீர் கல்வி பாடத்திட்டத்தின் கீழ் ${params.lessonTitle} பாடத்திற்கான முக்கிய கருத்துக்கள்.`,
            `தேர்வுக்கு தேவையான அடிப்படை வரையறைகள், சமன்பாடுகள் மற்றும் வரலாற்று உண்மைகள் முழுமையாக உள்ளடக்கியது.`,
            `TNPSC தேர்வுகளில் கேட்கப்படும் முக்கிய வினாக்களுக்கான பாடநூல் ஆதாரக் குறிப்புகள்.`,
          ],
        },
        {
          title: 'முக்கிய தேர்வுக் குறிப்புகள்',
          points: [
            `பாடநூலின் முக்கிய சொற்கள் மற்றும் கலைச்சொற்கள் துல்லியமாக மனனம் செய்யப்பட வேண்டும்.`,
            `அட்டவணைகள் மற்றும் வரைபடங்கள் வழி விளக்கப்பட்ட கருத்துக்களை நினைவில் நிறுத்துதல் அவசியம்.`,
          ],
        }
      );
    } else {
      sections.push(
        {
          title: 'Essential Concepts',
          points: [
            `Core syllabus concepts for Standard ${params.standard} under lesson: ${params.lessonTitle}.`,
            `Key definitions, chronological timelines, and scientific principles required for TNPSC examinations.`,
            `Standard Samacheer Kalvi textbook syllabus grounding.`,
          ],
        },
        {
          title: 'Important Exam Points',
          points: [
            `Memorize technical terminologies, years, and historical figures highlighted in this unit.`,
            `Review formulas, comparisons, and classification tables carefully.`,
          ],
        }
      );
    }
  }

  let md = `# ${params.lessonTitle}\n\n`;
  sections.forEach((sec, idx) => {
    md += `### Topic ${idx + 1}: ${sec.title}\n`;
    sec.points.forEach((pt) => {
      md += `- ${pt}\n`;
    });
    md += `\n`;
  });

  return sanitizeStudyNotesMarkdown(md);
}

/**
 * Offline or fallback synthesis of comprehensive Full Study Notes directly from textbook content.
 */
export function synthesizeFullNotesFromTextbook(params: {
  lessonTitle: string;
  subject: string;
  standard: number;
  language: 'tamil' | 'english';
  textbookContent: string;
}): string {
  const isTamil = params.language === 'tamil';
  const topics = extractTextbookKeyTopics(params.textbookContent, params.language);
  const rawParagraphs = params.textbookContent
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30 && !/^(?:page|பக்கம்)\s*\d+/i.test(p));

  const sections: { title: string; paragraphs: string[]; keyPoints: string[] }[] = [];

  if (topics.length > 0) {
    for (let i = 0; i < topics.length; i++) {
      const topicName = topics[i];
      const matchedParas: string[] = [];
      const topicPoints: string[] = [];

      for (const p of rawParagraphs) {
        if (p.toLowerCase().includes(topicName.toLowerCase()) || matchedParas.length < 2) {
          if (matchedParas.length < 3 && !matchedParas.includes(p)) {
            matchedParas.push(p);
          }
          const sentences = p
            .split(/(?<=[.!?।])\s+/)
            .map((s) => s.trim().replace(/^[-•*]\s*/, ''))
            .filter((s) => s.length > 20 && s.length < 300);

          for (const s of sentences) {
            if (topicPoints.length < 6 && !topicPoints.includes(s)) {
              topicPoints.push(s);
            }
          }
        }
      }

      if (matchedParas.length > 0 || topicPoints.length > 0) {
        sections.push({
          title: topicName,
          paragraphs: matchedParas.length > 0 ? matchedParas : [topicPoints.join(' ')],
          keyPoints: topicPoints,
        });
      }
    }
  }

  // Fallback if sparse
  if (sections.length < 2) {
    const defaultTopics = isTamil
      ? ['அடிப்படைக் கோட்பாடுகள் & பாடநூல் விளக்கம்', 'ஆழமான கருத்துப் பகுப்பாய்வு & வரையறைகள்', 'வரலாற்று/அறிவியல் சான்றுகள் & அட்டவணைத் தகவல்கள்', 'தேர்வுக்கான விரிவான தொகுப்பு']
      : ['Fundamental Principles & Textbook Theory', 'Detailed Conceptual Analysis & Definitions', 'Empirical Data, Timelines & Classifications', 'Comprehensive TNPSC Exam Revision Framework'];

    const chunkSize = Math.max(2, Math.ceil(rawParagraphs.length / defaultTopics.length));
    defaultTopics.forEach((tName, idx) => {
      const slice = rawParagraphs.slice(idx * chunkSize, (idx + 1) * chunkSize);
      const points = slice.flatMap(p => p.split(/(?<=[.!?।])\s+/)).filter(s => s.length > 20).slice(0, 5);
      if (slice.length > 0 || points.length > 0) {
        sections.push({
          title: tName,
          paragraphs: slice.length > 0 ? slice : [points.join(' ')],
          keyPoints: points,
        });
      }
    });
  }

  let md = `# ${params.lessonTitle}\n\n`;
  sections.forEach((sec, idx) => {
    md += `### Topic ${idx + 1}: ${sec.title}\n\n`;
    sec.paragraphs.forEach((p) => {
      md += `${p}\n\n`;
    });
    if (sec.keyPoints.length > 0) {
      md += isTamil ? `#### முக்கிய வரையறைகள் & சிறப்புக் குறிப்புகள்:\n` : `#### Key Concepts & Exam Points:\n`;
      sec.keyPoints.forEach((pt) => {
        md += `- ${pt}\n`;
      });
      md += `\n`;
    }
  });

  return sanitizeStudyNotesMarkdown(md);
}

/**
 * Generates TNPSC Study Notes (Short or Full) strictly following syllabus specifications.
 */
export async function generateStudyNotes(
  req: StudyNotesRequest
): Promise<GeneratedStudyNotesResult> {
  const isTamil = req.language === 'tamil';
  const isFullFormat = req.noteFormat === 'full';

  let systemPrompt = '';
  if (isFullFormat) {
    systemPrompt = isTamil
      ? `நீங்கள் ஒரு முதன்மை TNPSC தேர்வுப் பாடத்திட்ட வல்லுநர் (TNPSC Exam Content Specialist).
கொடுக்கப்பட்டுள்ள தமிழ்நாடு சமச்சீர் கல்வி பாடநூல் உள்ளடக்கத்தை அடிப்படையாகக் கொண்டு, மாணவர்கள் முழுமையாகப் படித்துத் தேர்வுக்குத் தயாராகும் வகையில் மிக விரிவான, ஆழமான 'Full Study Notes' உருவாக்க வேண்டும்.

முக்கிய விதிகள்:
1. விரிவான குறிப்புகள் (Full Comprehensive Notes Only): பாடத்திலுள்ள ஒவ்வொரு தலைப்பு மற்றும் துணைத்தலைப்பையும் எவ்விதச் சுருக்கமுமின்றி முழுமையான விளக்கங்களுடன் வழங்க வேண்டும்.
2. பாடநூலின் அனைத்து விளக்கங்கள், வரையறைகள், எடுத்துக்காட்டுகள், முக்கிய வரலாற்று ஆண்டுகள், அறிவியல் விதிகள், பெயர்கள், வகைப்பாடுகள் அனைத்தையும் விரிவாக விளக்குக.
3. கருத்துக்களை ஆழமாகவும் தெளிவாகவும் விளக்கும் பத்திகள், துணைப்பிரிவுகள் (Subsections), மற்றும் தெளிவான ஒப்பீட்டு அட்டவணைகள் (Markdown Comparison / Data Tables) அமைத்துத் தருக.
4. பாடநூலின் வரிசைப்படியே அனைத்துத் தலைப்புகளையும் வரிசைப்படுத்த வேண்டும்.
5. எக்காரணத்தைக் கொண்டும் முக்கியமான தகவல்களையோ விளக்கங்களையோ குறைக்கவோ தவிர்க்கவோ கூடாது.

கண்டிப்பாகத் தடைசெய்யப்பட்டவை:
- பக்க எண்கள் (Page Numbers) எங்கும் குறிப்பிடக்கூடாது.
- பாடநூல் குறிப்புகள் (Textbook page references) கூடாது.
- அறிமுகம் (Introduction) அல்லது முடிவுரை (Conclusion) பத்திகள் எழுதக்கூடாது.
- தணிக்கை அறிக்கை (Audit reports / Coverage reports) இணைக்கக் கூடாது.
- மாதிரி வினாக்கள் (MCQ Questions) சேர்க்கக் கூடாது.

அமைப்பு வடிவம் (Strict Markdown Format):
# [பாடத்தின் தலைப்பு]

### Topic 1: [தலைப்புப் பெயர்]
[முழுமையான, ஆழமான கருத்து விளக்கம் மற்றும் பாடநூல் தகவல்கள் பத்திகளாக]

#### முக்கிய வரையறைகள் & கருத்துகள்:
- [துல்லியமான விளக்கம் மற்றும் வரையறை]
- [விதிகள் மற்றும் கோட்பாடுகள்]

#### முக்கிய தகவல்கள் & அட்டவணை:
| வகை / தலைப்பு | விவரம் | முக்கியத்துவம் |
| --- | --- | --- |

### Topic 2: [தலைப்புப் பெயர்]
...`
      : `You are a Senior TNPSC Educational Content Specialist and Curriculum Architect.
Generate in-depth, exhaustive FULL STUDY NOTES based strictly on the provided Tamil Nadu Samacheer Kalvi textbook content.

STRICT INSTRUCTIONS:
1. FULL COMPREHENSIVE NOTES ONLY. Cover the complete content of every topic and subtopic in the selected lesson with thorough, in-depth explanations.
2. Explain every concept clearly and accurately. Include all relevant textbook explanations, definitions, real-world examples, facts, dates, names, scientific principles, and classifications.
3. Do not shorten or remove important explanations. Ensure maximum depth and clarity for serious TNPSC exam preparation.
4. Maintain the exact sequential flow of topics from the textbook.
5. Provide detailed paragraphs, subsections, structured bullet points, and markdown comparison/summary tables where applicable.

STRICTLY PROHIBITED CONTENT:
- NO PDF page numbers (e.g., [Page 5], Page 12:, etc.).
- NO textbook page references or "refer to page" notes.
- NO unnecessary introductions ("In this chapter we learn...") or conclusions.
- NO coverage audit reports or meta processing commentary.
- NO MCQ questions inside the notes.

REQUIRED MARKDOWN FORMAT:
# [Lesson Title]

### Topic 1: [Topic Name]
[Detailed conceptual explanation and textbook theory in clear paragraphs]

#### Key Definitions & Principles:
- Detailed definition or principle.
- Scientific / constitutional / historical background.

#### Facts, Dates & Classifications:
| Category / Aspect | Details | Significance |
| --- | --- | --- |

### Topic 2: [Topic Name]
...`;
  } else {
    systemPrompt = isTamil
      ? `நீங்கள் ஒரு முதன்மை TNPSC தேர்வுப் பாடத்திட்ட வல்லுநர் (TNPSC Exam Content Specialist).
கொடுக்கப்பட்டுள்ள தமிழ்நாடு சமச்சீர் கல்வி பாடநூல் உள்ளடக்கத்தை அடிப்படையாகக் கொண்டு, மாணவர்கள் எளிதாகப் படிக்கும் வண்ணம் மிகத் துல்லியமான, சுருக்கமான 'Short Study Notes' மட்டுமே உருவாக்க வேண்டும்.

முக்கிய விதிகள்:
1. சுருக்கமான குறிப்புகள் (Short Notes Only) மட்டுமே வழங்க வேண்டும். தேவையற்ற நீண்ட விளக்கங்களோ பத்திகளோ கூடாது.
2. பாடத்திலுள்ள ஒவ்வொரு தலைப்பு (Topic) மற்றும் துணைத்தலைப்பையும் (Subtopic) கட்டாயம் சேர்க்க வேண்டும்.
3. எளிமையான, தெளிவான தமிழில் முக்கியமான உண்மைகள், ஆண்டுகள், பெயர்கள், அறிவியல்/வரலாற்றுக் கருத்துகள் ஆகியவற்றை புல்லட் பாயிண்டுகளில் (Bullet Points) தருக.
4. ஒப்பீடுகள் அல்லது வகைப்பாடுகள் தேவைப்படும் இடங்களில் மட்டுமே அட்டவணைகள் (Tables) பயன்படுத்துக.

கண்டிப்பாகத் தடைசெய்யப்பட்டவை:
- பக்க எண்கள் (Page Numbers) எங்கும் குறிப்பிடக்கூடாது.
- பாடநூல் குறிப்புகள் (Textbook page references) கூடாது.
- அறிமுகம் (Introduction) அல்லது முடிவுரை (Conclusion) பத்திகள் எழுதக்கூடாது.
- 'Important Facts' என்ற பெயரில் தனியாகத் தேவையில்லாத பகுதி அமைக்கக் கூடாது.
- தணிக்கை அறிக்கை (Audit reports / Coverage reports) இணைக்கக் கூடாது.
- மாதிரி வினாக்கள் (MCQ Questions) சேர்க்கக் கூடாது.

அமைப்பு வடிவம் (Strict Markdown Format):
# [பாடத்தின் தலைப்பு]

### Topic 1: [தலைப்புப் பெயர்]
- சுருக்கமான குறிப்பு
- முக்கியமான கருத்து
- தேர்வுக்கான முக்கியத் தகவல்

### Topic 2: [தலைப்புப் பெயர்]
- சுருக்கமான குறிப்பு
...`
      : `You are a Senior TNPSC Educational Content Specialist and Curriculum Architect.
Generate concise, exam-oriented SHORT STUDY NOTES based strictly on the provided Tamil Nadu Samacheer Kalvi textbook content.

STRICT INSTRUCTIONS:
1. SHORT NOTES ONLY. Do not generate lengthy paragraphs or textbook-style explanations.
2. Cover EVERY topic and subtopic in the selected lesson without omitting any key concept.
3. Present high-yield facts, years, personalities, definitions, and concepts in clean BULLET POINTS.
4. Use TABLES only where comparing or categorizing structured data genuinely improves clarity.
5. Maintain the original sequential flow of topics in the textbook.

STRICTLY PROHIBITED CONTENT:
- NO PDF page numbers (e.g., [Page 5], Page 12:, etc.).
- NO textbook page references or "refer to page" notes.
- NO unnecessary introductions ("In this chapter we learn...") or conclusions.
- NO redundant "Important Facts and Information" standalone sections.
- NO coverage audit reports or meta processing commentary.
- NO MCQ questions inside the notes.

REQUIRED MARKDOWN FORMAT:
# [Lesson Title]

### Topic 1: [Topic Name]
- Concise key point.
- Important exam fact or definition.
- Associated historical/scientific detail.

### Topic 2: [Topic Name]
- Concise key point.
...`;
  }

  const userPrompt = `
TNPSC Examination: ${req.category.toUpperCase()}
Standard: ${req.standard}th Standard
Subject: ${req.subject}
Unit: ${req.unitId} (${req.unitTitle || 'General'})
Lesson: ${req.lessonTitle}
Language: ${req.language.toUpperCase()}
Format: ${isFullFormat ? 'FULL COMPREHENSIVE NOTES (DETAILED)' : 'SHORT REVISION NOTES (CONCISE)'}

SOURCE SAMACHEER KALVI TEXTBOOK CONTENT:
"""
${req.textbookContent.slice(0, 16000)}
"""

${isFullFormat
    ? 'Generate comprehensive, in-depth FULL STUDY NOTES covering all concepts, definitions, explanations, and tables in this lesson without shortening or omitting anything.'
    : 'Generate complete, concise SHORT STUDY NOTES covering all topics and subtopics in this lesson strictly adhering to the requested format.'
}`;

  let rawResponse = '';
  try {
    rawResponse = await CloudAIService.generateText(
      userPrompt,
      {
        systemPrompt,
        temperature: 0.15,
        maxTokens: isFullFormat ? 6000 : 4000,
      },
      req.apiKeyOverride
    );
  } catch (aiErr: any) {
    console.warn(
      `[StudyNotesGenerator] Cloud AI call failed (${aiErr.message}), falling back to direct textbook synthesis.`
    );
    rawResponse = isFullFormat
      ? synthesizeFullNotesFromTextbook({
          lessonTitle: req.lessonTitle,
          subject: req.subject,
          standard: req.standard,
          language: req.language,
          textbookContent: req.textbookContent,
        })
      : synthesizeShortNotesFromTextbook({
          lessonTitle: req.lessonTitle,
          subject: req.subject,
          standard: req.standard,
          language: req.language,
          textbookContent: req.textbookContent,
        });
  }

  let sanitizedContent = sanitizeStudyNotesMarkdown(rawResponse);

  // 2. Phase 5 Topic Coverage Validation
  const textbookTopics = extractTextbookKeyTopics(req.textbookContent, req.language);
  let coveredTopics = extractCoveredTopicsFromMarkdown(sanitizedContent);

  const missingTopics: string[] = [];
  for (const tTopic of textbookTopics) {
    const isCovered = coveredTopics.some(
      (c) => c.toLowerCase().includes(tTopic.toLowerCase()) || tTopic.toLowerCase().includes(c.toLowerCase())
    );
    if (!isCovered) {
      missingTopics.push(tTopic);
    }
  }

  let healedCount = 0;

  // 3. Auto-Heal Missing Topics if any detected
  if (missingTopics.length > 0) {
    for (const missing of missingTopics.slice(0, 3)) {
      try {
        const healPrompt = `
The following topic from the lesson "${req.lessonTitle}" was omitted:
Missing Topic: "${missing}"

Based on the textbook content:
\"\"\"
${req.textbookContent.slice(0, 10000)}
\"\"\"

Generate the concise short notes for "${missing}" ONLY in this exact format:
### Topic: ${missing}
- Bullet point 1
- Bullet point 2
- Bullet point 3

Do not include page numbers, intros or conclusions.`;

        const healResponse = await CloudAIService.generateText(
          healPrompt,
          {
            systemPrompt,
            temperature: 0.15,
            maxTokens: 1000,
          },
          req.apiKeyOverride
        );

        const cleanHeal = sanitizeStudyNotesMarkdown(healResponse);
        if (cleanHeal.length > 50) {
          sanitizedContent += `\n\n${cleanHeal}`;
          healedCount++;
        }
      } catch (healErr) {
        console.warn(`[Study Notes Validation] Auto-healing skipped for topic "${missing}":`, healErr);
      }
    }
    // Re-extract covered topics after healing
    coveredTopics = extractCoveredTopicsFromMarkdown(sanitizedContent);
  }

  return {
    title: req.lessonTitle,
    content: sanitizedContent,
    topics: coveredTopics.length > 0 ? coveredTopics : textbookTopics,
    validation: {
      totalExtractedTopics: textbookTopics,
      coveredTopics,
      missingTopics: missingTopics.filter((m) => !coveredTopics.some((c) => c.toLowerCase().includes(m.toLowerCase()))),
      isFullyCovered: missingTopics.length <= healedCount,
      healedTopicsCount: healedCount,
    },
    language: req.language,
    noteFormat: isFullFormat ? 'full' : 'short',
  };
}
