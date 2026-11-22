/**
 * MCQ Question Generation & Strict Duplicate Prevention Service
 * Generates exam-oriented TNPSC MCQs with:
 * - Exactly 4 distinct options (A, B, C, D)
 * - 1 verified correct answer index (0..3)
 * - Clear explanation & difficulty
 * - Multi-level semantic deduplication against existing PostgreSQL records and current batch
 * - Replacement generation loop for rejected or duplicate questions
 */

import pool from '../db';
import { SchemaType } from '@google/generative-ai';
import { CloudAIService } from './cloudAi/cloudAiService';
import { AIProviderFactory } from './ai/ai-provider.factory';
import { AIProviderName } from './ai/ai-provider.interface';
import { GeminiJsonParseError } from './ai/providers/gemini/gemini.validator';
import {
  checkQuestionDuplicate,
  computeConceptFingerprint,
  computeNormalizedQuestionHash,
  extractLessonTopicChecklist,
  isValidQuestionText,
  normalizeText,
  parsePdfPagePassages,
  resolveCorrectAnswerIndex,
  verifyQuestionAgainstSourcePdf,
  ExistingDbQuestionRecord,
  Difficulty,
} from './questionValidator';
import { cleanTamilUnicodeText } from './tamilUnicodeCleaner';
import { randomizeQuestionOptions } from './ai/shared/option-randomizer';
import { OptionKey } from './ai/shared/mcq-schema';

export interface McqGenerationRequest {
  provider?: AIProviderName;
  category: string;
  standard: number;
  subject: string;
  term?: string;
  volume?: string;
  textbookName?: string;
  textbookSubject?: string;
  sourcePdf?: string;
  sourcePages?: number[];
  unitId: number;
  unitTitle?: string;
  lessonTitle: string;
  lessonId?: string;
  lessonNumber?: string;
  topic?: string;
  selectedTopics?: string[];
  language: 'tamil' | 'english';
  count: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Mixed';
  textbookContent: string;
  textbookId?: number;
}

export interface GeneratedMcqItem {
  id?: number;
  category: string;
  standard: number;
  subject: string;
  unitId: number;
  lessonTitle: string;
  lessonId?: string | null;
  topic?: string;
  difficulty: Difficulty;
  question: string;
  options: string[];
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: number;
  correctAnswerText: string;
  explanation: string;
  language: 'tamil' | 'english';
  textbookId?: number | null;
  term?: string | null;
  volume?: string | null;
  sourcePdf?: string | null;
  sourcePage?: number | null;
  lessonNumber?: string | null;
  status: 'staging' | 'published';
  targetSystem: 'study_materials';
  aiProvider?: 'claude' | 'gemini' | 'openai';
  normalizedQuestionHash?: string;
  conceptFingerprint?: string;
  duplicateCheckStatus?: 'passed';
  generationBatchId?: string | null;
}

export interface TopicCoverageAudit {
  totalTopics: number;
  coveredTopics: string[];
  uncoveredTopics: string[];
  coveragePercent: number;
  coverageLimitedByCount: boolean;
  limitationNote: string | null;
}

export interface McqGenerationResult {
  questions: GeneratedMcqItem[];
  requestedCount: number;
  generatedCount: number;
  duplicateCount: number;
  reverseQuestionRejectedCount: number;
  unsupportedRejectedCount: number;
  invalidCount: number;
  coverageAudit: TopicCoverageAudit;
}

/**
 * Fetches existing questions from PostgreSQL across ALL sessions, batches, and groups
 * for this textbook/lesson so duplicate & reverse-question checks persist across sessions.
 */
async function fetchExistingDbQuestions(params: {
  category: string;
  lessonTitle: string;
  lessonId?: string;
  standard: number;
  subject: string;
  unitId: number;
  textbookId?: number;
}): Promise<ExistingDbQuestionRecord[]> {
  try {
    const cleanTitle = String(params.lessonTitle || '').trim();
    const res = await pool.query(
      `SELECT question_text, options, correct_answer, option_a, option_b, option_c, option_d
       FROM questions
       WHERE status IN ('staging', 'published')
         AND (
           ($1::int IS NOT NULL AND textbook_id = $1 AND (LOWER(TRIM(lesson_title)) = LOWER($2) OR ($3::text IS NOT NULL AND lesson_id = $3)))
           OR ($3::text IS NOT NULL AND lesson_id = $3)
           OR (LOWER(TRIM(lesson_title)) = LOWER($2) AND (class_id = $4 OR standard_id = $4 OR LOWER(TRIM(category)) = LOWER($5)))
         )
       ORDER BY created_at DESC
       LIMIT 1000`,
      [
        params.textbookId ?? null,
        cleanTitle,
        params.lessonId || null,
        Number(params.standard) || 6,
        String(params.category || '').trim(),
      ]
    );

    return res.rows.map((row: any) => {
      let optText: string | undefined;
      const idx = typeof row.correct_answer === 'number' ? row.correct_answer : Number(row.correct_answer);
      if (Array.isArray(row.options) && Number.isInteger(idx) && idx >= 0 && idx <= 3) {
        optText = String(row.options[idx] || '');
      } else if (Number.isInteger(idx) && idx >= 0 && idx <= 3) {
        const fallbackOpts = [row.option_a, row.option_b, row.option_c, row.option_d];
        optText = fallbackOpts[idx] ? String(fallbackOpts[idx]) : undefined;
      }
      return {
        question: row.question_text,
        correctAnswerText: optText,
      };
    });
  } catch (err) {
    console.warn('[MCQ Deduplication] Could not fetch DB questions for deduplication:', err);
    return [];
  }
}

/**
 * Validates a single question item against quality and formatting rules.
 */
export function validateMcqItem(rawQ: any): { valid: boolean; question?: GeneratedMcqItem; reason?: string } {
  const rawText = cleanTamilUnicodeText(String(rawQ.question || rawQ.question_text || '')).trim();
  const qVal = isValidQuestionText(rawText);
  if (!qVal.valid) {
    return { valid: false, reason: qVal.reason };
  }

  let optionsList: string[] = [];
  if (Array.isArray(rawQ.options) && rawQ.options.length >= 4) {
    optionsList = rawQ.options.slice(0, 4).map((o: any) => cleanTamilUnicodeText(String(o || '')).trim());
  } else if (rawQ.optionA && rawQ.optionB && rawQ.optionC && rawQ.optionD) {
    optionsList = [
      cleanTamilUnicodeText(String(rawQ.optionA)).trim(),
      cleanTamilUnicodeText(String(rawQ.optionB)).trim(),
      cleanTamilUnicodeText(String(rawQ.optionC)).trim(),
      cleanTamilUnicodeText(String(rawQ.optionD)).trim(),
    ];
  }

  if (optionsList.length !== 4 || optionsList.some((o) => o.length === 0)) {
    return { valid: false, reason: 'Must have exactly 4 non-empty options.' };
  }

  // Check for duplicate options (e.g. Option A equals Option B)
  const uniqueOptions = new Set(optionsList.map((o) => o.toLowerCase()));
  if (uniqueOptions.size < 4) {
    return { valid: false, reason: 'Duplicate options detected within question.' };
  }

  const rawCorrect = rawQ.correctAnswer !== undefined ? rawQ.correctAnswer : rawQ.correct_answer;
  if (rawCorrect === undefined || rawCorrect === null || rawCorrect === '') {
    return { valid: false, reason: 'Missing correct answer.' };
  }
  const correctIdx = resolveCorrectAnswerIndex(rawCorrect, optionsList);
  if (correctIdx < 0 || correctIdx > 3) {
    return { valid: false, reason: 'Correct answer does not match any of the four options.' };
  }

  const rawExplanation = cleanTamilUnicodeText(String(rawQ.explanation || '')).trim();
  const explanation = rawExplanation || `சரியான விடை: ${optionsList[correctIdx]}`;

  let diff: Difficulty = 'Medium';
  const rawDiff = String(rawQ.difficulty || '').toLowerCase();
  if (rawDiff === 'easy') diff = 'Easy';
  else if (rawDiff === 'hard') diff = 'Hard';

  return {
    valid: true,
    question: {
      category: rawQ.category || 'group4',
      standard: Number(rawQ.standard) || 6,
      subject: rawQ.subject || 'General Studies',
      unitId: Number(rawQ.unitId) || 1,
      lessonTitle: rawQ.lessonTitle || '',
      lessonId: rawQ.lessonId || null,
      topic: rawQ.topic || rawQ.lessonTitle || null,
      difficulty: diff,
      question: rawText,
      options: optionsList,
      optionA: optionsList[0],
      optionB: optionsList[1],
      optionC: optionsList[2],
      optionD: optionsList[3],
      correctAnswer: correctIdx,
      correctAnswerText: optionsList[correctIdx],
      explanation,
      language: rawQ.language || 'tamil',
      textbookId: rawQ.textbookId || null,
      status: 'staging',
      targetSystem: 'study_materials',
    },
  };
}

export const MCQ_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    questions: {
      type: SchemaType.ARRAY,
      description: 'List of TNPSC Multiple Choice Questions',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          question: {
            type: SchemaType.STRING,
            description: 'Clear, complete MCQ question stem',
          },
          options: {
            type: SchemaType.ARRAY,
            description: 'Exactly 4 distinct answer options (A, B, C, D)',
            items: {
              type: SchemaType.STRING,
            },
          },
          correctAnswer: {
            type: SchemaType.INTEGER,
            description: 'Zero-based index of the correct option: 0, 1, 2, or 3',
          },
          explanation: {
            type: SchemaType.STRING,
            description: 'Concise factual explanation grounded in the source textbook',
          },
          difficulty: {
            type: SchemaType.STRING,
            description: 'Easy, Medium, or Hard',
          },
          subject: {
            type: SchemaType.STRING,
            description: 'TNPSC subject name',
          },
          topic: {
            type: SchemaType.STRING,
            description: 'Specific lesson topic or subtopic from the Topic Coverage Checklist',
          },
          sourcePage: {
            type: SchemaType.INTEGER,
            description: 'Exact PDF page number from the [PDF Page N] markers where this fact appears',
          },
        },
        required: ['question', 'options', 'correctAnswer', 'explanation', 'topic'],
      },
    },
  },
  required: ['questions'],
};

/**
 * Generates exam-standard MCQs strictly grounded in Samacheer Kalvi textbook content.
 */
export async function generateMcqs(
  req: McqGenerationRequest,
  onProgress?: (progressPct: number, message: string) => void
): Promise<McqGenerationResult> {
  const isTamil = req.language === 'tamil';
  const targetCount = Math.max(5, Math.min(200, req.count || 20));
  const hasSourceText = (req.textbookContent || '').trim().length >= 50;

  if (!hasSourceText) {
    throw new Error(
      'No verified lesson PDF content is available. Select a processed textbook lesson before generating MCQs.'
    );
  }

  // STEP 1–4: Parse original PDF passages & build internal Topic Coverage Checklist
  const pdfPassages = parsePdfPagePassages(req.textbookContent, req.sourcePages);
  const topicChecklist = extractLessonTopicChecklist(req.textbookContent, req.selectedTopics);
  const effectiveChecklist =
    topicChecklist.length > 0
      ? topicChecklist
      : req.selectedTopics && req.selectedTopics.length > 0
      ? req.selectedTopics
      : [req.topic || req.lessonTitle];

  // STEP 5: Fetch ALL existing DB questions across sessions/batches for persistent duplicate & reverse checks
  onProgress?.(10, 'Fetching existing questions from database for duplicate & reverse-question prevention...');
  const existingDbQuestions = await fetchExistingDbQuestions({
    category: req.category,
    lessonTitle: req.lessonTitle,
    lessonId: req.lessonId,
    standard: req.standard,
    subject: req.subject,
    unitId: req.unitId,
    textbookId: req.textbookId,
  });

  const acceptedQuestions: GeneratedMcqItem[] = [];
  const coveredTopicsSet = new Set<string>();
  let totalDuplicatesDetected = 0;
  let totalReverseQuestionsRejected = 0;
  let totalUnsupportedRejected = 0;
  let totalInvalidDetected = 0;
  let lastError: Error | null = null;

  const markTopicCovered = (topicStr: string | undefined, questionText: string) => {
    const qNorm = normalizeText(`${topicStr || ''} ${questionText}`);
    for (const checklistTopic of effectiveChecklist) {
      const tNorm = normalizeText(checklistTopic);
      if (!tNorm) continue;
      if (qNorm.includes(tNorm) || (topicStr && normalizeText(topicStr) === tNorm)) {
        coveredTopicsSet.add(checklistTopic);
      } else {
        const tWords = tNorm.split(' ').filter((w) => w.length >= 4);
        if (tWords.length > 0 && tWords.some((w) => qNorm.includes(w))) {
          coveredTopicsSet.add(checklistTopic);
        }
      }
    }
  };

  const systemPrompt = isTamil
    ? `நீங்கள் ஒரு TNPSC தேர்வு வினாத்தாள் வடிவமைப்பாளர் (TNPSC Exam Question Author).
கொடுக்கப்பட்டுள்ள தமிழ்நாடு சமச்சீர் கல்வி பாடநூல் PDF உள்ளடக்கத்தை மட்டுமே அடிப்படையாகக் கொண்டு, உயர்தர கொள்குறி வினாக்களை (Multiple Choice Questions) JSON வடிவில் வழங்க வேண்டும்.

கண்டிப்பான விதிகள்:
1. கொடுக்கப்பட்ட PDF பாடநூல் உள்ளடக்கத்தில் உள்ள உண்மைகளை மட்டுமே பயன்படுத்த வேண்டும். வெளிப்புற இணையதளங்கள், பொது அறிவு அல்லது கற்பனைத் தகவல்களை ஒருபோதும் சேர்க்கக் கூடாது.
2. ஒவ்வொரு வினாவிற்கும் 4 தனித்துவமான விடைகள் (Options A, B, C, D) மற்றும் ஒரே ஒரு சரியான விடை (0, 1, 2, அல்லது 3) இருக்க வேண்டும்.
3. ஒவ்வொரு வினாவிற்கும் பாடநூல் ஆதாரத்துடன் கூடிய விளக்கவுரை (Explanation) மற்றும் [PDF Page N] பக்க எண் (sourcePage) அவசியம்.
4. ஒரே வினாவையோ அல்லது ஒரே கருத்தைச் சோதிக்கும் வினாவையோ மீண்டும் உருவாக்கக் கூடாது.
5. மிக முக்கியம் — எதிர்மாறு வினாக்கள் (Reverse Questions) தடை: ஏற்கனவே உருவாக்கப்பட்ட வினாவின் விடையை எடுத்து, அதை புதிய வினாவாக மாற்றி (எ.கா: "நீளத்தின் SI அலகு என்ன? -> மீட்டர்" என்பதற்கு பதிலாக "மீட்டரில் அளக்கப்படும் இயற்பியல் அளவு எது? -> நீளம்") ஒருபோதும் உருவாக்கக் கூடாது.
6. கொடுக்கப்பட்ட தலைப்புப் பட்டியலில் (Topic Coverage Checklist) உள்ள அனைத்து முக்கிய தலைப்புகளையும் சமமாக உள்ளடக்க வேண்டும்.
7. JSON அமைப்பில் மட்டுமே விடையளிக்க வேண்டும்: { "questions": [ { "question": "...", "options": ["...","...","...","..."], "correctAnswer": 0, "explanation": "...", "difficulty": "Medium", "topic": "...", "sourcePage": 12 } ] }`
    : `You are a Senior TNPSC Examination MCQ Item Writer and Psychometrician.
Generate high-quality, syllabus-grounded TNPSC Multiple Choice Questions STRICTLY and EXCLUSIVELY from the provided Samacheer Kalvi textbook PDF text.

STRICT RULES:
1. PDF-ONLY SOURCE OF TRUTH: Use ONLY facts, definitions, dates, names, and numbers explicitly present in the provided PDF text. NEVER use external knowledge or invent facts.
2. FORMAT: Every question MUST have a clear interrogative stem ending with '?', exactly 4 distinct non-empty options (A, B, C, D), exactly 1 unambiguous correct answer index (0..3), 3 meaningful distractors, a PDF-supported explanation, topic label, and exact sourcePage integer from the [PDF Page N] markers.
3. COMPLETE TOPIC COVERAGE: Systematically cover ALL topics in the Topic Coverage Checklist. Do not cluster multiple questions on one topic while skipping others.
4. STRICT DUPLICATE PREVENTION: NEVER generate exact duplicates, paraphrased duplicates, or repeated-concept questions against existing questions or within the batch.
5. STRICT REVERSE QUESTION PROHIBITION: NEVER create a new question by turning a previous question's answer into a new question stem (e.g., if Q1 asks "What is the SI unit of length?" -> "Metre", NEVER ask "Which physical quantity is measured in metres?" -> "Length"). Generate every question directly from fresh, unused facts in the original PDF.
6. Output ONLY valid JSON: { "questions": [ { "question": "...", "options": ["...","...","...","..."], "correctAnswer": 0, "explanation": "...", "difficulty": "Medium", "topic": "...", "sourcePage": 12 } ] }`;

  // Generate in bounded batches to prevent token truncation and stay within serverless timeouts
  let batchSize = req.provider === 'gemini' ? Math.min(12, targetCount) : Math.min(20, targetCount);
  let attempts = 0;
  const maxAttempts = Math.ceil(targetCount / Math.max(5, batchSize)) * 3 + 2;

  while (acceptedQuestions.length < targetCount && attempts < maxAttempts) {
    attempts++;
    const needed = targetCount - acceptedQuestions.length;
    const extraBuffer =
      attempts > 1 && (totalDuplicatesDetected > 0 || totalInvalidDetected > 0 || totalUnsupportedRejected > 0)
        ? 2
        : 0;
    const currentBatchCount = Math.min(batchSize, needed + extraBuffer);

    const progressPct = Math.min(90, Math.round(20 + (acceptedQuestions.length / targetCount) * 70));
    onProgress?.(
      progressPct,
      `Generating & validating PDF-grounded batch (${acceptedQuestions.length}/${targetCount} approved)...`
    );

    const uncoveredTopics = effectiveChecklist.filter((t) => !coveredTopicsSet.has(t));
    const priorityTopics = uncoveredTopics.length > 0 ? uncoveredTopics : effectiveChecklist;

    // Provide compact list of already-used concepts (DB + current batch) to prevent duplicates & reverse questions
    const alreadyUsedSamples = [
      ...existingDbQuestions.slice(0, 25).map((q) => `- ${q.question}${q.correctAnswerText ? ` [Ans: ${q.correctAnswerText}]` : ''}`),
      ...acceptedQuestions.slice(-25).map((q) => `- ${q.question} [Ans: ${q.correctAnswerText}]`),
    ].slice(0, 40);

    const prompt = `
TNPSC Examination: ${req.category.toUpperCase()}
Standard: ${req.standard}th Standard
Subject: ${req.subject}${req.textbookSubject && req.textbookSubject !== req.subject ? ` (textbook subject: ${req.textbookSubject})` : ''}
Term: ${req.term || 'Not applicable'}
Volume: ${req.volume || 'Not applicable'}
Unit: ${req.unitId} (${req.unitTitle || 'General'})
Lesson: ${req.lessonTitle}${req.lessonNumber ? ` (Lesson ${req.lessonNumber})` : ''}
Textbook: ${req.textbookName || req.sourcePdf || 'Processed PDF'}
Source pages: ${req.sourcePages && req.sourcePages.length > 0 ? req.sourcePages.join(', ') : 'Indexed lesson pages'}
Language: ${req.language.toUpperCase()}
Difficulty Preference: ${req.difficulty}
Requested Question Count for this batch: ${currentBatchCount}

TOPIC COVERAGE CHECKLIST (prioritize these UNCOVERED topics from the PDF):
${priorityTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}
${
  alreadyUsedSamples.length > 0
    ? `\nALREADY COVERED QUESTIONS & ANSWERS (STRICTLY DO NOT REPEAT, PARAPHRASE, OR REVERSE-GENERATE FROM THESE ANSWERS):\n${alreadyUsedSamples.join('\n')}\n`
    : ''
}
SOURCE TEXTBOOK PDF CONTENT (the ONLY permitted factual source):
"""
${req.textbookContent.slice(0, 24000)}
"""

Generate ${currentBatchCount} distinct, PDF-verified MCQs directly from UNUSED facts in the source textbook content above, systematically covering the priority topics in the checklist.
NEVER reverse a previous answer into a new question. Include the exact integer "sourcePage" from the [PDF Page N] marker for each question.
If the source PDF does not contain enough distinct unused facts, return fewer questions rather than inventing or repeating facts.
Respond strictly in JSON:
{
  "questions": [
    {
      "question": "Clear question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Concise explanation directly supported by the PDF.",
      "difficulty": "Medium",
      "topic": "${priorityTopics[0] || req.topic || req.lessonTitle}",
      "sourcePage": ${req.sourcePages?.[0] ?? pdfPassages[0]?.pageNumber ?? 1}
    }
  ]
}`;

    const aiProvider = AIProviderFactory.getProvider(req.provider || 'claude');
    try {
      const response = await aiProvider.generateJson<any>(
        prompt,
        {
          systemPrompt,
          temperature: 0.2,
          maxTokens: 8192,
          responseFormat: 'json',
          ...(req.provider === 'gemini' ? { responseSchema: MCQ_RESPONSE_SCHEMA } : {}),
        }
      );

      const rawList = Array.isArray(response?.questions)
        ? response.questions
        : Array.isArray(response)
        ? response
        : [];

      for (const item of rawList) {
        if (acceptedQuestions.length >= targetCount) break;

        const val = validateMcqItem({
          ...item,
          category: req.category,
          standard: req.standard,
          subject: req.subject,
          unitId: req.unitId,
          lessonTitle: req.lessonTitle,
          lessonId: req.lessonId,
          language: req.language,
          textbookId: req.textbookId,
        });

        if (!val.valid || !val.question) {
          totalInvalidDetected++;
          continue;
        }

        const candidate = val.question;
        candidate.textbookId = req.textbookId ?? null;
        candidate.term = req.term ?? null;
        candidate.volume = req.volume ?? null;
        candidate.sourcePdf = req.sourcePdf ?? req.textbookName ?? null;
        candidate.lessonNumber = req.lessonNumber ?? null;
        if (!candidate.topic || candidate.topic === 'General' || candidate.topic === req.lessonTitle) {
          candidate.topic = priorityTopics[acceptedQuestions.length % priorityTopics.length] || req.topic || req.lessonTitle;
        }

        // STEP 7: Exact, semantic, AND reverse-question duplicate check against current batch + DB history
        const dupCheck = checkQuestionDuplicate(
          candidate.question,
          acceptedQuestions.map((q) => ({ question: q.question, correctAnswerText: q.correctAnswerText })),
          existingDbQuestions,
          candidate.correctAnswerText
        );

        if (dupCheck.isDuplicate) {
          totalDuplicatesDetected++;
          if (dupCheck.reason === 'REVERSE_QUESTION') {
            totalReverseQuestionsRejected++;
          }
          continue;
        }

        // STEP 8: Validate correct answer & explanation strictly against original PDF passages & attribute exact page
        const aiSuggestedPage =
          item.sourcePage != null && Number.isFinite(Number(item.sourcePage)) ? Number(item.sourcePage) : null;
        const pdfVerification = verifyQuestionAgainstSourcePdf({
          question: candidate.question,
          options: candidate.options,
          correctAnswerIdx: candidate.correctAnswer,
          explanation: candidate.explanation,
          passages: pdfPassages,
          aiSuggestedPage,
        });

        if (!pdfVerification.supported) {
          totalUnsupportedRejected++;
          totalInvalidDetected++;
          continue;
        }

        candidate.sourcePage = pdfVerification.verifiedPage ?? req.sourcePages?.[0] ?? null;
        candidate.normalizedQuestionHash = computeNormalizedQuestionHash(candidate.question);
        candidate.conceptFingerprint = computeConceptFingerprint(candidate.question, candidate.correctAnswerText);
        candidate.duplicateCheckStatus = 'passed';

        markTopicCovered(candidate.topic, candidate.question);
        acceptedQuestions.push(candidate);
      }
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err?.message || err));
      console.error(`[MCQ Generation] Batch attempt ${attempts} failed:`, lastError.message);
      if (err instanceof GeminiJsonParseError || /invalid JSON/i.test(lastError.message)) {
        batchSize = Math.max(5, Math.floor(batchSize / 2));
      }
    }
  }

  if (acceptedQuestions.length === 0) {
    const provName = req.provider === 'gemini' ? 'Google Gemini AI' : 'Anthropic Claude AI';
    throw new Error(
      lastError
        ? `${provName} could not generate valid questions: ${lastError.message}`
        : `${provName} did not return any valid questions. Please try again.`
    );
  }

  onProgress?.(95, 'Finalizing server-side option randomization & quality review...');

  // Apply Server-Side Option Randomizer & Distribution Balancing (Part 5)
  const randomizedQuestions: GeneratedMcqItem[] = [];
  const counts: Record<OptionKey, number> = { A: 0, B: 0, C: 0, D: 0 };
  let lastPos: OptionKey | null = null;
  let streak = 0;

  for (const q of acceptedQuestions) {
    const candidates = (['A', 'B', 'C', 'D'] as OptionKey[]).sort((a, b) => counts[a] - counts[b]);
    let filteredCandidates = candidates;
    if (streak >= 2 && lastPos) {
      filteredCandidates = candidates.filter((k) => k !== lastPos);
    }
    const preferred = (filteredCandidates[0] || 'B') as OptionKey;

    const randomized = randomizeQuestionOptions(
      [q.optionA, q.optionB, q.optionC, q.optionD],
      q.correctAnswer,
      preferred
    );

    const pos = randomized.correctAnswer;
    if (pos === lastPos) {
      streak++;
    } else {
      streak = 1;
      lastPos = pos;
    }
    counts[pos]++;

    randomizedQuestions.push({
      ...q,
      options: [randomized.options.A, randomized.options.B, randomized.options.C, randomized.options.D],
      optionA: randomized.options.A,
      optionB: randomized.options.B,
      optionC: randomized.options.C,
      optionD: randomized.options.D,
      correctAnswer: randomized.shuffledIndex,
      correctAnswerText: randomized.options[randomized.correctAnswer],
      aiProvider:
        (req.provider || 'claude').toLowerCase() === 'gemini'
          ? 'gemini'
          : (req.provider || 'claude').toLowerCase() === 'openai'
          ? 'openai'
          : 'claude',
    });
  }

  // STEP 9: Compute honest Topic Coverage Audit (never claim 100% unless uncoveredTopics is empty)
  const coveredTopics = effectiveChecklist.filter((t) => coveredTopicsSet.has(t));
  const uncoveredTopics = effectiveChecklist.filter((t) => !coveredTopicsSet.has(t));
  const coveragePercent =
    effectiveChecklist.length > 0
      ? Math.round((coveredTopics.length / effectiveChecklist.length) * 100)
      : 0;
  const coverageLimitedByCount = targetCount < effectiveChecklist.length && uncoveredTopics.length > 0;
  const limitationNote = coverageLimitedByCount
    ? `Requested ${targetCount} questions for ${effectiveChecklist.length} identified lesson topics; ${uncoveredTopics.length} topic(s) could not be covered within the requested count.`
    : uncoveredTopics.length > 0
    ? `${uncoveredTopics.length} of ${effectiveChecklist.length} lesson topics were not covered in this batch.`
    : null;

  return {
    questions: randomizedQuestions,
    requestedCount: targetCount,
    generatedCount: randomizedQuestions.length,
    duplicateCount: totalDuplicatesDetected,
    reverseQuestionRejectedCount: totalReverseQuestionsRejected,
    unsupportedRejectedCount: totalUnsupportedRejected,
    invalidCount: totalInvalidDetected,
    coverageAudit: {
      totalTopics: effectiveChecklist.length,
      coveredTopics,
      uncoveredTopics,
      coveragePercent,
      coverageLimitedByCount,
      limitationNote,
    },
  };
}

