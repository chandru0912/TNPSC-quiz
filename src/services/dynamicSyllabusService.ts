/**
 * Dynamic Syllabus Service (Single Source of Truth)
 * 
 * Centralized, reactive service for all syllabus-related dropdowns, cascades,
 * and data fetching across Question Bank, Add Question, Study Notes, Add Study Notes,
 * Cloud AI Question Generator, Cloud AI Study Notes Generator, and Student Study Materials.
 * 
 * Powered by PostgreSQL via /api/syllabus/* endpoints.
 */

export interface DynamicExam {
  id: string;
  name: string;
  code?: string | null;
  badge?: string | null;
  description?: string | null;
  display_order: number;
}

export interface DynamicSubject {
  id: string;
  exam_id?: string;
  name: string;
  description?: string | null;
  display_order?: number;
}

export interface DynamicStandard {
  id: number;
  label: string;
  shortLabel: string;
}

export interface DynamicUnit {
  id: number;
  unit_number: number;
  unit_code?: string;
  unitNumber?: string;
  title: string;
  subject_name?: string;
  subjectName?: string;
  description?: string;
  display_order?: number;
  lessons_count?: number;
  notesCount?: number;
}

export interface DynamicLesson {
  id: string;
  unit_id: number;
  exam_id: string;
  subject_id: string;
  standard_number: number;
  lesson_number: string;
  title: string;
  term?: string;
  description?: string;
  status?: string;
  display_order?: number;
  topics_count?: number;
  has_notes?: boolean;
}

export interface DynamicTopic {
  id: number;
  lesson_id: string;
  unit_id?: number;
  topic_name: string;
  description?: string | null;
  display_order?: number;
  notes_count?: number;
  has_notes?: boolean;
}

export const CANONICAL_EXAMS: DynamicExam[] = [
  { id: 'group1', name: 'TNPSC Group 1', display_order: 1 },
  { id: 'group2', name: 'TNPSC Group 2', display_order: 2 },
  { id: 'group2a', name: 'TNPSC Group 2A', display_order: 3 },
  { id: 'group4', name: 'TNPSC Group 4', display_order: 4 },
];

export const ALL_STANDARDS: DynamicStandard[] = [
  { id: 6, label: '6th Standard', shortLabel: '6th Std' },
  { id: 7, label: '7th Standard', shortLabel: '7th Std' },
  { id: 8, label: '8th Standard', shortLabel: '8th Std' },
  { id: 9, label: '9th Standard', shortLabel: '9th Std' },
  { id: 10, label: '10th Standard', shortLabel: '10th Std' },
  { id: 11, label: '11th Standard', shortLabel: '11th Std' },
  { id: 12, label: '12th Standard', shortLabel: '12th Std' },
];

// In-memory cache
const cache = {
  exams: null as DynamicExam[] | null,
  subjects: new Map<string, DynamicSubject[]>(),
  units: new Map<string, DynamicUnit[]>(),
  lessons: new Map<string, DynamicLesson[]>(),
  topics: new Map<string, DynamicTopic[]>(),
  tree: new Map<string, any[]>(),
};

type SyllabusListener = (event: { type: string; payload?: any }) => void;
const listeners = new Set<SyllabusListener>();

// Cross-tab synchronization via BroadcastChannel & storage events
let syncChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    syncChannel = new BroadcastChannel('tnpsc_syllabus_sync');
    syncChannel.onmessage = (event) => {
      // Invalidate local caches across open tabs
      cache.exams = null;
      cache.subjects.clear();
      cache.units.clear();
      cache.lessons.clear();
      cache.topics.clear();
      cache.tree.clear();

      listeners.forEach((fn) => {
        try {
          fn(event.data || { type: 'remote_update' });
        } catch (err) {
          console.error('[DynamicSyllabus] Broadcast listener error:', err);
        }
      });
      window.dispatchEvent(new CustomEvent('tnpsc_syllabus_updated', { detail: event.data }));
    };
  } catch (err) {
    console.warn('[DynamicSyllabus] BroadcastChannel initialization error:', err);
  }
}

// Redundant storage event listener for cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'tnpsc_syllabus_sync_ping') {
      cache.exams = null;
      cache.subjects.clear();
      cache.units.clear();
      cache.lessons.clear();
      cache.topics.clear();
      cache.tree.clear();

      listeners.forEach((fn) => {
        try {
          fn({ type: 'storage_sync', payload: e.newValue });
        } catch (err) {}
      });
      window.dispatchEvent(new CustomEvent('tnpsc_syllabus_updated', { detail: { type: 'storage_sync' } }));
    }
  });
}

export const dynamicSyllabusService = {
  /**
   * Subscribe to syllabus change events (created, updated, published, deleted)
   */
  subscribe(fn: SyllabusListener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  /**
   * Broadcast syllabus update to all open listeners and invalidates local cache
   */
  notifySyllabusChanged(type: string = 'updated', payload?: any) {
    // Clear in-memory caches
    cache.exams = null;
    cache.subjects.clear();
    cache.units.clear();
    cache.lessons.clear();
    cache.topics.clear();
    cache.tree.clear();

    // Notify registered subscribers
    listeners.forEach((fn) => {
      try {
        fn({ type, payload });
      } catch (err) {
        console.error('[DynamicSyllabus] Listener error:', err);
      }
    });

    // Notify BroadcastChannel for cross-tab sync
    if (syncChannel) {
      try {
        syncChannel.postMessage({ type, payload });
      } catch (err) {
        console.warn('[DynamicSyllabus] BroadcastChannel postMessage failed:', err);
      }
    }

    // Ping localStorage to wake up other tabs
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('tnpsc_syllabus_sync_ping', String(Date.now()));
      } catch (e) {}
    }

    // Also dispatch global window event for cross-component triggers
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tnpsc_syllabus_updated', { detail: { type, payload } }));
    }
  },

  /**
   * Fetch Active Exams from Master Syllabus API
   */
  async getExams(): Promise<DynamicExam[]> {
    if (cache.exams && cache.exams.length > 0) {
      return cache.exams;
    }
    try {
      const res = await fetch('/api/syllabus/exams');
      const data = await res.json();
      if (data.success && Array.isArray(data.exams) && data.exams.length > 0) {
        // Support all 4 canonical groups
        const allowed = new Set(['group1', 'group2', 'group2a', 'group4']);
        const filtered: DynamicExam[] = data.exams
          .filter((e: any) => allowed.has(e.id))
          .map((e: any) => ({
            id: e.id,
            name: e.name || (e.id === 'group1' ? 'TNPSC Group 1' : e.id === 'group2' ? 'TNPSC Group 2' : e.id === 'group2a' ? 'TNPSC Group 2A' : 'TNPSC Group 4'),
            display_order: e.display_order || (e.id === 'group1' ? 1 : e.id === 'group2' ? 2 : e.id === 'group2a' ? 3 : 4),
            code: e.code || null,
            badge: e.badge || null,
            description: e.description || null,
          }))
          .sort((a: DynamicExam, b: DynamicExam) => a.display_order - b.display_order);

        cache.exams = filtered;
        return filtered;
      }
    } catch (err) {
      console.warn('[DynamicSyllabus] Failed to fetch /api/syllabus/exams, falling back to canonical:', err);
    }
    cache.exams = CANONICAL_EXAMS;
    return CANONICAL_EXAMS;
  },

  /**
   * Fetch Subjects for an Exam
   */
  async getSubjects(rawExamId: string): Promise<DynamicSubject[]> {
    const examId = rawExamId || 'group1';
    if (cache.subjects.has(examId)) {
      return cache.subjects.get(examId)!;
    }

    try {
      const res = await fetch(`/api/syllabus/subjects?groupId=${encodeURIComponent(examId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.subjects) && data.subjects.length > 0) {
        const subs: DynamicSubject[] = data.subjects.map((s: any) => ({
          id: s.id || s.subject_slug,
          exam_id: examId,
          name: s.name,
          description: s.description || '',
          display_order: s.display_order || 0,
        }));
        cache.subjects.set(examId, subs);
        return subs;
      }
    } catch (err) {
      console.warn(`[DynamicSyllabus] Failed to fetch subjects for ${examId}:`, err);
    }

    // Default canonical subjects
    const defaultSubs: DynamicSubject[] = [
      { id: 'general-studies', name: 'General Studies', exam_id: examId },
      { id: 'aptitude', name: 'Aptitude and Mental Ability', exam_id: examId },
    ];
    if (examId === 'group2' || examId === 'group2a' || examId === 'group4') {
      defaultSubs.push(
        { id: 'general-tamil', name: 'General Tamil (பொதுத் தமிழ்)', exam_id: examId },
        { id: 'general-english', name: 'General English', exam_id: examId }
      );
    }
    cache.subjects.set(examId, defaultSubs);
    return defaultSubs;
  },

  /**
   * Get Standards dynamically based on Exam and Subject
   */
  getStandards(rawExamId: string, subjectId: string): DynamicStandard[] {
    const examId = rawExamId;
    const normSub = (subjectId || '').toLowerCase();
    if (examId === 'group4' || normSub.includes('aptitude')) {
      return ALL_STANDARDS.filter((s) => s.id >= 6 && s.id <= 10);
    }
    return ALL_STANDARDS;
  },

  /**
   * Fetch Units dynamically from PostgreSQL
   */
  async getUnits(
    rawExamId: string,
    subjectId: string,
    standardId?: number | 'all'
  ): Promise<DynamicUnit[]> {
    const examId = rawExamId || 'group1';
    const stdNum = typeof standardId === 'number' ? standardId : undefined;
    const cacheKey = `${examId}|${subjectId}|${stdNum ?? 'all'}`;

    if (cache.units.has(cacheKey)) {
      return cache.units.get(cacheKey)!;
    }

    try {
      const url = `/api/syllabus/units?groupId=${encodeURIComponent(examId)}&subjectId=${encodeURIComponent(subjectId)}${stdNum ? `&standardId=${stdNum}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.units) && data.units.length > 0) {
        const units: DynamicUnit[] = data.units.map((u: any) => ({
          id: u.id,
          unit_number: u.unit_number != null ? Number(u.unit_number) : (u.unitNum != null ? Number(u.unitNum) : Number(u.id)),
          unit_code: u.unit_code || u.unitNumber || `Unit ${u.unit_number || u.id}`,
          unitNumber: u.unitNumber || u.unit_code || `Unit ${u.unit_number || u.id}`,
          title: u.title,
          subject_name: u.subject_name || u.subjectName,
          subjectName: u.subjectName || u.subject_name,
          display_order: u.display_order || u.unit_number || u.id,
          notesCount: u.notesCount || 0,
        }));
        cache.units.set(cacheKey, units);
        return units;
      }
    } catch (err) {
      console.warn(`[DynamicSyllabus] Failed to fetch units from API:`, err);
    }

    // Fallback units if none in database yet
    const fallbackUnits: DynamicUnit[] = [
      { id: 1, unit_number: 1, unit_code: 'Unit 1', unitNumber: 'Unit 1', title: 'General Science', subjectName: 'General Science' },
      { id: 2, unit_number: 2, unit_code: 'Unit 2', unitNumber: 'Unit 2', title: 'Geography of India', subjectName: 'Geography' },
      { id: 3, unit_number: 3, unit_code: 'Unit 3', unitNumber: 'Unit 3', title: 'History and Culture of India', subjectName: 'History' },
      { id: 4, unit_number: 4, unit_code: 'Unit 4', unitNumber: 'Unit 4', title: 'Indian Polity', subjectName: 'Indian Polity' },
      { id: 5, unit_number: 5, unit_code: 'Unit 5', unitNumber: 'Unit 5', title: 'Indian Economy', subjectName: 'Indian Economy' },
      { id: 6, unit_number: 6, unit_code: 'Unit 6', unitNumber: 'Unit 6', title: 'Indian National Movement', subjectName: 'INM' },
    ];
    cache.units.set(cacheKey, fallbackUnits);
    return fallbackUnits;
  },

  /**
   * Fetch Lessons dynamically from PostgreSQL
   */
  async getLessons(params: {
    examId?: string;
    subjectId?: string;
    standardNumber?: number | 'all';
    unitId?: number | 'all';
    unitNumber?: number;
  }): Promise<DynamicLesson[]> {
    const rawExam = params.examId || 'group1';
    const examId = rawExam === 'group2a' ? 'group2' : rawExam;
    const stdNum = typeof params.standardNumber === 'number' ? params.standardNumber : undefined;
    const uNum = typeof params.unitNumber === 'number'
      ? params.unitNumber
      : (typeof params.unitId === 'number' && params.unitId < 100 ? params.unitId : undefined);
    const uId = typeof params.unitId === 'number' ? params.unitId : undefined;
    const sub = params.subjectId || '';

    const cacheKey = `${examId}|${sub}|${stdNum ?? 'all'}|${uId ?? 'all'}|${uNum ?? 'all'}`;
    if (cache.lessons.has(cacheKey)) {
      return cache.lessons.get(cacheKey)!;
    }

    try {
      const q = new URLSearchParams();
      if (examId && examId !== 'all') q.set('examId', examId);
      if (sub && sub !== 'all') q.set('subjectId', sub);
      if (stdNum) q.set('standardNumber', String(stdNum));
      if (uNum) q.set('unitNumber', String(uNum));
      if (uId) q.set('unitId', String(uId));

      const res = await fetch(`/api/syllabus/lessons?${q.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.lessons)) {
        cache.lessons.set(cacheKey, data.lessons);
        return data.lessons;
      }
    } catch (err) {
      console.warn(`[DynamicSyllabus] Failed to fetch lessons:`, err);
    }

    return [];
  },

  /**
   * Fetch Topics dynamically for a Lesson from PostgreSQL Master Syllabus
   */
  async getTopics(
    lessonIdOrTitle: string,
    options?: { lessonTitle?: string; unitId?: number }
  ): Promise<DynamicTopic[]> {
    const lId = (lessonIdOrTitle || '').trim();
    const lTitle = (options?.lessonTitle || (lId && isNaN(Number(lId)) && !lId.includes('-l') ? lId : '')).trim();
    const uId = options?.unitId;

    if (!lId && !lTitle) return [];

    const cacheKey = `${lId}__${lTitle}__${uId || ''}`;
    if (cache.topics.has(cacheKey)) {
      return cache.topics.get(cacheKey)!;
    }

    try {
      const q = new URLSearchParams();
      if (lId) q.set('lessonId', lId);
      if (lTitle) q.set('lessonTitle', lTitle);
      if (uId) q.set('unitId', String(uId));

      const res = await fetch(`/api/syllabus/topics?${q.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.topics) && data.topics.length > 0) {
        cache.topics.set(cacheKey, data.topics);
        return data.topics;
      }
    } catch (err) {
      console.warn(`[DynamicSyllabus] Failed to fetch topics for ${lId || lTitle}:`, err);
    }

    return [];
  },

  /**
   * Reorder Units across Master Syllabus
   */
  async reorderUnits(items: Array<{ id: number; display_order: number }>, token?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/syllabus/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: 'units', items }),
      });
      const data = await res.json();
      if (data.success) {
        this.notifySyllabusChanged('reordered', { type: 'units', count: items.length });
        return true;
      }
    } catch (err) {
      console.error('[DynamicSyllabus] Failed to reorder units:', err);
    }
    return false;
  },

  /**
   * Reorder Lessons across Master Syllabus
   */
  async reorderLessons(items: Array<{ id: string; display_order: number }>, token?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/syllabus/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: 'lessons', items }),
      });
      const data = await res.json();
      if (data.success) {
        this.notifySyllabusChanged('reordered', { type: 'lessons', count: items.length });
        return true;
      }
    } catch (err) {
      console.error('[DynamicSyllabus] Failed to reorder lessons:', err);
    }
    return false;
  },

  /**
   * Reorder Topics across Master Syllabus
   */
  async reorderTopics(items: Array<{ id: number; display_order: number }>, token?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/syllabus/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: 'topics', items }),
      });
      const data = await res.json();
      if (data.success) {
        this.notifySyllabusChanged('reordered', { type: 'topics', count: items.length });
        return true;
      }
    } catch (err) {
      console.error('[DynamicSyllabus] Failed to reorder topics:', err);
    }
    return false;
  },
};
