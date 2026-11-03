/**
 * Server-Side Option Randomizer & Distribution Engine
 * Strictly shared across Anthropic Claude AI and Google Gemini AI.
 * 
 * Requirements:
 * 1. Shuffles options A, B, C, and D using Fisher-Yates algorithm.
 * 2. Distributes correct answers across all four positions (A, B, C, D).
 * 3. Never leaves correct answers permanently in Option A.
 * 4. Updates correctAnswer key ('A'|'B'|'C'|'D') after every shuffle.
 * 5. Strict post-shuffle assertion: options[correctAnswer] MUST match the original correct answer text verbatim.
 * 6. Avoids predictable streaks (max 2 consecutive same answer position).
 */

import { OptionKey, McqOptionsMap, StandardizedMcqItem } from './mcq-schema';

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];

export interface ShuffleResult {
  options: McqOptionsMap;
  correctAnswer: OptionKey;
  shuffledIndex: number;
}

/**
 * Shuffles an array in-place using Fisher-Yates with optional target position steering.
 */
function fisherYatesShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Randomizes options for a single question item while strictly preserving the correct answer.
 */
export function randomizeQuestionOptions(
  options: McqOptionsMap | string[],
  currentCorrect: OptionKey | number | string,
  preferredPosition?: OptionKey
): ShuffleResult {
  // 1. Normalize input options array
  let optsArr: string[] = [];
  if (Array.isArray(options)) {
    optsArr = options.slice(0, 4).map((s) => String(s || '').trim());
  } else {
    optsArr = [options.A, options.B, options.C, options.D].map((s) => String(s || '').trim());
  }

  if (optsArr.length !== 4) {
    throw new Error('Option randomizer requires exactly 4 options to shuffle.');
  }

  // 2. Identify the original correct answer text
  let originalCorrectText = '';
  if (typeof currentCorrect === 'number' && currentCorrect >= 0 && currentCorrect <= 3) {
    originalCorrectText = optsArr[currentCorrect];
  } else {
    const cleanKey = String(currentCorrect || '').trim().toUpperCase();
    if (cleanKey === 'A') originalCorrectText = optsArr[0];
    else if (cleanKey === 'B') originalCorrectText = optsArr[1];
    else if (cleanKey === 'C') originalCorrectText = optsArr[2];
    else if (cleanKey === 'D') originalCorrectText = optsArr[3];
    else {
      // Find matching option text directly
      const match = optsArr.find((o) => o.toLowerCase() === String(currentCorrect).toLowerCase().trim());
      originalCorrectText = match || optsArr[0];
    }
  }

  if (!originalCorrectText) {
    originalCorrectText = optsArr[0];
  }

  // 3. Perform shuffle
  let shuffled = fisherYatesShuffle(optsArr);

  // If a preferred position is specified to balance distribution across batch
  if (preferredPosition) {
    const targetIdx = OPTION_KEYS.indexOf(preferredPosition);
    const currIdx = shuffled.indexOf(originalCorrectText);
    if (currIdx !== -1 && targetIdx !== -1 && currIdx !== targetIdx) {
      [shuffled[currIdx], shuffled[targetIdx]] = [shuffled[targetIdx], shuffled[currIdx]];
    }
  }

  // 4. Determine new correct answer key
  const newIndex = shuffled.indexOf(originalCorrectText);
  if (newIndex === -1) {
    throw new Error('Fatal integrity error in option randomizer: correct answer text lost during shuffle.');
  }

  const newKey: OptionKey = OPTION_KEYS[newIndex];
  const newOptions: McqOptionsMap = {
    A: shuffled[0],
    B: shuffled[1],
    C: shuffled[2],
    D: shuffled[3],
  };

  // 5. Strict post-shuffle validation assertion
  if (newOptions[newKey] !== originalCorrectText) {
    throw new Error(
      `Post-shuffle validation failed: options[${newKey}] ("${newOptions[newKey]}") does not equal original correct text ("${originalCorrectText}").`
    );
  }

  return {
    options: newOptions,
    correctAnswer: newKey,
    shuffledIndex: newIndex,
  };
}

/**
 * Randomizes a batch of questions, guaranteeing even answer distribution across A, B, C, D
 * and eliminating predictable streaks (no more than 2 in a row with the same correct letter).
 */
export function randomizeBatchOptions(questions: StandardizedMcqItem[]): StandardizedMcqItem[] {
  if (!questions || questions.length === 0) return [];

  // Distribution counters to ensure balanced A, B, C, D across the batch
  const counts: Record<OptionKey, number> = { A: 0, B: 0, C: 0, D: 0 };
  let lastKey: OptionKey | null = null;
  let streak = 0;

  return questions.map((q) => {
    // Choose preferred position: the one with lowest count that doesn't cause a 3-streak
    let candidates = [...OPTION_KEYS].sort((a, b) => counts[a] - counts[b]);
    if (streak >= 2 && lastKey) {
      candidates = candidates.filter((k) => k !== lastKey);
    }
    const preferred = candidates[0] || 'B';

    const result = randomizeQuestionOptions(q.options, q.correctAnswer, preferred);

    if (result.correctAnswer === lastKey) {
      streak++;
    } else {
      streak = 1;
      lastKey = result.correctAnswer;
    }
    counts[result.correctAnswer]++;

    return {
      ...q,
      options: result.options,
      correctAnswer: result.correctAnswer,
    };
  });
}

