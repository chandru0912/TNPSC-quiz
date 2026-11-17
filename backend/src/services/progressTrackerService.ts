import pool from '../db';
import { calculateSafePercentage, getStudentDashboardData } from './studentDashboardService';

const TNPSC_UNITS = [
  { unitNumber: 1, unitCode: 'Unit I', unitName: 'General Science', weightageQuestions: 15, keywords: ['science', 'physics', 'chemistry', 'biology', 'botany', 'zoology'] },
  { unitNumber: 2, unitCode: 'Unit II', unitName: 'Current Events', weightageQuestions: 15, keywords: ['current', 'events', 'affairs'] },
  { unitNumber: 3, unitCode: 'Unit III', unitName: 'Geography of India & Tamil Nadu', weightageQuestions: 12, keywords: ['geography', 'monsoon', 'rivers', 'climate'] },
  { unitNumber: 4, unitCode: 'Unit IV', unitName: 'History and Culture of India', weightageQuestions: 15, keywords: ['history', 'culture', 'indus', 'gupta', 'mughal', 'heritage'] },
  { unitNumber: 5, unitCode: 'Unit V', unitName: 'Indian Polity & Constitution', weightageQuestions: 18, keywords: ['polity', 'constitution', 'parliament', 'fundamental rights', 'judiciary'] },
  { unitNumber: 6, unitCode: 'Unit VI', unitName: 'Indian Economy & Planning', weightageQuestions: 12, keywords: ['economy', 'economic', 'planning', 'rbi', 'fiscal', 'gst'] },
  { unitNumber: 7, unitCode: 'Unit VII', unitName: 'Indian National Movement', weightageQuestions: 15, keywords: ['national movement', 'freedom', 'gandhi', 'independence', 'congress'] },
  { unitNumber: 8, unitCode: 'Unit VIII', unitName: 'History, Culture & Heritage of TN', weightageQuestions: 40, keywords: ['tamil nadu', 'sangam', 'thirukkural', 'chola', 'pandya', 'pallava', 'tamil'] },
  { unitNumber: 9, unitCode: 'Unit IX', unitName: 'Development Administration in TN', weightageQuestions: 30, keywords: ['development administration', 'e-governance', 'reservation', 'welfare', 'social justice'] },
  { unitNumber: 10, unitCode: 'Unit X', unitName: 'Aptitude & Mental Ability', weightageQuestions: 25, keywords: ['aptitude', 'mental ability', 'lcm', 'hcf', 'percentage', 'ratio', 'reasoning', 'math'] },
];

function matchUnitNumber(unitId: number | null, subject: string | null, lessonTitle: string | null): number | null {
  if (unitId && unitId >= 1 && unitId <= 10) return unitId;
  const combined = `${subject || ''} ${lessonTitle || ''}`.toLowerCase();
  for (const u of TNPSC_UNITS) {
    if (u.keywords.some((kw) => combined.includes(kw))) {
      return u.unitNumber;
    }
  }
  return null;
}

export async function getStudentProgressTrackerData(studentId: number) {
  const [
    dashboard,
    standardsCatalogRes,
    standardSubjectsRes,
    studentMaterialRes,
    unitTopicsCatalogRes,
    qaBySourceRes,
    qaHistoryRes,
    mockAccuracyRes,
    mockHistoryRes,
    allQaRes,
    calendarRes,
  ] = await Promise.all([
    getStudentDashboardData(studentId),
    pool.query(`
      SELECT
        standard_number AS standard,
        COUNT(DISTINCT LOWER(TRIM(title)))::int AS total_chapters,
        COUNT(DISTINCT subject_id)::int AS subject_count
      FROM syllabus_lessons
      WHERE standard_number BETWEEN 6 AND 12
        AND COALESCE(is_active, true) = true
      GROUP BY standard_number
      ORDER BY standard_number ASC
    `),
    pool.query(`
      SELECT
        sl.standard_number AS standard,
        COALESCE(ss.name, 'General') AS subject_name,
        COUNT(DISTINCT LOWER(TRIM(sl.title)))::int AS total_chapters
      FROM syllabus_lessons sl
      LEFT JOIN syllabus_subjects ss ON ss.id = sl.subject_id
      WHERE sl.standard_number BETWEEN 6 AND 12
        AND COALESCE(sl.is_active, true) = true
      GROUP BY sl.standard_number, COALESCE(ss.name, 'General')
      ORDER BY sl.standard_number ASC, subject_name ASC
    `),
    pool.query(
      `SELECT
         standard,
         subject,
         unit_id,
         lesson_title,
         is_completed,
         reading_time_seconds,
         last_accessed_at
       FROM study_material_progress
       WHERE student_id = $1`,
      [studentId]
    ),
    pool.query(`
      SELECT
        su.unit_number,
        COUNT(DISTINCT sl.id)::int AS total_topics
      FROM syllabus_units su
      JOIN syllabus_lessons sl ON sl.unit_id = su.id
      WHERE su.unit_number BETWEEN 1 AND 10
      GROUP BY su.unit_number
    `),
    pool.query(
      `SELECT
         CASE
           WHEN source_system = 'study_materials' THEN 'study_materials'
           ELSE 'mcq_practice'
         END AS bucket,
         COUNT(*)::int AS attempted,
         COUNT(CASE WHEN is_correct THEN 1 END)::int AS correct,
         COUNT(CASE WHEN NOT is_correct THEN 1 END)::int AS incorrect
       FROM question_attempts
       WHERE student_id = $1
         AND source_system <> 'mock_test'
         AND selected_option IS NOT NULL
         AND selected_option >= 0
       GROUP BY bucket`,
      [studentId]
    ),
    pool.query(
      `SELECT
         source_system,
         subject,
         lesson_title,
         is_correct,
         attempted_at
       FROM question_attempts
       WHERE student_id = $1
         AND source_system <> 'mock_test'
         AND selected_option IS NOT NULL
         AND selected_option >= 0
       ORDER BY attempted_at DESC
       LIMIT 15`,
      [studentId]
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(attempted_questions), 0)::int AS attempted,
         COALESCE(SUM(correct_answers), 0)::int AS correct,
         COALESCE(SUM(incorrect_answers), 0)::int AS incorrect,
         COUNT(*)::int AS tests_completed
       FROM mock_test_attempts
       WHERE student_id = $1
         AND COALESCE(assessment_type, 'mock_test') = 'mock_test'
         AND COALESCE(status, 'completed') = 'completed'
         AND attempted_questions > 0`,
      [studentId]
    ),
    pool.query(
      `SELECT
         id,
         test_title,
         attempted_questions,
         correct_answers,
         percentage,
         completed_at
       FROM mock_test_attempts
       WHERE student_id = $1
         AND COALESCE(assessment_type, 'mock_test') = 'mock_test'
         AND COALESCE(status, 'completed') = 'completed'
         AND attempted_questions > 0
       ORDER BY completed_at DESC
       LIMIT 8`,
      [studentId]
    ),
    pool.query(
      `SELECT unit_id, subject, lesson_title, is_correct
       FROM question_attempts
       WHERE student_id = $1
         AND selected_option IS NOT NULL
         AND selected_option >= 0`,
      [studentId]
    ),
    pool.query(
      `SELECT
         TO_CHAR(activity_date, 'YYYY-MM-DD') AS date_str,
         COALESCE(study_seconds, 0)::int AS study_seconds,
         COALESCE(questions_count, 0)::int AS questions_count,
         COALESCE(notes_count, 0)::int AS lessons_count,
         COALESCE(mock_tests_count, 0)::int AS mock_tests_count
       FROM daily_streaks
       WHERE student_id = $1
         AND activity_date >= (timezone('Asia/Kolkata', CURRENT_TIMESTAMP)::date - INTERVAL '29 days')
       ORDER BY activity_date ASC`,
      [studentId]
    ),
  ]);

  if (!dashboard) return null;

  // 1. Samacheer Kalvi Standards Coverage (6th to 12th)
  const catalogByStd = new Map<number, { totalChapters: number; subjectCount: number }>();
  standardsCatalogRes.rows.forEach((r) => {
    catalogByStd.set(Number(r.standard), {
      totalChapters: Number(r.total_chapters || 0),
      subjectCount: Number(r.subject_count || 0),
    });
  });

  const subjectCatalogByStd = new Map<number, { subject: string; totalChapters: number }[]>();
  standardSubjectsRes.rows.forEach((r) => {
    const std = Number(r.standard);
    const arr = subjectCatalogByStd.get(std) || [];
    arr.push({ subject: r.subject_name, totalChapters: Number(r.total_chapters || 0) });
    subjectCatalogByStd.set(std, arr);
  });

  const progressRows = studentMaterialRes.rows;
  const standards = [6, 7, 8, 9, 10, 11, 12].map((std) => {
    const cat = catalogByStd.get(std) || { totalChapters: 0, subjectCount: 0 };
    const stdRows = progressRows.filter((r) => Number(r.standard) === std);
    const completedSet = new Set(
      stdRows
        .filter((r) => Boolean(r.is_completed))
        .map((r) => String(r.lesson_title || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const inProgressSet = new Set(
      stdRows
        .filter((r) => !r.is_completed)
        .map((r) => String(r.lesson_title || '').trim().toLowerCase())
        .filter((k) => k && !completedSet.has(k))
    );

    const completedChapters = completedSet.size;
    const inProgressChapters = inProgressSet.size;
    const totalChapters = Math.max(cat.totalChapters, completedChapters + inProgressChapters);
    const notStartedChapters = Math.max(0, totalChapters - completedChapters - inProgressChapters);
    const percentage = calculateSafePercentage(completedChapters, totalChapters);

    const subjList = (subjectCatalogByStd.get(std) || []).map((s) => {
      const subjCompleted = new Set(
        stdRows
          .filter(
            (r) =>
              Boolean(r.is_completed) &&
              String(r.subject || '').toLowerCase().includes(s.subject.toLowerCase().split(' ')[0])
          )
          .map((r) => String(r.lesson_title || '').trim().toLowerCase())
      ).size;
      return {
        subject: s.subject,
        completedChapters: subjCompleted,
        totalChapters: s.totalChapters,
        percentage: calculateSafePercentage(subjCompleted, s.totalChapters),
      };
    });

    const label =
      std === 10
        ? '10th Standard (SSLC)'
        : std === 11
          ? '11th Standard (HSC)'
          : std === 12
            ? '12th Standard (HSC)'
            : `${std}th Standard`;

    return {
      standard: std,
      label,
      totalChapters,
      completedChapters,
      inProgressChapters,
      notStartedChapters,
      percentage,
      subjectCount: cat.subjectCount,
      subjects: subjList,
    };
  });

  // 2. TNPSC General Studies Unit Mastery (Unit I - Unit X, separate coverage & accuracy)
  const unitTopicTotals = new Map<number, number>();
  unitTopicsCatalogRes.rows.forEach((r) => {
    unitTopicTotals.set(Number(r.unit_number), Number(r.total_topics || 0));
  });

  const unitCompletedSets = new Map<number, Set<string>>();
  for (const r of progressRows) {
    if (!r.is_completed) continue;
    const uNum = matchUnitNumber(r.unit_id ? Number(r.unit_id) : null, r.subject, r.lesson_title);
    if (!uNum) continue;
    const set = unitCompletedSets.get(uNum) || new Set<string>();
    set.add(String(r.lesson_title || '').trim().toLowerCase());
    unitCompletedSets.set(uNum, set);
  }

  const unitQaStats = new Map<number, { attempted: number; correct: number }>();
  for (const r of allQaRes.rows) {
    const uNum = matchUnitNumber(r.unit_id ? Number(r.unit_id) : null, r.subject, r.lesson_title);
    if (!uNum) continue;
    const cur = unitQaStats.get(uNum) || { attempted: 0, correct: 0 };
    cur.attempted += 1;
    if (r.is_correct) cur.correct += 1;
    unitQaStats.set(uNum, cur);
  }

  const units = TNPSC_UNITS.map((u) => {
    const completedTopics = unitCompletedSets.get(u.unitNumber)?.size || 0;
    const totalTopics = Math.max(completedTopics, unitTopicTotals.get(u.unitNumber) || 0);
    const rawCoverage = calculateSafePercentage(completedTopics, totalTopics);
    const coverage = completedTopics > 0 && totalTopics > 0 ? Math.max(1, rawCoverage) : rawCoverage;
    const qa = unitQaStats.get(u.unitNumber) || { attempted: 0, correct: 0 };
    const accuracy = calculateSafePercentage(qa.correct, qa.attempted);
    return {
      unitCode: u.unitCode,
      unitName: u.unitName,
      weightageQuestions: u.weightageQuestions,
      completedTopics,
      totalTopics,
      coverage,
      attemptedQuestions: qa.attempted,
      correctAnswers: qa.correct,
      accuracy,
    };
  });

  // 3. Separate Accuracy Analytics (Study Materials, MCQ Practice, Mock Tests)
  const qaBucketMap = new Map<string, { attempted: number; correct: number; incorrect: number }>();
  qaBySourceRes.rows.forEach((r) => {
    qaBucketMap.set(r.bucket, {
      attempted: Number(r.attempted || 0),
      correct: Number(r.correct || 0),
      incorrect: Number(r.incorrect || 0),
    });
  });

  const smQa = qaBucketMap.get('study_materials') || { attempted: 0, correct: 0, incorrect: 0 };
  const mcqQa = qaBucketMap.get('mcq_practice') || { attempted: 0, correct: 0, incorrect: 0 };
  const mockRow = mockAccuracyRes.rows[0] || { attempted: 0, correct: 0, incorrect: 0, tests_completed: 0 };
  const mockQa = {
    attempted: Number(mockRow.attempted || 0),
    correct: Number(mockRow.correct || 0),
    incorrect: Number(mockRow.incorrect || 0),
  };

  // Reusable independent MCQ Practice Performance dataset
  const mcqPerformance = await getStudentMcqPerformance(studentId, dashboard.student?.targetGroup);

  const categoryAccuracy = {
    studyMaterials: {
      ...smQa,
      accuracy: calculateSafePercentage(smQa.correct, smQa.attempted),
      history: qaHistoryRes.rows
        .filter((r) => r.source_system === 'study_materials')
        .slice(0, 5)
        .map((r) => ({
          title: r.lesson_title || r.subject || 'Study Material MCQ',
          isCorrect: Boolean(r.is_correct),
          date: r.attempted_at,
        })),
    },
    mcqPractice: {
      ...mcqQa,
      accuracy: calculateSafePercentage(mcqQa.correct, mcqQa.attempted),
      testsCompleted: mcqPerformance.completedTests,
      history: qaHistoryRes.rows
        .filter((r) => r.source_system !== 'study_materials')
        .slice(0, 5)
        .map((r) => ({
          title: r.lesson_title || r.subject || 'MCQ Practice',
          isCorrect: Boolean(r.is_correct),
          date: r.attempted_at,
        })),
    },
    mockTests: {
      ...mockQa,
      accuracy: calculateSafePercentage(mockQa.correct, mockQa.attempted),
      testsCompleted: Number(mockRow.tests_completed || 0),
      history: mockHistoryRes.rows.map((r) => ({
        id: r.id,
        title: r.test_title,
        attempted: Number(r.attempted_questions || 0),
        correct: Number(r.correct_answers || 0),
        percentage: Math.round(parseFloat(r.percentage || '0')),
        date: r.completed_at,
      })),
    },
  };

  // 4. 30-Day Study Activity Calendar (IST / Asia/Kolkata)
  const calMap = new Map<string, { studySeconds: number; questionsCount: number; lessonsCount: number; mockTestsCount: number }>();
  calendarRes.rows.forEach((r) => {
    calMap.set(r.date_str, {
      studySeconds: Number(r.study_seconds || 0),
      questionsCount: Number(r.questions_count || 0),
      lessonsCount: Number(r.lessons_count || 0),
      mockTestsCount: Number(r.mock_tests_count || 0),
    });
  });

  const nowIstRes = await pool.query(`SELECT TO_CHAR(timezone('Asia/Kolkata', CURRENT_TIMESTAMP), 'YYYY-MM-DD') AS today_ist`);
  const todayIst = nowIstRes.rows[0]?.today_ist || new Date().toISOString().slice(0, 10);
  const cursor = new Date(`${todayIst}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() - 29);

  const studyCalendar: {
    date: string;
    dayLabel: string;
    studySeconds: number;
    questionsCount: number;
    lessonsCount: number;
    mockTestsCount: number;
    isActive: boolean;
  }[] = [];

  for (let i = 0; i < 30; i++) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const rec = calMap.get(dateStr) || { studySeconds: 0, questionsCount: 0, lessonsCount: 0, mockTestsCount: 0 };
    const isActive =
      rec.studySeconds >= 60 || rec.questionsCount > 0 || rec.lessonsCount > 0 || rec.mockTestsCount > 0;
    studyCalendar.push({
      date: dateStr,
      dayLabel: cursor.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
      ...rec,
      isActive,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const activeDays30 = studyCalendar.filter((d) => d.isActive).length;
  const activeDays7 = studyCalendar.slice(-7).filter((d) => d.isActive).length;

  return {
    metrics: dashboard.metrics,
    weeklyProgress: dashboard.weeklyProgress,
    standards,
    units,
    categoryAccuracy,
    mcqPerformance,
    studyCalendar,
    consistency: {
      weeklyConsistencyPct: calculateSafePercentage(activeDays7, 7),
      monthlyConsistencyPct: calculateSafePercentage(activeDays30, 30),
      activeDays7,
      activeDays30,
      inactiveDays30: 30 - activeDays30,
    },
  };
}

/**
 * Reusable student-specific MCQ Practice performance dataset.
 * Strictly isolated from Study Materials and Mock Tests.
 */
export async function getStudentMcqPerformance(studentId: number, targetGroup?: string | null) {
  const [availableRes, attemptsRes, testsRes, lessonTotalsRes] = await Promise.all([
    pool.query(`SELECT COUNT(DISTINCT id)::int AS total_available FROM questions WHERE status = 'published'`),
    pool.query(
      `SELECT
         question_id,
         COALESCE(NULLIF(TRIM(subject), ''), 'General Studies') AS subject,
         class_id,
         unit_id,
         lesson_id,
         COALESCE(NULLIF(TRIM(lesson_title), ''), 'General Practice') AS lesson_title,
         is_correct
       FROM question_attempts
       WHERE student_id = $1
         AND source_system NOT IN ('study_materials', 'mock_test')
         AND selected_option IS NOT NULL
         AND selected_option >= 0`,
      [studentId]
    ),
    pool.query(
      `SELECT
         status,
         COALESCE(total_questions, 0)::int AS total_questions,
         COALESCE(attempted_questions, 0)::int AS attempted_questions,
         COALESCE(correct_answers, 0)::int AS correct_answers,
         COALESCE(unanswered_questions, 0)::int AS unanswered_questions,
         COALESCE(score, 0)::float AS score,
         COALESCE(max_score, 0)::float AS max_score,
         COALESCE(percentage, 0)::float AS percentage
       FROM mock_test_attempts
       WHERE student_id = $1
         AND assessment_type IN ('lesson_quiz', 'subject_drill')`,
      [studentId]
    ),
    pool.query(
      `SELECT
         COALESCE(NULLIF(TRIM(lesson_title), ''), 'General Practice') AS lesson_title,
         COALESCE(NULLIF(TRIM(subject), ''), 'General Studies') AS subject,
         class_id,
         COUNT(DISTINCT id)::int AS total_questions
       FROM questions
       WHERE status = 'published'
       GROUP BY 1, 2, 3`
    ),
  ]);

  const totalQuestionsAvailable = Number(availableRes.rows[0]?.total_available || 0);
  const attempts = attemptsRes.rows;

  const totalAttempted = attempts.length;
  const correctAnswers = attempts.filter((r) => Boolean(r.is_correct)).length;
  const incorrectAnswers = Math.max(0, totalAttempted - correctAnswers);
  const overallAccuracy = calculateSafePercentage(correctAnswers, totalAttempted);

  const completedTestsRows = testsRes.rows.filter((t) => (t.status || 'completed') === 'completed');
  const inProgressTestsRows = testsRes.rows.filter((t) => t.status === 'in_progress');
  const completedTests = completedTestsRows.length;
  const inProgressTests = inProgressTestsRows.length;

  const unansweredQuestions = completedTestsRows.reduce((sum, t) => sum + Number(t.unanswered_questions || 0), 0);
  const totalMarksObtained =
    completedTests > 0
      ? Number(completedTestsRows.reduce((sum, t) => sum + Number(t.score || 0), 0).toFixed(1))
      : Number((correctAnswers * 1.5).toFixed(1));
  const maxMarks =
    completedTests > 0
      ? Number(completedTestsRows.reduce((sum, t) => sum + Number(t.max_score || 0), 0).toFixed(1))
      : Number((totalAttempted * 1.5).toFixed(1));
  const averageTestScore =
    completedTests > 0
      ? Math.round(completedTestsRows.reduce((sum, t) => sum + Number(t.percentage || 0), 0) / completedTests)
      : 0;

  // Subject-wise performance filtered to the student's selected TNPSC Group
  const cleanGroup = String(targetGroup || 'group4').toLowerCase();
  const groupSubjects =
    cleanGroup === 'group1'
      ? ['General Studies', 'Aptitude and Mental Ability']
      : ['General Studies', 'Aptitude and Mental Ability', 'General Tamil', 'General English'];

  const normalizeSubjectBucket = (rawSubj: string): string => {
    const s = rawSubj.toLowerCase();
    if (s.includes('aptitude') || s.includes('mental')) return 'Aptitude and Mental Ability';
    if (s.includes('tamil')) return 'General Tamil';
    if (s.includes('english')) return 'General English';
    return 'General Studies';
  };

  const subjStats = new Map<string, { attempted: number; correct: number; incorrect: number }>();
  for (const r of attempts) {
    const bucket = normalizeSubjectBucket(String(r.subject || ''));
    const cur = subjStats.get(bucket) || { attempted: 0, correct: 0, incorrect: 0 };
    cur.attempted += 1;
    if (r.is_correct) cur.correct += 1;
    else cur.incorrect += 1;
    subjStats.set(bucket, cur);
  }

  const bySubject = groupSubjects.map((subject) => {
    const st = subjStats.get(subject) || { attempted: 0, correct: 0, incorrect: 0 };
    return {
      subject,
      attempted: st.attempted,
      correct: st.correct,
      incorrect: st.incorrect,
      accuracy: calculateSafePercentage(st.correct, st.attempted),
    };
  });

  // Standard-wise performance (6th to 12th)
  const stdStats = new Map<number, { attempted: number; correct: number; incorrect: number }>();
  for (const r of attempts) {
    const cls = Number(r.class_id);
    if (!cls || cls < 6 || cls > 12) continue;
    const cur = stdStats.get(cls) || { attempted: 0, correct: 0, incorrect: 0 };
    cur.attempted += 1;
    if (r.is_correct) cur.correct += 1;
    else cur.incorrect += 1;
    stdStats.set(cls, cur);
  }

  const byStandard = [6, 7, 8, 9, 10, 11, 12].map((standard) => {
    const st = stdStats.get(standard) || { attempted: 0, correct: 0, incorrect: 0 };
    return {
      standard,
      label: `${standard}th Standard`,
      attempted: st.attempted,
      correct: st.correct,
      incorrect: st.incorrect,
      accuracy: calculateSafePercentage(st.correct, st.attempted),
    };
  });

  // Lesson-wise performance
  const lessonQuestionCountMap = new Map<string, number>();
  for (const r of lessonTotalsRes.rows) {
    const k = `${String(r.lesson_title || '').trim().toLowerCase()}::${r.class_id ?? ''}`;
    lessonQuestionCountMap.set(k, (lessonQuestionCountMap.get(k) || 0) + Number(r.total_questions || 0));
  }

  const lessonMap = new Map<
    string,
    {
      lessonTitle: string;
      subject: string;
      standard: number | null;
      totalQuestions: number;
      attempted: number;
      correct: number;
      incorrect: number;
    }
  >();

  for (const r of attempts) {
    const title = String(r.lesson_title || 'General Practice').trim();
    const std = r.class_id ? Number(r.class_id) : null;
    const key = `${title.toLowerCase()}::${std ?? ''}`;
    const totalQuestions = lessonQuestionCountMap.get(key) || lessonQuestionCountMap.get(`${title.toLowerCase()}::`) || 0;
    const cur = lessonMap.get(key) || {
      lessonTitle: title,
      subject: String(r.subject || 'General Studies'),
      standard: std,
      totalQuestions,
      attempted: 0,
      correct: 0,
      incorrect: 0,
    };
    cur.attempted += 1;
    if (r.is_correct) cur.correct += 1;
    else cur.incorrect += 1;
    lessonMap.set(key, cur);
  }

  const byLesson = Array.from(lessonMap.values())
    .map((l) => {
      const totalQ = Math.max(l.totalQuestions, l.attempted);
      const status: 'Completed' | 'In Progress' | 'Not Started' =
        l.totalQuestions > 0 && l.attempted >= l.totalQuestions
          ? 'Completed'
          : l.attempted > 0
            ? 'In Progress'
            : 'Not Started';
      return {
        ...l,
        totalQuestions: totalQ,
        accuracy: calculateSafePercentage(l.correct, l.attempted),
        status,
      };
    })
    .sort((a, b) => b.attempted - a.attempted);

  return {
    totalQuestionsAvailable,
    totalAttempted,
    correctAnswers,
    incorrectAnswers,
    unansweredQuestions,
    totalMarksObtained,
    maxMarks,
    overallAccuracy,
    completedTests,
    inProgressTests,
    averageTestScore,
    bySubject,
    byStandard,
    byLesson,
  };
}
