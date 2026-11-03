const path = require('path');
require(path.join(__dirname, '../backend/node_modules/dotenv')).config({
  path: path.join(__dirname, '../backend/.env'),
});

const pool = require('../backend/dist/db').default || require('../backend/dist/db');
const {
  randomizeQuestionOptions,
  randomizeBatchOptions,
} = require('../backend/dist/services/ai/shared/option-randomizer');
const {
  normalizeQuestionText,
  computeQuestionFingerprint,
  computeJaccardSimilarity,
  areOptionsIdentical,
  filterDuplicates,
} = require('../backend/dist/services/ai/shared/duplicate-detector');
const {
  validateMcqItem,
  validateBatchMcqs,
} = require('../backend/dist/services/ai/shared/mcq-validator');
const {
  SyllabusContextService,
} = require('../backend/dist/services/ai/shared/syllabus-context.service');
const {
  TopicExtractionService,
} = require('../backend/dist/services/ai/shared/topic-extraction.service');
const {
  AIPromptsService,
} = require('../backend/dist/services/ai/ai-prompts.service');
const {
  AIProviderFactory,
} = require('../backend/dist/services/ai/ai-provider.factory');
const {
  AILogsService,
} = require('../backend/dist/services/ai/ai-logs.service');

async function runTestSuite() {
  console.log('================================================================');
  console.log('   TNPSC STUDY HUB: UNIFIED MCQ WORKFLOW & ISOLATION TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // -------------------------------------------------------------------
  // TEST SECTION 1: Option Randomization & Distribution Engine (Part 5)
  // -------------------------------------------------------------------
  console.log('--- TEST SECTION 1: Server-Side Option Randomizer & Balancing ---');

  // Test single question shuffle
  const singleQ = {
    options: {
      A: 'Madurai',
      B: 'Chennai',
      C: 'Tiruchirappalli',
      D: 'Coimbatore',
    },
    correctAnswer: 'A',
  };

  const shuffledSingle = randomizeQuestionOptions(singleQ.options, singleQ.correctAnswer);
  assert(
    shuffledSingle.options[shuffledSingle.correctAnswer] === 'Madurai',
    'Post-shuffle assertion: options[correctAnswer] strictly equals original correct answer text ("Madurai")'
  );
  assert(
    Object.keys(shuffledSingle.options).length === 4,
    'Shuffled options contain exactly 4 positions (A, B, C, D)'
  );

  // Test batch distribution & streak avoidance across 40 questions
  const batchSample = Array.from({ length: 40 }).map((_, i) => ({
    question: `Sample TNPSC Question ${i + 1}`,
    options: { A: 'Correct Option', B: 'Distractor 1', C: 'Distractor 2', D: 'Distractor 3' },
    correctAnswer: 'A',
    explanation: 'Explanation test',
    subject: 'History',
    standard: '6th Standard',
    unit: 'Unit 1',
    term: 'Term 1',
    lesson: 'Indus Valley',
    difficulty: 'Medium',
    language: 'Tamil',
  }));

  const randomizedBatch = randomizeBatchOptions(batchSample);
  const positionCounts = { A: 0, B: 0, C: 0, D: 0 };
  let maxConsecutiveStreak = 0;
  let currentStreak = 0;
  let lastPos = null;

  for (const q of randomizedBatch) {
    assert(
      q.options[q.correctAnswer] === 'Correct Option',
      `Verbatim preservation for question: options[${q.correctAnswer}] == "Correct Option"`
    );
    positionCounts[q.correctAnswer]++;
    if (q.correctAnswer === lastPos) {
      currentStreak++;
      if (currentStreak > maxConsecutiveStreak) maxConsecutiveStreak = currentStreak;
    } else {
      currentStreak = 1;
      lastPos = q.correctAnswer;
    }
  }

  console.log('  Option position distribution over 40 questions:', positionCounts);
  assert(positionCounts.A > 0 && positionCounts.B > 0 && positionCounts.C > 0 && positionCounts.D > 0,
    'All 4 positions (A, B, C, D) are represented in the batch');
  assert(maxConsecutiveStreak <= 2,
    `Streak prevention verified: max consecutive same position is ${maxConsecutiveStreak} (<= 2)`);

  // -------------------------------------------------------------------
  // TEST SECTION 2: Duplicate Detection Engine (Part 6)
  // -------------------------------------------------------------------
  console.log('\n--- TEST SECTION 2: Duplicate Detection & Jaccard Overlap ---');

  const text1 = 'சிந்து சமவெளி நாகரிகத்தின் முக்கிய துறைமுக நகரம் எது?';
  const text2 = 'சிந்து சமவெளி நாகரிகத்தின் முக்கிய துறைமுகம் எது?';
  const textDifferent = 'தமிழ்நாட்டின் மிக உயரமான சிகரம் எது?';

  const norm1 = normalizeQuestionText(text1);
  const norm2 = normalizeQuestionText(text2);
  const fp1 = computeQuestionFingerprint(text1);
  const fp2 = computeQuestionFingerprint(text1); // exact same
  assert(fp1 === fp2, 'SHA-256 question fingerprint is deterministic');

  const simHigh = computeJaccardSimilarity(text1, text2);
  const simLow = computeJaccardSimilarity(text1, textDifferent);

  console.log(`  Similarity between related questions: ${(simHigh * 100).toFixed(1)}%`);
  console.log(`  Similarity between unrelated questions: ${(simLow * 100).toFixed(1)}%`);

  assert(simHigh >= 0.75, 'High semantic similarity correctly scored >= 0.75');
  assert(simLow < 0.20, 'Unrelated questions correctly scored < 0.20');

  // Test intra-batch duplicate filtering
  const dupBatch = [
    {
      question: 'சிந்து சமவெளி நாகரிகத்தின் முக்கிய துறைமுக நகரம் எது?',
      options: { A: 'லோத்தல்', B: 'ஹரப்பா', C: 'மொகஞ்சதாரோ', D: 'காலிபங்கன்' },
      correctAnswer: 'A',
      explanation: 'லோத்தல் குஜராத்தில் அமைந்துள்ளது.',
      subject: 'History',
      standard: '6th Standard',
      unit: 'Unit 1',
      term: 'Term 1',
      lesson: 'Indus Valley',
      difficulty: 'Medium',
      language: 'Tamil',
    },
    {
      question: 'சிந்து சமவெளி நாகரிகத்தின் முக்கிய துறைமுக நகரம் எது?', // Exact duplicate
      options: { A: 'லோத்தல்', B: 'ஹரப்பா', C: 'மொகஞ்சதாரோ', D: 'காலிபங்கன்' },
      correctAnswer: 'A',
      explanation: 'லோத்தல் குஜராத்தில் அமைந்துள்ளது.',
      subject: 'History',
      standard: '6th Standard',
      unit: 'Unit 1',
      term: 'Term 1',
      lesson: 'Indus Valley',
      difficulty: 'Medium',
      language: 'Tamil',
    },
    {
      question: 'தமிழ்நாட்டின் மிக உயரமான சிகரம் எது?', // Unique
      options: { A: 'தொட்டபெட்டா', B: 'ஆனைமுடி', C: 'சேர்வராயன்', D: 'கொல்லிமலை' },
      correctAnswer: 'A',
      explanation: 'தொட்டபெட்டா நீலகிரியில் உள்ளது.',
      subject: 'Geography',
      standard: '10th Standard',
      unit: 'Unit 1',
      term: 'Term 1',
      lesson: 'Tamil Nadu Geography',
      difficulty: 'Easy',
      language: 'Tamil',
    },
  ];

  const filterRes = await filterDuplicates(dupBatch);
  assert(filterRes.duplicateCount === 1, `Duplicate detection filtered exactly 1 duplicate (found: ${filterRes.duplicateCount})`);
  assert(filterRes.uniqueQuestions.length === 2, `Retained exactly 2 unique questions (retained: ${filterRes.uniqueQuestions.length})`);

  // -------------------------------------------------------------------
  // TEST SECTION 3: MCQ Quality Validator (Part 7)
  // -------------------------------------------------------------------
  console.log('\n--- TEST SECTION 3: Automated MCQ Quality Validator ---');

  // Valid item
  const validItem = {
    question: 'Which is the oldest rock shelter art site in Tamil Nadu?',
    options: { A: 'Kilvalai', B: 'Mallapadi', C: 'Alampadi', D: 'Setthavarai' },
    correctAnswer: 'B',
    explanation: 'Mallapadi in Dharmapuri district is the first discovered rock art site in Tamil Nadu.',
    difficulty: 'Hard',
    questionType: 'Factual',
    language: 'English',
  };
  const valRes = validateMcqItem(validItem);
  assert(valRes.isValid === true, 'Valid MCQ passes validation cleanly');

  // Invalid item: Short question
  const shortQ = { ...validItem, question: 'What is it?' };
  const shortVal = validateMcqItem(shortQ);
  assert(shortVal.isValid === false, 'Rejects question text with < 15 characters');

  // Invalid item: Duplicate options within same question
  const dupOptsQ = { ...validItem, options: { A: 'Delhi', B: 'Delhi', C: 'Mumbai', D: 'Kolkata' } };
  const dupOptsVal = validateMcqItem(dupOptsQ);
  assert(dupOptsVal.isValid === false, 'Rejects question with duplicate options within question');

  // Invalid item: AI conversational leak
  const leakQ = { ...validItem, question: 'As an AI language model, which is the oldest site?' };
  const leakVal = validateMcqItem(leakQ);
  assert(leakVal.isValid === false, 'Rejects question containing AI conversational leak');

  // -------------------------------------------------------------------
  // TEST SECTION 4: Syllabus & Topic Extraction Services (Part 1 & 2)
  // -------------------------------------------------------------------
  console.log('\n--- TEST SECTION 4: Syllabus & Topic Context Resolution ---');

  const syllabusCtx = SyllabusContextService.resolveContext({
    groupId: 'group4',
    subject: 'General Studies',
    standard: '6th Standard',
    unitId: 1,
    term: 'Term 1',
    lessonTitle: 'Measurements',
    lessonNumber: '1.1',
    language: 'Tamil',
  });

  assert(syllabusCtx.examGroup === 'TNPSC Group 4', 'Normalizes examGroup to "TNPSC Group 4"');
  assert(syllabusCtx.standardNumber === 6, 'Parses standard number 6');
  assert(syllabusCtx.unitTitle === 'Unit 1', 'Formats unit title to "Unit 1"');

  const promptBlock = SyllabusContextService.buildPromptContextBlock(syllabusCtx);
  assert(promptBlock.includes('=== TNPSC SYLLABUS SPECIFICATION ==='), 'Builds standardized syllabus prompt block');

  const sampleTextbookText = `
1.1 Introduction to Measurements
SI Units: Length is measured in metres. Mass is measured in kilograms.
Time is measured in seconds.
1.2 Comparison between mass and weight
Difference between mass and weight: Mass is constant, weight changes.
In 1960, the 11th General Conference on Weights and Measures adopted the SI system.
`;

  const topics = TopicExtractionService.extractTopics(sampleTextbookText, 'Measurements');
  assert(topics.headings.length >= 1, 'Extracted structural headings from text');
  assert(topics.hasChronology === true, 'Detected chronology in textbook content (1960 year)');
  assert(topics.hasComparisons === true, 'Detected comparison context in textbook content');

  // -------------------------------------------------------------------
  // TEST SECTION 5: Complete Provider Isolation & Database Verification (Part 8, 9, 11)
  // -------------------------------------------------------------------
  console.log('\n--- TEST SECTION 5: Complete Provider Isolation Verification ---');

  // Verify Claude and Gemini instances are distinct
  const claudeProv = AIProviderFactory.getProvider('claude');
  const geminiProv = AIProviderFactory.getProvider('gemini');

  assert(claudeProv !== geminiProv, 'Claude and Gemini provider instances are strictly isolated objects');
  assert(claudeProv.name === 'claude', 'Claude provider name is "claude"');
  assert(geminiProv.name === 'gemini', 'Gemini provider name is "gemini"');

  // Test prompt isolation in database:
  const claudePrompts = await AIPromptsService.getCurrentPrompts('claude');
  const geminiPrompts = await AIPromptsService.getCurrentPrompts('gemini');

  assert(claudePrompts.length >= 4, `Claude has independent prompt records in DB (found: ${claudePrompts.length})`);
  assert(geminiPrompts.length >= 4, `Gemini has independent prompt records in DB (found: ${geminiPrompts.length})`);

  // Verify prompt content is provider-specific
  const claudeSystemMcq = claudePrompts.find((p) => p.promptType === 'mcq_system');
  const geminiSystemMcq = geminiPrompts.find((p) => p.promptType === 'mcq_system');

  assert(claudeSystemMcq.provider === 'claude', 'Claude MCQ prompt is scoped to "claude"');
  assert(geminiSystemMcq.provider === 'gemini', 'Gemini MCQ prompt is scoped to "gemini"');

  // Test logging isolation:
  await AILogsService.logGeneration({
    provider: 'claude',
    model: 'claude-3-5-sonnet-20241022',
    generationType: 'mcq',
    groupId: 'group4',
    standard: 6,
    subject: 'Science',
    unitId: 1,
    lessonTitle: 'Test Verification Lesson',
    language: 'tamil',
    status: 'success',
    itemsCount: 10,
  });

  await AILogsService.logGeneration({
    provider: 'gemini',
    model: 'gemini-3.8-flash',
    generationType: 'mcq',
    groupId: 'group4',
    standard: 6,
    subject: 'Science',
    unitId: 1,
    lessonTitle: 'Test Verification Lesson',
    language: 'english',
    status: 'success',
    itemsCount: 10,
  });

  const claudeLogs = await AILogsService.getLogs('claude', 5);
  const geminiLogs = await AILogsService.getLogs('gemini', 5);

  assert(claudeLogs.length > 0 && claudeLogs.every((l) => l.provider === 'claude'),
    'Claude logs only return records where provider = "claude"');
  assert(geminiLogs.length > 0 && geminiLogs.every((l) => l.provider === 'gemini'),
    'Gemini logs only return records where provider = "gemini"');

  console.log('\n================================================================');
  console.log(`   ALL TESTS PASSED: ${passedTests} / ${totalTests} assertions verified!`);
  console.log('================================================================\n');

  await pool.end();
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

