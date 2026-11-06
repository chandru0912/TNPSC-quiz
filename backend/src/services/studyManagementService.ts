import pool from '../db';
import { seedCompleteSyllabusData } from './seedSyllabusCatalog';

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
  created_at?: string;
  updated_at?: string;
}

export interface TopicRecord {
  id: number;
  lesson_id: string;
  unit_id: number;
  topic_name: string;
  description?: string | null;
  display_order: number;
  is_active: boolean;
  notes_count?: number;
  has_notes?: boolean;
  notes_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

function normalizeExamId(val?: string): string {
  if (!val) return 'group1';
  const c = val.toLowerCase().trim();
  if (c === 'group2a' || c === 'group-2a') return 'group2a';
  if (c === 'group2_2a' || c === 'group2' || c === 'group-2') return 'group2';
  if (c === 'group4_vao' || c === 'group4' || c === 'group-4' || c === 'vao') return 'group4';
  return c;
}

export class StudyManagementService {
  /**
   * Initializes the dynamic Study Materials database schema and seeds default canonical units & lessons.
   */
  static async initSchema(): Promise<void> {
    try {
      // 1. Create tables
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

        CREATE TABLE IF NOT EXISTS syllabus_units (
          id SERIAL PRIMARY KEY,
          exam_id VARCHAR(50) NOT NULL,
          subject_id VARCHAR(100) NOT NULL,
          standard_number INT,
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
        CREATE UNIQUE INDEX IF NOT EXISTS uq_syllabus_units_exam_subject_unit ON syllabus_units (exam_id, subject_id, unit_number) WHERE is_active = true;
        CREATE INDEX IF NOT EXISTS idx_syllabus_units_lookup ON syllabus_units (exam_id, subject_id, unit_number);
        CREATE INDEX IF NOT EXISTS idx_syllabus_lessons_lookup ON syllabus_lessons (unit_id, exam_id, subject_id, standard_number);
        CREATE INDEX IF NOT EXISTS idx_syllabus_topics_lookup ON syllabus_topics (lesson_id, unit_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_syllabus_topics_lesson_name ON syllabus_topics (lesson_id, topic_name);

        -- Optional provenance columns for textbook PDF page tracking
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS textbook_id INT;
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS source_page_start INT;
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS source_page_end INT;
        ALTER TABLE syllabus_lessons ADD COLUMN IF NOT EXISTS textbook_title TEXT;
        ALTER TABLE syllabus_topics ADD COLUMN IF NOT EXISTS source_page_reference TEXT;
      `);

      // 2. Check if syllabus_exams already seeded
      const checkExams = await pool.query('SELECT COUNT(*)::int AS count FROM syllabus_exams');
      if (checkExams.rows[0].count === 0) {
        console.log('[StudyManagement] Seeding default exams and subjects...');
        await pool.query(`
          INSERT INTO syllabus_exams (id, name, code, badge, description, display_order, is_active) VALUES
            ('group1', 'TNPSC Group 1', NULL, NULL, NULL, 1, true),
            ('group2', 'TNPSC Group 2', NULL, NULL, NULL, 2, true),
            ('group2a', 'TNPSC Group 2A', 'Code: 495', 'Degree Standard • Non-Interview', 'Assistant Section Officer, Senior Inspector', 3, true),
            ('group4', 'TNPSC Group 4', NULL, NULL, NULL, 4, true)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            code = EXCLUDED.code,
            badge = EXCLUDED.badge,
            description = EXCLUDED.description,
            display_order = EXCLUDED.display_order,
            is_active = true;
        `);

        // Seed default subjects
        await pool.query(`
          INSERT INTO syllabus_subjects (id, exam_id, subject_slug, name, description, display_order) VALUES
            ('group1-general-studies', 'group1', 'general-studies', 'General Studies', 'General Science, History, Polity, Economy, Geography, TN Heritage', 1),
            ('group1-aptitude', 'group1', 'aptitude', 'Aptitude and Mental Ability', 'Mental ability, Simplification, Ratio, Logical reasoning', 2),
            ('group2-general-studies', 'group2', 'general-studies', 'General Studies', 'General Science, History, Polity, Economy, Geography, TN Heritage', 1),
            ('group2-aptitude', 'group2', 'aptitude', 'Aptitude and Mental Ability', 'Mental ability, Simplification, Ratio, Logical reasoning', 2),
            ('group2-general-tamil', 'group2', 'general-tamil', 'General Tamil', 'இலக்கணம், இலக்கியம், தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும்', 3),
            ('group2-general-english', 'group2', 'general-english', 'General English', 'Grammar, Literature, Vocabulary, Comprehension', 4),
            ('group4-general-studies', 'group4', 'general-studies', 'General Studies', 'General Science, History, Polity, Economy, Geography, TN Heritage', 1),
            ('group4-aptitude', 'group4', 'aptitude', 'Aptitude and Mental Ability', 'Mental ability, Simplification, Ratio, Logical reasoning', 2),
            ('group4-general-tamil', 'group4', 'general-tamil', 'General Tamil', 'இலக்கணம், இலக்கியம், தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும்', 3),
            ('group4-general-english', 'group4', 'general-english', 'General English', 'Grammar, Literature, Vocabulary, Comprehension', 4)
          ON CONFLICT (id) DO NOTHING;
        `);
      }

      // 3. Seed canonical Group 1 Units if not present
      const checkUnits = await pool.query("SELECT COUNT(*)::int AS count FROM syllabus_units WHERE exam_id = 'group1'");
      if (checkUnits.rows[0].count === 0) {
        console.log('[StudyManagement] Seeding default Group 1 General Studies Units...');
        const defaultUnits = [
          { num: 1, code: 'Unit 1', title: 'General Science', sub: 'General Science', q: 10, ord: 1 },
          { num: 2, code: 'Unit 2', title: 'Geography of India', sub: 'Geography', q: 10, ord: 2 },
          { num: 3, code: 'Unit 3', title: 'History & Culture of India and INM', sub: 'History & INM', q: 15, ord: 3 },
          { num: 4, code: 'Unit 4', title: 'Indian Polity', sub: 'Indian Polity', q: 15, ord: 4 },
          { num: 5, code: 'Unit 5', title: 'Indian Economy & TN Admin', sub: 'Economy & TN Admin', q: 15, ord: 5 },
          { num: 6, code: 'Unit 6', title: 'History, Culture & Heritage of Tamil Nadu', sub: 'Tamil Nadu Heritage', q: 15, ord: 6 },
        ];

        for (const u of defaultUnits) {
          const insRes = await pool.query(
            `INSERT INTO syllabus_units (exam_id, subject_id, unit_number, unit_code, title, subject_name, question_count, display_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            ['group1', 'general-studies', u.num, u.code, u.title, u.sub, u.q, u.ord]
          );

          const unitDbId = insRes.rows[0]?.id;
          if (unitDbId) {
            // Seed sample lessons for 6th standard
            if (u.num === 1) {
              const lRes1 = await pool.query(
                `INSERT INTO syllabus_lessons (id, unit_id, exam_id, subject_id, standard_number, lesson_number, title, term, description, display_order)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title
                 RETURNING id`,
                ['1-6-l1', unitDbId, 'group1', 'general-studies', 6, '1.1', 'Measurements and SI Units', 'Term 1', 'Fundamental units, length, mass, time, volume and everyday measurement devices.', 1]
              );
              await pool.query(
                `INSERT INTO syllabus_topics (lesson_id, unit_id, topic_name, display_order) VALUES
                  ($1, $2, 'Measurements: SI Units, Length, Mass, Time', 1),
                  ($1, $2, 'Everyday Measurement Devices and Error Correction', 2)
                 ON CONFLICT DO NOTHING`,
                ['1-6-l1', unitDbId]
              );

              await pool.query(
                `INSERT INTO syllabus_lessons (id, unit_id, exam_id, subject_id, standard_number, lesson_number, title, term, description, display_order)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
                ['1-6-l2', unitDbId, 'group1', 'general-studies', 6, '1.2', 'Forces and Motion', 'Term 1', 'Types of motion, speed, force, displacement, distance and applications.', 2]
              );
              await pool.query(
                `INSERT INTO syllabus_topics (lesson_id, unit_id, topic_name, display_order) VALUES
                  ($1, $2, 'Forces and Motion: Types of Motion, Speed', 1),
                  ($1, $2, 'Periodic and Non-Periodic Motion in Daily Life', 2)
                 ON CONFLICT DO NOTHING`,
                ['1-6-l2', unitDbId]
              );

              await pool.query(
                `INSERT INTO syllabus_lessons (id, unit_id, exam_id, subject_id, standard_number, lesson_number, title, term, description, display_order)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
                ['1-6-l3', unitDbId, 'group1', 'general-studies', 6, '1.3', 'Matter Around Us', 'Term 1', 'Physical states of matter, separation of mixtures and changes around us.', 3]
              );
            }
          }
        }
      }

      // 4. Ensure complete canonical lessons (Group 1, 2, 4) if lessons count < 700
      const checkLessons = await pool.query('SELECT COUNT(*)::int AS count FROM syllabus_lessons');
      if (checkLessons.rows[0].count < 700) {
        console.log('[StudyManagement] Ensuring full canonical syllabus catalog (Group 1, 2, 4) in database...');
        await seedCompleteSyllabusData();
      }
    } catch (err) {
      console.error('[StudyManagement] Schema initialization error:', err);
      throw err;
    }
  }

  // =========================================================================
  // EXAMS CRUD
  // =========================================================================
  static async getExams(): Promise<ExamRecord[]> {
    const res = await pool.query(
      `SELECT id, name, code, badge, description, display_order, is_active 
       FROM syllabus_exams 
       WHERE is_active = true AND id IN ('group1', 'group2', 'group2a', 'group4') 
       ORDER BY display_order ASC, id ASC`
    );
    return res.rows;
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

  static async deleteExam(id: string): Promise<boolean> {
    const res = await pool.query('DELETE FROM syllabus_exams WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // =========================================================================
  // SUBJECTS CRUD
  // =========================================================================
  static async getSubjects(examId?: string): Promise<SubjectRecord[]> {
    if (examId) {
      const res = await pool.query(
        'SELECT * FROM syllabus_subjects WHERE exam_id = $1 AND is_active = true ORDER BY display_order ASC, name ASC',
        [examId]
      );
      return res.rows;
    }
    const res = await pool.query(
      'SELECT * FROM syllabus_subjects WHERE is_active = true ORDER BY display_order ASC, name ASC'
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
    const id = `${data.exam_id.toLowerCase().trim()}-${data.subject_slug.toLowerCase().trim()}`;
    const res = await pool.query(
      `INSERT INTO syllabus_subjects (id, exam_id, subject_slug, name, description, display_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        id,
        data.exam_id.toLowerCase().trim(),
        data.subject_slug.toLowerCase().trim(),
        data.name.trim(),
        data.description?.trim() || null,
        data.display_order ?? 0,
      ]
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

  static async deleteSubject(id: string): Promise<boolean> {
    const res = await pool.query('DELETE FROM syllabus_subjects WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // =========================================================================
  // UNITS CRUD
  // =========================================================================
  static async getUnits(
    examId: string,
    subjectId: string,
    standardNumber?: number
  ): Promise<UnitRecord[]> {
    const cleanExam = normalizeExamId(examId);
    let normSub = subjectId.toLowerCase().trim();
    if (normSub.startsWith(`${cleanExam}-`)) {
      normSub = normSub.slice(`${cleanExam}-`.length);
    }
    const query = `
      SELECT u.*,
             (SELECT COUNT(*)::int FROM syllabus_lessons l WHERE l.unit_id = u.id AND ($3::int IS NULL OR l.standard_number = $3)) as lessons_count
      FROM syllabus_units u
      WHERE (u.exam_id = $1 OR ($1 = 'group2a' AND u.exam_id = 'group2') OR ($1 = 'group2' AND u.exam_id = 'group2a'))
        AND (u.subject_id = $2 OR u.subject_id = $4 OR u.subject_id = 'all')
        AND u.is_active = true
      ORDER BY u.display_order ASC, u.unit_number ASC
    `;
    const res = await pool.query(query, [
      cleanExam,
      normSub,
      standardNumber || null,
      `${cleanExam}-${normSub}`,
    ]);
    return res.rows;
  }

  static async createUnit(data: {
    exam_id: string;
    subject_id: string;
    standard_number?: number;
    unit_number: number;
    unit_code?: string;
    title: string;
    subject_name?: string;
    description?: string;
    question_count?: number;
    display_order?: number;
  }): Promise<UnitRecord> {
    const code = data.unit_code?.trim() || `Unit ${data.unit_number}`;
    const cleanExam = data.exam_id.toLowerCase().trim();
    const cleanSub = data.subject_id.toLowerCase().trim();

    // Check if parent unit already exists
    const existing = await pool.query(
      `SELECT * FROM syllabus_units 
       WHERE exam_id = $1 AND subject_id = $2 AND unit_number = $3 AND is_active = true`,
      [cleanExam, cleanSub, data.unit_number]
    );
    if (existing.rows.length > 0) {
      // Update existing parent unit rather than creating duplicate
      const upd = await pool.query(
        `UPDATE syllabus_units
         SET title = $1, unit_code = $2, subject_name = $3, description = COALESCE($4, description),
             question_count = COALESCE($5, question_count), updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING *`,
        [
          data.title.trim(),
          code,
          data.subject_name?.trim() || data.title.trim(),
          data.description?.trim() || null,
          data.question_count,
          existing.rows[0].id,
        ]
      );
      return upd.rows[0];
    }

    const res = await pool.query(
      `INSERT INTO syllabus_units (
        exam_id, subject_id, standard_number, unit_number, unit_code, title,
        subject_name, description, question_count, display_order
      ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (exam_id, subject_id, unit_number) WHERE is_active = true
      DO UPDATE SET
        title = EXCLUDED.title,
        unit_code = EXCLUDED.unit_code,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        cleanExam,
        cleanSub,
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
        data.unit_code,
        data.title,
        data.subject_name,
        data.description,
        data.question_count,
        data.display_order,
      ]
    );
    return res.rows[0];
  }

  /**
   * Counts records that depend on a syllabus unit.
   * NOTE: study_notes.unit_id / questions.unit_id hold legacy unit *numbers* (shared across
   * groups), so dependencies are resolved strictly through this unit's own lesson/topic IDs.
   */
  static async getUnitDependencies(
    id: number,
    db: { query: (text: string, values?: any[]) => Promise<any> } = pool
  ): Promise<{ exists: boolean; lessons: number; topics: number; notes: number; questions: number }> {
    const res = await db.query(
      `WITH ul AS (SELECT id FROM syllabus_lessons WHERE unit_id = $1),
            ut AS (SELECT id FROM syllabus_topics WHERE unit_id = $1 OR lesson_id IN (SELECT id FROM ul))
       SELECT
         EXISTS (SELECT 1 FROM syllabus_units WHERE id = $1) AS exists,
         (SELECT COUNT(*)::int FROM ul) AS lessons,
         (SELECT COUNT(*)::int FROM ut) AS topics,
         (SELECT COUNT(*)::int FROM study_notes
            WHERE lesson_id IN (SELECT id FROM ul) OR topic_id IN (SELECT id::text FROM ut)) AS notes,
         (SELECT COUNT(*)::int FROM questions WHERE lesson_id IN (SELECT id FROM ul)) AS questions`,
      [id]
    );
    const r = res.rows[0];
    return { exists: r.exists, lessons: r.lessons, topics: r.topics, notes: r.notes, questions: r.questions };
  }

  static async deleteUnit(
    id: number,
    force: boolean = false
  ): Promise<{
    success: boolean;
    notFound?: boolean;
    message?: string;
    dependencies?: { lessons: number; topics: number; notes: number; questions: number };
    deleted?: { lessons: number; topics: number; notes: number };
  }> {
    if (!Number.isInteger(id) || id <= 0) {
      return { success: false, message: 'Invalid unit ID.' };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Lock the unit row so concurrent edits cannot attach new children mid-delete.
      const lock = await client.query('SELECT id FROM syllabus_units WHERE id = $1 FOR UPDATE', [id]);
      if (lock.rowCount === 0) {
        await client.query('ROLLBACK');
        return { success: false, notFound: true, message: `Unit #${id} was not found. It may have already been deleted.` };
      }

      const { exists: _exists, ...deps } = await this.getUnitDependencies(id, client);
      if (!force && (deps.lessons > 0 || deps.topics > 0 || deps.notes > 0)) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: `Unit #${id} contains ${deps.lessons} lesson(s), ${deps.topics} topic(s) and ${deps.notes} study note(s). Confirm to delete them together.`,
          dependencies: deps,
        };
      }

      // Children first: study notes bound to this unit's lessons/topics, then topics, lessons, unit.
      // Practice questions are part of the question bank and are intentionally preserved.
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
      await client.query('DELETE FROM syllabus_units WHERE id = $1', [id]);
      await client.query('COMMIT');

      return {
        success: true,
        deleted: {
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
  // LESSONS CRUD
  // =========================================================================
  static async getLessons(params: {
    unitId?: number;
    unitNumber?: number;
    examId?: string;
    subjectId?: string;
    standardNumber?: number;
  }): Promise<LessonRecord[]> {
    const cleanExam = params.examId ? normalizeExamId(params.examId) : undefined;
    let normSub = params.subjectId?.toLowerCase().trim();
    if (cleanExam && normSub?.startsWith(`${cleanExam}-`)) {
      normSub = normSub.slice(`${cleanExam}-`.length);
    }
    const effectiveUnitNum = params.unitNumber ?? (params.unitId && params.unitId < 100 ? params.unitId : undefined);

    const res = await pool.query(
      `SELECT l.*,
              (SELECT COUNT(*)::int FROM syllabus_topics t WHERE t.lesson_id = l.id) as topics_count,
              EXISTS (SELECT 1 FROM study_notes sn WHERE (sn.lesson_id = l.id OR LOWER(sn.lesson_title) = LOWER(l.title))) as has_notes
       FROM syllabus_lessons l
       WHERE (
         -- Strict Unit Filter:
         -- When neither unitId nor unitNumber is supplied, allow all units
         ($1::int IS NULL AND $6::int IS NULL)
         -- When unitId is supplied, match direct l.unit_id or unit lookup
         OR ($1::int IS NOT NULL AND (
              l.unit_id = $1
              OR l.unit_id IN (
                SELECT u.id FROM syllabus_units u 
                WHERE ($2::text IS NULL OR u.exam_id = $2 OR ($2 = 'group2' AND u.exam_id = 'group2a'))
                  AND ($3::text IS NULL OR u.subject_id = $3 OR u.subject_id = $5)
                  AND (u.id = $1 OR u.unit_number = $1)
              )
            ))
         -- When unitNumber is supplied, strictly match via syllabus_units.unit_number
         OR ($6::int IS NOT NULL AND l.unit_id IN (
              SELECT u.id FROM syllabus_units u 
              WHERE ($2::text IS NULL OR u.exam_id = $2 OR ($2 = 'group2' AND u.exam_id = 'group2a'))
                AND ($3::text IS NULL OR u.subject_id = $3 OR u.subject_id = $5)
                AND u.unit_number = $6
            ))
       )
         AND ($2::text IS NULL OR l.exam_id = $2 OR ($2 = 'group2' AND l.exam_id = 'group2a'))
         AND ($3::text IS NULL OR l.subject_id = $3 OR l.subject_id = $5)
         AND ($4::int IS NULL OR l.standard_number = $4)
         AND l.is_active = true
       ORDER BY l.display_order ASC, l.lesson_number ASC`,
      [
        params.unitId || null,
        cleanExam || null,
        normSub || null,
        params.standardNumber || null,
        cleanExam && normSub ? `${cleanExam}-${normSub}` : null,
        effectiveUnitNum || null,
      ]
    );
    return res.rows;
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
    // Generate readable deterministic lesson id
    const customId = `unit-${data.unit_id}-class-${data.standard_number}-l${data.lesson_number.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now().toString(36)}`;
    const res = await pool.query(
      `INSERT INTO syllabus_lessons (
        id, unit_id, exam_id, subject_id, standard_number, lesson_number,
        title, term, description, status, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        customId,
        data.unit_id,
        data.exam_id.toLowerCase().trim(),
        data.subject_id.toLowerCase().trim(),
        data.standard_number,
        data.lesson_number.trim(),
        data.title.trim(),
        data.term?.trim() || 'Term 1',
        data.description?.trim() || null,
        data.status || 'Available',
        data.display_order ?? 0,
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

  static async deleteLesson(id: string, force: boolean = false): Promise<{ success: boolean; message?: string; dependencies?: { topics: number; notes: number; questions: number } }> {
    const topicsRes = await pool.query('SELECT COUNT(*)::int AS count FROM syllabus_topics WHERE lesson_id = $1', [id]);
    const topicsCount = topicsRes.rows[0]?.count || 0;

    const notesRes = await pool.query('SELECT COUNT(*)::int AS count FROM study_notes WHERE lesson_id = $1', [id]);
    const notesCount = notesRes.rows[0]?.count || 0;

    const questionsRes = await pool.query('SELECT COUNT(*)::int AS count FROM questions WHERE lesson_id = $1', [id]);
    const questionsCount = questionsRes.rows[0]?.count || 0;

    if (!force && (topicsCount > 0 || notesCount > 0 || questionsCount > 0)) {
      return {
        success: false,
        message: `Cannot delete Lesson "${id}". Active dependencies found: ${topicsCount} topics, ${notesCount} study notes, ${questionsCount} questions. Remove or reassign them first, or confirm force delete.`,
        dependencies: {
          topics: topicsCount,
          notes: notesCount,
          questions: questionsCount,
        },
      };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM syllabus_topics WHERE lesson_id = $1', [id]);
      const res = await client.query('DELETE FROM syllabus_lessons WHERE id = $1', [id]);
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
  // TOPICS CRUD
  // =========================================================================
  static async getTopics(
    lessonIdOrTitle: string,
    options?: { unitId?: number; lessonTitle?: string }
  ): Promise<TopicRecord[]> {
    const term = (lessonIdOrTitle || '').trim();
    const titleTerm = (options?.lessonTitle || term).trim();
    const unitId = options?.unitId;

    const res = await pool.query(
      `SELECT t.*,
              (SELECT COUNT(*)::int FROM study_notes sn WHERE sn.topic_id = t.id::text OR LOWER(sn.topic) = LOWER(t.topic_name)) as notes_count,
              (SELECT id FROM study_notes sn WHERE sn.topic_id = t.id::text OR LOWER(sn.topic) = LOWER(t.topic_name) LIMIT 1) as notes_id
       FROM syllabus_topics t
       WHERE (
         -- Exact or case-insensitive match on t.lesson_id
         t.lesson_id = $1
         OR LOWER(t.lesson_id) = LOWER($1)
         -- Or match lesson_id via syllabus_lessons id or title
         OR t.lesson_id IN (
           SELECT id FROM syllabus_lessons 
           WHERE id = $1 
              OR LOWER(TRIM(title)) = LOWER(TRIM($1)) 
              OR LOWER(TRIM(title)) = LOWER(TRIM($2))
              OR ($3::int IS NOT NULL AND unit_id = $3 AND (LOWER(TRIM(title)) = LOWER(TRIM($1)) OR LOWER(TRIM(title)) = LOWER(TRIM($2))))
         )
         -- Or if unitId is specified and matches t.unit_id
         OR ($3::int IS NOT NULL AND t.unit_id = $3 AND (
           t.lesson_id IN (
             SELECT id FROM syllabus_lessons 
             WHERE unit_id = $3 AND (LOWER(TRIM(title)) = LOWER(TRIM($1)) OR LOWER(TRIM(title)) = LOWER(TRIM($2)))
           )
         ))
       )
         AND t.is_active = true
       ORDER BY t.display_order ASC, t.id ASC`,
      [term, titleTerm, unitId || null]
    );
    return res.rows.map((r) => ({
      ...r,
      has_notes: (r.notes_count || 0) > 0,
    }));
  }

  static async createTopic(data: {
    lesson_id: string;
    unit_id: number;
    topic_name: string;
    description?: string;
    display_order?: number;
  }): Promise<TopicRecord> {
    const res = await pool.query(
      `INSERT INTO syllabus_topics (lesson_id, unit_id, topic_name, description, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.lesson_id,
        data.unit_id,
        data.topic_name.trim(),
        data.description?.trim() || null,
        data.display_order ?? 0,
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

  static async deleteTopic(id: number, force: boolean = false): Promise<{ success: boolean; message?: string; dependencies?: { notes: number; questions: number } }> {
    const notesRes = await pool.query('SELECT COUNT(*)::int AS count FROM study_notes WHERE topic_id = $1::text', [id]);
    const notesCount = notesRes.rows[0]?.count || 0;

    const questionsRes = await pool.query('SELECT COUNT(*)::int AS count FROM questions WHERE topic_id = $1::text', [id]);
    const questionsCount = questionsRes.rows[0]?.count || 0;

    if (!force && (notesCount > 0 || questionsCount > 0)) {
      return {
        success: false,
        message: `Cannot delete Topic #${id}. Active dependencies found: ${notesCount} study notes, ${questionsCount} questions. Remove or reassign them first, or confirm force delete.`,
        dependencies: {
          notes: notesCount,
          questions: questionsCount,
        },
      };
    }

    const res = await pool.query('DELETE FROM syllabus_topics WHERE id = $1', [id]);
    return { success: (res.rowCount ?? 0) > 0 };
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
      // Update existing
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
      // Insert new
      const res = await pool.query(
        `INSERT INTO study_notes (
          category, subject, class_id, unit_id, lesson_id, lesson_number,
          lesson_title, topic, topic_id, title, content, content_html,
          language, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          data.exam_id.toLowerCase().trim(),
          data.subject.toLowerCase().trim(),
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
    let normSub = subjectId.toLowerCase().trim();
    if (normSub.startsWith(`${cleanExam}-`)) {
      normSub = normSub.slice(`${cleanExam}-`.length);
    }

    // 1. Fetch units
    const unitsRes = await pool.query(
      `SELECT u.*
       FROM syllabus_units u
       WHERE (u.exam_id = $1 OR ($1 = 'group2a' AND u.exam_id = 'group2') OR ($1 = 'group2' AND u.exam_id = 'group2a'))
         AND (u.subject_id = $2 OR u.subject_id = $4 OR u.subject_id = 'all')
         AND ($3::int IS NULL OR u.unit_number = $3)
         AND u.is_active = true
       ORDER BY u.display_order ASC, u.unit_number ASC`,
      [cleanExam, normSub, unitNumber || null, `${cleanExam}-${normSub}`]
    );

    const units = unitsRes.rows;
    if (units.length === 0) {
      return [];
    }

    // 2. Fetch all lessons belonging to these units
    const unitIds = units.map((u) => u.id);
    const lessonsRes = await pool.query(
      `SELECT l.*,
              (SELECT COUNT(*)::int FROM syllabus_topics t WHERE t.lesson_id = l.id) as topics_count,
              EXISTS (SELECT 1 FROM study_notes sn WHERE sn.lesson_id = l.id OR LOWER(sn.lesson_title) = LOWER(l.title)) as has_notes
       FROM syllabus_lessons l
       WHERE l.unit_id = ANY($1::int[])
         AND ($2::int IS NULL OR l.standard_number = $2)
         AND l.is_active = true
       ORDER BY l.display_order ASC, l.lesson_number ASC`,
      [unitIds, standardNumber || null]
    );

    const lessons = lessonsRes.rows;
    const lessonIds = lessons.map((l) => l.id);

    // 3. Fetch all topics for these lessons
    let topics: any[] = [];
    if (lessonIds.length > 0) {
      const topicsRes = await pool.query(
        `SELECT t.*,
                (SELECT id FROM study_notes sn WHERE sn.topic_id = t.id::text OR LOWER(sn.topic) = LOWER(t.topic_name) LIMIT 1) as notes_id,
                EXISTS (SELECT 1 FROM study_notes sn WHERE sn.topic_id = t.id::text OR LOWER(sn.topic) = LOWER(t.topic_name)) as has_notes
         FROM syllabus_topics t
         WHERE t.lesson_id = ANY($1::text[])
           AND t.is_active = true
         ORDER BY t.display_order ASC, t.id ASC`,
        [lessonIds]
      );
      topics = topicsRes.rows;
    }

    // 4. Assemble complete nested tree
    return units.map((u) => {
      const unitLessons = lessons
        .filter((l) => l.unit_id === u.id)
        .map((l) => {
          const lessonTopics = topics.filter((t) => t.lesson_id === l.id);
          return {
            ...l,
            topics: lessonTopics,
          };
        });

      return {
        ...u,
        lessons: unitLessons,
      };
    });
  }
}
