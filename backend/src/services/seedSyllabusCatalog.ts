import pool from '../db';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { AISyllabusEngineService } from './aiSyllabusEngineService';

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

    // Remove any stray 'all' subject rows
    await client.query(`DELETE FROM syllabus_subjects WHERE subject_slug = 'all' OR id LIKE '%-all'`);

    // 1. Ensure Canonical Exams (Preserving both group2 and group2a in DB while naming group2 "TNPSC Group 2 & 2A")
    await client.query(`
      INSERT INTO syllabus_exams (id, name, code, badge, description, display_order, is_active) VALUES
        ('group1', 'TNPSC Group 1', 'Code: 497', 'Degree Standard • Prelims', 'Deputy Collector, DSP, Commercial Tax Officer', 1, true),
        ('group2', 'TNPSC Group 2 & 2A', 'Code: 495', 'Degree Standard • Combined Prelims (Interview & Non-Interview Posts)', 'Sub Registrar, Municipal Commissioner, Probation Officer, ASO', 2, true),
        ('group2a', 'TNPSC Group 2A', 'Code: 495A', 'Degree Standard • Non-Interview Posts', 'Assistant Section Officer, Senior Inspector, Audit Inspector', 3, true),
        ('group4', 'TNPSC Group 4', 'Code: 496', 'SSLC Standard • Single Paper', 'Junior Assistant, VAO, Bill Collector, Typist', 4, true)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        code = COALESCE(syllabus_exams.code, EXCLUDED.code),
        badge = COALESCE(syllabus_exams.badge, EXCLUDED.badge),
        description = COALESCE(syllabus_exams.description, EXCLUDED.description),
        display_order = EXCLUDED.display_order,
        is_active = true;
    `);

    // 2. Ensure Canonical Subjects for all 4 Groups
    const canonicalSubjects = [
      { id: 'group1-general-studies', exam: 'group1', slug: 'general-studies', name: 'General Studies', desc: 'General Science, History, Polity, Economy, Geography, TN Heritage', ord: 1 },
      { id: 'group1-aptitude', exam: 'group1', slug: 'aptitude', name: 'Aptitude and Mental Ability', desc: 'Mental ability, Simplification, Ratio, Logical reasoning', ord: 2 },
      { id: 'group2-general-studies', exam: 'group2', slug: 'general-studies', name: 'General Studies', desc: 'General Science, History, Polity, Economy, Geography, TN Heritage', ord: 1 },
      { id: 'group2-aptitude', exam: 'group2', slug: 'aptitude', name: 'Aptitude and Mental Ability', desc: 'Mental ability, Simplification, Ratio, Logical reasoning', ord: 2 },
      { id: 'group2-general-english', exam: 'group2', slug: 'general-english', name: 'General English', desc: 'Grammar, Literature, Vocabulary, Comprehension', ord: 3 },
      { id: 'group2-general-tamil', exam: 'group2', slug: 'general-tamil', name: 'General Tamil', desc: 'இலக்கணம், சொல்லகராதி, எழுதும் திறன், கலைச் சொற்கள், வாசித்தல், மொழிபெயர்ப்பு, இலக்கியம்', ord: 4 },
      { id: 'group2a-general-studies', exam: 'group2a', slug: 'general-studies', name: 'General Studies', desc: 'General Science, History, Polity, Economy, Geography, TN Heritage', ord: 1 },
      { id: 'group2a-aptitude', exam: 'group2a', slug: 'aptitude', name: 'Aptitude and Mental Ability', desc: 'Mental ability, Simplification, Ratio, Logical reasoning', ord: 2 },
      { id: 'group2a-general-english', exam: 'group2a', slug: 'general-english', name: 'General English', desc: 'Grammar, Literature, Vocabulary, Comprehension', ord: 3 },
      { id: 'group2a-general-tamil', exam: 'group2a', slug: 'general-tamil', name: 'General Tamil', desc: 'இலக்கணம், சொல்லகராதி, எழுதும் திறன், கலைச் சொற்கள், வாசித்தல், மொழிபெயர்ப்பு, இலக்கியம்', ord: 4 },
      { id: 'group4-general-studies', exam: 'group4', slug: 'general-studies', name: 'General Studies', desc: 'General Science, History, Polity, Economy, Geography, TN Heritage', ord: 1 },
      { id: 'group4-aptitude', exam: 'group4', slug: 'aptitude', name: 'Aptitude and Mental Ability', desc: 'Mental ability, Simplification, Ratio, Logical reasoning', ord: 2 },
      { id: 'group4-general-tamil', exam: 'group4', slug: 'general-tamil', name: 'General Tamil', desc: 'இலக்கணம், சொல்லகராதி, எழுதும் திறன், கலைச் சொற்கள், வாசித்தல், மொழிபெயர்ப்பு, இலக்கியம்', ord: 3 },
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
      qCount: number,
      description?: string
    ): Promise<number> {
      const q = await client.query(
        `SELECT id FROM syllabus_units 
         WHERE exam_id = $1 AND (subject_id = $2 OR subject_id = $3) AND unit_number = $4 AND standard_number IS NULL`,
        [examId, subjectSlug, `${examId}-${subjectSlug}`, unitNum]
      );
      if (q.rows.length > 0) {
        return q.rows[0].id;
      }
      const ins = await client.query(
        `INSERT INTO syllabus_units (
          exam_id, subject_id, standard_number, unit_number, unit_code, title, subject_name,
          description, question_count, display_order, is_active
        ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, true)
        RETURNING id`,
        [
          examId,
          subjectSlug,
          unitNum,
          unitCode || `Unit ${unitNum}`,
          title,
          subjectName || title,
          description || title,
          qCount || 15,
          unitNum,
        ]
      );
      return ins.rows[0].id;
    }

    // Helper to insert or update lesson and lesson-specific focus areas
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
      const lessonNumber = lessonObj.lessonNumber || lessonObj.lesson_number || String(order);
      const title = lessonObj.title;
      const term = lessonObj.term || 'Term 1';
      const description = lessonObj.description || `Samacheer Kalvi Class ${standardNum} (${term}) — ${title}`;
      const status = lessonObj.status || 'Available';
      const textbookTitle = lessonObj.textbook_title || `Samacheer Kalvi Class ${standardNum}`;
      const textbookUnitNum = lessonObj.textbook_unit_number || String(lessonNumber).split('.')[0] || '1';
      const textbookUnitTitle = lessonObj.textbook_unit_title || (subjectSlug === 'general-tamil' ? `இயல் ${textbookUnitNum} (${term})` : `Textbook Unit ${textbookUnitNum} (${term})`);
      const matchedTopicsJson = JSON.stringify(lessonObj.matched_syllabus_topics || []);
      const syllabusRef = lessonObj.syllabus_reference || null;
      const pageRef = lessonObj.textbook_page_reference || `Class ${standardNum} • ${term} • Lesson ${lessonNumber}`;

      await client.query(`
        INSERT INTO syllabus_lessons (
          id, unit_id, exam_id, subject_id, standard_number, lesson_number,
          title, term, description, status, display_order, is_active,
          textbook_title, textbook_unit_number, textbook_unit_title,
          matched_topics, syllabus_reference, textbook_page_reference,
          mapping_status, verification_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, $12, $13, $14, $15::jsonb, $16, $17, 'FULLY MAPPED', 'VERIFIED')
        ON CONFLICT (id) DO UPDATE SET
          unit_id = EXCLUDED.unit_id,
          exam_id = EXCLUDED.exam_id,
          subject_id = EXCLUDED.subject_id,
          standard_number = EXCLUDED.standard_number,
          lesson_number = EXCLUDED.lesson_number,
          title = COALESCE(syllabus_lessons.title, EXCLUDED.title),
          term = EXCLUDED.term,
          textbook_title = COALESCE(syllabus_lessons.textbook_title, EXCLUDED.textbook_title),
          textbook_unit_number = COALESCE(syllabus_lessons.textbook_unit_number, EXCLUDED.textbook_unit_number),
          textbook_unit_title = COALESCE(syllabus_lessons.textbook_unit_title, EXCLUDED.textbook_unit_title),
          matched_topics = CASE WHEN syllabus_lessons.matched_topics IS NULL OR syllabus_lessons.matched_topics = '[]'::jsonb THEN EXCLUDED.matched_topics ELSE syllabus_lessons.matched_topics END,
          syllabus_reference = COALESCE(syllabus_lessons.syllabus_reference, EXCLUDED.syllabus_reference),
          textbook_page_reference = COALESCE(syllabus_lessons.textbook_page_reference, EXCLUDED.textbook_page_reference),
          is_active = true
      `, [
        lessonId,
        unitDbId,
        examId,
        subjectSlug,
        standardNum,
        lessonNumber,
        title,
        term,
        description,
        status,
        order,
        textbookTitle,
        textbookUnitNum,
        textbookUnitTitle,
        matchedTopicsJson,
        syllabusRef,
        pageRef,
      ]);

      totalLessonsSynced++;

      if (Array.isArray(topics) && topics.length > 0) {
        let tOrd = 1;
        for (const top of topics) {
          const topName = typeof top === 'string' ? top : (top.name || top.topic_name);
          const topRef = typeof top === 'object' && top !== null ? top.syllabus_reference : syllabusRef;
          if (!topName || topName.trim().length === 0) continue;
          await client.query(`
            INSERT INTO syllabus_topics (lesson_id, unit_id, topic_name, syllabus_reference, display_order, is_active)
            VALUES ($1, $2, $3, $4, $5, true)
            ON CONFLICT (lesson_id, topic_name) DO UPDATE SET
              unit_id = EXCLUDED.unit_id,
              syllabus_reference = COALESCE(syllabus_topics.syllabus_reference, EXCLUDED.syllabus_reference),
              is_active = true
          `, [lessonId, unitDbId, topName.trim(), topRef || null, tOrd++]);
        }
      }
    }

    // 3. Seed canonical units, textbook lessons, and lesson-specific Focus Areas across all 4 groups
    const groupSubjectMatrix: Array<{ examId: string; subjects: string[]; standards: number[] }> = [
      { examId: 'group1', subjects: ['general-studies', 'aptitude'], standards: [6, 7, 8, 9, 10, 11, 12] },
      { examId: 'group2', subjects: ['general-studies', 'aptitude', 'general-english', 'general-tamil'], standards: [6, 7, 8, 9, 10, 11, 12] },
      { examId: 'group2a', subjects: ['general-studies', 'aptitude', 'general-english', 'general-tamil'], standards: [6, 7, 8, 9, 10, 11, 12] },
      { examId: 'group4', subjects: ['general-studies', 'aptitude', 'general-tamil', 'general-english'], standards: [6, 7, 8, 9, 10, 11, 12] },
    ];

    for (const groupEntry of groupSubjectMatrix) {
      const { examId, subjects, standards } = groupEntry;
      for (const subjectSlug of subjects) {
        const canonicalUnits = AISyllabusEngineService.getCanonicalUnitsForSubject(examId, subjectSlug, standards);
        for (const uDraft of canonicalUnits) {
          const unitDesc = Array.isArray(uDraft.syllabus_topics) && uDraft.syllabus_topics.length > 0
            ? uDraft.syllabus_topics.join(' • ')
            : uDraft.title;
          const unitDbId = await getOrCreateUnit(
            examId,
            subjectSlug,
            uDraft.unit_number,
            uDraft.unit_code,
            uDraft.title,
            uDraft.subject_name || uDraft.title,
            15,
            unitDesc
          );

          // Group lessons by standard so display_order is 1..N per standard
          const byStd = new Map<number, typeof uDraft.lessons>();
          for (const l of uDraft.lessons || []) {
            const list = byStd.get(l.standard_number) || [];
            list.push(l);
            byStd.set(l.standard_number, list);
          }

          for (const [stdNum, stdLessons] of byStd.entries()) {
            let ord = 1;
            for (const l of stdLessons) {
              const deterministicId = `${examId}-${subjectSlug}-u${uDraft.unit_number}-s${stdNum}-l${String(l.lesson_number).replace(/[^a-zA-Z0-9]/g, '_')}`;
              await syncLesson(
                unitDbId,
                examId,
                subjectSlug,
                stdNum,
                {
                  ...l,
                  id: deterministicId,
                },
                l.topics || [],
                ord++
              );
            }
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log(`[Seeder] Complete syllabus & focus areas sync done: ${totalLessonsSynced} lessons synced across Group 1, Group 2, Group 2A, and Group 4.`);
    return totalLessonsSynced;
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[Seeder] Error during student syllabus sync:', err);
    throw err;
  } finally {
    client.release();
  }
}
