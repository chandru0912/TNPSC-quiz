import pool from '../db';

export type AwardType = 'GOLD' | 'PLATINUM' | 'SILVER' | 'NONE';

export interface AwardSettings {
  isEnabled: boolean;
  goldMin: number;
  goldMax: number;
  platinumMin: number;
  platinumMax: number;
  silverMin: number;
  silverMax: number;
  version: number;
  updatedAt?: string;
}

export interface AwardCounters {
  goldCount: number;
  platinumCount: number;
  silverCount: number;
  totalAwards: number;
}

export const DEFAULT_AWARD_SETTINGS: AwardSettings = {
  isEnabled: true,
  goldMin: 90,
  goldMax: 100,
  platinumMin: 75,
  platinumMax: 89.99,
  silverMin: 60,
  silverMax: 74.99,
  version: 1,
};

let cachedSettings: { data: AwardSettings; expiresAt: number } | null = null;

export function invalidateAwardSettingsCache(): void {
  cachedSettings = null;
}

export async function getAwardSettings(): Promise<AwardSettings> {
  if (cachedSettings && cachedSettings.expiresAt > Date.now()) {
    return cachedSettings.data;
  }

  try {
    const res = await pool.query(
      `SELECT is_enabled, gold_min, gold_max, platinum_min, platinum_max, silver_min, silver_max, version, updated_at
       FROM award_settings
       WHERE id = 1`
    );
    if (res.rows.length > 0) {
      const r = res.rows[0];
      const data: AwardSettings = {
        isEnabled: Boolean(r.is_enabled),
        goldMin: Number(r.gold_min),
        goldMax: Number(r.gold_max),
        platinumMin: Number(r.platinum_min),
        platinumMax: Number(r.platinum_max),
        silverMin: Number(r.silver_min),
        silverMax: Number(r.silver_max),
        version: Number(r.version || 1),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
      };
      cachedSettings = { data, expiresAt: Date.now() + 60_000 };
      return data;
    }
  } catch {
    // Fallback to defaults if table not yet migrated
  }

  return DEFAULT_AWARD_SETTINGS;
}

/**
 * Strictly determines at most ONE award according to the ranking:
 * 1. GOLD -> 2. PLATINUM -> 3. SILVER -> NONE
 */
export function resolveAwardForPercentage(
  percentage: number,
  settings: AwardSettings = DEFAULT_AWARD_SETTINGS
): AwardType {
  if (!settings.isEnabled) return 'NONE';
  const pct = Math.max(0, Math.min(100, Math.round(Number(percentage || 0) * 100) / 100));

  if (pct >= settings.goldMin && pct <= settings.goldMax) {
    return 'GOLD';
  }
  if (pct >= settings.platinumMin && pct < settings.goldMin) {
    return 'PLATINUM';
  }
  if (pct >= settings.silverMin && pct < settings.platinumMin) {
    return 'SILVER';
  }
  return 'NONE';
}

export async function calculateAttemptAward(percentage: number): Promise<{
  awardType: AwardType;
  snapshot: {
    version: number;
    isEnabled: boolean;
    goldMin: number;
    goldMax: number;
    platinumMin: number;
    platinumMax: number;
    silverMin: number;
    silverMax: number;
  };
}> {
  const settings = await getAwardSettings();
  const awardType = resolveAwardForPercentage(percentage, settings);
  return {
    awardType,
    snapshot: {
      version: settings.version,
      isEnabled: settings.isEnabled,
      goldMin: settings.goldMin,
      goldMax: settings.goldMax,
      platinumMin: settings.platinumMin,
      platinumMax: settings.platinumMax,
      silverMin: settings.silverMin,
      silverMax: settings.silverMax,
    },
  };
}

export function computeAwardCountersFromRows(rows: Array<{ award_type?: string | null; percentage?: number | string | null }>): AwardCounters {
  let goldCount = 0;
  let platinumCount = 0;
  let silverCount = 0;

  for (const r of rows) {
    const stored = String(r.award_type || '').toUpperCase().trim();
    const resolved: AwardType =
      stored === 'GOLD' || stored === 'PLATINUM' || stored === 'SILVER' || stored === 'NONE'
        ? (stored as AwardType)
        : resolveAwardForPercentage(Number(r.percentage || 0), DEFAULT_AWARD_SETTINGS);

    if (resolved === 'GOLD') goldCount++;
    else if (resolved === 'PLATINUM') platinumCount++;
    else if (resolved === 'SILVER') silverCount++;
  }

  return {
    goldCount,
    platinumCount,
    silverCount,
    totalAwards: goldCount + platinumCount + silverCount,
  };
}

export function validateAwardThresholds(input: Partial<AwardSettings>): {
  isEnabled: boolean;
  goldMin: number;
  goldMax: number;
  platinumMin: number;
  platinumMax: number;
  silverMin: number;
  silverMax: number;
} {
  const isEnabled = input.isEnabled !== undefined ? Boolean(input.isEnabled) : true;
  const goldMin = Math.round(Number(input.goldMin) * 100) / 100;
  const goldMax = Math.round(Number(input.goldMax ?? 100) * 100) / 100;
  const platinumMin = Math.round(Number(input.platinumMin) * 100) / 100;
  const platinumMax = Math.round(Number(input.platinumMax) * 100) / 100;
  const silverMin = Math.round(Number(input.silverMin) * 100) / 100;
  const silverMax = Math.round(Number(input.silverMax) * 100) / 100;

  const nums = [goldMin, goldMax, platinumMin, platinumMax, silverMin, silverMax];
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 100)) {
    throw new Error('All award thresholds must be valid numbers between 0% and 100%.');
  }

  if (silverMin >= silverMax) {
    throw new Error('Silver minimum percentage must be strictly less than Silver maximum percentage.');
  }
  if (platinumMin >= platinumMax) {
    throw new Error('Platinum minimum percentage must be strictly less than Platinum maximum percentage.');
  }
  if (goldMin >= goldMax) {
    throw new Error('Gold minimum percentage must be strictly less than Gold maximum percentage.');
  }

  if (silverMax >= platinumMin) {
    throw new Error('Silver and Platinum thresholds must not overlap (Silver max must be below Platinum min).');
  }
  if (platinumMax >= goldMin) {
    throw new Error('Platinum and Gold thresholds must not overlap (Platinum max must be below Gold min).');
  }

  if (Math.round((platinumMin - silverMax) * 100) > 2) {
    throw new Error('Unintended gap detected between Silver maximum and Platinum minimum.');
  }
  if (Math.round((goldMin - platinumMax) * 100) > 2) {
    throw new Error('Unintended gap detected between Platinum maximum and Gold minimum.');
  }
  if (goldMax !== 100) {
    throw new Error('Gold maximum percentage must reach 100%.');
  }

  return {
    isEnabled,
    goldMin,
    goldMax,
    platinumMin,
    platinumMax,
    silverMin,
    silverMax,
  };
}

export async function updateAwardSettings(input: Partial<AwardSettings>): Promise<AwardSettings> {
  const valid = validateAwardThresholds(input);
  await pool.query(
    `INSERT INTO award_settings (id, is_enabled, gold_min, gold_max, platinum_min, platinum_max, silver_min, silver_max, version, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7, 1, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET
       is_enabled = EXCLUDED.is_enabled,
       gold_min = EXCLUDED.gold_min,
       gold_max = EXCLUDED.gold_max,
       platinum_min = EXCLUDED.platinum_min,
       platinum_max = EXCLUDED.platinum_max,
       silver_min = EXCLUDED.silver_min,
       silver_max = EXCLUDED.silver_max,
       version = award_settings.version + 1,
       updated_at = CURRENT_TIMESTAMP`,
    [
      valid.isEnabled,
      valid.goldMin,
      valid.goldMax,
      valid.platinumMin,
      valid.platinumMax,
      valid.silverMin,
      valid.silverMax,
    ]
  );
  invalidateAwardSettingsCache();
  return await getAwardSettings();
}

export async function resetAwardSettingsToDefault(): Promise<AwardSettings> {
  return await updateAwardSettings(DEFAULT_AWARD_SETTINGS);
}

export async function getStudentAwardsDashboardSummary(studentId: number): Promise<{
  goldCount: number;
  platinumCount: number;
  silverCount: number;
  totalAwards: number;
  highestAchievement: 'GOLD' | 'PLATINUM' | 'SILVER' | 'None Yet';
  lessonsCompleted: number;
  mockTestsCompleted: number;
}> {
  const res = await pool.query(
    `SELECT award_type, percentage, assessment_type, mock_test_format, lesson_id, lesson_title, test_id, test_title
     FROM mock_test_attempts
     WHERE student_id = $1
       AND COALESCE(status, 'completed') = 'completed'
       AND attempted_questions > 0`,
    [studentId]
  );

  const counters = computeAwardCountersFromRows(res.rows);
  const highestAchievement: 'GOLD' | 'PLATINUM' | 'SILVER' | 'None Yet' =
    counters.goldCount > 0
      ? 'GOLD'
      : counters.platinumCount > 0
        ? 'PLATINUM'
        : counters.silverCount > 0
          ? 'SILVER'
          : 'None Yet';

  const completedLessonsSet = new Set<string>();
  const completedMockSet = new Set<string>();

  for (const r of res.rows) {
    const fmt = String(r.mock_test_format || '').toLowerCase();
    const isMock = fmt === 'lesson_wise' || fmt === 'unit_wise' || fmt === 'full_length' || String(r.assessment_type || '').toLowerCase() === 'mock_test';
    const lessonKey = String(r.lesson_id || r.lesson_title || '').trim().toLowerCase();
    if (lessonKey) {
      completedLessonsSet.add(lessonKey);
    }
    if (isMock) {
      const mockKey = String(r.test_id || r.test_title || '').trim().toLowerCase();
      if (mockKey) completedMockSet.add(mockKey);
    }
  }

  return {
    ...counters,
    highestAchievement,
    lessonsCompleted: completedLessonsSet.size,
    mockTestsCompleted: completedMockSet.size,
  };
}

export async function getAdminAwardHistory(filters?: {
  group?: string;
  subject?: string;
  standard?: string;
  unit?: string;
  lesson?: string;
  awardType?: string;
  search?: string;
  limit?: number;
}) {
  const where: string[] = [
    `COALESCE(mta.status, 'completed') = 'completed'`,
    `mta.attempted_questions > 0`,
  ];
  const params: any[] = [];
  let idx = 1;

  if (filters?.group && filters.group !== 'all') {
    const clean = filters.group.trim().toLowerCase();
    if (clean === 'group1' || clean === 'group 1') {
      where.push(`(LOWER(COALESCE(mta.group_id, '')) = 'group1' OR LOWER(COALESCE(mta.category, '')) = 'group1')`);
    } else if (clean === 'group2' || clean === 'group2_2a' || clean === 'group2a') {
      where.push(`(LOWER(COALESCE(mta.group_id, '')) IN ('group2', 'group2a', 'group2_2a') OR LOWER(COALESCE(mta.category, '')) IN ('group2', 'group2a', 'group2_2a'))`);
    } else if (clean === 'group4' || clean === 'group4_vao' || clean === 'vao') {
      where.push(`(LOWER(COALESCE(mta.group_id, '')) IN ('group4', 'vao', 'group4_vao') OR LOWER(COALESCE(mta.category, '')) IN ('group4', 'vao', 'group4_vao'))`);
    }
  }

  if (filters?.subject && filters.subject !== 'all') {
    const clean = filters.subject.trim().toLowerCase();
    where.push(`(LOWER(COALESCE(mta.subject_id, '')) LIKE $${idx} OR LOWER(COALESCE(mta.subject, '')) LIKE $${idx})`);
    params.push(`%${clean}%`);
    idx++;
  }

  if (filters?.standard && filters.standard !== 'all') {
    const stdNum = parseInt(filters.standard, 10);
    if (!Number.isNaN(stdNum)) {
      where.push(`mta.standard_id = $${idx}`);
      params.push(stdNum);
      idx++;
    }
  }

  if (filters?.unit && filters.unit !== 'all') {
    const uNum = parseInt(filters.unit, 10);
    if (!Number.isNaN(uNum)) {
      where.push(`mta.unit_id = $${idx}`);
      params.push(uNum);
      idx++;
    }
  }

  if (filters?.lesson && filters.lesson.trim()) {
    where.push(`(LOWER(COALESCE(mta.lesson_title, '')) LIKE $${idx} OR LOWER(COALESCE(mta.test_title, '')) LIKE $${idx})`);
    params.push(`%${filters.lesson.trim().toLowerCase()}%`);
    idx++;
  }

  if (filters?.awardType && filters.awardType !== 'all') {
    where.push(`UPPER(COALESCE(mta.award_type, 'NONE')) = $${idx}`);
    params.push(filters.awardType.trim().toUpperCase());
    idx++;
  }

  if (filters?.search && filters.search.trim()) {
    where.push(
      `(LOWER(COALESCE(s.full_name, '')) LIKE $${idx} OR LOWER(COALESCE(s.email, '')) LIKE $${idx} OR LOWER(COALESCE(mta.lesson_title, mta.test_title, '')) LIKE $${idx})`
    );
    params.push(`%${filters.search.trim().toLowerCase()}%`);
    idx++;
  }

  const limit = Math.max(10, Math.min(200, Number(filters?.limit) || 100));
  const whereClause = `WHERE ${where.join(' AND ')}`;

  const [rowsRes, aggRes] = await Promise.all([
    pool.query(
      `SELECT
         mta.id,
         mta.student_id,
         COALESCE(s.full_name, 'Student #' || mta.student_id::text) AS student_name,
         COALESCE(s.email, '') AS student_email,
         COALESCE(mta.group_id, mta.category, 'group1') AS group_id,
         COALESCE(mta.subject, mta.subject_id, 'General Studies') AS subject,
         mta.standard_id,
         mta.unit_id,
         COALESCE(mta.lesson_title, mta.test_title, 'Assessment') AS lesson_title,
         COALESCE(mta.attempt_number, 1) AS attempt_number,
         COALESCE(mta.score, 0) AS score,
         COALESCE(mta.max_score, 0) AS max_score,
         COALESCE(mta.percentage, 0) AS percentage,
         COALESCE(mta.award_type, 'NONE') AS award_type,
         COALESCE(mta.mock_test_format, mta.assessment_type, 'mcq_practice') AS mode,
         mta.completed_at
       FROM mock_test_attempts mta
       LEFT JOIN students s ON s.id = mta.student_id
       ${whereClause}
       ORDER BY mta.completed_at DESC, mta.id DESC
       LIMIT $${idx}`,
      [...params, limit]
    ),
    pool.query(
      `SELECT mta.award_type, mta.percentage
       FROM mock_test_attempts mta
       LEFT JOIN students s ON s.id = mta.student_id
       ${whereClause}`,
      params
    ),
  ]);

  const settings = await getAwardSettings();
  const counters = computeAwardCountersFromRows(aggRes.rows);

  const items = rowsRes.rows.map((r) => {
    const pct = Math.round(Number(r.percentage || 0) * 100) / 100;
    const stored = String(r.award_type || '').toUpperCase().trim();
    const awardType: AwardType =
      stored === 'GOLD' || stored === 'PLATINUM' || stored === 'SILVER' || stored === 'NONE'
        ? (stored as AwardType)
        : resolveAwardForPercentage(pct, settings);
    return {
      id: r.id,
      studentId: r.student_id,
      studentName: r.student_name,
      studentEmail: r.student_email,
      groupId: r.group_id,
      subject: r.subject,
      standardId: r.standard_id ? Number(r.standard_id) : null,
      unitId: r.unit_id ? Number(r.unit_id) : null,
      lessonTitle: r.lesson_title,
      attemptNumber: Number(r.attempt_number || 1),
      score: Number(r.score || 0),
      maxScore: Number(r.max_score || 0),
      percentage: pct,
      awardType,
      mode: r.mode,
      completedAt: r.completed_at,
    };
  });

  return {
    summary: {
      totalAttempts: aggRes.rows.length,
      ...counters,
    },
    items,
  };
}
