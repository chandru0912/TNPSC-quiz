import fs from 'fs';
import path from 'path';
import pool from '../db';
import { broadcastAnalyticsEvent } from './analyticsEventBus';
import {
  computeBufferSha256,
  extractQuestionsFromPreviousPaperPdf,
  parseAnswerKeyText,
} from './previousPaperPdfParser';
import { getPdfParseClass } from './pdfProcessor';

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
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS pdf_file_hash VARCHAR(64);
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS answer_key_filename TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS answer_key_storage_path TEXT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(60);
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS extracted_count INT DEFAULT 0;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS flagged_count INT DEFAULT 0;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS source_type VARCHAR(32) DEFAULT 'seed';
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS created_by INT;
        ALTER TABLE previous_year_papers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS source_page INT;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS original_question_number TEXT;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS review_note TEXT;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS has_diagram_hint BOOLEAN DEFAULT false;
        ALTER TABLE previous_year_paper_questions ADD COLUMN IF NOT EXISTS medium VARCHAR(40) DEFAULT 'English';
      `);
    })().catch((err) => {
      adminSchemaPromise = null;
      throw err;
    });
  }
  await adminSchemaPromise;
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

export function normalizeGroupCategory(raw: string): { category: 'group1' | 'group2_2a' | 'group4'; exam: string } {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'group1' || s.includes('group 1') || s === 'group-1') {
    return { category: 'group1', exam: 'TNPSC Group 1' };
  }
  if (s === 'group2_2a' || s === 'group2' || s.includes('group 2') || s.includes('2a')) {
    return { category: 'group2_2a', exam: 'TNPSC Group 2 & 2A' };
  }
  return { category: 'group4', exam: 'TNPSC Group 4' };
}

export async function getAdminPreviousPapersStats() {
  await ensurePreviousPapersAdminSchema();

  const [summaryRes, byGroupRes, byYearRes] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int AS total_papers,
        COUNT(*) FILTER (WHERE pdf_filename IS NOT NULL)::int AS total_pdfs_uploaded,
        COALESCE((SELECT COUNT(*)::int FROM previous_year_paper_questions), 0)::int AS total_questions_extracted,
        COUNT(*) FILTER (WHERE status = 'draft')::int AS draft_papers,
        COUNT(*) FILTER (WHERE status = 'staging')::int AS staging_papers,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_papers,
        COUNT(*) FILTER (WHERE status = 'published')::int AS published_papers,
        COUNT(*) FILTER (WHERE status = 'unpublished')::int AS unpublished_papers
      FROM previous_year_papers
    `),
    pool.query(`
      SELECT category, exam, COUNT(*)::int AS count
      FROM previous_year_papers
      GROUP BY category, exam
      ORDER BY category ASC
    `),
    pool.query(`
      SELECT year, COUNT(*)::int AS count
      FROM previous_year_papers
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

export async function listAdminPreviousPapers(filters: {
  group?: string;
  year?: number | string;
  subject?: string;
  medium?: string;
  status?: string;
  search?: string;
} = {}) {
  await ensurePreviousPapersAdminSchema();

  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.group && filters.group !== 'all') {
    params.push(filters.group);
    conditions.push(`p.category = $${params.length}`);
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
      `(LOWER(COALESCE(p.paper_title, '')) LIKE LOWER($${params.length}) OR LOWER(COALESCE(p.subjects, '')) LIKE LOWER($${params.length}) OR LOWER(COALESCE(p.exam, '')) LIKE LOWER($${params.length}))`
    );
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await pool.query(
    `SELECT
       p.id, p.year, p.exam, p.category, p.subjects, p.paper_title, p.paper_type,
       p.medium, p.difficulty, p.total_questions, p.duration_minutes,
       p.marks_per_question::float AS marks_per_question,
       COALESCE(p.negative_marking, 0)::float AS negative_marking,
       p.status, p.pdf_filename, p.answer_key_filename, p.extraction_method,
       p.source_type, p.published_at, p.updated_at,
       (SELECT COUNT(*)::int FROM previous_year_paper_questions q WHERE q.paper_id = p.id) AS question_count,
       (SELECT COUNT(*)::int FROM previous_year_paper_questions q WHERE q.paper_id = p.id AND COALESCE(q.needs_review, false) = true) AS flagged_count
     FROM previous_year_papers p
     ${whereSql}
     ORDER BY p.year DESC, p.id DESC`,
    params
  );

  return res.rows.map((r: any) => ({
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
    questionCount: Number(r.question_count || 0),
    flaggedCount: Number(r.flagged_count || 0),
    durationMinutes: Number(r.duration_minutes || 180),
    marksPerQuestion: Number(r.marks_per_question || 1.5),
    negativeMarking: Number(r.negative_marking || 0),
    status: r.status || 'draft',
    pdfFilename: r.pdf_filename || null,
    answerKeyFilename: r.answer_key_filename || null,
    extractionMethod: r.extraction_method || null,
    sourceType: r.source_type || 'seed',
    publishedAt: r.published_at || null,
    updatedAt: r.updated_at || null,
  }));
}

export async function getAdminPreviousPaperDetail(paperId: number) {
  await ensurePreviousPapersAdminSchema();

  const paperRes = await pool.query(
    `SELECT
       id, year, exam, category, subjects, paper_title, paper_type, medium, difficulty,
       total_questions, duration_minutes, marks_per_question::float AS marks_per_question,
       COALESCE(negative_marking, 0)::float AS negative_marking,
       status, pdf_filename, answer_key_filename, extraction_method,
       source_type, published_at, updated_at
     FROM previous_year_papers
     WHERE id = $1`,
    [paperId]
  );

  if (paperRes.rows.length === 0) return null;
  const p = paperRes.rows[0];

  const qRes = await pool.query(
    `SELECT
       id, question_number, original_question_number, source_page,
       subject, topic, question_text, option_a, option_b, option_c, option_d,
       correct_answer, explanation, COALESCE(needs_review, false) AS needs_review,
       review_note, COALESCE(has_diagram_hint, false) AS has_diagram_hint,
       COALESCE(medium, 'English') AS medium
     FROM previous_year_paper_questions
     WHERE paper_id = $1
     ORDER BY question_number ASC, id ASC`,
    [paperId]
  );

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
      durationMinutes: Number(p.duration_minutes || 180),
      marksPerQuestion: Number(p.marks_per_question || 1.5),
      negativeMarking: Number(p.negative_marking || 0),
      status: p.status || 'draft',
      pdfFilename: p.pdf_filename || null,
      answerKeyFilename: p.answer_key_filename || null,
      extractionMethod: p.extraction_method || null,
      sourceType: p.source_type || 'seed',
      publishedAt: p.published_at || null,
      updatedAt: p.updated_at || null,
    },
    questions: qRes.rows.map((q: any) => ({
      id: Number(q.id),
      questionNumber: Number(q.question_number),
      originalQuestionNumber: q.original_question_number || String(q.question_number),
      sourcePage: q.source_page != null ? Number(q.source_page) : null,
      subject: q.subject || p.subjects || 'General Studies',
      topic: q.topic || '',
      questionText: q.question_text || '',
      optionA: q.option_a || '',
      optionB: q.option_b || '',
      optionC: q.option_c || '',
      optionD: q.option_d || '',
      correctAnswer: Number(q.correct_answer ?? 0),
      explanation: q.explanation || '',
      needsReview: Boolean(q.needs_review),
      reviewNote: q.review_note || null,
      hasDiagramHint: Boolean(q.has_diagram_hint),
      medium: q.medium || p.medium || 'English',
    })),
  };
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

  const cleanTitle = params.paperTitle?.trim() || `${examLabel} ${year} — ${params.subject || 'General Studies'}`;
  const dupMeta = await pool.query(
    `SELECT id FROM previous_year_papers
     WHERE category = $1 AND year = $2 AND LOWER(COALESCE(paper_title, '')) = LOWER($3)
     LIMIT 1`,
    [category, year, cleanTitle]
  );
  if (dupMeta.rows.length > 0) {
    const err: any = new Error(
      `A paper with the same Group, Year (${year}), and Title ("${cleanTitle}") already exists.`
    );
    err.statusCode = 409;
    throw err;
  }

  // Extract questions from PDF (and optional Answer Key PDF)
  const extraction = await extractQuestionsFromPreviousPaperPdf({
    questionPdfBuffer: params.questionPdf.buffer,
    answerKeyPdfBuffer: params.answerKeyPdf?.buffer || null,
    defaultSubject: params.subject || 'General Studies',
    medium: params.medium || 'English',
  });

  // Save uploaded PDFs securely to disk
  const pdfStoragePath = savePdfToDisk(params.questionPdf.buffer, params.questionPdf.originalname, 'pyp_q');
  const answerKeyStoragePath = params.answerKeyPdf
    ? savePdfToDisk(params.answerKeyPdf.buffer, params.answerKeyPdf.originalname, 'pyp_key')
    : null;

  const declaredTotal = Number(params.totalQuestions) || extraction.questions.length || 200;
  const marksPerQ = Number(params.marksPerQuestion) > 0 ? Number(params.marksPerQuestion) : 1.5;
  const negMark = Number(params.negativeMarking) >= 0 ? Number(params.negativeMarking) : 0;
  const durationMins = Number(params.durationMinutes) > 0 ? Number(params.durationMinutes) : 180;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertPaper = await client.query(
      `INSERT INTO previous_year_papers (
         year, exam, category, subjects, paper_title, paper_type, medium, difficulty,
         total_questions, duration_minutes, marks_per_question, negative_marking,
         status, pdf_filename, pdf_storage_path, pdf_file_hash,
         answer_key_filename, answer_key_storage_path, extraction_method,
         extracted_count, flagged_count, source_type, created_by, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12,
         'draft', $13, $14, $15,
         $16, $17, $18,
         $19, $20, 'admin_pdf', $21, CURRENT_TIMESTAMP
       )
       RETURNING id`,
      [
        year,
        examLabel,
        category,
        params.subject?.trim() || 'General Studies',
        cleanTitle,
        params.paperType?.trim() || 'Prelims',
        params.medium?.trim() || 'English',
        params.difficulty?.trim() || 'Medium',
        extraction.questions.length > 0 ? extraction.questions.length : declaredTotal,
        durationMins,
        marksPerQ,
        negMark,
        params.questionPdf.originalname,
        pdfStoragePath,
        fileHash,
        params.answerKeyPdf?.originalname || null,
        answerKeyStoragePath,
        extraction.extractionMethod,
        extraction.questions.length,
        extraction.flaggedCount,
        params.adminId ?? null,
      ]
    );

    const paperId = Number(insertPaper.rows[0].id);

    for (let i = 0; i < extraction.questions.length; i++) {
      const q = extraction.questions[i];
      await client.query(
        `INSERT INTO previous_year_paper_questions (
           paper_id, question_number, original_question_number, source_page,
           subject, topic, question_text, option_a, option_b, option_c, option_d,
           correct_answer, explanation, needs_review, review_note, has_diagram_hint, medium
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          paperId,
          i + 1,
          q.originalQuestionNumber,
          q.sourcePage,
          q.subject,
          q.topic,
          q.questionText,
          q.optionA,
          q.optionB,
          q.optionC,
          q.optionD,
          q.correctAnswer,
          q.explanation || null,
          q.needsReview,
          q.reviewNote,
          q.hasDiagramHint,
          q.medium,
        ]
      );
    }

    await client.query('COMMIT');

    const detail = await getAdminPreviousPaperDetail(paperId);
    return {
      ...detail,
      extractionReport: {
        extractionMethod: extraction.extractionMethod,
        pageCount: extraction.pageCount,
        extractedCount: extraction.questions.length,
        flaggedCount: extraction.flaggedCount,
        matchedAnswerKeysCount: extraction.matchedAnswerKeysCount,
        warnings: extraction.warnings,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $13`,
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
    subject?: string;
    topic?: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: number;
    explanation?: string;
    needsReview?: boolean;
    reviewNote?: string | null;
    hasDiagramHint?: boolean;
    medium?: string;
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

    let flaggedCount = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const needsReview = Boolean(q.needsReview);
      if (needsReview) flaggedCount += 1;

      await client.query(
        `INSERT INTO previous_year_paper_questions (
           paper_id, question_number, original_question_number, source_page,
           subject, topic, question_text, option_a, option_b, option_c, option_d,
           correct_answer, explanation, needs_review, review_note, has_diagram_hint, medium
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          paperId,
          i + 1,
          q.originalQuestionNumber || String(i + 1),
          q.sourcePage ?? null,
          q.subject?.trim() || p.subjects || 'General Studies',
          q.topic?.trim() || '',
          String(q.questionText || '').trim(),
          String(q.optionA || '').trim(),
          String(q.optionB || '').trim(),
          String(q.optionC || '').trim(),
          String(q.optionD || '').trim(),
          Math.max(0, Math.min(3, Number(q.correctAnswer) || 0)),
          q.explanation?.trim() || null,
          needsReview,
          q.reviewNote || null,
          Boolean(q.hasDiagramHint),
          q.medium || p.medium || 'English',
        ]
      );
    }

    await client.query(
      `UPDATE previous_year_papers
       SET total_questions = $1,
           extracted_count = $1,
           flagged_count = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [questions.length, flaggedCount, paperId]
    );

    await client.query('COMMIT');
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
  answerKeyPdf: { buffer: Buffer; originalname: string }
) {
  await ensurePreviousPapersAdminSchema();

  const detail = await getAdminPreviousPaperDetail(paperId);
  if (!detail) return null;

  const PDFParseClass = getPdfParseClass();
  let parser: any = null;
  let fullText = '';
  try {
    parser = new PDFParseClass({ data: answerKeyPdf.buffer });
    const parsed = await parser.getText();
    fullText = String(parsed?.text || '');
  } finally {
    if (parser && typeof parser.destroy === 'function') {
      await parser.destroy().catch(() => {});
    }
  }

  const keyMap = parseAnswerKeyText(fullText);
  const keyPath = savePdfToDisk(answerKeyPdf.buffer, answerKeyPdf.originalname, 'pyp_key');

  let matchedCount = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const q of detail.questions) {
      const origNum = Number(q.originalQuestionNumber) || q.questionNumber;
      const ans = keyMap.get(origNum) ?? keyMap.get(q.questionNumber);
      if (ans !== undefined) {
        matchedCount += 1;
        const stillMissingOpts = !q.optionA || !q.optionB || !q.optionC || !q.optionD;
        const nextNeedsReview = stillMissingOpts || q.hasDiagramHint;
        await client.query(
          `UPDATE previous_year_paper_questions
           SET correct_answer = $1,
               needs_review = $2,
               review_note = $3
           WHERE id = $4`,
          [
            ans,
            nextNeedsReview,
            nextNeedsReview ? q.reviewNote : null,
            q.id,
          ]
        );
      }
    }

    await client.query(
      `UPDATE previous_year_papers
       SET answer_key_filename = $1,
           answer_key_storage_path = $2,
           flagged_count = (SELECT COUNT(*)::int FROM previous_year_paper_questions WHERE paper_id = $3 AND COALESCE(needs_review, false) = true),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [answerKeyPdf.originalname, keyPath, paperId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const updated = await getAdminPreviousPaperDetail(paperId);
  return { ...updated, matchedCount, totalKeysParsed: keyMap.size };
}

export async function updateAdminPreviousPaperStatus(
  paperId: number,
  nextStatus: 'draft' | 'staging' | 'approved' | 'published' | 'unpublished'
) {
  await ensurePreviousPapersAdminSchema();

  const allowed = new Set(['draft', 'staging', 'approved', 'published', 'unpublished']);
  if (!allowed.has(nextStatus)) {
    throw new Error('Invalid status transition.');
  }

  const detail = await getAdminPreviousPaperDetail(paperId);
  if (!detail) return null;

  if (nextStatus === 'published') {
    if (detail.questions.length === 0) {
      const err: any = new Error('Cannot publish a paper with 0 questions. Extract or add questions first.');
      err.statusCode = 400;
      throw err;
    }
    const invalidQ = detail.questions.find(
      (q) => !q.questionText.trim() || !q.optionA.trim() || !q.optionB.trim() || !q.optionC.trim() || !q.optionD.trim()
    );
    if (invalidQ) {
      const err: any = new Error(
        `Question #${invalidQ.questionNumber} is missing text or one of options A–D. Please review and complete it before publishing.`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  await pool.query(
    `UPDATE previous_year_papers
     SET status = $1,
         published_at = CASE WHEN $1 = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [nextStatus, paperId]
  );

  if (nextStatus === 'published' || nextStatus === 'unpublished') {
    broadcastAnalyticsEvent('previous_paper_published', { paperId, status: nextStatus });
  }

  return getAdminPreviousPaperDetail(paperId);
}

export async function deleteAdminPreviousPaper(paperId: number): Promise<boolean> {
  await ensurePreviousPapersAdminSchema();
  const res = await pool.query(`DELETE FROM previous_year_papers WHERE id = $1 RETURNING id`, [paperId]);
  return res.rows.length > 0;
}
