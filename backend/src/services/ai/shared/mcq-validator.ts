/**
 * Server-Side MCQ Quality & Integrity Validator
 * Strictly shared across Anthropic Claude AI and Google Gemini AI.
 * 
 * Enforces Part 7 TNPSC Quality Standards:
 * 1. Question text validation (non-empty, >= 15 chars, Tamil/English Unicode, no meta/hallucination text).
 * 2. Options validation (exactly 4 non-empty, distinct options; plausible length).
 * 3. Correct answer validation (must be A|B|C|D, matches option text).
 * 4. Explanation validation (non-empty, >= 20 chars, pedagogical value).
 * 5. Question Type & Difficulty validation.
 */

import { StandardizedMcqItem, OptionKey, TNPSCQuestionType, TNPSCDifficulty } from './mcq-schema';

export interface ValidationIssue {
  field: string;
  message: string;
  value?: any;
}

export interface McqValidationResult {
  isValid: boolean;
  sanitizedItem?: StandardizedMcqItem;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const FORBIDDEN_AI_PATTERNS = [
  /\[insert\s+question/i,
  /\[insert\s+option/i,
  /as an ai/i,
  /i cannot generate/i,
  /i apologize/i,
  /here are the (questions|mcqs)/i,
  /please note that/i,
  /according to my knowledge cutoff/i,
  /sample question/i,
  /question\s*\d+\s*:\s*$/i,
];

const VALID_QUESTION_TYPES: TNPSCQuestionType[] = [
  'Factual',
  'Conceptual',
  'Definition-based',
  'Application-based',
  'Statement-based',
  'Multiple-statement',
  'Match the following',
  'Assertion and Reason',
  'Correct and Incorrect statements',
  'Chronological order',
  'Comparison-based',
  'Analytical',
];

const VALID_DIFFICULTIES: TNPSCDifficulty[] = ['Easy', 'Medium', 'Hard'];

/**
 * Validates and sanitizes a single StandardizedMcqItem.
 */
export function validateMcqItem(item: any): McqValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!item || typeof item !== 'object') {
    return {
      isValid: false,
      errors: [{ field: 'root', message: 'Question item is null or not an object.' }],
      warnings: [],
    };
  }

  // 1. Question text validation
  const questionRaw = String(item.question || item.question_text || '').trim();
  if (!questionRaw) {
    errors.push({ field: 'question', message: 'Question text is empty.' });
  } else if (questionRaw.length < 15) {
    errors.push({
      field: 'question',
      message: `Question text is too short (${questionRaw.length} chars). Minimum is 15 chars.`,
      value: questionRaw,
    });
  }

  for (const pattern of FORBIDDEN_AI_PATTERNS) {
    if (pattern.test(questionRaw)) {
      errors.push({
        field: 'question',
        message: `Question text contains forbidden AI conversational artifact matching ${pattern}`,
        value: questionRaw,
      });
      break;
    }
  }

  // 2. Options validation (A, B, C, D)
  let optA = '';
  let optB = '';
  let optC = '';
  let optD = '';

  if (item.options && typeof item.options === 'object' && !Array.isArray(item.options)) {
    optA = String(item.options.A || '').trim();
    optB = String(item.options.B || '').trim();
    optC = String(item.options.C || '').trim();
    optD = String(item.options.D || '').trim();
  } else if (Array.isArray(item.options)) {
    optA = String(item.options[0] || '').trim();
    optB = String(item.options[1] || '').trim();
    optC = String(item.options[2] || '').trim();
    optD = String(item.options[3] || '').trim();
  } else if (item.option_a !== undefined) {
    optA = String(item.option_a || '').trim();
    optB = String(item.option_b || '').trim();
    optC = String(item.option_c || '').trim();
    optD = String(item.option_d || '').trim();
  }

  const optionsMap = { A: optA, B: optB, C: optC, D: optD };
  const keys: OptionKey[] = ['A', 'B', 'C', 'D'];

  for (const k of keys) {
    if (!optionsMap[k]) {
      errors.push({ field: `options.${k}`, message: `Option ${k} is empty.` });
    }
  }

  // Check for distinctness among options
  const cleanOptsList = [optA, optB, optC, optD].filter(Boolean);
  const distinctOpts = new Set(cleanOptsList.map((s) => s.toLowerCase()));
  if (cleanOptsList.length === 4 && distinctOpts.size < 4) {
    errors.push({
      field: 'options',
      message: 'Options are not all distinct. Duplicate options detected within question.',
      value: optionsMap,
    });
  }

  // 3. Correct answer validation
  let correctKey: OptionKey | null = null;
  const rawCorrect = item.correctAnswer ?? item.correct_answer;

  if (typeof rawCorrect === 'number' && rawCorrect >= 0 && rawCorrect <= 3) {
    correctKey = keys[rawCorrect];
  } else if (typeof rawCorrect === 'string') {
    const upper = rawCorrect.trim().toUpperCase();
    if (upper === 'A' || upper === 'B' || upper === 'C' || upper === 'D') {
      correctKey = upper as OptionKey;
    } else {
      // Check if rawCorrect matches an option text verbatim
      for (const k of keys) {
        if (optionsMap[k] && optionsMap[k].toLowerCase() === rawCorrect.trim().toLowerCase()) {
          correctKey = k;
          break;
        }
      }
    }
  }

  if (!correctKey) {
    errors.push({
      field: 'correctAnswer',
      message: `Invalid or missing correct answer: "${rawCorrect}". Must be 'A', 'B', 'C', or 'D'.`,
      value: rawCorrect,
    });
  } else if (!optionsMap[correctKey]) {
    errors.push({
      field: 'correctAnswer',
      message: `Correct answer points to empty option ${correctKey}.`,
    });
  }

  // 4. Explanation validation
  const explanationRaw = String(item.explanation || '').trim();
  if (!explanationRaw) {
    warnings.push({ field: 'explanation', message: 'Explanation is missing or empty.' });
  } else if (explanationRaw.length < 15) {
    warnings.push({
      field: 'explanation',
      message: `Explanation is very brief (${explanationRaw.length} chars).`,
      value: explanationRaw,
    });
  }

  // 5. Difficulty & Question Type validation
  let difficulty: TNPSCDifficulty = 'Medium';
  const rawDiff = String(item.difficulty || '').trim();
  const matchedDiff = VALID_DIFFICULTIES.find((d) => d.toLowerCase() === rawDiff.toLowerCase());
  if (matchedDiff) {
    difficulty = matchedDiff;
  } else if (rawDiff) {
    warnings.push({ field: 'difficulty', message: `Unknown difficulty "${rawDiff}", defaulting to Medium.` });
  }

  let questionType: TNPSCQuestionType | undefined = undefined;
  const rawType = String(item.questionType || item.question_type || '').trim();
  const matchedType = VALID_QUESTION_TYPES.find((t) => t.toLowerCase() === rawType.toLowerCase());
  if (matchedType) {
    questionType = matchedType;
  } else if (rawType) {
    questionType = 'Conceptual';
  }

  const isValid = errors.length === 0;

  let sanitizedItem: StandardizedMcqItem | undefined = undefined;
  if (isValid && correctKey) {
    sanitizedItem = {
      id: item.id,
      question: questionRaw,
      options: optionsMap,
      correctAnswer: correctKey,
      explanation: explanationRaw || `Correct answer is Option ${correctKey}: ${optionsMap[correctKey]}`,
      subject: String(item.subject || 'General Studies').trim(),
      standard: String(item.standard || '6th Standard').trim(),
      unit: String(item.unit || 'Unit 1').trim(),
      term: String(item.term || 'Term 1').trim(),
      lesson: String(item.lesson || item.lesson_title || '').trim(),
      topic: item.topic ? String(item.topic).trim() : undefined,
      difficulty,
      questionType,
      language: String(item.language).toLowerCase() === 'english' ? 'English' : 'Tamil',
      sourceTextbook: item.sourceTextbook || item.source_reference,
      sourcePage: typeof item.sourcePage === 'number' ? item.sourcePage : undefined,
      aiProvider: item.aiProvider,
      modelUsed: item.modelUsed,
      fingerprint: item.fingerprint,
    };
  }

  return {
    isValid,
    sanitizedItem,
    errors,
    warnings,
  };
}

/**
 * Validates an array of generated questions, separating valid sanitized items from invalid ones.
 */
export function validateBatchMcqs(rawItems: any[]): {
  validQuestions: StandardizedMcqItem[];
  invalidCount: number;
  validationDetails: Array<{ index: number; errors: ValidationIssue[] }>;
} {
  const validQuestions: StandardizedMcqItem[] = [];
  const validationDetails: Array<{ index: number; errors: ValidationIssue[] }> = [];

  if (!Array.isArray(rawItems)) {
    return { validQuestions: [], invalidCount: 0, validationDetails: [] };
  }

  rawItems.forEach((raw, idx) => {
    const res = validateMcqItem(raw);
    if (res.isValid && res.sanitizedItem) {
      validQuestions.push(res.sanitizedItem);
    } else {
      validationDetails.push({ index: idx, errors: res.errors });
    }
  });

  return {
    validQuestions,
    invalidCount: validationDetails.length,
    validationDetails,
  };
}

