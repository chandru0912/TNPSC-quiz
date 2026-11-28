/**
 * naturalSort.ts
 *
 * Robust natural numeric sorting utilities for TNPSC Aspirant Orbit.
 * Properly orders alphanumeric multi-segment numbering like:
 * - "1.1", "1.2", "1.9", "1.10", "1.11", ..., "1.15"
 * - "L-1.1", "L-1.2", "L-1.10"
 * - "Unit 1", "Unit 2", "Unit 10"
 * - "1.1.2", "1.1.3", "1.1.10"
 */

/**
 * Natural numeric comparator for any two strings, numbers, or codes.
 */
export function naturalCompare(
  aStr: string | number | null | undefined,
  bStr: string | number | null | undefined
): number {
  if (aStr == null && bStr == null) return 0;
  if (aStr == null) return 1;
  if (bStr == null) return -1;

  const a = String(aStr).trim();
  const b = String(bStr).trim();

  if (a === b) return 0;

  // Match consecutive digits (\d+) or non-digits (\D+)
  const regex = /(\d+|\D+)/g;
  const aChunks = a.match(regex) || [];
  const bChunks = b.match(regex) || [];

  const len = Math.max(aChunks.length, bChunks.length);
  for (let i = 0; i < len; i++) {
    const aChunk = aChunks[i];
    const bChunk = bChunks[i];

    if (aChunk === undefined) return -1;
    if (bChunk === undefined) return 1;

    const aNum = parseInt(aChunk, 10);
    const bNum = parseInt(bChunk, 10);

    const aIsNum = !isNaN(aNum) && /^\d+$/.test(aChunk);
    const bIsNum = !isNaN(bNum) && /^\d+$/.test(bChunk);

    if (aIsNum && bIsNum) {
      if (aNum !== bNum) {
        return aNum - bNum;
      }
      // If numeric values are identical (e.g., "01" vs "1"), shorter chunk first
      if (aChunk.length !== bChunk.length) {
        return aChunk.length - bChunk.length;
      }
    } else {
      const cmp = aChunk.localeCompare(bChunk, undefined, { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }
  }

  return a.localeCompare(b);
}

export interface GenericLessonItem {
  id?: string | number;
  standard_number?: number;
  standard?: number;
  lesson_number?: string;
  lessonNumber?: string;
  display_order?: number;
  title?: string;
}

/**
 * Compare two lesson objects by standard, explicit display_order (if both > 0 and unequal),
 * natural numeric lesson_number, and deterministic fallback (title).
 */
export function compareLessons<T extends GenericLessonItem>(a: T, b: T): number {
  // 1. Standard number ascending
  const stdA = a.standard_number ?? a.standard ?? 0;
  const stdB = b.standard_number ?? b.standard ?? 0;
  if (stdA !== stdB) {
    return stdA - stdB;
  }

  // 2. Explicit custom display_order (only if both > 0 and distinct)
  const ordA = a.display_order ?? 0;
  const ordB = b.display_order ?? 0;
  if (ordA > 0 && ordB > 0 && ordA !== ordB) {
    return ordA - ordB;
  }

  // 3. Natural numeric comparison of lesson_number / lessonNumber
  const numA = a.lesson_number ?? a.lessonNumber ?? '';
  const numB = b.lesson_number ?? b.lessonNumber ?? '';
  const numCmp = naturalCompare(numA, numB);
  if (numCmp !== 0) {
    return numCmp;
  }

  // 4. Secondary fallback: title or id
  const titleA = a.title ?? '';
  const titleB = b.title ?? '';
  return naturalCompare(titleA, titleB);
}

export interface GenericTopicItem {
  id?: string | number;
  display_order?: number;
  topic_name?: string;
  topicName?: string;
  name?: string;
}

/**
 * Compare two topic objects by explicit display_order, then natural numeric name.
 */
export function compareTopics<T extends GenericTopicItem>(a: T, b: T): number {
  const ordA = a.display_order ?? 0;
  const ordB = b.display_order ?? 0;
  if (ordA > 0 && ordB > 0 && ordA !== ordB) {
    return ordA - ordB;
  }

  const nameA = a.topic_name ?? a.topicName ?? a.name ?? '';
  const nameB = b.topic_name ?? b.topicName ?? b.name ?? '';
  return naturalCompare(nameA, nameB);
}
