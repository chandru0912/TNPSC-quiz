import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import 'dotenv/config';
import pool from '../db';
import { parsePasteTextToCanonicalJson } from '../services/pasteTextMcqParser';
import {
  createPasteImportSession,
  stageSessionQuestionsSequentially,
  getPasteImportSession,
} from '../services/pasteImportSessionService';

async function loadClientEstimator(): Promise<(raw: string) => number> {
  const modPath = path.resolve(__dirname, '../../../src/utils/pasteTextMcqEstimator.ts');
  const mod = await import(pathToFileURL(modPath).href);
  return mod.estimatePasteTextQuestionCount;
}

function generateEnglishMcqs(count: number): string {
  const blocks: string[] = [];
  const letters = ['A', 'B', 'C', 'D'] as const;
  for (let i = 1; i <= count; i++) {
    const ans = letters[(i - 1) % 4];
    blocks.push(
      `Q${i}. What is the SI unit for measurement #${i} in Physics?\n` +
        `A) Kilogram-${i}\n` +
        `B) Metre-${i}\n` +
        `C) Second-${i}\n` +
        `D) Kelvin-${i}\n` +
        `Answer: ${ans}\n` +
        `Explanation: Original explanation for question ${i} with exact punctuation!`
    );
  }
  return blocks.join('\n\n');
}

function generateMarkdown5OptionMcqs(startNum: number, count: number): string {
  const blocks: string[] = ['# TNPSC Group 4 Official Model Paper\n'];
  const letters = ['A', 'B', 'C', 'D'] as const;
  for (let i = 0; i < count; i++) {
    const qNum = startNum + i;
    const ans = letters[i % 4];
    blocks.push(
      `### Q${qNum}.\n` +
        `Which of the following statements is correct for TNPSC Question ${qNum}?\n` +
        `- **(A)** First choice for Q${qNum}\n` +
        `- **(B)** Second choice for Q${qNum}\n` +
        `- **(C)** Third choice for Q${qNum}\n` +
        `- **(D)** Fourth choice for Q${qNum}\n` +
        `- **(E)** Answer not known\n\n` +
        `**Answer: (${ans})**\n` +
        `**Explanation:** Detailed note for Q${qNum} referencing 1947 and point 1. and 2. inside prose.\n---`
    );
  }
  return blocks.join('\n\n');
}

function generateTamilMcqs(count: number): string {
  const blocks: string[] = [];
  const tamilLetters = ['அ', 'ஆ', 'இ', 'ஈ'] as const;
  for (let i = 1; i <= count; i++) {
    const ans = tamilLetters[(i - 1) % 4];
    blocks.push(
      `கேள்வி ${i}. திருக்குறளில் மொத்தம் எத்தனை அதிகாரங்கள் உள்ளன? (வினா ${i})\n` +
        `(அ) 100 அதிகாரங்கள் - ${i}\n` +
        `(ஆ) 133 அதிகாரங்கள் - ${i}\n` +
        `(இ) 150 அதிகாரங்கள் - ${i}\n` +
        `(ஈ) 120 அதிகாரங்கள் - ${i}\n` +
        `(உ) விடை தெரியவில்லை\n` +
        `விடை: ${ans}\n` +
        `விளக்கம்: திருக்குறள் 133 அதிகாரங்களும் 1330 குறட்பாக்களும் கொண்டது (${i}).`
    );
  }
  return blocks.join('\n\n');
}

async function runTests() {
  const estimatePasteTextQuestionCount = await loadClientEstimator();
  // 1. 100 English questions
  {
    const text = generateEnglishMcqs(100);
    const est = estimatePasteTextQuestionCount(text);
    const res = parsePasteTextToCanonicalJson(text, 100, { category: 'group4', subject: 'General Science' });
    assert.equal(est, 100, 'TC1: client estimator == 100');
    assert.equal(res.detectedQuestions, 100);
    assert.equal(res.validQuestions, 100);
    assert.equal(res.canStage, true);
    assert.equal(res.questions[0].questionText, 'What is the SI unit for measurement #1 in Physics?');
    assert.equal(res.questions[99].originalNumber, '100');
    assert.equal(res.questions[99].sourceOrder, 100);
    console.log('PASS TC1: 100 English MCQs (Estimated=100, Detected=100, Valid=100)');
  }

  // 2. 200 English questions + 500 performance check
  {
    const text200 = generateEnglishMcqs(200);
    assert.equal(estimatePasteTextQuestionCount(text200), 200);
    const res200 = parsePasteTextToCanonicalJson(text200, 200);
    assert.equal(res200.detectedQuestions, 200);
    assert.equal(res200.validQuestions, 200);

    const text500 = generateEnglishMcqs(500);
    const t0 = performance.now();
    const res500 = parsePasteTextToCanonicalJson(text500, 500);
    const elapsedMs = performance.now() - t0;
    assert.equal(estimatePasteTextQuestionCount(text500), 500);
    assert.equal(res500.detectedQuestions, 500);
    assert.equal(res500.validQuestions, 500);
    console.log(`PASS TC2: 200 & 500 English MCQs (500 parsed in ${elapsedMs.toFixed(1)} ms)`);
  }

  // 3. 100 Tamil questions (with 5th option (உ))
  {
    const text = generateTamilMcqs(100);
    assert.equal(estimatePasteTextQuestionCount(text), 100);
    const res = parsePasteTextToCanonicalJson(text, 100, { language: 'tamil' });
    assert.equal(res.detectedQuestions, 100);
    assert.equal(res.validQuestions, 100);
    assert.equal(res.questions[0].options.length, 5);
    assert.equal(res.questions[0].optionE, 'விடை தெரியவில்லை');
    assert.equal(res.questions[0].questionText, 'திருக்குறளில் மொத்தம் எத்தனை அதிகாரங்கள் உள்ளன? (வினா 1)');
    console.log('PASS TC3: 100 Tamil 5-option MCQs (Unicode preserved verbatim)');
  }

  // 4. Mixed Tamil-English questions
  {
    const mixed = `Q.No: 1 Who wrote Thirukkural (திருக்குறள்)?
(A) Thiruvalluvar (திருவள்ளுவர்)
(B) Avvaiyar (ஒளவையார்)
(C) Kamban (கம்பர்)
(D) Bharathiyar (பாரதியார்)
Answer: (A)

Question No. 2 இந்திய அரசியலமைப்பின் தந்தை (Father of Indian Constitution) யார்?
(A) Dr. B. R. Ambedkar
(B) Jawaharlal Nehru
(C) Sardar Patel
(D) Rajendra Prasad
சரியான விடை: அ`;
    assert.equal(estimatePasteTextQuestionCount(mixed), 2);
    const res = parsePasteTextToCanonicalJson(mixed, 2, { language: 'bilingual' });
    assert.equal(res.detectedQuestions, 2);
    assert.equal(res.validQuestions, 2);
    assert.equal(res.questions[1].optionA, 'Dr. B. R. Ambedkar');
    console.log('PASS TC4: Mixed Tamil-English MCQs');
  }

  // 5, 6, 7. Exact Screenshot Bug Fixture: 100 Markdown ### Q101..### Q200 + 5-option (A)-(E) + **Answer: (A)**
  {
    const md100 = generateMarkdown5OptionMcqs(101, 100);
    const est = estimatePasteTextQuestionCount(md100);
    const res = parsePasteTextToCanonicalJson(md100, 100);
    assert.equal(est, 100, 'TC5-7: client estimator MUST equal 100 for ### Q101..### Q200');
    assert.equal(res.detectedQuestions, 100, 'TC5-7: parser MUST detect all 100 Markdown questions');
    assert.equal(res.validQuestions, 100, 'TC5-7: all 100 Markdown questions MUST be valid');
    assert.equal(res.invalidQuestions, 0);
    assert.equal(res.canStage, true);
    assert.equal(res.questions[99].originalNumber, '200');
    assert.equal(res.questions[99].sourceOrder, 100);
    assert.equal(res.questions[99].options.length, 5, 'Option E must be preserved');
    assert.equal(res.questions[99].optionE, 'Answer not known');
    assert.equal(res.questions[99].originalAnswerText, '**Answer: (D)**');
    assert.equal(res.questions[99].correctAnswerLetter, 'D');
    console.log('PASS TC5, TC6, TC7: 100 Markdown ### Q101..### Q200 + 5-option (A)-(E) + **Answer: (A)** (Est=100, Det=100, Valid=100)');
  }

  // 8 & 9 & 15. Multiline questions, long explanations with numbers, and question numbers inside explanations
  {
    const complex = `## Q1
Consider the following statements:
1. India gained independence in 1947.
2. The Constitution came into force on 26 January 1950.
Which of the statements given above are correct?
(A) 1 only
(B) 2 only
(C) Both 1 and 2
(D) Neither 1 nor 2
**Correct Answer: (C)**
**Explanation:** Both statements are historically accurate:
1. Independence Act 1947 established sovereignty.
2. Republic Day 1950 adopted the Constitution.
Note: Compare this with Q15 in the previous section for context.

**Q2.** What is the SI unit of force?
A. Joule
B. Newton
C. Watt
D. Pascal
Ans. B`;
    assert.equal(estimatePasteTextQuestionCount(complex), 2);
    const res = parsePasteTextToCanonicalJson(complex, 2);
    assert.equal(res.detectedQuestions, 2);
    assert.equal(res.validQuestions, 2);
    assert.ok(res.questions[0].questionText.includes('1. India gained independence in 1947.'));
    assert.ok(res.questions[0].explanation.includes('2. Republic Day 1950'));
    assert.ok(res.questions[0].explanation.includes('Q15'));
    assert.equal(res.questions[1].correctAnswerLetter, 'B');
    console.log('PASS TC8, TC9, TC15: Multiline stems, long numbered explanations, and Q-numbers in prose');
  }

  // 10. Duplicate original question numbers (never deleted, never blocks valid staging)
  {
    const dup = `Q1. First question?
(A) One
(B) Two
(C) Three
(D) Four
Answer: A

Q2. Second question?
(A) Five
(B) Six
(C) Seven
(D) Eight
Answer: B

Q2. Third question also numbered 2?
(A) Nine
(B) Ten
(C) Eleven
(D) Twelve
Answer: C

Q3. Fourth question?
(A) Thirteen
(B) Fourteen
(C) Fifteen
(D) Sixteen
Answer: D`;
    assert.equal(estimatePasteTextQuestionCount(dup), 4);
    const res = parsePasteTextToCanonicalJson(dup, 4);
    assert.equal(res.detectedQuestions, 4);
    assert.equal(res.validQuestions, 4);
    assert.deepEqual(res.duplicateOriginalNumbers, ['2']);
    assert.equal(res.canStage, true, 'Harmless duplicate original numbers must NOT block valid staging');
    assert.deepEqual(res.questions.map((q) => [q.sourceOrder, q.originalNumber]), [
      [1, '1'],
      [2, '2'],
      [3, '2'],
      [4, '3'],
    ]);
    console.log('PASS TC10: Duplicate original question numbers preserved by sourceOrder');
  }

  // 11 & 12. Missing answers & missing options
  {
    const bad = `Q1. Missing answer question?
(A) Alpha
(B) Beta
(C) Gamma
(D) Delta

Q2. Missing options question?
(A) Only A
(B) Only B
Answer: A`;
    const res = parsePasteTextToCanonicalJson(bad, 2);
    assert.equal(res.detectedQuestions, 2);
    assert.equal(res.missingAnswers, 1);
    assert.equal(res.missingOptions, 1);
    assert.equal(res.invalidQuestions, 2);
    assert.equal(res.canStage, false);
    console.log('PASS TC11 & TC12: Missing answers and missing options flagged explicitly');
  }

  // 13 & 14. CRLF + LF line endings, irregular spacing, tabs
  {
    const crlfAndTabs =
      `###   Q1.\t\r\nWhat is H2O?\r\n\t- (A)\tHydrogen\r\n\t- (B)\tWater\r\n\t- (C)\tOxygen\r\n\t- (D)\tHelium\r\n\t**Answer:   (B)**\r\n\r\n` +
      `2)\t  Inline\toptions\twith\ttabs?\n(A) Sun\t(B) Moon\t(C) Mars\t(D) Venus\t(E) Answer not known\nAns: (A)`;
    assert.equal(estimatePasteTextQuestionCount(crlfAndTabs), 2);
    const res = parsePasteTextToCanonicalJson(crlfAndTabs, 2);
    assert.equal(res.detectedQuestions, 2);
    assert.equal(res.validQuestions, 2);
    assert.equal(res.questions[0].optionB, 'Water');
    assert.equal(res.questions[1].options.length, 5);
    assert.equal(res.questions[1].optionE, 'Answer not known');
    console.log('PASS TC13 & TC14: CRLF/LF line endings, irregular spacing, and tabs');
  }

  // 16. Live PostgreSQL Sequential Staging (5-option Markdown MCQs) + Interrupt/Resume + Idempotent Retry
  {
    const uniqueTag = `__paste_md5_test_${Date.now()}`;
    const md10 = generateMarkdown5OptionMcqs(191, 10);
    const session = await createPasteImportSession(
      md10,
      10,
      {
        category: 'group4',
        subject: 'General Studies',
        classId: 10,
        unitId: 1,
        lessonTitle: uniqueTag,
        topic: uniqueTag,
        difficulty: 'Medium',
        language: 'english',
        targetSystem: 'main_practice',
      },
      null
    );
    assert.ok(session.sessionId);
    assert.equal(session.detectedQuestions, 10);
    assert.equal(session.canStage, true);
    const sid = session.sessionId!;

    try {
      const part1 = await stageSessionQuestionsSequentially(sid, [1, 2, 3, 4, 5]);
      assert.equal(part1.summary.staged, 5);
      assert.equal(part1.summary.pending, 5);

      const mid = await getPasteImportSession(sid);
      const pending = mid!.items.filter((i) => i.status === 'pending').map((i) => i.sourceOrder);
      assert.deepEqual(pending, [6, 7, 8, 9, 10]);

      const part2 = await stageSessionQuestionsSequentially(sid, pending);
      assert.equal(part2.summary.staged, 10);
      assert.equal(part2.summary.status, 'completed');

      const retry = await stageSessionQuestionsSequentially(sid, [3, 4, 5]);
      assert.ok(retry.results.every((r) => r.status === 'staged' && r.alreadyStaged === true));

      const dbRows = await pool.query(
        `SELECT source_order, question_text, options, option_e, status
         FROM questions
         WHERE upload_session_id = $1
         ORDER BY source_order ASC`,
        [sid]
      );
      assert.equal(dbRows.rows.length, 10);
      for (let i = 0; i < 10; i++) {
        const r = dbRows.rows[i];
        const opts = typeof r.options === 'string' ? JSON.parse(r.options) : r.options;
        assert.equal(Number(r.source_order), i + 1);
        assert.equal(r.status, 'staging');
        assert.equal(opts.length, 5, 'All 5 options stored in PostgreSQL JSONB');
        assert.equal(r.option_e, 'Answer not known', 'option_e column populated');
      }
      console.log('PASS TC16: Live PostgreSQL 5-option sequential staging, resume, and idempotent retry (0 duplicates)');
    } finally {
      await pool.query(`DELETE FROM questions WHERE upload_session_id = $1`, [sid]);
      await pool.query(`DELETE FROM paste_import_sessions WHERE session_id = $1`, [sid]);
    }
  }

  console.log('\nALL 15+ PARSER UNIT TESTS & LIVE STAGING TESTS PASSED.');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST FAILED:', err);
    process.exit(1);
  });
