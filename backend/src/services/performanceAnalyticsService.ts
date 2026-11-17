import pool from '../db';
import { calculateSafePercentage } from './studentDashboardService';
import { inferCanonicalSubject, normalizeTestKey } from './markListService';

export interface PerformanceAnalyticsFilters {
  group?: string;
  subject?: string;
  range?: string; // '7d' | '30d' | '90d' | 'all'
  from?: string;
  to?: string;
  testKey?: string;
}

export interface AttemptPoint {
  id: number;
  testKey: string;
  testTitle: string;
  subject: string;
  category: string;
  attemptNumber: number;
  totalQuestions: number;
  attemptedQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unansweredQuestions: number;
  score: number;
  maxScore: number;
  percentage: number;
  timeTakenSeconds: number;
  completedAt: string;
}

export interface ComputedTestSummary {
  testKey: string;
  testTitle: string;
  subject: string;
  category: string;
  firstAttempt: number;
  bestAttempt: number;
  latestAttempt: number;
  totalAttempts: number;
  improvement: number;
  attempts: AttemptPoint[];
}

export function computeTestAttemptMetrics(attemptsAsc: AttemptPoint[]): ComputedTestSummary | null {
  if (!attemptsAsc || attemptsAsc.length === 0) return null;
  const sorted = [...attemptsAsc].sort(
    (a, b) => a.attemptNumber - b.attemptNumber || new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const best = sorted.reduce((max, item) => (item.percentage > max ? item.percentage : max), sorted[0].percentage);
  const improvement = Math.round((latest.percentage - first.percentage) * 10) / 10;

  return {
    testKey: first.testKey,
    testTitle: latest.testTitle,
    subject: latest.subject,
    category: latest.category,
    firstAttempt: Math.round(first.percentage * 10) / 10,
    bestAttempt: Math.round(best * 10) / 10,
    latestAttempt: Math.round(latest.percentage * 10) / 10,
    totalAttempts: sorted.length,
    improvement,
    attempts: sorted,
  };
}

function buildDateRangeFilter(range?: string, from?: string, to?: string): { startIso: string | null; endIso: string | null } {
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const end = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59.999Z` : null;
    return { startIso: `${from}T00:00:00.000Z`, endIso: end };
  }
  const clean = String(range || '30d').toLowerCase();
  if (clean === 'all') return { startIso: null, endIso: null };
  const days = clean === '7d' ? 7 : clean === '90d' ? 90 : 30;
  const d = new Date(Date.now() - days * 86400 * 1000);
  return { startIso: d.toISOString(), endIso: null };
}

export async function getStudentPerformanceAnalytics(studentId: number, filters: PerformanceAnalyticsFilters = {}) {
  const { startIso, endIso } = buildDateRangeFilter(filters.range, filters.from, filters.to);
  const groupFilter = String(filters.group || 'all').trim().toLowerCase();
  const subjectFilter = String(filters.subject || 'all').trim();

  const attemptWhere: string[] = [
    'student_id = $1',
    "COALESCE(status, 'completed') = 'completed'",
    'attempted_questions > 0',
  ];
  const attemptParams: any[] = [studentId];

  if (groupFilter && groupFilter !== 'all') {
    attemptParams.push(groupFilter);
    attemptWhere.push(`LOWER(COALESCE(category, '')) = $${attemptParams.length}`);
  }
  if (startIso) {
    attemptParams.push(startIso);
    attemptWhere.push(`completed_at >= $${attemptParams.length}::timestamptz`);
  }
  if (endIso) {
    attemptParams.push(endIso);
    attemptWhere.push(`completed_at <= $${attemptParams.length}::timestamptz`);
  }

  const qaWhere: string[] = [
    'student_id = $1',
    "source_system <> 'mock_test'",
    'selected_option IS NOT NULL',
    'selected_option >= 0',
  ];
  const qaParams: any[] = [studentId];
  if (groupFilter && groupFilter !== 'all') {
    qaParams.push(groupFilter);
    qaWhere.push(`LOWER(COALESCE(category, '')) = $${qaParams.length}`);
  }
  if (startIso) {
    qaParams.push(startIso);
    qaWhere.push(`attempted_at >= $${qaParams.length}::timestamptz`);
  }
  if (endIso) {
    qaParams.push(endIso);
    qaWhere.push(`attempted_at <= $${qaParams.length}::timestamptz`);
  }

  const [attemptsRes, qaRes] = await Promise.all([
    pool.query(
      `SELECT
         id, test_id, test_key, test_title, category, subject,
         attempt_number, total_questions, attempted_questions,
         correct_answers, incorrect_answers, unanswered_questions,
         score, max_score, percentage, time_spent_seconds,
         subject_breakdown, topic_breakdown, completed_at
       FROM mock_test_attempts
       WHERE ${attemptWhere.join(' AND ')}
       ORDER BY completed_at ASC, id ASC`,
      attemptParams
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total_attempted,
         COUNT(CASE WHEN is_correct THEN 1 END)::int AS total_correct
       FROM question_attempts
       WHERE ${qaWhere.join(' AND ')}`,
      qaParams
    ),
  ]);

  // Normalize rows and apply optional subject filter
  const allPoints: (AttemptPoint & { subjectBreakdown: any[]; topicBreakdown: any[] })[] = attemptsRes.rows
    .map((r) => {
      const tKey = r.test_key || normalizeTestKey(r.test_id, r.test_title);
      const subj = inferCanonicalSubject(
        r.subject || (Array.isArray(r.subject_breakdown) ? r.subject_breakdown[0]?.name : undefined),
        r.test_title
      );
      const totalQ = Number(r.total_questions || 0);
      const attemptedQ = Number(r.attempted_questions || 0);
      const correctA = Number(r.correct_answers || 0);
      const wrongA = Number(r.incorrect_answers ?? Math.max(0, attemptedQ - correctA));
      const unansweredQ = Number(r.unanswered_questions ?? Math.max(0, totalQ - attemptedQ));
      return {
        id: r.id,
        testKey: tKey,
        testTitle: r.test_title,
        subject: subj,
        category: r.category || 'group1',
        attemptNumber: Number(r.attempt_number || 1),
        totalQuestions: totalQ,
        attemptedQuestions: attemptedQ,
        correctAnswers: correctA,
        wrongAnswers: wrongA,
        unansweredQuestions: unansweredQ,
        score: parseFloat(r.score ?? 0),
        maxScore: parseFloat(r.max_score ?? totalQ),
        percentage: Math.round(parseFloat(r.percentage ?? 0) * 10) / 10,
        timeTakenSeconds: Number(r.time_spent_seconds || 0),
        completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : new Date().toISOString(),
        subjectBreakdown: Array.isArray(r.subject_breakdown) ? r.subject_breakdown : [],
        topicBreakdown: Array.isArray(r.topic_breakdown) ? r.topic_breakdown : [],
      };
    })
    .filter((pt) => subjectFilter === 'all' || pt.subject.toLowerCase() === subjectFilter.toLowerCase());

  // Group attempts by distinct testKey
  const byTestMap = new Map<string, typeof allPoints>();
  for (const pt of allPoints) {
    const arr = byTestMap.get(pt.testKey) || [];
    // Ensure sequential attemptNumber even for legacy rows created before attempt_number column
    arr.push({ ...pt, attemptNumber: arr.length + 1 });
    byTestMap.set(pt.testKey, arr);
  }

  const testSummaries: ComputedTestSummary[] = [];
  for (const arr of byTestMap.values()) {
    const summary = computeTestAttemptMetrics(arr);
    if (summary) testSummaries.push(summary);
  }

  // Sort tests by latest attempt timestamp descending
  testSummaries.sort(
    (a, b) =>
      new Date(b.attempts[b.attempts.length - 1].completedAt).getTime() -
      new Date(a.attempts[a.attempts.length - 1].completedAt).getTime()
  );

  // 1. Five Summary Cards (computed across distinct tests — never counting repeated attempts as separate tests)
  const distinctCount = testSummaries.length;
  const firstAttemptAverage =
    distinctCount > 0
      ? Math.round((testSummaries.reduce((sum, t) => sum + t.firstAttempt, 0) / distinctCount) * 10) / 10
      : 0;
  const bestAttemptAverage =
    distinctCount > 0
      ? Math.round((testSummaries.reduce((sum, t) => sum + t.bestAttempt, 0) / distinctCount) * 10) / 10
      : 0;
  const latestAttemptAverage =
    distinctCount > 0
      ? Math.round((testSummaries.reduce((sum, t) => sum + t.latestAttempt, 0) / distinctCount) * 10) / 10
      : 0;
  const totalAttempts = allPoints.length;
  const overallImprovement = Math.round((latestAttemptAverage - firstAttemptAverage) * 10) / 10;

  // 2. Selected Test & Trend Graph
  const requestedTestKey = filters.testKey ? String(filters.testKey).trim().toLowerCase() : '';
  const selectedTest =
    (requestedTestKey ? testSummaries.find((t) => t.testKey === requestedTestKey) : undefined) ||
    testSummaries.slice().sort((a, b) => b.totalAttempts - a.totalAttempts)[0] ||
    null;

  let runningBest = 0;
  const trendSeries = selectedTest
    ? selectedTest.attempts.map((a) => {
        runningBest = Math.max(runningBest, a.percentage);
        return {
          id: a.id,
          attemptNumber: a.attemptNumber,
          label: `Attempt ${a.attemptNumber}`,
          percentage: a.percentage,
          bestSoFar: Math.round(runningBest * 10) / 10,
          correctAnswers: a.correctAnswers,
          totalQuestions: a.totalQuestions,
          completedAt: a.completedAt,
        };
      })
    : [];

  // 3. Overall Accuracy Section (question-level accuracy separate from test-average)
  const testAttemptedSum = allPoints.reduce((s, p) => s + p.attemptedQuestions, 0);
  const testCorrectSum = allPoints.reduce((s, p) => s + p.correctAnswers, 0);
  const testWrongSum = allPoints.reduce((s, p) => s + p.wrongAnswers, 0);
  const testUnansweredSum = allPoints.reduce((s, p) => s + p.unansweredQuestions, 0);

  const qaAttempted = subjectFilter === 'all' ? Number(qaRes.rows[0]?.total_attempted || 0) : 0;
  const qaCorrect = subjectFilter === 'all' ? Number(qaRes.rows[0]?.total_correct || 0) : 0;
  const qaWrong = Math.max(0, qaAttempted - qaCorrect);

  const totalQuestionsAttempted = testAttemptedSum + qaAttempted;
  const totalCorrectAnswers = testCorrectSum + qaCorrect;
  const totalWrongAnswers = testWrongSum + qaWrong;
  const overallAccuracy = calculateSafePercentage(totalCorrectAnswers, totalQuestionsAttempted);

  // 4. Subject-Wise Performance Table
  const subjectMap = new Map<string, ComputedTestSummary[]>();
  for (const t of testSummaries) {
    const arr = subjectMap.get(t.subject) || [];
    arr.push(t);
    subjectMap.set(t.subject, arr);
  }

  const subjectPerformance = Array.from(subjectMap.entries())
    .map(([subject, tests]) => {
      const n = tests.length;
      const firstAvg = Math.round((tests.reduce((s, t) => s + t.firstAttempt, 0) / n) * 10) / 10;
      const bestAvg = Math.round((tests.reduce((s, t) => s + t.bestAttempt, 0) / n) * 10) / 10;
      const latestAvg = Math.round((tests.reduce((s, t) => s + t.latestAttempt, 0) / n) * 10) / 10;
      const attemptsSum = tests.reduce((s, t) => s + t.totalAttempts, 0);
      const imp = Math.round((latestAvg - firstAvg) * 10) / 10;
      return {
        subject,
        firstAttempt: firstAvg,
        bestAttempt: bestAvg,
        latestAttempt: latestAvg,
        totalAttempts: attemptsSum,
        improvement: imp,
        testKeys: tests.map((t) => t.testKey),
      };
    })
    .sort((a, b) => b.totalAttempts - a.totalAttempts);

  // 5. Individual Test Attempt History (sorted latest date first) + Analysis + Weak Topics
  const selectedAttemptHistory = selectedTest
    ? selectedTest.attempts
        .slice()
        .sort(
          (a, b) =>
            new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime() ||
            b.attemptNumber - a.attemptNumber
        )
        .map((a) => ({
          ...a,
          isBest: a.percentage === selectedTest.bestAttempt && selectedTest.bestAttempt > 0,
        }))
    : [];

  const topicAgg = new Map<string, { topic: string; total: number; correct: number }>();
  if (selectedTest) {
    for (const a of selectedTest.attempts) {
      const fullPoint = allPoints.find((p) => p.id === a.id);
      const topics = fullPoint?.topicBreakdown || [];
      for (const tb of topics) {
        const name = String(tb.name || '').trim();
        if (!name) continue;
        const cur = topicAgg.get(name) || { topic: name, total: 0, correct: 0 };
        cur.total += Number(tb.total || 0);
        cur.correct += Number(tb.correct || 0);
        topicAgg.set(name, cur);
      }
    }
  }
  const weakTopics = Array.from(topicAgg.values())
    .map((t) => ({
      topic: t.topic,
      total: t.total,
      correct: t.correct,
      accuracy: calculateSafePercentage(t.correct, t.total),
    }))
    .filter((t) => t.accuracy < 75)
    .sort((a, b) => a.accuracy - b.accuracy);

  const availableSubjects = Array.from(new Set(testSummaries.map((t) => t.subject))).sort();

  return {
    summary: {
      firstAttemptAverage,
      bestAttemptAverage,
      latestAttemptAverage,
      totalAttempts,
      overallImprovement,
      distinctTestsCount: distinctCount,
    },
    overallAccuracy: {
      percentage: overallAccuracy,
      correctAnswers: totalCorrectAnswers,
      wrongAnswers: totalWrongAnswers,
      questionsAttempted: totalQuestionsAttempted,
      unansweredQuestions: testUnansweredSum,
    },
    selectedTest: selectedTest
      ? {
          testKey: selectedTest.testKey,
          testTitle: selectedTest.testTitle,
          subject: selectedTest.subject,
          firstAttempt: selectedTest.firstAttempt,
          bestAttempt: selectedTest.bestAttempt,
          latestAttempt: selectedTest.latestAttempt,
          totalAttempts: selectedTest.totalAttempts,
          improvement: selectedTest.improvement,
        }
      : null,
    trendSeries,
    subjectPerformance,
    attemptHistory: selectedAttemptHistory,
    weakTopics,
    testsList: testSummaries.map((t) => ({
      testKey: t.testKey,
      testTitle: t.testTitle,
      subject: t.subject,
      totalAttempts: t.totalAttempts,
      latestAttempt: t.latestAttempt,
      bestAttempt: t.bestAttempt,
    })),
    availableSubjects,
  };
}
