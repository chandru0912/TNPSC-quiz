/**
 * Frontend Canonical Lesson Mapping and Identifiers
 * Produces deterministic unique lesson keys matching backend study_notes records.
 */

export function normalizeGroupCategory(cat: string): string {
  const c = String(cat || '').trim().toLowerCase();
  if (c === 'group1') return 'group1';
  if (c === 'group2' || c === 'group2a' || c === 'group2_2a') return 'group2';
  if (c === 'group4' || c === 'vao' || c === 'group4_vao') return 'group4';
  return c.replace(/[^a-z0-9]/g, '') || 'group2';
}

export function normalizeSubjectSlug(sub: string): string {
  const s = String(sub || '').trim().toLowerCase();
  if (s.includes('tamil')) return 'generaltamil';
  if (s.includes('english')) return 'generalenglish';
  if (s.includes('aptitude') || s.includes('mental')) return 'aptitude';
  return 'generalstudies';
}

export function normalizeTermSlug(term?: string): string {
  const t = String(term || '').trim().toLowerCase();
  if (t.includes('term 2') || t === 'term2' || t === '2') return 'term2';
  if (t.includes('term 3') || t === 'term3' || t === '3') return 'term3';
  if (t.includes('full') || t === 'fullyear') return 'fullyear';
  return 'term1';
}

export function cleanLessonNumberStr(num?: string | number): string {
  const s = String(num || '1.1').trim();
  const match = s.match(/[0-9]+(\.[0-9]+)*/);
  return match ? match[0] : '1.1';
}

export interface CanonicalLessonParams {
  category: string;
  classId: number | string;
  subject: string;
  term?: string;
  unitId: number | string;
  lessonNumber?: string | number;
  lessonId?: string;
  lessonTitle?: string;
}

/**
 * Builds a deterministic canonical lesson code that is unique across all units, terms, and standards.
 * Example output: "group2_std6_generaltamil_term1_u1_l1.1"
 */
export function buildCanonicalLessonCode(params: CanonicalLessonParams): string {
  const normCat = normalizeGroupCategory(params.category);
  const normClass = parseInt(String(params.classId || '').replace(/\D/g, ''), 10) || 6;
  const normSub = normalizeSubjectSlug(params.subject);
  const normTerm = normalizeTermSlug(params.term);
  const normUnit = parseInt(String(params.unitId || '').replace(/\D/g, ''), 10) || 1;
  const normNum = cleanLessonNumberStr(params.lessonNumber);

  return `${normCat}_std${normClass}_${normSub}_${normTerm}_u${normUnit}_l${normNum}`;
}

/**
 * Builds the URL query parameters for StudyNotesPage with all unique lesson identifiers.
 */
export function buildStudyNotesUrl(params: {
  group: string;
  subjectId: string;
  unitId: number | string;
  classId?: number | string;
  lessonTitle: string;
  lessonNumber?: string;
  lessonId?: string;
  term?: string;
  lang?: 'tamil' | 'english';
}): string {
  const normCat = normalizeGroupCategory(params.group);
  const classNum = params.classId ? parseInt(String(params.classId).replace(/\D/g, ''), 10) : 6;
  const unitNum = parseInt(String(params.unitId).replace(/\D/g, ''), 10) || 1;
  const normNum = cleanLessonNumberStr(params.lessonNumber);
  const termStr = params.term || 'Term 1';

  const lessonCode = buildCanonicalLessonCode({
    category: normCat,
    classId: classNum,
    subject: params.subjectId,
    term: termStr,
    unitId: unitNum,
    lessonNumber: normNum,
    lessonId: params.lessonId,
  });

  const query = new URLSearchParams();
  if (params.lang) query.set('lang', params.lang);
  query.set('classId', String(classNum));
  query.set('unitId', String(unitNum));
  if (params.lessonId) query.set('lessonId', params.lessonId);
  query.set('lessonNumber', normNum);
  query.set('term', termStr);
  query.set('lessonCode', lessonCode);

  return `/study-notes/${params.group}/subject/${params.subjectId}/unit/${unitNum}/lesson/${encodeURIComponent(params.lessonTitle)}?${query.toString()}`;
}

