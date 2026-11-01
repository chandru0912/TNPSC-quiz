/**
 * Canonical Lesson Mapping and Identifiers Service
 * Ensures unique, deterministic, cross-system lesson mapping keys across
 * TNPSC Group, Standard, Subject, Term, Unit ID, Lesson ID, and Lesson Code.
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
 * Resolves standard syllabus lesson IDs based on Group, Subject, Class, Unit, and Term.
 * Provides backwards-compatible IDs matching Study Materials cards (e.g. gt-1-6-t1-l1, gs-1-6-l1).
 */
export function resolveSyllabusLessonId(params: CanonicalLessonParams): {
  lessonId: string;
  lessonCode: string;
  term: string;
} {
  const normCat = normalizeGroupCategory(params.category);
  const normClass = parseInt(String(params.classId || '').replace(/\D/g, ''), 10) || 6;
  const normSub = normalizeSubjectSlug(params.subject);
  const normTerm = normalizeTermSlug(params.term);
  const normUnit = parseInt(String(params.unitId || '').replace(/\D/g, ''), 10) || 1;
  const normNum = cleanLessonNumberStr(params.lessonNumber);
  const displayTerm = normTerm === 'term2' ? 'Term 2' : normTerm === 'term3' ? 'Term 3' : normTerm === 'fullyear' ? 'Full Year' : 'Term 1';

  const lessonCode = buildCanonicalLessonCode({
    category: normCat,
    classId: normClass,
    subject: normSub,
    term: displayTerm,
    unitId: normUnit,
    lessonNumber: normNum,
  });

  // If explicit syllabus lessonId passed (e.g. gt-1-6-t1-l1 or gs-1-6-l1), preserve it!
  if (params.lessonId && params.lessonId.length > 3 && !params.lessonId.startsWith('group')) {
    return {
      lessonId: params.lessonId.trim(),
      lessonCode,
      term: displayTerm,
    };
  }

  // Known TNPSC Study Materials registry mappings
  let resolvedId = '';

  if (normSub === 'generaltamil') {
    // Term digit: 1, 2, or 3
    const tDigit = normTerm === 'term2' ? '2' : normTerm === 'term3' ? '3' : '1';
    // Lesson index within unit
    const subIdx = normNum.includes('.') ? normNum.split('.')[1] : '1';
    resolvedId = `gt-${normUnit}-${normClass}-t${tDigit}-l${subIdx}`;
  } else if (normSub === 'generalstudies') {
    const subIdx = normNum.includes('.') ? normNum.split('.')[1] : '1';
    if (normCat === 'group4') {
      resolvedId = `g4-gs-${normUnit}-${normClass}-l${subIdx}`;
    } else if (normCat === 'group1') {
      resolvedId = `${normUnit}-${normClass}-l${subIdx}`;
    } else {
      resolvedId = `gs-${normUnit}-${normClass}-l${subIdx}`;
    }
  } else if (normSub === 'generalenglish') {
    const subIdx = normNum.includes('.') ? normNum.split('.')[1] : '1';
    resolvedId = `ge-${normUnit}-${normClass}-l${subIdx}`;
  } else {
    resolvedId = `${normCat}_std${normClass}_${normSub}_u${normUnit}_l${normNum.replace('.', '_')}`;
  }

  return {
    lessonId: resolvedId,
    lessonCode,
    term: displayTerm,
  };
}

