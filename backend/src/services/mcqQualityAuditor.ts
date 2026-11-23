/**
 * mcqQualityAuditor.ts
 *
 * Independent Evidence-Based TNPSC Competitive Examination Quality Auditor.
 *
 * Evaluates every generated MCQ across 10 objective rubric dimensions (10 pts each = 100 pts):
 *  1. Syllabus Relevance (0–10)
 *  2. Textbook Accuracy (0–10)
 *  3. Conceptual Depth (0–10)
 *  4. Logical Reasoning Quality (0–10)
 *  5. TNPSC Examination Suitability (0–10)
 *  6. Question Originality (0–10)
 *  7. Distractor Quality (0–10)
 *  8. Answer Accuracy (0–10)
 *  9. Duplicate Detection (0–10)
 * 10. Reverse-Question Detection (0–10)
 *
 * Minimum acceptance score: 80 / 100 (configurable).
 * Hard gates: fails immediately if Answer Accuracy < 8, Duplicate Detection == 0,
 * or Reverse-Question Detection == 0. Never assigns random scores.
 */

import {
  checkQuestionDuplicate,
  ExistingDbQuestionRecord,
  jaccard,
  normalizeText,
  stemToken,
  TextbookPassage,
  tokenSet,
  verifyQuestionAgainstSourcePdf,
} from './questionValidator';

export interface QualityScoreBreakdown {
  syllabusRelevance: number;        // 0..10
  textbookAccuracy: number;         // 0..10
  conceptualDepth: number;          // 0..10
  logicalReasoningQuality: number;  // 0..10
  tnpscSuitability: number;         // 0..10
  questionOriginality: number;      // 0..10
  distractorQuality: number;        // 0..10
  answerAccuracy: number;           // 0..10
  duplicateDetection: number;       // 0..10
  reverseQuestionDetection: number; // 0..10
}

export interface QualityAuditResult {
  passed: boolean;
  totalScore: number; // 0..100
  minRequiredScore: number;
  breakdown: QualityScoreBreakdown;
  stages: {
    stage1PdfSource: boolean;
    stage2SyllabusMapping: boolean;
    stage3FactualAccuracy: boolean;
    stage4QuestionClarity: boolean;
    stage5AnswerCorrectness: boolean;
    stage6OptionQuality: boolean;
    stage7DuplicateDetection: boolean;
    stage8DifficultyLevel: boolean;
    stage9ExplanationQuality: boolean;
    stage10FinalScore: number;
  };
  verifiedPage: number | null;
  rejectionReasons: string[];
  notes: string[];
}

export interface AuditCandidateInput {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  questionType?: string;
  topic?: string;
  category: string;      // group1 | group2 | group2a | group4
  subject: string;
  lessonTitle: string;
  aiSuggestedPage?: number | null;
  passages: TextbookPassage[];
  existingBatch: Array<{ question: string; correctAnswerText?: string }>;
  existingDbQuestions: ExistingDbQuestionRecord[];
  minAcceptanceScore?: number;
}

const HIGHER_ORDER_MARKERS =
  /\b(?:statement|assertion|reason|match|arrange|chronolog|compare|contrast|difference|relationship|cause|effect|because|consequence|why|how does|which of the following statements|incorrect|not correct|correctly matched|pair|consider the following|principle|phenomenon|application|if\s+a|when\s+a)\b|கூற்று|காரணம்|பொருத்துக|தவறான|சரியான\s*கூற்று|வரிசைப்படுத்துக|வேறுபாடு|விளைவு|தத்துவம்/i;

const TRIVIAL_ONE_LINER =
  /^(?:what is|who is|define|name the|which is the)\s+[a-z\s]{2,22}\?$/i;

const OBVIOUS_FILLER_OPTION =
  /^(?:none|nothing|all|something|anything|unknown|not applicable|n\/a|other|random|dummy|test option)$/i;

const LAZY_CATCHALL_OPTION =
  /^(?:all of the above|none of the above|both a and b|மேற்கண்ட அனைத்தும்|மேற்கண்ட எதுவுமில்லை)$/i;

/**
 * Runs the independent 10-stage evidence-based TNPSC quality validation pipeline.
 * Default minimum acceptance score: 85 / 100 with mandatory PDF Source & Answer Correctness gates.
 */
export function auditMcqQuality(input: AuditCandidateInput): QualityAuditResult {
  const minRequiredScore = input.minAcceptanceScore ?? 85;
  const rejectionReasons: string[] = [];
  const notes: string[] = [];

  const qText = String(input.question || '').trim();
  const options = Array.isArray(input.options) ? input.options.map((o) => String(o || '').trim()) : [];
  const correctIdx = Number(input.correctAnswer);
  const correctAns = options[correctIdx] || '';
  const explanation = String(input.explanation || '').trim();

  // ------------------------------------------------------------------
  // 1. Syllabus Relevance (0..10)
  // ------------------------------------------------------------------
  const sylTokens = tokenSet(`${input.lessonTitle} ${input.topic || ''} ${input.subject}`);
  const qaTokens = tokenSet(`${qText} ${correctAns} ${explanation}`);
  let sylOverlap = 0;
  for (const t of sylTokens) {
    if (qaTokens.has(t)) sylOverlap++;
  }
  const syllabusRelevance =
    sylTokens.size === 0 ? 8 : sylOverlap >= 2 ? 10 : sylOverlap === 1 ? 9 : 7;

  // ------------------------------------------------------------------
  // 2 & 8. Textbook Accuracy (0..10) & Answer Accuracy (0..10)
  // ------------------------------------------------------------------
  const pdfCheck = verifyQuestionAgainstSourcePdf({
    question: qText,
    options,
    correctAnswerIdx: correctIdx,
    explanation,
    passages: input.passages,
    aiSuggestedPage: input.aiSuggestedPage,
  });

  const fullPdfNorm = normalizeText(input.passages.map((p) => p.content).join(' '));
  const fullPdfTokens = new Set(fullPdfNorm.split(' ').map(stemToken).filter((w) => w.length >= 2));
  const expTokens = Array.from(tokenSet(`${qText} ${explanation}`));
  let expHits = 0;
  for (const t of expTokens) {
    if (fullPdfTokens.has(t) || fullPdfNorm.includes(t)) expHits++;
  }
  const supportRatio = expTokens.length > 0 ? expHits / expTokens.length : 0;

  let textbookAccuracy = 0;
  let answerAccuracy = 0;
  if (!pdfCheck.supported) {
    textbookAccuracy = Math.round(supportRatio * 5);
    answerAccuracy = 0;
    rejectionReasons.push(pdfCheck.reason || 'Answer/explanation not supported by source PDF.');
  } else {
    answerAccuracy = correctIdx >= 0 && correctIdx <= 3 && correctAns.length > 0 ? 10 : 0;
    if (supportRatio >= 0.55) textbookAccuracy = 10;
    else if (supportRatio >= 0.4) textbookAccuracy = 9;
    else if (supportRatio >= 0.25) textbookAccuracy = 8;
    else textbookAccuracy = 6;
  }

  // ------------------------------------------------------------------
  // 3. Conceptual Depth (0..10)
  // ------------------------------------------------------------------
  const wordCount = qText.split(/\s+/).filter(Boolean).length;
  const hasHigherOrder = HIGHER_ORDER_MARKERS.test(qText);
  const isTrivial = TRIVIAL_ONE_LINER.test(qText) && wordCount <= 7;
  const isAdvancedTier = /group1|group2/i.test(input.category) || /difficult|hard|advanced/i.test(input.difficulty);

  let conceptualDepth = 8;
  if (hasHigherOrder && wordCount >= 10) {
    conceptualDepth = 10;
  } else if (wordCount >= 10 && explanation.length >= 45) {
    conceptualDepth = 9;
  } else if (isTrivial) {
    conceptualDepth = isAdvancedTier ? 4 : 6;
    notes.push('Question appears to be a very basic one-liner.');
  } else if (wordCount < 7) {
    conceptualDepth = 6;
  }

  // ------------------------------------------------------------------
  // 4. Logical Reasoning Quality (0..10)
  // ------------------------------------------------------------------
  let logicalReasoningQuality = 9;
  if (!qText.endsWith('?')) {
    logicalReasoningQuality -= 3;
    rejectionReasons.push('Question stem does not end with a question mark.');
  }
  if (explanation.length < 25) {
    logicalReasoningQuality -= 3;
    notes.push('Explanation is overly brief.');
  } else if (explanation.length >= 50) {
    logicalReasoningQuality = 10;
  }
  // Penalize ambiguous double-negative stems
  if (/\bnot\b.*\bnot\b/i.test(qText)) {
    logicalReasoningQuality -= 3;
    notes.push('Potential double-negative ambiguity in stem.');
  }
  logicalReasoningQuality = Math.max(0, Math.min(10, logicalReasoningQuality));

  // ------------------------------------------------------------------
  // 5. TNPSC Examination Suitability (0..10)
  // ------------------------------------------------------------------
  let tnpscSuitability = 9;
  if (hasHigherOrder || (input.questionType && /statement|assertion|match|analytical|conceptual|application|cause|comparison|principle|situation/i.test(input.questionType))) {
    tnpscSuitability = 10;
  } else if (wordCount < 6 || qText.length > 650) {
    tnpscSuitability = 6;
  }

  // ------------------------------------------------------------------
  // 7. Distractor Quality (0..10)
  // ------------------------------------------------------------------
  let distractorQuality = 10;
  const normOpts = options.map((o) => normalizeText(o));
  const uniqueOpts = new Set(normOpts.filter(Boolean));
  if (options.length !== 4 || uniqueOpts.size < 4) {
    distractorQuality = 0;
    rejectionReasons.push('Stage 6 (Option Quality): Question does not have 4 unique non-empty options.');
  } else {
    const hasFiller = options.some((o) => OBVIOUS_FILLER_OPTION.test(o));
    if (hasFiller) {
      distractorQuality -= 4;
      rejectionReasons.push('Stage 6 (Option Quality): Contains meaningless/filler distractor option.');
    }

    // Penalize lazy "All of the above" / "None of the above" on non-statement questions
    const hasLazyCatchall = options.some((o) => LAZY_CATCHALL_OPTION.test(o));
    if (hasLazyCatchall && !hasHigherOrder) {
      distractorQuality -= 2;
      notes.push('Avoids "All/None of the above" unless required by a statement-based question.');
    }

    // Check option length balance (penalize if correct answer is wildly longer than distractors)
    const lengths = options.map((o) => o.length);
    const correctLen = lengths[correctIdx] || 1;
    const distractorLens = lengths.filter((_, i) => i !== correctIdx);
    const avgDistractorLen = distractorLens.reduce((a, b) => a + b, 0) / Math.max(1, distractorLens.length);
    if (avgDistractorLen > 0 && correctLen > avgDistractorLen * 3.2 && correctLen > 45) {
      distractorQuality -= 2;
      notes.push('Correct option is disproportionately longer than distractors.');
    }
  }
  distractorQuality = Math.max(0, Math.min(10, distractorQuality));

  // ------------------------------------------------------------------
  // 6, 9, 10. Originality (0..10), Duplicate Detection (0..10), Reverse-Question Detection (0..10)
  // ------------------------------------------------------------------
  const dupCheck = checkQuestionDuplicate(
    qText,
    input.existingBatch,
    input.existingDbQuestions,
    correctAns
  );

  let duplicateDetection = 10;
  let reverseQuestionDetection = 10;
  let questionOriginality = 10;

  if (dupCheck.isDuplicate) {
    if (dupCheck.reason === 'REVERSE_QUESTION') {
      reverseQuestionDetection = 0;
      questionOriginality = 0;
      rejectionReasons.push(`Reverse-generated question detected against: "${dupCheck.matchedQuestion || 'existing item'}"`);
    } else {
      duplicateDetection = 0;
      questionOriginality = 0;
      rejectionReasons.push(`${dupCheck.reason || 'DUPLICATE'} duplicate detected against: "${dupCheck.matchedQuestion || 'existing item'}"`);
    }
  } else {
    // Compute max token overlap against existing questions to grade originality
    const candToks = tokenSet(qText);
    let maxSim = 0;
    for (const b of input.existingBatch) {
      const s = jaccard(candToks, tokenSet(b.question));
      if (s > maxSim) maxSim = s;
    }
    for (const d of input.existingDbQuestions) {
      const s = jaccard(candToks, tokenSet(d.question));
      if (s > maxSim) maxSim = s;
    }
    if (maxSim >= 0.55) questionOriginality = 7;
    else if (maxSim >= 0.4) questionOriginality = 8;
    else if (maxSim >= 0.25) questionOriginality = 9;
    else questionOriginality = 10;
  }

  const breakdown: QualityScoreBreakdown = {
    syllabusRelevance,
    textbookAccuracy,
    conceptualDepth,
    logicalReasoningQuality,
    tnpscSuitability,
    questionOriginality,
    distractorQuality,
    answerAccuracy,
    duplicateDetection,
    reverseQuestionDetection,
  };

  const totalScore =
    breakdown.syllabusRelevance +
    breakdown.textbookAccuracy +
    breakdown.conceptualDepth +
    breakdown.logicalReasoningQuality +
    breakdown.tnpscSuitability +
    breakdown.questionOriginality +
    breakdown.distractorQuality +
    breakdown.answerAccuracy +
    breakdown.duplicateDetection +
    breakdown.reverseQuestionDetection;

  const stages = {
    stage1PdfSource: pdfCheck.supported && pdfCheck.verifiedPage !== null,
    stage2SyllabusMapping: breakdown.syllabusRelevance >= 7,
    stage3FactualAccuracy: breakdown.textbookAccuracy >= 8,
    stage4QuestionClarity: breakdown.logicalReasoningQuality >= 7 && qText.endsWith('?'),
    stage5AnswerCorrectness: breakdown.answerAccuracy >= 8,
    stage6OptionQuality: breakdown.distractorQuality >= 7,
    stage7DuplicateDetection: breakdown.duplicateDetection === 10 && breakdown.reverseQuestionDetection === 10,
    stage8DifficultyLevel: breakdown.conceptualDepth >= 6,
    stage9ExplanationQuality: explanation.length >= 20,
    stage10FinalScore: totalScore,
  };

  if (!stages.stage9ExplanationQuality) {
    rejectionReasons.push('Stage 9 (Explanation Verification): Explanation is missing or too short.');
  }

  if (totalScore < minRequiredScore && rejectionReasons.length === 0) {
    rejectionReasons.push(`Stage 10 (Final Quality Score): Score ${totalScore}/100 is below minimum acceptance threshold (${minRequiredScore}/100).`);
  }

  const passed =
    totalScore >= minRequiredScore &&
    stages.stage1PdfSource &&
    stages.stage3FactualAccuracy &&
    stages.stage5AnswerCorrectness &&
    stages.stage6OptionQuality &&
    stages.stage7DuplicateDetection &&
    stages.stage9ExplanationQuality &&
    rejectionReasons.length === 0;

  return {
    passed,
    totalScore,
    minRequiredScore,
    breakdown,
    stages,
    verifiedPage: pdfCheck.verifiedPage,
    rejectionReasons,
    notes,
  };
}
