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
        category VARCHAR(50) NOT NULL DEFAULT 'group1',
        unit_id INT NOT NULL,
        class_id INT,
        subject VARCHAR(100) NOT NULL,
        lesson_title VARCHAR(255) NOT NULL,
        topic VARCHAR(255),
        difficulty VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
        tag VARCHAR(255),
        question_text TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_answer INT NOT NULL CHECK (correct_answer >= 0 AND correct_answer <= 3),
        explanation TEXT NOT NULL,
        source_reference VARCHAR(255),
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
        category VARCHAR(50) NOT NULL DEFAULT 'group1',
        unit_id INT NOT NULL,
        class_id INT,
        subject VARCHAR(100) NOT NULL,
        lesson_title VARCHAR(255) NOT NULL,
        topic VARCHAR(255),
        language VARCHAR(10) NOT NULL DEFAULT 'english' CHECK (language IN ('tamil', 'english')),
        title VARCHAR(255),
        content TEXT NOT NULL,
        content_html TEXT,
        tags JSONB,
        status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('staging', 'published', 'archived')),
        source_reference VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Create textbooks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS textbooks (
        id SERIAL PRIMARY KEY,
        group_id VARCHAR(50) NOT NULL,
        standard INT NOT NULL,
        subject VARCHAR(150) NOT NULL,
        medium VARCHAR(20) NOT NULL DEFAULT 'English' CHECK (medium IN ('Tamil', 'English')),
        term VARCHAR(50) DEFAULT 'Full Year',
        book_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
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
        unit_title VARCHAR(255),
        lesson_title VARCHAR(255),
        topic VARCHAR(255),
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
        step_description VARCHAR(255),
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
      END $$;
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
      CREATE INDEX IF NOT EXISTS idx_questions_class_id 
      ON questions (class_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_study_notes_category_lesson 
      ON study_notes (category, lesson_title, status);
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

    await client.query('COMMIT');
    console.log('Migration completed successfully: questions, admin_users, study_notes, textbooks, textbook_content, and jobs verified.');
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
    schemaInitPromise = runMigration().catch((err) => {
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
