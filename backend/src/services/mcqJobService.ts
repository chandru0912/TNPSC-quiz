/**
 * Persistent PostgreSQL-Backed MCQ Background Job Service
 *
 * Designed for both persistent Node servers (Localhost) and stateless
 * serverless environments (Vercel):
 * - All job state, configuration, progress, and textbook context snapshots live in PostgreSQL.
 * - Execution proceeds in bounded, lease-locked steps (1 batch per step, ~10-12 MCQs)
 *   so each step completes well within Vercel's 60s maxDuration.
 * - Validated, deduplicated questions are committed to PostgreSQL (`status = 'staging'`)
 *   immediately after every batch using transactions + ON CONFLICT idempotency.
 * - Jobs survive modal close, page navigation, browser refresh, and worker restarts.
 */

import crypto from 'crypto';
import pool from '../db';
import { generateMcqs } from './mcqGenerator';
import { resolveMcqSelection, normalizeSubjectKey } from './mcqCascadeService';
import { extractTextFromGoogleDrivePdf } from './googleDriveService';
import { retrieveRelevantTextbookContent, TextbookSearchQuery } from './textbookRag';
import { AIProviderConfigService } from './ai/ai-provider-config.service';
import { AILogsService } from './ai/ai-logs.service';
import { AIProviderName } from './ai/ai-provider.interface';

export type McqJobStatus = 'QUEUED' | 'PROCESSING' | 'RETRYING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface CreateMcqJobInput {
  provider?: AIProviderName;
  category: string;
  standard: number;
  subject: string;
  subjectId?: string;
  term?: string;
  volume?: string;
  unitId: number;
  unitTitle?: string;
  lessonTitle: string;
  lessonId?: string;
  lessonNumber?: string;
  topic?: string;
  selectedTopics?: string[];
  language: 'tamil' | 'english';
  questionCount: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Mixed';
  textbookMode?: 'auto' | 'specific' | 'custom_text' | 'gdrive';
  textbookId?: number;
  gdriveFileId?: string;
  gdriveMaterialId?: number;
  customText?: string;
}

export interface McqJobSnapshot {
  job_id: string;
  admin_id: string;
  provider: AIProviderName;
  model: string;
  group_id: string;
  subject_id: string;
  subject: string;
  standard_id: number;
  term_id: string | null;
  volume: string | null;
  unit_id: number;
  unit_title: string | null;
  lesson_id: string | null;
  lesson_title: string;
  lesson_number: string | null;
  selected_topics: string[];
  requested_question_count: number;
  difficulty: string;
  language: 'tamil' | 'english';
  textbook_id: number | null;
  textbook_name: string | null;
  source_pdf: string | null;
  status: McqJobStatus;
  progress: number;
  generated_count: number;
  failed_count: number;
  duplicate_count: number;
  invalid_count: number;
  current_step: string | null;
  current_batch: number;
  total_batches: number;
  error_message: string | null;
  lease_active: boolean;
  created_at: string;
  started_at: string | null;
  updated_at: string;
  completed_at: string | null;
}

function rowToSnapshot(row: any): McqJobSnapshot {
  const leaseUntil = row.lease_until ? new Date(row.lease_until).getTime() : 0;
  return {
    job_id: row.job_id,
    admin_id: row.admin_id,
    provider: (row.provider || 'gemini') as AIProviderName,
    model: row.model || '',
    group_id: row.group_id,
    subject_id: row.subject_id || normalizeSubjectKey(row.subject),
    subject: row.subject,
    standard_id: Number(row.standard_id),
    term_id: row.term_id || null,
    volume: row.volume || null,
    unit_id: Number(row.unit_id),
    unit_title: row.unit_title || null,
    lesson_id: row.lesson_id || null,
    lesson_title: row.lesson_title,
    lesson_number: row.lesson_number || null,
    selected_topics: Array.isArray(row.selected_topics) ? row.selected_topics : [],
    requested_question_count: Number(row.requested_question_count),
    difficulty: row.difficulty || 'Mixed',
    language: (row.language || 'english') as 'tamil' | 'english',
    textbook_id: row.textbook_id != null ? Number(row.textbook_id) : null,
    textbook_name: row.textbook_name || null,
    source_pdf: row.source_pdf || null,
    status: row.status as McqJobStatus,
    progress: Number(row.progress) || 0,
    generated_count: Number(row.generated_count) || 0,
    failed_count: Number(row.failed_count) || 0,
    duplicate_count: Number(row.duplicate_count) || 0,
    invalid_count: Number(row.invalid_count) || 0,
    current_step: row.current_step || null,
    current_batch: Number(row.current_batch) || 0,
    total_batches: Math.max(1, Number(row.total_batches) || Math.ceil((Number(row.requested_question_count) || 10) / 10)),
    error_message: row.error_message || null,
    lease_active: leaseUntil > Date.now() && (row.status === 'QUEUED' || row.status === 'PROCESSING' || row.status === 'RETRYING'),
    created_at: new Date(row.created_at).toISOString(),
    started_at: row.started_at ? new Date(row.started_at).toISOString() : null,
    updated_at: new Date(row.updated_at).toISOString(),
    completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}

export class McqJobService {
  private static schemaReadyPromise: Promise<void> | null = null;
  private static localRunners = new Set<string>();

  static async ensureSchema(): Promise<void> {
    if (!this.schemaReadyPromise) {
      this.schemaReadyPromise = (async () => {
        await pool.query(`
          ALTER TABLE questions ADD COLUMN IF NOT EXISTS generation_job_id VARCHAR(64);
          CREATE TABLE IF NOT EXISTS mcq_generation_jobs (
            job_id VARCHAR(64) PRIMARY KEY,
            admin_id VARCHAR(120) NOT NULL,
            provider VARCHAR(32) NOT NULL DEFAULT 'gemini',
            model VARCHAR(120),
            group_id VARCHAR(64) NOT NULL,
            subject_id VARCHAR(120),
            subject VARCHAR(255) NOT NULL,
            standard_id INTEGER NOT NULL,
            term_id VARCHAR(64),
            volume VARCHAR(64),
            unit_id INTEGER NOT NULL,
            unit_title VARCHAR(255),
            lesson_id VARCHAR(255),
            lesson_title VARCHAR(500) NOT NULL,
            lesson_number VARCHAR(64),
            selected_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
            requested_question_count INTEGER NOT NULL,
            difficulty VARCHAR(32) NOT NULL DEFAULT 'Mixed',
            language VARCHAR(32) NOT NULL DEFAULT 'english',
            textbook_mode VARCHAR(32),
            textbook_id INTEGER,
            gdrive_file_id VARCHAR(255),
            gdrive_material_id INTEGER,
            textbook_name VARCHAR(500),
            source_pdf VARCHAR(500),
            source_pages JSONB DEFAULT '[]'::jsonb,
            textbook_content_snapshot TEXT,
            status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
            progress INTEGER NOT NULL DEFAULT 0,
            generated_count INTEGER NOT NULL DEFAULT 0,
            failed_count INTEGER NOT NULL DEFAULT 0,
            duplicate_count INTEGER NOT NULL DEFAULT 0,
            invalid_count INTEGER NOT NULL DEFAULT 0,
            current_step VARCHAR(255),
            error_message TEXT,
            lease_until TIMESTAMP,
            worker_token VARCHAR(64),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            started_at TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_mcq_jobs_status ON mcq_generation_jobs (status, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_mcq_jobs_admin ON mcq_generation_jobs (admin_id, created_at DESC);
          ALTER TABLE mcq_generation_jobs ADD COLUMN IF NOT EXISTS current_batch INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE mcq_generation_jobs ADD COLUMN IF NOT EXISTS total_batches INTEGER NOT NULL DEFAULT 1;
          CREATE TABLE IF NOT EXISTS mcq_generation_batches (
            batch_id VARCHAR(80) PRIMARY KEY,
            job_id VARCHAR(64) NOT NULL REFERENCES mcq_generation_jobs(job_id) ON DELETE CASCADE,
            batch_number INTEGER NOT NULL,
            requested_count INTEGER NOT NULL,
            generated_count INTEGER NOT NULL DEFAULT 0,
            duplicate_count INTEGER NOT NULL DEFAULT 0,
            invalid_count INTEGER NOT NULL DEFAULT 0,
            retry_count INTEGER NOT NULL DEFAULT 0,
            status VARCHAR(32) NOT NULL DEFAULT 'PROCESSING',
            error_message TEXT,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (job_id, batch_number)
          );
          CREATE INDEX IF NOT EXISTS idx_mcq_batches_job ON mcq_generation_batches (job_id, batch_number ASC);
        `);
      })().catch((err) => {
        this.schemaReadyPromise = null;
        throw err;
      });
    }
    return this.schemaReadyPromise;
  }

  /**
   * Resolves provider, model, and verified textbook content snapshot upfront,
   * then persists a durable QUEUED job in PostgreSQL.
   */
  static async createJob(adminId: string, input: CreateMcqJobInput): Promise<McqJobSnapshot> {
    await this.ensureSchema();

    const targetProviderName: AIProviderName =
      input.provider || (await AIProviderConfigService.getActiveProvider()).provider;
    const providerStatus = await AIProviderConfigService.getProviderStatus(targetProviderName);
    const activeModel = providerStatus.model;

    const requestedCount = Math.max(5, Math.min(200, Number(input.questionCount) || 25));
    const language: 'tamil' | 'english' = input.language === 'tamil' ? 'tamil' : 'english';
    const difficulty = input.difficulty || 'Mixed';
    const selectedTopics = Array.isArray(input.selectedTopics) && input.selectedTopics.length > 0
      ? input.selectedTopics.map((t) => String(t).trim()).filter(Boolean)
      : input.topic
      ? [String(input.topic).trim()]
      : [input.lessonTitle];

    // Resolve textbook content snapshot once upfront so worker steps never re-download PDFs
    let textbookText = input.customText?.trim() || '';
    let resolvedTextbookId: number | null = input.textbookId ?? null;
    let resolvedTextbookName: string | null = null;
    let resolvedSourcePdf: string | null = null;
    let resolvedTerm: string | null = input.term || null;
    let resolvedVolume: string | null = input.volume || null;
    let resolvedPages: number[] = [];

    const mcqSelection =
      input.textbookMode === 'custom_text' && textbookText.length >= 50
        ? null
        : await resolveMcqSelection({
            groupId: input.category,
            subject: input.subject,
            standard: Number(input.standard),
            unitId: Number(input.unitId),
            textbookId: input.textbookId,
            materialId: input.gdriveMaterialId,
            gdriveFileId: input.gdriveFileId,
            term: input.term,
            volume: input.volume,
            lessonTitle: input.lessonTitle,
            lessonNumber: input.lessonNumber,
          });

    if (mcqSelection) {
      textbookText = mcqSelection.content;
      resolvedTextbookId = mcqSelection.candidate.textbookId || mcqSelection.candidate.materialId || resolvedTextbookId;
      resolvedTextbookName = mcqSelection.candidate.bookName;
      resolvedSourcePdf = mcqSelection.sourcePdf;
      resolvedTerm = mcqSelection.term || resolvedTerm;
      resolvedVolume = mcqSelection.volume || resolvedVolume;
      resolvedPages = mcqSelection.pages || [];
    } else if (input.textbookMode === 'gdrive' && (input.gdriveFileId || input.gdriveMaterialId)) {
      const driveExtraction = await extractTextFromGoogleDrivePdf({
        fileId: input.gdriveFileId || '',
        materialId: input.gdriveMaterialId,
        lessonTitle: input.lessonTitle,
        unitId: Number(input.unitId),
        standard: Number(input.standard),
        subject: input.subject,
      });
      if (driveExtraction?.text && driveExtraction.text.length >= 50) {
        textbookText = driveExtraction.text;
        resolvedTextbookId = input.gdriveMaterialId || resolvedTextbookId;
        resolvedTextbookName = `[Google Drive] ${driveExtraction.fileName}`;
        resolvedSourcePdf = driveExtraction.fileName;
        resolvedPages = driveExtraction.relevantPages || [];
      }
    } else if (!textbookText) {
      const ragQuery: TextbookSearchQuery = {
        groupId: input.category,
        standard: Number(input.standard),
        subject: input.subject,
        term: input.term,
        unitId: Number(input.unitId),
        lessonTitle: input.lessonTitle,
        topic: selectedTopics[0],
        textbookId: input.textbookId,
        maxPages: 100,
      };
      const ragResult = await retrieveRelevantTextbookContent(ragQuery);
      if (ragResult.hasSufficientContent && ragResult.chunks.length > 0) {
        textbookText = ragResult.chunks.map((c) => c.content).join('\n\n');
        resolvedTextbookId = ragResult.textbookId;
        resolvedTextbookName = ragResult.bookName;
        resolvedSourcePdf = ragResult.bookName;
        resolvedPages = ragResult.relevantPages || [];
      }
    }

    if (!textbookText || textbookText.length < 50) {
      throw new Error(
        'No verified lesson PDF content is available. Select a processed textbook lesson before queuing MCQ generation.'
      );
    }

    const jobId = `mcq_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const subjectId = input.subjectId || normalizeSubjectKey(input.subject);
    const batchCapacity = targetProviderName === 'gemini' ? 10 : 12;
    const totalBatches = Math.max(1, Math.ceil(requestedCount / batchCapacity));

    const res = await pool.query(
      `INSERT INTO mcq_generation_jobs (
        job_id, admin_id, provider, model, group_id, subject_id, subject,
        standard_id, term_id, volume, unit_id, unit_title, lesson_id, lesson_title,
        lesson_number, selected_topics, requested_question_count, difficulty, language,
        textbook_mode, textbook_id, gdrive_file_id, gdrive_material_id,
        textbook_name, source_pdf, source_pages, textbook_content_snapshot,
        status, progress, generated_count, failed_count, duplicate_count, invalid_count,
        current_batch, total_batches, current_step
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14,
        $15, $16::jsonb, $17, $18, $19,
        $20, $21, $22, $23,
        $24, $25, $26::jsonb, $27,
        'QUEUED', 0, 0, 0, 0, 0,
        0, $28, 'Queued for background generation'
      ) RETURNING *`,
      [
        jobId,
        adminId,
        targetProviderName,
        activeModel,
        input.category,
        subjectId,
        input.subject,
        Number(input.standard),
        resolvedTerm,
        resolvedVolume,
        Number(input.unitId),
        input.unitTitle || `Unit ${input.unitId}`,
        input.lessonId || null,
        input.lessonTitle,
        input.lessonNumber || null,
        JSON.stringify(selectedTopics),
        requestedCount,
        difficulty,
        language,
        input.textbookMode || 'specific',
        resolvedTextbookId,
        input.gdriveFileId || null,
        input.gdriveMaterialId || null,
        resolvedTextbookName,
        resolvedSourcePdf,
        JSON.stringify(resolvedPages),
        textbookText.slice(0, 60000),
        totalBatches,
      ]
    );

    const snapshot = rowToSnapshot(res.rows[0]);

    // On persistent Node servers (Localhost), run the step loop asynchronously in-process.
    // On Vercel serverless, dispatch the first worker step via signed internal HTTP call
    // AND the Global Admin Monitor also drives /step if needed.
    if (!process.env.VERCEL) {
      this.kickLocalWorker(jobId);
    } else {
      await this.dispatchVercelWorkerStep(jobId);
    }

    return snapshot;
  }

  /**
   * Generates a short-lived HMAC-SHA256 token for internal Vercel serverless step chaining.
   */
  static signInternalWorkerToken(jobId: string, expMs: number = Date.now() + 5 * 60 * 1000): string {
    const secret = process.env.ADMIN_JWT_SECRET || 'tnpsc_quiz_admin_jwt_secret_key_2026';
    const payload = `${jobId}.${expMs}`;
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return `${expMs}.${sig}`;
  }

  static verifyInternalWorkerToken(jobId: string, token: string): boolean {
    try {
      const [expStr, sig] = String(token || '').split('.');
      const expMs = Number(expStr);
      if (!Number.isFinite(expMs) || expMs < Date.now() || !sig) return false;
      const secret = process.env.ADMIN_JWT_SECRET || 'tnpsc_quiz_admin_jwt_secret_key_2026';
      const expected = crypto.createHmac('sha256', secret).update(`${jobId}.${expMs}`).digest('hex');
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Dispatches the next bounded batch step on Vercel Serverless via signed internal HTTP POST
   * so generation continues server-side even if the Admin closes the browser.
   */
  static async dispatchVercelWorkerStep(jobId: string): Promise<void> {
    const host =
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL ||
      '';
    if (!host) return;
    const baseUrl = host.startsWith('http') ? host.replace(/\/+$/, '') : `https://${host}`;
    const workerSig = this.signInternalWorkerToken(jobId);
    try {
      const reqPromise = fetch(`${baseUrl}/api/admin/mcq-generation/jobs/internal/step/${encodeURIComponent(jobId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mcq-worker-token': workerSig,
        },
      }).catch(() => {});
      // Allow enough time for TLS + HTTP request bytes to flush to Vercel edge before returning
      await Promise.race([reqPromise, new Promise((r) => setTimeout(r, 350))]);
    } catch {
      // Non-fatal: Global Admin Monitor / retry will also pick up any unleased active job
    }
  }

  /**
   * Localhost persistent-server worker loop (processes steps until done/cancelled/failed).
   */
  static kickLocalWorker(jobId: string): void {
    if (process.env.VERCEL || this.localRunners.has(jobId)) return;
    this.localRunners.add(jobId);

    (async () => {
      try {
        while (true) {
          const snap = await this.processNextStep(jobId);
          if (!snap || snap.status === 'COMPLETED' || snap.status === 'FAILED' || snap.status === 'CANCELLED') {
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch (err) {
        console.error(`[McqJobService] Local worker loop error for ${jobId}:`, err);
      } finally {
        this.localRunners.delete(jobId);
      }
    })();
  }

  /**
   * Executes ONE bounded batch step (lease-locked, transaction-safe, idempotent).
   * Safe for Vercel 60s serverless functions and safe against concurrent callers.
   */
  static async processNextStep(jobId: string): Promise<McqJobSnapshot | null> {
    await this.ensureSchema();

    const workerToken = crypto.randomBytes(8).toString('hex');
    const leaseRes = await pool.query(
      `UPDATE mcq_generation_jobs
       SET status = 'PROCESSING',
           lease_until = NOW() + INTERVAL '45 seconds',
           worker_token = $2,
           started_at = COALESCE(started_at, NOW()),
           current_step = CASE
             WHEN generated_count > 0 THEN 'Generating next batch (' || generated_count || '/' || requested_question_count || ' saved)...'
             ELSE 'Starting AI MCQ generation batch...'
           END,
           updated_at = NOW()
       WHERE job_id = $1
         AND status IN ('QUEUED', 'PROCESSING', 'RETRYING')
         AND (lease_until IS NULL OR lease_until < NOW())
       RETURNING *`,
      [jobId, workerToken]
    );

    if (leaseRes.rowCount === 0) {
      return this.getJob(jobId);
    }

    const job = leaseRes.rows[0];
    const requestedCount = Number(job.requested_question_count);
    const alreadyGenerated = Number(job.generated_count) || 0;

    if (alreadyGenerated >= requestedCount) {
      const doneRes = await pool.query(
        `UPDATE mcq_generation_jobs
         SET status = 'COMPLETED',
             progress = 100,
             lease_until = NULL,
             worker_token = NULL,
             current_step = 'Completed & saved to Staging',
             completed_at = COALESCE(completed_at, NOW()),
             updated_at = NOW()
         WHERE job_id = $1
         RETURNING *`,
        [jobId]
      );
      return doneRes.rows[0] ? rowToSnapshot(doneRes.rows[0]) : null;
    }

    const remaining = requestedCount - alreadyGenerated;
    const provider = (job.provider || 'gemini') as AIProviderName;
    const stepBatchSize = Math.min(provider === 'gemini' ? 10 : 12, remaining);
    const batchNumber = (Number(job.current_batch) || 0) + 1;
    const batchId = `${jobId}_b${batchNumber}`;
    const totalBatches = Math.max(Number(job.total_batches) || 1, batchNumber);
    const selectedTopics: string[] = Array.isArray(job.selected_topics) ? job.selected_topics : [];
    const sourcePages: number[] = Array.isArray(job.source_pages) ? job.source_pages : [];

    await pool.query(
      `INSERT INTO mcq_generation_batches (
        batch_id, job_id, batch_number, requested_count, status, started_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'PROCESSING', NOW(), NOW())
      ON CONFLICT (job_id, batch_number) DO UPDATE SET
        status = 'PROCESSING',
        requested_count = EXCLUDED.requested_count,
        error_message = NULL,
        updated_at = NOW()`,
      [batchId, jobId, batchNumber, stepBatchSize]
    );

    try {
      const genResult = await generateMcqs({
        provider,
        category: job.group_id,
        standard: Number(job.standard_id),
        subject: job.subject,
        term: job.term_id || undefined,
        volume: job.volume || undefined,
        textbookName: job.textbook_name || undefined,
        sourcePdf: job.source_pdf || undefined,
        sourcePages,
        unitId: Number(job.unit_id),
        unitTitle: job.unit_title || undefined,
        lessonTitle: job.lesson_title,
        lessonId: job.lesson_id || undefined,
        lessonNumber: job.lesson_number || undefined,
        topic: selectedTopics[0] || job.lesson_title,
        selectedTopics,
        language: (job.language || 'english') as 'tamil' | 'english',
        count: Math.max(5, stepBatchSize),
        difficulty: (job.difficulty || 'Mixed') as any,
        textbookContent: job.textbook_content_snapshot || '',
        textbookId: job.textbook_id != null ? Number(job.textbook_id) : undefined,
      });

      const batchQuestions = genResult.questions.slice(0, remaining);
      let insertedCount = 0;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Re-check status inside transaction so an explicit CANCELLED job never commits new questions
        const lockCheck = await client.query(
          'SELECT status, generated_count FROM mcq_generation_jobs WHERE job_id = $1 FOR UPDATE',
          [jobId]
        );
        const currentStatus = lockCheck.rows[0]?.status;
        if (!currentStatus || currentStatus === 'CANCELLED') {
          await client.query('ROLLBACK');
          return this.getJob(jobId);
        }

        const currentCount = Number(lockCheck.rows[0].generated_count) || 0;
        const stillNeeded = Math.max(0, requestedCount - currentCount);

        for (const q of batchQuestions.slice(0, stillNeeded)) {
          const ins = await client.query(
            `INSERT INTO questions (
              category, exam_group_id, unit_id, class_id, standard_id, subject, subject_id,
              lesson_title, lesson_number, lesson_id,
              topic, difficulty, question_text, options, correct_answer,
              explanation, status, source_reference, target_system,
              language, option_a, option_b, option_c, option_d,
              term, volume, source_pdf, source_page, textbook_id, ai_provider, generation_job_id
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10,
              $11, $12, $13, $14, $15,
              $16, 'staging', $17, 'study_materials',
              $18, $19, $20, $21, $22,
              $23, $24, $25, $26, $27, $28, $29
            )
            ON CONFLICT (lesson_title, question_text) DO NOTHING
            RETURNING id`,
            [
              q.category,
              job.group_id,
              q.unitId,
              q.standard,
              q.standard,
              q.subject,
              job.subject_id || normalizeSubjectKey(q.subject),
              q.lessonTitle,
              job.lesson_number || null,
              job.lesson_id || null,
              q.topic || selectedTopics[0] || q.lessonTitle,
              q.difficulty,
              q.question,
              JSON.stringify(q.options),
              q.correctAnswer,
              q.explanation,
              job.textbook_name || `${provider === 'gemini' ? 'Gemini AI' : 'Claude AI'} background job`,
              q.language || job.language || 'english',
              q.optionA || q.options[0] || '',
              q.optionB || q.options[1] || '',
              q.optionC || q.options[2] || '',
              q.optionD || q.options[3] || '',
              job.term_id || null,
              job.volume || null,
              job.source_pdf || job.textbook_name || null,
              sourcePages[0] ?? null,
              job.textbook_id != null ? Number(job.textbook_id) : null,
              provider,
              jobId,
            ]
          );
          if ((ins.rowCount ?? 0) > 0) {
            insertedCount++;
          }
        }

        const newTotal = currentCount + insertedCount;
        const isDone = newTotal >= requestedCount;
        const progress = isDone ? 100 : Math.min(99, Math.round((newTotal / requestedCount) * 100));
        const nextStatus: McqJobStatus = isDone ? 'COMPLETED' : 'PROCESSING';
        const remainingAfter = Math.max(0, requestedCount - newTotal);
        const batchCapacity = provider === 'gemini' ? 10 : 12;
        const updatedTotalBatches = isDone
          ? batchNumber
          : Math.max(totalBatches, batchNumber + Math.ceil(remainingAfter / batchCapacity));
        const nextStep = isDone
          ? `Completed: ${newTotal} questions saved to Staging`
          : `Batch ${batchNumber}/${updatedTotalBatches}: Saved ${newTotal} / ${requestedCount} questions to Staging...`;

        await client.query(
          `UPDATE mcq_generation_batches
           SET generated_count = $2::integer,
               duplicate_count = $3::integer,
               invalid_count = $4::integer,
               status = 'COMPLETED',
               error_message = NULL,
               completed_at = NOW(),
               updated_at = NOW()
           WHERE batch_id = $1`,
          [batchId, insertedCount, genResult.duplicateCount || 0, genResult.invalidCount || 0]
        );

        const upd = await client.query(
          `UPDATE mcq_generation_jobs
           SET generated_count = $2::integer,
               duplicate_count = duplicate_count + $3::integer,
               invalid_count = invalid_count + $4::integer,
               progress = $5::integer,
               status = $6::varchar(32),
               current_batch = $9::integer,
               total_batches = $10::integer,
               lease_until = NULL,
               worker_token = NULL,
               current_step = $7::varchar(255),
               error_message = NULL,
               completed_at = CASE WHEN $8::boolean THEN NOW() ELSE completed_at END,
               updated_at = NOW()
           WHERE job_id = $1
           RETURNING *`,
          [
            jobId,
            newTotal,
            genResult.duplicateCount || 0,
            genResult.invalidCount || 0,
            progress,
            nextStatus,
            nextStep.slice(0, 255),
            isDone,
            batchNumber,
            updatedTotalBatches,
          ]
        );

        await client.query('COMMIT');

        if (isDone) {
          await AILogsService.logGeneration({
            provider,
            model: job.model || '',
            generationType: 'mcq',
            groupId: job.group_id,
            standard: Number(job.standard_id),
            subject: job.subject,
            unitId: Number(job.unit_id),
            lessonTitle: job.lesson_title,
            language: job.language,
            status: 'success',
            itemsCount: newTotal,
            metadata: { jobId, source: 'background_job' },
          }).catch(() => {});
        } else if (process.env.VERCEL) {
          await this.dispatchVercelWorkerStep(jobId);
        }

        return upd.rows[0] ? rowToSnapshot(upd.rows[0]) : null;
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const nextFailedCount = (Number(job.failed_count) || 0) + 1;
      const maxFailures = 5;
      const shouldFail = nextFailedCount >= maxFailures;
      const retryStepMsg = shouldFail
        ? `Failed at batch ${batchNumber} after ${nextFailedCount} errors`
        : `Retrying batch ${batchNumber} after error (${nextFailedCount}/${maxFailures})...`;

      await pool.query(
        `UPDATE mcq_generation_batches
         SET retry_count = retry_count + 1,
             status = $2::varchar(32),
             error_message = $3::text,
             updated_at = NOW()
         WHERE batch_id = $1`,
        [batchId, shouldFail ? 'FAILED' : 'RETRYING', errMsg.slice(0, 1000)]
      ).catch(() => {});

      const failRes = await pool.query(
        `UPDATE mcq_generation_jobs
         SET failed_count = $2::integer,
             error_message = $3::text,
             status = CASE
               WHEN status = 'CANCELLED' THEN 'CANCELLED'
               WHEN $4::boolean THEN 'FAILED'
               ELSE 'RETRYING'
             END,
             lease_until = NULL,
             worker_token = NULL,
             current_step = $5::varchar(255),
             completed_at = CASE WHEN $4::boolean THEN NOW() ELSE completed_at END,
             updated_at = NOW()
         WHERE job_id = $1
         RETURNING *`,
        [jobId, nextFailedCount, errMsg.slice(0, 1000), shouldFail, retryStepMsg.slice(0, 255)]
      );

      if (!shouldFail && process.env.VERCEL && failRes.rows[0]?.status !== 'CANCELLED') {
        await this.dispatchVercelWorkerStep(jobId);
      }

      if (shouldFail) {
        await AILogsService.logGeneration({
          provider,
          model: job.model || '',
          generationType: 'mcq',
          groupId: job.group_id,
          standard: Number(job.standard_id),
          subject: job.subject,
          unitId: Number(job.unit_id),
          lessonTitle: job.lesson_title,
          language: job.language,
          status: 'failed',
          errorMessage: errMsg,
          itemsCount: Number(job.generated_count) || 0,
          metadata: { jobId, source: 'background_job' },
        }).catch(() => {});
      }

      return failRes.rows[0] ? rowToSnapshot(failRes.rows[0]) : null;
    }
  }

  static async cancelJob(jobId: string, adminId: string): Promise<McqJobSnapshot | null> {
    await this.ensureSchema();
    const res = await pool.query(
      `UPDATE mcq_generation_jobs
       SET status = 'CANCELLED',
           lease_until = NULL,
           worker_token = NULL,
           current_step = $2,
           completed_at = COALESCE(completed_at, NOW()),
           updated_at = NOW()
       WHERE job_id = $1
         AND status IN ('QUEUED', 'PROCESSING', 'RETRYING')
       RETURNING *`,
      [jobId, `Cancelled by ${adminId}`]
    );
    if (res.rowCount === 0) {
      return this.getJob(jobId);
    }
    return rowToSnapshot(res.rows[0]);
  }

  static async retryJob(jobId: string, _adminId: string): Promise<McqJobSnapshot | null> {
    await this.ensureSchema();
    const res = await pool.query(
      `UPDATE mcq_generation_jobs
       SET status = 'QUEUED',
           failed_count = 0,
           error_message = NULL,
           lease_until = NULL,
           worker_token = NULL,
           completed_at = NULL,
           current_step = 'Re-queued for retry from saved progress',
           updated_at = NOW()
       WHERE job_id = $1
         AND status IN ('FAILED', 'CANCELLED')
       RETURNING *`,
      [jobId]
    );
    if (res.rowCount === 0) {
      return this.getJob(jobId);
    }
    const snap = rowToSnapshot(res.rows[0]);
    if (!process.env.VERCEL) {
      this.kickLocalWorker(jobId);
    } else {
      await this.dispatchVercelWorkerStep(jobId);
    }
    return snap;
  }

  static async getJob(jobId: string): Promise<McqJobSnapshot | null> {
    await this.ensureSchema();
    const res = await pool.query(
      'SELECT * FROM mcq_generation_jobs WHERE job_id = $1',
      [jobId]
    );
    return res.rows[0] ? rowToSnapshot(res.rows[0]) : null;
  }

  static async listJobs(options?: { activeOnly?: boolean; limit?: number }): Promise<McqJobSnapshot[]> {
    await this.ensureSchema();
    const limit = Math.max(1, Math.min(50, options?.limit || 20));
    const whereClause = options?.activeOnly
      ? "WHERE status IN ('QUEUED', 'PROCESSING', 'RETRYING')"
      : '';
    const res = await pool.query(
      `SELECT * FROM mcq_generation_jobs ${whereClause} ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return res.rows.map(rowToSnapshot);
  }
}
