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
import { CloudAIService } from './cloudAi/cloudAiService';
import { AIProviderFactory } from './ai/ai-provider.factory';
import { AIProviderName } from './ai/ai-provider.interface';
import {
  isSemanticallyDuplicate,
  isValidQuestionText,
  resolveCorrectAnswerIndex,
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
  aiProvider?: 'claude' | 'gemini';
}

export interface McqGenerationResult {
  questions: GeneratedMcqItem[];
  requestedCount: number;
  generatedCount: number;
  duplicateCount: number;
  invalidCount: number;
}

/**
 * Fetches existing questions from PostgreSQL for deduplication comparison.
 */
async function fetchExistingDbQuestions(
  category: string,
  lessonTitle: string,
  subject: string,
  unitId: number
): Promise<ExistingDbQuestionRecord[]> {
  try {
    const res = await pool.query(
      `SELECT question_text, options, correct_answer
       FROM questions
       WHERE LOWER(TRIM(lesson_title)) = LOWER(TRIM($1)) AND LOWER(TRIM(category)) = LOWER(TRIM($2))
       LIMIT 500`,
      [lessonTitle, category]
    );

    return res.rows.map((row: any) => {
      let optText: string | undefined;
      if (Array.isArray(row.options) && typeof row.correct_answer === 'number') {
        optText = row.options[row.correct_answer];
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

  // 1. Fetch DB existing questions for strict semantic duplicate detection
  onProgress?.(10, 'Fetching existing questions from database for duplicate prevention...');
  const existingDbQuestions = await fetchExistingDbQuestions(
    req.category,
    req.lessonTitle,
    req.subject,
    req.unitId
  );

  const acceptedQuestions: GeneratedMcqItem[] = [];
  let totalDuplicatesDetected = 0;
  let totalInvalidDetected = 0;
  let lastError: Error | null = null;

  const systemPrompt = isTamil
    ? `நீங்கள் ஒரு TNPSC தேர்வு வினாத்தாள் வடிவமைப்பாளர் (TNPSC Exam Question Author).
கொடுக்கப்பட்டுள்ள தமிழ்நாடு சமச்சீர் கல்வி பாடநூல் உள்ளடக்கத்தை அடிப்படையாகக் கொண்டு, உயர்தர கொள்குறி வினாக்களை (Multiple Choice Questions) JSON வடிவில் மட்டுமே வழங்க வேண்டும்.

கண்டிப்பான விதிகள்:
1. வினாக்கள் தேர்வு நோக்கில், சிந்திக்கத் தூண்டும் வகையில் அமைய வேண்டும்.
2. ஒவ்வொரு வினாவிற்கும் 4 தனித்துவமான விடைகள் (Options A, B, C, D) இருக்க வேண்டும்.
3. சரியான விடைக்குரிய குறியீடு 0, 1, 2, அல்லது 3 என இருக்க வேண்டும்.
4. ஒவ்வொரு வினாவிற்கும் தெளிவான விளக்கவுரை (Explanation) அவசியம்.
5. ஒரே வினாவையோ அல்லது ஒரே உண்மையைச் சோதிக்கும் வினாவையோ மாற்றி மாற்றி மீண்டும் உருவாக்கக் கூடாது.
6. கொடுக்கப்பட்ட பாடநூல் உள்ளடக்கத்தில் உள்ள தகவல்களை மட்டுமே ஆதாரமாகப் பயன்படுத்த வேண்டும். அதில் இல்லாத உண்மைகளைக் கற்பனை செய்யக் கூடாது.
7. ஒவ்வொரு வினாவையும் கொடுக்கப்பட்ட பாடம், பகுதி, பாடத்தலைப்பு மற்றும் தலைப்புடன் இணைக்க வேண்டும்.
8. JSON அமைப்பில் மட்டுமே விடையளிக்க வேண்டும்: { "questions": [ { "question": "...", "options": ["...","...","...","..."], "correctAnswer": 0, "explanation": "...", "difficulty": "Medium", "subject": "...", "topic": "..." } ] }`
    : `You are a Senior TNPSC Examination MCQ Item Writer and Psychometrician.
Generate high-quality, syllabus-grounded TNPSC Multiple Choice Questions strictly based on the provided Samacheer Kalvi textbook text.

STRICT INSTRUCTIONS:
1. Questions must test factual understanding, application, definitions, chronological events, and core concepts.
2. Each question MUST have exactly four distinct options (A, B, C, D).
3. Exactly one unambiguous correct answer index (0, 1, 2, or 3).
4. Provide a clear, factual explanation explaining why the correct answer is right.
5. NEVER repeat questions or test the exact same fact with slightly varied phrasing.
6. Use ONLY the provided source textbook content as factual evidence. Do not invent facts not supported by it.
7. Map every question to the given subject, unit, lesson, and topic.
8. Output ONLY valid JSON: { "questions": [ { "question": "...", "options": ["...","...","...","..."], "correctAnswer": 0, "explanation": "...", "difficulty": "Medium", "subject": "...", "topic": "..." } ] }`;

  // We generate in batches (e.g. 15-25 per request) to prevent token truncation
  const batchSize = Math.min(25, targetCount);
  let attempts = 0;
  const maxAttempts = Math.ceil(targetCount / batchSize) * 3 + 1;

  while (acceptedQuestions.length < targetCount && attempts < maxAttempts) {
    attempts++;
    const needed = targetCount - acceptedQuestions.length;
    const currentBatchCount = Math.min(batchSize, needed + 5);

    const progressPct = Math.min(90, Math.round(20 + (acceptedQuestions.length / targetCount) * 70));
    onProgress?.(
      progressPct,
      `Generating questions batch (${acceptedQuestions.length}/${targetCount} approved)...`
    );

    const prompt = `
TNPSC Examination: ${req.category.toUpperCase()}
Standard: ${req.standard}th Standard
Subject: ${req.subject}${req.textbookSubject && req.textbookSubject !== req.subject ? ` (textbook subject: ${req.textbookSubject})` : ''}
Unit: ${req.unitId} (${req.unitTitle || 'General'})
Lesson: ${req.lessonTitle}${req.lessonNumber ? ` (Lesson ${req.lessonNumber})` : ''}
${req.selectedTopics && req.selectedTopics.length > 0 ? `Selected Lesson Topics/Subtopics to focus on:\n${req.selectedTopics.map((t) => `- ${t}`).join('\n')}\n` : ''}Textbook: ${req.textbookName || req.sourcePdf || 'Processed PDF'}
Term: ${req.term || 'Not applicable'}
Volume: ${req.volume || 'Not applicable'}
Source pages: ${req.sourcePages && req.sourcePages.length > 0 ? req.sourcePages.join(', ') : 'Indexed lesson pages'}
Language: ${req.language.toUpperCase()}
Difficulty Preference: ${req.difficulty}
Requested Question Count: ${currentBatchCount}

SOURCE TEXTBOOK CONTENT (the ONLY permitted factual source):
"""
${req.textbookContent.slice(0, 24000)}
"""

Generate ${currentBatchCount} distinct, high-quality MCQs covering different sections, facts, personalities, definitions, and concepts in this lesson${req.selectedTopics && req.selectedTopics.length > 0 ? ', strictly emphasizing the selected topics/subtopics above' : ''}.
Every question and explanation must be supportable from the source text above. If the text is insufficient, return fewer questions instead of inventing facts.
Respond strictly in JSON:
{
  "questions": [
    {
      "question": "Clear question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Concise explanation.",
      "difficulty": "Medium",
      "topic": "${req.selectedTopics?.[0] || req.topic || req.lessonTitle}"
    }
  ]
}`;

    const aiProvider = AIProviderFactory.getProvider(req.provider || 'claude');
    try {
      const response = await aiProvider.generateJson<any>(
        prompt,
        {
          systemPrompt,
          temperature: 0.25,
          maxTokens: 6000,
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
        candidate.sourcePage = req.sourcePages?.[0] ?? null;
        candidate.lessonNumber = req.lessonNumber ?? null;
        if (!candidate.topic || candidate.topic === 'General' || candidate.topic === req.lessonTitle) {
          candidate.topic = (req.selectedTopics && req.selectedTopics.length > 0)
            ? req.selectedTopics[acceptedQuestions.length % req.selectedTopics.length]
            : (req.topic || req.lessonTitle);
        }

        // Multi-level deduplication:
        // Level 1: Against questions already accepted in current run
        // Level 2: Against existing PostgreSQL questions for this lesson/category
        const isDuplicate = isSemanticallyDuplicate(
          candidate.question,
          acceptedQuestions.map((q) => ({ question: q.question, correctAnswerText: q.correctAnswerText })),
          existingDbQuestions,
          candidate.correctAnswerText
        );

        if (isDuplicate) {
          totalDuplicatesDetected++;
          continue;
        }

        acceptedQuestions.push(candidate);
      }
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err?.message || err));
      console.error(`[MCQ Generation] Batch attempt ${attempts} failed:`, lastError.message);
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
      aiProvider: (req.provider || 'claude').toLowerCase() === 'gemini' ? 'gemini' : 'claude',
    });
  }

  return {
    questions: randomizedQuestions,
    requestedCount: targetCount,
    generatedCount: randomizedQuestions.length,
    duplicateCount: totalDuplicatesDetected,
    invalidCount: totalInvalidDetected,
  };
}

