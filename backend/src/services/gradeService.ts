import pool from '../db';

export interface GradeBoundary {
  id?: number;
  gradeLabel: string;
  minPercentage: number;
  maxPercentage: number;
  displayOrder: number;
  colorHex: string;
}

export const DEFAULT_GRADE_BOUNDARIES: GradeBoundary[] = [
  { gradeLabel: 'A+', minPercentage: 90, maxPercentage: 100, displayOrder: 1, colorHex: '#10b981' },
  { gradeLabel: 'A', minPercentage: 80, maxPercentage: 89.99, displayOrder: 2, colorHex: '#34d399' },
  { gradeLabel: 'B+', minPercentage: 70, maxPercentage: 79.99, displayOrder: 3, colorHex: '#60a5fa' },
  { gradeLabel: 'B', minPercentage: 60, maxPercentage: 69.99, displayOrder: 4, colorHex: '#818cf8' },
  { gradeLabel: 'C', minPercentage: 50, maxPercentage: 59.99, displayOrder: 5, colorHex: '#fbbf24' },
  { gradeLabel: 'D', minPercentage: 40, maxPercentage: 49.99, displayOrder: 6, colorHex: '#fb923c' },
  { gradeLabel: 'Needs Improvement', minPercentage: 0, maxPercentage: 39.99, displayOrder: 7, colorHex: '#f87171' },
];

let cachedBoundaries: { data: GradeBoundary[]; expiresAt: number } | null = null;

export function invalidateGradeBoundariesCache(): void {
  cachedBoundaries = null;
}

export async function getGradeBoundaries(): Promise<GradeBoundary[]> {
  if (cachedBoundaries && cachedBoundaries.expiresAt > Date.now()) {
    return cachedBoundaries.data;
  }

  try {
    const res = await pool.query(
      `SELECT id, grade_label, min_percentage, max_percentage, display_order, color_hex
       FROM grade_settings
       ORDER BY min_percentage DESC, display_order ASC`
    );
    if (res.rows.length > 0) {
      const data: GradeBoundary[] = res.rows.map((r) => ({
        id: Number(r.id),
        gradeLabel: String(r.grade_label),
        minPercentage: Number(r.min_percentage),
        maxPercentage: Number(r.max_percentage),
        displayOrder: Number(r.display_order || 1),
        colorHex: String(r.color_hex || '#a855f7'),
      }));
      cachedBoundaries = { data, expiresAt: Date.now() + 60_000 };
      return data;
    }
  } catch {
    // Fallback to defaults if table is not yet initialized
  }

  return DEFAULT_GRADE_BOUNDARIES;
}

export function resolveGradeFromBoundaries(
  percentage: number,
  boundaries: GradeBoundary[]
): { grade: string; colorHex: string } {
  const safePct = Math.max(0, Math.min(100, Number(percentage) || 0));
  const sorted = [...boundaries].sort((a, b) => b.minPercentage - a.minPercentage);
  for (const b of sorted) {
    if (safePct >= b.minPercentage) {
      return { grade: b.gradeLabel, colorHex: b.colorHex || '#a855f7' };
    }
  }
  const last = sorted[sorted.length - 1] || DEFAULT_GRADE_BOUNDARIES[DEFAULT_GRADE_BOUNDARIES.length - 1];
  return { grade: last.gradeLabel, colorHex: last.colorHex };
}

export async function calculateGrade(percentage: number): Promise<{ grade: string; colorHex: string }> {
  const boundaries = await getGradeBoundaries();
  return resolveGradeFromBoundaries(percentage, boundaries);
}

export async function updateGradeBoundaries(
  input: Array<{
    gradeLabel: string;
    minPercentage: number;
    maxPercentage: number;
    displayOrder?: number;
    colorHex?: string;
  }>
): Promise<GradeBoundary[]> {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('At least one grade boundary is required.');
  }

  const cleaned = input.map((item, idx) => {
    const gradeLabel = String(item.gradeLabel || '').trim();
    const minPercentage = Number(item.minPercentage);
    const maxPercentage = Number(item.maxPercentage);
    if (!gradeLabel) {
      throw new Error(`Grade label at index ${idx} cannot be empty.`);
    }
    if (Number.isNaN(minPercentage) || Number.isNaN(maxPercentage) || minPercentage < 0 || maxPercentage > 100 || minPercentage > maxPercentage) {
      throw new Error(`Invalid percentage range for grade "${gradeLabel}".`);
    }
    return {
      gradeLabel,
      minPercentage: Math.round(minPercentage * 100) / 100,
      maxPercentage: Math.round(maxPercentage * 100) / 100,
      displayOrder: Number(item.displayOrder) || idx + 1,
      colorHex: String(item.colorHex || '#a855f7').trim(),
    };
  });

  const sortedAsc = [...cleaned].sort((a, b) => a.minPercentage - b.minPercentage);
  for (let i = 1; i < sortedAsc.length; i++) {
    if (sortedAsc[i].minPercentage <= sortedAsc[i - 1].maxPercentage) {
      throw new Error(
        `Overlapping grade ranges between "${sortedAsc[i - 1].gradeLabel}" and "${sortedAsc[i].gradeLabel}".`
      );
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM grade_settings');
    for (const row of cleaned) {
      await client.query(
        `INSERT INTO grade_settings (grade_label, min_percentage, max_percentage, display_order, color_hex, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [row.gradeLabel, row.minPercentage, row.maxPercentage, row.displayOrder, row.colorHex]
      );
    }
    await client.query('COMMIT');
    invalidateGradeBoundariesCache();
    return await getGradeBoundaries();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
