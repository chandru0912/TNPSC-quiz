/**
 * aiSyllabusJobService.test.ts
 *
 * End-to-end verification of asynchronous background syllabus analysis & batched
 * textbook matching across 1, 5, and all 72 Samacheer Kalvi textbooks in PostgreSQL,
 * plus Pause/Resume, Retry Failed Batches, Single Parent Unit deduplication,
 * and database safety preservation.
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import pool from '../src/db';
import { AISyllabusJobService } from '../src/services/aiSyllabusJobService';
import { AISyllabusEngineService } from '../src/services/aiSyllabusEngineService';
import type { CanonicalUnitDraft } from '../src/types/aiSyllabusTypes';

function buildCanonicalUnits(): CanonicalUnitDraft[] {
  return [
    {
      unit_number: 1,
      unit_code: 'Unit I',
      title: 'General Science',
      syllabus_topics: ['Nature of Universe', 'Mechanics', 'Physics', 'Chemistry', 'Biology'],
      lessons: [],
      selected_for_publish: true,
    },
    {
      unit_number: 4,
      unit_code: 'Unit IV',
      title: 'History and Culture of India',
      syllabus_topics: ['Indus valley civilization', 'Guptas', 'Delhi Sultans', 'South Indian history'],
      lessons: [],
      selected_for_publish: true,
    },
    {
      unit_number: 10,
      unit_code: 'Unit X',
      title: 'Aptitude and Mental Ability',
      syllabus_topics: ['Simplification', 'Percentage', 'HCF', 'LCM', 'Ratio and Proportion'],
      lessons: [],
      selected_for_publish: true,
    },
  ];
}

async function runTests() {
  console.log('=== STARTING AI SYLLABUS BACKGROUND JOB TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;
  const createdJobIds: string[] = [];

  // Snapshot DB safety baseline before running tests
  const beforeCounts = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM google_drive_materials) AS textbooks,
      (SELECT count(*)::int FROM syllabus_units) AS units,
      (SELECT count(*)::int FROM syllabus_lessons) AS lessons
  `);
  const baseline = beforeCounts.rows[0];
  console.log(
    `[Baseline] google_drive_materials=${baseline.textbooks}, syllabus_units=${baseline.units}, syllabus_lessons=${baseline.lessons}\n`
  );

  // Fetch all active textbook IDs from PostgreSQL
  const tbRes = await pool.query(
    `SELECT id FROM google_drive_materials WHERE upload_status = 'completed' ORDER BY standard ASC, term ASC, id ASC`
  );
  const allTextbookIds: number[] = tbRes.rows.map((r: any) => Number(r.id));

  if (allTextbookIds.length !== 72) {
    console.warn(`[Warning] Expected 72 completed textbooks in DB, found ${allTextbookIds.length}.`);
  }

  // ---------------------------------------------------------------------------
  // Test 1: 1 Textbook background job
  // ---------------------------------------------------------------------------
  try {
    console.log('[Test 1] Background job with 1 textbook:');
    const start = Date.now();
    const job = await AISyllabusJobService.startJob(
      {
        examId: 'group1',
        rawText: 'UNIT-I: GENERAL SCIENCE\n(i) Physics and Biology',
        textbookIds: allTextbookIds.slice(0, 1),
        selectedStandards: [6, 7, 8, 9, 10, 11, 12],
        batchSize: 5,
      },
      {
        analyzeSyllabusFn: async () => buildCanonicalUnits(),
        batchDelayMs: 0,
      }
    );
    createdJobIds.push(job.id);

    const done = await AISyllabusJobService.waitForJobCompletion(job.id, 15000);
    if (
      !done ||
      done.status !== 'completed' ||
      done.totalTextbooks !== 1 ||
      done.processedTextbooks !== 1 ||
      done.successfulTextbooks !== 1 ||
      done.failedTextbooks !== 0 ||
      done.progressPercent !== 100
    ) {
      throw new Error(`Unexpected 1-textbook result: ${JSON.stringify(done)}`);
    }
    console.log(`  -> PASS: 1 textbook completed in ${Date.now() - start}ms (units=${done.units.length}).\n`);
    passed++;
  } catch (e: any) {
    console.error('  -> FAIL [Test 1]:', e.message, '\n');
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Test 2: 5 Textbooks background job
  // ---------------------------------------------------------------------------
  try {
    console.log('[Test 2] Background job with 5 textbooks:');
    const start = Date.now();
    const job = await AISyllabusJobService.startJob(
      {
        examId: 'group1',
        rawText: 'UNIT-I: GENERAL SCIENCE\nUNIT-IV: HISTORY\nUNIT-X: APTITUDE',
        textbookIds: allTextbookIds.slice(0, 5),
        selectedStandards: [6, 7, 8, 9, 10, 11, 12],
        batchSize: 5,
      },
      {
        analyzeSyllabusFn: async () => buildCanonicalUnits(),
        batchDelayMs: 0,
      }
    );
    createdJobIds.push(job.id);

    const done = await AISyllabusJobService.waitForJobCompletion(job.id, 15000);
    if (
      !done ||
      done.status !== 'completed' ||
      done.totalTextbooks !== 5 ||
      done.processedTextbooks !== 5 ||
      done.successfulTextbooks !== 5 ||
      done.failedTextbooks !== 0 ||
      done.progressPercent !== 100
    ) {
      throw new Error(`Unexpected 5-textbook result: ${JSON.stringify(done)}`);
    }
    const matchedTotal = done.units.reduce((s, u) => s + (u.lessons?.length || 0), 0);
    console.log(`  -> PASS: 5 textbooks completed in ${Date.now() - start}ms (matchedLessons=${matchedTotal}).\n`);
    passed++;
  } catch (e: any) {
    console.error('  -> FAIL [Test 2]:', e.message, '\n');
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Test 3: All 72 Textbooks in batches (non-blocking background execution)
  // ---------------------------------------------------------------------------
  let all72LessonsCount = 0;
  try {
    console.log(`[Test 3] Background job with all ${allTextbookIds.length} textbooks (batchSize=5):`);
    const start = Date.now();
    const job = await AISyllabusJobService.startJob(
      {
        examId: 'group1',
        rawText: 'UNIT-I: GENERAL SCIENCE\nUNIT-IV: HISTORY\nUNIT-X: APTITUDE',
        textbookIds: allTextbookIds,
        selectedStandards: [6, 7, 8, 9, 10, 11, 12],
        batchSize: 5,
      },
      {
        analyzeSyllabusFn: async () => buildCanonicalUnits(),
        batchDelayMs: 0,
      }
    );
    createdJobIds.push(job.id);

    if (job.status !== 'queued' && job.status !== 'analyzing') {
      throw new Error(`Expected startJob to return immediately before blocking, got status=${job.status}`);
    }

    const done = await AISyllabusJobService.waitForJobCompletion(job.id, 30000);
    if (
      !done ||
      done.status !== 'completed' ||
      done.totalTextbooks !== allTextbookIds.length ||
      done.processedTextbooks !== allTextbookIds.length ||
      done.successfulTextbooks !== allTextbookIds.length ||
      done.failedTextbooks !== 0 ||
      done.progressPercent !== 100
    ) {
      throw new Error(`Unexpected 72-textbook job result: status=${done?.status}, processed=${done?.processedTextbooks}/${done?.totalTextbooks}`);
    }

    // Verify Single Parent Unit rule (distinct unit_numbers = 3, zero duplicate parent units)
    const unitNums = new Set(done.units.map((u) => u.unit_number));
    all72LessonsCount = done.units.reduce((s, u) => s + (u.lessons?.length || 0), 0);
    if (unitNums.size !== done.units.length || all72LessonsCount === 0) {
      throw new Error(`Single Parent Unit violation or zero lessons matched: unitNums=${unitNums.size}, lessons=${all72LessonsCount}`);
    }

    console.log(
      `  -> PASS: ${allTextbookIds.length} textbooks across ${done.batches.length} batches finished in ${Date.now() - start}ms (Single Parent Units=${done.units.length}, matchedLessons=${all72LessonsCount}).\n`
    );
    passed++;
  } catch (e: any) {
    console.error('  -> FAIL [Test 3]:', e.message, '\n');
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Test 4: Pause & Resume without repeating Stage 1 or duplicating lessons
  // ---------------------------------------------------------------------------
  try {
    console.log('[Test 4] Pause & Resume without repeating Stage 1 or duplicating lessons:');
    let analyzeCalls = 0;
    const subsetIds = allTextbookIds.slice(0, 15);
    const job = await AISyllabusJobService.startJob(
      {
        examId: 'group1',
        rawText: 'UNIT-I: GENERAL SCIENCE\nUNIT-IV: HISTORY\nUNIT-X: APTITUDE',
        textbookIds: subsetIds,
        selectedStandards: [6, 7, 8, 9, 10, 11, 12],
        batchSize: 5,
      },
      {
        analyzeSyllabusFn: async () => {
          analyzeCalls++;
          return buildCanonicalUnits();
        },
        batchDelayMs: 60,
      }
    );
    createdJobIds.push(job.id);

    // Wait briefly until first batch starts/finishes then pause
    await new Promise((r) => setTimeout(r, 90));
    const paused = await AISyllabusJobService.pauseJob(job.id);
    const settledPause = await AISyllabusJobService.waitForJobCompletion(job.id, 10000);
    if (!paused || !settledPause || settledPause.status !== 'paused') {
      throw new Error(`Expected paused status, got ${settledPause?.status}`);
    }
    const processedBeforeResume = settledPause.processedTextbooks;

    // Resume from checkpoint
    const resumed = await AISyllabusJobService.resumeJob(job.id, {
      analyzeSyllabusFn: async () => {
        analyzeCalls++;
        return buildCanonicalUnits();
      },
      batchDelayMs: 0,
    });
    if (!resumed) throw new Error('Resume returned null');
    const finished = await AISyllabusJobService.waitForJobCompletion(job.id, 15000);
    if (!finished || finished.status !== 'completed' || finished.processedTextbooks !== 15) {
      throw new Error(`Expected resumed completion with 15 textbooks, got ${finished?.status} (${finished?.processedTextbooks})`);
    }
    if (analyzeCalls !== 1) {
      throw new Error(`Expected Stage 1 analyzeCalls === 1 (cached across resume), got ${analyzeCalls}`);
    }

    // Compare against a clean single-pass run to guarantee zero duplicate lessons
    const directUnits = await AISyllabusEngineService.matchTextbooks(buildCanonicalUnits(), subsetIds);
    const directCount = directUnits.reduce((s, u) => s + (u.lessons?.length || 0), 0);
    const resumedCount = finished.units.reduce((s, u) => s + (u.lessons?.length || 0), 0);
    if (directCount !== resumedCount) {
      throw new Error(`Lesson count mismatch after resume: expected ${directCount}, got ${resumedCount}`);
    }

    console.log(
      `  -> PASS: Paused at ${processedBeforeResume}/15, resumed cleanly with analyzeCalls=${analyzeCalls}, lessons=${resumedCount} (exact match, 0 duplicates).\n`
    );
    passed++;
  } catch (e: any) {
    console.error('  -> FAIL [Test 4]:', e.message, '\n');
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Test 5: Retry Failed Batches without repeating completed batches
  // ---------------------------------------------------------------------------
  try {
    console.log('[Test 5] Retry Failed Batches without repeating successful batches:');
    const subsetIds = allTextbookIds.slice(0, 10); // 2 batches of 5
    const executedBatchesOnFirstRun: number[] = [];
    const executedBatchesOnRetry: number[] = [];
    let failSecondBatch = true;

    const job = await AISyllabusJobService.startJob(
      {
        examId: 'group1',
        rawText: 'UNIT-I: GENERAL SCIENCE\nUNIT-IV: HISTORY\nUNIT-X: APTITUDE',
        textbookIds: subsetIds,
        selectedStandards: [6, 7, 8, 9, 10, 11, 12],
        batchSize: 5,
      },
      {
        analyzeSyllabusFn: async () => buildCanonicalUnits(),
        matchBatchFn: async (units, ids, opts) => {
          const isSecondBatch = ids.some((id) => subsetIds.slice(5).includes(id));
          if (failSecondBatch) {
            executedBatchesOnFirstRun.push(isSecondBatch ? 1 : 0);
            if (isSecondBatch) {
              throw new Error('Simulated batch 2 failure');
            }
          } else {
            executedBatchesOnRetry.push(isSecondBatch ? 1 : 0);
          }
          return AISyllabusEngineService.matchTextbooksBatch(units, ids, opts);
        },
        batchDelayMs: 0,
      }
    );
    createdJobIds.push(job.id);

    const partial = await AISyllabusJobService.waitForJobCompletion(job.id, 15000);
    if (
      !partial ||
      partial.status !== 'completed_with_errors' ||
      partial.successfulTextbooks !== 5 ||
      partial.failedTextbooks !== 5
    ) {
      throw new Error(`Expected completed_with_errors (5 ok, 5 failed), got ${JSON.stringify(partial)}`);
    }

    // Now clear fault and call retryFailed
    failSecondBatch = false;
    await AISyllabusJobService.retryFailed(job.id);
    const finalJob = await AISyllabusJobService.waitForJobCompletion(job.id, 15000);

    if (
      !finalJob ||
      finalJob.status !== 'completed' ||
      finalJob.successfulTextbooks !== 10 ||
      finalJob.failedTextbooks !== 0
    ) {
      throw new Error(`Expected clean completion after retryFailed, got status=${finalJob?.status}, ok=${finalJob?.successfulTextbooks}, fail=${finalJob?.failedTextbooks}`);
    }

    if (executedBatchesOnRetry.length !== 1 || executedBatchesOnRetry[0] !== 1) {
      throw new Error(`Expected ONLY failed batch [1] to re-run, got [${executedBatchesOnRetry.join(',')}]`);
    }

    const directUnits = await AISyllabusEngineService.matchTextbooks(buildCanonicalUnits(), subsetIds);
    const directCount = directUnits.reduce((s, u) => s + (u.lessons?.length || 0), 0);
    const retriedCount = finalJob.units.reduce((s, u) => s + (u.lessons?.length || 0), 0);
    if (directCount !== retriedCount) {
      throw new Error(`Lesson count mismatch after retryFailed: expected ${directCount}, got ${retriedCount}`);
    }

    console.log(
      `  -> PASS: Retry ran ONLY batch [${executedBatchesOnRetry.join(',')}], final lessons=${retriedCount} (0 duplicates).\n`
    );
    passed++;
  } catch (e: any) {
    console.error('  -> FAIL [Test 5]:', e.message, '\n');
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Cleanup synthetic test jobs & verify DB baseline preservation
  // ---------------------------------------------------------------------------
  if (createdJobIds.length > 0) {
    await pool.query(`DELETE FROM ai_syllabus_import_jobs WHERE id = ANY($1::varchar[])`, [createdJobIds]);
  }

  const afterCounts = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM google_drive_materials) AS textbooks,
      (SELECT count(*)::int FROM syllabus_units) AS units,
      (SELECT count(*)::int FROM syllabus_lessons) AS lessons
  `);
  const after = afterCounts.rows[0];
  if (
    after.textbooks !== baseline.textbooks ||
    after.units !== baseline.units ||
    after.lessons !== baseline.lessons
  ) {
    console.error('  -> FAIL [DB Safety]: Counts changed during background job tests!', { baseline, after });
    failed++;
  } else {
    console.log(
      `[Test 6] DB Safety Verified: textbooks=${after.textbooks}, units=${after.units}, lessons=${after.lessons} preserved untouched.\n`
    );
    passed++;
  }

  console.log(`=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(async (err) => {
  console.error('Fatal test runner error:', err);
  await pool.end();
  process.exit(1);
});
