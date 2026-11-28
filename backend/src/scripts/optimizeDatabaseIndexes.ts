import dotenv from 'dotenv';
import path from 'path';
import pool from '../db';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Production-safe PostgreSQL Performance Index Optimizer for TNPSC Aspirant Orbit.
 * - Uses CREATE INDEX CONCURRENTLY IF NOT EXISTS (outside any transaction block) so live
 *   reads & writes are never locked.
 * - Removes verified duplicate indexes to reduce write amplification and memory footprint.
 * - Enables pg_trgm for fast GIN trigram search on textbooks, questions, and syllabus_topics.
 * - Runs ANALYZE on updated tables so the PostgreSQL planner immediately adopts new indexes.
 */

const DUPLICATE_INDEXES_TO_DROP: Array<{ name: string; reason: string }> = [
  {
    name: 'idx_textbooks_drive_file_id_unique',
    reason: 'Exact duplicate of uq_textbooks_google_drive_file_id on textbooks(google_drive_file_id)',
  },
  {
    name: 'idx_visitor_sessions_id',
    reason: 'Exact duplicate of visitor_sessions_session_id_key on visitor_sessions(session_id)',
  },
];

const TARGETED_INDEX_STATEMENTS: Array<{ name: string; table: string; sql: string }> = [
  {
    name: 'idx_questions_pub_created',
    table: 'questions',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_pub_created
          ON questions (created_at DESC)
          WHERE status = 'published'`,
  },
  {
    name: 'idx_questions_pub_hierarchy',
    table: 'questions',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_pub_hierarchy
          ON questions (exam_group_id, subject_id, standard_id, unit_id, lesson_id)
          WHERE status = 'published'`,
  },
  {
    name: 'idx_questions_text_trgm',
    table: 'questions',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_text_trgm
          ON questions USING gin (question_text gin_trgm_ops)`,
  },
  {
    name: 'idx_textbooks_pub_med_std_subj',
    table: 'textbooks',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_textbooks_pub_med_std_subj
          ON textbooks (medium, standard, subject)
          WHERE publication_status = 'published' AND deleted_at IS NULL`,
  },
  {
    name: 'idx_textbooks_search_trgm',
    table: 'textbooks',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_textbooks_search_trgm
          ON textbooks USING gin ((COALESCE(book_name, '') || ' ' || COALESCE(subject, '')) gin_trgm_ops)`,
  },
  {
    name: 'idx_mock_tests_pub_group_cat',
    table: 'mock_tests',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mock_tests_pub_group_cat
          ON mock_tests (tnpsc_group, test_category, created_at DESC)
          WHERE status = 'published'`,
  },
  {
    name: 'idx_question_attempts_student_attempted',
    table: 'question_attempts',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_attempts_student_attempted
          ON question_attempts (student_id, attempted_at DESC)`,
  },
  {
    name: 'idx_question_attempts_student_qid',
    table: 'question_attempts',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_attempts_student_qid
          ON question_attempts (student_id, question_id)`,
  },
  {
    name: 'idx_mock_attempts_student_created',
    table: 'mock_test_attempts',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mock_attempts_student_created
          ON mock_test_attempts (student_id, created_at DESC)`,
  },
  {
    name: 'idx_study_sessions_student_started',
    table: 'study_sessions',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_sessions_student_started
          ON study_sessions (student_id, started_at DESC)`,
  },
  {
    name: 'idx_student_auth_sessions_active_lookup',
    table: 'student_auth_sessions',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_auth_sessions_active_lookup
          ON student_auth_sessions (student_id, created_at DESC)
          WHERE session_status = 'active'`,
  },
  {
    name: 'idx_pyp_status_cat_year',
    table: 'previous_year_papers',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pyp_status_cat_year
          ON previous_year_papers (status, category, year DESC)`,
  },
  {
    name: 'idx_syllabus_topics_name_trgm',
    table: 'syllabus_topics',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_syllabus_topics_name_trgm
          ON syllabus_topics USING gin (topic_name gin_trgm_ops)`,
  },
  {
    name: 'idx_study_notes_pub_lookup',
    table: 'study_notes',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_notes_pub_lookup
          ON study_notes (category, subject, class_id, unit_id, lesson_id)
          WHERE status = 'published'`,
  },
];

export async function runDatabasePerformanceOptimization(): Promise<{
  trgmEnabled: boolean;
  droppedDuplicates: string[];
  createdIndexes: string[];
  skipped: Array<{ name: string; reason: string }>;
  analyzedTables: string[];
}> {
  let trgmEnabled = false;
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    trgmEnabled = true;
  } catch (err: any) {
    console.warn('[DB Optimize] pg_trgm extension unavailable:', err?.message);
  }

  const droppedDuplicates: string[] = [];
  for (const dup of DUPLICATE_INDEXES_TO_DROP) {
    try {
      await pool.query(`DROP INDEX CONCURRENTLY IF EXISTS ${dup.name}`);
      droppedDuplicates.push(dup.name);
    } catch (err: any) {
      console.warn(`[DB Optimize] Could not drop ${dup.name}:`, err?.message);
    }
  }

  const createdIndexes: string[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const touchedTables = new Set<string>();

  for (const idx of TARGETED_INDEX_STATEMENTS) {
    if (!trgmEnabled && idx.sql.includes('gin_trgm_ops')) {
      skipped.push({ name: idx.name, reason: 'pg_trgm extension not enabled' });
      continue;
    }
    try {
      await pool.query(idx.sql);
      createdIndexes.push(idx.name);
      touchedTables.add(idx.table);
    } catch (err: any) {
      skipped.push({ name: idx.name, reason: err?.message || 'Unknown error' });
    }
  }

  const analyzedTables: string[] = [];
  for (const tbl of touchedTables) {
    try {
      await pool.query(`ANALYZE ${tbl}`);
      analyzedTables.push(tbl);
    } catch {
      // ignore analyze errors
    }
  }

  return { trgmEnabled, droppedDuplicates, createdIndexes, skipped, analyzedTables };
}

if (require.main === module) {
  runDatabasePerformanceOptimization()
    .then((res) => {
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[DB Optimize] Fatal error:', err);
      process.exit(1);
    });
}
