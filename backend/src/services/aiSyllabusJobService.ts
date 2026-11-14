/**
 * aiSyllabusJobService.ts
 *
 * Asynchronous background job orchestrator for the AI Syllabus Import Engine.
 * Eliminates the 30-second HTTP timeout by running Stage 1 (Gemini syllabus analysis)
 * and Stage 2 (batched Samacheer textbook matching across Classes 6-12) in persistent
 * PostgreSQL-backed background jobs with Pause, Resume, and Retry-Failed support.
 */

import pool from '../db';
import { AISyllabusEngineService } from './aiSyllabusEngineService';
import type {
  CanonicalUnitDraft,
  SyllabusImportJobSnapshot,
  SyllabusJobBatch,
  SyllabusJobStage,
  SyllabusJobStatus,
} from '../types/aiSyllabusTypes';

export interface StartSyllabusJobInput {
  examId: string;
  rawText: string;
  textbookIds: number[];
  selectedStandards?: number[];
  batchSize?: number;
  targetSubject?: string;
}

export interface JobExecutionHooks {
  analyzeSyllabusFn?: (examId: string, rawText: string, targetSubject?: string) => Promise<CanonicalUnitDraft[]>;
  matchBatchFn?: (
    units: CanonicalUnitDraft[],
    batchTextbookIds: number[],
    options?: {
      selectedStandards?: number[];
      onTextbookStart?: (tb: { id: number; file_name: string }) => Promise<void> | void;
    }
  ) => Promise<{
    units: CanonicalUnitDraft[];
    processedTextbooks: Array<{ id: number; fileName: string; matchedLessons: number }>;
  }>;
  batchDelayMs?: number;
}

interface JobRow {
  id: string;
  exam_id: string;
  raw_text: string;
  target_subject?: string | null;
  selected_standards: number[];
  selected_textbook_ids: number[];
  status: SyllabusJobStatus;
  stage: SyllabusJobStage;
  batch_size: number;
  total_textbooks: number;
  processed_textbooks: number;
  successful_textbooks: number;
  failed_textbooks: number;
  current_textbook: string | null;
  progress_percent: number;
  analyzed_units: CanonicalUnitDraft[];
  units: CanonicalUnitDraft[];
  batches: SyllabusJobBatch[];
  error_message: string | null;
  error_status: number | null;
  error_type: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function rowToSnapshot(row: JobRow): SyllabusImportJobSnapshot {
  return {
    id: row.id,
    examId: row.exam_id,
    targetSubject: row.target_subject || null,
    selectedStandards: Array.isArray(row.selected_standards) ? row.selected_standards : [],
    selectedTextbookIds: Array.isArray(row.selected_textbook_ids) ? row.selected_textbook_ids : [],
    status: row.status,
    stage: row.stage,
    batchSize: Number(row.batch_size) || 5,
    totalTextbooks: Number(row.total_textbooks) || 0,
    processedTextbooks: Number(row.processed_textbooks) || 0,
    successfulTextbooks: Number(row.successful_textbooks) || 0,
    failedTextbooks: Number(row.failed_textbooks) || 0,
    currentTextbook: row.current_textbook || null,
    progressPercent: Number(row.progress_percent) || 0,
    analyzedUnitsCount: Array.isArray(row.analyzed_units) ? row.analyzed_units.length : 0,
    units: Array.isArray(row.units) ? row.units : [],
    batches: Array.isArray(row.batches) ? row.batches : [],
    errorMessage: row.error_message || null,
    errorStatus: row.error_status ?? null,
    errorType: row.error_type || null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class AISyllabusJobService {
  private static schemaReadyPromise: Promise<void> | null = null;
  private static activeRunners = new Set<string>();
  private static pauseRequested = new Set<string>();
  private static jobHooks = new Map<string, JobExecutionHooks>();
  private static runningPromises = new Map<string, Promise<void>>();

  /**
   * Ensure persistent job tracking table exists in PostgreSQL
   */
  static async ensureSchema(): Promise<void> {
    if (!this.schemaReadyPromise) {
      this.schemaReadyPromise = pool
        .query(`
          CREATE TABLE IF NOT EXISTS ai_syllabus_import_jobs (
            id VARCHAR(64) PRIMARY KEY,
            exam_id VARCHAR(50) NOT NULL,
            raw_text TEXT NOT NULL,
            selected_standards JSONB NOT NULL DEFAULT '[]'::jsonb,
            selected_textbook_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            status VARCHAR(32) NOT NULL DEFAULT 'queued',
            stage VARCHAR(32) NOT NULL DEFAULT 'analyze',
            batch_size INT NOT NULL DEFAULT 5,
            total_textbooks INT NOT NULL DEFAULT 0,
            processed_textbooks INT NOT NULL DEFAULT 0,
            successful_textbooks INT NOT NULL DEFAULT 0,
            failed_textbooks INT NOT NULL DEFAULT 0,
            current_textbook TEXT,
            progress_percent INT NOT NULL DEFAULT 0,
            analyzed_units JSONB NOT NULL DEFAULT '[]'::jsonb,
            units JSONB NOT NULL DEFAULT '[]'::jsonb,
            batches JSONB NOT NULL DEFAULT '[]'::jsonb,
            error_message TEXT,
            error_status INT,
            error_type VARCHAR(64),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_ai_syllabus_jobs_status ON ai_syllabus_import_jobs (status, created_at DESC);
          ALTER TABLE ai_syllabus_import_jobs ADD COLUMN IF NOT EXISTS target_subject VARCHAR(100);
        `)
        .then(() => undefined)
        .catch((err) => {
          this.schemaReadyPromise = null;
          throw err;
        });
    }
    return this.schemaReadyPromise;
  }

  /**
   * Create and immediately enqueue a background Analyze & Match job.
   */
  static async startJob(
    input: StartSyllabusJobInput,
    hooks?: JobExecutionHooks
  ): Promise<SyllabusImportJobSnapshot> {
    await this.ensureSchema();

    const examId = String(input.examId || 'group1').trim();
    const rawText = String(input.rawText || '').trim();
    if (!rawText) {
      const err: any = new Error('examId and rawText are required.');
      err.statusCode = 400;
      throw err;
    }

    const selectedStandards = Array.isArray(input.selectedStandards)
      ? input.selectedStandards.map(Number).filter((n) => Number.isFinite(n) && n >= 6 && n <= 12)
      : [];

    const rawTextbookIds = Array.isArray(input.textbookIds)
      ? Array.from(new Set(input.textbookIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)))
      : [];

    // Resolve textbooks from PostgreSQL against selected standards
    let filteredTextbookIds: number[] = [];
    if (selectedStandards.length > 0) {
      if (rawTextbookIds.length > 0) {
        const tbRes = await pool.query(
          `SELECT id, standard
           FROM google_drive_materials
           WHERE id = ANY($1::int[])
             AND upload_status = 'completed'
             AND standard = ANY($2::int[])
           ORDER BY standard ASC, term ASC, id ASC`,
          [rawTextbookIds, selectedStandards]
        );
        const coveredStds = new Set(tbRes.rows.map((r: any) => Number(r.standard)));
        const missingStds = selectedStandards.filter((s) => s <= 10 && !coveredStds.has(s));
        if (missingStds.length === 0) {
          filteredTextbookIds = tbRes.rows.map((r: any) => Number(r.id));
        } else {
          const allTbRes = await pool.query(
            `SELECT id
             FROM google_drive_materials
             WHERE upload_status = 'completed'
               AND standard = ANY($1::int[])
             ORDER BY standard ASC, term ASC, id ASC`,
            [selectedStandards]
          );
          filteredTextbookIds = allTbRes.rows.map((r: any) => Number(r.id));
        }
      } else {
        const allTbRes = await pool.query(
          `SELECT id
           FROM google_drive_materials
           WHERE upload_status = 'completed'
             AND standard = ANY($1::int[])
           ORDER BY standard ASC, term ASC, id ASC`,
          [selectedStandards]
        );
        filteredTextbookIds = allTbRes.rows.map((r: any) => Number(r.id));
      }
    } else if (rawTextbookIds.length > 0) {
      const tbRes = await pool.query(
        `SELECT id
         FROM google_drive_materials
         WHERE id = ANY($1::int[])
           AND upload_status = 'completed'
         ORDER BY standard ASC, term ASC, id ASC`,
        [rawTextbookIds]
      );
      filteredTextbookIds = tbRes.rows.map((r: any) => Number(r.id));
    }

    const batchSize = Math.max(1, Math.min(20, Number(input.batchSize) || 5));
    const batches: SyllabusJobBatch[] = [];
    for (let i = 0; i < filteredTextbookIds.length; i += batchSize) {
      batches.push({
        batchIndex: batches.length,
        textbookIds: filteredTextbookIds.slice(i, i + batchSize),
        status: 'pending',
        succeededIds: [],
        failedIds: [],
      });
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const insertRes = await pool.query<JobRow>(
      `INSERT INTO ai_syllabus_import_jobs (
        id, exam_id, target_subject, raw_text, selected_standards, selected_textbook_ids,
        status, stage, batch_size, total_textbooks, processed_textbooks,
        successful_textbooks, failed_textbooks, current_textbook, progress_percent,
        analyzed_units, units, batches
      ) VALUES (
        $1, $2, $3, $4, $5::jsonb, $6::jsonb,
        'queued', 'analyze', $7, $8, 0,
        0, 0, $9, 0,
        '[]'::jsonb, '[]'::jsonb, $10::jsonb
      )
      RETURNING *`,
      [
        jobId,
        examId,
        input.targetSubject || null,
        rawText,
        JSON.stringify(selectedStandards),
        JSON.stringify(filteredTextbookIds),
        batchSize,
        filteredTextbookIds.length,
        'Initializing background syllabus analysis...',
        JSON.stringify(batches),
      ]
    );

    if (hooks) {
      this.jobHooks.set(jobId, hooks);
    }

    const snapshot = rowToSnapshot(insertRes.rows[0]);
    this.scheduleRunner(jobId);
    return snapshot;
  }

  /**
   * Fetch current job snapshot from PostgreSQL.
   * Detects stalled/orphaned runners and recovers or safely updates their status.
   */
  static async getJob(jobId: string): Promise<SyllabusImportJobSnapshot | null> {
    await this.ensureSchema();
    const res = await pool.query<JobRow>(`SELECT * FROM ai_syllabus_import_jobs WHERE id = $1 LIMIT 1`, [jobId]);
    if (res.rows.length === 0) return null;

    let row = res.rows[0];

    // Detect orphaned runners (e.g. server restart or uncaught termination)
    const isRunningStatus = row.status === 'analyzing' || row.status === 'matching' || row.status === 'queued';
    const isRunnerActive = this.activeRunners.has(jobId);

    if (isRunningStatus && !isRunnerActive) {
      const updatedAtMs = new Date(row.updated_at).getTime();
      const stalledMs = Date.now() - updatedAtMs;

      // If idle for over 60 seconds with no active in-memory runner
      if (stalledMs > 60000) {
        const hasAnalyzedUnits = Array.isArray(row.analyzed_units) && row.analyzed_units.length > 0;
        if (hasAnalyzedUnits) {
          console.info(`[AISyllabusJobService] Reviving orphaned Stage 2 matching runner for ${jobId}`);
          this.scheduleRunner(jobId);
        } else {
          console.warn(`[AISyllabusJobService] Marking orphaned Stage 1 runner as failed for ${jobId}`);
          const failRes = await pool.query<JobRow>(
            `UPDATE ai_syllabus_import_jobs
             SET status = 'failed',
                 stage = 'analyze',
                 progress_percent = 0,
                 current_textbook = NULL,
                 error_message = 'Analysis was interrupted by a server restart or timeout. Click "Retry Failed" to re-analyze.',
                 error_status = 504,
                 error_type = 'timeout',
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [jobId]
          );
          if (failRes.rows.length > 0) {
            row = failRes.rows[0];
          }
        }
      }
    }

    return rowToSnapshot(row);
  }

  /**
   * Reconcile all interrupted/orphaned jobs on server startup or when a worker crash occurs.
   * Prevents jobs from lingering indefinitely in 'analyzing' or 'matching' state without active runners.
   */
  static async recoverOrphanedJobs(): Promise<number> {
    await this.ensureSchema();
    try {
      const res = await pool.query<JobRow>(
        `SELECT id, status, stage, analyzed_units, batches, updated_at
         FROM ai_syllabus_import_jobs
         WHERE status IN ('analyzing', 'matching', 'queued')`
      );

      let recoveredCount = 0;
      for (const row of res.rows) {
        if (!this.activeRunners.has(row.id)) {
          const hasAnalyzedUnits = Array.isArray(row.analyzed_units) && row.analyzed_units.length > 0;
          if (hasAnalyzedUnits) {
            console.info(`[AISyllabusJobService] Startup: Resuming orphaned Stage 2 matching job: ${row.id}`);
            this.scheduleRunner(row.id);
            recoveredCount++;
          } else {
            console.warn(`[AISyllabusJobService] Startup: Resetting stalled Stage 1 job to failed: ${row.id}`);
            await pool.query(
              `UPDATE ai_syllabus_import_jobs
               SET status = 'failed',
                   stage = 'analyze',
                   progress_percent = 0,
                   current_textbook = NULL,
                   error_message = 'Job was interrupted by a backend server restart. Click "Retry Failed" to re-analyze.',
                   error_status = 500,
                   error_type = 'worker_interrupted',
                   updated_at = NOW()
               WHERE id = $1`,
              [row.id]
            );
            recoveredCount++;
          }
        }
      }
      return recoveredCount;
    } catch (err) {
      console.warn('[AISyllabusJobService] recoverOrphanedJobs warning:', err);
      return 0;
    }
  }

  /**
   * Request pause on an active job. Saves current checkpoint cleanly before stopping.
   */
  static async pauseJob(jobId: string): Promise<SyllabusImportJobSnapshot | null> {
    await this.ensureSchema();
    this.pauseRequested.add(jobId);

    const current = await this.getJob(jobId);
    if (!current) return null;

    if (current.status === 'completed' || current.status === 'completed_with_errors' || current.status === 'failed') {
      return current;
    }

    const res = await pool.query<JobRow>(
      `UPDATE ai_syllabus_import_jobs
       SET status = 'paused', current_textbook = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [jobId]
    );
    return res.rows[0] ? rowToSnapshot(res.rows[0]) : null;
  }

  /**
   * Resume a paused (or interrupted) job from the last saved checkpoint without repeating completed work.
   */
  static async resumeJob(jobId: string, hooks?: JobExecutionHooks): Promise<SyllabusImportJobSnapshot | null> {
    await this.ensureSchema();
    const existing = await this.getJob(jobId);
    if (!existing) return null;

    if (existing.status === 'completed') {
      return existing;
    }

    this.pauseRequested.delete(jobId);
    if (hooks) {
      this.jobHooks.set(jobId, hooks);
    }

    const nextStage: SyllabusJobStage = existing.analyzedUnitsCount > 0 ? 'match' : 'analyze';
    const nextStatus: SyllabusJobStatus = nextStage === 'analyze' ? 'analyzing' : 'matching';

    const res = await pool.query<JobRow>(
      `UPDATE ai_syllabus_import_jobs
       SET status = $2,
           stage = $3,
           error_message = NULL,
           error_status = NULL,
           error_type = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [jobId, nextStatus, nextStage]
    );

    this.scheduleRunner(jobId);
    return rowToSnapshot(res.rows[0]);
  }

  /**
   * Retry only failed Stage 1 (if analysis never finished) or failed textbook batches.
   * Never repeats already completed batches or duplicates lessons.
   */
  static async retryFailed(jobId: string, hooks?: JobExecutionHooks): Promise<SyllabusImportJobSnapshot | null> {
    await this.ensureSchema();
    const res = await pool.query<JobRow>(`SELECT * FROM ai_syllabus_import_jobs WHERE id = $1 LIMIT 1`, [jobId]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    this.pauseRequested.delete(jobId);
    if (hooks) {
      this.jobHooks.set(jobId, hooks);
    }

    const analyzedUnits = Array.isArray(row.analyzed_units) ? row.analyzed_units : [];
    const existingBatches = Array.isArray(row.batches) ? row.batches : [];

    // Case 1: Stage 1 failed before producing units
    if (analyzedUnits.length === 0) {
      const updated = await pool.query<JobRow>(
        `UPDATE ai_syllabus_import_jobs
         SET status = 'queued',
             stage = 'analyze',
             progress_percent = 0,
             error_message = NULL,
             error_status = NULL,
             error_type = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [jobId]
      );
      this.scheduleRunner(jobId);
      return rowToSnapshot(updated.rows[0]);
    }

    // Case 2: Reset only failed batches back to pending
    let retriedIdsCount = 0;
    const resetBatches: SyllabusJobBatch[] = existingBatches.map((b) => {
      if (b.status === 'failed') {
        retriedIdsCount += b.textbookIds.length;
        return {
          ...b,
          status: 'pending',
          succeededIds: [],
          failedIds: [],
          error: undefined,
        };
      }
      return b;
    });

    const successfulCount = resetBatches.reduce((sum, b) => sum + (b.succeededIds?.length || 0), 0);
    const processedCount = Math.max(0, successfulCount);
    const totalCount = Number(row.total_textbooks) || 0;
    const progress = totalCount > 0 ? 15 + Math.round((processedCount / totalCount) * 85) : 100;

    if (retriedIdsCount === 0 && resetBatches.every((b) => b.status === 'completed')) {
      const completed = await pool.query<JobRow>(
        `UPDATE ai_syllabus_import_jobs
         SET status = 'completed', stage = 'done', failed_textbooks = 0, progress_percent = 100, error_message = NULL, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [jobId]
      );
      return rowToSnapshot(completed.rows[0]);
    }

    const updated = await pool.query<JobRow>(
      `UPDATE ai_syllabus_import_jobs
       SET status = 'matching',
           stage = 'match',
           batches = $2::jsonb,
           processed_textbooks = $3,
           successful_textbooks = $4,
           failed_textbooks = 0,
           progress_percent = $5,
           error_message = NULL,
           error_status = NULL,
           error_type = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [jobId, JSON.stringify(resetBatches), processedCount, successfulCount, Math.min(99, progress)]
    );

    this.scheduleRunner(jobId);
    return rowToSnapshot(updated.rows[0]);
  }

  /**
   * Wait for an active runner (primarily useful in automated tests)
   */
  static async waitForJobCompletion(jobId: string, timeoutMs = 60000): Promise<SyllabusImportJobSnapshot | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const active = this.runningPromises.get(jobId);
      if (active) {
        await Promise.race([
          active,
          new Promise((r) => setTimeout(r, 250)),
        ]);
      }
      const snap = await this.getJob(jobId);
      if (!snap) return null;
      if (
        snap.status === 'completed' ||
        snap.status === 'completed_with_errors' ||
        snap.status === 'failed' ||
        snap.status === 'paused'
      ) {
        if (!this.activeRunners.has(jobId)) {
          return snap;
        }
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return this.getJob(jobId);
  }

  private static scheduleRunner(jobId: string): void {
    if (this.activeRunners.has(jobId)) {
      return;
    }
    this.activeRunners.add(jobId);

    const promise = new Promise<void>((resolve) => {
      setImmediate(async () => {
        try {
          await this.executeJobLoop(jobId);
        } catch (err) {
          console.error(`[AISyllabusJobService] Unexpected runner error for ${jobId}:`, err);
        } finally {
          this.activeRunners.delete(jobId);
          this.runningPromises.delete(jobId);
          resolve();
        }
      });
    });

    this.runningPromises.set(jobId, promise);
  }

  private static async executeJobLoop(jobId: string): Promise<void> {
    const hooks = this.jobHooks.get(jobId) || {};
    const analyzeFn =
      hooks.analyzeSyllabusFn ||
      ((e: string, t: string, s?: string) => AISyllabusEngineService.analyzeSyllabus(e, t, s));
    const matchBatchFn =
      hooks.matchBatchFn ||
      ((u: CanonicalUnitDraft[], ids: number[], opts?: any) =>
        AISyllabusEngineService.matchTextbooksBatch(u, ids, opts));
    const batchDelayMs = hooks.batchDelayMs ?? 10;

    // Reload authoritative state
    const initialRes = await pool.query<JobRow>(`SELECT * FROM ai_syllabus_import_jobs WHERE id = $1 LIMIT 1`, [jobId]);
    if (initialRes.rows.length === 0) return;
    let row = initialRes.rows[0];

    if (this.pauseRequested.has(jobId) || row.status === 'paused') {
      return;
    }

    // =========================================================================
    // STAGE 1: Syllabus Analysis via Gemini (cached once finished!)
    // =========================================================================
    let currentUnits: CanonicalUnitDraft[] = Array.isArray(row.units) ? row.units : [];
    const analyzedUnits: CanonicalUnitDraft[] = Array.isArray(row.analyzed_units) ? row.analyzed_units : [];

    if (analyzedUnits.length === 0) {
      await pool.query(
        `UPDATE ai_syllabus_import_jobs
         SET status = 'analyzing',
             stage = 'analyze',
             progress_percent = 0,
             current_textbook = 'Analyzing official TNPSC syllabus with Gemini AI...',
             updated_at = NOW()
         WHERE id = $1`,
        [jobId]
      );

      try {
        const extracted = await analyzeFn(row.exam_id, row.raw_text, row.target_subject || undefined);
        currentUnits = extracted;

        const wasPausedDuringAnalyze = this.pauseRequested.has(jobId);
        await pool.query(
          `UPDATE ai_syllabus_import_jobs
           SET analyzed_units = $2::jsonb,
               units = $2::jsonb,
               stage = 'match',
               status = $3,
               progress_percent = 15,
               current_textbook = $4,
               updated_at = NOW()
           WHERE id = $1`,
          [
            jobId,
            JSON.stringify(extracted),
            wasPausedDuringAnalyze ? 'paused' : 'matching',
            wasPausedDuringAnalyze ? null : 'Syllabus units extracted. Starting batched textbook matching...',
          ]
        );

        if (wasPausedDuringAnalyze) {
          return;
        }
      } catch (err: any) {
        const isJsonErr =
          err?.name === 'GeminiJsonParseError' ||
          String(err?.message || '').includes('invalid JSON') ||
          String(err?.message || '').includes('Invalid syllabus schema');
        const statusCode =
          err?.statusCode ||
          (isJsonErr ? 422 : String(err?.message || '').includes('503') ? 503 : String(err?.message || '').includes('429') ? 429 : 500);
        const errorType =
          err?.errorType ||
          (isJsonErr ? 'invalid_json_syntax' : statusCode === 503 ? 'service_unavailable' : statusCode === 429 ? 'rate_limit' : 'analysis_failed');

        await pool.query(
          `UPDATE ai_syllabus_import_jobs
           SET status = 'failed',
               stage = 'analyze',
               progress_percent = 0,
               current_textbook = NULL,
               error_message = $2,
               error_status = $3,
               error_type = $4,
               updated_at = NOW()
           WHERE id = $1`,
          [jobId, err?.message || 'Syllabus analysis failed.', statusCode, errorType]
        );
        return;
      }
    }

    // Re-read freshest batches/units before Stage 2
    const stage2Res = await pool.query<JobRow>(`SELECT * FROM ai_syllabus_import_jobs WHERE id = $1 LIMIT 1`, [jobId]);
    if (stage2Res.rows.length === 0) return;
    row = stage2Res.rows[0];
    currentUnits = Array.isArray(row.units) && row.units.length > 0 ? row.units : row.analyzed_units;
    let batches: SyllabusJobBatch[] = Array.isArray(row.batches) ? row.batches : [];
    const selectedStandards: number[] = Array.isArray(row.selected_standards) ? row.selected_standards : [];

    // If no textbooks selected from DB, match canonical lessons (e.g. 11th & 12th) and complete
    if (batches.length === 0) {
      if (selectedStandards.length > 0) {
        try {
          const result = await matchBatchFn(currentUnits, [], {
            selectedStandards,
          });
          currentUnits = result.units;
        } catch (e) {
          console.warn('[AISyllabusJobService] Error matching canonical standards with 0 textbook batches:', e);
        }
      }
      await pool.query(
        `UPDATE ai_syllabus_import_jobs
         SET status = 'completed',
             stage = 'done',
             progress_percent = 100,
             current_textbook = NULL,
             units = $2::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [jobId, JSON.stringify(currentUnits)]
      );
      return;
    }

    await pool.query(
      `UPDATE ai_syllabus_import_jobs
       SET status = 'matching', stage = 'match', updated_at = NOW()
       WHERE id = $1 AND status <> 'paused'`,
      [jobId]
    );

    const totalTextbooks = Number(row.total_textbooks) || batches.reduce((s, b) => s + b.textbookIds.length, 0);

    // =========================================================================
    // STAGE 2: Batched Textbook Matching (reuses extracted_toc from PostgreSQL)
    // =========================================================================
    for (let idx = 0; idx < batches.length; idx++) {
      // Check pause flag before each batch
      if (this.pauseRequested.has(jobId)) {
        await pool.query(
          `UPDATE ai_syllabus_import_jobs
           SET status = 'paused', current_textbook = NULL, updated_at = NOW()
           WHERE id = $1`,
          [jobId]
        );
        return;
      }

      const batch = batches[idx];
      if (batch.status !== 'pending') {
        continue;
      }

      batches[idx] = { ...batch, status: 'processing', error: undefined };
      await pool.query(
        `UPDATE ai_syllabus_import_jobs
         SET batches = $2::jsonb,
             current_textbook = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [
          jobId,
          JSON.stringify(batches),
          `Batch ${idx + 1}/${batches.length} (${batch.textbookIds.length} textbooks)`,
        ]
      );

      try {
        const result = await matchBatchFn(currentUnits, batch.textbookIds, {
          selectedStandards: selectedStandards.length > 0 ? selectedStandards : undefined,
          onTextbookStart: async (tb) => {
            await pool.query(
              `UPDATE ai_syllabus_import_jobs
               SET current_textbook = $2, updated_at = NOW()
               WHERE id = $1`,
              [jobId, tb.file_name]
            );
          },
        });

        currentUnits = result.units;
        const succeededIds =
          result.processedTextbooks.length > 0
            ? result.processedTextbooks.map((t) => t.id)
            : [...batch.textbookIds];

        batches[idx] = {
          ...batches[idx],
          status: 'completed',
          succeededIds,
          failedIds: [],
          error: undefined,
        };
      } catch (batchErr: any) {
        console.error(`[AISyllabusJobService] Batch ${idx} failed for ${jobId}:`, batchErr);
        batches[idx] = {
          ...batches[idx],
          status: 'failed',
          succeededIds: [],
          failedIds: [...batch.textbookIds],
          error: batchErr?.message || 'Batch processing failed',
        };
      }

      // Recompute aggregate progress metrics accurately from batches
      const successfulCount = batches.reduce((s, b) => s + (b.succeededIds?.length || 0), 0);
      const failedCount = batches.reduce((s, b) => s + (b.failedIds?.length || 0), 0);
      const processedCount = successfulCount + failedCount;
      const progress = totalTextbooks > 0 ? Math.min(99, 15 + Math.round((processedCount / totalTextbooks) * 85)) : 99;

      const lastBatchLabel =
        batches[idx].status === 'completed'
          ? `Completed Batch ${idx + 1}/${batches.length}`
          : `Batch ${idx + 1}/${batches.length} failed`;

      await pool.query(
        `UPDATE ai_syllabus_import_jobs
         SET units = $2::jsonb,
             batches = $3::jsonb,
             processed_textbooks = $4,
             successful_textbooks = $5,
             failed_textbooks = $6,
             progress_percent = $7,
             current_textbook = $8,
             updated_at = NOW()
         WHERE id = $1`,
        [
          jobId,
          JSON.stringify(currentUnits),
          JSON.stringify(batches),
          processedCount,
          successfulCount,
          failedCount,
          progress,
          lastBatchLabel,
        ]
      );

      // Yield to event loop so polls & pause requests stay responsive
      if (batchDelayMs > 0) {
        await new Promise((r) => setTimeout(r, batchDelayMs));
      } else {
        await new Promise((r) => setImmediate(r));
      }
    }

    // Finalize job status
    if (this.pauseRequested.has(jobId)) {
      await pool.query(
        `UPDATE ai_syllabus_import_jobs
         SET status = 'paused', current_textbook = NULL, updated_at = NOW()
         WHERE id = $1`,
        [jobId]
      );
      return;
    }

    const totalFailed = batches.reduce((s, b) => s + (b.failedIds?.length || 0), 0);
    const finalStatus: SyllabusJobStatus = totalFailed > 0 ? 'completed_with_errors' : 'completed';
    const finalError = totalFailed > 0 ? `${totalFailed} textbook(s) failed during batch matching. Click "Retry Failed" to process only failed batches.` : null;

    await pool.query(
      `UPDATE ai_syllabus_import_jobs
       SET status = $2,
           stage = 'done',
           progress_percent = 100,
           current_textbook = NULL,
           error_message = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [jobId, finalStatus, finalError]
    );
  }
}

export default AISyllabusJobService;
