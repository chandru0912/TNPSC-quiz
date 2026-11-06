/**
 * Standardized TNPSC MCQ Output Schema & Database Mappers
 * Strictly shared across Anthropic Claude AI and Google Gemini AI.
 * Ensures 100% schema consistency with complete provider isolation.
 */

export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface McqOptionsMap {
  A: string;
  B: string;
  C: string;
  D: string;
}

export type TNPSCQuestionType =
  | 'Factual'
  | 'Conceptual'
  | 'Definition-based'
  | 'Application-based'
  | 'Statement-based'
  | 'Multiple-statement'
  | 'Match the following'
  | 'Assertion and Reason'
  | 'Correct and Incorrect statements'
  | 'Chronological order'
  | 'Comparison-based'
  | 'Analytical';

export type TNPSCDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface StandardizedMcqItem {
  id?: number;
  question: string;
  options: McqOptionsMap;
  correctAnswer: OptionKey;
  explanation: string;
  subject: string;
  standard: string;
  unit: string;
  term: string;
  lesson: string;
  topic?: string;
  difficulty: TNPSCDifficulty;
  questionType?: TNPSCQuestionType;
  language: 'Tamil' | 'English';
  sourceTextbook?: string;
  sourcePage?: number;
  aiProvider?: 'claude' | 'gemini' | 'openai';
  modelUsed?: string;
  fingerprint?: string;
}

export interface DatabaseQuestionPayload {
  category: string;
  unit_id: number;
  class_id: number;
  subject: string;
  lesson_title: string;
  lesson_id?: string | null;
  lesson_number?: string | null;
  topic?: string | null;
  difficulty: TNPSCDifficulty;
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  status: 'staging' | 'published';
  source_reference: string;
  source_page?: number | null;
  source_pdf?: string | null;
  language: 'tamil' | 'english';
  ai_provider: 'claude' | 'gemini' | 'openai';
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  term?: string | null;
  volume?: string | null;
  target_system: 'study_materials';
}

/**
 * Converts a validated and randomized StandardizedMcqItem into a PostgreSQL questions row payload.
 */
export function toDatabaseQuestionPayload(
  mcq: StandardizedMcqItem,
  meta: {
    category: string;
    classId: number;
    unitId: number;
    lessonId?: string | null;
    lessonNumber?: string | null;
    term?: string | null;
    volume?: string | null;
    sourcePdf?: string | null;
    status?: 'staging' | 'published';
  }
): DatabaseQuestionPayload {
  const optionsArr = [mcq.options.A, mcq.options.B, mcq.options.C, mcq.options.D];
  const correctIdx = mcq.correctAnswer === 'A' ? 0 : mcq.correctAnswer === 'B' ? 1 : mcq.correctAnswer === 'C' ? 2 : 3;

  return {
    category: String(meta.category || 'group4').toLowerCase(),
    unit_id: Number(meta.unitId) || 1,
    class_id: Number(meta.classId) || 6,
    subject: mcq.subject || 'General Studies',
    lesson_title: mcq.lesson || '',
    lesson_id: meta.lessonId || null,
    lesson_number: meta.lessonNumber || null,
    topic: mcq.topic || mcq.lesson || null,
    difficulty: mcq.difficulty || 'Medium',
    question_text: mcq.question,
    options: optionsArr,
    correct_answer: correctIdx,
    explanation: mcq.explanation,
    status: meta.status || 'staging',
    source_reference: mcq.sourceTextbook || meta.sourcePdf || `${mcq.aiProvider || 'ai'} generation`,
    source_page: mcq.sourcePage || null,
    source_pdf: meta.sourcePdf || mcq.sourceTextbook || null,
    language: mcq.language.toLowerCase() === 'english' ? 'english' : 'tamil',
    ai_provider: mcq.aiProvider || 'claude',
    option_a: mcq.options.A,
    option_b: mcq.options.B,
    option_c: mcq.options.C,
    option_d: mcq.options.D,
    term: meta.term || mcq.term || null,
    volume: meta.volume || null,
    target_system: 'study_materials',
  };
}

/**
 * Converts a database question row into StandardizedMcqItem format.
 */
export function fromDatabaseQuestionRow(row: any): StandardizedMcqItem {
  let opts: McqOptionsMap = {
    A: row.option_a || '',
    B: row.option_b || '',
    C: row.option_c || '',
    D: row.option_d || '',
  };

  if (Array.isArray(row.options) && row.options.length >= 4) {
    opts = {
      A: String(row.options[0] || ''),
      B: String(row.options[1] || ''),
      C: String(row.options[2] || ''),
      D: String(row.options[3] || ''),
    };
  }

  const idxToKey: OptionKey[] = ['A', 'B', 'C', 'D'];
  const correctKey: OptionKey = typeof row.correct_answer === 'number'
    ? idxToKey[row.correct_answer] || 'A'
    : 'A';

  return {
    id: row.id,
    question: row.question_text || row.question,
    options: opts,
    correctAnswer: correctKey,
    explanation: row.explanation || '',
    subject: row.subject || '',
    standard: row.class_id ? `${row.class_id}th Standard` : (row.standard || ''),
    unit: row.unit_id ? `Unit ${row.unit_id}` : (row.unit || ''),
    term: row.term || '',
    lesson: row.lesson_title || '',
    topic: row.topic || '',
    difficulty: (row.difficulty as TNPSCDifficulty) || 'Medium',
    language: String(row.language).toLowerCase() === 'english' ? 'English' : 'Tamil',
    sourceTextbook: row.source_reference || row.source_pdf,
    sourcePage: row.source_page,
    aiProvider: row.ai_provider || 'claude',
  };
}

