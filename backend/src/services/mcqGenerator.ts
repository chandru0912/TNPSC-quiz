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
  computeConceptFingerprint,
  computeNormalizedQuestionHash,
  extractLessonTopicChecklist,
  isValidQuestionText,
  normalizeText,
  parsePdfPagePassages,
  resolveCorrectAnswerIndex,
  ExistingDbQuestionRecord,
  Difficulty,
} from './questionValidator';
import {
  auditMcqQuality,
  QualityScoreBreakdown,
} from './mcqQualityAuditor';
import { cleanTamilUnicodeText } from './tamilUnicodeCleaner';
import { randomizeQuestionOptions } from './ai/shared/option-randomizer';
import { OptionKey } from './ai/shared/mcq-schema';

export interface DifficultyDistribution {
  easy: number;      // default 15%
  moderate: number;  // Medium — default 35%
  difficult: number; // Hard — default 35%
  advanced: number;  // default 15%
}

export const DEFAULT_DIFFICULTY_DISTRIBUTION: DifficultyDistribution = {
  easy: 15,
  moderate: 35,
  difficult: 35,
  advanced: 15,
};

export interface McqGenerationRequest {
  provider?: AIProviderName;
  modelId?: string;
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
  difficulty: 'Easy' | 'Medium' | 'Moderate' | 'Hard' | 'Difficult' | 'Advanced' | 'Mixed';
  difficultyDistribution?: Partial<DifficultyDistribution>;
  minQualityScore?: number;
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
  modelId?: string | null;
  questionType?: string;
  qualityScore?: number;
  qualityBreakdown?: QualityScoreBreakdown;
  validationStatus?: 'verified' | 'rejected';
  normalizedQuestionHash?: string;
  conceptFingerprint?: string;
  duplicateCheckStatus?: 'passed';
  generationBatchId?: string | null;
}

export interface QualityAuditSummary {
  minAcceptanceScore: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  acceptedCount: number;
  rejectedLowQualityCount: number;
  rejectedDuplicateCount: number;
  rejectedReverseCount: number;
  rejectedUnsupportedCount: number;
  difficultyCounts: Record<string, number>;
  patternCounts: Record<string, number>;
  rejectedSamples: Array<{ question: string; score: number; reasons: string[] }>;
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
  totalAttemptedGenerated: number;
  generatedCount: number;
  shortfallCount: number;
  insufficientSourceWarning: string | null;
  duplicateCount: number;
  reverseQuestionRejectedCount: number;
  unsupportedRejectedCount: number;
  lowQualityRejectedCount: number;
  invalidCount: number;
  coverageAudit: TopicCoverageAudit;
  qualityReport: QualityAuditSummary;
  estimatedTokens: { inputChars: number; outputChars: number };
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

  let diff: Difficulty = 'Moderate';
  const rawDiff = String(rawQ.difficulty || '').toLowerCase().trim();
  if (rawDiff === 'easy') diff = 'Easy';
  else if (rawDiff === 'advanced') diff = 'Advanced';
  else if (rawDiff === 'hard' || rawDiff === 'difficult') diff = 'Difficult';
  else if (rawDiff === 'medium' || rawDiff === 'moderate') diff = 'Moderate';

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
            description: 'Easy, Moderate, Difficult, or Advanced',
          },
          questionType: {
            type: SchemaType.STRING,
            description: 'TNPSC pattern: Conceptual, Analytical, Logical Application, Statement-Based, Assertion-Reason, Match the Following, Cause and Effect, Comparison, Scientific Principle, Situation-Based, Correct/Incorrect Statement, or Multi-Concept',
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
  const rejectedSamples: Array<{ question: string; score: number; reasons: string[] }> = [];
  const minQualityScore = Math.max(60, Math.min(95, Number(req.minQualityScore ?? 85)));

  // Normalize configurable difficulty distribution (Default: Easy 15%, Medium 35%, Hard 35%, Advanced 15%)
  const dist: DifficultyDistribution = {
    easy: req.difficultyDistribution?.easy ?? DEFAULT_DIFFICULTY_DISTRIBUTION.easy,
    moderate: req.difficultyDistribution?.moderate ?? DEFAULT_DIFFICULTY_DISTRIBUTION.moderate,
    difficult: req.difficultyDistribution?.difficult ?? DEFAULT_DIFFICULTY_DISTRIBUTION.difficult,
    advanced: req.difficultyDistribution?.advanced ?? DEFAULT_DIFFICULTY_DISTRIBUTION.advanced,
  };
  const distSum = Math.max(1, dist.easy + dist.moderate + dist.difficult + dist.advanced);
  const targetEasy = Math.round((dist.easy / distSum) * targetCount);
  const targetModerate = Math.round((dist.moderate / distSum) * targetCount);
  const targetDifficult = Math.round((dist.difficult / distSum) * targetCount);
  const targetAdvanced = Math.max(0, targetCount - targetEasy - targetModerate - targetDifficult);

  let totalAttemptedGenerated = 0;
  let totalDuplicatesDetected = 0;
  let totalReverseQuestionsRejected = 0;
  let totalUnsupportedRejected = 0;
  let totalLowQualityRejected = 0;
  let totalInvalidDetected = 0;
  let totalInputChars = 0;
  let totalOutputChars = 0;
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
    ? `நீங்கள் ஒரு மூத்த TNPSC போட்டித் தேர்வு வினாத்தாள் வடிவமைப்பாளர் (TNPSC Group 1/2/2A/4 Competitive Exam Author).
கொடுக்கப்பட்டுள்ள தமிழ்நாடு சமச்சீர் கல்வி பாடநூல் PDF உள்ளடக்கத்தை மட்டுமே அடிப்படையாகக் கொண்டு, போட்டித் தேர்வு தரத்திலான கொள்குறி வினாக்களை (MCQs) JSON வடிவில் வழங்க வேண்டும்.

கண்டிப்பான விதிகள்:
1. PDF மட்டுமே ஆதாரம்: கொடுக்கப்பட்ட PDF உள்ளடக்கத்தில் உள்ள உண்மைகளை மட்டுமே பயன்படுத்த வேண்டும். வெளிப்புற தகவல்கள் அல்லது கற்பனை உண்மைகள் கூடாது.
2. TNPSC போட்டித் தேர்வு தரம்: மிக எளிமையான ஒரு வரி வினாக்களைத் தவிர்த்து, கருத்துசார்ந்த (Conceptual), பகுப்பாய்வு (Analytical), கூற்று-காரணம் (Assertion-Reason), கூற்று அடிப்படையிலான (Statement-Based), பொருத்துக (Match the Following), காரணம்-விளைவு (Cause & Effect), ஒப்பீடு (Comparison), அறிவியல் தத்துவம் (Scientific Principle), சூழ்நிலை அடிப்படையிலான (Situation-Based), சரியான/தவறான கூற்று வினாக்களை உருவாக்கவும்.
3. ஒவ்வொரு வினாவிற்கும் 4 தனித்துவமான மற்றும் சிந்திக்க வைக்கும் விடைகள் (A, B, C, D), ஒரே ஒரு சரியான விடை (0..3), பாடநூல் ஆதார விளக்கவுரை, topic, questionType, difficulty (Easy/Moderate/Difficult/Advanced), மற்றும் [PDF Page N] sourcePage எண் அவசியம்.
4. ஒரே வினாவையோ அல்லது ஒரே கருத்தைச் சோதிக்கும் வினாவையோ மீண்டும் உருவாக்கக் கூடாது.
5. எதிர்மாறு வினாக்கள் (Reverse Questions) தடை: ஏற்கனவே உருவாக்கப்பட்ட வினாவின் விடையை புதிய வினாவாக மாற்றக் கூடாது.
6. JSON மட்டுமே: { "questions": [ { "question": "...", "options": ["...","...","...","..."], "correctAnswer": 0, "explanation": "...", "difficulty": "Moderate", "questionType": "Analytical", "topic": "...", "sourcePage": 12 } ] }`
    : `You are a Senior TNPSC Competitive Examination MCQ Item Writer and Psychometrician (Group 1, Group 2, Group 2A, Group 4 standard).
Generate high-quality, conceptually rich TNPSC Multiple Choice Questions STRICTLY and EXCLUSIVELY from the provided Samacheer Kalvi textbook PDF text.

STRICT RULES:
1. PDF-ONLY SOURCE OF TRUTH (FACT-FIRST WORKFLOW): Follow strictly: PDF Content -> Source Fact Extraction -> Topic Identification -> Question Construction -> Option Generation -> Correct Answer Validation. NEVER generate a question by starting from an answer. Use ONLY facts, definitions, dates, names, and numbers explicitly present in the provided PDF text. NEVER invent facts.
2. TNPSC COMPETITIVE STANDARD: Generate a balanced mix of high-rigor TNPSC patterns: Conceptual, Analytical, Logical Application, Statement-Based, Assertion-Reason, Match the Following, Cause and Effect, Comparison, Chronological Ordering, Scientific Principle, Situation-Based, Correct/Incorrect Statement, and Multi-Concept questions. AVOID very basic one-line recall questions, obvious filler distractors, or lazy "All of the above" / "None of the above" unless genuinely required by statement analysis.
3. DIFFICULTY DISTRIBUTION & LANGUAGE QUALITY: Follow the requested Easy (15%) / Medium (35%) / Hard (35%) / Advanced (15%) distribution strictly within the selected syllabus. Maintain flawless English/Tamil grammar and subject terminology with zero unintended mixed-language artifacts.
4. FORMAT: Every question MUST have a clear interrogative stem ending with '?', 4 distinct plausible options (A, B, C, D), 1 unambiguous correctAnswer index (0..3), a detailed PDF-supported explanation, questionType, difficulty, topic label, and exact sourcePage integer from [PDF Page N].
5. STRICT DUPLICATE & REVERSE-QUESTION PROHIBITION: NEVER repeat or paraphrase existing questions, and NEVER create a new question by inverting a previous question's answer (e.g., Q1 "SI unit of length -> Metre" must NEVER spawn Q2 "Which quantity is measured in metres? -> Length").
6. Output ONLY valid JSON: { "questions": [ { "question": "...", "options": ["...","...","...","..."], "correctAnswer": 0, "explanation": "...", "difficulty": "Moderate", "questionType": "Statement-Based", "topic": "...", "sourcePage": 12 } ] }`;

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
Target Difficulty Distribution across full set (${targetCount} questions): Easy=${targetEasy} (${dist.easy}%), Moderate=${targetModerate} (${dist.moderate}%), Difficult=${targetDifficult} (${dist.difficult}%), Advanced=${targetAdvanced} (${dist.advanced}%)
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
    totalInputChars += prompt.length + systemPrompt.length;
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
      totalOutputChars += JSON.stringify(response || '').length;

      const rawList = Array.isArray(response?.questions)
        ? response.questions
        : Array.isArray(response)
        ? response
        : [];
      totalAttemptedGenerated += rawList.length;

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
        candidate.questionType = String(item.questionType || 'Conceptual').trim().slice(0, 60);
        candidate.modelId = req.modelId || null;
        if (!candidate.topic || candidate.topic === 'General' || candidate.topic === req.lessonTitle) {
          candidate.topic = priorityTopics[acceptedQuestions.length % priorityTopics.length] || req.topic || req.lessonTitle;
        }

        // INDEPENDENT AI QUALITY AUDITOR (10-dimension evidence-based scoring out of 100, min 80)
        // Evaluates: Syllabus Relevance, Textbook Accuracy, Conceptual Depth, Logical Reasoning,
        // TNPSC Suitability, Originality, Distractor Quality, Answer Accuracy, Duplicates, Reverse-Questions.
        const aiSuggestedPage =
          item.sourcePage != null && Number.isFinite(Number(item.sourcePage)) ? Number(item.sourcePage) : null;
        const audit = auditMcqQuality({
          question: candidate.question,
          options: candidate.options,
          correctAnswer: candidate.correctAnswer,
          explanation: candidate.explanation,
          difficulty: candidate.difficulty,
          questionType: candidate.questionType,
          topic: candidate.topic,
          category: req.category,
          subject: req.subject,
          lessonTitle: req.lessonTitle,
          aiSuggestedPage,
          passages: pdfPassages,
          existingBatch: acceptedQuestions.map((q) => ({ question: q.question, correctAnswerText: q.correctAnswerText })),
          existingDbQuestions,
          minAcceptanceScore: minQualityScore,
        });

        if (!audit.passed) {
          if (audit.breakdown.reverseQuestionDetection === 0) {
            totalDuplicatesDetected++;
            totalReverseQuestionsRejected++;
          } else if (audit.breakdown.duplicateDetection === 0) {
            totalDuplicatesDetected++;
          } else if (audit.breakdown.answerAccuracy < 8) {
            totalUnsupportedRejected++;
            totalInvalidDetected++;
          } else {
            totalLowQualityRejected++;
            totalInvalidDetected++;
          }
          if (rejectedSamples.length < 15) {
            rejectedSamples.push({
              question: candidate.question.slice(0, 140),
              score: audit.totalScore,
              reasons: audit.rejectionReasons,
            });
          }
          continue;
        }

        candidate.sourcePage = audit.verifiedPage ?? req.sourcePages?.[0] ?? null;
        candidate.qualityScore = audit.totalScore;
        candidate.qualityBreakdown = audit.breakdown;
        candidate.validationStatus = 'verified';
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

  const scores = randomizedQuestions.map((q) => Number(q.qualityScore || 0));
  const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
  const difficultyCounts: Record<string, number> = {};
  const patternCounts: Record<string, number> = {};
  for (const q of randomizedQuestions) {
    difficultyCounts[q.difficulty] = (difficultyCounts[q.difficulty] || 0) + 1;
    const pat = q.questionType || 'Conceptual';
    patternCounts[pat] = (patternCounts[pat] || 0) + 1;
  }

  const shortfallCount = Math.max(0, targetCount - randomizedQuestions.length);
  const insufficientSourceWarning =
    shortfallCount > 0
      ? `Insufficient distinct PDF source facts to generate all ${targetCount} verified questions at quality threshold ${minQualityScore}/100: ${randomizedQuestions.length} verified, ${shortfallCount} short (${totalDuplicatesDetected} duplicates, ${totalLowQualityRejected} low-quality, ${totalUnsupportedRejected} unsupported rejected).`
      : null;

  return {
    questions: randomizedQuestions,
    requestedCount: targetCount,
    totalAttemptedGenerated,
    generatedCount: randomizedQuestions.length,
    shortfallCount,
    insufficientSourceWarning,
    duplicateCount: totalDuplicatesDetected,
    reverseQuestionRejectedCount: totalReverseQuestionsRejected,
    unsupportedRejectedCount: totalUnsupportedRejected,
    lowQualityRejectedCount: totalLowQualityRejected,
    invalidCount: totalInvalidDetected,
    coverageAudit: {
      totalTopics: effectiveChecklist.length,
      coveredTopics,
      uncoveredTopics,
      coveragePercent,
      coverageLimitedByCount,
      limitationNote,
    },
    qualityReport: {
      minAcceptanceScore: minQualityScore,
      averageScore: avgScore,
      minScore,
      maxScore,
      acceptedCount: randomizedQuestions.length,
      rejectedLowQualityCount: totalLowQualityRejected,
      rejectedDuplicateCount: totalDuplicatesDetected,
      rejectedReverseCount: totalReverseQuestionsRejected,
      rejectedUnsupportedCount: totalUnsupportedRejected,
      difficultyCounts,
      patternCounts,
      rejectedSamples,
    },
    estimatedTokens: {
      inputChars: totalInputChars,
      outputChars: totalOutputChars,
    },
  };
}

