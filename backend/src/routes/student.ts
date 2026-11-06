import { Router, Request, Response } from 'express';
import pool from '../db';
import { StudyManagementService } from '../services/studyManagementService';
import {
  generateStudentToken,
  requireStudentAuth,
  requireAdminAuth,
  hashStudentPassword,
  verifyStudentPassword,
  StudentAuthenticatedRequest,
} from '../middleware/auth';

const router = Router();

// Helper: format relative time (e.g., '2 hours ago', 'Just now')
function formatRelativeTime(dateInput: string | Date): string {
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

// ====================================================
// 1. STUDENT AUTHENTICATION: REGISTER
// ====================================================
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { fullName, email, mobile, password, targetGroup } = req.body;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ status: 'error', message: 'Full name is required.' });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ status: 'error', message: 'A valid email address is required.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanMobile = mobile ? String(mobile).trim() : null;
    const cleanGroup = targetGroup && typeof targetGroup === 'string' ? targetGroup.trim() : 'group4';

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM students WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'An account with this email address already exists. Please log in.',
      });
    }

    // Cryptographic password hash
    const passwordHash = hashStudentPassword(password);

    const insertResult = await pool.query(
      `INSERT INTO students (full_name, email, mobile, password_hash, target_group)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, mobile, target_group, created_at`,
      [cleanName, cleanEmail, cleanMobile, passwordHash, cleanGroup]
    );

    const newStudent = insertResult.rows[0];

    // Log account creation activity
    await pool.query(
      `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
       VALUES ($1, 'account_created', $2, 'Account Created', $3::jsonb)`,
      [newStudent.id, String(newStudent.id), JSON.stringify({ targetGroup: cleanGroup })]
    );

    // Generate JWT token
    const token = generateStudentToken(newStudent.id, newStudent.email, newStudent.full_name, newStudent.target_group);

    return res.status(201).json({
      status: 'success',
      message: 'Student account registered successfully.',
      token,
      student: {
        id: newStudent.id,
        fullName: newStudent.full_name,
        email: newStudent.email,
        mobile: newStudent.mobile,
        targetGroup: newStudent.target_group,
        createdAt: newStudent.created_at,
      },
    });
  } catch (err: any) {
    console.error('[Student Register Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Registration failed.' });
  }
});

// ====================================================
// 2. STUDENT AUTHENTICATION: LOGIN
// ====================================================
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Email and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const studentRes = await pool.query(
      `SELECT id, full_name, email, mobile, password_hash, target_group, created_at
       FROM students
       WHERE LOWER(email) = $1`,
      [cleanEmail]
    );

    if (studentRes.rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Invalid email address or password.' });
    }

    const student = studentRes.rows[0];

    const isMatch = verifyStudentPassword(password, student.password_hash);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email address or password.' });
    }

    // Log login activity
    await pool.query(
      `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
       VALUES ($1, 'login', $2, 'Logged In', $3::jsonb)`,
      [student.id, String(student.id), JSON.stringify({ time: new Date().toISOString() })]
    );

    // Update last_login_at timestamp
    await pool.query('UPDATE students SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [student.id]);

    // Generate JWT token
    const token = generateStudentToken(student.id, student.email, student.full_name, student.target_group);

    return res.status(200).json({
      status: 'success',
      message: 'Login successful.',
      token,
      student: {
        id: student.id,
        fullName: student.full_name,
        email: student.email,
        mobile: student.mobile,
        targetGroup: student.target_group,
        createdAt: student.created_at,
      },
    });
  } catch (err: any) {
    console.error('[Student Login Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Login failed.' });
  }
});

// ====================================================
// 3. STUDENT PROFILE (GET & UPDATE)
// ====================================================
router.get('/profile', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const studentRes = await pool.query(
      `SELECT id, full_name, email, mobile, target_group, created_at, updated_at
       FROM students
       WHERE id = $1`,
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Student profile not found.' });
    }

    const s = studentRes.rows[0];
    return res.status(200).json({
      status: 'success',
      student: {
        id: s.id,
        fullName: s.full_name,
        email: s.email,
        mobile: s.mobile,
        targetGroup: s.target_group,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      },
    });
  } catch (err: any) {
    console.error('[Student Profile Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch profile.' });
  }
});

router.put('/profile', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const { fullName, mobile, targetGroup } = req.body;

    // Read-only server guard: never alter student database records during admin preview mode
    if (req.studentUser?.isPreview) {
      return res.status(200).json({
        status: 'success',
        message: 'Profile update simulated in Student Preview Mode (Read-only simulation).',
        student: {
          id: studentId,
          fullName: fullName?.trim() || req.studentUser.fullName,
          email: req.studentUser.email,
          mobile: mobile !== undefined ? (mobile ? String(mobile).trim() : null) : null,
          targetGroup: targetGroup?.trim() || req.studentUser.targetGroup,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let pIdx = 1;

    if (fullName && typeof fullName === 'string' && fullName.trim()) {
      updates.push(`full_name = $${pIdx++}`);
      values.push(fullName.trim());
    }
    if (mobile !== undefined) {
      updates.push(`mobile = $${pIdx++}`);
      values.push(mobile ? String(mobile).trim() : null);
    }
    if (targetGroup && typeof targetGroup === 'string' && targetGroup.trim()) {
      updates.push(`target_group = $${pIdx++}`);
      values.push(targetGroup.trim());
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No valid update fields provided.' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(studentId);

    const updateQuery = `
      UPDATE students
      SET ${updates.join(', ')}
      WHERE id = $${pIdx}
      RETURNING id, full_name, email, mobile, target_group, updated_at
    `;

    const result = await pool.query(updateQuery, values);
    const updated = result.rows[0];

    return res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully.',
      student: {
        id: updated.id,
        fullName: updated.full_name,
        email: updated.email,
        mobile: updated.mobile,
        targetGroup: updated.target_group,
        updatedAt: updated.updated_at,
      },
    });
  } catch (err: any) {
    console.error('[Student Profile Update Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to update profile.' });
  }
});

// ====================================================
// 4. REAL-TIME STUDENT DASHBOARD STATISTICS
// ====================================================
router.get('/dashboard', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;

    // 1. Fetch Student Info
    const studentRes = await pool.query(
      `SELECT id, full_name, email, target_group, created_at FROM students WHERE id = $1`,
      [studentId]
    );
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Student account not found.' });
    }
    const student = studentRes.rows[0];

    // 2. Total Active Study Time from sessions
    const timeRes = await pool.query(
      `SELECT COALESCE(SUM(duration_seconds), 0)::int AS total_seconds
       FROM study_sessions
       WHERE student_id = $1`,
      [studentId]
    );
    const totalStudySeconds: number = timeRes.rows[0]?.total_seconds || 0;
    const totalStudyHours = Math.round((totalStudySeconds / 3600) * 10) / 10;
    const studyHoursFormatted = totalStudyHours === 0 ? '0 hrs' : `${totalStudyHours} hrs`;

    // 3. Question Attempts: total, unique, correct, accuracy
    const attemptsRes = await pool.query(
      `SELECT
         COUNT(*)::int AS total_attempts,
         COUNT(CASE WHEN is_correct THEN 1 END)::int AS total_correct,
         COUNT(DISTINCT question_id)::int AS unique_attempted,
         COUNT(DISTINCT CASE WHEN is_correct THEN question_id END)::int AS unique_correct
       FROM question_attempts
       WHERE student_id = $1`,
      [studentId]
    );
    const totalAttempts: number = attemptsRes.rows[0]?.total_attempts || 0;
    const totalCorrect: number = attemptsRes.rows[0]?.total_correct || 0;
    const uniqueAttempted: number = attemptsRes.rows[0]?.unique_attempted || 0;
    const uniqueCorrect: number = attemptsRes.rows[0]?.unique_correct || 0;

    const overallAccuracy: number = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
    const targetQuestions: number = 2500;

    // 4. Study Materials Progress
    const materialsRes = await pool.query(
      `SELECT
         COUNT(*)::int AS total_materials_accessed,
         COUNT(CASE WHEN is_completed THEN 1 END)::int AS total_materials_completed
       FROM study_material_progress
       WHERE student_id = $1`,
      [studentId]
    );
    const materialsStudied = materialsRes.rows[0]?.total_materials_completed || 0;
    const targetMaterials = 120; // 120 chapters across standards

    // 5. Mock Tests Performance
    const mockRes = await pool.query(
      `SELECT
         COUNT(*)::int AS total_mock_tests,
         COALESCE(AVG(percentage), 0)::numeric(5,1) AS avg_score,
         COALESCE(MAX(score), 0)::numeric(5,1) AS highest_score
       FROM mock_test_attempts
       WHERE student_id = $1`,
      [studentId]
    );
    const mockTestsCompleted = mockRes.rows[0]?.total_mock_tests || 0;
    const mockAvgScore = parseFloat(mockRes.rows[0]?.avg_score || '0');
    const mockHighestScore = parseFloat(mockRes.rows[0]?.highest_score || '0');
    const targetMockTests = 20;

    // 6. Overall Preparation Progress (Weighted Formula)
    // 0% for brand new student; dynamic based on true DB activity
    let overallProgress = 0;
    if (totalAttempts > 0 || materialsStudied > 0 || mockTestsCompleted > 0) {
      const qProgress = Math.min(100, (uniqueAttempted / targetQuestions) * 100);
      const mProgress = Math.min(100, (materialsStudied / targetMaterials) * 100);
      const tProgress = Math.min(100, (mockTestsCompleted / targetMockTests) * 100);
      const accScore = overallAccuracy;

      overallProgress = Math.min(
        100,
        Math.round(qProgress * 0.4 + mProgress * 0.3 + tProgress * 0.2 + accScore * 0.1)
      );
    }

    // 7. Streak Calculation (Asia/Kolkata timezone)
    const kolkataNowRes = await pool.query(`
      SELECT
        TO_CHAR(timezone('Asia/Kolkata', CURRENT_TIMESTAMP), 'YYYY-MM-DD') AS today_kolkata,
        TO_CHAR(timezone('Asia/Kolkata', CURRENT_TIMESTAMP - INTERVAL '1 day'), 'YYYY-MM-DD') AS yesterday_kolkata
    `);
    const todayKolkata = kolkataNowRes.rows[0].today_kolkata;
    const yesterdayKolkata = kolkataNowRes.rows[0].yesterday_kolkata;

    const streakRows = await pool.query(
      `SELECT
         TO_CHAR(activity_date, 'YYYY-MM-DD') AS act_date,
         (questions_count > 0 OR study_seconds >= 60 OR mock_tests_count > 0 OR notes_count > 0) AS is_active
       FROM daily_streaks
       WHERE student_id = $1
       ORDER BY activity_date DESC
       LIMIT 60`,
      [studentId]
    );

    const activeDates = new Set<string>();
    streakRows.rows.forEach((r) => {
      if (r.is_active) {
        activeDates.add(r.act_date);
      }
    });

    let currentStreak = 0;
    // Streak is alive if active today or yesterday
    let checkDateStr = activeDates.has(todayKolkata) ? todayKolkata : activeDates.has(yesterdayKolkata) ? yesterdayKolkata : null;

    if (checkDateStr) {
      let cur = new Date(checkDateStr);
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

    // 8. Weekly Study Activity (Mon - Sun of current week)
    const weeklyDataRes = await pool.query(
      `SELECT
         TO_CHAR(timezone('Asia/Kolkata', activity_date), 'Dy') AS day_abbr,
         TO_CHAR(timezone('Asia/Kolkata', activity_date), 'YYYY-MM-DD') AS day_date,
         COALESCE(study_seconds, 0) AS seconds,
         COALESCE(questions_count, 0) AS questions
       FROM daily_streaks
       WHERE student_id = $1
         AND activity_date >= (timezone('Asia/Kolkata', CURRENT_TIMESTAMP)::date - INTERVAL '6 days')
       ORDER BY activity_date ASC`,
      [studentId]
    );

    // Build last 7 days chart array
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
      // Goal percentage: 45 min target per day (2700 sec)
      const pct = Math.min(100, Math.round((record.seconds / 2700) * 100));
      weeklyProgress.push({
        day: dayName,
        value: pct,
        seconds: record.seconds,
        questions: record.questions,
      });
      dateCursor.setDate(dateCursor.getDate() + 1);
    }

    // 9. Recent Activity (Recent real actions from student_activity)
    const recentActivityRes = await pool.query(
      `SELECT
         id, activity_type, reference_id, reference_title, metadata, created_at
       FROM student_activity
       WHERE student_id = $1
       ORDER BY created_at DESC
       LIMIT 6`,
      [studentId]
    );

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

    // 10. Weak Areas Identification (Lowest accuracy subjects with >= 3 attempts)
    const weakAreasRes = await pool.query(
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
    );

    const weakAreas = weakAreasRes.rows.map((w) => ({
      subject: w.subject,
      attempts: w.attempts,
      correct: w.correct,
      accuracy: w.accuracy,
    }));

    // Dynamic upcoming goals based on active student stats
    const upcomingGoals = [
      { task: `Attempt 25 questions in ${weakAreas[0]?.subject || 'Indian Polity'}`, completed: totalAttempts >= 25 },
      { task: 'Complete at least 1 Full-Length Mock Test', completed: mockTestsCompleted >= 1 },
      { task: 'Study 1 Lesson Note today', completed: materialsStudied >= 1 },
      { task: 'Reach a 7-day Study Streak', completed: currentStreak >= 7 },
    ];

    return res.status(200).json({
      status: 'success',
      data: {
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
          totalQuestionsSolved: uniqueCorrect,
          totalQuestionsAttempted: uniqueAttempted,
          totalAttempts,
          totalCorrect,
          targetQuestions,
          overallAccuracy,
          currentStreak,
          materialsStudied,
          targetMaterials,
          mockTestsCompleted,
          targetMockTests,
          mockAvgScore,
          mockHighestScore,
          overallProgress,
        },
        progressStats: [
          {
            label: 'Materials Studied',
            value: `${materialsStudied}/${targetMaterials}`,
            percentage: Math.min(100, Math.round((materialsStudied / targetMaterials) * 100)),
          },
          {
            label: 'Questions Attempted',
            value: `${uniqueAttempted}/${targetQuestions}`,
            percentage: Math.min(100, Math.round((uniqueAttempted / targetQuestions) * 100)),
          },
          {
            label: 'Mock Tests',
            value: `${mockTestsCompleted}/${targetMockTests}`,
            percentage: Math.min(100, Math.round((mockTestsCompleted / targetMockTests) * 100)),
          },
          {
            label: 'Accuracy',
            value: `${overallAccuracy}%`,
            percentage: overallAccuracy,
          },
        ],
        weeklyProgress,
        recentActivity,
        weakAreas,
        upcomingGoals,
      },
    });
  } catch (err: any) {
    console.error('[Student Dashboard Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load dashboard statistics.' });
  }
});

// ====================================================
// 5. ACTIVE STUDY SESSION & HEARTBEAT TRACKING
// ====================================================
router.post('/study-session/heartbeat', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const { sessionToken, pagePath, deltaSeconds } = req.body;

    // Read-only server guard: never alter student database records during admin preview mode
    if (req.studentUser?.isPreview) {
      return res.status(200).json({
        status: 'success',
        message: 'Preview mode: session heartbeat acknowledged (read-only, no database write).',
        durationSeconds: 0,
      });
    }

    if (!sessionToken || typeof sessionToken !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Session token is required.' });
    }

    // Safety clamp: each heartbeat ping is max 35 seconds to prevent artificial inflation
    const rawDelta = typeof deltaSeconds === 'number' ? Math.floor(deltaSeconds) : 30;
    const cleanDelta = Math.max(1, Math.min(35, rawDelta));
    const cleanPath = pagePath && typeof pagePath === 'string' ? pagePath.slice(0, 255) : '/dashboard';

    // 1. Upsert active study session
    const sessionRes = await pool.query(
      `INSERT INTO study_sessions (student_id, session_token, page_path, duration_seconds, started_at, last_heartbeat, is_active)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, TRUE)
       ON CONFLICT (student_id, session_token) DO UPDATE
       SET duration_seconds = study_sessions.duration_seconds + $4,
           page_path = $3,
           last_heartbeat = CURRENT_TIMESTAMP,
           is_active = TRUE
       RETURNING id, duration_seconds`,
      [studentId, sessionToken, cleanPath, cleanDelta]
    );

    // 2. Update daily streak study time for today in Asia/Kolkata
    await pool.query(
      `INSERT INTO daily_streaks (student_id, activity_date, study_seconds)
       VALUES ($1, timezone('Asia/Kolkata', CURRENT_TIMESTAMP)::date, $2)
       ON CONFLICT (student_id, activity_date)
       DO UPDATE SET study_seconds = daily_streaks.study_seconds + $2`,
      [studentId, cleanDelta]
    );

    return res.status(200).json({
      status: 'success',
      durationSeconds: sessionRes.rows[0]?.duration_seconds || 0,
    });
  } catch (err: any) {
    console.error('[Study Session Heartbeat Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Heartbeat recording failed.' });
  }
});

// ====================================================
// 6. RECORD QUESTION ATTEMPT
// ====================================================
router.post('/question-attempt', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;

    // Read-only server guard: never alter student database records during admin preview mode
    if (req.studentUser?.isPreview) {
      return res.status(200).json({
        status: 'success',
        message: 'Preview mode: question attempt simulated (read-only, no database write).',
      });
    }

    const {
      questionId,
      category,
      subject,
      classId,
      unitId,
      lessonId,
      lessonTitle,
      topic,
      selectedOption,
      correctAnswer,
      isCorrect,
      sourceSystem,
      timeSpentSeconds,
    } = req.body;

    if (selectedOption === undefined || correctAnswer === undefined || isCorrect === undefined) {
      return res.status(400).json({ status: 'error', message: 'Missing required question attempt fields.' });
    }

    const cleanQuestionId = typeof questionId === 'number' ? questionId : null;
    const cleanIsCorrect = Boolean(isCorrect);
    const cleanSource = sourceSystem || 'mcq_practice';
    const cleanTime = typeof timeSpentSeconds === 'number' ? Math.max(0, timeSpentSeconds) : 0;

    // 1. Insert question attempt record
    await pool.query(
      `INSERT INTO question_attempts (
         student_id, question_id, category, subject, class_id, unit_id, lesson_id, lesson_title, topic,
         selected_option, correct_answer, is_correct, source_system, time_spent_seconds, attempted_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)`,
      [
        studentId,
        cleanQuestionId,
        category || 'group4',
        subject || 'General Studies',
        classId ? Number(classId) : null,
        unitId ? Number(unitId) : null,
        lessonId ? String(lessonId) : null,
        lessonTitle || 'General Practice',
        topic || null,
        Number(selectedOption),
        Number(correctAnswer),
        cleanIsCorrect,
        cleanSource,
        cleanTime,
      ]
    );

    // 2. Update daily streak (increment question count)
    await pool.query(
      `INSERT INTO daily_streaks (student_id, activity_date, questions_count)
       VALUES ($1, timezone('Asia/Kolkata', CURRENT_TIMESTAMP)::date, 1)
       ON CONFLICT (student_id, activity_date)
       DO UPDATE SET questions_count = daily_streaks.questions_count + 1`,
      [studentId]
    );

    // 3. Log activity item (limit creation rate or store latest)
    await pool.query(
      `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
       VALUES ($1, 'question_practice', $2, $3, $4::jsonb)`,
      [
        studentId,
        cleanQuestionId ? String(cleanQuestionId) : 'mcq',
        lessonTitle || subject || 'MCQ Practice',
        JSON.stringify({
          subject: subject || 'General Studies',
          isCorrect: cleanIsCorrect,
          sourceSystem: cleanSource,
        }),
      ]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Question attempt recorded successfully.',
    });
  } catch (err: any) {
    console.error('[Question Attempt Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to record attempt.' });
  }
});

// ====================================================
// 7. RECORD MOCK TEST SUBMISSION
// ====================================================
router.post('/mock-test/submit', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const {
      testId,
      testTitle,
      category,
      totalQuestions,
      attemptedQuestions,
      correctAnswers,
      incorrectAnswers,
      score,
      maxScore,
      timeSpentSeconds,
    } = req.body;

    // Read-only server guard: never alter student database records during admin preview mode
    if (req.studentUser?.isPreview) {
      const cleanTotal = Number(totalQuestions) || 10;
      const cleanCorrect = Number(correctAnswers) || 0;
      const cleanScore = typeof score === 'number' ? score : cleanCorrect * 1.5;
      const cleanMax = typeof maxScore === 'number' ? maxScore : cleanTotal * 1.5;
      const percentage = cleanTotal > 0 ? Math.round((cleanCorrect / cleanTotal) * 100) : 0;
      return res.status(200).json({
        status: 'success',
        message: 'Preview mode: mock test submitted for display only (read-only, not saved to student records).',
        data: {
          id: 0,
          studentId,
          testId: testId || 'mock-preview',
          testTitle: testTitle || 'Mock Test Preview',
          category: category || 'group4',
          totalQuestions: cleanTotal,
          attemptedQuestions: Number(attemptedQuestions) || cleanTotal,
          correctAnswers: cleanCorrect,
          incorrectAnswers: Number(incorrectAnswers) || 0,
          score: cleanScore,
          maxScore: cleanMax,
          percentage,
          timeSpentSeconds: Number(timeSpentSeconds) || 0,
          submittedAt: new Date().toISOString(),
        },
      });
    }

    if (!testTitle) {
      return res.status(400).json({ status: 'error', message: 'Test title is required.' });
    }

    const tTotal = Number(totalQuestions) || 20;
    const tAttempted = Number(attemptedQuestions) || 0;
    const tCorrect = Number(correctAnswers) || 0;
    const tIncorrect = Number(incorrectAnswers) || Math.max(0, tAttempted - tCorrect);
    const tScore = Number(score) || tCorrect;
    const tMaxScore = Number(maxScore) || tTotal;
    const percentage = tMaxScore > 0 ? Math.round((tScore / tMaxScore) * 1000) / 10 : 0;
    const tTime = Number(timeSpentSeconds) || 0;

    // 1. Insert mock test attempt
    const insertRes = await pool.query(
      `INSERT INTO mock_test_attempts (
         student_id, test_id, test_title, category, total_questions, attempted_questions,
         correct_answers, incorrect_answers, score, max_score, percentage, time_spent_seconds, completed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        studentId,
        testId ? String(testId) : null,
        testTitle,
        category || 'group1',
        tTotal,
        tAttempted,
        tCorrect,
        tIncorrect,
        tScore,
        tMaxScore,
        percentage,
        tTime,
      ]
    );

    // 2. Update daily streak (increment mock test count)
    await pool.query(
      `INSERT INTO daily_streaks (student_id, activity_date, mock_tests_count)
       VALUES ($1, timezone('Asia/Kolkata', CURRENT_TIMESTAMP)::date, 1)
       ON CONFLICT (student_id, activity_date)
       DO UPDATE SET mock_tests_count = daily_streaks.mock_tests_count + 1`,
      [studentId]
    );

    // 3. Log student activity
    await pool.query(
      `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
       VALUES ($1, 'mock_test', $2, $3, $4::jsonb)`,
      [
        studentId,
        String(insertRes.rows[0].id),
        testTitle,
        JSON.stringify({
          category,
          totalQuestions: tTotal,
          score: tScore,
          maxScore: tMaxScore,
          percentage,
        }),
      ]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Mock test submission recorded successfully.',
      attemptId: insertRes.rows[0].id,
      percentage,
    });
  } catch (err: any) {
    console.error('[Mock Test Submit Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to submit mock test.' });
  }
});

// ====================================================
// 8. RECORD STUDY MATERIAL READING PROGRESS
// ====================================================
router.post('/material-progress', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;

    // Read-only server guard: never alter student database records during admin preview mode
    if (req.studentUser?.isPreview) {
      return res.status(200).json({
        status: 'success',
        message: 'Preview mode: study material progress simulated (read-only, no database write).',
      });
    }

    const {
      materialType,
      standard,
      subject,
      term,
      unitId,
      lessonId,
      lessonTitle,
      readingTimeSeconds,
      isCompleted,
    } = req.body;

    if (!lessonTitle) {
      return res.status(400).json({ status: 'error', message: 'Lesson title is required.' });
    }

    const cleanType = materialType || 'note';
    const cleanStd = standard ? Number(standard) : null;
    const cleanSub = subject || 'General Studies';
    const cleanTerm = term || 'Term 1';
    const cleanUnit = unitId ? Number(unitId) : 1;
    const cleanLessonId = lessonId ? String(lessonId) : null;
    const cleanTime = Math.max(1, Number(readingTimeSeconds) || 30);
    const completedFlag = Boolean(isCompleted);

    // Upsert study material progress
    await pool.query(
      `INSERT INTO study_material_progress (
         student_id, material_type, standard, subject, term, unit_id, lesson_id, lesson_title,
         reading_time_seconds, is_completed, last_accessed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
       ON CONFLICT (student_id, material_type, subject, standard, unit_id, lesson_title)
       DO UPDATE SET
         reading_time_seconds = study_material_progress.reading_time_seconds + EXCLUDED.reading_time_seconds,
         is_completed = study_material_progress.is_completed OR EXCLUDED.is_completed,
         last_accessed_at = CURRENT_TIMESTAMP`,
      [
        studentId,
        cleanType,
        cleanStd,
        cleanSub,
        cleanTerm,
        cleanUnit,
        cleanLessonId,
        lessonTitle,
        cleanTime,
        completedFlag,
      ]
    );

    // Update daily streak
    await pool.query(
      `INSERT INTO daily_streaks (student_id, activity_date, notes_count)
       VALUES ($1, timezone('Asia/Kolkata', CURRENT_TIMESTAMP)::date, 1)
       ON CONFLICT (student_id, activity_date)
       DO UPDATE SET notes_count = daily_streaks.notes_count + 1`,
      [studentId]
    );

    // If completed or significant study, record activity
    if (completedFlag) {
      await pool.query(
        `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
         VALUES ($1, 'study_material', $2, $3, $4::jsonb)`,
        [
          studentId,
          cleanLessonId || lessonTitle,
          lessonTitle,
          JSON.stringify({ subject: cleanSub, standard: cleanStd, isCompleted: true }),
        ]
      );
    }

    return res.status(200).json({
      status: 'success',
      message: 'Study material progress updated successfully.',
    });
  } catch (err: any) {
    console.error('[Study Material Progress Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to update progress.' });
  }
});

// ====================================================
// 9. ADMIN PANEL: STUDENTS OVERVIEW & METRICS
// ====================================================
router.get('/admin/list', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    // 1. Overall Aggregates
    const aggRes = await pool.query(`
      SELECT
        COUNT(DISTINCT s.id)::int AS total_students,
        COUNT(DISTINCT CASE WHEN ds.activity_date >= (timezone('Asia/Kolkata', CURRENT_TIMESTAMP)::date - INTERVAL '7 days') THEN s.id END)::int AS active_last_7_days,
        COALESCE(SUM(ss.duration_seconds), 0)::bigint AS total_study_seconds,
        COUNT(qa.id)::int AS total_questions_attempted,
        COUNT(CASE WHEN qa.is_correct THEN 1 END)::int AS total_questions_correct
      FROM students s
      LEFT JOIN daily_streaks ds ON ds.student_id = s.id
      LEFT JOIN study_sessions ss ON ss.student_id = s.id
      LEFT JOIN question_attempts qa ON qa.student_id = s.id
    `);

    const totalStudents = aggRes.rows[0]?.total_students || 0;
    const activeStudents = aggRes.rows[0]?.active_last_7_days || 0;
    const totalStudyHours = Math.round((Number(aggRes.rows[0]?.total_study_seconds || 0) / 3600) * 10) / 10;
    const totalQAttempts = aggRes.rows[0]?.total_questions_attempted || 0;
    const totalQCorrect = aggRes.rows[0]?.total_questions_correct || 0;
    const overallAvgAccuracy = totalQAttempts > 0 ? Math.round((totalQCorrect / totalQAttempts) * 100) : 0;

    // 2. Individual Students List
    const studentsRes = await pool.query(`
      SELECT
        s.id,
        s.full_name,
        s.email,
        s.mobile,
        s.target_group,
        s.created_at,
        COALESCE(SUM(ss.duration_seconds), 0)::int AS study_seconds,
        COUNT(DISTINCT qa.id)::int AS questions_attempted,
        COUNT(DISTINCT CASE WHEN qa.is_correct THEN qa.id END)::int AS questions_correct,
        COUNT(DISTINCT mta.id)::int AS mock_tests_count,
        COUNT(DISTINCT CASE WHEN smp.is_completed THEN smp.id END)::int AS materials_completed,
        MAX(sa.created_at) AS last_activity_at
      FROM students s
      LEFT JOIN study_sessions ss ON ss.student_id = s.id
      LEFT JOIN question_attempts qa ON qa.student_id = s.id
      LEFT JOIN mock_test_attempts mta ON mta.student_id = s.id
      LEFT JOIN study_material_progress smp ON smp.student_id = s.id
      LEFT JOIN student_activity sa ON sa.student_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);

    const studentList = studentsRes.rows.map((row) => {
      const qAttempted = row.questions_attempted || 0;
      const qCorrect = row.questions_correct || 0;
      const acc = qAttempted > 0 ? Math.round((qCorrect / qAttempted) * 100) : 0;
      const hours = Math.round((row.study_seconds / 3600) * 10) / 10;

      // Preparation progress
      const qP = Math.min(100, (qAttempted / 2500) * 100);
      const mP = Math.min(100, (row.materials_completed / 120) * 100);
      const tP = Math.min(100, (row.mock_tests_count / 20) * 100);
      const prepProgress =
        qAttempted > 0 || row.materials_completed > 0 || row.mock_tests_count > 0
          ? Math.min(100, Math.round(qP * 0.4 + mP * 0.3 + tP * 0.2 + acc * 0.1))
          : 0;

      return {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        mobile: row.mobile,
        targetGroup: row.target_group,
        createdAt: row.created_at,
        studyHours: hours,
        studyHoursFormatted: `${hours} hrs`,
        questionsAttempted: qAttempted,
        questionsCorrect: qCorrect,
        accuracy: acc,
        preparationProgress: prepProgress,
        mockTestsCount: row.mock_tests_count,
        materialsCompleted: row.materials_completed,
        lastActive: row.last_activity_at ? formatRelativeTime(row.last_activity_at) : 'Never',
      };
    });

    return res.status(200).json({
      status: 'success',
      data: {
        summary: {
          totalStudents,
          activeStudents,
          totalStudyHours,
          overallAvgAccuracy,
        },
        students: studentList,
      },
    });
  } catch (err: any) {
    console.error('[Admin Students List Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch student data.' });
  }
});

// ====================================================
// 10. ADMIN: GENERATE READ-ONLY PREVIEW TOKEN FOR STUDENT
// ====================================================
router.post('/admin/preview-token/:studentId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ status: 'error', message: 'Valid student ID is required.' });
    }

    const studentRes = await pool.query(
      `SELECT id, full_name, email, mobile, target_group, created_at FROM students WHERE id = $1`,
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Student account not found.' });
    }

    const s = studentRes.rows[0];

    // Generate token flagged with isPreview: true
    const previewToken = generateStudentToken(
      s.id,
      s.email,
      s.full_name,
      s.target_group,
      true // isPreview = true
    );

    return res.status(200).json({
      status: 'success',
      message: `Preview token generated for ${s.full_name}`,
      previewToken,
      student: {
        id: s.id,
        fullName: s.full_name,
        email: s.email,
        mobile: s.mobile,
        targetGroup: s.target_group,
        createdAt: s.created_at,
        isPreview: true,
      },
    });
  } catch (err: any) {
    console.error('[Admin Preview Token Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to generate preview token.' });
  }
});

// ====================================================
// 11. ADMIN: QUICK CREATE STUDENT ACCOUNT
// ====================================================
router.post('/admin/create', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { fullName, email, mobile, password, targetGroup, district, city, subscriptionTier } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ status: 'error', message: 'Full name is required.' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ status: 'error', message: 'A valid email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanMobile = mobile ? String(mobile).trim() : null;
    const cleanGroup = targetGroup && typeof targetGroup === 'string' ? targetGroup.trim().toLowerCase() : 'group4';
    const cleanDistrict = district && typeof district === 'string' ? district.trim() : 'Chennai';
    const cleanCity = city && typeof city === 'string' ? city.trim() : 'Central';
    const cleanTier = subscriptionTier && typeof subscriptionTier === 'string' ? subscriptionTier.trim() : 'free';
    const cleanPass = password && password.length >= 6 ? password : 'tnpsc' + Math.floor(1000 + Math.random() * 9000);

    const existing = await pool.query('SELECT id FROM students WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ status: 'error', message: 'A student account with this email already exists.' });
    }

    const passwordHash = hashStudentPassword(cleanPass);

    const insertRes = await pool.query(
      `INSERT INTO students (full_name, email, mobile, password_hash, target_group, district, city, subscription_tier, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING id, full_name, email, mobile, target_group, district, city, subscription_tier, created_at`,
      [cleanName, cleanEmail, cleanMobile, passwordHash, cleanGroup, cleanDistrict, cleanCity, cleanTier]
    );

    const createdStudent = insertRes.rows[0];

    // If paid subscription tier selected, insert into student_subscriptions
    if (cleanTier !== 'free') {
      const planIdMap: Record<string, { planId: string; planName: string; amount: number; days: number }> = {
        monthly: { planId: 'tnpsc_pro_monthly', planName: 'TNPSC Pro Monthly Pass', amount: 199.00, days: 30 },
        quarterly: { planId: 'tnpsc_pro_quarterly', planName: 'TNPSC Pro Quarterly Pass', amount: 499.00, days: 90 },
        half_yearly: { planId: 'tnpsc_pro_half_yearly', planName: 'TNPSC Pro Half-Yearly Pass', amount: 899.00, days: 180 },
        yearly: { planId: 'tnpsc_pro_yearly', planName: 'TNPSC Pro Annual Pass', amount: 1499.00, days: 365 },
        pro: { planId: 'tnpsc_pro_yearly', planName: 'TNPSC Pro Annual Pass', amount: 1499.00, days: 365 },
      };
      const planInfo = planIdMap[cleanTier] || planIdMap.yearly;

      await pool.query(
        `INSERT INTO student_subscriptions (student_id, plan_id, plan_name, amount, currency, status, payment_method, district, city, starts_at, expires_at)
         VALUES ($1, $2, $3, $4, 'INR', 'active', 'Admin Enrollment', $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + ($7 || ' days')::INTERVAL)
         ON CONFLICT DO NOTHING`,
        [createdStudent.id, planInfo.planId, planInfo.planName, planInfo.amount, cleanDistrict, cleanCity, planInfo.days]
      );
    }

    // Log admin creation activity
    await pool.query(
      `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
       VALUES ($1, 'account_created', $2, 'Enrolled by Admin', $3::jsonb)`,
      [createdStudent.id, String(createdStudent.id), JSON.stringify({ enrolledBy: 'admin', tier: cleanTier })]
    );

    return res.status(201).json({
      status: 'success',
      message: `Student account created successfully. Default password: ${cleanPass}`,
      student: {
        id: createdStudent.id,
        fullName: createdStudent.full_name,
        email: createdStudent.email,
        mobile: createdStudent.mobile,
        targetGroup: createdStudent.target_group,
        district: createdStudent.district,
        city: createdStudent.city,
        tier: createdStudent.subscription_tier,
        createdAt: createdStudent.created_at,
        temporaryPassword: cleanPass,
      },
    });
  } catch (err: any) {
    console.error('[Admin Create Student Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to create student account.' });
  }
});

// ====================================================
// 12. ADMIN: RESTORE & DEACTIVATED STUDENTS LIST
// ====================================================
router.get('/admin/restore-list', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const listRes = await pool.query(
      `SELECT id, full_name, email, mobile, target_group, district, city, subscription_tier, is_active, deleted_at, created_at
       FROM students
       WHERE is_active = false OR deleted_at IS NOT NULL
       ORDER BY deleted_at DESC NULLS LAST, id DESC`
    );

    return res.status(200).json({
      status: 'success',
      data: {
        count: listRes.rows.length,
        students: listRes.rows.map((r) => ({
          id: r.id,
          fullName: r.full_name,
          email: r.email,
          mobile: r.mobile,
          targetGroup: r.target_group,
          district: r.district || 'Chennai',
          city: r.city || 'Central',
          tier: r.subscription_tier || 'free',
          isActive: r.is_active,
          deletedAt: r.deleted_at,
          createdAt: r.created_at,
        })),
      },
    });
  } catch (err: any) {
    console.error('[Admin Restore List Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch restorable students.' });
  }
});

// ====================================================
// 13. ADMIN: RESTORE DEACTIVATED STUDENT
// ====================================================
router.post('/admin/restore/:studentId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ status: 'error', message: 'Valid student ID is required.' });
    }

    const updateRes = await pool.query(
      `UPDATE students
       SET is_active = true, deleted_at = NULL
       WHERE id = $1
       RETURNING id, full_name, email, is_active`,
      [studentId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Student account not found.' });
    }

    try {
      await pool.query(
        `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
         VALUES ($1, 'account_restored', $1::text, 'Account Restored', $2::jsonb)`,
        [studentId, JSON.stringify({ restoredAt: new Date().toISOString() })]
      );
    } catch (actErr) {
      console.warn('[Admin Restore Student] Activity log notice:', actErr);
    }

    return res.status(200).json({
      status: 'success',
      message: `Account for ${updateRes.rows[0].full_name} has been successfully restored.`,
      student: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Admin Restore Student Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to restore student.' });
  }
});

// ====================================================
// 14. ADMIN: DEACTIVATE STUDENT ACCOUNT
// ====================================================
router.post('/admin/deactivate/:studentId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ status: 'error', message: 'Valid student ID is required.' });
    }

    const updateRes = await pool.query(
      `UPDATE students
       SET is_active = false, deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, full_name, email, is_active`,
      [studentId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Student account not found.' });
    }

    try {
      await pool.query(
        `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
         VALUES ($1, 'account_restored', $1::text, 'Account Restored', $2::jsonb)`,
        [studentId, JSON.stringify({ restoredAt: new Date().toISOString() })]
      );
    } catch (actErr) {
      console.warn('[Admin Restore Student] Activity log notice:', actErr);
    }

    return res.status(200).json({
      status: 'success',
      message: `Account for ${updateRes.rows[0].full_name} has been deactivated.`,
      student: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Admin Deactivate Student Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to deactivate student.' });
  }
});

// ===========================================================================
// STUDENT STUDY MATERIALS (Master Syllabus Single Source of Truth)
// ===========================================================================
router.get('/study-materials', async (req: Request, res: Response) => {
  try {
    const rawExamId = String(req.query.groupId || req.query.examId || 'group1').toLowerCase().trim();
    const examId = rawExamId === 'group2_2a' || rawExamId === 'group2' ? 'group2' : (rawExamId === 'group4_vao' || rawExamId === 'group4' ? 'group4' : rawExamId);
    const subjectId = String(req.query.subjectId || 'general-studies').toLowerCase().trim();
    const standardNumber = (req.query.standardId || req.query.standardNumber || req.query.classId)
      ? parseInt(String(req.query.standardId || req.query.standardNumber || req.query.classId), 10)
      : undefined;
    const unitNumber = req.query.unitNumber ? parseInt(String(req.query.unitNumber), 10) : undefined;

    const tree = await StudyManagementService.getFullHierarchyTree({
      examId,
      subjectId,
      standardNumber,
      unitNumber,
    });

    // Filter to published lessons and notes only (Requirements 6 & 11)
    const publishedTree = tree.map((unit: any) => ({
      ...unit,
      lessons: (unit.lessons || [])
        .filter((l: any) => l.status !== 'Draft' && l.status !== 'Archived')
        .map((l: any) => ({
          ...l,
          topics: (l.topics || []).map((t: any) => ({
            ...t,
            notes: (t.notes || []).filter((n: any) => n.status === 'published'),
          })),
        })),
    }));

    return res.status(200).json({
      status: 'success',
      success: true,
      examId,
      subjectId,
      standardNumber,
      unitNumber,
      tree: publishedTree,
    });
  } catch (err: any) {
    console.error('[Student Study Materials API Error]:', err);
    return res.status(500).json({ status: 'error', success: false, message: err.message });
  }
});

export default router;

