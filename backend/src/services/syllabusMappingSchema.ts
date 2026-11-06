/**
 * syllabusMappingSchema.ts
 *
 * Database schema and migration helper for TNPSC Complete Syllabus to Textbook Mapping System.
 * Creates and verifies:
 * - tnpsc_syllabus_topics (All official TNPSC General Studies topics for Units I-VI)
 * - syllabus_topic_mappings (Many-to-many relationship linking TNPSC topics to Standards 6th-12th, Subjects, Lessons, and Subtopics)
 * - syllabus_import_jobs (Audit trail of import jobs and validation scores)
 * - syllabus_validation_reports (Full audit report per exam/unit)
 */

import pool from '../db';

export async function ensureSyllabusMappingSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Master TNPSC Syllabus Topics
    await client.query(`
      CREATE TABLE IF NOT EXISTS tnpsc_syllabus_topics (
        id VARCHAR(120) PRIMARY KEY,
        exam_id VARCHAR(50) NOT NULL,
        unit_number INT NOT NULL,
        unit_title TEXT NOT NULL,
        topic_name TEXT NOT NULL,
        topic_code VARCHAR(50),
        is_current_affairs BOOLEAN DEFAULT false,
        display_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_tnpsc_syllabus_topics_lookup 
        ON tnpsc_syllabus_topics (exam_id, unit_number, display_order);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tnpsc_syllabus_topics_uniq 
        ON tnpsc_syllabus_topics (exam_id, unit_number, topic_name);
    `);

    // 2. Many-to-Many Mappings: TNPSC Topic -> Standard (6th-12th) -> Subject -> Textbook Unit -> Lesson -> Subtopics
    await client.query(`
      CREATE TABLE IF NOT EXISTS syllabus_topic_mappings (
        id SERIAL PRIMARY KEY,
        syllabus_topic_id VARCHAR(120) REFERENCES tnpsc_syllabus_topics(id) ON DELETE CASCADE,
        exam_id VARCHAR(50) NOT NULL,
        unit_number INT NOT NULL,
        standard_number INT NOT NULL,
        subject_name TEXT NOT NULL,
        term VARCHAR(50) DEFAULT 'Term 1',
        textbook_unit_title TEXT,
        textbook_material_id INT,
        lesson_id VARCHAR(120),
        lesson_number VARCHAR(50) NOT NULL,
        lesson_title TEXT NOT NULL,
        subtopics JSONB DEFAULT '[]'::jsonb,
        mapping_status VARCHAR(50) NOT NULL DEFAULT 'FULLY MAPPED',
        confidence_score NUMERIC(5,2) DEFAULT 100.0,
        verification_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_syllabus_topic_mappings_topic 
        ON syllabus_topic_mappings (syllabus_topic_id);
      CREATE INDEX IF NOT EXISTS idx_syllabus_topic_mappings_hierarchy 
        ON syllabus_topic_mappings (exam_id, unit_number, standard_number, subject_name);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_syllabus_topic_mappings_uniq 
        ON syllabus_topic_mappings (syllabus_topic_id, standard_number, subject_name, lesson_number, lesson_title);
    `);

    // 3. Syllabus Import Jobs (Tracks execution, parameters, counts, and status)
    await client.query(`
      CREATE TABLE IF NOT EXISTS syllabus_import_jobs (
        id VARCHAR(80) PRIMARY KEY,
        exam_id VARCHAR(50) NOT NULL,
        unit_number INT,
        target_standards JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(50) NOT NULL DEFAULT 'completed',
        total_topics INT DEFAULT 0,
        fully_mapped_topics INT DEFAULT 0,
        partially_mapped_topics INT DEFAULT 0,
        missing_topics INT DEFAULT 0,
        current_affairs_topics INT DEFAULT 0,
        total_lessons INT DEFAULT 0,
        total_subtopics INT DEFAULT 0,
        audit_summary JSONB DEFAULT '{}'::jsonb,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Syllabus Validation & Coverage Reports
    await client.query(`
      CREATE TABLE IF NOT EXISTS syllabus_validation_reports (
        id SERIAL PRIMARY KEY,
        exam_id VARCHAR(50) NOT NULL,
        unit_number INT NOT NULL,
        report_data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_syllabus_val_reports 
        ON syllabus_validation_reports (exam_id, unit_number);
    `);

    await client.query('COMMIT');
    console.log('[SyllabusMapping] Schema tables and indexes verified successfully.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[SyllabusMapping] Failed to ensure schema:', err);
    throw err;
  } finally {
    client.release();
  }
}

