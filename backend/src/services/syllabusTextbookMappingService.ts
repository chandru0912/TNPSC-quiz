/**
 * syllabusTextbookMappingService.ts
 *
 * Comprehensive TNPSC Syllabus-to-Textbook Mapping, Scanning, Validation, and Publishing Engine.
 * 
 * Hierarchy:
 * TNPSC Examination
 *   └── TNPSC Group (Group 1, Group 2, Group 4)
 *        └── TNPSC Unit (Unit I – Unit VI)
 *             └── TNPSC Syllabus Topic
 *                  └── Standard (6th–12th)
 *                       └── Subject (Science, Social Science, History, Geography, Civics, Economics, Physics, Chemistry, Botany, Zoology, Political Science, Tamil)
 *                            └── Textbook Unit
 *                                 └── Lesson Number & Title
 *                                      └── Lesson Subtopics
 *                                           └── Study Notes & Questions
 */

import pool from '../db';
import { TNPSC_MASTER_SYLLABUS, MasterTopicDefinition, getMasterTopicsForUnit } from '../data/tnpscSyllabusMasterCatalog';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

export interface MappedSubtopic {
  title: string;
  order: number;
}

export interface MappedLessonItem {
  standardNumber: number;
  subjectName: string;
  term: string;
  textbookUnitTitle?: string;
  lessonNumber: string;
  lessonTitle: string;
  subtopics: MappedSubtopic[];
  confidenceScore: number;
}

export interface TopicMappingResult {
  topicId: string;
  unitNumber: number;
  unitTitle: string;
  topicName: string;
  isCurrentAffairs: boolean;
  mappingStatus: 'FULLY MAPPED' | 'PARTIALLY MAPPED' | 'NOT FOUND IN TEXTBOOK' | 'ADDITIONAL CURRENT AFFAIRS' | 'NEEDS MANUAL VERIFICATION';
  mappedLessons: MappedLessonItem[];
  standardsCovered: number[];
  subjectsCovered: string[];
  totalLessons: number;
  totalSubtopics: number;
  verificationNotes?: string;
}

export interface UnitMappingReport {
  examId: string;
  unitNumber: number;
  unitTitle: string;
  totalTopics: number;
  fullyMappedTopics: number;
  partiallyMappedTopics: number;
  notFoundTopics: number;
  currentAffairsTopics: number;
  totalLessons: number;
  totalSubtopics: number;
  coveragePercentage: number;
  missingTopics: string[];
  topics: TopicMappingResult[];
}

export class SyllabusTextbookMappingService {
  private static cachedRegistry: Record<string, any> | null = null;

  /**
   * Lazily loads authoritative Samacheer Kalvi school textbook data (6th to 12th Standard).
   */
  private static loadSchoolTextbookRegistry(): Record<string, any> {
    if (this.cachedRegistry) return this.cachedRegistry;

    const candidates = [
      path.resolve(__dirname, '../../../src/data/group1ClassSyllabusData.ts'),
      path.resolve(__dirname, '../../src/data/group1ClassSyllabusData.ts'),
      path.resolve(process.cwd(), 'src/data/group1ClassSyllabusData.ts'),
    ];

    for (const f of candidates) {
      if (fs.existsSync(f)) {
        try {
          const code = fs.readFileSync(f, 'utf8');
          const transpiled = ts.transpileModule(code, {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
          });
          const exportsObj: any = {};
          const fn = new Function('exports', 'require', transpiled.outputText);
          fn(exportsObj, require);
          if (exportsObj.unitClassRegistry) {
            this.cachedRegistry = exportsObj.unitClassRegistry;
            return this.cachedRegistry!;
          }
        } catch (err: any) {
          console.warn('[MappingService] Failed to transpile', f, err?.message);
        }
      }
    }

    return {};
  }

  /**
   * Seeds master topics in tnpsc_syllabus_topics for a given exam if missing.
   */
  static async seedMasterTopics(examId: string): Promise<number> {
    const cleanExam = examId.toLowerCase().trim();
    const client = await pool.connect();
    let seeded = 0;

    try {
      await client.query('BEGIN');

      for (const t of TNPSC_MASTER_SYLLABUS) {
        const pk = `${cleanExam}-u${t.unitNumber}-${t.id}`;
        const res = await client.query(
          `INSERT INTO tnpsc_syllabus_topics (
            id, exam_id, unit_number, unit_title, topic_name, is_current_affairs, display_order, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
          ON CONFLICT (exam_id, unit_number, topic_name) DO UPDATE SET
            unit_title = EXCLUDED.unit_title,
            is_current_affairs = EXCLUDED.is_current_affairs,
            display_order = EXCLUDED.display_order
          RETURNING id`,
          [pk, cleanExam, t.unitNumber, t.unitTitle, t.topicName, t.isCurrentAffairs, t.displayOrder]
        );
        if (res.rowCount && res.rowCount > 0) seeded++;
      }

      await client.query('COMMIT');
      return seeded;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Scans Samacheer Kalvi textbooks (6th-12th) and generates the full mapping
   * for a specific Unit or all Units (1-6).
   */
  static async scanAndMapUnit(params: {
    examId: string;
    unitNumber: number | 'all';
    targetStandard?: number | 'all';
  }): Promise<UnitMappingReport[]> {
    const { examId, unitNumber, targetStandard } = params;
    const cleanExam = examId.toLowerCase().trim();

    // Ensure master topics are seeded in database
    await this.seedMasterTopics(cleanExam);

    const schoolRegistry = this.loadSchoolTextbookRegistry();
    const targetUnits = unitNumber === 'all' ? [1, 2, 3, 4, 5, 6] : [Number(unitNumber)];
    const reports: UnitMappingReport[] = [];

    // Standards to check (6 to 12)
    const allStandards = [6, 7, 8, 9, 10, 11, 12];
    const targetStandards = typeof targetStandard === 'number' && targetStandard >= 6 && targetStandard <= 12
      ? [targetStandard]
      : allStandards;

    for (const uNum of targetUnits) {
      const masterTopics = getMasterTopicsForUnit(uNum);
      const unitTitle = masterTopics[0]?.unitTitle || `Unit ${uNum}`;
      const topicResults: TopicMappingResult[] = [];

      let fullyMapped = 0;
      let partiallyMapped = 0;
      let notFound = 0;
      let currentAffairs = 0;
      let totalLessonsInUnit = 0;
      let totalSubtopicsInUnit = 0;
      const missingTopicsList: string[] = [];

      for (const topic of masterTopics) {
        if (topic.isCurrentAffairs) {
          currentAffairs++;
          topicResults.push({
            topicId: `${cleanExam}-u${uNum}-${topic.id}`,
            unitNumber: uNum,
            unitTitle,
            topicName: topic.topicName,
            isCurrentAffairs: true,
            mappingStatus: 'ADDITIONAL CURRENT AFFAIRS',
            mappedLessons: [],
            standardsCovered: [],
            subjectsCovered: [],
            totalLessons: 0,
            totalSubtopics: 0,
            verificationNotes: 'Dynamic current affairs topic. Sourced from recent governmental and scientific publications, not school textbooks.',
          });
          continue;
        }

        const mappedLessons: MappedLessonItem[] = [];
        const standardsCoveredSet = new Set<number>();
        const subjectsCoveredSet = new Set<string>();

        // Scan across requested standards (6 to 12)
        for (const std of targetStandards) {
          const regKey = `${uNum}-${std}`;
          const regData = schoolRegistry[regKey];

          if (regData && Array.isArray(regData.lessons)) {
            for (const l of regData.lessons) {
              const match = this.evaluateLessonMatch(topic, l, regData.subjectName || 'Science');
              if (match.isMatch) {
                // Build subtopics
                const subtopics: MappedSubtopic[] = (regData.topics || [])
                  .filter((tStr: string) => {
                    const cleanT = tStr.toLowerCase();
                    return topic.searchKeywords.some((kw) => cleanT.includes(kw.toLowerCase()));
                  })
                  .slice(0, 5)
                  .map((tStr: string, idx: number) => ({ title: tStr, order: idx + 1 }));

                if (subtopics.length === 0 && l.description) {
                  // Fallback: derive subtopics from lesson description
                  subtopics.push({ title: l.description.slice(0, 80), order: 1 });
                }

                mappedLessons.push({
                  standardNumber: std,
                  subjectName: regData.subjectName || 'General Studies',
                  term: l.term || 'Term 1',
                  textbookUnitTitle: regData.unitTitle,
                  lessonNumber: l.lessonNumber || '1.1',
                  lessonTitle: l.title,
                  subtopics,
                  confidenceScore: match.confidence,
                });

                standardsCoveredSet.add(std);
                subjectsCoveredSet.add(regData.subjectName || 'General Studies');
                totalSubtopicsInUnit += Math.max(1, subtopics.length);
              }
            }
          }
        }

        totalLessonsInUnit += mappedLessons.length;

        // Classify mapping status
        let status: 'FULLY MAPPED' | 'PARTIALLY MAPPED' | 'NOT FOUND IN TEXTBOOK' | 'ADDITIONAL CURRENT AFFAIRS' | 'NEEDS MANUAL VERIFICATION';
        if (mappedLessons.length >= 2 || standardsCoveredSet.size >= 2) {
          status = 'FULLY MAPPED';
          fullyMapped++;
        } else if (mappedLessons.length === 1) {
          status = 'PARTIALLY MAPPED';
          partiallyMapped++;
        } else {
          status = 'NOT FOUND IN TEXTBOOK';
          notFound++;
          missingTopicsList.push(topic.topicName);
        }

        topicResults.push({
          topicId: `${cleanExam}-u${uNum}-${topic.id}`,
          unitNumber: uNum,
          unitTitle,
          topicName: topic.topicName,
          isCurrentAffairs: false,
          mappingStatus: status,
          mappedLessons,
          standardsCovered: Array.from(standardsCoveredSet).sort((a, b) => a - b),
          subjectsCovered: Array.from(subjectsCoveredSet),
          totalLessons: mappedLessons.length,
          totalSubtopics: mappedLessons.reduce((acc, m) => acc + m.subtopics.length, 0),
        });
      }

      const totalStandardTopics = masterTopics.filter((t) => !t.isCurrentAffairs).length;
      const coveragePercentage = totalStandardTopics > 0
        ? Math.round(((fullyMapped + partiallyMapped) / totalStandardTopics) * 100)
        : 100;

      reports.push({
        examId: cleanExam,
        unitNumber: uNum,
        unitTitle,
        totalTopics: masterTopics.length,
        fullyMappedTopics: fullyMapped,
        partiallyMappedTopics: partiallyMapped,
        notFoundTopics: notFound,
        currentAffairsTopics: currentAffairs,
        totalLessons: totalLessonsInUnit,
        totalSubtopics: totalSubtopicsInUnit,
        coveragePercentage,
        missingTopics: missingTopicsList,
        topics: topicResults,
      });
    }

    return reports;
  }

  /**
   * Matches a lesson against a master topic using keywords, title similarity, and subject domain.
   */
  private static evaluateLessonMatch(
    topic: MasterTopicDefinition,
    lesson: any,
    subjectName: string
  ): { isMatch: boolean; confidence: number } {
    const lTitle = (lesson.title || '').toLowerCase();
    const lDesc = (lesson.description || '').toLowerCase();
    const fullLessonText = `${lTitle} ${lDesc} ${subjectName.toLowerCase()}`;

    // 1. Direct name match
    if (lTitle.includes(topic.topicName.toLowerCase())) {
      return { isMatch: true, confidence: 98 };
    }

    // 2. Keyword matching
    let matchedKeywords = 0;
    for (const kw of topic.searchKeywords) {
      const cleanKw = kw.toLowerCase();
      if (fullLessonText.includes(cleanKw)) {
        matchedKeywords++;
      }
    }

    if (matchedKeywords >= 2) {
      return { isMatch: true, confidence: 90 };
    } else if (matchedKeywords === 1) {
      // Check subject match
      const subjectMatch = topic.targetSubjects.some((s) => subjectName.toLowerCase().includes(s.toLowerCase()));
      if (subjectMatch) {
        return { isMatch: true, confidence: 75 };
      }
    }

    return { isMatch: false, confidence: 0 };
  }

  /**
   * Commits approved syllabus-to-textbook mappings into PostgreSQL.
   * Ensures atomic, duplicate-free insertion across:
   * - tnpsc_syllabus_topics
   * - syllabus_topic_mappings
   * - syllabus_units
   * - syllabus_lessons
   * - syllabus_topics
   * - syllabus_import_jobs
   * - syllabus_validation_reports
   */
  static async publishApprovedMappings(params: {
    examId: string;
    reports: UnitMappingReport[];
  }): Promise<{
    success: boolean;
    totalTopicsSaved: number;
    totalMappingsSaved: number;
    totalLessonsSaved: number;
    totalSubtopicsSaved: number;
    jobId: string;
    message: string;
  }> {
    const { examId, reports } = params;
    const cleanExam = examId.toLowerCase().trim();
    const client = await pool.connect();

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let totalTopicsSaved = 0;
    let totalMappingsSaved = 0;
    let totalLessonsSaved = 0;
    let totalSubtopicsSaved = 0;

    try {
      await client.query('BEGIN');

      // 1. Seed/ensure Master Topics
      for (const rep of reports) {
        for (const t of rep.topics) {
          await client.query(
            `INSERT INTO tnpsc_syllabus_topics (
              id, exam_id, unit_number, unit_title, topic_name, is_current_affairs, display_order, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
            ON CONFLICT (exam_id, unit_number, topic_name) DO UPDATE SET
              unit_title = EXCLUDED.unit_title,
              is_current_affairs = EXCLUDED.is_current_affairs`,
            [t.topicId, cleanExam, t.unitNumber, rep.unitTitle, t.topicName, t.isCurrentAffairs, 1]
          );
          totalTopicsSaved++;

          // 2. Iterate each mapped textbook lesson
          for (const l of t.mappedLessons) {
            // Insert into syllabus_topic_mappings
            await client.query(
              `INSERT INTO syllabus_topic_mappings (
                syllabus_topic_id, exam_id, unit_number, standard_number, subject_name,
                term, textbook_unit_title, lesson_number, lesson_title, subtopics,
                mapping_status, confidence_score
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              ON CONFLICT (syllabus_topic_id, standard_number, subject_name, lesson_number, lesson_title) DO UPDATE SET
                subtopics = EXCLUDED.subtopics,
                mapping_status = EXCLUDED.mapping_status,
                confidence_score = EXCLUDED.confidence_score,
                updated_at = CURRENT_TIMESTAMP`,
              [
                t.topicId,
                cleanExam,
                t.unitNumber,
                l.standardNumber,
                l.subjectName,
                l.term,
                l.textbookUnitTitle || rep.unitTitle,
                l.lessonNumber,
                l.lessonTitle,
                JSON.stringify(l.subtopics),
                t.mappingStatus,
                l.confidenceScore,
              ]
            );
            totalMappingsSaved++;

            // 3. Connect to syllabus_units & syllabus_lessons for live Question Bank and Study Materials integration
            const subSlug = l.subjectName.toLowerCase().includes('tamil')
              ? 'general-tamil'
              : l.subjectName.toLowerCase().includes('english')
              ? 'general-english'
              : l.subjectName.toLowerCase().includes('aptitude')
              ? 'aptitude'
              : 'general-studies';

            // Find or insert Unit
            let unitDbId: number;
            const existingUnit = await client.query(
              `SELECT id FROM syllabus_units 
               WHERE exam_id = $1 AND subject_id = $2 AND (standard_number = $3 OR ($3::int IS NULL AND standard_number IS NULL)) AND unit_number = $4`,
              [cleanExam, subSlug, l.standardNumber, t.unitNumber]
            );

            if (existingUnit.rows.length > 0) {
              unitDbId = existingUnit.rows[0].id;
            } else {
              const insUnit = await client.query(
                `INSERT INTO syllabus_units (
                  exam_id, subject_id, standard_number, unit_number, unit_code, title, subject_name,
                  description, question_count, display_order, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 15, $9, true)
                RETURNING id`,
                [
                  cleanExam,
                  subSlug,
                  l.standardNumber,
                  t.unitNumber,
                  `Unit ${t.unitNumber}`,
                  rep.unitTitle,
                  l.subjectName,
                  `Samacheer Kalvi mapped curriculum for Unit ${t.unitNumber}`,
                  t.unitNumber,
                ]
              );
              unitDbId = insUnit.rows[0].id;
            }

            // Insert lesson into syllabus_lessons
            const safeLessonNum = l.lessonNumber.replace(/[^a-zA-Z0-9]/g, '') || '1';
            const rawSlug = l.lessonTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 35);
            const lessonPk = `${cleanExam}-${subSlug}-std${l.standardNumber}-u${t.unitNumber}-l${safeLessonNum}-${rawSlug}`;

            await client.query(
              `INSERT INTO syllabus_lessons (
                id, unit_id, exam_id, subject_id, standard_number, lesson_number,
                title, term, description, status, display_order, is_active
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Available', 1, true)
              ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                standard_number = EXCLUDED.standard_number,
                term = EXCLUDED.term,
                updated_at = CURRENT_TIMESTAMP`,
              [
                lessonPk,
                unitDbId,
                cleanExam,
                subSlug,
                l.standardNumber,
                l.lessonNumber,
                l.lessonTitle,
                l.term,
                `Covered syllabus topic: ${t.topicName}`,
              ]
            );
            totalLessonsSaved++;

            // Insert subtopics into syllabus_topics
            let sOrder = 1;
            for (const sub of l.subtopics) {
              await client.query(
                `INSERT INTO syllabus_topics (
                  lesson_id, unit_id, topic_name, display_order, is_active
                ) VALUES ($1, $2, $3, $4, true)
                ON CONFLICT (lesson_id, topic_name) DO NOTHING`,
                [lessonPk, unitDbId, sub.title, sOrder++]
              );
              totalSubtopicsSaved++;
            }
          }
        }

        // Store Validation Report per unit
        await client.query(
          `INSERT INTO syllabus_validation_reports (exam_id, unit_number, report_data)
           VALUES ($1, $2, $3)`,
          [cleanExam, rep.unitNumber, JSON.stringify(rep)]
        );
      }

      // Record Job in syllabus_import_jobs
      const summaryStats = {
        reportsCount: reports.length,
        totalTopics: totalTopicsSaved,
        totalMappings: totalMappingsSaved,
        totalLessons: totalLessonsSaved,
      };

      await client.query(
        `INSERT INTO syllabus_import_jobs (
          id, exam_id, status, total_topics, total_lessons, total_subtopics, audit_summary
        ) VALUES ($1, $2, 'completed', $3, $4, $5, $6)`,
        [jobId, cleanExam, totalTopicsSaved, totalLessonsSaved, totalSubtopicsSaved, JSON.stringify(summaryStats)]
      );

      await client.query('COMMIT');

      return {
        success: true,
        totalTopicsSaved,
        totalMappingsSaved,
        totalLessonsSaved,
        totalSubtopicsSaved,
        jobId,
        message: `Successfully imported and mapped ${totalTopicsSaved} TNPSC Topics with ${totalLessonsSaved} Samacheer Kalvi Lessons across Standards 6th-12th.`,
      };
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[MappingService] Publish failed:', err);
      throw new Error(`Failed to commit syllabus mapping: ${err.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves full hierarchical mapping tree for Admin Preview and student modules.
   */
  static async getMappingHierarchy(params: {
    examId: string;
    unitNumber?: number | 'all';
    standard?: number | 'all';
  }): Promise<any[]> {
    const { examId, unitNumber, standard } = params;
    const cleanExam = examId.toLowerCase().trim();

    let query = `
      SELECT 
        t.unit_number,
        t.unit_title,
        t.id AS topic_id,
        t.topic_name,
        t.is_current_affairs,
        m.id AS mapping_id,
        m.standard_number,
        m.subject_name,
        m.term,
        m.textbook_unit_title,
        m.lesson_number,
        m.lesson_title,
        m.subtopics,
        m.mapping_status,
        m.confidence_score
      FROM tnpsc_syllabus_topics t
      LEFT JOIN syllabus_topic_mappings m ON t.id = m.syllabus_topic_id
      WHERE t.exam_id = $1 AND t.is_active = true
    `;
    const values: any[] = [cleanExam];
    let idx = 2;

    if (unitNumber && unitNumber !== 'all') {
      query += ` AND t.unit_number = $${idx++}`;
      values.push(Number(unitNumber));
    }

    if (standard && standard !== 'all') {
      query += ` AND (m.standard_number = $${idx++} OR m.standard_number IS NULL)`;
      values.push(Number(standard));
    }

    query += ` ORDER BY t.unit_number, t.display_order, m.standard_number, m.lesson_number`;

    const res = await pool.query(query, values);

    // Group rows into 7-level nested hierarchy:
    // Unit -> Topic -> Standard -> Subject -> Unit -> Lesson -> Subtopics
    const unitsMap = new Map<number, any>();

    for (const r of res.rows) {
      if (!unitsMap.has(r.unit_number)) {
        unitsMap.set(r.unit_number, {
          unitNumber: r.unit_number,
          unitTitle: r.unit_title,
          topics: new Map<string, any>(),
        });
      }

      const uObj = unitsMap.get(r.unit_number);
      if (!uObj.topics.has(r.topic_id)) {
        uObj.topics.set(r.topic_id, {
          topicId: r.topic_id,
          topicName: r.topic_name,
          isCurrentAffairs: r.is_current_affairs,
          mappingStatus: r.mapping_status || (r.is_current_affairs ? 'ADDITIONAL CURRENT AFFAIRS' : 'NOT FOUND IN TEXTBOOK'),
          standards: new Map<number, any>(),
        });
      }

      if (r.standard_number) {
        const tObj = uObj.topics.get(r.topic_id);
        if (!tObj.standards.has(r.standard_number)) {
          tObj.standards.set(r.standard_number, {
            standardNumber: r.standard_number,
            standardTitle: `${r.standard_number}th Standard`,
            subjects: new Map<string, any>(),
          });
        }

        const sObj = tObj.standards.get(r.standard_number);
        if (!sObj.subjects.has(r.subject_name)) {
          sObj.subjects.set(r.subject_name, {
            subjectName: r.subject_name,
            lessons: [],
          });
        }

        const subObj = sObj.subjects.get(r.subject_name);
        subObj.lessons.push({
          lessonNumber: r.lesson_number,
          lessonTitle: r.lesson_title,
          term: r.term,
          textbookUnitTitle: r.textbook_unit_title,
          confidenceScore: r.confidence_score,
          subtopics: r.subtopics || [],
        });
      }
    }

    // Convert Maps to nested Arrays
    return Array.from(unitsMap.values()).map((u) => ({
      unitNumber: u.unitNumber,
      unitTitle: u.unitTitle,
      topics: Array.from(u.topics.values()).map((t: any) => ({
        topicId: t.topicId,
        topicName: t.topicName,
        isCurrentAffairs: t.isCurrentAffairs,
        mappingStatus: t.mappingStatus,
        standards: Array.from(t.standards.values()).map((s: any) => ({
          standardNumber: s.standardNumber,
          standardTitle: s.standardTitle,
          subjects: Array.from(s.subjects.values()),
        })),
      })),
    }));
  }
}

