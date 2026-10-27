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

    // 2. Create indices for high-performance querying
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_questions_category_unit_status 
      ON questions (category, unit_id, status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_questions_lesson_title 
      ON questions (lesson_title);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_questions_class_id 
      ON questions (class_id);
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully: questions table and indices created/verified.');
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
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
