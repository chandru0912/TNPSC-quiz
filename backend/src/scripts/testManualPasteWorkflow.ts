import assert from 'assert';
import path from 'path';
import { pathToFileURL } from 'url';
import {
  createPaperFromPastedQuestions,
  approvePaperQuestions,
  updateAdminPreviousPaperStatus,
  deleteAdminPreviousPaper,
} from '../services/previousPapersAdminService';
import { listPreviousPapers } from '../services/previousPapersService';
import pool from '../db';

function buildEnglishPaste(count: number, style: 'question_colon' | 'numbered'): string {
  const letters = ['A', 'B', 'C', 'D'];
  const parts: string[] = [];
  for (let i = 1; i <= count; i++) {
    const ans = letters[i % 4];
    if (style === 'question_colon') {
      parts.push(
        `QUESTION ${i}:\nWhich TNPSC Polity or Science concept applies to item #${i}?\n\nA) Option Alpha ${i}\nB) Option Beta ${i}\nC) Option Gamma ${i}\nD) Option Delta ${i}\n\nANSWER: ${ans}\n\nEXPLANATION:\nOption ${ans} is correct for item #${i} according to Samacheer Kalvi.`
      );
    } else {
      parts.push(
        `${i}. Sample numbered TNPSC examination question number ${i}?\n(A) Choice One ${i}\n(B) Choice Two ${i}\n(C) Choice Three ${i}\n(D) Choice Four ${i}\nCorrect Answer: ${ans}) Choice\nExplanation: Verified explanation for question ${i}.`
      );
    }
  }
  return parts.join('\n\n');
}

function buildTamilPaste(count: number): string {
  const letters = ['அ', 'ஆ', 'இ', 'ஈ'];
  const parts: string[] = [];
  for (let i = 1; i <= count; i++) {
    const ans = letters[i % 4];
    parts.push(
      `கேள்வி ${i}:\nதமிழ்நாடு அரசுப் பணியாளர் தேர்வாணையம் வினா எண் ${i} எதைக் குறிக்கிறது?\n\n(அ) விருப்பம் ஒன்று ${i}\n(ஆ) விருப்பம் இரண்டு ${i}\n(இ) விருப்பம் மூன்று ${i}\n(ஈ) விருப்பம் நான்கு ${i}\n\nவிடை: ${ans}\n\nவிளக்கம்:\nசமச்சீர் கல்வி பாடநூலின்படி விடை ${ans} சரியானது (${i}).`
    );
  }
  return parts.join('\n\n');
}

async function main() {
  console.log('=== Manual Question Paste & Staging Workflow — Automated Tests ===\n');
  const parserPath = path.resolve(__dirname, '../../../src/utils/previousPaperPasteParser.ts');
  const { parsePastedPreviousYearQuestions } = await import(pathToFileURL(parserPath).href);

  // 1. 10 Questions (QUESTION N: format)
  const r10 = parsePastedPreviousYearQuestions(buildEnglishPaste(10, 'question_colon'));
  assert.strictEqual(r10.summary.totalPasted, 10);
  assert.strictEqual(r10.summary.successfullyParsed, 10);
  assert.strictEqual(r10.summary.needsReviewCount, 0);
  console.log('✓ 1. 10 English questions (QUESTION N: format) parsed 10/10 cleanly');

  // 2. 50 Questions (1. numbered format)
  const r50 = parsePastedPreviousYearQuestions(buildEnglishPaste(50, 'numbered'));
  assert.strictEqual(r50.summary.totalPasted, 50);
  assert.strictEqual(r50.summary.successfullyParsed, 50);
  console.log('✓ 2. 50 English questions (numbered format) parsed 50/50 cleanly');

  // 3. 100 Tamil Questions (கேள்வி N: + (அ)-(ஈ) + விடை + விளக்கம்)
  const r100Ta = parsePastedPreviousYearQuestions(buildTamilPaste(100));
  assert.strictEqual(r100Ta.summary.totalPasted, 100);
  assert.strictEqual(r100Ta.summary.successfullyParsed, 100);
  assert.ok(r100Ta.questions[0].questionText.includes('தமிழ்நாடு'), 'Tamil text must be preserved verbatim');
  console.log('✓ 3. 100 Tamil questions parsed 100/100 verbatim');

  // 4. 200 Questions (full TNPSC paper)
  const r200 = parsePastedPreviousYearQuestions(buildEnglishPaste(200, 'question_colon'));
  assert.strictEqual(r200.summary.totalPasted, 200);
  assert.strictEqual(r200.summary.successfullyParsed, 200);
  assert.strictEqual(r200.questions[199].questionNumber, 200);
  console.log('✓ 4. 200 questions parsed 200/200 in exact order');

  // 5. Validation edge cases: Duplicate + Missing Answer + Missing Options
  const edgeText = `
QUESTION 1:
Which planet is known as the Red Planet?
A) Earth
B) Mars
C) Jupiter
D) Venus
ANSWER: Mars
EXPLANATION: Mars has iron oxide on its surface.

QUESTION 2:
Which planet is known as the Red Planet?
A) Earth
B) Mars
C) Jupiter
D) Venus
ANSWER: B

QUESTION 3:
Question with missing answer?
A) One
B) Two
C) Three
D) Four

QUESTION 4:
Question with missing options?
A) Only A
B) Only B
ANSWER: A
`;
  const rEdge = parsePastedPreviousYearQuestions(edgeText);
  assert.strictEqual(rEdge.summary.totalPasted, 4, 'Must NEVER silently skip pasted questions');
  assert.strictEqual(rEdge.questions[0].correctAnswer, 1, 'Answer text "Mars" must match Option B');
  assert.strictEqual(rEdge.summary.duplicateCount, 1);
  assert.strictEqual(rEdge.summary.missingAnswersCount, 1);
  assert.strictEqual(rEdge.summary.missingOptionsCount, 1);
  assert.strictEqual(rEdge.summary.needsReviewCount, 3);
  console.log('✓ 5. Edge cases verified (text-matched answer, duplicate, missing answer, missing options)');

  // 6. End-to-End DB: Save to Staging -> Duplicate Guard -> Staging Isolation -> Approval -> Publish -> Cleanup
  let createdPaperId: number | null = null;
  try {
    const testTitle = `Automated Paste Test ${Date.now()}`;
    const created = await createPaperFromPastedQuestions({
      group: 'group4',
      year: 2025,
      examStream: 'TNPSC Group 4',
      paperTitle: testTitle,
      paperType: 'Prelims',
      medium: 'English',
      totalQuestions: 10,
      marksPerQuestion: 1.5,
      negativeMarking: 0,
      durationMinutes: 180,
      questions: r10.questions.map((q: any) => ({
        originalQuestionNumber: q.originalQuestionNumber,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        subject: q.subject,
        topic: q.topic,
        isDuplicate: q.isDuplicate,
        needsReview: q.needsReview,
      })),
    });

    assert.ok(created && created.paper.id > 0);
    createdPaperId = created.paper.id;
    assert.strictEqual(created.paper.status, 'staging');
    assert.strictEqual(created.questions.length, 10);

    // Duplicate import prevention
    let dupRejected = false;
    try {
      await createPaperFromPastedQuestions({
        group: 'group4',
        year: 2025,
        paperTitle: testTitle,
        medium: 'English',
        questions: r10.questions.map((q: any) => ({
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer: q.correctAnswer,
        })),
      });
    } catch (e: any) {
      assert.strictEqual(e.statusCode, 409);
      dupRejected = true;
    }
    assert.strictEqual(dupRejected, true, 'Duplicate import must be rejected with 409');

    // Staging isolation: MUST NOT appear in student listPreviousPapers()
    const studentBefore = await listPreviousPapers({ category: 'group4', year: 2025 });
    assert.ok(!studentBefore.some((p) => p.id === createdPaperId), 'Staging exam must NOT be visible to students');

    // Publish before approval MUST fail
    let unapprovedBlocked = false;
    try {
      await updateAdminPreviousPaperStatus(createdPaperId, 'published');
    } catch (e: any) {
      assert.strictEqual(e.statusCode, 400);
      unapprovedBlocked = true;
    }
    assert.strictEqual(unapprovedBlocked, true, 'Unapproved exam must be blocked from publishing');

    // Bulk approve all valid questions
    const approvedRes = await approvePaperQuestions(createdPaperId, { approveAllValid: true, isApproved: true });
    assert.ok(approvedRes);
    assert.strictEqual(approvedRes.updatedCount, 10);
    assert.strictEqual(approvedRes.paper?.status, 'approved');

    // Publish after approval succeeds and appears on Student Website
    const pubRes = await updateAdminPreviousPaperStatus(createdPaperId, 'published');
    assert.strictEqual(pubRes?.paper.status, 'published');
    const studentAfter = await listPreviousPapers({ category: 'group4', year: 2025 });
    assert.ok(studentAfter.some((p) => p.id === createdPaperId), 'Published exam must appear on Student Website');

    console.log('✓ 6. Full DB lifecycle verified (Staging -> Duplicate 409 -> Student Isolation -> Approval Gate -> Bulk Approve -> Publish)');
  } finally {
    if (createdPaperId) {
      await deleteAdminPreviousPaper(createdPaperId).catch(() => {});
    }
    await pool.end();
  }

  console.log('\nALL MANUAL PASTE & STAGING TESTS PASSED! ✓');
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
