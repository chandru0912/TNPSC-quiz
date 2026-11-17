import pool from '../db';
import { seedCompleteSyllabusData } from './seedSyllabusCatalog';
import { compareLessons, compareTopics } from '../utils/naturalSort';

function normalizeMatchedTopics(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of value) {
      let str = '';
      if (typeof item === 'string') str = item;
      else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        if (typeof obj.topic_name === 'string') str = obj.topic_name;
        else if (typeof obj.title === 'string') str = obj.title;
        else if (typeof obj.name === 'string') str = obj.name;
      }
      if (!str) continue;
      for (const part of str.split(/[,;]/)) {
        const trimmed = part.trim();
        if (trimmed && !seen.has(trimmed.toLowerCase())) {
          seen.add(trimmed.toLowerCase());
          out.push(trimmed);
        }
      }
    }
    return out;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return normalizeMatchedTopics(parsed);
      } catch {
        // Fall through
      }
    }
    const out: string[] = [];
    const seen = new Set<string>();
    for (const part of trimmed.split(/[,;]/)) {
      const item = part.trim();
      if (item && !seen.has(item.toLowerCase())) {
        seen.add(item.toLowerCase());
        out.push(item);
      }
    }
    return out;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.topics)) return normalizeMatchedTopics(obj.topics);
    if (typeof obj.topic_name === 'string') return normalizeMatchedTopics(obj.topic_name);
  }
  return [];
}

export interface ExamRecord {
  id: string;
  name: string;
  code?: string | null;
  badge?: string | null;
  description?: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SubjectRecord {
  id: string;
  exam_id: string;
  subject_slug: string;
  name: string;
  description?: string | null;
  icon_name?: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UnitRecord {
  id: number;
  exam_id: string;
  subject_id: string;
  standard_number?: number | null;
  excluded_standards?: number[] | null;
  unit_number: number;
  unit_code: string;
  title: string;
  subject_name?: string | null;
  description?: string | null;
  question_count: number;
  display_order: number;
  is_active: boolean;
  lessons_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface LessonRecord {
  id: string;
  unit_id: number;
  exam_id: string;
  subject_id: string;
  standard_number: number;
  lesson_number: string;
  title: string;
  term?: string | null;
  description?: string | null;
  status: string;
  display_order: number;
  is_active: boolean;
  topics_count?: number;
  has_notes?: boolean;
  textbook_id?: number | null;
  textbook_title?: string | null;
  textbook_unit_number?: string | null;
  textbook_unit_title?: string | null;
  matched_topics?: string[] | any;
  syllabus_reference?: string | null;
  textbook_page_reference?: string | null;
  mapping_status?: string | null;
  verification_status?: string | null;
  topics?: TopicRecord[];
  created_at?: string;
  updated_at?: string;
}

export interface TopicRecord {
  id: number;
  lesson_id: string;
  unit_id: number;
  topic_name: string;
  description?: string | null;
  syllabus_reference?: string | null;
  source_page_reference?: string | null;
  display_order: number;
  is_active: boolean;
  notes_count?: number;
  has_notes?: boolean;
  notes_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export function normalizeExamId(val?: string): string {
  if (!val) return 'group1';
  const c = val.toLowerCase().trim();
  if (c === 'group2a' || c === 'group-2a') return 'group2a';
  if (c === 'group2_2a' || c === 'group2' || c === 'group-2') return 'group2';
  if (c === 'group4_vao' || c === 'group4' || c === 'group-4' || c === 'vao') return 'group4';
  if (c === 'group1' || c === 'group-1') return 'group1';
  return c;
}

export function getExamFamilyIds(val?: string): string[] {
  const clean = normalizeExamId(val);
  if (clean === 'group2' || clean === 'group2a') {
    return ['group2', 'group2a'];
  }
  return [clean];
}

export function isSameExamFamily(examA?: string, examB?: string): boolean {
  const a = normalizeExamId(examA);
  const b = normalizeExamId(examB);
  if (a === b) return true;
  if ((a === 'group2' || a === 'group2a') && (b === 'group2' || b === 'group2a')) {
    return true;
  }
  return false;
}

export function normalizeSubjectSlug(subjectId?: string, examId?: string): string {
  if (!subjectId) return 'general-studies';
  let norm = subjectId.toLowerCase().trim();
  if (norm === 'all') return 'all';
  if (examId) {
    const cleanExam = normalizeExamId(examId);
    if (norm.startsWith(`${cleanExam}-`)) {
      norm = norm.slice(`${cleanExam}-`.length);
    }
  }
  for (const prefix of ['group1-', 'group2a-', 'group2-', 'group4-']) {
    if (norm.startsWith(prefix)) {
      norm = norm.slice(prefix.length);
    }
  }
  return norm;
}

export class StudyManagementService {
  /**
   * Initializes the dynamic Study Materials database schema and seeds default canonical units & lessons.
   */
  static async initSchema(): Promise<void> {
    try {
      // 1. Create tables and standard-scoped constraints
      await pool.query(`
        CREATE TABLE IF NOT EXISTS syllabus_exams (
          id VARCHAR(50) PRIMARY KEY,
          name TEXT NOT NULL,
          code TEXT,
          badge TEXT,
          description TEXT,
          display_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS syllabus_subjects (
          id VARCHAR(100) PRIMARY KEY,
          exam_id VARCHAR(50) REFERENCES syllabus_exams(id) ON DELETE CASCADE,
          subject_slug VARCHAR(80) NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          icon_name VARCHAR(50),
          display_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE OR REPLACE VIEW subjects AS
        SELECT 
          id,
          exam_id,
          subject_slug,
          name,
          description,
          icon_name,
          display_order,
          is_active,
          created_at,
          updated_at
        FROM syllabus_subjects;

        CREATE TABLE IF NOT EXISTS syllabus_units (
          id SERIAL PRIMARY KEY,
          exam_id VARCHAR(50) NOT NULL,
          subject_id VARCHAR(100) NOT NULL,
          standard_number INT,
          excluded_standards INT[] DEFAULT '{}'::int[],
          unit_number INT NOT NULL,
          unit_code VARCHAR(50) NOT NULL,
          title TEXT NOT NULL,
          subject_name TEXT,
          description TEXT,
          question_count INT DEFAULT 0,
          display_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE syllabus_units ADD COLUMN IF NOT EXISTS excluded_standards INT[] DEFAULT '{}'::int[];

        CREATE TABLE IF NOT EXISTS syllabus_lessons (
          id VARCHAR(120) PRIMARY KEY,
          unit_id INT REFERENCES syllabus_units(id) ON DELETE CASCADE,
          exam_id VARCHAR(50) NOT NULL,
          subject_id VARCHAR(100) NOT NULL,
          standard_number INT NOT NULL,
          lesson_number VARCHAR(50) NOT NULL,
          title TEXT NOT NULL,
          term VARCHAR(50) DEFAULT 'Term 1',
          description TEXT,
          status VARCHAR(50) DEFAULT 'Available',
          display_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS syllabus_topics (
          id SERIAL PRIMARY KEY,
          lesson_id VARCHAR(120) REFERENCES syllabus_lessons(id) ON DELETE CASCADE,
          unit_id INT REFERENCES syllabus_units(id) ON DELETE CASCADE,
          topic_name TEXT NOT NULL,
          description TEXT,
          display_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_syllabus_subjects_exam ON syllabus_subjects (exam_id);
        DROP INDEX IF EXISTS uq_syllabus_units_exam_subject_unit;
        CREATE UNIQUE INDEX IF NOT EXISTS uq_syllabus_units_exam_subject_std_unit
          ON syllabus_units (exam_id, subject_id, COALESCE(standard_number, 0), unit_number)
          WHERE is_active = true;
        CREATE INDEX IF NOT EXISTS idx_syllabus_units_lookup ON syllabus_units (exam_id, subject_id, unit_number);
        CREATE INDEX IF NOT EXISTS idx_syllabus_lessons_lookup ON syllabus_lessons (unit_id, exam_id, subject_id, standard_number);
        CREATE INDEX IF NOT EXISTS idx_syllabus_topics_lookup ON syllabus_topics (lesson_id, unit_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_syllabus_topics_lesson_name ON syllabus_topics (lesson_id, topic_name);

        -- Optional provenance columns for textbook PDF page tracking & full syllabus traceability
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS textbook_id INT;
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS source_page_start INT;
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS source_page_end INT;
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS textbook_title TEXT;
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS textbook_unit_number VARCHAR(50);
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS textbook_unit_title TEXT;
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS matched_topics JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS syllabus_reference TEXT;
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS textbook_page_reference TEXT;
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS mapping_status VARCHAR(50) DEFAULT 'FULLY MAPPED';
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'VERIFIED';
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS import_batch_id VARCHAR(100);
        ALTER TABLE syllabus_topics ADD COLUMN IF NOT EXISTS source_page_reference TEXT;
        ALTER TABLE syllabus_topics ADD COLUMN IF NOT EXISTS syllabus_reference TEXT;
      `);

      // Remove any stray 'all' subject rows
      await pool.query(`DELETE FROM syllabus_subjects WHERE subject_slug = 'all' OR id LIKE '%-all'`);

      // 2. Ensure all 4 canonical TNPSC Groups and their subjects are seeded and isolated
      const checkGroup2aUnits = await pool.query("SELECT COUNT(*)::int AS count FROM syllabus_units WHERE exam_id = 'group2a'");
      const checkGroup4TamilUnits = await pool.query(
        "SELECT COUNT(*)::int AS count FROM syllabus_units WHERE exam_id = 'group4' AND (subject_id = 'general-tamil' OR subject_id = 'group4-general-tamil')"
      );
      const checkGeneralStudiesUnits = await pool.query(
        "SELECT COUNT(*)::int AS count FROM syllabus_units WHERE subject_id IN ('general-studies', 'group1-general-studies', 'group2-general-studies', 'group2a-general-studies', 'group4-general-studies')"
      );
      const checkLessons = await pool.query('SELECT COUNT(*)::int AS count FROM syllabus_lessons');

      if (
        checkGroup2aUnits.rows[0].count === 0 ||
        checkGroup4TamilUnits.rows[0].count === 0 ||
        checkGeneralStudiesUnits.rows[0].count === 0 ||
        checkLessons.rows[0].count < 1800
      ) {
        console.log('[StudyManagement] Syncing complete canonical syllabus & focus areas across Group 1, Group 2, Group 2A, and Group 4...');
        await seedCompleteSyllabusData();
      }

      // 3. Ensure natural numeric ordering across all lessons and topics
      await this.normalizeLessonOrdering();
    } catch (err) {
      console.error('[StudyManagement] Schema initialization error:', err);
      throw err;
    }
  }

  /**
   * Normalizes display_order across all lessons and topics using natural numeric sorting.
   * Guarantees 1..N sequential ordering for every (unit_id, standard_number) group.
   */
  static async normalizeLessonOrdering(): Promise<{ lessonsUpdated: number; topicsUpdated: number }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const pairsRes = await client.query(`
        SELECT DISTINCT unit_id, standard_number 
        FROM syllabus_lessons 
        WHERE unit_id IS NOT NULL 
        ORDER BY unit_id, standard_number
      `);

      let lessonsUpdated = 0;
      for (const pair of pairsRes.rows) {
        const { unit_id, standard_number } = pair;
        const lessonsRes = await client.query(
          `SELECT id, standard_number, lesson_number, display_order, title 
           FROM syllabus_lessons 
           WHERE unit_id = $1 AND standard_number = $2`,
          [unit_id, standard_number]
        );

        const lessons = lessonsRes.rows;
        lessons.sort(compareLessons);

        for (let idx = 0; idx < lessons.length; idx++) {
          const lesson = lessons[idx];
          const newOrder = idx + 1;
          if (lesson.display_order !== newOrder) {
            await client.query(
              `UPDATE syllabus_lessons 
               SET display_order = $1, updated_at = CURRENT_TIMESTAMP 
               WHERE id = $2`,
              [newOrder, lesson.id]
            );
            lessonsUpdated++;
          }
        }
      }

      const lessonIdsRes = await client.query(`
        SELECT DISTINCT lesson_id FROM syllabus_topics WHERE lesson_id IS NOT NULL
      `);
      let topicsUpdated = 0;
      for (const row of lessonIdsRes.rows) {
        const topicsRes = await client.query(
          `SELECT id, display_order, topic_name FROM syllabus_topics WHERE lesson_id = $1`,
          [row.lesson_id]
        );
        const topics = topicsRes.rows;
        topics.sort(compareTopics);
        for (let idx = 0; idx < topics.length; idx++) {
          const topic = topics[idx];
          const newOrder = idx + 1;
          if (topic.display_order !== newOrder) {
            await client.query(`UPDATE syllabus_topics SET display_order = $1 WHERE id = $2`, [
              newOrder,
              topic.id,
            ]);
            topicsUpdated++;
          }
        }
      }

      await client.query('COMMIT');
      if (lessonsUpdated > 0 || topicsUpdated > 0) {
        console.log(
          `[StudyManagement] Normalized ${lessonsUpdated} lessons and ${topicsUpdated} topics to natural numeric ordering.`
        );
      }
      return { lessonsUpdated, topicsUpdated };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[StudyManagementService] normalizeLessonOrdering error:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  // =========================================================================
  // EXAMS (GROUPS) CRUD
  // =========================================================================
  static async getExams(): Promise<ExamRecord[]> {
    const res = await pool.query(
      `SELECT id, name, code, badge, description, display_order, is_active 
       FROM syllabus_exams 
       WHERE is_active = true AND id IN ('group1', 'group2', 'group4') 
       ORDER BY display_order ASC, id ASC`
    );
    const canonicalMap: Record<string, { name: string; order: number }> = {
      group1: { name: 'TNPSC Group 1', order: 1 },
      group2: { name: 'TNPSC Group 2 & 2A', order: 2 },
      group4: { name: 'TNPSC Group 4', order: 3 },
    };
    const byId = new Map<string, ExamRecord>();
    for (const row of res.rows) {
      if (canonicalMap[row.id]) {
        byId.set(row.id, {
          ...row,
          name: canonicalMap[row.id].name,
          display_order: canonicalMap[row.id].order,
        });
      }
    }
    for (const [id, meta] of Object.entries(canonicalMap)) {
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          name: meta.name,
          display_order: meta.order,
          is_active: true,
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.display_order - b.display_order);
  }

  static async createExam(data: {
    id: string;
    name: string;
    code?: string;
    badge?: string;
    description?: string;
    display_order?: number;
  }): Promise<ExamRecord> {
    const res = await pool.query(
      `INSERT INTO syllabus_exams (id, name, code, badge, description, display_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.id.toLowerCase().trim(),
        data.name.trim(),
        data.code?.trim() || null,
        data.badge?.trim() || null,
        data.description?.trim() || null,
        data.display_order ?? 0,
      ]
    );
    return res.rows[0];
  }

  static async updateExam(
    id: string,
    data: { name?: string; code?: string; badge?: string; description?: string; display_order?: number }
  ): Promise<ExamRecord> {
    const res = await pool.query(
      `UPDATE syllabus_exams
       SET name = COALESCE($2, name),
           code = COALESCE($3, code),
           badge = COALESCE($4, badge),
           description = COALESCE($5, description),
           display_order = COALESCE($6, display_order),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, data.name, data.code, data.badge, data.description, data.display_order]
    );
    return res.rows[0];
  }

  /**
   * Scoped Group Delete: Deletes ONLY the specified TNPSC Group and its child records in a transaction.
   */
  static async deleteExam(id: string): Promise<boolean> {
    const cleanId = id.toLowerCase().trim();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const check = await client.query('SELECT id FROM syllabus_exams WHERE id = $1 FOR UPDATE', [cleanId]);
      if (check.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query(
        `DELETE FROM study_notes
          WHERE lesson_id IN (SELECT id FROM syllabus_lessons WHERE exam_id = $1)
             OR topic_id IN (
                  SELECT t.id::text FROM syllabus_topics t
                    JOIN syllabus_units u ON t.unit_id = u.id
                   WHERE u.exam_id = $1
                )`,
        [cleanId]
      );
      await client.query(
        `DELETE FROM syllabus_topics
          WHERE unit_id IN (SELECT id FROM syllabus_units WHERE exam_id = $1)
             OR lesson_id IN (SELECT id FROM syllabus_lessons WHERE exam_id = $1)`,
        [cleanId]
      );
      await client.query('DELETE FROM syllabus_lessons WHERE exam_id = $1', [cleanId]);
      await client.query('DELETE FROM syllabus_units WHERE exam_id = $1', [cleanId]);
      await client.query('DELETE FROM syllabus_subjects WHERE exam_id = $1', [cleanId]);
      const res = await client.query('DELETE FROM syllabus_exams WHERE id = $1', [cleanId]);
      await client.query('COMMIT');
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // =========================================================================
  // SUBJECTS CRUD
  // =========================================================================
  static async getSubjects(examId?: string): Promise<SubjectRecord[]> {
    if (examId) {
      const cleanExam = normalizeExamId(examId);
      const examFamily = getExamFamilyIds(examId);
      const res = await pool.query(
        `SELECT * FROM syllabus_subjects
          WHERE exam_id = ANY($1::text[])
            AND subject_slug != 'all'
            AND is_active = true
          ORDER BY CASE WHEN exam_id = $2 THEN 0 ELSE 1 END ASC, display_order ASC, name ASC`,
        [examFamily, cleanExam]
      );
      const bySlug = new Map<string, SubjectRecord>();
      for (const row of res.rows) {
        if (!bySlug.has(row.subject_slug)) {
          bySlug.set(row.subject_slug, row);
        }
      }
      return Array.from(bySlug.values());
    }
    const res = await pool.query(
      `SELECT * FROM syllabus_subjects
        WHERE subject_slug != 'all'
          AND is_active = true
        ORDER BY display_order ASC, name ASC`
    );
    return res.rows;
  }

  static async createSubject(data: {
    exam_id: string;
    subject_slug: string;
    name: string;
    description?: string;
    display_order?: number;
  }): Promise<SubjectRecord> {
    const cleanExam = normalizeExamId(data.exam_id);
    const cleanSlug = normalizeSubjectSlug(data.subject_slug, cleanExam);
    const id = `${cleanExam}-${cleanSlug}`;
    const res = await pool.query(
      `INSERT INTO syllabus_subjects (id, exam_id, subject_slug, name, description, display_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [id, cleanExam, cleanSlug, data.name.trim(), data.description?.trim() || null, data.display_order ?? 0]
    );
    return res.rows[0];
  }

  static async updateSubject(
    id: string,
    data: { name?: string; description?: string; display_order?: number }
  ): Promise<SubjectRecord> {
    const res = await pool.query(
      `UPDATE syllabus_subjects
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           display_order = COALESCE($4, display_order),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, data.name, data.description, data.display_order]
    );
    return res.rows[0];
  }

  /**
   * Scoped Subject Delete: Deletes ONLY the specified Subject (within its Group) and its child records.
   */
  static async deleteSubject(id: string, scope?: { examId?: string }): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const subRes = await client.query('SELECT * FROM syllabus_subjects WHERE id = $1 FOR UPDATE', [id]);
      if (subRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      const subRow = subRes.rows[0];
      if (scope?.examId && !isSameExamFamily(subRow.exam_id, scope.examId)) {
        await client.query('ROLLBACK');
        throw new Error(`Ownership validation failed: Subject "${id}" does not belong to Group "${scope.examId}".`);
      }

      const targetExam = subRow.exam_id;
      const targetSlug = subRow.subject_slug;
      const prefixedSlug = `${targetExam}-${targetSlug}`;

      await client.query(
        `DELETE FROM study_notes
          WHERE lesson_id IN (
            SELECT id FROM syllabus_lessons
             WHERE exam_id = $1 AND (subject_id = $2 OR subject_id = $3)
          )
             OR topic_id IN (
            SELECT t.id::text FROM syllabus_topics t
              JOIN syllabus_units u ON t.unit_id = u.id
             WHERE u.exam_id = $1 AND (u.subject_id = $2 OR u.subject_id = $3)
          )`,
        [targetExam, targetSlug, prefixedSlug]
      );
      await client.query(
        `DELETE FROM syllabus_topics
          WHERE unit_id IN (
            SELECT id FROM syllabus_units
             WHERE exam_id = $1 AND (subject_id = $2 OR subject_id = $3)
          )
             OR lesson_id IN (
            SELECT id FROM syllabus_lessons
             WHERE exam_id = $1 AND (subject_id = $2 OR subject_id = $3)
          )`,
        [targetExam, targetSlug, prefixedSlug]
      );
      await client.query(
        'DELETE FROM syllabus_lessons WHERE exam_id = $1 AND (subject_id = $2 OR subject_id = $3)',
        [targetExam, targetSlug, prefixedSlug]
      );
      await client.query(
        'DELETE FROM syllabus_units WHERE exam_id = $1 AND (subject_id = $2 OR subject_id = $3)',
        [targetExam, targetSlug, prefixedSlug]
      );
      const res = await client.query('DELETE FROM syllabus_subjects WHERE id = $1', [id]);
      await client.query('COMMIT');
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Scoped Standard Delete: Deletes ONLY the specified Standard's content for the selected Group & Subject.
   */
  static async deleteStandardContent(params: {
    examId: string;
    subjectId?: string;
    standardNumber: number;
  }): Promise<{
    success: boolean;
    deleted: { units: number; lessons: number; topics: number; notes: number };
  }> {
    const cleanExam = normalizeExamId(params.examId);
    const normSub = params.subjectId ? normalizeSubjectSlug(params.subjectId, cleanExam) : 'all';
    const prefixedSub = normSub !== 'all' ? `${cleanExam}-${normSub}` : 'all';
    const stdNum = Number(params.standardNumber);

    if (!Number.isInteger(stdNum) || stdNum < 6 || stdNum > 12) {
      throw new Error(`Invalid standard number: ${params.standardNumber}`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const lessonsToDel = await client.query(
        `SELECT id FROM syllabus_lessons
          WHERE exam_id = $1
            AND ($2 = 'all' OR subject_id = $2 OR subject_id = $3)
            AND standard_number = $4`,
        [cleanExam, normSub, prefixedSub, stdNum]
      );
      const lessonIds = lessonsToDel.rows.map((r) => r.id);

      let notesDeleted = 0;
      let topicsDeleted = 0;
      let lessonsDeleted = 0;

      if (lessonIds.length > 0) {
        const nRes = await client.query(
          `DELETE FROM study_notes
            WHERE lesson_id = ANY($1::text[])
               OR topic_id IN (SELECT id::text FROM syllabus_topics WHERE lesson_id = ANY($1::text[]))`,
          [lessonIds]
        );
        notesDeleted = nRes.rowCount ?? 0;

        const tRes = await client.query(
          `DELETE FROM syllabus_topics WHERE lesson_id = ANY($1::text[])`,
          [lessonIds]
        );
        topicsDeleted = tRes.rowCount ?? 0;

        const lRes = await client.query(
          `DELETE FROM syllabus_lessons WHERE id = ANY($1::text[])`,
          [lessonIds]
        );
        lessonsDeleted = lRes.rowCount ?? 0;
      }

      // Delete standard-specific units for this standard
      const stdUnitsRes = await client.query(
        `DELETE FROM syllabus_units
          WHERE exam_id = $1
            AND ($2 = 'all' OR subject_id = $2 OR subject_id = $3)
            AND standard_number = $4`,
        [cleanExam, normSub, prefixedSub, stdNum]
      );
      const unitsDeleted = stdUnitsRes.rowCount ?? 0;

      // Mark standard as excluded on shared units for this exam & subject
      await client.query(
        `UPDATE syllabus_units
            SET excluded_standards = array_append(array_remove(COALESCE(excluded_standards, '{}'::int[]), $4::int), $4::int),
                updated_at = CURRENT_TIMESTAMP
          WHERE exam_id = $1
            AND ($2 = 'all' OR subject_id = $2 OR subject_id = $3)
            AND standard_number IS NULL`,
        [cleanExam, normSub, prefixedSub, stdNum]
      );

      await client.query('COMMIT');
      return {
        success: true,
        deleted: {
          units: unitsDeleted,
          lessons: lessonsDeleted,
          topics: topicsDeleted,
          notes: notesDeleted,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // =========================================================================
  // UNITS CRUD (Strictly Isolated by Group, Subject, and Standard; Combines Group 2 & 2A Without Duplicates)
  // =========================================================================
  static async getUnits(
    examId: string,
    subjectId: string,
    standardNumber?: number
  ): Promise<UnitRecord[]> {
    const cleanExam = normalizeExamId(examId);
    const examFamily = getExamFamilyIds(examId);
    const normSub = normalizeSubjectSlug(subjectId || 'all', cleanExam);
    const subjectCandidates = normSub === 'all' ? ['all'] : [normSub, ...examFamily.map((g) => `${g}-${normSub}`)];

    const query = `
      SELECT u.*,
             (SELECT COUNT(*)::int
                FROM syllabus_lessons l
               WHERE l.unit_id = u.id
                 AND l.is_active = true
                 AND ($3::int IS NULL OR l.standard_number = $3)) as lessons_count
      FROM syllabus_units u
      WHERE u.exam_id = ANY($1::text[])
        AND ($2 = 'all' OR u.subject_id = ANY($4::text[]))
        AND ($3::int IS NULL OR (
          (u.standard_number IS NULL OR u.standard_number = $3)
          AND NOT ($3 = ANY(COALESCE(u.excluded_standards, '{}'::int[])))
        ))
        AND u.is_active = true
      ORDER BY CASE WHEN u.exam_id = $5 THEN 0 ELSE 1 END ASC, u.subject_id ASC, u.unit_number ASC, u.display_order ASC, u.id ASC
    `;
    const res = await pool.query(query, [
      examFamily,
      normSub,
      standardNumber || null,
      subjectCandidates,
      cleanExam,
    ]);

    // Deduplicate by (normalized subject_id, unit_number) when viewing a specific standard or all standards
    const byKey = new Map<string, UnitRecord>();
    for (const row of res.rows) {
      const rowSub = normalizeSubjectSlug(String(row.subject_id || ''), row.exam_id);
      const key = standardNumber
        ? `${rowSub}::${row.unit_number}`
        : `${rowSub}::${row.unit_number}::${row.standard_number || 0}`;
      const existing = byKey.get(key);
      if (
        !existing ||
        (standardNumber && row.standard_number === standardNumber && existing.standard_number !== standardNumber) ||
        (row.exam_id === cleanExam && existing.exam_id !== cleanExam && (row.lessons_count || 0) >= (existing.lessons_count || 0)) ||
        (row.lessons_count || 0) > (existing.lessons_count || 0)
      ) {
        byKey.set(key, row);
      }
    }
    return Array.from(byKey.values()).sort((a, b) => a.unit_number - b.unit_number);
  }

  static async createUnit(data: {
    exam_id: string;
    subject_id: string;
    standard_number?: number | null;
    unit_number: number;
    unit_code?: string;
    title: string;
    subject_name?: string;
    description?: string;
    question_count?: number;
    display_order?: number;
  }): Promise<UnitRecord> {
    const code = data.unit_code?.trim() || `Unit ${data.unit_number}`;
    const cleanExam = normalizeExamId(data.exam_id);
    const normSub = normalizeSubjectSlug(data.subject_id, cleanExam);
    const prefixedSub = `${cleanExam}-${normSub}`;
    const stdNum = data.standard_number != null && !isNaN(Number(data.standard_number))
      ? Number(data.standard_number)
      : null;

    // If creating for a specific standard, also un-exclude that standard on any shared parent unit in the same exam family
    const examFamily = getExamFamilyIds(cleanExam);
    const subjectCandidates = new Set<string>([normSub]);
    for (const ex of examFamily) {
      subjectCandidates.add(`${ex}-${normSub}`);
    }
    if (stdNum !== null) {
      await pool.query(
        `UPDATE syllabus_units
            SET excluded_standards = array_remove(COALESCE(excluded_standards, '{}'::int[]), $3::int),
                updated_at = CURRENT_TIMESTAMP
          WHERE exam_id = ANY($1::text[])
            AND subject_id = ANY($2::text[])
            AND unit_number = $4
            AND standard_number IS NULL`,
        [examFamily, Array.from(subjectCandidates), stdNum, data.unit_number]
      );
    }

    // Check if unit already exists for this exact (exam_id, subject_id, COALESCE(standard_number, 0), unit_number)
    const existing = await pool.query(
      `SELECT * FROM syllabus_units 
       WHERE exam_id = $1
         AND (subject_id = $2 OR subject_id = $3)
         AND COALESCE(standard_number, 0) = COALESCE($4::int, 0)
         AND unit_number = $5
         AND is_active = true
       ORDER BY id ASC`,
      [cleanExam, normSub, prefixedSub, stdNum, data.unit_number]
    );
    if (existing.rows.length > 0) {
      const upd = await pool.query(
        `UPDATE syllabus_units
         SET title = $1, unit_code = $2, subject_name = $3, description = COALESCE($4, description),
             question_count = COALESCE($5, question_count), display_order = COALESCE($6, display_order),
             excluded_standards = CASE WHEN $8::int IS NOT NULL THEN array_remove(COALESCE(excluded_standards, '{}'::int[]), $8::int) ELSE excluded_standards END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING *`,
        [
          data.title.trim(),
          code,
          data.subject_name?.trim() || data.title.trim(),
          data.description?.trim() || null,
          data.question_count,
          data.display_order ?? data.unit_number,
          existing.rows[0].id,
          stdNum,
        ]
      );
      return upd.rows[0];
    }

    const res = await pool.query(
      `INSERT INTO syllabus_units (
        exam_id, subject_id, standard_number, unit_number, unit_code, title,
        subject_name, description, question_count, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (exam_id, subject_id, COALESCE(standard_number, 0), unit_number) WHERE is_active = true
      DO UPDATE SET
        title = EXCLUDED.title,
        unit_code = EXCLUDED.unit_code,
        subject_name = EXCLUDED.subject_name,
        description = COALESCE(EXCLUDED.description, syllabus_units.description),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        cleanExam,
        normSub,
        stdNum,
        data.unit_number,
        code,
        data.title.trim(),
        data.subject_name?.trim() || data.title.trim(),
        data.description?.trim() || null,
        data.question_count ?? 10,
        data.display_order ?? data.unit_number,
      ]
    );
    return res.rows[0];
  }

  static async updateUnit(
    id: number,
    data: {
      unit_number?: number;
      unit_code?: string;
      title?: string;
      subject_name?: string;
      description?: string;
      question_count?: number;
      display_order?: number;
    }
  ): Promise<UnitRecord> {
    const cleanTitle = data.title?.trim();
    const cleanSubName = data.subject_name?.trim() || cleanTitle;
    const res = await pool.query(
      `UPDATE syllabus_units
       SET unit_number = COALESCE($2, unit_number),
           unit_code = COALESCE($3, unit_code),
           title = COALESCE($4, title),
           subject_name = COALESCE($5, subject_name),
           description = COALESCE($6, description),
           question_count = COALESCE($7, question_count),
           display_order = COALESCE($8, display_order),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.unit_number,
        data.unit_code?.trim(),
        cleanTitle,
        cleanSubName,
        data.description,
        data.question_count,
        data.display_order,
      ]
    );
    return res.rows[0];
  }

  /**
   * Counts records that depend on a syllabus unit, strictly scoped to the specified standard (when provided)
   * and validates ownership against examId, subjectId, and standardNumber.
   */
  static async getUnitDependencies(
    id: number,
    optionsOrDb?:
      | { examId?: string; subjectId?: string; standardNumber?: number | null }
      | { query: (text: string, values?: any[]) => Promise<any> },
    maybeDb?: { query: (text: string, values?: any[]) => Promise<any> }
  ): Promise<{
    exists: boolean;
    invalidOwnership?: boolean;
    ownershipError?: string;
    unit?: UnitRecord;
    scopeStandard?: number | null;
    lessons: number;
    topics: number;
    notes: number;
    questions: number;
  }> {
    let options: { examId?: string; subjectId?: string; standardNumber?: number | null } = {};
    let db: { query: (text: string, values?: any[]) => Promise<any> } = pool;

    if (optionsOrDb && typeof (optionsOrDb as any).query === 'function') {
      db = optionsOrDb as any;
    } else if (optionsOrDb) {
      options = optionsOrDb as any;
      if (maybeDb) db = maybeDb;
    }

    const unitRes = await db.query('SELECT * FROM syllabus_units WHERE id = $1', [id]);
    if (unitRes.rowCount === 0) {
      return { exists: false, lessons: 0, topics: 0, notes: 0, questions: 0 };
    }
    const unit: UnitRecord = unitRes.rows[0];

    // Ownership checks
    if (options.examId) {
      const expectedExam = normalizeExamId(options.examId);
      const actualExam = normalizeExamId(unit.exam_id);
      if (!isSameExamFamily(expectedExam, actualExam)) {
        return {
          exists: true,
          invalidOwnership: true,
          ownershipError: `Ownership mismatch: Unit #${id} belongs to Group "${actualExam}", not "${expectedExam}".`,
          unit,
          lessons: 0,
          topics: 0,
          notes: 0,
          questions: 0,
        };
      }
    }

    if (options.subjectId && options.subjectId !== 'all') {
      const expectedSub = normalizeSubjectSlug(options.subjectId, unit.exam_id);
      const actualSub = normalizeSubjectSlug(unit.subject_id, unit.exam_id);
      if (expectedSub !== actualSub) {
        return {
          exists: true,
          invalidOwnership: true,
          ownershipError: `Ownership mismatch: Unit #${id} belongs to Subject "${actualSub}", not "${expectedSub}".`,
          unit,
          lessons: 0,
          topics: 0,
          notes: 0,
          questions: 0,
        };
      }
    }

    if (
      options.standardNumber != null &&
      unit.standard_number != null &&
      Number(options.standardNumber) !== Number(unit.standard_number)
    ) {
      return {
        exists: true,
        invalidOwnership: true,
        ownershipError: `Ownership mismatch: Unit #${id} belongs to ${unit.standard_number}th Standard, not ${options.standardNumber}th Standard.`,
        unit,
        lessons: 0,
        topics: 0,
        notes: 0,
        questions: 0,
      };
    }

    const effectiveStandard: number | null =
      options.standardNumber != null && !isNaN(Number(options.standardNumber))
        ? Number(options.standardNumber)
        : unit.standard_number != null
        ? Number(unit.standard_number)
        : null;

    const res = await db.query(
      `WITH ul AS (
         SELECT id FROM syllabus_lessons
          WHERE unit_id = $1
            AND ($2::int IS NULL OR standard_number = $2)
       ),
       ut AS (
         SELECT id FROM syllabus_topics
          WHERE lesson_id IN (SELECT id FROM ul)
             OR ($2::int IS NULL AND unit_id = $1)
       )
       SELECT
         (SELECT COUNT(*)::int FROM ul) AS lessons,
         (SELECT COUNT(*)::int FROM ut) AS topics,
         (SELECT COUNT(*)::int FROM study_notes
            WHERE lesson_id IN (SELECT id FROM ul) OR topic_id IN (SELECT id::text FROM ut)) AS notes,
         (SELECT COUNT(*)::int FROM questions WHERE lesson_id IN (SELECT id FROM ul)) AS questions`,
      [id, effectiveStandard]
    );
    const r = res.rows[0];
    return {
      exists: true,
      unit,
      scopeStandard: effectiveStandard,
      lessons: r.lessons,
      topics: r.topics,
      notes: r.notes,
      questions: r.questions,
    };
  }

  /**
   * Safe Scoped Unit Delete:
   * - Validates unique database ID and full ownership (examId, subjectId, standardNumber).
   * - If deleting a Unit under a specific Standard (e.g. 6th Standard -> Unit 1), deletes ONLY
   *   that Standard's Unit/Lessons/Topics/Notes and NEVER touches 7th-12th Standards.
   * - Wrapped in an atomic SQL transaction with automatic rollback on failure.
   */
  static async deleteUnit(
    id: number,
    force: boolean = false,
    scope?: { examId?: string; subjectId?: string; standardNumber?: number | null }
  ): Promise<{
    success: boolean;
    notFound?: boolean;
    invalidOwnership?: boolean;
    message?: string;
    scope?: { examId: string; subjectId: string; standardNumber: number | null; unitNumber: number; unitTitle: string };
    dependencies?: { lessons: number; topics: number; notes: number; questions: number };
    deleted?: { units: number; lessons: number; topics: number; notes: number };
  }> {
    if (!Number.isInteger(id) || id <= 0) {
      return { success: false, message: 'Invalid unit ID.' };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Lock the unit row so concurrent edits cannot attach new children mid-delete.
      const lock = await client.query('SELECT * FROM syllabus_units WHERE id = $1 FOR UPDATE', [id]);
      if (lock.rowCount === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          notFound: true,
          message: `Unit #${id} was not found. It may have already been deleted.`,
        };
      }

      const depsResult = await this.getUnitDependencies(id, scope, client);
      if (depsResult.invalidOwnership) {
        await client.query('ROLLBACK');
        return {
          success: false,
          invalidOwnership: true,
          message: depsResult.ownershipError || 'Ownership validation failed for unit deletion.',
        };
      }

      const unit = depsResult.unit!;
      const targetStandard = depsResult.scopeStandard ?? null;
      const deps = {
        lessons: depsResult.lessons,
        topics: depsResult.topics,
        notes: depsResult.notes,
        questions: depsResult.questions,
      };

      const scopeMeta = {
        examId: unit.exam_id,
        subjectId: normalizeSubjectSlug(unit.subject_id, unit.exam_id),
        standardNumber: targetStandard,
        unitNumber: unit.unit_number,
        unitTitle: unit.title,
      };

      if (!force && (deps.lessons > 0 || deps.topics > 0 || deps.notes > 0)) {
        await client.query('ROLLBACK');
        const stdLabel = targetStandard ? `${targetStandard}th Standard ` : '';
        return {
          success: false,
          scope: scopeMeta,
          message: `${stdLabel}${unit.unit_code} (${unit.title}) contains ${deps.lessons} lesson(s), ${deps.topics} focus area(s) and ${deps.notes} study note(s). Confirm to delete only this ${stdLabel ? 'standard-scoped ' : ''}unit and its associated records.`,
          dependencies: deps,
        };
      }

      // Case 1: Standard-scoped delete on a shared parent unit (unit.standard_number IS NULL, targetStandard != null)
      // Deletes ONLY targetStandard's lessons, topics, and study notes, and records targetStandard in excluded_standards.
      // Lessons and units in all other standards (e.g. 7th to 12th) remain 100% untouched.
      if (targetStandard !== null && unit.standard_number == null) {
        const examFamily = getExamFamilyIds(unit.exam_id);
        const normSub = normalizeSubjectSlug(unit.subject_id, unit.exam_id);
        const subVariants = [normSub, ...examFamily.map((ex) => `${ex}-${normSub}`)];
        const siblingUnitsRes = await client.query(
          `SELECT id FROM syllabus_units
            WHERE exam_id = ANY($1::text[])
              AND subject_id = ANY($2::text[])
              AND unit_number = $3
              AND standard_number IS NULL`,
          [examFamily, subVariants, unit.unit_number]
        );
        const targetUnitIds = Array.from(new Set([id, ...siblingUnitsRes.rows.map((r: any) => Number(r.id))]));

        const notesRes = await client.query(
          `DELETE FROM study_notes
            WHERE lesson_id IN (
              SELECT id FROM syllabus_lessons WHERE unit_id = ANY($1::int[]) AND standard_number = $2
            )
               OR topic_id IN (
              SELECT t.id::text FROM syllabus_topics t
                JOIN syllabus_lessons l ON t.lesson_id = l.id
               WHERE l.unit_id = ANY($1::int[]) AND l.standard_number = $2
            )`,
          [targetUnitIds, targetStandard]
        );
        const topicsRes = await client.query(
          `DELETE FROM syllabus_topics
            WHERE lesson_id IN (
              SELECT id FROM syllabus_lessons WHERE unit_id = ANY($1::int[]) AND standard_number = $2
            )`,
          [targetUnitIds, targetStandard]
        );
        const lessonsRes = await client.query(
          `DELETE FROM syllabus_lessons WHERE unit_id = ANY($1::int[]) AND standard_number = $2`,
          [targetUnitIds, targetStandard]
        );

        await client.query(
          `UPDATE syllabus_units
              SET excluded_standards = array_append(array_remove(COALESCE(excluded_standards, '{}'::int[]), $2::int), $2::int),
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ANY($1::int[])`,
          [targetUnitIds, targetStandard]
        );

        await client.query('COMMIT');
        return {
          success: true,
          scope: scopeMeta,
          deleted: {
            units: 1,
            lessons: lessonsRes.rowCount ?? 0,
            topics: topicsRes.rowCount ?? 0,
            notes: notesRes.rowCount ?? 0,
          },
        };
      }

      // Case 2: Standard-specific unit row (unit.standard_number IS NOT NULL)
      // Deletes ONLY this specific unit row (WHERE id = $1 AND standard_number = $2) and its child records.
      if (unit.standard_number != null) {
        const stdNum = Number(unit.standard_number);
        const notesRes = await client.query(
          `DELETE FROM study_notes
            WHERE lesson_id IN (SELECT id FROM syllabus_lessons WHERE unit_id = $1 AND standard_number = $2)
               OR topic_id IN (
                    SELECT t.id::text FROM syllabus_topics t
                     WHERE t.unit_id = $1
                        OR t.lesson_id IN (SELECT id FROM syllabus_lessons WHERE unit_id = $1 AND standard_number = $2)
                  )`,
          [id, stdNum]
        );
        const topicsRes = await client.query(
          `DELETE FROM syllabus_topics
            WHERE unit_id = $1 OR lesson_id IN (SELECT id FROM syllabus_lessons WHERE unit_id = $1 AND standard_number = $2)`,
          [id, stdNum]
        );
        const lessonsRes = await client.query(
          'DELETE FROM syllabus_lessons WHERE unit_id = $1 AND standard_number = $2',
          [id, stdNum]
        );
        const unitDelRes = await client.query(
          'DELETE FROM syllabus_units WHERE id = $1 AND standard_number = $2',
          [id, stdNum]
        );
        await client.query('COMMIT');
        return {
          success: true,
          scope: scopeMeta,
          deleted: {
            units: unitDelRes.rowCount ?? 0,
            lessons: lessonsRes.rowCount ?? 0,
            topics: topicsRes.rowCount ?? 0,
            notes: notesRes.rowCount ?? 0,
          },
        };
      }

      // Case 3: Full unit delete when no specific standard is scoped (All Standards explicitly chosen)
      const notesRes = await client.query(
        `DELETE FROM study_notes
          WHERE lesson_id IN (SELECT id FROM syllabus_lessons WHERE unit_id = $1)
             OR topic_id IN (
                  SELECT t.id::text FROM syllabus_topics t
                   WHERE t.unit_id = $1
                      OR t.lesson_id IN (SELECT id FROM syllabus_lessons WHERE unit_id = $1))`,
        [id]
      );
      const topicsRes = await client.query(
        `DELETE FROM syllabus_topics
          WHERE unit_id = $1 OR lesson_id IN (SELECT id FROM syllabus_lessons WHERE unit_id = $1)`,
        [id]
      );
      const lessonsRes = await client.query('DELETE FROM syllabus_lessons WHERE unit_id = $1', [id]);
      const unitDelRes = await client.query('DELETE FROM syllabus_units WHERE id = $1', [id]);
      await client.query('COMMIT');

      return {
        success: true,
        scope: scopeMeta,
        deleted: {
          units: unitDelRes.rowCount ?? 0,
          lessons: lessonsRes.rowCount ?? 0,
          topics: topicsRes.rowCount ?? 0,
          notes: notesRes.rowCount ?? 0,
        },
      };
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // =========================================================================
  // LESSONS CRUD (Strictly Isolated by Group, Subject, Unit, and Standard; Combines Group 2 & 2A Without Duplicates)
  // =========================================================================
  static async getLessons(params: {
    unitId?: number;
    unitNumber?: number;
    examId?: string;
    subjectId?: string;
    standardNumber?: number;
  }): Promise<LessonRecord[]> {
    const cleanExam = params.examId ? normalizeExamId(params.examId) : undefined;
    const examFamily = params.examId ? getExamFamilyIds(params.examId) : null;
    const normSub = params.subjectId ? normalizeSubjectSlug(params.subjectId, cleanExam) : undefined;
    const subjectCandidates =
      normSub && normSub !== 'all'
        ? [normSub, ...(examFamily || ['group1', 'group2', 'group2a', 'group4']).map((g) => `${g}-${normSub}`)]
        : null;

    let targetUnitIds: number[] | null = null;
    const unitNumById = new Map<number, number>();

    if (params.unitNumber !== undefined && params.unitNumber !== null) {
      const unitLookup = await pool.query(
        `SELECT u.id, u.unit_number, u.exam_id FROM syllabus_units u
         WHERE ($1::text[] IS NULL OR u.exam_id = ANY($1::text[]))
           AND ($2::text[] IS NULL OR u.subject_id = ANY($2::text[]))
           AND u.unit_number = $3
           AND ($4::int IS NULL OR (
             (u.standard_number IS NULL OR u.standard_number = $4)
             AND NOT ($4 = ANY(COALESCE(u.excluded_standards, '{}'::int[])))
           ))
           AND u.is_active = true
         ORDER BY CASE WHEN u.exam_id = $5 THEN 0 ELSE 1 END ASC, u.id ASC`,
        [examFamily, subjectCandidates, params.unitNumber, params.standardNumber || null, cleanExam || 'group2']
      );
      targetUnitIds = unitLookup.rows.map((r) => {
        unitNumById.set(Number(r.id), Number(r.unit_number));
        return Number(r.id);
      });
      if (params.unitId && !targetUnitIds.includes(Number(params.unitId))) {
        const idCheck = await pool.query(
          `SELECT id, unit_number FROM syllabus_units
            WHERE id = $1
              AND unit_number = $2
              AND ($3::text[] IS NULL OR exam_id = ANY($3::text[]))
              AND ($4::int IS NULL OR (
                (standard_number IS NULL OR standard_number = $4)
                AND NOT ($4 = ANY(COALESCE(excluded_standards, '{}'::int[])))
              ))
              AND is_active = true`,
          [params.unitId, params.unitNumber, examFamily, params.standardNumber || null]
        );
        if (idCheck.rows.length > 0) {
          unitNumById.set(Number(params.unitId), Number(idCheck.rows[0].unit_number));
          targetUnitIds.push(Number(params.unitId));
        }
      }
      if (targetUnitIds.length === 0) {
        return [];
      }
    } else if (params.unitId !== undefined && params.unitId !== null) {
      const pkLookup = await pool.query(
        `SELECT u.id, u.unit_number, u.exam_id, u.subject_id FROM syllabus_units u
         WHERE u.id = $1
           AND ($2::text[] IS NULL OR u.exam_id = ANY($2::text[]))
           AND ($3::text[] IS NULL OR u.subject_id = ANY($3::text[]))
           AND ($4::int IS NULL OR (
             (u.standard_number IS NULL OR u.standard_number = $4)
             AND NOT ($4 = ANY(COALESCE(u.excluded_standards, '{}'::int[])))
           ))`,
        [params.unitId, examFamily, subjectCandidates, params.standardNumber || null]
      );
      if (pkLookup.rows.length > 0) {
        const primaryRow = pkLookup.rows[0];
        unitNumById.set(Number(primaryRow.id), Number(primaryRow.unit_number));
        targetUnitIds = [Number(params.unitId)];

        // When only a generic Group 2 & 2A selection is passed (not a specific unitId-only call), include sibling unit IDs ONLY if examId was explicitly requested as combined
        if (examFamily && examFamily.length > 1 && params.examId) {
          const rowSub = normalizeSubjectSlug(primaryRow.subject_id, primaryRow.exam_id);
          const subList = [rowSub, ...examFamily.map((g) => `${g}-${rowSub}`)];
          const sibLookup = await pool.query(
            `SELECT u.id, u.unit_number FROM syllabus_units u
             WHERE u.exam_id = ANY($1::text[])
               AND u.subject_id = ANY($2::text[])
               AND u.unit_number = $3
               AND ($4::int IS NULL OR (
                 (u.standard_number IS NULL OR u.standard_number = $4)
                 AND NOT ($4 = ANY(COALESCE(u.excluded_standards, '{}'::int[])))
               ))
               AND u.is_active = true`,
            [examFamily, subList, primaryRow.unit_number, params.standardNumber || null]
          );
          for (const sRow of sibLookup.rows) {
            const sId = Number(sRow.id);
            unitNumById.set(sId, Number(sRow.unit_number));
            if (!targetUnitIds.includes(sId)) {
              targetUnitIds.push(sId);
            }
          }
        }
      } else if (examFamily || subjectCandidates) {
        const numLookup = await pool.query(
          `SELECT u.id, u.unit_number FROM syllabus_units u
           WHERE ($1::text[] IS NULL OR u.exam_id = ANY($1::text[]))
             AND ($2::text[] IS NULL OR u.subject_id = ANY($2::text[]))
             AND u.unit_number = $3
             AND ($4::int IS NULL OR (
               (u.standard_number IS NULL OR u.standard_number = $4)
               AND NOT ($4 = ANY(COALESCE(u.excluded_standards, '{}'::int[])))
             ))
             AND u.is_active = true`,
          [examFamily, subjectCandidates, params.unitId, params.standardNumber || null]
        );
        targetUnitIds = numLookup.rows.map((r) => {
          unitNumById.set(Number(r.id), Number(r.unit_number));
          return Number(r.id);
        });
        if (targetUnitIds.length === 0) {
          return [];
        }
      } else {
        targetUnitIds = [Number(params.unitId)];
      }
    }

    const res = await pool.query(
      `WITH filtered_lessons AS (
         SELECT l.*
         FROM syllabus_lessons l
         WHERE (
           ($1::int[] IS NOT NULL AND l.unit_id = ANY($1::int[]))
           OR (
             $1::int[] IS NULL
             AND ($2::text[] IS NULL OR l.exam_id = ANY($2::text[]))
             AND ($3::text[] IS NULL OR l.subject_id = ANY($3::text[]))
           )
         )
           AND ($4::int IS NULL OR l.standard_number = $4)
           AND l.is_active = true
           AND COALESCE(l.status, 'Available') NOT IN ('Inactive', 'Draft')
       ),
       topic_counts AS (
         SELECT t.lesson_id, COUNT(*)::int AS topics_count
         FROM syllabus_topics t
         WHERE t.is_active = true
           AND t.lesson_id IN (SELECT id FROM filtered_lessons)
         GROUP BY t.lesson_id
       ),
       matched_lesson_notes AS (
         SELECT fl.id AS lesson_id
         FROM filtered_lessons fl
         JOIN study_notes sn ON sn.lesson_id = fl.id
         UNION
         SELECT fl.id AS lesson_id
         FROM filtered_lessons fl
         JOIN study_notes sn ON LOWER(sn.lesson_title) = LOWER(fl.title)
       )
       SELECT l.*,
              COALESCE(tc.topics_count, 0) as topics_count,
              (mln.lesson_id IS NOT NULL) as has_notes
       FROM filtered_lessons l
       LEFT JOIN topic_counts tc ON tc.lesson_id = l.id
       LEFT JOIN matched_lesson_notes mln ON mln.lesson_id = l.id
       ORDER BY 
         CASE WHEN l.exam_id = $5 THEN 0 ELSE 1 END ASC,
         l.standard_number ASC,
         CASE WHEN l.display_order > 0 THEN l.display_order ELSE 999999 END ASC,
         CASE 
           WHEN NULLIF(regexp_replace(regexp_replace(l.lesson_number, '^[^0-9]+', ''), '[^0-9.]', '', 'g'), '') IS NOT NULL 
           THEN string_to_array(trim(both '.' from regexp_replace(l.lesson_number, '[^0-9.]', '', 'g')), '.')::int[]
           ELSE ARRAY[999999]
         END ASC,
         l.lesson_number ASC`,
      [
        targetUnitIds,
        examFamily,
        subjectCandidates,
        params.standardNumber || null,
        cleanExam || 'group2',
      ]
    );

    // Deduplicate lessons within the same (unit_number or unit_id, standard_number) by normalized title,
    // preserving source exam_id ('group2' or 'group2a') on each lesson record
    const sorted = res.rows.sort(compareLessons);
    const deduped: LessonRecord[] = [];
    const seenKeys = new Set<string>();
    for (const row of sorted) {
      const normTitle = (row.title || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\u0B80-\u0BFF]+/g, '');
      const uKey = unitNumById.get(Number(row.unit_id)) ?? row.unit_id;
      const key = `${uKey}::${row.standard_number}::${normTitle || row.lesson_number}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        deduped.push(row);
      }
    }

    // Attach lesson-specific Focus Areas (syllabus_topics) to each returned lesson
    if (deduped.length > 0) {
      const lessonIds = deduped.map((l) => l.id);
      const topicsRes = await pool.query(
        `WITH filtered_topics AS (
           SELECT t.*
           FROM syllabus_topics t
           WHERE t.lesson_id = ANY($1::text[])
             AND t.is_active = true
         ),
         matched_notes AS (
           SELECT ft.id AS topic_pk, sn.id AS note_id
           FROM filtered_topics ft
           JOIN study_notes sn ON sn.topic_id = ft.id::text
           UNION
           SELECT ft.id AS topic_pk, sn.id AS note_id
           FROM filtered_topics ft
           JOIN study_notes sn ON LOWER(sn.topic) = LOWER(ft.topic_name)
         ),
         topic_note_stats AS (
           SELECT topic_pk,
                  COUNT(*)::int AS notes_count,
                  (ARRAY_AGG(note_id ORDER BY note_id ASC))[1] AS notes_id
           FROM matched_notes
           GROUP BY topic_pk
         )
         SELECT t.*,
                COALESCE(tns.notes_count, 0) as notes_count,
                tns.notes_id
         FROM filtered_topics t
         LEFT JOIN topic_note_stats tns ON tns.topic_pk = t.id
         ORDER BY t.display_order ASC, t.id ASC`,
        [lessonIds]
      );
      const topicsByLesson = new Map<string, TopicRecord[]>();
      for (const tRow of topicsRes.rows) {
        const list = topicsByLesson.get(tRow.lesson_id) || [];
        list.push({
          ...tRow,
          has_notes: (tRow.notes_count || 0) > 0,
        });
        topicsByLesson.set(tRow.lesson_id, list);
      }

      for (const lesson of deduped) {
        const lessonTopics = (topicsByLesson.get(lesson.id) || []).sort(compareTopics);
        lesson.topics = lessonTopics;
        lesson.topics_count = lessonTopics.length;
        lesson.matched_topics = normalizeMatchedTopics(lesson.matched_topics);
      }
    } else {
      for (const lesson of deduped) {
        lesson.matched_topics = normalizeMatchedTopics(lesson.matched_topics);
      }
    }

    return deduped;
  }

  static async createLesson(data: {
    unit_id: number;
    exam_id: string;
    subject_id: string;
    standard_number: number;
    lesson_number: string;
    title: string;
    term?: string;
    description?: string;
    status?: string;
    display_order?: number;
  }): Promise<LessonRecord> {
    const unitLookup = await pool.query('SELECT id, exam_id, subject_id FROM syllabus_units WHERE id = $1', [data.unit_id]);
    const cleanExam = unitLookup.rows[0]?.exam_id || normalizeExamId(data.exam_id);
    const cleanSub = normalizeSubjectSlug(unitLookup.rows[0]?.subject_id || data.subject_id || '', cleanExam);

    // Ensure this standard is not excluded on the parent unit
    await pool.query(
      `UPDATE syllabus_units
          SET excluded_standards = array_remove(COALESCE(excluded_standards, '{}'::int[]), $2::int),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [data.unit_id, data.standard_number]
    );

    // Check if an active lesson with the same unit_id, standard_number, and title already exists
    const dupCheck = await pool.query(
      `SELECT * FROM syllabus_lessons
       WHERE unit_id = $1 AND standard_number = $2 AND LOWER(TRIM(title)) = LOWER(TRIM($3)) AND is_active = true
       LIMIT 1`,
      [data.unit_id, data.standard_number, data.title]
    );
    if (dupCheck.rows.length > 0) {
      const upd = await pool.query(
        `UPDATE syllabus_lessons
         SET lesson_number = COALESCE($2, lesson_number),
             title = $3,
             term = COALESCE($4, term),
             description = COALESCE($5, description),
             status = COALESCE($6, status),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [
          dupCheck.rows[0].id,
          data.lesson_number?.trim(),
          data.title.trim(),
          data.term?.trim() || 'Term 1',
          data.description?.trim() || null,
          data.status || 'Available',
        ]
      );
      return upd.rows[0];
    }

    const customId = `unit-${data.unit_id}-class-${data.standard_number}-l${data.lesson_number.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now().toString(36)}`;

    let orderToSet = data.display_order;
    if (!orderToSet || orderToSet <= 0) {
      const maxRes = await pool.query(
        'SELECT COALESCE(MAX(display_order), 0) as max_ord FROM syllabus_lessons WHERE unit_id = $1 AND standard_number = $2',
        [data.unit_id, data.standard_number]
      );
      orderToSet = (maxRes.rows[0]?.max_ord || 0) + 1;
    }

    const res = await pool.query(
      `INSERT INTO syllabus_lessons (
        id, unit_id, exam_id, subject_id, standard_number, lesson_number,
        title, term, description, status, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        customId,
        data.unit_id,
        cleanExam,
        cleanSub,
        data.standard_number,
        data.lesson_number.trim(),
        data.title.trim(),
        data.term?.trim() || 'Term 1',
        data.description?.trim() || null,
        data.status || 'Available',
        orderToSet,
      ]
    );
    return res.rows[0];
  }

  static async updateLesson(
    id: string,
    data: {
      lesson_number?: string;
      title?: string;
      term?: string;
      description?: string;
      status?: string;
      display_order?: number;
    }
  ): Promise<LessonRecord> {
    const res = await pool.query(
      `UPDATE syllabus_lessons
       SET lesson_number = COALESCE($2, lesson_number),
           title = COALESCE($3, title),
           term = COALESCE($4, term),
           description = COALESCE($5, description),
           status = COALESCE($6, status),
           display_order = COALESCE($7, display_order),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, data.lesson_number, data.title, data.term, data.description, data.status, data.display_order]
    );
    return res.rows[0];
  }

  /**
   * Safe Scoped Lesson Delete:
   * Validates ownership (unitId, examId, subjectId, standardNumber) and deletes ONLY the target Lesson
   * and its child Focus Areas / Notes in an atomic transaction.
   */
  static async deleteLesson(
    id: string,
    force: boolean = false,
    scope?: { unitId?: number; examId?: string; subjectId?: string; standardNumber?: number }
  ): Promise<{
    success: boolean;
    notFound?: boolean;
    invalidOwnership?: boolean;
    message?: string;
    dependencies?: { topics: number; notes: number; questions: number };
    deleted?: { lessons: number; topics: number; notes: number };
  }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const lessonRes = await client.query('SELECT * FROM syllabus_lessons WHERE id = $1 FOR UPDATE', [id]);
      if (lessonRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return { success: false, notFound: true, message: `Lesson "${id}" was not found.` };
      }
      const lesson: LessonRecord = lessonRes.rows[0];

      // Validate ownership scope if provided
      if (scope?.unitId != null && Number(lesson.unit_id) !== Number(scope.unitId)) {
        await client.query('ROLLBACK');
        return {
          success: false,
          invalidOwnership: true,
          message: `Ownership mismatch: Lesson "${id}" belongs to Unit #${lesson.unit_id}, not Unit #${scope.unitId}.`,
        };
      }
      if (scope?.examId && !isSameExamFamily(lesson.exam_id, scope.examId)) {
        await client.query('ROLLBACK');
        return {
          success: false,
          invalidOwnership: true,
          message: `Ownership mismatch: Lesson "${id}" belongs to Group "${lesson.exam_id}", not "${scope.examId}".`,
        };
      }
      if (
        scope?.subjectId &&
        scope.subjectId !== 'all' &&
        normalizeSubjectSlug(lesson.subject_id, lesson.exam_id) !== normalizeSubjectSlug(scope.subjectId, lesson.exam_id)
      ) {
        await client.query('ROLLBACK');
        return {
          success: false,
          invalidOwnership: true,
          message: `Ownership mismatch: Lesson "${id}" does not belong to Subject "${scope.subjectId}".`,
        };
      }
      if (scope?.standardNumber != null && Number(lesson.standard_number) !== Number(scope.standardNumber)) {
        await client.query('ROLLBACK');
        return {
          success: false,
          invalidOwnership: true,
          message: `Ownership mismatch: Lesson "${id}" belongs to ${lesson.standard_number}th Standard, not ${scope.standardNumber}th Standard.`,
        };
      }

      const topicsRes = await client.query('SELECT COUNT(*)::int AS count FROM syllabus_topics WHERE lesson_id = $1', [id]);
      const topicsCount = topicsRes.rows[0]?.count || 0;

      const notesRes = await client.query('SELECT COUNT(*)::int AS count FROM study_notes WHERE lesson_id = $1', [id]);
      const notesCount = notesRes.rows[0]?.count || 0;

      const questionsRes = await client.query('SELECT COUNT(*)::int AS count FROM questions WHERE lesson_id = $1', [id]);
      const questionsCount = questionsRes.rows[0]?.count || 0;

      if (!force && (topicsCount > 0 || notesCount > 0 || questionsCount > 0)) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: `Cannot delete Lesson "${lesson.title}". Active dependencies found: ${topicsCount} focus area(s), ${notesCount} study note(s), ${questionsCount} question(s). Confirm force delete to remove only this lesson.`,
          dependencies: {
            topics: topicsCount,
            notes: notesCount,
            questions: questionsCount,
          },
        };
      }

      const delNotes = await client.query(
        `DELETE FROM study_notes
          WHERE lesson_id = $1
             OR topic_id IN (SELECT id::text FROM syllabus_topics WHERE lesson_id = $1)`,
        [id]
      );
      const delTopics = await client.query('DELETE FROM syllabus_topics WHERE lesson_id = $1', [id]);
      const delLesson = await client.query('DELETE FROM syllabus_lessons WHERE id = $1', [id]);
      await client.query('COMMIT');

      return {
        success: (delLesson.rowCount ?? 0) > 0,
        deleted: {
          lessons: delLesson.rowCount ?? 0,
          topics: delTopics.rowCount ?? 0,
          notes: delNotes.rowCount ?? 0,
        },
      };
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // =========================================================================
  // TOPICS (FOCUS AREAS) CRUD
  // =========================================================================
  static async getTopics(
    lessonIdOrTitle: string,
    options?: { unitId?: number; lessonTitle?: string }
  ): Promise<TopicRecord[]> {
    const term = (lessonIdOrTitle || '').trim();
    const titleTerm = (options?.lessonTitle || term).trim();
    const unitId = options?.unitId;

    const buildTopicsQuery = (whereSql: string) => `
      WITH filtered_topics AS (
        SELECT t.*
        FROM syllabus_topics t
        ${whereSql}
      ),
      matched_notes AS (
        SELECT ft.id AS topic_pk, sn.id AS note_id
        FROM filtered_topics ft
        JOIN study_notes sn ON sn.topic_id = ft.id::text
        UNION
        SELECT ft.id AS topic_pk, sn.id AS note_id
        FROM filtered_topics ft
        JOIN study_notes sn ON LOWER(sn.topic) = LOWER(ft.topic_name)
      ),
      topic_note_stats AS (
        SELECT topic_pk,
               COUNT(*)::int AS notes_count,
               (ARRAY_AGG(note_id ORDER BY note_id ASC))[1] AS notes_id
        FROM matched_notes
        GROUP BY topic_pk
      )
      SELECT t.*,
             COALESCE(tns.notes_count, 0) as notes_count,
             tns.notes_id
      FROM filtered_topics t
      LEFT JOIN topic_note_stats tns ON tns.topic_pk = t.id
    `;

    const orderClause = `ORDER BY 
         CASE WHEN t.display_order > 0 THEN t.display_order ELSE 999999 END ASC,
         CASE 
           WHEN NULLIF(regexp_replace(regexp_replace(t.topic_name, '^[^0-9]+', ''), '[^0-9.]', '', 'g'), '') IS NOT NULL 
           THEN string_to_array(trim(both '.' from regexp_replace(t.topic_name, '[^0-9.]', '', 'g')), '.')::int[]
           ELSE ARRAY[999999]
         END ASC,
         t.id ASC`;

    // 1. Prefer exact lesson_id match so topics from other TNPSC groups with the same lesson title do not duplicate
    let rows: any[] = [];
    if (term) {
      const exactRes = await pool.query(
        `${buildTopicsQuery(`WHERE (t.lesson_id = $1 OR LOWER(t.lesson_id) = LOWER($1))
           AND t.is_active = true`)}
         ${orderClause}`,
        [term]
      );
      rows = exactRes.rows;
    }

    // 2. Fallback to lessonTitle match only if no exact lesson_id rows exist
    if (rows.length === 0 && (term || titleTerm)) {
      const fallbackRes = await pool.query(
        `${buildTopicsQuery(`WHERE (
           t.lesson_id IN (
             SELECT id FROM syllabus_lessons 
             WHERE id = $1 
                OR LOWER(TRIM(title)) = LOWER(TRIM($1)) 
                OR LOWER(TRIM(title)) = LOWER(TRIM($2))
                OR ($3::int IS NOT NULL AND unit_id = $3 AND (LOWER(TRIM(title)) = LOWER(TRIM($1)) OR LOWER(TRIM(title)) = LOWER(TRIM($2))))
           )
           OR ($3::int IS NOT NULL AND t.unit_id = $3 AND (
             t.lesson_id IN (
               SELECT id FROM syllabus_lessons 
               WHERE unit_id = $3 AND (LOWER(TRIM(title)) = LOWER(TRIM($1)) OR LOWER(TRIM(title)) = LOWER(TRIM($2)))
             )
           ))
         )
           AND t.is_active = true`)}
         ${orderClause}`,
        [term, titleTerm, unitId || null]
      );
      rows = fallbackRes.rows;
    }

    // 3. Deduplicate by normalized topic_name while preserving order
    const dedupedMap = new Map<string, TopicRecord>();
    for (const r of rows) {
      const normalizedKey = String(r.topic_name || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!normalizedKey) continue;
      const mapped: TopicRecord = {
        ...r,
        has_notes: (r.notes_count || 0) > 0,
      };
      const existing = dedupedMap.get(normalizedKey);
      if (!existing || (mapped.has_notes && !existing.has_notes)) {
        dedupedMap.set(normalizedKey, mapped);
      }
    }

    return Array.from(dedupedMap.values()).sort(compareTopics);
  }

  static async createTopic(data: {
    lesson_id: string;
    unit_id: number;
    topic_name: string;
    description?: string;
    syllabus_reference?: string;
    display_order?: number;
  }): Promise<TopicRecord> {
    let orderToSet = data.display_order;
    if (!orderToSet || orderToSet <= 0) {
      const maxRes = await pool.query(
        'SELECT COALESCE(MAX(display_order), 0) as max_ord FROM syllabus_topics WHERE lesson_id = $1',
        [data.lesson_id]
      );
      orderToSet = (maxRes.rows[0]?.max_ord || 0) + 1;
    }

    const res = await pool.query(
      `INSERT INTO syllabus_topics (lesson_id, unit_id, topic_name, description, syllabus_reference, display_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (lesson_id, topic_name) DO UPDATE SET
         description = COALESCE(EXCLUDED.description, syllabus_topics.description),
         syllabus_reference = COALESCE(EXCLUDED.syllabus_reference, syllabus_topics.syllabus_reference),
         is_active = true,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        data.lesson_id,
        data.unit_id,
        data.topic_name.trim(),
        data.description?.trim() || null,
        data.syllabus_reference?.trim() || null,
        orderToSet,
      ]
    );
    return res.rows[0];
  }

  static async updateTopic(
    id: number,
    data: { topic_name?: string; description?: string; display_order?: number }
  ): Promise<TopicRecord> {
    const res = await pool.query(
      `UPDATE syllabus_topics
       SET topic_name = COALESCE($2, topic_name),
           description = COALESCE($3, description),
           display_order = COALESCE($4, display_order),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, data.topic_name, data.description, data.display_order]
    );
    return res.rows[0];
  }

  /**
   * Safe Scoped Focus Area (Topic) Delete:
   * Validates ownership (lessonId, unitId) and deletes ONLY the target Focus Area record in a transaction.
   */
  static async deleteTopic(
    id: number,
    force: boolean = false,
    scope?: { lessonId?: string; unitId?: number }
  ): Promise<{
    success: boolean;
    notFound?: boolean;
    invalidOwnership?: boolean;
    message?: string;
    dependencies?: { notes: number; questions: number };
  }> {
    if (!Number.isInteger(id) || id <= 0) {
      return { success: false, message: 'Invalid Focus Area ID.' };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const topicRes = await client.query('SELECT * FROM syllabus_topics WHERE id = $1 FOR UPDATE', [id]);
      if (topicRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return { success: false, notFound: true, message: `Focus Area #${id} was not found.` };
      }
      const topic = topicRes.rows[0];

      if (scope?.lessonId && String(topic.lesson_id) !== String(scope.lessonId)) {
        await client.query('ROLLBACK');
        return {
          success: false,
          invalidOwnership: true,
          message: `Ownership mismatch: Focus Area #${id} belongs to Lesson "${topic.lesson_id}", not "${scope.lessonId}".`,
        };
      }
      if (scope?.unitId != null && Number(topic.unit_id) !== Number(scope.unitId)) {
        await client.query('ROLLBACK');
        return {
          success: false,
          invalidOwnership: true,
          message: `Ownership mismatch: Focus Area #${id} belongs to Unit #${topic.unit_id}, not Unit #${scope.unitId}.`,
        };
      }

      const notesRes = await client.query('SELECT COUNT(*)::int AS count FROM study_notes WHERE topic_id = $1::text', [id]);
      const notesCount = notesRes.rows[0]?.count || 0;

      const questionsRes = await client.query('SELECT COUNT(*)::int AS count FROM questions WHERE LOWER(topic) = LOWER($1)', [topic.topic_name]);
      const questionsCount = questionsRes.rows[0]?.count || 0;

      if (!force && (notesCount > 0 || questionsCount > 0)) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: `Cannot delete Focus Area #${id}. Active dependencies found: ${notesCount} study notes, ${questionsCount} questions. Confirm force delete to proceed.`,
          dependencies: {
            notes: notesCount,
            questions: questionsCount,
          },
        };
      }

      await client.query('DELETE FROM study_notes WHERE topic_id = $1::text', [id]);
      const res = await client.query('DELETE FROM syllabus_topics WHERE id = $1', [id]);
      await client.query('COMMIT');
      return { success: (res.rowCount ?? 0) > 0 };
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // =========================================================================
  // REORDERING (Units, Lessons, Topics)
  // =========================================================================
  static async reorderUnits(items: Array<{ id: number; display_order: number }>): Promise<boolean> {
    if (!Array.isArray(items) || items.length === 0) return true;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of items) {
        await client.query(
          'UPDATE syllabus_units SET display_order = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [item.id, item.display_order]
        );
      }
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async reorderLessons(items: Array<{ id: string; display_order: number }>): Promise<boolean> {
    if (!Array.isArray(items) || items.length === 0) return true;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of items) {
        await client.query(
          'UPDATE syllabus_lessons SET display_order = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [item.id, item.display_order]
        );
      }
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async reorderTopics(items: Array<{ id: number; display_order: number }>): Promise<boolean> {
    if (!Array.isArray(items) || items.length === 0) return true;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of items) {
        await client.query(
          'UPDATE syllabus_topics SET display_order = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [item.id, item.display_order]
        );
      }
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // =========================================================================
  // STUDY NOTES FOR TOPIC / LESSON
  // =========================================================================
  static async getNotesForTopicOrLesson(params: {
    topicId?: string;
    lessonId?: string;
    lessonTitle?: string;
  }) {
    const { topicId, lessonId, lessonTitle } = params;
    const res = await pool.query(
      `SELECT * FROM study_notes
       WHERE ($1::text IS NOT NULL AND topic_id = $1)
          OR ($2::text IS NOT NULL AND lesson_id = $2)
          OR ($3::text IS NOT NULL AND LOWER(lesson_title) = LOWER($3))
       ORDER BY id DESC`,
      [topicId || null, lessonId || null, lessonTitle || null]
    );
    return res.rows;
  }

  static async saveStudyNote(data: {
    id?: number;
    exam_id: string;
    subject: string;
    standard_number: number;
    unit_id: number;
    lesson_id: string;
    lesson_number?: string;
    lesson_title: string;
    topic?: string;
    topic_id?: string;
    title: string;
    content: string;
    content_html?: string;
    language?: 'tamil' | 'english';
    status?: 'staging' | 'published' | 'archived';
  }) {
    if (data.id) {
      const res = await pool.query(
        `UPDATE study_notes
         SET title = COALESCE($2, title),
             content = COALESCE($3, content),
             content_html = COALESCE($4, content_html),
             language = COALESCE($5, language),
             status = COALESCE($6, status),
             topic = COALESCE($7, topic),
             topic_id = COALESCE($8, topic_id),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [
          data.id,
          data.title,
          data.content,
          data.content_html || null,
          data.language || 'english',
          data.status || 'published',
          data.topic || null,
          data.topic_id || null,
        ]
      );
      return res.rows[0];
    } else {
      const res = await pool.query(
        `INSERT INTO study_notes (
          category, subject, class_id, unit_id, lesson_id, lesson_number,
          lesson_title, topic, topic_id, title, content, content_html,
          language, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          normalizeExamId(data.exam_id),
          normalizeSubjectSlug(data.subject, data.exam_id),
          data.standard_number,
          data.unit_id,
          data.lesson_id,
          data.lesson_number || null,
          data.lesson_title,
          data.topic || null,
          data.topic_id || null,
          data.title,
          data.content,
          data.content_html || null,
          data.language || 'english',
          data.status || 'published',
        ]
      );
      return res.rows[0];
    }
  }

  // =========================================================================
  // COMPLETE NESTED TREE (For Admin Management and Dynamic Frontend Viewer)
  // =========================================================================
  static async getFullHierarchyTree(params: {
    examId: string;
    subjectId: string;
    standardNumber?: number;
    unitNumber?: number;
  }) {
    const { examId, subjectId, standardNumber, unitNumber } = params;
    const cleanExam = normalizeExamId(examId);
    const examFamily = getExamFamilyIds(examId);
    const normSub = normalizeSubjectSlug(subjectId, cleanExam);
    const subjectCandidates = normSub === 'all' ? ['all'] : [normSub, ...examFamily.map((g) => `${g}-${normSub}`)];

    // 1. Fetch units across the exam family (e.g. group2 + group2a for TNPSC Group 2 & 2A)
    const unitsRes = await pool.query(
      `SELECT u.*
       FROM syllabus_units u
       WHERE u.exam_id = ANY($1::text[])
         AND ($2 = 'all' OR u.subject_id = ANY($4::text[]))
         AND ($3::int IS NULL OR u.unit_number = $3)
         AND ($5::int IS NULL OR (
           (u.standard_number IS NULL OR u.standard_number = $5)
           AND NOT ($5 = ANY(COALESCE(u.excluded_standards, '{}'::int[])))
         ))
         AND u.is_active = true
       ORDER BY CASE WHEN u.exam_id = $6 THEN 0 ELSE 1 END ASC, u.display_order ASC, u.unit_number ASC, u.id ASC`,
      [examFamily, normSub, unitNumber || null, subjectCandidates, standardNumber || null, cleanExam]
    );

    const units = unitsRes.rows;
    if (units.length === 0) {
      return [];
    }

    // 2. Fetch all lessons belonging to these units
    const unitIds = units.map((u) => u.id);
    const lessonsRes = await pool.query(
      `WITH filtered_lessons AS (
         SELECT l.*
         FROM syllabus_lessons l
         WHERE l.unit_id = ANY($1::int[])
           AND ($2::int IS NULL OR l.standard_number = $2)
           AND l.is_active = true
       ),
       topic_counts AS (
         SELECT t.lesson_id, COUNT(*)::int AS topics_count
         FROM syllabus_topics t
         WHERE t.is_active = true
           AND t.lesson_id IN (SELECT id FROM filtered_lessons)
         GROUP BY t.lesson_id
       ),
       matched_lesson_notes AS (
         SELECT fl.id AS lesson_id
         FROM filtered_lessons fl
         JOIN study_notes sn ON sn.lesson_id = fl.id
         UNION
         SELECT fl.id AS lesson_id
         FROM filtered_lessons fl
         JOIN study_notes sn ON LOWER(sn.lesson_title) = LOWER(fl.title)
       )
       SELECT l.*,
              COALESCE(tc.topics_count, 0) as topics_count,
              (mln.lesson_id IS NOT NULL) as has_notes
       FROM filtered_lessons l
       LEFT JOIN topic_counts tc ON tc.lesson_id = l.id
       LEFT JOIN matched_lesson_notes mln ON mln.lesson_id = l.id
       ORDER BY 
         CASE WHEN l.exam_id = $3 THEN 0 ELSE 1 END ASC,
         l.standard_number ASC,
         CASE WHEN l.display_order > 0 THEN l.display_order ELSE 999999 END ASC,
         CASE 
           WHEN NULLIF(regexp_replace(regexp_replace(l.lesson_number, '^[^0-9]+', ''), '[^0-9.]', '', 'g'), '') IS NOT NULL 
           THEN string_to_array(trim(both '.' from regexp_replace(l.lesson_number, '[^0-9.]', '', 'g')), '.')::int[]
           ELSE ARRAY[999999]
         END ASC,
         l.lesson_number ASC`,
      [unitIds, standardNumber || null, cleanExam]
    );

    const lessons = lessonsRes.rows;
    const lessonIds = lessons.map((l) => l.id);

    // 3. Fetch all topics (Focus Areas) for these lessons
    let topics: any[] = [];
    if (lessonIds.length > 0) {
      const topicsRes = await pool.query(
        `WITH filtered_topics AS (
           SELECT t.*
           FROM syllabus_topics t
           WHERE t.lesson_id = ANY($1::text[])
             AND t.is_active = true
         ),
         matched_notes AS (
           SELECT ft.id AS topic_pk, sn.id AS note_id
           FROM filtered_topics ft
           JOIN study_notes sn ON sn.topic_id = ft.id::text
           UNION
           SELECT ft.id AS topic_pk, sn.id AS note_id
           FROM filtered_topics ft
           JOIN study_notes sn ON LOWER(sn.topic) = LOWER(ft.topic_name)
         ),
         topic_note_stats AS (
           SELECT topic_pk,
                  (ARRAY_AGG(note_id ORDER BY note_id ASC))[1] AS notes_id
           FROM matched_notes
           GROUP BY topic_pk
         )
         SELECT t.*,
                tns.notes_id,
                (tns.notes_id IS NOT NULL) as has_notes
         FROM filtered_topics t
         LEFT JOIN topic_note_stats tns ON tns.topic_pk = t.id
         ORDER BY 
         CASE WHEN t.display_order > 0 THEN t.display_order ELSE 999999 END ASC,
         CASE 
           WHEN NULLIF(regexp_replace(regexp_replace(t.topic_name, '^[^0-9]+', ''), '[^0-9.]', '', 'g'), '') IS NOT NULL 
           THEN string_to_array(trim(both '.' from regexp_replace(t.topic_name, '[^0-9.]', '', 'g')), '.')::int[]
           ELSE ARRAY[999999]
         END ASC,
         t.id ASC`,
        [lessonIds]
      );
      topics = topicsRes.rows;
    }

    // 4. Assemble complete nested tree and merge Group 2 & Group 2A units sharing the same (subject_slug, unit_number)
    // while preserving source identification (exam_id: 'group2' or 'group2a') and preventing duplicate units, lessons, or topics
    const mergedByUnitKey = new Map<string, any>();
    for (const u of units) {
      const unitLessons = lessons
        .filter((l) => l.unit_id === u.id)
        .map((l) => {
          const rawTopics = topics.filter((t) => t.lesson_id === l.id).sort(compareTopics);
          const dedupedTopics: any[] = [];
          const seenTopicNames = new Set<string>();
          for (const t of rawTopics) {
            const tKey = String(t.topic_name || '').toLowerCase().trim();
            if (!seenTopicNames.has(tKey)) {
              seenTopicNames.add(tKey);
              dedupedTopics.push(t);
            }
          }
          return {
            ...l,
            matched_topics: normalizeMatchedTopics(l.matched_topics),
            topics: dedupedTopics,
          };
        })
        .sort(compareLessons);

      const subKey = normalizeSubjectSlug(u.subject_id, u.exam_id);
      const mergeKey = standardNumber != null
        ? `${subKey}::${u.unit_number}`
        : `${subKey}::${u.unit_number}::${u.standard_number || 0}`;

      const existingUnit = mergedByUnitKey.get(mergeKey);
      if (!existingUnit) {
        mergedByUnitKey.set(mergeKey, {
          ...u,
          source_groups: [u.exam_id],
          lessons: unitLessons,
        });
      } else {
        if (!existingUnit.source_groups.includes(u.exam_id)) {
          existingUnit.source_groups.push(u.exam_id);
        }
        // Merge lessons without duplicates by (standard_number, normalized title)
        const existingLessonMap = new Map<string, any>();
        for (const el of existingUnit.lessons) {
          const normTitle = String(el.title || '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\u0B80-\u0BFF]+/g, '');
          const lKey = `${el.standard_number}::${normTitle || el.lesson_number}`;
          existingLessonMap.set(lKey, el);
        }
        for (const nl of unitLessons) {
          const normTitle = String(nl.title || '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\u0B80-\u0BFF]+/g, '');
          const lKey = `${nl.standard_number}::${normTitle || nl.lesson_number}`;
          const prevLesson = existingLessonMap.get(lKey);
          if (!prevLesson) {
            existingLessonMap.set(lKey, nl);
          } else {
            // Merge any unique topics from Group 2A into the lesson
            const seenTopics = new Set<string>(
              (prevLesson.topics || []).map((t: any) => String(t.topic_name || '').toLowerCase().trim())
            );
            for (const nt of nl.topics || []) {
              const tKey = String(nt.topic_name || '').toLowerCase().trim();
              if (!seenTopics.has(tKey)) {
                seenTopics.add(tKey);
                prevLesson.topics = [...(prevLesson.topics || []), nt];
              }
            }
            prevLesson.topics = (prevLesson.topics || []).sort(compareTopics);
          }
        }
        existingUnit.lessons = Array.from(existingLessonMap.values()).sort(compareLessons);
      }
    }

    return Array.from(mergedByUnitKey.values()).sort((a, b) => a.unit_number - b.unit_number);
  }
}
