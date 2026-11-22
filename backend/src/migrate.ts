import pool from './db';

export async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Running database migration for TNPSC Quiz...');
    
    await client.query('BEGIN');

    // 1. Create questions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        category TEXT NOT NULL DEFAULT 'group1',
        unit_id INT NOT NULL,
        class_id INT,
        subject TEXT NOT NULL,
        lesson_title TEXT NOT NULL,
        topic TEXT,
        difficulty VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
        tag TEXT,
        question_text TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_answer INT NOT NULL CHECK (correct_answer >= 0 AND correct_answer <= 3),
        explanation TEXT NOT NULL,
        source_reference TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('staging', 'published', 'archived')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_lesson_question UNIQUE (lesson_title, question_text)
      );
    `);

    // 2. Create admin_users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(150) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'admin',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Create study_notes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS study_notes (
        id SERIAL PRIMARY KEY,
        category TEXT NOT NULL DEFAULT 'group1',
        unit_id INT NOT NULL,
        class_id INT,
        subject TEXT NOT NULL,
        lesson_id TEXT,
        lesson_number TEXT,
        lesson_title TEXT NOT NULL,
        topic TEXT,
        language VARCHAR(10) NOT NULL DEFAULT 'english' CHECK (language IN ('tamil', 'english')),
        title TEXT,
        content TEXT NOT NULL,
        content_html TEXT,
        tags JSONB,
        status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('staging', 'published', 'archived')),
        source_reference TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure lesson_id, lesson_number, term, lesson_code, coverage_report, topics, deduplication, topic_order, and generation_meta columns exist
    await client.query(`
      ALTER TABLE study_notes ADD COLUMN IF NOT EXISTS lesson_id TEXT;
      ALTER TABLE study_notes ADD COLUMN IF NOT EXISTS lesson_number TEXT;
      ALTER TABLE study_notes ADD COLUMN IF NOT EXISTS term TEXT DEFAULT 'Term 1';
      ALTER TABLE study_notes ADD COLUMN IF NOT EXISTS lesson_code TEXT;
      ALTER TABLE study_notes ADD COLUMN IF NOT EXISTS coverage_report JSONB;
      ALTER TABLE study_notes ADD COLUMN IF NOT EXISTS topics JSONB;
      ALTER TABLE study_notes ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);
      ALTER TABLE study_notes ADD COLUMN IF NOT EXISTS deduplication_meta JSONB;
      ALTER TABLE study_notes ADD COLUMN IF NOT EXISTS topic_order INT DEFAULT 0;
      ALTER TABLE study_notes ADD COLUMN IF NOT EXISTS topic_id TEXT;
      ALTER TABLE study_notes ADD COLUMN IF NOT EXISTS subtopics JSONB;
      ALTER TABLE study_notes ADD COLUMN IF NOT EXISTS generation_status TEXT DEFAULT 'completed';
      ALTER TABLE study_notes ADD COLUMN IF NOT EXISTS generation_meta JSONB;
      ALTER TABLE study_notes ADD COLUMN IF NOT EXISTS note_format VARCHAR(20) DEFAULT 'short' CHECK (note_format IN ('short', 'full'));
      CREATE INDEX IF NOT EXISTS idx_study_notes_format ON study_notes (note_format);
      CREATE INDEX IF NOT EXISTS idx_study_notes_content_hash ON study_notes (content_hash);
      CREATE INDEX IF NOT EXISTS idx_study_notes_lesson_status ON study_notes (category, subject, unit_id, lesson_id, status);
      CREATE INDEX IF NOT EXISTS idx_study_notes_term ON study_notes (term);
      CREATE INDEX IF NOT EXISTS idx_study_notes_lesson_code ON study_notes (lesson_code);
      CREATE INDEX IF NOT EXISTS idx_study_notes_composite_lesson ON study_notes (category, subject, class_id, unit_id, lesson_number, term);
      CREATE INDEX IF NOT EXISTS idx_study_notes_topic_order ON study_notes (lesson_code, topic_order);
      CREATE INDEX IF NOT EXISTS idx_study_notes_topic_id ON study_notes (topic_id);
      CREATE INDEX IF NOT EXISTS idx_study_notes_lesson_topic ON study_notes (category, subject, class_id, unit_id, lesson_id, topic_id, note_format);
    `);

    // Backfill term for existing study notes
    await client.query(`
      UPDATE study_notes
      SET term = CASE
        WHEN source_reference ILIKE '%term 2%' THEN 'Term 2'
        WHEN source_reference ILIKE '%term 3%' THEN 'Term 3'
        WHEN source_reference ILIKE '%full year%' THEN 'Full Year'
        ELSE COALESCE(term, 'Term 1')
      END
      WHERE term IS NULL OR term = '';
    `);

    // Backfill lesson_code for all study notes missing lesson_code
    await client.query(`
      UPDATE study_notes
      SET lesson_code = LOWER(
        CONCAT(
          REGEXP_REPLACE(category, '[^a-zA-Z0-9]', '', 'g'),
          '_std',
          COALESCE(class_id, 6),
          '_',
          REGEXP_REPLACE(subject, '[^a-zA-Z0-9]', '', 'g'),
          '_',
          REGEXP_REPLACE(COALESCE(term, 'Term 1'), '[^a-zA-Z0-9]', '', 'g'),
          '_u',
          unit_id,
          '_l',
          COALESCE(lesson_number, '1.1')
        )
      )
      WHERE lesson_code IS NULL OR lesson_code = '';
    `);

    // Safe backfill for existing Study Notes missing lesson_id or syllabus IDs.
    // Status is intentionally left untouched: notes are only published by an explicit admin action.
    await client.query(`
      UPDATE study_notes
      SET 
        lesson_id = 'gt-1-6-t1-l1',
        lesson_number = '1.1',
        lesson_title = '6-ஆம் வகுப்பு (பருவம் 1): எழுத்து இலக்கணம், வகை, தொகை & மாத்திரை அளவுகள்'
      WHERE 
        unit_id = 1 
        AND (class_id = 6 OR class_id IS NULL)
        AND (LOWER(subject) LIKE '%tamil%' OR LOWER(category) LIKE '%group2%')
        AND (lesson_title LIKE '%எழுத்து இலக்கணம்%' OR lesson_title LIKE '%1.1%' OR lesson_id = 'gt-1-6-t1-l1' OR lesson_number = '1.1');
    `);

    // 4. Create textbooks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS textbooks (
        id SERIAL PRIMARY KEY,
        group_id TEXT NOT NULL,
        standard INT NOT NULL,
        subject TEXT NOT NULL,
        medium VARCHAR(20) NOT NULL DEFAULT 'English' CHECK (medium IN ('Tamil', 'English')),
        term TEXT DEFAULT 'Full Year',
        book_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size BIGINT NOT NULL,
        page_count INT DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'completed', 'failed')),
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_textbook_spec UNIQUE (group_id, standard, subject, medium, term, book_name)
      );
    `);

    // 5. Create textbook_content table
    await client.query(`
      CREATE TABLE IF NOT EXISTS textbook_content (
        id SERIAL PRIMARY KEY,
        textbook_id INT NOT NULL REFERENCES textbooks(id) ON DELETE CASCADE,
        page_number INT NOT NULL,
        unit_id INT,
        unit_title TEXT,
        lesson_title TEXT,
        topic TEXT,
        content TEXT NOT NULL,
        text_length INT NOT NULL,
        is_ocr BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Create textbook_processing_jobs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS textbook_processing_jobs (
        id SERIAL PRIMARY KEY,
        textbook_id INT NOT NULL REFERENCES textbooks(id) ON DELETE CASCADE,
        status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'extracting', 'indexing', 'completed', 'failed')),
        progress_percent INT DEFAULT 0,
        step_description TEXT,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Add textbook references to questions table safely if not already present
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'questions' AND column_name = 'textbook_id'
        ) THEN
          ALTER TABLE questions ADD COLUMN textbook_id INT REFERENCES textbooks(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'questions' AND column_name = 'source_page'
        ) THEN
          ALTER TABLE questions ADD COLUMN source_page INT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'questions' AND column_name = 'verification_status'
        ) THEN
          ALTER TABLE questions ADD COLUMN verification_status VARCHAR(30) DEFAULT 'needs_review' CHECK (verification_status IN ('verified', 'needs_review', 'rejected'));
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'questions' AND column_name = 'lesson_id'
        ) THEN
          ALTER TABLE questions ADD COLUMN lesson_id VARCHAR(100);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'questions' AND column_name = 'target_system'
        ) THEN
          ALTER TABLE questions ADD COLUMN target_system VARCHAR(50) NOT NULL DEFAULT 'main_practice';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'questions' AND column_name = 'language'
        ) THEN
          ALTER TABLE questions ADD COLUMN language VARCHAR(20) NOT NULL DEFAULT 'tamil';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'questions' AND column_name = 'exam_group_id'
        ) THEN
          ALTER TABLE questions ADD COLUMN exam_group_id VARCHAR(50);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'questions' AND column_name = 'subject_id'
        ) THEN
          ALTER TABLE questions ADD COLUMN subject_id VARCHAR(100);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'questions' AND column_name = 'standard_id'
        ) THEN
          ALTER TABLE questions ADD COLUMN standard_id INT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'questions' AND column_name = 'option_a'
        ) THEN
          ALTER TABLE questions ADD COLUMN option_a TEXT;
          ALTER TABLE questions ADD COLUMN option_b TEXT;
          ALTER TABLE questions ADD COLUMN option_c TEXT;
          ALTER TABLE questions ADD COLUMN option_d TEXT;
        END IF;
      END $$;
    `);

    // Independent MCQ translation cache: one row per question + target language.
    // Original questions remain the single canonical question bank; only display text is stored here.
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcq_question_translations (
        id SERIAL PRIMARY KEY,
        question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        translation_language VARCHAR(8) NOT NULL DEFAULT 'ta',
        translated_question TEXT NOT NULL,
        translated_option_a TEXT NOT NULL,
        translated_option_b TEXT NOT NULL,
        translated_option_c TEXT NOT NULL,
        translated_option_d TEXT NOT NULL,
        translated_explanation TEXT NOT NULL DEFAULT '',
        source_content_hash VARCHAR(64) NOT NULL,
        translation_status VARCHAR(20) NOT NULL DEFAULT 'approved',
        provider VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_mcq_translation_question_language UNIQUE (question_id, translation_language)
      );

      CREATE INDEX IF NOT EXISTS idx_mcq_translations_lookup
      ON mcq_question_translations (question_id, translation_language, translation_status);

      ALTER TABLE mcq_question_translations
        ADD COLUMN IF NOT EXISTS model_name VARCHAR(120),
        ADD COLUMN IF NOT EXISTS translation_version INT NOT NULL DEFAULT 1;
    `);

    // Backfill existing questions: set study_materials for textbook-grounded or lesson-mapped questions
    await client.query(`
      UPDATE questions
      SET target_system = COALESCE(target_system, 'study_materials'),
          exam_group_id = COALESCE(exam_group_id, category),
          subject_id = COALESCE(subject_id, LOWER(REPLACE(subject, ' ', '-'))),
          standard_id = COALESCE(standard_id, class_id),
          language = COALESCE(language, 'tamil'),
          lesson_id = CASE
            WHEN lesson_id IS NOT NULL AND lesson_id != '' THEN lesson_id
            WHEN (lesson_title LIKE '%எழுத்து இலக்கணம்%' OR lesson_title LIKE '%1.1%') AND class_id = 6 AND unit_id = 1 THEN 'gt-1-6-t1-l1'
            ELSE COALESCE(lesson_id, 'gt-1-6-t1-l1')
          END;

      UPDATE questions
      SET option_a = options->>0,
          option_b = options->>1,
          option_c = options->>2,
          option_d = options->>3
      WHERE option_a IS NULL AND options IS NOT NULL;
    `);

    // 8. Create indices for high-performance querying
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_questions_category_unit_status 
      ON questions (category, unit_id, status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_questions_lesson_title 
      ON questions (lesson_title);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_questions_lesson_id 
      ON questions (lesson_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_questions_category_lesson_id 
      ON questions (category, lesson_id, status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_questions_target_system 
      ON questions (target_system);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_questions_sm_lookup 
      ON questions (target_system, exam_group_id, subject_id, standard_id, unit_id, lesson_id, language, status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_questions_class_id 
      ON questions (class_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_study_notes_category_lesson 
      ON study_notes (category, lesson_title, status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_study_notes_lesson_id 
      ON study_notes (lesson_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_study_notes_lookup 
      ON study_notes (category, subject, class_id, unit_id, lesson_id, status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_textbooks_lookup 
      ON textbooks (group_id, standard, subject, medium);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_textbook_content_search 
      ON textbook_content (textbook_id, page_number);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_textbook_content_lesson 
      ON textbook_content (unit_id, lesson_title);
    `);

    // 8. Create google_drive_tokens table for persistent Google OAuth token management
    await client.query(`
      CREATE TABLE IF NOT EXISTS google_drive_tokens (
        id SERIAL PRIMARY KEY,
        account_email VARCHAR(255),
        refresh_token TEXT NOT NULL,
        access_token TEXT,
        expiry_date BIGINT,
        folder_id VARCHAR(150),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. Create google_drive_materials table for PDF metadata storage
    await client.query(`
      CREATE TABLE IF NOT EXISTS google_drive_materials (
        id SERIAL PRIMARY KEY,
        file_name TEXT NOT NULL,
        original_file_name TEXT NOT NULL,
        mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
        file_size BIGINT NOT NULL,
        google_drive_file_id VARCHAR(150) NOT NULL UNIQUE,
        google_drive_folder_id TEXT,
        tnpsc_group TEXT NOT NULL,
        subject TEXT NOT NULL,
        standard INT,
        term TEXT DEFAULT 'Term 1',
        unit INT,
        lesson TEXT,
        lesson_id TEXT,
        upload_status VARCHAR(30) NOT NULL DEFAULT 'completed' CHECK (upload_status IN ('initiating', 'uploading', 'completed', 'failed')),
        uploaded_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_gdrive_materials_group_subject 
      ON google_drive_materials (tnpsc_group, subject, standard, unit);

      CREATE INDEX IF NOT EXISTS idx_gdrive_materials_file_id 
      ON google_drive_materials (google_drive_file_id);

      CREATE INDEX IF NOT EXISTS idx_gdrive_materials_lesson 
      ON google_drive_materials (lesson_id);

      CREATE INDEX IF NOT EXISTS idx_gdrive_materials_status 
      ON google_drive_materials (upload_status);

      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS extracted_text TEXT;
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS extracted_pages JSONB;
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS page_count INT;
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS file_checksum VARCHAR(64);
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS applicable_groups JSONB DEFAULT '["group1", "group2", "group4"]'::jsonb;
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS medium VARCHAR(20) DEFAULT 'Tamil';
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS volume TEXT;
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS extracted_toc JSONB;
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS classification_meta JSONB;
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS confidence_score INT DEFAULT 100;
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS batch_id VARCHAR(100);
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(30) DEFAULT 'PENDING';
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(30) DEFAULT 'direct_text';
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS total_pages INT DEFAULT 0;
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS failed_pages INT DEFAULT 0;
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS extraction_error TEXT;
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMP WITH TIME ZONE;

      CREATE INDEX IF NOT EXISTS idx_gdrive_materials_checksum ON google_drive_materials (file_checksum);
      CREATE INDEX IF NOT EXISTS idx_gdrive_materials_batch_id ON google_drive_materials (batch_id);
      CREATE INDEX IF NOT EXISTS idx_gdrive_materials_medium ON google_drive_materials (medium);
      CREATE INDEX IF NOT EXISTS idx_gdrive_materials_applicable_groups ON google_drive_materials USING GIN (applicable_groups);
      CREATE INDEX IF NOT EXISTS idx_gdrive_materials_extraction_status ON google_drive_materials (extraction_status);

      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS volume TEXT;
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS pdf_type VARCHAR(30) DEFAULT 'UNKNOWN';
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS native_pages INT DEFAULT 0;
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS ocr_pages INT DEFAULT 0;
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS failed_pages INT DEFAULT 0;
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS completion_percentage INT DEFAULT 0;
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(30) DEFAULT 'PENDING';
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(30) DEFAULT 'native';
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS total_pages INT DEFAULT 0;
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS extraction_error TEXT;
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS google_drive_file_id VARCHAR(255);
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS unit INT;
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS lesson TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_textbooks_google_drive_file_id
        ON textbooks (google_drive_file_id)
        WHERE google_drive_file_id IS NOT NULL;

      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS pdf_type VARCHAR(30) DEFAULT 'UNKNOWN';
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS native_pages INT DEFAULT 0;
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS ocr_pages INT DEFAULT 0;
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS completion_percentage INT DEFAULT 0;
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'ACTIVE';
      ALTER TABLE google_drive_materials ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;
      CREATE INDEX IF NOT EXISTS idx_gdrive_materials_sync_status ON google_drive_materials (sync_status);

      CREATE TABLE IF NOT EXISTS google_drive_sync_logs (
        id SERIAL PRIMARY KEY,
        folder_id TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
        total_drive_files INT DEFAULT 0,
        inserted_count INT DEFAULT 0,
        updated_count INT DEFAULT 0,
        missing_count INT DEFAULT 0,
        duplicate_drive_names INT DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE
      );

      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(30) DEFAULT 'native';
      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC(5,2) DEFAULT NULL;
      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(30) DEFAULT 'completed';
      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS extraction_error TEXT DEFAULT NULL;
      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS processing_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS file_name TEXT DEFAULT NULL;
      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS standard INT DEFAULT NULL;
      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT NULL;
      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS term TEXT DEFAULT NULL;
      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS material_id INT DEFAULT NULL;
      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS lesson_id TEXT DEFAULT NULL;
      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS medium VARCHAR(30) DEFAULT NULL;
      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS chapter_title TEXT DEFAULT NULL;
      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS indexing_status VARCHAR(30) DEFAULT 'pending';
      ALTER TABLE textbook_content ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
      CREATE INDEX IF NOT EXISTS idx_textbook_content_lesson_id ON textbook_content (lesson_id);
      CREATE INDEX IF NOT EXISTS idx_textbook_content_tb_status ON textbook_content (textbook_id, extraction_status, indexing_status);
      CREATE INDEX IF NOT EXISTS idx_textbook_content_std_subj_med ON textbook_content (standard, subject, medium);

      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS indexed_pages INT DEFAULT 0;
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS indexing_status VARCHAR(30) DEFAULT 'PENDING';
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS indexed_lessons_count INT DEFAULT 0;
      ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS last_indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

      CREATE TABLE IF NOT EXISTS textbook_indexing_jobs (
        job_id VARCHAR(64) PRIMARY KEY,
        job_type VARCHAR(40) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        total_items INT DEFAULT 0,
        processed_items INT DEFAULT 0,
        succeeded_items INT DEFAULT 0,
        failed_items INT DEFAULT 0,
        cursor_textbook_id INT DEFAULT 0,
        filters JSONB DEFAULT '{}'::jsonb,
        summary JSONB DEFAULT '{}'::jsonb,
        error_logs JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_textbook_indexing_jobs_status ON textbook_indexing_jobs (status, created_at DESC);

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_textbook_content_page'
        ) THEN
          ALTER TABLE textbook_content ADD CONSTRAINT uq_textbook_content_page UNIQUE (textbook_id, page_number);
        END IF;
      END $$;
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS term TEXT;
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS volume TEXT;
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_pdf TEXT;
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS lesson_number TEXT;
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS normalized_question_hash VARCHAR(64);
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS concept_fingerprint VARCHAR(128);
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS duplicate_check_status VARCHAR(30) DEFAULT 'passed';
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS generation_batch_id VARCHAR(80);
      CREATE INDEX IF NOT EXISTS idx_questions_norm_hash ON questions (normalized_question_hash);
      CREATE INDEX IF NOT EXISTS idx_questions_concept_fp ON questions (concept_fingerprint);
      CREATE INDEX IF NOT EXISTS idx_questions_textbook_lesson ON questions (textbook_id, lesson_title);
      CREATE INDEX IF NOT EXISTS idx_questions_gen_batch ON questions (generation_batch_id);

      UPDATE textbooks SET volume = term
      WHERE volume IS NULL AND term ~* '^volume\\s*[0-9]+';

      UPDATE google_drive_materials SET volume = term
      WHERE volume IS NULL AND term ~* '^volume\\s*[0-9]+';

      -- 10. Create bulk_upload_batches table for tracking bulk upload processing batches
      CREATE TABLE IF NOT EXISTS bulk_upload_batches (
        id SERIAL PRIMARY KEY,
        batch_id VARCHAR(100) UNIQUE NOT NULL,
        total_files INT NOT NULL DEFAULT 0,
        completed_files INT DEFAULT 0,
        failed_files INT DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'partial_failure', 'failed')),
        created_by VARCHAR(150),
        summary JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_bulk_batches_batch_id ON bulk_upload_batches (batch_id);

      -- 11. Create pdf_extractions table for comprehensive tracking of PDF extraction runs
      CREATE TABLE IF NOT EXISTS pdf_extractions (
        id SERIAL PRIMARY KEY,
        material_id INT REFERENCES google_drive_materials(id) ON DELETE CASCADE,
        textbook_id INT REFERENCES textbooks(id) ON DELETE SET NULL,
        file_name TEXT NOT NULL,
        google_drive_file_id VARCHAR(150),
        extraction_status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (extraction_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED')),
        extraction_method VARCHAR(30) NOT NULL DEFAULT 'direct_text' CHECK (extraction_method IN ('direct_text', 'ocr', 'hybrid')),
        total_pages INT NOT NULL DEFAULT 0,
        extracted_pages INT NOT NULL DEFAULT 0,
        failed_pages INT NOT NULL DEFAULT 0,
        extracted_text TEXT,
        pages_data JSONB,
        extraction_error TEXT,
        extracted_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_pdf_extractions_material ON pdf_extractions (material_id);
      CREATE INDEX IF NOT EXISTS idx_pdf_extractions_textbook ON pdf_extractions (textbook_id);
      CREATE INDEX IF NOT EXISTS idx_pdf_extractions_status ON pdf_extractions (extraction_status);

      -- Durable resume cursor + real per-method metrics for the extraction job.
      ALTER TABLE pdf_extractions ADD COLUMN IF NOT EXISTS next_page INT DEFAULT 1;
      ALTER TABLE pdf_extractions ADD COLUMN IF NOT EXISTS native_pages INT DEFAULT 0;
      ALTER TABLE pdf_extractions ADD COLUMN IF NOT EXISTS ocr_pages INT DEFAULT 0;
      ALTER TABLE pdf_extractions ADD COLUMN IF NOT EXISTS pdf_type VARCHAR(30) DEFAULT 'UNKNOWN';
      ALTER TABLE pdf_extractions ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
      ALTER TABLE pdf_extractions ADD COLUMN IF NOT EXISTS max_retries INT DEFAULT 3;
      ALTER TABLE pdf_extractions ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE pdf_extractions ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP WITH TIME ZONE;

      -- 12. Safe Schema Widening Migration: Widen VARCHAR columns to TEXT
      -- Eliminates PostgreSQL error 22001 (value too long for type character varying(255))
      -- across long filenames, lesson titles, Tamil topics, and detailed source references.
      DO $$
      BEGIN
        -- study_notes
        ALTER TABLE study_notes ALTER COLUMN source_reference TYPE TEXT;
        ALTER TABLE study_notes ALTER COLUMN title TYPE TEXT;
        ALTER TABLE study_notes ALTER COLUMN topic TYPE TEXT;
        ALTER TABLE study_notes ALTER COLUMN lesson_title TYPE TEXT;
        ALTER TABLE study_notes ALTER COLUMN lesson_id TYPE TEXT;
        ALTER TABLE study_notes ALTER COLUMN lesson_number TYPE TEXT;
        ALTER TABLE study_notes ALTER COLUMN lesson_code TYPE TEXT;
        ALTER TABLE study_notes ALTER COLUMN topic_id TYPE TEXT;
        ALTER TABLE study_notes ALTER COLUMN subject TYPE TEXT;
        ALTER TABLE study_notes ALTER COLUMN category TYPE TEXT;
        ALTER TABLE study_notes ALTER COLUMN term TYPE TEXT;
        ALTER TABLE study_notes ALTER COLUMN generation_status TYPE TEXT;
        ALTER TABLE study_notes ALTER COLUMN note_format TYPE TEXT;

        -- google_drive_materials
        ALTER TABLE google_drive_materials ALTER COLUMN file_name TYPE TEXT;
        ALTER TABLE google_drive_materials ALTER COLUMN original_file_name TYPE TEXT;
        ALTER TABLE google_drive_materials ALTER COLUMN lesson TYPE TEXT;
        ALTER TABLE google_drive_materials ALTER COLUMN lesson_id TYPE TEXT;
        ALTER TABLE google_drive_materials ALTER COLUMN subject TYPE TEXT;
        ALTER TABLE google_drive_materials ALTER COLUMN tnpsc_group TYPE TEXT;
        ALTER TABLE google_drive_materials ALTER COLUMN term TYPE TEXT;
        ALTER TABLE google_drive_materials ALTER COLUMN uploaded_by TYPE TEXT;
        ALTER TABLE google_drive_materials ALTER COLUMN google_drive_folder_id TYPE TEXT;

        -- textbooks
        ALTER TABLE textbooks ALTER COLUMN book_name TYPE TEXT;
        ALTER TABLE textbooks ALTER COLUMN file_path TYPE TEXT;
        ALTER TABLE textbooks ALTER COLUMN subject TYPE TEXT;
        ALTER TABLE textbooks ALTER COLUMN group_id TYPE TEXT;
        ALTER TABLE textbooks ALTER COLUMN term TYPE TEXT;

        -- textbook_content
        ALTER TABLE textbook_content ALTER COLUMN unit_title TYPE TEXT;
        ALTER TABLE textbook_content ALTER COLUMN lesson_title TYPE TEXT;
        ALTER TABLE textbook_content ALTER COLUMN topic TYPE TEXT;

        -- questions
        ALTER TABLE questions ALTER COLUMN source_reference TYPE TEXT;
        ALTER TABLE questions ALTER COLUMN lesson_title TYPE TEXT;
        ALTER TABLE questions ALTER COLUMN topic TYPE TEXT;
        ALTER TABLE questions ALTER COLUMN tag TYPE TEXT;
        ALTER TABLE questions ALTER COLUMN subject TYPE TEXT;
        ALTER TABLE questions ALTER COLUMN category TYPE TEXT;
        ALTER TABLE questions ALTER COLUMN lesson_id TYPE TEXT;
        ALTER TABLE questions ALTER COLUMN exam_group_id TYPE TEXT;
        ALTER TABLE questions ALTER COLUMN subject_id TYPE TEXT;

        -- textbook_processing_jobs
        ALTER TABLE textbook_processing_jobs ALTER COLUMN step_description TYPE TEXT;
      END $$;
    `);

    // 13. Independent AI Provider Architecture (Claude AI & Google Gemini AI)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_provider_configs (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) UNIQUE NOT NULL,
        model VARCHAR(100) NOT NULL,
        temperature NUMERIC(3,2) DEFAULT 0.70,
        max_tokens INT DEFAULT 4096,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ai_provider_prompts (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        prompt_type VARCHAR(50) NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        version INT NOT NULL DEFAULT 1,
        is_current BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_ai_provider_prompt_version UNIQUE (provider, prompt_type, version)
      );

      CREATE INDEX IF NOT EXISTS idx_ai_provider_prompts_lookup ON ai_provider_prompts (provider, prompt_type, is_current);

      CREATE TABLE IF NOT EXISTS ai_generation_logs (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        model VARCHAR(100) NOT NULL,
        generation_type VARCHAR(50) NOT NULL,
        group_id TEXT,
        standard INT,
        subject TEXT,
        unit_id INT,
        lesson_title TEXT,
        language VARCHAR(20),
        status VARCHAR(50) NOT NULL DEFAULT 'success',
        error_message TEXT,
        token_usage JSONB,
        items_count INT DEFAULT 0,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_ai_gen_logs_provider ON ai_generation_logs (provider, created_at DESC);

      ALTER TABLE questions ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(50) DEFAULT 'claude';
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS generation_job_id VARCHAR(64);
      ALTER TABLE study_notes ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(50) DEFAULT 'claude';

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

      ALTER TABLE ai_provider_configs ADD COLUMN IF NOT EXISTS api_key TEXT;
      ALTER TABLE ai_provider_configs ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'READY';
      ALTER TABLE ai_provider_configs ADD COLUMN IF NOT EXISTS status_message TEXT;
      ALTER TABLE ai_provider_configs ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMP WITH TIME ZONE;

      -- Seed default provider active statuses if absent
      INSERT INTO ai_provider_configs (provider, model, is_active)
      VALUES ('claude', 'claude-3-5-sonnet-20241022', true)
      ON CONFLICT (provider) DO NOTHING;

      INSERT INTO ai_provider_configs (provider, model, is_active)
      VALUES ('gemini', 'gemini-1.5-flash', false)
      ON CONFLICT (provider) DO NOTHING;
    `);

    // 12. Student Performance Tracking System Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        mobile VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        target_group VARCHAR(50) NOT NULL DEFAULT 'group4',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE students DROP COLUMN IF EXISTS preferred_language;
      CREATE INDEX IF NOT EXISTS idx_students_email ON students (email);
      CREATE INDEX IF NOT EXISTS idx_students_target_group ON students (target_group);

      DROP TABLE IF EXISTS question_translations;

      CREATE TABLE IF NOT EXISTS study_sessions (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        session_token VARCHAR(64) NOT NULL,
        page_path VARCHAR(255) NOT NULL DEFAULT '/dashboard',
        duration_seconds INT NOT NULL DEFAULT 0,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        CONSTRAINT unique_student_session UNIQUE (student_id, session_token)
      );
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'unique_student_session'
        ) THEN
          ALTER TABLE study_sessions ADD CONSTRAINT unique_student_session UNIQUE (student_id, session_token);
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS idx_study_sessions_student_id ON study_sessions (student_id);
      CREATE INDEX IF NOT EXISTS idx_study_sessions_token ON study_sessions (session_token);
      CREATE INDEX IF NOT EXISTS idx_study_sessions_started_at ON study_sessions (started_at);
      CREATE INDEX IF NOT EXISTS idx_study_sessions_active ON study_sessions (student_id, is_active);

      CREATE TABLE IF NOT EXISTS question_attempts (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        question_id INT,
        category VARCHAR(50),
        subject VARCHAR(100),
        class_id INT,
        unit_id INT,
        lesson_id TEXT,
        lesson_title TEXT,
        topic TEXT,
        selected_option INT NOT NULL,
        correct_answer INT NOT NULL,
        is_correct BOOLEAN NOT NULL,
        source_system VARCHAR(50) NOT NULL DEFAULT 'mcq_practice',
        time_spent_seconds INT DEFAULT 0,
        attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_question_attempts_student ON question_attempts (student_id);
      CREATE INDEX IF NOT EXISTS idx_question_attempts_correct ON question_attempts (student_id, is_correct);
      CREATE INDEX IF NOT EXISTS idx_question_attempts_subject ON question_attempts (student_id, subject);
      CREATE INDEX IF NOT EXISTS idx_question_attempts_source ON question_attempts (student_id, source_system);
      CREATE INDEX IF NOT EXISTS idx_question_attempts_date ON question_attempts (attempted_at);

      CREATE TABLE IF NOT EXISTS mock_test_attempts (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        test_id VARCHAR(100),
        test_title VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'group1',
        total_questions INT NOT NULL DEFAULT 0,
        attempted_questions INT NOT NULL DEFAULT 0,
        correct_answers INT NOT NULL DEFAULT 0,
        incorrect_answers INT NOT NULL DEFAULT 0,
        score NUMERIC(6, 2) NOT NULL DEFAULT 0,
        max_score NUMERIC(6, 2) NOT NULL DEFAULT 100,
        percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
        time_spent_seconds INT NOT NULL DEFAULT 0,
        completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_mock_attempts_student ON mock_test_attempts (student_id);
      CREATE INDEX IF NOT EXISTS idx_mock_attempts_category ON mock_test_attempts (category);
      CREATE INDEX IF NOT EXISTS idx_mock_attempts_date ON mock_test_attempts (completed_at);

      CREATE TABLE IF NOT EXISTS study_material_progress (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        material_type VARCHAR(50) NOT NULL DEFAULT 'note',
        standard INT,
        subject VARCHAR(100),
        term VARCHAR(50),
        unit_id INT,
        lesson_id TEXT,
        lesson_title TEXT NOT NULL,
        reading_time_seconds INT NOT NULL DEFAULT 0,
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_student_material_progress UNIQUE (student_id, material_type, subject, standard, unit_id, lesson_title)
      );
      CREATE INDEX IF NOT EXISTS idx_material_progress_student ON study_material_progress (student_id);
      CREATE INDEX IF NOT EXISTS idx_material_progress_completed ON study_material_progress (student_id, is_completed);
      CREATE INDEX IF NOT EXISTS idx_material_progress_subject ON study_material_progress (student_id, subject);

      CREATE TABLE IF NOT EXISTS student_activity (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        activity_type VARCHAR(50) NOT NULL,
        reference_id VARCHAR(100),
        reference_title TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_student_activity_student ON student_activity (student_id);
      CREATE INDEX IF NOT EXISTS idx_student_activity_type ON student_activity (activity_type);
      CREATE INDEX IF NOT EXISTS idx_student_activity_date ON student_activity (created_at DESC);

      CREATE TABLE IF NOT EXISTS daily_streaks (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        activity_date DATE NOT NULL,
        questions_count INT NOT NULL DEFAULT 0,
        study_seconds INT NOT NULL DEFAULT 0,
        mock_tests_count INT NOT NULL DEFAULT 0,
        notes_count INT NOT NULL DEFAULT 0,
        CONSTRAINT unique_student_activity_date UNIQUE (student_id, activity_date)
      );
      CREATE INDEX IF NOT EXISTS idx_daily_streaks_student_date ON daily_streaks (student_id, activity_date DESC);

      -- 12B. Published Mock Tests Catalog & Analytics Indexes
      CREATE TABLE IF NOT EXISTS mock_tests (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(120) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'group1',
        category_name VARCHAR(100) NOT NULL,
        questions_count INT NOT NULL DEFAULT 100,
        duration_minutes INT NOT NULL DEFAULT 90,
        difficulty VARCHAR(20) NOT NULL DEFAULT 'Medium',
        status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('staging', 'published', 'archived')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_mock_tests_status ON mock_tests (status);
      CREATE INDEX IF NOT EXISTS idx_questions_status ON questions (status);
      CREATE INDEX IF NOT EXISTS idx_study_notes_status ON study_notes (status);

      ALTER TABLE mock_tests DROP CONSTRAINT IF EXISTS mock_tests_status_check;
      ALTER TABLE mock_tests
        ADD CONSTRAINT mock_tests_status_check
        CHECK (status IN ('draft', 'staging', 'published', 'scheduled', 'archived'));

      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS tnpsc_group VARCHAR(40);
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS subject VARCHAR(150) DEFAULT 'General Studies';
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS standard VARCHAR(40);
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS unit VARCHAR(120);
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS total_marks NUMERIC(8, 2) NOT NULL DEFAULT 150;
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS marks_per_question NUMERIC(6, 2) NOT NULL DEFAULT 1.5;
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS negative_marking NUMERIC(6, 2) NOT NULL DEFAULT 0;
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS start_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS end_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);

      UPDATE mock_tests
      SET
        tnpsc_group = COALESCE(
          tnpsc_group,
          CASE
            WHEN category = 'group1' THEN 'Group 1'
            WHEN category = 'group2' THEN 'Group 2'
            WHEN category = 'group2a' THEN 'Group 2A'
            WHEN category = 'group2_2a' THEN 'Group 2'
            WHEN category IN ('group4', 'group4_vao') THEN 'Group 4'
            ELSE 'Group 1'
          END
        ),
        total_marks = CASE WHEN total_marks = 150 AND questions_count <> 100 THEN questions_count * marks_per_question ELSE total_marks END,
        published_at = COALESCE(published_at, CASE WHEN status = 'published' THEN created_at ELSE NULL END)
      WHERE tnpsc_group IS NULL OR (status = 'published' AND published_at IS NULL);

      CREATE TABLE IF NOT EXISTS mock_test_questions (
        id SERIAL PRIMARY KEY,
        mock_test_id INT NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
        question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        question_order INT NOT NULL DEFAULT 1,
        marks NUMERIC(6, 2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_mock_test_question UNIQUE (mock_test_id, question_id)
      );
      CREATE INDEX IF NOT EXISTS idx_mock_test_questions_test ON mock_test_questions (mock_test_id, question_order);

      CREATE TABLE IF NOT EXISTS mock_test_sessions (
        id SERIAL PRIMARY KEY,
        mock_test_id INT NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'expired')),
        started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE,
        submitted_at TIMESTAMP WITH TIME ZONE,
        answers JSONB NOT NULL DEFAULT '{}'::jsonb,
        current_question_index INT NOT NULL DEFAULT 0,
        attempt_id INT REFERENCES mock_test_attempts(id) ON DELETE SET NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_mock_test_sessions_student ON mock_test_sessions (student_id, mock_test_id, status);

      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS test_category VARCHAR(30) NOT NULL DEFAULT 'full_length';
      ALTER TABLE mock_tests DROP CONSTRAINT IF EXISTS mock_tests_test_category_check;
      ALTER TABLE mock_tests
        ADD CONSTRAINT mock_tests_test_category_check
        CHECK (test_category IN ('lesson_wise', 'unit_wise', 'full_length'));
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS lesson VARCHAR(255);
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS randomize_per_attempt BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS avoid_repeated_questions BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS include_incorrect_on_retake BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS question_language VARCHAR(20) NOT NULL DEFAULT 'both';
      ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS randomize_options BOOLEAN NOT NULL DEFAULT FALSE;
      CREATE INDEX IF NOT EXISTS idx_mock_tests_group_category ON mock_tests (category, test_category, status);

      ALTER TABLE mock_test_sessions ADD COLUMN IF NOT EXISTS question_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE mock_test_sessions ADD COLUMN IF NOT EXISTS option_orders JSONB NOT NULL DEFAULT '{}'::jsonb;

      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'completed';
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS assessment_type VARCHAR(40) NOT NULL DEFAULT 'mock_test';
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS submission_token VARCHAR(120);
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS unanswered_questions INT NOT NULL DEFAULT 0;
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS subject_breakdown JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS topic_breakdown JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS question_responses JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS attempt_number INT NOT NULL DEFAULT 1;
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS test_key VARCHAR(255);
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS subject VARCHAR(120);
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
      CREATE INDEX IF NOT EXISTS idx_mock_attempts_student_status ON mock_test_attempts (student_id, status);
      CREATE INDEX IF NOT EXISTS idx_mock_attempts_type ON mock_test_attempts (student_id, assessment_type, completed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_mock_attempts_student_test_key ON mock_test_attempts (student_id, test_key, attempt_number DESC);
      CREATE INDEX IF NOT EXISTS idx_mock_attempts_student_subject ON mock_test_attempts (student_id, subject, completed_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mock_attempts_submission_token ON mock_test_attempts (student_id, submission_token) WHERE submission_token IS NOT NULL;

      -- Syllabus Lesson Progress, Grade Settings & Attempt UUID columns
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS group_id VARCHAR(40);
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS subject_id VARCHAR(100);
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS standard_id INT;
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS unit_id INT;
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS lesson_id TEXT;
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS lesson_title TEXT;
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS mock_test_format VARCHAR(30) DEFAULT 'full_length';
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS grade VARCHAR(40);
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS attempt_uuid VARCHAR(64);
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS award_type VARCHAR(20);
      ALTER TABLE mock_test_attempts ADD COLUMN IF NOT EXISTS award_threshold_snapshot JSONB;
      CREATE INDEX IF NOT EXISTS idx_mock_attempts_syllabus ON mock_test_attempts (student_id, group_id, subject_id, standard_id, unit_id, lesson_id);
      CREATE INDEX IF NOT EXISTS idx_mock_attempts_format ON mock_test_attempts (student_id, mock_test_format, completed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_mock_attempts_award ON mock_test_attempts (student_id, award_type);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mock_attempts_uuid ON mock_test_attempts (attempt_uuid) WHERE attempt_uuid IS NOT NULL;

      CREATE TABLE IF NOT EXISTS award_settings (
        id INT PRIMARY KEY DEFAULT 1,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        gold_min NUMERIC(5,2) NOT NULL DEFAULT 90.00,
        gold_max NUMERIC(5,2) NOT NULL DEFAULT 100.00,
        platinum_min NUMERIC(5,2) NOT NULL DEFAULT 75.00,
        platinum_max NUMERIC(5,2) NOT NULL DEFAULT 89.99,
        silver_min NUMERIC(5,2) NOT NULL DEFAULT 60.00,
        silver_max NUMERIC(5,2) NOT NULL DEFAULT 74.99,
        version INT NOT NULL DEFAULT 1,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO award_settings (id, is_enabled, gold_min, gold_max, platinum_min, platinum_max, silver_min, silver_max, version)
      VALUES (1, TRUE, 90.00, 100.00, 75.00, 89.99, 60.00, 74.99, 1)
      ON CONFLICT (id) DO NOTHING;

      -- Backfill historical attempts where award_type is NULL without rewriting already assigned awards
      UPDATE mock_test_attempts
      SET award_type = CASE
            WHEN percentage >= 90 THEN 'GOLD'
            WHEN percentage >= 75 THEN 'PLATINUM'
            WHEN percentage >= 60 THEN 'SILVER'
            ELSE 'NONE'
          END,
          award_threshold_snapshot = '{"version":1,"goldMin":90,"platinumMin":75,"silverMin":60}'::jsonb
      WHERE award_type IS NULL;

      CREATE TABLE IF NOT EXISTS grade_settings (
        id SERIAL PRIMARY KEY,
        grade_label VARCHAR(40) NOT NULL UNIQUE,
        min_percentage NUMERIC(5,2) NOT NULL,
        max_percentage NUMERIC(5,2) NOT NULL,
        display_order INT NOT NULL DEFAULT 1,
        color_hex VARCHAR(20) NOT NULL DEFAULT '#a855f7',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO grade_settings (grade_label, min_percentage, max_percentage, display_order, color_hex)
      VALUES
        ('A+', 90.00, 100.00, 1, '#10b981'),
        ('A', 80.00, 89.99, 2, '#34d399'),
        ('B+', 70.00, 79.99, 3, '#60a5fa'),
        ('B', 60.00, 69.99, 4, '#818cf8'),
        ('C', 50.00, 59.99, 5, '#fbbf24'),
        ('D', 40.00, 49.99, 6, '#fb923c'),
        ('Needs Improvement', 0.00, 39.99, 7, '#f87171')
      ON CONFLICT (grade_label) DO NOTHING;

      INSERT INTO mock_tests (slug, title, category, category_name, questions_count, duration_minutes, difficulty, status)
      VALUES
        ('group1-prelims-full-1', 'TNPSC Group 1 Prelims Full Mock Test 1', 'group1', 'TNPSC Group 1', 200, 180, 'Hard', 'published'),
        ('group1-gs-unit8-9-rapid', 'TNPSC Group 1 General Studies & Unit 8/9 Rapid Mock', 'group1', 'TNPSC Group 1', 100, 90, 'Medium', 'published'),
        ('group2-2a-combined-prelims', 'TNPSC Group 2 & 2A Combined Prelims Comprehensive Mock', 'group2_2a', 'TNPSC Group 2 & 2A', 200, 180, 'Medium', 'published'),
        ('group2-mains-aptitude-scenario', 'TNPSC Group 2 Mains Aptitude & Scenario Mock Test', 'group2_2a', 'TNPSC Group 2 (Interview)', 100, 120, 'Hard', 'published'),
        ('group2a-speed-practice', 'TNPSC Group 2A Speed Practice Mock Test', 'group2_2a', 'TNPSC Group 2A (Non-Interview)', 150, 120, 'Medium', 'published'),
        ('group4-vao-complete-full', 'TNPSC Group 4 & VAO Complete Full Mock Test (Tamil + GS)', 'group4_vao', 'TNPSC Group 4 & VAO', 200, 180, 'Medium', 'published'),
        ('vao-village-admin-special', 'TNPSC VAO Village Administration & Revenue Special Mock', 'group4_vao', 'VAO (Village Admin)', 100, 90, 'Easy', 'published'),
        ('group4-ja-typist-speed', 'TNPSC Group 4 Junior Assistant & Typist Speed Drill', 'group4_vao', 'Group 4 (JA / Typist)', 100, 90, 'Easy', 'published')
      ON CONFLICT (slug) DO NOTHING;

      -- 13. Advanced SaaS Analytics & Live Tracking Tables
      ALTER TABLE students ADD COLUMN IF NOT EXISTS district VARCHAR(100);
      ALTER TABLE students ADD COLUMN IF NOT EXISTS city VARCHAR(100);
      ALTER TABLE students ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free';
      ALTER TABLE students ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active';
      ALTER TABLE students ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
      CREATE INDEX IF NOT EXISTS idx_students_district ON students (district);
      CREATE INDEX IF NOT EXISTS idx_students_sub_tier ON students (subscription_tier);
      CREATE INDEX IF NOT EXISTS idx_students_last_login ON students (last_login_at);
      CREATE INDEX IF NOT EXISTS idx_students_is_active ON students (is_active);

      -- 14. Google OAuth 2.0, Onboarding & Password Reset Support
      ALTER TABLE students ALTER COLUMN password_hash DROP NOT NULL;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
      ALTER TABLE students ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(30) NOT NULL DEFAULT 'email';
      ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS role VARCHAR(30) NOT NULL DEFAULT 'student';
      ALTER TABLE students ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 1;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_students_google_id_unique ON students (google_id) WHERE google_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_students_auth_provider ON students (auth_provider);

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        token_hash VARCHAR(128) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_password_reset_student ON password_reset_tokens (student_id);
      CREATE INDEX IF NOT EXISTS idx_password_reset_hash ON password_reset_tokens (token_hash);

      CREATE TABLE IF NOT EXISTS visitor_sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(64) UNIQUE NOT NULL,
        visitor_id VARCHAR(64) NOT NULL,
        student_id INT REFERENCES students(id) ON DELETE SET NULL,
        country VARCHAR(100),
        state VARCHAR(100),
        district VARCHAR(100),
        city VARCHAR(100),
        location_source VARCHAR(30),
        device_category VARCHAR(50) NOT NULL DEFAULT 'desktop',
        browser VARCHAR(50) NOT NULL DEFAULT 'Other',
        os VARCHAR(50) NOT NULL DEFAULT 'Other',
        referrer TEXT,
        entry_path VARCHAR(255) NOT NULL DEFAULT '/',
        current_path VARCHAR(255) NOT NULL DEFAULT '/',
        is_returning BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP WITH TIME ZONE
      );
      ALTER TABLE visitor_sessions ALTER COLUMN district DROP NOT NULL;
      ALTER TABLE visitor_sessions ALTER COLUMN district DROP DEFAULT;
      ALTER TABLE visitor_sessions ALTER COLUMN city DROP DEFAULT;
      ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS country VARCHAR(100);
      ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS state VARCHAR(100);
      ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS location_source VARCHAR(30);
      ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITH TIME ZONE;
      CREATE INDEX IF NOT EXISTS idx_visitor_sessions_id ON visitor_sessions (session_id);
      CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor ON visitor_sessions (visitor_id);
      CREATE INDEX IF NOT EXISTS idx_visitor_sessions_student ON visitor_sessions (student_id);
      CREATE INDEX IF NOT EXISTS idx_visitor_sessions_district ON visitor_sessions (district);
      CREATE INDEX IF NOT EXISTS idx_visitor_sessions_started ON visitor_sessions (started_at);
      CREATE INDEX IF NOT EXISTS idx_visitor_sessions_heartbeat ON visitor_sessions (last_heartbeat);
      CREATE INDEX IF NOT EXISTS idx_visitor_sessions_active ON visitor_sessions (is_active);

      CREATE TABLE IF NOT EXISTS page_views (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        visitor_id VARCHAR(64) NOT NULL,
        student_id INT REFERENCES students(id) ON DELETE SET NULL,
        page_path VARCHAR(255) NOT NULL,
        page_title VARCHAR(255),
        district VARCHAR(100),
        city VARCHAR(100),
        device_category VARCHAR(50) NOT NULL DEFAULT 'desktop',
        viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE page_views ALTER COLUMN district DROP NOT NULL;
      ALTER TABLE page_views ALTER COLUMN district DROP DEFAULT;
      ALTER TABLE page_views ALTER COLUMN city DROP DEFAULT;
      CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views (session_id);
      CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views (visitor_id);
      CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views (page_path);
      CREATE INDEX IF NOT EXISTS idx_page_views_district ON page_views (district);
      CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON page_views (viewed_at);

      CREATE TABLE IF NOT EXISTS student_subscriptions (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        plan_id VARCHAR(50) NOT NULL,
        plan_name VARCHAR(100) NOT NULL,
        amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        payment_method VARCHAR(50) NOT NULL DEFAULT 'Razorpay',
        district VARCHAR(100),
        city VARCHAR(100),
        starts_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE,
        transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE student_subscriptions ALTER COLUMN district DROP NOT NULL;
      ALTER TABLE student_subscriptions ALTER COLUMN district DROP DEFAULT;
      ALTER TABLE student_subscriptions ALTER COLUMN city DROP DEFAULT;
      CREATE INDEX IF NOT EXISTS idx_student_subscriptions_student ON student_subscriptions (student_id);
      CREATE INDEX IF NOT EXISTS idx_student_subscriptions_district ON student_subscriptions (district);
      CREATE INDEX IF NOT EXISTS idx_student_subscriptions_status ON student_subscriptions (status);
      CREATE INDEX IF NOT EXISTS idx_student_subscriptions_date ON student_subscriptions (transaction_date);

      CREATE TABLE IF NOT EXISTS analytics_events (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(120) UNIQUE,
        event_type VARCHAR(64) NOT NULL,
        student_id INT REFERENCES students(id) ON DELETE SET NULL,
        visitor_id VARCHAR(64),
        session_id VARCHAR(64),
        page_path VARCHAR(255),
        district VARCHAR(100),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_events_type_ts ON analytics_events (event_type, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_student_ts ON analytics_events (student_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_ts ON analytics_events (created_at DESC);

      CREATE TABLE IF NOT EXISTS payment_events (
        id SERIAL PRIMARY KEY,
        payment_event_id VARCHAR(120) UNIQUE NOT NULL,
        student_id INT REFERENCES students(id) ON DELETE SET NULL,
        subscription_id INT REFERENCES student_subscriptions(id) ON DELETE SET NULL,
        razorpay_order_id VARCHAR(120),
        razorpay_payment_id VARCHAR(120),
        plan_id VARCHAR(64),
        plan_name VARCHAR(120),
        amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        status VARCHAR(40) NOT NULL DEFAULT 'pending',
        verified_by_signature BOOLEAN NOT NULL DEFAULT FALSE,
        district VARCHAR(100),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_payment_events_status_ts ON payment_events (status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_events_student ON payment_events (student_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events (razorpay_order_id);

      -- Remove only previously seeded synthetic visitor sessions/page_views (never touch real user rows)
      DELETE FROM page_views WHERE session_id LIKE 'seed_sess_%' OR visitor_id LIKE 'seed_vis_%';
      DELETE FROM visitor_sessions WHERE session_id LIKE 'seed_sess_%' OR visitor_id LIKE 'seed_vis_%';
    `);

    // Previous Year Papers Online Mock Test System tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS previous_year_papers (
        id SERIAL PRIMARY KEY,
        year INT NOT NULL,
        exam VARCHAR(120) NOT NULL,
        category VARCHAR(40) NOT NULL,
        subjects TEXT NOT NULL,
        total_questions INT NOT NULL DEFAULT 200,
        duration_minutes INT NOT NULL DEFAULT 180,
        marks_per_question NUMERIC(5,2) NOT NULL DEFAULT 1.5,
        negative_marking NUMERIC(5,2) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'published',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS previous_year_paper_questions (
        id SERIAL PRIMARY KEY,
        paper_id INT NOT NULL REFERENCES previous_year_papers(id) ON DELETE CASCADE,
        question_number INT NOT NULL,
        question_id INT REFERENCES questions(id) ON DELETE SET NULL,
        subject VARCHAR(120) NOT NULL DEFAULT 'General Studies',
        topic VARCHAR(255),
        question_text TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_answer INT NOT NULL,
        explanation TEXT,
        CONSTRAINT uq_pyp_paper_qnum UNIQUE (paper_id, question_number)
      );

      CREATE INDEX IF NOT EXISTS idx_pyp_questions_paper
      ON previous_year_paper_questions (paper_id, question_number);

      CREATE TABLE IF NOT EXISTS student_test_sessions (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        paper_id INT NOT NULL REFERENCES previous_year_papers(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
        started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        submitted_at TIMESTAMP WITH TIME ZONE,
        current_question INT NOT NULL DEFAULT 1,
        submission_token VARCHAR(120) UNIQUE,
        attempt_id INT
      );

      CREATE INDEX IF NOT EXISTS idx_student_test_sessions_lookup
      ON student_test_sessions (student_id, paper_id, status);

      CREATE TABLE IF NOT EXISTS student_test_answers (
        id SERIAL PRIMARY KEY,
        session_id INT NOT NULL REFERENCES student_test_sessions(id) ON DELETE CASCADE,
        question_id INT NOT NULL REFERENCES previous_year_paper_questions(id) ON DELETE CASCADE,
        question_number INT NOT NULL,
        selected_option INT,
        is_marked_for_review BOOLEAN NOT NULL DEFAULT FALSE,
        is_visited BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_student_test_answer UNIQUE (session_id, question_id)
      );

      CREATE INDEX IF NOT EXISTS idx_student_test_answers_session
      ON student_test_answers (session_id, question_number);

      CREATE TABLE IF NOT EXISTS student_login_locations (
        id SERIAL PRIMARY KEY,
        login_event_id VARCHAR(120) NOT NULL UNIQUE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        district_id VARCHAR(64),
        district_name VARCHAR(100),
        location_status VARCHAR(40) NOT NULL DEFAULT 'unavailable',
        location_source VARCHAR(30) NOT NULL DEFAULT 'unavailable',
        accuracy_category VARCHAR(30),
        login_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_student_login_locations_student_ts
      ON student_login_locations (student_id, login_timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_student_login_locations_district_ts
      ON student_login_locations (district_id, login_timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_student_login_locations_ts
      ON student_login_locations (login_timestamp DESC);

      CREATE TABLE IF NOT EXISTS student_login_events (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(120) NOT NULL UNIQUE,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        student_email_snapshot VARCHAR(255) NOT NULL,
        authentication_method VARCHAR(40) NOT NULL,
        login_status VARCHAR(20) NOT NULL DEFAULT 'Successful',
        login_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        session_id VARCHAR(120),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_student_login_events_ts
      ON student_login_events (login_timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_student_login_events_student_ts
      ON student_login_events (student_id, login_timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_student_login_events_email_ts
      ON student_login_events (LOWER(student_email_snapshot), login_timestamp DESC);
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully: questions, admin_users, study_notes, textbooks, textbook_content, jobs, google_drive_materials, and ai_providers verified.');

    // Seed default independent AI prompts for Claude and Gemini if empty
    try {
      const { AIPromptsService } = require('./services/ai/ai-prompts.service');
      await AIPromptsService.seedDefaultsIfEmpty();
    } catch (promptErr: any) {
      console.warn('[Migration] Non-fatal warning during AI prompt seeding:', promptErr?.message);
    }

    // Initialize and seed dynamic Study Materials Management schema
    try {
      const { StudyManagementService } = require('./services/studyManagementService');
      await StudyManagementService.initSchema();
      const { ensureSyllabusMappingSchema } = require('./services/syllabusMappingSchema');
      await ensureSyllabusMappingSchema();
      console.log('[Migration] Dynamic Study Materials Management & Syllabus Mapping schema initialized.');
    } catch (smErr: any) {
      console.warn('[Migration] Non-fatal warning during Study Materials schema init:', smErr?.message);
    }
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

let schemaInitPromise: Promise<void> | null = null;

export function ensureDatabaseSchema(): Promise<void> {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      if (process.env.FORCE_MIGRATION !== 'true') {
        // Fast-path check: avoid running 50+ DDL & seed statements on every Vercel serverless cold start
        try {
          const check = await pool.query(`
            SELECT
              to_regclass('public.questions') AS t_questions,
              to_regclass('public.study_notes') AS t_notes,
              to_regclass('public.students') AS t_students,
              to_regclass('public.syllabus_lessons') AS t_lessons,
              to_regclass('public.syllabus_topics') AS t_topics,
              to_regclass('public.mcq_generation_batches') AS t_mcq_batches,
              to_regclass('public.mcq_question_translations') AS t_mcq_translations,
              to_regclass('public.previous_year_papers') AS t_pyp,
              EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'textbooks' AND column_name = 'google_drive_file_id'
              ) AS has_tb_gdrive,
              EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'textbooks' AND column_name = 'unit'
              ) AS has_tb_unit,
              EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'pdf_extractions' AND column_name = 'retry_count'
              ) AS has_pe_retry,
              EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'mock_tests' AND column_name = 'test_category'
              ) AS has_mt_test_category,
              EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'mock_test_sessions' AND column_name = 'question_ids'
              ) AS has_mts_question_ids,
              EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'mock_tests' AND column_name = 'question_language'
              ) AS has_mt_lang,
              to_regclass('public.grade_settings') AS t_grade_settings,
              to_regclass('public.award_settings') AS t_award_settings,
              EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'mock_test_attempts' AND column_name = 'grade'
              ) AS has_mta_grade,
              EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'mock_test_attempts' AND column_name = 'award_type'
              ) AS has_mta_award,
              to_regclass('public.student_login_locations') AS t_login_locations,
              to_regclass('public.student_login_events') AS t_login_events,
              to_regclass('public.analytics_events') AS t_analytics_events,
              to_regclass('public.payment_events') AS t_payment_events,
              EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'visitor_sessions' AND column_name = 'ended_at'
              ) AS has_vs_ended_at
          `);
          const row = check.rows[0];
          if (
            row?.t_questions &&
            row?.t_notes &&
            row?.t_students &&
            row?.t_lessons &&
            row?.t_topics &&
            row?.t_mcq_batches &&
            row?.t_mcq_translations &&
            row?.t_pyp &&
            row?.has_tb_gdrive &&
            row?.has_tb_unit &&
            row?.has_pe_retry &&
            row?.has_mt_test_category &&
            row?.has_mts_question_ids &&
            row?.has_mt_lang &&
            row?.t_grade_settings &&
            row?.t_award_settings &&
            row?.has_mta_grade &&
            row?.has_mta_award &&
            row?.t_login_locations &&
            row?.t_login_events &&
            row?.t_analytics_events &&
            row?.t_payment_events &&
            row?.has_vs_ended_at
          ) {
            return;
          }
        } catch {
          // Fall through to full migration if quick check fails
        }
      }
      await runMigration();
    })().catch((err) => {
      schemaInitPromise = null;
      throw err;
    });
  }
  return schemaInitPromise;
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration process finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration execution error:', err);
      process.exit(1);
    });
}
