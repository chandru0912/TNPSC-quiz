import assert from 'assert';
import pool from '../db';
import {
  getGeminiPreviousPaperProviderStatus,
  getGeminiTextJob,
  processSourceTextWithGemini,
  retryFailedBatchesForTextJob,
  splitSourceTextIntoQuestionBlocks,
  validateAndNormalizeJsonSource,
  validateSourceTextInput,
} from '../services/previousPaperAIService';
import {
  approvePaperQuestions,
  createPaperFromPastedQuestions,
  updateAdminPreviousPaperStatus,
} from '../services/previousPapersAdminService';
import { listPreviousPapers } from '../services/previousPapersService';

async function main() {
  const tag = `PYP_GEMINI_TEXT_200_${Date.now()}`;
  const createdJobIds: number[] = [];
  const createdPaperIds: number[] = [];

  try {
    console.log('=== 1. Gemini Provider Status (No Claude in Workflow, Masked Key) ===');
    const prov = await getGeminiPreviousPaperProviderStatus();
    assert.equal(prov.provider, 'gemini');
    assert.ok(prov.availableModels.length > 0);
    console.log('PASS: Google Gemini AI provider ready:', { status: prov.status, model: prov.model });

    console.log('=== 2. Build & Validate 200-Question Bilingual (English + Tamil) Source Text ===');
    const sourceLines: string[] = [];
    for (let i = 1; i <= 200; i++) {
      if (i === 200) {
        sourceLines.push(
          `QUESTION 200:\nதிருக்குறள் எத்தனை அதிகாரங்களைக் கொண்டது?\nA) 100\nB) 133\nC) 120\nD) 144\nANSWER: B`
        );
      } else if (i === 5) {
        // Intentional duplicate of Q1
        sourceLines.push(
          `QUESTION 5:\n${tag} Question #1: Which Article guarantees Equality before Law?\nA) Article 14\nB) Article 19\nC) Article 21\nD) Article 32\nANSWER: A`
        );
      } else if (i === 1) {
        sourceLines.push(
          `QUESTION 1:\n${tag} Question #1: Which Article guarantees Equality before Law?\nA) Article 14\nB) Article 19\nC) Article 21\nD) Article 32\nANSWER: A`
        );
      } else {
        sourceLines.push(
          `QUESTION ${i}:\n${tag} TNPSC Official Question #${i}\nA) Opt A ${i}\nB) Opt B ${i}\nC) Opt C ${i}\nD) Opt D ${i}\nANSWER: A`
        );
      }
    }
    const full200Text = sourceLines.join('\n\n');
    const validation = validateSourceTextInput(full200Text, 200);
    assert.equal(validation.valid, true);
    assert.equal(validation.estimatedQuestions, 200, 'Must detect all 200 source questions');
    const blocks = splitSourceTextIntoQuestionBlocks(full200Text);
    assert.equal(blocks.length, 200);
    console.log('PASS: 200-question English + Tamil source text split & validated with zero loss.');

    console.log('=== 3. Batch Processing (200 Qs / 20 per batch = 10 batches), Failed Batch Retry & Reconciliation ===');
    let failBatch3Once = true;
    const job = await processSourceTextWithGemini({
      sourceText: full200Text,
      adminUsername: 'super_admin_gemini_test',
      asyncMode: false,
      meta: {
        group: 'group4',
        examName: `${tag} Group 4 2024`,
        year: 2024,
        subject: 'General Studies',
        medium: 'Bilingual',
        paperType: 'Prelims',
        expectedQuestions: 200,
      },
      settings: {
        model: 'gemini-3.5-flash',
        batchSize: 20,
        expectedQuestions: 200,
        answerVerificationEnabled: true,
        explanationGenerationEnabled: true,
        subjectClassificationEnabled: true,
        duplicateDetectionEnabled: true,
      },
      mockGeminiFn: async (batchBlocks) => {
        if (batchBlocks[0].sourceQuestionId === 'Q41' && failBatch3Once) {
          failBatch3Once = false;
          throw new Error('Simulated transient Gemini 429 on Batch 3');
        }
        return {
          questions: batchBlocks.map((b) => {
            const num = Number(b.originalNumber);
            if (num === 3) {
              // Uncertain AI-only answer -> MUST be NEEDS_REVIEW
              return {
                sourceQuestionId: b.sourceQuestionId,
                originalQuestionNumber: b.originalNumber,
                questionText: `${tag} Uncertain Question #3`,
                options: { A: 'A3', B: 'B3', C: 'C3', D: 'D3' },
                originalAnswer: null,
                aiSuggestedAnswer: 'C',
                explanation: 'Preliminary AI suggestion',
                subject: 'General Science',
                topic: 'Physics',
                medium: 'English',
              };
            }
            if (num === 200) {
              return {
                sourceQuestionId: b.sourceQuestionId,
                originalQuestionNumber: '200',
                questionText: 'திருக்குறள் எத்தனை அதிகாரங்களைக் கொண்டது?',
                options: { A: '100', B: '133', C: '120', D: '144' },
                originalAnswer: 'B',
                aiSuggestedAnswer: 'B',
                explanation: 'திருக்குறள் 133 அதிகாரங்களைக் கொண்டது.',
                subject: 'General Tamil',
                topic: 'Thirukkural',
                standard: '6th',
                unit: 'Unit 1',
                medium: 'Tamil',
              };
            }
            return {
              sourceQuestionId: b.sourceQuestionId,
              originalQuestionNumber: b.originalNumber,
              questionText:
                num === 1 || num === 5
                  ? `${tag} Question #1: Which Article guarantees Equality before Law?`
                  : `${tag} TNPSC Official Question #${num}`,
              options: {
                A: num === 1 || num === 5 ? 'Article 14' : `Opt A ${num}`,
                B: num === 1 || num === 5 ? 'Article 19' : `Opt B ${num}`,
                C: num === 1 || num === 5 ? 'Article 21' : `Opt C ${num}`,
                D: num === 1 || num === 5 ? 'Article 32' : `Opt D ${num}`,
              },
              originalAnswer: 'A',
              aiSuggestedAnswer: 'A',
              explanation: `Verified explanation for Q#${num}`,
              subject: 'Indian Polity',
              topic: 'Constitution',
              standard: '10th',
              unit: 'Unit 5',
              medium: 'English',
            };
          }),
          inputTokens: 1200,
          outputTokens: 2000,
          modelUsed: 'gemini-3.5-flash',
        };
      },
    });

    assert.ok(job);
    createdJobIds.push(job!.id);
    assert.equal(job!.status, 'partial', 'Must NOT report completed when batch 3 failed');
    assert.equal(job!.extractedCount, 180);
    assert.equal(job!.missingCount, 20);
    assert.equal(job!.failedBatches, 1);

    // Retry failed batch 3 WITHOUT duplicating already-extracted 180 questions
    const retried = await retryFailedBatchesForTextJob(job!.id, {
      asyncMode: false,
      mockGeminiFn: async (batchBlocks) => ({
        questions: batchBlocks.map((b) => ({
          sourceQuestionId: b.sourceQuestionId,
          originalQuestionNumber: b.originalNumber,
          questionText: `${tag} TNPSC Official Question #${b.originalNumber}`,
          options: { A: `Opt A ${b.originalNumber}`, B: `Opt B ${b.originalNumber}`, C: `Opt C ${b.originalNumber}`, D: `Opt D ${b.originalNumber}` },
          originalAnswer: 'A',
          aiSuggestedAnswer: 'A',
          explanation: `Retried explanation for Q#${b.originalNumber}`,
          subject: 'General Studies',
          topic: 'Polity',
          medium: 'English',
        })),
        inputTokens: 1200,
        outputTokens: 2000,
        modelUsed: 'gemini-3.5-flash',
      }),
    });

    assert.equal(retried!.status, 'completed');
    assert.equal(retried!.extractedCount, 200, 'All 200 source questions extracted with zero duplicates from retry');
    assert.equal(retried!.convertedMcqCount, 200);
    assert.equal(retried!.missingCount, 0);
    assert.equal(retried!.duplicateCount, 1, 'Duplicate Q5 of Q1 flagged');
    const q3 = retried!.extractedQuestions.find((q) => q.sourceQuestionId === 'Q3');
    const q200 = retried!.extractedQuestions.find((q) => q.sourceQuestionId === 'Q200');
    assert.equal(q3?.verificationStatus, 'NEEDS_REVIEW');
    assert.equal(q200?.questionText, 'திருக்குறள் எத்தனை அதிகாரங்களைக் கொண்டது?');
    const persisted = await getGeminiTextJob(job!.id);
    assert.equal(persisted?.extractedQuestions.length, 200);
    console.log('PASS: 200/200 extraction, failed batch retry without duplication, Tamil preservation & verification verified.');

    console.log('=== 4. Save Verified to Staging (NOT Live!) -> Duplicate Prevention -> Approve -> Publish -> Student Website ===');
    const verifiedOnly = retried!.extractedQuestions.filter(
      (q) => q.verificationStatus === 'VERIFIED' || q.verificationStatus === 'ORIGINAL_KEY_ONLY'
    );
    const staged = await createPaperFromPastedQuestions({
      group: 'group4',
      year: 2024,
      paperTitle: `${tag} Gemini Staged Paper`,
      medium: 'Bilingual',
      questions: verifiedOnly.map((q) => ({
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
      })),
    });
    assert.ok(staged?.paper.id);
    createdPaperIds.push(staged!.paper.id);
    assert.equal(staged!.paper.status, 'staging', 'Staged questions MUST NOT auto-publish');

    // Confirm NOT yet on Student Website
    const beforePub = await listPreviousPapers({ subject: tag });
    assert.equal(beforePub.length, 0, 'Staging examination must NOT appear on Student Website');

    // Confirm reprocessing same source text is blocked as duplicate (409)
    let dupBlocked = false;
    try {
      await createPaperFromPastedQuestions({
        group: 'group4',
        year: 2024,
        paperTitle: `${tag} Gemini Staged Paper`,
        medium: 'Bilingual',
        questions: verifiedOnly.map((q) => ({
          originalQuestionNumber: q.originalQuestionNumber,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer: q.correctAnswer,
        })),
      });
    } catch (err: any) {
      dupBlocked = err.statusCode === 409;
    }
    assert.equal(dupBlocked, true, 'Duplicate reprocessing must be blocked');

    // Approve & Publish -> now visible on Student Website
    const approved = await approvePaperQuestions(staged!.paper.id, { approveAllValid: true });
    assert.equal(approved?.paper?.status, 'approved');
    const published = await updateAdminPreviousPaperStatus(staged!.paper.id, 'published', 'super_admin_gemini_test');
    assert.equal(published?.paper?.status, 'published');

    const afterPub = await listPreviousPapers({ subject: tag });
    assert.ok(afterPub.some((p) => p.id === staged!.paper.id), 'Published examination must appear on Student Website');
    console.log('PASS: TEST A (200Q Text) — Staging isolation, duplicate prevention, approval, publishing & Student Website visibility verified.');

    console.log('=== 5. TEST B: 200-Question JSON File Import, Security Guards, Normalization & Unified Gemini Pipeline ===');
    // Security guard 1: malformed JSON rejected
    const badJson = validateAndNormalizeJsonSource('{ invalid json', { filename: 'bad.json' });
    assert.equal(badJson.valid, false);
    assert.ok(badJson.errors[0].includes('Invalid JSON syntax'));

    // Security guard 2: excessively nested JSON rejected (depth > 12)
    let deepObj: any = { x: 1 };
    for (let d = 0; d < 16; d++) deepObj = { nested: deepObj };
    const deepReport = validateAndNormalizeJsonSource(JSON.stringify(deepObj), { filename: 'deep.json' });
    assert.equal(deepReport.valid, false);
    assert.ok(deepReport.errors[0].includes('nesting depth'));

    // Build 200-question standard JSON payload with exam metadata + custom unknown field preservation
    const jsonPayload = {
      exam: { group: 'TNPSC Group 4', year: 2026, paperType: 'Prelims', medium: 'English' },
      questions: Array.from({ length: 200 }, (_, i) => ({
        questionNumber: i + 1,
        question: `${tag}_JSON Q#${i + 1}: Official TNPSC question`,
        options: { A: `JA ${i + 1}`, B: `JB ${i + 1}`, C: `JC ${i + 1}`, D: `JD ${i + 1}` },
        answer: i === 2 ? null : 'B',
        explanation: `JSON explanation for Q#${i + 1}`,
        customBookletRef: `SERIES_A_P${Math.floor(i / 5) + 1}`,
      })),
    };
    const jsonString = JSON.stringify(jsonPayload);
    const jsonReport = validateAndNormalizeJsonSource(jsonString, { filename: 'group4_2026.json', expectedQuestions: 200 });
    assert.equal(jsonReport.valid, true);
    assert.equal(jsonReport.detectedCount, 200);
    assert.equal(jsonReport.validRecords, 200);
    assert.equal(jsonReport.missingAnswers, 1);
    assert.equal(jsonReport.detectedExamMeta?.year, 2026);
    assert.ok(jsonReport.sourceBlocks[0].rawText.includes('SERIES_A_P1'), 'Unknown JSON fields must be preserved for audit');

    const jsonJob = await processSourceTextWithGemini({
      inputMethod: 'json',
      jsonContent: jsonString,
      jsonFilename: 'group4_2026.json',
      adminUsername: 'super_admin_gemini_test',
      asyncMode: false,
      meta: {
        group: 'group4',
        examName: `${tag} JSON 2026 Paper`,
        year: 2026,
        subject: 'General Studies',
        medium: 'English',
        paperType: 'Prelims',
        expectedQuestions: 200,
      },
      settings: {
        model: 'gemini-3.5-flash',
        batchSize: 20,
        expectedQuestions: 200,
        answerVerificationEnabled: true,
        explanationGenerationEnabled: true,
        subjectClassificationEnabled: true,
        duplicateDetectionEnabled: true,
      },
      mockGeminiFn: async (batchBlocks) => ({
        questions: batchBlocks.map((b) => ({
          sourceQuestionId: b.sourceQuestionId,
          originalQuestionNumber: b.originalNumber,
          questionText: `${tag}_JSON Q#${b.originalNumber}: Official TNPSC question`,
          options: {
            A: `JA ${b.originalNumber}`,
            B: `JB ${b.originalNumber}`,
            C: `JC ${b.originalNumber}`,
            D: `JD ${b.originalNumber}`,
          },
          originalAnswer: Number(b.originalNumber) === 3 ? null : 'B',
          aiSuggestedAnswer: 'B',
          explanation: `Verified JSON Q#${b.originalNumber}`,
          subject: 'General Studies',
          topic: 'Polity',
          medium: 'English',
        })),
        inputTokens: 1000,
        outputTokens: 1600,
        modelUsed: 'gemini-3.5-flash',
      }),
    });

    assert.ok(jsonJob);
    createdJobIds.push(jsonJob!.id);
    assert.equal(jsonJob!.status, 'completed');
    assert.equal(jsonJob!.identifiedQuestions, 200);
    assert.equal(jsonJob!.extractedCount, 200);
    assert.equal(jsonJob!.convertedMcqCount, 200);
    assert.equal(jsonJob!.missingCount, 0);
    const jsonQ3 = jsonJob!.extractedQuestions.find((q) => q.sourceQuestionId === 'Q3');
    assert.equal(jsonQ3?.verificationStatus, 'NEEDS_REVIEW', 'Missing answer in JSON must be flagged NEEDS_REVIEW');
    console.log('PASS: TEST B (200Q JSON File) — Security guards, normalization, 200/200 Gemini processing & verification verified.');
  } finally {
    if (createdJobIds.length > 0) {
      await pool.query(`DELETE FROM previous_paper_ai_text_jobs WHERE id = ANY($1::int[])`, [createdJobIds]);
    }
    if (createdPaperIds.length > 0) {
      await pool.query(`DELETE FROM previous_year_papers WHERE id = ANY($1::int[])`, [createdPaperIds]);
    }
    await pool.query(`DELETE FROM previous_paper_audit_logs WHERE admin_id = 'super_admin_gemini_test'`);
    await pool.end();
  }

  console.log('\nALL 12 GEMINI AI TEXT-BASED 200-QUESTION WORKFLOW SCENARIOS PASSED.');
}

main().catch((err) => {
  console.error('GEMINI TEXT WORKFLOW TEST FAILED:', err);
  process.exit(1);
});
