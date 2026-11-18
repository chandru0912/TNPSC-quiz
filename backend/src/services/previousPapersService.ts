import pool from '../db';
import { submitAssessmentAttempt } from './markListService';

const DEFAULT_PAPERS = [
  { id: 1, year: 2024, exam: 'TNPSC Group 1', category: 'group1', subjects: 'General Studies (Prelims)', total_questions: 200, duration_minutes: 180, marks_per_question: 1.5 },
  { id: 2, year: 2024, exam: 'TNPSC Group 2 & 2A', category: 'group2_2a', subjects: 'General Studies + Aptitude + General Tamil', total_questions: 200, duration_minutes: 180, marks_per_question: 1.5 },
  { id: 3, year: 2024, exam: 'TNPSC Group 4', category: 'group4', subjects: 'Pothu Tamil + General Studies (SSLC Standard)', total_questions: 200, duration_minutes: 180, marks_per_question: 1.5 },
  { id: 4, year: 2023, exam: 'TNPSC Group 2 & 2A', category: 'group2_2a', subjects: 'General Studies & Language Eligibility', total_questions: 200, duration_minutes: 180, marks_per_question: 1.5 },
  { id: 5, year: 2023, exam: 'TNPSC Group 4', category: 'group4', subjects: 'General Studies & Tamil Administration Basics', total_questions: 200, duration_minutes: 180, marks_per_question: 1.5 },
  { id: 6, year: 2022, exam: 'TNPSC Group 1', category: 'group1', subjects: 'General Studies Paper I, II & III', total_questions: 200, duration_minutes: 180, marks_per_question: 1.5 },
  { id: 7, year: 2022, exam: 'TNPSC Group 2 & 2A', category: 'group2_2a', subjects: 'Group 2 & 2A Combined Official Solved Paper', total_questions: 200, duration_minutes: 180, marks_per_question: 1.5 },
  { id: 8, year: 2022, exam: 'TNPSC Group 4', category: 'group4', subjects: 'Combined Group 4 Official Solved Paper', total_questions: 200, duration_minutes: 180, marks_per_question: 1.5 },
];

const CURATED_TNPSC_BANK = [
  {
    subject: 'Indian Polity',
    topic: 'Fundamental Rights',
    q: 'Which Article of the Indian Constitution guarantees Equality Before Law and Equal Protection of the Laws?',
    opts: ['Article 14', 'Article 19', 'Article 21', 'Article 32'],
    ans: 0,
    exp: 'Article 14 under Part III guarantees equality before the law and equal protection of the laws within the territory of India.',
  },
  {
    subject: 'Tamil Nadu Administration',
    topic: 'TNPSC History',
    q: 'In which year was the Tamil Nadu Public Service Commission originally established as the Madras Service Commission?',
    opts: ['1929', '1935', '1947', '1950'],
    ans: 0,
    exp: 'The Madras Service Commission was constituted in 1929 under an Act of the Madras Legislature.',
  },
  {
    subject: 'General Science',
    topic: 'Units and Measurements',
    q: 'What is the SI unit of luminous intensity?',
    opts: ['Kelvin', 'Candela', 'Mole', 'Ampere'],
    ans: 1,
    exp: 'Candela (cd) is the SI base unit of luminous intensity.',
  },
  {
    subject: 'Geography',
    topic: 'Rivers of Tamil Nadu',
    q: 'Which river is known as the Dakshin Ganga of South India and flows through Thanjavur delta?',
    opts: ['Vaigai', 'Kaveri', 'Thamirabarani', 'Palar'],
    ans: 1,
    exp: 'The Kaveri river originates in Talakaveri and forms the fertile Thanjavur delta in Tamil Nadu.',
  },
  {
    subject: 'Indian National Movement',
    topic: 'Freedom Struggle in Tamil Nadu',
    q: 'Who led the Vedaranyam Salt Satyagraha march in Tamil Nadu in April 1930?',
    opts: ['C. Rajagopalachari', 'V.O. Chidambaram Pillai', 'K. Kamaraj', 'Subramania Bharati'],
    ans: 0,
    exp: 'C. Rajagopalachari led the Salt Satyagraha march from Tiruchirappalli to Vedaranyam in April 1930.',
  },
  {
    subject: 'Indian Economy',
    topic: 'Five Year Plans',
    q: 'Which Five-Year Plan in India was based on the Mahalanobis Model focusing on heavy industries?',
    opts: ['First Five-Year Plan', 'Second Five-Year Plan', 'Third Five-Year Plan', 'Fourth Five-Year Plan'],
    ans: 1,
    exp: 'The Second Five-Year Plan (1956–1961) was formulated on the P.C. Mahalanobis growth model.',
  },
  {
    subject: 'Tamil Heritage',
    topic: 'Thirukkural',
    q: 'How many chapters (Adhikarams) and couplets (Kurals) are there in Thirukkural?',
    opts: ['100 chapters, 1000 couplets', '133 chapters, 1330 couplets', '120 chapters, 1200 couplets', '144 chapters, 1440 couplets'],
    ans: 1,
    exp: 'Thirukkural consists of 133 Adhikarams with 10 couplets each, totalling 1330 Kurals.',
  },
  {
    subject: 'Aptitude',
    topic: 'Percentage & Ratio',
    q: 'If the ratio of two numbers is 3:5 and their sum is 160, what is the larger number?',
    opts: ['60', '80', '100', '120'],
    ans: 2,
    exp: 'Sum of ratio parts = 3 + 5 = 8. One part = 160 / 8 = 20. Larger number = 5 × 20 = 100.',
  },
  {
    subject: 'General Science',
    topic: 'Human Physiology',
    q: 'Which vitamin deficiency causes Scurvy?',
    opts: ['Vitamin A', 'Vitamin B1', 'Vitamin C', 'Vitamin D'],
    ans: 2,
    exp: 'Ascorbic acid (Vitamin C) deficiency leads to Scurvy, affecting gums and connective tissues.',
  },
  {
    subject: 'Indian Polity',
    topic: 'Constitutional Amendments',
    q: 'Which Constitutional Amendment Act lowered the voting age in India from 21 years to 18 years?',
    opts: ['42nd Amendment', '44th Amendment', '61st Amendment', '73rd Amendment'],
    ans: 2,
    exp: 'The 61st Constitutional Amendment Act, 1988 reduced the voting age from 21 to 18.',
  },
];

let seedPromise: Promise<void> | null = null;

export async function ensurePreviousPapersSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existingPapers = await pool.query(`SELECT COUNT(*)::int AS cnt FROM previous_year_papers`);
      if (existingPapers.rows[0].cnt === 0) {
        for (const p of DEFAULT_PAPERS) {
          await pool.query(
            `INSERT INTO previous_year_papers (id, year, exam, category, subjects, total_questions, duration_minutes, marks_per_question, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published')
             ON CONFLICT (id) DO NOTHING`,
            [p.id, p.year, p.exam, p.category, p.subjects, p.total_questions, p.duration_minutes, p.marks_per_question]
          );
        }
        await pool.query(
          `SELECT setval(pg_get_serial_sequence('previous_year_papers', 'id'), COALESCE((SELECT MAX(id) FROM previous_year_papers), 1), true)`
        );
      }

      // Ensure every published paper has its full 200 questions in previous_year_paper_questions
      const papersRes = await pool.query(
        `SELECT p.id, p.year, p.exam, p.category, p.total_questions,
                (SELECT COUNT(*)::int FROM previous_year_paper_questions q WHERE q.paper_id = p.id) AS existing_q_count
         FROM previous_year_papers p
         ORDER BY p.id ASC`
      );

      const needSeed = papersRes.rows.filter((p) => p.existing_q_count < p.total_questions);
      if (needSeed.length === 0) return;

      const bankRes = await pool.query(
        `SELECT id, subject, topic, question_text, option_a, option_b, option_c, option_d, options, correct_answer, explanation
         FROM questions
         WHERE status = 'published'
         ORDER BY id ASC
         LIMIT 200`
      );

      const dbBank = bankRes.rows.map((r: any) => {
        let opts: string[] = [];
        if (r.option_a && r.option_b && r.option_c && r.option_d) {
          opts = [r.option_a, r.option_b, r.option_c, r.option_d];
        } else {
          const parsed = typeof r.options === 'string' ? JSON.parse(r.options) : r.options || [];
          opts = [parsed[0] || 'Option A', parsed[1] || 'Option B', parsed[2] || 'Option C', parsed[3] || 'Option D'];
        }
        return {
          questionId: Number(r.id),
          subject: r.subject || 'General Studies',
          topic: r.topic || 'General Studies',
          q: String(r.question_text || ''),
          opts,
          ans: Number(r.correct_answer) || 0,
          exp: r.explanation || null,
        };
      });

      for (const paper of needSeed) {
        const targetCount = Number(paper.total_questions) || 200;
        const paperIds: number[] = [];
        const qNums: number[] = [];
        const qIds: (number | null)[] = [];
        const subjects: string[] = [];
        const topics: string[] = [];
        const qTexts: string[] = [];
        const optAs: string[] = [];
        const optBs: string[] = [];
        const optCs: string[] = [];
        const optDs: string[] = [];
        const corrects: number[] = [];
        const exps: (string | null)[] = [];

        for (let qNum = 1; qNum <= targetCount; qNum++) {
          const idx = (qNum - 1 + paper.id * 7) % (dbBank.length + CURATED_TNPSC_BANK.length);
          const item =
            idx < dbBank.length
              ? dbBank[idx]
              : { questionId: null, ...CURATED_TNPSC_BANK[idx - dbBank.length] };

          paperIds.push(paper.id);
          qNums.push(qNum);
          qIds.push(item.questionId);
          subjects.push(item.subject);
          topics.push(item.topic);
          qTexts.push(item.q);
          optAs.push(item.opts[0]);
          optBs.push(item.opts[1]);
          optCs.push(item.opts[2]);
          optDs.push(item.opts[3]);
          corrects.push(item.ans);
          exps.push(item.exp);
        }

        await pool.query(
          `INSERT INTO previous_year_paper_questions (
             paper_id, question_number, question_id, subject, topic,
             question_text, option_a, option_b, option_c, option_d, correct_answer, explanation
           )
           SELECT * FROM UNNEST(
             $1::int[], $2::int[], $3::int[], $4::text[], $5::text[],
             $6::text[], $7::text[], $8::text[], $9::text[], $10::text[], $11::int[], $12::text[]
           )
           ON CONFLICT (paper_id, question_number) DO NOTHING`,
          [paperIds, qNums, qIds, subjects, topics, qTexts, optAs, optBs, optCs, optDs, corrects, exps]
        );
      }
    })().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  await seedPromise;
}

export async function listPreviousPapers(category?: string) {
  await ensurePreviousPapersSeeded();
  const params: any[] = [];
  let whereClause = `WHERE p.status = 'published'`;
  if (category && category !== 'all') {
    params.push(category);
    whereClause += ` AND p.category = $1`;
  }

  const res = await pool.query(
    `SELECT p.id, p.year, p.exam, p.category, p.subjects,
            p.total_questions, p.duration_minutes, p.marks_per_question::float AS marks_per_question,
            (SELECT COUNT(*)::int FROM previous_year_paper_questions q WHERE q.paper_id = p.id) AS loaded_questions
     FROM previous_year_papers p
     ${whereClause}
     ORDER BY p.year DESC, p.id ASC`,
    params
  );

  return res.rows.map((r: any) => ({
    id: r.id,
    year: r.year,
    exam: r.exam,
    category: r.category,
    subjects: r.subjects,
    questions: r.loaded_questions > 0 ? r.loaded_questions : r.total_questions,
    durationMinutes: r.duration_minutes,
    marksPerQuestion: Number(r.marks_per_question),
    totalMarks: Math.round((r.loaded_questions > 0 ? r.loaded_questions : r.total_questions) * Number(r.marks_per_question)),
  }));
}

export async function startOrResumePaperSession(studentId: number, paperId: number) {
  await ensurePreviousPapersSeeded();

  const paperRes = await pool.query(
    `SELECT id, year, exam, category, subjects, total_questions, duration_minutes, marks_per_question::float AS marks_per_question
     FROM previous_year_papers
     WHERE id = $1 AND status = 'published'`,
    [paperId]
  );
  if (paperRes.rows.length === 0) {
    return null;
  }
  const paper = paperRes.rows[0];

  // Check for existing active session
  let sessionRes = await pool.query(
    `SELECT id, status, started_at, expires_at, current_question,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))))::int AS remaining_seconds
     FROM student_test_sessions
     WHERE student_id = $1 AND paper_id = $2 AND status = 'in_progress'
     ORDER BY id DESC
     LIMIT 1`,
    [studentId, paperId]
  );

  if (sessionRes.rows.length > 0 && sessionRes.rows[0].remaining_seconds <= 0) {
    // Auto-submit expired session before creating a fresh one
    await submitPaperSession(studentId, sessionRes.rows[0].id, true);
    sessionRes = { rows: [] } as any;
  }

  let session = sessionRes.rows[0];
  if (!session) {
    const insertRes = await pool.query(
      `INSERT INTO student_test_sessions (student_id, paper_id, status, started_at, expires_at, current_question)
       VALUES ($1, $2, 'in_progress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + ($3 || ' minutes')::interval, 1)
       RETURNING id, status, started_at, expires_at, current_question,
                 GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))))::int AS remaining_seconds`,
      [studentId, paperId, String(paper.duration_minutes)]
    );
    session = insertRes.rows[0];
  }

  // IMPORTANT: Never select correct_answer or explanation during active test!
  const questionsRes = await pool.query(
    `SELECT id, question_number, subject, topic, question_text, option_a, option_b, option_c, option_d
     FROM previous_year_paper_questions
     WHERE paper_id = $1
     ORDER BY question_number ASC`,
    [paperId]
  );

  const answersRes = await pool.query(
    `SELECT question_id, question_number, selected_option, is_marked_for_review, is_visited
     FROM student_test_answers
     WHERE session_id = $1`,
    [session.id]
  );

  const answersMap: Record<number, { selectedOption: number | null; isMarkedForReview: boolean; isVisited: boolean }> = {};
  for (const row of answersRes.rows) {
    answersMap[row.question_number] = {
      selectedOption: row.selected_option !== null ? Number(row.selected_option) : null,
      isMarkedForReview: Boolean(row.is_marked_for_review),
      isVisited: Boolean(row.is_visited),
    };
  }

  return {
    session: {
      id: session.id,
      status: session.status,
      startedAt: session.started_at,
      expiresAt: session.expires_at,
      remainingSeconds: session.remaining_seconds,
      currentQuestion: session.current_question || 1,
    },
    paper: {
      id: paper.id,
      year: paper.year,
      exam: paper.exam,
      category: paper.category,
      subjects: paper.subjects,
      totalQuestions: questionsRes.rows.length,
      durationMinutes: paper.duration_minutes,
      marksPerQuestion: Number(paper.marks_per_question),
      totalMarks: Math.round(questionsRes.rows.length * Number(paper.marks_per_question)),
    },
    questions: questionsRes.rows.map((q: any) => ({
      id: q.id,
      questionNumber: q.question_number,
      subject: q.subject,
      topic: q.topic,
      questionText: q.question_text,
      options: [q.option_a, q.option_b, q.option_c, q.option_d],
    })),
    answers: answersMap,
  };
}

export async function saveSessionAnswer(
  studentId: number,
  sessionId: number,
  payload: {
    questionId: number;
    questionNumber: number;
    selectedOption: number | null;
    isMarkedForReview: boolean;
    isVisited: boolean;
    currentQuestion?: number;
  }
) {
  const sessionCheck = await pool.query(
    `SELECT id, status, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))))::int AS remaining_seconds
     FROM student_test_sessions
     WHERE id = $1 AND student_id = $2`,
    [sessionId, studentId]
  );

  if (sessionCheck.rows.length === 0) {
    return { notFound: true };
  }
  const session = sessionCheck.rows[0];
  if (session.status !== 'in_progress') {
    return { alreadySubmitted: true };
  }

  await pool.query(
    `INSERT INTO student_test_answers (session_id, question_id, question_number, selected_option, is_marked_for_review, is_visited, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
     ON CONFLICT (session_id, question_id) DO UPDATE SET
       selected_option = EXCLUDED.selected_option,
       is_marked_for_review = EXCLUDED.is_marked_for_review,
       is_visited = EXCLUDED.is_visited,
       updated_at = CURRENT_TIMESTAMP`,
    [
      sessionId,
      payload.questionId,
      payload.questionNumber,
      payload.selectedOption,
      Boolean(payload.isMarkedForReview),
      Boolean(payload.isVisited),
    ]
  );

  if (payload.currentQuestion && payload.currentQuestion >= 1) {
    await pool.query(
      `UPDATE student_test_sessions SET current_question = $1 WHERE id = $2`,
      [payload.currentQuestion, sessionId]
    );
  }

  return {
    saved: true,
    remainingSeconds: session.remaining_seconds,
  };
}

export async function submitPaperSession(studentId: number, sessionId: number, autoSubmitted = false) {
  const client = await pool.connect();
  let committedResult: { paperId: number; attemptId: number | null } | null = null;

  try {
    await client.query('BEGIN');

    const sessionRes = await client.query(
      `SELECT s.*, p.year, p.exam, p.category, p.subjects, p.marks_per_question::float AS marks_per_question, p.negative_marking::float AS negative_marking
       FROM student_test_sessions s
       JOIN previous_year_papers p ON p.id = s.paper_id
       WHERE s.id = $1 AND s.student_id = $2
       FOR UPDATE`,
      [sessionId, studentId]
    );

    if (sessionRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const session = sessionRes.rows[0];
    if (session.status !== 'in_progress') {
      await client.query('ROLLBACK');
      return getSessionResult(studentId, sessionId);
    }

    const questionsRes = await client.query(
      `SELECT id, question_number, question_id, subject, topic, question_text,
              option_a, option_b, option_c, option_d, correct_answer, explanation
       FROM previous_year_paper_questions
       WHERE paper_id = $1
       ORDER BY question_number ASC`,
      [session.paper_id]
    );

    const answersRes = await client.query(
      `SELECT question_id, selected_option
       FROM student_test_answers
       WHERE session_id = $1`,
      [sessionId]
    );

    const ansByQId = new Map<number, number | null>();
    for (const row of answersRes.rows) {
      ansByQId.set(Number(row.question_id), row.selected_option !== null ? Number(row.selected_option) : null);
    }

    const totalQuestions = questionsRes.rows.length;
    const marksPerQ = Number(session.marks_per_question) || 1.5;
    const negMark = Number(session.negative_marking) || 0;

    let attemptedQuestions = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let unansweredQuestions = 0;

    const responses: any[] = [];
    for (const q of questionsRes.rows) {
      const sel = ansByQId.get(Number(q.id)) ?? null;
      const isAttempted = sel !== null && sel >= 0 && sel <= 3;
      const isCorrect = isAttempted && sel === Number(q.correct_answer);
      if (!isAttempted) {
        unansweredQuestions++;
      } else {
        attemptedQuestions++;
        if (isCorrect) correctAnswers++;
        else incorrectAnswers++;
      }

      responses.push({
        questionId: q.question_id || q.id,
        questionNumber: q.question_number,
        questionText: q.question_text,
        options: [q.option_a, q.option_b, q.option_c, q.option_d],
        subject: q.subject,
        topic: q.topic || q.subject,
        selectedOption: isAttempted ? sel : null,
        correctAnswer: Number(q.correct_answer),
        isCorrect,
        explanation: q.explanation || null,
      });
    }

    const score = Math.max(0, Number((correctAnswers * marksPerQ - incorrectAnswers * negMark).toFixed(2)));
    const maxScore = Number((totalQuestions * marksPerQ).toFixed(2));
    const timeSpentRes = await client.query(
      `SELECT GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at))))::int AS elapsed
       FROM student_test_sessions WHERE id = $1`,
      [sessionId]
    );
    const timeSpentSeconds = timeSpentRes.rows[0]?.elapsed || 1;
    const nextStatus = autoSubmitted ? 'auto_submitted' : 'completed';

    await client.query(
      `UPDATE student_test_sessions
       SET status = $1,
           submitted_at = CURRENT_TIMESTAMP,
           submission_token = $2
       WHERE id = $3`,
      [nextStatus, `pyp_${sessionId}`, sessionId]
    );

    await client.query('COMMIT');
    committedResult = { paperId: session.paper_id, attemptId: null };

    // Record in mock_test_attempts with assessment_type = 'previous_paper'
    const attemptOutcome = await submitAssessmentAttempt(studentId, {
      testId: `pyp-${session.paper_id}`,
      testTitle: `${session.exam} (${session.year})`,
      category: session.category,
      assessmentType: 'previous_paper',
      submissionToken: `pyp_${sessionId}`,
      totalQuestions,
      attemptedQuestions,
      correctAnswers,
      incorrectAnswers,
      unansweredQuestions,
      score,
      maxScore,
      timeSpentSeconds,
      responses,
    });

    if (attemptOutcome.attemptId) {
      await pool.query(
        `UPDATE student_test_sessions SET attempt_id = $1 WHERE id = $2`,
        [attemptOutcome.attemptId, sessionId]
      );
    }

    return getSessionResult(studentId, sessionId);
  } catch (err) {
    if (!committedResult) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function getSessionResult(studentId: number, sessionId: number) {
  const sessionRes = await pool.query(
    `SELECT s.*, p.year, p.exam, p.category, p.subjects,
            p.duration_minutes, p.marks_per_question::float AS marks_per_question, p.negative_marking::float AS negative_marking
     FROM student_test_sessions s
     JOIN previous_year_papers p ON p.id = s.paper_id
     WHERE s.id = $1 AND s.student_id = $2`,
    [sessionId, studentId]
  );

  if (sessionRes.rows.length === 0) return null;
  const session = sessionRes.rows[0];
  if (session.status === 'in_progress') return null;

  const questionsRes = await pool.query(
    `SELECT id, question_number, subject, topic, question_text,
            option_a, option_b, option_c, option_d, correct_answer, explanation
     FROM previous_year_paper_questions
     WHERE paper_id = $1
     ORDER BY question_number ASC`,
    [session.paper_id]
  );

  const answersRes = await pool.query(
    `SELECT question_id, selected_option
     FROM student_test_answers
     WHERE session_id = $1`,
    [sessionId]
  );

  const ansByQId = new Map<number, number | null>();
  for (const row of answersRes.rows) {
    ansByQId.set(Number(row.question_id), row.selected_option !== null ? Number(row.selected_option) : null);
  }

  const totalQuestions = questionsRes.rows.length;
  const marksPerQ = Number(session.marks_per_question) || 1.5;
  const negMark = Number(session.negative_marking) || 0;

  let attemptedQuestions = 0;
  let correctAnswers = 0;
  let incorrectAnswers = 0;
  let unansweredQuestions = 0;

  const reviewQuestions = questionsRes.rows.map((q: any) => {
    const sel = ansByQId.get(Number(q.id)) ?? null;
    const isAttempted = sel !== null && sel >= 0 && sel <= 3;
    const isCorrect = isAttempted && sel === Number(q.correct_answer);
    if (!isAttempted) unansweredQuestions++;
    else {
      attemptedQuestions++;
      if (isCorrect) correctAnswers++;
      else incorrectAnswers++;
    }
    return {
      id: q.id,
      questionNumber: q.question_number,
      subject: q.subject,
      topic: q.topic,
      questionText: q.question_text,
      options: [q.option_a, q.option_b, q.option_c, q.option_d],
      selectedOption: isAttempted ? sel : null,
      correctAnswer: Number(q.correct_answer),
      isCorrect,
      explanation: q.explanation || null,
    };
  });

  const score = Math.max(0, Number((correctAnswers * marksPerQ - incorrectAnswers * negMark).toFixed(2)));
  const maxScore = Number((totalQuestions * marksPerQ).toFixed(2));
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const accuracy = attemptedQuestions > 0 ? Math.round((correctAnswers / attemptedQuestions) * 100) : 0;
  const timeSpentSeconds =
    session.submitted_at && session.started_at
      ? Math.max(1, Math.floor((new Date(session.submitted_at).getTime() - new Date(session.started_at).getTime()) / 1000))
      : 0;

  return {
    sessionId: session.id,
    status: session.status,
    submittedAt: session.submitted_at,
    paper: {
      id: session.paper_id,
      year: session.year,
      exam: session.exam,
      category: session.category,
      subjects: session.subjects,
    },
    summary: {
      totalQuestions,
      attemptedQuestions,
      correctAnswers,
      incorrectAnswers,
      unansweredQuestions,
      score,
      maxScore,
      percentage,
      accuracy,
      timeSpentSeconds,
    },
    reviewQuestions,
  };
}
