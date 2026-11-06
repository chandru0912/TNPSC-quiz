import pool from '../db';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

function loadTsModule(relPath: string): any {
  const filePath = path.resolve(__dirname, relPath);
  if (!fs.existsSync(filePath)) {
    console.warn('[Seeder] File not found:', filePath);
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const jsTranspiled = ts.transpileModule(content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exportsObj: any = {};
  const runner = new Function('exports', 'require', jsTranspiled);
  runner(exportsObj, (mod: string) => {
    if (mod.startsWith('.')) {
      return loadTsModule(path.join(path.dirname(relPath), mod) + (mod.endsWith('.ts') ? '' : '.ts'));
    }
    return require(mod);
  });
  return exportsObj;
}

export async function seedCompleteSyllabusData(): Promise<number> {
  const client = await pool.connect();
  let totalLessonsSynced = 0;

  try {
    await client.query('BEGIN');

    // Ensure Indexes
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_syllabus_topics_lesson_name 
      ON syllabus_topics (lesson_id, topic_name);
    `);

    // 1. Ensure Canonical Exams
    await client.query(`
      INSERT INTO syllabus_exams (id, name, code, badge, description, display_order, is_active) VALUES
        ('group1', 'TNPSC Group 1', 'Code: 497', 'Degree Standard • Prelims', 'Deputy Collector, DSP, Commercial Tax Officer', 1, true),
        ('group2', 'TNPSC Group 2 & 2A', 'Code: 495', 'Degree Standard • Prelims & Non-Interview', 'Sub Registrar, Municipal Commissioner', 2, true),
        ('group4', 'TNPSC Group 4', 'Code: 496', 'SSLC Standard • Single Paper', 'Junior Assistant, VAO, Bill Collector, Typist', 3, true)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        is_active = true;
    `);

    // 2. Ensure Canonical Subjects
    const canonicalSubjects = [
      { id: 'group1-general-studies', exam: 'group1', slug: 'general-studies', name: 'General Studies', desc: 'General Science, History, Polity, Economy, Geography, TN Heritage', ord: 1 },
      { id: 'group1-aptitude', exam: 'group1', slug: 'aptitude', name: 'Aptitude and Mental Ability', desc: 'Mental ability, Simplification, Ratio, Logical reasoning', ord: 2 },
      { id: 'group2-general-studies', exam: 'group2', slug: 'general-studies', name: 'General Studies', desc: 'General Science, History, Polity, Economy, Geography, TN Heritage', ord: 1 },
      { id: 'group2-aptitude', exam: 'group2', slug: 'aptitude', name: 'Aptitude and Mental Ability', desc: 'Mental ability, Simplification, Ratio, Logical reasoning', ord: 2 },
      { id: 'group2-general-english', exam: 'group2', slug: 'general-english', name: 'General English', desc: 'Grammar, Literature, Vocabulary, Comprehension', ord: 3 },
      { id: 'group2-general-tamil', exam: 'group2', slug: 'general-tamil', name: 'General Tamil', desc: 'இலக்கணம், இலக்கியம், தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும்', ord: 4 },
      { id: 'group4-general-studies', exam: 'group4', slug: 'general-studies', name: 'General Studies', desc: 'General Science, History, Polity, Economy, Geography, TN Heritage', ord: 1 },
      { id: 'group4-aptitude', exam: 'group4', slug: 'aptitude', name: 'Aptitude and Mental Ability', desc: 'Mental ability, Simplification, Ratio, Logical reasoning', ord: 2 },
      { id: 'group4-general-tamil', exam: 'group4', slug: 'general-tamil', name: 'General Tamil', desc: 'இலக்கணம், இலக்கியம், தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும்', ord: 3 },
      { id: 'group4-general-english', exam: 'group4', slug: 'general-english', name: 'General English', desc: 'Grammar, Literature, Vocabulary, Comprehension', ord: 4 },
    ];

    for (const s of canonicalSubjects) {
      await client.query(`
        INSERT INTO syllabus_subjects (id, exam_id, subject_slug, name, description, display_order, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          display_order = EXCLUDED.display_order,
          is_active = true;
      `, [s.id, s.exam, s.slug, s.name, s.desc, s.ord]);
    }

    // Helper to get or insert unit without duplicating
    async function getOrCreateUnit(
      examId: string,
      subjectSlug: string,
      unitNum: number,
      unitCode: string,
      title: string,
      subjectName: string,
      qCount: number
    ): Promise<number> {
      const q = await client.query(
        `SELECT id FROM syllabus_units 
         WHERE exam_id = $1 AND (subject_id = $2 OR subject_id = $3) AND unit_number = $4`,
        [examId, subjectSlug, `${examId}-${subjectSlug}`, unitNum]
      );
      if (q.rows.length > 0) {
        return q.rows[0].id;
      }
      const ins = await client.query(
        `INSERT INTO syllabus_units (
          exam_id, subject_id, unit_number, unit_code, title, subject_name,
          question_count, display_order, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        RETURNING id`,
        [examId, subjectSlug, unitNum, unitCode || `Unit ${unitNum}`, title, subjectName || title, qCount || 15, unitNum]
      );
      return ins.rows[0].id;
    }

    // Helper to insert or update lesson and topics
    async function syncLesson(
      unitDbId: number,
      examId: string,
      subjectSlug: string,
      standardNum: number,
      lessonObj: any,
      topics: any[],
      order: number
    ): Promise<void> {
      const lessonId = lessonObj.id;
      const lessonNumber = lessonObj.lessonNumber || String(order);
      const title = lessonObj.title;
      const term = lessonObj.term || 'Term 1';
      const description = lessonObj.description || '';
      const status = lessonObj.status || 'Available';

      await client.query(`
        INSERT INTO syllabus_lessons (
          id, unit_id, exam_id, subject_id, standard_number, lesson_number,
          title, term, description, status, display_order, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
        ON CONFLICT (id) DO UPDATE SET
          unit_id = EXCLUDED.unit_id,
          exam_id = EXCLUDED.exam_id,
          subject_id = EXCLUDED.subject_id,
          standard_number = EXCLUDED.standard_number,
          lesson_number = EXCLUDED.lesson_number,
          title = COALESCE(syllabus_lessons.title, EXCLUDED.title),
          term = EXCLUDED.term,
          is_active = true
      `, [lessonId, unitDbId, examId, subjectSlug, standardNum, lessonNumber, title, term, description, status, order]);

      totalLessonsSynced++;

      if (Array.isArray(topics) && topics.length > 0) {
        let tOrd = 1;
        for (const top of topics) {
          const topName = typeof top === 'string' ? top : (top.name || top.topic_name);
          if (!topName || topName.trim().length === 0) continue;
          await client.query(`
            INSERT INTO syllabus_topics (lesson_id, unit_id, topic_name, display_order, is_active)
            VALUES ($1, $2, $3, $4, true)
            ON CONFLICT (lesson_id, topic_name) DO UPDATE SET
              unit_id = EXCLUDED.unit_id,
              is_active = true
          `, [lessonId, unitDbId, topName.trim(), tOrd++]);
        }
      }
    }

    // 3. GROUP 1 SYNC
    const g1 = loadTsModule('../../../src/data/group1SyllabusData.ts');
    const g1Class = loadTsModule('../../../src/data/group1ClassSyllabusData.ts');

    for (const u of (g1.group1GeneralStudiesUnits || [])) {
      await getOrCreateUnit('group1', 'general-studies', u.id, u.unitNumber, u.title, u.tamilTitle, u.questionCount);
    }
    for (const u of (g1.group1AptitudeUnits || [])) {
      await getOrCreateUnit('group1', 'aptitude', u.id, u.unitNumber, u.title, u.title, u.questionCount);
    }

    const g1Registry = g1Class.unitClassRegistry || {};
    for (const [, block] of Object.entries<any>(g1Registry)) {
      const unitDbId = await getOrCreateUnit('group1', 'general-studies', block.unitId, `Unit ${block.unitId}`, block.unitTitle, block.subjectName, 15);
      const lessons = block.lessons || [];
      const topics = block.topics || [];
      const standardNum = block.classId || block.standardNumber || 6;
      let ord = 1;
      for (const l of lessons) {
        await syncLesson(unitDbId, 'group1', 'general-studies', standardNum, l, topics, ord++);
      }
    }

    // 4. GROUP 2 & 2A SYNC
    const g2 = loadTsModule('../../../src/data/group2SyllabusData.ts');
    const g2Class = loadTsModule('../../../src/data/group2ClassSyllabusData.ts');

    for (const s of (g2.group2Subjects || [])) {
      for (const u of (s.units || [])) {
        await getOrCreateUnit('group2', s.id, u.id, u.unitNumber, u.title, u.tamilTitle || s.title, u.questionCount);
      }
    }

    const g2Registry = g2Class.group2ClassRegistry || {};
    for (const [, block] of Object.entries<any>(g2Registry)) {
      const subjectSlug = block.subjectId || 'general-studies';
      const unitNum = block.unitId;
      const standardNum = block.classId || block.standardNumber || 6;
      const unitDbId = await getOrCreateUnit('group2', subjectSlug, unitNum, block.unitNumber || `Unit ${unitNum}`, block.unitTitle, block.subjectTitle || block.subjectName, 15);
      const lessons = block.lessons || [];
      const topics = block.topics || [];
      let ord = 1;
      for (const l of lessons) {
        await syncLesson(unitDbId, 'group2', subjectSlug, standardNum, l, topics, ord++);
      }
    }

    // 5. GROUP 4 SYNC
    const g4 = loadTsModule('../../../src/data/group4SyllabusData.ts');
    const g4Class = loadTsModule('../../../src/data/group4ClassSyllabusData.ts');

    for (const s of (g4.group4Subjects || [])) {
      for (const u of (s.units || [])) {
        await getOrCreateUnit('group4', s.id, u.id, u.unitNumber, u.title, u.tamilTitle || s.title, u.questionCount);
      }
    }

    const g4Registry = g4Class.group4ClassRegistry || {};
    for (const [, block] of Object.entries<any>(g4Registry)) {
      const subjectSlug = block.subjectId || 'general-studies';
      const unitNum = block.unitId;
      const standardNum = block.classId || block.standardNumber || 6;
      const unitDbId = await getOrCreateUnit('group4', subjectSlug, unitNum, block.unitNumber || `Unit ${unitNum}`, block.unitTitle, block.subjectTitle || block.subjectName, 15);
      const lessons = block.lessons || [];
      const topics = block.topics || [];
      let ord = 1;
      for (const l of lessons) {
        await syncLesson(unitDbId, 'group4', subjectSlug, standardNum, l, topics, ord++);
      }
    }

    await client.query('COMMIT');
    console.log(`[Seeder] Complete student syllabus sync done: ${totalLessonsSynced} lessons synced into PostgreSQL.`);
    return totalLessonsSynced;
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[Seeder] Error during student syllabus sync:', err);
    throw err;
  } finally {
    client.release();
  }
}
