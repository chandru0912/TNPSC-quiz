import fs from 'fs';
import path from 'path';
import pool from '../db';
import { broadcastAnalyticsEvent } from './analyticsEventBus';
import {
  ANSWER_STATUS_PRIORITY,
  AnswerKeyTier,
  AnswerVerificationStatus,
  computeBufferSha256,
  extractQuestionsFromPreviousPaperPdf,
  keyTierToAnswerStatus,
  parseOfficialAnswerKeyPdf,
} from './previousPaperPdfParser';
import { generatePreviousPaperExplanations } from './previousPaperExplanationService';
import {
  ensurePreviousPaperUploadSchema,
  getUploadSession,
  materializeStoredPdfToTempFile,
} from './previousPaperUploadService';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'previous-papers');

let adminSchemaPromise: Promise<void> | null = null;

export async function ensurePreviousPapersAdminSchema(): Promise<void> {
  if (!adminSchemaPromise) {
    adminSchemaPromise = (async () => {
      await pool.query(`
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS paper_title TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS paper_type VARCHAR(80) DEFAULT 'Prelims';
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS medium VARCHAR(40) DEFAULT 'English';
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS difficulty VARCHAR(32) DEFAULT 'Medium';
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS negative_marking NUMERIC(5,2) DEFAULT 0;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS pdf_filename TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS pdf_storage_provider VARCHAR(32);
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS pdf_storage_bucket TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS pdf_storage_object_key TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS pdf_drive_file_id TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS pdf_file_hash VARCHAR(64);
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS answer_key_filename TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS answer_key_storage_path TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS answer_key_storage_provider VARCHAR(32);
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS answer_key_storage_bucket TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS answer_key_storage_object_key TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS answer_key_drive_file_id TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(60);
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS expected_questions INT DEFAULT 200;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS extracted_count INT DEFAULT 0;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS failed_extraction_count INT DEFAULT 0;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS matched_answer_count INT DEFAULT 0;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS unverified_answer_count INT DEFAULT 0;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS duplicate_count INT DEFAULT 0;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS conflict_count INT DEFAULT 0;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS missing_question_numbers JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS flagged_count INT DEFAULT 0;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS explanation_status VARCHAR(32) DEFAULT 'pending';
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS explanation_generated_count INT DEFAULT 0;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS processing_status VARCHAR(32) DEFAULT 'completed';
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS processing_progress INT DEFAULT 100;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS processing_message TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS paper_code VARCHAR(64);
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS booklet_code VARCHAR(16);
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS answer_key_type VARCHAR(32);
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS source_type VARCHAR(32) DEFAULT 'seed';
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS published_by TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS deleted_by TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS created_by INT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS source_page INT;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS original_question_number TEXT;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS section TEXT;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS option_e TEXT;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS answer_status VARCHAR(32) DEFAULT 'unverified';
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS answer_source TEXT;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS explanation_source VARCHAR(32) DEFAULT 'none';
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(32) DEFAULT 'ok';
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS review_note TEXT;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS has_diagram_hint BOOLEAN DEFAULT false;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS medium VARCHAR(40) DEFAULT 'English';
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

        CREATE TABLE IF NOT EXISTS previous_paper_answer_keys (
          id SERIAL PRIMARY KEY,
          paper_id INT NOT NULL REFERENCES previous_year_papers(id) ON DELETE CASCADE,
          key_type VARCHAR(32) NOT NULL DEFAULT 'final',
          booklet_code VARCHAR(16),
          paper_code VARCHAR(64),
          filename TEXT,
          storage_path TEXT,
          file_hash VARCHAR(64),
          question_number INT NOT NULL,
          answer_option INT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_pyp_answer_keys_paper_q
          ON previous_paper_answer_keys (paper_id, question_number);

        CREATE TABLE IF NOT EXISTS previous_paper_processing_logs (
          id SERIAL PRIMARY KEY,
          paper_id INT NOT NULL REFERENCES previous_year_papers(id) ON DELETE CASCADE,
          stage VARCHAR(48) NOT NULL,
          level VARCHAR(16) NOT NULL DEFAULT 'info',
          message TEXT NOT NULL,
          details JSONB,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_pyp_logs_paper_created
          ON previous_paper_processing_logs (paper_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS previous_paper_audit_logs (
          id SERIAL PRIMARY KEY,
          admin_id TEXT NOT NULL,
          paper_id INT REFERENCES previous_year_papers(id) ON DELETE SET NULL,
          action VARCHAR(64) NOT NULL,
          previous_status VARCHAR(32),
          new_status VARCHAR(32),
          bulk_operation_id VARCHAR(64),
          details JSONB,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_pyp_audit_created
          ON previous_paper_audit_logs (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_pyp_audit_bulk_op
          ON previous_paper_audit_logs (bulk_operation_id);
      `);
    })().catch((err) => {
      adminSchemaPromise = null;
      throw err;
    });
  }
  await adminSchemaPromise;
}

export async function logPaperProcessing(
  paperId: number,
  stage: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  details?: any
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO previous_paper_processing_logs (paper_id, stage, level, message, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [paperId, stage, level, message, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.warn('[PYP Processing Log Error]:', err);
  }
}

async function updatePaperProgress(
  paperId: number,
  progress: number,
  message: string,
  processingStatus?: 'queued' | 'processing' | 'completed' | 'partial' | 'failed'
): Promise<void> {
  try {
    if (processingStatus) {
      await pool.query(
        `UPDATE previous_year_papers
         SET processing_progress = $1,
             processing_message = $2,
             processing_status = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [Math.max(0, Math.min(100, Math.round(progress))), message, processingStatus, paperId]
      );
    } else {
      await pool.query(
        `UPDATE previous_year_papers
         SET processing_progress = $1,
             processing_message = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [Math.max(0, Math.min(100, Math.round(progress))), message, paperId]
      );
    }
  } catch (err) {
    console.warn('[PYP Progress Update Error]:', err);
  }
}

function savePdfToDisk(buffer: Buffer, originalName: string, prefix: string): string {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const safeBase = path
    .basename(originalName || 'paper.pdf')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);
  const fileName = `${prefix}_${Date.now()}_${safeBase}`;
  const fullPath = path.join(UPLOADS_DIR, fileName);
  fs.writeFileSync(fullPath, buffer);
  return fullPath;
}

export function normalizeGroupCategory(raw: string): {
  category: 'group1' | 'group2_2a' | 'group4';
  exam: string;
} {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'group1' || s === 'group-1' || s.includes('group 1')) {
    return { category: 'group1', exam: 'TNPSC Group 1' };
  }
  if (
    s === 'group2_2a' ||
    s === 'group2' ||
    s === 'group-2' ||
    s === 'group2a' ||
    s === 'group-2a' ||
    s.includes('group 2') ||
    s.includes('2a')
  ) {
    return { category: 'group2_2a', exam: 'TNPSC Group 2 and 2A' };
  }
  return { category: 'group4', exam: 'TNPSC Group 4' };
}

export async function getAdminPreviousPapersStats() {
  await ensurePreviousPapersAdminSchema();

  const [summaryRes, byGroupRes, byYearRes] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS total_papers,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND pdf_filename IS NOT NULL)::int AS total_pdfs_uploaded,
        COALESCE((
          SELECT COUNT(*)::int
          FROM previous_year_paper_questions q
          INNER JOIN previous_year_papers p ON p.id = q.paper_id
          WHERE p.deleted_at IS NULL
        ), 0)::int AS total_questions_extracted,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'draft')::int AS draft_papers,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'staging')::int AS staging_papers,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'approved')::int AS approved_papers,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'published')::int AS published_papers,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'unpublished')::int AS unpublished_papers,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND processing_status = 'processing')::int AS processing_papers,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS deleted_papers
      FROM previous_year_papers
    `),
    pool.query(`
      SELECT category, exam, COUNT(*)::int AS count
      FROM previous_year_papers
      WHERE deleted_at IS NULL
      GROUP BY category, exam
      ORDER BY category ASC
    `),
    pool.query(`
      SELECT year, COUNT(*)::int AS count
      FROM previous_year_papers
      WHERE deleted_at IS NULL
      GROUP BY year
      ORDER BY year DESC
    `),
  ]);

  const s = summaryRes.rows[0] || {};
  return {
    totalPapers: Number(s.total_papers || 0),
    totalPdfsUploaded: Number(s.total_pdfs_uploaded || 0),
    totalQuestionsExtracted: Number(s.total_questions_extracted || 0),
    draftPapers: Number(s.draft_papers || 0),
    stagingPapers: Number(s.staging_papers || 0),
    pendingApprovalPapers: Number(s.staging_papers || 0) + Number(s.approved_papers || 0),
    approvedPapers: Number(s.approved_papers || 0),
    publishedPapers: Number(s.published_papers || 0),
    unpublishedPapers: Number(s.unpublished_papers || 0),
    processingPapers: Number(s.processing_papers || 0),
    deletedPapers: Number(s.deleted_papers || 0),
    byGroup: byGroupRes.rows.map((r) => ({
      category: r.category,
      exam: r.exam,
      count: Number(r.count || 0),
    })),
    byYear: byYearRes.rows.map((r) => ({
      year: Number(r.year),
      count: Number(r.count || 0),
    })),
  };
}

export async function listAdminPreviousPapersPaginated(filters: {
  group?: string;
  year?: number | string;
  subject?: string;
  medium?: string;
  status?: string;
  search?: string;
  includeDeleted?: boolean;
  sortBy?: 'year' | 'exam' | 'status' | 'questions';
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
} = {}) {
  await ensurePreviousPapersAdminSchema();

  const conditions: string[] = [filters.includeDeleted ? `p.deleted_at IS NOT NULL` : `p.deleted_at IS NULL`];
  const params: any[] = [];

  if (filters.group && filters.group !== 'all') {
    const g = filters.group.trim().toLowerCase();
    if (g === 'group2' || g === 'group2a' || g === 'group2_2a') {
      conditions.push(`p.category IN ('group2', 'group2a', 'group2_2a')`);
    } else {
      params.push(g);
      conditions.push(`p.category = $${params.length}`);
    }
  }
  if (filters.year && filters.year !== 'all' && !Number.isNaN(Number(filters.year))) {
    params.push(Number(filters.year));
    conditions.push(`p.year = $${params.length}`);
  }
  if (filters.subject && filters.subject !== 'all') {
    params.push(`%${filters.subject.trim()}%`);
    conditions.push(`LOWER(COALESCE(p.subjects, '')) LIKE LOWER($${params.length})`);
  }
  if (filters.medium && filters.medium !== 'all') {
    params.push(filters.medium.trim());
    conditions.push(`LOWER(COALESCE(p.medium, 'English')) = LOWER($${params.length})`);
  }
  if (filters.status && filters.status !== 'all') {
    params.push(filters.status.trim().toLowerCase());
    conditions.push(`LOWER(COALESCE(p.status, 'draft')) = $${params.length}`);
  }
  if (filters.search && filters.search.trim()) {
    params.push(`%${filters.search.trim()}%`);
    conditions.push(
      `(LOWER(COALESCE(p.paper_title, '')) LIKE LOWER($${params.length}) OR LOWER(COALESCE(p.subjects, '')) LIKE LOWER($${params.length}) OR LOWER(COALESCE(p.exam, '')) LIKE LOWER($${params.length}) OR LOWER(COALESCE(p.paper_code, '')) LIKE LOWER($${params.length}))`
    );
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;
  const dir = filters.sortDir === 'asc' ? 'ASC' : 'DESC';
  const orderSql =
    filters.sortBy === 'exam'
      ? `ORDER BY LOWER(COALESCE(p.paper_title, p.exam)) ${dir}, p.year DESC, p.id DESC`
      : filters.sortBy === 'status'
        ? `ORDER BY LOWER(COALESCE(p.status, 'draft')) ${dir}, p.year DESC, p.id DESC`
        : filters.sortBy === 'questions'
          ? `ORDER BY p.total_questions ${dir}, p.year DESC, p.id DESC`
          : `ORDER BY p.year ${dir}, p.id DESC`;

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(filters.limit) || 100));
  const offset = (page - 1) * limit;

  const [countRes, res] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total FROM previous_year_papers p ${whereSql}`, params),
    pool.query(
      `SELECT
         p.id, p.year, p.exam, p.category, p.subjects, p.paper_title, p.paper_type,
         p.medium, p.difficulty, p.total_questions, p.expected_questions, p.duration_minutes,
         p.marks_per_question::float AS marks_per_question,
         COALESCE(p.negative_marking, 0)::float AS negative_marking,
         p.status, p.pdf_filename, p.answer_key_filename, p.extraction_method,
         p.failed_extraction_count, p.matched_answer_count, p.unverified_answer_count,
         p.duplicate_count, p.conflict_count, p.explanation_status, p.explanation_generated_count,
         p.processing_status, p.processing_progress, p.processing_message,
         p.paper_code, p.booklet_code, p.answer_key_type,
         p.source_type, p.approved_at, p.published_at, p.published_by, p.deleted_at, p.deleted_by, p.updated_at,
         (SELECT COUNT(*)::int FROM previous_year_paper_questions q WHERE q.paper_id = p.id) AS question_count,
         (SELECT COUNT(*)::int FROM previous_year_paper_questions q WHERE q.paper_id = p.id AND COALESCE(q.needs_review, false) = true) AS flagged_count,
         (SELECT COUNT(*)::int FROM previous_year_paper_questions q WHERE q.paper_id = p.id AND COALESCE(q.is_approved, false) = true) AS approved_question_count
       FROM previous_year_papers p
       ${whereSql}
       ${orderSql}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
  ]);

  const total = Number(countRes.rows[0]?.total || 0);
  const items = res.rows.map((r: any) => ({
    id: Number(r.id),
    year: Number(r.year),
    exam: r.exam,
    category: r.category,
    subjects: r.subjects,
    paperTitle: r.paper_title || `${r.exam} ${r.year} — ${r.subjects}`,
    paperType: r.paper_type || 'Prelims',
    medium: r.medium || 'English',
    difficulty: r.difficulty || 'Medium',
    totalQuestions: Number(r.total_questions || 0),
    expectedQuestions: Number(r.expected_questions || r.total_questions || 0),
    questionCount: Number(r.question_count || 0),
    flaggedCount: Number(r.flagged_count || 0),
    approvedQuestionCount: Number(r.approved_question_count || 0),
    failedExtractionCount: Number(r.failed_extraction_count || 0),
    matchedAnswerCount: Number(r.matched_answer_count || 0),
    unverifiedAnswerCount: Number(r.unverified_answer_count || 0),
    duplicateCount: Number(r.duplicate_count || 0),
    conflictCount: Number(r.conflict_count || 0),
    explanationStatus: r.explanation_status || 'pending',
    explanationGeneratedCount: Number(r.explanation_generated_count || 0),
    processingStatus: r.processing_status || 'completed',
    processingProgress: Number(r.processing_progress ?? 100),
    processingMessage: r.processing_message || null,
    paperCode: r.paper_code || null,
    bookletCode: r.booklet_code || null,
    answerKeyType: r.answer_key_type || null,
    durationMinutes: Number(r.duration_minutes || 180),
    marksPerQuestion: Number(r.marks_per_question || 1.5),
    negativeMarking: Number(r.negative_marking || 0),
    status: r.status || 'draft',
    pdfFilename: r.pdf_filename || null,
    answerKeyFilename: r.answer_key_filename || null,
    extractionMethod: r.extraction_method || null,
    sourceType: r.source_type || 'seed',
    approvedAt: r.approved_at || null,
    publishedAt: r.published_at || null,
    publishedBy: r.published_by || null,
    deletedAt: r.deleted_at || null,
    deletedBy: r.deleted_by || null,
    updatedAt: r.updated_at || null,
  }));

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function listAdminPreviousPapers(filters: {
  group?: string;
  year?: number | string;
  subject?: string;
  medium?: string;
  status?: string;
  search?: string;
} = {}) {
  const res = await listAdminPreviousPapersPaginated({ ...filters, page: 1, limit: 200 });
  return res.items;
}

export async function getAdminPreviousPaperDetail(paperId: number) {
  await ensurePreviousPapersAdminSchema();

  const paperRes = await pool.query(
    `SELECT
       id, year, exam, category, subjects, paper_title, paper_type, medium, difficulty,
       total_questions, expected_questions, duration_minutes,
       marks_per_question::float AS marks_per_question,
       COALESCE(negative_marking, 0)::float AS negative_marking,
       status, pdf_filename, answer_key_filename, extraction_method,
       failed_extraction_count, matched_answer_count, unverified_answer_count,
       duplicate_count, conflict_count, missing_question_numbers,
       explanation_status, explanation_generated_count,
       processing_status, processing_progress, processing_message,
       paper_code, booklet_code, answer_key_type,
       source_type, approved_at, published_at, updated_at
     FROM previous_year_papers
     WHERE id = $1`,
    [paperId]
  );

  if (paperRes.rows.length === 0) return null;
  const p = paperRes.rows[0];

  const [qRes, logsRes] = await Promise.all([
    pool.query(
      `SELECT
         id, question_number, original_question_number, source_page, section,
         subject, topic, question_text, option_a, option_b, option_c, option_d, option_e,
         correct_answer, COALESCE(answer_status, 'unverified') AS answer_status,
         answer_source, explanation, COALESCE(explanation_source, 'none') AS explanation_source,
         COALESCE(is_duplicate, false) AS is_duplicate,
         COALESCE(extraction_status, 'ok') AS extraction_status,
         COALESCE(needs_review, false) AS needs_review,
         review_note, COALESCE(has_diagram_hint, false) AS has_diagram_hint,
         COALESCE(medium, 'English') AS medium,
         COALESCE(is_approved, false) AS is_approved
       FROM previous_year_paper_questions
       WHERE paper_id = $1
       ORDER BY question_number ASC, id ASC`,
      [paperId]
    ),
    pool.query(
      `SELECT id, stage, level, message, details, created_at
       FROM previous_paper_processing_logs
       WHERE paper_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [paperId]
    ),
  ]);

  const missingNums = Array.isArray(p.missing_question_numbers)
    ? p.missing_question_numbers.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
    : [];

  return {
    paper: {
      id: Number(p.id),
      year: Number(p.year),
      exam: p.exam,
      category: p.category,
      subjects: p.subjects,
      paperTitle: p.paper_title || `${p.exam} ${p.year} — ${p.subjects}`,
      paperType: p.paper_type || 'Prelims',
      medium: p.medium || 'English',
      difficulty: p.difficulty || 'Medium',
      totalQuestions: Number(p.total_questions || 0),
      expectedQuestions: Number(p.expected_questions || p.total_questions || 0),
      questionCount: qRes.rows.length,
      flaggedCount: qRes.rows.filter((q: any) => Boolean(q.needs_review)).length,
      approvedQuestionCount: qRes.rows.filter((q: any) => Boolean(q.is_approved)).length,
      failedExtractionCount: Number(p.failed_extraction_count || 0),
      matchedAnswerCount: Number(p.matched_answer_count || 0),
      unverifiedAnswerCount: Number(p.unverified_answer_count || 0),
      duplicateCount: Number(p.duplicate_count || 0),
      conflictCount: Number(p.conflict_count || 0),
      missingQuestionNumbers: missingNums,
      explanationStatus: p.explanation_status || 'pending',
      explanationGeneratedCount: Number(p.explanation_generated_count || 0),
      processingStatus: p.processing_status || 'completed',
      processingProgress: Number(p.processing_progress ?? 100),
      processingMessage: p.processing_message || null,
      paperCode: p.paper_code || null,
      bookletCode: p.booklet_code || null,
      answerKeyType: p.answer_key_type || null,
      durationMinutes: Number(p.duration_minutes || 180),
      marksPerQuestion: Number(p.marks_per_question || 1.5),
      negativeMarking: Number(p.negative_marking || 0),
      status: p.status || 'staging',
      pdfFilename: p.pdf_filename || null,
      answerKeyFilename: p.answer_key_filename || null,
      extractionMethod: p.extraction_method || null,
      sourceType: p.source_type || 'seed',
      approvedAt: p.approved_at || null,
      publishedAt: p.published_at || null,
      updatedAt: p.updated_at || null,
    },
    questions: qRes.rows.map((q: any) => ({
      id: Number(q.id),
      questionNumber: Number(q.question_number),
      originalQuestionNumber: q.original_question_number || String(q.question_number),
      sourcePage: q.source_page != null ? Number(q.source_page) : null,
      section: q.section || q.subject || p.subjects || 'General Studies',
      subject: q.subject || p.subjects || 'General Studies',
      topic: q.topic || '',
      questionText: q.question_text || '',
      optionA: q.option_a || '',
      optionB: q.option_b || '',
      optionC: q.option_c || '',
      optionD: q.option_d || '',
      optionE: q.option_e || null,
      correctAnswer: Number(q.correct_answer ?? 0),
      answerStatus: (q.answer_status || 'unverified') as AnswerVerificationStatus,
      answerSource: q.answer_source || null,
      explanation: q.explanation || '',
      explanationSource: q.explanation_source || 'none',
      isDuplicate: Boolean(q.is_duplicate),
      extractionStatus: q.extraction_status || 'ok',
      needsReview: Boolean(q.needs_review),
      reviewNote: q.review_note || null,
      hasDiagramHint: Boolean(q.has_diagram_hint),
      medium: q.medium || p.medium || 'English',
      isApproved: Boolean(q.is_approved),
    })),
    logs: logsRes.rows.map((l: any) => ({
      id: Number(l.id),
      stage: l.stage,
      level: l.level,
      message: l.message,
      details: l.details || null,
      createdAt: l.created_at,
    })),
  };
}

export async function getAdminPaperProcessingStatus(paperId: number) {
  await ensurePreviousPapersAdminSchema();
  const detail = await getAdminPreviousPaperDetail(paperId);
  if (!detail) return null;
  return {
    paperId: detail.paper.id,
    status: detail.paper.status,
    processingStatus: detail.paper.processingStatus,
    processingProgress: detail.paper.processingProgress,
    processingMessage: detail.paper.processingMessage,
    expectedQuestions: detail.paper.expectedQuestions,
    extractedCount: detail.paper.questionCount,
    failedExtractionCount: detail.paper.failedExtractionCount,
    matchedAnswerCount: detail.paper.matchedAnswerCount,
    unverifiedAnswerCount: detail.paper.unverifiedAnswerCount,
    duplicateCount: detail.paper.duplicateCount,
    conflictCount: detail.paper.conflictCount,
    flaggedCount: detail.paper.flaggedCount,
    explanationStatus: detail.paper.explanationStatus,
    explanationGeneratedCount: detail.paper.explanationGeneratedCount,
    missingQuestionNumbers: detail.paper.missingQuestionNumbers,
    logs: detail.logs,
  };
}

async function runPaperGenerationPipeline(params: {
  paperId: number;
  questionPdfBuffer: Buffer;
  answerKeyPdfBuffer?: Buffer | null;
  answerKeyFilename?: string | null;
  answerKeyStoragePath?: string | null;
  answerKeyType?: AnswerKeyTier | null;
  bookletCode?: string | null;
  paperCode?: string | null;
  expectedTotalQuestions: number;
  defaultSubject: string;
  medium: string;
  autoGenerateExplanations: boolean;
}) {
  const { paperId } = params;
  try {
    await logPaperProcessing(
      paperId,
      'extraction',
      'info',
      `Starting automatic extraction for Paper #${paperId} (Expected: ${params.expectedTotalQuestions} questions).`
    );

    const extraction = await extractQuestionsFromPreviousPaperPdf({
      questionPdfBuffer: params.questionPdfBuffer,
      answerKeyPdfBuffer: params.answerKeyPdfBuffer || null,
      answerKeyFilename: params.answerKeyFilename || null,
      answerKeyType: params.answerKeyType || null,
      bookletCode: params.bookletCode || null,
      expectedTotalQuestions: params.expectedTotalQuestions,
      defaultSubject: params.defaultSubject,
      medium: params.medium,
      onProgress: async (pct, msg) => {
        await updatePaperProgress(paperId, pct, msg, 'processing');
      },
    });

    await logPaperProcessing(
      paperId,
      'extraction',
      extraction.extractedCount > 0 ? 'info' : 'warn',
      `Extraction finished via ${extraction.extractionMethod}: ${extraction.extractedCount}/${params.expectedTotalQuestions} questions extracted, ${extraction.matchedAnswerKeysCount} matched answers, ${extraction.unverifiedAnswerCount} unverified, ${extraction.duplicateCount} duplicates, ${extraction.failedExtractionCount} failed/missing.`,
      {
        extractionMethod: extraction.extractionMethod,
        pageCount: extraction.pageCount,
        missingQuestionNumbers: extraction.missingQuestionNumbers.slice(0, 50),
        warnings: extraction.warnings,
      }
    );

    // Transactionally persist extracted questions & answer key entries into STAGING
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM previous_year_paper_questions WHERE paper_id = $1`, [paperId]);

      for (let i = 0; i < extraction.questions.length; i++) {
        const q = extraction.questions[i];
        await client.query(
          `INSERT INTO previous_year_paper_questions (
             paper_id, question_number, original_question_number, source_page, section,
             subject, topic, question_text, option_a, option_b, option_c, option_d, option_e,
             correct_answer, answer_status, answer_source, explanation, explanation_source,
             is_duplicate, extraction_status, needs_review, review_note, has_diagram_hint, medium
           )
           VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10, $11, $12, $13,
             $14, $15, $16, $17, $18,
             $19, $20, $21, $22, $23, $24
           )`,
          [
            paperId,
            i + 1,
            q.originalQuestionNumber,
            q.sourcePage,
            q.section,
            q.subject,
            q.topic,
            q.questionText,
            q.optionA,
            q.optionB,
            q.optionC,
            q.optionD,
            q.optionE,
            q.correctAnswer,
            q.answerStatus,
            q.answerSource,
            q.explanation || null,
            q.explanationSource,
            q.isDuplicate,
            q.extractionStatus,
            q.needsReview,
            q.reviewNote,
            q.hasDiagramHint,
            q.medium,
          ]
        );
      }

      // Persist official answer key entries if an Answer Key PDF was provided
      if (params.answerKeyPdfBuffer && params.answerKeyPdfBuffer.length > 0 && extraction.answerKeyMeta.totalKeysParsed > 0) {
        const keyParsed = await parseOfficialAnswerKeyPdf(params.answerKeyPdfBuffer, {
          bookletCode: params.bookletCode,
          filename: params.answerKeyFilename || undefined,
        });
        const keyHash = computeBufferSha256(params.answerKeyPdfBuffer);
        const keyType = params.answerKeyType || keyParsed.detectedKeyType || 'final';
        for (const [qNum, ansOpt] of keyParsed.answers.entries()) {
          await client.query(
            `INSERT INTO previous_paper_answer_keys (
               paper_id, key_type, booklet_code, paper_code, filename, storage_path, file_hash, question_number, answer_option
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              paperId,
              keyType,
              params.bookletCode || null,
              params.paperCode || keyParsed.detectedPaperCode || null,
              params.answerKeyFilename || null,
              params.answerKeyStoragePath || null,
              keyHash,
              qNum,
              ansOpt,
            ]
          );
        }
      }

      await client.query(
        `UPDATE previous_year_papers
         SET total_questions = $1,
             extraction_method = $2,
             extracted_count = $3,
             failed_extraction_count = $4,
             matched_answer_count = $5,
             unverified_answer_count = $6,
             duplicate_count = $7,
             conflict_count = $8,
             missing_question_numbers = $9::jsonb,
             flagged_count = $10,
             answer_key_type = COALESCE($11, answer_key_type),
             status = 'staging',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $12`,
        [
          extraction.extractedCount > 0 ? extraction.extractedCount : params.expectedTotalQuestions,
          extraction.extractionMethod,
          extraction.extractedCount,
          extraction.failedExtractionCount,
          extraction.matchedAnswerKeysCount,
          extraction.unverifiedAnswerCount,
          extraction.duplicateCount,
          extraction.conflictCount,
          JSON.stringify(extraction.missingQuestionNumbers),
          extraction.flaggedCount,
          extraction.answerKeyMeta.keyType,
          paperId,
        ]
      );

      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    // Step 4: Automatic AI Explanation Generation (isolated so failure never loses extracted questions)
    if (params.autoGenerateExplanations && extraction.extractedCount > 0 && extraction.matchedAnswerKeysCount > 0) {
      await updatePaperProgress(paperId, 78, 'Generating TNPSC study explanations for matched questions...', 'processing');
      try {
        await generatePreviousPaperExplanations(paperId, {
          onlyMissing: true,
          onProgress: async (pct, msg) => {
            await updatePaperProgress(paperId, pct, msg, 'processing');
          },
          logFn: async (stage, level, message, details) => {
            await logPaperProcessing(paperId, stage, level, message, details);
          },
        });
      } catch (expErr: any) {
        await logPaperProcessing(
          paperId,
          'explanations',
          'warn',
          `Automatic explanation generation failed (extracted questions preserved): ${expErr?.message || 'AI error'}`
        );
        await pool.query(
          `UPDATE previous_year_papers SET explanation_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [paperId]
        );
      }
    } else if (extraction.matchedAnswerKeysCount === 0) {
      await pool.query(
        `UPDATE previous_year_papers SET explanation_status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [paperId]
      );
    }

    const finalProcessingStatus =
      extraction.extractedCount === 0
        ? 'failed'
        : extraction.failedExtractionCount > 0 || extraction.conflictCount > 0
          ? 'partial'
          : 'completed';

    const finalMsg =
      extraction.extractedCount === 0
        ? 'Extraction completed with 0 questions — review PDF or reprocess with OCR.'
        : `Generated staging exam with ${extraction.extractedCount} question(s) (${extraction.matchedAnswerKeysCount} matched, ${extraction.unverifiedAnswerCount} unverified, ${extraction.failedExtractionCount} failed/missing). Ready for Admin review.`;

    await updatePaperProgress(paperId, 100, finalMsg, finalProcessingStatus);
    await logPaperProcessing(paperId, 'completed', finalProcessingStatus === 'failed' ? 'error' : 'info', finalMsg);
  } catch (err: any) {
    const errMsg = err?.message || 'Unexpected error during PDF extraction pipeline.';
    await updatePaperProgress(paperId, 100, `Processing failed: ${errMsg}`, 'failed');
    await logPaperProcessing(paperId, 'error', 'error', errMsg);
  }
}

export async function uploadAndExtractPreviousPaper(params: {
  group: string;
  year: number;
  examStream?: string;
  subject: string;
  paperTitle: string;
  paperType?: string;
  medium?: string;
  totalQuestions?: number;
  marksPerQuestion?: number;
  negativeMarking?: number;
  durationMinutes?: number;
  difficulty?: string;
  paperCode?: string;
  bookletCode?: string;
  answerKeyType?: AnswerKeyTier | null;
  autoGenerateExplanations?: boolean;
  asyncMode?: boolean;
  questionPdf: { buffer: Buffer; originalname: string };
  answerKeyPdf?: { buffer: Buffer; originalname: string } | null;
  adminId?: number | null;
}) {
  await ensurePreviousPapersAdminSchema();

  const { category, exam: canonicalExam } = normalizeGroupCategory(params.group);
  const examLabel = params.examStream?.trim() || canonicalExam;
  const year = Number(params.year);
  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    throw new Error('Please provide a valid examination year (e.g., 2024, 2025).');
  }

  const fileHash = computeBufferSha256(params.questionPdf.buffer);

  // Prevent duplicate PDF uploads
  const dupHash = await pool.query(
    `SELECT id, paper_title, year, exam FROM previous_year_papers WHERE pdf_file_hash = $1 LIMIT 1`,
    [fileHash]
  );
  if (dupHash.rows.length > 0) {
    const d = dupHash.rows[0];
    const err: any = new Error(
      `This exact PDF file has already been uploaded (Paper #${d.id}: ${d.exam} ${d.year} — ${d.paper_title || ''}).`
    );
    err.statusCode = 409;
    throw err;
  }

  const cleanTitle =
    params.paperTitle?.trim() || `${examLabel} ${year} — ${params.subject || 'General Studies'}`;
  const cleanMedium = params.medium?.trim() || 'English';
  const dupMeta = await pool.query(
    `SELECT id FROM previous_year_papers
     WHERE category = $1 AND year = $2
       AND LOWER(COALESCE(paper_title, '')) = LOWER($3)
       AND LOWER(COALESCE(medium, 'English')) = LOWER($4)
     LIMIT 1`,
    [category, year, cleanTitle, cleanMedium]
  );
  if (dupMeta.rows.length > 0) {
    const err: any = new Error(
      `A paper with the same Group, Year (${year}), Medium (${cleanMedium}), and Title ("${cleanTitle}") already exists.`
    );
    err.statusCode = 409;
    throw err;
  }

  // Save uploaded PDFs securely to disk
  const pdfStoragePath = savePdfToDisk(params.questionPdf.buffer, params.questionPdf.originalname, 'pyp_q');
  const answerKeyStoragePath = params.answerKeyPdf
    ? savePdfToDisk(params.answerKeyPdf.buffer, params.answerKeyPdf.originalname, 'pyp_key')
    : null;

  const expectedTotal = Number(params.totalQuestions) > 0 ? Number(params.totalQuestions) : 200;
  const marksPerQ = Number(params.marksPerQuestion) > 0 ? Number(params.marksPerQuestion) : 1.5;
  const negMark = Number(params.negativeMarking) >= 0 ? Number(params.negativeMarking) : 0;
  const durationMins = Number(params.durationMinutes) > 0 ? Number(params.durationMinutes) : 180;

  // Create paper record in STAGING with processing_status = 'processing'
  const insertPaper = await pool.query(
    `INSERT INTO previous_year_papers (
       year, exam, category, subjects, paper_title, paper_type, medium, difficulty,
       total_questions, expected_questions, duration_minutes, marks_per_question, negative_marking,
       status, pdf_filename, pdf_storage_path, pdf_file_hash,
       answer_key_filename, answer_key_storage_path,
       paper_code, booklet_code, answer_key_type,
       processing_status, processing_progress, processing_message,
       explanation_status, source_type, created_by, updated_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8,
       $9, $9, $10, $11, $12,
       'staging', $13, $14, $15,
       $16, $17,
       $18, $19, $20,
       'processing', 5, 'PDF uploaded securely. Queued for automatic extraction...',
       'pending', 'admin_pdf', $21, CURRENT_TIMESTAMP
     )
     RETURNING id`,
    [
      year,
      examLabel,
      category,
      params.subject?.trim() || 'General Studies',
      cleanTitle,
      params.paperType?.trim() || 'Prelims',
      cleanMedium,
      params.difficulty?.trim() || 'Medium',
      expectedTotal,
      durationMins,
      marksPerQ,
      negMark,
      params.questionPdf.originalname,
      pdfStoragePath,
      fileHash,
      params.answerKeyPdf?.originalname || null,
      answerKeyStoragePath,
      params.paperCode?.trim() || null,
      params.bookletCode?.trim().toUpperCase() || null,
      params.answerKeyType || null,
      params.adminId ?? null,
    ]
  );

  const paperId = Number(insertPaper.rows[0].id);
  await logPaperProcessing(
    paperId,
    'upload',
    'info',
    `Uploaded "${params.questionPdf.originalname}"${params.answerKeyPdf ? ` + Answer Key "${params.answerKeyPdf.originalname}"` : ''}.`
  );

  const pipelineInput = {
    paperId,
    questionPdfBuffer: params.questionPdf.buffer,
    answerKeyPdfBuffer: params.answerKeyPdf?.buffer || null,
    answerKeyFilename: params.answerKeyPdf?.originalname || null,
    answerKeyStoragePath,
    answerKeyType: params.answerKeyType || null,
    bookletCode: params.bookletCode?.trim().toUpperCase() || null,
    paperCode: params.paperCode?.trim() || null,
    expectedTotalQuestions: expectedTotal,
    defaultSubject: params.subject?.trim() || 'General Studies',
    medium: cleanMedium,
    autoGenerateExplanations: params.autoGenerateExplanations !== false,
  };

  if (params.asyncMode) {
    // Non-blocking background execution for large PDFs
    setImmediate(() => {
      void runPaperGenerationPipeline(pipelineInput);
    });
    const detail = await getAdminPreviousPaperDetail(paperId);
    return {
      ...detail,
      asyncProcessing: true,
    };
  }

  // Synchronous execution
  await runPaperGenerationPipeline(pipelineInput);
  const detail = await getAdminPreviousPaperDetail(paperId);
  return {
    ...detail,
    asyncProcessing: false,
    extractionReport: {
      extractionMethod: detail?.paper.extractionMethod,
      extractedCount: detail?.paper.questionCount ?? 0,
      expectedCount: detail?.paper.expectedQuestions ?? expectedTotal,
      failedExtractionCount: detail?.paper.failedExtractionCount ?? 0,
      matchedAnswerKeysCount: detail?.paper.matchedAnswerCount ?? 0,
      unverifiedAnswerCount: detail?.paper.unverifiedAnswerCount ?? 0,
      duplicateCount: detail?.paper.duplicateCount ?? 0,
      conflictCount: detail?.paper.conflictCount ?? 0,
      flaggedCount: detail?.paper.flaggedCount ?? 0,
      warnings: detail?.logs.filter((l) => l.level !== 'info').map((l) => l.message) || [],
    },
  };
}

export async function createPaperFromVerifiedUploads(params: {
  group: string;
  year: number;
  examStream?: string;
  subject: string;
  paperTitle: string;
  paperType?: string;
  medium?: string;
  totalQuestions?: number;
  marksPerQuestion?: number;
  negativeMarking?: number;
  durationMinutes?: number;
  difficulty?: string;
  paperCode?: string;
  bookletCode?: string;
  answerKeyType?: AnswerKeyTier | null;
  autoGenerateExplanations?: boolean;
  asyncMode?: boolean;
  questionUploadId: string;
  answerKeyUploadId?: string | null;
  adminId?: number | null;
}) {
  await ensurePreviousPapersAdminSchema();
  await ensurePreviousPaperUploadSchema();

  const qSession = await getUploadSession(params.questionUploadId);
  if (!qSession || qSession.status !== 'verified') {
    const err: any = new Error(
      'Question Paper PDF upload session is not verified. Please complete the upload first.'
    );
    err.statusCode = 400;
    throw err;
  }

  let keySession = null;
  if (params.answerKeyUploadId) {
    keySession = await getUploadSession(params.answerKeyUploadId);
    if (!keySession || keySession.status !== 'verified') {
      const err: any = new Error(
        'Answer Key PDF upload session is not verified. Please complete the upload first.'
      );
      err.statusCode = 400;
      throw err;
    }
  }

  const { category, exam: canonicalExam } = normalizeGroupCategory(params.group);
  const examLabel = params.examStream?.trim() || canonicalExam;
  const year = Number(params.year);
  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    throw new Error('Please provide a valid examination year (e.g., 2024, 2025).');
  }

  const fileHash = qSession.actualSha256 || qSession.expectedSha256 || '';
  if (fileHash) {
    const dupHash = await pool.query(
      `SELECT id, paper_title, year, exam FROM previous_year_papers WHERE pdf_file_hash = $1 LIMIT 1`,
      [fileHash]
    );
    if (dupHash.rows.length > 0) {
      const d = dupHash.rows[0];
      const err: any = new Error(
        `This exact PDF file has already been uploaded (Paper #${d.id}: ${d.exam} ${d.year} — ${d.paper_title || ''}).`
      );
      err.statusCode = 409;
      throw err;
    }
  }

  const cleanTitle =
    params.paperTitle?.trim() || `${examLabel} ${year} — ${params.subject || 'General Studies'}`;
  const cleanMedium = params.medium?.trim() || 'English';
  const dupMeta = await pool.query(
    `SELECT id FROM previous_year_papers
     WHERE category = $1 AND year = $2
       AND LOWER(COALESCE(paper_title, '')) = LOWER($3)
       AND LOWER(COALESCE(medium, 'English')) = LOWER($4)
     LIMIT 1`,
    [category, year, cleanTitle, cleanMedium]
  );
  if (dupMeta.rows.length > 0) {
    const err: any = new Error(
      `A paper with the same Group, Year (${year}), Medium (${cleanMedium}), and Title ("${cleanTitle}") already exists.`
    );
    err.statusCode = 409;
    throw err;
  }

  const expectedTotal = Number(params.totalQuestions) > 0 ? Number(params.totalQuestions) : 200;
  const marksPerQ = Number(params.marksPerQuestion) > 0 ? Number(params.marksPerQuestion) : 1.5;
  const negMark = Number(params.negativeMarking) >= 0 ? Number(params.negativeMarking) : 0;
  const durationMins = Number(params.durationMinutes) > 0 ? Number(params.durationMinutes) : 180;

  const insertPaper = await pool.query(
    `INSERT INTO previous_year_papers (
       year, exam, category, subjects, paper_title, paper_type, medium, difficulty,
       total_questions, expected_questions, duration_minutes, marks_per_question, negative_marking,
       status, pdf_filename, pdf_storage_path, pdf_storage_provider, pdf_storage_bucket,
       pdf_storage_object_key, pdf_drive_file_id, pdf_file_hash,
       answer_key_filename, answer_key_storage_path, answer_key_storage_provider,
       answer_key_storage_bucket, answer_key_storage_object_key, answer_key_drive_file_id,
       paper_code, booklet_code, answer_key_type,
       processing_status, processing_progress, processing_message,
       explanation_status, source_type, created_by, updated_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8,
       $9, $9, $10, $11, $12,
       'staging', $13, $14, $15, $16,
       $17, $18, $19,
       $20, $21, $22,
       $23, $24, $25,
       $26, $27, $28,
       'processing', 5, 'Verified direct upload received. Starting background PDF extraction...',
       'pending', 'admin_pdf', $29, CURRENT_TIMESTAMP
     )
     RETURNING id`,
    [
      year,
      examLabel,
      category,
      params.subject?.trim() || 'General Studies',
      cleanTitle,
      params.paperType?.trim() || 'Prelims',
      cleanMedium,
      params.difficulty?.trim() || 'Medium',
      expectedTotal,
      durationMins,
      marksPerQ,
      negMark,
      qSession.originalFilename,
      qSession.localTempPath || null,
      qSession.storageProvider,
      qSession.storageBucket || null,
      qSession.storageObjectKey || null,
      qSession.driveFileId || null,
      fileHash || null,
      keySession?.originalFilename || null,
      keySession?.localTempPath || null,
      keySession?.storageProvider || null,
      keySession?.storageBucket || null,
      keySession?.storageObjectKey || null,
      keySession?.driveFileId || null,
      params.paperCode?.trim() || null,
      params.bookletCode?.trim().toUpperCase() || null,
      params.answerKeyType || null,
      params.adminId ?? null,
    ]
  );

  const paperId = Number(insertPaper.rows[0].id);
  await logPaperProcessing(
    paperId,
    'upload',
    'info',
    `Verified direct upload (${qSession.storageProvider}, ${(qSession.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB): "${qSession.originalFilename}"${keySession ? ` + Answer Key "${keySession.originalFilename}"` : ''}.`
  );

  const executeBackgroundExtraction = async () => {
    let qMat: { filePath: string; cleanup: () => Promise<void> } | null = null;
    let kMat: { filePath: string; cleanup: () => Promise<void> } | null = null;
    try {
      await updatePaperProgress(paperId, 8, 'Streaming verified PDF from object storage for extraction...', 'processing');
      qMat = await materializeStoredPdfToTempFile({
        storageProvider: qSession.storageProvider,
        storageBucket: qSession.storageBucket,
        storageObjectKey: qSession.storageObjectKey,
        driveFileId: qSession.driveFileId,
        localPath: qSession.localTempPath,
      });
      if (keySession) {
        kMat = await materializeStoredPdfToTempFile({
          storageProvider: keySession.storageProvider,
          storageBucket: keySession.storageBucket,
          storageObjectKey: keySession.storageObjectKey,
          driveFileId: keySession.driveFileId,
          localPath: keySession.localTempPath,
        });
      }

      const questionPdfBuffer = await fs.promises.readFile(qMat.filePath);
      const answerKeyPdfBuffer = kMat ? await fs.promises.readFile(kMat.filePath) : null;

      await runPaperGenerationPipeline({
        paperId,
        questionPdfBuffer,
        answerKeyPdfBuffer,
        answerKeyFilename: keySession?.originalFilename || null,
        answerKeyStoragePath: keySession?.localTempPath || keySession?.storageObjectKey || null,
        answerKeyType: params.answerKeyType || null,
        bookletCode: params.bookletCode?.trim().toUpperCase() || null,
        paperCode: params.paperCode?.trim() || null,
        expectedTotalQuestions: expectedTotal,
        defaultSubject: params.subject?.trim() || 'General Studies',
        medium: cleanMedium,
        autoGenerateExplanations: params.autoGenerateExplanations !== false,
      });
    } catch (err: any) {
      const msg = err?.message || 'Failed to stream PDF from storage for extraction.';
      await updatePaperProgress(paperId, 100, `Processing failed: ${msg}`, 'failed');
      await logPaperProcessing(paperId, 'error', 'error', msg);
    } finally {
      if (qMat) await qMat.cleanup();
      if (kMat) await kMat.cleanup();
    }
  };

  if (params.asyncMode !== false) {
    setImmediate(() => {
      void executeBackgroundExtraction();
    });
    const detail = await getAdminPreviousPaperDetail(paperId);
    return { ...detail, asyncProcessing: true };
  }

  await executeBackgroundExtraction();
  const detail = await getAdminPreviousPaperDetail(paperId);
  return { ...detail, asyncProcessing: false };
}

export async function applyAnswerKeyFromVerifiedUpload(
  paperId: number,
  answerKeyUploadId: string,
  options?: { keyType?: AnswerKeyTier | null; bookletCode?: string | null }
) {
  await ensurePreviousPapersAdminSchema();
  await ensurePreviousPaperUploadSchema();

  const keySession = await getUploadSession(answerKeyUploadId);
  if (!keySession || keySession.status !== 'verified') {
    const err: any = new Error('Answer Key upload session is not verified.');
    err.statusCode = 400;
    throw err;
  }

  const mat = await materializeStoredPdfToTempFile({
    storageProvider: keySession.storageProvider,
    storageBucket: keySession.storageBucket,
    storageObjectKey: keySession.storageObjectKey,
    driveFileId: keySession.driveFileId,
    localPath: keySession.localTempPath,
  });

  try {
    const buffer = await fs.promises.readFile(mat.filePath);
    const result = await applyAnswerKeyPdfToPaper(
      paperId,
      { buffer, originalname: keySession.originalFilename },
      options
    );
    if (result) {
      await pool.query(
        `UPDATE previous_year_papers
         SET answer_key_storage_provider = $1,
             answer_key_storage_bucket = $2,
             answer_key_storage_object_key = $3,
             answer_key_drive_file_id = $4
         WHERE id = $5`,
        [
          keySession.storageProvider,
          keySession.storageBucket || null,
          keySession.storageObjectKey || null,
          keySession.driveFileId || null,
          paperId,
        ]
      );
    }
    return result;
  } finally {
    await mat.cleanup();
  }
}

export async function reprocessFailedQuestionsForPaper(paperId: number) {
  await ensurePreviousPapersAdminSchema();

  const paperRes = await pool.query(`SELECT * FROM previous_year_papers WHERE id = $1`, [paperId]);
  if (paperRes.rows.length === 0) return null;
  const p = paperRes.rows[0];

  let qMat: { filePath: string; cleanup: () => Promise<void> } | null = null;
  let kMat: { filePath: string; cleanup: () => Promise<void> } | null = null;
  try {
    qMat = await materializeStoredPdfToTempFile({
      storageProvider: p.pdf_storage_provider,
      storageBucket: p.pdf_storage_bucket,
      storageObjectKey: p.pdf_storage_object_key,
      driveFileId: p.pdf_drive_file_id,
      localPath: p.pdf_storage_path,
    });
  } catch {
    const err: any = new Error('Stored source Question Paper PDF is not available in cloud or local storage for reprocessing.');
    err.statusCode = 400;
    throw err;
  }

  try {
    if (p.answer_key_storage_path || p.answer_key_storage_object_key || p.answer_key_drive_file_id) {
      kMat = await materializeStoredPdfToTempFile({
        storageProvider: p.answer_key_storage_provider,
        storageBucket: p.answer_key_storage_bucket,
        storageObjectKey: p.answer_key_storage_object_key,
        driveFileId: p.answer_key_drive_file_id,
        localPath: p.answer_key_storage_path,
      }).catch(() => null);
    }

    const questionPdfBuffer = await fs.promises.readFile(qMat.filePath);
    const answerKeyPdfBuffer = kMat ? await fs.promises.readFile(kMat.filePath) : null;

  await updatePaperProgress(paperId, 10, 'Reprocessing failed/missing questions from source PDF...', 'processing');
  await logPaperProcessing(paperId, 'reprocess', 'info', 'Admin triggered reprocessing of failed/missing questions.');

  const extraction = await extractQuestionsFromPreviousPaperPdf({
    questionPdfBuffer,
    answerKeyPdfBuffer,
    answerKeyFilename: p.answer_key_filename || null,
    answerKeyType: (p.answer_key_type as AnswerKeyTier) || null,
    bookletCode: p.booklet_code || null,
    expectedTotalQuestions: Number(p.expected_questions || p.total_questions || 200),
    defaultSubject: p.subjects || 'General Studies',
    medium: p.medium || 'English',
  });

  // Preserve already-verified questions; only insert missing ones or replace failed ones
  const existingRes = await pool.query(
    `SELECT id, question_number, original_question_number, extraction_status, answer_status
     FROM previous_year_paper_questions
     WHERE paper_id = $1`,
    [paperId]
  );

  const existingByOrig = new Map<string, any>();
  for (const row of existingRes.rows) {
    existingByOrig.set(String(row.original_question_number || row.question_number), row);
  }

  let addedOrUpdated = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let nextQNum = existingRes.rows.length;

    for (const q of extraction.questions) {
      const existing = existingByOrig.get(String(q.originalQuestionNumber));
      if (!existing) {
        nextQNum += 1;
        await client.query(
          `INSERT INTO previous_year_paper_questions (
             paper_id, question_number, original_question_number, source_page, section,
             subject, topic, question_text, option_a, option_b, option_c, option_d, option_e,
             correct_answer, answer_status, answer_source, explanation, explanation_source,
             is_duplicate, extraction_status, needs_review, review_note, has_diagram_hint, medium
           )
           VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10, $11, $12, $13,
             $14, $15, $16, $17, $18,
             $19, $20, $21, $22, $23, $24
           )`,
          [
            paperId,
            nextQNum,
            q.originalQuestionNumber,
            q.sourcePage,
            q.section,
            q.subject,
            q.topic,
            q.questionText,
            q.optionA,
            q.optionB,
            q.optionC,
            q.optionD,
            q.optionE,
            q.correctAnswer,
            q.answerStatus,
            q.answerSource,
            q.explanation || null,
            q.explanationSource,
            q.isDuplicate,
            q.extractionStatus,
            q.needsReview,
            q.reviewNote,
            q.hasDiagramHint,
            q.medium,
          ]
        );
        addedOrUpdated += 1;
      } else if (existing.extraction_status === 'failed' && q.extractionStatus !== 'failed') {
        await client.query(
          `UPDATE previous_year_paper_questions
           SET question_text = $1, option_a = $2, option_b = $3, option_c = $4, option_d = $5,
               option_e = $6, extraction_status = $7, needs_review = $8, review_note = $9
           WHERE id = $10`,
          [
            q.questionText,
            q.optionA,
            q.optionB,
            q.optionC,
            q.optionD,
            q.optionE,
            q.extractionStatus,
            q.needsReview,
            q.reviewNote,
            existing.id,
          ]
        );
        addedOrUpdated += 1;
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await recomputePaperSummaryCounts(paperId);
  await updatePaperProgress(
    paperId,
    100,
    `Reprocessing complete: ${addedOrUpdated} question(s) recovered or updated.`,
    'completed'
  );
  await logPaperProcessing(
    paperId,
    'reprocess',
    'info',
    `Reprocessing finished (${addedOrUpdated} question(s) recovered/updated).`
  );

  return getAdminPreviousPaperDetail(paperId);
  } finally {
    if (qMat) await qMat.cleanup();
    if (kMat) await kMat.cleanup();
  }
}

export async function recomputePaperSummaryCounts(paperId: number): Promise<void> {
  await pool.query(
    `UPDATE previous_year_papers p
     SET total_questions = COALESCE((SELECT COUNT(*)::int FROM previous_year_paper_questions q WHERE q.paper_id = p.id), 0),
         extracted_count = COALESCE((SELECT COUNT(*)::int FROM previous_year_paper_questions q WHERE q.paper_id = p.id), 0),
         flagged_count = COALESCE((SELECT COUNT(*)::int FROM previous_year_paper_questions q WHERE q.paper_id = p.id AND COALESCE(q.needs_review, false) = true), 0),
         matched_answer_count = COALESCE((SELECT COUNT(*)::int FROM previous_year_paper_questions q WHERE q.paper_id = p.id AND COALESCE(q.answer_status, 'unverified') IN ('verified_final', 'verified_revised', 'tentative', 'admin_verified')), 0),
         unverified_answer_count = COALESCE((SELECT COUNT(*)::int FROM previous_year_paper_questions q WHERE q.paper_id = p.id AND COALESCE(q.answer_status, 'unverified') = 'unverified'), 0),
         conflict_count = COALESCE((SELECT COUNT(*)::int FROM previous_year_paper_questions q WHERE q.paper_id = p.id AND COALESCE(q.answer_status, 'unverified') = 'conflict'), 0),
         duplicate_count = COALESCE((SELECT COUNT(*)::int FROM previous_year_paper_questions q WHERE q.paper_id = p.id AND COALESCE(q.is_duplicate, false) = true), 0),
         explanation_generated_count = COALESCE((SELECT COUNT(*)::int FROM previous_year_paper_questions q WHERE q.paper_id = p.id AND q.explanation IS NOT NULL AND LENGTH(TRIM(q.explanation)) > 10), 0),
         updated_at = CURRENT_TIMESTAMP
     WHERE p.id = $1`,
    [paperId]
  );
}

export async function updateAdminPreviousPaperMeta(
  paperId: number,
  body: {
    group?: string;
    year?: number;
    examStream?: string;
    subject?: string;
    paperTitle?: string;
    paperType?: string;
    medium?: string;
    difficulty?: string;
    totalQuestions?: number;
    marksPerQuestion?: number;
    negativeMarking?: number;
    durationMinutes?: number;
    paperCode?: string;
    bookletCode?: string;
  }
) {
  await ensurePreviousPapersAdminSchema();

  const existingRes = await pool.query(`SELECT * FROM previous_year_papers WHERE id = $1`, [paperId]);
  if (existingRes.rows.length === 0) return null;
  const ex = existingRes.rows[0];

  const groupInfo = body.group ? normalizeGroupCategory(body.group) : { category: ex.category, exam: ex.exam };

  await pool.query(
    `UPDATE previous_year_papers
     SET year = $1,
         category = $2,
         exam = $3,
         subjects = $4,
         paper_title = $5,
         paper_type = $6,
         medium = $7,
         difficulty = $8,
         total_questions = $9,
         marks_per_question = $10,
         negative_marking = $11,
         duration_minutes = $12,
         paper_code = $13,
         booklet_code = $14,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $15`,
    [
      body.year ? Number(body.year) : Number(ex.year),
      groupInfo.category,
      body.examStream?.trim() || groupInfo.exam,
      body.subject?.trim() || ex.subjects,
      body.paperTitle?.trim() || ex.paper_title,
      body.paperType?.trim() || ex.paper_type || 'Prelims',
      body.medium?.trim() || ex.medium || 'English',
      body.difficulty?.trim() || ex.difficulty || 'Medium',
      body.totalQuestions ? Number(body.totalQuestions) : Number(ex.total_questions),
      body.marksPerQuestion !== undefined ? Number(body.marksPerQuestion) : Number(ex.marks_per_question),
      body.negativeMarking !== undefined ? Number(body.negativeMarking) : Number(ex.negative_marking || 0),
      body.durationMinutes ? Number(body.durationMinutes) : Number(ex.duration_minutes),
      body.paperCode !== undefined ? body.paperCode?.trim() || null : ex.paper_code,
      body.bookletCode !== undefined ? body.bookletCode?.trim().toUpperCase() || null : ex.booklet_code,
      paperId,
    ]
  );

  return getAdminPreviousPaperDetail(paperId);
}

export async function saveAdminPreviousPaperQuestions(
  paperId: number,
  questions: {
    originalQuestionNumber?: string;
    sourcePage?: number | null;
    section?: string;
    subject?: string;
    topic?: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    optionE?: string | null;
    correctAnswer: number;
    answerStatus?: AnswerVerificationStatus;
    answerSource?: string | null;
    explanation?: string;
    explanationSource?: string;
    isDuplicate?: boolean;
    extractionStatus?: string;
    needsReview?: boolean;
    reviewNote?: string | null;
    hasDiagramHint?: boolean;
    medium?: string;
    isApproved?: boolean;
  }[]
) {
  await ensurePreviousPapersAdminSchema();

  const paperRes = await pool.query(`SELECT id, subjects, medium FROM previous_year_papers WHERE id = $1`, [paperId]);
  if (paperRes.rows.length === 0) return null;
  const p = paperRes.rows[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`DELETE FROM previous_year_paper_questions WHERE paper_id = $1`, [paperId]);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const needsReview = Boolean(q.needsReview);
      const ansStatus: AnswerVerificationStatus =
        q.answerStatus || (needsReview ? 'unverified' : 'admin_verified');
      const expText = q.explanation?.trim() || null;
      const expSource =
        q.explanationSource && q.explanationSource !== 'none'
          ? q.explanationSource
          : expText
            ? 'admin'
            : 'none';
      const canBeApproved =
        Boolean(q.isApproved) &&
        Boolean(String(q.questionText || '').trim()) &&
        Boolean(String(q.optionA || '').trim()) &&
        Boolean(String(q.optionB || '').trim()) &&
        Boolean(String(q.optionC || '').trim()) &&
        Boolean(String(q.optionD || '').trim()) &&
        ansStatus !== 'unverified' &&
        ansStatus !== 'conflict';

      await client.query(
        `INSERT INTO previous_year_paper_questions (
           paper_id, question_number, original_question_number, source_page, section,
           subject, topic, question_text, option_a, option_b, option_c, option_d, option_e,
           correct_answer, answer_status, answer_source, explanation, explanation_source,
           is_duplicate, extraction_status, needs_review, review_note, has_diagram_hint, medium, is_approved
         )
         VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10, $11, $12, $13,
           $14, $15, $16, $17, $18,
           $19, $20, $21, $22, $23, $24, $25
         )`,
        [
          paperId,
          i + 1,
          q.originalQuestionNumber || String(i + 1),
          q.sourcePage ?? null,
          q.section?.trim() || q.subject?.trim() || p.subjects || 'General Studies',
          q.subject?.trim() || p.subjects || 'General Studies',
          q.topic?.trim() || '',
          String(q.questionText || '').trim(),
          String(q.optionA || '').trim(),
          String(q.optionB || '').trim(),
          String(q.optionC || '').trim(),
          String(q.optionD || '').trim(),
          q.optionE?.trim() || null,
          Math.max(0, Math.min(3, Number(q.correctAnswer) || 0)),
          ansStatus,
          q.answerSource || (ansStatus === 'admin_verified' ? 'admin_verified' : null),
          expText,
          expSource,
          Boolean(q.isDuplicate),
          q.extractionStatus || (needsReview ? 'needs_review' : 'ok'),
          needsReview,
          q.reviewNote || null,
          Boolean(q.hasDiagramHint),
          q.medium || p.medium || 'English',
          canBeApproved,
        ]
      );
    }

    await client.query('COMMIT');
    await recomputePaperSummaryCounts(paperId);
    return getAdminPreviousPaperDetail(paperId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function applyAnswerKeyPdfToPaper(
  paperId: number,
  answerKeyPdf: { buffer: Buffer; originalname: string },
  options?: { keyType?: AnswerKeyTier | null; bookletCode?: string | null }
) {
  await ensurePreviousPapersAdminSchema();

  const detail = await getAdminPreviousPaperDetail(paperId);
  if (!detail) return null;

  const bookletCode = options?.bookletCode?.trim().toUpperCase() || detail.paper.bookletCode || null;
  const parsedKey = await parseOfficialAnswerKeyPdf(answerKeyPdf.buffer, {
    bookletCode,
    filename: answerKeyPdf.originalname,
  });

  const resolvedTier: AnswerKeyTier = options?.keyType || parsedKey.detectedKeyType || 'final';
  const incomingStatus = keyTierToAnswerStatus(resolvedTier);
  const incomingPriority = ANSWER_STATUS_PRIORITY[incomingStatus];
  const keyPath = savePdfToDisk(answerKeyPdf.buffer, answerKeyPdf.originalname, 'pyp_key');
  const keyHash = computeBufferSha256(answerKeyPdf.buffer);

  let matchedCount = 0;
  let conflictCount = 0;
  let skippedLowerPriority = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const [qNum, ansOpt] of parsedKey.answers.entries()) {
      await client.query(
        `INSERT INTO previous_paper_answer_keys (
           paper_id, key_type, booklet_code, paper_code, filename, storage_path, file_hash, question_number, answer_option
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          paperId,
          resolvedTier,
          bookletCode,
          detail.paper.paperCode || parsedKey.detectedPaperCode || null,
          answerKeyPdf.originalname,
          keyPath,
          keyHash,
          qNum,
          ansOpt,
        ]
      );
    }

    for (const q of detail.questions) {
      const origNum = Number(q.originalQuestionNumber) || q.questionNumber;
      const ans = parsedKey.answers.get(origNum) ?? parsedKey.answers.get(q.questionNumber);
      if (ans === undefined) continue;

      const curStatus = (q.answerStatus || 'unverified') as AnswerVerificationStatus;
      const curPriority = ANSWER_STATUS_PRIORITY[curStatus] ?? 0;

      // Never overwrite higher-priority official answer with a lower-priority key
      if (curPriority > incomingPriority) {
        skippedLowerPriority += 1;
        continue;
      }

      // Same-tier conflict detection -> send to Admin review
      if (curPriority === incomingPriority && curPriority > 0 && q.correctAnswer !== ans) {
        conflictCount += 1;
        const conflictNote = `Answer conflict: existing (${String.fromCharCode(65 + q.correctAnswer)}) vs ${resolvedTier} key (${String.fromCharCode(65 + ans)}) — Admin verification required`;
        await client.query(
          `UPDATE previous_year_paper_questions
           SET answer_status = 'conflict',
               needs_review = true,
               review_note = $1
           WHERE id = $2`,
          [conflictNote, q.id]
        );
        continue;
      }

      matchedCount += 1;
      const stillMissingOpts = !q.optionA || !q.optionB || !q.optionC || !q.optionD;
      const nextNeedsReview = stillMissingOpts || q.hasDiagramHint || incomingStatus === 'tentative';
      const nextNote =
        incomingStatus === 'tentative'
          ? 'Answer matched from TENTATIVE key — verify against official final key'
          : nextNeedsReview
            ? q.reviewNote
            : null;

      await client.query(
        `UPDATE previous_year_paper_questions
         SET correct_answer = $1,
             answer_status = $2,
             answer_source = $3,
             needs_review = $4,
             review_note = $5
         WHERE id = $6`,
        [
          ans,
          incomingStatus,
          `${resolvedTier}:${answerKeyPdf.originalname}${bookletCode ? ` [${bookletCode}]` : ''}`,
          nextNeedsReview,
          nextNote,
          q.id,
        ]
      );
    }

    await client.query(
      `UPDATE previous_year_papers
       SET answer_key_filename = $1,
           answer_key_storage_path = $2,
           answer_key_type = $3,
           booklet_code = COALESCE($4, booklet_code),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [answerKeyPdf.originalname, keyPath, resolvedTier, bookletCode, paperId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await recomputePaperSummaryCounts(paperId);
  await logPaperProcessing(
    paperId,
    'answer_key',
    conflictCount > 0 ? 'warn' : 'info',
    `Applied ${resolvedTier.toUpperCase()} Answer Key "${answerKeyPdf.originalname}": ${matchedCount} matched, ${conflictCount} conflicts, ${skippedLowerPriority} preserved higher-priority answers.`
  );

  const updated = await getAdminPreviousPaperDetail(paperId);
  return {
    ...updated,
    matchedCount,
    conflictCount,
    skippedLowerPriority,
    keyType: resolvedTier,
    totalKeysParsed: parsedKey.rawEntriesCount,
  };
}

function validatePaperReadyForPublish(detail: NonNullable<Awaited<ReturnType<typeof getAdminPreviousPaperDetail>>>) {
  if (detail.questions.length === 0) {
    const err: any = new Error('Cannot publish a paper with 0 questions. Extract or add questions first.');
    err.statusCode = 400;
    throw err;
  }
  const invalidQ = detail.questions.find(
    (q) =>
      !q.questionText.trim() ||
      !q.optionA.trim() ||
      !q.optionB.trim() ||
      !q.optionC.trim() ||
      !q.optionD.trim()
  );
  if (invalidQ) {
    const err: any = new Error(
      `Question #${invalidQ.questionNumber} is missing text or one of options A–D. Please review and complete it before publishing.`
    );
    err.statusCode = 400;
    throw err;
  }
  const conflictQ = detail.questions.find((q) => q.answerStatus === 'conflict');
  if (conflictQ) {
    const err: any = new Error(
      `Question #${conflictQ.questionNumber} has an unresolved answer key conflict. Please verify it before publishing.`
    );
    err.statusCode = 400;
    throw err;
  }
  if (detail.paper.sourceType === 'manual_paste') {
    const unapprovedCount = detail.questions.filter((q) => !q.isApproved).length;
    if (unapprovedCount > 0) {
      const err: any = new Error(
        `${unapprovedCount} question(s) are not yet approved. Approve all questions before publishing the examination.`
      );
      err.statusCode = 400;
      throw err;
    }
  }
}

export async function updateAdminPreviousPaperStatus(
  paperId: number,
  nextStatus: 'draft' | 'staging' | 'approved' | 'published' | 'unpublished',
  adminUsername = 'admin'
) {
  await ensurePreviousPapersAdminSchema();

  const allowed = new Set(['draft', 'staging', 'approved', 'published', 'unpublished']);
  if (!allowed.has(nextStatus)) {
    throw new Error('Invalid status transition.');
  }

  const detail = await getAdminPreviousPaperDetail(paperId);
  if (!detail) return null;

  const prevStatus = detail.paper.status;

  if (nextStatus === 'published') {
    if (prevStatus !== 'approved' && prevStatus !== 'unpublished' && prevStatus !== 'published') {
      const err: any = new Error(
        'Examination must be Approved by Admin before publishing to the Student Website.'
      );
      err.statusCode = 400;
      throw err;
    }
    validatePaperReadyForPublish(detail);
  }

  await pool.query(
    `UPDATE previous_year_papers
     SET status = $1::varchar,
         approved_at = CASE WHEN $1::text = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
         published_at = CASE WHEN $1::text = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END,
         published_by = CASE WHEN $1::text = 'published' THEN $3::text ELSE published_by END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND deleted_at IS NULL`,
    [nextStatus, paperId, adminUsername]
  );

  await pool.query(
    `INSERT INTO previous_paper_audit_logs (admin_id, paper_id, action, previous_status, new_status, details)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      adminUsername,
      paperId,
      nextStatus === 'published' ? 'PUBLISH' : nextStatus === 'unpublished' ? 'UNPUBLISH' : 'STATUS_CHANGE',
      prevStatus,
      nextStatus,
      JSON.stringify({ paperTitle: detail.paper.paperTitle }),
    ]
  );

  await logPaperProcessing(paperId, 'status', 'info', `Paper status changed to ${nextStatus.toUpperCase()} by ${adminUsername}.`);

  if (nextStatus === 'published' || nextStatus === 'unpublished') {
    broadcastAnalyticsEvent('previous_paper_published', { paperId, status: nextStatus });
  }

  return getAdminPreviousPaperDetail(paperId);
}

export async function bulkPublishApprovedPapers(paperIds: number[]) {
  await ensurePreviousPapersAdminSchema();
  const cleanIds = Array.from(
    new Set(paperIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))
  );
  if (cleanIds.length === 0) {
    const err: any = new Error('Please select at least one approved examination to bulk publish.');
    err.statusCode = 400;
    throw err;
  }

  const publishedIds: number[] = [];
  const rejected: { paperId: number; reason: string }[] = [];

  for (const id of cleanIds) {
    const detail = await getAdminPreviousPaperDetail(id);
    if (!detail) {
      rejected.push({ paperId: id, reason: 'Paper not found.' });
      continue;
    }
    if (detail.paper.status !== 'approved') {
      rejected.push({
        paperId: id,
        reason: `Status is "${detail.paper.status}" — only Admin-APPROVED papers can be bulk published.`,
      });
      continue;
    }
    try {
      validatePaperReadyForPublish(detail);
      await pool.query(
        `UPDATE previous_year_papers
         SET status = 'published',
             published_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );
      await logPaperProcessing(id, 'publish', 'info', 'Published via Bulk Publish Approved.');
      broadcastAnalyticsEvent('previous_paper_published', { paperId: id, status: 'published' });
      publishedIds.push(id);
    } catch (err: any) {
      rejected.push({ paperId: id, reason: err?.message || 'Validation failed.' });
    }
  }

  return { publishedIds, rejected };
}

export async function createPaperFromPastedQuestions(params: {
  group: string;
  year: number;
  examStream?: string;
  subject?: string;
  paperTitle: string;
  paperType?: string;
  medium?: string;
  totalQuestions?: number;
  marksPerQuestion?: number;
  negativeMarking?: number;
  durationMinutes?: number;
  questions: {
    originalQuestionNumber?: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: number | null;
    answerVerificationStatus?: string;
    verificationSource?: string;
    medium?: string;
    explanation?: string;
    subject?: string;
    topic?: string;
    isDuplicate?: boolean;
    needsReview?: boolean;
    reviewNote?: string | null;
  }[];
  adminId?: number | null;
}) {
  await ensurePreviousPapersAdminSchema();

  if (!Array.isArray(params.questions) || params.questions.length === 0) {
    const err: any = new Error('Please parse at least one question before saving to Staging.');
    err.statusCode = 400;
    throw err;
  }

  const { category, exam: canonicalExam } = normalizeGroupCategory(params.group);
  const examLabel = params.examStream?.trim() || canonicalExam;
  const year = Number(params.year);
  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    const err: any = new Error('Please provide a valid examination year (e.g., 2024, 2025).');
    err.statusCode = 400;
    throw err;
  }

  const cleanTitle = params.paperTitle?.trim() || `${examLabel} ${year} — Official Question Paper`;
  const cleanMedium = params.medium?.trim() || 'English';

  // Prevent accidental duplicate examination imports (by metadata OR content hash)
  const dupMeta = await pool.query(
    `SELECT id FROM previous_year_papers
     WHERE deleted_at IS NULL
       AND category = $1 AND year = $2
       AND LOWER(COALESCE(paper_title, '')) = LOWER($3)
       AND LOWER(COALESCE(medium, 'English')) = LOWER($4)
     LIMIT 1`,
    [category, year, cleanTitle, cleanMedium]
  );
  if (dupMeta.rows.length > 0) {
    const err: any = new Error(
      `An examination with the same Group, Year (${year}), Medium (${cleanMedium}), and Paper Title ("${cleanTitle}") already exists.`
    );
    err.statusCode = 409;
    throw err;
  }

  const contentSignature = params.questions
    .map((q) => `${q.questionText}|${q.optionA}|${q.optionB}|${q.optionC}|${q.optionD}`)
    .join('\n');
  const contentHash = computeBufferSha256(Buffer.from(contentSignature, 'utf8'));

  const dupHash = await pool.query(
    `SELECT id, exam, year, paper_title FROM previous_year_papers WHERE deleted_at IS NULL AND pdf_file_hash = $1 LIMIT 1`,
    [contentHash]
  );
  if (dupHash.rows.length > 0) {
    const d = dupHash.rows[0];
    const err: any = new Error(
      `These exact pasted questions have already been imported (Examination #${d.id}: ${d.exam} ${d.year} — ${d.paper_title}).`
    );
    err.statusCode = 409;
    throw err;
  }

  const expectedTotal =
    Number(params.totalQuestions) > 0 ? Number(params.totalQuestions) : params.questions.length;
  const marksPerQ = Number(params.marksPerQuestion) > 0 ? Number(params.marksPerQuestion) : 1.5;
  const negMark = Number(params.negativeMarking) >= 0 ? Number(params.negativeMarking) : 0;
  const durationMins = Number(params.durationMinutes) > 0 ? Number(params.durationMinutes) : 180;

  const client = await pool.connect();
  let paperId = 0;
  try {
    await client.query('BEGIN');

    const insertPaper = await client.query(
      `INSERT INTO previous_year_papers (
         year, exam, category, subjects, paper_title, paper_type, medium, difficulty,
         total_questions, expected_questions, duration_minutes, marks_per_question, negative_marking,
         status, pdf_file_hash, extraction_method,
         processing_status, processing_progress, processing_message,
         explanation_status, source_type, created_by, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, 'Medium',
         $8, $9, $10, $11, $12,
         'staging', $13, 'manual_paste',
         'completed', 100, $14,
         'completed', 'manual_paste', $15, CURRENT_TIMESTAMP
       )
       RETURNING id`,
      [
        year,
        examLabel,
        category,
        params.subject?.trim() || cleanTitle,
        cleanTitle,
        params.paperType?.trim() || 'Prelims',
        cleanMedium,
        params.questions.length,
        expectedTotal,
        durationMins,
        marksPerQ,
        negMark,
        contentHash,
        `Saved ${params.questions.length} manually pasted question(s) into STAGING.`,
        params.adminId ?? null,
      ]
    );
    paperId = Number(insertPaper.rows[0].id);

    // Batch insert questions (50 rows per statement) inside the transaction so 200-500+ questions save in < 500ms
    const INSERT_BATCH_SIZE = 50;
    const COLS_PER_ROW = 21;

    for (let batchStart = 0; batchStart < params.questions.length; batchStart += INSERT_BATCH_SIZE) {
      const batch = params.questions.slice(batchStart, batchStart + INSERT_BATCH_SIZE);
      const values: any[] = [];
      const rowPlaceholders: string[] = [];

      for (let offset = 0; offset < batch.length; offset++) {
        const i = batchStart + offset;
        const q = batch[offset];
        const hasValidAns =
          q.correctAnswer !== null &&
          q.correctAnswer !== undefined &&
          Number.isInteger(Number(q.correctAnswer)) &&
          Number(q.correctAnswer) >= 0 &&
          Number(q.correctAnswer) <= 3;
        const missingOpts =
          !String(q.optionA || '').trim() ||
          !String(q.optionB || '').trim() ||
          !String(q.optionC || '').trim() ||
          !String(q.optionD || '').trim();
        const rawVerifyStatus = String(q.answerVerificationStatus || '').toUpperCase();
        const ansStatus: AnswerVerificationStatus =
          rawVerifyStatus === 'VERIFIED'
            ? 'admin_verified'
            : rawVerifyStatus === 'ANSWER_CONFLICT' || rawVerifyStatus === 'NEEDS_REVIEW' || rawVerifyStatus === 'ANSWER_MISSING'
            ? 'unverified'
            : hasValidAns
            ? 'admin_verified'
            : 'unverified';
        const needsReview =
          Boolean(q.needsReview) ||
          missingOpts ||
          !hasValidAns ||
          rawVerifyStatus === 'ANSWER_CONFLICT' ||
          Boolean(q.isDuplicate);
        const expText = q.explanation?.trim() || null;
        const ansSource = q.verificationSource?.trim() || (hasValidAns ? 'manual_paste' : null);
        const rowMedium = q.medium?.trim() || cleanMedium;

        const base = offset * COLS_PER_ROW;
        rowPlaceholders.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17}, $${base + 18}, $${base + 19}, $${base + 20}, $${base + 21}, false)`
        );

        values.push(
          paperId,
          i + 1,
          q.originalQuestionNumber || String(i + 1),
          q.subject?.trim() || 'General Studies',
          q.subject?.trim() || 'General Studies',
          q.topic?.trim() || '',
          String(q.questionText || '').trim(),
          String(q.optionA || '').trim(),
          String(q.optionB || '').trim(),
          String(q.optionC || '').trim(),
          String(q.optionD || '').trim(),
          hasValidAns ? Number(q.correctAnswer) : 0,
          ansStatus,
          ansSource,
          expText,
          expText ? 'admin' : 'none',
          Boolean(q.isDuplicate),
          needsReview ? 'needs_review' : 'ok',
          needsReview,
          q.reviewNote || null,
          rowMedium
        );
      }

      await client.query(
        `INSERT INTO previous_year_paper_questions (
           paper_id, question_number, original_question_number, section,
           subject, topic, question_text, option_a, option_b, option_c, option_d,
           correct_answer, answer_status, answer_source, explanation, explanation_source,
           is_duplicate, extraction_status, needs_review, review_note, medium, is_approved
         )
         VALUES ${rowPlaceholders.join(', ')}`,
        values
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await recomputePaperSummaryCounts(paperId);
  await logPaperProcessing(
    paperId,
    'manual_paste',
    'info',
    `Imported ${params.questions.length} pasted question(s) into STAGING.`
  );

  return getAdminPreviousPaperDetail(paperId);
}

export async function approvePaperQuestions(
  paperId: number,
  options: {
    questionIds?: number[];
    approveAllValid?: boolean;
    isApproved?: boolean;
  }
) {
  await ensurePreviousPapersAdminSchema();
  const detail = await getAdminPreviousPaperDetail(paperId);
  if (!detail) return null;

  const targetApproved = options.isApproved !== false;
  let updatedCount = 0;
  let skippedInvalidCount = 0;

  const targetSet =
    Array.isArray(options.questionIds) && options.questionIds.length > 0
      ? new Set(options.questionIds.map((id) => Number(id)))
      : null;

  for (const q of detail.questions) {
    if (targetSet && !targetSet.has(q.id)) continue;
    if (!targetSet && !options.approveAllValid) continue;

    if (targetApproved) {
      const isValid =
        Boolean(q.questionText.trim()) &&
        Boolean(q.optionA.trim()) &&
        Boolean(q.optionB.trim()) &&
        Boolean(q.optionC.trim()) &&
        Boolean(q.optionD.trim()) &&
        q.answerStatus !== 'unverified' &&
        q.answerStatus !== 'conflict';

      if (!isValid) {
        skippedInvalidCount += 1;
        continue;
      }

      await pool.query(
        `UPDATE previous_year_paper_questions
         SET is_approved = true,
             needs_review = false,
             review_note = NULL
         WHERE id = $1 AND paper_id = $2`,
        [q.id, paperId]
      );
      updatedCount += 1;
    } else {
      await pool.query(
        `UPDATE previous_year_paper_questions
         SET is_approved = false
         WHERE id = $1 AND paper_id = $2`,
        [q.id, paperId]
      );
      updatedCount += 1;
    }
  }

  await recomputePaperSummaryCounts(paperId);

  // Automatically reflect approval status on the examination if all questions are approved
  const refreshed = await getAdminPreviousPaperDetail(paperId);
  if (refreshed && refreshed.questions.length > 0) {
    const allApproved = refreshed.questions.every((q) => q.isApproved);
    if (allApproved && (refreshed.paper.status === 'staging' || refreshed.paper.status === 'draft')) {
      await pool.query(
        `UPDATE previous_year_papers
         SET status = 'approved',
             approved_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [paperId]
      );
    } else if (!allApproved && refreshed.paper.status === 'approved') {
      await pool.query(
        `UPDATE previous_year_papers
         SET status = 'staging',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [paperId]
      );
    }
  }

  const finalDetail = await getAdminPreviousPaperDetail(paperId);
  return { ...finalDetail, updatedCount, skippedInvalidCount };
}

export async function deleteAdminPreviousPaper(paperId: number, adminUsername = 'admin'): Promise<boolean> {
  await ensurePreviousPapersAdminSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id, status, paper_title FROM previous_year_papers WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [paperId]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    const prevStatus = String(existing.rows[0].status || 'staging');
    const nextStatus = prevStatus === 'published' ? 'unpublished' : prevStatus;

    await client.query(
      `UPDATE previous_year_papers
       SET deleted_at = CURRENT_TIMESTAMP,
           deleted_by = $2,
           status = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [paperId, adminUsername, nextStatus]
    );

    await client.query(
      `INSERT INTO previous_paper_audit_logs (admin_id, paper_id, action, previous_status, new_status, details)
       VALUES ($1, $2, 'SOFT_DELETE', $3, 'deleted', $4::jsonb)`,
      [adminUsername, paperId, prevStatus, JSON.stringify({ paperTitle: existing.rows[0].paper_title })]
    );

    await client.query('COMMIT');
    if (prevStatus === 'published') {
      broadcastAnalyticsEvent('previous_paper_published', { paperId, status: 'unpublished' });
    }
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
