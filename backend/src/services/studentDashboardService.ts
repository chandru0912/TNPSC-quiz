import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';
import pool from '../db';

const studentDashboardEmitter = new EventEmitter();
studentDashboardEmitter.setMaxListeners(200);

export function notifyStudentDashboardUpdate(studentId: number): void {
  if (!Number.isFinite(studentId) || studentId <= 0) return;
  studentDashboardEmitter.emit(`student:${studentId}`);
}

export function subscribeStudentDashboardUpdates(
  studentId: number,
  listener: () => void
): () => void {
  const channel = `student:${studentId}`;
  const platformChannel = 'platform:content-updated';
  studentDashboardEmitter.on(channel, listener);
  studentDashboardEmitter.on(platformChannel, listener);
  return () => {
    studentDashboardEmitter.off(channel, listener);
    studentDashboardEmitter.off(platformChannel, listener);
  };
}

export function notifyPlatformContentUpdate(): void {
  studentDashboardEmitter.emit('platform:content-updated');
}

export function platformContentSyncMiddleware(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
    const path = req.path || '';
    if (!path.includes('/translate') && !path.includes('/generate-explanations')) {
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          notifyPlatformContentUpdate();
        }
      });
    }
  }
  next();
}

export function formatRelativeTime(dateInput: string | Date): string {
  const d = new Date(dateInput);
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export function formatStudyDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function calculateSafePercentage(completed: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (!Number.isFinite(completed) || completed <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

export interface PlatformStats {
  totalAvailableQuestions: number;
  totalPublishedMaterials: number;
  totalPublishedMockTests: number;
  totalSyllabusTopics: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const res = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM questions WHERE status = 'published' AND COALESCE(verification_status, 'verified') <> 'rejected') AS total_questions,
      (SELECT COUNT(*)::int FROM study_notes WHERE status = 'published') AS total_materials,
      (SELECT COUNT(*)::int FROM mock_tests WHERE status = 'published') AS total_mock_tests,
      (SELECT COUNT(*)::int FROM (
        SELECT DISTINCT LOWER(TRIM(lesson_title)) AS lesson_key
        FROM study_notes
        WHERE status = 'published' AND lesson_title IS NOT NULL AND TRIM(lesson_title) <> ''
        UNION
        SELECT DISTINCT LOWER(TRIM(lesson_title)) AS lesson_key
        FROM questions
        WHERE status = 'published' AND COALESCE(verification_status, 'verified') <> 'rejected' AND lesson_title IS NOT NULL AND TRIM(lesson_title) <> ''
      ) published_lessons) AS total_topics
  `);

  const row = res.rows[0] || {};
  return {
    totalAvailableQuestions: Number(row.total_questions || 0),
    totalPublishedMaterials: Number(row.total_materials || 0),
    totalPublishedMockTests: Number(row.total_mock_tests || 0),
    totalSyllabusTopics: Number(row.total_topics || 0),
  };
}

export async function getStudentDashboardData(studentId: number) {
  // 1. Fetch Student Info + Platform Totals in parallel
  const [
    studentRes,
    platformStats,
    timeRes,
    attemptsRes,
    mcqAttemptsRes,
    materialsRes,
    mockRes,
    mcqTestsRes,
    subjectPerfRes,
    standardPerfRes,
    completedTopicsRes,
    kolkataNowRes,
    streakRows,
    weeklyDataRes,
    recentActivityRes,
    weakAreasRes,
  ] = await Promise.all([
    pool.query(
      `SELECT id, full_name, email, target_group, created_at FROM students WHERE id = $1`,
      [studentId]
    ),
    getPlatformStats(),
    pool.query(
      `SELECT COALESCE(SUM(duration_seconds), 0)::int AS total_seconds
       FROM study_sessions
       WHERE student_id = $1`,
      [studentId]
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total_attempts,
         COUNT(CASE WHEN is_correct THEN 1 END)::int AS total_correct,
         COUNT(CASE WHEN source_system <> 'mock_test' THEN 1 END)::int AS non_mock_attempts,
         COUNT(CASE WHEN source_system <> 'mock_test' AND is_correct THEN 1 END)::int AS non_mock_correct,
         COUNT(DISTINCT CASE WHEN question_id IS NOT NULL THEN question_id::text ELSE 'custom:' || id::text END)::int AS unique_attempted,
         COUNT(DISTINCT CASE WHEN is_correct THEN CASE WHEN question_id IS NOT NULL THEN question_id::text ELSE 'custom:' || id::text END END)::int AS unique_correct
       FROM question_attempts
       WHERE student_id = $1
         AND selected_option IS NOT NULL
         AND selected_option >= 0`,
      [studentId]
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS mcq_attempted,
         COUNT(CASE WHEN is_correct THEN 1 END)::int AS mcq_correct,
         COUNT(DISTINCT CASE WHEN question_id IS NOT NULL THEN question_id::text ELSE 'custom:' || id::text END)::int AS mcq_unique_attempted
       FROM question_attempts
       WHERE student_id = $1
         AND source_system = 'mcq_practice'
         AND selected_option IS NOT NULL
         AND selected_option >= 0`,
      [studentId]
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total_materials_accessed,
         COUNT(DISTINCT CASE WHEN is_completed THEN COALESCE(NULLIF(TRIM(lesson_id), ''), LOWER(TRIM(lesson_title))) END)::int AS total_materials_completed
       FROM study_material_progress
       WHERE student_id = $1`,
      [studentId]
    ),
    pool.query(
      `SELECT
         COUNT(DISTINCT COALESCE(NULLIF(TRIM(test_id), ''), test_title))::int AS unique_mock_tests,
         COUNT(*)::int AS total_mock_submissions,
         COALESCE(SUM(attempted_questions), 0)::int AS mock_attempted_questions,
         COALESCE(SUM(correct_answers), 0)::int AS mock_correct_answers,
         COALESCE(AVG(percentage), 0)::numeric(5,1) AS avg_score,
         COALESCE(MAX(score), 0)::numeric(5,1) AS highest_score
       FROM mock_test_attempts
       WHERE student_id = $1
         AND COALESCE(assessment_type, 'mock_test') = 'mock_test'
         AND COALESCE(status, 'completed') = 'completed'
         AND attempted_questions > 0`,
      [studentId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS mcq_tests_completed
       FROM mock_test_attempts
       WHERE student_id = $1
         AND assessment_type IN ('lesson_quiz', 'subject_drill')
         AND COALESCE(status, 'completed') = 'completed'`,
      [studentId]
    ),
    pool.query(
      `SELECT
         COALESCE(NULLIF(TRIM(subject), ''), 'General Studies') AS subject,
         COUNT(*) FILTER (WHERE source_system = 'mcq_practice')::int AS mcq_attempted,
         COUNT(*) FILTER (WHERE source_system = 'mcq_practice' AND is_correct)::int AS mcq_correct
       FROM question_attempts
       WHERE student_id = $1
         AND selected_option IS NOT NULL
         AND selected_option >= 0
       GROUP BY 1
       ORDER BY mcq_attempted DESC`,
      [studentId]
    ),
    pool.query(
      `SELECT
         class_id AS standard,
         COUNT(*) FILTER (WHERE source_system = 'mcq_practice')::int AS mcq_attempted,
         COUNT(*) FILTER (WHERE source_system = 'mcq_practice' AND is_correct)::int AS mcq_correct
       FROM question_attempts
       WHERE student_id = $1
         AND class_id BETWEEN 6 AND 12
         AND selected_option IS NOT NULL
         AND selected_option >= 0
       GROUP BY class_id
       ORDER BY class_id ASC`,
      [studentId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS completed_topics
       FROM (
         SELECT DISTINCT LOWER(TRIM(lesson_title)) AS topic_key
         FROM study_material_progress
         WHERE student_id = $1 AND is_completed = TRUE AND lesson_title IS NOT NULL AND TRIM(lesson_title) <> ''
         UNION
         SELECT DISTINCT LOWER(TRIM(lesson_title)) AS topic_key
         FROM question_attempts
         WHERE student_id = $1 AND lesson_title IS NOT NULL AND TRIM(lesson_title) <> ''
       ) completed`,
      [studentId]
    ),
    pool.query(`
      SELECT
        TO_CHAR(timezone('Asia/Kolkata', CURRENT_TIMESTAMP), 'YYYY-MM-DD') AS today_kolkata,
        TO_CHAR(timezone('Asia/Kolkata', CURRENT_TIMESTAMP - INTERVAL '1 day'), 'YYYY-MM-DD') AS yesterday_kolkata
    `),
    pool.query(
      `SELECT
         TO_CHAR(activity_date, 'YYYY-MM-DD') AS act_date,
         (questions_count > 0 OR study_seconds >= 60 OR mock_tests_count > 0 OR notes_count > 0) AS is_active
       FROM daily_streaks
       WHERE student_id = $1
       ORDER BY activity_date DESC
       LIMIT 60`,
      [studentId]
    ),
    pool.query(
      `SELECT
         TO_CHAR(activity_date, 'Dy') AS day_abbr,
         TO_CHAR(activity_date, 'YYYY-MM-DD') AS day_date,
         COALESCE(study_seconds, 0) AS seconds,
         COALESCE(questions_count, 0) AS questions
       FROM daily_streaks
       WHERE student_id = $1
         AND activity_date >= (timezone('Asia/Kolkata', CURRENT_TIMESTAMP)::date - INTERVAL '6 days')
       ORDER BY activity_date ASC`,
      [studentId]
    ),
    pool.query(
      `SELECT
         id, activity_type, reference_id, reference_title, metadata, created_at
       FROM student_activity
       WHERE student_id = $1
       ORDER BY created_at DESC
       LIMIT 6`,
      [studentId]
    ),
    pool.query(
      `SELECT
         subject,
         COUNT(*)::int AS attempts,
         COUNT(CASE WHEN is_correct THEN 1 END)::int AS correct,
         ROUND((COUNT(CASE WHEN is_correct THEN 1 END)::numeric / COUNT(*)) * 100)::int AS accuracy
       FROM question_attempts
       WHERE student_id = $1
         AND subject IS NOT NULL
         AND TRIM(subject) <> ''
       GROUP BY subject
       HAVING COUNT(*) >= 3 AND (COUNT(CASE WHEN is_correct THEN 1 END)::numeric / COUNT(*)) < 0.75
       ORDER BY accuracy ASC
       LIMIT 3`,
      [studentId]
    ),
  ]);

  if (studentRes.rows.length === 0) {
    return null;
  }

  const student = studentRes.rows[0];
  const totalStudySeconds: number = timeRes.rows[0]?.total_seconds || 0;
  const totalStudyHours = Math.round((totalStudySeconds / 3600) * 10) / 10;
  const studyHoursFormatted = formatStudyDuration(totalStudySeconds);

  const qaRow = attemptsRes.rows[0] || {};
  const totalAttempts: number = qaRow.total_attempts || 0;
  const uniqueAttempted: number = qaRow.unique_attempted || 0;
  const uniqueCorrect: number = qaRow.unique_correct || 0;

  // Independent MCQ Practice metrics (only source_system = 'mcq_practice')
  const mcqRow = mcqAttemptsRes.rows[0] || {};
  const mcqAttempted: number = mcqRow.mcq_attempted || 0;
  const mcqCorrect: number = mcqRow.mcq_correct || 0;
  const mcqIncorrect: number = Math.max(0, mcqAttempted - mcqCorrect);
  const mcqUniqueAttempted: number = mcqRow.mcq_unique_attempted || 0;
  const mcqAccuracy: number = calculateSafePercentage(mcqCorrect, mcqAttempted);
  const mcqTestsCompleted: number = mcqTestsRes.rows[0]?.mcq_tests_completed || 0;

  // Independent Mock Tests metrics (only assessment_type = 'mock_test')
  const mockRow = mockRes.rows[0] || {};
  const mockTestsCompleted: number = mockRow.unique_mock_tests || 0;
  const mockAttemptedQ: number = mockRow.mock_attempted_questions || 0;
  const mockCorrectQ: number = mockRow.mock_correct_answers || 0;
  const mockIncorrectQ: number = Math.max(0, mockAttemptedQ - mockCorrectQ);
  const mockAvgScore = parseFloat(mockRow.avg_score || '0');
  const mockHighestScore = parseFloat(mockRow.highest_score || '0');
  const mockAccuracy: number = calculateSafePercentage(mockCorrectQ, mockAttemptedQ);

  // Combined Questions Solved & Overall Accuracy (MCQ Practice + Mock Tests only, excluding Study Materials)
  const totalGradedAttempts = mcqAttempted + mockAttemptedQ;
  const totalGradedCorrect = mcqCorrect + mockCorrectQ;
  const totalGradedIncorrect = mcqIncorrect + mockIncorrectQ;
  const overallAccuracy: number = calculateSafePercentage(totalGradedCorrect, totalGradedAttempts);

  const targetQuestions = platformStats.totalAvailableQuestions;
  const targetMaterials = platformStats.totalPublishedMaterials;
  const targetMockTests = platformStats.totalPublishedMockTests;

  const materialsStudied: number = materialsRes.rows[0]?.total_materials_completed || 0;
  const totalMaterialsAccessed: number = materialsRes.rows[0]?.total_materials_accessed || 0;
  const materialsInProgress: number = Math.max(0, totalMaterialsAccessed - materialsStudied);
  const materialsNotStarted: number = Math.max(0, targetMaterials - materialsStudied - materialsInProgress);
  const remainingQuestions: number = Math.max(0, targetQuestions - uniqueAttempted);
  const completedTopics: number = completedTopicsRes.rows[0]?.completed_topics || 0;
  const totalTopics = Math.max(completedTopics, platformStats.totalSyllabusTopics);
  const remainingTopics = Math.max(0, totalTopics - completedTopics);

  // Weighted Preparation Progress across completed topics/lessons, materials, MCQs, mock tests, and accuracy
  let overallProgress = 0;
  const hasAnyActivity =
    totalGradedAttempts > 0 || materialsStudied > 0 || mockTestsCompleted > 0 || completedTopics > 0;
  if (hasAnyActivity) {
    const qProgress = targetQuestions > 0 ? Math.min(100, (uniqueAttempted / targetQuestions) * 100) : 0;
    const mProgress = targetMaterials > 0 ? Math.min(100, (materialsStudied / targetMaterials) * 100) : 0;
    const tProgress = targetMockTests > 0 ? Math.min(100, (mockTestsCompleted / targetMockTests) * 100) : 0;
    const topicProgress = totalTopics > 0 ? Math.min(100, (completedTopics / totalTopics) * 100) : 0;
    const accScore = overallAccuracy;

    const rawProgress =
      qProgress * 0.35 + mProgress * 0.25 + tProgress * 0.2 + topicProgress * 0.1 + accScore * 0.1;
    overallProgress = Math.min(100, Math.max(1, Math.round(rawProgress)));
  }

  // Streak calculation (Asia/Kolkata)
  const todayKolkata = kolkataNowRes.rows[0].today_kolkata;
  const yesterdayKolkata = kolkataNowRes.rows[0].yesterday_kolkata;

  const activeDates = new Set<string>();
  streakRows.rows.forEach((r) => {
    if (r.is_active) activeDates.add(r.act_date);
  });

  let currentStreak = 0;
  const checkDateStr = activeDates.has(todayKolkata)
    ? todayKolkata
    : activeDates.has(yesterdayKolkata)
      ? yesterdayKolkata
      : null;

  if (checkDateStr) {
    const cur = new Date(checkDateStr);
    while (true) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const formatted = `${y}-${m}-${d}`;
      if (activeDates.has(formatted)) {
        currentStreak++;
        cur.setDate(cur.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Weekly progress (last 7 days)
  const dayMap = new Map<string, { seconds: number; questions: number }>();
  weeklyDataRes.rows.forEach((r) => {
    dayMap.set(r.day_date, { seconds: Number(r.seconds), questions: Number(r.questions) });
  });

  const weeklyProgress: { day: string; value: number; seconds: number; questions: number }[] = [];
  const dateCursor = new Date(todayKolkata);
  dateCursor.setDate(dateCursor.getDate() - 6);

  for (let i = 0; i < 7; i++) {
    const y = dateCursor.getFullYear();
    const m = String(dateCursor.getMonth() + 1).padStart(2, '0');
    const d = String(dateCursor.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const dayName = dateCursor.toLocaleDateString('en-US', { weekday: 'short' });
    const record = dayMap.get(dateStr) || { seconds: 0, questions: 0 };
    const pct = Math.min(100, Math.round((record.seconds / 2700) * 100));
    weeklyProgress.push({
      day: dayName,
      value: pct,
      seconds: record.seconds,
      questions: record.questions,
    });
    dateCursor.setDate(dateCursor.getDate() + 1);
  }

  const recentActivity = recentActivityRes.rows.map((r) => {
    const meta = r.metadata || {};
    let questions = meta.questions || 1;
    let score = meta.score ? String(meta.score) : 'Done';
    if (r.activity_type === 'question_practice') {
      questions = meta.questionsCount || 1;
      score = meta.isCorrect ? 'Correct' : 'Incorrect';
    } else if (r.activity_type === 'mock_test') {
      questions = meta.totalQuestions || 20;
      score = `${meta.score ?? 0}/${meta.maxScore ?? 100}`;
    } else if (r.activity_type === 'study_material') {
      score = meta.isCompleted ? 'Completed' : 'Reading';
    }

    return {
      id: r.id,
      type: r.activity_type,
      subject: meta.subject || 'General Studies',
      topic: r.reference_title,
      questions,
      score,
      time: formatRelativeTime(r.created_at),
      createdAt: r.created_at,
    };
  });

  const weakAreas = weakAreasRes.rows.map((w) => ({
    subject: w.subject,
    attempts: w.attempts,
    correct: w.correct,
    accuracy: w.accuracy,
  }));

  const upcomingGoals = [
    { task: `Attempt 25 questions in ${weakAreas[0]?.subject || 'Indian Polity'}`, completed: totalAttempts >= 25 },
    { task: 'Complete at least 1 Full-Length Mock Test', completed: mockTestsCompleted >= 1 },
    { task: 'Study 1 Lesson Note today', completed: materialsStudied >= 1 },
    { task: 'Reach a 7-day Study Streak', completed: currentStreak >= 7 },
  ];

  const materialsPct = calculateSafePercentage(materialsStudied, targetMaterials);
  const mockTestsPct = calculateSafePercentage(mockTestsCompleted, targetMockTests);
  const remainingMaterials = Math.max(0, targetMaterials - materialsStudied);

  const subjectPerformance = subjectPerfRes.rows.map((r: any) => ({
    subject: r.subject,
    mcqAttempted: r.mcq_attempted,
    mcqCorrect: r.mcq_correct,
    mcqAccuracy: calculateSafePercentage(r.mcq_correct, r.mcq_attempted),
  }));

  const standardPerformance = standardPerfRes.rows.map((r: any) => ({
    standard: Number(r.standard),
    mcqAttempted: r.mcq_attempted,
    mcqCorrect: r.mcq_correct,
    mcqAccuracy: calculateSafePercentage(r.mcq_correct, r.mcq_attempted),
  }));

  return {
    student: {
      id: student.id,
      fullName: student.full_name,
      email: student.email,
      targetGroup: student.target_group,
      createdAt: student.created_at,
    },
    metrics: {
      totalStudySeconds,
      totalStudyHours,
      studyHoursFormatted,
      totalQuestionsSolved: totalGradedAttempts,
      totalQuestionsAttempted: totalGradedAttempts,
      uniqueAttempted,
      uniqueCorrect,
      totalAttempts: totalGradedAttempts,
      totalCorrect: totalGradedCorrect,
      totalIncorrect: totalGradedIncorrect,
      targetQuestions,
      remainingQuestions,
      overallAccuracy,
      currentStreak,
      materialsStudied,
      materialsOpened: totalMaterialsAccessed,
      materialsInProgress,
      materialsNotStarted,
      remainingMaterials,
      targetMaterials,
      studyMaterialsCompletion: materialsPct,
      mcqAttempted,
      mcqCorrect,
      mcqIncorrect,
      mcqUniqueAttempted,
      mcqAccuracy,
      mcqTestsCompleted,
      mockTestsCompleted,
      targetMockTests,
      mockAttemptedQuestions: mockAttemptedQ,
      mockCorrectAnswers: mockCorrectQ,
      mockIncorrectAnswers: mockIncorrectQ,
      mockAccuracy,
      mockAvgScore,
      mockHighestScore,
      overallProgress,
      completedTopics,
      remainingTopics,
      totalTopics,
    },
    progressStats: [
      {
        label: 'Study Materials',
        value: `${materialsStudied}/${targetMaterials}`,
        percentage: materialsPct,
        subtitle: `Completed: ${materialsStudied} • Remaining: ${remainingMaterials}`,
      },
      {
        label: 'MCQ Practice',
        value: `${mcqAttempted}/${targetQuestions}`,
        percentage: mcqAccuracy,
        subtitle: `Correct: ${mcqCorrect} • Incorrect: ${mcqIncorrect} • Acc: ${mcqAccuracy}%`,
      },
      {
        label: 'Mock Tests',
        value: `${mockTestsCompleted}/${targetMockTests}`,
        percentage: mockTestsPct,
        subtitle: `Avg Score: ${mockAvgScore}% • Acc: ${mockAccuracy}%`,
      },
      {
        label: 'Overall Accuracy',
        value: `${overallAccuracy}%`,
        percentage: overallAccuracy,
        subtitle: `Attempted: ${totalGradedAttempts} • Correct: ${totalGradedCorrect} • Incorrect: ${totalGradedIncorrect}`,
      },
    ],
    subjectPerformance,
    standardPerformance,
    weeklyProgress,
    recentActivity,
    weakAreas,
    upcomingGoals,
  };
}
