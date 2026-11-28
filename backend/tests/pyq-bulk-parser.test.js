import assert from 'assert';
import { parsePastedPreviousYearQuestions, parsePastedPreviousYearQuestionsAsync, reprocessSingleQuestion, } from '../../src/utils/previousPaperPasteParser';
import { createPaperFromPastedQuestions, deleteAdminPreviousPaper, } from '../src/services/previousPapersAdminService';
const LETTERS = ['A', 'B', 'C', 'D'];
const TAMIL_LETTERS = ['அ', 'ஆ', 'இ', 'ஈ'];
function buildEnglishQuestions(count, style = 'dot') {
    const parts = [];
    for (let i = 1; i <= count; i++) {
        const ans = LETTERS[(i - 1) % 4];
        const header = style === 'dot'
            ? `${i}.`
            : style === 'paren'
                ? `${i})`
                : style === 'qdot'
                    ? `Q.${i}`
                    : style === 'bold'
                        ? `**${i}.**`
                        : `QUESTION ${i}:`;
        parts.push(`${header} In TNPSC Exam Set ${i}, which constitutional article governs provision number ${100 + i} in India?\n` +
            `(A) Article ${100 + i}\n` +
            `(B) Article ${200 + i}\n` +
            `(C) Article ${300 + i}\n` +
            `(D) Article ${400 + i}\n` +
            `Answer: ${ans}\n` +
            `Explanation: Provision ${100 + i} is defined under option ${ans} in the Indian Constitution.`);
    }
    return parts.join('\n\n');
}
function buildTamilQuestions(count) {
    const parts = [];
    for (let i = 1; i <= count; i++) {
        const ans = TAMIL_LETTERS[(i - 1) % 4];
        parts.push(`கேள்வி ${i}: திருக்குறள் அதிகாரம் ${i} இல் உள்ள குறள்களின் எண்ணிக்கை மற்றும் மையக்கருத்து எது?\n` +
            `(அ) அறத்துப்பால் பகுதி ${i}\n` +
            `(ஆ) பொருட்பால் பகுதி ${i}\n` +
            `(இ) இன்பத்துப்பால் பகுதி ${i}\n` +
            `(ஈ) மேற்கண்ட அனைத்தும் ${i}\n` +
            `சரியான விடை: (${ans})\n` +
            `விளக்கம்: அதிகாரம் ${i} க்கான சரியான விடை (${ans}) ஆகும்.`);
    }
    return parts.join('\n\n');
}
async function runTests() {
    console.log('=== TNPSC Previous Year Questions Bulk Parser 20-Case Test Suite ===');
    // 1. 10 questions
    const r10 = parsePastedPreviousYearQuestions(buildEnglishQuestions(10));
    assert.strictEqual(r10.summary.totalDetected, 10);
    assert.strictEqual(r10.summary.successfullyParsed, 10);
    assert.strictEqual(r10.summary.lostQuestionsEstimate, 0);
    console.log('PASS 01: 10 questions');
    // 2. 50 questions
    const r50 = parsePastedPreviousYearQuestions(buildEnglishQuestions(50, 'paren'));
    assert.strictEqual(r50.summary.totalDetected, 50);
    assert.strictEqual(r50.summary.successfullyParsed, 50);
    console.log('PASS 02: 50 questions');
    // 3. 100 questions
    const r100 = parsePastedPreviousYearQuestions(buildEnglishQuestions(100, 'qdot'));
    assert.strictEqual(r100.summary.totalDetected, 100);
    assert.strictEqual(r100.summary.successfullyParsed, 100);
    console.log('PASS 03: 100 questions');
    // 4. 200 questions (CRITICAL ASSERTION)
    const input200 = buildEnglishQuestions(200, 'bold');
    const r200 = parsePastedPreviousYearQuestions(input200);
    assert.strictEqual(r200.summary.totalDetected, 200, `Expected 200 detected, got ${r200.summary.totalDetected}`);
    assert.strictEqual(r200.summary.successfullyParsed, 200, `Expected 200 valid, got ${r200.summary.successfullyParsed}`);
    assert.strictEqual(r200.questions.length, 200);
    assert.strictEqual(r200.summary.lostQuestionsEstimate, 0);
    assert.strictEqual(r200.questions[0].originalQuestionNumber, '1');
    assert.strictEqual(r200.questions[199].originalQuestionNumber, '200');
    console.log('PASS 04: 200 questions (Total=200, Valid=200, Lost=0)');
    // 5. 500 questions (Async chunked parser with progress updates)
    const progressCalls = [];
    const r500 = await parsePastedPreviousYearQuestionsAsync(buildEnglishQuestions(500, 'question'), 'General Studies', (p) => progressCalls.push(p.processed), 50);
    assert.strictEqual(r500.summary.totalDetected, 500);
    assert.strictEqual(r500.summary.successfullyParsed, 500);
    assert.ok(progressCalls.length >= 10, 'Expected chunked progress callbacks');
    console.log('PASS 05: 500 questions via async chunked parser');
    // 6. 200 Tamil questions
    const rTamil200 = parsePastedPreviousYearQuestions(buildTamilQuestions(200));
    assert.strictEqual(rTamil200.summary.totalDetected, 200);
    assert.strictEqual(rTamil200.summary.successfullyParsed, 200);
    assert.ok(rTamil200.questions[0].questionText.includes('திருக்குறள்'));
    assert.strictEqual(rTamil200.questions[0].correctAnswer, 0);
    assert.strictEqual(rTamil200.questions[1].correctAnswer, 1);
    console.log('PASS 06: 200 Tamil questions');
    // 7. 200 English questions (standard dot format)
    const rEng200 = parsePastedPreviousYearQuestions(buildEnglishQuestions(200, 'dot'));
    assert.strictEqual(rEng200.summary.totalDetected, 200);
    assert.strictEqual(rEng200.summary.successfullyParsed, 200);
    console.log('PASS 07: 200 English questions');
    // 8. Mixed Tamil and English questions (100 Tamil + 100 English = 200)
    const mixedText = buildTamilQuestions(100) + '\n\n' + buildEnglishQuestions(100, 'question');
    const rMixed = parsePastedPreviousYearQuestions(mixedText);
    assert.strictEqual(rMixed.summary.totalDetected, 200);
    assert.strictEqual(rMixed.summary.successfullyParsed, 200);
    console.log('PASS 08: Mixed Tamil + English (200 questions)');
    // 9. Multiline questions
    const multilineText = `1. Consider the following statements about Sangam Literature:
Statement I: Tolkappiyam is the earliest Tamil grammatical work.
Statement II: Ettuthogai consists of eight anthologies.
Which of the statements given above is/are correct?
(A) I only
(B) II only
(C) Both I and II
(D) Neither I nor II
**Answer:** (C)
Answer Explanation: Both Tolkappiyam and Ettuthogai are foundational Sangam works.
They were composed during the classical Tamil period.`;
    const rMulti = parsePastedPreviousYearQuestions(multilineText);
    assert.strictEqual(rMulti.questions.length, 1);
    assert.ok(rMulti.questions[0].questionText.includes('Statement I:'));
    assert.ok(rMulti.questions[0].questionText.includes('Statement II:'));
    assert.strictEqual(rMulti.questions[0].correctAnswer, 2);
    assert.ok(rMulti.questions[0].explanation.includes('classical Tamil period'));
    console.log('PASS 09: Multiline questions & explanations');
    // 10. All option formats: (A)-(D), A)-D), A.-D., (1)-(4), (அ)-(ஈ)
    const optFormats = `1. Format A dot?
A. Alpha
B. Beta
C. Gamma
D. Delta
Answer: A

2. Format numeric parens?
(1) One
(2) Two
(3) Three
(4) Four
Correct Answer: (3)

3. Format Tamil?
(அ) சென்னை
(ஆ) மதுரை
(இ) கோவை
(ஈ) திருச்சி
விடை: (ஆ)`;
    const rOpts = parsePastedPreviousYearQuestions(optFormats);
    assert.strictEqual(rOpts.questions.length, 3);
    assert.strictEqual(rOpts.summary.successfullyParsed, 3);
    assert.strictEqual(rOpts.questions[1].optionC, 'Three');
    assert.strictEqual(rOpts.questions[1].correctAnswer, 2);
    assert.strictEqual(rOpts.questions[2].optionB, 'மதுரை');
    assert.strictEqual(rOpts.questions[2].correctAnswer, 1);
    console.log('PASS 10: All option formats (A., (1)-(4), (அ)-(ஈ))');
    // 11. Inline options (4 on one line & 2-column pairs)
    const inlineText = `1. Capital of Tamil Nadu? (A) Madurai (B) Chennai (C) Salem (D) Trichy
Answer: B

2. River flowing through Thanjavur?
(A) Vaigai   (B) Kaveri
(C) Palar    (D) Tamiraparani
Answer: (B)`;
    const rInline = parsePastedPreviousYearQuestions(inlineText);
    assert.strictEqual(rInline.questions.length, 2);
    assert.strictEqual(rInline.summary.successfullyParsed, 2);
    assert.strictEqual(rInline.questions[0].optionB, 'Chennai');
    assert.strictEqual(rInline.questions[1].optionB, 'Kaveri');
    assert.strictEqual(rInline.questions[1].optionD, 'Tamiraparani');
    console.log('PASS 11: Inline options & 2-column option pairs');
    // 12. Missing answers (never invented)
    const missingAnsText = `1. Which gas is most abundant in Earth's atmosphere?
A) Oxygen
B) Nitrogen
C) Carbon Dioxide
D) Argon`;
    const rMissAns = parsePastedPreviousYearQuestions(missingAnsText);
    assert.strictEqual(rMissAns.questions.length, 1);
    assert.strictEqual(rMissAns.questions[0].correctAnswer, null);
    assert.strictEqual(rMissAns.questions[0].missingAnswer, true);
    assert.ok(rMissAns.questions[0].statusFlags.includes('MISSING_ANSWER'));
    console.log('PASS 12: Missing answer flagged as MISSING_ANSWER (never invented)');
    // 13. Missing options (never invented)
    const missingOptText = `1. Incomplete option question?
A) First option
B) Second option
Answer: A`;
    const rMissOpt = parsePastedPreviousYearQuestions(missingOptText);
    assert.strictEqual(rMissOpt.questions.length, 1);
    assert.strictEqual(rMissOpt.questions[0].missingOptions, true);
    assert.ok(rMissOpt.questions[0].statusFlags.includes('MISSING_OPTIONS'));
    console.log('PASS 13: Missing options flagged as MISSING_OPTIONS');
    // 14. Explanations attached to the right question (never bleeding into next)
    const expText = `1. First question?
A) One
B) Two
C) Three
D) Four
Answer: A
EXPLANATION: First explanation only.

2. Second question?
A) Five
B) Six
C) Seven
D) Eight
Answer: D
விளக்கம்: Second explanation only.`;
    const rExp = parsePastedPreviousYearQuestions(expText);
    assert.strictEqual(rExp.questions.length, 2);
    assert.strictEqual(rExp.questions[0].explanation, 'First explanation only.');
    assert.strictEqual(rExp.questions[1].explanation, 'Second explanation only.');
    console.log('PASS 14: Explanations accurately isolated per question');
    // 15. Duplicate detection (flagged, NOT dropped)
    const dupText = `1. Which planet is known as the Red Planet in our solar system?
A) Earth
B) Mars
C) Jupiter
D) Venus
Answer: B

2. Which planet is known as the Red Planet in our solar system?
A) Earth
B) Mars
C) Jupiter
D) Venus
Answer: B`;
    const rDup = parsePastedPreviousYearQuestions(dupText);
    assert.strictEqual(rDup.questions.length, 2, 'Duplicates must NOT be silently deleted');
    assert.strictEqual(rDup.summary.duplicateCount, 1);
    assert.strictEqual(rDup.questions[1].isDuplicate, true);
    assert.strictEqual(rDup.questions[1].duplicateOfNumber, 1);
    console.log('PASS 15: Duplicate flagged without silently deleting');
    // 16. Mixed numbering formats
    const mixedNums = `1. Dot format?
A) a B) b C) c D) d
Answer: A

2) Paren format?
A) a B) b C) c D) d
Answer: B

Q3. Q-dot format?
A) a B) b C) c D) d
Answer: C

Q.4 Q-period-num format?
A) a B) b C) c D) d
Answer: D

QUESTION 5: Full word format?
A) a B) b C) c D) d
Answer: A

Question No. 6
Question No format on next line?
A) a B) b C) c D) d
Answer: B

07. Leading zero format?
A) a B) b C) c D) d
Answer: C

8 - Dash format?
A) a B) b C) c D) d
Answer: D`;
    const rMixedNums = parsePastedPreviousYearQuestions(mixedNums);
    assert.strictEqual(rMixedNums.questions.length, 8, `Expected 8 numbering formats, got ${rMixedNums.questions.length}`);
    assert.strictEqual(rMixedNums.summary.successfullyParsed, 8);
    console.log('PASS 16: All 8 numbering formats detected');
    // 17. Questions containing numbers in their text (years, counts, embedded list)
    const numbersInText = `15. India gained independence in 1947 and adopted its Constitution in 1950. Consider:
1. Article 14 guarantees equality before law.
2. Article 21 guarantees protection of life and personal liberty.
3. Article 32 provides constitutional remedies.
Which are Fundamental Rights?
(A) 1 and 2 only
(B) 2 and 3 only
(C) 1, 2 and 3
(D) 1 only
Answer: C

16. In 2024, how many Lok Sabha seats exist in Tamil Nadu?
(A) 38
(B) 39
(C) 40
(D) 41
Answer: B`;
    const rNums = parsePastedPreviousYearQuestions(numbersInText);
    assert.strictEqual(rNums.questions.length, 2, `Expected 2 questions (not split on embedded statements), got ${rNums.questions.length}`);
    assert.ok(rNums.questions[0].questionText.includes('Article 32'));
    assert.strictEqual(rNums.questions[1].originalQuestionNumber, '16');
    console.log('PASS 17: Embedded numbers and statement lists preserved inside question stem');
    // 18. Long mathematical questions (preserving *, √, ², π, etc.)
    const mathText = `1. If x² + 5 * x - 14 = 0 and √(y + 9) = 5, find the value of (2 * x + y) / 3 when x > 0 and π ≈ 3.14.
(A) 6
(B) 20/3
(C) 7
(D) 8
Answer: B
Explanation: Solving x² + 5 * x - 14 = 0 gives x = 2 (for x > 0). From √(y + 9) = 5, y = 16. Thus (2 * 2 + 16) / 3 = 20/3.`;
    const rMath = parsePastedPreviousYearQuestions(mathText);
    assert.strictEqual(rMath.questions.length, 1);
    assert.ok(rMath.questions[0].questionText.includes('5 * x'));
    assert.ok(rMath.questions[0].questionText.includes('√(y + 9)'));
    assert.ok(rMath.questions[0].questionText.includes('π'));
    assert.strictEqual(rMath.questions[0].correctAnswer, 1);
    console.log('PASS 18: Mathematical symbols & multiplication asterisks preserved');
    // 19. Large pasted content exceeding 100,000 characters
    const largeText = buildEnglishQuestions(450, 'dot');
    assert.ok(largeText.length > 100_000, `Expected >100,000 chars, got ${largeText.length}`);
    const t0 = Date.now();
    const rLarge = parsePastedPreviousYearQuestions(largeText);
    const elapsedMs = Date.now() - t0;
    assert.strictEqual(rLarge.summary.totalDetected, 450);
    assert.strictEqual(rLarge.summary.successfullyParsed, 450);
    assert.strictEqual(rLarge.summary.contentIncompleteCount, 0);
    console.log(`PASS 19: Large paste (${largeText.length.toLocaleString()} chars, 450 questions) parsed in ${elapsedMs}ms`);
    // 19b. Assertion & Reason + Match the Following + Answer Conflict & Verified Key checks
    const complexTypes = `1. Assertion (A): The Indian Constitution is federal in structure with a unitary bias.
Reason (R): Residuary powers are vested in the Union Parliament under Article 248.
(A) Both (A) and (R) are true and (R) is the correct explanation of (A)
(B) Both (A) and (R) are true but (R) is not the correct explanation of (A)
(C) (A) is true but (R) is false
(D) (A) is false but (R) is true
Answer: (A)

2. Match List I with List II and select the correct answer using the codes given below:
List I (Dynasty)        List II (Emblem)
(a) Chera               1. Tiger
(b) Chola               2. Bow and Arrow
(c) Pandya              3. Fish
(d) Pallava             4. Bull
Codes:
(A) 2 1 3 4
(B) 1 2 3 4
(C) 3 2 1 4
(D) 4 3 2 1
Answer: (B)`;
    const rComplex = parsePastedPreviousYearQuestions(complexTypes, {
        defaultSubject: 'General Studies',
        verifiedAnswerKey: { '1': 'A', '2': 'A' }, // Q1 matches -> VERIFIED; Q2 conflicts (B vs A) -> ANSWER_CONFLICT
    });
    assert.strictEqual(rComplex.questions.length, 2);
    // Assertion & Reason preserved intact
    assert.ok(rComplex.questions[0].questionText.includes('Assertion (A):'));
    assert.ok(rComplex.questions[0].questionText.includes('Reason (R):'));
    assert.strictEqual(rComplex.questions[0].answerVerificationStatus, 'VERIFIED');
    assert.strictEqual(rComplex.questions[0].contentIntegrity.isComplete, true);
    // Match-the-Following table preserved intact in stem, Codes (A)-(D) extracted as options
    assert.ok(rComplex.questions[1].questionText.includes('(a) Chera'), 'Match table row (a) must remain in questionText');
    assert.ok(rComplex.questions[1].questionText.includes('(d) Pallava'), 'Match table row (d) must remain in questionText');
    assert.strictEqual(rComplex.questions[1].optionA, '2 1 3 4');
    assert.strictEqual(rComplex.questions[1].optionD, '4 3 2 1');
    // Conflict detected without silently overwriting originalAnswer
    assert.strictEqual(rComplex.questions[1].answerVerificationStatus, 'ANSWER_CONFLICT');
    assert.strictEqual(rComplex.questions[1].hasAnswerConflict, true);
    assert.strictEqual(rComplex.questions[1].originalAnswer, 1); // B preserved
    assert.strictEqual(rComplex.questions[1].validatedAnswer, 0); // A stored separately
    assert.strictEqual(rComplex.summary.verifiedCount, 1);
    assert.strictEqual(rComplex.summary.answerConflictCount, 1);
    // Individual retry works cleanly
    const retried = reprocessSingleQuestion(rComplex.questions[0]);
    assert.strictEqual(retried.clientId, rComplex.questions[0].clientId);
    assert.strictEqual(retried.contentIntegrity.isComplete, true);
    console.log('PASS 19b: Assertion-Reason, Match-the-Following, VERIFIED vs ANSWER_CONFLICT, Content Integrity & Retry');
    // 20. Save all 200 parsed questions to PostgreSQL Staging & verify exact inserted count
    assert.strictEqual(r200.summary.fullyProcessed, 200);
    assert.strictEqual(r200.summary.contentIncompleteCount, 0);
    const testTitle = `__AUTOTEST_200Q_STAGING_${Date.now()}__`;
    let createdPaperId = 0;
    try {
        const saveStart = Date.now();
        const created = await createPaperFromPastedQuestions({
            group: 'group4',
            year: 2025,
            examStream: 'TNPSC Group 4',
            paperTitle: testTitle,
            paperType: 'Prelims',
            medium: 'English',
            totalQuestions: 200,
            marksPerQuestion: 1.5,
            negativeMarking: 0,
            durationMinutes: 180,
            questions: r200.questions.map((q) => ({
                originalQuestionNumber: q.originalQuestionNumber,
                questionText: q.questionText,
                optionA: q.optionA,
                optionB: q.optionB,
                optionC: q.optionC,
                optionD: q.optionD,
                correctAnswer: q.correctAnswer,
                answerVerificationStatus: q.answerVerificationStatus,
                verificationSource: q.verificationSource,
                medium: q.medium,
                explanation: q.explanation,
                subject: q.subject,
                topic: q.topic,
                isDuplicate: q.isDuplicate,
                needsReview: q.needsReview,
                reviewNote: null,
            })),
        });
        assert.ok(created, 'Expected createPaperFromPastedQuestions to return created paper detail');
        createdPaperId = created.paper.id;
        const savedCount = created.questions.length;
        assert.strictEqual(savedCount, 200, `Expected 200 questions saved to staging, got ${savedCount}`);
        console.log(`PASS 20: Saved all ${savedCount}/200 parsed questions to PostgreSQL Staging in ${Date.now() - saveStart}ms (paperId=${createdPaperId})`);
    }
    finally {
        if (createdPaperId > 0) {
            await deleteAdminPreviousPaper(createdPaperId).catch(() => { });
            console.log(`CLEANUP: Deleted temporary test staging paper #${createdPaperId}`);
        }
    }
    console.log('=== ALL 20 PYQ BULK PARSER & STAGING TESTS PASSED ===');
}
runTests().catch((err) => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
